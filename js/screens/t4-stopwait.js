(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: one protocol per sub-slide, then the utilisation arithmetic on its own slide.
  var PROTOS = {
    p1: { p: 1, desc: 'One-way, error-free channel, infinite buffers: no ACKs, the sender just pumps frames.' },
    p2: { p: 2, desc: 'Error-free channel, flow control only: send one frame, wait for a dummy ACK.' },
    p3: { p: 3, desc: 'Noisy channel: timer + retransmission; a 1-bit sequence number spots duplicates.' }
  };

  // P3's scripted run: frame 1 is lost once (timeout, resend), the first ACK for frame 2 is lost (duplicate, re-ACK).
  // ACKs are named by the next frame expected, so frame 0 → ACK 1.
  function p3Drop() {
    var ackLost = false;
    return function (m) {
      if (m.kind === 'data') return m.abs === 1 && m.copy === 1;
      if (m.abs === 2 && !ackLost) { ackLost = true; return true; }
      return false;
    };
  }

  function protocol(body, key) {
    var proto = PROTOS[key].p, sim, steps = 0, killed = false;
    body.appendChild(h('div', { class: 'say' }, PROTOS[key].desc));
    var ts = CN.ui.timeSpace({ width: 1100, height: 560, visible: 30, rightPad: 260, timers: function () { return proto === 3; },
      label: function (m) { return m.kind === 'data' ? (proto === 1 ? 'frame' : 'frame ' + m.seq) : CN.arq.ackName(m, sim); },
      onKill: function (id) { sim.kill(id); killed = true; ts.draw(sim); } });
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, ts.el));
    function reset() {
      sim = CN.arq.create({ proto: 'gbn', n: 1, W: 1, total: 6, delay: 3, timeout: proto === 3 ? 8 : 1e6, noAck: proto === 1,
        drop: proto === 3 ? p3Drop() : null });
      steps = 0; killed = false;
      ts.draw(sim);
    }
    function step() {
      if (sim.done) return false;
      CN.arq.stepToEvent(sim); steps++;
      ts.draw(sim); return true;
    }
    body.appendChild(ui.controls());
    reset();
    // learnStep: Steps since Reset (one learn row each); a message killed by hand leaves the script (null)
    return { step: step, reset: reset, runMs: 600, learnStep: function () { return killed ? null : steps; } };
  }

  // v17 4d: one figure on one time axis (2 px per ms). Top: the time-space picture of a single
  // frame over the satellite hop (sent 0–20 ms, arrives 250–270 ms, ACK back at 520 ms; ACK
  // transmit time ignored, as in Tanenbaum). Bottom: A's line cut into 26 frame-times of 20 ms,
  // one used. 1/26 = 20/520 ≈ 4%. Static; motion only fades the pieces in.
  function utilisation(body) {
    var W = 1280, H = 500, X0 = 230, PX = 2, YA = 100, YB = 290, YS = 384, SH = 50;
    function x(ms) { return X0 + ms * PX; }
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var defs = s('defs');
    ['amber', 'muted'].forEach(function (c) {
      defs.appendChild(s('marker', { id: 'ah4d-' + c, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
        s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--' + c + ')' })));
    });
    defs.appendChild(s('pattern', { id: 'idle4d', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('rect', { width: 10, height: 10, fill: 'var(--red-bg)' }),
      s('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'var(--red)', 'stroke-width': 2, opacity: 0.35 })));
    svg.appendChild(defs);
    function t(px, py, str, o) {
      o = o || {};
      return s('text', { x: px, y: py, 'font-size': o.fs || 18, 'font-weight': o.bold ? 800 : null, fill: o.fill || null,
        'text-anchor': o.anchor || 'middle', class: o.mono ? 'mono' : null }, str);
    }
    function piece(delay) { return s('g', { class: 'u4d-in', style: { animationDelay: delay + 's' } }); }

    // the two ground stations and the satellite between them
    function dish(cy, label, sub) {
      svg.appendChild(s('path', { d: 'M 22 ' + (cy - 18) + ' a 24 24 0 0 0 34 34 z', fill: 'var(--panel2)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
      svg.appendChild(s('line', { x1: 39, y1: cy - 1, x2: 52, y2: cy - 14, stroke: 'var(--ink)', 'stroke-width': 2.5 }));
      svg.appendChild(t(74, cy - 2, label, { fs: 22, bold: true, anchor: 'start' }));
      svg.appendChild(t(74, cy + 20, sub, { fs: 16, fill: 'var(--muted)', anchor: 'start' }));
    }
    dish(YA, 'A', 'sender');
    dish(YB, 'B', 'receiver');
    var sy = (YA + YB) / 2, sx = 110;
    [YA + 26, YB - 26].forEach(function (y2) {
      svg.appendChild(s('line', { x1: 46, y1: y2, x2: sx - 12, y2: sy + (y2 < sy ? -12 : 12), stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '4 5' }));
    });
    svg.appendChild(s('rect', { x: sx - 10, y: sy - 10, width: 20, height: 20, rx: 3, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
    [-1, 1].forEach(function (d) {
      svg.appendChild(s('rect', { x: d < 0 ? sx - 42 : sx + 14, y: sy - 7, width: 28, height: 14, fill: 'var(--blue-bg)', stroke: 'var(--blue)', 'stroke-width': 2 }));
    });
    svg.appendChild(t(sx + 48, sy + 5, 'satellite', { fs: 15, fill: 'var(--muted)', anchor: 'start' }));

    // time lines, time running left to right
    [YA, YB].forEach(function (y) {
      svg.appendChild(s('line', { x1: X0, y1: y, x2: x(540), y2: y, stroke: 'var(--line)', 'stroke-width': 3, 'marker-end': 'url(#ah4d-muted)' }));
    });
    svg.appendChild(t(x(540), YA - 14, 'time', { fs: 15, fill: 'var(--muted)', anchor: 'end' }));
    function tick(ms, y, up, label, c) {
      svg.appendChild(s('line', { x1: x(ms), y1: y - 8, x2: x(ms), y2: y + 8, stroke: 'var(--ink)', 'stroke-width': 2 }));
      svg.appendChild(t(x(ms), up ? y - 16 : y + 30, label, { fs: 17, bold: true, mono: true, fill: c || null }));
    }

    // the frame: 20 ms of bits leaving A, 250 ms later the same 20 ms arriving at B
    var g = piece(0);
    g.appendChild(s('polygon', { points: [[0, YA], [20, YA], [270, YB], [250, YB]].map(function (p) { return x(p[0]) + ',' + p[1]; }).join(' '),
      fill: 'var(--blue-bg)', stroke: 'var(--blue)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    g.appendChild(s('rect', { x: x(0), y: YA - 7, width: 20 * PX, height: 14, fill: 'var(--green)' }));
    g.appendChild(t(x(135) - 70, (YA + YB) / 2 + 6, 'frame 0', { fs: 20, bold: true, fill: 'var(--blue)', anchor: 'end' }));
    g.appendChild(t(x(135) - 70, (YA + YB) / 2 + 28, '1000 bits · 250 ms one way', { fs: 16, fill: 'var(--muted)', anchor: 'end' }));
    svg.appendChild(g);

    // the ACK: leaves B as the frame lands, reaches A a round trip after A finished
    g = piece(0.5);
    g.appendChild(s('line', { x1: x(270), y1: YB, x2: x(520) - 3, y2: YA + 6, stroke: 'var(--amber)', 'stroke-width': 3.5, 'marker-end': 'url(#ah4d-amber)' }));
    g.appendChild(t(x(395) + 34, (YA + YB) / 2 + 6, 'ACK', { fs: 20, bold: true, fill: 'var(--amber)', anchor: 'start' }));
    g.appendChild(t(x(395) + 34, (YA + YB) / 2 + 28, '250 ms back', { fs: 16, fill: 'var(--muted)', anchor: 'start' }));
    svg.appendChild(g);

    // A waits: the gap on its own time line
    g = piece(1);
    g.appendChild(s('rect', { x: x(20), y: YA - 7, width: 500 * PX, height: 14, fill: 'url(#idle4d)' }));
    g.appendChild(t(x(270), YA - 16, 'A waits 500 ms, sending nothing', { fs: 18, bold: true, fill: 'var(--red)' }));
    svg.appendChild(g);

    tick(0, YA, true, '0');
    tick(20, YA, true, '20');
    tick(520, YA, true, '520 ms');
    tick(250, YB, false, '250');
    tick(270, YB, false, '270');

    // A's line again, cut into 20 ms frame-times: 26 in one cycle, 1 used
    g = piece(1.4);
    g.appendChild(t(74, YS + 22, "A's line", { fs: 20, bold: true, anchor: 'start' }));
    g.appendChild(t(74, YS + 44, '20 ms slots', { fs: 16, fill: 'var(--muted)', anchor: 'start' }));
    for (var i = 0; i < 26; i++) {
      g.appendChild(s('rect', { x: x(i * 20) + 2, y: YS, width: 20 * PX - 4, height: SH, rx: 4,
        fill: i ? 'var(--panel)' : 'var(--green)', stroke: i ? 'var(--red)' : 'var(--green)', 'stroke-width': 2, 'stroke-dasharray': i ? '5 4' : null }));
    }
    g.appendChild(t(x(10), YS + SH / 2 + 7, '0', { fs: 20, bold: true, fill: 'var(--panel)', mono: true }));
    g.appendChild(t(x(10), YS + SH + 26, 'used', { fs: 17, bold: true, fill: 'var(--green)' }));
    g.appendChild(s('path', { d: 'M ' + (x(20) + 2) + ' ' + (YS + SH + 10) + ' v 8 H ' + (x(520) - 2) + ' v -8', fill: 'none', stroke: 'var(--red)', 'stroke-width': 2 }));
    g.appendChild(t(x(270), YS + SH + 42, '25 idle', { fs: 17, bold: true, fill: 'var(--red)' }));
    svg.appendChild(g);

    body.appendChild(h('div', { class: 'say' }, '50 kbps satellite link, 500 ms round trip, 1000-bit frames: one frame takes 20 ms to send.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '14px 10px 6px' } }, svg));
    body.appendChild(h('div', { class: 'mono u4d-sum' }, 'U = 20 / (20 + 500) = 1/26 ≈ ', h('b', { class: 'bad' }, '4%'), ' busy, 96% idle'));
    return {};
  }

  CN.screens.t4 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'util' ? utilisation(body) : protocol(body, sc.part);
  };
})();
