const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

const formatDbDate = (val) => {
  if (!val) return null;
  const d = isNaN(val) ? new Date(val) : new Date(Number(val));
  return d.toISOString();
};

// 1. Listar sesiones programadas (futuras) con estado de reserva
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const dateFilter = db.isPostgres 
      ? "ls.date_time >= CURRENT_TIMESTAMP" 
      : "datetime(ls.date_time) >= datetime('now')";

    const sql = `
      SELECT ls.id, ls.title, ls.description, ls.date_time, ls.duration, ls.max_participants, ls.session_type, ls.status, ls.recording_url,
             u.name as instructor_name,
             (SELECT COUNT(id) FROM session_bookings WHERE session_id = ls.id) as participants_count,
             CASE WHEN sb.id IS NOT NULL THEN TRUE ELSE FALSE END as is_booked
      FROM live_sessions ls
      LEFT JOIN users u ON ls.instructor_id = u.id
      LEFT JOIN session_bookings sb ON ls.id = sb.session_id AND sb.user_id = $1
      WHERE ${dateFilter} AND ls.status != 'cancelled'
      ORDER BY ls.date_time ASC
    `;

    const result = await db.query(sql, [userId]);
    const sessions = result.rows.map(r => ({
      ...r,
      date_time: formatDbDate(r.date_time),
      is_booked: r.is_booked === 1 || r.is_booked === true
    }));
    res.json(sessions);
  } catch (err) {
    console.error('Error al listar sesiones:', err);
    res.status(500).json({ error: 'Error al obtener las sesiones en vivo.' });
  }
});

// 2. Obtener sesiones completas (históricas y futuras) para el calendario
router.get('/calendar', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const sql = `
      SELECT ls.id, ls.title, ls.description, ls.date_time, ls.duration, ls.session_type, ls.status,
             CASE WHEN sb.id IS NOT NULL THEN TRUE ELSE FALSE END as is_booked
      FROM live_sessions ls
      LEFT JOIN session_bookings sb ON ls.id = sb.session_id AND sb.user_id = $1
      WHERE ls.status != 'cancelled'
      ORDER BY ls.date_time ASC
    `;

    const result = await db.query(sql, [userId]);
    const sessions = result.rows.map(r => ({
      ...r,
      date_time: formatDbDate(r.date_time),
      is_booked: r.is_booked === 1 || r.is_booked === true
    }));
    res.json(sessions);
  } catch (err) {
    console.error('Error al obtener calendario:', err);
    res.status(500).json({ error: 'Error al obtener el calendario de sesiones.' });
  }
});

// 3. Reservar lugar en una sesión en vivo (Gated by subscription)
router.post('/:id/book', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;

  try {
    // A. Obtener sesión
    const sessionRes = await db.query(
      `SELECT ls.id, ls.title, ls.max_participants, ls.status, ls.date_time,
              (SELECT COUNT(id) FROM session_bookings WHERE session_id = ls.id) as current_bookings
       FROM live_sessions ls 
       WHERE ls.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sesión en vivo no encontrada.' });
    }

    const session = sessionRes.rows[0];

    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'No se puede reservar en esta sesión porque no está programada.' });
    }

    const sessionDate = isNaN(session.date_time) ? new Date(session.date_time) : new Date(Number(session.date_time));
    if (sessionDate < new Date()) {
      return res.status(400).json({ error: 'No se puede reservar en una sesión que ya pasó.' });
    }

    if (session.current_bookings >= session.max_participants) {
      return res.status(400).json({ error: 'La sesión está llena. No hay cupos disponibles.' });
    }

    // B. Insertar reserva
    let isAlreadyBooked = false;
    const checkBooking = await db.query(
      'SELECT id FROM session_bookings WHERE user_id = $1 AND session_id = $2',
      [userId, sessionId]
    );

    if (checkBooking.rows.length === 0) {
      if (db.isPostgres) {
        await db.query(
          'INSERT INTO session_bookings (user_id, session_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, sessionId]
        );
      } else {
        try {
          await db.query(
            'INSERT INTO session_bookings (user_id, session_id) VALUES ($1, $2)',
            [userId, sessionId]
          );
        } catch (e) {}
      }

      // Notificación in-app del booking exitoso
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message) 
         VALUES ($1, 'session_reminder', $2, $3)`,
        [
          userId, 
          'Reserva confirmada', 
          `Reservaste tu lugar en la sesión: "${session.title}". Te esperamos.`
        ]
      );
    } else {
      isAlreadyBooked = true;
    }

    res.json({
      message: isAlreadyBooked ? 'Ya tenías una reserva para esta sesión.' : 'Lugar reservado con éxito.',
      session_id: sessionId
    });
  } catch (err) {
    console.error('Error al reservar sesión:', err);
    res.status(500).json({ error: 'Error al reservar tu lugar en la sesión.' });
  }
});

// 4. Cancelar reservación de lugar (Gated by subscription)
router.delete('/:id/book', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;

  try {
    const result = await db.query(
      'DELETE FROM session_bookings WHERE user_id = $1 AND session_id = $2',
      [userId, sessionId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'No tenías una reservación para esta sesión.' });
    }

    res.json({ message: 'Reservación cancelada con éxito.' });
  } catch (err) {
    console.error('Error al cancelar reservación:', err);
    res.status(500).json({ error: 'Error al cancelar la reservación.' });
  }
});

// 5. Detalle de sesión con URL de Zoom (Gated by subscription y restringido a booked/instructores)
router.get('/:id', [authenticateToken, requireActiveSubscription], async (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;

  try {
    const sessionRes = await db.query(
      `SELECT ls.*, u.name as instructor_name,
              (SELECT COUNT(id) FROM session_bookings WHERE session_id = ls.id) as participants_count
       FROM live_sessions ls 
       LEFT JOIN users u ON ls.instructor_id = u.id
       WHERE ls.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sesión no encontrada.' });
    }

    const session = sessionRes.rows[0];

    // Verificar si el usuario tiene reserva o es instructor/administrador
    const isInstructor = req.user.role === 'admin' || req.user.role === 'instructor';
    let isBooked = false;

    if (!isInstructor) {
      const checkBooking = await db.query(
        'SELECT id FROM session_bookings WHERE user_id = $1 AND session_id = $2',
        [userId, sessionId]
      );
      isBooked = checkBooking.rows.length > 0;
    }

    const responseData = { ...session, date_time: formatDbDate(session.date_time) };
    
    // Si no es instructor ni está reservado, censurar enlaces de Zoom
    if (!isInstructor && !isBooked) {
      delete responseData.zoom_join_url;
      delete responseData.zoom_start_url;
      delete responseData.meeting_link; // Quitar también el link antiguo de Meet si existe
      responseData.is_booked = false;
    } else {
      responseData.is_booked = true;
      // Los alumnos no deben ver el link de inicio del anfitrión (zoom_start_url)
      if (!isInstructor) {
        delete responseData.zoom_start_url;
      }
    }

    res.json(responseData);
  } catch (err) {
    console.error('Error al obtener sesión por ID:', err);
    res.status(500).json({ error: 'Error al obtener los detalles de la sesión.' });
  }
});

module.exports = router;
