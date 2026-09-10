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
  assert(exists('ARCHITECTURE.md'), 'ARCHITECTURE.md');
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
  assert(!L1.boss, 'L1 has no in-stage boss');
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
  assert(!L.boss, 'no L1 boss');
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

section('ladders + locked gate + L1 clear (no boss)');
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

  // Fire encounters, open gate, walk in → clear (no boss)
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assert(s.screen === 'allocate' || s.screen === 'clear' || s.levelPhase === 'done', 'cleared via gate');
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

section('stub biomes exist');
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
  s.player.facing = 1;
  s.doAttack();
  assert(s.hitstop > 0, 'hitstop applied');
}

console.log(`\n\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
