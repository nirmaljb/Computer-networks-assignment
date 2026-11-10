(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, F = CN.framing;

  // SPEC-v5: one framing method per sub-slide, fixed Tanenbaum examples; Step shows the receiver side.
  // Each also takes your own data: E on all three, a drag-and-drop pop-up on 1c, a tap on a bit on 1d.
  var BIT_DATA = '011011111111111111110010';          // Fig 3-5
  var BYTE_DATA = 'A ESC FLAG B';                       // Fig 3-4, row 3
  var COUNT_STREAM = [5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 0, 1, 2, 3, 4, 5, 6, 8, 7, 8, 9, 0, 1, 2, 3]; // Fig 3-3

  function flagBox(bits) { return h('span', { class: 'bit flag' }, bits ? '01111110' : 'FLAG'); }
  function tokBox(t, cls) { return h('span', { class: 'bit tok ' + (cls || (t === 'FLAG' ? 'flag' : 'data')) }, t); }
  function line(label, kids, width, tight) {
    return h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: (width || 170) + 'px' } }, label), h('div', { class: 'bits' + (tight ? ' tight' : '') }, kids));
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

  // 1b: E types another stream. It must frame cleanly (every count ≥ 1, the last frame ends with the stream);
  // Step then hits the 2nd frame's count (+2), or the 1st when there is only one frame.
  function parseStream(text) {
    var t = String(text).trim().split(/[\s,]+/).filter(Boolean);
    if (t.length < 2 || t.length > 30) return { error: 'Type 2–30 numbers, e.g. 3 1 2 4 1 2 3' };
    if (t.some(function (x) { return !/^\d{1,2}$/.test(x); })) return { error: 'Whole numbers 0–99 only' };
    var v = t.map(Number), frames = F.byteCountFrames(v), last = frames[frames.length - 1];
    if (last.bad) return { error: 'Count 0 at byte ' + (last.start + 1) + ': a count includes itself, so it is at least 1' };
    if (last.short) return { error: 'The last count says ' + last.count + ' bytes but only ' + (v.length - last.start) + ' are left' };
    return v;
  }
  function byteCount(body) {
    var stream = COUNT_STREAM, hit = -1, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var s = stream.slice(), clean = F.byteCountFrames(stream), was = hit >= 0 ? s[clean[hit].start] : 0;
      if (hit >= 0) s[clean[hit].start] = was + 2;
      var frames = F.byteCountFrames(s), wrongFrom = hit >= 0 ? hit : 99, row = h('div', { class: 'bits', style: { gap: '4px' } });
      frames.forEach(function (fr, fi) {
        fr.bytes.forEach(function (b, j) {
          var bad = fi >= wrongFrom, cls = j === 0 ? (bad ? 'err' : 'check') : (bad ? '' : 'data');
          row.appendChild(h('span', { class: 'bit ' + cls + (j === 0 && fi > 0 ? ' gap' : '') }, String(b)));
        });
      });
      pane.appendChild(row);
      var nth = hit === 0 ? '1st' : '2nd', lastHit = hit === clean.length - 1;
      pane.appendChild(h('div', { class: hit >= 0 ? 'banner err' : 'say' }, hit < 0 ? 'Each frame starts with its own length (amber).'
        : 'The ' + nth + ' count was hit (' + was + ' → ' + (was + 2) + '): ' + (lastHit
          ? 'the receiver now waits for 2 bytes past the end of the stream.'
          : 'every later frame boundary is now read wrong.')));
    }
    draw();
    function step() { if (hit >= 0) return false; hit = F.byteCountFrames(stream).length > 1 ? 1 : 0; draw(); return true; }
    function reset() { hit = -1; draw(); }
    body.appendChild(ui.controls({ stepOnly: true }));
    return { step: step, reset: reset,
      input: ui.numbers({ label: 'The byte stream: 2–30 numbers, each frame led by its count', example: COUNT_STREAM.join(' '), parse: parseStream,
        use: function (v) { stream = v || COUNT_STREAM; reset(); } }) };
  }

  // 1c: the data bytes are a build handle (drag and drop them in a pop-up); E is a text view of it.
  var BYTE_MAX = 6;
  function parseBytes(text) {
    var t = F.tokens(text);
    if (!t.length || t.length > BYTE_MAX) return { error: 'Type 1–' + BYTE_MAX + ' bytes, e.g. A FLAG B ESC' };
    var bad = t.filter(function (x) { return !/^[A-Z]$/.test(x) && x !== 'FLAG' && x !== 'ESC'; })[0];
    return bad ? { error: '"' + bad + '" is not a byte here: use a letter, FLAG or ESC' } : t;
  }
  function byteStuffing(body) {
    var rx = false, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    var hData = ui.handle({ key: 'data', kind: 'build', label: 'Data', value: F.tokens(BYTE_DATA), button: 'Drag and drop bytes',
      palette: ['A', 'B', 'C', 'D', 'FLAG', 'ESC'], max: BYTE_MAX, tokClass: function (t) { return t === 'FLAG' || t === 'ESC' ? 'check' : 'data'; } });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var r = F.byteStuff(hData.value()), ins = {};
      r.inserted.forEach(function (i) { ins[i] = true; });
      pane.appendChild(line('Data', r.input.map(function (t) { return tokBox(t, 'data'); })));
      pane.appendChild(line('On the wire', [tokBox('FLAG'),
        r.out.map(function (t, i) { return ins[i] ? h('span', { class: 'bit tok check' + (rx ? ' gone' : '') }, t, h('span', { class: 'tag' }, 'S')) : tokBox(t, 'data'); }),
        tokBox('FLAG')]));
      if (rx) pane.appendChild(line('Receiver', F.byteDestuff(r.out).out.map(function (t) { return tokBox(t, 'data'); })));
      pane.appendChild(h('div', { class: 'say' }, rx ? 'Receiver drops each stuffed ESC and takes the next byte literally.'
        : 'The sender puts an ESC before every FLAG or ESC in the data.'));
    }
    function step() { if (rx) return false; rx = true; draw(); return true; }
    function reset() { rx = false; draw(); }
    reset();
    body.appendChild(ui.handleRow(hData));
    body.appendChild(ui.controls({ stepOnly: true }));
    return { step: step, reset: reset,
      input: ui.numbers({ label: 'Data bytes: 1–' + BYTE_MAX + ' of A–Z, FLAG, ESC', example: BYTE_DATA, parse: parseBytes,
        read: function () { return hData.value().join(' '); }, write: function (v) { hData.set(v, true); } }) };
  }

  // 1d: the data bits are a tap handle (tap one to flip it); E is a text view of it.
  var BIT_MAX = 24;
  function parseBits(text) {
    var b = String(text).replace(/\s+/g, '');
    if (!b.length || b.length > BIT_MAX) return { error: 'Type 1–' + BIT_MAX + ' bits' };
    return /^[01]+$/.test(b) ? b : { error: 'Bits must be 0 or 1 only' };
  }
  function bitStuffing(body) {
    var rx = false, pane = h('div', { class: 'col', style: { gap: '18px', marginTop: '20px' } });
    var hData = ui.handle({ key: 'data', kind: 'tap', value: BIT_DATA });
    body.appendChild(pane);
    function draw() {
      CN.clear(pane);
      var r = F.bitStuff(hData.value()), ins = {}, tight = r.out.length > 27;   // 28 bits + two flags would wrap
      r.inserted.forEach(function (i) { ins[i] = true; });
      pane.appendChild(line('Data', r.input.split('').map(function (b, i) {
        var box = h('span', { class: 'bit data click', title: 'Tap to flip this bit' }, b);
        box.addEventListener('click', function () {
          var d = hData.value().split('');
          d[i] = d[i] === '1' ? '0' : '1';
          hData.set(d.join(''));
        });
        return box;
      }), 0, tight));
      pane.appendChild(line('On the wire', [flagBox(true), r.out.split('').map(function (b, i) {
        return ins[i] ? h('span', { class: 'bit check' + (rx ? ' gone' : '') }, b, h('span', { class: 'tag' }, 'S')) : h('span', { class: 'bit data' }, b);
      }), flagBox(true)], 0, tight));
      if (rx) pane.appendChild(line('Receiver', F.bitDestuff(r.out).out.split('').map(function (b) { return h('span', { class: 'bit data' }, b); }), 0, tight));
      pane.appendChild(h('div', { class: 'say' }, rx ? 'Receiver: a 0 after five 1s was stuffed, so delete it.'
        : 'After every five 1s in a row the sender inserts a 0 (amber, S). Tap a data bit to flip it.'));
    }
    function step() { if (rx) return false; rx = true; draw(); return true; }
    function reset() { rx = false; draw(); }
    reset();
    body.appendChild(ui.controls({ stepOnly: true }));
    return { step: step, reset: reset,
      input: ui.numbers({ label: 'Data bits: 1–' + BIT_MAX + ' bits of 0/1', example: BIT_DATA, parse: parseBits,
        read: function () { return hData.value(); }, write: function (v) { hData.set(v, true); } }) };
  }

  var PARTS = { services: services, count: byteCount, bytes: byteStuffing, bits: bitStuffing };

  CN.screens.t1 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
