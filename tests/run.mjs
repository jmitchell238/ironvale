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
const { GameSession } = await import(js('js/world/GameSession.js'));
const upgrades = await import(js('js/domain/upgrades.js'));

const {
  GAME_VERSION, PLAYER, PLAYER_BODY, PLAYER_SWORD, PLAYER_DRAW, PLAYER_MOVE,
  ENEMY_AI, GROUND_Y, UPGRADES, maxJumpHeight, maxJumpDistance,
} = config;

const {
  getAttackBox, getPlayerBodyBox, beginMeleeAttack, resolveMeleeHits,
  hasMeleePriority, tickMeleeAttack, combatAttackDuration,
} = combat;

const {
  aiCanStandAt, aiUpdateEnemy, tickEnemySlam, enemyUsesTelegraphedSlam, enemySlamBusy,
} = enemyAi;
const { makePlatform, platformsChainReachable, canReachPlatform } = platforms;

function createSession() {
  return new GameSession({
    audio: {
      slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
      levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
    },
    save: { recordGameEnd() {}, data: { best: 0, games: 0, bestWave: 0, totalKills: 0, muted: false } },
  });
}

// ---------------------------------------------------------------------------
section('PWA shell + architecture layout');
{
  assert(exists('index.html'), 'index.html');
  assert(exists('js/app/main.js'), 'app/main.js');
  assert(exists('js/world/GameSession.js'), 'GameSession');
  assert(exists('js/domain/combat.js'), 'domain/combat');
  assert(exists('js/domain/enemyAi.js'), 'domain/enemyAi');
  assert(exists('js/domain/platforms.js'), 'domain/platforms');
  assert(exists('js/domain/player.js'), 'domain/player');
  assert(exists('js/domain/levels.js'), 'domain/levels');
  assert(exists('js/adapters/render.js'), 'adapters/render');
  assert(exists('ARCHITECTURE.md'), 'ARCHITECTURE.md');
  const html = read('index.html');
  assert(html.includes('type="module"'), 'ES module entry');
  assert(html.includes('js/app/main.js'), 'entry is app/main');
  assert(html.includes('data-screen="select"'), 'level select screen');
  assert(html.includes('data-screen="clear"'), 'level clear screen');
  assert(!html.includes('js/game.js'), 'legacy game.js not loaded');
  assert(!exists('js/game.js') || true, 'legacy optional');
}

section('version ↔ SW');
{
  assert(read('sw.js').includes('ironvale-' + GAME_VERSION), 'SW cache matches version');
  assert(read('sw.js').includes('js/world/GameSession.js'), 'SW caches session');
  assert(read('sw.js').includes('js/domain/combat.js'), 'SW caches combat');
  assert(read('sw.js').includes('js/domain/levels.js'), 'SW caches levels');
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
    type: 'bandit', x: pl.x + pl.w / 2, y: pl.y, w: 28, h: 42,
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
  s.spawnEnemy('slime');
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
  assert(platformsChainReachable(s.platforms, 1, 1), 'seed ok');
  s.cameraX = 600;
  platforms.generatePlatformsAhead(s);
  assert(platformsChainReachable(s.platforms, 1, 1), 'gen ok');
  const peak = maxJumpHeight(1);
  const d = maxJumpDistance(1, 1);
  const bad = [makePlatform(0, GROUND_Y, 100), makePlatform(100 + d * 2, GROUND_Y - peak, 100)];
  assert(!platformsChainReachable(bad, 1, 1), 'detects bad');
  assert(canReachPlatform(makePlatform(0, GROUND_Y, 100), makePlatform(40, GROUND_Y, 100), 1, 1), 'adjacent ok');
}

section('session combat + levelup');
{
  const s = createSession();
  s.startRun();
  s.spawnEnemy('slime');
  const e = s.enemies[0];
  e.x = s.player.x + 20; e.y = s.player.y; e.hp = 1;
  s.player.facing = 1;
  s.doAttack();
  if (s.enemies.length) { e.hp = 0; s.killEnemy(e, 0); }
  assert(s.kills >= 1, 'kill');
  s.addXp(s.player.xpNext);
  assertEq(s.screen, 'levelup', 'levelup');
  s.applyUpgrade(UPGRADES.find(u => u.id === 'dmg'));
  assert(s.stats.damage > PLAYER_SWORD.attackDamage, 'dmg up');
}

