/**
 * Game tuning — data only, no behavior.
 *
 * Player axes (do not mix when balancing):
 *   PLAYER_BODY  — collision / feet
 *   PLAYER_MOVE  — run / jump / gravity
 *   PLAYER_SWORD — melee reach & damage (independent of body size)
 *   PLAYER_DRAW  — presentation only
 */

export const GAME_VERSION = '2.0.100';
export const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
export const GAME_NAME = 'Ironvale';
export const GAME_TAGLINE = 'Small knight. A greater tomorrow.';

export const W = 960;
export const H = 540;

/** Screen-space chrome insets (HUD / touch). World geometry uses level bounds. */
export const PLAY = { left: 8, right: W - 8, top: 52, bottom: H - 64 };
export const PLAY_W = PLAY.right - PLAY.left;
export const PLAY_H = PLAY.bottom - PLAY.top;
/** Default world-space floor (lowest Forgegate terrace). Not screen-space. */
export const GROUND_Y = 1100;

/** HP represented by each HUD heart. 100 max HP → 4 hearts. */
export const HEART = 25;

export const CLIMB = {
  speed: 150,
  grabIy: 0.35,
  snapSpeed: 260,
};

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

export const PLAYER_DRAW = { drawScale: 1.28 };

/** Convenience merge for systems that need several axes. */
export const PLAYER = {
  ...PLAYER_BODY,
  ...PLAYER_MOVE,
  ...PLAYER_SWORD,
  ...PLAYER_DRAW,
};

export const CAM = {
  focusX: W * 0.34,
  focusY: H * 0.62,
  lerp: 6,
  lerpY: 4.2,
};

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
  /** Fast pack melee — Forgegate Fields. */
  goblin: {
    w: 28, h: 42, hp: 26, speed: 78, score: 16, xp: 3,
    color: '#3d8b3d', damage: 14, skin: 'goblin', frames: 4, fw: 48, fh: 56,
    hasMelee: true,
  },
  /** Flying contact fodder. */
  bat: {
    w: 28, h: 22, hp: 14, speed: 70, score: 10, xp: 2,
    color: '#5a3a7a', damage: 10, skin: 'bat', frames: 4, fw: 48, fh: 40,
    fly: true,
  },
  /** Patrols ruins; blocks sword from the front until it swings. */
  shield_skeleton: {
    w: 28, h: 46, hp: 34, speed: 48, score: 20, xp: 4,
    color: '#c8c0a8', damage: 14, skin: 'skeleton', frames: 4, fw: 48, fh: 56,
    hasMelee: true, blockFront: true,
  },
  /** Campaign finale — Iron Caverns. */
  iron_warden: {
    w: 72, h: 88, hp: 420, speed: 36, score: 400, xp: 50,
    color: '#6a5a48', damage: 28, skin: 'warden', frames: 4, fw: 96, fh: 112,
    isBoss: true, drawScale: 1.35, label: 'The Iron Warden',
    hasMelee: true, hasSlam: true,
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
  goblin: {
    range: 46, windup: 0.28, active: 0.12, recover: 0.34, cooldown: 0.78,
    damageMul: 1.0, knockback: 170, aggroY: 48,
  },
  shield_skeleton: {
    range: 50, windup: 0.36, active: 0.14, recover: 0.42, cooldown: 0.90,
    damageMul: 1.05, knockback: 180, aggroY: 52,
  },
  iron_warden: {
    range: 88, windup: 0.62, active: 0.22, recover: 0.72, cooldown: 1.20,
    damageMul: 1.5, knockback: 340, aggroY: 70, heavy: true,
  },
};

/** Heavy slam profile (Iron Warden). */
export const BOSS_SLAM = ENEMY_MELEE.iron_warden;

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
    return flags.hasSlam ? ENEMY_MELEE.iron_warden : ENEMY_MELEE.goblin;
  }
  const def = type ? ENEMIES[type] : null;
  if (def && (def.hasSlam || def.hasMelee)) {
    if (def.hasSlam) return ENEMY_MELEE.iron_warden;
    return ENEMY_MELEE.goblin;
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
  fallKillY: GROUND_Y + 420,
  hitStunDecay: 0.92,
};
