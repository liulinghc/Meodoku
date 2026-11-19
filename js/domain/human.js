/**
 * 人类技巧求解器（含预放猫）。
 *
 * 只用玩家能理解的规则推演，并用同一条路径产出难度指标：
 *   P1 放置排除：一行/列/区各一只猫，猫的八邻域不能再放（对应玩家打叉）
 *   P2 唯一候选：某行/列/区只剩一个可放位置 → 直接放猫
 *   P3 锁定候选：某区候选全在同一行/列（或某行/列候选全在同一区）
 *                → 该行/列（或该区）其余位置打叉
 *   P4 假设验证：P1–P3 停住时才拆分支，成功路径的深度就是“猜测次数”
 *
 * 所有遍历顺序固定（行 → 列 → 区，编号升序），同一盘面必然得到同一组指标。
 * 预放猫在开局先落子，因此候选数、开局突破口、所需打叉和推理步数都会被
 * 真实地计入门槛，而不是只按棋盘尺寸估难度。
 */
var NODE_LIMIT = 40000;

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

  // 区域编号只是颜色名；按首个格子排序后再处理，避免重命名颜色改变推演顺序。
  var regOrder = [];
  for (i = 0; i < n; i++) {
    regOrder.push({ g: i, first: st.regCells[i][0] });
  }
  regOrder.sort(function (a, b) {
    if (a.first !== b.first) return a.first - b.first;
    return a.g - b.g;
  });
  st.regOrder = regOrder;
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
    regOrder: st.regOrder,
    cats: st.cats
  };
}

function createMetrics() {
  return {
    placements: 0,      // 玩家通过推导放下的猫（不含预放）
    marks: 0,           // 推导过程中排除的候选格总数（打叉量）
    lockSteps: 0,       // 触发锁定候选并真正排除候选的次数
    lockMarks: 0,       // 其中由锁定候选排除的格数
    singles: 0,         // 唯一候选放猫次数
    branches: 0,        // 成功路径上的假设分支深度
    failedBranches: 0,  // 走不通的分支数
    guesses: 0,         // 搜索中尝试过的假设落子数
    nodes: 0,
    truncated: false,
    firstMove: -1,
    firstRule: '',
    firstMoveLockSteps: 0,
    firstGuess: -1
  };
}

/** 在 idx 放猫并排除同行/列/区/八邻域。返回新排除的候选格数 */
function placeAt(st, idx) {
  var n = st.n;
  var r = Math.floor(idx / n);
  var c = idx % n;
  var g = st.region[idx];
  if (!st.cand[idx]) return -1;
  if (st.rowCat[r] >= 0 || st.colCat[c] >= 0 || st.regCat[g] >= 0) return -1;

  st.cand[idx] = 0;
  st.rowCat[r] = c;
  st.colCat[c] = r;
  st.regCat[g] = r;
  st.cats++;

  var removed = 0;
  var i;

  function kill(x) {
    if (st.cand[x]) {
      st.cand[x] = 0;
      removed++;
    }
  }

  for (i = 0; i < n; i++) kill(r * n + i);
  for (i = 0; i < n; i++) kill(i * n + c);
  var reg = st.regCells[g];
  for (i = 0; i < reg.length; i++) kill(reg[i]);

  for (var rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= n) continue;
    for (var cc = c - 1; cc <= c + 1; cc++) {
      if (cc < 0 || cc >= n) continue;
      kill(rr * n + cc);
    }
  }
  return removed;
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

function unitOccupied(st, type, id) {
  if (type === 0) return st.rowCat[id] >= 0;
  if (type === 1) return st.colCat[id] >= 0;
  return st.regCat[id] >= 0;
}

function eliminateRowOutside(st, row, keepReg) {
  var n = st.n;
  var removed = 0;
  for (var c = 0; c < n; c++) {
    var idx = row * n + c;
    if (st.region[idx] !== keepReg && st.cand[idx]) {
      st.cand[idx] = 0;
      removed++;
    }
  }
  return removed;
}

function eliminateColOutside(st, col, keepReg) {
  var n = st.n;
  var removed = 0;
  for (var r = 0; r < n; r++) {
    var idx = r * n + col;
    if (st.region[idx] !== keepReg && st.cand[idx]) {
      st.cand[idx] = 0;
      removed++;
    }
  }
  return removed;
}

function eliminateRegionOutside(st, reg, row, col) {
  var cells = st.regCells[reg];
  var n = st.n;
  var removed = 0;
  for (var i = 0; i < cells.length; i++) {
    var idx = cells[i];
    var r = Math.floor(idx / n);
    var c = idx % n;
    if (r !== row && c !== col && st.cand[idx]) {
      st.cand[idx] = 0;
      removed++;
    }
  }
  return removed;
}

/**
 * 返回 'solved' | 'stuck' | 'contradiction'。
 * 先找唯一候选；没有可放的猫时才做锁定候选排除。
 */
