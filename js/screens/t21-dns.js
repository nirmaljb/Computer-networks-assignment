(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // DNS walk (CN.dns): client → local resolver → root → TLD → … one level per label, iterative or
  // recursive, with a resolver cache whose TTL counts down in real time. No real lookups.
  CN.screens.t21 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var TTL = 30, t0 = Date.now();
    var st = { name: 'www.example.com', mode: 'iterative', res: CN.dns.resolver(TTL), cur: null, k: 0 };
    function now() { return (Date.now() - t0) / 1000; }

    var W = 900, H = 600;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    var field = ui.field(st.name, { width: 300, onInput: function (v) { st.name = v; } });
    var err = h('div', { class: 'errmsg' });
    var modeSeg = ui.seg([['iterative', 'Iterative'], ['recursive', 'Recursive']], st.mode, function (v) { st.mode = v; lookup(); });
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { if (!st.cur || st.k >= st.cur.steps.length) return false; st.k++; draw(); return st.k < st.cur.steps.length; }, 800,
      function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    var log = h('div', { class: 'working', style: { height: '210px', fontSize: '19px' } });
    var cacheBox = h('div', { class: 'panel small' });
    var count = h('div', { class: 'panel small' });
    field.addEventListener('keydown', function (e) { if (e.key === 'Enter') lookup(); });

    var right = h('div', { class: 'col grow', style: { gap: '8px' } },
      h('div', { class: 'row nowrap', style: { gap: '8px' } }, h('span', { class: 'label' }, 'Name'), field, ui.btn('Look up', lookup, 'primary')),
      err,
      h('div', { class: 'row', style: { gap: '8px' } }, modeSeg, ui.btn('Step (S)', step), runBtn, ui.btn('Clear cache', function () { st.res.clear(); lookup(); })),
      count, log, cacheBox,
      h('div', { class: 'small muted' }, 'Assumes a zone cut at every label (in practice one zone can hold several labels). No real lookups: addresses are RFC 5737 documentation addresses; server names other than root and .com/.net are illustrative.'),
      ui.cards([['Record types', function () {
        var t = h('table', { class: 't' }, h('tr', null, h('th', null, 'Type'), h('th', null, 'Example'), h('th', null, 'Meaning')));
        CN.dns.RECORDS.forEach(function (r) { t.appendChild(h('tr', null, h('td', null, h('b', null, r[0])), h('td', { class: 'mono', style: { whiteSpace: 'pre' } }, r[1]), h('td', null, r[2]))); });
        return h('div', { class: 'col' }, t, h('div', { class: 'small muted' }, 'Fields: name, TTL (s), class (IN = Internet), type, value.'));
      }]], body));
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '18px' } }, h('div', { class: 'panel', style: { padding: '4px' } }, svg), right));

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
      } else svg.appendChild(s('text', { x: 20, y: 34, 'font-size': 20, fill: 'var(--muted)' }, 'S or Run: the phone asks ' + c.name));
      // log
      CN.clear(log);
      shown.forEach(function (m, j) {
        var who = function (x) { return x === 'client' ? 'phone' : x === 'resolver' ? 'resolver' : c.zones[x].label; };
        log.appendChild(h('div', { class: m.kind === 'referral' ? 'warnc' : m.kind === 'answer' ? 'ok' : '' }, (j + 1) + '. ' + who(m.from) + ' → ' + who(m.to) + ': ' + m.text));
      });
      log.scrollTop = log.scrollHeight;
      CN.clear(count);
      count.appendChild(h('div', null, c.cached ? h('b', { class: 'ok' }, 'Cache hit: ') : h('b', null, st.mode === 'iterative' ? 'Iterative: ' : 'Recursive: '),
        c.cached ? 'the resolver answers at once, no queries to the tree.' :
          'the resolver sends ' + c.fromResolver + ' quer' + (c.fromResolver === 1 ? 'y' : 'ies') + (st.mode === 'iterative' ? ', one per level; each server returns a referral or the answer.' : '; each server asks the next on the client\'s behalf.')));
    }
    function drawCache() {
      CN.clear(cacheBox);
      var e = st.cur && st.res.entry(st.cur.name);
      // the model caches at lookup time; on screen the entry appears when the answer reaches the resolver
      var pending = st.cur && !st.cur.cached && st.k < st.cur.steps.length - 1;
      if (!e || pending) { cacheBox.appendChild(h('span', { class: 'muted' }, 'Resolver cache: ' + (pending ? 'nothing for this name yet' : 'empty'))); return; }
      var left = e.expires - now();
      cacheBox.appendChild(h('div', null, h('b', null, 'Resolver cache: '), h('span', { class: 'mono' }, st.cur.name + ' A ' + e.address + '  '),
        left > 0 ? h('b', { class: 'mono ' + (left < 10 ? 'warnc' : 'ok') }, 'TTL ' + Math.ceil(left) + ' s') : h('b', { class: 'bad' }, 'expired: next lookup walks the tree')));
    }
    function lookup() {
      runner.stop();
      var r = st.res.lookup(st.name, st.mode, now());
      field.classList.toggle('invalid', !!r.error);
      err.textContent = r.error || '';
      if (r.error) return;
      st.cur = r; st.k = 0;
      modeSeg.set(st.mode);
      draw(); drawCache();
    }
    function step() { runner.stop(); if (st.cur && st.k < st.cur.steps.length) { st.k++; draw(); } }
    var tick = setInterval(drawCache, 250);
    lookup();
    return {
      step: step,
      reset: function () { st.res.clear(); st.name = 'www.example.com'; st.mode = 'iterative'; field.value = st.name; t0 = Date.now(); lookup(); },
      destroy: function () { runner.stop(); clearInterval(tick); }
    };
  };
})();
