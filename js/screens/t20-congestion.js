(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, T = CN.tcp;

  // SPEC-v5: one model (CN.tcp.cwndTrace), fixed ssthresh 32 and router capacity 39, loss signalled by
  // 3 duplicate ACKs. 20a Tahoe graph, 20b Reno graph, 20c the 3D road (simulation only, Reno), then
  // three static sub-slides: the 1986 collapse, AIMD fairness, ECN. Step = one transmission round.
  var ROUNDS = 24, SSTHRESH = 32, CAPACITY = 39;
  function trace(variant) { return T.cwndTrace({ ssthresh: SSTHRESH, capacity: CAPACITY, variant: variant, loss: 'dupack', rounds: ROUNDS }); }
  function roundText(rows, n) {
    if (!n) return 'Round 0: cwnd starts at 1 segment.';
    var r = rows[n - 1];
    return 'Round ' + r.round + ' · cwnd ' + r.cwnd + ' · ' + r.phase + (r.loss ? ' · ' + r.event : '');
  }

  function graphSlide(body, variant) {
    var st = { rows: trace(variant), round: 0, capacity: CAPACITY };
    var GW = 1300, GH = 540, graph = s('svg', { width: GW, height: GH, viewBox: '0 0 ' + GW + ' ' + GH });
    var line = h('div', { style: { fontSize: '28px', fontWeight: 700, minHeight: '40px' } });
    body.appendChild(h('div', { class: 'say' }, variant === 'reno'
      ? 'Reno: on 3 duplicate ACKs, ssthresh = cwnd/2 and cwnd = ssthresh (fast recovery).'
      : 'Tahoe: on any loss, ssthresh = cwnd/2 and cwnd = 1 (slow start again).'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, graph));
    body.appendChild(line);
    function draw() {
      line.textContent = roundText(st.rows, st.round);
      CN.clear(graph);
      var rows = st.rows, maxC = 4;
      rows.forEach(function (r) { maxC = Math.max(maxC, r.cwnd, r.ssthresh); });
      maxC = Math.max(maxC, st.capacity) + 4;
      var x0 = 70, x1 = GW - 16, y0 = GH - 50, y1 = 16;
      function X(r) { return x0 + (x1 - x0) * (r - 0.5) / ROUNDS; }
      function Y(v) { return y0 - (y0 - y1) * v / maxC; }
      for (var v = 0; v <= maxC; v += 8) {
        graph.appendChild(s('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
        graph.appendChild(s('text', { x: x0 - 8, y: Y(v) + 6, 'text-anchor': 'end', 'font-size': 22, fill: 'var(--muted)' }, String(v)));
      }
      for (var r = 1; r <= ROUNDS; r += (r === 1 ? 1 : 2)) graph.appendChild(s('text', { x: X(r), y: y0 + 22, 'text-anchor': 'middle', 'font-size': 20, fill: 'var(--muted)' }, String(r)));
      graph.appendChild(s('text', { x: x1, y: GH - 2, 'text-anchor': 'end', 'font-size': 22, fill: 'var(--muted)' }, 'transmission round (RTT)'));
      graph.appendChild(s('text', { x: 6, y: 12, 'font-size': 22, fill: 'var(--muted)' }, 'cwnd (segments)'));
      graph.appendChild(s('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: 'var(--ink)', 'stroke-width': 2 }));
      graph.appendChild(s('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: 'var(--ink)', 'stroke-width': 2 }));
      // router capacity
      graph.appendChild(s('line', { x1: x0, y1: Y(st.capacity), x2: x1, y2: Y(st.capacity), stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
      graph.appendChild(s('text', { x: x0 + 6, y: Y(st.capacity) - 6, 'font-size': 22, 'font-weight': 700, fill: 'var(--red)' }, 'router capacity ' + st.capacity));
      // ssthresh steps
      var dS = '';
      rows.forEach(function (row, i) { dS += (i ? ' L ' : 'M ') + (X(row.round) - (x1 - x0) / ROUNDS / 2) + ' ' + Y(row.ssthresh) + ' L ' + (X(row.round) + (x1 - x0) / ROUNDS / 2) + ' ' + Y(row.ssthresh); });
      graph.appendChild(s('path', { d: dS, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 2, 'stroke-dasharray': '3 4' }));
      graph.appendChild(s('text', { x: x1 - 4, y: Y(rows[rows.length - 1].ssthresh) - 6, 'text-anchor': 'end', 'font-size': 22, 'font-weight': 700, fill: 'var(--amber)' }, 'ssthresh'));
      // full trace faint, the rounds played so far solid
      var dAll = '', dNow = '';
      rows.forEach(function (row, i) {
        var seg = (i ? ' L ' : 'M ') + X(row.round) + ' ' + Y(row.cwnd);
        dAll += seg;
        if (row.round <= st.round) dNow += seg;
      });
      graph.appendChild(s('path', { d: dAll, fill: 'none', stroke: 'var(--blue)', 'stroke-width': 2, opacity: 0.22 }));
      if (dNow) graph.appendChild(s('path', { d: dNow, fill: 'none', stroke: 'var(--blue)', 'stroke-width': 3.5 }));
      rows.forEach(function (row) {
        var done = row.round <= st.round;
        graph.appendChild(s('circle', { cx: X(row.round), cy: Y(row.cwnd), r: row.round === st.round ? 7 : 4, fill: row.loss ? 'var(--red)' : 'var(--blue)', opacity: done ? 1 : 0.25 }));
        if (row.loss) graph.appendChild(s('text', { x: X(row.round), y: Y(row.cwnd) - 12, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 900, fill: 'var(--red)', opacity: done ? 1 : 0.35 }, '✕'));
        if (done && row.round === st.round) graph.appendChild(s('text', { x: X(row.round) + 10, y: Y(row.cwnd) + 20, 'font-size': 24, 'font-weight': 800, fill: 'var(--blue)' }, String(row.cwnd)));
      });
    }
    draw();
    function step() { if (st.round >= ROUNDS) return false; st.round++; draw(); return true; }
    function reset() { st.round = 0; draw(); }
    body.appendChild(ui.controls());
    // ? (SPEC-v6): settled on the round after the first loss, where the new cwnd shows
    var lossRound = st.rows.filter(function (r) { return r.loss; })[0].round;
    return { step: step, reset: reset, reached: function () { return st.round > lossRound; },
      prev: function () { if (st.round > 0) { st.round--; draw(); return true; } return false; } };
  }

  function roadSlide(body, root) {
    var rows = trace('reno'), round = 0, road = null;
    var status = h('div', { class: 't20-status' });
    var roadBox = h('div', { class: 't20-road' });
    var stage = h('div', { class: 't20-stage' }, roadBox, status);
    body.appendChild(stage);
    function draw() {
      CN.clear(status);
      if (!round) { status.appendChild(h('div', null, 'One vehicle per segment. Router capacity ' + CAPACITY + ' per round.')); return; }
      var r = rows[round - 1], rd = T.road(r.cwnd, CAPACITY);
      status.appendChild(h('div', null, h('b', null, 'Round ' + r.round + ' · cwnd ' + r.cwnd)));
      if (r.loss) status.appendChild(h('div', { class: 'bad', style: { fontWeight: 700 } }, r.cwnd + ' > ' + CAPACITY + ' → ' + rd.dropped + ' dropped'));
      else status.appendChild(h('div', { class: 'ok' }, 'All ' + r.cwnd + ' fit'));
    }
    function step() {
      if (round >= ROUNDS) return false;
      round++;
      if (road) road.round(rows[round - 1].cwnd, CAPACITY);
      draw(); return true;
    }
    function reset() { round = 0; if (road) road.clear(); draw(); }
    body.appendChild(ui.controls());
    draw();
    CN.road.create(roadBox, { capacity: CAPACITY }, function (r, err) {
      if (!roadBox.isConnected) { if (r) r.destroy(); return; }
      if (!r) { stage.insertBefore(h('div', { class: 'banner warn' }, 'The 3D road needs WebGL (' + err + ').'), stage.firstChild); return; }
      road = r;
    });
    return { step: step, reset: reset, runMs: CN.road.PERIOD * 1000,
      prev: function () { if (!round) return false; round--; if (road) road.clear(); draw(); return true; },
      destroy: function () { if (road) road.destroy(); } };
  }

    function aimd(body) {
    var W = 420, H = 300, p = s('svg', { width: 700, height: 500, viewBox: '0 0 ' + W + ' ' + H });
    var o = 40, L = 240;
    function X(v) { return o + v * L; } function Y(v) { return H - o - v * L; }
    p.appendChild(s('line', { x1: X(0), y1: Y(0), x2: X(1.05), y2: Y(0), stroke: 'var(--ink)', 'stroke-width': 2 }));
    p.appendChild(s('line', { x1: X(0), y1: Y(0), x2: X(0), y2: Y(1.05), stroke: 'var(--ink)', 'stroke-width': 2 }));
    p.appendChild(s('line', { x1: X(0), y1: Y(1), x2: X(1), y2: Y(0), stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
    p.appendChild(s('line', { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: 'var(--green)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
    p.appendChild(s('text', { x: X(1) - 4, y: Y(1) - 6, 'text-anchor': 'end', 'font-size': 16, fill: 'var(--green)', 'font-weight': 700 }, 'fair'));
    p.appendChild(s('text', { x: X(0.62), y: Y(0.44), 'font-size': 16, fill: 'var(--muted)', 'font-weight': 700 }, 'full'));
    // zig-zag: +a to both, then halve both
    var x = 0.1, y = 0.6, d = 'M ' + X(x) + ' ' + Y(y);
    for (var i = 0; i < 5; i++) {
      var a = (1 - x - y) / 2; x += a; y += a; d += ' L ' + X(x) + ' ' + Y(y);   // additive increase until the link is full
      x /= 2; y /= 2; d += ' L ' + X(x) + ' ' + Y(y);                     // multiplicative decrease
    }
    p.appendChild(s('path', { d: d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }));
    p.appendChild(s('text', { x: X(1.05), y: Y(0) + 24, 'text-anchor': 'end', 'font-size': 16 }, 'flow 1 rate'));
    p.appendChild(s('text', { x: X(0) - 6, y: Y(1.05) - 6, 'font-size': 16 }, 'flow 2 rate'));
    body.appendChild(h('div', { class: 'say' }, 'Additive increase moves both flows parallel to the fair line; halving moves them toward the origin, shrinking the gap (Chiu & Jain, 1989).'));
    body.appendChild(h('div', { class: 'panel', style: { alignSelf: 'center' } }, p));
    return {};
  }


  function card(body, items) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '30px', padding: '32px', marginTop: '30px' } }, items));
    return {};
  }

  var PARTS = {
    tahoe: function (body) { return graphSlide(body, 'tahoe'); },
    reno: function (body) { return graphSlide(body, 'reno'); },
    road: roadSlide,
    aimd: aimd,
    collapse: function (body) {
      return card(body, [
        h('div', null, 'October 1986: throughput between LBL and UC Berkeley (400 m, three hops) fell from 32 kbps to 40 bps. Senders retransmitted into full queues, so the links carried mostly duplicates.'),
        h('div', null, 'Jacobson (1988) added slow start, congestion avoidance (AIMD) and the RTO estimator of stop 19 to TCP.')]);
    },
    ecn: function (body) {
      return card(body, [
        h('div', null, 'Stop 14\'s router can mark instead of drop: it sets the 2 ECN bits in the IP header.'),
        h('div', null, 'The receiver echoes it with ', h('b', null, 'ECE'), ' on its ACKs; the sender halves cwnd as if a packet were lost and sets ', h('b', null, 'CWR'), '.'),
        h('div', { class: 'muted' }, 'Same signal, no lost packet, no retransmission.')]);
    }
  };

  CN.screens.t20 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }), root);
  };
})();
