/* Classical ciphers (SPEC-v4 §4.24): Caesar, monoalphabetic substitution with letter
   frequencies, columnar transposition (Tanenbaum's MEGABUCK). Ciphertext is upper case,
   plaintext lower case, as in Tanenbaum. Non-letters pass through substitution unchanged. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function caesar(text, k, decrypt) {
    k = ((decrypt ? -k : k) % 26 + 26) % 26;
    return String(text).replace(/[a-z]/gi, function (c) {
      var i = A.indexOf(c.toUpperCase());
      var out = A[(i + k) % 26];
      return decrypt ? out.toLowerCase() : out;
    });
  }

  // Tanenbaum's example key: a → Q, b → W, … (the keyboard's top row first).
  var DEFAULT_KEY = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  function validKey(key) {
    var k = String(key || '').toUpperCase();
    if (k.length !== 26 || new Set(k.split('')).size !== 26 || /[^A-Z]/.test(k)) return { error: 'The key must use each of the 26 letters once' };
    return { key: k };
  }
  function mono(text, key, decrypt) {
    var v = validKey(key);
    if (v.error) return v;
    var from = decrypt ? v.key : A, to = decrypt ? A : v.key;
    var out = String(text).replace(/[a-z]/gi, function (c) {
      var o = to[from.indexOf(c.toUpperCase())];
      return decrypt ? o.toLowerCase() : o;
    });
    return { text: out };
  }
  // rand() → [0, 1); Math.random by default. Fisher–Yates.
  function shuffleKey(rand) {
    rand = rand || Math.random;
    var a = A.split('');
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.join('');
  }

  // Relative letter frequencies of English text, percent (A–Z).
  var ENGLISH = { A: 8.2, B: 1.5, C: 2.8, D: 4.3, E: 12.7, F: 2.2, G: 2.0, H: 6.1, I: 7.0, J: 0.15, K: 0.77, L: 4.0, M: 2.4,
    N: 6.7, O: 7.5, P: 1.9, Q: 0.095, R: 6.0, S: 6.3, T: 9.1, U: 2.8, V: 0.98, W: 2.4, X: 0.15, Y: 2.0, Z: 0.074 };
  function freq(text) {
    var c = {}, n = 0;
    A.split('').forEach(function (l) { c[l] = 0; });
    String(text).toUpperCase().replace(/[A-Z]/g, function (l) { c[l]++; n++; return l; });
    return { counts: c, total: n };
  }

  // Column order for a key: equal letters are ranked left to right. rank[i] = 1-based rank of column i.
  function keyOrder(key) {
    var k = String(key).toUpperCase();
    var idx = k.split('').map(function (ch, i) { return { ch: ch, i: i }; });
    idx.sort(function (a, b) { return a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : a.i - b.i; });
    var rank = []; idx.forEach(function (o, r) { rank[o.i] = r + 1; });
    return { rank: rank, order: idx.map(function (o) { return o.i; }) };
  }
  function checkKey(key) {
    var k = String(key || '').toUpperCase();
    if (!/^[A-Z]{2,12}$/.test(k)) return { error: 'Key: 2–12 letters' };
    return { key: k };
  }
  // Write row by row under the key, pad with a, b, c…, read columns in key order.
  function transpose(key, plain) {
    var v = checkKey(key);
    if (v.error) return v;
    var k = v.key, w = k.length;
    var p = String(plain).toLowerCase().replace(/[^a-z]/g, '');
    if (!p) return { error: 'Plaintext needs at least one letter' };
    var padN = (w - p.length % w) % w, pad = 'abcdefghijklmnopqrstuvwxyz'.slice(0, padN);
    var full = p + pad, rows = [];
    for (var i = 0; i < full.length; i += w) rows.push(full.slice(i, i + w).split(''));
    var ko = keyOrder(k), out = '';
    ko.order.forEach(function (c) { rows.forEach(function (r) { out += r[c]; }); });
    return { key: k, rows: rows, rank: ko.rank, order: ko.order, padded: full, pad: pad, cipher: out.toUpperCase() };
  }
  function untranspose(key, cipher) {
    var v = checkKey(key);
    if (v.error) return v;
    var k = v.key, w = k.length;
    var c = String(cipher).toUpperCase().replace(/[^A-Z]/g, '');
    if (!c || c.length % w) return { error: 'Ciphertext length must be a multiple of the key length (' + w + ')' };
    var h = c.length / w, ko = keyOrder(k), rows = [];
    for (var r = 0; r < h; r++) rows.push(new Array(w));
    ko.order.forEach(function (col, j) { for (var r2 = 0; r2 < h; r2++) rows[r2][col] = c[j * h + r2].toLowerCase(); });
    return { key: k, rows: rows, rank: ko.rank, order: ko.order, plain: rows.map(function (r3) { return r3.join(''); }).join('') };
  }

  /* SPEC-v6 S24c: breaking the monoalphabetic cipher by hand.
     Pass 1 maps the k-th most common ciphertext letter to the k-th most common English letter.
     Pass 2 fixes one letter per step, each from a digram or trigram counted in the ciphertext:
     the pattern's other letters are already right, or it is the most common trigram read as "the".
     `key` is the presenter's answer sheet: it marks guesses right or wrong and picks which wrong
     letter to fix next; it never supplies a reason. Patterns are counted inside words. */
  var CRACK_TEXT = 'a router holds no state on a connection. the internet has no central router. the host at the other end acts on the data. ' +
    'it is not certain that the data is there. a cache holds the latest result. a hidden station collides. loss is a hint that the net is too loaded. ' +
    'hosts and routers share one standard header. a router can handle each one alone.';
  var PATTERNS = ['the', 'ing', 'and', 'ion', 'th', 'in', 'er', 're', 'an'];
  function englishOrder() {
    return A.split('').sort(function (a, b) { return ENGLISH[b] - ENGLISH[a] || (a < b ? -1 : 1); });
  }
  function grams(text, k) {
    var g = {};
    String(text).split(/[^A-Za-z]+/).forEach(function (w) {
      for (var i = 0; i + k <= w.length; i++) { var x = w.slice(i, i + k); g[x] = (g[x] || 0) + 1; }
    });
    return g;
  }
  function crack(cipherText, key) {
    var f = freq(cipherText), eng = englishOrder();
    var ranked = A.split('').filter(function (l) { return f.counts[l]; })
      .sort(function (a, b) { return f.counts[b] - f.counts[a] || (a < b ? -1 : 1); });
    var truth = {}, enc = {};
    ranked.forEach(function (c) { truth[c] = A[key.indexOf(c)].toLowerCase(); enc[truth[c]] = c; });
    var guess = {};
    ranked.forEach(function (c, i) { guess[c] = eng[i].toLowerCase(); });
    function snap() { var o = {}; ranked.forEach(function (c) { o[c] = guess[c]; }); return o; }
    function right() { return ranked.filter(function (c) { return guess[c] === truth[c]; }).length; }
    var tri = grams(cipherText, 3), di = grams(cipherText, 2);
    var top = Object.keys(tri).sort(function (a, b) { return tri[b] - tri[a] || (a < b ? -1 : 1); });
    var steps = [{ fix: null, guess: snap(), right: right() }];
    for (var guard = 0; guard < 26 && right() < ranked.length; guard++) {
      var done = false;
      for (var pi = 0; pi < PATTERNS.length && !done; pi++) {
        var pat = PATTERNS[pi], cpat = pat.split('').map(function (p) { return enc[p] || '?'; }).join('');
        var count = (pat.length === 3 ? tri : di)[cpat] || 0;
        if (!count) continue;
        var isTop = pat === 'the' && top[0] === cpat && tri[top[1]] < count;
        for (var j = 0; j < pat.length && !done; j++) {
          var c = cpat[j], p = pat[j];
          if (guess[c] === p) continue;
          var others = cpat.split('').filter(function (x) { return x !== c; });
          var known = others.every(function (x) { return guess[x] === truth[x]; });
          if (!known && !isTop) continue;
          var bumped = null;
          ranked.forEach(function (q) { if (guess[q] === p) { guess[q] = '?'; bumped = q; } });
          var was = guess[c];
          guess[c] = p;
          var why = isTop ? cpat + ' is the most common trigram here (' + count + '×): read it as "the"'
            : cpat + ' occurs ' + count + '× and ' + others.map(function (x) { return x + ' = ' + truth[x]; }).join(' and ') + (others.length > 1 ? ' are' : ' is') + ' known: "' + pat + '"';
          steps.push({ fix: { cipher: c, from: was, to: p, pattern: pat, cpattern: cpat, count: count, top: isTop, bumped: bumped, reason: why + ', so ' + c + ' = ' + p },
            guess: snap(), right: right() });
          done = true;
        }
      }
      if (!done) break;
    }
    return { cipher: cipherText, ranked: ranked, counts: f.counts, english: eng.slice(0, ranked.length), truth: truth, steps: steps,
      solved: right() === ranked.length };
  }
  function decode(text, guess) {
    return String(text).replace(/[A-Z]/g, function (c) { return guess[c] || '?'; });
  }

  CN.cipher = { CRACK_TEXT: CRACK_TEXT, PATTERNS: PATTERNS, crack: crack, decode: decode, englishOrder: englishOrder, grams: grams, caesar: caesar, mono: mono, DEFAULT_KEY: DEFAULT_KEY, validKey: validKey, shuffleKey: shuffleKey,
    ENGLISH: ENGLISH, freq: freq, keyOrder: keyOrder, transpose: transpose, untranspose: untranspose };
})(typeof window !== 'undefined' ? window : globalThis);
