import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from '../sim/constants';
import type { InputFrame } from '../sim/input';
import { KEY_BINDINGS, mergeInputs, type HeldKeys } from './controls';
import { sharedAudio } from './audio';
import { sharedDevices } from './devices';
import {
  builtInDays,
  creditLine,
  CV_LIVE,
  cycle,
  hireOptions,
  optionHint,
  optionText,
  type HireOption,
} from './hire';
import { INK, MAX_TICKS_PER_FRAME, RESTART_DELAY_TICKS, TICK_MS } from './hud';
import { CELL_H, CELL_W, TITLE_SCALE } from './pixel-font';
import { HEAD_COLOR, pixelFont, pixelText } from './pixel-text';
import type { TouchPad } from './touch';

/** The ending card holds a beat before the words come up over it. */
const TEXT_DELAY_MS = 1200;
const FADE_MS = 800;
const CAPTION_H = 82;
const CAPTION_TOP = SCREEN_H - CAPTION_H;
const DIM_COLOR = '#b0b0a0';
/** Keys that pick the chosen option: Enter plus the three action buttons. */
const PICK_CODES: readonly string[] = [
  'Enter',
  ...KEY_BINDINGS.attack,
  ...KEY_BINDINGS.jump,
  ...KEY_BINDINGS.special,
];

function centred(text: Phaser.GameObjects.BitmapText): Phaser.GameObjects.BitmapText {
  return text.setX(Math.round((SCREEN_W - text.width) / 2));
}

/** How long the game took to build, if the build was run with its commit dates. */
function buildDays(): number | null {
  const { VITE_FIRST_COMMIT: first, VITE_LAST_COMMIT: last } = import.meta.env;
  return first && last ? builtInDays(first, last) : null;
}

/**
 * Open a link in a new tab from inside the key or tap that asked for it, so
 * popup blockers let it through. The new tab gets no handle back to the game.
 * If the browser blocks it anyway, go there in this tab rather than do nothing.
 */
function openInNewTab(url: string): void {
  const tab = window.open(url, '_blank');
  if (tab) tab.opener = null;
  else window.location.assign(url);
}

/**
 * The end of the run: Matt and TOKEN on the roof of the tower with the
 * offer letter, the final score and the credit, then the real Matt's CV and
 * contact page, or another go.
 */
export class EndingScene extends Phaser.Scene {
  private score = 0;
  private keys!: HeldKeys;
  private touch!: TouchPad;
  private accumulator = 0;
  private ticks = 0;
  private options: HireOption[] = [];
  private selected = 0;
  private slots: Phaser.GameObjects.BitmapText[] = [];
  private hint!: Phaser.GameObjects.BitmapText;
  private lastFrame: InputFrame | null = null;

  constructor() {
    super('ending');
  }

  init(data: { score?: number }): void {
    this.score = data.score ?? 0;
    this.ticks = 0;
    this.accumulator = 0;
    this.selected = 0;
    this.lastFrame = null;
  }

  preload(): void {
    this.load.image('ending-hired', 'sprites/ending/hired.png');
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    this.touch.setOrderLabel('TOKEN: HIRED');
    this.cameras.main.fadeIn(FADE_MS);
    sharedAudio().play('ending');
    this.add.image(SCREEN_W / 2, 0, 'ending-hired').setOrigin(0.5, 0);
    this.options = hireOptions(CV_LIVE);
    const caption = this.add.rectangle(0, CAPTION_TOP, SCREEN_W, CAPTION_H, INK, 0.8).setOrigin(0);
    const title = centred(
      pixelText(this, 0, CAPTION_TOP + 3, 'HIRED', HEAD_COLOR).setScale(TITLE_SCALE),
    );
    const score = centred(
      pixelText(this, 0, CAPTION_TOP + 23, `FINAL SCORE  ${String(this.score).padStart(6, '0')}`),
    );
    const credit = centred(
      pixelText(this, 0, CAPTION_TOP + 33, creditLine(buildDays()), DIM_COLOR),
    );
    const cta = centred(pixelText(this, 0, CAPTION_TOP + 47, 'Hire the real Matt', HEAD_COLOR));
    this.slots = this.layoutMenu(CAPTION_TOP + 57);
    this.hint = pixelText(this, 0, CAPTION_TOP + 70, '', DIM_COLOR);
    const parts = [caption, title, score, credit, cta, ...this.slots, this.hint];
    for (const part of parts) part.setAlpha(0);
    this.tweens.add({ targets: parts, alpha: 1, delay: TEXT_DELAY_MS, duration: FADE_MS });
    this.select(0);
    this.listen();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.ticks++;
      this.step();
    }
  }

  /**
   * The stick and the keys move the cursor; the touch pad's buttons pick.
   * Keyboard picks arrive through `listen` instead, inside the key event.
   */
  private step(): void {
    const keys = this.keys.snapshot();
    const pad = this.touch.snapshot();
    const frame = mergeInputs(keys, pad);
    const was = this.lastFrame;
    this.lastFrame = frame;
    if (!this.ready() || !was) return;
    if (frame.left && !was.left) this.select(cycle(this.selected, -1, this.options.length));
    if (frame.right && !was.right) this.select(cycle(this.selected, 1, this.options.length));
    if (pad.attack || pad.jump || pad.special) this.pick(this.selected);
  }

  /** One pixel text per option, side by side and centred as a row. */
  private layoutMenu(y: number): Phaser.GameObjects.BitmapText[] {
    const texts = this.options.map((option) => optionText(option.label, false));
    const rowWidth = (texts.join(' ').length - 1) * CELL_W;
    let x = Math.round((SCREEN_W - rowWidth) / 2);
    return texts.map((text) => {
      const slot = pixelText(this, x, y, text);
      x += (text.length + 1) * CELL_W;
      return slot;
    });
  }

  private select(index: number): void {
    this.selected = index;
    this.slots.forEach((slot, i) => {
      const option = this.options[i];
      if (!option) return;
      slot.setFont(pixelFont(this, i === index ? HEAD_COLOR : undefined));
      slot.setText(optionText(option.label, i === index));
    });
    const option = this.options[index];
    if (option) centred(this.hint.setText(optionHint(option.action)));
  }

  /**
   * Keys and taps are read straight from the window so a link opens inside
   * the event that asked for it (Phaser queues its own until the next step,
   * and popup blockers only trust the event itself).
   */
  private listen(): void {
    const openedAt = performance.now();
    const onKey = (e: KeyboardEvent): void => {
      if (!e.repeat && this.ready() && PICK_CODES.includes(e.code)) this.pick(this.selected);
    };
    const onTap = (e: PointerEvent): void => {
      if (e.timeStamp < openedAt || !this.ready()) return;
      const x = this.scale.transformX(e.pageX);
      const y = this.scale.transformY(e.pageY);
      const hit = this.slots.findIndex(
        (slot) =>
          x >= slot.x && x < slot.x + slot.width && Math.abs(y - slot.y - CELL_H / 2) < CELL_H,
      );
      if (hit >= 0) {
        this.select(hit);
        this.pick(hit);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onTap);
    });
  }

  /** Ignore the buttons still held from the final blow until the card has been seen. */
  private ready(): boolean {
    return this.ticks > RESTART_DELAY_TICKS + (TEXT_DELAY_MS + FADE_MS) / TICK_MS;
  }

  private pick(index: number): void {
    const action = this.options[index]?.action;
    if (!action) return;
    if (action.kind === 'link') openInNewTab(action.url);
    else this.scene.start('game', { stage: 'street' });
  }
}
