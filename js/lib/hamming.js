/* Hamming code, Tanenbaum layout: positions 1..n from the left, check bits at
   powers of 2, check bit p covers every position whose binary expansion has p. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function isPow2(x) { return x > 0 && (x & (x - 1)) === 0; }

  // Smallest r with (m + r + 1) <= 2^r.
  function checkBitsNeeded(m) {
    var r = 0;
    while (m + r + 1 > Math.pow(2, r)) r++;
    return r;
  }

  function covers(p, n) {
    var list = [];
    for (var i = 1; i <= n; i++) if (i & p) list.push(i);
    return list;
  }

  function validate(data) {
    var d = String(data == null ? '' : data).replace(/\s+/g, '');
    if (!d) return { error: 'Enter 1–16 data bits (0 or 1)' };
    if (!/^[01]+$/.test(d)) return { error: 'Data bits must be 0 or 1' };
    if (d.length > 16) return { error: d.length + ' bits: use 1–16' };
    return { bits: d };
  }

  // parity: 'even' (default) or 'odd'
  function encode(data, parity) {
    var v = validate(data);
    if (v.error) return v;
    var d = v.bits, m = d.length, r = checkBitsNeeded(m), n = m + r;
    var code = new Array(n + 1), dataPos = [], k = 0;
    for (var i = 1; i <= n; i++) {
      if (isPow2(i)) code[i] = null;
      else { code[i] = +d[k++]; dataPos.push(i); }
    }
    var checks = [];
    for (var p = 1; p <= n; p <<= 1) {
      var cov = covers(p, n).filter(function (x) { return x !== p; });
      var x = 0;
      cov.forEach(function (q) { x ^= code[q]; });
      if (parity === 'odd') x ^= 1;
      code[p] = x;
      checks.push({ pos: p, covers: cov, values: cov.map(function (q) { return code[q]; }), value: x });
    }
    return {
      data: d, m: m, r: r, n: n, parity: parity === 'odd' ? 'odd' : 'even',
      code: code.slice(1).join(''), dataPos: dataPos, checks: checks
    };
  }

  // Receiver: recompute every check over its full group (itself included).
  function check(received, parity) {
    var c = String(received).replace(/\s+/g, ''), n = c.length;
    if (!/^[01]+$/.test(c)) return { error: 'Codeword must be bits' };
    var want = parity === 'odd' ? 1 : 0, syndrome = 0, checks = [];
    for (var p = 1; p <= n; p <<= 1) {
      var cov = covers(p, n), x = 0;
      cov.forEach(function (q) { x ^= +c[q - 1]; });
      var ok = x === want;
      if (!ok) syndrome += p;
      checks.push({ pos: p, covers: cov, values: cov.map(function (q) { return +c[q - 1]; }), parity: x, ok: ok });
    }
    var corrected = c;
    if (syndrome > 0 && syndrome <= n) {
      corrected = c.slice(0, syndrome - 1) + (c[syndrome - 1] === '1' ? '0' : '1') + c.slice(syndrome);
    }
    var dataBits = '';
    for (var i = 1; i <= n; i++) if (!isPow2(i)) dataBits += corrected[i - 1];
    return { received: c, n: n, checks: checks, syndrome: syndrome, outOfRange: syndrome > n, corrected: corrected, data: dataBits };
  }

  function flip(code, positions) {
    var a = code.split('');
    positions.forEach(function (p) { a[p - 1] = a[p - 1] === '1' ? '0' : '1'; });
    return a.join('');
  }

  // Compare against the sent codeword to explain what correction would do.
  function diagnose(sent, received, parity) {
    var res = check(received, parity), flipped = [];
    for (var i = 0; i < sent.length; i++) if (sent[i] !== received[i]) flipped.push(i + 1);
    res.flipped = flipped;
    if (flipped.length === 0) res.verdict = res.syndrome === 0 ? 'none' : 'impossible';
    else if (flipped.length === 1) res.verdict = res.syndrome === flipped[0] ? 'corrected' : 'wrong';
    else res.verdict = res.syndrome === 0 ? 'undetected' : 'miscorrection';
    return res;
  }

  CN.hamming = {
    isPow2: isPow2, checkBitsNeeded: checkBitsNeeded, covers: covers,
    encode: encode, check: check, flip: flip, diagnose: diagnose, validate: validate
  };
})(typeof window !== 'undefined' ? window : globalThis);
