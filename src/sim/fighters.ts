export type Team = 'player' | 'enemy';
export type FighterKind =
  | 'matt'
  | 'token'
  | 'ats'
  | 'spam'
  | 'takehome'
  | 'golem'
  | 'ghoster'
  | 'screener'
  | 'techlead'
  | 'manager';
export type AttackId =
  | 'jab1'
  | 'jab2'
  | 'haymaker'
  | 'jumpkick'
  | 'special'
  | 'zap1'
  | 'zap2'
  | 'shred'
  | 'toss'
  | 'card'
  | 'slam'
  | 'smash'
  | 'swipe'
  | 'screen'
  | 'whiteboard'
  | 'delegate'
  | 'form'
  | 'notes'
  | 'folder';

export interface AttackDef {
  /** Ticks before the hitbox appears. */
  startup: number;
  /** Ticks the hitbox is live. */
  active: number;
  /** Ticks after the hitbox closes before the fighter can act. */
  recovery: number;
  damage: number;
  /** Forward reach from the attacker's centre, in px. */
  reach: number;
  /** When true the hitbox covers both sides (the special's 360 sweep). */
  omni: boolean;
  knockdown: boolean;
  /** Global freeze on connect, in ticks. */
  hitstop: number;
  /** Instead of a hitbox, launch this projectile on the first active tick. */
  projectile?: ProjectileKind;
}

export type ProjectileKind = 'card' | 'form' | 'notes' | 'folder';

export interface ProjectileDef {
  /** The attack whose damage, hitstop and knockdown the projectile applies on contact. */
  hit: AttackId;
  speed: number;
  /** Height above the ground it flies at. A fighter jumping higher than `clearance` dodges it. */
  height: number;
  clearance: number;
  /** A shockwave along the floor: it hits at every depth, so only a jump clears it. */
  wide?: boolean;
}

export const PROJECTILES: Record<ProjectileKind, ProjectileDef> = {
  card: { hit: 'card', speed: 3.2, height: 40, clearance: 20 },
  form: { hit: 'form', speed: 2.6, height: 36, clearance: 18 },
  notes: { hit: 'notes', speed: 2.2, height: 4, clearance: 10, wide: true },
  folder: { hit: 'folder', speed: 4.2, height: 40, clearance: 20 },
};

export interface KindStats {
  team: Team;
  maxHp: number;
  walkX: number;
  walkZ: number;
  /** Half-width of the body, used for hurtbox overlap. */
  halfWidth: number;
  height: number;
  hitstun: number;
  score: number;
  /** The ground attack when the kind has no chain. */
  basicAttack: AttackId;
  /** Hits while it is mid-attack hurt it but do not interrupt the attack. */
  armored?: boolean;
  /** Only knockdown attacks really hurt it: anything lighter chips HEAVY_CHIP and never staggers. */
  heavy?: boolean;
  /** Sits behind a desk: never walks, never flies on a knockdown, stays in its seat when beaten. */
  seated?: boolean;
}

/** Damage a light hit does to a heavy enemy. */
export const HEAVY_CHIP = 1;

/** A throw: a wind-up of `startup` ticks, then `projectile` leaves the hand. */
function throwOf(projectile: ProjectileKind, startup: number): AttackDef {
  return {
    startup,
    active: 1,
    recovery: 20,
    damage: 0,
    reach: 0,
    omni: false,
    knockdown: false,
    hitstop: 0,
    projectile,
  };
}

/** What a projectile does when it lands. */
function projectileHit(damage: number, knockdown: boolean): AttackDef {
  return {
    startup: 0,
    active: 1,
    recovery: 0,
    damage,
    reach: 0,
    omni: false,
    knockdown,
    hitstop: 4,
  };
}

