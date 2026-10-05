/* ==========================================================================
   ACE FORGE — hero point cloud.
   ~1.4k–2.8k points morph between the ACE wordmark and gym equipment
   (dumbbell → kettlebell → Olympic plate). Canvas 2D, depth-bucketed draws,
   one draw call per colour, paused when off-screen or the tab is hidden.
   ========================================================================== */
(() => {
  'use strict';

  const canvas = document.querySelector('[data-forge]');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const compact = Math.min(window.innerWidth, window.screen.width || window.innerWidth) < 760;
  const cores = navigator.hardwareConcurrency || 4;
  const N = compact ? 1500 : cores <= 4 ? 2200 : 3000;

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const labelEl = document.querySelector('[data-forge-label]');
  const indexEl = document.querySelector('[data-forge-index]');
  const nextBtn = document.querySelector('[data-forge-next]');
  const hero = canvas.closest('section') || document.body;

  /* Deterministic RNG: the sculpture is identical on every load. */
  let seed = 20160906;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ------------------------------------------------------------------
     Shape samplers. Every shape returns exactly N xyz points (Float32Array).
     ------------------------------------------------------------------ */
  function build(parts, scale) {
    const out = new Float32Array(N * 3);
    const total = parts.reduce((s, p) => s + p.w, 0);
    let i = 0;
    parts.forEach((p, k) => {
      const count = k === parts.length - 1 ? N - i : Math.round((N * p.w) / total);
      for (let c = 0; c < count && i < N; c++, i++) {
        const v = p.f();
        out[i * 3] = v[0] * scale;
        out[i * 3 + 1] = v[1] * scale;
        out[i * 3 + 2] = v[2] * scale;
      }
    });
    // Shuffle so morph pairings are random → particles swirl instead of sliding.
    for (let a = N - 1; a > 0; a--) {
      const b = Math.floor(rnd() * (a + 1));
      for (let j = 0; j < 3; j++) {
        const t = out[a * 3 + j]; out[a * 3 + j] = out[b * 3 + j]; out[b * 3 + j] = t;
      }
    }
    return out;
  }

  // Cylinder along X (x0→x1), radius r, optional bore rin: outer wall + both faces, area-weighted.
  const cylX = (x0, x1, r, rin = 0) => {
    const L = x1 - x0;
    const aWall = TAU * r * L;
    const aFace = Math.PI * (r * r - rin * rin);
    const tot = aWall + 2 * aFace;
    return () => {
      const u = rnd() * tot;
      const th = rnd() * TAU;
      if (u < aWall) return [x0 + rnd() * L, Math.cos(th) * r, Math.sin(th) * r];
      const rr = Math.sqrt(rin * rin + rnd() * (r * r - rin * rin));
      return [u < aWall + aFace ? x0 : x1, Math.cos(th) * rr, Math.sin(th) * rr];
    };
  };
  const mirrorX = (f) => () => { const v = f(); return rnd() < 0.5 ? v : [-v[0], v[1], v[2]]; };

  function dumbbell() {
    return build([
      { w: 1.0, f: cylX(-0.42, 0.42, 0.058) },               // knurled handle
      { w: 0.5, f: mirrorX(cylX(0.42, 0.5, 0.1)) },          // collars
      { w: 4.4, f: mirrorX(cylX(0.5, 0.6, 0.62, 0.1)) },     // plate 1
      { w: 3.6, f: mirrorX(cylX(0.6, 0.69, 0.53, 0.1)) },    // plate 2
      { w: 2.8, f: mirrorX(cylX(0.69, 0.77, 0.43, 0.1)) },   // plate 3
      { w: 0.4, f: mirrorX(cylX(0.77, 0.86, 0.11)) },        // end caps
    ], 1.3);
  }

  function kettlebell() {
    const R = 0.6, cy = -0.22, cut = -0.52;
    const baseR = Math.sqrt(R * R - cut * cut);
    const body = () => {
      const z = rnd() * 2 - 1;
      const th = rnd() * TAU;
      const s = Math.sqrt(1 - z * z);
      let x = s * Math.cos(th) * R;
      let y = z * R;
      let zz = s * Math.sin(th) * R;
      if (y < cut) { const rr = Math.sqrt(rnd()) * baseR; x = rr * Math.cos(th); zz = rr * Math.sin(th); y = cut; }
      return [x, y + cy, zz];
    };
    const Rm = 0.4, rt = 0.075, hy = 0.36;
    const handle = () => {
      const ph = -25 * DEG + rnd() * 230 * DEG;
      const ps = rnd() * TAU;
      const nx = Math.cos(ph), ny = Math.sin(ph);
      return [nx * Rm + rt * Math.cos(ps) * nx, hy + ny * Rm + rt * Math.cos(ps) * ny, rt * Math.sin(ps)];
    };
    return build([{ w: 0.72, f: body }, { w: 0.28, f: handle }], 1.14);
  }

  function plate(label) {
    const sign = () => (rnd() < 0.5 ? -1 : 1);
    const ring = (rin, rout, z) => () => {
      const th = rnd() * TAU;
      const rr = Math.sqrt(rin * rin + rnd() * (rout * rout - rin * rin));
      return [Math.cos(th) * rr, Math.sin(th) * rr, sign() * z];
    };
    const wall = (r, z0, z1) => () => {
      const th = rnd() * TAU;
      return [Math.cos(th) * r, Math.sin(th) * r, sign() * (z0 + rnd() * (z1 - z0))];
    };
    const parts = [
      { w: 1.7, f: ring(0.86, 1.0, 0.09) },    // raised outer lip
      { w: 0.85, f: ring(0.34, 0.86, 0.055) }, // recessed face
      { w: 0.35, f: ring(0.6, 0.615, 0.056) }, // groove detail
      { w: 0.6, f: ring(0.16, 0.34, 0.1) },    // hub
      { w: 0.8, f: wall(1.0, 0, 0.09) },       // outer edge
      { w: 0.22, f: wall(0.86, 0.055, 0.09) },
      { w: 0.2, f: wall(0.34, 0.055, 0.1) },
      { w: 0.22, f: wall(0.16, 0, 0.1) },      // bore
    ];
    if (label) {
      // "20" above the hub and "KG" below it, raised off the front face
      const emboss = (t, w, y0) => () => {
        const [x, y] = pickText(t, 0.5);
        return [x * w, y * w + y0, 0.075];
      };
      parts.push({ w: 1.15, f: emboss(label.top, 0.44, 0.58) });
      parts.push({ w: 0.7, f: emboss(label.bottom, 0.32, -0.6) });
    }
    return build(parts, 0.98);
  }

  // Rasterise brand type and return normalised sample points (width = 1, centred).
  function sampleText(text, res = 1) {
    const W = Math.round(640 * res), H = Math.round(230 * res);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const family = 'Archivo, "Arial Black", Impact, sans-serif';
    try { g.fontStretch = 'expanded'; } catch (e) { /* older engines */ }
    const base = Math.round(170 * res);
    g.font = `900 ${base}px ${family}`;
    const fs = Math.min(base, (base * W * 0.9) / g.measureText(text).width);
    g.font = `900 ${fs}px ${family}`;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2);

    const data = g.getImageData(0, 0, W, H).data;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3]);
    const step = 2;
    const face = [], edge = [];
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (at(x, y) < 128) continue;
        const isEdge = at(x - step, y) < 128 || at(x + step, y) < 128 || at(x, y - step) < 128 || at(x, y + step) < 128;
        (isEdge ? edge : face).push(x, y);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (!face.length) return null;
    const s = 1 / (maxX - minX);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const norm = (arr) => {
      const out = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i += 2) {
        out[i] = (arr[i] - cx) * s;
        out[i + 1] = -(arr[i + 1] - cy) * s;
      }
      return out;
    };
    return { face: norm(face), edge: norm(edge), jitter: step * s, aspect: (maxY - minY) / (maxX - minX) };
  }

  // Pick one sampled point from a text sample: [x, y, isEdge]
  const pickText = (t, edgeBias) => {
    const fromEdge = t.edge.length && rnd() < edgeBias;
    const src = fromEdge ? t.edge : t.face;
    const k = Math.floor(rnd() * (src.length / 2)) * 2;
    return [src[k] + (rnd() - 0.5) * t.jitter, src[k + 1] + (rnd() - 0.5) * t.jitter, fromEdge];
  };

  // ACE wordmark, extruded in Z
  function wordmark(text) {
    const t = sampleText(text);
    if (!t) return null;
    const width = 2.45, depth = 0.16;
    return build([{ w: 1, f: () => {
      const [x, y, e] = pickText(t, 0.42);
      return [x * width, y * width, e ? (rnd() * 2 - 1) * depth : (rnd() < 0.5 ? -depth : depth)];
    } }], 1);
  }

  function scatter() {
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const z = rnd() * 2 - 1, th = rnd() * TAU, s = Math.sqrt(1 - z * z);
      const r = 2.4 + rnd() * 2.6;
      out[i * 3] = s * Math.cos(th) * r;
      out[i * 3 + 1] = z * r * 0.7;
      out[i * 3 + 2] = s * Math.sin(th) * r;
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Specimens
     ------------------------------------------------------------------ */
  const SHAPES = [
    { id: '00', name: 'ACE // IRON DUST', pts: null, mode: 'face', pitch: 0 },
    { id: '01', name: 'DUMBBELL // 2 × 20 KG', pts: dumbbell(), mode: 'sway', yaw: -0.55, amp: 0.6, pitch: 0.4 },
    { id: '02', name: 'KETTLEBELL // 24 KG', pts: kettlebell(), mode: 'sway', yaw: 0.2, amp: 0.6, pitch: 0.22 },
    { id: '03', name: 'OLYMPIC PLATE // 20 KG', pts: plate(), mode: 'sway', yaw: 0.55, amp: 0.55, pitch: 0.22 },
  ];

  // Per-point constants
  const noise = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const delay = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const z = rnd() * 2 - 1, th = rnd() * TAU, s = Math.sqrt(1 - z * z);
    noise[i * 3] = s * Math.cos(th); noise[i * 3 + 1] = z; noise[i * 3 + 2] = s * Math.sin(th);
    phase[i] = rnd() * TAU;
  }
  const MAX_DELAY = 0.32;

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, unit = 1;
  let from = scatter(), to = from;
  let fromShape = 0, toShape = 0, current = -1;
  let morphStart = 0, morphDur = 1, nextAt = Infinity;
  let started = false, visible = true, running = false, raf = 0;
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let explode = 0;
  let last = 0, clock = 0;

  const HOLD_ACE = 2600, HOLD = 3600, MORPH = 1700;

  /* Depth buckets: one fillStyle per bucket → 6 colour switches per frame. */
  const BUCKETS = 6;
  const HOT = 5;
  const bufs = Array.from({ length: BUCKETS }, () => new Float32Array(N * 3));
  const counts = new Int32Array(BUCKETS);
  const COLORS = [
    'rgba(236,233,226,1)',
    'rgba(236,233,226,0.8)',
    'rgba(236,233,226,0.58)',
    'rgba(236,233,226,0.36)',
    'rgba(236,233,226,0.2)',
    '#d7ff3a',
  ];

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W;
    canvas.height = H;
    const wide = window.innerWidth >= 960;
    cx = W * (wide ? 0.52 : 0.5);
    cy = H * (wide ? 0.44 : 0.5);
    unit = Math.min(W * (wide ? 0.3 : 0.3), H * (wide ? 0.29 : 0.38));
    if (!running) draw(performance.now(), true);
  }

  /* ------------------------------------------------------------------
     Label scramble (HUD flavour)
     ------------------------------------------------------------------ */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/×';
  let scrambleT = 0;
  function setLabel(shape) {
    if (indexEl) indexEl.textContent = shape.id;
    if (!labelEl) return;
    clearInterval(scrambleT);
    if (reduce) { labelEl.textContent = shape.name; return; }
    const target = shape.name;
    let frame = 0;
    scrambleT = setInterval(() => {
      frame++;
      const reveal = Math.floor(frame * 1.6);
      let s = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        s += i < reveal || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      labelEl.textContent = s;
      if (reveal >= target.length) clearInterval(scrambleT);
    }, 32);
  }

  /* ------------------------------------------------------------------
     Morph control
     ------------------------------------------------------------------ */
  function morphTo(k, now, dur) {
    from = to;
    fromShape = current < 0 ? k : current;
    to = SHAPES[k].pts;
    toShape = k;
    current = k;
    morphStart = now;
    morphDur = dur;
    nextAt = now + dur + (k === 0 ? HOLD_ACE : HOLD);
    // Wave the morph left→right across the target shape.
    for (let i = 0; i < N; i++) delay[i] = clamp((to[i * 3] + 1.4) / 2.8, 0, 1) * MAX_DELAY;
    setLabel(SHAPES[k]);
  }

  function next(now) {
    if (!started) return;
    const t = now || performance.now();
    if (t - morphStart < morphDur) return; // finish the current morph first
    morphTo((current + 1) % SHAPES.length, t, MORPH);
    if (!running) draw(t, true);
  }

  const rotFor = (shape, t) => {
    let yaw, pitch;
    if (shape.mode === 'spin') {
      yaw = t * 0.45 + mx * 0.9;
      pitch = shape.pitch + my * 0.35;
    } else if (shape.mode === 'sway') {
      yaw = shape.yaw + Math.sin(t * 0.5) * shape.amp + mx * 0.6;
      pitch = shape.pitch + Math.sin(t * 0.33) * 0.12 + my * 0.3;
    } else {
      yaw = Math.sin(t * 0.55) * 0.3 + mx * 0.55;
      pitch = my * 0.28 - 0.04;
    }
    return [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  };

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */
  function draw(now, still) {
    const t = clock;
    const g = clamp((now - morphStart) / morphDur, 0, 1);
    const morphing = g < 1;
    const [ca, sa, cpa, spa] = rotFor(SHAPES[fromShape], t);
    const [cb, sb, cpb, spb] = rotFor(SHAPES[toShape], t);

    ctx.clearRect(0, 0, W, H);
    const alpha = 1 - explode * 0.92;
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;

    // Orbit ring (behind)
    const ringRot = -0.14 + mx * 0.08;
    ctx.lineWidth = dpr;
    ctx.strokeStyle = 'rgba(236,233,226,0.09)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + unit * 0.05, unit * 1.62, unit * 0.36, ringRot, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + unit * 0.05, unit * 1.9, unit * 0.5, ringRot + 0.08, 0, TAU);
    ctx.setLineDash([2 * dpr, 7 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);

    const scanY = cy + unit * 0.08 + Math.sin(t * 0.75) * unit * 0.88;
    const band = 5 * dpr;
    const ex = 1 + explode * 1.6;
    const cam = 3.4, fov = 3.4;
    const base = (compact ? 1.9 : 1.85) * dpr;
    counts.fill(0);

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      // target (B) rotated
      let bx = to[i3], by = to[i3 + 1], bz = to[i3 + 2];
      let x1 = bx * cb + bz * sb;
      let z1 = -bx * sb + bz * cb;
      let x = x1, y = by * cpb - z1 * spb, z = by * spb + z1 * cpb;

      if (morphing) {
        let k = clamp((g - delay[i]) / (1 - MAX_DELAY), 0, 1);
        k = easeInOut(k);
        const ax = from[i3], ay = from[i3 + 1], az = from[i3 + 2];
        const xa = ax * ca + az * sa;
        const za = -ax * sa + az * ca;
        const ya = ay * cpa - za * spa;
        const zz = ay * spa + za * cpa;
        const tb = Math.sin(k * Math.PI) * 0.55;
        x = xa + (x - xa) * k + noise[i3] * tb;
        y = ya + (y - ya) * k + noise[i3 + 1] * tb;
        z = zz + (z - zz) * k + noise[i3 + 2] * tb;
      }

      // breathing shimmer + scroll explode
      y += Math.sin(t * 1.6 + phase[i]) * 0.006;
      x *= ex; y *= ex; z *= ex;

      const pz = cam + z;
      if (pz < 0.4) continue;
      const p = fov / pz;
      const sx = cx + x * unit * p;
      const sy = cy - y * unit * p;
      if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue;

      let b;
      if (Math.abs(sy - scanY) < band) b = HOT;
      else b = clamp(Math.floor(((z + 1.3) / 2.6) * 5), 0, 4);
      const size = base * p * (b === HOT ? 1.25 : 1);
      const buf = bufs[b];
      const o = counts[b] * 3;
      buf[o] = sx; buf[o + 1] = sy; buf[o + 2] = size;
      counts[b]++;
    }

    // Far → near so closer points sit on top
    for (let b = 4; b >= 0; b--) {
      ctx.fillStyle = COLORS[b];
      const buf = bufs[b];
      for (let j = 0, n = counts[b] * 3; j < n; j += 3) {
        const s = buf[j + 2];
        ctx.fillRect(buf[j] - s * 0.5, buf[j + 1] - s * 0.5, s, s);
      }
    }
    ctx.fillStyle = COLORS[HOT];
    {
      const buf = bufs[HOT];
      for (let j = 0, n = counts[HOT] * 3; j < n; j += 3) {
        const s = buf[j + 2];
        ctx.fillRect(buf[j] - s * 0.5, buf[j + 1] - s * 0.5, s, s);
      }
    }

    // Scan line + readout
    if (!still || started) {
      const span = unit * 1.75;
      const grad = ctx.createLinearGradient(cx - span, 0, cx + span, 0);
      grad.addColorStop(0, 'rgba(215,255,58,0)');
      grad.addColorStop(0.5, 'rgba(215,255,58,0.38)');
      grad.addColorStop(1, 'rgba(215,255,58,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - span, scanY - 0.5 * dpr, span * 2, dpr);
      ctx.font = `${10 * dpr}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillStyle = 'rgba(215,255,58,0.75)';
      ctx.fillText(`SCAN ${((cy - scanY) / unit).toFixed(2)}`, cx + span * 0.62, scanY - 6 * dpr);
    }

    // Orbiting marker
    const oa = t * 0.7;
    const ox = cx + Math.cos(oa) * unit * 1.62;
    const oy = cy + unit * 0.05 + Math.sin(oa) * unit * 0.36;
    ctx.fillStyle = '#d7ff3a';
    ctx.fillRect(ox - 2 * dpr, oy - 2 * dpr, 4 * dpr, 4 * dpr);
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    clock += dt;
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    if (started && now >= nextAt) morphTo((current + 1) % SHAPES.length, now, MORPH);
    draw(now, false);
    raf = requestAnimationFrame(loop);
  }

  function setRunning() {
    const should = started && visible && !document.hidden && !reduce;
    if (should === running) return;
    running = should;
    if (running) {
      last = performance.now();
      // Keep the cycle from firing a backlog of morphs after a pause.
      if (nextAt < last) nextAt = last + 400;
      raf = requestAnimationFrame(loop);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function start() {
    if (started) return;
    started = true;
    const now = performance.now();
    if (reduce) {
      // Static, composed frame: the dumbbell at a flattering angle.
      clock = 2.2;
      from = to = SHAPES[1].pts;
      fromShape = toShape = current = 1;
      morphStart = -1e9;
      setLabel(SHAPES[1]);
      draw(now, true);
      return;
    }
    morphTo(0, now, 2100);
    setRunning();
  }

  let fontReady = false, pageReady = false;
  const maybeStart = () => { if (fontReady && pageReady) start(); };

  const sampleWordmark = () => {
    SHAPES[0].pts = wordmark('ACE') || SHAPES[1].pts;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => {
      const top = sampleText('20', 0.5), bottom = sampleText('KG', 0.5);
      if (top && bottom) SHAPES[3].pts = plate({ top, bottom });
    }, { timeout: 5000 });
    fontReady = true;
    maybeStart();
  };
  if (document.fonts && document.fonts.load) {
    Promise.race([
      document.fonts.load('900 200px Archivo'),
      new Promise((r) => setTimeout(r, 1800)),
    ]).then(sampleWordmark, sampleWordmark);
  } else {
    sampleWordmark();
  }

  const onReady = () => { pageReady = true; maybeStart(); };
  if (document.documentElement.classList.contains('is-ready')) onReady();
  else window.addEventListener('ace:ready', onReady, { once: true });
  setTimeout(onReady, 3500); // never wait forever

  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRunning(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', setRunning);

  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      tmx = (e.clientX / window.innerWidth) * 2 - 1;
      tmy = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // Scroll → explode the cloud. Height is cached (no layout reads in the scroll path).
  let heroH = hero.offsetHeight || window.innerHeight;
  if ('ResizeObserver' in window) new ResizeObserver(() => { heroH = hero.offsetHeight || window.innerHeight; }).observe(hero);
  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > heroH * 1.2 && explode >= 1) return;
    explode = clamp(y / (heroH * 0.85), 0, 1);
    if (!running && started && !scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(() => { scrollQueued = false; draw(performance.now(), true); });
    }
  }, { passive: true });

  if (nextBtn) nextBtn.addEventListener('click', () => next());
  window.AceForge = { next };
})();
