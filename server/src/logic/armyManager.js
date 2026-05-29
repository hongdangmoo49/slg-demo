/**
 * Army Manager - handles army creation, movement, combat
 */

const { getDB } = require('../config/database');
const config = require('../config/game');
const staticData = require('../config/staticData');
const generalManager = require('./generalManager');

// Arms damage ratios
const ARMS_RATIOS = {
  infantry: { infantry: 1.0, cavalry: 0.8, archer: 1.2 },
  cavalry:  { infantry: 1.2, cavalry: 1.0, archer: 0.8 },
  archer:   { infantry: 0.8, cavalry: 1.2, archer: 1.0 },
};

class ArmyManager {
  constructor() {
    this.armies = new Map(); // roleId -> Map(armyId -> army)
    this.movingArmies = new Map(); // endTime -> army[]
    this.combatQueue = [];
  }

  init() {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM armies').all();
    for (const row of rows) {
      row.generals = JSON.parse(row.generals || '[]');
      row.soldiers = JSON.parse(row.soldiers || '[0,0,0]');

      if (!this.armies.has(row.role_id)) this.armies.set(row.role_id, new Map());
      this.armies.get(row.role_id).set(row.id, row);

      // Track moving armies
      if (row.command !== 'idle' && row.end_time) {
        const endTime = new Date(row.end_time).getTime();
        if (endTime > Date.now()) {
          if (!this.movingArmies.has(endTime)) this.movingArmies.set(endTime, []);
          this.movingArmies.get(endTime).push(row);
        }
      }
    }
    console.log(`Armies loaded: ${rows.length} total`);

    // Start army processing loop
    this._startProcessingLoop();
  }

  _startProcessingLoop() {
    setInterval(() => this._processMovements(), 1000);
  }

  _processMovements() {
    const now = Date.now();
    for (const [endTime, armies] of this.movingArmies) {
      if (endTime <= now) {
        for (const army of armies) {
          this._handleArrival(army);
        }
        this.movingArmies.delete(endTime);
      }
    }
  }

  _handleArrival(army) {
    switch (army.command) {
      case 'attack':
        this._handleAttackArrival(army);
        break;
      case 'defend':
        this._handleDefendArrival(army);
        break;
      case 'back':
        this._handleBackArrival(army);
        break;
      case 'transfer':
        this._handleTransferArrival(army);
        break;
      case 'reclamation':
        this._handleReclamationArrival(army);
        break;
    }
  }

  /**
   * Create a new army in a city
   */
  createArmy(roleId, cityId, order) {
    const db = getDB();

    // Check max armies
    const roleArmies = this.armies.get(roleId);
    const cityArmies = roleArmies
      ? Array.from(roleArmies.values()).filter(a => a.city_id === cityId)
      : [];

    if (cityArmies.length >= config.MAX_ARMIES_PER_CITY) {
      return { error: 'Max armies reached for this city' };
    }

    const result = db.prepare(`
      INSERT INTO armies (role_id, city_id, army_order, generals, soldiers, command, from_x, from_y, to_x, to_y)
      VALUES (?, ?, ?, '[]', '[0,0,0]', 'idle', 0, 0, 0, 0)
    `).run(roleId, cityId, order);

    const army = {
      id: result.lastInsertRowid,
      role_id: roleId,
      city_id: cityId,
      army_order: order,
      generals: [],
      soldiers: [0, 0, 0],
      command: 'idle',
      from_x: 0, from_y: 0, to_x: 0, to_y: 0,
    };

    if (!this.armies.has(roleId)) this.armies.set(roleId, new Map());
    this.armies.get(roleId).set(army.id, army);

    return { success: true, army };
  }

  /**
   * Assign generals to army slots
   */
  assignGenerals(roleId, armyId, generalIds) {
    const army = this._getArmy(roleId, armyId);
    if (!army) return { error: 'Army not found' };
    if (army.command !== 'idle') return { error: 'Army is not idle' };
    if (generalIds.length > config.MAX_GENERALS_PER_ARMY) return { error: 'Too many generals' };

    army.generals = generalIds;

    const db = getDB();
    db.prepare('UPDATE armies SET generals = ? WHERE id = ?')
      .run(JSON.stringify(generalIds), army.id);

    return { success: true, army };
  }

