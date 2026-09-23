/** One tick of one player's controls. Input is data: the sim never reads devices. */
export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
  jump: boolean;
  special: boolean;
}

export const NO_INPUT: Readonly<InputFrame> = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  attack: false,
  jump: false,
  special: false,
});

export function input(partial: Partial<InputFrame>): InputFrame {
  return { ...NO_INPUT, ...partial };
}
