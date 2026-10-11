/**
 * Domain: enemy projectiles (pure).
 * A projectile is a box centred on (x, y) that flies in a straight line. The caller owns the
 * list and applies damage; here they move, hit the knight, die on rock or out of bounds,
 * and can be cut down by the sword.
 */

import { ENEMY_PROJECTILES } from '../config/index.js';

/**
 * @param {string} kind - key of ENEMY_PROJECTILES
 * @param {{ x: number, y: number, vx: number, vy?: number, damage: number, owner?: string }} o
 */
export function makeProjectile(kind, o) {
  const cfg = ENEMY_PROJECTILES[kind];
  return {
    kind, x: o.x, y: o.y, vx: o.vx, vy: o.vy || 0, damage: o.damage,
    w: cfg.w, h: cfg.h, life: cfg.life, age: 0, owner: o.owner || null,
  };
}

function overlaps(p, box) {
  return p.x - p.w / 2 < box.x + box.w && p.x + p.w / 2 > box.x
    && p.y - p.h / 2 < box.y + box.h && p.y + p.h / 2 > box.y;
}

function inSolid(p, solids) {
  if (!solids) return false;
  for (const b of solids) {
    if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) return true;
  }
  return false;
}

/**
 * Move every projectile and remove the ones that end. Removed ones are returned as events:
 * { type: 'hit' | 'wall' | 'out' | 'expired', p }.
 * A projectile only hits when env.canHurt is true (the knight is not in i-frames); otherwise
 * it flies on through, so one fireball can never hurt twice in a row.
 * @param {object[]} list
 * @param {number} dt
 * @param {{ solids?: object[], bounds?: object, target?: {x:number,y:number,w:number,h:number}|null, canHurt?: boolean }} env
 */
export function tickProjectiles(list, dt, env) {
  const events = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    let end = null;
    // Small steps so a fast shot cannot skip through a thin wall or the knight.
    const dist = Math.hypot(p.vx, p.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 4));
    for (let k = 0; k < n && !end; k++) {
      p.x += p.vx * dt / n;
      p.y += p.vy * dt / n;
      const b = env.bounds;
      if (inSolid(p, env.solids)) end = 'wall';
      else if (b && (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY)) end = 'out';
      else if (env.canHurt && env.target && overlaps(p, env.target)) end = 'hit';
    }
    p.age += dt;
    if (!end && (p.life -= dt) <= 0) end = 'expired';
    if (end) {
      list.splice(i, 1);
      events.push({ type: end, p });
    }
  }
  return events;
}

/** Remove and return every projectile touching a box (the sword's swing). */
export function cutProjectiles(list, box) {
  const cut = [];
  if (!box) return cut;
  for (let i = list.length - 1; i >= 0; i--) {
    if (overlaps(list[i], box)) cut.push(list.splice(i, 1)[0]);
  }
  return cut;
}