  /**
   * Conscript soldiers (lazy evaluation)
   */
  conscript(roleId, armyId, amounts) {
    const army = this._getArmy(roleId, armyId);
    if (!army) return { error: 'Army not found' };
    if (army.command !== 'idle') return { error: 'Army is not idle' };

    const total = amounts.reduce((s, v) => s + v, 0);
    const cost = {
      food: total * config.CONSCRIPT_COST_PER_SOLDIER.food,
      gold: total * config.CONSCRIPT_COST_PER_SOLDIER.gold,
    };

    const resourceManager = require('./resourceManager');
    if (!resourceManager.canAfford(roleId, cost)) {
      return { error: 'Insufficient resources' };
    }

    resourceManager.deductResources(roleId, cost);
    army.soldiers = amounts.map((v, i) => (army.soldiers[i] || 0) + v);

    const db = getDB();
    db.prepare('UPDATE armies SET soldiers = ? WHERE id = ?')
      .run(JSON.stringify(army.soldiers), army.id);

    return { success: true, army };
  }

  /**
   * Issue a command to an army (move to target)
   */
  issueCommand(roleId, armyId, command, targetX, targetY) {
    const army = this._getArmy(roleId, armyId);
    if (!army) return { error: 'Army not found' };
    if (army.command !== 'idle') return { error: 'Army is busy' };

    const totalSoldiers = army.soldiers.reduce((s, v) => s + v, 0);
    if (totalSoldiers === 0) return { error: 'No soldiers in army' };
    if (army.generals.length === 0) return { error: 'No generals assigned' };

    // Get current position (from city or current location)
    const mapManager = require('./mapManager');
    const city = mapManager.playerCities.get(army.city_id);
    if (!city) return { error: 'City not found' };

    const fromX = city.x;
    const fromY = city.y;
    const distance = Math.abs(targetX - fromX) + Math.abs(targetY - fromY); // Manhattan distance
    const travelTime = Date.now() + (distance / config.ARMY_SPEED) * 1000;

    army.command = command;
    army.from_x = fromX;
    army.from_y = fromY;
    army.to_x = targetX;
    army.to_y = targetY;
    army.start_time = new Date().toISOString();
    army.end_time = new Date(travelTime).toISOString();

    const db = getDB();
    db.prepare(`
      UPDATE armies SET command = ?, from_x = ?, from_y = ?, to_x = ?, to_y = ?, start_time = ?, end_time = ?
      WHERE id = ?
    `).run(command, fromX, fromY, targetX, targetY, army.start_time, army.end_time, army.id);

    // Track for processing
    if (!this.movingArmies.has(travelTime)) this.movingArmies.set(travelTime, []);
    this.movingArmies.get(travelTime).push(army);

    return { success: true, army, travelTime: travelTime - Date.now() };
  }

  /**
   * Get all armies for a role
   */
  getArmies(roleId) {
    const roleArmies = this.armies.get(roleId);
    if (!roleArmies) return [];
    return Array.from(roleArmies.values());
  }

  _getArmy(roleId, armyId) {
    const roleArmies = this.armies.get(roleId);
    if (!roleArmies) return null;
    return roleArmies.get(armyId) || null;
  }

