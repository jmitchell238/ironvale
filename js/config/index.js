/**
 * Game tuning — data only, no behavior.
 *
 * Player axes (do not mix when balancing):
 *   PLAYER_BODY  — collision / feet
 *   PLAYER_MOVE  — run / jump / gravity
 *   PLAYER_SWORD — melee reach & damage (independent of body size)
 *   PLAYER_DRAW  — presentation only
 */

export const GAME_VERSION = '1.4.101';
export const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
export const GAME_NAME = 'Ironvale';

export const W = 390;
export const H = 700;

export const PLAY = { left: 8, right: W - 8, top: 56, bottom: H - 110 };
export const PLAY_W = PLAY.right - PLAY.left;
export const PLAY_H = PLAY.bottom - PLAY.top;
export const GROUND_Y = PLAY.bottom - 18;

export const PLAYER_BODY = { w: 28, h: 48, duckH: 28 };

export const PLAYER_MOVE = {
  runSpeed: 210,
  maxHp: 100,
  invuln: 0.65,
  gravity: 1550,
  jumpVel: -560,
  /** Second jump while airborne (slightly softer than first). */
  doubleJumpVel: -480,
  maxFall: 780,
  coyote: 0.12,
  jumpBuffer: 0.14,
  airControl: 0.9,
  /** Hold down on ground to duck (smaller hitbox). */
  duckThreshold: 0.55,
  duckSpeedMul: 0.45,
  maxAirJumps: 1,
};

/** Keep spawns from materializing on the player's face. */
export const SPAWN_SAFE = {
  /** Min horizontal distance ahead of player for new spawns. */
  minAhead: 200,
  /** Extra random lead past minAhead. */
  leadJitter: 90,
  /** No aggro / attack while grace remains. */
  grace: 1.05,
  /** First melee windup delay after grace. */
  firstAttackCd: 0.85,
};

export const PLAYER_SWORD = {
  attackTime: 0.34,
  attackCooldown: 0.36,
  attackRange: 78,
  attackHeight: 40,
  attackOriginX: 0.35,
  attackDamage: 20,
  attackKnockback: 220,
  airAttackRange: 70,
  airAttackHeight: 48,
};

export const PLAYER_DRAW = { drawScale: 1.35 };

/** Convenience merge for systems that need several axes. */
export const PLAYER = {
  ...PLAYER_BODY,
  ...PLAYER_MOVE,
  ...PLAYER_SWORD,
  ...PLAYER_DRAW,
};

export const CAM = { focusX: W * 0.32, lerp: 6 };

export const MAX_ENEMIES = 40;
export const MAX_COINS = 80;
export const MAX_PARTICLES = 160;

export function xpForLevel(level) {
  return Math.floor(10 + level * 7 + level * level * 1.2);
}

export function maxJumpHeight(jumpMul = 1) {
  const v = Math.abs(PLAYER_MOVE.jumpVel) * jumpMul;
  return (v * v) / (2 * PLAYER_MOVE.gravity);
}

export function maxJumpAirTime(jumpMul = 1) {
  const v = Math.abs(PLAYER_MOVE.jumpVel) * jumpMul;
  return (2 * v) / PLAYER_MOVE.gravity;
}

export function maxJumpDistance(jumpMul = 1, speedMul = 1) {
  return PLAYER_MOVE.runSpeed * speedMul * maxJumpAirTime(jumpMul);
}

export const JUMP_SAFE = {
  riseFrac: 0.62,
  gapFracSame: 0.62,
  gapFracUp: 0.48,
  gapFracDown: 0.78,
  maxDrop: 140,
  minGap: 18,
  /** Authored platforms may be narrower (Mario-style steps). */
  minWidth: 56,
  maxWidth: 200,
  /** Floor for procedural generation only. */
  procMinWidth: 96,
};

export const MAX_PLATFORMS = 64;

