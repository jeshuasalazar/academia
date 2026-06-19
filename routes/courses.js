const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');

// Listar todos los cursos publicados con progreso del alumno
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const sql = `
      SELECT c.*, 
             u.name as instructor_name,
             (SELECT COUNT(l.id) FROM lessons l INNER JOIN modules m ON l.module_id = m.id WHERE m.course_id = c.id) as total_lessons,
             (SELECT COUNT(up.lesson_id) FROM user_progress up 
              INNER JOIN lessons l ON up.lesson_id = l.id 
              INNER JOIN modules m ON l.module_id = m.id 
              WHERE m.course_id = c.id AND up.user_id = $1 AND (up.completed = 1 OR up.completed = TRUE)) as completed_lessons,
             (SELECT COUNT(id) FROM enrollments WHERE user_id = $1 AND course_id = c.id) as is_enrolled
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.status = 'published'
      ORDER BY c.order_num ASC, c.id ASC
    `;

    const result = await db.query(sql, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar cursos:', err);
    res.status(500).json({ error: 'Error al obtener la lista de cursos.' });
  }
});

// Obtener detalles del curso con módulos, lecciones y progreso agrupado
router.get('/:id', authenticateToken, async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Obtener detalles del curso
    const courseRes = await db.query(
      `SELECT c.*, u.name as instructor_name 
       FROM courses c 
       LEFT JOIN users u ON c.instructor_id = u.id 
       WHERE c.id = $1`,
      [courseId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    const course = courseRes.rows[0];

    // 2. Obtener inscripción del usuario
    const enrollRes = await db.query(
      'SELECT status, enrolled_at FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );
    const isEnrolled = enrollRes.rows.length > 0;
    const enrollmentStatus = isEnrolled ? enrollRes.rows[0].status : null;

    // 3. Obtener los módulos del curso
    const modulesRes = await db.query(
      `SELECT id, title, description, summary, order_num 
       FROM modules 
       WHERE course_id = $1 
       ORDER BY order_num ASC`,
      [courseId]
    );

    // 4. Obtener las lecciones del curso
    const lessonsRes = await db.query(
      `SELECT l.id, l.title, l.description, l.duration, l.order_num, l.module_id, l.content_type, l.video_provider,
              CASE WHEN up.completed IS NOT NULL THEN TRUE ELSE FALSE END as completed
       FROM lessons l
       INNER JOIN modules m ON l.module_id = m.id
       LEFT JOIN user_progress up ON l.id = up.lesson_id AND up.user_id = $1
       WHERE m.course_id = $2
       ORDER BY m.order_num ASC, l.order_num ASC`,
      [userId, courseId]
    );

    // 5. Obtener los quizzes de los módulos
    const quizzesRes = await db.query(
      `SELECT q.id, q.module_id, q.title, q.description, q.passing_score, q.time_limit_minutes,
              (SELECT MAX(score) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = $1) as max_score,
              (SELECT passed FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.user_id = $1 AND qa.passed = 1 LIMIT 1) as passed
       FROM quizzes q
       INNER JOIN modules m ON q.module_id = m.id
       WHERE m.course_id = $2`,
      [userId, courseId]
    );

    // 6. Agrupar lecciones y quizzes por módulo
    const modules = modulesRes.rows.map(mod => {
      const lessons = lessonsRes.rows.filter(l => l.module_id === mod.id);
      const quiz = quizzesRes.rows.find(q => q.module_id === mod.id) || null;
      
      // Calcular completación del módulo
      const totalItems = lessons.length + (quiz ? 1 : 0);
      const completedItems = lessons.filter(l => l.completed).length + (quiz && quiz.passed ? 1 : 0);
      const isCompleted = totalItems > 0 && totalItems === completedItems;

      return {
        ...mod,
        lessons,
        quiz,
        completed: isCompleted
      };
    });

    res.json({
      course,
      is_enrolled: isEnrolled,
      enrollment_status: enrollmentStatus,
      modules
    });
  } catch (err) {
    console.error('Error al obtener detalles del curso:', err);
    res.status(500).json({ error: 'Error al obtener los detalles del curso.' });
  }
});

// Inscribirse a un curso
router.post('/:id/enroll', authenticateToken, async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  try {
    // Verificar si el curso existe
    const courseRes = await db.query('SELECT status FROM courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    if (courseRes.rows[0].status !== 'published') {
      return res.status(403).json({ error: 'No te puedes inscribir a un curso en borrador.' });
    }

    // Inscribirse (evitando duplicados)
    let isAlreadyEnrolled = false;
    const checkEnroll = await db.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId]);
    
    if (checkEnroll.rows.length === 0) {
      if (db.isPostgres) {
        await db.query(
          'INSERT INTO enrollments (user_id, course_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, courseId, 'active']
        );
      } else {
        try {
          await db.query(
            'INSERT INTO enrollments (user_id, course_id, status) VALUES ($1, $2, $3)',
            [userId, courseId, 'active']
          );
        } catch (e) {
          // Ignorar error si ya existe
        }
      }
      
      // Incrementar contador de alumnos
      await db.query('UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [courseId]);
    } else {
      isAlreadyEnrolled = true;
    }

    res.json({ 
      message: isAlreadyEnrolled ? 'Ya estás inscrito en este curso.' : 'Inscripción realizada con éxito.',
      course_id: courseId 
    });
  } catch (err) {
    console.error('Error al inscribirse al curso:', err);
    res.status(500).json({ error: 'Error al procesar la inscripción al curso.' });
  }
});

// Obtener el resumen del módulo al completarlo
router.get('/:id/modules/:moduleId/summary', authenticateToken, async (req, res) => {
  const { moduleId } = req.params;

  try {
    const result = await db.query('SELECT title, summary FROM modules WHERE id = $1', [moduleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener el resumen del módulo:', err);
    res.status(500).json({ error: 'Error al obtener el resumen del módulo.' });
  }
});

module.exports = router;
