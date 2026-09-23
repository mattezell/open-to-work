import { DEPTH, SCREEN_W } from './constants';
import { KINDS } from './fighters';
import { spawnFighter, type World } from './world';

/**
 * The Unpaid Take Home calls in scope creep: an ATS Bot each time its health
 * drops past two thirds and one third, the first from behind, the second from
 * ahead. One at a time, because two each left a first-time solo player dead
 * more often than not (JOURNAL, M4 difficulty entry).
 */
const REINFORCE_AT = [2 / 3, 1 / 3];
const ENTRY_OFFSET = 24;

export function callReinforcements(world: World): void {
  for (const boss of world.fighters.filter((f) => f.kind === 'takehome' && f.state !== 'dead')) {
    const maxHp = KINDS[boss.kind].maxHp;
    const due = REINFORCE_AT.filter((fraction) => boss.hp <= maxHp * fraction).length;
    while (boss.summons < due && boss.hp > 0) {
      boss.summons++;
      const fromLeft = boss.summons % 2 === 1;
      const x = fromLeft ? world.cameraX - ENTRY_OFFSET : world.cameraX + SCREEN_W + ENTRY_OFFSET;
      spawnFighter(world, 'ats', x, fromLeft ? DEPTH / 4 : (DEPTH * 3) / 4);
      world.events.push({ type: 'reinforcements', by: boss.id });
    }
  }
}
