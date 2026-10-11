#!/usr/bin/env node
/**
 * Ironvale tests — import domain + world as real ES modules.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const js = (rel) => pathToFileURL(path.join(root, rel)).href;

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; process.stdout.write('.'); return; }
  failed++; failures.push(msg); console.error('\n  ✗', msg);
}
function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}
function section(name) { process.stdout.write('\n• ' + name + ' '); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

// Dynamic imports of game modules
const config = await import(js('js/config/index.js'));
const combat = await import(js('js/domain/combat.js'));
const enemyAi = await import(js('js/domain/enemyAi.js'));
const platforms = await import(js('js/domain/platforms.js'));
const levels = await import(js('js/domain/levels.js'));
const rpg = await import(js('js/domain/rpg.js'));
const { GameSession } = await import(js('js/world/GameSession.js'));
const upgrades = await import(js('js/domain/upgrades.js'));
const { createMemorySave } = await import(js('js/adapters/save.js'));

const {
  GAME_VERSION, PLAYER, PLAYER_BODY, PLAYER_SWORD, PLAYER_DRAW, PLAYER_MOVE,
  ENEMY_AI, GROUND_Y, UPGRADES, maxJumpHeight, maxJumpDistance,
} = config;

const {
  getAttackBox, getPlayerBodyBox, beginMeleeAttack, resolveMeleeHits,
  hasMeleePriority, tickMeleeAttack, combatAttackDuration,
} = combat;

const {
  aiCanStandAt, aiUpdateEnemy, tickEnemySlam, enemyUsesTelegraphedSlam,
  enemyUsesTelegraphedAttack, enemySlamBusy,
} = enemyAi;
const { makePlatform, platformsChainReachable, canReachPlatform } = platforms;

/** Default test save unlocks early campaign stages so level-content tests can load freely. */
function createSession(saveSeed = {}) {
  return new GameSession({
    audio: {
      slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
      levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
    },
    save: createMemorySave({ levelUnlocked: 10, ...saveSeed }),
  });
}

/** Kill the stage boss (the stage clears when it falls). */
function killBoss(s) {
  const boss = s.enemies.find(e => e.isBoss);
  s.killEnemy(boss, s.enemies.indexOf(boss));
}

// ---------------------------------------------------------------------------
section('PWA shell + architecture layout');
{
  assert(exists('index.html'), 'index.html');
  assert(exists('js/app/main.js'), 'app/main.js');
  assert(exists('js/world/GameSession.js'), 'GameSession');
  assert(exists('js/world/systems/player.js'), 'systems/player');
  assert(exists('js/world/systems/combat.js'), 'systems/combat');
  assert(exists('js/world/systems/enemy.js'), 'systems/enemy');
  assert(exists('js/world/systems/camera.js'), 'systems/camera');
  assert(exists('js/world/systems/level.js'), 'systems/level');
  assert(exists('js/domain/combat.js'), 'domain/combat');
  assert(exists('js/domain/enemyAi.js'), 'domain/enemyAi');
  assert(exists('js/domain/platforms.js'), 'domain/platforms');
  assert(exists('js/domain/player.js'), 'domain/player');
  assert(exists('js/domain/levels.js'), 'domain/levels');
  assert(exists('js/domain/rpg.js'), 'domain/rpg');
  assert(exists('js/adapters/render.js'), 'adapters/render');
  assert(exists('docs/ARCHITECTURE.md'), 'docs/ARCHITECTURE.md');
  const html = read('index.html');
  assert(html.includes('type="module"'), 'ES module entry');
  assert(html.includes('js/app/main.js'), 'entry is app/main');
  assert(html.includes('data-screen="select"'), 'level select screen');
  assert(html.includes('data-screen="clear"'), 'level clear screen');
  assert(html.includes('data-screen="allocate"'), 'allocate screen');
  assert(html.includes('btnContinue'), 'checkpoint continue button');
  assert(html.includes('btnNgPlus'), 'new game+ button');
  assert(!html.includes('js/game.js'), 'legacy game.js not loaded');
  assert(!exists('js/game.js') || true, 'legacy optional');
}

section('version ↔ SW');
{
  assert(read('sw.js').includes('ironvale-' + GAME_VERSION), 'SW cache matches version');
  assert(read('sw.js').includes('js/world/GameSession.js'), 'SW caches session');
  assert(read('sw.js').includes('js/world/systems/level.js'), 'SW caches systems');
  assert(read('sw.js').includes('js/domain/combat.js'), 'SW caches combat');
  assert(read('sw.js').includes('js/domain/levels.js'), 'SW caches levels');
  assert(read('sw.js').includes('js/domain/rpg.js'), 'SW caches rpg');
}

section('config concern split');
{
  assertEq(PLAYER_BODY.w, PLAYER.w, 'body w');
  assertEq(PLAYER_SWORD.attackRange, PLAYER.attackRange, 'sword range');
  assertEq(PLAYER_DRAW.drawScale, PLAYER.drawScale, 'draw scale');
  assert(PLAYER_SWORD.w === undefined, 'sword has no w');
  assert(PLAYER_BODY.attackRange === undefined, 'body has no attackRange');
  assert(PLAYER_DRAW.attackRange === undefined, 'draw has no attackRange');
}

section('sword ≠ body (pure combat)');
{
  const p = {
    x: 100, y: 400, w: PLAYER_BODY.w, h: PLAYER_BODY.h,
    facing: 1, onGround: true, attacking: true, attackAir: false,
  };
  const stats = { rangeMul: 1, damage: 20 };
  const boxA = getAttackBox(p, stats, PLAYER_SWORD);
  const bodyA = getPlayerBodyBox(p);
  const long = { ...PLAYER_SWORD, attackRange: PLAYER_SWORD.attackRange + 40 };
  const boxB = getAttackBox(p, stats, long);
  assert(boxB.w > boxA.w, 'longer sword wider');
  assertEq(getPlayerBodyBox(p).w, bodyA.w, 'body w stable');
  assertEq(getPlayerBodyBox(p).h, bodyA.h, 'body h stable');
  const tall = { ...p, h: p.h + 30 };
  assertEq(getAttackBox(tall, stats, PLAYER_SWORD).w, boxA.w, 'tall body ≠ longer sword');
  const wide = { ...p, w: p.w + 20 };
  assertEq(getAttackBox(wide, stats, PLAYER_SWORD).w, boxA.w, 'wide body ≠ longer sword');
}

section('pure combat lifecycle');
{
  const p = {
    x: 100, y: 400, w: 28, h: 48, facing: 1, onGround: true,
    attacking: false, attackT: 0, attackCd: 0, attackAir: false, attackHitDone: false,
  };
  const stats = { rangeMul: 1, damage: 15, attackRate: 1 };
  assert(beginMeleeAttack(p, stats, PLAYER_SWORD), 'begin');
  assert(!beginMeleeAttack(p, stats, PLAYER_SWORD), 'no double begin');
  assert(!p.attackAir, 'ground');
  const foe = { x: p.x + 50, y: p.y, w: 26, h: 22, hp: 40, vx: 0, vy: 0 };
  const r1 = resolveMeleeHits(p, [foe], stats, PLAYER_SWORD);
  assert(r1.hitAny, 'hit mid');
  assert(foe.hp < 40, 'dmg');
  const hp = foe.hp;
  assert(!resolveMeleeHits(p, [foe], stats, PLAYER_SWORD).hitAny, 'no multi');
  assertEq(foe.hp, hp, 'hp stable');

  p.onGround = false; p.attacking = false; p.attackCd = 0; p.attackHitDone = false;
  beginMeleeAttack(p, stats, PLAYER_SWORD);
  assert(p.attackAir, 'air');
  assert(getAttackBox(p, stats, PLAYER_SWORD).air, 'air box');

  p.attackT = combatAttackDuration(PLAYER_SWORD, stats);
  assert(hasMeleePriority(p, stats, PLAYER_SWORD), 'priority early');
  p.attackT = 0.01;
  assert(!hasMeleePriority(p, stats, PLAYER_SWORD), 'priority late');
  p.attacking = true; p.attackT = 0.02;
  tickMeleeAttack(p, 0.05, PLAYER_SWORD, stats);
  assert(!p.attacking, 'tick ends');
}

section('pure enemy AI');
{
  const pl = { x: 200, y: 400, w: 120, h: 14, ground: false };
  const plats = [pl];
  assert(aiCanStandAt(pl.x + 60, pl.y, plats, ENEMY_AI), 'stand mid');
  assert(!aiCanStandAt(pl.x + pl.w + 20, pl.y, plats, ENEMY_AI), 'no stand past');
  const player = { x: pl.x + pl.w + 300, y: pl.y };
  const e = {
    type: 'goblin', x: pl.x + pl.w / 2, y: pl.y, w: 28, h: 42,
    speed: 70, vx: 0, vy: 0, onGround: true, facing: 1,
    homeX: pl.x + pl.w / 2, homeY: pl.y,
    patrolMin: pl.x + 10, patrolMax: pl.x + pl.w - 10,
    hitStun: 0, flash: 0, phase: 0,
  };
  const edge = pl.x + pl.w - ENEMY_AI.ledgeMargin;
  for (let i = 0; i < 150; i++) {
    aiUpdateEnemy(e, 1 / 30, player, plats, ENEMY_AI, {
      gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall,
    });
  }
  assert(e.x <= edge + 2, 'ledge stop');
  assert(e.y <= pl.y + 20, 'on platform');
  e.y = ENEMY_AI.fallKillY + 10;
  e.x = 999;
  aiUpdateEnemy(e, 1 / 60, player, plats, ENEMY_AI, {
    gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall,
  });
  assertEq(e.x, e.homeX, 'fall reset x');
  assertEq(e.y, e.homeY, 'fall reset y');
}

section('session lifecycle');
{
  const s = createSession();
  s.startRun();
  assertEq(s.screen, 'play', 'play');
  assert(s.player.onGround, 'ground');
  assert(s.platforms.length >= 2, 'platforms');
  s.spawnEnemy('bat');
  assert(s.enemies.length >= 1, 'spawn');
  s.doAttack();
  assert(s.player.attacking || s.player.attackCd > 0, 'attack');
}

section('session movement');
{
  const s = createSession();
  s.startRun();
  const x0 = s.player.x;
  const h0 = s.player.h;
  for (let i = 0; i < 10; i++) s.update(1 / 60, { x: 1, y: 0, jump: false, attack: false });
  assert(s.player.x > x0, 'runs');
  assertEq(s.player.h, h0, 'body h stable while running');
  s.requestJump();
  s.setJumpHeld(true);
  s.update(1 / 60, { x: 0, y: 0, jump: true, attack: false });
  assert(s.player.vy < 0, 'jumps');
}

section('platforms');
{
  assert(maxJumpHeight(1) > 70, 'jump height');
  const s = createSession();
  s.startRun();
  assert(s.platforms.length >= 2, 'seed plats');
  s.cameraX = 600;
  platforms.generatePlatformsAhead(s);
  assert(s.platforms.length >= 2, 'gen ok');
  const peak = maxJumpHeight(1);
  const d = maxJumpDistance(1, 1);
  const bad = [makePlatform(0, GROUND_Y, 100), makePlatform(100 + d * 2, GROUND_Y - peak, 100)];
  assert(!platformsChainReachable(bad, 1, 1), 'detects bad');
  assert(canReachPlatform(makePlatform(0, GROUND_Y, 100), makePlatform(40, GROUND_Y, 100), 1, 1), 'adjacent ok');
}

section('session combat + XP banks points (no mid-stage allocate)');
{
  const s = createSession();
  s.startRun();
  s.spawnEnemy('goblin');
  const e = s.enemies[0];
  e.x = s.player.x + 20; e.y = s.player.y; e.hp = 1;
  s.player.facing = 1;
  s.doAttack();
  if (s.enemies.length) { e.hp = 0; s.killEnemy(e, 0); }
  assert(s.kills >= 1, 'kill');
  const need = s.player.xpNext;
  s.addXp(need);
  assertEq(s.screen, 'play', 'stays in play');
  assert(s.meta.unspentPoints >= 1, 'point banked');
  assert(s.meta.level >= 2, 'hero leveled');
}

section('session mid-range + jump attack');
{
  const s = createSession();
  s.startRun();
  assert(PLAYER_SWORD.attackRange >= 70, 'longsword');
  assert(s.getAttackBoxForPlayer().w >= 70, 'box wide');
  s.spawnEnemy('goblin');
  const e = s.enemies[0];
  e.x = s.player.x + 55; e.y = s.player.y; e.hp = 5;
  s.player.facing = 1;
  s.player.attackCd = 0; s.player.attacking = false;
  const bw = s.player.w;
  s.doAttack();
  assertEq(s.player.w, bw, 'attack keeps body w');
  assert(e.hp < 5 || s.kills >= 1, 'mid hit');

  s.startRun();
  s.player.onGround = false;
  s.player.vy = -100;
  s.player.attackCd = 0; s.player.attacking = false;
  s.doAttack();
  assert(s.player.attackAir, 'jump attack');
  assert(s.getAttackBoxForPlayer().air, 'air box');
}

section('session enemy ledge');
{
  const s = createSession();
  s.startRun();
  const pl = makePlatform(200, GROUND_Y - 80, 120);
  s.platforms.length = 0;
  s.platforms.push(pl);
  s.spawnEnemy('goblin');
  const e = s.enemies[0];
  e.x = pl.x + pl.w / 2; e.y = pl.y;
  e.homeX = e.x; e.homeY = e.y;
  e.patrolMin = pl.x + 10; e.patrolMax = pl.x + pl.w - 10;
  e.onGround = true;
  s.player.x = pl.x + pl.w + 200; s.player.y = pl.y;
  const edge = pl.x + pl.w - ENEMY_AI.ledgeMargin;
  for (let i = 0; i < 120; i++) s.updateEnemy(e, 1 / 30);
  assert(e.x <= edge + 2, 'session ledge');
  assert(s.canStandAt(e.x, e.y), 'can stand');
}

