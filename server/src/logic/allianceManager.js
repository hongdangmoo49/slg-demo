/**
 * Alliance Manager - handles alliance/guild operations
 */

const { getDB } = require('../config/database');
const config = require('../config/game');

class AllianceManager {
  constructor() {
    this.alliances = new Map(); // allianceId -> alliance
    this.memberIndex = new Map(); // roleId -> allianceId
  }

  init() {
    const db = getDB();
    const alliances = db.prepare('SELECT * FROM alliances WHERE state = 1').all();
    for (const a of alliances) {
      this.alliances.set(a.id, a);
    }

    const members = db.prepare('SELECT * FROM alliance_members').all();
    for (const m of members) {
      this.memberIndex.set(m.role_id, m.alliance_id);
    }

    console.log(`Alliances loaded: ${this.alliances.size} active`);
  }

  create(roleId, name) {
    if (name.length > config.MAX_ALLIANCE_NAME_LENGTH) {
      return { error: 'Name too long' };
    }

    if (this.memberIndex.has(roleId)) {
      return { error: 'Already in an alliance' };
    }

    const db = getDB();

    // Check unique name
    const existing = db.prepare('SELECT id FROM alliances WHERE name = ?').get(name);
    if (existing) return { error: 'Name already taken' };

    const result = db.prepare(`
      INSERT INTO alliances (name, chairman_id, notice, state)
      VALUES (?, ?, '', 1)
    `).run(name, roleId);

    const allianceId = result.lastInsertRowid;

    // Add creator as chairman
    db.prepare(`
      INSERT INTO alliance_members (alliance_id, role_id, role_type)
      VALUES (?, ?, 0)
    `).run(allianceId, roleId);

    const alliance = {
      id: allianceId,
      name,
      chairman_id: roleId,
      notice: '',
      state: 1,
    };

    this.alliances.set(allianceId, alliance);
    this.memberIndex.set(roleId, allianceId);

    return { success: true, alliance };
  }

  list() {
    return Array.from(this.alliances.values()).map(a => ({
      id: a.id,
      name: a.name,
      chairman_id: a.chairman_id,
      memberCount: this._getMemberCount(a.id),
      notice: a.notice,
    }));
  }

  join(roleId, allianceId) {
    if (this.memberIndex.has(roleId)) {
      return { error: 'Already in an alliance' };
    }

    const alliance = this.alliances.get(allianceId);
    if (!alliance) return { error: 'Alliance not found' };

    if (this._getMemberCount(allianceId) >= config.MAX_ALLIANCE_MEMBERS) {
      return { error: 'Alliance is full' };
    }

    const db = getDB();

    // Check if already applied
    const existing = db.prepare(
      'SELECT id FROM alliance_applications WHERE alliance_id = ? AND role_id = ? AND status = ?'
    ).get(allianceId, roleId, 'pending');

    if (existing) return { error: 'Already applied' };

    // Auto-join for now (demo mode)
    db.prepare(`
      INSERT INTO alliance_members (alliance_id, role_id, role_type)
      VALUES (?, ?, 2)
    `).run(allianceId, roleId);

    this.memberIndex.set(roleId, allianceId);

    return { success: true, alliance };
  }

  exit(roleId) {
    const allianceId = this.memberIndex.get(roleId);
    if (!allianceId) return { error: 'Not in an alliance' };

    const alliance = this.alliances.get(allianceId);
    if (alliance && alliance.chairman_id === roleId) {
      return { error: 'Chairman cannot leave. Disband or transfer leadership first.' };
    }

    const db = getDB();
    db.prepare('DELETE FROM alliance_members WHERE alliance_id = ? AND role_id = ?')
      .run(allianceId, roleId);

    this.memberIndex.delete(roleId);
    return { success: true };
  }

  getInfo(allianceId) {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return null;

    const db = getDB();
    const members = db.prepare(`
      SELECT am.role_id, am.role_type, r.nickname
      FROM alliance_members am
      JOIN roles r ON r.id = am.role_id
      WHERE am.alliance_id = ?
    `).all(allianceId);

    return {
      ...alliance,
      members,
      memberCount: members.length,
    };
  }

  getRoleAlliance(roleId) {
    const allianceId = this.memberIndex.get(roleId);
    if (!allianceId) return null;
    return this.getInfo(allianceId);
  }

  _getMemberCount(allianceId) {
    let count = 0;
    for (const [, aId] of this.memberIndex) {
      if (aId === allianceId) count++;
    }
    return count;
  }
}

module.exports = new AllianceManager();
