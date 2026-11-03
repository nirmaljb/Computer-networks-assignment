(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 7f = the minimum Ethernet frame (10 data bytes, static); 9c = 802.11 timeline, Step adds RTS/CTS.
  var INFO = {
    Preamble: 'Preamble, 8 bytes: 7 × 10101010 to sync the receiver clock, then SOF 10101011 (802.3). Not counted in the 64–1518.',
    Destination: 'Destination, 6 bytes (48 bits). The I/G bit goes first on the wire: 1 = group (multicast). All 1s = broadcast. First 3 bytes = OUI (manufacturer).',
    Source: 'Source, 6 bytes: always an individual address. Bridges learn from this field.',
    'Type / Length': 'Type/Length, 2 bytes: ≤ 1500 (0x05DC) is a length; ≥ 1536 (0x0600) is a type: 0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6.',
    Data: 'Data, 0–1500 bytes (the MTU).',
    Pad: 'Pad, 0–46 bytes: fills short frames so dest → checksum is at least 64 bytes = 512 bit times = the 51.2 µs slot.',
    Checksum: 'Checksum, 4 bytes: CRC-32 over dest → pad (S3). The NIC computes it and strips it, which is why Wireshark never shows it.'
  };

  function ethernet(body) {
    var L = 10, bar = h('div', { class: 'row nowrap', style: { gap: '0', marginTop: '30px', paddingRight: '12px' } });
    body.appendChild(h('div', { class: 'say' }, 'Field sizes in bytes. Width ∝ bytes (small fields widened to stay readable).'));
    body.appendChild(bar);
      var pad = Math.max(0, 46 - L);
      var fields = [['Preamble', 8], ['Destination', 6], ['Source', 6], ['Type / Length', 2], ['Data', L], ['Pad', pad], ['Checksum', 4]];
      var total = 8 + 18 + L + pad, avail = 1400, minW = 96;
      var flexible = fields.reduce(function (a, f) { return a + f[1]; }, 0);
      fields.forEach(function (f) {
        if (f[0] === 'Pad' && !f[1]) return;
        var w = Math.max(minW, f[1] / flexible * avail);
        var cls = f[0] === 'Checksum' ? 'check' : f[0] === 'Pad' ? 'check' : f[0] === 'Data' ? 'data' : 'flag';
        var el = h('div', { class: 'bit ' + cls + (f[0] === 'Pad' ? ' hl' : ''), style: { flex: w + ' 1 ' + minW + 'px', height: '110px', flexDirection: 'column', fontSize: '24px', fontFamily: 'var(--sans)', borderRadius: '0', marginLeft: '-2px' } },
          h('span', null, f[0]), h('b', { style: { fontSize: '28px' } }, String(f[1])),
          f[0] === 'Checksum' ? h('span', { class: 'tag' }, 'CRC') : f[0] === 'Pad' ? h('span', { class: 'tag' }, 'P') : null);
        bar.appendChild(el);
      });
    body.appendChild(h('div', { class: 'banner info', style: { fontSize: '26px' } },
      'pad = max(0, 46 − ' + L + ') = ' + pad + ' → destination to checksum = ' + (total - 8) + ' bytes, the minimum (= 512 bit times).'));
    return {};
  }

  function wifiSlide(body) {
    var st = { rts: false };
    var WW = 1480, wsvg = s('svg', { width: WW, height: 250, viewBox: '0 0 ' + WW + ' 230' });
    body.appendChild(h('div', { class: 'say' }, 'Idle for DIFS → random backoff → send → ACK after SIFS. SIFS < DIFS, so the ACK always wins.'));
    body.appendChild(h('div', { class: 'panel', style: { marginTop: '20px' } }, wsvg));
    function drawWifi() {
      CN.clear(wsvg);
      var u = 34, x0 = 210;
      var rows = { S: 40, R: 92, C: 144, D: 196 };
      var names = { S: 'Sender', R: 'Receiver', C: 'C (hears sender)', D: 'D (hears receiver)' };
      Object.keys(rows).forEach(function (k) {
        if (!st.rts && (k === 'C' || k === 'D')) return;
        wsvg.appendChild(s('text', { x: 0, y: rows[k] + 7, 'font-size': 20, 'font-weight': 700 }, names[k]));
        wsvg.appendChild(s('line', { x1: x0, y1: rows[k] + 18, x2: WW - 10, y2: rows[k] + 18, stroke: 'var(--line)', 'stroke-width': 2 }));
      });
      var t = 0;
      function gap(row, len, label) {
        wsvg.appendChild(s('line', { x1: x0 + t * u, y1: rows[row] + 22, x2: x0 + (t + len) * u, y2: rows[row] + 22, stroke: 'var(--muted)', 'stroke-width': 2 }));
        wsvg.appendChild(s('text', { x: x0 + (t + len / 2) * u, y: rows[row] - 4, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--muted)', 'font-weight': 700 }, label));
        t += len;
      }
      function box(row, len, label, fill, stroke) {
        wsvg.appendChild(s('rect', { x: x0 + t * u, y: rows[row] - 14, width: len * u, height: 32, rx: 4, fill: fill, stroke: stroke, 'stroke-width': 2 }));
        wsvg.appendChild(s('text', { x: x0 + (t + len / 2) * u, y: rows[row] + 9, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, fill: stroke }, label));
        t += len;
      }
      gap('S', 3, 'DIFS');
      for (var k = 3; k >= 1; k--) {
        wsvg.appendChild(s('rect', { x: x0 + t * u + 2, y: rows.S - 8, width: u - 4, height: 22, rx: 3, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5 }));
        wsvg.appendChild(s('text', { x: x0 + (t + 0.5) * u, y: rows.S + 9, 'text-anchor': 'middle', 'font-size': 17, fill: 'var(--accent)' }, String(k)));
        t += 1;
      }
      wsvg.appendChild(s('text', { x: x0 + (t - 1.5) * u, y: rows.S - 22, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--accent)', 'font-weight': 700 }, 'backoff'));
      var navStartC, navStartD;
      if (st.rts) {
        box('S', 2, 'RTS', 'var(--accent-bg)', 'var(--accent)');
        navStartC = t;
        gap('R', 1, 'SIFS'); box('R', 2, 'CTS', 'var(--accent-bg)', 'var(--accent)');
        navStartD = t;
        gap('S', 1, 'SIFS');
      }
      box('S', 11, 'DATA', 'var(--blue-bg)', 'var(--blue)');
      gap('R', 1, 'SIFS');
      box('R', 2, 'ACK ✓', 'var(--green-bg)', 'var(--green)');
      var end = t;
      if (st.rts) {
        [['C', navStartC], ['D', navStartD]].forEach(function (p) {
          wsvg.appendChild(s('rect', { x: x0 + p[1] * u, y: rows[p[0]] - 10, width: (end - p[1]) * u, height: 24, rx: 4, fill: 'var(--panel2)', stroke: 'var(--muted)', 'stroke-dasharray': '6 4', 'stroke-width': 2 }));
          wsvg.appendChild(s('text', { x: x0 + (p[1] + end) / 2 * u, y: rows[p[0]] + 8, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 700, fill: 'var(--muted)' }, 'NAV: virtual carrier sense, set from the Duration field'));
        });
      }
    }
    drawWifi();
    function step() { if (st.rts) return false; st.rts = true; drawWifi(); return true; }
    function reset() { st.rts = false; drawWifi(); }
    body.appendChild(ui.controls(step, reset));
    return { step: step, reset: reset };
  }

  CN.screens.t9 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'eth' ? ethernet(body) : wifiSlide(body);
  };
})();
