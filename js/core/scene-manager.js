/**
 * 场景栈。只有栈顶接收输入与更新；下层保留在栈里但不渲染。
 * 进/出场景时通知 app.transition 播一次淡入；每次按下通知 app.touchFx 画水波。
 */
var logger = require('./logger');

function SceneManager(app) {
  this.app = app;
  this.factories = {};
  this.stack = [];
}

SceneManager.prototype.register = function (name, factory) {
  this.factories[name] = factory;
};

SceneManager.prototype.top = function () {
  return this.stack.length ? this.stack[this.stack.length - 1] : null;
};

SceneManager.prototype.push = function (name, params) {
  var factory = this.factories[name];
  if (!factory) { logger.error('未知场景: ' + name); return null; }
  var prev = this.top();
  if (prev && prev.pause) prev.pause();
  var scene = factory(this.app);
  scene.sceneName = name;
  this.stack.push(scene);
  if (scene.enter) scene.enter(params || {});
  if (this.app.transition) this.app.transition.start();
  return scene;
};

SceneManager.prototype.pop = function () {
  if (this.stack.length <= 1) return;
  var scene = this.stack.pop();
  if (scene && scene.exit) scene.exit();
  var top = this.top();
  if (top && top.resume) top.resume();
  if (this.app.transition) this.app.transition.start();
};

SceneManager.prototype.replace = function (name, params) {
  if (this.stack.length) {
    var scene = this.stack.pop();
    if (scene && scene.exit) scene.exit();
  }
  return this.push(name, params);
};

SceneManager.prototype.update = function (dt) {
  var top = this.top();
  if (top && top.update) top.update(dt);
};

SceneManager.prototype.render = function (r) {
  var top = this.top();
  if (top && top.render) top.render(r);
};

SceneManager.prototype.onTouchStart = function (x, y) {
  if (this.app.touchFx) this.app.touchFx.start(x, y);
  var top = this.top();
  if (top && top.onTouchStart) top.onTouchStart(x, y);
};

SceneManager.prototype.onTouchMove = function (x, y, dx, dy) {
  var top = this.top();
  if (top && top.onTouchMove) top.onTouchMove(x, y, dx, dy);
};

SceneManager.prototype.onTouchEnd = function (x, y, isTap) {
  var top = this.top();
  if (top && top.onTouchEnd) top.onTouchEnd(x, y, isTap);
};

SceneManager.prototype.onTouchCancel = function () {
  var top = this.top();
  if (top && top.onTouchCancel) top.onTouchCancel();
};

/** 切后台：自顶向下通知各场景落盘（对局需要保存续玩盘面） */
SceneManager.prototype.onHide = function () {
  for (var i = this.stack.length - 1; i >= 0; i--) {
    var s = this.stack[i];
    if (s && s.onHide) s.onHide();
  }
};

module.exports = SceneManager;