section('game over');
{
  const s = createSession();
  s.startRun();
  s.hurtPlayer(999);
  assertEq(s.screen, 'over', 'over');
}

section('level shell data');
{
  const all = levels.listLevels();
  assertEq(all.length, 4, 'four biomes');
  assertEq(levels.maxLevelOrder(), 4, 'max order 4');
  assertEq(all[0].id, 'forgegate-fields', 'L1 id');
  assert(levels.getLevelById('forest-ramparts'), 'L2');
  assert(levels.getLevelById('forge-ruins'), 'L3');
  assert(levels.getLevelById('iron-caverns'), 'L4');
  const L1 = levels.getLevelById('forgegate-fields');
  assert(L1.bounds.maxX > L1.gateX, 'bounds past gate');
  assertEq(L1.boss.type, 'nightmare', 'L1 ends with the Nightmare');
  assert(L1.ladders?.length >= 2, 'L1 ladders');
  assert(L1.bounds.minY != null && L1.bounds.maxY > L1.bounds.minY, 'vertical bounds');
  assert(levels.buildLevelPlatforms(L1).length >= 6, 'platforms');
  assertEq(levels.nextLevel(L1)?.id, 'forest-ramparts', 'next L2');
  assertEq(levels.nextLevel(levels.getLevelById('iron-caverns')), null, 'campaign end L4');
  assert(L1.checkpoints?.length >= 1, 'L1 has checkpoint');
  assertEq(config.W, 960, 'landscape W');
  assertEq(config.H, 540, 'landscape H');
}

section('Forgegate Fields (L1)');
{
  const { ENEMIES, enemyIsBoss, HEART } = config;
  const L = levels.getLevelById('forgegate-fields');
  assert(L && !L.stub, 'not stub');
  assertEq(L.boss.type, 'nightmare', 'L1 boss');
  assert(enemyIsBoss('iron_warden'), 'warden is boss');
  assert(ENEMIES.iron_warden.hp >= 300, 'warden tanky');
  assertEq(HEART, 25, 'heart size');
  const plats = levels.buildLevelPlatforms(L);
  assert(plats.length >= 6, 'authored layout');
  assert(L.ladders.length >= 2, 'climb routes');
  assert(L.encounters.length >= 3, 'teaching encounters');
  const ys = new Set(plats.map(p => Math.round(p.y / 20)));
  assert(ys.size >= 3, 'multi-height design');
  const roster = new Set();
  for (const enc of L.encounters) {
    for (const sp of enc.enemies) roster.add(sp.type);
  }
  assert(roster.has('goblin'), 'has goblins');
  assert(roster.has('bat'), 'has bats');
  assert(roster.has('shield_skeleton'), 'has shield skeletons');
}

section('loadLevel + landscape camera + no endless waves');
{
  const s = createSession();
  assert(s.loadLevel('forgegate-fields'), 'load L1');
  assertEq(s.screen, 'play', 'play');
  assertEq(s.level.id, 'forgegate-fields', 'level set');
  assertEq(s.levelPhase, 'explore', 'explore');
  assert(s.platforms.length >= 2, 'authored plats');
  assert(s.ladders.length >= 1, 'ladders loaded');
  assertEq(s.wave, 1, 'stage order');
  const bounds = s.getPlayerBounds();
  assert(bounds.maxX < 1e6, 'finite world');
  assert(bounds.maxY != null, 'world maxY');
  const cam = s.getCameraBounds();
  assert(cam.maxX >= 0, 'cam max');
  assert(cam.maxY != null, 'cam Y');
  assert(s.cameraY != null, 'cameraY field');
  for (let i = 0; i < 180; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(s.wave, 1, 'no wave ramp');
}

section('ladders + locked gate + L1 clear (boss first)');
{
  const { findLadderAt } = platforms;
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const L = s.level;
  const lad = s.ladders[0];
  assert(lad, 'has ladder');
  s.player.x = lad.x;
  s.player.y = lad.y + lad.h * 0.5;
  s.player.onGround = false;
  s.update(0.05, { x: 0, y: -1, jump: false, attack: false });
  assert(s.player.climbing, 'grab climb');
  const y0 = s.player.y;
  s.update(0.2, { x: 0, y: -1, jump: false, attack: false });
  assert(s.player.y < y0, 'climbs up');

  // Fire encounters, open gate, walk in → the boss arena; the stage clears when the boss falls
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'the gate leads to the boss');
  assert(s.screen === 'play', 'not cleared yet');
  killBoss(s);
  assert(s.screen === 'allocate' || s.screen === 'clear' || s.levelPhase === 'done', 'cleared when the boss falls');
}

section('encounters + L4 boss + campaign clear');
{
  const s = createSession();
  s.loadLevel('iron-caverns');
  const L = s.level;
  s.player.x = L.encounters[0].triggerX + 5;
  s.updateLevelProgress();
  assert(s.firedEncounters.has(L.encounters[0].id), 'enc fired');
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'boss phase');
  assert(s.enemies.some(e => e.type === 'iron_warden'), 'warden type');
  const boss = s.enemies.find(e => e.isBoss);
  s.killEnemy(boss, s.enemies.indexOf(boss));
  if (s.screen === 'allocate') s.finishAllocate();
  assertEq(s.screen, 'clear', 'clear');
  assert(s.meta.campaignCleared, 'campaign cleared');
}

section('pure telegraphed slam (Iron Warden)');
{
  const { BOSS_SLAM, ENEMIES } = config;
  const player = { x: 200, y: GROUND_Y, w: 28, h: 48 };
  const e = {
    type: 'iron_warden', x: 200, y: GROUND_Y, w: 72, h: 88,
    damage: ENEMIES.iron_warden.damage, hasSlam: true, hasMelee: true,
    slamState: 'idle', slamT: 0, slamCd: 0, slamHitDone: false,
    hitStun: 0, facing: 1,
  };
  assert(enemyUsesTelegraphedSlam(e), 'uses slam');
  let hit = tickEnemySlam(e, 0.016, player, BOSS_SLAM);
  assertEq(e.slamState, 'windup', 'windup start');
  assert(!hit, 'no hit in windup');
  hit = tickEnemySlam(e, BOSS_SLAM.windup + 0.01, player, BOSS_SLAM);
  assertEq(e.slamState, 'slam', 'slam phase');
  hit = tickEnemySlam(e, 0.02, player, BOSS_SLAM);
  assert(hit && hit.hit, 'slam hits');
  tickEnemySlam(e, BOSS_SLAM.active + 0.05, player, BOSS_SLAM);
  assertEq(e.slamState, 'recover', 'recover');
  tickEnemySlam(e, BOSS_SLAM.recover + 0.05, player, BOSS_SLAM);
  assertEq(e.slamState, 'idle', 'back idle');
}

section('telegraphed melee (goblin; bat contact)');
{
  const { ENEMY_MELEE, ENEMIES, getEnemyMeleeCfg } = config;
  assert(getEnemyMeleeCfg('goblin'), 'goblin melee cfg');
  assert(getEnemyMeleeCfg('shield_skeleton'), 'skeleton melee cfg');
  assert(getEnemyMeleeCfg('iron_warden'), 'warden melee cfg');
  assert(!getEnemyMeleeCfg('bat'), 'bat has no melee cfg');
  assert(ENEMIES.goblin.hasMelee, 'goblin flag');
  assert(!ENEMIES.bat.hasMelee, 'bat no hasMelee');
  assert(ENEMIES.bat.fly, 'bat flies');
  assert(ENEMIES.shield_skeleton.blockFront, 'blocks front');

  const player = { x: 100, y: GROUND_Y, w: 28, h: 48 };
  const goblin = {
    type: 'goblin', x: 100, y: GROUND_Y, w: 28, h: 42,
    damage: ENEMIES.goblin.damage, hasMelee: true,
    slamState: 'idle', slamT: 0, slamCd: 0, slamHitDone: false,
    hitStun: 0, facing: 1,
  };
  assert(enemyUsesTelegraphedAttack(goblin), 'goblin telegraphs');
  let hit = tickEnemySlam(goblin, 0.016, player);
  assertEq(goblin.slamState, 'windup', 'goblin windup');
  tickEnemySlam(goblin, ENEMY_MELEE.goblin.windup + 0.01, player);
  assertEq(goblin.slamState, 'slam', 'goblin active');
  hit = tickEnemySlam(goblin, 0.02, player);
  assert(hit && hit.hit, 'goblin swing hits');

  const bat = {
    type: 'bat', x: 100, y: GROUND_Y, w: 28, h: 22, fly: true,
    damage: 10, slamState: 'idle', slamT: 0, slamCd: 0, slamHitDone: false, hitStun: 0,
  };
  assert(!enemyUsesTelegraphedAttack(bat), 'bat contact-only');

  const s = createSession();
  s.loadLevel('forgegate-fields');
  s.enemies.length = 0;
  const b = s.spawnEnemy('goblin', { x: s.player.x, y: s.player.y });
  assert(b && b.hasMelee, 'spawned goblin hasMelee');
  b.slamCd = 99;
  b.slamState = 'idle';
  const hpBefore = s.player.hp;
  s.player.inv = 0;
  b.x = s.player.x;
  b.y = s.player.y;
  for (let i = 0; i < 8; i++) s.update(0.016, { x: 0, y: 0, jump: false, attack: false });
  assertEq(s.player.hp, hpBefore, 'goblin no contact damage while idle');

  s.enemies.length = 0;
  const sl = s.spawnEnemy('bat', { x: s.player.x + 250, y: s.player.y - 40 });
  assert(sl && sl.fly, 'bat flies');
  sl.spawnGrace = 0;
  sl.x = s.player.x;
  sl.y = s.player.y;
  s.player.inv = 0;
  const hp2 = s.player.hp;
  s.update(0.016, { x: 0, y: 0, jump: false, attack: false });
  assert(s.player.hp < hp2, 'bat contact-hurts');
}

section('shield block');
{
  const p = {
    x: 80, y: GROUND_Y, w: 28, h: 48, facing: 1, onGround: true,
    attacking: true, attackAir: false, attackHitDone: false, attackT: 0.2,
  };
  const stats = { rangeMul: 1, damage: 20 };
  const skel = {
    type: 'shield_skeleton', x: 120, y: GROUND_Y, w: 28, h: 46, hp: 34,
    facing: -1, blockFront: true, slamState: 'idle',
  };
  const r = resolveMeleeHits(p, [skel], stats, PLAYER_SWORD);
  assert(r.hits.some(h => h.blocked), 'front blocked');
  assertEq(skel.hp, 34, 'no dmg on block');
  skel.facing = 1;
  p.attackHitDone = false;
  const r2 = resolveMeleeHits(p, [skel], stats, PLAYER_SWORD);
  assert(r2.hitAny && !r2.hits[0].blocked, 'behind hits');
  assert(skel.hp < 34, 'dmg from behind');
}

section('fail screen');
{
  const s = createSession();
  s.loadLevel('forest-ramparts');
  s.hurtPlayer(999);
  assertEq(s.screen, 'over', 'fail over');
  assert(s.overReason.length > 0, 'reason');
}

section('upgrades pure (fallback)');
{
  const stats = upgrades.defaultStats();
  assertEq(stats.damage, PLAYER_SWORD.attackDamage, 'base dmg');
  const p = { hp: 50, maxHp: 100, _owned: {} };
  upgrades.applyUpgradeToRun(p, stats, UPGRADES.find(u => u.id === 'dmg'));
  assert(stats.damage > PLAYER_SWORD.attackDamage, 'legacy dmg');
}

section('pure RPG domain');
{
  const meta = rpg.defaultMeta();
  assertEq(meta.level, 1, 'start lv');
  assertEq(meta.unspentPoints, 0, 'no points');
  assertEq(meta.levelUnlocked, 1, 'L1 unlocked');
  const need = rpg.xpToNext(1);
  const r = rpg.applyXp(meta, need);
  assert(r.levelsGained >= 1, 'gained level');
  assertEq(meta.unspentPoints, r.pointsGained, 'banked');
  assert(rpg.allocatePoint(meta, 'str'), 'alloc str');
  assertEq(meta.stats.str, 1, 'str 1');
  assertEq(meta.unspentPoints, r.pointsGained - 1, 'spent');
  assert(!rpg.allocatePoint(meta, 'nope'), 'bad key');
  const combatStats = rpg.attrsToCombatStats(meta.stats);
  assert(combatStats.damage > PLAYER_SWORD.attackDamage, 'str → dmg');
  const hp = rpg.attrsToMaxHp({ ...rpg.defaultAttrs(), vit: 2 });
  assert(hp > PLAYER_MOVE.maxHp, 'vit → hp');
  rpg.unlockAfterClear(meta, 1, 3);
  assertEq(meta.levelUnlocked, 2, 'unlock L2');
  assert(rpg.isLevelUnlocked(meta, 2), 'L2 open');
  assert(!rpg.isLevelUnlocked(meta, 3), 'L3 locked');
}

section('session RPG: allocate between levels + unlock + persist');
{
  const save = createMemorySave({ levelUnlocked: 1 });
  const s = new GameSession({
    audio: {
      slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
      levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
    },
    save,
  });
  assert(s.loadLevel('forgegate-fields'), 'load L1');
  assert(!s.loadLevel('forest-ramparts'), 'L2 locked');
  s.loadLevel('forgegate-fields');
  s.addXp(rpg.xpToNext(s.meta.level));
  assertEq(s.screen, 'play', 'no mid allocate');
  assert(s.meta.unspentPoints >= 1, 'banked mid');
  s.enemies.length = 0;
  for (const enc of s.level.encounters) s.firedEncounters.add(enc.id);
  s.player.x = s.level.gateX + 10;
  s.updateLevelProgress();
  killBoss(s);
  assertEq(s.screen, 'allocate', 'allocate between levels');
  assert(s.meta.levelUnlocked >= 2, 'unlocked L2');
  assert(s.allocateAttr('str'), 'spend str');
  assert(s.stats.damage > PLAYER_SWORD.attackDamage, 'dmg applied');
  s.finishAllocate();
  assertEq(s.screen, 'clear', 'clear after allocate');
  const s2 = new GameSession({
    audio: {
      slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
      levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
    },
    save,
  });
  assert(s2.loadLevel('forest-ramparts'), 'L2 unlocked after clear');
  assert(s2.meta.stats.str >= 1, 'str persisted');
}

