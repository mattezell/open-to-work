import type Phaser from 'phaser';
import { HeldKeys } from './controls';
import { TouchPad } from './touch';

export interface Devices {
  keys: HeldKeys;
  touch: TouchPad;
}

let shared: Devices | undefined;

/**
 * The keyboard and touch pad, built once for the whole game. Both attach
 * window listeners and the pad mounts DOM, so a scene that built its own
 * would stack another copy every time the player moved between stages.
 */
export function sharedDevices(game: Phaser.Game): Devices {
  shared ??= {
    keys: new HeldKeys(window),
    touch: new TouchPad(document.body, () => game.scale.refresh()),
  };
  return shared;
}
