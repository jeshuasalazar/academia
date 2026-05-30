const bcrypt = require('bcryptjs');
const { query, initDb } = require('./index');

async function seed() {
  console.log('🌱 Iniciando la siembra de datos (Seeding)...');
  
  // 1. Inicializar tablas
  await initDb();

  // 2. Limpiar tablas existentes en orden de dependencia
  console.log('🧹 Limpiando datos antiguos...');
  await query('DELETE FROM user_progress');
  await query('DELETE FROM users');
  await query('DELETE FROM lessons');
  await query('DELETE FROM courses');
  await query('DELETE FROM prompts');
  await query('DELETE FROM live_sessions');

  // 3. Crear Usuarios (Contraseñas encriptadas)
  console.log('👥 Creando usuarios predeterminados...');
  const salt = await bcrypt.genSalt(10);
  const studentPassword = await bcrypt.hash('123456', salt);
  const adminPassword = await bcrypt.hash('admin123', salt);

  // Insertar estudiante
  const studentResult = await query(
    `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      'Mariana Solís', 
      'estudiante@ailearning.mx', 
      studentPassword, 
      'student', 
      1, 
      45, 
      'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)'
    ]
  );
  const studentId = studentResult.rows && studentResult.rows.length ? studentResult.rows[0].id : 1;

  // Insertar administrador
  await query(
    `INSERT INTO users (name, email, password_hash, role, level, xp, avatar_gradient) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      'Admin aiLearning', 
      'admin@ailearning.mx', 
      adminPassword, 
      'admin', 
      5, 
      950, 
      'linear-gradient(135deg, #6B9080 0%, #0E1B2C 100%)'
    ]
  );

  // 4. Crear Cursos
  console.log('📚 Insertando cursos...');
  const course1 = await query(
    `INSERT INTO courses (title, description, thumbnail, category, level_required) 
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      'Prompt Engineering de Cero a Pro',
      'Domina el arte de comunicarte con modelos de lenguaje masivos (LLMs). Aprende técnicas de estructuración de prompts, roles, few-shot learning y cadena de pensamiento (Chain of Thought) para obtener respuestas hiper-precisas de Inteligencias Artificiales.',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
      'Inteligencia Artificial',
      1
    ]
  );
  const c1Id = course1.rows && course1.rows.length ? course1.rows[0].id : 1;

  const course2 = await query(
    `INSERT INTO courses (title, description, thumbnail, category, level_required) 
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      'Diseño UX/UI Avanzado con Inteligencia Artificial',
      'Aprende a acelerar tu flujo de trabajo de diseño web. Desde la conceptualización estructural hasta la codificación de componentes dinámicos y estilizado premium (glassmorphism) con el apoyo de herramientas de IA generativa.',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=600&auto=format&fit=crop',
      'Diseño & Desarrollo',
      2
    ]
  );
  const c2Id = course2.rows && course2.rows.length ? course2.rows[0].id : 2;

  // 5. Crear Lecciones
  console.log('📖 Insertando lecciones...');
  
  // Lecciones del Curso 1
  const lesson1 = await query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      c1Id,
      'Introducción a los LLMs y Prompting Básico',
      'Entiende cómo funcionan internamente los modelos fundacionales (GPT, Gemini, Claude). Aprenderás las bases del procesamiento del lenguaje natural y cómo estructurar tus primeras instrucciones claras y directas sin ambigüedades.',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      '08:15',
      1
    ]
  );
  const l1Id = lesson1.rows && lesson1.rows.length ? lesson1.rows[0].id : 1;

  await query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      c1Id,
      'Ingeniería de Prompts: Asignación de Roles y Contexto',
      'Aprende a transformar radicalmente el comportamiento de la Inteligencia Artificial simulando personalidades, experiencia técnica y entornos profesionales. Profundizaremos en la sintaxis óptima para fijar restricciones operativas.',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      '10:30',
      2
    ]
  );

  await query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      c1Id,
      'Técnicas Pro: Few-Shot Prompting y Chain of Thought',
      'Domina las metodologías que potencian el razonamiento lógico de la IA. En este módulo práctico, implementaremos ejemplos de aprendizaje por demostración y encadenamiento lógico estructurado para resolución de problemas complejos.',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      '14:20',
      3
    ]
  );

  // Lecciones del Curso 2
  await query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      c2Id,
      'Generación de Estructura Semántica de Interfaces con IA',
      'Aprende a redactar prompts eficientes para generar maquetación HTML5 ultra limpia y moderna. Evaluaremos cómo estructurar secciones semánticas complejas con el soporte de asistentes inteligentes.',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
      '09:45',
      1
    ]
  );

  await query(
    `INSERT INTO lessons (course_id, title, description, video_url, duration, order_num) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      c2Id,
      'Estilizado de Alta Gama y Glassmorphism Dinámico',
      'Codifica estilos de lujo usando CSS moderno. Aprenderás a dominar variables corporativas, filtros de fondo (backdrop-filter), efectos de refracción y gradientes fluidos aplicando micro-animaciones excepcionales.',
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      '12:10',
      2
    ]
  );

  // 6. Asignar Progreso Inicial (Para dar realismo al Dashboard)
  console.log('📈 Registrando progreso inicial del estudiante de prueba...');
  await query(
    `INSERT INTO user_progress (user_id, lesson_id, completed) 
     VALUES ($1, $2, $3)`,
    [studentId, l1Id, 1] // La lección 1 está completada para el alumno de prueba
  );

  // 7. Crear Prompts de IA en la biblioteca (Sección Unlimited Prompts)
  console.log('🤖 Insertando prompts en la galería...');
  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, $4)`,
    [
      'Redactor de Hilos de Twitter Virales',
      'Marketing',
      `Actúa como un estratega de contenido viral de Twitter. Escribe un hilo altamente enganchador de 5 tweets sobre [TEMA]. 
Utiliza la técnica de "gancho magnético" en el primer tweet, un tono dinámico y profesional, y emojis estratégicos. 
Finaliza con un llamado a la acción sutil y una pregunta interactiva.`,
      0
    ]
  );

  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, $4)`,
    [
      'Refactorizador de Código Limpio y Patrones de Diseño',
      'Desarrollo',
      `Eres un Ingeniero de Software Principal y Experto en Refactorización de código. Revisa el siguiente fragmento de código [LENGUAJE]:

