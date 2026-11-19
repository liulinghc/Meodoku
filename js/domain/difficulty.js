/**
 * 难度评级与布局规范签名。
 *
 * 评级只看“玩家实际要做多少推理”，不再以棋盘尺寸为主因子：
 *   1. 开局候选画像（预放猫后，每个位置还有多少选择、是否有必然位置）
 *   2. 完成所需的推理步数（唯一候选放猫 + 锁定候选排除）
 *   3. 需要打叉的候选格数量（X 标记负担）
 *   4. 是否需要锁定候选（行/列/区信息组合）
 *   5. 是否需要假设验证（猜一次即视为高级排除，教学/入门关禁用）
 *
 * 尺寸只保留档位上下限，防止 4×4 被评为专家、9×9 被评为入门。
 * 同一盘面 + 同一组预放猫 → 同一档位与分数。
 */
var human = require('./human');

var TIER_NAMES = ['入门', '简单', '普通', '困难', '专家'];

// 分数 → 档位边界：T1 < 40 ≤ T2 < 55 ≤ T3 < 70 ≤ T4 < 80 ≤ T5
var SCORE_T1 = 40;
var SCORE_T2 = 55;
var SCORE_T3 = 70;
var SCORE_T4 = 80;
// 只要需要假设验证，就不能评「入门」：难度分至少 40（T2）。
var SCORE_GUESS_FLOOR = 40;
var BRANCH_NODE_LIMIT = human.NODE_LIMIT;

// 分数权重（合计 1.0，预放猫为减分项）
var W_SIZE = 0.18;
var W_GUESS = 0.30;
var W_WORK = 0.18;
var W_MARK = 0.14;
var W_LOCK = 0.10;
var W_OPEN = 0.05;
var W_GIVEN = 0.08;

function minTierOf(n) {
  // 尺寸决定该档下限：4/5→T1, 6→T2, 7→T3, 8→T4, 9→T5
  if (n <= 5) return 1;
  return n - 4;
}

function maxTierOf(n) {
  // 尺寸决定该档上限：4→T1, 5→T2, 6→T3, 7→T4, 8/9→T5
  if (n <= 4) return 1;
  if (n <= 8) return n - 3;
  return 5;
}

function tierFromScore(score) {
  if (score < SCORE_T1) return 1;
  if (score < SCORE_T2) return 2;
  if (score < SCORE_T3) return 3;
  if (score < SCORE_T4) return 4;
  return 5;
}

/**
 * 由人类求解指标算逻辑分。
 * 预放猫越多、开局必然位置越多、打叉/锁定/假设越少，分数越低。
 */
function scoreOf(n, a) {
  var playable = Math.max(1, a.playable);
  var sizeF = (n - 4) / 5;                       // 尺寸只剩 18% 权重
  var guessF = Math.min((a.branchCount + 0.5 * a.failedBranches) / 3, 1);
  var workF = Math.min((a.placements + a.lockSteps) / (playable * 2), 1);
  var markF = Math.min(a.marks / (n * n), 1);
  var lockF = Math.min(a.lockSteps / (playable * 1.5), 1);
  var openF = Math.min(a.initial.avgCellOptions / n, 1);
  var givenF = n ? a.givenCount / n : 0;

  var raw = 100 * (
    W_SIZE * sizeF +
    W_GUESS * guessF +
    W_WORK * workF +
    W_MARK * markF +
    W_LOCK * lockF +
    W_OPEN * openF
  ) - 100 * W_GIVEN * givenF;

  if (!isFinite(raw)) return 0;
  var score = Math.round(raw);
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  if (a.branchCount > 0 && score < SCORE_GUESS_FLOOR) {
    score = SCORE_GUESS_FLOOR;
  }
  return score;
}

/** 与 SYM 对应的行/列角色是否互换（转置类对称） */
var SYM_SWAP = [false, true, false, true, false, false, true, true];

/**
 * 按对称变换 t 重建盘面与预放猫。
 * 变换后 (r,c) 对应原盘 SYM[t](r,c)，因此 firstMove 可原路映射回去。
 */
function transformBoard(n, region, givens, t) {
  var N = n * n;
  var out = new Array(N);
  var givenSet = {};
  var outGivens = [];
  var i, r, c, p, src;
  for (i = 0; i < givens.length; i++) givenSet[givens[i]] = true;
  for (r = 0; r < n; r++) {
    for (c = 0; c < n; c++) {
      p = SYM[t](r, c, n);
      src = p[0] * n + p[1];
      out[r * n + c] = region[src];
      if (givenSet[src]) outGivens.push(r * n + c);
    }
  }
  outGivens.sort(function (a, b) { return a - b; });
  return { region: out, givens: outGivens };
}

function mapRule(rule, swapped) {
  if (!swapped) return rule;
  if (rule === 'row') return 'col';
  if (rule === 'col') return 'row';
  return rule;
}

