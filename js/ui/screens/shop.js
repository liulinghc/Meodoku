/**
 * 小商店：金币购买提示券、补签卡与棋盘皮肤；不接支付/广告。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var hit = require('../hit');
var format = require('../../core/format');

function ShopScene(app) {
  this.app = app;
  this.L = null;
  this.rows = [];
}

ShopScene.prototype.enter = function () {
  this.rows = [];
};

ShopScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.shop();
  this.L = L;

  r.fill(th.color.bg);

  this._renderTop(r);
  this._renderWallet(r);
  this._renderItems(r);
};

ShopScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.text(copy.shopTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.pageTitle,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
};

ShopScene.prototype._renderWallet = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var c = L.wallet;
  var cols = [
    { icon: draw.iconCoin, value: app.progress.coins(), label: copy.shopCoin, color: th.color.gold },
    { icon: draw.iconTicket, value: app.progress.tickets(), label: copy.shopItems.ticket.name, color: th.color.gold },
    { icon: draw.iconCalendar, value: app.progress.makeupCards(), label: copy.shopItems.makeup.name, color: th.color.cta }
  ];

  r.roundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.card);
  r.strokeRoundRect(c.x, c.y, c.w, c.h, th.radius.card, th.color.border, 1);

  var colW = c.w / 3;
  for (var i = 0; i < cols.length; i++) {
    var cx = c.x + colW * (i + 0.5);
    var text = String(cols[i].value);
    var tw = r.measure(text, th.font.body, '700');
    var groupW = 16 * s + 4 * s + tw;
    var gx = cx - groupW / 2;

    cols[i].icon(r, gx + 8 * s, c.y + 27 * s, 16 * s, cols[i].color);
    r.text(text, gx + 20 * s, c.y + 27 * s, {
      size: th.font.body,
      weight: '700',
      color: th.color.text
    });
    r.text(cols[i].label, cx, c.y + 47 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center'
    });

    if (i > 0) {
      r.line(c.x + colW * i, c.y + 16 * s, c.x + colW * i, c.y + c.h - 16 * s, th.color.border, 1);
    }
  }
};

ShopScene.prototype._itemIcon = function (item) {
  if (item.type === 'ticket') return draw.iconTicket;
  if (item.type === 'makeup') return draw.iconCalendar;
  return draw.iconBag;
};

ShopScene.prototype._itemColor = function (item) {
  var th = this.app.theme;
  if (item.type === 'ticket') return th.color.gold;
  if (item.type === 'makeup') return th.color.cta;
  return th.color.brand;
};

ShopScene.prototype._renderItems = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var list = L.list;
  var items = app.shop.items();
  var rows = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var meta = copy.shopItems[item.id] || { name: item.id, desc: '' };
    var y = list.y + i * (list.rowH + list.gap);
    var row = { x: list.x, y: y, w: list.w, h: list.rowH, item: item };
    rows.push(row);

    r.roundRect(row.x, row.y, row.w, row.h, th.radius.card, th.color.card);
    r.strokeRoundRect(row.x, row.y, row.w, row.h, th.radius.card, th.color.border, 1);

    var iconCx = row.x + 32 * s;
    var iconCy = row.y + row.h / 2;
    var color = this._itemColor(item);
    r.circle(iconCx, iconCy, 18 * s, draw.alpha(color, 0.13));
    this._itemIcon(item)(r, iconCx, iconCy, 20 * s, color);

    r.text(meta.name, row.x + 58 * s, iconCy - 10 * s, {
      size: th.font.small,
      weight: '700',
      color: th.color.text,
      maxWidth: row.w - 58 * s - 112 * s
    });
    r.text(meta.desc, row.x + 58 * s, iconCy + 8 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      maxWidth: row.w - 58 * s - 112 * s
    });

    var bw = 92 * s;
    var bh = 34 * s;
    var bx = row.x + row.w - 12 * s - bw;
    var by = row.y + (row.h - bh) / 2;
    var btn = { x: bx, y: by, w: bw, h: bh };
    var label = '';
    var style = 'buy';
    var disabled = false;

    if (item.type === 'skin' && app.shop.ownsSkin(item.id)) {
      if (app.progress.currentSkin() === item.id) {
        label = copy.shopUsing;
        style = 'flat';
        disabled = true;
        row.action = '';
      } else {
        label = copy.shopUse;
        style = 'alt';
        row.action = 'use';
      }
    } else {
      label = format(copy.shopBuy, item.price);
      disabled = app.progress.coins() < item.price;
      row.action = 'buy';
      if (disabled) style = 'flat';
    }

    row.btn = btn;
    var bg = style === 'alt' ? th.color.brandSoft :
      (style === 'flat' ? th.color.bgSunken : th.color.cta);
    var fg = style === 'alt' ? th.color.bandDeep :
      (style === 'flat' ? th.color.textSoft : th.color.textOnColor);
    r.roundRect(bx, by, bw, bh, bh / 2, bg);
    r.text(label, bx + bw / 2, by + bh / 2 + 1, {
      size: th.font.small,
      weight: '700',
      color: fg,
      align: 'center',
      maxWidth: bw - 12 * s
    });
  }

  this.rows = rows;

  var noteY = list.y + items.length * (list.rowH + list.gap) + 12 * s;
  if (noteY < L.bottom - 4 * s) {
    r.text(copy.shopSubtitle, r.w / 2, noteY, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center'
    });
  }
};

ShopScene.prototype.onTouchEnd = function (x, y, isTap) {
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
    if (!row.btn || !hit.inRect(x, y, row.btn)) continue;
    var item = row.item;

    if (!row.action) return;

    if (row.action === 'use') {
      if (app.shop.useSkin(item.id)) {
        app.applySkin();
        app.toast.show(copy.toastSkinUsed);
      }
      return;
    }

    var res = app.shop.buy(item.id);
    if (!res.ok) {
      if (res.reason === 'coins') app.toast.show(copy.toastNotEnoughCoins);
      return;
    }

    if (item.type === 'ticket') {
      app.toast.show(format(copy.toastBoughtTicket, item.amount));
    } else if (item.type === 'makeup') {
      app.toast.show(format(copy.toastBoughtMakeup, item.amount));
    } else {
      app.applySkin();
      app.toast.show(copy.toastBoughtSkin);
    }
    app.metaRefresh();
    return;
  }
};

module.exports = ShopScene;
