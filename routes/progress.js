const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');

// 1. Estadísticas generales para el Dashboard del alumno
router.get('/dashboard', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // A. Obtener datos del usuario
    const userRes = await db.query(
      'SELECT id, name, level, xp, avatar_gradient, streak_count, longest_streak FROM users WHERE id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const user = userRes.rows[0];

    // B. Contar cursos inscritos y completados
    const enrollCounts = await db.query(
      `SELECT 
        COUNT(id) as enrolled_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM enrollments WHERE user_id = $1`,
      [userId]
    );
    const enrolledCount = Number(enrollCounts.rows[0]?.enrolled_count || 0);
    const completedCount = Number(enrollCounts.rows[0]?.completed_count || 0);

    // C. Obtener 3 logros recientes ganados
    const recentAch = await db.query(
      `SELECT ua.earned_at, a.name, a.description, a.icon, a.xp_reward 
       FROM user_achievements ua 
       INNER JOIN achievements a ON ua.achievement_id = a.id 
       WHERE ua.user_id = $1 
       ORDER BY ua.earned_at DESC LIMIT 3`,
      [userId]
    );

    // D. Mini Tabla de Clasificación (Top 5 estudiantes)
    const miniLeaderboard = await db.query(
      'SELECT id, name, level, xp, avatar_gradient, streak_count FROM users ORDER BY xp DESC, id ASC LIMIT 5'
    );

    // E. Siguiente clase en vivo programada y reservada
    const dateFilter = db.isPostgres 
      ? "ls.date_time >= CURRENT_TIMESTAMP" 
      : "datetime(ls.date_time) >= datetime('now')";

    const nextSession = await db.query(
      `SELECT ls.id, ls.title, ls.date_time, ls.session_type, ls.duration
       FROM session_bookings sb 
       INNER JOIN live_sessions ls ON sb.session_id = ls.id 
       WHERE sb.user_id = $1 AND ${dateFilter} AND ls.status = 'scheduled'
       ORDER BY ls.date_time ASC LIMIT 1`,
      [userId]
    );

    // F. Cursos en progreso con porcentajes de completación
    const coursesInProgress = await db.query(
      `SELECT c.id, c.title, c.thumbnail,
              (SELECT COUNT(l.id) FROM lessons l INNER JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as total_lessons,
              (SELECT COUNT(up.lesson_id) FROM user_progress up 
               INNER JOIN lessons l ON up.lesson_id = l.id 
               INNER JOIN modules m ON l.module_id = m.id 
               WHERE m.course_id = c.id AND up.user_id = $1 AND (up.completed = 1 OR up.completed = TRUE)) as completed_lessons
       FROM enrollments e
       INNER JOIN courses c ON e.course_id = c.id
       WHERE e.user_id = $1 AND e.status = 'active'`,
      [userId]
    );

    res.json({
      user,
      stats: {
        enrolled_courses: enrolledCount,
        completed_courses: completedCount,
        xp: user.xp,
        level: user.level,
        streak: user.streak_count
      },
      recent_achievements: recentAch.rows,
      leaderboard: miniLeaderboard.rows,
      upcoming_session: nextSession.rows[0] ? {
        ...nextSession.rows[0],
        date_time: (function(val) {
          if (!val) return null;
          const d = isNaN(val) ? new Date(val) : new Date(Number(val));
          return d.toISOString();
        })(nextSession.rows[0].date_time)
      } : null,
      courses_in_progress: coursesInProgress.rows.map(course => {
        const total = Number(course.total_lessons || 0);
        const completed = Number(course.completed_lessons || 0);
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          id: course.id,
          title: course.title,
          thumbnail: course.thumbnail,
          progress_percent: percent,
          completed_lessons: completed,
          total_lessons: total
        };
      })
    });
  } catch (err) {
    console.error('Error al obtener datos del dashboard de progreso:', err);
    res.status(500).json({ error: 'Error al cargar el dashboard de progreso.' });
  }
});