export const ENEMIES = {
  /** Contact-only fodder (no telegraph). */
  slime:    { w: 26, h: 22, hp: 16, speed: 45, score: 8,  xp: 2, color: '#3d8b3d', damage: 10, skin: 'slime',    frames: 4, fw: 32, fh: 32 },
  bandit:   { w: 28, h: 42, hp: 28, speed: 70, score: 16, xp: 3, color: '#8b0000', damage: 14, skin: 'bandit',   frames: 4, fw: 40, fh: 48, hasMelee: true },
  skeleton: { w: 26, h: 42, hp: 22, speed: 55, score: 14, xp: 3, color: '#c8c0a8', damage: 12, skin: 'skeleton', frames: 4, fw: 40, fh: 48, hasMelee: true },
  ogre:     { w: 44, h: 48, hp: 90, speed: 32, score: 40, xp: 7, color: '#5a7a3a', damage: 22, skin: 'ogre',     frames: 4, fw: 56, fh: 56, hasMelee: true },
  /** Generic late-game brute (legacy / Iron Gate). */
  boss:     { w: 52, h: 54, hp: 280, speed: 38, score: 200, xp: 25, color: '#5a7a3a', damage: 26, skin: 'ogre', frames: 4, fw: 56, fh: 56, isBoss: true, hasMelee: true, hasSlam: true },
  /** Outer Vale end boss — larger bandit, baseline difficulty. */
  bandit_captain: {
    w: 34, h: 48, hp: 140, speed: 58, score: 120, xp: 15,
    color: '#5c0a0a', damage: 18, skin: 'bandit', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.5, label: 'Bandit Captain', hasMelee: true,
  },
  /** Ruined Road end boss — elite skeleton, harder than captain. */
  skeleton_champion: {
    w: 32, h: 48, hp: 190, speed: 68, score: 150, xp: 18,
    color: '#e8e0c8', damage: 20, skin: 'skeleton', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.55, label: 'Skeleton Champion', hasMelee: true,
  },
  /** Iron Gate end boss — first real wall; heavy telegraphed slams. */
  ogre_warchief: {
    w: 54, h: 56, hp: 260, speed: 34, score: 220, xp: 28,
    color: '#2f4a14', damage: 24, skin: 'ogre', frames: 4, fw: 56, fh: 56,
    isBoss: true, drawScale: 1.75, label: 'Ogre War-Chief', hasMelee: true, hasSlam: true,
  },
  /** L4 Mistwood — aggressive bandit pack leader. */
  bandit_lord: {
    w: 36, h: 48, hp: 175, speed: 64, score: 140, xp: 17,
    color: '#4a0808', damage: 19, skin: 'bandit', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.55, label: 'Bandit Lord', hasMelee: true,
  },
  /** L5 Broken Bridge — fleet skeleton elite. */
  bone_reaver: {
    w: 32, h: 48, hp: 210, speed: 74, score: 165, xp: 20,
    color: '#d8d0b0', damage: 21, skin: 'skeleton', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.58, label: 'Bone Reaver', hasMelee: true,
  },
  /** L6 Bone Crypt — tanky crypt guardian. */
  crypt_guardian: {
    w: 34, h: 50, hp: 250, speed: 52, score: 190, xp: 23,
    color: '#b8b090', damage: 22, skin: 'skeleton', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.65, label: 'Crypt Guardian', hasMelee: true,
  },
  /** L7 Ashen Causeway — flaming-themed ogre elite. */
  ash_brute: {
    w: 54, h: 56, hp: 300, speed: 36, score: 240, xp: 30,
    color: '#4a2a10', damage: 26, skin: 'ogre', frames: 4, fw: 56, fh: 56,
    isBoss: true, drawScale: 1.78, label: 'Ash Brute', hasMelee: true, hasSlam: true,
  },
  /** L8 Barracks Yard — dual-threat captain. */
  barracks_captain: {
    w: 38, h: 50, hp: 280, speed: 62, score: 210, xp: 26,
    color: '#3a0a0a', damage: 23, skin: 'bandit', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.62, label: 'Barracks Captain', hasMelee: true,
  },
  /** L9 Castle Approach — iron sentinel. */
  iron_sentinel: {
    w: 56, h: 58, hp: 340, speed: 38, score: 280, xp: 34,
    color: '#1f3010', damage: 28, skin: 'ogre', frames: 4, fw: 56, fh: 56,
    isBoss: true, drawScale: 1.82, label: 'Iron Sentinel', hasMelee: true, hasSlam: true,
  },
  /** L10 Ironvale Keep — campaign final boss. */
  iron_lord: {
    w: 58, h: 60, hp: 420, speed: 42, score: 400, xp: 50,
    color: '#1a2808', damage: 30, skin: 'ogre', frames: 4, fw: 56, fh: 56,
    isBoss: true, drawScale: 1.9, label: 'Iron Lord', hasMelee: true, hasSlam: true,
  },
};

