(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  var HOSTS = { A: 1, B: 1, C: 2, D: 2, E: 3, F: 3 };
  // SPEC-v5: 10a = the scripted learning run (A→D floods, D→A forwards, B→A is filtered); 10b = the device table.
  var SCRIPT = [['A', 'D'], ['D', 'A'], ['B', 'A']];
  // geometry
  var BR = { x: 470, y: 190 };
  var PORTS = { 1: { x: 170, y: 90, hosts: ['A', 'B'] }, 2: { x: 770, y: 90, hosts: ['C', 'D'] }, 3: { x: 470, y: 300, hosts: ['E', 'F'] } };

  function learning(body) {
    var st;
    var svg = s('svg', { width: 1300, height: 525, viewBox: '0 0 940 380' });
    var tbl = h('div', { class: 'mono', style: { fontSize: '26px', fontWeight: 700 } });
    body.appendChild(h('div', { class: 'say' }, 'The bridge learns each SOURCE address and the port it came in on.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, svg));
    body.appendChild(tbl);

    function hostPos(n) {
      var p = PORTS[HOSTS[n]], i = p.hosts.indexOf(n);
      if (HOSTS[n] === 3) return { x: p.x - 150 + i * 300, y: p.y + 48 };
      return { x: p.x - 90 + i * 180, y: p.y - 50 };
    }

    function send(src, dst) {
      var inPort = HOSTS[src], res, outPorts = [];
      st.table[src] = { port: inPort, at: ++st.n };
      if (st.table[dst]) {
        if (st.table[dst].port === inPort) res = 'filter';
        else { res = 'forward'; outPorts = [st.table[dst].port]; }
      } else { res = 'flood'; outPorts = [1, 2, 3].filter(function (p) { return p !== inPort; }); }
      st.last = { src: src, dst: dst, inPort: inPort, res: res, out: outPorts };
      draw();
    }
    function step() { if (st.scriptAt >= SCRIPT.length) return false; var p = SCRIPT[st.scriptAt++]; send(p[0], p[1]); return true; }
    function reset() { st = { table: {}, n: 0, last: null, scriptAt: 0 }; draw(); }

    function draw() {
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
          var g = s('g', null,
            s('rect', { x: hp.x - 30, y: hp.y - 24, width: 60, height: 46, rx: 8, fill: 'var(--panel)',
              stroke: isSrc ? 'var(--blue)' : isDst ? (L.res === 'filter' ? 'var(--muted)' : 'var(--green)') : 'var(--ink)', 'stroke-width': isSrc || isDst ? 5 : 2.5 }),
            s('text', { x: hp.x, y: hp.y + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800 }, n));
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
      var keys = Object.keys(st.table);
      CN.clear(tbl).appendChild(document.createTextNode('Bridge table: ' + (keys.length
        ? keys.map(function (m) { return m + ' → port ' + st.table[m].port; }).join(' · ')
        : 'empty, the bridge starts knowing nothing')));
    }
    body.appendChild(ui.controls());
    reset();
    // learnStep: frames sent so far (one learn row each)
    return { step: step, reset: reset, learnStep: function () { return st.scriptAt; } };
  }

  function devices(body) {
    body.appendChild(h('table', { class: 't', style: { fontSize: '28px', marginTop: '30px' } },
      h('tr', null, ['Device', 'Layer', 'Works on', 'Collision domains (8 ports)', 'Broadcast domains (8 ports)'].map(function (x) { return h('th', null, x); })),
      [['Repeater, hub', 'Physical', 'bits: repeats to all ports', '1', '1'],
        ['Bridge, switch', 'Data link', 'MAC addresses: learn, filter, forward', '8', '1'],
        ['Router', 'Network', 'IP addresses: separates broadcast domains', '8', '8'],
        ['Gateway', 'Transport / application', 'translates between protocols', '–', '–']].map(function (r) {
        return h('tr', null, r.map(function (c, i) { return h('td', { class: i >= 3 ? 'c' : '' }, i >= 3 ? h('b', null, c) : c); }));
      })));
    return {};
  }

  CN.screens.t10 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'devices' ? devices(body) : learning(body);
  };
})();
