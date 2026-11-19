/**
 * 轻提示。不打断操作，2 秒左右自动消失。
 * 同一时间只显示一条，新的顶掉旧的。
 */
function Toast(app) {
  this.app = app;
  this.text = '';
  this.t = 0;
  this.life = 0;
}

Toast.prototype.show = function (text, life) {
  if (!text) return;
  this.text = text;
  this.t = 0;
  this.life = life || 2.0;
};

Toast.prototype.clear = function () {
  this.text = '';
  this.life = 0;
};

Toast.prototype.update = function (dt) {
  if (!this.life) return;
  this.t += dt;
  if (this.t >= this.life) this.clear();
};

Toast.prototype.render = function (r) {
  if (!this.life || !this.text) return;
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;

  var a = 1;
  if (this.t < 0.16) a = this.t / 0.16;
  else if (this.t > this.life - 0.28) a = Math.max(0, (this.life - this.t) / 0.28);

  var fs = th.font.body;
  var padX = 18 * s;
  var h = 38 * s;
  var w = Math.min(r.w - 48 * s, r.measure(this.text, fs, '500') + padX * 2);
  var x = (r.w - w) / 2;
  var y = r.h * 0.76;

  r.save();
  r.ctx.globalAlpha = a;
  r.roundRect(x, y, w, h, h / 2, 'rgba(46, 42, 40, 0.86)');
  r.text(this.text, r.w / 2, y + h / 2 + 0.5, {
    size: fs,
    weight: '500',
    color: th.color.textOnColor,
    align: 'center',
    maxWidth: w - padX
  });
  r.ctx.globalAlpha = 1;
  r.restore();
};

module.exports = Toast;