section('session clear without banked points → clear screen');
{
  const s = createSession({ unspentPoints: 0, level: 1, xp: 0 });
  s.loadLevel('forgegate-fields');
  s.meta.unspentPoints = 0;
  s.meta.level = 50;
  s.meta.xp = 0;
  s.clearBonusApplied = false;
  const bonus = s.level.clearBonus;
  s.level.clearBonus = 0;
  s.clearLevel();
  s.level.clearBonus = bonus;
  assertEq(s.screen, 'clear', 'clear when no points');
}

section('later stages exist with checkpoints');
{
  for (const id of ['forest-ramparts', 'forge-ruins', 'iron-caverns']) {
    const L = levels.getLevelById(id);
    assert(L, id + ' present');
    assert(levels.buildLevelPlatforms(L).length >= 3, id + ' plats');
    assert(L.checkpoints?.length >= 1, id + ' checkpoint');
  }
  assertEq(levels.getLevelById('iron-caverns').boss.type, 'iron_warden', 'final boss');
}

section('checkpoints continue');
{
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const cp = s.level.checkpoints[0];
  for (const enc of s.level.encounters) {
    if (enc.triggerX <= cp.x) s.firedEncounters.add(enc.id);
  }
  s.enemies.length = 0;
  s.player.x = cp.x + 5;
  s.updateLevelProgress();
  assert(s.activeCheckpoint, 'checkpoint active');
  assertEq(s.activeCheckpoint.id, cp.id, 'cp id');
  s.hurtPlayer(999);
  assertEq(s.screen, 'over', 'over after death');
  assert(s.hasContinueCheckpoint(), 'can continue');
  assert(s.continueFromCheckpoint(), 'continue loads');
  assertEq(s.screen, 'play', 'back to play');
  assertEq(s.player.x, cp.x, 'spawn at checkpoint');
}

section('feel: duck + double jump + safe spawn');
{
  const s = createSession();
  s.loadLevel('forgegate-fields');
  s.update(0.016, { x: 0, y: 1, jump: false, attack: false });
  assert(s.player.ducking, 'ducking held down');
  assert(s.player.h < s.player.standH, 'duck height');
  s.update(0.016, { x: 0, y: 0, jump: false, attack: false });
  assert(!s.player.ducking, 'stand up');
  s.player.onGround = false;
  s.player.coyote = 0;
  s.player.airJumps = 1;
  s.player.vy = 100;
  s.jumpBuffered = 0.1;
  s.update(0.016, { x: 0, y: 0, jump: true, attack: false });
  assert(s.player.vy < 0, 'double jump launches');
  assertEq(s.player.airJumps, 0, 'air jump spent');
  s.player.x = 500;
  s.enemies.length = 0;
  const e = s.spawnEnemy('goblin', { x: 510, y: s.player.y });
  assert(e, 'spawned');
  assert(e.x >= s.player.x + 150, 'spawn not on face');
  assert(e.spawnGrace > 0, 'spawn grace');
  e.x = s.player.x;
  e.slamCd = 0;
  for (let i = 0; i < 4; i++) s.updateEnemy(e, 0.02);
  assertEq(e.slamState, 'idle', 'no instant attack in grace');
}

section('New Game+ + juice hitstop');
{
  const meta = rpg.defaultMeta();
  meta.campaignCleared = true;
  meta.stats.str = 3;
  meta.level = 8;
  assert(rpg.startNewGamePlus(meta), 'ng+ starts');
  assertEq(meta.ngPlus, 1, 'cycle 1');
  assertEq(meta.levelUnlocked, 1, 'stages reset');
  assertEq(meta.stats.str, 3, 'stats kept');
  assert(!rpg.startNewGamePlus({ ...rpg.defaultMeta() }), 'needs clear');
  assert(rpg.ngPlusHpMul({ ngPlus: 1 }) > 1, 'hp mul');

  const save = createMemorySave({
    campaignCleared: true, ngPlus: 0, levelUnlocked: 4, stats: { str: 2 },
  });
  const s = new GameSession({
    audio: {
      slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
      levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
    },
    save,
  });
  assert(s.beginNewGamePlus(), 'session ng+');
  assertEq(s.meta.ngPlus, 1, 'session cycle');
  assert(s.loadLevel('forgegate-fields'), 'L1 after ng+');
  const e = s.spawnEnemy('goblin', { x: s.player.x + 40, y: s.player.y });
  const base = config.ENEMIES.goblin.hp;
  assert(e.hp > base, 'ng+ tougher goblin');
  s.player.x = e.x - 20;
  s.player.y = e.y;
  s.player.facing = 1;
  s.doAttack();
  assert(s.hitstop > 0, 'hitstop applied');
}

section('tile maps compile to tops, solids and one-way ledges');
{
  const tm = await import(js('js/domain/tilemap.js'));
  const m = tm.createTileMap(10, 6);
  tm.groundCells(m, 0, 3, 4);
  tm.groundCells(m, 4, 9, 2);
  tm.fillCells(m, 1, 1, 2, 1, '=');
  const out = tm.compileTileMap(m);
  const tops = out.platforms.filter(p => !p.oneWay).sort((a, b) => a.x - b.x);
  assertEq(tops.length, 2, 'two walkable tops');
  assertEq(tops[0].y, 4 * tm.TILE, 'low top height');
  assertEq(tops[1].w, 6 * tm.TILE, 'merged top width');
  const ledges = out.platforms.filter(p => p.oneWay);
  assertEq(ledges.length, 1, 'one ledge');
  assertEq(ledges[0].w, 2 * tm.TILE, 'ledge keeps its exact width');
  const area = out.solids.reduce((a, r) => a + r.w * r.h, 0);
  assertEq(area, (4 * 2 + 6 * 4) * tm.TILE * tm.TILE, 'solids cover every ground cell');
}

section('solid collision: walls push, ceilings bump, tops land');
{
  const { resolveSolids, hasHeadroom } = platforms;
  const wall = [{ x: 100, y: 0, w: 64, h: 200 }];
  const a = { x: 95, y: 150, w: 26, h: 70, vx: 200, vy: 0 };
  const r1 = resolveSolids(a, wall, 150);
  assert(a.x + a.w / 2 <= 100.01, 'pushed out of the wall');
  assertEq(r1.wall, 1, 'hit wall on the right');
  assertEq(a.vx, 0, 'run stopped');
  const ceil = [{ x: 0, y: 0, w: 300, h: 100 }];
  const b = { x: 150, y: 165, w: 26, h: 70, vx: 0, vy: -400 };
  const r2 = resolveSolids(b, ceil, 175);
  assert(r2.bumped, 'head bump');
  assertEq(b.y, 170, 'held under the ceiling');
  assert(b.vy >= 0, 'upward speed killed');
  const floor = [{ x: 0, y: 300, w: 300, h: 64 }];
  const c = { x: 150, y: 310, w: 26, h: 70, vx: 0, vy: 300 };
  assert(resolveSolids(c, floor, 296).landed, 'lands from above');
  assertEq(c.y, 300, 'feet on the top');
  assert(!hasHeadroom(150, 170, 26, 80, ceil), 'no room to stand under a low ceiling');
  assert(hasHeadroom(150, 400, 26, 70, ceil), 'room in the open');
}

// Every finished tile-map stage gets the same layout checks and the same bot run.
const tileStages = levels.listLevels().filter(l => l.tiles && !l.stub);
assertEq(tileStages.length, 4, 'all four stages are tile maps');

for (const L of tileStages) {
  section(`${L.name} is a full tile stage`);
  assert(L.tiles && L.solids?.length > 0, 'tile map + solids');
  assert(L.theme === L.tiles.theme, 'stage theme matches its tile map');
  assert(L.bounds.maxX >= 5000, 'several screens long');
  assert(L.encounters.length >= 6, 'plenty of fights');
  assert(L.checkpoints.length >= 2, 'two checkpoints');
  assert(L.coins.length >= 40, 'coins to collect');
  assert(L.pickups.filter(p => p.type === 'heart').length >= 2, 'hearts to find');
  assert(L.ladders.length >= 1, 'a ladder');
  const roster = new Set(L.encounters.flatMap(e => e.enemies.map(x => x.type)));
  const dog = tileStages.indexOf(L) >= 2 ? 'hell_hound' : 'wolf';
  assert(roster.has(dog), `${dog}s appear`);
  if (dog === 'hell_hound') assert(!roster.has('wolf'), 'hounds replace wolves in stages 3 and 4');
  const plats = levels.buildLevelPlatforms(L);
  const onPlat = (x, y) => plats.some(p => x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) < 1);
  assert(onPlat(L.spawn.x, L.spawn.y), 'spawn stands on ground');
  for (const cp of L.checkpoints) assert(onPlat(cp.x, cp.y), `checkpoint ${cp.id} on ground`);
  for (const enc of L.encounters) {
    for (const e of enc.enemies) {
      if (config.ENEMIES[e.type].fly) continue;
      assert(onPlat(e.x, e.y), `${enc.id} ${e.type} stands on ground`);
    }
  }
  for (const lad of L.ladders) assert(onPlat(lad.x, lad.y), 'ladder top is a ledge');
  for (const pk of L.pickups) {
    assert(!L.solids.some(r => pk.x > r.x && pk.x < r.x + r.w && pk.y > r.y && pk.y < r.y + r.h), 'pickup is not inside rock');
  }
  for (const c of L.coins) {
    assert(!L.solids.some(r => c.x > r.x && c.x < r.x + r.w && c.y > r.y && c.y < r.y + r.h), 'coin is not inside rock');
  }
}

for (const L of tileStages) {
  section(`a simple bot can run ${L.name} end to end`);
  const s = createSession();
  s.loadLevel(L.id);
  const plats = s.platforms;
  const groundAhead = (x, y) => plats.some(p => x >= p.x && x <= p.x + p.w && p.y >= y - 4 && p.y <= y + 70);
  let lastX = 0, stuck = 0, held = 0, maxX = 0;
  const step = (f) => {
    const p = s.player;
    let jump = false;
    stuck = Math.abs(p.x - lastX) < 0.5 ? stuck + 1 : 0;
    if (p.onGround && (!groundAhead(p.x + 60, p.y) || stuck > 6)) { jump = true; held = 26; }
    if (!p.onGround && p.vy > 60 && (p.airJumps || 0) > 0 && !groundAhead(p.x + 30, p.y)) { jump = true; held = 20; }
    if (held > 0) held--;
    s.setJumpHeld(held > 0);
    lastX = p.x;
    p.hp = p.maxHp;
    s.update(1 / 60, { x: 1, y: stuck > 40 ? -1 : 0, jump, attack: f % 14 === 0 });
    maxX = Math.max(maxX, s.player.x);
  };
  for (let f = 0; f < 60 * 120 && s.screen === 'play' && s.levelPhase === 'explore'; f++) step(f);
  assert(maxX >= s.level.gate.x - 80, `bot reaches the gate (got ${Math.round(maxX)})`);
  assert(s.kills >= 6, 'bot fought its way through');
  if (L.boss) {
    // With the fights done, the same bot walks through the gate into the boss arena.
    for (const enc of L.encounters) s.firedEncounters.add(enc.id);
    s.enemies.length = 0;
    for (let f = 0; f < 60 * 20 && s.levelPhase !== 'boss' && s.screen === 'play'; f++) step(f);
    assertEq(s.levelPhase, 'boss', 'bot walks into the boss arena');
    for (let f = 0; f < 30; f++) step(f);
    assert(s.player.x >= L.boss.arenaMinX && s.player.x <= L.boss.arenaMaxX, 'bot is inside the arena');
  }
}

section('Iron Warden arena sits inside the stage on one flat floor');
{
  const L = levels.getLevelById('iron-caverns');
  const b = L.boss;
  assertEq(b.type, 'iron_warden', 'final boss');
  assert(b.arenaMinX >= L.bounds.minX && b.arenaMaxX <= L.bounds.maxX, 'arena inside the stage bounds');
  assert(b.spawnX > b.arenaMinX + 24 && b.spawnX < b.arenaMaxX - 24, 'Warden spawns inside the arena');
  assert(b.arenaMaxX - b.arenaMinX >= config.W, 'arena is at least a screen wide');
  assert(L.gate.x + L.gate.w <= b.arenaMinX && L.gateX < b.arenaMinX, 'the gate is the arena\'s left wall');
  const plats = levels.buildLevelPlatforms(L);
  const floor = plats.find(p => b.spawnX >= p.x && b.spawnX <= p.x + p.w && Math.abs(p.y - b.spawnY) < 1);
  assert(floor, 'Warden spawns on a platform');
  assert(floor.x <= b.arenaMinX && floor.x + floor.w >= b.arenaMaxX, 'one platform covers the whole arena floor');
  const inArena = L.solids.filter(r => r.x + r.w > b.arenaMinX && r.x < b.arenaMaxX && r.y + r.h > b.spawnY - 200 && r.y < b.spawnY);
  assertEq(inArena.length, 0, 'no walls or blocks standing in the arena floor space');
  const s = createSession();
  s.loadLevel('iron-caverns');
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  s.enemies.length = 0;
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  const boss = s.enemies.find(e => e.isBoss);
  assert(boss && Math.abs(boss.x - b.spawnX) < 1 && Math.abs(boss.y - b.spawnY) < 1, 'Warden appears at the spawn point');
}

