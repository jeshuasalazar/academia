const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken, requireInstructor } = require('../middleware/auth');
const { courseSchema, moduleSchema, lessonSchema, sessionSchema } = require('../middleware/validate');
const zoomService = require('../services/zoom');

// Aplicar verificación de rol de instructor a todas las rutas de este archivo
router.use([authenticateToken, requireInstructor]);

/* ==========================================
   📚 GESTIÓN DE CURSOS
   ========================================== */

// Listar todos los cursos (con cantidad de alumnos inscritos)
router.get('/courses', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.name as instructor_name,
              (SELECT COUNT(id) FROM enrollments WHERE course_id = c.id) as students_count
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       ORDER BY c.order_num ASC, c.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al listar cursos en panel de profesor:', err);
    res.status(500).json({ error: 'Error al obtener la lista de cursos.' });
  }
});

// Crear un nuevo curso (Borrador por defecto)
router.post('/courses', courseSchema, async (req, res) => {
  const { title, description, thumbnail, category } = req.body;
  const instructorId = req.user.id;

  try {
    // Calcular el siguiente order_num
    const orderRes = await db.query('SELECT COALESCE(MAX(order_num), 0) as max_order FROM courses');
    const nextOrder = Number(orderRes.rows[0]?.max_order || 0) + 1;

    const result = await db.query(
      `INSERT INTO courses (title, description, thumbnail, category, instructor_id, status, order_num) 
       VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING id`,
      [title, description, thumbnail, category, instructorId, nextOrder]
    );

    const courseId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Curso creado con éxito en modo borrador.',
      course_id: courseId
    });
  } catch (err) {
    console.error('Error al crear curso:', err);
    res.status(500).json({ error: 'Error al registrar el curso.' });
  }
});

