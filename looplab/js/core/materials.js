// LOOPLAB — ball materials. Each (material, colour, radius) is rendered once into a
// sprite and reused, so hundreds of shaded balls cost one drawImage each.
import { TAU, makeCanvas, mix, lighten, darken, alpha, hexToRgb, rgbToHsl, clamp } from './util.js';

const cache = new Map();
const MAX_CACHE = 900;

function quantR(r) {
  if (r <= 10) return Math.max(2, Math.round(r));
  const step = Math.log(1.05);
  return Math.round(Math.exp(Math.round(Math.log(r) / step) * step));
}

function toHex(c) {
  const [r, g, b] = hexToRgb(c);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function conic(g, cx, cy, stops, start = 0) {
  if (g.createConicGradient) {
    const cg = g.createConicGradient(start, cx, cy);
    stops.forEach((s, i) => cg.addColorStop(i / (stops.length - 1), s));
    return cg;
  }
  const lg = g.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
  stops.forEach((s, i) => lg.addColorStop(i / (stops.length - 1), s));
  return lg;
}

function spec(g, R, x, y, w, h, a, rot = -0.6) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const sg = g.createRadialGradient(0, 0, 0, 0, 0, w);
  sg.addColorStop(0, `rgba(255,255,255,${a})`);
  sg.addColorStop(0.55, `rgba(255,255,255,${a * 0.45})`);
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.scale(1, h / w);
  g.fillStyle = sg;
  g.beginPath();
  g.arc(0, 0, w, 0, TAU);
  g.fill();
  g.restore();
}

