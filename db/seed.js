const bcrypt = require('bcryptjs');
const { query, initDb, isPostgres } = require('./index');

async function seed() {
  console.log('🌱 Iniciando la siembra de datos (Seeding)...');
  
  // 1. Inicializar tablas
  await initDb();

  // Helper para borrar tablas de forma segura
  async function cleanTable(tableName) {
    try {
      await query(`DELETE FROM ${tableName}`);
    } catch (e) {
      console.log(`Nota: No se pudo limpiar la tabla ${tableName} (puede que aún no exista o esté vacía).`);
    }
  }

  // 2. Limpiar tablas existentes en orden de dependencia
  console.log('🧹 Limpiando datos antiguos...');
  const tables = [
    'discussion_replies',
    'discussion_posts',
    'payments',
    'subscriptions',
    'notifications',
    'certificates',
    'session_bookings',
    'user_achievements',
    'achievements',
    'quiz_attempts',
    'quiz_questions',
    'quizzes',
    'lesson_materials',
    'user_progress',
    'lessons',
    'modules',
    'courses',
    'users',
    'prompts',
    'live_sessions'
  ];

  for (const t of tables) {
    await cleanTable(t);
  }

  // Resetear secuencias en PostgreSQL si aplica
  if (isPostgres) {
    const sequences = [
      'users_id_seq', 'courses_id_seq', 'modules_id_seq', 'lessons_id_seq', 
      'lesson_materials_id_seq', 'quizzes_id_seq', 'quiz_questions_id_seq', 
      'quiz_attempts_id_seq', 'achievements_id_seq', 'user_achievements_id_seq', 
      'live_sessions_id_seq', 'session_bookings_id_seq', 'certificates_id_seq', 
      'notifications_id_seq', 'prompts_id_seq', 'subscriptions_id_seq', 
      'payments_id_seq', 'discussion_posts_id_seq', 'discussion_replies_id_seq'
    ];
    for (const seq of sequences) {
      try {
        await query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
      } catch (e) {}
    }
  }

  // 3. Crear Usuarios (Contraseñas encriptadas)
  console.log('👥 Creando usuarios predeterminados...');
  const salt = await bcrypt.genSalt(10);
  const studentPassword = await bcrypt.hash('123456', salt);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const instructorPassword = await bcrypt.hash('123456', salt);

  // Estudiante Mariana
  const studentResult = await query(
    `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient, bio, timezone) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      'Mariana Solís', 
      'estudiante@ailearning.mx', 
      studentPassword, 
      'student', 
      2, 
      120, 
      'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)',
      'Apasionada de la Inteligencia Artificial y el diseño de experiencia de usuario.',
      'America/Mexico_City'
    ]
  );
  const studentId = studentResult.rows && studentResult.rows.length ? studentResult.rows[0].id : 1;

  // Administrador principal
  const adminResult = await query(
    `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient, bio, timezone) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      'Jesús Salazar', 
      'admin@ailearning.mx', 
      adminPassword, 
      'admin', 
      10, 
      2450, 
      'linear-gradient(135deg, #1A1C29 0%, #6B9080 100%)',
      'Director de aiLearning.mx y desarrollador full stack.',
      'America/Mexico_City'
    ]
  );
  const adminId = adminResult.rows && adminResult.rows.length ? adminResult.rows[0].id : 2;

  // Instructor Pablo
  const instructorResult = await query(
    `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient, bio, timezone) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      'Prof. Pablo Ramírez', 
      'pablo@ailearning.mx', 
      instructorPassword, 
      'instructor', 
      6, 
      1200, 
      'linear-gradient(135deg, #2A9D8F 0%, #E76F51 100%)',
      'Especialista en desarrollo cloud e Inteligencia Artificial aplicada.',
      'America/Mexico_City'
    ]
  );
  const instructorId = instructorResult.rows && instructorResult.rows.length ? instructorResult.rows[0].id : 3;

  // 4. Crear Cursos
  console.log('📚 Insertando cursos...');
  const c1Res = await query(
    `INSERT INTO courses (title, description, thumbnail, category, level_required, instructor_id, status, estimated_hours, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1) RETURNING id`,
    [
      'Prompt Engineering de Cero a Pro',
      'Domina el arte de comunicarte con modelos de lenguaje masivos (LLMs). Aprende técnicas de estructuración de prompts, roles, few-shot learning y cadena de pensamiento (Chain of Thought) para obtener respuestas hiper-precisas.',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
      'Inteligencia Artificial',
      1,
      adminId,
      'published',
      12
    ]
  );
  const c1Id = c1Res.rows && c1Res.rows.length ? c1Res.rows[0].id : 1;

  const c2Res = await query(
    `INSERT INTO courses (title, description, thumbnail, category, level_required, instructor_id, status, estimated_hours, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2) RETURNING id`,
    [
      'Diseño UX/UI Avanzado con IA',
      'Aprende a acelerar tu flujo de trabajo de diseño web. Desde la conceptualización estructural hasta la codificación de componentes dinámicos y estilizado premium (glassmorphism) con el apoyo de herramientas de IA generativa.',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=600&auto=format&fit=crop',
      'Diseño & Desarrollo',
      2,
      adminId,
      'published',
      15
    ]
  );
  const c2Id = c2Res.rows && c2Res.rows.length ? c2Res.rows[0].id : 2;

  const c3Res = await query(
    `INSERT INTO courses (title, description, thumbnail, category, level_required, instructor_id, status, estimated_hours, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 3) RETURNING id`,
    [
      'Despliegue de Aplicaciones en Railway y Docker',
      'Domina la infraestructura moderna. Aprende a contenerizar tus aplicaciones web en Docker, configurar bases de datos Postgres de Railway, configurar variables de entorno, y desplegar en entornos productivos con dominios personalizados.',
      'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?q=80&w=600&auto=format&fit=crop',
      'DevOps & Backend',
      3,
      instructorId,
      'published',
      8
    ]
  );
  const c3Id = c3Res.rows && c3Res.rows.length ? c3Res.rows[0].id : 3;

  // 5. Crear Módulos para Curso 1
  console.log('📦 Creando módulos...');
  
  // Curso 1 Módulos
  const m1_1 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c1Id, 'Fundamentos del Prompting', 'Bases operativas de la comunicación con LLMs.', 'Completaste la sección de fundamentos. Ahora entiendes qué es un token y cómo un modelo predice palabras.', 1]
  );
  const m1_1Id = m1_1.rows[0].id;

  const m1_2 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c1Id, 'Técnicas Intermedias de Ingeniería', 'Asignación de roles, restricciones and delimitadores estructurados.', 'Completaste el módulo 2. Has dominado la estructuración semántica de prompts.', 2]
  );
  const m1_2Id = m1_2.rows[0].id;

  const m1_3 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c1Id, 'Metodologías Avanzadas de Razonamiento', 'Few-Shot Prompting, Chain of Thought y autocoherencia.', '¡Felicidades! Completaste las metodologías de razonamiento lógico avanzado.', 3]
  );
  const m1_3Id = m1_3.rows[0].id;

  // Curso 2 Módulos
  const m2_1 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c2Id, 'Estructura Semántica con IA', 'Crear maquetas web utilizando prompts descriptivos.', 'Completaste la maquetación estructural. Estás listo para estilizar.', 1]
  );
  const m2_1Id = m2_1.rows[0].id;

  const m2_2 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c2Id, 'CSS Premium y Glassmorphism', 'Gradientes, desenfoques y micro-animaciones.', 'Módulo finalizado. Has dominado el diseño visual de gama alta.', 2]
  );
  const m2_2Id = m2_2.rows[0].id;

  // Curso 3 Módulos
  const m3_1 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c3Id, 'Dockerización Básica', 'Concepto de contenedor, Dockerfile e imágenes.', 'Completaste Docker básico. Ahora sabes empaquetar aplicaciones.', 1]
  );
  const m3_1Id = m3_1.rows[0].id;

  const m3_2 = await query(
    "INSERT INTO modules (course_id, title, description, summary, order_num) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [c3Id, 'Railway Cloud Platform', 'Conectar variables de entorno, PostgreSQL y dominios.', 'Terminaste Railway. Estás listo para lanzar proyectos en producción.', 2]
  );
  const m3_2Id = m3_2.rows[0].id;

  // 6. Crear Lecciones
  console.log('📖 Insertando lecciones...');
  
  // Curso 1, Módulo 1 Lecciones
  const l1 = await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'video', 'youtube') RETURNING id`,
    [c1Id, m1_1Id, 'Introducción a LLMs', 'Cómo funciona Gemini y GPT tras bambalinas.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '08:15']
  );
  const l1Id = l1.rows[0].id;

  await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 2, 'video', 'youtube')`,
    [c1Id, m1_1Id, 'La anatomía de una instrucción', 'Cómo construir un prompt simple pero robusto y sin ambigüedades.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '06:40']
  );

  // Curso 1, Módulo 2 Lecciones
  const l3 = await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'video', 'youtube') RETURNING id`,
    [c1Id, m1_2Id, 'Asignación de Roles y Contexto', 'Darle personalidad y profesión a la IA para regular su vocabulario.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '11:20']
  );
  const l3Id = l3.rows[0].id;

  await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 2, 'video', 'youtube')`,
    [c1Id, m1_2Id, 'Uso de delimitadores en prompts', 'Uso de XML tags, triple comillas y markdown para separar bloques.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '08:50']
  );

  // Curso 1, Módulo 3 Lecciones
  await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'video', 'youtube')`,
    [c1Id, m1_3Id, 'Few-Shot Learning', 'Entrenar al modelo dándole ejemplos en tiempo de ejecución.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '14:10']
  );

  await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 2, 'video', 'youtube')`,
    [c1Id, m1_3Id, 'Chain of Thought (Cadena de Pensamiento)', 'Cómo pedirle a la IA que explique paso a paso antes de dar su veredicto final.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '15:35']
  );

  // Curso 2, Módulo 1 Lecciones
  const l7 = await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'video', 'youtube') RETURNING id`,
    [c2Id, m2_1Id, 'Creando layouts semánticos', 'Redactar especificaciones para HTML5 limpio.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '10:05']
  );
  const l7Id = l7.rows[0].id;

  // Curso 3, Módulo 1 Lecciones
  const l8 = await query(
    `INSERT INTO lessons (course_id, module_id, title, description, video_url, duration, order_num, content_type, video_provider) 
     VALUES ($1, $2, $3, $4, $5, $6, 1, 'video', 'youtube') RETURNING id`,
    [c3Id, m3_1Id, 'Instalando Docker y tu primer Dockerfile', 'Cómo contenerizar un servidor Node.js express.', 'https://www.youtube.com/embed/zjkBMFhNj_g', '12:40']
  );
  const l8Id = l8.rows[0].id;

  // 7. Crear Materiales de Lección
  console.log('📎 Insertando materiales...');
  await query(
    `INSERT INTO lesson_materials (lesson_id, title, file_url, file_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)`,
    [l1Id, 'Guía de Fundamentos del Prompting.pdf', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf', 1048576]
  );
  await query(
    `INSERT INTO lesson_materials (lesson_id, title, file_url, file_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)`,
    [l3Id, 'Hacksheets de Roles y Delimitadores.pdf', 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', 'pdf', 2048576]
  );
  await query(
    `INSERT INTO lesson_materials (lesson_id, title, file_url, file_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)`,
    [l8Id, 'Template Dockerfile Express.zip', 'https://github.com/jeshuasalazar/academia/archive/refs/heads/main.zip', 'zip', 524288]
  );

  // 8. Crear Quizzes y Preguntas
  console.log('📝 Creando quizzes...');
  
  // Quiz 1 en Módulo 1 (Curso 1)
  const q1 = await query(
    `INSERT INTO quizzes (module_id, title, description, passing_score, time_limit_minutes, max_attempts) 
     VALUES ($1, $2, $3, 80, 10, 3) RETURNING id`,
    [m1_1Id, 'Examen de Fundamentos de Prompting', 'Evalúa tu conocimiento del primer módulo sobre LLMs y tokens.']
  );
  const q1Id = q1.rows[0].id;

  // Preguntas del Quiz 1
  await query(
    `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6, 10, $7)`,
    [
      q1Id, 
      '¿Qué es un "token" en el contexto de los modelos de lenguaje?', 
      'mcq', 
      JSON.stringify([
        { id: 'a', text: 'Una clave de seguridad de API.' },
        { id: 'b', text: 'Una unidad básica de texto (aproximadamente 4 caracteres) procesada por el modelo.' },
        { id: 'c', text: 'Una función interna para contar palabras.' }
      ]), 
      'b', 
      'Los tokens son los fragmentos de texto en los que los LLM dividen los textos antes de procesarlos. 100 tokens equivalen a unas 75 palabras.',
      1
    ]
  );

  await query(
    `INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6, 10, $7)`,
    [
      q1Id, 
      'Los modelos de lenguaje masivos predicen secuencialmente el siguiente token basándose en probabilidades.', 
      'true_false', 
      JSON.stringify([
        { id: 'true', text: 'Verdadero' },
        { id: 'false', text: 'Falso' }
      ]), 
      'true', 
      'Es correcto. Los LLMs son básicamente predictores probabilísticos del siguiente token basado en el contexto previo.',
      2
    ]
  );

  // 9. Crear Logros (Achievements)
  console.log('🏆 Insertando logros...');
  const achievements = [
    { name: 'Primeros Pasos', desc: 'Completaste tu primera lección en la academia.', icon: 'Award', type: 'lessons_completed', val: 1, reward: 25 },
    { name: 'Estudiante Constante', desc: 'Completaste 5 lecciones académicas.', icon: 'CheckCircle', type: 'lessons_completed', val: 5, reward: 100 },
    { name: 'Primera Victoria', desc: 'Aprobaste tu primer quiz con éxito.', icon: 'TrendingUp', type: 'quizzes_passed', val: 1, reward: 50 },
    { name: 'Mente Prodigiosa', desc: 'Aprobaste 3 quizzes de la plataforma.', icon: 'Cpu', type: 'quizzes_passed', val: 3, reward: 200 },
    { name: 'Racha Activa', desc: 'Mantén un streak de 3 días consecutivos de estudio.', icon: 'Zap', type: 'streak_days', val: 3, reward: 75 },
    { name: 'Imparable', desc: 'Consigue racha de 7 días consecutivos activos.', icon: 'Flame', type: 'streak_days', val: 7, reward: 250 },
    { name: 'Iniciación IA', desc: 'Cruza la meta y acumula tus primeros 100 XP.', icon: 'Activity', type: 'xp_reached', val: 100, reward: 50 },
    { name: 'Experto en Aprendizaje', desc: 'Acumula 1000 XP en total.', icon: 'Crown', type: 'xp_reached', val: 1000, reward: 500 },
    { name: 'Graduado Oficial', desc: 'Completa tu primer curso completo en la academia.', icon: 'GraduationCap', type: 'courses_completed', val: 1, reward: 300 }
  ];

  for (const ach of achievements) {
    await query(
      `INSERT INTO achievements (name, description, icon, criteria_type, criteria_value, xp_reward) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ach.name, ach.desc, ach.icon, ach.type, ach.val, ach.reward]
    );
  }

  // 10. Progreso inicial del estudiante (Mariana completó la lección 1 y aprobó el quiz 1)
  console.log('📈 Cargando progreso y aprobaciones iniciales...');
  
  // Completó lección 1
  if (isPostgres) {
    await query(
      `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) 
       VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)`,
      [studentId, l1Id]
    );
  } else {
    await query(
      `INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) 
       VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
      [studentId, l1Id]
    );
  }

  // Inscribirse al Curso 1
  await query(
    "INSERT INTO enrollments (user_id, course_id, status) VALUES ($1, $2, 'active')",
    [studentId, c1Id]
  );
  await query('UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1', [c1Id]);

  // Aprobó Quiz 1
  const answersJson = JSON.stringify([
    { questionId: 1, answer: 'b' },
    { questionId: 2, answer: 'true' }
  ]);
  
  if (isPostgres) {
    await query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, answers, time_spent_seconds, completed_at)
       VALUES ($1, $2, 100, TRUE, $3, 120, CURRENT_TIMESTAMP)`,
      [studentId, q1Id, answersJson]
    );
  } else {
    await query(
      `INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, answers, time_spent_seconds, completed_at)
       VALUES ($1, $2, 100, 1, $3, 120, CURRENT_TIMESTAMP)`,
      [studentId, q1Id, answersJson]
    );
  }

  // Otorgar logros iniciales correspondientes a Mariana (Primeros Pasos, Primera Victoria, Iniciación IA)
  // Conseguir ID de logros en base a nombres
  const p1 = await query("SELECT id FROM achievements WHERE name = 'Primeros Pasos'");
  const p2 = await query("SELECT id FROM achievements WHERE name = 'Primera Victoria'");
  const p3 = await query("SELECT id FROM achievements WHERE name = 'Iniciación IA'");

  const achievementsEarned = [p1.rows[0].id, p2.rows[0].id, p3.rows[0].id];
  for (const achId of achievementsEarned) {
    await query(
      'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
      [studentId, achId]
    );
  }

  // 11. Suscripción demo activa para Mariana (Student 1)
  console.log('💳 Creando membresía demo activa para Mariana...');
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
  
  if (isPostgres) {
    await query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [studentId, 'sub_demo_mariana_123', 'price_monthly_mock', 'monthly', 'active', oneMonthFromNow]
    );
  } else {
    await query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_price_id, plan, status, current_period_end, cancel_at_period_end) 
       VALUES ($1, $2, $3, $4, $5, $6, 0)`,
      [studentId, 'sub_demo_mariana_123', 'price_monthly_mock', 'monthly', 'active', oneMonthFromNow]
    );
  }

  // 12. Insertar Sesiones en Vivo
  console.log('📅 Insertando sesiones programadas en vivo...');
  
  // Sesión 1: Programada para mañana (Clase en vivo)
  const tomorrowStr = new Date();
  tomorrowStr.setDate(tomorrowStr.getDate() + 1);
  tomorrowStr.setHours(16, 0, 0, 0); // 4 PM

  await query(
    `INSERT INTO live_sessions (title, description, date_time, duration, max_participants, session_type, instructor_id, status, zoom_meeting_id, zoom_join_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)`,
    [
      'Clase en Vivo: Estrategias Avanzadas de Prompt Engineering',
      'Sesión práctica e interactiva donde evaluaremos técnicas CoT y Few-Shot aplicadas a workflows empresariales.',
      tomorrowStr,
      '1.5 horas',
      50,
      'live_class',
      adminId,
      'zoom_mock_112233',
      'https://zoom.us/j/mock-meeting-112233'
    ]
  );

  // Sesión 2: Programada para la próxima semana
  const nextWeekStr = new Date();
  nextWeekStr.setDate(nextWeekStr.getDate() + 7);
  nextWeekStr.setHours(18, 0, 0, 0);

  const session2Res = await query(
    `INSERT INTO live_sessions (title, description, date_time, duration, max_participants, session_type, instructor_id, status, zoom_meeting_id, zoom_join_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9) RETURNING id`,
    [
      'Masterclass: Despliegue de Aplicaciones en Railway en 1 Clic',
      'Aprende a empaquetar tus desarrollos en contenedores Docker y configurarlos para que funcionen con bases de datos SQL de Railway en producción.',
      nextWeekStr,
      '1 hora',
      100,
      'workshop',
      instructorId,
      'zoom_mock_445566',
      'https://zoom.us/j/mock-meeting-445566'
    ]
  );
  const s2Id = session2Res.rows[0].id;

  // Reservar lugar en Sesión 2 para Mariana
  await query(
    'INSERT INTO session_bookings (user_id, session_id, attended) VALUES ($1, $2, 0)',
    [studentId, s2Id]
  );

  // 13. Prompts predefinidos
  console.log('🤖 Insertando biblioteca de prompts...');
  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, 0)`,
    [
      'Redactor de Hilos de Twitter Virales',
      'Marketing',
      `Actúa como un estratega de contenido viral de Twitter. Escribe un hilo altamente enganchador de 5 tweets sobre [TEMA]. 