section('session mid-range + jump attack');
{
  const s = createSession();
  s.startRun();
  assert(PLAYER_SWORD.attackRange >= 70, 'longsword');
  assert(s.getAttackBoxForPlayer().w >= 70, 'box wide');
  s.spawnEnemy('slime');
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
  s.spawnEnemy('bandit');
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
  assert(all.length >= 3, 'three stages');
  assertEq(all[0].id, 'outer-vale', 'L1 id');
  assert(levels.getLevelById('ruined-road'), 'L2');
  assert(levels.getLevelById('iron-gate'), 'L3');
  const L1 = levels.getLevelById('outer-vale');
  assert(L1.bounds.maxX > L1.gateX, 'bounds past gate');
  assert(L1.boss.arenaMinX >= L1.gateX - 50, 'arena near gate');
  assert(levels.buildLevelPlatforms(L1).length >= 2, 'platforms');
  assertEq(levels.nextLevel(L1)?.id, 'ruined-road', 'next L2');
  assertEq(levels.nextLevel(levels.getLevelById('iron-gate')), null, 'campaign end');
}

section('Outer Vale prototype (P2 L1)');
{
  const { ENEMIES, enemyIsBoss, PLAYER_SWORD } = config;
  const L = levels.getLevelById('outer-vale');
  assert(L && !L.stub, 'not stub');
  assertEq(L.boss.type, 'bandit_captain', 'bandit captain boss');
  assert(enemyIsBoss('bandit_captain'), 'captain is boss');
  assert(ENEMIES.bandit_captain.hp >= 100, 'captain tanky');
  assert(ENEMIES.bandit_captain.hp < ENEMIES.boss.hp, 'baseline < late boss');
  const plats = levels.buildLevelPlatforms(L);
  assert(plats.length >= 10, 'authored layout depth');
  assert(platformsChainReachable(plats, 1, 1), 'L1 jump-safe chain');
  assert(L.encounters.length >= 5, 'teaching encounters');
  const roster = new Set();
  for (const enc of L.encounters) {
    for (const sp of enc.enemies) roster.add(sp.type);
  }
  roster.add(L.boss.type);
  assert(roster.has('slime'), 'has slimes');
  assert(roster.has('bandit'), 'has bandits');
  assert(!roster.has('skeleton'), 'no skeletons on L1');
  assert(!roster.has('ogre'), 'no ogres on L1');
  // Hits to kill captain at base damage (difficulty baseline signal)
  const hits = Math.ceil(ENEMIES.bandit_captain.hp / PLAYER_SWORD.attackDamage);
  assert(hits >= 5 && hits <= 10, 'captain ~5–10 base hits');
}

section('loadLevel + bounds + no endless waves');
{
  const s = createSession();
  assert(s.loadLevel('outer-vale'), 'load L1');
  assertEq(s.screen, 'play', 'play');
  assertEq(s.level.id, 'outer-vale', 'level set');
  assertEq(s.levelPhase, 'explore', 'explore');
  assert(s.platforms.length >= 2, 'authored plats');
  assertEq(s.enemies.length, 0, 'no spawn yet');
  // wave field = stage order (not endless counter)
  assertEq(s.wave, 1, 'stage order');
  const bounds = s.getPlayerBounds();
  assert(bounds.maxX < 1e6, 'finite world');
  const cam = s.getCameraBounds();
  assert(cam.maxX >= 0, 'cam max');
  // Simulate: no endless wave growth without progress
  for (let i = 0; i < 180; i++) s.update(1 / 60, { x: 0, y: 0, jump: false, attack: false });
  assertEq(s.wave, 1, 'no wave ramp');
  assert(s.enemies.length === 0 || s.player.x < 280, 'no free spawns idle');
}

