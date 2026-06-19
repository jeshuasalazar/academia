const { getAuth, clerkClient } = require('@clerk/express');
const db = require('../db/index');

async function authenticateToken(req, res, next) {
  try {
    const auth = getAuth(req);
    
    if (!auth.userId) {
      return res.status(401).json({ error: 'Acceso denegado. No autenticado con Clerk.' });
    }

    // 1. Buscar el usuario en la base de datos local usando clerk_id
    let result = await db.query('SELECT * FROM users WHERE clerk_id = $1', [auth.userId]);
    
    let localUser = result.rows[0];

    // 2. Lazy-Sync: Si el usuario no existe localmente, lo obtenemos de Clerk y lo creamos
    if (!localUser) {
      console.log(`👤 Sincronizando nuevo usuario de Clerk localmente: ${auth.userId}`);
      
      // Obtener detalles de Clerk
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const emailObj = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
      const email = emailObj ? emailObj.emailAddress : (clerkUser.emailAddresses[0]?.emailAddress || '');
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'Estudiante';
      const avatarUrl = clerkUser.imageUrl || null;

      // Comprobar si el email ya existe en la DB local (de un usuario que se registró antes de Clerk)
      const checkEmail = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      
      if (checkEmail.rows.length > 0) {
        // Si ya existe el email, actualizamos el clerk_id de ese usuario para linkear la cuenta
        console.log(`🔗 Asociando clerk_id a usuario existente por email: ${email}`);
        await db.query(
          'UPDATE users SET clerk_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
          [auth.userId, avatarUrl, checkEmail.rows[0].id]
        );
        
        const updatedResult = await db.query('SELECT * FROM users WHERE id = $1', [checkEmail.rows[0].id]);
        localUser = updatedResult.rows[0];
      } else {
        // Si no existe, creamos un nuevo registro en la DB local
        console.log(`➕ Creando nuevo usuario local para: ${email}`);
        
        const defaultRole = 'student';
        
        const insertRes = await db.query(
          `INSERT INTO users (name, email, password_hash, clerk_id, role, level, xp, avatar_gradient, timezone, avatar_url) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           RETURNING *`,
          [
            name,
            email.toLowerCase().trim(),
            'CLERK_EXTERNAL_USER', // Contraseña ficticia para cumplir NOT NULL de SQLite en bases existentes
            auth.userId,
            defaultRole,
            1,
            0,
            'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)',
            'America/Mexico_City',
            avatarUrl
          ]
        );
        
        if (insertRes.rows && insertRes.rows.length > 0) {
          localUser = insertRes.rows[0];
        } else {
          // Fallback para SQLite
          const selectRes = await db.query('SELECT * FROM users WHERE clerk_id = $1', [auth.userId]);
          localUser = selectRes.rows[0];
        }
      }
    }

    // 3. Adjuntar la información a req.user para compatibilidad con el resto de endpoints
    req.user = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role
    };

    next();
  } catch (err) {
    console.error('❌ Error en middleware de autenticación Clerk:', err);
    res.status(500).json({ error: 'Error interno en la verificación de autenticación.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
}

function requireInstructor(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'instructor')) {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de instructor o administrador.' });
  }
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireInstructor
};
