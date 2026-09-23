import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from './sim/constants';
import { EndingScene } from './view/ending-scene';
import { GameScene } from './view/game-scene';
import { TunnelScene } from './view/tunnel-scene';

/**
 * `?stage=2` boots straight into the tunnel and `?stage=3` into the tower,
 * for playtesting a stage without clearing the ones before it.
 */
const bootStage = new URLSearchParams(window.location.search).get('stage');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  backgroundColor: '#101010',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene:
    bootStage === '2'
      ? [TunnelScene, GameScene, EndingScene]
      : [GameScene, TunnelScene, EndingScene],
});
// Before boot, starting a scene queues its autostart with this data.
if (bootStage === '3') {
  game.scene.start('game', { carry: { hp: 60, score: 0, directive: 'wild' }, stage: 'tower' });
}

// Dev server only: lets headless playtests read the sim instead of squinting at pixels.
if (import.meta.env.DEV) Object.assign(window, { __otwGame: game });