/** Paints a material ball of radius R centred at (c, c). overlayOnly: shading for photo balls. */
function paint(g, c, R, col, mat, overlayOnly = false) {
  col = toHex(col);
  const L = (t) => lighten(col, t), D = (t) => darken(col, t);
  const circle = () => { g.beginPath(); g.arc(c, c, R, 0, TAU); };
  g.save();
  circle();
  g.clip();
  const ox = c - R * 0.38, oy = c - R * 0.42;
  switch (mat) {
    case 'flat': {
      if (!overlayOnly) { g.fillStyle = col; g.fillRect(0, 0, c * 2, c * 2); }
      const lg = g.createLinearGradient(0, c - R, 0, c + R);
      lg.addColorStop(0, 'rgba(255,255,255,0.10)');
      lg.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = lg; g.fillRect(0, 0, c * 2, c * 2);
      break;
    }
    case 'glossy': {
      if (!overlayOnly) {
        const rg = g.createRadialGradient(ox, oy, R * 0.05, c, c, R * 1.05);
        rg.addColorStop(0, L(0.55)); rg.addColorStop(0.35, col); rg.addColorStop(0.85, D(0.35)); rg.addColorStop(1, D(0.55));
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
      } else {
        const rg = g.createRadialGradient(c, c, R * 0.5, c, c, R);
        rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
      }
      // bounce light from below
      const bl = g.createRadialGradient(c + R * 0.25, c + R * 0.75, 0, c + R * 0.25, c + R * 0.75, R * 0.7);
      bl.addColorStop(0, alpha(L(0.3), 0.45)); bl.addColorStop(1, alpha(col, 0));
      g.fillStyle = bl; g.fillRect(0, 0, c * 2, c * 2);
      spec(g, R, c - R * 0.36, c - R * 0.46, R * 0.42, R * 0.24, 0.95);
      spec(g, R, c + R * 0.42, c + R * 0.5, R * 0.12, R * 0.07, 0.4, 0.8);
      break;
    }
    case 'clay': {
      if (!overlayOnly) {
        const rg = g.createRadialGradient(ox, oy, R * 0.1, c, c, R * 1.1);
        rg.addColorStop(0, L(0.22)); rg.addColorStop(0.55, col); rg.addColorStop(1, D(0.42));
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
        // speckle grain (deterministic)
        let s = 1337 + R;
        const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        const n = Math.min(260, R * R * 0.25);
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, d = Math.sqrt(rnd()) * R;
          g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
          g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, Math.max(1, R * 0.04), Math.max(1, R * 0.04));
        }
      } else {
        const rg = g.createRadialGradient(ox, oy, R * 0.1, c, c, R * 1.1);
        rg.addColorStop(0, 'rgba(255,255,255,0.15)'); rg.addColorStop(0.6, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.4)');
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
      }
      break;
    }
    case 'glass': {
      if (!overlayOnly) {
        g.fillStyle = alpha(col, 0.22); g.fillRect(0, 0, c * 2, c * 2);
        const cau = g.createRadialGradient(c + R * 0.1, c + R * 0.55, 0, c + R * 0.1, c + R * 0.55, R * 0.8);
        cau.addColorStop(0, alpha(L(0.5), 0.75)); cau.addColorStop(1, alpha(col, 0));
        g.fillStyle = cau; g.fillRect(0, 0, c * 2, c * 2);
      }
      const rim = g.createRadialGradient(c, c, R * 0.72, c, c, R);
      rim.addColorStop(0, alpha(col, 0)); rim.addColorStop(0.8, alpha(L(0.25), 0.55)); rim.addColorStop(1, alpha(L(0.7), 0.95));
      g.fillStyle = rim; g.fillRect(0, 0, c * 2, c * 2);
      spec(g, R, c - R * 0.4, c - R * 0.48, R * 0.3, R * 0.13, 1);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.arc(c, c, R * 0.78, Math.PI * 0.15, Math.PI * 0.55); g.stroke();
      break;
    }
    case 'jelly': {
      if (!overlayOnly) {
        const rg = g.createRadialGradient(c, c + R * 0.15, R * 0.05, c, c, R);
        rg.addColorStop(0, alpha(L(0.45), 0.92)); rg.addColorStop(0.6, alpha(col, 0.88)); rg.addColorStop(1, alpha(D(0.25), 0.95));
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
      }
      const ig = g.createRadialGradient(c, c + R * 0.45, 0, c, c + R * 0.45, R * 0.6);
      ig.addColorStop(0, alpha(L(0.6), 0.6)); ig.addColorStop(1, alpha(col, 0));
      g.fillStyle = ig; g.fillRect(0, 0, c * 2, c * 2);
      spec(g, R, c - R * 0.3, c - R * 0.42, R * 0.55, R * 0.3, 0.65);
      spec(g, R, c - R * 0.42, c - R * 0.5, R * 0.16, R * 0.1, 0.95);
      break;
    }
    case 'bubble': {
      if (!overlayOnly) { g.fillStyle = alpha(col, 0.08); g.fillRect(0, 0, c * 2, c * 2); }
      const [h] = rgbToHsl(...hexToRgb(col));
      g.lineWidth = R * 0.22;
      g.strokeStyle = conic(g, c, c, [
        `hsla(${h},100%,70%,0.85)`, `hsla(${h + 90},100%,70%,0.6)`, `hsla(${h + 180},100%,75%,0.85)`,
        `hsla(${h + 270},100%,70%,0.6)`, `hsla(${h + 360},100%,70%,0.85)`,
      ], 0.6);
      g.beginPath(); g.arc(c, c, R * 0.95, 0, TAU); g.stroke();
      const fade = g.createRadialGradient(c, c, R * 0.6, c, c, R);
      fade.addColorStop(0, 'rgba(255,255,255,0)'); fade.addColorStop(1, 'rgba(255,255,255,0.35)');
      g.fillStyle = fade; g.fillRect(0, 0, c * 2, c * 2);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.save(); g.translate(c - R * 0.38, c - R * 0.38); g.rotate(-0.7);
      g.fillRect(-R * 0.16, -R * 0.07, R * 0.13, R * 0.13); g.fillRect(-R * 0.01, -R * 0.07, R * 0.13, R * 0.13);
      g.fillRect(-R * 0.16, R * 0.08, R * 0.13, R * 0.1); g.fillRect(-R * 0.01, R * 0.08, R * 0.13, R * 0.1);
      g.restore();
      break;
    }
    case 'pearl': {
      const base = mix(col, '#ffffff', 0.62);
      if (!overlayOnly) {
        const rg = g.createRadialGradient(ox, oy, R * 0.05, c, c, R * 1.05);
        rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.45, base); rg.addColorStop(1, mix(col, '#000000', 0.25));
        g.fillStyle = rg; g.fillRect(0, 0, c * 2, c * 2);
      }
      g.globalAlpha = 0.28;
      g.fillStyle = conic(g, c + R * 0.2, c + R * 0.2, ['#ffd6f6', '#c9f2ff', '#e8ffd6', '#ffe9c9', '#ffd6f6'], 1.2);
      g.fillRect(0, 0, c * 2, c * 2);
      g.globalAlpha = 1;
      spec(g, R, c - R * 0.33, c - R * 0.4, R * 0.5, R * 0.32, 0.75);
      break;
    }
    case 'chrome':
    case 'gold': {
      const tint = mat === 'gold'
        ? ['#fffbe0', '#ffd75e', '#8a5a00', '#3b2400', '#ffcf4a', '#fff3b0']
        : [mix(col, '#ffffff', 0.85), mix(col, '#ffffff', 0.45), mix(col, '#000000', 0.65), mix(col, '#000000', 0.85), mix(col, '#ffffff', 0.35), mix(col, '#ffffff', 0.75)];
      const gt = mat === 'gold' ? tint.map((t) => mix(t, col, 0.18)) : tint;
      if (!overlayOnly) {
        const lg = g.createLinearGradient(0, c - R, 0, c + R);
        lg.addColorStop(0, gt[0]); lg.addColorStop(0.42, gt[1]); lg.addColorStop(0.5, gt[2]);
        lg.addColorStop(0.56, gt[3]); lg.addColorStop(0.78, gt[4]); lg.addColorStop(1, gt[5]);
        g.fillStyle = lg; g.fillRect(0, 0, c * 2, c * 2);
      }
      const ed = g.createRadialGradient(c, c, R * 0.55, c, c, R);
      ed.addColorStop(0, 'rgba(0,0,0,0)'); ed.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = ed; g.fillRect(0, 0, c * 2, c * 2);
      spec(g, R, c - R * 0.35, c - R * 0.5, R * 0.3, R * 0.14, 1);
      spec(g, R, c + R * 0.35, c + R * 0.62, R * 0.25, R * 0.08, 0.55, 0.2);
      break;
    }
  }
  g.restore();
  // crisp edge
  if (mat !== 'bubble') {
    g.strokeStyle = mat === 'glass' ? alpha(lighten(col, 0.6), 0.7) : alpha(darken(col, 0.45), overlayOnly ? 0.6 : 0.5);
    g.lineWidth = Math.max(0.8, R * 0.035);
    g.beginPath(); g.arc(c, c, R - g.lineWidth * 0.5, 0, TAU); g.stroke();
  }
}

