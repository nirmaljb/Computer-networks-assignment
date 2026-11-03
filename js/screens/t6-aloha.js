(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, X = CN.csma;

  CN.screens.t6 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { G: 1, slotted: false, seed: 11, pick: null };

    var row = h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '20px' } });
    body.appendChild(row);
    var left = h('div', { class: 'panel col', style: { width: '730px' } });
    var right = h('div', { class: 'col grow', style: { gap: '12px' } });
    row.appendChild(left); row.appendChild(right);

    // S vs G plot
    var PW = 700, PH = 420, px0 = 70, py0 = PH - 50, pw = PW - 100, ph = PH - 80;
    var plot = s('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH, style: 'touch-action:none' });
    var readout = h('div', { class: 'row', style: { fontSize: '26px' } });
    left.appendChild(h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Throughput S vs offered load G'), h('span', { class: 'small muted' }, 'drag the marker')));
    left.appendChild(plot);
    left.appendChild(readout);
    function gx(G) { return px0 + G / 3 * pw; }
    function sy(S) { return py0 - S / 0.4 * ph; }
    var dragging = false;
    function drawPlot() {
      CN.clear(plot);
      for (var g = 0; g <= 3; g += 0.5) {
        plot.appendChild(s('line', { x1: gx(g), y1: py0, x2: gx(g), y2: py0 - ph, stroke: 'var(--line)', 'stroke-width': 1 }));
        plot.appendChild(s('text', { x: gx(g), y: py0 + 26, 'text-anchor': 'middle', 'font-size': 20 }, String(g)));
      }
      for (var v = 0; v <= 0.4001; v += 0.1) {
        plot.appendChild(s('line', { x1: px0, y1: sy(v), x2: px0 + pw, y2: sy(v), stroke: 'var(--line)', 'stroke-width': 1 }));
        plot.appendChild(s('text', { x: px0 - 10, y: sy(v) + 7, 'text-anchor': 'end', 'font-size': 20 }, v.toFixed(1)));
      }
      plot.appendChild(s('text', { x: px0 + pw / 2, y: PH - 4, 'text-anchor': 'middle', 'font-size': 20, fill: 'var(--muted)' }, 'G (attempts per frame time)'));
      plot.appendChild(s('text', { x: 18, y: py0 - ph / 2, 'font-size': 20, fill: 'var(--muted)', transform: 'rotate(-90 18 ' + (py0 - ph / 2) + ')', 'text-anchor': 'middle' }, 'S'));
      function curve(fn) {
        var d = '';
        for (var i = 0; i <= 300; i++) { var G = i / 100; d += (i ? 'L' : 'M') + gx(G).toFixed(1) + ' ' + sy(fn(G)).toFixed(1) + ' '; }
        return d;
      }
      plot.appendChild(s('path', { d: curve(X.alohaSlotted), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 4 }));
      plot.appendChild(s('path', { d: curve(X.alohaPure), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3.5, 'stroke-dasharray': '10 7' }));
      plot.appendChild(s('circle', { cx: gx(1), cy: sy(1 / Math.E), r: 6, fill: 'var(--accent)' }));
      plot.appendChild(s('text', { x: gx(1.45), y: sy(0.352), 'font-size': 21, 'font-weight': 700, fill: 'var(--accent)' }, 'Slotted S = Ge⁻ᴳ'));
      plot.appendChild(s('text', { x: gx(1.45), y: sy(0.352) + 24, 'font-size': 21, fill: 'var(--accent)' }, 'max 1/e ≈ 0.368 at G = 1'));
      plot.appendChild(s('circle', { cx: gx(0.5), cy: sy(1 / (2 * Math.E)), r: 6, fill: 'var(--ink)' }));
      plot.appendChild(s('text', { x: gx(1.2), y: sy(0.215), 'font-size': 21, 'font-weight': 700 }, 'Pure S = Ge⁻²ᴳ (dashed)'));
      plot.appendChild(s('text', { x: gx(1.2), y: sy(0.215) + 24, 'font-size': 21 }, 'max 1/2e ≈ 0.184 at G = 0.5'));
      // marker
      var mx = gx(st.G);
      var mk = s('g', { class: 'clickable' },
        s('line', { x1: mx, y1: py0, x2: mx, y2: py0 - ph, stroke: 'var(--red)', 'stroke-width': 3 }),
        s('rect', { x: mx - 14, y: py0 - ph - 4, width: 28, height: 28, rx: 6, fill: 'var(--red)' }),
        s('circle', { cx: mx, cy: sy(X.alohaPure(st.G)), r: 7, fill: 'var(--red)' }),
        s('circle', { cx: mx, cy: sy(X.alohaSlotted(st.G)), r: 7, fill: 'var(--red)' }),
        s('rect', { x: mx - 30, y: py0 - ph - 10, width: 60, height: ph + 10, fill: 'transparent' }));
      plot.appendChild(mk);
      CN.clear(readout);
      readout.appendChild(h('span', { class: 'chip', style: { fontSize: '24px' } }, 'G = ' + st.G.toFixed(2)));
      readout.appendChild(h('span', null, 'pure ', h('b', { class: 'mono' }, X.alohaPure(st.G).toFixed(3))));
      readout.appendChild(h('span', null, 'slotted ', h('b', { class: 'mono' }, X.alohaSlotted(st.G).toFixed(3))));
    }
    plot.addEventListener('pointerdown', function (e) { dragging = true; plot.setPointerCapture(e.pointerId); move(e); });
    plot.addEventListener('pointermove', function (e) { if (dragging) move(e); });
    plot.addEventListener('pointerup', function () { dragging = false; drawTimeline(); });
    function move(e) {
      var p = ui.svgPoint(plot, e);
      st.G = Math.max(0.05, Math.min(3, (p.x - px0) / pw * 3));
      st.G = Math.round(st.G * 20) / 20;
      drawPlot();
    }

    // static vs dynamic
    right.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'label' }, 'Static FDM/TDM wastes capacity on bursty traffic'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, 'T = 1/(μC − λ)   N sub-channels → T_N = N·T'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, 'C = 100 Mbps, 1/μ = 10,000 bits, λ = 5000/s'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, '→ T = 1/(10,000 − 5000) = ', h('b', null, '200 µs'), ' ; N = 10 → 2 ms')));

    // 5-station timeline
    var tlHead = h('div', { class: 'row' });
    var TW = 720, TH = 330, lanes = 5, lx0 = 50, lw = TW - 70, frames = 12;
    var tl = s('svg', { width: TW, height: TH, viewBox: '0 0 ' + TW + ' ' + TH });
    var tlInfo = h('div', { class: 'small' });
    right.appendChild(h('div', { class: 'panel col', style: { gap: '6px' } }, tlHead, tl, tlInfo));
    tlHead.appendChild(ui.seg([[0, 'Pure'], [1, 'Slotted']], 0, function (v) { st.slotted = !!+v; st.pick = null; drawTimeline(); }));
    tlHead.appendChild(ui.btn('New traffic', function () { st.seed++; st.pick = null; drawTimeline(); }));
    tlHead.appendChild(h('span', { class: 'small muted' }, '5 stations, load = G · click a frame for its vulnerable period'));

    function traffic() {
      var r = X.rng(st.seed * 7919), list = [];
      for (var k = 0; k < lanes; k++) {
        var t = 0, rate = st.G / lanes;
        for (;;) {
          t += -Math.log(1 - r()) / rate;
          if (t > frames - 1) break;
          var start = st.slotted ? Math.ceil(t) : t;
          if (start > frames - 1) break;
          list.push({ lane: k, start: start });
        }
      }
      list.forEach(function (a) {
        a.hit = list.some(function (b) { return b !== a && Math.abs(b.start - a.start) < 1 - 1e-9; });
      });
      return list;
    }
    function drawTimeline() {
      CN.clear(tl);
      var u = lw / frames;
      function tx(t) { return lx0 + t * u; }
      for (var i = 0; i <= frames; i++) {
        tl.appendChild(s('line', { x1: tx(i), y1: 6, x2: tx(i), y2: TH - 30, stroke: st.slotted ? 'var(--muted)' : 'var(--line)', 'stroke-width': st.slotted ? 1.5 : 1, 'stroke-dasharray': st.slotted ? null : '3 5' }));
        if (i % 2 === 0) tl.appendChild(s('text', { x: tx(i), y: TH - 8, 'text-anchor': 'middle', 'font-size': 19, fill: 'var(--muted)' }, i + 't'));
      }
      var list = traffic();
      if (st.pick) {
        var p = list.filter(function (f) { return f.lane === st.pick.lane && Math.abs(f.start - st.pick.start) < 1e-9; })[0];
        if (p) {
          var a = st.slotted ? p.start : p.start - 1, b = p.start + 1;
          tl.appendChild(s('rect', { x: tx(Math.max(0, a)), y: 4, width: tx(b) - tx(Math.max(0, a)), height: TH - 36, fill: 'var(--accent-bg)', opacity: 0.8 }));
          tl.appendChild(s('text', { x: tx(p.start + 0.5), y: 22, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, fill: 'var(--accent)' }, 'vulnerable: ' + (st.slotted ? '1 frame time' : '2 frame times')));
        }
      }
      for (var k = 0; k < lanes; k++) {
        var y = 34 + k * 54;
        tl.appendChild(s('text', { x: 8, y: y + 28, 'font-size': 21, 'font-weight': 700 }, 'S' + (k + 1)));
      }
      var ok = 0;
      list.forEach(function (f) {
        var y = 34 + f.lane * 54;
        if (!f.hit) ok++;
        var g = s('g', { class: 'clickable' },
          s('rect', { x: tx(f.start) + 1, y: y + 4, width: u - 2, height: 38, rx: 5, fill: f.hit ? 'var(--red-bg)' : 'var(--green-bg)', stroke: f.hit ? 'var(--red)' : 'var(--green)', 'stroke-width': 2 }),
          s('text', { x: tx(f.start) + u / 2, y: y + 31, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 900, fill: f.hit ? 'var(--red)' : 'var(--green)' }, f.hit ? '✕' : '✓'));
        g.addEventListener('click', function () { st.pick = { lane: f.lane, start: f.start }; drawTimeline(); });
        tl.appendChild(g);
      });
      CN.clear(tlInfo);
      tlInfo.appendChild(h('span', null, list.length + ' frames sent, ', h('b', { class: 'ok' }, ok + ' ✓'), ', ', h('b', { class: 'bad' }, (list.length - ok) + ' ✕'),
        ' → this run S ≈ ' + (ok / frames).toFixed(2) + ' per frame time (theory ' + (st.slotted ? X.alohaSlotted(st.G) : X.alohaPure(st.G)).toFixed(3) + ')'));
    }
    drawPlot(); drawTimeline();
    return {
      step: function () { st.seed++; st.pick = null; drawTimeline(); },
      reset: function () { st.G = 1; st.pick = null; drawPlot(); drawTimeline(); }
    };
  };
})();
