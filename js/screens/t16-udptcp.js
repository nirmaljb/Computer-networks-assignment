(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, T = CN.tcp;

  // SPEC-v5: four static sub-slides. 16a ports and sockets, 16b UDP header, 16c TCP header
  // (both drawn to scale in 32-bit rows, Tanenbaum 6e Fig 6-27, 6-36), 16d Berkeley sockets.

  function ruler() {
    var r = h('div', { class: 'bitruler' });
    for (var i = 0; i < 32; i++) r.appendChild(h('span', { style: { textAlign: 'center' } }, i % 8 === 0 || i === 31 ? String(i) : ''));
    return r;
  }
  function diagram(fields) {
    var g = h('div', { class: 'hdr' });
    fields.forEach(function (f) {
      var el = h('div', { class: 'f' + (f.flag ? ' flag' : '') + (/port/.test(f.name) ? ' port' : ''),
        style: { gridColumn: 'span ' + (f.bits || 32), minHeight: f.flag ? '70px' : f.bits ? '58px' : '40px', fontSize: f.flag ? '13px' : '22px', cursor: 'default' } }, f.name);
      g.appendChild(el);
    });
    return g;
  }

  function ports(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '20px', fontSize: '32px', padding: '32px', marginTop: '30px' } },
      h('div', null, h('b', null, 'Port'), ' = which program (Tanenbaum: ', h('b', null, 'TSAP'), ')'),
      h('div', null, h('b', null, 'Socket'), ' = (IP address, port)'),
      h('div', null, h('b', null, 'Connection'), ' = 5-tuple: protocol, src IP, src port, dst IP, dst port'),
      h('div', { class: 'row', style: { gap: '12px' } },
        [['25', 'SMTP'], ['53', 'DNS'], ['80', 'HTTP'], ['443', 'HTTPS']].map(function (p) {
          return h('span', { class: 'chip', style: { fontSize: '28px' } }, h('b', { class: 'mono' }, p[0]), ' ' + p[1]);
        }), h('span', { class: 'muted', style: { fontSize: '26px' } }, 'well-known ports: below 1024'))));
    return {};
  }

  function udp(body) {
    body.appendChild(h('div', { class: 'say' }, 'UDP adds ports, a length and a checksum. Nothing else.'));
    body.appendChild(h('div', { class: 'col', style: { gap: '6px', marginTop: '20px' } }, ruler(), diagram(T.UDP)));
    return {};
  }

  function tcp(body) {
    var r = T.tcpHeaderBytes(5);
    body.appendChild(h('div', { class: 'say' }, '20 bytes minimum, 60 maximum: header length counts 32-bit words, 5 × 4 = ' + r.bytes + ' bytes.'));
    body.appendChild(h('div', { class: 'col', style: { gap: '6px', marginTop: '10px' } }, ruler(), diagram(T.TCP)));
    return {};
  }

  function sockets(body) {
    var rows = [['SOCKET', 'SOCKET', 'create an endpoint'], ['BIND', '', 'attach a local address (port)'], ['LISTEN', '', 'announce willingness, set queue size'],
      ['ACCEPT', 'CONNECT', 'server blocks until a client connects (handshake, stop 17)'], ['RECEIVE', 'SEND', 'exchange data over the connection'],
      ['SEND', 'RECEIVE', ''], ['CLOSE', 'CLOSE', 'release (stop 17)']];
    var t = h('table', { class: 't', style: { fontSize: '28px', marginTop: '20px' } }, h('tr', null, h('th', null, 'Server'), h('th', null, 'Client'), h('th', null, 'What it does')));
    rows.forEach(function (r) { t.appendChild(h('tr', null, h('td', { class: 'mono' }, r[0]), h('td', { class: 'mono' }, r[1]), h('td', null, r[2]))); });
    body.appendChild(h('div', { class: 'say' }, 'The socket primitives for TCP; time runs down.'));
    body.appendChild(t);
    return {};
  }

  var PARTS = { ports: ports, udp: udp, tcp: tcp, sockets: sockets };

  CN.screens.t16 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
