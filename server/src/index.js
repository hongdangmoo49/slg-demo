/**
 * SLG Game Server - Main Entry Point
 * Age of Discovery (1300-1700)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const config = require('./config/game');
const { initialize: initDB } = require('./config/database');
const staticData = require('./config/staticData');
const mapManager = require('./logic/mapManager');
const resourceManager = require('./logic/resourceManager');
const generalManager = require('./logic/generalManager');
const armyManager = require('./logic/armyManager');
const allianceManager = require('./logic/allianceManager');
const { registerHandlers } = require('./controllers/gameController');
const authRouter = require('./controllers/authController');

// === Initialize ===
console.log('=== Age of Conquest - SLG Server ===');
console.log('Initializing...');

// 1. Database
initDB();

// 2. Static data
staticData.loadMapData();
staticData.loadGenerals();
staticData.loadBuildings();
staticData.loadSkills();
console.log('Static data loaded');

// 3. Manager caches
mapManager.init();
resourceManager.init();
generalManager.init();
armyManager.init();
allianceManager.init();
console.log('Managers initialized');

// === Express & Socket.io ===
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static client files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// API routes
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    online: io.engine.clientsCount,
    alliances: allianceManager.alliances.size,
    uptime: process.uptime(),
  });
});

// Map data endpoint
app.get('/api/map/config', (req, res) => {
  res.json({
    width: config.MAP_WIDTH,
    height: config.MAP_HEIGHT,
    tileSize: config.TILE_SIZE,
    viewRange: config.VIEW_RANGE,
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// WebSocket handlers
registerHandlers(io);

// Periodic resource yield update (every 5 min)
setInterval(() => {
  for (const [roleId] of resourceManager.resources) {
    const res = resourceManager.getResources(roleId);
    connMgr = require('./net/connectionManager');
    connMgr.pushToRole(roleId, 'resource:update', res);
  }
}, 300000);

// === Start Server ===
server.listen(config.PORT, () => {
  console.log(`\n🚀 Server running on port ${config.PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🗺️  Map: ${config.MAP_WIDTH}x${config.MAP_HEIGHT}`);
  console.log(`\nReady for connections!\n`);
});
