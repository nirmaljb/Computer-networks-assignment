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

  CN.http = { plan: plan, rtts: rtts, STATUS: STATUS, URLS: URLS, PORT: PORT, url: url, exchange: exchange };
})(typeof window !== 'undefined' ? window : globalThis);
