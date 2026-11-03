(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, C = CN.cipher;

  // SPEC-v5: fixed examples on CN.cipher, all static. 24a Caesar (ATTACK, k = 3), 24b monoalphabetic key,
  // 24c the frequency attack on a long English text, 24d columnar transposition (MEGABUCK), 24e DES → AES.
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var LONG = 'the network layer moves packets between hosts while the transport layer gives each program a reliable stream and the application layer turns names into addresses fetches pages and delivers mail but anyone on the path can read every message unless it is encrypted';
  var SHORT = 'the network layer moves packets';
  var MEGA = 'pleasetransferonemilliondollarstomyswissbankaccountsixtwotwo';

  function mapping(cipherRow) {
    var r1 = h('div', { class: 'row nowrap', style: { gap: '4px' } }), r2 = h('div', { class: 'row nowrap', style: { gap: '4px' } });
    A.split('').forEach(function (l, i) {
      r1.appendChild(h('span', { class: 'bit', style: { minWidth: '50px', height: '48px', fontSize: '24px' } }, l.toLowerCase()));
      r2.appendChild(h('span', { class: 'bit data', style: { minWidth: '50px', height: '48px', fontSize: '24px' } }, cipherRow[i]));
    });
    return h('div', { class: 'col', style: { gap: '4px', marginTop: '16px' } }, h('div', { class: 'label' }, 'plain → cipher'), r1, r2);
  }
  function result(plain, cipher) {
    return h('div', { class: 'panel col', style: { gap: '8px', fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: 700, overflowWrap: 'anywhere' } },
      h('div', null, h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '12px' } }, 'Plaintext'), plain),
      h('div', { class: 'blue' }, h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '12px' } }, 'Ciphertext'), cipher));
  }

  function caesar(body) {
    var k = 3, row = A.split('').map(function (_, i) { return A[(i + k) % 26]; }).join('');
    body.appendChild(h('div', { class: 'say' }, 'Shift every letter by k = 3. Only 25 useful keys: try them all and read which one makes sense.'));
    body.appendChild(mapping(row));
    body.appendChild(result('ATTACK', C.caesar('ATTACK', k, false)));
    return {};
  }

  function mono(body) {
    var o = C.mono(SHORT, C.DEFAULT_KEY, false);
    body.appendChild(h('div', { class: 'say' }, 'Any permutation of the alphabet is a key: 26! ≈ 4 × 10²⁶ keys, far too many to try.'));
    body.appendChild(mapping(C.DEFAULT_KEY));
    body.appendChild(result(SHORT, o.text));
    return {};
  }

  function frequency(body) {
    var cipherText = C.mono(LONG, C.DEFAULT_KEY, false).text, f = C.freq(cipherText);
    var eng = A.split('').sort(function (a, b) { return C.ENGLISH[b] - C.ENGLISH[a]; });
    var cr = A.split('').sort(function (a, b) { return f.counts[b] - f.counts[a] || (a < b ? -1 : 1); });
    var chart = s('svg', { width: 1460, height: 321, viewBox: '0 0 1500 220' }), bw = 52, maxE = C.ENGLISH.E, maxC = Math.max(1, f.counts[cr[0]]);
    chart.appendChild(s('text', { x: 0, y: 16, 'font-size': 18, 'font-weight': 700, fill: 'var(--muted)' }, 'English, most common first'));
    chart.appendChild(s('text', { x: 0, y: 214, 'font-size': 18, 'font-weight': 700, fill: 'var(--blue)' }, 'Ciphertext (' + f.total + ' letters), most common first'));
    for (var i = 0; i < 26; i++) {
      var x = 60 + i * bw, he = 70 * C.ENGLISH[eng[i]] / maxE, hc = 70 * f.counts[cr[i]] / maxC;
      chart.appendChild(s('rect', { x: x, y: 94 - he, width: bw - 12, height: he, fill: 'var(--muted)', opacity: 0.5 }));
      chart.appendChild(s('text', { x: x + (bw - 12) / 2, y: 112, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, eng[i]));
      chart.appendChild(s('text', { x: x + (bw - 12) / 2, y: 132, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: 'var(--blue)' }, f.counts[cr[i]] ? cr[i] : '·'));
      chart.appendChild(s('rect', { x: x, y: 138, width: bw - 12, height: hc, fill: 'var(--blue)', opacity: 0.7 }));
    }
    body.appendChild(h('div', { class: 'say' }, 'The most common ciphertext letter ' + cr[0] + ' is probably e, the next ' + cr[1] + ' probably t… Here ' + cr[0] + ' really is ' + C.mono(cr[0], C.DEFAULT_KEY, true).text + '.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px 10px', marginTop: '16px' } }, chart));
    return {};
  }

  function transposition(body) {
    var r = C.transpose('MEGABUCK', MEGA), w = r.rank.length, cell = 64;
    var grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + w + ', ' + cell + 'px)', gap: '4px' } });
    r.rank.forEach(function (n) { grid.appendChild(h('div', { style: { textAlign: 'center', font: '700 22px var(--sans)', color: 'var(--accent)' } }, String(n))); });
    r.key.split('').forEach(function (ch) { grid.appendChild(h('div', { class: 'bit flag', style: { minWidth: 0, height: '44px', fontSize: '24px' } }, ch)); });
    var total = r.rows.length * w;
    r.rows.forEach(function (row, ri) {
      row.forEach(function (ch, ci) {
        var pad = ri * w + ci >= total - r.pad.length;
        grid.appendChild(h('div', { class: 'bit ' + (pad ? 'check' : 'data'), style: { minWidth: 0, height: '40px', fontSize: '24px' } }, ch));
      });
    });
    body.appendChild(h('div', { class: 'say' }, 'Write the plaintext in rows under the key; read the columns in the numbered order (key letters alphabetically). Amber = padding.'));
    body.appendChild(h('div', { style: { marginTop: '10px' } }, grid));
    body.appendChild(h('div', { class: 'panel', style: { fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: 700, overflowWrap: 'anywhere', color: 'var(--blue)' } },
      h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '12px' } }, 'Ciphertext'), r.cipher));
    return {};
  }

  function symmetric(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '28px', padding: '30px', marginTop: '20px' } },
      h('div', null, h('b', null, 'Symmetric: '), 'the same secret key encrypts and decrypts. Modern ciphers work on blocks and repeat substitution + transposition for many rounds.'),
      h('div', null, h('b', null, 'DES '), '(IBM/NSA, 1977): 64-bit blocks, 56-bit key, 16 rounds. Broken by brute force in 1998 (EFF\'s machine, about 56 hours). Triple DES stretched its life.'),
      h('div', null, h('b', null, 'AES '), '(Rijndael, NIST 2001): 128-bit blocks; 128-, 192- or 256-bit keys; 10, 12 or 14 rounds.'),
      h('div', { class: 'muted' }, 'Weakness of every symmetric cipher: both sides need the key first. Stop 25.')));
    return {};
  }

  var PARTS = { caesar: caesar, mono: mono, freq: frequency, columnar: transposition, symmetric: symmetric };

  CN.screens.t24 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
