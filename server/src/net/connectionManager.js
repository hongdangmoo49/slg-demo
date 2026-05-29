/**
 * Connection Manager - handles WebSocket connections
 */

class ConnectionManager {
  constructor() {
    this.connections = new Map(); // socketId -> { socket, roleId, userId }
    this.roleConnections = new Map(); // roleId -> socketId
  }

  add(socket, userId, roleId) {
    // Handle re-login: disconnect old connection
    if (this.roleConnections.has(roleId)) {
      const oldSocketId = this.roleConnections.get(roleId);
      const oldConn = this.connections.get(oldSocketId);
      if (oldConn) {
        oldConn.socket.emit('kicked', { reason: 'Logged in elsewhere' });
        oldConn.socket.disconnect(true);
        this.connections.delete(oldSocketId);
      }
    }

    this.connections.set(socket.id, { socket, roleId, userId });
    this.roleConnections.set(roleId, socket.id);
  }

  remove(socketId) {
    const conn = this.connections.get(socketId);
    if (conn) {
      this.roleConnections.delete(conn.roleId);
      this.connections.delete(socketId);
    }
  }

  getSocket(roleId) {
    const socketId = this.roleConnections.get(roleId);
    if (!socketId) return null;
    return this.connections.get(socketId)?.socket || null;
  }

  getRoleId(socketId) {
    return this.connections.get(socketId)?.roleId || null;
  }

  /**
   * Push message to a specific role
   */
  pushToRole(roleId, event, data) {
    const socket = this.getSocket(roleId);
    if (socket) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Push message to all connections
   */
  pushAll(event, data) {
    for (const [, conn] of this.connections) {
      conn.socket.emit(event, data);
    }
  }

  /**
   * Push to roles within view range of a position
   */
  pushToViewers(x, y, mapManager, event, data) {
    const range = 5;
    for (const [, conn] of this.connections) {
      const positions = mapManager.rolePositions.get(conn.roleId);
      if (!positions) continue;

      for (const posKey of positions) {
        const [bx, by] = posKey.split(',').map(Number);
        if (Math.abs(bx - x) <= range && Math.abs(by - y) <= range) {
          conn.socket.emit(event, data);
          break;
        }
      }
    }
  }

  getOnlineCount() {
    return this.connections.size;
  }
}

module.exports = new ConnectionManager();
