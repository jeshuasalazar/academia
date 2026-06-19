# 🚀 aiLearning Academy — Plan de Implementación Completo

Transformar el MVP actual en una plataforma de e-learning de clase mundial, inspirada en la simplicidad de Skool pero con estrategias probadas que maximizan el LTV del alumno, índices de aprendizaje y tasas de completación.

## Estado Actual

El proyecto tiene un MVP funcional con:
- ✅ Auth JWT (login/registro) con 2 roles (student/admin)
- ✅ 6 tablas: users, courses, lessons, user_progress, prompts, live_sessions
- ✅ Sistema XP/niveles básico (+50 XP por lección)
- ✅ Player de video HTML5, librería de prompts, sesiones en vivo
- ✅ Panel admin con formularios de creación (sin editar/eliminar)
- ✅ SPA vanilla JS con hash routing, tema dark/light
- ✅ Deploy Docker + Railway (SQLite local / PostgreSQL prod)

## User Review Required

> [!IMPORTANT]
> **Video Hosting:** El plan asume **YouTube (unlisted/embedded)** como hosting principal de videos por ser gratuito. Si prefieres un proveedor profesional con DRM como **Bunny.net** (~$0.005/GB), el sistema está diseñado para soportar múltiples proveedores con un cambio mínimo.

> [!IMPORTANT]
> **Zoom API:** Para la integración completa con Zoom (crear reuniones automáticamente), se necesita una cuenta **Zoom Pro** y crear una app Server-to-Server OAuth en el Marketplace de Zoom. Si no tienes cuenta Pro, el sistema usará links de Zoom manuales (como ahora).

> [!WARNING]
> **Correo electrónico:** Para password reset y notificaciones por email se necesita un servicio SMTP (Gmail, SendGrid, Resend). Si no está disponible, estas features se implementan pero quedan deshabilitadas hasta configurar SMTP.

## Open Questions

> [!IMPORTANT]
> 1. **¿Tienes cuenta Zoom Pro** para la API, o usaremos links manuales?
> 2. **¿Hay un servicio SMTP** configurado (Gmail app password, SendGrid, etc.) para emails?
> 3. **¿Los cursos serán gratuitos o de pago?** El plan incluye un sistema de enrollment pero sin pasarela de pago. ¿Necesitas Stripe/PayPal?
> 4. **¿Cuántos profesores habrá?** El plan asume un rol `instructor` además de `admin` y `student`.
> 5. **¿Quieres un sistema de comunidad/foro** por curso (estilo Skool) o es suficiente con los cursos + sesiones en vivo?

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (SPA)                        │
│  Vanilla JS + Hash Router + CSS Design System            │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Auth    │ │Dashboard │ │ Courses  │ │  Teacher   │  │
│  │  Views   │ │  View    │ │  Views   │ │  Panel     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Quiz    │ │Calendar  │ │ Profile  │ │  Admin     │  │
│  │  Engine  │ │  View    │ │  View    │ │  Panel     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (JWT Auth)
┌─────────────────────┴───────────────────────────────────┐
│                  BACKEND (Express.js)                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Middleware: Auth │ CORS │ Rate Limit │ Validate  │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────┐   │
│  │  Auth  │ │Courses │ │ Quiz   │ │   Live Sessions │   │
│  │ Router │ │ Router │ │ Router │ │   Router        │   │
│  └────────┘ └────────┘ └────────┘ └─────────────────┘   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────┐   │
│  │ Users  │ │Material│ │ Admin  │ │   Instructor    │   │
│  │ Router │ │ Router │ │ Router │ │   Router        │   │
│  └────────┘ └────────┘ └────────┘ └─────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│            DATABASE (PostgreSQL / SQLite)                 │
│                                                          │
│  users │ courses │ modules │ lessons │ quizzes            │
│  quiz_questions │ quiz_attempts │ enrollments             │
│  user_progress │ lesson_materials │ live_sessions         │
│  session_bookings │ achievements │ user_achievements      │
│  certificates │ notifications │ prompts                   │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Phase 1: Database & Backend Restructuring

Reestructurar la base de datos para soportar todas las features. Migrar de un archivo monolítico a una arquitectura modular.

---

#### [MODIFY] [index.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/db/index.js)

