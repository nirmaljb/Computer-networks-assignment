(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, F = CN.framing;

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

  // 1a: the three services as three lanes playing the same 13 s loop (CN.framing.serviceLanes), A sends H, i, !
  // to B. Pure CSS keyframes built from the lib's timeline: Pause (Space) freezes them; with motion off (A)
  // every lane shows its end state (what B passed up, the ✕ losses, the timeout, the dropped duplicate).
  var SVC_TEXT = [
    ['Unacknowledged', 'connectionless', 'Ethernet', 'no ACK: a lost frame stays lost'],
    ['Acknowledged', 'connectionless', '802.11 (Wi-Fi)', 'ACK each frame, resend on timeout'],
    ['Acknowledged', 'connection-oriented', 'e.g. long satellite links', 'connect · number · ACK · release']];
  function services(body) {
    var run = F.serviceLanes(), LOOP = run.loop, SHOW = LOOP - 0.6, GONE = LOOP - 0.2;
    var W = 1500, LH = 200, XA = 470, XB = 1080, BOX = 56, SLOT = 1185, svg, css, kf;
    function pc(t) { return (Math.max(0, Math.min(LOOP, t)) / LOOP * 100).toFixed(3) + '%'; }
    function anim(el, frames) {
      var name = 'svc' + (kf++);
      css.push('@keyframes ' + name + ' {' + frames.map(function (f) { return f[0] + ' {' + f[1] + '}'; }).join(' ') + '}');
      el.setAttribute('style', 'animation: ' + name + ' ' + LOOP + 's linear infinite');
      return el;
    }
    // on screen from t to the end of the loop (base style = shown, so motion off keeps it)
    function from(el, t) {
      return anim(el, [['0%, ' + pc(t - 0.01), 'opacity: 0'], [pc(t) + ', ' + pc(SHOW), 'opacity: 1'], [pc(GONE) + ', 100%', 'opacity: 0']]);
    }
    function t(x, y, str, o) {
      o = o || {};
      return s('text', { x: x, y: y, 'font-size': o.fs || 18, 'font-weight': o.bold ? 700 : null, fill: o.fill || null,
        'text-anchor': o.anchor || 'middle', class: o.mono ? 'mono' : null }, str);
    }
    var STYLE = { data: ['var(--blue-bg)', 'var(--blue)'], ack: ['var(--amber-bg)', 'var(--amber)'], ctl: ['var(--grey-bg)', 'var(--ink)'] };
    function token(e, y) {
      var w = e.type === 'ctl' ? 128 : e.type === 'ack' ? (e.label.length > 3 ? 86 : 64) : (e.label.length > 1 ? 74 : 44);
      var ab = e.dir === 'AB', x0 = ab ? XA + BOX / 2 + 8 : XB - BOX / 2 - 8 - w, x1 = ab ? XB - BOX / 2 - 8 - w : XA + BOX / 2 + 8;
      var g = s('g', { class: 'svc-tok' });
      g.appendChild(s('rect', { x: x0, y: y - 17, width: w, height: 34, rx: 4, fill: STYLE[e.type][0], stroke: STYLE[e.type][1], 'stroke-width': 2.5 }));
      g.appendChild(t(x0 + w / 2, y + 7, e.label, { fs: e.type === 'ctl' ? 17 : 20, bold: true, mono: true, fill: STYLE[e.type][1] }));
      var end = e.lost ? e.tLost : e.t1, dx = (x1 - x0) * (end - e.t0) / (e.t1 - e.t0);
      var at = function (d) { return 'opacity: 1; transform: translateX(' + d.toFixed(1) + 'px)'; };
      anim(g, [['0%, ' + pc(e.t0 - 0.01), 'opacity: 0; transform: translateX(0px)'], [pc(e.t0), at(0)], [pc(end), at(dx)],
        [pc(end + 0.15) + ', 100%', 'opacity: 0; transform: translateX(' + dx.toFixed(1) + 'px)']]);
      svg.appendChild(g);
      if (e.lost) {
        var cx = x0 + dx + w / 2, m = s('g', { class: 'svc-lost' });
        m.appendChild(t(cx, y + 10, '✕', { fs: 34, bold: true, fill: 'var(--red)' }));
        m.appendChild(t(cx, ab ? y - 24 : y + 38, (e.type === 'ack' ? 'ACK' : 'frame') + ' lost', { fs: 16, bold: true, fill: 'var(--red)' }));
        svg.appendChild(from(m, e.tLost));
      }
    }

    svg = s('svg', { viewBox: '0 0 ' + W + ' ' + (LH * 3), width: W, height: LH * 3, class: 'svc-fig' });
    css = []; kf = 0;
    run.lanes.forEach(function (lane, i) {
      var y0 = i * LH, mid = y0 + LH / 2 + 6, txt = SVC_TEXT[i];
      if (i) svg.appendChild(s('line', { x1: 0, y1: y0, x2: W, y2: y0, stroke: 'var(--line)', 'stroke-width': 2 }));
      svg.appendChild(t(0, y0 + 44, 'Service ' + (i + 1), { fs: 16, fill: 'var(--muted)', anchor: 'start' }));
      svg.appendChild(t(0, y0 + 76, txt[0], { fs: 27, bold: true, anchor: 'start' }));
      svg.appendChild(t(0, y0 + 108, txt[1], { fs: 27, bold: true, anchor: 'start' }));
      svg.appendChild(t(0, y0 + 138, txt[2], { fs: 18, fill: 'var(--blue)', anchor: 'start' }));
      svg.appendChild(t(0, y0 + 166, txt[3], { fs: 17, fill: 'var(--muted)', anchor: 'start' }));
      // the link: A and B with the wire between; frames ride above it, ACKs below
      svg.appendChild(s('line', { x1: XA, y1: mid, x2: XB, y2: mid, stroke: 'var(--line)', 'stroke-width': 4 }));
      [[XA, 'A'], [XB, 'B']].forEach(function (n) {
        svg.appendChild(s('rect', { x: n[0] - BOX / 2, y: mid - BOX / 2, width: BOX, height: BOX, rx: 6, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
        svg.appendChild(t(n[0], mid + 9, n[1], { fs: 26, bold: true }));
      });
      // what B passes up to its network layer, in arrival order
      svg.appendChild(t(SLOT, y0 + 48, 'B passes up', { fs: 17, fill: 'var(--muted)', anchor: 'start' }));
      for (var k = 0; k < 3; k++) {
        svg.appendChild(s('rect', { x: SLOT + k * 78, y: mid - 26, width: 64, height: 52, rx: 4, fill: 'none', stroke: 'var(--line)', 'stroke-width': 2, 'stroke-dasharray': '6 5' }));
      }
      lane.delivered.forEach(function (d, k) {
        var g = s('g');
        g.appendChild(s('rect', { x: SLOT + k * 78, y: mid - 26, width: 64, height: 52, rx: 4, fill: 'var(--green-bg)', stroke: 'var(--green)', 'stroke-width': 2.5 }));
        g.appendChild(t(SLOT + k * 78 + 32, mid + 10, d.ch, { fs: 28, bold: true, mono: true, fill: 'var(--green)' }));
        svg.appendChild(from(g, d.t));
      });
      var res = s('g');
      var good = lane.text === 'Hi!', verdict = !good ? '✕ ' + lane.text + ' — i never arrives'
        : lane.kind === 'conn' ? '✓ Hi! — each exactly once, in order' : '✓ Hi! — i arrived on the resend';
      res.appendChild(t(SLOT + 117, y0 + LH - 26, verdict, { fs: 18, bold: true, fill: good ? 'var(--green)' : 'var(--red)' }));
      svg.appendChild(from(res, lane.end + 0.1));
      // the timer under A: fills while A waits; red when it runs out
      lane.events.forEach(function (e) {
        if (e.type !== 'timer') return;
        var tw = 120, frac = (e.t1 - e.t0) / run.timeout, ty = mid + 46, g = s('g');
        g.appendChild(s('rect', { x: XA - tw / 2, y: ty, width: tw, height: 10, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5 }));
        // grey while it counts; a timer that runs out turns red at that moment
        var bar = s('rect', { x: XA - tw / 2, y: ty, width: tw, height: 10, fill: 'var(--muted)', class: 'svc-bar' }), full = 'transform: scaleX(' + frac.toFixed(3) + ')';
        anim(bar, [['0%, ' + pc(e.t0), 'transform: scaleX(0); fill: var(--muted)'], [pc(e.t1 - 0.01), full + '; fill: var(--muted)'],
          [pc(e.t1) + ', 100%', full + '; fill: ' + (e.fired ? 'var(--red)' : 'var(--muted)')]]);
        g.appendChild(bar);
        g.appendChild(t(XA - tw / 2 - 8, ty + 10, 'timer', { fs: 15, fill: 'var(--muted)', anchor: 'end' }));
        anim(g, [['0%, ' + pc(e.t0 - 0.01), 'opacity: 0'], [pc(e.t0) + ', ' + pc(e.t1 + 0.3), 'opacity: 1'], [pc(e.t1 + 0.4) + ', 100%', 'opacity: 0']]);
        g.setAttribute('class', 'svc-timer');
        svg.appendChild(g);
        if (e.fired) svg.appendChild(from(t(XA, ty + 34, 'timeout → resend', { fs: 16, bold: true, fill: 'var(--red)' }), e.t1));
      });
      lane.events.forEach(function (e) {
        if (e.type === 'timer') return;
        token(e, e.dir === 'AB' ? mid - 30 : mid + 30);
        if (e.dup) svg.appendChild(from(t(XB, mid - 54, 'duplicate 1 dropped', { fs: 16, bold: true, fill: 'var(--red)' }), e.t1));
      });
    });

    var fig = h('div', { class: 'svc-wrap' }, h('style', null, css.join('\n')), svg);
    body.appendChild(h('div', { style: { marginTop: '14px' } }, fig));
    var pause = ui.btn('Pause (Space)', function () { toggle(); }, 'ctl-pause');
    function toggle() {
      var on = !fig.classList.contains('paused');
      fig.classList.toggle('paused', on);
      pause.textContent = on ? 'Play (Space)' : 'Pause (Space)';
    }
    body.appendChild(h('div', { class: 'row svc-foot' }, h('div', { class: 'say' }, 'Before any service, the layer must cut the bit stream into frames.'), pause));
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
    // learnStep: 0 as sent, 1 the count hit (the pane's table follows the E stream)
    return { step: step, reset: reset, learnStep: function () { return hit >= 0 ? 1 : 0; },
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
    // learnStep: 0 sent, 1 received (the pane's table follows the handle through input.value())
    return { step: step, reset: reset, learnStep: function () { return rx ? 1 : 0; },
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
    // learnStep: 0 sent, 1 received (the pane's table follows the handle through input.value())
    return { step: step, reset: reset, learnStep: function () { return rx ? 1 : 0; },
      input: ui.numbers({ label: 'Data bits: 1–' + BIT_MAX + ' bits of 0/1', example: BIT_DATA, parse: parseBits,
        read: function () { return hData.value(); }, write: function (v) { hData.set(v, true); } }) };
  }

  var PARTS = { services: services, count: byteCount, bytes: byteStuffing, bits: bitStuffing };

  CN.screens.t1 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