function compareKeys(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * 对已确认唯一解的关卡做难度评级。
 * givens 为预放猫的格子下标数组（可省略）。
 *
 * 同一布局旋转/镜像后规则与难度完全等价，但行→列→区的固定扫描顺序会让
 * “先发现哪一步”产生差异。这里对 8 种对称各求一次人类推演，取最容易的
 * 路径计分，保证镜像题面不会被评成两种难度；高亮格再映射回原盘。
 *
 * 返回 null 表示求解超限或未解出（调用方应拒收）。
 */
function analyzeDifficulty(n, region, givens) {
  givens = (givens || []).slice().sort(function (a, b) { return a - b; });
  var best = null;
  var bestScore = 0;
  var t, a, score, key;

  for (t = 0; t < SYM.length; t++) {
    var board = transformBoard(n, region, givens, t);
    a = human.analyze(n, board.region, board.givens);
    if (!a || !a.solved) continue;
    score = scoreOf(n, a);
    key = [score, a.branchCount, a.failedBranches, a.lockSteps,
      a.marks, a.placements, a.firstMoveLockSteps, t];
    if (!best || compareKeys(key, best.key) < 0) {
      best = { key: key, t: t, a: a };
      bestScore = score;
    }
  }
  if (!best) return null;

  a = best.a;
  score = bestScore;
  var tier = tierFromScore(score);
  var lo = minTierOf(n);
  var hi = maxTierOf(n);
  if (tier < lo) tier = lo;
  if (tier > hi) tier = hi;

  var firstMove = a.firstMove;
  var firstGuess = a.firstGuess;
  if (firstMove >= 0) {
    var fr = Math.floor(firstMove / n);
    var fc = firstMove % n;
    var p = SYM[best.t](fr, fc, n);
    firstMove = p[0] * n + p[1];
  }
  if (firstGuess >= 0) {
    var gr = Math.floor(firstGuess / n);
    var gc = firstGuess % n;
    var gp = SYM[best.t](gr, gc, n);
    firstGuess = gp[0] * n + gp[1];
  }
  var firstRule = mapRule(a.firstRule, SYM_SWAP[best.t]);

  return {
    tier: tier,
    score: score,
    branchCount: a.branchCount,
    failedBranches: a.failedBranches,
    propagationRatio: a.guessFree ? 1 : Math.max(0, 1 - a.branchCount / Math.max(1, a.playable)),
    initialForced: a.initial.forcedUnits > 0 || a.initial.nakedSingles > 0,
    nodes: a.nodes,
    maxDepth: a.branchCount,
    // 新指标体系
    givenCount: a.givenCount,
    playable: a.playable,
    placements: a.placements,
    marks: a.marks,
    lockSteps: a.lockSteps,
    lockMarks: a.lockMarks,
    singles: a.singles,
    guesses: a.guesses,
    guessFree: a.guessFree,
    usesLock: a.usesLock,
    hintsNeeded: a.hintsNeeded,
    firstMove: firstMove,
    firstRule: firstRule,
    firstMoveLockSteps: a.firstMoveLockSteps,
    firstGuess: firstGuess,
    initial: a.initial
  };
}

/** 报告用：一行可读的推理画像 */
function describe(n, analysis) {
  if (!analysis) return '求解失败';
  var a = analysis;
  return [
    n + '×' + n,
    '预放 ' + a.givenCount,
    '推理 ' + a.placements + ' 步',
    '打叉 ' + a.marks,
    '锁定 ' + a.lockSteps,
    '假设 ' + a.branchCount,
    '难度 ' + a.score + ' (T' + a.tier + ')'
  ].join(' · ');
}

/* ---------------- 布局规范签名 ---------------- */

function relabelGrid(n, grid) {
  var map = {};
  var next = 0;
  var out = '';
  for (var i = 0; i < n * n; i++) {
    var v = grid[i];
    if (!(v in map)) map[v] = next++;
    out += String.fromCharCode(48 + map[v]);
  }
  return out;
}

var SYM = [
  function (r, c, n) { return [r, c]; },
  function (r, c, n) { return [c, n - 1 - r]; },
  function (r, c, n) { return [n - 1 - r, n - 1 - c]; },
  function (r, c, n) { return [n - 1 - c, r]; },
  function (r, c, n) { return [r, n - 1 - c]; },
  function (r, c, n) { return [n - 1 - r, c]; },
  function (r, c, n) { return [c, r]; },
  function (r, c, n) { return [n - 1 - c, n - 1 - r]; }
];

/** 区域布局在“区域重编号 + 8 种对称”下的规范签名 */
function canonicalSignature(n, region) {
  var best = null;
  for (var t = 0; t < SYM.length; t++) {
    var moved = new Array(n * n);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var p = SYM[t](r, c, n);
        moved[r * n + c] = region[p[0] * n + p[1]];
      }
    }
    var key = relabelGrid(n, moved);
    if (best === null || key < best) best = key;
  }
  return n + ':' + best;
}

module.exports = {
  TIER_NAMES: TIER_NAMES,
  SCORE_T1: SCORE_T1,
  SCORE_T2: SCORE_T2,
  SCORE_T3: SCORE_T3,
  SCORE_T4: SCORE_T4,
  SCORE_GUESS_FLOOR: SCORE_GUESS_FLOOR,
  BRANCH_NODE_LIMIT: BRANCH_NODE_LIMIT,
  minTierOf: minTierOf,
  maxTierOf: maxTierOf,
  tierFromScore: tierFromScore,
  scoreOf: scoreOf,
  analyzeDifficulty: analyzeDifficulty,
  describe: describe,
  canonicalSignature: canonicalSignature
};
