(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  // SPEC-v5: four sub-slides. Static allocation (a Step sim since v14), the S–G curves,
  // then one fixed 5-station run for pure and for slotted ALOHA (G = 1, seed 11).
  var G = 1, SEED = 11;

  // 6a (v14): static allocation as a Step sim (CN.csma.staticTdm). A bursts 3 frames while the other N − 1 stations
  // are silent; top row the whole channel (A done at slot 3), bottom row TDM (A owns every Nth slot, done at 2N + 1,
  // the slots in between sit idle). One Step = one slot. Chips N = 1 / 2 / 5 / 10; the mean delays are
  // T = 1/(μC − λ) = 200 µs and N·T (C = 100 Mbps, 1/μ = 10,000 bits, λ = 5000/s). N = 1: the rows are the same.
  var SLOTS = 22, T_US = 1e6 * X.staticDelay(1e8, 1e4, 5000, 1);
  function us(v) { return v >= 1000 ? (v / 1000) + ' ms' : v + ' µs'; }
  function staticAlloc(body) {
    var W = 1300, H = 410, X0 = 320, SW = (W - 10 - X0) / SLOTS, SH = 80;
    var hN = ui.handle({ key: 'N', label: 'N', kind: 'chips', value: 10, values: X.TDM_NS, fmt: function () { return ''; }, chip: String });
    var st = { k: 0, m: null }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'A bursts 3 frames, the rest are silent. Mean delay: T = 1/(μC − λ) on one channel, N·T on N slices.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    body.appendChild(ui.handleRow(hN));
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'start' }, str);
    }
    function sx(n) { return X0 + (n - 1) * SW; }
    // one slot: 'A' a frame of A's (i = which), 'idle' empty while A still waits, 'free' empty with nobody waiting,
    // 'future' not reached yet
    var now = 0;
    function slot(n, y, kind, i) {
      var x = sx(n) + 2, w = SW - 4, g = s('g');
      var look = { A: ['var(--accent-bg)', 'var(--accent)', null], idle: ['var(--grey-bg)', 'var(--red)', '5 4'],
        free: ['var(--panel)', 'var(--line)', null], future: ['none', 'var(--line)', '3 4'] }[kind];
      g.appendChild(s('rect', { x: x, y: y, width: w, height: SH, rx: 5, fill: look[0], stroke: look[1], 'stroke-width': kind === 'A' ? 2.5 : 1.5, 'stroke-dasharray': look[2] }));
      if (kind === 'A') g.appendChild(t(x + w / 2, y + SH / 2 + 7, 'A' + i, { fs: 20, bold: true, fill: 'var(--accent)', anchor: 'middle' }));
      if (fresh && n === now) g.setAttribute('class', 'h3-pop');   // the slot this Step filled (CSS: off with motion off)
      return g;
    }
    function row(y0, name, rule, mean, sent, owner) {
      var m = st.m, k = st.k, left = m.burst, lastA = sent[m.burst - 1], idle = 0, y = y0 + 4;
      svg.appendChild(t(0, y0 + 26, name, { fs: 30, bold: true }));
      svg.appendChild(t(0, y0 + 54, rule, { fs: 20, fill: 'var(--muted)' }));
      svg.appendChild(t(0, y0 + 80, mean, { fs: 20 }));
      for (var n = 1; n <= SLOTS; n++) {
        var i = sent.indexOf(n);
        if (owner) svg.appendChild(t(sx(n) + SW / 2, y - 8, owner(n), { fs: 18, bold: owner(n) === 'A', fill: owner(n) === 'A' ? 'var(--accent)' : 'var(--muted)', anchor: 'middle' }));
        if (n > k) { svg.appendChild(slot(n, y, 'future')); continue; }
        if (i >= 0) { left--; svg.appendChild(slot(n, y, 'A', i + 1)); continue; }
        if (n < lastA) idle++;
        svg.appendChild(slot(n, y, n < lastA ? 'idle' : 'free'));
      }
      var done = k >= lastA;
      svg.appendChild(t(0, y0 + 110, done ? 'A done · slot ' + lastA + (owner ? ' · ' + idle + ' idle' : '') : 'A: ' + left + ' queued' + (owner ? ' · ' + idle + ' idle' : ''),
        { fs: 22, bold: true, fill: done ? 'var(--green)' : null }));
    }
    function draw() {
      CN.clear(svg);
      var m = st.m, N = m.n, k = st.k;
      now = k;
      svg.appendChild(t(W - 6, 20, 'slot ' + k + ' of ' + m.end, { fs: 20, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      row(34, 'One channel', 'A sends at the full rate C', 'mean delay T = ' + us(T_US), m.shared, null);
      row(224, 'TDM, N = ' + N, N === 1 ? 'one slice: the whole channel' : 'A owns 1 slot in ' + N, 'mean delay N·T = ' + us(N * T_US), m.tdm, m.owner);
      for (var n = 1; n <= SLOTS; n++) svg.appendChild(t(sx(n) + SW / 2, H - 6, String(n), { fs: 18, fill: 'var(--muted)', anchor: 'middle' }));
      if (k > 0) svg.appendChild(s('line', { x1: sx(k) + SW, y1: 30, x2: sx(k) + SW, y2: H - 26, stroke: 'var(--ink)', 'stroke-width': 2 }));
      fresh = false;
    }
    function step() { if (st.k >= st.m.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = X.staticTdm(hN.value()); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    return { step: step, reset: reset, reached: function () { return st.k >= st.m.end; },
      prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  function curves(body) {
    var PW = 1100, PH = 620, px0 = 90, py0 = PH - 60, pw = PW - 140, ph = PH - 100;
    var plot = s('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH });
    function gx(g) { return px0 + g / 3 * pw; }
    function sy(v) { return py0 - v / 0.4 * ph; }
    for (var g = 0; g <= 3; g += 0.5) {
      plot.appendChild(s('line', { x1: gx(g), y1: py0, x2: gx(g), y2: py0 - ph, stroke: 'var(--line)', 'stroke-width': 1 }));
      plot.appendChild(s('text', { x: gx(g), y: py0 + 30, 'text-anchor': 'middle', 'font-size': 24 }, String(g)));
    }
    for (var v = 0; v <= 0.4001; v += 0.1) {
      plot.appendChild(s('line', { x1: px0, y1: sy(v), x2: px0 + pw, y2: sy(v), stroke: 'var(--line)', 'stroke-width': 1 }));
      plot.appendChild(s('text', { x: px0 - 12, y: sy(v) + 8, 'text-anchor': 'end', 'font-size': 24 }, v.toFixed(1)));
    }
    plot.appendChild(s('text', { x: px0 + pw / 2, y: PH - 6, 'text-anchor': 'middle', 'font-size': 24, fill: 'var(--muted)' }, 'G (attempts per frame time)'));
    plot.appendChild(s('text', { x: 24, y: py0 - ph / 2, 'font-size': 24, fill: 'var(--muted)', transform: 'rotate(-90 24 ' + (py0 - ph / 2) + ')', 'text-anchor': 'middle' }, 'S (throughput)'));
    function curve(fn) {
      var d = '';
      for (var i = 0; i <= 300; i++) { var G = i / 100; d += (i ? 'L' : 'M') + gx(G).toFixed(1) + ' ' + sy(fn(G)).toFixed(1) + ' '; }
      return d;
    }
    plot.appendChild(s('path', { d: curve(X.alohaSlotted), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 5 }));
    plot.appendChild(s('path', { d: curve(X.alohaPure), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 4, 'stroke-dasharray': '12 8' }));
    plot.appendChild(s('circle', { cx: gx(1), cy: sy(1 / Math.E), r: 8, fill: 'var(--accent)' }));
    plot.appendChild(s('text', { x: gx(1.4), y: sy(0.352), 'font-size': 26, 'font-weight': 700, fill: 'var(--accent)' }, 'Slotted: S = Ge⁻ᴳ, max 1/e ≈ 0.368 at G = 1'));
    plot.appendChild(s('circle', { cx: gx(0.5), cy: sy(1 / (2 * Math.E)), r: 8, fill: 'var(--ink)' }));
    plot.appendChild(s('text', { x: gx(1.15), y: sy(0.2), 'font-size': 26, 'font-weight': 700 }, 'Pure (dashed): S = Ge⁻²ᴳ, max 1/2e ≈ 0.184 at G = 0.5'));
    body.appendChild(h('div', { class: 'panel', style: {} }, plot));
    return {};
  }

  function timeline(body, slotted) {
    var TW = 1460, lanes = 5, lx0 = 70, lw = TW - 100, frames = 12, laneH = 80, TH = 50 + lanes * laneH + 40;
    var tl = s('svg', { width: TW, height: TH, viewBox: '0 0 ' + TW + ' ' + TH });
    var r = X.rng(SEED * 7919), list = [];
    for (var k = 0; k < lanes; k++) {
      var t = 0;
      for (;;) {
        t += -Math.log(1 - r()) / (G / lanes);
        if (t > frames - 1) break;
        var start = slotted ? Math.ceil(t) : t;
        if (start > frames - 1) break;
        list.push({ lane: k, start: start });
      }
    }
    list.forEach(function (a) { a.hit = list.some(function (b) { return b !== a && Math.abs(b.start - a.start) < 1 - 1e-9; }); });
    var u = lw / frames;
    function tx(t) { return lx0 + t * u; }
    // the frame whose vulnerable period is shaded: the first one after 2t
    var pick = list.filter(function (f) { return f.start >= 2; }).sort(function (a, b) { return a.start - b.start; })[0];
    if (pick) {
      var a = slotted ? pick.start : pick.start - 1, b = pick.start + 1;
      tl.appendChild(s('rect', { x: tx(a), y: 4, width: tx(b) - tx(a), height: TH - 44, fill: 'var(--accent-bg)' }));
      tl.appendChild(s('text', { x: tx(pick.start + 0.5), y: 28, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 700, fill: 'var(--accent)' },
        'vulnerable: ' + (slotted ? '1 frame time' : '2 frame times')));
    }
    for (var i = 0; i <= frames; i++) {
      tl.appendChild(s('line', { x1: tx(i), y1: 40, x2: tx(i), y2: TH - 36, stroke: slotted ? 'var(--muted)' : 'var(--line)', 'stroke-width': slotted ? 1.5 : 1, 'stroke-dasharray': slotted ? null : '3 5' }));
      if (i % 2 === 0) tl.appendChild(s('text', { x: tx(i), y: TH - 8, 'text-anchor': 'middle', 'font-size': 22, fill: 'var(--muted)' }, i + 't'));
    }
    for (k = 0; k < lanes; k++) tl.appendChild(s('text', { x: 10, y: 50 + k * laneH + 40, 'font-size': 26, 'font-weight': 700 }, 'S' + (k + 1)));
    list.forEach(function (f) {
      var y = 50 + f.lane * laneH;
      tl.appendChild(s('rect', { x: tx(f.start) + 1, y: y + 8, width: u - 2, height: laneH - 24, rx: 6, fill: f.hit ? 'var(--red-bg)' : 'var(--green-bg)', stroke: f.hit ? 'var(--red)' : 'var(--green)', 'stroke-width': 2.5 }));
      tl.appendChild(s('text', { x: tx(f.start) + u / 2, y: y + 46, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, fill: f.hit ? 'var(--red)' : 'var(--green)' }, f.hit ? '✕' : '✓'));
    });
    body.appendChild(h('div', { class: 'say' }, slotted ? 'Frames may start only on a slot boundary.' : 'A station sends whenever it has a frame.'));
    body.appendChild(h('div', { class: 'panel' }, tl));
    return {};
  }

  var PARTS = {
    static: staticAlloc, curves: curves,
    pure: function (body) { return timeline(body, false); },
    slotted: function (body) { return timeline(body, true); }
  };

  CN.screens.t6 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
