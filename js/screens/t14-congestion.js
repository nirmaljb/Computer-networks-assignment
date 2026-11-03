(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // Illustrative model only (labelled on screen): numbers show the trend, not a queueing theorem.
  function model(o) {
    var L = o.load / 100, admitted = o.admission ? Math.min(L, 0.9) : L;
    var eff = admitted;
    if (o.throttle && eff > 0.85) eff = 0.85 + (eff - 0.85) * 0.25;
    var buf = 20, q, drops, goodput;
    if (o.red) {
      q = eff < 1 ? Math.min(10, eff / (1 - eff)) : 10;
      drops = eff > 0.75 ? Math.min(0.12, (eff - 0.75) * 0.25) : 0;
      goodput = Math.min(eff, 0.97);
    } else {
      q = eff < 1 ? Math.min(buf, eff / (1 - eff)) : buf;
      drops = eff > 1 ? (eff - 1) / eff : 0;
      goodput = eff <= 1 ? eff : Math.max(0.3, 1 - 1.6 * (eff - 1));
    }
    return { offered: L, admitted: admitted, eff: eff, q: q, buf: buf, delay: q + 1, drops: drops, goodput: goodput, refused: L - admitted };
  }

  CN.screens.t14 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { load: 80, admission: false, throttle: false, red: false, milk: false };

    var steps = ['Provisioning', 'Traffic-aware routing', 'Admission control', 'Traffic throttling', 'Load shedding'];
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '8px' } },
      h('span', { class: 'small muted', style: { width: '110px', textAlign: 'right' } }, 'slower, preventive'),
      steps.map(function (t, i) {
        return [h('div', { class: 'panel', style: { padding: '6px 12px', fontSize: '22px', fontWeight: 700, flex: '1', textAlign: 'center' } }, t),
          i < steps.length - 1 ? h('span', { style: { fontSize: '26px', color: 'var(--muted)' } }, '→') : null];
      }),
      h('span', { class: 'small muted', style: { width: '100px' } }, 'faster, reactive')));

    var loadLabel = h('b', { class: 'mono', style: { fontSize: '26px', minWidth: '80px' } });
    var slider = h('input', { type: 'range', min: 0, max: 150, step: 5, value: st.load, style: { width: '300px' } });
    slider.addEventListener('input', function () { st.load = +slider.value; draw(); });
    var controls = h('div', { class: 'row', style: { gap: '10px' } },
      h('span', { class: 'label' }, 'Offered load'), slider, loadLabel,
      ui.toggle('Admission control', st.admission, function (v) { st.admission = v; draw(); }),
      ui.toggle('Throttling (choke / ECN)', st.throttle, function (v) { st.throttle = v; draw(); }),
      ui.seg([[0, 'Tail drop'], [1, 'RED']], 0, function (v) { st.red = !!+v; draw(); }),
      ui.seg([[0, 'Wine'], [1, 'Milk']], 0, function (v) { st.milk = !!+v; draw(); }));
    body.appendChild(controls);

    var svg = s('svg', { width: 940, height: 300, viewBox: '0 0 940 300' });
    var gauges = h('div', { class: 'col', style: { gap: '8px' } });
    var right = h('div', { class: 'col grow', style: { gap: '10px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { class: 'panel col', style: { gap: '6px' } }, svg, gauges, h('div', { class: 'small muted' }, 'Illustrative model — not to scale')), right));

    // traffic-aware routing oscillation (static) + throttling notes
    var osc = s('svg', { width: 520, height: 170, viewBox: '0 0 520 170' });
    [0, 1].forEach(function (k) {
      var ox = k * 270;
      osc.appendChild(s('text', { x: ox + 10, y: 20, 'font-size': 19, 'font-weight': 700, fill: 'var(--muted)' }, k ? 'Update 2: all flips to West' : 'Update 1: East looks cheap'));
      osc.appendChild(s('circle', { cx: ox + 30, cy: 95, r: 20, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
      osc.appendChild(s('circle', { cx: ox + 220, cy: 95, r: 20, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
      osc.appendChild(s('path', { d: 'M ' + (ox + 48) + ' 85 Q ' + (ox + 125) + ' 35 ' + (ox + 202) + ' 85', fill: 'none', stroke: k ? 'var(--line)' : 'var(--red)', 'stroke-width': k ? 3 : 8 }));
      osc.appendChild(s('path', { d: 'M ' + (ox + 48) + ' 105 Q ' + (ox + 125) + ' 155 ' + (ox + 202) + ' 105', fill: 'none', stroke: k ? 'var(--red)' : 'var(--line)', 'stroke-width': k ? 8 : 3 }));
      osc.appendChild(s('text', { x: ox + 125, y: 50, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--muted)' }, 'East'));
      osc.appendChild(s('text', { x: ox + 125, y: 158, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--muted)' }, 'West'));
    });
    right.appendChild(h('div', { class: 'panel col', style: { gap: '4px' } }, h('b', null, 'Traffic-aware routing'), osc,
      h('div', { class: 'small' }, 'Load in the weights → traffic oscillates every update. Fix: multipath, shift traffic slowly. The Internet uses traffic engineering instead.')));
    right.appendChild(h('div', { class: 'panel small col', style: { gap: '4px' } },
      h('div', null, h('b', null, 'Throttling: '), 'router estimates queueing delay ', h('span', { class: 'mono' }, 'd = α·d + (1−α)·s'), ' then signals:'),
      h('div', null, '· choke packet straight to the source (original tagged) · ECN: 2 IP bits marked, receiver echoes · hop-by-hop backpressure'),
      h('div', null, h('b', null, 'Admission control: '), 'refuse a VC that would congest (token bucket: rate + burst).')));

    function bar(label, val, max, unit, bad) {
      var pct = Math.max(0, Math.min(1, val / max)) * 100;
      return h('div', { class: 'row nowrap', style: { gap: '10px' } },
        h('span', { class: 'label', style: { width: '120px' } }, label),
        h('div', { style: { flex: 1, height: '22px', background: 'var(--panel2)', borderRadius: '6px', overflow: 'hidden', minWidth: '440px' } },
          h('div', { style: { width: pct + '%', height: '100%', background: bad ? 'var(--red)' : 'var(--green)' } })),
        h('b', { class: 'mono', style: { width: '230px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '22px' } }, unit));
    }

    function draw() {
      loadLabel.textContent = st.load + '%';
      var m = model(st);
      CN.clear(svg);
      // sources
      for (var i = 0; i < 3; i++) {
        var y = 60 + i * 90;
        svg.appendChild(s('rect', { x: 10, y: y - 26, width: 110, height: 52, rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
        svg.appendChild(s('text', { x: 65, y: y + 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700 }, 'Source ' + (i + 1)));
        var w = 2 + m.eff * 6;
        svg.appendChild(s('line', { x1: 120, y1: y, x2: 330, y2: 150, stroke: 'var(--blue)', 'stroke-width': w }));
      }
      if (st.throttle && m.admitted > 0.85) svg.appendChild(s('text', { x: 130, y: 22, 'font-size': 19, 'font-weight': 800, fill: 'var(--amber)' }, '← choke / ECN marks: senders slow down'));
      if (m.refused > 0.001) svg.appendChild(s('text', { x: 130, y: 292, 'font-size': 19, 'font-weight': 800, fill: 'var(--red)' }, '✕ admission control refused ' + Math.round(m.refused * 100) + '% of new load'));
      // router + queue
      svg.appendChild(s('rect', { x: 330, y: 95, width: 360, height: 110, rx: 12, fill: 'var(--panel)', stroke: 'var(--accent)', 'stroke-width': 3 }));
      svg.appendChild(s('text', { x: 345, y: 88, 'font-size': 20, 'font-weight': 700, fill: 'var(--accent)' }, 'Router queue (' + Math.round(m.q) + ' / ' + m.buf + ')'));
      var slots = m.buf, sw = 330 / slots, filled = Math.round(m.q);
      for (var k = 0; k < slots; k++) {
        var x = 345 + k * sw;
        var isIn = k < filled, dropped = false;
        // wine drops the newest (tail), milk drops the oldest (head)
        if (m.drops > 0.001 && isIn) dropped = st.milk ? k === 0 || k === 1 : k >= filled - 2;
        svg.appendChild(s('rect', { x: x + 1, y: 120, width: sw - 3, height: 60, rx: 3, fill: !isIn ? 'var(--panel2)' : dropped ? 'var(--red-bg)' : 'var(--blue-bg)', stroke: dropped ? 'var(--red)' : isIn ? 'var(--blue)' : 'var(--line)', 'stroke-width': 1.5 }));
        if (dropped) svg.appendChild(s('text', { x: x + sw / 2, y: 157, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 900, fill: 'var(--red)' }, '✕'));
      }
      svg.appendChild(s('text', { x: 345, y: 200, 'font-size': 17, fill: 'var(--muted)' }, 'out ← oldest'));
      svg.appendChild(s('text', { x: 675, y: 200, 'text-anchor': 'end', 'font-size': 17, fill: 'var(--muted)' }, 'newest ← in'));
      if (st.red) svg.appendChild(s('line', { x1: 345 + 8 * sw, y1: 110, x2: 345 + 8 * sw, y2: 190, stroke: 'var(--amber)', 'stroke-width': 3, 'stroke-dasharray': '5 4' }));
      if (st.red) svg.appendChild(s('text', { x: 345 + 8 * sw, y: 232, 'text-anchor': 'middle', 'font-size': 17, fill: 'var(--amber)', 'font-weight': 700 }, 'RED threshold (avg queue)'));
      // outgoing link
      svg.appendChild(s('line', { x1: 690, y1: 150, x2: 930, y2: 150, stroke: 'var(--green)', 'stroke-width': 2 + Math.min(1, m.goodput) * 8 }));
      svg.appendChild(s('text', { x: 810, y: 135, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700 }, 'link (capacity 100%)'));
      svg.appendChild(s('text', { x: 815, y: 185, 'text-anchor': 'middle', 'font-size': 19, fill: 'var(--muted)' }, m.drops > 0.001 ? (st.milk ? 'milk: drop the OLD' : 'wine: drop the NEW') : ''));

      CN.clear(gauges);
      gauges.appendChild(bar('Delay', m.delay, 21, m.delay.toFixed(1) + ' pkt times', m.delay > 8));
      gauges.appendChild(bar('Goodput', m.goodput, 1, Math.round(m.goodput * 100) + '% of link', m.offered > 1 && m.goodput < 0.8));
      gauges.appendChild(bar('Drops', m.drops, 0.4, (m.drops * 100).toFixed(1) + '%', m.drops > 0.02));
    }
    draw();
    return {
      reset: function () { st.load = 80; slider.value = 80; draw(); },
      step: function () { st.load = st.load >= 150 ? 0 : st.load + 10; slider.value = st.load; draw(); }
    };
  };
})();
