(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, F = CN.framing;

  var BIT_DEFAULT = '011011111111111111110010';
  var BYTE_PRESETS = ['A FLAG B', 'A ESC B', 'A ESC FLAG B', 'A ESC ESC B'];
  var COUNT_STREAM = [5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 0, 1, 2, 3, 4, 5, 6, 8, 7, 8, 9, 0, 1, 2, 3];

  function flagBox(bits) { return h('span', { class: 'bit flag' }, bits ? '01111110' : 'FLAG'); }

  CN.screens.t1 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var state = { tab: 2, bits: BIT_DEFAULT, bytes: 'A ESC FLAG B', rx: false, corrupt: false };

    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '12px', alignItems: 'stretch' } },
      [['Unacknowledged connectionless', 'Ethernet'], ['Acknowledged connectionless', '802.11 (Wi-Fi)'],
        ['Acknowledged connection-oriented', 'numbered frames, each delivered exactly once, in order']].map(function (x, i) {
        return h('div', { class: 'panel grow' }, h('div', { class: 'label' }, 'Service ' + (i + 1)),
          h('div', { style: { fontWeight: 700, fontSize: '24px' } }, x[0]), h('div', { class: 'small muted' }, x[1]));
      })));
    body.appendChild(h('div', { class: 'row small' },
      h('span', { class: 'chip' }, h('b', null, 'Error control'), ' = ACKs, timers, sequence numbers'),
      h('span', { class: 'chip' }, h('b', null, 'Flow control'), ' = feedback-based (DLL) or rate-based'),
      h('span', { class: 'chip' }, h('b', null, 'Framing'), ': byte count · flag bytes + byte stuffing · flag bits + bit stuffing · coding violations')));

    var tabs = ui.tabs(['Byte count', 'Byte stuffing (PPP)', 'Bit stuffing (HDLC, USB)'], state.tab, function (i) { state.tab = i; draw(); });
    var pane = h('div', { class: 'col', style: { gap: '14px', paddingTop: '6px' } });
    body.appendChild(tabs);
    body.appendChild(pane);

    function rxToggle() {
      return ui.toggle('Receiver view', state.rx, function (v) { state.rx = v; draw(); });
    }

    function drawBits() {
      var f = ui.field(state.bits, { width: 560, onInput: function (v) { state.bits = v; drawOut(); } });
      var out = h('div', { class: 'col', style: { gap: '14px' } });
      pane.appendChild(h('div', { class: 'row' }, h('span', { class: 'label' }, 'Data bits'), f,
        ui.btn('Fig 3-5', function () { state.bits = BIT_DEFAULT; f.value = BIT_DEFAULT; drawOut(); }),
        ui.btn('Flag in data', function () { state.bits = '01111110'; f.value = state.bits; drawOut(); }),
        rxToggle()));
      pane.appendChild(out);
      function drawOut() {
        CN.clear(out);
        var r = F.bitStuff(state.bits);
        f.classList.toggle('invalid', !!r.error);
        if (r.error) { out.appendChild(h('div', { class: 'errmsg' }, r.error)); return; }
        out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '150px' } }, 'Data'),
          h('div', { class: 'bits' }, r.input.split('').map(function (b) { return h('span', { class: 'bit data' }, b); }))));
        var ins = {};
        r.inserted.forEach(function (i) { ins[i] = true; });
        var wire = r.out.split('').map(function (b, i) {
          return ins[i] ? h('span', { class: 'bit check' + (state.rx ? ' gone' : '') }, b, h('span', { class: 'tag' }, 'S'))
                        : h('span', { class: 'bit data' }, b);
        });
        out.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start' } },
          h('span', { class: 'label', style: { width: '150px', paddingTop: '12px' } }, 'On the wire'),
          h('div', { class: 'bits' }, flagBox(true), wire, flagBox(true))));
        if (state.rx) {
          var d = F.bitDestuff(r.out);
          out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '150px' } }, 'Receiver'),
            h('div', { class: 'bits' }, d.out.split('').map(function (b) { return h('span', { class: 'bit data' }, b); })),
            h('span', { class: 'ok', style: { fontWeight: 800 } }, d.out === r.input ? '✓ same as sent' : '')));
          out.appendChild(h('div', { class: 'say' }, 'Receiver: after five 1s, a 0 was stuffed → delete it; a 1 would mean a flag (or an error).'));
        } else {
          out.appendChild(h('div', { class: 'say' }, r.inserted.length + ' zero' + (r.inserted.length === 1 ? '' : 's') +
            ' stuffed (amber, S): after every five consecutive 1s the sender inserts a 0, so data never shows six 1s in a row.'));
        }
      }
      drawOut();
    }

    function tokBox(t, cls, tag) {
      return h('span', { class: 'bit tok ' + (cls || (t === 'FLAG' ? 'flag' : 'data')) }, t, tag ? h('span', { class: 'tag' }, tag) : null);
    }

    function drawBytes() {
      var f = ui.field(state.bytes, { width: 420, onInput: function (v) { state.bytes = v; drawOut(); } });
      var out = h('div', { class: 'col', style: { gap: '14px' } });
      pane.appendChild(h('div', { class: 'row' }, h('span', { class: 'label' }, 'Payload bytes'), f,
        BYTE_PRESETS.map(function (p) { return ui.btn(p, function () { state.bytes = p; f.value = p; drawOut(); }); }),
        rxToggle()));
      pane.appendChild(out);
      function drawOut() {
        CN.clear(out);
        var r = F.byteStuff(state.bytes);
        if (r.error) { out.appendChild(h('div', { class: 'errmsg' }, r.error)); return; }
        out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '180px' } }, 'Payload'),
          h('div', { class: 'bits' }, r.input.map(function (t) { return tokBox(t, t === 'FLAG' || t === 'ESC' ? 'data' : 'data'); }))));
        var ins = {};
        r.inserted.forEach(function (i) { ins[i] = true; });
        out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '180px' } }, 'On the wire'),
          h('div', { class: 'bits' }, tokBox('FLAG'),
            r.out.map(function (t, i) { return ins[i] ? h('span', { class: 'bit tok check' + (state.rx ? ' gone' : '') }, t, h('span', { class: 'tag' }, 'S')) : tokBox(t, 'data'); }),
            tokBox('FLAG'))));
        if (state.rx) {
          var d = F.byteDestuff(r.out);
          out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '180px' } }, 'Receiver'),
            h('div', { class: 'bits' }, d.out.map(function (t) { return tokBox(t, 'data'); })),
            h('span', { class: 'ok', style: { fontWeight: 800 } }, '✓ ESC removed, next byte taken literally')));
        } else {
          out.appendChild(h('div', { class: 'say' }, 'An ESC goes before any FLAG or ESC in the data, so a lone FLAG can only be a frame boundary.'));
        }
        out.appendChild(h('div', { class: 'row small muted' }, 'Fig 3-4: ',
          BYTE_PRESETS.map(function (p) { return h('span', { class: 'chip mono' }, p + ' → ' + F.byteStuff(p).out.join(' ')); })));
      }
      drawOut();
    }

    function drawCount() {
      var stream = COUNT_STREAM.slice();
      if (state.corrupt) stream[5] = 7;
      var frames = F.byteCountFrames(stream);
      var wrongFrom = state.corrupt ? 1 : 99;
      pane.appendChild(h('div', { class: 'row' },
        ui.toggle('Corrupt the 2nd count (5 → 7)', state.corrupt, function (v) { state.corrupt = v; draw(); }),
        h('span', { class: 'say' }, 'Each frame starts with its own length (Tanenbaum Fig 3-3).')));
      var row = h('div', { class: 'bits', style: { gap: '4px' } });
      frames.forEach(function (fr, fi) {
        fr.bytes.forEach(function (b, j) {
          var bad = fi >= wrongFrom;
          var cls = j === 0 ? (bad ? 'err' : 'check') : (bad ? '' : 'data');
          row.appendChild(h('span', { class: 'bit ' + cls + (j === 0 && fi > 0 ? ' gap' : '') }, String(b), j === 0 && !bad ? h('span', { class: 'tag' }, '#') : null));
        });
      });
      pane.appendChild(row);
      pane.appendChild(h('div', { class: 'row' }, frames.map(function (fr, fi) {
        var bad = fi >= wrongFrom;
        return h('span', { class: 'chip ' + (bad ? 'bad' : 'ok') }, (bad ? '✕ ' : '✓ ') + 'Frame ' + (fi + 1) + ': count ' + fr.count + (fr.short ? ' (runs off the end)' : ''));
      })));
      pane.appendChild(h('div', { class: state.corrupt ? 'banner err' : 'say' }, state.corrupt
        ? 'One corrupted count: the receiver now reads every later frame boundary wrong, and cannot resynchronise.'
        : 'Works only while no count is ever corrupted. That is why byte count is rarely used alone.'));
    }

    function draw() {
      CN.clear(pane);
      [drawCount, drawBytes, drawBits][state.tab]();
    }
    draw();
    return {
      reset: function () { state = { tab: 2, bits: BIT_DEFAULT, bytes: 'A ESC FLAG B', rx: false, corrupt: false }; tabs.set(2); draw(); },
      step: function () { state.rx = !state.rx; draw(); }
    };
  };
})();
