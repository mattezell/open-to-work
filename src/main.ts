import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from './sim/constants';
import { GameScene } from './view/game-scene';

new Phaser.Game({
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
