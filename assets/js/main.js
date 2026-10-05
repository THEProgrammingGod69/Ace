/* ==========================================================================
   ACE FITNESS CLUB — interaction layer
   Vanilla JS, zero dependencies. One shared rAF-throttled scroll loop,
   cached layout reads, transform/opacity-only writes.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const GYM = {
    whatsapp: '918380881555',
    openMin: 6 * 60,   // 06:00 IST
    closeMin: 22 * 60, // 22:00 IST
  };
  const waLink = (text) => `https://wa.me/${GYM.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ------------------------------------------------------------------
     Shared scroll / measure loop
     ------------------------------------------------------------------ */
  const view = { y: window.scrollY, vh: window.innerHeight, vw: window.innerWidth };
  const frameSubs = [];
  const measureSubs = [];
  let frameQueued = false;

  const runFrame = () => {
    frameQueued = false;
    for (const fn of frameSubs) fn(view);
  };
  const queueFrame = () => {
    view.y = window.scrollY; // read once per event, before any writes this frame
    if (!frameQueued) { frameQueued = true; requestAnimationFrame(runFrame); }
  };
  const measureAll = () => {
    view.vh = window.innerHeight;
    view.vw = window.innerWidth;
    view.y = window.scrollY;
    for (const fn of measureSubs) fn(view);
    runFrame();
  };
  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  window.addEventListener('scroll', queueFrame, { passive: true });

  // Mobile URL-bar show/hide fires height-only resizes; ignore those to avoid relayout jank.
  let lastW = window.innerWidth;
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!finePointer && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measureAll();
    }, 140);
  });

  /* ------------------------------------------------------------------
     Pune clock + live open/closed status
     ------------------------------------------------------------------ */
  const istFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const istNow = () => {
    const parts = {};
    for (const { type, value } of istFmt.formatToParts(new Date())) parts[type] = value;
    return { h: Number(parts.hour) % 24, m: Number(parts.minute), s: Number(parts.second) };
  };
  const pad = (n) => String(n).padStart(2, '0');

  function initClock() {
    const clocks = $$('[data-clock]');
    const shortClocks = $$('[data-clock-short]');
    const statuses = $$('[data-status]');
    let lastOpen = null;

    const tick = () => {
      const t = istNow();
      const mins = t.h * 60 + t.m;
      const open = mins >= GYM.openMin && mins < GYM.closeMin;
      for (const c of clocks) c.textContent = `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
      for (const c of shortClocks) c.textContent = `${pad(t.h)}:${pad(t.m)}`;
      dial.update(t);

      if (open === lastOpen) return;
      lastOpen = open;
      for (const s of statuses) {
        s.classList.toggle('is-open', open);
        s.classList.toggle('is-closed', !open);
        const text = $('[data-status-text]', s);
        const big = $('[data-status-big]', s);
        const sub = $('[data-status-sub]', s);
        if (text) text.textContent = open ? 'Open now · till 10 PM' : 'Closed · opens 6 AM';
        if (big) big.textContent = open ? 'Open now' : 'Closed';
        if (sub) sub.textContent = open ? 'Closes 22:00 · 7 days' : 'Opens 06:00 · 7 days';
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------
     Day-cycle dial (24h, open window highlighted, live needle)
     ------------------------------------------------------------------ */
  const dial = (() => {
    const svg = $('[data-dial]');
    if (!svg) return { update() {} };
    const NS = 'http://www.w3.org/2000/svg';
    const C = 160, R = 132;
    const ang = (h) => (h / 24) * Math.PI * 2 - Math.PI / 2;
    const pt = (h, r) => [C + Math.cos(ang(h)) * r, C + Math.sin(ang(h)) * r];

    const [x0, y0] = pt(6, R);
    const [x1, y1] = pt(22, R);
    const large = (22 - 6) / 24 > 0.5 ? 1 : 0;
    $('[data-dial-open]', svg).setAttribute('d', `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`);

    const ticks = $('[data-dial-ticks]', svg);
    const mk = (tag, attrs, text) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      if (text) el.textContent = text;
      ticks.appendChild(el);
    };
    for (let h = 0; h < 24; h++) {
      const major = h % 6 === 0;
      const edge = h === 6 || h === 22;
      const [ax, ay] = pt(h, R + 12);
      const [bx, by] = pt(h, R + (major || edge ? 24 : 18));
      mk('line', {
        x1: ax.toFixed(2), y1: ay.toFixed(2), x2: bx.toFixed(2), y2: by.toFixed(2),
        class: major || edge ? 'dial__tick dial__tick--major' : 'dial__tick',
      });
      if (major || edge) {
        const [lx, ly] = pt(h, R - 22);
        mk('text', { x: lx.toFixed(2), y: ly.toFixed(2), class: edge ? 'dial__lbl dial__lbl--volt' : 'dial__lbl' }, pad(h));
      }
    }

    const needle = $('[data-dial-needle]', svg);
    let lastMin = -1;
    return {
      update(t) {
        const m = t.h * 60 + t.m;
        if (m === lastMin) return;
        lastMin = m;
        needle.setAttribute('transform', `rotate(${((m / 1440) * 360).toFixed(2)} ${C} ${C})`);
      },
    };
  })();

  /* ------------------------------------------------------------------
     Intro loader — runs once per session, never longer than ~1.3s
     ------------------------------------------------------------------ */
  function runIntro(onDone) {
    const loader = $('.loader');
    const finish = () => {
      doc.classList.add('is-ready');
      window.dispatchEvent(new Event('ace:ready'));
      onDone();
    };
    if (!loader || reduce || !doc.classList.contains('is-loading')) {
      doc.classList.remove('is-loading');
      if (loader) loader.remove();
      requestAnimationFrame(finish);
      return;
    }
    try { sessionStorage.setItem('ace-intro', '1'); } catch (e) { /* private mode */ }
    const kg = $('[data-loader-kg]', loader);
    [60, 100, 140, 180].forEach((v, i) => setTimeout(() => { kg.textContent = v; }, 300 + i * 180));
    setTimeout(() => {
      loader.classList.add('is-out');
      doc.classList.remove('is-loading');
      finish();
    }, 1250);
    setTimeout(() => loader.remove(), 2400);
  }

  /* ------------------------------------------------------------------
     Word splitting (for headline reveals + scroll-scrubbed manifesto)
     ------------------------------------------------------------------ */
  function splitWords(root, cls) {
    let i = 0;
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
            const outer = document.createElement('span');
            outer.className = cls;
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      }
    };
    walk(root);
    return i;
  }

  /* ------------------------------------------------------------------
     Reveal-on-enter + "live" (animations only run while visible)
     ------------------------------------------------------------------ */
  function initReveals() {
    $$('[data-split]').forEach((el) => splitWords(el, 'w'));
    const targets = $$('[data-reveal], [data-split], [data-draw]');
    if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach((el) => io.observe(el));

    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting);
    }, { rootMargin: '0px 40px' });
    $$('[data-live]').forEach((el) => live.observe(el));
  }

  /* ------------------------------------------------------------------
     Nav: solid on scroll, hide on scroll-down, current-section highlight
     ------------------------------------------------------------------ */
  function initNav() {
    const nav = $('[data-nav]');
    const bar = $('.progress i');
    const burger = $('[data-burger]');
    const menu = $('[data-menu]');
    let lastY = window.scrollY;
    let docH = 1;
    let menuOpen = false;

    measureSubs.push(() => { docH = Math.max(1, doc.scrollHeight - view.vh); });
    frameSubs.push(({ y }) => {
      nav.classList.toggle('is-solid', y > 24);
      const dy = y - lastY;
      if (Math.abs(dy) > 6) {
        nav.classList.toggle('is-hidden', dy > 0 && y > 420 && !menuOpen);
        lastY = y;
      }
      bar.style.transform = `scaleX(${clamp(y / docH, 0, 1).toFixed(4)})`;
    });

    const setMenu = (open) => {
      menuOpen = open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) { nav.classList.remove('is-hidden'); nav.classList.add('is-solid'); }
    };
    burger.addEventListener('click', () => setMenu(!menuOpen));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });

    // Highlight the section currently in view
    const links = $$('.nav__links a');
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const link = byId.get(e.target.id);
        if (link) link.classList.toggle('is-current', e.isIntersecting);
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ------------------------------------------------------------------
     Hero: content drifts up and fades as you leave it
     ------------------------------------------------------------------ */
  function initHero() {
    const hero = $('[data-hero]');
    const inner = $('[data-hero-inner]');
    if (!hero || !inner || reduce) return;
    let h = 1;
    measureSubs.push(() => { h = hero.offsetHeight; });
    frameSubs.push(({ y }) => {
      if (y > h) return;
      const p = y / h;
      inner.style.transform = `translate3d(0, ${(p * -90).toFixed(1)}px, 0)`;
      inner.style.opacity = (1 - p * 1.25).toFixed(3);
    });
  }

  /* ------------------------------------------------------------------
     Ticker: skews and speeds up with scroll velocity
     ------------------------------------------------------------------ */
  function initTicker() {
    const skew = $('.ticker__skew');
    const ticker = $('.ticker');
    if (!skew || reduce) return;
    let visible = false;
    let last = view.y;
    let cur = 0;
    let raf = 0;
    const tick = () => {
      const v = view.y - last;
      last = view.y;
      cur += (clamp(v * 0.3, -9, 9) - cur) * 0.12;
      skew.style.transform = `skewX(${(-cur).toFixed(2)}deg)`;
      raf = visible && (Math.abs(cur) > 0.01 || v !== 0) ? requestAnimationFrame(tick) : 0;
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(ticker);
    window.addEventListener('scroll', () => { if (visible && !raf) raf = requestAnimationFrame(tick); }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Manifesto: words light up as you read down the page
     ------------------------------------------------------------------ */
  function initScrub() {
    const el = $('[data-scrub]');
    if (!el) return;
    splitWords(el, 'sw');
    const words = $$('.sw', el);
    if (reduce) { words.forEach((w) => w.classList.add('on')); return; }
    let top = 0;
    let h = 1;
    let lit = -1;
    measureSubs.push(() => { top = pageTop(el); h = el.offsetHeight; });
    frameSubs.push(({ y, vh }) => {
      const start = top - vh * 0.82;
      const end = top + h - vh * 0.38;
      const n = Math.round(clamp((y - start) / (end - start), 0, 1) * words.length);
      if (n === lit) return;
      for (let i = 0; i < words.length; i++) words[i].classList.toggle('on', i < n);
      lit = n;
    });
  }

  /* ------------------------------------------------------------------
     Odometer counters
     ------------------------------------------------------------------ */
  function initOdometers() {
    $$('[data-odo]').forEach((el) => {
      const target = el.dataset.odo;
      el.textContent = '';
      let d = 0;
      for (const ch of target) {
        if (/\d/.test(ch)) {
          const win = document.createElement('span');
          win.className = 'odo__win';
          const col = document.createElement('span');
          col.className = 'odo__col';
          col.style.setProperty('--d', d++);
          for (let k = 0; k < 20; k++) {
            const s = document.createElement('span');
            s.textContent = String(k % 10);
            col.appendChild(s);
          }
          col.dataset.to = String(10 + Number(ch));
          win.appendChild(col);
          el.appendChild(win);
        } else {
          const s = document.createElement('span');
          s.className = 'odo__sep';
          s.textContent = ch;
          el.appendChild(s);
        }
      }
    });
    const roll = (root) => $$('.odo__col', root).forEach((c) => { c.style.transform = `translateY(${-Number(c.dataset.to)}em)`; });
    if (reduce || !('IntersectionObserver' in window)) { roll(document); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        roll(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.4 });
    $$('.stat').forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------------------
     Training rack: pinned horizontal scroll on desktop, swipe on mobile
     ------------------------------------------------------------------ */
  function initPrograms() {
    const sec = $('[data-programs]');
    if (!sec) return;
    const track = $('[data-track]', sec);
    const bar = $('.programs__bar i', sec);
    const count = $('[data-prog-count]', sec);
    const cards = $$('.pcard', sec);
    const mq = matchMedia('(min-width: 960px) and (min-height: 620px)');
    let pinned = false;
    let top = 0;
    let dist = 0;
    let shown = 0;

    const setCount = (idx) => {
      if (idx === shown) return;
      shown = idx;
      count.textContent = pad(idx + 1);
    };

    measureSubs.unshift(({ vw, vh }) => {
      pinned = mq.matches;
      sec.classList.toggle('is-pinned', pinned);
      if (!pinned) {
        sec.style.height = '';
        track.style.transform = '';
        return;
      }
      dist = Math.max(0, track.scrollWidth - vw);
      sec.style.height = `${Math.round(vh + dist)}px`;
      top = pageTop(sec);
    });

    frameSubs.push(({ y }) => {
      if (!pinned) return;
      const p = dist ? clamp((y - top) / dist, 0, 1) : 0;
      track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px, 0, 0)`;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
      setCount(Math.min(cards.length - 1, Math.floor(p * cards.length)));
    });

    // Mobile: native swipe, mirror progress into the bar
    let raf = 0;
    track.addEventListener('scroll', () => {
      if (pinned || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = track.scrollWidth - track.clientWidth;
        const p = max > 0 ? track.scrollLeft / max : 0;
        bar.style.transform = `scaleX(${p.toFixed(4)})`;
        setCount(Math.round(p * (cards.length - 1)));
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Pointer-reactive cards (tilt + light) — desktop only
     ------------------------------------------------------------------ */
  function initPointerFX() {
    if (!finePointer || reduce) return;
    const bind = (el, tilt) => {
      let raf = 0;
      let ev = null;
      const apply = () => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width;
        const y = (ev.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        if (tilt) {
          el.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
          el.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
        }
      };
      el.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
      if (tilt) {
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--rx', '0deg');
          el.style.setProperty('--ry', '0deg');
        });
      }
    };
    $$('[data-tilt]').forEach((el) => bind(el, true));
    $$('[data-spot]').forEach((el) => bind(el, false));
  }

  /* ------------------------------------------------------------------
     Rep Lab: 1RM estimator + plate loader, BMI gauge
     ------------------------------------------------------------------ */
  function initLab() {
    const tabs = $$('.lab__tab');
    if (!tabs.length) return;

    // Tabs (WAI-ARIA pattern, arrow-key navigation)
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        select(next);
        next.focus();
      });
    });

    const fill = (input) => {
      const p = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--p', `${p}%`);
    };
    const fmtKg = (v) => String(Math.round(v * 100) / 100); // 117.5, 2.5, 1.25

    // ---- 1RM + plates ----
    const PLATES = [
      { kg: 25, w: 22, h: 1, c: '#e5322b' },
      { kg: 20, w: 20, h: 1, c: '#2f6bff', light: 1 },
      { kg: 15, w: 17, h: 1, c: '#f5c518' },
      { kg: 10, w: 14, h: 1, c: '#2dbe60' },
      { kg: 5, w: 11, h: 0.6, c: '#ece9e2' },
      { kg: 2.5, w: 9, h: 0.5, c: '#e5322b' },
      { kg: 1.25, w: 7, h: 0.42, c: '#9aa0a6' },
    ];
    const BAR = 20;
    const wIn = $('#rm-weight');
    const rIn = $('#rm-reps');
    const wOut = $('[data-rm-w]');
    const rOut = $('[data-rm-r]');
    const oneOut = $('[data-rm-one]');
    const legend = $('[data-rm-legend]');
    const zones = $$('[data-zone]');
    const sides = [$('[data-side="l"]'), $('[data-side="r"]')];
    const pctBtns = $$('[data-pct]');
    let pct = 100;
    let lastSig = '';

    const round25 = (v) => Math.round(v / 2.5) * 2.5;
    const epley = (kg, reps) => (reps === 1 ? kg : kg * (1 + reps / 30));
    const platesFor = (total) => {
      let perSide = Math.max(0, (total - BAR) / 2);
      const out = [];
      for (const p of PLATES) {
        while (perSide >= p.kg - 1e-9) { out.push(p); perSide -= p.kg; }
      }
      return out;
    };

    const renderBar = (target) => {
      const plates = platesFor(target);
      const sig = plates.map((p) => p.kg).join(',');
      if (sig !== lastSig) {
        lastSig = sig;
        for (const side of sides) {
          side.textContent = '';
          plates.forEach((p, i) => {
            const el = document.createElement('span');
            el.className = 'plate';
            el.style.cssText = `--w:${p.w}px;--h:${p.h};--c:${p.c};--i:${i}`;
            if (p.light) el.dataset.light = '1';
            if (p.w >= 14) { const t = document.createElement('em'); t.textContent = fmtKg(p.kg); el.appendChild(t); }
            side.appendChild(el);
          });
        }
      }
      const perSide = plates.length ? plates.map((p) => fmtKg(p.kg)).join(' + ') : 'empty bar';
      legend.innerHTML = `Load <b>${fmtKg(target)} kg</b> · ${BAR} kg bar · per side: <b>${perSide}</b>`;
    };

    const updateRM = () => {
      const kg = Number(wIn.value);
      const reps = Number(rIn.value);
      fill(wIn); fill(rIn);
      wOut.textContent = fmtKg(kg);
      rOut.textContent = reps;
      const one = epley(kg, reps);
      oneOut.textContent = Math.round(one);
      zones.forEach((z) => { z.textContent = `${fmtKg(round25(one * Number(z.dataset.zone)))} kg`; });
      renderBar(Math.max(BAR, round25((one * pct) / 100)));
    };
    wIn.addEventListener('input', updateRM);
    rIn.addEventListener('input', updateRM);
    pctBtns.forEach((b) => b.addEventListener('click', () => {
      pct = Number(b.dataset.pct);
      pctBtns.forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      updateRM();
    }));
    updateRM();

    // ---- BMI ----
    const hIn = $('#bmi-h');
    const kgIn = $('#bmi-w');
    const hOut = $('[data-bmi-h]');
    const kgOut = $('[data-bmi-w]');
    const valOut = $('[data-bmi-val]');
    const catOut = $('[data-bmi-cat]');
    const rangeOut = $('[data-bmi-range]');
    const needle = $('[data-gauge-needle]');
    const arcs = $('[data-gauge-arcs]');
    const MIN = 15, MAX = 40, GC = 150, GR = 118;
    const bands = [
      { to: 18.5, label: 'Underweight', color: '#6aa9ff' },
      { to: 25, label: 'Healthy', color: '#d7ff3a' },
      { to: 30, label: 'Overweight', color: '#ffb020' },
      { to: MAX, label: 'Obese', color: '#ff5a1f' },
    ];
    // Gauge arcs: semicircle from BMI 15 (left) to 40 (right)
    const toAngle = (b) => Math.PI + ((clamp(b, MIN, MAX) - MIN) / (MAX - MIN)) * Math.PI;
    const NS = 'http://www.w3.org/2000/svg';
    let from = MIN;
    bands.forEach((band) => {
      const a0 = toAngle(from) + 0.012;
      const a1 = toAngle(band.to) - 0.012;
      const path = document.createElementNS(NS, 'path');
      const p0 = [GC + Math.cos(a0) * GR, GC + Math.sin(a0) * GR];
      const p1 = [GC + Math.cos(a1) * GR, GC + Math.sin(a1) * GR];
      path.setAttribute('d', `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${GR} ${GR} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
      path.setAttribute('class', 'gauge__arc');
      path.setAttribute('stroke', band.color);
      path.setAttribute('stroke-opacity', '0.9');
      arcs.appendChild(path);
      from = band.to;
    });
    [15, 18.5, 25, 30, 40].forEach((b) => {
      const a = toAngle(b);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (GC + Math.cos(a) * (GR + 22)).toFixed(2));
      t.setAttribute('y', (GC + Math.sin(a) * (GR + 22) + 3).toFixed(2));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('class', 'gauge__lbl');
      t.textContent = String(b);
      arcs.appendChild(t);
    });

    const updateBMI = () => {
      const cm = Number(hIn.value);
      const kg = Number(kgIn.value);
      fill(hIn); fill(kgIn);
      hOut.textContent = cm;
      kgOut.textContent = fmtKg(kg);
      const m = cm / 100;
      const bmi = kg / (m * m);
      const band = bands.find((b) => bmi < b.to) || bands[bands.length - 1];
      valOut.textContent = bmi.toFixed(1);
      catOut.textContent = band.label;
      catOut.style.color = band.color;
      const deg = ((clamp(bmi, MIN, MAX) - MIN) / (MAX - MIN)) * 180 - 90;
      needle.style.transform = `rotate(${deg.toFixed(2)}deg)`;
      rangeOut.innerHTML = `Healthy range at ${cm} cm: <b>${Math.round(18.5 * m * m)}–${Math.round(24.9 * m * m)} kg</b>`;
    };
    hIn.addEventListener('input', updateBMI);
    kgIn.addEventListener('input', updateBMI);
    updateBMI();
  }

  /* ------------------------------------------------------------------
     Member voices carousel — CSS drives the timer, JS listens for the end
     ------------------------------------------------------------------ */
  function initVoices() {
    const root = $('[data-voices]');
    if (!root) return;
    const section = root.closest('.voices');
    const slides = $$('.voice', root);
    const dots = $$('.voices__dot', root);
    let idx = 0;

    const go = (n) => {
      const next = (n + slides.length) % slides.length;
      slides.forEach((s, i) => { s.classList.toggle('is-active', i === next); s.setAttribute('aria-hidden', String(i !== next)); });
      dots.forEach((d, i) => {
        d.classList.toggle('is-done', i < next);
        d.classList.remove('is-active');
        d.setAttribute('aria-current', String(i === next));
      });
      void dots[next].offsetWidth; // restart the CSS timer
      dots[next].classList.add('is-active');
      idx = next;
    };
    dots.forEach((d, i) => {
      d.addEventListener('click', () => go(i));
      if (!reduce) $('i', d).addEventListener('animationend', () => { if (i === idx) go(idx + 1); });
    });
    $('[data-voice-prev]', root).addEventListener('click', () => go(idx - 1));
    $('[data-voice-next]', root).addEventListener('click', () => go(idx + 1));

    const pause = (on) => section.classList.toggle('is-paused', on);
    root.addEventListener('pointerenter', () => pause(true));
    root.addEventListener('pointerleave', () => pause(false));
    root.addEventListener('focusin', () => pause(true));
    root.addEventListener('focusout', () => pause(false));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (!root.matches(':hover')) pause(!e.isIntersecting); }).observe(root);
    }
    go(0);
  }

  /* ------------------------------------------------------------------
     Map: only load Google Maps when the visitor gets close
     ------------------------------------------------------------------ */
  function initMap() {
    const box = $('[data-map]');
    if (!box) return;
    const load = () => {
      const f = document.createElement('iframe');
      f.src = box.dataset.src;
      f.title = 'Map: Ace Fitness Club, Ambegaon Budruk, Pune';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
      f.addEventListener('load', () => box.classList.add('is-loaded'));
      box.appendChild(f);
    };
    if (!('IntersectionObserver' in window)) { load(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      load();
    }, { rootMargin: '600px 0px' });
    io.observe(box);
  }

  /* ------------------------------------------------------------------
     WhatsApp links + enquiry form
     ------------------------------------------------------------------ */
  function initContact() {
    $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });

    const form = $('[data-form]');
    if (!form) return;
    const ok = $('[data-form-ok]', form);
    const field = (n) => form.elements.namedItem(n);
    const nameIn = field('name');
    const phoneIn = field('phone');

    const validPhone = (raw) => {
      const digits = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      return /^[6-9]\d{9}$/.test(digits) ? digits : null;
    };
    const mark = (input, bad) => input.setAttribute('aria-invalid', String(bad));
    nameIn.addEventListener('input', () => { if (nameIn.getAttribute('aria-invalid') === 'true') mark(nameIn, nameIn.value.trim().length < 2); });
    phoneIn.addEventListener('input', () => { if (phoneIn.getAttribute('aria-invalid') === 'true') mark(phoneIn, !validPhone(phoneIn.value)); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameIn.value.trim();
      const phone = validPhone(phoneIn.value);
      mark(nameIn, name.length < 2);
      mark(phoneIn, !phone);
      if (name.length < 2) { nameIn.focus(); return; }
      if (!phone) { phoneIn.focus(); return; }

      const goal = field('goal').value;
      const slot = field('slot').value;
      const note = field('msg').value.trim();
      const lines = [
        "Hi Ace Fitness Club! I'd like to start training.",
        `Name: ${name}`,
        `Mobile: +91 ${phone}`,
        `Goal: ${goal}`,
        `Preferred time: ${slot}`,
      ];
      if (note) lines.push(`Note: ${note}`);
      window.open(waLink(lines.join('\n')), '_blank', 'noopener');
      ok.textContent = `Thanks, ${name.split(' ')[0]}. WhatsApp is opening with your details. Just hit send.`;
    });
  }

  /* ------------------------------------------------------------------
     Mobile quick-action dock: appears once the hero is behind you
     ------------------------------------------------------------------ */
  function initDock() {
    const dock = $('[data-dock]');
    const hero = $('[data-hero]');
    if (!dock || !hero || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => dock.classList.toggle('is-on', !e.isIntersecting), { threshold: 0.15 }).observe(hero);
  }

  /* ------------------------------------------------------------------
     Custom cursor — desktop only, trails with eased lag
     ------------------------------------------------------------------ */
  function initCursor() {
    if (!finePointer || reduce) return;
    const root = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    if (!root) return;
    doc.classList.add('has-cursor');
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      root.classList.remove('is-hidden');
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const hit = e.target.closest('a, button, summary, label, input[type="range"], [data-tilt]');
      ring.classList.toggle('is-hover', !!hit);
    });
    document.documentElement.addEventListener('mouseleave', () => root.classList.add('is-hidden'));
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    const year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    initNav();
    initPrograms();
    initHero();
    initScrub();
    initOdometers();
    initTicker();
    initPointerFX();
    initLab();
    initVoices();
    initMap();
    initContact();
    initDock();
    initCursor();
    initClock();

    initReveals();
    runIntro(measureAll);
    measureAll();

    // Fonts and late layout shifts change offsets: re-measure once they settle.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
    window.addEventListener('load', measureAll);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