Reescribir el schema para incluir todas las tablas nuevas. El dual-engine (SQLite/PostgreSQL) se mantiene.

**Nuevas tablas (12 adicionales):**

| Tabla | Propósito |
|-------|-----------|
| `modules` | Agrupar lecciones dentro de un curso (Curso → Módulos → Lecciones) |
| `enrollments` | Registro de inscripciones de alumnos a cursos |
| `lesson_materials` | Archivos descargables por lección (PDFs, slides, código) |
| `quizzes` | Tests por módulo con score mínimo y límite de tiempo |
| `quiz_questions` | Preguntas con tipos (MCQ, verdadero/falso, respuesta corta) |
| `quiz_attempts` | Intentos de quiz con score y respuestas (JSON) |
| `achievements` | Catálogo de logros/badges desbloqueables |
| `user_achievements` | Logros obtenidos por cada usuario |
| `session_bookings` | Reservaciones de alumnos a sesiones en vivo |
| `certificates` | Certificados emitidos al completar cursos |
| `notifications` | Sistema de notificaciones in-app |
| `discussion_posts` | Foro de discusión por curso (opcional, Skool-style) |

**Cambios a tablas existentes:**

| Tabla | Cambio |
|-------|--------|
| `users` | +`bio`, +`timezone`, +`avatar_url`, +`last_login_at`, +`streak_count`, +`longest_streak`, +`streak_last_date`, +`reset_token`, +`reset_token_expires` |
| `courses` | +`instructor_id` FK, +`status` (draft/published), +`estimated_hours`, +`enrollment_count`, +`order_num` |
| `lessons` | Cambiar `course_id` → `module_id` FK, +`content_type` (video/text/exercise), +`video_provider` (youtube/bunny/vimeo/upload) |
| `user_progress` | +`time_spent_seconds`, +`notes` |
| `live_sessions` | +`instructor_id` FK, +`max_participants`, +`session_type` (live_class/office_hours/workshop), +`recording_url`, +`status` (scheduled/live/completed/cancelled) |

**Schema completo de nuevas tablas:**

