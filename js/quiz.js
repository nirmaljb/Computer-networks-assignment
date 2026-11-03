/* Live phone quiz, deck side (SPEC-QUIZ §4): join button + sidebar (J), 'Take the quiz?' prompt at the end
   of each stop, 5-question quiz overlay with a leaderboard on the right (Z starts one by hand),
   podium screen. Only switches on when the page is served by server/quiz-server.mjs; otherwise the
   button stays hidden, Z does nothing, the podium is skipped, and nothing is logged. */
(function () {
  'use strict';
  var CN = window.CN, h = CN.h, s = CN.s, ui = CN.ui;
  var SHAPES = ['▲', '◆', '●', '■'], LET = ['A', 'B', 'C', 'D'];

  var on = false, st = null, es = null, listeners = [];
  var stage, btn, badge, side, sideBody, ov, toast, toastTimer = null;
  var sideOpen = false, ovOpen = false, ovTopic = null, pending = false, ring = null, ringTimer = null;
  var prompt = null, declined = {};   // prompt = { topic, proceed } while 'Take the quiz?' is up
  var qrFor = null;

  function host(body) {
    return fetch('/api/host', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .catch(function () { return { status: 0, body: { error: 'Quiz server unreachable' } }; });
  }
  function remaining() {
    if (!st || !st.q || st.phase !== 'open') return 0;
    return Math.max(0, st.q.remainingMs - (Date.now() - st.receivedAt));
  }
  function topicName(n) { return 'S' + n + ' · ' + CN.content.topics[n].short; }

  /* ---------------- on / off ---------------- */
  function setOn(v) {
    if (on === v) return;
    on = v;
    stage.classList.toggle('quiz-on', on);
    if (!on) { closeSide(); closeOv(); }
    listeners.forEach(function (f) { f(); });
  }

  function connect() {
    es = new EventSource('/api/events');
    es.onmessage = function (e) {
      var v;
      try { v = JSON.parse(e.data); } catch (err) { return; }
      v.receivedAt = Date.now();
      st = v;
      if (st.phase === 'open') pending = false;
      setOn(true);
      update();
    };
    // the server went away: fall back to quiz-off; EventSource keeps retrying by itself
    es.onerror = function () { if (es.readyState !== 1) setOn(false); };
  }

  function update() {
    badge.textContent = String(st.count);
    badge.hidden = !st.count;
    if (sideOpen) drawSide();
    if (st.quiz && !ovOpen) { ovOpen = true; ovTopic = st.quiz.topic; ov.classList.add('open'); }   // deck reloaded mid-quiz
    if (ovOpen) {
      if (!pending && !prompt && st.phase === 'lobby') closeOv();
      else drawOv();
    }
    listeners.forEach(function (f) { f(); });
  }

  /* ---------------- QR (vendored qrcode-generator, works offline) ---------------- */
  function qrSvg(text, size) {
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), q = 4, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    return s('svg', { viewBox: '0 0 ' + (n + 2 * q) + ' ' + (n + 2 * q), width: size, height: size, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': 'QR code for ' + text },
      s('rect', { width: n + 2 * q, height: n + 2 * q, fill: '#fff' }),
      s('path', { d: d, fill: '#000' }));
  }

  /* ---------------- join button + sidebar ---------------- */
  function buildChrome() {
    badge = h('span', { class: 'qz-badge', hidden: true }, '0');
    btn = h('button', { class: 'qz-btn', title: 'Join the live quiz (J)', 'aria-label': 'Join the live quiz', onClick: function (e) { e.currentTarget.blur(); toggleSide(); } },
      s('svg', { viewBox: '0 0 24 24', width: 26, height: 26, 'aria-hidden': 'true' },
        s('path', { d: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }),
        s('path', { d: 'M5.5 5.5h2v2h-2zM16.5 5.5h2v2h-2zM5.5 16.5h2v2h-2zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3v2h-3zM14 18h2v3h-2z', fill: 'currentColor' })),
      badge);
    sideBody = h('div', { class: 'qz-side-body' });
    side = h('aside', { class: 'qz-side', 'aria-label': 'Join the live quiz' },
      h('div', { class: 'row nowrap', style: { justifyContent: 'space-between' } },
        h('h2', { class: 'qz-side-title' }, 'Join the live quiz'),
        ui.btn('✕', closeSide, '', 'Close (J)')),
      sideBody);
    toast = h('div', { class: 'qz-toast' });
    ov = h('div', { class: 'qz-ov', role: 'dialog', 'aria-label': 'Live quiz question' });
    stage.appendChild(btn); stage.appendChild(side); stage.appendChild(ov); stage.appendChild(toast);
  }

  function drawSide() {
    CN.clear(sideBody);
    if (!st) return;
    if (qrFor !== st.joinUrl) { qrFor = st.joinUrl; side.qr = qrSvg(st.joinUrl, 360); }
    var scheme = st.joinUrl.match(/^https?:\/\//)[0], url = st.joinUrl.slice(scheme.length), cut = url.indexOf('/');
    sideBody.appendChild(h('div', { class: 'qz-qr' }, side.qr));
    // break after the port, never inside it
    // a tunnel host (laptop.tailnet.ts.net) is long: smaller type, and it may break after the scheme too
    sideBody.appendChild(h('div', { class: 'qz-url' + (cut > 22 ? ' long' : '') }, h('span', { class: 'qz-url-scheme' }, scheme), h('wbr'), h('span', { class: 'qz-url-part' }, url.slice(0, cut)), h('wbr'), h('span', { class: 'qz-url-part' }, url.slice(cut))));
    if (/localhost/.test(url)) sideBody.appendChild(h('div', { class: 'banner err small' }, 'No Wi-Fi address found: phones cannot reach this laptop.'));
    sideBody.appendChild(h('div', { class: 'qz-count' }, st.count + (st.count === 1 ? ' player' : ' players')));
    var list = h('div', { class: 'qz-nicks' });
    // newest first, so the room sees their name appear at the top
    st.players.slice().reverse().forEach(function (p) { list.appendChild(h('span', { class: 'qz-nick' }, p.nick)); });
    sideBody.appendChild(list);
    sideBody.appendChild(h('div', { class: 'row nowrap', style: { justifyContent: 'space-between', marginTop: 'auto' } },
      h('span', { class: 'small muted' }, 'J closes · Z starts a stop\'s quiz'),
      ui.btn('Reset game', function () {
        if (window.confirm('Reset the game? Every player and score is deleted.')) { declined = {}; host({ action: 'reset' }); }
      }, 'qz-reset')));
  }
  function toggleSide(v) {
    sideOpen = v == null ? !sideOpen : v;
    side.classList.toggle('open', sideOpen);
    if (sideOpen) drawSide();
  }
  function closeSide() { if (side) toggleSide(false); }

  function say(text) {
    toast.textContent = text;
    toast.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('shown'); }, 2200);
  }

  /* ---------------- stop quiz: prompt, then up to 5 questions, then the stop's standings ---------------- */
  // A topic gets the prompt once: until its quiz has run, it was skipped, or nobody is playing.
  function offerable(topic) {
    return on && !!st && st.count > 0 && st.phase === 'lobby' && st.left[topic] > 0 &&
      st.done.indexOf(topic) < 0 && !declined[topic];
  }
  // app.js calls this when → would leave a topic; true = the prompt took over, proceed() moves on after N.
  function offer(topic, proceed) {
    if (!offerable(topic)) return false;
    blurAll();
    closeSide();
    prompt = { topic: topic, proceed: proceed };
    ovOpen = true; ovTopic = topic;
    ov.classList.add('open');
    drawOv();
    return true;
  }
  function blurAll() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

  function startQuiz(topic) {
    if (!(st.left[topic] > 0)) { say('No questions left for ' + topicName(topic)); return; }
    blurAll();
    closeSide();
    prompt = null;
    ovOpen = true; ovTopic = topic; pending = true;
    ov.classList.add('open');
    drawOv();
    host({ action: 'start', topic: topic }).then(function (r) {
      if (r.status === 200) return;
      pending = false;
      closeOv(); say(r.body.error || 'Could not start the quiz');
    });
  }
  // One press acts once per state: after a reveal or next, further presses wait for the server's new
  // state (not just its reply, which can arrive first), and the server ignores commands for an old question.
  var actedOn = null;
  function stateKey() { return st.phase + ':' + (st.q ? st.q.id : ''); }
  function advance() {
    if (pending || actedOn === stateKey()) return;
    if (st.phase === 'open') {
      if (st.q.durationMs - remaining() < 1000) return;   // a fresh question can't be closed by a double press
      actedOn = stateKey();
      host({ action: 'reveal', qid: st.q.id });
    } else if (st.phase === 'reveal') {
      actedOn = stateKey();
      host({ action: 'next', qid: st.q.id });
    } else if (st.phase === 'done') { host({ action: 'close' }); closeOv(); }
  }
  function closeOv() {
    ovOpen = false; pending = false; prompt = null;
    clearInterval(ringTimer);
    if (ov) ov.classList.remove('open');
  }

  function ringEl() {
    var R = 50, C = 2 * Math.PI * R;
    var arc = s('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 10, 'stroke-linecap': 'round',
      'stroke-dasharray': C, transform: 'rotate(-90 60 60)' });
    var txt = s('text', { x: 60, y: 72, 'text-anchor': 'middle', 'font-size': 36, 'font-weight': 800, fill: 'var(--ink)' }, '20');
    var svg = s('svg', { viewBox: '0 0 120 120', width: 120, height: 120, class: 'qz-ring' },
      s('circle', { cx: 60, cy: 60, r: R, fill: 'none', stroke: 'var(--panel2)', 'stroke-width': 10 }), arc, txt);
    return {
      el: svg,
      set: function () {
        var left = remaining(), f = st && st.q ? left / st.q.durationMs : 0;
        arc.setAttribute('stroke-dashoffset', String(C * (1 - f)));
        arc.setAttribute('stroke', left < 5000 ? 'var(--red)' : 'var(--accent)');
        txt.textContent = String(Math.ceil(left / 1000));
      }
    };
  }

  // Right-hand leaderboard: whole-talk total, + this quiz. A dot = answered (open); ✓/✗ only after the reveal.
  var LB_ROWS = 10;
  function leaderboard() {
    var phase = st.phase, list = h('ol', { class: 'qz-lb-list' });
    st.players.slice(0, LB_ROWS).forEach(function (p) {
      var mark = null;
      if (phase === 'open') mark = h('span', { class: 'qz-lb-mark' + (p.answered ? ' in' : ''), title: p.answered ? 'Answered' : '' }, p.answered ? '●' : '');
      else if (phase === 'reveal' && 'last' in p) {
        mark = p.last && p.last.correct ? h('span', { class: 'qz-lb-mark ok' }, '✓')
          : h('span', { class: 'qz-lb-mark bad' }, p.last ? '✗' : '–');
      } else mark = h('span', { class: 'qz-lb-mark' });
      list.appendChild(h('li', { class: 'qz-lb-row' },
        h('span', { class: 'qz-lb-rk' }, String(p.rank)),
        h('span', { class: 'qz-lb-nk' }, p.nick),
        mark,
        h('span', { class: 'qz-lb-sc' }, String(p.score),
          p.gain ? h('span', { class: 'qz-lb-gain' }, '+' + p.gain) : null)));
    });
    var more = st.players.length - LB_ROWS;
    return h('aside', { class: 'qz-lb', 'aria-label': 'Leaderboard' },
      h('div', { class: 'qz-lb-head' }, h('span', null, 'Leaderboard'), h('span', { class: 'qz-lb-sub' }, 'total · +this quiz')),
      st.players.length ? list : h('div', { class: 'muted qz-lb-empty' }, 'No players yet'),
      more > 0 ? h('div', { class: 'qz-lb-more' }, '+' + more + ' more') : null,
      h('div', { class: 'qz-lb-join' }, 'Join: ', h('b', null, st.joinUrl.replace(/^https?:\/\//, ''))));
  }

  function drawOv() {
    CN.clear(ov);
    clearInterval(ringTimer);
    var main = h('div', { class: 'qz-main' });
    ov.appendChild(main);
    if (prompt) {
      main.appendChild(h('div', { class: 'qz-prompt' },
        h('div', { class: 'qz-label' }, 'End of ' + topicName(prompt.topic)),
        h('div', { class: 'qz-prompt-q' }, 'Take the quiz?'),
        h('div', { class: 'qz-prompt-sub' }, Math.min(5, st.left[prompt.topic]) + ' questions · ' + st.count + (st.count === 1 ? ' player' : ' players')),
        h('div', { class: 'qz-prompt-keys' },
          h('span', { class: 'qz-key yes' }, h('b', null, 'Y'), ' start'),
          h('span', { class: 'qz-key' }, h('b', null, 'N'), ' skip to the next stop'))));
      ov.appendChild(leaderboard());
      return;
    }
    var q = st && st.q, quiz = st && st.quiz;
    if (pending && (!quiz || st.phase === 'lobby')) {
      main.appendChild(h('div', { class: 'qz-head' }, h('span', { class: 'qz-label' }, 'Quiz · ' + topicName(ovTopic))));
      main.appendChild(h('div', { class: 'qz-ready' }, 'Phones ready…'));
      ov.appendChild(leaderboard());
      return;
    }
    if (st.phase === 'done' && quiz) {
      main.appendChild(h('div', { class: 'qz-head' }, h('span', { class: 'qz-label' }, 'Quiz · ' + topicName(quiz.topic) + ' · done')));
      var best = st.players.filter(function (p) { return p.gain > 0; }).sort(function (x, y) { return y.gain - x.gain; }).slice(0, 5);
      var top = h('div', { class: 'qz-stop-top' }, h('div', { class: 'qz-stop-title' }, 'Best on this stop'));
      best.forEach(function (p, i) {
        top.appendChild(h('div', { class: 'qz-stop-row' + (i === 0 ? ' first' : '') }, h('b', null, String(i + 1)), h('span', { class: 'grow' }, p.nick), h('span', { class: 'mono' }, '+' + p.gain)));
      });
      if (!best.length) top.appendChild(h('div', { class: 'muted' }, 'Nobody scored on this stop.'));
      main.appendChild(top);
      main.appendChild(h('div', { class: 'qz-keys' }, 'Space / Enter close the quiz, then → for the next stop'));
      ov.appendChild(leaderboard());
      return;
    }
    if (!q) return;
    var reveal = st.phase === 'reveal';
    ring = ringEl();
    main.appendChild(h('div', { class: 'qz-head' },
      h('span', { class: 'qz-label' }, 'Quiz · ' + topicName(q.topic)),
      quiz ? h('span', { class: 'qz-qn' }, 'Q' + quiz.n + ' / ' + quiz.total) : null,
      h('span', { class: 'qz-answered' }, 'answered ', h('b', null, q.answered + ' / ' + q.eligible)),
      reveal ? h('span', { class: 'qz-done' }, 'Time!') : ring.el));
    main.appendChild(h('div', { class: 'qz-q' }, q.q));
    var grid = h('div', { class: 'qz-grid' }), max = 1;
    if (reveal) q.counts.forEach(function (c) { max = Math.max(max, c); });
    q.o.forEach(function (opt, i) {
      var cls = 'qz-tile t' + i + (reveal ? (i === q.a ? ' right' : ' dim') : '');
      grid.appendChild(h('div', { class: cls },
        h('span', { class: 'qz-shape' }, SHAPES[i]),
        h('span', { class: 'qz-let' }, LET[i]),
        h('span', { class: 'qz-opt' + (/^[0-9a-f:.\s/]+$/i.test(opt) ? ' mono' : '') }, opt),
        reveal ? h('span', { class: 'qz-n' }, String(q.counts[i])) : null,
        reveal ? h('span', { class: 'qz-bar', style: { width: (q.counts[i] / max * 100) + '%' } }) : null,
        reveal && i === q.a ? h('span', { class: 'qz-tick' }, '✓') : null));
    });
    main.appendChild(grid);
    if (reveal) main.appendChild(h('div', { class: 'qz-why' }, h('b', null, '✓ ' + SHAPES[q.a] + ' ' + LET[q.a] + '  '), q.why));
    var last = quiz && quiz.n >= quiz.total;
    main.appendChild(h('div', { class: 'qz-keys' },
      reveal ? (last ? 'Space / Enter standings' : 'Space / Enter next question') + ' · Esc end the quiz'
        : 'Space / Enter reveal now · Esc end the quiz (voids this question)'));
    ov.appendChild(leaderboard());
    if (!reveal) {
      ring.set();
      ringTimer = setInterval(ring.set, 100);
    }
  }

  /* ---------------- keys (called by app.js before the deck's own keys) ---------------- */
  function key(e) {
    if (!on) return false;
    var k = e.key;
    if (e.repeat && (ovOpen || k === 'z' || k === 'Z')) return true;   // a held key never fires twice
    if (ovOpen && prompt) {
      var p = prompt;
      if (k === 'y' || k === 'Y' || k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') startQuiz(p.topic);
      else if (k === 'n' || k === 'N' || k === 'Escape') { declined[p.topic] = true; closeOv(); p.proceed(); }
      // an extra → press must not skip the quiz: only N / Esc do
      else if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'PageDown' || k === 'PageUp') say('Y start the quiz · N skip it');
      return true;
    }
    if (ovOpen) {
      // → and ← are off for the whole quiz so a stray click can't skip a question
      if (k === ' ' || k === 'Enter') advance();
      else if (k === 'Escape') {
        if (st.phase !== 'lobby' || pending) host({ action: 'stop' });
        closeOv();
      } else if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'PageDown' || k === 'PageUp') say('→ ← are off during the quiz · Space for next');
      return true; // every other deck key is ignored while the overlay is open
    }
    if (k === 'j' || k === 'J') { toggleSide(); return true; }
    if (k === 'Escape' && sideOpen) { closeSide(); return true; }
    if (k === 'z' || k === 'Z') {
      var sc = CN.current();
      if (sc && sc.topic) startQuiz(sc.topic);
      return true;
    }
    return false;
  }
  // true while the prompt or the quiz is up: app.js ignores presenter-window navigation then
  function busy() { return ovOpen; }

  function podiumOn() { return on && !!st && st.players.some(function (p) { return p.score > 0; }); }

  CN.quiz = { key: key, offer: offer, busy: busy, podiumOn: podiumOn, get on() { return on; } };

  /* ---------------- podium screen ---------------- */
  CN.screens.podium = function (root) {
    var body = ui.screen(root, { title: 'Leaderboard', sub: 'Live quiz · Units II + III' });
    var confettiDone = false;
    function draw() {
      CN.clear(body);
      var players = on && st ? st.players.filter(function (p) { return p.score > 0; }) : [];
      if (!players.length) {
        body.appendChild(h('div', { class: 'qz-ready' }, on ? 'Nobody has scored yet. → for Q&A.' : 'The quiz is offline. → for Q&A.'));
        return;
      }
      var pod = h('div', { class: 'qz-podium' });
      [[1, 'second', 210], [0, 'first', 290], [2, 'third', 150]].forEach(function (c) {
        var p = players[c[0]];
        pod.appendChild(h('div', { class: 'qz-step ' + c[1] },
          p ? h('div', { class: 'qz-step-name' }, p.nick) : h('div', { class: 'qz-step-name muted' }, '—'),
          p ? h('div', { class: 'qz-step-score' }, String(p.score)) : null,
          h('div', { class: 'qz-step-block', style: { height: c[2] + 'px' } }, String(c[0] + 1))));
      });
      body.appendChild(pod);
      var rest = h('div', { class: 'qz-rest' });
      players.slice(3, 10).forEach(function (p, i) {
        rest.appendChild(h('div', { class: 'qz-rest-row' }, h('b', null, (i + 4) + ''), h('span', { class: 'grow' }, p.nick), h('span', { class: 'mono' }, String(p.score))));
      });
      if (rest.childNodes.length) body.appendChild(rest);
      if (!confettiDone) { confettiDone = true; confetti(root); }
    }
    draw();
    listeners.push(draw);
    return { destroy: function () { listeners = listeners.filter(function (f) { return f !== draw; }); } };
  };
  function confetti(root) {
    var colors = ['#5a39c6', '#1b5bbd', '#a35f00', '#23772b', '#c42323'];
    for (var i = 0; i < 90; i++) {
      root.appendChild(h('div', { class: 'confetti', style: { left: Math.random() * 1600 + 'px', background: colors[i % 5], animationDelay: (Math.random() * 1.2) + 's' } }));
    }
    setTimeout(function () { Array.prototype.slice.call(root.querySelectorAll('.confetti')).forEach(function (c) { c.remove(); }); }, 5000);
  }

  /* ---------------- start ---------------- */
  // Probe with a HEAD on a file every server has, so python / file:// never log a 404.
  function init() {
    stage = document.getElementById('stage');
    if (!/^https?:$/.test(location.protocol) || !window.qrcode || !window.EventSource) return;
    fetch('index.html', { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      if (r.headers.get('X-Quiz-Server') !== '1') return null;
      return fetch('/api/info', { cache: 'no-store' }).then(function (r2) { return r2.ok ? r2.json() : null; });
    }).then(function (info) {
      if (!info) return;
      buildChrome();
      connect();
    }).catch(function () { /* no quiz server: the deck runs as before */ });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
