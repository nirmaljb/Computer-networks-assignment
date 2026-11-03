(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, IP = CN.ip;

  // SPEC-v5: fixed examples, no inputs. 15c address + mask, 15d subnetting, 15e longest prefix match;
  // the IPv6 address and the header comparison are exported for S15f/15g (drawn by t15a).
  var CIDR = '192.168.10.77/26', SPLIT = 2, DEST = '194.24.17.4', V6 = '2001:0db8:0000:0000:0000:ff00:0042:8329';
  var ROUTES = [{ name: 'Cambridge', prefix: '194.24.0.0', len: 21 }, { name: 'Edinburgh', prefix: '194.24.8.0', len: 22 }, { name: 'Oxford', prefix: '194.24.16.0', len: 20 }];

  function address(body) {
    var r = IP.subnet(CIDR);
    // one column per octet: its value above its 8 bits
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '8px', marginTop: '20px', alignItems: 'flex-start' } }, r.working.map(function (w, o) {
      return h('div', { class: 'col', style: { gap: '6px', alignItems: 'center' } }, h('div', { class: 'label' }, 'octet ' + (o + 1) + ' = ' + w.ip),
        h('div', { class: 'row nowrap', style: { gap: '2px' } }, r.bits.slice(o * 8, o * 8 + 8).split('').map(function (b, j) {
          var net = o * 8 + j < r.len;
          return h('span', { class: 'bit ' + (net ? 'data' : 'check') }, b, net ? null : h('span', { class: 'tag' }, 'H'));
        })));
    })));
    body.appendChild(h('div', { class: 'say' }, CIDR + ': ' + r.len + ' network bits (blue), ' + r.hostBits + ' host bits (amber, H).'));
    var kv = h('div', { class: 'kv', style: { fontSize: '28px' } });
    [['Mask', r.maskStr], ['Network', r.networkStr + '  (address AND mask)'], ['Broadcast', r.broadcastStr + '  (all host bits 1)'],
      ['First usable', r.firstStr], ['Last usable', r.lastStr], ['Usable hosts', '2^' + r.hostBits + ' − 2 = ' + r.usable]].forEach(function (x) {
      kv.appendChild(h('span', { class: 'k' }, x[0])); kv.appendChild(h('span', { class: 'v' }, x[1]));
    });
    body.appendChild(h('div', { class: 'panel', style: {} }, kv));
    return {};
  }

  function subnetting(body) {
    var r = IP.subnet(CIDR), sp = IP.split({ ip: r.ip, len: r.len }, SPLIT);
    body.appendChild(h('div', { class: 'say' }, 'Borrow ' + SPLIT + ' host bits from ' + r.networkStr + '/' + r.len + ' → ' + sp.subnets.length + ' equal subnets of /' + (r.len + SPLIT) + '.'));
    body.appendChild(h('div', { class: 'col', style: { gap: '16px', marginTop: '20px' } }, sp.subnets.map(function (x) {
      return h('span', { class: 'chip mono', style: { fontSize: '34px', padding: '10px 24px' } }, x.str);
    })));
    return {};
  }

  function lpm(body) {
    var res = IP.lpm(DEST, ROUTES);
    var t = h('table', { class: 't', style: { fontSize: '28px', marginTop: '20px' } },
      h('tr', null, ['Name', 'Prefix', 'Mask', 'Destination AND mask', 'Match?'].map(function (x) { return h('th', null, x); })));
    ROUTES.forEach(function (rt, i) {
      var row = res.rows[i];
      t.appendChild(h('tr', { class: res.best === i ? 'win' : '' },
        h('td', null, rt.name), h('td', { class: 'mono' }, rt.prefix + '/' + rt.len), h('td', { class: 'mono' }, row.mask),
        h('td', { class: 'mono' }, row.anded + (row.match ? ' = ' : ' ≠ ') + row.net),
        h('td', { class: 'c' }, row.match ? h('b', { class: 'ok' }, '✓') : h('b', { class: 'bad' }, '✕'))));
    });
    body.appendChild(h('div', { class: 'say' }, 'Destination ' + DEST + ': AND it with each mask and compare with the prefix.'));
    body.appendChild(t);
    var b = ROUTES[res.best];
    body.appendChild(h('div', { class: 'banner ok', style: { fontSize: '26px' } }, DEST + ' → ' + b.name + ' (' + b.prefix + '/' + b.len + '): the longest matching prefix wins.'));
    return {};
  }

  CN.ui.ipv6Address = function (body) {
    var r = IP.compress6(V6), groups = h('div', { class: 'row', style: { gap: '6px' } });
    r.groups.forEach(function (g, i) {
      var inRun = r.run && i >= r.run[0] && i < r.run[0] + r.run[1];
      groups.appendChild(h('span', { class: 'bit tok ' + (inRun ? 'check' : 'data'), style: { fontSize: '28px' } }, g, inRun ? h('span', { class: 'tag' }, '0') : null));
    });
    body.appendChild(h('div', { class: 'say' }, '128 bits as 8 groups of 4 hex digits. Drop leading zeros; replace ONE run of zero groups (amber) with ::'));
    body.appendChild(h('div', { class: 'row nowrap', style: { marginTop: '20px' } }, h('span', { class: 'label', style: { width: '170px' } }, 'Expanded'), groups));
    body.appendChild(h('div', { class: 'row nowrap' }, h('span', { class: 'label', style: { width: '170px' } }, 'Compressed'), h('b', { class: 'mono', style: { fontSize: '44px' } }, r.short)));
    return {};
  };

    function hdr(rows, title) {
    var box = h('div', { class: 'col', style: { gap: '0', width: '720px' } }, h('div', { class: 'label', style: { marginBottom: '4px' } }, title));
    rows.forEach(function (r) {
      var line = h('div', { class: 'row nowrap', style: { gap: '0' } });
      r.forEach(function (f) {
        var removed = f[2] === 'x', renamed = f[2] && f[2] !== 'x';
        line.appendChild(h('div', { style: { flex: f[1] + ' 0 0', border: '2px solid ' + (removed ? 'var(--red)' : 'var(--line)'), marginLeft: '-2px', marginTop: '-2px', padding: '4px 6px', fontSize: '22px', textAlign: 'center',
          background: removed ? 'var(--red-bg)' : renamed ? 'var(--accent-bg)' : 'var(--panel)', color: removed ? 'var(--red)' : 'var(--ink)', textDecoration: removed ? 'line-through' : 'none', height: (f[3] || 44) + 'px' } },
          (removed ? '✕ ' : '') + f[0] + (renamed ? ' → ' + f[2] : '')));
      });
      box.appendChild(line);
    });
    return box;
  }

  CN.ui.ipv6Headers = function (body) {
    body.appendChild(h('div', { class: 'say' }, 'Struck fields are gone in IPv6: no checksum, and routers never fragment.'));
    body.appendChild(h('div', { class: 'row nowrap', style: { alignItems: 'flex-start', gap: '30px', marginTop: '10px' } },
      hdr([[['Version', 4], ['IHL', 4, 'x'], ['DS (DSCP+ECN)', 8], ['Total length', 16, 'Payload length']],
        [['Identification', 16, 'x'], ['DF MF', 3, 'x'], ['Fragment offset', 13, 'x']],
        [['TTL', 8, 'Hop limit'], ['Protocol', 8, 'Next header'], ['Header checksum', 16, 'x']],
        [['Source address (32)', 32]], [['Destination address (32)', 32]], [['Options', 32, 'x']]], 'IPv4: 20 bytes minimum'),
      hdr([[['Version', 4], ['DS', 8], ['Flow label (20)', 20]],
        [['Payload length', 16], ['Next header', 8], ['Hop limit', 8]],
        [['Source address (128 bits)', 32, null, 70]], [['Destination address (128 bits)', 32, null, 70]]], 'IPv6: fixed 40 bytes')));
    return {};
  };

  var PARTS = { addr: address, subnet: subnetting, lpm: lpm };

  CN.screens.t15b = function (root, sc) {
    return PARTS[sc.part](ui.screen(root, { num: sc.stop, title: sc.title }));
  };
})();
