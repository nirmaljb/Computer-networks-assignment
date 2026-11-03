(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: the DNS walk (CN.dns) for www.example.com, one message per Step. 21a iterative, 21b recursive,
  // 21c resource records (static). No real lookups; a fresh resolver each time, so no cache hits.
  var NAME = 'www.example.com';

  function walk(body, mode) {
    var st = { cur: null, k: 0 };
    var W = 900, H = 600;
    var svg = s('svg', { width: 975, height: 650, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, mode === 'iterative'
      ? 'Iterative: the resolver asks each level itself; each server returns a referral or the answer.'
      : 'Recursive: each server asks the next one on the client\'s behalf and passes the answer back.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px', alignSelf: 'flex-start' } }, svg));
    // node positions: client, resolver, then the servers down a diagonal (root at the top)
    function nodes(zones) {
      var n = { client: [90, 520, 'Phone (client)'], resolver: [300, 410, 'Local resolver'] };
      zones.forEach(function (z, i) { n[i] = [470 + i * 125, 70 + i * 135, i === 0 ? 'Root' : (i === 1 ? z.label : z.zone), z.server]; });
      return n;
    }
    function draw() {
      CN.clear(svg);
      var c = st.cur;
      if (!c) return;
      var N = nodes(c.zones), shown = c.steps.slice(0, st.k);
      // tree edges
      for (var i = 1; i < c.zones.length; i++) svg.appendChild(s('line', { x1: N[i - 1][0], y1: N[i - 1][1], x2: N[i][0], y2: N[i][1], stroke: 'var(--line)', 'stroke-width': 3 }));
      // arrows so far: earlier faded, the newest bold with its text
      shown.forEach(function (m, j) {
        var a = N[m.from], b = N[m.to], newest = j === shown.length - 1;
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L * 9, ny = dx / L * 9;
        var sx = a[0] + dx / L * 52 + nx, sy = a[1] + dy / L * 52 + ny, ex = b[0] - dx / L * 52 + nx, ey = b[1] - dy / L * 52 + ny;
        var col = m.kind === 'query' ? 'var(--blue)' : m.kind === 'referral' ? 'var(--amber)' : 'var(--green)';
        svg.appendChild(s('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: col, 'stroke-width': newest ? 4 : 2, opacity: newest ? 1 : 0.4, 'marker-end': 'url(#ah-' + m.kind + ')' }));
        var mx = (sx + ex) / 2 + nx * 1.6, my = (sy + ey) / 2 + ny * 1.6;
        svg.appendChild(s('circle', { cx: mx, cy: my, r: 13, fill: col, opacity: newest ? 1 : 0.6 }));
        svg.appendChild(s('text', { x: mx, y: my + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#fff' }, String(j + 1)));
      });
      var defs = s('defs');
      [['query', 'var(--blue)'], ['referral', 'var(--amber)'], ['answer', 'var(--green)']].forEach(function (d) {
        defs.appendChild(s('marker', { id: 'ah-' + d[0], viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: d[1] })));
      });
      svg.insertBefore(defs, svg.firstChild);
      // nodes on top
      Object.keys(N).forEach(function (k) {
        var p = N[k], busy = shown.length && (shown[shown.length - 1].to === (isNaN(k) ? k : +k));
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 44, fill: busy ? 'var(--accent-bg)' : 'var(--panel)', stroke: busy ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, k === 'client' ? 'phone' : k === 'resolver' ? 'resolver' : p[2]));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 64, 'text-anchor': 'middle', 'font-size': 15, fill: 'var(--muted)', class: 'halo' }, p[3] || p[2]));
      });
      // newest message text, big
      if (shown.length) {
        var m = shown[shown.length - 1];
        svg.appendChild(s('text', { x: 20, y: 34, 'font-size': 22, 'font-weight': 800, class: 'mono halo', fill: m.kind === 'query' ? 'var(--blue)' : m.kind === 'referral' ? 'var(--amber)' : 'var(--green)' },
          shown.length + '. ' + m.text));
      } else svg.appendChild(s('text', { x: 20, y: 34, 'font-size': 22, fill: 'var(--muted)' }, 'Step: the phone asks for ' + c.name));
    }
    function reset() { st.cur = CN.dns.resolver(30).lookup(NAME, mode, 0); st.k = 0; draw(); }
    function step() { if (st.k >= st.cur.steps.length) return false; st.k++; draw(); return true; }
    body.appendChild(ui.controls(step, reset));
    reset();
    return { step: step, reset: reset, prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  function records(body) {
    var t = h('table', { class: 't', style: { fontSize: '26px', marginTop: '16px' } }, h('tr', null, h('th', null, 'Type'), h('th', null, 'Example'), h('th', null, 'Meaning')));
    CN.dns.RECORDS.forEach(function (r) { t.appendChild(h('tr', null, h('td', null, h('b', null, r[0])), h('td', { class: 'mono', style: { whiteSpace: 'pre' } }, r[1]), h('td', null, r[2]))); });
    body.appendChild(h('div', { class: 'say' }, 'Each record: name, TTL (s), class (IN), type, value. Resolvers cache a record for its TTL.'));
    body.appendChild(t);
    return {};
  }

  CN.screens.t21 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'records' ? records(body) : walk(body, sc.part);
  };
})();
