(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, F = CN.framing;

  // SPEC-v5: one framing method per sub-slide, fixed Tanenbaum examples; Step shows the receiver side.
  var BIT_DATA = '011011111111111111110010';          // Fig 3-5
  var BYTE_DATA = 'A ESC FLAG B';                       // Fig 3-4, row 3
  var COUNT_STREAM = [5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 0, 1, 2, 3, 4, 5, 6, 8, 7, 8, 9, 0, 1, 2, 3]; // Fig 3-3

  function flagBox(bits) { return h('span', { class: 'bit flag' }, bits ? '01111110' : 'FLAG'); }
  function tokBox(t, cls) { return h('span', { class: 'bit tok ' + (cls || (t === 'FLAG' ? 'flag' : 'data')) }, t); }
  function line(label, kids, width) {
    return h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: (width || 170) + 'px' } }, label), h('div', { class: 'bits' }, kids));
  }

  function services(body) {
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '16px', alignItems: 'stretch', marginTop: '40px' } },
      [['Unacknowledged connectionless', 'Ethernet'], ['Acknowledged connectionless', '802.11 (Wi-Fi)'],
        ['Acknowledged connection-oriented', 'numbered frames, each delivered exactly once, in order']].map(function (x, i) {
        return h('div', { class: 'panel grow', style: { padding: '24px' } }, h('div', { class: 'label' }, 'Service ' + (i + 1)),
          h('div', { style: { fontWeight: 700, fontSize: '30px', margin: '8px 0' } }, x[0]), h('div', { class: 'muted' }, x[1]));
      })));
    body.appendChild(h('div', { class: 'say' }, 'Before any service, the layer must cut the bit stream into frames.'));
    return {};
  }

  function byteCount(body) {
    var corrupt = false, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var stream = COUNT_STREAM.slice();
      if (corrupt) stream[5] = 7;
      var frames = F.byteCountFrames(stream), wrongFrom = corrupt ? 1 : 99, row = h('div', { class: 'bits', style: { gap: '4px' } });
      frames.forEach(function (fr, fi) {
        fr.bytes.forEach(function (b, j) {
          var bad = fi >= wrongFrom, cls = j === 0 ? (bad ? 'err' : 'check') : (bad ? '' : 'data');
          row.appendChild(h('span', { class: 'bit ' + cls + (j === 0 && fi > 0 ? ' gap' : '') }, String(b)));
        });
      });
      pane.appendChild(row);
      pane.appendChild(h('div', { class: corrupt ? 'banner err' : 'say' }, corrupt
        ? 'The 2nd count was hit (5 → 7): every later frame boundary is now read wrong.'
        : 'Each frame starts with its own length (amber).'));
    }
    draw();
    function step() { if (corrupt) return false; corrupt = true; draw(); return true; }
    function reset() { corrupt = false; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset };
  }

  function byteStuffing(body) {
    var rx = false, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var r = F.byteStuff(BYTE_DATA), ins = {};
      r.inserted.forEach(function (i) { ins[i] = true; });
      pane.appendChild(line('Data', r.input.map(function (t) { return tokBox(t, 'data'); })));
      pane.appendChild(line('On the wire', [tokBox('FLAG'),
        r.out.map(function (t, i) { return ins[i] ? h('span', { class: 'bit tok check' + (rx ? ' gone' : '') }, t, h('span', { class: 'tag' }, 'S')) : tokBox(t, 'data'); }),
        tokBox('FLAG')]));
      if (rx) pane.appendChild(line('Receiver', F.byteDestuff(r.out).out.map(function (t) { return tokBox(t, 'data'); })));
      pane.appendChild(h('div', { class: 'say' }, rx ? 'Receiver drops each stuffed ESC and takes the next byte literally.'
        : 'The sender puts an ESC before every FLAG or ESC in the data.'));
    }
    draw();
    function step() { if (rx) return false; rx = true; draw(); return true; }
    function reset() { rx = false; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset };
  }

  function bitStuffing(body) {
    var rx = false, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var r = F.bitStuff(BIT_DATA), ins = {};
      r.inserted.forEach(function (i) { ins[i] = true; });
      pane.appendChild(line('Data', r.input.split('').map(function (b) { return h('span', { class: 'bit data' }, b); })));
      pane.appendChild(line('On the wire', [flagBox(true), r.out.split('').map(function (b, i) {
        return ins[i] ? h('span', { class: 'bit check' + (rx ? ' gone' : '') }, b, h('span', { class: 'tag' }, 'S')) : h('span', { class: 'bit data' }, b);
      }), flagBox(true)]));
      if (rx) pane.appendChild(line('Receiver', F.bitDestuff(r.out).out.split('').map(function (b) { return h('span', { class: 'bit data' }, b); })));
      pane.appendChild(h('div', { class: 'say' }, rx ? 'Receiver: a 0 after five 1s was stuffed, so delete it.'
        : 'After every five 1s in a row the sender inserts a 0 (amber, S).'));
    }
    draw();
    function step() { if (rx) return false; rx = true; draw(); return true; }
    function reset() { rx = false; draw(); }
    body.appendChild(ui.controls());
    return { step: step, reset: reset };
  }

  var PARTS = { services: services, count: byteCount, bytes: byteStuffing, bits: bitStuffing };

  CN.screens.t1 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
