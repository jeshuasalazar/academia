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
  sessions: [],
  lastQuizResult: null,
  quizQuestions: [],
  quizAnswers: [],
  quizCurrentIndex: 0,
  quizTimerInterval: null,
  quizTimeLeft: 0,
  notifications: []
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
  
  const rawHash = window.location.hash;
  if (rawHash.startsWith('#/verify-certificate/')) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    router();
    return;
  }

  if (state.token && state.user) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    // Configurar perfiles sidebar
    updateUserProfileDisplay();
    
    // Cargar datos asíncronos obligatorios de la sesión
    await fetchUserStats();
    await fetchSessions();
    await fetchNotifications();
    setupNotificationDropdown();
    
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
    const response = await fetch('/api/auth/me', {
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
  const rawHash = window.location.hash || '#/dashboard';
  const parts = rawHash.split('/');
  const route = parts[1] || 'dashboard';
  const param = parts[2] || null;

  // Layout check for public verification route
  const appContainer = document.getElementById('app-container');
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.app-header');
  
  if (route === 'verify-certificate') {
    if (sidebar) sidebar.classList.add('hidden');
    if (header) header.classList.add('hidden');
    if (appContainer) appContainer.style.gridTemplateColumns = '1fr';
  } else {
    // Si no hay token cargado, forzar a estar fuera
    if (!state.token) {
      window.location.hash = '';
      return;
    }
    if (sidebar) sidebar.classList.remove('hidden');
    if (header) header.classList.remove('hidden');
    if (appContainer) appContainer.style.gridTemplateColumns = '280px 1fr';
  }

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

    case 'achievements':
      document.getElementById('view-achievements-section').classList.remove('hidden');
      document.getElementById('nav-achievements').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Tus Logros y Progreso';
      loadAchievements();
      break;

    case 'community':
      document.getElementById('view-community-section').classList.remove('hidden');
      document.getElementById('nav-community').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Comunidad Global';
      loadCommunity();
      break;

    case 'membership':
      document.getElementById('view-membership-section').classList.remove('hidden');
      document.getElementById('nav-membership').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Gestión de Membresía';
      loadMembership();
      break;

    case 'profile':
      document.getElementById('view-profile-section').classList.remove('hidden');
      document.getElementById('nav-profile').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Configuración de Perfil';
      loadProfile();
      break;

    case 'leaderboard':
      document.getElementById('view-leaderboard-section').classList.remove('hidden');
      document.getElementById('nav-leaderboard').classList.add('active');
      if (viewTitle) viewTitle.innerText = 'Tabla de Clasificación';
      loadLeaderboard();
      break;

    case 'quiz':
      document.getElementById('view-quiz-section').classList.remove('hidden');
      if (viewTitle) viewTitle.innerText = 'Evaluación de Módulo';
      if (param) loadQuiz(param);
      break;

    case 'quiz-review':
      document.getElementById('view-quiz-review-section').classList.remove('hidden');
      if (viewTitle) viewTitle.innerText = 'Retroalimentación de Evaluación';
      loadQuizReview();
      break;

    case 'verify-certificate':
      document.getElementById('view-verify-cert-section').classList.remove('hidden');
      if (param) loadVerifyCertificate(param);
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
    const response = await fetch(`/api/courses/${courseId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Pintar cabecera del curso en sidebar
      document.getElementById('course-detail-category').innerText = data.course.category;
      document.getElementById('course-detail-title').innerText = data.course.title;
      document.getElementById('course-detail-description').innerText = data.course.description;

      const isEnrolled = data.is_enrolled;
      const list = document.getElementById('course-lessons-list');
      list.innerHTML = '';

      const playerContainer = document.querySelector('.main-video-player-container');

      if (!isEnrolled) {
        // Enlazar banner de inscripción
        playerContainer.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:40px; background:rgba(0,0,0,0.2); border-radius:12px;">
            <h2 style="font-family:'Space Grotesk',sans-serif; margin-bottom:12px;">Comienza tu entrenamiento</h2>
            <p style="color:var(--text-sub); max-width:400px; margin-bottom:24px;">Inscríbete en este programa para acceder a todas las lecciones en video, quizzes evaluativos de módulo y tu certificado de graduación.</p>
            <button class="btn btn-coral glossy-btn" id="enroll-now-btn">
              <span>Inscribirse Gratis</span>
              <i data-lucide="user-plus"></i>
            </button>
          </div>
        `;
        
        document.getElementById('enroll-now-btn').addEventListener('click', async () => {
          try {
            const enrollRes = await fetch(`/api/courses/${courseId}/enroll`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (enrollRes.ok) {
              showToast('¡Inscripción realizada con éxito!');
              loadCourseDetail(courseId);
            } else {
              const errData = await enrollRes.json();
              showToast(errData.error || 'No se pudo realizar la inscripción.');
            }
          } catch (e) {
            showToast('Error de red al inscribirse.');
          }
        });

        // Desactivar completado de lección
        const completeBtn = document.getElementById('complete-lesson-btn');
        completeBtn.setAttribute('disabled', 'true');
        completeBtn.className = 'btn btn-ghost';
      } else {
        // Restablecer reproductor si ya está inscrito
        playerContainer.innerHTML = `<video id="course-video-player" src="" controls class="main-video-player"></video>`;
      }

      let firstLesson = null;
      const allLessonsList = [];

      // Renderizar módulos y lecciones
      data.modules.forEach(mod => {
        const modHeader = document.createElement('div');
        modHeader.className = 'module-header-accordion';
        modHeader.style.padding = '12px 14px';
        modHeader.style.marginTop = '16px';
        modHeader.style.background = 'var(--hover-color)';
        modHeader.style.borderRadius = '8px';
        modHeader.style.cursor = 'pointer';
        modHeader.style.display = 'flex';
        modHeader.style.justifyContent = 'space-between';
        modHeader.style.alignItems = 'center';
        
        modHeader.innerHTML = `
          <div>
            <h5 style="font-size:13px; font-weight:600; font-family:'Space Grotesk',sans-serif;">${mod.title}</h5>
            <span style="font-size:10px; color:var(--text-sub);">${mod.lessons.length} lecciones</span>
          </div>
          <i data-lucide="chevron-down" style="width:14px; height:14px;"></i>
        `;

        const lessonsWrap = document.createElement('div');
        lessonsWrap.className = 'module-lessons-container';
        lessonsWrap.style.display = 'flex';
        lessonsWrap.style.flexDirection = 'column';
        lessonsWrap.style.gap = '6px';
        lessonsWrap.style.marginTop = '8px';
        lessonsWrap.style.paddingLeft = '8px';

        // Toggle del acordeón
        modHeader.addEventListener('click', () => {
          const isCollapsed = lessonsWrap.style.display === 'none';
          lessonsWrap.style.display = isCollapsed ? 'flex' : 'none';
          const icon = modHeader.querySelector('i');
          if (icon) icon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-right');
          lucide.createIcons();
        });

        mod.lessons.forEach(l => {
          allLessonsList.push(l);
          if (!firstLesson) firstLesson = l;

          const item = document.createElement('div');
          item.className = `lesson-item ${l.completed ? 'completed' : ''}`;
          item.id = `lesson-item-${l.id}`;
          item.style.padding = '8px 12px';
          item.style.borderRadius = '6px';
          item.style.cursor = isEnrolled ? 'pointer' : 'not-allowed';
          
          item.innerHTML = `
            <div class="lesson-item-left" style="display:flex; align-items:center; gap:8px;">
              <div class="lesson-check-icon" style="display:flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; border:1px solid ${l.completed ? 'var(--sage)' : 'var(--border-color)'}; background:${l.completed ? 'rgba(107,144,128,0.2)' : 'transparent'}; color:var(--sage);">
                <i data-lucide="check" style="width:10px; height:10px; display:${l.completed ? 'block' : 'none'};"></i>
              </div>
              <h5 style="font-size:12.5px; font-weight:550;">${l.title}</h5>
            </div>
            <span class="lesson-item-right" style="font-size:10.5px; color:var(--text-sub);">${l.duration}</span>
          `;

          if (isEnrolled) {
            item.addEventListener('click', () => {
              selectLesson(l, allLessonsList);
            });
          }
          lessonsWrap.appendChild(item);
        });

        // Examen de módulo (si aplica)
        if (mod.quiz) {
          const quizItem = document.createElement('div');
          const isPassed = mod.quiz.passed;
          quizItem.className = `quiz-item-link ${isPassed ? 'passed' : ''}`;
          quizItem.style.padding = '8px 12px';
          quizItem.style.borderRadius = '6px';
          quizItem.style.cursor = isEnrolled ? 'pointer' : 'not-allowed';
          quizItem.style.background = isPassed ? 'rgba(107,144,128,0.1)' : 'rgba(45,136,232,0.05)';
          quizItem.style.border = `1px solid ${isPassed ? 'var(--sage)' : 'var(--ai-blue)'}`;
          quizItem.style.display = 'flex';
          quizItem.style.justifyContent = 'space-between';
          quizItem.style.alignItems = 'center';

          quizItem.innerHTML = `
            <div class="lesson-item-left" style="display:flex; align-items:center; gap:8px; color:${isPassed ? 'var(--sage)' : 'var(--ai-blue)'};">
              <i data-lucide="${isPassed ? 'award' : 'help-circle'}" style="width:14px; height:14px;"></i>
              <h5 style="font-size:12px; font-weight:600;">📝 Examen: ${mod.quiz.title}</h5>
            </div>
            <span style="font-size:10px; font-weight:700; color:${isPassed ? 'var(--sage)' : 'var(--ai-blue)'};">
              ${isPassed ? 'APROBADO' : 'PENDIENTE'}
            </span>
          `;

          if (isEnrolled) {
            quizItem.addEventListener('click', () => {
              window.location.hash = `#/quiz/${mod.quiz.id}`;
            });
          }
          lessonsWrap.appendChild(quizItem);
        }

        list.appendChild(modHeader);
        list.appendChild(lessonsWrap);
      });

      // Cargar primera lección por defecto si está inscrito
      if (isEnrolled && firstLesson) {
        selectLesson(firstLesson, allLessonsList);
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
    const response = await fetch('/api/sessions', {
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
        ${s.is_booked ? `
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="${s.zoom_join_url || s.meeting_link || '#'}" target="_blank" class="btn btn-coral glossy-btn">
              <i data-lucide="video"></i>
              <span>Unirse a Zoom</span>
            </a>
            <button class="btn btn-ghost btn-cancel-booking" style="font-size:11px; padding:6px 12px;" data-id="${s.id}">
              <span>Cancelar Reserva</span>
            </button>
          </div>
        ` : `
          <button class="btn btn-blue btn-book-session" data-id="${s.id}">
            <i data-lucide="calendar"></i>
            <span>Reservar Lugar</span>
          </button>
        `}
      </div>
    `;

    // Click en cancelar
    const cancelBtn = card.querySelector('.btn-cancel-booking');
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        try {
          const res = await fetch(`/api/sessions/${s.id}/book`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
          });
          if (res.ok) {
            showToast('Reserva cancelada con éxito.');
            await fetchSessions();
            loadCalendarView();
          }
        } catch (e) {}
      };
    }

    // Click en reservar
    const bookBtn = card.querySelector('.btn-book-session');
    if (bookBtn) {
      bookBtn.onclick = async () => {
        try {
          const res = await fetch(`/api/sessions/${s.id}/book`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
          });
          if (res.ok) {
            showToast('¡Lugar reservado! Se envió una notificación.');
            await fetchSessions();
            loadCalendarView();
          } else {
            const errData = await res.json();
            showToast(errData.error || 'No se pudo reservar.');
          }
        } catch (e) {}
      };
    }

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

/* ==========================================================================
   🔔 NOTIFICATIONS SYSTEM
   ========================================================================== */
async function fetchNotifications() {
  try {
    const response = await fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (response.ok) {
      state.notifications = await response.json();
      updateNotificationsDisplay();
    }
  } catch (err) {
    console.error('Error al obtener notificaciones:', err);
  }
}

function updateNotificationsDisplay() {
  const countBadge = document.getElementById('notification-count');
  const listContainer = document.getElementById('notification-list');
  if (!countBadge || !listContainer) return;

  const unreadCount = state.notifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    countBadge.innerText = unreadCount;
    countBadge.classList.remove('hidden');
  } else {
    countBadge.classList.add('hidden');
  }

  listContainer.innerHTML = '';
  if (state.notifications.length === 0) {
    listContainer.innerHTML = '<div class="dropdown-item empty" style="padding:16px; text-align:center; color:var(--text-sub); font-size:12px;">Sin notificaciones nuevas.</div>';
    return;
  }

  state.notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = `dropdown-item ${n.read ? 'read' : 'unread'}`;
    item.style.padding = '12px 16px';
    item.style.borderBottom = '1px solid var(--border-color-soft)';
    item.style.background = n.read ? 'transparent' : 'rgba(45, 136, 232, 0.05)';
    item.style.cursor = 'pointer';
    
    item.innerHTML = `
      <div style="font-weight:600; font-size:12.5px; color:var(--text-main);">${n.title}</div>
      <div style="font-size:11.5px; color:var(--text-sub); margin-top:2px;">${n.message}</div>
    `;

    item.addEventListener('click', async () => {
      if (!n.read) {
        await fetch(`/api/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        await fetchNotifications();
      }
      // Navegación contextual si aplica
      if (n.data) {
        try {
          const payload = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
          if (payload.post_id) {
            window.location.hash = `#/community`;
          }
        } catch (e) {}
      }
    });

    listContainer.appendChild(item);
  });
}