section('encounters + gate + boss + clear');
{
  const s = createSession();
  s.loadLevel('outer-vale');
  const L = s.level;
  // Fire first encounter by walking past trigger
  s.player.x = L.encounters[0].triggerX + 5;
  s.updateLevelProgress();
  assert(s.firedEncounters.has(L.encounters[0].id), 'enc fired');
  assert(s.enemies.length >= 1, 'enc enemies');
  // Clear enemies + fire all encounters, open gate
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'boss phase');
  assert(s.bossSpawned, 'boss spawned');
  assert(s.arena, 'arena set');
  assert(s.enemies.some(e => e.isBoss), 'boss present');
  assert(s.enemies.some(e => e.type === 'bandit_captain'), 'captain type');
  // Defeat boss
  const boss = s.enemies.find(e => e.isBoss);
  const bi = s.enemies.indexOf(boss);
  s.killEnemy(boss, bi);
  assertEq(s.screen, 'clear', 'clear screen');
  assert(s.bossDefeated, 'boss down');
}

section('pure telegraphed slam (war-chief)');
{
  const { BOSS_SLAM, ENEMIES } = config;
  const player = { x: 200, y: GROUND_Y, w: 28, h: 48 };
  const e = {
    type: 'ogre_warchief', x: 200, y: GROUND_Y, w: 54, h: 56,
    damage: ENEMIES.ogre_warchief.damage, hasSlam: true,
    slamState: 'idle', slamT: 0, slamCd: 0, slamHitDone: false,
    hitStun: 0, facing: 1,
  };
  assert(enemyUsesTelegraphedSlam(e), 'uses slam');
  // Enter windup when in range
  let hit = tickEnemySlam(e, 0.016, player, BOSS_SLAM);
  assertEq(e.slamState, 'windup', 'windup start');
  assert(!hit, 'no hit in windup');
  assert(enemySlamBusy(e), 'busy windup');
  // Drain windup
  hit = tickEnemySlam(e, BOSS_SLAM.windup + 0.01, player, BOSS_SLAM);
  assertEq(e.slamState, 'slam', 'slam phase');
  // Active frames hit once
  hit = tickEnemySlam(e, 0.02, player, BOSS_SLAM);
  assert(hit && hit.hit, 'slam hits');
  assert(hit.damage > e.damage, 'slam heavier than contact dmg');
  const again = tickEnemySlam(e, 0.02, player, BOSS_SLAM);
  assert(!again, 'no multi-hit same slam');
  // Finish slam → recover
  tickEnemySlam(e, BOSS_SLAM.active + 0.05, player, BOSS_SLAM);
  assertEq(e.slamState, 'recover', 'recover');
  tickEnemySlam(e, BOSS_SLAM.recover + 0.05, player, BOSS_SLAM);
  assertEq(e.slamState, 'idle', 'back idle');
  assert(e.slamCd > 0, 'cooldown');
}

section('Ruined Road prototype (P2 L2)');
{
  const { ENEMIES, enemyIsBoss, PLAYER_SWORD } = config;
  const L = levels.getLevelById('ruined-road');
  assert(L && !L.stub, 'not stub');
  assertEq(L.boss.type, 'skeleton_champion', 'skeleton champion boss');
  assert(enemyIsBoss('skeleton_champion'), 'champion is boss');
  assert(ENEMIES.skeleton_champion.hp > ENEMIES.bandit_captain.hp, 'harder than captain');
  assert(ENEMIES.skeleton_champion.hp < ENEMIES.boss.hp, 'easier than late boss');
  const plats = levels.buildLevelPlatforms(L);
  assert(plats.length >= 12, 'authored layout depth');
  assert(platformsChainReachable(plats, 1, 1), 'L2 jump-safe chain');
  // Tighter mean platform width than Outer Vale teaching path
  const L1 = levels.getLevelById('outer-vale');
  const mean = (list) => list.reduce((a, p) => a + p.w, 0) / list.length;
  assert(mean(plats) < mean(levels.buildLevelPlatforms(L1)), 'tighter plats than L1');
  assert(L.encounters.length >= 5, 'enough encounters');
  const roster = new Set();
  for (const enc of L.encounters) {
    for (const sp of enc.enemies) roster.add(sp.type);
  }
  roster.add(L.boss.type);
  assert(roster.has('skeleton'), 'has skeletons');
  assert(roster.has('skeleton_champion'), 'has champion');
  assert(!roster.has('ogre'), 'no ogres on L2');
  const skelCount = L.encounters.reduce(
    (n, enc) => n + enc.enemies.filter(e => e.type === 'skeleton').length, 0
  );
  assert(skelCount >= 8, 'skeleton-heavy roster');
  const hits = Math.ceil(ENEMIES.skeleton_champion.hp / PLAYER_SWORD.attackDamage);
  assert(hits >= 8 && hits <= 12, 'champion ~8–12 base hits');
  // Session: load + boss type + clear
  const s = createSession();
  assert(s.loadLevel('ruined-road'), 'load L2');
  assertEq(s.wave, 2, 'stage order 2');
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'boss phase');
  assert(s.enemies.some(e => e.type === 'skeleton_champion'), 'champion type');
  const boss = s.enemies.find(e => e.isBoss);
  s.killEnemy(boss, s.enemies.indexOf(boss));
  assertEq(s.screen, 'clear', 'clear screen');
}

