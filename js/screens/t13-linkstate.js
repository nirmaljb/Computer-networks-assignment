(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, Gr = CN.graph;

  var NODES = ['A', 'B', 'C', 'D', 'E', 'F'];
  var POS = { A: [90, 200], B: [280, 80], C: [280, 320], D: [520, 80], E: [520, 320], F: [720, 200] };
  var EDGES = [['A', 'B', 2], ['A', 'C', 5], ['B', 'C', 1], ['B', 'D', 4], ['C', 'E', 3], ['D', 'E', 1], ['D', 'F', 2], ['E', 'F', 6]];
  var STEPS = ['The routers', '1 · Discover neighbours (HELLO)', '2 · Set link costs', '3 · Build a link state packet', '4 · Flood the LSPs', '5 · Run Dijkstra locally'];
  // v3: LS = S11a's flooding + S11b's Dijkstra
  var BACK = { 4: 'flooding (S11a)', 5: 'Dijkstra (S11b)' };

  CN.screens.t13 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, sub: 'routing with a map' });
    var st = { k: 0, sel: 'B', round: 0 };

    var stepper = h('div', { class: 'row', style: { gap: '6px' } });
    var svg = s('svg', { width: 740, height: 370, viewBox: '0 0 820 410' });
    var side = h('div', { class: 'col grow', style: { gap: '10px' } });
    body.appendChild(stepper);
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } }, h('div', { class: 'panel', style: { padding: '4px' } }, svg), side));
    body.appendChild(h('table', { class: 't', style: { fontSize: '19px' } },
      h('tr', null, h('th', null, ''), h('th', null, 'Distance vector'), h('th', null, 'Link state')),
      h('tr', null, h('th', null, 'Tells'), h('td', null, 'neighbours only: its whole distance table'), h('td', null, 'everyone (flood): only its own links')),
      h('tr', null, h('th', null, 'Computes'), h('td', null, 'Bellman-Ford, distributed'), h('td', null, 'Dijkstra on the full map, locally')),
      h('tr', null, h('th', null, 'Bad news'), h('td', null, 'counts to infinity'), h('td', null, 'one flood, converges fast')),
      h('tr', null, h('th', null, 'Cost'), h('td', null, 'simple, little memory (RIP)'), h('td', null, 'more memory (≈ k·n) and CPU (OSPF, IS-IS)'))));

    function floodRounds() { return Gr.flood(NODES, EDGES, st.sel, 99, true); }

    function step() {
      if (st.k === 4) {
        var n = floodRounds().length;
        if (st.round < n) { st.round++; draw(); return; }
      }
      st.k = (st.k + 1) % STEPS.length;
      st.round = 0;
      draw();
    }

    // reverse of step(): back through the flood hops, then to the previous stage (flood shown finished)
    function back() {
      if (st.k === 4 && st.round > 0) st.round--;
      else if (st.k > 0) { st.k--; st.round = st.k === 4 ? floodRounds().length : 0; }
      draw();
    }

    function draw() {
      CN.clear(stepper);
      var b0 = ui.backBtn(back);
      b0.disabled = st.k === 0;
      stepper.appendChild(b0);
      STEPS.forEach(function (t, i) {
        var b = ui.btn(BACK[i] ? h('span', null, t, h('span', { class: 'btn-tag' }, BACK[i])) : t, function () { st.k = i; st.round = 0; draw(); });
        b.classList.toggle('on', i === st.k);
        stepper.appendChild(b);
      });
      CN.clear(svg); CN.clear(side);
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
        var g = s('g', { class: 'clickable' },
          s('circle', { cx: p[0], cy: p[1], r: 30, fill: fill, stroke: 'var(--ink)', 'stroke-width': 3 }),
          s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: isSel && st.k >= 3 && st.k !== 4 ? '#fff' : 'var(--ink)' }, n));
        g.addEventListener('click', function () { st.sel = n; st.round = 0; draw(); });
        svg.appendChild(g);
      });

      var text = [
        ['Each router knows only itself. Goal: every router gets the whole map, then computes its own routes.'],
        ['Send HELLO on each line; the reply names the neighbour. A broadcast LAN is modelled as a node of its own.'],
        ['Cost per link: inverse of bandwidth (1 Gbps → 1, 100 Mbps → 10), or delay measured with ECHO packets.'],
        null, null, null
      ][st.k];
      if (text) side.appendChild(h('div', { class: 'panel', style: { fontSize: '25px' } }, text[0]));
      if (st.k === 3 || st.k === 4) {
        var nb = EDGES.filter(function (e) { return e[0] === st.sel || e[1] === st.sel; }).map(function (e) { return [e[0] === st.sel ? e[1] : e[0], e[2]]; });
        var card = h('table', { class: 't', style: { fontSize: '23px' } },
          h('tr', null, h('th', { colspan: 2 }, 'LSP from ' + st.sel)),
          h('tr', null, h('td', null, 'Sequence'), h('td', { class: 'mono' }, '23')),
          h('tr', null, h('td', null, 'Age'), h('td', { class: 'mono' }, '60')),
          nb.map(function (x) { return h('tr', null, h('td', { class: 'mono' }, x[0]), h('td', { class: 'mono' }, String(x[1]))); }));
        side.appendChild(h('div', { class: 'row', style: { alignItems: 'flex-start' } }, card,
          h('div', { class: 'small', style: { maxWidth: '330px' } }, 'Sender ID, sequence number, age, then each neighbour with its cost. Click another router to see its LSP.')));
      }
      if (st.k === 4) {
        side.appendChild(h('div', { class: 'panel', style: { fontSize: '22px' } },
          cur ? h('div', null, 'Hop ' + st.round + ': ' + cur.sent.length + ' copies, ', h('b', { class: 'bad' }, cur.dups + ' duplicate' + (cur.dups === 1 ? '' : 's') + ' dropped ✕'), '; ' + cur.reached + ' / 6 routers have it')
              : h('div', null, 'S floods ' + st.sel + '\'s LSP. Every router does this.'),
          h('div', { class: 'small muted' }, 'Keep (source, seq); drop old or duplicate LSPs. 32-bit sequence numbers; age (decremented each second and each hop) clears crashed or corrupted entries. Per-line send/ACK flags.')));
      }
      if (st.k === 5) {
        var r2 = Gr.dijkstra(NODES, EDGES, st.sel), tb = Gr.table(r2);
        side.appendChild(h('table', { class: 't', style: { fontSize: '23px' } },
          h('tr', null, h('th', { colspan: 3 }, 'Router ' + st.sel + ': Dijkstra on the full map')),
          h('tr', null, h('th', null, 'to'), h('th', null, 'cost'), h('th', null, 'next hop')),
          NODES.map(function (n) { return h('tr', null, h('td', { class: 'mono' }, n), h('td', { class: 'c mono' }, String(tb[n].cost)), h('td', { class: 'c mono' }, tb[n].next)); })));
        side.appendChild(h('div', { class: 'small muted' }, 'Click any router: same map, its own sink tree. OSPF and IS-IS.'));
      }
    }
    draw();
    return { step: step, reset: function () { st.k = 0; st.round = 0; st.sel = 'B'; draw(); } };
  };
})();