// Editar un curso
router.put('/courses/:id', courseSchema, async (req, res) => {
  const courseId = req.params.id;
  const { title, description, thumbnail, category } = req.body;

  try {
    const result = await db.query(
      `UPDATE courses 
       SET title = $1, description = $2, thumbnail = $3, category = $4 
       WHERE id = $5`,
      [title, description, thumbnail, category, courseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    res.json({ message: 'Curso actualizado con éxito.' });
  } catch (err) {
    console.error('Error al editar curso:', err);
    res.status(500).json({ error: 'Error al actualizar el curso.' });
  }
});

// Publicar o despublicar curso
router.put('/courses/:id/publish', async (req, res) => {
  const courseId = req.params.id;
  const { publish } = req.body; // boolean

  try {
    const status = publish ? 'published' : 'draft';
    const result = await db.query(
      'UPDATE courses SET status = $1 WHERE id = $2',
      [status, courseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    res.json({ message: publish ? 'Curso publicado con éxito.' : 'Curso movido a borrador.' });
  } catch (err) {
    console.error('Error al publicar/despublicar curso:', err);
    res.status(500).json({ error: 'Error al cambiar el estado del curso.' });
  }
});

// Eliminar un curso
router.delete('/courses/:id', async (req, res) => {
  const courseId = req.params.id;

  try {
    const result = await db.query('DELETE FROM courses WHERE id = $1', [courseId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }
    res.json({ message: 'Curso eliminado permanentemente con éxito.' });
  } catch (err) {
    console.error('Error al eliminar curso:', err);
    res.status(500).json({ error: 'Error al eliminar el curso.' });
  }
});

/* ==========================================
   📦 GESTIÓN DE MÓDULOS
   ========================================== */

// Crear un módulo
router.post('/modules', moduleSchema, async (req, res) => {
  const { course_id, title, description, summary, order_num } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO modules (course_id, title, description, summary, order_num) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [course_id, title, description || null, summary || null, order_num]
    );

    const moduleId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Módulo creado con éxito.',
      module_id: moduleId
    });
  } catch (err) {
    console.error('Error al crear módulo:', err);
    res.status(500).json({ error: 'Error al registrar el módulo.' });
  }
});

// Editar un módulo
router.put('/modules/:id', async (req, res) => {
  const moduleId = req.params.id;
  const { title, description, summary, order_num } = req.body;

  try {
    const result = await db.query(
      `UPDATE modules 
       SET title = $1, description = $2, summary = $3, order_num = $4 
       WHERE id = $5`,
      [title, description || null, summary || null, order_num, moduleId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }

    res.json({ message: 'Módulo actualizado con éxito.' });
  } catch (err) {
    console.error('Error al editar módulo:', err);
    res.status(500).json({ error: 'Error al actualizar el módulo.' });
  }
});

// Eliminar un módulo
router.delete('/modules/:id', async (req, res) => {
  const moduleId = req.params.id;

  try {
    const result = await db.query('DELETE FROM modules WHERE id = $1', [moduleId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Módulo no encontrado.' });
    }
    res.json({ message: 'Módulo eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar módulo:', err);
    res.status(500).json({ error: 'Error al eliminar el módulo.' });
  }
});

// Reordenar módulos
router.put('/modules/reorder', async (req, res) => {
  const { order } = req.body; // order = [{ id: 1, order_num: 1 }, ...]

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ error: 'Formato de ordenamiento inválido.' });
  }

  try {
    for (const item of order) {
      await db.query('UPDATE modules SET order_num = $1 WHERE id = $2', [item.order_num, item.id]);
    }
    res.json({ message: 'Módulos reordenados con éxito.' });
  } catch (err) {
    console.error('Error al reordenar módulos:', err);
    res.status(500).json({ error: 'Error al guardar el nuevo orden de módulos.' });
  }
});

/* ==========================================
   📖 GESTIÓN DE LECCIONES
   ========================================== */

// Crear una lección
router.post('/lessons', lessonSchema, async (req, res) => {
  const { module_id, title, description, video_url, duration, order_num, content_type, video_provider } = req.body;

  try {
    // Obtener el course_id del módulo
    const moduleRes = await db.query('SELECT course_id FROM modules WHERE id = $1', [module_id]);
    if (moduleRes.rows.length === 0) {
      return res.status(400).json({ error: 'El módulo especificado no existe.' });
    }
    const courseId = moduleRes.rows[0].course_id;

    const result = await db.query(
      `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [courseId, module_id, title, description || null, video_url || null, duration || null, order_num, content_type || 'video', video_provider || 'youtube']
    );

    const lessonId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Lección creada con éxito.',
      lesson_id: lessonId
    });
  } catch (err) {
    console.error('Error al crear lección:', err);
    res.status(500).json({ error: 'Error al registrar la lección.' });
  }
});

// Editar una lección
router.put('/lessons/:id', async (req, res) => {
  const lessonId = req.params.id;
  const { title, description, video_url, duration, order_num, content_type, video_provider } = req.body;

  try {
    const result = await db.query(
      `UPDATE lessons 
       SET title = $1, description = $2, video_url = $3, duration = $4, order_num = $5, content_type = $6, video_provider = $7
       WHERE id = $8`,
      [title, description || null, video_url || null, duration || null, order_num, content_type || 'video', video_provider || 'youtube', lessonId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }

    res.json({ message: 'Lección actualizada con éxito.' });
  } catch (err) {
    console.error('Error al editar lección:', err);
    res.status(500).json({ error: 'Error al actualizar la lección.' });
  }
});

// Eliminar una lección
router.delete('/lessons/:id', async (req, res) => {
  const lessonId = req.params.id;

  try {
    const result = await db.query('DELETE FROM lessons WHERE id = $1', [lessonId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lección no encontrada.' });
    }
    res.json({ message: 'Lección eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar lección:', err);
    res.status(500).json({ error: 'Error al eliminar la lección.' });
  }
});

// Reordenar lecciones
router.put('/lessons/reorder', async (req, res) => {
  const { order } = req.body; // order = [{ id: 1, order_num: 1 }, ...]

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ error: 'Formato de ordenamiento inválido.' });
  }

  try {
    for (const item of order) {
      await db.query('UPDATE lessons SET order_num = $1 WHERE id = $2', [item.order_num, item.id]);
    }
    res.json({ message: 'Lecciones reordenadas con éxito.' });
  } catch (err) {
    console.error('Error al reordenar lecciones:', err);
    res.status(500).json({ error: 'Error al guardar el nuevo orden de lecciones.' });
  }
});

/* ==========================================
   📎 GESTIÓN DE MATERIALES DE LECCIÓN
   ========================================== */

// Agregar material a una lección
router.post('/materials', async (req, res) => {
  const { lesson_id, title, file_url, file_type, file_size_bytes } = req.body;

  if (!lesson_id || !title || !file_url) {
    return res.status(400).json({ error: 'ID de lección, título y URL del archivo obligatorios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO lesson_materials (lesson_id, title, file_url, file_type, file_size_bytes) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [lesson_id, title, file_url, file_type || 'pdf', file_size_bytes || null]
    );

    const materialId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Material adjuntado con éxito.',
      material_id: materialId
    });
  } catch (err) {
    console.error('Error al agregar material:', err);
    res.status(500).json({ error: 'Error al registrar el material.' });
  }
});

// Eliminar material
router.delete('/materials/:id', async (req, res) => {
  const materialId = req.params.id;

  try {
    const result = await db.query('DELETE FROM lesson_materials WHERE id = $1', [materialId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Material no encontrado.' });
    }
    res.json({ message: 'Material eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar material:', err);
    res.status(500).json({ error: 'Error al eliminar el material.' });
  }
});

/* ==========================================
   📝 GESTIÓN DE QUIZZES
   ========================================== */

// Crear un quiz
router.post('/quizzes', async (req, res) => {
  const { module_id, title, description, passing_score, time_limit_minutes, max_attempts, randomize_questions } = req.body;

  if (!module_id || !title) {
    return res.status(400).json({ error: 'ID de módulo y título obligatorios.' });
  }

  try {
    const isRand = randomize_questions ? (db.isPostgres ? true : 1) : (db.isPostgres ? false : 0);
    const result = await db.query(
      `INSERT INTO quizzes (module_id, title, description, passing_score, time_limit_minutes, max_attempts, randomize_questions) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [module_id, title, description || null, passing_score || 70, time_limit_minutes || null, max_attempts || 3, isRand]
    );

    const quizId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Quiz creado con éxito.',
      quiz_id: quizId
    });
  } catch (err) {
    console.error('Error al crear quiz:', err);
    res.status(500).json({ error: 'Error al registrar el quiz.' });
  }
});

