/**
 * 全局点按反馈。
 * 按下瞬间在触点扩散一圈水波，让每个按钮都有即时回应，
 * 而不必给每个控件单独维护按压态。
 * 只有视觉：不拦截输入、不影响任何判定。
 */
function TouchFx(app) {
  this.app = app;
  this.x = 0;
  this.y = 0;
  this.t = 0;
  this.life = 0;
}

TouchFx.prototype.start = function (x, y) {
  this.x = x;
  this.y = y;
  this.t = 0;
  this.life = this.app.theme.motion.ripple;
};

TouchFx.prototype.update = function (dt) {
  if (!this.life) return;
  this.t += dt;
  if (this.t >= this.life) {
    this.t = 0;
    this.life = 0;
  }
};

TouchFx.prototype.render = function (r) {
  if (!this.life) return;
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;

  var p = Math.max(0, Math.min(1, this.t / this.life));
  var ease = 1 - (1 - p) * (1 - p);
  var radius = (10 + 22 * ease) * s;

  r.save();
  r.ctx.globalAlpha = 1 - p;
  r.circle(this.x, this.y, radius, th.color.ripple);
  r.ctx.globalAlpha = 1;
  r.restore();
};

module.exports = TouchFx;
