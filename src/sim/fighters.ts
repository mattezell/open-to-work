export type Team = 'player' | 'enemy';
export type FighterKind = 'matt' | 'token' | 'ats';
export type AttackId =
  'jab1' | 'jab2' | 'haymaker' | 'jumpkick' | 'special' | 'zap1' | 'zap2' | 'shred';

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
}

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
  },
};

export function attackLength(def: AttackDef): number {
  return def.startup + def.active + def.recovery;
}