// Editar un quiz
router.put('/quizzes/:id', async (req, res) => {
  const quizId = req.params.id;
  const { title, description, passing_score, time_limit_minutes, max_attempts, randomize_questions } = req.body;

  try {
    const isRand = randomize_questions ? (db.isPostgres ? true : 1) : (db.isPostgres ? false : 0);
    const result = await db.query(
      `UPDATE quizzes 
       SET title = $1, description = $2, passing_score = $3, time_limit_minutes = $4, max_attempts = $5, randomize_questions = $6 
       WHERE id = $7`,
      [title, description || null, passing_score || 70, time_limit_minutes || null, max_attempts || 3, isRand, quizId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }

    res.json({ message: 'Quiz actualizado con éxito.' });
  } catch (err) {
    console.error('Error al editar quiz:', err);
    res.status(500).json({ error: 'Error al actualizar el quiz.' });
  }
});

// Eliminar un quiz
router.delete('/quizzes/:id', async (req, res) => {
  const quizId = req.params.id;

  try {
    const result = await db.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    res.json({ message: 'Quiz eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar quiz:', err);
    res.status(500).json({ error: 'Error al eliminar el quiz.' });
  }
});

// Agregar pregunta a un quiz
router.post('/quizzes/:id/questions', async (req, res) => {
  const quizId = req.params.id;
  const { question_text, question_type, options, correct_answer, explanation, points, order_num } = req.body;

  if (!question_text || !question_type || !correct_answer) {
    return res.status(400).json({ error: 'Texto, tipo de pregunta y respuesta correcta obligatorios.' });
  }

  try {
    const optionsStr = options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null;
    const result = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, order_num) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [quizId, question_text, question_type, optionsStr, correct_answer, explanation || null, points || 10, order_num || 1]
    );

    const questionId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Pregunta agregada con éxito.',
      question_id: questionId
    });
  } catch (err) {
    console.error('Error al agregar pregunta:', err);
    res.status(500).json({ error: 'Error al registrar la pregunta.' });
  }
});

