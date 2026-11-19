/**
 * 应用装配：环境 → 布局/主题 → 渲染器 → 存档 → 服务 → 场景栈 → 主循环。
 * 所有全局单例挂在这里，界面通过 app 取用，禁止模块级可变状态。
 */
var envMod = require('./platform/env');
var Layout = require('./ui/layout');
var theme = require('./data/theme');
var Renderer = require('./ui/renderer');
var Input = require('./platform/input');
var SceneManager = require('./core/scene-manager');
var Ticker = require('./core/ticker');
var lifecycle = require('./platform/lifecycle');
var haptics = require('./platform/haptics');
var clock = require('./core/clock');
var logger = require('./core/logger');

var Save = require('./services/save');
var Progress = require('./services/progress');
var settings = require('./services/settings');

var Toast = require('./ui/widgets/toast');
var Debug = require('./ui/debug');

var HomeScene = require('./ui/screens/home');
var LevelmapScene = require('./ui/screens/levelmap');
var GameScene = require('./ui/screens/game');
var ResultScene = require('./ui/screens/result');

function App() {
  this.env = envMod.read();
  this.layout = new Layout(this.env);
  this.theme = theme.scale(this.layout.s);

  var canvas = wx.createCanvas();
  var ctx = canvas.getContext('2d');
  this.renderer = new Renderer(canvas, ctx, this.env.width, this.env.height, this.env.dpr);

  this.save = new Save();
  this.save.load();
  this.progress = new Progress(this.save);

  this.toast = new Toast(this);
  this.debug = new Debug(this);
  this.debug.init();

  this.sm = new SceneManager(this);
  this.input = new Input(this.sm);
  this.ticker = null;
  this.frames = 0;

  this._register();
}

App.prototype._register = function () {
  this.sm.register('home', function (app) { return new HomeScene(app); });
  this.sm.register('levelmap', function (app) { return new LevelmapScene(app); });
  this.sm.register('game', function (app) { return new GameScene(app); });
  this.sm.register('result', function (app) { return new ResultScene(app); });
};

App.prototype.start = function () {
  var self = this;

  this.input.bind();

  lifecycle.bind({
    onHide: function () {
      self.sm.onHide();
      self.save.flushHard();
    },
    onShow: function () { /* 目前无需刷新环境信息 */ },
    onError: function (err) { logger.error(err); }
  });

  this.sm.push('home');

  this.ticker = new Ticker(function (dt) { self.frame(dt); });
  this.ticker.start();
  return this;
};

App.prototype.frame = function (dt) {
  this.frames++;
  this.sm.update(dt);
  this.toast.update(dt);
  this.save.tick(clock.now());
  this.debug.frame(dt);
  this.render();
};

App.prototype.render = function () {
  var r = this.renderer;
  r.begin();
  this.sm.render(r);
  this.toast.render(r);
  this.debug.render(r);
};

/** 统一的触感入口，尊重设置开关 */
App.prototype.haptic = function () {
  if (!settings.get(this.save, 'haptic')) return;
  haptics.light();
};

module.exports = App;
