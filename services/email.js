const { Resend } = require('resend');

// Inicializar el cliente Resend si la clave de API está presente
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || 'no-reply@ailearning.mx';
const appUrl = process.env.APP_URL || 'http://localhost:3000';

let resend = null;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
  console.log('✉️ Servicio de correo Resend inicializado.');
} else {
  console.log('✉️ Servicio de correo en modo simulado (sin RESEND_API_KEY). Los correos se imprimirán en consola.');
}

/**
 * Función genérica para enviar correos electrónicos
 */
async function sendEmail({ to, subject, html }) {
  if (resend) {
    try {
      const data = await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        html
      });
      return data;
    } catch (err) {
      console.error(`❌ Error al enviar correo a ${to}:`, err);
      // No arrojamos el error para no romper el flujo principal de la aplicación
      return null;
    }
  } else {
    console.log('\n--- ✉️ SIMULADOR DE CORREO ---');
    console.log(`De: ${emailFrom}`);
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Contenido:\n${html}`);
    console.log('-----------------------------\n');
    return { id: 'simulated-email-id' };
  }
}

/**
 * Enviar correo de restablecimiento de contraseña
 */
async function sendPasswordResetEmail(email, name, token) {
  const resetUrl = `${appUrl}/#/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #FF6B47;">Restablecer contraseña - aiLearning Academy</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Hemos recibido una solicitud para restablecer tu contraseña. Utiliza el siguiente código de 6 dígitos:</p>
      <div style="background-color: #f4f5f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0; color: #0E1B2C;">
        ${token}
      </div>
      <p>O si lo prefieres, haz clic en el siguiente botón para restablecerla directamente:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #FF6B47; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
      </div>
      <p style="font-size: 12px; color: #666; margin-top: 30px;">Este código expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Restablecer tu contraseña - aiLearning Academy', html });
}

/**
 * Enviar recordatorio de sesión en vivo
 */
async function sendSessionReminderEmail(email, name, sessionTitle, sessionTime, joinUrl) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #2D88E8;">Recordatorio de Clase en Vivo - aiLearning</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Te recordamos que tu sesión en vivo comenzará pronto:</p>
      <div style="background-color: #f0f7ff; padding: 15px; border-left: 4px solid #2D88E8; border-radius: 4px; margin: 20px 0;">
        <strong style="font-size: 16px; color: #0E1B2C;">${sessionTitle}</strong><br/>
        <span style="color: #555;">Fecha/Hora: ${sessionTime}</span>
      </div>
      <p>Prepárate y accede a la sesión utilizando el siguiente botón:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinUrl || appUrl + '/#/calendar'}" style="background-color: #2D88E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Entrar a la sesión de Zoom</a>
      </div>
      <p style="font-size: 12px; color: #666;">Te recomendamos ingresar 5 minutos antes para verificar tu conexión de audio y video.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: `Recordatorio: ${sessionTitle} - Clase en Vivo`, html });
}

/**
 * Enviar recordatorio de repaso espaciado
 */
async function sendReviewReminderEmail(email, name, moduleTitle) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #6B9080;">🧠 Es hora de repasar - Repaso Espaciado</h2>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Para consolidar los conocimientos en tu memoria a largo plazo, hoy te toca repasar el módulo:</p>
      <div style="background-color: #f7f9f8; padding: 15px; border-left: 4px solid #6B9080; border-radius: 4px; margin: 20px 0;">
        <strong style="font-size: 16px; color: #0E1B2C;">${moduleTitle}</strong>
      </div>
      <p>La curva del olvido muestra que repasar hoy aumentará drásticamente tu retención. Accede a tu dashboard de aprendizaje para repasar los conceptos clave o tomar el mini-quiz de repaso:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${appUrl}/#/dashboard" style="background-color: #6B9080; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ir a repasar ahora</a>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: `🧠 Recordatorio de Repaso: ${moduleTitle}`, html });
}

/**
 * Enviar correo de logro desbloqueado
 */
async function sendAchievementUnlockedEmail(email, name, achievementName, achievementDesc, xpReward) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 8px;">
      <span style="font-size: 50px;">🏆</span>
      <h2 style="color: #FFB703; margin-top: 10px;">¡Logro Desbloqueado!</h2>
      <p>Felicidades <strong>${name}</strong>,</p>
      <p>Has demostrado un gran compromiso y desbloqueado la siguiente insignia:</p>
      <div style="background-color: #fffbeb; padding: 20px; border: 1px dashed #FFB703; border-radius: 8px; margin: 20px auto; max-width: 400px;">
        <h3 style="margin: 0; color: #d97706;">${achievementName}</h3>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-style: italic;">${achievementDesc}</p>
        <span style="display: inline-block; background-color: #d97706; color: white; font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 9999px; margin-top: 15px;">+${xpReward} XP Recompensa</span>
      </div>
      <p>Sigue aprendiendo y desbloqueando más logros para subir en la tabla de clasificación.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${appUrl}/#/achievements" style="background-color: #0E1B2C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ver mis logros</a>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: `🎉 ¡Felicidades! Logro desbloqueado: ${achievementName}`, html });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendSessionReminderEmail,
  sendReviewReminderEmail,
  sendAchievementUnlockedEmail
};
