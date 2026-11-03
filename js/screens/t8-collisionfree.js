(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  // part: 'turns' → S8 (bitmap, token, binary countdown) · 'wireless' → S9a (hidden/exposed, MACA) · none → both
  CN.screens.t8 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var part = sc.part || 'both';
    var st = { addrs: ['0010', '0100', '1001', '1010'], k: 0, scen: 'hidden', maca: false };

    var top = h('div', { class: 'row nowrap', style: { alignItems: 'stretch', gap: '16px' } });
    if (part !== 'wireless') body.appendChild(top);

    // Bitmap + token (static)
    var bm = s('svg', { width: 520, height: 250, viewBox: '0 0 520 250' });
    (function () {
      bm.appendChild(s('text', { x: 0, y: 22, 'font-size': 22, 'font-weight': 700 }, 'Bitmap: 8 reservation slots'));
      var set = { 1: 1, 3: 1, 7: 1 };
      for (var i = 0; i < 8; i++) {
        bm.appendChild(s('rect', { x: i * 30, y: 36, width: 28, height: 36, fill: set[i] ? 'var(--blue-bg)' : 'var(--panel)', stroke: set[i] ? 'var(--blue)' : 'var(--line)', 'stroke-width': 2 }));
        bm.appendChild(s('text', { x: i * 30 + 14, y: 62, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: set[i] ? 'var(--blue)' : 'var(--muted)' }, set[i] ? '1' : '0'));
        bm.appendChild(s('text', { x: i * 30 + 14, y: 92, 'text-anchor': 'middle', 'font-size': 16, fill: 'var(--muted)' }, String(i)));
      }
      [1, 3, 7].forEach(function (n, j) {
        bm.appendChild(s('rect', { x: 250 + j * 88, y: 36, width: 84, height: 36, rx: 4, fill: 'var(--green-bg)', stroke: 'var(--green)', 'stroke-width': 2 }));
        bm.appendChild(s('text', { x: 292 + j * 88, y: 62, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--green)' }, 'frame ' + n));
      });
      bm.appendChild(s('text', { x: 0, y: 124, 'font-size': 20 }, 'Efficiency d/(d+N) at low load, d/(d+1) at high load'));
      bm.appendChild(s('text', { x: 0, y: 166, 'font-size': 22, 'font-weight': 700 }, 'Token passing'));
      var cx = 440, cy = 196, r = 44;
      bm.appendChild(s('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }));
      for (var k = 0; k < 5; k++) {
        var a = k / 5 * 2 * Math.PI - Math.PI / 2;
        bm.appendChild(s('circle', { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 9, fill: k === 0 ? 'var(--accent)' : 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2 }));
      }
      bm.appendChild(s('text', { x: 0, y: 196, 'font-size': 20 }, 'Only the token holder sends; the token'));
      bm.appendChild(s('text', { x: 0, y: 222, 'font-size': 20 }, 'circulates in order (802.5 ring, token bus)'));
    })();
    top.appendChild(h('div', { class: 'panel' }, bm));

    // Binary countdown
    var bc = h('div', { class: 'panel col grow', style: { gap: '8px' } });
    top.appendChild(bc);
    var bcBack = ui.backBtn(function () { if (st.k > 0) { st.k--; drawBC(); } });
    var inputs = st.addrs.map(function (a, i) {
      return ui.field(a, { width: 100, onInput: function (v) { st.addrs[i] = v.replace(/[^01]/g, ''); st.k = 0; drawBC(); } });
    });
    bc.appendChild(h('div', { class: 'row' }, h('b', { style: { fontSize: '24px' } }, 'Binary countdown'), inputs, bcBack, ui.btn('Step (S)', stepBC), ui.btn('Reset', function () { st.k = 0; drawBC(); })));
    var bcOut = h('div');
    bc.appendChild(bcOut);
    function drawBC() {
      CN.clear(bcOut);
      bcBack.disabled = !st.k;
      var ok = st.addrs.every(function (a) { return /^[01]{1,6}$/.test(a); });
      if (!ok) { bcOut.appendChild(h('div', { class: 'errmsg' }, 'Addresses must be 1–6 bits')); return; }
      var r = X.binaryCountdown(st.addrs), w = r.addrs[0].length;
      var tbl = h('table', { class: 't' });
      tbl.appendChild(h('tr', null, h('th', null, 'Station'), r.addrs[0].split('').map(function (_, b) { return h('th', { class: 'c' }, 'bit ' + b); }), h('th', null, '')));
      r.addrs.forEach(function (a, i) {
        var outAt = -1;
        r.steps.forEach(function (stp, b) { if (outAt < 0 && stp.dropped.indexOf(i) >= 0) outAt = b; });
        tbl.appendChild(h('tr', null, h('td', { class: 'mono' }, a),
          a.split('').map(function (bit, b) {
            var shown = b < st.k, gone = outAt >= 0 && b > outAt;
            return h('td', { class: 'c mono', style: { opacity: shown ? (gone ? 0.25 : 1) : 0.15, fontWeight: 800, color: b === outAt && shown ? 'var(--red)' : null } }, gone && shown ? '–' : bit);
          }),
          h('td', null, outAt >= 0 && outAt < st.k ? h('span', { class: 'bad' }, '✕ sent 0, saw 1 → out') :
            (st.k >= w && i === r.winner ? h('b', { class: 'ok' }, '✓ wins') : ''))));
      });
      tbl.appendChild(h('tr', null, h('th', null, 'Channel (OR)'), r.steps.map(function (stp, b) {
        return h('th', { class: 'c mono', style: { color: 'var(--accent)', fontSize: '22px' } }, b < st.k ? String(stp.or) : '');
      }), h('th', null, '')));
      bcOut.appendChild(tbl);
      bcOut.appendChild(h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'MSB first; highest address wins. Efficiency d/(d + log₂N). Not fair: rotate virtual station numbers.'));
    }
    function stepBC() {
      var w = Math.max.apply(null, st.addrs.map(function (a) { return a.length; }));
      st.k = st.k >= w ? 0 : st.k + 1; drawBC();
    }
    drawBC();

    // Wireless: hidden and exposed terminals
    var wl = h('div', { class: 'panel col', style: { gap: '6px' } });
    if (part !== 'turns') body.appendChild(wl);
    var scenSeg = ui.seg([['hidden', 'Hidden terminal'], ['exposed', 'Exposed terminal']], st.scen, function (v) { st.scen = v; drawW(); });
    var macaBtn = ui.toggle('MACA (RTS / CTS)', st.maca, function (v) { st.maca = v; drawW(); });
    wl.appendChild(h('div', { class: 'row' }, scenSeg, macaBtn,
      h('span', { class: 'small muted' }, 'each station reaches only its neighbours; the collisions that matter happen at the receiver')));
    var WW = 1500, wsvg = s('svg', { width: WW, height: 226, viewBox: '0 0 ' + WW + ' 226' });
    var wtext = h('div', { style: { fontSize: '23px' } });
    wl.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start' } }, wsvg));
    wl.appendChild(wtext);
    var NX = { A: 160, B: 420, C: 680, D: 940 }, NY = 118;

    function arrow(a, b, label, color, dy, dashed) {
      var x1 = NX[a], x2 = NX[b], dir = x2 > x1 ? 1 : -1, y = NY + (dy || 0);
      var g = s('g', null,
        s('line', { x1: x1 + dir * 34, y1: y, x2: x2 - dir * 40, y2: y, stroke: color, 'stroke-width': 4, 'stroke-dasharray': dashed ? '9 6' : null }),
        s('path', { d: 'M ' + (x2 - dir * 34) + ' ' + y + ' l ' + (-dir * 14) + ' -8 v 16 z', fill: color }),
        s('text', { x: (x1 + x2) / 2, y: y - 10, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 800, fill: color }, label));
      wsvg.appendChild(g);
    }
    function note(n, text, color, dy) {
      wsvg.appendChild(s('text', { x: NX[n], y: NY + 70 + (dy || 0), 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 800, fill: color }, text));
    }
    function drawW() {
      CN.clear(wsvg); CN.clear(wtext);
      var ranges = st.scen === 'hidden' ? ['A', 'C'] : ['B', 'C'];
      ranges.forEach(function (n) {
        wsvg.appendChild(s('ellipse', { cx: NX[n], cy: NY, rx: 300, ry: 105, fill: 'var(--accent-bg)', 'fill-opacity': 0.35, stroke: 'var(--accent)', 'stroke-dasharray': '5 6', 'stroke-width': 1.5 }));
        wsvg.appendChild(s('text', { x: NX[n], y: NY - 82, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--accent)' }, n + "'s range"));
      });
      Object.keys(NX).forEach(function (n) {
        wsvg.appendChild(s('circle', { cx: NX[n], cy: NY, r: 30, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 3 }));
        wsvg.appendChild(s('text', { x: NX[n], y: NY + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800 }, n));
      });
      var lines;
      if (st.scen === 'hidden' && !st.maca) {
        arrow('A', 'B', 'data', 'var(--blue)', -12); arrow('C', 'B', 'data', 'var(--blue)', 12);
        note('B', '✕ collision at B', 'var(--red)');
        lines = ['A and C both reach B but not each other. Carrier sense at A hears nothing from C, so both send: they collide at the receiver B.'];
      } else if (st.scen === 'hidden') {
        arrow('A', 'B', 'RTS (len)', 'var(--accent)', -30); arrow('B', 'A', 'CTS (len)', 'var(--green)', 4); arrow('B', 'C', 'CTS (len)', 'var(--green)', 4);
        note('C', 'heard CTS → silent', 'var(--red)'); note('A', 'then data ✓', 'var(--green)'); note('B', 'receives ✓', 'var(--green)');
        lines = ['MACA: A sends RTS with the length; B answers CTS with the length. C hears the CTS, so it stays silent for that long. Hidden terminal fixed.'];
      } else if (!st.maca) {
        arrow('B', 'A', 'data', 'var(--blue)', -12);
        note('C', '✕ hears B → holds off', 'var(--red)'); note('D', 'waits needlessly', 'var(--muted)');
        lines = ['B is sending to A. C hears B and wrongly holds off sending to D, although its signal could never reach A. Exposed terminal: capacity wasted.'];
      } else {
        arrow('B', 'A', 'RTS', 'var(--accent)', -30); arrow('B', 'C', 'RTS', 'var(--accent)', -30); arrow('A', 'B', 'CTS', 'var(--green)', 4);
        arrow('C', 'D', 'data', 'var(--blue)', 30);
        note('C', 'heard only RTS → may send ✓', 'var(--green)', 10);
        lines = ['C hears B\'s RTS but not A\'s CTS (A is out of C\'s range), so C knows it cannot disturb A and may send to D. Exposed terminal fixed. If RTSs collide: no CTS → back off.'];
      }
      lines.forEach(function (l) { wtext.appendChild(h('div', null, l)); });
    }
    drawW();
    // S9a: S cycles hidden → hidden + MACA → exposed → exposed + MACA
    function stepW() {
      if (!st.maca) st.maca = true;
      else { st.maca = false; st.scen = st.scen === 'hidden' ? 'exposed' : 'hidden'; }
      scenSeg.set(st.scen); macaBtn.set(st.maca); drawW();
    }
    function resetW() { st.scen = 'hidden'; st.maca = false; scenSeg.set(st.scen); macaBtn.set(st.maca); drawW(); }
    return {
      step: part === 'wireless' ? stepW : stepBC,
      reset: function () { st.k = 0; drawBC(); resetW(); }
    };
  };
})();
