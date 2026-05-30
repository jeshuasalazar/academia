/* ==========================================================================
   🚀 CORE MOTOR JS — PLATAFORMA DE E-LEARNING AILEARNING SPA
   ========================================================================== */

// 1. CONTROL DE ESTADO GLOBAL DE LA APLICACIÓN
const state = {
  token: localStorage.getItem('ailearning_token') || null,
  user: JSON.parse(localStorage.getItem('ailearning_user')) || null,
  activeCourseId: null,
  activeLessonId: null,
  currentCalendarDate: new Date(2026, 4, 30), // Mayo 30, 2026 (Mes base de simulación)
  sessions: []
};

// 2. CONFIGURACIÓN E INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Lucide Icons Render
  lucide.createIcons();

  // Iniciar enrutador de Hash
  window.addEventListener('hashchange', router);

  // Configurar Tema (Claro / Oscuro)
  setupTheme();

  // Escuchadores de eventos para Formularios de Acceso
  setupAuthEvents();

  // Escuchadores de navegación general
  setupGeneralEvents();

  // Comprobar sesión activa inicial
  checkAuth();
}

/* ==========================================
   🔑 CONTROL DE TEMA Y APARIENCIA (LIGHT / DARK)
   ========================================== */
function setupTheme() {
  const themeBtn = document.getElementById('theme-btn');
  const savedTheme = localStorage.getItem('ailearning_theme') || 'dark';
  
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('ailearning_theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('ailearning_theme', 'dark');
      }
      lucide.createIcons();
    });
  }
}

/* ==========================================
   🚪 GESTIÓN DE ACCESO Y AUTENTICACIÓN (API)
   ========================================== */
function setupAuthEvents() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const goToRegister = document.getElementById('go-to-register');
  const goToLogin = document.getElementById('go-to-login');

  // Alternar Formularios
  if (goToRegister) {
    goToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      document.getElementById('auth-subtitle').innerText = 'Crea tu cuenta de aprendizaje';
    });
  }

  if (goToLogin) {
    goToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      document.getElementById('auth-subtitle').innerText = 'Inicia sesión para continuar aprendiendo';
    });
  }

  // Submit Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('ailearning_token', data.token);
          localStorage.setItem('ailearning_user', JSON.stringify(data.user));
          state.token = data.token;
          state.user = data.user;
          
          showToast('¡Ingreso exitoso! Bienvenido.');
          checkAuth();
        } else {
          showToast(data.error || 'Correo o contraseña incorrectos.');
        }
      } catch (err) {
        console.error('Error en login:', err);
        showToast('Error de conexión con el servidor.');
      }
    });
  }

  // Submit Registro
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
          showToast('Registro exitoso. ¡Inicia sesión!');
          registerForm.classList.add('hidden');
          loginForm.classList.remove('hidden');
          document.getElementById('auth-subtitle').innerText = 'Inicia sesión para continuar aprendiendo';
        } else {
          showToast(data.error || 'Error al crear la cuenta.');
        }
      } catch (err) {
        console.error('Error en registro:', err);
        showToast('Error de conexión con el servidor.');
      }
    });
  }

  // Botón Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ailearning_token');
      localStorage.removeItem('ailearning_user');
      state.token = null;
      state.user = null;
      checkAuth();
      showToast('Sesión cerrada.');
    });
  }
}

// Comprueba la sesión activa y carga datos
async function checkAuth() {
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');

  if (state.token && state.user) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // Configurar perfiles sidebar
    updateUserProfileDisplay();
    
    // Cargar datos asíncronos obligatorios de la sesión
    await fetchUserStats();
    await fetchSessions();
    
    // Ejecutar router para ir al hash activo o por defecto
    router();
  } else {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    window.location.hash = ''; // Limpiar hash
  }
  lucide.createIcons();
}

