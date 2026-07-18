/**
 * World layer: one playable run / session.
 *
 * Owns mutable run state. Domain modules stay pure; adapters (audio, save)
 * are injected so this stays testable without DOM.
 *
 * Primary loop: discrete campaign levels (loadLevel → play → clear | fail).
 * Endless waves are no longer the primary mode.
 */

import {
  PLAYER, PLAYER_BODY, PLAYER_MOVE, PLAYER_SWORD, ENEMIES, ENEMY_AI, CAM, W, GROUND_Y,
  MAX_ENEMIES, MAX_COINS, MAX_PARTICLES, enemyIsBoss, getEnemyMeleeCfg,
} from '../config/index.js';
import { clamp, circleHit, dist, rand, lerp } from '../core/math.js';
import {
  beginMeleeAttack, resolveMeleeHits, hasMeleePriority, getAttackBox,
} from '../domain/combat.js';
import {
  aiUpdateEnemy, aiPatrolBounds, aiCanStandAt, enemyUsesTelegraphedAttack,
} from '../domain/enemyAi.js';
import { makePlatform, canReachPlatform, platformsChainReachable } from '../domain/platforms.js';
import { makePlayer, playerCx, playerCy, integratePlayerMovement } from '../domain/player.js';
import {
  cloneMeta, defaultMeta, applyXp, allocatePoint, attrsToCombatStats, attrsToMaxHp,
  unlockAfterClear, isLevelUnlocked, xpToNext,
} from '../domain/rpg.js';
import {
  getLevelById, listLevels, buildLevelPlatforms, nextLevel,
  cameraLimits, playerWorldLimits,
} from '../domain/levels.js';

const noopAudio = {
  slash() {}, hit() {}, jump() {}, coin() {}, hurt() {},
  levelUp() {}, gameOver() {}, upgrade() {}, explode() {}, click() {},
};

const noopSave = {
  recordGameEnd() {},
  get data() {
    return {
      best: 0, games: 0, bestWave: 0, totalKills: 0, muted: false,
      ...defaultMeta(),
    };
  },
  getMeta() { return defaultMeta(); },
  saveMeta() {},
};

/** @typedef {'menu'|'select'|'play'|'levelup'|'allocate'|'clear'|'over'} SessionScreen */
/** @typedef {'explore'|'boss'|'done'} LevelPhase */

export class GameSession {
  /**
   * @param {{ audio?: object, save?: object }} [deps]
   */
  constructor(deps = {}) {
    this.audio = deps.audio || noopAudio;
    this.save = deps.save || noopSave;
    /** @type {ReturnType<typeof defaultMeta>} */
    this.meta = this._loadMetaFromSave();
    this._initEmpty();
  }

  _loadMetaFromSave() {
    if (this.save && typeof this.save.getMeta === 'function') {
      return cloneMeta(this.save.getMeta());
    }
    return defaultMeta();
  }

  persistMeta() {
    if (this.save && typeof this.save.saveMeta === 'function') {
      this.save.saveMeta(this.meta);
    }
  }

  /** Sync player HUD XP fields from persistent meta. */
  _syncPlayerProgress() {
    const p = this.player;
    if (!p || !this.meta) return;
    p.level = this.meta.level;
    p.xp = this.meta.xp;
    p.xpNext = xpToNext(this.meta.level);
  }

  /** Apply allocated attrs → combat stats + max HP. */
  _applyMetaToRun() {
    this.stats = attrsToCombatStats(this.meta.stats);
    if (this.player) {
      const maxHp = attrsToMaxHp(this.meta.stats);
      this.player.maxHp = maxHp;
      this.player.hp = maxHp;
      this._syncPlayerProgress();
    }
  }