```sql
-- Módulos: agrupan lecciones dentro de un curso
CREATE TABLE modules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  summary TEXT,                    -- Resumen del módulo (mostrado al completar)
  order_num INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inscripciones a cursos
CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',  -- active, completed, dropped
  completed_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  UNIQUE(user_id, course_id)
);

-- Materiales descargables por lección
CREATE TABLE lesson_materials (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),           -- pdf, zip, code, slides
  file_size_bytes INTEGER,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes por módulo
CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,   -- porcentaje mínimo para aprobar
  time_limit_minutes INTEGER,          -- NULL = sin límite
  max_attempts INTEGER DEFAULT 3,
  randomize_questions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preguntas de quiz
CREATE TABLE quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL,  -- mcq, true_false, short_answer
  options TEXT,                         -- JSON array para MCQ: [{"id":"a","text":"..."},...]
  correct_answer TEXT NOT NULL,         -- "a" para MCQ, "true"/"false", o texto libre
  explanation TEXT,                     -- Explicación mostrada tras responder
  points INTEGER DEFAULT 10,
  order_num INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Intentos de quiz
CREATE TABLE quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,              -- porcentaje 0-100
  passed BOOLEAN NOT NULL,
  answers TEXT,                         -- JSON con respuestas del alumno
  time_spent_seconds INTEGER,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Catálogo de logros
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL,           -- emoji o nombre de icono Lucide
  criteria_type VARCHAR(50) NOT NULL,  -- courses_completed, quizzes_passed, streak_days, xp_reached, lessons_completed
  criteria_value INTEGER NOT NULL,      -- valor numérico del criterio
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logros obtenidos
CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Reservaciones de sesiones en vivo
CREATE TABLE session_bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attended BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, session_id)
);

-- Certificados
CREATE TABLE certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_code VARCHAR(50) UNIQUE NOT NULL,  -- código verificable
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

-- Notificaciones
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,           -- achievement, quiz_result, session_reminder, course_update
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data TEXT,                            -- JSON con datos adicionales
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foro de discusión (Skool-style)
CREATE TABLE discussion_posts (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

#### [NEW] [db/migrations.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/db/migrations.js)

Script de migraciones para actualizar el schema sin perder datos. Detecta tablas existentes y solo crea las que faltan. Agrega columnas nuevas a tablas existentes con `ALTER TABLE`.

---

#### [MODIFY] [db/seed.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/db/seed.js)

Actualizar seed data con:
- 2 usuarios demo (student + admin/instructor) — mantener los actuales
- 3 cursos completos con 3 módulos cada uno
- 3-5 lecciones por módulo con videos de YouTube embed
- Materiales de ejemplo (links a PDFs públicos)
- 1 quiz por módulo con 5 preguntas variadas (MCQ + true/false)
- 10 achievements predefinidos
- 5 sesiones en vivo programadas
- Resúmenes de módulo

---

### Phase 2: Backend — API Modular

Reestructurar `server.js` monolítico en routers modulares para mantenibilidad.

---

#### [NEW] [routes/auth.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/auth.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registro con validación mejorada (password min 8 chars) |
| POST | `/api/auth/login` | Login — actualiza `last_login_at`, calcula streak |
| POST | `/api/auth/forgot-password` | Genera token de reset (6 dígitos), envía por email si SMTP configurado |
| POST | `/api/auth/reset-password` | Valida token + actualiza password |
| GET | `/api/auth/me` | Perfil completo del usuario autenticado |
| PUT | `/api/auth/profile` | Editar perfil (name, bio, timezone, avatar) |
| PUT | `/api/auth/password` | Cambiar contraseña (requiere contraseña actual) |

---

#### [NEW] [routes/courses.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/courses.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | Listar cursos publicados con progreso del alumno |
| GET | `/api/courses/:id` | Detalle del curso con módulos, lecciones, progreso |
| POST | `/api/courses/:id/enroll` | Inscribirse a un curso |
| GET | `/api/courses/:id/modules` | Módulos con lecciones y estado de completación |
| GET | `/api/courses/:id/modules/:moduleId/summary` | Resumen del módulo (tras completar) |

---

#### [NEW] [routes/lessons.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/lessons.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lessons/:id` | Detalle de lección con materiales adjuntos |
| POST | `/api/lessons/:id/complete` | Marcar lección completada (+XP, check achievements) |
| GET | `/api/lessons/:id/materials` | Listar materiales descargables |

---

#### [NEW] [routes/quizzes.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/quizzes.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quizzes/:id` | Obtener quiz con preguntas (sin respuestas correctas) |
| POST | `/api/quizzes/:id/submit` | Enviar respuestas → calificar → retornar score + feedback |
| GET | `/api/quizzes/:id/attempts` | Historial de intentos del alumno |
| GET | `/api/quizzes/:id/review/:attemptId` | Revisión detallada de un intento (preguntas + respuestas correctas + explicaciones) |

---

#### [NEW] [routes/sessions.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/sessions.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | Listar sesiones futuras con estado de booking del usuario |
| GET | `/api/sessions/calendar` | Sesiones en formato calendario (agrupadas por mes) |
| POST | `/api/sessions/:id/book` | Reservar lugar en sesión en vivo |
| DELETE | `/api/sessions/:id/book` | Cancelar reservación |
| GET | `/api/sessions/:id` | Detalle de sesión con link de Zoom (solo si booked) |

---

#### [NEW] [routes/progress.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/progress.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress/dashboard` | Stats generales: cursos inscritos, completados, streak, XP, nivel, logros recientes |
| GET | `/api/progress/courses/:id` | Progreso detallado por curso: módulos, lecciones, quizzes |
| GET | `/api/progress/achievements` | Todos los achievements con estado (locked/unlocked) |
| GET | `/api/progress/leaderboard` | Top 20 estudiantes por XP |
| GET | `/api/progress/streak` | Datos del streak actual + historial |

---

#### [NEW] [routes/notifications.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/notifications.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Notificaciones del usuario (paginadas, 20 por página) |
| PUT | `/api/notifications/:id/read` | Marcar como leída |
| PUT | `/api/notifications/read-all` | Marcar todas como leídas |
| GET | `/api/notifications/unread-count` | Contador de no leídas (para badge) |

---

#### [NEW] [routes/instructor.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/routes/instructor.js)

