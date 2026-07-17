'use strict';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy <= r * r;
}
function aabbHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function resizeCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.floor(W * scale) + 'px';
  cv.style.height = Math.floor(H * scale) + 'px';
  cv.width = Math.floor(W * dpr);
  cv.height = Math.floor(H * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { ctx, scale, dpr };
}
