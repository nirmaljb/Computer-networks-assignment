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

  /* Forouzan's C(7,4) (Table 10.4, Fig 10.12): systematic, the codeword is a3 a2 a1 a0 r2 r1 r0, the check bits
     after the data. r0 = a2⊕a1⊕a0, r1 = a3⊕a2⊕a1, r2 = a1⊕a0⊕a3. The receiver's syndrome s2 s1 s0 is not a
     position: Table 10.5 maps it to the bit to flip. */
  var C74_TABLE = { '000': null, '001': 'q0', '010': 'q1', '011': 'b2', '100': 'q2', '101': 'b0', '110': 'b3', '111': 'b1' };
  var C74_NAMES = ['b3', 'b2', 'b1', 'b0', 'q2', 'q1', 'q0'];   // received bits, left to right
  function c74Encode(data) {
    var d = String(data == null ? '' : data).replace(/\s+/g, '');
    if (!/^[01]{4}$/.test(d)) return { error: 'C(7,4) takes exactly 4 data bits' };
    var a3 = +d[0], a2 = +d[1], a1 = +d[2], a0 = +d[3];
    var r0 = a2 ^ a1 ^ a0, r1 = a3 ^ a2 ^ a1, r2 = a1 ^ a0 ^ a3;
    return { data: d, r: [r0, r1, r2], code: d + r2 + r1 + r0,
      eqs: [{ name: 'r0', terms: ['a2', 'a1', 'a0'], values: [a2, a1, a0], value: r0 },
        { name: 'r1', terms: ['a3', 'a2', 'a1'], values: [a3, a2, a1], value: r1 },
        { name: 'r2', terms: ['a1', 'a0', 'a3'], values: [a1, a0, a3], value: r2 }] };
  }
  function c74Check(received) {
    var c = String(received).replace(/\s+/g, '');
    if (!/^[01]{7}$/.test(c)) return { error: 'C(7,4) codewords are 7 bits' };
    var b3 = +c[0], b2 = +c[1], b1 = +c[2], b0 = +c[3], q2 = +c[4], q1 = +c[5], q0 = +c[6];
    var s0 = b2 ^ b1 ^ b0 ^ q0, s1 = b3 ^ b2 ^ b1 ^ q1, s2 = b1 ^ b0 ^ b3 ^ q2, syn = '' + s2 + s1 + s0;
    var culprit = C74_TABLE[syn], corrected = c;
    if (culprit) { var i = C74_NAMES.indexOf(culprit); corrected = c.slice(0, i) + (c[i] === '1' ? '0' : '1') + c.slice(i + 1); }
    return { received: c, syndrome: syn, culprit: culprit, corrected: corrected, data: corrected.slice(0, 4),
      eqs: [{ name: 's0', terms: ['b2', 'b1', 'b0', 'q0'], values: [b2, b1, b0, q0], value: s0 },
        { name: 's1', terms: ['b3', 'b2', 'b1', 'q1'], values: [b3, b2, b1, q1], value: s1 },
        { name: 's2', terms: ['b1', 'b0', 'b3', 'q2'], values: [b1, b0, b3, q2], value: s2 }] };
  }

  CN.hamming = {
    c74Encode: c74Encode, c74Check: c74Check, C74_TABLE: C74_TABLE, C74_NAMES: C74_NAMES,
    isPow2: isPow2, checkBitsNeeded: checkBitsNeeded, covers: covers,
    encode: encode, check: check, flip: flip, diagnose: diagnose, validate: validate
  };
})(typeof window !== 'undefined' ? window : globalThis);
