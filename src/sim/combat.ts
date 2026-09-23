import { DEPTH_TOLERANCE } from './constants';
import { ATTACKS, chainFor, KINDS, type AttackDef } from './fighters';
import { setState } from './fighter-step';
import { FOCUS_DAMAGE_SCALE, guardInterceptor, noteKo } from './sidekick';
import type { Fighter, World } from './world';

const KNOCKDOWN_VX = 2.2;
const KNOCKDOWN_VY = 3;
const HIT_PUSHBACK = 3;

function isActive(f: Fighter, def: AttackDef): boolean {
  return f.attackTick >= def.startup && f.attackTick < def.startup + def.active;
}

function isVulnerable(f: Fighter): boolean {
  return f.invuln === 0 && f.state !== 'dead' && f.state !== 'knockdown' && f.state !== 'getup';
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
    if (!isActive(attacker, def)) continue;
    for (const target of world.fighters) {
      if (target.team === attacker.team || !isVulnerable(target)) continue;
      if (attacker.attackHits.includes(target.id) || !inReach(attacker, def, target)) continue;
      attacker.attackHits.push(target.id);
      const guard = attacker.team === 'enemy' ? guardInterceptor(world, target) : undefined;
      if (guard && !attacker.attackHits.includes(guard.id)) {
        // TOKEN steps in and takes it, at half damage.
        attacker.attackHits.push(guard.id);
        world.events.push({ type: 'intercept' });
        applyHit(world, attacker, def, guard, Math.ceil(def.damage / 2));
      } else {
        applyHit(world, attacker, def, target, damageFor(world, attacker, def, target));
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

function applyHit(
  world: World,
  attacker: Fighter,
  def: AttackDef,
  target: Fighter,
  damage: number,
): void {
  const chain = chainFor(attacker.kind);
  const chainIndex = chain?.indexOf(attacker.attack ?? 'jab1') ?? -1;
  if (chain && attacker.attackHits.length === 1 && chainIndex !== -1) {
    attacker.chain = (chainIndex + 1) % chain.length;
  }
  attacker.lastTarget = target.id;

  target.hp = Math.max(0, target.hp - damage);
  target.attack = null;
  const dir = target.x >= attacker.x ? 1 : -1;
  target.facing = dir === 1 ? -1 : 1;
  world.hitstop = Math.max(world.hitstop, def.hitstop);
  attacker.score += damage * 10;

  if (def.knockdown || target.hp === 0 || target.y > 0) {
    setState(target, 'knockdown');
    target.vx = KNOCKDOWN_VX * dir;
    target.vy = KNOCKDOWN_VY;
    target.y = Math.max(target.y, 0.01);
    if (target.hp === 0) {
      attacker.score += KINDS[target.kind].score;
      world.events.push({ type: 'ko', id: target.id, by: attacker.id });
      noteKo(world, target);
    }
  } else {
    setState(target, 'hurt');
    target.x += HIT_PUSHBACK * dir;
  }
}
