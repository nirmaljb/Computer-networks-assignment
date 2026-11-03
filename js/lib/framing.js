/* Framing solvers: bit stuffing (HDLC/USB), byte stuffing (PPP), byte count.
   Pure functions; shared by the screens and tests/run.mjs. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }

  // After five consecutive 1s in the data, insert a 0.
  function bitStuff(input) {
    var bits = clean(input);
    if (!bits.length) return { error: 'Enter some bits (0 or 1)' };
    if (!/^[01]+$/.test(bits)) return { error: 'Bits must be 0 or 1 only' };
    var out = '', inserted = [], run = 0;
    for (var i = 0; i < bits.length; i++) {
      out += bits[i];
      if (bits[i] === '1') {
        run++;
        if (run === 5) { inserted.push(out.length); out += '0'; run = 0; }
      } else run = 0;
    }
    return { input: bits, out: out, inserted: inserted };
  }

  // Receiver: delete the 0 that follows five 1s. Six 1s = flag (or an error).
  function bitDestuff(input) {
    var bits = clean(input);
    if (!/^[01]+$/.test(bits)) return { error: 'Bits must be 0 or 1 only' };
    var out = '', removed = [], run = 0;
    for (var i = 0; i < bits.length; i++) {
      var b = bits[i];
      if (run === 5) {
        if (b === '0') { removed.push(i); run = 0; continue; }
        return { error: 'Six 1s in a row at bit ' + (i + 1) + ': that is a flag (or an error), not data' };
      }
      out += b;
      run = b === '1' ? run + 1 : 0;
    }
    return { input: bits, out: out, removed: removed };
  }

  function tokens(input) {
    var t = String(input == null ? '' : input).trim();
    return t ? t.split(/[\s,]+/).map(function (x) { return x.toUpperCase(); }) : [];
  }

  // An ESC goes before any FLAG or ESC in the data.
  function byteStuff(input) {
    var toks = Array.isArray(input) ? input.slice() : tokens(input);
    if (!toks.length) return { error: 'Enter byte tokens, e.g. A FLAG B ESC C' };
    var out = [], inserted = [];
    toks.forEach(function (t) {
      if (t === 'FLAG' || t === 'ESC') { inserted.push(out.length); out.push('ESC'); }
      out.push(t);
    });
    return { input: toks, out: out, inserted: inserted };
  }

  function byteDestuff(input) {
    var toks = Array.isArray(input) ? input.slice() : tokens(input);
    var out = [], removed = [];
    for (var i = 0; i < toks.length; i++) {
      if (toks[i] === 'ESC') {
        if (i + 1 >= toks.length) return { error: 'ESC at the end: nothing to escape' };
        removed.push(i); out.push(toks[++i]);
      } else if (toks[i] === 'FLAG') {
        return { error: 'Bare FLAG at byte ' + (i + 1) + ': the frame would end here' };
      } else out.push(toks[i]);
    }
    return { input: toks, out: out, removed: removed };
  }

  // Byte count framing: each frame starts with its own length (count byte included).
  function byteCountFrames(stream) {
    var frames = [], i = 0;
    while (i < stream.length) {
      var c = stream[i];
      if (!(c > 0)) { frames.push({ start: i, count: c, bytes: stream.slice(i), bad: true }); break; }
      frames.push({ start: i, count: c, bytes: stream.slice(i, i + c), short: i + c > stream.length });
      i += c;
    }
    return frames;
  }

  CN.framing = {
    bitStuff: bitStuff, bitDestuff: bitDestuff,
    byteStuff: byteStuff, byteDestuff: byteDestuff, tokens: tokens,
    byteCountFrames: byteCountFrames
  };
})(typeof window !== 'undefined' ? window : globalThis);