// Actualiza elementos estáticos de perfil en sidebar y header
function updateUserProfileDisplay() {
  if (!state.user) return;

  const avatarChar = state.user.name.charAt(0).toUpperCase();
  
  // Nombre y rol
  document.getElementById('student-name').innerText = state.user.name;
  document.getElementById('student-role').innerText = state.user.role === 'admin' ? 'Administrador' : 'Plan Premium';

  // Avatares
  const avatarSidebar = document.getElementById('student-avatar');
  const avatarHeader = document.getElementById('header-avatar');
  
  avatarSidebar.innerText = avatarChar;
  avatarHeader.innerText = avatarChar;

  avatarSidebar.style.background = state.user.avatar_gradient || 'var(--coral)';
  avatarHeader.style.background = state.user.avatar_gradient || 'var(--coral)';

  // Mostrar opción admin si corresponde
  const navAdmin = document.getElementById('nav-admin');
  const adminAddPromptBtn = document.getElementById('admin-add-prompt-btn');

  if (state.user.role === 'admin') {
    navAdmin.classList.remove('hidden');
    if (adminAddPromptBtn) adminAddPromptBtn.classList.remove('hidden');
  } else {
    navAdmin.classList.add('hidden');
    if (adminAddPromptBtn) adminAddPromptBtn.classList.add('hidden');
  }
}

// Consulta estadísticas de nivel/XP reales del servidor
async function fetchUserStats() {
  try {
    const response = await fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      state.user.xp = data.user.xp;
      state.user.level = data.user.level;
      localStorage.setItem('ailearning_user', JSON.stringify(state.user));

      // Actualizar visuales
      document.getElementById('header-user-xp').innerText = `XP: ${data.user.xp}`;
      
      const dashProgressFill = document.getElementById('dashboard-progress-fill');
      const dashProgressText = document.getElementById('dashboard-progress-text');
      const dashLevelText = document.getElementById('dashboard-level-text');

      if (dashProgressFill) {
        // Porcentaje relativo al nivel (cada 100 XP es un nivel)
        const relativeXp = data.user.xp % 100;
        dashProgressFill.style.width = `${relativeXp}%`;
        dashProgressText.innerText = `${relativeXp}%`;
      }
      
      if (dashLevelText) {
        dashLevelText.innerText = `Nivel ${data.user.level}`;
      }
    }
  } catch (err) {
    console.error('Error al obtener estadísticas del alumno:', err);
  }
}

/* ==========================================
   🗺️ ROUTER EN BASE A HASHES (SPA)
   ========================================== */
function router() {
  // Si no hay token cargado, forzar a estar fuera
  if (!state.token) return;

  const rawHash = window.location.hash || '#/dashboard';
  const parts = rawHash.split('/');
  const route = parts[1] || 'dashboard';
  const param = parts[2] || null;

  // Actualizar Título y navegación activa
  const viewTitle = document.getElementById('view-title');
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => item.classList.remove('active'));

  // Ocultar todas las secciones de vista
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.add('hidden'));

  // Mostrar vista correspondiente
  switch (route) {
    case 'dashboard':
      document.getElementById('view-dashboard-section').classList.remove('hidden');
      document.getElementById('nav-dashboard').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Dashboard Principal';
      loadDashboardData();
      break;
      
    case 'courses':
      document.getElementById('view-courses-section').classList.remove('hidden');
      document.getElementById('nav-courses').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Rutas de Aprendizaje';
      loadCourses();
      break;

    case 'course-view':
      document.getElementById('view-course-detail-section').classList.remove('hidden');
      document.getElementById('nav-courses').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Sala de Clases';
      if (param) loadCourseDetail(param);
      break;

    case 'prompts':
      document.getElementById('view-prompts-section').classList.remove('hidden');
      document.getElementById('nav-prompts').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Galería de Prompts de IA';
      loadPrompts();
      break;

    case 'calendar':
      document.getElementById('view-calendar-section').classList.remove('hidden');
      document.getElementById('nav-calendar').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Agenda de Clases en Vivo';
      loadCalendarView();
      break;

    case 'admin':
      if (state.user.role !== 'admin') {
        window.location.hash = '#/dashboard';
        return;
      }
      document.getElementById('view-admin-section').classList.remove('hidden');
      document.getElementById('nav-admin').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Panel de Control Administrador';
      loadAdminPanel();
      break;

    default:
      window.location.hash = '#/dashboard';
  }

  // Refrescar iconos Lucide
  lucide.createIcons();
}

