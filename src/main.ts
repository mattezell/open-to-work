import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from './sim/constants';
import { EndingScene } from './view/ending-scene';
import { GameScene } from './view/game-scene';
import { PauseScene } from './view/pause-scene';
import { TitleScene } from './view/title-scene';
import { TunnelScene } from './view/tunnel-scene';

/**
 * The game opens on the title screen. `?stage=1` boots straight into the
 * street, `?stage=2` into the tunnel and `?stage=3` into the tower, for
 * playtesting a stage without clearing the ones before it.
 */
const bootStage = new URLSearchParams(window.location.search).get('stage');
const SCENES = [TitleScene, GameScene, TunnelScene, EndingScene, PauseScene];
/** Phaser starts the first scene in the list. */
const firstScene =
  bootStage === '2' ? TunnelScene : bootStage === '1' || bootStage === '3' ? GameScene : TitleScene;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  backgroundColor: '#101010',
  pixelArt: true,
  roundPixels: true,
  // #game centres the canvas with flexbox, inside the safe-area padding. Phaser's own
  // centring added a margin on top of that and pushed the game right of centre.
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [firstScene, ...SCENES.filter((scene) => scene !== firstScene)],
});
// Before boot, starting a scene queues its autostart with this data.
if (bootStage === '3') {
  game.scene.start('game', { carry: { hp: 60, score: 0, directive: 'wild' }, stage: 'tower' });
}

// Dev server only: lets headless playtests read the sim instead of squinting at pixels.
if (import.meta.env.DEV) Object.assign(window, { __otwGame: game });
