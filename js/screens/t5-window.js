(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, A = CN.arq;

  // SPEC-v5: one protocol per sub-slide, same fixed run (n = 3, W = 4, 1st copy of frame 1 lost).
  // 5c is the SR window trap: W = 7 with every early ACK lost.
  var N = 3, TOTAL = 8;
  var RUNS = {
    gbn: { proto: 'gbn', W: 4, script: [{ kind: 'data', abs: 1, copy: 1 }], blackout: 0,
      say: 'Receiver window 1, cumulative ACK: frames after a loss are discarded and resent.' },
    sr: { proto: 'sr', W: 4, script: [{ kind: 'data', abs: 1, copy: 1 }], blackout: 0,
      say: 'Receiver window W: frames after a loss are buffered (B); only the lost one is resent.' },
    trap: { proto: 'sr', W: 7, script: [], blackout: 11, stopAt: 16,
      say: 'SR with n = 3 and W = 7, every early ACK lost. Safe maximum is 2ⁿ⁻¹ = 4.' }
  };

  // SPEC-v6: E on 5a/5b chooses what to lose ('frame 1, ack 3'); each named message is lost once, its first copy.
  function arqSlide(body, run) {
    var sim, M = Math.pow(2, N), loss = null;
    body.appendChild(h('div', { class: 'say' }, run.say));
    var sStrip = CN.ui.windowStrip({ total: TOTAL, title: 'Sender', box: 46 });
    var rStrip = CN.ui.windowStrip({ total: TOTAL, title: 'Receiver', box: 46 });
    var tl = CN.ui.timeLine({ width: 1470, height: 260, visible: 25, onKill: function (id) { sim.kill(id); draw(); } });
    var banner = h('div', { style: { minHeight: '50px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '40px' } }, sStrip, rStrip));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, tl.el));
    body.appendChild(banner);

    function draw() {
      sStrip.draw({ M: M, winStart: sim.base, winSize: run.W, cell: function (i) {
        if (i < sim.base || sim.acked[i]) return 'acked';
        return i < sim.next ? 'sent' : 'none';
      } });
      var buffered = {};
      Object.keys(sim.buffer).forEach(function (k) { buffered[sim.buffer[k].guess] = true; });
      rStrip.draw({ M: M, winStart: sim.expected, winSize: run.proto === 'gbn' ? 1 : run.W, cell: function (i) {
        if (i < sim.expected) return 'delivered';
        return buffered[i] ? 'buffered' : 'none';
      } });
      tl.draw(sim);
      CN.clear(banner);
      if (sim.failure) banner.appendChild(h('div', { class: 'banner err' }, 'Old frame ' + sim.failure.seq + ' accepted as new: protocol failure (W = ' + run.W + ' > ' + M / 2 + ').'));
      else if (sim.done) banner.appendChild(h('div', { class: 'banner ok' }, 'All ' + TOTAL + ' frames delivered in order with ' + sim.stats.retx + ' retransmission' + (sim.stats.retx === 1 ? '' : 's') + '.'));
    }
    function reset() {
      var drop = loss ? A.firstCopyDrop(loss) : A.scriptedDrop(run.script, run.blackout);
      sim = A.create({ proto: run.proto, n: N, W: run.W, total: TOTAL, delay: 3, timeout: 8, drop: drop });
      draw();
    }
    function step() {
      if (sim.done || (run.stopAt && sim.tick >= run.stopAt)) return false;
      CN.arq.stepToEvent(sim);
      draw(); return true;
    }
    body.appendChild(ui.controls());
    reset();
    var ctl = { step: step, reset: reset, runMs: 600, reached: function () { return sim.done; } };
    if (!run.blackout) ctl.input = ui.numbers({ label: 'What to lose, e.g. frame 1, ack 3 (n = 3 and W = 4 stay fixed)', example: 'frame 1',
      parse: function (t) { return A.parseLoss(t, TOTAL); }, use: function (v) { loss = v ? v.list : null; reset(); } });
    return ctl;
  }

  CN.screens.t5 = function (root, sc) {
    return arqSlide(ui.screen(root, { num: sc.stop, title: sc.title }), RUNS[sc.part]);
  };
})();
