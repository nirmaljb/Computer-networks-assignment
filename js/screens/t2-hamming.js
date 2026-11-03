(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, H = CN.hamming;

  function sub(n) { return 'b' + n; }
  function bin(n, w) { var s = n.toString(2); while (s.length < w) s = '0' + s; return s; }

  CN.screens.t2 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var st = { data: '1000001', parity: 'even', flips: [], corrected: false, hl: null };

    var field = ui.field(st.data, { width: 340, onInput: function (v) { st.data = v; st.flips = []; st.corrected = false; st.hl = null; draw(); } });
    var info = h('span', { class: 'chip' });
    body.appendChild(h('div', { class: 'row' },
      h('span', { class: 'label' }, 'Data bits (1–16)'), field,
      ui.seg([['even', 'Even parity'], ['odd', 'Odd parity']], st.parity, function (v) { st.parity = v; st.flips = []; st.corrected = false; draw(); }),
      ui.btn("'A' = 1000001", function () { setData('1000001'); }),
      ui.btn('1011', function () { setData('1011'); }),
      info));
    var out = h('div', { class: 'col', style: { gap: '12px' } });
    body.appendChild(out);

    function setData(d) { st.data = d; field.value = d; st.flips = []; st.corrected = false; st.hl = null; draw(); }

    function draw() {
      CN.clear(out);
      var enc = H.encode(st.data, st.parity);
      field.classList.toggle('invalid', !!enc.error);
      if (enc.error) { info.textContent = ''; out.appendChild(h('div', { class: 'errmsg' }, enc.error)); return; }
      info.textContent = 'm = ' + enc.m + ' → r = ' + enc.r + ' since ' + enc.m + ' + ' + enc.r + ' + 1 ≤ 2' + sup(enc.r) + ' → (' + enc.n + ',' + enc.m + ') code';
      var code = enc.code, rx = H.flip(code, st.flips), diag = H.diagnose(code, rx, st.parity);
      var hlSet = {};
      if (st.hl) H.covers(st.hl, enc.n).forEach(function (p) { hlSet[p] = true; });

      // Sent row
      var sent = h('div', { class: 'bits withpos' });
      code.split('').forEach(function (b, i) {
        var p = i + 1, isC = H.isPow2(p);
        var box = h('span', { class: 'bit ' + (isC ? 'check click' : 'data') + (hlSet[p] ? ' hl' : '') + (st.hl && !hlSet[p] ? ' dim' : ''),
          title: isC ? 'Click: show what P' + p + ' covers' : '' },
          h('span', { class: 'pos' }, String(p)), b, isC ? h('span', { class: 'tag' }, 'P') : null);
        if (isC) box.addEventListener('click', function () { st.hl = st.hl === p ? null : p; draw(); });
        sent.appendChild(box);
      });
      out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, 'Sent'), sent,
        h('span', { class: 'small muted' }, 'click a P to see what it covers')));

      // Received row
      var recv = h('div', { class: 'bits withpos' });
      var fixPos = st.corrected && diag.syndrome > 0 && diag.syndrome <= enc.n ? diag.syndrome : 0;
      rx.split('').forEach(function (b, i) {
        var p = i + 1, isC = H.isPow2(p), flipped = st.flips.indexOf(p) >= 0, cls;
        var shown = b;
        if (p === fixPos) {
          shown = b === '1' ? '0' : '1';
          cls = flipped ? 'fixed' : 'err';
        } else cls = flipped ? 'err' : (isC ? 'check' : 'data');
        var box = h('span', { class: 'bit click ' + cls + (hlSet[p] ? ' hl' : '') + (st.hl && !hlSet[p] ? ' dim' : ''), title: 'Click to flip bit ' + p },
          h('span', { class: 'pos' }, String(p)), shown, isC && !flipped && p !== fixPos ? h('span', { class: 'tag' }, 'P') : null);
        box.addEventListener('click', function () {
          var k = st.flips.indexOf(p);
          if (k >= 0) st.flips.splice(k, 1); else st.flips.push(p);
          st.corrected = false; draw();
        });
        recv.appendChild(box);
      });
      out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, 'Received', h('br'), '(click to flip)'), recv));

      // Working: sender equations | receiver checks
      var sendW = h('div', { class: 'working grow' }, h('div', { class: 'label' }, 'Sender: ' + st.parity + ' parity over each group'));
      enc.checks.forEach(function (c) {
        var line = 'P' + c.pos + ' = ' + c.covers.map(sub).join('⊕') + ' = ' + c.values.join('⊕') +
          (st.parity === 'odd' ? ' ⊕ 1' : '') + ' = ' + c.value;
        sendW.appendChild(h('div', { class: 'ln' + (st.hl && st.hl !== c.pos ? ' dim' : '') }, line));
      });
      var recvW = h('div', { class: 'working grow' }, h('div', { class: 'label' }, 'Receiver: recheck each group (itself included)'));
      diag.checks.forEach(function (c) {
        var line = 'C' + c.pos + ': ' + c.values.join('⊕') + ' = ' + c.parity + (c.ok ? '  ✓' : '  ✕ fails');
        recvW.appendChild(h('div', { class: 'ln ' + (c.ok ? '' : 'bad') + (st.hl && st.hl !== c.pos ? ' dim' : '') }, line));
      });
      var failing = diag.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.pos; });
      var w = diag.checks.length;
      recvW.appendChild(h('div', { style: { marginTop: '6px', fontWeight: 800 } },
        'Syndrome = ' + (failing.length ? failing.join(' + ') + ' = ' : '') + bin(diag.syndrome, w) + '₂ = ' + diag.syndrome));
      out.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'stretch' } }, sendW, recvW));

      // Verdict
      var verdict = h('div', { class: 'row' });
      var canCorrect = diag.syndrome > 0 && diag.syndrome <= enc.n;
      var cb = ui.btn(st.corrected ? 'Undo correct' : 'Correct (flip bit ' + (canCorrect ? diag.syndrome : '–') + ')', function () { st.corrected = !st.corrected; draw(); }, 'primary');
      cb.disabled = !canCorrect;
      verdict.appendChild(cb);
      var msg, cls;
      var f = diag.flipped.slice().sort(function (a, b) { return a - b; });
      if (!f.length) { msg = 'No error: every check passes, syndrome 0. Professor, pick a bit to corrupt.'; cls = 'ok'; }
      else if (diag.verdict === 'corrected') { msg = 'Checks ' + failing.join(' and ') + ' fail → ' + failing.join(' + ') + ' = ' + diag.syndrome + ': bit ' + diag.syndrome + ' is the culprit' + (st.corrected ? ', now corrected.' : '.'); cls = 'ok'; }
      else if (diag.verdict === 'undetected') { msg = 'Bits ' + f.join(', ') + ' flipped and syndrome is 0: these errors form another valid codeword, so they go undetected.'; cls = 'err'; }
      else if (diag.outOfRange) { msg = 'Bits ' + f.join(', ') + ' flipped: syndrome ' + diag.syndrome + ' points past bit ' + enc.n + ', so more than one error happened.'; cls = 'err'; }
      else { msg = 'Bits ' + f.join(' and ') + ' flipped, but syndrome ' + diag.syndrome + ' blames bit ' + diag.syndrome + ': miscorrection. Hamming corrects ONE error; SEC-DED adds an overall parity bit to detect doubles.'; cls = 'err'; }
      verdict.appendChild(h('div', { class: 'banner ' + cls, style: { flex: 1, fontSize: '24px' } }, msg));
      out.appendChild(verdict);
      if (st.corrected && canCorrect) {
        var c2 = H.check(rx, st.parity);
        out.appendChild(h('div', { class: 'small muted' }, 'Data extracted after correction: ', h('b', { class: 'mono' }, c2.data),
          c2.data === enc.data ? h('span', { class: 'ok' }, '  ✓ matches what was sent') : h('span', { class: 'bad' }, '  ✕ not what was sent')));
      }
    }
    function sup(n) { return String(n).split('').map(function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]; }).join(''); }

    draw();
    return {
      step: function () { st.corrected = !st.corrected; draw(); },
      reset: function () { st.flips = []; st.corrected = false; st.hl = null; draw(); },
      sub: function () { return st.flips.length ? 'flipped ' + st.flips.join(', ') : ''; }
    };
  };
})();
