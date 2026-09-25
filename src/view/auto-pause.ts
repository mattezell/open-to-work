/**
 * When a stage pauses itself. Phaser-free so the rule is tested; bindPause
 * listens for the events.
 *
 * A lost window focus means alt-tab on a desktop, so it pauses. On a touch
 * screen it is not a reliable signal: in-app browsers (Facebook's on iOS, at
 * least) take focus from the page when a drag looks like their own swipe, so a
 * thumb on the stick paused the game. A phone player leaving shows up as the
 * page going hidden, and that pauses for everyone.
 */
export type AutoPauseCause = 'blur' | 'hidden';

export function shouldAutoPause(cause: AutoPauseCause, playingByTouch: boolean): boolean {
  return cause === 'hidden' || !playingByTouch;
}
