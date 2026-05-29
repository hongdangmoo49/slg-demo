/**
 * Age of Conquest - SLG Game Client
 * Main entry point - Phaser 3 configuration
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { LoginScene } from './scenes/LoginScene.js';
import { GameScene } from './scenes/GameScene.js';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#121212',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, LoginScene, GameScene],
  render: {
    antialias: false,
    pixelArt: false,
    roundPixels: true,
  },
  input: {
    touch: {
      capture: true,
    },
  },
  fps: {
    target: isMobile ? 30 : 60,
    forceSetTimeOut: isMobile,
  },
};

const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// Prevent default touch behaviors for mobile
document.addEventListener('touchmove', (e) => {
  if (e.target.closest('#game-container')) {
    e.preventDefault();
  }
}, { passive: false });
