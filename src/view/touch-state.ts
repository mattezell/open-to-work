import { NO_INPUT, type InputFrame } from '../sim/input';

/** Stick travel, in CSS pixels, under which the thumb counts as centred. */
export const STICK_DEADZONE = 12;
/** How far the drawn knob may travel from the stick origin. */
export const STICK_RADIUS = 44;

export type ButtonAction = 'attack' | 'jump' | 'special';
type Direction = Pick<InputFrame, 'left' | 'right' | 'up' | 'down'>;

const CENTRED: Direction = { left: false, right: false, up: false, down: false };

/**
 * Quantise a stick offset to one of 8 directions. Belt movement is digital,
 * so an analog stick is snapped to 45 degree sectors: a slightly-off-axis
 * push still walks straight, and diagonals need a deliberate diagonal.
 * Screen coordinates: +y is down.
 */
export function stickDirection(dx: number, dy: number, deadzone = STICK_DEADZONE): Direction {
  if (Math.hypot(dx, dy) < deadzone) return CENTRED;
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  // Sector 0 is right, then clockwise on screen: 2 is down, 4 left, 6 up.
  return {
    right: sector === 7 || sector === 0 || sector === 1,
    down: sector >= 1 && sector <= 3,
    left: sector >= 3 && sector <= 5,
    up: sector >= 5 && sector <= 7,
  };
}

interface StickTouch {
  pointerId: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

/**
 * Multi-touch state for one virtual pad: a floating stick plus three buttons,
 * each tracked by pointer id so move-and-attack with two thumbs works. Button
 * presses are latched until the next snapshot so a tap shorter than one sim
 * tick still registers, matching the keyboard.
 */
export class TouchState {
  private stick: StickTouch | null = null;
  private readonly buttons = new Map<number, ButtonAction>();
  private readonly tapped = new Set<ButtonAction>();

  stickStart(pointerId: number, x: number, y: number): void {
    this.stick = { pointerId, originX: x, originY: y, x, y };
  }

  stickMove(pointerId: number, x: number, y: number): void {
    if (this.stick?.pointerId !== pointerId) return;
    this.stick.x = x;
    this.stick.y = y;
  }

  buttonDown(pointerId: number, action: ButtonAction): void {
    this.buttons.set(pointerId, action);
    this.tapped.add(action);
  }

  /** Ends whatever that pointer was doing: stick or button. */
  release(pointerId: number): void {
    if (this.stick?.pointerId === pointerId) this.stick = null;
    this.buttons.delete(pointerId);
  }

  releaseAll(): void {
    this.stick = null;
    this.buttons.clear();
    this.tapped.clear();
  }

  /** Where to draw the stick: origin and knob offset clamped to STICK_RADIUS, or null. */
  stickVisual(): { x: number; y: number; knobX: number; knobY: number } | null {
    if (!this.stick) return null;
    const dx = this.stick.x - this.stick.originX;
    const dy = this.stick.y - this.stick.originY;
    const scale = Math.min(1, STICK_RADIUS / (Math.hypot(dx, dy) || 1));
    return { x: this.stick.originX, y: this.stick.originY, knobX: dx * scale, knobY: dy * scale };
  }

  isPressed(action: ButtonAction): boolean {
    for (const held of this.buttons.values()) if (held === action) return true;
    return false;
  }

  snapshot(): InputFrame {
    const direction = this.stick
      ? stickDirection(this.stick.x - this.stick.originX, this.stick.y - this.stick.originY)
      : CENTRED;
    const button = (action: ButtonAction): boolean =>
      this.isPressed(action) || this.tapped.has(action);
    const frame: InputFrame = {
      ...NO_INPUT,
      ...direction,
      attack: button('attack'),
      jump: button('jump'),
      special: button('special'),
    };
    this.tapped.clear();
    return frame;
  }
}
