import {feedback} from './feedback.js';

// Time scrubber — a 1:1 port of the "Kalender Widget" design into plain JS.
// Day ⇄ Week ⇄ Month levels: drag sideways to move, swipe up for a coarser
// level, swipe down for a finer one. Every value animates with a small spring.

const LEVELS = ['Day', 'Week', 'Month'];
// Geometry per level: n* = normal pill, s* = selected pill, b = inner badge.
// Values are the widget's originals (designed at 560px wide). On a narrow
// phone the wide week/month pills shrink so the neighbours still peek in.
function geometry(width) {
  const f = Math.min(1, Math.max(0.55, width / 580));
  const wide = (nw, sw, nb, sb) => ({nw: nw * f, nh: 106, sw: sw * f, sh: 136, nb: Math.min(nb, nw * f - 24), nbh: 36, sb: Math.min(sb, sw * f - 28), sbh: 54, nfs: 15, sfs: 20});
  return [
    {nw: 60, nh: 106, sw: 80, sh: 136, nb: 36, nbh: 36, sb: 54, sbh: 54, nfs: 15, sfs: 20},
    wide(300, 340, 130, 180),
    wide(300, 340, 130, 170),
  ];
}
const RANGE = [400, 60, 14];
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ITEM_TOP = 50; // distance from the top of the strip to the pills

const lerp = (a, b, t) => a + (b - a) * t;
const parseHex = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const x = parseHex(a), y = parseHex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const rgba = (hex, alpha) => `rgba(${parseHex(hex).join(',')},${alpha})`;