function setupNotificationDropdown() {
  const btn = document.getElementById('notification-bell-btn');
  const dropdown = document.getElementById('notification-dropdown');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  if (!btn || !dropdown) return;

  btn.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
    }
  });

  if (markAllBtn) {
    markAllBtn.onclick = async () => {
      try {
        const response = await fetch('/api/notifications/read-all', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (response.ok) {
          showToast('Notificaciones marcadas como leídas.');
          await fetchNotifications();
        }
      } catch (err) {
        console.error('Error al leer notificaciones:', err);
      }
    };
  }
}

/* ==========================================================================
   🏆 VISTA 7: LOGROS Y PROGRESO (ACHIEVEMENTS)
   ========================================================================== */
async function loadAchievements() {
  try {
    // 1. Obtener estadísticas del usuario
    const statsRes = await fetch('/api/progress/dashboard', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      
      // Actualizar racha y fuego
      const fireEmoji = document.getElementById('streak-fire-emoji');
      const streakText = document.getElementById('streak-count-text');
      const streak = statsData.stats.streak;
      
      if (streakText) streakText.innerText = `${streak} ${streak === 1 ? 'día' : 'días'}`;
      if (fireEmoji) {
        if (streak >= 30) fireEmoji.innerText = '⚡';
        else if (streak >= 15) fireEmoji.innerText = '🔥🔥🔥';
        else if (streak >= 8) fireEmoji.innerText = '🔥🔥';
        else if (streak >= 1) fireEmoji.innerText = '🔥';
        else fireEmoji.innerText = '💨';
      }

      // Rellenar cuadrícula de racha de los últimos 14 días
      const activityGrid = document.getElementById('streak-activity-grid');
      if (activityGrid) {
        activityGrid.innerHTML = '';
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayEl = document.createElement('div');
          dayEl.className = 'activity-day';
          dayEl.innerText = d.getDate();
          dayEl.setAttribute('title', `${d.toLocaleDateString()}`);
          
          if (i < streak) {
            dayEl.classList.add('active');
          }
          activityGrid.appendChild(dayEl);
        }
      }

      // Nivel e XP en la tarjeta
      const levelNum = document.getElementById('achievements-level-num');
      const xpTotal = document.getElementById('achievements-xp-total');
      const xpFill = document.getElementById('achievements-xp-fill');
      const xpHelper = document.getElementById('achievements-xp-helper');

      if (levelNum) levelNum.innerText = statsData.stats.level;
      if (xpTotal) xpTotal.innerText = statsData.stats.xp;
      
      if (xpFill) {
        const relativeXp = statsData.stats.xp % 100;
        xpFill.style.width = `${relativeXp}%`;
        if (xpHelper) xpHelper.innerText = `Faltan ${100 - relativeXp} XP para el Nivel ${statsData.stats.level + 1}`;
      }
    }

    // 2. Obtener insignias con estado
    const badgesRes = await fetch('/api/progress/achievements', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (badgesRes.ok) {
      const badges = await badgesRes.json();
      const grid = document.getElementById('achievements-badges-grid');
      if (grid) {
        grid.innerHTML = '';
        badges.forEach(b => {
          const item = document.createElement('div');
          item.className = `badge-item ${b.unlocked ? 'unlocked' : ''}`;
          
          const iconEmojis = {
            'Award': '🏆',
            'CheckCircle': '✅',
            'TrendingUp': '📈',
            'Cpu': '💻',
            'Zap': '⚡',
            'Flame': '🔥',
            'Activity': '🏃',
            'Crown': '👑',
            'GraduationCap': '🎓'
          };
          const emoji = iconEmojis[b.icon] || '🏅';

          item.innerHTML = `
            <div class="badge-icon">${emoji}</div>
            <div class="badge-name">${b.name}</div>
            <div class="badge-desc">${b.description}</div>
            <span style="font-size:8px; font-weight:700; color:var(--ai-blue); margin-top:4px;">+${b.xp_reward} XP</span>
          `;
          grid.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Error al cargar logros:', err);
  }
}

/* ==========================================================================
   💬 VISTA 8: COMUNIDAD (COMMUNITY FEED)
   ========================================================================== */
async function loadCommunity() {
  const form = document.getElementById('community-post-form');
  const feed = document.getElementById('community-posts-feed');
  if (!feed) return;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('post-title').value;
      const content = document.getElementById('post-body').value;
      const category = document.getElementById('post-category').value;

      try {
        const response = await fetch('/api/community/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ title, content, course_id: null })
        });

        if (response.ok) {
          showToast('¡Publicación creada exitosamente! +15 XP');
          form.reset();
          await fetchUserStats();
          loadCommunity();
        } else {
          const errData = await response.json();
          showToast(errData.error || 'Error al publicar post.');
        }
      } catch (err) {
        showToast('Error de red al publicar en la comunidad.');
      }
    };
  }

  try {
    const response = await fetch('/api/community/posts', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (response.ok) {
      const posts = await response.json();
      feed.innerHTML = '';
      
      if (posts.length === 0) {
        feed.innerHTML = '<div style="text-align:center; color:var(--text-sub); padding:40px;">El feed está vacío. ¡Escribe la primera publicación!</div>';
        return;
      }

      posts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        const date = new Date(p.created_at);
        const dateStr = date.toLocaleDateString() + ' ' + String(date.getHours()).padStart(2,'0') + ':' + String(date.getMinutes()).padStart(2,'0');

        card.innerHTML = `
          <div class="post-header">
            <div class="post-user-info">
              <div class="post-avatar" style="background:${p.author_avatar_gradient || 'var(--coral)'}">${p.author_name.charAt(0).toUpperCase()}</div>
              <div class="post-meta-details">
                <h4>${p.author_name} ${p.author_role === 'admin' ? '<span style="color:var(--coral); font-size:10px;">[Admin]</span>' : ''}</h4>
                <span>${dateStr}</span>
              </div>
            </div>
            <span class="post-tag">${p.category_name || 'General'}</span>
          </div>
          <h3 class="post-title-text">${p.title}</h3>
          <p class="post-body-text">${escapeHTML(p.content)}</p>
          <div class="post-actions">
            <button class="btn post-action-btn like-btn" data-liked="false">
              <i data-lucide="thumbs-up" style="width:14px; height:14px;"></i>
              <span>Me gusta (${p.likes_count})</span>
            </button>
            <button class="btn post-action-btn comment-toggle">
              <i data-lucide="message-circle" style="width:14px; height:14px;"></i>
              <span>Respuestas (${p.replies_count})</span>
            </button>
          </div>
          <div class="replies-section hidden" id="replies-sec-${p.id}">
            <div class="replies-list" id="replies-list-${p.id}"></div>
            <div class="reply-composer">
              <input type="text" id="reply-input-${p.id}" placeholder="Escribe una respuesta...">
              <button class="btn btn-blue reply-send-btn" data-post-id="${p.id}">Responder</button>
            </div>
          </div>
        `;

        const likeBtn = card.querySelector('.like-btn');
        likeBtn.onclick = async () => {
          const isLiked = likeBtn.getAttribute('data-liked') === 'true';
          const action = isLiked ? 'unlike' : 'like';
          try {
            const likeRes = await fetch(`/api/community/posts/${p.id}/like`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
              },
              body: JSON.stringify({ action })
            });
            if (likeRes.ok) {
              likeBtn.setAttribute('data-liked', String(!isLiked));
              likeBtn.classList.toggle('liked');
              const newCount = p.likes_count + (isLiked ? -1 : 1);
              likeBtn.querySelector('span').innerText = `Me gusta (${newCount})`;
            }
          } catch (e) {}
        };

        const commentToggle = card.querySelector('.comment-toggle');
        const repliesSec = card.querySelector('.replies-section');
        const repliesList = card.querySelector('.replies-list');

        commentToggle.onclick = async () => {
          const isHidden = repliesSec.classList.contains('hidden');
          repliesSec.classList.toggle('hidden');
          if (isHidden) {
            try {
              const repRes = await fetch(`/api/community/posts/${p.id}`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
              });
              if (repRes.ok) {
                const repData = await repRes.json();
                repliesList.innerHTML = '';
                if (repData.replies.length === 0) {
                  repliesList.innerHTML = '<div style="font-size:11.5px; color:var(--text-sub); padding:4px;">No hay respuestas aún. Escribe una respuesta a continuación.</div>';
                } else {
                  repData.replies.forEach(r => {
                    const rDiv = document.createElement('div');
                    rDiv.className = 'reply-item';
                    const rDate = new Date(r.created_at);
                    const rDateStr = rDate.toLocaleDateString() + ' ' + String(rDate.getHours()).padStart(2,'0') + ':' + String(rDate.getMinutes()).padStart(2,'0');
                    rDiv.innerHTML = `
                      <div class="reply-user-row">
                        <span>${r.author_name} ${r.author_role === 'admin' ? '<span style="color:var(--coral); font-size:8px;">[Admin]</span>' : ''}</span>
                        <span>${rDateStr}</span>
                      </div>
                      <div class="reply-text">${escapeHTML(r.content)}</div>
                    `;
                    repliesList.appendChild(rDiv);
                  });
                }
              }
            } catch (err) {}
          }
        };

        const sendReplyBtn = card.querySelector('.reply-send-btn');
        const replyInput = card.querySelector(`#reply-input-${p.id}`);
        sendReplyBtn.onclick = async () => {
          const text = replyInput.value.trim();
          if (!text) return;

          try {
            const postRepRes = await fetch(`/api/community/posts/${p.id}/replies`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
              },
              body: JSON.stringify({ content: text })
            });

            if (postRepRes.ok) {
              showToast('¡Respuesta publicada! +5 XP');
              replyInput.value = '';
              await fetchUserStats();
              repliesSec.classList.add('hidden');
              commentToggle.click();
            } else {
              const errRep = await postRepRes.json();
              showToast(errRep.error || 'Error al responder.');
            }
          } catch (err) {
            showToast('Error de red al responder.');
          }
        };

        feed.appendChild(card);
      });
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Error al renderizar feed de comunidad:', err);
  }
}

