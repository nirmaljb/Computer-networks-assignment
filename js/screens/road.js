/* Traffic road for S20 (SPEC-v4 §5): a three.js scene with a sender town, a bottleneck toll
   booth and a receiver. SIM mode draws one round of CN.tcp.road() per call; LIVE / RECORDED
   modes draw one vehicle per packet summary { proto, payload, dir } (never an address or port).
   three.js (vendored r160) is loaded on demand; without it or without WebGL, create() fails
   and the screen shows the graph alone. Vehicles are told apart by shape, colour second.
   The camera orbits with the mouse: drag rotates, right-drag (or Shift-drag) pans, the wheel
   zooms, a double-click goes back to the starting view. */
(function () {
  'use strict';
  var CN = window.CN, h = CN.h;

  var SRC = 'js/lib/vendor/three.r160.js';
  function loadThree(cb) {
    if (window.THREE && window.THREE.WebGLRenderer) return cb(null);
    var tag = document.querySelector('script[data-three]');
    if (!tag) {
      tag = document.createElement('script');
      tag.src = SRC; tag.setAttribute('data-three', '1');
      document.head.appendChild(tag);
    }
    tag.addEventListener('load', function () { cb(window.THREE && window.THREE.WebGLRenderer ? null : new Error('three.js did not load')); });
    tag.addEventListener('error', function () { cb(new Error('three.js missing')); });
  }

  // Scene units: road along x from −11 (sender) to +11 (receiver); booth at x = 0.
  // Three data lanes (sender → receiver) and two return lanes (ACKs, inbound packets).
  var X0 = -11, X1 = 11, BOOTH = 0, V = 12, LANES = [0.45, 0.95, 1.45], BACK = [-0.65, -1.25], ROW = 0.8, PERIOD = 2.2;
  var MAX = 400;
  // Only the vehicles a mode can produce are in its legend: the simulation sends TCP data and ACKs only.
  var LEGEND = {
    sim: [['truck', 'Truck', 'TCP data segment'], ['car', 'Car', 'ACK'], ['wreck', 'Wreck', 'dropped at the full queue']],
    live: [['truck', 'Truck', 'TCP data'], ['car', 'Car', 'TCP control (ACK, SYN, FIN, RST)'], ['van', 'Van', 'UDP (mostly DNS)'], ['bus', 'Bus', 'QUIC (HTTP/3)']]
  };

  // '2026-11-03' → '3 Nov 2026'
  function niceDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? (+m[3]) + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[+m[2] - 1] + ' ' + m[1] : (iso || '');
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

  function create(host, opts, done) {
    loadThree(function (err) {
      if (err) return done(null, err.message);
      var T = window.THREE, renderer;
      try {
        renderer = new T.WebGLRenderer({ antialias: true });
        if (!renderer.getContext()) throw new Error('no WebGL');
      } catch (e) { return done(null, 'WebGL unavailable'); }
      done(build(T, renderer, host, opts || {}));
    });
  }

  /* ---------- low-poly modelling helpers ---------- */
  // A side profile [[x, y], …] (x forward, y up) extruded to width w across z, centred on z = 0, edges bevelled by b.
  function prism(T, pts, w, b) {
    b = b || 0;
    var sh = new T.Shape();
    pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
    var d = Math.max(0.002, w - 2 * b);
    var g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -d / 2);
    return g;
  }
  function rect(T, x0, x1, y0, y1, w, b) { return prism(T, [[x0 + (b || 0), y0 + (b || 0)], [x1 - (b || 0), y0 + (b || 0)], [x1 - (b || 0), y1 - (b || 0)], [x0 + (b || 0), y1 - (b || 0)]], w, b); }
  // Merge [geometry, …] into one BufferGeometry (position + normal), so each material is one instanced draw.
  function merge(T, list) {
    var pos = [], nor = [];
    list.forEach(function (g) {
      var n = g.index ? g.toNonIndexed() : g;
      if (!n.attributes.normal) n.computeVertexNormals();
      Array.prototype.push.apply(pos, n.attributes.position.array);
      Array.prototype.push.apply(nor, n.attributes.normal.array);
      if (n !== g) n.dispose();
      g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    return out;
  }
  function at(g, x, y, z, rx, ry, rz) {
    if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
    g.translate(x, y, z); return g;
  }
  // wheels: tyre + hub at each x, both sides
  function wheels(T, xs, r, w, half, parts) {
    xs.forEach(function (x) {
      [-1, 1].forEach(function (s) {
        parts.dark.push(at(new T.CylinderGeometry(r, r, w, 12), x, r, s * half, Math.PI / 2));
        parts.hub.push(at(new T.CylinderGeometry(r * 0.5, r * 0.5, w + 0.006, 8), x, r, s * half, Math.PI / 2));
      });
    });
  }
  function lights(T, xFront, xBack, y, zs, parts) {
    zs.forEach(function (z) {
      parts.lamp.push(at(new T.BoxGeometry(0.012, 0.03, 0.05), xFront, y, z));
      parts.tail.push(at(new T.BoxGeometry(0.012, 0.03, 0.05), xBack, y, z));
    });
  }

  // Each builder returns { body, glass, dark, hub, lamp, tail, trim: [geometry] }, front facing +x.
  // Footprints stay inside the old boxes (truck 0.74 × 0.34, car 0.44 × 0.25, van 0.46 × 0.28, bus 0.92 × 0.32).
  var BUILD = {
    truck: function (T) {
      var W = 0.34, p = parts();
      p.body.push(rect(T, -0.37, 0.12, 0.09, 0.42, W, 0.014));                          // trailer
      p.trim.push(rect(T, -0.36, 0.11, 0.16, 0.185, W + 0.006, 0));                      // stripe along the trailer
      p.dark.push(rect(T, -0.372, -0.36, 0.1, 0.41, W * 0.9, 0));                        // rear doors
      p.trim.push(rect(T, 0.15, 0.37, 0.07, 0.205, W * 0.96, 0.012));                    // white cab, lower half
      p.trim.push(rect(T, 0.15, 0.265, 0.2, 0.31, W * 0.96, 0.006));                     // cab, sleeper behind the glass
      p.glass.push(prism(T, [[0.26, 0.2], [0.365, 0.2], [0.33, 0.3], [0.26, 0.3]], W * 0.93, 0));
      p.trim.push(rect(T, 0.15, 0.338, 0.295, 0.322, W * 0.96, 0.006));                 // cab roof
      p.dark.push(rect(T, -0.37, 0.37, 0.045, 0.095, W * 0.84, 0));                      // chassis
      p.dark.push(rect(T, 0.365, 0.385, 0.07, 0.17, W * 0.8, 0));                        // grille + bumper
      wheels(T, [-0.3, -0.19, 0.06, 0.29], 0.055, 0.05, W / 2 - 0.02, p);
      lights(T, 0.388, -0.376, 0.13, [-0.12, 0.12], p);
      return p;
    },
    car: function (T) {
      var W = 0.25, p = parts();
      p.body.push(prism(T, [[-0.215, 0.05], [0.21, 0.05], [0.222, 0.1], [0.2, 0.135], [0.07, 0.148], [-0.1, 0.148], [-0.205, 0.135], [-0.222, 0.1]], W, 0.012));
      p.glass.push(prism(T, [[-0.11, 0.14], [0.065, 0.14], [0.02, 0.212], [-0.078, 0.212]], W * 0.86, 0));
      p.body.push(prism(T, [[-0.084, 0.208], [0.024, 0.208], [0.019, 0.224], [-0.08, 0.224]], W * 0.88, 0.004));
      p.dark.push(rect(T, -0.2, 0.2, 0.035, 0.06, W * 0.86, 0));
      wheels(T, [-0.13, 0.13], 0.05, 0.045, W / 2 - 0.012, p);
      lights(T, 0.226, -0.226, 0.105, [-0.08, 0.08], p);
      return p;
    },
    van: function (T) {
      var W = 0.28, p = parts();
      p.body.push(rect(T, -0.23, 0.235, 0.05, 0.205, W, 0.014));                         // lower body
      p.body.push(rect(T, -0.23, 0.105, 0.195, 0.335, W, 0.012));                        // load box
      p.glass.push(prism(T, [[0.1, 0.2], [0.226, 0.2], [0.155, 0.322], [0.1, 0.322]], W * 0.92, 0));
      p.glass.push(rect(T, -0.15, 0.06, 0.235, 0.3, W + 0.006, 0));                      // side windows
      p.body.push(rect(T, -0.23, 0.16, 0.318, 0.345, W * 0.98, 0.006));                  // roof
      p.dark.push(rect(T, 0.232, 0.245, 0.06, 0.11, W * 0.8, 0));
      wheels(T, [-0.14, 0.14], 0.05, 0.05, W / 2 - 0.012, p);
      lights(T, 0.248, -0.236, 0.15, [-0.09, 0.09], p);
      return p;
    },
    bus: function (T) {
      var W = 0.32, p = parts();
      p.body.push(rect(T, -0.46, 0.46, 0.06, 0.185, W, 0.016));                          // lower body
      p.glass.push(rect(T, -0.452, 0.455, 0.18, 0.31, W * 0.97, 0));                     // window band
      for (var x = -0.36; x < 0.4; x += 0.16) p.body.push(rect(T, x - 0.012, x + 0.012, 0.18, 0.31, W, 0)); // pillars
      p.body.push(rect(T, -0.46, 0.46, 0.305, 0.35, W, 0.016));                          // roof
      p.trim.push(rect(T, -0.4, 0.3, 0.35, 0.37, W * 0.6, 0.008));                       // roof unit
      p.dark.push(rect(T, -0.44, 0.44, 0.04, 0.07, W * 0.88, 0));
      wheels(T, [-0.3, 0.3], 0.058, 0.05, W / 2 - 0.016, p);
      lights(T, 0.465, -0.465, 0.12, [-0.11, 0.11], p);
      return p;
    }
  };
  function parts() { return { body: [], glass: [], dark: [], hub: [], lamp: [], tail: [], trim: [] }; }
  // kind → [builder, body material]; a wreck is a truck burnt red
  var KINDS = { truck: ['truck', 'truck'], car: ['car', 'car'], van: ['van', 'van'], bus: ['bus', 'bus'], wreck: ['truck', 'wreck'] };

  /* ---------- camera orbit (mouse and touch) ---------- */
  function orbit(T, camera, el) {
    var home = { th: -0.1, ph: 0.9, r: 26, tx: 0.6, tz: 1.5 };   // aimed in front of the road, so the road sits above the graph inset
    var goal = Object.assign({}, home), cur = Object.assign({}, home), moved = false, drag = null, pts = {};
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function down(e) {
      if (e.pointerType === 'mouse' && e.button > 2) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ }
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      drag = (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'rotate';
      el.classList.add('grabbing');
      api.onUse();
    }
    function move(e) {
      var p = pts[e.pointerId];
      if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y, ids = Object.keys(pts);
      if (ids.length === 2) {                                     // pinch: zoom by the change in finger distance
        var o = pts[ids[0] == e.pointerId ? ids[1] : ids[0]];
        var before = Math.hypot(p.x - o.x, p.y - o.y), after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (before > 0 && after > 0) goal.r = clamp(goal.r * before / after, 5, 70);
      } else if (drag === 'pan') {
        var s = goal.r * 0.0016, c = Math.cos(goal.th), n = Math.sin(goal.th);
        goal.tx = clamp(goal.tx - dx * s * c - dy * s * n, -18, 18);
        goal.tz = clamp(goal.tz + dx * s * n - dy * s * c, -9, 9);
      } else {
        goal.th -= dx * 0.006;
        goal.ph = clamp(goal.ph - dy * 0.005, 0.12, 1.42);
      }
      p.x = e.clientX; p.y = e.clientY; moved = true;
    }
    function up(e) {
      delete pts[e.pointerId];
      if (!Object.keys(pts).length) { drag = null; el.classList.remove('grabbing'); }
    }
    function wheel(e) {
      e.preventDefault();
      goal.r = clamp(goal.r * Math.exp(e.deltaY * 0.0012), 5, 70);
      moved = true; api.onUse();
    }
    function reset() { goal = Object.assign({}, home); moved = false; }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('dblclick', reset);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var api = {
      onUse: function () {},
      reset: reset,
      // the starting distance fits both towns; a resize re-fits it unless the presenter has moved the view
      setHome: function (r) { home.r = r; if (!moved) { goal.r = r; } },
      update: function (dt) {
        var k = 1 - Math.exp(-dt * 9);
        Object.keys(cur).forEach(function (key) { cur[key] += (goal[key] - cur[key]) * k; });
        camera.position.set(cur.tx + cur.r * Math.sin(cur.ph) * Math.sin(cur.th), cur.r * Math.cos(cur.ph), cur.tz + cur.r * Math.sin(cur.ph) * Math.cos(cur.th));
        camera.lookAt(cur.tx, 0, cur.tz);
      },
      // distance at the home angles where the whole scene fits the view
      fit: function () {
        var save = Object.assign({}, cur), probe = new T.Vector3(), r = 8;
        var box = [[-14, 0, -2.6], [14, 0, -2.6], [-14, 0, 2.8], [14, 0, 2.8], [-14, 1.5, 0], [14, 2.4, 0]];
        for (; r < 70; r += 0.5) {
          cur = { th: home.th, ph: home.ph, r: r, tx: home.tx, tz: home.tz };
          api.update(0); camera.updateMatrixWorld();
          if (box.every(function (b) { probe.set(b[0], b[1], b[2]).project(camera); return Math.abs(probe.x) < 0.96 && Math.abs(probe.y) < 0.9; })) break;
        }
        cur = save;
        return r;
      }
    };
    return api;
  }

  function build(T, renderer, host, opts) {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    var wrap = h('div', { class: 'road-wrap', style: { width: '100%', height: '100%' } });
    var badge = h('div', { class: 'road-badge' }, 'SIMULATION');
    var note = h('div', { class: 'road-note', style: { top: '46px', bottom: 'auto', display: 'none' } });
    var legend = h('div', { class: 'road-legend' });
    var hint = h('div', { class: 'road-hint' }, 'Drag to rotate · right-drag to move · scroll to zoom · double-click to reset');
    var labels = { src: h('div', { class: 'road-tag' }), booth: h('div', { class: 'road-tag' }), dst: h('div', { class: 'road-tag' }) };
    wrap.appendChild(renderer.domElement);
    [badge, note, legend, hint, labels.src, labels.booth, labels.dst].forEach(function (e) { wrap.appendChild(e); });
    host.appendChild(wrap);
    renderer.domElement.classList.add('road-canvas');

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(36, 1, 0.1, 300);
    var cam = orbit(T, camera, renderer.domElement);
    cam.onUse = function () { hint.classList.add('gone'); };
    var hemi = new T.HemisphereLight(0xffffff, 0x8a8a7a, 1.5); scene.add(hemi);
    var sun = new T.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-7, 15, 9); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -19; sun.shadow.camera.right = 19; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 50; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.fog = new T.Fog(0xffffff, 45, 110);

    var mats = {};
    function mat(key, o) {
      if (!mats[key]) {
        o = o || {};
        mats[key] = new T.MeshStandardMaterial({ color: 0x888888, roughness: o.rough != null ? o.rough : 0.75, metalness: o.metal || 0, transparent: !!o.opacity, opacity: o.opacity || 1 });
        if (o.emissive) mats[key].emissive = new T.Color(o.emissive);
        if (o.opacity) mats[key].depthWrite = false;
      }
      return mats[key];
    }
    function mesh(geo, m, shadow) { var x = new T.Mesh(geo, m); x.castShadow = shadow !== false; x.receiveShadow = true; scene.add(x); return x; }

    /* ---------- the world ---------- */
    var ground = mesh(new T.PlaneGeometry(160, 100), mat('ground', { rough: 1 }), false); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
    var LEN = X1 - X0 + 9;
    var road = mesh(new T.PlaneGeometry(LEN, 3.4), mat('road', { rough: 0.95 }), false); road.rotation.x = -Math.PI / 2;
    [-1, 1].forEach(function (s) { mesh(new T.BoxGeometry(LEN, 0.06, 0.34), mat('kerb', { rough: 0.9 })).position.set(0, 0.03, s * 1.87); });
    mesh(new T.BoxGeometry(LEN, 0.05, 0.36), mat('kerb')).position.set(0, 0.025, -0.075);   // median between the two directions
    mesh(new T.BoxGeometry(LEN, 0.02, 0.22), mat('verge', { rough: 1 })).position.set(0, 0.05, -0.075);
    // lane markings: solid edges, dashed lane dividers
    [1.64, -1.64].forEach(function (z) { mesh(new T.BoxGeometry(LEN, 0.004, 0.035), mat('paint'), false).position.set(0, 0.004, z); });
    var dashes = [];
    for (var dx = -LEN / 2 + 0.3; dx < LEN / 2; dx += 0.75) [0.7, 1.2, -0.95].forEach(function (z) { dashes.push(at(new T.BoxGeometry(0.34, 0.004, 0.03), dx, 0.004, z)); });
    mesh(merge(T, dashes), mat('paint'), false);

    // trees and buildings, from a fixed seed so the scene is the same on every load
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var trunks = [], leaves = [], leaves2 = [];
    function tree(x, z, s) {
      trunks.push(at(new T.CylinderGeometry(0.05 * s, 0.07 * s, 0.4 * s, 6), x, 0.2 * s, z));
      (rnd() < 0.5 ? leaves : leaves2).push(at(new T.IcosahedronGeometry(0.34 * s, 0), x, 0.6 * s, z, rnd(), rnd(), 0));
      if (rnd() < 0.5) leaves.push(at(new T.IcosahedronGeometry(0.22 * s, 0), x + 0.1 * s, 0.86 * s, z - 0.05 * s, rnd(), 0, rnd()));
    }
    for (var tx = X0 + 2.2; tx < X1 - 1.5; tx += 1.1 + rnd() * 0.9) {
      if (Math.abs(tx - BOOTH) < 1.6) continue;
      tree(tx, 2.45 + rnd() * 1.3, 0.8 + rnd() * 0.5);
      if (rnd() < 0.8) tree(tx + rnd() * 0.6, -2.4 - rnd() * 1.4, 0.8 + rnd() * 0.5);
    }
    // sender: houses with pitched roofs; receiver: office and server blocks
    var walls = [], walls2 = [], roofs = [], panes = [];
    function house(x, z, w, d, hgt) {
      walls.push(at(new T.BoxGeometry(w, hgt, d), x, hgt / 2, z));
      roofs.push(at(prism(T, [[-w / 2 - 0.06, 0], [w / 2 + 0.06, 0], [0, w * 0.45]], d + 0.12, 0), x, hgt, z));
      panes.push(at(new T.BoxGeometry(0.16, 0.16, d + 0.01), x - w * 0.22, hgt * 0.55, z), at(new T.BoxGeometry(0.16, 0.16, d + 0.01), x + w * 0.22, hgt * 0.55, z));
    }
    function tower(x, z, w, d, hgt) {
      walls2.push(at(new T.BoxGeometry(w, hgt, d), x, hgt / 2, z));
      roofs.push(at(new T.BoxGeometry(w * 0.5, 0.12, d * 0.5), x, hgt + 0.06, z));
      for (var y = 0.35; y < hgt - 0.2; y += 0.38) panes.push(at(new T.BoxGeometry(w + 0.01, 0.14, d * 0.8), x, y, z), at(new T.BoxGeometry(w * 0.8, 0.14, d + 0.01), x, y, z));
    }
    [[-0.2, 2.9, 1.0, 0.9, 0.7], [1.1, 3.4, 0.8, 0.8, 0.6], [-1.3, 4.1, 0.9, 0.8, 0.8], [0.3, -2.8, 1.1, 0.9, 0.75], [-1.2, -3.6, 0.9, 0.8, 0.65], [1.2, -3.9, 0.8, 0.9, 0.7], [-2.2, 0.4, 0.9, 1.0, 0.8], [-2.4, -1.2, 0.8, 0.9, 0.6]]
      .forEach(function (b) { house(X0 - 1.6 + b[0], b[1], b[2], b[3], b[4]); });
    [[0, 2.9, 1.0, 1.0, 2.4], [1.3, 3.6, 0.9, 0.9, 1.6], [-1.1, 3.8, 0.8, 0.8, 1.2], [0.2, -2.9, 1.1, 1.0, 1.9], [1.4, -3.8, 0.8, 0.8, 1.3], [-1.0, -3.7, 0.9, 0.9, 2.8], [2.4, 0.3, 1.0, 1.2, 1.1], [2.5, -1.2, 0.9, 0.9, 1.7]]
      .forEach(function (b) { tower(X1 + 1.6 + b[0], b[1], b[2], b[3], b[4]); });
    mesh(merge(T, trunks), mat('trunk'));
    mesh(merge(T, leaves), mat('leaf', { rough: 0.9 }));
    mesh(merge(T, leaves2), mat('leaf2', { rough: 0.9 }));
    mesh(merge(T, walls), mat('wall'));
    mesh(merge(T, walls2), mat('wall2', { rough: 0.5 }));
    mesh(merge(T, roofs), mat('roof'));
    mesh(merge(T, panes), mat('pane', { rough: 0.25, metal: 0.2 }), false);

    // the bottleneck: a toll plaza with a router on its roof
    var booth = new T.Group();
    function part(geo, m, x, y, z) { var p = new T.Mesh(geo, m); p.position.set(x, y, z); p.castShadow = p.receiveShadow = true; booth.add(p); return p; }
    part(rect(T, -0.55, 0.55, 0, 0.14, 4.3, 0.03), mat('booth', { rough: 0.5 }), 0, 1.28, 0);
    part(new T.BoxGeometry(1.14, 0.04, 4.34), mat('trim'), 0, 1.3, 0);
    [-2.0, -0.075, 2.0].forEach(function (z) { part(new T.BoxGeometry(0.16, 1.28, 0.16), mat('trim'), 0, 0.64, z); });
    part(new T.BoxGeometry(0.5, 0.48, 0.3), mat('kiosk'), 0.05, 0.29, -0.075);
    part(new T.BoxGeometry(0.34, 0.16, 0.32), mat('glass', { rough: 0.15, metal: 0.4 }), 0.05, 0.4, -0.075);
    part(new T.BoxGeometry(0.7, 0.16, 1.0), mat('router', { rough: 0.4 }), 0, 1.5, 0);
    [-0.3, 0.3].forEach(function (z) { part(new T.CylinderGeometry(0.02, 0.02, 0.5, 6), mat('router'), -0.2, 1.8, z); });
    [-0.3, -0.1, 0.1, 0.3].forEach(function (z, i) { part(new T.BoxGeometry(0.02, 0.04, 0.06), mat(i < 3 ? 'ledOk' : 'ledBad', { emissive: i < 3 ? 0x22cc44 : 0xff3322 }), 0.355, 1.5, z); });
    // the barrier across the data lanes, red and white
    var bar = new T.Group();
    for (var i = 0; i < 6; i++) { var seg = new T.Mesh(new T.BoxGeometry(0.07, 0.07, 0.25), mat(i % 2 ? 'barW' : 'bar')); seg.position.set(0, 0, 0.3 + i * 0.25); seg.castShadow = true; bar.add(seg); }
    bar.position.set(-0.4, 0.62, -0.05); booth.add(bar);
    booth.position.x = BOOTH; scene.add(booth);
    var queueZone = new T.Mesh(new T.PlaneGeometry(3 * ROW, 1.5), mat('queue', { opacity: 0.55 })); queueZone.rotation.x = -Math.PI / 2; queueZone.position.set(BOOTH - 0.35 - 1.5 * ROW, 0.008, 0.95); scene.add(queueZone);

    /* ---------- instanced vehicles: one draw per kind and material ---------- */
    var SLOTS = ['body', 'glass', 'dark', 'hub', 'lamp', 'tail', 'trim'];
    var SLOTMAT = { glass: ['glassCar', { rough: 0.15, metal: 0.5 }], dark: ['tyre', { rough: 0.9 }], hub: ['hub', { rough: 0.4, metal: 0.6 }], lamp: ['lamp', { emissive: 0xfff2c0 }], tail: ['taillamp', { emissive: 0xaa0000 }], trim: ['vtrim', { rough: 0.5 }] };
    var built = {}, meshes = {};
    Object.keys(KINDS).forEach(function (k) {
      var b = KINDS[k][0], p = built[b] || (built[b] = BUILD[b](T));
      meshes[k] = [];
      SLOTS.forEach(function (slot) {
        if (!p[slot].length) return;
        if (!p[slot].merged) p[slot].merged = merge(T, p[slot]);
        var m = slot === 'body' ? mat(KINDS[k][1], { rough: 0.45, metal: 0.1 }) : mat(SLOTMAT[slot][0], SLOTMAT[slot][1]);
        if (k === 'wreck' && slot === 'glass') m = mat('soot', { rough: 1 });
        var im = new T.InstancedMesh(p[slot].merged, m, MAX);
        im.count = 0; im.frustumCulled = false; im.castShadow = slot !== 'lamp' && slot !== 'tail'; im.receiveShadow = slot === 'body';
        scene.add(im); meshes[k].push(im);
      });
    });

    function applyTheme() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var sky = dark ? '#151a22' : '#dce8ef';
      scene.background = new T.Color(sky); scene.fog.color.set(sky);
      hemi.intensity = dark ? 0.9 : 1.5; sun.intensity = dark ? 1.6 : 2.6;
      var c = {
        ground: dark ? '#26332a' : '#a9c48f', road: dark ? '#2e333a' : '#5b6068', kerb: dark ? '#4a5059' : '#c9c6bd', verge: dark ? '#2f4a33' : '#86ad6a', paint: dark ? '#b9bdc4' : '#f4f4f0',
        trunk: '#7a5a3c', leaf: dark ? '#2f6a3c' : '#4e9a52', leaf2: dark ? '#3c7a35' : '#6fae45',
        wall: dark ? '#6b6258' : '#efe3cf', wall2: dark ? '#4c5868' : '#c7d3df', roof: dark ? '#7a3b33' : '#b5503f', pane: dark ? '#e6c46a' : '#5f7d99',
        booth: cssVar('--accent'), trim: dark ? '#cfd3d8' : '#f5f5f2', kiosk: dark ? '#5d6570' : '#e2e4e8', glass: '#7fa8c8', router: '#2b2f36', ledOk: '#22cc44', ledBad: '#ff3322',
        bar: '#d42a2a', barW: '#f5f5f5', queue: dark ? '#a8741c' : '#f2b84b',
        truck: cssVar('--blue'), car: cssVar('--green'), van: cssVar('--amber'), bus: cssVar('--accent'), wreck: cssVar('--red'),
        glassCar: '#1d2733', tyre: '#1b1c1f', hub: '#b9bec6', lamp: '#fff6d5', taillamp: '#e02020', vtrim: '#f2f2f2', soot: '#2a2220'
      };
      Object.keys(c).forEach(function (k) { if (mats[k]) mats[k].color.set(c[k]); });
      legendColours = c;
      drawLegend();
    }
    var themeNow = null, legendColours = {}, legendMode = 'sim';
    function drawLegend() {
      CN.clear(legend);
      LEGEND[legendMode].forEach(function (l) {
        legend.appendChild(h('span', { class: 'road-sw road-sw-' + l[0], style: { background: legendColours[l[0]] } }));
        legend.appendChild(h('span', null, h('b', null, l[1]), ' ' + l[2]));
      });
    }

    /* ---------- vehicles ---------- */
    // { kind, z, dir: +1 | −1, path: fn(t) → { x, wait (not started), gone (finished), wreck, sink } }
    var cars = [], clock = 0;
    function add(v) { if (cars.length < 2000) cars.push(v); }
    function straight(t0, dir) {
      return function (t) {
        var x = dir > 0 ? X0 + V * (t - t0) : X1 - V * (t - t0);
        return { x: x, wait: t < t0, gone: dir > 0 ? x > X1 + 0.5 : x < X0 - 0.5 };
      };
    }

    // SIM: one round of n trucks through the booth (served / queued / dropped from CN.tcp.road).
    // Trucks leave in rows of three; served ones pass the booth, queued ones wait in its 3-lane queue
    // and drain once the round has arrived, the rest are wrecked behind the full queue and towed.
    function round(n, capacity) {
      var r = CN.tcp.road(n, capacity), t0 = clock, g = ROW / V;
      var lastArrive = t0 + Math.floor((n - 1) / 3) * g + (BOOTH - X0) / V;
      for (var i = 0; i < n; i++) {
        (function (i) {
          var d = t0 + Math.floor(i / 3) * g, lane = LANES[i % 3], back = BACK[i % 2];
          if (i < r.served) {
            add({ kind: 'truck', z: lane, dir: 1, path: straight(d, 1) });
            add({ kind: 'car', z: back, dir: -1, path: straight(d + (X1 - X0) / V, -1) });
          } else if (i < r.served + r.queued) {
            var k = i - r.served, slot = BOOTH - 0.55 - Math.floor(k / 3) * ROW, stopAt = d + (slot - X0) / V, leave = lastArrive + 0.25 + Math.floor(k / 3) * g;
            add({ kind: 'truck', z: LANES[k % 3], dir: 1, path: function (t) {
              var x = t < stopAt ? X0 + V * (t - d) : t < leave ? slot : slot + V * (t - leave);
              return { x: x, wait: t < d, gone: x > X1 + 0.5 };
            } });
            add({ kind: 'car', z: back, dir: -1, path: straight(leave + (X1 - slot) / V, -1) });
          } else {
            var j = i - r.served - r.queued, spot = BOOTH - 0.55 - (Math.ceil(r.hold / 3) + Math.floor(j / 3)) * ROW, at = d + (spot - X0) / V;
            add({ kind: 'truck', z: LANES[j % 3], dir: 1, path: function (t) {
              if (t >= at) return { x: spot, wreck: true, sink: Math.max(0, t - at - 1.1), gone: t > at + 1.7 };
              return { x: X0 + V * (t - d), wait: t < d };
            } });
          }
        })(i);
      }
      return r;
    }
    // LIVE / RECORDED: one vehicle per packet summary
    function packet(p) {
      var kind = p.proto === 'TCP' ? (p.payload > 0 ? 'truck' : 'car') : p.proto === 'QUIC' ? 'bus' : 'van';
      var out = p.dir === 'out';
      var lanes = out ? LANES : BACK;
      add({ kind: kind, z: lanes[Math.floor(Math.random() * lanes.length)], dir: out ? 1 : -1, path: straight(clock, out ? 1 : -1) });
    }
    function clear() { cars = []; }

    /* ---------- frame loop ---------- */
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pos = new T.Vector3(), scl = new T.Vector3(1, 1, 1);
    var last = performance.now(), raf = null, w = 0, hgt = 0;
    function resize() {
      var r = wrap.getBoundingClientRect(), sc = wrap.offsetWidth ? r.width / wrap.offsetWidth : 1;
      var cw = Math.max(50, Math.round(r.width / sc)), ch = Math.max(50, Math.round(r.height / sc));
      if (cw === w && ch === hgt) return;
      w = cw; hgt = ch;
      renderer.setSize(w, hgt);
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
      cam.setHome(cam.fit());
    }
    function place(el, x, y, z, dy) {
      pos.set(x, y, z).project(camera);
      var off = pos.z > 1 || Math.abs(pos.x) > 1.05 || Math.abs(pos.y) > 1.05;
      el.style.visibility = off ? 'hidden' : '';
      el.style.left = ((pos.x + 1) / 2 * w - el.offsetWidth / 2) + 'px';
      el.style.top = ((1 - pos.y) / 2 * hgt - el.offsetHeight + (dy || 0)) + 'px';
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.25, (now - last) / 1000); last = now; clock += dt;
      var th = document.documentElement.getAttribute('data-theme');
      if (th !== themeNow) { themeNow = th; applyTheme(); }
      resize();
      cam.update(dt);
      var counts = {};
      Object.keys(meshes).forEach(function (k) { counts[k] = 0; });
      cars = cars.filter(function (v) {
        var p = v.path(clock);
        if (p.gone) return false;
        if (p.wait) return true;
        var kind = p.wreck ? 'wreck' : v.kind, i = counts[kind];
        if (i >= MAX) return true;
        counts[kind]++;
        // a wreck rolls onto its side and sinks away before it is towed
        e.set(p.wreck ? 0.45 : 0, v.dir > 0 ? 0 : Math.PI, p.wreck ? 0.12 : 0);
        q.setFromEuler(e);
        pos.set(p.x, p.wreck ? 0.04 - (p.sink || 0) * 0.6 : 0, v.z);
        m4.compose(pos, q, scl);
        meshes[kind].forEach(function (m) { m.setMatrixAt(i, m4); });
        return true;
      });
      Object.keys(meshes).forEach(function (k) { meshes[k].forEach(function (m) { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; }); });
      renderer.render(scene, camera);
      place(labels.src, X0 - 1.6, 1.4, 0, -4); place(labels.booth, BOOTH, 2.1, 0, -4); place(labels.dst, X1 + 1.6, 3.0, 0, -4);
    }

    function setMode(mode, info) {
      badge.className = 'road-badge' + (mode === 'live' ? ' live' : mode === 'replay' ? ' rec' : '');
      badge.textContent = mode === 'live' ? 'LIVE · your laptop, right now · ' + (info || 0) + ' pkt/s' :
        mode === 'replay' ? 'RECORDED · my laptop, ' + niceDate(info) : 'SIMULATION';
      var sim = mode === 'sim';
      labels.src.textContent = sim ? 'Sender' : 'This laptop';
      labels.dst.textContent = sim ? 'Receiver' : 'The internet';
      labels.booth.textContent = sim ? 'Bottleneck router' : 'Wi-Fi link';
      queueZone.visible = bar.visible = sim;
      note.textContent = 'Protocol and size only: no addresses, no ports';
      note.style.display = sim ? 'none' : '';
      legendMode = sim ? 'sim' : 'live';
      drawLegend();
    }
    setMode('sim');
    raf = requestAnimationFrame(frame);

    return {
      round: round, packet: packet, clear: clear, setMode: setMode, resetView: function () { cam.reset(); },
      setCapacity: function () { setMode('sim'); },
      destroy: function () {
        cancelAnimationFrame(raf);
        renderer.dispose();
        scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
        Object.keys(mats).forEach(function (k) { mats[k].dispose(); });
        wrap.remove();
      }
    };
  }

  /* ---------- live feed and recorded replay (SPEC-v4 §5.3) ---------- */
  // One fallback rule: live fails (no answer in 1 s, or 3 s of silence) → replay → sim. onMode(mode, info).
  var LIVE_URL = 'http://127.0.0.1:8767/traffic';
  function loadReplay(cb) {
    if (window.CN_TRAFFIC_REPLAY) return cb(window.CN_TRAFFIC_REPLAY);
    var ok = function (d) { cb(d && d.packets && d.packets.length ? d : null); };
    function viaScript() {
      var s = document.createElement('script');
      s.src = 'server/traffic-replay.js';
      s.onload = function () { ok(window.CN_TRAFFIC_REPLAY); };
      s.onerror = function () { ok(null); };
      document.head.appendChild(s);
    }
    if (/^https?:$/.test(location.protocol)) fetch('server/traffic-replay.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d) ok(d); else viaScript(); }).catch(viaScript);
    else viaScript();
  }
  function feed(onPacket, onMode) {
    var es = null, quiet = null, firstTimer = null, replayTimer = null, stopped = false;
    function stopAll() {
      if (es) { es.close(); es = null; }
      clearTimeout(quiet); clearTimeout(firstTimer); clearInterval(replayTimer);
    }
    function toReplay(why) {
      stopAll();
      if (stopped) return;
      loadReplay(function (d) {
        if (stopped) return;
        if (!d) { onMode('sim', why + ' No recording found.'); return; }
        onMode('replay', d.recorded, why);
        var start = performance.now() / 1000, i = 0, dur = d.seconds || (d.packets[d.packets.length - 1].t + 1);
        replayTimer = setInterval(function () {
          var t = performance.now() / 1000 - start;
          if (t >= dur) { start += dur; t -= dur; i = 0; }
          while (i < d.packets.length && d.packets[i].t <= t) onPacket(d.packets[i++]);
        }, 50);
      });
    }
    function live() {
      if (!window.EventSource) return toReplay('Live needs EventSource.');
      try { es = new EventSource(LIVE_URL); } catch (e) { return toReplay('Live helper not running.'); }
      var alive = false;
      firstTimer = setTimeout(function () { if (!alive) toReplay('Live helper not running.'); }, 1000);
      es.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (err) { return; }
        if (!alive) { alive = true; clearTimeout(firstTimer); onMode('live', 0); }
        clearTimeout(quiet);
        quiet = setTimeout(function () { toReplay('Live stream went quiet.'); }, 3000);
        if (m.k === 'rate') onMode('live', m.pps);
        else if (m.k === 'p') onPacket(m);
      };
      es.onerror = function () { if (!alive) { clearTimeout(firstTimer); toReplay('Live helper not running.'); } };
    }
    live();
    return { stop: function () { stopped = true; stopAll(); } };
  }

  CN.road = { create: create, feed: feed, PERIOD: PERIOD };
})();
