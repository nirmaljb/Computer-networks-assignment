(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // RSA calculator (CN.rsa), Tanenbaum's example by default: p 3, q 11, d 7, "SUZANNE".
  CN.screens.t25 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var R = CN.rsa, DEF = { p: '3', q: '11', d: '7', msg: 'SUZANNE' };
    var st = { p: DEF.p, q: DEF.q, d: DEF.d, msg: DEF.msg, sel: 0 };
    var fields = {};
    function fld(key, w) {
      var f = ui.field(st[key], { width: w, onInput: function (v) { st[key] = v; st.sel = 0; draw(); } });
      fields[key] = f;
      return h('span', { class: 'row nowrap', style: { gap: '6px' } }, h('span', { class: 'label' }, key === 'msg' ? 'Message' : key), f);
    }
    var keyBox = h('div', { class: 'panel col', style: { gap: '4px', fontSize: '23px' } });
    var table = h('div');
    var steps = h('div', { class: 'working', style: { fontSize: '20px' } });
    var left = h('div', { class: 'col', style: { width: '960px', gap: '10px' } },
      h('div', { class: 'row nowrap', style: { gap: '14px' } }, fld('p', 90), fld('q', 90), fld('d', 90), fld('msg', 260),
        h('span', { class: 'small muted' }, 'primes ≤ 997 · letters A = 1 … Z = 26')),
      keyBox, table, steps);
    var right = h('div', { class: 'col grow', style: { gap: '10px' } },
      h('div', { class: 'panel col small', style: { gap: '4px' } },
        h('b', null, 'Symmetric vs public key'),
        h('table', { class: 't', style: { fontSize: '19px' } },
          h('tr', null, h('th', null, ''), h('th', null, 'Symmetric (AES)'), h('th', null, 'Public key (RSA)')),
          h('tr', null, h('td', null, 'Keys for n people'), h('td', null, 'n(n−1)/2 shared'), h('td', null, '2n (a pair each)')),
          h('tr', null, h('td', null, 'Key agreed first?'), h('td', null, 'Yes, secretly'), h('td', null, 'No: public key is public')),
          h('tr', null, h('td', null, 'Speed'), h('td', null, 'Fast'), h('td', null, 'Far slower')),
          h('tr', null, h('td', null, 'Used for'), h('td', null, 'Bulk data'), h('td', null, 'Sending an AES key, signatures')))),
      h('div', { class: 'panel small' }, h('b', null, 'Why it works: '), 'e·d = 1 + k·z, and P^z ≡ 1 (mod n) for P coprime to n (Euler), so (Pᵉ)ᵈ ≡ P. Security: finding d needs z, which needs the factors p, q of n.'),
      ui.cards([
        ['Firewall', function () {
          var rules = [['1', 'TCP', 'any', '443', 'allow', 'web server'], ['2', 'TCP', 'any', '25', 'allow', 'mail server'], ['3', 'any', 'any', 'any', 'deny', 'everything else']];
          var t = h('table', { class: 't' }, h('tr', null, ['#', 'Proto', 'Source', 'Dst port', 'Action', ''].map(function (c) { return h('th', null, c); })));
          rules.forEach(function (r) { t.appendChild(h('tr', { class: r[0] === '3' ? 'win' : '' }, r.map(function (c) { return h('td', null, c); }))); });
          return h('div', { class: 'col' },
            h('div', null, h('b', null, 'Packet filter: '), 'checks each packet\'s header against rules, first match wins.'), t,
            h('div', { class: 'mono small' }, 'Packet: TCP, dst port 23 (telnet) → rule 1? port ≠ 443 · rule 2? ≠ 25 · rule 3 matches → DENY'),
            h('div', null, h('b', null, 'Stateful: '), 'tracks connections, so a reply is allowed only if it matches one opened from inside. ', h('b', null, 'Application gateway: '), 'reads the content (e.g. mail attachments, HTTP requests).'));
        }],
        ['IDS', function () {
          return h('div', { class: 'col' },
            h('div', null, 'An intrusion detection system watches traffic (or a host) and raises alarms; a firewall blocks by policy.'),
            h('div', null, h('b', null, 'Signature-based: '), 'matches known attack patterns. Few false alarms, but blind to new attacks.'),
            h('div', null, h('b', null, 'Anomaly-based: '), 'learns normal traffic and flags deviations (a burst of SYNs, a scan of many ports). Catches new attacks, but more false alarms.'));
        }]
      ], body));
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '18px' } }, left, right));

    function draw() {
      ['p', 'q', 'd'].forEach(function (k) { fields[k].classList.remove('invalid'); });
      var key = R.keygen(st.p, st.q, st.d);
      CN.clear(keyBox); CN.clear(table); CN.clear(steps);
      if (key.error) {
        if (fields[key.field]) fields[key.field].classList.add('invalid');
        keyBox.appendChild(h('div', { class: 'banner err small' }, 'Rejected: ' + key.error));
        return;
      }
      keyBox.appendChild(h('div', { class: 'mono' }, 'n = p·q = ' + key.p + '·' + key.q + ' = ', h('b', null, String(key.n)), '     z = (p−1)(q−1) = ', h('b', null, String(key.z))));
      keyBox.appendChild(h('div', { class: 'mono' }, 'gcd(d, z) = gcd(' + key.d + ', ' + key.z + ') = 1 ✓     e·d ≡ 1 (mod z): e = ', h('b', null, String(key.e)),
        '  (' + key.e + '·' + key.d + ' = ' + key.e * key.d + ' = ' + Math.floor(key.e * key.d / key.z) + '·' + key.z + ' + 1)'));
      keyBox.appendChild(h('div', null, h('b', { class: 'ok' }, 'Public key (e, n) = (' + key.e + ', ' + key.n + ')'), '    ', h('b', { class: 'bad' }, 'Private key (d, n) = (' + key.d + ', ' + key.n + ')')));
      var P = R.letters(st.msg);
      fields.msg.classList.toggle('invalid', !P.length);
      if (!P.length) { table.appendChild(h('div', { class: 'errmsg' }, 'Type a message with letters A–Z')); return; }
      P = P.slice(0, 12);
      var enc = R.encrypt(P, key), dec = R.decrypt(enc.map(function (c) { return c.value; }), key);
      var t = h('table', { class: 't num', style: { fontSize: '21px' } },
        h('tr', null, ['', 'P', 'Pᵉ', 'C = Pᵉ mod n', 'Cᵈ mod n', ''].map(function (c) { return h('th', { class: 'c' }, c); })));
      P.forEach(function (p, i) {
        var tr = h('tr', { class: i === st.sel ? 'win' : '', style: { cursor: 'pointer' } },
          h('td', { class: 'c' }, String.fromCharCode(64 + p)), h('td', null, String(p)), h('td', null, enc[i].full || '(large)'),
          h('td', null, h('b', null, String(enc[i].value))), h('td', null, String(dec[i].value)), h('td', { class: 'c' }, String.fromCharCode(64 + dec[i].value)));
        tr.addEventListener('click', function () { st.sel = i; draw(); });
        t.appendChild(tr);
      });
      table.appendChild(t);
      var i = Math.min(st.sel, P.length - 1);
      function show(label, b, e, r) {
        var lines = [label + ' = ' + b + '^' + e + ' mod ' + key.n + (r.full ? ' = ' + r.full + ' mod ' + key.n + ' = ' + r.value : ' = ' + r.value)];
        if (!r.full) {
          // square-and-multiply, exponent bits from the left
          lines.push('  square-and-multiply, e in binary ' + r.bits + ':');
          lines.push('  ' + r.steps.map(function (s1) { return (s1.bit === '1' ? 'sq·' + b : 'sq') + '→' + s1.value; }).join('  '));
        }
        return lines.join('\n');
      }
      steps.appendChild(h('div', { class: 'label', style: { fontFamily: 'var(--sans)' } }, 'Letter ' + (i + 1) + ' (click a row)'));
      steps.appendChild(h('div', null, show('C', P[i], key.e, enc[i]) + '\n' + show('P', enc[i].value, key.d, dec[i])));
    }
    draw();
    return {
      reset: function () { Object.keys(DEF).forEach(function (k) { st[k] = DEF[k]; fields[k].value = DEF[k]; }); st.sel = 0; draw(); },
      step: function () { st.sel = (st.sel + 1) % Math.max(1, Math.min(12, R.letters(st.msg).length)); draw(); }
    };
  };
})();