  _initEmpty() {
    /** @type {SessionScreen} */
    this.screen = 'menu';
    this.score = 0;
    this.kills = 0;
    /** Stage order (legacy field name `wave` kept for HUD/save compat). */
    this.wave = 1;
    this.cameraX = 0;
    this.time = 0;
    this.shake = 0;
    this.overReason = '';
    this.player = null;
    this.stats = null;
    this.platforms = [];
    this.enemies = [];
    this.coins = [];
    this.particles = [];
    this.levelChoices = [];
    this.jumpBuffered = 0;
    this.jumpHeld = false;
    this.attackQueued = false;
    /** Points banked this stage (for clear/allocate summary). */
    this.pointsBankedThisStage = 0;

    // ---- level shell ----
    /** @type {import('../domain/levels.js').LevelDef | null} */
    this.level = null;
    /** @type {LevelPhase} */
    this.levelPhase = 'explore';
    /** Fired encounter ids */
    this.firedEncounters = new Set();
    this.bossSpawned = false;
    this.bossDefeated = false;
    /** @type {{ minX: number, maxX: number } | null} */
    this.arena = null;
    this.clearBonusApplied = false;
  }

  // ---- lifecycle ------------------------------------------------------------

  /**
   * Load a campaign level and enter play.
   * @param {string} [levelId] defaults to first stage
   * @returns {boolean}
   */
  loadLevel(levelId) {
    const def = levelId ? getLevelById(levelId) : listLevels()[0];
    if (!def) return false;

    // Refresh meta from save, then enforce unlock
    this.meta = this._loadMetaFromSave();
    if (!isLevelUnlocked(this.meta, def.order)) return false;

    this._initEmpty();
    this.level = def;
    this.wave = def.order;
    this.player = makePlayer();
    this.player.x = def.spawn.x;
    this.player.y = def.spawn.y ?? GROUND_Y;
    this._applyMetaToRun();
    this.platforms = buildLevelPlatforms(def);
    this.cameraX = Math.max(0, def.spawn.x - CAM.focusX);
    this.levelPhase = 'explore';
    this.screen = 'play';
    return true;
  }

  /**
   * Start a run — campaign levels only (no endless waves).
   * @param {string} [levelId]
   */
  startRun(levelId) {
    if (!this.loadLevel(levelId)) {
      this.loadLevel(listLevels()[0]?.id);
    }
  }

  /** Open level select screen. */
  openLevelSelect() {
    this.meta = this._loadMetaFromSave();
    this.screen = 'select';
    this.attackQueued = false;
    this.jumpHeld = false;
  }

  /** Whether a stage order is unlocked in campaign progress. */
  isStageUnlocked(order) {
    return isLevelUnlocked(this.meta, order);
  }

  /**
   * Fail the current stage (death / quit). XP already banked mid-stage is kept.
   * @param {string} [reason]
   */
  endRun(reason) {
    if (this.screen === 'over' || this.screen === 'clear' || this.screen === 'allocate') return;
    this.screen = 'over';
    this.overReason = reason || 'Fallen in battle!';
    this.audio.gameOver();
    this.persistMeta();
    this.save.recordGameEnd(this.score, this.wave, this.kills);
    if (this.player) {
      this.burst(playerCx(this.player), playerCy(this.player), '#c9a227', 24, 160);
    }
  }

  /**
   * Stage clear — boss defeated.
   * Unspent attribute points open the allocate screen (between levels only).
   */
  clearLevel() {
    if (this.screen === 'clear' || this.screen === 'over' || this.screen === 'allocate') return;
    this.levelPhase = 'done';
    if (!this.clearBonusApplied && this.level) {
      this.clearBonusApplied = true;
      this.score += this.level.clearBonus || 0;
      this.addXp(Math.floor((this.level.clearBonus || 0) / 4));
    }
    if (this.level) {
      const maxOrder = listLevels().reduce((m, l) => Math.max(m, l.order), 1);
      unlockAfterClear(this.meta, this.level.order, maxOrder);
    }
    this.persistMeta();
    this.audio.levelUp();
    this.save.recordGameEnd(this.score, this.wave, this.kills);
    if (this.player) {
      this.burst(playerCx(this.player), playerCy(this.player), '#c9a227', 28, 180);
    }
    // Allocate between levels when points are banked; else clear summary.
    this.screen = this.meta.unspentPoints > 0 ? 'allocate' : 'clear';
  }

