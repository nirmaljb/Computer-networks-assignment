(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  // SPEC-v5: four sub-slides. Static allocation (a Step sim since v14), the S–G curves,
  // then the pure and slotted ALOHA "what if" Step sims (v23).

  // 6a (v14): static allocation as a Step sim (CN.csma.staticTdm). A bursts 3 frames while the other N − 1 stations
  // are silent; three alternative rules for the same channel: the whole channel (A done at slot 3), TDM (A owns every
  // Nth slot, done at 2N + 1, the slots in between sit idle) and FDM (v17: A owns 1 band of N at C/N, so each frame
  // takes N slots, done at 3N, the other bands sit idle). One Step = one slot. Chips N = 1 / 2 / 5 / 10; the mean
  // delays are T = 1/(μC − λ) = 200 µs and N·T for both splits (C = 100 Mbps, 1/μ = 10,000 bits, λ = 5000/s).
  // N = 1: the three rows are the same.
  var SLOTS = 30, T_US = 1e6 * X.staticDelay(1e8, 1e4, 5000, 1);
  function us(v) { return v >= 1000 ? (v / 1000) + ' ms' : v + ' µs'; }
  function staticAlloc(body) {
    var W = 1300, H = 500, X0 = 320, SW = (W - 10 - X0) / SLOTS, SH = 80;
    var hN = ui.handle({ key: 'N', label: 'N', kind: 'chips', value: 10, values: X.TDM_NS, fmt: function () { return ''; }, chip: String });
    var st = { k: 0, m: null, end: 0 }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Same 3-frame burst from A, the rest silent, three rules for the channel. Mean delay: T = 1/(μC − λ) on one channel, N·T on N slices (TDM or FDM).'));
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
    // FDM: A's band (top) carries C/N, so frame i is one box N slots wide that fills a slot per Step; the other
    // N − 1 bands (bottom, not to scale) carry nothing. N = 1: one band, the same boxes as the top row.
    function fdmRow(y0) {
      var m = st.m, N = m.n, k = st.k, y = y0 + 4, AH = N === 1 ? SH : SH * 0.55, left = 0, sending = 0;
      svg.appendChild(t(0, y0 + 26, 'FDM, N = ' + N, { fs: 30, bold: true }));
      svg.appendChild(t(0, y0 + 54, N === 1 ? 'one band: the whole channel' : 'A owns 1 band in ' + N + ', at C/' + N, { fs: 20, fill: 'var(--muted)' }));
      svg.appendChild(t(0, y0 + 80, 'mean delay N·T = ' + us(N * T_US), { fs: 20 }));
      m.fdm.forEach(function (fin, i) {
        var a = fin - N + 1, done = Math.min(Math.max(k - a + 1, 0), N), x = sx(a) + 2;
        if (done < N) { left++; if (done > 0) sending = i + 1; }
        svg.appendChild(s('rect', { x: x, y: y, width: N * SW - 4, height: AH, rx: 5, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }));
        if (!done) return;
        var g = s('g');
        g.appendChild(s('rect', { x: x, y: y, width: done * SW - 4, height: AH, rx: 5, fill: 'var(--accent-bg)', stroke: 'var(--accent)', 'stroke-width': 2.5 }));
        g.appendChild(t(x + (done * SW - 4) / 2, y + AH / 2 + 7, 'A' + (i + 1), { fs: 20, bold: true, fill: 'var(--accent)', anchor: 'middle' }));
        if (fresh && k >= a && k <= fin) g.setAttribute('class', 'h3-pop');
        svg.appendChild(g);
      });
      for (var n = m.fdmEnd + 1; n <= SLOTS; n++) svg.appendChild(slot(n, y, n > k ? 'future' : 'free'));
      if (N > 1) {
        var oy = y + AH + 4, oh = SH - AH - 4, last = String.fromCharCode(64 + N);
        if (k > 0) svg.appendChild(s('rect', { x: sx(1) + 2, y: oy, width: Math.min(k, SLOTS) * SW - 4, height: oh, rx: 5, fill: 'var(--grey-bg)', stroke: 'var(--red)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
        if (k < SLOTS) svg.appendChild(s('rect', { x: sx(k + 1) + 2, y: oy, width: (SLOTS - k) * SW - 4, height: oh, rx: 5, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }));
        svg.appendChild(t(sx(1) + 12, oy + oh / 2 + 7, (N === 2 ? 'B: 1 band' : 'B–' + last + ': ' + (N - 1) + ' bands') + ', idle the whole time', { fs: 18, fill: 'var(--muted)' }));
      }
      var over = k >= m.fdmEnd;
      svg.appendChild(t(0, y0 + 110, over ? 'A done · slot ' + m.fdmEnd : 'A: ' + left + ' left' + (sending ? ' · sending A' + sending : ''),
        { fs: 22, bold: true, fill: over ? 'var(--green)' : null }));
    }
    function draw() {
      CN.clear(svg);
      var m = st.m, N = m.n, k = st.k;
      now = k;
      svg.appendChild(t(W - 6, 20, 'slot ' + k + ' of ' + st.end, { fs: 20, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      row(34, 'One channel', 'A sends at the full rate C', 'mean delay T = ' + us(T_US), m.shared, null);
      row(194, 'TDM, N = ' + N, N === 1 ? 'one slice: the whole channel' : 'A owns 1 slot in ' + N, 'mean delay N·T = ' + us(N * T_US), m.tdm, m.owner);
      fdmRow(354);
      for (var n = 1; n <= SLOTS; n++) svg.appendChild(t(sx(n) + SW / 2, H - 6, String(n), { fs: 18, fill: 'var(--muted)', anchor: 'middle' }));
      if (k > 0) svg.appendChild(s('line', { x1: sx(k) + SW, y1: 30, x2: sx(k) + SW, y2: H - 26, stroke: 'var(--ink)', 'stroke-width': 2 }));
      fresh = false;
    }
    function step() { if (st.k >= st.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = X.staticTdm(hN.value()); st.end = Math.max(st.m.end, st.m.fdmEnd); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // learnStep: the slot reached (the pane's slot table follows the N chip through genText)
    return { step: step, reset: reset, reached: function () { return st.k >= st.end; }, learnStep: function () { return st.k; }, genText: function () { return 'N ' + hN.value(); },
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

  // 6c/6d (v23): one frame A, t₀ to t₀ + t, and four "what if" frames from CN.csma.alohaWhatIf, each alone with A
  // (each row an A lane and a B lane, empty until its Step). Step 0 = A alone, Steps 1–4 = one row each (✓ / ✕, the overlap hatched red),
  // Step 5 = the vulnerable period shaded: the ready times that kill A, 2t pure, t slotted. Slotted rows show
  // the ready dot and the wait to the next slot boundary. v25: with motion on, each row's Step plays as a clock:
  // a "now" line sweeps the row's time span, the frames fill in as it passes, and the pair turns red the instant
  // B first overlaps A (or green once both have ended clean). Run waits for the sweep (runMs); motion off = instant.
  function whatIf(body, slotted) {
    var m = X.alohaWhatIf(slotted), W = 1400, H = 600, LX = 230, RX = 1110, T0 = -2, T1 = 3, U = (RX - LX) / (T1 - T0);
    var AY = 58, RY = 182, RH = 58, LH = 27, LG = 4, GAP = 80, AXY = RY + 4 * GAP + 4, END = m.rows.length + 1, id = slotted ? 'al6d' : 'al6c';
    var st = { k: 0, clock: null }, fresh = false, raf = 0, SEC = 0.75;   // SEC: seconds of sweep per frame time t
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, slotted ? 'Same question, but a frame may leave only on a slot boundary: a station that is ready mid-slot waits.'
      : 'A is on the air from t₀ to t₀ + t. Where can another frame start without hitting it?'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    function tx(v) { return LX + (v - T0) * U; }
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 20, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'start' }, str);
    }
    function when(v) { return v === 0 ? 't₀' : 't₀ ' + (v < 0 ? '−' : '+') + ' ' + (Math.abs(v) === 1 ? '' : Math.abs(v)) + 't'; }
    // frac: how much of the frame is on the air so far (the sweep), 1 = all of it
    function frame(g, v, y, look, fh, frac) {
      frac = frac == null ? 1 : frac;
      g.appendChild(s('rect', { x: tx(v) + 2, y: y, width: Math.max(frac * U - 4, 1), height: fh || RH, rx: 6, fill: look[0], stroke: look[1], 'stroke-width': look[2] || 2.5, 'stroke-dasharray': look[3] || null }));
    }
    // a ready dot and, if it had to wait, a dashed arrow to the slot boundary it leaves on
    // (upto: the sweep's clock; the arrow grows with it)
    function ready(g, r, v, y, col, fh, upto) {
      var cy = y + (fh || RH) / 2, e = upto == null ? v : Math.min(upto, v);
      if (upto != null && upto < r) return;
      g.appendChild(s('circle', { cx: tx(r), cy: cy, r: 7, fill: col }));
      if (tx(e) - 4 > tx(r) + 9) g.appendChild(s('line', { x1: tx(r) + 9, y1: cy, x2: tx(e) - 4, y2: cy, stroke: col, 'stroke-width': 2.5, 'stroke-dasharray': '6 5', 'marker-end': e >= v ? 'url(#' + id + '-ah)' : null }));
    }
    function clockText(v) { var a = Math.abs(v).toFixed(2); return a === '0.00' ? 't₀' : 't₀ ' + (v < 0 ? '−' : '+') + ' ' + a + 't'; }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function why(r) {
      if (!slotted) return r.hit ? (r.start < 0 ? 'still on the air when A starts' : 'starts while A is on the air') : (r.start < 0 ? 'ends before A starts' : 'starts after A ends');
      return 'waits to ' + when(r.start) + ': ' + (r.hit ? 'A\'s slot' : r.start < m.a.start ? 'the slot before A\'s' : 'a later slot');
    }
    function draw() {
      CN.clear(svg);
      var k = st.k;
      svg.appendChild(s('defs', null, [
        s('marker', { id: id + '-ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--muted)' })),
        s('pattern', { id: id + '-hatch', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('rect', { width: 5, height: 10, fill: 'var(--red)', opacity: 0.55 }))]));
      // Step 5: the vulnerable period, under everything else
      if (k >= END) {
        var vb = s('g', { class: 'u4d-in' });
        vb.appendChild(s('rect', { x: tx(m.vuln[0]), y: 30, width: tx(m.vuln[1]) - tx(m.vuln[0]), height: AXY - 30, fill: 'var(--accent-bg)', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
        vb.appendChild(t((tx(m.vuln[0]) + tx(m.vuln[1])) / 2, 22, 'vulnerable period = ' + (slotted ? 't (one slot)' : '2t'), { fs: 22, bold: true, fill: 'var(--accent)', anchor: 'middle' }));
        svg.appendChild(vb);
      }
      // the time grid: slot boundaries (slotted) or plain frame-time ticks, and A's start and end guides
      for (var v = T0; v <= T1; v++) {
        var guide = v === 0 || v === 1;
        svg.appendChild(s('line', { x1: tx(v), y1: AY - 8, x2: tx(v), y2: AXY, stroke: guide ? 'var(--accent)' : 'var(--line)', 'stroke-width': guide ? 2 : slotted ? 2 : 1, 'stroke-dasharray': guide ? '4 5' : slotted ? null : '3 6' }));
        svg.appendChild(t(tx(v), AXY + 30, when(v), { fs: 20, bold: guide, fill: guide ? 'var(--accent)' : 'var(--muted)', anchor: 'middle' }));
      }
      svg.appendChild(s('line', { x1: LX, y1: AXY, x2: RX, y2: AXY, stroke: 'var(--ink)', 'stroke-width': 2 }));
      if (slotted) svg.appendChild(t(RX + 20, AY + RH / 2 + 8, 'grey lines: slots of t', { fs: 17, fill: 'var(--muted)' }));
      // A, the frame we follow
      svg.appendChild(t(0, AY + 28, 'A', { fs: 30, bold: true, fill: 'var(--accent)' }));
      svg.appendChild(t(0, AY + 54, slotted ? 'ready at t₀ − 0.4t' : 'starts at t₀', { fs: 18, fill: 'var(--muted)' }));
      svg.appendChild(t(RX + 20, AY + RH / 2 + (slotted ? 30 : 8), 'A alone: no collision', { fs: 17, fill: 'var(--muted)' }));
      var ga = s('g');
      frame(ga, m.a.start, AY, ['var(--accent-bg)', 'var(--accent)', 3]);
      ga.appendChild(t(tx(m.a.start) + U / 2, AY + RH / 2 + 9, 'A', { fs: 26, bold: true, fill: 'var(--accent)', anchor: 'middle' }));
      if (slotted) ready(ga, m.a.ready, m.a.start, AY, 'var(--accent)');
      svg.appendChild(ga);
      svg.appendChild(t(0, RY - 22, slotted ? 'What if one other station B is ready at …' : 'What if one other frame B starts at …', { fs: 22, bold: true }));
      // each row is its own scenario, A and B alone on the channel: A's lane on top, B's below. Nothing is drawn in
      // a row until its Step; then both frames take the outcome's colour (both lost, or both through). While the
      // row's sweep plays, c is the clock: frames show only up to it, and the colour waits for the outcome.
      m.rows.forEach(function (r, i) {
        var y = RY + i * GAP, by = y + LH + LG, live = st.clock != null && i === k - 1, c = live ? st.clock : Infinity;
        var o0 = Math.max(r.start, m.a.start), o1 = Math.min(r.start, m.a.start) + 1;
        var decided = r.hit ? c >= o0 : c >= Math.max(r.start, m.a.start) + 1;
        var ink = r.hit ? 'var(--red)' : 'var(--green)', bg = r.hit ? 'var(--red-bg)' : 'var(--green-bg)';
        svg.appendChild(t(0, y + RH / 2 + 8, when(r.ready), { fs: 24, bold: i < k, fill: i < k ? null : 'var(--muted)' }));
        if (i >= k) return;
        var g = s('g');
        var fs = [[m.a.start, y, 'A', 'var(--accent-bg)', 'var(--accent)'], [r.start, by, 'B', 'var(--grey-bg)', 'var(--ink)']];
        fs.forEach(function (f) { var fr = clamp01(c - f[0]); if (fr > 0) frame(g, f[0], f[1], decided ? [bg, ink] : [f[3], f[4]], LH, fr); });
        if (r.hit && decided) {
          var o2 = Math.min(o1, c);
          [y, by].forEach(function (ly) { g.appendChild(s('rect', { x: tx(o0) + 2, y: ly + 2, width: Math.max(tx(o2) - tx(o0) - (o2 >= o1 ? 4 : 2), 1), height: LH - 4, fill: 'url(#' + id + '-hatch)' })); });
        }
        fs.forEach(function (f) {
          if (c - f[0] < 0.6) return;
          g.appendChild(t(tx(f[0]) + U / 2, f[1] + LH / 2 + 7, f[2] + (decided ? (r.hit ? ' ✕' : ' ✓') : ''), { fs: 18, bold: true, fill: decided ? ink : f[4], anchor: 'middle' }));
        });
        if (slotted) ready(g, r.ready, r.start, by, 'var(--muted)', LH, live ? c : null);
        if (decided) {
          g.appendChild(t(RX + 20, y + 26, r.hit ? '✕ both lost' : '✓ both get through', { fs: 22, bold: true, fill: ink }));
          g.appendChild(t(RX + 20, y + 50, why(r), { fs: 17, fill: 'var(--muted)' }));
        }
        if (fresh && i === k - 1) g.setAttribute('class', 'h3-pop');
        svg.appendChild(g);
      });
      // the sweep's clock: a "now" line over the grid and its reading
      if (st.clock != null) {
        var cx = tx(st.clock);
        svg.appendChild(s('line', { x1: cx, y1: 32, x2: cx, y2: AXY, stroke: 'var(--ink)', 'stroke-width': 2.5 }));
        svg.appendChild(t(cx, 24, 'now = ' + clockText(st.clock), { fs: 20, bold: true, anchor: 'middle' }));
      }
      if (k >= END) svg.appendChild(t(W / 2, H - 6, slotted
        ? 'Only a frame ready in the slot before A\'s can hit it: P(A survives) = e⁻ᴳ, so S = Ge⁻ᴳ, max 1/e ≈ 0.368'
        : 'Any other start in a 2t window kills A: P(A survives) = e⁻²ᴳ, so S = Ge⁻²ᴳ, max 1/(2e) ≈ 0.184',
        { fs: 21, bold: true, anchor: 'middle' }));
      fresh = false;
    }
    // the sweep for row i: from just before its first event (a ready time or a start) to just after its last end
    function stopSweep() { if (raf) cancelAnimationFrame(raf); raf = 0; st.clock = null; }
    function sweep(r) {
      var lo = Math.max(T0, Math.min(r.ready, m.a.start) - 0.25), hi = Math.min(T1, Math.max(r.start, m.a.start) + 1.25), t0 = performance.now();
      function tick(now) {
        if (!svg.isConnected) { raf = 0; st.clock = null; return; }
        st.clock = lo + (now - t0) / 1000 / SEC;
        if (st.clock >= hi) { st.clock = null; raf = 0; draw(); return; }
        draw();
        raf = requestAnimationFrame(tick);
      }
      tick(t0);
    }
    function step() {
      stopSweep();
      if (st.k >= END) return false;
      st.k++;
      if (st.k <= m.rows.length && CN.motion()) { fresh = false; sweep(m.rows[st.k - 1]); } else { fresh = true; draw(); }
      return true;
    }
    function reset() { stopSweep(); st.k = 0; fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    return { step: step, reset: reset, reached: function () { return st.k >= END; }, learnStep: function () { return st.k; },
      get runMs() { return CN.motion() ? 3000 : 800; },   // Run lets each row's sweep (at most 3t) finish
      prev: function () { stopSweep(); if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  var PARTS = {
    static: staticAlloc, curves: curves,
    pure: function (body) { return whatIf(body, false); },
    slotted: function (body) { return whatIf(body, true); }
  };

  CN.screens.t6 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
