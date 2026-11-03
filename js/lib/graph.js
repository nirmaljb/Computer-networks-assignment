/* Graph solvers: Dijkstra (with every intermediate labelling) and flooding. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  // edges: [[a, b, w], ...] undirected
  function adjacency(nodes, edges) {
    var adj = {};
    nodes.forEach(function (n) { adj[n] = []; });
    edges.forEach(function (e) {
      if (e[3] === false) return; // link down
      adj[e[0]].push({ to: e[1], w: e[2] });
      adj[e[1]].push({ to: e[0], w: e[2] });
    });
    return adj;
  }

  function snapshot(labels) {
    var o = {};
    Object.keys(labels).forEach(function (k) { o[k] = { dist: labels[k].dist, pred: labels[k].pred, perm: labels[k].perm }; });
    return o;
  }

  // Each step: make the smallest tentative label permanent, then relax its neighbours.
  // Ties broken alphabetically so the run is reproducible.
  function dijkstra(nodes, edges, src) {
    var adj = adjacency(nodes, edges), labels = {}, order = [], steps = [];
    nodes.forEach(function (n) { labels[n] = { dist: Infinity, pred: null, perm: false }; });
    labels[src].dist = 0;
    steps.push({ perm: null, relaxed: [], labels: snapshot(labels) });
    for (;;) {
      var best = null;
      nodes.slice().sort().forEach(function (n) {
        if (!labels[n].perm && labels[n].dist < Infinity && (best === null || labels[n].dist < labels[best].dist)) best = n;
      });
      if (best === null) break;
      labels[best].perm = true;
      order.push(best);
      var relaxed = [];
      adj[best].forEach(function (e) {
        var L = labels[e.to];
        if (L.perm) return;
        var d = labels[best].dist + e.w;
        if (d < L.dist) { L.dist = d; L.pred = best; relaxed.push(e.to); }
      });
      steps.push({ perm: best, relaxed: relaxed, labels: snapshot(labels) });
    }
    var dist = {}, pred = {};
    nodes.forEach(function (n) { dist[n] = labels[n].dist; pred[n] = labels[n].pred; });
    return { src: src, dist: dist, pred: pred, order: order, steps: steps };
  }

  function path(res, dst) {
    if (res.dist[dst] === Infinity) return null;
    var p = [dst];
    while (p[0] !== res.src) p.unshift(res.pred[p[0]]);
    return p;
  }

  // Next hop from src towards every destination (a routing table).
  function table(res) {
    var t = {};
    Object.keys(res.dist).forEach(function (d) {
      var p = path(res, d);
      t[d] = { cost: res.dist[d], next: p && p.length > 1 ? p[1] : (p ? '—' : null) };
    });
    return t;
  }

  // Flooding: every copy goes out on every line except the one it came in on.
  // hops = initial hop counter; dedupe = routers forward only the first copy.
  function flood(nodes, edges, src, hops, dedupe) {
    var adj = adjacency(nodes, edges), seen = {}, rounds = [];
    seen[src] = true;
    var copies = [{ at: src, from: null, hops: hops }], total = 0;
    while (copies.length && rounds.length < 12) {
      var sent = [], next = [], dups = 0, fresh = [];
      copies.forEach(function (c) {
        if (c.hops <= 0) return;
        adj[c.at].forEach(function (e) {
          if (e.to === c.from) return;
          sent.push({ from: c.at, to: e.to });
          var dup = !!seen[e.to];
          if (dup) dups++; else { seen[e.to] = true; fresh.push(e.to); }
          if (!dedupe || !dup) next.push({ at: e.to, from: c.at, hops: c.hops - 1 });
        });
      });
      if (!sent.length) break;
      total += sent.length;
      rounds.push({ sent: sent, fresh: fresh, dups: dups, total: total, reached: Object.keys(seen).length });
      copies = next;
    }
    return rounds;
  }

  CN.graph = { adjacency: adjacency, dijkstra: dijkstra, path: path, table: table, flood: flood };
})(typeof window !== 'undefined' ? window : globalThis);
