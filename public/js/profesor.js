// profesor.js - Vistas para profesores
window.NAV_PROFESOR = [
  {
    label: 'PANEL',
    items: [
      { label: 'Panel', vista: 'panel' },
      { label: 'Mis cursos', vista: 'curso' }
    ]
  },
  {
    label: 'ENSEÑAR',
    items: [
      { label: 'Sesiones en vivo', vista: 'sesiones' },
      { label: 'Foro de dudas', vista: 'foro' },
      { label: 'Materiales', vista: 'materiales' }
    ]
  }
];

// Vista: Panel - resumen del profesor
async function panelProfesor(root, params) {
  const resumen = await API.get(`/api/profesor/${ACTOR.id}/resumen`);
  const { profesor, cursos, proximasSesiones = [], hilosSinRespuesta = [] } = resumen;

  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;margin-bottom:24px;">
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--blue);">${cursos.length}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Cursos</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--coral);">${proximasSesiones.length}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Sesiones vivo</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--blue);">${hilosSinRespuesta.length}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Dudas sin responder</div>
      </div>
    </div>
  `;

  let proximaVivoHtml = '';
  const proximaVivo = proximasSesiones.find(s => s.estado === 'programada' || s.estado === 'en-vivo');
  if (proximaVivo) {
    const fecha = new Date(proximaVivo.fechaISO).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    proximaVivoHtml = `
      <div style="background:var(--panel);border-radius:20px;padding:24px;margin-bottom:24px;color:white;">
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:8px;">PRÓXIMA CLASE EN VIVO</div>
        <div style="font-size:18px;font-weight:bold;margin-bottom:12px;font-family:'Space Grotesk';">${proximaVivo.titulo}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.85);margin-bottom:16px;">${fecha}</div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;font-family:'JetBrains Mono';font-size:11px;">
          <span style="background:rgba(255,255,255,.2);padding:4px 8px;border-radius:4px;">ID: ${proximaVivo.zoomId}</span>
          <span style="background:rgba(255,255,255,.2);padding:4px 8px;border-radius:4px;">Pass: ${proximaVivo.pass}</span>
        </div>
        <button style="background:var(--coral);color:white;border:none;border-radius:999px;padding:10px 20px;font-weight:bold;cursor:pointer;font-size:14px;" onclick="window.open('${proximaVivo.zoomUrl}')">Iniciar Zoom</button>
      </div>
    `;
  }

  let dudasHtml = '';
  if (hilosSinRespuesta.length > 0) {
    dudasHtml = `
      <div style="margin-top:24px;">
        <h3 style="font-family:'Space Grotesk';font-size:16px;margin-bottom:16px;color:var(--ink);">Dudas pendientes</h3>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${hilosSinRespuesta.slice(0, 5).map(hilo => `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:13px;color:var(--ink);font-weight:500;">${esc(hilo.texto.substring(0, 50))}</div>
                <div style="font-size:11px;color:var(--mute);margin-top:4px;">Sesión: ${hilo.sesionTitulo}</div>
              </div>
              <button style="background:var(--blue);color:white;border:none;border-radius:999px;padding:8px 16px;font-size:12px;cursor:pointer;font-weight:bold;" onclick="go('#/profesor/foro')">Ver</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <div style="margin-bottom:32px;">
        <div style="font-size:32px;font-weight:bold;font-family:'Space Grotesk';color:var(--ink);margin-bottom:8px;">Hola, ${profesor.nombre}</div>
        <div style="display:inline-block;background:var(--bluesoft);color:var(--blue);padding:6px 12px;border-radius:99px;font-family:'JetBrains Mono';font-size:10px;letter-spacing:.14em;">EMPRESA</div>
      </div>
      ${statsHtml}
      ${proximaVivoHtml}
      ${dudasHtml}
    </div>
  `;
}

// Vista: Mis cursos
async function cursoProfesor(root, params) {
  const { cursoId } = params;

  if (!cursoId) {
    // Grid de cursos
    const state = await API.get(`/api/state?profesorId=${ACTOR.id}`);
    const cursos = state.cursos.filter(c => c.profesorId === ACTOR.id);

    root.innerHTML = `
      <div style="padding:20px;max-width:1200px;margin:0 auto;">
        <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:20px;color:var(--ink);">Mis cursos</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;">
          ${cursos.map(curso => `
            <div style="cursor:pointer;border-radius:20px;overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--line);" onclick="go('#/profesor/curso/${curso.id}')">
              <div style="background:${curso.cover};height:140px;position:relative;">
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.5));padding:12px;color:white;font-family:'Space Grotesk';font-size:14px;font-weight:bold;">${curso.titulo}</div>
              </div>
              <div style="background:var(--card);padding:16px;border-top:1px solid var(--line);">
                <div style="font-size:12px;color:var(--mute);margin-bottom:8px;">${curso.sesiones.length} sesiones</div>
                <div style="font-size:11px;color:var(--mute);">Alumnos activos: ~${Math.floor(Math.random() * 50) + 10}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    // Detalle del curso
    const curso = await API.get(`/api/cursos/${cursoId}`);

    root.innerHTML = `
      <div style="padding:20px;max-width:1200px;margin:0 auto;">
        <button onclick="go('#/profesor/curso')" style="background:transparent;border:none;color:var(--blue);cursor:pointer;font-size:14px;margin-bottom:16px;">← Volver</button>
        <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:20px;color:var(--ink);">${curso.titulo}</h2>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;">
          <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;">
            <h3 style="font-family:'Space Grotesk';font-size:16px;margin-bottom:16px;color:var(--ink);">Módulos y sesiones</h3>
            ${curso.modulos.map(mod => `
              <div style="margin-bottom:20px;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:8px;color:var(--ink);">${mod.titulo}</div>
                ${mod.sesiones.map(sesId => {
                  const sesion = curso.sesiones.find(s => s.id === sesId);
                  if (!sesion) return '';
                  const chipTipo = sesion.video?.proveedor === 'youtube' ? 'YOUTUBE' : sesion.video?.proveedor === 'bunny' ? 'BUNNY' : 'VIDEO';
                  return `
                    <div style="font-size:12px;color:var(--body);margin-left:12px;margin-bottom:6px;display:flex;gap:8px;align-items:center;">
                      <span>${sesion.titulo}</span>
                      <span style="background:var(--bluesoft);color:var(--blue);padding:2px 6px;border-radius:99px;font-family:'JetBrains Mono';font-size:9px;letter-spacing:.14em;">${chipTipo}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `).join('')}
          </div>

          <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;">
            <h3 style="font-family:'Space Grotesk';font-size:16px;margin-bottom:16px;color:var(--ink);">Materiales</h3>
            ${curso.sesiones.flatMap(s => s.materiales || []).map(mat => `
              <div style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:13px;color:var(--body);">${esc(mat.nombre)}</span>
                <span style="font-family:'JetBrains Mono';font-size:11px;color:var(--mute);">${mat.size}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

// Vista: Sesiones en vivo
async function sesionesProfesor(root, params) {
  const resumen = await API.get(`/api/profesor/${ACTOR.id}/resumen`);
  const { sesionesVivo } = resumen;

  const sesionesOrdenadas = sesionesVivo.sort((a, b) => new Date(a.fechaISO) - new Date(b.fechaISO));

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:20px;color:var(--ink);">Sesiones en vivo</h2>
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${sesionesOrdenadas.map(sesion => {
          const fecha = new Date(sesion.fechaISO).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          let chipEstado = '';
          let colorChip = '';
          if (sesion.estado === 'en-vivo') {
            chipEstado = 'EN VIVO';
            colorChip = 'background:var(--coral);animation:blinkDot 1s infinite;';
          } else if (sesion.estado === 'programada') {
            chipEstado = 'PROGRAMADA';
            colorChip = 'background:var(--blue);';
          } else {
            chipEstado = 'FINALIZADA';
            colorChip = 'background:var(--mute);';
          }

          return `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;">
                <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
                  <h3 style="font-family:'Space Grotesk';font-size:16px;color:var(--ink);margin:0;">${sesion.titulo}</h3>
                  <span style="color:white;font-family:'JetBrains Mono';font-size:10px;letter-spacing:.14em;padding:4px 10px;border-radius:99px;${colorChip}">${chipEstado}</span>
                </div>
                <div style="font-size:13px;color:var(--body);margin-bottom:12px;">${fecha}</div>
                <div style="display:flex;gap:12px;font-family:'JetBrains Mono';font-size:11px;margin-bottom:12px;">
                  <span style="background:var(--bluesoft);color:var(--blue);padding:4px 8px;border-radius:4px;">ID: ${sesion.zoomId}</span>
                  <span style="background:var(--bluesoft);color:var(--blue);padding:4px 8px;border-radius:4px;">Pass: ${sesion.pass}</span>
                </div>
              </div>
              <button style="background:var(--coral);color:white;border:none;border-radius:999px;padding:10px 18px;font-weight:bold;cursor:pointer;font-size:13px;white-space:nowrap;" onclick="window.open('${sesion.zoomUrl}')">Iniciar Zoom</button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Vista: Foro de dudas
async function foroProfesor(root, params) {
  const resumen = await API.get(`/api/profesor/${ACTOR.id}/resumen`);
  const { cursos, sesionesVivo } = resumen;

  // Obtener todos los hilos de las sesiones de los cursos del profesor
  let todosHilos = [];
  for (const curso of cursos) {
    for (const sesion of curso.sesiones || []) {
      try {
        const hilos = await API.get(`/api/foro/${sesion.id}`);
        todosHilos.push(...(hilos || []));
      } catch (e) {
        // Sesión sin hilos
      }
    }
  }

  // Hilos sin responder (no tiene respuesta del profesor)
  const hilosSinRespuesta = todosHilos.filter(h => !h.resuelto && (!h.respuestas || h.respuestas.length === 0));

  async function responderHilo(hiloId, sesionId) {
    const textarea = root.querySelector(`textarea[data-hilo="${hiloId}"]`);
    const texto = textarea.value.trim();
    if (!texto) {
      toast('Escribe una respuesta');
      return;
    }

    try {
      await API.post(`/api/foro/${sesionId}/${hiloId}/responder`, {
        autorId: ACTOR.id,
        autorTipo: 'profesor',
        texto
      });
      toast('Respuesta enviada');
      foroProfesor(root, params);
    } catch (e) {
      toast('Error al responder');
    }
  }

  async function marcarResuelto(hiloId, sesionId) {
    try {
      await API.post(`/api/foro/${sesionId}/${hiloId}/resolver`, {});
      toast('Duda marcada como resuelta');
      foroProfesor(root, params);
    } catch (e) {
      toast('Error al marcar');
    }
  }

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:24px;color:var(--ink);">Foro de dudas</h2>

      ${hilosSinRespuesta.length === 0 ? `
        <div style="background:var(--bluesoft);border-radius:20px;padding:40px;text-align:center;">
          <div style="font-size:16px;color:var(--blue);font-weight:500;">No hay dudas pendientes</div>
          <div style="font-size:13px;color:var(--mute);margin-top:8px;">¡Excelente trabajo!</div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${hilosSinRespuesta.map(hilo => `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                  <div style="font-size:13px;color:var(--mute);margin-bottom:4px;">Pregunta de ${hilo.autorNombre || 'Alumno'}</div>
                  <div style="font-size:14px;color:var(--ink);">${esc(hilo.texto)}</div>
                </div>
              </div>

              <div style="background:var(--bg2);border-radius:12px;padding:16px;margin-bottom:16px;margin-top:16px;">
                <textarea data-hilo="${hilo.id}" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:12px;font-family:'DM Sans';font-size:13px;color:var(--ink);background:var(--card);resize:vertical;min-height:80px;" placeholder="Escribe tu respuesta aquí..."></textarea>
              </div>

              <div style="display:flex;gap:12px;">
                <button style="background:var(--coral);color:white;border:none;border-radius:999px;padding:10px 18px;font-weight:bold;cursor:pointer;font-size:13px;" onclick="arguments[0].target.closest('div').dispatchEvent(new CustomEvent('responder', {detail:{hiloId:'${hilo.id}',sesionId:'${hilo.sesionId}'}}))">Responder</button>
                <button style="background:var(--bluesoft);color:var(--blue);border:none;border-radius:999px;padding:10px 18px;font-weight:bold;cursor:pointer;font-size:13px;" onclick="arguments[0].target.closest('div').dispatchEvent(new CustomEvent('resolver', {detail:{hiloId:'${hilo.id}',sesionId:'${hilo.sesionId}'}}))">Marcar resuelto</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  // Attach event listeners
  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (e.target.textContent.includes('Responder')) {
        const container = e.target.closest('div[style*="background"]');
        const hiloId = container.querySelector('textarea').dataset.hilo;
        const sesionId = container.querySelector('textarea').dataset.hilo; // Necesitamos sesionId
        // Encontrar el hilo para obtener sesionId
        const hilo = hilosSinRespuesta.find(h => h.id === hiloId);
        if (hilo) await responderHilo(hiloId, hilo.sesionId);
      } else if (e.target.textContent.includes('Marcar resuelto')) {
        const container = e.target.closest('div[style*="background"]');
        const hiloId = container.querySelector('textarea').dataset.hilo;
        const hilo = hilosSinRespuesta.find(h => h.id === hiloId);
        if (hilo) await marcarResuelto(hiloId, hilo.sesionId);
      }
    });
  });
}

// Vista: Materiales
async function materialesProfesor(root, params) {
  const state = await API.get(`/api/state?profesorId=${ACTOR.id}`);
  const missCursos = state.cursos.filter(c => c.profesorId === ACTOR.id);

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:24px;color:var(--ink);">Materiales</h2>

      <div style="display:flex;flex-direction:column;gap:24px;">
        ${missCursos.map(curso => {
          const materiales = curso.sesiones.flatMap(s => (s.materiales || []).map(m => ({ ...m, sesionId: s.id, sesionTitulo: s.titulo })));
          return `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;overflow:hidden;">
              <h3 style="font-family:'Space Grotesk';font-size:16px;margin-bottom:16px;color:var(--ink);">${curso.titulo}</h3>
              ${materiales.length === 0 ? `
                <div style="font-size:13px;color:var(--mute);">Sin materiales</div>
              ` : `
                <div style="display:flex;flex-direction:column;gap:12px;">
                  ${materiales.map(mat => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg2);border-radius:12px;">
                      <div>
                        <div style="font-size:13px;color:var(--ink);font-weight:500;">${esc(mat.nombre)}</div>
                        <div style="font-size:11px;color:var(--mute);margin-top:4px;">Sesión: ${mat.sesionTitulo}</div>
                      </div>
                      <div style="font-family:'JetBrains Mono';font-size:11px;color:var(--mute);">${mat.size}</div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.VIEWS_PROFESOR = {
  panel: panelProfesor,
  curso: cursoProfesor,
  sesiones: sesionesProfesor,
  foro: foroProfesor,
  materiales: materialesProfesor
};