// Editar pregunta
router.put('/questions/:id', async (req, res) => {
  const questionId = req.params.id;
  const { question_text, question_type, options, correct_answer, explanation, points, order_num } = req.body;

  try {
    const optionsStr = options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null;
    const result = await db.query(
      `UPDATE quiz_questions 
       SET question_text = $1, question_type = $2, options = $3, correct_answer = $4, explanation = $5, points = $6, order_num = $7 
       WHERE id = $8`,
      [question_text, question_type, optionsStr, correct_answer, explanation || null, points || 10, order_num || 1, questionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }

    res.json({ message: 'Pregunta actualizada con éxito.' });
  } catch (err) {
    console.error('Error al editar pregunta:', err);
    res.status(500).json({ error: 'Error al actualizar la pregunta.' });
  }
});

// Eliminar pregunta
router.delete('/questions/:id', async (req, res) => {
  const questionId = req.params.id;

  try {
    const result = await db.query('DELETE FROM quiz_questions WHERE id = $1', [questionId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pregunta no encontrada.' });
    }
    res.json({ message: 'Pregunta eliminada con éxito.' });
  } catch (err) {
    console.error('Error al eliminar pregunta:', err);
    res.status(500).json({ error: 'Error al eliminar la pregunta.' });
  }
});

/* ==========================================
   📅 GESTIÓN DE SESIONES EN VIVO Y ZOOM
   ========================================== */

// Helper para parsear la duración a minutos
function parseDurationToMinutes(durationStr) {
  if (!durationStr) return 60;
  const num = parseFloat(durationStr);
  if (isNaN(num)) return 60;
  
  const lowerStr = durationStr.toLowerCase();
  if (lowerStr.includes('hora') || lowerStr.includes('hour')) {
    return Math.round(num * 60);
  }
  return Math.round(num); // Asume minutos por defecto
}

// Programar sesión en vivo (con Zoom S2S OAuth)
router.post('/sessions', sessionSchema, async (req, res) => {
  const { title, description, date_time, duration, meeting_link, max_participants, session_type } = req.body;
  const instructorId = req.user.id;

  try {
    // 1. Crear la reunión en Zoom
    const durationMinutes = parseDurationToMinutes(duration);
    
    // Convertir date_time local a ISO 8601 que Zoom acepte (e.g. YYYY-MM-DDTHH:MM:SS)
    const formattedDate = new Date(date_time).toISOString().replace('.000Z', '');
    
    console.log(`[Zoom] Programando reunión para: "${title}" a las ${formattedDate} (${durationMinutes} mins)`);
    const zoomMeeting = await zoomService.createMeeting(title, formattedDate, durationMinutes);

    // 2. Guardar en base de datos
    const zoomMeetingId = zoomMeeting ? zoomMeeting.id : null;
    const zoomJoinUrl = zoomMeeting ? zoomMeeting.join_url : null;
    const zoomStartUrl = zoomMeeting ? zoomMeeting.start_url : null;

    const result = await db.query(
      `INSERT INTO live_sessions (title, description, date_time, duration, meeting_link, instructor_id, max_participants, session_type, status, zoom_meeting_id, zoom_join_url, zoom_start_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11) RETURNING id`,
      [
        title, 
        description || null, 
        date_time, 
        duration, 
        meeting_link || null, // manual link fallback
        instructorId, 
        max_participants || 100, 
        session_type || 'live_class',
        zoomMeetingId,
        zoomJoinUrl,
        zoomStartUrl
      ]
    );

    const sessionId = result.rows && result.rows.length ? result.rows[0].id : null;

    res.status(201).json({
      message: 'Sesión en vivo programada con éxito.',
      session_id: sessionId,
      zoom_created: !!zoomMeeting
    });
  } catch (err) {
    console.error('Error al programar sesión:', err);
    res.status(500).json({ error: 'Error al registrar la sesión.' });
  }
});

// Editar sesión en vivo
router.put('/sessions/:id', sessionSchema, async (req, res) => {
  const sessionId = req.params.id;
  const { title, description, date_time, duration, meeting_link, max_participants, session_type, status } = req.body;

  try {
    // Obtener datos anteriores
    const oldSession = await db.query('SELECT zoom_meeting_id FROM live_sessions WHERE id = $1', [sessionId]);
    if (oldSession.rows.length === 0) {
      return res.status(404).json({ error: 'Sesión en vivo no encontrada.' });
    }
    const zoomMeetingId = oldSession.rows[0].zoom_meeting_id;

    // 1. Actualizar en Zoom si existe
    if (zoomMeetingId) {
      const durationMinutes = parseDurationToMinutes(duration);
      const formattedDate = new Date(date_time).toISOString().replace('.000Z', '');
      await zoomService.updateMeeting(zoomMeetingId, title, formattedDate, durationMinutes);
    }

    // 2. Actualizar en DB
    await db.query(
      `UPDATE live_sessions 
       SET title = $1, description = $2, date_time = $3, duration = $4, meeting_link = $5, max_participants = $6, session_type = $7, status = $8
       WHERE id = $9`,
      [
        title, 
        description || null, 
        date_time, 
        duration, 
        meeting_link || null, 
        max_participants || 100, 
        session_type || 'live_class',
        status || 'scheduled',
        sessionId
      ]
    );

    res.json({ message: 'Sesión actualizada con éxito.' });
  } catch (err) {
    console.error('Error al editar sesión:', err);
    res.status(500).json({ error: 'Error al actualizar la sesión.' });
  }
});

// Cancelar sesión en vivo
router.delete('/sessions/:id', async (req, res) => {
  const sessionId = req.params.id;

  try {
    // Obtener datos para Zoom
    const sessionRes = await db.query('SELECT zoom_meeting_id FROM live_sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sesión en vivo no encontrada.' });
    }
    const zoomMeetingId = sessionRes.rows[0].zoom_meeting_id;

    // 1. Eliminar reunión en Zoom si existe
    if (zoomMeetingId) {
      await zoomService.deleteMeeting(zoomMeetingId);
    }

    // 2. Cambiar estado a 'cancelled' en DB (no la borramos para conservar el histórico y registros de bookings)
    await db.query(
      "UPDATE live_sessions SET status = 'cancelled' WHERE id = $1",
      [sessionId]
    );

    res.json({ message: 'Sesión cancelada con éxito.' });
  } catch (err) {
    console.error('Error al cancelar sesión:', err);
    res.status(500).json({ error: 'Error al cancelar la sesión.' });
  }
});

