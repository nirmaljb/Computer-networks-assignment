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

  function request(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '14px', fontSize: '30px', padding: '30px', marginTop: '30px' } },
      h('div', null, h('b', null, 'URL  '), h('span', { class: 'mono' }, 'http://www.example.com/index.html')),
      h('div', { class: 'muted' }, 'scheme · host (→ DNS, stop 21) · path. TCP to port 80 (443 for HTTPS).'),
      h('div', { class: 'mono', style: { marginTop: '16px' } }, 'GET /index.html HTTP/1.1'), h('div', { class: 'mono' }, 'Host: www.example.com'),
      h('div', { class: 'mono ok', style: { marginTop: '12px' } }, 'HTTP/1.1 200 OK'), h('div', { class: 'mono' }, 'Content-Type: text/html')));
    return {};
  }

  function roundTrips(body) {
    var st = { n: 10, rtt: 100 }, W = 1300, LANE = 120;
    var svg = s('svg', { width: W, height: 3 * LANE + 50, viewBox: '0 0 ' + W + ' ' + (3 * LANE + 50) });
    body.appendChild(h('div', { class: 'say' }, 'A page of 1 HTML + 10 images, RTT 100 ms; transmission time ignored (as in Kurose & Ross).'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px', alignSelf: 'flex-start' } }, svg));
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
    body.appendChild(ui.controls(step, reset));
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
