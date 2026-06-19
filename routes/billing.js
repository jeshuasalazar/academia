const express = require('express');
const router = express.Router();
const db = require('../db/index');
const { authenticateToken } = require('../middleware/auth');

// Inicializar Stripe si las llaves existen
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
let stripe = null;

if (stripeSecretKey) {
  stripe = require('stripe')(stripeSecretKey);
  console.log('💳 Cliente Stripe inicializado.');
} else {
  console.log('💳 Stripe en modo simulado (sin STRIPE_SECRET_KEY).');
}

// 1. Obtener planes de membresía disponibles
router.get('/plans', (req, res) => {
  res.json({
    monthly: {
      id: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_mock',
      name: 'Membresía Mensual',
      price: 299, // 299 MXN al mes
      currency: 'mxn',
      interval: 'month',
      description: 'Acceso ilimitado a todos los cursos, comunidad global, clases en vivo y biblioteca de prompts.'
    },
    annual: {
      id: process.env.STRIPE_PRICE_ANNUAL || 'price_annual_mock',
      name: 'Membresía Anual',
      price: 2990, // 2990 MXN al año (ahorra 2 meses)
      currency: 'mxn',
      interval: 'year',
      description: 'Acceso completo anual. Todos los beneficios mensuales más un ahorro del 17% anual.'
    }
  });
});

// 2. Obtener estado de suscripción del usuario autenticado
router.get('/status', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end 
       FROM subscriptions 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ status: 'none', plan: null, current_period_end: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener estado de facturación:', err);
    res.status(500).json({ error: 'Error al verificar el estado de la membresía.' });
  }
});

// 3. Crear sesión de Stripe Checkout (comprar membresía)
router.post('/checkout', authenticateToken, async (req, res) => {
  const { plan } = req.body; // 'monthly' o 'annual'
  const userId = req.user.id;
  const userEmail = req.user.email;
  const userName = req.user.name;

  if (!['monthly', 'annual'].includes(plan)) {
    return res.status(400).json({ error: 'Plan inválido. Debe ser monthly o annual.' });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // --- MODO SIMULADO / DEV ---
  if (!stripe) {
    console.log(`[Stripe Mock] Creando checkout simulado para el usuario ${userId} en plan ${plan}...`);
    // Retornamos URL simulada que el frontend procesará para activar la membresía
    const mockSuccessUrl = `${appUrl}/#/membership?mock_success=true&plan=${plan}`;
    return res.json({ url: mockSuccessUrl });
  }

  // --- MODO REAL CON STRIPE ---
  try {
    // A. Obtener o crear Customer ID de Stripe
    const userRes = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);
    let stripeCustomerId = userRes.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: { userId: userId.toString() }
      });
      stripeCustomerId = customer.id;
      
      await db.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, userId]);
    }

    // B. Obtener Price ID correspondiente
    const priceId = plan === 'annual' 
      ? process.env.STRIPE_PRICE_ANNUAL 
      : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return res.status(500).json({ error: 'El Price ID de Stripe para este plan no está configurado.' });
    }

    // C. Crear sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${appUrl}/#/membership?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#/membership?cancel=true`,
      metadata: { 
        userId: userId.toString(),
        plan: plan
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error al crear sesión de Checkout de Stripe:', err);
    res.status(500).json({ error: 'Error al iniciar el proceso de pago.' });
  }
});

// 4. Crear sesión de Stripe Customer Portal (administrar suscripción)
router.post('/portal', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // --- MODO SIMULADO / DEV ---
  if (!stripe) {
    console.log(`[Stripe Mock] Creando portal de cliente simulado para el usuario ${userId}...`);
    // Retornamos URL simulada que el frontend procesará para cancelar/manejar suscripción
    const mockPortalUrl = `${appUrl}/#/membership?mock_portal=true`;
    return res.json({ url: mockPortalUrl });
  }

  // --- MODO REAL CON STRIPE ---
  try {
    const userRes = await db.query('SELECT stripe_customer_id FROM users WHERE id = $1', [userId]);
    const stripeCustomerId = userRes.rows[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No tienes una cuenta de facturación registrada en Stripe.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/#/membership`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error al crear portal de facturación:', err);
    res.status(500).json({ error: 'Error al abrir el portal de facturación.' });
  }
});

