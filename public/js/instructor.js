/* ============ aiLearning Academia — instructor.js ============
   Vistas de instructor/owner (Hito 5). Se registran en VIEWS_ALUMNO.
   - instructor: crear cursos y subir contenido (grabaciones Zoom + materiales)
     con contenido estructurado (descripción, resumen, preguntas, puntos, notas).
   - admin (solo owner): dar de alta usuarios especiales por correo.
   Todo pasa por /api/instructor/* y /api/admin/* (sesión firmada + rol server).
============================================================ */
(function () {
  'use strict';

  function field(label, inner) {
    return '<label style="display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600">' +
      esc(label) + inner + '</label>';
  }
  function input(id, ph, val) {
    return '<input id="' + id + '" class="input" placeholder="' + esc(ph || '') + '" value="' + esc(val || '') + '" style="font-weight:400">';
  }
  function textarea(id, ph, rows) {
    return '<textarea id="' + id + '" class="input" rows="' + (rows || 3) + '" placeholder="' + esc(ph || '') + '" style="font-weight:400;resize:vertical"></textarea>';
  }

  /* ---------------- Instructor: mis cursos ---------------- */

  async function vistaInstructor(root) {
    root.innerHTML = '<div class="empty-state">Cargando tu panel…</div>';
    let me;
    try { me = await API.get('/api/instructor/me'); }
    catch (e) { root.innerHTML = '<div class="empty-state">No tienes acceso de instructor.</div>'; return; }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:20px;max-width:820px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
          '<span class="chip-mono">Enseñar · ' + esc((me.role || '').toUpperCase()) + '</span>' +
          '<h1 class="h1">Mis cursos</h1>' +
        '</div>' +

        // crear curso
        '<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">' +
          '<h2 style="font-size:16px;font-weight:700">Crear un curso nuevo</h2>' +
          field('Título', input('nc-titulo', 'Ej. Cierre contable con IA')) +
          field('Descripción', textarea('nc-desc', 'De qué trata el curso', 2)) +
          '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
            field('Plan requerido', '<select id="nc-plan" class="input" style="font-weight:400"><option value="explorador">Explorador (gratis)</option><option value="esencial" selected>Esencial</option><option value="ai-native-pro">AI-Native Pro</option></select>') +
            field('Nivel', input('nc-nivel', 'Intermedio')) +
          '</div>' +
          '<button class="btn btn-sm" id="nc-crear" style="background:var(--blue);color:#fff;border:none;align-self:flex-start">Crear curso</button>' +
        '</div>' +

        // lista de cursos
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<span class="chip-mono">Tus cursos</span>' +
          (me.cursos && me.cursos.length
            ? me.cursos.map(cursoRow).join('')
            : '<div class="empty-state">Aún no tienes cursos. Crea el primero arriba.</div>') +
        '</div>' +
      '</div>';

    root.querySelector('#nc-crear').addEventListener('click', async function () {
      const titulo = root.querySelector('#nc-titulo').value.trim();
      if (!titulo) { toast('Escribe un título'); return; }
      try {
        await API.post('/api/instructor/cursos', {
          titulo,
          desc: root.querySelector('#nc-desc').value.trim(),
          requiredPlan: root.querySelector('#nc-plan').value,
          nivel: root.querySelector('#nc-nivel').value.trim()
        });
        toast('Curso creado');
        vistaInstructor(root);
      } catch (e) { toast(e.message || 'No se pudo crear'); }
    });

    root.querySelectorAll('[data-editar]').forEach(function (el) {
      el.addEventListener('click', function () { go('#/alumno/instructor-curso/' + el.getAttribute('data-editar')); });
    });
  }

  function cursoRow(c) {
    return '<div class="card" style="padding:14px 18px;display:flex;align-items:center;gap:12px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600">' + esc(c.titulo) + '</div>' +
        '<div style="color:var(--mute);font-size:12px">' + esc((c.status || '').toUpperCase()) + ' · ' + esc(c.requiredPlan) + '</div>' +
      '</div>' +
      '<button class="btn btn-sm btn-ghost" data-editar="' + esc(c.id) + '">Editar contenido</button>' +
      '</div>';
  }

  /* ---------------- Instructor: editar un curso ---------------- */

  async function vistaInstructorCurso(root, params) {
    const cursoId = params[0];
    root.innerHTML = '<div class="empty-state">Cargando curso…</div>';
    // Trae el curso completo (usa el endpoint público que ya arma módulos/sesiones).
    let curso;
    try { curso = await API.get('/api/cursos/' + encodeURIComponent(cursoId)); }
    catch (e) { root.innerHTML = '<div class="empty-state">No se pudo cargar el curso.</div>'; return; }

    const modulos = curso.modulos || [];
    const sesionesById = {}; (curso.sesiones || []).forEach(function (s) { sesionesById[s.id] = s; });

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:20px;max-width:820px;animation:fadeUp .4s ease-out">' +
        '<button style="align-self:flex-start;background:none;border:none;color:var(--mute);font-size:13.5px;font-weight:600;cursor:pointer;padding:0" data-go="#/alumno/instructor">← Mis cursos</button>' +
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<h1 class="h1" style="flex:1;min-width:0">' + esc(curso.titulo) + '</h1>' +
          '<button class="btn btn-sm" id="pub-toggle" style="background:' + (curso.status === 'published' ? 'transparent;border:1px solid var(--line)' : 'var(--blue);color:#fff;border:none') + '">' +
            (curso.status === 'published' ? 'Publicado ✓' : 'Publicar curso') + '</button>' +
        '</div>' +

        // módulos + lecciones
        modulos.map(function (m) {
          return '<div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:10px">' +
            '<div style="font-weight:700">' + esc(m.titulo) + '</div>' +
            (m.sesiones || []).map(function (sid) {
              var s = sesionesById[sid]; if (!s) return '';
              return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)">' +
                '<span style="flex:1;font-size:14px">' + esc(s.titulo) + '</span>' +
                '<span class="chip-mono mute">' + (s.dur || 0) + 'm</span></div>';
            }).join('') +
            '<button class="btn btn-sm btn-ghost" data-add-leccion="' + esc(m.id) + '" style="align-self:flex-start">+ Agregar lección</button>' +
          '</div>';
        }).join('') +

        // agregar módulo
        '<div class="card" style="padding:16px 20px;display:flex;gap:10px;align-items:end">' +
          field('Nuevo módulo', input('nm-titulo', 'Ej. Sesión 1 — Fundamentos')) +
          '<button class="btn btn-sm" id="nm-crear" style="background:var(--blue);color:#fff;border:none">Agregar módulo</button>' +
        '</div>' +

        // formulario de lección (oculto hasta elegir módulo)
        '<div class="card" id="lec-form" style="padding:20px 22px;display:none;flex-direction:column;gap:12px">' +
          '<h2 style="font-size:16px;font-weight:700">Nueva lección</h2>' +
          '<input type="hidden" id="lec-modulo">' +
          // Autogeneración con IA (rellena los campos; el instructor revisa)
          '<div style="background:rgba(45,136,232,.08);border:1px solid rgba(45,136,232,.25);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px">' +
            '<span class="chip-mono" style="color:#5FA8F5">✨ Generar con IA</span>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
              '<input id="lec-ia-tema" class="input" placeholder="Tema de la sesión (ej. conciliación bancaria con Claude)" style="font-weight:400;flex:1;min-width:220px">' +
              '<button class="btn btn-sm" id="lec-ia-btn" style="background:var(--blue);color:#fff;border:none">Generar borrador</button>' +
            '</div>' +
            '<span id="lec-ia-status" style="color:var(--mute);font-size:12px"></span>' +
          '</div>' +
          field('Título', input('lec-titulo', 'Ej. Grabación: conciliación con Claude')) +
          '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
            field('Duración (min)', input('lec-dur', '42')) +
            field('Video de YouTube (ID o URL)', input('lec-video', 'aqz-KE-bpKQ o URL de la grabación')) +
          '</div>' +
          field('Descripción', textarea('lec-desc', 'De qué trata esta sesión', 2)) +
          field('Resumen de la sesión', textarea('lec-resumen', 'Qué se cubrió', 2)) +
          field('Puntos importantes (uno por línea)', textarea('lec-puntos', 'Conciliación\nPlantillas\nPrompts', 3)) +
          field('Notas', textarea('lec-notas', 'Notas o instrucciones para el alumno', 2)) +
          field('Preguntas para pasar de clase (una por línea: pregunta | opción correcta | opción | opción)',
            textarea('lec-preg', '¿Qué automatizamos? | Conciliación | Nómina | Reportes', 3)) +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<button class="btn btn-sm" id="lec-guardar" style="background:var(--blue);color:#fff;border:none">Guardar lección</button>' +
            '<button class="btn btn-sm btn-ghost" id="lec-cancel">Cancelar</button>' +
            '<span id="lec-status" style="color:var(--mute);font-size:12px"></span>' +
          '</div>' +
          // subir material a la última lección guardada
          '<div id="mat-box" style="display:none;border-top:1px solid var(--line);padding-top:12px;margin-top:4px">' +
            '<span class="chip-mono">Material de la clase</span>' +
            '<div style="display:flex;gap:10px;align-items:center;margin-top:8px">' +
              '<input type="file" id="mat-file" style="font-size:13px">' +
              '<span id="mat-status" style="color:var(--mute);font-size:12px"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // publicar / despublicar
    root.querySelector('#pub-toggle').addEventListener('click', async function () {
      const next = curso.status === 'published' ? 'draft' : 'published';
      try { await API.patch('/api/instructor/cursos/' + cursoId, { status: next }); toast(next === 'published' ? 'Curso publicado' : 'Curso en borrador'); vistaInstructorCurso(root, params); }
      catch (e) { toast(e.message || 'Error'); }
    });

    // agregar módulo
    root.querySelector('#nm-crear').addEventListener('click', async function () {
      const t = root.querySelector('#nm-titulo').value.trim();
      if (!t) { toast('Escribe el nombre del módulo'); return; }
      try { await API.post('/api/instructor/cursos/' + cursoId + '/modulos', { titulo: t }); toast('Módulo agregado'); vistaInstructorCurso(root, params); }
      catch (e) { toast(e.message || 'Error'); }
    });

    // abrir formulario de lección
    root.querySelectorAll('[data-add-leccion]').forEach(function (el) {
      el.addEventListener('click', function () {
        root.querySelector('#lec-modulo').value = el.getAttribute('data-add-leccion');
        const f = root.querySelector('#lec-form'); f.style.display = 'flex';
        f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    root.querySelector('#lec-cancel').addEventListener('click', function () {
      root.querySelector('#lec-form').style.display = 'none';
    });

    // generar borrador con IA → rellena los campos del formulario
    root.querySelector('#lec-ia-btn').addEventListener('click', async function () {
      const tema = root.querySelector('#lec-ia-tema').value.trim();
      if (!tema) { toast('Escribe el tema'); return; }
      const st = root.querySelector('#lec-ia-status'); st.textContent = 'Generando con IA…';
      try {
        const draft = await API.post('/api/instructor/generar', { tema: tema, curso: curso.titulo, plan: curso.requiredPlan });
        const s = draft.structured || {};
        if (draft.titulo) root.querySelector('#lec-titulo').value = draft.titulo;
        root.querySelector('#lec-desc').value = s.descripcion || '';
        root.querySelector('#lec-resumen').value = s.resumen || '';
        root.querySelector('#lec-puntos').value = (s.puntos_clave || []).join('\n');
        root.querySelector('#lec-notas').value = s.notas || '';
        root.querySelector('#lec-preg').value = (s.preguntas_pase || []).map(function (q) {
          const correcta = q.opciones[q.correcta];
          const otras = q.opciones.filter(function (_, i) { return i !== q.correcta; });
          return [q.q, correcta].concat(otras).join(' | ');
        }).join('\n');
        st.textContent = 'Borrador generado. Revisa y edita antes de guardar.';
      } catch (e) {
        st.textContent = e.message === 'ia-no-configurada'
          ? 'La generación con IA no está configurada (falta ANTHROPIC_API_KEY).'
          : (e.message || 'No se pudo generar.');
      }
    });

    // guardar lección
    root.querySelector('#lec-guardar').addEventListener('click', async function () {
      const titulo = root.querySelector('#lec-titulo').value.trim();
      if (!titulo) { toast('Escribe el título'); return; }
      const rawVideo = root.querySelector('#lec-video').value.trim();
      let video = null;
      if (rawVideo) {
        const m = rawVideo.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
        video = m ? { proveedor: 'youtube', id: m[1] } : (/^[\w-]{11}$/.test(rawVideo) ? { proveedor: 'youtube', id: rawVideo } : { proveedor: 'url', url: rawVideo });
      }
      const puntos = root.querySelector('#lec-puntos').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      const preguntas = root.querySelector('#lec-preg').value.split('\n').map(function (line) {
        const parts = line.split('|').map(function (x) { return x.trim(); }).filter(Boolean);
        if (parts.length < 2) return null;
        const q = parts[0], correctaTxt = parts[1], resto = parts.slice(2);
        const opciones = [correctaTxt].concat(resto);
        return { q: q, opciones: opciones, correcta: 0 };
      }).filter(Boolean);
      const st = root.querySelector('#lec-status'); st.textContent = 'Guardando…';
      try {
        const res = await API.post('/api/instructor/lecciones', {
          moduleId: root.querySelector('#lec-modulo').value,
          titulo: titulo,
          dur: parseInt(root.querySelector('#lec-dur').value, 10) || 0,
          video: video,
          structured: {
            descripcion: root.querySelector('#lec-desc').value.trim(),
            resumen: root.querySelector('#lec-resumen').value.trim(),
            puntos_clave: puntos,
            notas: root.querySelector('#lec-notas').value.trim(),
            preguntas_pase: preguntas
          },
          status: 'published'
        });
        st.textContent = 'Lección guardada. Ya puedes subir material.';
        // habilita subida de material a esta lección
        const box = root.querySelector('#mat-box'); box.style.display = 'block';
        const fileEl = root.querySelector('#mat-file'); const matStatus = root.querySelector('#mat-status');
        fileEl.onchange = async function () {
          const file = fileEl.files && fileEl.files[0]; if (!file) return;
          if (file.size > 25 * 1024 * 1024) { matStatus.textContent = 'Máx 25 MB.'; return; }
          matStatus.textContent = 'Subiendo…';
          try {
            const dataUrl = await fileToDataUrl(file);
            await API.post('/api/instructor/lecciones/' + res.id + '/materiales', { nombre: file.name, dataUrl: dataUrl });
            matStatus.textContent = '¡Material subido!';
          } catch (e) { matStatus.textContent = e.message || 'Error al subir.'; }
        };
        // refresca la lista de módulos manteniendo el form de material
        setTimeout(function () { vistaInstructorCurso(root, params); }, 1400);
      } catch (e) { st.textContent = e.message || 'Error al guardar.'; }
    });

    root.querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function () { const h = el.getAttribute('data-go'); if (h) go(h); });
    });
  }

  /* ---------------- Owner: alta de instructores ---------------- */

  async function vistaAdmin(root) {
    root.innerHTML = '<div class="empty-state">Cargando…</div>';
    let lista;
    try { lista = await API.get('/api/admin/instructores'); }
    catch (e) { root.innerHTML = '<div class="empty-state">Solo el creador puede administrar instructores.</div>'; return; }

    root.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:20px;max-width:680px;animation:fadeUp .4s ease-out">' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
          '<span class="chip-mono">Admin</span>' +
          '<h1 class="h1">Usuarios especiales</h1>' +
          '<p class="p">Da de alta instructores por su correo. La persona debe haber iniciado sesión al menos una vez.</p>' +
        '</div>' +
        '<div class="card" style="padding:18px 20px;display:flex;gap:10px;align-items:end;flex-wrap:wrap">' +
          field('Correo del instructor', input('ai-email', 'persona@correo.com')) +
          '<button class="btn btn-sm" id="ai-add" style="background:var(--blue);color:#fff;border:none">Dar acceso de instructor</button>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<span class="chip-mono">Instructores y creador</span>' +
          lista.map(function (p) {
            return '<div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:10px">' +
              '<div style="flex:1;min-width:0"><div style="font-weight:600">' + esc(p.nombre || p.email) + '</div>' +
              '<div style="color:var(--mute);font-size:12px">' + esc(p.email) + ' · ' + esc((p.role || '').toUpperCase()) + '</div></div>' +
              (p.role === 'instructor' ? '<button class="btn btn-sm btn-ghost" data-quitar="' + esc(p.email) + '">Quitar</button>' : '') +
              '</div>';
          }).join('') +
        '</div>' +
      '</div>';

    root.querySelector('#ai-add').addEventListener('click', async function () {
      const email = root.querySelector('#ai-email').value.trim();
      if (!email) { toast('Escribe el correo'); return; }
      try { await API.post('/api/admin/instructores', { email: email, role: 'instructor' }); toast('Instructor dado de alta'); vistaAdmin(root); }
      catch (e) { toast(e.message || 'Error'); }
    });
    root.querySelectorAll('[data-quitar]').forEach(function (el) {
      el.addEventListener('click', async function () {
        try { await API.post('/api/admin/instructores', { email: el.getAttribute('data-quitar'), role: 'student' }); toast('Acceso retirado'); vistaAdmin(root); }
        catch (e) { toast(e.message || 'Error'); }
      });
    });
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(file);
    });
  }

  window.VIEWS_ALUMNO = window.VIEWS_ALUMNO || {};
  window.VIEWS_ALUMNO.instructor = vistaInstructor;
  window.VIEWS_ALUMNO['instructor-curso'] = vistaInstructorCurso;
  window.VIEWS_ALUMNO.admin = vistaAdmin;

})();