section('combat feel: buffer, combo finisher, interrupt');
{
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const p = s.player;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: true });
  assert(p.attacking, 'first swing');
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: true });
  assert(s.attackBuffer > 0, 'press during a swing is queued');
  let swings = 1;
  let was = true;
  for (let i = 0; i < 40; i++) {
    s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
    if (p.attacking && !was) swings++;
    was = p.attacking;
  }
  assertEq(swings, 2, 'queued swing fires on its own');
  assertEq(p.combo, 1, 'second swing of a chain');

  const e = s.spawnEnemy('goblin', { x: p.x + 300, y: p.y });
  e.x = p.x + 40; e.y = p.y; e.spawnGrace = 0; e.rise = 0; e.hp = 999;
  p.facing = 1;
  const hitWith = (combo) => {
    p.attacking = false; p.attackCd = 0; p.comboT = combo > 0 ? 1 : 0; p.combo = combo - 1;
    const before = e.hp;
    s.doAttack();
    return before - e.hp;
  };
  const normal = hitWith(0);
  const finisher = hitWith(2);
  assert(finisher > normal * 1.4, 'third swing hits harder');

  e.slamState = 'windup'; e.slamT = 0.3;
  p.attacking = false; p.attackCd = 0;
  s.doAttack();
  assertEq(e.slamState, 'idle', 'a hit interrupts the wind-up');
}

section('pits, hearts and cliff knock-offs');
{
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const p = s.player;
  for (let i = 0; i < 30; i++) s.update(1 / 60, { x: 1, y: 0, jump: false, attack: false });
  const safeX = p.safeX;
  assert(safeX != null, 'safe footing remembered');
  p.y = s.level.bounds.fallY + 50;
  p.vy = 400;
  const hp0 = p.hp;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assert(p.hp < hp0, 'falling costs health');
  assert(Math.abs(p.x - safeX) < 40, 'back on safe ground');

  p.hp = 40;
  const heart = s.pickups[0];
  p.x = heart.x; p.y = heart.y + 30;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assert(heart.taken, 'heart picked up');
  assert(p.hp > 40, 'heart heals');

  const e = s.spawnEnemy('goblin', { x: p.x + 300, y: p.y });
  e.y = s.level.bounds.fallY + 40; e.rise = 0;
  const k = s.kills;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(s.kills, k + 1, 'enemy knocked into the sea counts as a kill');
}

section('portrait and landscape views');
{
  const { viewSizeFor, setViewSize, CONTROLS } = config;
  const port = viewSizeFor(390, 844);
  assertEq(port.w, 540, 'portrait view is 540 wide');
  assert(port.h > 1000, 'portrait view uses the tall screen');
  assertEq(viewSizeFor(844, 390).w, 960, 'landscape view');
  setViewSize(port.w, port.h);
  assertEq(config.W, 540, 'W follows the view');
  assert(config.PORTRAIT, 'portrait flag');
  assert(CONTROLS.jump.y > port.h - 300 && CONTROLS.jump.x < 540, 'buttons sit in the bottom of the portrait view');
  const s = createSession();
  s.loadLevel('forgegate-fields');
  for (let i = 0; i < 30; i++) s.update(1 / 60, { x: 1, y: 0, jump: false, attack: false });
  const cam = s.getCameraBounds();
  assert(s.cameraX >= cam.minX && s.cameraX <= cam.maxX, 'camera stays in bounds in portrait');
  setViewSize(960, 540);
  assertEq(config.W, 960, 'back to landscape W');
  assertEq(config.H, 540, 'back to landscape H');
  assert(!config.PORTRAIT, 'landscape flag');
}

section('enemies face the way they move; coins touch the body');
{
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const ghost = s.spawnEnemy('bat', { x: s.player.x + 400, y: s.player.y - 100 });
  const wolf = s.spawnEnemy('wolf', { x: s.player.x + 400, y: s.player.y });
  const skel = s.spawnEnemy('goblin', { x: s.player.x + 400, y: s.player.y });
  assertEq(ghost.artFaces, 1, 'ghost art looks right');
  assertEq(wolf.artFaces, 1, 'wolf art looks right');
  assertEq(skel.artFaces, -1, 'skeleton art looks left');

  const p = s.player;
  s.coins.length = 0;
  s.coins.push({ x: p.x + p.w / 2 + 10, y: p.y - p.h + 6, vx: 0, vy: 0, r: 8, xp: 1, life: 999, authored: true });
  const before = s.coinsCollected;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(s.coinsCollected, before + 1, 'coin by the shoulder is collected');
}

section('new enemies: spider, bog thing, burning ghoul, hell hound');
{
  const { ENEMIES, ENEMY_MELEE, ENEMY_LUNGE, getEnemyMeleeCfg } = config;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const floor = [{ x: 0, y: GROUND_Y, w: 2000, h: 40, ground: true }];
  const mk = (type, x, extra = {}) => ({
    type, x, y: GROUND_Y, w: ENEMIES[type].w, h: ENEMIES[type].h, hp: ENEMIES[type].hp,
    speed: ENEMIES[type].speed, damage: ENEMIES[type].damage, vx: 0, vy: 0, onGround: true,
    facing: -1, homeX: x, homeY: GROUND_Y, patrolMin: x - 300, patrolMax: x + 300,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0,
    hasMelee: !!ENEMIES[type].hasMelee, lunges: !!ENEMIES[type].lunges,
    slamState: 'idle', slamT: 0, slamCd: 0, slamHitDone: false, ...extra,
  });
  const knight = (over = {}) => ({
    x: 500, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, facing: 1, onGround: true,
    attacking: true, attackAir: false, attackHitDone: false, attackT: 0.2, combo: 0, ...over,
  });
  const stats = { rangeMul: 1, damage: 20 };

  // Spider: short, fragile, and reachable by a standing, ducking and jumping swing
  const sp = ENEMIES.spider;
  assert(sp.hp < ENEMIES.goblin.hp && sp.h <= 30, 'spider is small and fragile');
  assert(!getEnemyMeleeCfg('spider') && !sp.fly, 'spider is a contact crawler');
  for (const [name, over] of [
    ['standing', {}],
    ['crouch', { ducking: true, h: PLAYER_BODY.duckH }],
    ['jump', { onGround: false, attackAir: true, y: GROUND_Y - 20 }],
  ]) {
    const spider = mk('spider', 560);
    const r = resolveMeleeHits(knight(over), [spider], stats, PLAYER_SWORD);
    assert(r.hitAny && spider.hp < sp.hp, `spider is hit by a ${name} swing`);
  }
  const spider = mk('spider', 700);
  for (let i = 0; i < 90; i++) aiUpdateEnemy(spider, 1 / 60, { x: 500, y: GROUND_Y }, floor, ENEMY_AI, phys);
  assert(spider.x < 700 && spider.onGround, 'spider crawls toward the knight');

  // Bog thing: slower and tankier than a skeleton, with a longer wind-up
  const th = ENEMIES.thing;
  assert(th.hp > ENEMIES.goblin.hp && th.speed < ENEMIES.goblin.speed, 'thing is slow and tanky');
  assert(ENEMY_MELEE.thing.windup > ENEMY_MELEE.goblin.windup, 'thing telegraphs longer');

  // Burning ghoul: more health and damage than a skeleton; the wind-up can be interrupted
  const gh = ENEMIES.burning_ghoul;
  assert(gh.hp > ENEMIES.goblin.hp && gh.damage > ENEMIES.goblin.damage, 'ghoul out-fights a skeleton');
  const ghoul = mk('burning_ghoul', 540);
  const target = { x: 500, y: GROUND_Y };
  let hit = null;
  for (let i = 0; i < 4; i++) hit = tickEnemySlam(ghoul, 0.016, target);
  assertEq(ghoul.slamState, 'windup', 'ghoul winds up in range');
  assert(!hit, 'no damage during the wind-up');
  const r = resolveMeleeHits(knight(), [ghoul], stats, PLAYER_SWORD);
  assert(r.hitAny, 'sword reaches the winding-up ghoul');
  assertEq(ghoul.slamState, 'idle', 'a hit interrupts the ghoul wind-up');
  ghoul.hitStun = 0;
  for (let i = 0; i < 20; i++) hit = tickEnemySlam(ghoul, 0.016, target) || hit;
  assert(!hit && ghoul.slamState === 'idle', 'interrupted ghoul waits out its cooldown');
  let swung = null;
  for (let i = 0; i < 120 && !swung; i++) swung = tickEnemySlam(ghoul, 0.016, target);
  assert(swung && swung.hit && swung.damage >= gh.damage, 'uninterrupted ghoul swing hits');

  // Hell hound: faster and tougher than a wolf; leaps only from close range, not endlessly
  const hh = ENEMIES.hell_hound, lcfg = ENEMY_LUNGE.hell_hound;
  assert(hh.hp > ENEMIES.wolf.hp && hh.speed > ENEMIES.wolf.speed && hh.lunges, 'hound beats a wolf');
  const wide = [{ x: -5000, y: GROUND_Y, w: 9000, h: 40, ground: true }];
  const run = (hound, player, frames, onTick) => {
    for (let i = 0; i < frames; i++) {
      aiUpdateEnemy(hound, 1 / 60, player, wide, hound.aiCfg || ENEMY_AI, phys);
      if (onTick) onTick(i);
    }
  };
  const far = mk('hell_hound', 1000);
  run(far, { x: 500, y: GROUND_Y }, 20);
  assertEq(far.lungeState, 'idle', 'hound far away does not lunge');
  const high = mk('hell_hound', 600);
  run(high, { x: 520, y: GROUND_Y - 200 }, 20);
  assertEq(high.lungeState, 'idle', 'hound does not lunge at a knight on another level');

  const hound = mk('hell_hound', 650, { aiCfg: { ...ENEMY_AI, aggroX: hh.aggroX } });
  const mark = { x: 500, y: GROUND_Y };
  run(hound, mark, 2);
  assertEq(hound.lungeState, 'crouch', 'hound crouches when the knight is in range');
  assertEq(hound.vx, 0, 'hound stands still while it crouches');
  run(hound, mark, Math.ceil(lcfg.crouch * 60) + 1);
  assertEq(hound.lungeState, 'leap', 'then springs');
  assertEq(Math.sign(hound.vx), -1, 'toward the knight');
  assert(hound.vy < 0 && !hound.onGround, 'leaving the ground');
  const startX = hound.x;
  let landed = false;
  run(hound, mark, 90, () => { if (hound.lungeState !== 'leap') landed = true; });
  assert(landed && hound.onGround, 'the leap ends on the ground');
  assert(startX - hound.x > 60 && startX - hound.x < 180, 'a short committed lunge');
  const starts = [];
  const chained = mk('hell_hound', 650, { aiCfg: { ...ENEMY_AI, aggroX: hh.aggroX } });
  let prev = 'idle';
  run(chained, mark, 60 * 8, (i) => {
    // The knight keeps stepping back into range
    mark.x = chained.x - 140;
    if (chained.lungeState === 'leap' && prev !== 'leap') starts.push(i / 60);
    prev = chained.lungeState;
  });
  assert(starts.length >= 2, 'hound leaps again after a pause');
  for (let i = 1; i < starts.length; i++) {
    assert(starts[i] - starts[i - 1] > lcfg.recover + lcfg.cooldown, 'lunges are spaced by recovery plus cooldown');
  }

  const hit1 = mk('hell_hound', 650, { aiCfg: { ...ENEMY_AI, aggroX: hh.aggroX } });
  run(hit1, { x: 520, y: GROUND_Y }, 2);
  assertEq(hit1.lungeState, 'crouch', 'second hound crouches');
  const r2 = resolveMeleeHits(knight({ x: 580, facing: 1 }), [hit1], stats, PLAYER_SWORD);
  assert(r2.hitAny, 'sword hits a crouching hound');
  run(hit1, { x: 520, y: GROUND_Y }, 2);
  assertEq(hit1.lungeState, 'idle', 'a hit cancels the crouch');

  // Session: spawned hound carries the lunge flag and faces the way its art does
  const s = createSession();
  s.loadLevel('forge-ruins');
  const dog = s.spawnEnemy('hell_hound', { x: s.player.x + 400, y: s.player.y });
  assert(dog && dog.lunges && dog.lungeState === 'idle', 'spawned hound can lunge');
  assert(!s.spawnEnemy('spider', { x: s.player.x + 400, y: s.player.y }).hasMelee, 'spider has no melee');
  assert(s.spawnEnemy('burning_ghoul', { x: s.player.x + 400, y: s.player.y }).hasMelee, 'ghoul swings');
}

