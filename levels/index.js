/**
 * 关卡索引。多包时在此追加 require 即可，业务侧只认全局 1-based 序号。
 *
 * 正式包使用紧凑编码：
 *   r = n² 个区域字母；s = n 个答案列号字符。
 * 这里解码为运行时使用的 regions（每行一个字符串）与 solution（数字数组），
 * 并补齐 index / chapter / id / tier / difficulty。构建期的唯一解与结构校验
 * 已由 tools/gen-pack.js 完成，运行时不重复求解。
 */
var config = require('../js/data/config');

var PACKS = [
  require('./pack-001')
];

var LIST = [];
var BY_ID = {};

function decodeLevel(raw) {
  var n = raw.n;
  var regions = [];
  var solution = [];
  var i, r;

  if (!(n >= 4 && n <= 9)) throw new Error('关卡边长非法: ' + n);
  if (!raw.r || raw.r.length !== n * n) throw new Error('区域串长度非法: ' + (raw.id || '?'));
  if (!raw.s || raw.s.length !== n) throw new Error('答案串长度非法: ' + (raw.id || '?'));

  for (i = 0; i < n * n; i++) {
    var g = raw.r.charCodeAt(i) - 97;
    if (g < 0 || g >= n) throw new Error('区域编号非法: ' + (raw.id || '?'));
  }
  for (r = 0; r < n; r++) {
    regions.push(raw.r.slice(r * n, r * n + n));
    var c = raw.s.charCodeAt(r) - 48;
    if (c < 0 || c >= n) throw new Error('答案列非法: ' + (raw.id || '?'));
    solution.push(c);
  }

  raw.regions = regions;
  raw.solution = solution;
  raw.tier = raw.t;
  raw.difficulty = raw.d;
  return raw;
}

(function flatten() {
  for (var p = 0; p < PACKS.length; p++) {
    var pack = PACKS[p];
    for (var i = 0; i < pack.levels.length; i++) {
      var level = decodeLevel(pack.levels[i]);
      level.index = LIST.length + 1;
      level.chapter = Math.floor((level.index - 1) / config.CHAPTER_SIZE) + 1;
      if (!level.id) {
        var s = String(level.index);
        while (s.length < 3) s = '0' + s;
        level.id = 'L' + s;
      }
      if (BY_ID[level.id]) throw new Error('关卡 ID 重复: ' + level.id);
      BY_ID[level.id] = level.index;
      LIST.push(level);
    }
  }
})();

function get(index) {
  return LIST[index - 1] || null;
}

function total() {
  return LIST.length;
}

/** 稳定 ID → 当前播放序号；旧存档迁移用 */
function indexOfId(id) {
  return BY_ID[id] || 0;
}

module.exports = {
  all: LIST,
  get: get,
  total: total,
  indexOfId: indexOfId
};
