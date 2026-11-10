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

  // 1a: one scripted run of each data link service over the same link, sending H, i, ! from A to B.
  // kind 'none' = unacknowledged connectionless, 'ack' = acknowledged connectionless,
  // 'conn' = acknowledged connection-oriented. loss.frame = n loses the first copy of data frame n,
  // loss.ack = n the first ACK for it. Times in seconds: one hop takes HOP, the timer runs TO.
  // The acknowledged lanes are stop-and-wait; ACKs name the next frame expected (as on 4a–5c).
  var SVC = { HOP: 0.8, GAP: 0.1, TO: 2.5, SPACING: 1.0, START: 0.3, LOOP: 13, MSG: ['H', 'i', '!'] };
  function serviceLane(kind, loss) {
    loss = loss || {};
    var S = SVC, acked = kind !== 'none', conn = kind === 'conn';
    var t = S.START, events = [], delivered = [], expected = 0;
    function r(x) { return Math.round(x * 100) / 100; }
    function fly(e, lost) {
      e.t0 = r(t); e.t1 = r(t + S.HOP);
      if (lost) { e.lost = true; e.tLost = r(t + S.HOP / 2); }
      events.push(e);
      return e;
    }
    function control(label) {
      var c = fly({ type: 'ctl', dir: 'AB', label: label });
      t = c.t1;
      t = fly({ type: 'ack', dir: 'BA', label: 'ACK' }).t1 + S.GAP;
    }
    if (conn) control('CONNECT');
    S.MSG.forEach(function (c, n) {
      for (var copy = 0; ; copy++) {
        var f = fly({ type: 'data', dir: 'AB', n: n, ch: c, copy: copy, label: conn ? n + ' · ' + c : c }, !copy && loss.frame === n);
        if (!acked) {
          if (!f.lost) delivered.push({ ch: c, t: f.t1 });
          t += S.SPACING;
          break;
        }
        var timer = { type: 'timer', t0: f.t0, fired: true };
        events.push(timer);
        if (!f.lost) {
          if (conn && n < expected) f.dup = true;      // numbered: B has it already, drops the copy
          else { delivered.push({ ch: c, t: f.t1 }); expected = n + 1; }
          t = f.t1;
          var a = fly({ type: 'ack', dir: 'BA', n: n, label: conn ? 'ACK ' + (n + 1) : 'ACK' }, !copy && loss.ack === n);
          if (!a.lost) { timer.fired = false; timer.t1 = a.t1; t = a.t1 + S.GAP; break; }
        }
        timer.t1 = r(f.t0 + S.TO);                     // nothing came back in time: resend
        t = timer.t1 + S.GAP;
      }
    });
    if (conn) control('RELEASE');
    var last = events.reduce(function (m, e) { return Math.max(m, e.t1); }, 0);
    return { kind: kind, events: events, delivered: delivered, text: delivered.map(function (d) { return d.ch; }).join(''), end: r(last) };
  }
  function serviceLanes() {
    return {
      loop: SVC.LOOP, hop: SVC.HOP, timeout: SVC.TO,
      lanes: [serviceLane('none', { frame: 1 }), serviceLane('ack', { frame: 1 }), serviceLane('conn', { ack: 1 })]
    };
  }

  CN.framing = {
    bitStuff: bitStuff, bitDestuff: bitDestuff,
    byteStuff: byteStuff, byteDestuff: byteDestuff, tokens: tokens,
    byteCountFrames: byteCountFrames,
    serviceLane: serviceLane, serviceLanes: serviceLanes
  };
})(typeof window !== 'undefined' ? window : globalThis);
