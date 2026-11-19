/**
 * 连续签到：7 日循环、补签卡与累计里程碑。
 * 补签只在“漏签 1 天、有卡、本周未用”时出现，且不跨过今天。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var hit = require('../hit');
var format = require('../../core/format');
var date = require('../../core/date');
var config = require('../../data/config');

function CheckinScene(app) {
  this.app = app;
  this.L = null;
  this.makeupMode = 0;
}

CheckinScene.prototype.enter = function () {
  this.app.daily.noteSeen();
  this.app.metaRefresh();
};

CheckinScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.checkin();
  var st = app.signin.status();
  this.L = L;
  this.makeupMode = this._makeupMode(st);

  r.fill(th.color.bg);
  r.ctx.globalAlpha = 0.5;
  r.circle(r.w * 0.92, L.topBar.y + 110 * s, 78 * s, th.color.ctaSoft);
  r.circle(r.w * 0.05, L.week.y + 150 * s, 64 * s, th.color.brandSoft);
  r.ctx.globalAlpha = 1;

  this._renderTop(r);
  this._renderStats(r, st);
  this._renderWeek(r);
  this._renderMilestones(r);
  this._renderMakeup(r, st);
  this._renderClaim(r, st);
};

CheckinScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  r.circle(L.back.cx, L.back.cy, L.back.r, th.color.card);
  r.strokeCircle(L.back.cx, L.back.cy, L.back.r, th.color.border, 1);
  draw.iconBack(r, L.back.cx, L.back.cy, 20 * s, th.color.text);

  r.text(copy.checkinTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });
};

CheckinScene.prototype._renderStats = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var c = L.stats;
  var cols = [
    { value: st.streak, label: copy.checkinStatStreak },
    { value: st.totalDays, label: copy.checkinStatTotal },
    { value: st.makeupCards, label: copy.checkinStatCards }
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

CheckinScene.prototype._renderWeek = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var week = this.app.signin.week();
  var w = L.week;

  for (var i = 0; i < week.length; i++) {
    var item = week[i];
    var x = w.x + i * (w.cellW + w.gap);
    var y = w.y;
    var cx = x + w.cellW / 2;

    r.roundRect(x, y, w.cellW, w.cellH, 8 * s, item.done ? th.color.brandSoft : th.color.card);
    r.strokeRoundRect(x, y, w.cellW, w.cellH, 8 * s,
      item.current ? th.color.cta : th.color.border,
      item.current ? 1.5 * s : 1);

    r.text(format(copy.checkinDayShort, item.day), cx, y + 14 * s, {
      size: th.font.micro,
      color: item.current ? th.color.cta : th.color.textSoft,
      align: 'center'
    });

    var amount = String(item.reward.coins);
    var textW = r.measure(amount, th.font.small, '700');
    var icon = 11 * s;
    var groupW = icon + 2 * s + textW;
    var gx = cx - groupW / 2;
    draw.iconCoin(r, gx + icon / 2, y + 44 * s, icon, th.color.gold);
    r.text(amount, gx + icon + 2 * s, y + 44 * s, {
      size: th.font.small,
      weight: '700',
      color: th.color.text
    });

    var hasTicket = item.reward.tickets > 0;
    var hasFrag = item.reward.fragments > 0;
    if (hasTicket && hasFrag) {
      draw.iconTicket(r, cx - 7 * s, y + w.cellH - 14 * s, 12 * s, th.color.gold);
      draw.iconPaw(r, cx + 7 * s, y + w.cellH - 14 * s, 12 * s, th.color.cta);
    } else if (hasTicket) {
      draw.iconTicket(r, cx, y + w.cellH - 14 * s, 13 * s, th.color.gold);
    } else if (hasFrag) {
      draw.iconPaw(r, cx, y + w.cellH - 14 * s, 13 * s, th.color.cta);
    }

    if (item.done) {
      var bx = x + w.cellW - 9 * s;
      var by = y + 9 * s;
      r.circle(bx, by, 6 * s, th.color.brand);
      draw.iconCheck(r, bx, by, 7 * s, th.color.textOnColor);
    }
  }
};

CheckinScene.prototype._renderMilestones = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var ms = this.app.signin.milestones();
  var box = L.miles;

  r.text(copy.checkinMilestone, L.margin, L.mileLabelY, {
    size: th.font.small,
    weight: '600',
    color: th.color.text
  });

  for (var i = 0; i < ms.length; i++) {
    var m = ms[i];
    var x = box.x + i * (box.itemW + box.gap);
    var y = box.y;
    var cx = x + box.itemW / 2;

    r.roundRect(x, y, box.itemW, box.itemH, 8 * s,
      m.reached ? th.color.brandSoft : th.color.card);
    r.strokeRoundRect(x, y, box.itemW, box.itemH, 8 * s,
      m.reached ? th.color.brand : th.color.border, 1);

    r.text(format(copy.checkinMilestoneDays, m.days), cx, y + 16 * s, {
      size: th.font.micro,
      weight: '600',
      color: m.reached ? th.color.text : th.color.textSoft,
      align: 'center'
    });

    this._drawMilestoneReward(r, cx, y + box.itemH - 17 * s, m, m.reached);

    if (m.claimed) {
      var bx = x + box.itemW - 8 * s;
      var by = y + 8 * s;
      r.circle(bx, by, 5.5 * s, th.color.brand);
      draw.iconCheck(r, bx, by, 6.5 * s, th.color.textOnColor);
    }
  }
};

CheckinScene.prototype._drawMilestoneReward = function (r, cx, y, m, active) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var color = active ? th.color.text : th.color.textSoft;
  var iconSize = 10 * s;
  var gap = 2 * s;
  var between = 5 * s;
  var groups = [];
  var i;

  if (m.coins) groups.push({ icon: 'coin', text: String(m.coins) });
  if (m.tickets) groups.push({ icon: 'ticket', text: String(m.tickets) });
  if (m.makeup) groups.push({ icon: '', text: copy.checkinRewardMakeup });

  var widths = [];
  var total = 0;
  for (i = 0; i < groups.length; i++) {
    var gw = (groups[i].icon ? iconSize + gap : 0) + r.measure(groups[i].text, th.font.micro, '600');
    widths.push(gw);
    total += gw;
  }
  total += between * Math.max(0, groups.length - 1);

  var x = cx - total / 2;
  for (i = 0; i < groups.length; i++) {
    var g = groups[i];
    var tx = x;
    if (g.icon === 'coin') {
      draw.iconCoin(r, x + iconSize / 2, y, iconSize, th.color.gold);
      tx += iconSize + gap;
    } else if (g.icon === 'ticket') {
      draw.iconTicket(r, x + iconSize / 2, y, iconSize, th.color.gold);
      tx += iconSize + gap;
    }
    r.text(g.text, tx, y, {
      size: th.font.micro,
      weight: '600',
      color: color
    });
    x += widths[i] + between;
  }
};

CheckinScene.prototype._makeupMode = function (st) {
  if (st.gap === 2) {
    var s = this.app.save.data.signin;
    var weekUsed = s.makeupWeek === date.weekKey(st.date) &&
      s.makeupUsed >= config.MAKEUP_WEEKLY_LIMIT;
    if (weekUsed) return 3;
    if (st.makeupCards <= 0) return 2;
    return 1;
  }
  if (st.missed) return 4;
  return 0;
};

CheckinScene.prototype._renderMakeup = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var c = L.makeup;
  var mode = this.makeupMode;
  if (!mode) return;

  if (mode === 1) {
    r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.highlight);
    r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.gold, 1);
    r.text(copy.checkinMakeup, r.w / 2, c.y + c.h / 2 + 1, {
      size: th.font.small,
      weight: '700',
      color: th.color.text,
      align: 'center',
      maxWidth: c.w - 24 * s
    });
    return;
  }

  if (mode === 2) {
    r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.card);
    r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.border, 1);
    r.text(copy.toastNoMakeupCard, c.x + 14 * s, c.y + c.h / 2, {
      size: th.font.micro,
      color: th.color.textSoft,
      maxWidth: c.w - 92 * s
    });
    var pw = 62 * s;
    var px = c.x + c.w - pw - 10 * s;
    var py = c.y + (c.h - 26 * s) / 2;
    r.roundRect(px, py, pw, 26 * s, 13 * s, th.color.brandSoft);
    r.text(copy.checkinShop, px + pw / 2, py + 13 * s, {
      size: th.font.micro,
      weight: '700',
      color: th.color.bandDeep,
      align: 'center'
    });
    return;
  }

  var text = mode === 3 ? copy.checkinMakeupLimit : copy.checkinMissed;
  r.text(text, r.w / 2, c.y + c.h / 2, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center',
    maxWidth: c.w - 16 * s
  });
};

CheckinScene.prototype._renderClaim = function (r, st) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var c = this.L.claim;
  var disabled = st.claimed || st.guarded;
  var label = st.claimed ? copy.checkinDone : copy.checkinBtn;
  if (st.guarded) label = copy.dailyGuarded;

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

CheckinScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L;
  if (!L) return;

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }

  if (this.makeupMode && hit.inRect(x, y, L.makeup)) {
    if (this.makeupMode === 2) {
      app.sm.push('shop');
      return;
    }
    if (this.makeupMode === 1) {
      var mr = app.signin.makeup();
      if (mr.ok) {
        app.metaRefresh();
        app.toast.show(copy.toastMakeupDone);
      } else if (mr.reason === 'guarded') {
        app.toast.show(copy.toastTimeGuarded);
      } else if (mr.reason === 'card') {
        app.toast.show(copy.toastNoMakeupCard);
      } else {
        app.toast.show(copy.toastMakeupLimit);
      }
    }
    return;
  }

  if (hit.inRect(x, y, L.claim)) {
    var st = app.signin.status();
    if (st.claimed) {
      app.toast.show(copy.toastCheckinToday);
      return;
    }
    if (st.guarded) {
      app.toast.show(copy.toastTimeGuarded);
      return;
    }
    var res = app.signin.claim();
    if (res.ok) {
      app.metaRefresh();
      app.toast.show(copy.toastCheckinDone);
    } else if (res.reason === 'guarded') {
      app.toast.show(copy.toastTimeGuarded);
    } else if (res.reason === 'future') {
      app.toast.show(copy.toastTimeGuarded);
    } else {
      app.toast.show(copy.toastCheckinToday);
    }
  }
};

module.exports = CheckinScene;
