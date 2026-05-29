/**
 * General (Hero) Manager
 */

const { getDB } = require('../config/database');
const config = require('../config/game');
const staticData = require('../config/staticData');

class GeneralManager {
  constructor() {
    this.generals = new Map(); // roleId -> Map(cfgId -> general)
  }

  init() {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM generals').all();
    for (const row of rows) {
      if (!this.generals.has(row.role_id)) this.generals.set(row.role_id, new Map());
      row.skills = JSON.parse(row.skills || '[]');
      this.generals.get(row.role_id).set(row.id, row);
    }
    console.log(`Generals loaded: ${rows.length} total`);
  }

  /**
   * Draw (gacha) a random general
   */
  draw(roleId) {
    const generalsConfig = staticData.loadGenerals();
    const totalWeight = generalsConfig.generals.reduce((sum, g) => sum + g.drawWeight, 0);

    let roll = Math.random() * totalWeight;
    let selected = null;
    for (const g of generalsConfig.generals) {
      roll -= g.drawWeight;
      if (roll <= 0) { selected = g; break; }
    }

    if (!selected) selected = generalsConfig.generals[0];

    return this._createGeneral(roleId, selected);
  }

  _createGeneral(roleId, cfg) {
    const db = getDB();
    const result = db.prepare(`
      INSERT INTO generals (role_id, cfg_id, level, exp, star, star_lv, cur_arms, skills,
        attr_force, attr_strategy, attr_defense, attr_speed, attr_destroy, free_points)
      VALUES (?, ?, 1, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      roleId, cfg.cfgId, cfg.star,
      cfg.arms[0] || 'infantry',
      JSON.stringify(cfg.skills || []),
      cfg.baseStats.force, cfg.baseStats.strategy, cfg.baseStats.defense,
      cfg.baseStats.speed, cfg.baseStats.destroy
    );

    const general = {
      id: result.lastInsertRowid,
      role_id: roleId,
      cfg_id: cfg.cfgId,
      level: 1, exp: 0, star: cfg.star, star_lv: 0,
      cur_arms: cfg.arms[0] || 'infantry',
      skills: cfg.skills || [],
      attr_force: cfg.baseStats.force,
      attr_strategy: cfg.baseStats.strategy,
      attr_defense: cfg.baseStats.defense,
      attr_speed: cfg.baseStats.speed,
      attr_destroy: cfg.baseStats.destroy,
      free_points: 0,
      name: cfg.name,
      faction: cfg.faction,
    };

    if (!this.generals.has(roleId)) this.generals.set(roleId, new Map());
    this.generals.get(roleId).set(general.id, general);

    return general;
  }

  /**
   * Get all generals for a role
   */
  getGenerals(roleId) {
    const roleGenerals = this.generals.get(roleId);
    if (!roleGenerals) return [];

    // Enrich with config data
    return Array.from(roleGenerals.values()).map(g => {
      const cfg = staticData.getGeneralConfig(g.cfg_id);
      return { ...g, name: cfg?.name || 'Unknown', faction: cfg?.faction || 'europe', title: cfg?.title || '' };
    });
  }

  /**
   * Get a specific general
   */
  getGeneral(roleId, generalId) {
    const roleGenerals = this.generals.get(roleId);
    if (!roleGenerals) return null;
    const g = roleGenerals.get(generalId);
    if (!g) return null;
    const cfg = staticData.getGeneralConfig(g.cfg_id);
    return { ...g, name: cfg?.name || 'Unknown', faction: cfg?.faction || 'europe', title: cfg?.title || '' };
  }

  /**
   * Calculate total combat stats for a general
   */
  getCombatStats(general, facilityBonuses = {}) {
    const cfg = staticData.getGeneralConfig(general.cfg_id);
    if (!cfg) return null;

    const level = general.level || 1;
    const growth = cfg.growth;

    const stats = {
      force: cfg.baseStats.force + growth.force * level + (general.attr_force || 0) + (facilityBonuses.force || 0),
      strategy: cfg.baseStats.strategy + growth.strategy * level + (general.attr_strategy || 0) + (facilityBonuses.strategy || 0),
      defense: cfg.baseStats.defense + growth.defense * level + (general.attr_defense || 0) + (facilityBonuses.defense || 0),
      speed: cfg.baseStats.speed + growth.speed * level + (general.attr_speed || 0) + (facilityBonuses.speed || 0),
      destroy: cfg.baseStats.destroy + growth.destroy * level + (general.attr_destroy || 0) + (facilityBonuses.destroy || 0),
    };

    return stats;
  }

  /**
   * Add experience to a general (auto level up)
   */
  addExp(generalId, roleId, exp) {
    const roleGenerals = this.generals.get(roleId);
    if (!roleGenerals) return null;

    const g = roleGenerals.get(generalId);
    if (!g) return null;

    g.exp += exp;

    // Simple level up: every level * 100 exp
    const expNeeded = g.level * 100;
    if (g.exp >= expNeeded && g.level < config.MAX_GENERAL_LEVEL) {
      g.level++;
      g.exp -= expNeeded;
      g.free_points += 2;
    }

    // Save to DB
    const db = getDB();
    db.prepare('UPDATE generals SET level = ?, exp = ?, free_points = ? WHERE id = ?')
      .run(g.level, g.exp, g.free_points, g.id);

    return g;
  }

  /**
   * Allocate free attribute points
   */
  allocatePoints(roleId, generalId, allocations) {
    const roleGenerals = this.generals.get(roleId);
    if (!roleGenerals) return { error: 'No generals found' };

    const g = roleGenerals.get(generalId);
    if (!g) return { error: 'General not found' };

    const total = Object.values(allocations).reduce((s, v) => s + v, 0);
    if (total > g.free_points) return { error: 'Not enough free points' };

    g.attr_force += (allocations.force || 0);
    g.attr_strategy += (allocations.strategy || 0);
    g.attr_defense += (allocations.defense || 0);
    g.attr_speed += (allocations.speed || 0);
    g.attr_destroy += (allocations.destroy || 0);
    g.free_points -= total;

    const db = getDB();
    db.prepare(`
      UPDATE generals SET attr_force = ?, attr_strategy = ?, attr_defense = ?, attr_speed = ?, attr_destroy = ?, free_points = ?
      WHERE id = ?
    `).run(g.attr_force, g.attr_strategy, g.attr_defense, g.attr_speed, g.attr_destroy, g.free_points, g.id);

    return { success: true, general: g };
  }
}

module.exports = new GeneralManager();
