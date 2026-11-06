(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, H = CN.hamming;

  // SPEC-v5: fixed data 'A' = 1000001, even parity. 2a builds the codeword, 2b catches and fixes one flip.
  // SPEC-v6: E takes other data bits (1–16); Step's scripted flip is bit 5, or the last bit of a shorter code.
  // SPEC-v8: the data bits are a handle (tap one on 2a to flip it); E is a text view of it. 2b's handle is the
  // flips themselves: up to two, the second being the taught break (the syndrome names a bit nobody flipped).
  var DATA = '1000001', PARITY = 'even', SCRIPTED_FLIP = 5;
  function dataHandle() { return ui.handle({ key: 'data', kind: 'tap', value: DATA }); }
  function numbers(hData) {
    return ui.numbers({ label: 'Data bits: 1–16 bits of 0/1', example: DATA, parse: H.validate,
      read: function () { return hData.value(); }, write: function (v) { hData.set(v.bits, true); } });
  }
  // the data index of codeword position p (data bits fill the positions that are not powers of 2)
  function dataIndex(p) { var k = 0; for (var q = 1; q < p; q++) if (!H.isPow2(q)) k++; return k; }

  function sub(n) { return 'b' + n; }
  function bin(n, w) { var s = n.toString(2); while (s.length < w) s = '0' + s; return s; }
  function row(label, bits) {
    return h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, label), bits);
  }

  // 2a: Step computes P1, P2, P4, P8 in turn and lights the bits each one covers. Tap a data bit to flip it.
  function encode(body) {
    var enc, k = 0, hData = dataHandle();
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
        var box = h('span', { class: 'bit ' + (isC ? 'check' : 'data click') + (lit[p] ? ' hl' : '') + (cur && !lit[p] ? ' dim' : ''), title: isC ? null : 'Tap to flip data bit ' + p },
          h('span', { class: 'pos' }, String(p)), isC && !done ? '?' : b, isC ? h('span', { class: 'tag' }, 'P') : null);
        if (!isC) box.addEventListener('click', function () {
          var d = hData.value().split(''), j = dataIndex(p);
          d[j] = d[j] === '1' ? '0' : '1';
          hData.set(d.join(''));
        });
        bits.appendChild(box);
      });
      out.appendChild(row('Codeword', bits));
      var work = h('div', { class: 'working' }, h('div', { class: 'label' }, 'Even parity over each group'));
      enc.checks.slice(0, k).forEach(function (c) {
        work.appendChild(h('div', { class: 'ln' }, 'P' + c.pos + ' = ' + c.covers.map(sub).join('⊕') + ' = ' + c.values.join('⊕') + ' = ' + c.value));
      });
      out.appendChild(work);
    }
    function step() { if (k < enc.checks.length) { k++; draw(); return true; } return false; }
    function reset() { load(hData.value()); }
    reset();
    body.appendChild(ui.controls());
    // SPEC-v7 learnStep: the check bits computed so far (the learn pane lights that row)
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; }, input: numbers(hData),
      learnStep: function () { return k; } };
  }

  // 2b: tap up to two bits to flip them (or Step flips bit 5); the receiver's checks give the syndrome; Step corrects.
  function correct(body) {
    var code, n, flips = [], auto = false, corrected = false, hData = dataHandle();
    var hFlip = ui.handle({ key: 'flips', kind: 'tap', value: [], isBreak: function (v) { return v.length === 2; } });
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
        var box = h('span', { class: 'bit click ' + cls, title: 'Tap to flip bit ' + p },
          h('span', { class: 'pos' }, String(p)), shown, isC && !flipped && p !== fixPos ? h('span', { class: 'tag' }, 'P') : null);
        box.addEventListener('click', function () {
          var f = hFlip.value().slice(), j = f.indexOf(p);
          if (j >= 0) f.splice(j, 1);
          else if (f.length >= 2) { CN.toast('Two flips at most: a third is past what the slide teaches'); return; }
          else f.push(p);
          hFlip.set(f);
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
      if (!f.length) msg = 'No error: every check passes, syndrome 0. Tap any bit to flip it.';
      else if (diag.verdict === 'corrected') msg = 'Syndrome ' + diag.syndrome + ': bit ' + diag.syndrome + ' is the culprit' + (corrected ? ', now corrected.' : '. Step corrects it.');
      else if (diag.syndrome > n) { cls = 'err'; msg = 'Bits ' + f.join(' and ') + ' flipped: syndrome ' + diag.syndrome + ' names no bit of ' + n + '. Two errors: detected, not corrected.'; }
      else { cls = 'err'; msg = 'Bits ' + f.join(' and ') + ' flipped: syndrome ' + diag.syndrome + ' names bit ' + diag.syndrome + ', which nobody flipped. Hamming corrects only one error.'; }
      out.appendChild(h('div', { class: 'banner ' + cls, style: { fontSize: '24px' } }, msg));
    }
    // The tapped flips are there from the start; with none, Step 1 makes the scripted flip of bit 5.
    function reset() {
      code = H.encode(hData.value(), PARITY).code; n = code.length;
      var f = hFlip.value().filter(function (p) { return p <= n; });
      if (f.length !== hFlip.value().length) hFlip.set(f, true);
      flips = f.slice(); auto = false; corrected = false;
      draw();
    }
    reset();
    function step() {
      if (!flips.length) { flips = [Math.min(SCRIPTED_FLIP, n)]; auto = true; draw(); return true; }
      var d = H.diagnose(code, H.flip(code, flips), PARITY);
      if (!corrected && d.syndrome > 0 && d.syndrome <= n) { corrected = true; draw(); return true; }
      return false;
    }
    body.appendChild(ui.controls());
    // learnStep: 0 clean, 1 the scripted flip, 2 corrected; with tapped flips 0 shown, 1 (mis)corrected (the
    // pane's table follows the taps through genText)
    function learnStep() {
      if (!flips.length) return 0;
      return auto ? (corrected ? 2 : 1) : corrected ? 1 : 0;
    }
    function syndrome(f) { return H.diagnose(code, H.flip(code, f), PARITY).syndrome; }
    return { step: step, reset: reset, input: numbers(hData), learnStep: learnStep, sub: function () { return flips.length ? 'flipped ' + flips.join(', ') : ''; },
      genText: function () { return hData.value() + (hFlip.value().length ? ' | flips ' + hFlip.value().join(' ') : ''); },
      // C: two flips whose syndrome still names a real bit, so the receiver "fixes" a third, innocent one
      challenge: { goal: 'Make the receiver "correct" a bit nobody flipped',
        why: function () { var f = hFlip.value(); return 'Bits ' + f.join(' and ') + ' XOR to syndrome ' + syndrome(f) + ': it blames bit ' + syndrome(f) + '. Distance 3 corrects only one error.'; },
        holds: function () { var f = hFlip.value(), sy = f.length === 2 ? syndrome(f) : 0; return f.length === 2 && sy >= 1 && sy <= n && f.indexOf(sy) < 0; },
        answer: function () { return { flips: [1, 2] }; } } };
  }

  var PARTS = { encode: encode, correct: correct };

  CN.screens.t2 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