/* ==========================================
   🏠 CONTROLADOR VISTA 1: DASHBOARD PRINCIPAL
   ========================================== */
async function loadDashboardData() {
  try {
    // 1. Cargar cursos en el Dashboard
    const coursesRes = await fetch('/api/courses', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    if (coursesRes.ok) {
      const courses = await coursesRes.json();
      const grid = document.getElementById('dashboard-courses-grid');
      
      if (grid) {
        grid.innerHTML = '';
        
        // Mostrar los 2 primeros cursos en portada
        courses.slice(0, 2).forEach(c => {
          const card = document.createElement('div');
          card.className = 'tutorial-card';
          card.innerHTML = `
            <div class="tutorial-thumb">
              <img src="${c.thumbnail}" alt="${c.title}">
            </div>
            <div class="tutorial-card-body">
              <span class="category-tag cat">${c.category}</span>
              <h4>${c.title}</h4>
              <p>${c.description}</p>
            </div>
          `;
          
          card.addEventListener('click', () => {
            window.location.hash = `#/course-view/${c.id}`;
          });
          grid.appendChild(card);
        });
      }
    }

    // 2. Cargar Prompts en el Sidebar de recursos
    const promptsRes = await fetch('/api/prompts', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (promptsRes.ok) {
      const prompts = await promptsRes.json();
      const list = document.getElementById('dashboard-prompts-list');

      if (list) {
        list.innerHTML = '';
        // Mostrar los 3 primeros prompts
        prompts.slice(0, 3).forEach(p => {
          const item = document.createElement('div');
          item.className = `gallery-item ${p.is_premium ? 'premium' : ''}`;
          item.innerHTML = `
            <div class="gallery-item-left">
              <div class="gallery-item-icon">
                <i data-lucide="${p.is_premium ? 'sparkles' : 'terminal'}"></i>
              </div>
              <div class="gallery-item-info">
                <h5>${p.title}</h5>
                <span>${p.category}</span>
              </div>
            </div>
            <div class="gallery-item-right">
              <i data-lucide="copy"></i>
            </div>
          `;
          
          item.addEventListener('click', () => {
            copyToClipboard(p.content);
          });
          list.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Error al cargar datos de portada:', err);
  }
}

/* ==========================================
   🎓 CONTROLADOR VISTA 2: LISTADO DE CURSOS
   ========================================== */
async function loadCourses() {
  try {
    const response = await fetch('/api/courses', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const courses = await response.json();
      const grid = document.getElementById('courses-list-grid');
      
      if (grid) {
        grid.innerHTML = '';
        courses.forEach(c => {
          const isLocked = state.user.level < c.level_required;
          
          const card = document.createElement('div');
          card.className = 'course-card-premium';
          
          card.innerHTML = `
            <div class="course-card-banner" style="${isLocked ? 'filter: grayscale(1) brightness(0.6);' : ''}">
              <img src="${c.thumbnail}" alt="${c.title}">
              ${isLocked ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);font-size:32px;color:#fff;"><i data-lucide="lock"></i></div>' : ''}
            </div>
            <div class="course-card-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="category-tag">${c.category}</span>
                <span class="plan-badge" style="background:${isLocked ? 'rgba(255,107,71,0.1)' : 'rgba(107,144,128,0.1)'}; color:${isLocked ? 'var(--coral)' : 'var(--sage)'};">
                  ${isLocked ? `Nivel ${c.level_required} Req.` : 'Disponible'}
                </span>
              </div>
              <h3>${c.title}</h3>
              <p>${c.description}</p>
              
              <div class="course-card-meta">
                <span style="font-size:12px; color:var(--text-sub); display:flex; align-items:center; gap:4px;">
                  <i data-lucide="award" style="width:14px;height:14px;"></i> Experiencia
                </span>
                <button class="btn ${isLocked ? 'btn-ghost' : 'btn-coral'}" ${isLocked ? 'disabled' : ''}>
                  <span>${isLocked ? 'Bloqueado' : 'Estudiar'}</span>
                  <i data-lucide="${isLocked ? 'lock' : 'play'}"></i>
                </button>
              </div>
            </div>
          `;
          
          if (!isLocked) {
            card.querySelector('button').addEventListener('click', () => {
              window.location.hash = `#/course-view/${c.id}`;
            });
          }
          
          grid.appendChild(card);
        });
      }
    }
  } catch (err) {
    console.error('Error al listar cursos:', err);
  }
}

/* ==========================================
   📖 CONTROLADOR VISTA 3: SALA DE LECCIONES
   ========================================== */
async function loadCourseDetail(courseId) {
  state.activeCourseId = courseId;
  
  try {
    const response = await fetch(`/api/courses/${courseId}/lessons`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Pintar cabecera del curso en sidebar
      document.getElementById('course-detail-category').innerText = data.course.category;
      document.getElementById('course-detail-title').innerText = data.course.title;
      document.getElementById('course-detail-description').innerText = data.course.description;

      // Pintar lecciones en la barra
      const list = document.getElementById('course-lessons-list');
      list.innerHTML = '';

      let activeLesson = null;

      data.lessons.forEach(l => {
        const item = document.createElement('div');
        item.className = `lesson-item ${l.completed ? 'completed' : ''}`;
        item.id = `lesson-item-${l.id}`;
        
        item.innerHTML = `
          <div class="lesson-item-left">
            <div class="lesson-check-icon">
              <i data-lucide="check"></i>
            </div>
            <h5>${l.title}</h5>
          </div>
          <span class="lesson-item-right">${l.duration}</span>
        `;

        item.addEventListener('click', () => {
          selectLesson(l, data.lessons);
        });

        list.appendChild(item);

        // Elegir la primera lección no completada, o la primera de la lista por defecto
        if (!activeLesson) {
          if (!l.completed || data.lessons[data.lessons.length - 1].id === l.id) {
            activeLesson = l;
          }
        }
      });

      // Cargar la lección predeterminada
      if (activeLesson) {
        selectLesson(activeLesson, data.lessons);
      }
    }
  } catch (err) {
    console.error('Error al detallar curso:', err);
  }
}

// Selecciona una lección, carga el video y los textos correspondientes
function selectLesson(lesson, allLessons) {
  state.activeLessonId = lesson.id;
  
  // Cambiar estilo de item activo en lista
  allLessons.forEach(l => {
    const el = document.getElementById(`lesson-item-${l.id}`);
    if (el) el.classList.remove('active');
  });

  const activeEl = document.getElementById(`lesson-item-${lesson.id}`);
  if (activeEl) activeEl.classList.add('active');

  // Cargar video y detalles
  const player = document.getElementById('course-video-player');
  player.src = lesson.video_url;
  player.load();

  document.getElementById('lesson-detail-order').innerText = `MÓDULO LECCIÓN ${lesson.order_num}`;
  document.getElementById('lesson-detail-title').innerText = lesson.title;
  document.getElementById('lesson-detail-description').innerText = lesson.description || 'Sin descripción detallada.';

  // Mostrar/Ocultar botón de marcar como completada
  const completeBtn = document.getElementById('complete-lesson-btn');
  
  if (lesson.completed) {
    completeBtn.setAttribute('disabled', 'true');
    completeBtn.innerHTML = '<i data-lucide="check-circle-2"></i><span>Lección Completada</span>';
    completeBtn.className = 'btn btn-ghost';
  } else {
    completeBtn.removeAttribute('disabled');
    completeBtn.innerHTML = '<i data-lucide="check-circle-2"></i><span>Marcar como Completada (+50 XP)</span>';
    completeBtn.className = 'btn btn-coral';
  }
  
  lucide.createIcons();
}

/* ==========================================
   🤖 CONTROLADOR VISTA 4: BIBLIOTECA DE PROMPTS
   ========================================== */
let allPromptsCache = [];

async function loadPrompts() {
  try {
    const response = await fetch('/api/prompts', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      allPromptsCache = await response.json();
      renderPromptsGrid(allPromptsCache);
    }
  } catch (err) {
    console.error('Error al cargar biblioteca de prompts:', err);
  }
}

function renderPromptsGrid(prompts) {
  const grid = document.getElementById('prompts-cards-grid');
  if (!grid) return;

  grid.innerHTML = '';
  
  if (prompts.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-sub);padding:40px;">Ningún prompt coincide con la búsqueda.</div>';
    return;
  }

  prompts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
      <div class="prompt-card-header">
        <span class="category-tag">${p.category}</span>
        ${p.is_premium ? '<span class="premium-badge"><i data-lucide="sparkles" style="width:10px;height:10px;display:inline-block;margin-right:2px;"></i>PRO</span>' : ''}
      </div>
      <h4>${p.title}</h4>
      <div class="prompt-card-body">${escapeHTML(p.content)}</div>
      <div class="prompt-card-footer">
        <button class="btn btn-blue btn-full glossy-btn copy-action-btn">
          <i data-lucide="copy"></i>
          <span>Copiar Prompt</span>
        </button>
      </div>
    `;

    card.querySelector('.copy-action-btn').addEventListener('click', () => {
      copyToClipboard(p.content);
    });

    grid.appendChild(card);
  });
  
  lucide.createIcons();
}

/* ==========================================
   📅 CONTROLADOR VISTA 5: AGENDA Y CALENDARIO
   ========================================== */
async function fetchSessions() {
  try {
    const response = await fetch('/api/live-sessions', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    if (response.ok) {
      state.sessions = await response.json();
      renderSidebarCalendar();
    }
  } catch (err) {
    console.error('Error al cargar sesiones:', err);
  }
}

// Renderiza el minicalendario interactivo del sidebar
function renderSidebarCalendar() {
  const daysContainer = document.getElementById('calendar-days');
  const monthYearLabel = document.getElementById('calendar-month-year');
  const callWidgetTime = document.getElementById('upcoming-call-time');

  if (!daysContainer) return;

  daysContainer.innerHTML = '';

  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  // Nombre de mes en español
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  monthYearLabel.innerText = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // 1. Pintar días vacíos iniciales
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    daysContainer.appendChild(emptyDay);
  }

  // 2. Pintar los días del mes
  for (let day = 1; day <= totalDays; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.innerText = day;

    // Fecha en cadena ISO local para contrastar
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Buscar si el día contiene algún evento
    const hasEvent = state.sessions.some(s => s.date_time.startsWith(currentDateStr));
    if (hasEvent) {
      dayEl.classList.add('event');
      dayEl.setAttribute('title', 'Hay una clase en vivo agendada');
      dayEl.addEventListener('click', () => {
        window.location.hash = '#/calendar';
      });
    }

    // Marcar día activo (Mayo 15 o Mayo 30 en simulación)
    if (day === 30 && month === 4 && year === 2026) {
      dayEl.classList.add('active');
    }

    daysContainer.appendChild(dayEl);
  }

  // 3. Pintar Próxima videollamada en el widget rápido
  if (state.sessions.length > 0) {
    const nextCall = state.sessions[0]; // La primera de la lista
    const date = new Date(nextCall.date_time);
    callWidgetTime.innerText = `${date.getDate()} de ${monthNames[date.getMonth()]} — ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')} hs`;
    
    // Click en la videollamada lleva a la agenda
    document.getElementById('upcoming-call-widget').onclick = () => {
      window.location.hash = '#/calendar';
    };
  } else {
    callWidgetTime.innerText = 'Sin llamadas agendadas';
  }
}

// Carga la vista grande del Calendario
function loadCalendarView() {
  const container = document.getElementById('calendar-sessions-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (state.sessions.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-sub);padding:40px;">No hay mentorías o clases programadas para esta temporada.</div>';
    return;
  }

  const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

  state.sessions.forEach(s => {
    const date = new Date(s.date_time);
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const card = document.createElement('div');
    card.className = 'session-big-card';
    card.innerHTML = `
      <div class="session-date-panel">
        <span class="day-num">${day}</span>
        <span class="month-name">${month}</span>
        <span class="time-lbl"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${hours}:${minutes} HS</span>
      </div>
      <div class="session-details-panel">
        <h3>${s.title}</h3>
        <p>${s.description || 'Sin descripción adicional para este encuentro.'}</p>
        <span class="plan-badge mt-16" style="background:rgba(45,136,232,0.1); color:var(--ai-blue);">
          Duración: ${s.duration}
        </span>
      </div>
      <div class="session-action-panel">
        <a href="${s.meeting_link}" target="_blank" class="btn btn-coral glossy-btn">
          <i data-lucide="external-link"></i>
          <span>Unirse a Clase</span>
        </a>
      </div>
    `;

    container.appendChild(card);
  });

  lucide.createIcons();
}

/* ==========================================
   🛠️ CONTROLADOR VISTA 6: PANEL ADMINISTRADOR
   ========================================== */
async function loadAdminPanel() {
  // Cargar cursos en el selector del formulario de lecciones
  try {
    const response = await fetch('/api/courses', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const courses = await response.json();
      const select = document.getElementById('admin-l-course');
      if (select) {
        select.innerHTML = '';
        courses.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.innerText = c.title;
          select.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Error cargando selector en Admin:', err);
  }
}

function loadAdminPanel() {
  // Cargar selector de cursos
  loadCoursesSelectorAdmin();

  // Escuchar envío de creación de Curso
  const courseForm = document.getElementById('admin-course-form');
  if (courseForm) {
    courseForm.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('admin-c-title').value;
      const description = document.getElementById('admin-c-desc').value;
      const thumbnail = document.getElementById('admin-c-thumb').value;
      const category = document.getElementById('admin-c-cat').value;
      const level_required = parseInt(document.getElementById('admin-c-level').value);

      try {
        const res = await fetch('/api/admin/courses', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ title, description, thumbnail, category, level_required })
        });
        if (res.ok) {
          showToast('¡Curso creado exitosamente!');
          courseForm.reset();
          loadCoursesSelectorAdmin(); // Refrescar selectores
        } else {
          showToast('Error al procesar la creación del curso.');
        }
      } catch (err) {
        showToast('Error al conectar con la API de administración.');
      }
    };
  }

  // Escuchar envío de creación de Lección
  const lessonForm = document.getElementById('admin-lesson-form');
  if (lessonForm) {
    lessonForm.onsubmit = async (e) => {
      e.preventDefault();
      const course_id = parseInt(document.getElementById('admin-l-course').value);
      const title = document.getElementById('admin-l-title').value;
      const description = document.getElementById('admin-l-desc').value;
      const video_url = document.getElementById('admin-l-url').value;
      const duration = document.getElementById('admin-l-duration').value;
      const order_num = parseInt(document.getElementById('admin-l-order').value);

      try {
        const res = await fetch('/api/admin/lessons', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ course_id, title, description, video_url, duration, order_num })
        });
        if (res.ok) {
          showToast('¡Lección añadida correctamente!');
          lessonForm.reset();
          loadCoursesSelectorAdmin();
        } else {
          showToast('Error al registrar la lección.');
        }
      } catch (err) {
        showToast('Error de red al registrar lección.');
      }
    };
  }

  // Escuchar creación de Prompt
  const promptForm = document.getElementById('admin-prompt-form');
  if (promptForm) {
    promptForm.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('admin-p-title').value;
      const category = document.getElementById('admin-p-cat').value;
      const content = document.getElementById('admin-p-content').value;
      const is_premium = document.getElementById('admin-p-premium').checked;

      try {
        const res = await fetch('/api/admin/prompts', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ title, category, content, is_premium })
        });
        if (res.ok) {
          showToast('¡Prompt añadido a la galería!');
          promptForm.reset();
        } else {
          showToast('Error al publicar prompt.');
        }
      } catch (err) {
        showToast('Error de red al añadir prompt.');
      }
    };
  }

  // Escuchar creación de Sesión
  const sessionForm = document.getElementById('admin-session-form');
  if (sessionForm) {
    sessionForm.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('admin-s-title').value;
      const description = document.getElementById('admin-s-desc').value;
      const meeting_link = document.getElementById('admin-s-link').value;
      const date_time = document.getElementById('admin-s-date').value;
      const duration = document.getElementById('admin-s-duration').value;

      try {
        const res = await fetch('/api/admin/live-sessions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ title, description, meeting_link, date_time, duration })
        });
        if (res.ok) {
          showToast('¡Llamada en vivo agendada!');
          sessionForm.reset();
          await fetchSessions(); // Recargar calendario de inmediato
        } else {
          showToast('Error al calendarizar llamada.');
        }
      } catch (err) {
        showToast('Error de red al calendarizar.');
      }
    };
  }
}

