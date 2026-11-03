(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui, T = CN.tcp;

  // SPEC-v5: one scenario per sub-slide on the shared time-space diagram (client left, server right),
  // fixed ISNs x = 1000, y = 5000 (old x' = 700, old ACK z = 4000). Step = one tick.
  // 17a: click an arrow in flight to lose it. 17e: SYN flood (static).
  var COLORS = { syn: 'var(--blue)', synack: 'var(--blue)', ack: 'var(--green)', rst: 'var(--red)', fin: 'var(--amber)', old: 'var(--amber)' };
  var RUNS = {
    normal: { build: T.handshake, say: 'Each side picks its own ISN; the other echoes it + 1. A SYN uses up one sequence number.' },
    oldsyn: { build: T.oldSyn, say: 'Dashed amber = a delayed duplicate SYN. Only a reply that echoes y + 1 proves a live client.' },
    oldsynack: { build: T.oldSynAck, say: 'An old SYN and an old ACK arrive. The ACK carries z, not y + 1, so the server rejects it.' },
    release: { build: T.release, say: 'Each side closes its own direction (FIN → ACK); TIME_WAIT (2 × MSL) ends it. No finite exchange can be sure: the two-army problem.' }
  };

  function scenario(body, kind) {
    var run = RUNS[kind], st = { lose: null, tick: 0, sc: null };
    var W = 1000, H = 600, VIS = 22;
    var ts = CN.ui.timeSpace({ width: W, height: H, visible: VIS, rightPad: 170, names: ['Client', 'Server'],
      label: function (m) { return m.text; },
      style: function (m) { return { color: COLORS[m.k], dash: m.k === 'old' ? '9 6' : null }; },
      onKill: kind === 'normal' ? function (id) {
        if (st.lose != null) return;
        st.lose = { syn: 0, synack: 1, ack: 2 }[st.sc.msgs[id].kind];
        build(); draw();
      } : null });
    body.appendChild(h('div', { class: 'say' }, run.say));
    body.appendChild(h('div', { class: 'panel', style: { padding: '4px' } }, ts.el));

    function build() {
      st.sc = run.build({ x: 1000, y: 5000, xOld: 700, z: 4000, lose: st.lose });
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
    function step() { if (st.tick >= st.sc.end) return false; st.tick++; draw(); return true; }
    function reset() { st.tick = 0; st.lose = null; build(); draw(); }
    function draw() {
      ts.draw(simView());
      // timer events, drawn on the side of whoever's timer fired
      var off = Math.max(0, st.tick - VIS + 2), th = (H - 46 - 12) / VIS;
      st.sc.events.forEach(function (e) {
        if (e.t > st.tick || !/timer/.test(e.text)) return;
        var server = /Server's/.test(e.text), y = 46 + (e.t - off) * th;
        ts.el.appendChild(s('text', { x: server ? W - 165 : 6, y: y - 4, 'font-size': 18, 'font-weight': 800, fill: 'var(--red)' }, '⏱ timeout'));
      });
      if (kind === 'release') {
        var tw = st.sc.timeWait, y1 = 46 + (Math.max(tw[0], off) - off) * th, y2 = 46 + (Math.min(st.tick, tw[1]) - off) * th;
        if (st.tick > tw[0]) {
          ts.el.appendChild(s('rect', { x: 82, y: y1, width: 16, height: Math.max(2, y2 - y1), rx: 4, fill: 'var(--amber)', opacity: 0.55 }));
          ts.el.appendChild(s('text', { x: 104, y: (y1 + y2) / 2 + 6, 'font-size': 18, 'font-weight': 800, fill: 'var(--amber)' }, 'TIME_WAIT = 2 × MSL'));
        }
      }
    }
    body.appendChild(ui.controls());
    reset();
    return { step: step, reset: reset, prev: function () { if (st.tick > 0) { st.tick--; draw(); return true; } return false; } };
  }

  function synFlood(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '30px', padding: '32px', marginTop: '30px' } },
      h('div', null, 'An attacker sends SYNs from forged addresses and never ACKs. Each one leaves a half-open connection in the server\'s table until it fills.'),
      h('div', null, h('b', null, 'SYN cookies: '), 'the server keeps no state; it encodes the connection details in its own ISN y (a keyed hash of addresses, ports and time). A real client\'s ACK (ack = y + 1) brings the state back.')));
    return {};
  }

  CN.screens.t17 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    return sc.part === 'synflood' ? synFlood(body) : scenario(body, sc.part);
  };
})();
