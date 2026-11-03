(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, R = CN.rsa;

  // SPEC-v5: Tanenbaum's example, p 3, q 11, d 7, "SUZANNE" (A = 1 … Z = 26). 25a key generation,
  // 25b encrypt + decrypt (one letter per Step), then static: symmetric vs public key, firewall, IDS.
  var KEY = R.keygen('3', '11', '7'), MSG = 'SUZANNE';

  function keys(body) {
    var k = KEY;
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '32px', padding: '32px', marginTop: '30px' } },
      h('div', { class: 'mono' }, 'n = p·q = ' + k.p + '·' + k.q + ' = ', h('b', null, String(k.n)), '     z = (p−1)(q−1) = ', h('b', null, String(k.z))),
      h('div', { class: 'mono' }, 'd = ' + k.d + ', gcd(' + k.d + ', ' + k.z + ') = 1 ✓'),
      h('div', { class: 'mono' }, 'e·d ≡ 1 (mod z) → e = ', h('b', null, String(k.e)), '   (' + k.e + '·' + k.d + ' = ' + k.e * k.d + ' = ' + Math.floor(k.e * k.d / k.z) + '·' + k.z + ' + 1)'),
      h('div', null, h('b', { class: 'ok' }, 'Public key (e, n) = (' + k.e + ', ' + k.n + ')'), '      ', h('b', { class: 'bad' }, 'Private key (d, n) = (' + k.d + ', ' + k.n + ')'))));
    body.appendChild(h('div', { class: 'say' }, 'Security: finding d needs z, which needs the factors p and q of n.'));
    return {};
  }

  function encrypt(body) {
    var P = R.letters(MSG), enc = R.encrypt(P, KEY), dec = R.decrypt(enc.map(function (c) { return c.value; }), KEY), shown = 0;
    var host = h('div', { style: { marginTop: '16px' } });
    body.appendChild(h('div', { class: 'say' }, 'Encrypt with the public key: C = Pᵉ mod n. Decrypt with the private key: P = Cᵈ mod n.'));
    body.appendChild(host);
    function draw() {
      var t = h('table', { class: 't num', style: { fontSize: '28px' } },
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
    body.appendChild(ui.controls(step, reset));
    return { step: step, reset: reset, prev: function () { if (shown > 0) { shown--; draw(); return true; } return false; } };
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
