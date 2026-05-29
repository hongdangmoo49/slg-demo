/**
 * Game Constants - client-side configuration
 * Era: Age of Discovery (1300-1700)
 */

export const TILE_SIZE = 64;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;
export const VIEW_RANGE = 5;

// Tile types (must match server)
export const TILE = {
  PLAIN: 0,
  FOREST: 1,
  MOUNTAIN: 2,
  FARM: 3,
  GOLD_MINE: 4,
  WATER: 5,
  CITY: 10,
  FORTRESS: 11,
  RUINS: 12,
};

// Tile colors (placeholder - easily swappable with sprites)
export const TILE_COLORS = {
  [TILE.PLAIN]:    { base: 0x8BC34A, border: 0x7CB342 },  // Light green
  [TILE.FOREST]:   { base: 0x2E7D32, border: 0x1B5E20 },  // Dark green
  [TILE.MOUNTAIN]: { base: 0x795548, border: 0x5D4037 },  // Brown
  [TILE.FARM]:     { base: 0xFFC107, border: 0xFFA000 },   // Gold/Yellow
  [TILE.GOLD_MINE]:{ base: 0xFF9800, border: 0xE65100 },   // Orange
  [TILE.WATER]:    { base: 0x1565C0, border: 0x0D47A1 },   // Blue
  [TILE.CITY]:     { base: 0x9C27B0, border: 0x7B1FA2 },   // Purple
  [TILE.FORTRESS]: { base: 0xF44336, border: 0xC62828 },   // Red
  [TILE.RUINS]:    { base: 0x616161, border: 0x424242 },   // Gray
};

// Tile labels
export const TILE_NAMES = {
  [TILE.PLAIN]: 'Plains',
  [TILE.FOREST]: 'Forest',
  [TILE.MOUNTAIN]: 'Mountain',
  [TILE.FARM]: 'Farmland',
  [TILE.GOLD_MINE]: 'Gold Mine',
  [TILE.WATER]: 'Ocean',
  [TILE.CITY]: 'City',
  [TILE.FORTRESS]: 'Fortress',
  [TILE.RUINS]: 'Ruins',
};

// Resource colors
export const RESOURCE_COLORS = {
  gold: 0xFFD700,
  food: 0x4CAF50,
  wood: 0x795548,
  iron: 0x607D8B,
  stone: 0x9E9E9E,
};

// Faction info
export const FACTIONS = {
  europe:  { name: 'European Kingdoms', color: 0x2196F3, icon: '⚔️' },
  ottoman: { name: 'Ottoman Empire',    color: 0xE91E63, icon: '🗡️' },
  ming:    { name: 'Ming Dynasty',      color: 0xFF5722, icon: '🐉' },
  aztec:   { name: 'Aztec Empire',      color: 0x4CAF50, icon: '🦅' },
  africa:  { name: 'African Kingdoms',  color: 0xFFC107, icon: '🦁' },
};

// Arms types
export const ARMS = {
  infantry: { name: 'Infantry', icon: '🛡️' },
  cavalry:  { name: 'Cavalry', icon: '🐎' },
  archer:   { name: 'Archer', icon: '🏹' },
};

// UI Colors
export const UI = {
  PRIMARY: 0x1A237E,
  SECONDARY: 0x283593,
  ACCENT: 0xFFC107,
  SUCCESS: 0x4CAF50,
  DANGER: 0xF44336,
  DARK: 0x121212,
  PANEL: 0x1E1E2E,
  PANEL_LIGHT: 0x2A2A3E,
  TEXT: 0xFFFFFF,
  TEXT_DIM: 0xB0BEC5,
};
