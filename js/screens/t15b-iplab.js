(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui, IP = CN.ip;

  // SPEC-v5: fixed examples, no inputs. 15c address + mask, 15d subnetting, 15e longest prefix match;
  // the IPv6 address and the header comparison are exported for S15f/15g (drawn by t15a).
  var CIDR = '192.168.10.77/26', SPLIT = 2, DEST = '194.24.17.4', V6 = '2001:0db8:0000:0000:0000:ff00:0042:8329';
  var ROUTES = [{ name: 'Cambridge', prefix: '194.24.0.0', len: 21 }, { name: 'Edinburgh', prefix: '194.24.8.0', len: 22 }, { name: 'Oxford', prefix: '194.24.16.0', len: 20 }];

  // SPEC-v6: E on 15c takes any a.b.c.d/p (p 0–32). /31 and /32 have no broadcast and are spelled out.
  // SPEC-v8: the prefix is a slider (0–32) and the address a handle too; E is a text view of both.
  var DESTS = ['194.24.17.4', '194.24.5.8', '194.24.10.1', '194.24.12.9'];
  function address(body) {
    var hIp = ui.handle({ key: 'ip', kind: 'tap', value: CIDR.split('/')[0] }), all = [];
    for (var p = 0; p <= 32; p++) all.push(p);
    var hLen = ui.handle({ key: 'prefix', label: 'Prefix', kind: 'slider', value: +CIDR.split('/')[1], values: all, width: 560, fmt: function (v) { return '/' + v; } });
    var host = h('div', { style: { display: 'contents' } });
    body.appendChild(host);
    body.appendChild(ui.handleRow(hLen));
    function cidr() { return hIp.value() + '/' + hLen.value(); }
    function reset() { CN.clear(host); addressInto(host, cidr()); }
    reset();
    return { reset: reset, input: ui.numbers({ label: 'An IPv4 address with its prefix: a.b.c.d/p', example: CIDR,
      parse: function (t) { var p = IP.parseCIDR(t); return p.error ? p : /\//.test(t) ? { ip: IP.str(p.ip), len: p.len } : { error: 'Write the prefix as /p, e.g. /26' }; },
      read: cidr, write: function (v) { hIp.set(v.ip, true); hLen.set(v.len, true); } }),
      // C: a block whose usable hosts are exactly 30 (the slide's own /26 already gives 62)
      challenge: { goal: 'Make a block of exactly 30 usable hosts',
        why: function () { return '/' + hLen.value() + ' leaves ' + (32 - hLen.value()) + ' host bits: 2⁵ − 2 = 30 (all-0s is the network, all-1s the broadcast).'; },
        holds: function () { return IP.subnet(cidr()).usable === 30; },
        answer: function () { return { prefix: 27 }; } } };
  }
  function addressInto(body, cidr) {
    var r = IP.subnet(cidr);
    // one column per octet: its value above its 8 bits
    body.appendChild(h('div', { class: 'row nowrap', style: { gap: '8px', marginTop: '20px', alignItems: 'flex-start' } }, r.working.map(function (w, o) {
      return h('div', { class: 'col', style: { gap: '6px', alignItems: 'center' } }, h('div', { class: 'label' }, 'octet ' + (o + 1) + ' = ' + w.ip),
        h('div', { class: 'row nowrap', style: { gap: '2px' } }, r.bits.slice(o * 8, o * 8 + 8).split('').map(function (b, j) {
          var net = o * 8 + j < r.len;
          return h('span', { class: 'bit ' + (net ? 'data' : 'check') }, b, net ? null : h('span', { class: 'tag' }, 'H'));
        })));
    })));
    body.appendChild(h('div', { class: 'say' }, cidr + ': ' + r.len + ' network bits (blue), ' + r.hostBits + ' host bits (amber, H).'));
    var kv = h('div', { class: 'kv', style: { fontSize: '28px' } });
    var rows = [['Mask', r.maskStr], ['Network', r.networkStr + '  (address AND mask)']];
    if (r.len <= 30) rows.push(['Broadcast', r.broadcastStr + '  (all host bits 1)'], ['First usable', r.firstStr], ['Last usable', r.lastStr], ['Usable hosts', '2^' + r.hostBits + ' − 2 = ' + r.usable]);
    else if (r.len === 31) rows.push(['Usable', r.firstStr + ' and ' + r.lastStr + '  (/31 point-to-point: no broadcast, RFC 3021)']);
    else rows.push(['Usable', r.firstStr + '  (/32: one host, no broadcast)']);
    rows.forEach(function (x) {
      kv.appendChild(h('span', { class: 'k' }, x[0])); kv.appendChild(h('span', { class: 'v' }, x[1]));
    });
    body.appendChild(h('div', { class: 'panel', style: {} }, kv));
  }

  // SPEC-v8 handle: how many equal subnets, 2, 4 or 8 (1, 2 or 3 borrowed bits)
  function subnetting(body) {
    var r = IP.subnet(CIDR), say = h('div', { class: 'say' }), list = h('div', { class: 'col', style: { gap: '12px', marginTop: '14px' } });
    var hN = ui.handle({ key: 'subnets', label: 'Subnets', kind: 'chips', value: Math.pow(2, SPLIT), values: [2, 4, 8] });
    body.appendChild(say);
    body.appendChild(list);
    body.appendChild(ui.handleRow(hN));
    function reset() {
      var bits = Math.round(Math.log(hN.value()) / Math.LN2), sp = IP.split({ ip: r.ip, len: r.len }, bits);
      say.textContent = 'Borrow ' + bits + ' host bit' + (bits > 1 ? 's' : '') + ' from ' + r.networkStr + '/' + r.len + ' → ' + sp.subnets.length + ' equal subnets of /' + (r.len + bits) + '.';
      CN.clear(list);
      sp.subnets.forEach(function (x) { list.appendChild(h('span', { class: 'chip mono', style: { fontSize: hN.value() > 4 ? '26px' : '34px', padding: hN.value() > 4 ? '4px 20px' : '10px 24px' } }, x.str)); });
    }
    reset();
    return { reset: reset, genText: function () { return 'subnets ' + hN.value(); } };
  }

  // SPEC-v8 handle: tap a destination. 194.24.12.9 sits in the unassigned 194.24.12.0/22: no prefix matches.
  function lpm(body) {
    var hD = ui.handle({ key: 'dest', label: 'Destination', kind: 'chips', value: DEST, values: DESTS, fmt: function () { return ''; }, chip: String });
    var say = h('div', { class: 'say' }), host = h('div', { class: 'col', style: { gap: '14px', alignItems: 'center' } });
    body.appendChild(say);
    body.appendChild(host);
    body.appendChild(ui.handleRow(hD));
    function reset() {
      var dest = hD.value(), res = IP.lpm(dest, ROUTES);
      say.textContent = 'Destination ' + dest + ': AND it with each mask and compare with the prefix.';
      var t = h('table', { class: 't', style: { fontSize: '28px', marginTop: '10px' } },
        h('tr', null, ['Name', 'Prefix', 'Mask', 'Destination AND mask', 'Match?'].map(function (x) { return h('th', null, x); })));
      ROUTES.forEach(function (rt, i) {
        var row = res.rows[i];
        t.appendChild(h('tr', { class: res.best === i ? 'win' : '' },
          h('td', null, rt.name), h('td', { class: 'mono' }, rt.prefix + '/' + rt.len), h('td', { class: 'mono' }, row.mask),
          h('td', { class: 'mono' }, row.anded + (row.match ? ' = ' : ' ≠ ') + row.net),
          h('td', { class: 'c' }, row.match ? h('b', { class: 'ok' }, '✓') : h('b', { class: 'bad' }, '✕'))));
      });
      CN.clear(host).appendChild(t);
      var b = ROUTES[res.best];
      host.appendChild(res.best >= 0
        ? h('div', { class: 'banner ok', style: { fontSize: '26px' } }, dest + ' → ' + b.name + ' (' + b.prefix + '/' + b.len + '): the longest matching prefix wins.')
        : h('div', { class: 'banner warn', style: { fontSize: '26px' } }, dest + ' matches no prefix → the default route (0.0.0.0/0).'));
    }
    reset();
    return { reset: reset, genText: function () { return 'dest ' + hD.value(); } };
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
