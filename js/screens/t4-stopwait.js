(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  var PROTOS = {
    1: { name: 'Protocol 1: utopian simplex', desc: 'One-way, error-free channel, infinite buffers. No ACKs, no flow or error control: the sender just pumps frames.' },
    2: { name: 'Protocol 2: simplex stop-and-wait', desc: 'Error-free channel, flow control only: send one frame, wait for a dummy ACK. The channel must be at least half-duplex.' },
    3: { name: 'Protocol 3: stop-and-wait, noisy channel (PAR / ARQ)', desc: 'Timer + retransmission. A 1-bit sequence number lets the receiver discard the duplicate a lost ACK causes. Timeout > round trip.' }
  };

  CN.screens.t4 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var st = { proto: 3, sim: null, armed: { data: false, ack: false } };
    // Every action since Reset, so Back can rebuild the run up to the step before the last.
    var acts = [];
    var ts = CN.ui.timeSpace({ width: 780, height: 620, visible: 30, rightPad: 250, timers: function () { return st.proto === 3; },
      label: function (m) { return m.kind === 'data' ? (st.proto === 1 ? 'frame' : 'frame ' + m.seq) : 'ACK ' + m.seq; },
      onKill: function (id) { if (st.sim.kill(id)) acts.push(['kill', id]); draw(); } });
    var right = h('div', { class: 'col grow', style: { gap: '12px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '22px' } }, h('div', { class: 'panel', style: { padding: '6px' } }, ts.el), right));

    var protoSeg = ui.seg([[1, 'P1 Utopian'], [2, 'P2 Stop-and-wait'], [3, 'P3 PAR/ARQ']], st.proto, function (v) { st.proto = +v; reset(); });
    var desc = h('div', { class: 'panel' });
    var loseF = ui.btn('Lose next frame', function () { arm('data'); draw(); }, 'danger');
    var loseA = ui.btn('Lose next ACK', function () { arm('ack'); draw(); }, 'danger');
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { step(); return !st.sim.done; }, 450, function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    var backBtn = ui.backBtn(back);
    var log = h('div', { class: 'working', style: { height: '190px', fontSize: '21px' } });
    var armedNote = h('div', { class: 'small warnc', style: { minHeight: '28px', fontWeight: 700 } });
    right.appendChild(protoSeg);
    right.appendChild(desc);
    right.appendChild(h('div', { class: 'row' }, ui.btn('Send next', sendNext), backBtn, ui.btn('Step (S)', step), loseF, loseA, runBtn, ui.btn('Reset (R)', reset)));
    right.appendChild(armedNote);
    right.appendChild(log);
    right.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'label' }, 'Why stop-and-wait is not enough'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, 'Utilisation = frame time / (frame time + RTT)'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, '50 kbps satellite, 500 ms RTT, 1000-bit frames'),
      h('div', { class: 'mono', style: { fontSize: '23px' } }, '→ 20 ms / (20 + 500) ms ≈ ', h('b', { class: 'bad' }, '4%'), ' busy, 96% idle')));

    function drop(m) {
      if (st.armed[m.kind]) { st.armed[m.kind] = false; return true; }
      return false;
    }
    function fresh() {
      st.armed = { data: false, ack: false };
      var p = st.proto;
      st.sim = CN.arq.create({ proto: 'gbn', n: 1, W: 1, total: 6, delay: 3, timeout: p === 3 ? 8 : 1e6, noAck: p === 1, drop: drop });
    }
    function reset() {
      runner.stop();
      acts = [];
      fresh();
      draw();
    }
    function arm(kind) { st.armed[kind] = true; acts.push(['arm', kind]); }
    function tick() { st.sim.step(); acts.push(['step']); }
    function step() { if (!st.sim.done) tick(); draw(); }
    // Rewind one tick: replay everything before the last step (arms and kills after it are dropped too).
    function back() {
      runner.stop();
      var i = acts.length;
      while (i-- > 0 && acts[i][0] !== 'step');
      if (i < 0) return;
      var keep = acts.slice(0, i);
      fresh();
      acts = [];
      keep.forEach(function (a) {
        if (a[0] === 'step') tick();
        else if (a[0] === 'arm') arm(a[1]);
        else if (st.sim.kill(a[1])) acts.push(a);
      });
      draw();
    }
    function sendNext() {
      var before = st.sim.msgs.filter(function (m) { return m.kind === 'data'; }).length, guard = 0;
      while (!st.sim.done && guard++ < 40) {
        tick();
        if (st.sim.msgs.filter(function (m) { return m.kind === 'data'; }).length > before) break;
      }
      draw();
    }
    function draw() {
      var p = st.proto, sim = st.sim;
      CN.clear(desc).appendChild(h('div', null, h('b', null, PROTOS[p].name)));
      desc.appendChild(h('div', { class: 'small' }, PROTOS[p].desc));
      loseF.disabled = loseA.disabled = p !== 3;
      loseA.disabled = loseA.disabled || p === 1;
      armedNote.textContent = p !== 3 ? 'Error-free channel: nothing can be lost here.' :
        (st.armed.data ? 'Next frame will be lost. ' : '') + (st.armed.ack ? 'Next ACK will be lost.' : '');
      backBtn.disabled = !acts.some(function (a) { return a[0] === 'step'; });
      ts.draw(sim);
      CN.clear(log);
      var lines = [];
      sim.msgs.forEach(function (m) {
        if (m.lost && m.sentAt < sim.tick) lines.push({ t: m.sentAt, text: (m.kind === 'data' ? 'frame ' + m.seq : 'ACK ' + m.seq) + ' lost ✕', cls: 'bad' });
        else if (m.handled) lines.push({ t: m.arriveAt, text: (m.kind === 'data' ? 'R gets frame ' + m.seq + ': ' : 'S gets ACK ' + m.seq + ': ') + m.note, cls: /Duplicate/.test(m.note) ? 'bad' : '' });
      });
      sim.log.forEach(function (l) { lines.push({ t: l.t, text: l.text, cls: 'warnc' }); });
      lines.sort(function (a, b) { return a.t - b.t; });
      lines.slice(-8).forEach(function (l) { log.appendChild(h('div', { class: l.cls }, 't=' + l.t + '  ' + l.text)); });
      if (sim.done) log.appendChild(h('div', { class: 'ok' }, '✓ all ' + sim.total + ' frames delivered in ' + sim.tick + ' ticks (' + sim.stats.retx + ' retransmission' + (sim.stats.retx === 1 ? '' : 's') + ')'));
    }
    reset();
    return { step: step, reset: reset, destroy: function () { runner.stop(); } };
  };
})();
