const cron = require('node-cron');
const db = require('../db/index');
const emailService = require('./email');

/**
 * Inicializar todos los jobs programados en segundo plano
 */
function initScheduler() {
  console.log('⏰ Inicializando planificador de tareas en segundo plano (Scheduler)...');
  
  // Correr cada 5 minutos para revisar notificaciones de sesiones y repaso
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Ejecutando tareas programadas en segundo plano...');
    try {
      await processSessionReminders();
      await processSpacedRepetitionReminders();
    } catch (err) {
      console.error('❌ Error en el procesamiento del Scheduler:', err);
    }
  });
}

/**
 * Procesar recordatorios de sesiones en vivo (24 horas antes y 15 minutos antes)
 */
async function processSessionReminders() {
  const now = new Date();
  
  const dateFilter = db.isPostgres 
    ? "ls.date_time >= CURRENT_TIMESTAMP" 
    : "datetime(ls.date_time) >= datetime('now')";

  // Buscar todas las reservas de sesiones futuras programadas
  const bookingsRes = await db.query(`
    SELECT sb.user_id, sb.session_id, ls.title, ls.date_time, ls.zoom_join_url, u.email, u.name
    FROM session_bookings sb
    INNER JOIN live_sessions ls ON sb.session_id = ls.id
    INNER JOIN users u ON sb.user_id = u.id
    WHERE ls.status = 'scheduled' AND ${dateFilter}
  `);

  for (const booking of bookingsRes.rows) {
    const sessionTime = isNaN(booking.date_time) ? new Date(booking.date_time) : new Date(Number(booking.date_time));
    const diffMs = sessionTime - now;
    const diffMins = Math.floor(diffMs / (1000 * 60)); // Diferencia en minutos

    if (diffMins < 0) continue; // Ya comenzó

    // A. Recordatorio de 15 minutos (diffMins <= 15)
    if (diffMins <= 15) {
      const alreadySent = await checkNotificationSent(booking.user_id, 'session_reminder', {
        session_id: booking.session_id,
        reminder_type: '15min'
      });

      if (!alreadySent) {
        console.log(`✉️ Enviando recordatorio de 15 min de la sesión "${booking.title}" al usuario ${booking.user_id}...`);
        
        // Notificación in-app
        await createNotification(
          booking.user_id,
          'session_reminder',
          '🚨 Tu clase comienza en 15 minutos',
          `La sesión "${booking.title}" está por comenzar. Haz clic para entrar a la clase de Zoom.`,
          { session_id: booking.session_id, reminder_type: '15min' }
        );

        // Correo electrónico
        await emailService.sendSessionReminderEmail(
          booking.email,
          booking.name,
          booking.title,
          sessionTime.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
          booking.zoom_join_url
        );
      }
    }
    // B. Recordatorio de 24 horas (diffMins <= 1440 && diffMins > 15)
    else if (diffMins <= 1440) {
      const alreadySent = await checkNotificationSent(booking.user_id, 'session_reminder', {
        session_id: booking.session_id,
        reminder_type: '24h'
      });

      if (!alreadySent) {
        console.log(`✉️ Enviando recordatorio de 24h de la sesión "${booking.title}" al usuario ${booking.user_id}...`);
        
        // Notificación in-app
        await createNotification(
          booking.user_id,
          'session_reminder',
          '📅 Mañana tienes una clase en vivo',
          `Te recordamos tu asistencia para la sesión "${booking.title}" programada para mañana.`,
          { session_id: booking.session_id, reminder_type: '24h' }
        );

        // Correo electrónico
        await emailService.sendSessionReminderEmail(
          booking.email,
          booking.name,
          booking.title,
          sessionTime.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
          booking.zoom_join_url
        );
      }
    }
  }
}

/**
 * Procesar recordatorios de repaso espaciado (D1, D3, D7, D14)
 */
async function processSpacedRepetitionReminders() {
  // Obtener todos los estudiantes
  const usersRes = await db.query("SELECT id, name, email FROM users WHERE role = 'student'");
  
  for (const user of usersRes.rows) {
    const userId = user.id;

    // Buscar todos los módulos que el usuario ha completado al 100%
    const completedModules = await db.query(`
      SELECT m.id as module_id, m.title, MAX(up.completed_at) as completed_at
      FROM modules m
      INNER JOIN lessons l ON l.module_id = m.id
      INNER JOIN user_progress up ON up.lesson_id = l.id
      WHERE up.user_id = $1 AND (up.completed = 1 OR up.completed = TRUE)
      GROUP BY m.id, m.title
      HAVING COUNT(up.lesson_id) = (SELECT COUNT(id) FROM lessons WHERE module_id = m.id)
    `, [userId]);

    for (const mod of completedModules.rows) {
      const compDate = new Date(mod.completed_at);
      const diffMs = new Date() - compDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // Diferencia en días

      const intervals = [1, 3, 7, 14];
      
      // Encontrar el intervalo más alto que aplique
      const matchingInterval = intervals.reverse().find(i => diffDays >= i);
      
      if (matchingInterval) {
        const alreadySent = await checkNotificationSent(userId, 'review_reminder', {
          module_id: mod.module_id,
          interval: matchingInterval
        });

        if (!alreadySent) {
          console.log(`🧠 Enviando recordatorio de repaso D${matchingInterval} para el módulo "${mod.title}" al usuario ${userId}...`);

          // Notificación in-app
          await createNotification(
            userId,
            'review_reminder',
            '🧠 Es hora de repasar',
            `Te toca repasar los conceptos del módulo "${mod.title}" para mantenerlos frescos.`,
            { module_id: mod.module_id, interval: matchingInterval }
          );

          // Correo electrónico
          await emailService.sendReviewReminderEmail(user.email, user.name, mod.title);
        }
      }
    }
  }
}

/**
 * Helper para crear notificaciones in-app
 */
async function createNotification(userId, type, title, message, dataObj) {
  const dataStr = dataObj ? JSON.stringify(dataObj) : null;
  const isRead = db.isPostgres ? false : 0;
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, data, read) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, dataStr, isRead]
  );
}

/**
 * Helper para comprobar si ya se envió una notificación con cierta metadata para evitar spam
 */
async function checkNotificationSent(userId, type, criteria) {
  try {
    const res = await db.query(
      'SELECT data FROM notifications WHERE user_id = $1 AND type = $2',
      [userId, type]
    );

    for (const row of res.rows) {
      if (!row.data) continue;
      try {
        const parsed = JSON.parse(row.data);
        let match = true;
        for (const key in criteria) {
          if (parsed[key] !== criteria[key]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      } catch (e) {}
    }
    return false;
  } catch (err) {
    console.error('Error al comprobar notificación enviada:', err);
    return false;
  }
}

module.exports = {
  initScheduler
};
