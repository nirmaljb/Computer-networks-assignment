/* Traffic road for S20 (SPEC-v4 §5): a three.js scene with a sender town, a bottleneck toll
   booth and a receiver. SIM mode draws one round of CN.tcp.road() per call; LIVE / RECORDED
   modes draw one vehicle per packet summary { proto, payload, dir } (never an address or port).
   three.js (vendored r160) is loaded on demand; without it or without WebGL, create() fails
   and the screen shows the graph alone. Vehicles are told apart by shape, colour second. */
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
  var LEGEND = [['truck', 'Truck', 'TCP data'], ['car', 'Car', 'TCP control: ACK, SYN, FIN, RST'], ['van', 'Van', 'UDP (mostly DNS)'], ['bus', 'Bus', 'QUIC (HTTP/3)'], ['wreck', 'Wreck', 'dropped at the full queue']];

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

  function build(T, renderer, host, opts) {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    var wrap = h('div', { class: 'road-wrap', style: { width: '100%', height: '100%' } });
    var badge = h('div', { class: 'road-badge' }, 'SIMULATION');
    var hud = h('div', { class: 'road-note', style: { top: '10px', bottom: 'auto', left: 'auto', right: '10px' } });
    var note = h('div', { class: 'road-note', style: { top: '44px', bottom: 'auto' } });
    var legend = h('div', { class: 'road-legend' });
    var labels = { src: h('div', { class: 'road-note', style: { bottom: 'auto' } }), booth: h('div', { class: 'road-note', style: { bottom: 'auto' } }), dst: h('div', { class: 'road-note', style: { bottom: 'auto' } }) };
    wrap.appendChild(renderer.domElement);
    [badge, hud, note, legend, labels.src, labels.booth, labels.dst].forEach(function (e) { wrap.appendChild(e); });
    host.appendChild(wrap);

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(0, 17, 16); camera.lookAt(0, 0, 0.6);
    scene.add(new T.HemisphereLight(0xffffff, 0x666666, 2.2));
    var sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(-6, 14, 8); scene.add(sun);

    var mats = {};
    function mat(key) { return mats[key] || (mats[key] = new T.MeshLambertMaterial({ color: 0x888888 })); }
    // ground, road, lane line, towns, booth
    var ground = new T.Mesh(new T.PlaneGeometry(60, 30), mat('ground')); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
    var road = new T.Mesh(new T.PlaneGeometry(X1 - X0 + 2, 3.4), mat('road')); road.rotation.x = -Math.PI / 2; scene.add(road);
    var line = new T.Mesh(new T.PlaneGeometry(X1 - X0 + 2, 0.08), mat('lane')); line.rotation.x = -Math.PI / 2; line.position.y = 0.01; scene.add(line);
    function town(x, key) {
      var g = new T.Group();
      [[0, 0, 1.2, 1.6], [1.1, 0.8, 0.9, 1.1], [-0.9, -1.1, 1.0, 0.9], [0.4, -2.0, 0.8, 1.3], [-0.6, 1.6, 0.9, 1.0]].forEach(function (b) {
        var m = new T.Mesh(new T.BoxGeometry(b[2], b[3], b[2]), mat(key)); m.position.set(b[0], b[3] / 2, b[1] + (b[1] > 0 ? 1.4 : -1.4)); g.add(m);
      });
      g.position.x = x; scene.add(g);
    }
    town(X0 - 1.6, 'town'); town(X1 + 1.6, 'town');
    var booth = new T.Group();
    var roof = new T.Mesh(new T.BoxGeometry(0.9, 0.15, 4.2), mat('booth')); roof.position.y = 1.4; booth.add(roof);
    [-1.9, 1.9].forEach(function (z) { var p = new T.Mesh(new T.BoxGeometry(0.25, 1.4, 0.25), mat('booth')); p.position.set(0, 0.7, z); booth.add(p); });
    var bar = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 1.5), mat('bar')); bar.position.set(-0.4, 0.6, 0.95); booth.add(bar);
    booth.position.x = BOOTH; scene.add(booth);
    var queueZone = new T.Mesh(new T.PlaneGeometry(3 * ROW, 1.5), mat('queue')); queueZone.rotation.x = -Math.PI / 2; queueZone.position.set(BOOTH - 0.35 - 1.5 * ROW, 0.012, 0.95); scene.add(queueZone);

    // instanced vehicles: each kind is one or two box parts (shape is the main cue)
    // [length, height, width, x offset, y centre]
    var KINDS = {
      truck: [[0.5, 0.3, 0.36, -0.06, 0.2], [0.18, 0.26, 0.34, 0.28, 0.18]],  // trailer + cab in front
      car: [[0.36, 0.12, 0.26, 0, 0.1], [0.18, 0.1, 0.22, -0.03, 0.21]],      // low body + cabin
      van: [[0.4, 0.36, 0.3, 0, 0.23]],                                       // one tall box
      bus: [[0.9, 0.34, 0.32, 0, 0.22], [0.82, 0.06, 0.33, 0, 0.24]],         // long, with a window band
      wreck: [[0.5, 0.2, 0.36, -0.06, 0.1], [0.18, 0.2, 0.34, 0.26, 0.1]]
    };
    var meshes = {};
    Object.keys(KINDS).forEach(function (k) {
      meshes[k] = KINDS[k].map(function (p, i) {
        var m = new T.InstancedMesh(new T.BoxGeometry(p[0], p[1], p[2]), mat(k + (i === 1 && k === 'bus' ? '2' : '')), MAX);
        m.count = 0; m.frustumCulled = false; scene.add(m); return m;
      });
    });

    function applyTheme() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      scene.background = new T.Color(cssVar('--panel2'));
      var c = {
        ground: dark ? '#20252c' : '#dfe3d6', road: dark ? '#3a4049' : '#9aa0a8', lane: '#f2f2f2', town: dark ? '#4b5563' : '#c9ccd2',
        booth: cssVar('--accent'), bar: cssVar('--red'), queue: dark ? '#4a3a1a' : '#f4d9a4',
        truck: cssVar('--blue'), car: cssVar('--green'), van: cssVar('--amber'), bus: cssVar('--accent'), bus2: dark ? '#e9ebee' : '#ffffff', wreck: cssVar('--red')
      };
      Object.keys(c).forEach(function (k) { mat(k).color.set(c[k]); });
      // legend swatches follow the theme too
      CN.clear(legend);
      LEGEND.forEach(function (l) {
        legend.appendChild(h('span', { style: { display: 'inline-block', width: l[0] === 'bus' ? '30px' : l[0] === 'car' ? '16px' : '22px', height: l[0] === 'van' ? '14px' : '10px', background: c[l[0]], borderRadius: '2px' } }));
        legend.appendChild(h('span', null, h('b', null, l[1]), ' ' + l[2]));
      });
    }
    var themeNow = null;

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
      setHud('cwnd ' + n + ' · served ' + r.served + ' · queued ' + r.queued + (r.dropped ? ' · wrecked ' + r.dropped : ''));
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
      // back the camera off until both towns (x = ±14) fit the view's width, along a fixed ¾ direction
      var hfov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      var dist = Math.max(14 / Math.tan(hfov / 2), 20);
      camera.position.set(0, dist * 0.70, dist * 0.72);
      camera.lookAt(0, 0, 0.3);
      camera.updateProjectionMatrix();
    }
    function place(el, x, z, dy) {
      pos.set(x, 0, z).project(camera);
      el.style.left = Math.max(4, Math.min(w - el.offsetWidth - 4, (pos.x + 1) / 2 * w - el.offsetWidth / 2)) + 'px';
      el.style.top = ((1 - pos.y) / 2 * hgt + (dy || 0)) + 'px';
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.25, (now - last) / 1000); last = now; clock += dt;
      var th = document.documentElement.getAttribute('data-theme');
      if (th !== themeNow) { themeNow = th; applyTheme(); }
      resize();
      var counts = {};
      Object.keys(meshes).forEach(function (k) { counts[k] = 0; });
      cars = cars.filter(function (v) {
        var p = v.path(clock);
        if (p.gone) return false;
        if (p.wait) return true;
        var kind = p.wreck ? 'wreck' : v.kind, i = counts[kind];
        if (i >= MAX) return true;
        counts[kind]++;
        e.set(0, v.dir > 0 ? 0 : Math.PI, p.wreck ? 0.5 : 0);
        q.setFromEuler(e);
        KINDS[kind].forEach(function (part, pi) {
          var off = part[3] * (v.dir > 0 ? 1 : -1);
          pos.set(p.x + off, part[4] - (p.sink || 0) * 0.5, v.z);
          m4.compose(pos, q, scl);
          meshes[kind][pi].setMatrixAt(i, m4);
        });
        return true;
      });
      Object.keys(meshes).forEach(function (k) { meshes[k].forEach(function (m) { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; }); });
      renderer.render(scene, camera);
      place(labels.src, X0 - 1.6, 2.6, 0); place(labels.booth, BOOTH, -2.6, -30); place(labels.dst, X1 + 1.6, 2.6, 0);
    }

    function setHud(t) { hud.textContent = t; hud.style.display = t ? '' : 'none'; }
    function setMode(mode, info) {
      badge.className = 'road-badge' + (mode === 'live' ? ' live' : mode === 'replay' ? ' rec' : '');
      badge.textContent = mode === 'live' ? 'LIVE · your laptop, right now · ' + (info || 0) + ' pkt/s' :
        mode === 'replay' ? 'RECORDED · my laptop, ' + niceDate(info) : 'SIMULATION';
      var sim = mode === 'sim';
      labels.src.textContent = sim ? 'Sender' : 'This laptop';
      labels.dst.textContent = sim ? 'Receiver' : 'The internet';
      labels.booth.textContent = sim ? 'Bottleneck router' : 'Wi-Fi link';
      queueZone.visible = bar.visible = sim;
      note.textContent = sim ? 'The router holds 39 per round trip (serves 30, queues 9)' : 'Protocol and size only: no addresses, no ports';
      if (sim && opts.capacity) note.textContent = 'The router holds ' + opts.capacity + ' per round trip (serves ' + Math.min(30, opts.capacity) + ', queues ' + Math.max(0, opts.capacity - 30) + ')';
      if (!sim) setHud('');
    }
    setMode('sim');
    raf = requestAnimationFrame(frame);

    return {
      round: round, packet: packet, clear: clear, setMode: setMode, setHud: setHud,
      setCapacity: function (c) { opts.capacity = c; setMode('sim'); },
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
