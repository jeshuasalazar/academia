const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');
const { postSchema, replySchema } = require('../middleware/validate');

// 1. Obtener listado de posts del feed global (Orden: pinned -> recientes)
router.get('/posts', authenticateToken, async (req, res) => {
  const categoryId = req.query.category; // course_id opcional
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    let sql = `
      SELECT p.id, p.course_id, p.user_id, p.title, p.content, p.pinned, p.likes_count, p.replies_count, p.created_at,
             u.name as author_name, u.avatar_gradient as author_avatar_gradient, u.role as author_role,
             c.title as category_name
      FROM discussion_posts p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN courses c ON p.course_id = c.id
    `;
    const params = [];

    if (categoryId) {
      sql += ' WHERE p.course_id = $1';
      params.push(categoryId);
    }

    sql += ` ORDER BY p.pinned DESC, p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);

    // Ajustar booleanos para SQLite
    const posts = result.rows.map(p => ({
      ...p,
      pinned: p.pinned === 1 || p.pinned === true
    }));

    res.json(posts);
  } catch (err) {
    console.error('Error al obtener posts de la comunidad:', err);
    res.status(500).json({ error: 'Error al obtener las publicaciones de la comunidad.' });
  }
});

// 2. Obtener un post específico con todas sus respuestas
router.get('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;

  try {
    // Obtener detalles del post
    const postRes = await db.query(
      `SELECT p.id, p.course_id, p.user_id, p.title, p.content, p.pinned, p.likes_count, p.replies_count, p.created_at,
              u.name as author_name, u.avatar_gradient as author_avatar_gradient, u.role as author_role,
              c.title as category_name
       FROM discussion_posts p
       INNER JOIN users u ON p.user_id = u.id
       LEFT JOIN courses c ON p.course_id = c.id
       WHERE p.id = $1`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }

    const post = {
      ...postRes.rows[0],
      pinned: postRes.rows[0].pinned === 1 || postRes.rows[0].pinned === true
    };

    // Obtener respuestas
    const repliesRes = await db.query(
      `SELECT r.id, r.post_id, r.user_id, r.content, r.likes_count, r.created_at,
              u.name as author_name, u.avatar_gradient as author_avatar_gradient, u.role as author_role
       FROM discussion_replies r
       INNER JOIN users u ON r.user_id = u.id
       WHERE r.post_id = $1
       ORDER BY r.created_at ASC`,
      [postId]
    );

    res.json({
      post,
      replies: repliesRes.rows
    });
  } catch (err) {
    console.error('Error al obtener detalles del post:', err);
    res.status(500).json({ error: 'Error al obtener los detalles del post.' });
  }
});

// 3. Crear un nuevo post en el feed (Gated by subscription)
router.post('/posts', [authenticateToken, requireActiveSubscription, postSchema], async (req, res) => {
  const { title, content, course_id } = req.body;
  const userId = req.user.id;

  try {
    const isPinned = db.isPostgres ? false : 0;
    const result = await db.query(
      `INSERT INTO discussion_posts (course_id, user_id, title, content, pinned, likes_count, replies_count) 
       VALUES ($1, $2, $3, $4, $5, 0, 0) RETURNING id`,
      [course_id || null, userId, title, content, isPinned]
    );

    const postId = result.rows && result.rows.length ? result.rows[0].id : null;

    // Otorgar +15 XP por crear un post e interactuar con la comunidad (fomenta engagement)
    const userRes = await db.query('SELECT xp FROM users WHERE id = $1', [userId]);
    const currentXp = (userRes.rows[0]?.xp || 0) + 15;
    const newLevel = Math.floor(currentXp / 100) + 1;
    await db.query('UPDATE users SET xp = $1, level = $2 WHERE id = $3', [currentXp, newLevel, userId]);

    // Comprobar logros
    try {
      const achievementsEngine = require('../services/achievements');
      await achievementsEngine.checkAndAward(userId, 'xp_reached');
    } catch (e) {}

    res.status(201).json({
      message: 'Publicación creada con éxito (+15 XP).',
      post_id: postId
    });
  } catch (err) {
    console.error('Error al crear post:', err);
    res.status(500).json({ error: 'Error al publicar en la comunidad.' });
  }
});

// 4. Responder a un post (Gated by subscription)
router.post('/posts/:id/replies', [authenticateToken, requireActiveSubscription, replySchema], async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  try {
    // Verificar si el post existe
    const postCheck = await db.query('SELECT user_id, title FROM discussion_posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }
    const postOwnerId = postCheck.rows[0].user_id;
    const postTitle = postCheck.rows[0].title;

    // Crear respuesta
    await db.query(
      'INSERT INTO discussion_replies (post_id, user_id, content, likes_count) VALUES ($1, $2, $3, 0)',
      [postId, userId, content]
    );

    // Incrementar replies_count en la publicación
    await db.query('UPDATE discussion_posts SET replies_count = replies_count + 1 WHERE id = $1', [postId]);

    // Otorgar +5 XP por responder
    const userRes = await db.query('SELECT xp FROM users WHERE id = $1', [userId]);
    const currentXp = (userRes.rows[0]?.xp || 0) + 5;
    const newLevel = Math.floor(currentXp / 100) + 1;
    await db.query('UPDATE users SET xp = $1, level = $2 WHERE id = $3', [currentXp, newLevel, userId]);

    // Enviar notificación al dueño del post (si no es la misma persona)
    if (postOwnerId !== userId) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, data) 
         VALUES ($1, 'course_update', $2, $3, $4)`,
        [
          postOwnerId,
          'Nueva respuesta en la comunidad',
          `${req.user.name} respondió a tu publicación: "${postTitle}"`,
          JSON.stringify({ post_id: postId })
        ]
      );
    }

    res.status(201).json({ message: 'Respuesta publicada con éxito (+5 XP).' });
  } catch (err) {
    console.error('Error al responder post:', err);
    res.status(500).json({ error: 'Error al publicar la respuesta.' });
  }
});