async function loadCoursesSelectorAdmin() {
  try {
    const response = await fetch('/api/courses', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const courses = await response.json();
      const select = document.getElementById('admin-l-course');
      if (select) {
        select.innerHTML = '';
        courses.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.innerText = c.title;
          select.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Error cargando selector en Admin:', err);
  }
}

/* ==========================================
   ⚙️ GESTIÓN DE EVENTOS GENERALES
   ========================================== */
function setupGeneralEvents() {
  // Acción "Comenzar" de la tarjeta de nivel en el dashboard
  const startBtn = document.getElementById('dashboard-start-learning-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      window.location.hash = '#/courses';
    });
  }

  // Volver atrás en el visor de curso
  const backBtn = document.getElementById('course-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.hash = '#/courses';
    });
  }

  // Botón para completar lección
  const completeLessonBtn = document.getElementById('complete-lesson-btn');
  if (completeLessonBtn) {
    completeLessonBtn.addEventListener('click', async () => {
      if (!state.activeLessonId) return;

      try {
        const response = await fetch('/api/progress', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ lesson_id: state.activeLessonId })
        });

        if (response.ok) {
          const data = await response.json();
          showToast('¡Lección Completada! +50 XP obtenidos.');
          
          if (data.leveledUp) {
            // Animación de level up visual
            setTimeout(() => {
              showToast(`🎉 ¡FELICIDADES! Subiste al Nivel ${data.currentLevel} 🎉`);
            }, 1000);
          }

          // Recargar datos y estadísticas
          await fetchUserStats();
          if (state.activeCourseId) {
            await loadCourseDetail(state.activeCourseId);
          }
        }
      } catch (err) {
        console.error('Error al completar lección:', err);
      }
    });
  }

  // Buscador de prompts en tiempo real
  const searchInput = document.getElementById('prompts-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      filterAndRenderPrompts(term, getActivePromptCategory());
    });
  }

  // Filtros de categoría de prompts
  const filterBtns = document.querySelectorAll('#prompts-category-filters .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const category = btn.getAttribute('data-category');
      const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
      
      filterAndRenderPrompts(term, category);
    });
  });

  // Navegación de meses en mini calendario de sidebar
  const prevMonth = document.getElementById('prev-month-btn');
  const nextMonth = document.getElementById('next-month-btn');
  
  if (prevMonth) {
    prevMonth.onclick = () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
      renderSidebarCalendar();
    };
  }

  if (nextMonth) {
    nextMonth.onclick = () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
      renderSidebarCalendar();
    };
  }
}

// Filtra la caché de prompts por término y categoría y repinta el grid
function filterAndRenderPrompts(term, category) {
  let filtered = allPromptsCache;

  if (category !== 'all') {
    filtered = filtered.filter(p => p.category === category);
  }

  if (term) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(term) || 
      p.category.toLowerCase().includes(term) || 
      p.content.toLowerCase().includes(term)
    );
  }

  renderPromptsGrid(filtered);
}

function getActivePromptCategory() {
  const activeBtn = document.querySelector('#prompts-category-filters .filter-btn.active');
  return activeBtn ? activeBtn.getAttribute('data-category') : 'all';
}

/* ==========================================
   🧰 HELPERS Y UTILIDADES FRONTIER
   ========================================== */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast('¡Prompt copiado al portapapeles!');
    })
    .catch(err => {
      console.error('Error al copiar:', err);
      showToast('No se pudo copiar de forma automática.');
    });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
