(function () {
  'use strict';
  var CN = window.CN, h = CN.h;

  CN.screens.bridge = function (root) {
    function blk(text, cls, flex) { return h('div', { class: 'bit ' + cls, style: { flex: flex || '0 0 auto', height: '80px', fontSize: '26px', fontFamily: 'var(--sans)', padding: '0 18px', borderRadius: '0', marginLeft: '-2px' } }, text); }
    root.appendChild(h('div', { class: 'scr', style: { justifyContent: 'center', gap: '40px' } },
      h('div', { style: { fontSize: '28px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '3px' } }, 'UNIT III · THE NETWORK LAYER'),
      h('h1', { class: 'scr-title', style: { fontSize: '68px' } }, 'The frame has reached the router. Now it\'s a packet.'),
      h('div', { class: 'row nowrap', style: { gap: '0' } },
        blk('Ethernet header', 'flag'), blk('IP packet: "Hi"', 'data', '1 1 auto'), blk('CRC-32', 'check')),
      h('div', { style: { fontSize: '30px', color: 'var(--muted)' } }, '↓ the router strips the frame, reads the IP header, picks the next hop, re-frames it for the next link'),
      h('div', { class: 'row nowrap', style: { gap: '0' } },
        blk('new link header', 'flag'), blk('IP packet: "Hi" (TTL − 1)', 'data', '1 1 auto'), blk('new check', 'check')),
      h('div', { style: { fontSize: '32px' } }, 'The router has to decide where it goes next.')));
    return {};
  };
})();
