'use strict';

let audioCtx = null;

function ensureAudio() {
  if (save.muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep({ freq = 440, dur = 0.08, type = 'sine', gain = 0.04, slide = 0 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function sfxSlash() { beep({ freq: 280, dur: 0.07, type: 'square', gain: 0.025, slide: 200 }); }
function sfxHit() { beep({ freq: 160, dur: 0.06, type: 'triangle', gain: 0.035, slide: -40 }); }
function sfxJump() { beep({ freq: 320, dur: 0.07, type: 'sine', gain: 0.03, slide: 180 }); }
function sfxCoin() { beep({ freq: 780, dur: 0.06, type: 'sine', gain: 0.03, slide: 220 }); }
function sfxHurt() { beep({ freq: 140, dur: 0.14, type: 'sawtooth', gain: 0.035, slide: -50 }); }
function sfxLevelUp() {
  beep({ freq: 400, dur: 0.08, type: 'sine', gain: 0.04, slide: 120 });
  setTimeout(() => beep({ freq: 560, dur: 0.1, type: 'triangle', gain: 0.035 }), 70);
}
function sfxGameOver() {
  beep({ freq: 240, dur: 0.18, type: 'sawtooth', gain: 0.03, slide: -90 });
  setTimeout(() => beep({ freq: 140, dur: 0.25, type: 'triangle', gain: 0.035, slide: -40 }), 100);
}
function sfxClick() { beep({ freq: 480, dur: 0.04, type: 'square', gain: 0.02 }); }
function sfxUpgrade() { beep({ freq: 520, dur: 0.08, type: 'sine', gain: 0.04, slide: 140 }); }
function sfxExplode(big) {
  beep({ freq: big ? 100 : 160, dur: big ? 0.22 : 0.1, type: 'sawtooth', gain: 0.035, slide: -60 });
}
