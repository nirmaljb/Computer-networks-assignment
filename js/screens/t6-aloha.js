(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  // SPEC-v5: four static sub-slides. Static allocation maths, the S–G curves,
  // then one fixed 5-station run for pure and for slotted ALOHA (G = 1, seed 11).
  var G = 1, SEED = 11;

  function staticAlloc(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '18px', padding: '36px', marginTop: '40px', fontSize: '34px' } },
      h('div', { class: 'label', style: { fontSize: '26px' } }, 'Static FDM/TDM wastes capacity on bursty traffic'),
      h('div', { class: 'mono' }, 'T = 1/(μC − λ)    N sub-channels → T_N = N·T'),
      h('div', { class: 'mono' }, 'C = 100 Mbps, 1/μ = 10,000 bits, λ = 5000/s'),
      h('div', { class: 'mono' }, '→ T = 1/(10,000 − 5000) = ', h('b', null, '200 µs'), ' ;  N = 10 → 2 ms')));
    return {};
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
    body.appendChild(h('div', { class: 'panel', style: { alignSelf: 'flex-start' } }, plot));
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
