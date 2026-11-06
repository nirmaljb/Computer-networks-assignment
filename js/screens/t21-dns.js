(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: the DNS walk (CN.dns) for www.example.com, one message per Step. 21a iterative, 21b recursive,
  // 21c resource records (static). No real lookups; a fresh resolver each time, so no cache hits.
  var NAME = 'www.example.com';

  // SPEC-v8 handle: records the resolver already holds. A zone's NS record lets the walk start below the root; the
  // name's own A record answers at once. Tap a record to cache it or drop it.
  var CACHE = ['com', 'example.com', 'www.example.com'], RECORD = { com: 'com NS', 'example.com': 'example.com NS', 'www.example.com': 'www A' };

  // SPEC-v6 set piece: the walk drawn on the hierarchy itself (root → TLD → authoritative), with the phone and
  // the resolver beside it. No map: root and TLD servers are anycast, so geography would be wrong.
  // One message per Step; the newest one travels its arrow as a glowing dot (instant with motion off).
  var COL = { query: 'var(--blue)', referral: 'var(--amber)', answer: 'var(--green)' };
  function walk(body, mode) {
    var st = { cur: null, k: 0 }, fresh = false;
    var hC = ui.handle({ key: 'cache', label: 'Cached', kind: 'chips', multi: true, value: [], values: CACHE,
      fmt: function (v) { return v.length ? String(v.length) : 'none'; }, chip: function (v) { return RECORD[v]; } });
    var W = 1180, H = 600;
    var svg = s('svg', { width: 1065, height: 540, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, mode === 'iterative'
      ? 'Iterative: the resolver asks each level itself; each server returns a referral or the answer.'
      : 'Recursive: each server asks the next one on the client\'s behalf and passes the answer back.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, svg));
    body.appendChild(ui.handleRow(hC));
    var ROLE = ['root', 'TLD', 'authoritative', 'authoritative'];
    function nodes(zones) {
      var n = { client: [130, 470, 'phone', 'client'], resolver: [400, 300, 'resolver', 'local resolver'] };
      zones.forEach(function (z, i) { n[i] = [800, 70 + i * 185, i === 0 ? 'root' : z.zone, z.server + ' · ' + ROLE[Math.min(i, 3)]]; });
      return n;
    }
    function draw() {
      CN.clear(svg);
      var c = st.cur;
      if (!c) return;
      var N = nodes(c.zones), shown = c.steps.slice(0, st.k);
      var defs = s('defs');
      ['query', 'referral', 'answer'].forEach(function (k) {
        defs.appendChild(s('marker', { id: 'ah-' + k, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: COL[k] })));
      });
      svg.appendChild(defs);
      // the hierarchy: the zones on this name's path, plus faded siblings that are never asked
      var sib = [[990, 255, 'org'], [1110, 255, 'net'], [990, 440, '…']];
      sib.forEach(function (x, i) {
        var par = i < 2 ? N[0] : N[1];
        svg.appendChild(s('line', { x1: par[0], y1: par[1], x2: x[0], y2: x[1], stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
        svg.appendChild(s('circle', { cx: x[0], cy: x[1], r: 34, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 2 }));
        svg.appendChild(s('text', { x: x[0], y: x[1] + 6, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--muted)' }, x[2]));
      });
      for (var i = 1; i < c.zones.length; i++) svg.appendChild(s('line', { x1: N[i - 1][0], y1: N[i - 1][1], x2: N[i][0], y2: N[i][1], stroke: 'var(--ink)', 'stroke-width': 3 }));
      // messages so far: earlier ones faded and numbered, the newest bold
      shown.forEach(function (m, j) {
        var a = N[m.from], b = N[m.to], newest = j === shown.length - 1;
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L * 10, ny = dx / L * 10;
        var sx = a[0] + dx / L * 50 + nx, sy = a[1] + dy / L * 50 + ny, ex = b[0] - dx / L * 50 + nx, ey = b[1] - dy / L * 50 + ny;
        svg.appendChild(s('line', { x1: sx, y1: sy, x2: ex, y2: ey, stroke: COL[m.kind], 'stroke-width': newest ? 4 : 2, opacity: newest ? 1 : 0.35, 'marker-end': 'url(#ah-' + m.kind + ')' }));
        var mx = (sx + ex) / 2 + nx * 1.7, my = (sy + ey) / 2 + ny * 1.7;
        svg.appendChild(s('circle', { cx: mx, cy: my, r: 13, fill: COL[m.kind], opacity: newest ? 1 : 0.55 }));
        svg.appendChild(s('text', { x: mx, y: my + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#fff' }, String(j + 1)));
        if (newest) {
          var dot = s('circle', { cx: ex, cy: ey, r: 10, fill: COL[m.kind], style: 'filter: drop-shadow(0 0 7px ' + COL[m.kind] + ') drop-shadow(0 0 3px ' + COL[m.kind] + ')' });
          if (fresh && CN.motion()) {
            dot.appendChild(s('animate', { attributeName: 'cx', from: sx, to: ex, dur: '0.7s', fill: 'freeze' }));
            dot.appendChild(s('animate', { attributeName: 'cy', from: sy, to: ey, dur: '0.7s', fill: 'freeze' }));
          }
          svg.appendChild(dot);
        }
      });
      // nodes on top; the one that just received a message is lit; servers the cache lets the walk skip are faded
      Object.keys(N).forEach(function (k) {
        var p = N[k], busy = shown.length && String(shown[shown.length - 1].to) === k;
        var skipped = /^\d+$/.test(k) && (c.cached || +k < c.top);
        svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 44, fill: busy ? 'var(--accent-bg)' : 'var(--panel)', stroke: busy ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 3,
          'stroke-dasharray': skipped ? '6 6' : null, opacity: skipped ? 0.45 : 1 }));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 6, 'text-anchor': 'middle', 'font-size': p[2].length > 9 ? 15 : 18, 'font-weight': 800 }, p[2]));
        svg.appendChild(s('text', { x: p[0], y: p[1] + 66, 'text-anchor': 'middle', 'font-size': 16, fill: 'var(--muted)', class: 'halo' }, p[3]));
      });
      if (shown.length) {
        var m = shown[shown.length - 1];
        svg.appendChild(s('text', { x: 20, y: 34, 'font-size': 22, 'font-weight': 800, class: 'mono halo', fill: COL[m.kind] }, shown.length + '. ' + m.text));
      } else svg.appendChild(s('text', { x: 20, y: 34, 'font-size': 22, fill: 'var(--muted)' }, 'Step: the phone asks for ' + c.name));
      fresh = false;
    }
    function reset() { st.cur = CN.dns.walk(NAME, mode, hC.value()); st.k = 0; fresh = false; draw(); }
    function step() { if (st.k >= st.cur.steps.length) return false; st.k++; fresh = true; draw(); return true; }
    body.appendChild(ui.controls());
    reset();
    var ctl = { step: step, reset: reset, prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; }, learnStep: function () { return st.k; },
      genText: function () { return 'cache ' + hC.value().join(' '); } };
    // C (21a): one cached NS record so the resolver asks only two servers (the TLD's and the authoritative one)
    if (mode === 'iterative') ctl.challenge = { goal: 'Cache one record so the resolver sends only 2 queries',
      why: 'With com\'s NS cached the resolver skips the root: it asks the TLD server, then the authoritative one.',
      holds: function () { return CN.dns.walk(NAME, mode, hC.value()).fromResolver === 2; },
      answer: function () { return { cache: ['com'] }; } };
    return ctl;
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
