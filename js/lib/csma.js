/* MAC sublayer solvers: ALOHA throughput, binary exponential backoff, minimum
   frame size, binary countdown, and a CSMA / CSMA-CD bus simulator.

   Bus model: stations sit at integer positions; a signal travels one unit per
   tick. A station hears a transmission only once its signal physically
   arrives. tau = end-to-end propagation in ticks; contention slot = 2*tau. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  // Seeded RNG (mulberry32) so every run can be replayed.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function alohaPure(Gv) { return Gv * Math.exp(-2 * Gv); }
  function alohaSlotted(Gv) { return Gv * Math.exp(-Gv); }

  // 6a static allocation. Mean delay of one channel (M/M/1): T = 1/(μC − λ), C bit/s, frames of L = 1/μ bits,
  // λ frames/s; split into N sub-channels of C/N carrying λ/N each, T_N = N·T. Returns seconds.
  function staticDelay(C, L, lambda, N) { return (N || 1) / (C / L - lambda); }
  // One burst through TDM and FDM with N slices vs the whole channel. A slot is the time one frame takes at the full
  // rate C; the other N − 1 stations are silent. shared[i] / tdm[i] = the slot frame i is sent in; TDM gives A slots
  // 1, N+1, 2N+1, …. FDM gives A a band of C/N all the time, so frame i takes N slots: fdm[i] = the slot it finishes
  // in (N, 2N, 3N). Same 1/N share, so the same mean delay N·T, but this burst ends at 2N + 1 on TDM and 3N on FDM.
  var TDM_NS = [1, 2, 5, 10], TDM_BURST = 3;
  function staticTdm(N, burst) {
    burst = burst || TDM_BURST;
    var shared = [], tdm = [], fdm = [];
    for (var i = 0; i < burst; i++) { shared.push(i + 1); tdm.push(i * N + 1); fdm.push((i + 1) * N); }
    var end = tdm[burst - 1];
    return { n: N, burst: burst, shared: shared, tdm: tdm, end: end, fdm: fdm, fdmEnd: fdm[burst - 1],
      owner: function (s) { return String.fromCharCode(65 + (s - 1) % N); },
      idle: end - burst };   // TDM slots left empty while A still had a frame queued (none on the shared channel)
  }

  // After collision i: K uniform in 0 .. 2^min(i,10) - 1. Give up after 16.
  function bebRange(i) {
    if (i >= 16) return { abort: true };
    return { lo: 0, hi: Math.pow(2, Math.min(i, 10)) - 1 };
  }

  function minFrame(bps, slotSeconds) {
    var bits = Math.round(bps * slotSeconds * 1e6) / 1e6;
    return { bits: bits, bytes: bits / 8 };
  }

  // Binary countdown: addresses broadcast MSB first; channel ORs the bits;
  // a station that sent 0 and sees 1 drops out.
  function binaryCountdown(addrs) {
    var width = Math.max.apply(null, addrs.map(function (a) { return a.length; }));
    var list = addrs.map(function (a) { return a.length < width ? new Array(width - a.length + 1).join('0') + a : a; });
    var alive = list.map(function () { return true; }), steps = [];
    for (var b = 0; b < width; b++) {
      var or = 0;
      list.forEach(function (a, i) { if (alive[i] && a[b] === '1') or = 1; });
      var dropped = [];
      list.forEach(function (a, i) { if (alive[i] && or === 1 && a[b] === '0') { alive[i] = false; dropped.push(i); } });
      steps.push({ bit: b, or: or, dropped: dropped, alive: alive.slice() });
    }
    var winner = alive.indexOf(true);
    return { addrs: list, steps: steps, winner: winner, winnerAddr: list[winner] };
  }

  /* ---------------- Bus simulator ---------------- */
  function createBus(o) {
    var names = o.names || ['A', 'B', 'C', 'D'];
    var pos = o.positions || [0, 2, 4, 6];
    var tau = Math.max.apply(null, pos) - Math.min.apply(null, pos);
    var b = {
      t: 0, tau: tau, slot: 2 * tau, mode: o.mode || '1p', p: o.p == null ? 0.5 : o.p,
      cd: o.cd !== false, jam: o.jam || 2, seed: o.seed || 1, frameLen: o.frameLen || 16,
      stations: names.map(function (n, i) {
        return { name: n, x: pos[i], state: 'idle', frames: 0, attempts: 0, waitUntil: 0, tx: null, pDeferred: false, said: '' };
      }),
      txs: [], log: [], schedule: (o.schedule || []).slice(), done: false, events: [], collisions: [], collisionKeys: {}
    };
    var rand = rng(b.seed);
    var idSeq = 0;

    function log(text, cls) { b.log.push({ t: b.t, text: text, cls: cls || '' }); }

    function signalAt(tx, x, t) {
      var d = Math.abs(x - tx.x);
      return t >= tx.start + d && t < tx.end + d;
    }
    function othersAt(st, t) {
      return b.txs.filter(function (tx) { return tx.st !== st && signalAt(tx, b.stations[st].x, t); });
    }
    function busyFor(st, t) { return othersAt(st, t).length > 0; }

    // Did two signals ever overlap anywhere on the cable?
    function overlaps(a, c) {
      for (var x = 0; x <= tau; x += 0.5) {
        var a0 = a.start + Math.abs(x - a.x), a1 = a.end + Math.abs(x - a.x);
        var c0 = c.start + Math.abs(x - c.x), c1 = c.end + Math.abs(x - c.x);
        if (Math.max(a0, c0) < Math.min(a1, c1)) return true;
      }
      return false;
    }
    // b.collisions lists each pair of stations whose frames overlapped (once per pair of frames)
    function markCollisions(tx) {
      b.txs.forEach(function (o2) {
        if (o2 !== tx && overlaps(tx, o2)) {
          tx.collided = true; o2.collided = true;
          var key = Math.min(tx.id, o2.id) + '-' + Math.max(tx.id, o2.id);
          if (!b.collisionKeys[key]) { b.collisionKeys[key] = true; b.collisions.push([Math.min(tx.st, o2.st), Math.max(tx.st, o2.st)]); }
        }
      });
      return tx.collided;
    }

    function startTx(i) {
      var s = b.stations[i];
      var len = s.frameLen || b.frameLen;
      s.tx = { id: ++idSeq, st: i, x: s.x, start: b.t, end: b.t + len, planned: len, collided: false, jammed: false };
      b.txs.push(s.tx);
      s.state = 'tx'; s.pDeferred = false;
      log(s.name + ' senses idle → transmits (' + len + ' ticks)');
    }

    function backoff(i, reason) {
      var s = b.stations[i];
      s.attempts++;
      var r = bebRange(s.attempts);
      if (r.abort) {
        s.state = 'gaveup'; s.frames = Math.max(0, s.frames - 1);
        log(s.name + ': ' + s.attempts + ' collisions → give up, report failure', 'err');
        return;
      }
      var K = Math.floor(rand() * (r.hi + 1));
      s.waitUntil = b.t + K * b.slot + 1;
      s.state = 'backoff';
      log(s.name + ': ' + (reason || 'collision') + ' #' + s.attempts + ' → K ∈ {0..' + r.hi + '} → K = ' + K +
          ' → wait ' + K + ' slot' + (K === 1 ? '' : 's') + ' (2τ)', 'warn');
    }

    function nextSlot(t) { return (Math.floor(t / b.slot) + 1) * b.slot; }

    function finishOK(i) {
      var s = b.stations[i];
      s.frames--; s.attempts = 0; s.tx = null;
      s.state = s.frames > 0 ? 'ready' : 'idle';
    }

    function step() {
      var t = b.t;
      // settle frames whose tail has left the cable
      b.txs.forEach(function (tx) {
        if (!tx.pending || t < tx.end + tau) return;
        tx.pending = false;
        markCollisions(tx);
        var nm = b.stations[tx.st].name;
        if (tx.collided && b.cd) { tx.undetected = true; log(nm + '\'s frame was hit after ' + nm + ' stopped listening; ' + nm + ' never knew (frame shorter than 2τ)', 'err'); }
        else if (!tx.collided && b.cd) log(nm + '\'s frame delivered ✓', 'ok');
      });
      // frames arriving at stations
      b.schedule.forEach(function (e) {
        if (e.at === t) {
          var s = b.stations[e.st];
          s.frames += e.frames || 1;
          if (e.len) s.frameLen = e.len;
          if (s.state === 'idle' || s.state === 'done') s.state = 'ready';
          log(s.name + ' has a frame to send');
        }
      });
      b.stations.forEach(function (s, i) {
        if (s.state === 'tx') {
          if (b.cd && busyFor(i, t)) {
            s.tx.end = t + b.jam; s.tx.jammed = true; s.tx.collided = true;
            s.state = 'jam';
            log(s.name + ' detects collision at t=' + t + ' → stops, sends ' + b.jam + '-tick jam', 'err');
          } else if (t >= s.tx.end) {
            // The frame is safe only once its tail has left the cable (end + tau).
            s.tx.pending = true;
            if (b.cd) {
              log(s.name + ' finished at t=' + t + ', heard no collision → assumes success');
              finishOK(i);
            } else {
              s.state = 'waitack'; s.waitUntil = s.tx.end + tau;
              log(s.name + ' finished at t=' + t + ', waits for an ACK');
            }
          }
        }
        if (s.state === 'waitack' && t >= s.waitUntil) {
          if (s.tx.collided) { log(s.name + ': frame was garbled, no ACK', 'err'); s.tx = null; backoff(i, 'no ACK'); }
          else { log(s.name + ': ACK ✓ success', 'ok'); finishOK(i); }
        }
        if (s.state === 'jam' && t >= s.tx.end) { markCollisions(s.tx); s.tx = null; backoff(i); }
        if ((s.state === 'backoff' || s.state === 'defer') && t >= s.waitUntil) s.state = 'ready';
        if (s.state === 'ready' || s.state === 'sensing') {
          var busy = busyFor(i, t);
          if (b.mode === '1p') {
            if (!busy) startTx(i);
            else if (s.state !== 'sensing') { s.state = 'sensing'; log(s.name + ' senses busy → keeps listening (1-persistent)'); }
          } else if (b.mode === 'np') {
            if (!busy) startTx(i);
            else {
              var w = 1 + Math.floor(rand() * b.slot);
              s.waitUntil = t + w; s.state = 'defer';
              log(s.name + ' senses busy → waits a random ' + w + ' ticks (non-persistent)');
            }
          } else { // p-persistent, decisions at slot boundaries
            if (t % b.slot !== 0) { s.waitUntil = nextSlot(t); s.state = 'defer'; }
            else if (busy) {
              if (s.pDeferred) { s.pDeferred = false; log(s.name + ': another station started meanwhile → acts as if collided'); backoff(i); }
              else { s.waitUntil = nextSlot(t); s.state = 'defer'; log(s.name + ' senses busy → waits for the next slot'); }
            } else {
              var roll = rand();
              if (roll < b.p) { log(s.name + ': idle slot, rolls ' + roll.toFixed(2) + ' < p=' + b.p); startTx(i); }
              else {
                s.pDeferred = true; s.waitUntil = nextSlot(t); s.state = 'defer';
                log(s.name + ': idle slot, rolls ' + roll.toFixed(2) + ' ≥ p → defers one slot (q=' + (1 - b.p).toFixed(2) + ')');
              }
            }
          }
        }
      });
      b.t++;
      var pending = b.schedule.some(function (e) { return e.at >= b.t; });
      var active = b.stations.some(function (s) { return s.state !== 'idle' && s.state !== 'gaveup'; });
      var onWire = b.txs.some(function (tx) { return tx.pending || b.t < tx.end + tau; });
      b.done = !pending && !active && !onWire;
      return b;
    }

    // Frames on the wire at time t: for drawing [lo, hi] segments per transmission.
    function segments(t) {
      var segs = [];
      b.txs.forEach(function (tx) {
        var lead = t - tx.start, trail = t - tx.end;
        if (lead < 0) return;
        var hi = Math.min(tau, tx.x + lead), lo = Math.max(0, tx.x - lead);
        if (trail >= 0) {
          // signal has left the region within `trail` of the station
          var parts = [];
          if (tx.x - trail > lo) parts.push([lo, Math.min(hi, tx.x - trail)]);
          if (tx.x + trail < hi) parts.push([Math.max(lo, tx.x + trail), hi]);
          parts.forEach(function (p) { if (p[1] > p[0]) segs.push({ tx: tx, lo: p[0], hi: p[1] }); });
        } else segs.push({ tx: tx, lo: lo, hi: hi });
      });
      return segs;
    }

    function enqueue(i, len) {
      b.schedule.push({ at: b.t, st: i, len: len });
    }

    b.step = step; b.segments = segments; b.enqueue = enqueue; b.busyFor = busyFor;
    b.run = function (max) { max = max || 5000; while (!b.done && b.t < max) step(); return b; };
    return b;
  }

  CN.csma = {
    rng: rng, alohaPure: alohaPure, alohaSlotted: alohaSlotted, bebRange: bebRange,
    staticDelay: staticDelay, staticTdm: staticTdm, TDM_NS: TDM_NS, TDM_BURST: TDM_BURST,
    minFrame: minFrame, binaryCountdown: binaryCountdown, createBus: createBus
  };
})(typeof window !== 'undefined' ? window : globalThis);
