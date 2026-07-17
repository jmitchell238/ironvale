'use strict';
// Ironvale — medieval 2D platformer tuning

const GAME_VERSION = '1.0.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Ironvale';

const W = 390;
const H = 700;

const PLAY = { left: 8, right: W - 8, top: 56, bottom: H - 110 };
const PLAY_W = PLAY.right - PLAY.left;
const PLAY_H = PLAY.bottom - PLAY.top;
const GROUND_Y = PLAY.bottom - 18;

const PLAYER = {
  w: 28,
  h: 48,
  runSpeed: 210,
  maxHp: 100,
  invuln: 0.65,
  gravity: 1550,
  jumpVel: -560,
  maxFall: 780,
  coyote: 0.12,
  jumpBuffer: 0.14,
  airControl: 0.9,
  attackTime: 0.32,
  attackCooldown: 0.38,
  attackRange: 48,
  attackDamage: 18,
};

const CAM = { focusX: W * 0.32, lerp: 6 };

const MAX_ENEMIES = 40;
const MAX_COINS = 80;
const MAX_PARTICLES = 160;
const MAX_PLATFORMS = 48;

function xpForLevel(level) {
  return Math.floor(10 + level * 7 + level * level * 1.2);
}

function maxJumpHeight(jumpMul) {
  const v = Math.abs(PLAYER.jumpVel) * (jumpMul || 1);
  return (v * v) / (2 * PLAYER.gravity);
}
function maxJumpAirTime(jumpMul) {
  const v = Math.abs(PLAYER.jumpVel) * (jumpMul || 1);
  return (2 * v) / PLAYER.gravity;
}
function maxJumpDistance(jumpMul, speedMul) {
  return PLAYER.runSpeed * (speedMul || 1) * maxJumpAirTime(jumpMul);
}

const JUMP_SAFE = {
  riseFrac: 0.62,
  gapFracSame: 0.62,
  gapFracUp: 0.48,
  gapFracDown: 0.78,
  maxDrop: 140,
  minGap: 18,
  minWidth: 96,
  maxWidth: 170,
};

const ENEMIES = {
  slime:    { w: 26, h: 22, hp: 16, speed: 45, score: 8,  xp: 2, color: '#3d8b3d', damage: 10, skin: 'slime',    frames: 4, fw: 32, fh: 32 },
  bandit:   { w: 28, h: 42, hp: 28, speed: 70, score: 16, xp: 3, color: '#8b0000', damage: 14, skin: 'bandit',   frames: 4, fw: 40, fh: 48 },
  skeleton: { w: 26, h: 42, hp: 22, speed: 55, score: 14, xp: 3, color: '#c8c0a8', damage: 12, skin: 'skeleton', frames: 4, fw: 40, fh: 48 },
  ogre:     { w: 44, h: 48, hp: 90, speed: 32, score: 40, xp: 7, color: '#5a7a3a', damage: 22, skin: 'ogre',     frames: 4, fw: 56, fh: 56 },
  boss:     { w: 52, h: 54, hp: 280, speed: 38, score: 200, xp: 25, color: '#5a7a3a', damage: 26, skin: 'ogre', frames: 4, fw: 56, fh: 56 },
};

const UPGRADES = [
  { id: 'dmg',   name: 'Sharper Steel', desc: '+20% sword damage',   icon: '⚔', stack: true },
  { id: 'rate',  name: 'Quick Slash',   desc: '+15% attack speed',   icon: '⚡', stack: true },
  { id: 'speed', name: 'Swift Boots',   desc: '+12% run speed',      icon: '➤', stack: true },
  { id: 'hp',    name: 'Chain Mail',    desc: '+25 max HP & heal 25', icon: '♥', stack: true },
  { id: 'jump',  name: 'Spring Greaves',desc: '+12% jump height',    icon: '⇧', stack: true, max: 4 },
  { id: 'range', name: 'Longsword',     desc: '+20% attack reach',   icon: '≡', stack: true, max: 3 },
  { id: 'heal',  name: 'Healing Herb',  desc: 'Restore 40 HP',       icon: '+', stack: false },
];

const WAVE = {
  baseInterval: 1.5,
  minInterval: 0.45,
  ramp: 0.035,
  baseCount: 3,
  countRamp: 0.5,
  bossEvery: 5,
};
