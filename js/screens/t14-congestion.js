(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 14a approaches, 14b traffic-aware routing, 14c throttling + admission (static), 14d load shedding:
  // Step walks the router queue through normal load → tail drop (wine) → head drop (milk) → RED.
  // The queue model is only a picture of the trend: no numbers are shown except the queue fill.
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

  var STATES = [
    { load: 80, say: 'Offered load below capacity: the queue stays short.' },
    { load: 150, say: 'Overload, tail drop ("wine", file transfer): drop the NEWEST packets.' },
    { load: 150, milk: true, say: 'Head drop ("milk", real-time media): drop the OLDEST packets.' },
    { load: 150, red: true, say: 'RED: drop early at random once the average queue passes a threshold, so senders slow down sooner.' }
  ];

  function approaches(body) {
    var steps = ['Provisioning', 'Traffic-aware routing', 'Admission control', 'Traffic throttling', 'Load shedding'];
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '10px', marginTop: '60px' } },
      steps.map(function (t, i) {
        return [h('div', { class: 'panel', style: { padding: '24px 12px', fontSize: '28px', fontWeight: 700, flex: '1', textAlign: 'center' } }, t),
          i < steps.length - 1 ? h('span', { style: { fontSize: '34px', color: 'var(--muted)' } }, '→') : null];
      })));
    body.appendChild(h('div', { class: 'row', style: { justifyContent: 'space-between', fontSize: '26px', color: 'var(--muted)' } },
      h('span', null, '← slower, preventive'), h('span', null, 'faster, reactive →')));
    return {};
  }

  function routing(body) {
    var osc = s('svg', { width: 1300, height: 425, viewBox: '0 0 520 170' });
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
    body.appendChild(h('div', { class: 'say' }, 'Put load into the link weights and traffic flips between paths every update. Fix: multipath, shift traffic slowly.'));
    body.appendChild(h('div', { class: 'panel', style: {} }, osc));
    return {};
  }

  function throttling(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', padding: '32px', marginTop: '30px', fontSize: '30px' } },
      h('div', null, h('b', null, 'Admission control: '), 'refuse a new virtual circuit that would congest the network.'),
      h('div', null, h('b', null, 'Throttling: '), 'the router estimates its queueing delay ', h('span', { class: 'mono' }, 'd = α·d + (1−α)·s'), ' and signals the senders:'),
      h('div', { style: { paddingLeft: '30px' } }, '· a choke packet straight to the source'),
      h('div', { style: { paddingLeft: '30px' } }, '· ECN: mark 2 bits in the IP header; the receiver echoes them back'),
      h('div', { style: { paddingLeft: '30px' } }, '· hop-by-hop backpressure')));
    return {};
  }

  function shedding(body) {
    var at = 0, st;
    var say = h('div', { class: 'say' });
    var svg = s('svg', { width: 1400, height: 447, viewBox: '0 0 940 300' });
    body.appendChild(say);
    body.appendChild(h('div', { class: 'panel', style: {} }, svg));
    function draw() {
      st = STATES[at];
      say.textContent = st.say;
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

    }
    draw();
    function step() { if (at >= STATES.length - 1) return false; at++; draw(); return true; }
    function reset() { at = 0; draw(); }
    body.appendChild(ui.controls());
    // learnStep: the queue state shown (one learn row each)
    return { step: step, reset: reset, prev: function () { if (at > 0) { at--; draw(); return true; } return false; }, learnStep: function () { return at; } };
  }

  var PARTS = { approaches: approaches, routing: routing, throttling: throttling, shedding: shedding };

  CN.screens.t14 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
