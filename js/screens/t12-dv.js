(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, D = CN.dv;

  // 12b–12c (SPEC-v5): Tanenbaum's chain (Fig 5-10/5-11) as one table, distances to A. The router row on top is
  // the chain itself: click a router to take it down or bring it up. Step = one synchronous exchange.
  // SPEC-v8 handle: the chain's length, 3–6 routers (A first, every link costs 1).
  var DEST = 'A', INF = 16;
  function chain(n) {
    var nodes = 'ABCDEF'.slice(0, n).split(''), links = [];
    for (var i = 1; i < n; i++) links.push([nodes[i - 1], nodes[i], 1]);
    return { nodes: nodes, links: links, others: nodes.slice(1) };
  }
  var RUNS = {
    bad: { poison: false, say: 'A goes down. Nobody can tell "A is gone" from "my neighbour has a path".' },
    poison: { poison: true, say: 'Poisoned reverse: a router tells the neighbour it routes through that its distance is ∞ (16).' }
  };

  function dvSlide(body, kind) {
    var run = RUNS[kind], net, hist, stable, touched, NODES, LINKS, OTHERS;
    var hN = ui.handle({ key: 'routers', label: 'Routers', kind: 'slider', value: 5, values: [3, 4, 5, 6], width: 220 });
    body.appendChild(h('div', { class: 'say' }, run.say));
    var tableHost = h('div', { style: { marginTop: '16px' } }), banner = h('div', { style: { minHeight: '56px' } });
    body.appendChild(tableHost);
    body.appendChild(banner);
    body.appendChild(ui.handleRow(hN));

    function fmt(v) { return v >= INF ? (run.poison ? String(INF) : '∞') : String(v); }
    function snapshot() { return { cols: D.column(net, DEST, OTHERS), changed: {} }; }
    function reset() {
      var c = chain(hN.value());
      NODES = c.nodes; LINKS = c.links; OTHERS = c.others;
      net = D.reset(D.create(NODES, LINKS, { inf: INF, poison: run.poison }));
      D.converge(net); D.setRouter(net, 'A', false);
      hist = [snapshot()]; stable = false; touched = false;
      draw();
    }
    function toggle(n) {
      touched = true;
      D.setRouter(net, n, !net.routerUp[n]);
      hist = [snapshot()]; stable = false; net.round = 0;
      draw();
    }
    function step() {
      if (stable) return false;
      stable = D.exchange(net).length === 0;
      var snap = snapshot(), prev = hist[hist.length - 1];
      snap.cols.forEach(function (v, i) { if (v !== prev.cols[i]) snap.changed[i] = true; });
      if (!stable) hist.push(snap);
      draw();
      return true;
    }
    function draw() {
      CN.clear(tableHost);
      var t = h('table', { class: 't dv-table' });
      t.appendChild(h('tr', null, h('th', null, ''), NODES.map(function (n) {
        var up = net.routerUp[n];
        var node = h('span', { class: 'dv-node click' + (up ? '' : ' down') + (n === DEST ? ' dest' : ''), title: 'Click to take ' + n + (up ? ' down' : ' up') }, up ? n : n + '✕');
        node.addEventListener('click', function () { toggle(n); });
        return h('th', { class: 'c' }, node);
      })));
      hist.slice(-8).forEach(function (row, i, shown) {
        var k = hist.length - shown.length + i;
        t.appendChild(h('tr', null, h('th', null, k === 0 ? 'Initially' : 'After ' + k + ' exchange' + (k > 1 ? 's' : '')),
          h('td', { class: 'c muted' }, '•'),
          row.cols.map(function (v, j) { return h('td', { class: 'c mono' + (row.changed[j] ? ' chg' : '') }, fmt(v)); })));
      });
      tableHost.appendChild(t);
      CN.clear(banner);
      if (D.counting(net, DEST)) banner.appendChild(h('div', { class: 'banner err' }, 'Counting to infinity: A is unreachable, but the routers still quote finite distances.'));
      else if (stable) banner.appendChild(h('div', { class: 'banner ok' }, 'Stable after ' + (hist.length - 1) + ' exchange' + (hist.length === 2 ? '' : 's') + '.'));
    }
    body.appendChild(ui.controls());
    reset();
    // ? (SPEC-v6): settled once every router reads ∞ = 16 for A
    // learnStep: exchanges that changed a table; a router toggled by hand leaves the script (null)
    return { step: step, reset: reset, reached: function () { return D.column(net, DEST, OTHERS).every(function (v) { return v >= INF; }); },
      learnStep: function () { return touched ? null : hist.length - 1; }, genText: function () { return 'routers ' + hN.value(); } };
  }

  // 12a: the other textbook's figures. Its five routers and link costs, a To / Cost / Next table beside each router.
  // Step 0 = initialization (each router knows only its neighbours), each Step = one synchronous exchange, until
  // nothing changes (the converged tables). Entries that changed light up; click one to see the update that made it
  // (heard v say y is d: c + d beats the old cost). Handle: tap a link to cut it (tap again to restore).
  var POS = { A: [330, 120], B: [980, 120], C: [560, 280], D: [330, 440], E: [980, 440] };
  var TBL = { A: [20, 40], B: [1110, 40], D: [20, 330], C: [440, 360], E: [1110, 330] };
  var LBL = { 'A-B': [655, 104], 'A-C': [462, 186], 'A-D': [308, 286], 'B-C': [776, 184], 'B-E': [1004, 286], 'C-E': [770, 388] };
  var COLW = [46, 62, 62], ROWH = 32, R = 32;
  function tables(body) {
    var W = 1300, H = 560, hCut = ui.handle({ key: 'cut', kind: 'tap', value: null });
    var st = { k: 0, run: null, sel: null }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Each router sends its table to its neighbours only. Tap a link to cut it.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    var banner = h('div', { style: { minHeight: '56px', marginTop: '10px' } });
    body.appendChild(banner);
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 22, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'middle' }, str);
    }
    function copy(tb) { return JSON.parse(JSON.stringify(tb)); }
    function cost(v) { return v >= INF ? '∞' : String(v); }
    function next(e, y, x) { return x === y || e.via === y ? '—' : e.cost >= INF ? '' : e.via; }
    // the whole run at once: run[0] = initialization, run[k] = after k exchanges, the last entry = the no-change Step
    function build() {
      var net = D.figure(hCut.value()), run = [{ tables: copy(net.tables), why: [] }];
      for (var i = 0; i < 20; i++) {
        var prev = net.tables, ch = D.exchange(net);
        run.push({ tables: copy(net.tables), why: ch.map(function (c) { return D.because(net, prev, c[0], c[1]); }) });
        if (!ch.length) break;
      }
      return run;
    }
    function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
    function draw() {
      CN.clear(svg);
      var cur = st.run[st.k], cut = hCut.value(), sel = st.sel, end = st.run.length - 1;
      var lit = {};
      cur.why.forEach(function (w) { lit[w.x + w.y] = w; });
      svg.appendChild(t(W / 2, 28, st.k === 0 ? 'Initially' : st.k < end ? 'After exchange ' + st.k : 'Exchange ' + st.k + ': no change',
        { fs: 20, bold: true, fill: 'var(--muted)' }));
      // links: a wide invisible line takes the tap; a cut link is red and dashed; the link the selected update came over is accent
      D.FIG.links.forEach(function (l) {
        var a = POS[l[0]], b = POS[l[1]], k = key(l[0], l[1]), isCut = cut === k;
        var over = sel && !isCut && key(sel.x, sel.v) === k;
        var g = s('g', { class: 'clickable' });
        g.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: isCut ? 'var(--red)' : over ? 'var(--accent)' : 'var(--ink)',
          'stroke-width': over ? 6 : 3, 'stroke-dasharray': isCut ? '10 8' : null }));
        g.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'transparent', 'stroke-width': 24 }));
        var p = LBL[k];
        g.appendChild(t(p[0], p[1], isCut ? '✕' : String(l[2]), { fs: 24, bold: true, fill: isCut ? 'var(--red)' : over ? 'var(--accent)' : null }));
        g.addEventListener('click', function () { hCut.set(isCut ? null : k); });
        svg.appendChild(g);
      });
      D.FIG.nodes.forEach(function (n) {
        var p = POS[n], on = sel && (sel.x === n || sel.v === n);
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: R, fill: on ? 'var(--accent)' : 'var(--amber-bg)', stroke: on ? 'var(--accent)' : 'var(--amber)', 'stroke-width': 3 }));
        svg.appendChild(t(p[0], p[1] + 9, n, { fs: 26, bold: true, fill: on ? '#fff' : 'var(--ink)' }));
      });
      // the five tables: To | Cost (grey) | Next (amber), as in the figures
      D.FIG.nodes.forEach(function (x) {
        var o = TBL[x], x0 = o[0], y0 = o[1], tw = COLW[0] + COLW[1] + COLW[2];
        ['To', 'Cost', 'Next'].forEach(function (hd, c) {
          var cx = x0 + COLW.slice(0, c).reduce(function (a, b) { return a + b; }, 0) + COLW[c] / 2;
          svg.appendChild(t(cx, y0 - 8, hd, { fs: 17, fill: 'var(--muted)' }));
        });
        D.FIG.nodes.forEach(function (y, r) {
          var e = cur.tables[x][y], ry = y0 + r * ROWH, w = lit[x + y], isSel = sel && sel.x === x && sel.y === y;
          var g = s('g', w ? { class: 'clickable' } : null), cx = x0;
          [y, cost(e.cost), next(e, y, x)].forEach(function (v, c) {
            var fill = c === 0 ? 'var(--panel)' : c === 1 ? 'var(--panel2)' : 'var(--amber-bg)';
            if (w && c > 0) fill = 'var(--accent-bg)';
            g.appendChild(s('rect', { x: cx, y: ry, width: COLW[c], height: ROWH, fill: fill, stroke: 'var(--line)', 'stroke-width': 1 }));
            g.appendChild(t(cx + COLW[c] / 2, ry + 23, v, { fs: 20, bold: !!w && c > 0, fill: w && c > 0 ? 'var(--accent)' : null }));
            cx += COLW[c];
          });
          if (isSel) g.appendChild(s('rect', { x: x0, y: ry, width: tw, height: ROWH, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 4 }));
          if (w) {
            if (fresh) g.setAttribute('class', 'clickable h3-pop');
            g.addEventListener('click', function () { st.sel = w; draw(); });
          }
          svg.appendChild(g);
        });
        svg.appendChild(s('rect', { x: x0, y: y0, width: tw, height: 5 * ROWH, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }));
        svg.appendChild(t(x0 + tw / 2, y0 + 5 * ROWH + 26, x + '’s table', { fs: 19, bold: true }));
      });
      CN.clear(banner);
      if (st.k === 0) banner.appendChild(h('div', { class: 'banner info' }, 'Each router knows only its neighbours: the link cost, Next —. Every other cost is ∞.'));
      else if (st.k < end) {
        var n = cur.why.length;
        banner.appendChild(h('div', { class: 'banner info' }, sel.x + ' hears ' + sel.v + ' say "' + sel.y + ' ' + cost(sel.d) + '": ' + sel.c + ' + ' + sel.d + ' = ' + sel.cost +
          ' < ' + cost(sel.was) + ', so ' + sel.y + ' ' + sel.cost + ' via ' + sel.v + '.' + (n > 1 ? ' (' + n + ' entries changed: click one)' : '')));
      } else {
        var none = D.FIG.nodes.some(function (x) { return D.FIG.nodes.some(function (y) { return cur.tables[x][y].cost >= INF; }); });
        banner.appendChild(h('div', { class: 'banner ok' }, 'Nothing changed: stable after ' + (end - 1) + ' exchange' + (end === 2 ? '' : 's') +
          (none ? '. ∞ = no path left.' : '. Every router has its least-cost path.')));
      }
      fresh = false;
    }
    function land() { var w = st.run[st.k].why; st.sel = w.length ? w[0] : null; draw(); }
    function step() { if (st.k >= st.run.length - 1) return false; st.k++; fresh = true; land(); return true; }
    function reset() { st.run = build(); st.k = 0; fresh = false; land(); }
    body.appendChild(ui.controls());
    reset();
    // learnStep: the Step (0 = initialization); the pane's table follows the cut link through genText
    return { step: step, reset: reset, reached: function () { return st.k >= st.run.length - 1; }, learnStep: function () { return st.k; },
      genText: function () { return 'cut ' + (hCut.value() || 'none'); },
      prev: function () { if (st.k > 0) { st.k--; land(); return true; } return false; } };
  }

  CN.screens.t12 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'tables' ? tables(body) : dvSlide(body, sc.part);
  };
})();
