(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // cwnd graph (Tanenbaum's Tahoe figure) + the traffic road. One model (CN.tcp.cwndTrace / road):
  // a loss happens in any round where cwnd > router capacity, on the graph and the road alike.
  CN.screens.t20 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var T = CN.tcp, ROUNDS = 24;
    var st = { ssthresh: 32, capacity: 39, variant: 'tahoe', loss: 'dupack', round: 0, rows: null, mode: 'sim', wide: false, graph: true };
    var road = null, feed = null, roadErr = null, playing = false, timer = null;

    // The road is the stage; the cwnd graph is an inset (G) and the controls are one bar under it.
    var GW = 470, GH = 250;
    var graph = s('svg', { width: GW, height: GH, viewBox: '0 0 ' + GW + ' ' + GH });
    var status = h('div', { class: 't20-status' });
    function numField(key, lo, hi) {
      var f = ui.field(String(st[key]), { width: 64, onInput: function (v) {
        var n = +v, ok = /^\d+$/.test(v.trim()) && n >= lo && n <= hi;
        f.classList.toggle('invalid', !ok);
        if (ok) { st[key] = n; rebuild(); }
      } });
      return f;
    }
    var fSs = numField('ssthresh', 2, 64), fCap = numField('capacity', 8, 64);
    var varSeg = ui.seg([['tahoe', 'Tahoe'], ['reno', 'Reno']], st.variant, function (v) { st.variant = v; rebuild(); });
    var lossSeg = ui.seg([['dupack', '3 dup ACKs'], ['timeout', 'Timeout']], st.loss, function (v) { st.loss = v; rebuild(); });
    var playBtn = ui.btn('Play', function () { togglePlay(); }, 'primary', 'Space');
    var graphBtn = ui.btn('Graph', toggleGraph, '', 'G');
    var inset = h('div', { class: 't20-inset panel' }, graph);
    var roadBox = h('div', { class: 't20-road' });
    var stage = h('div', { class: 't20-stage' }, roadBox, inset, status);
    var simCtl = h('div', { class: 'row nowrap', style: { gap: '8px' } }, varSeg, lossSeg,
      h('span', { class: 'label' }, 'ssthresh'), fSs, h('span', { class: 'label' }, 'capacity'), fCap);
    var bar = h('div', { class: 't20-bar row nowrap' }, simCtl,
      h('div', { class: 'row nowrap', style: { gap: '8px' } }, ui.btn('Step', step, '', 'S'), playBtn, ui.btn('Reset', reset, '', 'R')),
      h('div', { class: 'row nowrap', style: { gap: '8px', marginLeft: 'auto' } }, graphBtn, ui.btn('Live', toggleLive, '', 'L: live → recorded → simulation')),
      ui.cards([
        ['Collapse of 1986', function () {
          return h('div', { class: 'col' },
            h('div', null, 'October 1986: throughput between LBL and UC Berkeley (400 m, three hops) fell from 32 kbps to 40 bps. Senders retransmitted into full queues, so the links carried mostly duplicates.'),
            h('div', null, 'Jacobson (1988) added slow start, congestion avoidance (AIMD) and the RTO estimator of stop 19 to TCP. More buffers would not have helped: longer queues just mean later timeouts and more duplicates.'));
        }],
        ['AIMD is fair', function () { return aimdCard(); }],
        ['ECN', function () {
          return h('div', { class: 'col' },
            h('div', null, 'Stop 14\'s router can mark instead of drop: it sets the 2 ECN bits in the IP header (RED decides when).'),
            h('div', null, 'The receiver echoes it with ', h('b', null, 'ECE'), ' on its ACKs; the sender halves cwnd as if a packet were lost and sets ', h('b', null, 'CWR'), ' (the two flags of stop 16).'),
            h('div', { class: 'muted' }, 'Same signal, no lost packet, no retransmission.'));
        }]
      ], stage));
    body.appendChild(h('div', { class: 't20 col', style: { flex: 1, minHeight: 0, gap: '10px' } }, stage, bar));

    function aimdCard() {
      var W = 420, H = 300, p = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
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
      return h('div', { class: 'col' }, p,
        h('div', null, 'Additive increase moves both flows parallel to the fair line; halving moves them straight toward the origin, which shrinks the gap. They zig-zag onto the fair line (Chiu & Jain, 1989).'));
    }

    function rebuild() {
      st.rows = T.cwndTrace({ ssthresh: st.ssthresh, capacity: st.capacity, variant: st.variant, loss: st.loss, rounds: ROUNDS });
      st.round = Math.min(st.round, ROUNDS);
      if (road) { road.clear(); if (st.mode === 'sim') road.setCapacity(st.capacity); }
      draw();
    }
    function drawGraph() {
      CN.clear(graph);
      var rows = st.rows, maxC = 4;
      rows.forEach(function (r) { maxC = Math.max(maxC, r.cwnd, r.ssthresh); });
      maxC = Math.max(maxC, st.capacity) + 4;
      var x0 = 56, x1 = GW - 16, y0 = GH - 40, y1 = 16;
      function X(r) { return x0 + (x1 - x0) * (r - 0.5) / ROUNDS; }
      function Y(v) { return y0 - (y0 - y1) * v / maxC; }
      for (var v = 0; v <= maxC; v += 8) {
        graph.appendChild(s('line', { x1: x0, y1: Y(v), x2: x1, y2: Y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
        graph.appendChild(s('text', { x: x0 - 8, y: Y(v) + 6, 'text-anchor': 'end', 'font-size': 16, fill: 'var(--muted)' }, String(v)));
      }
      for (var r = 1; r <= ROUNDS; r += (r === 1 ? 1 : 2)) graph.appendChild(s('text', { x: X(r), y: y0 + 22, 'text-anchor': 'middle', 'font-size': 15, fill: 'var(--muted)' }, String(r)));
      graph.appendChild(s('text', { x: x1, y: GH - 2, 'text-anchor': 'end', 'font-size': 16, fill: 'var(--muted)' }, 'transmission round (RTT)'));
      graph.appendChild(s('text', { x: 6, y: 12, 'font-size': 16, fill: 'var(--muted)' }, 'cwnd (segments)'));
      graph.appendChild(s('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: 'var(--ink)', 'stroke-width': 2 }));
      graph.appendChild(s('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: 'var(--ink)', 'stroke-width': 2 }));
      // router capacity
      graph.appendChild(s('line', { x1: x0, y1: Y(st.capacity), x2: x1, y2: Y(st.capacity), stroke: 'var(--red)', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
      graph.appendChild(s('text', { x: x0 + 6, y: Y(st.capacity) - 6, 'font-size': 16, 'font-weight': 700, fill: 'var(--red)' }, 'router capacity ' + st.capacity));
      // ssthresh steps
      var dS = '';
      rows.forEach(function (row, i) { dS += (i ? ' L ' : 'M ') + (X(row.round) - (x1 - x0) / ROUNDS / 2) + ' ' + Y(row.ssthresh) + ' L ' + (X(row.round) + (x1 - x0) / ROUNDS / 2) + ' ' + Y(row.ssthresh); });
      graph.appendChild(s('path', { d: dS, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 2, 'stroke-dasharray': '3 4' }));
      graph.appendChild(s('text', { x: x1 - 4, y: Y(rows[rows.length - 1].ssthresh) - 6, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 700, fill: 'var(--amber)' }, 'ssthresh'));
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
        if (done && row.round === st.round) graph.appendChild(s('text', { x: X(row.round) + 10, y: Y(row.cwnd) + 20, 'font-size': 17, 'font-weight': 800, fill: 'var(--blue)' }, String(row.cwnd)));
      });
    }
    // one or two lines over the road: the round, and what the booth did with it
    function drawEvent() {
      CN.clear(status);
      if (st.mode !== 'sim') {
        status.appendChild(h('div', null, h('b', null, 'One vehicle per packet'), ' (at most 40 a second)'));
        status.appendChild(h('div', { class: 'muted' }, 'Real traffic: this shows protocols, not slow start.'));
        return;
      }
      if (!st.round) {
        status.appendChild(h('div', null, h('b', null, 'S'), ' sends round 1 (cwnd 1)'));
        status.appendChild(h('div', { class: 'muted' }, st.variant === 'reno' ? 'Reno: 3 dup ACKs → cwnd = new ssthresh' : 'Tahoe: any loss → cwnd = 1'));
        return;
      }
      var r = st.rows[st.round - 1], rd = T.road(r.cwnd, st.capacity);
      status.appendChild(h('div', null, h('b', null, 'Round ' + r.round + ' · cwnd ' + r.cwnd), ' · ' + r.phase));
      if (r.loss) status.appendChild(h('div', { class: 'bad', style: { fontWeight: 700 } }, r.cwnd + ' > capacity ' + st.capacity + ' → ' + rd.dropped + ' wrecked; ' + r.event));
      else status.appendChild(h('div', { class: 'ok' }, 'All ' + r.cwnd + ' fit: served ' + rd.served + (rd.queued ? ', queued ' + rd.queued : '')));
    }
    function draw() {
      varSeg.set(st.variant); lossSeg.set(st.loss);
      drawGraph(); drawEvent();
      playBtn.textContent = playing ? 'Pause' : 'Play';
    }
    function step() {
      if (st.round >= ROUNDS) { stopPlay(); return; }
      st.round++;
      if (road && st.mode === 'sim') road.round(st.rows[st.round - 1].cwnd, st.capacity);
      draw();
    }
    function togglePlay() { if (playing) stopPlay(); else { playing = true; step(); timer = setInterval(function () { if (st.round >= ROUNDS) stopPlay(); else step(); }, CN.road.PERIOD * 1000); draw(); } }
    function stopPlay() { playing = false; clearInterval(timer); draw(); }
    function reset() { stopPlay(); st.round = 0; if (road) road.clear(); draw(); }
    // G: graph inset on/off; W: road only (graph and control bar hidden; S, Space, R, L still work)
    function toggleGraph() { st.graph = !st.graph; stage.classList.toggle('no-graph', !st.graph); graphBtn.classList.toggle('on', st.graph); }
    function toggleWide() { st.wide = !st.wide; root.classList.toggle('t20-clean', st.wide); }
    function setMode(mode, info, why) {
      var changed = mode !== st.mode;
      st.mode = mode;
      stage.classList.toggle('mode-live', mode !== 'sim');
      simCtl.classList.toggle('dim', mode !== 'sim');
      draw();
      if (road) { road.setMode(mode, info); if (changed) road.clear(); }
      if (changed || why) CN.toast((why ? why + ' ' : '') + (mode === 'live' ? 'LIVE: this laptop' : mode === 'replay' ? 'RECORDED replay' : 'SIMULATION'));
    }
    function toggleLive() {
      if (!road) { CN.toast('The road needs WebGL'); return; }
      if (st.mode !== 'sim') { if (feed) feed.stop(); feed = null; setMode('sim'); return; }
      stopPlay();
      feed = CN.road.feed(function (p) { if (road) road.packet(p); }, function (mode, info, why) {
        if (mode === 'sim') { feed = null; setMode('sim', null, info); return; }
        if (mode === 'live' && st.mode === 'live') { road.setMode('live', info); return; }
        setMode(mode, info, why);
      });
    }

    rebuild();
    graphBtn.classList.add('on');
    CN.road.create(roadBox, { capacity: st.capacity }, function (r, err) {
      if (!roadBox.isConnected) { if (r) r.destroy(); return; }
      if (!r) {
        roadErr = err;
        // no WebGL: the graph takes the stage, at full size
        stage.classList.add('no-road');
        graph.setAttribute('width', 1100); graph.setAttribute('height', 570);
        stage.insertBefore(h('div', { class: 'banner warn small' }, '3D road needs WebGL (' + err + '): the graph alone shows the same model.'), stage.firstChild);
        return;
      }
      road = r;
      draw();
    });
    return {
      step: step, reset: reset,
      key: function (e) {
        if (e.key === ' ') { togglePlay(); return true; }
        if (e.key === 'w' || e.key === 'W') { toggleWide(); return true; }
        if (e.key === 'g' || e.key === 'G') { toggleGraph(); return true; }
        if (e.key === 'l' || e.key === 'L') { toggleLive(); return true; }
        return false;
      },
      destroy: function () { stopPlay(); if (feed) feed.stop(); if (road) road.destroy(); root.classList.remove('t20-clean'); }
    };
  };
})();