function getSprite(col, mat, R, overlayOnly) {
  const key = `${mat}|${col}|${R}|${overlayOnly ? 1 : 0}`;
  let s = cache.get(key);
  if (s) { cache.delete(key); cache.set(key, s); return s; }
  const size = R * 2 + 4;
  const cv = makeCanvas(size, size);
  const g = cv.getContext('2d');
  paint(g, size / 2, R, col, mat, overlayOnly);
  s = { cv, size, R };
  cache.set(key, s);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return s;
}

const glowCache = new Map();
export function glowSprite(col) {
  let s = glowCache.get(col);
  if (s) return s;
  const n = 64;
  const cv = makeCanvas(n * 2, n * 2);
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(n, n, 0, n, n, n);
  const c = hexToRgb(col);
  rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.9)`);
  rg.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},0.45)`);
  rg.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},0.1)`);
  rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, n * 2, n * 2);
  s = cv;
  if (glowCache.size > 300) glowCache.clear();
  glowCache.set(col, s);
  return s;
}

/** Draws an additive halo. */
export function drawGlow(g, x, y, r, col, a = 1) {
  if (a <= 0.01) return;
  const prev = g.globalCompositeOperation, pa = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = pa * clamp(a, 0, 1);
  g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = pa;
  g.globalCompositeOperation = prev;
}

/**
 * Draw a shaded ball.
 * o: { mat, glow (0..1), img (CanvasImageSource), vx, vy (squash), squash (0..1), alpha, rot }
 */
export function drawBall(g, x, y, r, col, o = {}) {
  if (r < 0.5) return;
  const mat = o.mat || 'glossy';
  const glow = o.glow || 0;
  if (glow > 0) drawGlow(g, x, y, r * (2.1 + glow * 0.6), col, 0.55 * glow);
  const R = quantR(Math.min(r * (o.res || 1), 260));
  const pa = g.globalAlpha;
  if (o.alpha != null) g.globalAlpha = pa * o.alpha;
  let sx = 1, sy = 1, ang = 0;
  if (o.vx != null) {
    const sp = Math.hypot(o.vx, o.vy);
    const k = (o.squash ?? (mat === 'jelly' ? 1 : 0.45)) * clamp(sp / 2600, 0, 0.28);
    if (k > 0.01) { sx = 1 + k; sy = 1 - k * 0.8; ang = Math.atan2(o.vy, o.vx); }
  }
  if (o.wobble) { sx *= 1 + o.wobble; sy *= 1 - o.wobble; }
  const transformed = sx !== 1 || sy !== 1 || o.rot;
  if (transformed) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(sx, sy);
    g.rotate(-ang + (o.rot || 0));
    x = 0; y = 0;
  }
  if (o.img) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    const iw = o.img.width || o.img.videoWidth, ih = o.img.height || o.img.videoHeight;
    const k = (2 * r) / Math.min(iw, ih);
    g.drawImage(o.img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
    g.restore();
    const s = getSprite(col, mat, R, true);
    const k2 = r / R;
    g.drawImage(s.cv, x - (s.size / 2) * k2, y - (s.size / 2) * k2, s.size * k2, s.size * k2);
    g.strokeStyle = col; g.lineWidth = Math.max(2, r * 0.07);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  } else {
    const s = getSprite(col, mat, R, false);
    const k = r / R;
    g.drawImage(s.cv, x - (s.size / 2) * k, y - (s.size / 2) * k, s.size * k, s.size * k);
  }
  if (transformed) g.restore();
  g.globalAlpha = pa;
}

export function clearMaterialCache() { cache.clear(); glowCache.clear(); }
