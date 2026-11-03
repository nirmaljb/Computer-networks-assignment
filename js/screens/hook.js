(function () {
  'use strict';
  var CN = window.CN, h = CN.h;

  // → reveals the LAN stops, the internet stops, then the transport + application stops; the deck then shows the But… and moves on.
  CN.screens.hook = function (root) {
    var reveal = 0, body, mapBox;
    body = CN.ui.screen(root, { title: 'What happens when you send "Hi"?', sub: 'every fix creates the next problem' });
    mapBox = h('div', { style: { display: 'flex', justifyContent: 'center' } });
    body.appendChild(mapBox);
    function draw() {
      CN.clear(mapBox).appendChild(CN.ui.map({ reveal: reveal, width: 1214, height: 672 }));
    }
    draw();
    return {
      next: function () { if (reveal < 3) { reveal++; draw(); return true; } return false; },
      prev: function () { if (reveal > 0) { reveal--; draw(); return true; } return false; },
      step: function () { if (reveal < 3) { reveal++; draw(); } },
      reset: function () { reveal = 0; draw(); }
    };
  };
})();