Panel del profesor/instructor — requiere role `admin` o `instructor`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Cursos** | | |
| GET | `/api/instructor/courses` | Mis cursos (con stats de enrollment) |
| POST | `/api/instructor/courses` | Crear curso (draft por defecto) |
| PUT | `/api/instructor/courses/:id` | Editar curso |
| PUT | `/api/instructor/courses/:id/publish` | Publicar/despublicar curso |
| DELETE | `/api/instructor/courses/:id` | Eliminar curso (soft delete) |
| **Módulos** | | |
| POST | `/api/instructor/modules` | Crear módulo dentro de un curso |
| PUT | `/api/instructor/modules/:id` | Editar módulo (título, descripción, resumen, orden) |
| DELETE | `/api/instructor/modules/:id` | Eliminar módulo |
| PUT | `/api/instructor/modules/reorder` | Reordenar módulos |
| **Lecciones** | | |
| POST | `/api/instructor/lessons` | Crear lección (con video URL + provider) |
| PUT | `/api/instructor/lessons/:id` | Editar lección |
| DELETE | `/api/instructor/lessons/:id` | Eliminar lección |
| PUT | `/api/instructor/lessons/reorder` | Reordenar lecciones |
| **Materiales** | | |
| POST | `/api/instructor/materials` | Agregar material a lección (URL) |
| DELETE | `/api/instructor/materials/:id` | Eliminar material |
| **Quizzes** | | |
| POST | `/api/instructor/quizzes` | Crear quiz para módulo |
| PUT | `/api/instructor/quizzes/:id` | Editar quiz |
| DELETE | `/api/instructor/quizzes/:id` | Eliminar quiz |
| POST | `/api/instructor/quizzes/:id/questions` | Agregar pregunta |
| PUT | `/api/instructor/questions/:id` | Editar pregunta |
| DELETE | `/api/instructor/questions/:id` | Eliminar pregunta |
| **Sesiones** | | |
| POST | `/api/instructor/sessions` | Programar sesión en vivo |
| PUT | `/api/instructor/sessions/:id` | Editar sesión |
| DELETE | `/api/instructor/sessions/:id` | Cancelar sesión |
| **Analytics** | | |
| GET | `/api/instructor/analytics/overview` | Stats: total alumnos, avg completion, avg quiz score |
| GET | `/api/instructor/analytics/courses/:id` | Stats detalladas por curso: enrollment, completación, dropout |

---

#### [MODIFY] [server.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/server.js)

Refactorizar para importar routers modulares. Agregar:
- **Rate limiting** con `express-rate-limit` (100 req/min general, 5/min para auth)
- **Input validation** con `express-validator`
- **CORS** configuración
- **Helmet** para headers de seguridad
- **Compression** para respuestas gzip
- Mantener middleware de auth existente pero moverlo a `middleware/auth.js`

---

#### [NEW] [middleware/auth.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/middleware/auth.js)

Middleware extraído: `authenticateToken`, `requireAdmin`, `requireInstructor`.

---

#### [NEW] [middleware/validate.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/middleware/validate.js)

Schemas de validación para todos los endpoints con `express-validator`.

---

#### [NEW] [services/achievements.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/services/achievements.js)

Motor de achievements que se ejecuta tras acciones clave:
- Completar lección → check "X lecciones completadas"
- Completar curso → check "X cursos completados"
- Pasar quiz → check "X quizzes aprobados"
- Login diario → check "X días de streak"
- XP milestone → check "X XP alcanzado"

Crea notificación automáticamente al desbloquear achievement.

---

#### [NEW] [services/certificates.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/services/certificates.js)

Generador de certificados HTML→PDF al completar un curso (todas las lecciones + todos los quizzes aprobados). Genera código único verificable.

---

### Phase 3: Frontend — Vistas Completas

Reestructurar el frontend manteniendo la arquitectura SPA vanilla pero mejorando la modularidad.

---

#### [MODIFY] [public/app.js](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/public/app.js)

Refactorizar completamente. Nuevas vistas/rutas:

