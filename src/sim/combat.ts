import { DEPTH_TOLERANCE } from './constants';
import { ATTACKS, CHAIN, KINDS, type AttackDef } from './fighters';
import { setState } from './fighter-step';
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
      applyHit(world, attacker, def, target);
    }
  }
}

function applyHit(world: World, attacker: Fighter, def: AttackDef, target: Fighter): void {
  attacker.attackHits.push(target.id);
  const chainIndex = CHAIN.indexOf(attacker.attack ?? 'jab1');
  if (attacker.attackHits.length === 1 && chainIndex !== -1) {
    attacker.chain = (chainIndex + 1) % CHAIN.length;
  }

  target.hp = Math.max(0, target.hp - def.damage);
  target.attack = null;
  const dir = target.x >= attacker.x ? 1 : -1;
  target.facing = dir === 1 ? -1 : 1;
  world.hitstop = Math.max(world.hitstop, def.hitstop);
  attacker.score += def.damage * 10;

  if (def.knockdown || target.hp === 0 || target.y > 0) {
    setState(target, 'knockdown');
    target.vx = KNOCKDOWN_VX * dir;
    target.vy = KNOCKDOWN_VY;
    target.y = Math.max(target.y, 0.01);
    if (target.hp === 0) attacker.score += KINDS[target.kind].score;
  } else {
    setState(target, 'hurt');
    target.x += HIT_PUSHBACK * dir;
  }
}
