/**
 * City Facility Manager - handles city interior upgrades
 */

const { getDB } = require('../config/database');
const fs = require('fs');
const path = require('path');
const resourceManager = require('./resourceManager');

const CONF_DIR = path.join(__dirname, '../../data/conf');
let facilitiesConfig = null;

function loadFacilitiesConfig() {
  if (!facilitiesConfig) {
    facilitiesConfig = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'facilities.json'), 'utf-8'));
  }
  return facilitiesConfig;
}

class CityManager {
  constructor() {
    this.cities = new Map(); // cityId -> facilities array
  }

  init() {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM city_facilities').all();
    for (const row of rows) {
      this.cities.set(row.city_id, JSON.parse(row.facilities || '[]'));
    }
    loadFacilitiesConfig();
    console.log(`City facilities loaded: ${this.cities.size} cities`);
  }

  /**
   * Get facilities for a city
   */
  getFacilities(cityId) {
    const facilities = this.cities.get(cityId);
    if (!facilities) return [];
    return facilities.map(f => this._enrichFacility(f));
  }

  _enrichFacility(facility) {
    const config = loadFacilitiesConfig();
    const cfg = config.facilities[facility.id];
    if (!cfg) return facility;

    const levelData = cfg.levels.find(l => l.level === facility.level) || cfg.levels[0];
    const nextLevel = cfg.levels.find(l => l.level === facility.level + 1);

    return {
      ...facility,
      name: cfg.name,
      icon: cfg.icon,
      maxLevel: cfg.maxLevel,
      bonus: levelData?.bonus || {},
      upgradeCost: nextLevel?.cost || null,
      upgradeTime: nextLevel?.time || null,
      canUpgrade: !!nextLevel,
    };
  }

  /**
   * Upgrade a facility
   */
  upgradeFacility(roleId, cityId, facilityId) {
    const db = getDB();

    // Verify city ownership
    const city = db.prepare('SELECT * FROM map_cities WHERE id = ? AND role_id = ?').get(cityId, roleId);
    if (!city) return { error: 'City not found or not owned' };

    const config = loadFacilitiesConfig();
    const cfg = config.facilities[facilityId];
    if (!cfg) return { error: 'Unknown facility' };

    // Get current facilities
    let facilities = this.cities.get(cityId);
    if (!facilities) {
      facilities = [{ id: 'main_hall', level: 1 }];
    }

    const facility = facilities.find(f => f.id === facilityId);
    if (!facility) return { error: 'Facility not built yet' };

    const nextLevel = cfg.levels.find(l => l.level === facility.level + 1);
    if (!nextLevel) return { error: 'Already at max level' };

    // Check prerequisites (main_hall level must be >= facility level)
    if (facilityId !== 'main_hall') {
      const mainHall = facilities.find(f => f.id === 'main_hall');
      if (!mainHall || mainHall.level < facility.level) {
        return { error: 'Governor Palace level too low' };
      }
    }

    // Check cost
    if (!resourceManager.canAfford(roleId, nextLevel.cost)) {
      return { error: 'Insufficient resources', cost: nextLevel.cost };
    }

    // Deduct cost
    resourceManager.deductResources(roleId, nextLevel.cost);

    // Upgrade
    facility.level = nextLevel.level;

    // Apply bonuses
    this._applyBonuses(roleId, facilities);

    // Save
    db.prepare('UPDATE city_facilities SET facilities = ? WHERE city_id = ?')
      .run(JSON.stringify(facilities), cityId);
    this.cities.set(cityId, facilities);

    return {
      success: true,
      facility: this._enrichFacility(facility),
      bonus: nextLevel.bonus,
    };
  }

  /**
   * Apply facility bonuses to role resources/stats
   */
  _applyBonuses(roleId, facilities) {
    const config = loadFacilitiesConfig();
    const yieldChanges = { gold: 0, food: 0, wood: 0, iron: 0, stone: 0 };

    for (const facility of facilities) {
      const cfg = config.facilities[facility.id];
      if (!cfg) continue;
      const levelData = cfg.levels.find(l => l.level === facility.level);
      if (!levelData?.bonus) continue;

      if (levelData.bonus.goldYield) yieldChanges.gold += levelData.bonus.goldYield;
      if (levelData.bonus.foodYield) yieldChanges.food += levelData.bonus.foodYield;
      if (levelData.bonus.woodYield) yieldChanges.wood += levelData.bonus.woodYield;
      if (levelData.bonus.ironYield) yieldChanges.iron += levelData.bonus.ironYield;
      if (levelData.bonus.stoneYield) yieldChanges.stone += levelData.bonus.stoneYield;
      if (levelData.bonus.capacity) {
        resourceManager.resources.get(roleId).capacity = levelData.bonus.capacity;
      }
    }

    resourceManager.updateYields(roleId, yieldChanges);
  }

  /**
   * Get combat bonuses from facilities
   */
  getCombatBonuses(roleId, cityId) {
    const facilities = this.cities.get(cityId);
    if (!facilities) return {};

    const config = loadFacilitiesConfig();
    const bonuses = {};

    for (const facility of facilities) {
      const cfg = config.facilities[facility.id];
      if (!cfg) continue;
      const levelData = cfg.levels.find(l => l.level === facility.level);
      if (!levelData?.bonus) continue;

      for (const [key, val] of Object.entries(levelData.bonus)) {
        if (['force', 'strategy', 'defense', 'speed', 'destroy'].includes(key)) {
          bonuses[key] = (bonuses[key] || 0) + val;
        }
      }
    }

    return bonuses;
  }

  /**
   * Get technologies config
   */
  getTechnologies() {
    const config = loadFacilitiesConfig();
    return config.technologies || {};
  }
}

module.exports = new CityManager();
