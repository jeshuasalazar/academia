/* ============ aiLearning Academia — core.js ============
   API client, router, helpers UI, shell (sidebar/header/tabbar).
   Identidad: SOLO por SSO desde la plataforma (ailearning.mx). Sin demo de roles.
============================================================ */
(function () {
  'use strict';

  /* ---------------- plataforma (identidad / cuenta) ---------------- */
  // La academia no tiene auth propia: login, cuenta y logout viven en la
  // plataforma canónica. window.PLATFORM_URL permite override por si cambia.
  var PLATFORM_URL = (window.PLATFORM_URL || 'https://ailearning.mx').replace(/\/+$/, '');
  window.PLATFORM_URL = PLATFORM_URL;
  // Entrada: /api/sso/academia resuelve login + onboarding + emite el token SSO.
  window.goToLogin = function goToLogin() {
    window.location.href = PLATFORM_URL + '/api/sso/academia';
  };
  // Salida: logout real en la plataforma (limpia sesión de Supabase Auth).
  window.goToLogout = function goToLogout() {
    try { localStorage.removeItem('actor'); } catch (e) {}
    window._state = null;
    window.location.href = PLATFORM_URL + '/logout';
  };
  // Ajustes de cuenta (cambiar nombre/correo/contraseña) en la plataforma.
  window.goToAccount = function goToAccount() {
    window.location.href = PLATFORM_URL + '/cuenta';
  };

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
    },
    async patch(path, body) {
      const r = await fetch(path, {
        method: 'PATCH',
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
    return 'inicio';
  }

  async function renderRoute() {
    const parts = parseHash();
    const actor = window.ACTOR;
    // Sin sesión: la academia no tiene login propio → a la plataforma por SSO.
    if (!actor) {
      renderLoginRedirect();
      return;
    }
    // Solo hay un rol real: alumno. Cualquier hash raro cae al inicio del alumno.
    const rol = 'alumno';
    const vista = (parts[0] === 'alumno' && parts[1]) ? parts[1] : defaultVista(rol);
    const params = (parts[0] === 'alumno') ? parts.slice(2) : [];
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
      { label: 'Mi perfil', hash: '#/alumno/perfil', icon: 'users', match: ['perfil'] }
    ]}
  ];

  function getNav(rol) {
    return NAV_ALUMNO;
  }

  const PAGE_TITLES = {
    alumno: { inicio: 'Inicio', rutas: 'Mi ruta', curso: 'Curso', leccion: 'Lección', vivo: 'Clases en vivo', foro: 'Foro de dudas', materiales: 'Materiales', membresia: 'Mi plan', perfil: 'Mi perfil', instructor: 'Mis cursos', 'instructor-curso': 'Editar curso', admin: 'Instructores' }
  };

  /* ---------------- estado global cacheado ---------------- */

  window._state = null; // cache para alumno.js: { alumnoId, data }

  const PLAN_TAGS = { explorador: 'EXPLORADOR', esencial: 'ESENCIAL', pro: 'AI-NATIVE PRO', corporativo: 'CORPORATIVO' };
  window.PLAN_TAGS = PLAN_TAGS;

  function inicialesDe(nombre) {
    const p = String(nombre || '').trim().split(/\s+/);
    if (p.length === 0) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[1][0]).toUpperCase();
  }

  /* ---------------- UI efímera ---------------- */

  const _ui = { notifOpen: false };

  /* ---------------- pantalla de acceso (sin sesión) ---------------- */
  // La academia no tiene login propio; envía a la plataforma para autenticar.

  function renderLoginRedirect() {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="role-select-wrap">' +
        '<div class="role-select-logo">' +
          '<span style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#2D88E8,#1A5FB4);color:#fff">' + ICON('building', 20) + '</span>' +
          'aiLearning <span class="chip-academia">ACADEMIA</span>' +
        '</div>' +
        '<div style="text-align:center;display:flex;flex-direction:column;gap:14px;max-width:420px">' +
          '<h1 class="h1" style="font-size:26px">Entra a tu Academia</h1>' +
          '<p class="p" style="text-align:center">Inicia sesión con tu cuenta de aiLearning para acceder a tus cursos.</p>' +
          '<button class="btn-primary" id="btn-login" style="margin:0 auto">Iniciar sesión</button>' +
        '</div>' +
      '</div>';
    var b = document.getElementById('btn-login');
    if (b) b.addEventListener('click', function () { window.goToLogin(); });
    // Redirección automática tras un instante (por si no hay interacción).
    setTimeout(function () { if (!window.ACTOR) window.goToLogin(); }, 1200);
  }

  /* ---------------- perfil del actor (para header/sidebar) ---------------- */

  async function getActorProfile(rol, id) {
    if (window._state && window._state.alumnoId === id && window._state.data && window._state.data.alumno) {
      const st = window._state.data;
      const a = st.alumno;
      const planTag = (st.planInfo && st.planInfo.tag) || PLAN_TAGS[a.plan] || 'EXPLORADOR';
      return { nombre: a.nombre, iniciales: a.iniciales || inicialesDe(a.nombre), xp: a.xp, racha: a.racha, avatarUrl: a.avatarUrl || null, avatarGrad: null, planTag, email: a.email || '', role: a.role || 'student' };
    }
    try {
      const st = await API.get('/api/state?alumnoId=' + encodeURIComponent(id));
      window._state = { alumnoId: id, data: st };
      const a = st.alumno || {};
      const planTag = (st.planInfo && st.planInfo.tag) || PLAN_TAGS[a.plan] || 'EXPLORADOR';
      return { nombre: a.nombre || 'Alumno', iniciales: a.iniciales || inicialesDe(a.nombre), xp: a.xp || 0, racha: a.racha || 0, avatarUrl: a.avatarUrl || null, planTag, email: a.email || '', role: a.role || 'student' };
    } catch (e) {
      return { nombre: 'Alumno', iniciales: '??', xp: 0, racha: 0, avatarUrl: null, planTag: 'EXPLORADOR', email: '', role: 'student' };
    }
  }

  // Nav extra para instructores/owner: sección ENSEÑAR (y ADMIN para owner).
  const NAV_INSTRUCTOR = { label: 'ENSEÑAR', items: [
    { label: 'Mis cursos', hash: '#/alumno/instructor', icon: 'route', match: ['instructor'] }
  ]};
  const NAV_OWNER = { label: 'ADMIN', items: [
    { label: 'Instructores', hash: '#/alumno/admin', icon: 'users', match: ['admin'] }
  ]};
  function navFor(profile) {
    const nav = NAV_ALUMNO.slice();
    if (profile && (profile.role === 'instructor' || profile.role === 'owner')) nav.push(NAV_INSTRUCTOR);
    if (profile && profile.role === 'owner') nav.push(NAV_OWNER);
    return nav;
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
    if (!actor) { renderLoginRedirect(); return; }

    const app = document.getElementById('app');
    const profile = await getActorProfile(rol, actor.id);
    const nav = navFor(profile);
    const title = (PAGE_TITLES[rol] && PAGE_TITLES[rol][vista]) || (vista ? vista.charAt(0).toUpperCase() + vista.slice(1) : '');
    const isAlumno = rol === 'alumno';

    let notifs = [];
    if (isAlumno && window._state && window._state.data && Array.isArray(window._state.data.notificaciones)) {
      notifs = window._state.data.notificaciones;
    }
    const unread = notifs.filter(n => !n.leida).length;

    // Avatar: foto de Google si existe (avatarUrl), si no las iniciales.
    function avatarHtml(p, cls) {
      cls = cls || 'avatar';
      if (p.avatarUrl) {
        return '<span class="' + cls + '" style="padding:0;overflow:hidden">' +
          '<img src="' + esc(p.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" ' +
          'referrerpolicy="no-referrer" onerror="this.parentNode.textContent=\'' + esc(p.iniciales) + '\'"></span>';
      }
      const bg = p.avatarGrad ? 'background:' + esc(p.avatarGrad) : (p.color ? 'background:' + esc(p.color) : '');
      return '<span class="' + cls + '" style="' + bg + '">' + esc(p.iniciales) + '</span>';
    }
    window._avatarHtml = avatarHtml;

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
        '<button class="user-card" data-go="#/alumno/perfil">' +
          avatarHtml(profile, 'avatar') +
          '<span class="user-card-txt"><span class="user-card-name">' + esc(profile.nombre) + '</span>' +
          '<span class="user-card-sub">' + esc(profile.planTag || 'EXPLORADOR') + '</span>' +
          '</span>' +
        '</button>' +
        nav.map(navGroupHtml).join('') +
        '<div class="side-bottom">' +
          '<button class="theme-btn" data-action="toggle-theme">' +
            '<span class="icon-l">' + ICON('sun') + '</span><span class="icon-d">' + ICON('moon') + '</span>' +
            '<span>Cambiar tema</span>' +
          '</button>' +
          '<button class="logout-btn" data-action="logout">' + ICON('swap') + 'Cerrar sesión</button>' +
        '</div>' +
      '</aside>';

    const mtopHtml =
      '<div class="mtop">' +
        '<span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15px">aiLearning</span>' +
        '<span class="mtop-actions">' +
          (isAlumno ? '<span class="chip-xp-sm">' + (profile.xp || 0) + ' XP</span>' : '') +
          '<button class="circle-btn" data-action="toggle-theme">' + ICON('sun', 16) + '</button>' +
          '<button class="circle-btn avatar-btn" data-go="#/alumno/perfil" style="padding:0;overflow:hidden">' +
            (profile.avatarUrl ? '<img src="' + esc(profile.avatarUrl) + '" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : esc(profile.iniciales)) + '</button>' +
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
          '<button class="avatar-head" data-go="#/alumno/perfil" style="padding:0;overflow:hidden">' +
            (profile.avatarUrl ? '<img src="' + esc(profile.avatarUrl) + '" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : esc(profile.iniciales)) + '</button>' +
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
        else if (action === 'logout') { window.goToLogout(); }
        else if (action === 'account') { window.goToAccount(); }
      });
    });
  }

  /* ---------------- dispatch a vistas ---------------- */

  async function dispatchVista(rol, vista, params, mainc) {
    const registry = window.VIEWS_ALUMNO || {};
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
