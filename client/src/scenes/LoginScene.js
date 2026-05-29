/**
 * Login Scene - Registration and login UI
 */

import Phaser from 'phaser';
import { api } from '../network/api.js';
import { UI } from '../config/theme.js';

export class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoginScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(UI.DARK);
    bg.fillRect(0, 0, width, height);

    // Decorative elements
    bg.fillStyle(UI.PRIMARY, 0.3);
    bg.fillRect(0, 0, width, height * 0.35);

    // Title
    this.add.text(width / 2, 60, '⚔️ Age of Conquest', {
      fontSize: '32px',
      fontFamily: 'Georgia, serif',
      color: '#FFC107',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(width / 2, 100, 'The Age of Discovery · 1300-1700', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      color: '#B0BEC5',
    }).setOrigin(0.5);

    // Login panel
    const panelX = width / 2 - 150;
    const panelY = 140;

    const panel = this.add.graphics();
    panel.fillStyle(UI.PANEL, 0.95);
    panel.fillRoundedRect(panelX, panelY, 300, 320, 12);
    panel.lineStyle(1, UI.ACCENT, 0.4);
    panel.strokeRoundedRect(panelX, panelY, 300, 320, 12);

    // Username field
    this.add.text(panelX + 20, panelY + 20, 'Commander Name', {
      fontSize: '13px', color: '#B0BEC5', fontFamily: 'Arial',
    });

    const usernameInput = this._createInputField(panelX + 20, panelY + 42, 260, 40);

    // Password field
    this.add.text(panelX + 20, panelY + 96, 'Password', {
      fontSize: '13px', color: '#B0BEC5', fontFamily: 'Arial',
    });

    const passwordInput = this._createInputField(panelX + 20, panelY + 118, 260, 40, true);

    // Error text
    const errorText = this.add.text(width / 2, panelY + 175, '', {
      fontSize: '13px', color: '#F44336', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Login button
    const loginBtn = this._createButton(panelX + 20, panelY + 200, 260, 44, 'Login', UI.PRIMARY, async () => {
      const username = usernameInput.value;
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.setText('Please enter both fields');
        return;
      }

      try {
        loginBtn.label.setText('Connecting...');
        const result = await api.login(username, password);
        if (result.success) {
          this._startGame(result.token, result.role);
        }
      } catch (e) {
        errorText.setText(e.message);
        loginBtn.label.setText('Login');
      }
    });

    // Register button
    const regBtn = this._createButton(panelX + 20, panelY + 260, 260, 44, 'Create Account', UI.SECONDARY, async () => {
      const username = usernameInput.value;
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.setText('Please enter both fields');
        return;
      }

      try {
        regBtn.label.setText('Creating...');
        await api.register(username, password);
        // Auto-login after register
        const result = await api.login(username, password);
        if (result.success) {
          this._startGame(result.token, result.role);
        }
      } catch (e) {
        errorText.setText(e.message);
        regBtn.label.setText('Create Account');
      }
    });

    // Faction selector
    this.add.text(width / 2, panelY + 290, '🏰 Choose your civilization after login', {
      fontSize: '11px', color: '#78909C',
    }).setOrigin(0.5);
  }

  _createInputField(x, y, w, h, isPassword = false) {
    // Create hidden HTML input for mobile keyboard support
    const input = document.createElement('input');
    input.type = isPassword ? 'password' : 'text';
    input.placeholder = isPassword ? 'Enter password' : 'Enter commander name';
    input.style.cssText = `
      position: absolute; left: ${x}px; top: ${y}px;
      width: ${w}px; height: ${h}px;
      background: #2A2A3E; color: #FFF; border: 1px solid #FFC107;
      border-radius: 6px; padding: 0 12px; font-size: 16px;
      outline: none; z-index: 100;
    `;
    document.getElementById('game-container').appendChild(input);

    // Store reference for cleanup
    if (!this._inputs) this._inputs = [];
    this._inputs.push(input);

    return input;
  }

  _createButton(x, y, w, h, text, color, callback) {
    const btn = this.add.graphics();
    btn.fillStyle(color);
    btn.fillRoundedRect(x, y, w, h, 8);

    const label = this.add.text(x + w / 2, y + h / 2, text, {
      fontSize: '16px', color: '#FFFFFF', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(Phaser.Display.Color.IntegerToColor(color).brighten(20).color);
      btn.fillRoundedRect(x, y, w, h, 8);
    });

    hitArea.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(color);
      btn.fillRoundedRect(x, y, w, h, 8);
    });

    hitArea.on('pointerdown', callback);

    return { btn, label, hitArea };
  }

  _startGame(token, role) {
    // Clean up input fields
    this._inputs?.forEach(el => el.remove());

    // Pass data to game scene
    this.registry.set('token', token);
    this.registry.set('role', role);

    this.scene.start('GameScene');
  }
}
