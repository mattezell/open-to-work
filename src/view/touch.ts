import type { InputFrame } from '../sim/input';
import {
  canRequest,
  initialFullscreenState,
  shouldAutoEnter,
  showFullPill,
  type FullscreenState,
} from './fullscreen';
import { TouchState, type ButtonAction } from './touch-state';

/**
 * Genesis pad order, left to right, as Streets of Rage 2 mapped it:
 * A special, B attack (the big one under the thumb), C jump.
 */
const BUTTONS: readonly { action: ButtonAction; letter: string; caption: string }[] = [
  { action: 'special', letter: 'A', caption: 'SPECIAL' },
  { action: 'attack', letter: 'B', caption: 'ATTACK' },
  { action: 'jump', letter: 'C', caption: 'JUMP' },
];

/** True on phones and tablets. A touch laptop reports a fine pointer and starts on keyboard. */
export function prefersTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * The pad control under a pointer event's target: 'stick' for the stick's
 * zone, a button's action, or undefined off the pad. The pad's touches still
 * reach window listeners, so screens with a menu use this to tell them apart.
 */
export function padControlAt(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  return target.closest<HTMLElement>('[data-pad-control]')?.dataset.padControl;
}

/**
 * The on-screen pad: a floating stick on the left half and three buttons on the
 * right, drawn as a DOM overlay so it stays crisp and hit-testable at any
 * canvas scale. It shows itself on a coarse pointer or the first touch, and
 * hides again when someone starts playing on a keyboard.
 */
export class TouchPad {
  private readonly state = new TouchState();
  private readonly root: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly buttons = new Map<ButtonAction, HTMLElement>();
  private readonly orderPill: HTMLElement;
  private readonly pausePill: HTMLElement;
  private onPause: () => void = () => undefined;
  private isActive = false;
  private readonly fullPill: HTMLElement;
  private fullscreen = initialFullscreenState(
    typeof document.documentElement.requestFullscreen === 'function',
  );

  constructor(
    mount: HTMLElement,
    private readonly onActiveChange: (active: boolean) => void,
  ) {
    this.root = element('div', 'pad');
    const zone = element('div', 'stick-zone');
    this.stick = element('div', 'stick');
    this.knob = element('div', 'knob');
    this.stick.append(this.knob);
    this.root.append(zone, this.stick);
    for (const { action, letter, caption } of BUTTONS) {
      const button = element('div', `tbtn tbtn-${action}`);
      button.append(element('span', 'letter', letter), element('span', 'caption', caption));
      this.bindButton(button, action);
      this.buttons.set(action, button);
      this.root.append(button);
    }
    this.orderPill = element('div', 'tbtn-order');
    this.bindButton(this.orderPill, 'order');
    this.buttons.set('order', this.orderPill);
    this.root.append(this.orderPill);
    this.bindStick(zone);
    // Beside the SOUND pill rather than on the pad, so it is out of reach of a thumb mid-fight.
    this.pausePill = element('div', 'pause-pill', 'PAUSE');
    this.pausePill.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onPause();
    });
    this.fullPill = element('div', 'full-pill', 'FULL');
    this.fullPill.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    // On the way up: Chrome grants a touch its user activation at pointerup, not pointerdown.
    this.fullPill.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (canRequest(this.fullscreen)) this.enterFullscreen(false);
    });
    mount.append(this.root, this.pausePill, this.fullPill);
    window.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType === 'touch' && shouldAutoEnter(this.fullscreen))
          this.enterFullscreen(true);
      },
      { capture: true },
    );
    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreen({ isFullscreen: document.fullscreenElement !== null });
    });
    this.updateFullscreen({});

    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.setActive(true);
      },
      { capture: true },
    );
    window.addEventListener('keydown', () => {
      if (!prefersTouch()) this.setActive(false);
    });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    this.setActive(prefersTouch());
  }

  get active(): boolean {
    return this.isActive;
  }

  snapshot(): InputFrame {
    return this.state.snapshot();
  }

  /** The order pill names TOKEN's current order; tapping it gives the next one. */
  setOrderLabel(text: string): void {
    if (this.orderPill.textContent !== text) this.orderPill.textContent = text;
  }

  /** What the PAUSE pill does: pause from a stage, resume from the pause screen. */
  setPauseHandler(handler: () => void, label: string): void {
    this.onPause = handler;
    this.pausePill.textContent = label;
  }

  /** A short buzz on Android. iOS Safari has no Vibration API, so there it does nothing. */
  buzz(ms: number): void {
    if (this.isActive) navigator.vibrate?.(ms);
  }

  private setActive(active: boolean): void {
    if (active === this.isActive) return;
    this.isActive = active;
    this.root.classList.toggle('on', active);
    document.documentElement.classList.toggle('touch', active);
    if (!active) this.releaseAll();
    this.onActiveChange(active);
  }

  private bindStick(zone: HTMLElement): void {
    zone.dataset.padControl = 'stick';
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.state.stickStart(e.pointerId, e.clientX, e.clientY);
      this.drawStick();
    });
    zone.addEventListener('pointermove', (e) => {
      this.state.stickMove(e.pointerId, e.clientX, e.clientY);
      this.drawStick();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      zone.addEventListener(type, (e) => {
        this.state.release(e.pointerId);
        this.drawStick();
      });
    }
  }

  private bindButton(button: HTMLElement, action: ButtonAction): void {
    button.dataset.padControl = action;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.state.buttonDown(e.pointerId, action);
      this.drawButtons();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      button.addEventListener(type, (e) => {
        this.state.release(e.pointerId);
        this.drawButtons();
      });
    }
  }

  private releaseAll(): void {
    this.state.releaseAll();
    this.drawStick();
    this.drawButtons();
  }

  private drawStick(): void {
    const visual = this.state.stickVisual();
    this.stick.classList.toggle('held', visual !== null);
    if (visual) {
      this.stick.style.left = `${visual.x}px`;
      this.stick.style.top = `${visual.y}px`;
      this.knob.style.transform = `translate(${visual.knobX}px, ${visual.knobY}px)`;
    } else {
      this.stick.style.left = '';
      this.stick.style.top = '';
      this.knob.style.transform = '';
    }
  }

  private drawButtons(): void {
    for (const [action, button] of this.buttons) {
      button.classList.toggle('press', this.state.isPressed(action));
    }
  }

  /**
   * Fullscreen and a landscape lock, as Momentum does. Automatic asks come from
   * any touch lifting off (see fullscreen.ts for when they stop); the FULL pill
   * asks on demand. iPhone Safari has no element fullscreen, so there neither
   * happens and the pill stays hidden (home-screen install is the path).
   */
  private enterFullscreen(automatic: boolean): void {
    this.updateFullscreen({ pending: true });
    document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        this.updateFullscreen({ pending: false, entered: true });
        return lockLandscape();
      })
      .catch((error: unknown) => {
        const refusals = this.fullscreen.refusals + (automatic ? 1 : 0);
        this.updateFullscreen({ pending: false, refusals });
        console.info('[otw] fullscreen refused:', error);
      });
  }

  private updateFullscreen(patch: Partial<FullscreenState>): void {
    this.fullscreen = { ...this.fullscreen, ...patch };
    this.fullPill.classList.toggle('shown', showFullPill(this.fullscreen));
  }
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return Promise.resolve();
  // Only some engines allow a lock, and only inside fullscreen; keep the fullscreen regardless.
  return orientation
    .lock('landscape')
    .catch((error: unknown) => console.info('[otw] orientation lock refused:', error));
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
