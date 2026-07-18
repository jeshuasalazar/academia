# CONTRATO TÉCNICO — Academia aiLearning (multi-tenant)

Plataforma de academia que aiLearning renta a empresas capacitadoras. Sin auth (se selecciona rol/usuario desde un switcher). Español en toda la UI.

## Stack
- Node >=18, Express 4. Sin build step. `npm start` → `node server.js`. Puerto `process.env.PORT || 3000`.
- Persistencia: `data/db.json` (se genera desde `data/seed.js` al primer arranque; escrituras con debounce). Todo en memoria.
- Frontend: SPA vanilla JS en `public/` (hash routing `#/...`), servida por Express static. `index.html` único.

## Estructura de archivos (NO cambiar rutas)
```
server.js            # Express: static + API REST
data/seed.js         # module.exports = { empresas, profesores, alumnos, cursos, rutas, sesionesVivo, foro, desbloqueos, progreso, notificaciones }
data/db.json         # generado en runtime (gitignored)
public/index.html    # shell: carga css/styles.css, js/core.js, js/alumno.js, js/profesor.js, js/capacitadora.js
public/css/styles.css
public/js/core.js    # API client, router, helpers UI, shell render (sidebar/header/tabbar), switcher de rol
public/js/alumno.js  # window.VIEWS_ALUMNO = { inicio, rutas, curso, leccion, vivo, foro, materiales }  (funciones que devuelven HTML string y attachan eventos)
public/js/profesor.js     # window.VIEWS_PROFESOR = { panel, curso, sesiones, foro, materiales }
public/js/capacitadora.js # window.VIEWS_CAPACITADORA = { panel, cursos, desbloqueos, alumnos }
```

## Modelo de datos (data/seed.js)

```js
empresas: [
  { id:'emp-ail', nombre:'aiLearning', tipo:'propietaria', color:'#2D88E8', contacto:'hola@ailearning.mx' },
  { id:'emp-conta', nombre:'ContaFlow Capacitación', tipo:'externa', color:'#22A06B', contacto:'cursos@contaflow.mx' },
  { id:'emp-dev', nombre:'DevCamp MX', tipo:'externa', color:'#8B5CF6', contacto:'hola@devcamp.mx' }
]
profesores: [
  { id:'prof-1', nombre:'CP Mariana Gutiérrez', iniciales:'MG', empresaId:'emp-conta', bio:'Contadora pública, 12 años automatizando despachos', avatarGrad:'linear-gradient(135deg,#34C98E,#1F7A55)' },
  { id:'prof-2', nombre:'Ing. Diego Ramos', iniciales:'DR', empresaId:'emp-dev', bio:'Ingeniero de software, ex-startup fintech', avatarGrad:'linear-gradient(135deg,#A78BFA,#6D28D9)' },
  { id:'prof-3', nombre:'Lic. Sofía Herrera', iniciales:'SH', empresaId:'emp-ail', bio:'Diseñadora y consultora de marca', avatarGrad:'linear-gradient(135deg,#5FA8F5,#1A5FB4)' }
]
alumnos: [
  { id:'al-1', nombre:'Jesús Salazar', iniciales:'JS', empresaId:'emp-ail', tipo:'interno', xp:1240, racha:6 },
  { id:'al-2', nombre:'Ana Torres', iniciales:'AT', empresaId:'emp-conta', tipo:'externo', xp:430, racha:2 },
  { id:'al-3', nombre:'Luis Peña', iniciales:'LP', empresaId:'emp-dev', tipo:'externo', xp:820, racha:4 }
]
cursos: [ // 3 cursos, cada uno: profesorId, empresaId (capacitadora dueña)
  { id:'c-conta', slug:'contabilidad-claude', titulo:'Simplifica tus procesos contables con Claude: de 30 días a unas horas',
    profesorId:'prof-1', empresaId:'emp-conta', nivel:'Intermedio', dur:'6 h 20 m', cover:'linear-gradient(135deg,#0E3B2E,#22A06B)',
    desc:'...', modulos:[ { id:'m1', titulo:'Fundamentos', sesiones:[ /* ids */ ] }, ... ],
    sesiones:[ { id:'s-conta-1', modulo:'m1', titulo:'...', tipo:'grabada', dur:14,
        video:{ proveedor:'youtube', id:'aqz-KE-bpKQ' } | { proveedor:'bunny', libraryId:'239255', videoId:'ec1e981b-...' },
        materiales:[ { id:'mat-1', nombre:'Plantilla conciliación.xlsx', tipo:'xlsx', size:'48 KB', url:'#' } ],
        descripcion:'...' }, ... ] }
  // c-app (DevCamp, prof-2), c-web (aiLearning, prof-3)
]
rutas: [ // rutas de aprendizaje = secuencias de cursos/sesiones con metas
  { id:'r-finanzas', titulo:'Finanzas con IA', desc:'...', cursoIds:['c-conta'], color:'#22A06B', icono:'...' },
  { id:'r-builder', titulo:'Builder IA', desc:'...', cursoIds:['c-app','c-web'], color:'#8B5CF6', icono:'...' }
]
sesionesVivo: [ // clases en vivo Zoom
  { id:'v-1', cursoId:'c-conta', titulo:'Q&A: cierres mensuales con Claude', fechaISO:'2026-07-21T19:00:00-06:00',
    zoomUrl:'https://zoom.us/j/98211334455?pwd=demo', zoomId:'982 1133 4455', pass:'ailearn', profesorId:'prof-1', estado:'programada' } // estados: programada|en-vivo|finalizada (calculado por fecha también)
]
foro: [ // hilos por sesión
  { id:'f-1', sesionId:'s-conta-1', autorId:'al-2', autorTipo:'alumno', texto:'...', ts:1752868800000, respuestas:[ { autorId:'prof-1', autorTipo:'profesor', texto:'...', ts:... } ], resuelto:false }
]
desbloqueos: { // gating: alumnos externos solo ven sesiones desbloqueadas por su capacitadora
  // clave `${empresaId}:${cursoId}` -> array de sesionIds desbloqueadas
  'emp-conta:c-conta': ['s-conta-1','s-conta-2'],
  'emp-dev:c-app': ['s-app-1']
}
progreso: { // por alumno: `${alumnoId}:${sesionId}` -> { pct:0-100, completada:bool, ts }
}
```

