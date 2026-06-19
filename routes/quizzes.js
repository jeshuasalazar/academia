const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

// 1. Obtener un quiz con sus preguntas (sin las respuestas correctas para evitar trampas)
router.get('/:id', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const quizId = req.params.id;

  try {
    // Obtener quiz
    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }

    const quiz = quizRes.rows[0];

    // Obtener preguntas
    const questionsRes = await db.query(
      `SELECT id, question_text, question_type, options, points, order_num 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY order_num ASC`,
      [quizId]
    );

    // Parsear las opciones JSON de cada pregunta
    const questions = questionsRes.rows.map(q => {
      let parsedOptions = [];
      if (q.options) {
        try {
          parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        } catch (e) {
          parsedOptions = [];
        }
      }
      return {
        ...q,
        options: parsedOptions
      };
    });

    res.json({
      quiz,
      questions
    });
  } catch (err) {
    console.error('Error al obtener quiz:', err);
    res.status(500).json({ error: 'Error al obtener los detalles del quiz.' });
  }
});

// 2. Calificar un intento de quiz
router.post('/:id/submit', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const quizId = req.params.id;
  const userId = req.user.id;
  const { answers, timeSpentSeconds } = req.body; // answers = [{ questionId, answer }]

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Las respuestas deben ser un arreglo.' });
  }

  try {
    // A. Obtener el quiz y su score mínimo
    const quizRes = await db.query(
      `SELECT q.*, m.course_id 
       FROM quizzes q 
       INNER JOIN modules m ON q.module_id = m.id 
       WHERE q.id = $1`, 
      [quizId]
    );
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    const quiz = quizRes.rows[0];

    // B. Obtener todas las preguntas con sus respuestas correctas
    const questionsRes = await db.query(
      'SELECT id, question_text, question_type, correct_answer, explanation, points, options FROM quiz_questions WHERE quiz_id = $1',
      [quizId]
    );
    const questions = questionsRes.rows;

    let totalPoints = 0;
    let earnedPoints = 0;
    const feedback = [];

    // C. Calificar respuesta por respuesta
    for (const q of questions) {
      totalPoints += q.points;
      const studentAns = answers.find(a => Number(a.questionId) === q.id);
      const studentVal = studentAns ? String(studentAns.answer).trim().toLowerCase() : '';
      const correctVal = String(q.correct_answer).trim().toLowerCase();

      const isCorrect = studentVal === correctVal;
      if (isCorrect) {
        earnedPoints += q.points;
      }

      let parsedOptions = [];
      if (q.options) {
        try {
          parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        } catch (e) {}
      }

      feedback.push({
        questionId: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parsedOptions,
        student_answer: studentAns ? studentAns.answer : null,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        is_correct: isCorrect,
        points: q.points
      });
    }

    // D. Calcular porcentaje
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= quiz.passing_score;

    // E. Guardar el intento en DB
    const isPassedVal = db.isPostgres ? passed : (passed ? 1 : 0);
    const answersJson = JSON.stringify(answers);

    const attemptInsert = await db.query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, answers, time_spent_seconds, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`,
      [userId, quizId, score, isPassedVal, answersJson, timeSpentSeconds || null]
    );

    const attemptId = attemptInsert.rows && attemptInsert.rows.length ? attemptInsert.rows[0].id : null;

    let xpAdded = 0;
    let newLevel = 0;
    let isFirstTimePassing = false;

    // F. Otorga XP solo la primera vez que se aprueba este quiz
    if (passed) {
      const checkFirstPass = await db.query(
        'SELECT id FROM quiz_attempts WHERE user_id = $1 AND quiz_id = $2 AND passed = $3 AND id != $4',
        [userId, quizId, db.isPostgres ? true : 1, attemptId]
      );

      if (checkFirstPass.rows.length === 0) {
        isFirstTimePassing = true;
        xpAdded = 100; // 100 XP por aprobar el quiz por primera vez

        // Actualizar XP en el usuario
        const userRes = await db.query('SELECT xp, level FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        const currentXp = user.xp + xpAdded;
        newLevel = Math.floor(currentXp / 100) + 1;

        await db.query(
          'UPDATE users SET xp = $1, level = $2 WHERE id = $3',
          [currentXp, newLevel, userId]
        );

        // Desencadenar eventos de gamificación y certificados
        try {
          const achievementsEngine = require('../services/achievements');
          await achievementsEngine.checkAndAward(userId, 'quizzes_passed');
          await achievementsEngine.checkAndAward(userId, 'xp_reached');

          const certService = require('../services/certificates');
          await certService.checkAndIssueCertificate(userId, quiz.course_id);
        } catch (achError) {
          console.error('Error al procesar logros o certificados en quiz submit:', achError);
        }
      }
    }

    res.json({
      attempt_id: attemptId,
      score,
      passed,
      passing_score: quiz.passing_score,
      earned_points: earnedPoints,
      total_points: totalPoints,
      xp_added: xpAdded,
      feedback,
      is_first_pass: isFirstTimePassing
    });
  } catch (err) {
    console.error('Error al calificar quiz:', err);
    res.status(500).json({ error: 'Error al calificar tu intento del quiz.' });
  }
});

// 3. Obtener el historial de intentos del estudiante para un quiz
router.get('/:id/attempts', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const quizId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT id, score, passed, time_spent_seconds, started_at, completed_at 
       FROM quiz_attempts 
       WHERE user_id = $1 AND quiz_id = $2 
       ORDER BY completed_at DESC`,
      [userId, quizId]
    );

    // Convertir booleanos/enteros correctamente para SQLite
    const attempts = result.rows.map(att => ({
      ...att,
      passed: att.passed === 1 || att.passed === true
    }));

    res.json(attempts);
  } catch (err) {
    console.error('Error al obtener intentos de quiz:', err);
    res.status(500).json({ error: 'Error al obtener tu historial de intentos.' });
  }
});

