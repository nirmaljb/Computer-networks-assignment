(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  var COLORS = ['#0e7c86', '#7a4fd0', '#b0306a', '#8a6a1e'];
  // SPEC-v5: one fixed run per sub-slide (seed 42). The persistence variants share one scenario,
  // two stations waiting on a busy channel; CSMA/CD has the far ends start together.
  var WAIT = [{ at: 0, st: 1 }, { at: 4, st: 0 }, { at: 4, st: 2 }], FAR = [{ at: 0, st: 0 }, { at: 0, st: 3 }];
  var RUNS = {
    '1p': { mode: '1p', cd: false, schedule: WAIT, say: '1-persistent: sense; if busy, wait and send the moment it goes idle.' },
    np: { mode: 'np', cd: false, schedule: WAIT, say: 'Non-persistent: if busy, wait a random time before sensing again.' },
    pp: { mode: 'pp', cd: false, schedule: WAIT, say: 'p-persistent (p = 0.5): when idle, send with probability p, else wait one slot.' },
    cd: { mode: '1p', cd: true, schedule: FAR, say: 'CSMA/CD: stop as soon as a collision is heard, jam, then back off.' }
  };
  var STATE_TEXT = { idle: 'idle', ready: 'has a frame', sensing: 'waits: channel busy', tx: 'transmitting', jam: 'sending jam', backoff: 'backing off', defer: 'waiting', waitack: 'waiting for ACK', gaveup: 'gave up ✕' };

  function minFrame(body) {
    var r = X.minFrame(10e6, 51.2e-6);
    body.appendChild(h('div', { class: 'panel col', style: { gap: '18px', padding: '36px', marginTop: '40px', fontSize: '34px' } },
      h('div', { class: 'label', style: { fontSize: '26px' } }, 'Minimum frame = bandwidth × 2τ'),
      h('div', { class: 'mono' }, '10 Mbps × 51.2 µs = ' + r.bits + ' bits = ', h('b', null, r.bytes + ' bytes')),
      h('div', { class: 'muted', style: { fontSize: '26px' } }, '10 Mbps, 2500 m, 4 repeaters → round trip ≈ 50 µs → slot 51.2 µs = 512 bit times')));
    return {};
  }

  // SPEC-v8 handle: drag a station along the cable (positions in propagation ticks from A). On 7a–7c it is B, the
  // station already sending at t = 0; on 7d it is D, the far end of the CSMA/CD pair (B never sends there).
  var MOVER = { '1p': { st: 1, name: 'B', at: 2, spots: [1, 2, 3, 5] }, np: { st: 1, name: 'B', at: 2, spots: [1, 2, 3, 5] },
    pp: { st: 1, name: 'B', at: 2, spots: [1, 2, 3, 5] }, cd: { st: 3, name: 'D', at: 6, spots: [1, 3, 5, 6] } };
  function positions(mv, x) { var p = [0, 2, 4, 6]; p[mv.st] = x; return p; }
  function fullRun(run, pos) {
    return X.createBus({ mode: run.mode, p: 0.5, cd: run.cd, seed: 42, positions: pos, schedule: run.schedule.map(function (e) { return Object.assign({}, e); }) }).run();
  }

  // One figure, three bands on one position axis: the stations (top), the channel itself, a cable whose
  // colour shows whose signal is on it right now (middle), and the time-space diagram (bottom): each
  // station's frame drawn as a wedge spreading both ways along the cable as time runs down.
  // Step jumps to the next event; Run plays it tick by tick.
  function busSlide(body, run, part) {
    var bus, W = 1000, H = 440, X0 = 130, X1 = 890, CY = 112, CH = 28, T0 = 192, T1 = 432, SPAN = 40, mv = MOVER[part];
    var svg = s('svg', { width: 1250, height: 550, viewBox: '0 0 ' + W + ' ' + H });
    var event = h('div', { style: { fontSize: '26px', fontWeight: 700, minHeight: '36px', textAlign: 'center' } });
    var hPos = ui.handle({ key: mv.name, label: mv.name, kind: 'slider', value: mv.at, values: mv.spots, width: 260, fmt: function (v) { return 'at ' + v; } });
    body.appendChild(h('div', { class: 'say' }, run.say));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    body.appendChild(event);
    body.appendChild(ui.handleRow(hPos));

    function xOf(u) { return X0 + (u / bus.tau) * (X1 - X0); }
    function reset() {
      bus = X.createBus({ mode: run.mode, p: 0.5, cd: run.cd, seed: 42, positions: positions(mv, hPos.value()), schedule: run.schedule.map(function (e) { return Object.assign({}, e); }) });
      draw();
    }
    function tick() { if (bus.done) return false; bus.step(); draw(); return true; }
    function step() {
      var n = bus.log.length, guard = 0;
      if (bus.done) return false;
      while (!bus.done && bus.log.length === n && guard++ < 80) bus.step();
      draw(); return true;
    }

    // positions on the cable (0…tau, step 0.1) where two or more signals are on it at once
    function overlap(segs) {
      var hot = [];
      for (var u = 0; u <= bus.tau + 1e-9; u += 0.1) {
        if (segs.filter(function (sg) { return u >= sg.lo - 1e-9 && u <= sg.hi + 1e-9; }).length >= 2) hot.push(u);
      }
      return hot;
    }
    var drawn = { t: 0, hot: false };   // what the last frame showed, so the burst fires once per collision
    function draw() {
      var b = bus, t = b.t;
      CN.clear(svg);
      // --- stations (boxes shrink, text with them, when a moved station sits close to another) ---
      var gap = Infinity;
      b.stations.forEach(function (p, i) { b.stations.forEach(function (q, j) { if (i < j) gap = Math.min(gap, Math.abs(xOf(p.x) - xOf(q.x))); }); });
      var bw = Math.min(156, gap - 6), f = bw / 156;
      b.stations.forEach(function (stn, i) {
        var x = xOf(stn.x), sending = stn.state === 'tx' || stn.state === 'jam';
        var stateCol = stn.state === 'tx' ? COLORS[i] : stn.state === 'jam' || stn.state === 'gaveup' ? 'var(--red)' : 'var(--muted)';
        svg.appendChild(s('line', { x1: x, y1: 80, x2: x, y2: CY, stroke: 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(s('rect', { x: x - bw / 2, y: 6, width: bw, height: 74, rx: 10, fill: sending ? 'var(--panel2)' : 'var(--panel)', stroke: COLORS[i], 'stroke-width': sending ? 6 : 3 }));
        svg.appendChild(s('text', { x: x, y: 30, 'text-anchor': 'middle', 'font-size': 19 * f, 'font-weight': 800, fill: COLORS[i] }, 'Station ' + stn.name));
        svg.appendChild(s('text', { x: x, y: 52, 'text-anchor': 'middle', 'font-size': 15 * f, 'font-weight': 700, fill: stateCol },
          STATE_TEXT[stn.state] + (stn.state === 'backoff' || stn.state === 'defer' ? ' → t=' + stn.waitUntil : '')));
        if (!sending) svg.appendChild(s('text', { x: x, y: 72, 'text-anchor': 'middle', 'font-size': 13 * f, fill: b.busyFor(i, t) ? 'var(--red)' : 'var(--green)' },
          'senses ' + (b.busyFor(i, t) ? 'busy' : 'idle')));
      });
      // --- the channel: one cable, coloured where a station's signal is on it now ---
      svg.appendChild(s('rect', { x: X0 - 50, y: CY, width: X1 - X0 + 100, height: CH, rx: CH / 2, fill: 'var(--panel2)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
      svg.appendChild(s('text', { x: X0 - 56, y: CY + CH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, fill: 'var(--ink)' }, 'channel'));
      var segs = b.segments(t), hot = overlap(segs);
      segs.forEach(function (sg) {
        svg.appendChild(s('rect', { x: xOf(sg.lo), y: CY + 3, width: Math.max(3, xOf(sg.hi) - xOf(sg.lo)), height: CH - 6, rx: 6, fill: COLORS[sg.tx.st], opacity: 0.55 }));
      });
      if (hot.length) {
        var hx0 = xOf(hot[0]), hx1 = xOf(hot[hot.length - 1]);
        svg.appendChild(s('rect', { x: hx0 - 3, y: CY - 3, width: hx1 - hx0 + 6, height: CH + 6, rx: 8, fill: 'none', stroke: 'var(--red)', 'stroke-width': 3.5 }));
        // SPEC-v6 motion: a burst where the signals first meet (drawing only; nothing in the sim changes)
        if (!drawn.hot && t > drawn.t) svg.appendChild(s('circle', { cx: (hx0 + hx1) / 2, cy: CY + CH / 2, r: 46, class: 'fx-burst' }));
        svg.appendChild(s('text', { x: (hx0 + hx1) / 2, y: CY + CH + 22, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: 'var(--red)' }, '✕ collision: two signals overlap'));
      } else {
        svg.appendChild(s('text', { x: W / 2, y: CY + CH + 22, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--muted)' },
          'THE CHANNEL: one shared cable' + (segs.length ? ' (colour = whose signal is on it now)' : ', idle')));
      }
      // --- time-space diagram: position across, time down ---
      var off = Math.max(0, t - SPAN + 4), pt = (T1 - T0) / SPAN;
      function ty(tt) { return T0 + (tt - off) * pt; }
      svg.appendChild(s('text', { x: W / 2, y: T0 - 12, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--muted)' },
        'The same cable over time ↓  Each wedge is one frame spreading both ways from its station; red edge = it was hit.'));
      b.stations.forEach(function (stn, i) {
        svg.appendChild(s('line', { x1: xOf(stn.x), y1: T0, x2: xOf(stn.x), y2: T1, stroke: COLORS[i], 'stroke-width': 1.5, 'stroke-dasharray': '4 5', opacity: 0.6 }));
      });
      for (var k = Math.ceil(off / b.tau) * b.tau; k <= off + SPAN; k += b.tau) {
        if (ty(k) >= T0 && ty(k) <= T1) svg.appendChild(s('text', { x: X0 - 70, y: ty(k) + 5, 'font-size': 13, fill: 'var(--muted)' }, 't=' + k));
      }
      var clipId = 'csma' + Math.random().toString(36).slice(2), L = b.tau;
      svg.appendChild(s('clipPath', { id: clipId }, s('rect', { x: 0, y: T0, width: W, height: Math.max(0, Math.min(ty(t), T1) - T0) })));
      var g = s('g', { 'clip-path': 'url(#' + clipId + ')' });
      b.txs.forEach(function (tx) {
        var xs = tx.x, a = tx.start, e = tx.end;
        var pts = [[xs, a], [L, a + (L - xs)], [L, e + (L - xs)], [xs, e], [0, e + xs], [0, a + xs]];
        g.appendChild(s('polygon', { points: pts.map(function (q) { return xOf(q[0]) + ',' + ty(q[1]); }).join(' '),
          fill: COLORS[tx.st], 'fill-opacity': 0.28, stroke: tx.collided ? 'var(--red)' : COLORS[tx.st], 'stroke-width': tx.collided ? 2.5 : 1.5 }));
        g.appendChild(s('line', { x1: xOf(xs), y1: ty(a), x2: xOf(xs), y2: ty(e), stroke: COLORS[tx.st], 'stroke-width': 7 }));
        if (tx.jammed) g.appendChild(s('text', { x: xOf(xs) + 8, y: ty(e) - 2, 'font-size': 14, 'font-weight': 800, fill: 'var(--red)' }, 'jam'));
      });
      svg.appendChild(g);
      if (ty(t) <= T1) {
        svg.appendChild(s('line', { x1: X0 - 50, y1: ty(t), x2: X1 + 50, y2: ty(t), stroke: 'var(--accent)', 'stroke-dasharray': '6 5', 'stroke-width': 1.5 }));
        svg.appendChild(s('text', { x: W - 4, y: ty(t) - 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, fill: 'var(--accent)' }, 'now t=' + t));
      }
      // --- the latest event, in words ---
      var last = b.log[b.log.length - 1];
      event.textContent = last ? 't=' + last.t + ' · ' + last.text : 't=0 · nobody has a frame yet';
      event.style.color = !last ? 'var(--muted)' : last.cls === 'err' ? 'var(--red)' : last.cls === 'ok' ? 'var(--green)' : last.cls === 'warn' ? 'var(--amber)' : 'var(--ink)';
      drawn = { t: t, hot: hot.length > 0 };
    }
    body.appendChild(ui.controls());
    reset();
    // learnStep: events logged so far, so Step and Run (tick by tick) light the same learn rows
    var ctl = { step: step, reset: reset, runStep: tick, runMs: 220, learnStep: function () { return bus.log.length; },
      genText: function () { return mv.name + ' ' + hPos.value(); } };
    // C (7a): B already sends at t = 0, A gets its frame at t = 4. A collides with B only if B's signal has not
    // reached A by then, i.e. B is more than 4 ticks away.
    if (part === '1p') ctl.challenge = { goal: 'Move B so that A and B collide',
      why: function () { return 'B is ' + hPos.value() + ' ticks from A: its signal is still on the way when A senses at t = 4, so A sends.'; },
      holds: function () { return fullRun(run, positions(mv, hPos.value())).collisions.some(function (c) { return c[0] === 0 && c[1] === 1; }); },
      answer: function () { return { B: 5 }; } };
    return ctl;
  }

  CN.screens.t7 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'minframe' ? minFrame(body) : busSlide(body, RUNS[sc.part], sc.part);
  };
})();
