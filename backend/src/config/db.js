const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Helper to run queries with promises
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema
const initDB = async () => {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        parent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (parent_id) REFERENCES folders (id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        folder_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (folder_id) REFERENCES folders (id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        shared_with_id INTEGER,
        resource_type TEXT NOT NULL,
        resource_id INTEGER,
        permission_level TEXT DEFAULT 'read',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users (id),
        FOREIGN KEY (shared_with_id) REFERENCES users (id)
      )
    `);

    // Dynamically alter existing tables if they exist
    try {
      await dbRun('ALTER TABLE users ADD COLUMN name TEXT');
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      await dbRun('ALTER TABLE users ADD COLUMN security_question TEXT');
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      await dbRun('ALTER TABLE users ADD COLUMN security_answer TEXT');
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      await dbRun('ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id)');
    } catch (e) {
      // Column already exists, ignore error
    }

    try {
      await dbRun('ALTER TABLE documents ADD COLUMN folder_id INTEGER REFERENCES folders(id)');
    } catch (e) {
      // Column already exists, ignore error
    }

    console.log('Database tables initialized.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDB
};
