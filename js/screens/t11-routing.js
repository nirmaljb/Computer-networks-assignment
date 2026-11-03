(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, Gr = CN.graph;

  var NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  var POS = { A: [70, 220], B: [250, 80], C: [530, 80], D: [760, 220], E: [300, 220], F: [520, 220], G: [250, 380], H: [530, 380] };
  var EDGES = [['A', 'B', 2], ['A', 'G', 6], ['B', 'C', 7], ['B', 'E', 2], ['C', 'D', 3], ['C', 'F', 3],
    ['D', 'H', 2], ['E', 'F', 2], ['E', 'G', 1], ['F', 'H', 2], ['G', 'H', 4]];

  CN.ui.graphPos = POS;

  // part: 'flood' → S11a (design issues + flooding) · 'dijkstra' → S11b (optimality + Dijkstra) · none → both with tabs
  CN.screens.t11 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var part = sc.part || 'both';
    var st = { tab: part === 'flood' ? 1 : 0, k: 0, dst: 'D', edges: EDGES.map(function (e) { return e.slice(); }), hops: 3, dedupe: false, round: 0 };

    var left = h('div', { class: 'col', style: { width: '560px', gap: '10px' } });
    var right = h('div', { class: 'panel col grow', style: { gap: '6px' } });
    if (part === 'dijkstra') {
      body.appendChild(h('div', { class: 'panel', style: { fontSize: '24px' } },
        h('b', null, 'Optimality principle: '), 'if J is on the optimal path from I to K, the optimal J→K path follows the same route. So the optimal routes to a destination form a ',
        h('b', null, 'sink tree'), ' (no loops).'));
      body.appendChild(right);
    } else body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } }, left, right));

    left.appendChild(h('table', { class: 't', style: { fontSize: '20px' } },
      h('tr', null, h('th', null, ''), h('th', null, 'Datagram (IP)'), h('th', null, 'Virtual circuit (MPLS)')),
      [['Setup', 'none', 'required'], ['Addressing', 'full address', 'short VC number'], ['Router state', 'none', 'per connection'],
        ['Routing', 'per packet', 'fixed at setup'], ['Router fails', 'packets in flight lost', 'all VCs through it die'], ['QoS, congestion', 'hard', 'easy']].map(function (r) {
        return h('tr', null, h('th', null, r[0]), h('td', null, r[1]), h('td', null, r[2]));
      })));
    left.appendChild(h('div', { class: 'panel', style: { fontSize: '22px' } },
      h('div', null, h('b', null, 'Store-and-forward: '), 'hold the whole packet, verify its checksum, then forward.'),
      h('div', null, h('b', null, 'Forwarding'), ' = look up the line per packet; ', h('b', null, 'routing'), ' = fill the tables.'),
      part === 'both' ? h('div', null, h('b', null, 'Optimality principle: '), 'if J is on the optimal I→K path, the optimal J→K path follows the same route. So optimal routes to a destination form a ', h('b', null, 'sink tree'), '.') : null));
    left.appendChild(h('div', { class: 'small muted' }, 'Want: correctness, simplicity, robustness, stability, fairness, efficiency. Non-adaptive (static) or adaptive.'));

    var tabs = ui.tabs(['Dijkstra (shortest path)', 'Flooding'], 0, function (i) { st.tab = i; draw(); });
    var controls = h('div', { class: 'row' });
    var big = part === 'dijkstra';
    var svg = s('svg', { width: big ? 900 : 860, height: big ? 460 : 440, viewBox: '0 0 860 440' });
    var info = h('div', { style: { fontSize: '23px', minHeight: '62px' } });
    if (part === 'both') right.appendChild(tabs);
    right.appendChild(controls);
    if (big) {
      info.style.width = '520px';
      right.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '20px' } }, svg, info));
    } else { right.appendChild(svg); right.appendChild(info); }

    function run() { return Gr.dijkstra(NODES, st.edges, 'A'); }

    function drawEdges(hl, bold) {
      st.edges.forEach(function (e, i) {
        var a = POS[e[0]], b = POS[e[1]], on = hl && hl(e);
        var g = s('g', { class: 'clickable' },
          s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? on : 'var(--line)', 'stroke-width': on ? (bold && bold(e) ? 11 : 7) : 4 }),
          s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'transparent', 'stroke-width': 24 }),
          s('circle', { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, r: 17, fill: 'var(--panel)', stroke: 'var(--muted)', 'stroke-width': 1.5 }),
          s('text', { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, String(e[2])));
        if (st.tab === 0) g.addEventListener('click', function (ev) {
          e[2] = Math.max(1, Math.min(20, e[2] + (ev.shiftKey ? -1 : 1)));
          st.k = Math.min(st.k, run().steps.length - 1); draw();
        });
        svg.appendChild(g);
      });
    }

    function drawDijkstra() {
      CN.clear(controls);
      var r = run(), last = r.steps.length - 1;
      st.k = Math.min(st.k, last);
      var stp = r.steps[st.k], L = stp.labels;
      controls.appendChild(backBtn(st.k > 0));
      controls.appendChild(ui.btn('Step (S)', step, 'primary'));
      controls.appendChild(ui.btn('Finish', function () { st.k = last; draw(); }));
      controls.appendChild(ui.btn('Reset', function () { st.k = 0; draw(); }));
      controls.appendChild(h('span', { class: 'small muted' }, 'source A · click a node to choose the destination · click an edge: +1 (shift: −1)'));
      var done = st.k === last, path = done ? Gr.path(r, st.dst) : null;
      var onPath = {};
      if (path) for (var i = 1; i < path.length; i++) { onPath[path[i - 1] + path[i]] = onPath[path[i] + path[i - 1]] = true; }
      drawEdges(function (e) {
        if (onPath[e[0] + e[1]]) return 'var(--green)';
        // tree edges so far (permanent node and its pred)
        if ((L[e[0]].perm && L[e[0]].pred === e[1]) || (L[e[1]].perm && L[e[1]].pred === e[0])) return 'var(--accent)';
        if (stp.perm && ((e[0] === stp.perm && stp.relaxed.indexOf(e[1]) >= 0) || (e[1] === stp.perm && stp.relaxed.indexOf(e[0]) >= 0))) return 'var(--amber)';
        return null;
      }, done && big ? function (e) { return L[e[0]].pred === e[1] || L[e[1]].pred === e[0]; } : null);
      NODES.forEach(function (n) {
        var p = POS[n], lab = L[n], isNew = stp.perm === n;
        var g = s('g', { class: 'clickable' },
          s('circle', { cx: p[0], cy: p[1], r: 28, fill: lab.perm ? 'var(--accent)' : 'var(--panel)', stroke: isNew ? 'var(--amber)' : n === st.dst ? 'var(--green)' : 'var(--ink)', 'stroke-width': isNew || n === st.dst ? 6 : 3 }),
          s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: lab.perm ? '#fff' : 'var(--ink)' }, n),
          s('text', { x: p[0], y: p[1] + ('EFGH'.indexOf(n) >= 0 ? 56 : -38), 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, class: 'mono halo',
            fill: lab.perm ? 'var(--accent)' : 'var(--muted)' }, '(' + (lab.dist === Infinity ? '∞' : lab.dist) + ', ' + (lab.pred || '–') + ')'));
        g.addEventListener('click', function () { st.dst = n; draw(); });
        svg.appendChild(g);
      });
      CN.clear(info);
      info.appendChild(h('div', null, 'Permanent order: ', h('b', { class: 'mono' }, r.order.slice(0, st.k).join(', ') || '—'),
        stp.perm ? h('span', { class: 'muted' }, '   (just made ' + stp.perm + ' permanent' + (stp.relaxed.length ? ', relaxed ' + stp.relaxed.join(', ') : '') + ')') : h('span', { class: 'muted' }, '   A starts at (0, –); everything else ∞')));
      info.appendChild(done
        ? h('div', null, 'A → ' + st.dst + ' = ', h('b', null, String(r.dist[st.dst])), ' via ', h('b', { class: 'mono ok' }, path ? path.join('-') : 'unreachable'))
        : h('div', { class: 'small muted' }, 'Rule: make the smallest tentative label permanent, then relax its neighbours. Weights must be ≥ 0.'));
      if (done && big) info.appendChild(h('div', { class: 'small', style: { marginTop: '8px' } }, h('b', { style: { color: 'var(--accent)' } }, 'Bold = the sink tree: '),
        'every node\'s best route to A (links are symmetric). Green = the A → ' + st.dst + ' path.'));
    }

    function drawFlood() {
      CN.clear(controls);
      var hops = h('input', { class: 'field', type: 'number', min: 1, max: 6, value: st.hops, style: { width: '80px' } });
      hops.addEventListener('input', function () { st.hops = Math.max(1, Math.min(6, +hops.value || 1)); st.round = 0; draw(); });
      controls.appendChild(backBtn(st.round > 0));
      controls.appendChild(ui.btn('Step (S)', step, 'primary'));
      controls.appendChild(ui.btn('Reset', function () { st.round = 0; draw(); }));
      controls.appendChild(h('span', { class: 'label' }, 'Hop counter'));
      controls.appendChild(hops);
      controls.appendChild(ui.toggle('Sequence numbers', st.dedupe, function (v) { st.dedupe = v; st.round = 0; draw(); }));
      var rounds = Gr.flood(NODES, st.edges, 'A', st.hops, st.dedupe);
      st.round = Math.min(st.round, rounds.length);
      var cur = st.round > 0 ? rounds[st.round - 1] : null;
      var sent = {};
      if (cur) cur.sent.forEach(function (x) { sent[x.from + x.to] = (sent[x.from + x.to] || 0) + 1; });
      drawEdges(function (e) { return sent[e[0] + e[1]] || sent[e[1] + e[0]] ? 'var(--blue)' : null; });
      if (cur) cur.sent.forEach(function (x) {
        var a = POS[x.from], b = POS[x.to], mx = a[0] + (b[0] - a[0]) * 0.72, my = a[1] + (b[1] - a[1]) * 0.72;
        svg.appendChild(s('circle', { cx: mx, cy: my, r: 8, fill: 'var(--blue)' }));
      });
      var reached = {};
      reached.A = true;
      rounds.slice(0, st.round).forEach(function (r) { r.fresh.forEach(function (n) { reached[n] = true; }); });
      NODES.forEach(function (n) {
        var p = POS[n];
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 28, fill: reached[n] ? 'var(--blue-bg)' : 'var(--panel)', stroke: reached[n] ? 'var(--blue)' : 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800 }, n));
      });
      CN.clear(info);
      info.appendChild(cur
        ? h('div', null, 'Hop ' + st.round + ': ', h('b', null, cur.sent.length + ' copies'), ' sent (', h('b', { class: 'bad' }, cur.dups + ' duplicates'), '), total so far ', h('b', null, String(cur.total)), ', routers reached ' + cur.reached + ' / 8')
        : h('div', null, 'A floods a packet out of every line; each router repeats it on every line except the one it came in on.'));
      info.appendChild(h('div', { class: 'small muted' }, st.dedupe ? 'Per-source sequence numbers: each router forwards only the first copy.' : 'Damped only by the hop counter: duplicates grow exponentially. Robust, finds the shortest path, used for broadcast.'));
    }

    function backBtn(can) {
      var b = ui.backBtn(function () {
        if (st.tab === 0) st.k = Math.max(0, st.k - 1); else st.round = Math.max(0, st.round - 1);
        draw();
      });
      b.disabled = !can;
      return b;
    }
    function draw() { CN.clear(svg); if (st.tab === 0) drawDijkstra(); else drawFlood(); }
    function step() {
      if (st.tab === 0) { var last = run().steps.length - 1; st.k = st.k >= last ? 0 : st.k + 1; }
      else { var n = Gr.flood(NODES, st.edges, 'A', st.hops, st.dedupe).length; st.round = st.round >= n ? 0 : st.round + 1; }
      draw();
    }
    draw();
    return { step: step, reset: function () { st.k = 0; st.round = 0; st.edges = EDGES.map(function (e) { return e.slice(); }); draw(); } };
  };
  CN.ui.sampleGraph = { nodes: NODES, edges: EDGES, pos: POS };
})();
