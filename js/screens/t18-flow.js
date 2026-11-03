(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // SPEC-v5: 18a = Tanenbaum's window-management sequence on a 4096-byte buffer (CN.tcp.flow), one scripted
  // action per Step; 18b Nagle and 18c Clark are static.
  var CAP = 4096;

  function windowSlide(body) {
    var st = { f: null, loseNext: false, busy: false, script: 0, did: '' }, timer = null;
    function kb(n) { return n % 1024 === 0 ? (n / 1024) + ' KB' : n + ' B'; }
    var pipe = h('div', { class: 'row nowrap', style: { gap: '14px', alignItems: 'stretch', marginTop: '20px' } });
    var did = h('div', { style: { fontSize: '28px', fontWeight: 700, minHeight: '40px' } });
    var banner = h('div', { style: { minHeight: '56px' } });
    body.appendChild(h('div', { class: 'say' }, 'Window = free buffer space; every ACK carries it. The sender keeps at most that many unACKed bytes out.'));
    body.appendChild(pipe);
    body.appendChild(did);
    body.appendChild(banner);

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
    var SCRIPT = [
      ['Sender writes ' + kb(CAP / 2), function () { write(); }],
      ['Sender writes ' + kb(CAP / 2) + ': window → 0', function () { write(); }],
      ['App reads ' + kb(CAP / 2), function () { read(); }],
      ['Sender writes ' + kb(CAP / 2) + ': window → 0 again', function () { write(); }],
      ['App reads, but the window update is lost', function () { st.loseNext = true; read(); }],
      ['Sender tries to write: blocked', function () { write(); }],
      ['Persist timer fires: 1-byte window probe', function () { probe(); }]
    ];
    function draw() {
      did.textContent = st.did;
      CN.clear(banner);
      if (st.f.deadlock) banner.appendChild(h('div', { class: 'banner err' }, 'Deadlock: the sender waits for a window, the receiver waits for data. Only the persist timer breaks it.'));
      else if (st.f.win === 0 && !st.f.inflight) banner.appendChild(h('div', { class: 'banner warn' }, 'Window 0: the sender must stop.'));
      drawPipe();
    }
    function write() {
      if (st.f.send(CAP / 2) > 0) {
        st.busy = true;
        timer = setTimeout(function () { st.f.deliver(); st.busy = false; draw(); }, 700);
      }
      draw();
    }
    function read() { st.f.readApp(CAP / 2, st.loseNext); st.loseNext = false; draw(); }
    function probe() { st.f.probe(); draw(); }
    function step() {
      if (st.busy || st.script >= SCRIPT.length) return false;
      var a = SCRIPT[st.script++];
      st.did = st.script + ' · ' + a[0];
      a[1]();
      return true;
    }
    function reset() {
      clearTimeout(timer);
      st.f = CN.tcp.flow(CAP); st.loseNext = false; st.busy = false; st.script = 0; st.did = '';
      draw();
    }
    body.appendChild(ui.controls(step, reset));
    reset();
    return { step: step, reset: reset, destroy: function () { clearTimeout(timer); } };
  }

  function card(body, items) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '30px', padding: '32px', marginTop: '30px' } }, items));
    return {};
  }

  var PARTS = {
    window: windowSlide,
    nagle: function (body) {
      return card(body, [
        h('div', null, h('b', null, 'Problem: '), 'a user types one character at a time → a 41-byte packet per keystroke (20 IP + 20 TCP + 1 data), plus an ACK and an echo.'),
        h('div', null, h('b', null, 'Nagle: '), 'send the first byte, then buffer the rest until the outstanding data is ACKed; then send the buffer in one segment.'),
        h('div', { class: 'muted' }, 'Bad for interactive games and mouse movement: applications can turn it off (TCP_NODELAY).')]);
    },
    clark: function (body) {
      return card(body, [
        h('div', null, h('b', null, 'Problem: '), 'the application reads 1 byte at a time; the receiver announces a 1-byte window; the sender sends 1 byte… (silly window syndrome).'),
        h('div', null, h('b', null, 'Clark: '), 'the receiver must not announce a tiny window. It waits until it can take a maximum segment, or its buffer is half empty.'),
        h('div', { class: 'muted' }, 'Nagle fixes the sender side, Clark the receiver side; they work together.')]);
    }
  };

  CN.screens.t18 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
