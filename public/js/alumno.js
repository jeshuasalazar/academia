/* ============ aiLearning Academia — alumno.js ============
   window.VIEWS_ALUMNO = { inicio, rutas, curso, leccion, vivo, foro, materiales }
============================================================ */
(function () {
  'use strict';

  /* ---------------- estado / carga ---------------- */

  async function loadState(force) {
    const id = (window.ACTOR && window.ACTOR.id) || 'al-1';
    if (!force && window._state && window._state.alumnoId === id) return window._state.data;
    const data = await API.get('/api/state?alumnoId=' + encodeURIComponent(id));
    window._state = { alumnoId: id, data };
    return data;
  }

  function maps(state) {
    const empresaById = {}; (state.empresas || []).forEach(e => empresaById[e.id] = e);
    const profesorById = {}; (state.profesores || []).forEach(p => profesorById[p.id] = p);
    const cursoById = {}; (state.cursos || []).forEach(c => cursoById[c.id] = c);
    return { empresaById, profesorById, cursoById };
  }

  function inicialesDe(nombre) {
    const p = String(nombre || '').trim().split(/\s+/);
    if (!p.length || !p[0]) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }

  /* ---------------- nivel / xp ---------------- */

  const NIVEL_NOMBRES = ['Iniciando', 'Explorador', 'Practicante', 'Constructor', 'Especialista', 'Maestro'];
  function nivelInfo(xp) {
    xp = xp || 0;
    const per = 500;
    const nivelNum = Math.floor(xp / per) + 1;
    const dentro = xp % per;
    const pct = Math.round((dentro / per) * 100);
    const nombre = NIVEL_NOMBRES[Math.min(nivelNum - 1, NIVEL_NOMBRES.length - 1)];
    const next = NIVEL_NOMBRES[Math.min(nivelNum, NIVEL_NOMBRES.length - 1)];
    return { nivelNum, pct, nombre, next, faltan: per - dentro };
  }

  /* ---------------- helpers de curso ---------------- */

  function modulesWithSessions(curso) {
    if (curso.modulos && curso.modulos.length) {
      return curso.modulos.map(m => {
        const ids = Array.isArray(m.sesiones) ? m.sesiones : [];
        const sesiones = ids.map(sid => (curso.sesiones || []).find(s => s.id === sid) || (typeof sid === 'object' ? sid : null)).filter(Boolean);
        return { id: m.id, titulo: m.titulo, sesiones };
      });
    }
    return [{ id: 'm-unica', titulo: 'Contenido', sesiones: curso.sesiones || [] }];
  }

  function flatSessions(curso) {
    const mods = modulesWithSessions(curso);
    const out = [];
    mods.forEach(m => m.sesiones.forEach(s => out.push(s)));
    return out;
  }

  function cursoProgresoPct(curso) {
    const ses = curso.sesiones || [];
    if (!ses.length) return 0;
    const completas = ses.filter(s => s.progreso && s.progreso.completada).length;
    return Math.round((completas / ses.length) * 100);
  }

  function cursoTodoBloqueado(curso) {
    const ses = curso.sesiones || [];
    return ses.length > 0 && ses.every(s => s.locked);
  }

  function sesionMark(s) {
    if (s.progreso && s.progreso.completada) return { mark: '✓', bg: 'rgba(34,160,107,.12)', color: '#22A06B', border: 'rgba(34,160,107,.35)', txt: 'COMPLETADA', txtColor: '#22A06B' };
    if (s.locked) {
      const txt = s.lockReason === 'plan' ? String(s.lockPlan || 'ESENCIAL').toUpperCase() : 'BLOQUEADA';
      return { mark: '🔒', bg: 'var(--bg2)', color: 'var(--mute)', border: 'var(--line)', txt, txtColor: 'var(--coral)' };
    }
    return { mark: '▶', bg: 'var(--bluesoft)', color: 'var(--blue)', border: 'rgba(45,136,232,.35)', txt: 'DISPONIBLE', txtColor: 'var(--blue)' };
  }

  function lockedAttrs(s) {
    return 'data-locked="1" data-lock-reason="' + esc(s.lockReason || 'capacitadora') + '" data-lock-plan="' + esc(s.lockPlan || 'Esencial') + '"';
  }

  function materialIcon(tipo) {
    return ICON('file', 17);
  }

  function fmtDurMin(min) { return min + ' min'; }

  /* ---------------- video embed ---------------- */

  function videoEmbedHtml(video) {
    if (!video) return '<div class="player-fallback">Video no disponible.</div>';
    if (video.proveedor === 'youtube') {
      return '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(video.id) + '?rel=0" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }
    if (video.proveedor === 'bunny') {
      const src = 'https://iframe.mediadelivery.net/embed/' + esc(video.libraryId) + '/' + esc(video.videoId) + '?autoplay=false';
      return '<iframe src="' + src + '" title="Video" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"></iframe>' +
        '<div class="player-fallback" style="display:none;position:absolute;inset:0">' + ICON('video', 30) + '<span>Video alojado en Bunny Stream</span></div>';
    }
    return '<div class="player-fallback">Formato de video no soportado.</div>';
  }

  /* ================= VISTA: inicio ================= */

  async function vistaInicio(root) {
    root.innerHTML = '<div class="empty-state">Cargando tu inicio…</div>';
    const state = await loadState();
    const { empresaById, profesorById } = maps(state);
    const alumno = state.alumno || {};
    const nivel = nivelInfo(alumno.xp);

    const cursos = state.cursos || [];
    let continuar = cursos.find(c => {
      const pct = cursoProgresoPct(c);
      return pct > 0 && pct < 100 && !cursoTodoBloqueado(c);
    }) || cursos.find(c => !cursoTodoBloqueado(c)) || cursos[0];

    let contSesion = null;
    if (continuar) {
      const flat = flatSessions(continuar);
      contSesion = flat.find(s => !s.locked && !(s.progreso && s.progreso.completada)) || flat.find(s => !s.locked) || flat[0];
    }

    const ruta = (state.rutas || []).find(r => continuar && r.cursoIds && r.cursoIds.indexOf(continuar.id) !== -1);

    const UPSELL_MSGS = {
      explorador: 'Estás explorando lo esencial. Con Esencial desbloqueas todos los cursos, clases en vivo y materiales.',
      esencial: 'Vas construyendo el hábito. AI-Native Pro te da videoteca completa y Q&A privado con instructores.'
    };
    const upsellMsg = UPSELL_MSGS[alumno.plan];
    const planTag = (state.planInfo && state.planInfo.tag) || (window.PLAN_TAGS && window.PLAN_TAGS[alumno.plan]) || 'CORPORATIVO';

    const now = Date.now();
    const vivos = (state.sesionesVivo || []).slice().sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));
    const proximaVivo = vivos.find(v => new Date(v.fechaISO).getTime() >= now) || vivos[0];

    let cd = { d: '00', h: '00', m: '00', s: '00' };
    if (proximaVivo) {
      const diff = Math.max(0, new Date(proximaVivo.fechaISO).getTime() - now);
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      cd = { d: String(d).padStart(2, '0'), h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0'), s: String(s).padStart(2, '0') };
    }

    function cursoCardHtml(c) {
      const emp = empresaById[c.empresaId] || {};
      const prof = profesorById[c.profesorId] || {};
      const pct = cursoProgresoPct(c);
      const bloqueado = cursoTodoBloqueado(c);
      return '<button class="course-card" data-go="#/alumno/curso/' + esc(c.id) + '">' +
        '<span class="course-card-cover" style="background:' + esc(c.cover || 'linear-gradient(135deg,#2D88E8,#1A5FB4)') + '">' +
          (bloqueado ? '<span style="background:rgba(10,21,34,.5);border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#fff">' + ICON('lock', 14) + '</span>' : '') +
        '</span>' +
        '<span class="course-card-body">' +
          '<span class="empresa-chip" style="color:' + esc(emp.color || 'var(--blue)') + ';border-color:' + esc(emp.color || 'var(--blue)') + '55">' + esc(emp.nombre || '') + '</span>' +
          '<span style="font-size:15px;font-weight:700;color:var(--ink);line-height:1.35">' + esc(c.titulo) + '</span>' +
          '<span style="display:flex;align-items:center;gap:8px">' +
            '<span class="avatar sm" style="width:22px;height:22px;font-size:9px;' + (prof.avatarGrad ? 'background:' + esc(prof.avatarGrad) : '') + '">' + esc(prof.iniciales || inicialesDe(prof.nombre)) + '</span>' +
            '<span style="font-size:12px;color:var(--mute)">' + esc(prof.nombre || '') + '</span>' +
          '</span>' +
          '<span style="display:flex;align-items:center;gap:10px">' +
            '<span class="progress-track sm"><span class="progress-fill" style="width:' + pct + '%"></span></span>' +
            '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:var(--mute)">' + pct + '%</span>' +
          '</span>' +
        '</span>' +
        '</button>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:28px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<span class="chip-mono">' + esc(fmtFechaLarga(new Date())) + '</span>' +
          '<h1 class="h1">Hola, ' + esc((alumno.nombre || '').split(' ')[0] || alumno.nombre || '') + '</h1>' +
          '<div class="level-bar-row">' +
            '<span style="font-size:14px;color:var(--mute)">Nivel ' + nivel.nivelNum + ' · ' + esc(nivel.nombre) + '</span>' +
            '<span class="progress-track sm" style="flex:none;width:130px"><span class="progress-fill" style="width:' + nivel.pct + '%"></span></span>' +
            '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--mute)">' + nivel.pct + '% rumbo a ' + esc(nivel.next) + '</span>' +
          '</div>' +
        '</div>' +

        (upsellMsg ? (
        '<div class="upsell-card">' +
          '<span style="position:relative;flex:1;min-width:240px;display:flex;flex-direction:column;gap:3px">' +
            '<span class="chip-mono" style="color:#8FC4FA">ESTÁS EN PLAN ' + esc(planTag) + '</span>' +
            '<span style="font-size:14.5px;font-weight:600;line-height:1.45">' + esc(upsellMsg) + '</span>' +
          '</span>' +
          '<button class="btn btn-blue" style="position:relative" data-go="#/alumno/membresia">Ver planes →</button>' +
        '</div>'
        ) : '') +

        '<div class="grid-conti">' +
          (continuar ? (
          '<div class="card-lg" style="overflow:hidden;display:flex;flex-direction:column">' +
            '<div class="course-cover" style="background:' + esc(continuar.cover || 'linear-gradient(135deg,#2D88E8,#1A5FB4)') + '">' +
              '<span class="course-cover-badge">CONTINÚA DONDE TE QUEDASTE</span>' +
            '</div>' +
            '<div style="padding:22px 24px 24px;display:flex;flex-direction:column;gap:12px;flex:1">' +
              '<span class="chip-mono">' + esc(ruta ? ruta.titulo : '') + '</span>' +
              '<span class="h2">' + esc(continuar.titulo) + '</span>' +
              '<div style="display:flex;align-items:center;gap:10px">' +
                '<span class="progress-track"><span class="progress-fill" style="width:' + cursoProgresoPct(continuar) + '%"></span></span>' +
                '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--mute)">' + cursoProgresoPct(continuar) + '%</span>' +
              '</div>' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:auto;padding-top:6px">' +
                (contSesion ? '<button class="btn btn-coral" data-go="#/alumno/leccion/' + esc(continuar.id) + '/' + esc(contSesion.id) + '">Continuar lección · ' + fmtDurMin(contSesion.dur || 0) + '</button>' : '') +
                '<button class="btn btn-ghost" data-go="#/alumno/curso/' + esc(continuar.id) + '">Ver el curso</button>' +
              '</div>' +
            '</div>' +
          '</div>'
          ) : '<div class="card-lg" style="padding:24px"><div class="empty-state">Aún no tienes cursos asignados.</div></div>') +

          (proximaVivo ? (
          '<div class="panel-dark" style="padding:24px;display:flex;flex-direction:column;gap:14px">' +
            '<span style="position:relative;display:flex;align-items:center;gap:8px;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;letter-spacing:.16em;color:#8FC4FA;font-weight:600"><span class="dot-blink"></span>PRÓXIMA CLASE EN VIVO</span>' +
            '<span style="position:relative;font-family:\'Space Grotesk\',sans-serif;font-size:20px;font-weight:600;letter-spacing:-.02em;line-height:1.25">' + esc(proximaVivo.titulo) + '</span>' +
            '<span style="position:relative;font-size:13.5px;color:#C6D0DF">' + esc(fmtFechaCorta(proximaVivo.fechaISO)) + '</span>' +
            '<div style="position:relative;display:flex;gap:8px">' +
              ['d', 'h', 'm', 's'].map(k => '<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 4px">' +
                '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:600">' + cd[k] + '</span>' +
                '<span style="font-family:\'JetBrains Mono\',monospace;font-size:9px;letter-spacing:.12em;color:#8B96A8">' + ({ d: 'DÍAS', h: 'HRS', m: 'MIN', s: 'SEG' })[k] + '</span></span>').join('') +
            '</div>' +
            '<button class="btn btn-blue" style="position:relative;margin-top:auto" data-zoom="' + esc(proximaVivo.zoomUrl) + '">Unirme por Zoom</button>' +
            '<button class="btn btn-ghost" style="position:relative;background:transparent;border-color:rgba(255,255,255,.25);color:#fff" data-go="#/alumno/vivo">Ver detalles</button>' +
          '</div>'
          ) : '<div class="panel-dark" style="padding:24px"><div class="empty-state" style="color:#C6D0DF">No hay clases en vivo programadas.</div></div>') +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:14px">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">' +
            '<span class="chip-mono">Mis cursos</span>' +
          '</div>' +
          '<div class="grid-3">' + cursos.map(cursoCardHtml).join('') + '</div>' +
        '</div>' +
      '</div>';

    wireCommon(root);

    // Bienvenida de una sola vez tras entrar por SSO (ver server.js /sso)
    try {
      const rawWelcome = sessionStorage.getItem('sso_welcome');
      if (rawWelcome) {
        const welcome = JSON.parse(rawWelcome);
        const nombreBienvenida = (welcome.nombre || '').split(' ')[0] || welcome.nombre || 'Alumno';
        const planTagBienvenida = (window.PLAN_TAGS && window.PLAN_TAGS[welcome.plan]) || welcome.plan || '';
        toast('¡Bienvenido, ' + nombreBienvenida + '! Tu plan ' + planTagBienvenida + ' ya está activo.');
        sessionStorage.removeItem('sso_welcome');
      }
    } catch (e) {}
  }

  /* ================= VISTA: rutas ================= */

  async function vistaRutas(root) {
    root.innerHTML = '<div class="empty-state">Cargando rutas…</div>';
    const state = await loadState();
    const { cursoById } = maps(state);
    const rutas = state.rutas || [];

    function rutaBlock(r, idx) {
      const cursos = (r.cursoIds || []).map(id => cursoById[id]).filter(Boolean);
      const items = cursos.map((c, i) => {
        const pct = cursoProgresoPct(c);
        const bloqueado = cursoTodoBloqueado(c);
        return '<div class="timeline-item">' +
          '<span class="timeline-circle">' + (i + 1) + '</span>' +
          (i < cursos.length - 1 ? '<span class="timeline-line"></span>' : '') +
          '<div class="timeline-content card" style="padding:18px 20px;display:flex;flex-direction:column;gap:10px">' +
            '<span style="font-size:15px;font-weight:700;color:var(--ink)">' + esc(c.titulo) + '</span>' +
            '<span style="display:flex;align-items:center;gap:10px">' +
              '<span class="progress-track sm"><span class="progress-fill" style="width:' + pct + '%"></span></span>' +
              '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:var(--mute)">' + pct + '%</span>' +
            '</span>' +
            (bloqueado
              ? '<span class="chip-blocked" style="width:fit-content">BLOQUEADA</span>'
              : '<button class="btn btn-blue btn-sm" style="align-self:flex-start" data-go="#/alumno/curso/' + esc(c.id) + '">' + (pct > 0 ? 'Continuar' : 'Empezar') + ' →</button>') +
          '</div>' +
        '</div>';
      }).join('');
      return '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:16px">' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
          '<span class="chip-mono" style="color:' + esc(r.color || 'var(--blue)') + '">RUTA ' + (idx + 1) + '</span>' +
          '<span class="h2">' + esc(r.titulo) + '</span>' +
          '<span class="p">' + esc(r.desc || '') + '</span>' +
        '</div>' +
        '<div class="timeline">' + (items || '<div class="empty-state">Esta ruta aún no tiene cursos.</div>') + '</div>' +
      '</div>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:26px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:10px;max-width:640px">' +
          '<span class="chip-mono">Rutas de aprendizaje</span>' +
          '<h1 class="h1">Tu camino, paso a paso.</h1>' +
          '<p class="p">Cursos encadenados con una meta clara. Completa uno para desbloquear el siguiente tramo.</p>' +
        '</div>' +
        (rutas.length ? rutas.map(rutaBlock).join('') : '<div class="empty-state">Aún no hay rutas configuradas.</div>') +
      '</div>';

    wireCommon(root);
  }

  /* ================= VISTA: curso ================= */

  async function vistaCurso(root, params) {
    const cursoId = params[0];
    root.innerHTML = '<div class="empty-state">Cargando curso…</div>';
    const state = await loadState();
    const { empresaById, profesorById } = maps(state);
    const curso = (state.cursos || []).find(c => c.id === cursoId);
    if (!curso) { root.innerHTML = '<div class="empty-state">No encontramos este curso.</div>'; return; }

    const emp = empresaById[curso.empresaId] || {};
    const prof = profesorById[curso.profesorId] || {};
    const mods = modulesWithSessions(curso);
    const pct = cursoProgresoPct(curso);

    function moduloHtml(m, mi) {
      const rows = m.sesiones.map((s, si) => {
        const info = sesionMark(s);
        const clickable = !s.locked;
        return '<button class="lesson-row" ' + (clickable ? 'data-go="#/alumno/leccion/' + esc(curso.id) + '/' + esc(s.id) + '"' : lockedAttrs(s)) + '>' +
          '<span class="lesson-mark" style="background:' + info.bg + ';color:' + info.color + ';border-color:' + info.border + '">' + info.mark + '</span>' +
          '<span class="lesson-info">' +
            '<span class="lesson-title" style="color:' + (s.locked ? 'var(--mute)' : 'var(--ink)') + '">' + esc(s.titulo) + '</span>' +
            '<span class="lesson-meta">' + (s.dur || 0) + ' MIN · +50 XP' + (s.locked ? ' · <span class="chip-blocked" style="margin-left:4px">' + esc(s.lockReason === 'plan' ? String(s.lockPlan || 'Esencial').toUpperCase() : 'BLOQUEADA') + '</span>' : '') + '</span>' +
          '</span>' +
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:.1em;color:' + info.txtColor + '">' + info.txt + '</span>' +
        '</button>';
      }).join('');
      return '<div class="mod-card">' +
        '<div class="mod-head"><span class="h3">' + esc(m.titulo) + '</span><span class="chip-mono mute">' + m.sesiones.length + ' SESIONES</span></div>' +
        '<div>' + rows + '</div>' +
      '</div>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:24px;animation:fadeUp .4s ease-out">' +
        '<button class="btn-ghost" style="align-self:flex-start;background:none;border:none;color:var(--mute);padding:0;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px" data-go="#/alumno/rutas">← Todas las rutas</button>' +
        '<div class="grid-hero2">' +
          '<div style="background:' + esc(curso.cover || 'linear-gradient(135deg,#2D88E8,#1A5FB4)') + ';border-radius:22px;padding:28px;color:#fff;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden;min-height:220px">' +
            '<span class="empresa-chip" style="color:#fff;border-color:rgba(255,255,255,.5);width:fit-content">' + esc(emp.nombre || '') + '</span>' +
            '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1.1">' + esc(curso.titulo) + '</span>' +
            '<span style="font-size:14px;line-height:1.55;max-width:460px;opacity:.92">' + esc(curso.desc || '') + '</span>' +
            '<span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto">' +
              '<span class="chip" style="color:#fff;border-color:rgba(255,255,255,.4)">' + esc(curso.nivel || '') + '</span>' +
              '<span class="chip" style="color:#fff;border-color:rgba(255,255,255,.4)">' + esc(curso.dur || '') + '</span>' +
              '<span class="chip" style="color:#fff;border-color:rgba(255,255,255,.4)">' + (curso.sesiones || []).length + ' SESIONES</span>' +
            '</span>' +
          '</div>' +
          '<div class="card" style="padding:24px;display:flex;flex-direction:column;gap:14px">' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<span class="avatar" style="' + (prof.avatarGrad ? 'background:' + esc(prof.avatarGrad) : '') + '">' + esc(prof.iniciales || inicialesDe(prof.nombre)) + '</span>' +
              '<span style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:700;font-size:14.5px">' + esc(prof.nombre || '') + '</span><span style="font-size:12.5px;color:var(--mute)">' + esc(prof.bio || '') + '</span></span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px">' +
              '<span class="progress-track lg"><span class="progress-fill" style="width:' + pct + '%"></span></span>' +
              '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:20px;font-weight:600">' + pct + '%</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="accordion">' + mods.map(moduloHtml).join('') + '</div>' +
      '</div>';

    wireCommon(root);
  }

  /* ================= VISTA: leccion ================= */

  // Render amigable del contenido estructurado de una sesión (resumen, puntos
  // clave, notas, y quiz "preguntas para pasar de clase"). Solo muestra lo que
  // el instructor haya cargado.
  function sesionEstructuraHtml(sesion) {
    const bloques = [];
    if (sesion.resumen) {
      bloques.push('<div><span class="chip-mono">Resumen de la sesión</span>' +
        '<p class="p" style="margin-top:8px">' + esc(sesion.resumen) + '</p></div>');
    }
    if (sesion.puntosClave && sesion.puntosClave.length) {
      bloques.push('<div><span class="chip-mono">Puntos importantes</span>' +
        '<ul style="margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">' +
        sesion.puntosClave.map(function (p) { return '<li class="p" style="margin:0">' + esc(p) + '</li>'; }).join('') +
        '</ul></div>');
    }
    if (sesion.notas) {
      bloques.push('<div><span class="chip-mono">Notas</span>' +
        '<p class="p" style="margin-top:8px;white-space:pre-wrap">' + esc(sesion.notas) + '</p></div>');
    }
    let quiz = '';
    if (sesion.preguntas && sesion.preguntas.length) {
      quiz = '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px" data-quiz>' +
        '<span class="chip-mono">Preguntas para pasar de clase</span>' +
        sesion.preguntas.map(function (q, qi) {
          return '<div data-q="' + qi + '" data-correcta="' + (q.correcta != null ? q.correcta : -1) + '">' +
            '<p class="p" style="font-weight:600;margin:0 0 8px">' + (qi + 1) + '. ' + esc(q.q || q.pregunta || '') + '</p>' +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
            (q.opciones || []).map(function (op, oi) {
              return '<button class="btn btn-ghost btn-sm" style="justify-content:flex-start;text-align:left" data-opt="' + oi + '">' + esc(op) + '</button>';
            }).join('') +
            '</div><span class="quiz-fb" style="font-size:12.5px;margin-top:6px;display:none"></span>' +
            '</div>';
        }).join('') +
        '</div>';
    }
    if (!bloques.length && !quiz) return '';
    const info = bloques.length
      ? '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:16px">' + bloques.join('') + '</div>'
      : '';
    return info + quiz;
  }

  function wireQuiz(root) {
    root.querySelectorAll('[data-quiz] [data-q]').forEach(function (qEl) {
      const correcta = parseInt(qEl.getAttribute('data-correcta'), 10);
      const fb = qEl.querySelector('.quiz-fb');
      qEl.querySelectorAll('[data-opt]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const oi = parseInt(btn.getAttribute('data-opt'), 10);
          const ok = oi === correcta;
          fb.style.display = 'block';
          fb.style.color = ok ? 'var(--ok, #22A06B)' : 'var(--coral)';
          fb.textContent = ok ? '✓ ¡Correcto!' : 'Revisa de nuevo — intenta otra opción.';
          qEl.querySelectorAll('[data-opt]').forEach(function (b) { b.style.borderColor = ''; });
          btn.style.borderColor = ok ? 'var(--ok, #22A06B)' : 'var(--coral)';
        });
      });
    });
  }

  async function vistaLeccion(root, params) {
    const [cursoId, sesionId] = params;
    root.innerHTML = '<div class="empty-state">Cargando lección…</div>';
    const state = await loadState();
    const { profesorById } = maps(state);
    const curso = (state.cursos || []).find(c => c.id === cursoId);
    if (!curso) { root.innerHTML = '<div class="empty-state">No encontramos este curso.</div>'; return; }
    const flat = flatSessions(curso);
    const idx = flat.findIndex(s => s.id === sesionId);
    const sesion = idx !== -1 ? flat[idx] : null;
    if (!sesion) { root.innerHTML = '<div class="empty-state">No encontramos esta lección.</div>'; return; }

    if (sesion.locked) {
      const esPlan = sesion.lockReason === 'plan';
      root.innerHTML = '<div class="empty-state">🔒 Esta clase está bloqueada.<br>' +
        (esPlan
          ? 'Disponible desde el plan ' + esc(sesion.lockPlan || 'Esencial') + '.'
          : 'Pide a tu capacitadora desbloquear esta clase.') +
        '<br><br><button class="btn ' + (esPlan ? 'btn-blue' : 'btn-ghost') + '" ' + (esPlan ? 'data-go="#/alumno/membresia"' : 'data-go="#/alumno/curso/' + esc(cursoId) + '"') + '">' +
        (esPlan ? 'Ver planes →' : '← Volver al curso') + '</button></div>';
      wireCommon(root);
      if (esPlan) toast('Disponible desde el plan ' + (sesion.lockPlan || 'Esencial'));
      return;
    }

    const prof = profesorById[curso.profesorId] || {};
    const mods = modulesWithSessions(curso);
    const modActual = mods.find(m => m.sesiones.some(s => s.id === sesion.id)) || mods[0];
    const prevS = idx > 0 ? flat[idx - 1] : null;
    const nextS = idx < flat.length - 1 ? flat[idx + 1] : null;
    const completed = !!(sesion.progreso && sesion.progreso.completada);

    let foro = [];
    try { foro = await API.get('/api/foro/' + encodeURIComponent(sesion.id)); } catch (e) { foro = []; }

    function autorLabel(autorTipo, autorId, embed) {
      if (embed && (embed.nombre || embed.autorNombre)) {
        return { nombre: embed.nombre || embed.autorNombre, iniciales: embed.iniciales || embed.autorIniciales || inicialesDe(embed.nombre || embed.autorNombre) };
      }
      if (autorTipo === 'profesor') {
        const p = profesorById[autorId] || {};
        return { nombre: p.nombre || 'Profesor', iniciales: p.iniciales || inicialesDe(p.nombre) };
      }
      if (window.ACTOR && autorId === window.ACTOR.id && state.alumno) {
        return { nombre: state.alumno.nombre, iniciales: state.alumno.iniciales || inicialesDe(state.alumno.nombre) };
      }
      return { nombre: 'Alumno', iniciales: '??' };
    }

    function respuestaHtml(r) {
      const a = autorLabel(r.autorTipo, r.autorId, r);
      return '<div class="foro-reply">' +
        '<div class="foro-meta"><span class="avatar sm" style="width:24px;height:24px;font-size:10px">' + esc(a.iniciales) + '</span>' +
        '<span class="foro-name">' + esc(a.nombre) + '</span>' +
        (r.autorTipo === 'profesor' ? '<span class="chip-teacher">PROFESOR</span>' : '') +
        '<span class="foro-time">' + (r.ts ? fmtFechaCorta(new Date(r.ts).toISOString()) : '') + '</span></div>' +
        '<span class="foro-text">' + esc(r.texto) + '</span>' +
      '</div>';
    }

    function hiloHtml(h) {
      const a = autorLabel(h.autorTipo, h.autorId, h);
      return '<div class="foro-thread" data-hilo="' + esc(h.id) + '">' +
        '<div class="foro-head">' +
          '<span class="avatar sm">' + esc(a.iniciales) + '</span>' +
          '<div class="foro-body">' +
            '<div class="foro-meta">' +
              '<span class="foro-name">' + esc(a.nombre) + '</span>' +
              (h.autorTipo === 'profesor' ? '<span class="chip-teacher">PROFESOR</span>' : '') +
              (h.resuelto ? '<span class="chip-solved">RESUELTO</span>' : '') +
              '<span class="foro-time">' + (h.ts ? fmtFechaCorta(new Date(h.ts).toISOString()) : '') + '</span>' +
            '</div>' +
            '<span class="foro-text">' + esc(h.texto) + '</span>' +
            (h.respuestas || []).map(respuestaHtml).join('') +
            '<div style="margin-top:8px">' +
              '<button class="btn btn-ghost btn-sm" data-toggle-reply="' + esc(h.id) + '">Responder</button>' +
            '</div>' +
            '<div class="foro-input-row" data-reply-box="' + esc(h.id) + '" style="display:none">' +
              '<textarea class="foro-textarea" rows="2" placeholder="Escribe tu respuesta…"></textarea>' +
              '<button class="btn btn-coral btn-sm" data-send-reply="' + esc(h.id) + '">Enviar</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:20px;animation:fadeUp .4s ease-out">' +
        '<button style="align-self:flex-start;background:none;border:none;color:var(--mute);font-size:13.5px;font-weight:600;cursor:pointer;padding:0;display:flex;align-items:center;gap:7px" data-go="#/alumno/curso/' + esc(cursoId) + '">← ' + esc(curso.titulo) + '</button>' +
        '<div class="grid-player">' +
          '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
            '<div class="player-wrap">' + videoEmbedHtml(sesion.video) + '</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px">' +
              '<span class="chip-mono">' + esc(curso.titulo) + ' · ' + esc(modActual.titulo) + '</span>' +
              '<h1 class="h1" style="font-size:28px">' + esc(sesion.titulo) + '</h1>' +
              '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;letter-spacing:.08em;color:var(--mute)">' + (sesion.dur || 0) + ' MIN · +50 XP</span>' +
              '<p class="p">' + esc(sesion.descripcion || '') + '</p>' +
            '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
              '<button class="btn ' + (completed ? 'btn-ghost' : 'btn-coral') + '" data-complete="' + esc(sesion.id) + '" ' + (completed ? 'disabled' : '') + '>' + (completed ? '✓ Completada' : 'Marcar completada') + '</button>' +
              (nextS ? '<button class="btn btn-ghost" data-go="#/alumno/leccion/' + esc(cursoId) + '/' + esc(nextS.id) + '">Siguiente lección →</button>' : '') +
            '</div>' +
            sesionEstructuraHtml(sesion) +
            '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:14px">' +
              '<span class="chip-mono">Materiales de esta sesión</span>' +
              (state.materialesBloqueados
                ? '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
                    '<span class="material-icon">' + ICON('lock', 16) + '</span>' +
                    '<span style="flex:1;min-width:180px;font-size:13px;color:var(--mute)">Los materiales descargables están disponibles desde el plan Esencial.</span>' +
                    '<button class="btn btn-ghost btn-sm" data-go="#/alumno/membresia">Ver planes →</button>' +
                  '</div>'
                : (sesion.materiales && sesion.materiales.length
                    ? sesion.materiales.map(m => '<div class="material-row"><span class="material-icon">' + materialIcon(m.tipo) + '</span>' +
                        '<span class="material-info"><span class="material-name">' + esc(m.nombre) + '</span><span class="material-size">' + esc(m.tipo || '').toUpperCase() + ' · ' + esc(m.size || '') + '</span></span>' +
                        '<a class="btn btn-ghost btn-sm" href="' + esc(m.url || '#') + '" target="_blank" rel="noopener">Descargar</a></div>').join('')
                    : '<div class="empty-state">No hay materiales para esta sesión.</div>')) +
            '</div>' +
            '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:6px">' +
              '<span class="chip-mono">Foro de la sesión</span>' +
              (foro.length ? foro.map(hiloHtml).join('') : '<div class="empty-state">Aún no hay dudas en esta sesión — sé el primero en preguntar.</div>') +
              '<div class="foro-input-row" style="margin-top:14px">' +
                '<textarea class="foro-textarea" id="foro-nueva" rows="2" placeholder="Escribe tu duda…"></textarea>' +
                '<button class="btn btn-coral btn-sm" id="foro-publicar">Publicar duda</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="sidebar-r">' +
            '<div class="sidebar-r-head"><span class="chip-mono mute">' + esc(modActual.titulo).toUpperCase() + '</span></div>' +
            '<div style="display:flex;flex-direction:column;max-height:420px;overflow-y:auto">' +
              modActual.sesiones.map(s => {
                const info = sesionMark(s);
                const cur = s.id === sesion.id;
                return '<button class="lesson-row" style="padding:11px 20px" ' + (s.locked ? lockedAttrs(s) : 'data-go="#/alumno/leccion/' + esc(cursoId) + '/' + esc(s.id) + '"') + (cur ? ' data-on="on"' : '') + '>' +
                  '<span class="lesson-mark sm" style="background:' + info.bg + ';color:' + info.color + ';border-color:' + info.border + '">' + info.mark + '</span>' +
                  '<span class="lesson-info"><span class="lesson-title" style="font-size:13px">' + esc(s.titulo) + '</span></span>' +
                  '<span class="chip-mono mute">' + (s.dur || 0) + 'm</span>' +
                '</button>';
              }).join('') +
            '</div>' +
            '<div style="display:flex;gap:8px;padding:14px 16px;border-top:1px solid var(--line2)">' +
              (prevS ? '<button class="btn btn-ghost btn-sm" style="flex:1" data-go="#/alumno/leccion/' + esc(cursoId) + '/' + esc(prevS.id) + '">← Anterior</button>' : '<span style="flex:1"></span>') +
              (nextS ? '<button class="btn btn-ghost btn-sm" style="flex:1" data-go="#/alumno/leccion/' + esc(cursoId) + '/' + esc(nextS.id) + '">Siguiente →</button>' : '<span style="flex:1"></span>') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    wireCommon(root);
    wireQuiz(root);

    const completeBtn = root.querySelector('[data-complete]');
    if (completeBtn) completeBtn.addEventListener('click', async () => {
      completeBtn.disabled = true;
      try {
        const res = await API.post('/api/progreso', { alumnoId: (window.ACTOR || {}).id, sesionId: sesion.id, pct: 100 });
        toast('+' + (res && res.xpGanado ? res.xpGanado : 50) + ' XP');
        await loadState(true);
        await vistaLeccion(root, params);
        if (window._refreshShell) window._refreshShell();
      } catch (e) {
        toast('No se pudo marcar como completada');
        completeBtn.disabled = false;
      }
    });

    root.querySelectorAll('[data-toggle-reply]').forEach(el => el.addEventListener('click', () => {
      const id = el.getAttribute('data-toggle-reply');
      const box = root.querySelector('[data-reply-box="' + id + '"]');
      if (box) box.style.display = box.style.display === 'none' ? 'flex' : 'none';
    }));

    root.querySelectorAll('[data-send-reply]').forEach(el => el.addEventListener('click', async () => {
      const id = el.getAttribute('data-send-reply');
      const box = root.querySelector('[data-reply-box="' + id + '"]');
      const ta = box.querySelector('textarea');
      const texto = (ta.value || '').trim();
      if (!texto) return;
      el.disabled = true;
      try {
        await API.post('/api/foro/' + encodeURIComponent(sesion.id) + '/' + encodeURIComponent(id) + '/responder', { autorId: (window.ACTOR || {}).id, autorTipo: 'alumno', texto });
        await vistaLeccion(root, params);
      } catch (e) { toast('No se pudo enviar tu respuesta'); el.disabled = false; }
    }));

    const pubBtn = root.querySelector('#foro-publicar');
    if (pubBtn) pubBtn.addEventListener('click', async () => {
      const ta = root.querySelector('#foro-nueva');
      const texto = (ta.value || '').trim();
      if (!texto) return;
      pubBtn.disabled = true;
      try {
        await API.post('/api/foro/' + encodeURIComponent(sesion.id), { autorId: (window.ACTOR || {}).id, autorTipo: 'alumno', texto });
        await vistaLeccion(root, params);
      } catch (e) { toast('No se pudo publicar tu duda'); pubBtn.disabled = false; }
    });
  }

  /* ================= VISTA: vivo ================= */

  function icsDataUri(v, cursoTitulo) {
    const dt = new Date(v.fechaISO);
    const end = new Date(dt.getTime() + 60 * 60000);
    function fmt(d) { return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; }
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      'UID:' + v.id + '@ailearning.mx', 'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(dt), 'DTEND:' + fmt(end),
      'SUMMARY:' + (v.titulo || '') + ' — ' + (cursoTitulo || ''),
      'DESCRIPTION:Zoom: ' + (v.zoomUrl || ''),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(ics);
  }

  async function vistaVivo(root) {
    root.innerHTML = '<div class="empty-state">Cargando clases en vivo…</div>';
    const state = await loadState();
    const { cursoById, profesorById } = maps(state);
    const now = Date.now();
    const vivoBloqueado = !!state.vivoBloqueado;

    function estadoCalc(v) {
      const t = new Date(v.fechaISO).getTime();
      if (t <= now && now <= t + 90 * 60000) return 'en-vivo';
      if (t > now) return 'programada';
      return 'finalizada';
    }

    const todas = (state.sesionesVivo || []).map(v => ({ v, estado: estadoCalc(v) }));
    const enVivo = todas.find(x => x.estado === 'en-vivo');
    const proximas = todas.filter(x => x.estado === 'programada').sort((a, b) => new Date(a.v.fechaISO) - new Date(b.v.fechaISO));
    const pasadas = todas.filter(x => x.estado === 'finalizada').sort((a, b) => new Date(b.v.fechaISO) - new Date(a.v.fechaISO));

    function zoomBtn(v, big) {
      if (vivoBloqueado) {
        return '<button class="btn ' + (big ? 'btn-ghost' : 'btn-ghost btn-sm') + '" data-go="#/alumno/membresia" data-vivo-lock="1" style="align-self:' + (big ? 'flex-start' : 'auto') + '">' +
          ICON('lock', 14) + '<span class="chip-blocked" style="margin-left:6px">ESENCIAL</span></button>';
      }
      return '<button class="btn ' + (big ? 'btn-coral' : 'btn-blue btn-sm') + '" style="' + (big ? 'align-self:flex-start' : '') + '" data-zoom="' + esc(v.zoomUrl) + '">' + (big ? 'Entrar a Zoom' : 'Unirme por Zoom') + '</button>';
    }

    function rowHtml(x, pasada) {
      const v = x.v;
      const curso = cursoById[v.cursoId] || {};
      const prof = profesorById[v.profesorId] || {};
      return '<div class="card" style="padding:18px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px">' +
          '<span style="font-weight:700;font-size:14.5px;color:var(--ink)">' + esc(v.titulo) + '</span>' +
          '<span style="font-size:12.5px;color:var(--mute)">' + esc(curso.titulo || '') + ' · ' + esc(prof.nombre || '') + '</span>' +
          '<span class="chip-mono mute">' + esc(fmtFechaCorta(v.fechaISO)) + '</span>' +
        '</div>' +
        (pasada
          ? '<button class="btn btn-ghost btn-sm" data-recording="' + esc(v.cursoId) + '">Ver grabación</button>'
          : (zoomBtn(v, false) +
             (vivoBloqueado ? '' : '<a class="btn btn-ghost btn-sm" href="' + icsDataUri(v, curso.titulo) + '" download="clase-' + esc(v.id) + '.ics">Agregar a calendario</a>'))) +
      '</div>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:26px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">' +
          '<span class="chip-mono">Clases en vivo</span>' +
          '<h1 class="h1">Aprende en tiempo real.</h1>' +
        '</div>' +
        (vivoBloqueado ? '<div class="upsell-card"><span style="position:relative;flex:1;min-width:240px;display:flex;flex-direction:column;gap:3px">' +
          '<span class="chip-mono" style="color:#8FC4FA">PLAN EXPLORADOR</span>' +
          '<span style="font-size:14.5px;font-weight:600;line-height:1.45">Las clases en vivo están disponibles desde el plan Esencial.</span></span>' +
          '<button class="btn btn-blue" style="position:relative" data-go="#/alumno/membresia">Ver planes →</button></div>' : '') +
        (enVivo ? (
          '<div class="card-lg" style="padding:24px;border-color:var(--coral);display:flex;flex-direction:column;gap:12px">' +
            '<span style="display:flex;align-items:center;gap:8px;font-family:\'JetBrains Mono\',monospace;font-size:10.5px;letter-spacing:.16em;color:var(--coral);font-weight:600"><span class="dot-blink"></span>EN VIVO AHORA</span>' +
            '<span class="h2">' + esc(enVivo.v.titulo) + '</span>' +
            zoomBtn(enVivo.v, true) +
          '</div>'
        ) : '') +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<span class="chip-mono">Próximas</span>' +
          (proximas.length ? proximas.map(x => rowHtml(x, false)).join('') : '<div class="empty-state">No hay próximas clases en vivo.</div>') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<span class="chip-mono mute">Pasadas</span>' +
          (pasadas.length ? pasadas.map(x => rowHtml(x, true)).join('') : '<div class="empty-state">Aún no hay clases pasadas.</div>') +
        '</div>' +
      '</div>';

    wireCommon(root);

    root.querySelectorAll('[data-vivo-lock]').forEach(el => el.addEventListener('click', () => toast('Disponible desde el plan Esencial')));

    root.querySelectorAll('[data-recording]').forEach(el => el.addEventListener('click', () => {
      const cursoId = el.getAttribute('data-recording');
      const curso = cursoById[cursoId];
      if (!curso) { toast('No encontramos la grabación'); return; }
      const grabada = flatSessions(curso).find(s => s.tipo === 'grabada' && !s.locked);
      if (grabada) go('#/alumno/leccion/' + cursoId + '/' + grabada.id);
      else toast('La grabación aún no está disponible para ti');
    }));
  }

  /* ================= VISTA: foro (agregado) ================= */

  async function vistaForo(root) {
    root.innerHTML = '<div class="empty-state">Cargando foro…</div>';
    const state = await loadState();
    const cursos = state.cursos || [];
    const accesibles = [];
    cursos.forEach(c => (c.sesiones || []).forEach(s => { if (!s.locked) accesibles.push({ curso: c, sesion: s }); }));

    const results = await Promise.all(accesibles.map(async x => {
      try { const hilos = await API.get('/api/foro/' + encodeURIComponent(x.sesion.id)); return { ...x, hilos }; }
      catch (e) { return { ...x, hilos: [] }; }
    }));

    const porCurso = {};
    results.forEach(r => {
      if (!r.hilos.length) return;
      if (!porCurso[r.curso.id]) porCurso[r.curso.id] = { curso: r.curso, items: [] };
      r.hilos.forEach(h => porCurso[r.curso.id].items.push({ sesion: r.sesion, hilo: h }));
    });

    const grupos = Object.values(porCurso);

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:24px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">' +
          '<span class="chip-mono">Foro de dudas</span>' +
          '<h1 class="h1">Todas tus preguntas, en un lugar.</h1>' +
        '</div>' +
        (grupos.length ? grupos.map(g =>
          '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' +
            '<span class="h3">' + esc(g.curso.titulo) + '</span>' +
            g.items.map(it => '<button class="lesson-row" style="padding:12px 0" data-go="#/alumno/leccion/' + esc(g.curso.id) + '/' + esc(it.sesion.id) + '">' +
              '<span class="lesson-info"><span class="lesson-title">' + esc(it.hilo.texto).slice(0, 90) + '</span>' +
              '<span class="lesson-meta">' + esc(it.sesion.titulo) + (it.hilo.resuelto ? ' · RESUELTO' : '') + '</span></span>' +
            '</button>').join('') +
          '</div>'
        ).join('') : '<div class="empty-state">Aún no hay dudas en tus cursos — sé el primero en preguntar.</div>') +
      '</div>';

    wireCommon(root);
  }

  /* ================= VISTA: materiales ================= */

  async function vistaMateriales(root) {
    root.innerHTML = '<div class="empty-state">Cargando materiales…</div>';
    const state = await loadState();
    const cursos = state.cursos || [];
    const bloqueado = !!state.materialesBloqueados;

    function grupoHtml(c) {
      const mats = [];
      (c.sesiones || []).forEach(s => { if (!s.locked && s.materiales) s.materiales.forEach(m => mats.push({ m, s })); });
      if (!mats.length) return '';
      return '<div class="card" style="padding:8px 0 12px;display:flex;flex-direction:column">' +
        '<span class="h3" style="padding:14px 22px 8px">' + esc(c.titulo) + '</span>' +
        mats.map(x => '<div class="material-row" style="padding:12px 22px">' +
          '<span class="material-icon">' + (bloqueado ? ICON('lock', 16) : materialIcon(x.m.tipo)) + '</span>' +
          '<span class="material-info"><span class="material-name">' + esc(x.m.nombre) + '</span><span class="material-size">' + esc(x.s.titulo) + ' · ' + esc(x.m.size || '') + '</span></span>' +
          (bloqueado
            ? '<button class="btn btn-ghost btn-sm" data-go="#/alumno/membresia">Ver planes →</button>'
            : '<a class="btn btn-ghost btn-sm" href="' + esc(x.m.url || '#') + '" target="_blank" rel="noopener">Descargar</a>') +
        '</div>').join('') +
      '</div>';
    }

    const blocks = cursos.map(grupoHtml).filter(Boolean);

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:22px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">' +
          '<span class="chip-mono">Materiales</span>' +
          '<h1 class="h1">Todo lo descargable, en un lugar.</h1>' +
        '</div>' +
        (bloqueado ? '<div class="upsell-card"><span style="position:relative;flex:1;min-width:240px;display:flex;flex-direction:column;gap:3px">' +
          '<span class="chip-mono" style="color:#8FC4FA">PLAN EXPLORADOR</span>' +
          '<span style="font-size:14.5px;font-weight:600;line-height:1.45">Descarga materiales y plantillas desde el plan Esencial.</span></span>' +
          '<button class="btn btn-blue" style="position:relative" data-go="#/alumno/membresia">Ver planes →</button></div>' : '') +
        (blocks.length ? blocks.join('') : '<div class="empty-state">Aún no tienes materiales disponibles.</div>') +
      '</div>';

    wireCommon(root);
  }

  /* ================= VISTA: membresia ================= */

  const CATEGORIA_PLAN = { explorador: 'GRATIS', esencial: 'SUSCRIPCIÓN', pro: 'SUSCRIPCIÓN', corporativo: 'VENTAS' };

  async function vistaMembresia(root) {
    root.innerHTML = '<div class="empty-state">Cargando planes…</div>';
    const state = await loadState();
    let planes = [];
    try { planes = await API.get('/api/planes'); } catch (e) { planes = []; }
    const currentPlanId = state.alumno && state.alumno.plan;

    function planCard(p) {
      const isCurrent = p.id === currentPlanId;
      const isPro = !!p.destacado || p.id === 'pro';
      const isFree = p.id === 'explorador' || p.id === 'corporativo';
      const categoria = CATEGORIA_PLAN[p.id] || '';
      const btnLabel = isCurrent ? 'Tu plan actual' : (p.id === 'explorador' ? 'Empezar gratis' : (p.id === 'corporativo' ? 'Hablar con ventas' : 'Elegir plan'));
      const btnStyle = isFree
        ? 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)'
        : 'background:linear-gradient(90deg,#2D88E8,#5FA8F5);color:#fff;border:none';
      return '<div style="position:relative;background:rgba(255,255,255,.04);border:' + (isCurrent ? '1.5px solid #2D88E8' : '1px solid rgba(255,255,255,.12)') + ';border-radius:20px;padding:28px 22px 24px;display:flex;flex-direction:column;gap:14px;min-width:0">' +
        (isPro ? '<span style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--coral);color:#fff;border-radius:99px;padding:5px 14px;font-family:\'JetBrains Mono\',monospace;font-size:9.5px;font-weight:700;letter-spacing:.08em;white-space:nowrap">MÁS VALOR</span>' : '') +
        (isCurrent ? '<span style="position:absolute;top:16px;right:16px;border:1px solid #2D88E8;color:#5FA8F5;border-radius:99px;padding:3px 10px;font-family:\'JetBrains Mono\',monospace;font-size:8.5px;letter-spacing:.1em;font-weight:700">TU PLAN</span>' : '') +
        '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:.16em;color:#5FA8F5;font-weight:600">' + esc(categoria) + '</span>' +
        '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:600;letter-spacing:-.02em;color:#fff">' + esc(p.nombre) + '</span>' +
        '<span style="font-size:13px;line-height:1.5;color:rgba(255,255,255,.65);min-height:38px">' + esc(p.lema || '') + '</span>' +
        '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:26px;font-weight:700;color:#fff;letter-spacing:-.02em">' + esc(p.precio || '') + '</span>' +
        '<button class="btn btn-sm" style="' + btnStyle + '" data-plan-demo="1">' + esc(btnLabel) + '</button>' +
        '<div style="display:flex;flex-direction:column;gap:9px;margin-top:6px">' +
          (p.features || []).map(f => '<span style="display:flex;align-items:flex-start;gap:9px;font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.82)">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5FA8F5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:2px"><path d="M5 12.5 10 17.5 19 7"></path></svg>' +
            esc(f) + '</span>').join('') +
        '</div>' +
      '</div>';
    }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:22px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-width:640px">' +
          '<span class="chip-mono">Mi plan</span>' +
          '<h1 class="h1">Elige cómo quieres avanzar.</h1>' +
        '</div>' +
        '<div style="background:#0A1522;border-radius:24px;padding:40px 24px;position:relative;overflow:hidden">' +
          '<div style="position:absolute;inset:0;background:radial-gradient(circle at 85% -10%, rgba(45,136,232,.35), transparent 55%)"></div>' +
          '<div style="position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">' +
            (planes.length ? planes.map(planCard).join('') : '<span style="color:rgba(255,255,255,.7);grid-column:1/-1;text-align:center">No pudimos cargar los planes.</span>') +
          '</div>' +
          '<p style="position:relative;text-align:center;color:rgba(255,255,255,.6);font-size:13px;line-height:1.6;margin:28px 0 0">¿No sabes cuál elegir? Empieza gratis o agenda 30 minutos y te orientamos sin costo.</p>' +
        '</div>' +
      '</div>';

    wireCommon(root);
    root.querySelectorAll('[data-plan-demo]').forEach(el => el.addEventListener('click', () => toast('Demo: escribe a hola@ailearning.mx')));
  }

  /* ---------------- wiring común ---------------- */

  function wireCommon(root) {
    root.querySelectorAll('[data-go]').forEach(el => {
      el.addEventListener('click', () => { const h = el.getAttribute('data-go'); if (h) go(h); });
    });
    root.querySelectorAll('[data-zoom]').forEach(el => {
      el.addEventListener('click', () => { const u = el.getAttribute('data-zoom'); if (u) window.open(u, '_blank', 'noopener'); });
    });
    root.querySelectorAll('[data-locked]').forEach(el => {
      el.addEventListener('click', () => {
        if (el.getAttribute('data-lock-reason') === 'plan') {
          const plan = el.getAttribute('data-lock-plan') || 'Esencial';
          toast('Disponible desde el plan ' + plan);
          go('#/alumno/membresia');
        } else {
          toast('Pide a tu capacitadora desbloquear esta clase');
        }
      });
    });
  }

  window.VIEWS_ALUMNO = {
    inicio: vistaInicio,
    rutas: vistaRutas,
    curso: vistaCurso,
    leccion: vistaLeccion,
    vivo: vistaVivo,
    foro: vistaForo,
    materiales: vistaMateriales,
    membresia: vistaMembresia
  };

})();
