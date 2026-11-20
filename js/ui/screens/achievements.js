/**
 * 成就列表：展示进度，奖励由玩家手动领取。
 * 阶段 6 统一行卡片、图标托、进度条与领取按钮，并补领取后的金币飞行。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var config = require('../../data/config');
var hit = require('../hit');
var format = require('../../core/format');
var uiKit = require('../widgets/ui-kit');

var FLIGHT_LIFE = 0.66;

function AchievementsScene(app) {
  this.app = app;
  this.L = null;
  this.rows = [];
  this.t = 0;
  this.flights = [];
  this.walletBounce = 0;
}

AchievementsScene.prototype.enter = function () {
  this.t = 0;
  this.flights = [];
  this.walletBounce = 0;
  this.app.metaRefresh();
  this.rows = [];
};

AchievementsScene.prototype.update = function (dt) {
  this.t += dt;
  if (this.walletBounce > 0) {
    this.walletBounce = Math.max(0, this.walletBounce - dt * 2.4);
  }

  var alive = [];
  for (var i = 0; i < this.flights.length; i++) {
    var f = this.flights[i];
    f.t += dt;
    if (f.t >= FLIGHT_LIFE) {
      this.walletBounce = 1;
    } else {
      alive.push(f);
    }
  }
  this.flights = alive;
};

AchievementsScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.achievements();
  this.L = L;

  r.fill(th.color.bg);

  this._renderTop(r);
  this._renderRows(r);
  this._renderFlights(r);
  r.ctx.globalAlpha = 1;
};

AchievementsScene.prototype._renderTop = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.text(copy.achievementsTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.pageTitle,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });

  // 顶栏资源胶囊：领取后金币飞向这里，数字弹跳一下
  var w = L.wallet;
  uiKit.card(r, w, th, { shadow: false, radius: w.h / 2, fill: th.color.surfaceWarm });
  draw.iconCoin(r, w.coin.cx, w.coin.cy, 13 * s, th.color.gold);
  r.text(String(app.progress.coins()), w.coin.cx + 9 * s, w.coin.cy, {
    size: th.font.small * (1 + 0.16 * this.walletBounce),
    weight: '700',
    color: th.color.text,
    maxWidth: 34 * s
  });
  draw.iconTicket(r, w.ticket.cx, w.ticket.cy, 13 * s, th.color.gold);
  r.text(String(app.progress.tickets()), w.ticket.cx + 9 * s, w.ticket.cy, {
    size: th.font.small,
    weight: '700',
    color: th.color.text,
    maxWidth: 30 * s
  });

  r.text(format(copy.achievementsCount, app.achievements.count(), config.ACHIEVEMENTS.length), L.margin, L.summaryY, {
    size: th.font.small,
    color: th.color.textSoft
  });
};

AchievementsScene.prototype._rewardShort = function (def) {
  if (def.tickets) return format(copy.achievementRewardShortTicket, def.coins, def.tickets);
  return format(copy.achievementRewardShort, def.coins);
};

AchievementsScene.prototype._renderRows = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var list = L.list;
  var rows = [];
  var breath = 0.5 + 0.5 * Math.sin(this.t * 4);

  for (var i = 0; i < config.ACHIEVEMENTS.length; i++) {
    var def = config.ACHIEVEMENTS[i];
    var meta = copy.achievements[def.id] || { name: def.id, desc: '' };
    var unlocked = app.achievements.isUnlocked(def.id);
    var claimed = app.achievements.isClaimed(def.id);
    var p = app.achievements.progressOf(def);
    var y = list.y + i * (list.rowH + list.gap);
    var row = { x: list.x, y: y, w: list.w, h: list.rowH, id: def.id };
    rows.push(row);

    uiKit.card(r, row, th, { shadow: false, radius: 10 * s });

    var trayX = row.x + 24 * s;
    var trayY = row.y + row.h / 2;
    uiKit.iconTray(r, trayX, trayY, 15 * s,
      unlocked ? th.color.highlight : th.color.bgSunken,
      draw.iconStar, 14 * s, unlocked ? th.color.gold : th.color.textSoft);

    var textX = row.x + 44 * s;
    var hasBtn = unlocked && !claimed;
    var rightW = hasBtn ? 78 * s : 58 * s;

    r.text(meta.name, textX, row.y + row.h * 0.30, {
      size: th.font.small,
      weight: '700',
      color: unlocked ? th.color.text : th.color.textSoft,
      maxWidth: row.w - (textX - row.x) - rightW
    });

    r.text(meta.desc + ' · ' + this._rewardShort(def), textX, row.y + row.h * 0.58, {
      size: th.font.micro,
      color: th.color.textSoft,
      maxWidth: row.w - (textX - row.x) - rightW
    });

    var bar = {
      x: textX,
      y: row.y + row.h - 8 * s,
      w: row.w - (textX - row.x) - rightW,
      h: 4 * s
    };
    row.bar = bar;
    var ratio = unlocked ? 1 : (p.target > 0 ? p.current / p.target : 0);
    uiKit.progress(r, bar, ratio, th, {
      color: claimed ? th.color.success : th.color.brand
    });

    if (hasBtn) {
      var bw = 66 * s;
      var bh = Math.min(28 * s, row.h - 14 * s);
      var bx = row.x + row.w - 12 * s - bw;
      var by = row.y + (row.h - bh) / 2;
      var btn = { x: bx, y: by, w: bw, h: bh };
      row.btn = btn;
      uiKit.button(r, btn, copy.achievementClaimBtn, th, {
        breath: breath,
        size: th.font.small
      });
    } else if (claimed) {
      var ccy = row.y + row.h * 0.38;
      var ccx = row.x + row.w - 46 * s;
      r.circle(ccx, ccy, 8 * s, th.color.successSoft);
      draw.iconCheck(r, ccx, ccy, 9 * s, th.color.success);
      r.text(copy.achievementClaimed, row.x + row.w - 12 * s, ccy, {
        size: th.font.micro,
        color: th.color.textSoft,
        align: 'right'
      });
    } else {
      r.text(format(copy.achievementProgress, p.current, p.target), row.x + row.w - 12 * s, row.y + row.h * 0.42, {
        size: th.font.micro,
        weight: '600',
        color: th.color.textSoft,
        align: 'right'
      });
    }
  }

  this.rows = rows;
};

/** 金币从领取按钮沿抛物线飞向顶栏金币图标 */
AchievementsScene.prototype._spawnFlight = function (btn) {
  if (!btn) return;
  var to = this.L.wallet.coin;
  this.flights.push({
    t: 0,
    from: { x: btn.x + btn.w / 2, y: btn.y + btn.h / 2 },
    to: { x: to.cx, y: to.cy }
  });
};

AchievementsScene.prototype._renderFlights = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  for (var i = 0; i < this.flights.length; i++) {
    var f = this.flights[i];
    for (var k = 0; k < 3; k++) {
      var p = uiKit.clamp01((f.t - k * 0.07) / 0.42);
      if (p <= 0 || p >= 1) continue;
      var x = f.from.x + (f.to.x - f.from.x) * p;
      var y = f.from.y + (f.to.y - f.from.y) * p - Math.sin(Math.PI * p) * 24 * s;
      draw.iconCoin(r, x, y, (8 - k) * s, th.color.gold);
    }
  }
};

AchievementsScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L;
  if (!L) return;

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }

  for (var i = 0; i < this.rows.length; i++) {
    var row = this.rows[i];
    if (row.btn && hit.inRect(x, y, row.btn)) {
      var res = app.achievements.claim(row.id);
      if (res.ok) {
        this._spawnFlight(row.btn);
        app.metaRefresh();
        app.toast.show(copy.toastAchievementClaimed);
      }
      return;
    }
  }
};

module.exports = AchievementsScene;
