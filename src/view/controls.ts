import type { InputFrame } from '../sim/input';

/**
 * KeyboardEvent.code values per action. Arrows or WASD to move; J/K/L or Z/X/C
 * to act; Q or Tab to give TOKEN its next order.
 */
export const KEY_BINDINGS: Readonly<Record<keyof InputFrame, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  attack: ['KeyJ', 'KeyZ'],
  jump: ['KeyK', 'KeyX', 'Space'],
  special: ['KeyL', 'KeyC'],
  order: ['KeyQ', 'Tab'],
};

/** Keys the scenes handle themselves: pause, and help (? is Shift and Slash). */
export const PAUSE_CODES: readonly string[] = ['Escape', 'KeyP'];
export const HELP_CODES: readonly string[] = ['KeyH', 'Slash'];

/** Snapshot held keys into the sim's input data. Opposite directions cancel. */
export function keysToInput(held: ReadonlySet<string>): InputFrame {
  const pressed = (action: keyof InputFrame): boolean =>
    KEY_BINDINGS[action].some((code) => held.has(code));
  return mergeInputs({
    left: pressed('left'),
    right: pressed('right'),
    up: pressed('up'),
    down: pressed('down'),
    attack: pressed('attack'),
    jump: pressed('jump'),
    special: pressed('special'),
    order: pressed('order'),
  });
}

/** Combine several devices driving one player: any source pressing counts, opposites cancel. */
export function mergeInputs(...frames: readonly InputFrame[]): InputFrame {
  const any = (action: keyof InputFrame): boolean => frames.some((frame) => frame[action]);
  const left = any('left');
  const right = any('right');
  const up = any('up');
  const down = any('down');
  return {
    left: left && !right,
    right: right && !left,
    up: up && !down,
    down: down && !up,
    attack: any('attack'),
    jump: any('jump'),
    special: any('special'),
    order: any('order'),
  };
}

/**
 * Tracks held keys by KeyboardEvent.code, and forgets them all when the window loses focus.
 * A key pressed and released between two snapshots still counts as held for one
 * snapshot, so a quick tap is never lost between sim ticks.
 */
export class HeldKeys {
  private readonly held = new Set<string>();
  private readonly tapped = new Set<string>();

  constructor(target: Pick<Window, 'addEventListener'>) {
    target.addEventListener('keydown', (e) => {
      if (isBound(e.code)) e.preventDefault();
      this.held.add(e.code);
      this.tapped.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => {
      this.held.clear();
      this.tapped.clear();
    });
  }

  snapshot(): InputFrame {
    const frame = keysToInput(new Set([...this.held, ...this.tapped]));
    this.tapped.clear();
    return frame;
  }
}

// Slash opens Firefox's quick find, so the menu keys are claimed from the browser too.
const BOUND_CODES = new Set([...Object.values(KEY_BINDINGS).flat(), ...PAUSE_CODES, ...HELP_CODES]);

function isBound(code: string): boolean {
  return BOUND_CODES.has(code);
}
