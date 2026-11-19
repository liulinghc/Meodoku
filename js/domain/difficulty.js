/**
 * 难度评级（人类技巧求解器）与布局规范签名。
 *
 * 求解器只使用可解释的推理：
 *   R1 单元排除、R2 邻域排除、R3 唯一候选、
 *   R4 锁定候选（区域⇄行/列）、R5 最少候选分支。
 * 所有遍历顺序固定，同一区域布局必然得到同一档位与分数。
 *
 * 档位按“逻辑指标 + 尺寸上限”判定，详见 docs/02 §14。
 */
var TIER_NAMES = ['入门', '简单', '普通', '困难', '专家'];
var SCORE_T1 = 30;
var SCORE_T2 = 45;
var SCORE_T3 = 55;
var SCORE_T4 = 65;
var BRANCH_NODE_LIMIT = 40000;

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

/* ---------------- 人类技巧求解器 ---------------- */

function makeState(n, region) {
  var N = n * n;
  var st = {
    n: n,
    region: region,
    cand: new Array(N),
    rowCat: new Array(n),
    colCat: new Array(n),
    regCat: new Array(n),
    regCells: [],
    cats: 0
  };
  var i;
  for (i = 0; i < N; i++) st.cand[i] = 1;
  for (i = 0; i < n; i++) {
    st.rowCat[i] = -1;
    st.colCat[i] = -1;
    st.regCat[i] = -1;
    st.regCells.push([]);
  }
  for (i = 0; i < N; i++) st.regCells[region[i]].push(i);
  return st;
}

function cloneState(st) {
  return {
    n: st.n,
    region: st.region,
    cand: st.cand.slice(),
    rowCat: st.rowCat.slice(),
    colCat: st.colCat.slice(),
    regCat: st.regCat.slice(),
    regCells: st.regCells,
    cats: st.cats
  };
}

function place(st, r, c) {
  var n = st.n;
  var idx = r * n + c;
  if (!st.cand[idx]) return false;
  var g = st.region[idx];
  if (st.rowCat[r] >= 0 || st.colCat[c] >= 0 || st.regCat[g] >= 0) return false;

  st.rowCat[r] = c;
  st.colCat[c] = r;
  st.regCat[g] = r;
  st.cats++;

  var i;
  for (i = 0; i < n; i++) {
    st.cand[r * n + i] = 0;       // R1 同行
    st.cand[i * n + c] = 0;       // R1 同列
  }
  var reg = st.regCells[g];
  for (i = 0; i < reg.length; i++) st.cand[reg[i]] = 0;

  for (var rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= n) continue;
    for (var cc = c - 1; cc <= c + 1; cc++) {
      if (cc < 0 || cc >= n) continue;
      st.cand[rr * n + cc] = 0;   // R2 八邻域
    }
  }
  return true;
}

function unitCands(st, type, id) {
  var n = st.n;
  var out = [];
  var i;
  if (type === 0) {
    if (st.rowCat[id] >= 0) return out;
    for (i = 0; i < n; i++) if (st.cand[id * n + i]) out.push(id * n + i);
  } else if (type === 1) {
    if (st.colCat[id] >= 0) return out;
    for (i = 0; i < n; i++) if (st.cand[i * n + id]) out.push(i * n + id);
  } else {
    if (st.regCat[id] >= 0) return out;
    var cells = st.regCells[id];
    for (i = 0; i < cells.length; i++) if (st.cand[cells[i]]) out.push(cells[i]);
  }
  return out;
}

function eliminateRowOutside(st, row, keepReg) {
  var n = st.n;
  var changed = false;
  for (var c = 0; c < n; c++) {
    var idx = row * n + c;
    if (st.region[idx] !== keepReg && st.cand[idx]) {
      st.cand[idx] = 0;
      changed = true;
    }
  }
  return changed;
}

function eliminateColOutside(st, col, keepReg) {
  var n = st.n;
  var changed = false;
  for (var r = 0; r < n; r++) {
    var idx = r * n + col;
    if (st.region[idx] !== keepReg && st.cand[idx]) {
      st.cand[idx] = 0;
      changed = true;
    }
  }
  return changed;
}

function eliminateRegionOutside(st, reg, row, col) {
  var cells = st.regCells[reg];
  var n = st.n;
  var changed = false;
  for (var i = 0; i < cells.length; i++) {
    var idx = cells[i];
    var r = Math.floor(idx / n);
    var c = idx % n;
    if (r !== row && c !== col && st.cand[idx]) {
      st.cand[idx] = 0;
      changed = true;
    }
  }
  return changed;
}

