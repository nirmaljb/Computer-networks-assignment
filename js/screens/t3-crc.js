(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, C = CN.crc;

  var PRESETS = [['1011', 'x³+x+1'], ['10011', 'x⁴+x+1'], ['100000111', 'CRC-8']];

  // Textbook long division laid out in a character grid.
  function divisionGrid(dividend, gen, steps, shown, opts) {
    var g = gen.length, cols = dividend.length, ch = 12.4, lh = 19.5;
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
    var box = h('div', { style: { position: 'relative', width: width + 'px', height: height + 'px', font: '700 20px var(--mono)' } });
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

  CN.screens.t3 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var st = { data: '1101011111', gen: '10011', shown: 0, poly: false, view: 0, flips: [], burstLen: 3, burstAt: 2 };

    var dField = ui.field(st.data, { width: 280, onInput: function (v) { st.data = v; resetRx(); draw(); } });
    var gField = ui.field(st.gen, { width: 200, onInput: function (v) { st.gen = v; resetRx(); draw(); } });
    body.appendChild(h('div', { class: 'row' },
      h('span', { class: 'label' }, 'M(x) dataword'), dField,
      h('span', { class: 'label' }, 'G(x) divisor'), gField,
      PRESETS.map(function (p) { return ui.btn(p[1], function () { st.gen = p[0]; gField.value = p[0]; resetRx(); draw(); }); }),
      ui.seg([[0, 'Bits'], [1, 'Polynomial']], 0, function (v) { st.poly = !!+v; draw(); })));
    var err = h('div', { class: 'errmsg', style: { position: 'absolute', right: '0', top: '20px' } });
    body.appendChild(err);
    var main = h('div', { class: 'row nowrap', style: { alignItems: 'stretch', flex: 1, minHeight: 0, gap: '18px' } });
    body.appendChild(main);
    var left = h('div', { class: 'panel col', style: { width: '760px', minHeight: 0 } });
    var right = h('div', { class: 'col grow', style: { gap: '12px' } });
    main.appendChild(left); main.appendChild(right);

    function resetRx() { st.flips = []; st.shown = 0; st.view = 0; st.undet = null; }

    function rxFrame(enc) {
      if (st.undet) return st.undet;
      var f = enc.frame.split('');
      st.flips.forEach(function (i) { f[i] = f[i] === '1' ? '0' : '1'; });
      return f.join('');
    }

    function draw() {
      CN.clear(left); CN.clear(right); err.textContent = '';
      var enc = C.encode(st.data, st.gen);
      var dBad = C.parseData(st.data).error, gBad = C.parseGenerator(st.gen).error;
      dField.classList.toggle('invalid', !!dBad); gField.classList.toggle('invalid', !!gBad);
      if (enc.error) { err.textContent = enc.error; return; }
      var r = enc.r, total = enc.steps.length;
      var rx = rxFrame(enc), chk = C.check(rx, enc.gen);

      // Left: division (sender or receiver)
      var tabs = ui.tabs(['Sender: divide xʳM(x)', 'Receiver: divide what arrived'], st.view, function (i) { st.view = i; st.shown = i ? chk.steps.length : st.shown; draw(); });
      left.appendChild(tabs);
      var steps = st.view ? chk.steps : enc.steps, dividend = st.view ? rx : enc.augmented;
      var shown = st.view ? steps.length : st.shown;
      left.appendChild(h('div', { class: 'row small' },
        st.view ? h('span', { class: 'muted' }, 'Frame received ÷ G') : h('span', { class: 'muted' }, 'Append r = ' + r + ' zeros, then XOR-divide by G'),
        h('span', { style: { marginLeft: 'auto' } }),
        st.view ? null : backBtn(), st.view ? null : ui.btn('Step (S)', step), st.view ? null : ui.btn('Show all', function () { st.shown = total; draw(); }),
        st.view ? null : h('span', { class: 'muted' }, shown + ' / ' + total)));
      var scroller = h('div', { style: { overflow: 'auto', flex: 1, minHeight: 0, paddingTop: '6px' } },
        divisionGrid(dividend, enc.gen, steps, shown, { appended: st.view ? 0 : r }));
      left.appendChild(scroller);
      setTimeout(function () { scroller.scrollTop = scroller.scrollHeight; }, 0);
      if (st.view === 0) {
        left.appendChild(shown === total
          ? h('div', { class: 'banner ok', style: { fontSize: '24px' } }, 'Remainder R(x) = ' + enc.remainder + ' → frame = data + remainder')
          : h('div', { class: 'say' }, 'Each row: if the leading bit is 1, XOR with G (quotient bit 1); if 0, XOR with zeros.'));
      } else {
        left.appendChild(h('div', { class: 'banner ' + (chk.ok ? 'ok' : 'err'), style: { fontSize: '24px' } },
          'Remainder ' + chk.remainder + (chk.ok ? ' = 0 → accepted' : ' ≠ 0 → error detected')));
      }

      // Right: summary
      var sumBox = h('div', { class: 'panel col', style: { gap: '8px' } });
      function line(k, v) { return h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label', style: { width: '210px' } }, k), v); }
      var gp = C.polyString(enc.gen);
      sumBox.appendChild(line('G(x) / divisor', st.poly ? h('b', null, ui.poly(gp)) : h('b', { class: 'mono' }, enc.gen + '  (r = ' + r + ')')));
      sumBox.appendChild(line('M(x) / dataword', st.poly ? h('span', null, ui.poly(C.polyString(enc.data))) : h('b', { class: 'mono' }, enc.data)));
      var remShown = shown === total;
      sumBox.appendChild(line('R(x) / checksum', h('b', { class: 'mono amber' }, remShown ? (st.poly ? '' : enc.remainder) : '?', remShown && st.poly ? ui.poly(C.polyString(enc.remainder)) : null)));
      var frameRow = h('div', { class: 'bits' }, enc.frame.split('').map(function (b, i) {
        var isR = i >= enc.data.length;
        if (isR && !remShown) return h('span', { class: 'bit check' }, '?', h('span', { class: 'tag' }, 'R'));
        return h('span', { class: 'bit ' + (isR ? 'check' : 'data') }, b, isR ? h('span', { class: 'tag' }, 'R') : null);
      }));
      sumBox.appendChild(h('div', { class: 'label' }, 'Frame T(x) = xʳM(x) − R(x) / codeword'));
      sumBox.appendChild(frameRow);
      right.appendChild(sumBox);

      // Receiver
      var rxBox = h('div', { class: 'panel col', style: { gap: '10px' } });
      rxBox.appendChild(h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Receiver'), h('span', { class: 'small muted' }, 'click bits to flip, or:')));
      var rxRow = h('div', { class: 'bits' });
      rx.split('').forEach(function (b, i) {
        var bad = b !== enc.frame[i];
        var box = h('span', { class: 'bit click ' + (bad ? 'err' : (i >= enc.data.length ? 'check' : 'data')) }, b);
        box.addEventListener('click', function () {
          if (st.undet) { st.flips = diffs(st.undet, enc.frame); st.undet = null; }
          var k = st.flips.indexOf(i);
          if (k >= 0) st.flips.splice(k, 1); else st.flips.push(i);
          st.view = 1; draw();
        });
        rxRow.appendChild(box);
      });
      rxBox.appendChild(rxRow);
      var bl = h('input', { class: 'field', type: 'number', min: 1, max: 32, value: st.burstLen, style: { width: '80px' } });
      bl.addEventListener('input', function () { st.burstLen = Math.max(1, Math.min(enc.frame.length, +bl.value || 1)); });
      rxBox.appendChild(h('div', { class: 'row' },
        ui.btn('Burst of', function () {
          var len = st.burstLen, start = Math.max(0, Math.min(enc.frame.length - len, st.burstAt));
          st.undet = null; st.flips = [];
          for (var i = start; i < start + len; i++) st.flips.push(i);
          st.burstAt = (st.burstAt + 3) % Math.max(1, enc.frame.length - len + 1);
          st.view = 1; draw();
        }), bl, h('span', { class: 'small muted' }, 'bits'),
        ui.btn('Undetectable error', function () {
          var sh = Math.floor(Math.random() * (enc.frame.length - enc.gen.length + 1));
          st.undet = C.undetectable(enc.frame, enc.gen, sh).frame; st.flips = []; st.view = 1; draw();
        }, 'danger'),
        ui.btn('Clean frame', function () { st.undet = null; st.flips = []; draw(); })));
      var nErr = diffs(rx, enc.frame);
      var verdict;
      if (!nErr.length) verdict = h('div', { class: 'banner ok' }, 'Frame intact: remainder 0');
      else if (chk.ok) verdict = h('div', { class: 'banner err' }, 'Error E(x) = x^k·G(x), a multiple of G: remainder 0, so it slips through undetected');
      else {
        var span = nErr[nErr.length - 1] - nErr[0] + 1;
        verdict = h('div', { class: 'banner ok' }, nErr.length + ' bit' + (nErr.length > 1 ? 's' : '') + ' wrong (burst ' + span + ') → remainder ' + chk.remainder + ' ≠ 0: detected' + (span <= r ? ' (every burst ≤ r = ' + r + ' is caught)' : ''));
      }
      rxBox.appendChild(verdict);
      right.appendChild(rxBox);
      right.appendChild(h('div', { class: 'say' }, 'Undetected iff G(x) divides E(x). Ethernet uses CRC-32: every burst ≤ 32 bits is caught.'));
    }

    function diffs(a, b) { var d = []; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i); return d; }

    function backBtn() {
      var b = ui.backBtn(function () { if (st.shown > 0) { st.shown--; draw(); } });
      b.disabled = !st.shown;
      return b;
    }

    function step() {
      var enc = C.encode(st.data, st.gen);
      if (enc.error) return;
      st.view = 0;
      if (st.shown < enc.steps.length) st.shown++;
      draw();
    }
    draw();
    return {
      step: step,
      reset: function () { resetRx(); draw(); }
    };
  };
})();
