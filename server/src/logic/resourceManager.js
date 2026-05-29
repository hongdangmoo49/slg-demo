/**
 * Resource Manager - handles player resources, yields, collection
 */

const { getDB } = require('../config/database');
const config = require('../config/game');

class ResourceManager {
  constructor() {
    this.resources = new Map(); // roleId -> resource data
  }

  init() {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM role_resources').all();
    for (const row of rows) {
      this.resources.set(row.role_id, { ...row });
    }
    console.log(`Resources loaded for ${this.resources.size} roles`);
  }

  /**
   * Create resources for a new role
   */
  createResources(roleId) {
    const db = getDB();
    const sr = config.STARTING_RESOURCES;
    const sy = config.STARTING_YIELDS;

    db.prepare(`
      INSERT INTO role_resources (role_id, gold, food, wood, iron, stone, gold_yield, food_yield, wood_yield, iron_yield, stone_yield, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(roleId, sr.gold, sr.food, sr.wood, sr.iron, sr.stone,
           sy.gold, sy.food, sy.wood, sy.iron, sy.stone, config.DEFAULT_CAPACITY);

    const res = {
      role_id: roleId,
      gold: sr.gold, food: sr.food, wood: sr.wood, iron: sr.iron, stone: sr.stone,
      gold_yield: sy.gold, food_yield: sy.food, wood_yield: sy.wood,
      iron_yield: sy.iron, stone_yield: sy.stone,
      capacity: config.DEFAULT_CAPACITY,
      last_update: new Date().toISOString(),
    };
    this.resources.set(roleId, res);
    return res;
  }

  /**
   * Get current resources (with yield accrual since last update)
   */
  getResources(roleId) {
    let res = this.resources.get(roleId);
    if (!res) return null;

    // Calculate accrued yields
    const now = Date.now();
    const lastUpdate = new Date(res.last_update).getTime();
    const hoursElapsed = (now - lastUpdate) / (1000 * 60 * 60);

    if (hoursElapsed > 0.01) { // at least 36 seconds
      const accrued = this._accrueYields(res, hoursElapsed);
      this._updateResources(roleId, accrued);
      res = this.resources.get(roleId);
    }

    return res;
  }

  _accrueYields(res, hours) {
    const capacity = res.capacity;
    return {
      gold: Math.min(capacity, res.gold + Math.floor(res.gold_yield * hours)),
      food: Math.min(capacity, res.food + Math.floor(res.food_yield * hours)),
      wood: Math.min(capacity, res.wood + Math.floor(res.wood_yield * hours)),
      iron: Math.min(capacity, res.iron + Math.floor(res.iron_yield * hours)),
      stone: Math.min(capacity, res.stone + Math.floor(res.stone_yield * hours)),
    };
  }

  _updateResources(roleId, updated) {
    const db = getDB();
    db.prepare(`
      UPDATE role_resources SET gold = ?, food = ?, wood = ?, iron = ?, stone = ?, last_update = datetime('now')
      WHERE role_id = ?
    `).run(updated.gold, updated.food, updated.wood, updated.iron, updated.stone, roleId);

    const res = this.resources.get(roleId);
    if (res) {
      Object.assign(res, updated);
      res.last_update = new Date().toISOString();
    }
  }

  /**
   * Check if player can afford a cost
   */
  canAfford(roleId, cost) {
    const res = this.getResources(roleId);
    if (!res) return false;

    for (const [resource, amount] of Object.entries(cost)) {
      if ((res[resource] || 0) < amount) return false;
    }
    return true;
  }

  /**
   * Deduct resources
   */
  deductResources(roleId, cost) {
    if (!this.canAfford(roleId, cost)) return { error: 'Insufficient resources' };

    const res = this.resources.get(roleId);
    const updated = { ...res };
    for (const [resource, amount] of Object.entries(cost)) {
      updated[resource] = (updated[resource] || 0) - amount;
    }
    this._updateResources(roleId, updated);
    return { success: true };
  }

  /**
   * Add resources
   */
  addResources(roleId, amounts) {
    const res = this.resources.get(roleId);
    if (!res) return { error: 'Role not found' };

    const updated = {};
    for (const key of ['gold', 'food', 'wood', 'iron', 'stone']) {
      updated[key] = Math.min(res.capacity, (res[key] || 0) + (amounts[key] || 0));
    }
    this._updateResources(roleId, updated);
    return { success: true };
  }

  /**
   * Update yields (e.g., when gaining/losing territory)
   */
  updateYields(roleId, yieldChanges) {
    const res = this.resources.get(roleId);
    if (!res) return;

    const db = getDB();
    const updated = {
      gold_yield: (res.gold_yield || 0) + (yieldChanges.gold || 0),
      food_yield: (res.food_yield || 0) + (yieldChanges.food || 0),
      wood_yield: (res.wood_yield || 0) + (yieldChanges.wood || 0),
      iron_yield: (res.iron_yield || 0) + (yieldChanges.iron || 0),
      stone_yield: (res.stone_yield || 0) + (yieldChanges.stone || 0),
    };

    // Don't go below starting yields
    const sy = config.STARTING_YIELDS;
    for (const key of Object.keys(updated)) {
      const baseKey = key.replace('_yield', '');
      updated[key] = Math.max(sy[baseKey] || 0, updated[key]);
    }

    db.prepare(`
      UPDATE role_resources SET gold_yield = ?, food_yield = ?, wood_yield = ?, iron_yield = ?, stone_yield = ?
      WHERE role_id = ?
    `).run(updated.gold_yield, updated.food_yield, updated.wood_yield,
           updated.iron_yield, updated.stone_yield, roleId);

    Object.assign(res, updated);
  }

  /**
   * Daily collection (levy)
   */
  collect(roleId) {
    const db = getDB();
    const attr = db.prepare('SELECT * FROM role_attributes WHERE role_id = ?').get(roleId);

    if (!attr) return { error: 'Role not found' };

    if (attr.collect_times >= config.COLLECT_TIMES) {
      return { error: `Already collected ${config.COLLECT_TIMES} times today` };
    }

    const lastCollect = attr.last_collect ? new Date(attr.last_collect).getTime() : 0;
    const now = Date.now();
    if (now - lastCollect < config.COLLECT_INTERVAL * 1000) {
      return { error: 'Collection on cooldown' };
    }

    const res = this.getResources(roleId);
    const collection = {
      gold: Math.floor(res.gold_yield * 4),
      food: Math.floor(res.food_yield * 4),
      wood: Math.floor(res.wood_yield * 4),
      iron: Math.floor(res.iron_yield * 4),
      stone: Math.floor(res.stone_yield * 4),
    };

    this.addResources(roleId, collection);

    db.prepare(`
      UPDATE role_attributes SET collect_times = collect_times + 1, last_collect = datetime('now')
      WHERE role_id = ?
    `).run(roleId);

    return { success: true, collection };
  }
}

module.exports = new ResourceManager();