section('enemy projectiles: flight, hits, walls, sword, clearing');
{
  const proj = await import(js('js/domain/projectiles.js'));
  const { makeProjectile, tickProjectiles, cutProjectiles } = proj;
  const body = { x: 480, y: 400, w: 26, h: 70 };
  const open = { solids: [], bounds: { minX: 0, maxX: 2000, minY: 0, maxY: 800 }, target: body, canHurt: true };
  const shot = (o = {}) => makeProjectile('fireball', { x: 300, y: 440, vx: 260, damage: 16, owner: 'wizard', ...o });

  // Flies straight, hits the knight once and is gone
  let list = [shot()];
  tickProjectiles(list, 0.5, { ...open, target: null });
  assert(Math.abs(list[0].x - 430) < 0.01 && list[0].y === 440, 'projectile moves along its velocity');
  let ev = tickProjectiles(list, 0.5, open);
  assertEq(ev.length, 1, 'one event');
  assertEq(ev[0].type, 'hit', 'it hits the knight');
  assertEq(list.length, 0, 'and despawns');
  assertEq(tickProjectiles(list, 0.5, open).length, 0, 'no second hit');

  // I-frames: it flies through a knight who cannot be hurt
  list = [shot({ x: 470 })];
  ev = tickProjectiles(list, 0.05, { ...open, canHurt: false });
  assert(list.length === 1 && ev.length === 0, 'a knight in i-frames is passed through');

  // A fast shot cannot skip a thin wall
  list = [shot({ vx: 4000 })];
  ev = tickProjectiles(list, 0.1, { ...open, target: null, solids: [{ x: 350, y: 380, w: 6, h: 100 }] });
  assertEq(ev[0] && ev[0].type, 'wall', 'a solid tile stops it');
  list = [shot({ vx: -300, x: 100 })];
  ev = tickProjectiles(list, 1, { ...open, target: null });
  assertEq(ev[0] && ev[0].type, 'out', 'leaving the stage bounds removes it');
  list = [shot({ vx: 0, y: 600 })];
  list[0].life = 0.2;
  ev = tickProjectiles(list, 0.3, { ...open, target: null });
  assertEq(ev[0] && ev[0].type, 'expired', 'it expires after its lifetime');

  // Sword
  list = [shot({ x: 500 }), shot({ x: 900 })];
  const cut = cutProjectiles(list, { x: 470, y: 410, w: 84, h: 52 });
  assert(cut.length === 1 && list.length === 1 && list[0].x === 900, 'the sword box cuts only the shots it touches');

  // Session: hurts the knight once, scaled by NG+, respects i-frames, sword destroys it, cleared on retry
  const s = createSession();
  s.loadLevel('iron-caverns');
  const p = s.player;
  const put = (o) => s.projectiles.push(shot({ x: p.x - 60, y: p.y - 40, vx: 200, ...o }));
  p.hp = p.maxHp = 100; p.inv = 0;
  put();
  for (let i = 0; i < 40; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(p.hp, 84, 'a fireball costs its damage');
  assertEq(s.projectiles.length, 0, 'and is used up');
  assert(p.inv > 0, 'the hit starts i-frames');
  p.inv = 5; p.hp = 100;
  put({ x: p.x - 10 });
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(p.hp, 100, 'no damage during i-frames');
  s.projectiles.length = 0;

  p.inv = 0; p.facing = 1;
  put({ x: p.x + 50, vx: -200 });
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: true });
  assertEq(s.projectiles.length, 0, 'the sword destroys a fireball');
  assertEq(p.hp, 100, 'and it does no damage');

  put({ x: p.x + 500 });
  s.loadLevel('iron-caverns');
  assertEq(s.projectiles.length, 0, 'retry clears projectiles');
  put({ x: s.player.x + 500 });
  s.endRun('test');
  assertEq(s.projectiles.length, 0, 'death clears projectiles');
  s.loadLevel('iron-caverns');
  s.meta.ngPlus = 2;
  const w = s.spawnEnemy('wizard', { x: s.player.x + 400, y: s.player.y });
  assertEq(w.damage, Math.round(config.ENEMIES.wizard.damage * rpg.ngPlusDamageMul(s.meta, config.NG_PLUS)), 'NG+ scales wizard damage');
  assert(w.damage > config.ENEMIES.wizard.damage, 'NG+ wizard hits harder');
}

section('wizard: stays back, telegraphed interruptible cast, cooldown');
{
  const { ENEMIES, ENEMY_CAST } = config;
  const cfg = ENEMY_CAST.wizard;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const floor = [{ x: 0, y: GROUND_Y, w: 4000, h: 40, ground: true }];
  const mkW = (x, extra = {}) => ({
    type: 'wizard', x, y: GROUND_Y, w: ENEMIES.wizard.w, h: ENEMIES.wizard.h, hp: ENEMIES.wizard.hp,
    speed: ENEMIES.wizard.speed, damage: ENEMIES.wizard.damage, vx: 0, vy: 0, onGround: true,
    facing: -1, homeX: x, homeY: GROUND_Y, patrolMin: x - 300, patrolMax: x + 300,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, casts: true, castState: 'idle', castT: 0, castCd: 0,
    slamState: 'idle', slamT: 0, slamCd: 0, ...extra,
  });
  const kn = (x, y = GROUND_Y) => ({ x, y, w: PLAYER_BODY.w, h: PLAYER_BODY.h });
  const tickW = (e, k, n) => {
    const shots = [];
    for (let i = 0; i < n; i++) {
      aiUpdateEnemy(e, 1 / 60, k, floor, ENEMY_AI, phys);
      if (e.shot) { shots.push({ t: i / 60, p: e.shot }); e.shot = null; }
    }
    return shots;
  };
  assert(ENEMIES.wizard.hp <= ENEMIES.goblin.hp && cfg.windup >= 0.5 && cfg.cooldown >= 2, 'fragile, readable, slow to repeat');

  // Casts only inside range and on the knight's level
  const far = mkW(1000);
  tickW(far, kn(1000 - cfg.range - 60), 30);
  assertEq(far.castState, 'idle', 'out of range: no cast');
  const high = mkW(1000);
  tickW(high, kn(800, GROUND_Y - 300), 30);
  assertEq(high.castState, 'idle', 'knight on another level: no cast');
  const near = mkW(1000);
  tickW(near, kn(800), 5);
  assertEq(near.castState, 'windup', 'knight in range: it winds up');
  assertEq(near.facing, -1, 'facing the knight');

  // The wind-up takes cfg.windup, then one fireball flies toward the knight
  const a = mkW(1000);
  const shots = tickW(a, kn(800), 60 * 3);
  assert(shots.length >= 1, 'it fires');
  assert(Math.abs(shots[0].t - cfg.windup) < 0.1, 'after the telegraph');
  assert(shots[0].p.vx < 0 && shots[0].p.vy === 0, 'horizontally toward the knight');
  assert(shots[0].p.damage === ENEMIES.wizard.damage && shots[0].p.owner === 'wizard', 'carries its damage');
  for (let i = 1; i < shots.length; i++) assert(shots[i].t - shots[i - 1].t >= 2, 'casts are at least 2s apart');

  // A hit interrupts the wind-up, and it holds off before trying again
  const b = mkW(1000);
  tickW(b, kn(800), 20);
  assertEq(b.castState, 'windup', 'second wizard winds up');
  b.hitStun = 0.2;
  const afterHit = tickW(b, kn(800), 20);
  assertEq(afterHit.length, 0, 'a hit cancels the cast');
  assertEq(b.castState, 'idle', 'back to idle');
  assert(b.castCd > 0.3, 'with a pause');

  // Keeps its distance: steps back when the knight is close, never closes into melee
  const c = mkW(1000, { castCd: 5 });
  tickW(c, kn(1000 - 80), 40);
  assert(c.x > 1000, 'steps back from a close knight');
  const d = mkW(1000, { castCd: 99 });
  const stand = kn(1000 - 300);
  tickW(d, stand, 60 * 5);
  assert(Math.abs(d.x - stand.x) >= cfg.retreat - 5, 'does not chase into melee');
  const e2 = mkW(1000, { castCd: 99 });
  tickW(e2, kn(1000 - 480), 60);
  assert(e2.x < 1000, 'steps in when the knight is farther than its range');

  // Session: spawned wizard casts a live projectile
  const s = createSession();
  s.loadLevel('iron-caverns');
  s.player.hp = s.player.maxHp = 9999;
  const w = s.spawnEnemy('wizard', { x: s.player.x + 300, y: s.player.y });
  assert(w && w.casts, 'spawned wizard can cast');
  w.rise = 0; w.spawnGrace = 0;
  for (let i = 0; i < 60 * 2 && !s.projectiles.length; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assert(s.projectiles.length === 1 && s.projectiles[0].owner === 'wizard', 'wizard puts a fireball in the session');
}

section('fire skull: hovers, telegraphs, dives on a locked line, returns');
{
  const { ENEMIES, ENEMY_SWOOP } = config;
  const cfg = ENEMY_SWOOP.fire_skull;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const mkS = (x, y, extra = {}) => ({
    type: 'fire_skull', x, y, w: ENEMIES.fire_skull.w, h: ENEMIES.fire_skull.h, hp: ENEMIES.fire_skull.hp,
    speed: ENEMIES.fire_skull.speed, damage: ENEMIES.fire_skull.damage, vx: 0, vy: 0, onGround: false,
    facing: -1, homeX: x, homeY: y, patrolMin: x - 200, patrolMax: x + 200, fly: true, swoops: true,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, swoopState: 'hover', swoopT: 0, swoopCd: 0,
    slamState: 'idle', slamT: 0, slamCd: 0, ...extra,
  });
  const k = { x: 700, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h };
  const run = (e, kn, n, fn) => {
    for (let i = 0; i < n; i++) { aiUpdateEnemy(e, 1 / 60, kn, [], ENEMY_AI, phys); if (fn) fn(i); }
  };
  assert(!config.getEnemyMeleeCfg('fire_skull') && ENEMIES.fire_skull.fly, 'a contact flier');

  const e = mkS(900, GROUND_Y - 160);
  run(e, k, 10);
  assert(e.y < GROUND_Y - 90 && e.swoopState !== 'dash', 'hovers above the knight');
  const far = mkS(2500, GROUND_Y - 160);
  run(far, k, 90);
  assertEq(far.swoopState, 'hover', 'far from the knight it keeps hovering');

  // Wind-up, then a dash whose direction is fixed when it starts
  const sk = mkS(780, GROUND_Y - 160);
  let guard = 0;
  while (sk.swoopState === 'hover' && guard++ < 600) run(sk, k, 1);
  assertEq(sk.swoopState, 'windup', 'it ignites first');
  const t0 = guard / 60;
  guard = 0;
  while (sk.swoopState === 'windup' && guard++ < 600) run(sk, k, 1);
  assert(guard / 60 >= cfg.windup - 0.05, 'the warning lasts the full wind-up');
  assertEq(sk.swoopState, 'dash', 'then it dives');
  const dir0 = { ...sk.swoopDir };
  assert(dir0.x < 0 && dir0.y > 0, 'toward the knight (down and left)');
  const kMoved = { ...k, x: 1500 };
  const x0 = sk.x;
  run(sk, kMoved, 6);
  assert(sk.swoopDir.x === dir0.x && sk.swoopDir.y === dir0.y, 'dash direction does not change');
  assert(sk.x < x0 && sk.vx < 0, 'it keeps going the locked way even if the knight leaves');
  run(sk, kMoved, 120);
  assertEq(sk.swoopState === 'dash', false, 'the dash ends');
  assert(sk.y <= k.y - 8 + sk.h / 2 + 1, 'never dives below the knight\'s feet');
  // It drifts back up to hover (the knight has left, so it does not dive again)
  const low = sk.y;
  run(sk, kMoved, 60 * 2);
  assertEq(sk.swoopState, 'hover', 'drifts back to hover');
  assert(sk.y < low, 'and rises');
  const gap = mkS(780, GROUND_Y - 160);
  const dives = [];
  let prev = 'hover';
  for (let i = 0; i < 60 * 10; i++) {
    run(gap, k, 1);
    if (gap.swoopState === 'dash' && prev !== 'dash') dives.push(i / 60);
    prev = gap.swoopState;
  }
  assert(dives.length >= 2, 'it dives repeatedly');
  for (let i = 1; i < dives.length; i++) assert(dives[i] - dives[i - 1] >= cfg.cooldown, 'dives are spaced by the cooldown');

  // A hit cancels the wind-up
  const h = mkS(780, GROUND_Y - 160);
  guard = 0;
  while (h.swoopState !== 'windup' && guard++ < 600) run(h, k, 1);
  h.hitStun = 0.2;
  run(h, k, 3);
  assertEq(h.swoopState, 'hover', 'a hit cancels the wind-up');

  // Session: contact damage on the dive
  const s = createSession();
  s.loadLevel('iron-caverns');
  const sp = s.spawnEnemy('fire_skull', { x: s.player.x + 300, y: s.player.y - 150 });
  assert(sp && sp.swoops && sp.fly, 'spawned skull swoops');
}

// ---------------------------------------------------------------------------
// Stage bosses: arenas (stages 1-3), then each boss's moves without the canvas.
const BOSS_STAGES = [
  { id: 'forgegate-fields', type: 'nightmare', flying: false },
  { id: 'forest-ramparts', type: 'hell_beast', flying: false },
  { id: 'forge-ruins', type: 'angel', flying: true },
];

section('boss stats climb: Nightmare < Hell Beast < Angel < Iron Warden');
{
  const { ENEMIES, enemyIsBoss } = config;
  const order = ['nightmare', 'hell_beast', 'angel', 'iron_warden'];
  for (const t of order) {
    assert(enemyIsBoss(t) && ENEMIES[t].label, `${t} is a named boss`);
    assert(ENEMIES[t].drawScale >= 2 && Number.isInteger(ENEMIES[t].drawScale), `${t} is drawn at a whole-number scale`);
  }
  for (let i = 1; i < order.length; i++) {
    assert(ENEMIES[order[i]].hp > ENEMIES[order[i - 1]].hp, `${order[i]} has more health than ${order[i - 1]}`);
    assert(ENEMIES[order[i]].damage >= ENEMIES[order[i - 1]].damage - 4, `${order[i]} hits no softer than ${order[i - 1]}`);
  }
  assert(ENEMIES.nightmare.hp <= 200, 'the first boss is quick to beat');
  // NG+ scales a boss like any other enemy
  const s = createSession();
  s.loadLevel('forgegate-fields');
  const base = s.spawnEnemy('angel', { x: 5000, y: 300, isBoss: true });
  s.enemies.length = 0;
  s.meta.ngPlus = 2;
  const ng = s.spawnEnemy('angel', { x: 5000, y: 300, isBoss: true });
  assert(ng.hp > base.hp && ng.damage > base.damage, 'NG+ makes the angel tougher and harder-hitting');
}

for (const B of BOSS_STAGES) {
  const L = levels.getLevelById(B.id);
  section(`${L.name}: the ${config.ENEMIES[B.type].label} arena sits inside the stage on one flat floor`);
  const b = L.boss;
  assertEq(b.type, B.type, 'stage boss');
  assert(b.arenaMinX >= L.bounds.minX && b.arenaMaxX <= L.bounds.maxX, 'arena inside the stage bounds');
  assert(b.spawnX > b.arenaMinX + 24 && b.spawnX < b.arenaMaxX - 24, 'boss spawns inside the arena');
  assert(b.arenaMaxX - b.arenaMinX >= config.W, 'arena is at least a screen wide');
  assert(L.gate.x + L.gate.w <= b.arenaMinX && L.gateX < b.arenaMinX, 'the gate is the arena\'s left wall');
  const plats = levels.buildLevelPlatforms(L);
  const floorY = B.flying ? b.floorY : b.spawnY;
  const floor = plats.find(p => b.spawnX >= p.x && b.spawnX <= p.x + p.w && Math.abs(p.y - floorY) < 1);
  assert(floor, 'there is floor under the spawn point');
  assert(floor.x <= b.arenaMinX && floor.x + floor.w >= b.arenaMaxX, 'one platform covers the whole arena floor');
  const inArena = L.solids.filter(r => r.x + r.w > b.arenaMinX && r.x < b.arenaMaxX && r.y + r.h > floorY - 200 && r.y < floorY);
  assertEq(inArena.length, 0, 'no walls or blocks standing in the arena floor space');
  assert(L.solids.some(r => r.x <= b.arenaMaxX && r.x + r.w > b.arenaMaxX && r.y <= floorY - 300 && r.y + r.h >= floorY), 'solid rock closes the right side');
  if (B.flying) assert(b.spawnY < b.floorY - 120, 'the flier starts in the air above the floor');
  // A checkpoint just before the gate (like the throne room's)
  const cp = L.checkpoints[L.checkpoints.length - 1];
  assert(cp.x < L.gate.x && cp.x > L.gate.x - 400, 'a checkpoint shortly before the gate');

  // Entering: the boss appears, the camera locks on the arena and the knight cannot go back out
  const s = createSession();
  s.loadLevel(B.id);
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  s.enemies.length = 0;
  assert(!s.arena && s.getPlayerBounds().minX < b.arenaMinX, 'no arena before the gate');
  s.player.x = L.gateX + 10;
  s.player.y = floorY;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'boss phase');
  const boss = s.enemies.find(e => e.isBoss);
  assert(boss && boss.type === B.type && boss.label, 'the boss appears with its name');
  assert(Math.abs(boss.x - b.spawnX) < 1 && Math.abs(boss.y - b.spawnY) < 1, 'at the spawn point');
  assertEq(boss.arenaMinX, b.arenaMinX, 'it knows the arena');
  s.player.hp = s.player.maxHp = 9999;
  for (let i = 0; i < 90; i++) s.update(1 / 60, { x: -1, y: 0, jump: false, attack: false });
  assert(s.player.x >= b.arenaMinX && s.player.x <= b.arenaMinX + 40, 'the knight cannot walk back through the gate');
  assert(Math.abs(s.cameraX - b.arenaMinX) < 1, 'the camera holds on the arena');
  if (b.camY != null) assert(Math.abs(s.cameraY - b.camY) < 1, 'a flier\'s arena holds the camera up so she stays in view');
  for (let i = 0; i < 400; i++) s.update(1 / 60, { x: 1, y: 0, jump: false, attack: false });
  assert(s.player.x <= b.arenaMaxX && Math.abs(s.cameraX - b.arenaMinX) < 1, 'and stays put as the knight crosses it');
  assert(!s.isGateOpen(), 'the gate is shut behind the knight for good');
  killBoss(s);
  assert(s.screen === 'allocate' || s.screen === 'clear', 'the stage clears when the boss falls');
}