/* ==========================================================================
   💳 VISTA 9: MEMBRESÍA Y STRIPE (BILLING)
   ========================================================================== */
async function loadMembership() {
  const statusBadge = document.getElementById('billing-current-badge');
  const statusTitle = document.getElementById('billing-status-title');
  const statusDesc = document.getElementById('billing-status-desc');
  const statusActions = document.getElementById('billing-status-actions');

  try {
    const response = await fetch('/api/billing/status', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (response.ok) {
      const sub = await response.json();
      
      if (sub.status === 'active') {
        const expDate = new Date(sub.current_period_end);
        const expDateStr = expDate.toLocaleDateString();
        
        statusBadge.innerText = 'PRO ACTIVO';
        statusBadge.style.background = 'var(--sage)';
        statusTitle.innerText = `Tu Plan Premium (${sub.plan === 'annual' ? 'Anual' : 'Mensual'}) está activo`;
        statusDesc.innerText = `Suscripción activa. Renovación/Vencimiento programada para el día: ${expDateStr}`;
        
        statusActions.innerHTML = `
          <button class="btn btn-blue" id="manage-billing-btn">
            <span>Gestionar Facturación (Portal)</span>
            <i data-lucide="external-link"></i>
          </button>
        `;

        document.getElementById('manage-billing-btn').onclick = async () => {
          try {
            const portalRes = await fetch('/api/billing/portal', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (portalRes.ok) {
              const pData = await portalRes.json();
              window.location.href = pData.url;
            } else {
              showToast('No se pudo abrir el portal de Stripe. ¿Estás en modo simulado?');
            }
          } catch (e) {
            showToast('Error al conectar con portal de Stripe.');
          }
        };

        document.querySelectorAll('.btn-checkout').forEach(b => {
          b.setAttribute('disabled', 'true');
          b.innerText = 'Plan Activo';
          b.className = 'btn btn-ghost btn-full';
        });
      } else {
        statusBadge.innerText = 'GRATUITO';
        statusBadge.style.background = 'var(--mute)';
        statusTitle.innerText = 'No tienes una membresía premium activa';
        statusDesc.innerText = 'Desbloquea todos los programas educativos avanzados, mentorías y descargas de certificados.';
        statusActions.innerHTML = '';

        document.querySelectorAll('.btn-checkout').forEach(b => {
          b.removeAttribute('disabled');
          const plan = b.getAttribute('data-plan');
          b.innerText = plan === 'annual' ? 'Suscribirse Anual' : 'Suscribirse Mensual';
          b.className = plan === 'annual' ? 'btn btn-coral glossy-btn btn-full btn-checkout' : 'btn btn-blue btn-full btn-checkout';
          
          b.onclick = async () => {
            try {
              const checkRes = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${state.token}`
                },
                body: JSON.stringify({ plan })
              });
              if (checkRes.ok) {
                const cData = await checkRes.json();
                window.location.href = cData.url;
              } else {
                showToast('Error al iniciar el checkout.');
              }
            } catch (err) {
              showToast('Error de red al iniciar pago.');
            }
          };
        });
      }
    }

    const plansRes = await fetch('/api/billing/plans');
    const plansData = await plansRes.json();
    const mockCard = document.getElementById('mock-billing-control');

    if (plansData.monthly.id === 'price_monthly_mock' && mockCard) {
      mockCard.classList.remove('hidden');
      
      document.getElementById('mock-activate-btn').onclick = async () => {
        try {
          const actRes = await fetch('/api/billing/mock-activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ plan: 'monthly' })
          });
          if (actRes.ok) {
            showToast('Premium simulado activado exitosamente.');
            loadMembership();
          }
        } catch (e) {}
      };

      document.getElementById('mock-deactivate-btn').onclick = async () => {
        try {
          const decRes = await fetch('/api/billing/mock-cancel', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
          });
          if (decRes.ok) {
            showToast('Membresía simulada removida.');
            loadMembership();
          }
        } catch (e) {}
      };
    } else if (mockCard) {
      mockCard.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error al cargar panel de facturación:', err);
  }
}

/* ==========================================================================
   👤 VISTA 10: PERFIL Y CERTIFICADOS (PROFILE)
   ========================================================================== */
async function loadProfile() {
  const profileForm = document.getElementById('profile-edit-form');
  const passwordForm = document.getElementById('profile-password-form');
  const certsGrid = document.getElementById('profile-certs-grid');

  if (profileForm) {
    document.getElementById('profile-name').value = state.user.name;
    document.getElementById('profile-email').value = state.user.email;
    document.getElementById('profile-timezone').value = state.user.timezone || 'America/Mexico_City';

    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name').value;
      const timezone = document.getElementById('profile-timezone').value;

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ name, timezone, bio: '', avatar_url: '' })
        });
        if (response.ok) {
          showToast('Perfil actualizado con éxito.');
          state.user.name = name;
          state.user.timezone = timezone;
          localStorage.setItem('ailearning_user', JSON.stringify(state.user));
          updateUserProfileDisplay();
        } else {
          showToast('No se pudo guardar la información del perfil.');
        }
      } catch (err) {
        showToast('Error de red al actualizar perfil.');
      }
    };
  }

  if (passwordForm) {
    passwordForm.onsubmit = async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('profile-old-pass').value;
      const newPassword = document.getElementById('profile-new-pass').value;

      try {
        const response = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        if (response.ok) {
          showToast('¡Contraseña cambiada exitosamente!');
          passwordForm.reset();
        } else {
          const errData = await response.json();
          showToast(errData.error || 'La contraseña actual es incorrecta.');
        }
      } catch (err) {
        showToast('Error de red al cambiar contraseña.');
      }
    };
  }

  if (certsGrid) {
    try {
      const progressRes = await fetch('/api/progress/dashboard', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      
      if (progressRes.ok) {
        const pData = await progressRes.json();
        certsGrid.innerHTML = '';
        
        const completedCoursesCount = pData.stats.completed_courses;
        
        if (completedCoursesCount === 0) {
          certsGrid.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; padding:16px;">Aún no tienes certificados. Completa un curso para obtener tu diploma.</div>';
          return;
        }

        const coursesRes = await fetch('/api/courses', {
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (coursesRes.ok) {
          const courses = await coursesRes.json();
          courses.forEach(c => {
            const isCompleted = c.total_lessons > 0 && c.completed_lessons === c.total_lessons;
            if (isCompleted) {
              const item = document.createElement('div');
              item.className = 'cert-card-item';
              
              const fakeCertCode = `CERT-${c.id}-${state.user.id}`;
              const dateStr = new Date().toLocaleDateString();

              item.innerHTML = `
                <div class="cert-info-lbl">
                  <h4>Diploma: ${c.title}</h4>
                  <p>Código único: ${fakeCertCode}</p>
                </div>
                <div style="display:flex; gap:10px;">
                  <button class="btn btn-blue verify-link-btn" data-code="${fakeCertCode}">Verificar</button>
                  <button class="btn btn-coral download-pdf-btn" data-course="${c.title}" data-code="${fakeCertCode}">PDF</button>
                </div>
              `;

              item.querySelector('.verify-link-btn').onclick = () => {
                window.location.hash = `#/verify-certificate/${fakeCertCode}`;
              };

              item.querySelector('.download-pdf-btn').onclick = () => {
                generateCertificatePDF(state.user.name, c.title, fakeCertCode, dateStr);
              };

              certsGrid.appendChild(item);
            }
          });
        }
      }
    } catch (e) {
      certsGrid.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; padding:16px;">Sin certificados disponibles.</div>';
    }
  }
}

/* ==========================================================================
   📊 VISTA 11: TABLA DE LÍDERES (LEADERBOARD)
   ========================================================================== */
async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboard-tbody');
  const myBanner = document.getElementById('leaderboard-my-position');
  if (!tbody) return;

  try {
    const response = await fetch('/api/progress/leaderboard', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (response.ok) {
      const data = await response.json();
      tbody.innerHTML = '';

      data.leaderboard.forEach((u, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');
        if (u.id === state.user.id) {
          row.className = 'current-user-row';
        }

        let rankHtml = `<span class="rank-badge rank-${rank}">${rank}</span>`;
        if (rank > 3) {
          rankHtml = `<span class="rank-badge">${rank}</span>`;
        }

        row.innerHTML = `
          <td>${rankHtml}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="post-avatar" style="background:${u.avatar_gradient || 'var(--coral)'}; width:28px; height:28px; font-size:11px;">${u.name.charAt(0).toUpperCase()}</div>
              <span style="font-weight:600;">${u.name}</span>
            </div>
          </td>
          <td>🔥 ${u.streak_count}</td>
          <td><span class="plan-badge">Nivel ${u.level}</span></td>
          <td style="font-weight:700; color:var(--ai-blue);">${u.xp} XP</td>
        `;
        tbody.appendChild(row);
      });

      const isMyUserInTop20 = data.leaderboard.some(u => u.id === state.user.id);
      if (!isMyUserInTop20 && myBanner) {
        myBanner.innerHTML = `Te encuentras en la posición <strong>#${data.my_rank}</strong> con <strong>${state.user.xp} XP</strong>. ¡Sigue aprendiendo para entrar al Top 20!`;
        myBanner.classList.remove('hidden');
      } else if (myBanner) {
        myBanner.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Error al cargar clasificación:', err);
  }
}

/* ==========================================================================
   📝 VISTA 12: REPRODUCTOR DE QUIZZES (QUIZ ENGINE)
   ========================================================================== */
async function loadQuiz(quizId) {
  if (state.quizTimerInterval) {
    clearInterval(state.quizTimerInterval);
  }

  try {
    const response = await fetch(`/api/quizzes/${quizId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (response.ok) {
      const data = await response.json();
      state.quizQuestions = data.questions;
      state.quizAnswers = [];
      state.quizCurrentIndex = 0;
      
      document.getElementById('quiz-course-module-name').innerText = `EXAMEN DE MÓDULO`;
      document.getElementById('quiz-title-display').innerText = data.quiz.title;

      let timeLimitSeconds = (data.quiz.time_limit_minutes || 10) * 60;
      state.quizTimeLeft = timeLimitSeconds;

      const timerVal = document.getElementById('quiz-time-left');
      const timerWidget = document.getElementById('quiz-timer-widget');
      
      if (timerVal) {
        const updateTimerDisplay = () => {
          const minutes = String(Math.floor(state.quizTimeLeft / 60)).padStart(2, '0');
          const seconds = String(state.quizTimeLeft % 60).padStart(2, '0');
          timerVal.innerText = `${minutes}:${seconds}`;

          if (state.quizTimeLeft <= 60) {
            timerWidget.style.color = 'var(--coral)';
            timerWidget.style.borderColor = 'var(--coral)';
          } else {
            timerWidget.style.color = '';
            timerWidget.style.borderColor = '';
          }
        };

        updateTimerDisplay();

        state.quizTimerInterval = setInterval(async () => {
          state.quizTimeLeft--;
          if (state.quizTimeLeft <= 0) {
            clearInterval(state.quizTimerInterval);
            showToast('¡Tiempo finalizado! Calificando evaluación automáticamente.');
            await submitQuiz(quizId);
          } else {
            updateTimerDisplay();
          }
        }, 1000);
      }

      renderQuizQuestion(quizId);
    } else {
      showToast('No se pudo iniciar el examen. Verifica tu membresía.');
      window.location.hash = '#/courses';
    }
  } catch (err) {
    console.error('Error al cargar examen:', err);
  }
}

function renderQuizQuestion(quizId) {
  const currentQ = state.quizQuestions[state.quizCurrentIndex];
  if (!currentQ) return;

  const numberLbl = document.getElementById('quiz-question-number');
  const questionTxt = document.getElementById('quiz-question-text');
  const optionsList = document.getElementById('quiz-options-list');
  const prevBtn = document.getElementById('quiz-prev-btn');
  const nextBtn = document.getElementById('quiz-next-btn');
  const progressFill = document.getElementById('quiz-progress-fill');

  const progressPercent = Math.round(((state.quizCurrentIndex) / state.quizQuestions.length) * 100);
  if (progressFill) progressFill.style.width = `${progressPercent}%`;

  if (numberLbl) numberLbl.innerText = `Pregunta ${state.quizCurrentIndex + 1} de ${state.quizQuestions.length}`;
  if (questionTxt) questionTxt.innerText = currentQ.question_text;

  if (optionsList) {
    optionsList.innerHTML = '';
    const optionsArray = currentQ.options || [];

    optionsArray.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn quiz-option-btn';
      
      const savedAns = state.quizAnswers.find(a => a.questionId === currentQ.id);
      if (savedAns && savedAns.answer === opt.key) {
        btn.classList.add('selected');
      }

      btn.innerHTML = `<span style="font-weight:700; margin-right:8px; text-transform:uppercase;">${opt.key})</span> ${opt.value}`;
      
      btn.onclick = () => {
        const index = state.quizAnswers.findIndex(a => a.questionId === currentQ.id);
        if (index > -1) {
          state.quizAnswers[index].answer = opt.key;
        } else {
          state.quizAnswers.push({ questionId: currentQ.id, answer: opt.key });
        }

        optionsList.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      };

      optionsList.appendChild(btn);
    });
  }

  if (prevBtn) {
    prevBtn.disabled = state.quizCurrentIndex === 0;
    prevBtn.onclick = () => {
      state.quizCurrentIndex--;
      renderQuizQuestion(quizId);
    };
  }

  if (nextBtn) {
    const isLast = state.quizCurrentIndex === state.quizQuestions.length - 1;
    nextBtn.innerText = isLast ? 'Finalizar Examen' : 'Siguiente';
    nextBtn.onclick = async () => {
      if (isLast) {
        clearInterval(state.quizTimerInterval);
        await submitQuiz(quizId);
      } else {
        state.quizCurrentIndex++;
        renderQuizQuestion(quizId);
      }
    };
  }
}

async function submitQuiz(quizId) {
  const unsubmitted = state.quizQuestions.filter(q => !state.quizAnswers.some(a => a.questionId === q.id));
  unsubmitted.forEach(q => {
    state.quizAnswers.push({ questionId: q.id, answer: '' });
  });

  try {
    const response = await fetch(`/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        answers: state.quizAnswers,
        timeSpentSeconds: 0
      })
    });

    if (response.ok) {
      state.lastQuizResult = await response.json();
      await fetchUserStats();
      window.location.hash = '#/quiz-review';
    } else {
      showToast('Error al procesar el examen.');
      window.location.hash = '#/courses';
    }
  } catch (err) {
    showToast('Error de red al calificar el examen.');
  }
}

