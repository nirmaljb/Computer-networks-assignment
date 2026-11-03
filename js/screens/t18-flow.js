(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // Receiver buffer + advertised window (Tanenbaum's window-management sequence), on CN.tcp.flow.
  CN.screens.t18 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { cap: 4096, f: null, loseNext: false, busy: false, script: 0 };
    var timer = null;

    function kb(n) { return n % 1024 === 0 ? (n / 1024) + ' KB' : n + ' B'; }
    var pipe = h('div', { class: 'row nowrap', style: { gap: '14px', alignItems: 'stretch' } });
    var strip = h('div', { class: 'panel col', style: { gap: '6px' } });
    var log = h('div', { class: 'working', style: { height: '150px', fontSize: '19px' } });
    var writeBtn = ui.btn('', function () { write(); }, 'primary');
    var readBtn = ui.btn('', function () { read(); });
    var loseBtn = ui.toggle('Lose window update', false, function (v) { st.loseNext = v; draw(); });
    var probeBtn = ui.btn('Persist timer fires', function () { probe(); });
    var capField = ui.field('4096', { width: 110, onInput: function (v) {
      var n = +v, ok = /^\d+$/.test(v.trim()) && n >= 512 && n <= 65536 && n % 2 === 0;
      capField.classList.toggle('invalid', !ok);
      if (ok) { st.cap = n; reset(); }
    } });
    var next = h('div', { class: 'small muted' });
    var banner = h('div');

    body.appendChild(pipe);
    body.appendChild(strip);
    var leftCol = h('div', { class: 'col', style: { width: '840px', gap: '8px' } },
      h('div', { class: 'row', style: { gap: '8px' } }, writeBtn, readBtn, loseBtn, probeBtn),
      h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label' }, 'Buffer (B)'), capField, ui.btn('Step (S)', step), ui.btn('Reset (R)', reset), next),
      banner, log);
    var rightCol = h('div', { class: 'col grow', style: { gap: '8px' } },
      h('div', { class: 'panel small col', style: { gap: '4px' } },
        h('div', null, h('b', null, 'Window = free buffer space. '), 'Every ACK carries it; the sender may have at most that many unACKed bytes out.'),
        h('div', null, h('b', null, 'WIN = 0: '), 'the sender stops, except urgent data and a 1-byte window probe when the persist timer fires.'),
        h('div', { class: 'muted' }, 'Same sliding window as stop 5, counted in bytes, and the receiver sets its size.')),
      ui.cards([
        ['Nagle\'s algorithm', function () {
          return h('div', { class: 'col' },
            h('div', null, 'Problem: an interactive user types one character at a time → a 41-byte packet per keystroke (20 IP + 20 TCP + 1 data), plus an ACK and an echo.'),
            h('div', null, h('b', null, 'Nagle: '), 'send the first byte, then buffer the rest until the outstanding data is ACKed; then send the buffer in one segment.'),
            h('div', { class: 'muted' }, 'Bad for interactive games and mouse movement: applications can turn it off (TCP_NODELAY).'));
        }],
        ['Clark: silly window', function () {
          return h('div', { class: 'col' },
            h('div', null, 'Problem: the application reads 1 byte at a time; the receiver announces a 1-byte window; the sender sends 1 byte… forever (silly window syndrome).'),
            h('div', null, h('b', null, 'Clark: '), 'the receiver must not announce a tiny window. It waits until it can take a maximum segment, or its buffer is half empty.'),
            h('div', { class: 'muted' }, 'Nagle fixes the sender side, Clark the receiver side; they work together.'));
        }]
      ], body));
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '18px' } }, leftCol, rightCol));

    function box(title, kids, cls) {
      return h('div', { class: 'panel col ' + (cls || ''), style: { gap: '6px', justifyContent: 'center' } }, h('div', { class: 'label' }, title), kids);
    }
    function drawPipe() {
      var f = st.f, buffered = f.rcvd - f.read, cells = h('div', { class: 'cells', style: { width: '420px' } });
      for (var i = 0; i < 16; i++) cells.appendChild(h('span', { class: 'cell ' + ((i + 0.5) * f.cap / 16 < buffered ? 'buf' : '') }));
      var lane;
      if (f.inflight) lane = h('div', { class: 'col', style: { alignItems: 'center', gap: '4px' } },
        h('span', { class: 'chip', style: { background: 'var(--blue-bg)', borderColor: 'var(--blue)' } }, 'SEQ=' + f.inflight.seq + ' · ' + f.inflight.len + ' B →'));
      else {
        var last = null;
        for (var j = f.log.length - 1; j >= 0 && !last; j--) if (/ACK=/.test(f.log[j].text)) last = f.log[j];
        var lost = last && /lost/.test(last.text);
        lane = h('div', { class: 'col', style: { alignItems: 'center', gap: '4px' } },
          h('span', { class: 'chip ' + (lost ? 'bad' : 'ok'), style: { fontSize: '22px' } },
            lost ? '✕ ← WIN=' + (f.cap - (f.rcvd - f.read)) + ' (lost)' : '← ACK=' + f.acked + ' WIN=' + f.win));
      }
      CN.clear(pipe);
      pipe.appendChild(box('Sender', [h('div', { class: 'mono', style: { fontSize: '22px' } }, 'next byte ' + f.sent),
        h('div', { class: 'mono ' + (f.win === 0 ? 'bad' : ''), style: { fontSize: '22px', fontWeight: 700 } }, 'window it knows: ' + f.win)], ''));
      pipe.appendChild(h('div', { class: 'grow', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '3px dashed var(--line)' } }, lane));
      pipe.appendChild(box('Receiver buffer: ' + buffered + ' / ' + f.cap + ' B used', [cells,
        h('div', { class: 'mono', style: { fontSize: '22px' } }, 'free = ' + (f.cap - buffered) + ' · next expected ' + f.rcvd)]));
      pipe.appendChild(box('Receiving app', [h('div', { class: 'mono', style: { fontSize: '22px' } }, 'has read ' + f.read + ' B')]));
    }
    function drawStrip() {
      var f = st.f, unit = f.cap / 8, n = 24;
      var start = Math.max(0, Math.floor((f.acked - 4 * unit) / unit) * unit);
      var cells = h('div', { class: 'cells' }), nums = h('div', { class: 'cells' });
      for (var i = 0; i < n; i++) {
        var b = start + i * unit;
        var cls = b < f.acked ? 'acked' : b < f.sent ? 'sent' : b < f.acked + f.win ? 'can' : 'cant';
        cells.appendChild(h('span', { class: 'cell ' + cls }));
        nums.appendChild(h('span', { style: { flex: 1, minWidth: 0, fontSize: '14px', color: 'var(--muted)', fontFamily: 'var(--mono)' } }, i % 4 === 0 ? String(b) : ''));
      }
      CN.clear(strip);
      strip.appendChild(h('div', { class: 'row nowrap', style: { justifyContent: 'space-between' } },
        h('b', null, 'Sender\'s view of the byte stream'),
        h('span', { class: 'legend' },
          h('span', null, h('i', { style: { background: 'var(--green-bg)', borderColor: 'var(--green)' } }), 'sent, ACKed'),
          h('span', null, h('i', { style: { background: 'var(--blue-bg)', borderColor: 'var(--blue)' } }), 'sent, not ACKed'),
          h('span', null, h('i', { style: { borderColor: 'var(--accent)', borderStyle: 'dashed' } }), 'may send'),
          h('span', null, h('i', { style: { background: 'var(--grey-bg)', borderColor: 'var(--line)' } }), 'may not send yet'),
          h('span', null, 'cell = ' + unit + ' B'))));
      strip.appendChild(cells);
      strip.appendChild(nums);
    }
    function drawLog() {
      CN.clear(log);
      st.f.log.forEach(function (l) { log.appendChild(h('div', { class: l.cls }, l.text)); });
      log.scrollTop = log.scrollHeight;
    }
    var SCRIPT = [
      ['Sender writes', function () { write(); }],
      ['Sender writes (window → 0)', function () { write(); }],
      ['App reads', function () { read(); }],
      ['Sender writes (window → 0 again)', function () { write(); }],
      ['Lose the update, app reads', function () { st.loseNext = true; read(); }],
      ['Sender tries to write: blocked', function () { write(); }],
      ['Persist timer fires: probe', function () { probe(); }]
    ];
    function draw() {
      var half = st.cap / 2;
      writeBtn.textContent = 'Sender writes ' + kb(half);
      readBtn.textContent = 'App reads ' + kb(half);
      writeBtn.disabled = readBtn.disabled = st.busy;
      loseBtn.set(st.loseNext);
      probeBtn.disabled = st.busy || st.f.win !== 0;
      CN.clear(banner);
      if (st.f.deadlock) banner.appendChild(h('div', { class: 'banner err small' }, 'Deadlock: the sender waits for a window, the receiver waits for data. Only the persist timer can break it.'));
      else if (st.f.win === 0 && !st.f.inflight) banner.appendChild(h('div', { class: 'banner warn small' }, 'Window 0: the sender must stop.'));
      next.textContent = st.script < SCRIPT.length ? 'S next: ' + SCRIPT[st.script][0] : 'S: done (R resets)';
      drawPipe(); drawStrip(); drawLog();
    }
    function write() {
      if (st.busy) return;
      var k = st.f.send(st.cap / 2);
      if (k > 0) {
        st.busy = true;
        timer = setTimeout(function () { st.f.deliver(); st.busy = false; draw(); }, 700);
      }
      draw();
    }
    function read() { if (st.busy) return; st.f.readApp(st.cap / 2, st.loseNext); st.loseNext = false; draw(); }
    function probe() { if (st.busy) return; st.f.probe(); draw(); }
    function step() {
      if (st.busy || st.script >= SCRIPT.length) return;
      SCRIPT[st.script++][1]();
    }
    function reset() {
      clearTimeout(timer);
      st.f = CN.tcp.flow(st.cap); st.loseNext = false; st.busy = false; st.script = 0;
      st.f.log.push({ text: 'Buffer ' + st.cap + ' B empty → window ' + st.cap, cls: 'muted' });
      draw();
    }
    reset();
    return { step: step, reset: function () { capField.value = String(st.cap); reset(); }, destroy: function () { clearTimeout(timer); } };
  };
})();
