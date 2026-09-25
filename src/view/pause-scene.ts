import Phaser from 'phaser';
import { SCREEN_H, SCREEN_W } from '../sim/constants';
import { sharedAudio } from './audio';
import { shouldAutoPause } from './auto-pause';
import { HELP_CODES, KEY_BINDINGS, PAUSE_CODES } from './controls';
import { sharedDevices } from './devices';
import {
  FOOTER_Y,
  helpPages,
  layoutPage,
  layoutTabs,
  pauseFooter,
  TABS_Y,
  TITLE_Y,
  turnPage,
  type HelpPage,
} from './help';
import { INK } from './hud';
import { TITLE_SCALE } from './pixel-font';
import { HEAD_COLOR, pixelFont, pixelText, TEXT_COLOR } from './pixel-text';
import type { TouchPad } from './touch';

export const PAUSE_SCENE = 'pause';
const DIM_COLOR = '#909090';
const SHADE_ALPHA = 0.92;
const RESUME_CODES: readonly string[] = [...PAUSE_CODES, 'Enter'];

/** Pause opens on the page the player last read; help always opens on the controls. */
let lastPage = 0;

interface PauseData {
  from: string;
  page?: number;
}

/** Freeze a stage scene where it stands and put the pause screen over it. */
export function pauseStage(scene: Phaser.Scene, page?: number): void {
  if (!scene.scene.isActive()) return;
  scene.scene.pause();
  scene.scene.launch(PAUSE_SCENE, { from: scene.scene.key, page } satisfies PauseData);
}

/**
 * A stage scene's way in: the pause and help keys, the touch PAUSE pill, and
 * an automatic pause when the player leaves (see shouldAutoPause), so
 * alt-tabbing away in the middle of a wave does not cost Matt his health.
 */
export function bindPause(scene: Phaser.Scene, touch: TouchPad): void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (PAUSE_CODES.includes(e.code)) pauseStage(scene);
    else if (HELP_CODES.includes(e.code)) pauseStage(scene, 0);
  };
  const armPill = (): void => touch.setPauseHandler(() => pauseStage(scene), 'PAUSE');
  const onBlur = (): void => {
    if (shouldAutoPause('blur', touch.active)) pauseStage(scene);
  };
  const onHidden = (): void => {
    if (shouldAutoPause('hidden', touch.active)) pauseStage(scene);
  };
  scene.input.keyboard?.on('keydown', onKey);
  scene.game.events.on(Phaser.Core.Events.BLUR, onBlur);
  scene.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
  scene.events.on(Phaser.Scenes.Events.RESUME, armPill);
  armPill();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off('keydown', onKey);
    scene.game.events.off(Phaser.Core.Events.BLUR, onBlur);
    scene.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
    scene.events.off(Phaser.Scenes.Events.RESUME, armPill);
  });
}

/**
 * The pause screen, drawn over the frozen stage: PAUSED, a tab strip, and one
 * help page at a time (controls, TOKEN's orders, then who is who on each
 * stage). Keys turn the pages and resume; on a touch screen a tap anywhere
 * turns the page and the pill resumes.
 */
export class PauseScene extends Phaser.Scene {
  private from = '';
  private page = 0;
  /** Input from before the screen opened belongs to the stage, not to the pause screen. */
  private openedAt = 0;
  private pages: readonly HelpPage[] = [];
  private tabs: Phaser.GameObjects.BitmapText[] = [];
  private lines: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super(PAUSE_SCENE);
  }

  init(data: PauseData): void {
    this.from = data.from;
    this.page = data.page ?? lastPage;
  }

  create(): void {
    const { touch } = sharedDevices(this.game);
    this.openedAt = performance.now();
    this.pages = helpPages(touch.active);
    this.page = Math.min(this.page, this.pages.length - 1);
    sharedAudio().setPaused(true);
    touch.setPauseHandler(() => this.resume(), 'RESUME');

    this.add.rectangle(0, 0, SCREEN_W, SCREEN_H, INK, SHADE_ALPHA).setOrigin(0);
    pixelText(this, SCREEN_W / 2, TITLE_Y, 'PAUSED')
      .setScale(TITLE_SCALE)
      .setOrigin(0.5, 0);
    this.tabs = layoutTabs(this.pages.map((page) => page.tab)).map(({ x, text }) =>
      pixelText(this, x, TABS_Y, text),
    );
    pixelText(this, SCREEN_W / 2, FOOTER_Y, pauseFooter(touch.active), DIM_COLOR).setOrigin(0.5, 0);
    // The scene object outlives each pause; the page's text went with the last one.
    this.lines = [];
    this.showPage();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    const onTap = (e: PointerEvent): void => {
      if (e.timeStamp >= this.openedAt) this.turn(1);
    };
    window.addEventListener('pointerdown', onTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      window.removeEventListener('pointerdown', onTap),
    );
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat || e.timeStamp < this.openedAt) return;
    if (RESUME_CODES.includes(e.code)) this.resume();
    else if (KEY_BINDINGS.left.includes(e.code)) this.turn(-1);
    else if (KEY_BINDINGS.right.includes(e.code) || HELP_CODES.includes(e.code)) this.turn(1);
  }

  private turn(delta: number): void {
    this.page = turnPage(this.page, delta, this.pages.length);
    this.showPage();
  }

  private showPage(): void {
    lastPage = this.page;
    this.tabs.forEach((tab, i) =>
      tab.setFont(pixelFont(this, i === this.page ? HEAD_COLOR : DIM_COLOR)),
    );
    for (const line of this.lines) line.destroy();
    const page = this.pages[this.page];
    this.lines = page
      ? layoutPage(page).map(({ x, y, text, head }) =>
          pixelText(this, x, y, text, head ? HEAD_COLOR : TEXT_COLOR),
        )
      : [];
  }

  private resume(): void {
    const { keys, touch } = sharedDevices(this.game);
    // Keys tapped to turn pages must not reach the stage as a step or a punch.
    keys.snapshot();
    touch.snapshot();
    sharedAudio().setPaused(false);
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
