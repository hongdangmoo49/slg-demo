/**
 * Auth Controller - REST API for registration/login
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');
const config = require('../config/game');
const mapManager = require('../logic/mapManager');
const resourceManager = require('../logic/resourceManager');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters' });
  }

  const db = getDB();

  // Check if exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Create user (simple hash for demo - use bcrypt in production)
  const result = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).run(username, `hash_${password}`);

  const userId = result.lastInsertRowid;

  res.json({ success: true, userId });
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
    .get(username, `hash_${password}`);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Get or create role
  let role = db.prepare('SELECT * FROM roles WHERE user_id = ?').get(user.id);

  if (!role) {
    // Auto-create role on first login
    const roleResult = db.prepare(`
      INSERT INTO roles (user_id, nickname, faction, level, exp, balance)
      VALUES (?, ?, 'europe', 1, 0, 0)
    `).run(user.id, username);

    const roleId = roleResult.lastInsertRowid;

    // Create resources
    resourceManager.createResources(roleId);

    // Create role attributes
    db.prepare(`
      INSERT INTO role_attributes (role_id, collect_times, physical_power)
      VALUES (?, 0, 100)
    `).run(roleId);

    // Place main city at random unoccupied position
    const startX = 10 + Math.floor(Math.random() * 80);
    const startY = 10 + Math.floor(Math.random() * 80);
    mapManager.createCity(roleId, startX, startY, `${username}'s City`, true);

    role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);

    // Give starting generals
    const generalManager = require('../logic/generalManager');
    generalManager.draw(roleId);
    generalManager.draw(roleId);
    generalManager.draw(roleId);

    // Create starting army
    const armyManager = require('../logic/armyManager');
    const city = mapManager.getMainCity(roleId);
    if (city) {
      armyManager.createArmy(roleId, city.id, 1);
    }
  }

  // Update last login
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  db.prepare("UPDATE roles SET last_online = datetime('now') WHERE id = ?").run(role.id);

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, roleId: role.id },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    role: {
      id: role.id,
      nickname: role.nickname,
      faction: role.faction,
      level: role.level,
    },
  });
});

// Get role list for user
router.get('/roles', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), config.JWT_SECRET);
    const db = getDB();
    const roles = db.prepare('SELECT id, nickname, faction, level FROM roles WHERE user_id = ?')
      .all(decoded.userId);
    res.json({ roles });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Select role (for multi-role support)
router.post('/selectRole', (req, res) => {
  const { roleId } = req.body;
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), config.JWT_SECRET);
    const db = getDB();
    const role = db.prepare('SELECT * FROM roles WHERE id = ? AND user_id = ?')
      .get(roleId, decoded.userId);

    if (!role) return res.status(404).json({ error: 'Role not found' });

    const token = jwt.sign(
      { userId: decoded.userId, roleId: role.id },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      role: {
        id: role.id,
        nickname: role.nickname,
        faction: role.faction,
        level: role.level,
      },
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