| Hash Route | Vista | Descripción |
|------------|-------|-------------|
| `#/` | Auth | Login/Registro (mantener diseño actual mejorado) |
| `#/dashboard` | Dashboard | Resumen completo: streak, XP, próxima sesión, cursos en progreso, logros recientes, leaderboard |
| `#/courses` | Catálogo | Grid de cursos con filtros (categoría, nivel), búsqueda, badge "inscrito"/"completado" |
| `#/course/:id` | Detalle Curso | Info del curso, módulos colapsables, progreso visual, botón inscribirse, reviews |
| `#/learn/:courseId/:lessonId` | Player | Sidebar módulos/lecciones + video player + materiales + marcar completado |
| `#/quiz/:quizId` | Quiz Engine | Motor de quiz interactivo: progreso, timer, navegación entre preguntas, submit |
| `#/quiz/:quizId/review/:attemptId` | Quiz Review | Revisión post-quiz: respuestas correctas, explicaciones, score |
| `#/calendar` | Calendario | Vista mensual de sesiones en vivo, booking, links de Zoom, upcoming |
| `#/prompts` | Prompts | Mantener vista actual (ya está bien implementada) |
| `#/achievements` | Logros | Grid de achievements (locked/unlocked), progreso hacia cada uno |
| `#/profile` | Perfil | Editar perfil, cambiar password, stats, certificados, streak history |
| `#/leaderboard` | Leaderboard | Top estudiantes con XP, nivel, badges |
| `#/instructor` | Panel Instructor | Dashboard del profesor: gestión de cursos, módulos, lecciones, quizzes, materiales, sesiones, analytics |
| `#/admin` | Panel Admin | Gestión de usuarios, configuración global (mantener + ampliar) |

---

#### Componentes Frontend Clave

**1. Quiz Engine (nueva)**
- Renderizado dinámico de preguntas según tipo (MCQ, V/F, respuesta corta)
- Barra de progreso (pregunta X de Y)
- Timer countdown (si aplica)
- Navegación entre preguntas (anterior/siguiente)
- Feedback inmediato al enviar: score, respuestas correctas con explicación
- Animación de confetti al aprobar 🎉
- Botón "Reintentar" si falló

**2. Calendar View (mejorada)**
- Vista mensual completa con celdas por día
- Indicadores de sesiones en vivo (dot coral)
- Modal al hacer click en sesión: detalles + botón "Reservar lugar"
- Sección "Próximas sesiones" con countdown
- Link de Zoom visible solo tras reservar y cuando faltan <15min

**3. Instructor Panel (nueva)**
- Sidebar con secciones: Cursos, Lecciones, Quizzes, Materiales, Sesiones, Analytics
- **Course Builder:** Formulario paso a paso (info básica → módulos → lecciones → quizzes)
- **Quiz Builder:** Agregar preguntas con preview en tiempo real, drag-and-drop para reordenar
- **Material Manager:** Lista de materiales por lección, agregar por URL
- **Analytics Dashboard:** Gráficas de enrollment, completion rates, quiz scores promedio
- **Session Manager:** Crear/editar/cancelar sesiones en vivo

**4. Progress Dashboard (mejorado)**
- Streak counter con fuego 🔥 y calendario de actividad (estilo GitHub contribution graph)
- XP progress bar hacia siguiente nivel con animación
- Cursos en progreso con porcentaje y última lección
- Logros recientes desbloqueados
- Mini-leaderboard (top 5 + tu posición)
- Próxima sesión en vivo con countdown

**5. Course Detail View (mejorada)**
- Banner del curso con thumbnail
- Tabs: Contenido | Progreso | Discusión
- Contenido: Lista de módulos colapsables → lecciones con checkmarks
- Progreso: Barra general + por módulo + quizzes scores
- Resumen de módulo al completar todas sus lecciones
- Botón "Continuar donde dejé"

**6. Video Player (mejorado)**
- Embed de YouTube con `iframe` API para tracking de progreso
- Controles: velocidad, fullscreen, picture-in-picture
- Sidebar de materiales descargables
- Botón "Marcar como completada" con XP animation
- Auto-avance a siguiente lección

**7. Achievement System (nueva)**
- Grid de badges con estados: locked (gris) / unlocked (color + glow)
- Progreso visual hacia cada achievement
- Toast notification al desbloquear con animación especial
- Categorías: Aprendizaje, Consistencia, Social, Mastery

