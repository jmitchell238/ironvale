'use strict';

let state = 'menu';
let score = 0;
let kills = 0;
let wave = 1;
let waveTimer = 0;
let spawnQueue = 0;
let cameraX = 0;
let time = 0;
let shake = 0;
let overReason = '';
let worldGenX = 0;

let player = null;
let stats = null;
let platforms = [];
let enemies = [];
let coins = [];
let particles = [];
let levelChoices = [];

let jumpBuffered = 0;
let jumpHeld = false;
let attackQueued = false;

function defaultStats() {
  return {
    damage: PLAYER.attackDamage,
    attackRate: 1,
    speedMul: 1,
    jumpMul: 1,
    rangeMul: 1,
  };
}

function makePlayer() {
  return {
    x: 80, y: GROUND_Y, w: PLAYER.w, h: PLAYER.h,
    vx: 0, vy: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    inv: 0, level: 1, xp: 0, xpNext: xpForLevel(1),
    facing: 1, onGround: true, coyote: 0, anim: 0,
    attacking: false, attackT: 0, attackCd: 0,
    _owned: {},
  };
}

function playerCx(p) { return p.x; }
function playerCy(p) { return p.y - p.h / 2; }
function playerLeft(p) { return p.x - p.w / 2; }
function playerRight(p) { return p.x + p.w / 2; }
function playerTop(p) { return p.y - p.h; }

function resetRun() {
  score = 0; kills = 0; wave = 1; waveTimer = 0.5; spawnQueue = 0;
  cameraX = 0; time = 0; shake = 0; overReason = ''; worldGenX = 0;
  platforms = []; enemies = []; coins = []; particles = []; levelChoices = [];
  jumpBuffered = 0; jumpHeld = false; attackQueued = false;
  stats = defaultStats();
  player = makePlayer();
  seedPlatforms();
}

function startGame() { resetRun(); state = 'play'; }

function endGame(reason) {
  if (state === 'over') return;
  state = 'over';
  overReason = reason || 'Fallen in battle!';
  sfxGameOver();
  recordGameEnd(score, wave, kills);
  burst(playerCx(player), playerCy(player), '#c9a227', 24, 160);
}

// ---- Platforms (single-jump chain) ------------------------------------------
function jumpPeakHeight(jm) { return maxJumpHeight(jm || 1); }

function canReachPlatform(from, to, jumpMul, speedMul) {
  if (!from || !to) return false;
  const jm = jumpMul || 1, sm = speedMul || 1;
  const rise = from.y - to.y;
  const peak = jumpPeakHeight(jm);
  if (rise > peak * 0.92) return false;
  if (rise > peak * JUMP_SAFE.riseFrac) return false;
  if (rise < -JUMP_SAFE.maxDrop) return false;
  const gap = to.x - (from.x + from.w);
  if (gap <= 0) return true;
  const baseDist = maxJumpDistance(jm, sm);
  let gapFrac = JUMP_SAFE.gapFracSame;
  if (rise > 12) gapFrac = JUMP_SAFE.gapFracUp;
  else if (rise < -30) gapFrac = JUMP_SAFE.gapFracDown;
  if (rise > 0) gapFrac *= lerp(1, 0.72, clamp(rise / (peak * JUMP_SAFE.riseFrac), 0, 1));
  return gap <= baseDist * gapFrac;
}

function platformsChainReachable(list, jm, sm) {
  if (!list || list.length < 2) return true;
  const sorted = list.slice().sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    if (!canReachPlatform(sorted[i - 1], sorted[i], jm, sm)) return false;
  }
  return true;
}

function makePlatform(x, y, w) {
  const ground = y >= GROUND_Y - 2;
  return { x, y: clamp(y, PLAY.top + 90, GROUND_Y), w: Math.max(JUMP_SAFE.minWidth, w), h: ground ? 24 : 14, ground };
}

function seedPlatforms() {
  platforms = [];
  platforms.push(makePlatform(-40, GROUND_Y, 560));
  worldGenX = platforms[0].x + platforms[0].w;
  generatePlatformsAhead();
}

