/* ============ aiLearning Academia — perfil.js ============
   Vista "Mi perfil" del alumno. Se registra en window.VIEWS_ALUMNO.perfil.
   - Muestra avatar (foto de Google si existe), nombre, correo, plan, XP y racha.
   - Personalización básica: cambiar foto (subida a Supabase Storage vía API) y tema.
   - Cuenta (identidad): logout real + deep-links a /cuenta de la plataforma para
     cambiar correo/contraseña. La academia NO gestiona credenciales.
============================================================ */
(function () {
  'use strict';

  async function loadState(force) {
    const id = (window.ACTOR && window.ACTOR.id) || null;
    if (!force && window._state && window._state.alumnoId === id) return window._state.data;
    const data = await API.get('/api/state?alumnoId=' + encodeURIComponent(id));
    window._state = { alumnoId: id, data };
    return data;
  }

  function row(label, value) {
    return '<div style="display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)">' +
      '<span style="color:var(--mute);font-size:13px">' + esc(label) + '</span>' +
      '<span style="font-weight:600;font-size:14px;text-align:right;word-break:break-word">' + esc(value || '—') + '</span>' +
      '</div>';
  }

  async function vistaPerfil(root) {
    root.innerHTML = '<div class="empty-state">Cargando tu perfil…</div>';
    const state = await loadState();
    const a = (state && state.alumno) || {};
    const planTag = (state.planInfo && state.planInfo.tag) || (window.PLAN_TAGS && window.PLAN_TAGS[a.plan]) || 'EXPLORADOR';
    const prof = { nombre: a.nombre, iniciales: a.iniciales || '?', avatarUrl: a.avatarUrl || null };
    const avatar = (window._avatarHtml ? window._avatarHtml(prof, 'avatar') : ('<span class="avatar">' + esc(prof.iniciales) + '</span>'));
    const P = window.PLATFORM_URL || 'https://ailearning.mx';

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:22px;max-width:640px;animation:fadeUp .4s ease-out">' +

        // ---- Cabecera de perfil ----
        '<div class="card" style="display:flex;align-items:center;gap:18px;padding:22px">' +
          '<span style="width:72px;height:72px;font-size:26px" class="avatar-wrap">' + avatar + '</span>' +
          '<div style="display:flex;flex-direction:column;gap:4px;min-width:0">' +
            '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:700">' + esc(prof.nombre || 'Alumno') + '</span>' +
            '<span class="chip-mono" style="width:fit-content">' + esc(planTag) + '</span>' +
          '</div>' +
          '<div style="margin-left:auto;display:flex;gap:16px;text-align:center">' +
            '<div><div style="font-family:\'Space Grotesk\',sans-serif;font-size:20px;font-weight:700">' + (a.xp || 0) + '</div><div style="color:var(--mute);font-size:11px">XP</div></div>' +
            '<div><div style="font-family:\'Space Grotesk\',sans-serif;font-size:20px;font-weight:700">' + (a.racha || 0) + '</div><div style="color:var(--mute);font-size:11px">DÍAS</div></div>' +
          '</div>' +
        '</div>' +

        // ---- Foto de perfil ----
        '<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:12px">' +
          '<h2 style="font-size:16px;font-weight:700">Foto de perfil</h2>' +
          '<p style="color:var(--mute);font-size:13px;margin:0">' +
            (prof.avatarUrl ? 'Tu foto se tomó de tu cuenta de Google. Puedes cambiarla.' : 'Sube una foto para personalizar tu perfil.') + '</p>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<input type="file" id="avatar-file" accept="image/*" style="display:none">' +
            '<button class="btn btn-sm" id="avatar-btn" style="background:var(--blue);color:#fff;border:none">Cambiar foto</button>' +
            (prof.avatarUrl ? '<button class="btn btn-sm" id="avatar-remove" style="background:transparent;border:1px solid var(--line)">Quitar</button>' : '') +
            '<span id="avatar-status" style="color:var(--mute);font-size:12px"></span>' +
          '</div>' +
        '</div>' +

        // ---- Datos de la cuenta ----
        '<div class="card" style="padding:22px">' +
          '<h2 style="font-size:16px;font-weight:700;margin-bottom:6px">Cuenta</h2>' +
          row('Nombre', prof.nombre) +
          row('Correo', a.email) +
          row('Plan', (state.planInfo && state.planInfo.nombre) || planTag) +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px">' +
            '<a class="btn btn-sm" href="' + esc(P) + '/cuenta" style="background:var(--blue);color:#fff;border:none;text-decoration:none">Cambiar correo o contraseña</a>' +
            '<a class="btn btn-sm" href="' + esc(P) + '/cuenta/suscripcion" style="background:transparent;border:1px solid var(--line);text-decoration:none">Mi suscripción</a>' +
          '</div>' +
          '<p style="color:var(--mute);font-size:12px;margin:14px 0 0">Tu identidad y facturación se gestionan de forma segura en tu cuenta de aiLearning.</p>' +
        '</div>' +

        // ---- Preferencias ----
        '<div class="card" style="padding:22px;display:flex;flex-direction:column;gap:12px">' +
          '<h2 style="font-size:16px;font-weight:700">Preferencias</h2>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button class="btn btn-sm" data-action="toggle-theme" style="background:transparent;border:1px solid var(--line)">Cambiar tema</button>' +
            '<button class="btn btn-sm" id="logout-btn" style="background:transparent;border:1px solid var(--coral);color:var(--coral)">Cerrar sesión</button>' +
          '</div>' +
        '</div>' +

      '</div>';

    // ---- wiring ----
    root.querySelectorAll('[data-action="toggle-theme"]').forEach(el =>
      el.addEventListener('click', () => { if (window.toggleTheme) window.toggleTheme(); }));

    const logoutBtn = root.querySelector('#logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => window.goToLogout());

    const fileInput = root.querySelector('#avatar-file');
    const avatarBtn = root.querySelector('#avatar-btn');
    const statusEl = root.querySelector('#avatar-status');
    if (avatarBtn && fileInput) {
      avatarBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { statusEl.textContent = 'La imagen debe pesar menos de 3 MB.'; return; }
        statusEl.textContent = 'Subiendo…';
        try {
          const dataUrl = await fileToDataUrl(file);
          const res = await API.post('/api/perfil/avatar', { alumnoId: (window.ACTOR || {}).id, dataUrl });
          if (res && res.avatarUrl) {
            window._state = null; // fuerza refresco del estado con el nuevo avatar
            statusEl.textContent = '¡Listo!';
            if (window._refreshShell) window._refreshShell();
            vistaPerfil(root);
          } else {
            statusEl.textContent = 'No se pudo actualizar la foto.';
          }
        } catch (e) {
          statusEl.textContent = e.message || 'Error al subir la foto.';
        }
      });
    }

    const removeBtn = root.querySelector('#avatar-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Quitando…';
        try {
          await API.post('/api/perfil/avatar', { alumnoId: (window.ACTOR || {}).id, dataUrl: null });
          window._state = null;
          if (window._refreshShell) window._refreshShell();
          vistaPerfil(root);
        } catch (e) { statusEl.textContent = e.message || 'Error.'; }
      });
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      r.readAsDataURL(file);
    });
  }

  // Registra la vista en el registro del alumno (alumno.js ya lo definió).
  window.VIEWS_ALUMNO = window.VIEWS_ALUMNO || {};
  window.VIEWS_ALUMNO.perfil = vistaPerfil;

})();
