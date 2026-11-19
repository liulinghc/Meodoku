/**
 * 关卡索引。多包时在此追加 require 即可，业务侧只认全局 1-based 序号。
 *
 * 正式包使用紧凑编码：
 *   r = n² 个区域字母；s = n 个答案列号字符；
 *   g = 可选，长度 n，第 r 行预放猫的列号（'.' 表示不预放）；
 *   h = 可选，教学关高亮格的下标。
 * 这里解码为运行时使用的 regions（每行一个字符串）、solution（数字数组）、
 * givens（预放猫格子下标）与 focus，并补齐 index / chapter / id / tier。
 * 构建期的唯一解与结构校验已由 tools/gen-pack.js 完成，运行时不重复求解。
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
  var givens = [];
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

  if (raw.g) {
    if (raw.g.length !== n) throw new Error('预放串长度非法: ' + (raw.id || '?'));
    for (r = 0; r < n; r++) {
      var ch = raw.g.charAt(r);
      if (ch === '.' || ch === '-') continue;
      var gc = ch.charCodeAt(0) - 48;
      if (!(gc >= 0 && gc < n) || solution[r] !== gc) {
        throw new Error('预放猫不在答案中: ' + (raw.id || '?'));
      }
      givens.push(r * n + gc);
    }
    if (givens.length >= n) throw new Error('预放猫过多: ' + (raw.id || '?'));
  }

  raw.regions = regions;
  raw.solution = solution;
  raw.givens = givens;
  raw.givenCount = givens.length;
  raw.focus = typeof raw.h === 'number' ? raw.h : -1;
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
