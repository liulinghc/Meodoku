/**
 * 调试浮层。线上默认关闭，设置里持久化。
 * 触发方式：首页版本号连点 5 次。
 */
var logger = require('../core/logger');
var settings = require('../services/settings');

function Debug(app) {
  this.app = app;
  this.on = false;
  this.fps = 60;
  this.t = 0;
}

Debug.prototype.init = function () {
  this.on = !!settings.get(this.app.save, 'debug');
};

Debug.prototype.setEnabled = function (value) {
  this.on = !!value;
  settings.set(this.app.save, 'debug', this.on);
};

Debug.prototype.toggle = function () {
  this.setEnabled(!this.on);
  this.fps = 60;
  this.t = 0;
};

Debug.prototype.frame = function (dt) {
  if (!this.on) return;
  this.t += dt;
  if (dt > 0.0001) this.fps = this.fps * 0.9 + (1 / dt) * 0.1;
};

Debug.prototype.render = function (r) {
  if (!this.on) return;
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var env = app.env;
  var save = app.save.data;

  var scene = app.sm.top();
  var name = scene ? scene.sceneName : '-';
  var lines = [
    'FPS ' + this.fps.toFixed(0) + '  dt ' + (this.t > 0 ? (this.t).toFixed(1) + 's' : '-'),
    'scene ' + name,
    'canvas ' + env.width + 'x' + env.height + ' @' + env.dpr + 'x',
    'safe ' + env.safeTop.toFixed(0) + ' / ' + env.safeBottom.toFixed(0),
    'coins ' + save.coins + '  tickets ' + save.tickets,
    'unlock ' + save.unlocked + '  last ' + save.lastLevel,
    'cats ' + save.stats.catsPlaced + '  scene# ' + app.sm.stack.length,
    'log ' + logger.recent().length
  ];

  var fs = th.font.micro;
  var padX = 8 * s;
  var lh = 14 * s;
  var w = 0;
  for (var i = 0; i < lines.length; i++) {
    w = Math.max(w, r.measure(lines[i], fs, '400'));
  }
  w += padX * 2;
  var h = lines.length * lh + 8 * s;
  var x = 8 * s;
  var y = app.layout.topInset() + 6 * s;

  r.save();
  r.ctx.globalAlpha = 0.78;
  r.roundRect(x, y, w, h, 6 * s, th.color.ink);
  r.ctx.globalAlpha = 1;
  for (var j = 0; j < lines.length; j++) {
    r.text(lines[j], x + padX, y + 4 * s + lh * (j + 0.5), {
      size: fs,
      weight: '400',
      color: '#9BE3C8'
    });
  }
  r.restore();
};

module.exports = Debug;
