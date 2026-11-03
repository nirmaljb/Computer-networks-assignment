(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // Header diagrams drawn to scale in 32-bit rows (Tanenbaum 6e Fig 6-27, 6-36). Hover a field for its role.
  CN.screens.t16 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var T = CN.tcp, st = { grey: false, offset: 5 };
    var role = h('div', { class: 'panel', style: { minHeight: '74px', fontSize: '22px' } });

    function showRole(f, proto) {
      CN.clear(role);
      if (!f) { role.appendChild(h('span', { class: 'muted' }, 'Hover a field to see what it is for.')); return; }
      role.appendChild(h('b', null, proto + ' · ' + f.name + (f.bits ? ' (' + f.bits + ' bit' + (f.bits > 1 ? 's' : '') + ')' : '') + ': '));
      role.appendChild(document.createTextNode(f.role));
    }
    function ruler() {
      var r = h('div', { class: 'bitruler' });
      for (var i = 0; i < 32; i++) r.appendChild(h('span', { style: { textAlign: 'center' } }, i % 8 === 0 || i === 31 ? String(i) : ''));
      return r;
    }
    function diagram(fields, proto) {
      var g = h('div', { class: 'hdr' });
      fields.forEach(function (f) {
        var span = f.bits || 32;
        var cls = 'f' + (f.flag ? ' flag' : '') + (/port/.test(f.name) ? ' port' : '') + (st.grey && f.tcpOnly ? ' grey' : '');
        var el = h('div', { class: cls, style: { gridColumn: 'span ' + span, minHeight: f.flag ? '62px' : '48px' } }, f.name);
        if (!f.bits) el.style.minHeight = '34px';
        el.addEventListener('mouseenter', function () { showRole(f, proto); });
        g.appendChild(el);
      });
      return g;
    }

    var left = h('div', { class: 'col', style: { width: '930px', gap: '8px' } });
    var right = h('div', { class: 'col grow', style: { gap: '10px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '22px' } }, left, right));

    var greyBtn = ui.toggle('What UDP doesn\'t do', false, function (v) { st.grey = v; draw(); });
    var offField = ui.field('5', { width: 70, onInput: function (v) { st.offset = +v; drawLen(); } });
    var lenOut = h('span', { class: 'mono', style: { fontSize: '22px', fontWeight: 700 } });

    right.appendChild(h('div', { class: 'panel col', style: { gap: '6px' } },
      h('div', null, h('b', null, 'Port'), ' = which program (Tanenbaum: ', h('b', null, 'TSAP'), ')'),
      h('div', null, h('b', null, 'Socket'), ' = (IP address, port)'),
      h('div', null, h('b', null, 'Connection'), ' = 5-tuple: protocol, src IP, src port, dst IP, dst port'),
      h('div', { class: 'row', style: { gap: '8px' } },
        [['25', 'SMTP'], ['53', 'DNS'], ['80', 'HTTP'], ['443', 'HTTPS']].map(function (p) {
          return h('span', { class: 'chip' }, h('b', { class: 'mono' }, p[0]), ' ' + p[1]);
        }), h('span', { class: 'small muted' }, 'well-known: below 1024'))));
    right.appendChild(role);
    right.appendChild(h('div', { class: 'panel col', style: { gap: '6px' } },
      h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label' }, 'TCP header length (32-bit words)'), offField),
      lenOut));
    right.appendChild(h('div', { class: 'panel small col', style: { gap: '4px' } },
      h('div', null, h('b', { class: 'ok' }, 'UDP adds: '), 'ports + length + checksum. Nothing else.'),
      h('div', null, h('b', { class: 'blue' }, 'TCP adds: '), 'connections, byte sequence numbers, ACKs, a window, flags.'),
      h('div', { class: 'muted' }, 'Both checksums cover a pseudoheader too (IPs, protocol, length).')));
    var cardHost = body;
    right.appendChild(h('div', { class: 'row', style: { gap: '10px' } }, greyBtn, ui.cards([
      ['Berkeley sockets', function () {
        var rows = [['SOCKET', 'SOCKET', 'create an endpoint'], ['BIND', '', 'attach a local address (port)'], ['LISTEN', '', 'announce willingness, set queue size'],
          ['ACCEPT', 'CONNECT', 'server blocks until a client connects (handshake, stop 17)'], ['RECEIVE', 'SEND', 'exchange data over the connection'],
          ['SEND', 'RECEIVE', ''], ['CLOSE', 'CLOSE', 'release (stop 17)']];
        var t = h('table', { class: 't' }, h('tr', null, h('th', null, 'Server'), h('th', null, 'Client'), h('th', null, 'What it does')));
        rows.forEach(function (r) { t.appendChild(h('tr', null, h('td', { class: 'mono' }, r[0]), h('td', { class: 'mono' }, r[1]), h('td', null, r[2]))); });
        return h('div', { class: 'col' }, t, h('div', { class: 'small muted' }, 'Time runs down. Tanenbaum 6e: the socket primitives for TCP.'));
      }]
    ], cardHost)));

    function drawLen() {
      var r = T.tcpHeaderBytes(st.offset);
      offField.classList.toggle('invalid', !!r.error);
      CN.clear(lenOut).appendChild(document.createTextNode(r.error ? '✕ ' + r.error : st.offset + ' × 4 = ' + r.bytes + ' bytes (' + r.options + ' bytes of options)'));
    }
    function draw() {
      CN.clear(left);
      left.appendChild(h('div', { class: 'row nowrap', style: { justifyContent: 'space-between' } },
        h('b', null, 'UDP header: ', h('span', { class: 'ok' }, '8 bytes')), h('span', { class: 'small muted' }, '32 bits per row')));
      left.appendChild(ruler());
      left.appendChild(diagram(T.UDP, 'UDP'));
      left.appendChild(h('div', { class: 'row nowrap', style: { marginTop: '10px' } },
        h('b', null, 'TCP header: ', h('span', { class: 'blue' }, '20 bytes minimum, 60 maximum'))));
      left.appendChild(ruler());
      left.appendChild(diagram(T.TCP, 'TCP'));
      greyBtn.set(st.grey);
    }
    showRole(null);
    draw(); drawLen();
    return {
      step: function () { st.grey = !st.grey; draw(); },
      reset: function () { st.grey = false; st.offset = 5; offField.value = '5'; draw(); drawLen(); showRole(null); }
    };
  };
})();