  /**
   * Spend one unspent point (between levels only).
   * @param {string} attrKey
   * @returns {boolean}
   */
  allocateAttr(attrKey) {
    if (this.screen !== 'allocate' && this.screen !== 'clear') return false;
    if (!allocatePoint(this.meta, attrKey)) return false;
    this.stats = attrsToCombatStats(this.meta.stats);
    this.persistMeta();
    this.audio.upgrade();
    return true;
  }

  /** Leave allocate screen → clear summary (Next stage / menu). */
  finishAllocate() {
    if (this.screen !== 'allocate') return;
    this.persistMeta();
    this.screen = 'clear';
  }

  goMenu() {
    this.persistMeta();
    this.screen = 'menu';
    this.attackQueued = false;
    this.jumpHeld = false;
  }

  /** @returns {import('../domain/levels.js').LevelDef | null} */
  getNextLevel() {
    const n = this.level ? nextLevel(this.level) : null;
    if (!n) return null;
    if (!isLevelUnlocked(this.meta, n.order)) return null;
    return n;
  }

  // ---- input hooks ----------------------------------------------------------

  requestJump() { this.jumpBuffered = PLAYER_MOVE.jumpBuffer; }
  setJumpHeld(h) { this.jumpHeld = !!h; }
  requestAttack() { this.attackQueued = true; }

  // ---- bounds / gate / arena ------------------------------------------------

  /**
   * Active world limits for the player (arena when boss, else level bounds).
   * @returns {{ minX: number, maxX: number }}
   */
  getPlayerBounds() {
    if (this.arena) {
      return {
        minX: this.arena.minX + 20,
        maxX: this.arena.maxX - 20,
      };
    }
    if (this.level) return playerWorldLimits(this.level);
    return { minX: 24, maxX: 1e9 };
  }

  /**
   * Camera clamp for current phase.
   * @returns {{ minX: number, maxX: number }}
   */
  getCameraBounds() {
    if (this.arena) {
      return {
        minX: this.arena.minX,
        maxX: Math.max(this.arena.minX, this.arena.maxX - W),
      };
    }
    if (this.level) return cameraLimits(this.level, W);
    return { minX: 0, maxX: 1e9 };
  }

  /** End-gate world X, or null. */
  getGateX() {
    return this.level ? this.level.gateX : null;
  }

  /** True once gate is reachable (encounters done, not yet in boss). */
  isGateOpen() {
    if (!this.level || this.levelPhase !== 'explore') return false;
    if (this.bossSpawned) return false;
    return this.allEncountersFired() && this.enemies.length === 0;
  }

  allEncountersFired() {
    if (!this.level) return true;
    return this.level.encounters.every(e => this.firedEncounters.has(e.id));
  }

  // ---- particles ------------------------------------------------------------

