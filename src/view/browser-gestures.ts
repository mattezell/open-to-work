/**
 * Which touches have their browser gesture cancelled. Phaser-free so the rule
 * is tested; TouchPad listens for the touches.
 *
 * iOS Safari ignores user-scalable=no, and on iOS 18 `touch-action: none` on
 * the page did not stop it either: a double tap on the background (a missed
 * button) zoomed the page, touch-action then blocked the pinch back out, and a
 * zoomed page panned sideways under a drag. So in touch play every touch
 * outside the canvas is cancelled at touchstart. The canvas is left alone:
 * Phaser already cancels its touches and needs them for the menus.
 */
export function cancelsBrowserGesture(playingByTouch: boolean, onCanvas: boolean): boolean {
  return playingByTouch && !onCanvas;
}