// 5. Dar like o unlike a un post
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { action } = req.body; // 'like' o 'unlike'

  try {
    const isUnlike = action === 'unlike';
    const delta = isUnlike ? -1 : 1;

    // Actualizar contador
    const result = await db.query(
      'UPDATE discussion_posts SET likes_count = likes_count + $1 WHERE id = $2',
      [delta, postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }

    res.json({ message: isUnlike ? 'Like retirado.' : 'Me gusta registrado.' });
  } catch (err) {
    console.error('Error al dar like:', err);
    res.status(500).json({ error: 'Error al registrar tu reacción.' });
  }
});

// 6. Eliminar publicación (solo autor o moderadores/instructores)
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const postRes = await db.query('SELECT user_id FROM discussion_posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }

    const postOwnerId = postRes.rows[0].user_id;

    // Permitir si es autor o administrador/instructor
    if (postOwnerId === userId || role === 'admin' || role === 'instructor') {
      await db.query('DELETE FROM discussion_posts WHERE id = $1', [postId]);
      res.json({ message: 'Publicación eliminada con éxito.' });
    } else {
      res.status(403).json({ error: 'No tienes autorización para eliminar esta publicación.' });
    }
  } catch (err) {
    console.error('Error al eliminar post:', err);
    res.status(500).json({ error: 'Error al eliminar la publicación.' });
  }
});

// 7. Fijar/desfijar publicación (solo instructores/administradores)
router.put('/posts/:id/pin', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { pinned } = req.body; // boolean
  const role = req.user.role;

  if (role !== 'admin' && role !== 'instructor') {
    return res.status(403).json({ error: 'Acceso denegado. Solo instructores o administradores pueden fijar publicaciones.' });
  }

  try {
    const isPinned = pinned ? (db.isPostgres ? true : 1) : (db.isPostgres ? false : 0);
    const result = await db.query(
      'UPDATE discussion_posts SET pinned = $1 WHERE id = $2',
      [isPinned, postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Publicación no encontrada.' });
    }

    res.json({ message: pinned ? 'Publicación fijada.' : 'Publicación desfijada.' });
  } catch (err) {
    console.error('Error al fijar/desfijar post:', err);
    res.status(500).json({ error: 'Error al actualizar el estado de fijación.' });
  }
});

module.exports = router;
