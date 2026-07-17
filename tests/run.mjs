#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
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

function loadGame() {
  const files = ['js/config.js', 'js/save.js', 'js/util.js', 'js/audio.js', 'js/game.js'];
  const code = files.map(rel => read(rel)).join('\n;\n');
  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, W, H, GROUND_Y, PLAYER, JUMP_SAFE,
      maxJumpHeight, maxJumpDistance,
      state: () => state, score: () => score, kills: () => kills, wave: () => wave,
      player: () => player, stats: () => stats, platforms: () => platforms,
      enemies: () => enemies, cameraX: () => cameraX,
      setCameraX: (x) => { cameraX = x; },
      startGame, startWave, spawnEnemy, movePlayer, requestJump, setJumpHeld,
      requestAttack, doAttack, killEnemy, addXp, applyUpgrade, hurtPlayer,
      seedPlatforms, generatePlatformsAhead, canReachPlatform, platformsChainReachable,
      makePlatform, defaultStats, UPGRADES, ENEMIES, save,
    };
  `;
  const sandbox = {
    console, Math, performance: { now: () => 0 }, setTimeout: () => 0,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    window: {}, AudioContext: undefined, webkitAudioContext: undefined,
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { timeout: 5000 });
  return sandbox.__TEST__;
}

section('PWA shell');
{
  assert(exists('index.html'), 'index.html');
  assert(exists('js/game.js'), 'game.js');
  assert(exists('js/sprites.js'), 'sprites.js');
  assert(exists('assets/sprites/player/idle.png'), 'knight idle');
  assert(exists('assets/sprites/player/attack.png'), 'knight attack');
  assert(exists('art/cover.jpg'), 'cover');
  assert(exists('icons/icon-192.png'), 'icon');
  assert(exists('assets/CREDITS.md'), 'credits');
  const html = read('index.html');
  assert(!html.includes('data-screen="play"'), 'no full-screen play overlay');
}

section('version ↔ SW');
{
  const m = read('js/config.js').match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert(!!m, 'GAME_VERSION');
  assert(read('sw.js').includes('ironvale-' + m[1]), 'SW cache matches version');
}

section('lifecycle');
{
  const G = loadGame();
  G.startGame();
  assertEq(G.state(), 'play', 'play');
  assert(G.player().onGround, 'on ground');
  assert(G.platforms().length >= 2, 'platforms');
  G.startWave();
  G.spawnEnemy('slime');
  assert(G.enemies().length >= 1, 'spawned');
  G.doAttack();
  assert(G.player().attacking || G.player().attackCd > 0, 'attack started');
}

section('movement + jump');
{
  const G = loadGame();
  G.startGame();
  const dt = 1 / 60;
  const x0 = G.player().x;
  for (let i = 0; i < 10; i++) G.movePlayer(dt, 1, 0, false, false);
  assert(G.player().x > x0, 'runs');
  G.requestJump(); G.setJumpHeld(true);
  G.movePlayer(dt, 0, 0, true, false);
  assert(G.player().vy < 0, 'jumps');
}

section('platform reachability');
{
  const G = loadGame();
  assert(G.maxJumpHeight(1) > 70, 'jump height');
  G.startGame();
  assert(G.platformsChainReachable(G.platforms(), 1, 1), 'seed chain ok');
  G.setCameraX(600);
  G.generatePlatformsAhead();
  assert(G.platformsChainReachable(G.platforms(), 1, 1), 'gen chain ok');
  for (let i = 0; i < 8; i++) {
    G.startGame();
    G.setCameraX(i * 400);
    G.generatePlatformsAhead();
    assert(G.platformsChainReachable(G.platforms(), 1, 1), 'seed ' + i);
  }
  const peak = G.maxJumpHeight(1);
  const dist = G.maxJumpDistance(1, 1);
  const bad = [G.makePlatform(0, G.GROUND_Y, 100), G.makePlatform(100 + dist * 2, G.GROUND_Y - peak, 100)];
  assert(!G.platformsChainReachable(bad, 1, 1), 'detects bad chain');
}

section('combat & level');
{
  const G = loadGame();
  G.startGame();
  G.spawnEnemy('slime');
  const e = G.enemies()[0];
  e.x = G.player().x + 20; e.y = G.player().y; e.hp = 1;
  G.player().facing = 1;
  G.doAttack();
  // force kill if attack range missed in instant frame
  if (G.enemies().length) { e.hp = 0; G.killEnemy(e, 0); }
  assert(G.kills() >= 1, 'kill');
  G.addXp(G.player().xpNext);
  assertEq(G.state(), 'levelup', 'levelup');
  G.applyUpgrade(G.UPGRADES.find(u => u.id === 'dmg'));
  assert(G.stats().damage > G.PLAYER.attackDamage, 'dmg up');
}

section('game over');
{
  const G = loadGame();
  G.startGame();
  G.hurtPlayer(999);
  assertEq(G.state(), 'over', 'over');
}

console.log(`\n\n${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.error(' -', f); process.exit(1); }
process.exit(0);
