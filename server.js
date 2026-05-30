require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db/index');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

// Middlewares estándar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir la carpeta frontend estática
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar la base de datos antes de escuchar peticiones
db.initDb().catch(err => {
  console.error('❌ Error crítico al inicializar la base de datos:', err);
});

// Middleware para proteger rutas de la API mediante JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token no válido o expirado.' });
    }
    req.user = user;
    next();
  });
}

// Middleware para verificar si el usuario es administrador
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
}

/* ==========================================
   🔑 ENDPOINTS DE AUTENTICACIÓN
   ========================================== */

// Registro de nuevos estudiantes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

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
      `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        name, 
        email.toLowerCase().trim(), 
        passwordHash, 
        'student', 
        1, 
        0, 
        'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)' // Gradiente por defecto
      ]
    );

    res.status(201).json({ message: 'Usuario registrado con éxito. Ahora puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor al registrar al usuario.' });
  }
});

// Inicio de sesión
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña obligatorios.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Generar Token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' } // Válido por 7 días
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
        avatar_gradient: user.avatar_gradient
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor en el inicio de sesión.' });
  }
});

/* ==========================================
   📚 ENDPOINTS DE CURSOS Y LECCIONES
   ========================================== */

// Listar todos los cursos
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM courses ORDER BY level_required ASC, id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar cursos:', err);
    res.status(500).json({ error: 'Error al obtener la lista de cursos.' });
  }
});

// Obtener detalles e información de lecciones para un curso
app.get('/api/courses/:id/lessons', authenticateToken, async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Obtener los detalles del curso
    const courseResult = await db.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    // 2. Obtener las lecciones y marcar las completadas por el usuario actual
    const lessonsResult = await db.query(
      `SELECT l.*, 
              CASE WHEN up.completed IS NOT NULL THEN TRUE ELSE FALSE END as completed
       FROM lessons l
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
       WHERE l.course_id = $2
       ORDER BY l.order_num ASC`,
      [userId, courseId]
    );

    res.json({
      course: courseResult.rows[0],
      lessons: lessonsResult.rows
    });
  } catch (err) {
    console.error('Error al obtener lecciones:', err);
    res.status(500).json({ error: 'Error al obtener las lecciones del curso.' });
  }
});

/* ==========================================
   📈 ENDPOINTS DE PROGRESO Y USUARIO
   ========================================== */

// Obtener datos del perfil actual actualizados
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, level, xp, avatar_gradient, created_at FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Obtener porcentaje de lecciones completadas totales
    const progressStats = await db.query(
      `SELECT 
         (SELECT COUNT(*) FROM lessons) as total_lessons,
         (SELECT COUNT(*) FROM user_progress WHERE user_id = $1) as completed_lessons`,
      [req.user.id]
    );

    const stats = progressStats.rows[0];
    const total = parseInt(stats.total_lessons) || 0;
    const completed = parseInt(stats.completed_lessons) || 0;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      user: result.rows[0],
      progressPercent
    });
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    res.status(500).json({ error: 'Error interno al consultar el perfil.' });
  }
});

// Marcar lección como completada (Suma XP y recalculación de Nivel)
app.post('/api/progress', authenticateToken, async (req, res) => {
  const { lesson_id } = req.body;
  const userId = req.user.id;

  if (!lesson_id) {
    return res.status(400).json({ error: 'lesson_id es obligatorio.' });
  }

  try {
    // 1. Verificar si la lección existe
    const lessonCheck = await db.query('SELECT course_id FROM lessons WHERE id = $1', [lesson_id]);
    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: 'La lección especificada no existe.' });
    }

    // 2. Comprobar si ya fue completada antes por este usuario
    const progressCheck = await db.query(
      'SELECT completed FROM user_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lesson_id]
    );

    let xpAdded = 0;
    let leveledUp = false;
    let newLevel = 1;
    let newXp = 0;

    if (progressCheck.rows.length === 0) {
      // Registrar nuevo progreso
      await db.query(
        'INSERT INTO user_progress (user_id, lesson_id, completed) VALUES ($1, $2, $3)',
        [userId, lesson_id, true]
      );
      
      // Otorgar 50 XP por lección completada
      xpAdded = 50;
      
      // Obtener XP actual del usuario
      const userResult = await db.query('SELECT xp, level FROM users WHERE id = $1', [userId]);
      const currentUser = userResult.rows[0];
      
      newXp = currentUser.xp + xpAdded;
      
      // Fórmula de nivel: Cada 100 XP sube 1 nivel
      newLevel = Math.floor(newXp / 100) + 1;
      
      if (newLevel > currentUser.level) {
        leveledUp = true;
      }

      // Actualizar datos del usuario
      await db.query(
        'UPDATE users SET xp = $1, level = $2 WHERE id = $3',
        [newXp, newLevel, userId]
      );
    } else {
      // Si ya estaba completada, solo recuperamos el nivel y XP actual sin sumar de nuevo
      const userResult = await db.query('SELECT xp, level FROM users WHERE id = $1', [userId]);
      newXp = userResult.rows[0].xp;
      newLevel = userResult.rows[0].level;
    }

    res.json({
      success: true,
      xpAdded,
      leveledUp,
      currentXp: newXp,
      currentLevel: newLevel
    });
  } catch (err) {
    console.error('Error al registrar progreso:', err);
    res.status(500).json({ error: 'Error interno al registrar el progreso de aprendizaje.' });
  }
});

/* ==========================================
   🤖 ENDPOINTS DE PROMPTS Y BIBLIOTECA
   ========================================== */

// Obtener biblioteca de prompts
app.get('/api/prompts', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prompts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener prompts:', err);
    res.status(500).json({ error: 'Error al obtener la galería de prompts.' });
  }
});

/* ==========================================
   📅 ENDPOINTS DE SESIONES Y CALENDARIO
   ========================================== */

// Obtener sesiones de Zoom agendadas
app.get('/api/live-sessions', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM live_sessions ORDER BY date_time ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener sesiones:', err);
    res.status(500).json({ error: 'Error al obtener las clases programadas.' });
  }
});

/* ==========================================
   🛠️ ENDPOINTS ADMINISTRATIVOS (ADMIN ONLY)
   ========================================== */

// Crear un nuevo curso
app.post('/api/admin/courses', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, thumbnail, category, level_required } = req.body;

  if (!title || !description || !thumbnail || !category) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO courses (title, description, thumbnail, category, level_required) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, description, thumbnail, category, level_required || 1]
    );
    res.status(201).json({ message: 'Curso creado con éxito.', courseId: result.rows[0]?.id });
  } catch (err) {
    console.error('Error al crear curso:', err);
    res.status(500).json({ error: 'Error interno al crear el curso.' });
  }
});

// Crear una nueva lección
app.post('/api/admin/lessons', authenticateToken, requireAdmin, async (req, res) => {
  const { course_id, title, description, video_url, duration, order_num } = req.body;

  if (!course_id || !title || !order_num) {
    return res.status(400).json({ error: 'ID de curso, título y orden de lección requeridos.' });
  }

  try {
    await db.query(
      `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [course_id, title, description || '', video_url || '', duration || '00:00', order_num]
    );
    res.status(201).json({ message: 'Lección añadida con éxito.' });
  } catch (err) {
    console.error('Error al crear lección:', err);
    res.status(500).json({ error: 'Error interno al añadir la lección.' });
  }
});