function generatePlatformsAhead() {
  const ahead = cameraX + W * 3 + 200;
  const peak = jumpPeakHeight(1);
  const maxRise = peak * JUMP_SAFE.riseFrac;
  const baseDist = maxJumpDistance(1, 1);

  while (worldGenX < ahead && platforms.length < MAX_PLATFORMS) {
    const prev = platforms[platforms.length - 1];
    let placed = null;
    for (let attempt = 0; attempt < 14 && !placed; attempt++) {
      const roll = Math.random();
      let y;
      if (Math.random() < 0.3) y = GROUND_Y;
      else if (roll < 0.4) y = prev.y + rand(-18, 18);
      else if (roll < 0.75) y = prev.y - rand(-40, maxRise * 0.75);
      else y = prev.y - rand(10, maxRise);
      y = clamp(y, GROUND_Y - maxRise * 1.05, GROUND_Y);
      const riseActual = prev.y - y;
      let gapFrac = JUMP_SAFE.gapFracSame;
      if (riseActual > 12) gapFrac = JUMP_SAFE.gapFracUp;
      else if (riseActual < -30) gapFrac = JUMP_SAFE.gapFracDown;
      if (riseActual > 0) gapFrac *= lerp(1, 0.72, clamp(riseActual / maxRise, 0, 1));
      const maxGap = baseDist * gapFrac;
      const gap = rand(JUMP_SAFE.minGap, Math.max(JUMP_SAFE.minGap + 8, maxGap));
      const cand = makePlatform(prev.x + prev.w + gap, y, rand(JUMP_SAFE.minWidth, JUMP_SAFE.maxWidth));
      if (canReachPlatform(prev, cand, 1, 1)) placed = cand;
    }
    if (!placed) {
      const gap = rand(JUMP_SAFE.minGap, Math.min(56, baseDist * 0.4));
      placed = makePlatform(prev.x + prev.w + gap, Math.min(GROUND_Y, prev.y + rand(0, 24)), rand(110, 160));
    }
    platforms.push(placed);
    worldGenX = placed.x + placed.w;
  }
  platforms = platforms.filter(p => p.x + p.w > cameraX - 200);
}

// ---- Particles / combat helpers ---------------------------------------------
function burst(x, y, color, n, speed) {
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(speed * 0.25, speed);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), max: 0.6, r: rand(1.5, 3), color });
  }
}

function requestJump() { jumpBuffered = PLAYER.jumpBuffer; }
function setJumpHeld(h) { jumpHeld = h; }
function requestAttack() { attackQueued = true; }

function waveEnemyBudget(w) { return Math.floor(WAVE.baseCount + w * WAVE.countRamp); }

function pickEnemyType(w) {
  const roll = Math.random();
  if (w >= 6 && roll < 0.12) return 'ogre';
  if (w >= 3 && roll < 0.3) return 'skeleton';
  if (w >= 2 && roll < 0.55) return 'bandit';
  return 'slime';
}

function findSpawnPlatform(minX) {
  let best = null;
  for (const pl of platforms) {
    if (pl.x + pl.w < minX) continue;
    if (pl.x > minX + W * 1.4) continue;
    if (!best || pl.x < best.x) best = pl;
  }
  return best;
}

function spawnEnemy(type) {
  if (enemies.length >= MAX_ENEMIES) return;
  const def = ENEMIES[type] || ENEMIES.slime;
  const scale = 1 + (wave - 1) * 0.06;
  const spawnX = cameraX + W + rand(20, 80);
  const pl = findSpawnPlatform(spawnX - 40);
  const x = pl ? pl.x + rand(12, Math.max(14, pl.w - 12)) : spawnX;
  const y = pl ? pl.y : GROUND_Y;
  enemies.push({
    type, x, y, w: def.w, h: def.h,
    hp: def.hp * scale, maxHp: def.hp * scale,
    speed: def.speed * (0.9 + Math.random() * 0.25),
    score: Math.floor(def.score * (1 + (wave - 1) * 0.05)),
    xp: def.xp, color: def.color, damage: def.damage,
    skin: def.skin, frames: def.frames, fw: def.fw, fh: def.fh,
    phase: Math.random() * 10, flash: 0, vx: 0, vy: 0,
    onGround: true, facing: -1,
  });
}

function spawnBoss() {
  spawnEnemy('boss');
  const b = enemies[enemies.length - 1];
  if (b) {
    b.x = cameraX + W + 30;
    b.y = GROUND_Y;
    b.hp = ENEMIES.boss.hp * (1 + (wave - 1) * 0.1);
    b.maxHp = b.hp;
  }
}

function startWave() {
  if (wave > 1 && wave % WAVE.bossEvery === 0) {
    spawnBoss();
    spawnQueue = Math.max(0, waveEnemyBudget(wave) - 1);
  } else spawnQueue = waveEnemyBudget(wave);
  waveTimer = Math.max(WAVE.minInterval, WAVE.baseInterval - (wave - 1) * WAVE.ramp);
}

function killEnemy(e, idx) {
  score += e.score;
  kills += 1;
  burst(e.x, e.y - e.h / 2, e.color, e.type === 'boss' ? 30 : 12, 140);
  sfxExplode(e.type === 'boss');
  shake = Math.max(shake, e.type === 'boss' ? 3 : 1.2);
  const n = e.type === 'boss' ? 6 : e.type === 'ogre' ? 3 : 1;
  for (let i = 0; i < n && coins.length < MAX_COINS; i++) {
    coins.push({
      x: e.x + rand(-10, 10), y: e.y - e.h / 2,
      vx: rand(-50, 50), vy: rand(-160, -40),
      r: 7, xp: Math.max(1, Math.floor(e.xp / n) || 1), life: 14,
    });
  }
  enemies.splice(idx, 1);
}