/** 返回 'solved' | 'stuck' | 'contradiction' */
function propagate(st, metrics) {
  var n = st.n;
  while (true) {
    if (st.cats === n) return 'solved';

    var single = -1;
    var t, id, list;
    for (t = 0; t < 3; t++) {
      for (id = 0; id < n; id++) {
        if ((t === 0 && st.rowCat[id] >= 0) ||
            (t === 1 && st.colCat[id] >= 0) ||
            (t === 2 && st.regCat[id] >= 0)) continue;
        list = unitCands(st, t, id);
        if (!list.length) return 'contradiction';
        if (list.length === 1 && single < 0) single = list[0];
      }
    }
    if (single >= 0) {
      if (!place(st, Math.floor(single / n), single % n)) return 'contradiction';
      if (metrics) metrics.propagations++;
      continue;
    }

    // R4：反复消除候选，直到不动点
    var changed = false;
    var g, r, c, k;
    for (g = 0; g < n; g++) {
      if (st.regCat[g] >= 0) continue;
      list = unitCands(st, 2, g);
      if (!list.length) return 'contradiction';
      var row = -2;
      var col = -2;
      var multiRow = false;
      var multiCol = false;
      for (k = 0; k < list.length; k++) {
        r = Math.floor(list[k] / n);
        c = list[k] % n;
        if (row === -2) row = r;
        else if (row !== r) multiRow = true;
        if (col === -2) col = c;
        else if (col !== c) multiCol = true;
      }
      if (!multiRow && row >= 0) changed = eliminateRowOutside(st, row, g) || changed;
      if (!multiCol && col >= 0) changed = eliminateColOutside(st, col, g) || changed;
    }
    for (r = 0; r < n; r++) {
      if (st.rowCat[r] >= 0) continue;
      list = unitCands(st, 0, r);
      if (!list.length) return 'contradiction';
      var onlyReg = -2;
      var multiReg = false;
      for (k = 0; k < list.length; k++) {
        g = st.region[list[k]];
        if (onlyReg === -2) onlyReg = g;
        else if (onlyReg !== g) multiReg = true;
      }
      if (!multiReg && onlyReg >= 0) {
        changed = eliminateRegionOutside(st, onlyReg, r, -1) || changed;
      }
    }
    for (c = 0; c < n; c++) {
      if (st.colCat[c] >= 0) continue;
      list = unitCands(st, 1, c);
      if (!list.length) return 'contradiction';
      var onlyRegC = -2;
      var multiRegC = false;
      for (k = 0; k < list.length; k++) {
        g = st.region[list[k]];
        if (onlyRegC === -2) onlyRegC = g;
        else if (onlyRegC !== g) multiRegC = true;
      }
      if (!multiRegC && onlyRegC >= 0) {
        changed = eliminateRegionOutside(st, onlyRegC, -1, c) || changed;
      }
    }
    if (!changed) return 'stuck';
  }
}

function pickUnit(st) {
  var n = st.n;
  var bestType = -1;
  var bestId = -1;
  var bestList = null;
  var t, id, list;
  for (t = 0; t < 3; t++) {
    for (id = 0; id < n; id++) {
      if ((t === 0 && st.rowCat[id] >= 0) ||
          (t === 1 && st.colCat[id] >= 0) ||
          (t === 2 && st.regCat[id] >= 0)) continue;
      list = unitCands(st, t, id);
      if (list.length <= 1) continue;
      if (!bestList || list.length < bestList.length) {
        bestList = list;
        bestType = t;
        bestId = id;
      }
    }
  }
  if (!bestList) return null;
  return { type: bestType, id: bestId, list: bestList };
}

function search(st, depth, metrics) {
  var res = propagate(st, metrics);
  if (res === 'solved') {
    if (depth > metrics.branchCount) metrics.branchCount = depth;
    if (depth > metrics.maxDepth) metrics.maxDepth = depth;
    return true;
  }
  if (res === 'contradiction') return false;

  var unit = pickUnit(st);
  if (!unit) return false;

  for (var k = 0; k < unit.list.length; k++) {
    if (metrics.nodes >= BRANCH_NODE_LIMIT) {
      metrics.truncated = true;
      return false;
    }
    metrics.nodes++;
    var trial = cloneState(st);
    var idx = unit.list[k];
    if (!place(trial, Math.floor(idx / st.n), idx % st.n)) continue;
    if (search(trial, depth + 1, metrics)) {
      if (depth + 1 > metrics.branchCount) metrics.branchCount = depth + 1;
      if (depth + 1 > metrics.maxDepth) metrics.maxDepth = depth + 1;
      return true;
    }
    metrics.failedBranches++;
  }
  return false;
}

/**
 * 对已确认唯一解的关卡做难度评级。
 * 返回 null 表示求解超限或未解出（调用方应拒收）。
 */
function analyzeDifficulty(n, region) {
  var initial = makeState(n, region);
  var initialMetrics = { propagations: 0 };
  var initialRes = propagate(initial, initialMetrics);
  if (initialRes === 'contradiction') return null;
  var ratio = initial.cats / n;
  var initialForced = initial.cats > 0;

  var st = makeState(n, region);
  var metrics = {
    branchCount: 0,
    failedBranches: 0,
    maxDepth: 0,
    propagations: 0,
    nodes: 0,
    truncated: false
  };
  var solved = search(st, 0, metrics);
  if (!solved || metrics.truncated) return null;

  var sizeF = (n - 4) / 5;
  var branchF = Math.min(metrics.branchCount / 3, 1);
  var failF = Math.min(metrics.failedBranches / 4, 1);
  var propF = 1 - ratio;
  var score = Math.round(100 * (0.58 * sizeF + 0.26 * branchF +
    0.10 * failF + 0.06 * propF));
  var tier = tierFromScore(score);
  if (tier < minTierOf(n)) tier = minTierOf(n);
  if (tier > maxTierOf(n)) tier = maxTierOf(n);

  return {
    tier: tier,
    score: score,
    branchCount: metrics.branchCount,
    failedBranches: metrics.failedBranches,
    propagationRatio: ratio,
    initialForced: initialForced,
    nodes: metrics.nodes,
    maxDepth: maxDepthOf(metrics)
  };
}

function maxDepthOf(metrics) {
  return metrics.maxDepth || metrics.branchCount;
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
  BRANCH_NODE_LIMIT: BRANCH_NODE_LIMIT,
  minTierOf: minTierOf,
  maxTierOf: maxTierOf,
  tierFromScore: tierFromScore,
  analyzeDifficulty: analyzeDifficulty,
  canonicalSignature: canonicalSignature
};
