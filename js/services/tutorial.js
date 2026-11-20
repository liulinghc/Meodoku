/**
 * 新手节奏：规则卡片与保护范围。
 *
 * 前 30 关是重新设计的教学曲线：
 *   L1–3 预放 3/2/1 只猫，L4 高亮突破口，L5–10 独立 4×4，
 *   L11 起进入 5×5。规则不一次性展示，而是在首次出现时弹一张卡片：
 *   每关最多一张，玩家点「知道啦」后写入 coachSeen，之后不再重复。
 *
 * 纯函数，不直接读写存档；GameScene / GuideScene / save.normalize 共用。
 */
var config = require('../data/config');
var copy = require('../data/copy');

// 关卡序号 → 首张规则卡。只在规则第一次出现时出现，复盘不重复。
var LEVEL_CARDS = {
  1: 'given',
  2: 'rowcol',
  3: 'region',
  4: 'focus',
  5: 'freehint',
  6: 'mark',
  11: 'bigboard'
};

function knownCoachIds() {
  var ids = [];
  for (var k in LEVEL_CARDS) {
    if (LEVEL_CARDS.hasOwnProperty(k)) ids.push(LEVEL_CARDS[k]);
  }
  return ids;
}

function isKnownCoach(id) {
  for (var k in LEVEL_CARDS) {
    if (LEVEL_CARDS.hasOwnProperty(k) && LEVEL_CARDS[k] === id) return true;
  }
  return false;
}

/**
 * 对局页规则条应高亮的下标：0 每区一猫 / 1 行列各一 / -1 常态。
 * 与规则卡共用 LEVEL_CARDS，保证“教哪条就亮哪条”；每日挑战不套用。
 */
function ruleStripIndex(index, dailyMode) {
  if (dailyMode) return -1;
  var id = LEVEL_CARDS[index];
  if (id === 'region') return 0;
  if (id === 'rowcol') return 1;
  return -1;
}

function isBeginner(index) {
  return index >= 1 && index <= config.FREE_HINT_LEVELS;
}

function isFreeHintLevel(index, dailyMode) {
  return !dailyMode && isBeginner(index);
}

function isMerciful(index, dailyMode) {
  return !dailyMode && index >= 1 && index <= config.MERCY_LEVELS;
}

/** 是否为引导关：无操作时会在正确格子上显示“点两下”操作引导 */
function isTapHintLevel(index, dailyMode) {
  return !dailyMode && index >= 1 && index <= config.TAP_HINT_LEVELS;
}

/**
 * 引导关的无操作提示阈值：随关卡线性放宽，
 * 第 1 关最短 3 秒，到第 10 关最长 10 秒（保留一位小数）。
 * 非引导关夹到两端，调用方仍需先过 isTapHintLevel。
 */
function tapHintSeconds(index) {
  var min = config.TAP_HINT_SECONDS_MIN;
  var max = config.TAP_HINT_SECONDS_MAX;
  var last = config.TAP_HINT_LEVELS - 1;
  if (last <= 0) return max;
  var i = index < 1 ? 1 :
    (index > config.TAP_HINT_LEVELS ? config.TAP_HINT_LEVELS : index);
  return Math.round((min + (max - min) * (i - 1) / last) * 10) / 10;
}

/**
 * 当前关应展示的规则卡；没有或已读返回 null。
 * level 使用 levels/index 解码后的对象（含 givens / focus / n）。
 */
function coachFor(index, level, seen) {
  if (!level) return null;
  var id = LEVEL_CARDS[index];
  if (!id) return null;
  if (seen && seen[id]) return null;

  // 数据兜底：规则卡只在对应机制真实存在时出现
  if (id === 'given' && (!level.givens || level.givens.length === 0)) return null;
  if (id === 'focus' && !(level.focus >= 0)) return null;
  if (id === 'bigboard' && level.n < 5) return null;

  var def = copy.coachCards[id];
  if (!def) return null;
  return {
    id: id,
    title: def.title,
    lines: def.lines.slice()
  };
}

module.exports = {
  LEVEL_CARDS: LEVEL_CARDS,
  knownCoachIds: knownCoachIds,
  isKnownCoach: isKnownCoach,
  ruleStripIndex: ruleStripIndex,
  isBeginner: isBeginner,
  isFreeHintLevel: isFreeHintLevel,
  isMerciful: isMerciful,
  isTapHintLevel: isTapHintLevel,
  tapHintSeconds: tapHintSeconds,
  coachFor: coachFor
};
