(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // Caesar, monoalphabetic (with the frequency attack) and columnar transposition, on CN.cipher.
  // Every tab encrypts and decrypts any input, so a typed example can be round-tripped live.
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var LONG = 'the network layer moves packets between hosts while the transport layer gives each program a reliable stream and the application layer turns names into addresses fetches pages and delivers mail but anyone on the path can read every message unless it is encrypted';
  var MEGA = 'pleasetransferonemilliondollarstomyswissbankaccountsixtwotwo';

  CN.screens.t24 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var C = CN.cipher;
    var st = { tab: 0, dec: false, caesar: { text: 'ATTACK', k: 3 }, mono: { text: LONG, key: C.DEFAULT_KEY }, tr: { key: 'MEGABUCK', text: MEGA } };
    var pane = h('div', { class: 'col', style: { gap: '10px', flex: 1, minHeight: 0 } });
    var decSeg = ui.seg([[0, 'Encrypt'], [1, 'Decrypt']], 0, function (v) { swap(!!+v); });
    var tabs = ui.tabs(['Caesar', 'Monoalphabetic', 'Columnar transposition'], 0, function (i) { st.tab = i; setDec(false); draw(); });
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '20px', alignItems: 'flex-end' } }, h('div', { class: 'grow' }, tabs), decSeg,
      ui.cards([['Symmetric key: DES → AES', function () {
        return h('div', { class: 'col' },
          h('div', null, h('b', null, 'Symmetric: '), 'the same secret key encrypts and decrypts. Modern ciphers work on blocks and repeat substitution + transposition (permutation) for many rounds.'),
          h('div', null, h('b', null, 'DES '), '(IBM/NSA, 1977): 64-bit blocks, 56-bit key, 16 rounds. Broken by brute force in 1998 (EFF\'s machine, about 56 hours). Triple DES stretched its life.'),
          h('div', null, h('b', null, 'AES '), '(Rijndael, NIST 2001): 128-bit blocks; 128-, 192- or 256-bit keys; 10, 12 or 14 rounds of S-box substitution, row shifts, column mixing and key addition.'),
          h('div', { class: 'muted' }, 'Weakness of every symmetric cipher: both sides need the key first. Stop 25.'));
      }]], body)));
    body.appendChild(pane);

    function setDec(v) { st.dec = v; decSeg.set(v ? 1 : 0); }
    // switching direction feeds the current output back in, so the round trip shows
    function swap(v) {
      if (v === st.dec) return;
      var out = output();
      if (out != null) {
        if (st.tab === 0) st.caesar.text = out;
        else if (st.tab === 1) st.mono.text = out;
        else st.tr.text = out;
      }
      setDec(v); draw();
    }
    function output() {
      if (st.tab === 0) return C.caesar(st.caesar.text, st.caesar.k, st.dec);
      if (st.tab === 1) { var m = C.mono(st.mono.text, st.mono.key, st.dec); return m.error ? null : m.text; }
      var t = st.dec ? C.untranspose(st.tr.key, st.tr.text) : C.transpose(st.tr.key, st.tr.text);
      return t.error ? null : st.dec ? t.plain : t.cipher;
    }
    function inRow(label, value, w, on) {
      var f = ui.field(value, { width: w, onInput: on });
      return { el: h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label', style: { minWidth: '120px' } }, label), f), f: f };
    }
    function outBox(text, err) {
      return h('div', { class: 'panel', style: { fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: 700, overflowWrap: 'anywhere', color: err ? 'var(--red)' : st.dec ? 'var(--ink)' : 'var(--blue)' } },
        h('span', { class: 'label', style: { fontFamily: 'var(--sans)', marginRight: '10px' } }, st.dec ? 'Plaintext' : 'Ciphertext'), err ? '✕ ' + err : text);
    }

    function drawCaesar(live) {
      var c = st.caesar;
      var res = h('div');
      var map = h('div', { class: 'col', style: { gap: '2px' } });
      function refresh() {
        CN.clear(res).appendChild(outBox(C.caesar(c.text, c.k, st.dec)));
        CN.clear(map);
        var r1 = h('div', { class: 'row nowrap', style: { gap: '3px' } }), r2 = h('div', { class: 'row nowrap', style: { gap: '3px' } });
        A.split('').forEach(function (l, i) {
          r1.appendChild(h('span', { class: 'bit', style: { minWidth: '40px', height: '40px', fontSize: '20px' } }, l.toLowerCase()));
          r2.appendChild(h('span', { class: 'bit data', style: { minWidth: '40px', height: '40px', fontSize: '20px' } }, A[(i + c.k % 26 + 26) % 26]));
        });
        map.appendChild(r1); map.appendChild(r2);
      }
      var t = inRow(st.dec ? 'Ciphertext' : 'Plaintext', c.text, 700, function (v) { c.text = v; refresh(); });
      var k = inRow('Shift k', String(c.k), 90, function (v) { var ok = /^\d{1,2}$/.test(v.trim()) && +v <= 25; k.f.classList.toggle('invalid', !ok); if (ok) { c.k = +v; refresh(); } });
      pane.appendChild(t.el); pane.appendChild(k.el); pane.appendChild(h('div', { class: 'label' }, 'plain → cipher'));
      pane.appendChild(map); pane.appendChild(res);
      pane.appendChild(h('div', { class: 'panel small' }, 'Only 25 useful keys: try them all and read which one makes sense. ATTACK with k = 3 → DWWDFN.'));
      refresh();
    }

    function drawMono() {
      var m = st.mono;
      var keyRow = h('div', { class: 'col', style: { gap: '2px' } }), res = h('div'), chart = s('svg', { width: 1500, height: 190, viewBox: '0 0 1500 190' }), guess = h('div', { class: 'small' });
      var t = inRow(st.dec ? 'Ciphertext' : 'Plaintext', m.text, 1180, function (v) { m.text = v; refresh(); });
      function refresh() {
        CN.clear(keyRow);
        var r1 = h('div', { class: 'row nowrap', style: { gap: '3px' } }), r2 = h('div', { class: 'row nowrap', style: { gap: '3px' } });
        A.split('').forEach(function (l, i) {
          r1.appendChild(h('span', { class: 'bit', style: { minWidth: '40px', height: '38px', fontSize: '20px' } }, l.toLowerCase()));
          r2.appendChild(h('span', { class: 'bit data', style: { minWidth: '40px', height: '38px', fontSize: '20px' } }, m.key[i]));
        });
        keyRow.appendChild(r1); keyRow.appendChild(r2);
        var o = C.mono(m.text, m.key, st.dec);
        CN.clear(res).appendChild(outBox(o.text, o.error));
        // frequency attack: rank the ciphertext letters and line them up with English
        var cipherText = st.dec ? m.text : o.text || '';
        var f = C.freq(cipherText), eng = A.split('').sort(function (a, b) { return C.ENGLISH[b] - C.ENGLISH[a]; });
        var cr = A.split('').sort(function (a, b) { return f.counts[b] - f.counts[a] || (a < b ? -1 : 1); });
        CN.clear(chart);
        var bw = 52, maxE = C.ENGLISH.E, maxC = Math.max(1, f.counts[cr[0]]);
        chart.appendChild(s('text', { x: 0, y: 16, 'font-size': 17, 'font-weight': 700, fill: 'var(--muted)' }, 'English, most common first'));
        chart.appendChild(s('text', { x: 0, y: 184, 'font-size': 17, 'font-weight': 700, fill: 'var(--blue)' }, 'Ciphertext (' + f.total + ' letters), most common first'));
        for (var i = 0; i < 26; i++) {
          var x = 60 + i * bw, he = 60 * C.ENGLISH[eng[i]] / maxE, hc = 60 * f.counts[cr[i]] / maxC;
          chart.appendChild(s('rect', { x: x, y: 82 - he, width: bw - 12, height: he, fill: 'var(--muted)', opacity: 0.5 }));
          chart.appendChild(s('text', { x: x + (bw - 12) / 2, y: 98, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, eng[i]));
          chart.appendChild(s('text', { x: x + (bw - 12) / 2, y: 116, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: 'var(--blue)' }, f.counts[cr[i]] ? cr[i] : '·'));
          chart.appendChild(s('rect', { x: x, y: 122, width: bw - 12, height: hc, fill: 'var(--blue)', opacity: 0.7 }));
        }
        CN.clear(guess);
        if (f.total) guess.appendChild(h('span', null, h('b', null, 'The attack: '), 'the most common ciphertext letter ', h('b', { class: 'blue mono' }, cr[0]), ' is probably e, the next ', h('b', { class: 'blue mono' }, cr[1]), ' probably t… Here ',
          h('b', { class: 'mono' }, cr[0]), ' really is ', h('b', { class: 'mono' }, C.mono(cr[0], m.key, true).text || '?'), '. 26! ≈ 4 × 10²⁶ keys don\'t help: nobody tries keys.'));
      }
      pane.appendChild(h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label', style: { minWidth: '120px' } }, 'Key'), keyRow,
        ui.btn('Shuffle', function () { m.key = C.shuffleKey(); refresh(); }), ui.btn('Default key', function () { m.key = C.DEFAULT_KEY; refresh(); })));
      pane.appendChild(t.el);
      pane.appendChild(res);
      pane.appendChild(h('div', { class: 'panel', style: { padding: '4px 8px' } }, chart));
      pane.appendChild(guess);
      refresh();
    }

    function drawTrans() {
      var tr = st.tr, gridBox = h('div'), res = h('div');
      function refresh() {
        var r = st.dec ? C.untranspose(tr.key, tr.text) : C.transpose(tr.key, tr.text);
        CN.clear(gridBox); CN.clear(res);
        if (r.error) { res.appendChild(outBox('', r.error)); return; }
        var w = r.rank.length, cell = Math.max(34, Math.min(52, Math.floor(1100 / w)));
        var grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + w + ', ' + cell + 'px)', gap: '3px' } });
        r.rank.forEach(function (n) { grid.appendChild(h('div', { style: { textAlign: 'center', font: '700 16px var(--sans)', color: 'var(--accent)' } }, String(n))); });
        r.key.split('').forEach(function (ch) { grid.appendChild(h('div', { class: 'bit flag', style: { minWidth: 0, height: '36px' } }, ch)); });
        var nPad = st.dec ? 0 : r.pad.length, total = r.rows.length * w;
        r.rows.forEach(function (row, ri) {
          row.forEach(function (ch, ci) {
            var idx = ri * w + ci, pad = !st.dec && idx >= total - nPad;
            grid.appendChild(h('div', { class: 'bit ' + (pad ? 'check' : 'data'), style: { minWidth: 0, height: '34px', fontSize: '20px' } }, ch));
          });
        });
        gridBox.appendChild(h('div', { class: 'row nowrap', style: { gap: '20px', alignItems: 'flex-start' } }, grid,
          h('div', { class: 'small col', style: { gap: '4px', maxWidth: '360px' } },
            h('div', null, h('b', null, 'Numbers'), ' = the order columns are read: key letters alphabetically, equal letters left to right.'),
            !st.dec ? h('div', null, h('b', { class: 'amber' }, 'Amber'), ' = padding (a, b, c…) to fill the last row.') : null,
            h('div', null, st.dec ? 'Decrypt: cut the ciphertext into columns of ' + r.rows.length + ', put each under its number, read the rows.' : 'Encrypt: write rows, read column 1 top to bottom, then column 2…'))));
        res.appendChild(outBox(st.dec ? r.plain : r.cipher));
      }
      var k = inRow('Key', tr.key, 260, function (v) { tr.key = v; refresh(); });
      var t = inRow(st.dec ? 'Ciphertext' : 'Plaintext', tr.text, 1180, function (v) { tr.text = v; refresh(); });
      pane.appendChild(h('div', { class: 'row nowrap', style: { gap: '10px' } }, k.el,
        ui.btn('MEGABUCK', function () { tr.key = 'MEGABUCK'; tr.text = MEGA; setDec(false); draw(); }),
        ui.btn('BALL / helloworld', function () { tr.key = 'BALL'; tr.text = 'helloworld'; setDec(false); draw(); })));
      pane.appendChild(t.el); pane.appendChild(gridBox); pane.appendChild(res);
      refresh();
    }

    function draw() {
      CN.clear(pane);
      [drawCaesar, drawMono, drawTrans][st.tab]();
    }
    draw();
    return {
      step: function () { swap(!st.dec); },
      reset: function () {
        st.caesar = { text: 'ATTACK', k: 3 }; st.mono = { text: LONG, key: C.DEFAULT_KEY }; st.tr = { key: 'MEGABUCK', text: MEGA };
        setDec(false); draw();
      }
    };
  };
})();
