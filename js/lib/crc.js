/* Cyclic Redundancy Check: mod-2 long division, exactly as on paper. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  var SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

  function zeros(n) { return new Array(n + 1).join('0'); }

  function xor(a, b) {
    var out = '';
    for (var i = 0; i < a.length; i++) out += a[i] === b[i] ? '0' : '1';
    return out;
  }

  // Accepts '10011' or 'x^4+x+1' (also x4, x⁴, x^{4}).
  function parsePoly(s) {
    var t = s.replace(/\s+/g, '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function (m) {
      return '^' + m.split('').map(function (c) { return SUP[c]; }).join('');
    }).replace(/[{}]/g, '').toLowerCase();
    var degs = {}, parts = t.split('+');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], d;
      if (p === '1') d = 0;
      else if (p === 'x') d = 1;
      else {
        var m = /^x\^?(\d+)$/.exec(p);
        if (!m) return { error: 'Could not read term "' + p + '" (use e.g. x^4+x+1)' };
        d = +m[1];
      }
      if (degs[d]) return { error: 'Term x^' + d + ' appears twice' };
      degs[d] = true;
    }
    var max = Math.max.apply(null, Object.keys(degs).map(Number));
    if (max > 16) return { error: 'Generator degree must be 16 or less' };
    var bits = '';
    for (var k = max; k >= 0; k--) bits += degs[k] ? '1' : '0';
    return { bits: bits };
  }

  function parseGenerator(input) {
    var s = String(input == null ? '' : input).trim();
    if (!s) return { error: 'Enter a generator, e.g. 10011 or x^4+x+1' };
    var bits;
    if (/x/i.test(s) || s === '1') {
      var p = parsePoly(s);
      if (p.error) return p;
      bits = p.bits;
    } else {
      bits = s.replace(/\s+/g, '');
      if (!/^[01]+$/.test(bits)) return { error: 'Generator bits must be 0 or 1' };
    }
    if (bits.length < 2 || bits.length > 17) return { error: 'Generator must be 2–17 bits (degree 1–16)' };
    if (bits[0] !== '1' || bits[bits.length - 1] !== '1') {
      return { error: 'Generator must start and end with 1 (' + bits + ' does not)' };
    }
    return { bits: bits, degree: bits.length - 1 };
  }

  function parseData(input) {
    var d = String(input == null ? '' : input).replace(/\s+/g, '');
    if (!/^[01]{1,32}$/.test(d)) return { error: 'Data must be 1–32 bits (0 or 1)' };
    return { bits: d };
  }

  // 'x^4 + x + 1' (plain carets; the UI turns them into superscripts)
  function polyString(bits) {
    var n = bits.length - 1, terms = [];
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] !== '1') continue;
      var d = n - i;
      terms.push(d === 0 ? '1' : d === 1 ? 'x' : 'x^' + d);
    }
    return terms.length ? terms.join(' + ') : '0';
  }

  // Long division. Each step: the current window, what we subtract (G or 0s),
  // the XOR result, and the quotient bit. Column = offset of the window.
  function divide(dividend, gen) {
    var g = gen.length, steps = [], q = '';
    if (dividend.length < g) {
      return { quotient: '0', remainder: zeros(g - 1 - dividend.length) + dividend, steps: [] };
    }
    var cur = dividend.slice(0, g);
    for (var i = 0; i <= dividend.length - g; i++) {
      var lead = cur[0], sub = lead === '1' ? gen : zeros(g), res = xor(cur, sub);
      q += lead;
      steps.push({ col: i, window: cur, sub: sub, result: res, qbit: lead });
      cur = res.slice(1) + (i + g < dividend.length ? dividend[i + g] : '');
    }
    return { quotient: q, remainder: steps[steps.length - 1].result.slice(1), steps: steps };
  }

  function encode(data, generator) {
    var d = parseData(data); if (d.error) return d;
    var g = parseGenerator(generator); if (g.error) return g;
    var r = g.degree, augmented = d.bits + zeros(r), div = divide(augmented, g.bits);
    return {
      data: d.bits, gen: g.bits, r: r, augmented: augmented,
      quotient: div.quotient, steps: div.steps, remainder: div.remainder,
      frame: d.bits + div.remainder
    };
  }

  function check(frame, generator) {
    var g = parseGenerator(generator); if (g.error) return g;
    var f = String(frame).replace(/\s+/g, '');
    var div = divide(f, g.bits);
    return { frame: f, gen: g.bits, quotient: div.quotient, steps: div.steps, remainder: div.remainder, ok: !/1/.test(div.remainder) };
  }

  // Add (XOR) a copy of G shifted left by `shift` into the frame: E(x) = x^shift · G(x).
  function undetectable(frame, gen, shift) {
    shift = shift || 0;
    var start = frame.length - gen.length - shift;
    if (start < 0) start = 0;
    var e = zeros(start) + gen + zeros(frame.length - start - gen.length);
    return { frame: xor(frame, e), error: e };
  }

  // Burst of `len` bits starting at `start` (0-based from the left): every bit in it flipped.
  function burst(frame, start, len) {
    var e = '';
    for (var i = 0; i < frame.length; i++) e += (i >= start && i < start + len) ? '1' : '0';
    return { frame: xor(frame, e), error: e };
  }

  // SPEC-v6 "your numbers": 'message / generator', message 1–16 bits, generator degree 1–8 with its
  // top and bottom bits 1 (so the division and the burst guarantee on the slide still hold).
  function parseCustom(input) {
    var parts = String(input == null ? '' : input).split('/');
    if (parts.length !== 2) return { error: 'Type message / generator, e.g. 1101011111 / 10011' };
    var msg = parts[0].replace(/\s+/g, '');
    if (!msg) return { error: 'The message is empty' };
    if (!/^[01]+$/.test(msg)) return { error: 'Message bits must be 0 or 1' };
    if (msg.length > 16) return { error: 'Message has ' + msg.length + ' bits: at most 16' };
    var gs = parts[1].trim();
    if (!gs) return { error: 'The generator is empty' };
    var bits;
    if (/x/i.test(gs)) { var p = parsePoly(gs); if (p.error) return p; bits = p.bits; }
    else {
      bits = gs.replace(/\s+/g, '');
      if (!/^[01]+$/.test(bits)) return { error: 'Generator bits must be 0 or 1' };
    }
    if (bits[0] !== '1' || bits[bits.length - 1] !== '1') return { error: 'Generator ' + bits + ': its top and bottom bits must be 1' };
    if (bits.length < 2 || bits.length > 9) return { error: 'Generator ' + bits + ' has degree ' + (bits.length - 1) + ': use degree 1–8' };
    return { data: msg, gen: bits };
  }

  CN.crc = {
    parseCustom: parseCustom,
    xor: xor, zeros: zeros, parseGenerator: parseGenerator, parseData: parseData,
    polyString: polyString, divide: divide, encode: encode, check: check,
    undetectable: undetectable, burst: burst
  };
})(typeof window !== 'undefined' ? window : globalThis);
