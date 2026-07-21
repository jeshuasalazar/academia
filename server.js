const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const dbPath = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(express.static('public'));
app.use(express.json());

// ============ DB Management ============
let db = null;
let saveTimeout = null;

function loadDb() {
  if (fs.existsSync(dbPath)) {
    const content = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(content);
  } else {
    const seed = require('./data/seed.js');
    return JSON.parse(JSON.stringify(seed));
  }
}

function saveDb() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  }, 500);
}

// ============ Helpers ============

function getAlumno(alumnoId) {
  return db.alumnos.find(a => a.id === alumnoId);
}

function getProfesor(profesorId) {
  return db.profesores.find(p => p.id === profesorId);
}

function getEmpresa(empresaId) {
  return db.empresas.find(e => e.id === empresaId);
}

function getCurso(cursoId) {
  return db.cursos.find(c => c.id === cursoId);
}

function getSesion(cursoId, sesionId) {
  const curso = getCurso(cursoId);
  if (!curso) return null;
  return curso.sesiones.find(s => s.id === sesionId);
}

function getProgreso(alumnoId, sesionId) {
  const key = `${alumnoId}:${sesionId}`;
  return db.progreso[key] || null;
}

function setProgreso(alumnoId, sesionId, pct, completada) {
  const key = `${alumnoId}:${sesionId}`;
  db.progreso[key] = { pct, completada, ts: Date.now() };
}

function getPlan(planId) {
  return db.planes.find(p => p.id === planId);
}

function getSesionLockStatus(alumnoId, cursoId, sesionId) {
  // Devuelve { locked, lockReason, lockPlan }
  const alumno = getAlumno(alumnoId);
  if (!alumno) return { locked: true, lockReason: 'not-found', lockPlan: null };

  // Alumno externo: solo por desbloqueos de capacitadora
  if (alumno.tipo === 'externo') {
    const deskey = `${alumno.empresaId}:${cursoId}`;
    const desbloqueadas = db.desbloqueos[deskey] || [];
    const locked = !desbloqueadas.includes(sesionId);
    return { locked, lockReason: 'capacitadora', lockPlan: null };
  }

  // Alumno interno: gating por plan
  const plan = alumno.plan || 'explorador';

  if (plan === 'explorador') {
    // Solo primer módulo de cada curso
    const curso = getCurso(cursoId);
    if (!curso || !curso.modulos || curso.modulos.length === 0) {
      return { locked: false, lockReason: null, lockPlan: null };
    }
    const primerModulo = curso.modulos[0];
    const enPrimerModulo = primerModulo.sesiones.includes(sesionId);

    if (!enPrimerModulo) {
      return { locked: true, lockReason: 'plan', lockPlan: 'Esencial' };
    }
    return { locked: false, lockReason: null, lockPlan: null };
  }

  // esencial y pro: todo desbloqueado
  return { locked: false, lockReason: null, lockPlan: null };
}

function anotarSesion(alumnoId, curso) {
  // Anota cada sesión con locked, lockReason, lockPlan, pct, completada según alumno
  const sesionesAnotadas = curso.sesiones.map(sesion => {
    const lockStatus = getSesionLockStatus(alumnoId, curso.id, sesion.id);
    const progreso = getProgreso(alumnoId, sesion.id);
    return {
      ...sesion,
      locked: lockStatus.locked,
      lockReason: lockStatus.lockReason,
      lockPlan: lockStatus.lockPlan,
      pct: progreso ? progreso.pct : 0,
      completada: progreso ? progreso.completada : false
    };
  });

  return {
    ...curso,
    sesiones: sesionesAnotadas,
    profesor: getProfesor(curso.profesorId),
    empresa: getEmpresa(curso.empresaId)
  };
}

// ============ API Routes ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/planes
app.get('/api/planes', (req, res) => {
  res.json(db.planes);
});