export const ATTACKS: Record<AttackId, AttackDef> = {
  jab1: {
    startup: 3,
    active: 2,
    recovery: 7,
    damage: 6,
    reach: 26,
    omni: false,
    knockdown: false,
    hitstop: 4,
  },
  jab2: {
    startup: 3,
    active: 2,
    recovery: 8,
    damage: 7,
    reach: 26,
    omni: false,
    knockdown: false,
    hitstop: 5,
  },
  haymaker: {
    startup: 6,
    active: 3,
    recovery: 16,
    damage: 14,
    reach: 30,
    omni: false,
    knockdown: true,
    hitstop: 9,
  },
  jumpkick: {
    startup: 2,
    active: 60,
    recovery: 0,
    damage: 12,
    reach: 28,
    omni: false,
    knockdown: true,
    hitstop: 7,
  },
  special: {
    startup: 4,
    active: 6,
    recovery: 14,
    damage: 16,
    reach: 38,
    omni: true,
    knockdown: true,
    hitstop: 8,
  },
  zap1: {
    startup: 5,
    active: 2,
    recovery: 10,
    damage: 7,
    reach: 30,
    omni: false,
    knockdown: false,
    hitstop: 4,
  },
  zap2: {
    startup: 5,
    active: 3,
    recovery: 18,
    damage: 9,
    reach: 32,
    omni: false,
    knockdown: true,
    hitstop: 6,
  },
  shred: {
    startup: 10,
    active: 3,
    recovery: 22,
    damage: 8,
    reach: 26,
    omni: false,
    knockdown: false,
    hitstop: 5,
  },
  toss: {
    startup: 14,
    active: 1,
    recovery: 18,
    damage: 0,
    reach: 0,
    omni: false,
    knockdown: false,
    hitstop: 0,
    projectile: 'card',
  },
  card: {
    startup: 0,
    active: 1,
    recovery: 0,
    damage: 6,
    reach: 0,
    omni: false,
    knockdown: false,
    hitstop: 3,
  },
  slam: {
    startup: 26,
    active: 4,
    recovery: 30,
    damage: 18,
    reach: 40,
    omni: false,
    knockdown: true,
    hitstop: 10,
  },
  smash: {
    startup: 24,
    active: 4,
    recovery: 28,
    damage: 12,
    reach: 36,
    omni: false,
    knockdown: true,
    hitstop: 10,
  },
  swipe: {
    startup: 9,
    active: 3,
    recovery: 16,
    damage: 8,
    reach: 28,
    omni: false,
    knockdown: false,
    hitstop: 5,
  },
  screen: throwOf('form', 16),
  whiteboard: throwOf('notes', 24),
  delegate: throwOf('folder', 12),
  form: projectileHit(6, false),
  notes: projectileHit(8, true),
  folder: projectileHit(7, false),
};

/** Matt's 3-hit chain, in order. Whiffing resets it to the first jab. */
export const CHAIN: readonly AttackId[] = ['jab1', 'jab2', 'haymaker'];
/** TOKEN's one-two: the second punch knocks down. */
export const TOKEN_CHAIN: readonly AttackId[] = ['zap1', 'zap2'];

/** The ground chain a kind cycles through, or null for a single repeated attack. */
export function chainFor(kind: FighterKind): readonly AttackId[] | null {
  if (kind === 'matt') return CHAIN;
  if (kind === 'token') return TOKEN_CHAIN;
  return null;
}

/** Health the special costs (Streets of Rage rule). It cannot kill: needs hp above this. */
export const SPECIAL_COST = 8;

export const JUMP_VELOCITY = 4.2;

export const KINDS: Record<FighterKind, KindStats> = {
  matt: {
    team: 'player',
    maxHp: 100,
    walkX: 1.5,
    walkZ: 1.0,
    halfWidth: 10,
    height: 64,
    hitstun: 16,
    score: 0,
    basicAttack: 'jab1',
  },
  token: {
    team: 'player',
    maxHp: 60,
    walkX: 1.35,
    walkZ: 0.9,
    halfWidth: 10,
    height: 64,
    hitstun: 16,
    score: 0,
    basicAttack: 'zap1',
  },
  ats: {
    team: 'enemy',
    maxHp: 30,
    walkX: 0.7,
    walkZ: 0.55,
    halfWidth: 12,
    height: 56,
    hitstun: 18,
    score: 500,
    basicAttack: 'shred',
  },
  spam: {
    team: 'enemy',
    maxHp: 22,
    walkX: 1.3,
    walkZ: 0.9,
    halfWidth: 10,
    height: 64,
    hitstun: 16,
    score: 700,
    basicAttack: 'toss',
  },
  takehome: {
    team: 'enemy',
    maxHp: 160,
    walkX: 0.5,
    walkZ: 0.45,
    halfWidth: 22,
    height: 96,
    hitstun: 10,
    score: 5000,
    basicAttack: 'slam',
    armored: true,
  },
  golem: {
    team: 'enemy',
    maxHp: 64,
    walkX: 0.55,
    walkZ: 0.45,
    halfWidth: 18,
    height: 80,
    hitstun: 14,
    score: 1500,
    basicAttack: 'smash',
    armored: true,
    heavy: true,
  },
  ghoster: {
    team: 'enemy',
    maxHp: 34,
    walkX: 1.4,
    walkZ: 1.0,
    halfWidth: 10,
    height: 60,
    hitstun: 16,
    score: 1000,
    basicAttack: 'swipe',
  },
  screener: panelist(30, 'screen'),
  techlead: panelist(40, 'whiteboard'),
  manager: panelist(50, 'delegate'),
};

/** One of the three interviewers at the top of the tower. */
function panelist(maxHp: number, basicAttack: AttackId): KindStats {
  return {
    team: 'enemy',
    maxHp,
    walkX: 0,
    walkZ: 0,
    halfWidth: 18,
    height: 72,
    hitstun: 14,
    score: 3000,
    basicAttack,
    seated: true,
  };
}

export function attackLength(def: AttackDef): number {
  return def.startup + def.active + def.recovery;
}
