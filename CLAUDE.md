# SLG Demo — Age of Conquest

Mobile SLG game, 1300-1700 era.

## Tech Stack
- **Server**: Node.js + Express + Socket.io + SQLite (better-sqlite3)
- **Client**: Phaser 3 + Vite
- **Realtime**: WebSocket for game actions, REST for auth

## Commands
```bash
npm run dev          # Start server + client
npm run dev:server   # Server only (port 4000)
npm run dev:client   # Client only (port 3000)
```

## Architecture
- `server/src/logic/` — Game managers (map, army, general, resource, alliance, city, research)
- `server/src/controllers/` — WebSocket + REST handlers
- `server/data/conf/` — JSON game configs (generals, buildings, skills, facilities)
- `client/src/scenes/` — Phaser scenes (Boot, Login, Game, City)
- `client/src/network/` — Socket.io client + REST API

## Key Patterns
- SQLite datetime uses **single quotes**: `datetime('now')` not `datetime("now")`
- Managers are singletons (`module.exports = new Manager()`)
- Client generates placeholder textures in BootScene (easily swappable)
- Resource yields accrue hourly, checked lazily on access
- Army movement processed in 1s intervals
- Research completion checked every 5s

## Game Data
- 20 historical generals (★1-5) from 5 factions
- 25 resource tile types (5 resources × 5 levels)
- 31 combat skills
- 8 city facilities with 5 upgrade levels each
- 12 technologies across 3 categories
