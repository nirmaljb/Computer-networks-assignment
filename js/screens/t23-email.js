(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 23a the mail path (a Step sim since v16), 23b the SMTP dialogue (one line per Step), 23c envelope /
  // header / body (static), 23d MIME and base64 (a Step sim since v27). example.com names only.
  var DIALOG = CN.http.SMTP;

  // 23a (v16): the mail path as a Step sim (CN.http.mailPath). Five nodes in four machines (dashed boxes): the
  // mailbox sits on Bob's provider's server, not on his laptop. The DNS server sits above Alice's MTA (the mail never
  // passes through it). One Step = one hop of the envelope; the hop's protocol lights up in the row under the
  // machines. Chips Bob offline / online: offline, the mail waits in the mailbox (red ✕: SMTP can't push to the laptop)
  // until Bob connects; online, step 5 is the pull. IMAP leaves a faded copy in the mailbox.
  var NX = [120, 380, 680, 920, 1180], NY = 285, BW = 190, BH = 100;
  var BOXES = [[0, 0, 'Alice\'s laptop', ''], [1, 1, 'one.example.com', 'Alice\'s provider'], [2, 3, 'two.example.com', 'Bob\'s provider'], [4, 4, 'Bob\'s laptop', '']];
  var NAMES = ['user agent', 'MTA', 'MTA', 'mailbox', 'user agent'];
  var LABELS = [['SMTP', 'submission · push'], ['SMTP, TCP 25', 'transfer · push'], ['stored', 'on the server'], ['IMAP', 'final delivery · pull']];
  function path(body) {
    var W = 1300, H = 470, hBob = ui.handle({ key: 'bob', label: 'Bob', kind: 'chips', value: 'offline', values: ['offline', 'online'], fmt: function () { return ''; }, chip: String });
    var st = { k: 0, m: null }, fresh = false;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'SMTP pushes the mail to Bob\'s server; Bob\'s user agent pulls it from there when he is online.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, svg));
    body.appendChild(ui.handleRow(hBob));
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 17, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || 'start', opacity: o.op || null }, str);
    }
    function pop(el) { if (fresh) el.setAttribute('class', 'h3-pop'); return el; }
    function envelope(x, y, faded) {
      var g = s('g', { opacity: faded ? 0.4 : null });
      g.appendChild(s('rect', { x: x - 24, y: y - 16, width: 48, height: 32, rx: 3, fill: 'var(--accent-bg)', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-dasharray': faded ? '4 3' : null }));
      g.appendChild(s('polyline', { points: (x - 24) + ',' + (y - 16) + ' ' + x + ',' + (y + 2) + ' ' + (x + 24) + ',' + (y - 16), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }));
      return g;
    }
    function arrow(x1, y1, x2, y2, look) {
      return s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: look[0], 'stroke-width': look[1], 'stroke-dasharray': look[2], 'marker-end': 'url(#ah23a-' + look[3] + ')' });
    }
    function draw() {
      CN.clear(svg);
      var m = st.m, k = st.k, cur = m.steps[k], bobOn = m.online || k === m.end, done = {};
      m.steps.slice(1, k + 1).forEach(function (p) { if (p.hop) done[p.hop[0]] = true; });
      var defs = s('defs');
      ['accent', 'muted', 'line'].forEach(function (cn) {
        defs.appendChild(s('marker', { id: 'ah23a-' + cn, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' },
          s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--' + cn + ')' })));
      });
      svg.appendChild(defs);
      svg.appendChild(t(W - 6, 24, 'step ' + k + ' of ' + m.end, { fs: 18, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      // the machines (dashed), then the five programs in them
      BOXES.forEach(function (b) {
        var x0 = NX[b[0]] - BW / 2 - 14, x1 = NX[b[1]] + BW / 2 + 14, off = b[0] === 4 && !bobOn;
        svg.appendChild(s('rect', { x: x0, y: 168, width: x1 - x0, height: 192, rx: 12, fill: off ? 'var(--grey-bg)' : 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }));
        svg.appendChild(t((x0 + x1) / 2, 194, b[2], { fs: 18, bold: true, anchor: 'middle' }));
        if (b[3]) svg.appendChild(t((x0 + x1) / 2, 214, b[3], { fs: 15, fill: 'var(--muted)', anchor: 'middle' }));
      });
      NAMES.forEach(function (n, i) {
        var here = cur.at === i, x = NX[i], y = NY - BH / 2 + 10;
        svg.appendChild(s('rect', { x: x - BW / 2, y: y, width: BW, height: BH, rx: 10, fill: 'var(--panel)', stroke: here ? 'var(--accent)' : 'var(--line)', 'stroke-width': here ? 3 : 2 }));
        svg.appendChild(t(x, y + 28, n, { fs: 20, bold: true, anchor: 'middle' }));
        if (i === 4) svg.appendChild(t(x, y + 50, bobOn ? 'online' : 'off', { fs: 16, bold: true, fill: bobOn ? 'var(--green)' : 'var(--red)', anchor: 'middle' }));
        if (here) svg.appendChild(pop(envelope(x, y + 72, false)));
        else if (i === 3 && cur.copy) {
          svg.appendChild(envelope(x, y + 72, true));
          svg.appendChild(t(x, y + 50, 'copy stays (IMAP)', { fs: 15, fill: 'var(--muted)', anchor: 'middle' }));
        }
      });
      // the four hops: done = grey, this Step's = accent, not yet = faint dashed; the label row under the machines
      [0, 1, 2, 3].forEach(function (i) {
        var x1 = NX[i] + BW / 2 + 4, x2 = NX[i + 1] - BW / 2 - 6, now = cur.hop && cur.hop[0] === i;
        var look = now ? ['var(--accent)', 4, null, 'accent'] : done[i] ? ['var(--muted)', 2.5, null, 'muted'] : ['var(--line)', 2, '5 5', 'line'];
        var a = arrow(x1, NY + 10, x2, NY + 10, look);
        svg.appendChild(now ? pop(a) : a);
        var lx = (NX[i] + NX[i + 1]) / 2, col = now ? 'var(--accent)' : done[i] ? null : 'var(--muted)';
        svg.appendChild(t(lx, 396, LABELS[i][0], { fs: 19, bold: true, fill: col, anchor: 'middle' }));
        svg.appendChild(t(lx, 418, LABELS[i][1], { fs: 15, fill: col || 'var(--muted)', anchor: 'middle' }));
      });
      if (cur.wait) {   // SMTP can't push to a laptop that is off: a red ✕ on the last hop
        var cx = (NX[3] + NX[4]) / 2;
        svg.appendChild(pop(s('path', { d: 'M ' + (cx - 12) + ' ' + (NY - 2) + ' l 24 24 m 0 -24 l -24 24', stroke: 'var(--red)', 'stroke-width': 4, fill: 'none' })));
        svg.appendChild(pop(t(cx, 156, 'no push', { fs: 16, bold: true, fill: 'var(--red)', anchor: 'middle' })));
      }
      // DNS server above Alice's MTA; step 2 draws the MX query up and the answer down
      var dx = NX[1], dnsOn = !!cur.dns;
      svg.appendChild(s('rect', { x: dx - 95, y: 30, width: 190, height: 70, rx: 10, fill: 'var(--panel)', stroke: dnsOn ? 'var(--accent)' : 'var(--line)', 'stroke-width': dnsOn ? 3 : 2 }));
      svg.appendChild(t(dx, 60, 'DNS server', { fs: 19, bold: true, anchor: 'middle' }));
      svg.appendChild(t(dx, 84, 'answers the MX query', { fs: 15, fill: 'var(--muted)', anchor: 'middle' }));
      if (dnsOn) {
        svg.appendChild(pop(arrow(dx - 84, NY - BH / 2 + 6, dx - 84, 108, ['var(--accent)', 3, '6 5', 'accent'])));
        svg.appendChild(pop(arrow(dx + 84, 104, dx + 84, NY - BH / 2 + 2, ['var(--accent)', 3, '6 5', 'accent'])));
        svg.appendChild(pop(t(dx - 96, 140, cur.dns.q, { fs: 16, bold: true, fill: 'var(--accent)', anchor: 'end' })));
        svg.appendChild(pop(t(dx + 96, 140, cur.dns.a, { fs: 16, bold: true, fill: 'var(--accent)' })));
      }
      svg.appendChild(t(20, H - 14, k + '. ' + cur.say, { fs: 20, bold: true, fill: cur.wait ? 'var(--red)' : k === m.end ? 'var(--green)' : null }));
      fresh = false;
    }
    function step() { if (st.k >= st.m.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = CN.http.mailPath(hBob.value() === 'online'); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // reached: step 5, where the predict (Bob offline: where is the mail?) is settled; learnStep: the Step, offline only
    return { step: step, reset: reset, reached: function () { return st.k >= 5; },
      learnStep: function () { return st.m.online ? null : st.k; },
      prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; } };
  }

  function dialogue(body) {
    var k = 0, dialog = h('div', { class: 'working', style: { flex: '1', minHeight: 0, width: '1200px', fontSize: '26px', whiteSpace: 'pre-wrap', overflow: 'hidden' } });
    body.appendChild(h('div', { class: 'say' }, 'Alice\'s MTA (client, blue, left) talks to Bob\'s MTA (server, green, right) over TCP port 25.'));
    body.appendChild(dialog);
    function draw() {
      CN.clear(dialog);
      DIALOG.slice(0, k).forEach(function (d, i) {
        var c = d[0] === 'C';
        dialog.appendChild(h('div', { style: { display: 'flex', margin: '3px 0', justifyContent: c ? 'flex-start' : 'flex-end' } },
          h('div', { style: { maxWidth: '80%', padding: '2px 12px', borderRadius: '8px', background: c ? 'var(--blue-bg)' : 'var(--green-bg)', color: c ? 'var(--blue)' : 'var(--green)', fontWeight: i === k - 1 ? 800 : 500 } },
            (c ? 'C: ' : 'S: ') + d[1] + (d[2] && i === k - 1 ? '   ← ' + d[2] : ''))));
      });
      dialog.scrollTop = dialog.scrollHeight;
    }
    draw();
    function step() { if (k >= DIALOG.length) return false; k++; draw(); return true; }
    function reset() { k = 0; draw(); }
    body.appendChild(ui.controls());
    // learnStep: the newest line (one learn row each)
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; }, learnStep: function () { return k; } };
  }

  function parts(body) {
    body.appendChild(h('div', { class: 'col', style: { gap: '16px', marginTop: '20px', width: '1200px' } },
      [['Envelope', 'MAIL FROM:<alice@one.example.com>  RCPT TO:<bob@two.example.com>', 'Used by the MTAs to deliver. Bcc recipients appear only here.'],
        ['Header', 'From: alice@one.example.com\nTo: bob@two.example.com\nSubject: Hi', 'Shown to the user; written by the user agent (RFC 5322).'],
        ['Body', 'Hi Bob!', 'After the blank line: 7-bit ASCII text, or MIME parts.']].map(function (p) {
        return h('div', { class: 'panel col', style: { gap: '6px', padding: '16px 20px' } },
          h('b', { style: { fontSize: '28px' } }, p[0]), h('div', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '24px' } }, p[1]), h('div', { class: 'muted', style: { fontSize: '22px' } }, p[2]));
      })));
    return {};
  }

  // 23d (v27): base64 as a Step sim (CN.http.base64). Columns line up: one bit cell per bit, the bytes row and the
  // 6-bit row hold the SAME bits (same x, same colour per byte), only the cuts move from every 8 to every 6. Fill
  // zeros are grey and dashed; a 6-bit group with no data at all becomes '='. Lines run from each character down to
  // its cell in the 64-character table. The MIME mail at the top gets its body as the characters appear.
  // Chips: Hi (one '='), Hi! (none), M (two), é (2 bytes, top bit set: why mail needs this); E: any 1–6 bytes.
  var BYTE_COL = ['blue', 'green', 'amber'];
  function mime(body) {
    var W = 1300, H = 610, X0 = 210, XW = 1070, st = { k: 0, m: null }, fresh = false;
    var hT = ui.handle({ key: 'text', label: 'Text', kind: 'chips', value: CN.http.B64_TEXTS[0],
      values: function () { var v = hT ? hT.value() : CN.http.B64_TEXTS[0]; return CN.http.B64_TEXTS.indexOf(v) >= 0 ? CN.http.B64_TEXTS : CN.http.B64_TEXTS.concat([v]); },
      fmt: function () { return ''; }, chip: function (v) { return '"' + v + '"'; } });
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    body.appendChild(h('div', { class: 'say' }, 'Mail carries 7-bit text. base64 cuts any bytes into 6-bit pieces and sends each as one of 64 safe characters.'));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, svg));
    body.appendChild(ui.handleRow(hT));
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 18, 'font-weight': o.bold ? 800 : null, fill: o.fill || null, 'text-anchor': o.anchor || null,
        opacity: o.op || null, class: o.mono ? 'mono' : null, style: o.mono ? 'white-space: pre' : null }, str);
    }
    function pop(el) { if (fresh) el.setAttribute('class', (el.getAttribute('class') ? el.getAttribute('class') + ' ' : '') + 'h3-pop'); return el; }
    function draw() {
      CN.clear(svg);
      var m = st.m, k = st.k, G = m.groups.length, GAP = 36;
      var cw = Math.min(40, Math.floor((XW - GAP * (G - 1)) / (24 * G)));
      function gx(g) { return X0 + g * (24 * cw + GAP); }
      function bx(i) { return gx(Math.floor(i / 3)) + (i % 3) * 8 * cw; }
      function col(i, bg) { return 'var(--' + BYTE_COL[i % 3] + (bg ? '-bg' : '') + ')'; }
      svg.appendChild(t(W - 8, 22, 'step ' + k + ' of ' + m.end, { fs: 17, bold: true, fill: 'var(--muted)', anchor: 'end' }));
      // row labels
      [['the mail', 44], ['text', 112], ['bytes', 156], ['8 bits each', 222], ['6 bits each', 318], ['number 0–63', 378], ['base64', 432], ['64 characters', 528]].forEach(function (r, i) {
        var on = [true, true, true, k >= 1, k >= 2, k >= 3, k >= 4, true][i];
        svg.appendChild(t(20, r[1], r[0], { fs: 18, bold: true, fill: on ? null : 'var(--line)' }));
      });
      // the MIME mail: headers, then a body that fills in at step 4 and 5
      var body5 = k >= 5 ? m.out : k >= 4 ? m.groups.map(function (g) { return g.sextets.filter(function (x) { return !x.pad; }).map(function (x) { return x.ch; }).join(''); }).join('') : '';
      svg.appendChild(s('rect', { x: X0 - 10, y: 12, width: XW - 120, height: 62, rx: 8, fill: 'var(--panel)', stroke: 'var(--line)', 'stroke-width': 2 }));
      svg.appendChild(t(X0, 36, 'MIME-Version: 1.0  Content-Type: text/plain; charset=utf-8  Content-Transfer-Encoding: base64', { fs: 15, mono: true, fill: 'var(--muted)' }));
      var bt = t(X0, 62, body5 || '(body: not encoded yet)', { fs: body5 ? 20 : 15, mono: true, bold: !!body5, fill: body5 ? 'var(--accent)' : 'var(--muted)' });
      svg.appendChild(body5 && fresh && k >= 4 ? pop(bt) : bt);
      // text: each character over the bytes it takes
      m.chars.forEach(function (c, i) {
        var first = m.owner.indexOf(i), last = m.owner.lastIndexOf(i), x0 = bx(first), x1 = bx(last) + 8 * cw;
        var label = c.ch === ' ' ? 'space' : '"' + c.ch + '"';
        svg.appendChild(t((x0 + x1) / 2, 114, label, { fs: c.ch === ' ' ? 18 : 28, bold: true, anchor: 'middle' }));
        if (last > first) svg.appendChild(s('path', { d: 'M ' + (x0 + 4) + ' 124 v 6 H ' + (x1 - 4) + ' v -6', fill: 'none', stroke: 'var(--muted)', 'stroke-width': 2 }));
      });
      // bytes: decimal value; a byte over 127 (top bit 1) is outlined red
      m.bytes.forEach(function (b, i) {
        var x = bx(i), hi = b > 127;
        svg.appendChild(s('rect', { x: x + 2, y: 134, width: 8 * cw - 4, height: 32, rx: 5, fill: col(i, true), stroke: hi ? 'var(--red)' : col(i), 'stroke-width': hi ? 3 : 2 }));
        svg.appendChild(t(x + 4 * cw, 157, String(b), { fs: 19, bold: true, fill: col(i), anchor: 'middle' }));
      });
      if (m.high) svg.appendChild(t(X0 + XW - 20, 157, 'red: top bit 1, not 7-bit ASCII', { fs: 15, bold: true, fill: 'var(--red)', anchor: 'end' }));
      if (k < 1) { caption(); return; }
      // one bit cell; fill = a grey dashed zero added to complete the last group of 6
      function cell(x, y, bit, fill) {
        var g = s('g');
        g.appendChild(s('rect', { x: x + 1, y: y, width: cw - 2, height: 34, rx: 3, fill: fill ? 'var(--grey-bg)' : col(bit.byte, true), stroke: fill ? 'var(--muted)' : col(bit.byte), 'stroke-width': 1.5, 'stroke-dasharray': fill ? '3 3' : null }));
        g.appendChild(t(x + cw / 2, y + 24, bit.b, { fs: Math.min(20, cw - 4), bold: true, mono: true, anchor: 'middle', fill: fill ? 'var(--muted)' : col(bit.byte) }));
        return g;
      }
      function cut(x, y) { svg.appendChild(s('line', { x1: x, y1: y - 8, x2: x, y2: y + 42, stroke: 'var(--ink)', 'stroke-width': 3.5 })); }
      // 8 bits each: cuts at byte edges
      m.bytes.forEach(function (b, i) {
        for (var j = 0; j < 8; j++) svg.appendChild(cell(bx(i) + j * cw, 200, { b: String(b >> (7 - j) & 1), byte: i }, false));
        cut(bx(i), 200);
        if (i % 3 === 2 || i === m.bytes.length - 1) cut(bx(i) + 8 * cw, 200);
      });
      if (k < 2) { caption(); return; }
      // 6 bits each: the same bits (same x, same colour), cut every 6; '=' groups are a dashed empty box
      svg.appendChild(t(X0 + XW / 2, 268, '↓ same bits, same order: only the cuts move ↓', { fs: 16, bold: true, fill: 'var(--muted)', anchor: 'middle' }));
      m.groups.forEach(function (gr, g) {
        gr.sextets.forEach(function (sx, q) {
          var x = gx(g) + q * 6 * cw, grp = s('g');
          if (sx.pad) grp.appendChild(s('rect', { x: x + 4, y: 296, width: 6 * cw - 8, height: 34, rx: 5, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
          else sx.bits.forEach(function (bit, j) { grp.appendChild(cell(x + j * cw, 296, bit, bit.byte === null)); });
          svg.appendChild(fresh && k === 2 ? pop(grp) : grp);
          if (!sx.pad) { cut(x, 296); cut(x + 6 * cw, 296); }
          // number, then the character
          var cx = x + 3 * cw;
          if (k >= 3 && !sx.pad) svg.appendChild(fresh && k === 3 ? pop(t(cx, 386, String(sx.value), { fs: 26, bold: true, anchor: 'middle' })) : t(cx, 386, String(sx.value), { fs: 26, bold: true, anchor: 'middle' }));
          var showCh = sx.pad ? k >= 5 : k >= 4;
          if (showCh) {
            var cg = s('g');
            cg.appendChild(s('rect', { x: cx - 26, y: 404, width: 52, height: 44, rx: 8, fill: sx.pad ? 'var(--grey-bg)' : 'var(--accent-bg)', stroke: sx.pad ? 'var(--muted)' : 'var(--accent)', 'stroke-width': 2.5 }));
            cg.appendChild(t(cx, 436, sx.ch, { fs: 30, bold: true, mono: true, anchor: 'middle', fill: sx.pad ? 'var(--muted)' : 'var(--accent)' }));
            if (!sx.pad) {
              var ax = X0 + (sx.value + 0.5) * (XW / 64);
              cg.appendChild(s('line', { x1: cx, y1: 450, x2: ax, y2: 498, stroke: 'var(--accent)', 'stroke-width': 2, opacity: 0.7 }));
            }
            svg.appendChild(fresh && (sx.pad ? k === 5 : k === 4) ? pop(cg) : cg);
          }
        });
      });
      caption();
    }
    // the 64-character table (always shown; the used cells light at step 4) and the step's sentence
    function caption() {
      var m = st.m, k = st.k, w = XW / 64, used = {};
      if (k >= 4) m.groups.forEach(function (g) { g.sextets.forEach(function (x) { if (!x.pad) used[x.value] = true; }); });
      for (var v = 0; v < 64; v++) {
        var x = X0 + v * w, on = !!used[v];
        svg.appendChild(s('rect', { x: x, y: 500, width: w, height: 40, fill: on ? 'var(--accent-bg)' : 'var(--panel)', stroke: on ? 'var(--accent)' : 'var(--line)', 'stroke-width': on ? 2.5 : 1 }));
        svg.appendChild(t(x + w / 2, 527, CN.http.B64[v], { fs: 15, bold: on, mono: true, anchor: 'middle', fill: on ? 'var(--accent)' : null }));
      }
      [0, 26, 52, 63].forEach(function (v) { svg.appendChild(t(X0 + (v + 0.5) * w, 560, String(v), { fs: 14, fill: 'var(--muted)', anchor: 'middle' })); });
      svg.appendChild(t(20, H - 14, k + '. ' + m.say[k], { fs: 20, bold: true, fill: k === m.end ? 'var(--green)' : null }));
      fresh = false;
    }
    function step() { if (st.k >= st.m.end) return false; st.k++; fresh = true; draw(); return true; }
    function reset() { st.k = 0; st.m = CN.http.base64(hT.value()); fresh = false; draw(); }
    body.appendChild(ui.controls());
    reset();
    // reached: step 5, where the '=' settles the predict; learnStep: the Step (the table follows the text via genText)
    return { step: step, reset: reset, reached: function () { return st.k >= 5; },
      prev: function () { if (st.k > 0) { st.k--; draw(); return true; } return false; },
      learnStep: function () { return st.k; }, genText: function () { return 'text ' + hT.value(); },
      input: ui.numbers({ label: 'Text: 1–' + CN.http.B64_MAX + ' bytes (UTF-8)', example: CN.http.B64_TEXTS[0],
        parse: function (x) { var v = String(x).trim(), r = CN.http.base64(v); return r.error ? r : { text: v }; },
        read: function () { return hT.value(); }, write: function (v) { hT.set(v.text, true); } }) };
  }

  var PARTS = { path: path, smtp: dialogue, parts: parts, mime: mime };

  CN.screens.t23 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
