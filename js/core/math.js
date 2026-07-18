/** Pure math / geometry helpers — no game knowledge. */

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

export function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy <= r * r;
}

export function aabbHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Scale canvas to fill window while keeping logical W×H. */
export function resizeCanvas(cv, logicalW, logicalH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const scale = Math.min(window.innerWidth / logicalW, window.innerHeight / logicalH);
  cv.style.width = Math.floor(logicalW * scale) + 'px';
  cv.style.height = Math.floor(logicalH * scale) + 'px';
  cv.width = Math.floor(logicalW * dpr);
  cv.height = Math.floor(logicalH * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return { ctx, scale, dpr };
}
