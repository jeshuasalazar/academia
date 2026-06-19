const db = require('../db/index');
const crypto = require('crypto');

/**
 * Verifica si el usuario cumple los requisitos para graduarse de un curso.
 * Si califica y aún no tiene certificado, se le emite uno.
 */
async function checkAndIssueCertificate(userId, courseId) {
  try {
    // 1. Obtener cantidad de lecciones totales en el curso
    const totalLessonsRes = await db.query(
      `SELECT COUNT(l.id) as count 
       FROM lessons l 
       INNER JOIN modules m ON l.module_id = m.id 
       WHERE m.course_id = $1`,
      [courseId]
    );
    const totalLessons = Number(totalLessonsRes.rows[0]?.count || 0);

    // Si el curso no tiene lecciones, no se emite certificado
    if (totalLessons === 0) return false;

    // 2. Obtener cantidad de lecciones completadas por el usuario en este curso
    const completedLessonsRes = await db.query(
      `SELECT COUNT(up.lesson_id) as count 
       FROM user_progress up 
       INNER JOIN lessons l ON up.lesson_id = l.id 
       INNER JOIN modules m ON l.module_id = m.id 
       WHERE m.course_id = $1 AND up.user_id = $2 AND (up.completed = 1 OR up.completed = TRUE)`,
      [courseId, userId]
    );
    const completedLessons = Number(completedLessonsRes.rows[0]?.count || 0);

    // Si faltan lecciones por completar
    if (completedLessons < totalLessons) return false;

    // 3. Obtener cantidad de quizzes totales en el curso
    const totalQuizzesRes = await db.query(
      `SELECT COUNT(q.id) as count 
       FROM quizzes q 
       INNER JOIN modules m ON q.module_id = m.id 
       WHERE m.course_id = $1`,
      [courseId]
    );
    const totalQuizzes = Number(totalQuizzesRes.rows[0]?.count || 0);

    // 4. Obtener cantidad de quizzes aprobados por el usuario en este curso
    const passedQuizzesRes = await db.query(
      `SELECT COUNT(DISTINCT qa.quiz_id) as count 
       FROM quiz_attempts qa 
       INNER JOIN quizzes q ON qa.quiz_id = q.id
       INNER JOIN modules m ON q.module_id = m.id
       WHERE m.course_id = $1 AND qa.user_id = $2 AND (qa.passed = 1 OR qa.passed = TRUE)`,
      [courseId, userId]
    );
    const passedQuizzes = Number(passedQuizzesRes.rows[0]?.count || 0);

    // Si el curso tiene quizzes pero no los ha aprobado todos
    if (passedQuizzes < totalQuizzes) return false;

    // 5. Verificar si ya existe el certificado
    const checkCert = await db.query(
      'SELECT id, certificate_code FROM certificates WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    if (checkCert.rows.length > 0) {
      return false; // Ya emitido
    }

    // 6. Generar código único de certificado (AL-XXXX-XXXX)
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const certificateCode = `AL-${courseId}-${userId}-${randomHex}`;

    // 7. Guardar en DB
    if (db.isPostgres) {
      await db.query(
        'INSERT INTO certificates (user_id, course_id, certificate_code) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, courseId, certificateCode]
      );
    } else {
      try {
        await db.query(
          'INSERT INTO certificates (user_id, course_id, certificate_code) VALUES ($1, $2, $3)',
          [userId, courseId, certificateCode]
        );
      } catch (e) {}
    }

    // Mark enrollment as completed
    await db.query(
      "UPDATE enrollments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND course_id = $2",
      [userId, courseId]
    );

    // 8. Crear notificación in-app
    const courseInfo = await db.query('SELECT title FROM courses WHERE id = $1', [courseId]);
    const courseTitle = courseInfo.rows[0]?.title || 'Curso';

    await db.query(
      `INSERT INTO notifications (user_id, type, title, message) 
       VALUES ($1, 'achievement', $2, $3)`,
      [
        userId,
        '🎓 ¡Graduación de curso!',
        `Completaste exitosamente "${courseTitle}". Tu certificado verificado ha sido emitido.`
      ]
    );

    // 9. Comprobar logros de cursos completados
    try {
      const achievementsEngine = require('./achievements');
      await achievementsEngine.checkAndAward(userId, 'courses_completed');
    } catch (err) {
      console.error('Error al verificar logros en emisión de certificado:', err);
    }

    console.log(`🎓 Certificado emitido para usuario ${userId} del curso ${courseId}. Código: ${certificateCode}`);
    return true;
  } catch (err) {
    console.error('Error al verificar/emitir certificado:', err);
    return false;
  }
}

module.exports = {
  checkAndIssueCertificate
};