/* ==========================================================================
   📝 VISTA 13: RESULTADOS DEL QUIZ (REVIEW)
   ========================================================================== */
function loadQuizReview() {
  const data = state.lastQuizResult;
  if (!data) {
    window.location.hash = '#/courses';
    return;
  }

  const badge = document.getElementById('quiz-score-badge');
  const headline = document.getElementById('quiz-review-headline');
  const summary = document.getElementById('quiz-review-summary');
  const rewards = document.getElementById('quiz-rewards-box');
  const feedbackList = document.getElementById('quiz-feedback-list');

  if (badge) {
    badge.innerText = `${data.score}%`;
    const color = data.passed ? 'var(--sage)' : 'var(--coral)';
    badge.style.background = `radial-gradient(closest-side, var(--bg-card) 79%, transparent 80% 100%), conic-gradient(${color} ${data.score}%, var(--hover-color) 0)`;
    badge.style.color = color;
  }

  if (headline) {
    headline.innerText = data.passed ? '🎉 ¡Felicidades! Examen Aprobado' : '😢 Examen Reprobado';
    headline.style.color = data.passed ? 'var(--sage)' : 'var(--coral)';
  }

  if (summary) {
    summary.innerText = `Obtuviste ${data.earned_points} de ${data.total_points} puntos posibles. Requieres mínimo ${data.passing_score}% para aprobar.`;
  }

  if (rewards) {
    if (data.passed && data.xp_added > 0) {
      rewards.classList.remove('hidden');
      rewards.innerHTML = `✨ ¡Felicidades! +${data.xp_added} XP ganados ✨`;
    } else {
      rewards.classList.add('hidden');
    }
  }

  if (feedbackList) {
    feedbackList.innerHTML = '';
    data.feedback.forEach(f => {
      const qDiv = document.createElement('div');
      qDiv.className = `feedback-question-item ${f.is_correct ? 'correct' : 'incorrect'}`;
      
      const studOption = f.options.find(o => o.key === f.student_answer);
      const corrOption = f.options.find(o => o.key === f.correct_answer);

      const studText = studOption ? `${studOption.key}) ${studOption.value}` : 'Ninguna';
      const corrText = corrOption ? `${corrOption.key}) ${corrOption.value}` : 'Desconocida';

      qDiv.innerHTML = `
        <div class="feedback-q-text">${f.question_text}</div>
        <div class="feedback-ans" style="margin-top:6px;">
          Tu respuesta: <span style="font-weight:600; color:${f.is_correct ? 'var(--sage)' : 'var(--coral)'}">${studText}</span>
        </div>
        ${!f.is_correct ? `<div class="feedback-ans">Respuesta correcta: <span style="font-weight:600; color:var(--sage)">${corrText}</span></div>` : ''}
        ${f.explanation ? `<div style="font-size:12px; color:var(--text-sub); margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-color-soft);"><strong>Explicación:</strong> ${f.explanation}</div>` : ''}
      `;
      feedbackList.appendChild(qDiv);
    });
  }

  document.getElementById('quiz-review-back-course').onclick = () => {
    if (state.activeCourseId) {
      window.location.hash = `#/course-view/${state.activeCourseId}`;
    } else {
      window.location.hash = '#/courses';
    }
  };

  document.getElementById('quiz-review-retry-btn').onclick = () => {
    if (state.lastQuizResult) {
      const quizId = state.quizQuestions[0]?.quiz_id || 1;
      window.location.hash = `#/quiz/${quizId}`;
    }
  };
}

