/* IPv4 subnetting, longest prefix match, IPv6 compression. Addresses are
   handled as unsigned 32-bit integers (>>> 0 everywhere). */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function toInt(o) { return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0; }
  function octets(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function str(n) { return octets(n).join('.'); }
  function bin8(x) { return ('0000000' + x.toString(2)).slice(-8); }
  function bin32(n) { return octets(n).map(bin8).join(''); }

  function parseIPv4(s) {
    var t = String(s == null ? '' : s).trim();
    var parts = t.split('.');
    if (parts.length !== 4) return { error: '"' + t + '" is not a dotted-decimal address (need 4 octets)' };
    var o = [];
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return { error: 'Octet "' + parts[i] + '" is not a number' };
      var v = +parts[i];
      if (v > 255) return { error: 'Octet ' + v + ' is out of range (0–255)' };
      o.push(v);
    }
    return { value: toInt(o), octets: o };
  }

  function maskFromLen(n) { return n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0; }

  function lenFromMask(m) {
    var b = bin32(m);
    if (!/^1*0*$/.test(b)) return -1;
    return b.indexOf('0') < 0 ? 32 : b.indexOf('0');
  }

  // "a.b.c.d/n", "a.b.c.d n", "a.b.c.d 255.255.255.0" or "a.b.c.d/255.255.255.0"
  function parseCIDR(s) {
    var t = String(s == null ? '' : s).trim().replace(/\s*\/\s*/, '/');
    var m = /^([\d.]+)(?:[\/\s]+(.+))?$/.exec(t);
    if (!m) return { error: 'Enter an address like 192.168.10.77/26' };
    var ip = parseIPv4(m[1]);
    if (ip.error) return ip;
    if (m[2] == null) return { error: 'Add a prefix length (/26) or a mask (255.255.255.192)' };
    var p = m[2].trim(), len;
    if (/^\d+$/.test(p)) {
      len = +p;
      if (len > 32) return { error: 'Prefix /' + len + ' is out of range (0–32)' };
    } else {
      var mk = parseIPv4(p);
      if (mk.error) return { error: 'Mask: ' + mk.error };
      len = lenFromMask(mk.value);
      if (len < 0) return { error: p + ' is not a valid mask (the 1s must be contiguous)' };
    }
    return { ip: ip.value, len: len };
  }

  function addrClass(ip) {
    var b = bin8(ip >>> 24);
    if (b[0] === '0') return { cls: 'A', bits: '0', def: 8 };
    if (b.slice(0, 2) === '10') return { cls: 'B', bits: '10', def: 16 };
    if (b.slice(0, 3) === '110') return { cls: 'C', bits: '110', def: 24 };
    if (b.slice(0, 4) === '1110') return { cls: 'D', bits: '1110', def: null, note: 'multicast' };
    return { cls: 'E', bits: '1111', def: null, note: 'reserved' };
  }

  function inBlock(ip, net, len) { return ((ip & maskFromLen(len)) >>> 0) === net; }

  function scope(ip) {
    if (inBlock(ip, 0x0A000000, 8)) return { kind: 'private', block: '10.0.0.0/8' };
    if (inBlock(ip, 0xAC100000, 12)) return { kind: 'private', block: '172.16.0.0/12' };
    if (inBlock(ip, 0xC0A80000, 16)) return { kind: 'private', block: '192.168.0.0/16' };
    if (inBlock(ip, 0x7F000000, 8)) return { kind: 'loopback', block: '127.0.0.0/8' };
    if (ip === 0) return { kind: 'special', block: '0.0.0.0 = this host' };
    if (ip === 0xFFFFFFFF) return { kind: 'special', block: '255.255.255.255 = local broadcast' };
    return { kind: 'public', block: '' };
  }

  function subnet(ipOrStr, lenArg) {
    var ip = ipOrStr, len = lenArg;
    if (typeof ipOrStr === 'string') {
      var p = parseCIDR(ipOrStr);
      if (p.error) return p;
      ip = p.ip; len = p.len;
    }
    var mask = maskFromLen(len), net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
    var hostBits = 32 - len, usable, first, last, notes = [];
    if (len <= 30) { usable = Math.pow(2, hostBits) - 2; first = net + 1; last = bc - 1; }
    else if (len === 31) { usable = 2; first = net; last = bc; notes.push('/31: point-to-point link, both addresses usable (RFC 3021)'); }
    else { usable = 1; first = net; last = net; notes.push('/32: a single host route'); }
    var io = octets(ip), mo = octets(mask), no = octets(net);
    var working = io.map(function (x, i) {
      return { ip: x, mask: mo[i], net: no[i], ipBin: bin8(x), maskBin: bin8(mo[i]), netBin: bin8(no[i]) };
    });
    var sc = scope(ip);
    if (sc.kind === 'private') notes.push('Private (' + sc.block + '): not routed on the Internet; needs NAT');
    if (sc.kind === 'loopback') notes.push('Loopback (127.x.x.x)');
    if (sc.kind === 'special') notes.push(sc.block);
    if (ip === net && len < 31) notes.push('This is the network address itself (host bits all 0)');
    if (ip === bc && len < 31) notes.push('This is the broadcast address (host bits all 1)');
    return {
      ip: ip, len: len, mask: mask, network: net, broadcast: bc, first: first, last: last,
      usable: usable, hostBits: hostBits, total: Math.pow(2, hostBits), cls: addrClass(ip), scope: sc,
      notes: notes, working: working,
      ipStr: str(ip), maskStr: str(mask), networkStr: str(net), broadcastStr: str(bc),
      firstStr: str(first), lastStr: str(last), bits: bin32(ip)
    };
  }

  // Split a block into 2^k equal subnets.
  function split(cidr, k) {
    var p = typeof cidr === 'string' ? parseCIDR(cidr) : cidr;
    if (p.error) return p;
    var nl = p.len + k;
    if (nl > 32) return { error: 'Cannot split a /' + p.len + ' into ' + Math.pow(2, k) + ' (would need /' + nl + ')' };
    var base = (p.ip & maskFromLen(p.len)) >>> 0, size = Math.pow(2, 32 - nl), out = [];
    for (var i = 0; i < Math.pow(2, k); i++) {
      var n = (base + i * size) >>> 0;
      out.push({ network: n, len: nl, str: str(n) + '/' + nl, broadcast: str((n + size - 1) >>> 0) });
    }
    return { subnets: out, len: nl };
  }

  // routes: [{prefix:'194.24.0.0', len:21, name:'Cambridge'}]
  function lpm(dest, routes) {
    var d = typeof dest === 'string' ? parseIPv4(dest) : { value: dest };
    if (d.error) return d;
    var best = -1, rows = routes.map(function (r, i) {
      var pr = parseIPv4(r.prefix);
      if (pr.error) return { route: r, error: pr.error };
      var mask = maskFromLen(r.len), anded = (d.value & mask) >>> 0, net = (pr.value & mask) >>> 0;
      var match = anded === net;
      if (match && (best < 0 || r.len > routes[best].len)) best = i;
      return { route: r, mask: str(mask), anded: str(anded), net: str(net), match: match };
    });
    return { dest: str(d.value), rows: rows, best: best };
  }

  /* ---------- Fragmentation (IPv4, non-transparent) ---------- */
  // Split a datagram of totalLength bytes (header included) for a link with this MTU.
  // Each fragment copies the header and carries a multiple of 8 data bytes (except the
  // last); the offset is counted in 8-byte units; MF = 1 on all but the last.
  function fragment(totalLength, mtu, opts) {
    opts = opts || {};
    var hl = opts.headerLen == null ? 20 : opts.headerLen;
    function whole(x) { return typeof x === 'number' && isFinite(x) && Math.floor(x) === x; }
    if (!whole(hl) || hl < 20 || hl > 60 || hl % 4) return { error: 'Header length must be 20–60 bytes, a multiple of 4' };
    if (!whole(totalLength) || totalLength < hl || totalLength > 65535) return { error: 'Total length must be a whole number from ' + hl + ' to 65,535 bytes' };
    if (!whole(mtu) || mtu < hl + 8) return { error: 'MTU must be a whole number of at least ' + (hl + 8) + ' bytes (header + 8 data bytes)' };
    var data = totalLength - hl;
    if (totalLength <= mtu) return { fragments: [{ index: 0, start: 0, dataBytes: data, totalLength: totalLength, offset: 0, mf: 0 }], maxData: data, dataBytes: data };
    if (opts.df) return { dropped: true, error: 'DF is set: the router drops it and returns ICMP "fragmentation needed" (too big)' };
    var maxData = Math.floor((mtu - hl) / 8) * 8, out = [];
    for (var start = 0; start < data; start += maxData) {
      var n = Math.min(maxData, data - start);
      out.push({ index: out.length, start: start, dataBytes: n, totalLength: hl + n, offset: start / 8, mf: start + n < data ? 1 : 0 });
    }
    return { fragments: out, maxData: maxData, dataBytes: data };
  }

  /* ---------- IPv6 ---------- */
  function expand6(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return { error: 'Enter an IPv6 address' };
    if (!/^[0-9a-fA-F:]+$/.test(t)) return { error: 'IPv6 uses hex digits (0–9, a–f) and colons only' };
    var dbl = t.split('::');
    if (dbl.length > 2) return { error: 'Only one "::" is allowed' };
    var head = dbl[0] ? dbl[0].split(':') : [], tail = dbl.length === 2 && dbl[1] ? dbl[1].split(':') : [];
    var all = head.concat(tail);
    for (var i = 0; i < all.length; i++) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(all[i])) return { error: 'Group "' + all[i] + '" must be 1–4 hex digits' };
    }
    var groups;
    if (dbl.length === 2) {
      var fill = 8 - all.length;
      if (fill < 1) return { error: '"::" must stand for at least one zero group' };
      groups = head.concat(new Array(fill).fill('0'), tail);
    } else {
      if (all.length !== 8) return { error: 'Need 8 groups (found ' + all.length + ')' };
      groups = all;
    }
    groups = groups.map(function (g) { return ('0000' + g).slice(-4); });
    return { groups: groups, full: groups.join(':') };
  }

  // Drop leading zeros; replace the longest run (>= 2) of zero groups with ::.
  function compress6(s) {
    var e = expand6(s);
    if (e.error) return e;
    var g = e.groups.map(function (x) { return x.replace(/^0+(?=.)/, ''); });
    var bestStart = -1, bestLen = 0;
    for (var i = 0; i < 8;) {
      if (g[i] === '0') {
        var j = i;
        while (j < 8 && g[j] === '0') j++;
        if (j - i > bestLen) { bestLen = j - i; bestStart = i; }
        i = j;
      } else i++;
    }
    var out;
    if (bestLen >= 2) {
      out = g.slice(0, bestStart).join(':') + '::' + g.slice(bestStart + bestLen).join(':');
    } else out = g.join(':');
    return { full: e.full, groups: e.groups, short: out, run: bestLen >= 2 ? [bestStart, bestLen] : null };
  }

  CN.ip = {
    parseIPv4: parseIPv4, parseCIDR: parseCIDR, maskFromLen: maskFromLen, lenFromMask: lenFromMask,
    subnet: subnet, split: split, lpm: lpm, str: str, bin8: bin8, bin32: bin32, octets: octets,
    addrClass: addrClass, expand6: expand6, compress6: compress6, fragment: fragment
  };
})(typeof window !== 'undefined' ? window : globalThis);