  burst(x, y, color, n, speed) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.25, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.25, 0.6), max: 0.6, r: rand(1.5, 3), color,
      });
    }
  }

  // ---- spawns ---------------------------------------------------------------

  findPlatformAt(x, preferredY) {
    let best = null;
    let bestDist = Infinity;
    for (const pl of this.platforms) {
      if (x < pl.x - 4 || x > pl.x + pl.w + 4) continue;
      const d = preferredY != null ? Math.abs(pl.y - preferredY) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = pl;
      }
    }
    return best;
  }

  /**
   * @param {string} type
   * @param {{ x?: number, y?: number, isBoss?: boolean }} [opts]
   */
  spawnEnemy(type, opts = {}) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const def = ENEMIES[type] || ENEMIES.slime;
    const scale = 1 + Math.max(0, (this.wave - 1) * 0.04);
    const spawnX = opts.x != null
      ? opts.x
      : (this.cameraX + W + rand(20, 80));
    const pl = this.findPlatformAt(spawnX, opts.y);
    const margin = ENEMY_AI.ledgeMargin + 4;
    let x, y, homePl;
    if (pl) {
      homePl = pl;
      const minX = pl.x + margin;
      const maxX = pl.x + pl.w - margin;
      x = clamp(spawnX, minX, maxX);
      y = pl.y;
    } else {
      x = spawnX;
      y = opts.y != null ? opts.y : GROUND_Y;
      homePl = null;
    }
    const bounds = aiPatrolBounds(x, homePl, ENEMY_AI);
    const bossFlag = !!opts.isBoss || enemyIsBoss(type) || !!def.isBoss;
    const hasMelee = !!(def.hasMelee || def.hasSlam || opts.hasMelee || opts.hasSlam
      || getEnemyMeleeCfg(type));
    const hasSlam = !!(def.hasSlam || opts.hasSlam);
    const meleeCfg = getEnemyMeleeCfg(type);
    // Stagger first attack so packs don't all swing together
    let slamCd = 0;
    if (hasMelee) {
      slamCd = bossFlag ? 0.75 : 0.25 + Math.random() * 0.45;
    }
    const enemy = {
      type, x, y, w: def.w, h: def.h,
      hp: def.hp * scale, maxHp: def.hp * scale,
      speed: def.speed * (0.9 + Math.random() * 0.25),
      score: Math.floor(def.score * (1 + (this.wave - 1) * 0.05)),
      xp: def.xp, color: def.color, damage: def.damage,
      skin: def.skin, frames: def.frames, fw: def.fw, fh: def.fh,
      drawScale: def.drawScale || null,
      label: def.label || null,
      phase: Math.random() * 10, flash: 0, vx: 0, vy: 0,
      onGround: true, facing: -1,
      homeX: x, homeY: y,
      patrolMin: bounds.patrolMin, patrolMax: bounds.patrolMax,
      hitStun: 0,
      isBoss: bossFlag,
      hasMelee,
      hasSlam,
      meleeCfg: meleeCfg || null,
      slamState: 'idle',
      slamT: 0,
      slamCd,
      slamHitDone: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  fireEncounter(enc) {
    if (this.firedEncounters.has(enc.id)) return;
    this.firedEncounters.add(enc.id);
    for (const spec of enc.enemies) {
      this.spawnEnemy(spec.type, { x: spec.x, y: spec.y });
    }
  }

  enterBossArena() {
    if (!this.level || this.bossSpawned) return;
    const b = this.level.boss;
    this.bossSpawned = true;
    this.levelPhase = 'boss';
    this.arena = { minX: b.arenaMinX, maxX: b.arenaMaxX };
    const bossType = b.type || 'boss';
    const boss = this.spawnEnemy(bossType, {
      x: b.spawnX,
      y: b.spawnY ?? GROUND_Y,
      isBoss: true,
    });
    if (boss) {
      const baseHp = ENEMIES[bossType]?.hp ?? ENEMIES.boss.hp;
      boss.hp = baseHp * (1 + (this.wave - 1) * 0.08);
      boss.maxHp = boss.hp;
      boss.patrolMin = b.arenaMinX + 24;
      boss.patrolMax = b.arenaMaxX - 24;
      boss.homeX = boss.x;
      boss.homeY = boss.y;
      boss.isBoss = true;
    }
    this.shake = Math.max(this.shake, 2.5);
  }

  // ---- combat / XP ----------------------------------------------------------

  killEnemy(e, idx) {
    this.score += e.score;
    this.kills += 1;
    const isBoss = enemyIsBoss(e);
    this.burst(e.x, e.y - e.h / 2, e.color, isBoss ? 30 : 12, 140);
    this.audio.explode(isBoss);
    this.shake = Math.max(this.shake, isBoss ? 3 : 1.2);
    const n = isBoss ? 6 : e.type === 'ogre' ? 3 : 1;
    for (let i = 0; i < n && this.coins.length < MAX_COINS; i++) {
      this.coins.push({
        x: e.x + rand(-10, 10), y: e.y - e.h / 2,
        vx: rand(-50, 50), vy: rand(-160, -40),
        r: 7, xp: Math.max(1, Math.floor(e.xp / n) || 1), life: 14,
      });
    }
    this.enemies.splice(idx, 1);
    if (isBoss) {
      this.bossDefeated = true;
      this.clearLevel();
    }
  }

  /**
   * Grant XP (kills / coins / clear bonus).
   * Mid-stage level-ups only bank unspent points — no blessing cards.
   */
  addXp(amount) {
    if (amount <= 0 || !this.meta) return;
    const before = this.meta.unspentPoints;
    const { levelsGained } = applyXp(this.meta, amount);
    this.pointsBankedThisStage += Math.max(0, this.meta.unspentPoints - before);
    this._syncPlayerProgress();
    if (levelsGained > 0) {
      // Soft feedback only — allocation waits until between levels.
      this.audio.levelUp();
      this.persistMeta();
    }
  }

  /** @deprecated Blessing cards removed; use allocateAttr between levels. */
  openLevelUp() {
    /* no-op: mid-stage allocate disabled */
  }

  /** @deprecated */
  applyUpgrade() {
    if (this.screen === 'levelup') this.screen = 'play';
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (!p || p.inv > 0) return;
    if (hasMeleePriority(p, this.stats, PLAYER_SWORD)) return;
    p.hp -= dmg;
    p.inv = PLAYER_MOVE.invuln;
    this.shake = Math.max(this.shake, 2);
    this.audio.hurt();
    this.burst(playerCx(p), playerCy(p), '#e74c3c', 8, 100);
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun('Fallen in battle!');
    }
  }

  getAttackBoxForPlayer(p = this.player) {
    return getAttackBox(p, this.stats, PLAYER_SWORD);
  }

  applyAttackHits() {
    const p = this.player;
    if (!p) return;
    const result = resolveMeleeHits(p, this.enemies, this.stats, PLAYER_SWORD);
    if (!result.hitAny) return;
    for (const hit of result.hits) {
      this.audio.hit();
      this.burst(hit.enemy.x, hit.enemy.y - hit.enemy.h / 2, '#f5e6c8', 8, 100);
      if (hit.killed) this.killEnemy(hit.enemy, hit.index);
    }
    this.shake = Math.max(this.shake, p.attackAir ? 1.6 : 1.1);
  }

  doAttack() {
    const p = this.player;
    if (!p) return;
    if (!beginMeleeAttack(p, this.stats, PLAYER_SWORD)) return;
    this.audio.slash();
    this.applyAttackHits();
  }

  // ---- systems tick ---------------------------------------------------------

  updateCamera(dt) {
    const p = this.player;
    const target = p.x - CAM.focusX;
    this.cameraX = lerp(this.cameraX, target, 1 - Math.exp(-CAM.lerp * dt));
    const camB = this.getCameraBounds();
    this.cameraX = clamp(this.cameraX, camB.minX, camB.maxX);
    if (p.x - this.cameraX < 40) {
      this.cameraX = clamp(p.x - 40, camB.minX, camB.maxX);
    }
  }

  canStandAt(x, refY) {
    return aiCanStandAt(x, refY, this.platforms, ENEMY_AI);
  }

  updateEnemy(e, dt) {
    return aiUpdateEnemy(e, dt, this.player, this.platforms, ENEMY_AI, {
      gravity: PLAYER_MOVE.gravity,
      maxFall: PLAYER_MOVE.maxFall,
    }, e.meleeCfg || getEnemyMeleeCfg(e));
  }

  /** Encounter triggers + boss gate. */
  updateLevelProgress() {
    if (!this.level || this.levelPhase === 'done') return;
    const px = this.player.x;

    if (this.levelPhase === 'explore') {
      for (const enc of this.level.encounters) {
        if (!this.firedEncounters.has(enc.id) && px >= enc.triggerX) {
          this.fireEncounter(enc);
        }
      }
      if (this.isGateOpen() && px >= this.level.gateX) {
        this.enterBossArena();
      }
    }
  }

  /**
   * @param {number} dt
   * @param {{ x: number, y: number, jump: boolean, attack: boolean }} input
   */
  update(dt, input) {
    if (this.screen !== 'play') return;

    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 28);

    if (input.jump) this.requestJump();
    if (input.attack || this.attackQueued) {
      this.attackQueued = false;
      this.doAttack();
    }

    const bounds = this.getPlayerBounds();
    const move = integratePlayerMovement(dt, {
      ix: input.x,
      iy: input.y,
      wantJump: input.jump,
    }, {
      player: this.player,
      stats: this.stats,
      platforms: this.platforms,
      cameraX: this.cameraX,
      jumpBuffered: this.jumpBuffered,
      jumpHeld: this.jumpHeld,
      swordCfg: PLAYER_SWORD,
      worldMinX: bounds.minX,
      worldMaxX: bounds.maxX,
      onJump: () => this.audio.jump(),
      onFellOff: () => this.hurtPlayer(25),
    });
    this.jumpBuffered = move.jumpBuffered;
    if (move.stillSwinging && !this.player.attackHitDone) this.applyAttackHits();

    this.updateCamera(dt);
    if (this.player.inv > 0) this.player.inv -= dt;

    this.updateLevelProgress();
    if (this.screen !== 'play') return;

    const pcx = playerCx(this.player);
    const pcy = playerCy(this.player);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const slamHit = this.updateEnemy(e, dt);
      // Don't cull bosses off-screen; cull far-behind fodder only
      if (!enemyIsBoss(e) && e.x < this.cameraX - 160) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (slamHit && slamHit.hit) {
        this.hurtPlayer(slamHit.damage);
        const kbScale = e.hasSlam ? 0.55 : 0.42;
        this.player.vx = (slamHit.dir || 1) * slamHit.knockback * kbScale;
        this.player.vy = e.hasSlam ? -220 : -160;
        this.player.onGround = false;
        this.shake = Math.max(this.shake, e.hasSlam ? 2.8 : 1.8);
        continue;
      }
      // Melee enemies: damage only from telegraphed attack (not contact-only).
      // Slimes and other contact fodder still use body overlap.
      if (enemyUsesTelegraphedAttack(e)) continue;
      if (circleHit(pcx, pcy, Math.min(this.player.w, this.player.h) * 0.32, e.x, e.y - e.h / 2, e.w * 0.35)) {
        this.hurtPlayer(e.damage);
        this.player.vx += (this.player.x < e.x ? -1 : 1) * 100;
        this.player.vy = -160;
        this.player.onGround = false;
      }
    }
    if (this.screen !== 'play') return;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.life -= dt;
      c.vy += 400 * dt;
      c.vx *= 0.98;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      for (const pl of this.platforms) {
        if (c.x >= pl.x && c.x <= pl.x + pl.w && c.y >= pl.y && c.y <= pl.y + 10 && c.vy > 0) {
          c.y = pl.y;
          c.vy = 0;
          c.vx *= 0.7;
        }
      }
      if (dist(c.x, c.y, pcx, pcy) < 28) {
        this.addXp(c.xp);
        this.score += 3;
        this.audio.coin();
        this.coins.splice(i, 1);
        if (this.screen !== 'play') return;
        continue;
      }
      if (c.life <= 0) this.coins.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.score += dt * 0.8;
  }

  // ---- test / tooling helpers -----------------------------------------------

  /** Snapshot used by render + tests. */
  snapshot() {
    return {
      screen: this.screen,
      score: this.score,
      kills: this.kills,
      wave: this.wave,
      cameraX: this.cameraX,
      time: this.time,
      shake: this.shake,
      overReason: this.overReason,
      player: this.player,
      stats: this.stats,
      platforms: this.platforms,
      enemies: this.enemies,
      coins: this.coins,
      particles: this.particles,
      levelChoices: this.levelChoices,
      level: this.level,
      levelPhase: this.levelPhase,
      bossSpawned: this.bossSpawned,
      bossDefeated: this.bossDefeated,
      arena: this.arena,
      gateX: this.getGateX(),
      gateOpen: this.isGateOpen(),
      meta: this.meta,
      pointsBankedThisStage: this.pointsBankedThisStage,
    };
  }
}

// Re-export domain helpers tests often need
export {
  makePlatform,
  canReachPlatform,
  platformsChainReachable,
  getAttackBox,
  PLAYER,
  PLAYER_SWORD,
  PLAYER_BODY,
  listLevels,
  getLevelById,
};
