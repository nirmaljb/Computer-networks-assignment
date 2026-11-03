(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  var INFO = {
    Preamble: 'Preamble, 8 bytes: 7 × 10101010 to sync the receiver clock, then SOF 10101011 (802.3). Not counted in the 64–1518.',
    Destination: 'Destination, 6 bytes (48 bits). The I/G bit goes first on the wire: 1 = group (multicast). All 1s = broadcast. First 3 bytes = OUI (manufacturer).',
    Source: 'Source, 6 bytes: always an individual address. Bridges learn from this field.',
    'Type / Length': 'Type/Length, 2 bytes: ≤ 1500 (0x05DC) is a length; ≥ 1536 (0x0600) is a type: 0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6.',
    Data: 'Data, 0–1500 bytes (the MTU).',
    Pad: 'Pad, 0–46 bytes: fills short frames so dest → checksum is at least 64 bytes = 512 bit times = the 51.2 µs slot.',
    Checksum: 'Checksum, 4 bytes: CRC-32 over dest → pad (S3). The NIC computes it and strips it, which is why Wireshark never shows it.'
  };

  // v3 back-links: fields that carry fixes from earlier stops
  var LINKS = { Preamble: 'framing (S1)', Checksum: 'CRC-32 (S3)', Pad: '64-byte minimum (S7a)' };

  // part: 'eth' → S7b (Ethernet frame) · 'wifi' → S9b (802.11 timeline) · none → both
  CN.screens.t9 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var part = sc.part || 'both';
    var st = { len: 10, pick: 'Pad', rts: false };

    // Ethernet frame
    var eth = h('div', { class: 'panel col', style: { gap: '8px' } });
    if (part !== 'wifi') body.appendChild(eth);
    var lenField = h('input', { class: 'field', type: 'number', min: 0, max: 1500, value: st.len, style: { width: '120px' } });
    lenField.addEventListener('input', function () { st.len = lenField.value === '' ? 0 : +lenField.value; drawEth(); });
    var ethHead = h('div', { class: 'row' }, h('b', { style: { fontSize: '26px' } }, 'Ethernet (802.3) frame'), h('span', { class: 'label' }, 'Data length'), lenField, h('span', { class: 'small' }, 'bytes'));
    var ethSum = h('span', { class: 'small' });
    ethHead.appendChild(ethSum);
    eth.appendChild(ethHead);
    var bar = h('div', { class: 'row nowrap', style: { gap: '0' } });
    var links = h('div', { class: 'row nowrap', style: { gap: '0', alignItems: 'flex-start' } });
    var info = h('div', { class: 'panel', style: { background: 'var(--panel2)', fontSize: '24px', minHeight: '80px' } });
    eth.appendChild(bar);
    if (part === 'eth') eth.appendChild(links);
    eth.appendChild(info);
    eth.appendChild(h('div', { class: 'small muted' }, 'Ethernet MAC = 1-persistent CSMA/CD + binary exponential backoff (S7a). Width ∝ bytes (small fields widened to stay readable).'));

    function drawEth() {
      CN.clear(bar); CN.clear(links); ethSum.textContent = '';
      var L = st.len, bad = !(L >= 0 && L <= 1500 && Math.floor(L) === L);
      lenField.classList.toggle('invalid', bad);
      if (bad) { bar.appendChild(h('div', { class: 'errmsg' }, 'Data must be a whole number 0–1500 bytes')); return; }
      var pad = Math.max(0, 46 - L);
      var fields = [['Preamble', 8], ['Destination', 6], ['Source', 6], ['Type / Length', 2], ['Data', L], ['Pad', pad], ['Checksum', 4]];
      var total = 8 + 18 + L + pad, avail = 1480, minW = 96;
      var flexible = fields.reduce(function (a, f) { return a + f[1]; }, 0);
      fields.forEach(function (f) {
        if (f[0] === 'Pad' && !f[1]) return;
        var w = Math.max(minW, f[1] / flexible * avail);
        var cls = f[0] === 'Checksum' ? 'check' : f[0] === 'Pad' ? 'check' : f[0] === 'Data' ? 'data' : 'flag';
        var el = h('div', { class: 'bit click ' + cls + (st.pick === f[0] ? ' hl' : ''), style: { flex: w + ' 1 ' + minW + 'px', height: '74px', flexDirection: 'column', fontSize: '20px', fontFamily: 'var(--sans)', borderRadius: '0', marginLeft: '-2px' } },
          h('span', null, f[0]), h('b', { style: { fontSize: '22px' } }, f[1] + (f[0] === 'Data' ? '' : '')),
          f[0] === 'Checksum' ? h('span', { class: 'tag' }, 'CRC') : f[0] === 'Pad' ? h('span', { class: 'tag' }, 'P') : null);
        el.addEventListener('click', function () { st.pick = f[0]; drawEth(); });
        bar.appendChild(el);
        links.appendChild(h('div', { style: { flex: w + ' 1 ' + minW + 'px', marginLeft: '-2px', display: 'flex', flexDirection: 'column', alignItems: 'center' } },
          LINKS[f[0]] ? [h('span', { style: { fontSize: '22px', lineHeight: '18px', color: 'var(--accent)' } }, '↑'),
            h('span', { class: 'chip', style: { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 } }, LINKS[f[0]])] : null));
      });
      ethSum.appendChild(h('span', null, 'pad = max(0, 46 − ' + L + ') = ', h('b', null, String(pad)), ' · frame (dest → checksum) = ', h('b', null, String(total - 8)), ' bytes',
        total - 8 === 64 ? ' (the minimum)' : total - 8 === 1518 ? ' (the maximum)' : ''));
      CN.clear(info).appendChild(h('span', null, INFO[st.pick]));
    }
    drawEth();

    // 802.11 timeline
    var wifi = h('div', { class: 'panel col', style: { gap: '6px' } });
    if (part !== 'eth') body.appendChild(wifi);
    var rtsBtn = ui.toggle('RTS / CTS (optional)', st.rts, function (v) { st.rts = v; drawWifi(); });
    wifi.appendChild(h('div', { class: 'row' }, h('b', { style: { fontSize: '26px' } }, '802.11 CSMA/CA'), rtsBtn,
      h('span', { class: 'small muted' }, 'idle DIFS → random backoff (frozen while busy) → send → ACK after SIFS; no ACK → double the backoff')));
    var WW = 1480, wsvg = s('svg', { width: WW, height: 230, viewBox: '0 0 ' + WW + ' 230' });
    wifi.appendChild(wsvg);
    wifi.appendChild(h('div', { class: 'row small' },
      h('span', { class: 'chip' }, h('b', null, 'SIFS < (AIFS1) < DIFS < (AIFS4) < EIFS'), ': the shortest gap is reserved for the ACK / CTS'),
      h('span', { class: 'chip' }, 'Frame: FC · Duration · Addr1 receiver · Addr2 transmitter · Addr3 beyond AP · Seq · Data ≤ 2312 · FCS 4')));

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
    return {
      step: function () { st.rts = !st.rts; rtsBtn.set(st.rts); drawWifi(); },
      reset: function () { st.len = 10; lenField.value = 10; st.pick = 'Pad'; drawEth(); st.rts = false; rtsBtn.set(false); drawWifi(); }
    };
  };
})();