/* ==========================================
   📈 ANALYTICS DEL INSTRUCTOR
   ========================================== */

// Resumen analítico global
router.get('/analytics/overview', async (req, res) => {
  try {
    // Total alumnos inscritos (estudiantes únicos)
    const studentsRes = await db.query("SELECT COUNT(id) as count FROM users WHERE role = 'student'");
    
    // Calificación promedio de quizzes en la plataforma
    const quizAvgRes = await db.query('SELECT AVG(score) as avg_score FROM quiz_attempts');
    
    // Promedio de progreso de alumnos en cursos
    const progressRes = await db.query(
      `SELECT 
        (SELECT COUNT(id) FROM lessons) as total_lessons,
        (SELECT COUNT(*) FROM user_progress WHERE completed = 1 OR completed = TRUE) as total_completed`
    );
    
    const totalLessons = Number(progressRes.rows[0]?.total_lessons || 0);
    const totalCompleted = Number(progressRes.rows[0]?.total_completed || 0);
    const platformStudents = Number(studentsRes.rows[0]?.count || 0);
    
    const completionRate = (totalLessons > 0 && platformStudents > 0) 
      ? Math.round((totalCompleted / (totalLessons * platformStudents)) * 100) 
      : 0;

    res.json({
      total_students: platformStudents,
      avg_quiz_score: Math.round(Number(quizAvgRes.rows[0]?.avg_score || 0)),
      avg_completion_rate: Math.min(completionRate, 100) // Asegurar tope de 100%
    });
  } catch (err) {
    console.error('Error al obtener analytics generales:', err);
    res.status(500).json({ error: 'Error al obtener las analíticas generales.' });
  }
});

// Analytics detalladas por curso
router.get('/analytics/courses/:id', async (req, res) => {
  const courseId = req.params.id;

  try {
    // Alumnos inscritos en el curso
    const enrollRes = await db.query('SELECT COUNT(id) as count FROM enrollments WHERE course_id = $1', [courseId]);
    const enrolled = Number(enrollRes.rows[0]?.count || 0);

    // Alumnos que completaron el curso
    const completeRes = await db.query(
      "SELECT COUNT(id) as count FROM enrollments WHERE course_id = $1 AND status = 'completed'",
      [courseId]
    );
    const completed = Number(completeRes.rows[0]?.count || 0);

    // Total lecciones en el curso
    const lessonsRes = await db.query(
      'SELECT COUNT(l.id) as count FROM lessons l INNER JOIN modules m ON l.module_id = m.id WHERE m.course_id = $1',
      [courseId]
    );
    const totalLessons = Number(lessonsRes.rows[0]?.count || 0);

    // Progreso lección por lección (para graficar engagement)
    const lessonEngagement = await db.query(
      `SELECT l.id, l.title, l.order_num,
              (SELECT COUNT(up.user_id) FROM user_progress up WHERE up.lesson_id = l.id) as completed_by_count
       FROM lessons l
       INNER JOIN modules m ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY m.order_num ASC, l.order_num ASC`,
      [courseId]
    );

    res.json({
      course_id: courseId,
      enrollment_count: enrolled,
      completion_count: completed,
      completion_rate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      total_lessons: totalLessons,
      lesson_engagement: lessonEngagement.rows
    });
  } catch (err) {
    console.error(`Error al obtener analytics para curso ${courseId}:`, err);
    res.status(500).json({ error: 'Error al obtener las analíticas del curso.' });
  }
});

module.exports = router;