// GET /api/state?alumnoId=
app.get('/api/state', (req, res) => {
  const { alumnoId } = req.query;

  if (!alumnoId) {
    return res.status(400).json({ error: 'alumnoId required' });
  }

  const alumno = getAlumno(alumnoId);
  if (!alumno) {
    return res.status(404).json({ error: 'Alumno no encontrado' });
  }

  // Anota cursos con sesiones desbloqueadas
  const cursosAnotados = db.cursos.map(curso => anotarSesion(alumnoId, curso));

  // Plan info
  const planInfo = getPlan(alumno.plan || 'explorador');
  const vivoBloqueado = alumno.plan === 'explorador';
  const materialesBloqueados = alumno.plan === 'explorador';

  res.json({
    alumno: { ...alumno, plan: alumno.plan },
    planInfo,
    vivoBloqueado,
    materialesBloqueados,
    empresas: db.empresas,
    profesores: db.profesores,
    cursos: cursosAnotados,
    rutas: db.rutas,
    sesionesVivo: db.sesionesVivo,
    notificaciones: db.notificaciones
  });
});

// GET /api/cursos
app.get('/api/cursos', (req, res) => {
  const cursosConDetalles = db.cursos.map(curso => ({
    ...curso,
    profesor: getProfesor(curso.profesorId),
    empresa: getEmpresa(curso.empresaId)
  }));
  res.json(cursosConDetalles);
});

// GET /api/cursos/:id
app.get('/api/cursos/:id', (req, res) => {
  const { id } = req.params;
  const { alumnoId } = req.query;

  const curso = getCurso(id);
  if (!curso) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  if (alumnoId) {
    // Anota sesiones según alumno
    const anotado = anotarSesion(alumnoId, curso);
    return res.json(anotado);
  }

  res.json({
    ...curso,
    profesor: getProfesor(curso.profesorId),
    empresa: getEmpresa(curso.empresaId)
  });
});

// GET /api/foro/:sesionId
app.get('/api/foro/:sesionId', (req, res) => {
  const { sesionId } = req.params;

  const hilos = db.foro.filter(h => h.sesionId === sesionId);

  // Embe autor en cada hilo y respuesta
  const hilosConAutor = hilos.map(hilo => {
    const autorPrincipal = hilo.autorTipo === 'alumno'
      ? getAlumno(hilo.autorId)
      : getProfesor(hilo.autorId);

    const respuestasConAutor = hilo.respuestas.map(resp => {
      const autorResp = resp.autorTipo === 'alumno'
        ? getAlumno(resp.autorId)
        : getProfesor(resp.autorId);
      return {
        ...resp,
        autor: autorResp ? { id: autorResp.id, nombre: autorResp.nombre, iniciales: autorResp.iniciales, tipo: resp.autorTipo } : null
      };
    });

    return {
      ...hilo,
      autor: autorPrincipal ? { id: autorPrincipal.id, nombre: autorPrincipal.nombre, iniciales: autorPrincipal.iniciales, tipo: hilo.autorTipo } : null,
      respuestas: respuestasConAutor
    };
  });

  res.json(hilosConAutor);
});

// POST /api/foro/:sesionId
app.post('/api/foro/:sesionId', (req, res) => {
  const { sesionId } = req.params;
  const { autorId, autorTipo, texto } = req.body;

  if (!autorId || !autorTipo || !texto) {
    return res.status(400).json({ error: 'autorId, autorTipo, texto required' });
  }

  const nuevoHilo = {
    id: `f-${Date.now()}`,
    sesionId,
    autorId,
    autorTipo,
    texto,
    ts: Date.now(),
    respuestas: [],
    resuelto: false
  };

  db.foro.push(nuevoHilo);
  saveDb();

  res.status(201).json(nuevoHilo);
});

// POST /api/foro/:sesionId/:hiloId/responder
app.post('/api/foro/:sesionId/:hiloId/responder', (req, res) => {
  const { sesionId, hiloId } = req.params;
  const { autorId, autorTipo, texto } = req.body;

  if (!autorId || !autorTipo || !texto) {
    return res.status(400).json({ error: 'autorId, autorTipo, texto required' });
  }

  const hilo = db.foro.find(h => h.id === hiloId && h.sesionId === sesionId);
  if (!hilo) {
    return res.status(404).json({ error: 'Hilo no encontrado' });
  }

  const respuesta = {
    autorId,
    autorTipo,
    texto,
    ts: Date.now()
  };

  hilo.respuestas.push(respuesta);
  saveDb();

  res.status(201).json(respuesta);
});