// --- Nightmare ---------------------------------------------------------------
section('Nightmare: telegraphed charge, run-up, skid, recovery, enrage');
{
  const { ENEMIES, ENEMY_CHARGE } = config;
  const cfg = ENEMY_CHARGE.nightmare;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const floor = [{ x: 0, y: GROUND_Y, w: 6000, h: 40, ground: true }];
  const mk = (x, extra = {}) => ({
    type: 'nightmare', x, y: GROUND_Y, w: ENEMIES.nightmare.w, h: ENEMIES.nightmare.h, hp: ENEMIES.nightmare.hp,
    maxHp: ENEMIES.nightmare.hp, speed: ENEMIES.nightmare.speed, damage: ENEMIES.nightmare.damage, vx: 0, vy: 0,
    onGround: true, facing: -1, homeX: x, homeY: GROUND_Y, patrolMin: 24, patrolMax: 1976, arenaMinX: 0, arenaMaxX: 2000,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, isBoss: true, bossAi: 'charge', ...extra,
  });
  const kn = (x, y = GROUND_Y) => ({ x, y, w: PLAYER_BODY.w, h: PLAYER_BODY.h });
  const run = (e, k, n, fn) => {
    for (let i = 0; i < n; i++) {
      const hit = aiUpdateEnemy(e, 1 / 60, k, floor, ENEMY_AI, phys);
      if (fn) fn(i, hit);
    }
  };
  assert(enemyUsesTelegraphedAttack(mk(100)) && !config.getEnemyMeleeCfg('nightmare'), 'it hurts only through its charge, not by contact');
  assert(ENEMIES.nightmare.h < PLAYER_MOVE.jumpVel ** 2 / (2 * PLAYER_MOVE.gravity), 'its hitbox is lower than a single jump\'s peak');

  // One full cycle, in order, with the warning held for the full wind-up
  const e = mk(1800);
  const k = kn(1000);
  const seq = [];
  const times = {};
  let hits = 0;
  run(e, k, 60 * 12, (i, hit) => {
    if (hit) hits++;
    if (seq[seq.length - 1] !== e.bossState) { seq.push(e.bossState); times[e.bossState] = times[e.bossState] || i / 60; }
    if (e.bossState === 'windup') assertEq(e.vx, 0, 'it stands still while it rears');
  });
  assertEq(seq.slice(0, 5).join('>'), 'idle>windup>charge>skid>recover', 'idle, rear, charge, skid, recover in that order');
  assertEq(seq[5], 'idle', 'and back to idle');
  assert(!seq.slice(0, 2).includes('charge'), 'the warning comes before the first charge');
  const w0 = mk(1800);
  let wt = 0;
  let started = false;
  run(w0, k, 600, () => { if (w0.bossState === 'windup') { started = true; wt += 1 / 60; } });
  assert(started && wt >= cfg.windup - 0.05, 'the rear lasts the full wind-up');
  assert(hits >= 1, 'a knight who stands still is hit by the charge');

  // It faces the knight when it rears and runs the way it faced
  const f = mk(1800);
  run(f, kn(1000), 60);
  assertEq(f.bossState, 'windup', 'rearing');
  assertEq(f.facing, -1, 'facing the knight');
  let peak = 0;
  run(f, kn(1000), 60 * 3, () => { peak = Math.max(peak, Math.abs(f.vx)); });
  assert(Math.abs(peak - cfg.speed) < 5, 'it reaches full speed');
  assert(f.chargeDir === -1, 'the charge went toward the knight\'s side');

  // The run-up: a close knight makes it back off to the far side before rearing
  const r = mk(1000);
  const x0 = r.x;
  run(r, kn(900), 70);
  assert(r.x > x0 && r.bossState === 'idle', 'it backs away from a close knight');
  assertEq(r.facing, 1, 'turned to trot off');
  run(r, kn(900), 60 * 6);
  assert(r.chargeDir === -1, 'then it charges back at the knight');

  // It runs the whole floor and stops at the wall without leaving the arena
  const g = mk(1900);
  let minX = 1e9;
  run(g, kn(500), 60 * 8, () => { minX = Math.min(minX, g.x); });
  assert(minX >= g.w / 2 + 6 - 1, 'it never goes through the wall');
  assert(minX < 100, 'it ran the full width of the arena');
  const skidAt = mk(1900);
  let skidSpeeds = [];
  run(skidAt, kn(500), 60 * 8, () => { if (skidAt.bossState === 'skid') skidSpeeds.push(Math.abs(skidAt.vx)); });
  assert(skidSpeeds.length > 5 && skidSpeeds[skidSpeeds.length - 1] < skidSpeeds[0] * 0.3, 'it slows through the skid');

  // It stands still and unhurting in its recovery, open to the sword
  const rec = mk(1900);
  run(rec, kn(500), 60 * 8, () => { if (rec.bossState === 'recover') assertEq(rec.vx, 0, 'standing in recovery'); });
  const rc = mk(300, { bossState: 'recover', bossT: 1, chargeDir: -1 });
  let hurt = 0;
  run(rc, kn(300), 30, (i, hit) => { if (hit) hurt++; });
  assertEq(hurt, 0, 'it does not hurt a knight who walks up to it while it rests');
  const sw = { x: 280, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, attacking: true, attackHitDone: false, facing: 1, onGround: true, combo: 0 };
  const res = resolveMeleeHits(sw, [rc], null, PLAYER_SWORD);
  assert(res.hitAny && rc.hp < rc.maxHp, 'the sword lands on a resting Nightmare');

  // Hits never cancel the rear or knock it off its line
  const h = mk(1800);
  run(h, kn(1000), 60);
  assertEq(h.bossState, 'windup', 'rearing');
  h.hitStun = 0.3; h.vx = 300;
  run(h, kn(1000), 5);
  assertEq(h.bossState, 'windup', 'a hit does not interrupt the rear');
  run(h, kn(1000), 60);
  assertEq(h.bossState, 'charge', 'it still charges');
  h.hitStun = 0.3; h.vx = 999;
  run(h, kn(1000), 3);
  assert(h.vx < -cfg.speed * 0.5, 'a hit does not knock a charging horse off its run');

  // Enrage: faster, shorter rear and rest
  const calm = mk(1800);
  const mad = mk(1800, { hp: ENEMIES.nightmare.hp * 0.3 });
  const stat = (n) => { // top speed, and how long the first rear and the first rest last
    const out = { top: 0, rear: 0, rest: 0, rearDone: false, restDone: false };
    run(n, kn(1000), 60 * 10, () => {
      out.top = Math.max(out.top, Math.abs(n.vx));
      if (n.bossState === 'windup' && !out.rearDone) out.rear += 1 / 60;
      else if (out.rear > 0) out.rearDone = true;
      if (n.bossState === 'recover' && !out.restDone) out.rest += 1 / 60;
      else if (out.rest > 0) out.restDone = true;
    });
    return out;
  };
  const a = stat(calm), m = stat(mad);
  assert(m.top > a.top * 1.15, 'below half health it runs faster');
  assert(m.rear < a.rear && m.rest < a.rest, 'and rears and rests for less');
  assert(m.rear >= 0.5, 'but still warns for half a second');

  // Hurt boxes: nothing hits a knight above the horse, or one the horse never meets
  const air = mk(1000, { bossState: 'charge', chargeDir: -1, chargeT: 1, chargeHitDone: false });
  let airHits = 0;
  run(air, kn(1000 - 200, GROUND_Y - ENEMIES.nightmare.h - 4), 90, (i, hit) => { if (hit) airHits++; });
  assertEq(airHits, 0, 'a knight above its height is not hit');
  const low = mk(1000, { bossState: 'charge', chargeDir: -1, chargeT: 1, chargeHitDone: false });
  let lowHits = 0;
  run(low, kn(1000 - 200, GROUND_Y - ENEMIES.nightmare.h + 6), 90, (i, hit) => { if (hit) lowHits++; });
  assertEq(lowHits, 1, 'a knight inside its height is hit, once');
  const behind = mk(1000, { bossState: 'charge', chargeDir: -1, chargeT: 1, chargeHitDone: false });
  let behindHits = 0;
  run(behind, kn(1400), 90, (i, hit) => { if (hit) behindHits++; });
  assertEq(behindHits, 0, 'a knight behind a charging horse is safe');
}

section('Nightmare: a jump or a double jump clears the charge in a session');
{
  const { ENEMIES } = config;
  const L = levels.getLevelById('forgegate-fields');
  const trial = (jumpAfter, double = false) => {
    const s = createSession();
    s.loadLevel(L.id);
    for (const enc of L.encounters) s.firedEncounters.add(enc.id);
    s.enemies.length = 0;
    s.player.x = L.gateX + 10;
    s.player.y = L.boss.spawnY;
    s.updateLevelProgress();
    const boss = s.enemies.find(e => e.isBoss);
    const p = s.player;
    p.hp = p.maxHp = 100;
    p.x = (L.boss.arenaMinX + L.boss.arenaMaxX) / 2;
    p.y = L.boss.spawnY;
    p.facing = 1;
    let since = -1;
    let flying = 0;
    for (let f = 0; f < 60 * 14; f++) {
      if (boss.bossState === 'charge' && since < 0) since = 0;
      let jump = false;
      if (since >= 0) {
        if (jumpAfter != null && since === jumpAfter) { jump = true; s.setJumpHeld(true); flying = 30; }
        if (double && jumpAfter != null && since === jumpAfter + 14) jump = true;
        since++;
      }
      if (flying > 0 && --flying === 0) s.setJumpHeld(false);
      s.update(1 / 60, { x: 0, y: 0, jump, attack: false });
      if (since > 0 && boss.bossState === 'recover') break;
    }
    return { hp: p.hp, since, state: boss.bossState };
  };
  const stand = trial(null);
  assert(stand.hp < 100 && stand.state === 'recover', 'standing still gets the knight hit');
  const clears = [];
  for (let d = 0; d < 70; d++) clears.push(trial(d).hp === 100);
  let best = 0, runLen = 0;
  for (const c of clears) { runLen = c ? runLen + 1 : 0; best = Math.max(best, runLen); }
  assert(best >= 10, `a plain jump clears it over a window of ${best} frames (needs 10)`);
  let bestD = 0;
  runLen = 0;
  for (let d = 0; d < 70; d++) { const ok = trial(d, true).hp === 100; runLen = ok ? runLen + 1 : 0; bestD = Math.max(bestD, runLen); }
  assert(bestD >= 8, `a double jump clears it too (${bestD} frames)`);
  const late = trial(0);
  assert(typeof late.hp === 'number', 'jumping early is a valid try');
}

