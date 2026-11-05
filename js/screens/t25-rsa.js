(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, R = CN.rsa;

  // SPEC-v5: Tanenbaum's example, p 3, q 11, d 7, "SUZANNE" (A = 1 … Z = 26). 25a key generation,
  // 25b encrypt + decrypt (one letter per Step), then static: symmetric vs public key, firewall, IDS.
  // SPEC-v6: E on 25a/25b takes 'p q d' (rsa.js rules). 25b is the mod-n dial while n ≤ 150, else the table.
  var KEY = R.keygen('3', '11', '7'), MSG = 'SUZANNE', s = CN.s;
  function numbers(use) {
    return ui.numbers({ label: 'p q d: two primes and d coprime to z = (p−1)(q−1)', example: KEY.p + ' ' + KEY.q + ' ' + KEY.d,
      parse: R.parseKey, use: function (v) { use(v || KEY); } });
  }

  function keys(body) {
    var host = h('div', { style: { display: 'contents' } });
    body.appendChild(host);
    function load(k) { CN.clear(host); keysInto(host, k); }
    load(KEY);
    return { input: numbers(load) };
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
    var host = h('div', { style: { display: 'contents' } }), ctl = {};
    body.appendChild(h('div', { class: 'say' }, 'Encrypt with the public key: C = Pᵉ mod n. Decrypt with the private key: P = Cᵈ mod n.'));
    body.appendChild(host);
    function load(k) {
      CN.clear(host);
      var c = k.n <= R.DIAL_MAX ? dial(host, k) : table(host, k);
      ['step', 'reset', 'prev', 'runMs', 'learnStep'].forEach(function (f) { ctl[f] = c[f]; });
    }
    load(KEY);
    body.appendChild(ui.controls());
    ctl.input = numbers(load);
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
  function dial(host, KEY) {
    var P = R.letters(MSG), seq = [];
    P.forEach(function (p, i) {
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
        strip.appendChild(h('tr', { class: cur && cur.i === i ? 'win' : '' }, h('td', { class: 'c' }, String.fromCharCode(64 + p)), h('td', null, String(p)),
          h('td', null, encDone ? h('b', null, String(R.modpow(p, KEY.e, n).value)) : ''),
          h('td', null, decDone ? String(R.modpow(R.modpow(p, KEY.e, n).value, KEY.d, n).value) + ' = ' + String.fromCharCode(64 + R.modpow(R.modpow(p, KEY.e, n).value, KEY.d, n).value) : '')));
      });
      side.appendChild(strip);
      var w = h('div', { class: 'working', style: { fontSize: '22px' } });
      if (!cur) w.appendChild(document.createTextNode('Step: encrypt S (P = ' + P[0] + ') with e = ' + KEY.e + ' = ' + KEY.e.toString(2) + '₂ by square-and-multiply.'));
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

  var PARTS = { keys: keys, encrypt: encrypt, compare: compare, firewall: firewall, ids: ids };

  CN.screens.t25 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
