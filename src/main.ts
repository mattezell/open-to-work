import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from './sim/constants';
import { GameScene } from './view/game-scene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  backgroundColor: '#101010',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});

// Dev server only: lets headless playtests read the sim instead of squinting at pixels.
if (import.meta.env.DEV) Object.assign(window, { __otwGame: game });
