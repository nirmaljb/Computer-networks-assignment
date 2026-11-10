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
  // SPEC-v8: 5a/5b handles: W (1 … the safe maximum, plus one notch past it: the taught break, which runs the break
  // script, every ACK sent before tick 11 lost) and the losses themselves (tap a frame or ACK in flight to lose it,
  // tap a lost one to bring it back). E is a text view of the losses. 5c keeps its fixed run and click-to-lose.
  function fails(proto, W) {
    var x = A.create({ proto: proto, n: N, W: W, total: TOTAL, delay: 3, timeout: 8, drop: A.scriptedDrop([], 11) }), g = 0;
    while (!x.done && g++ < 400) A.stepToEvent(x);
    return !!x.failure;
  }
  function arqSlide(body, run) {
    var sim, M = Math.pow(2, N), steps = 0, killed = false, played = !run.blackout, max = A.safeMax(run.proto, N), hW = null, hLoss = null;
    body.appendChild(h('div', { class: 'say' }, run.say));
    if (played) {
      var ws = []; for (var w = 1; w <= max + 1; w++) ws.push(w);
      var brk = {}; brk[max + 1] = 'every ACK before t = 11 lost: an old frame is accepted as new';
      hW = ui.handle({ key: 'W', label: 'W', kind: 'slider', value: run.W, values: ws, breaks: brk, width: 320,
        limit: { at: max, text: run.proto === 'sr' ? '2ⁿ⁻¹ = ' + max : '2ⁿ − 1 = ' + max } });
      hLoss = ui.handle({ key: 'loss', kind: 'tap', value: [{ kind: 'data', abs: 1 }] });
    }
    function first(m) { return sim.msgs.filter(function (x) { return x.kind === m.kind && x.abs === m.abs; })[0] === m; }
    function listed(m) { return hLoss.value().some(function (r) { return r.kind === m.kind && r.abs === m.abs; }); }
    var sStrip = CN.ui.windowStrip({ total: TOTAL, title: 'Sender', box: 46 });
    var rStrip = CN.ui.windowStrip({ total: TOTAL, title: 'Receiver', box: 46 });
    // ACK numbers name the next frame expected; SR's selective ACKs name the frame received (SACK).
    var tl = CN.ui.timeLine({ width: 1470, height: 260, visible: 25, ackLegend: run.proto === 'sr' ? 'SACK' : 'ACK',
      label: function (m) { return A.ackName(m, sim).replace(/^\D+/, ''); },
      onKill: function (id) { if (sim.kill(id)) killed = true; draw(); },
      tap: played ? function (m, inFlight) { return !hW.isBreak() && m.kind !== 'nak' && first(m) && (inFlight || (m.lost && listed(m))); } : null,
      onTap: played ? function (m) {
        var list = hLoss.value().filter(function (r) { return !(r.kind === m.kind && r.abs === m.abs); });
        if (list.length === hLoss.value().length) list.push({ kind: m.kind, abs: m.abs });
        hLoss.set(list);
      } : null });
    var banner = h('div', { style: { minHeight: '50px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '40px' } }, sStrip, rStrip));
    body.appendChild(h('div', { class: 'panel', style: { padding: '6px' } }, tl.el));
    body.appendChild(banner);
    if (played) body.appendChild(ui.handleRow(hW));

    function draw() {
      sStrip.draw({ M: M, winStart: sim.base, winSize: sim.W, cell: function (i) {
        if (i < sim.base || sim.acked[i]) return 'acked';
        return i < sim.next ? 'sent' : 'none';
      } });
      var buffered = {};
      Object.keys(sim.buffer).forEach(function (k) { buffered[sim.buffer[k].guess] = true; });
      rStrip.draw({ M: M, winStart: sim.expected, winSize: run.proto === 'gbn' ? 1 : sim.W, cell: function (i) {
        if (i < sim.expected) return 'delivered';
        return buffered[i] ? 'buffered' : 'none';
      } });
      tl.draw(sim);
      CN.clear(banner);
      if (sim.failure) banner.appendChild(h('div', { class: 'banner err' }, 'Old frame ' + sim.failure.seq + ' accepted as new: protocol failure (W = ' + sim.W + ' > ' + max + ').'));
      else if (sim.done) banner.appendChild(h('div', { class: 'banner ok' }, 'All ' + TOTAL + ' frames delivered in order with ' + sim.stats.retx + ' retransmission' + (sim.stats.retx === 1 ? '' : 's') + '.'));
      else if (hW && hW.isBreak()) banner.appendChild(h('div', { class: 'brk-note' }, 'W = ' + sim.W + ' > ' + max + ': the break script runs, every ACK sent before t = 11 lost (your losses set aside).'));
    }
    function reset() {
      var drop, W = run.W;
      if (!played) drop = A.scriptedDrop(run.script, run.blackout);
      else if (hW.isBreak()) { W = hW.value(); drop = A.scriptedDrop([], 11); }
      else { W = hW.value(); drop = A.firstCopyDrop(hLoss.value()); }
      sim = A.create({ proto: run.proto, n: N, W: W, total: TOTAL, delay: 3, timeout: 8, drop: drop });
      steps = 0; killed = false;
      draw();
    }
    function step() {
      if (sim.done || (run.stopAt && sim.tick >= run.stopAt)) return false;
      CN.arq.stepToEvent(sim); steps++;
      draw(); return true;
    }
    body.appendChild(ui.controls());
    reset();
    // learnStep: Steps since Reset (one learn row each); a message killed by hand leaves the script (null)
    var ctl = { step: step, reset: reset, runMs: 600, reached: function () { return sim.done; }, learnStep: function () { return killed ? null : steps; } };
    if (!played) return ctl;
    ctl.input = ui.numbers({ label: 'What to lose, e.g. frame 1, ack 3 (ack k = the ACK for frame k; n = 3; W is the slider)', example: 'frame 1',
      parse: function (t) { return A.parseLoss(t, TOTAL); }, read: function () { return A.lossText(hLoss.value()); },
      write: function (v) { hLoss.set(v.list, true); } });
    ctl.genText = function () { return A.lossText(hLoss.value()) + ' | W ' + hW.value(); };
    // C (5a): the largest Go-Back-N window that survives the break script, one below the window that fails
    if (run.proto === 'gbn') ctl.challenge = { goal: 'Find the largest Go-Back-N window that works with 3-bit sequence numbers',
      why: 'W = 7 = 2ⁿ − 1 works; at W = 8, with the ACKs lost, an old frame 0 is taken for a new one.',
      holds: function () { var W = hW.value(); return W < max + 1 && !fails('gbn', W) && fails('gbn', W + 1); },
      answer: function () { return { W: max }; } };
    return ctl;
  }

  CN.screens.t5 = function (root, sc) {
    return arqSlide(ui.screen(root, { num: sc.stop, title: sc.title }), RUNS[sc.part]);
  };
})();