/** New Game+ enemy scaling per cycle. */
export const NG_PLUS = {
  hpPerCycle: 0.35,
  damagePerCycle: 0.15,
  scorePerCycle: 0.10,
};

/** Juice / feel tuning. */
export const JUICE = {
  hitstopLight: 0.045,
  hitstopHeavy: 0.075,
  hitstopBoss: 0.11,
  killBurstN: 16,
  bossKillBurstN: 40,
};

/**
 * Per-type telegraphed melee (Castlevania-style windups).
 * Windup shows telegraph; active frames deal damage once; no contact-only hurt.
 * Slimes intentionally omit a profile (contact damage only).
 *
 * Keys: range, windup, active, recover, cooldown, damageMul, knockback, aggroY
 * Optional: heavy (visual weight for telegraph).
 */
export const ENEMY_MELEE = {
  bandit: {
    range: 48, windup: 0.30, active: 0.12, recover: 0.38, cooldown: 0.80,
    damageMul: 1.0, knockback: 170, aggroY: 48,
  },
  skeleton: {
    range: 46, windup: 0.28, active: 0.12, recover: 0.36, cooldown: 0.85,
    damageMul: 1.0, knockback: 155, aggroY: 48,
  },
  ogre: {
    range: 60, windup: 0.48, active: 0.16, recover: 0.58, cooldown: 1.10,
    damageMul: 1.15, knockback: 250, aggroY: 55, heavy: true,
  },
  bandit_captain: {
    range: 56, windup: 0.34, active: 0.14, recover: 0.42, cooldown: 0.70,
    damageMul: 1.15, knockback: 210, aggroY: 52,
  },
  bandit_lord: {
    range: 58, windup: 0.32, active: 0.14, recover: 0.40, cooldown: 0.65,
    damageMul: 1.2, knockback: 220, aggroY: 52,
  },
  barracks_captain: {
    range: 60, windup: 0.30, active: 0.14, recover: 0.38, cooldown: 0.60,
    damageMul: 1.25, knockback: 230, aggroY: 52,
  },
  skeleton_champion: {
    range: 54, windup: 0.32, active: 0.14, recover: 0.40, cooldown: 0.68,
    damageMul: 1.2, knockback: 220, aggroY: 52,
  },
  bone_reaver: {
    range: 56, windup: 0.28, active: 0.14, recover: 0.36, cooldown: 0.62,
    damageMul: 1.25, knockback: 230, aggroY: 52,
  },
  crypt_guardian: {
    range: 58, windup: 0.36, active: 0.16, recover: 0.44, cooldown: 0.72,
    damageMul: 1.3, knockback: 240, aggroY: 54, heavy: true,
  },
  /** Heavy slam — long windup, big hit. */
  ogre_warchief: {
    range: 78, windup: 0.58, active: 0.20, recover: 0.70, cooldown: 1.25,
    damageMul: 1.4, knockback: 300, aggroY: 55, heavy: true,
  },
  ash_brute: {
    range: 80, windup: 0.55, active: 0.20, recover: 0.68, cooldown: 1.20,
    damageMul: 1.45, knockback: 310, aggroY: 55, heavy: true,
  },
  iron_sentinel: {
    range: 82, windup: 0.56, active: 0.22, recover: 0.72, cooldown: 1.18,
    damageMul: 1.5, knockback: 320, aggroY: 56, heavy: true,
  },
  iron_lord: {
    range: 86, windup: 0.52, active: 0.22, recover: 0.65, cooldown: 1.05,
    damageMul: 1.55, knockback: 340, aggroY: 58, heavy: true,
  },
  boss: {
    range: 78, windup: 0.58, active: 0.20, recover: 0.70, cooldown: 1.25,
    damageMul: 1.4, knockback: 300, aggroY: 55, heavy: true,
  },
};