### Regla de gating (CRÍTICA)
- Alumno `tipo:'interno'` (empresa propietaria emp-ail): acceso a TODAS las sesiones de todos los cursos.
- Alumno `tipo:'externo'`: solo accede a sesiones presentes en `desbloqueos[`${su empresaId}:${cursoId}`]`. Las demás se muestran con candado y chip "BLOQUEADA · pide a tu capacitadora".
- La capacitadora solo puede desbloquear sesiones de cursos cuyo `empresaId` sea el suyo (cursos que renta/posee).

## API REST (todas JSON; prefijo /api)
```
GET  /api/state?alumnoId=al-1        → { alumno, empresas, profesores, cursos (con sesiones anotadas con locked:bool y progreso), rutas, sesionesVivo, notificaciones }
GET  /api/cursos                     → lista con profesor y empresa embebidos
GET  /api/cursos/:id?alumnoId=
GET  /api/foro/:sesionId             → hilos con autor embebido (nombre, iniciales, rol)
POST /api/foro/:sesionId             { autorId, autorTipo, texto } → hilo creado
POST /api/foro/:sesionId/:hiloId/responder  { autorId, autorTipo, texto }
POST /api/foro/:sesionId/:hiloId/resolver   → toggle resuelto
GET  /api/desbloqueos/:empresaId     → { cursoId: [sesionIds] } solo de sus cursos
POST /api/desbloqueos                { empresaId, cursoId, sesionId, unlock:bool } → 403 si el curso no es de esa empresa
POST /api/progreso                   { alumnoId, sesionId, pct } → marca completada si pct>=90, suma XP (+50 por completar, una sola vez)
GET  /api/vivo?cursoId=&empresaId=
GET  /api/empresa/:id/resumen        → para panel capacitadora: cursos propios, alumnos de la empresa con progreso agregado, % desbloqueo
GET  /api/profesor/:id/resumen       → cursos que imparte, hilos sin responder, próximas sesiones vivo
GET  /api/health                     → { ok:true }
```

## Video embeds
- youtube → `https://www.youtube-nocookie.com/embed/{id}?rel=0` en iframe 16:9.
- bunny → `https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?autoplay=false` iframe 16:9.
- Usar IDs reales de YouTube públicos y educativos (ej. aqz-KE-bpKQ Big Buck Bunny, y videos reales de IA/programación conocidos) para que SÍ se visualicen. Para bunny usar el video demo oficial: libraryId 239255, videoId no garantizado → incluir 1 sesión bunny por curso con fallback visual si el iframe falla (mensaje "Video alojado en Bunny Stream").

