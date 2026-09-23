import Phaser from 'phaser';
import { KEY_BINDINGS } from './controls';
import { cycle, menuSlotXs, optionText, type HireOption } from './hire';
import { CELL_H } from './pixel-font';
import { HEAD_COLOR, pixelFont, pixelText } from './pixel-text';

/** Keys that pick the chosen option: Enter plus the three action buttons. */
export const PICK_CODES: readonly string[] = [
  'Enter',
  ...KEY_BINDINGS.attack,
  ...KEY_BINDINGS.jump,
  ...KEY_BINDINGS.special,
];

/**
 * Open a link in a new tab from inside the key or tap that asked for it, so
 * popup blockers let it through. The new tab gets no handle back to the game.
 * If the browser blocks it anyway, go there in this tab rather than do nothing.
 */
export function openInNewTab(url: string): void {
  const tab = window.open(url, '_blank');
  if (tab) tab.opener = null;
  else window.location.assign(url);
}

/**
 * Keys and taps read straight from the window for the life of `scene`, so a
 * link opens inside the event that asked for it (Phaser queues its own until
 * the next step, and popup blockers only trust the event itself). Taps come
 * in game pixels; ones from before the scene opened are ignored.
 */
export function listenForPicks(
  scene: Phaser.Scene,
  onKey: (e: KeyboardEvent) => void,
  onTap: (x: number, y: number) => void,
): void {
  const openedAt = performance.now();
  const tap = (e: PointerEvent): void => {
    if (e.timeStamp >= openedAt)
      onTap(scene.scale.transformX(e.pageX), scene.scale.transformY(e.pageY));
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', tap);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', tap);
  });
}

/**
 * A one-row menu in the pixel font: the chosen option in gold between arrows,
 * the rest plain. Used by the title screen and the HIRED card.
 */
export class MenuRow {
  readonly slots: Phaser.GameObjects.BitmapText[];
  private chosen = 0;
  private arrows = true;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly options: readonly HireOption[],
    y: number,
  ) {
    const xs = menuSlotXs(options.map((option) => option.label));
    this.slots = options.map((option, i) =>
      pixelText(scene, xs[i] ?? 0, y, optionText(option.label, false)),
    );
    this.select(0);
  }

  get index(): number {
    return this.chosen;
  }

  get option(): HireOption | undefined {
    return this.options[this.chosen];
  }

  select(index: number): void {
    this.chosen = index;
    this.redraw();
  }

  move(step: number): void {
    this.select(cycle(this.chosen, step, this.options.length));
  }

  /** Show or hide the chosen option's arrows, for a blinking cursor. */
  showArrows(on: boolean): void {
    if (on === this.arrows) return;
    this.arrows = on;
    this.redraw();
  }

  setVisible(visible: boolean): void {
    for (const slot of this.slots) slot.setVisible(visible);
  }

  /** The option under a tap at game pixel (`x`, `y`), or -1. The band is generous for thumbs. */
  slotAt(x: number, y: number): number {
    return this.slots.findIndex(
      (slot) =>
        slot.visible &&
        x >= slot.x &&
        x < slot.x + slot.width &&
        Math.abs(y - slot.y - CELL_H / 2) < CELL_H,
    );
  }

  private redraw(): void {
    this.slots.forEach((slot, i) => {
      const option = this.options[i];
      if (!option) return;
      const chosen = i === this.chosen;
      slot.setFont(pixelFont(this.scene, chosen ? HEAD_COLOR : undefined));
      slot.setText(optionText(option.label, chosen && this.arrows));
    });
  }
}
