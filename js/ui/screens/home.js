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
  var L = app.layout.home();
  var progress = app.progress;
  this.L = L;

  r.fill(th.color.bg);

  this._renderBg(r);
  this._renderTop(r);
  this._renderTitle(r);
  this._renderCat(r);
  this._renderCta(r, progress);
  this._renderCards(r);
  this._renderFooter(r, progress);
};

/** 背景：两团低饱和色块 + 手账式脚印/星星，位置全部来自 layout.home().deco */
HomeScene.prototype._renderBg = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var d = this.L.deco;

  r.ctx.globalAlpha = 0.38;
  r.circle(d.blobA.cx, d.blobA.cy, d.blobA.r, th.color.brandSoft);
  r.circle(d.blobB.cx, d.blobB.cy, d.blobB.r, th.color.ctaSoft);
  r.ctx.globalAlpha = 1;

  draw.iconPaw(r, d.pawL.cx, d.pawL.cy, d.pawL.size, draw.alpha(th.color.textSoft, 0.20));
  draw.iconPaw(r, d.pawR.cx, d.pawR.cy, d.pawR.size, draw.alpha(th.color.textSoft, 0.16));
  draw.iconStar(r, d.starL.cx, d.starL.cy, d.starL.size, draw.alpha(th.color.gold, 0.35));
  draw.iconStar(r, d.starR.cx, d.starR.cy, d.starR.size, draw.alpha(th.color.gold, 0.28));

  // 猫咪舞台外圈的点状光环，随呼吸轻微明暗
  var st = d.stage;
  var pulse = 0.18 + 0.10 * ((Math.sin(this.t * 1.6) + 1) / 2);
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + i * (Math.PI * 2 / 10);
    r.circle(st.cx + Math.cos(a) * (st.r + 8 * s),
      st.cy + Math.sin(a) * (st.r + 8 * s),
      2.2 * s, draw.alpha(th.color.brand, pulse));
  }
};

HomeScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  // 金币胶囊：白底无描边，靠投影与背景分开
  draw.softShadow(r, L.coin.x, L.coin.y, L.coin.w, L.coin.h, L.coin.h / 2);
  r.roundRect(L.coin.x, L.coin.y, L.coin.w, L.coin.h, L.coin.h / 2, th.color.card);
  draw.iconCoin(r, L.coin.x + 17 * s, L.coin.y + L.coin.h / 2, 18 * s);
  r.text(String(this.app.progress.coins()), L.coin.x + 34 * s, L.coin.y + L.coin.h / 2 + 1, {
    size: th.font.small,
    weight: '700',
    color: th.color.text
  });

  // 玩法说明
  r.circle(L.help.cx, L.help.cy, L.help.r, th.color.card);
  r.text(copy.guideHelpMark, L.help.cx, L.help.cy + 1, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  // 签到
  draw.iconCircle(r, L.checkin.cx, L.checkin.cy, L.checkin.r, th.color.card,
    draw.iconCalendar, 19 * s, th.color.text);
  if (!this.app.signin.claimedToday() && !this.app.daily.guarded()) {
    var dr = 5 * s;
    r.circle(L.checkin.cx + L.checkin.r * 0.72, L.checkin.cy - L.checkin.r * 0.72, dr, th.color.dot);
    r.strokeCircle(L.checkin.cx + L.checkin.r * 0.72, L.checkin.cy - L.checkin.r * 0.72, dr, th.color.card, 1.5 * s);
  }

  // 设置
  draw.iconCircle(r, L.gear.cx, L.gear.cy, L.gear.r, th.color.card,
    draw.iconGear, 18 * s, th.color.text);
};

HomeScene.prototype._renderTitle = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var fs = th.font.homeTitle;

  // 双色标题 + 暖色投影：前两字正文色，后两字主题橙，整体居中
  var wMain = r.measure(copy.titleMain, fs, '800');
  var wAcc = r.measure(copy.titleAccent, fs, '800');
  var x0 = (r.w - wMain - wAcc) / 2;
  var dy = 2.5 * s;

  r.text(copy.titleMain, x0, L.titleY + dy, {
    size: fs, weight: '800', color: th.color.titleShadow
  });
  r.text(copy.titleAccent, x0 + wMain, L.titleY + dy, {
    size: fs, weight: '800', color: th.color.titleShadow
  });
  r.text(copy.titleMain, x0, L.titleY, {
    size: fs, weight: '800', color: th.color.text
  });
  r.text(copy.titleAccent, x0 + wMain, L.titleY, {
    size: fs, weight: '800', color: th.color.cta
  });

  // 副标题胶囊
  var k = L.kicker;
  r.roundRect(k.x, k.y, k.w, k.h, k.h / 2, th.color.card);
  r.strokeRoundRect(k.x, k.y, k.w, k.h, k.h / 2, th.color.border, 1);
  r.text(copy.subtitle, r.w / 2, k.y + k.h / 2 + 0.5, {
    size: th.font.homeKicker,
    weight: '600',
    color: th.color.textSoft,
    align: 'center',
    maxWidth: k.w - 16 * s
  });
};

