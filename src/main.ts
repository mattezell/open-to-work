import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from './sim/constants';
import { GameScene } from './view/game-scene';
import { TunnelScene } from './view/tunnel-scene';

/** `?stage=2` boots straight into the tunnel, for playtesting it without clearing the street. */
const startInTunnel = new URLSearchParams(window.location.search).get('stage') === '2';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  backgroundColor: '#101010',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: startInTunnel ? [TunnelScene, GameScene] : [GameScene, TunnelScene],
});

// Dev server only: lets headless playtests read the sim instead of squinting at pixels.
if (import.meta.env.DEV) Object.assign(window, { __otwGame: game });
