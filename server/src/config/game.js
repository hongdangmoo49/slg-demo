/**
 * Game Configuration - Age of Discovery (1300-1700)
 * Central config for all game constants
 */

module.exports = {
  // Server
  PORT: process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'slg-demo-secret-change-in-prod',

  // Map
  MAP_WIDTH: 100,
  MAP_HEIGHT: 100,
  TILE_SIZE: 64,
  VIEW_RANGE: 5,

  // Resources
  RESOURCES: {
    GOLD: 'gold',
    FOOD: 'food',
    WOOD: 'wood',
    IRON: 'iron',
    STONE: 'stone',
  },

  // Starting resources for new players
  STARTING_RESOURCES: {
    gold: 1000,
    food: 5000,
    wood: 3000,
    iron: 1000,
    stone: 2000,
  },

  // Starting yields per hour
  STARTING_YIELDS: {
    gold: 10,
    food: 50,
    wood: 30,
    iron: 10,
    stone: 20,
  },

  // Max resource capacity (warehouse)
  DEFAULT_CAPACITY: 50000,

  // Army
  MAX_ARMIES_PER_CITY: 5,
  MAX_GENERALS_PER_ARMY: 3,
  ARMY_SPEED: 1, // tiles per second

  // Conscript
  CONSCRIPT_COST_PER_SOLDIER: { food: 10, gold: 2 },
  CONSCRIPT_TIME_PER_SOLDIER: 1, // seconds

  // Generals
  MAX_GENERAL_LEVEL: 50,
  MAX_STAR_LEVEL: 5,
  DRAW_COST: { gold: 300 },
  GENERAL_PHYSICAL_POWER: 100,
  PHYSICAL_POWER_RECOVERY: 1, // per minute

  // Combat
  MAX_COMBAT_ROUNDS: 10,
  DAMAGE_MULTIPLIER: 0.0005,

  // Building
  WAR_FREE_TIME: 3600, // seconds of protection after capture
  GIVE_UP_TIME: 86400, // 24 hours before auto-abandon
  MAX_FORTRESSES: 5,
  BUILD_TIME_MULTIPLIER: 1, // seconds per level

  // Alliance
  MAX_ALLIANCE_MEMBERS: 50,
  MAX_ALLIANCE_NAME_LENGTH: 20,

  // Collection (daily levy)
  COLLECT_TIMES: 3,
  COLLECT_INTERVAL: 28800, // 8 hours

  // Factions (1300-1700 era civilizations)
  FACTIONS: {
    EUROPE: 'europe',     // European Kingdoms
    OTTOMAN: 'ottoman',   // Ottoman Empire
    MING: 'ming',         // Ming/Qing Dynasty
    AZTEC: 'aztec',       // Mesoamerican
    AFRICA: 'africa',     // African Kingdoms
  },

  // Tile types
  TILE_TYPES: {
    PLAIN: 0,
    FOREST: 1,    // wood
    MOUNTAIN: 2,  // iron, stone
    FARM: 3,      // food
    GOLD_MINE: 4, // gold
    WATER: 5,
    CITY: 10,
    FORTRESS: 11,
    RUINS: 12,
  },

  // Map building types
  MAP_BUILD: {
    SYS_FORTRESS: 50,
    SYS_CITY: 51,
    PLAYER_FORTRESS: 56,
    RESOURCE_TILE: 100,
  },
};
