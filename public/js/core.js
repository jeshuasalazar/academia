/* ============ aiLearning Academia — core.js ============
   API client, router, helpers UI, shell (sidebar/header/tabbar), switcher de rol.
============================================================ */
(function () {
  'use strict';

  /* ---------------- helpers ---------------- */

  window.esc = function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------------- API client ---------------- */

  window.API = {
    async get(path) {
      const r = await fetch(path);
      if (!r.ok) {
        let msg = 'Error ' + r.status + ' en ' + path;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      return r.json();
    },
    async post(path, body) {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      if (!r.ok) {
        let msg = 'Error ' + r.status + ' en ' + path;
        try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      return r.json();
    }
  };

  /* ---------------- actor (rol/id activo) ---------------- */

  Object.defineProperty(window, 'ACTOR', {
    get() {
      try {
        const raw = localStorage.getItem('actor');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
  });

  window.setActor = function setActor(rol, id) {
    localStorage.setItem('actor', JSON.stringify({ rol, id }));
  };

  window.clearActor = function clearActor() {
    localStorage.removeItem('actor');
  };

  /* ---------------- tema ---------------- */

  window.setTheme = function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    _ui.notifOpen = false;
  };

  window.toggleTheme = function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    setTheme(cur === 'dark' ? 'light' : 'dark');
    renderShell({ preserveScroll: true });
  };

  (function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  })();

  /* ---------------- router ---------------- */

  window.go = function go(hash) {
    if (location.hash === hash) { renderRoute(); }
    else { location.hash = hash; }
  };

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return parts;
  }

  function defaultVista(rol) {
    if (rol === 'alumno') return 'inicio';
    if (rol === 'profesor') return 'panel';
    if (rol === 'capacitadora') return 'panel';
    return 'inicio';
  }

  async function renderRoute() {
    const parts = parseHash();
    const actor = window.ACTOR;
    if (!actor || parts.length === 0) {
      await renderRoleSelector();
      return;
    }
    const rol = parts[0] || actor.rol;
    const vista = parts[1] || defaultVista(rol);
    const params = parts.slice(2);
    await renderShellAndDispatch(rol, vista, params);
  }

  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('DOMContentLoaded', renderRoute);

  /* ---------------- toast ---------------- */

  let toastTimer = null;
  window.toast = function toast(msg, ms) {
    ms = ms || 2600;
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    root.innerHTML = '<div class="toast"><span class="toast-dot"></span><span class="toast-msg">' + esc(msg) + '</span></div>';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, ms);
  };

  /* ---------------- iconos ---------------- */

  const ICON_PATHS = {
    home: '<path d="M4 11l8-7 8 7"></path><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"></path>',
    route: '<circle cx="6" cy="6" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="M8.2 7.8l2.6 2.6M13.2 12.8l2.6 2.6"></path>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="M16 10l5-3v10l-5-3"></path>',
    forum: '<path d="M4 5h16v10H8l-4 4z"></path>',
    file: '<path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v4h4"></path>',
    swap: '<path d="M4 7h13l-3-3"></path><path d="M20 17H7l3 3"></path>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.5"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
    users: '<circle cx="9" cy="8" r="3"></circle><path d="M3 20a6 6 0 0 1 12 0"></path><circle cx="17" cy="9" r="2.3"></circle><path d="M15 20a5 5 0 0 1 6-4.8"></path>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"></path><path d="M10 19a2 2 0 0 0 4 0"></path>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"></rect><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"></path>',
    plan: '<path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.9 7.1 18.2 8 12.7 4 8.8l5.5-.8z"></path>',
    sun: '<path d="M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9z"></path>',
    moon: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"></path>'
  };

  window.ICON = function ICON(name, size) {
    size = size || 18;
    const p = ICON_PATHS[name] || ICON_PATHS.home;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  };

  /* ---------------- fechas ---------------- */

  window.fmtFechaLarga = function fmtFechaLarga(d) {
    d = d || new Date();
    try {
      const s = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) { return d.toDateString(); }
  };

  window.fmtFechaCorta = function fmtFechaCorta(iso) {
    try {
      const d = new Date(iso);
      const s = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) { return iso; }
  };

  /* ---------------- navegación por rol ---------------- */

  const NAV_ALUMNO = [
    { label: 'INICIO', items: [
      { label: 'Inicio', hash: '#/alumno/inicio', icon: 'home', match: ['inicio'] },
      { label: 'Mi ruta', hash: '#/alumno/rutas', icon: 'route', match: ['rutas', 'curso'] }
    ]},
    { label: 'APRENDER', items: [
      { label: 'Clases en vivo', hash: '#/alumno/vivo', icon: 'video', match: ['vivo'] },
      { label: 'Foro de dudas', hash: '#/alumno/foro', icon: 'forum', match: ['foro'] },
      { label: 'Materiales', hash: '#/alumno/materiales', icon: 'file', match: ['materiales'] }
    ]},
    { label: 'CUENTA', items: [
      { label: 'Mi plan', hash: '#/alumno/membresia', icon: 'plan', match: ['membresia'] },
      { label: 'Cambiar de rol', action: 'switch-role', icon: 'swap' }
    ]}
  ];

  const NAV_PROFESOR_FALLBACK = [
    { label: 'PROFESOR', items: [
      { label: 'Panel', hash: '#/profesor/panel', icon: 'home', match: ['panel'] },
      { label: 'Foro', hash: '#/profesor/foro', icon: 'forum', match: ['foro'] },
      { label: 'Materiales', hash: '#/profesor/materiales', icon: 'file', match: ['materiales'] }
    ]},
    { label: 'CUENTA', items: [
      { label: 'Cambiar de rol', action: 'switch-role', icon: 'swap' }
    ]}
  ];

  const NAV_CAPACITADORA_FALLBACK = [
    { label: 'CAPACITADORA', items: [
      { label: 'Panel', hash: '#/capacitadora/panel', icon: 'home', match: ['panel'] },
      { label: 'Cursos', hash: '#/capacitadora/cursos', icon: 'route', match: ['cursos'] },
      { label: 'Desbloqueos', hash: '#/capacitadora/desbloqueos', icon: 'lock', match: ['desbloqueos'] },
      { label: 'Alumnos', hash: '#/capacitadora/alumnos', icon: 'users', match: ['alumnos'] }
    ]},
    { label: 'CUENTA', items: [
      { label: 'Cambiar de rol', action: 'switch-role', icon: 'swap' }
    ]}
  ];

  function getNav(rol) {
    if (rol === 'alumno') return NAV_ALUMNO;
    if (rol === 'profesor') return (window.NAV_PROFESOR && window.NAV_PROFESOR.length) ? window.NAV_PROFESOR : NAV_PROFESOR_FALLBACK;
    if (rol === 'capacitadora') return (window.NAV_CAPACITADORA && window.NAV_CAPACITADORA.length) ? window.NAV_CAPACITADORA : NAV_CAPACITADORA_FALLBACK;
    return [];
  }

  const PAGE_TITLES = {
    alumno: { inicio: 'Inicio', rutas: 'Mi ruta', curso: 'Curso', leccion: 'Lección', vivo: 'Clases en vivo', foro: 'Foro de dudas', materiales: 'Materiales', membresia: 'Mi plan' },
    profesor: { panel: 'Panel del profesor', curso: 'Curso', sesiones: 'Sesiones', foro: 'Foro', materiales: 'Materiales' },
    capacitadora: { panel: 'Panel de la capacitadora', cursos: 'Cursos', desbloqueos: 'Desbloqueos', alumnos: 'Alumnos' }
  };

  /* ---------------- estado global cacheado ---------------- */

  window._state = null; // cache para alumno.js: { alumnoId, data }
  let _globalState = null; // empresas / profesores para selector y perfiles

  async function getGlobalState() {
    if (_globalState) return _globalState;
    try {
      _globalState = await API.get('/api/state?alumnoId=al-1');
    } catch (e) {
      _globalState = { empresas: [], profesores: [], alumnos: [] };
    }
    return _globalState;
  }

  const KNOWN_ALUMNOS_FALLBACK = [
    { id: 'al-1', nombre: 'Jesús Salazar', iniciales: 'JS', empresaId: 'emp-ail', tipo: 'interno', plan: 'pro' },
    { id: 'al-2', nombre: 'Ana Torres', iniciales: 'AT', empresaId: 'emp-conta', tipo: 'externo', plan: 'corporativo' },
    { id: 'al-3', nombre: 'Luis Peña', iniciales: 'LP', empresaId: 'emp-dev', tipo: 'externo', plan: 'corporativo' },
    { id: 'al-4', nombre: 'Karla Medina', iniciales: 'KM', empresaId: 'emp-ail', tipo: 'interno', plan: 'explorador' },
    { id: 'al-5', nombre: 'Roberto Díaz', iniciales: 'RD', empresaId: 'emp-ail', tipo: 'interno', plan: 'esencial' }
  ];
  const PLAN_TAGS = { explorador: 'EXPLORADOR', esencial: 'ESENCIAL', pro: 'AI-NATIVE PRO', corporativo: 'CORPORATIVO' };
  window.PLAN_TAGS = PLAN_TAGS;
  const KNOWN_PROFESORES_FALLBACK = [
    { id: 'prof-1', nombre: 'CP Mariana Gutiérrez', iniciales: 'MG', empresaId: 'emp-conta' },
    { id: 'prof-2', nombre: 'Ing. Diego Ramos', iniciales: 'DR', empresaId: 'emp-dev' },
    { id: 'prof-3', nombre: 'Lic. Sofía Herrera', iniciales: 'SH', empresaId: 'emp-ail' }
  ];
  const KNOWN_EMPRESAS_FALLBACK = [
    { id: 'emp-ail', nombre: 'aiLearning', tipo: 'propietaria', color: '#2D88E8' },
    { id: 'emp-conta', nombre: 'ContaFlow Capacitación', tipo: 'externa', color: '#22A06B' },
    { id: 'emp-dev', nombre: 'DevCamp MX', tipo: 'externa', color: '#8B5CF6' }
  ];

  function inicialesDe(nombre) {
    const p = String(nombre || '').trim().split(/\s+/);
    if (p.length === 0) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }

  /* ---------------- UI efímera ---------------- */

  const _ui = { notifOpen: false };

  /* ---------------- selector de rol ---------------- */

  async function renderRoleSelector() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="role-select-wrap"><span style="color:var(--mute);font-family:JetBrains Mono,monospace;font-size:12px">Cargando…</span></div>';

    let g;
    try { g = await getGlobalState(); } catch (e) { g = {}; }
    const empresas = (g.empresas && g.empresas.length) ? g.empresas : KNOWN_EMPRESAS_FALLBACK;
    const profesores = (g.profesores && g.profesores.length) ? g.profesores : KNOWN_PROFESORES_FALLBACK;
    const alumnos = (g.alumnos && g.alumnos.length) ? g.alumnos : KNOWN_ALUMNOS_FALLBACK;

    const empresasByAlumno = {};
    empresas.forEach(e => empresasByAlumno[e.id] = e);

    function alumnoCard(a) {
      const emp = empresasByAlumno[a.empresaId];
      const planTag = a.plan ? (PLAN_TAGS[a.plan] || a.plan.toUpperCase()) : '';
      return '<button class="role-card" data-select-role="alumno" data-select-id="' + esc(a.id) + '">' +
        '<span class="avatar sm">' + esc(a.iniciales || inicialesDe(a.nombre)) + '</span>' +
        '<span class="role-card-txt"><span class="role-card-name">' + esc(a.nombre) + '</span>' +
        '<span class="role-card-sub">' + esc(emp ? emp.nombre : '') + (a.tipo ? ' · ' + esc(a.tipo) : '') + '</span>' +
        (planTag ? '<span class="chip-mono" style="width:fit-content;margin-top:2px">' + esc(planTag) + '</span>' : '') +
        '</span>' +
        '</button>';
    }
    function profCard(p) {
      const emp = empresasByAlumno[p.empresaId];
      return '<button class="role-card" data-select-role="profesor" data-select-id="' + esc(p.id) + '">' +
        '<span class="avatar sm" style="background:' + (p.avatarGrad || 'linear-gradient(135deg,#5FA8F5,#1A5FB4)') + '">' + esc(p.iniciales || inicialesDe(p.nombre)) + '</span>' +
        '<span class="role-card-txt"><span class="role-card-name">' + esc(p.nombre) + '</span>' +
        '<span class="role-card-sub">' + esc(emp ? emp.nombre : '') + '</span></span>' +
        '</button>';
    }
    function empCard(e) {
      return '<button class="role-card" data-select-role="capacitadora" data-select-id="' + esc(e.id) + '">' +
        '<span class="avatar sm" style="background:' + esc(e.color || 'var(--blue)') + '">' + esc(inicialesDe(e.nombre)) + '</span>' +
        '<span class="role-card-txt"><span class="role-card-name">' + esc(e.nombre) + '</span>' +
        '<span class="role-card-sub">' + esc(e.tipo === 'propietaria' ? 'Empresa propietaria' : 'Empresa capacitadora externa') + '</span></span>' +
        '</button>';
    }

    app.innerHTML =
      '<div class="role-select-wrap">' +
        '<div class="role-select-logo">' +
          '<span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#2D88E8,#1A5FB4);color:#fff">' + ICON('building', 20) + '</span>' +
          'aiLearning <span class="chip-academia">ACADEMIA</span>' +
        '</div>' +
        '<div style="text-align:center;display:flex;flex-direction:column;gap:8px;max-width:520px">' +
          '<h1 class="h1" style="font-size:28px">¿Quién eres hoy?</h1>' +
          '<p class="p" style="text-align:center">Elige tu perfil para entrar. No necesitas contraseña — esto es una demo multi-tenant.</p>' +
        '</div>' +
        '<div class="role-cols">' +
          '<div class="role-col"><div class="role-col-title">ALUMNO</div>' + alumnos.map(alumnoCard).join('') + '</div>' +
          '<div class="role-col"><div class="role-col-title">PROFESOR</div>' + profesores.map(profCard).join('') + '</div>' +
          '<div class="role-col"><div class="role-col-title">EMPRESA CAPACITADORA</div>' + empresas.map(empCard).join('') + '</div>' +
        '</div>' +
      '</div>';

    app.querySelectorAll('[data-select-role]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rol = btn.getAttribute('data-select-role');
        const id = btn.getAttribute('data-select-id');
        setActor(rol, id);
        window._state = null;
        _globalState = null;
        const dest = rol === 'alumno' ? '#/alumno/inicio' : (rol === 'profesor' ? '#/profesor/panel' : '#/capacitadora/panel');
        go(dest);
      });
    });
  }

  /* ---------------- perfil del actor (para header/sidebar) ---------------- */

  async function getActorProfile(rol, id) {
    const g = await getGlobalState();
    if (rol === 'alumno') {
      if (window._state && window._state.alumnoId === id && window._state.data && window._state.data.alumno) {
        const st = window._state.data;
        const a = st.alumno;
        const planTag = (st.planInfo && st.planInfo.tag) || PLAN_TAGS[a.plan] || 'CORPORATIVO';
        return { nombre: a.nombre, iniciales: a.iniciales || inicialesDe(a.nombre), xp: a.xp, racha: a.racha, avatarGrad: null, planTag };
      }
      try {
        const st = await API.get('/api/state?alumnoId=' + encodeURIComponent(id));
        window._state = { alumnoId: id, data: st };
        const a = st.alumno || {};
        const planTag = (st.planInfo && st.planInfo.tag) || PLAN_TAGS[a.plan] || 'CORPORATIVO';
        return { nombre: a.nombre || 'Alumno', iniciales: a.iniciales || inicialesDe(a.nombre), xp: a.xp || 0, racha: a.racha || 0, planTag };
      } catch (e) {
        return { nombre: 'Alumno', iniciales: '??', xp: 0, racha: 0, planTag: 'CORPORATIVO' };
      }
    }
    if (rol === 'profesor') {
      const list = (g.profesores && g.profesores.length) ? g.profesores : KNOWN_PROFESORES_FALLBACK;
      const p = list.find(x => x.id === id) || {};
      return { nombre: p.nombre || 'Profesor', iniciales: p.iniciales || inicialesDe(p.nombre), avatarGrad: p.avatarGrad };
    }
    if (rol === 'capacitadora') {
      const list = (g.empresas && g.empresas.length) ? g.empresas : KNOWN_EMPRESAS_FALLBACK;
      const e = list.find(x => x.id === id) || {};
      return { nombre: e.nombre || 'Empresa', iniciales: inicialesDe(e.nombre), color: e.color };
    }
    return { nombre: '—', iniciales: '??' };
  }

  /* ---------------- shell + dispatch ---------------- */

  let _lastRoute = null;

  async function renderShellAndDispatch(rol, vista, params) {
    _lastRoute = { rol, vista, params };
    await renderShell({});
  }

  async function renderShell(opts) {
    opts = opts || {};
    if (!_lastRoute) return;
    const { rol, vista, params } = _lastRoute;
    const actor = window.ACTOR;
    if (!actor) { await renderRoleSelector(); return; }

    const app = document.getElementById('app');
    const profile = await getActorProfile(rol, actor.id);
    const nav = getNav(rol);
    const title = (PAGE_TITLES[rol] && PAGE_TITLES[rol][vista]) || (vista ? vista.charAt(0).toUpperCase() + vista.slice(1) : '');
    const isAlumno = rol === 'alumno';

    let notifs = [];
    if (isAlumno && window._state && window._state.data && Array.isArray(window._state.data.notificaciones)) {
      notifs = window._state.data.notificaciones;
    }
    const unread = notifs.filter(n => !n.leida).length;

    function navGroupHtml(g) {
      return '<span class="nav-group-label">' + esc(g.label) + '</span>' +
        g.items.map(it => {
          const active = it.match && it.match.indexOf(vista) !== -1;
          const attrs = it.action
            ? 'data-action="' + esc(it.action) + '"'
            : 'data-go="' + esc(it.hash) + '"';
          return '<button class="nav-btn" ' + attrs + (active ? ' data-on="on"' : '') + '>' +
            ICON(it.icon) + '<span class="label">' + esc(it.label) + '</span>' +
            '</button>';
        }).join('');
    }

    const sidebarHtml =
      '<aside class="side">' +
        '<div class="side-logo"><b>aiLearning</b><span class="chip-academia">ACADEMIA</span></div>' +
        '<button class="user-card" data-go="' + (isAlumno ? '#/alumno/inicio' : '#') + '">' +
          '<span class="avatar" style="' + (profile.avatarGrad ? 'background:' + esc(profile.avatarGrad) : (profile.color ? 'background:' + esc(profile.color) : '')) + '">' + esc(profile.iniciales) + '</span>' +
          '<span class="user-card-txt"><span class="user-card-name">' + esc(profile.nombre) + '</span>' +
          (isAlumno
            ? '<span class="user-card-sub">' + esc(profile.planTag || 'CORPORATIVO') + '</span>'
            : '<span class="user-card-sub">' + esc(rol.toUpperCase()) + '</span>') +
          '</span>' +
        '</button>' +
        nav.map(navGroupHtml).join('') +
        '<div class="side-bottom">' +
          '<button class="theme-btn" data-action="toggle-theme">' +
            '<span class="icon-l">' + ICON('sun') + '</span><span class="icon-d">' + ICON('moon') + '</span>' +
            '<span>Cambiar tema</span>' +
          '</button>' +
          '<button class="logout-btn" data-action="switch-role">' + ICON('swap') + 'Cambiar de rol</button>' +
        '</div>' +
      '</aside>';

    const mtopHtml =
      '<div class="mtop">' +
        '<span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15px">aiLearning</span>' +
        '<span class="mtop-actions">' +
          (isAlumno ? '<span class="chip-xp-sm">' + (profile.xp || 0) + ' XP</span>' : '') +
          '<button class="circle-btn" data-action="toggle-theme">' + ICON('sun', 16) + '</button>' +
          '<button class="circle-btn avatar-btn" data-go="' + (isAlumno ? '#/alumno/inicio' : '#') + '">' + esc(profile.iniciales) + '</button>' +
        '</span>' +
      '</div>';

    const headHtml =
      '<header class="head">' +
        '<span class="head-title">' + esc(title) + '</span>' +
        '<span class="head-actions">' +
          (isAlumno ? '<span class="chip-racha">' + ICON('bell', 12) + '</span>' : '') +
          (isAlumno ? '<span class="chip-racha">🔥 ' + (profile.racha || 0) + ' DÍAS</span>' : '') +
          (isAlumno ? '<span class="chip-xp">' + (profile.xp || 0) + ' XP</span>' : '') +
          '<button class="bell-btn" data-action="toggle-notifs" title="Notificaciones">' + ICON('bell', 17) +
            (unread > 0 ? '<span class="bell-dot"></span>' : '') +
          '</button>' +
          (_ui.notifOpen ? renderNotifPanel(notifs) : '') +
          '<button class="avatar-head" data-go="' + (isAlumno ? '#/alumno/inicio' : '#') + '">' + esc(profile.iniciales) + '</button>' +
        '</span>' +
      '</header>';

    const tabbarHtml = '<div class="tabbar">' + renderTabbar(rol, nav, vista) + '</div>';

    app.innerHTML =
      '<div class="shell">' +
        sidebarHtml +
        '<div class="shell-main">' +
          mtopHtml +
          headHtml +
          '<main class="mainc" id="mainc"></main>' +
        '</div>' +
      '</div>' +
      tabbarHtml;

    wireGlobalEvents(app);

    const mainc = document.getElementById('mainc');
    mainc.innerHTML = '<div class="empty-state">Cargando…</div>';
    try {
      await dispatchVista(rol, vista, params, mainc);
    } catch (e) {
      console.error(e);
      mainc.innerHTML = '<div class="empty-state">Ocurrió un error al cargar esta vista.<br><span style="color:var(--coral)">' + esc(e.message || String(e)) + '</span></div>';
    }
  }

  function renderNotifPanel(notifs) {
    const items = notifs.length
      ? notifs.map(n => {
          const title = n.titulo || n.title || n.texto || 'Notificación';
          const meta = n.meta || (n.ts ? fmtFechaCorta(new Date(n.ts).toISOString()) : '');
          const dot = n.leida ? 'var(--line)' : 'var(--coral)';
          return '<button class="notif-item"><span class="notif-dot" style="background:' + dot + '"></span>' +
            '<span class="notif-txt"><span class="notif-title">' + esc(title) + '</span><span class="notif-meta">' + esc(meta) + '</span></span></button>';
        }).join('')
      : '<div class="notif-empty">Sin notificaciones por ahora.</div>';
    return '<div class="notif-overlay" data-action="close-notifs"></div>' +
      '<div class="notif-panel">' +
        '<div class="notif-head"><span class="notif-head-label">NOTIFICACIONES</span>' +
          '<button class="notif-mark" data-action="mark-notifs-read">Marcar leídas</button></div>' +
        items +
      '</div>';
  }

  function renderTabbar(rol, nav, vista) {
    const flat = [];
    nav.forEach(g => g.items.forEach(it => { if (it.hash) flat.push(it); }));
    const items = flat.slice(0, 5);
    return items.map(it => {
      const active = it.match && it.match.indexOf(vista) !== -1;
      return '<button class="tabbar-btn' + (active ? ' active' : '') + '" data-go="' + esc(it.hash) + '">' +
        ICON(it.icon, 19) + '<span class="tlabel">' + esc(it.label) + '</span></button>';
    }).join('');
  }

  function wireGlobalEvents(root) {
    root.querySelectorAll('[data-go]').forEach(el => {
      el.addEventListener('click', () => { const h = el.getAttribute('data-go'); if (h && h !== '#') go(h); });
    });
    root.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', (ev) => {
        const action = el.getAttribute('data-action');
        if (action === 'toggle-theme') { toggleTheme(); }
        else if (action === 'toggle-notifs') { ev.stopPropagation(); _ui.notifOpen = !_ui.notifOpen; renderShell({}); }
        else if (action === 'close-notifs') { _ui.notifOpen = false; renderShell({}); }
        else if (action === 'mark-notifs-read') {
          if (window._state && window._state.data && Array.isArray(window._state.data.notificaciones)) {
            window._state.data.notificaciones.forEach(n => n.leida = true);
          }
          _ui.notifOpen = false;
          renderShell({});
        }
        else if (action === 'switch-role') { clearActor(); window._state = null; go('#/'); }
      });
    });
  }

  /* ---------------- dispatch a vistas ---------------- */

  async function dispatchVista(rol, vista, params, mainc) {
    const registries = { alumno: window.VIEWS_ALUMNO, profesor: window.VIEWS_PROFESOR, capacitadora: window.VIEWS_CAPACITADORA };
    const registry = registries[rol] || {};
    const fn = registry[vista];
    if (typeof fn === 'function') {
      await fn(mainc, params);
    } else {
      mainc.innerHTML = '<div class="empty-state">Esta sección (' + esc(rol) + '/' + esc(vista) + ') todavía no está disponible.</div>';
    }
  }

  /* expuesto por si una vista necesita forzar refresco del shell (p.ej. tras cambiar XP) */
  window._refreshShell = function _refreshShell() { renderShell({}); };

})();