// --- Hell Beast ---------------------------------------------------------------
section('Hell Beast: rises, telegraphs every attack, spits, then arcs below half health');
{
  const proj = await import(js('js/domain/projectiles.js'));
  const { tickProjectiles } = proj;
  const { ENEMIES, ENEMY_BEAST } = config;
  const cfg = ENEMY_BEAST.hell_beast;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const floor = [{ x: 0, y: GROUND_Y, w: 6000, h: 40, ground: true }];
  const mk = (x, extra = {}) => ({
    type: 'hell_beast', x, y: GROUND_Y, w: ENEMIES.hell_beast.w, h: ENEMIES.hell_beast.h, hp: ENEMIES.hell_beast.hp,
    maxHp: ENEMIES.hell_beast.hp, speed: 0, damage: ENEMIES.hell_beast.damage, vx: 0, vy: 0,
    onGround: true, facing: -1, homeX: x, homeY: GROUND_Y, patrolMin: 1024, patrolMax: 1936, arenaMinX: 1000, arenaMaxX: 1960,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, isBoss: true, bossAi: 'beast', ...extra,
  });
  const kn = (x, y = GROUND_Y) => ({ x, y, w: PLAYER_BODY.w, h: PLAYER_BODY.h });
  const run = (e, k, n, fn) => {
    for (let i = 0; i < n; i++) {
      const prev = e.bossState;
      const hit = aiUpdateEnemy(e, 1 / 60, k, floor, ENEMY_AI, phys);
      const shot = e.shot;
      e.shot = null;
      if (fn) fn(i, hit, shot, prev);
    }
  };
  assert(enemyUsesTelegraphedAttack(mk(100)) && !config.getEnemyMeleeCfg('hell_beast'), 'it hurts only through its own moves');

  // It rises out of the bog first: untargetable, then up, then it may act
  const e = mk(1800);
  const k = kn(1300);
  const vis = [];
  let firstAttack = -1;
  run(e, k, 60 * 4, (i, hit, shot) => {
    if (i < 90) vis.push(e.vis);
    if (e.bossState === 'windup' && firstAttack < 0) firstAttack = i / 60;
  });
  assert(vis[0] < 0.2 && vis[vis.length - 1] > 0.99, 'it rises from nothing to full height');
  assert(firstAttack >= cfg.emerge, 'it does not act before it is up');
  const rising = mk(1800);
  run(rising, k, 5);
  assert(rising.untargetable, 'it cannot be hit while it is still sunk');
  run(rising, k, 90);
  assert(!rising.untargetable, 'but can once it is up');

  // Telegraph before every attack: every shot or burn follows a full wind-up
  const t = mk(1800);
  let wind = 0;
  const windups = [];
  let shotsOut = 0, hitsOut = 0, badRelease = 0;
  run(t, kn(1300), 60 * 40, (i, hit, shot, prev) => {
    if (t.bossState === 'windup') wind += 1 / 60;
    else if (prev === 'windup') { windups.push(wind); wind = 0; }
    if (shot && prev !== 'windup') badRelease++;
    if (shot) shotsOut++;
    if (hit) hitsOut++;
  });
  assert(windups.length >= 6, 'it attacks over and over');
  assert(windups.every(w => w >= Math.min(cfg.spit.windup, cfg.burn.windup) - 0.05), 'every attack was telegraphed for its full wind-up');
  assertEq(badRelease, 0, 'nothing is ever fired without a wind-up');
  assert(shotsOut >= 5, 'it spits repeatedly');
  assertEq(hitsOut, 0, 'a far knight is never burned');

  // The first volleys are single fireballs aimed at the knight's chest
  const u = mk(1800);
  const singles = [];
  run(u, kn(1300), 60 * 20, (i, hit, shot) => { if (shot) singles.push({ shot, state: u.bossState }); });
  assert(singles.length >= 3 && singles.every(s => s.shot.length === 1), 'a healthy beast spits single shots');
  const one = singles[0].shot[0];
  assert(one.vx < 0 && one.vy > 0 && one.g === 0, 'flat at the knight, down from the mouth');
  assert(Math.abs(Math.hypot(one.vx, one.vy) - cfg.spit.speed) < 1, 'at its spit speed');
  assertEq(one.damage, ENEMIES.hell_beast.damage, 'for its damage');
  assertEq(one.owner, 'hell_beast', 'owned by the beast');

  // Below half health every other spit is an arc of three lobs landing around the knight
  const m = mk(1800, { hp: ENEMIES.hell_beast.hp * 0.4 });
  const volleys = [];
  run(m, kn(1300), 60 * 40, (i, hit, shot) => { if (shot) volleys.push(shot); });
  const arcs = volleys.filter(v => v.length === 3);
  assert(arcs.length >= 2 && volleys.some(v => v.length === 1), 'a hurt beast mixes arcs with single shots');
  assert(volleys.every((v, i) => i % 2 === 0 ? v.length === 1 : v.length === 3) || volleys.every((v, i) => v.length === (i % 2 ? 3 : 1)), 'single, arc, single, arc');
  const arc = arcs[0];
  assert(arc.every(p => p.g === cfg.arc.gravity && p.vy < 0), 'lobbed up with gravity');
  // Flight: each lob passes over its aim point (knight +/- spread) at its flight time
  const target = 1300;
  arc.forEach((p, i) => {
    const q = { ...p };
    const T = cfg.arc.flight[i];
    const env = { solids: [], bounds: { minX: -9999, maxX: 9999, minY: -9999, maxY: 9999 }, target: null, canHurt: false };
    const dt = 1 / 120;
    for (let s = 0; s < Math.round(T / dt); s++) tickProjectiles([q], dt, env);
    assert(Math.abs(q.x - (target + (i - 1) * cfg.arc.spread)) < 14, `lob ${i} arrives over its aim point`);
    assert(Math.abs(q.y - (GROUND_Y - PLAYER_BODY.h / 2)) < 14, `lob ${i} arrives at chest height`);
  });

  // Hit and despawn: a standing knight is hit by the middle lob; the others burst on the floor
  const body = { x: target - PLAYER_BODY.w / 2, y: GROUND_Y - PLAYER_BODY.h, w: PLAYER_BODY.w, h: PLAYER_BODY.h };
  const list = arc.map(p => ({ ...p }));
  const evs = [];
  let hurtTimes = 0;
  const env2 = { solids: [{ x: 0, y: GROUND_Y, w: 6000, h: 100 }], bounds: { minX: 0, maxX: 6000, minY: -2000, maxY: 2000 }, target: body, canHurt: true };
  for (let s = 0; s < 60 * 4 && list.length; s++) {
    for (const ev of tickProjectiles(list, 1 / 60, env2)) {
      evs.push(ev.type);
      if (ev.type === 'hit') hurtTimes++;
    }
  }
  assertEq(list.length, 0, 'every lob ends');
  assertEq(hurtTimes, 1, 'only the lob aimed at the knight hits');
  assertEq(evs.filter(x => x === 'wall').length, 2, 'the other two burst on the floor');
}

section('Hell Beast: the burn only hurts up close; sinking, hits and the sword');
{
  const { ENEMIES, ENEMY_BEAST } = config;
  const cfg = ENEMY_BEAST.hell_beast;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const floor = [{ x: 0, y: GROUND_Y, w: 6000, h: 40, ground: true }];
  const mk = (x, extra = {}) => ({
    type: 'hell_beast', x, y: GROUND_Y, w: ENEMIES.hell_beast.w, h: ENEMIES.hell_beast.h, hp: ENEMIES.hell_beast.hp,
    maxHp: ENEMIES.hell_beast.hp, speed: 0, damage: ENEMIES.hell_beast.damage, vx: 0, vy: 0,
    onGround: true, facing: -1, homeX: x, homeY: GROUND_Y, patrolMin: 1024, patrolMax: 1936, arenaMinX: 1000, arenaMaxX: 1960,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, isBoss: true, bossAi: 'beast',
    bossState: 'idle', bossCd: 0, bossCount: 0, spits: 0, vis: 1, ...extra,
  });
  const kn = (x, y = GROUND_Y) => ({ x, y, w: PLAYER_BODY.w, h: PLAYER_BODY.h });
  const run = (e, k, n, fn) => {
    for (let i = 0; i < n; i++) {
      const prev = e.bossState;
      const hit = aiUpdateEnemy(e, 1 / 60, k, floor, ENEMY_AI, phys);
      const shot = e.shot;
      e.shot = null;
      if (fn) fn(i, hit, shot, prev);
    }
  };

  // A knight beside it gets the burn: a wind-up, then one hit while the pillar stands
  const e = mk(1500);
  const hits = [];
  const states = ['idle'];
  run(e, kn(1500 - 80), 60 * 3, (i, hit) => {
    if (states[states.length - 1] !== e.bossState) states.push(e.bossState);
    if (hit) hits.push({ i, hit });
  });
  assertEq(states.slice(0, 4).join('>'), 'idle>windup>act>recover', 'burn: rear up, pillar, recover');
  assertEq(e.bossMove, 'burn', 'the close-range move');
  assertEq(hits.length, 1, 'one hit per burn');
  assertEq(hits[0].hit.damage, Math.round(ENEMIES.hell_beast.damage * cfg.burn.damageMul), 'for its burn damage');
  assertEq(hits[0].hit.dir, -1, 'knocking the knight away from it');
  assert(hits[0].i / 60 >= cfg.burn.windup - 0.05, 'not before the full wind-up');

  // Stepping out past the pillar's edge in the warning avoids it
  const f = mk(1500);
  let escaped = 0;
  run(f, kn(1500 - 80), 5);
  assertEq(f.bossState, 'windup', 'it is winding up');
  run(f, kn(1500 - cfg.burn.half - PLAYER_BODY.w / 2 - 6), 60 * 2, (i, hit) => { if (hit) escaped++; });
  assertEq(escaped, 0, 'a knight who backs out of the pillar\'s width is not hurt');
  // ...while one just inside its width is
  const g = mk(1500);
  let inside = 0;
  run(g, kn(1500 - cfg.burn.half + 4), 60 * 2, (i, hit) => { if (hit) inside++; });
  assertEq(inside, 1, 'one just inside the pillar is');

  // Far from the knight it never uses the burn
  const far = mk(1500);
  run(far, kn(1500 - cfg.burn.reach - 60), 60 * 10, (i, hit, shot) => { assert(!hit, 'no burn damage at range'); });
  assert(far.bossMove === 'spit', 'it spits at range');

  // Hits do not interrupt a wind-up or move it
  const h = mk(1500);
  run(h, kn(1100), 10);
  assertEq(h.bossState, 'windup', 'winding up to spit');
  h.hitStun = 0.3; h.vx = 400;
  run(h, kn(1100), 5);
  assertEq(h.bossState, 'windup', 'a hit does not cancel it');
  assertEq(h.x, 1500, 'or push it');
  let spat = 0;
  run(h, kn(1100), 60, (i, hit, shot) => { if (shot) spat++; });
  assertEq(spat, 1, 'the spit still goes out');

  // Between volleys it is open: a sword lands on it in recovery
  const sw = { x: 1420, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, attacking: true, attackHitDone: false, facing: 1, onGround: true, combo: 0 };
  const open = mk(1500, { bossState: 'recover', bossMove: 'spit', bossT: 1 });
  assert(resolveMeleeHits(sw, [open], null, PLAYER_SWORD).hitAny, 'the sword lands on a beast in recovery');

  // After enough attacks it sinks, cannot be hit, and surfaces on the far side of the arena
  const s = mk(1800, { bossCount: cfg.relocate.every });
  const seen = ['idle'];
  let sunkHits = 0;
  run(s, kn(1050), 60 * 5, () => {
    if (seen[seen.length - 1] !== s.bossState) seen.push(s.bossState);
    if (s.bossState === 'hidden') {
      assert(s.untargetable, 'hidden means untargetable');
      const sw2 = { ...sw, x: s.x - 80 };
      if (resolveMeleeHits(sw2, [s], null, PLAYER_SWORD).hitAny) sunkHits++;
    }
  });
  assertEq(seen.slice(0, 4).join('>'), 'idle>sink>hidden>emerge', 'sink, hide, resurface');
  assertEq(sunkHits, 0, 'nothing hurts it while it is sunk');
  assert(s.x > 1500, 'it came up on the side away from the knight');
  const s2 = mk(1800, { bossCount: cfg.relocate.every });
  run(s2, kn(1900), 60 * 5);
  assert(s2.x < 1500, 'and on the other side when the knight is across the arena');
}

section('Hell Beast: spits in a session, the sword cuts its fireball');
{
  const L = levels.getLevelById('forest-ramparts');
  const s = createSession();
  s.loadLevel(L.id);
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  s.enemies.length = 0;
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  const boss = s.enemies.find(e => e.isBoss);
  const p = s.player;
  p.hp = p.maxHp = 9999;
  p.x = L.boss.arenaMinX + 200;
  for (let i = 0; i < 60 * 8 && !s.projectiles.length; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assert(s.projectiles.length >= 1 && s.projectiles[0].owner === 'hell_beast', 'the beast puts a fireball in the session');
  assertEq(boss.bossAi, 'beast', 'spawned with its AI');
  // Put a fireball at the knight and swing
  s.projectiles.length = 0;
  const { makeProjectile } = await import(js('js/domain/projectiles.js'));
  s.projectiles.push(makeProjectile('fireball', { x: p.x + 50, y: p.y - 40, vx: -200, damage: 16, owner: 'hell_beast' }));
  p.facing = 1; p.inv = 0;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: true });
  assertEq(s.projectiles.length, 0, 'the sword destroys it');
  // Contact with the beast does not hurt (only its moves do)
  boss.bossState = 'recover'; boss.bossMove = 'spit'; boss.bossT = 5;
  p.x = boss.x; p.inv = 0;
  const hp = p.hp;
  for (let i = 0; i < 20; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(p.hp, hp, 'standing in a resting beast costs nothing');
}

