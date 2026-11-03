(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;

  // RTO calculator (RFC 6298 as in Tanenbaum) with an update-order toggle and Karn's rule per sample.
  CN.screens.t19 = function (root, sc) {
    var body = ui.screen(root, { num: sc.stop, title: sc.title });
    var DEF = '100, 120, 80, 200';
    var st = { text: DEF, order: 'rfc', retx: {}, sel: null };

    function fmt(v) { return v == null ? '—' : String(Math.round(v * 1e9) / 1e9); }
    var field = ui.field(DEF, { width: 420, onInput: function (v) { st.text = v; st.retx = {}; st.sel = null; draw(); } });
    var orderSeg = ui.seg([['rfc', 'RFC 6298: RTTVAR first'], ['srttFirst', 'SRTT first']], 'rfc', function (v) { st.order = v; draw(); });
    var err = h('div', { class: 'errmsg' });
    var note = h('div', { class: 'banner info small', style: { fontSize: '21px' } });
    var tableBox = h('div');
    var working = h('div', { class: 'working', style: { fontSize: '21px' } });
    var plot = s('svg', { width: 560, height: 220, viewBox: '0 0 560 250' });

    var left = h('div', { class: 'col', style: { width: '880px', gap: '10px' } },
      h('div', { class: 'row nowrap', style: { gap: '10px' } }, h('span', { class: 'label' }, 'RTT samples (ms)'), field, err),
      h('div', { class: 'row' }, h('span', { class: 'label' }, 'Update order'), orderSeg),
      note, tableBox,
      h('div', { class: 'small muted' }, 'RFC 6298 also sets a 1 s minimum RTO; left out so the arithmetic stays visible.'),
      h('div', { class: 'panel small' }, h('b', null, 'Karn: '), 'tick "retx" for a sample from a retransmitted segment: it is ignored (the ACK can\'t say which copy it answers) and the RTO doubles until a clean sample arrives.'));
    var right = h('div', { class: 'col grow', style: { gap: '10px' } },
      h('div', { class: 'panel col', style: { gap: '4px', fontSize: '22px' } },
        h('div', null, 'First sample R: ', h('b', { class: 'mono' }, 'SRTT = R, RTTVAR = R/2')),
        h('div', null, 'Then ', h('b', null, '①'), ' ', h('b', { class: 'mono' }, 'RTTVAR = ¾·RTTVAR + ¼·|SRTT − R|')),
        h('div', null, '     ', h('b', null, '②'), ' ', h('b', { class: 'mono' }, 'SRTT = ⅞·SRTT + ⅛·R')),
        h('div', null, h('b', { class: 'mono' }, 'RTO = SRTT + 4·RTTVAR'))),
      working,
      h('div', { class: 'panel', style: { padding: '4px 8px' } }, plot));
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '20px' } }, left, right));

    function parse() {
      var parts = st.text.split(/[\s,;]+/).filter(Boolean);
      if (!parts.length) return { error: 'Type at least one RTT sample' };
      if (parts.length > 8) return { error: 'Up to 8 samples' };
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        if (!/^\d+(\.\d+)?$/.test(parts[i]) || +parts[i] <= 0) return { error: '"' + parts[i] + '" is not a positive number' };
        out.push(+parts[i]);
      }
      return { samples: out };
    }
    function draw() {
      var p = parse();
      field.classList.toggle('invalid', !!p.error);
      err.textContent = p.error || '';
      if (p.error) return;
      orderSeg.set(st.order);
      CN.clear(note).appendChild(document.createTextNode(st.order === 'rfc'
        ? 'RTTVAR uses the old SRTT (RFC 6298). Updating SRTT first gives a different RTO: 270, not 272.5.'
        : 'SRTT first (not RFC 6298): RTTVAR then uses the new SRTT. This is the order some textbooks and hand calculations use.'));
      var samples = p.samples.map(function (r, i) { return { r: r, retx: !!st.retx[i] }; });
      var rows = CN.tcp.rtoTable(samples, st.order);
      var t = h('table', { class: 't num', style: { fontSize: '23px' } },
        h('tr', null, ['#', 'R (ms)', 'retx', st.order === 'rfc' ? '① RTTVAR' : '② RTTVAR', st.order === 'rfc' ? '② SRTT' : '① SRTT', 'RTO'].map(function (c) { return h('th', { class: 'c' }, c); })));
      rows.forEach(function (r, i) {
        var cb = h('input', { type: 'checkbox', checked: !!st.retx[i], disabled: i === 0 });
        cb.addEventListener('change', function () { st.retx[i] = cb.checked; cb.blur(); draw(); });
        var tr = h('tr', { class: (r.ignored ? 'ign ' : '') + (st.sel === i ? 'win' : ''), style: { cursor: 'pointer' } },
          h('td', { class: 'keep' }, String(i + 1)), h('td', { class: 'keep' }, fmt(r.r)), h('td', { class: 'c keep' }, cb),
          h('td', null, fmt(r.rttvar)), h('td', null, fmt(r.srtt)),
          h('td', { class: 'keep', style: { fontWeight: 800 } }, fmt(r.rto) + (r.ignored ? ' ×2' : '')));
        tr.addEventListener('click', function (e) { if (e.target.tagName !== 'INPUT') { st.sel = i; draw(); } });
        t.appendChild(tr);
      });
      CN.clear(tableBox).appendChild(t);
      // working for the selected (default: last) row
      var i = st.sel == null ? rows.length - 1 : st.sel, r = rows[i], prev = rows.slice(0, i).filter(function (x) { return !x.ignored; }).pop();
      CN.clear(working);
      working.appendChild(h('div', { class: 'label', style: { fontFamily: 'var(--sans)' } }, 'Working for sample ' + (i + 1) + ' (click a row)'));
      if (r.ignored) working.appendChild(h('div', null, 'Karn: R = ' + fmt(r.r) + ' ignored\nRTO = 2 × ' + fmt(r.rto / 2) + ' = ' + fmt(r.rto)));
      else if (!prev) working.appendChild(h('div', null, 'SRTT   = R = ' + fmt(r.r) + '\nRTTVAR = R/2 = ' + fmt(r.rttvar) + '\nRTO    = ' + fmt(r.srtt) + ' + 4·' + fmt(r.rttvar) + ' = ' + fmt(r.rto)));
      else {
        var lines;
        if (st.order === 'rfc') lines = [
          'RTTVAR = ¾·' + fmt(prev.rttvar) + ' + ¼·|' + fmt(prev.srtt) + ' − ' + fmt(r.r) + '| = ' + fmt(r.rttvar),
          'SRTT   = ⅞·' + fmt(prev.srtt) + ' + ⅛·' + fmt(r.r) + ' = ' + fmt(r.srtt)];
        else lines = [
          'SRTT   = ⅞·' + fmt(prev.srtt) + ' + ⅛·' + fmt(r.r) + ' = ' + fmt(r.srtt),
          'RTTVAR = ¾·' + fmt(prev.rttvar) + ' + ¼·|' + fmt(r.srtt) + ' − ' + fmt(r.r) + '| = ' + fmt(r.rttvar)];
        lines.push('RTO    = ' + fmt(r.srtt) + ' + 4·' + fmt(r.rttvar) + ' = ' + fmt(r.rto));
        working.appendChild(h('div', null, lines.join('\n')));
      }
      drawPlot(rows);
    }
    function drawPlot(rows) {
      CN.clear(plot);
      var max = 0;
      rows.forEach(function (r) { max = Math.max(max, r.r, r.rto || 0); });
      max = Math.ceil(max / 50) * 50 || 100;
      var x0 = 60, x1 = 540, y0 = 220, y1 = 20, n = rows.length;
      function X(i) { return n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1); }
      function Y(v) { return y0 - (y0 - y1) * v / max; }
      plot.appendChild(s('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: 'var(--ink)', 'stroke-width': 2 }));
      plot.appendChild(s('line', { x1: x0, y1: y0, x2: x0, y2: y1, stroke: 'var(--ink)', 'stroke-width': 2 }));
      [0, max / 2, max].forEach(function (v) { plot.appendChild(s('text', { x: x0 - 6, y: Y(v) + 6, 'text-anchor': 'end', 'font-size': 16, fill: 'var(--muted)' }, String(v))); });
      function series(get, color, label, dash) {
        var d = '';
        rows.forEach(function (r, i) { var v = get(r); if (v == null) return; d += (d ? ' L ' : 'M ') + X(i) + ' ' + Y(v); });
        plot.appendChild(s('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-dasharray': dash || null }));
        rows.forEach(function (r, i) { var v = get(r); if (v != null) plot.appendChild(s('circle', { cx: X(i), cy: Y(v), r: 4, fill: color })); });
        return label;
      }
      series(function (r) { return r.r; }, 'var(--muted)', 'R', '5 4');
      series(function (r) { return r.srtt; }, 'var(--blue)', 'SRTT');
      series(function (r) { return r.rto; }, 'var(--red)', 'RTO');
      [['R sample', 'var(--muted)'], ['SRTT', 'var(--blue)'], ['RTO', 'var(--red)']].forEach(function (l, k) {
        plot.appendChild(s('rect', { x: 80 + k * 140, y: 4, width: 14, height: 14, fill: l[1] }));
        plot.appendChild(s('text', { x: 100 + k * 140, y: 17, 'font-size': 17, 'font-weight': 700 }, l[0]));
      });
      plot.appendChild(s('text', { x: x1, y: 245, 'text-anchor': 'end', 'font-size': 16, fill: 'var(--muted)' }, 'sample →  (ms)'));
    }
    draw();
    return {
      reset: function () { st.text = DEF; st.order = 'rfc'; st.retx = {}; st.sel = null; field.value = DEF; draw(); },
      step: function () { st.order = st.order === 'rfc' ? 'srttFirst' : 'rfc'; draw(); }
    };
  };
})();
