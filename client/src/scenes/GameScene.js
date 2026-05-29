/**
 * Game Scene - Main world map and game UI
 * The heart of the SLG game client
 */

import Phaser from 'phaser';
import network from '../network/socket.js';
import { TILE_SIZE, TILE, TILE_NAMES, UI, RESOURCE_COLORS, FACTIONS } from '../config/theme.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.mapTiles = {};
    this.buildingSprites = {};
    this.armyMarkers = {};
    this.selectedTile = null;
    this.playerCity = null;
    this.roleData = null;
    this.resourceData = null;
    this.panelOpen = null;
    this.tileMapGroup = null;
    this.uiLayer = null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Initialize network
    const token = this.registry.get('token');
    const role = this.registry.get('role');
    if (!token || !role) {
      this.scene.start('LoginScene');
      return;
    }

    this.roleData = role;
    this.tileMapGroup = this.add.group();
    this.uiLayer = this.add.container(0, 0);
    this.uiLayer.setDepth(100);

    // Network setup
    network.init(token, role.id);
    this._registerNetworkHandlers();

    // Camera controls
    this._setupCamera();

    // Create world map background
    this._createWorldBackground();

    // UI overlay
    this._createTopBar(width, height);
    this._createBottomBar(width, height);

    // Bottom-right action buttons
    this._createActionButtons(width, height);

    // Request initial data
    network.on('connected', () => {
      network.getRoleInfo();
      network.getMyCity();
      network.scanBlock(50, 50, 21);
      network.getResources();
      network.getGenerals();
      network.getArmies();
      network.getMyAlliance();
    });

    // Show loading
    this._showLoading();

    // Handle resize
    this.scale.on('resize', (gameSize) => {
      this._onResize(gameSize);
    });
  }

  _registerNetworkHandlers() {
    network.on('role:info', (data) => {
      this.roleData = { ...this.roleData, ...data.role };
      this.resourceData = data.resources;
      this._updateResourceBar();
      this._hideLoading();
    });

    network.on('role:mainCity', (city) => {
      if (city) {
        this.playerCity = city;
        this.cameras.main.centerOn(city.x * TILE_SIZE, city.y * TILE_SIZE);
        network.scanBlock(city.x, city.y, 21);
      }
    });

    network.on('map:scanResult', (data) => {
      this._renderTiles(data.tiles);
    });

    network.on('resource:update', (data) => {
      this.resourceData = data;
      this._updateResourceBar();
    });

    network.on('resource:collectResult', (data) => {
      if (data.success) {
        this._showToast(`Collected: 🪙${data.collection.gold} 🍞${data.collection.food} 🪵${data.collection.wood}`);
        network.getResources();
      } else {
        this._showToast(data.error, true);
      }
    });

    network.on('map:buildResult', (data) => {
      if (data.success) {
        this._showToast('Building constructed!');
        this._closePanel();
        if (this.playerCity) {
          network.scanBlock(this.playerCity.x, this.playerCity.y, 21);
        }
        network.getResources();
      } else {
        this._showToast(data.error, true);
      }
    });

    network.on('general:drawResult', (data) => {
      if (data.success) {
        this._showGeneralDrawResult(data.general);
        network.getResources();
        network.getGenerals();
      } else {
        this._showToast(data.error, true);
      }
    });

    network.on('general:list', (data) => {
      this._generals = data.generals;
    });

    network.on('army:list', (data) => {
      this._armies = data.armies;
    });

    network.on('army:commandResult', (data) => {
      if (data.success) {
        this._showToast(`Army marching! ETA: ${Math.ceil(data.travelTime / 1000)}s`);
      } else {
        this._showToast(data.error, true);
      }
    });

    network.on('alliance:myAlliance', (data) => {
      this._alliance = data;
    });

    network.on('map:updated', (data) => {
      if (this.playerCity) {
        network.scanBlock(this.playerCity.x, this.playerCity.y, 21);
      }
    });

    network.on('chat:message', (msg) => {
      this._addChatMessage(msg);
    });
  }

  _setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, 100 * TILE_SIZE, 100 * TILE_SIZE);

    // Pan with pointer drag
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && !this._draggingUI) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });

    // Zoom with mouse wheel / pinch
    this.input.on('wheel', (pointer, gos, dx, dy) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.3, 2);
      cam.setZoom(newZoom);
    });
  }

  _createWorldBackground() {
    // Ocean background
    const g = this.add.graphics();
    g.fillStyle(0x0D47A1);
    g.fillRect(-500, -500, 100 * TILE_SIZE + 1000, 100 * TILE_SIZE + 1000);
    g.setDepth(-10);
  }

  _renderTiles(tiles) {
    for (const tile of tiles) {
      const key = `${tile.x},${tile.y}`;
      if (this.mapTiles[key]) continue; // Already rendered

      const textureKey = `tile_${tile.terrain.type}`;

      let sprite;
      if (this.textures.exists(textureKey)) {
        sprite = this.add.image(tile.x * TILE_SIZE, tile.y * TILE_SIZE, textureKey);
      } else {
        sprite = this.add.rectangle(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x8BC34A);
      }

      sprite.setOrigin(0);
      sprite.setInteractive();
      sprite.setDepth(0);

      // Store tile data
      sprite.tileData = tile;

      // Click handler
      sprite.on('pointerdown', () => {
        this._onTileClick(sprite, tile);
      });

      // Hover
      sprite.on('pointerover', () => {
        sprite.setTint(0xCCCC00);
      });
      sprite.on('pointerout', () => {
        sprite.clearTint();
      });

      this.mapTiles[key] = sprite;
      this.tileMapGroup.add(sprite);

      // Render buildings/cities on tile
      if (tile.building) {
        this._renderBuilding(tile);
      }
      if (tile.city) {
        this._renderCity(tile);
      }
    }
  }

  _renderBuilding(tile) {
    const key = `bld_${tile.x}_${tile.y}`;
    if (this.buildingSprites[key]) return;

    // Building marker on tile
    const bx = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const by = tile.y * TILE_SIZE + TILE_SIZE / 2;

    const marker = this.add.circle(bx, by, 8, 0xFF9800);
    marker.setStrokeStyle(2, 0xFFFFFF);
    marker.setDepth(5);
    marker.setData('buildingData', tile.building);

    // Owner indicator
    const isMine = tile.building.role_id === this.roleData?.id;
    if (isMine) {
      marker.setFillStyle(0x4CAF50);
    }

    this.buildingSprites[key] = marker;
  }

  _renderCity(tile) {
    const key = `city_${tile.x}_${tile.y}`;
    if (this.buildingSprites[key]) return;

    const cx = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = tile.y * TILE_SIZE + TILE_SIZE / 2;

    // City castle icon
    const castle = this.add.rectangle(cx, cy, 40, 40, 0x9C27B0);
    castle.setStrokeStyle(3, 0xFFC107);
    castle.setDepth(10);
    castle.setData('cityData', tile.city);

    // City name
    const nameText = this.add.text(cx, cy - 28, tile.city.name || 'City', {
      fontSize: '10px', color: '#FFFFFF', fontFamily: 'Arial',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(11);

    this.buildingSprites[key] = castle;
  }

  _onTileClick(sprite, tile) {
    // Deselect previous
    if (this._selectionMarker) this._selectionMarker.destroy();

    // Show selection
    this._selectionMarker = this.add.image(tile.x * TILE_SIZE, tile.y * TILE_SIZE, 'selection');
    this._selectionMarker.setOrigin(0).setDepth(20);

    this.selectedTile = tile;
    this._showTileInfo(tile);
  }

  _showTileInfo(tile) {
    this._closePanel();

    const { width, height } = this.cameras.main;
    const panelW = Math.min(300, width - 20);
    const panelH = 260;
    const px = (width - panelW) / 2;
    const py = height - panelH - 80;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.97);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.ACCENT, 0.6);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    // Title
    const terrainName = TILE_NAMES[tile.terrain.type] || 'Unknown';
    const title = this.add.text(px + panelW / 2, py + 16, `${terrainName} (${tile.x}, ${tile.y})`, {
      fontSize: '15px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    // Terrain level
    if (tile.terrain.level > 0) {
      const level = this.add.text(px + panelW / 2, py + 36, `Level ${tile.terrain.level}`, {
        fontSize: '12px', color: '#B0BEC5',
      }).setOrigin(0.5);
      container.add(level);
    }

    let yOffset = py + 58;

    // Building info
    if (tile.building) {
      const bldText = this.add.text(px + 15, yOffset, `🏗️ Building: ${tile.building.type} Lv.${tile.building.level}`, {
        fontSize: '13px', color: '#FFFFFF',
      });
      container.add(bldText);

      const durText = this.add.text(px + 15, yOffset + 20,
        `Durability: ${tile.building.durability}/${tile.building.max_durability}`, {
          fontSize: '12px', color: '#B0BEC5',
        });
      container.add(durText);
      yOffset += 45;
    }

    // City info
    if (tile.city) {
      const cityText = this.add.text(px + 15, yOffset, `🏰 ${tile.city.name}`, {
        fontSize: '14px', color: '#CE93D8',
      });
      container.add(cityText);
      yOffset += 25;
    }

    // Action buttons
    const btnY = py + panelH - 60;
    const btnW = (panelW - 40) / 2;

    // Build/Occupy button
    if (!tile.building && !tile.city && tile.terrain.type !== TILE.WATER && tile.terrain.type !== TILE.PLAIN) {
      const buildBtn = this._createUIButton(px + 10, btnY, btnW, 44, 'Build', UI.SUCCESS, () => {
        network.buildOnMap(tile.x, tile.y, tile.terrain.type);
      });
      container.add(buildBtn);
    }

    // Attack button (if enemy building)
    if (tile.building && tile.building.role_id !== this.roleData?.id) {
      const atkBtn = this._createUIButton(px + 10, btnY, btnW, 44, '⚔️ Attack', UI.DANGER, () => {
        this._showArmySelect(tile, 'attack');
      });
      container.add(atkBtn);
    }

    // Close button
    const closeBtn = this._createUIButton(px + panelW - btnW - 10, btnY, btnW, 44, 'Close', 0x616161, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _showArmySelect(targetTile, command) {
    this._closePanel();

    const { width, height } = this.cameras.main;
    const panelW = Math.min(300, width - 20);
    const panelH = 300;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.DANGER, 0.6);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 16, `Select Army to ${command.toUpperCase()}`, {
      fontSize: '15px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    const armies = this._armies || [];
    let yOff = py + 40;

    for (const army of armies) {
      if (army.command !== 'idle') continue;
      if (!army.generals || army.generals.length === 0) continue;

      const totalSoldiers = (army.soldiers || [0, 0, 0]).reduce((s, v) => s + v, 0);
      if (totalSoldiers === 0) continue;

      const armyBtn = this._createUIButton(px + 10, yOff, panelW - 20, 40,
        `Army ${army.army_order} — ${totalSoldiers} soldiers`, UI.DANGER, () => {
          network.armyCommand(army.id, command, targetTile.x, targetTile.y);
          this._closePanel();
          this._showToast('Army dispatched!');
        });
      container.add(armyBtn);
      yOff += 48;
    }

    if (yOff <= py + 48) {
      const noArmy = this.add.text(px + panelW / 2, py + 80, 'No available armies.\nConscript soldiers and assign generals first.', {
        fontSize: '13px', color: '#B0BEC5', align: 'center',
      }).setOrigin(0.5);
      container.add(noArmy);
    }

    const closeBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44, 'Cancel', 0x616161, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _createTopBar(width, height) {
    const topBar = this.add.container(0, 0);
    topBar.setDepth(100);
    topBar.setScrollFactor(0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(UI.DARK, 0.9);
    bg.fillRect(0, 0, width, 56);
    bg.fillStyle(UI.ACCENT, 0.6);
    bg.fillRect(0, 54, width, 2);
    topBar.add(bg);

    // Player name
    const nameText = this.add.text(12, 8, this.roleData?.nickname || 'Commander', {
      fontSize: '14px', color: '#FFC107', fontFamily: 'Georgia, serif',
    });
    topBar.add(nameText);
    this._nameText = nameText;

    // Faction
    const faction = FACTIONS[this.roleData?.faction || 'europe'];
    const factionText = this.add.text(12, 28, faction?.name || '', {
      fontSize: '10px', color: '#B0BEC5',
    });
    topBar.add(factionText);

    // Resources
    this._resourceTexts = {};
    const resources = ['gold', 'food', 'wood', 'iron', 'stone'];
    const resIcons = ['🪙', '🍞', '🪵', '⛏️', '🪨'];
    let rx = 120;

    for (let i = 0; i < resources.length; i++) {
      const icon = this.add.text(rx, 10, resIcons[i], { fontSize: '13px' });
      topBar.add(icon);

      const text = this.add.text(rx + 18, 10, '0', {
        fontSize: '13px', color: '#FFFFFF', fontFamily: 'Arial',
      });
      topBar.add(text);
      this._resourceTexts[resources[i]] = text;

      // Yield text
      const yieldText = this.add.text(rx + 18, 28, '+0/h', {
        fontSize: '9px', color: '#4CAF50',
      });
      topBar.add(yieldText);
      this._resourceTexts[resources[i] + '_yield'] = yieldText;

      rx += Math.floor((width - 130) / 5);
    }
  }

  _createBottomBar(width, height) {
    const bottomBar = this.add.container(0, 0);
    bottomBar.setDepth(100);
    bottomBar.setScrollFactor(0);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(UI.DARK, 0.9);
    bg.fillRect(0, height - 68, width, 68);
    bg.fillStyle(UI.ACCENT, 0.4);
    bg.fillRect(0, height - 68, width, 2);
    bottomBar.add(bg);

    // Menu buttons
    const buttons = [
      { icon: '🗺️', label: 'Map', action: () => this._closePanel() },
      { icon: '⚔️', label: 'Army', action: () => this._showArmyPanel() },
      { icon: '👤', label: 'Heroes', action: () => this._showGeneralPanel() },
      { icon: '🏰', label: 'Alliance', action: () => this._showAlliancePanel() },
      { icon: '💬', label: 'Chat', action: () => this._showChatPanel() },
      { icon: '📦', label: 'Collect', action: () => network.collectResources() },
    ];

    const btnW = Math.floor(width / buttons.length);
    for (let i = 0; i < buttons.length; i++) {
      const bx = i * btnW;

      const hitArea = this.add.rectangle(bx + btnW / 2, height - 34, btnW, 68, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.setScrollFactor(0);

      const icon = this.add.text(bx + btnW / 2, height - 42, buttons[i].icon, {
        fontSize: '22px',
      }).setOrigin(0.5).setScrollFactor(0);

      const label = this.add.text(bx + btnW / 2, height - 18, buttons[i].label, {
        fontSize: '10px', color: '#B0BEC5',
      }).setOrigin(0.5).setScrollFactor(0);

      hitArea.on('pointerdown', buttons[i].action);

      bottomBar.add([hitArea, icon, label]);
    }

    // Chat messages (floating)
    this._chatContainer = this.add.container(10, height - 320);
    this._chatContainer.setDepth(90);
    this._chatContainer.setScrollFactor(0);
    this._chatMessages = [];
  }

  _createActionButtons(width, height) {
    // Right side quick actions
    const container = this.add.container(0, 0);
    container.setDepth(100);
    container.setScrollFactor(0);

    const actions = [
      { icon: '🔍+', label: 'Zoom In', action: () => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom + 0.2, 0.3, 2));
      }},
      { icon: '🔍-', label: 'Zoom Out', action: () => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - 0.2, 0.3, 2));
      }},
      { icon: '🏠', label: 'Home', action: () => {
        if (this.playerCity) {
          this.cameras.main.centerOn(this.playerCity.x * TILE_SIZE, this.playerCity.y * TILE_SIZE);
        }
      }},
    ];

    for (let i = 0; i < actions.length; i++) {
      const by = height / 2 - 60 + i * 50;
      const btn = this.add.circle(width - 30, by, 20, UI.SECONDARY);
      btn.setStrokeStyle(2, UI.ACCENT);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', actions[i].action);

      const icon = this.add.text(width - 30, by, actions[i].icon, {
        fontSize: '16px',
      }).setOrigin(0.5);

      container.add([btn, icon]);
    }
  }

  _updateResourceBar() {
    if (!this.resourceData) return;
    const resources = ['gold', 'food', 'wood', 'iron', 'stone'];

    for (const res of resources) {
      const text = this._resourceTexts[res];
      if (text) {
        const val = this.resourceData[res] || 0;
        text.setText(this._formatNumber(val));
      }
      const yieldText = this._resourceTexts[res + '_yield'];
      if (yieldText) {
        const y = this.resourceData[res + '_yield'] || 0;
        yieldText.setText(`+${Math.floor(y)}/h`);
      }
    }
  }

  _showGeneralPanel() {
    this._closePanel();
    const { width, height } = this.cameras.main;
    const panelW = Math.min(340, width - 20);
    const panelH = Math.min(500, height - 100);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.ACCENT, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 16, '⚔️ Generals', {
      fontSize: '17px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    // Draw button
    const drawBtn = this._createUIButton(px + 10, py + 40, panelW - 20, 40,
      '🎲 Recruit General (🪙300)', UI.PRIMARY, () => {
        network.drawGeneral();
      });
    container.add(drawBtn);

    // General list
    const generals = this._generals || [];
    let yOff = py + 90;

    for (const gen of generals.slice(0, 6)) {
      const row = this._createGeneralRow(px + 10, yOff, panelW - 20, gen);
      container.add(row);
      yOff += 60;
    }

    if (generals.length === 0) {
      const empty = this.add.text(px + panelW / 2, py + 120, 'No generals yet.\nRecruit your first general!', {
        fontSize: '14px', color: '#B0BEC5', align: 'center',
      }).setOrigin(0.5);
      container.add(empty);
    }

    const closeBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44, 'Close', 0x616161, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _createGeneralRow(x, y, w, gen) {
    const row = this.add.container(0, 0);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL_LIGHT, 0.8);
    bg.fillRoundedRect(x, y, w, 54, 6);
    row.add(bg);

    // Portrait
    const portrait = this.add.image(x + 28, y + 27, 'general_portrait');
    row.add(portrait);

    // Name and info
    const name = this.add.text(x + 58, y + 6, `${gen.name || 'Unknown'} ★${gen.star}`, {
      fontSize: '13px', color: '#FFFFFF', fontFamily: 'Georgia, serif',
    });
    row.add(name);

    const stats = this.add.text(x + 58, y + 24,
      `Lv.${gen.level} | ⚔️${gen.attr_force} 🛡️${gen.attr_defense} 📜${gen.attr_strategy}`, {
        fontSize: '10px', color: '#B0BEC5',
      });
    row.add(stats);

    const faction = FACTIONS[gen.faction] || FACTIONS.europe;
    const factionText = this.add.text(x + 58, y + 38, faction.icon + ' ' + faction.name, {
      fontSize: '9px', color: faction.color,
    });
    row.add(factionText);

    return row;
  }

  _showGeneralDrawResult(general) {
    this._closePanel();

    const { width, height } = this.cameras.main;
    const panelW = 280;
    const panelH = 320;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);

    // Glow based on star rarity
    const starColors = { 1: 0x9E9E9E, 2: 0x4CAF50, 3: 0x2196F3, 4: 0x9C27B0, 5: 0xFFC107 };
    const glowColor = starColors[general.star] || 0xFFC107;
    bg.lineStyle(3, glowColor, 0.8);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 20, '✨ New General!', {
      fontSize: '18px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    // Large portrait
    const portrait = this.add.image(px + panelW / 2, py + 100, 'general_portrait').setScale(2.5);
    container.add(portrait);

    const name = this.add.text(px + panelW / 2, py + 165, general.name || 'Unknown', {
      fontSize: '20px', color: '#FFFFFF', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(name);

    const starStr = '★'.repeat(general.star) + '☆'.repeat(5 - general.star);
    const stars = this.add.text(px + panelW / 2, py + 190, starStr, {
      fontSize: '16px', color: '#FFC107',
    }).setOrigin(0.5);
    container.add(stars);

    const faction = FACTIONS[general.faction] || FACTIONS.europe;
    const info = this.add.text(px + panelW / 2, py + 215, `${faction.icon} ${general.title || ''}`, {
      fontSize: '12px', color: faction.color,
    }).setOrigin(0.5);
    container.add(info);

    const stats = this.add.text(px + panelW / 2, py + 240,
      `⚔️${general.attr_force}  📜${general.attr_strategy}  🛡️${general.attr_defense}`, {
        fontSize: '12px', color: '#B0BEC5',
      }).setOrigin(0.5);
    container.add(stats);

    const closeBtn = this._createUIButton(px + 30, py + panelH - 54, panelW - 60, 44, 'Excellent!', UI.PRIMARY, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _showArmyPanel() {
    this._closePanel();
    const { width, height } = this.cameras.main;
    const panelW = Math.min(340, width - 20);
    const panelH = Math.min(450, height - 100);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.DANGER, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 16, '⚔️ Army Management', {
      fontSize: '17px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    const armies = this._armies || [];
    let yOff = py + 45;

    for (const army of armies) {
      const row = this.add.container(0, 0);
      const rowBg = this.add.graphics();
      rowBg.fillStyle(UI.PANEL_LIGHT, 0.8);
      rowBg.fillRoundedRect(px + 10, yOff, panelW - 20, 60, 6);
      row.add(rowBg);

      const status = army.command === 'idle' ? '🟢' : '🔴';
      const totalSoldiers = (army.soldiers || [0, 0, 0]).reduce((s, v) => s + v, 0);

      const info = this.add.text(px + 20, yOff + 8,
        `${status} Army ${army.army_order} — ${army.command.toUpperCase()}`, {
          fontSize: '13px', color: '#FFFFFF',
        });
      row.add(info);

      const details = this.add.text(px + 20, yOff + 28,
        `Soldiers: ${totalSoldiers} | Generals: ${army.generals?.length || 0}`, {
          fontSize: '11px', color: '#B0BEC5',
        });
      row.add(details);

      // Conscript button for idle armies
      if (army.command === 'idle') {
        const conscriptBtn = this._createUIButton(px + panelW - 110, yOff + 36, 90, 22,
          '+ Recruit', UI.SUCCESS, () => {
            network.conscript(army.id, [100, 100, 100]);
            this._showToast('Recruiting soldiers...');
          });
        row.add(conscriptBtn);
      }

      container.add(row);
      yOff += 68;
    }

    if (armies.length === 0) {
      const empty = this.add.text(px + panelW / 2, py + 80, 'No armies yet.', {
        fontSize: '14px', color: '#B0BEC5',
      }).setOrigin(0.5);
      container.add(empty);
    }

    const closeBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44, 'Close', 0x616161, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _showAlliancePanel() {
    this._closePanel();
    const { width, height } = this.cameras.main;
    const panelW = Math.min(340, width - 20);
    const panelH = Math.min(450, height - 100);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.ACCENT, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 16, '🏰 Alliance', {
      fontSize: '17px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    if (this._alliance) {
      const info = this.add.text(px + 15, py + 45, `Name: ${this._alliance.name}`, {
        fontSize: '14px', color: '#FFFFFF',
      });
      container.add(info);

      const members = this.add.text(px + 15, py + 68, `Members: ${this._alliance.memberCount}/${this._alliance.memberCount}`, {
        fontSize: '12px', color: '#B0BEC5',
      });
      container.add(members);

      if (this._alliance.notice) {
        const notice = this.add.text(px + 15, py + 88, `Notice: ${this._alliance.notice}`, {
          fontSize: '11px', color: '#78909C', wordWrap: { width: panelW - 30 },
        });
        container.add(notice);
      }

      const exitBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44,
        'Leave Alliance', UI.DANGER, () => {
          network.exitAlliance();
          this._alliance = null;
          this._closePanel();
          this._showToast('Left alliance');
        });
      container.add(exitBtn);
    } else {
      // Create alliance
      const createBtn = this._createUIButton(px + 10, py + 50, panelW - 20, 44,
        '➕ Create Alliance', UI.PRIMARY, () => {
          const name = prompt('Alliance name:');
          if (name) {
            network.createAlliance(name);
            network.getMyAlliance();
            this._closePanel();
          }
        });
      container.add(createBtn);

      // List alliances
      const listTitle = this.add.text(px + 15, py + 110, 'Available Alliances:', {
        fontSize: '13px', color: '#B0BEC5',
      });
      container.add(listTitle);

      network.getAlliances();
      network.on('alliance:list', (data) => {
        let aOff = py + 132;
        for (const alliance of data.alliances.slice(0, 4)) {
          const row = this._createUIButton(px + 10, aOff, panelW - 20, 40,
            `${alliance.name} (${alliance.memberCount} members)`, UI.PANEL_LIGHT, () => {
              network.joinAlliance(alliance.id);
              network.getMyAlliance();
              this._closePanel();
              this._showToast(`Joined ${alliance.name}!`);
            });
          container.add(row);
          aOff += 48;
        }
      });
    }

    const closeBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44, 'Close', 0x616161, () => {
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
  }

  _showChatPanel() {
    this._closePanel();
    const { width, height } = this.cameras.main;
    const panelW = Math.min(340, width - 20);
    const panelH = Math.min(400, height - 100);
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const container = this.add.container(0, 0);
    container.setDepth(200);

    const bg = this.add.graphics();
    bg.fillStyle(UI.PANEL, 0.98);
    bg.fillRoundedRect(px, py, panelW, panelH, 12);
    bg.lineStyle(2, UI.ACCENT, 0.5);
    bg.strokeRoundedRect(px, py, panelW, panelH, 12);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 16, '💬 World Chat', {
      fontSize: '17px', color: '#FFC107', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);
    container.add(title);

    // Chat messages area
    this._chatPanelMessages = this.add.container(px + 10, py + 40);
    container.add(this._chatPanelMessages);

    // Input area (using HTML for mobile keyboard)
    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = 'Type a message...';
    chatInput.style.cssText = `
      position: absolute; left: ${px + 10}px; top: ${py + panelH - 100}px;
      width: ${panelW - 90}px; height: 36px;
      background: #2A2A3E; color: #FFF; border: 1px solid #FFC107;
      border-radius: 6px; padding: 0 10px; font-size: 14px;
      outline: none; z-index: 200;
    `;
    document.getElementById('game-container').appendChild(chatInput);

    const sendBtn = this._createUIButton(px + panelW - 70, py + panelH - 100, 60, 36, 'Send', UI.PRIMARY, () => {
      const msg = chatInput.value.trim();
      if (msg) {
        network.sendChat('world', msg);
        chatInput.value = '';
      }
    });
    container.add(sendBtn);

    const closeBtn = this._createUIButton(px + 10, py + panelH - 54, panelW - 20, 44, 'Close', 0x616161, () => {
      chatInput.remove();
      this._closePanel();
    });
    container.add(closeBtn);

    this._activePanel = container;
    this._chatInput = chatInput;
  }

  _addChatMessage(msg) {
    // Floating chat
    const text = this.add.text(0, 0, `${msg.senderName}: ${msg.message}`, {
      fontSize: '10px', color: '#FFFFFF',
      backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    });
    this._chatMessages.push({ text, time: Date.now() });

    if (this._chatMessages.length > 5) {
      const old = this._chatMessages.shift();
      old.text.destroy();
    }

    this._updateChatPositions();

    // If chat panel is open, add there too
    if (this._chatPanelMessages) {
      let yOff = this._chatPanelMessages.length * 18;
      if (yOff > 200) {
        const first = this._chatPanelMessages.first;
        if (first) first.destroy();
        yOff = Math.max(0, yOff - 18);
      }
      const panelMsg = this.add.text(0, yOff, `${msg.senderName}: ${msg.message}`, {
        fontSize: '11px', color: '#FFFFFF', wordWrap: { width: 280 },
      });
      this._chatPanelMessages.add(panelMsg);
    }
  }

  _updateChatPositions() {
    const { height } = this.cameras.main;
    for (let i = 0; i < this._chatMessages.length; i++) {
      const msg = this._chatMessages[i];
      msg.text.setPosition(10, height - 330 - (this._chatMessages.length - 1 - i) * 16);
      msg.text.setScrollFactor(0);
      msg.text.setDepth(90);
    }
  }

  // === Utility Methods ===

  _createUIButton(x, y, w, h, text, color, callback) {
    const container = this.add.container(0, 0);

    const bg = this.add.graphics();
    bg.fillStyle(color);
    bg.fillRoundedRect(x, y, w, h, 6);

    const hitArea = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(color);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0xFFFFFF, 0.3);
      bg.strokeRoundedRect(x, y, w, h, 6);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color);
      bg.fillRoundedRect(x, y, w, h, 6);
    });

    hitArea.on('pointerdown', callback);

    const label = this.add.text(x + w / 2, y + h / 2, text, {
      fontSize: '13px', color: '#FFFFFF', fontFamily: 'Arial',
    }).setOrigin(0.5);

    container.add([bg, hitArea, label]);
    return container;
  }

  _closePanel() {
    if (this._activePanel) {
      this._activePanel.destroy(true);
      this._activePanel = null;
    }
    if (this._chatInput) {
      this._chatInput.remove();
      this._chatInput = null;
    }
    if (this._chatPanelMessages) {
      this._chatPanelMessages = null;
    }
  }

  _showToast(message, isError = false) {
    const { width, height } = this.cameras.main;

    const toast = this.add.text(width / 2, height / 2, message, {
      fontSize: '14px',
      color: '#FFFFFF',
      fontFamily: 'Arial',
      backgroundColor: isError ? '#D32F2FDD' : '#1A237EDD',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: height / 2 - 50,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => toast.destroy(),
    });
  }

  _showLoading() {
    const { width, height } = this.cameras.main;
    this._loadingText = this.add.text(width / 2, height / 2, 'Connecting to server...', {
      fontSize: '16px', color: '#FFC107',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300);
  }

  _hideLoading() {
    if (this._loadingText) {
      this._loadingText.destroy();
      this._loadingText = null;
    }
  }

  _formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
  }

  _onResize(gameSize) {
    // Reposition UI elements on resize
    this.cameras.main.setSize(gameSize.width, gameSize.height);
  }

  update(time, delta) {
    // Fade out old chat messages
    const now = Date.now();
    for (let i = this._chatMessages.length - 1; i >= 0; i--) {
      const msg = this._chatMessages[i];
      if (now - msg.time > 10000) {
        msg.text.destroy();
        this._chatMessages.splice(i, 1);
      }
    }
  }
}
