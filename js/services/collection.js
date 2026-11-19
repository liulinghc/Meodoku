/**
 * 猫咪图鉴：解锁条件、装备、碎片合成。
 * 图鉴只影响展示与棋盘猫样式，不提供任何数值加成。
 */
var config = require('../data/config');
var cats = require('../data/cats');
var clock = require('../core/clock');

function Collection(progress) {
  this.progress = progress;
  this.save = progress.save;
}

Collection.prototype.d = function () { return this.save.data; };

Collection.prototype.count = function () {
  var unlocked = this.d().collection.unlocked;
  var n = 0;
  for (var id in unlocked) if (unlocked.hasOwnProperty(id)) n++;
  return n;
};

Collection.prototype.total = function () { return cats.all.length; };

/** 条件当前进度值 */
Collection.prototype.metric = function (type) {
  var d = this.d();
  if (type === 'clears') return this.progress.completedCount();
  if (type === 'signin') return d.signin.totalDays;
  if (type === 'daily') return d.daily.total;
  if (type === 'achievements') {
    var n = 0;
    for (var id in d.achievements) if (d.achievements.hasOwnProperty(id)) n++;
    return n;
  }
  if (type === 'collection') return this.count();
  return 0;
};

Collection.prototype.isUnlocked = function (id) {
  return this.progress.isCatUnlocked(id);
};

Collection.prototype.conditionOf = function (cat) {
  var un = cat.unlock || { type: 'clears', need: 1 };
  return {
    type: un.type,
    need: un.need,
    current: un.type === 'craft' ? this.progress.fragments() : this.metric(un.type),
    done: un.type === 'craft' ? this.progress.fragments() >= un.need : this.metric(un.type) >= un.need
  };
};

/** 返回本次新解锁的猫（[{id, cat}]），供界面提示 */
Collection.prototype.refresh = function () {
  var d = this.d();
  var newly = [];
  for (var i = 0; i < cats.all.length; i++) {
    var cat = cats.all[i];
    var un = cat.unlock;
    if (!un || un.type === 'craft') continue;
    if (d.collection.unlocked[cat.id]) continue;
    if (this.metric(un.type) < un.need) continue;
    d.collection.unlocked[cat.id] = clock.now();
    if (!d.collection.equipped) d.collection.equipped = cat.id;
    newly.push({ id: cat.id, cat: cat });
  }
  if (newly.length) this.save.touch();
  return newly;
};

Collection.prototype.equip = function (id) {
  return this.progress.setEquippedCat(id);
};

Collection.prototype.equippedId = function () {
  var id = this.d().collection.equipped;
  return id && this.d().collection.unlocked[id] ? id : '';
};

Collection.prototype.equippedCat = function () {
  return cats.get(this.equippedId() || cats.all[0].id);
};

/** 消耗碎片合成指定稀有猫；失败返回 '' / 原因 */
Collection.prototype.craft = function (id) {
  var cat = cats.get(id);
  if (!cat || cat.id !== id) return { ok: false, reason: 'unknown' };
  if (this.isUnlocked(id)) return { ok: false, reason: 'owned' };
  if (!cat.unlock || cat.unlock.type !== 'craft') return { ok: false, reason: 'not_craft' };
  var cost = cat.unlock.need || config.CRAFT_FRAGMENT_COST;
  if (this.progress.fragments() < cost) return { ok: false, reason: 'fragments' };
  if (!this.progress.spendFragments(cost)) return { ok: false, reason: 'fragments' };

  var d = this.d();
  d.collection.unlocked[id] = clock.now();
  if (!d.collection.equipped) d.collection.equipped = id;
  this.save.touch();
  return { ok: true, cat: cat, cost: cost };
};

module.exports = Collection;
