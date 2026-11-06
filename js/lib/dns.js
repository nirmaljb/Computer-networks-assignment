/* DNS resolution model (SPEC-v4 §4.21). No real lookups: the tree assumes a zone cut at
   every label, servers are named generically, and every address comes from the RFC 5737
   documentation ranges. A resolver object keeps a cache with one TTL per answer. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  var DOC = ['192.0.2.', '198.51.100.', '203.0.113.'];
  function hash(s) { var x = 7; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
  // Deterministic documentation address for a name; the default demo name gets 192.0.2.10.
  function addrFor(name) {
    if (name === 'www.example.com') return '192.0.2.10';
    var x = hash(name);
    return DOC[x % 3] + (1 + (x >>> 2) % 254);
  }

  function parse(input) {
    var t = String(input == null ? '' : input).trim().toLowerCase().replace(/\.$/, '');
    if (!t) return { error: 'Type a name like www.example.com' };
    var labels = t.split('.');
    if (labels.length < 2) return { error: 'Need at least 2 labels (e.g. example.com)' };
    if (labels.length > 4) return { error: 'Up to 4 labels (one tree level each)' };
    for (var i = 0; i < labels.length; i++) {
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(labels[i])) return { error: 'Label "' + labels[i] + '" is not a valid hostname label' };
    }
    return { name: t, labels: labels };
  }

  // The servers asked, top-down: root, then one zone per label except the leftmost (a zone cut at every label).
  function zones(labels) {
    var z = [{ zone: '.', server: 'a.root-servers.net', label: 'root' }];
    for (var k = labels.length - 1; k >= 1; k--) {
      var zone = labels.slice(k).join('.');
      var server = (zone === 'com' || zone === 'net') ? 'a.gtld-servers.net' : 'ns1.' + zone;
      z.push({ zone: zone, server: server, label: k === labels.length - 1 ? '.' + zone + ' (TLD)' : zone });
    }
    return z;
  }

  // Message list for one lookup. Each: { from, to, text, kind: query|referral|answer }.
  // SPEC-v8: cached = names the resolver already holds a record for: a zone ('com', 'example.com') means its NS
  // record, so the walk starts at the deepest cached zone instead of the root; the full name means its A record,
  // so the resolver answers at once. (The root's servers are always known: the root hints.)
  function walk(name, mode, cached) {
    var p = parse(name);
    if (p.error) return p;
    var z = zones(p.labels), a = addrFor(p.name), steps = [], q = p.name + ' A?';
    var answer = 'A ' + a, have = {}, top = 0;
    (cached || []).forEach(function (c) { have[String(c).toLowerCase().replace(/\.$/, '')] = true; });
    z.forEach(function (zz, i) { if (i && have[zz.zone]) top = i; });
    steps.push({ from: 'client', to: 'resolver', text: q, kind: 'query' });
    if (have[p.name]) {
      steps.push({ from: 'resolver', to: 'client', text: answer + ' (cached)', kind: 'answer' });
    } else if (mode === 'recursive') {
      // each server asks the next on the client's behalf, then the answer comes back down the chain
      steps.push({ from: 'resolver', to: top, text: q, kind: 'query' });
      for (var i = top + 1; i < z.length; i++) steps.push({ from: i - 1, to: i, text: q, kind: 'query' });
      for (i = z.length - 1; i >= top + 1; i--) steps.push({ from: i, to: i - 1, text: answer, kind: 'answer' });
      steps.push({ from: top, to: 'resolver', text: answer, kind: 'answer' });
    } else {
      for (i = top; i < z.length; i++) {
        steps.push({ from: 'resolver', to: i, text: q, kind: 'query' });
        if (i < z.length - 1) steps.push({ from: i, to: 'resolver', text: 'referral: ' + z[i + 1].zone + ' NS ' + z[i + 1].server, kind: 'referral' });
        else steps.push({ from: i, to: 'resolver', text: answer + ' (authoritative)', kind: 'answer' });
      }
    }
    if (!have[p.name]) steps.push({ from: 'resolver', to: 'client', text: answer, kind: 'answer' });
    var count = function (who) { return steps.filter(function (s) { return s.from === who && s.kind === 'query'; }).length; };
    return { name: p.name, labels: p.labels, zones: z, address: a, steps: steps, mode: mode, top: top, cached: !!have[p.name],
      fromResolver: count('resolver'), fromClient: count('client'), total: steps.filter(function (s) { return s.kind === 'query'; }).length };
  }

  // A resolver with a cache. lookup(name, mode, nowSeconds) → walk result + { cached, ttlLeft }.
  function resolver(ttl) {
    var cache = {};
    return {
      ttl: ttl,
      lookup: function (name, mode, now) {
        var p = parse(name);
        if (p.error) return p;
        var c = cache[p.name];
        if (c && now < c.expires) {
          return { name: p.name, labels: p.labels, zones: zones(p.labels), address: c.address, mode: mode, cached: true, ttlLeft: c.expires - now,
            steps: [{ from: 'client', to: 'resolver', text: p.name + ' A?', kind: 'query' },
              { from: 'resolver', to: 'client', text: 'A ' + c.address + ' (cached, TTL ' + Math.ceil(c.expires - now) + ' s left)', kind: 'answer' }],
            fromResolver: 0, fromClient: 1, total: 1 };
        }
        var w = walk(p.name, mode);
        cache[p.name] = { address: w.address, expires: now + ttl };
        w.cached = false; w.ttlLeft = ttl;
        return w;
      },
      entry: function (name) { return cache[name] || null; },
      clear: function () { cache = {}; }
    };
  }

  // Resource-record examples (RFC 2606 names, RFC 5737 / 3849 addresses only).
  var RECORDS = [
    ['A', 'www.example.com.  3600  IN  A      192.0.2.10', 'IPv4 address of a host'],
    ['AAAA', 'www.example.com.  3600  IN  AAAA   2001:db8::10', 'IPv6 address of a host'],
    ['NS', 'example.com.      86400 IN  NS     ns1.example.com.', 'Name server for the zone'],
    ['MX', 'example.com.      3600  IN  MX  10 mail.example.com.', 'Mail server; lower preference first'],
    ['CNAME', 'web.example.com.  3600  IN  CNAME  www.example.com.', 'Alias: look up the canonical name instead']
  ];

  CN.dns = { parse: parse, zones: zones, walk: walk, resolver: resolver, addrFor: addrFor, RECORDS: RECORDS };
})(typeof window !== 'undefined' ? window : globalThis);