**8. Notification Center (nueva)**
- Ícono de campana en header con badge de count
- Dropdown con lista de notificaciones
- Tipos: achievement_unlocked, quiz_result, session_reminder, course_update
- Click → navega a la vista relevante

---

#### [MODIFY] [public/styles.css](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/public/styles.css)

Agregar estilos para todas las nuevas vistas y componentes:
- Quiz engine (preguntas, opciones, timer, resultados)
- Calendario mejorado (grid mensual, modales de sesión)
- Instructor panel (formularios, tablas, analytics)
- Achievement grid (badges, progreso)
- Notification center (dropdown, badges)
- Profile view (edición, stats)
- Leaderboard (ranking table)
- Streak widget (contribution graph)
- Módulos colapsables (accordion)
- Confetti animation
- Loading skeletons para cada vista

---

#### [MODIFY] [public/index.html](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/public/index.html)

- Agregar notification bell en el header
- Agregar nuevos items en el sidebar nav (Calendario, Logros, Perfil)
- Agregar contenedores para nuevas vistas
- Mantener la estructura existente

---

### Phase 4: Engagement & Polish

Features que maximizan el LTV y la experiencia premium.

---

#### Streak System
- Login diario incrementa streak (+1)
- Streak perdido si no hay login en 24h
- Visual: fuego emoji que crece con streak (🔥 1-7, 🔥🔥 8-14, 🔥🔥🔥 15-30, ⚡ 30+)
- Achievement badges por streaks (7, 14, 30, 60, 90 días)

#### Spaced Repetition Reminders
- Al completar un módulo, programar recordatorios de repaso:
  - Día 1, Día 3, Día 7, Día 14 después de completar
- Notificación in-app: "Es hora de repasar [Módulo X]"
- Mini-quiz de repaso (3 preguntas aleatorias del módulo)

#### Certificate Generation
- HTML template con diseño premium branded
- Código QR con link de verificación
- Descargable como PDF (usando html2canvas + jsPDF en frontend)
- Se genera automáticamente al completar TODOS los módulos + quizzes de un curso

#### Leaderboard
- Top 20 estudiantes por XP
- Filtros: semanal, mensual, all-time
- Destacar tu posición si no estás en top 20
- Badge especial para top 3

---

### Phase 5: Security & Performance

---

#### Security
- Rate limiting: 100 req/min general, 5/min auth endpoints
- Input validation con express-validator en todos los endpoints
- Sanitización de HTML en inputs de texto libre
- Helmet para security headers
- CORS configurado para dominio de producción

#### Performance
- Compression (gzip) en responses
- Índices DB en columnas de búsqueda frecuente (user_id, course_id, module_id)
- Lazy loading de vistas en el SPA
- Cache de datos estáticos (achievements catalog, course list)
- Paginación en endpoints que retornan listas

---

### Dependencias Nuevas

#### [MODIFY] [package.json](file:///Users/MAC/Documents/aiLearning/00_SITIO_WEB/E-Learning/package.json)

```json
{
  "dependencies": {
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "better-sqlite3": "^11.0.0",
    "pg": "^8.12.0",
    "express-rate-limit": "^7.2.0",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "uuid": "^9.0.0",
    "nodemailer": "^6.9.0"
  }
}
```

> [!NOTE]
> `nodemailer` es opcional — solo se usa si hay SMTP configurado. El sistema funciona sin él.

---

### Archivos Finales del Proyecto

```
E-Learning/
├── server.js                      (refactorizado — punto de entrada limpio)
├── package.json                   (dependencias actualizadas)
├── .env.example                   (variables de entorno actualizadas)
├── Dockerfile
├── railway.json
├── middleware/
│   ├── auth.js                    [NEW] Middleware de autenticación
│   └── validate.js                [NEW] Schemas de validación
├── routes/
│   ├── auth.js                    [NEW] Autenticación y perfil
│   ├── courses.js                 [NEW] Catálogo y detalle de cursos
│   ├── lessons.js                 [NEW] Lecciones y materiales
│   ├── quizzes.js                 [NEW] Motor de quizzes
│   ├── sessions.js                [NEW] Sesiones en vivo y calendario
│   ├── progress.js                [NEW] Dashboard de progreso y logros
│   ├── notifications.js           [NEW] Notificaciones
│   ├── instructor.js              [NEW] Panel del profesor
│   └── prompts.js                 [NEW] Librería de prompts (extraído)
├── services/
│   ├── achievements.js            [NEW] Motor de logros
│   └── certificates.js            [NEW] Generador de certificados
├── db/
│   ├── index.js                   (schema actualizado)
│   ├── migrations.js              [NEW] Migraciones
│   └── seed.js                    (seed data ampliada)
├── public/
│   ├── index.html                 (actualizado con nuevos elementos)
│   ├── styles.css                 (ampliado con nuevos componentes)
│   └── app.js                     (refactorizado completo)
└── Brand Manual aiLearning.html
```

