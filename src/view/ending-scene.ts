import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from '../sim/constants';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedDevices } from './devices';
import {
  HUD_TEXT,
  INK,
  MAX_TICKS_PER_FRAME,
  RESTART_DELAY_TICKS,
  restartHint,
  TICK_MS,
} from './hud';
import type { TouchPad } from './touch';

/** The ending card holds a beat before the words come up over it. */
const TEXT_DELAY_MS = 1200;
const FADE_MS = 800;
const CAPTION_H = 58;

/**
 * The end of the run: Matt and TOKEN on the roof of the tower with the
 * offer letter, the final score, and a way back to the street for another go.
 */
export class EndingScene extends Phaser.Scene {
  private score = 0;
  private keys!: HeldKeys;
  private touch!: TouchPad;
  private accumulator = 0;
  private ticks = 0;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('ending');
  }

  init(data: { score?: number }): void {
    this.score = data.score ?? 0;
    this.ticks = 0;
    this.accumulator = 0;
  }

  preload(): void {
    this.load.image('ending-hired', 'sprites/ending/hired.png');
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    this.touch.setOrderLabel('TOKEN: HIRED');
    this.cameras.main.fadeIn(FADE_MS);
    this.add.image(SCREEN_W / 2, 0, 'ending-hired').setOrigin(0.5, 0);
    const caption = this.add
      .rectangle(0, SCREEN_H - CAPTION_H, SCREEN_W, CAPTION_H, INK, 0.75)
      .setOrigin(0)
      .setAlpha(0);
    const title = this.add
      .text(SCREEN_W / 2, SCREEN_H - CAPTION_H + 6, 'HIRED', { ...HUD_TEXT, fontSize: '16px' })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    const lines = this.add
      .text(
        SCREEN_W / 2,
        SCREEN_H - CAPTION_H + 26,
        `FINAL SCORE  ${String(this.score).padStart(6, '0')}\nthanks for playing`,
        { ...HUD_TEXT, align: 'center' },
      )
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.hint = this.add
      .text(SCREEN_W / 2, SCREEN_H - 4, '', HUD_TEXT)
      .setOrigin(0.5, 1)
      .setAlpha(0);
    this.tweens.add({
      targets: [caption, title, lines, this.hint],
      alpha: 1,
      delay: TEXT_DELAY_MS,
      duration: FADE_MS,
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.again());
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.ticks++;
      const frame = mergeInputs(this.keys.snapshot(), this.touch.snapshot());
      if (frame.attack || frame.jump || frame.special) this.again();
    }
    this.hint.setText(this.ready() ? `again? ${restartHint(this.touch.active)}` : '');
  }

  /** Ignore the buttons still held from the final blow until the card has been seen. */
  private ready(): boolean {
    return this.ticks > RESTART_DELAY_TICKS + (TEXT_DELAY_MS + FADE_MS) / TICK_MS;
  }

  private again(): void {
    if (this.ready()) this.scene.start('game', { stage: 'street' });
  }
}
