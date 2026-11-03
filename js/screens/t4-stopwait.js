(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // SPEC-v5: one protocol per sub-slide, then the utilisation arithmetic on its own slide.
  var PROTOS = {
    p1: { p: 1, desc: 'One-way, error-free channel, infinite buffers: no ACKs, the sender just pumps frames.' },
    p2: { p: 2, desc: 'Error-free channel, flow control only: send one frame, wait for a dummy ACK.' },
    p3: { p: 3, desc: 'Noisy channel: timer + retransmission; a 1-bit sequence number spots duplicates.' }
  };

  // P3's scripted run: frame 1 is lost once (timeout, resend), the first ACK 2 is lost (duplicate, re-ACK).
  function p3Drop() {
    var ackLost = false;
    return function (m) {
      if (m.kind === 'data') return m.abs === 1 && m.copy === 1;
      if (m.abs === 2 && !ackLost) { ackLost = true; return true; }
      return false;
    };
  }

  function protocol(body, key) {
    var proto = PROTOS[key].p, sim;
    body.appendChild(h('div', { class: 'say' }, PROTOS[key].desc));
    var ts = CN.ui.timeSpace({ width: 1100, height: 560, visible: 30, rightPad: 260, timers: function () { return proto === 3; },
      label: function (m) { return m.kind === 'data' ? (proto === 1 ? 'frame' : 'frame ' + m.seq) : 'ACK ' + m.seq; },
      onKill: function (id) { sim.kill(id); ts.draw(sim); } });
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, ts.el));
    function reset() {
      sim = CN.arq.create({ proto: 'gbn', n: 1, W: 1, total: 6, delay: 3, timeout: proto === 3 ? 8 : 1e6, noAck: proto === 1,
        drop: proto === 3 ? p3Drop() : null });
      ts.draw(sim);
    }
    function step() {
      if (sim.done) return false;
      CN.arq.stepToEvent(sim);
      ts.draw(sim); return true;
    }
    body.appendChild(ui.controls());
    reset();
    return { step: step, reset: reset, runMs: 600 };
  }

  function utilisation(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '18px', padding: '36px', marginTop: '40px', fontSize: '34px' } },
      h('div', { class: 'mono' }, 'Utilisation = frame time / (frame time + RTT)'),
      h('div', { class: 'mono' }, '50 kbps satellite, 500 ms RTT, 1000-bit frames'),
      h('div', { class: 'mono' }, '→ 20 ms / (20 + 500) ms ≈ ', h('b', { class: 'bad' }, '4%'), ' busy, 96% idle')));
    return {};
  }

  CN.screens.t4 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'util' ? utilisation(body) : protocol(body, sc.part);
  };
})();
