/**
 * When the page asks for fullscreen on its own, and when it offers the FULL
 * pill instead. Phaser-free and DOM-free so the rules are tested; TouchPad
 * does the asking.
 *
 * Chrome on Android grants a touch its user activation at pointerup, not at
 * pointerdown, so a request made on the way down is refused. The page asks on
 * the way up, keeps asking until one request lands (a few refusals in a row
 * mean the browser will not allow it here), and never drags back into
 * fullscreen a player who has left it: the FULL pill is theirs to press.
 */
export const MAX_AUTO_REFUSALS = 3;

export interface FullscreenState {
  /** The browser has element fullscreen at all. iPhone Safari does not. */
  supported: boolean;
  /** The page is fullscreen right now. */
  isFullscreen: boolean;
  /** A request is in flight. */
  pending: boolean;
  /** A request has succeeded at some point this session. */
  entered: boolean;
  /** Automatic requests refused so far. */
  refusals: number;
}

export function initialFullscreenState(supported: boolean): FullscreenState {
  return { supported, isFullscreen: false, pending: false, entered: false, refusals: 0 };
}

/** Whether a touch lifting off anywhere should ask for fullscreen by itself. */
export function shouldAutoEnter(state: FullscreenState): boolean {
  return (
    state.supported &&
    !state.isFullscreen &&
    !state.pending &&
    !state.entered &&
    state.refusals < MAX_AUTO_REFUSALS
  );
}

/** Whether a press of the FULL pill should ask. The pill ignores the automatic give-ups. */
export function canRequest(state: FullscreenState): boolean {
  return state.supported && !state.isFullscreen && !state.pending;
}

/** The FULL pill shows wherever fullscreen exists and the page is not already in it. */
export function showFullPill(state: FullscreenState): boolean {
  return state.supported && !state.isFullscreen;
}
