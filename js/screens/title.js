(function () {
  'use strict';
  var CN = window.CN, h = CN.h;

  CN.screens.title = function (root) {
    root.appendChild(h('div', { class: 'scr', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '26px' } },
      h('div', { style: { fontSize: '30px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px' } }, 'CSPC501 · COMPUTER NETWORKS'),
      h('h1', { class: 'scr-title', style: { fontSize: '96px' } }, CN.content.deckTitle),
      h('div', { style: { fontSize: '30px', color: 'var(--muted)' } }, 'Unit II: Data Link  ·  Unit III: Network  ·  Unit IV: Transport  ·  Unit V: Application'),
      h('div', { class: 'row', style: { marginTop: '40px', justifyContent: 'center', gap: '28px', fontSize: '30px' } },
        h('span', { class: 'bit data' }, 'Hi'),
        h('span', { class: 'muted', style: { fontSize: '26px' } }, '→ frame (10 stops) → packet (5) → segment (5) → message (5) →'),
        h('span', { class: 'bit data' }, 'Hi'))));
    return {};
  };
})();
