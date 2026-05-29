/**
 * Game Controller - handles all game-related WebSocket messages
 */

const { getDB } = require('../config/database');
const config = require('../config/game');
const mapManager = require('../logic/mapManager');
const resourceManager = require('../logic/resourceManager');
const generalManager = require('../logic/generalManager');
const armyManager = require('../logic/armyManager');
const allianceManager = require('../logic/allianceManager');
const connMgr = require('../net/connectionManager');
const jwt = require('jsonwebtoken');

function registerHandlers(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.roleId = decoded.roleId;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Player connected: role=${socket.roleId}`);
    connMgr.add(socket, socket.userId, socket.roleId);

    // Send initial data
    socket.emit('connected', { roleId: socket.roleId, timestamp: Date.now() });

    // === Role ===
    socket.on('role:getInfo', () => {
      const db = getDB();
      const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(socket.roleId);
      const resources = resourceManager.getResources(socket.roleId);
      socket.emit('role:info', { role, resources });
    });

    // === Map ===
    socket.on('map:scanBlock', (data) => {
      const { cx, cy, range = 11 } = data;
      const tiles = mapManager.scanBlock(cx, cy, range);
      socket.emit('map:scanResult', { tiles });
    });

    socket.on('map:getVisible', () => {
      const tiles = mapManager.getVisibleTiles(socket.roleId);
      socket.emit('map:visibleTiles', { tiles });
    });

    socket.on('map:build', (data) => {
      const { x, y, type } = data;
      const result = mapManager.buildOnMap(socket.roleId, x, y, type);
      socket.emit('map:buildResult', result);
      if (result.success) {
        // Update yields
        const buildConfig = require('../config/staticData').getMapBuildingConfig(
          result.building.type, result.building.level
        );
        if (buildConfig?.yield) {
          resourceManager.updateYields(socket.roleId, buildConfig.yield);
        }
        // Notify nearby players
        connMgr.pushToViewers(x, y, mapManager, 'map:updated', {
          type: 'new_building', building: result.building,
        });
      }
    });

    // === Resources ===
    socket.on('resource:get', () => {
      const resources = resourceManager.getResources(socket.roleId);
      socket.emit('resource:update', resources);
    });

    socket.on('resource:collect', () => {
      const result = resourceManager.collect(socket.roleId);
      socket.emit('resource:collectResult', result);
    });

    // === Generals ===
    socket.on('general:list', () => {
      const generals = generalManager.getGenerals(socket.roleId);
      socket.emit('general:list', { generals });
    });

    socket.on('general:draw', () => {
      const cost = config.DRAW_COST;
      if (!resourceManager.canAfford(socket.roleId, cost)) {
        socket.emit('general:drawResult', { error: 'Insufficient gold' });
        return;
      }
      resourceManager.deductResources(socket.roleId, cost);
      const general = generalManager.draw(socket.roleId);
      socket.emit('general:drawResult', { success: true, general });
    });

    socket.on('general:allocatePoints', (data) => {
      const { generalId, allocations } = data;
      const result = generalManager.allocatePoints(socket.roleId, generalId, allocations);
      socket.emit('general:allocateResult', result);
    });

    // === Army ===
    socket.on('army:list', () => {
      const armies = armyManager.getArmies(socket.roleId);
      socket.emit('army:list', { armies });
    });

    socket.on('army:create', (data) => {
      const { cityId, order } = data;
      const result = armyManager.createArmy(socket.roleId, cityId, order);
      socket.emit('army:createResult', result);
    });

    socket.on('army:assignGenerals', (data) => {
      const { armyId, generalIds } = data;
      const result = armyManager.assignGenerals(socket.roleId, armyId, generalIds);
      socket.emit('army:assignResult', result);
    });

    socket.on('army:conscript', (data) => {
      const { armyId, amounts } = data;
      const result = armyManager.conscript(socket.roleId, armyId, amounts);
      socket.emit('army:conscriptResult', result);
    });

    socket.on('army:command', (data) => {
      const { armyId, command, targetX, targetY } = data;
      const result = armyManager.issueCommand(socket.roleId, armyId, command, targetX, targetY);
      socket.emit('army:commandResult', result);
    });

    // === Alliance ===
    socket.on('alliance:list', () => {
      const alliances = allianceManager.list();
      socket.emit('alliance:list', { alliances });
    });

    socket.on('alliance:create', (data) => {
      const { name } = data;
      const result = allianceManager.create(socket.roleId, name);
      socket.emit('alliance:createResult', result);
    });

    socket.on('alliance:join', (data) => {
      const { allianceId } = data;
      const result = allianceManager.join(socket.roleId, allianceId);
      socket.emit('alliance:joinResult', result);
    });

    socket.on('alliance:exit', () => {
      const result = allianceManager.exit(socket.roleId);
      socket.emit('alliance:exitResult', result);
    });

    socket.on('alliance:getInfo', (data) => {
      const { allianceId } = data;
      const info = allianceManager.getInfo(allianceId);
      socket.emit('alliance:info', info);
    });

    socket.on('alliance:myAlliance', () => {
      const alliance = allianceManager.getRoleAlliance(socket.roleId);
      socket.emit('alliance:myAlliance', alliance);
    });

    // === Chat ===
    socket.on('chat:message', (data) => {
      const { channel, message, targetId } = data;
      const db = getDB();
      const role = db.prepare('SELECT nickname FROM roles WHERE id = ?').get(socket.roleId);

      const chatMsg = {
        senderId: socket.roleId,
        senderName: role?.nickname || 'Unknown',
        channel,
        message,
        timestamp: Date.now(),
      };

      db.prepare(`
        INSERT INTO chat_messages (sender_id, channel, message, target_id)
        VALUES (?, ?, ?, ?)
      `).run(socket.roleId, channel, message, targetId || null);

      if (channel === 'world') {
        connMgr.pushAll('chat:message', chatMsg);
      } else if (channel === 'alliance') {
        const alliance = allianceManager.getRoleAlliance(socket.roleId);
        if (alliance) {
          for (const member of alliance.members) {
            connMgr.pushToRole(member.role_id, 'chat:message', chatMsg);
          }
        }
      } else if (channel === 'private' && targetId) {
        connMgr.pushToRole(targetId, 'chat:message', chatMsg);
        socket.emit('chat:message', chatMsg);
      }
    });

    // === Properties ===
    socket.on('role:myProperties', () => {
      const properties = mapManager.getRoleProperties(socket.roleId);
      socket.emit('role:properties', properties);
    });

    socket.on('role:myCity', () => {
      const city = mapManager.getMainCity(socket.roleId);
      socket.emit('role:mainCity', city);
    });

    // === Disconnect ===
    socket.on('disconnect', () => {
      console.log(`Player disconnected: role=${socket.roleId}`);
      connMgr.remove(socket.id);

      // Update last online
      const db = getDB();
      db.prepare('UPDATE roles SET last_online = datetime("now") WHERE id = ?').run(socket.roleId);
    });
  });
}

module.exports = { registerHandlers };
