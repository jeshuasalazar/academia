const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');

/* ==========================================
   🔔 NOTIFICACIONES DEL USUARIO (AUTENTICADO)
   ========================================== */

// 1. Obtener notificaciones del usuario (paginadas, 20 por página)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const countRes = await db.query(
      'SELECT COUNT(id) as count FROM notifications WHERE user_id = $1',
      [userId]
    );
    const totalNotifications = Number(countRes.rows[0]?.count || 0);

    const result = await db.query(
      `SELECT id, type, title, message, data, read, created_at 
       FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Ajustar booleanos para SQLite
    const notifications = result.rows.map(n => ({
      ...n,
      read: n.read === 1 || n.read === true
    }));

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total: totalNotifications,
        pages: Math.ceil(totalNotifications / limit)
      }
    });
  } catch (err) {
    console.error('Error al obtener notificaciones:', err);
    res.status(500).json({ error: 'Error al obtener tus notificaciones.' });
  }
});

// 2. Obtener cantidad de notificaciones no leídas (para badge de campana)
router.get('/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      'SELECT COUNT(id) as count FROM notifications WHERE user_id = $1 AND (read = 0 OR read = FALSE)',
      [userId]
    );
    res.json({ unread_count: Number(result.rows[0]?.count || 0) });
  } catch (err) {
    console.error('Error al obtener contador de no leídas:', err);
    res.status(500).json({ error: 'Error al obtener el número de notificaciones no leídas.' });
  }
});

// 3. Marcar una notificación específica como leída
router.put('/:id/read', authenticateToken, async (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await db.query(
      'UPDATE notifications SET read = $1 WHERE id = $2 AND user_id = $3',
      [db.isPostgres ? true : 1, notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada o acceso denegado.' });
    }

    res.json({ message: 'Notificación marcada como leída.' });
  } catch (err) {
    console.error('Error al marcar notificación como leída:', err);
    res.status(500).json({ error: 'Error al actualizar la notificación.' });
  }
});

// 4. Marcar todas las notificaciones como leídas
router.put('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query(
      'UPDATE notifications SET read = $1 WHERE user_id = $2 AND (read = 0 OR read = FALSE)',
      [db.isPostgres ? true : 1, userId]
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas.' });
  } catch (err) {
    console.error('Error al marcar todas las notificaciones como leídas:', err);
    res.status(500).json({ error: 'Error al actualizar las notificaciones.' });
  }
});

/* ==========================================
   🎓 VERIFICACIÓN PÚBLICA DE CERTIFICADOS
   ========================================== */

// 5. Verificar certificado por código único (Público, sin Auth)
router.get('/verify/:code', async (req, res) => {
  const code = req.params.code;

  try {
    const sql = `
      SELECT cert.certificate_code, cert.issued_at,
             u.name as student_name,
             c.title as course_name, c.thumbnail as course_thumbnail
      FROM certificates cert
      INNER JOIN users u ON cert.user_id = u.id
      INNER JOIN courses c ON cert.course_id = c.id
      WHERE cert.certificate_code = $1
    `;

    const result = await db.query(sql, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        valid: false,
        error: 'Certificado inválido o inexistente. Verifica el código proporcionado.'
      });
    }

    res.json({
      valid: true,
      certificate: result.rows[0]
    });
  } catch (err) {
    console.error('Error al verificar certificado:', err);
    res.status(500).json({ error: 'Error interno del servidor al verificar el certificado.' });
  }
});

module.exports = router;
