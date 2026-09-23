import type { InputFrame } from '../sim/input';
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
  private isActive = false;
  private askedFullscreen = false;

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
    mount.append(this.root);

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
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      this.requestFullscreenOnce();
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
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.requestFullscreenOnce();
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
   * First touch on the pad asks for fullscreen and a landscape lock, as Momentum
   * does. Only once, so a player who backs out of fullscreen is not dragged
   * back in. iPhone Safari has no element fullscreen; there the page simply
   * stays as it is (home-screen install is the fullscreen path).
   */
  private requestFullscreenOnce(): void {
    if (this.askedFullscreen) return;
    this.askedFullscreen = true;
    const page = document.documentElement;
    if (typeof page.requestFullscreen !== 'function' || document.fullscreenElement) return;
    page
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => lockLandscape())
      .catch((error: unknown) => console.info('[otw] fullscreen refused:', error));
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