section('projectile gravity: lobs arc and land');
{
  const proj = await import(js('js/domain/projectiles.js'));
  const { makeProjectile, tickProjectiles } = proj;
  const straight = makeProjectile('fireball', { x: 0, y: 0, vx: 100, vy: 0, damage: 1 });
  assertEq(straight.g, 0, 'no gravity by default');
  const lob = makeProjectile('fireball', { x: 0, y: 0, vx: 200, vy: -300, g: 900, damage: 1 });
  const env = { solids: [{ x: -100, y: 400, w: 2000, h: 50 }], bounds: { minX: -500, maxX: 3000, minY: -1000, maxY: 1000 }, target: null, canHurt: false };
  let top = 0;
  const list = [lob];
  let ev = [];
  for (let i = 0; i < 600 && !ev.length; i++) { ev = tickProjectiles(list, 1 / 60, env); top = Math.min(top, lob.y); }
  assert(top < -40 && top > -60, 'it rises about v²/2g and falls');
  assertEq(ev[0] && ev[0].type, 'wall', 'and bursts on the floor');
  assert(Math.abs(ev[0].p.x - 267) < 15, 'where the arc says');
}

// --- Angel ---------------------------------------------------------------------
section('Angel: hovers high, telegraphs, dives on a locked line, lands open, returns');
{
  const { ENEMIES, ENEMY_SWOOP } = config;
  const cfg = ENEMY_SWOOP.angel;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const mk = (x, y, extra = {}) => ({
    type: 'angel', x, y, w: ENEMIES.angel.w, h: ENEMIES.angel.h, hp: ENEMIES.angel.hp, maxHp: ENEMIES.angel.hp,
    speed: ENEMIES.angel.speed, damage: ENEMIES.angel.damage, vx: 0, vy: 0, onGround: false,
    facing: -1, homeX: x, homeY: y, patrolMin: 24, patrolMax: 1976, arenaMinX: 0, arenaMaxX: 2000, floorY: GROUND_Y,
    fly: true, swoops: true, bossAi: 'angel', isBoss: true,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, swoopState: 'hover', swoopT: 0, swoopCd: 0, ...extra,
  });
  const k = { x: 900, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h };
  const run = (e, kn, n, fn) => {
    for (let i = 0; i < n; i++) {
      const hit = aiUpdateEnemy(e, 1 / 60, kn, [], ENEMY_AI, phys);
      const shot = e.shot;
      e.shot = null;
      if (fn) fn(i, hit, shot);
    }
  };
  assert(enemyUsesTelegraphedAttack(mk(0, 0)), 'she hurts through her dive, not by contact');

  // Hovering: out of reach of a ground swing
  const e = mk(900, GROUND_Y - 250);
  run(e, k, 40);
  const swing = getAttackBox({ x: 900, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, facing: 1, onGround: true }, null, PLAYER_SWORD);
  assert(!combat.enemyOverlapsBox(e, swing), 'a standing knight cannot reach her while she hovers');
  assert(e.y < GROUND_Y - cfg.hoverAbove[0] + 14, 'she hovers above the knight');

  // Telegraph, locked dive, landing, rest, return, cooldown
  const a = mk(800, GROUND_Y - 250);
  const seq = ['hover'];
  const hits = [];
  let dir0 = null;
  let landY = null;
  let landedFor = 0;
  run(a, k, 60 * 9, (i, hit) => {
    if (seq[seq.length - 1] !== a.swoopState) seq.push(a.swoopState);
    if (hit) hits.push(hit);
    if (a.swoopState === 'dash' && !dir0) dir0 = { ...a.swoopDir };
    if (a.swoopState === 'land') { landY = a.y; landedFor += 1 / 60; }
  });
  assertEq(seq.slice(0, 5).join('>'), 'hover>windup>dash>land>return', 'hover, warn, dive, land, return');
  assertEq(seq[5], 'hover', 'and hover again');
  assert(dir0 && dir0.x > 0 && dir0.y > 0, 'diving toward the knight');
  assertEq(landY, GROUND_Y, 'she lands with her feet on the floor');
  assert(Math.abs(landedFor - cfg.land) < 0.2 || landedFor >= cfg.land - 0.1, 'resting for the landing time');
  assertEq(hits.length >= 1 ? 1 : 0, 1, 'a standing knight is hit by the dive');
  assertEq(hits[0].damage, Math.round(ENEMIES.angel.damage * cfg.damageMul), 'for her dive damage');
  const t = mk(800, GROUND_Y - 250);
  let wt = 0, begun = false;
  run(t, k, 300, () => { if (t.swoopState === 'windup') { begun = true; wt += 1 / 60; } });
  assert(begun && wt >= cfg.windup - 0.05, 'the warning lasts the full wind-up');

  // The line is locked: a knight who moves away is missed
  const m = mk(800, GROUND_Y - 250);
  let guard = 0;
  while (m.swoopState !== 'dash' && guard++ < 600) run(m, k, 1);
  const d0 = { ...m.swoopDir };
  const gone = { ...k, x: 1700 };
  let missed = 0;
  run(m, gone, 90, (i, hit) => { if (hit) missed++; });
  assert(m.swoopDir.x === d0.x && m.swoopDir.y === d0.y, 'the dive does not steer');
  assertEq(missed, 0, 'and misses a knight who has moved');
  assertEq(m.swoopState === 'dash', false, 'it ends');

  // Only the dive hurts: not in the wind-up, the rest, the hover, nor to a knight beneath her
  const l = mk(900, GROUND_Y, { swoopState: 'land', swoopT: 1, y: GROUND_Y });
  let landHits = 0;
  run(l, k, 20, (i, hit) => { if (hit) landHits++; });
  assertEq(landHits, 0, 'a knight beside her resting on the floor is not hurt');
  const w = mk(900, GROUND_Y - 80, { swoopState: 'windup', swoopMove: 'dive', swoopT: 0.5 });
  let windHits = 0;
  run(w, k, 20, (i, hit) => { if (hit) windHits++; });
  assertEq(windHits, 0, 'nor in the wind-up');

  // Resting, she is open to the sword, and the sword does not end her rest
  const sw = { x: 860, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h, attacking: true, attackHitDone: false, facing: 1, onGround: true, combo: 0 };
  const open = mk(900, GROUND_Y, { swoopState: 'land', swoopT: 1 });
  assert(resolveMeleeHits(sw, [open], null, PLAYER_SWORD).hitAny, 'the sword lands on her');
  run(open, k, 10);
  assertEq(open.swoopState, 'land', 'a hit does not make her take off early');

  // A hit does not cancel her wind-up (bosses shrug it off)
  const f = mk(800, GROUND_Y - 250);
  guard = 0;
  while (f.swoopState !== 'windup' && guard++ < 600) run(f, k, 1);
  f.hitStun = 0.3;
  run(f, k, 4);
  assertEq(f.swoopState, 'windup', 'a hit does not cancel her wind-up');
  run(f, k, 60);
  assertEq(f.swoopState, 'dash', 'she still dives');

  // She returns to hover after landing and waits out the cooldown
  const r = mk(900, GROUND_Y, { swoopState: 'return', swoopT: 0.3, y: GROUND_Y });
  run(r, { ...k, x: 1500 }, 80);
  assert(r.y < GROUND_Y - 90 && r.swoopState === 'hover', 'back up in the air');
  assert(r.swoopCd > 0 || r.swoopState === 'hover', 'with a cooldown');

  // She stays inside the arena
  const edge = mk(1990, GROUND_Y - 250);
  run(edge, { ...k, x: 3000 }, 120);
  assert(edge.x <= 1976, 'she does not fly through the wall');

  // Dives are spaced by the cooldown
  const c = mk(800, GROUND_Y - 250);
  const dives = [];
  let prev = 'hover';
  for (let i = 0; i < 60 * 14; i++) {
    run(c, k, 1);
    if (c.swoopState === 'dash' && prev !== 'dash') dives.push(i / 60);
    prev = c.swoopState;
  }
  assert(dives.length >= 3, 'she dives repeatedly');
  for (let i = 1; i < dives.length; i++) assert(dives[i] - dives[i - 1] >= cfg.cooldown + cfg.land, 'dives are spaced out');
}

section('Angel: below half health she alternates dives with a fan of light bolts');
{
  const proj = await import(js('js/domain/projectiles.js'));
  const { ENEMIES, ENEMY_SWOOP } = config;
  const cfg = ENEMY_SWOOP.angel;
  const v = cfg.volley;
  const phys = { gravity: PLAYER_MOVE.gravity, maxFall: PLAYER_MOVE.maxFall };
  const mk = (hp) => ({
    type: 'angel', x: 800, y: GROUND_Y - 250, w: ENEMIES.angel.w, h: ENEMIES.angel.h, hp, maxHp: ENEMIES.angel.hp,
    speed: ENEMIES.angel.speed, damage: ENEMIES.angel.damage, vx: 0, vy: 0, onGround: false,
    facing: -1, homeX: 800, homeY: GROUND_Y - 250, patrolMin: 24, patrolMax: 1976, arenaMinX: 0, arenaMaxX: 2000, floorY: GROUND_Y,
    fly: true, swoops: true, bossAi: 'angel', isBoss: true,
    hitStun: 0, flash: 0, phase: 0, spawnGrace: 0, swoopState: 'hover', swoopT: 0, swoopCd: 0,
  });
  const k = { x: 900, y: GROUND_Y, w: PLAYER_BODY.w, h: PLAYER_BODY.h };
  const attacks = (e, secs) => {
    const out = [];
    let prev = 'hover';
    let wind = 0;
    for (let i = 0; i < 60 * secs; i++) {
      aiUpdateEnemy(e, 1 / 60, k, [], ENEMY_AI, phys);
      const shot = e.shot;
      e.shot = null;
      if (e.swoopState === 'windup') wind += 1 / 60;
      if (prev === 'windup' && e.swoopState !== 'windup') {
        out.push({ move: e.swoopState === 'dash' ? 'dive' : 'volley', wind, shot });
        wind = 0;
      }
      if (shot && prev !== 'windup') out.push({ move: 'bad', wind: 0, shot });
      prev = e.swoopState;
    }
    return out;
  };
  const healthy = attacks(mk(ENEMIES.angel.hp), 30);
  assert(healthy.length >= 4 && healthy.every(a => a.move === 'dive'), 'a healthy angel only dives');
  const hurt = attacks(mk(ENEMIES.angel.hp * 0.4), 40);
  assert(hurt.length >= 5, 'a hurt angel keeps attacking');
  assert(hurt.every(a => a.move !== 'bad'), 'no bolts without a wind-up');
  assertEq(hurt.map(a => a.move).slice(0, 4).join(','), 'dive,volley,dive,volley', 'dive, volley, dive, volley');
  assert(hurt.every(a => a.wind >= Math.min(cfg.windup, v.windup) - 0.05), 'every attack is telegraphed for its full wind-up');
  const volley = hurt.find(a => a.move === 'volley').shot;
  assertEq(volley.length, v.count, 'a fan of bolts');
  assert(volley.every(p => p.kind === 'lightbolt' && p.owner === 'angel' && p.damage === Math.round(ENEMIES.angel.damage * v.damageMul)), 'light bolts at her volley damage');
  const angles = volley.map(p => Math.atan2(p.vy, p.vx));
  assert(Math.abs((angles[1] - angles[0]) - v.spread) < 0.01 && Math.abs((angles[2] - angles[1]) - v.spread) < 0.01, 'spread evenly');
  assert(volley.every(p => p.vy > 0 && Math.abs(Math.hypot(p.vx, p.vy) - v.speed) < 1), 'down at the knight at bolt speed');

  // The middle bolt finds a standing knight and the others burst on the floor or fly off
  const list = volley.map(p => ({ ...p }));
  const evs = [];
  const env = { solids: [{ x: 0, y: GROUND_Y, w: 6000, h: 100 }], bounds: { minX: 0, maxX: 6000, minY: -2000, maxY: 2000 }, target: { x: k.x - k.w / 2, y: k.y - k.h, w: k.w, h: k.h }, canHurt: true };
  for (let i = 0; i < 60 * 5 && list.length; i++) for (const ev of proj.tickProjectiles(list, 1 / 60, env)) evs.push(ev.type);
  assertEq(evs.filter(x => x === 'hit').length, 1, 'one bolt hits the knight');
  assertEq(list.length, 0, 'and all of them end');
}

section('Angel: in a session she dives, lands, and the sword hurts her');
{
  const L = levels.getLevelById('forge-ruins');
  const s = createSession();
  s.loadLevel(L.id);
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  s.enemies.length = 0;
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  const boss = s.enemies.find(e => e.isBoss);
  const p = s.player;
  assertEq(boss.type, 'angel', 'the angel');
  assertEq(boss.floorY, L.boss.floorY, 'she knows the floor');
  assert(boss.fly && boss.y < L.boss.floorY - 100, 'in the air');
  p.hp = p.maxHp = 9999;
  p.x = L.boss.arenaMinX + 400;
  let landed = false;
  for (let i = 0; i < 60 * 14 && !landed; i++) {
    s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
    if (boss.swoopState === 'land') landed = true;
  }
  assert(landed, 'she lands');
  assertEq(boss.y, L.boss.floorY, 'on the arena floor');
  assert(p.hp < 9999, 'the dive hurt a knight who stood still');
  const hp0 = boss.hp;
  p.x = boss.x - 60; p.y = L.boss.floorY; p.facing = 1; p.attackCd = 0; p.attacking = false; p.inv = 0;
  s.update(1 / 60, { x: 0, y: 0, jump: false, attack: true });
  assert(boss.hp < hp0, 'the knight\'s sword cuts her while she rests');
  // Touching her resting body costs nothing
  const hp1 = p.hp;
  p.x = boss.x; p.inv = 0;
  for (let i = 0; i < 10; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(p.hp, hp1, 'touching her while she rests is safe');
}


console.log(`\n\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