export function createTimeScrubber(root, {today = new Date(), accent = '#d9463e', dimPast = true, countFor = () => 0, onChange = () => {}} = {}) {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  const offset = (base.getDay() + 6) % 7; // weeks start on Monday
  const A = {lv: {p: 0, t: 0, v: 0}, p0: {p: 0, t: 0, v: 0}, p1: {p: 0, t: 0, v: 0}, p2: {p: 0, t: 0, v: 0}};
  let anchor = 0, drag = null, wheelAccumulator = 0, levelLock = 0, wheelTimer, verticalTimer, raf, lastKey = '';

  let G = geometry(root.clientWidth || window.innerWidth);
  window.addEventListener('resize', () => { G = geometry(root.clientWidth || window.innerWidth); render(); });
  root.classList.add('scrubber');
  root.innerHTML = `
    <div class="scrubber-indicator" aria-hidden="true"></div>
    <div class="scrubber-strip" tabindex="0" role="slider" aria-roledescription="time scrubber"></div>
    <div class="scrubber-levels">${LEVELS.map((name, i) => `<button type="button" data-level="${i}">${name}</button>`).join('')}</div>`;
  const strip = root.querySelector('.scrubber-strip');
  const nodes = new Map();

  // ---------- calendar helpers ----------
  const spacing = L => G[L].nw + 14;
  const current = () => Math.round(A.lv.t);
  const clamp = (L, v) => Math.max(-RANGE[L], Math.min(RANGE[L], v));
  const dayDate = i => { const d = new Date(base); d.setDate(d.getDate() + i); return d; };
  const dayIndex = d => Math.round((new Date(d).setHours(0, 0, 0, 0) - base) / 86400000);
  const weekOf = i => Math.floor((i + offset) / 7);
  const weekStart = w => w * 7 - offset;
  const monthOf = i => { const d = dayDate(i); return (d.getFullYear() - base.getFullYear()) * 12 + d.getMonth() - base.getMonth(); };
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  };

  function rangeOf(L, i) {
    if (L === 0) { const d = dayDate(i); return {from: d, to: d}; }
    if (L === 1) return {from: dayDate(weekStart(i)), to: dayDate(weekStart(i) + 6)};
    const from = new Date(base.getFullYear(), base.getMonth() + i, 1);
    return {from, to: new Date(from.getFullYear(), from.getMonth() + 1, 0)};
  }

  function content(L, i) {
    if (L === 0) { const d = dayDate(i); return {label: WEEKDAY[d.getDay()], text: d.getDate()}; }
    if (L === 1) {
      const {from: s, to: e} = rangeOf(1, i);
      const text = s.getMonth() === e.getMonth()
        ? `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`
        : `${MONTH_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTH_SHORT[e.getMonth()]} ${e.getDate()}`;
      return {label: `WEEK ${isoWeek(s)}`, text};
    }
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    return {label: String(d.getFullYear()), text: MONTH_LONG[d.getMonth()]};
  }

  // ---------- selection ----------
  function syncAnchor() {
    const L = current();
    if (L === 0) anchor = Math.round(A.p0.t);
    if (L === 1) {
      const w = Math.round(A.p1.t);
      if (weekOf(anchor) !== w) anchor = weekStart(w) + (((anchor + offset) % 7) + 7) % 7;
    }
    if (L === 2) {
      const m = Math.round(A.p2.t);
      if (monthOf(anchor) !== m) {
        const day = dayDate(anchor).getDate();
        const month = base.getMonth() + m;
        const daysInMonth = new Date(base.getFullYear(), month + 1, 0).getDate();
        anchor = dayIndex(new Date(base.getFullYear(), month, Math.min(day, daysInMonth)));
      }
    }
  }

  function setLevel(n) {
    n = Math.max(0, Math.min(2, n));
    const L = current();
    if (n === L) return;
    syncAnchor();
    const values = [anchor, weekOf(anchor), monthOf(anchor)];
    values.forEach((v, i) => { const a = A['p' + i]; a.t = v; if (i !== L) { a.p = v; a.v = 0; } });
    A.lv.t = n;
    notify();
  }

  function go(n) {
    const L = current(), a = A['p' + L];
    a.t = clamp(L, Math.round(a.t) + n);
    notify();
  }

  // Tell the app about the selected range whenever the target changes.
  function notify() {
    const L = current(), i = Math.round(A['p' + L].t);
    const key = `${L}:${i}`;
    if (key === lastKey) return;
    lastKey = key;
    feedback(L === 0 ? 'day-boundary' : 'range-boundary');
    const range = rangeOf(L, i);
    strip.setAttribute('aria-valuetext', `${LEVELS[L]}: ${content(L, i).label} ${content(L, i).text}`);
    root.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.level === L)));
    onChange({level: LEVELS[L].toLowerCase(), ...range});
  }

  // ---------- animation loop ----------
  function tick() {
    const pk = 'p' + current();
    let changed = false;
    for (const key in A) {
      if (drag && drag.mode === 'h' && key === pk) continue;
      const a = A[key];
      const k = key === 'lv' ? 0.1 : 0.09, c = key === 'lv' ? 0.68 : 0.72;
      a.v = a.v * c + (a.t - a.p) * k;
      if (Math.abs(a.v) > 0.0005 || Math.abs(a.t - a.p) > 0.0005) { a.p += a.v; changed = true; }
      else if (a.p !== a.t) { a.p = a.t; a.v = 0; changed = true; }
    }
    if (changed || drag) render();
    raf = requestAnimationFrame(tick);
  }

  const geomAt = (L, t) => {
    const g = G[L];
    return {w: lerp(g.nw, g.sw, t), h: lerp(g.nh, g.sh, t), bw: lerp(g.nb, g.sb, t), bh: lerp(g.nbh, g.sbh, t), fs: lerp(g.nfs, g.sfs, t)};
  };
  const lerpGeom = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, lerp(a[k], b[k], t)]));
  const centerGeom = lv => { const a = Math.min(1, Math.floor(lv)); return lerpGeom(geomAt(a, 1), geomAt(a + 1, 1), lv - a); };

  function nodeFor(key, L, i) {
    let node = nodes.get(key);
    if (!node) {
      const wrap = document.createElement('div');
      wrap.className = 'scrub-item';
      wrap.dataset.level = L;
      wrap.dataset.index = i;
      wrap.innerHTML = '<div class="scrub-label"></div><div class="scrub-pill"><div class="scrub-badge"><span></span></div><div class="scrub-dots"></div></div>';
      node = {wrap, label: wrap.children[0], pill: wrap.children[1], badge: wrap.querySelector('.scrub-badge'), text: wrap.querySelector('.scrub-badge span'), dots: wrap.querySelector('.scrub-dots'), content: null, count: -1};
      nodes.set(key, node);
      strip.appendChild(wrap);
    }
    return node;
  }

  function render() {
    const lvr = Math.max(0, Math.min(2, A.lv.p));
    const cg = centerGeom(lvr), dominant = Math.round(lvr);
    const seen = new Set();
    for (let L = 0; L < 3; L++) {
      const fL = Math.max(0, 1 - Math.abs(lvr - L));
      if (fL <= 0.001) continue;
      const pos = A['p' + L].p, S = spacing(L), g0 = G[L];
      const extra = (g0.sw - g0.nw) / 2, spread = (cg.w - g0.sw) / 2, reach = L ? 3 : 5;
      for (let i = Math.floor(pos) - reach; i <= Math.ceil(pos) + reach; i++) {
        if (Math.abs(i) > RANGE[L]) continue;
        const key = `${L}:${i}`;
        seen.add(key);
        const d = i - pos, ad = Math.min(Math.abs(d), 1), t = 1 - ad, t2 = t * t * (3 - 2 * t);
        const isCenter = Math.abs(d) < 0.5, ghost = isCenter && L !== dominant;
        const past = dimPast ? Math.max(0, Math.min(1, -d)) : 0;
        const g = lerpGeom(geomAt(L, 0), cg, t2);
        const x = d * S + Math.sign(d) * (extra + spread) * ad;
        const node = nodeFor(key, L, i);
        if (!node.content) {
          node.content = content(L, i);
          node.label.textContent = node.content.label;
          node.text.textContent = node.content.text;
        }
        const count = Math.min(3, countFor(rangeOf(L, i)));
        if (count !== node.count) {
          node.count = count;
          node.dots.innerHTML = '<i></i>'.repeat(count);
        }
        const circleBase = mix('#ffffff', '#e5e5e5', past);
        Object.assign(node.wrap.style, {
          left: `calc(50% + ${x}px)`, top: `${ITEM_TOP - 8 * t2}px`, width: `${g.w}px`,
          opacity: isCenter ? 1 : fL, zIndex: Math.round(t * 10) + (L === dominant ? 20 : 0) + (isCenter ? 10 : 0),
        });
        Object.assign(node.label.style, {color: mix('#8a8a8a', '#3a3a3a', t2), opacity: isCenter ? fL : 1});
        Object.assign(node.pill.style, ghost
          ? {width: `${g.w}px`, height: `${g.h}px`, background: 'transparent', border: '1px solid transparent', boxShadow: 'none', paddingTop: `${lerp(6, 10, t2)}px`}
          : {
            width: `${g.w}px`, height: `${g.h}px`, borderRadius: `${g.h / 2}px`,
            background: mix('#ffffff', '#ebebeb', past),
            border: `1px solid rgba(0,0,0,${(0.035 + 0.02 * past) * (1 - t2)})`,
            boxShadow: `0 ${lerp(2, 14, t2)}px ${lerp(6, 30, t2)}px rgba(0,0,0,${(1 - past) * lerp(0.05, 0.11, t2)})`,
            paddingTop: `${lerp(6, 10, t2)}px`,
          });
        Object.assign(node.badge.style, {
          width: `${g.bw}px`, height: `${g.bh}px`, borderRadius: `${g.bh / 2}px`,
          background: ghost ? 'transparent' : mix(circleBase, accent, t2),
          border: ghost ? '1px solid transparent' : `1px solid rgba(0,0,0,${0.05 * (1 - t2)})`,
          boxShadow: ghost ? 'none' : `0 ${6 * t2}px ${16 * t2}px ${rgba(accent, 0.35 * t2)}`,
          color: mix('#b5b5b5', '#ffffff', t2), fontSize: `${g.fs}px`,
        });
        node.text.style.opacity = isCenter ? fL * fL : 1;
        node.dots.style.opacity = ghost ? 0 : 1;
        node.dots.style.color = isCenter && L === dominant ? accent : '#b9b9b9';
      }
    }
    for (const [key, node] of nodes) {
      if (!seen.has(key)) { node.wrap.remove(); nodes.delete(key); }
    }
  }

  // ---------- input ----------
  strip.addEventListener('pointerdown', e => {
    strip.setPointerCapture(e.pointerId);
    const L = current();
    drag = {L, x: e.clientX, y: e.clientY, pos: A['p' + L].p, lastX: e.clientX, lastT: performance.now(), v: 0, mode: null};
    strip.classList.add('dragging');
  });
  strip.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mode && Math.max(Math.abs(dx), Math.abs(dy)) > 6) drag.mode = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    const now = performance.now(), dt = Math.max(1, now - drag.lastT);
    drag.v = 0.7 * drag.v + 0.3 * ((e.clientX - drag.lastX) / dt);
    drag.lastX = e.clientX;
    drag.lastT = now;
    if (drag.mode === 'h') {
      const a = A['p' + drag.L];
      a.p = a.t = clamp(drag.L, drag.pos - dx / spacing(drag.L));
      notify(); // live: the map follows the finger
    }
  });
  const release = e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    strip.classList.remove('dragging');
    if (d.mode === 'h') {
      const a = A['p' + d.L];
      a.v = 0;
      a.t = clamp(d.L, Math.round(a.p - d.v * 300 / spacing(d.L)));
      notify();
    } else if (d.mode === 'v') {
      const dy = e.clientY - d.y;
      if (dy < -30) setLevel(d.L + 1);
      else if (dy > 30) setLevel(d.L - 1);
    } else if (e.type === 'pointerup') {
      // A tap: select the pill under the finger.
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.scrub-item');
      if (hit && +hit.dataset.level === current()) {
        A['p' + current()].t = +hit.dataset.index;
        notify();
      }
    }
  };
  strip.addEventListener('pointerup', release);
  strip.addEventListener('pointercancel', release);

  strip.addEventListener('wheel', e => {
    e.preventDefault();
    const L = current(), a = A['p' + L];
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      a.t = clamp(L, a.t + e.deltaX / spacing(L));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { a.t = clamp(L, Math.round(a.t)); notify(); }, 120);
    } else {
      const now = performance.now();
      clearTimeout(verticalTimer);
      verticalTimer = setTimeout(() => { wheelAccumulator = 0; }, 200);
      if (now < levelLock) return;
      wheelAccumulator += e.deltaY;
      if (Math.abs(wheelAccumulator) > 30) {
        setLevel(L + Math.sign(wheelAccumulator));
        wheelAccumulator = 0;
        levelLock = now + 600;
      }
    }
  }, {passive: false});

  strip.addEventListener('keydown', e => {
    const actions = {ArrowRight: () => go(1), ArrowLeft: () => go(-1), ArrowUp: () => setLevel(current() + 1), ArrowDown: () => setLevel(current() - 1)};
    if (actions[e.key]) { e.preventDefault(); actions[e.key](); }
  });
  root.querySelector('.scrubber-levels').addEventListener('click', e => {
    const button = e.target.closest('[data-level]');
    if (button) setLevel(+button.dataset.level);
  });

  render();
  notify();
  raf = requestAnimationFrame(tick);

  return {
    /** Jump to a calendar day (switches to the Day level). */
    setDate(date) {
      const i = clamp(0, dayIndex(date));
      anchor = i;
      if (current() !== 0) { A.p0.t = A.p0.p = i; A.lv.t = 0; } else A.p0.t = i;
      notify();
    },
    /** Re-read the event counts shown as dots inside the pills. */
    refreshCounts() { for (const node of nodes.values()) node.count = -1; render(); },
    destroy() { cancelAnimationFrame(raf); },
  };
}