  /**
   * Execute combat between attacker and defender
   */
  executeCombat(attackerArmy, defenderArmy, attackerRoleId, defenderRoleId) {
    const rounds = [];
    const attackerPositions = this._prepareCombatPositions(attackerArmy, attackerRoleId);
    const defenderPositions = this._prepareCombatPositions(defenderArmy, defenderRoleId);

    if (attackerPositions.length === 0 || defenderPositions.length === 0) {
      return { rounds: [], result: attackerPositions.length > 0 ? 'win' : 'lose' };
    }

    for (let round = 0; round < config.MAX_COMBAT_ROUNDS; round++) {
      const roundData = { round: round + 1, actions: [] };

      // Random first strike
      const attackerFirst = Math.random() > 0.5;

      const first = attackerFirst ? attackerPositions : defenderPositions;
      const second = attackerFirst ? defenderPositions : attackerPositions;

      // First side attacks
      for (let i = 0; i < first.length; i++) {
        if (first[i].soldiers <= 0) continue;
        this._applyBeforeAttackSkills(first[i], first, second, roundData);
        this._normalAttack(first[i], second, roundData);
        this._applyAfterAttackSkills(first[i], first, second, roundData);
      }

      // Second side attacks
      for (let i = 0; i < second.length; i++) {
        if (second[i].soldiers <= 0) continue;
        this._applyBeforeAttackSkills(second[i], second, first, roundData);
        this._normalAttack(second[i], first, roundData);
        this._applyAfterAttackSkills(second[i], second, first, roundData);
      }

      rounds.push(roundData);

      // Check win condition
      const attackerAlive = attackerPositions[0].soldiers > 0;
      const defenderAlive = defenderPositions[0].soldiers > 0;

      if (!attackerAlive || !defenderAlive) break;
    }

    const attackerMainDead = attackerPositions[0].soldiers <= 0;
    const defenderMainDead = defenderPositions[0].soldiers <= 0;

    let result = 'draw';
    if (attackerMainDead && !defenderMainDead) result = 'lose';
    else if (!attackerMainDead && defenderMainDead) result = 'win';

    // Update soldier counts
    attackerArmy.soldiers = attackerPositions.map(p => Math.max(0, p.soldiers));
    defenderArmy.soldiers = defenderPositions.map(p => Math.max(0, p.soldiers));

    return { rounds, result, attackerPositions, defenderPositions };
  }

  _prepareCombatPositions(army, roleId) {
    const positions = [];
    for (let i = 0; i < army.generals.length; i++) {
      const gen = generalManager.getGeneral(roleId, army.generals[i]);
      if (!gen) continue;

      const stats = generalManager.getCombatStats(gen);
      positions.push({
        generalId: gen.id,
        generalName: gen.name,
        soldiers: army.soldiers[i] || 0,
        arms: gen.cur_arms,
        force: stats.force,
        strategy: stats.strategy,
        defense: stats.defense,
        speed: stats.speed,
        destroy: stats.destroy,
        skills: gen.skills || [],
        buffs: [],
      });
    }
    return positions;
  }

  _normalAttack(attacker, defenders, roundData) {
    // Find target (lowest HP defender)
    const target = defenders.reduce((min, d) =>
      d.soldiers > 0 && (min === null || d.soldiers < min.soldiers) ? d : min, null);

    if (!target || target.soldiers <= 0) return;

    const ratio = ARMS_RATIOS[attacker.arms]?.[target.arms] || 1.0;
    const damage = Math.max(1, (attacker.force - target.defense) * attacker.soldiers * ratio * config.DAMAGE_MULTIPLIER);

    target.soldiers = Math.max(0, target.soldiers - Math.floor(damage));

    roundData.actions.push({
      attacker: attacker.generalName,
      target: target.generalName,
      damage: Math.floor(damage),
      type: 'normal',
    });
  }

  _applyBeforeAttackSkills(position, allies, enemies, roundData) {
    for (const skillId of position.skills) {
      const skill = staticData.getSkillConfig(skillId);
      if (!skill || skill.trigger !== 'before_attack') continue;
      if (Math.random() > skill.probability) continue;

      this._applySkillEffect(skill, position, allies, enemies, roundData);
    }
  }

  _applyAfterAttackSkills(position, allies, enemies, roundData) {
    for (const skillId of position.skills) {
      const skill = staticData.getSkillConfig(skillId);
      if (!skill || skill.trigger !== 'after_attack') continue;
      if (Math.random() > skill.probability) continue;

      this._applySkillEffect(skill, position, allies, enemies, roundData);
    }
  }

  _applySkillEffect(skill, caster, allies, enemies, roundData) {
    const targets = skill.target.startsWith('our') ? allies :
                    skill.target.startsWith('enemy') ? enemies : [caster];

    const effect = skill.effect;
    const value = skill.value;

    for (const t of targets) {
      if (t.soldiers <= 0) continue;

      if (effect === 'hurt_rate') {
        const damage = Math.floor(t.soldiers * value);
        t.soldiers = Math.max(0, t.soldiers - damage);
        roundData.actions.push({
          caster: caster.generalName,
          target: t.generalName,
          skill: skill.name,
          damage,
          type: 'skill',
        });
      } else if (effect.endsWith('_buff')) {
        const stat = effect.replace('_buff', '');
        t[stat] = (t[stat] || 0) * (1 + value);
        roundData.actions.push({
          caster: caster.generalName,
          target: t.generalName,
          skill: skill.name,
          buff: `${stat}+${Math.round(value * 100)}%`,
          type: 'skill',
        });
      } else if (effect.endsWith('_debuff')) {
        const stat = effect.replace('_debuff', '');
        t[stat] = (t[stat] || 0) * (1 - value);
        roundData.actions.push({
          caster: caster.generalName,
          target: t.generalName,
          skill: skill.name,
          debuff: `${stat}-${Math.round(value * 100)}%`,
          type: 'skill',
        });
      }
    }
  }

