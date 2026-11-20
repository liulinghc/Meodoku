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
var uiKit = require('../widgets/ui-kit');

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
  this.t = 0;
  this.detailT = 0;
}

AlbumScene.prototype.enter = function (params) {
  this.selected = (params && params.catId) || null;
  this.cells = [];
  this.t = 0;
  this.detailT = 0;
};

AlbumScene.prototype.update = function (dt) {
  this.t += dt;
  if (this.selected) this.detailT += dt;
  else this.detailT = 0;
};

/** 详情卡上滑进度（0–1），只影响绘制 */
AlbumScene.prototype._detailEase = function () {
  return uiKit.easeOutCubic(uiKit.clamp01(this.detailT / 0.22));
};

AlbumScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.album();
  this.L = L;

  r.fill(th.color.bg);

  this._renderTop(r);
  this._renderPills(r);
  this._renderGrid(r);

  if (this.selected) this._renderDetail(r);
  r.ctx.globalAlpha = 1;
};

AlbumScene.prototype._renderTop = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var ach = L.ach;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.text(copy.albumTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.pageTitle,
    weight: '800',
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

    uiKit.card(r, { x: x, y: y, w: g.cellW, h: g.cellH }, th, {
      shadow: false,
      radius: 12 * s,
      fill: unlocked ? th.color.card : th.color.bgSunken,
      borderColor: isEquipped ? th.color.brand : th.color.border,
      borderWidth: isEquipped ? 1.5 * s : 1
    });

    var faceSize = Math.min(52 * s, g.cellH * 0.52);
    draw.catFace(r, x + g.cellW / 2, y + g.cellH * 0.37, faceSize, cat, {
      alpha: unlocked ? 1 : 0.22
    });

    var rarityColor = th.color[RARITY_COLOR[cat.rarity] || 'rarityCommon'];
    var rarityName = copy.rarityNames[cat.rarity] || '';
    if (unlocked && rarityName) {
      var ribbonW = uiKit.ribbonWidth(r, rarityName, th, s);
      uiKit.ribbon(r, x + 6 * s, y + 6 * s, ribbonW, 15 * s,
        rarityColor, rarityName, th);
    } else if (!unlocked) {
      // 未解锁：低透明度猫咪剪影上压一个问号，保留神秘感
      r.text('？', x + g.cellW / 2, y + g.cellH * 0.36, {
        size: th.font.banner,
        weight: '800',
        color: draw.alpha(th.color.text, 0.55),
        align: 'center'
      });
    }

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
    // 稀有度已经由左上角缎带表达，底部只保留“出战中/未解锁”
    var sub = unlocked ? (isEquipped ? copy.albumEquipped : '') : copy.albumLocked;
    if (sub) {
      r.text(sub, x + g.cellW / 2, y + g.cellH - 12 * s, {
        size: th.font.micro,
        color: isEquipped ? th.color.brand : th.color.textSoft,
        align: 'center',
        maxWidth: g.cellW - 8 * s
      });
    }
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
  var ease = this._detailEase();

  // 遮罩与卡片一起上滑淡入；输入仍以布局坐标为准
  r.ctx.globalAlpha = ease;
  r.rect(0, 0, r.w, r.h, th.color.mask);
  r.save();
  r.ctx.translate(0, (1 - ease) * 18 * s);

  uiKit.card(r, D, th, { radius: th.radius.board });

  r.circle(D.close.cx, D.close.cy, D.close.r, th.color.bgSunken);
  draw.xMark(r, D.close.cx, D.close.cy, 12 * s, th.color.textSoft);

  draw.catFace(r, D.cat.cx, D.cat.cy, D.cat.size, cat, { alpha: unlocked ? 1 : 0.28 });
  if (!unlocked) {
    r.text('？', D.cat.cx, D.cat.cy - 2 * s, {
      size: th.font.banner,
      weight: '800',
      color: draw.alpha(th.color.text, 0.55),
      align: 'center'
    });
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
  var rw = uiKit.ribbonWidth(r, rarityName, th, s);
  uiKit.ribbon(r, r.w / 2 - rw / 2, D.rarityY - 10 * s, rw, 20 * s,
    rarityColor, rarityName, th);

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
    uiKit.progress(r, D.condBar,
      Math.max(0, Math.min(1, cond.current / cond.need)), th);
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
    uiKit.button(r, D.action, label, th, {
      disabled: !enough,
      size: enough ? th.font.body : th.font.small
    });
    this.detailAction = 'craft';
  } else if (unlocked) {
    var equippedLabel = equipped ? copy.albumEquippedDone : copy.albumEquip;
    uiKit.button(r, D.action, equippedLabel, th, {
      disabled: equipped,
      style: equipped ? 'flat' : 'primary',
      size: th.font.body
    });
    if (!equipped) this.detailAction = 'equip';
  } else {
    uiKit.button(r, D.action, copy.albumLocked, th, {
      disabled: true,
      size: th.font.small
    });
  }

  r.restore();
  r.ctx.globalAlpha = 1;
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
      this.detailT = 0;
      return;
    }
    if (this.detailAction && hit.inRect(x, y, D.action)) {
      var cat = cats.get(this.selected);
      if (this.detailAction === 'equip') {
        if (app.collection.equip(cat.id)) {
          app.toast.show(format(copy.toastCatEquipped, cat.name));
        }
      } else if (this.detailAction === 'craft') {
        var res = app.collection.craft(cat.id);
        if (res.ok) {
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
    app.sm.push('achievements');
    return;
  }

  for (var i = 0; i < this.cells.length; i++) {
    var cell = this.cells[i];
    if (hit.inRect(x, y, cell)) {
      this.selected = cell.cat.id;
      this.detailT = 0;
      return;
    }
  }
};

module.exports = AlbumScene;
