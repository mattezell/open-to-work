import { CHAIN_WINDOW_TICKS, GRAVITY } from './constants';
import {
  ATTACKS,
  JUMP_VELOCITY,
  chainFor,
  KINDS,
  SPECIAL_COST,
  attackLength,
  type AttackId,
} from './fighters';
import type { InputFrame } from './input';
import type { Fighter, FighterState } from './world';

const KNOCKDOWN_LIE_TICKS = 70;
const GETUP_TICKS = 24;
const GETUP_INVULN_TICKS = 40;

export function setState(f: Fighter, state: FighterState): void {
  f.state = state;
  f.stateTick = 0;
}

function startAttack(f: Fighter, id: AttackId): void {
  f.attack = id;
  f.attackTick = 0;
  f.attackHits = [];
  f.attackBuffer = 0;
  if (id !== 'jumpkick') setState(f, 'attack');
}

function groundAttack(f: Fighter): AttackId {
  const chain = chainFor(f.kind);
  return chain ? (chain[f.chain] ?? chain[0] ?? 'shred') : 'shred';
}

/** Advance one fighter's state machine from its controls for this tick. */
export function stepFighter(f: Fighter, now: InputFrame, before: InputFrame): void {
  f.stateTick++;
  if (f.invuln > 0) f.invuln--;
  if (f.cooldown > 0) f.cooldown--;
  if (f.chainTimer > 0) f.chainTimer--;
  else if (f.state !== 'attack') f.chain = 0;

  const attackPressed = f.attackBuffer > 0 || (now.attack && !before.attack);
  const stats = KINDS[f.kind];

  switch (f.state) {
    case 'idle':
    case 'walk': {
      if (f.kind === 'matt' && now.special && !before.special && f.hp > SPECIAL_COST) {
        f.hp -= SPECIAL_COST;
        startAttack(f, 'special');
        f.invuln = ATTACKS.special.startup + ATTACKS.special.active;
        return;
      }
      if (attackPressed) {
        startAttack(f, groundAttack(f));
        return;
      }
      const dx = (now.right ? 1 : 0) - (now.left ? 1 : 0);
      const dz = (now.down ? 1 : 0) - (now.up ? 1 : 0);
      if (f.kind === 'matt' && now.jump && !before.jump) {
        setState(f, 'jump');
        f.vy = JUMP_VELOCITY;
        f.vx = dx * stats.walkX * 1.1;
        if (dx !== 0) f.facing = dx > 0 ? 1 : -1;
        return;
      }
      if (dx !== 0) f.facing = dx > 0 ? 1 : -1;
      f.x += dx * stats.walkX;
      f.z += dz * stats.walkZ;
      const moving = dx !== 0 || dz !== 0;
      if (moving && f.state !== 'walk') setState(f, 'walk');
      else if (!moving && f.state !== 'idle') setState(f, 'idle');
      return;
    }

    case 'jump': {
      if (attackPressed && f.attack === null) startAttack(f, 'jumpkick');
      if (f.attack !== null) f.attackTick++;
      f.x += f.vx;
      f.y += f.vy;
      f.vy -= GRAVITY;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        f.vx = 0;
        f.attack = null;
        setState(f, 'idle');
      }
      return;
    }

    case 'attack': {
      f.attackTick++;
      const current = f.attack;
      if (current === null) {
        setState(f, 'idle');
        return;
      }
      const def = ATTACKS[current];
      const inRecovery = f.attackTick >= def.startup + def.active;
      const link = chainFor(f.kind)?.indexOf(current) ?? -1;
      const lastLink = (chainFor(f.kind)?.length ?? 0) - 1;
      const canChain = link !== -1 && link < lastLink && f.attackHits.length > 0;
      if (inRecovery && canChain && attackPressed) {
        startAttack(f, groundAttack(f));
        return;
      }
      if (f.attackTick >= attackLength(def)) {
        if (f.attackHits.length === 0) f.chain = 0;
        f.chainTimer = CHAIN_WINDOW_TICKS;
        f.attack = null;
        setState(f, 'idle');
      }
      return;
    }

    case 'hurt':
      if (f.stateTick >= stats.hitstun) setState(f, 'idle');
      return;

    case 'knockdown': {
      if (f.y > 0 || f.vy > 0) {
        f.x += f.vx;
        f.y += f.vy;
        f.vy -= GRAVITY;
        if (f.y <= 0) {
          f.y = 0;
          f.vy = 0;
          f.vx = 0;
        }
        return;
      }
      if (f.stateTick >= KNOCKDOWN_LIE_TICKS) {
        if (f.hp <= 0) setState(f, 'dead');
        else {
          setState(f, 'getup');
          f.invuln = GETUP_TICKS + GETUP_INVULN_TICKS;
        }
      }
      return;
    }

    case 'getup':
      if (f.stateTick >= GETUP_TICKS) setState(f, 'idle');
      return;

    case 'dead':
      return;
  }
}