/* ==========================================================================
   🎓 VISTA 14: VERIFICACIÓN PÚBLICA DE CERTIFICADO
   ========================================================================== */
async function loadVerifyCertificate(code) {
  try {
    const response = await fetch(`/api/notifications/verify/${code}`);
    const data = await response.json();

    const studentNameEl = document.getElementById('verify-student-name');
    const courseNameEl = document.getElementById('verify-course-name');
    const codeEl = document.getElementById('verify-code-lbl');
    const dateEl = document.getElementById('verify-date-lbl');

    if (response.ok && data.valid) {
      const c = data.certificate;
      const date = new Date(c.issued_at);
      
      if (studentNameEl) studentNameEl.innerText = c.student_name;
      if (courseNameEl) courseNameEl.innerText = c.course_name;
      if (codeEl) codeEl.innerText = c.certificate_code;
      if (dateEl) dateEl.innerText = date.toLocaleDateString();
      
      document.querySelector('.verification-badge').style.background = 'rgba(107,144,128,0.15)';
      document.querySelector('.verification-badge').style.color = 'var(--sage)';
      document.querySelector('.verification-badge span').innerText = 'CERTIFICADO VERIFICADO';
    } else {
      if (studentNameEl) studentNameEl.innerText = 'Diploma No Encontrado';
      if (courseNameEl) courseNameEl.innerText = 'El código de certificación es inválido o expiró.';
      if (codeEl) codeEl.innerText = code;
      if (dateEl) dateEl.innerText = 'N/A';

      document.querySelector('.verification-badge').style.background = 'rgba(255,107,71,0.15)';
      document.querySelector('.verification-badge').style.color = 'var(--coral)';
      document.querySelector('.verification-badge span').innerText = 'DIPLOMA INVÁLIDO';
    }
  } catch (err) {
    console.error('Error al verificar certificado:', err);
  }
}