// POST /api/foro/:sesionId/:hiloId/resolver
app.post('/api/foro/:sesionId/:hiloId/resolver', (req, res) => {
  const { sesionId, hiloId } = req.params;

  const hilo = db.foro.find(h => h.id === hiloId && h.sesionId === sesionId);
  if (!hilo) {
    return res.status(404).json({ error: 'Hilo no encontrado' });
  }

  hilo.resuelto = !hilo.resuelto;
  saveDb();

  res.json(hilo);
});

// GET /api/desbloqueos/:empresaId
app.get('/api/desbloqueos/:empresaId', (req, res) => {
  const { empresaId } = req.params;

  const empresa = getEmpresa(empresaId);
  if (!empresa) {
    return res.status(404).json({ error: 'Empresa no encontrada' });
  }

  // Solo devuelve desbloqueos de cursos que pertenecen a esa empresa
  const result = {};
  Object.keys(db.desbloqueos).forEach(key => {
    const [empId, cursoId] = key.split(':');
    if (empId === empresaId) {
      result[key] = db.desbloqueos[key];
    }
  });

  res.json(result);
});

// POST /api/desbloqueos
app.post('/api/desbloqueos', (req, res) => {
  const { empresaId, cursoId, sesionId, unlock } = req.body;

  if (!empresaId || !cursoId || !sesionId || unlock === undefined) {
    return res.status(400).json({ error: 'empresaId, cursoId, sesionId, unlock required' });
  }

  // Verifica que el curso pertenezca a la empresa
  const curso = getCurso(cursoId);
  if (!curso) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  if (curso.empresaId !== empresaId) {
    return res.status(403).json({ error: 'No puedes desbloquear un curso que no te pertenece' });
  }

  const key = `${empresaId}:${cursoId}`;
  if (!db.desbloqueos[key]) {
    db.desbloqueos[key] = [];
  }

  if (unlock) {
    if (!db.desbloqueos[key].includes(sesionId)) {
      db.desbloqueos[key].push(sesionId);
    }
  } else {
    db.desbloqueos[key] = db.desbloqueos[key].filter(s => s !== sesionId);
  }

  saveDb();

  res.json({ ok: true, desbloqueos: db.desbloqueos[key] });
});

// POST /api/progreso
app.post('/api/progreso', (req, res) => {
  const { alumnoId, sesionId, pct } = req.body;

  if (!alumnoId || !sesionId || pct === undefined) {
    return res.status(400).json({ error: 'alumnoId, sesionId, pct required' });
  }

  if (pct < 0 || pct > 100) {
    return res.status(400).json({ error: 'pct must be 0-100' });
  }

  const alumno = getAlumno(alumnoId);
  if (!alumno) {
    return res.status(404).json({ error: 'Alumno no encontrado' });
  }

  const progeso_actual = getProgreso(alumnoId, sesionId);
  let completadaAntes = progeso_actual ? progeso_actual.completada : false;

  let completada = pct >= 90;

  // Si recién se completa (pct>=90 y no estaba completada): suma 50 XP una sola vez
  if (completada && !completadaAntes) {
    alumno.xp += 50;
  }

  setProgreso(alumnoId, sesionId, pct, completada);
  saveDb();

  res.json({ ok: true, xp: alumno.xp, completada });
});

// GET /api/vivo?cursoId=&empresaId=
app.get('/api/vivo', (req, res) => {
  const { cursoId, empresaId } = req.query;

  let sesiones = db.sesionesVivo;

  if (cursoId) {
    sesiones = sesiones.filter(s => s.cursoId === cursoId);
  }

  if (empresaId) {
    // Filtrar por empresas de los cursos
    sesiones = sesiones.filter(s => {
      const curso = getCurso(s.cursoId);
      return curso && curso.empresaId === empresaId;
    });
  }

  res.json(sesiones);
});

