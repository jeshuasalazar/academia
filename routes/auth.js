const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');
const { 
  registerSchema, 
  loginSchema, 
  resetPasswordSchema, 
  profileSchema, 
  changePasswordSchema 
} = require('../middleware/validate');
const { sendPasswordResetEmail } = require('../services/email');

// Sin fallback: un secreto conocido públicamente permite forjar tokens válidos.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado. Define la variable de entorno antes de arrancar el servidor.');
}

/**
 * Obtener la fecha local formateada como YYYY-MM-DD según la zona horaria del usuario.
 */
function getLocalDateString(timezone = 'America/Mexico_City') {
  try {
    const options = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(new Date());
    return `${year}-${month}-${day}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Calcula la diferencia en días entre dos fechas YYYY-MM-DD.
 */
function getDaysDifference(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/* ==========================================
   🔑 RUTAS DE AUTENTICACIÓN PÚBLICAS
   ========================================== */

// Registro de nuevos estudiantes
router.post('/register', registerSchema, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Comprobar si el email ya existe
    const checkEmail = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insertar en la base de datos
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient, timezone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        name, 
        email.toLowerCase().trim(), 
        passwordHash, 
        'student', 
        1, 
        0, 
        'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)',
        'America/Mexico_City' // Zona horaria por defecto
      ]
    );

    res.status(201).json({ message: 'Usuario registrado con éxito. Ahora puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor al registrar al usuario.' });
  }
});

// Inicio de sesión
router.post('/login', loginSchema, async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const user = result.rows[0];

    // Verificar contraseña
    if (!user.password_hash || user.password_hash === 'CLERK_EXTERNAL_USER') {
      return res.status(400).json({ error: 'Este usuario se registró mediante un proveedor externo o no tiene una contraseña local configurada.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // --- CÁLCULO DE STREAK ---
    const userTimezone = user.timezone || 'America/Mexico_City';
    const todayStr = getLocalDateString(userTimezone);
    let newStreak = user.streak_count || 0;
    let newLongestStreak = user.longest_streak || 0;

    if (!user.streak_last_date) {
      // Primer login
      newStreak = 1;
      newLongestStreak = Math.max(1, newLongestStreak);
    } else {
      const daysDiff = getDaysDifference(user.streak_last_date, todayStr);
      if (daysDiff === 1) {
        // Login consecutivo (ayer a hoy)
        newStreak += 1;
        newLongestStreak = Math.max(newStreak, newLongestStreak);
      } else if (daysDiff > 1) {
        // Racha rota, reiniciar
        newStreak = 1;
      }
      // Si daysDiff === 0 (login el mismo día), la racha no cambia
    }

    // Actualizar racha y last_login_at
    await db.query(
      `UPDATE users 
       SET last_login_at = CURRENT_TIMESTAMP, 
           streak_count = $1, 
           longest_streak = $2, 
           streak_last_date = $3 
       WHERE id = $4`,
      [newStreak, newLongestStreak, todayStr, user.id]
    );

    // Generar Token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        level: user.level,
        xp: user.xp,
        avatar_gradient: user.avatar_gradient,
        bio: user.bio,
        timezone: userTimezone,
        avatar_url: user.avatar_url,
        streak_count: newStreak,
        longest_streak: newLongestStreak
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor en el inicio de sesión.' });
  }
});

// Solicitar restablecimiento de contraseña (olvidó contraseña)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  try {
    const userRes = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userRes.rows.length === 0) {
      // Por seguridad, devolvemos success ficticio para no revelar existencia de cuentas
      return res.json({ message: 'Si el correo electrónico está registrado, recibirás instrucciones en breve.' });
    }

    const user = userRes.rows[0];

    // Generar token de 6 dígitos
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenExpires = new Date(Date.now() + 3600000); // 1 hora de expiración

    // Guardar token en la base de datos
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [token, tokenExpires, user.id]
    );

    // Enviar correo electrónico
    await sendPasswordResetEmail(user.email, user.name, token);

    res.json({ message: 'Si el correo electrónico está registrado, recibirás instrucciones en breve.' });
  } catch (err) {
    console.error('Error en forgot-password:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud de restablecimiento de contraseña.' });
  }
});

// Restablecer contraseña con token
router.post('/reset-password', resetPasswordSchema, async (req, res) => {
  const { token, password } = req.body;

  try {
    // Buscar usuario con el token no expirado
    const userRes = await db.query(
      `SELECT id, name FROM users 
       WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
      [token]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: 'El token de restablecimiento es inválido o ha expirado.' });
    }

    const user = userRes.rows[0];

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Actualizar contraseña y limpiar tokens
    await db.query(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    res.json({ message: 'Contraseña restablecida con éxito. Ya puedes iniciar sesión con tu nueva contraseña.' });
  } catch (err) {
    console.error('Error en reset-password:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
});

/* ==========================================
   🔒 RUTAS DE AUTENTICACIÓN REQUERIDA (PERFIL)
   ========================================== */

// Obtener datos del perfil actual actualizados
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, level, xp, avatar_gradient, bio, timezone, avatar_url, streak_count, longest_streak, created_at 
       FROM users 
       WHERE id = $1`, 
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ error: 'Error interno al obtener los datos del perfil.' });
  }
});

// Editar datos del perfil
router.put('/profile', authenticateToken, profileSchema, async (req, res) => {
  const { name, bio, timezone, avatar_url } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      `UPDATE users 
       SET name = $1, bio = $2, timezone = $3, avatar_url = $4 
       WHERE id = $5`,
      [name, bio, timezone, avatar_url || null, userId]
    );

    // Responder con el perfil actualizado
    res.json({ 
      message: 'Perfil actualizado con éxito.',
      user: { id: userId, name, bio, timezone, avatar_url }
    });
  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    res.status(500).json({ error: 'Error interno al actualizar el perfil.' });
  }
});

// Cambiar contraseña
router.put('/password', authenticateToken, changePasswordSchema, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    // Obtener contraseña guardada
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    // Encriptar la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Guardar
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    res.json({ message: 'Contraseña cambiada con éxito.' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
  }
});

module.exports = router;
