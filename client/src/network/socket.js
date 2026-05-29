/**
 * Network Manager - Socket.io client
 */

import { io } from 'socket.io-client';

class NetworkManager {
  constructor() {
    this.socket = null;
    this.token = null;
    this.roleId = null;
    this.handlers = new Map();
    this.connected = false;
  }

  init(token, roleId) {
    this.token = token;
    this.roleId = roleId;

    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to game server');
      this.connected = true;
      this._emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from game server');
      this.connected = false;
      this._emit('disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      this._emit('error', err);
    });

    this.socket.on('kicked', (data) => {
      this._emit('kicked', data);
    });

    // Register all game event handlers
    const events = [
      'connected', 'role:info', 'role:properties', 'role:mainCity',
      'map:scanResult', 'map:visibleTiles', 'map:updated', 'map:buildResult',
      'resource:update', 'resource:collectResult',
      'general:list', 'general:drawResult', 'general:allocateResult',
      'army:list', 'army:createResult', 'army:assignResult',
      'army:conscriptResult', 'army:commandResult',
      'alliance:list', 'alliance:createResult', 'alliance:joinResult',
      'alliance:exitResult', 'alliance:info', 'alliance:myAlliance',
      'chat:message',
      'city:facilitiesList', 'city:upgradeResult',
      'research:tree', 'research:startResult', 'research:completed',
      'war:reportList', 'war:reportDetail',
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => {
        this._emit(event, data);
      });
    });
  }

  _emit(event, data) {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(fn => fn(data));
    }
  }

  on(event, callback) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(callback);
    return () => this.handlers.get(event)?.delete(callback);
  }

  off(event, callback) {
    this.handlers.get(event)?.delete(callback);
  }

  // === Emit methods ===

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Role
  getRoleInfo() { this.emit('role:getInfo'); }
  getMyProperties() { this.emit('role:myProperties'); }
  getMyCity() { this.emit('role:myCity'); }

  // Map
  scanBlock(cx, cy, range = 11) { this.emit('map:scanBlock', { cx, cy, range }); }
  getVisibleTiles() { this.emit('map:getVisible'); }
  buildOnMap(x, y, type) { this.emit('map:build', { x, y, type }); }

  // Resources
  getResources() { this.emit('resource:get'); }
  collectResources() { this.emit('resource:collect'); }

  // Generals
  getGenerals() { this.emit('general:list'); }
  drawGeneral() { this.emit('general:draw'); }
  allocatePoints(generalId, allocations) {
    this.emit('general:allocatePoints', { generalId, allocations });
  }

  // Army
  getArmies() { this.emit('army:list'); }
  createArmy(cityId, order) { this.emit('army:create', { cityId, order }); }
  assignGenerals(armyId, generalIds) { this.emit('army:assignGenerals', { armyId, generalIds }); }
  conscript(armyId, amounts) { this.emit('army:conscript', { armyId, amounts }); }
  armyCommand(armyId, command, targetX, targetY) {
    this.emit('army:command', { armyId, command, targetX, targetY });
  }

  // Alliance
  getAlliances() { this.emit('alliance:list'); }
  createAlliance(name) { this.emit('alliance:create', { name }); }
  joinAlliance(allianceId) { this.emit('alliance:join', { allianceId }); }
  exitAlliance() { this.emit('alliance:exit'); }
  getAllianceInfo(allianceId) { this.emit('alliance:getInfo', { allianceId }); }
  getMyAlliance() { this.emit('alliance:myAlliance'); }

  // Chat
  sendChat(channel, message, targetId = null) {
    this.emit('chat:message', { channel, message, targetId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new NetworkManager();