## Diseño (fidelidad al prototipo v3)
- Tokens y CSS: copiar de `/home/claude/design-tokens.css` (variables :root light/dark, breakpoint 980px con data-r).
- Markup de referencia del shell (sidebar/header/tabbar/inicio): `/home/claude/proto-markup.html`.
- Fuentes Google: Space Grotesk (títulos), DM Sans (cuerpo), JetBrains Mono (chips/labels).
- Colores: --blue #2D88E8, --coral #FF6B47 (CTAs), verde éxito #22A06B.
- Tema claro/oscuro con toggle (localStorage `theme`, html[data-theme]).
- Responsive: ≤980px oculta sidebar/header, muestra topbar móvil + tabbar inferior fija (grid 5 botones). Todo grid multi-col colapsa a 1 col. Player 1 col. Sin overflow-x en 360px.
- Chips estilo JetBrains Mono 9-11px letter-spacing .14-.18em, border-radius 99px. Cards: border-radius 18-22px, border 1px var(--line), shadow var(--shadow).

## Switcher de rol (sin auth)
- Pantalla inicial `#/` = selector: 3 tarjetas ALUMNO (elige entre los 3 alumnos), PROFESOR (3), CAPACITADORA (3 empresas). Guarda selección en localStorage `actor` = { rol, id }.
- Botón en sidebar "Cambiar de rol" siempre visible.
- Rutas hash: `#/alumno/inicio`, `#/alumno/rutas`, `#/alumno/curso/:id`, `#/alumno/leccion/:cursoId/:sesionId`, `#/alumno/vivo`, `#/profesor/...`, `#/capacitadora/...`.

## ADENDUM v2 — Planes de alumno (tipos de alumno)
PLANES = [
  { id:'explorador', tag:'EXPLORADOR', nombre:'Explorador', precio:'$0 MXN', lema:'Conoce la metodología antes de invertir.', features:['Cursos introductorios on-demand','Boletín semanal con casos de uso','Top 10 prompts de productividad ejecutiva','Comunidad pública aiLearning'] },
  { id:'esencial', tag:'ESENCIAL', nombre:'Esencial', precio:'$449 MXN / mes', lema:'IA práctica en tu operación diaria.', features:['Sesiones y cursos en vivo ilimitados','Grabaciones por 7 días','Materiales + biblioteca de prompts base','Comunidad privada aiLearning'] },
  { id:'pro', tag:'AI-NATIVE PRO', nombre:'AI-Native Pro', precio:'$949 MXN / mes', lema:'Diagnóstico, automatización y dominio técnico.', destacado:true, features:['Todo lo de Esencial','Videoteca completa','Flujos, automatizaciones y prompts avanzados','Q&A privado y sesiones con instructores','Certificación digital por ruta completada'] },
  { id:'corporativo', tag:'CORPORATIVO', nombre:'Corporativo', precio:'A la medida', lema:'Implementación privada para equipos y empresas.', features:['Diagnóstico estratégico privado','Capacitación y onboarding privado','Gobierno, métricas y soporte prioritario','Ejecutivo de cuenta'] }
]

### Gating COMBINADO (reemplaza regla anterior)
1. Alumno externo (empresa capacitadora externa) → plan:'corporativo' SIEMPRE; su acceso lo decide SOLO el desbloqueo de su capacitadora (regla original).
2. Alumno interno → acceso por plan:
   - explorador: solo sesiones del PRIMER módulo de cada curso. Sin clases en vivo (botón Zoom bloqueado → lockPlan:'Esencial'). Sin materiales descargables (lockPlan:'Esencial').
   - esencial: todas las sesiones grabadas + vivo + materiales. Foro: puede leer y publicar.
   - pro: todo lo anterior (chip AI-NATIVE PRO).
3. Sesión bloqueada por plan → locked:true + lockReason:'plan' + lockPlan:'Esencial'|'Pro'. Bloqueada por capacitadora → lockReason:'capacitadora'.
4. Alumnos seed: al-1 Jesús plan:'pro'; al-4 NUEVO { id:'al-4', nombre:'Karla Medina', iniciales:'KM', empresaId:'emp-ail', tipo:'interno', plan:'explorador', xp:120, racha:1 }; al-5 NUEVO { id:'al-5', nombre:'Roberto Díaz', iniciales:'RD', empresaId:'emp-ail', tipo:'interno', plan:'esencial', xp:560, racha:3 }; al-2/al-3 plan:'corporativo'.
5. GET /api/planes → PLANES. /api/state incluye alumno.plan y planInfo, y cada sesión { locked, lockReason, lockPlan }.
6. UI: chip de plan bajo el nombre en sidebar (JetBrains Mono azul), vista alumno 'membresia' ("Mi plan"): 4 cards estilo pricing OSCURO (fondo #0A1522/panel siempre, aunque theme claro), card actual con borde azul + chip "TU PLAN", pro con chip "MÁS VALOR", botones demo (toast "Demo: contacta hola@ailearning.mx"). Upsell banner en inicio si plan explorador/esencial (como prototipo). Sesiones bloqueadas por plan: chip coral con el plan requerido; click → go membresia.
