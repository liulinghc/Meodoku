/**
 * 进度与货币。所有写操作都经过这里，保证统一标脏存档。
 */
var config = require('../data/config');
var clock = require('../core/clock');

function Progress(save) {
  this.save = save;
}

Progress.prototype.d = function () { return this.save.data; };

/* ---------------- 金币 ---------------- */

Progress.prototype.coins = function () { return this.d().coins; };

Progress.prototype.addCoins = function (n) {
  if (!n) return this.d().coins;
  this.d().coins = Math.max(0, this.d().coins + n);
  this.save.touch();
  return this.d().coins;
};

Progress.prototype.spendCoins = function (n) {
  if (this.d().coins < n) return false;
  this.d().coins -= n;
  this.save.touch();
  return true;
};

/* ---------------- 门票 ---------------- */

Progress.prototype.tickets = function () { return this.d().tickets; };

Progress.prototype.addTickets = function (n) {
  this.d().tickets = Math.max(0, this.d().tickets + n);
  this.save.touch();
};

Progress.prototype.spendTicket = function () {
  if (this.d().tickets <= 0) return false;
  this.d().tickets--;
  this.save.touch();
  return true;
};

/* ---------------- 关卡进度 ---------------- */

Progress.prototype.isUnlocked = function (index) {
  if (config.UNLOCK_ALL) return true;
  return index <= this.d().unlocked;
};

Progress.prototype.isCompleted = function (index) {
  return !!this.d().completed[index];
};

/** 已通关关卡的历史最高猫爪数；未通关返回 0 */
Progress.prototype.pawsOf = function (index) {
  var e = this.d().completed[index];
  return e ? e.paws || 0 : 0;
};

/* ---------------- 中断续玩 ---------------- */

function emptyResume() {
  return { index: 0, n: 0, cells: [], timeMs: 0, moves: 0, mistakes: 0, hintsUsed: 0 };
}

/** 返回指定关卡的续玩数据；没有或不是该关时返回 null */
Progress.prototype.getResume = function (index) {
  var r = this.d().resume;
  return r && r.index === index ? r : null;
};

Progress.prototype.saveResume = function (data) {
  this.d().resume = {
    index: data.index,
    n: data.n,
    cells: data.cells.slice(),
    timeMs: Math.max(0, Math.round(data.timeMs || 0)),
    moves: Math.max(0, data.moves || 0),
    mistakes: Math.max(0, data.mistakes || 0),
    hintsUsed: Math.max(0, data.hintsUsed || 0)
  };
  this.save.touch();
};

Progress.prototype.clearResume = function (index) {
  var r = this.d().resume;
  if (index && (!r || r.index !== index)) return;
  if (!r || (!r.index && !r.cells.length)) return;
  this.d().resume = emptyResume();
  this.save.touch();
};

Progress.prototype.completedCount = function () {
  var c = this.d().completed;
  var n = 0;
  for (var k in c) if (c.hasOwnProperty(k)) n++;
  return n;
};

Progress.prototype.setLastLevel = function (index) {
  if (this.d().lastLevel === index) return;
  this.d().lastLevel = index;
  this.save.touch();
};

/**
 * 记录通关并结算。
 * info: { timeMs, paws }，缺省时按 1 爪、无用时（兼容旧调用/演示入口）。
 * 返回本次结算结果，供结算页展示。
 */
Progress.prototype.completeLevel = function (index, info) {
  info = info || {};
  var d = this.d();
  var prev = d.completed[index];
  var firstClear = !prev;

  var timeMs = Math.max(0, Math.round(info.timeMs || 0));
  var paws = Math.min(3, Math.max(1, info.paws || 1));

  var entry = prev || { at: clock.now(), tries: 0, paws: 1, bestTimeMs: 0 };
  entry.tries = (entry.tries || 0) + 1;

  var prevBest = entry.bestTimeMs || 0;
  var isNewBest = timeMs > 0 && (!prevBest || timeMs < prevBest);
  if (isNewBest) entry.bestTimeMs = timeMs;
  if (paws > (entry.paws || 0)) entry.paws = paws;
  d.completed[index] = entry;

  if (d.unlocked < index + 1) d.unlocked = index + 1;

  var reward = 0;
  if (firstClear) {
    reward = config.LEVEL_COINS;
    if (paws === 3) reward += Math.round(config.LEVEL_COINS * config.LEVEL_PERFECT_BONUS);
    d.coins += reward;
  }
  if (timeMs > 0) d.stats.playedMs += timeMs;
  if (d.resume && d.resume.index === index) d.resume = emptyResume();

  this.save.touch();
  return {
    firstClear: firstClear,
    coins: reward,
    isNewBest: isNewBest,
    bestTimeMs: entry.bestTimeMs,
    paws: entry.paws
  };
};

/* ---------------- 统计 ---------------- */

Progress.prototype.addCatsPlaced = function (n) {
  this.d().stats.catsPlaced += n || 1;
  this.save.touch();
};

Progress.prototype.catsPlaced = function () {
  return this.d().stats.catsPlaced;
};

Progress.prototype.addErases = function (n) {
  this.d().stats.erases += n || 1;
  this.save.touch();
};

Progress.prototype.addUndos = function (n) {
  this.d().stats.undos += n || 1;
  this.save.touch();
};

Progress.prototype.addHints = function (n) {
  this.d().stats.hintsUsed += n || 1;
  this.save.touch();
};

module.exports = Progress;
