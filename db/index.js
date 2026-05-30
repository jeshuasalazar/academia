const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

// Determinar si estamos usando PostgreSQL (Producción en Railway) o SQLite (Local)
const isPostgres = process.env.DATABASE_URL && (
  process.env.DATABASE_URL.startsWith('postgres://') || 
  process.env.DATABASE_URL.startsWith('postgresql://')
);

let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  console.log('🔌 Conectando a la base de datos PostgreSQL (Railway)...');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Requerido para conexiones seguras en Railway
    }
  });
} else {
  console.log('📁 Iniciando base de datos SQLite local...');
  const dbDir = path.join(__dirname);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'ailearning.db');
  sqliteDb = new sqlite3.Database(dbPath);
}

/**
 * Ejecuta una consulta SQL con parámetros.
 * Traduce automáticamente sintaxis de Postgres ($1) a SQLite (?) si es necesario.
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (isPostgres) {
      pgPool.query(sql, params, (err, res) => {
        if (err) return reject(err);
        resolve({ rows: res.rows, rowCount: res.rowCount });
      });
    } else {
      // Traducir $1, $2... a ? para SQLite
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      
      // Determinar si es una consulta de lectura o escritura
      const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');
      
      if (isSelect) {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        });
      } else {
        sqliteDb.run(sqliteSql, params, function(err) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
        });
      }
    }
  });
}

/**
 * Inicializa las tablas de la base de datos según el motor activo.
 */
async function initDb() {
  if (isPostgres) {
    console.log('🛠️ Inicializando tablas en PostgreSQL...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        avatar_gradient VARCHAR(255) DEFAULT 'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        thumbnail VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        level_required INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        video_url VARCHAR(255),
        duration VARCHAR(50),
        order_num INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
        completed BOOLEAN DEFAULT TRUE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, lesson_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        is_premium BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date_time TIMESTAMP NOT NULL,
        duration VARCHAR(50),
        meeting_link VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    console.log('🛠️ Inicializando tablas en SQLite...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'student',
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        avatar_gradient TEXT DEFAULT 'linear-gradient(135deg, #FF6B47 0%, #2D88E8 100%)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        thumbnail TEXT NOT NULL,
        category TEXT NOT NULL,
        level_required INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT,
        duration TEXT,
        order_num INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        user_id INTEGER,
        lesson_id INTEGER,
        completed INTEGER DEFAULT 1,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, lesson_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        is_premium INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date_time TEXT NOT NULL,
        duration TEXT,
        meeting_link TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  console.log('✅ Base de datos estructurada correctamente.');
}

module.exports = {
  query,
  initDb,
  isPostgres
};
