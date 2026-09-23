import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W, TICK_HZ } from '../sim/constants';
import type { FighterKind } from '../sim/fighters';
import type { InputFrame } from '../sim/input';
import { sheetKey, SHEETS } from './animation';
import { attractScreen, startPressed, TITLE_SCENE, titleHint, type AttractScreen } from './attract';
import { mergeInputs, type HeldKeys } from './controls';
import { sharedDevices } from './devices';
import { ROSTER, wrap } from './help';
import { CV_LIVE, titleOptions } from './hire';
import { FLOOR_TOP, INK, MAX_TICKS_PER_FRAME, TICK_MS } from './hud';
import { listenForPicks, MenuRow, openInNewTab, PICK_CODES } from './menu-row';
import { CELL_H, CELL_W, TITLE_SCALE } from './pixel-font';
import { HEAD_COLOR, pixelText } from './pixel-text';
import type { GameData } from './game-scene';
import { drawStreet, loadSprites } from './scenery';
import type { TouchPad } from './touch';

type Visible = Phaser.GameObjects.Components.Visible;

const LOGO_SCALE = 3;
const DIM_COLOR = '#909090';
const IDLE_TICKS_PER_FRAME = 10;
const BLINK_TICKS = TICK_HZ / 2;
/** The roster card's text column, right of the enemy standing on the left. */
const ROSTER_TEXT_X = 150;
const ROSTER_FEET_X = 84;
const ROSTER_FEET_Y = FLOOR_TOP + 40;

/**
 * The front of the arcade cabinet: the logo with Matt and TOKEN on the
 * street, then who they are up against, one enemy at a time, then the bot
 * plays a demo. Along the bottom, START and the real Matt's CV and contact
 * page, so hiring him is not gated behind beating the game. START is the
 * default, so start from any screen still begins a run.
 */
export class TitleScene extends Phaser.Scene {
  private keys!: HeldKeys;
  private touch!: TouchPad;
  private accumulator = 0;
  private ticks = 0;
  private leaving = false;
  private titleParts: Visible[] = [];
  private rosterParts: Visible[] = [];
  private heroes: { sprite: Phaser.GameObjects.Sprite; kind: FighterKind }[] = [];
  private enemy!: Phaser.GameObjects.Sprite;
  private rosterName!: Phaser.GameObjects.BitmapText;
  private rosterPitch!: Phaser.GameObjects.BitmapText;
  private rosterCount!: Phaser.GameObjects.BitmapText;
  private menu!: MenuRow;
  private hint!: Phaser.GameObjects.BitmapText;
  private lastFrame: InputFrame | null = null;

  constructor() {
    super(TITLE_SCENE);
  }

  preload(): void {
    // Everything the run needs, so pressing start drops straight into the street.
    loadSprites(this, () => undefined);
  }