function addXp(amount) {
  player.xp += amount;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext;
    player.level += 1;
    player.xpNext = xpForLevel(player.level);
    openLevelUp();
  }
}

function openLevelUp() {
  const owned = player._owned || (player._owned = {});
  const pool = UPGRADES.filter(u => {
    if (u.id === 'heal') return player.hp < player.maxHp;
    const c = owned[u.id] || 0;
    if (u.max != null && c >= u.max) return false;
    return true;
  });
  shuffle(pool);
  levelChoices = pool.slice(0, 3);
  while (levelChoices.length < 3) levelChoices.push(UPGRADES[0]);
  state = 'levelup';
  sfxLevelUp();
}

function applyUpgrade(up) {
  if (!up || !player) return;
  const owned = player._owned || (player._owned = {});
  owned[up.id] = (owned[up.id] || 0) + 1;
  switch (up.id) {
    case 'dmg': stats.damage *= 1.2; break;
    case 'rate': stats.attackRate *= 1.15; break;
    case 'speed': stats.speedMul *= 1.12; break;
    case 'jump': stats.jumpMul *= 1.12; break;
    case 'range': stats.rangeMul *= 1.2; break;
    case 'hp':
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      break;
    case 'heal':
      player.hp = Math.min(player.maxHp, player.hp + 40);
      break;
  }
  sfxUpgrade();
  levelChoices = [];
  state = 'play';
}

function hurtPlayer(dmg) {
  if (!player || player.inv > 0) return;
  player.hp -= dmg;
  player.inv = PLAYER.invuln;
  shake = Math.max(shake, 2);
  sfxHurt();
  burst(playerCx(player), playerCy(player), '#e74c3c', 8, 100);
  if (player.hp <= 0) {
    player.hp = 0;
    endGame('Fallen in battle!');
  }
}

function doAttack() {
  if (!player || player.attackCd > 0 || player.attacking) return;
  player.attacking = true;
  player.attackT = PLAYER.attackTime / stats.attackRate;
  player.attackCd = PLAYER.attackCooldown / stats.attackRate;
  sfxSlash();

  const range = PLAYER.attackRange * stats.rangeMul;
  const dir = player.facing || 1;
  const ax = player.x + dir * (player.w * 0.2);
  const ay = player.y - player.h * 0.55;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ex = e.x, ey = e.y - e.h / 2;
    const dx = ex - ax;
    if (dir > 0 && dx < -8) continue;
    if (dir < 0 && dx > 8) continue;
    if (dist(ax, ay, ex, ey) > range + e.w * 0.4) continue;
    e.hp -= stats.damage;
    e.flash = 0.12;
    e.vx += dir * 120;
    sfxHit();
    burst(ex, ey, '#f5e6c8', 6, 90);
    if (e.hp <= 0) killEnemy(e, i);
  }
}

// ---- Movement ---------------------------------------------------------------
function movePlayer(dt, ix, iy, wantJump, wantAttack) {
  if (!player || state !== 'play') return;
  if (wantJump) requestJump();
  if (iy < -0.55) requestJump();
  if (wantAttack || attackQueued) {
    attackQueued = false;
    doAttack();
  }

  const spd = PLAYER.runSpeed * stats.speedMul;
  let mx = Math.abs(ix) > 0.08 ? clamp(ix, -1, 1) : 0;
  const targetVx = mx * spd;
  const accel = player.onGround ? 2800 : 1800;
  const control = player.onGround ? 1 : PLAYER.airControl;
  if (Math.abs(targetVx - player.vx) < accel * dt) player.vx = targetVx;
  else player.vx += Math.sign(targetVx - player.vx) * accel * dt * control;

  if (mx > 0.1) player.facing = 1;
  else if (mx < -0.1) player.facing = -1;

  if (jumpBuffered > 0) jumpBuffered -= dt;
  if (player.onGround) player.coyote = PLAYER.coyote;
  else player.coyote = Math.max(0, player.coyote - dt);

  if (jumpBuffered > 0 && player.coyote > 0 && !player.attacking) {
    player.vy = PLAYER.jumpVel * stats.jumpMul;
    player.onGround = false;
    player.coyote = 0;
    jumpBuffered = 0;
    sfxJump();
  }
  if (!jumpHeld && player.vy < -80) player.vy *= 0.55;

  player.vy += PLAYER.gravity * dt;
  if (player.vy > PLAYER.maxFall) player.vy = PLAYER.maxFall;

  player.x += player.vx * dt;
  const minX = cameraX + 24;
  if (player.x < minX) { player.x = minX; player.vx = Math.max(0, player.vx); }

  player.onGround = false;
  player.y += player.vy * dt;

  if (player.vy >= 0) {
    for (const pl of platforms) {
      const left = playerLeft(player), right = playerRight(player);
      if (right <= pl.x + 2 || left >= pl.x + pl.w - 2) continue;
      const prevFeet = player.y - player.vy * dt;
      if ((prevFeet <= pl.y + 6 && player.y >= pl.y) ||
          (player.y >= pl.y - 2 && player.y <= pl.y + Math.max(pl.h + 10, 28) && prevFeet <= pl.y + 20)) {
        player.y = pl.y; player.vy = 0; player.onGround = true; break;
      }
    }
  }

  if (player.y > PLAY.bottom + 80) {
    hurtPlayer(25);
    player.y = GROUND_Y; player.vy = 0;
    player.x = cameraX + CAM.focusX;
    player.inv = PLAYER.invuln;
  }

  if (player.attackCd > 0) player.attackCd -= dt;
  if (player.attacking) {
    player.attackT -= dt;
    if (player.attackT <= 0) player.attacking = false;
  }

  if (player.onGround && Math.abs(player.vx) > 20) player.anim += dt * (Math.abs(player.vx) / PLAYER.runSpeed);
  else if (!player.onGround) player.anim += dt * 0.3;
  else player.anim += dt * 0.45;
}

