(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, D = CN.dv;

  var PRESETS = {
    chain: {
      name: 'Chain A–E (Fig 5-10)', nodes: ['A', 'B', 'C', 'D', 'E'],
      links: [['A', 'B', 1], ['B', 'C', 1], ['C', 'D', 1], ['D', 'E', 1]],
      pos: { A: [60, 150], B: [195, 150], C: [330, 150], D: [465, 150], E: [600, 150] }
    },
    mesh: {
      name: '6-router mesh', nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
      links: [['A', 'B', 1], ['A', 'C', 4], ['B', 'C', 2], ['B', 'D', 5], ['C', 'E', 3], ['D', 'E', 1], ['D', 'F', 2], ['E', 'F', 6]],
      pos: { A: [70, 90], B: [250, 50], C: [200, 250], D: [440, 80], E: [420, 260], F: [600, 170] }
    }
  };

  CN.screens.t12 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true, sub: 'routing by rumour' });
    var st = { preset: 'chain', dest: 'A', inf: 16, poison: false, view: 0, net: null, hist: [], selLink: null, lastChanged: [], stable: false, scenario: '' };

    // tables and history before each exchange, so Back can undo it
    var undo = [];
    var backBtn = ui.backBtn(back);
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { step(); return !st.stable && st.net.round < 60; }, 650, function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    var infField = h('input', { class: 'field', type: 'number', min: 3, max: 64, value: st.inf, style: { width: '80px' } });
    infField.addEventListener('change', function () { st.inf = Math.max(3, Math.min(64, +infField.value || 16)); infField.value = st.inf; scenario(st.scenario || 'good'); });
    var poisonBtn = ui.toggle('Split horizon + poisoned reverse', st.poison, function (v) { st.poison = v; scenario(st.scenario || 'bad'); });
    var presetSeg = ui.seg([['chain', 'Chain A–E'], ['mesh', '6-router mesh']], st.preset, function (v) { st.preset = v; st.dest = 'A'; st.selLink = null; scenario('good'); });
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } }, presetSeg,
      ui.btn('Good news: A comes up', function () { scenario('good'); }),
      ui.btn('Bad news: A goes down', function () { scenario('bad'); }, 'danger'),
      backBtn, ui.btn('Exchange (S)', step), runBtn));
    var destRow = h('span', { class: 'row', style: { gap: '6px' } });
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'label' }, '∞ ='), infField, poisonBtn,
      h('span', { class: 'label' }, 'Destination'), destRow));

    var svg = s('svg', { width: 660, height: 320, viewBox: '0 0 660 320' });
    var linkCtl = h('div', { class: 'row', style: { minHeight: '46px' } });
    var banner = h('div', { style: { minHeight: '50px' } });
    var left = h('div', { class: 'col', style: { width: '680px', gap: '8px' } },
      h('div', { class: 'panel', style: { padding: '4px' } }, svg), linkCtl, banner,
      h('div', { class: 'small muted' }, 'Rules: synchronous exchanges using neighbours\' previous-round vectors; D(x,y) = min over neighbours v of c(x,v) + Dᵥ(y); capped at ∞; a downed router has no links. Click a router to take it down/up; click a link to edit it.'));
    var tabs = ui.tabs(['History (Tanenbaum\'s table)', 'Each router\'s full table'], 0, function (i) { st.view = i; drawRight(); });
    var rightBody = h('div', { style: { overflow: 'auto', maxHeight: '520px' } });
    var right = h('div', { class: 'panel col grow', style: { gap: '8px' } }, tabs, rightBody);
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } }, left, right));

    function P() { return PRESETS[st.preset]; }
    function others() { return P().nodes.filter(function (n) { return n !== st.dest; }); }
    function snapshot() { return { cols: D.column(st.net, st.dest, others()), changed: {} }; }

    function scenario(kind) {
      runner.stop();
      st.scenario = kind;
      st.net = D.reset(D.create(P().nodes, P().links, { inf: st.inf, poison: st.poison }));
      if (kind === 'good') { D.setRouter(st.net, 'A', false); D.converge(st.net); D.setRouter(st.net, 'A', true); }
      else { D.converge(st.net); D.setRouter(st.net, 'A', false); }
      st.hist = [snapshot()]; st.lastChanged = []; st.stable = false; undo = [];
      draw();
    }
    function event() { // after a manual topology change: keep tables, restart the history
      st.hist = [snapshot()]; st.lastChanged = []; st.stable = false; st.net.round = 0; undo = []; draw();
    }

    function step() {
      undo.push(structuredClone({ net: st.net, hist: st.hist, lastChanged: st.lastChanged, stable: st.stable }));
      var changed = D.exchange(st.net);
      st.lastChanged = changed;
      st.stable = changed.length === 0;
      var snap = snapshot(), prev = st.hist[st.hist.length - 1];
      snap.cols.forEach(function (v, i) { if (v !== prev.cols[i]) snap.changed[i] = true; });
      if (!st.stable) st.hist.push(snap);
      draw();
    }

    function back() {
      runner.stop();
      if (!undo.length) return;
      Object.assign(st, undo.pop());
      draw();
    }

    function fmtCell(v) { return v >= st.inf ? (st.poison ? String(st.inf) : '∞') : String(v); }

    function drawGraph() {
      CN.clear(svg);
      var pos = P().pos, net = st.net;
      net.links.forEach(function (l, i) {
        var a = pos[l.a], b = pos[l.b], up = l.up && net.routerUp[l.a] && net.routerUp[l.b], sel = st.selLink === i;
        var g = s('g', { class: 'clickable' },
          s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: up ? (sel ? 'var(--accent)' : 'var(--ink)') : 'var(--red)', 'stroke-width': sel ? 7 : 4, 'stroke-dasharray': up ? null : '8 7' }),
          s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'transparent', 'stroke-width': 26 }),
          s('circle', { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, r: 16, fill: 'var(--panel)', stroke: 'var(--muted)' }),
          s('text', { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, l.up ? String(l.cost) : '✕'));
        g.addEventListener('click', function () { st.selLink = st.selLink === i ? null : i; draw(); });
        svg.appendChild(g);
      });
      net.nodes.forEach(function (n) {
        var p = pos[n], up = net.routerUp[n], c = net.tables[n][st.dest];
        var g = s('g', { class: 'clickable' },
          s('circle', { cx: p[0], cy: p[1], r: 30, fill: !up ? 'var(--red-bg)' : n === st.dest ? 'var(--accent)' : 'var(--panel)', stroke: up ? 'var(--ink)' : 'var(--red)', 'stroke-width': 3 }),
          s('text', { x: p[0], y: p[1] + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: n === st.dest && up ? '#fff' : 'var(--ink)' }, up ? n : n + '✕'),
          n !== st.dest && up ? s('text', { x: p[0], y: p[1] + 58, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, class: 'mono halo', fill: 'var(--accent)' },
            fmtCell(c.cost) + (c.via && c.cost < st.inf ? ' via ' + c.via : '')) : null);
        g.addEventListener('click', function () { D.setRouter(net, n, !net.routerUp[n]); event(); });
        svg.appendChild(g);
      });
      svg.appendChild(s('text', { x: 6, y: 312, 'font-size': 19, fill: 'var(--muted)' }, 'Under each router: its distance to ' + st.dest + ' and the line it would use.'));
    }

    function drawLinkCtl() {
      CN.clear(linkCtl);
      if (st.selLink == null) { linkCtl.appendChild(h('span', { class: 'small muted' }, 'Exchange ' + st.net.round + (st.stable ? ' · stable' : ''))); return; }
      var l = st.net.links[st.selLink];
      linkCtl.appendChild(h('b', null, 'Link ' + l.a + '–' + l.b));
      linkCtl.appendChild(ui.btn(l.up ? 'Take link down' : 'Bring link up', function () { l.up = !l.up; event(); }, l.up ? 'danger' : ''));
      linkCtl.appendChild(ui.btn('cost −', function () { l.cost = Math.max(1, l.cost - 1); event(); }));
      linkCtl.appendChild(h('b', { class: 'mono' }, String(l.cost)));
      linkCtl.appendChild(ui.btn('cost +', function () { l.cost = Math.min(15, l.cost + 1); event(); }));
    }

    function drawBanner() {
      CN.clear(banner);
      if (D.counting(st.net, st.dest)) banner.appendChild(h('div', { class: 'banner err pulse' }, 'Counting to infinity… ' + st.dest + ' is unreachable, but the routers still quote finite distances'));
      else if (st.stable && st.hist.length > 1) banner.appendChild(h('div', { class: 'banner ok' }, 'Stable after ' + (st.hist.length - 1) + ' exchange' + (st.hist.length === 2 ? '' : 's')));
      else if (st.stable) banner.appendChild(h('div', { class: 'banner ok' }, 'Stable'));
    }

    function drawRight() {
      CN.clear(rightBody);
      var net = st.net;
      if (st.view === 0) {
        var cols = others();
        var t = h('table', { class: 't', style: { fontSize: '24px' } },
          h('tr', null, h('th', null, ''), cols.map(function (c) { return h('th', { class: 'c' }, c); })));
        st.hist.forEach(function (row, i) {
          t.appendChild(h('tr', null, h('th', null, i === 0 ? 'Initially' : 'After ' + i + ' exchange' + (i > 1 ? 's' : '')),
            row.cols.map(function (v, j) { return h('td', { class: 'c mono' + (row.changed[j] ? ' chg' : ''), style: { minWidth: '64px' } }, fmtCell(v)); })));
        });
        rightBody.appendChild(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Distance to ' + st.dest + ' as seen by each router; amber = changed this exchange.'));
        rightBody.appendChild(t);
        setTimeout(function () { rightBody.scrollTop = rightBody.scrollHeight; }, 0);
      } else {
        var chg = {};
        st.lastChanged.forEach(function (c) { chg[c[0] + c[1]] = true; });
        var grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' } });
        net.nodes.forEach(function (x) {
          var t = h('table', { class: 't', style: { fontSize: '20px', width: '100%' } },
            h('tr', null, h('th', { colspan: 3 }, 'Router ' + x + (net.routerUp[x] ? '' : ' (down)'))),
            h('tr', null, h('th', null, 'to'), h('th', null, 'cost'), h('th', null, 'via')));
          net.nodes.forEach(function (y) {
            var e = net.tables[x][y];
            t.appendChild(h('tr', null, h('td', { class: 'mono' }, y), h('td', { class: 'c mono' + (chg[x + y] ? ' chg' : '') }, net.routerUp[x] ? fmtCell(e.cost) : '–'),
              h('td', { class: 'c mono' + (chg[x + y] ? ' chg' : '') }, net.routerUp[x] && e.cost < st.inf ? e.via : '–')));
          });
          grid.appendChild(t);
        });
        rightBody.appendChild(grid);
      }
    }

    function drawDest() {
      CN.clear(destRow);
      P().nodes.forEach(function (n) {
        var b = ui.btn(n, function () { st.dest = n; st.hist = [snapshot()]; draw(); });
        b.classList.toggle('on', n === st.dest);
        destRow.appendChild(b);
      });
    }

    function draw() { backBtn.disabled = !undo.length; drawGraph(); drawLinkCtl(); drawBanner(); drawRight(); drawDest(); }
    scenario('good');
    return { step: step, reset: function () { scenario(st.scenario || 'good'); }, destroy: function () { runner.stop(); } };
  };
})();
