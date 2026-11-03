(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, A = CN.arq;

  CN.screens.t5 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: 'Go-Back-N vs Selective Repeat', hero: true, sub: 'same losses, two strategies' });
    var st = { n: 3, W: 4, ackStyle: 'tanenbaum', script: 'default', blackout: 0 };
    var sims = {};
    // Every step and kill since Reset, so Back can rebuild both runs up to the step before the last.
    var acts = [];
    var backBtn = ui.backBtn(back);

    var nSeg = ui.seg([[2, 'n = 2'], [3, 'n = 3'], [4, 'n = 4']], st.n, function (v) { st.n = +v; st.W = Math.min(st.W, Math.pow(2, st.n)); st.W = A.safeMax('sr', st.n); st.mode = null; reset(); });
    var wLabel = h('b', { class: 'mono', style: { fontSize: '26px', minWidth: '34px', textAlign: 'center' } });
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { step(); return !finished(); }, 420, function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } },
      h('span', { class: 'label' }, 'Seq bits'), nSeg,
      h('span', { class: 'label' }, 'Window W'), ui.btn('−', function () { if (st.W > 1) { st.W--; st.mode = null; reset(); } }), wLabel,
      ui.btn('+', function () { if (st.W < Math.pow(2, st.n)) { st.W++; st.mode = null; reset(); } }),
      h('span', { class: 'label' }, 'ACK no.'),
      ui.seg([['tanenbaum', 'last received'], ['forouzan', 'next expected']], st.ackStyle, function (v) { st.ackStyle = v; draw(); }),
      backBtn, ui.btn('Step (S)', step), runBtn, ui.btn('Reset', reset)));
    body.appendChild(h('div', { class: 'row', style: { gap: '10px' } },
      h('span', { class: 'label' }, 'Loss script'),
      ui.btn('Default: 1st copy of frame 1 lost', function () { st.script = 'default'; st.blackout = 0; st.mode = null; reset(); }),
      ui.btn('No losses', function () { st.script = 'none'; st.blackout = 0; st.mode = null; reset(); }),
      ui.btn('Trap: SR W = 7, all ACKs lost', function () { st.n = 3; nSeg.set(3); st.W = 7; st.script = 'none'; st.blackout = 11; st.mode = 'trap'; reset(); runner.start(); }, 'danger'),
      ui.btn('Replay with W = 4', function () { st.n = 3; nSeg.set(3); st.W = 4; st.script = 'none'; st.blackout = 11; st.mode = 'trap'; reset(); runner.start(); }),
      h('span', { class: 'small muted' }, 'click a frame or ACK in flight to destroy it')));
    var cols = {};
    ['gbn', 'sr'].forEach(function (p) {
      var c = cols[p] = {};
      c.head = h('div', { class: 'col', style: { gap: '0' } });
      c.sStrip = CN.ui.windowStrip({ total: 8, title: 'Sender', box: 34 });
      c.rStrip = CN.ui.windowStrip({ total: 8, title: 'Receiver', box: 34 });
      c.ts = CN.ui.timeLine({ width: 1110, height: 214, visible: 25, label: function (m) { return label(p, m); },
        onKill: function (id) { if (sims[p].kill(id)) acts.push(['kill', p, id]); draw(); } });
      c.stats = h('div', { class: 'mono', style: { fontSize: '19px' } });
      body.appendChild(h('div', { class: 'panel row nowrap', style: { gap: '10px', padding: '6px 10px', alignItems: 'flex-start' } },
        h('div', { class: 'col', style: { width: '350px', gap: '0' } }, c.head, c.sStrip, c.rStrip, c.stats), c.ts.el));
    });
    var banner = h('div', { class: 'row nowrap', style: { minHeight: '46px' } });
    body.appendChild(banner);

    function label(p, m) {
      var M = Math.pow(2, st.n);
      if (m.kind === 'data') return String(m.seq);
      if (m.kind === 'nak') return String(m.seq);
      if (p === 'sr') return String(m.seq);
      return String(st.ackStyle === 'forouzan' ? (m.seq + 1) % M : m.seq);
    }

    function reset() {
      runner.stop();
      acts = [];
      fresh();
      draw();
    }
    function fresh() {
      wLabel.textContent = st.W;
      var script = st.script === 'default' ? [{ kind: 'data', abs: 1, copy: 1 }] : [];
      ['gbn', 'sr'].forEach(function (p) {
        sims[p] = A.create({ proto: p, n: st.n, W: st.W, total: 8, delay: 3, timeout: 8, drop: A.scriptedDrop(script, st.blackout) });
      });
    }
    function finished() {
      if (st.mode === 'trap') return sims.gbn.tick >= 16;
      return sims.gbn.done && sims.sr.done;
    }
    function tick() {
      if (sims.gbn.done && sims.sr.done) return;
      ['gbn', 'sr'].forEach(function (p) { if (!sims[p].done) sims[p].step(); });
      acts.push(['step']);
    }
    function step() { tick(); draw(); }
    // Rewind one tick: replay everything before the last step (kills after it are dropped too).
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
        else if (sims[a[1]].kill(a[2])) acts.push(a);
      });
      draw();
    }

    function draw() {
      var M = Math.pow(2, st.n);
      backBtn.disabled = !acts.some(function (a) { return a[0] === 'step'; });
      ['gbn', 'sr'].forEach(function (p) {
        var sim = sims[p], c = cols[p], max = A.safeMax(p, st.n);
        CN.clear(c.head);
        c.head.appendChild(h('b', { style: { fontSize: '27px' } }, p === 'gbn' ? 'Go-Back-N (P5)' : 'Selective Repeat (P6)'));
        c.head.appendChild(st.W > max
          ? h('span', { class: 'small', style: { color: 'var(--amber)', fontWeight: 700 } }, '⚠ W exceeds safe maximum ' + max + ' (' + (p === 'gbn' ? '2ⁿ−1' : '2ⁿ⁻¹') + ')')
          : h('span', { class: 'muted', style: { fontSize: '18px' } }, (p === 'gbn' ? 'rcv window 1 · cumulative ACK' : 'rcv window W · ACK each + NAK') + ' · max ' + max));
        c.sStrip.draw({ M: M, winStart: sim.base, winSize: st.W, cell: function (i) {
          if (i < sim.base || sim.acked[i]) return 'acked';
          if (i < sim.next) return 'sent';
          return 'none';
        } });
        var buffered = {};
        Object.keys(sim.buffer).forEach(function (k) { buffered[sim.buffer[k].guess] = true; });
        c.rStrip.draw({ M: M, winStart: sim.expected, winSize: p === 'gbn' ? 1 : st.W, cell: function (i) {
          if (i < sim.expected) return 'delivered';
          if (buffered[i]) return 'buffered';
          return 'none';
        } });
        c.ts.draw(sim);
        c.stats.textContent = 'sent ' + sim.stats.tx + ' · resent ' + sim.stats.retx + ' · ticks ' + sim.tick + (sim.done ? ' ✓' : '');
      });
      CN.clear(banner);
      var srF = sims.sr.failure;
      if (srF) {
        banner.appendChild(h('div', { class: 'banner err' }, 'Old frame ' + srF.seq + ' accepted as new — protocol failure (SR, W = ' + st.W + ' > ' + M / 2 + ')'));
      } else if (st.mode === 'trap' && sims.sr.msgs.some(function (m) { return m.kind === 'data' && m.handled && m.fate === 'discard' && m.abs === 0; })) {
        banner.appendChild(h('div', { class: 'banner ok' }, 'W = ' + st.W + ': old frame 0 falls outside the receiver window → rejected. Old and new windows don\'t overlap.'));
      } else if (st.mode === 'trap') {
        banner.appendChild(h('div', { class: 'banner info' }, 'All ACKs lost: frames 0–' + (st.W - 1) + ' arrive, the receiver slides its window, the sender times out and resends 0…'));
      } else if (sims.gbn.done && sims.sr.done) {
        banner.appendChild(h('div', { class: 'banner ok' }, 'Both delivered all 8 frames in order. Retransmissions: GBN ' + sims.gbn.stats.retx + ', SR ' + sims.sr.stats.retx + '.'));
      }
      banner.appendChild(h('span', { class: 'small muted', style: { marginLeft: 'auto', whiteSpace: 'nowrap' } }, '✓ accepted · B buffered · ✕ discarded/lost · !! old frame accepted'));
    }
    reset();
    return { step: step, reset: reset, destroy: function () { runner.stop(); } };
  };
})();
