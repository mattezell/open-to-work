import { DEPTH_TOLERANCE, SCREEN_W } from './constants';
import { ATTACKS, KINDS, PROJECTILES } from './fighters';
import { applyHit, interceptHit, isVulnerable } from './combat';
import { guardInterceptor } from './sidekick';
import type { Fighter, Projectile, World } from './world';

/** How far past the screen edge a projectile flies before it is gone. */
const OFFSCREEN_SLACK = 24;
/** A thrown card leaves the hand this far in front of the thrower. */
const LAUNCH_OFFSET = 14;

/** Throwers release on the first active tick of their throw. */
export function launchProjectiles(world: World): void {
  for (const f of world.fighters) {
    if (f.state !== 'attack' || f.attack === null) continue;
    const def = ATTACKS[f.attack];
    if (!def.projectile || f.attackTick !== def.startup) continue;
    world.projectiles.push({
      id: world.nextId++,
      kind: def.projectile,
      ownerId: f.id,
      team: f.team,
      x: f.x + f.facing * LAUNCH_OFFSET,
      z: f.z,
      vx: f.facing * PROJECTILES[def.projectile].speed,
    });
  }
}

function strikes(p: Projectile, target: Fighter): boolean {
  const def = PROJECTILES[p.kind];
  if (target.team === p.team || !isVulnerable(target)) return false;
  if (target.y > def.clearance) return false;
  if (!def.wide && Math.abs(target.z - p.z) > DEPTH_TOLERANCE) return false;
  return Math.abs(target.x - p.x) <= KINDS[target.kind].halfWidth + Math.abs(p.vx);
}

/** Move every projectile, land the first one to reach a fighter, drop the ones that left. */
export function stepProjectiles(world: World): void {
  world.projectiles = world.projectiles.filter((p) => {
    p.x += p.vx;
    const target = world.fighters.find((f) => strikes(p, f));
    if (target) {
      const def = ATTACKS[PROJECTILES[p.kind].hit];
      const owner = world.fighters.find((f) => f.id === p.ownerId);
      const guard = p.team === 'enemy' ? guardInterceptor(world, target) : undefined;
      if (guard) interceptHit(world, owner, def, guard, p.x);
      else applyHit(world, owner, def, target, def.damage, p.x);
      return false;
    }
    return (
      p.x > world.cameraX - OFFSCREEN_SLACK && p.x < world.cameraX + SCREEN_W + OFFSCREEN_SLACK
    );
  });
}
