(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  var COLORS = ['#0e7c86', '#7a4fd0', '#b0306a', '#8a6a1e'];
  var SCEN = {
    far: { name: 'Far ends start together', schedule: [{ at: 0, st: 0 }, { at: 0, st: 3 }] },
    wait: { name: 'Two waiting on a busy channel', schedule: [{ at: 0, st: 1 }, { at: 4, st: 0 }, { at: 4, st: 2 }] },
    short: { name: 'Short frame (< 2τ)', schedule: [{ at: 0, st: 0, len: 5 }, { at: 5, st: 3, len: 16 }] }
  };
  var STATE_TEXT = { idle: 'idle', ready: 'has frame', sensing: 'listening (busy)', tx: 'TRANSMITTING', jam: 'JAM', backoff: 'backoff', defer: 'waiting', waitack: 'waiting for ACK', gaveup: 'gave up ✕' };

  CN.screens.t7 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var st = { mode: '1p', p: 0.5, cd: true, seed: 42, scen: 'far', bus: null, n: 0 };
    var backBtn = ui.backBtn(back);

    var pLabel = h('span', { class: 'mono small' }, 'p = 0.5');
    var pSlider = h('input', { type: 'range', min: 0.1, max: 0.9, step: 0.1, value: st.p, style: { width: '140px' } });
    pSlider.addEventListener('input', function () { st.p = +pSlider.value; pLabel.textContent = 'p = ' + st.p.toFixed(1); reset(); });
    var seedChip = h('span', { class: 'chip mono' });
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { step(); return !st.bus.done; }, 140, function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    var scenSeg = ui.seg(Object.keys(SCEN).map(function (k) { return [k, SCEN[k].name]; }), st.scen, function (v) { st.scen = v; reset(); });
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } },
      ui.seg([['1p', '1-persistent'], ['np', 'Non-persistent'], ['pp', 'p-persistent']], st.mode, function (v) { st.mode = v; reset(); }),
      pSlider, pLabel,
      ui.toggle('Collision detection (CD)', st.cd, function (v) { st.cd = v; reset(); }),
      seedChip, ui.btn('Reroll', function () { st.seed = Math.floor(Math.random() * 9000) + 1000; reset(); })));
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'label' }, 'Scenario'), scenSeg,
      backBtn, ui.btn('Step (S)', step), runBtn, ui.btn('Reset', reset)));

    var BW = 1000, bx0 = 70, bx1 = 800;
    var busSvg = s('svg', { width: BW, height: 170, viewBox: '0 0 ' + BW + ' 170' });
    var stSvg = s('svg', { width: BW, height: 300, viewBox: '0 0 ' + BW + ' 300' });
    var log = h('div', { class: 'working', style: { height: '290px', fontSize: '19px', lineHeight: '1.35' } });
    var mbps = h('input', { class: 'field', type: 'number', value: 10, step: 'any', style: { width: '110px' } });
    var slot = h('input', { class: 'field', type: 'number', value: 51.2, step: 'any', style: { width: '110px' } });
    var mfOut = h('div', { class: 'mono', style: { fontSize: '24px', fontWeight: 700 } });
    function calc() {
      var r = X.minFrame(+mbps.value * 1e6, +slot.value * 1e-6);
      mfOut.textContent = (+mbps.value) + ' Mbps × ' + (+slot.value) + ' µs = ' + r.bits + ' bits = ' + r.bytes + ' bytes';
    }
    mbps.addEventListener('input', calc); slot.addEventListener('input', calc);
    calc();

    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { class: 'panel col', style: { gap: '0', padding: '6px 10px' } }, busSvg, stSvg),
      h('div', { class: 'col grow', style: { gap: '10px' } },
        h('div', { class: 'label' }, 'Event log (backoff draws use the seed)'), log,
        h('div', { class: 'panel col', style: { gap: '6px' } },
          h('div', { class: 'label' }, 'Minimum frame = bandwidth × 2τ'),
          h('div', { class: 'row' }, mbps, h('span', { class: 'small' }, 'Mbps ×'), slot, h('span', { class: 'small' }, 'µs')),
          mfOut,
          h('div', { class: 'small muted' }, '10 Mbps, 2500 m, 4 repeaters → RTT ≈ 50 µs → slot 51.2 µs = 512 bit times')))));

    function xOf(u) { return bx0 + (u / st.bus.tau) * (bx1 - bx0); }

    function reset() {
      runner.stop();
      st.bus = X.createBus({ mode: st.mode, p: st.p, cd: st.cd, seed: st.seed, schedule: SCEN[st.scen].schedule.map(function (e) { return Object.assign({}, e); }) });
      st.n = 0;
      seedChip.textContent = 'seed ' + st.seed;
      draw();
    }
    function step() { if (!st.bus.done) { st.bus.step(); st.n++; } draw(); }
    // The bus is seeded, so rebuilding it and replaying one step fewer lands on the previous tick.
    function back() {
      if (!st.n) return;
      var n = st.n - 1;
      reset();
      while (st.n < n) { st.bus.step(); st.n++; }
      draw();
    }

    function draw() {
      backBtn.disabled = !st.n;
      var b = st.bus, t = b.t;
      // --- live bus ---
      CN.clear(busSvg);
      var busY = 118;
      busSvg.appendChild(s('line', { x1: bx0 - 30, y1: busY, x2: bx1 + 30, y2: busY, stroke: 'var(--ink)', 'stroke-width': 5 }));
      busSvg.appendChild(s('text', { x: bx1 + 50, y: busY + 8, 'font-size': 22, 'font-weight': 700, fill: 'var(--accent)' }, 't = ' + t));
      var segs = b.segments(t);
      segs.forEach(function (sg) {
        var lane = sg.tx.st;
        busSvg.appendChild(s('rect', { x: xOf(sg.lo), y: busY - 4 + (lane - 1.5) * 7 - 3, width: Math.max(2, xOf(sg.hi) - xOf(sg.lo)), height: 9, rx: 3,
          fill: COLORS[lane], opacity: 0.85 }));
      });
      // collision zones: where two or more signals overlap right now
      var hot = [];
      for (var u = 0; u <= b.tau + 1e-9; u += 0.1) {
        var n = segs.filter(function (sg) { return u >= sg.lo - 1e-9 && u <= sg.hi + 1e-9; }).length;
        if (n >= 2) hot.push(u);
      }
      if (hot.length) {
        busSvg.appendChild(s('rect', { x: xOf(hot[0]) - 3, y: busY + 18, width: xOf(hot[hot.length - 1]) - xOf(hot[0]) + 6, height: 10, fill: 'var(--red)' }));
        busSvg.appendChild(s('text', { x: (xOf(hot[0]) + xOf(hot[hot.length - 1])) / 2, y: busY + 50, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 800, fill: 'var(--red)' }, '✕ collision'));
      }
      b.stations.forEach(function (stn, i) {
        var x = xOf(stn.x);
        var busyHere = b.busyFor(i, t);
        var g = s('g', { class: 'clickable' },
          s('line', { x1: x, y1: 70, x2: x, y2: busY, stroke: 'var(--ink)', 'stroke-width': 3 }),
          s('rect', { x: x - 36, y: 6, width: 72, height: 50, rx: 8, fill: 'var(--panel)', stroke: COLORS[i], 'stroke-width': stn.state === 'tx' || stn.state === 'jam' ? 6 : 3 }),
          s('text', { x: x, y: 41, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 800, fill: COLORS[i] }, stn.name),
          s('text', { x: x + 44, y: 30, 'font-size': 19, 'font-weight': 700, fill: stn.state === 'tx' ? COLORS[i] : stn.state === 'jam' || stn.state === 'gaveup' ? 'var(--red)' : 'var(--muted)' },
            STATE_TEXT[stn.state] + (stn.state === 'backoff' || stn.state === 'defer' ? ' → t=' + stn.waitUntil : '')),
          s('text', { x: x + 44, y: 54, 'font-size': 18, fill: busyHere ? 'var(--red)' : 'var(--green)' }, busyHere ? 'hears: busy' : 'hears: idle'));
        g.addEventListener('click', function () { b.enqueue(i); b.done = false; log.scrollTop = 1e9; });
        busSvg.appendChild(g);
      });

      // --- space-time diagram ---
      CN.clear(stSvg);
      var top = 26, H = 300 - top - 8, span = 44, off = Math.max(0, t - span + 4), pt = H / span;
      function ty(tt) { return top + (tt - off) * pt; }
      stSvg.appendChild(s('text', { x: 4, y: 18, 'font-size': 19, fill: 'var(--muted)', 'font-weight': 700 }, 'time ↓   position →     τ = ' + b.tau + ' ticks, contention slot 2τ = ' + b.slot + ' ticks'));
      var clipId = 'clip' + Math.random().toString(36).slice(2);
      stSvg.appendChild(s('clipPath', { id: clipId }, s('rect', { x: 0, y: top, width: BW, height: Math.max(0, ty(t) - top) })));
      b.stations.forEach(function (stn) {
        stSvg.appendChild(s('line', { x1: xOf(stn.x), y1: top, x2: xOf(stn.x), y2: 300, stroke: 'var(--line)', 'stroke-width': 1.5 }));
      });
      for (var k = Math.ceil(off / b.tau) * b.tau; k <= off + span; k += b.tau) {
        stSvg.appendChild(s('text', { x: 6, y: ty(k) + 6, 'font-size': 17, fill: 'var(--muted)' }, String(k)));
      }
      var L = b.tau, gClip = s('g', { 'clip-path': 'url(#' + clipId + ')' });
      b.txs.forEach(function (tx) {
        var xs = tx.x, a = tx.start, e = tx.end;
        var pts = [[xs, a], [L, a + (L - xs)], [L, e + (L - xs)], [xs, e], [0, e + xs], [0, a + xs]];
        gClip.appendChild(s('polygon', { points: pts.map(function (p) { return xOf(p[0]) + ',' + ty(p[1]); }).join(' '),
          fill: COLORS[tx.st], 'fill-opacity': 0.28, stroke: tx.collided ? 'var(--red)' : COLORS[tx.st], 'stroke-width': tx.collided ? 2.5 : 1.5 }));
        gClip.appendChild(s('line', { x1: xOf(xs), y1: ty(a), x2: xOf(xs), y2: ty(e), stroke: COLORS[tx.st], 'stroke-width': 8 }));
        if (tx.jammed) gClip.appendChild(s('text', { x: xOf(xs) + 8, y: ty(e) - 2, 'font-size': 17, 'font-weight': 800, fill: 'var(--red)' }, 'jam'));
      });
      stSvg.appendChild(gClip);
      stSvg.appendChild(s('line', { x1: 0, y1: ty(t), x2: BW, y2: ty(t), stroke: 'var(--accent)', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }));

      // --- log ---
      CN.clear(log);
      b.log.slice(-16).forEach(function (l) {
        log.appendChild(h('div', { class: l.cls === 'err' ? 'bad' : l.cls === 'ok' ? 'ok' : l.cls === 'warn' ? 'warnc' : '' }, 't=' + l.t + ' ' + l.text));
      });
      if (b.done) log.appendChild(h('div', { class: 'muted' }, '— channel idle —'));
      log.scrollTop = log.scrollHeight;
    }
    reset();
    return { step: step, reset: reset, destroy: function () { runner.stop(); } };
  };
})();
