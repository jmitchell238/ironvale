/**
 * World layer: one playable run / session.
 *
 * Owns mutable run state and orchestrates world systems. Domain modules stay
 * pure; adapters (audio, save) are injected so this stays testable without DOM.
 *
 * Systems live under world/systems/{player,combat,enemy,camera,level}.
 * Primary loop: discrete campaign levels (loadLevel → play → clear | fail).
 */

import {
  PLAYER, PLAYER_BODY, PLAYER_SWORD, MAX_PARTICLES,
} from '../config/index.js';
import { rand, dist } from '../core/math.js';
import { getAttackBox } from '../domain/combat.js';
import { makePlatform, canReachPlatform, platformsChainReachable } from '../domain/platforms.js';
import { playerCx, playerCy } from '../domain/player.js';
import {
  cloneMeta, defaultMeta, allocatePoint, attrsToCombatStats, attrsToMaxHp,
  isLevelUnlocked, xpToNext, unlockAfterClear,
} from '../domain/rpg.js';
import { listLevels, getLevelById } from '../domain/levels.js';

import { updateCamera, getCameraBounds } from './systems/camera.js';
import {
  doAttack as sysDoAttack,
  applyAttackHits as sysApplyAttackHits,
  killEnemy as sysKillEnemy,
  getAttackBoxForPlayer as sysGetAttackBox,
  addXp as sysAddXp,
} from './systems/combat.js';
import {
  spawnEnemy as sysSpawnEnemy,
  findPlatformAt as sysFindPlatformAt,
  canStandAt as sysCanStandAt,
  updateEnemy as sysUpdateEnemy,
  updateEnemies,
} from './systems/enemy.js';
import {
  getPlayerBounds as sysGetPlayerBounds,
  getGateX as sysGetGateX,
  isGateOpen as sysIsGateOpen,
  allEncountersFired as sysAllEncountersFired,
  fireEncounter as sysFireEncounter,
  enterBossArena as sysEnterBossArena,
  updateLevelProgress as sysUpdateLevelProgress,
  loadLevelIntoSession,
  getNextLevel as sysGetNextLevel,
} from './systems/level.js';
import {
  updatePlayer,
  hurtPlayer as sysHurtPlayer,
  tickPlayerInvuln,
  requestJump as sysRequestJump,
  setJumpHeld as sysSetJumpHeld,
} from './systems/player.js';

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
    return loadLevelIntoSession(this, levelId);
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
    return sysGetNextLevel(this);
  }

  // ---- input hooks ----------------------------------------------------------

  requestJump() { sysRequestJump(this); }
  setJumpHeld(h) { sysSetJumpHeld(this, h); }
  requestAttack() { this.attackQueued = true; }

  // ---- bounds / gate / arena (level system) ---------------------------------

  getPlayerBounds() { return sysGetPlayerBounds(this); }
  getCameraBounds() { return getCameraBounds(this); }
  getGateX() { return sysGetGateX(this); }
  isGateOpen() { return sysIsGateOpen(this); }
  allEncountersFired() { return sysAllEncountersFired(this); }
  fireEncounter(enc) { sysFireEncounter(this, enc); }
  enterBossArena() { sysEnterBossArena(this); }
  updateLevelProgress() { sysUpdateLevelProgress(this); }

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

  // ---- spawns / enemy (enemy system) ----------------------------------------

  findPlatformAt(x, preferredY) { return sysFindPlatformAt(this, x, preferredY); }
  spawnEnemy(type, opts = {}) { return sysSpawnEnemy(this, type, opts); }
  canStandAt(x, refY) { return sysCanStandAt(this, x, refY); }
  updateEnemy(e, dt) { return sysUpdateEnemy(this, e, dt); }

  // ---- combat / XP (combat system) ------------------------------------------

  killEnemy(e, idx) { sysKillEnemy(this, e, idx); }
  addXp(amount) { sysAddXp(this, amount); }

  /** @deprecated Blessing cards removed; use allocateAttr between levels. */
  openLevelUp() {
    /* no-op: mid-stage allocate disabled */
  }

  /** @deprecated */
  applyUpgrade() {
    if (this.screen === 'levelup') this.screen = 'play';
  }

  hurtPlayer(dmg) { sysHurtPlayer(this, dmg); }
  getAttackBoxForPlayer(p = this.player) { return sysGetAttackBox(this, p); }
  applyAttackHits() { sysApplyAttackHits(this); }
  doAttack() { sysDoAttack(this); }

  // ---- camera ---------------------------------------------------------------

  updateCamera(dt) { updateCamera(this, dt); }

  // ---- frame tick -----------------------------------------------------------

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

    updatePlayer(this, dt, input);
    this.updateCamera(dt);
    tickPlayerInvuln(this, dt);

    this.updateLevelProgress();
    if (this.screen !== 'play') return;

    updateEnemies(this, dt);
    if (this.screen !== 'play') return;

    this._updateCoins(dt);
    this._updateParticles(dt);

    this.score += dt * 0.8;
  }

  _updateCoins(dt) {
    const pcx = playerCx(this.player);
    const pcy = playerCy(this.player);
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
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
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
