(function () {
  'use strict';
  var CN = window.CN, h = CN.h, ui = CN.ui;

  // The Q&A launcher: every stop is clickable; End comes back here.
  CN.screens.close = function (root) {
    var body = ui.screen(root, { title: 'One message, ' + CN.content.stopCount + ' checkpoints.', sub: 'Each exists because the one before it broke something. Questions?' });
    var line = ui.mapProblem();
    body.appendChild(h('div', { style: { display: 'flex', justifyContent: 'center' } },
      ui.map({ reveal: 3, width: 1120, height: 620, done: function () { return true; }, onPick: function (n) { CN.goTopic(n); }, onHover: line.show })));
    body.appendChild(line);
    return {};
  };
})();
