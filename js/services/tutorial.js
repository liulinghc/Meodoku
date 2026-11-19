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

function isBeginner(index) {
  return index >= 1 && index <= config.FREE_HINT_LEVELS;
}

function isFreeHintLevel(index, dailyMode) {
  return !dailyMode && isBeginner(index);
}

function isMerciful(index, dailyMode) {
  return !dailyMode && index >= 1 && index <= config.MERCY_LEVELS;
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
  isBeginner: isBeginner,
  isFreeHintLevel: isFreeHintLevel,
  isMerciful: isMerciful,
  coachFor: coachFor
};
