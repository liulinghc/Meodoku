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

function DailyScene(app) {
  this.app = app;
  this.L = null;
}

DailyScene.prototype.enter = function () {
  this.app.daily.noteSeen();
  this.app.metaRefresh();
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

  r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.card);
  r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.border, 1);

  var parts = st.date.split('-');
  var weekday = copy.dailyWeekdays[st.weekday] || '';
  r.text(format(copy.dailyDateLabel, parseInt(parts[1], 10), parseInt(parts[2], 10), weekday), c.x + 16 * s, c.y + 20 * s, {
    size: th.font.micro,
    color: th.color.textSoft
  });

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

  draw.catFace(r, c.x + c.w - 50 * s, c.y + 70 * s, 62 * s, app.collection.equippedCat(), {});

  var line = st.guarded ? copy.dailyGuarded :
    (st.cleared ? copy.dailyDoneBadge : copy.dailyGoal);
  r.text(line, c.x + 16 * s, c.y + 114 * s, {
    size: th.font.small,
    weight: '700',
    color: st.guarded ? th.color.conflict : th.color.gold,
    maxWidth: c.w - 106 * s
  });

  if (st.cleared) {
    var bx = c.x + c.w - 24 * s;
    var by = c.y + 24 * s;
    r.circle(bx, by, 11 * s, th.color.success);
    draw.iconCheck(r, bx, by, 13 * s, th.color.textOnColor);
  }
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

  r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.card);
  r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.border, 1);

  var colW = c.w / 3;
  for (var i = 0; i < cols.length; i++) {
    var cx = c.x + colW * (i + 0.5);
    r.text(String(cols[i].value), cx, c.y + 24 * s, {
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
      r.circle(cx, y + 27 * s, 8 * s, th.color.brand);
      draw.iconCheck(r, cx, y + 27 * s, 9 * s, th.color.textOnColor);
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

  r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.card);
  r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.border, 1);

  r.circle(c.x + 28 * s, c.y + c.h / 2, 16 * s, th.color.highlight);
  draw.iconCoin(r, c.x + 28 * s, c.y + c.h / 2, 18 * s, th.color.gold);

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

  if (!disabled) draw.softShadow(r, c.x, c.y, c.w, c.h, c.h / 2);
  r.roundRect(c.x, c.y, c.w, c.h, c.h / 2, disabled ? th.color.bgSunken : th.color.cta);
  r.text(label, r.w / 2, c.y + c.h / 2 + 1, {
    size: st.guarded ? th.font.body : th.font.banner,
    weight: '700',
    color: disabled ? th.color.textSoft : th.color.textOnColor,
    align: 'center',
    maxWidth: c.w - 24 * s
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
