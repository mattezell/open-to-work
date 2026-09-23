import { ATTACKS, type AttackId, type FighterKind } from '../sim/fighters';
import { REBOOT_TICKS } from '../sim/sidekick';
import type { Fighter } from '../sim/world';

/** One generated sprite sheet: a single row of equal frames, all facing right. */
export interface SheetDef {
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

const MATT_FRAME = { frameWidth: 128, frameHeight: 96 };
const ENEMY_FRAME = { frameWidth: 112, frameHeight: 80 };

/** Every sheet the view loads, keyed by fighter kind then sheet name (the PNG's basename). */
export const SHEETS = {
  matt: {
    idle: { frames: 4, ...MATT_FRAME },
    walk: { frames: 6, ...MATT_FRAME },
    jab: { frames: 4, ...MATT_FRAME },
    haymaker: { frames: 4, ...MATT_FRAME },
    jump: { frames: 4, ...MATT_FRAME },
    hurt: { frames: 2, ...MATT_FRAME },
    knockdown: { frames: 4, ...MATT_FRAME },
    special: { frames: 4, ...MATT_FRAME },
  },
  ats: {
    idle: { frames: 4, ...ENEMY_FRAME },
    walk: { frames: 6, ...ENEMY_FRAME },
    shred: { frames: 4, ...ENEMY_FRAME },
    hurt: { frames: 2, ...ENEMY_FRAME },
    knockdown: { frames: 4, ...ENEMY_FRAME },
  },
  token: {
    idle: { frames: 4, ...ENEMY_FRAME },
    walk: { frames: 6, ...ENEMY_FRAME },
    punch: { frames: 4, ...ENEMY_FRAME },
    hurt: { frames: 2, ...ENEMY_FRAME },
    knockdown: { frames: 4, ...ENEMY_FRAME },
  },
} as const satisfies Record<FighterKind, Record<string, SheetDef>>;

export interface Pose {
  sheet: string;
  frame: number;
}

export function sheetKey(kind: FighterKind, sheet: string): string {
  return `${kind}-${sheet}`;
}

const IDLE_TICKS_PER_FRAME = 10;
const WALK_TICKS_PER_FRAME = 7;
/** TOKEN's loading-bar frame shows for this long before it gets back up. */
const TOKEN_LOADING_TICKS = 90;

/** Which frame of which sheet a fighter shows. Pure, so it is tested without Phaser. */
export function poseFor(f: Fighter): Pose {
  switch (f.state) {
    case 'idle':
      return loop('idle', 4, f.stateTick, IDLE_TICKS_PER_FRAME);
    case 'walk':
      return loop('walk', 6, f.stateTick, WALK_TICKS_PER_FRAME);
    case 'jump':
      return jumpPose(f);
    case 'attack':
      return f.attack === null ? loop('idle', 4, 0, 1) : attackPose(f.attack, f.attackTick);
    case 'hurt':
      return { sheet: 'hurt', frame: f.stateTick < 8 ? 0 : 1 };
    case 'knockdown':
      return { sheet: 'knockdown', frame: f.y > 0 || f.vy > 0 ? 0 : 1 };
    case 'getup':
      return { sheet: 'knockdown', frame: f.stateTick < 12 ? 2 : 3 };
    case 'dead':
      return deadPose(f);
  }
}

/** A KO'd TOKEN lies with a dark screen, then shows its loading bar as the reboot finishes. */
function deadPose(f: Fighter): Pose {
  const loading = f.kind === 'token' && f.stateTick >= REBOOT_TICKS - TOKEN_LOADING_TICKS;
  return { sheet: 'knockdown', frame: loading ? 2 : 1 };
}

function loop(sheet: string, frames: number, tick: number, ticksPerFrame: number): Pose {
  return { sheet, frame: Math.floor(tick / ticksPerFrame) % frames };
}

function jumpPose(f: Fighter): Pose {
  if (f.attack === 'jumpkick') return { sheet: 'jump', frame: 3 };
  if (f.stateTick < 4) return { sheet: 'jump', frame: 0 };
  return { sheet: 'jump', frame: f.vy > 0 ? 2 : 1 };
}

/**
 * Attack sheets are four frames. The two jabs share one sheet (frames 0-1 are
 * the first jab, 2-3 the second) so a chain alternates hands; heavier attacks
 * split startup into wind-up frames 0-1, then show 2 while active and 3 in
 * recovery.
 */
function attackPose(attack: AttackId, tick: number): Pose {
  const def = ATTACKS[attack];
  const active = tick >= def.startup && tick < def.startup + def.active;
  switch (attack) {
    case 'zap1':
    case 'zap2': {
      const base = attack === 'zap1' ? 0 : 2;
      return { sheet: 'punch', frame: base + (active ? 1 : 0) };
    }
    case 'jab1':
    case 'jab2': {
      const base = attack === 'jab1' ? 0 : 2;
      return { sheet: 'jab', frame: base + (active ? 1 : 0) };
    }
    case 'special':
      return { sheet: 'special', frame: Math.floor(tick / 4) % 4 };
    case 'jumpkick':
      return { sheet: 'jump', frame: 3 };
    case 'haymaker':
    case 'shred': {
      const sheet = attack === 'haymaker' ? 'haymaker' : 'shred';
      if (tick < def.startup) return { sheet, frame: tick < def.startup / 2 ? 0 : 1 };
      return { sheet, frame: active ? 2 : 3 };
    }
  }
}
