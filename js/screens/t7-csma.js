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
  var STATE_TEXT = { idle: 'idle', ready: 'has frame', sensing: 'listening (busy)', tx: 'TRANSMITTING', jam: 'JAM', backoff: 'backoff', defer: 'waiting', waitack: 'waiting for ACK', gaveup: 'gave up ✕' };

  function minFrame(body) {
    var r = X.minFrame(10e6, 51.2e-6);
    body.appendChild(h('div', { class: 'panel col', style: { gap: '18px', padding: '36px', marginTop: '40px', fontSize: '34px' } },
      h('div', { class: 'label', style: { fontSize: '26px' } }, 'Minimum frame = bandwidth × 2τ'),
      h('div', { class: 'mono' }, '10 Mbps × 51.2 µs = ' + r.bits + ' bits = ', h('b', null, r.bytes + ' bytes')),
      h('div', { class: 'muted', style: { fontSize: '26px' } }, '10 Mbps, 2500 m, 4 repeaters → round trip ≈ 50 µs → slot 51.2 µs = 512 bit times')));
    return {};
  }

  function busSlide(body, run) {
    var st = { bus: null };
    var BW = 1000, bx0 = 70, bx1 = 800;
    var busSvg = s('svg', { width: 1460, height: 248, viewBox: '0 0 ' + BW + ' 170' });
    body.appendChild(h('div', { class: 'say' }, run.say));
    body.appendChild(h('div', { class: 'panel', style: { padding: '10px', marginTop: '20px' } }, busSvg));

    function xOf(u) { return bx0 + (u / st.bus.tau) * (bx1 - bx0); }

    function reset() {
      st.bus = X.createBus({ mode: run.mode, p: 0.5, cd: run.cd, seed: 42, schedule: run.schedule.map(function (e) { return Object.assign({}, e); }) });
      draw();
    }
    // Step runs to the next logged event (a send, a collision, a backoff), not one tick.
    function step() {
      var b = st.bus, n = b.log.length, guard = 0;
      if (b.done) return false;
      while (!b.done && b.log.length === n && guard++ < 80) b.step();
      draw(); return true;
    }

    function draw() {
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
        var g = s('g', null,
          s('line', { x1: x, y1: 70, x2: x, y2: busY, stroke: 'var(--ink)', 'stroke-width': 3 }),
          s('rect', { x: x - 36, y: 6, width: 72, height: 50, rx: 8, fill: 'var(--panel)', stroke: COLORS[i], 'stroke-width': stn.state === 'tx' || stn.state === 'jam' ? 6 : 3 }),
          s('text', { x: x, y: 41, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 800, fill: COLORS[i] }, stn.name),
          s('text', { x: x + 44, y: 30, 'font-size': 19, 'font-weight': 700, fill: stn.state === 'tx' ? COLORS[i] : stn.state === 'jam' || stn.state === 'gaveup' ? 'var(--red)' : 'var(--muted)' },
            STATE_TEXT[stn.state] + (stn.state === 'backoff' || stn.state === 'defer' ? ' → t=' + stn.waitUntil : '')),
          s('text', { x: x + 44, y: 54, 'font-size': 18, fill: busyHere ? 'var(--red)' : 'var(--green)' }, busyHere ? 'hears: busy' : 'hears: idle'));
        busSvg.appendChild(g);
      });

    }
    body.appendChild(ui.controls(step, reset));
    reset();
    return { step: step, reset: reset };
  }

  CN.screens.t7 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'minframe' ? minFrame(body) : busSlide(body, RUNS[sc.part]);
  };
})();
