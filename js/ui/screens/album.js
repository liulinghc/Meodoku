/**
 * 猫咪图鉴：16 只猫、解锁条件、出战与碎片合成。
 * 图鉴只改变棋盘猫的外观，不提供任何数值加成。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var cats = require('../../data/cats');
var hit = require('../hit');
var format = require('../../core/format');
var config = require('../../data/config');

var RARITY_COLOR = {
  common: 'rarityCommon',
  rare: 'rarityRare',
  epic: 'rarityEpic'
};

function AlbumScene(app) {
  this.app = app;
  this.L = null;
  this.selected = null;
  this.cells = [];
  this.detailAction = '';
}

AlbumScene.prototype.enter = function (params) {
  this.selected = (params && params.catId) || null;
  this.cells = [];
};

AlbumScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.album();
  this.L = L;

  r.fill(th.color.bg);
  r.ctx.globalAlpha = 0.5;
  r.circle(r.w * 0.93, L.topBar.y + 120 * s, 78 * s, th.color.brandSoft);
  r.circle(r.w * 0.05, L.grid.y + L.grid.h - 40 * s, 70 * s, th.color.ctaSoft);
  r.ctx.globalAlpha = 1;

  this._renderTop(r);
  this._renderPills(r);
  this._renderGrid(r);

  if (this.selected) this._renderDetail(r);
};

AlbumScene.prototype._renderTop = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var ach = L.ach;

  r.circle(L.back.cx, L.back.cy, L.back.r, th.color.card);
  r.strokeCircle(L.back.cx, L.back.cy, L.back.r, th.color.border, 1);
  draw.iconBack(r, L.back.cx, L.back.cy, 20 * s, th.color.text);

  r.text(copy.albumTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  r.roundRect(ach.x, ach.y, ach.w, ach.h, ach.h / 2, th.color.brandSoft);
  draw.iconStar(r, ach.x + 14 * s, ach.y + ach.h / 2, 13 * s, th.color.bandDeep);
  r.text(format(copy.albumAchievements, app.achievements.count(), config.ACHIEVEMENTS.length), ach.x + 26 * s, ach.y + ach.h / 2, {
    size: th.font.micro,
    weight: '700',
    color: th.color.bandDeep
  });
};

AlbumScene.prototype._renderPills = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var p = L.pills;

  r.roundRect(p.x, p.y, p.half, p.h, p.h / 2, th.color.card);
  r.strokeRoundRect(p.x, p.y, p.half, p.h, p.h / 2, th.color.border, 1);
  r.text(format(copy.albumCount, app.collection.count(), app.collection.total()), p.x + p.half / 2, p.y + p.h / 2, {
    size: th.font.small,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  var rx = p.x + p.half + 8 * s;
  r.roundRect(rx, p.y, p.half, p.h, p.h / 2, th.color.card);
  r.strokeRoundRect(rx, p.y, p.half, p.h, p.h / 2, th.color.border, 1);
  draw.iconPaw(r, rx + 20 * s, p.y + p.h / 2, 13 * s, th.color.cta);
  r.text(format(copy.albumFragments, app.progress.fragments()), rx + 32 * s, p.y + p.h / 2, {
    size: th.font.small,
    weight: '600',
    color: th.color.text
  });
};

AlbumScene.prototype._renderGrid = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var g = L.grid;
  var equipped = app.collection.equippedId();
  var cells = [];

  for (var i = 0; i < cats.all.length; i++) {
    var cat = cats.all[i];
    var row = Math.floor(i / g.cols);
    var col = i % g.cols;
    var x = g.x + col * (g.cellW + g.gap);
    var y = g.y + row * (g.cellH + g.gap);
    var unlocked = app.collection.isUnlocked(cat.id);
    var isEquipped = unlocked && equipped === cat.id;
    var cell = { x: x, y: y, w: g.cellW, h: g.cellH, cat: cat };
    cells.push(cell);

    r.roundRect(x, y, g.cellW, g.cellH, 12 * s, unlocked ? th.color.card : th.color.bgSunken);
    r.strokeRoundRect(x, y, g.cellW, g.cellH, 12 * s,
      isEquipped ? th.color.brand : th.color.border,
      isEquipped ? 1.5 * s : 1);

    var faceSize = Math.min(52 * s, g.cellH * 0.52);
    draw.catFace(r, x + g.cellW / 2, y + g.cellH * 0.37, faceSize, cat, {
      alpha: unlocked ? 1 : 0.22
    });

    var rarityColor = th.color[RARITY_COLOR[cat.rarity] || 'rarityCommon'];
    r.circle(x + 11 * s, y + 11 * s, 3.2 * s, unlocked ? rarityColor : th.color.border);

    if (isEquipped) {
      draw.iconStar(r, x + g.cellW - 12 * s, y + 12 * s, 12 * s, th.color.gold);
    } else if (!unlocked) {
      draw.iconLock(r, x + g.cellW - 12 * s, y + 12 * s, 12 * s, th.color.textSoft);
    }

    r.text(cat.name, x + g.cellW / 2, y + g.cellH - 28 * s, {
      size: th.font.small,
      weight: '700',
      color: unlocked ? th.color.text : th.color.textSoft,
      align: 'center',
      maxWidth: g.cellW - 8 * s
    });
    r.text(unlocked ? (copy.rarityNames[cat.rarity] || '') : copy.albumLocked,
      x + g.cellW / 2, y + g.cellH - 12 * s, {
        size: th.font.micro,
        color: isEquipped ? th.color.brand : th.color.textSoft,
        align: 'center',
        maxWidth: g.cellW - 8 * s
      });
  }

  this.cells = cells;
};

AlbumScene.prototype._rarityName = function (cat) {
  return copy.rarityNames[cat.rarity] || '';
};

AlbumScene.prototype._conditionText = function (cat) {
  var app = this.app;
  var c = app.collection.conditionOf(cat);
  var need = c.need;
  var current = Math.min(c.current, need);
  if (c.type === 'craft') return format(copy.albumConditionCraft, need);
  if (c.type === 'signin') return format(copy.albumConditionSignin, need, current, need);
  if (c.type === 'daily') return format(copy.albumConditionDaily, need, current, need);
  if (c.type === 'achievements') return format(copy.albumConditionAchievements, need, current, need);
  return format(copy.albumConditionClears, need, current, need);
};

AlbumScene.prototype._renderDetail = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var D = this.L.detail;
  var cat = cats.get(this.selected);
  if (!cat || cat.id !== this.selected) {
    this.selected = null;
    return;
  }

  var unlocked = app.collection.isUnlocked(cat.id);
  var equipped = app.collection.equippedId() === cat.id;
  var isCraft = cat.unlock && cat.unlock.type === 'craft';
  var cond = app.collection.conditionOf(cat);

  r.rect(0, 0, r.w, r.h, th.color.mask);
  draw.softShadow(r, D.x, D.y, D.w, D.h, th.radius.board);

  r.roundRect(D.x, D.y, D.w, D.h, th.radius.board, th.color.card);
  r.strokeRoundRect(D.x, D.y, D.w, D.h, th.radius.board, th.color.border, 1);

  r.circle(D.close.cx, D.close.cy, D.close.r, th.color.bgSunken);
  draw.xMark(r, D.close.cx, D.close.cy, 12 * s, th.color.textSoft);

  draw.catFace(r, D.cat.cx, D.cat.cy, D.cat.size, cat, { alpha: unlocked ? 1 : 0.28 });
  if (!unlocked) {
    r.circle(D.cat.cx + D.cat.size * 0.30, D.cat.cy + D.cat.size * 0.28, 13 * s, th.color.card);
    draw.iconLock(r, D.cat.cx + D.cat.size * 0.30, D.cat.cy + D.cat.size * 0.28, 14 * s, th.color.textSoft);
  }

  r.text(cat.name, r.w / 2, D.nameY, {
    size: th.font.banner,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
  r.text(cat.title, r.w / 2, D.titleY, {
    size: th.font.small,
    color: th.color.textSoft,
    align: 'center'
  });

  var rarityColor = th.color[RARITY_COLOR[cat.rarity] || 'rarityCommon'];
  var rarityName = this._rarityName(cat);
  var rw = r.measure(rarityName, th.font.micro, '700') + 20 * s;
  r.roundRect(r.w / 2 - rw / 2, D.rarityY - 10 * s, rw, 20 * s, 10 * s, draw.alpha(rarityColor, 0.14));
  r.text(rarityName, r.w / 2, D.rarityY, {
    size: th.font.micro,
    weight: '700',
    color: rarityColor,
    align: 'center'
  });

  r.text(cat.quote, r.w / 2, D.quoteY, {
    size: th.font.small,
    color: th.color.textSoft,
    align: 'center',
    maxWidth: D.w - 48 * s
  });

  r.text(this._conditionText(cat), D.condBar.x, D.condY, {
    size: th.font.micro,
    color: unlocked ? th.color.success : th.color.textSoft,
    maxWidth: D.w - 48 * s
  });

  if (!unlocked && cond.need > 0) {
    var bar = D.condBar;
    var ratio = Math.max(0, Math.min(1, cond.current / cond.need));
    r.roundRect(bar.x, bar.y, bar.w, bar.h, bar.h / 2, th.color.bgSunken);
    if (ratio > 0) {
      r.roundRect(bar.x, bar.y, Math.max(bar.h, bar.w * ratio), bar.h, bar.h / 2, th.color.brand);
    }
  }

  if (isCraft) {
    r.text(format(copy.albumFragments, app.progress.fragments()), D.condBar.x, D.fragY, {
      size: th.font.micro,
      color: th.color.textSoft
    });
  }

  this.detailAction = '';
  if (!unlocked && isCraft) {
    var need = cat.unlock.need || 3;
    var enough = app.progress.fragments() >= need;
    var label = enough ? format(copy.albumCraft, need) : format(copy.albumCraftNeed, app.progress.fragments(), need);
    r.roundRect(D.action.x, D.action.y, D.action.w, D.action.h, D.action.h / 2,
      enough ? th.color.cta : th.color.bgSunken);
    r.text(label, r.w / 2, D.action.y + D.action.h / 2 + 1, {
      size: th.font.body,
      weight: '700',
      color: enough ? th.color.textOnColor : th.color.textSoft,
      align: 'center',
      maxWidth: D.action.w - 20 * s
    });
    this.detailAction = 'craft';
  } else if (unlocked) {
    var equippedLabel = equipped ? copy.albumEquippedDone : copy.albumEquip;
    r.roundRect(D.action.x, D.action.y, D.action.w, D.action.h, D.action.h / 2,
      equipped ? th.color.bgSunken : th.color.cta);
    r.text(equippedLabel, r.w / 2, D.action.y + D.action.h / 2 + 1, {
      size: th.font.body,
      weight: '700',
      color: equipped ? th.color.textSoft : th.color.textOnColor,
      align: 'center',
      maxWidth: D.action.w - 20 * s
    });
    if (!equipped) this.detailAction = 'equip';
  } else {
    r.roundRect(D.action.x, D.action.y, D.action.w, D.action.h, D.action.h / 2, th.color.bgSunken);
    r.text(copy.albumLocked, r.w / 2, D.action.y + D.action.h / 2 + 1, {
      size: th.font.small,
      color: th.color.textSoft,
      align: 'center'
    });
  }
};

AlbumScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L;
  if (!L) return;

  if (this.selected) {
    var D = L.detail;
    if (hit.inCircleLoose(x, y, D.close, 6) || !hit.inRect(x, y, D)) {
      this.selected = null;
      this.detailAction = '';
      return;
    }
    if (this.detailAction && hit.inRect(x, y, D.action)) {
      var cat = cats.get(this.selected);
      if (this.detailAction === 'equip') {
        if (app.collection.equip(cat.id)) {
          app.haptic();
          app.toast.show(format(copy.toastCatEquipped, cat.name));
        }
      } else if (this.detailAction === 'craft') {
        var res = app.collection.craft(cat.id);
        if (res.ok) {
          app.haptic();
          app.metaRefresh();
          app.toast.show(format(copy.toastCatCrafted, cat.name));
        } else {
          app.toast.show(copy.toastFragmentsShort);
        }
      }
    }
    return;
  }

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }
  if (hit.inRect(x, y, L.ach)) {
    app.haptic();
    app.sm.push('achievements');
    return;
  }

  for (var i = 0; i < this.cells.length; i++) {
    var cell = this.cells[i];
    if (hit.inRect(x, y, cell)) {
      app.haptic();
      this.selected = cell.cat.id;
      return;
    }
  }
};

module.exports = AlbumScene;
