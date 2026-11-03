(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // Handshake, Tanenbaum's delayed-duplicate cases and release on the shared time-space diagram.
  // Client = left line, server = right line. The lib (CN.tcp) builds each scenario; this screen plays it tick by tick.
  var TABS = ['Normal', 'Old dup SYN', 'Old SYN + ACK', 'Release'];
  var COLORS = { syn: 'var(--blue)', synack: 'var(--blue)', ack: 'var(--green)', rst: 'var(--red)', fin: 'var(--amber)', old: 'var(--amber)' };

  CN.screens.t17 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title, hero: true });
    var T = CN.tcp;
    var st = { tab: 0, x: 1000, y: 5000, xOld: 700, z: 4000, lose: null, tick: 0, sc: null };
    var W = 820, H = 610, VIS = 22;
    var ts = CN.ui.timeSpace({ width: W, height: H, visible: VIS, rightPad: 130, names: ['Client', 'Server'],
      label: function (m) { return m.text; },
      style: function (m) { return { color: COLORS[m.k], dash: m.k === 'old' ? '9 6' : null }; },
      onKill: function (id) {
        if (st.tab !== 0 || st.lose != null) return;
        var m = st.sc.msgs[id];
        st.lose = { syn: 0, synack: 1, ack: 2 }[m.kind];
        build();
        draw();
      } });
    var left = h('div', { class: 'panel', style: { padding: '4px' } }, ts.el);
    var right = h('div', { class: 'col grow', style: { gap: '10px' } });
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '18px' } }, left, right));

    var tabs = ui.tabs(TABS, 0, function (i) { st.tab = i; st.lose = null; reset(); });
    function numField(key, w) {
      var f = ui.field(String(st[key]), { width: w || 150, onInput: function (v) {
        var ok = /^\d+$/.test(v.trim()) && +v < 4294967296;
        f.classList.toggle('invalid', !ok);
        if (ok) { st[key] = +v; build(); draw(); }
      } });
      return f;
    }
    var fx = numField('x'), fy = numField('y'), fxo = numField('xOld', 110), fz = numField('z', 110);
    var zLabel = h('span', { class: 'label' }, 'old ACK z');
    var oldRow = h('div', { class: 'row nowrap', style: { gap: '8px' } }, h('span', { class: 'label' }, 'old x\''), fxo, zLabel, fz);
    var runBtn = ui.btn('Run', function () { runner.toggle(); }, 'primary');
    var runner = ui.runner(function () { if (st.tick >= st.sc.end) return false; st.tick++; draw(); return st.tick < st.sc.end; }, 420,
      function (on) { runBtn.textContent = on ? 'Pause' : 'Run'; });
    var loseRow = h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'label' }, 'Lose'),
      ['SYN', 'SYN+ACK', 'ACK'].map(function (n, i) { return ui.btn(n, function () { st.lose = i; st.tick = 0; build(); draw(); }, 'danger'); }),
      h('span', { class: 'small muted' }, 'or click an arrow in flight'));
    var log = h('div', { class: 'working', style: { height: '200px', fontSize: '20px' } });
    var side = h('div', { class: 'panel small col', style: { gap: '4px' } });

    right.appendChild(tabs);
    right.appendChild(h('div', { class: 'row nowrap', style: { gap: '8px' } }, h('span', { class: 'label' }, 'client ISN x'), fx, h('span', { class: 'label' }, 'server ISN y'), fy));
    right.appendChild(oldRow);
    right.appendChild(h('div', { class: 'row', style: { gap: '8px' } }, ui.btn('Step (S)', step), runBtn, ui.btn('Show all', function () { runner.stop(); st.tick = st.sc.end; draw(); }), ui.btn('Reset (R)', reset)));
    right.appendChild(loseRow);
    right.appendChild(log);
    right.appendChild(side);
    right.appendChild(ui.cards([
      ['SYN flood', function () {
        return h('div', { class: 'col' },
          h('div', null, 'An attacker sends SYNs from forged addresses and never ACKs. Each one leaves a half-open connection in the server\'s table until it fills.'),
          h('div', null, h('b', null, 'SYN cookies: '), 'the server keeps no state; it encodes the connection details in its own ISN y (a keyed hash of addresses, ports and time). A real client\'s ACK (ack = y+1) brings the state back.'));
      }]
    ], body));

    function build() {
      var o = { x: st.x, y: st.y, xOld: st.xOld, z: st.z, lose: st.lose };
      st.sc = [T.handshake, T.oldSyn, T.oldSynAck, T.release][st.tab](o);
      st.sc.msgs.forEach(function (m, i) { m.id = i; });
    }
    function simView() {
      var now = st.tick;
      var msgs = st.sc.msgs.map(function (m) {
        var done = now >= m.arriveAt;
        return { id: m.id, from: m.from === 'C' ? 'S' : 'R', sentAt: m.sentAt, arriveAt: m.arriveAt, k: m.kind, kind: m.kind,
          text: m.label, lost: !!m.lost && now > m.sentAt + 1, lostAt: m.sentAt + T.D / 2, copy: m.copy,
          handled: done && !m.lost, fate: m.fate === 'discard' ? 'ok' : m.fate,
          mark: m.fate === 'discard' ? '✕ reject' : null, markColor: 'var(--red)' };
      });
      return { tick: now, msgs: msgs, timers: {}, timeout: T.T };
    }
    function step() { runner.stop(); if (st.tick < st.sc.end) st.tick++; draw(); }
    function reset() { runner.stop(); st.tick = 0; build(); draw(); }

    function draw() {
      var dup = st.tab === 1 || st.tab === 2;
      fx.disabled = dup;
      oldRow.style.display = dup ? '' : 'none';
      fz.style.display = zLabel.style.display = st.tab === 2 ? '' : 'none';
      loseRow.style.display = st.tab === 0 ? '' : 'none';
      ts.draw(simView());
      // timer events, drawn on the side of whoever's timer fired
      var off = Math.max(0, st.tick - VIS + 2), th = (H - 46 - 12) / VIS;
      st.sc.events.forEach(function (e) {
        if (e.t > st.tick || !/timer/.test(e.text)) return;
        var server = /Server's/.test(e.text), y = 46 + (e.t - off) * th;
        ts.el.appendChild(s('text', { x: server ? W - 125 : 6, y: y - 4, 'font-size': 18, 'font-weight': 800, fill: 'var(--red)' }, '⏱ timeout'));
      });
      if (st.tab === 3) {
        var tw = st.sc.timeWait, y1 = 46 + (Math.max(tw[0], off) - off) * th, y2 = 46 + (Math.min(st.tick, tw[1]) - off) * th;
        if (st.tick > tw[0]) {
          ts.el.appendChild(s('rect', { x: 82, y: y1, width: 16, height: Math.max(2, y2 - y1), rx: 4, fill: 'var(--amber)', opacity: 0.55 }));
          ts.el.appendChild(s('text', { x: 104, y: (y1 + y2) / 2 + 6, 'font-size': 18, 'font-weight': 800, fill: 'var(--amber)' }, 'TIME_WAIT = 2 × MSL'));
        }
      }
      // log: arrivals and timer events so far
      CN.clear(log);
      var lines = [];
      st.sc.msgs.forEach(function (m) {
        if (m.lost && st.tick > m.sentAt + 1) lines.push({ t: m.sentAt + 1, text: m.label + ' lost ✕', cls: 'bad' });
        else if (!m.lost && st.tick >= m.arriveAt) lines.push({ t: m.arriveAt, text: (m.from === 'C' ? '→ ' : '← ') + m.label + ': ' + m.note, cls: m.fate === 'discard' ? 'bad' : '' });
      });
      st.sc.events.forEach(function (e) { if (st.tick >= e.t) lines.push({ t: e.t, text: e.text, cls: 'warnc' }); });
      lines.sort(function (a, b) { return a.t - b.t; });
      lines.forEach(function (l) { log.appendChild(h('div', { class: l.cls }, 't=' + l.t + '  ' + l.text)); });
      if (st.tick >= st.sc.end) {
        var res = st.tab === 0 ? '✓ ESTABLISHED on both sides' : st.tab === 1 ? '✓ RST: no connection from the old SYN' :
          st.tab === 2 ? (st.sc.rejected ? '✓ old ACK rejected (z ≠ y+1), RST: no connection' : '✕ z = y+1: the old ACK opened a connection!') : '✓ both directions closed';
        log.appendChild(h('div', { class: /✕/.test(res) ? 'bad' : 'ok' }, res));
      }
      log.scrollTop = log.scrollHeight;
      // side panel
      CN.clear(side);
      if (st.tab === 3) {
        var c = T.stateAt(st.sc.states.client, st.tick), sv = T.stateAt(st.sc.states.server, st.tick);
        side.appendChild(h('div', null, h('b', null, 'Client: '), h('span', { class: 'mono' }, st.tick ? c : 'ESTABLISHED'), '   ', h('b', null, 'Server: '), h('span', { class: 'mono' }, sv)));
        side.appendChild(h('div', null, h('b', null, 'Two-army problem: '), 'the last message of any finite exchange may be lost, so neither side can be sure. TCP doesn\'t try: each side closes its own direction (FIN → ACK), and a timer (TIME_WAIT, 2 × MSL) ends it.'));
      } else if (st.tab === 0) {
        side.appendChild(h('div', null, 'Each side picks its own ISN; the other echoes it + 1. SYN and the final ACK use x and x+1: a SYN uses up one sequence number.'));
      } else {
        side.appendChild(h('div', null, h('b', { class: 'amber' }, 'Dashed amber'), ' = a delayed duplicate from an old connection. The server can\'t tell it\'s old, so it answers with its own fresh y; only a reply that echoes y+1 proves a live client.'));
      }
    }
    reset();
    return { step: step, reset: reset, destroy: function () { runner.stop(); } };
  };
})();
