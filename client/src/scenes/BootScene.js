/**
 * Boot Scene - Loading screen and asset generation
 */

import Phaser from 'phaser';
import { TILE_COLORS, TILE, UI } from '../config/theme.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading bar
    const { width, height } = this.cameras.main;
    const barW = width * 0.6;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(UI.DARK);
    bg.fillRect(0, 0, width, height);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(UI.SECONDARY, 0.8);
    progressBox.fillRect(barX, barY, barW, barH);

    const title = this.add.text(width / 2, barY - 60, '⚔️ Age of Conquest', {
      fontSize: '28px',
      fontFamily: 'Georgia, serif',
      color: '#FFC107',
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, barY - 30, '1300-1700 · The Age of Discovery', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      color: '#B0BEC5',
    }).setOrigin(0.5);

    const loadingText = this.add.text(width / 2, barY + 40, 'Loading...', {
      fontSize: '14px',
      color: '#FFFFFF',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(UI.ACCENT, 1);
      progressBar.fillRect(barX + 2, barY + 2, (barW - 4) * value, barH - 4);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder textures
    this._generateTextures();
  }

  _generateTextures() {
    // Generate tile textures
    for (const [type, colors] of Object.entries(TILE_COLORS)) {
      const key = `tile_${type}`;
      const g = this.make.graphics({ add: false });

      g.fillStyle(colors.base);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(colors.border);
      g.fillRect(0, 0, 64, 2);
      g.fillRect(0, 0, 2, 64);
      g.fillRect(62, 0, 2, 64);
      g.fillRect(0, 62, 64, 2);

      // Add texture detail based on type
      const tileType = parseInt(type);
      if (tileType === TILE.FOREST) {
        g.fillStyle(0x1B5E20);
        g.fillCircle(16, 16, 8);
        g.fillCircle(48, 32, 10);
        g.fillCircle(32, 48, 7);
      } else if (tileType === TILE.MOUNTAIN) {
        g.fillStyle(0x4E342E);
        g.fillTriangle(32, 8, 8, 56, 56, 56);
        g.fillStyle(0xECEFF1);
        g.fillTriangle(32, 8, 24, 24, 40, 24);
      } else if (tileType === TILE.FARM) {
        g.fillStyle(0xF9A825);
        for (let i = 0; i < 5; i++) {
          g.fillRect(8 + i * 12, 20, 4, 30);
        }
      } else if (tileType === TILE.GOLD_MINE) {
        g.fillStyle(0xFFD54F);
        g.fillCircle(32, 32, 12);
        g.fillStyle(0xE65100);
        g.fillCircle(32, 32, 6);
      } else if (tileType === TILE.WATER) {
        g.fillStyle(0x1976D0);
        for (let i = 0; i < 3; i++) {
          g.fillRect(4, 16 + i * 18, 56, 4);
        }
      } else if (tileType === TILE.CITY) {
        g.fillStyle(0xAB47BC);
        g.fillRect(16, 20, 32, 36);
        g.fillStyle(0xCE93D8);
        g.fillTriangle(32, 4, 12, 24, 52, 24);
        g.fillStyle(0xFFC107);
        g.fillRect(28, 36, 8, 20);
      } else if (tileType === TILE.FORTRESS) {
        g.fillStyle(0xEF5350);
        g.fillRect(12, 24, 40, 32);
        g.fillStyle(0xC62828);
        g.fillRect(8, 20, 12, 36);
        g.fillRect(44, 20, 12, 36);
      }

      g.generateTexture(key, 64, 64);
      g.destroy();
    }

    // Generate UI button texture
    const btnG = this.make.graphics({ add: false });
    btnG.fillStyle(UI.PRIMARY);
    btnG.fillRoundedRect(0, 0, 160, 48, 8);
    btnG.lineStyle(2, UI.ACCENT);
    btnG.strokeRoundedRect(0, 0, 160, 48, 8);
    btnG.generateTexture('btn_primary', 160, 48);
    btnG.destroy();

    const btnDng = this.make.graphics({ add: false });
    btnDng.fillStyle(UI.DANGER);
    btnDng.fillRoundedRect(0, 0, 160, 48, 8);
    btnDng.generateTexture('btn_danger', 160, 48);
    btnDng.destroy();

    // Generate panel background
    const panelG = this.make.graphics({ add: false });
    panelG.fillStyle(UI.PANEL, 0.95);
    panelG.fillRoundedRect(0, 0, 320, 480, 12);
    panelG.lineStyle(2, UI.ACCENT, 0.5);
    panelG.strokeRoundedRect(0, 0, 320, 480, 12);
    panelG.generateTexture('panel', 320, 480);
    panelG.destroy();

    // Generate small panel
    const smallPanelG = this.make.graphics({ add: false });
    smallPanelG.fillStyle(UI.PANEL, 0.9);
    smallPanelG.fillRoundedRect(0, 0, 280, 200, 8);
    smallPanelG.lineStyle(1, UI.ACCENT, 0.3);
    smallPanelG.strokeRoundedRect(0, 0, 280, 200, 8);
    smallPanelG.generateTexture('panel_small', 280, 200);
    smallPanelG.destroy();

    // General portrait placeholder
    const genG = this.make.graphics({ add: false });
    genG.fillStyle(0x37474F);
    genG.fillRoundedRect(0, 0, 48, 48, 4);
    genG.fillStyle(0xFFC107);
    genG.fillCircle(24, 18, 10);
    genG.fillStyle(0x455A64);
    genG.fillRect(14, 28, 20, 20);
    genG.generateTexture('general_portrait', 48, 48);
    genG.destroy();

    // Army icon placeholder
    const armyG = this.make.graphics({ add: false });
    armyG.fillStyle(0xF44336);
    armyG.fillCircle(16, 16, 14);
    armyG.fillStyle(0xFFFFFF);
    armyG.fillRect(12, 8, 8, 16);
    armyG.fillRect(8, 12, 16, 8);
    armyG.generateTexture('army_icon', 32, 32);
    armyG.destroy();

    // Selection highlight
    const selG = this.make.graphics({ add: false });
    selG.lineStyle(3, 0xFFC107, 1);
    selG.strokeRect(0, 0, 64, 64);
    selG.generateTexture('selection', 64, 64);
    selG.destroy();

    // Resource icons (small colored circles)
    const resIcons = { gold: 0xFFD700, food: 0x4CAF50, wood: 0x795548, iron: 0x607D8B, stone: 0x9E9E9E };
    for (const [res, color] of Object.entries(resIcons)) {
      const rg = this.make.graphics({ add: false });
      rg.fillStyle(color);
      rg.fillCircle(12, 12, 10);
      rg.generateTexture(`res_${res}`, 24, 24);
      rg.destroy();
    }
  }

  create() {
    this.scene.start('LoginScene');
  }
}
