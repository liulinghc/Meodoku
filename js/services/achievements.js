/**
 * 成就：只做判定、记录与手动领取，不自动加币，避免结算数值被隐式改变。
 * 条件值由主线通关、猫爪、每日挑战、签到、图鉴提供。
 */
var config = require('../data/config');
var clock = require('../core/clock');

function Achievements(progress, collection) {
  this.progress = progress;
  this.collection = collection;
  this.save = progress.save;
}

Achievements.prototype.d = function () { return this.save.data; };

Achievements.prototype.perfectCount = function () {
  var c = this.d().completed;
  var n = 0;
  for (var k in c) {
    if (c.hasOwnProperty(k) && c[k] && c[k].paws === 3) n++;
  }
  return n;
};

Achievements.prototype.metric = function (type) {
  if (type === 'clears') return this.progress.completedCount();
  if (type === 'perfects') return this.perfectCount();
  if (type === 'daily') return this.d().daily.total;
  if (type === 'signin') return this.d().signin.totalDays;
  if (type === 'collection') return this.collection.count();
  return 0;
};

Achievements.prototype.getDef = function (id) {
  for (var i = 0; i < config.ACHIEVEMENTS.length; i++) {
    if (config.ACHIEVEMENTS[i].id === id) return config.ACHIEVEMENTS[i];
  }
  return null;
};

Achievements.prototype.isUnlocked = function (id) {
  return !!this.d().achievements[id];
};

Achievements.prototype.isClaimed = function (id) {
  var e = this.d().achievements[id];
  return !!(e && e.claimedAt);
};

Achievements.prototype.progressOf = function (def) {
  var cur = this.metric(def.type);
  return {
    current: Math.min(cur, def.target),
    target: def.target,
    raw: cur,
    done: cur >= def.target
  };
};

Achievements.prototype.count = function () {
  var n = 0;
  for (var id in this.d().achievements) if (this.d().achievements.hasOwnProperty(id)) n++;
  return n;
};

/** 只标记达成；奖励由玩家在成就页点“领取” */
Achievements.prototype.check = function () {
  var d = this.d();
  var newly = [];
  for (var i = 0; i < config.ACHIEVEMENTS.length; i++) {
    var def = config.ACHIEVEMENTS[i];
    if (d.achievements[def.id]) continue;
    var p = this.progressOf(def);
    if (!p.done) continue;
    d.achievements[def.id] = { unlockedAt: clock.now(), claimedAt: 0 };
    newly.push(def);
  }
  if (newly.length) this.save.touch();
  return newly;
};

Achievements.prototype.claim = function (id) {
  var def = this.getDef(id);
  if (!def) return { ok: false, reason: 'unknown' };
  var e = this.d().achievements[id];
  if (!e) return { ok: false, reason: 'locked' };
  if (e.claimedAt) return { ok: false, reason: 'claimed' };

  if (def.coins) this.progress.addCoins(def.coins);
  if (def.tickets) this.progress.addTickets(def.tickets);
  e.claimedAt = clock.now();
  this.save.touch();
  return { ok: true, coins: def.coins || 0, tickets: def.tickets || 0 };
};

module.exports = Achievements;
