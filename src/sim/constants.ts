/** Simulation rate. Every duration in the sim is in ticks at this rate. */
export const TICK_HZ = 60;

/** Genesis H40 mode resolution: the view renders at exactly this size. */
export const SCREEN_W = 320;
export const SCREEN_H = 224;

/** Walkable depth band. z = 0 is the back of the street, z = DEPTH the front. */
export const DEPTH = 56;

/** How close two fighters must be in depth for an attack to connect. */
export const DEPTH_TOLERANCE = 9;

export const GRAVITY = 0.25;

/** Buffered attack presses survive this many ticks, so presses during hit-stop count. */
export const INPUT_BUFFER_TICKS = 8;

/** Ticks after an attack ends in which the next press continues the chain. */
export const CHAIN_WINDOW_TICKS = 18;

/** Players stay this far inside the screen edges. */
export const SCREEN_MARGIN = 12;

/** The camera trails the lead player by this much when scrolling. */
export const CAMERA_LEAD = 140;

export const GO_PROMPT_TICKS = 150;

/** Only this many enemies may be mid-attack at once, so crowds stay fair. */
export const MAX_CONCURRENT_ENEMY_ATTACKS = 2;