Utiliza la técnica de "gancho magnético" en el primer tweet, un tono dinámico y profesional, y emojis estratégicos. 
Finaliza con un llamado a la acción sutil y una pregunta interactiva.`
    ]
  );

  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, 0)`,
    [
      'Refactorizador de Código Limpio y Patrones de Diseño',
      'Desarrollo',
      `Eres un Ingeniero de Software Principal y Experto en Refactorización de código. Revisa el siguiente fragmento de código [LENGUAJE]:

[CÓDIGO]

Refactorízalo aplicando principios SOLID, patrones de diseño limpios y optimizando la complejidad algorítmica. 
Explica detalladamente cada mejora realizada paso a paso en formato Markdown.`
    ]
  );

  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, 1)`,
    [
      'Generador de Componentes CSS Glassmorphic de Lujo',
      'Diseño',
      `Genera código HTML5 semántico y CSS3 puro para un componente de tarjeta interactiva con efecto de Glassmorphism de ultra alta fidelidad. 
Debe utilizar un gradiente sutil de refracción en los bordes, desenfoque de fondo profundo (backdrop-filter: blur(16px)), 
sombras suaves multidimensionales, y transiciones dinámicas al hacer hover.`
    ]
  );

  // 14. Posts y respuestas en Comunidad global (Skool-style)
  console.log('💬 Insertando comunidad de ejemplo...');
  const pPost1 = await query(
    `INSERT INTO discussion_posts (course_id, user_id, title, content, pinned, likes_count, replies_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      c1Id,
      adminId,
      '📌 ¡Bienvenidos a la Comunidad de aiLearning Academy! Lee esto antes de empezar',
      `¡Hola prompters y desarrolladores! 👋

Estamos felices de darles la bienvenida a nuestro feed global de comunidad. Este es el espacio para compartir dudas, trucos, y logros operando con Inteligencia Artificial.

Por favor, sigan las reglas básicas:
1. Sé respetuoso y apoya a los compañeros.
2. Comparte tus prompts con las etiquetas de [Contexto] y [Variables] para que sea fácil probarlos.
3. Utiliza la sección correspondiente para publicar tus dudas técnicas.

¡Mucha suerte en su camino hacia el nivel 10! 🚀`,
      isPostgres ? true : 1,
      15,
      2
    ]
  );
  const post1Id = pPost1.rows[0].id;

  const pPost2 = await query(
    `INSERT INTO discussion_posts (course_id, user_id, title, content, pinned, likes_count, replies_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      null,
      studentId,
      '¿Qué tal funciona bunny.net para streaming de videos de lecciones?',
      `Hola a todos, estoy diseñando un sistema de e-learning y quiero evitar subir videos directo a S3 por costos. 

¿Alguien tiene experiencia usando Bunny stream? ¿Qué tal la velocidad de carga y la encriptación de video? Agradezco cualquier comentario.`,
      isPostgres ? false : 0,
      8,
      1
    ]
  );
  const post2Id = pPost2.rows[0].id;

  // Respuestas del Post 1
  await query(
    'INSERT INTO discussion_replies (post_id, user_id, content, likes_count) VALUES ($1, $2, $3, 3)',
    [post1Id, studentId, '¡Excelente iniciativa Jesús! Listo para arrancar el curso y subir de nivel 🔥.']
  );
  await query(
    'INSERT INTO discussion_replies (post_id, user_id, content, likes_count) VALUES ($1, $2, $3, 1)',
    [post1Id, instructorId, 'Bienvenidos a todos. Estaré compartiendo guías de Docker en los próximos días por aquí.']
  );

  // Respuestas del Post 2
  await query(
    'INSERT INTO discussion_replies (post_id, user_id, content, likes_count) VALUES ($1, $2, $3, 5)',
    [
      post2Id,
      adminId,
      `Hola Mariana. Bunny.net es excelente por su CDN integrada y encriptación Media-ID. 
Para e-learning es por mucho la mejor opción calidad-precio. En aiLearning lo usamos y la latencia es mínima.`
    ]
  );

  console.log('🌱 ¡La siembra de datos (Seeding) ha finalizado exitosamente!');
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seed().catch(err => {
    console.error('❌ Error durante la siembra:', err);
    process.exit(1);
  });
}

module.exports = seed;
