/**
 * 首页：品牌展示 + 开始游戏 + 三个功能入口（S1 为占位）。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var config = require('../../data/config');
var cats = require('../../data/cats');
var hit = require('../hit');
var clock = require('../../core/clock');
var format = require('../../core/format');

function HomeScene(app) {
  this.app = app;
  this.t = 0;
  this.taps = [];
}

HomeScene.prototype.enter = function () {
  this.t = 0;
  this.taps = [];
  this.app.daily.noteSeen();
  this.app.metaRefresh();
};

HomeScene.prototype.update = function (dt) {
  this.t += dt;
};

HomeScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.home();
  var progress = app.progress;
  this.L = L;

  r.fill(th.color.bg);

  // 背景装饰：两团低饱和色块，避免画面过于空旷
  r.ctx.globalAlpha = 0.55;
  r.circle(r.w * 0.90, L.titleY - 42 * s, 96 * s, th.color.brandSoft);
  r.circle(r.w * 0.04, L.cat.cy + 118 * s, 72 * s, th.color.ctaSoft);
  r.ctx.globalAlpha = 1;

  this._renderTop(r);
  this._renderTitle(r);
  this._renderCat(r);
  this._renderCta(r, progress);
  this._renderCards(r);
  this._renderFooter(r, progress);
};

HomeScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  // 金币胶囊
  r.roundRect(L.coin.x, L.coin.y, L.coin.w, L.coin.h, L.coin.h / 2, th.color.card);
  r.strokeRoundRect(L.coin.x, L.coin.y, L.coin.w, L.coin.h, L.coin.h / 2, th.color.border, 1);
  draw.iconCoin(r, L.coin.x + 17 * s, L.coin.y + L.coin.h / 2, 18 * s, '#F2C94C');
  r.text(String(this.app.progress.coins()), L.coin.x + 34 * s, L.coin.y + L.coin.h / 2 + 1, {
    size: th.font.small,
    weight: '700',
    color: th.color.text
  });

  // 签到
  r.circle(L.checkin.cx, L.checkin.cy, L.checkin.r, th.color.card);
  r.strokeCircle(L.checkin.cx, L.checkin.cy, L.checkin.r, th.color.border, 1);
  draw.iconCalendar(r, L.checkin.cx, L.checkin.cy, 19 * s, th.color.text);
  if (!this.app.signin.claimedToday() && !this.app.daily.guarded()) {
    var dr = 5 * s;
    r.circle(L.checkin.cx + L.checkin.r * 0.72, L.checkin.cy - L.checkin.r * 0.72, dr, th.color.dot);
    r.strokeCircle(L.checkin.cx + L.checkin.r * 0.72, L.checkin.cy - L.checkin.r * 0.72, dr, th.color.card, 1.5 * s);
  }

  // 设置
  r.circle(L.gear.cx, L.gear.cy, L.gear.r, th.color.card);
  r.strokeCircle(L.gear.cx, L.gear.cy, L.gear.r, th.color.border, 1);
  draw.iconGear(r, L.gear.cx, L.gear.cy, 18 * s, th.color.text);
};

HomeScene.prototype._renderTitle = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  r.text(copy.title, r.w / 2, L.titleY, {
    size: Math.round(th.font.title * 1.08),
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
  r.text(copy.subtitle, r.w / 2, L.titleY + 31 * s, {
    size: th.font.body,
    weight: '500',
    color: th.color.textSoft,
    align: 'center'
  });
};

HomeScene.prototype._renderCat = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var bob = Math.sin(this.t * 1.7) * 3 * s;

  draw.ellipseFill(r.ctx, L.cat.cx, L.cat.cy + L.cat.size * 0.42, L.cat.size * 0.26, L.cat.size * 0.06, 'rgba(90, 60, 40, 0.10)');
  r.circle(L.cat.cx, L.cat.cy + 4 * s, L.cat.size * 0.60, th.color.card);
  r.strokeCircle(L.cat.cx, L.cat.cy + 4 * s, L.cat.size * 0.60, th.color.border, 1);
  draw.catFace(r, L.cat.cx, L.cat.cy + bob, L.cat.size, this.app.collection.equippedCat(), {});
};

HomeScene.prototype._renderCta = function (r, progress) {
  var th = this.app.theme;
  var L = this.L;
  var c = L.cta;
  var label = progress.completedCount() > 0 ? copy.btnContinue : copy.btnStart;

  draw.softShadow(r, c.x, c.y, c.w, c.h, c.h / 2);
  r.roundRect(c.x, c.y, c.w, c.h, c.h / 2, th.color.cta);
  r.text(label, r.w / 2, c.y + c.h / 2 + 1, {
    size: th.font.banner,
    weight: '700',
    color: th.color.textOnColor,
    align: 'center'
  });
};

HomeScene.prototype._renderCards = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var app = this.app;
  var daily = app.daily.status();
  var dailySub = daily.cleared ? format(copy.homeDailyDone, daily.streak) :
    format(copy.homeDailyNew, daily.level ? daily.level.n : 0, daily.level ? daily.level.n : 0);
  var defs = [
    { icon: draw.iconBulb, bg: th.color.brandSoft, fg: th.color.brand, title: copy.cardDaily, sub: dailySub },
    { icon: draw.iconPaw, bg: th.color.ctaSoft, fg: th.color.cta, title: copy.cardAlbum,
      sub: format(copy.homeAlbumSub, app.collection.count(), app.collection.total()) },
    { icon: draw.iconCoin, bg: th.color.highlight, fg: th.color.gold, title: copy.cardShop,
      sub: format(copy.homeShopSub, app.progress.tickets()) }
  ];

  for (var i = 0; i < L.cards.length; i++) {
    var card = L.cards[i];
    var def = defs[i];
    var cx = card.x + card.w / 2;
    r.roundRect(card.x, card.y, card.w, card.h, th.radius.card, th.color.card);
    r.strokeRoundRect(card.x, card.y, card.w, card.h, th.radius.card, th.color.border, 1);
    r.circle(cx, card.y + 26 * s, 15 * s, def.bg);
    def.icon(r, cx, card.y + 26 * s, 18 * s, def.fg);
    r.text(def.title, cx, card.y + 52 * s, {
      size: th.font.small,
      weight: '700',
      color: th.color.text,
      align: 'center',
      maxWidth: card.w - 8 * s
    });
    r.text(def.sub, cx, card.y + 68 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center',
      maxWidth: card.w - 8 * s
    });

    if (i === 0 && !daily.cleared) {
      var dr = 4.5 * s;
      r.circle(card.x + card.w - 10 * s, card.y + 10 * s, dr, th.color.dot);
      r.strokeCircle(card.x + card.w - 10 * s, card.y + 10 * s, dr, th.color.card, 1.5 * s);
    }
  }
};

HomeScene.prototype._renderFooter = function (r, progress) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  r.text(format(copy.homeStat, progress.catsPlaced()), r.w / 2, L.footerY - 16 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    align: 'center'
  });
  r.text(format(copy.version, config.VERSION, config.STAGE), r.w / 2, L.footerY + 4 * s, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center'
  });
};

HomeScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L || app.layout.home();

  if (hit.inRect(x, y, L.cta)) {
    app.sm.push('levelmap');
    return;
  }
  if (hit.inCircleLoose(x, y, L.checkin)) {
    app.sm.push('checkin');
    return;
  }
  if (hit.inCircleLoose(x, y, L.gear)) {
    app.toast.show(copy.toastGear);
    return;
  }
  if (hit.inRect(x, y, L.coin)) {
    app.sm.push('shop');
    return;
  }

  var scenes = ['daily', 'album', 'shop'];
  for (var i = 0; i < L.cards.length; i++) {
    if (hit.inRect(x, y, L.cards[i])) {
      app.sm.push(scenes[i]);
      return;
    }
  }

  // 版本号连点 5 次切换调试浮层
  if (y > L.footerY - 26 * this.app.layout.s) {
    this._tapVersion();
  }
};

HomeScene.prototype._tapVersion = function () {
  var now = clock.now();
  var arr = [];
  for (var i = 0; i < this.taps.length; i++) {
    if (now - this.taps[i] < 2500) arr.push(this.taps[i]);
  }
  arr.push(now);
  this.taps = arr;
  if (arr.length >= 5) {
    this.taps = [];
    this.app.debug.toggle();
    this.app.toast.show(this.app.debug.on ? copy.toastDebugOn : copy.toastDebugOff);
  }
};

module.exports = HomeScene;
