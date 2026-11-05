(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, C = CN.crc;

  // SPEC-v5: fixed Tanenbaum Fig 3-9 example. 3a divides at the sender, 3b checks at the receiver.
  // SPEC-v6: E takes 'message / generator' (message ≤ 16 bits, generator degree 1–8, top and bottom bits 1).
  var DATA = '1101011111', GEN = '10011', BURST = [3, 4, 5];
  function numbers(use) {
    return ui.numbers({ label: 'message / generator: message ≤ 16 bits, generator degree 1–8', example: DATA + ' / ' + GEN,
      parse: C.parseCustom, use: function (v) { use(v ? v.data : DATA, v ? v.gen : GEN); } });
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
    var enc, total, shown = 0, say = h('div', { class: 'say' });
    body.appendChild(say);
    var out = h('div', { class: 'col', style: { gap: '14px', flex: 1, minHeight: 0 } });
    body.appendChild(out);
    function load(data, gen) {
      enc = C.encode(data, gen); total = enc.steps.length; shown = 0;
      say.textContent = 'G(x) = ' + sup(C.polyString(enc.gen)) + ' = ' + enc.gen + ', so append r = ' + enc.r + ' zero' + (enc.r > 1 ? 's' : '') + ' and XOR-divide by G.';
      draw();
    }
    function draw() {
      CN.clear(out);
      out.appendChild(fitted(divisionGrid(enc.augmented, enc.gen, enc.steps, shown, { appended: enc.r }), shown === total ? 560 : 620));
      if (shown === total) {
        out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '120px' } }, 'Frame'),
          h('div', { class: 'bits' }, enc.frame.split('').map(function (b, i) {
            var isR = i >= enc.data.length;
            return h('span', { class: 'bit ' + (isR ? 'check' : 'data') }, b, isR ? h('span', { class: 'tag' }, 'R') : null);
          }))));
      }
    }
    load(DATA, GEN);
    function step() { if (shown < total) { shown++; draw(); return true; } return false; }
    function reset() { shown = 0; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset, prev: function () { if (shown > 0) { shown--; draw(); return true; } return false; }, input: numbers(load),
      learnStep: function () { return shown; } };
  }

  // Click bits to flip them, or Step sends a 3-bit burst. The receiver divides by G again.
  function check(body) {
    var enc, flips = [], burst;
    var out = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(out);
    function draw() {
      CN.clear(out);
      var f = enc.frame.split('');
      flips.forEach(function (i) { f[i] = f[i] === '1' ? '0' : '1'; });
      var rx = f.join(''), chk = C.check(rx, enc.gen);
      var rxRow = h('div', { class: 'bits' });
      rx.split('').forEach(function (b, i) {
        var bad = b !== enc.frame[i];
        var box = h('span', { class: 'bit click ' + (bad ? 'err' : (i >= enc.data.length ? 'check' : 'data')), title: 'Click to flip' }, b);
        box.addEventListener('click', function () {
          var k = flips.indexOf(i);
          if (k >= 0) flips.splice(k, 1); else flips.push(i);
          draw();
        });
        rxRow.appendChild(box);
      });
      out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, 'Received'), rxRow));
      var msg;
      if (!flips.length) msg = 'Frame ÷ G leaves remainder ' + C.zeros(enc.r) + ' → accepted. Click any bit to flip it.';
      else if (chk.ok) msg = 'Remainder ' + C.zeros(enc.r) + ': this error is a multiple of G(x), so it slips through.';
      else msg = flips.length + ' bit' + (flips.length > 1 ? 's' : '') + ' wrong → remainder ' + chk.remainder + ' ≠ 0 → error detected.';
      out.appendChild(h('div', { class: 'banner ' + (flips.length && chk.ok ? 'err' : 'ok'), style: { fontSize: '26px' } }, msg));
      out.appendChild(h('div', { class: 'say' }, 'Every burst of length ≤ r = ' + enc.r + ' is caught.'));
    }
    // Step's burst: bits 3–5 on the example; on other numbers a burst of min(3, r) bits, so it is always ≤ r
    function load(data, gen) {
      enc = C.encode(data, gen); flips = [];
      var len = Math.min(BURST.length, enc.r), at = Math.min(BURST[0], enc.frame.length - len);
      burst = []; for (var i = 0; i < len; i++) burst.push(at + i);
      draw();
    }
    load(DATA, GEN);
    function step() { if (flips.length) return false; flips = burst.slice(); draw(); return true; }
    function reset() { flips = []; draw(); }
    body.appendChild(ui.controls());
    // learnStep: 0 clean, 1 Step's burst; hand-flipped bits match no learn row (null)
    function learnStep() { return !flips.length ? 0 : flips.join() === burst.join() ? 1 : null; }
    return { step: step, reset: reset, input: numbers(load), learnStep: learnStep };
  }

  var PARTS = { divide: divide, check: check };

  CN.screens.t3 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