// Crear un nuevo prompt de IA
app.post('/api/admin/prompts', authenticateToken, requireAdmin, async (req, res) => {
  const { title, category, content, is_premium } = req.body;

  if (!title || !category || !content) {
    return res.status(400).json({ error: 'Título, categoría y contenido requeridos.' });
  }

  try {
    await db.query(
      `INSERT INTO prompts (title, category, content, is_premium) 
       VALUES ($1, $2, $3, $4)`,
      [title, category, content, is_premium ? 1 : 0]
    );
    res.status(201).json({ message: 'Prompt agregado a la galería.' });
  } catch (err) {
    console.error('Error al crear prompt:', err);
    res.status(500).json({ error: 'Error interno al agregar el prompt.' });
  }
});

// Programar una nueva clase en vivo
app.post('/api/admin/live-sessions', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, date_time, duration, meeting_link } = req.body;

  if (!title || !date_time || !meeting_link) {
    return res.status(400).json({ error: 'Título, fecha/hora y link de videollamada requeridos.' });
  }

  try {
    await db.query(
      `INSERT INTO live_sessions (title, description, date_time, duration, meeting_link) 
       VALUES ($1, $2, $3, $4, $5)`,
      [title, description || '', date_time, duration || '1 hora', meeting_link]
    );
    res.status(201).json({ message: 'Clase en vivo agendada con éxito.' });
  } catch (err) {
    console.error('Error al agendar clase:', err);
    res.status(500).json({ error: 'Error interno al agendar la sesión.' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`👉 Visita localmente http://localhost:${PORT}`);
});
