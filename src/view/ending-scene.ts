import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from '../sim/constants';
import type { InputFrame } from '../sim/input';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedAudio } from './audio';
import { sharedDevices } from './devices';
import { builtInDays, creditLine, CV_LIVE, hireOptions, optionHint } from './hire';
import { INK, MAX_TICKS_PER_FRAME, RESTART_DELAY_TICKS, TICK_MS } from './hud';
import { listenForPicks, MenuRow, openInNewTab, PICK_CODES } from './menu-row';
import { TITLE_SCALE } from './pixel-font';
import { HEAD_COLOR, pixelText } from './pixel-text';
import type { TouchPad } from './touch';

/** The ending card holds a beat before the words come up over it. */
const TEXT_DELAY_MS = 1200;
const FADE_MS = 800;
const CAPTION_H = 82;
const CAPTION_TOP = SCREEN_H - CAPTION_H;
const DIM_COLOR = '#b0b0a0';

function centred(text: Phaser.GameObjects.BitmapText): Phaser.GameObjects.BitmapText {
  return text.setX(Math.round((SCREEN_W - text.width) / 2));
}

/** How long the game took to build, if the build was run with its commit dates. */
function buildDays(): number | null {
  const { VITE_FIRST_COMMIT: first, VITE_LAST_COMMIT: last } = import.meta.env;
  return first && last ? builtInDays(first, last) : null;
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
  private menu!: MenuRow;
  private hint!: Phaser.GameObjects.BitmapText;
  private lastFrame: InputFrame | null = null;

  constructor() {
    super('ending');
  }

  init(data: { score?: number }): void {
    this.score = data.score ?? 0;
    this.ticks = 0;
    this.accumulator = 0;
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
    this.menu = new MenuRow(this, hireOptions(CV_LIVE), CAPTION_TOP + 57);
    this.hint = pixelText(this, 0, CAPTION_TOP + 70, '', DIM_COLOR);
    const parts = [caption, title, score, credit, cta, ...this.menu.slots, this.hint];
    for (const part of parts) part.setAlpha(0);
    this.tweens.add({ targets: parts, alpha: 1, delay: TEXT_DELAY_MS, duration: FADE_MS });
    this.showHint();
    listenForPicks(
      this,
      (e) => {
        if (!e.repeat && this.ready() && PICK_CODES.includes(e.code)) this.pick();
      },
      (x, y) => {
        const hit = this.menu.slotAt(x, y);
        if (hit < 0 || !this.ready()) return;
        this.menu.select(hit);
        this.pick();
      },
    );
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
   * Keyboard picks and taps arrive through `listenForPicks` instead, inside the event.
   */
  private step(): void {
    const keys = this.keys.snapshot();
    const pad = this.touch.snapshot();
    const frame = mergeInputs(keys, pad);
    const was = this.lastFrame;
    this.lastFrame = frame;
    if (!this.ready() || !was) return;
    if (frame.left && !was.left) this.move(-1);
    if (frame.right && !was.right) this.move(1);
    if (pad.attack || pad.jump || pad.special) this.pick();
  }

  private move(step: number): void {
    this.menu.move(step);
    this.showHint();
  }

  private showHint(): void {
    const option = this.menu.option;
    if (option) centred(this.hint.setText(optionHint(option.action)));
  }

  /** Ignore the buttons still held from the final blow until the card has been seen. */
  private ready(): boolean {
    return this.ticks > RESTART_DELAY_TICKS + (TEXT_DELAY_MS + FADE_MS) / TICK_MS;
  }

  private pick(): void {
    const action = this.menu.option?.action;
    if (!action) return;
    if (action.kind === 'link') openInNewTab(action.url);
    else this.scene.start('game', { stage: 'street' });
  }
}