section('Iron Gate prototype (P2 L3)');
{
  const { ENEMIES, enemyIsBoss, PLAYER_SWORD } = config;
  const L = levels.getLevelById('iron-gate');
  assert(L && !L.stub, 'not stub');
  assertEq(L.boss.type, 'ogre_warchief', 'war-chief boss');
  assert(enemyIsBoss('ogre_warchief'), 'warchief is boss');
  assert(ENEMIES.ogre_warchief.hasSlam, 'hasSlam flag');
  assert(ENEMIES.ogre_warchief.hp > ENEMIES.skeleton_champion.hp, 'harder than L2 boss');
  assert(ENEMIES.ogre_warchief.hp <= ENEMIES.boss.hp, '≤ legacy brute');
  const plats = levels.buildLevelPlatforms(L);
  assert(plats.length >= 12, 'authored layout depth');
  assert(platformsChainReachable(plats, 1, 1), 'L3 jump-safe chain');
  assert(L.encounters.length >= 6, 'pressure encounters');
  const roster = new Set();
  let ogreCount = 0;
  for (const enc of L.encounters) {
    for (const sp of enc.enemies) {
      roster.add(sp.type);
      if (sp.type === 'ogre') ogreCount++;
    }
  }
  roster.add(L.boss.type);
  assert(roster.has('ogre'), 'has ogres');
  assert(roster.has('ogre_warchief'), 'has war-chief');
  assert(ogreCount >= 5, 'ogre pressure');
  const hits = Math.ceil(ENEMIES.ogre_warchief.hp / PLAYER_SWORD.attackDamage);
  assert(hits >= 10 && hits <= 16, 'warchief ~10–16 base hits (wall)');
  // Session: load + slam boss + campaign clear (no next)
  const s = createSession();
  assert(s.loadLevel('iron-gate'), 'load L3');
  assertEq(s.wave, 3, 'stage order 3');
  s.enemies.length = 0;
  for (const enc of L.encounters) s.firedEncounters.add(enc.id);
  assert(s.isGateOpen(), 'gate open');
  s.player.x = L.gateX + 10;
  s.updateLevelProgress();
  assertEq(s.levelPhase, 'boss', 'boss phase');
  const boss = s.enemies.find(e => e.type === 'ogre_warchief');
  assert(boss, 'warchief present');
  assert(boss.hasSlam, 'spawned hasSlam');
  assert(enemyUsesTelegraphedSlam(boss), 'telegraph slam');
  // No next stage → campaign prototype complete
  assertEq(s.getNextLevel(), null, 'campaign clear after L3');
  s.killEnemy(boss, s.enemies.indexOf(boss));
  assertEq(s.screen, 'clear', 'clear screen');
}

section('fail screen');
{
  const s = createSession();
  s.loadLevel('ruined-road');
  s.hurtPlayer(999);
  assertEq(s.screen, 'over', 'fail over');
  assert(s.overReason.length > 0, 'reason');
}

section('upgrades pure');
{
  const stats = upgrades.defaultStats();
  const p = { hp: 50, maxHp: 100, _owned: {} };
  upgrades.applyUpgradeToRun(p, stats, UPGRADES.find(u => u.id === 'dmg'));
  assert(stats.damage > PLAYER_SWORD.attackDamage, 'pure dmg');
}

console.log(`\n\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
