// capacitadora.js - Vistas para capacitadoras
window.NAV_CAPACITADORA = [
  {
    label: 'EMPRESA',
    items: [
      { label: 'Panel', vista: 'panel' },
      { label: 'Cursos rentados', vista: 'cursos' }
    ]
  },
  {
    label: 'GESTIÓN',
    items: [
      { label: 'Desbloqueo de clases', vista: 'desbloqueos' },
      { label: 'Mis alumnos', vista: 'alumnos' }
    ]
  }
];

// Vista: Panel - resumen de la capacitadora
async function panelCapacitadora(root, params) {
  const resumen = await API.get(`/api/empresa/${ACTOR.id}/resumen`);
  const { empresa, cursos, alumnos, pctDesbloqueadoPromedio, sesionesCompletadas } = resumen;

  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:24px;">
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--blue);">${cursos.length}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Cursos rentados</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--coral);">${alumnos.length}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Alumnos</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--coral);">${pctDesbloqueadoPromedio || 0}%</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Desbloqueo promedio</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:bold;color:var(--blue);">${sesionesCompletadas || 0}</div>
        <div style="font-size:12px;color:var(--mute);margin-top:4px;">Sesiones completadas</div>
      </div>
    </div>
  `;

  const colorEmpresa = empresa.color || '#2D88E8';
  const heroHtml = `
    <div style="margin-bottom:32px;">
      <div style="font-size:32px;font-weight:bold;font-family:'Space Grotesk';color:var(--ink);margin-bottom:12px;">${empresa.nombre}</div>
      <div style="display:inline-block;background:${colorEmpresa}33;color:${colorEmpresa};padding:8px 14px;border-radius:99px;font-family:'JetBrains Mono';font-size:11px;letter-spacing:.14em;font-weight:bold;">EMPRESA CAPACITADORA</div>
    </div>
  `;

  const modeloHtml = `
    <div style="background:var(--bluesoft);border-radius:20px;padding:24px;border-left:4px solid var(--blue);">
      <div style="font-weight:bold;color:var(--blue);margin-bottom:8px;font-family:'Space Grotesk';">Cómo funciona</div>
      <div style="font-size:13px;color:var(--body);line-height:1.6;">
        Tu empresa renta la plataforma aiLearning. Tus alumnos solo ven las clases que tú desbloquees en el panel de Desbloqueo de clases. Esto te da control total sobre el ritmo de aprendizaje.
      </div>
    </div>
  `;

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      ${heroHtml}
      ${statsHtml}
      ${modeloHtml}
    </div>
  `;
}

