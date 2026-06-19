const { query, isPostgres, initDb } = require('./index');

async function runMigrations() {
  console.log('⚡ Iniciando migraciones de la base de datos...');
  
  // A. Inicializar tablas base si no existen
  await initDb();

  // 1. Crear tabla de registro de migraciones si no existe
  if (isPostgres) {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Helper para verificar si una columna existe
  async function columnExists(tableName, columnName) {
    if (isPostgres) {
      const res = await query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = $2`,
        [tableName.toLowerCase(), columnName.toLowerCase()]
      );
      return res.rowCount > 0;
    } else {
      const res = await query(`PRAGMA table_info(${tableName})`);
      return res.rows.some(row => row.name.toLowerCase() === columnName.toLowerCase());
    }
  }

  // Helper para añadir una columna si no existe
  async function addColumn(tableName, columnName, postgresType, sqliteType) {
    const exists = await columnExists(tableName, columnName);
    if (!exists) {
      console.log(`➕ Añadiendo columna [${columnName}] a la tabla [${tableName}]...`);
      const type = isPostgres ? postgresType : sqliteType;
      await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${type}`);
    }
  }

  // Helper para verificar si una migración ya fue aplicada
  async function isMigrationApplied(version) {
    const res = await query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    return res.rowCount > 0;
  }

  // Helper para marcar migración como aplicada
  async function markMigrationApplied(version) {
    await query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    console.log(`✅ Migración [${version}] aplicada exitosamente.`);
  }

  // --- MIGRACIÓN 1: Tablas Fundacionales y Relaciones de Módulos ---
  if (!(await isMigrationApplied('v2_db_restructuring'))) {
    console.log('📦 Aplicando reestructuración de Base de Datos para v2...');

    // A. Crear tabla de módulos si no existe
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS modules (
          id SERIAL PRIMARY KEY,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          summary TEXT,
          order_num INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          summary TEXT,
          order_num INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
      `);
    }

    // B. Crear módulos "General" para cursos existentes sin módulos
    const coursesRes = await query('SELECT id, title FROM courses');
    for (const course of coursesRes.rows) {
      const moduleRes = await query('SELECT id FROM modules WHERE course_id = $1', [course.id]);
      if (moduleRes.rowCount === 0) {
        console.log(`🔨 Creando módulo 'General' para el curso: "${course.title}"...`);
        if (isPostgres) {
          await query(
            `INSERT INTO modules (course_id, title, description, summary, order_num) 
             VALUES ($1, $2, $3, $4, $5)`,
            [course.id, 'General', 'Módulo general del curso', 'Completaste el contenido general del curso.', 1]
          );
        } else {
          await query(
            `INSERT INTO modules (course_id, title, description, summary, order_num) 
             VALUES (?, ?, ?, ?, ?)`,
            [course.id, 'General', 'Módulo general del curso', 'Completaste el contenido general del curso.', 1]
          );
        }
      }
    }

    // C. Agregar module_id a lessons si no existe
    await addColumn('lessons', 'module_id', 'INTEGER REFERENCES modules(id) ON DELETE CASCADE', 'INTEGER');

    // D. Migrar lessons.course_id a lessons.module_id
    const lessonsRes = await query('SELECT id, course_id, module_id FROM lessons');
    for (const lesson of lessonsRes.rows) {
      if (!lesson.module_id && lesson.course_id) {
        // Encontrar el primer módulo del curso de esta lección
        const moduleRes = await query(
          'SELECT id FROM modules WHERE course_id = $1 ORDER BY order_num ASC LIMIT 1',
          [lesson.course_id]
        );
        if (moduleRes.rows && moduleRes.rows.length > 0) {
          const mId = moduleRes.rows[0].id;
          console.log(`🔗 Asociando lección [ID: ${lesson.id}] al módulo [ID: ${mId}]...`);
          await query('UPDATE lessons SET module_id = $1 WHERE id = $2', [mId, lesson.id]);
        }
      }
    }

    // Nota: Dejamos course_id en lessons como nullable/deprecado en lugar de intentar hacer DROP en SQLite
    if (isPostgres) {
      // Hacer module_id NOT NULL en Postgres
      await query('ALTER TABLE lessons ALTER COLUMN module_id SET NOT NULL');
    }

    // E. Columnas adicionales en users
    await addColumn('users', 'bio', 'TEXT', 'TEXT');
    await addColumn('users', 'timezone', 'VARCHAR(100) DEFAULT \'America/Mexico_City\'', 'TEXT DEFAULT \'America/Mexico_City\'');
    await addColumn('users', 'avatar_url', 'VARCHAR(255)', 'TEXT');
    await addColumn('users', 'last_login_at', 'TIMESTAMP', 'DATETIME');
    await addColumn('users', 'streak_count', 'INTEGER DEFAULT 0', 'INTEGER DEFAULT 0');
    await addColumn('users', 'longest_streak', 'INTEGER DEFAULT 0', 'INTEGER DEFAULT 0');
    await addColumn('users', 'streak_last_date', 'VARCHAR(50)', 'TEXT');
    await addColumn('users', 'reset_token', 'VARCHAR(100)', 'TEXT');
    await addColumn('users', 'reset_token_expires', 'TIMESTAMP', 'DATETIME');
    await addColumn('users', 'stripe_customer_id', 'VARCHAR(255) UNIQUE', 'TEXT');
    if (!isPostgres) {
      await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id)');
    }

    // F. Columnas adicionales en courses
    await addColumn('courses', 'instructor_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL', 'INTEGER');
    await addColumn('courses', 'status', 'VARCHAR(20) DEFAULT \'draft\'', 'TEXT DEFAULT \'draft\'');
    await addColumn('courses', 'estimated_hours', 'INTEGER DEFAULT 10', 'INTEGER DEFAULT 10');
    await addColumn('courses', 'enrollment_count', 'INTEGER DEFAULT 0', 'INTEGER DEFAULT 0');
    await addColumn('courses', 'order_num', 'INTEGER DEFAULT 0', 'INTEGER DEFAULT 0');

    // G. Columnas adicionales en lessons
    await addColumn('lessons', 'content_type', 'VARCHAR(50) DEFAULT \'video\'', 'TEXT DEFAULT \'video\'');
    await addColumn('lessons', 'video_provider', 'VARCHAR(50) DEFAULT \'youtube\'', 'TEXT DEFAULT \'youtube\'');

    // H. Columnas adicionales en user_progress
    await addColumn('user_progress', 'time_spent_seconds', 'INTEGER DEFAULT 0', 'INTEGER DEFAULT 0');
    await addColumn('user_progress', 'notes', 'TEXT', 'TEXT');

    // I. Columnas adicionales en live_sessions
    await addColumn('live_sessions', 'instructor_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL', 'INTEGER');
    await addColumn('live_sessions', 'max_participants', 'INTEGER DEFAULT 100', 'INTEGER DEFAULT 100');
    await addColumn('live_sessions', 'session_type', 'VARCHAR(50) DEFAULT \'live_class\'', 'TEXT DEFAULT \'live_class\'');
    await addColumn('live_sessions', 'recording_url', 'VARCHAR(500)', 'TEXT');
    await addColumn('live_sessions', 'status', 'VARCHAR(30) DEFAULT \'scheduled\'', 'TEXT DEFAULT \'scheduled\'');
    await addColumn('live_sessions', 'zoom_meeting_id', 'VARCHAR(255)', 'TEXT');
    await addColumn('live_sessions', 'zoom_join_url', 'TEXT', 'TEXT');
    await addColumn('live_sessions', 'zoom_start_url', 'TEXT', 'TEXT');

    await markMigrationApplied('v2_db_restructuring');
  }

  // --- MIGRACIÓN 2: Nuevas Tablas de Features v2 ---
  if (!(await isMigrationApplied('v2_new_features_tables'))) {
    console.log('📦 Creando nuevas tablas para las características v2...');

    // Enrollments
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS enrollments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          completed_at TIMESTAMP,
          last_accessed_at TIMESTAMP,
          UNIQUE(user_id, course_id)
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS enrollments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active',
          completed_at DATETIME,
          last_accessed_at DATETIME,
          UNIQUE(user_id, course_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
      `);
    }

    // Lesson Materials
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS lesson_materials (
          id SERIAL PRIMARY KEY,
          lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          file_url VARCHAR(500) NOT NULL,
          file_type VARCHAR(50),
          file_size_bytes INTEGER,
          download_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS lesson_materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          file_url TEXT NOT NULL,
          file_type TEXT,
          file_size_bytes INTEGER,
          download_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        );
      `);
    }

    // Quizzes
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id SERIAL PRIMARY KEY,
          module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          passing_score INTEGER DEFAULT 70,
          time_limit_minutes INTEGER,
          max_attempts INTEGER DEFAULT 3,
          randomize_questions BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          passing_score INTEGER DEFAULT 70,
          time_limit_minutes INTEGER,
          max_attempts INTEGER DEFAULT 3,
          randomize_questions INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(module_id) REFERENCES modules(id) ON DELETE CASCADE
        );
      `);
    }

    // Quiz Questions
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
          id SERIAL PRIMARY KEY,
          quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          question_text TEXT NOT NULL,
          question_type VARCHAR(20) NOT NULL,
          options TEXT,
          correct_answer TEXT NOT NULL,
          explanation TEXT,
          points INTEGER DEFAULT 10,
          order_num INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quiz_id INTEGER NOT NULL,
          question_text TEXT NOT NULL,
          question_type TEXT NOT NULL,
          options TEXT,
          correct_answer TEXT NOT NULL,
          explanation TEXT,
          points INTEGER DEFAULT 10,
          order_num INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
        );
      `);
    }

    // Quiz Attempts
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
          score INTEGER NOT NULL,
          passed BOOLEAN NOT NULL,
          answers TEXT,
          time_spent_seconds INTEGER,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          quiz_id INTEGER NOT NULL,
          score INTEGER NOT NULL,
          passed INTEGER NOT NULL,
          answers TEXT,
          time_spent_seconds INTEGER,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
        );
      `);
    }

    // Achievements
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS achievements (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          icon VARCHAR(50) NOT NULL,
          criteria_type VARCHAR(50) NOT NULL,
          criteria_value INTEGER NOT NULL,
          xp_reward INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          icon TEXT NOT NULL,
          criteria_type TEXT NOT NULL,
          criteria_value INTEGER NOT NULL,
          xp_reward INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // User Achievements
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
          earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, achievement_id)
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_id INTEGER NOT NULL,
          earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, achievement_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
        );
      `);
    }

    // Session Bookings
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS session_bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
          booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          attended BOOLEAN DEFAULT FALSE,
          UNIQUE(user_id, session_id)
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS session_bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          session_id INTEGER NOT NULL,
          booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          attended INTEGER DEFAULT 0,
          UNIQUE(user_id, session_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
        );
      `);
    }

    // Certificates
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS certificates (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          certificate_code VARCHAR(50) UNIQUE NOT NULL,
          issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, course_id)
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS certificates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          certificate_code TEXT UNIQUE NOT NULL,
          issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, course_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
        );
      `);
    }

    // Notifications
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          data TEXT,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT,
          data TEXT,
          read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    }

    // Subscriptions
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          stripe_subscription_id VARCHAR(255) UNIQUE,
          stripe_price_id VARCHAR(255),
          plan VARCHAR(20) NOT NULL,
          status VARCHAR(30) NOT NULL,
          current_period_end TIMESTAMP,
          cancel_at_period_end BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          stripe_subscription_id TEXT UNIQUE,
          stripe_price_id TEXT,
          plan TEXT NOT NULL,
          status TEXT NOT NULL,
          current_period_end DATETIME,
          cancel_at_period_end INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id),
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    }

    // Payments
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          stripe_event_id VARCHAR(255) UNIQUE,
          stripe_invoice_id VARCHAR(255),
          amount_cents INTEGER,
          currency VARCHAR(10) DEFAULT 'mxn',
          status VARCHAR(30),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          stripe_event_id TEXT UNIQUE,
          stripe_invoice_id TEXT,
          amount_cents INTEGER,
          currency TEXT DEFAULT 'mxn',
          status TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `);
    }

    // Discussion Posts
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS discussion_posts (
          id SERIAL PRIMARY KEY,
          course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          pinned BOOLEAN DEFAULT FALSE,
          likes_count INTEGER DEFAULT 0,
          replies_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS discussion_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_id INTEGER,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          pinned INTEGER DEFAULT 0,
          likes_count INTEGER DEFAULT 0,
          replies_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    }

    // Discussion Replies
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS discussion_replies (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          likes_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS discussion_replies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          likes_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
    }

    await markMigrationApplied('v2_new_features_tables');
  }

  // --- MIGRACIÓN 3: Índices para Rendimiento ---
  if (!(await isMigrationApplied('v2_performance_indexes'))) {
    console.log('⚡ Creando índices de base de datos para optimización...');
    await query('CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_posts_user ON discussion_posts(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_replies_post ON discussion_replies(post_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)');
    
    await markMigrationApplied('v2_performance_indexes');
  }

  // --- MIGRACIÓN 4: Integración con Clerk Auth ---
  if (!(await isMigrationApplied('v3_clerk_auth_integration'))) {
    console.log('⚡ Aplicando migración para Clerk Auth...');
    
    // 1. Añadir columna clerk_id a users
    await addColumn('users', 'clerk_id', 'VARCHAR(255)', 'TEXT');
    
    // 2. Crear índice único para clerk_id
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users (clerk_id)');
    console.log('🔑 Índice único creado para clerk_id.');
    
    // 3. Hacer password_hash NULLABLE en PostgreSQL
    if (isPostgres) {
      try {
        await query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
        console.log('🔓 password_hash cambiado a NULLABLE en PostgreSQL.');
      } catch (e) {
        console.log('⚠️ No se pudo alterar password_hash (quizás ya es nullable):', e.message);
      }
    }
    
    await markMigrationApplied('v3_clerk_auth_integration');
  }

  console.log('🎉 ¡Todas las migraciones se han ejecutado con éxito!');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Error ejecutando migraciones:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