function updateCamera(dt) {
  const target = player.x - CAM.focusX;
  cameraX = lerp(cameraX, target, 1 - Math.exp(-CAM.lerp * dt));
  if (cameraX < 0) cameraX = 0;
  if (player.x - cameraX < 40) cameraX = player.x - 40;
}

function updateEnemy(e, dt) {
  e.phase += dt;
  if (e.flash > 0) e.flash -= dt;
  const dir = player.x < e.x ? -1 : 1;
  e.facing = dir;
  e.vx = dir * e.speed;
  if (e.type === 'boss') e.vx = clamp((player.x + 80) - e.x, -e.speed, e.speed);

  e.vy += PLAYER.gravity * dt;
  if (e.vy > PLAYER.maxFall) e.vy = PLAYER.maxFall;
  e.x += e.vx * dt;
  e.onGround = false;
  e.y += e.vy * dt;

  if (e.vy >= 0) {
    for (const pl of platforms) {
      if (e.x + e.w / 2 <= pl.x + 2 || e.x - e.w / 2 >= pl.x + pl.w - 2) continue;
      const prev = e.y - e.vy * dt;
      if (prev <= pl.y + 4 && e.y >= pl.y && e.y <= pl.y + pl.h + 10) {
        e.y = pl.y; e.vy = 0; e.onGround = true; break;
      }
    }
  }
  if (e.y > PLAY.bottom + 100) { e.y = GROUND_Y; e.x = cameraX + W + 40; e.vy = 0; }
}

function updatePlay(dt, inputX, inputY, wantJump, wantAttack) {
  if (state !== 'play') return;
  time += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 28);

  movePlayer(dt, inputX, inputY, wantJump, wantAttack);
  updateCamera(dt);
  generatePlatformsAhead();
  if (player.inv > 0) player.inv -= dt;

  const pcx = playerCx(player), pcy = playerCy(player);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    updateEnemy(e, dt);
    if (e.x < cameraX - 120) { enemies.splice(i, 1); continue; }
    if (circleHit(pcx, pcy, Math.min(player.w, player.h) * 0.32, e.x, e.y - e.h / 2, e.w * 0.35)) {
      hurtPlayer(e.damage);
      player.vx += (player.x < e.x ? -1 : 1) * 100;
      player.vy = -160;
      player.onGround = false;
    }
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.life -= dt;
    c.vy += 400 * dt;
    c.vx *= 0.98;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    for (const pl of platforms) {
      if (c.x >= pl.x && c.x <= pl.x + pl.w && c.y >= pl.y && c.y <= pl.y + 10 && c.vy > 0) {
        c.y = pl.y; c.vy = 0; c.vx *= 0.7;
      }
    }
    if (dist(c.x, c.y, pcx, pcy) < 28) {
      addXp(c.xp);
      score += 3;
      sfxCoin();
      coins.splice(i, 1);
      if (state !== 'play') return;
      continue;
    }
    if (c.life <= 0) coins.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }

  waveTimer -= dt;
  if (spawnQueue > 0 && waveTimer <= 0) {
    spawnEnemy(pickEnemyType(wave));
    spawnQueue -= 1;
    waveTimer = Math.max(WAVE.minInterval, WAVE.baseInterval - (wave - 1) * WAVE.ramp) * rand(0.7, 1.15);
  }
  if (spawnQueue <= 0 && enemies.length === 0) {
    wave += 1;
    startWave();
  }
  score += dt * 1.5;
}
