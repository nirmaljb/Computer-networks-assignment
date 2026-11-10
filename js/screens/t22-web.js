(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 22a URL + request (static), 22b page-load round trips for the three HTTP/1.x styles
  // (CN.http, 1 HTML + 10 images, RTT 100 ms, static), 22c the 2×2 scale grid (static), 22d the methods card, 22e HOL lanes, 22f the BitTorrent swarm.
  var MODES = [['nonpersistent', 'Non-persistent', 'new connection per object'],
    ['persistent', 'Persistent', 'one connection, 1 request at a time'],
    ['pipelined', 'Persistent + pipelining', 'all image requests back to back']];

  // SPEC-v9 22a: the URL taken apart (CN.http.exchange). One colour per piece, and the same colour wherever that
  // piece ends up: scheme → port, host → DNS and Host:, path → the request line. Step 0 URL, 1 split, 2 DNS + port
  // + TCP, 3 the request (inside TLS on https), 4 the response. Handle: three URLs, each moves a different piece.
  var PC = { scheme: 'amber', sep: 'grey', host: 'blue', port: 'accent', path: 'green' };
  var CHIP = { 'http://www.example.com/index.html': 'http', 'https://www.example.com/index.html': 'https', 'http://www.example.com:8080/a/b.png': ':8080 · .png' };
  function request(body) {
    var W = 1300, H = 600, LX = 20, RX = 1070, CW = 210, EX0 = 300, EX1 = 1000;
    var st = { k: 0 }, fresh = false;
    var hU = ui.handle({ key: 'url', label: 'URL', kind: 'chips', value: CN.http.URLS[0], values: CN.http.URLS, fmt: function () { return ''; }, chip: function (v) { return CHIP[v]; } });
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Step takes the URL apart: each piece ends up somewhere in the request.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, svg));
    body.appendChild(ui.handleRow(hU));
    // 'mark' highlights a response field without a URL colour: nothing in the response comes from the URL
    function col(k) { return k === 'mark' ? 'var(--ink)' : 'var(--' + PC[k] + ')'; }
    function bg(k) { return k === 'mark' ? 'var(--grey-bg)' : 'var(--' + PC[k] + '-bg)'; }
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 20, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || null, class: o.mono ? 'mono' : null, style: o.mono ? 'white-space: pre' : null }, str);
    }
    // one line of mono text from [text, piece | null] runs; a coloured run gets its piece's background
    function runs(g, x, y, list, fs) {
      var cw = fs * 0.6;
      list.forEach(function (r) {
        var el = t(x + (r[1] ? 4 : 0), y, r[0], { fs: fs, mono: true, fill: r[1] ? col(r[1]) : null, bold: !!r[1] });
        g.appendChild(el);
        var w = measure(el, r[0].length * cw) + (r[1] ? 8 : 0);
        if (r[1]) g.insertBefore(s('rect', { x: x, y: y - fs + 2, width: w, height: fs + 6, rx: 3, fill: bg(r[1]), stroke: r[1] === 'mark' ? 'var(--muted)' : col(r[1]), 'stroke-width': 1.5 }), el);
        x += w;
      });
    }
    // bold mono is wider than 0.6 em in some fonts: measure once the text is on the page (the estimate otherwise)
    function measure(el, guess) {
      var w = 0;
      try { w = el.getComputedTextLength ? el.getComputedTextLength() : 0; } catch (e) { /* not rendered */ }
      return w > 0 ? w : guess;
    }
    function arrow(x1, y1, x2, y2, color, dash) {
      return s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, 'stroke-width': 3, 'stroke-dasharray': dash || null, 'marker-end': 'url(#ah22-' + color.replace(/\W/g, '') + ')' });
    }
    function lock(x, y) {
      var g = s('g', null);
      g.appendChild(s('path', { d: 'M ' + (x + 4) + ' ' + (y + 10) + ' v -5 a 7 7 0 0 1 14 0 v 5', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 }));
      g.appendChild(s('rect', { x: x, y: y + 9, width: 22, height: 16, rx: 3, fill: 'var(--accent)' }));
      return g;
    }
    // an envelope slides in from its sender when it has just been sent (motion on)
    function slide(g, dx) {
      if (fresh && CN.motion()) g.appendChild(s('animateTransform', { attributeName: 'transform', type: 'translate', from: dx + ' 0', to: '0 0', dur: '0.6s', fill: 'freeze' }));
      return g;
    }
    function draw() {
      CN.clear(svg);
      var x = CN.http.exchange(hU.value(), CN.dns.addrFor), u = x.url, k = st.k;
      var defs = s('defs');
      ['var(--ink)', 'var(--amber)', 'var(--blue)', 'var(--accent)'].forEach(function (c) {
        defs.appendChild(s('marker', { id: 'ah22-' + c.replace(/\W/g, ''), viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: c })));
      });
      svg.appendChild(defs);

      // the URL: one string at Step 0, its pieces apart (boxed, named) from Step 1
      var FS = 34, cw = FS * 0.6, gap = k >= 1 ? 18 : 0, wsum = 0, at = {};
      u.parts.forEach(function (p) { wsum += p.t.length * cw; });
      wsum += gap * (u.parts.length - 1);
      var px = (W - wsum) / 2;
      u.parts.forEach(function (p) {
        var w = p.t.length * cw;
        at[p.k] = px + w / 2;
        if (k >= 1 && p.k !== 'sep') {
          svg.appendChild(s('rect', { x: px - 6, y: 18, width: w + 12, height: 52, rx: 6, fill: bg(p.k), stroke: col(p.k), 'stroke-width': 2.5 }));
          svg.appendChild(t(px + w / 2, 96, p.k, { fs: 17, anchor: 'middle', fill: col(p.k), bold: true }));
        }
        svg.appendChild(t(px, 56, p.t, { fs: FS, mono: true, bold: k >= 1 && p.k !== 'sep', fill: k >= 1 ? col(p.k) : null }));
        px += w + gap;
      });

      // the two ends
      [[LX, 'Browser', k >= 4], [RX, 'Server', k === 3]].forEach(function (e) {
        svg.appendChild(s('rect', { x: e[0], y: 140, width: CW, height: 450, rx: 8, fill: e[2] ? 'var(--accent-bg)' : 'var(--panel)', stroke: e[2] ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(t(e[0] + CW / 2, 174, e[1], { fs: 24, bold: true, anchor: 'middle' }));
      });
      if (k >= 2) svg.appendChild(t(RX + CW / 2, 202, x.ip + ':' + u.port, { fs: 17, mono: true, anchor: 'middle', fill: 'var(--muted)' }));

      if (k >= 2) {
        // scheme (or the URL's own port) → the port; host → DNS → the address; then TCP to address:port
        var pk = u.explicit ? 'port' : 'scheme';
        svg.appendChild(s('rect', { x: 270, y: 132, width: 290, height: 74, rx: 6, fill: bg(pk), stroke: col(pk), 'stroke-width': 2 }));
        svg.appendChild(t(415, 158, u.explicit ? 'port given in the URL' : 'default port for ' + u.scheme, { fs: 16, anchor: 'middle', fill: 'var(--muted)' }));
        svg.appendChild(t(415, 192, 'port ' + u.port, { fs: 26, mono: true, bold: true, anchor: 'middle', fill: col(pk) }));
        svg.appendChild(arrow(at[pk], 104, 415, 128, col(pk)));
        svg.appendChild(s('rect', { x: 600, y: 132, width: 440, height: 74, rx: 6, fill: bg('host'), stroke: col('host'), 'stroke-width': 2 }));
        svg.appendChild(t(820, 158, 'DNS (stop 21): A record', { fs: 16, anchor: 'middle', fill: 'var(--muted)' }));
        svg.appendChild(t(820, 192, u.host + ' → ' + x.ip, { fs: 21, mono: true, bold: true, anchor: 'middle', fill: col('host') }));
        svg.appendChild(arrow(at.host, 104, 820, 128, col('host')));
        svg.appendChild(arrow(LX + CW + 4, 240, RX - 4, 240, 'var(--amber)', '8 6'));
        svg.appendChild(t(650, 232, 'TCP connection to ' + x.ip + ':' + u.port + ' (handshake: stop 17)', { fs: 17, anchor: 'middle', fill: 'var(--amber)', bold: true }));
      }
      if (k >= 3) {
        if (x.tls) {
          svg.appendChild(s('line', { x1: LX + CW + 4, y1: 266, x2: RX - 4, y2: 266, stroke: 'var(--accent)', 'stroke-width': 3, 'marker-start': 'url(#ah22-varaccent)', 'marker-end': 'url(#ah22-varaccent)' }));
          svg.appendChild(t(650, 260, 'TLS handshake, then both messages travel encrypted (shown as the two ends read them)', { fs: 16, anchor: 'middle', fill: 'var(--accent)', bold: true }));
        }
        var rq = s('g', null), pathRun = [['GET ', null], [u.path, 'path'], [' HTTP/1.1', null]];
        var hostRun = [['Host: ', null], [u.host, 'host']].concat(u.explicit ? [[':' + u.port, 'port']] : []);
        rq.appendChild(s('rect', { x: EX0, y: 282, width: EX1 - EX0, height: 106, rx: 6, fill: 'var(--panel)', stroke: x.tls ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 2.5, 'stroke-dasharray': x.tls ? '9 5' : null }));
        rq.appendChild(t(EX1 - 12, 302, 'request →', { fs: 15, anchor: 'end', fill: 'var(--muted)' }));
        runs(rq, EX0 + 20, 318, pathRun, 24);
        runs(rq, EX0 + 20, 350, hostRun, 24);
        rq.appendChild(t(EX0 + 20, 376, '(blank line: end of the headers)', { fs: 15, fill: 'var(--muted)' }));
        if (x.tls) rq.appendChild(lock(EX1 - 40, 334));
        rq.appendChild(arrow(EX1 + 4, 335, RX - 6, 335, 'var(--ink)'));
        svg.appendChild(slide(rq, -240));
      }
      if (k >= 4) {
        var rs = s('g', null), FR = 21, L = 25, y0 = 428;
        rs.appendChild(s('rect', { x: EX0, y: 404, width: EX1 - EX0, height: 186, rx: 6, fill: 'var(--panel)', stroke: x.tls ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 2.5, 'stroke-dasharray': x.tls ? '9 5' : null }));
        rs.appendChild(t(EX1 - 12, 424, '← response', { fs: 15, anchor: 'end', fill: 'var(--muted)' }));
        runs(rs, EX0 + 20, y0, [[x.response[0], 'mark']], FR);
        var ct = x.response[1].split(': ');
        runs(rs, EX0 + 20, y0 + L, [[ct[0] + ': ', null], [ct[1], 'mark']], FR);
        runs(rs, EX0 + 20, y0 + 2 * L, [[x.response[2], null]], FR);
        rs.appendChild(t(EX0 + 20, y0 + 3 * L - 4, '(blank line, then the body)', { fs: 15, fill: 'var(--muted)' }));
        if (x.body.kind === 'html') {
          x.body.lines.forEach(function (line, i) {
            var parts = line.split(/("[^"]+")/).filter(Boolean).map(function (p) { return [p, /^"/.test(p) ? 'mark' : null]; });
            runs(rs, EX0 + 20, y0 + (4 + i) * L - 4, parts, FR - 2);
          });
        } else {
          checker(rs, EX0 + 20, y0 + 3 * L + 4, 52);
          rs.appendChild(t(EX0 + 90, y0 + 4 * L + 12, x.body.bytes + ' bytes of PNG data (binary, not text)', { fs: 19, fill: 'var(--muted)' }));
        }
        if (x.tls) rs.appendChild(lock(EX1 - 40, 520));
        rs.appendChild(arrow(EX0 - 4, 497, LX + CW + 6, 497, 'var(--ink)'));
        svg.appendChild(slide(rs, 240));
        // what the browser makes of it: Content-Type says how to read the bytes
        var bx = LX + 16;
        if (x.body.kind === 'html') {
          svg.appendChild(t(bx, 250, 'Hello', { fs: 26, bold: true }));
          x.body.objects.forEach(function (o, i) {
            var y = 270 + i * 70;
            svg.appendChild(s('rect', { x: bx, y: y, width: CW - 32, height: 54, rx: 4, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
            svg.appendChild(t(bx + 10, y + 24, o, { fs: 17, mono: true, bold: true }));
            svg.appendChild(t(bx + 10, y + 45, '→ GET /' + o, { fs: 14, mono: true, fill: 'var(--muted)' }));
          });
          ['each <img> is one', 'more GET: 22b', 'counts them'].forEach(function (l, i) { svg.appendChild(t(bx, 430 + i * 22, l, { fs: 16, fill: 'var(--muted)' })); });
        } else {
          checker(svg, bx, 220, 90);
          ['image/png: drawn', 'as a picture,', 'not as text'].forEach(function (l, i) { svg.appendChild(t(bx, 340 + i * 22, l, { fs: 16, fill: 'var(--muted)' })); });
        }
      }
      fresh = false;
    }
    // a stand-in for image bytes: a small chequered tile
    function checker(g, x, y, size) {
      var n = 4, c = size / n;
      g.appendChild(s('rect', { x: x, y: y, width: size, height: size, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2 }));
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if ((i + j) % 2) g.appendChild(s('rect', { x: x + i * c, y: y + j * c, width: c, height: c, fill: 'var(--grey-bg)' }));
    }
    function step() { if (st.k >= 4) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // learnStep: the Step (the pane's step table follows the URL chip through genText)
    return { step: step, reset: reset, prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; },
      reached: function () { return st.k >= 2; }, learnStep: function () { return st.k; }, genText: function () { return 'url ' + hU.value(); } };
  }

  function roundTrips(body) {
    var st = { n: 10, rtt: 100 }, W = 1300, LANE = 120;
    var svg = s('svg', { width: W, height: 3 * LANE + 50, viewBox: '0 0 ' + W + ' ' + (3 * LANE + 50) });
    body.appendChild(h('div', { class: 'say' }, 'A page of 1 HTML + 10 images, RTT 100 ms; transmission time ignored (as in Kurose & Ross).'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    function draw() {
      CN.clear(svg);
      var max = CN.http.rtts(st.n, 'nonpersistent'), x0 = 380, x1 = W - 150, u = (x1 - x0) / max;
      MODES.forEach(function (m, k) {
        var p = CN.http.plan(st.n, m[0]), y = 20 + k * LANE;
        svg.appendChild(s('text', { x: 6, y: y + 22, 'font-size': 24, 'font-weight': 800 }, m[1]));
        svg.appendChild(s('text', { x: 6, y: y + 44, 'font-size': 19, fill: 'var(--muted)' }, m[2]));
        p.rows.forEach(function (r) {
          if (r.conn) svg.appendChild(s('rect', { x: x0 + r.conn[0] * u + 1, y: y + 6, width: u - 2, height: 40, rx: 3, fill: 'var(--amber-bg)', stroke: 'var(--amber)', 'stroke-width': 1.5 }));
          // pipelined images share one RTT: drawn as one block
          if (m[0] === 'pipelined' && r.obj > 1) return;
          var wReq = (r.req[1] - r.req[0]) * u;
          svg.appendChild(s('rect', { x: x0 + r.req[0] * u + 1, y: y + 6, width: wReq - 2, height: 40, rx: 3, fill: 'var(--blue-bg)', stroke: 'var(--blue)', 'stroke-width': 1.5 }));
          if (u > 22 || m[0] === 'pipelined') svg.appendChild(s('text', { x: x0 + r.req[0] * u + wReq / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--blue)' },
            r.obj === 0 ? 'H' : m[0] === 'pipelined' ? 'all' : String(r.obj)));
        });
        svg.appendChild(s('text', { x: x0 + p.rtts * u + 10, y: y + 24, 'font-size': 22, 'font-weight': 800 }, p.rtts + ' RTT'));
        svg.appendChild(s('text', { x: x0 + p.rtts * u + 10, y: y + 46, 'font-size': 16, fill: 'var(--muted)', class: 'mono' }, (p.rtts * st.rtt) + ' ms'));
      });
      var yl = 3 * LANE + 26;
      svg.appendChild(s('rect', { x: x0, y: yl, width: 16, height: 14, fill: 'var(--amber-bg)', stroke: 'var(--amber)' }));
      svg.appendChild(s('text', { x: x0 + 22, y: yl + 13, 'font-size': 18 }, 'TCP connect (1 RTT)'));
      svg.appendChild(s('rect', { x: x0 + 200, y: yl, width: 16, height: 14, fill: 'var(--blue-bg)', stroke: 'var(--blue)' }));
      svg.appendChild(s('text', { x: x0 + 222, y: yl + 13, 'font-size': 18 }, 'request → response (1 RTT) · H = the HTML'));
    }
    draw();
    return {};
  }

  // SPEC-v10 22c: the four ways of serving the page side by side, one static diagram each (2×2), no Step.
  // Labels only, no numbers on screen; the long wording is in the presenter facts.
  function scale(body) {
    var W = 1300, PW = 640, PH = 340, GAP = 20, H = 2 * PH + GAP;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { style: { marginTop: '10px' } }, svg));
    var defs = s('defs');
    ['ink', 'blue', 'amber', 'green', 'muted'].forEach(function (c) {
      defs.appendChild(s('marker', { id: 'ah22c-' + c, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
        s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--' + c + ')' })));
    });
    svg.appendChild(defs);
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'middle' }, str);
    }
    function arrow(x1, y1, x2, y2, c, o) {
      o = o || {};
      return s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--' + c + ')', 'stroke-width': o.w || 3, 'stroke-dasharray': o.dash || null,
        'marker-end': 'url(#ah22c-' + c + ')', 'marker-start': o.both ? 'url(#ah22c-' + c + ')' : null });
    }
    // a laptop centred on x, screen top at y
    function client(g, x, y, label, c) {
      c = c || 'ink';
      g.appendChild(s('rect', { x: x - 22, y: y, width: 44, height: 28, rx: 3, fill: 'var(--panel)', stroke: 'var(--' + c + ')', 'stroke-width': 2.5 }));
      g.appendChild(s('path', { d: 'M ' + (x - 29) + ' ' + (y + 34) + ' h 58', stroke: 'var(--' + c + ')', 'stroke-width': 4, 'stroke-linecap': 'round' }));
      if (label) g.appendChild(t(x, y + 54, label, { fs: 15, fill: 'var(--muted)' }));
    }
    // a rack server centred on x, top at y
    function server(g, x, y, label, c, faint) {
      c = c || 'ink';
      var sg = s('g', { opacity: faint ? 0.4 : null });
      sg.appendChild(s('rect', { x: x - 18, y: y, width: 36, height: 50, rx: 3, fill: 'var(--panel)', stroke: 'var(--' + c + ')', 'stroke-width': 2.5 }));
      [14, 26, 38].forEach(function (dy) { sg.appendChild(s('line', { x1: x - 11, y1: y + dy, x2: x + 11, y2: y + dy, stroke: 'var(--' + c + ')', 'stroke-width': 2 })); });
      if (label) sg.appendChild(t(x, y + 70, label, { fs: 15, fill: 'var(--muted)' }));
      g.appendChild(sg);
    }
    function box(g, x, y, w, hh, lines, c) {
      g.appendChild(s('rect', { x: x, y: y, width: w, height: hh, rx: 6, fill: 'var(--' + c + '-bg)', stroke: 'var(--' + c + ')', 'stroke-width': 2.5 }));
      lines.forEach(function (l, i) { g.appendChild(t(x + w / 2, y + hh / 2 + 6 + (i - (lines.length - 1) / 2) * 20, l, { fs: i ? 14 : 17, bold: !i, fill: 'var(--' + c + ')' })); });
    }
    // the diagram sits dy below the title
    function panel(i, title, caption, dy) {
      var g = s('g', { transform: 'translate(' + (i % 2) * (PW + GAP) + ' ' + Math.floor(i / 2) * (PH + GAP) + ')' });
      g.appendChild(s('rect', { x: 1, y: 1, width: PW - 2, height: PH - 2, rx: 6, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 1.5 }));
      g.appendChild(t(18, 32, title, { fs: 24, bold: true, anchor: 'start' }));
      g.appendChild(t(18, PH - 16, caption, { fs: 18, anchor: 'start' }));
      svg.appendChild(g);
      return g.appendChild(s('g', { transform: 'translate(0 ' + dy + ')' }));
    }

    // 1 Origin: many clients, one long crossing, one machine
    var g = panel(0, 'Origin server', 'Every request crosses the Internet to one far-away machine.', 20);
    [70, 135, 200].forEach(function (y) { client(g, 50, y - 14); g.appendChild(arrow(82, y, 168, 150 + (y - 135) / 3, 'blue')); });
    g.appendChild(s('rect', { x: 170, y: 105, width: 340, height: 90, rx: 45, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2, 'stroke-dasharray': '7 6' }));
    g.appendChild(t(340, 145, 'Internet', { fs: 19, bold: true, fill: 'var(--muted)' }));
    g.appendChild(t(340, 168, 'far away: long RTT', { fs: 15, fill: 'var(--muted)' }));
    g.appendChild(arrow(512, 150, 552, 150, 'blue', { w: 5 }));
    server(g, 580, 125, 'one machine');

    // 2 Proxy: A misses (fetched once, stored), B hits (served locally)
    g = panel(1, 'Web proxy cache', 'Near the clients: a hit is served here, a miss fetched once.', 20);
    g.appendChild(s('rect', { x: 14, y: 46, width: 300, height: 196, rx: 8, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '5 5' }));
    g.appendChild(t(300, 64, 'campus / ISP: near', { fs: 14, fill: 'var(--muted)', anchor: 'end' }));
    client(g, 54, 80, 'A');
    client(g, 54, 172, 'B');
    box(g, 170, 116, 120, 64, ['Proxy', 'cache'], 'accent');
    g.appendChild(arrow(84, 98, 166, 132, 'amber'));
    g.appendChild(t(120, 100, 'miss', { fs: 15, bold: true, fill: 'var(--amber)', anchor: 'start' }));
    g.appendChild(arrow(84, 190, 166, 164, 'green', { both: true }));
    g.appendChild(t(110, 214, 'hit: served here', { fs: 15, bold: true, fill: 'var(--green)', anchor: 'start' }));
    g.appendChild(arrow(294, 140, 552, 140, 'amber', { both: true }));
    g.appendChild(t(424, 128, 'fetch once, keep a copy', { fs: 15, bold: true, fill: 'var(--amber)' }));
    g.appendChild(t(424, 166, 'still fresh? conditional GET', { fs: 14, fill: 'var(--muted)' }));
    g.appendChild(t(424, 185, '→ 304 Not Modified', { fs: 14, fill: 'var(--muted)' }));
    server(g, 580, 115, 'origin');

    // 3 Farm: one address, the front end sends each client to a different server
    g = panel(2, 'Server farm', 'One address, many servers: the front end spreads the requests.', 20);
    var FC = ['blue', 'amber', 'green'];
    FC.forEach(function (c, k) { var y = 70 + k * 65; client(g, 50, y - 14, null, c); g.appendChild(arrow(82, y, 238, 140 + (k - 1) * 16, c)); });
    box(g, 242, 104, 130, 76, ['Front end', 'load balancer'], 'accent');
    g.appendChild(t(307, 96, 'one public address', { fs: 14, fill: 'var(--muted)' }));
    [0, 1, 2, 3].forEach(function (k) {
      var y = 34 + k * 64, c = k < 3 ? FC[k] : 'muted';
      server(g, 520, y, null, k < 3 ? FC[k] : 'ink', k === 3);
      g.appendChild(t(546, y + 31, 'server ' + (k + 1) + (k < 3 ? '' : ': idle'), { fs: 15, bold: k < 3, fill: 'var(--' + c + ')', anchor: 'start' }));
      if (k < 3) g.appendChild(arrow(374, 140 + (k - 1) * 16, 498, y + 25, FC[k]));
    });

    // 4 CDN: (1) DNS gives each client its nearest edge, (2) the GET goes there; the origin fills the edges
    g = panel(3, 'CDN', 'DNS sends each client to its nearest edge, which holds a copy.', 0);
    client(g, 50, 50, 'region 1');
    client(g, 50, 212, 'region 2');
    box(g, 14, 140, 72, 36, ['DNS'], 'blue');
    g.appendChild(arrow(50, 112, 50, 136, 'blue', { both: true, w: 2.5 }));
    g.appendChild(arrow(50, 180, 50, 206, 'blue', { both: true, w: 2.5 }));
    g.appendChild(t(98, 152, '① name →', { fs: 15, bold: true, fill: 'var(--blue)', anchor: 'start' }));
    g.appendChild(t(98, 172, 'nearest edge', { fs: 15, bold: true, fill: 'var(--blue)', anchor: 'start' }));
    [[66, 'edge 1'], [228, 'edge 2']].forEach(function (e) {
      g.appendChild(arrow(84, e[0], 290, e[0], 'green', { both: true }));
      g.appendChild(t(186, e[0] - 10, '② GET', { fs: 15, bold: true, fill: 'var(--green)' }));
      server(g, 320, e[0] - 25, null, 'green');
      g.appendChild(t(350, e[0] - 4, e[1], { fs: 17, bold: true, fill: 'var(--green)', anchor: 'start' }));
      g.appendChild(t(350, e[0] + 16, 'a copy', { fs: 14, fill: 'var(--muted)', anchor: 'start' }));
      g.appendChild(arrow(546, 158, 420, e[0] + (e[0] < 158 ? 14 : -14), 'muted', { dash: '7 6', w: 2.5 }));
    });
    g.appendChild(t(470, 150, 'fills', { fs: 14, fill: 'var(--muted)' }));
    server(g, 580, 128, 'origin');
    g.appendChild(t(580, 218, 'rarely asked', { fs: 15, fill: 'var(--muted)' }));
    return {};
  }

  // 22e: head-of-line blocking (CN.http.hol). Two stacked lanes share one timing: the same packets, the same loss,
  // the same resend at step 7; HTTP/2 hands bytes to the app in TCP order, HTTP/3 per QUIC stream. Tap a packet
  // on the server side to lose that one instead (tap the lost one again: no loss). Motion: each Step glides the
  // new packet across; with A off the same state is drawn without it.
  var HOL_C = { css: 'blue', js: 'amber', png: 'accent' }, HOL_NAME = { css: 'style.css', js: 'app.js', png: 'logo.png' };
  function hol(body) {
    var W = 1300, LANE = 250, H = 2 * LANE + 10, CX = 214, CW = 54, CG = 6, PX0 = 590, PX1 = 790, RX = 812, SX = 935, SW = 62;
    var hLose = ui.handle({ key: 'lose', kind: 'tap', value: 1 });
    var st = { k: 0, m: null }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'One page, three objects, one packet lost. Tap a server-side packet to lose that one instead.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    var LANES = [
      { key: 'tcp', name: 'HTTP/2', over: 'over TCP', pipe: 'one TCP connection', rule: 'TCP: in byte order' },
      { key: 'quic', name: 'HTTP/3', over: 'over QUIC (UDP 443)', pipe: 'one QUIC connection', rule: 'QUIC: in order per stream' }];
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'start' }, str);
    }
    function chipX(i) { return CX + i * (CW + CG); }
    function rowY(y0, si) { return y0 + 62 + si * 58; }
    function slotX(n) { return SX + (n - 1) * (SW + 8); }
    // one packet: a rounded tile in its stream colour; fill = delivered to the app, dashed = arrived but held
    function pkt(x, y, w, p, how) {
      var c = HOL_C[p.s], g = s('g');
      g.appendChild(s('rect', { x: x, y: y, width: w, height: 36, rx: 6, fill: how === 'held' ? 'var(--panel)' : 'var(--' + c + '-bg)',
        stroke: 'var(--' + c + ')', 'stroke-width': 2.5, 'stroke-dasharray': how === 'held' ? '6 4' : null }));
      g.appendChild(t(x + w / 2, y + 24, p.s + ' ' + p.n, { fs: 15, bold: true, fill: 'var(--' + c + ')', anchor: 'middle' }));
      return g;
    }
    // a glide from (dx, dy) back to where the element is drawn; only on the Step that caused it
    function fly(el, dx, dy, cls) {
      if (!fresh || !cls) return el;
      el.setAttribute('class', cls);
      el.setAttribute('style', '--dx:' + dx + 'px;--dy:' + dy + 'px');
      return el;
    }
    function draw() {
      CN.clear(svg);
      var m = st.m, k = st.k, lostP = m.lost == null ? null : m.order[m.lost];
      svg.appendChild(t(W - 6, 24, 'step ' + k + ' of ' + m.end, { fs: 18, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      svg.appendChild(s('line', { x1: 0, y1: LANE + 4, x2: W, y2: LANE + 4, stroke: 'var(--line)', 'stroke-width': 1.5 }));
      LANES.forEach(function (L, li) {
        var y0 = li * (LANE + 10), at = m[L.key], cy = y0 + 120;
        svg.appendChild(t(6, y0 + 40, L.name, { fs: 30, bold: true }));
        svg.appendChild(t(6, y0 + 66, L.over, { fs: 18, fill: 'var(--muted)' }));
        svg.appendChild(t(6, y0 + 210, L.rule, { fs: 16, bold: true, fill: 'var(--muted)' }));
        // server side: the six packets in send order (one per step); the lost one is the tap target
        svg.appendChild(t(CX, y0 + 88, 'Server sends, interleaved', { fs: 15, fill: 'var(--muted)' }));
        m.order.forEach(function (p, i) {
          var sent = k >= i + 1, isLost = i === m.lost, resent = isLost && k >= m.resend;
          var g = pkt(chipX(i), cy - 18, CW, p, null);
          g.setAttribute('opacity', sent && !(isLost && !resent) ? 0.3 : 1);
          if (isLost) g.appendChild(t(chipX(i) + CW / 2, cy + 40, resent ? '↻ resent' : sent ? '✕ lost' : 'to be lost', { fs: 14, bold: true, fill: 'var(--red)', anchor: 'middle' }));
          g.setAttribute('class', 'clickable');
          g.addEventListener('click', function () { hLose.set(isLost ? null : i); });
          svg.appendChild(g);
        });
        // the connection: one pipe for all three streams
        svg.appendChild(s('rect', { x: PX0, y: cy - 30, width: PX1 - PX0, height: 60, rx: 30, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '7 6' }));
        svg.appendChild(t((PX0 + PX1) / 2, cy + 52, L.pipe, { fs: 15, fill: 'var(--muted)', anchor: 'middle' }));
        if (lostP && k >= m.lost + 1 && k < m.resend) {
          var mx = (PX0 + PX1) / 2 - 26, lg = pkt(mx, cy - 18, 52, lostP, null);
          lg.setAttribute('opacity', 0.45);
          lg.appendChild(t(mx + 26, cy - 24, '✕', { fs: 26, bold: true, fill: 'var(--red)', anchor: 'middle' }));
          svg.appendChild(fly(lg, chipX(m.lost) - mx, 0, k === m.lost + 1 ? 'h3-fly' : null));
        }
        // browser side: one row per object, a slot per frame
        svg.appendChild(t(RX, y0 + 40, 'Browser gets', { fs: 15, fill: 'var(--muted)' }));
        CN.http.HOL_STREAMS.forEach(function (sn, si) {
          var ry = rowY(y0, si), c = HOL_C[sn];
          svg.appendChild(t(RX, ry + 6, HOL_NAME[sn], { fs: 17, bold: true, fill: 'var(--' + c + ')' }));
          var held = false;
          [1, 2].forEach(function (n) {
            var i = m.order.findIndex(function (p) { return p.s === sn && p.n === n; }), x = slotX(n), p = m.order[i];
            svg.appendChild(s('rect', { x: x, y: ry - 18, width: SW, height: 36, rx: 6, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }));
            if (k < m.arrive[i]) return;
            var how = k >= at[i] ? 'got' : 'held';
            if (how === 'held') held = true;
            var g = pkt(x, ry - 18, SW, p, how);
            // arrives this Step: glide in from its server-side tile; released this Step: a soft pop
            if (k === m.arrive[i]) fly(g, chipX(i) - x, cy - ry, 'h3-fly');
            else if (k === at[i]) fly(g, 0, 0, 'h3-pop');
            svg.appendChild(g);
          });
          var d = m.done[L.key][sn];
          if (k >= d) {
            var faster = L.key === 'quic' && d < m.done.tcp[sn];
            svg.appendChild(fly(t(SX + 2 * SW + 30, ry + 6, 'done · step ' + d, { fs: 18, bold: true, fill: faster ? 'var(--green)' : null }), 0, 0, k === d ? 'h3-pop' : null));
          } else if (held) {
            svg.appendChild(t(SX + 2 * SW + 30, ry + 6, 'held: waits for ' + lostP.s + ' ' + lostP.n, { fs: 16, bold: true, fill: 'var(--red)' }));
          }
        });
      });
      fresh = false;
    }
    function step() { if (st.k >= st.m.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = CN.http.hol(hLose.value()); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // learnStep: the Step (the pane's table follows the lost packet through genText)
    return { step: step, reset: reset, reached: function () { return st.k >= st.m.end; }, learnStep: function () { return st.k; },
      genText: function () { var v = hLose.value(); return 'lose ' + (v == null ? 'none' : v); },
      prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  // 22f BitTorrent swarm (CN.http.swarm). Seed on top, the four peers in a row; the seed's uploads come down as
  // straight arrows, peer-to-peer uploads are arcs under the row. Step 1 is A asking the tracker; each later Step
  // is one round. The right column counts the copies of each chunk (what rarest-first ranks) and logs the round.
  // Handle: tap a peer's chunk to give it or take it away.
  var CHUNK_C = ['blue', 'amber', 'accent', 'green'];
  function swarm(body) {
    var W = 1300, H = 600, BW = 220, BH = 104, PY = 300, SX = 480, SY = 70, CS = 40, CG = 8, PX = { S: SX };
    var P = CN.http.PEERS, NC = CN.http.CHUNKS;
    P.forEach(function (p, i) { PX[p] = 130 + i * 240; });
    var hHave = ui.handle({ key: 'have', kind: 'tap', value: CN.http.SWARM_HAVE });
    var st = { k: 0, m: null }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Each round every peer asks for its rarest missing chunk; a node uploads at most 1 and downloads at most 1. Tap a peer\'s chunk to add or remove it.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'start' }, str);
    }
    function col(c) { return 'var(--' + CHUNK_C[c] + ')'; }
    function tile(x, y, c, held, sz) {
      var g = s('g');
      g.appendChild(s('rect', { x: x, y: y, width: sz, height: sz, rx: 6, fill: held ? 'var(--' + CHUNK_C[c] + '-bg)' : 'var(--panel)',
        stroke: held ? col(c) : 'var(--line)', 'stroke-width': held ? 2.5 : 1.5, 'stroke-dasharray': held ? null : '4 4' }));
      g.appendChild(t(x + sz / 2, y + sz / 2 + 6, String(c), { fs: 17, bold: held, fill: held ? col(c) : 'var(--muted)', anchor: 'middle' }));
      return g;
    }
    function pop(el) { if (fresh) el.setAttribute('class', (el.getAttribute('class') ? el.getAttribute('class') + ' ' : '') + 'h3-pop'); return el; }
    function toggle(p, c) {
      var v = JSON.parse(JSON.stringify(hHave.value())), a = v[p] || [];
      v[p] = a.indexOf(c) >= 0 ? a.filter(function (x) { return x !== c; }) : a.concat(c).sort();
      hHave.set(v);
    }
    function have(k) { return k < 2 ? st.m.start : st.m.rounds[k - 2].have; }
    function node(n, x, y, held, got) {
      var g = s('g'), seed = n === 'S', done = !seed && held.length === NC;
      g.appendChild(s('rect', { x: x - BW / 2, y: y - BH / 2, width: BW, height: BH, rx: 10, fill: 'var(--panel)', stroke: done || seed ? 'var(--green)' : 'var(--line)', 'stroke-width': done || seed ? 3 : 2 }));
      g.appendChild(t(x - BW / 2 + 14, y - BH / 2 + 30, seed ? 'S' : n, { fs: 26, bold: true }));
      g.appendChild(t(x - BW / 2 + 44, y - BH / 2 + 28, seed ? 'seed · whole file' : done ? 'complete' : 'peer', { fs: 16, bold: done, fill: done ? 'var(--green)' : 'var(--muted)' }));
      for (var c = 0; c < NC; c++) {
        var cx = x - BW / 2 + 14 + c * (CS + CG), sq = tile(cx, y - 2, c, seed || held.indexOf(c) >= 0, CS);
        if (!seed) {
          sq.setAttribute('class', 'clickable');
          sq.addEventListener('click', (function (cc) { return function () { toggle(n, cc); }; })(c));
        }
        if (got && got.indexOf(c) >= 0) pop(sq);
        g.appendChild(sq);
      }
      return g;
    }
    function draw() {
      CN.clear(svg);
      var m = st.m, k = st.k, r = k >= 2 ? m.rounds[k - 2] : null, hv = have(k);
      var defs = s('defs');
      CHUNK_C.concat('muted').forEach(function (cn) {
        defs.appendChild(s('marker', { id: 'ah22f-' + cn, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--' + cn + ')' })));
      });
      svg.appendChild(defs);
      // the tracker; step 1 draws A's question and its answer
      svg.appendChild(s('rect', { x: 20, y: 22, width: 200, height: 70, rx: 10, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }));
      svg.appendChild(t(120, 52, 'tracker', { fs: 22, bold: true, anchor: 'middle' }));
      svg.appendChild(t(120, 78, 'knows the swarm', { fs: 15, fill: 'var(--muted)', anchor: 'middle' }));
      if (k === 1) {
        var ay = PY - BH / 2;
        svg.appendChild(pop(s('line', { x1: PX.A - 30, y1: ay, x2: PX.A - 30, y2: 98, stroke: 'var(--muted)', 'stroke-width': 3, 'stroke-dasharray': '6 5', 'marker-end': 'url(#ah22f-muted)' })));
        svg.appendChild(pop(s('line', { x1: PX.A + 30, y1: 94, x2: PX.A + 30, y2: ay - 4, stroke: 'var(--muted)', 'stroke-width': 3, 'stroke-dasharray': '6 5', 'marker-end': 'url(#ah22f-muted)' })));
        svg.appendChild(t(PX.A - 40, 150, 'who is in', { fs: 15, bold: true, anchor: 'end' }));
        svg.appendChild(t(PX.A - 40, 170, 'the swarm?', { fs: 15, bold: true, anchor: 'end' }));
        svg.appendChild(t(PX.A + 40, 160, 'S, B, C, D', { fs: 15, bold: true }));
      }
      // this round's uploads, drawn under the nodes so the tiles stay on top
      var got = {};
      if (r) r.xfers.forEach(function (x) {
        got[x.to] = (got[x.to] || []).concat(x.c);
        var c = col(x.c), lbl;
        if (x.from === 'S') {
          var x1 = SX + (PX[x.to] - SX) * 0.12, y1 = SY + BH / 2, x2 = PX[x.to], y2 = PY - BH / 2 - 4;
          svg.appendChild(pop(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: c, 'stroke-width': 3.5, 'marker-end': 'url(#ah22f-' + CHUNK_C[x.c] + ')' })));
          lbl = [(x1 + x2) / 2, (y1 + y2) / 2];
        } else {
          // arcs under the row: out of a box's left side, into its right side (≤ 1 each per node, so no two ends meet);
          // right-to-left ones run a little deeper so a swap's two arcs stay apart
          var a = PX[x.from], b = PX[x.to], span = Math.abs(P.indexOf(x.from) - P.indexOf(x.to)), rtl = b < a;
          var ya = PY + BH / 2, dep = 50 + 40 * span + (rtl ? 34 : 0), sx = a - 36, ex = b + 36;
          svg.appendChild(pop(s('path', { d: 'M ' + sx + ' ' + ya + ' Q ' + (sx + ex) / 2 + ' ' + (ya + 2 * dep) + ' ' + ex + ' ' + (ya + 4),
            fill: 'none', stroke: c, 'stroke-width': 3.5, 'marker-end': 'url(#ah22f-' + CHUNK_C[x.c] + ')' })));
          lbl = [(sx + ex) / 2, ya + dep];
        }
        svg.appendChild(pop(tile(lbl[0] - 15, lbl[1] - 15, x.c, true, 30)));
      });
      svg.appendChild(node('S', SX, SY, [], null));
      P.forEach(function (p) { svg.appendChild(node(p, PX[p], PY, hv[p], got[p])); });
      // right column: copies of each chunk now (what the next round ranks), then the log
      var RX = 1010, ranks = [], end = k >= m.end;
      for (var c = 0; c < NC; c++) ranks.push(1 + P.filter(function (p) { return hv[p].indexOf(c) >= 0; }).length);
      var low = Math.min.apply(null, ranks);
      svg.appendChild(t(W - 6, 24, 'step ' + k + ' of ' + m.end, { fs: 18, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      svg.appendChild(t(RX, 52, 'Copies now', { fs: 18, bold: true }));
      if (!end) svg.appendChild(t(RX, 72, 'the next round ranks these', { fs: 14, fill: 'var(--muted)' }));
      ranks.forEach(function (n, c) {
        var y = 84 + c * 42;
        svg.appendChild(tile(RX, y, c, true, 32));
        for (var d = 0; d < 5; d++) svg.appendChild(s('circle', { cx: RX + 52 + d * 22, cy: y + 16, r: 8, fill: d < n ? col(c) : 'none', stroke: d < n ? col(c) : 'var(--line)', 'stroke-width': 1.5 }));
        svg.appendChild(t(RX + 166, y + 22, String(n), { fs: 18, bold: true }));
        if (n === low && low < 5) svg.appendChild(t(RX + 186, y + 22, '← rarest', { fs: 16, bold: true, fill: 'var(--red)' }));
      });
      var lines;
      if (k === 0) lines = [['The seed S has the whole file.', null], ['A–D hold some chunks each.', null]];
      else if (k === 1) lines = [['A asks the tracker who is', null], ['in the swarm: S, B, C, D.', null]];
      else {
        lines = [['Round ' + (k - 1), 'bold']];
        r.xfers.forEach(function (x) { lines.push([x.from + ' → ' + x.to + ': chunk ' + x.c + (x.rarest ? ' (rarest)' : ' (rarer one busy)'), CHUNK_C[x.c]]); });
        r.blocked.forEach(function (p) { lines.push([p + ': every holder busy, waits', 'muted']); });
      }
      if (end) lines.push(['All complete. The seed sent ' + m.sent.S, 'bold'], ['of ' + P.reduce(function (n, p) { return n + m.sent[p]; }, m.sent.S) + ' chunks; the peers the rest.', 'bold']);
      lines.forEach(function (ln, i) {
        svg.appendChild(t(RX, 290 + i * 28, ln[0], { fs: 16, bold: !!ln[1] && ln[1] !== 'muted', fill: ln[1] && ln[1] !== 'bold' ? 'var(--' + ln[1] + ')' : null }));
      });
      fresh = false;
    }
    function step() { if (st.k >= st.m.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = CN.http.swarm(hHave.value()); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // learnStep: the Step (the pane's table follows the chunks tapped through genText)
    return { step: step, reset: reset, reached: function () { return st.k >= st.m.end; }, learnStep: function () { return st.k; },
      genText: function () { var v = hHave.value(); return 'have ' + P.map(function (p) { return p + (v[p] || []).join(''); }).join(' '); },
      prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  var CARDS = [
        ['Request / response', function () {
          var t = h('table', { class: 't' }, h('tr', null, h('th', null, 'Class'), h('th', null, 'Meaning'), h('th', null, 'Examples')));
          CN.http.STATUS.forEach(function (r) { t.appendChild(h('tr', null, h('td', null, h('b', null, r[0])), h('td', null, r[1]), h('td', null, r[2]))); });
          return h('div', { class: 'col' },
            h('div', null, h('b', null, 'Methods: '), 'GET (fetch), HEAD (headers only), POST (send data), PUT (store), DELETE, OPTIONS.'),
            h('div', null, h('b', null, 'Request: '), 'method path version, headers (Host: required in 1.1), blank line, body. ', h('b', null, 'Response: '), 'status line, headers, blank line, body.'), t);
        }],
        ['HTTP/2 and HTTP/3', function () {
          return h('div', { class: 'col' },
            h('div', null, h('b', null, 'HTTP/2: '), 'many request streams multiplexed over ONE TCP connection, binary frames, header compression, server push. But TCP delivers bytes in order: one lost segment stalls every stream (head-of-line blocking).'),
            h('div', null, h('b', null, 'HTTP/3: '), 'runs over QUIC on UDP port 443. QUIC does reliability per stream, so a lost packet blocks only its own stream, and it merges the transport and TLS handshakes.'),
            h('div', { class: 'muted' }, 'That\'s what the buses on the stop-20 road are: UDP 443.'));
        }]
  ];

  function cardSlide(body, i) {
    body.appendChild(h('div', { class: 'panel col card-slide', style: { gap: '18px', fontSize: '28px', padding: '30px', marginTop: '20px' } }, CARDS[i][1]()));
    return {};
  }

  var PARTS = {
    request: request, rtts: roundTrips, scale: scale,
    methods: function (body) { return cardSlide(body, 0); },
    http2: hol,
    p2p: swarm
  };

  CN.screens.t22 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