function propagate(st, metrics) {
  var n = st.n;

  while (true) {
    if (st.cats === n) return 'solved';

    var singles = [];
    var t, id, list;
    for (t = 0; t < 3; t++) {
      for (id = 0; id < n; id++) {
        if (unitOccupied(st, t, id)) continue;
        list = unitCands(st, t, id);
        if (!list.length) return 'contradiction';
        if (list.length === 1) {
          singles.push({ idx: list[0], type: t });
        }
      }
    }
    if (singles.length) {
      // 多个单位同时只剩一个候选时，按格子编号取第一处；
      // 先看哪个行/列/区不影响结果，颜色重命名也不会改变路径。
      singles.sort(function (a, b) {
        if (a.idx !== b.idx) return a.idx - b.idx;
        return a.type - b.type;
      });
      var pickSingle = singles[0];
      var single = pickSingle.idx;
      var removedSingle = placeAt(st, single);
      if (removedSingle < 0) return 'contradiction';
      metrics.placements++;
      metrics.singles++;
      metrics.marks += removedSingle;
      if (metrics.firstMove < 0) {
        metrics.firstMove = single;
        metrics.firstRule = pickSingle.type === 0 ? 'row' :
          (pickSingle.type === 1 ? 'col' : 'region');
        metrics.firstMoveLockSteps = metrics.lockSteps;
      }
      continue;
    }

    // P3：锁定候选，反复消除到不动点
    var changed = 0;
    var g, r, c, k;
    var ro;

    for (ro = 0; ro < st.regOrder.length; ro++) {
      g = st.regOrder[ro].g;
      if (st.regCat[g] >= 0) continue;
      list = unitCands(st, 2, g);
      if (!list.length) return 'contradiction';
      var onlyRow = -2;
      var onlyCol = -2;
      var multiRow = false;
      var multiCol = false;
      for (k = 0; k < list.length; k++) {
        r = Math.floor(list[k] / n);
        c = list[k] % n;
        if (onlyRow === -2) onlyRow = r;
        else if (onlyRow !== r) multiRow = true;
        if (onlyCol === -2) onlyCol = c;
        else if (onlyCol !== c) multiCol = true;
      }
      if (!multiRow && onlyRow >= 0) {
        var rm1 = eliminateRowOutside(st, onlyRow, g);
        if (rm1 > 0) {
          changed += rm1;
          metrics.lockSteps++;
          metrics.lockMarks += rm1;
          metrics.marks += rm1;
        }
      }
      if (!multiCol && onlyCol >= 0) {
        var rm2 = eliminateColOutside(st, onlyCol, g);
        if (rm2 > 0) {
          changed += rm2;
          metrics.lockSteps++;
          metrics.lockMarks += rm2;
          metrics.marks += rm2;
        }
      }
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
        var rm3 = eliminateRegionOutside(st, onlyReg, r, -1);
        if (rm3 > 0) {
          changed += rm3;
          metrics.lockSteps++;
          metrics.lockMarks += rm3;
          metrics.marks += rm3;
        }
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
        var rm4 = eliminateRegionOutside(st, onlyRegC, -1, c);
        if (rm4 > 0) {
          changed += rm4;
          metrics.lockSteps++;
          metrics.lockMarks += rm4;
          metrics.marks += rm4;
        }
      }
    }

    if (!changed) return 'stuck';
  }
}

