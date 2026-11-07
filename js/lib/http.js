/* Page-load round trips (SPEC-v4 §4.22), counted as in Kurose & Ross: transmission time
   ignored, one connection at a time. A page = 1 HTML file + n embedded objects. Each
   connection costs 1 RTT to set up (SYN, SYN+ACK; the ACK rides with the request). */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  // Timeline in RTT units: [{ obj, conn: [t0, t1] | null, req: [t0, t1] }].
  function plan(n, mode) {
    var rows = [], t = 0, i;
    if (mode === 'nonpersistent') {
      for (i = 0; i <= n; i++) { rows.push({ obj: i, conn: [t, t + 1], req: [t + 1, t + 2] }); t += 2; }
    } else if (mode === 'persistent') {
      rows.push({ obj: 0, conn: [0, 1], req: [1, 2] }); t = 2;
      for (i = 1; i <= n; i++) { rows.push({ obj: i, conn: null, req: [t, t + 1] }); t += 1; }
    } else {
      // pipelined: the HTML first (its links aren't known before), then every request back to back
      rows.push({ obj: 0, conn: [0, 1], req: [1, 2] }); t = 2;
      for (i = 1; i <= n; i++) rows.push({ obj: i, conn: null, req: [t, t + 1] });
      if (n > 0) t += 1;
    }
    return { rows: rows, rtts: t };
  }
  function rtts(n, mode) { return plan(n, mode).rtts; }

  var STATUS = [
    ['1xx', 'Information', '100 Continue'],
    ['2xx', 'Success', '200 OK, 204 No Content'],
    ['3xx', 'Redirection', '301 Moved Permanently, 304 Not Modified'],
    ['4xx', 'Client error', '403 Forbidden, 404 Not Found'],
    ['5xx', 'Server error', '500 Internal Server Error, 503 Service Unavailable']
  ];

  // 22a: a URL taken apart, and the request and response it turns into. Only the three demo URLs are
  // served (an http page, the same page over https, and an image on a non-default port).
  var URLS = ['http://www.example.com/index.html', 'https://www.example.com/index.html', 'http://www.example.com:8080/a/b.png'];
  var PORT = { http: 80, https: 443 };
  var PAGE = ['<html><body><h1>Hello</h1>', '<img src="logo.png"> <img src="cat.jpg">', '</body></html>'];
  var PNG_BYTES = 2048;

  // scheme://host[:port]path → the pieces in order, so the figure can colour each one
  function url(u) {
    var m = /^(https?):\/\/([a-z0-9.-]+)(?::(\d+))?(\/.*)$/.exec(u);
    if (!m) return { error: 'Not a URL this slide knows' };
    var explicit = m[3] != null, port = explicit ? +m[3] : PORT[m[1]];
    var parts = [{ k: 'scheme', t: m[1] }, { k: 'sep', t: '://' }, { k: 'host', t: m[2] }];
    if (explicit) parts.push({ k: 'port', t: ':' + m[3] });
    parts.push({ k: 'path', t: m[4] });
    return { scheme: m[1], host: m[2], port: port, explicit: explicit, path: m[4], parts: parts };
  }

  // The exchange for one URL. Host: carries the port only when it isn't the scheme's default (RFC 9110 §7.2).
  // https: the same request and response, sent inside TLS after a TLS handshake.
  function exchange(u, addrFor) {
    var p = url(u);
    if (p.error) return p;
    var host = p.host + (p.port !== PORT[p.scheme] ? ':' + p.port : ''), png = /\.png$/.test(p.path);
    var body = png ? null : PAGE.join('\n');
    return {
      url: p, ip: addrFor ? addrFor(p.host) : null, tls: p.scheme === 'https',
      request: ['GET ' + p.path + ' HTTP/1.1', 'Host: ' + host], hostHeader: host,
      response: ['HTTP/1.1 200 OK', 'Content-Type: ' + (png ? 'image/png' : 'text/html'),
        'Content-Length: ' + (png ? PNG_BYTES : new TextEncoder().encode(body).length)],
      body: png ? { kind: 'png', bytes: PNG_BYTES } : { kind: 'html', lines: PAGE.slice(), objects: ['logo.png', 'cat.jpg'] }
    };
  }

  // 22e head-of-line blocking. Three page objects, two frames each, sent interleaved one per step (steps 1–6).
  // lost = the index of the one packet lost (null: none); it is resent at step 7 in both lanes, so the only
  // difference is the delivery rule. tcp (HTTP/2): a packet reaches the app once it and every packet before it
  // in the byte stream have arrived. quic (HTTP/3): once it and the earlier packets of its own stream have.
  var HOL_STREAMS = ['css', 'js', 'png'];
  function hol(lost) {
    var order = [];
    [1, 2].forEach(function (n) { HOL_STREAMS.forEach(function (st) { order.push({ s: st, n: n }); }); });
    var resend = lost == null ? null : order.length + 1;
    var arrive = order.map(function (p, i) { return i === lost ? resend : i + 1; });
    function deliver(sameStream) {
      return order.map(function (p, i) {
        var t = arrive[i];
        for (var j = 0; j < i; j++) if (!sameStream || order[j].s === p.s) t = Math.max(t, arrive[j]);
        return t;
      });
    }
    function done(at) {
      var d = {};
      HOL_STREAMS.forEach(function (st) { d[st] = Math.max.apply(null, order.map(function (p, i) { return p.s === st ? at[i] : 0; })); });
      return d;
    }
    var tcp = deliver(false), quic = deliver(true);
    return { order: order, lost: lost, resend: resend, arrive: arrive, tcp: tcp, quic: quic,
      done: { tcp: done(tcp), quic: done(quic) }, end: resend || order.length };
  }

  // 22f BitTorrent swarm. The seed S holds all CHUNKS; have = { A: [chunks], … } for the four peers. Step 1: A asks
  // the tracker for the swarm. Each later step is one round: every peer (A → D) asks for its rarest missing chunk
  // (fewest copies among S + peers at the round's start, tie → lower number) from a holder whose one upload slot is
  // still free (peers A → D before the seed). If every holder of that chunk is busy it tries its next-rarest one.
  // Each node uploads at most 1 and downloads at most 1 chunk per round; the chunks land at the round's end.
  var PEERS = ['A', 'B', 'C', 'D'], CHUNKS = 4, SWARM_HAVE = { A: [0], B: [0, 1], C: [0], D: [0, 2] };
  function swarm(have) {
    var cur = {}, all = [], rounds = [];
    for (var c = 0; c < CHUNKS; c++) all.push(c);
    PEERS.forEach(function (p) { cur[p] = (have[p] || []).filter(function (c) { return c >= 0 && c < CHUNKS; }).sort(); });
    function holds(n, c) { return n === 'S' || cur[n].indexOf(c) >= 0; }
    function full() { return PEERS.every(function (p) { return cur[p].length === CHUNKS; }); }
    while (!full()) {
      var copies = all.map(function (c) { return 1 + PEERS.filter(function (p) { return holds(p, c); }).length; });
      var busy = {}, xfers = [], blocked = [];
      PEERS.forEach(function (p) {
        var want = all.filter(function (c) { return !holds(p, c); }).sort(function (a, b) { return copies[a] - copies[b] || a - b; });
        if (!want.length) return;
        for (var i = 0; i < want.length; i++) {
          var from = PEERS.concat('S').filter(function (n) { return n !== p && holds(n, want[i]) && !busy[n]; })[0];
          if (from) { busy[from] = true; xfers.push({ from: from, to: p, c: want[i], rarest: i === 0 }); return; }
        }
        blocked.push(p);
      });
      xfers.forEach(function (x) { cur[x.to] = cur[x.to].concat(x.c).sort(); });
      var snap = {};
      PEERS.forEach(function (p) { snap[p] = cur[p].slice(); });
      rounds.push({ copies: copies, xfers: xfers, blocked: blocked, have: snap });
    }
    var sent = { S: 0 };
    PEERS.forEach(function (p) { sent[p] = 0; });
    rounds.forEach(function (r) { r.xfers.forEach(function (x) { sent[x.from]++; }); });
    var start = {};
    PEERS.forEach(function (p) { start[p] = (have[p] || []).filter(function (c) { return c >= 0 && c < CHUNKS; }).sort(); });
    return { start: start, rounds: rounds, end: 1 + rounds.length, sent: sent,
      copies: all.map(function (c) { return 1 + PEERS.filter(function (p) { return start[p].indexOf(c) >= 0; }).length; }) };
  }

  // 23a the mail path. Nodes: 0 Alice's user agent, 1 Alice's MTA (one.example.com), 2 Bob's MTA (two.example.com),
  // 3 Bob's mailbox (on that server), 4 Bob's user agent. Step 1 submits with SMTP; step 2 Alice's MTA asks DNS for the
  // MX record of the domain after @; step 3 pushes MTA to MTA (SMTP, TCP 25); step 4 files it in the mailbox. Bob
  // online: step 5 his user agent pulls it with IMAP and a copy stays on the server. Bob offline: step 5 the mail waits
  // (SMTP can't push to a machine that is off); step 6 Bob connects and pulls.
  var MAIL_NODES = ['Alice\'s user agent', 'Alice\'s MTA', 'Bob\'s MTA', 'Bob\'s mailbox', 'Bob\'s user agent'];
  function mailPath(online) {
    var steps = [
      { at: 0, hop: null, say: 'Alice writes to bob@two.example.com and presses Send.' },
      { at: 1, hop: [0, 1], proto: 'SMTP', push: true, say: 'Her user agent submits the mail to her provider\'s MTA with SMTP.' },
      { at: 1, hop: null, dns: { q: 'MX of two.example.com?', a: 'MX 10 two.example.com' },
        say: 'Alice\'s MTA asks DNS for the MX record of two.example.com (the part after @): its mail server is two.example.com.' },
      { at: 2, hop: [1, 2], proto: 'SMTP, TCP 25', push: true, say: 'It opens TCP to two.example.com port 25 and pushes the mail with SMTP.' },
      { at: 3, hop: [2, 3], proto: 'stored', say: 'Bob\'s MTA files it in Bob\'s mailbox, on the server.' }
    ];
    if (!online) steps.push({ at: 3, hop: null, wait: true, say: 'Bob\'s laptop is off. SMTP can\'t push to it, so the mail waits in the mailbox.' });
    steps.push({ at: 4, hop: [3, 4], proto: 'IMAP', pull: true, copy: true,
      say: (online ? 'Bob is online: his' : 'Bob comes online: his') + ' user agent pulls the mail with IMAP; a copy stays on the server.' });
    return { online: !!online, steps: steps, end: steps.length - 1 };
  }

  CN.http = { plan: plan, rtts: rtts, STATUS: STATUS, URLS: URLS, PORT: PORT, url: url, exchange: exchange, hol: hol, HOL_STREAMS: HOL_STREAMS,
    swarm: swarm, PEERS: PEERS, CHUNKS: CHUNKS, SWARM_HAVE: SWARM_HAVE, mailPath: mailPath, MAIL_NODES: MAIL_NODES };
})(typeof window !== 'undefined' ? window : globalThis);
