(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  var HOSTS = { A: 1, B: 1, C: 2, D: 2, E: 3, F: 3 };
  var SCRIPT = [['A', 'D'], ['D', 'A'], ['A', 'B']];
  // geometry
  var BR = { x: 470, y: 190 };
  var PORTS = { 1: { x: 170, y: 90, hosts: ['A', 'B'] }, 2: { x: 770, y: 90, hosts: ['C', 'D'] }, 3: { x: 470, y: 300, hosts: ['E', 'F'] } };

  CN.screens.t10 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { table: {}, n: 0, last: null, from: null, log: [], scriptAt: 0 };

    var svg = s('svg', { width: 940, height: 380, viewBox: '0 0 940 380' });
    var tbl = h('div');
    var logEl = h('div', { class: 'working', style: { fontSize: '21px', height: '170px' } });
    var hint = h('div', { class: 'small muted' });
    // st before each frame (scripted or clicked), so Back can undo it
    var undo = [];
    var backBtn = ui.backBtn(function () { if (undo.length) { st = JSON.parse(undo.pop()); draw(); } });
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { class: 'panel', style: { padding: '4px' } }, svg),
      h('div', { class: 'col grow' },
        h('div', { class: 'row' }, backBtn, ui.btn('Next scripted frame (S)', stepScript, 'primary'), ui.btn('Reset (R)', reset)),
        hint,
        h('div', { class: 'label' }, 'Bridge table (learned from SOURCE addresses)'), tbl, logEl)));

    body.appendChild(h('table', { class: 't', style: { fontSize: '21px' } },
      h('tr', null, ['Device', 'Layer', 'Works on', 'Collision domains (8 ports)', 'Broadcast domains (8 ports)'].map(function (x) { return h('th', null, x); })),
      [['Repeater, hub', 'Physical', 'bits: repeats to all ports', '1', '1'],
        ['Bridge, switch', 'Data link', 'MAC addresses: learn, filter, forward', '8 (one per port; full duplex = none)', '1'],
        ['Router', 'Network', 'IP addresses: separates broadcast domains', '8', '8'],
        ['Gateway', 'Transport / application', 'translates between protocols', '–', '–']].map(function (r) {
        return h('tr', null, r.map(function (c, i) { return h('td', { class: i >= 3 ? 'c' : '' }, i >= 3 ? h('b', null, c) : c); }));
      })));
    body.appendChild(h('div', { class: 'small muted' }, 'Spanning tree (Perlman, 802.1D): loops cause broadcast storms, so bridges elect the lowest-ID root, build a shortest-path tree to it, and disable ports not on the tree.'));

    function hostPos(n) {
      var p = PORTS[HOSTS[n]], i = p.hosts.indexOf(n);
      if (HOSTS[n] === 3) return { x: p.x - 150 + i * 300, y: p.y + 48 };
      return { x: p.x - 90 + i * 180, y: p.y - 50 };
    }

    function send(src, dst) {
      undo.push(JSON.stringify(Object.assign({}, st, { from: null })));
      var inPort = HOSTS[src], res, outPorts = [];
      var learnedNew = !st.table[src];
      st.table[src] = { port: inPort, at: ++st.n };
      if (st.table[dst]) {
        if (st.table[dst].port === inPort) res = 'filter';
        else { res = 'forward'; outPorts = [st.table[dst].port]; }
      } else { res = 'flood'; outPorts = [1, 2, 3].filter(function (p) { return p !== inPort; }); }
      st.last = { src: src, dst: dst, inPort: inPort, res: res, out: outPorts };
      var text = 'Frame ' + st.n + ': ' + src + '→' + dst + ' arrives on port ' + inPort + (learnedNew ? '; learn ' + src + ' = port ' + inPort : '') + '; ' +
        (res === 'flood' ? dst + ' unknown → FLOOD to ports ' + outPorts.join(', ') : res === 'forward' ? dst + ' on port ' + outPorts[0] + ' → FORWARD' : dst + ' is on the arrival port → DISCARD (filter)');
      st.log.push({ text: text, cls: res === 'filter' ? 'bad' : res === 'forward' ? 'ok' : 'warnc' });
      draw();
    }
    function stepScript() {
      if (st.scriptAt >= SCRIPT.length) reset();
      var p = SCRIPT[st.scriptAt++];
      send(p[0], p[1]);
    }
    function reset() { st = { table: {}, n: 0, last: null, from: null, log: [], scriptAt: 0 }; undo = []; draw(); }

    function draw() {
      backBtn.disabled = !undo.length;
      CN.clear(svg);
      var L = st.last;
      Object.keys(PORTS).forEach(function (k) {
        var p = PORTS[k];
        var lit = L && (L.inPort === +k || L.out.indexOf(+k) >= 0);
        var col = !L ? 'var(--muted)' : L.inPort === +k ? 'var(--blue)' : L.out.indexOf(+k) >= 0 ? (L.res === 'flood' ? 'var(--amber)' : 'var(--green)') : 'var(--line)';
        svg.appendChild(s('line', { x1: BR.x, y1: BR.y, x2: p.x, y2: p.y, stroke: col, 'stroke-width': lit ? 7 : 4 }));
        svg.appendChild(s('text', { x: (BR.x + p.x) / 2 + (k === '3' ? 14 : 0), y: (BR.y + p.y) / 2 + (k === '3' ? 22 : -8), 'font-size': 20, 'font-weight': 700, fill: 'var(--muted)' }, 'port ' + k));
        // LAN segment
        var segW = k === '3' ? 380 : 260;
        svg.appendChild(s('rect', { x: p.x - segW / 2, y: p.y - 8, width: segW, height: 16, rx: 8, fill: 'var(--panel2)', stroke: 'var(--ink)', 'stroke-width': 2 }));
        svg.appendChild(s('text', { x: k === '2' ? p.x + segW / 2 : p.x - segW / 2, y: k === '3' ? p.y - 14 : p.y + 32, 'text-anchor': k === '2' ? 'end' : 'start', 'font-size': 19, fill: 'var(--muted)' }, 'LAN ' + k));
        p.hosts.forEach(function (n) {
          var hp = hostPos(n), isSrc = L && L.src === n, isDst = L && L.dst === n;
          svg.appendChild(s('line', { x1: hp.x, y1: hp.y + (k === '3' ? -20 : 20), x2: hp.x, y2: p.y, stroke: 'var(--ink)', 'stroke-width': 2 }));
          var g = s('g', { class: 'clickable' },
            s('rect', { x: hp.x - 30, y: hp.y - 24, width: 60, height: 46, rx: 8, fill: st.from === n ? 'var(--accent-bg)' : 'var(--panel)',
              stroke: isSrc ? 'var(--blue)' : isDst ? (L.res === 'filter' ? 'var(--muted)' : 'var(--green)') : 'var(--ink)', 'stroke-width': isSrc || isDst ? 5 : 2.5 }),
            s('text', { x: hp.x, y: hp.y + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800 }, n));
          g.addEventListener('click', function () {
            if (!st.from) { st.from = n; draw(); }
            else if (st.from === n) { st.from = null; draw(); }
            else { var f = st.from; st.from = null; send(f, n); }
          });
          svg.appendChild(g);
        });
      });
      svg.appendChild(s('rect', { x: BR.x - 70, y: BR.y - 34, width: 140, height: 68, rx: 10, fill: 'var(--panel)', stroke: 'var(--accent)', 'stroke-width': 4 }));
      svg.appendChild(s('text', { x: BR.x, y: BR.y + 9, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800, fill: 'var(--accent)' }, 'Bridge'));
      if (L) {
        var label = L.res === 'flood' ? 'FLOOD (all but port ' + L.inPort + ')' : L.res === 'forward' ? 'FORWARD → port ' + L.out[0] : '✕ DISCARD (filtered)';
        svg.appendChild(s('text', { x: BR.x + 90, y: BR.y + 60, 'text-anchor': 'start', 'font-size': 23, 'font-weight': 800,
          fill: L.res === 'filter' ? 'var(--red)' : L.res === 'forward' ? 'var(--green)' : 'var(--amber)' }, L.src + '→' + L.dst + ': ' + label));
      }
      CN.clear(hint).appendChild(document.createTextNode(st.from ? 'Sender ' + st.from + ' chosen: click the receiver' : 'Or click a sender, then a receiver. Script: A→D floods, D→A forwards, A→B is filtered.'));
      CN.clear(tbl);
      var keys = Object.keys(st.table);
      var t = h('table', { class: 't' }, h('tr', null, h('th', null, 'MAC'), h('th', null, 'Port'), h('th', null, 'Learned (frame #)')));
      if (!keys.length) t.appendChild(h('tr', null, h('td', { colspan: 3, class: 'muted' }, 'empty: the bridge starts knowing nothing')));
      keys.forEach(function (k) {
        t.appendChild(h('tr', null, h('td', { class: 'mono' }, k), h('td', { class: 'c' }, String(st.table[k].port)), h('td', { class: 'c' }, String(st.table[k].at))));
      });
      tbl.appendChild(t);
      CN.clear(logEl);
      st.log.slice(-4).forEach(function (l) { logEl.appendChild(h('div', { class: l.cls }, l.text)); });
    }
    draw();
    return { step: stepScript, reset: reset };
  };
})();