  // Arrival handlers
  _handleAttackArrival(army) {
    const mapManager = require('./mapManager');
    const key = `${army.to_x},${army.to_y}`;
    const building = mapManager.playerBuildings.get(key);

    let result;
    if (building) {
      // Attack enemy building
      const defenderArmy = this._getDefenderArmy(building.role_id, army.to_x, army.to_y);
      result = this.executeCombat(army, defenderArmy || this._createNPCArmy(building.level), army.role_id, building.role_id);

      if (result.result === 'win') {
        // Transfer ownership
        mapManager._removePosition(army.to_x, army.to_y, building.role_id);
        building.role_id = army.role_id;
        building.occupied_at = new Date().toISOString();
        building.durability = Math.floor(building.max_durability * 0.5);

        const db = getDB();
        db.prepare('UPDATE map_buildings SET role_id = ?, durability = ?, occupied_at = ? WHERE id = ?')
          .run(army.role_id, building.durability, building.occupied_at, building.id);

        mapManager._addPosition(army.to_x, army.to_y, army.role_id);
      }
    }

    // Army returns to idle at location
    army.command = 'idle';
    const db = getDB();
    db.prepare('UPDATE armies SET command = ?, soldiers = ? WHERE id = ?')
      .run('idle', JSON.stringify(army.soldiers), army.id);

    this._saveWarReport(army.role_id, building?.role_id || 0, result);
    return result;
  }

  _handleDefendArrival(army) {
    army.command = 'defend';
    const db = getDB();
    db.prepare('UPDATE armies SET command = ? WHERE id = ?').run('defend', army.id);
  }

  _handleBackArrival(army) {
    const mapManager = require('./mapManager');
    const city = mapManager.playerCities.get(army.city_id);
    army.command = 'idle';
    if (city) {
      army.from_x = city.x;
      army.from_y = city.y;
    }
    const db = getDB();
    db.prepare('UPDATE armies SET command = ?, soldiers = ? WHERE id = ?')
      .run('idle', JSON.stringify(army.soldiers), army.id);
  }

  _handleTransferArrival(army) {
    army.command = 'idle';
    const db = getDB();
    db.prepare('UPDATE armies SET command = ? WHERE id = ?').run('idle', army.id);
  }

  _handleReclamationArrival(army) {
    // Gain resources over time, then return
    const resourceManager = require('./resourceManager');
    const reclaimAmount = { food: 100, wood: 50 };
    resourceManager.addResources(army.role_id, reclaimAmount);

    // Auto-return after reclamation
    army.command = 'back';
    const db = getDB();
    db.prepare('UPDATE armies SET command = ? WHERE id = ?').run('back', army.id);

    // Schedule return
    setTimeout(() => this._handleBackArrival(army), 5000);
  }

  _getDefenderArmy(roleId, x, y) {
    const roleArmies = this.armies.get(roleId);
    if (!roleArmies) return null;

    for (const [, army] of roleArmies) {
      if ((army.command === 'defend') && army.to_x === x && army.to_y === y) {
        return army;
      }
    }
    return null;
  }

  _createNPCArmy(level) {
    const npcConfig = staticData.loadBuildings().npcArmies.find(n => n.tileLevel === level) ||
                      staticData.loadBuildings().npcArmies[0];

    return {
      generals: [],
      soldiers: [Math.floor(npcConfig.soldiers / 3), Math.floor(npcConfig.soldiers / 3), Math.floor(npcConfig.soldiers / 3)],
      command: 'defend',
      role_id: 0,
    };
  }

  _saveWarReport(attackerId, defenderId, result) {
    const db = getDB();
    db.prepare(`
      INSERT INTO war_reports (attacker_id, defender_id, rounds, result, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(attackerId, defenderId, JSON.stringify(result?.rounds || []), result?.result || 'draw');
  }
}

module.exports = new ArmyManager();
