/**
 * Game tuning — data only, no behavior.
 *
 * Player axes (do not mix when balancing):
 *   PLAYER_BODY  — collision / feet
 *   PLAYER_MOVE  — run / jump / gravity
 *   PLAYER_SWORD — melee reach & damage (independent of body size)
 *   PLAYER_DRAW  — presentation only
 */

export const GAME_VERSION = '1.2.300';
export const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
export const GAME_NAME = 'Ironvale';

export const W = 390;
export const H = 700;

export const PLAY = { left: 8, right: W - 8, top: 56, bottom: H - 110 };
export const PLAY_W = PLAY.right - PLAY.left;
export const PLAY_H = PLAY.bottom - PLAY.top;
export const GROUND_Y = PLAY.bottom - 18;

export const PLAYER_BODY = { w: 28, h: 48 };

export const PLAYER_MOVE = {
  runSpeed: 210,
  maxHp: 100,
  invuln: 0.65,
  gravity: 1550,
  jumpVel: -560,
  maxFall: 780,
  coyote: 0.12,
  jumpBuffer: 0.14,
  airControl: 0.9,
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
export const MAX_PLATFORMS = 48;

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
  minWidth: 96,
  maxWidth: 170,
};

export const ENEMIES = {
  slime:    { w: 26, h: 22, hp: 16, speed: 45, score: 8,  xp: 2, color: '#3d8b3d', damage: 10, skin: 'slime',    frames: 4, fw: 32, fh: 32 },
  bandit:   { w: 28, h: 42, hp: 28, speed: 70, score: 16, xp: 3, color: '#8b0000', damage: 14, skin: 'bandit',   frames: 4, fw: 40, fh: 48 },
  skeleton: { w: 26, h: 42, hp: 22, speed: 55, score: 14, xp: 3, color: '#c8c0a8', damage: 12, skin: 'skeleton', frames: 4, fw: 40, fh: 48 },
  ogre:     { w: 44, h: 48, hp: 90, speed: 32, score: 40, xp: 7, color: '#5a7a3a', damage: 22, skin: 'ogre',     frames: 4, fw: 56, fh: 56 },
  /** Generic late-game brute (legacy / Iron Gate). */
  boss:     { w: 52, h: 54, hp: 280, speed: 38, score: 200, xp: 25, color: '#5a7a3a', damage: 26, skin: 'ogre', frames: 4, fw: 56, fh: 56, isBoss: true },
  /** Outer Vale end boss — larger bandit, baseline difficulty. */
  bandit_captain: {
    w: 34, h: 48, hp: 140, speed: 58, score: 120, xp: 15,
    color: '#5c0a0a', damage: 18, skin: 'bandit', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.5, label: 'Bandit Captain',
  },
  /** Ruined Road end boss — elite skeleton, harder than captain. */
  skeleton_champion: {
    w: 32, h: 48, hp: 190, speed: 68, score: 150, xp: 18,
    color: '#e8e0c8', damage: 20, skin: 'skeleton', frames: 4, fw: 40, fh: 48,
    isBoss: true, drawScale: 1.55, label: 'Skeleton Champion',
  },
  /** Iron Gate end boss — first real wall; telegraphed slams. */
  ogre_warchief: {
    w: 54, h: 56, hp: 260, speed: 34, score: 220, xp: 28,
    color: '#2f4a14', damage: 24, skin: 'ogre', frames: 4, fw: 56, fh: 56,
    isBoss: true, drawScale: 1.75, label: 'Ogre War-Chief', hasSlam: true,
  },
};

/**
 * Telegraphed slam (war-chief / future slam bosses).
 * Windup shows telegraph; active frames deal damage once.
 */
export const BOSS_SLAM = {
  range: 78,
  windup: 0.58,
  active: 0.20,
  recover: 0.70,
  cooldown: 1.25,
  damageMul: 1.4,
  knockback: 300,
  aggroY: 55,
};

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