// 5. Endpoint de prueba para activar membresía localmente sin pasarela
router.post('/mock-activate', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { plan } = req.body; // 'monthly' o 'annual'

  if (stripe) {
    return res.status(403).json({ error: 'No disponible en entornos con Stripe real configurado.' });
  }

  try {
    const currentPeriodEnd = new Date();
    if (plan === 'annual') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);
    }

    // Insertar o actualizar suscripción
    if (db.isPostgres) {
      await db.query(
        `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         ON CONFLICT (user_id) DO UPDATE 
         SET plan = EXCLUDED.plan, status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end, updated_at = CURRENT_TIMESTAMP`,
        [userId, 'sub_mock_' + Date.now(), 'price_mock_' + plan, plan, 'active', currentPeriodEnd]
      );
    } else {
      // SQLite REPLACE INTO
      await db.query(
        `INSERT OR REPLACE INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end, created_at, updated_at)
         VALUES (
           (SELECT id FROM subscriptions WHERE user_id = $1),
           $1, $2, $3, $4, $5, $6, 0,
           COALESCE((SELECT created_at FROM subscriptions WHERE user_id = $1), CURRENT_TIMESTAMP),
           CURRENT_TIMESTAMP
         )`,
        [userId, 'sub_mock_' + Date.now(), 'price_mock_' + plan, plan, 'active', currentPeriodEnd]
      );
    }

    res.json({ message: 'Membresía simulada activada exitosamente.', status: 'active', plan, current_period_end: currentPeriodEnd });
  } catch (err) {
    console.error('Error al activar membresía simulada:', err);
    res.status(500).json({ error: 'Error al simular la facturación.' });
  }
});

// 6. Endpoint de prueba para cancelar membresía localmente sin pasarela
router.post('/mock-cancel', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  if (stripe) {
    return res.status(403).json({ error: 'No disponible en entornos con Stripe real configurado.' });
  }

  try {
    await db.query("DELETE FROM subscriptions WHERE user_id = $1", [userId]);
    res.json({ message: 'Membresía simulada cancelada y removida.', status: 'none', plan: null });
  } catch (err) {
    console.error('Error al cancelar membresía simulada:', err);
    res.status(500).json({ error: 'Error al cancelar la facturación simulada.' });
  }
});

