(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // Mail path, the SMTP dialogue step by step, envelope/header/body, and MIME base64. example.com names only.
  var PATH = [['Alice\'s user agent', 'composes'], ['Alice\'s MTA', 'one.example.com'], ['Bob\'s MTA', 'two.example.com'], ['Bob\'s mailbox', 'waits on the server'], ['Bob\'s user agent', 'reads when online']];
  var HOPS = ['SMTP', 'SMTP, TCP 25 (push)', 'delivery', 'IMAP / POP3 (pull)'];
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

  CN.screens.t23 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { k: 0, part: 'envelope', text: 'Hi' };

    var pathRow = h('div', { class: 'row nowrap', style: { gap: '6px' } });
    var dialog = h('div', { class: 'working', style: { height: '420px', fontSize: '20px', whiteSpace: 'pre-wrap' } });
    var parts = h('div', { class: 'col', style: { gap: '4px' } });
    var b64In = ui.field(st.text, { width: 330, onInput: function (v) { st.text = v; drawB64(); } });
    var b64Out = h('div', { class: 'mono', style: { fontSize: '20px', overflowWrap: 'anywhere' } });
    body.appendChild(pathRow);
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '18px' } },
      h('div', { class: 'col', style: { width: '760px', gap: '6px' } },
        h('div', { class: 'row nowrap', style: { justifyContent: 'space-between' } }, h('b', null, 'SMTP: Alice\'s MTA → Bob\'s MTA'),
          h('span', { class: 'row', style: { gap: '8px' } }, ui.btn('Step (S)', step), ui.btn('Show all', function () { st.k = DIALOG.length; draw(); }), ui.btn('Reset (R)', reset))),
        dialog),
      h('div', { class: 'col grow', style: { gap: '10px' } },
        h('div', { class: 'panel col', style: { gap: '6px' } }, h('b', null, 'What gets delivered (click)'), parts),
        h('div', { class: 'panel col', style: { gap: '6px' } },
          h('b', null, 'MIME: binary as 7-bit text'),
          h('div', { class: 'small mono' }, 'MIME-Version: 1.0 · Content-Type: image/jpeg · Content-Transfer-Encoding: base64'),
          h('div', { class: 'row nowrap', style: { gap: '8px' } }, h('span', { class: 'label' }, 'Text'), b64In),
          b64Out))));

    function drawPath() {
      CN.clear(pathRow);
      var stage = st.k === 0 ? -1 : st.k < DIALOG.length ? 1 : 3;
      PATH.forEach(function (p, i) {
        if (i) pathRow.appendChild(h('div', { class: 'col', style: { alignItems: 'center', flex: '1', minWidth: 0 } },
          h('span', { style: { fontSize: '16px', lineHeight: 1.1, textAlign: 'center', fontWeight: 700, color: i - 1 === 1 && stage >= 1 ? 'var(--accent)' : 'var(--muted)' } }, HOPS[i - 1]),
          h('span', { style: { fontSize: '26px', color: 'var(--muted)' } }, '→')));
        var on = (stage === 1 && (i === 1 || i === 2)) || (stage === 3 && i === 3);
        pathRow.appendChild(h('div', { class: 'panel col', style: { gap: '0', padding: '6px 12px', borderColor: on ? 'var(--accent)' : null, borderWidth: on ? '3px' : null } },
          h('b', { style: { fontSize: '21px', whiteSpace: 'nowrap' } }, p[0]), h('span', { class: 'small muted', style: { whiteSpace: 'nowrap' } }, p[1])));
      });
    }
    function draw() {
      drawPath();
      CN.clear(dialog);
      DIALOG.slice(0, st.k).forEach(function (d, i) {
        var c = d[0] === 'C';
        dialog.appendChild(h('div', { style: { display: 'flex', gap: '12px', margin: '2px 0', justifyContent: c ? 'flex-start' : 'flex-end' } },
          h('div', { style: { maxWidth: '78%', padding: '2px 10px', borderRadius: '8px', background: c ? 'var(--blue-bg)' : 'var(--green-bg)', color: c ? 'var(--blue)' : 'var(--green)', fontWeight: i === st.k - 1 ? 800 : 500 } },
            (c ? 'C: ' : 'S: ') + d[1] + (d[2] && i === st.k - 1 ? '   ← ' + d[2] : ''))));
      });
      if (!st.k) dialog.appendChild(h('div', { class: 'muted' }, 'S: the server speaks first. Client lines blue (left), server replies green (right).'));
      dialog.scrollTop = dialog.scrollHeight;
      drawParts();
    }
    function drawParts() {
      CN.clear(parts);
      [['envelope', 'Envelope', 'MAIL FROM:<alice@one.example.com>  RCPT TO:<bob@two.example.com>', 'Used by the MTAs to deliver. Bcc recipients appear only here.'],
        ['header', 'Header', 'From: alice@one.example.com\nTo: bob@two.example.com\nSubject: Hi', 'Shown to the user. Written by the user agent (RFC 5322).'],
        ['body', 'Body', 'Hi Bob!', 'After the blank line. 7-bit ASCII text, or MIME parts.']].forEach(function (p) {
        var on = st.part === p[0];
        var el = h('div', { class: 'clickable', style: { padding: '4px 10px', borderRadius: '8px', border: '2px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-bg)' : 'var(--panel)' } },
          h('b', null, p[1]), on ? h('div', { class: 'mono small', style: { whiteSpace: 'pre-wrap' } }, p[2]) : null, on ? h('div', { class: 'small muted' }, p[3]) : null);
        el.addEventListener('click', function () { st.part = p[0]; drawParts(); });
        parts.appendChild(el);
      });
    }
    function drawB64() {
      var r = b64(st.text);
      CN.clear(b64Out);
      b64Out.appendChild(h('div', null, r.b64 || '—'));
      b64Out.appendChild(h('div', { class: 'small muted', style: { fontFamily: 'var(--sans)' } }, r.n + ' bytes → ' + r.b64.length + ' characters (every 3 bytes → 4; "=" pads the last group)'));
    }
    function step() { if (st.k < DIALOG.length) { st.k++; draw(); } }
    function reset() { st.k = 0; draw(); }
    draw(); drawB64();
    return { step: step, reset: reset };
  };
})();
