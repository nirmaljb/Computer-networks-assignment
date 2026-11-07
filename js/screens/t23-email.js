(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // SPEC-v5: 23a the mail path (a Step sim since v16), 23b the SMTP dialogue (one line per Step), 23c envelope /
  // header / body, 23d MIME base64 of "Hi". 23c and 23d are static. example.com names only.
  var DIALOG = [
    ['S', '220 two.example.com ESMTP ready', 'Server greets on TCP port 25'],
    ['C', 'HELO one.example.com', 'Client names itself'],
    ['S', '250 two.example.com', 'OK'],
    ['C', 'MAIL FROM:<alice@one.example.com>', 'Envelope sender'],
    ['S', '250 OK', ''],
    ['C', 'RCPT TO:<bob@two.example.com>', 'Envelope recipient (one per RCPT)'],
    ['S', '250 OK', ''],
    ['C', 'DATA', 'The message follows'],
    ['S', '354 End data with <CR><LF>.<CR><LF>', 'Go ahead'],
    ['C', 'From: alice@one.example.com\nTo: bob@two.example.com\nSubject: Hi\n\nHi Bob!', 'Header lines, blank line, body'],
    ['C', '.', 'A line holding only "." ends the message'],
    ['S', '250 OK: queued', 'Accepted for delivery'],
    ['C', 'QUIT', ''],
    ['S', '221 Bye', 'Connection closes']
  ];

  function b64(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return { b64: btoa(bin), n: bytes.length };
  }

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
    return { step: step, reset: reset, prev: function () { if (k > 0) { k--; draw(); return true; } return false; } };
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

  function mime(body) {
    var r = b64('Hi');
    body.appendChild(h('div', { class: 'panel col', style: { gap: '18px', fontSize: '30px', padding: '32px', marginTop: '30px' } },
      h('div', { class: 'mono', style: { fontSize: '24px' } }, 'MIME-Version: 1.0 · Content-Type: image/jpeg · Content-Transfer-Encoding: base64'),
      h('div', null, 'Text ', h('b', { class: 'mono' }, '"Hi"'), ' → base64 ', h('b', { class: 'mono' }, r.b64))));
    body.appendChild(h('div', { class: 'say' }, r.n + ' bytes → ' + r.b64.length + ' characters: every 3 bytes become 4, and "=" pads the last group.'));
    return {};
  }

  var PARTS = { path: path, smtp: dialogue, parts: parts, mime: mime };

  CN.screens.t23 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
