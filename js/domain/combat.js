/**
 * Domain: melee combat (pure).
 *
 * Body size (player.w/h) anchors blade root only.
 * Sword length comes only from swordCfg.attackRange / airAttackRange.
 */

export function combatAttackDuration(swordCfg, stats) {
  const rate = stats && stats.attackRate != null ? stats.attackRate : 1;
  return swordCfg.attackTime / Math.max(0.5, rate);
}

export function combatAttackCooldown(swordCfg, stats) {
  const rate = stats && stats.attackRate != null ? stats.attackRate : 1;
  return swordCfg.attackCooldown / Math.max(0.5, rate);
}

/**
 * Axis-aligned sword hitbox in world space.
 * @param {object} swordCfg - PLAYER_SWORD fields (+ attack times)
 */
export function getAttackBox(player, stats, swordCfg) {
  if (!player || !swordCfg) return null;
  const st = stats || { rangeMul: 1 };
  const dir = player.facing || 1;
  const air = !!(player.attackAir || (!player.onGround && player.attacking));
  const rm = st.rangeMul != null ? st.rangeMul : 1;
  const range = (air ? swordCfg.airAttackRange : swordCfg.attackRange) * rm;
  const height = air ? swordCfg.airAttackHeight : swordCfg.attackHeight;
  const originX = player.x + dir * (player.w * (swordCfg.attackOriginX != null ? swordCfg.attackOriginX : 0.35));
  const originY = player.y - player.h * (air ? 0.42 : 0.52);
  const x = dir > 0 ? originX : originX - range;
  const y = originY - height * 0.5 + (air ? 6 : 0);
  return { x, y, w: range, h: height, dir, air, originX, originY };
}

export function enemyOverlapsBox(enemy, box) {
  if (!enemy || !box) return false;
  const el = enemy.x - enemy.w * 0.45;
  const er = enemy.x + enemy.w * 0.45;
  const et = enemy.y - enemy.h;
  const eb = enemy.y;
  return box.x < er && box.x + box.w > el && box.y < eb && box.y + box.h > et;
}

export function beginMeleeAttack(player, stats, swordCfg) {
  if (!player || !swordCfg) return false;
  if (player.attackCd > 0 || player.attacking) return false;
  player.attacking = true;
  player.attackAir = !player.onGround;
  player.attackHitDone = false;
  player.attackT = combatAttackDuration(swordCfg, stats);
  player.attackCd = combatAttackCooldown(swordCfg, stats);
  return true;
}

export function tickMeleeAttack(player, dt, swordCfg, stats) {
  if (!player) return false;
  if (player.attackCd > 0) player.attackCd = Math.max(0, player.attackCd - dt);
  if (!player.attacking) return false;
  player.attackT -= dt;
  if (player.attackT <= 0) {
    player.attacking = false;
    player.attackAir = false;
    player.attackHitDone = false;
    player.attackT = 0;
    return false;
  }
  return true;
}

/**
 * Apply damage/knockback to overlapping enemies.
 * Does not remove entities — caller handles kills.
 */
export function resolveMeleeHits(player, enemies, stats, swordCfg) {
  const empty = { hitAny: false, hits: [] };
  if (!player || !player.attacking || player.attackHitDone) return empty;
  if (!enemies || !enemies.length || !swordCfg) return empty;
  const st = stats || { damage: swordCfg.attackDamage, rangeMul: 1 };
  const box = getAttackBox(player, st, swordCfg);
  if (!box) return empty;

  const kb = (swordCfg.attackKnockback != null ? swordCfg.attackKnockback : 200) * (player.attackAir ? 0.75 : 1);
  const damage = st.damage != null ? st.damage : swordCfg.attackDamage;
  const hits = [];

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!enemyOverlapsBox(e, box)) continue;
    e.hp -= damage;
    e.flash = 0.14;
    e.hitStun = 0.18;
    e.vx = box.dir * kb;
    e.vy = Math.min(e.vy, player.attackAir ? -80 : -40);
    hits.push({ enemy: e, index: i, killed: e.hp <= 0, box });
  }

  if (hits.length) player.attackHitDone = true;
  return { hitAny: hits.length > 0, hits, box };
}

export function hasMeleePriority(player, stats, swordCfg) {
  if (!player || !player.attacking || !swordCfg) return false;
  const full = combatAttackDuration(swordCfg, stats);
  return player.attackT > full * 0.45;
}

/** Collision / feet AABB — independent of sword. */
export function getPlayerBodyBox(player) {
  if (!player) return null;
  return {
    x: player.x - player.w / 2,
    y: player.y - player.h,
    w: player.w,
    h: player.h,
  };
}
