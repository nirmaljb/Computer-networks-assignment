/* Transport layer models (SPEC-v4 §4.16–4.20): header layouts, the handshake and
   release time-space scenarios, receiver-window flow control, RTO estimation with
   Karn's rule, and the Tahoe/Reno cwnd trace plus the toll-booth road model.
   Pure functions, no DOM. Sequence numbers wrap mod 2^32. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};
  var MOD = 4294967296;
  function wrap(n) { return ((n % MOD) + MOD) % MOD; }

  /* ---------------- headers (Tanenbaum 6e Fig 6-27 UDP, Fig 6-36 TCP) ---------------- */
  // bits per field in 32-bit rows; tcpOnly marks what UDP has no equivalent of.
  var UDP = [
    { name: 'Source port', bits: 16, role: 'Which program sent it (lets the reply find its way back).' },
    { name: 'Destination port', bits: 16, role: 'Which program on the host gets it: the whole point of UDP.' },
    { name: 'UDP length', bits: 16, role: 'Header + data in bytes (minimum 8).' },
    { name: 'UDP checksum', bits: 16, role: 'Header, data and pseudoheader. Optional in IPv4 (0 = none), required in IPv6.' }
  ];
  var TCP = [
    { name: 'Source port', bits: 16, role: 'Which program sent it.' },
    { name: 'Destination port', bits: 16, role: 'Which program gets it.' },
    { name: 'Sequence number', bits: 32, tcpOnly: true, role: 'Number of the first data byte in this segment (bytes are numbered, not segments).' },
    { name: 'Acknowledgement number', bits: 32, tcpOnly: true, role: 'Next byte expected: every byte before it has arrived (cumulative).' },
    { name: 'TCP header length', bits: 4, tcpOnly: true, role: 'Header size in 32-bit words, 5–15 (20–60 bytes): where the data starts.' },
    { name: 'Unused', bits: 4, tcpOnly: true, role: 'Reserved, always 0.' },
    { name: 'CWR', bits: 1, flag: true, tcpOnly: true, role: 'Congestion Window Reduced: sender halved cwnd after an ECN echo.' },
    { name: 'ECE', bits: 1, flag: true, tcpOnly: true, role: 'ECN-Echo: tells the sender a router marked congestion.' },
    { name: 'URG', bits: 1, flag: true, tcpOnly: true, role: 'Urgent pointer is valid.' },
    { name: 'ACK', bits: 1, flag: true, tcpOnly: true, role: 'Acknowledgement number is valid (set on every segment after the SYN).' },
    { name: 'PSH', bits: 1, flag: true, tcpOnly: true, role: 'Push: deliver to the application now, don\'t buffer.' },
    { name: 'RST', bits: 1, flag: true, tcpOnly: true, role: 'Reset: abort the connection or reject a bad segment.' },
    { name: 'SYN', bits: 1, flag: true, tcpOnly: true, role: 'Synchronise sequence numbers: opens a connection.' },
    { name: 'FIN', bits: 1, flag: true, tcpOnly: true, role: 'No more data from this sender: closes one direction.' },
    { name: 'Window size', bits: 16, tcpOnly: true, role: 'Flow control: bytes the receiver can still buffer (stop 18).' },
    { name: 'Checksum', bits: 16, role: 'Header, data and pseudoheader. Always required.' },
    { name: 'Urgent pointer', bits: 16, tcpOnly: true, role: 'Offset of the end of urgent data (used with URG).' },
    { name: 'Options (0–40 bytes)', bits: 0, tcpOnly: true, role: 'e.g. MSS, window scale, timestamps, SACK. This is why the header length field exists.' }
  ];
  var UDP_BYTES = 8;
  // TCP header bytes from the header-length field (data offset, in 32-bit words).
  function tcpHeaderBytes(offset) {
    if (!(offset >= 5 && offset <= 15 && offset === Math.floor(offset))) return { error: 'Header length must be 5–15 words' };
    return { bytes: offset * 4, options: offset * 4 - 20 };
  }

  /* ---------------- connection establishment and release (time-space) ---------------- */
  // Messages: { from: 'C'|'S', label, sentAt, arriveAt, kind, lost, fate, note }.
  // kind: syn | synack | ack | rst | fin | old. One-way delay D ticks, retransmission timeout T ticks.
  var D = 3, T = 8;
  function msg(from, label, sentAt, extra) {
    var m = { from: from, label: label, sentAt: sentAt, arriveAt: sentAt + D, kind: 'ack', fate: 'ok', note: '' };
    for (var k in extra) m[k] = extra[k];
    return m;
  }

  // Normal handshake. lose: null | 0 (SYN) | 1 (SYN+ACK) | 2 (final ACK). Whoever is waiting retransmits.
  function handshake(o) {
    o = o || {};
    var x = wrap(o.x == null ? 1000 : o.x), y = wrap(o.y == null ? 5000 : o.y), lose = o.lose == null ? null : o.lose;
    var syn = 'SYN seq=' + x, synack = 'SYN+ACK seq=' + y + ' ack=' + wrap(x + 1), ack = 'ACK seq=' + wrap(x + 1) + ' ack=' + wrap(y + 1);
    var m = [], ev = [], t = 0;
    if (lose === 0) {
      m.push(msg('C', syn, 0, { kind: 'syn', lost: true, fate: 'lost', note: 'SYN lost' }));
      ev.push({ t: T, text: 'Client\'s SYN timer fires → resend SYN seq=' + x });
      t = T;
    }
    m.push(msg('C', syn, t, { kind: 'syn', copy: lose === 0 ? 2 : 1, note: 'Server: new connection request x=' + x }));
    t += D;
    if (lose === 1) {
      m.push(msg('S', synack, t, { kind: 'synack', lost: true, fate: 'lost', note: 'SYN+ACK lost' }));
      // the client's SYN timer started first, so it fires first; the server answers the repeat with the same y
      ev.push({ t: T, text: 'Client\'s SYN timer fires first (it started earlier) → resend SYN seq=' + x });
      m.push(msg('C', syn, T, { kind: 'syn', copy: 2, note: 'Server: same SYN again → repeat SYN+ACK seq=' + y }));
      t = T + D;
    }
    m.push(msg('S', synack, t, { kind: 'synack', copy: lose === 1 ? 2 : 1, note: 'Client: ack=' + wrap(x + 1) + ' matches its x+1 → ESTABLISHED' }));
    t += D;
    if (lose === 2) {
      var sentSA = t - D;
      m.push(msg('C', ack, t, { kind: 'ack', lost: true, fate: 'lost', note: 'ACK lost' }));
      ev.push({ t: sentSA + T, text: 'A pure ACK has no timer. Server\'s SYN+ACK timer fires → resend SYN+ACK seq=' + y });
      m.push(msg('S', synack, sentSA + T, { kind: 'synack', copy: 2, note: 'Client: duplicate SYN+ACK → ACK again' }));
      t = sentSA + T + D;
    }
    m.push(msg('C', ack, t, { kind: 'ack', copy: lose === 2 ? 2 : 1, note: 'Server: ack=' + wrap(y + 1) + ' = y+1 → ESTABLISHED' }));
    var end = t + D;
    return { msgs: m, events: ev, end: end, established: true, x: x, y: y, synAckAck: wrap(x + 1), ackAck: wrap(y + 1) };
  }

  // Old duplicate SYN (Tanenbaum case b): x' arrives from an old connection; the client rejects with RST.
  function oldSyn(o) {
    o = o || {};
    var xo = wrap(o.xOld == null ? 700 : o.xOld), y = wrap(o.y == null ? 5000 : o.y);
    var m = [
      msg('C', 'SYN seq=' + xo + ' (old duplicate)', 0, { kind: 'old', note: 'Server can\'t tell it\'s old → SYN+ACK' }),
      msg('S', 'SYN+ACK seq=' + y + ' ack=' + wrap(xo + 1), D, { kind: 'synack', fate: 'discard', note: 'Client never sent x\'=' + xo + ' → reject' }),
      msg('C', 'RST', 2 * D, { kind: 'rst', note: 'Server drops the half-open connection' })
    ];
    return { msgs: m, events: [], end: 3 * D, established: false, rst: true };
  }

  // Old SYN + old ACK (Tanenbaum case c): the old ACK carries ack=z; the server needs y+1.
  function oldSynAck(o) {
    o = o || {};
    var xo = wrap(o.xOld == null ? 700 : o.xOld), y = wrap(o.y == null ? 5000 : o.y), z = wrap(o.z == null ? 4000 : o.z);
    var accepted = z === wrap(y + 1);
    var m = [
      msg('C', 'SYN seq=' + xo + ' (old duplicate)', 0, { kind: 'old', note: 'Server can\'t tell it\'s old → SYN+ACK' }),
      msg('S', 'SYN+ACK seq=' + y + ' ack=' + wrap(xo + 1), D, { kind: 'synack', fate: 'discard', note: 'Client never sent x\'=' + xo + ' → reject' }),
      msg('C', 'ACK seq=' + wrap(xo + 1) + ' ack=' + z + ' (old duplicate)', D + 1, { kind: 'old', fate: accepted ? 'ok' : 'discard',
        note: accepted ? 'z = y+1: the old ACK is accepted!' : 'ack=' + z + ' ≠ y+1=' + wrap(y + 1) + ' → server rejects it' }),
      msg('C', 'RST', 2 * D, { kind: 'rst', note: 'Server drops the half-open connection' })
    ];
    return { msgs: m, events: [], end: 3 * D, established: accepted, rejected: !accepted, z: z };
  }

  // Release after the default handshake: FIN seq=x+1 → ACK → FIN seq=y+1 → ACK; client waits 2 MSL.
  function release(o) {
    o = o || {};
    var x = wrap(o.x == null ? 1000 : o.x), y = wrap(o.y == null ? 5000 : o.y), msl = o.msl || 4;
    var u = wrap(x + 1), v = wrap(y + 1);
    var m = [
      msg('C', 'FIN seq=' + u, 0, { kind: 'fin', note: 'Server: client is done sending' }),
      msg('S', 'ACK ack=' + wrap(u + 1), D, { kind: 'ack', note: 'Client: half closed, can still receive' }),
      msg('S', 'FIN seq=' + v, 2 * D + 1, { kind: 'fin', note: 'Client: server is done too' }),
      msg('C', 'ACK ack=' + wrap(v + 1), 3 * D + 1, { kind: 'ack', note: 'Server: CLOSED' })
    ];
    var tw = 3 * D + 1;
    var client = [[0, 'ESTABLISHED'], [0, 'FIN_WAIT_1'], [2 * D, 'FIN_WAIT_2'], [tw, 'TIME_WAIT'], [tw + 2 * msl, 'CLOSED']];
    var server = [[0, 'ESTABLISHED'], [D, 'CLOSE_WAIT'], [2 * D + 1, 'LAST_ACK'], [4 * D + 1, 'CLOSED']];
    return { msgs: m, events: [{ t: tw, text: 'Client enters TIME_WAIT = 2 × MSL' }, { t: tw + 2 * msl, text: 'TIME_WAIT over → CLOSED' }],
      end: tw + 2 * msl, timeWait: [tw, tw + 2 * msl], states: { client: client, server: server } };
  }
  function stateAt(list, t) { var s = list[0][1]; list.forEach(function (p) { if (t >= p[0]) s = p[1]; }); return s; }

  /* ---------------- flow control: receiver buffer + advertised window ---------------- */
  // Bytes are numbered from 0. Sender: sent (next byte), acked, win (last window it heard).
  // Receiver: rcvd (next byte expected), read (bytes the app has taken). Free = cap − (rcvd − read).
  function flow(cap) {
    var st = { cap: cap, sent: 0, acked: 0, win: cap, rcvd: 0, read: 0, inflight: null, deadlock: false, log: [] };
    function free() { return st.cap - (st.rcvd - st.read); }
    function say(text, cls) { st.log.push({ text: text, cls: cls || '' }); }
    // Sender writes n bytes: sends what fits the window. Returns the bytes sent (0 = blocked).
    st.send = function (n) {
      if (st.inflight) return 0;
      var usable = st.acked + st.win - st.sent;
      if (usable <= 0) { say('Sender blocked: window is 0' + (st.deadlock ? ' (it never heard the update)' : ''), 'bad'); return 0; }
      var k = Math.min(n, usable);
      st.inflight = { seq: st.sent, len: k };
      st.sent += k;
      say('Sender: SEQ=' + st.inflight.seq + ', ' + k + ' bytes' + (k < n ? ' (only ' + k + ' fit the window)' : ''));
      return k;
    };
    // The segment in flight arrives; the receiver ACKs it with its free space.
    st.deliver = function () {
      if (!st.inflight) return null;
      st.rcvd += st.inflight.len;
      st.inflight = null;
      st.acked = st.rcvd; st.win = free();
      say('Receiver: ACK=' + st.acked + ' WIN=' + st.win, st.win === 0 ? 'warnc' : 'ok');
      return { ack: st.acked, win: st.win };
    };
    // The application reads up to n bytes; the receiver announces the new window (lost if lose).
    st.readApp = function (n, lose) {
      var k = Math.min(n, st.rcvd - st.read);
      st.read += k;
      var w = free();
      if (lose) {
        say('App reads ' + k + ' bytes. Update ACK=' + st.rcvd + ' WIN=' + w + ' lost ✕', 'bad');
        if (st.win === 0) st.deadlock = true;
      } else {
        st.acked = st.rcvd; st.win = w;
        say('App reads ' + k + ' bytes → ACK=' + st.rcvd + ' WIN=' + w, 'ok');
      }
      return { read: k, ack: st.rcvd, win: w };
    };
    // Persist timer fires while the window is 0: 1-byte probe; the reply re-announces the window.
    st.probe = function () {
      if (st.win !== 0 || st.inflight) return null;
      var room = free() > 0;
      say('Persist timer fires → window probe, 1 byte SEQ=' + st.sent, 'warnc');
      if (room) { st.sent += 1; st.rcvd += 1; }
      st.acked = st.rcvd; st.win = free(); st.deadlock = false;
      say('Receiver: ACK=' + st.acked + ' WIN=' + st.win + (room ? ' (the probe byte fit)' : ' (still full)'), st.win ? 'ok' : 'warnc');
      return { ack: st.acked, win: st.win };
    };
    st.free = free;
    return st;
  }

  /* ---------------- RTO (RFC 6298, Jacobson) + Karn ---------------- */
  // samples: [{ r, retx }] or numbers. order: 'rfc' (RTTVAR first, old SRTT) | 'srttFirst'.
  function rtoTable(samples, order) {
    var srtt = null, rttvar = null, rto = null, rows = [];
    samples.forEach(function (sm) {
      var r = typeof sm === 'number' ? sm : sm.r, retx = typeof sm === 'object' && !!sm.retx;
      if (retx) {
        // Karn: no sample from a retransmitted segment; the timeout that caused it doubled the RTO
        rto = rto == null ? null : rto * 2;
        rows.push({ r: r, ignored: true, srtt: srtt, rttvar: rttvar, rto: rto });
        return;
      }
      if (srtt == null) { srtt = r; rttvar = r / 2; }
      else if (order === 'srttFirst') { srtt = 7 / 8 * srtt + 1 / 8 * r; rttvar = 3 / 4 * rttvar + 1 / 4 * Math.abs(srtt - r); }
      else { rttvar = 3 / 4 * rttvar + 1 / 4 * Math.abs(srtt - r); srtt = 7 / 8 * srtt + 1 / 8 * r; }
      rto = srtt + 4 * rttvar;
      rows.push({ r: r, ignored: false, srtt: srtt, rttvar: rttvar, rto: rto });
    });
    return rows;
  }

  /* ---------------- congestion window (Tanenbaum's Tahoe figure, Reno) ---------------- */
  // A loss happens in any round where cwnd > capacity. o: { ssthresh, capacity, variant, loss, rounds }.
  function cwndTrace(o) {
    o = o || {};
    var ss = o.ssthresh == null ? 32 : o.ssthresh, cap = o.capacity == null ? 39 : o.capacity;
    var variant = o.variant || 'tahoe', lossType = o.loss || 'dupack', n = o.rounds || 24;
    var cwnd = 1, rows = [];
    for (var r = 1; r <= n; r++) {
      var row = { round: r, cwnd: cwnd, ssthresh: ss, phase: cwnd < ss ? 'slow start' : 'congestion avoidance', loss: false };
      if (cwnd > cap) {
        row.loss = true;
        var newSs = Math.max(2, Math.floor(cwnd / 2));
        var fast = variant === 'reno' && lossType === 'dupack';
        row.event = (lossType === 'dupack' ? '3 dup ACKs' : 'timeout') + ' → ssthresh ' + newSs + ', cwnd ' + (fast ? newSs + ' (fast recovery)' : '1');
        ss = newSs;
        cwnd = fast ? ss : 1;
      } else {
        cwnd = cwnd < ss ? Math.min(2 * cwnd, ss) : cwnd + 1;
      }
      rows.push(row);
    }
    return rows;
  }

  // Toll booth for one round: serves up to 30, queues up to capacity − 30, drops the rest.
  // The queue drains before the next round, so only a window above capacity loses trucks.
  function road(cwnd, capacity) {
    var cap = capacity == null ? 39 : capacity;
    var serve = Math.min(30, cap), hold = cap - serve;
    var served = Math.min(cwnd, serve), queued = Math.min(cwnd - served, hold);
    return { served: served, queued: queued, dropped: cwnd - served - queued, serve: serve, hold: hold };
  }

  CN.tcp = {
    UDP: UDP, TCP: TCP, UDP_BYTES: UDP_BYTES, tcpHeaderBytes: tcpHeaderBytes, wrap: wrap, D: D, T: T,
    handshake: handshake, oldSyn: oldSyn, oldSynAck: oldSynAck, release: release, stateAt: stateAt,
    flow: flow, rtoTable: rtoTable, cwndTrace: cwndTrace, road: road
  };
})(typeof window !== 'undefined' ? window : globalThis);
