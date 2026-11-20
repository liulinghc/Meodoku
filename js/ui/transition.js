/**
 * 场景切换转场。
 * 进/出场景时让新画面用 200ms 淡入 + 轻微放大，减少硬切感。
 * 只做视觉，不锁输入：交互逻辑与自动化测试的节奏都不受影响。
 */
function Transition(app) {
  this.app = app;
  this.t = 0;
  this.life = 0;
}

Transition.prototype.start = function () {
  this.t = 0;
  this.life = this.app.theme.motion.transition;
};

Transition.prototype.update = function (dt) {
  if (!this.life) return;
  this.t += dt;
  if (this.t >= this.life) {
    this.t = 0;
    this.life = 0;
  }
};

/** 已缓动的进度：0（刚切换）→ 1（稳定） */
Transition.prototype.progress = function () {
  if (!this.life) return 1;
  var p = Math.max(0, Math.min(1, this.t / this.life));
  var q = 1 - p;
  return 1 - q * q * q;
};

module.exports = Transition;
