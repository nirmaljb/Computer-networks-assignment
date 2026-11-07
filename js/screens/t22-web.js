(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 22a URL + request (static), 22b page-load round trips for the three HTTP/1.x styles
  // (CN.http, 1 HTML + 10 images, RTT 100 ms, static), 22c the scale strip (Step), then three static cards.
  var MODES = [['nonpersistent', 'Non-persistent', 'new connection per object'],
    ['persistent', 'Persistent', 'one connection, 1 request at a time'],
    ['pipelined', 'Persistent + pipelining', 'all image requests back to back']];
  var SCALE = [
    ['Origin server', 'One machine far away: every request crosses the internet (high RTT).'],
    ['Web proxy cache', 'Near the clients (a campus or ISP). Hit: served locally. Miss: fetched once from the origin, then cached. A conditional GET (If-Modified-Since) gets 304 Not Modified if the copy is still good.'],
    ['Server farm', 'Many servers behind one front end: a load balancer (or DNS) spreads requests, so one site handles millions of users.'],
    ['CDN', 'Copies on edge nodes all over the world. DNS (stop 21) returns the nearest edge\'s address, so the RTT is short and the origin is rarely asked.']
  ];

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
    return { step: step, reset: reset, prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; },
      reached: function () { return st.k >= 2; } };
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

  function scale(body) {
    var at = 0, row = h('div', { class: 'row nowrap', style: { gap: '10px', marginTop: '30px' } }), text = h('div', { class: 'panel', style: { fontSize: '30px', padding: '28px', minHeight: '150px' } });
    body.appendChild(row);
    body.appendChild(text);
    function draw() {
      CN.clear(row);
      SCALE.forEach(function (b, i) {
        if (i) row.appendChild(h('span', { style: { fontSize: '34px', color: 'var(--muted)' } }, '→'));
        row.appendChild(h('div', { class: 'panel', style: { flex: '1', textAlign: 'center', fontSize: '28px', fontWeight: 700, padding: '18px',
          borderColor: i === at ? 'var(--accent)' : null, background: i === at ? 'var(--accent-bg)' : null, opacity: i > at ? 0.35 : 1 } }, b[0]));
      });
      CN.clear(text).appendChild(h('span', null, h('b', null, SCALE[at][0] + ': '), SCALE[at][1]));
    }
    draw();
    function step() { if (at >= SCALE.length - 1) return false; at++; draw(); return true; }
    function reset() { at = 0; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset, prev: function () { if (at > 0) { at--; draw(); return true; } return false; } };
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
        }],
        ['P2P: BitTorrent', function () {
          return h('div', { class: 'col' },
            h('div', null, 'No server holds the file for everyone. A ', h('b', null, 'torrent'), ' file lists the chunks (with hashes) and a ', h('b', null, 'tracker'), ' that knows which peers are in the swarm.'),
            h('div', null, 'Peers download chunks from each other, rarest first, and upload what they have. ', h('b', null, 'Tit-for-tat: '), 'a peer uploads to the peers that upload to it most (plus one random "optimistic unchoke").'),
            h('div', null, h('b', null, 'DHT: '), 'a distributed hash table spread over the peers can replace the tracker.'),
            h('div', { class: 'muted' }, 'The more people want a file, the more capacity there is to serve it.'));
        }]
  ];

  function cardSlide(body, i) {
    body.appendChild(h('div', { class: 'panel col card-slide', style: { gap: '18px', fontSize: '28px', padding: '30px', marginTop: '20px' } }, CARDS[i][1]()));
    return {};
  }

  var PARTS = {
    request: request, rtts: roundTrips, scale: scale,
    methods: function (body) { return cardSlide(body, 0); },
    http2: function (body) { return cardSlide(body, 1); },
    p2p: function (body) { return cardSlide(body, 2); }
  };

  CN.screens.t22 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
