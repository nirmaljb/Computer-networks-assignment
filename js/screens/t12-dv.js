(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, D = CN.dv;

  // SPEC-v5: Tanenbaum's chain (Fig 5-10/5-11) as one table, distances to A. The router row on top is
  // the chain itself: click a router to take it down or bring it up. Step = one synchronous exchange.
  var NODES = ['A', 'B', 'C', 'D', 'E'], LINKS = [['A', 'B', 1], ['B', 'C', 1], ['C', 'D', 1], ['D', 'E', 1]];
  var DEST = 'A', INF = 16, OTHERS = ['B', 'C', 'D', 'E'];
  var RUNS = {
    good: { poison: false, say: 'A comes up. Every link costs 1. Each cell: that router\'s distance to A.' },
    bad: { poison: false, say: 'A goes down. Nobody can tell "A is gone" from "my neighbour has a path".' },
    poison: { poison: true, say: 'Poisoned reverse: a router tells the neighbour it routes through that its distance is ∞ (16).' }
  };

  function dvSlide(body, kind) {
    var run = RUNS[kind], net, hist, stable;
    body.appendChild(h('div', { class: 'say' }, run.say));
    var tableHost = h('div', { style: { marginTop: '16px' } }), banner = h('div', { style: { minHeight: '56px' } });
    body.appendChild(tableHost);
    body.appendChild(banner);

    function fmt(v) { return v >= INF ? (run.poison ? String(INF) : '∞') : String(v); }
    function snapshot() { return { cols: D.column(net, DEST, OTHERS), changed: {} }; }
    function reset() {
      net = D.reset(D.create(NODES, LINKS, { inf: INF, poison: run.poison }));
      if (kind === 'good') { D.setRouter(net, 'A', false); D.converge(net); D.setRouter(net, 'A', true); }
      else { D.converge(net); D.setRouter(net, 'A', false); }
      hist = [snapshot()]; stable = false;
      draw();
    }
    function toggle(n) {
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
      hist.slice(-9).forEach(function (row, i, shown) {
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
    body.appendChild(ui.controls(step, reset));
    reset();
    return { step: step, reset: reset };
  }

  CN.screens.t12 = function (root, sc) {
    return dvSlide(ui.screen(root, { num: sc.stop, title: sc.title }), sc.part);
  };
})();
