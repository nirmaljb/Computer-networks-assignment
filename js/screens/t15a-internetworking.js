(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: one panel per sub-slide: 15a how networks differ, 15b fragmentation, 15f IPv6 address,
  // 15g IPv4 vs IPv6 header, 15h tunneling (Step), 15i two-level routing.
  var STOPS = [
    { x: 110, text: 'IPv6 host builds an IPv6 packet', wrap: false },
    { x: 380, text: 'Multiprotocol router R1 wraps it: new IPv4 header, Protocol = 41 (IPv6)', wrap: true },
    { x: 740, text: 'The IPv4-only network forwards an ordinary IPv4 packet', wrap: true },
    { x: 1100, text: 'R2 sees Protocol 41, strips the IPv4 header', wrap: false },
    { x: 1370, text: 'Delivered as the original IPv6 packet', wrap: false }
  ];

  var CHIPS = ['service model', 'addressing', 'broadcast / multicast', 'max packet size', 'ordering', 'QoS', 'reliability', 'security', 'parameters (timers…)', 'accounting'];

  function differ(body) {
    body.appendChild(h('div', { class: 'say' }, 'Networks differ in all of these, so IP is the common layer over all of them.'));
    body.appendChild(h('div', { class: 'row', style: { gap: '14px', marginTop: '20px' } }, CHIPS.map(function (t) {
      return h('span', { class: 'chip' + (t === 'max packet size' ? ' bad' : ''), style: { fontSize: '30px', padding: '8px 18px' } }, t);
    })));
    return {};
  }

  function fragmentation(body) {
    var F = CN.ip.fragment(4000, 1500), fr = h('div', { class: 'panel col', style: { gap: '14px', marginTop: '10px' } });
    body.appendChild(h('div', { class: 'say' }, 'A 4000-byte datagram (20-byte header + 3980 data bytes) meets a link with MTU 1500: at most ' + F.maxData + ' data bytes per fragment, a multiple of 8.'));
    body.appendChild(fr);
    var PX = 1100 / 4000; // px per data byte; headers drawn at a fixed 70 px
    function seg(label, px, cls) {
      return h('div', { class: 'bit ' + cls, style: { flex: '0 0 ' + px + 'px', height: '58px', fontSize: '20px', fontFamily: 'var(--sans)', borderRadius: '0', marginLeft: '-2px' } }, label);
    }
    fr.appendChild(h('div', { class: 'row nowrap', style: { gap: '18px' } }, h('span', { class: 'label', style: { width: '110px' } }, 'original'),
      h('div', { class: 'row nowrap', style: { gap: '0' } }, seg('hdr 20', 70, 'flag'), seg('data: 3980 bytes', F.dataBytes * PX, 'data'))));
    var row = h('div', { class: 'row nowrap', style: { gap: '18px', alignItems: 'flex-start' } }, h('span', { class: 'label', style: { width: '110px' } }, 'fragments'));
    F.fragments.forEach(function (f) {
      row.appendChild(h('div', { class: 'col', style: { gap: '4px' } },
        h('div', { class: 'row nowrap', style: { gap: '0' } }, seg('hdr', 70, 'flag'), seg('data ' + f.start + '–' + (f.start + f.dataBytes - 1), f.dataBytes * PX, 'data')),
        h('div', { class: 'kv', style: { fontSize: '22px' } },
          h('span', { class: 'k' }, 'Total length'), h('span', { class: 'v' }, String(f.totalLength)),
          h('span', { class: 'k' }, 'Offset'), h('span', { class: 'v' }, f.offset + '  (' + f.start + ' ÷ 8)'),
          h('span', { class: 'k' }, 'MF'), h('span', { class: 'v ' + (f.mf ? 'amber' : 'ok') }, String(f.mf)))));
    });
    fr.appendChild(row);
    return {};
  }

  function tunnel(body) {
    var st = { k: 0 };
    var svg = s('svg', { width: 1460, height: 216, viewBox: '0 0 1500 222' });
    var cap = h('div', { style: { fontSize: '26px', fontWeight: 700, minHeight: '36px' } });
    body.appendChild(cap);
    body.appendChild(h('div', { class: 'panel', style: { marginTop: '20px' } }, svg));

    function pkt(x, y, wrap) {
      var g = s('g', { transform: 'translate(' + x + ',' + y + ')' });
      var parts = (wrap ? [['IPv4 hdr · proto 41', 'var(--amber-bg)', 'var(--amber)', 190]] : []).concat([['IPv6 hdr', 'var(--blue-bg)', 'var(--blue)', 100], ['"Hi"', 'var(--panel)', 'var(--ink)', 60]]);
      var total = parts.reduce(function (a, p) { return a + p[3]; }, 0), cx = -total / 2;
      parts.forEach(function (p) {
        g.appendChild(s('rect', { x: cx, y: -20, width: p[3], height: 40, fill: p[1], stroke: p[2], 'stroke-width': 2.5 }));
        g.appendChild(s('text', { x: cx + p[3] / 2, y: 7, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: p[2] }, p[0]));
        cx += p[3];
      });
      return g;
    }
    function draw() {
      CN.clear(svg);
      svg.appendChild(s('ellipse', { cx: 740, cy: 150, rx: 290, ry: 62, fill: 'var(--panel2)', stroke: 'var(--muted)', 'stroke-width': 2 }));
      svg.appendChild(s('text', { x: 740, y: 205, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, fill: 'var(--muted)' }, 'IPv4-only network'));
      svg.appendChild(s('line', { x1: 110, y1: 150, x2: 1370, y2: 150, stroke: 'var(--ink)', 'stroke-width': 3 }));
      [[110, 'IPv6 host'], [380, 'R1 (v4 + v6)'], [1100, 'R2 (v4 + v6)'], [1370, 'IPv6 host']].forEach(function (n) {
        svg.appendChild(s('rect', { x: n[0] - 44, y: 125, width: 88, height: 50, rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 3 }));
        svg.appendChild(s('text', { x: n[0], y: 199, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700 }, n[1]));
      });
      svg.appendChild(s('text', { x: 245, y: 140, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--blue)', 'font-weight': 700 }, 'IPv6 network'));
      svg.appendChild(s('text', { x: 1235, y: 140, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--blue)', 'font-weight': 700 }, 'IPv6 network'));
      var p = STOPS[st.k];
      svg.appendChild(pkt(Math.max(200, Math.min(1290, p.x)), 50, p.wrap));
      svg.appendChild(s('path', { d: 'M ' + p.x + ' 76 v 40', stroke: 'var(--accent)', 'stroke-width': 3 }));
      cap.textContent = (st.k + 1) + ' / 5 · ' + p.text;
    }
    function step() { if (st.k >= STOPS.length - 1) return false; st.k++; draw(); return true; }
    function reset() { st.k = 0; draw(); }
    draw();
    body.appendChild(ui.controls());
    // learnStep: the stop shown (one learn list item each)
    return { step: step, reset: reset, prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; }, learnStep: function () { return st.k; } };
  }

  function asRouting(body) {
    var as = s('svg', { width: 1260, height: 450, viewBox: '0 0 700 250' });
    var A = [[130, 135, 'AS 1'], [370, 72, 'AS 2'], [580, 165, 'AS 3']];
    A.forEach(function (a) {
      as.appendChild(s('ellipse', { cx: a[0], cy: a[1], rx: 112, ry: 62, fill: 'var(--panel2)', stroke: 'var(--muted)', 'stroke-width': 2 }));
      as.appendChild(s('text', { x: a[0], y: a[1] - 36, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }, a[2]));
      [[-40, 10], [10, 30], [40, -8]].forEach(function (d) {
        as.appendChild(s('circle', { cx: a[0] + d[0], cy: a[1] + d[1], r: 9, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2 }));
      });
      as.appendChild(s('path', { d: 'M ' + (a[0] - 40) + ' ' + (a[1] + 10) + ' L ' + (a[0] + 10) + ' ' + (a[1] + 30) + ' L ' + (a[0] + 40) + ' ' + (a[1] - 8), stroke: 'var(--ink)', fill: 'none', 'stroke-width': 1.5 }));
      as.appendChild(s('text', { x: a[0], y: a[1] + 54, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--muted)' }, 'OSPF inside'));
    });
    [[A[0], A[1]], [A[1], A[2]], [A[0], A[2]]].forEach(function (p) {
      as.appendChild(s('line', { x1: p[0][0] + 40, y1: p[0][1] - 8, x2: p[1][0] - 40, y2: p[1][1] + 10, stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '8 6' }));
    });
    as.appendChild(s('text', { x: 300, y: 232, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, fill: 'var(--accent)' }, 'BGP between ASes (policy)'));
    body.appendChild(h('div', { class: 'say' }, 'Inside an AS its owner picks the protocol (e.g. OSPF); between ASes BGP routes by policy, not just shortest path.'));
    body.appendChild(h('div', { class: 'panel', style: {} }, as));
    return {};
  }

  var PARTS = {
    differ: differ, frag: fragmentation, tunnel: tunnel, as: asRouting,
    v6addr: function (body) { return CN.ui.ipv6Address(body); },
    headers: function (body) { return CN.ui.ipv6Headers(body); }
  };

  CN.screens.t15a = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
