# Migración de la Academia: `data/db.json` → Supabase (Hito 2)

La academia deja de guardar estado en `data/db.json` (memoria, no escala) y pasa a
leer/escribir el **Supabase canónico de la plataforma** (`tubtizicrzxxdjscvjsm`)
vía **service role** (server-side). La app queda **stateless → escala horizontal**.
La identidad sigue llegando por SSO; la cuenta vive en la plataforma.

## Variables de entorno (Railway `academia_ailmx`)
- `SUPABASE_URL` = `https://tubtizicrzxxdjscvjsm.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (service role del proyecto; NO exponer al cliente)
- `ACADEMIA_DB` = `supabase` (flag; `json` mantiene el comportamiento viejo para rollback)
- `ACADEMIA_SSO_SECRET` = (ya existe)

## Mapeo de modelo (seed.js → tablas canónicas)

| Academia (db.json)        | Tabla/campos canónicos |
|---------------------------|------------------------|
| `empresas` (capacitadoras)| `organizations` (name, slug, website, industry, size_range, billing_email). Color/tipo → sin columna: `industry`/metadata o se deriva. |
| `profesores`              | `profiles` con `role='instructor'` + `organization_members` (org de la capacitadora). bio/iniciales/avatarGrad → `full_name`, `avatar_url`. |
| `alumnos`                 | `profiles` (`role='student'`), `xp`, `streak`, `last_active_date` (0010). tipo interno/externo → membresía en `organizations` (externo = miembro de capacitadora). plan → `entitlements`/`plan_intent`. |
| `cursos`                  | `courses` (slug, title, description, status, required_plan_id) + `owner_id` (profesor), `organization_id` (capacitadora dueña), `level`, `cover` (0010). |
| `cursos[].modulos`        | `course_modules` (course_id, title, position, status). |
| `cursos[].sesiones`       | `lessons` (module_id, slug, title, summary=resumen, video_url, duration_minutes, position, status) + `structured_content` jsonb {descripcion, resumen, puntos_clave[], notas, preguntas_pase[], video:{proveedor,id/libraryId/videoId}} + `lesson_type` (0010). |
| `sesiones[].materiales`   | `lesson_resources` (lesson_id, title, resource_type, url, storage_key, position). |
| `rutas`                   | (fase posterior) tabla `academia_rutas` o metadata; no bloquea el core. |
| `sesionesVivo`            | `live_sessions` (course_id, title, starts_at, ends_at, meeting_url=zoomUrl, recording_url, status) + `host_id`, `meta`{zoomId,pass} (0010). |
| `foro`                    | `community_posts` (user_id, title, body_md, `lesson_id`, `resolved` — 0010) + `community_replies` (post_id, user_id, body_md). autorTipo se deriva de `profiles.role`. |
| `desbloqueos`             | `academia_lesson_unlocks` (organization_id, lesson_id) — 0010. |
| `progreso`                | `lesson_progress` (user_id, lesson_id, status, progress_percent, completed_at). XP → `profiles.xp`. |
| `planes`                  | `plans` (ya sembrada: explorador/esencial/ai-native-pro/corporativo). Copys de UI se quedan en el front. |

## Reglas que se preservan
- **Gating por plan** (server-side, `getSesionLockStatus`): alumno interno explorador = solo primer módulo; esencial/pro = todo. Externo = solo lecciones en `academia_lesson_unlocks` de su organización.
- **Contenido de pago protegido** (0009): `video_url/body_md/structured_content`, `lesson_resources.url/storage_key`, `live_sessions.meeting_url/recording_url` se sirven solo vía service role tras validar plan.
- **Superficie de API intacta**: las rutas `/api/*` del `CONTRACT.md` no cambian; solo su implementación pasa a Supabase.

## IMPORTANTE: no hay seed — se reusa el contenido canónico existente
La migración `0007_seed_academia_content` YA sembró el contenido REAL de producción
que sirve `ailearning.mx/academia` (4 cursos publicados con `required_plan_id`,
8 módulos, 24 lecciones, 24 materiales, 6 clases en vivo, 10 inscripciones). El
`data/seed.js` de la academia externa era **demo desechable**. La academia externa
**lee estas mismas tablas** — NO se re-siembra (evita duplicar/contaminar la
plataforma). `organizations`/`academia_lesson_unlocks` están vacías hasta que exista
una capacitadora real (Hito 5).

### Gating simplificado (nivel curso, no primer-módulo)
El contenido real usa `courses.required_plan_id` (explorador/esencial/ai-native-pro).
El gating de la academia = `planIncludes(planDelToken, course.required_plan_id)`.
El plan llega en el JWT SSO (`plan` = accessPlanId), así que NO hay que consultar
entitlements en la academia. Se elimina la regla vieja "explorador = solo primer
módulo" del seed demo.

## Rollout (orden)
1. Aplicar migración `0010_academia_operacional.sql` a prod. ✅ HECHO Y VERIFICADO.
2. `npm install @supabase/supabase-js` en la academia.
3. Setear envs Supabase en Railway `academia_ailmx` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACADEMIA_DB=supabase`).
4. `server.js` lee el contenido canónico vía `lib/supabase-data.js` (flag `ACADEMIA_DB`; `json` = rollback legacy).
5. Verificar `/api/health`, `/api/state`, SSO, foro, progreso; luego ≥2 réplicas.
