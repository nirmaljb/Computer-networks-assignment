(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // SPEC-v5: 23a the mail path, 23b the SMTP dialogue (one line per Step), 23c envelope / header / body,
  // 23d MIME base64 of "Hi". All static except 23b. example.com names only.
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

  function path(body) {
    var row = h('div', { class: 'row nowrap', style: { gap: '6px', marginTop: '60px' } });
    PATH.forEach(function (p, i) {
      if (i) row.appendChild(h('div', { class: 'col', style: { alignItems: 'center', flex: '1', minWidth: 0 } },
        h('span', { style: { fontSize: '20px', lineHeight: 1.15, textAlign: 'center', fontWeight: 700, color: 'var(--accent)' } }, HOPS[i - 1]),
        h('span', { style: { fontSize: '34px', color: 'var(--muted)' } }, '→')));
      row.appendChild(h('div', { class: 'panel col', style: { gap: '4px', padding: '14px 16px' } },
        h('b', { style: { fontSize: '24px', whiteSpace: 'nowrap' } }, p[0]), h('span', { class: 'muted', style: { whiteSpace: 'nowrap', fontSize: '20px' } }, p[1])));
    });
    body.appendChild(row);
    body.appendChild(h('div', { class: 'say', style: { marginTop: '30px' } }, 'SMTP pushes the mail to Bob\'s server; Bob\'s user agent later pulls it with IMAP or POP3.'));
    return {};
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
