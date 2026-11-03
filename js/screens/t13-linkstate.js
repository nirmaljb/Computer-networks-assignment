(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, Gr = CN.graph;

  // SPEC-v5: 13a walks router B through the five link state steps (Step), the LSP drawn beside the map;
  // 13b is the DV vs LS table.
  var NODES = ['A', 'B', 'C', 'D', 'E', 'F'];
  var POS = { A: [90, 200], B: [280, 80], C: [280, 320], D: [520, 80], E: [520, 320], F: [720, 200] };
  var EDGES = [['A', 'B', 2], ['A', 'C', 5], ['B', 'C', 1], ['B', 'D', 4], ['C', 'E', 3], ['D', 'E', 1], ['D', 'F', 2], ['E', 'F', 6]];
  var STAGES = [
    'Each router knows only itself. Goal: every router gets the whole map.',
    '1 · Discover neighbours: send HELLO on each line.',
    '2 · Set link costs (e.g. the inverse of bandwidth).',
    '3 · Build a link state packet: sender, sequence, age, each neighbour with its cost.',
    '4 · Flood the LSP. Routers keep (source, seq) and drop duplicates (✕).',
    '5 · Run Dijkstra locally on the full map: B\'s sink tree.'
  ];

  function steps(body) {
    var st = { k: 0, sel: 'B', round: 0 };
    var stage = h('div', { style: { fontSize: '28px', fontWeight: 700, minHeight: '40px' } });
    var svg = s('svg', { width: 1400, height: 520, viewBox: '0 0 1100 410' });
    body.appendChild(stage);
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, svg));

    function floodRounds() { return Gr.flood(NODES, EDGES, st.sel, 99, true); }
    function step() {
      if (st.k === 4 && st.round < floodRounds().length) { st.round++; draw(); return true; }
      if (st.k === STAGES.length - 1) return false;
      st.k++; st.round = 0; draw(); return true;
    }
    function prev() {
      if (st.k === 4 && st.round > 0) st.round--;
      else if (st.k > 0) { st.k--; st.round = st.k === 4 ? floodRounds().length : 0; }
      else return false;
      draw(); return true;
    }
    function reset() { st.k = 0; st.round = 0; draw(); }
    function lspBox() {
      var nb = EDGES.filter(function (e) { return e[0] === st.sel || e[1] === st.sel; }).map(function (e) { return [e[0] === st.sel ? e[1] : e[0], e[2]]; });
      var rows = [['Seq', '23'], ['Age', '60']].concat(nb.map(function (x) { return [x[0], String(x[1])]; }));
      var x = 860, y = 40, w = 220, rh = 40;
      svg.appendChild(s('rect', { x: x, y: y, width: w, height: rh * (rows.length + 1), rx: 8, fill: 'var(--panel)', stroke: 'var(--accent)', 'stroke-width': 3 }));
      svg.appendChild(s('text', { x: x + w / 2, y: y + 28, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800, fill: 'var(--accent)' }, 'LSP from ' + st.sel));
      rows.forEach(function (r, i) {
        svg.appendChild(s('text', { x: x + 24, y: y + rh * (i + 1) + 28, 'font-size': 22, 'font-weight': 700 }, r[0]));
        svg.appendChild(s('text', { x: x + w - 24, y: y + rh * (i + 1) + 28, 'text-anchor': 'end', 'font-size': 22, 'font-weight': 700, class: 'mono' }, r[1]));
      });
    }
    function draw() {
      stage.textContent = STAGES[st.k];
      CN.clear(svg);
      var rounds = floodRounds(), cur = st.k === 4 && st.round > 0 ? rounds[st.round - 1] : null;
      var has = {};
      has[st.sel] = true;
      if (st.k === 4) rounds.slice(0, st.round).forEach(function (r) { r.fresh.forEach(function (n) { has[n] = true; }); });
      var tree = {};
      if (st.k === 5) {
        var r = Gr.dijkstra(NODES, EDGES, st.sel);
        NODES.forEach(function (n) { if (r.pred[n]) tree[n + r.pred[n]] = tree[r.pred[n] + n] = true; });
      }
      EDGES.forEach(function (e) {
        var a = POS[e[0]], b = POS[e[1]];
        var on = st.k === 5 && tree[e[0] + e[1]];
        svg.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: on ? 'var(--accent)' : 'var(--line)', 'stroke-width': on ? 7 : 4 }));
        if (st.k >= 2) {
          svg.appendChild(s('circle', { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, r: 16, fill: 'var(--panel)', stroke: 'var(--muted)' }));
          svg.appendChild(s('text', { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, String(e[2])));
        }
        if (st.k === 1) {
          [[a, b], [b, a]].forEach(function (p, j) {
            var mx = p[0][0] + (p[1][0] - p[0][0]) * 0.3, my = p[0][1] + (p[1][1] - p[0][1]) * 0.3;
            svg.appendChild(s('text', { x: mx, y: my + (j ? 20 : -8), 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: 'var(--blue)' }, 'HELLO'));
          });
        }
      });
      if (cur) cur.sent.forEach(function (x) {
        var a = POS[x.from], b = POS[x.to], mx = a[0] + (b[0] - a[0]) * 0.7, my = a[1] + (b[1] - a[1]) * 0.7;
        var dup = cur.fresh.indexOf(x.to) < 0 || cur.sent.filter(function (y) { return y.to === x.to; })[0] !== x;
        svg.appendChild(s('rect', { x: mx - 22, y: my - 14, width: 44, height: 28, rx: 5, fill: dup ? 'var(--red-bg)' : 'var(--blue-bg)', stroke: dup ? 'var(--red)' : 'var(--blue)', 'stroke-width': 2 }));
        svg.appendChild(s('text', { x: mx, y: my + 7, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: dup ? 'var(--red)' : 'var(--blue)' }, dup ? '✕' : 'LSP'));
      });
      NODES.forEach(function (n) {
        var p = POS[n], isSel = n === st.sel;
        var fill = st.k === 4 && has[n] ? 'var(--blue-bg)' : isSel && st.k >= 3 ? 'var(--accent)' : 'var(--panel)';
        var g = s('g', null,
          s('circle', { cx: p[0], cy: p[1], r: 30, fill: fill, stroke: 'var(--ink)', 'stroke-width': 3 }),
          s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: isSel && st.k >= 3 && st.k !== 4 ? '#fff' : 'var(--ink)' }, n));
        svg.appendChild(g);
      });

      if (st.k === 3 || st.k === 4) lspBox();
    }
    draw();
    body.appendChild(ui.controls());
    return { step: step, reset: reset, prev: prev };
  }

  function compare(body) {
    body.appendChild(h('table', { class: 't', style: { fontSize: '30px', marginTop: '30px' } },
      h('tr', null, h('th', null, ''), h('th', null, 'Distance vector'), h('th', null, 'Link state')),
      h('tr', null, h('th', null, 'Tells'), h('td', null, 'neighbours only: its whole distance table'), h('td', null, 'everyone (flood): only its own links')),
      h('tr', null, h('th', null, 'Computes'), h('td', null, 'Bellman-Ford, distributed'), h('td', null, 'Dijkstra on the full map, locally')),
      h('tr', null, h('th', null, 'Bad news'), h('td', null, 'counts to infinity'), h('td', null, 'one flood, converges fast')),
      h('tr', null, h('th', null, 'Cost'), h('td', null, 'simple, little memory (RIP)'), h('td', null, 'more memory and CPU (OSPF, IS-IS)'))));
    return {};
  }

  CN.screens.t13 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'compare' ? compare(body) : steps(body);
  };
})();