  create(): void {
    ({ keys: this.keys, touch: this.touch } = sharedDevices(this.game));
    this.accumulator = 0;
    this.ticks = 0;
    this.leaving = false;
    this.lastFrame = null;
    this.keys.snapshot();
    this.touch.snapshot();
    this.touch.setOrderLabel('TOKEN: READY');
    this.touch.setPauseHandler(() => this.start(), 'START');

    drawStreet(this, SCREEN_W);
    this.add.rectangle(0, 0, SCREEN_W, FLOOR_TOP - 6, INK, 0.55).setOrigin(0);
    this.titleParts = this.drawTitle();
    this.rosterParts = this.drawRoster();
    this.menu = new MenuRow(this, titleOptions(CV_LIVE), SCREEN_H - 14);
    this.showHint();
    listenForPicks(
      this,
      (e) => {
        if (!e.repeat && PICK_CODES.includes(e.code)) this.pick();
      },
      (x, y) => {
        const hit = this.menu.slotAt(x, y);
        if (hit < 0) {
          this.start();
          return;
        }
        this.menu.select(hit);
        this.pick();
      },
    );
    this.show({ screen: 'title' });
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, TICK_MS * MAX_TICKS_PER_FRAME);
    while (this.accumulator >= TICK_MS && !this.leaving) {
      this.accumulator -= TICK_MS;
      this.ticks++;
      this.step();
      const screen = attractScreen(this.ticks);
      if (screen.screen === 'demo') this.leave({ demo: true });
      else this.show(screen);
    }
    const frame = Math.floor(this.ticks / IDLE_TICKS_PER_FRAME);
    for (const { sprite, kind } of this.heroes) sprite.setFrame(frame % SHEETS[kind].idle.frames);
    this.menu.showArrows(Math.floor(this.ticks / BLINK_TICKS) % 2 === 0);
  }

  /**
   * The stick and the keys move the cursor; the touch pad's buttons pick.
   * Keyboard picks and taps arrive through `listenForPicks` instead, inside
   * the event, so a link can open in a new tab.
   */
  private step(): void {
    const pad = this.touch.snapshot();
    const frame = mergeInputs(this.keys.snapshot(), pad);
    const was = this.lastFrame;
    this.lastFrame = frame;
    if (was && frame.left && !was.left) this.move(-1);
    if (was && frame.right && !was.right) this.move(1);
    if (startPressed(pad)) this.pick();
  }

  /** Moving the cursor is someone at the cabinet: back to the title, and the attract loop starts over. */
  private move(step: number): void {
    this.menu.move(step);
    this.ticks = 0;
    this.show({ screen: 'title' });
    this.showHint();
  }

  private showHint(): void {
    const option = this.menu.option;
    if (!option) return;
    this.hint.setText(titleHint(option.action, this.touch.active));
    this.hint.setX(Math.round((SCREEN_W - this.hint.width) / 2));
  }

  private pick(): void {
    const action = this.menu.option?.action;
    if (!action || this.leaving) return;
    if (action.kind === 'link') openInNewTab(action.url);
    else this.start();
  }

  private drawTitle(): Visible[] {
    const logo = pixelText(this, 0, 18, 'OPEN TO WORK', HEAD_COLOR).setScale(LOGO_SCALE);
    logo.setX(Math.round((SCREEN_W - logo.width) / 2));
    this.hint = pixelText(this, 0, 84, '', DIM_COLOR);
    const lines = [
      pixelText(this, 0, 52, "a co-op beat 'em up about the job hunt"),
      pixelText(this, 0, 68, 'MATT + TOKEN  vs  THE HIRING PROCESS'),
      this.hint,
    ];
    for (const line of lines) line.setX(Math.round((SCREEN_W - line.width) / 2));
    this.heroes = (['matt', 'token'] as const).map((kind, i) => ({
      kind,
      sprite: this.add
        .sprite(SCREEN_W / 2 - 28 + i * 60, FLOOR_TOP + 36 - i * 10, sheetKey(kind, 'idle'))
        .setOrigin(0.5, 1),
    }));
    const credit = pixelText(this, 0, SCREEN_H - 26, '2026  MATT EZELL + CLAUDE', DIM_COLOR);
    credit.setX(Math.round((SCREEN_W - credit.width) / 2));
    return [logo, ...lines, credit, ...this.heroes.map((hero) => hero.sprite)];
  }

  private drawRoster(): Visible[] {
    const heading = pixelText(this, 0, 18, 'NOW HIRING', HEAD_COLOR).setScale(TITLE_SCALE);
    heading.setX(Math.round((SCREEN_W - heading.width) / 2));
    const sub = pixelText(this, 0, 42, 'the hiring process, in order of appearance', DIM_COLOR);
    sub.setX(Math.round((SCREEN_W - sub.width) / 2));
    this.enemy = this.add.sprite(ROSTER_FEET_X, ROSTER_FEET_Y, sheetKey('ats', 'idle'), 0);
    this.enemy.setOrigin(0.5, 1);
    this.rosterName = pixelText(this, ROSTER_TEXT_X, 76, '', HEAD_COLOR);
    this.rosterPitch = pixelText(this, ROSTER_TEXT_X, 76 + 2 * CELL_H);
    this.rosterCount = pixelText(this, ROSTER_TEXT_X, 76 + 6 * CELL_H, '', DIM_COLOR);
    return [heading, sub, this.enemy, this.rosterName, this.rosterPitch, this.rosterCount];
  }

  private show(screen: Exclude<AttractScreen, { screen: 'demo' }>): void {
    const onRoster = screen.screen === 'roster';
    for (const part of this.titleParts) part.setVisible(!onRoster);
    for (const part of this.rosterParts) part.setVisible(onRoster);
    if (!onRoster) return;
    const entry = ROSTER[screen.index];
    if (!entry) return;
    const frames = SHEETS[entry.kind].idle.frames;
    this.enemy.setTexture(
      sheetKey(entry.kind, 'idle'),
      Math.floor(this.ticks / IDLE_TICKS_PER_FRAME) % frames,
    );
    const columns = Math.floor((SCREEN_W - 8 - ROSTER_TEXT_X) / CELL_W);
    this.rosterName.setText(wrap(entry.head, columns).join('\n'));
    this.rosterPitch.setY(this.rosterName.y + this.rosterName.height + CELL_H);
    this.rosterPitch.setText(wrap(entry.tagline, columns).join('\n'));
    this.rosterCount.setY(this.rosterPitch.y + this.rosterPitch.height + CELL_H);
    this.rosterCount.setText(`${screen.index + 1} of ${ROSTER.length}`);
  }

  private start(): void {
    this.keys.snapshot();
    this.touch.snapshot();
    this.leave({ stage: 'street' });
  }

  private leave(data: GameData): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('game', data);
  }
}
