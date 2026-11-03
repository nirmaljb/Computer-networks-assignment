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

  CN.http = { plan: plan, rtts: rtts, STATUS: STATUS };
})(typeof window !== 'undefined' ? window : globalThis);