// 2. Progreso detallado por curso
router.get('/courses/:id', authenticateToken, async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  try {
    const modulesRes = await db.query(
      'SELECT id, title, order_num FROM modules WHERE course_id = $1 ORDER BY order_num ASC',
      [courseId]
    );

    const progressDetails = [];

    for (const mod of modulesRes.rows) {
      // Lecciones completadas en este módulo
      const lessonsCount = await db.query(
        `SELECT 
          COUNT(l.id) as total_lessons,
          SUM(CASE WHEN up.completed IS NOT NULL THEN 1 ELSE 0 END) as completed_lessons
         FROM lessons l
         LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
         WHERE l.module_id = $2`,
        [userId, mod.id]
      );

      const totalL = Number(lessonsCount.rows[0]?.total_lessons || 0);
      const completedL = Number(lessonsCount.rows[0]?.completed_lessons || 0);

      // Intentos de quiz
      const quizRes = await db.query(
        `SELECT q.id, q.title, q.passing_score,
                (SELECT MAX(score) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = $1) as max_score,
                (SELECT passed FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = $1 AND qa.passed = $3 LIMIT 1) as passed
         FROM quizzes q 
         WHERE q.module_id = $2`,
        [userId, mod.id, db.isPostgres ? true : 1]
      );

      progressDetails.push({
        module_id: mod.id,
        title: mod.title,
        order_num: mod.order_num,
        total_lessons: totalL,
        completed_lessons: completedL,
        progress_percent: totalL > 0 ? Math.round((completedL / totalL) * 100) : 0,
        quiz: quizRes.rows[0] ? {
          id: quizRes.rows[0].id,
          title: quizRes.rows[0].title,
          passing_score: quizRes.rows[0].passing_score,
          max_score: quizRes.rows[0].max_score,
          passed: quizRes.rows[0].passed === 1 || quizRes.rows[0].passed === true
        } : null
      });
    }

    res.json(progressDetails);
  } catch (err) {
    console.error('Error al obtener progreso detallado de curso:', err);
    res.status(500).json({ error: 'Error al obtener el progreso del curso.' });
  }
});

// 3. Catálogo de logros con estado de desbloqueo del alumno
router.get('/achievements', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const sql = `
      SELECT a.id, a.name, a.description, a.icon, a.criteria_type, a.criteria_value, a.xp_reward,
             ua.earned_at as unlocked_at,
             CASE WHEN ua.id IS NOT NULL THEN TRUE ELSE FALSE END as unlocked
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
      ORDER BY a.criteria_type ASC, a.criteria_value ASC
    `;

    const result = await db.query(sql, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener logros:', err);
    res.status(500).json({ error: 'Error al obtener la galería de logros.' });
  }
});

// 4. Tabla de clasificación (Leaderboard) completa de estudiantes por XP
router.get('/leaderboard', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Top 20 estudiantes por XP
    const leaderboardRes = await db.query(
      `SELECT id, name, level, xp, avatar_gradient, streak_count 
       FROM users 
       ORDER BY xp DESC, id ASC 
       LIMIT 20`
    );

    // Encontrar el puesto (rank) exacto del usuario autenticado
    const rankRes = await db.query(
      `SELECT COUNT(id) as rank FROM users WHERE xp > (SELECT xp FROM users WHERE id = $1)`,
      [userId]
    );
    const myRank = Number(rankRes.rows[0]?.rank || 0) + 1;

    res.json({
      leaderboard: leaderboardRes.rows,
      my_rank: myRank
    });
  } catch (err) {
    console.error('Error al obtener clasificación:', err);
    res.status(500).json({ error: 'Error al obtener la tabla de clasificación.' });
  }
});

// 5. Historial y datos de racha (streak) del usuario
router.get('/streak', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      'SELECT streak_count, longest_streak, streak_last_date FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener datos de racha:', err);
    res.status(500).json({ error: 'Error al cargar la información de racha.' });
  }
});

module.exports = router;
