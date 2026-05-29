/**
 * City Scene - City management with facility upgrades
 */

import Phaser from 'phaser';
import network from '../network/socket.js';
import { UI } from '../config/theme.js';

export class CityScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CityScene' });
    this.facilities = [];
    this.cityId = null;
  }

  create(data) {
    const { width, height } = this.cameras.main;
    this.cityId = data?.cityId;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1A1A2E);
    bg.fillRect(0, 0, width, height);

    // Header gradient
    bg.fillStyle(UI.PRIMARY, 0.4);
    bg.fillRect(0, 0, width, 60);
    bg.fillStyle(UI.ACCENT, 0.6);
    bg.fillRect(0, 58, width, 2);

    // Title
    this.add.text(width / 2, 18, '🏰 City Management', {
      fontSize: '20px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    this.add.text(width / 2, 40, 'Upgrade facilities to strengthen your empire', {
      fontSize: '11px', color: '#B0BEC5',
    }).setOrigin(0.5);

    // Back button
    const backBtn = this._createButton(10, 12, 70, 36, '← Back', 0x616161, () => {
      this.scene.switch('GameScene');
    });

    // Resource bar
    this._resourceTexts = {};
    this._createResourceBar(width);

    // Facilities grid
    this._createFacilitiesGrid(width, height);

    // Tab buttons (Facilities / Research)
    const tabY = 82;
    this._activeTab = 'facilities';

    const facTab = this._createTabButton(width / 2 - 80, tabY, 75, 28, 'Facilities', true);
    facTab.hitArea.on('pointerdown', () => this._switchTab('facilities'));

    const resTab = this._createTabButton(width / 2 + 5, tabY, 75, 28, 'Research', false);
    resTab.hitArea.on('pointerdown', () => this._switchTab('research'));

    // Research container (hidden by default)
    this._researchContainer = this.add.container(0, 0);
    this._researchContainer.setDepth(10);
    this._researchContainer.setVisible(false);

    // Register handlers
    this._registerHandlers();

    // Request data
    if (this.cityId) {
      network.socket?.emit('city:facilities', { cityId: this.cityId });
    }
    network.socket?.emit('resource:get');
  }

  _createTabButton(x, y, w, h, text, active) {
    const bg = this.add.graphics();
    bg.fillStyle(active ? UI.ACCENT : 0x333333);
    bg.fillRoundedRect(x, y, w, h, 4);
    const label = this.add.text(x + w / 2, y + h / 2, text, {
      fontSize: '12px', color: active ? '#000000' : '#B0BEC5',
    }).setOrigin(0.5);
    const hitArea = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    return { bg, label, hitArea };
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this._facilityContainer.setVisible(tab === 'facilities');
    this._researchContainer.setVisible(tab === 'research');

    if (tab === 'research' && !this._techTree) {
      network.socket?.emit('research:tree');
    }
  }

  _renderTechTree(data) {
    this._techTree = data;
    this._researchContainer.removeAll(true);

    const { width, height } = this.cameras.main;
    const startY = 115;
    const cardH = 72;
    let yOff = startY;

    const categoryNames = { military: '⚔️ Military', economy: '💰 Economy', naval: '🚢 Naval' };

    for (const [category, techs] of Object.entries(data)) {
      if (category === 'currentResearch') continue;

      // Category header
      const header = this.add.text(10, yOff, categoryNames[category] || category, {
        fontSize: '14px', color: '#FFC107', fontFamily: 'Georgia, serif',
      });
      this._researchContainer.add(header);
      yOff += 22;

      for (const tech of techs) {
        this._createTechCard(10, yOff, width - 20, cardH, tech, category);
        yOff += cardH + 6;
      }
      yOff += 10;
    }

    // Current research banner
    if (data.currentResearch) {
      const cr = data.currentResearch;
      const remaining = Math.ceil(cr.remaining / 1000);
      const banner = this.add.graphics();
      banner.fillStyle(UI.PRIMARY, 0.9);
      banner.fillRoundedRect(10, startY - 30, width - 20, 26, 4);
      this._researchContainer.add(banner);
      const bannerText = this.add.text(width / 2, startY - 17,
        `🔬 Researching: ${cr.techId} (${remaining}s remaining)`, {
          fontSize: '11px', color: '#FFC107',
        }).setOrigin(0.5);
      this._researchContainer.add(bannerText);
    }
  }

  _createTechCard(x, y, w, h, tech, category) {
    const container = this.add.container(x, y);
    this._researchContainer.add(container);

    const statusColors = {
      completed: { bg: 0x1B5E20, border: 0x4CAF50 },
      researching: { bg: 0xE65100, border: 0xFF9800 },
      available: { bg: UI.PANEL_LIGHT, border: UI.ACCENT },
      locked: { bg: 0x1A1A1A, border: 0x333333 },
    };
    const colors = statusColors[tech.status] || statusColors.locked;

    const cardBg = this.add.graphics();
    cardBg.fillStyle(colors.bg, 0.8);
    cardBg.fillRoundedRect(0, 0, w, h, 6);
    cardBg.lineStyle(1, colors.border, 0.5);
    cardBg.strokeRoundedRect(0, 0, w, h, 6);
    container.add(cardBg);

    // Era tag
    const eraTag = this.add.text(w - 5, 4, tech.era, {
      fontSize: '8px', color: '#78909C', backgroundColor: '#222222', padding: { x: 3, y: 1 },
    }).setOrigin(1, 0);
    container.add(eraTag);

    // Name and status
    const statusIcons = { completed: '✅', researching: '⏳', available: '🔓', locked: '🔒' };
    container.add(this.add.text(8, 6, `${statusIcons[tech.status]} ${tech.name}`, {
      fontSize: '13px', color: tech.status === 'locked' ? '#666666' : '#FFFFFF',
    }));

    // Bonus
    const bonusStr = Object.entries(tech.bonus || {})
      .map(([k, v]) => `${k}: +${v}`)
      .join(' | ');
    container.add(this.add.text(8, 26, bonusStr, {
      fontSize: '9px', color: '#4CAF50',
    }));

    // Cost
    const costStr = Object.entries(tech.cost || {})
      .map(([r, v]) => `${r.charAt(0).toUpperCase()}:${v}`)
      .join(' ');
    container.add(this.add.text(8, 42, `Cost: ${costStr} | Time: ${tech.time}s`, {
      fontSize: '9px', color: '#B0BEC5',
    }));

    // Research button
    if (tech.status === 'available') {
      const btnW = 70;
      const btnH = 24;
      const btnX = w - btnW - 8;
      const btnY = h - btnH - 8;

      const btn = this.add.graphics();
      btn.fillStyle(UI.PRIMARY);
      btn.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
      container.add(btn);

      container.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Research', {
        fontSize: '10px', color: '#FFFFFF',
      }).setOrigin(0.5));

      const hit = this.add.rectangle(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        network.socket?.emit('research:start', { techId: tech.id });
      });
      container.add(hit);
    }
  }

  _registerHandlers() {
    const cleanup = [];

    const h1 = network.on('city:facilitiesList', (data) => {
      if (data.cityId === this.cityId) {
        this.facilities = data.facilities;
        this._renderFacilities();
      }
    });
    cleanup.push(() => network.off('city:facilitiesList', h1));

    const h2 = network.on('city:upgradeResult', (data) => {
      if (data.success) {
        this._showToast(`${data.facility.name} upgraded to Lv.${data.facility.level}!`);
        network.socket?.emit('city:facilities', { cityId: this.cityId });
        network.socket?.emit('resource:get');
      } else {
        this._showToast(data.error, true);
      }
    });
    cleanup.push(() => network.off('city:upgradeResult', h2));

    const h3 = network.on('resource:update', (data) => {
      this._updateResources(data);
    });
    cleanup.push(() => network.off('resource:update', h3));

    const h4 = network.on('research:tree', (data) => {
      this._renderTechTree(data);
    });
    cleanup.push(() => network.off('research:tree', h4));

    const h5 = network.on('research:startResult', (data) => {
      if (data.success) {
        this._showToast(`Started researching: ${data.tech.name} (${data.duration}s)`);
        network.socket?.emit('research:tree');
        network.socket?.emit('resource:get');
      } else {
        this._showToast(data.error, true);
      }
    });
    cleanup.push(() => network.off('research:startResult', h5));

    this.events.on('shutdown', () => {
      cleanup.forEach(fn => fn());
    });
  }

  _createResourceBar(width) {
    const resources = ['gold', 'food', 'wood', 'iron', 'stone'];
    const icons = ['🪙', '🍞', '🪵', '⛏️', '🪨'];
    let rx = 10;

    for (let i = 0; i < resources.length; i++) {
      this.add.text(rx, 66, icons[i], { fontSize: '11px' });
      const text = this.add.text(rx + 14, 66, '0', {
        fontSize: '11px', color: '#FFFFFF',
      });
      this._resourceTexts[resources[i]] = text;
      rx += Math.floor((width - 20) / 5);
    }
  }

  _updateResources(data) {
    if (!data) return;
    for (const res of ['gold', 'food', 'wood', 'iron', 'stone']) {
      const t = this._resourceTexts[res];
      if (t) t.setText(this._fmt(data[res] || 0));
    }
  }

  _createFacilitiesGrid(width, height) {
    this._facilityContainer = this.add.container(0, 0);
    this._facilityContainer.setDepth(10);
  }

  _renderFacilities() {
    this._facilityContainer.removeAll(true);
    const { width, height } = this.cameras.main;

    const facilityList = [
      'main_hall', 'barracks', 'command_post', 'market',
      'tavern', 'warehouse', 'academy', 'wall'
    ];

    const cols = 2;
    const cardW = (width - 30) / cols;
    const cardH = 100;
    const startY = 90;
    const gap = 8;

    for (let i = 0; i < facilityList.length; i++) {
      const facId = facilityList[i];
      const fac = this.facilities.find(f => f.id === facId);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 10 + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      this._createFacilityCard(x, y, cardW, cardH, facId, fac);
    }

    // Scroll indicator if too many
    const totalRows = Math.ceil(facilityList.length / cols);
    const totalH = startY + totalRows * (cardH + gap);
    if (totalH > height - 60) {
      this.add.text(width / 2, height - 50, '↕ Scroll to see more', {
        fontSize: '11px', color: '#78909C',
      }).setOrigin(0.5);
    }
  }

  _createFacilityCard(x, y, w, h, facId, fac) {
    const container = this.add.container(x, y);
    this._facilityContainer.add(container);

    const level = fac?.level || 0;
    const name = fac?.name || facId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const icon = fac?.icon || '🏠';
    const canUpgrade = fac?.canUpgrade && level > 0;
    const isBuilt = level > 0;

    // Card background
    const cardBg = this.add.graphics();
    if (isBuilt) {
      cardBg.fillStyle(UI.PANEL_LIGHT, 0.9);
    } else {
      cardBg.fillStyle(0x1A1A1A, 0.7);
    }
    cardBg.fillRoundedRect(0, 0, w, h, 8);
    cardBg.lineStyle(1, isBuilt ? UI.ACCENT : 0x444444, isBuilt ? 0.4 : 0.2);
    cardBg.strokeRoundedRect(0, 0, w, h, 8);
    container.add(cardBg);

    // Icon
    const iconText = this.add.text(12, 12, icon, { fontSize: '28px' });
    container.add(iconText);

    // Name
    container.add(this.add.text(48, 8, name, {
      fontSize: '13px', color: isBuilt ? '#FFFFFF' : '#666666', fontFamily: 'Arial',
    }));

    // Level bar
    if (isBuilt) {
      const barW = w - 60;
      const barH = 6;
      const barY = 30;

      const barBg = this.add.graphics();
      barBg.fillStyle(0x333333);
      barBg.fillRoundedRect(48, barY, barW, barH, 3);
      container.add(barBg);

      const maxLvl = fac.maxLevel || 5;
      const fillW = Math.min(barW, (level / maxLvl) * barW);
      const barFill = this.add.graphics();
      barFill.fillStyle(UI.ACCENT);
      barFill.fillRoundedRect(48, barY, fillW, barH, 3);
      container.add(barFill);

      // Level text
      container.add(this.add.text(48 + barW, barY - 2, `Lv.${level}`, {
        fontSize: '10px', color: '#FFC107',
      }).setOrigin(1, 0));

      // Bonus text
      const bonusParts = [];
      if (fac.bonus) {
        for (const [key, val] of Object.entries(fac.bonus)) {
          if (val > 0) bonusParts.push(`${key}: +${val}`);
        }
      }
      if (bonusParts.length > 0) {
        container.add(this.add.text(48, 42, bonusParts.slice(0, 2).join(' | '), {
          fontSize: '9px', color: '#4CAF50',
        }));
      }
    } else {
      container.add(this.add.text(48, 30, 'Not built yet', {
        fontSize: '11px', color: '#555555',
      }));
    }

    // Upgrade button
    if (canUpgrade && fac.upgradeCost) {
      const btnW = 72;
      const btnH = 28;
      const btnX = w - btnW - 8;
      const btnY = h - btnH - 8;

      const upgradeBtn = this.add.graphics();
      upgradeBtn.fillStyle(UI.SUCCESS);
      upgradeBtn.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
      container.add(upgradeBtn);

      // Cost preview
      const costStr = Object.entries(fac.upgradeCost)
        .map(([r, v]) => `${r.charAt(0).toUpperCase()}:${v}`)
        .join(' ');
      container.add(this.add.text(btnX + btnW / 2, btnY + 2, `⬆ Lv.${level + 1}`, {
        fontSize: '10px', color: '#FFFFFF',
      }).setOrigin(0.5, 0));

      container.add(this.add.text(btnX + btnW / 2, btnY + 15, costStr, {
        fontSize: '7px', color: '#C8E6C9',
      }).setOrigin(0.5, 0));

      const hitArea = this.add.rectangle(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        network.socket?.emit('city:upgradeFacility', { cityId: this.cityId, facilityId: facId });
      });
      container.add(hitArea);
    }

    // Full card click for info
    if (!canUpgrade && isBuilt) {
      const maxTag = this.add.text(w - 8, 8, 'MAX', {
        fontSize: '8px', color: '#78909C', backgroundColor: '#333333', padding: { x: 3, y: 1 },
      }).setOrigin(1, 0);
      container.add(maxTag);
    }
  }

  _createButton(x, y, w, h, text, color, callback) {
    const bg = this.add.graphics();
    bg.fillStyle(color);
    bg.fillRoundedRect(x, y, w, h, 6);

    const label = this.add.text(x + w / 2, y + h / 2, text, {
      fontSize: '12px', color: '#FFFFFF',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', callback);

    return { bg, label, hitArea };
  }

  _showToast(message, isError = false) {
    const { width, height } = this.cameras.main;
    const toast = this.add.text(width / 2, height / 2, message, {
      fontSize: '14px', color: '#FFFFFF',
      backgroundColor: isError ? '#D32F2FDD' : '#1A237EDD',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: toast, alpha: 0, y: height / 2 - 50,
      duration: 2500, ease: 'Power2',
      onComplete: () => toast.destroy(),
    });
  }

  _fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }
}
