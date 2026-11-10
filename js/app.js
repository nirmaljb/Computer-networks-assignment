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
  // SPEC-v8: titles, labels and buttons are set in the bundled Space Grotesk (latin subset). ui.text(t) returns
  // nodes for t: characters the font has stay text; arrows, ≤, ✓ … become small inline SVG glyphs in the text
  // colour; superscripts (2ⁿ⁻¹) become a <sup> of ordinary characters. ui.inFont(ch) is what the tests check
  // against the font file itself (tools/font-chars.mjs).
  var GROT = /[\x20-\x7e\xa0-\xffıŒœ–—‘’‚“”„•…′″‹›⁄€™↑↓−∕]/;
  var SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n', '⁻': '−' };
  var GLYPH = {
    '→': 'M2 8 H14 M9.5 3.5 L14 8 L9.5 12.5', '←': 'M14 8 H2 M6.5 3.5 L2 8 L6.5 12.5',
    '≤': 'M12 2.5 L4 6.5 L12 10.5 M4 13.5 H12', '≥': 'M4 2.5 L12 6.5 L4 10.5 M4 13.5 H12',
    '✓': 'M2.5 8.5 L6.5 12.5 L13.5 3.5', '✕': 'M3.5 3.5 L12.5 12.5 M12.5 3.5 L3.5 12.5',
    '∞': 'M8 8 C6 4.5 2 4.5 2 8 C2 11.5 6 11.5 8 8 C10 4.5 14 4.5 14 8 C14 11.5 10 11.5 8 8',
    '◀': '*M12.5 2.5 L3 8 L12.5 13.5 Z', '▶': '*M3.5 2.5 L13 8 L3.5 13.5 Z'
  };
  ui.inFont = function (ch) { return GROT.test(ch) && !SUP[ch]; };
  ui.text = function (text) {
    var out = [], run = '', sup = '';
    function flush() { if (run) out.push(run); run = ''; if (sup) out.push(h('sup', null, sup)); sup = ''; }
    Array.from(String(text)).forEach(function (ch) {
      if (SUP[ch]) { if (run) { out.push(run); run = ''; } sup += SUP[ch]; return; }
      if (sup) flush();
      if (ui.inFont(ch)) { run += ch; return; }
      flush();
      var d = GLYPH[ch];
      if (!d) { out.push(h('span', { class: 'sysglyph' }, ch)); return; }
      out.push(s('svg', { class: 'gl', viewBox: '0 0 16 16', 'aria-label': ch, role: 'img' },
        s('path', d.charAt(0) === '*' ? { d: d.slice(1), class: 'fill' } : { d: d })));
    });
    flush();
    return out;
  };
  ui.screen = function (root, opts) {
    var body = h('div', { class: 'scr-body' });
    // SPEC-v5: the header is the S-number and the title, nothing else
    var head = h('div', { class: 'scr-head' },
      opts.num ? h('span', { class: 'scr-num' }, 'S' + opts.num) : null,
      h('h1', { class: 'scr-title' }, ui.text(opts.title)));
    var el = h('div', { class: 'scr' }, head, body);
    root.appendChild(el);
    return body;
  };
  ui.btn = function (label, onClick, cls, title) {
    return h('button', { class: 'btn ' + (cls || ''), onClick: function (e) { e.currentTarget.blur(); onClick(e); }, title: title },
      typeof label === 'string' ? ui.text(label) : label);
  };
  // The only controls a sim slide shows: Back, Step, Run, Reset. They drive the screen's controller
  // through the deck (sim* below), so the keys do the same: ← Back, S Step, Space Run, R Reset.
  // o.stepOnly: a one-step slide shows just Back and Step (Run and Reset would add nothing).
  ui.controls = function (o) {
    var one = o && o.stepOnly;
    return h('div', { class: 'row ctl' },
      ui.btn('◀ Back', function () { simBack(); }, 'ctl-back'),
      ui.btn('Step (S)', function () { simStep(); }, 'primary'),
      one ? null : ui.btn('Run', function () { simRun(); }, 'ctl-run'),
      one ? null : ui.btn('Reset (R)', function () { simReset(); }));
  };
  // SPEC-v6 E: what a screen returns as ctrl.input. parse(text) → { error } or a value; use(value) restarts
  // the sim with it, use(null) with the slide's own example. The input box itself lives in the shell.
  // SPEC-v8: on a slide with handles, E is a text view of them (o.read: handles → text, o.write: parsed → handles,
  // set quietly). Then E and the handles share one state: E then a drag = E's values with that field changed.
  ui.numbers = function (o) {
    var cur = null;
    if (o.read) return {
      label: o.label, viaHandles: true,
      value: function () { return o.read(); },
      custom: function () { return o.read() !== o.example; },
      clear: function () {},
      apply: function (text) {
        var v = o.parse(String(text));
        if (!v || v.error) return { error: (v && v.error) || 'Not understood' };
        o.write(v);
        return {};
      }
    };
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

  /* ---------------- SPEC-v8: handles ---------------- */
  // A handle is configuration for a ★ sim: a slider, chips, a dial, or taps on the figure itself (kind 'tap': the
  // screen draws the tappable parts and calls hd.set). Handles are built only here, so the v5 guard on screens holds.
  // A change from the user re-runs the sim and replays the moves since Reset (handleChanged); E, R, ? and C set values
  // quietly. o = { key, label (one word), kind, values (array | () → array), value (the default), fmt(v), chip(v),
  // breaks: { v: why it fails } or isBreak(v) (the taught-break notches, one past the legal limit), limit: { at, text } (a mark shown
  // within one notch of it), disabled(v), floor (replay at least this many Steps, so the change shows), share (keeps
  // the value across the stop's sub-slides until the deck leaves the stop), width / radius, center(v) (dial) }.
  var curHandles = [], lastHandle = null, shared = {}, locked = false;
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function indexOfV(vs, v) { for (var i = 0; i < vs.length; i++) if (same(vs[i], v)) return i; return -1; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, String(k)); }
  ui.handle = function (o) {
    var kind = o.kind || 'slider', sk = o.share ? o.share + '.' + o.key : null;
    var cur = sk && has(shared, sk) ? shared[sk] : o.value;
    var hd = { key: o.key, kind: kind, dflt: o.value, floor: o.floor || 0, el: null, draw: function () {} };
    hd.limit = function () { return typeof o.limit === 'function' ? o.limit() : o.limit || null; };
    hd.values = function () { return typeof o.values === 'function' ? o.values() : o.values || []; };
    hd.value = function () { return cur; };
    hd.custom = function () { return !same(cur, o.value); };
    hd.fmt = function (v) { return o.fmt ? o.fmt(v) : String(v); };
    hd.isBreak = function (v) { var x = arguments.length ? v : cur; return o.isBreak ? !!o.isBreak(x) : has(o.breaks, x); };
    hd.breakText = function () { return hd.isBreak() ? o.breaks[String(cur)] : ''; };
    hd.disabled = function (v) { return !!(o.disabled && o.disabled(v)); };
    hd.legal = function () { return hd.values().filter(function (v) { return !hd.isBreak(v) && !hd.disabled(v); }); };
    hd.set = function (v, quiet) {
      if (!quiet && !handlesOpen()) return false;
      if (same(v, cur)) return false;
      cur = v;
      if (sk) shared[sk] = v;
      hd.draw();
      if (!quiet) handleChanged(hd);
      return true;
    };
    hd.reset = function () { cur = o.value; if (sk) delete shared[sk]; hd.draw(); };
    // after the range moved (other numbers via E): keep the value if still on it, else the nearest legal notch
    hd.fit = function () {
      var vs = hd.values();
      if (!vs.length || (indexOfV(vs, cur) >= 0 && !hd.disabled(cur))) { hd.draw(); return; }
      var legal = hd.legal(), best = legal[0];
      legal.forEach(function (v) { if (typeof v === 'number' && Math.abs(v - cur) < Math.abs(best - cur)) best = v; });
      cur = best;
      if (sk) shared[sk] = cur;
      hd.draw();
    };
    // [ ]: the neighbouring notch that is not disabled
    hd.nudge = function (d) {
      var vs = hd.values(), i = indexOfV(vs, cur);
      if (i < 0) return false;
      for (var j = i + d; j >= 0 && j < vs.length; j += d) if (!hd.disabled(vs[j])) return hd.set(vs[j]);
      return false;
    };
    hd.nudgeable = function () { return indexOfV(hd.values(), cur) >= 0; };
    if (kind === 'slider') sliderEl(hd, o);
    else if (kind === 'chips') chipsEl(hd, o);
    else if (kind === 'dial') dialEl(hd, o);
    else if (kind === 'build') buildEl(hd, o);
    curHandles.push(hd);
    return hd;
  };
  function hdLabel(hd, o, el) {
    clear(el);
    el.classList.toggle('brk', hd.isBreak());
    append(el, [ui.text(o.label + ' '), h('b', null, ui.text(hd.fmt(hd.value())))]);
  }
  function sliderEl(hd, o) {
    var label = h('span', { class: 'hd-label' }), track = h('div', { class: 'hd-track', style: { width: (o.width || 420) + 'px' } });
    hd.el = h('div', { class: 'hd hd-slider', 'data-key': hd.key }, label, track);
    function at(i, n) { return (n > 1 ? i / (n - 1) * 100 : 50) + '%'; }
    hd.draw = function () {
      var vs = hd.values(), i = indexOfV(vs, hd.value());
      hdLabel(hd, o, label);
      clear(track);
      // a long range draws a tick every few notches (every value can still be dragged to or nudged with [ ])
      var every = vs.length > 24 ? Math.ceil(vs.length / 12) : 1;
      vs.forEach(function (v, j) {
        if (j % every && j !== vs.length - 1 && !hd.isBreak(v)) return;
        var n = h('span', { class: 'hd-notch' + (hd.isBreak(v) ? ' brk' : ''), 'data-v': JSON.stringify(v), style: { left: at(j, vs.length) } });
        n.addEventListener('click', function (e) { e.stopPropagation(); if (!hd.disabled(v)) hd.set(v); });
        track.appendChild(n);
      });
      // the limit mark shows only within one notch of the limit
      var lim = hd.limit(), li = lim ? indexOfV(vs, lim.at) : -1;
      if (li >= 0 && Math.abs(li - i) <= 1) track.appendChild(h('span', { class: 'hd-limit', style: { left: at(li, vs.length) } }, lim.text));
      track.appendChild(h('span', { class: 'hd-thumb' + (hd.isBreak() ? ' brk' : ''), style: { left: at(Math.max(0, i), vs.length) } }));
    };
    function pick(e) {
      var r = track.getBoundingClientRect(), vs = hd.values();
      if (!r.width || !vs.length) return;
      var j = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (vs.length - 1));
      if (!hd.disabled(vs[j])) hd.set(vs[j]);
    }
    track.addEventListener('pointerdown', function (e) {
      if (!handlesOpen()) return;
      hd.el.classList.add('dragging');
      try { track.setPointerCapture(e.pointerId); } catch (x) { /* fake DOM */ }
      pick(e);
    });
    track.addEventListener('pointermove', function (e) { if (hd.el.classList.contains('dragging')) pick(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { track.addEventListener(t, function () { hd.el.classList.remove('dragging'); }); });
    hd.draw();
  }
  // chips: one value; with o.multi the value is the list of chips that are on (a click toggles one, order kept)
  function chipsEl(hd, o) {
    var label = h('span', { class: 'hd-label' }), box = h('div', { class: 'hd-chips' });
    hd.el = h('div', { class: 'hd hd-chipset', 'data-key': hd.key }, label, box);
    hd.draw = function () {
      hdLabel(hd, o, label);
      clear(box);
      var vs = hd.values();
      vs.forEach(function (v) {
        var on = o.multi ? indexOfV(hd.value(), v) >= 0 : same(v, hd.value());
        var c = h('button', { class: 'hd-chip' + (on ? ' on' : '') + (hd.isBreak(v) ? ' brk' : ''), 'data-v': JSON.stringify(v), disabled: hd.disabled(v) && !on },
          ui.text(o.chip ? o.chip(v) : hd.fmt(v)));
        c.addEventListener('click', function (e) {
          e.currentTarget.blur();
          if (hd.disabled(v) && !on) return;
          if (!o.multi) return hd.set(v);
          hd.set(vs.filter(function (x) { return same(x, v) ? !on : indexOfV(hd.value(), x) >= 0; }));
        });
        box.appendChild(c);
      });
    };
    if (o.multi) hd.nudgeable = function () { return false; };
    hd.draw();
  }
  function dialEl(hd, o) {
    var R = o.radius || 120, size = 2 * R + 64, c = size / 2;
    var svg = s('svg', { class: 'hd-dial', width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    var label = h('span', { class: 'hd-label' });
    hd.el = h('div', { class: 'hd hd-dialbox', 'data-key': hd.key }, label, svg);
    function pos(j, n, r) { var a = -Math.PI / 2 + 2 * Math.PI * j / n; return [c + r * Math.cos(a), c + r * Math.sin(a)]; }
    hd.draw = function () {
      var vs = hd.values();
      hdLabel(hd, o, label);
      clear(svg);
      svg.appendChild(s('circle', { cx: c, cy: c, r: R, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 3 }));
      vs.forEach(function (v, j) {
        var on = same(v, hd.value()), p = pos(j, vs.length, R), t = pos(j, vs.length, R + 22);
        var dot = s('circle', { class: 'n' + (on ? ' on' : ''), cx: p[0], cy: p[1], r: on ? 11 : 6, 'data-v': JSON.stringify(v) });
        dot.addEventListener('click', function (e) { e.stopPropagation(); hd.set(v); });
        svg.appendChild(dot);
        svg.appendChild(s('text', { x: t[0], y: t[1] + 5, 'text-anchor': 'middle', class: on ? 'on' : '' }, o.tick ? o.tick(v) : String(v)));
      });
      if (o.center) svg.appendChild(s('text', { x: c, y: c + 9, 'text-anchor': 'middle', class: 'on', style: 'font-size: 26px' }, o.center(hd.value())));
    };
    function pick(e) {
      var r = svg.getBoundingClientRect(), vs = hd.values();
      if (!r.width || !vs.length) return;
      var a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) + Math.PI / 2;
      var j = Math.round(((a / (2 * Math.PI)) % 1 + 1) % 1 * vs.length) % vs.length;
      hd.set(vs[j]);
    }
    svg.addEventListener('pointerdown', function (e) {
      if (!handlesOpen()) return;
      hd.el.classList.add('dragging');
      try { svg.setPointerCapture(e.pointerId); } catch (x) { /* fake DOM */ }
      pick(e);
    });
    svg.addEventListener('pointermove', function (e) { if (hd.el.classList.contains('dragging')) pick(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { svg.addEventListener(t, function () { hd.el.classList.remove('dragging'); }); });
    hd.draw();
  }
  // build: the value is a list of tokens, changed in a pop-up: drag tokens from the palette (o.palette) into the
  // tray, along it to reorder, off it to remove (a tap adds or removes one). Use sets the handle; Esc cancels.
  // o.max caps the length, o.check(list) → an error or null, o.tokClass(t) colours a token.
  var bld = null;
  function buildEl(hd, o) {
    var label = h('span', { class: 'hd-label' });
    var open = ui.btn(o.button || 'Drag and drop', function () { openBuild(hd, o); }, 'hd-open');
    hd.el = h('div', { class: 'hd hd-build', 'data-key': hd.key }, label, open);
    if (!o.fmt) hd.fmt = function (v) { return v.join(' '); };
    hd.draw = function () { hdLabel(hd, o, label); };
    hd.nudgeable = function () { return false; };
    hd.draw();
  }
  function openBuild(hd, o) {
    if (!handlesOpen() || bld) return;
    stopRun();
    var max = o.max || 8, draft = hd.value().slice();
    var tray = h('div', { class: 'bld-tray' }), pal = h('div', { class: 'bld-pal' }), err = h('div', { class: 'ein-err' });
    var wrap = h('div', { class: 'ein bld open' }, h('div', { class: 'ein-box' },
      h('div', { class: 'ein-title' }, 'Drag and drop · S' + screens[idx].stop),
      h('div', { class: 'ein-label' }, o.label + ': drag bytes into the frame, along it to move one, or off it to remove one'),
      h('div', { class: 'bld-cap' }, 'Bytes'), pal, h('div', { class: 'bld-cap' }, 'Data in the frame (at most ' + max + ')'), tray, err,
      h('div', { class: 'row', style: { gap: '12px' } },
        ui.btn('Use (Enter)', function () { applyBuild(); }, 'primary'),
        ui.btn('Clear', function () { draft = []; drawTray(); }),
        ui.btn('Example', function () { draft = hd.dflt.slice(); drawTray(); }),
        ui.btn('Cancel (Esc)', function () { closeBuild(); })),
      h('div', { class: 'ein-hint' }, 'A tap on a byte adds it at the end; a tap on one in the frame removes it')));
    function tok(t) { return h('span', { class: 'bit tok bld-tok ' + (o.tokClass ? o.tokClass(t) : 'data') }, t); }
    // drawn without the token being dragged; slot = where it would land (or -1)
    function drawTray(skip, slot) {
      clear(tray);
      var list = draft.filter(function (x, i) { return i !== skip; });
      if (!list.length && slot == null) tray.appendChild(h('span', { class: 'bld-empty' }, 'Drop bytes here'));
      list.forEach(function (t, i) {
        if (i === slot) tray.appendChild(h('span', { class: 'bld-slot' }));
        var el = tok(t), at = skip != null && i >= skip ? i + 1 : i;
        el.addEventListener('pointerdown', function (e) { drag(e, t, at); });
        tray.appendChild(el);
      });
      if (slot != null && slot >= list.length) tray.appendChild(h('span', { class: 'bld-slot' }));
      err.textContent = '';
    }
    function add(t, i) {
      if (draft.length >= max) { err.textContent = '✕ At most ' + max + ' bytes'; return false; }
      draft.splice(i == null ? draft.length : i, 0, t);
      return true;
    }
    // from: the token's index in the tray, or -1 for the palette
    function drag(e, t, from) {
      e.preventDefault();
      var x0 = e.clientX, y0 = e.clientY, ghost = null, slot = null;
      var sr = stage.getBoundingClientRect(), sc = sr.width / 1600 || 1;
      function over(ev) {
        var r = tray.getBoundingClientRect(), pad = 30 * sc;
        return ev.clientX > r.left - pad && ev.clientX < r.right + pad && ev.clientY > r.top - pad && ev.clientY < r.bottom + pad;
      }
      function slotAt(ev) {
        var n = 0;
        Array.prototype.forEach.call(tray.querySelectorAll('.bld-tok'), function (c) {
          var r = c.getBoundingClientRect();
          if (ev.clientX > r.left + r.width / 2) n++;
        });
        return n;
      }
      function move(ev) {
        if (!ghost) {
          if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 6) return;
          ghost = tok(t); ghost.classList.add('bld-ghost'); wrap.appendChild(ghost);
          drawTray(from >= 0 ? from : null, null);
        }
        ghost.style.left = (ev.clientX - sr.left) / sc + 'px';
        ghost.style.top = (ev.clientY - sr.top) / sc + 'px';
        var s2 = null;
        if (over(ev)) { drawTray(from >= 0 ? from : null, null); s2 = slotAt(ev); }
        if (s2 !== slot) { slot = s2; drawTray(from >= 0 ? from : null, slot); }
        tray.classList.toggle('over', slot != null);
      }
      function up(ev) {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        tray.classList.remove('over');
        if (ghost) ghost.remove();
        if (!ghost) {   // a tap
          if (from >= 0) draft.splice(from, 1); else if (!add(t)) return;
        } else {
          var at = over(ev) ? slot : null;
          if (from >= 0) draft.splice(from, 1);
          if (at != null && !add(t, at) && from >= 0) draft.splice(from, 0, t);
        }
        drawTray();
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }
    o.palette.forEach(function (t) {
      var el = tok(t);
      el.addEventListener('pointerdown', function (e) { drag(e, t, -1); });
      pal.appendChild(el);
    });
    function applyBuild() {
      var bad = !draft.length ? 'Put at least one byte in the frame' : o.check ? o.check(draft) : null;
      if (bad) { err.textContent = '✕ ' + bad; return; }
      var list = draft.slice();
      closeBuild();
      hd.set(list);
    }
    bld = { el: wrap, apply: applyBuild };
    drawTray();
    stage.appendChild(wrap);
  }
  function closeBuild() { if (bld) { bld.el.remove(); bld = null; } }

  // The row a screen puts its handles in (under the figure, above Back · Step · Run · Reset).
  ui.handleRow = function () {
    return h('div', { class: 'hd-row' }, Array.prototype.slice.call(arguments).map(function (x) { return x && x.el; }));
  };
  // A value another sub-slide of this stop set (20c follows 20a/b), or the default.
  ui.sharedValue = function (share, key, dflt) { var k = share + '.' + key; return has(shared, k) ? shared[k] : dflt; };

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
  // R also drops numbers typed with E (SPEC-v6) and every handle (SPEC-v8): the slide goes back to its example.
  function simReset() {
    stopRun();
    curHandles.forEach(function (x) { x.reset(); });
    if (ctrl && ctrl.input && !ctrl.input.viaHandles && ctrl.input.custom()) ctrl.input.clear();
    else if (ctrl && ctrl.reset) ctrl.reset();
    customTag(false);
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
    if (ctrl.input.viaHandles && ctrl.reset) ctrl.reset();
    customTag(anyCustom());
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
    if (chal) endChallenge();
    simReset();
    setLock(true);   // SPEC-v8: ? snaps the handles to the defaults and locks them until the answer shows
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
    setLock(!predict.revealed);
  }
  function endPredict() {
    setLock(false);
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

  /* ---------------- SPEC-v8: handles in the deck, [ ] nudge, C challenge ---------------- */
  function handlesOpen() { return !locked && !quizBusy(); }
  function anyCustom() { return curHandles.some(function (x) { return x.custom(); }) || !!(ctrl && ctrl.input && ctrl.input.custom()); }
  function setLock(on) {
    locked = !!on;
    if (main) main.classList.toggle('hd-locked', locked);
  }
  // A handle moved: the sim restarts at the new values and replays the moves since Reset, so it lands on the same
  // step (or the run's last one). A handle with a floor replays at least that many Steps, so the change shows.
  function handleChanged(hd) {
    lastHandle = hd;
    stopRun();
    var moves = trail;
    trail = [];
    if (ctrl && ctrl.reset) ctrl.reset();
    for (var i = 0; i < moves.length; i++) {
      var fn = moves[i] === 'run' && ctrl.runStep ? ctrl.runStep : ctrl.step;
      if (!fn || fn() === false) break;
      trail.push(moves[i]);
    }
    while (trail.length < hd.floor && ctrl.step && ctrl.step() !== false) trail.push('step');
    customTag(anyCustom());
    ctlButtons(); post();
  }
  // [ ]: the last-touched handle (or the first one with notches) moves one notch. ← → stay deck navigation.
  function nudgeHandle(d) {
    if (!handlesOpen()) return;
    var x = lastHandle && curHandles.indexOf(lastHandle) >= 0 && lastHandle.nudgeable() ? lastHandle : curHandles.filter(function (y) { return y.nudgeable(); })[0];
    if (!x) { CN.toast(curHandles.length ? 'Tap the figure to change it' : 'No handle on this slide'); return; }
    if (x.nudge(d)) lastHandle = x;
  }
  CN.handles = function () { return curHandles.slice(); };
  CN.moves = function () { return trail.length; };   // the Steps / Runs since Reset (what a drag replays)

  // C: the slide's challenge (ctrl.challenge = { goal, why, holds(), answer() → { key: value } }). The goal takes the
  // caption's place; once holds() is true, ✓ and the one-line why replace it (no ✕, ever). C again walks the handles
  // to the answer; a third C brings the caption back. C and ? exclude each other.
  var chal = null, chalTimer = null;
  function toggleChallenge() {
    if (quizBusy()) return;
    var ch = ctrl && ctrl.challenge;
    if (!ch) { CN.toast('No challenge on this slide'); return; }
    if (!chal) {
      if (predict) endPredict();
      var cap = captionEl(), made = !cap, body = main.querySelector('.scr-body');
      if (made) { cap = h('div', { class: 'say' }); body.insertBefore(cap, body.firstChild); }
      chal = { ch: ch, cap: cap, made: made, old: Array.prototype.slice.call(cap.childNodes), stage: 1, text: null };
      if (ch.start) ch.start();
      drawChallenge();
    } else if (chal.stage === 1) { chal.stage = 2; solveChallenge(); }
    else endChallenge();
  }
  function drawChallenge() {
    if (!chal) return;
    var ok = !!chal.ch.holds(), why = typeof chal.ch.why === 'function' ? chal.ch.why() : chal.ch.why, text = ok ? '✓ ' + why : chal.ch.goal;
    if (text === chal.text) return;
    chal.text = text;
    var cap = chal.cap;
    clear(cap);
    cap.classList.add('chal');
    cap.classList.toggle('solved', ok);
    cap.appendChild(h('span', { class: 'ch-label' }, 'CHALLENGE'));
    cap.appendChild(h('span', null, text));
  }
  function endChallenge() {
    clearInterval(chalTimer); chalTimer = null;
    if (!chal) return;
    var cap = chal.cap, ch = chal.ch;
    clear(cap); cap.classList.remove('chal', 'solved');
    append(cap, chal.old);
    if (chal.made) cap.remove();
    chal = null;
    if (ch.end) ch.end();
  }
  // C again: each handle walks to the answer a notch at a time (jumps with motion off, or for chips and taps)
  function solveChallenge() {
    var ans = chal.ch.answer();
    var todo = curHandles.filter(function (x) { return has(ans, x.key) && !same(x.value(), ans[x.key]); });
    function tick() {
      var x = todo[0];
      if (!x) { clearInterval(chalTimer); chalTimer = null; return false; }
      var tgt = ans[x.key], vs = x.values(), i = indexOfV(vs, x.value()), j = indexOfV(vs, tgt);
      if (!motion || x.kind === 'tap' || x.kind === 'chips' || i < 0 || j < 0 || !x.set(vs[i + (j > i ? 1 : -1)])) x.set(tgt);
      if (same(x.value(), tgt) || !handlesOpen()) todo.shift();
      return true;
    }
    if (!motion) { while (tick()) { /* every handle lands at once */ } return; }
    tick();
    chalTimer = setInterval(tick, 110);
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
    var custom = anyCustom() ? (ctrl && ctrl.genText ? ctrl.genText() : ctrl && ctrl.input ? ctrl.input.value() : null) : null;
    var gk = sub + '|' + (custom == null ? '' : custom);
    if (gk !== learn.genKey) { learn.genKey = gk; swapGen(sub, custom); learn.hlKey = null; }
    clear(lnNote);
    lnNote.classList.toggle('shown', custom != null);
    if (custom != null) lnNote.appendChild(document.createTextNode('Your numbers: ' + custom + '. Tables marked ✎ use them; the text still describes the slide\'s own example.'));
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
      if (custom == null || box.getAttribute('data-sub') !== sub || CN.learnGen.fixed[box.getAttribute('data-gen')]) { append(box, box.orig); return; }
      var t = CN.learnGen(box.getAttribute('data-gen'), custom);
      box.classList.add('custom');
      if (t.error) { box.appendChild(h('div', { class: 'ln-gen-tag' }, '✎ your numbers: ' + t.error)); return; }
      box.appendChild(h('div', { class: 'ln-gen-tag' }, '✎ your numbers: ' + custom));
      box.appendChild(h('div', { class: 'ln-tw' }, h('table', { class: 'ln-table' },
        h('thead', null, h('tr', null, t.head.map(function (c) { return h('th', null, c); }))),
        h('tbody', null, t.rows.map(function (r) {
          return h('tr', r.step == null ? null : { 'data-hl': [].concat(r.step).map(function (s) { return sub + ':' + s; }).join(' ') }, r.cells.map(function (c) { return h('td', null, c); }));
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
    closeBuild();
    predict = null;
    clearInterval(chalTimer); chalTimer = null; chal = null;
    if (screens[idx] && screens[i].topic !== screens[idx].topic) shared = {};
    curHandles = []; lastHandle = null; setLock(false);
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
    customTag(anyCustom());   // a value shared from another sub-slide of this stop (20c, 20b) shows the tag at once
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
    drawChallenge();
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
    if (bld) {
      if (k === 'Escape') closeBuild(); else if (k === 'Enter') bld.apply();
      e.preventDefault();
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
      case 'c': case 'C': toggleChallenge(); break;
      case '[': nudgeHandle(-1); break;
      case ']': nudgeHandle(1); break;
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
