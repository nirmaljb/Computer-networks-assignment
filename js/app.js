/* Deck shell: DOM helpers, stage scaling, navigation, keys, theme,
   journey map, presenter sync. Screens register in CN.screens[id] as
   function (root) → controller { step, reset, next, prev, key, destroy }. */
(function () {
  'use strict';
  var CN = window.CN = window.CN || {};
  CN.screens = CN.screens || {};

  /* ---------------- DOM helpers ---------------- */
  function append(el, kids) {
    kids.forEach(function (k) {
      if (k == null || k === false) return;
      if (Array.isArray(k)) append(el, k);
      else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    });
  }
  function setProps(el, props, isSvg) {
    if (!props) return;
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
  }
  function h(tag, props) {
    var el = document.createElement(tag);
    setProps(el, props, false);
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, props) {
    var el = document.createElementNS(NS, tag);
    setProps(el, props, true);
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  CN.h = h; CN.s = s; CN.clear = clear;

  /* ---------------- UI kit ---------------- */
  var ui = CN.ui = {};
  ui.screen = function (root, opts) {
    var body = h('div', { class: 'scr-body' });
    // SPEC-v5: the header is the S-number and the title, nothing else
    var head = h('div', { class: 'scr-head' },
      opts.num ? h('span', { class: 'scr-num' }, 'S' + opts.num) : null,
      h('h1', { class: 'scr-title' }, opts.title));
    var el = h('div', { class: 'scr' }, head, body);
    root.appendChild(el);
    return body;
  };
  ui.btn = function (label, onClick, cls, title) {
    return h('button', { class: 'btn ' + (cls || ''), onClick: function (e) { e.currentTarget.blur(); onClick(e); }, title: title }, label);
  };
  // SPEC-v5: the only controls a sim slide shows. S and R press them from the keyboard.
  ui.controls = function (onStep, onReset) {
    return h('div', { class: 'row ctl' }, ui.btn('Step (S)', onStep, 'primary'), ui.btn('Reset (R)', onReset));
  };
  ui.store = {
    get: function (k, d) { try { var v = sessionStorage.getItem('cn.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem('cn.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ---------------- Journey map ---------------- */
  // reveal: 0 = nothing, 1 = Unit II stops, 2 = + Unit III, 3 = + Units IV–V (all). done(n), cur(n) → bool.
  // Top: Units II–III snake over three rows (as in v3). Bottom row: Units IV–V, right to left.
  var STOPS = (function () {
    var p = [];
    [230, 480, 730, 980, 1230].forEach(function (x) { p.push([x, 110]); });
    [1230, 980, 730, 480, 230].forEach(function (x) { p.push([x, 290]); });
    [230, 480, 730, 980, 1230].forEach(function (x) { p.push([x, 470]); });
    for (var i = 0; i < 10; i++) p.push([1330 - i * 120, 720]);
    return p;
  })();
  function unitOf(n) { return n <= 10 ? 1 : n <= 15 ? 2 : 3; }
  ui.map = function (opts) {
    opts = opts || {};
    var reveal = opts.reveal == null ? 3 : opts.reveal;
    var svg = s('svg', { viewBox: '0 0 1500 830', width: opts.width || 1500, height: opts.height || 830 });
    var unit2 = 'M 80 110 L 1230 110 Q 1360 110 1360 200 Q 1360 290 1230 290 L 230 290 Q 80 290 80 380';
    var unit3 = 'M 80 380 Q 80 470 230 470 L 1230 470';
    var unit45 = 'M 1230 470 Q 1420 470 1420 595 Q 1420 720 1330 720 L 100 720';
    svg.appendChild(s('path', { d: unit45, class: 'map-path' + (reveal >= 3 ? ' shown' : '') }));
    svg.appendChild(s('path', { d: unit3, class: 'map-path' + (reveal >= 2 ? ' shown' : '') }));
    svg.appendChild(s('path', { d: unit2, class: 'map-path' + (reveal >= 1 ? ' shown' : '') }));
    // start: phone with "Hi"
    svg.appendChild(s('g', { transform: 'translate(40,60)' },
      s('rect', { x: 0, y: 0, width: 60, height: 100, rx: 10, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 3 }),
      s('rect', { x: 6, y: 18, width: 48, height: 32, rx: 6, fill: 'var(--blue-bg)', stroke: 'var(--blue)', 'stroke-width': 2 }),
      s('text', { x: 30, y: 42, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, fill: 'var(--blue)' }, 'Hi')));
    function unitLabel(x, y, text, r, anchor) {
      return s('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'font-size': 24, 'font-weight': 700, fill: 'var(--muted)', opacity: reveal >= r ? 1 : 0.15 }, text);
    }
    svg.appendChild(unitLabel(230, 38, 'Unit II · The Frame: across a LAN', 1));
    // the router between units II and III
    svg.appendChild(s('g', { transform: 'translate(80,380)', opacity: reveal >= 2 ? 1 : 0.15 },
      s('circle', { r: 36, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 3 }),
      s('path', { d: 'M -18 0 H 18 M 0 -18 V 18 M 10 -8 L 18 0 L 10 8 M -10 -8 L -18 0 L -10 8', stroke: 'var(--ink)', 'stroke-width': 3, fill: 'none' }),
      s('text', { x: -36, y: 58, 'font-size': 17, 'font-weight': 700, fill: 'var(--muted)', class: 'halo' }, 'router:'),
      s('text', { x: -36, y: 78, 'font-size': 17, 'font-weight': 700, fill: 'var(--muted)', class: 'halo' }, 'frame → packet')));
    svg.appendChild(unitLabel(560, 412, 'Unit III · The Packet: across the internet', 2));
    svg.appendChild(unitLabel(1330, 628, 'Unit IV · The Segment: program to program', 3, 'end'));
    svg.appendChild(unitLabel(190, 628, 'Unit V · The Message: names, pages, secrets', 3));
    // destination server
    svg.appendChild(s('g', { transform: 'translate(28,668)', opacity: reveal >= 3 ? 1 : 0.15 },
      s('rect', { x: 0, y: 0, width: 70, height: 100, rx: 8, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 3 }),
      s('line', { x1: 12, y1: 30, x2: 58, y2: 30, stroke: 'var(--ink)', 'stroke-width': 3 }),
      s('line', { x1: 12, y1: 55, x2: 58, y2: 55, stroke: 'var(--ink)', 'stroke-width': 3 }),
      s('text', { x: 35, y: 128, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 700, fill: 'var(--muted)' }, '"Hi" ✓')));
    STOPS.forEach(function (pt, i) {
      var n = i + 1, shown = reveal >= unitOf(n);
      var cls = 'map-stop' + (shown ? ' shown' : ' hidden') + (opts.done && opts.done(n) ? ' done' : '') +
        (opts.cur && opts.cur(n) ? ' cur' : '') + (opts.onPick && shown ? ' click' : '');
      var lines = CN.content.topics[n].map.split('\n');
      var g = s('g', { class: cls, transform: 'translate(' + pt[0] + ',' + pt[1] + ')' },
        s('circle', { class: 'ring', r: 36 }),
        s('text', { class: 'n', y: 10, 'text-anchor': 'middle' }, String(n)),
        lines.map(function (l, j) { return s('text', { class: 'l', y: 64 + j * 24, 'text-anchor': 'middle' }, l); }),
        opts.done && opts.done(n) ? s('text', { x: 28, y: -24, 'font-size': 24, 'font-weight': 900, fill: 'var(--green)' }, '✓') : null);
      if (opts.onPick && shown) g.addEventListener('click', function () { opts.onPick(n); });
      if (opts.onHover && shown) {
        g.addEventListener('mouseenter', function () { opts.onHover(n); });
        g.addEventListener('mouseleave', function () { opts.onHover(null); });
      }
      svg.appendChild(g);
    });
    return svg;
  };
  // A line under the map that shows the hovered stop's Problem (SPEC-v3 §4).
  ui.mapProblem = function () {
    var line = h('div', { class: 'map-problem' });
    line.show = function (n) {
      clear(line);
      if (n == null) { line.appendChild(h('span', { class: 'muted' }, 'Hover a stop to see the problem it solves')); return; }
      line.appendChild(h('span', { class: 'pb-label' }, 'S' + n + ' · PROBLEM'));
      line.appendChild(h('span', null, CN.content.topicProblem(n)));
    };
    line.show(null);
    return line;
  };

  /* ---------------- Deck ---------------- */
  var screens, idx = 0, ctrl = null, stage, main, problem, butBar, overlay, toastEl, toastTimer, presenter = null;
  var butShown = false;
  var talkStart = null;

  CN.elapsed = function () { return talkStart ? (Date.now() - talkStart) / 1000 : 0; };
  CN.go = function (i) { go(i); };
  CN.goId = function (id) { for (var i = 0; i < screens.length; i++) if (screens[i].id === id) return go(i); };
  CN.goTopic = function (n) { for (var i = 0; i < screens.length; i++) if (screens[i].topic === n) return go(i); };
  CN.current = function () { return screens[idx]; };
  // Short message at the top of the stage (same look as the quiz toast).
  CN.toast = function (text) {
    toastEl.textContent = text;
    toastEl.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('shown'); }, 2200);
  };

  function fit() {
    var sc = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = 'translate(' + (window.innerWidth - 1600 * sc) / 2 + 'px,' + (window.innerHeight - 900 * sc) / 2 + 'px) scale(' + sc + ')';
  }

  // Problem strip (top) and But… banner (bottom, hidden until → reveals it).
  function drawStory() {
    var cur = screens[idx], nx = screens[idx + 1];
    clear(problem);
    stage.classList.toggle('has-problem', !!cur.problem);
    stage.classList.remove('problem-2l');
    if (cur.problem) {
      problem.appendChild(h('span', { class: 'pb-label' }, 'PROBLEM'));
      problem.appendChild(h('span', { class: 'pb-text' }, cur.problem));
      // still too long at 26 px: give the strip a second line instead of shrinking it
      var pt = problem.querySelector('.pb-text');
      if (pt.scrollWidth > pt.clientWidth + 1) stage.classList.add('problem-2l');
    }
    clear(butBar);
    if (cur.but) {
      butBar.appendChild(h('span', { class: 'but-label' }, cur.butLabel || 'BUT…'));
      butBar.appendChild(h('span', { class: 'but-text' }, cur.but));
      if (nx) butBar.appendChild(h('span', { class: 'but-next' }, '→ ' + CN.content.label(nx)));
    }
    butBar.classList.toggle('shown', butShown);
  }
  function setBut(v) { butShown = v; butBar.classList.toggle('shown', v); }

  function go(i) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    if (ctrl && ctrl.destroy) ctrl.destroy();
    ctrl = null;
    if (i > 0 && !talkStart) startTimer();
    idx = i;
    // a new screen starts with its But… hidden, without a slide-out of the old one
    butShown = false;
    butBar.style.transition = 'none';
    butBar.classList.remove('shown');
    void butBar.offsetHeight;
    butBar.style.transition = '';
    clear(main);
    var sc = screens[i], fn = CN.screens[sc.screen || sc.id];
    try {
      ctrl = fn ? fn(main, sc) || {} : {};
    } catch (err) {
      console.error(err);
      main.appendChild(h('div', { class: 'banner err', style: { margin: '40px' } }, 'Screen "' + sc.id + '" failed: ' + err.message));
      ctrl = {};
    }
    drawStory();
    try { history.replaceState(null, '', '#' + sc.id); } catch (e) { /* file:// in some browsers */ }
    ui.store.set('idx', i);
    post();
  }

  // → : the screen's own reveals first, then the But…, then the next screen.
  // ← : hide the But… if shown, then the screen's own steps back, then the previous screen.
  // The podium is skipped both ways when the quiz is off or nobody has scored.
  // Leaving a topic forward offers its quiz first ("Take the quiz?"); N moves on.
  function podiumOn() { return !!(CN.quiz && CN.quiz.podiumOn()); }
  function quizBusy() { return !!(CN.quiz && CN.quiz.busy()); }
  function next() {
    if (quizBusy()) return;
    if (ctrl && ctrl.next && ctrl.next()) return post();
    if (screens[idx].but && !butShown) { setBut(true); return post(); }
    var j = CN.content.stepIndex(idx, 1, podiumOn()), t = screens[idx].topic;
    if (j === idx) return;
    if (t && screens[j].topic !== t && CN.quiz && CN.quiz.offer(t, function () { go(j); })) return;
    go(j);
  }
  function prev() {
    if (quizBusy()) return;
    if (butShown) { setBut(false); return post(); }
    if (ctrl && ctrl.prev && ctrl.prev()) return post();
    var j = CN.content.stepIndex(idx, -1, podiumOn());
    if (j !== idx) go(j);
  }

  function startTimer() { talkStart = Date.now(); ui.store.set('talkStart', talkStart); post(); }
  function resetTimer() { talkStart = null; ui.store.set('talkStart', null); post(); }

  /* presenter window, synced with postMessage (works on file://) */
  function openPresenter() {
    presenter = window.open('presenter.html', 'cn-presenter', 'width=1280,height=820');
    setTimeout(post, 400);
  }
  function post() {
    if (!presenter || presenter.closed) return;
    try {
      presenter.postMessage({ type: 'cn-state', index: idx, talkStart: talkStart, butShown: butShown, sub: ctrl && ctrl.sub ? ctrl.sub() : '' }, '*');
    } catch (e) { /* window gone */ }
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'cn-hello') { presenter = e.source; post(); }
    else if (d.type === 'cn-nav') {
      if (d.dir === 'next') next(); else if (d.dir === 'prev') prev();
      else if (typeof d.index === 'number' && !quizBusy()) go(d.index);
    } else if (d.type === 'cn-timer') { if (d.action === 'start') startTimer(); else resetTimer(); }
  });

  function toggleTheme() {
    var dark = document.documentElement.getAttribute('data-theme') !== 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    ui.store.set('theme', dark ? 'dark' : 'light');
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }

  function openMap() {
    clear(overlay);
    overlay.appendChild(h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('h1', { class: 'scr-title' }, 'Journey map'),
      h('span', { class: 'muted' }, 'Click any stop to jump · Esc or M closes')));
    var cur = screens[idx].topic, line = ui.mapProblem();
    overlay.appendChild(ui.map({
      reveal: 3, cur: function (n) { return n === cur; }, height: 700, width: 1265,
      onPick: function (n) { closeMap(); CN.goTopic(n); }, onHover: line.show
    }));
    overlay.appendChild(line);
    overlay.classList.add('open');
  }
  function closeMap() { overlay.classList.remove('open'); }
  CN.openMap = openMap;

  function isTyping(t) {
    if (!t) return false;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return true;
    return t.tagName === 'INPUT' && ['range', 'checkbox', 'radio', 'button'].indexOf(t.type) < 0;
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (overlay.classList.contains('open')) {
      if (k === 'Escape' || k === 'm' || k === 'M') { closeMap(); e.preventDefault(); }
      return;
    }
    if (isTyping(e.target)) return;
    // Units IV–V have no quiz (SPEC-v4 §1): Z only says so, whether or not the quiz server is up.
    if ((k === 'z' || k === 'Z') && !quizBusy() && screens[idx].topic > 15) { CN.toast('No quiz for this unit'); e.preventDefault(); return; }
    // Live quiz: J sidebar, Z quiz; while its prompt or overlay is up it takes every key (→ ← included).
    if (CN.quiz && CN.quiz.key(e)) { e.preventDefault(); return; }
    if (ctrl && ctrl.key && ctrl.key(e)) { e.preventDefault(); return; }
    var handled = true;
    switch (k) {
      case 'ArrowRight': case 'PageDown': next(); break;
      case 'ArrowLeft': case 'PageUp': prev(); break;
      case 'Home': go(0); break;
      case 'End': go(screens.length - 1); break;
      case 'm': case 'M': openMap(); break;
      case 'p': case 'P': openPresenter(); break;
      case 't': case 'T': toggleTheme(); break;
      case 'f': case 'F': toggleFull(); break;
      case 's': case 'S': if (ctrl && ctrl.step) ctrl.step(); post(); break;
      case 'r': case 'R': if (ctrl && ctrl.reset) ctrl.reset(); post(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  function init() {
    screens = CN.content.screens;
    stage = document.getElementById('stage');
    problem = h('div', { id: 'problem' });
    main = h('div', { id: 'main' });
    butBar = h('div', { id: 'but' });
    overlay = h('div', { id: 'overlay' });
    toastEl = h('div', { class: 'qz-toast' });
    append(stage, [problem, main, butBar, overlay, toastEl]);
    document.title = CN.content.deckTitle;
    document.documentElement.setAttribute('data-theme', ui.store.get('theme', 'light'));
    talkStart = ui.store.get('talkStart', null);
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    fit();
    var start = 0, hash = (location.hash || '').slice(1);
    if (hash) screens.forEach(function (sc, i) { if (sc.id === hash) start = i; });
    go(start);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
