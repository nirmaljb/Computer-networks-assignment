(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  var STOPS = [
    { x: 110, text: 'IPv6 host builds an IPv6 packet', wrap: false },
    { x: 380, text: 'Multiprotocol router R1 wraps it: new IPv4 header, Protocol = 41 (IPv6)', wrap: true },
    { x: 740, text: 'The IPv4-only network forwards an ordinary IPv4 packet', wrap: true },
    { x: 1100, text: 'R2 sees Protocol 41, strips the IPv4 header', wrap: false },
    { x: 1370, text: 'Delivered as the original IPv6 packet', wrap: false }
  ];

  var CHIPS = ['service model', 'addressing', 'broadcast / multicast', 'max packet size', 'ordering', 'QoS', 'reliability', 'security', 'parameters (timers…)', 'accounting'];

  /* S15a panel: how networks differ + the fragmentation strip (drawn from CN.ip.fragment) */
  function differPanel(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '10px' } },
      h('b', null, 'How networks differ, so IP is the common layer over all of them'),
      h('div', { class: 'row', style: { gap: '8px' } }, CHIPS.map(function (t) {
        return h('span', { class: 'chip' + (t === 'max packet size' ? ' bad' : ''), style: { fontSize: '22px' } }, t);
      }))));

    var F = CN.ip.fragment(4000, 1500), fr = h('div', { class: 'panel col', style: { gap: '10px' } });
    body.appendChild(fr);
    fr.appendChild(h('div', { class: 'row' }, h('b', null, 'Fragmentation: a 4000-byte datagram meets a link with MTU 1500'),
      h('span', { class: 'small muted' }, '20-byte header + 3980 data bytes · every fragment keeps the same Identification')));
    if (F.error) { fr.appendChild(h('div', { class: 'errmsg' }, F.error)); return; }
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
    fr.appendChild(h('div', { class: 'small' }, 'Each fragment carries at most ', h('b', null, F.maxData + ' data bytes'), ' (MTU − header, rounded down to a multiple of 8), because the offset counts ',
      h('b', null, '8-byte units'), '. Non-transparent: only the destination reassembles (IP); transparent would reassemble at the exit router. Path MTU discovery: set DF and react to ICMP "too big".'));
  }

  /* S15c panel 2: the tunnel animation */
  function tunnelPanel(body) {
    var st = { k: 0 }, timer = null;
    var backBtn = ui.backBtn(function () { stop(); if (st.k > 0) { st.k--; draw(); } });
    var svg = s('svg', { width: 1500, height: 222, viewBox: '0 0 1500 222' });
    var cap = h('div', { style: { fontSize: '26px', fontWeight: 700, minHeight: '36px' } });
    body.appendChild(h('div', { class: 'panel col', style: { gap: '4px' } },
      h('div', { class: 'row' }, h('b', { style: { fontSize: '26px' } }, 'Tunneling IPv6 across an IPv4 network'), backBtn, ui.btn('Step', function () { stop(); step(); }, 'primary'), ui.btn('Replay', play),
        h('span', { class: 'small muted' }, 'like a car riding the Channel Tunnel train: the car is the IPv6 packet, the train is IPv4')),
      svg, cap));
    body.appendChild(h('div', { class: 'panel small' }, h('b', null, 'Why: '), "you can't upgrade the whole Internet overnight, so IPv6 islands sit across IPv4. Tunnel when source and destination networks are the same type but a different network lies between. ",
      h('b', null, 'Downside: '), 'hosts on the middle network cannot be reached through the tunnel. A VPN is a tunnel plus encryption.'));

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
      backBtn.disabled = st.k === 0;
    }
    function step() { st.k = (st.k + 1) % STOPS.length; draw(); }
    function stop() { clearInterval(timer); timer = null; }
    // plays the five stops once, 1.4 s apart
    function play() {
      stop(); st.k = 0; draw();
      timer = setInterval(function () { if (st.k >= STOPS.length - 1) stop(); else step(); }, 1400);
    }
    draw();
    return { play: play, stop: stop, reset: function () { stop(); st.k = 0; draw(); } };
  }

  /* S15c panel 3: two-level routing */
  function asPanel(body) {
    var as = s('svg', { width: 1000, height: 357, viewBox: '0 0 700 250' });
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
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } },
      h('div', { class: 'panel' }, as),
      h('div', { class: 'panel col grow', style: { gap: '12px', fontSize: '24px' } },
        h('b', null, 'Internetwork routing is two-level'),
        h('div', null, "The path crosses networks owned by different organisations (autonomous systems)."),
        h('div', null, h('b', null, 'Intradomain'), ' inside an AS: e.g. OSPF (link state, S13), chosen by its owner.'),
        h('div', null, h('b', { style: { color: 'var(--accent)' } }, 'Interdomain'), ' between ASes: BGP, driven by policy (who pays whom), not just shortest paths.'))));
  }

  // part: 'differ' → S15a · 'tunnel' → S15c: three panels stepped with S (IPv6 · tunnel · AS routing)
  CN.screens.t15a = function (root, sc) {
    var part = sc.part || 'differ';
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    if (part === 'differ') { differPanel(body); return {}; }

    var PANELS = ['1 · IPv6', '2 · Tunneling', '3 · Two-level routing'];
    var st = { p: 0 }, tun = null;
    var tabs = ui.tabs(PANELS, 0, function (i) { show(i); });
    var pane = h('div', { class: 'col', style: { gap: '12px' } });
    body.appendChild(tabs); body.appendChild(pane);
    function show(i) {
      if (tun) tun.stop();
      tun = null; st.p = i; tabs.set(i); CN.clear(pane);
      if (i === 0) CN.ui.ipv6Panel(pane);
      else if (i === 1) { tun = tunnelPanel(pane); tun.play(); }
      else asPanel(pane);
    }
    show(0);
    return {
      step: function () { show((st.p + 1) % PANELS.length); },
      reset: function () { show(0); },
      destroy: function () { if (tun) tun.stop(); }
    };
  };
})();
