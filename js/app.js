/* Deck shell: DOM helpers, stage scaling, navigation, keys, theme,
   journey map, presenter sync, the learn pane (L) and its search (/). Screens register in CN.screens[id] as
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
  // The only controls a sim slide shows: Back, Step, Run, Reset. They drive the screen's controller
  // through the deck (sim* below), so the keys do the same: ← Back, S Step, Space Run, R Reset.
  ui.controls = function () {
    return h('div', { class: 'row ctl' },
      ui.btn('◀ Back', function () { simBack(); }, 'ctl-back'),
      ui.btn('Step (S)', function () { simStep(); }, 'primary'),
      ui.btn('Run', function () { simRun(); }, 'ctl-run'),
      ui.btn('Reset (R)', function () { simReset(); }));
  };
  // SPEC-v6 E: what a screen returns as ctrl.input. parse(text) → { error } or a value; use(value) restarts
  // the sim with it, use(null) with the slide's own example. The input box itself lives in the shell.
  ui.numbers = function (o) {
    var cur = null;
    return {
      label: o.label,
      value: function () { return cur != null ? cur : o.example; },
      custom: function () { return cur != null; },
      clear: function () { cur = null; o.use(null); },
      apply: function (text) {
        var v = o.parse(String(text));
        if (!v || v.error) return { error: (v && v.error) || 'Not understood' };
        cur = String(text).trim(); o.use(v);
        return {};
      }
    };
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
  var einBox, einField, einErr, einLabel, einTitle, predict = null, motion = true;

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

  // With L on, the slide fits the window left of the learn pane.
  function fit() {
    var pw = learn.on ? lnPaneWidth() : 0, W = window.innerWidth - pw;
    if (lnPane) lnPane.style.width = pw + 'px';
    var sc = Math.min(W / 1600, window.innerHeight / 900);
    stage.style.transform = 'translate(' + (W - 1600 * sc) / 2 + 'px,' + (window.innerHeight - 900 * sc) / 2 + 'px) scale(' + sc + ')';
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

  /* Sim controls. trail = the moves since Reset, each 'step' or 'run' (a screen may give Run a finer
     move, ctrl.runStep, e.g. one tick where Step jumps to the next event). Back uses the screen's own
     prev() when it has one and the last move was a Step; otherwise it resets and replays the trail minus
     its last move (every sim is scripted or seeded, so the replay lands on the previous state; clicks on
     the diagram since Reset are not replayed). Run repeats its move every ctrl.runMs (default 800 ms)
     until the move returns false. */
  var trail = [], runTimer = null;
  function ctlButtons() {
    var back = main.querySelector('.ctl-back'), run = main.querySelector('.ctl-run');
    if (back) back.disabled = !trail.length;
    if (run) run.textContent = runTimer ? 'Pause' : 'Run';
  }
  function stopRun() { clearInterval(runTimer); runTimer = null; ctlButtons(); }
  function move(kind) {
    var fn = ctrl && (kind === 'run' && ctrl.runStep ? ctrl.runStep : ctrl.step);
    if (!fn || fn() === false) { predictCheck(true); return false; }
    trail.push(kind);
    if (predictCheck(false) && kind === 'run') { stopRun(); return false; }
    return true;
  }
  function simStep() { stopRun(); move('step'); ctlButtons(); post(); }
  // R also drops numbers typed with E (SPEC-v6): the slide goes back to its fixed example.
  function simReset() {
    stopRun();
    if (ctrl && ctrl.input && ctrl.input.custom()) { ctrl.input.clear(); customTag(false); }
    else if (ctrl && ctrl.reset) ctrl.reset();
    trail = [];
    if (predict) { predict.revealed = false; drawPredict(); }
    ctlButtons(); post();
  }
  function simBack() {
    stopRun();
    if (!trail.length) return false;
    var last = trail.pop();
    if (ctrl.prev && !(last === 'run' && ctrl.runStep)) ctrl.prev();
    else {
      ctrl.reset();
      trail.forEach(function (k) { (k === 'run' && ctrl.runStep ? ctrl.runStep : ctrl.step)(); });
    }
    ctlButtons(); post();
    return true;
  }
  function simRun() {
    if (runTimer) return stopRun();
    if (!move('run')) return ctlButtons();
    runTimer = setInterval(function () { if (!move('run')) stopRun(); else ctlButtons(); post(); }, (ctrl && ctrl.runMs) || 800);
    ctlButtons();
  }

  /* ---------------- SPEC-v6: E your numbers, ? predict, A motion ---------------- */
  // E: one input, built here and not in the screens (the v5 guard on screens still holds). A screen that
  // takes numbers gives ctrl.input = { label, value(), apply(text) → { error } | {}, custom(), clear() }.
  // Enter applies (the sim restarts with them); a refusal shows its reason and changes nothing.
  function buildInput() {
    einTitle = h('div', { class: 'ein-title' });
    einLabel = h('div', { class: 'ein-label' });
    einField = h('input', { class: 'ein-field', type: 'text', spellcheck: 'false', autocomplete: 'off' });
    einErr = h('div', { class: 'ein-err' });
    einBox = h('div', { class: 'ein' }, h('div', { class: 'ein-box' }, einTitle, einLabel, einField, einErr,
      h('div', { class: 'ein-hint' }, 'Enter uses them · Esc cancels · R or leaving the slide brings back the example')));
    einField.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); applyInput(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeInput(); }
    });
    einField.addEventListener('input', function () { einErr.textContent = ''; });
    return einBox;
  }
  function openInput() {
    if (!ctrl || !ctrl.input) { CN.toast('No numbers to change on this slide'); return; }
    stopRun();
    einTitle.textContent = 'Your numbers · S' + screens[idx].stop;
    einLabel.textContent = ctrl.input.label;
    einField.value = ctrl.input.value();
    einErr.textContent = '';
    einBox.classList.add('open');
    einField.focus(); einField.select();
  }
  function closeInput() { einBox.classList.remove('open'); einField.blur(); }
  function inputOpen() { return einBox.classList.contains('open'); }
  function applyInput() {
    var r = ctrl.input.apply(einField.value) || {};
    if (r.error) { einErr.textContent = '✕ ' + r.error; return; }
    closeInput();
    trail = [];
    if (predict) endPredict();
    customTag(ctrl.input.custom());
    ctlButtons(); post();
  }
  function customTag(on) {
    var head = main.querySelector('.scr-head'), tag = main.querySelector('.custom-tag');
    if (tag) tag.remove();
    if (on && head) head.appendChild(h('span', { class: 'custom-tag' }, 'your numbers'));
  }

  // ?: the slide's caption becomes one question (content.js `predict`); the answer shows, marked, when the
  // sim reaches the point that settles it (ctrl.reached(), else the end of the run). Run pauses there.
  function captionEl() { return main.querySelector('.scr-body > .say'); }
  function startPredict() {
    var p = screens[idx].predict;
    if (!p) { CN.toast('No prediction on this slide'); return; }
    if (predict) { endPredict(); return; }
    simReset();
    var cap = captionEl();
    if (!cap) { cap = h('div', { class: 'say' }); main.querySelector('.scr-body').insertBefore(cap, main.querySelector('.scr-body').firstChild); }
    predict = { q: p.q, a: p.a, revealed: false, cap: cap, old: Array.prototype.slice.call(cap.childNodes) };
    drawPredict();
  }
  function drawPredict() {
    var cap = predict.cap;
    clear(cap);
    cap.classList.add('predict');
    cap.classList.toggle('answered', predict.revealed);
    cap.appendChild(h('span', { class: 'pd-label' }, 'PREDICT'));
    cap.appendChild(h('span', null, predict.q));
    if (predict.revealed) cap.appendChild(h('span', { class: 'pd-answer' }, '✓ ' + predict.a));
    else cap.appendChild(h('span', { class: 'pd-hint' }, ' · Run to see'));
  }
  function endPredict() {
    if (!predict) return;
    var cap = predict.cap;
    clear(cap); cap.classList.remove('predict', 'answered');
    append(cap, predict.old);
    predict = null;
  }
  // After a move: true when this move revealed the answer. ended = the sim had nothing left to do.
  function predictCheck(ended) {
    if (!predict || predict.revealed) return false;
    if (!(ctrl && ctrl.reached ? ctrl.reached() : ended)) return false;
    predict.revealed = true;
    drawPredict();
    return true;
  }

  // A: motion on/off. Starts off when the OS asks for reduced motion. Only animation durations change:
  // every screen draws the same state either way, and CN.motion() only picks a duration.
  CN.motion = function () { return motion; };
  function setMotion(on, quiet) {
    motion = on;
    document.documentElement.setAttribute('data-motion', on ? 'on' : 'off');
    ui.store.set('motion', on);
    if (!quiet) CN.toast(on ? 'Motion on' : 'Motion off');
  }

  /* ---------------- SPEC-v7: L learn pane, / search ---------------- */
  // L splits the window: the slide (scaled, still live) on the left, the learn page of the current stop on the
  // right (CN.learn, built from LEARN.md by tools/learn-build.mjs). The pane follows → ←, opens at the sub-slide's
  // section, lights the row for a ★ sim's learnStep(), and on an E slide swaps in tables built from the typed
  // numbers (CN.learnGen). It only reads the screen's controller: the sims run the same with L on or off.
  var learn = { on: false, page: -1, primer: null, hit: null, hlKey: null, genKey: null, size: 18 };
  var lnPane, lnHead, lnNote, lnScroll, lnFind, lnFindField, lnFindList, lnFound = [], lnSel = 0;
  var LN_MIN = 13, LN_MAX = 30;

  function lnStore(k, v) {
    try { if (arguments.length > 1) localStorage.setItem('cn.' + k, JSON.stringify(v)); else return JSON.parse(localStorage.getItem('cn.' + k)); }
    catch (e) { return null; }
  }
  // [tag, attrs | 0, ...children] → DOM (the build never emits HTML strings)
  function lnNode(n) {
    if (typeof n === 'string') return document.createTextNode(n);
    var el = h(n[0], n[1] || null);
    for (var i = 2; i < n.length; i++) el.appendChild(lnNode(n[i]));
    return el;
  }
  function lnSubOf(sc) { return sc.stop || sc.id; }
  function lnPaneWidth() { return Math.round(Math.min(Math.max(380, window.innerWidth * 0.4), window.innerWidth - 320)); }

  function buildLearn() {
    lnHead = h('div', { class: 'ln-head' });
    lnNote = h('div', { class: 'ln-note' });
    lnScroll = h('div', { class: 'ln-scroll' });
    lnFindField = h('input', { class: 'ln-find-field', type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: 'Search every stop, primer and Q&A' });
    lnFindList = h('div', { class: 'ln-find-list' });
    lnFind = h('div', { class: 'ln-find' }, lnFindField, lnFindList,
      h('div', { class: 'ln-find-hint' }, '↑ ↓ choose · Enter shows it here (the slide stays) · Esc closes'));
    lnFindField.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (lnFound[lnSel]) showHit(lnFound[lnSel]); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); lnSel = Math.max(0, Math.min(lnFound.length - 1, lnSel + (e.key === 'ArrowDown' ? 1 : -1))); drawFind(); }
    });
    lnFindField.addEventListener('input', function () { lnSel = 0; drawFind(); });
    lnPane = h('aside', { id: 'learn', 'aria-label': 'Learn' }, lnHead, lnFind, lnNote, lnScroll);
    lnPane.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'back') { learn.hit = null; learn.primer = null; showSlide(true); }
      else if (act === 'goto') gotoHit();
      else if (act === 'chip') toggleChip(t);
    });
    var sz = lnStore('learnSize');
    learn.size = typeof sz === 'number' && sz >= LN_MIN && sz <= LN_MAX ? sz : 18;
    lnPane.style.setProperty('--ln-size', learn.size + 'px');
    return lnPane;
  }

  function toggleLearn() {
    if (quizBusy()) return;
    if (!CN.learn) { CN.toast('The learn pages are not built (node tools/learn-build.mjs)'); return; }
    learn.on = !learn.on;
    if (learn.on && CN.quiz && CN.quiz.closeSide) CN.quiz.closeSide();
    document.body.classList.toggle('learn-on', learn.on);
    if (!learn.on) closeFind();
    learn.hit = null; learn.primer = null; learn.page = -1;
    fit();
    if (learn.on) showSlide(false);
  }
  CN.learnOn = function () { return learn.on; };

  // The pane follows the deck: the current stop's page, scrolled to this sub-slide's section.
  function showSlide(smooth) {
    if (!learn.on) return;
    var at = CN.learn.subs[lnSubOf(screens[idx])];
    learn.hit = null; learn.primer = null;
    if (!at) { renderEmpty(); return; }
    var same = learn.page === at.page;
    if (!same) renderPage(at.page);
    drawHead();
    learn.hlKey = null; learn.genKey = null;
    learnRefresh();
    scrollToAnchor(at.anchor, smooth && same);
  }
  function scrollToAnchor(id, smooth) {
    var el = id && lnScroll.querySelector('#' + id);
    if (!el) return;
    // measured, not offsetTop: a table row's offsetParent is its table
    var top = lnScroll.scrollTop + el.getBoundingClientRect().top - lnScroll.getBoundingClientRect().top - 8;
    if (smooth && lnScroll.scrollTo) lnScroll.scrollTo({ top: top, behavior: 'smooth' });
    else lnScroll.scrollTop = top;
  }
  function renderEmpty() {
    learn.page = -1;
    clear(lnScroll).appendChild(h('p', { class: 'ln-empty' }, 'No learn page for this slide.'));
    drawHead();
  }
  function renderPage(p) {
    var pg = CN.learn.pages[p];
    learn.page = p;
    clear(lnScroll);
    lnScroll.appendChild(h('h2', { class: 'ln-title' }, pg.topic ? 'Stop ' + pg.topic + ' · ' + pg.title : pg.title));
    if (pg.needs.length) {
      lnScroll.appendChild(h('div', { class: 'ln-needs' }, h('span', { class: 'ln-needs-label' }, 'You\'ll need:'),
        pg.needs.map(function (id) {
          var pr = CN.learn.primers[id];
          return h('button', { class: 'ln-chip', 'data-act': 'chip', 'data-primer': id }, pr ? pr.title : id);
        })));
      lnScroll.appendChild(h('div', { class: 'ln-primers' }));
    }
    pg.body.forEach(function (n) { lnScroll.appendChild(lnNode(n)); });
    lnScroll.scrollTop = 0;
  }
  // A chip opens its primer in place, under the chips; a second click closes it.
  function toggleChip(chip) {
    var id = chip.getAttribute('data-primer'), box = lnScroll.querySelector('.ln-primers'), open = box.querySelector('[data-primer="' + id + '"]');
    if (open) { open.remove(); chip.classList.remove('on'); return; }
    var pr = CN.learn.primers[id];
    if (!pr) return;
    var card = h('div', { class: 'ln-primer', 'data-primer': id }, h('div', { class: 'ln-primer-title' }, pr.title));
    pr.body.forEach(function (n) { card.appendChild(lnNode(n)); });
    box.appendChild(card);
    chip.classList.add('on');
  }
  function drawHead() {
    clear(lnHead);
    var sc = screens[idx], here = sc.stop ? 'S' + sc.stop : sc.title;
    if (learn.hit) {
      var e = learn.hit, label = e.kind === 'primer' ? 'Basics' : lnPageLabel(e.page);
      lnHead.appendChild(h('div', { class: 'ln-kicker' }, 'FOUND · ' + label));
      lnHead.appendChild(h('div', { class: 'ln-actions' },
        e.kind === 'primer' ? null : h('button', { class: 'ln-act', 'data-act': 'goto' }, 'Go to slide'),
        h('button', { class: 'ln-act', 'data-act': 'back' }, 'Back to ' + here)));
    } else lnHead.appendChild(h('div', { class: 'ln-kicker' }, 'LEARN · ' + here));
    lnHead.appendChild(h('div', { class: 'ln-keys' }, '↑ ↓ scroll · = − size · / search · L close'));
  }
  function lnPageLabel(p) { var pg = CN.learn.pages[p]; return pg ? (pg.topic ? 'S' + pg.topic : pg.title) : ''; }

  // After every move (post): light the rows for the sim's learnStep(), swap E tables, show the E note.
  function learnRefresh() {
    if (!learn.on || learn.hit || learn.page < 0) return;
    var sub = lnSubOf(screens[idx]);
    var step = ctrl && ctrl.learnStep ? ctrl.learnStep() : null;
    var custom = ctrl && ctrl.input && ctrl.input.custom() ? ctrl.input.value() : null;
    var gk = sub + '|' + (custom == null ? '' : custom);
    if (gk !== learn.genKey) { learn.genKey = gk; swapGen(sub, custom); learn.hlKey = null; }
    clear(lnNote);
    lnNote.classList.toggle('shown', custom != null);
    if (custom != null) lnNote.appendChild(document.createTextNode('Your numbers (E): ' + custom + '. Tables marked ✎ use them; the text still describes the slide\'s own example.'));
    var key = step == null ? null : sub + ':' + step;
    if (key === learn.hlKey) return;
    learn.hlKey = key;
    var first = null;
    Array.prototype.forEach.call(lnScroll.querySelectorAll('[data-hl]'), function (el) {
      var on = key != null && (' ' + el.getAttribute('data-hl') + ' ').indexOf(' ' + key + ' ') >= 0;
      el.classList.toggle('ln-hl', on);
      if (on && !first) first = el;
    });
    if (first) reveal(lnScroll, first, motion);
  }
  // Scroll box (vertically only) so el is in view; scrollIntoView would also move the page and scroll sideways.
  function reveal(box, el, smooth) {
    var b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    var top = box.scrollTop + r.top - b.top - (box === lnScroll ? b.height / 3 : 8);
    if (smooth && box.scrollTo) box.scrollTo({ top: top, behavior: 'smooth' });
    else box.scrollTop = top;
  }
  function swapGen(sub, custom) {
    Array.prototype.forEach.call(lnScroll.querySelectorAll('.ln-gen'), function (box) {
      if (!box.orig) box.orig = Array.prototype.slice.call(box.childNodes);
      clear(box);
      box.classList.remove('custom');
      if (custom == null || box.getAttribute('data-sub') !== sub) { append(box, box.orig); return; }
      var t = CN.learnGen(box.getAttribute('data-gen'), custom);
      box.classList.add('custom');
      if (t.error) { box.appendChild(h('div', { class: 'ln-gen-tag' }, '✎ your numbers: ' + t.error)); return; }
      box.appendChild(h('div', { class: 'ln-gen-tag' }, '✎ your numbers: ' + custom));
      box.appendChild(h('div', { class: 'ln-tw' }, h('table', { class: 'ln-table' },
        h('thead', null, h('tr', null, t.head.map(function (c) { return h('th', null, c); }))),
        h('tbody', null, t.rows.map(function (r) {
          return h('tr', r.step == null ? null : { 'data-hl': sub + ':' + r.step }, r.cells.map(function (c) { return h('td', null, c); }));
        })))));
    });
  }

  function scrollLearn(dir) {
    var dy = dir * Math.round(lnScroll.clientHeight * 0.3 || 200);
    if (lnScroll.scrollBy) lnScroll.scrollBy({ top: dy, behavior: motion ? 'smooth' : 'auto' });
    else lnScroll.scrollTop += dy;
  }
  function sizeLearn(d) {
    learn.size = Math.max(LN_MIN, Math.min(LN_MAX, learn.size + d));
    lnPane.style.setProperty('--ln-size', learn.size + 'px');
    lnStore('learnSize', learn.size);
    CN.toast('Learn text ' + learn.size + ' px');
  }

  // / search: every section, primer and Q&A row of every page. Every word must appear; title hits rank first.
  CN.learnFind = function (q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !CN.learn) return [];
    var out = [];
    CN.learn.index.forEach(function (e, i) {
      var title = e.title.toLowerCase(), hay = title + ' ' + e.text.toLowerCase(), score = 0;
      for (var k = 0; k < words.length; k++) {
        if (hay.indexOf(words[k]) < 0) return;
        score += title.indexOf(words[k]) >= 0 ? 10 : 1;
      }
      out.push({ e: e, score: score + (e.kind === 'qa' ? 2 : 0), i: i });
    });
    out.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    return out.slice(0, 30).map(function (x) { return x.e; });
  };
  function openFind() {
    if (quizBusy()) return;
    if (!learn.on) toggleLearn();
    if (!learn.on) return;
    lnFind.classList.add('open');
    lnFindField.focus(); lnFindField.select();
    drawFind();
  }
  function closeFind() { lnFind.classList.remove('open'); lnFindField.blur(); }
  function findOpen() { return lnFind && lnFind.classList.contains('open'); }
  function drawFind() {
    lnFound = CN.learnFind(lnFindField.value);
    clear(lnFindList);
    if (lnFindField.value.trim() && !lnFound.length) lnFindList.appendChild(h('div', { class: 'ln-find-none' }, 'Nothing matches every word.'));
    lnFound.forEach(function (e, i) {
      var words = lnFindField.value.toLowerCase().split(/\s+/).filter(Boolean), at = -1;
      words.some(function (w) { at = e.text.toLowerCase().indexOf(w); return at >= 0; });
      var snip = at < 0 ? e.text.slice(0, 110) : (at > 40 ? '…' : '') + e.text.slice(Math.max(0, at - 40), at + 80);
      var item = h('div', { class: 'ln-find-item' + (i === lnSel ? ' sel' : '') },
        h('span', { class: 'ln-find-kind' }, e.kind === 'qa' ? 'Q&A' : e.kind === 'primer' ? 'Basics' : 'Section'),
        h('span', { class: 'ln-find-where' }, e.kind === 'primer' ? '' : lnPageLabel(e.page)),
        h('div', { class: 'ln-find-title' }, e.title), h('div', { class: 'ln-find-snip' }, snip));
      item.addEventListener('click', function () { showHit(e); });
      lnFindList.appendChild(item);
    });
    var sel = lnFindList.querySelector('.sel');
    if (sel) reveal(lnFindList, sel, false);
  }
  // Enter: show the hit in the pane. The deck stays where it is; "Go to slide" moves it too.
  function showHit(e) {
    closeFind();
    learn.hit = e; learn.hlKey = null; learn.genKey = null;
    clear(lnNote); lnNote.classList.remove('shown');
    if (e.kind === 'primer') {
      var pr = CN.learn.primers[e.primer];
      learn.page = -1; learn.primer = e.primer;
      clear(lnScroll).appendChild(h('h2', { class: 'ln-title' }, pr.title));
      pr.body.forEach(function (n) { lnScroll.appendChild(lnNode(n)); });
      lnScroll.scrollTop = 0;
    } else {
      if (learn.page !== e.page) renderPage(e.page);
      Array.prototype.forEach.call(lnScroll.querySelectorAll('.ln-hl'), function (el) { el.classList.remove('ln-hl'); });
      scrollToAnchor(e.anchor, false);
      var el = lnScroll.querySelector('#' + e.anchor);
      if (el) { el.classList.remove('ln-flash'); void el.offsetWidth; el.classList.add('ln-flash'); }
    }
    drawHead();
  }
  function gotoHit() {
    var e = learn.hit;
    if (!e || e.kind === 'primer' || quizBusy()) return;
    var pg = CN.learn.pages[e.page], target = -1;
    screens.forEach(function (sc, i) { if (target < 0 && e.sub && lnSubOf(sc) === e.sub) target = i; });
    if (target < 0) screens.forEach(function (sc, i) { if (target < 0 && pg.topic && sc.topic === pg.topic) target = i; });
    if (target < 0) return;
    var anchor = e.anchor;
    go(target);
    scrollToAnchor(anchor, false);
  }

  // The But… text glides up into the next slide's Problem strip (it is the same problem, restated).
  function morphBut(from) {
    if (!motion || !from || !screens[idx].problem) return;
    var ghost = h('div', { class: 'but-ghost' }, from.text);
    stage.appendChild(ghost);
    var a = ghost.animate([
      { top: from.top + 'px', height: from.height + 'px', fontSize: '30px', opacity: 1 },
      { top: '0px', height: '50px', fontSize: '26px', opacity: 0 }
    ], { duration: 600, easing: 'ease-in-out' });
    a.onfinish = function () { ghost.remove(); };
    setTimeout(function () { ghost.remove(); }, 700);   // a throttled background tab may never finish it
    var pt = problem.querySelector('.pb-text');
    if (pt) pt.animate([{ opacity: 0 }, { opacity: 0 , offset: 0.5 }, { opacity: 1 }], { duration: 600 });
  }

  function go(i) {
    i = Math.max(0, Math.min(screens.length - 1, i));
    stopRun(); trail = [];
    if (einBox) closeInput();
    predict = null;
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
    ctlButtons();
    if (learn.on) showSlide(true);
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
    var from = butShown && screens[idx].but ? { text: screens[idx].but, top: butBar.offsetTop, height: butBar.offsetHeight } : null;
    function on() { go(j); morphBut(from); }
    if (t && screens[j].topic !== t && CN.quiz && CN.quiz.offer(t, function () { go(j); })) return;
    on();
  }
  function prev() {
    if (quizBusy()) return;
    if (butShown) { setBut(false); return post(); }
    if (simBack()) return;
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
    learnRefresh();
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
    if (inputOpen()) { if (k === 'Escape') closeInput(); return; }
    if (findOpen() && k === 'Escape') { closeFind(); e.preventDefault(); return; }
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
      case 's': case 'S': simStep(); break;
      case 'r': case 'R': simReset(); break;
      case 'e': case 'E': openInput(); break;
      case '?': startPredict(); break;
      case 'a': case 'A': setMotion(!motion); break;
      case 'l': case 'L': toggleLearn(); break;
      case '/': openFind(); break;
      case 'ArrowUp': case 'ArrowDown': if (learn.on) scrollLearn(k === 'ArrowUp' ? -1 : 1); else handled = false; break;
      case '=': case '+': if (learn.on) sizeLearn(1); else handled = false; break;
      case '-': case '_': case '−': if (learn.on) sizeLearn(-1); else handled = false; break;
      case ' ': if (main.querySelector('.ctl-run')) simRun(); else handled = false; break;
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
    append(stage, [problem, main, butBar, overlay, toastEl, buildInput()]);
    document.body.appendChild(buildLearn());
    // click-to-break changes a sim without a move: refresh the learn highlight after any click on the slide
    main.addEventListener('click', function () { if (learn.on) setTimeout(learnRefresh, 0); });
    document.title = CN.content.deckTitle;
    document.documentElement.setAttribute('data-theme', ui.store.get('theme', 'light'));
    var mo = ui.store.get('motion', null);
    if (mo == null) mo = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setMotion(mo, true);
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
