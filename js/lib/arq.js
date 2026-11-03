/* Sliding-window ARQ simulator: stop-and-wait, Go-Back-N (Protocol 5) and
   Selective Repeat (Protocol 6), on a tick clock.

   The protocol logic uses sequence numbers (mod 2^n) only. Each message also
   carries its absolute frame number `abs`, used ONLY to narrate and to detect
   when the receiver accepts an old frame as new (the SR window trap).

   GBN / stop-and-wait ACKs are cumulative and carry the last frame received
   correctly (Tanenbaum). Forouzan's "next frame expected" is the same ACK shown
   as seq+1; the screen toggles the label, not the behaviour.

   SR acknowledges each frame individually (selective ACK) and NAKs the first
   hole. With Protocol 6's cumulative ACK and this short timer, frames 2 and 3
   would also time out before the ACK covering them could return.

   Per tick t: 1) deliver arrivals  2) check timers  3) send at most one frame. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function create(o) {
    var M = Math.pow(2, o.n);
    var s = {
      proto: o.proto, n: o.n, M: M, W: o.W, total: o.total || 8,
      delay: o.delay || 3, timeout: o.timeout || 8, noAck: !!o.noAck,
      drop: o.drop || function () { return false; },
      tick: 0, base: 0, next: 0, timers: {}, queue: [], copies: {},
      expected: 0, buffer: {}, noNak: true, acked: {},
      msgs: [], delivered: [], log: [], retransmitted: [],
      stats: { tx: 0, retx: 0, acks: 0 }, failure: null, done: false, idSeq: 0
    };

    function log(text, cls) { s.log.push({ t: s.tick, text: text, cls: cls || '' }); }

    function sendMsg(kind, seq, abs, from, note) {
      var m = {
        id: ++s.idSeq, kind: kind, seq: seq, abs: abs, from: from,
        sentAt: s.tick, arriveAt: s.tick + s.delay, lost: false, fate: 'flight', note: note || ''
      };
      if (kind === 'data') {
        s.copies[abs] = (s.copies[abs] || 0) + 1;
        m.copy = s.copies[abs];
      }
      if (s.drop(m, s)) { m.lost = true; m.lostAt = s.tick + s.delay / 2; m.fate = 'lost'; }
      s.msgs.push(m);
      return m;
    }

    function transmit(k, isRetx) {
      sendMsg('data', k % M, k, 'S');
      s.stats.tx++;
      if (isRetx) { s.stats.retx++; s.retransmitted.push({ abs: k, t: s.tick }); }
      if (!s.noAck) s.timers[k] = s.tick + s.timeout;
    }

    function inOutstanding(seq) {
      for (var k = s.base; k < s.next; k++) if (k % M === seq) return k;
      return -1;
    }

    function ackUpTo(seq) {
      var k = inOutstanding(seq);
      if (k < 0) return false;
      for (var j = s.base; j <= k; j++) delete s.timers[j];
      s.base = k + 1;
      s.queue = s.queue.filter(function (x) { return x >= s.base; });
      return true;
    }

    function deliver(abs, guess) {
      s.delivered.push(abs);
      if (abs !== guess && !s.failure) {
        s.failure = { t: s.tick, abs: abs, guess: guess, seq: abs % M };
        log('Old frame ' + (abs % M) + ' accepted as new — protocol failure', 'err');
      }
    }

    function sendAck() {
      if (s.noAck) return;
      sendMsg('ack', (s.expected - 1 + M) % M, s.expected - 1, 'R');
      s.stats.acks++;
    }

    function sendSelAck(m) {
      sendMsg('ack', m.seq, m.abs, 'R');
      s.stats.acks++;
    }

    function receiverGets(m) {
      var exp = s.expected % M;
      if (s.proto === 'sr') {
        var d = (m.seq - exp + M) % M;
        if (d < s.W) {
          if (s.buffer[m.seq] !== undefined) {
            m.fate = 'discard'; m.note = 'Already buffered → discard';
          } else {
            var guess = s.expected + d;
            s.buffer[m.seq] = { abs: m.abs, guess: guess };
            if (m.abs !== guess && !s.failure) {
              s.failure = { t: s.tick, abs: m.abs, guess: guess, seq: m.seq };
              m.dupAccepted = true;
              log('Old frame ' + m.seq + ' accepted as new — protocol failure', 'err');
            }
            if (d === 0) {
              m.fate = 'ok';
              while (s.buffer[s.expected % M] !== undefined) {
                var b = s.buffer[s.expected % M];
                delete s.buffer[s.expected % M];
                deliver(b.abs, b.guess);
                s.expected++;
                s.noNak = true;
              }
              m.note = 'Accept, deliver up to ' + ((s.expected - 1) % M);
            } else {
              m.fate = 'buffer'; m.note = 'Out of order → buffer';
              if (s.noNak) {
                s.noNak = false;
                sendMsg('nak', exp, s.expected, 'R');
                log('Receiver buffers ' + m.seq + ', NAKs missing ' + exp);
              }
            }
          }
        } else {
          m.fate = 'discard';
          m.note = (m.abs < s.expected ? 'Duplicate of ' + m.seq : 'Outside window') + ' → discard, re-ACK';
        }
        sendSelAck(m);
        return;
      }
      // GBN and stop-and-wait: receiver window of 1
      if (m.seq === exp) {
        m.fate = 'ok'; m.note = 'Accept ' + m.seq;
        deliver(m.abs, s.expected);
        s.expected++;
      } else {
        m.fate = 'discard';
        m.note = m.abs < s.expected ? 'Duplicate of ' + m.seq + ' → discard, re-ACK'
                                     : 'Out of order (waiting for ' + exp + ') → discard';
      }
      sendAck();
    }

    function senderGets(m) {
      if (m.kind === 'ack' && s.proto === 'sr') {
        var j = inOutstanding(m.seq);
        if (j >= 0 && !s.acked[j]) {
          s.acked[j] = true; delete s.timers[j];
          var old = s.base;
          while (s.acked[s.base]) s.base++;
          s.queue = s.queue.filter(function (x) { return x >= s.base && !s.acked[x]; });
          m.fate = 'ok';
          m.note = s.base > old ? 'Window slides to ' + (s.base % M) : 'Frame ' + m.seq + ' acknowledged';
        } else { m.fate = 'stale'; m.note = 'Nothing new acknowledged'; }
      } else if (m.kind === 'ack') {
        var moved = ackUpTo(m.seq);
        m.fate = moved ? 'ok' : 'stale';
        m.note = moved ? 'Window slides to ' + (s.base % M) : 'Nothing new acknowledged';
      } else if (m.kind === 'nak') {
        var k = inOutstanding(m.seq);
        m.fate = 'ok';
        if (k >= 0 && !s.acked[k] && s.queue.indexOf(k) < 0) { s.queue.unshift(k); m.note = 'Resend only ' + m.seq; }
        else m.note = 'Already resending';
      }
    }

    function step() {
      if (s.done) return s;
      var t = s.tick;
      // 1. arrivals
      s.msgs.forEach(function (m) {
        if (m.lost || m.arriveAt !== t || m.handled) return;
        m.handled = true;
        if (m.kind === 'data') receiverGets(m); else senderGets(m);
      });
      // 2. timers
      if (!s.noAck) {
        var expired = Object.keys(s.timers).map(Number).filter(function (k) { return s.timers[k] <= t && k >= s.base; }).sort(function (a, b) { return a - b; });
        if (expired.length) {
          if (s.proto === 'sr') {
            expired.filter(function (k) { return !s.acked[k]; }).forEach(function (k) {
              delete s.timers[k];
              if (s.queue.indexOf(k) < 0) s.queue.push(k);
              log('Timeout on ' + (k % M) + ' → resend only ' + (k % M));
            });
          } else {
            s.queue = [];
            for (var k = s.base; k < s.next; k++) s.queue.push(k);
            s.timers = {};
            log('Timeout on ' + (s.base % M) + ' → go back, resend ' + s.queue.map(function (x) { return x % M; }).join(', '));
          }
        }
      }
      // 3. send one frame
      var limit = s.noAck ? Infinity : s.W;
      while (s.queue.length && (s.queue[0] < s.base || s.acked[s.queue[0]])) s.queue.shift();
      if (s.queue.length) transmit(s.queue.shift(), true);
      else if (s.next < s.base + limit && s.next < s.total) transmit(s.next++, false);
      if (s.noAck) s.base = s.next;
      s.tick++;
      var inFlight = s.msgs.some(function (m) { return !m.lost && !m.handled && m.arriveAt >= s.tick; });
      if (s.expected >= s.total && s.base >= s.total && !inFlight) s.done = true;
      return s;
    }

    // Destroy a message that is still in flight (click on the diagram).
    function kill(id) {
      var m = s.msgs.filter(function (x) { return x.id === id; })[0];
      if (!m || m.lost || m.handled) return false;
      m.lost = true; m.lostAt = Math.max(m.sentAt + 0.5, s.tick - 0.5); m.fate = 'lost';
      return true;
    }

    function run(maxTicks) {
      maxTicks = maxTicks || 20000;
      while (!s.done && !(s.failure && o.stopOnFailure) && s.tick < maxTicks) step();
      return s;
    }

    s.step = step; s.kill = kill; s.run = run;
    return s;
  }

  // Loss scripts: [{kind:'data', abs:1, copy:1}], plus "drop every ACK sent before tick X".
  function scriptedDrop(script, ackBlackoutUntil) {
    return function (m) {
      if (ackBlackoutUntil && m.kind !== 'data' && m.sentAt < ackBlackoutUntil) return true;
      return (script || []).some(function (r) {
        return r.kind === m.kind && r.abs === m.abs && (r.copy == null || r.copy === m.copy);
      });
    };
  }

  function safeMax(proto, n) {
    var M = Math.pow(2, n);
    return proto === 'sr' ? M / 2 : M - 1;
  }

  // The bandwidth-delay arithmetic from Tanenbaum §3.4.
  function windowMath(bps, oneWayMs, frameBits) {
    var bd = bps * oneWayMs / 1000 / frameBits;
    return { bd: bd, w: 2 * bd + 1, util1: 1 / (1 + 2 * bd) };
  }

  // SPEC-v5: one Step press = ticks until something happens (a send, an arrival, a loss, a timeout).
  function stepToEvent(s) {
    function sig() { return s.msgs.length + ':' + s.msgs.filter(function (m) { return m.handled || m.lost; }).length + ':' + s.log.length; }
    var before = sig(), guard = 0;
    do { s.step(); } while (!s.done && sig() === before && guard++ < 40);
  }

  CN.arq = { create: create, scriptedDrop: scriptedDrop, safeMax: safeMax, windowMath: windowMath, stepToEvent: stepToEvent };
})(typeof window !== 'undefined' ? window : globalThis);
