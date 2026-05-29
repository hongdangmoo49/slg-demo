/**
 * Research Manager - technology/research system
 */

const { getDB } = require('../config/database');
const resourceManager = require('./resourceManager');

const fs = require('fs');
const path = require('path');
const CONF_DIR = path.join(__dirname, '../../data/conf');
let techConfig = null;

function loadTechConfig() {
  if (!techConfig) {
    const facConf = JSON.parse(fs.readFileSync(path.join(CONF_DIR, 'facilities.json'), 'utf-8'));
    techConfig = facConf.technologies || {};
  }
  return techConfig;
}

class ResearchManager {
  constructor() {
    this.research = new Map(); // roleId -> { current: techId, queue: [], completed: Set }
  }

  init() {
    loadTechConfig();
    const db = getDB();

    // Create research table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_research (
        role_id INTEGER PRIMARY KEY,
        completed TEXT DEFAULT '[]',
        current_tech TEXT,
        start_time DATETIME,
        end_time DATETIME,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `);

    const rows = db.prepare('SELECT * FROM role_research').all();
    for (const row of rows) {
      this.research.set(row.role_id, {
        completed: new Set(JSON.parse(row.completed || '[]')),
        currentTech: row.current_tech || null,
        startTime: row.start_time,
        endTime: row.end_time,
      });
    }
    console.log(`Research loaded: ${this.research.size} roles`);

    // Start research completion checker
    setInterval(() => this._checkCompletions(), 5000);
  }

  _checkCompletions() {
    const now = Date.now();
    const db = getDB();

    for (const [roleId, data] of this.research) {
      if (!data.currentTech || !data.endTime) continue;

      if (new Date(data.endTime).getTime() <= now) {
        data.completed.add(data.currentTech);
        const techId = data.currentTech;
        data.currentTech = null;
        data.startTime = null;
        data.endTime = null;

        db.prepare(`
          UPDATE role_research SET completed = ?, current_tech = NULL, start_time = NULL, end_time = NULL
          WHERE role_id = ?
        `).run(JSON.stringify([...data.completed]), roleId);

        // Notify player
        const connMgr = require('../net/connectionManager');
        connMgr.pushToRole(roleId, 'research:completed', { techId });

        console.log(`Research completed: role=${roleId} tech=${techId}`);
      }
    }
  }

  /**
   * Get all techs with completion status for a role
   */
  getTechTree(roleId) {
    const techs = loadTechConfig();
    const data = this.research.get(roleId);
    const completed = data?.completed || new Set();
    const result = {};

    for (const [category, techList] of Object.entries(techs)) {
      result[category] = techList.map(tech => ({
        ...tech,
        status: completed.has(tech.id) ? 'completed' :
                data?.currentTech === tech.id ? 'researching' :
                this._canResearch(roleId, tech, completed) ? 'available' : 'locked',
      }));
    }

    if (data?.currentTech) {
      result.currentResearch = {
        techId: data.currentTech,
        startTime: data.startTime,
        endTime: data.endTime,
        remaining: Math.max(0, new Date(data.endTime).getTime() - Date.now()),
      };
    }

    return result;
  }

  _canResearch(roleId, tech, completed) {
    // Check prerequisites
    for (const req of (tech.requires || [])) {
      if (!completed.has(req)) return false;
    }
    return true;
  }

  /**
   * Start researching a technology
   */
  startResearch(roleId, techId) {
    const data = this.research.get(roleId);

    if (data?.currentTech) {
      return { error: 'Already researching something' };
    }

    if (data?.completed.has(techId)) {
      return { error: 'Already completed' };
    }

    // Find tech config
    const techs = loadTechConfig();
    let tech = null;
    for (const [, techList] of Object.entries(techs)) {
      tech = techList.find(t => t.id === techId);
      if (tech) break;
    }

    if (!tech) return { error: 'Technology not found' };

    const completed = data?.completed || new Set();
    if (!this._canResearch(roleId, tech, completed)) {
      return { error: 'Prerequisites not met' };
    }

    // Check cost
    if (!resourceManager.canAfford(roleId, tech.cost)) {
      return { error: 'Insufficient resources', cost: tech.cost };
    }

    resourceManager.deductResources(roleId, tech.cost);

    const endTime = new Date(Date.now() + tech.time * 1000);
    const researchData = {
      completed,
      currentTech: techId,
      startTime: new Date().toISOString(),
      endTime: endTime.toISOString(),
    };

    this.research.set(roleId, researchData);

    const db = getDB();
    db.prepare(`
      INSERT INTO role_research (role_id, completed, current_tech, start_time, end_time)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(role_id) DO UPDATE SET
        completed = excluded.completed,
        current_tech = excluded.current_tech,
        start_time = excluded.start_time,
        end_time = excluded.end_time
    `).run(roleId, JSON.stringify([...completed]), techId, endTime.toISOString());

    return {
      success: true,
      tech: { ...tech, status: 'researching' },
      endTime: endTime.toISOString(),
      duration: tech.time,
    };
  }

  /**
   * Get accumulated bonuses from completed research
   */
  getResearchBonuses(roleId) {
    const data = this.research.get(roleId);
    if (!data) return {};

    const techs = loadTechConfig();
    const bonuses = {};

    for (const [, techList] of Object.entries(techs)) {
      for (const tech of techList) {
        if (data.completed.has(tech.id) && tech.bonus) {
          for (const [key, val] of Object.entries(tech.bonus)) {
            bonuses[key] = (bonuses[key] || 0) + val;
          }
        }
      }
    }

    return bonuses;
  }
}

module.exports = new ResearchManager();
