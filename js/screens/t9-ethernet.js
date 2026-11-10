(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // 7f (v26.1): the whole Ethernet frame as one static figure, fields in wire order (CN.csma.ethFrame), each with its
  // size, its contents and a tag back to the stop that motivated it; the preamble is sent but not counted, and a
  // bracket totals destination → checksum against the 64–1518 limits. Chips set the data length; 1501 is the break
  // (past the MTU). 9c = 802.11 timeline, Step adds RTS/CTS.
  var ETH_L = 10, ETH_CHIPS = [0, 10, 46, 1500, 1501];
  var ETH_LOOK = { pre: ['var(--grey-bg)', 'var(--muted)'], dst: ['var(--accent-bg)', 'var(--accent)'], src: ['var(--accent-bg)', 'var(--accent)'],
    len: ['var(--accent-bg)', 'var(--accent)'], data: ['var(--blue-bg)', 'var(--blue)'], pad: ['var(--amber-bg)', 'var(--amber)'], crc: ['var(--green-bg)', 'var(--green)'] };
  // the line under the frame: the total and what it means, [line, colour]
  function ethSay(m) {
    var L = m.L, sum = '6 + 6 + 2 + ' + L + ' + ' + m.pad + ' + 4 = ' + m.counted + ' bytes';
    if (m.over) return [sum + ' > 1518, and 0x05DD is neither a length nor a type: not a legal frame.', 'var(--red)'];
    if (m.min) return [sum + ' = 512 bits = 51.2 µs at 10 Mbps: exactly the 2τ slot (7e).', null];
    if (m.max) return [sum + ': the maximum frame.', null];
    return [sum + ': between 64 and 1518, so no pad needed.', null];
  }
  function ethernet(body) {
    var hD = ui.handle({ key: 'data', label: 'Data', kind: 'chips', value: ETH_L,
      values: function () { var v = hD ? hD.value() : ETH_L; return ETH_CHIPS.indexOf(v) >= 0 ? ETH_CHIPS : ETH_CHIPS.concat([v]).sort(function (a, b) { return a - b; }); },
      fmt: function (v) { return v + ' bytes'; }, chip: String,
      breaks: { 1501: 'One past the 1500-byte MTU: the frame would be 1519 bytes, and 0x05DD is neither a length nor a type.' } });
    var W = 1400, H = 420, Y = 84, BH = 150;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Field sizes in bytes, in the order they go on the wire. Small fields are widened to stay readable.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px', marginTop: '10px' } }, svg));
    body.appendChild(ui.handleRow(hD));
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'middle', 'font-family': o.mono ? 'var(--mono)' : null, 'white-space': o.mono ? 'pre' : null }, str);
    }
    // x and width of each field: fixed for the small ones; data and pad share 550 by their bytes
    function layout(m) {
      var fixed = { pre: 160, dst: 170, src: 170, len: 170, crc: 160 }, room = 550, dw, pw;
      if (m.pad) { dw = Math.min(room - 110, Math.max(100, room * m.L / 46)); pw = room - dw; } else { pw = 74; dw = room - pw; }
      var x = 10, out = {};
      m.fields.forEach(function (f) {
        var w = fixed[f.key] || (f.key === 'data' ? dw : pw);
        out[f.key] = { x: x, w: w };
        x += w;
      });
      return out;
    }
    function draw() {
      CN.clear(svg);
      var m = CN.csma.ethFrame(hD.value()), pos = layout(m), col = m.over ? 'var(--red)' : 'var(--green)';
      svg.appendChild(t(10, 30, 'first on the wire →', { fs: 18, fill: 'var(--muted)', anchor: 'start' }));
      svg.appendChild(t(pos.pre.x + pos.pre.w / 2, Y - 10, 'not counted', { fs: 18, fill: 'var(--muted)' }));
      m.fields.forEach(function (f) {
        var p = pos[f.key], look = ETH_LOOK[f.key], cx2 = p.x + p.w / 2, empty = !f.bytes;
        var bad = (f.key === 'data' && m.over) || (f.key === 'len' && m.kind !== 'length'), stroke = bad ? 'var(--red)' : look[1];
        svg.appendChild(s('rect', { x: p.x + 1, y: Y, width: p.w - 2, height: BH, fill: empty ? 'none' : bad ? 'var(--red-bg)' : look[0], stroke: stroke,
          'stroke-width': 2, 'stroke-dasharray': empty ? '6 4' : null }));
        svg.appendChild(t(cx2, Y + 36, f.name, { fs: f.name.length > 10 ? 19 : 22, bold: true, fill: stroke }));
        svg.appendChild(t(cx2, Y + 86, String(f.bytes), { fs: 42, bold: true, fill: stroke }));
        f.value.split(' · ').forEach(function (line, j, all) {
          if (!empty) svg.appendChild(t(cx2, Y + 120 + j * 20 - (all.length - 1) * 6, line, { fs: 17, mono: true, fill: 'var(--muted)' }));
        });
        if (f.key === 'data' && m.L > 46) {   // not to scale: a break mark
          svg.appendChild(s('path', { d: 'M ' + (cx2 + 60) + ' ' + (Y - 6) + ' l 8 10 l -8 10 l 8 10', fill: 'none', stroke: stroke, 'stroke-width': 2 }));
          svg.appendChild(s('path', { d: 'M ' + (cx2 + 60) + ' ' + (Y + BH - 24) + ' l 8 10 l -8 10 l 8 10', fill: 'none', stroke: stroke, 'stroke-width': 2 }));
        }
        if (f.link && !empty) {   // the tag back to the stop this field comes from (none on an empty pad)
          var tw = f.link.length * 10 + 26;
          svg.appendChild(s('rect', { x: cx2 - tw / 2, y: Y + BH + 12, width: tw, height: 30, rx: 15, fill: 'var(--panel)', stroke: look[1], 'stroke-width': 1.5 }));
          svg.appendChild(t(cx2, Y + BH + 33, f.link, { fs: 17, bold: true, fill: look[1] }));
        }
      });
      // destination → checksum bracketed, with its total
      var x1 = pos.dst.x + 2, x2 = pos.crc.x + pos.crc.w - 2, by = Y + BH + 62;
      svg.appendChild(s('path', { d: 'M ' + x1 + ' ' + (by - 10) + ' V ' + by + ' H ' + x2 + ' V ' + (by - 10), fill: 'none', stroke: col, 'stroke-width': 3 }));
      svg.appendChild(t((x1 + x2) / 2, by + 28, 'counted: ' + m.counted + ' bytes' + (m.over ? ' > 1518' : m.min ? ' = the minimum' : m.max ? ' = the maximum' : ''), { fs: 24, bold: true, fill: col }));
      var say = ethSay(m);
      svg.appendChild(t(10, H - 22, say[0], { fs: 22, bold: true, anchor: 'start', fill: say[1] }));
    }
    draw();
    return { reset: draw,
      input: ui.numbers({ label: 'Data bytes: 0–1500', example: String(ETH_L),
        parse: function (x) {
          if (!/^\s*\d+\s*$/.test(x)) return { error: 'A whole number of bytes, 0–1500' };
          return +x > 1500 ? { error: 'Over 1500 bytes is past the MTU (the 1501 chip shows why)' } : { L: +x };
        },
        read: function () { return String(hD.value()); }, write: function (v) { hD.set(v.L, true); } }) };
  }

  function wifiSlide(body) {
    var st = { rts: false };
    var WW = 1480, wsvg = s('svg', { width: 1440, height: 243, viewBox: '0 0 ' + WW + ' 230' });
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
    body.appendChild(ui.controls());
    // learnStep: 0 basic access, 1 with RTS/CTS
    return { step: step, reset: reset, learnStep: function () { return st.rts ? 1 : 0; } };
  }

  CN.screens.t9 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'eth' ? ethernet(body) : wifiSlide(body);
  };
})();