/* ==========================================================================
   🎨 GENERADOR DE PDF EN CLIENTE (html2canvas + jsPDF)
   ========================================================================== */
function generateCertificatePDF(studentName, courseName, code, issuedAt) {
  const certContainer = document.createElement('div');
  certContainer.style.position = 'absolute';
  certContainer.style.left = '-9999px';
  certContainer.style.top = '-9999px';
  certContainer.style.width = '800px';
  certContainer.style.height = '560px';
  certContainer.style.padding = '50px';
  certContainer.style.boxSizing = 'border-box';
  certContainer.style.background = '#0E1B2C';
  certContainer.style.color = '#FFFFFF';
  certContainer.style.border = '15px solid #1F2D42';
  certContainer.style.fontFamily = "'DM Sans', sans-serif";
  certContainer.style.display = 'flex';
  certContainer.style.flexDirection = 'column';
  certContainer.style.justifyContent = 'space-between';
  certContainer.style.textAlign = 'center';

  certContainer.innerHTML = `
    <div style="position: absolute; top:0; left:0; right:0; height:6px; background: linear-gradient(90deg, #FF6B47 0%, #2D88E8 100%);"></div>
    <div style="font-family:'Space Grotesk',sans-serif; font-size: 24px; font-weight:700; letter-spacing:-0.02em;">
      ai<span style="color:#2D88E8;">Learning</span> Academy
    </div>
    
    <div style="margin-top: 30px;">
      <span style="font-family:'JetBrains Mono',monospace; font-size:11px; text-transform:uppercase; color:#FF6B47; letter-spacing:0.15em; font-weight:700;">DIPLOMA DE APRENDIZAJE</span>
      <h1 style="font-family:'Space Grotesk',sans-serif; font-size: 38px; margin-top: 15px; color:#FFFFFF;">${studentName}</h1>
      <p style="color:#A0AEC0; font-size: 14px; margin-top: 10px; max-width:550px; margin-left:auto; margin-right:auto; line-height:1.6;">
        Ha completado satisfactoriamente y con promedio aprobatorio todos los módulos formativos, evaluaciones prácticas y proyectos requeridos de la especialidad:
      </p>
      <h2 style="font-family:'Space Grotesk',sans-serif; font-size: 24px; color:#2D88E8; margin-top: 15px;">${courseName}</h2>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; margin-top:30px;">
      <div style="text-align:left;">
        <span style="font-size:10px; color:#6B7484; font-family:'JetBrains Mono',monospace; text-transform:uppercase;">Código de Validación</span><br>
        <span style="font-size:13px; font-family:'JetBrains Mono',monospace; font-weight:700; color:#FFFFFF;">${code}</span>
      </div>
      <div>
        <div style="font-size:12px; font-style:italic; font-family:'Space Grotesk',sans-serif; border-bottom:1px solid #6B7484; width:150px; padding-bottom:6px; color:#FFFFFF;">Jesús Salazar</div>
        <span style="font-size:9px; color:#6B7484; text-transform:uppercase;">Director de aiLearning</span>
      </div>
      <div style="text-align:right;">
        <span style="font-size:10px; color:#6B7484; font-family:'JetBrains Mono',monospace; text-transform:uppercase;">Fecha de Emisión</span><br>
        <span style="font-size:13px; font-family:'JetBrains Mono',monospace; font-weight:700; color:#FFFFFF;">${issuedAt}</span>
      </div>
    </div>
  `;

  document.body.appendChild(certContainer);

  showToast('Generando PDF del certificado...');

  setTimeout(() => {
    html2canvas(certContainer, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      
      const pdf = new jsPDF('l', 'px', [800, 560]);
      pdf.addImage(imgData, 'PNG', 0, 0, 800, 560);
      
      pdf.save(`certificado_${code}.pdf`);
      document.body.removeChild(certContainer);
      showToast('¡Certificado PDF descargado con éxito!');
    }).catch(err => {
      console.error(err);
      showToast('Error al exportar el certificado.');
      document.body.removeChild(certContainer);
    });
  }, 200);
}
