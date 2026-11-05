/* SPEC-v7 worked-example tables, built from the same libs as the sims. LEARN.md marks a table with
   <!-- gen: name --> … <!-- /gen -->; the static table there must equal gen(name, example) (tested), and on an
   E slide the learn pane swaps in gen(name, the typed numbers). Each row's `step` is the learnStep() value
   at which the pane highlights it (null: never). Pure functions over CN.*, no DOM. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function table(head, rows) { return { head: head, rows: rows }; }
  function row(cells, step) { return { cells: cells.map(String), step: step == null ? null : step }; }
  function num(v) { return v == null ? '—' : String(Math.round(v * 1e9) / 1e9); }
  function bin(n, w) { var s = n.toString(2); while (s.length < w) s = '0' + s; return s; }

  /* ---------- Hamming (2a, 2b): data bits, even parity, Tanenbaum's layout ---------- */
  function hammingEncode(text) {
    var v = CN.hamming.validate(text); if (v.error) return v;
    var enc = CN.hamming.encode(v.bits, 'even');
    var rows = enc.checks.map(function (c, i) {
      return row(['P' + c.pos, c.covers.join(', '), c.values.join('⊕'), c.value], i + 1);
    });
    rows.push(row(['Codeword', 'positions 1–' + enc.n, '', enc.code], enc.checks.length));
    return table(['Check bit', 'Data positions it covers', 'Their bits, XORed', 'Value'], rows);
  }
  // 2b's Step flips bit 5 (or the last bit of a shorter codeword), then corrects it.
  function hammingCorrect(text) {
    var v = CN.hamming.validate(text); if (v.error) return v;
    var code = CN.hamming.encode(v.bits, 'even').code, at = Math.min(5, code.length);
    var rx = CN.hamming.flip(code, [at]), d = CN.hamming.diagnose(code, rx, 'even');
    var rows = [row(['Received', 'bit ' + at + ' flipped', '', rx], 1)];
    d.checks.forEach(function (c) {
      rows.push(row(['C' + c.pos, c.covers.join(', '), c.values.join('⊕') + ' = ' + c.parity, c.ok ? '✓ passes' : '✕ fails'], 1));
    });
    var failing = d.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.pos; });
    rows.push(row(['Syndrome', 'sum of the failing checks', failing.join(' + '), bin(d.syndrome, d.checks.length) + '₂ = ' + d.syndrome], 1));
    rows.push(row(['Corrected', 'bit ' + d.syndrome + ' flipped back', '', d.corrected], 2));
    return table(['Check', 'Positions (itself included)', 'Received bits, XORed', 'Result'], rows);
  }

  /* ---------- CRC (3a, 3b): 'message / generator' ---------- */
  function crcParse(text) { var p = CN.crc.parseCustom(text); return p.error ? p : CN.crc.encode(p.data, p.gen); }
  function crcDivide(text) {
    var enc = crcParse(text); if (enc.error) return enc;
    var rows = enc.steps.map(function (s, i) {
      return row([i + 1, s.window, s.qbit, s.sub, s.result], i + 1);
    });
    rows.push(row(['Remainder', '', '', '', enc.remainder], enc.steps.length));
    rows.push(row(['Frame sent', '', '', '', enc.frame], enc.steps.length));
    return table(['Step', 'Bits under G', 'Quotient bit', 'XOR with', 'Result'], rows);
  }
  // 3b's Step flips a burst of min(3, r) bits from bit 3 (0-based, as the screen does).
  function crcCheck(text) {
    var enc = crcParse(text); if (enc.error) return enc;
    var len = Math.min(3, enc.r), at = Math.min(3, enc.frame.length - len);
    var b = CN.crc.burst(enc.frame, at, len).frame, ok = CN.crc.check(enc.frame, enc.gen), bad = CN.crc.check(b, enc.gen);
    return table(['Received frame', 'Remainder after ÷ G', 'Verdict'], [
      row([enc.frame, ok.remainder, 'remainder 0: accepted'], 0),
      row([b, bad.remainder, bad.ok ? 'remainder 0: slips through' : 'burst of ' + len + ' (bits ' + (at + 1) + '–' + (at + len) + ' from the left): detected'], 1)
    ]);
  }

  /* ---------- Sliding window (5a, 5b, 5c): n = 3, 8 frames, delay 3, timer 8; one row per Step ---------- */
  function arqRun(proto, W, drop, stopAt, o) {
    o = o || {};
    var A = CN.arq, s = A.create({ proto: proto, n: o.n || 3, W: W, total: o.total || 8, delay: 3, timeout: o.timeout || 8, noAck: !!o.noAck, drop: drop });
    var rows = [], seen = 0, handled = {}, logN = 0, k = 0;
    function name(m) { return (m.kind === 'data' ? 'frame ' : m.kind === 'ack' ? 'ACK ' : 'NAK ') + m.seq; }
    while (!(s.done || (stopAt && s.tick >= stopAt)) && k < 200) {
      var t0 = s.tick;
      A.stepToEvent(s); k++;
      var ev = [];
      s.msgs.forEach(function (m) {
        if (!m.handled || handled[m.id]) return;
        handled[m.id] = true;
        ev.push(name(m).replace(/^./, function (c) { return c.toUpperCase(); }) + ' arrives: ' + m.note.replace(/^./, function (c) { return c.toLowerCase(); }));
      });
      s.log.slice(logN).forEach(function (l) { if (/^(Timeout|Old frame)/.test(l.text)) ev.push(l.text); });
      logN = s.log.length;
      s.msgs.slice(seen).forEach(function (m) {
        var who = m.from === 'S' ? 'Sender ' : 'Receiver ';
        ev.push(who + (m.kind === 'data' && m.copy > 1 ? 'resends ' : 'sends ') + name(m) + (m.lost ? ' (lost ✕)' : ''));
      });
      seen = s.msgs.length;
      rows.push(row([k, t0 === s.tick - 1 ? t0 : t0 + '–' + (s.tick - 1), ev.join('; ')], k));
    }
    return { rows: rows, sim: s };
  }
  function arqTable(proto) {
    return function (text) {
      var p = CN.arq.parseLoss(text, 8); if (p.error) return p;
      var r = arqRun(proto, 4, CN.arq.firstCopyDrop(p.list));
      return table(['Step', 't', 'What happens'], r.rows);
    };
  }
  // 4c: Protocol 3 (n = 1, W = 1, 6 frames); frame 1 lost once, then the first ACK for frame 2 (as the screen scripts it)
  function arqP3() {
    var ackLost = false, drop = function (m) {
      if (m.kind === 'data') return m.abs === 1 && m.copy === 1;
      if (m.abs === 2 && !ackLost) { ackLost = true; return true; }
      return false;
    };
    return table(['Step', 't', 'What happens'], arqRun('gbn', 1, drop, null, { n: 1, total: 6 }).rows);
  }
  function arqTrap() {
    var r = arqRun('sr', 7, CN.arq.scriptedDrop([], 11), 16);
    return table(['Step', 't', 'What happens'], r.rows);
  }

  /* ---------- CSMA (7a–7d): seed 42; one row per log line, step = the log length after that tick ---------- */
  var WAIT = [{ at: 0, st: 1 }, { at: 4, st: 0 }, { at: 4, st: 2 }], FAR = [{ at: 0, st: 0 }, { at: 0, st: 3 }];
  function csmaTable(mode, cd, schedule) {
    return function () {
      var b = CN.csma.createBus({ mode: mode, p: 0.5, cd: cd, seed: 42, schedule: schedule.map(function (e) { return Object.assign({}, e); }) });
      var rows = [], guard = 0;
      while (!b.done && guard++ < 2000) {
        var n = b.log.length;
        b.step();
        b.log.slice(n).forEach(function (l) { rows.push(row([l.t, l.text], b.log.length)); });
      }
      return table(['t', 'Event'], rows);
    };
  }

  /* ---------- Distance vector (12a–12c): Tanenbaum's chain A–B–C–D–E, distances to A ---------- */
  var DV_NODES = ['A', 'B', 'C', 'D', 'E'], DV_LINKS = [['A', 'B', 1], ['B', 'C', 1], ['C', 'D', 1], ['D', 'E', 1]];
  function dvTable(kind) {
    return function () {
      var D = CN.dv, poison = kind === 'poison', net = D.reset(D.create(DV_NODES, DV_LINKS, { inf: 16, poison: poison }));
      if (kind === 'good') { D.setRouter(net, 'A', false); D.converge(net); D.setRouter(net, 'A', true); }
      else { D.converge(net); D.setRouter(net, 'A', false); }
      function fmt(v) { return v >= 16 ? (poison ? '16' : '∞') : String(v); }
      var rows = [], k = 0, cols = D.column(net, 'A', ['B', 'C', 'D', 'E']);
      rows.push(row(['Initially'].concat(cols.map(fmt)), 0));
      while (k < 40) {
        if (D.exchange(net).length === 0) break;
        k++;
        rows.push(row(['After ' + k + ' exchange' + (k > 1 ? 's' : '')].concat(D.column(net, 'A', ['B', 'C', 'D', 'E']).map(fmt)), k));
      }
      return table(['', 'B', 'C', 'D', 'E'], rows);
    };
  }

  /* ---------- TCP connection scenarios (17a–17d): x 1000, y 5000, old x' 700, old ACK z 4000 ---------- */
  function tcpScenario(build) {
    return function () {
      var sc = CN.tcp[build]({ x: 1000, y: 5000, xOld: 700, z: 4000 });
      return table(['#', 'Sent at t', 'Direction', 'Segment', 'On arrival'], sc.msgs.map(function (m, i) {
        return row([i + 1, m.sentAt, m.from === 'C' ? 'client → server' : 'server → client', m.label, m.note], i + 1);
      }));
    };
  }

  /* ---------- RTO (19b; 19c with Karn's rule on sample 3): RFC 6298 order ---------- */
  function rtoTable(text) {
    var p = CN.tcp.parseSamples(text); if (p.error) return p;
    var rows = CN.tcp.rtoTable(p.samples, 'rfc');
    return table(['#', 'R (ms)', 'Retransmitted?', 'RTTVAR', 'SRTT', 'RTO'], rows.map(function (r, i) {
      return row([i + 1, num(r.r), p.samples[i].retx ? 'yes: ignored (Karn)' : 'no', num(r.rttvar), num(r.srtt), num(r.rto) + (r.ignored ? ' (doubled)' : '')], null);
    }));
  }

  /* ---------- TCP congestion (20a, 20b): ssthresh 32, capacity 39, loss by 3 duplicate ACKs ---------- */
  function cwndTable(variant) {
    return function () {
      var rows = CN.tcp.cwndTrace({ ssthresh: 32, capacity: 39, variant: variant, loss: 'dupack', rounds: 24 });
      return table(['Round', 'cwnd', 'ssthresh', 'Phase or event'], rows.map(function (r) {
        return row([r.round, r.cwnd, r.ssthresh, r.loss ? 'loss: ' + r.event : r.phase], r.round);
      }));
    };
  }

  /* ---------- DNS (21a, 21b): www.example.com, a fresh resolver ---------- */
  function dnsTable(mode) {
    return function () {
      var w = CN.dns.resolver(30).lookup('www.example.com', mode, 0);
      function who(x) { return x === 'client' ? 'phone' : x === 'resolver' ? 'local resolver' : w.zones[x].server; }
      return table(['#', 'From', 'To', 'Message'], w.steps.map(function (m, i) {
        return row([i + 1, who(m.from), who(m.to), m.text], i + 1);
      }));
    };
  }

  /* ---------- Frequency crack (24c) ---------- */
  function crackTable() {
    var C = CN.cipher, ct = C.mono(C.CRACK_TEXT, C.DEFAULT_KEY, false).text, r = C.crack(ct, C.DEFAULT_KEY), n = r.ranked.length;
    return table(['Step', 'What changes', 'Letters right'], r.steps.map(function (s, i) {
      return row([i + 1, i === 0 ? 'Pass 1: rank-match the ciphertext letters to English order (e t a o i n s h r d l c u)' : s.fix.reason, s.right + ' of ' + n], i + 1);
    }));
  }

  /* ---------- IPv4 address (15c): a.b.c.d/p ---------- */
  function ipTable(text) {
    var p = CN.ip.parseCIDR(text);
    if (p.error) return p;
    if (!/\//.test(text)) return { error: 'Write the prefix as /p, e.g. /26' };
    var r = CN.ip.subnet(CN.ip.str(p.ip) + '/' + p.len), rows = [
      row(['Address', r.ipStr, r.working.map(function (w) { return w.ipBin; }).join('.')]),
      row(['Mask (/' + r.len + ')', r.maskStr, r.working.map(function (w) { return w.maskBin; }).join('.')]),
      row(['Network = address AND mask', r.networkStr, r.working.map(function (w) { return w.netBin; }).join('.')])
    ];
    if (r.len <= 30) {
      rows.push(row(['Broadcast = host bits all 1', r.broadcastStr, '']));
      rows.push(row(['First and last usable', r.firstStr + ' – ' + r.lastStr, '']));
      rows.push(row(['Usable hosts', '2^' + r.hostBits + ' − 2 = ' + r.usable, '']));
    } else if (r.len === 31) rows.push(row(['Usable (/31, RFC 3021)', r.firstStr + ' and ' + r.lastStr, 'no broadcast']));
    else rows.push(row(['Usable (/32)', r.firstStr, 'one host, no broadcast']));
    return table(['', 'Dotted decimal', 'Binary'], rows);
  }

  /* ---------- RSA (25a, 25b): 'p q d', message SUZANNE ---------- */
  function rsaKeys(text) {
    var k = CN.rsa.parseKey(text); if (k.error) return k;
    return table(['Quantity', 'Working', 'Value'], [
      row(['n', 'p·q = ' + k.p + '·' + k.q, k.n]),
      row(['z', '(p−1)(q−1) = ' + (k.p - 1) + '·' + (k.q - 1), k.z]),
      row(['d', 'chosen, gcd(' + k.d + ', ' + k.z + ') = 1', k.d]),
      row(['e', 'e·d ≡ 1 (mod ' + k.z + '): ' + k.e + '·' + k.d + ' = ' + k.e * k.d + ' = ' + Math.floor(k.e * k.d / k.z) + '·' + k.z + ' + 1', k.e]),
      row(['Public key', '(e, n)', '(' + k.e + ', ' + k.n + ')']),
      row(['Private key', '(d, n)', '(' + k.d + ', ' + k.n + ')'])
    ]);
  }
  function rsaEncrypt(text) {
    var k = CN.rsa.parseKey(text); if (k.error) return k;
    var P = CN.rsa.letters('SUZANNE');
    return table(['Letter', 'P', 'Pᵉ', 'C = Pᵉ mod ' + k.n, 'Cᵈ mod ' + k.n, 'Back to'], P.map(function (p, i) {
      var c = CN.rsa.modpow(p, k.e, k.n), back = CN.rsa.modpow(c.value, k.d, k.n).value;
      return row([String.fromCharCode(64 + p), p, c.full || '(large)', c.value, back, String.fromCharCode(64 + back)], i + 1);
    }));
  }

  /* ---------- Checked-only tables (no E input): each worked number in LEARN.md comes from a lib ---------- */
  function framingCount() {
    var stream = [5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 0, 1, 2, 3, 4, 5, 6, 8, 7, 8, 9, 0, 1, 2, 3], bad = stream.slice();
    bad[5] = 7;
    function show(fr) { return fr.map(function (f) { return '[' + f.bytes.join(' ') + ']' + (f.short ? ' (runs off the end)' : ''); }).join(' '); }
    return table(['Stream', 'Frames the receiver reads'], [
      row(['As sent', show(CN.framing.byteCountFrames(stream))], 0),
      row(['2nd count hit, 5 → 7', show(CN.framing.byteCountFrames(bad))], 1)
    ]);
  }
  function framingBytes() {
    var r = CN.framing.byteStuff('A ESC FLAG B');
    return table(['Stage', 'Bytes'], [
      row(['Data', r.input.join(' ')], 0), row(['Sent (stuffed)', r.out.join(' ')], 0),
      row(['Receiver, ESCs removed', CN.framing.byteDestuff(r.out).out.join(' ')], 1)
    ]);
  }
  function framingBits() {
    var r = CN.framing.bitStuff('011011111111111111110010');
    return table(['Stage', 'Bits'], [
      row(['Data', r.input], 0), row(['Sent (stuffed, between flags)', r.out], 0),
      row(['Receiver, stuffed 0s removed', CN.framing.bitDestuff(r.out).out], 1)
    ]);
  }
  function countdown() {
    var r = CN.csma.binaryCountdown(['0010', '0100', '1001', '1010']), alive = r.addrs.map(function () { return true; });
    var rows = r.steps.map(function (s, b) {
      var sent = r.addrs.filter(function (_, i) { return alive[i]; }).map(function (a) { return a + ': ' + a[b]; });
      var out = s.dropped.map(function (i) { return r.addrs[i]; });
      s.dropped.forEach(function (i) { alive[i] = false; });
      return row([b + 1, sent.join(', '), s.or, out.length ? out.join(', ') + ' drop out' : 'nobody drops'], b + 1);
    });
    rows.push(row(['Winner', r.winnerAddr, '', ''], r.steps.length));
    return table(['Bit time', 'Bits sent (still in)', 'Channel (OR)', 'Result'], rows);
  }
  var GN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], GE = [['A', 'B', 2], ['A', 'G', 6], ['B', 'C', 7], ['B', 'E', 2], ['C', 'D', 3], ['C', 'F', 3],
    ['D', 'H', 2], ['E', 'F', 2], ['E', 'G', 1], ['F', 'H', 2], ['G', 'H', 4]];
  function flood() {
    return table(['Hop', 'Copies sent', 'Duplicates', 'Total so far', 'Routers reached'], CN.graph.flood(GN, GE, 'A', 3, false).map(function (r, i) {
      return row([i + 1, r.sent.length, r.dups, r.total, r.reached], i + 1);
    }));
  }
  function dijkstraTable(nodes, edges, src) {
    var r = CN.graph.dijkstra(nodes, edges, src);
    return table(['Step', 'Made permanent', 'Neighbours relaxed', 'Tentative labels after the step'], r.steps.slice(1).map(function (s, i) {
      var tent = nodes.filter(function (n) { return !s.labels[n].perm && s.labels[n].dist < Infinity; })
        .map(function (n) { return n + ' (' + s.labels[n].dist + ', ' + s.labels[n].pred + ')'; });
      return row([i + 1, s.perm + ' (' + s.labels[s.perm].dist + (s.labels[s.perm].pred ? ', ' + s.labels[s.perm].pred : '') + ')',
        s.relaxed.length ? s.relaxed.map(function (n) { return n + ' → ' + s.labels[n].dist; }).join(', ') : 'none', tent.join(', ') || 'none'], i + 1);
    }));
  }
  function fragTable() {
    var r = CN.ip.fragment(4000, 1500);
    return table(['Fragment', 'Data bytes', 'Total length', 'Offset (÷ 8)', 'MF'], r.fragments.map(function (f, i) {
      return row([i + 1, f.start + '–' + (f.start + f.dataBytes - 1), f.totalLength, f.offset + ' (' + f.start + ' ÷ 8)', f.mf ? 1 : 0]);
    }));
  }
  function splitTable() {
    var sp = CN.ip.split('192.168.10.64/26', 2);
    return table(['Subnet', 'Network', 'Broadcast', 'Usable hosts'], sp.subnets.map(function (x, i) {
      var r = CN.ip.subnet(x.str);
      return row([i + 1, x.str, r.broadcastStr, r.firstStr + ' – ' + r.lastStr + ' (' + r.usable + ')']);
    }));
  }
  function lpmTable() {
    var routes = [{ name: 'Cambridge', prefix: '194.24.0.0', len: 21 }, { name: 'Edinburgh', prefix: '194.24.8.0', len: 22 }, { name: 'Oxford', prefix: '194.24.16.0', len: 20 }];
    var r = CN.ip.lpm('194.24.17.4', routes);
    return table(['Route', 'Prefix', '194.24.17.4 AND mask', 'Match?'], routes.map(function (x, i) {
      var m = CN.ip.subnet('194.24.17.4/' + x.len).networkStr;
      return row([x.name, x.prefix + '/' + x.len, m, m === x.prefix ? (r.best === i ? 'yes, longest → chosen' : 'yes') : 'no']);
    }));
  }
  function v6Table() {
    return table(['Full address', 'Shortest form'], ['2001:0db8:0000:0000:0000:ff00:0042:8329', '8000:0000:0000:0000:0123:4567:89AB:CDEF'].map(function (a) {
      return row([a, CN.ip.compress6(a).short]);
    }));
  }
  function flowTable() {
    var f = CN.tcp.flow(4096), rows = [];
    function after(what, fn) { var n = f.log.length; fn(); rows.push(row([rows.length + 1, what, f.log.slice(n).map(function (l) { return l.text; }).join('; ')])); }
    after('Sender writes 2 KB', function () { f.send(2048); f.deliver(); });
    after('Sender writes 2 KB', function () { f.send(2048); f.deliver(); });
    after('App reads 2 KB', function () { f.readApp(2048); });
    after('Sender writes 2 KB', function () { f.send(2048); f.deliver(); });
    after('App reads 2 KB, update lost', function () { f.readApp(2048, true); });
    after('Sender tries to write', function () { f.send(2048); });
    after('Persist timer fires', function () { f.probe(); });
    return table(['#', 'Action', 'What the screen shows'], rows);
  }
  function httpTable() {
    return table(['Mode', 'RTTs for 1 HTML + 10 images', 'At 100 ms per RTT'], [['nonpersistent', 'Non-persistent'], ['persistent', 'Persistent'], ['pipelined', 'Persistent + pipelining']].map(function (m) {
      var n = CN.http.rtts(10, m[0]);
      return row([m[1], n, (n * 100 / 1000) + ' s']);
    }));
  }
  function caesarTable() {
    return table(['Plaintext', 'Key', 'Ciphertext'], [row(['ATTACK', 'k = 3', CN.cipher.caesar('ATTACK', 3, false)]), row(['HELLO', 'k = 3', CN.cipher.caesar('HELLO', 3, false)])]);
  }
  function monoTable() {
    var C = CN.cipher, p = 'the network layer moves packets';
    return table(['', 'Text'], [row(['Key (cipher letters for a … z)', C.DEFAULT_KEY]), row(['Plaintext', p]), row(['Ciphertext', C.mono(p, C.DEFAULT_KEY, false).text])]);
  }
  function columnarTable() {
    var r = CN.cipher.transpose('MEGABUCK', 'pleasetransferonemilliondollarstomyswissbankaccountsixtwotwo');
    return table(['Key letter', 'Rank', 'Column read (top to bottom)'], r.key.split('').map(function (ch, i) {
      return row([ch, r.rank[i], r.rows.map(function (rw) { return rw[i]; }).join('')]);
    }).concat([row(['Ciphertext', '', r.cipher])]));
  }
  function base64Table() {
    function b64(t) { return typeof btoa === 'function' ? btoa(t) : Buffer.from(t, 'binary').toString('base64'); }
    return table(['Text', 'Bytes', 'Bits', 'base64'], ['Hi', 'Hi!'].map(function (t) {
      return row(['"' + t + '"', t.length, t.split('').map(function (c) { return bin(c.charCodeAt(0), 8); }).join(' '), b64(t)]);
    }));
  }

  var GEN = {
    'framing.count': framingCount, 'framing.bytes': framingBytes, 'framing.bits': framingBits, 'csma.countdown': countdown,
    'graph.flood': flood, 'graph.dijkstra': function () { return dijkstraTable(GN, GE, 'A'); },
    'graph.linkstate': function () {
      return dijkstraTable(['A', 'B', 'C', 'D', 'E', 'F'], [['A', 'B', 2], ['A', 'C', 5], ['B', 'C', 1], ['B', 'D', 4], ['C', 'E', 3], ['D', 'E', 1], ['D', 'F', 2], ['E', 'F', 6]], 'B');
    },
    'ip.frag': fragTable, 'ip.split': splitTable, 'ip.lpm': lpmTable, 'ip.v6': v6Table, 'tcp.flow': flowTable, 'http.rtt': httpTable,
    'cipher.caesar': caesarTable, 'cipher.mono': monoTable, 'cipher.columnar': columnarTable, 'mail.base64': base64Table,
    'hamming.encode': hammingEncode, 'hamming.correct': hammingCorrect,
    'crc.divide': crcDivide, 'crc.check': crcCheck,
    'arq.p3': arqP3, 'arq.gbn': arqTable('gbn'), 'arq.sr': arqTable('sr'), 'arq.trap': arqTrap,
    'csma.1p': csmaTable('1p', false, WAIT), 'csma.np': csmaTable('np', false, WAIT), 'csma.pp': csmaTable('pp', false, WAIT), 'csma.cd': csmaTable('1p', true, FAR),
    'dv.good': dvTable('good'), 'dv.bad': dvTable('bad'), 'dv.poison': dvTable('poison'),
    'tcp.handshake': tcpScenario('handshake'), 'tcp.oldSyn': tcpScenario('oldSyn'), 'tcp.oldSynAck': tcpScenario('oldSynAck'), 'tcp.release': tcpScenario('release'),
    'tcp.rto': rtoTable, 'tcp.karn': rtoTable, 'tcp.tahoe': cwndTable('tahoe'), 'tcp.reno': cwndTable('reno'),
    'dns.iterative': dnsTable('iterative'), 'dns.recursive': dnsTable('recursive'),
    'cipher.crack': crackTable, 'ip.addr': ipTable, 'rsa.keys': rsaKeys, 'rsa.encrypt': rsaEncrypt
  };
  // The slide's own example for each table: what gen() gets when no E numbers are in use.
  var DEFAULTS = {
    'hamming.encode': '1000001', 'hamming.correct': '1000001', 'crc.divide': '1101011111 / 10011', 'crc.check': '1101011111 / 10011',
    'arq.gbn': 'frame 1', 'arq.sr': 'frame 1', 'tcp.rto': '100 120 80 200', 'tcp.karn': '100 120 80* 200', 'ip.addr': '192.168.10.77/26', 'rsa.keys': '3 11 7', 'rsa.encrypt': '3 11 7'
  };

  // gen(name, text): text = the E numbers (or the default). → { head, rows } or { error }.
  CN.learnGen = function (name, text) {
    var f = GEN[name];
    if (!f) return { error: 'No table generator "' + name + '"' };
    return f(text == null ? DEFAULTS[name] : text);
  };
  CN.learnGen.names = Object.keys(GEN);
  CN.learnGen.defaults = DEFAULTS;
})(typeof window !== 'undefined' ? window : globalThis);
