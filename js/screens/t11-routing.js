(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, Gr = CN.graph;

  var NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  var POS = { A: [70, 220], B: [250, 80], C: [530, 80], D: [760, 220], E: [300, 220], F: [520, 220], G: [250, 380], H: [530, 380] };
  var EDGES = [['A', 'B', 2], ['A', 'G', 6], ['B', 'C', 7], ['B', 'E', 2], ['C', 'D', 3], ['C', 'F', 3],
    ['D', 'H', 2], ['E', 'F', 2], ['E', 'G', 1], ['F', 'H', 2], ['G', 'H', 4]];

  CN.ui.graphPos = POS;

  // SPEC-v5: 11a = datagram vs virtual circuit (static), 11b = flooding with a hop counter of 3,
  // 11c = the optimality principle (static), 11d = Dijkstra from A to D. No edge or node clicks.
  var DST = 'D', HOPS = 3;

  function drawEdges(svg, hl, bold) {
    EDGES.forEach(function (e) {
      var a = POS[e[0]], b = POS[e[1]], on = hl && hl(e);
      var g = s('g', null,
        s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? on : 'var(--line)', 'stroke-width': on ? (bold && bold(e) ? 11 : 7) : 4 }),
        s('circle', { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, r: 17, fill: 'var(--panel)', stroke: 'var(--muted)', 'stroke-width': 1.5 }),
        s('text', { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, String(e[2])));
      svg.appendChild(g);
    });
  }


  function circuits(body) {
    body.appendChild(h('table', { class: 't', style: { fontSize: '30px', marginTop: '20px' } },
      h('tr', null, h('th', null, ''), h('th', null, 'Datagram (IP)'), h('th', null, 'Virtual circuit (MPLS)')),
      [['Setup', 'none', 'required'], ['Addressing', 'full address', 'short VC number'], ['Router state', 'none', 'per connection'],
        ['Routing', 'per packet', 'fixed at setup'], ['Router fails', 'packets in flight lost', 'all VCs through it die'], ['QoS, congestion', 'hard', 'easy']].map(function (r) {
        return h('tr', null, h('th', null, r[0]), h('td', null, r[1]), h('td', null, r[2]));
      })));
    body.appendChild(h('div', { class: 'say' }, 'Forwarding = look up the line per packet; routing = fill the tables.'));
    return {};
  }

  function flooding(body) {
    var round = 0, rounds = Gr.flood(NODES, EDGES, 'A', HOPS, false);
    var svg = s('svg', { width: 1160, height: 594, viewBox: '0 0 860 440' }), info = h('div', { style: { fontSize: '26px', minHeight: '40px' } });
    body.appendChild(h('div', { class: 'say' }, 'Each router repeats the packet on every line except the one it came in on. Hop counter = ' + HOPS + '.'));
    body.appendChild(h('div', { class: 'panel', style: { alignSelf: 'flex-start' } }, svg));
    body.appendChild(info);
    function draw() {
      CN.clear(svg);
      var cur = round > 0 ? rounds[round - 1] : null, sent = {}, reached = { A: true };
      if (cur) cur.sent.forEach(function (x) { sent[x.from + x.to] = true; });
      drawEdges(svg, function (e) { return sent[e[0] + e[1]] || sent[e[1] + e[0]] ? 'var(--blue)' : null; });
      if (cur) cur.sent.forEach(function (x) {
        var a = POS[x.from], b = POS[x.to];
        svg.appendChild(s('circle', { cx: a[0] + (b[0] - a[0]) * 0.72, cy: a[1] + (b[1] - a[1]) * 0.72, r: 8, fill: 'var(--blue)' }));
      });
      rounds.slice(0, round).forEach(function (r) { r.fresh.forEach(function (n) { reached[n] = true; }); });
      NODES.forEach(function (n) {
        var p = POS[n];
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 28, fill: reached[n] ? 'var(--blue-bg)' : 'var(--panel)', stroke: reached[n] ? 'var(--blue)' : 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800 }, n));
      });
      CN.clear(info);
      if (cur) info.appendChild(h('div', null, 'Hop ' + round + ': ', h('b', null, cur.sent.length + ' copies'), ' (', h('b', { class: 'bad' }, cur.dups + ' duplicates'), '), total ', h('b', null, String(cur.total))));
    }
    draw();
    function step() { if (round >= rounds.length) return false; round++; draw(); return true; }
    function reset() { round = 0; draw(); }
    body.appendChild(ui.controls(step, reset));
    return { step: step, reset: reset, prev: function () { if (round > 0) { round--; draw(); return true; } return false; } };
  }

  function dijkstra(body) {
    var k = 0, r = Gr.dijkstra(NODES, EDGES, 'A'), last = r.steps.length - 1;
    var svg = s('svg', { width: 1160, height: 594, viewBox: '0 0 860 440' }), info = h('div', { style: { fontSize: '26px', minHeight: '40px' } });
    body.appendChild(h('div', { class: 'say' }, 'Make the smallest tentative label (distance, predecessor) permanent, then relax its neighbours.'));
    body.appendChild(h('div', { class: 'panel', style: { alignSelf: 'flex-start' } }, svg));
    body.appendChild(info);
    function draw() {
      CN.clear(svg);
      var stp = r.steps[k], L = stp.labels, done = k === last, path = done ? Gr.path(r, DST) : null, onPath = {};
      if (path) for (var i = 1; i < path.length; i++) { onPath[path[i - 1] + path[i]] = onPath[path[i] + path[i - 1]] = true; }
      drawEdges(svg, function (e) {
        if (onPath[e[0] + e[1]]) return 'var(--green)';
        if ((L[e[0]].perm && L[e[0]].pred === e[1]) || (L[e[1]].perm && L[e[1]].pred === e[0])) return 'var(--accent)';
        if (stp.perm && ((e[0] === stp.perm && stp.relaxed.indexOf(e[1]) >= 0) || (e[1] === stp.perm && stp.relaxed.indexOf(e[0]) >= 0))) return 'var(--amber)';
        return null;
      });
      NODES.forEach(function (n) {
        var p = POS[n], lab = L[n], isNew = stp.perm === n;
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 28, fill: lab.perm ? 'var(--accent)' : 'var(--panel)', stroke: isNew ? 'var(--amber)' : n === DST ? 'var(--green)' : 'var(--ink)', 'stroke-width': isNew || n === DST ? 6 : 3 }));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: lab.perm ? '#fff' : 'var(--ink)' }, n));
        svg.appendChild(s('text', { x: p[0], y: p[1] + ('EFGH'.indexOf(n) >= 0 ? 56 : -38), 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, class: 'mono halo',
          fill: lab.perm ? 'var(--accent)' : 'var(--muted)' }, '(' + (lab.dist === Infinity ? '∞' : lab.dist) + ', ' + (lab.pred || '–') + ')'));
      });
      CN.clear(info);
      if (done) info.appendChild(h('div', null, 'A → ' + DST + ' = ', h('b', null, String(r.dist[DST])), ' via ', h('b', { class: 'mono ok' }, path.join('-'))));
      else info.appendChild(h('div', null, 'Permanent: ', h('b', { class: 'mono' }, r.order.slice(0, k).join(', ') || 'A starts at (0, –)')));
    }
    draw();
    function step() { if (k >= last) return false; k++; draw(); return true; }
    function reset() { k = 0; draw(); }
    body.appendChild(ui.controls(step, reset));
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; } };
  }

  function optimality(body) {
    body.appendChild(h('div', { class: 'panel', style: { fontSize: '34px', padding: '36px', marginTop: '40px', lineHeight: 1.4 } },
      'If router J is on the optimal path from I to K, then the optimal path from J to K follows the same route.'));
    body.appendChild(h('div', { class: 'say' }, 'So the optimal routes from all sources to one destination form a tree with no loops: the sink tree.'));
    return {};
  }

  var PARTS = { vc: circuits, flood: flooding, optimality: optimality, dijkstra: dijkstra };

  CN.screens.t11 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
  CN.ui.sampleGraph = { nodes: NODES, edges: EDGES, pos: POS };
})();
