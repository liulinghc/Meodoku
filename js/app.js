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
var clock = require('./core/clock');
var logger = require('./core/logger');

var Save = require('./services/save');
var Progress = require('./services/progress');
var Daily = require('./services/daily');
var Signin = require('./services/signin');
var Collection = require('./services/collection');
var Achievements = require('./services/achievements');
var Shop = require('./services/shop');

var Toast = require('./ui/widgets/toast');
var TouchFx = require('./ui/widgets/touch-fx');
var Transition = require('./ui/transition');
var Debug = require('./ui/debug');

var HomeScene = require('./ui/screens/home');
var GuideScene = require('./ui/screens/guide');
var LevelmapScene = require('./ui/screens/levelmap');
var GameScene = require('./ui/screens/game');
var ResultScene = require('./ui/screens/result');
var DailyScene = require('./ui/screens/daily');
var CheckinScene = require('./ui/screens/checkin');
var AlbumScene = require('./ui/screens/album');
var AchievementsScene = require('./ui/screens/achievements');
var ShopScene = require('./ui/screens/shop');

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
  this.collection = new Collection(this.progress);
  this.daily = new Daily(this.progress);
  this.signin = new Signin(this.progress, this.daily);
  this.achievements = new Achievements(this.progress, this.collection);
  this.shop = new Shop(this.progress);
  this.applySkin();

  this.toast = new Toast(this);
  this.touchFx = new TouchFx(this);
  this.transition = new Transition(this);
  this.debug = new Debug(this);
  this.debug.init();

  this.sm = new SceneManager(this);
  this.input = new Input(this.sm);
  this.ticker = null;
  this.frames = 0;

  this._register();
  this.daily.noteSeen();
  this.metaRefresh();
}

App.prototype._register = function () {
  this.sm.register('home', function (app) { return new HomeScene(app); });
  this.sm.register('guide', function (app) { return new GuideScene(app); });
  this.sm.register('levelmap', function (app) { return new LevelmapScene(app); });
  this.sm.register('game', function (app) { return new GameScene(app); });
  this.sm.register('result', function (app) { return new ResultScene(app); });
  this.sm.register('daily', function (app) { return new DailyScene(app); });
  this.sm.register('checkin', function (app) { return new CheckinScene(app); });
  this.sm.register('album', function (app) { return new AlbumScene(app); });
  this.sm.register('achievements', function (app) { return new AchievementsScene(app); });
  this.sm.register('shop', function (app) { return new ShopScene(app); });
};

/** 立即应用当前棋盘皮肤 */
App.prototype.applySkin = function () {
  this.theme.region = theme.palette(this.progress.currentSkin());
};

/**
 * 统一处理“进度变化后可能解锁的新内容”：
 * 猫 → 成就 → 再检查猫（图鉴数量成就可能触发成就猫）。
 */
App.prototype.metaRefresh = function () {
  var cats = this.collection.refresh();
  var achievements = this.achievements.check();
  cats = cats.concat(this.collection.refresh());
  achievements = achievements.concat(this.achievements.check());
  return { cats: cats, achievements: achievements };
};

App.prototype.start = function () {
  var self = this;

  this.input.bind();

  lifecycle.bind({
    onHide: function () {
      self.sm.onHide();
      self.save.flushHard();
    },
    onShow: function () {
      self.daily.noteSeen();
      self.metaRefresh();
    },
    onError: function (err) { logger.error(err); }
  });

  this.sm.push('home');
  if (!this.save.data.guideSeen) this.sm.push('guide');

  this.ticker = new Ticker(function (dt) { self.frame(dt); });
  this.ticker.start();
  return this;
};

App.prototype.frame = function (dt) {
  this.frames++;
  this.sm.update(dt);
  this.toast.update(dt);
  this.touchFx.update(dt);
  this.transition.update(dt);
  this.save.tick(clock.now());
  this.debug.frame(dt);
  this.render();
};

App.prototype.render = function () {
  var r = this.renderer;
  r.begin();
  // 先铺底色：场景在转场时是半透明的，不能透出上一帧
  r.fill(this.theme.color.bg);

  var p = this.transition.progress();
  if (p < 1) {
    var s = 0.985 + 0.015 * p;
    r.save();
    // 从 30% 透明度起步，避免切换瞬间整屏闪回奶油底
    r.ctx.globalAlpha = 0.3 + 0.7 * p;
    r.ctx.translate(r.w / 2, r.h / 2);
    r.ctx.scale(s, s);
    r.ctx.translate(-r.w / 2, -r.h / 2);
  }
  this.sm.render(r);
  if (p < 1) {
    r.ctx.globalAlpha = 1;
    r.restore();
  }

  this.touchFx.render(r);
  this.toast.render(r);
  this.debug.render(r);
};

module.exports = App;
