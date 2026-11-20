/**
 * 每日挑战：今日题面、连胜、最近 7 天与奖励说明。
 * 同一本地日期在所有设备上取同一道题（包内日历池）。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var hit = require('../hit');
var format = require('../../core/format');
var date = require('../../core/date');
var config = require('../../data/config');
var uiKit = require('../widgets/ui-kit');

function DailyScene(app) {
  this.app = app;
  this.L = null;
  this.t = 0;
}

DailyScene.prototype.enter = function () {
  this.t = 0;
  this.app.daily.noteSeen();
  this.app.metaRefresh();
};

DailyScene.prototype.update = function (dt) {
  this.t += dt;
};

/** 历史格子的盖章回弹：按列错峰，只做视觉 */
DailyScene.prototype._stampScale = function (i) {
  var p = uiKit.clamp01((this.t - 0.12 - i * 0.05) / 0.26);
  return p <= 0 ? 0 : uiKit.easeOutBack(p);
};

/** 连胜火焰轻跳 */
DailyScene.prototype._flameBounce = function () {
  return Math.sin(this.t * 4) * 1.5 * this.app.layout.s;
};

DailyScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.daily();
  var st = app.daily.status();
  this.L = L;

  r.fill(th.color.bg);

  this._renderTop(r);
  this._renderHero(r, st);
  this._renderStats(r, st);
  this._renderHistory(r, st);
  this._renderReward(r, st);
  this._renderCta(r, st);
  r.ctx.globalAlpha = 1;
};

DailyScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.text(copy.dailyTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.pageTitle,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
};

DailyScene.prototype._renderHero = function (r, st) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var c = L.hero;
  var lv = st.level;

  uiKit.card(r, c, th);

  var parts = st.date.split('-');
  var weekday = copy.dailyWeekdays[st.weekday] || '';

  // 日期印章：右上角圆形戳，通关后换成成功色并盖对勾
  var d = c.date;
  var stampColor = st.guarded ? th.color.conflict : th.color.gold;
  r.circle(d.cx, d.cy, d.r, st.cleared ? th.color.successSoft : th.color.surfaceWarm);
  r.strokeCircle(d.cx, d.cy, d.r, st.cleared ? th.color.success : stampColor, 1.6 * s);
  r.strokeCircle(d.cx, d.cy, d.r - 4 * s, draw.alpha(stampColor, 0.18), 1);
  r.text(parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10), d.cx, d.cy - 4 * s, {
    size: th.font.small,
    weight: '800',
    color: st.cleared ? th.color.success : th.color.text,
    align: 'center'
  });
  r.text(weekday.slice(1), d.cx, d.cy + 8 * s, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center'
  });
  if (st.cleared) {
    var bx = d.cx + d.r * 0.72;
    var by = d.cy + d.r * 0.72;
    r.circle(bx, by, 7 * s, th.color.success);
    draw.iconCheck(r, bx, by, 8 * s, th.color.textOnColor);
  }

  r.text(copy.dailyCardLabel, c.x + 16 * s, c.y + 46 * s, {
    size: th.font.banner,
    weight: '800',
    color: th.color.text
  });

  var meta = '';
  if (lv) {
    var tierName = copy.tierNames[(lv.tier || 3) - 1] || '';
    meta = (tierName ? tierName + ' · ' : '') + lv.n + ' × ' + lv.n;
  }
  r.text(meta, c.x + 16 * s, c.y + 72 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    maxWidth: c.w - 110 * s
  });

  draw.catFace(r, c.cat.cx, c.cat.cy, c.cat.size, app.collection.equippedCat(), {});

  var line = st.guarded ? copy.dailyGuarded :
    (st.cleared ? copy.dailyDoneBadge : copy.dailyGoal);
  r.text(line, c.x + 16 * s, c.y + 114 * s, {
    size: th.font.small,
    weight: '700',
    color: st.guarded ? th.color.conflict : th.color.gold,
    maxWidth: c.w - 106 * s
  });
};