// 4. Obtener revisión de un intento específico de quiz (con respuestas correctas y feedback)
router.get('/:id/review/:attemptId', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const { id: quizId, attemptId } = req.params;
  const userId = req.user.id;

  try {
    // Obtener el intento
    const attemptRes = await db.query(
      'SELECT * FROM quiz_attempts WHERE id = $1 AND user_id = $2 AND quiz_id = $3',
      [attemptId, userId, quizId]
    );

    if (attemptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Intento de quiz no encontrado o acceso denegado.' });
    }

    const attempt = attemptRes.rows[0];
    const studentAnswers = attempt.answers ? JSON.parse(attempt.answers) : [];

    // Obtener todas las preguntas del quiz
    const questionsRes = await db.query(
      `SELECT id, question_text, question_type, options, correct_answer, explanation, points, order_num 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY order_num ASC`,
      [quizId]
    );

    // Mapear respuestas con preguntas
    const review = questionsRes.rows.map(q => {
      const ans = studentAnswers.find(a => Number(a.questionId) === q.id);
      const studentVal = ans ? String(ans.answer).trim().toLowerCase() : '';
      const correctVal = String(q.correct_answer).trim().toLowerCase();
      const isCorrect = studentVal === correctVal;

      let parsedOptions = [];
      if (q.options) {
        try {
          parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        } catch (e) {}
      }

      return {
        questionId: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: parsedOptions,
        student_answer: ans ? ans.answer : null,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        is_correct: isCorrect,
        points: q.points,
        order_num: q.order_num
      };
    });

    res.json({
      attempt: {
        id: attempt.id,
        score: attempt.score,
        passed: attempt.passed === 1 || attempt.passed === true,
        time_spent_seconds: attempt.time_spent_seconds,
        completed_at: attempt.completed_at
      },
      review
    });
  } catch (err) {
    console.error('Error al revisar intento de quiz:', err);
    res.status(500).json({ error: 'Error al cargar la revisión de tu intento.' });
  }
});

module.exports = router;