[CÓDIGO]

Refactorízalo aplicando principios SOLID, patrones de diseño limpios y optimizando la complejidad algorítmica. 
Explica detalladamente cada mejora realizada paso a paso en formato Markdown.`,
      0
    ]
  );

  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, $4)`,
    [
      'Generador de Componentes CSS Glassmorphic de Lujo',
      'Diseño',
      `Genera código HTML5 semántico y CSS3 puro para un componente de tarjeta interactiva con efecto de Glassmorphism de ultra alta fidelidad. 
Debe utilizar un gradiente sutil de refracción en los bordes, desenfoque de fondo profundo (backdrop-filter: blur(16px)), 
sombras suaves multidimensionales, y transiciones dinámicas al hacer hover.`,
      1
    ]
  );

  await query(
    `INSERT INTO prompts (title, category, content, is_premium) 
     VALUES ($1, $2, $3, $4)`,
    [
      'Diseñador de Arquitectura de Base de Datos SQL',
      'Desarrollo',
      `Actúa como un Arquitecto de Datos Principal. Diseña el esquema de base de datos relacional para un sistema de [PROPÓSITO]. 
Proporciona el script de DDL completo de PostgreSQL con claves primarias, foráneas, restricciones, índices de rendimiento 
y una explicación paso a paso de la normalización aplicada.`,
      0
    ]
  );

  // 8. Crear Clases en Vivo (Módulo de Calendario)
  console.log('📅 Insertando sesiones programadas en vivo...');
  
  // Configurar fechas alrededor de la fecha actual simulada (Mayo/Junio 2026)
  await query(
    `INSERT INTO live_sessions (title, description, date_time, duration, meeting_link) 
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'Clase en Vivo: Estrategias Avanzadas de Prompt Engineering',
      'Sesión semanal interactiva para resolver dudas sobre Few-Shot y Chain of Thought con ejemplos reales traídos por los alumnos.',
      '2026-05-30 16:00:00', // Mañana
      '1.5 horas',
      'https://meet.google.com/abc-defg-hij'
    ]
  );

  await query(
    `INSERT INTO live_sessions (title, description, date_time, duration, meeting_link) 
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'Masterclass: Despliegue de Aplicaciones en Railway en 1 Clic',
      'Aprende a empaquetar tus desarrollos en contenedores Docker y configurarlos para que funcionen con bases de datos SQL de Railway en producción.',
      '2026-06-03 18:00:00', // Próxima semana
      '1 hora',
      'https://meet.google.com/xyz-uvwx-yza'
    ]
  );

  await query(
    `INSERT INTO live_sessions (title, description, date_time, duration, meeting_link) 
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'Taller Práctico: Creación de Componentes Modernos con CSS Puro',
      'Estudio analítico del Brand Manual de aiLearning y cómo trasladar sus variables de color a componentes web dinámicos.',
      '2026-06-05 17:00:00',
      '2 horas',
      'https://meet.google.com/mno-pqrs-tuv'
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
