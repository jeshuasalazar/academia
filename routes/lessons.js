const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

// Obtener detalles de una lección (Gated by subscription)
router.get('/:id', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const lessonId = req.params.id;
  const userId = req.user.id;

  try {
    const lessonRes = await db.query(
      `SELECT l.*, 
              CASE WHEN up.completed IS NOT NULL THEN TRUE ELSE FALSE END as completed
       FROM lessons l
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
       WHERE l.id = $2`,
      [userId, lessonId]
    );

    if (lessonRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }

    res.json(lessonRes.rows[0]);
  } catch (err) {
    console.error('Error al obtener lección:', err);
    res.status(500).json({ error: 'Error al obtener los detalles de la lección.' });
  }
});

// Obtener los materiales descargables de una lección (Gated by subscription)
router.get('/:id/materials', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const lessonId = req.params.id;

  try {
    const result = await db.query(
      'SELECT * FROM lesson_materials WHERE lesson_id = $1 ORDER BY id ASC',
      [lessonId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener materiales:', err);
    res.status(500).json({ error: 'Error al obtener los materiales de la lección.' });
  }
});

// Completar una lección y otorgar XP (Gated by subscription)
router.post('/:id/complete', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const lessonId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Verificar si la lección existe y obtener su curso/módulo
    const lessonRes = await db.query(
      `SELECT l.id, l.title, m.course_id, m.id as module_id 
       FROM lessons l 
       INNER JOIN modules m ON l.module_id = m.id 
       WHERE l.id = $1`,
      [lessonId]
    );
    if (lessonRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }
    const lesson = lessonRes.rows[0];

    // 2. Comprobar si ya está registrada como completada
    const checkProgress = await db.query(
      'SELECT completed FROM user_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lessonId]
    );

    let xpAdded = 0;
    let newlyCompleted = false;

    if (checkProgress.rows.length === 0) {
      // Registrar progreso por primera vez
      if (db.isPostgres) {
        await db.query(
          `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) 
           VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)`,
          [userId, lessonId]
        );
      } else {
        await db.query(
          `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) 
           VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
          [userId, lessonId]
        );
      }
      newlyCompleted = true;
      xpAdded = 50; // Recompensa de 50 XP por lección completada
    } else if (checkProgress.rows[0].completed === 0 || checkProgress.rows[0].completed === false) {
      // Si estaba registrado como no completado
      await db.query(
        'UPDATE user_progress SET completed = $1, completed_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND lesson_id = $3',
        [db.isPostgres ? true : 1, userId, lessonId]
      );
      newlyCompleted = true;
      xpAdded = 50;
    }

    if (newlyCompleted) {
      // 3. Incrementar XP y calcular nivel
      const userRes = await db.query('SELECT xp, level FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];
      const currentXp = user.xp + xpAdded;
      
      // Cada 100 XP sube un nivel
      const newLevel = Math.floor(currentXp / 100) + 1;
      
      await db.query(
        'UPDATE users SET xp = $1, level = $2 WHERE id = $3',
        [currentXp, newLevel, userId]
      );

      // 4. Ejecutar motor de logros e intentar emitir certificado en segundo plano
      try {
        const achievementsEngine = require('../services/achievements');
        await achievementsEngine.checkAndAward(userId, 'lessons_completed');
        await achievementsEngine.checkAndAward(userId, 'xp_reached');
        
        const certService = require('../services/certificates');
        await certService.checkAndIssueCertificate(userId, lesson.course_id);
      } catch (achError) {
        console.error('Error al procesar logros o certificados:', achError);
      }

      res.json({
        message: 'Lección completada con éxito.',
        xp_added: xpAdded,
        total_xp: currentXp,
        level: newLevel,
        completed: true
      });
    } else {
      res.json({
        message: 'La lección ya estaba completada.',
        xp_added: 0,
        completed: true
      });
    }
  } catch (err) {
    console.error('Error al completar lección:', err);
    res.status(500).json({ error: 'Error al registrar la completación de la lección.' });
  }
});

module.exports = router;
