require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const db = require('./db/index');
const scheduler = require('./services/scheduler');
const migrations = require('./db/migrations');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Inicializar la base de datos
db.initDb()
  .then(() => {
    // Ejecutar migraciones automáticas al iniciar
    return migrations.runMigrations();
  })
  .then(() => {
    // Inicializar Scheduler de tareas en segundo plano tras cargar base de datos e iniciar migraciones
    scheduler.initScheduler();
  })
  .catch(err => {
    console.error('❌ Error crítico al inicializar la base de datos:', err);
  });

// 2. Middlewares de Seguridad y Rendimiento
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://js.clerk.com", "https://*.clerk.accounts.dev", "https://*.clerk.com", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://images.pxhere.com", "https://*.stripe.com", "https://images.clerk.com", "https://*.clerk.com"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://player.vimeo.com", "https://*.zoom.us", "https://*.clerk.accounts.dev", "https://*.clerk.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://api.zoom.us", "https://*.clerk.accounts.dev", "https://*.clerk.com"],
      mediaSrc: ["'self'", "https://commondatastorage.googleapis.com", "https://*.googleapis.com", "blob:", "data:"]
    }
  }
}));
// CORS restringido: solo los dominios propios pueden llamar la API desde otro
// origen. Las peticiones same-origin (frontend servido por este Express) no
// pasan por CORS, así que esto no afecta el flujo normal.
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://ailearning.mx,https://www.ailearning.mx,https://academia.ailearning.mx')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: corsAllowedOrigins, credentials: true }));
app.use(compression());

// 3. Limitadores de Tasa (Rate Limiting)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120, // 120 solicitudes por minuto por IP
  message: { error: 'Demasiadas solicitudes. Por favor, intenta más tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 intentos de login/registro por minuto por IP
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en un minuto.' }
});

// 4. Analizador de cuerpo condicional (Raw body para Stripe Webhook, JSON para el resto)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/billing/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// 5. Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// 6. Registro de enrutadores modulares (Routers)
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/courses', generalLimiter, require('./routes/courses'));
app.use('/api/lessons', generalLimiter, require('./routes/lessons'));
app.use('/api/quizzes', generalLimiter, require('./routes/quizzes'));
app.use('/api/sessions', generalLimiter, require('./routes/sessions'));
app.use('/api/progress', generalLimiter, require('./routes/progress'));
app.use('/api/notifications', generalLimiter, require('./routes/notifications'));
app.use('/api/instructor', generalLimiter, require('./routes/instructor'));
app.use('/api/billing', require('./routes/billing')); // Exento de rate limit para Webhooks de Stripe
app.use('/api/community', generalLimiter, require('./routes/community'));
app.use('/api/prompts', generalLimiter, require('./routes/prompts'));

// 7. Catch-all: servir SPA para rutas del cliente (ej. /register)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 8. Arrancar Servidor HTTP
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`👉 Acceso local: http://localhost:${PORT}`);
});
