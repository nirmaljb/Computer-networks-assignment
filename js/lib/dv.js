/* Distance vector routing (distributed Bellman-Ford), synchronous rounds.

   Rules (stated on screen):
   - In each exchange every router uses its neighbours' vectors from the
     PREVIOUS round: D(x,y) = min over up neighbours v of c(x,v) + D_v(y).
   - Values are capped at infinity (default 16, as in RIP).
   - A router that is down has no links and no table.
   - Ties keep the current next hop if it is among the best, else the
     alphabetically first neighbour.
   - Split horizon with poisoned reverse: v tells x "infinity" for every
     destination whose next hop at v is x. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  function create(nodes, links, opts) {
    opts = opts || {};
    var net = {
      nodes: nodes.slice(),
      links: links.map(function (l) { return { a: l[0], b: l[1], cost: l[2], up: l[3] !== false }; }),
      routerUp: {}, inf: opts.inf || 16, poison: !!opts.poison, round: 0, tables: {}, history: []
    };
    nodes.forEach(function (n) { net.routerUp[n] = true; });
    return net;
  }

  function linkUp(net, l) { return l.up && net.routerUp[l.a] && net.routerUp[l.b]; }

  function neighbours(net, x) {
    var out = [];
    net.links.forEach(function (l) {
      if (!linkUp(net, l)) return;
      if (l.a === x) out.push({ v: l.b, c: l.cost });
      else if (l.b === x) out.push({ v: l.a, c: l.cost });
    });
    return out.sort(function (p, q) { return p.v < q.v ? -1 : 1; });
  }

  // Initial tables: each up router knows only itself; everything else infinity.
  function reset(net) {
    net.round = 0;
    net.tables = {};
    net.nodes.forEach(function (x) {
      var t = {};
      net.nodes.forEach(function (y) { t[y] = { cost: x === y ? 0 : net.inf, via: x === y ? '—' : null }; });
      net.tables[x] = t;
    });
    net.history = [];
    return net;
  }

  function advertised(net, v, x, y, prev) {
    var e = prev[v][y];
    if (net.poison && e.via === x) return net.inf;
    return e.cost;
  }

  // One synchronous exchange. Returns the list of [router, dest] cells that changed.
  function exchange(net) {
    var prev = net.tables, next = {}, changed = [];
    net.nodes.forEach(function (x) {
      var t = {};
      if (!net.routerUp[x]) {
        net.nodes.forEach(function (y) { t[y] = { cost: net.inf, via: null, down: true }; });
        next[x] = t;
        return;
      }
      var nb = neighbours(net, x);
      net.nodes.forEach(function (y) {
        if (y === x) { t[y] = { cost: 0, via: '—' }; return; }
        var best = net.inf, via = null, cur = prev[x][y].via;
        nb.forEach(function (n) {
          var d = Math.min(net.inf, n.c + advertised(net, n.v, x, y, prev));
          if (d < best || (d === best && d < net.inf && n.v === cur)) { best = d; via = n.v; }
        });
        if (best >= net.inf) { best = net.inf; via = null; }
        t[y] = { cost: best, via: via };
      });
      next[x] = t;
    });
    net.nodes.forEach(function (x) {
      net.nodes.forEach(function (y) {
        if (next[x][y].cost !== prev[x][y].cost || next[x][y].via !== prev[x][y].via) changed.push([x, y]);
      });
    });
    net.tables = next;
    net.round++;
    return changed;
  }

  function converge(net, max) {
    max = max || 100;
    for (var i = 0; i < max; i++) if (!exchange(net).length) break;
    net.round = 0;
    return net;
  }

  // Distances to `dest` from the given routers, e.g. ['B','C','D','E'].
  function column(net, dest, routers) {
    return routers.map(function (r) { return net.tables[r][dest].cost; });
  }

  // Is dest actually reachable from x over up links? (for the "counting to infinity" banner)
  function reachable(net, x, dest) {
    if (!net.routerUp[x] || !net.routerUp[dest]) return false;
    var seen = {}, q = [x];
    seen[x] = true;
    while (q.length) {
      var u = q.shift();
      if (u === dest) return true;
      neighbours(net, u).forEach(function (n) { if (!seen[n.v]) { seen[n.v] = true; q.push(n.v); } });
    }
    return false;
  }

  function counting(net, dest) {
    return net.nodes.some(function (x) {
      return x !== dest && net.routerUp[x] && net.tables[x][dest].cost < net.inf && !reachable(net, x, dest);
    });
  }

  // A router that comes up knows only itself; one that goes down loses its table.
  function setRouter(net, r, up) {
    net.routerUp[r] = up;
    if (!net.tables[r]) return;
    net.nodes.forEach(function (y) {
      net.tables[r][y] = up ? { cost: y === r ? 0 : net.inf, via: y === r ? '—' : null }
                            : { cost: net.inf, via: null, down: true };
    });
  }
  function findLink(net, a, b) {
    return net.links.filter(function (l) { return (l.a === a && l.b === b) || (l.a === b && l.b === a); })[0];
  }

  // The other textbook's five-router network (its distance vector figures): A–B 5, A–C 2, A–D 3, B–C 4, B–E 3, C–E 4.
  var FIG = { nodes: ['A', 'B', 'C', 'D', 'E'], links: [['A', 'B', 5], ['A', 'C', 2], ['A', 'D', 3], ['B', 'C', 4], ['B', 'E', 3], ['C', 'E', 4]] };

  // Initialization (before any exchange): each router knows only itself and its up neighbours, at the link cost.
  function start(net) {
    reset(net);
    net.nodes.forEach(function (x) {
      if (!net.routerUp[x]) return;
      neighbours(net, x).forEach(function (n) { net.tables[x][n.v] = { cost: n.c, via: n.v }; });
    });
    return net;
  }

  // figure(cut): the network with link 'A-C' (or none) cut, initialised. → net
  function figure(cut, opts) {
    var net = create(FIG.nodes, FIG.links, opts || { inf: 16 });
    if (cut) { var ab = cut.split('-'), l = findLink(net, ab[0], ab[1]); if (l) l.up = false; }
    return start(net);
  }

  // Why x's entry for y changed: x heard v say y is d, and c(x, v) + d beat what x had.
  function because(net, prev, x, y) {
    var e = net.tables[x][y], n = neighbours(net, x).filter(function (p) { return p.v === e.via; })[0];
    return { x: x, y: y, v: e.via, c: n ? n.c : null, d: prev[e.via] ? prev[e.via][y].cost : null, cost: e.cost, was: prev[x][y].cost };
  }

  CN.dv = {
    create: create, reset: reset, exchange: exchange, converge: converge, column: column,
    neighbours: neighbours, counting: counting, reachable: reachable, setRouter: setRouter, findLink: findLink,
    FIG: FIG, start: start, figure: figure, because: because
  };
})(typeof window !== 'undefined' ? window : globalThis);
