# aiLearning Academia

Plataforma de academia multi-tenant: aiLearning renta la plataforma a empresas capacitadoras que imparten sus propios cursos.

## Características
- 3 interfaces: **Alumno**, **Profesor**, **Empresa capacitadora** (selector de rol, sin auth por ahora).
- Rutas de aprendizaje, cursos con módulos y sesiones grabadas (YouTube embed + Bunny Stream).
- Clases en vivo vía Zoom (unirse, .ics a calendario, estado en-vivo/programada/finalizada).
- Foro de dudas por sesión (hilos, respuestas de profesor, marcar resuelto).
- Materiales descargables por sesión.
- Gating combinado:
  - Alumnos **externos** (de capacitadoras): solo ven clases desbloqueadas por su empresa.
  - Alumnos **internos**: por plan — Explorador ($0), Esencial ($449), AI-Native Pro ($949), Corporativo.
- Progreso + XP por sesión completada. Tema claro/oscuro. 100% responsivo (breakpoint 980px, tabbar móvil).

## Correr local
```bash
npm install
npm start   # http://localhost:3000
```

## Deploy en Railway
Repo listo: Nixpacks detecta Node, `npm start` arranca el server (usa `process.env.PORT`). Healthcheck: `/api/health`.
La base de datos demo es `data/db.json` (se regenera desde `data/seed.js` si no existe; está en .gitignore).

## Estructura
```
server.js          API Express + estáticos
data/seed.js       Datos demo (3 cursos, profesores, empresas, foro, vivo)
public/            SPA vanilla (core, alumno, profesor, capacitadora)
```
