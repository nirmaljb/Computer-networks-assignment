(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, R = CN.rsa;

  // SPEC-v5: Tanenbaum's example, p 3, q 11, d 7, "SUZANNE" (A = 1 … Z = 26). 25a key generation,
  // 25b encrypt + decrypt (one letter per Step), then static: symmetric vs public key, firewall, IDS.
  // SPEC-v6: E on 25a/25b takes 'p q d' (rsa.js rules). 25b is the mod-n dial while n ≤ 150, else the table.
  // SPEC-v8: p, q, d are handles. On 25a they are chips (primes with 26 < n ≤ 150, p ≠ q) and a slider over the
  // valid d (coprime to z) with one notch below them, d = 2: z is always even, so gcd(2, z) = 2 and no e exists (the
  // taught break). 25b keeps p, q, d (from E) and adds a tap: a letter of the message, to run only its hops.
  var KEY = R.keygen('3', '11', '7'), MSG = 'SUZANNE', s = CN.s;
  var PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];
  function keyHandles(chips) {
    var hs = {};
    function okN(p, q) { return p !== q && p * q > 26 && p * q <= R.DIAL_MAX; }
    hs.p = ui.handle({ key: 'p', label: 'p', kind: chips ? 'chips' : 'tap', value: KEY.p, values: PRIMES, disabled: function (v) { return hs.q && !okN(v, hs.q.value()); } });
    hs.q = ui.handle({ key: 'q', label: 'q', kind: chips ? 'chips' : 'tap', value: KEY.q, values: PRIMES, disabled: function (v) { return !okN(hs.p.value(), v); } });
    hs.d = ui.handle({ key: 'd', label: 'd', kind: chips ? 'slider' : 'tap', value: KEY.d, width: 520, breaks: { 2: 'gcd(2, z) ≠ 1: no e' },
      values: function () {
        var z = (hs.p.value() - 1) * (hs.q.value() - 1), v = [2];
        for (var d = 3; d < z; d++) if (R.gcd(d, z) === 1) v.push(d);
        return v;
      } });
    hs.p.draw();
    hs.key = function () { return R.keygen(hs.p.value(), hs.q.value(), hs.d.value()); };
    hs.text = function () { return hs.p.value() + ' ' + hs.q.value() + ' ' + hs.d.value(); };
    return hs;
  }
  function numbers(hs) {
    return ui.numbers({ label: 'p q d: two primes and d coprime to z = (p−1)(q−1)', example: KEY.p + ' ' + KEY.q + ' ' + KEY.d, parse: R.parseKey,
      read: hs.text, write: function (v) { hs.p.set(v.p, true); hs.q.set(v.q, true); hs.d.set(v.d, true); } });
  }

  function keys(body) {
    var hs = keyHandles(true), host = h('div', { style: { display: 'contents' } });
    body.appendChild(host);
    body.appendChild(h('div', { class: 'col', style: { gap: '12px', alignItems: 'center' } }, ui.handleRow(hs.p), ui.handleRow(hs.q), ui.handleRow(hs.d)));
    function reset() {
      hs.p.draw(); hs.q.draw(); hs.d.fit();
      var k = hs.key();
      CN.clear(host);
      if (!k.error) keysInto(host, k);
      else {
        var z = (hs.p.value() - 1) * (hs.q.value() - 1);
        host.appendChild(h('div', { class: 'panel col', style: { gap: '18px', fontSize: '30px', padding: '28px', marginTop: '20px' } },
          h('div', { class: 'mono' }, 'n = ' + hs.p.value() + '·' + hs.q.value() + ' = ' + hs.p.value() * hs.q.value() + '     z = ' + z),
          h('div', { class: 'banner err' }, 'd = ' + hs.d.value() + ': gcd(' + hs.d.value() + ', ' + z + ') = ' + R.gcd(hs.d.value(), z) + ' ≠ 1, so e·d ≡ 1 (mod z) has no solution: no e.')));
      }
    }
    reset();
    return { reset: reset, input: numbers(hs) };
  }
  function keysInto(body, k) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '32px', padding: '32px', marginTop: '30px' } },
      h('div', { class: 'mono' }, 'n = p·q = ' + k.p + '·' + k.q + ' = ', h('b', null, String(k.n)), '     z = (p−1)(q−1) = ', h('b', null, String(k.z))),
      h('div', { class: 'mono' }, 'd = ' + k.d + ', gcd(' + k.d + ', ' + k.z + ') = 1 ✓'),
      h('div', { class: 'mono' }, 'e·d ≡ 1 (mod z) → e = ', h('b', null, String(k.e)), '   (' + k.e + '·' + k.d + ' = ' + k.e * k.d + ' = ' + Math.floor(k.e * k.d / k.z) + '·' + k.z + ' + 1)'),
      h('div', null, h('b', { class: 'ok' }, 'Public key (e, n) = (' + k.e + ', ' + k.n + ')'), '      ', h('b', { class: 'bad' }, 'Private key (d, n) = (' + k.d + ', ' + k.n + ')'))));
    body.appendChild(h('div', { class: 'say' }, 'Security: finding d needs z, which needs the factors p and q of n.'));
  }

  // 25b: one key, one message. The dial (n ≤ 150) or, for a bigger n, the table; Step = one hop / one letter.
  function encrypt(body) {
    var host = h('div', { style: { display: 'contents' } }), ctl = {}, hs = keyHandles(false), cur = null;
    var hL = ui.handle({ key: 'letter', kind: 'tap', value: null });
    body.appendChild(h('div', { class: 'say' }, 'Encrypt with the public key: C = Pᵉ mod n. Decrypt with the private key: P = Cᵈ mod n.'));
    body.appendChild(host);
    // a new key (E) rebuilds the figure; the letter tap only restarts the dial on that letter
    ctl.reset = function () {
      var k = hs.key();
      CN.clear(host);
      cur = k.n <= R.DIAL_MAX ? dial(host, k, hL) : table(host, k);
      ['step', 'prev', 'runMs', 'learnStep'].forEach(function (f) { ctl[f] = cur[f]; });
    };
    ctl.reset();
    body.appendChild(ui.controls());
    ctl.input = numbers(hs);
    return ctl;
  }

  function table(host, KEY) {
    var P = R.letters(MSG), enc = R.encrypt(P, KEY), dec = R.decrypt(enc.map(function (c) { return c.value; }), KEY), shown = 0;
    function draw() {
      var t = h('table', { class: 't num', style: { fontSize: '28px', marginTop: '16px' } },
        h('tr', null, ['', 'P', 'Pᵉ', 'C = Pᵉ mod ' + KEY.n, 'Cᵈ mod ' + KEY.n, ''].map(function (c) { return h('th', { class: 'c' }, c); })));
      P.slice(0, shown).forEach(function (p, i) {
        t.appendChild(h('tr', { class: i === shown - 1 ? 'win' : '' },
          h('td', { class: 'c' }, String.fromCharCode(64 + p)), h('td', null, String(p)), h('td', null, enc[i].full || '(large)'),
          h('td', null, h('b', null, String(enc[i].value))), h('td', null, String(dec[i].value)), h('td', { class: 'c' }, String.fromCharCode(64 + dec[i].value))));
      });
      CN.clear(host).appendChild(t);
    }
    draw();
    function step() { if (shown >= P.length) return false; shown++; draw(); return true; }
    function reset() { shown = 0; draw(); }
    // learnStep: the letter in the newest row
    return { step: step, reset: reset, prev: function () { if (shown > 0) { shown--; draw(); return true; } return false; }, learnStep: function () { return shown; } };
  }

  /* The mod-n dial: positions 0…n−1 round a circle. Each letter is encrypted by square-and-multiply
     (R.hops, the same loop as R.modpow) as hops round the dial from P to C, then decrypted from C back
     to P. Step = one hop. The strip on the right fills in as each letter finishes. */
  function sup(n) { return String(n).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }).join(''); }
  function dial(host, KEY, hL) {
    var P = R.letters(MSG), seq = [], only = hL.value();
    P.forEach(function (p, i) {
      if (only != null && i !== only) return;
      var e = R.hops(p, KEY.e, KEY.n), d = R.hops(e.value, KEY.d, KEY.n);
      e.hops.forEach(function (x) { seq.push({ i: i, phase: 'enc', hop: x, key: e }); });
      d.hops.forEach(function (x) { seq.push({ i: i, phase: 'dec', hop: x, key: d }); });
    });
    var k = 0, n = KEY.n, CX = 330, CY = 300, RAD = 250;
    var svg = s('svg', { width: 660, height: 630, viewBox: '0 0 660 630' });
    var side = h('div', { class: 'col', style: { gap: '14px', width: '720px' } });
    host.appendChild(h('div', { class: 'row nowrap', style: { gap: '30px', justifyContent: 'center', alignItems: 'flex-start' } }, svg, side));
    function pt(v, r) { var a = -Math.PI / 2 + 2 * Math.PI * v / n; return [CX + (r || RAD) * Math.cos(a), CY + (r || RAD) * Math.sin(a)]; }
    function draw(fresh) {
      CN.clear(svg); CN.clear(side);
      var cur = k > 0 ? seq[k - 1] : null;
      svg.appendChild(s('defs', null, ['enc', 'dec'].map(function (ph) {
        return s('marker', { id: 'rsa-ah-' + ph, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: ph === 'enc' ? 'var(--blue)' : 'var(--green)' }));
      })));
      svg.appendChild(s('circle', { cx: CX, cy: CY, r: RAD, fill: 'none', stroke: 'var(--line)', 'stroke-width': 3 }));
      svg.appendChild(s('text', { x: 330, y: 622, 'text-anchor': 'middle', 'font-size': 17, fill: 'var(--muted)' }, 'inner curve = square · outer curve = × ' + (cur ? cur.key.hops[0].to : 'the base') + ' · blue encrypt, green decrypt'));
      var every = n <= 40 ? 1 : n <= 80 ? 5 : 10;
      for (var v = 0; v < n; v++) {
        var a = pt(v, RAD - 8), b = pt(v, RAD + 8), lab = pt(v, RAD + 28);
        svg.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'var(--muted)', 'stroke-width': v % every ? 1 : 2 }));
        if (v % every === 0) svg.appendChild(s('text', { x: lab[0], y: lab[1] + 6, 'text-anchor': 'middle', 'font-size': n <= 40 ? 16 : 15, fill: 'var(--muted)' }, String(v)));
      }
      svg.appendChild(s('text', { x: CX, y: CY - 12, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, fill: 'var(--muted)' }, 'mod ' + n));
      if (cur) {
        // this letter's hops in this phase so far; the newest drawn last, bold, labelled
        var mine = seq.slice(0, k).filter(function (x) { return x.i === cur.i && x.phase === cur.phase; });
        var col = cur.phase === 'enc' ? 'var(--blue)' : 'var(--green)';
        mine.forEach(function (x, j) {
          var hp = x.hop, newest = j === mine.length - 1;
          if (hp.op === 'start') return;
          var A = pt(hp.from), B = pt(hp.to), path;
          if (hp.from === hp.to) { var o = pt(hp.from, RAD + 50); path = 'M ' + A[0] + ' ' + A[1] + ' Q ' + (o[0] + 30) + ' ' + (o[1] - 30) + ' ' + A[0] + ' ' + A[1] + ' Q ' + (o[0] - 30) + ' ' + (o[1] + 30) + ' ' + A[0] + ' ' + A[1]; }
          else {
            // squares bow towards the centre, multiplies bow outwards, so a hop and its way back never share a line
            var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, bow = hp.op === 'square' ? 0.5 : -0.25;
            path = 'M ' + A[0] + ' ' + A[1] + ' Q ' + (mx + (CX - mx) * bow) + ' ' + (my + (CY - my) * bow) + ' ' + B[0] + ' ' + B[1];
          }
          svg.appendChild(s('path', { d: path, fill: 'none', stroke: col, 'stroke-width': newest ? 5 : 2.5, opacity: newest ? 1 : 0.35, pathLength: 1,
            class: newest && fresh ? 'fx-draw' : null, 'stroke-linecap': 'round', 'marker-end': 'url(#rsa-ah-' + cur.phase + ')' }));
        });
        var at = pt(cur.hop.to);
        svg.appendChild(s('circle', { cx: at[0], cy: at[1], r: 15, fill: col, stroke: 'var(--panel)', 'stroke-width': 3, class: fresh ? 'fx-pop' : null }));
        svg.appendChild(s('text', { x: CX, y: CY + 24, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, fill: col, class: 'mono' }, cur.hop.label));
      }
      // right: the message strip, then this letter's working
      var strip = h('table', { class: 't num', style: { fontSize: '24px' } },
        h('tr', null, ['', 'P', 'C = Pᵉ mod ' + n, 'Cᵈ mod ' + n].map(function (c) { return h('th', { class: 'c' }, c); })));
      P.forEach(function (p, i) {
        var done = seq.slice(0, k).filter(function (x) { return x.i === i; }), encDone = done.filter(function (x) { return x.phase === 'enc'; }).length === R.hops(p, KEY.e, n).hops.length;
        var decAll = R.hops(R.modpow(p, KEY.e, n).value, KEY.d, n).hops.length, decDone = done.filter(function (x) { return x.phase === 'dec'; }).length === decAll;
        var letter = h('span', { class: 'bit tap' + (only === i ? ' data' : ''), style: { minWidth: '40px', height: '40px', fontSize: '22px' }, title: only === i ? 'Tap for every letter again' : 'Tap to run only this letter' }, String.fromCharCode(64 + p));
        letter.addEventListener('click', function () { hL.set(only === i ? null : i); });
        strip.appendChild(h('tr', { class: cur && cur.i === i ? 'win' : '' }, h('td', { class: 'c' }, letter), h('td', null, String(p)),
          h('td', null, encDone ? h('b', null, String(R.modpow(p, KEY.e, n).value)) : ''),
          h('td', null, decDone ? String(R.modpow(R.modpow(p, KEY.e, n).value, KEY.d, n).value) + ' = ' + String.fromCharCode(64 + R.modpow(R.modpow(p, KEY.e, n).value, KEY.d, n).value) : '')));
      });
      side.appendChild(strip);
      var w = h('div', { class: 'working', style: { fontSize: '22px' } });
      var at = only == null ? 0 : only;
      if (!cur) w.appendChild(document.createTextNode('Step: encrypt ' + String.fromCharCode(64 + P[at]) + ' (P = ' + P[at] + ') with e = ' + KEY.e + ' = ' + KEY.e.toString(2) + '₂ by square-and-multiply.'));
      else {
        var x = cur.key;
        w.appendChild(h('div', { class: 'label' }, (cur.phase === 'enc' ? 'Encrypt ' + String.fromCharCode(64 + P[cur.i]) + ': ' + P[cur.i] + sup(KEY.e) : 'Decrypt: ' + x.hops[0].to + sup(KEY.d)) +
          ' mod ' + n + ', exponent ' + x.bits + '₂ (square each bit, × on a 1)'));
        seq.slice(0, k).filter(function (y) { return y.i === cur.i && y.phase === cur.phase; }).forEach(function (y) { w.appendChild(h('div', { class: 'ln' }, y.hop.label)); });
      }
      side.appendChild(w);
    }
    draw(false);
    function step() { if (k >= seq.length) return false; k++; draw(true); return true; }
    function reset() { k = 0; draw(false); }
    // learnStep: the letter being worked (1-based), as in the table
    return { step: step, reset: reset, runMs: 650, prev: function () { if (k > 0) { k--; draw(false); return true; } return false; },
      learnStep: function () { return k ? seq[k - 1].i + 1 : 0; } };
  }

  function compare(body) {
    body.appendChild(h('table', { class: 't', style: { fontSize: '30px', marginTop: '30px' } },
      h('tr', null, h('th', null, ''), h('th', null, 'Symmetric (AES)'), h('th', null, 'Public key (RSA)')),
      h('tr', null, h('td', null, 'Keys for n people'), h('td', null, 'n(n−1)/2 shared'), h('td', null, '2n (a pair each)')),
      h('tr', null, h('td', null, 'Key agreed first?'), h('td', null, 'Yes, secretly'), h('td', null, 'No: the public key is public')),
      h('tr', null, h('td', null, 'Speed'), h('td', null, 'Fast'), h('td', null, 'Far slower')),
      h('tr', null, h('td', null, 'Used for'), h('td', null, 'Bulk data'), h('td', null, 'Sending an AES key, signatures'))));
    return {};
  }

  function firewall(body) {
    var rules = [['1', 'TCP', 'any', '443', 'allow', 'web server'], ['2', 'TCP', 'any', '25', 'allow', 'mail server'], ['3', 'any', 'any', 'any', 'deny', 'everything else']];
    var t = h('table', { class: 't', style: { fontSize: '28px', marginTop: '16px' } }, h('tr', null, ['#', 'Proto', 'Source', 'Dst port', 'Action', ''].map(function (c) { return h('th', null, c); })));
    rules.forEach(function (r) { t.appendChild(h('tr', { class: r[0] === '3' ? 'win' : '' }, r.map(function (c) { return h('td', null, c); }))); });
    body.appendChild(h('div', { class: 'say' }, 'A packet filter checks each header against the rules; the first match wins.'));
    body.appendChild(t);
    body.appendChild(h('div', { class: 'mono', style: { fontSize: '24px' } }, 'TCP to port 23 (telnet): rule 1? no · rule 2? no · rule 3 matches → DENY'));
    return {};
  }

  function ids(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '30px', padding: '32px', marginTop: '30px' } },
      h('div', null, 'An intrusion detection system watches traffic and raises alarms; a firewall blocks by policy.'),
      h('div', null, h('b', null, 'Signature-based: '), 'matches known attack patterns. Few false alarms, but blind to new attacks.'),
      h('div', null, h('b', null, 'Anomaly-based: '), 'learns normal traffic and flags deviations (a burst of SYNs, a scan of many ports). Catches new attacks, with more false alarms.')));
    return {};
  }

  // 25c: the same algorithm in Forouzan's notation (Fig 30.24, Ex 30.7) beside the slide's Tanenbaum run.
  // Tanenbaum chooses d and solves for e (z); Forouzan chooses e and solves for d (Φ). Step reveals one row.
  var FOR = { p: 7, q: 11, e: 13, P: 5 };
  function forouzan(body) {
    var T = R.keygen(3, 11, 7), F = R.keygenE(FOR.p, FOR.q, FOR.e), tP = 19, k = 0;
    var tC = R.modpow(tP, T.e, T.n).value, fC = R.modpow(FOR.P, F.e, F.n).value;
    var rows = [
      ['Primes', 'p = ' + T.p + ', q = ' + T.q, 'p = ' + F.p + ', q = ' + F.q],
      ['n = p·q', String(T.n), String(F.n)],
      ['(p−1)(q−1)', 'z = ' + T.z, 'Φ = ' + F.phi],
      ['Choose first', 'd = ' + T.d + ' (coprime to z)', 'e = ' + F.e + ' (coprime to Φ)'],
      ['Then solve', 'e = ' + T.e + ': ' + T.e + '·' + T.d + ' = ' + T.e * T.d + ' ≡ 1 (mod ' + T.z + ')', 'd = ' + F.d + ': ' + F.e + '·' + F.d + ' = ' + F.e * F.d + ' ≡ 1 (mod ' + F.phi + ')'],
      ['Encrypt C = Pᵉ mod n', tP + sup(T.e) + ' mod ' + T.n + ' = ' + tC + ' (S)', FOR.P + sup(F.e) + ' mod ' + F.n + ' = ' + fC],
      ['Decrypt P = Cᵈ mod n', tC + sup(T.d) + ' mod ' + T.n + ' = ' + R.modpow(tC, T.d, T.n).value, fC + sup(F.d) + ' mod ' + F.n + ' = ' + R.modpow(fC, F.d, F.n).value]
    ];
    var host = h('div');
    body.appendChild(h('div', { class: 'say' }, 'Same algorithm, same key pair (e, n) public and d private; only the name of (p−1)(q−1) and which exponent is chosen first differ.'));
    body.appendChild(host);
    function draw() {
      CN.clear(host);
      var tb = h('table', { class: 't', style: { fontSize: '27px', marginTop: '16px' } },
        h('tr', null, h('th', null, ''), h('th', null, 'Tanenbaum (25a, 25b)'), h('th', null, 'Forouzan (Ex 30.7)')));
      rows.slice(0, k).forEach(function (r, i) {
        tb.appendChild(h('tr', { class: i === k - 1 ? 'win' : '' }, h('td', null, r[0]), h('td', { class: 'mono' }, r[1]), h('td', { class: 'mono' }, r[2])));
      });
      host.appendChild(tb);
    }
    function step() { if (k >= rows.length) return false; k++; draw(); return true; }
    function reset() { k = 0; draw(); }
    body.appendChild(ui.controls());
    reset();
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; }, learnStep: function () { return k; } };
  }

  var PARTS = { keys: keys, encrypt: encrypt, forouzan: forouzan, compare: compare, firewall: firewall, ids: ids };

  CN.screens.t25 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
