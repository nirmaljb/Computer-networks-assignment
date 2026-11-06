(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, C = CN.crc;

  // SPEC-v5: fixed Tanenbaum Fig 3-9 example. 3a divides at the sender, 3b checks at the receiver.
  // SPEC-v6: E takes 'message / generator' (message ≤ 16 bits, generator degree 1–8, top and bottom bits 1).
  // SPEC-v8: message and generator are handles (tap a message bit on 3a to flip it); E is a text view of them. 3b's
  // handles move the burst Step sends: start, and length 1…r, plus the taught break r + 1, a burst shaped like G.
  var DATA = '1101011111', GEN = '10011', BURST = [3, 4, 5];
  function handles() { return { msg: ui.handle({ key: 'msg', kind: 'tap', value: DATA }), gen: ui.handle({ key: 'gen', kind: 'tap', value: GEN }) }; }
  function numbers(hs) {
    return ui.numbers({ label: 'message / generator: message ≤ 16 bits, generator degree 1–8', example: DATA + ' / ' + GEN, parse: C.parseCustom,
      read: function () { return hs.msg.value() + ' / ' + hs.gen.value(); },
      write: function (v) { hs.msg.set(v.data, true); hs.gen.set(v.gen, true); } });
  }
  // a long division is taller than the slide: shrink it to fit (one scale, nothing reflows)
  function fitted(grid, maxH) {
    var hgt = parseFloat(grid.style.height), sc = Math.min(1, maxH / hgt);
    grid.style.transform = 'scale(' + sc + ')'; grid.style.transformOrigin = 'top center';
    return h('div', { style: { height: Math.ceil(hgt * sc) + 'px', display: 'flex', justifyContent: 'center' } }, grid);
  }

  // Textbook long division laid out in a character grid.
  function divisionGrid(dividend, gen, steps, shown, opts) {
    var g = gen.length, cols = dividend.length, ch = 20, lh = 30;
    var lead = (gen.length + 2) * ch;
    var rows = [];
    // quotient
    var q = steps.slice(0, shown).map(function (s) { return s.qbit; }).join('');
    rows.push({ col: g - 1, text: q, cls: 'q' });
    rows.push({ col: 0, text: dividend, cls: 'dividend', rule: 'top' });
    for (var i = 0; i < shown; i++) {
      var st = steps[i];
      rows.push({ col: st.col, text: st.sub, cls: st.qbit === '1' ? 'sub' : 'sub zero', rule: 'under' });
      if (i < steps.length - 1) rows.push({ col: st.col + 1, text: st.result.slice(1) + dividend[st.col + g], cls: 'win' });
      else rows.push({ col: st.col + 1, text: st.result.slice(1), cls: 'rem' });
    }
    var height = rows.length * lh + 10, width = lead + cols * ch + 20;
    var box = h('div', { style: { position: 'relative', width: width + 'px', height: height + 'px', font: '700 30px var(--mono)' } });
    // divisor + bracket
    box.appendChild(h('div', { style: { position: 'absolute', left: 0, top: lh + 'px', color: 'var(--accent)' } }, gen + ' )'));
    rows.forEach(function (r, i) {
      var color = r.cls === 'q' ? 'var(--accent)' : r.cls === 'rem' ? 'var(--amber)' : r.cls.indexOf('zero') >= 0 ? 'var(--muted)' : r.cls === 'dividend' ? 'var(--ink)' : 'var(--ink)';
      var el = h('div', { style: {
        position: 'absolute', top: (i * lh) + 'px', left: (lead + r.col * ch) + 'px', color: color, letterSpacing: '0',
        borderTop: r.rule === 'top' ? '2px solid var(--ink)' : 'none',
        borderBottom: r.rule === 'under' ? '2px solid var(--line)' : 'none',
        background: r.cls === 'rem' ? 'var(--amber-bg)' : 'none', lineHeight: (lh - 3) + 'px'
      } }, r.text.split('').map(function (c, j) {
        var augmented = r.cls === 'dividend' && opts && opts.appended && j >= dividend.length - opts.appended;
        return h('span', { style: { display: 'inline-block', width: ch + 'px', textAlign: 'center', color: augmented ? 'var(--amber)' : null } }, c);
      }));
      box.appendChild(el);
    });
    return box;
  }

  function sup(p) { return p.replace(/\^(\d+)/g, function (_, d) { return d.split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }).join(''); }); }
  function divide(body) {
    var enc, total, shown = 0, say = h('div', { class: 'say' }), hs = handles();
    body.appendChild(say);
    var msgRow = h('div', { class: 'bits' });
    body.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '130px' } }, 'Message'), msgRow));
    var out = h('div', { class: 'col', style: { gap: '14px', flex: 1, minHeight: 0 } });
    body.appendChild(out);
    function load(data, gen) {
      enc = C.encode(data, gen); total = enc.steps.length; shown = 0;
      say.textContent = 'G(x) = ' + sup(C.polyString(enc.gen)) + ' = ' + enc.gen + ', so append r = ' + enc.r + ' zero' + (enc.r > 1 ? 's' : '') + ' and XOR-divide by G.';
      draw();
    }
    function draw() {
      CN.clear(msgRow);
      enc.data.split('').forEach(function (b, i) {
        var box = h('span', { class: 'bit data click', title: 'Tap to flip message bit ' + (i + 1) }, b);
        box.addEventListener('click', function () {
          var d = hs.msg.value().split('');
          d[i] = d[i] === '1' ? '0' : '1';
          hs.msg.set(d.join(''));
        });
        msgRow.appendChild(box);
      });
      CN.clear(out);
      out.appendChild(fitted(divisionGrid(enc.augmented, enc.gen, enc.steps, shown, { appended: enc.r }), shown === total ? 470 : 540));
      if (shown === total) {
        out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '120px' } }, 'Frame'),
          h('div', { class: 'bits' }, enc.frame.split('').map(function (b, i) {
            var isR = i >= enc.data.length;
            return h('span', { class: 'bit ' + (isR ? 'check' : 'data') }, b, isR ? h('span', { class: 'tag' }, 'R') : null);
          }))));
      }
    }
    function step() { if (shown < total) { shown++; draw(); return true; } return false; }
    function reset() { load(hs.msg.value(), hs.gen.value()); }
    reset();
    body.appendChild(ui.controls());
    return { step: step, reset: reset, prev: function () { if (shown > 0) { shown--; draw(); return true; } return false; }, input: numbers(hs),
      learnStep: function () { return shown; } };
  }

  // Step sends the burst the two handles set (bits 3–5 by default); the receiver divides by G again. Length r + 1 is
  // the taught break: the error is G itself, shifted, so it leaves remainder 0.
  function check(body) {
    var hs = handles(), enc = C.encode(hs.msg.value(), hs.gen.value()), sent = false, say = h('div', { class: 'say' });
    var hLen = ui.handle({ key: 'len', label: 'Length', kind: 'slider', value: BURST.length, floor: 1, width: 300,
      values: function () { var v = []; for (var i = 1; i <= enc.r + 1; i++) v.push(i); return v; },
      isBreak: function (v) { return v === enc.r + 1; }, limit: function () { return { at: enc.r, text: 'r = ' + enc.r }; } });
    var hAt = ui.handle({ key: 'at', label: 'Start', kind: 'slider', value: BURST[0], floor: 1, width: 360, fmt: function (v) { return 'bit ' + (v + 1); },
      values: function () { var v = []; for (var i = 0; i + hLen.value() <= enc.frame.length; i++) v.push(i); return v; } });
    body.appendChild(say);
    var out = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(out);
    body.appendChild(ui.handleRow(hAt, hLen));
    function error() {
      var len = hLen.value(), at = hAt.value();
      return len === enc.r + 1 ? C.gBurst(enc.frame, enc.gen, at).frame : C.burst(enc.frame, at, len).frame;
    }
    function draw() {
      CN.clear(out);
      var rx = sent ? error() : enc.frame, chk = C.check(rx, enc.gen), g = hLen.isBreak();
      var rxRow = h('div', { class: 'bits' });
      rx.split('').forEach(function (b, i) {
        var bad = b !== enc.frame[i];
        rxRow.appendChild(h('span', { class: 'bit ' + (bad ? 'err' : (i >= enc.data.length ? 'check' : 'data')) }, b));
      });
      out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, 'Received'), rxRow));
      var msg, a = hAt.value() + 1, b2 = hAt.value() + hLen.value();
      if (!sent) msg = 'Frame ÷ G leaves remainder ' + C.zeros(enc.r) + ' → accepted. Step sends the burst.';
      else if (chk.ok) msg = 'Bits ' + a + '–' + b2 + ' flipped in the pattern of G (' + enc.gen + '): a multiple of G(x), remainder ' + C.zeros(enc.r) + ', it slips through.';
      else msg = 'Burst of ' + hLen.value() + ' (bits ' + a + '–' + b2 + ') → remainder ' + chk.remainder + ' ≠ 0 → error detected.';
      out.appendChild(h('div', { class: 'banner ' + (sent && chk.ok ? 'err' : 'ok'), style: { fontSize: '26px' } }, msg));
      if (g && !sent) out.appendChild(h('div', { class: 'brk-note' }, 'Length r + 1 = ' + (enc.r + 1) + ': this burst is G itself, shifted.'));
    }
    function reset() {
      enc = C.encode(hs.msg.value(), hs.gen.value()); sent = false;
      hLen.fit(); hAt.fit();
      say.textContent = 'Every burst of length ≤ r = ' + enc.r + ' is caught.';
      draw();
    }
    reset();
    function step() { if (sent) return false; sent = true; draw(); return true; }
    body.appendChild(ui.controls());
    // learnStep: 0 clean, 1 the burst sent (the pane's table follows the handles through genText)
    function holds() { return hLen.isBreak() && C.check(error(), enc.gen).ok && error() !== enc.frame; }
    return { step: step, reset: reset, input: numbers(hs), learnStep: function () { return sent ? 1 : 0; },
      genText: function () { return hs.msg.value() + ' / ' + hs.gen.value() + ' | burst ' + hAt.value() + ' ' + hLen.value(); },
      challenge: { goal: 'Find a burst this generator misses',
        why: function () { return 'The error is G(x)·' + sup('x^' + (enc.frame.length - hAt.value() - enc.gen.length)) + ': a multiple of G leaves remainder 0.'; },
        holds: holds, answer: function () { return { len: enc.r + 1 }; } } };
  }

  var PARTS = { divide: divide, check: check };

  CN.screens.t3 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