function compareKeys(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** 选候选最少的单位；平局按格号序列裁决，避免依赖行/列/区编号 */
function pickUnit(st) {
  var n = st.n;
  var bestType = -1;
  var bestId = -1;
  var bestList = null;
  var bestKey = null;
  var t, id, list, key;
  for (t = 0; t < 3; t++) {
    for (id = 0; id < n; id++) {
      if (unitOccupied(st, t, id)) continue;
      list = unitCands(st, t, id);
      if (list.length <= 1) continue;
      key = [list.length].concat(list);
      if (!bestKey || compareKeys(key, bestKey) < 0) {
        bestKey = key;
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
    if (depth > metrics.branches) metrics.branches = depth;
    return true;
  }
  if (res === 'contradiction') return false;

  var unit = pickUnit(st);
  if (!unit) return false;

  for (var k = 0; k < unit.list.length; k++) {
    if (metrics.nodes >= NODE_LIMIT) {
      metrics.truncated = true;
      return false;
    }
    metrics.nodes++;
    var trial = cloneState(st);
    var idx = unit.list[k];
    var removed = placeAt(trial, idx);
    if (removed < 0) continue;
    if (metrics.firstMove < 0 && metrics.firstGuess < 0) metrics.firstGuess = idx;
    metrics.guesses++;
    if (search(trial, depth + 1, metrics)) {
      if (depth + 1 > metrics.branches) metrics.branches = depth + 1;
      return true;
    }
    metrics.failedBranches++;
  }
  return false;
}

/* ---------------- 开局候选画像 ---------------- */

function initialProfile(st) {
  var n = st.n;
  var N = n * n;
  var openCells = 0;
  var sumOptions = 0;
  var minCell = 99;
  var maxCell = 0;
  var nakedSingles = 0;
  var forcedUnits = 0;
  var minUnit = 99;
  var maxUnit = 0;
  var unitCount = 0;
  var rowSizes = [];
  var colSizes = [];
  var regSizes = [];
  var i, t, id, list, size;

  for (t = 0; t < 3; t++) {
    var arr = t === 0 ? rowSizes : (t === 1 ? colSizes : regSizes);
    for (id = 0; id < n; id++) {
      if (unitOccupied(st, t, id)) {
        arr.push(0);
        continue;
      }
      list = unitCands(st, t, id);
      size = list.length;
      arr.push(size);
      unitCount++;
      if (size < minUnit) minUnit = size;
      if (size > maxUnit) maxUnit = size;
      if (size === 1) forcedUnits++;
    }
  }

  for (i = 0; i < N; i++) {
    if (!st.cand[i]) continue;
    var r = Math.floor(i / n);
    var c = i % n;
    var g = st.region[i];
    var ro = rowSizes[r];
    var co = colSizes[c];
    var re = regSizes[g];
    var opts = Math.min(ro, co, re);
    openCells++;
    sumOptions += opts;
    if (opts < minCell) minCell = opts;
    if (opts > maxCell) maxCell = opts;
    if (ro === 1 || co === 1 || re === 1) nakedSingles++;
  }

  if (!openCells) {
    minCell = 0;
    maxCell = 0;
  }
  if (!unitCount) {
    minUnit = 0;
    maxUnit = 0;
  }

  return {
    openCells: openCells,
    minCellOptions: minCell,
    maxCellOptions: maxCell,
    avgCellOptions: openCells ? sumOptions / openCells : 0,
    nakedSingles: nakedSingles,
    forcedUnits: forcedUnits,
    minUnit: minUnit,
    maxUnit: maxUnit,
    avgUnit: unitCount ? (function () {
      var sum = 0;
      for (var q = 0; q < rowSizes.length; q++) sum += rowSizes[q];
      for (q = 0; q < colSizes.length; q++) sum += colSizes[q];
      for (q = 0; q < regSizes.length; q++) sum += regSizes[q];
      return sum / unitCount;
    })() : 0,
    rowSizes: rowSizes,
    colSizes: colSizes,
    regionSizes: regSizes
  };
}

/**
 * 分析一关。
 * @param n 边长
 * @param region 长度 n² 的区域数组
 * @param givens 预放猫的格子下标数组（可选）
 */
function analyze(n, region, givens) {
  givens = givens || [];
  var st = makeState(n, region);
  var metrics = createMetrics();
  var i;
  var givenMarks = 0;

  for (i = 0; i < givens.length; i++) {
    var idx = givens[i];
    if (!(idx >= 0 && idx < n * n)) {
      return { solved: false, invalid: true, error: 'given-out-of-range' };
    }
    var removed = placeAt(st, idx);
    if (removed < 0) {
      return { solved: false, invalid: true, error: 'given-conflict' };
    }
    givenMarks += removed;
  }

  var initial = initialProfile(st);
  initial.givenCount = givens.length;
  initial.givenMarks = givenMarks;
  initial.playable = n - givens.length;

  var solved = search(st, 0, metrics);
  if (!solved || metrics.truncated) {
    return {
      solved: false,
      invalid: false,
      truncated: metrics.truncated,
      initial: initial,
      metrics: metrics
    };
  }

  return {
    solved: true,
    invalid: false,
    truncated: false,
    n: n,
    givenCount: givens.length,
    playable: n - givens.length,
    initial: initial,
    placements: metrics.placements,
    marks: metrics.marks,
    lockSteps: metrics.lockSteps,
    lockMarks: metrics.lockMarks,
    singles: metrics.singles,
    branchCount: metrics.branches,
    failedBranches: metrics.failedBranches,
    guesses: metrics.guesses,
    nodes: metrics.nodes,
    firstMove: metrics.firstMove,
    firstRule: metrics.firstRule,
    firstMoveLockSteps: metrics.firstMoveLockSteps,
    firstGuess: metrics.firstGuess,
    guessFree: metrics.branches === 0,
    usesLock: metrics.lockSteps > 0,
    // 纯逻辑可完成时，玩家不需要真正“猜”；分支深度就是提示需求的上限
    hintsNeeded: metrics.branches
  };
}

/** 只取开局第一个可推定的格子（教学高亮用） */
function firstDeduction(n, region, givens) {
  var a = analyze(n, region, givens);
  if (!a || !a.solved || a.firstMove < 0) return null;
  return {
    index: a.firstMove,
    rule: a.firstRule,
    lockSteps: a.firstMoveLockSteps
  };
}

module.exports = {
  NODE_LIMIT: NODE_LIMIT,
  makeState: makeState,
  cloneState: cloneState,
  placeAt: placeAt,
  propagate: propagate,
  analyze: analyze,
  firstDeduction: firstDeduction,
  initialProfile: initialProfile
};