/**
 * Telegraphed slam profile (war-chief / heavy bosses).
 * Alias of ENEMY_MELEE.ogre_warchief for callers that still pass BOSS_SLAM.
 */
export const BOSS_SLAM = ENEMY_MELEE.ogre_warchief;

/**
 * Resolve melee telegraph timings for an enemy type or entity.
 * @returns {object|null} ENEMY_MELEE profile, or null for contact-only foes
 */
export function getEnemyMeleeCfg(typeOrEnemy) {
  if (!typeOrEnemy) return null;
  let type = typeOrEnemy;
  let flags = null;
  if (typeof typeOrEnemy === 'object') {
    flags = typeOrEnemy;
    type = typeOrEnemy.type;
    if (typeOrEnemy.meleeCfg) return typeOrEnemy.meleeCfg;
  }
  if (type && ENEMY_MELEE[type]) return ENEMY_MELEE[type];
  if (flags && (flags.hasSlam || flags.hasMelee)) {
    return flags.hasSlam ? ENEMY_MELEE.ogre_warchief : ENEMY_MELEE.bandit;
  }
  const def = type ? ENEMIES[type] : null;
  if (def && (def.hasSlam || def.hasMelee)) {
    if (def.hasSlam) return ENEMY_MELEE.ogre_warchief;
    return ENEMY_MELEE.bandit;
  }
  return null;
}

/** True for stage bosses (clears level on death). */
export function enemyIsBoss(typeOrEnemy) {
  if (!typeOrEnemy) return false;
  if (typeof typeOrEnemy === 'object') {
    if (typeOrEnemy.isBoss) return true;
    typeOrEnemy = typeOrEnemy.type;
  }
  const def = ENEMIES[typeOrEnemy];
  return !!(def && def.isBoss) || typeOrEnemy === 'boss';
}

export const UPGRADES = [
  { id: 'dmg',   name: 'Sharper Steel', desc: '+20% sword damage',   icon: '⚔', stack: true },
  { id: 'rate',  name: 'Quick Slash',   desc: '+15% attack speed',   icon: '⚡', stack: true },
  { id: 'speed', name: 'Swift Boots',   desc: '+12% run speed',      icon: '➤', stack: true },
  { id: 'hp',    name: 'Chain Mail',    desc: '+25 max HP & heal 25', icon: '♥', stack: true },
  { id: 'jump',  name: 'Spring Greaves',desc: '+12% jump height',    icon: '⇧', stack: true, max: 4 },
  { id: 'range', name: 'Longsword',     desc: '+20% attack reach',   icon: '≡', stack: true, max: 3 },
  { id: 'heal',  name: 'Healing Herb',  desc: 'Restore 40 HP',       icon: '+', stack: false },
];

export const WAVE = {
  baseInterval: 1.5,
  minInterval: 0.45,
  ramp: 0.035,
  baseCount: 3,
  countRamp: 0.5,
  bossEvery: 5,
};

export const ENEMY_AI = {
  aggroX: 200,
  aggroY: 90,
  ledgeMargin: 10,
  lookAhead: 14,
  patrolHalf: 56,
  patrolSpeedMul: 0.55,
  fallKillY: PLAY.bottom + 70,
  hitStunDecay: 0.92,
};
