(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // SPEC-v5: RFC 6298 order only (RTTVAR first), samples 100, 120, 80, 200 ms.
  // 19a the formulas (static), 19b the worked table, 19c the same samples with Karn's rule on sample 3.
  // Step reveals one row; the newest row's working is the caption.
  var SAMPLES = [100, 120, 80, 200];

  function fmt(v) { return v == null ? '—' : String(Math.round(v * 1e9) / 1e9); }

  function formulas(body) {
    body.appendChild(h('div', { class: 'panel col', style: { gap: '22px', fontSize: '34px', padding: '36px', marginTop: '30px' } },
      h('div', null, 'First sample R: ', h('b', { class: 'mono' }, 'SRTT = R,  RTTVAR = R/2')),
      h('div', null, 'Then ① ', h('b', { class: 'mono' }, 'RTTVAR = ¾·RTTVAR + ¼·|SRTT − R|')),
      h('div', null, '     ② ', h('b', { class: 'mono' }, 'SRTT = ⅞·SRTT + ⅛·R')),
      h('div', null, h('b', { class: 'mono' }, 'RTO = SRTT + 4·RTTVAR'))));
    body.appendChild(h('div', { class: 'say' }, 'RFC 6298 order: RTTVAR is updated first, using the old SRTT.'));
    return {};
  }

  function table(body, retx) {
    var rows = CN.tcp.rtoTable(SAMPLES.map(function (r, i) { return { r: r, retx: !!retx[i] }; }), 'rfc'), shown = 1;
    var host = h('div', { style: { marginTop: '20px' } }), work = h('div', { class: 'working', style: { fontSize: '26px', minHeight: '130px' } });
    body.appendChild(host);
    body.appendChild(work);
    function working(i) {
      var r = rows[i], prev = rows.slice(0, i).filter(function (x) { return !x.ignored; }).pop();
      if (r.ignored) return 'Karn: R = ' + fmt(r.r) + ' came from a retransmission → ignored\nRTO = 2 × ' + fmt(r.rto / 2) + ' = ' + fmt(r.rto);
      if (!prev) return 'SRTT   = R = ' + fmt(r.r) + '\nRTTVAR = R/2 = ' + fmt(r.rttvar) + '\nRTO    = ' + fmt(r.srtt) + ' + 4·' + fmt(r.rttvar) + ' = ' + fmt(r.rto);
      return ['RTTVAR = ¾·' + fmt(prev.rttvar) + ' + ¼·|' + fmt(prev.srtt) + ' − ' + fmt(r.r) + '| = ' + fmt(r.rttvar),
        'SRTT   = ⅞·' + fmt(prev.srtt) + ' + ⅛·' + fmt(r.r) + ' = ' + fmt(r.srtt),
        'RTO    = ' + fmt(r.srtt) + ' + 4·' + fmt(r.rttvar) + ' = ' + fmt(r.rto)].join('\n');
    }
    function draw() {
      var t = h('table', { class: 't num', style: { fontSize: '28px' } },
        h('tr', null, ['#', 'R (ms)', 'retx', '① RTTVAR', '② SRTT', 'RTO'].map(function (c) { return h('th', { class: 'c' }, c); })));
      rows.slice(0, shown).forEach(function (r, i) {
        t.appendChild(h('tr', { class: (r.ignored ? 'ign ' : '') + (i === shown - 1 ? 'win' : '') },
          h('td', { class: 'keep' }, String(i + 1)), h('td', { class: 'keep' }, fmt(r.r)), h('td', { class: 'c keep' }, retx[i] ? '✓' : ''),
          h('td', null, fmt(r.rttvar)), h('td', null, fmt(r.srtt)),
          h('td', { class: 'keep', style: { fontWeight: 800 } }, fmt(r.rto) + (r.ignored ? ' ×2' : ''))));
      });
      CN.clear(host).appendChild(t);
      CN.clear(work).appendChild(document.createTextNode(working(shown - 1)));
    }
    draw();
    function step() { if (shown >= rows.length) return false; shown++; draw(); return true; }
    function reset() { shown = 1; draw(); }
    body.appendChild(ui.controls(step, reset));
    return { step: step, reset: reset, prev: function () { if (shown > 1) { shown--; draw(); return true; } return false; } };
  }

  var PARTS = {
    formulas: formulas,
    table: function (body) { return table(body, {}); },
    karn: function (body) {
      body.appendChild(h('div', { class: 'say' }, 'Karn: a sample from a retransmitted segment is ignored (the ACK can\'t say which copy it answers), and the RTO doubles.'));
      return table(body, { 2: true });
    }
  };

  CN.screens.t19 = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
