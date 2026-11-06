(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, C = CN.cipher;

  // SPEC-v5: fixed examples on CN.cipher, all static. 24a Caesar (ATTACK, k = 3), 24b monoalphabetic key,
  // 24c the frequency attack on a long English text, 24d columnar transposition (MEGABUCK), 24e DES → AES.
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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

  // SPEC-v8: the key is a dial, 0–25. The challenge (C) shows an intercepted ciphertext instead of ATTACK: dial until
  // it decrypts to English. It was made with k = 7, so the slide's own k = 3 does not solve it.
  var INTERCEPT = { plain: 'packets', k: 7 };
  function caesar(body) {
    var ks = []; for (var i = 0; i < 26; i++) ks.push(i);
    var hK = ui.handle({ key: 'k', label: 'Shift', kind: 'dial', value: 3, values: ks, radius: 110, fmt: function (v) { return 'k = ' + v; } });
    var ct = C.caesar(INTERCEPT.plain, INTERCEPT.k, false), cracking = false;
    var say = h('div', { class: 'say' }, 'Shift every letter by k. Only 25 useful keys: try them all and read which one makes sense.');
    var map = h('div'), res = h('div', { class: 'grow' });
    body.appendChild(say);
    body.appendChild(map);
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '40px', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' } }, res, hK.el));
    function reset() {
      var k = hK.value();
      CN.clear(map).appendChild(mapping(A.split('').map(function (_, i) { return A[(i + k) % 26]; }).join('')));
      CN.clear(res).appendChild(cracking
        ? h('div', { class: 'panel col', style: { gap: '8px', fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: 700 } },
          h('div', { class: 'blue' }, h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '12px' } }, 'Intercepted'), ct),
          h('div', null, h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '12px' } }, 'Shifted back by ' + k), C.caesar(ct, k, true)))
        : result('ATTACK', C.caesar('ATTACK', k, false)));
    }
    reset();
    return { reset: reset, genText: function () { return 'k ' + hK.value(); },
      challenge: { goal: 'Dial k until the intercepted ' + ct + ' reads as English',
        why: 'k = ' + INTERCEPT.k + ': every letter moves back ' + INTERCEPT.k + '. With 25 keys, trying them all takes seconds.',
        holds: function () { return C.caesar(ct, hK.value(), true) === INTERCEPT.plain; },
        answer: function () { return { k: INTERCEPT.k }; },
        start: function () { cracking = true; reset(); }, end: function () { cracking = false; reset(); } } };
  }

  function mono(body) {
    var o = C.mono(SHORT, C.DEFAULT_KEY, false);
    body.appendChild(h('div', { class: 'say' }, 'Any permutation of the alphabet is a key: 26! ≈ 4 × 10²⁶ keys, far too many to try.'));
    body.appendChild(mapping(C.DEFAULT_KEY));
    body.appendChild(result(SHORT, o.text));
    return {};
  }

  // SPEC-v6 set piece: the frequency crack (CN.cipher.crack). Step 1 = pass 1, rank-matching letters, wrong ones
  // red with the count right; each later Step fixes one letter, with the digram or trigram that justifies it.
  // SPEC-v8 handle: tap a cipher letter to try the next plaintext letter for it (a guess, on top of the Step's map).
  function frequency(body) {
    var cipherText = C.mono(C.CRACK_TEXT, C.DEFAULT_KEY, false).text, r = C.crack(cipherText, C.DEFAULT_KEY), k = 0;
    var hG = ui.handle({ key: 'guess', kind: 'tap', value: {}, floor: 1 });
    function guessOf(stp) {
      var g = {}, o = hG.value();
      Object.keys(stp.guess).forEach(function (c) { g[c] = stp.guess[c]; });
      Object.keys(o).forEach(function (c) { g[c] = o[c]; });
      return g;
    }
    var why = h('div', { class: 'crack-why' }), map = h('div', { class: 'crack-map' }), text = h('div', { class: 'crack-text' });
    body.appendChild(why);
    body.appendChild(h('div', { class: 'panel col', style: { gap: '16px', padding: '14px 18px' } }, map, text));
    function draw(fresh) {
      var stp = k ? r.steps[k - 1] : null, g = stp ? guessOf(stp) : {}, fix = stp && stp.fix, n = r.ranked.length;
      var right = stp ? r.ranked.filter(function (c) { return g[c] === r.truth[c]; }).length : 0, mine = Object.keys(hG.value()).length;
      if (!stp) why.textContent = 'A monoalphabetic ciphertext (' + C.freq(cipherText).total + ' letters). Step: match its letters to English by frequency.';
      else if (mine) why.textContent = 'Your guess' + (mine > 1 ? 'es' : '') + ' on top of step ' + k + ': ' + right + ' of ' + n + ' right' + (right === n ? ': plaintext recovered.' : '. Tap a letter to try the next one.');
      else if (!fix) why.textContent = 'Pass 1: the k-th most common letter here → the k-th most common in English. ' + stp.right + ' of ' + n + ' right.';
      else why.textContent = 'Fix ' + (k - 1) + ': ' + fix.reason + '.  ' + stp.right + ' of ' + n + ' right' + (stp.right === n ? ': plaintext recovered.' : '.');
      why.style.color = stp && right === n ? 'var(--green)' : '';
      CN.clear(map);
      map.style.gridTemplateColumns = 'auto repeat(' + n + ', 56px)';
      map.appendChild(h('div', { class: 'label', style: { alignSelf: 'center' } }, 'cipher'));
      r.ranked.forEach(function (c) { map.appendChild(h('span', { class: 'bit data cm' }, c)); });
      map.appendChild(h('div', { class: 'label', style: { alignSelf: 'center' } }, 'count'));
      r.ranked.forEach(function (c) { map.appendChild(h('div', { class: 'cm-n' }, String(r.counts[c]))); });
      map.appendChild(h('div', { class: 'label', style: { alignSelf: 'center' } }, stp ? 'reads as' : 'English'));
      r.ranked.forEach(function (c, i) {
        if (!stp) { map.appendChild(h('span', { class: 'bit cm flag' }, r.english[i].toLowerCase())); return; }
        var ok = g[c] === r.truth[c];
        var cell = h('span', { class: 'bit click cm ' + (ok ? 'fixed' : 'err') + (fresh && fix && fix.cipher === c ? ' fx-flash' : ''), title: 'Tap to try the next letter for ' + c }, g[c]);
        cell.addEventListener('click', function () {
          var o = {}, cur = g[c], nx = cur === '?' ? 'a' : String.fromCharCode((cur.charCodeAt(0) - 97 + 1) % 26 + 97);
          Object.keys(hG.value()).forEach(function (x) { o[x] = hG.value()[x]; });
          if (nx === stp.guess[c]) delete o[c]; else o[c] = nx;
          hG.set(o);
        });
        map.appendChild(cell);
      });
      CN.clear(text);
      cipherText.split(' ').forEach(function (w) {
        var cw = h('span', { class: 'c' }), gw = h('span', { class: 'g' });
        w.split('').forEach(function (ch) {
          cw.appendChild(document.createTextNode(ch));
          if (!/[A-Z]/.test(ch)) { gw.appendChild(document.createTextNode(ch)); return; }
          if (!stp) { gw.appendChild(document.createTextNode('·')); return; }
          gw.appendChild(h('span', { class: g[ch] === r.truth[ch] ? 'ok' : 'bad' }, g[ch]));
        });
        text.appendChild(h('span', { class: 'crack-word' }, cw, gw));
      });
    }
    draw(false);
    function step() { if (k >= r.steps.length) return false; k++; draw(true); return true; }
    function reset() { k = 0; draw(false); }
    body.appendChild(ui.controls());
    // learnStep: the Step; with guesses of your own on top, no learn row matches (null)
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(false); return true; } return false; },
      learnStep: function () { return Object.keys(hG.value()).length ? null : k; } };
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
