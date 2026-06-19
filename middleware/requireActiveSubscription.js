const db = require('../db/index');

async function requireActiveSubscription(req, res, next) {
  // 1. Eximir a administradores e instructores
  if (req.user && (req.user.role === 'admin' || req.user.role === 'instructor')) {
    return next();
  }

  // 2. Si Stripe no está configurado (por ejemplo, en desarrollo local sin llaves), permitir el acceso
  if (!process.env.STRIPE_SECRET_KEY) {
    return next();
  }

  try {
    const userId = req.user.id;
    const subResult = await db.query(
      "SELECT status, current_period_end FROM subscriptions WHERE user_id = $1",
      [userId]
    );

    if (subResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Suscripción requerida',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Se requiere una membresía activa para acceder a este contenido.'
      });
    }

    const sub = subResult.rows[0];
    const isActive = ['active', 'trialing'].includes(sub.status);
    const hasNotExpired = !sub.current_period_end || new Date(sub.current_period_end) > new Date();

    if (!isActive || !hasNotExpired) {
      return res.status(403).json({
        error: 'Suscripción inactiva o expirada',
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Tu membresía no está activa. Por favor, actualiza tu método de pago.'
      });
    }

    next();
  } catch (err) {
    console.error('Error al verificar suscripción activa:', err);
    res.status(500).json({ error: 'Error interno del servidor al verificar la suscripción.' });
  }
}

module.exports = requireActiveSubscription;