// GET /api/empresa/:id/resumen
app.get('/api/empresa/:id/resumen', (req, res) => {
  const { id } = req.params;

  const empresa = getEmpresa(id);
  if (!empresa) {
    return res.status(404).json({ error: 'Empresa no encontrada' });
  }

  // Cursos de la empresa
  const cursosEmpresa = db.cursos.filter(c => c.empresaId === id);

  // Alumnos de la empresa
  const alumnosEmpresa = db.alumnos.filter(a => a.empresaId === id);

  // Para cada alumno: nombre, xp, sesionesCompletadas
  const alumnosConProgreso = alumnosEmpresa.map(alumno => {
    const sesionesCompletadas = Object.keys(db.progreso)
      .filter(key => {
        const [alId, sesId] = key.split(':');
        return alId === alumno.id && db.progreso[key].completada;
      })
      .length;

    return {
      nombre: alumno.nombre,
      xp: alumno.xp,
      sesionesCompletadas
    };
  });

  // Por curso: % de sesiones desbloqueadas
  const cursosConDesbloqueo = cursosEmpresa.map(curso => {
    const key = `${id}:${curso.id}`;
    const desbloqueadas = (db.desbloqueos[key] || []).length;
    const total = curso.sesiones.length;
    const pct = total > 0 ? Math.round((desbloqueadas / total) * 100) : 0;

    return {
      id: curso.id,
      titulo: curso.titulo,
      desbloqueadas,
      total,
      pct
    };
  });

  res.json({
    empresa,
    cursos: cursosConDesbloqueo,
    alumnos: alumnosConProgreso
  });
});

// GET /api/profesor/:id/resumen
app.get('/api/profesor/:id/resumen', (req, res) => {
  const { id } = req.params;

  const profesor = getProfesor(id);
  if (!profesor) {
    return res.status(404).json({ error: 'Profesor no encontrado' });
  }

  // Cursos que imparte
  const cursosProfe = db.cursos.filter(c => c.profesorId === id);

  // Para cada curso: conteo de sesiones y alumnos con progreso
  const cursosConDetalles = cursosProfe.map(curso => {
    const alumnosConProgreso = new Set();
    Object.keys(db.progreso).forEach(key => {
      const [alumnoId, sesionId] = key.split(':');
      // Verifica si sesionId pertenece a este curso
      if (curso.sesiones.find(s => s.id === sesionId)) {
        alumnosConProgreso.add(alumnoId);
      }
    });

    return {
      id: curso.id,
      titulo: curso.titulo,
      sesiones: curso.sesiones.length,
      alumnosEnProgreso: alumnosConProgreso.size
    };
  });

  // Hilos del foro SIN respuesta de este profesor en sus cursos
  const hilosSinRespuesta = db.foro.filter(hilo => {
    // Encuentra la sesión
    const sesionId = hilo.sesionId;
    // Verifica si la sesión está en algún curso del profesor
    const enCursoDelProfe = cursosProfe.some(c => c.sesiones.find(s => s.id === sesionId));

    if (!enCursoDelProfe) return false;

    // Verifica si el profesor ya respondió
    const profesorRespondio = hilo.respuestas.some(r => r.autorId === id && r.autorTipo === 'profesor');
    return !profesorRespondio;
  });

  // Próximas sesionesVivo suyas
  const proximasSesiones = db.sesionesVivo
    .filter(v => v.profesorId === id)
    .sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));

  res.json({
    profesor,
    cursos: cursosConDetalles,
    hilosSinRespuesta: hilosSinRespuesta.map(h => ({
      id: h.id,
      sesionId: h.sesionId,
      autorNombre: getAlumno(h.autorId)?.nombre || 'Desconocido',
      texto: h.texto.substring(0, 100) + '...'
    })),
    proximasSesiones
  });
});

// ============ SSO desde ailearning.mx ============

// Mapeo plan plataforma → plan del catálogo local (data/seed.js PLANES)
const SSO_PLAN_MAP = {
  explorador: 'explorador',
  esencial: 'esencial',
  'ai-native-pro': 'pro',
  corporativo: 'pro'
};