HomeScene.prototype._renderCat = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var cat = this.app.collection.equippedCat();
  var st = L.deco.stage;
  var bob = Math.sin(this.t * 1.7) * 3 * s;

  // 舞台：投影 → 外圈奶油底 → 内圈白卡 → 品牌色细环 → 猫头
  draw.ellipseFill(r.ctx, st.cx, st.cy + st.r * 0.94, st.r * 0.55, st.r * 0.10, th.color.shadow);
  r.circle(st.cx, st.cy + 4 * s, st.r, th.color.bgSunken);
  r.strokeCircle(st.cx, st.cy + 4 * s, st.r, th.color.border, 1);
  r.circle(st.cx, st.cy + 4 * s, st.innerR, th.color.card);
  r.strokeCircle(st.cx, st.cy + 4 * s, st.innerR, draw.alpha(th.color.brand, 0.25), 1.5 * s);

  this._renderCatTag(r, cat, s, th, L);

  draw.catFace(r, st.cx, st.cy + bob, L.cat.size, cat, {});
};

/** 猫咪名牌：小爪印 + 「名字 · 称号」，压在舞台下沿 */
HomeScene.prototype._renderCatTag = function (r, cat, s, th, L) {
  var tag = L.catTag;
  var cx = tag.x + tag.w / 2;
  var cy = tag.y + tag.h / 2 + 0.5;
  var fs = th.font.homeCatTag;
  var label = cat.name + ' · ' + cat.title;
  var icon = 12 * s;
  var gap = 6 * s;
  var textW = r.measure(label, fs, '700');
  var startX = cx - (icon + gap + textW) / 2;

  draw.softShadow(r, tag.x, tag.y, tag.w, tag.h, tag.h / 2);
  r.roundRect(tag.x, tag.y, tag.w, tag.h, tag.h / 2, th.color.card);
  r.strokeRoundRect(tag.x, tag.y, tag.w, tag.h, tag.h / 2, th.color.border, 1);
  draw.iconPaw(r, startX + icon / 2, cy, icon, th.color.cta);
  r.text(label, startX + icon + gap, cy, {
    size: fs,
    weight: '700',
    color: th.color.text,
    maxWidth: tag.w - 12 * s
  });
};

HomeScene.prototype._renderCta = function (r, progress) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var c = L.cta;
  var label = progress.completedCount() > 0 ? copy.btnContinue : copy.btnStart;
  var depth = 4 * s;

  // 立体主按钮：底座 + 主体 + 顶部高光 + 爪印图标
  draw.softShadow(r, c.x, c.y, c.w, c.h, c.h / 2);
  r.roundRect(c.x, c.y + depth, c.w, c.h, c.h / 2, th.color.ctaDeep);
  r.roundRect(c.x, c.y, c.w, c.h, c.h / 2, th.color.cta);
  r.roundRect(c.x + c.w * 0.16, c.y + 5 * s, c.w * 0.68, 3 * s, 1.5 * s,
    draw.alpha(th.color.textOnColor, 0.22));

  var fs = th.font.homeCta;
  var tw = r.measure(label, fs, '700');
  var icon = 22 * s;
  var gap = 10 * s;
  var startX = r.w / 2 - (icon + gap + tw) / 2;
  var cy = c.y + c.h / 2 + 1;
  draw.iconPaw(r, startX + icon / 2, cy, icon, th.color.textOnColor);
  r.text(label, startX + icon + gap, cy, {
    size: fs,
    weight: '700',
    color: th.color.textOnColor
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
    // 每张卡片一种浅色调，图标底托换成白卡，避免三个白块连成一片
    r.roundRect(card.x, card.y, card.w, card.h, th.radius.card, def.bg);
    r.strokeRoundRect(card.x, card.y, card.w, card.h, th.radius.card,
      draw.alpha(def.fg, 0.20), 1);
    r.circle(cx, card.y + 27 * s, 16 * s, th.color.card);
    def.icon(r, cx, card.y + 27 * s, 18 * s, def.fg);
    r.text(def.title, cx, card.y + 54 * s, {
      size: th.font.small,
      weight: '700',
      color: th.color.text,
      align: 'center',
      maxWidth: card.w - 8 * s
    });
    r.text(def.sub, cx, card.y + 70 * s, {
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
  if (hit.inCircleLoose(x, y, L.help)) {
    app.sm.push('guide');
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