DailyScene.prototype._renderStats = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var c = L.stats;
  var cols = [
    { value: st.streak, label: copy.dailyStatStreak },
    { value: st.bestStreak, label: copy.dailyStatBest },
    { value: st.total, label: copy.dailyStatTotal }
  ];

  uiKit.card(r, c, th);

  var colW = c.w / 3;
  for (var i = 0; i < cols.length; i++) {
    var cx = c.x + colW * (i + 0.5);
    var value = String(cols[i].value);
    var vw = r.measure(value, th.font.hudValue, '800');
    if (i === 0) {
      draw.iconFlame(r, cx - vw / 2 - 10 * s, c.y + 23 * s + this._flameBounce(),
        14 * s, th.color.cta);
    }
    r.text(value, cx, c.y + 24 * s, {
      size: th.font.hudValue,
      weight: '800',
      color: i === 0 ? th.color.cta : th.color.text,
      align: 'center'
    });
    r.text(cols[i].label, cx, c.y + 46 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center'
    });
    if (i > 0) {
      r.line(c.x + colW * i, c.y + 16 * s, c.x + colW * i, c.y + c.h - 16 * s, th.color.border, 1);
    }
  }
};

DailyScene.prototype._renderHistory = function (r, st) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var hist = L.history;
  var recent = app.daily.recent(7);

  r.text(copy.dailyHistoryTitle, L.margin, L.historyLabelY, {
    size: th.font.small,
    weight: '600',
    color: th.color.text
  });

  for (var i = 0; i < recent.length; i++) {
    var item = recent[i];
    var x = hist.x + i * (hist.cellW + hist.gap);
    var y = hist.y;
    var weekday = copy.dailyWeekdays[date.weekday(item.date)] || '';

    if (item.done) {
      r.roundRect(x, y, hist.cellW, hist.h, 8 * s, th.color.brandSoft);
    } else {
      r.roundRect(x, y, hist.cellW, hist.h, 8 * s, th.color.card);
      r.strokeRoundRect(x, y, hist.cellW, hist.h, 8 * s, th.color.border, 1);
    }
    if (item.today) {
      r.strokeRoundRect(x, y, hist.cellW, hist.h, 8 * s, th.color.cta, 1.5 * s);
    }

    r.text(weekday.slice(1), x + hist.cellW / 2, y + 12 * s, {
      size: th.font.micro,
      color: item.done || item.today ? th.color.text : th.color.textSoft,
      align: 'center'
    });

    var cx = x + hist.cellW / 2;
    if (item.done) {
      uiKit.stamp(r, cx, y + 27 * s, 8 * s, th.color.brand, th, {
        scale: this._stampScale(i)
      });
    } else if (item.today) {
      r.circle(cx, y + 27 * s, 7 * s, th.color.ctaSoft);
      r.circle(cx, y + 27 * s, 3 * s, th.color.cta);
    } else {
      r.circle(cx, y + 27 * s, 4 * s, th.color.bgSunken);
    }
  }
};

DailyScene.prototype._renderReward = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var c = L.reward;

  uiKit.card(r, c, th);

  uiKit.iconTray(r, c.x + 28 * s, c.y + c.h / 2, 16 * s,
    th.color.gold, draw.iconCoin, 18 * s, th.color.gold);

  r.text(copy.dailyRewardTitle, c.x + 54 * s, c.y + 20 * s, {
    size: th.font.small,
    weight: '700',
    color: th.color.text
  });
  var rewardDesc = st.guarded
    ? copy.dailyGuarded
    : format(copy.dailyRewardDesc, config.DAILY_BASE_COINS);
  r.text(rewardDesc, c.x + 54 * s, c.y + 38 * s, {
    size: th.font.micro,
    color: st.guarded ? th.color.conflict : th.color.textSoft,
    maxWidth: c.w - 70 * s
  });
  r.text(format(copy.dailyStreakBonus, config.DAILY_STREAK_BONUS_MAX), c.x + 54 * s, c.y + 53 * s, {
    size: th.font.micro,
    color: th.color.gold,
    maxWidth: c.w - 70 * s
  });
};

DailyScene.prototype._renderCta = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var c = this.L.cta;
  var unavailable = !st.level;
  var disabled = st.guarded || unavailable;
  var label = st.cleared ? copy.dailyReplay : copy.dailyPlay;
  if (st.guarded) label = copy.dailyGuarded;
  if (unavailable) label = copy.toastDailyUnavailable;

  uiKit.button(r, c, label, th, {
    disabled: disabled,
    size: st.guarded ? th.font.body : th.font.banner
  });
};

DailyScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L;
  if (!L) return;

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }

  if (hit.inRect(x, y, L.cta)) {
    var st = app.daily.status();
    if (!st.level) {
      app.toast.show(copy.toastDailyUnavailable);
      return;
    }
    if (st.guarded) {
      app.toast.show(copy.toastTimeGuarded);
      return;
    }
    app.sm.push('game', { mode: 'daily' });
  }
};

module.exports = DailyScene;
