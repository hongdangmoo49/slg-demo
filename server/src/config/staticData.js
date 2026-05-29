/**
 * Static data loader - loads JSON config files
 */

const fs = require('fs');
const path = require('path');

const CONF_DIR = path.join(__dirname, '../../data/conf');

let generalsData = null;
let buildingsData = null;
let skillsData = null;
let mapData = null;

function loadGenerals() {
  if (!generalsData) {
    generalsData = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'generals.json'), 'utf-8'));
  }
  return generalsData;
}

function loadBuildings() {
  if (!buildingsData) {
    buildingsData = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'map_buildings.json'), 'utf-8'));
  }
  return buildingsData;
}

function loadSkills() {
  if (!skillsData) {
    skillsData = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'skills.json'), 'utf-8'));
  }
  return skillsData;
}

function loadMapData() {
  if (!mapData) {
    const mapPath = path.join(CONF_DIR, 'map.json');
    if (fs.existsSync(mapPath)) {
      mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    } else {
      mapData = generateMap();
      fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2));
    }
  }
  return mapData;
}

function generateMap() {
  const config = require('./game');
  const tiles = [];
  const rng = mulberry32(42); // seeded random for consistent maps

  for (let y = 0; y < config.MAP_HEIGHT; y++) {
    for (let x = 0; x < config.MAP_WIDTH; x++) {
      let type = config.TILE_TYPES.PLAIN;
      let level = 0;

      const r = rng();

      // Water edges
      if (x < 3 || x >= config.MAP_WIDTH - 3 || y < 3 || y >= config.MAP_HEIGHT - 3) {
        type = config.TILE_TYPES.WATER;
      }
      // Rivers (diagonal patterns)
      else if ((x + y) % 25 < 2 && x > 10 && y > 10) {
        type = config.TILE_TYPES.WATER;
      }
      // Resource distribution
      else if (r < 0.15) {
        type = config.TILE_TYPES.FOREST;
        level = weightedLevel(rng);
      } else if (r < 0.25) {
        type = config.TILE_TYPES.MOUNTAIN;
        level = weightedLevel(rng);
      } else if (r < 0.38) {
        type = config.TILE_TYPES.FARM;
        level = weightedLevel(rng);
      } else if (r < 0.42) {
        type = config.TILE_TYPES.GOLD_MINE;
        level = weightedLevel(rng);
      } else if (r < 0.50) {
        type = config.TILE_TYPES.MOUNTAIN;
        level = weightedLevel(rng);
      }

      // System cities and fortresses at strategic locations
      if (x % 20 === 10 && y % 20 === 10 && type !== config.TILE_TYPES.WATER) {
        type = config.TILE_TYPES.CITY;
        level = Math.floor(rng() * 3) + 3;
      } else if (x % 20 === 15 && y % 20 === 15 && type !== config.TILE_TYPES.WATER) {
        type = config.TILE_TYPES.FORTRESS;
        level = Math.floor(rng() * 3) + 2;
      }

      tiles.push({ x, y, type, level });
    }
  }

  return { width: config.MAP_WIDTH, height: config.MAP_HEIGHT, tiles };
}

function weightedLevel(rng) {
  const r = rng();
  if (r < 0.35) return 1;
  if (r < 0.60) return 2;
  if (r < 0.80) return 3;
  if (r < 0.93) return 4;
  return 5;
}

// Simple seeded PRNG
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getGeneralConfig(cfgId) {
  const data = loadGenerals();
  return data.generals.find(g => g.cfgId === cfgId);
}

function getSkillConfig(skillId) {
  const data = loadSkills();
  return data.skills.find(s => s.id === skillId);
}

function getMapBuildingConfig(type, level) {
  const data = loadBuildings();
  return data.mapBuildings.find(b => b.type === type && b.level === level);
}

function getFortressUpgrade(level) {
  const data = loadBuildings();
  return data.fortressUpgrades.find(f => f.level === level);
}

function getTileAt(x, y) {
  const data = loadMapData();
  if (x < 0 || x >= data.width || y < 0 || y >= data.height) return null;
  return data.tiles[y * data.width + x];
}

module.exports = {
  loadGenerals, loadBuildings, loadSkills, loadMapData,
  getGeneralConfig, getSkillConfig, getMapBuildingConfig,
  getFortressUpgrade, getTileAt,
};
