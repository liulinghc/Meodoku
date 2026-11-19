/**
 * 小商店：只消耗金币，不接支付、不接广告。
 * 提示券 / 补签卡是即时资源；皮肤购买后可在商店内直接切换。
 */
var config = require('../data/config');

function Shop(progress) {
  this.progress = progress;
  this.save = progress.save;
}

Shop.prototype.items = function () { return config.SHOP_ITEMS; };

Shop.prototype.item = function (id) {
  for (var i = 0; i < config.SHOP_ITEMS.length; i++) {
    if (config.SHOP_ITEMS[i].id === id) return config.SHOP_ITEMS[i];
  }
  return null;
};

Shop.prototype.ownsSkin = function (id) {
  return !!this.progress.ownedSkins()[id];
};

Shop.prototype.isSoldOut = function (item) {
  return item.type === 'skin' && this.ownsSkin(item.id);
};

Shop.prototype.buy = function (id) {
  var item = this.item(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (this.isSoldOut(item)) return { ok: false, reason: 'owned' };
  if (this.progress.coins() < item.price) return { ok: false, reason: 'coins' };
  if (!this.progress.spendCoins(item.price)) return { ok: false, reason: 'coins' };

  if (item.type === 'ticket') {
    this.progress.addTickets(item.amount);
  } else if (item.type === 'makeup') {
    this.progress.addMakeupCards(item.amount);
  } else if (item.type === 'skin') {
    var skins = this.progress.ownedSkins();
    skins[item.id] = true;
    this.progress.setCurrentSkin(item.id);
    this.save.touch();
  }
  return { ok: true, item: item };
};

Shop.prototype.useSkin = function (id) {
  var ok = this.progress.setCurrentSkin(id);
  return ok;
};

module.exports = Shop;
