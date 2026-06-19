const db = require('../db/index');
const emailService = require('./email');

/**
 * Verifica y otorga logros a un usuario basándose en un tipo de criterio.
 */
async function checkAndAward(userId, criteriaType) {
  try {
    // 1. Obtener logros ya ganados por el usuario
    const earnedRes = await db.query(
      'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
      [userId]
    );
    const earnedIds = earnedRes.rows.map(r => Number(r.achievement_id));

    // 2. Obtener todos los logros del catálogo para este tipo de criterio
    const achievementsRes = await db.query(
      'SELECT * FROM achievements WHERE criteria_type = $1',
      [criteriaType]
    );
    const achievements = achievementsRes.rows;

    if (achievements.length === 0) return [];

    // 3. Calcular el valor actual del usuario para este criterio
    let currentValue = 0;
    
    if (criteriaType === 'lessons_completed') {
      const res = await db.query(
        'SELECT COUNT(lesson_id) as count FROM user_progress WHERE user_id = $1 AND (completed = 1 OR completed = TRUE)',
        [userId]
      );
      currentValue = Number(res.rows[0]?.count || 0);
    } else if (criteriaType === 'courses_completed') {
      const res = await db.query(
        "SELECT COUNT(id) as count FROM enrollments WHERE user_id = $1 AND status = 'completed'",
        [userId]
      );
      currentValue = Number(res.rows[0]?.count || 0);
    } else if (criteriaType === 'quizzes_passed') {
      const res = await db.query(
        'SELECT COUNT(DISTINCT quiz_id) as count FROM quiz_attempts WHERE user_id = $1 AND (passed = 1 OR passed = TRUE)',
        [userId]
      );
      currentValue = Number(res.rows[0]?.count || 0);
    } else if (criteriaType === 'streak_days') {
      const res = await db.query('SELECT streak_count FROM users WHERE id = $1', [userId]);
      currentValue = Number(res.rows[0]?.streak_count || 0);
    } else if (criteriaType === 'xp_reached') {
      const res = await db.query('SELECT xp FROM users WHERE id = $1', [userId]);
      currentValue = Number(res.rows[0]?.xp || 0);
    }

    const newlyAwarded = [];

    // 4. Evaluar cada logro
    for (const ach of achievements) {
      // Si el usuario ya lo tiene, saltar
      if (earnedIds.includes(ach.id)) continue;

      // Si cumple el criterio, otorgarlo
      if (currentValue >= ach.criteria_value) {
        console.log(`🏆 ¡Logro desbloqueado para usuario ${userId}! Insignia: "${ach.name}"`);

        // A. Insertar en logros del usuario
        if (db.isPostgres) {
          await db.query(
            'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, ach.id]
          );
        } else {
          try {
            await db.query(
              'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
              [userId, ach.id]
            );
          } catch (e) {}
        }

        // B. Sumar XP de recompensa
        if (ach.xp_reward > 0) {
          const userRes = await db.query('SELECT xp FROM users WHERE id = $1', [userId]);
          const currentXp = (userRes.rows[0]?.xp || 0) + ach.xp_reward;
          const newLevel = Math.floor(currentXp / 100) + 1;
          
          await db.query('UPDATE users SET xp = $1, level = $2 WHERE id = $3', [currentXp, newLevel, userId]);
        }

        // C. Crear notificación in-app
        const dataJson = JSON.stringify({ achievement_id: ach.id, icon: ach.icon });
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, data) 
           VALUES ($1, 'achievement', $2, $3, $4)`,
          [
            userId,
            `¡Nuevo logro: ${ach.name}!`,
            `Desbloqueaste la insignia: ${ach.description} (${ach.xp_reward > 0 ? '+' + ach.xp_reward + ' XP' : ''})`,
            dataJson
          ]
        );

        // D. Enviar correo electrónico en segundo plano
        const uRes = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
        if (uRes.rows.length > 0) {
          const userObj = uRes.rows[0];
          emailService.sendAchievementUnlockedEmail(userObj.email, userObj.name, ach.name, ach.description, ach.xp_reward)
            .catch(err => console.error('Error al enviar correo de logro:', err));
        }

        newlyAwarded.push(ach);
      }
    }

    return newlyAwarded;
  } catch (err) {
    console.error('Error en el motor de logros checkAndAward:', err);
    return [];
  }
}

module.exports = {
  checkAndAward
};
