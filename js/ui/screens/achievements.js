/**
 * 成就列表：展示进度，奖励由玩家手动领取。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var config = require('../../data/config');
var hit = require('../hit');
var format = require('../../core/format');

function AchievementsScene(app) {
  this.app = app;
  this.L = null;
  this.rows = [];
}

AchievementsScene.prototype.enter = function () {
  this.app.metaRefresh();
  this.rows = [];
};

AchievementsScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.achievements();
  this.L = L;

  r.fill(th.color.bg);
  r.ctx.globalAlpha = 0.5;
  r.circle(r.w * 0.93, L.topBar.y + 150 * s, 84 * s, th.color.brandSoft);
  r.ctx.globalAlpha = 1;

  this._renderTop(r);
  this._renderRows(r);
};

AchievementsScene.prototype._renderTop = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;

  r.circle(L.back.cx, L.back.cy, L.back.r, th.color.card);
  r.strokeCircle(L.back.cx, L.back.cy, L.back.r, th.color.border, 1);
  draw.iconBack(r, L.back.cx, L.back.cy, 20 * s, th.color.text);

  r.text(copy.achievementsTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
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

  for (var i = 0; i < config.ACHIEVEMENTS.length; i++) {
    var def = config.ACHIEVEMENTS[i];
    var meta = copy.achievements[def.id] || { name: def.id, desc: '' };
    var unlocked = app.achievements.isUnlocked(def.id);
    var claimed = app.achievements.isClaimed(def.id);
    var p = app.achievements.progressOf(def);
    var y = list.y + i * (list.rowH + list.gap);
    var row = { x: list.x, y: y, w: list.w, h: list.rowH, id: def.id };
    rows.push(row);

    r.roundRect(row.x, row.y, row.w, row.h, 10 * s, th.color.card);
    r.strokeRoundRect(row.x, row.y, row.w, row.h, 10 * s, th.color.border, 1);

    r.text(meta.name, row.x + 14 * s, row.y + 17 * s, {
      size: th.font.small,
      weight: '700',
      color: unlocked ? th.color.text : th.color.textSoft
    });

    var btnW = 72 * s;
    var rightW = btnW + 16 * s;
    r.text(meta.desc + ' · ' + this._rewardShort(def), row.x + 14 * s, row.y + 34 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      maxWidth: row.w - 14 * s - rightW - 8 * s
    });

    if (unlocked && !claimed) {
      var bw = btnW;
      var bh = 30 * s;
      var bx = row.x + row.w - 12 * s - bw;
      var by = row.y + (row.h - bh) / 2;
      var btn = { x: bx, y: by, w: bw, h: bh };
      row.btn = btn;
      r.roundRect(bx, by, bw, bh, bh / 2, th.color.cta);
      r.text(copy.achievementClaimBtn, bx + bw / 2, by + bh / 2 + 1, {
        size: th.font.small,
        weight: '700',
        color: th.color.textOnColor,
        align: 'center'
      });
    } else if (claimed) {
      var ccx = row.x + row.w - 50 * s;
      var ccy = row.y + row.h / 2;
      r.circle(ccx, ccy, 9 * s, th.color.brandSoft);
      draw.iconCheck(r, ccx, ccy, 10 * s, th.color.success);
      r.text(copy.achievementClaimed, row.x + row.w - 12 * s, ccy, {
        size: th.font.micro,
        color: th.color.textSoft,
        align: 'right'
      });
    } else {
      r.text(format(copy.achievementProgress, p.current, p.target), row.x + row.w - 12 * s, row.y + row.h / 2, {
        size: th.font.micro,
        weight: '600',
        color: th.color.textSoft,
        align: 'right'
      });
    }
  }

  this.rows = rows;
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
        app.haptic();
        app.metaRefresh();
        app.toast.show(copy.toastAchievementClaimed);
      }
      return;
    }
  }
};

module.exports = AchievementsScene;
