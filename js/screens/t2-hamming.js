(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, H = CN.hamming;

  // SPEC-v5: fixed data 'A' = 1000001, even parity. 2a builds the codeword, 2b catches and fixes one flip.
  // SPEC-v6: E takes other data bits (1–16); Step's scripted flip is bit 5, or the last bit of a shorter code.
  var DATA = '1000001', PARITY = 'even', SCRIPTED_FLIP = 5;
  function numbers(use) {
    return ui.numbers({ label: 'Data bits: 1–16 bits of 0/1', example: DATA, parse: H.validate, use: function (v) { use(v ? v.bits : DATA); } });
  }

  function sub(n) { return 'b' + n; }
  function bin(n, w) { var s = n.toString(2); while (s.length < w) s = '0' + s; return s; }
  function row(label, bits) {
    return h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, label), bits);
  }

  // 2a: Step computes P1, P2, P4, P8 in turn and lights the bits each one covers.
  function encode(body) {
    var enc, k = 0;
    var out = h('div', { class: 'col', style: { gap: '16px', marginTop: '16px' } }), say = h('div', { class: 'say' });
    body.appendChild(say);
    body.appendChild(out);
    function load(data) {
      enc = H.encode(data, PARITY); k = 0;
      say.textContent = 'm = ' + enc.m + ' data bits → r = ' + enc.r + ' check bits, since ' + enc.m + ' + ' + enc.r + ' + 1 ≤ 2^' + enc.r + ' → (' + enc.n + ',' + enc.m + ') code';
      draw();
    }
    function draw() {
      CN.clear(out);
      var cur = k > 0 ? enc.checks[k - 1] : null, lit = {};
      if (cur) cur.covers.forEach(function (p) { lit[p] = true; });
      var bits = h('div', { class: 'bits withpos' });
      enc.code.split('').forEach(function (b, i) {
        var p = i + 1, isC = H.isPow2(p), done = isC && enc.checks.findIndex(function (c) { return c.pos === p; }) < k;
        bits.appendChild(h('span', { class: 'bit ' + (isC ? 'check' : 'data') + (lit[p] ? ' hl' : '') + (cur && !lit[p] ? ' dim' : '') },
          h('span', { class: 'pos' }, String(p)), isC && !done ? '?' : b, isC ? h('span', { class: 'tag' }, 'P') : null));
      });
      out.appendChild(row('Codeword', bits));
      var work = h('div', { class: 'working' }, h('div', { class: 'label' }, 'Even parity over each group'));
      enc.checks.slice(0, k).forEach(function (c) {
        work.appendChild(h('div', { class: 'ln' }, 'P' + c.pos + ' = ' + c.covers.map(sub).join('⊕') + ' = ' + c.values.join('⊕') + ' = ' + c.value));
      });
      out.appendChild(work);
    }
    load(DATA);
    function step() { if (k < enc.checks.length) { k++; draw(); return true; } return false; }
    function reset() { k = 0; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; }, input: numbers(load) };
  }

  // 2b: click a bit to flip it (or Step flips bit 5); the receiver's checks give the syndrome; Step corrects.
  function correct(body) {
    var code, n, flips = [], corrected = false;
    var out = h('div', { class: 'col', style: { gap: '16px', marginTop: '16px' } });
    body.appendChild(out);
    function draw() {
      CN.clear(out);
      var rx = H.flip(code, flips), diag = H.diagnose(code, rx, PARITY);
      var canCorrect = diag.syndrome > 0 && diag.syndrome <= n, fixPos = corrected && canCorrect ? diag.syndrome : 0;
      var recv = h('div', { class: 'bits withpos' });
      rx.split('').forEach(function (b, i) {
        var p = i + 1, isC = H.isPow2(p), flipped = flips.indexOf(p) >= 0, cls, shown = b;
        if (p === fixPos) { shown = b === '1' ? '0' : '1'; cls = flipped ? 'fixed' : 'err'; }
        else cls = flipped ? 'err' : (isC ? 'check' : 'data');
        var box = h('span', { class: 'bit click ' + cls, title: 'Click to flip bit ' + p },
          h('span', { class: 'pos' }, String(p)), shown, isC && !flipped && p !== fixPos ? h('span', { class: 'tag' }, 'P') : null);
        box.addEventListener('click', function () {
          var j = flips.indexOf(p);
          if (j >= 0) flips.splice(j, 1); else flips.push(p);
          corrected = false; draw();
        });
        recv.appendChild(box);
      });
      out.appendChild(row('Received', recv));

      var work = h('div', { class: 'working' }, h('div', { class: 'label' }, 'Receiver: recheck each group, check bit included'));
      diag.checks.forEach(function (c) {
        work.appendChild(h('div', { class: 'ln ' + (c.ok ? '' : 'bad') }, 'C' + c.pos + ': ' + c.values.join('⊕') + ' = ' + c.parity + (c.ok ? '  ✓' : '  ✕ fails')));
      });
      var failing = diag.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.pos; });
      work.appendChild(h('div', { style: { marginTop: '6px', fontWeight: 800 } },
        'Syndrome = ' + (failing.length ? failing.join(' + ') + ' = ' : '') + bin(diag.syndrome, diag.checks.length) + '₂ = ' + diag.syndrome));
      out.appendChild(work);

      var f = diag.flipped.slice().sort(function (a, b) { return a - b; }), msg, cls = 'ok';
      if (!f.length) msg = 'No error: every check passes, syndrome 0. Click any bit to flip it.';
      else if (diag.verdict === 'corrected') msg = 'Syndrome ' + diag.syndrome + ': bit ' + diag.syndrome + ' is the culprit' + (corrected ? ', now corrected.' : '. Step corrects it.');
      else { cls = 'err'; msg = 'Bits ' + f.join(' and ') + ' flipped: Hamming corrects only ONE error, so this one is miscorrected or missed.'; }
      out.appendChild(h('div', { class: 'banner ' + cls, style: { fontSize: '24px' } }, msg));
    }
    function load(data) { code = H.encode(data, PARITY).code; n = code.length; flips = []; corrected = false; draw(); }
    load(DATA);
    function step() {
      if (!flips.length) { flips = [Math.min(SCRIPTED_FLIP, n)]; draw(); return true; }
      var d = H.diagnose(code, H.flip(code, flips), PARITY);
      if (!corrected && d.syndrome > 0 && d.syndrome <= n) { corrected = true; draw(); return true; }
      return false;
    }
    function reset() { flips = []; corrected = false; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset, input: numbers(load), sub: function () { return flips.length ? 'flipped ' + flips.join(', ') : ''; } };
  }

  var PARTS = { encode: encode, correct: correct };

  CN.screens.t2 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
