/* Shared time-space diagram for the ARQ screens (T4, T5) and the handshake (T17).
   Sender on the left, receiver on the right, time flowing down.
   Messages still in flight can be clicked to destroy them.
   Optional: names [left, right]; style(m) → { color, dash } overrides the kind colours.
   SPEC-v8: tap(m, inFlight) → may it be tapped, with onTap(m); states() → [left, right] shown under the names. */
(function () {
  'use strict';
  var CN = window.CN, s = CN.s;

  // SPEC-v6 motion: a message in flight leaves a soft trail with a pulsing head; an ACK that arrived during
  // the last Step glows once. Drawing only: the sim is the same with motion on or off.
  function trail(g, x1, y1, x2, y2, color) {
    g.appendChild(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color, 'stroke-width': 12, opacity: 0.14, 'stroke-linecap': 'round' }));
    g.appendChild(s('circle', { cx: x2, cy: y2, r: 6, fill: color, class: 'fx-head' }));
  }
  // One tracker per diagram: an ACK glows the first time it is drawn as received. Going back or resetting
  // (the clock runs backwards) marks everything already there as seen, so nothing glows on a rewind.
  function glower() {
    var seen = {}, last = 0, quiet = false;
    return {
      frame: function (now) { quiet = now < last; if (quiet) seen = {}; last = now; },
      glow: function (m) {
        if (m.kind !== 'ack' || !m.handled || m.fate !== 'ok' || seen[m.id]) return false;
        seen[m.id] = true; return !quiet;
      }
    };
  }
  CN.ui.trail = trail; CN.ui.glower = glower;

  CN.ui.timeSpace = function (opts) {
    var W = opts.width, H = opts.height, visible = opts.visible || 26;
    var xs = 90, xr = W - (opts.rightPad || 90), y0 = opts.states ? 66 : 46;
    var th = (H - y0 - 12) / visible;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }), fx = glower();

    function draw(sim) {
      CN.clear(svg);
      var now = sim.tick, off = Math.max(0, now - visible + 2);
      fx.frame(now);
      function y(t) { return y0 + (t - off) * th; }
      var names = opts.names || ['Sender', 'Receiver'];
      svg.appendChild(s('text', { x: xs, y: 26, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700 }, names[0]));
      svg.appendChild(s('text', { x: xr, y: 26, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700 }, names[1]));
      if (opts.states) opts.states().forEach(function (st, i) {
        svg.appendChild(s('text', { x: i ? xr : xs, y: 48, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: st === 'ESTABLISHED' ? 'var(--green)' : 'var(--accent)', class: 'mono' }, st));
      });
      svg.appendChild(s('line', { x1: xs, y1: y0 - 6, x2: xs, y2: H - 4, stroke: 'var(--ink)', 'stroke-width': 3 }));
      svg.appendChild(s('line', { x1: xr, y1: y0 - 6, x2: xr, y2: H - 4, stroke: 'var(--ink)', 'stroke-width': 3 }));
      // current time
      var yn = y(now);
      svg.appendChild(s('line', { x1: 10, y1: yn, x2: W - 10, y2: yn, stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }));
      svg.appendChild(s('text', { x: 6, y: yn - 5, 'font-size': 20, fill: 'var(--accent)', 'font-weight': 700 }, 't=' + now));

      // sender timers
      if (opts.timers && (typeof opts.timers !== 'function' || opts.timers())) {
        Object.keys(sim.timers).forEach(function (k) {
          var exp = sim.timers[k], start = exp - sim.timeout;
          var y1 = y(Math.max(start, off)), y2 = y(Math.min(exp, now));
          if (y2 <= y1) return;
          var frac = (now - start) / sim.timeout;
          svg.appendChild(s('rect', { x: xs - 30, y: y1, width: 10, height: y2 - y1, rx: 3, fill: frac > 0.75 ? 'var(--red)' : 'var(--accent)', opacity: 0.6 }));
        });
        svg.appendChild(s('text', { x: xs - 25, y: H - 8, 'text-anchor': 'middle', 'font-size': 18, fill: 'var(--accent)' }, 'timer'));
      }

      sim.msgs.forEach(function (m) {
        if (m.sentAt >= now) return;
        if (m.arriveAt < off) return;
        var fromX = m.from === 'S' ? xs : xr, toX = m.from === 'S' ? xr : xs;
        var tShift = m.kind === 'nak' ? 0.35 : 0;
        var t1 = m.sentAt + tShift, t2 = m.arriveAt + tShift;
        var endT = m.lost ? Math.min(m.lostAt != null ? m.lostAt : (t1 + t2) / 2, now) : Math.min(t2, now);
        if (endT <= t1) endT = t1 + 0.05;
        var f = (endT - t1) / (t2 - t1);
        var x2 = fromX + (toX - fromX) * f, y1 = y(t1), y2 = y(endT);
        var color = m.kind === 'data' ? 'var(--blue)' : m.kind === 'ack' ? 'var(--green)' : 'var(--red)';
        var st = opts.style ? opts.style(m) || {} : {};
        if (st.color) color = st.color;
        var inFlight = !m.lost && !m.handled && now < m.arriveAt, tappable = opts.tap ? opts.tap(m, inFlight) : inFlight && opts.onKill;
        var g = s('g', { class: tappable ? 'clickable' : '' });
        if (inFlight) trail(g, fromX, y1, x2, y2, color);
        g.appendChild(s('line', { x1: fromX, y1: y1, x2: x2, y2: y2, stroke: color, 'stroke-width': m.copy > 1 ? 3.5 : 2.5,
          'stroke-dasharray': st.dash || (m.kind === 'nak' ? '8 5' : null) }));
        // label near the start
        var lf = 0.22, lx = fromX + (toX - fromX) * Math.min(f, lf), ly = y1 + (y2 - y1) * Math.min(1, lf / Math.max(f, 0.001));
        var label = opts.label ? opts.label(m) : String(m.seq);
        g.appendChild(s('text', { x: lx + (m.from === 'S' ? 4 : -4), y: ly - 6, 'text-anchor': m.from === 'S' ? 'start' : 'end',
          'font-size': 20, 'font-weight': 800, fill: color }, label));
        if (m.lost) {
          g.appendChild(s('text', { x: x2, y: y2 + 8, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, fill: 'var(--red)' }, '✕'));
        } else if (m.handled) {
          var mark = '', mc = 'var(--muted)';
          if (m.dupAccepted) { mark = '✕ old accepted!'; mc = 'var(--red)'; }
          else if (m.fate === 'ok') { mark = '✓'; mc = 'var(--green)'; }
          else if (m.fate === 'discard') { mark = /^Duplicate/.test(m.note) ? '✕ duplicate, re-ACK' : '✕ discard'; mc = 'var(--red)'; }
          else if (m.fate === 'buffer') { mark = 'buffer'; mc = 'var(--amber)'; }
          else if (m.fate === 'stale') { mark = '·'; }
          if (m.mark) { mark = m.mark; mc = m.markColor || mc; }
          var anchor = m.from === 'S' ? 'start' : 'end';
          g.appendChild(s('text', { x: toX + (m.from === 'S' ? 8 : -8), y: y2 + 7, 'text-anchor': anchor, 'font-size': 19, 'font-weight': 800, fill: mc,
            class: fx.glow(m) ? 'fx-glow' : null }, mark));
        }
        if (tappable) {
          g.appendChild(s('line', { x1: fromX, y1: y1, x2: x2, y2: y2, stroke: 'transparent', 'stroke-width': 22 }));
          g.addEventListener('click', function () { if (opts.onTap) opts.onTap(m); else opts.onKill(m.id); });
        }
        svg.appendChild(g);
      });
    }
    return { el: svg, draw: draw, y0: y0 };
  };

  // Strip of frames 0..total-1 labelled by sequence number with a window bracket.
  CN.ui.windowStrip = function (opts) {
    var n = opts.total, bw = opts.box || 46, gap = 6, W = n * (bw + gap) + 20;
    var svg = s('svg', { width: W, height: 76, viewBox: '0 0 ' + W + ' 76' });
    svg.draw = function (st) {
      CN.clear(svg);
      for (var i = 0; i < n; i++) {
        var x = 10 + i * (bw + gap), c = st.cell(i);
        var fill = { acked: 'var(--green-bg)', sent: 'var(--blue-bg)', buffered: 'var(--amber-bg)', delivered: 'var(--green-bg)', none: 'var(--panel)' }[c] || 'var(--panel)';
        var stroke = { acked: 'var(--green)', sent: 'var(--blue)', buffered: 'var(--amber)', delivered: 'var(--green)', none: 'var(--line)' }[c] || 'var(--line)';
        svg.appendChild(s('rect', { x: x, y: 26, width: bw, height: 40, rx: 6, fill: fill, stroke: stroke, 'stroke-width': 2 }));
        svg.appendChild(s('text', { x: x + bw / 2, y: 55, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800, class: 'mono',
          fill: c === 'none' ? 'var(--muted)' : stroke }, String(i % st.M)));
        if (c === 'acked' || c === 'delivered') svg.appendChild(s('text', { x: x + bw - 4, y: 40, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 900, fill: 'var(--green)' }, '✓'));
        if (c === 'buffered') svg.appendChild(s('text', { x: x + bw - 4, y: 40, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 900, fill: 'var(--amber)' }, 'B'));
      }
      var a = st.winStart, b = Math.min(st.winStart + st.winSize, n);
      if (a < n) {
        // a window running past the last frame is drawn open on the right
        var x1 = 10 + a * (bw + gap) - 4, x2 = 10 + b * (bw + gap) - gap + 4, open = st.winStart + st.winSize > n;
        svg.appendChild(s('path', { d: 'M ' + x1 + ' 21 V 71 M ' + x1 + ' 21 H ' + (x1 + 10) + ' M ' + x1 + ' 71 H ' + (x1 + 10) +
          (open ? ' M ' + x1 + ' 21 H ' + (x2 + 6) + ' M ' + x1 + ' 71 H ' + (x2 + 6)
                : ' M ' + x2 + ' 21 V 71 M ' + x2 + ' 21 H ' + (x2 - 10) + ' M ' + x2 + ' 71 H ' + (x2 - 10)), stroke: 'var(--accent)', 'stroke-width': 3.5, fill: 'none' }));
      }
      svg.appendChild(s('text', { x: 10, y: 16, 'font-size': 19, 'font-weight': 700, fill: 'var(--muted)' }, opts.title + ' (window ' + st.winSize + ')'));
    };
    return svg;
  };
})();