// Vista: Cursos rentados
async function cursosCapacitadora(root, params) {
  const resumen = await API.get(`/api/empresa/${ACTOR.id}/resumen`);
  const { cursos } = resumen;
  const desbloqueos = await API.get(`/api/desbloqueos/${ACTOR.id}`);

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:20px;color:var(--ink);">Cursos rentados</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">
        ${cursos.map(curso => {
          const desbloqueadasDelCurso = (desbloqueos[curso.id] || []).length;
          const totalSesiones = curso.sesiones?.length || 0;
          const pct = totalSesiones > 0 ? Math.round((desbloqueadasDelCurso / totalSesiones) * 100) : 0;

          return `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;cursor:pointer;box-shadow:var(--shadow);" onclick="go('#/capacitadora/desbloqueos')">
              <div style="background:${curso.cover};height:120px;position:relative;">
                <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.5));padding:12px;color:white;font-family:'Space Grotesk';font-size:13px;font-weight:bold;">${curso.titulo}</div>
              </div>
              <div style="padding:16px;background:var(--card);">
                <div style="font-size:12px;color:var(--mute);margin-bottom:8px;">Profesor: ${curso.profesor?.nombre || 'N/A'}</div>
                <div style="font-size:12px;color:var(--mute);margin-bottom:12px;">${totalSesiones} sesiones</div>

                <div style="margin-bottom:8px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;font-weight:bold;color:var(--ink);">Desbloqueadas</span>
                    <span style="font-size:11px;font-weight:bold;color:var(--blue);">${pct}%</span>
                  </div>
                  <div style="height:4px;background:var(--line);border-radius:99px;overflow:hidden;">
                    <div style="height:100%;background:var(--blue);width:${pct}%;border-radius:99px;"></div>
                  </div>
                </div>

                <div style="font-size:11px;color:var(--mute);">${desbloqueadasDelCurso} de ${totalSesiones}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Vista: Desbloqueos (KEY VIEW)
async function desbloqueoCapacitadora(root, params) {
  const allCursos = await API.get('/api/cursos');
  const misCursos = allCursos.filter(c => c.empresa.id === ACTOR.id);
  const desbloqueos = await API.get(`/api/desbloqueos/${ACTOR.id}`);

  async function toggleSession(cursoId, sesionId, unlock) {
    try {
      await API.post('/api/desbloqueos', {
        empresaId: ACTOR.id,
        cursoId,
        sesionId,
        unlock
      });
      const msg = unlock ? 'Clase desbloqueada para tus alumnos' : 'Clase bloqueada';
      toast(msg);
      desbloqueoCapacitadora(root, params);
    } catch (e) {
      toast('Error al cambiar desbloqueo');
    }
  }

  async function bulkToggleCurso(cursoId, unlock) {
    const curso = misCursos.find(c => c.id === cursoId);
    if (!curso) return;

    try {
      // Post para cada sesión del curso
      for (const sesion of curso.sesiones || []) {
        await API.post('/api/desbloqueos', {
          empresaId: ACTOR.id,
          cursoId,
          sesionId: sesion.id,
          unlock
        });
      }
      const msg = unlock ? 'Todas las clases desbloqueadas' : 'Todas las clases bloqueadas';
      toast(msg);
      desbloqueoCapacitadora(root, params);
    } catch (e) {
      toast('Error al cambiar desbloqueos');
    }
  }

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:24px;color:var(--ink);">Desbloqueo de clases</h2>

      <div style="display:flex;flex-direction:column;gap:28px;">
        ${misCursos.map(curso => {
          const desbloqueadasDelCurso = (desbloqueos[curso.id] || []).length;
          const totalSesiones = curso.sesiones?.length || 0;

          return `
            <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:24px;overflow:hidden;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div>
                  <h3 style="font-family:'Space Grotesk';font-size:16px;color:var(--ink);margin:0 0 6px 0;">${curso.titulo}</h3>
                  <div style="font-size:12px;color:var(--mute);">${desbloqueadasDelCurso} de ${totalSesiones} desbloqueadas</div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button style="background:var(--blue);color:white;border:none;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:bold;cursor:pointer;" onclick="arguments[0].target.dispatchEvent(new CustomEvent('bulkToggle', {detail:{cursoId:'${curso.id}',unlock:true}}))">Desbloquear todas</button>
                  <button style="background:var(--mute);color:white;border:none;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:bold;cursor:pointer;" onclick="arguments[0].target.dispatchEvent(new CustomEvent('bulkToggle', {detail:{cursoId:'${curso.id}',unlock:false}}))">Bloquear todas</button>
                </div>
              </div>

              <div style="display:flex;flex-direction:column;gap:12px;max-height:400px;overflow-y:auto;">
                ${(curso.sesiones || []).map(sesion => {
                  const esDesbloqueada = (desbloqueos[curso.id] || []).includes(sesion.id);
                  const chipTipo = sesion.video?.proveedor === 'youtube' ? 'YOUTUBE' : sesion.video?.proveedor === 'bunny' ? 'BUNNY' : 'VIDEO';

                  return `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg2);border-radius:12px;">
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;color:var(--ink);font-weight:500;margin-bottom:4px;">${esc(sesion.titulo)}</div>
                        <div style="display:flex;gap:8px;align-items:center;">
                          <span style="font-size:11px;color:var(--mute);">${sesion.dur} min</span>
                          <span style="background:var(--bluesoft);color:var(--blue);padding:2px 6px;border-radius:99px;font-family:'JetBrains Mono';font-size:9px;letter-spacing:.14em;">${chipTipo}</span>
                        </div>
                      </div>

                      <!-- Toggle switch -->
                      <div style="margin-left:16px;">
                        <input type="checkbox" data-toggle="${sesion.id}" ${esDesbloqueada ? 'checked' : ''} style="display:none;" />
                        <label for-toggle="${sesion.id}" style="display:inline-block;width:40px;height:22px;background:${esDesbloqueada ? 'var(--blue)' : 'var(--track)'};border-radius:99px;cursor:pointer;position:relative;transition:background .3s;flex-shrink:0;">
                          <span style="position:absolute;width:18px;height:18px;background:white;border-radius:99px;top:2px;left:${esDesbloqueada ? '20px' : '2px'};transition:left .3s;display:block;"></span>
                        </label>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Attach toggle listeners
  root.querySelectorAll('input[data-toggle]').forEach(checkbox => {
    const sesionId = checkbox.dataset.toggle;
    const cursoId = misCursos.find(c => (c.sesiones || []).some(s => s.id === sesionId))?.id;
    if (!cursoId) return;

    checkbox.addEventListener('change', (e) => {
      toggleSession(cursoId, sesionId, e.target.checked);
    });

    checkbox.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });

  // Attach bulk toggle listeners
  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (btn.textContent.includes('Desbloquear todas') || btn.textContent.includes('Bloquear todas')) {
        // Find the closest course container and get cursoId from data
        const container = btn.closest('div[style*="border:1px"]');
        if (!container) return;

        // Get cursoId from one of the checkboxes in this container
        const checkbox = container.querySelector('input[data-toggle]');
        if (!checkbox) return;

        const sesionId = checkbox.dataset.toggle;
        const cursoId = misCursos.find(c => (c.sesiones || []).some(s => s.id === sesionId))?.id;
        if (!cursoId) return;

        const unlock = btn.textContent.includes('Desbloquear');
        await bulkToggleCurso(cursoId, unlock);
      }
    });
  });
}

// Vista: Mis alumnos
async function alumnosCapacitadora(root, params) {
  const resumen = await API.get(`/api/empresa/${ACTOR.id}/resumen`);
  const { alumnos } = resumen;

  root.innerHTML = `
    <div style="padding:20px;max-width:1200px;margin:0 auto;">
      <h2 style="font-family:'Space Grotesk';font-size:24px;margin-bottom:24px;color:var(--ink);">Mis alumnos</h2>

      ${alumnos.length === 0 ? `
        <div style="background:var(--bluesoft);border-radius:20px;padding:40px;text-align:center;">
          <div style="font-size:16px;color:var(--blue);font-weight:500;">No hay alumnos aún</div>
          <div style="font-size:13px;color:var(--mute);margin-top:8px;">Invita a tus alumnos para que comiencen a aprender</div>
        </div>
      ` : `
        <div style="background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;">
          <div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:16px;padding:16px;background:var(--bg2);border-bottom:1px solid var(--line);font-weight:bold;font-size:12px;color:var(--mute);font-family:'JetBrains Mono';">
            <div>ALUMNO</div>
            <div style="text-align:right;">XP</div>
            <div style="text-align:right;">SESIONES</div>
            <div style="text-align:right;">RACHA</div>
          </div>

          ${alumnos.map(alumno => `
            <div style="display:grid;grid-template-columns:1fr auto auto auto auto;gap:16px;padding:16px;border-bottom:1px solid var(--line);align-items:center;font-size:13px;">
              <div style="display:flex;gap:12px;align-items:center;">
                <div style="width:36px;height:36px;border-radius:99px;background:${alumno.avatarGrad || 'var(--blue)'};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;flex-shrink:0;">
                  ${alumno.iniciales}
                </div>
                <div style="min-width:0;">
                  <div style="color:var(--ink);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(alumno.nombre)}</div>
                  <div style="font-size:11px;color:var(--mute);margin-top:2px;">Interno</div>
                </div>
              </div>
              <div style="text-align:right;color:var(--blue);font-weight:bold;">${alumno.xp || 0}</div>
              <div style="text-align:right;color:var(--ink);">${alumno.sesionesCompletadas || 0}</div>
              <div style="text-align:right;">
                <span style="color:var(--coral);font-weight:bold;">${alumno.racha || 0}</span>
                <span style="color:var(--mute);margin-left:4px;">días</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

window.VIEWS_CAPACITADORA = {
  panel: panelCapacitadora,
  cursos: cursosCapacitadora,
  desbloqueos: desbloqueoCapacitadora,
  alumnos: alumnosCapacitadora
};
