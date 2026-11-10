(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  // SPEC-v5: S8 = bitmap, token passing, binary countdown (one per sub-slide);
  // S9a/9b = hidden and exposed terminal, Step adds MACA.
  var ADDRS = ['0010', '0100', '1001', '1010'];

  function bitmap(body) {
    var bm = s('svg', { width: 1200, height: 260, viewBox: '0 0 600 130' });
    var set = { 1: 1, 3: 1, 7: 1 };
    for (var i = 0; i < 8; i++) {
      bm.appendChild(s('rect', { x: i * 30, y: 20, width: 28, height: 36, fill: set[i] ? 'var(--blue-bg)' : 'var(--panel)', stroke: set[i] ? 'var(--blue)' : 'var(--line)', 'stroke-width': 2 }));
      bm.appendChild(s('text', { x: i * 30 + 14, y: 46, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: set[i] ? 'var(--blue)' : 'var(--muted)' }, set[i] ? '1' : '0'));
      bm.appendChild(s('text', { x: i * 30 + 14, y: 76, 'text-anchor': 'middle', 'font-size': 16, fill: 'var(--muted)' }, String(i)));
    }
    bm.appendChild(s('text', { x: 0, y: 12, 'font-size': 14, fill: 'var(--muted)', 'font-weight': 700 }, '8 reservation slots'));
    [1, 3, 7].forEach(function (n, j) {
      bm.appendChild(s('rect', { x: 260 + j * 100, y: 20, width: 96, height: 36, rx: 4, fill: 'var(--green-bg)', stroke: 'var(--green)', 'stroke-width': 2 }));
      bm.appendChild(s('text', { x: 308 + j * 100, y: 46, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--green)' }, 'frame ' + n));
    });
    body.appendChild(h('div', { class: 'say' }, 'Each station sets its bit in the contention period; then the set stations send in order.'));
    body.appendChild(h('div', { class: 'panel', style: { marginTop: '20px' } }, bm));
    return {};
  }

  function token(body) {
    var svg = s('svg', { width: 520, height: 520, viewBox: '0 0 260 260' }), cx = 130, cy = 130, r = 90;
    svg.appendChild(s('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }));
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * 2 * Math.PI - Math.PI / 2;
      svg.appendChild(s('circle', { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 18, fill: k === 0 ? 'var(--accent)' : 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2 }));
    }
    svg.appendChild(s('text', { x: cx, y: cy - r - 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--accent)' }, 'token holder'));
    body.appendChild(h('div', { class: 'say' }, 'Only the token holder sends; the token circulates in order (802.5 ring, token bus).'));
    body.appendChild(h('div', { class: 'panel', style: { alignSelf: 'center' } }, svg));
    return {};
  }

  // Step reveals one bit time: every station sends its bit, the channel ORs them, losers drop out.
  function countdown(body) {
    var k = 0, out = h('div', { style: { marginTop: '20px' } }), r = X.binaryCountdown(ADDRS), w = r.addrs[0].length;
    body.appendChild(h('div', { class: 'say' }, 'Stations send their address MSB first; the channel ORs the bits. Highest address wins.'));
    body.appendChild(out);
    function draw() {
      CN.clear(out);
      var tbl = h('table', { class: 't', style: { fontSize: '30px' } });
      tbl.appendChild(h('tr', null, h('th', null, 'Station'), r.addrs[0].split('').map(function (_, b) { return h('th', { class: 'c' }, 'bit ' + b); }), h('th', null, '')));
      r.addrs.forEach(function (a, i) {
        var outAt = -1;
        r.steps.forEach(function (stp, b) { if (outAt < 0 && stp.dropped.indexOf(i) >= 0) outAt = b; });
        tbl.appendChild(h('tr', null, h('td', { class: 'mono' }, a),
          a.split('').map(function (bit, b) {
            var shown = b < k, gone = outAt >= 0 && b > outAt;
            return h('td', { class: 'c mono', style: { opacity: shown ? (gone ? 0.25 : 1) : 0.15, fontWeight: 800, color: b === outAt && shown ? 'var(--red)' : null } }, gone && shown ? '–' : bit);
          }),
          h('td', null, outAt >= 0 && outAt < k ? h('span', { class: 'bad' }, '✕ sent 0, saw 1 → out') :
            (k >= w && i === r.winner ? h('b', { class: 'ok' }, '✓ wins') : ''))));
      });
      tbl.appendChild(h('tr', null, h('th', null, 'Channel (OR)'), r.steps.map(function (stp, b) {
        return h('th', { class: 'c mono', style: { color: 'var(--accent)' } }, b < k ? String(stp.or) : '');
      }), h('th', null, '')));
      out.appendChild(tbl);
    }
    draw();
    function step() { if (k < w) { k++; draw(); return true; } return false; }
    function reset() { k = 0; draw(); }
    body.appendChild(ui.controls());
    // learnStep: the bits arbitrated so far (one learn row each)
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; }, learnStep: function () { return k; } };
  }

  function terminals(body, scen) {
    var st = { scen: scen, maca: false };
    var WW = 1100, wsvg = s('svg', { width: 1460, height: 300, viewBox: '0 0 ' + WW + ' 226' });
    var wtext = h('div', { style: { fontSize: '26px' } });
    body.appendChild(h('div', { class: 'panel', style: { marginTop: '20px' } }, wsvg));
    body.appendChild(wtext);
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
    function step() { if (st.maca) return false; st.maca = true; drawW(); return true; }
    function reset() { st.maca = false; drawW(); }
    body.appendChild(ui.controls());
    // learnStep: 0 plain carrier sense, 1 with MACA
    return { step: step, reset: reset, learnStep: function () { return st.maca ? 1 : 0; } };
  }

  var PARTS = {
    bitmap: bitmap, token: token, countdown: countdown,
    hidden: function (body) { return terminals(body, 'hidden'); },
    exposed: function (body) { return terminals(body, 'exposed'); }
  };

  CN.screens.t8 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
