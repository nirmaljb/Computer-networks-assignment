(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, IP = CN.ip;

  var TAN_ROUTES = [{ name: 'Cambridge', prefix: '194.24.0.0', len: 21 }, { name: 'Edinburgh', prefix: '194.24.8.0', len: 22 }, { name: 'Oxford', prefix: '194.24.16.0', len: 20 }];
  var V6 = ['2001:0db8:0000:0000:0000:ff00:0042:8329', '8000:0000:0000:0000:0123:4567:89AB:CDEF'];

  // part: 'v4' → S15b (subnet + LPM tabs) · 'v6' → the IPv6 panel alone · none → all three tabs.
  // S15c reuses the IPv6 panel through CN.ui.ipv6Panel(container).
  CN.screens.t15b = function (root, sc) {
    var part = sc.part || 'all';
    var body = ui.screen(root, { num: sc.stop, title: part === 'v4' ? sc.title : 'IP Lab', hero: true, sub: part === 'v4' ? null : 'IPv4 · IP addresses · IPv6' });
    var lab = ipLab(body, part);
    return { reset: lab.reset };
  };
  CN.ui.ipv6Panel = function (container) { return ipLab(container, 'v6'); };

  function ipLab(body, part) {
    var st = { tab: part === 'v6' ? 2 : 0, cidr: '192.168.10.77/26', split: 2, dest: '194.24.17.4', routes: TAN_ROUTES.map(function (r) { return Object.assign({}, r); }), v6: V6[0] };
    var names = part === 'v4' ? ['Subnet calculator', 'Longest prefix match'] : ['Subnet calculator', 'Longest prefix match', 'IPv6 & headers'];
    var tabs = ui.tabs(names, 0, function (i) { st.tab = i; draw(); });
    var pane = h('div', { class: 'col', style: { gap: '12px' } });
    if (part !== 'v6') body.appendChild(tabs);
    body.appendChild(pane);

    /* ---------- subnet ---------- */
    function drawSubnet() {
      var out = h('div', { class: 'col', style: { gap: '12px' } });
      var f = ui.field(st.cidr, { width: 460, placeholder: 'a.b.c.d/n or a.b.c.d mask', onInput: function (v) { st.cidr = v; render(); } });
      pane.appendChild(h('div', { class: 'row' }, h('span', { class: 'label' }, 'Address'), f,
        ui.btn('Default /26', function () { st.cidr = '192.168.10.77/26'; f.value = st.cidr; render(); }),
        ui.btn('172.16.45.200/20', function () { st.cidr = '172.16.45.200/20'; f.value = st.cidr; render(); }),
        h('span', { class: 'label' }, 'Split into'),
        ui.seg([[1, '2'], [2, '4'], [3, '8'], [4, '16']], st.split, function (v) { st.split = +v; render(); })));
      pane.appendChild(out);
      function render() {
        CN.clear(out);
        var r = IP.subnet(st.cidr);
        f.classList.toggle('invalid', !!r.error);
        if (r.error) { out.appendChild(h('div', { class: 'errmsg' }, r.error)); return; }
        // 32-bit row
        var row = h('div', { class: 'row nowrap', style: { gap: '2px' } });
        r.bits.split('').forEach(function (b, i) {
          var net = i < r.len;
          row.appendChild(h('span', { class: 'bit ' + (net ? 'data' : 'check'), style: { minWidth: '44px', width: '44px', marginLeft: i && i % 8 === 0 ? '10px' : '0' } }, b, net ? null : h('span', { class: 'tag' }, 'H')));
        });
        out.appendChild(h('div', { class: 'col', style: { gap: '4px' } },
          h('div', { class: 'row nowrap', style: { gap: '10px' } }, r.working.map(function (w, i) {
            return h('div', { class: 'label', style: { width: (8 * 46 - 2) + 'px', textAlign: 'center' } }, 'octet ' + (i + 1) + ' = ' + w.ip);
          })),
          row,
          h('div', { class: 'small' }, h('b', { class: 'blue' }, r.len + ' network bits (blue)'), ' · ', h('b', { class: 'amber' }, r.hostBits + ' host bits (amber, H)'))));
        var kv = h('div', { class: 'kv' });
        function add(k, v, cls) { kv.appendChild(h('span', { class: 'k' }, k)); kv.appendChild(h('span', { class: 'v ' + (cls || '') }, v)); }
        add('Mask', r.maskStr + '  (/' + r.len + ')');
        add('Network', r.networkStr, 'blue');
        add('Broadcast', r.len >= 31 ? '— (none)' : r.broadcastStr);
        add('First usable', r.firstStr);
        add('Last usable', r.lastStr);
        add('Usable hosts', r.len <= 30 ? '2^' + r.hostBits + ' − 2 = ' + r.usable : String(r.usable), 'ok');
        add('Class (historical)', r.cls.cls + ' (leading ' + r.cls.bits + (r.cls.def ? ', /' + r.cls.def : ', ' + r.cls.note) + ')');
        add('Scope', r.scope.kind + (r.scope.block ? '  ' + r.scope.block : ''));
        var left = h('div', { class: 'panel col', style: { width: '700px', gap: '8px' } }, kv);
        r.notes.forEach(function (n) { left.appendChild(h('div', { class: 'small warnc' }, '• ' + n)); });
        var work = h('table', { class: 't mono', style: { fontSize: '21px' } },
          h('tr', null, h('th', null, ''), h('th', null, 'Address'), h('th', null, 'AND mask'), h('th', null, '= network')),
          r.working.map(function (w, i) {
            return h('tr', null, h('th', null, 'octet ' + (i + 1)),
              h('td', null, w.ipBin + ' (' + w.ip + ')'), h('td', null, w.maskBin + ' (' + w.mask + ')'), h('td', null, h('b', null, w.netBin + ' (' + w.net + ')')));
          }));
        var first = r.working.filter(function (w) { return w.mask !== 255 && w.mask !== 0; })[0] || r.working[3];
        var right = h('div', { class: 'panel col grow', style: { gap: '8px' } }, h('div', { class: 'label' }, 'Working: address AND mask, octet by octet'), work,
          h('div', { style: { fontSize: '24px' } }, h('b', { class: 'mono' }, first.ip + ' AND ' + first.mask + ' = ' + first.net), h('span', { class: 'small muted' }, '   broadcast = network with all host bits set to 1')));
        var sp = IP.split({ ip: r.ip, len: r.len }, st.split);
        right.appendChild(h('div', { class: 'label' }, 'Split /' + r.len + ' into ' + Math.pow(2, st.split) + ' equal subnets (borrow ' + st.split + ' bit' + (st.split > 1 ? 's' : '') + ')'));
        right.appendChild(sp.error ? h('div', { class: 'errmsg' }, sp.error) : h('div', { class: 'row', style: { gap: '6px' } },
          sp.subnets.slice(0, 8).map(function (x) { return h('span', { class: 'chip mono' }, x.str); }), sp.subnets.length > 8 ? h('span', { class: 'chip' }, '… ' + sp.subnets.length + ' in all') : null));
        out.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '16px' } }, left, right));
      }
      render();
    }

    /* ---------- longest prefix match ---------- */
    function drawLPM() {
      var out = h('div');
      var f = ui.field(st.dest, { width: 300, onInput: function (v) { st.dest = v; render(); } });
      pane.appendChild(h('div', { class: 'row' }, h('span', { class: 'label' }, 'Destination'), f,
        ui.btn('Tanenbaum preset', function () { st.routes = TAN_ROUTES.map(function (r) { return Object.assign({}, r); }); st.dest = '194.24.17.4'; f.value = st.dest; render(); }),
        ui.btn('+ route', function () { st.routes.push({ name: 'new', prefix: '194.24.16.0', len: 24 }); render(); }),
        h('span', { class: 'small muted' }, 'edit any cell; each row: destination AND mask, compared with the prefix')));
      pane.appendChild(out);
      function render() {
        CN.clear(out);
        var bad = IP.parseIPv4(st.dest).error;
        f.classList.toggle('invalid', !!bad);
        if (bad) { out.appendChild(h('div', { class: 'errmsg' }, bad)); }
        var res = bad ? null : IP.lpm(st.dest, st.routes.filter(function (r) { return !IP.parseIPv4(r.prefix).error && r.len >= 0 && r.len <= 32; }));
        var valid = st.routes.filter(function (r) { return !IP.parseIPv4(r.prefix).error && r.len >= 0 && r.len <= 32; });
        var t = h('table', { class: 't', style: { fontSize: '23px' } },
          h('tr', null, ['Name', 'Prefix', 'Length', 'Mask', 'Destination AND mask', 'Match?', ''].map(function (x) { return h('th', null, x); })));
        st.routes.forEach(function (r, i) {
          var vi = valid.indexOf(r), row = res && vi >= 0 ? res.rows[vi] : null, win = res && vi >= 0 && res.best === vi;
          function cell(key, w, num) {
            var inp = h('input', { class: 'field', value: r[key], style: { width: w + 'px', fontSize: '21px' } });
            inp.addEventListener('change', function () { r[key] = num ? +inp.value : inp.value; render(); });
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
            return inp;
          }
          var prefBad = IP.parseIPv4(r.prefix).error || !(r.len >= 0 && r.len <= 32);
          t.appendChild(h('tr', { class: win ? 'win' : '' },
            h('td', null, cell('name', 150)), h('td', null, cell('prefix', 200)), h('td', null, cell('len', 70, true)),
            h('td', { class: 'mono' }, row ? row.mask : ''),
            h('td', { class: 'mono' }, row ? row.anded + (row.match ? ' = ' : ' ≠ ') + row.net : (prefBad ? h('span', { class: 'errmsg' }, 'bad prefix') : '')),
            h('td', { class: 'c' }, row ? (row.match ? h('b', { class: 'ok' }, '✓') : h('b', { class: 'bad' }, '✕')) : ''),
            h('td', null, ui.btn('remove', function () { st.routes.splice(i, 1); render(); }))));
        });
        out.appendChild(t);
        if (res) {
          var b = res.best >= 0 ? valid[res.best] : null;
          out.appendChild(h('div', { class: 'banner ' + (b ? 'ok' : 'warn'), style: { marginTop: '12px' } }, b
            ? st.dest + ' → ' + b.name + ' (' + b.prefix + '/' + b.len + '): the longest matching prefix wins'
            : 'No route matches ' + st.dest + ' (a default route 0.0.0.0/0 would catch it)'));
        }
        out.appendChild(h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'CIDR aggregates prefixes to keep tables small; longest match lets a more specific route override the aggregate.'));
      }
      render();
    }

    /* ---------- IPv6 ---------- */
    function hdr(rows, title) {
      var box = h('div', { class: 'col', style: { gap: '0', width: '660px' } }, h('div', { class: 'label', style: { marginBottom: '4px' } }, title));
      rows.forEach(function (r) {
        var line = h('div', { class: 'row nowrap', style: { gap: '0' } });
        r.forEach(function (f) {
          var removed = f[2] === 'x', renamed = f[2] && f[2] !== 'x';
          line.appendChild(h('div', { style: { flex: f[1] + ' 0 0', border: '2px solid ' + (removed ? 'var(--red)' : 'var(--line)'), marginLeft: '-2px', marginTop: '-2px', padding: '4px 6px', fontSize: '19px', textAlign: 'center',
            background: removed ? 'var(--red-bg)' : renamed ? 'var(--accent-bg)' : 'var(--panel)', color: removed ? 'var(--red)' : 'var(--ink)', textDecoration: removed ? 'line-through' : 'none', height: (f[3] || 36) + 'px' } },
            (removed ? '✕ ' : '') + f[0] + (renamed ? ' → ' + f[2] : '')));
        });
        box.appendChild(line);
      });
      return box;
    }
    function drawV6() {
      var out = h('div', { class: 'col', style: { gap: '6px' } });
      var f = ui.field(st.v6, { width: 680, onInput: function (v) { st.v6 = v; render(); } });
      pane.appendChild(h('div', { class: 'row' }, h('span', { class: 'label' }, 'IPv6 address'), f,
        V6.map(function (a) { return ui.btn(IP.compress6(a).short, function () { st.v6 = a; f.value = a; render(); }); })));
      pane.appendChild(out);
      function render() {
        CN.clear(out);
        var r = IP.compress6(st.v6);
        f.classList.toggle('invalid', !!r.error);
        if (r.error) out.appendChild(h('div', { class: 'errmsg' }, r.error));
        else {
          var groups = h('div', { class: 'row', style: { gap: '4px' } });
          r.groups.forEach(function (g, i) {
            var inRun = r.run && i >= r.run[0] && i < r.run[0] + r.run[1];
            groups.appendChild(h('span', { class: 'bit tok ' + (inRun ? 'check' : 'data'), style: { fontSize: '22px' } }, g, inRun ? h('span', { class: 'tag' }, '0') : null));
          });
          out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '130px' } }, 'Expanded'), groups));
          out.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '130px' } }, 'Compressed'), h('b', { class: 'mono', style: { fontSize: '30px' } }, r.short),
            h('span', { class: 'small muted' }, 'drop leading zeros; ONE run of zero groups (amber) → ::')));
        }
        out.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '20px', marginTop: '4px' } },
          hdr([[['Version', 4], ['IHL', 4, 'x'], ['DS (DSCP+ECN)', 8], ['Total length', 16, 'Payload length']],
            [['Identification', 16, 'x'], ['DF MF', 3, 'x'], ['Fragment offset', 13, 'x']],
            [['TTL', 8, 'Hop limit'], ['Protocol', 8, 'Next header'], ['Header checksum', 16, 'x']],
            [['Source address (32)', 32]], [['Destination address (32)', 32]], [['Options', 32, 'x']]], 'IPv4: 20 bytes minimum (struck = removed in IPv6)'),
          hdr([[['Version', 4], ['DS', 8], ['Flow label (20)', 20]],
            [['Payload length', 16], ['Next header', 8], ['Hop limit', 8]],
            [['Source address (128 bits)', 32, null, 60]], [['Destination address (128 bits)', 32, null, 60]]], 'IPv6: fixed 40 bytes')));
        out.appendChild(h('div', { class: 'small' }, 'No checksum (link CRC and transport already check; IPv4 recomputes it every hop as TTL changes). No router fragmentation: only the source fragments, minimum MTU 1280. Extension headers: hop-by-hop, destination options, routing, fragmentation, authentication, ESP.'));
      }
      render();
    }

    function draw() { CN.clear(pane); [drawSubnet, drawLPM, drawV6][st.tab](); }
    draw();
    return { reset: function () { st.cidr = '192.168.10.77/26'; st.routes = TAN_ROUTES.map(function (r) { return Object.assign({}, r); }); st.dest = '194.24.17.4'; st.v6 = V6[0]; draw(); } };
  }
})();
