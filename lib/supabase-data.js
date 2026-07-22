'use strict';
/**
 * Capa de datos de la Academia sobre el Supabase canónico (service role).
 * Reemplaza data/db.json. Ver docs/migracion-supabase.md para el mapeo.
 *
 * Produce EXACTAMENTE las mismas formas JSON que el /api/state legacy para no
 * tocar el frontend (public/js/*). Solo se activa con ACADEMIA_DB=supabase.
 */

const { createClient } = require('@supabase/supabase-js');

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase-data: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  _client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return _client;
}

function isEnabled() {
  return (
    process.env.ACADEMIA_DB === 'supabase' &&
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

// ---- Planes ---------------------------------------------------------------
const PLAN_RANK = { explorador: 0, esencial: 1, 'ai-native-pro': 2, corporativo: 2, pro: 2 };
function rank(planId) {
  return PLAN_RANK[planId] != null ? PLAN_RANK[planId] : 0;
}
function planIncludes(userPlan, requiredPlan) {
  if (!requiredPlan) return true;
  return rank(userPlan) >= rank(requiredPlan);
}
// Nombre "bonito" del plan requerido para el candado.
const PLAN_LABEL = { esencial: 'Esencial', 'ai-native-pro': 'AI-Native Pro', corporativo: 'Corporativo' };

// Copys de planes (mismos que el ADENDUM del CONTRACT). Se sirven en /api/planes.
const PLANES_UI = [
  { id: 'explorador', tag: 'EXPLORADOR', nombre: 'Explorador', precio: '$0 MXN', lema: 'Conoce la metodología antes de invertir.', features: ['Cursos introductorios on-demand', 'Boletín semanal con casos de uso', 'Top 10 prompts de productividad ejecutiva', 'Comunidad pública aiLearning'] },
  { id: 'esencial', tag: 'ESENCIAL', nombre: 'Esencial', precio: '$449 MXN / mes', lema: 'IA práctica en tu operación diaria.', features: ['Sesiones y cursos en vivo ilimitados', 'Grabaciones por 7 días', 'Materiales + biblioteca de prompts base', 'Comunidad privada aiLearning'] },
  { id: 'pro', tag: 'AI-NATIVE PRO', nombre: 'AI-Native Pro', precio: '$949 MXN / mes', lema: 'Diagnóstico, automatización y dominio técnico.', destacado: true, features: ['Todo lo de Esencial', 'Videoteca completa', 'Flujos, automatizaciones y prompts avanzados', 'Q&A privado y sesiones con instructores', 'Certificación digital por ruta completada'] },
  { id: 'corporativo', tag: 'CORPORATIVO', nombre: 'Corporativo', precio: 'A la medida', lema: 'Implementación privada para equipos y empresas.', features: ['Diagnóstico estratégico privado', 'Capacitación y onboarding privado', 'Gobierno, métricas y soporte prioritario', 'Ejecutivo de cuenta'] }
];
async function getPlanes() {
  return PLANES_UI;
}

// ---- Helpers de forma ------------------------------------------------------
function inicialesDe(nombre) {
  if (!nombre) return 'AL';
  const parts = nombre.trim().split(/\s+/);
  const a = parts[0] ? parts[0][0] : '';
  const b = parts[1] ? parts[1][0] : (parts[0] && parts[0][1] ? parts[0][1] : '');
  return (a + b).toUpperCase();
}
function fmtDur(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h ${r} m` : `${r} m`;
}
const COVERS = [
  'linear-gradient(135deg,#0E3B2E,#22A06B)',
  'linear-gradient(135deg,#1A2A52,#2D88E8)',
  'linear-gradient(135deg,#3A1E52,#8B5CF6)',
  'linear-gradient(135deg,#4A2418,#FF6B47)'
];
function parseVideo(videoUrl) {
  if (!videoUrl) return null;
  const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { proveedor: 'youtube', id: yt[1] };
  return { proveedor: 'url', url: videoUrl };
}
// autorTipo desde el rol del perfil
function tipoDesdeRol(role) {
  return role === 'instructor' || role === 'capacitadora' ? 'profesor' : 'alumno';
}

// ---- Plan del alumno (entitlement pagado, o token, o explorador) -----------
async function getAccessPlan(userId) {
  const { data } = await client()
    .from('entitlements')
    .select('plan_id, status, ends_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  const ent = data && data[0];
  if (ent && (!ent.ends_at || new Date(ent.ends_at) > new Date())) return ent.plan_id;
  return 'explorador';
}

// ---- SSO find-or-create ----------------------------------------------------
async function ensureAlumno({ sub, email, name, plan, picture }) {
  const db = client();
  const patch = { id: sub, email: email || '', ...(name ? { full_name: name } : {}), ...(picture ? { avatar_url: picture } : {}) };
  const { data, error } = await db
    .from('profiles')
    .upsert(patch, { onConflict: 'id' })
    .select('id, email, full_name, avatar_url, role, xp, streak')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    nombre: data.full_name || (email ? email.split('@')[0] : 'Alumno'),
    iniciales: inicialesDe(data.full_name || email),
    email: data.email,
    avatarUrl: data.avatar_url || null,
    rol: data.role || 'student',
    xp: data.xp || 0,
    racha: data.streak || 0,
    plan: plan || 'explorador'
  };
}

async function touchActividad(userId) {
  const db = client();
  const { data } = await db.from('profiles').select('last_active_date, streak').eq('id', userId).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  if (!data || data.last_active_date === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = data.last_active_date === yesterday ? (data.streak || 0) + 1 : 1;
  await db.from('profiles').update({ last_active_date: today, streak }).eq('id', userId);
}

// ---- Perfil (para /api/state y cabecera) -----------------------------------
async function getAlumno(userId) {
  const { data } = await client()
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, xp, streak')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    nombre: data.full_name || (data.email ? data.email.split('@')[0] : 'Alumno'),
    iniciales: inicialesDe(data.full_name || data.email),
    email: data.email,
    avatarUrl: data.avatar_url || null,
    tipo: 'interno',
    role: data.role || 'student',
    xp: data.xp || 0,
    racha: data.streak || 0
  };
}

// ---- Catálogo de cursos (canónico → forma academia) ------------------------
async function loadCursos() {
  const { data, error } = await client()
    .from('courses')
    .select(`
      id, slug, title, description, level, cover, required_plan_id, status,
      course_modules ( id, title, position,
        lessons ( id, slug, title, summary, body_md, video_url, structured_content, lesson_type, duration_minutes, position, status,
          lesson_resources ( id, title, resource_type, url, storage_key, position )
        )
      )
    `)
    .eq('status', 'published');
  if (error) throw error;

  return (data || []).map((c, idx) => {
    const modulos = (c.course_modules || [])
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        titulo: m.title,
        sesiones: (m.lessons || []).filter((l) => l.status === 'published').sort((a, b) => a.position - b.position).map((l) => l.id)
      }));

    const sesiones = [];
    let totalMin = 0;
    (c.course_modules || []).forEach((m) => {
      (m.lessons || [])
        .filter((l) => l.status === 'published')
        .sort((a, b) => a.position - b.position)
        .forEach((l) => {
          totalMin += l.duration_minutes || 0;
          const sc = l.structured_content || {};
          const video = parseVideo(l.video_url) || (sc.video || null);
          sesiones.push({
            id: l.id,
            modulo: m.id,
            titulo: l.title,
            tipo: l.lesson_type || 'grabada',
            dur: l.duration_minutes || 0,
            video,
            body: l.body_md || null,
            descripcion: sc.descripcion || l.summary || '',
            resumen: sc.resumen || null,
            puntosClave: sc.puntos_clave || null,
            notas: sc.notas || null,
            preguntas: sc.preguntas_pase || null,
            // Pass-through completo (template 7 secciones: promesa/idea_simple/
            // explicacion_seria/precision_experta/ejemplo_guiado/error_comun/
            // pregunta_pensar/mini_ejercicio/comprobacion/origen/video/scorecard).
            // alumno.js decide qué shape renderizar; no rompe lecciones viejas.
            structured_content: sc,
            materiales: (l.lesson_resources || [])
              .sort((a, b) => (a.position || 0) - (b.position || 0))
              .map((r) => ({ id: r.id, nombre: r.title, tipo: r.resource_type, size: '', url: r.url || '#' }))
          });
        });
    });

    return {
      id: c.id,
      slug: c.slug,
      titulo: c.title,
      desc: c.description || '',
      nivel: c.level || 'Todos los niveles',
      dur: fmtDur(totalMin),
      cover: c.cover || COVERS[idx % COVERS.length],
      requiredPlan: c.required_plan_id || 'explorador',
      profesorId: null,
      empresaId: null,
      modulos,
      sesiones
    };
  });
}

function lockStatus(userPlan, curso) {
  const locked = !planIncludes(userPlan, curso.requiredPlan);
  return {
    locked,
    lockReason: locked ? 'plan' : null,
    lockPlan: locked ? (PLAN_LABEL[curso.requiredPlan] || 'Esencial') : null
  };
}

const PROFESOR_DEFAULT = { id: null, nombre: 'aiLearning', iniciales: 'AI', bio: 'Equipo aiLearning', avatarGrad: 'linear-gradient(135deg,#5FA8F5,#1A5FB4)' };

function anotarCurso(curso, userPlan, progresoMap) {
  const status = lockStatus(userPlan, curso);
  return {
    ...curso,
    sesiones: curso.sesiones.map((s) => {
      const p = progresoMap[s.id];
      return {
        ...s,
        locked: status.locked,
        lockReason: status.lockReason,
        lockPlan: status.lockPlan,
        pct: p ? p.pct : 0,
        completada: p ? p.completada : false
      };
    }),
    profesor: PROFESOR_DEFAULT,
    empresa: null
  };
}

async function getProgresoMap(userId) {
  const { data } = await client()
    .from('lesson_progress')
    .select('lesson_id, progress_percent, status, completed_at')
    .eq('user_id', userId);
  const map = {};
  (data || []).forEach((r) => {
    map[r.lesson_id] = { pct: r.progress_percent || 0, completada: r.status === 'completed' || Boolean(r.completed_at) };
  });
  return map;
}

async function getSesionesVivo() {
  const { data } = await client()
    .from('live_sessions')
    .select('id, course_id, title, description, starts_at, ends_at, meeting_url, recording_url, status, meta')
    .order('starts_at', { ascending: true });
  return (data || []).map((v) => ({
    id: v.id,
    cursoId: v.course_id,
    titulo: v.title,
    desc: v.description || '',
    fechaISO: v.starts_at,
    zoomUrl: v.meeting_url || '#',
    zoomId: (v.meta && v.meta.zoomId) || '',
    pass: (v.meta && v.meta.pass) || '',
    grabacionUrl: v.recording_url || null,
    profesorId: null,
    estado: v.status === 'completed' ? 'finalizada' : v.status === 'live' ? 'en-vivo' : 'programada'
  }));
}

// ---- GET /api/state --------------------------------------------------------
async function getStateForAlumno(userId) {
  const alumno = await getAlumno(userId);
  if (!alumno) return null;
  const [userPlan, cursos, progresoMap, sesionesVivo] = await Promise.all([
    getAccessPlan(userId),
    loadCursos(),
    getProgresoMap(userId),
    getSesionesVivo()
  ]);
  alumno.plan = userPlan;
  const cursosAnotados = cursos.map((c) => anotarCurso(c, userPlan, progresoMap));
  const planInfo = PLANES_UI.find((p) => p.id === userPlan) || PLANES_UI[0];
  return {
    alumno,
    planInfo,
    vivoBloqueado: userPlan === 'explorador',
    materialesBloqueados: userPlan === 'explorador',
    empresas: [],
    profesores: [],
    cursos: cursosAnotados,
    rutas: [],
    sesionesVivo,
    notificaciones: []
  };
}

async function getCurso(cursoId, userId) {
  const cursos = await loadCursos();
  const curso = cursos.find((c) => c.id === cursoId || c.slug === cursoId);
  if (!curso) return null;
  if (!userId) return { ...curso, profesor: PROFESOR_DEFAULT, empresa: null };
  const [userPlan, progresoMap] = await Promise.all([getAccessPlan(userId), getProgresoMap(userId)]);
  return anotarCurso(curso, userPlan, progresoMap);
}

// ---- Foro (community_posts / community_replies por lección) ----------------
async function getForo(lessonId) {
  const db = client();
  const { data: posts } = await db
    .from('community_posts')
    .select('id, user_id, body_md, resolved, created_at, profiles:profiles!community_posts_user_id_fkey ( full_name, role )')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });
  const list = posts || [];
  const ids = list.map((p) => p.id);
  let repliesByPost = {};
  if (ids.length) {
    const { data: replies } = await db
      .from('community_replies')
      .select('id, post_id, user_id, body_md, created_at, profiles:profiles!community_replies_user_id_fkey ( full_name, role )')
      .in('post_id', ids)
      .order('created_at', { ascending: true });
    (replies || []).forEach((r) => {
      (repliesByPost[r.post_id] = repliesByPost[r.post_id] || []).push({
        autorId: r.user_id,
        autorTipo: tipoDesdeRol(r.profiles && r.profiles.role),
        texto: r.body_md,
        ts: new Date(r.created_at).getTime(),
        autor: r.profiles ? { id: r.user_id, nombre: r.profiles.full_name, iniciales: inicialesDe(r.profiles.full_name), tipo: tipoDesdeRol(r.profiles.role) } : null
      });
    });
  }
  return list.map((p) => ({
    id: p.id,
    sesionId: lessonId,
    autorId: p.user_id,
    autorTipo: tipoDesdeRol(p.profiles && p.profiles.role),
    texto: p.body_md,
    ts: new Date(p.created_at).getTime(),
    resuelto: Boolean(p.resolved),
    autor: p.profiles ? { id: p.user_id, nombre: p.profiles.full_name, iniciales: inicialesDe(p.profiles.full_name), tipo: tipoDesdeRol(p.profiles.role) } : null,
    respuestas: repliesByPost[p.id] || []
  }));
}

async function crearHilo(lessonId, userId, texto) {
  const { data, error } = await client()
    .from('community_posts')
    .insert({ user_id: userId, lesson_id: lessonId, title: (texto || '').slice(0, 60) || 'Duda', body_md: texto, visibility: 'private', status: 'published' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function responderHilo(postId, userId, texto) {
  const { error } = await client()
    .from('community_replies')
    .insert({ post_id: postId, user_id: userId, body_md: texto, status: 'published' });
  if (error) throw error;
}

async function resolverHilo(postId) {
  const db = client();
  const { data } = await db.from('community_posts').select('resolved').eq('id', postId).maybeSingle();
  const next = !(data && data.resolved);
  await db.from('community_posts').update({ resolved: next }).eq('id', postId);
  return next;
}

// ---- Progreso + XP ---------------------------------------------------------
async function setProgreso(userId, lessonId, pct) {
  const db = client();
  const completed = pct >= 90;
  const { data: prev } = await db
    .from('lesson_progress')
    .select('completed_at, status')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  const yaCompletada = prev && (prev.status === 'completed' || prev.completed_at);
  await db.from('lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      progress_percent: Math.max(0, Math.min(100, Math.round(pct))),
      status: completed ? 'completed' : 'in_progress',
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,lesson_id' }
  );
  // +50 XP la primera vez que se completa
  if (completed && !yaCompletada) {
    const { data: prof } = await db.from('profiles').select('xp').eq('id', userId).maybeSingle();
    await db.from('profiles').update({ xp: (prof && prof.xp ? prof.xp : 0) + 50 }).eq('id', userId);
  }
  return { completada: completed };
}

// ---- Avatar (Supabase Storage bucket `avatars`) ----------------------------
const AVATAR_BUCKET = 'avatars';

// Sube una imagen (data URL) al bucket y guarda la URL pública en el perfil.
// dataUrl null/"" → quita el avatar. Devuelve { avatarUrl }.
async function setAvatar(userId, dataUrl) {
  const db = client();
  if (!dataUrl) {
    await db.from('profiles').update({ avatar_url: null }).eq('id', userId);
    return { avatarUrl: null };
  }
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('Formato de imagen no válido.');
  const mime = m[1];
  const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 3 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 3 MB.');

  const key = `${userId}/${Date.now()}.${ext}`;
  const up = await db.storage.from(AVATAR_BUCKET).upload(key, buffer, { contentType: mime, upsert: true });
  if (up.error) throw new Error('No se pudo subir la imagen: ' + up.error.message);
  const { data: pub } = db.storage.from(AVATAR_BUCKET).getPublicUrl(key);
  const avatarUrl = pub.publicUrl;
  await db.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
  return { avatarUrl };
}

// ---- Roles / usuarios especiales (Hito 5) ---------------------------------
// Roles: 'student' | 'instructor' | 'owner'. Solo owner promueve a instructor.
// El owner se puede sembrar por correo (ACADEMIA_OWNER_EMAILS, coma-separado).
function ownerEmails() {
  return String(process.env.ACADEMIA_OWNER_EMAILS || 'hola@ailearning.mx')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Rol efectivo del usuario: si su correo está en la allowlist de owner, se
// asegura role='owner' en el perfil; si no, devuelve el role guardado.
async function resolveRole(userId, email) {
  const db = client();
  const { data } = await db.from('profiles').select('role, email').eq('id', userId).maybeSingle();
  const mail = (email || (data && data.email) || '').toLowerCase();
  if (mail && ownerEmails().includes(mail)) {
    if (!data || data.role !== 'owner') await db.from('profiles').update({ role: 'owner' }).eq('id', userId);
    return 'owner';
  }
  return (data && data.role) || 'student';
}

async function getRole(userId) {
  const { data } = await client().from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data && data.role) || 'student';
}

// Owner: promueve/degrada por correo. role ∈ {instructor, student}.
async function setRoleByEmail(email, role) {
  const db = client();
  const mail = String(email || '').toLowerCase();
  const { data, error } = await db.from('profiles')
    .update({ role })
    .eq('email', mail)
    .select('id, email, full_name, role');
  if (error) throw error;
  if (!data || !data.length) throw new Error('No hay ningún usuario con ese correo (debe haber iniciado sesión al menos una vez).');
  return data[0];
}

async function listInstructors() {
  const { data } = await client()
    .from('profiles').select('id, email, full_name, role')
    .in('role', ['instructor', 'owner'])
    .order('role', { ascending: true });
  return (data || []).map((p) => ({ id: p.id, email: p.email, nombre: p.full_name, role: p.role }));
}

// ---- Contenido de instructor (crear cursos y subir contenido) -------------
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || ('curso-' + Date.now());
}

// Cursos que imparte un instructor (owner_id). El owner ve todos.
async function listCursosDeInstructor(userId, role) {
  const db = client();
  let q = db.from('courses').select('id, slug, title, description, status, required_plan_id, level, owner_id, created_at');
  if (role !== 'owner') q = q.eq('owner_id', userId);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id, slug: c.slug, titulo: c.title, desc: c.description || '',
    status: c.status, requiredPlan: c.required_plan_id || 'explorador', nivel: c.level || ''
  }));
}

async function crearCurso(userId, { titulo, desc, requiredPlan, nivel }) {
  const db = client();
  const { data, error } = await db.from('courses').insert({
    slug: slugify(titulo) + '-' + Math.random().toString(36).slice(2, 6),
    title: titulo, description: desc || null,
    required_plan_id: requiredPlan || 'explorador',
    level: nivel || null, status: 'draft', owner_id: userId
  }).select('id, slug').single();
  if (error) throw error;
  return { id: data.id, slug: data.slug };
}

// Verifica que el curso sea del instructor (o que sea owner). Lanza si no.
async function assertCursoDe(userId, role, courseId) {
  const { data, error } = await client().from('courses').select('id, owner_id').eq('id', courseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Curso no encontrado.');
  if (role !== 'owner' && data.owner_id !== userId) throw new Error('Ese curso no es tuyo.');
  return data;
}

async function actualizarCurso(userId, role, courseId, patch) {
  await assertCursoDe(userId, role, courseId);
  const upd = {};
  if (patch.titulo != null) upd.title = patch.titulo;
  if (patch.desc != null) upd.description = patch.desc;
  if (patch.requiredPlan != null) upd.required_plan_id = patch.requiredPlan;
  if (patch.nivel != null) upd.level = patch.nivel;
  if (patch.status != null) upd.status = patch.status; // draft|published
  upd.updated_at = new Date().toISOString();
  const { error } = await client().from('courses').update(upd).eq('id', courseId);
  if (error) throw error;
  return { ok: true };
}

async function crearModulo(userId, role, courseId, titulo) {
  await assertCursoDe(userId, role, courseId);
  const db = client();
  const { data: mods } = await db.from('course_modules').select('position').eq('course_id', courseId).order('position', { ascending: false }).limit(1);
  const pos = (mods && mods[0] ? mods[0].position : 0) + 1;
  const { data, error } = await db.from('course_modules').insert({ course_id: courseId, title: titulo, position: pos, status: 'published' }).select('id').single();
  if (error) throw error;
  return { id: data.id };
}

// Crea/actualiza una lección con contenido estructurado.
// structured = template 7 secciones { promesa, idea_simple, explicacion_seria,
//   precision_experta, ejemplo_guiado, error_comun, pregunta_pensar,
//   mini_ejercicio, resumen, comprobacion[], origen, scorecard?, aprobado? }
// (también acepta el shape viejo: descripcion, puntos_clave[], notas, preguntas_pase[])
// Passthrough genérico: todo lo que venga en `structured` se guarda tal cual en
// structured_content (jsonb); `video` (si llega) se mezcla encima como sc.video.
async function guardarLeccion(userId, role, { lessonId, moduleId, titulo, dur, video, structured, status }) {
  const db = client();
  // Autoriza vía el curso dueño del módulo.
  const modId = moduleId || (lessonId ? (await db.from('lessons').select('module_id').eq('id', lessonId).maybeSingle()).data?.module_id : null);
  if (!modId) throw new Error('Falta el módulo.');
  const { data: mod } = await db.from('course_modules').select('course_id').eq('id', modId).maybeSingle();
  if (!mod) throw new Error('Módulo no encontrado.');
  await assertCursoDe(userId, role, mod.course_id);

  const sc = Object.assign({}, structured || {});
  if (video) sc.video = video;
  const fields = {
    title: titulo,
    summary: (structured && structured.resumen) || null,
    duration_minutes: dur || 0,
    structured_content: sc,
    lesson_type: (video && video.proveedor) ? 'grabada' : 'lectura',
    status: status || 'published',
    updated_at: new Date().toISOString()
  };
  if (lessonId) {
    const { error } = await db.from('lessons').update(fields).eq('id', lessonId);
    if (error) throw error;
    return { id: lessonId };
  }
  const { data: ls } = await db.from('lessons').select('position').eq('module_id', modId).order('position', { ascending: false }).limit(1);
  const pos = (ls && ls[0] ? ls[0].position : 0) + 1;
  fields.module_id = modId;
  fields.slug = slugify(titulo) + '-' + Math.random().toString(36).slice(2, 6);
  fields.position = pos;
  const { data, error } = await db.from('lessons').insert(fields).select('id').single();
  if (error) throw error;
  return { id: data.id };
}

// Sube un material (data URL) al bucket `materiales` y lo liga a la lección.
async function subirMaterial(userId, role, lessonId, { nombre, dataUrl, url }) {
  const db = client();
  const { data: ls } = await db.from('lessons').select('module_id').eq('id', lessonId).maybeSingle();
  if (!ls) throw new Error('Lección no encontrada.');
  const { data: mod } = await db.from('course_modules').select('course_id').eq('id', ls.module_id).maybeSingle();
  await assertCursoDe(userId, role, mod.course_id);

  let finalUrl = url || null, storageKey = null, resType = 'link';
  if (dataUrl) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) throw new Error('Archivo no válido.');
    const buffer = Buffer.from(m[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) throw new Error('El material debe pesar menos de 25 MB.');
    const ext = (nombre && nombre.includes('.')) ? nombre.split('.').pop() : (m[1].split('/')[1] || 'bin');
    storageKey = `${lessonId}/${Date.now()}.${ext}`;
    const up = await db.storage.from('materiales').upload(storageKey, buffer, { contentType: m[1], upsert: true });
    if (up.error) throw new Error('No se pudo subir: ' + up.error.message);
    finalUrl = db.storage.from('materiales').getPublicUrl(storageKey).data.publicUrl;
    resType = 'file';
  }
  const { data, error } = await db.from('lesson_resources')
    .insert({ lesson_id: lessonId, title: nombre || 'Material', resource_type: resType, url: finalUrl, storage_key: storageKey })
    .select('id').single();
  if (error) throw error;
  return { id: data.id, url: finalUrl };
}

async function health() {
  const { error } = await client().from('plans').select('id').limit(1);
  return { ok: !error };
}

module.exports = {
  client,
  isEnabled,
  health,
  getPlanes,
  ensureAlumno,
  touchActividad,
  getAlumno,
  getAccessPlan,
  getStateForAlumno,
  getCurso,
  getForo,
  crearHilo,
  responderHilo,
  resolverHilo,
  setProgreso,
  setAvatar,
  // roles / instructor
  ownerEmails,
  resolveRole,
  getRole,
  setRoleByEmail,
  listInstructors,
  listCursosDeInstructor,
  crearCurso,
  actualizarCurso,
  crearModulo,
  guardarLeccion,
  subirMaterial
};
