import { DEPTH_TOLERANCE } from './constants';
import { ATTACKS, chainFor, HEAVY_CHIP, KINDS, type AttackDef } from './fighters';
import { setState } from './fighter-step';
import { FOCUS_DAMAGE_SCALE, guardInterceptor, noteKo } from './sidekick';
import type { Fighter, World } from './world';

const KNOCKDOWN_VX = 2.2;
const KNOCKDOWN_VY = 3;
const HIT_PUSHBACK = 3;

function isActive(f: Fighter, def: AttackDef): boolean {
  return f.attackTick >= def.startup && f.attackTick < def.startup + def.active;
}

export function isVulnerable(f: Fighter): boolean {
  return (
    f.invuln === 0 &&
    f.ghost === 0 &&
    f.state !== 'dead' &&
    f.state !== 'knockdown' &&
    f.state !== 'getup'
  );
}

export function inReach(attacker: Fighter, def: AttackDef, target: Fighter): boolean {
  if (Math.abs(target.z - attacker.z) > DEPTH_TOLERANCE) return false;
  const halfWidth = KINDS[target.kind].halfWidth;
  const dx = target.x - attacker.x;
  if (def.omni) return Math.abs(dx) <= def.reach + halfWidth;
  const forward = dx * attacker.facing;
  return forward >= -halfWidth && forward <= def.reach + halfWidth;
}

/** Apply every live hitbox this tick. Each swing hits each target at most once. */
export function resolveHits(world: World): void {
  for (const attacker of world.fighters) {
    if (attacker.attack === null) continue;
    const def = ATTACKS[attacker.attack];
    if (def.projectile || !isActive(attacker, def)) continue;
    for (const target of world.fighters) {
      if (target.team === attacker.team || !isVulnerable(target)) continue;
      if (attacker.attackHits.includes(target.id) || !inReach(attacker, def, target)) continue;
      attacker.attackHits.push(target.id);
      const guard = attacker.team === 'enemy' ? guardInterceptor(world, target) : undefined;
      if (guard && !attacker.attackHits.includes(guard.id)) {
        attacker.attackHits.push(guard.id);
        interceptHit(world, attacker, def, guard, attacker.x);
      } else {
        applyHit(world, attacker, def, target, damageFor(world, attacker, def, target), attacker.x);
      }
    }
  }
}

/** Focus doubles TOKEN's damage on whatever Matt last hit. */
function damageFor(world: World, attacker: Fighter, def: AttackDef, target: Fighter): number {
  if (attacker.kind !== 'token' || world.directive !== 'focus') return def.damage;
  const focused = world.fighters.some((f) => f.pilot === 'human' && f.lastTarget === target.id);
  return focused ? def.damage * FOCUS_DAMAGE_SCALE : def.damage;
}

/** TOKEN steps in front of a hit meant for Matt and takes it, at half damage. */
export function interceptHit(
  world: World,
  attacker: Fighter | undefined,
  def: AttackDef,
  guard: Fighter,
  fromX: number,
): void {
  world.events.push({ type: 'intercept' });
  applyHit(world, attacker, def, guard, Math.ceil(def.damage / 2), fromX);
}

/**
 * Land a hit. `fromX` is where it came from, which sets the knockback
 * direction; for a thrown card that is the card, not the thrower. The
 * attacker may be undefined when a projectile outlives its thrower.
 */
export function applyHit(
  world: World,
  attacker: Fighter | undefined,
  def: AttackDef,
  target: Fighter,
  damage: number,
  fromX: number,
): void {
  const stats = KINDS[target.kind];
  // A heavy shrugs off anything that would not knock a person down.
  const shrugged = stats.heavy === true && !def.knockdown;
  const dealt = shrugged ? Math.min(damage, HEAVY_CHIP) : damage;
  if (attacker) creditAttacker(attacker, target, dealt);
  target.hp = Math.max(0, target.hp - dealt);
  world.hitstop = Math.max(world.hitstop, def.hitstop);
  const dir = target.x >= fromX ? 1 : -1;

  // Armor: a heavy mid-swing takes the damage and keeps swinging.
  const armored = stats.armored && target.state === 'attack' && target.hp > 0;
  if (armored || (shrugged && target.hp > 0)) return;

  target.attack = null;
  target.facing = dir === 1 ? -1 : 1;

  if (def.knockdown || target.hp === 0 || target.y > 0) {
    setState(target, 'knockdown');
    // A seated panelist slumps at the desk instead of flying out of the chair.
    if (!stats.seated) {
      target.vx = KNOCKDOWN_VX * dir;
      target.vy = KNOCKDOWN_VY;
      target.y = Math.max(target.y, 0.01);
    }
    if (target.hp === 0) {
      if (attacker) attacker.score += KINDS[target.kind].score;
      world.events.push({ type: 'ko', id: target.id, by: attacker?.id ?? 0 });
      noteKo(world, target);
    }
  } else {
    setState(target, 'hurt');
    if (!stats.seated) target.x += HIT_PUSHBACK * dir;
  }
}

function creditAttacker(attacker: Fighter, target: Fighter, damage: number): void {
  const chain = chainFor(attacker.kind);
  const chainIndex = chain?.indexOf(attacker.attack ?? 'jab1') ?? -1;
  if (chain && attacker.attackHits.length === 1 && chainIndex !== -1) {
    attacker.chain = (chainIndex + 1) % chain.length;
  }
  attacker.lastTarget = target.id;
  attacker.score += damage * 10;
}
