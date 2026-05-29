/**
 * Map Manager - handles map state, buildings, cities
 */

const { getDB } = require('../config/database');
const config = require('../config/game');
const staticData = require('../config/staticData');

class MapManager {
  constructor() {
    this.playerBuildings = new Map(); // posKey -> building data
    this.playerCities = new Map();   // cityId -> city data
    this.positionIndex = new Map();  // posKey -> Set of roleIds
    this.rolePositions = new Map();  // roleId -> Set of posKeys
  }

  init() {
    const db = getDB();

    // Load existing cities
    const cities = db.prepare('SELECT * FROM map_cities').all();
    for (const city of cities) {
      this.playerCities.set(city.id, city);
      this._addPosition(city.x, city.y, city.role_id);
    }

    // Load existing buildings
    const buildings = db.prepare('SELECT * FROM map_buildings').all();
    for (const b of buildings) {
      const key = this._posKey(b.x, b.y);
      this.playerBuildings.set(key, b);
      this._addPosition(b.x, b.y, b.role_id);
    }

    console.log(`Map loaded: ${this.playerCities.size} cities, ${this.playerBuildings.size} buildings`);
  }

  _posKey(x, y) { return `${x},${y}`; }

  _addPosition(x, y, roleId) {
    const key = this._posKey(x, y);
    if (!this.positionIndex.has(key)) this.positionIndex.set(key, new Set());
    this.positionIndex.get(key).add(roleId);

    if (!this.rolePositions.has(roleId)) this.rolePositions.set(roleId, new Set());
    this.rolePositions.get(roleId).add(key);
  }

  _removePosition(x, y, roleId) {
    const key = this._posKey(x, y);
    if (this.positionIndex.has(key)) {
      this.positionIndex.get(key).delete(roleId);
      if (this.positionIndex.get(key).size === 0) this.positionIndex.delete(key);
    }
    if (this.rolePositions.has(roleId)) {
      this.rolePositions.get(roleId).delete(key);
    }
  }

  /**
   * Scan a single tile
   */
  scanTile(x, y) {
    const tile = staticData.getTileAt(x, y);
    if (!tile) return null;

    const key = this._posKey(x, y);
    const building = this.playerBuildings.get(key) || null;

    // Find city at this position
    let city = null;
    for (const [, c] of this.playerCities) {
      if (c.x === x && c.y === y) { city = c; break; }
    }

    return {
      x, y,
      terrain: tile,
      building,
      city,
    };
  }

  /**
   * Scan a block of tiles (rectangular area)
   */
  scanBlock(cx, cy, range) {
    const results = [];
    const halfRange = Math.floor(range / 2);

    for (let dy = -halfRange; dy <= halfRange; dy++) {
      for (let dx = -halfRange; dx <= halfRange; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        const tile = this.scanTile(tx, ty);
        if (tile) results.push(tile);
      }
    }
    return results;
  }

  /**
   * Get all visible tiles for a role (within VIEW_RANGE of their buildings/cities)
   */
  getVisibleTiles(roleId) {
    const positions = this.rolePositions.get(roleId);
    if (!positions || positions.size === 0) return [];

    const allTiles = [];
    const seen = new Set();
    const range = config.VIEW_RANGE;

    for (const posKey of positions) {
      const [bx, by] = posKey.split(',').map(Number);
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          const key = this._posKey(bx + dx, by + dy);
          if (seen.has(key)) continue;
          seen.add(key);
          const tile = this.scanTile(bx + dx, by + dy);
          if (tile) allTiles.push(tile);
        }
      }
    }
    return allTiles;
  }

  /**
   * Create a new city for a role
   */
  createCity(roleId, x, y, name, isMain = false) {
    const db = getDB();
    const tile = staticData.getTileAt(x, y);
    if (!tile) return { error: 'Invalid position' };

    // Check if position is occupied
    const key = this._posKey(x, y);
    if (this.playerBuildings.has(key)) return { error: 'Position occupied' };

    const result = db.prepare(`
      INSERT INTO map_cities (role_id, x, y, name, is_main, durability, max_durability)
      VALUES (?, ?, ?, ?, ?, 1000, 1000)
    `).run(roleId, x, y, name, isMain ? 1 : 0);

    const city = {
      id: result.lastInsertRowid,
      role_id: roleId,
      x, y, name,
      is_main: isMain ? 1 : 0,
      durability: 1000,
      max_durability: 1000,
    };

    this.playerCities.set(city.id, city);
    this._addPosition(x, y, roleId);

    // Create default facilities
    db.prepare('INSERT INTO city_facilities (city_id, facilities) VALUES (?, ?)').run(
      city.id,
      JSON.stringify([
        { id: 'main_hall', level: 1 },
        { id: 'barracks', level: 1 },
        { id: 'tavern', level: 1 },
      ])
    );

    return { success: true, city };
  }

  /**
   * Build on a map tile (occupy a resource tile)
   */
  buildOnMap(roleId, x, y, type) {
    const db = getDB();
    const tile = staticData.getTileAt(x, y);
    if (!tile) return { error: 'Invalid position' };

    const key = this._posKey(x, y);
    if (this.playerBuildings.has(key)) return { error: 'Position already occupied' };

    const buildConfig = staticData.getMapBuildingConfig(tile.type, tile.level);
    if (!buildConfig) return { error: 'Cannot build here' };

    const result = db.prepare(`
      INSERT INTO map_buildings (role_id, type, level, x, y, durability, max_durability, occupied_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(roleId, type || tile.type, tile.level, x, y, buildConfig.durability, buildConfig.durability);

    const building = {
      id: result.lastInsertRowid,
      role_id: roleId,
      type: type || tile.type,
      level: tile.level,
      x, y,
      durability: buildConfig.durability,
      max_durability: buildConfig.durability,
    };

    this.playerBuildings.set(key, building);
    this._addPosition(x, y, roleId);

    return { success: true, building };
  }

  /**
   * Get all cities and buildings for a role
   */
  getRoleProperties(roleId) {
    const cities = [];
    for (const [, city] of this.playerCities) {
      if (city.role_id === roleId) cities.push(city);
    }

    const buildings = [];
    for (const [, building] of this.playerBuildings) {
      if (building.role_id === roleId) buildings.push(building);
    }

    return { cities, buildings };
  }

  /**
   * Get main city for a role
   */
  getMainCity(roleId) {
    for (const [, city] of this.playerCities) {
      if (city.role_id === roleId && city.is_main === 1) return city;
    }
    return null;
  }
}

module.exports = new MapManager();