/* Horizontal variant (T5): time runs left → right, sender on top, receiver below.
   SPEC-v8: opts.tap(m) → may this message be tapped (in flight, or lost and tappable back); opts.onTap(m). */
(function () {
  'use strict';
  var CN = window.CN, s = CN.s;

  CN.ui.timeLine = function (opts) {
    var W = opts.width, H = opts.height, visible = opts.visible || 25;
    var x0 = 70, ys = 34, yr = H - 34;
    var tw = (W - x0 - 20) / visible;
    var svg = s('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H }), fx = CN.ui.glower();

    function draw(sim) {
      CN.clear(svg);
      var now = sim.tick, off = Math.max(0, now - visible + 1);
      fx.frame(now);
      function x(t) { return x0 + (t - off) * tw; }
      svg.appendChild(s('text', { x: 8, y: ys + 7, 'font-size': 20, 'font-weight': 700 }, 'S'));
      svg.appendChild(s('text', { x: 8, y: yr + 7, 'font-size': 20, 'font-weight': 700 }, 'R'));
      svg.appendChild(s('text', { x: 4, y: ys - 10, 'font-size': 17, fill: 'var(--blue)', 'font-weight': 700 }, 'frame'));
      svg.appendChild(s('text', { x: 4, y: yr + 26, 'font-size': 17, fill: 'var(--green)', 'font-weight': 700 }, opts.ackLegend || 'ACK'));
      svg.appendChild(s('text', { x: 4, y: yr + 48, 'font-size': 17, fill: 'var(--red)', 'font-weight': 700 }, 'NAK'));
      svg.appendChild(s('line', { x1: x0 - 10, y1: ys, x2: W - 6, y2: ys, stroke: 'var(--ink)', 'stroke-width': 3 }));
      svg.appendChild(s('line', { x1: x0 - 10, y1: yr, x2: W - 6, y2: yr, stroke: 'var(--ink)', 'stroke-width': 3 }));
      var xn = x(now);
      svg.appendChild(s('line', { x1: xn, y1: 4, x2: xn, y2: H - 4, stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }));
      svg.appendChild(s('text', { x: xn + 5, y: H / 2 + 7, 'font-size': 19, fill: 'var(--accent)', 'font-weight': 700 }, 't=' + now));

      sim.msgs.forEach(function (m) {
        if (m.sentAt >= now || m.arriveAt < off - 1) return;
        var fromY = m.from === 'S' ? ys : yr, toY = m.from === 'S' ? yr : ys;
        var shift = m.kind === 'nak' ? 0.3 : 0;
        var t1 = m.sentAt + shift, t2 = m.arriveAt + shift;
        var endT = m.lost ? Math.min(m.lostAt != null ? m.lostAt : (t1 + t2) / 2, now) : Math.min(t2, now);
        if (endT <= t1) endT = t1 + 0.05;
        var f = (endT - t1) / (t2 - t1);
        var x1 = x(t1), x2 = x(endT), y2 = fromY + (toY - fromY) * f;
        var color = m.kind === 'data' ? 'var(--blue)' : m.kind === 'ack' ? 'var(--green)' : 'var(--red)';
        var inFlight = !m.lost && !m.handled && now < m.arriveAt, tappable = opts.tap ? opts.tap(m, inFlight) : inFlight && opts.onKill;
        var g = s('g', { class: tappable ? 'clickable' : '' });
        if (inFlight) CN.ui.trail(g, x1, fromY, x2, y2, color);
        g.appendChild(s('line', { x1: x1, y1: fromY, x2: x2, y2: y2, stroke: color, 'stroke-width': m.copy > 1 ? 3.5 : 2.5, 'stroke-dasharray': m.kind === 'nak' ? '8 5' : null }));
        var lbl = opts.label ? opts.label(m) : String(m.seq);
        var ly = m.from === 'S' ? ys - 10 : (m.kind === 'nak' ? yr + 48 : yr + 26);
        g.appendChild(s('text', { x: x1, y: ly, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, fill: color }, lbl));
        if (m.lost) g.appendChild(s('text', { x: x2, y: y2 + 9, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 900, fill: 'var(--red)' }, '✕'));
        else if (m.handled) {
          var mark = '', mc = 'var(--muted)';
          if (m.dupAccepted) { mark = '!!'; mc = 'var(--red)'; }
          else if (m.fate === 'ok') { mark = '✓'; mc = 'var(--green)'; }
          else if (m.fate === 'discard') { mark = '✕'; mc = 'var(--red)'; }
          else if (m.fate === 'buffer') { mark = 'B'; mc = 'var(--amber)'; }
          if (mark) g.appendChild(s('text', { x: x(t2), y: m.from === 'S' ? yr - 10 : ys + 26, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, fill: mc,
            class: fx.glow(m) ? 'fx-glow' : null }, mark));
        }
        if (tappable) {
          g.appendChild(s('line', { x1: x1, y1: fromY, x2: x2, y2: y2, stroke: 'transparent', 'stroke-width': 22 }));
          g.addEventListener('click', function () { if (opts.onTap) opts.onTap(m); else opts.onKill(m.id); });
        }
        svg.appendChild(g);
      });
    }
    return { el: svg, draw: draw };
  };
})();
