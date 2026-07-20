# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado: repo LEGACY

Este repo (Express + SQLite/Postgres + JWT propio + restos de Clerk) es la versión anterior de la academia. La plataforma **canónica** vive en el repo hermano `../ailearning-platform` (Next.js + Supabase + Stripe), que ya incluye la academia en `apps/web/src/app/academia/`.

**No agregar funcionalidad nueva aquí.** Solo se consulta como referencia durante la migración incremental (tipos de usuario, rutas de instructor/admin, quizzes, Zoom, notificaciones — features que platform aún no migra).

## Comandos

```bash
npm start        # node server.js (corre migraciones de db/migrations.js al arrancar)
npm run seed     # node db/seed.js
```

## Arquitectura (referencia para la migración)

- `server.js`: Express con helmet/CSP, cors abierto, compression, rate limiting (120 req/min general, 10/min auth), raw body solo para `/api/billing/webhook`, estáticos en `public/`.
- Roles en JWT (`middleware/auth.js`): `student` (default), `instructor`, `admin`. `requireInstructor` acepta admin o instructor. Gating de pago en `middleware/requireActiveSubscription.js`.
- `routes/`: auth, billing (Stripe), courses, lessons, quizzes, sessions (Zoom), progress, prompts, community, notifications, instructor (CRUD de cursos, solo instructor/admin).
- `services/`: scheduler (node-cron), zoom, certificates, achievements, email (Resend).
- Deploy: Railway (`railway.json`, `Dockerfile`).
