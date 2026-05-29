# Age of Conquest — SLG Game Demo

> A mobile Strategy Simulation Game (SLG) set in the Age of Discovery (1300-1700).
> Built with Node.js + Phaser 3, inspired by [slgserver](https://github.com/llr104/slgserver) / [slgclient](https://github.com/llr104/slgclient).

## 🎮 Game Overview

**Era**: 1300-1700 (Age of Discovery, Renaissance, Colonial period)
**Map**: 100×100 world map with resource tiles, cities, and fortresses
**Factions**: European Kingdoms, Ottoman Empire, Ming Dynasty, Aztec Empire, African Kingdoms

### Core Systems

| System | Description |
|--------|-------------|
| **Map** | 100×100 grid world with terrain types (forest, mountain, farm, gold mine) |
| **Resources** | Gold, Food, Wood, Iron, Stone — with hourly yields from territory |
| **Buildings** | Occupy resource tiles, build fortresses, upgrade city facilities |
| **Generals** | 20 historical commanders (Columbus, Suleiman, Zheng He, etc.) with gacha recruitment |
| **Army** | Up to 5 armies per city, 3 generals per army, movement & combat |
| **Combat** | Turn-based (max 10 rounds), skill system with buffs/debuffs |
| **Alliance** | Create/join alliances, shared map vision, member management |
| **Chat** | World, Alliance, and Private chat channels |

## 🏗️ Architecture

```
slg-demo/
├── server/                 # Node.js game server
│   ├── src/
│   │   ├── index.js        # Server entry point (Express + Socket.io)
│   │   ├── config/         # Game config, database, static data loader
│   │   ├── controllers/    # Auth REST API + Game WebSocket handlers
│   │   ├── logic/          # Game managers (map, army, general, resource, alliance)
│   │   └── net/            # Connection manager
│   └── data/
│       ├── slg.db          # SQLite database (auto-created)
│       └── conf/           # JSON game configs (generals, buildings, skills)
├── client/                 # Phaser 3 mobile client
│   ├── src/
│   │   ├── main.js         # Phaser config & entry point
│   │   ├── scenes/         # BootScene, LoginScene, GameScene
│   │   ├── network/        # Socket.io client + REST API helper
│   │   └── config/         # Theme constants, tile configs
│   └── index.html          # Mobile-optimized HTML shell
└── shared/                 # Shared types/configs (future)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm

### Install & Run

```bash
# Install all dependencies
npm run install:all

# Start server + client dev mode
npm run dev
```

Server runs on `http://localhost:4000`
Client dev server on `http://localhost:3000`

### Individual Services

```bash
# Server only
cd server && npm run dev

# Client only
cd client && npm run dev

# Build client for production
cd client && npm run build
```

## 🎯 How to Play

1. Open `http://localhost:3000` on your browser (mobile-friendly!)
2. Create an account with a commander name and password
3. You'll be placed on the world map with a starting city and 3 generals
4. **Explore**: Drag to pan the map, scroll/pinch to zoom
5. **Build**: Tap resource tiles (forest, mountain, etc.) to occupy them
6. **Recruit**: Open Heroes panel to recruit more generals (costs 🪙300)
7. **Army**: Open Army panel to recruit soldiers, then assign generals
8. **Attack**: Tap enemy buildings and send your army
9. **Collect**: Use the Collect button for daily resource levy
10. **Alliance**: Create or join an alliance for shared vision

## 🎨 Placeholder Assets

All visuals are generated programmatically (colored rectangles, circles, text).
This is intentional — assets can be easily replaced by:

1. Adding sprite images to `client/assets/`
2. Updating texture keys in `client/src/config/theme.js`
3. Loading real sprites in `BootScene._generateTextures()`

## 📜 Historical Generals (1300-1700)

| ★5 (Legendary) | ★4 (Epic) | ★3 (Rare) |
|-----------------|-----------|-----------|
| Christopher Columbus | Hernán Cortés | Francisco Pizarro |
| Suleiman the Magnificent | Moctezuma II | Henry the Navigator |
| Zheng He | Qi Jiguang | Wang Yangming |
| Isabella I | Hayreddin Barbarossa | Nezahualcoyotl |
| Mehmed II | Shaka Zulu | Koca Sinan Pasha |
| Yi Sun-sin | Queen Nzinga | Cuauhtémoc |
| Mansa Musa | | |

## ⚙️ Configuration

Game balance configs are JSON files in `server/data/conf/`:
- `generals.json` — Hero definitions, stats, draw weights
- `map_buildings.json` — Resource tiles, fortress upgrades, NPC armies
- `skills.json` — Combat skill definitions
- `map.json` — Auto-generated world map (seeded random)

Server constants in `server/src/config/game.js`.

## 📱 Mobile Support

- Responsive Phaser canvas (auto-resize)
- Touch controls (drag to pan, pinch to zoom)
- HTML input fields for text entry (mobile keyboard support)
- Optimized FPS (30fps on mobile, 60fps on desktop)

## License

MIT
