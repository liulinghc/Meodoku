/**
 * 关卡查询。关卡数据是静态包，打包进小游戏代码，离线可玩。
 */
var config = require('../data/config');
var packs = require('../../levels/index');

function get(index) {
  return packs.get(index);
}

function total() {
  return packs.total();
}

function chapterOf(index) {
  return Math.floor((index - 1) / config.CHAPTER_SIZE) + 1;
}

/** 某章的关卡区间，返回 1-based 的起止序号 */
function chapterRange(chapter) {
  var start = (chapter - 1) * config.CHAPTER_SIZE + 1;
  var end = Math.min(total(), chapter * config.CHAPTER_SIZE);
  return { chapter: chapter, start: start, end: end };
}

function chapterCount() {
  return Math.max(1, Math.ceil(total() / config.CHAPTER_SIZE));
}

/** 当前应玩的关卡：第一个未通关的已解锁关卡 */
function current(progress) {
  var n = total();
  for (var i = 1; i <= n; i++) {
    if (progress.isUnlocked(i) && !progress.isCompleted(i)) return i;
  }
  return n;
}

/** 当前所在章节 */
function currentChapter(progress) {
  return chapterOf(current(progress));
}

module.exports = {
  all: packs.all,
  get: get,
  total: total,
  chapterOf: chapterOf,
  chapterRange: chapterRange,
  chapterCount: chapterCount,
  current: current,
  currentChapter: currentChapter
};