// Verifica un JWT compacto HS256 con crypto de Node (sin dependencias).
// Devuelve { ok: true, payload } o { ok: false, reason }.
function verifySsoToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'formato-invalido' };
  const [headB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(headB64, 'base64url').toString('utf-8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
  } catch (e) {
    return { ok: false, reason: 'json-invalido' };
  }

  // No confiar en el header para elegir algoritmo: solo se acepta HS256
  if (!header || header.alg !== 'HS256') return { ok: false, reason: 'alg-no-soportado' };

  const expected = crypto.createHmac('sha256', secret)
    .update(`${headB64}.${payloadB64}`)
    .digest();
  const given = Buffer.from(sigB64, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'firma-invalida' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || now >= payload.exp) return { ok: false, reason: 'expirado' };
  if (payload.iss !== 'ailearning-platform') return { ok: false, reason: 'iss-invalido' };
  if (payload.aud !== 'academia') return { ok: false, reason: 'aud-invalido' };
  if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'sub-faltante' };

  return { ok: true, payload };
}

function inicialesDe(nombre) {
  const ini = String(nombre || '').trim().split(/\s+/)
    .map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return ini || 'AL';
}

app.get('/sso', (req, res) => {
  const secret = process.env.ACADEMIA_SSO_SECRET;
  const token = req.query.token;

  if (!secret) {
    console.warn('[sso] ACADEMIA_SSO_SECRET no configurado; redirigiendo a /');
    return res.redirect('/');
  }
  if (!token || typeof token !== 'string') {
    console.warn('[sso] falta ?token=; redirigiendo a /');
    return res.redirect('/');
  }

  const result = verifySsoToken(token, secret);
  if (!result.ok) {
    console.warn(`[sso] token rechazado (${result.reason}); redirigiendo a /`);
    return res.redirect('/');
  }

  const payload = result.payload;
  const email = String(payload.email || '').toLowerCase();
  const plan = SSO_PLAN_MAP[payload.plan] || 'explorador';

  // Find-or-create del alumno (por ssoSub o por email, case-insensitive)
  let alumno = db.alumnos.find(a => a.ssoSub === payload.sub)
    || (email && db.alumnos.find(a => a.email && a.email.toLowerCase() === email));

  if (!alumno) {
    const shortHash = crypto.createHash('sha256').update(payload.sub).digest('hex').slice(0, 8);
    const nombre = payload.name || email || 'Alumno aiLearning';
    alumno = {
      id: `al-sso-${shortHash}`,
      nombre,
      iniciales: inicialesDe(nombre),
      email,
      ssoSub: payload.sub,
      empresaId: 'emp-ail',
      tipo: 'interno',
      plan,
      xp: 0,
      racha: 0
    };
    db.alumnos.push(alumno);
    saveDb();
  } else {
    let dirty = false;
    if (alumno.plan !== plan) { alumno.plan = plan; dirty = true; }
    if (!alumno.ssoSub) { alumno.ssoSub = payload.sub; dirty = true; }
    if (!alumno.email && email) { alumno.email = email; dirty = true; }
    if (dirty) saveDb();
  }

  // Misma clave y forma que usa el switcher del front (public/js/core.js):
  // localStorage.setItem('actor', JSON.stringify({ rol, id }))
  const actorValue = JSON.stringify({ rol: 'alumno', id: alumno.id });
  const actorLiteral = JSON.stringify(actorValue)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  // Bienvenida de una sola vez (leída y borrada por public/js/alumno.js en la vista "inicio")
  const welcomeValue = JSON.stringify({ nombre: alumno.nombre, plan: alumno.plan });
  const welcomeLiteral = JSON.stringify(welcomeValue)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  res.set('Cache-Control', 'no-store');
  res.send(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Entrando a aiLearning Academia…</title></head>
<body>
<p>Entrando a aiLearning Academia…</p>
<script>
  localStorage.setItem('actor', ${actorLiteral});
  sessionStorage.setItem('sso_welcome', ${welcomeLiteral});
  location.replace('/#/alumno');
</script>
</body>
</html>`);
});

// ============ Startup ============

db = loadDb();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Academia server running on http://localhost:${PORT}`);
});
