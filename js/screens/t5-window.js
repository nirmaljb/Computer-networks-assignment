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

  function arqSlide(body, run) {
    var sim, M = Math.pow(2, N);
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
      sim = A.create({ proto: run.proto, n: N, W: run.W, total: TOTAL, delay: 3, timeout: 8, drop: A.scriptedDrop(run.script, run.blackout) });
      draw();
    }
    function step() {
      if (sim.done || (run.stopAt && sim.tick >= run.stopAt)) return false;
      CN.arq.stepToEvent(sim);
      draw(); return true;
    }
    body.appendChild(ui.controls(step, reset));
    reset();
    return { step: step, reset: reset };
  }

  CN.screens.t5 = function (root, sc) {
    return arqSlide(ui.screen(root, { num: sc.stop, title: sc.title }), RUNS[sc.part]);
  };
})();
