/**
 * Database setup using better-sqlite3
 * Simple synchronous SQLite for demo purposes
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/slg.db');

let db = null;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initialize() {
  const db = getDB();

  // Users table (authentication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Roles table (player characters)
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      head_id INTEGER DEFAULT 0,
      faction TEXT DEFAULT 'europe',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      profile TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_online DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Resources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_resources (
      role_id INTEGER PRIMARY KEY,
      gold INTEGER DEFAULT 0,
      food INTEGER DEFAULT 0,
      wood INTEGER DEFAULT 0,
      iron INTEGER DEFAULT 0,
      stone INTEGER DEFAULT 0,
      gold_yield REAL DEFAULT 0,
      food_yield REAL DEFAULT 0,
      wood_yield REAL DEFAULT 0,
      iron_yield REAL DEFAULT 0,
      stone_yield REAL DEFAULT 0,
      capacity INTEGER DEFAULT 50000,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Role attributes (extended data stored as JSON)
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_attributes (
      role_id INTEGER PRIMARY KEY,
      alliance_id INTEGER,
      parent_role_id INTEGER,
      collect_times INTEGER DEFAULT 0,
      last_collect DATETIME,
      position_tags TEXT DEFAULT '[]',
      physical_power INTEGER DEFAULT 100,
      last_power_recovery DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Map cities
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      durability INTEGER DEFAULT 1000,
      max_durability INTEGER DEFAULT 1000,
      occupied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Map buildings (fortresses, resource tiles)
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      type INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      durability INTEGER DEFAULT 500,
      max_durability INTEGER DEFAULT 500,
      end_time DATETIME,
      give_up_time DATETIME,
      occupied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // City facilities (JSON stored)
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_facilities (
      city_id INTEGER PRIMARY KEY,
      facilities TEXT DEFAULT '[]',
      FOREIGN KEY (city_id) REFERENCES map_cities(id)
    )
  `);

  // Generals (heroes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS generals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      cfg_id TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      star INTEGER DEFAULT 1,
      star_lv INTEGER DEFAULT 0,
      cur_arms TEXT DEFAULT 'infantry',
      skills TEXT DEFAULT '[]',
      attr_force INTEGER DEFAULT 0,
      attr_strategy INTEGER DEFAULT 0,
      attr_defense INTEGER DEFAULT 0,
      attr_speed INTEGER DEFAULT 0,
      attr_destroy INTEGER DEFAULT 0,
      free_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Armies
  db.exec(`
    CREATE TABLE IF NOT EXISTS armies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      city_id INTEGER NOT NULL,
      army_order INTEGER DEFAULT 1,
      generals TEXT DEFAULT '[]',
      soldiers TEXT DEFAULT '[0,0,0]',
      command TEXT DEFAULT 'idle',
      from_x INTEGER DEFAULT 0,
      from_y INTEGER DEFAULT 0,
      to_x INTEGER DEFAULT 0,
      to_y INTEGER DEFAULT 0,
      start_time DATETIME,
      end_time DATETIME,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Alliances
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      chairman_id INTEGER NOT NULL,
      vice_chairman_id INTEGER,
      notice TEXT DEFAULT '',
      state INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chairman_id) REFERENCES roles(id)
    )
  `);

  // Alliance members
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      role_type INTEGER DEFAULT 2,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (alliance_id, role_id),
      FOREIGN KEY (alliance_id) REFERENCES alliances(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Alliance applications
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliance_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alliance_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (alliance_id) REFERENCES alliances(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // War reports
  db.exec(`
    CREATE TABLE IF NOT EXISTS war_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_id INTEGER NOT NULL,
      defender_id INTEGER NOT NULL,
      attacker_snapshot TEXT DEFAULT '{}',
      defender_snapshot TEXT DEFAULT '{}',
      rounds TEXT DEFAULT '[]',
      result TEXT DEFAULT 'draw',
      durability_damage INTEGER DEFAULT 0,
      occupation INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attacker_id) REFERENCES roles(id),
      FOREIGN KEY (defender_id) REFERENCES roles(id)
    )
  `);

  // Chat messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      message TEXT NOT NULL,
      target_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES roles(id)
    )
  `);

  console.log('Database initialized successfully');
  return db;
}

module.exports = { getDB, initialize };