---

## Verification Plan

### Automated Tests

```bash
# 1. Verificar que el servidor arranca sin errores
node server.js

# 2. Seed data se carga correctamente
node db/seed.js

# 3. Test de endpoints con curl
# Auth
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"estudiante@ailearning.mx","password":"123456"}'

# Courses
curl http://localhost:3000/api/courses -H "Authorization: Bearer <token>"

# Quiz submit
curl -X POST http://localhost:3000/api/quizzes/1/submit -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"answers":[...]}'
```

### Manual Verification
1. **Flujo del alumno:** Registro → Dashboard → Inscribirse a curso → Ver lecciones → Completar lección → Tomar quiz → Ver score → Ver achievements → Ver certificado
2. **Flujo del profesor:** Login como instructor → Crear curso → Agregar módulos → Agregar lecciones con video YouTube → Crear quiz con preguntas → Programar sesión en vivo → Ver analytics
3. **Calendario:** Ver sesiones programadas → Reservar lugar → Ver link de Zoom → Verificar que aparece en sidebar
4. **Gamificación:** Completar acciones → Verificar XP incrementa → Nivel sube → Achievements se desbloquean → Leaderboard actualiza → Streak funciona
5. **Responsive:** Verificar todas las vistas en desktop y mobile (768px breakpoint)
6. **Temas:** Verificar dark/light mode en todas las nuevas vistas

---

## Orden de Ejecución

| # | Tarea | Archivos | Estimado |
|---|-------|----------|----------|
| 1 | Database schema + migraciones | `db/index.js`, `db/migrations.js` | Backend foundation |
| 2 | Middleware (auth, validation) | `middleware/auth.js`, `middleware/validate.js` | Security layer |
| 3 | Rutas de Auth mejoradas | `routes/auth.js` | User management |
| 4 | Rutas de Courses + Modules + Lessons | `routes/courses.js`, `routes/lessons.js` | Core content |
| 5 | Ruta de Quizzes | `routes/quizzes.js` | Assessment engine |
| 6 | Rutas de Sessions + Bookings | `routes/sessions.js` | Live events |
| 7 | Rutas de Progress + Achievements | `routes/progress.js`, `services/achievements.js` | Gamification |
| 8 | Rutas de Instructor | `routes/instructor.js` | Teacher panel |
| 9 | Rutas de Notifications + Certificates | `routes/notifications.js`, `services/certificates.js` | Engagement |
| 10 | Server refactor + dependencias | `server.js`, `package.json` | Wire everything |
| 11 | Seed data completa | `db/seed.js` | Demo data |
| 12 | Frontend: HTML + CSS updates | `public/index.html`, `public/styles.css` | UI foundation |
| 13 | Frontend: App.js — Core views | `public/app.js` (Dashboard, Courses, Player) | Main experience |
| 14 | Frontend: Quiz Engine | `public/app.js` (Quiz views) | Assessment UI |
| 15 | Frontend: Calendar + Sessions | `public/app.js` (Calendar views) | Scheduling UI |
| 16 | Frontend: Instructor Panel | `public/app.js` (Instructor views) | Teacher UI |
| 17 | Frontend: Achievements + Profile + Leaderboard | `public/app.js` (Gamification views) | Engagement UI |
| 18 | Frontend: Notifications + Polish | `public/app.js` (Notifications, animations) | Final polish |
| 19 | Testing + Verificación | Tests manuales + curl | Quality assurance |
| 20 | Deploy Railway | Push + verify production | Go live |