// 7. Webhook de Stripe (Cuerpo en crudo / Raw Body, verificado con firmas)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(400).send('Stripe is not configured.');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Requerimos req.body en crudo (Buffer) para verificar la firma de Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('❌ Error de firma en Webhook de Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📨 Recibido evento de Stripe Webhook: ${event.type} [ID: ${event.id}]`);

  // Evitar procesar el mismo evento dos veces (Idempotencia)
  try {
    const checkEvent = await db.query('SELECT id FROM payments WHERE stripe_event_id = $1', [event.id]);
    if (checkEvent.rows.length > 0) {
      console.log(`⚠️ Evento de Stripe ${event.id} ya procesado previamente. Omitiendo.`);
      return res.json({ received: true, duplicate: true });
    }
  } catch (e) {
    console.error('Error al validar idempotencia del evento:', e);
  }

  try {
    switch (event.type) {
      // A. Completación exitosa del Checkout
      case 'checkout.session.completed': {
        const session = event.data.object;
        const stripeSubscriptionId = session.subscription;
        const stripeCustomerId = session.customer;
        const userId = session.metadata.userId;
        const plan = session.metadata.plan;

        if (!userId) {
          console.error('❌ El webhook de Stripe no contenía metadata.userId en Checkout Session.');
          break;
        }

        // Obtener detalles de la suscripción de Stripe
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        const status = subscription.status; // 'active', 'trialing'...

        // Actualizar suscripción en DB
        if (db.isPostgres) {
          await db.query(
            `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE)
             ON CONFLICT (user_id) DO UPDATE 
             SET stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                 stripe_price_id = EXCLUDED.stripe_price_id,
                 plan = EXCLUDED.plan,
                 status = EXCLUDED.status,
                 current_period_end = EXCLUDED.current_period_end,
                 updated_at = CURRENT_TIMESTAMP`,
            [userId, stripeSubscriptionId, subscription.plan.id, plan, status, currentPeriodEnd]
          );
        } else {
          // SQLite REPLACE INTO
          await db.query(
            `INSERT OR REPLACE INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end, created_at, updated_at)
             VALUES (
               (SELECT id FROM subscriptions WHERE user_id = $1),
               $1, $2, $3, $4, $5, $6, 0,
               COALESCE((SELECT created_at FROM subscriptions WHERE user_id = $1), CURRENT_TIMESTAMP),
               CURRENT_TIMESTAMP
             )`,
            [userId, stripeSubscriptionId, subscription.plan.id, plan, status, currentPeriodEnd]
          );
        }

        // Guardar registro de pago
        await db.query(
          `INSERT INTO payments (user_id, stripe_event_id, stripe_invoice_id, amount_cents, currency, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, event.id, session.invoice || null, session.amount_total, session.currency, 'succeeded']
        );

        console.log(`✅ Membresía activada para el usuario ${userId} vía Webhook.`);
        break;
      }

      // B. Actualización de Suscripción (renovación, cancelación programada, etc.)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        const stripeCustomerId = subscription.customer;
        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        // Buscar usuario por stripe_customer_id
        const userRes = await db.query('SELECT id FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
        if (userRes.rows.length === 0) {
          console.error(`❌ No se encontró usuario para el Stripe Customer ${stripeCustomerId}`);
          break;
        }
        const userId = userRes.rows[0].id;

        // Actualizar tabla de suscripciones
        await db.query(
          `UPDATE subscriptions 
           SET status = $1, current_period_end = $2, cancel_at_period_end = $3, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4`,
          [status, currentPeriodEnd, db.isPostgres ? cancelAtPeriodEnd : (cancelAtPeriodEnd ? 1 : 0), userId]
        );

        // Guardar log del evento de pago
        await db.query(
          `INSERT INTO payments (user_id, stripe_event_id, stripe_invoice_id, amount_cents, currency, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, event.id, subscription.latest_invoice || null, null, null, 'succeeded']
        );

        console.log(`🔄 Suscripción actualizada para usuario ${userId}. Estado: ${status}.`);
        break;
      }

      // C. Suscripción eliminada (expirada o cancelada)
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;

        const userRes = await db.query('SELECT id FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
        if (userRes.rows.length === 0) {
          console.error(`❌ No se encontró usuario para el Stripe Customer ${stripeCustomerId}`);
          break;
        }
        const userId = userRes.rows[0].id;

        // Cambiar estado a cancelado en DB
        await db.query(
          "UPDATE subscriptions SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
          [userId]
        );

        await db.query(
          `INSERT INTO payments (user_id, stripe_event_id, stripe_invoice_id, amount_cents, currency, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, event.id, null, null, null, 'canceled']
        );

        console.log(`🚫 Suscripción expirada/eliminada para usuario ${userId}.`);
        break;
      }

      // D. Fallo de pago en renovación
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;

        const userRes = await db.query('SELECT id FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
        if (userRes.rows.length === 0) {
          console.error(`❌ No se encontró usuario para el Stripe Customer ${stripeCustomerId}`);
          break;
        }
        const userId = userRes.rows[0].id;

        // Actualizar suscripción a past_due
        await db.query(
          "UPDATE subscriptions SET status = 'past_due', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
          [userId]
        );

        // Guardar registro de fallo de pago
        await db.query(
          `INSERT INTO payments (user_id, stripe_event_id, stripe_invoice_id, amount_cents, currency, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, event.id, invoice.id, invoice.amount_due, invoice.currency, 'failed']
        );

        console.log(`⚠️ Intento de cobro fallido para usuario ${userId}. Suscripción marcada como past_due.`);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error al procesar base de datos en webhook de Stripe:', err);
    res.status(500).json({ error: 'Error interno al guardar los datos del webhook.' });
  }
});

module.exports = router;
