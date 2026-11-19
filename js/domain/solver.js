/**
 * 唯一解求解器（构建期 + 运行时共用）。
 *
 * 按行回溯：每行选一列，要求列/区域不重复、上下行不同列且不斜邻。
 * 只负责"数解"和"判断唯一"，不依赖关卡答案数组。
 * 节点上限用于拒绝病态候选，避免批量生成时被个别盘面拖死。
 */
var DEFAULT_NODE_LIMIT = 200000;

function solutionsList(n, region, cap, opts) {
  cap = cap || 2;
  opts = opts || {};
  var limit = opts.nodeLimit || DEFAULT_NODE_LIMIT;
  var usedCol = 0;
  var usedReg = 0;
  var rowCols = new Array(n);
  var out = [];
  var nodes = 0;
  var truncated = false;

  // 每个区域包含的格子，供 P2 剪枝
  var regCells = [];
  for (var g = 0; g < n; g++) regCells.push([]);
  for (var i = 0; i < n * n; i++) {
    regCells[region[i]].push({ r: Math.floor(i / n), c: i % n });
  }

  function feasibleFrom(row, prev) {
    for (var f = row; f < n; f++) {
      var any = false;
      for (var c = 0; c < n; c++) {
        if (usedCol & (1 << c)) continue;
        if (usedReg & (1 << region[f * n + c])) continue;
        if (f === row && row > 0 && Math.abs(c - prev) < 2) continue;
        any = true;
        break;
      }
      if (!any) return false;
    }
    // P2：每个未用区域必须还能在剩余行放下一只猫（忽略未来行邻接，属于安全放宽）
    for (var gr = 0; gr < n; gr++) {
      if (usedReg & (1 << gr)) continue;
      var can = false;
      var list = regCells[gr];
      for (var k = 0; k < list.length; k++) {
        if (list[k].r < row) continue;
        if (usedCol & (1 << list[k].c)) continue;
        can = true;
        break;
      }
      if (!can) return false;
    }
    return true;
  }

  function dfs(row, prev) {
    if (out.length >= cap || truncated) return;
    nodes++;
    if (nodes > limit) {
      truncated = true;
      return;
    }
    if (row === n) {
      out.push(rowCols.slice());
      return;
    }
    if (!feasibleFrom(row, prev)) return;

    for (var c = 0; c < n; c++) {
      if (usedCol & (1 << c)) continue;
      if (row > 0 && Math.abs(c - prev) < 2) continue;
      var g = region[row * n + c];
      if (usedReg & (1 << g)) continue;

      usedCol |= 1 << c;
      usedReg |= 1 << g;
      rowCols[row] = c;
      dfs(row + 1, c);
      usedCol &= ~(1 << c);
      usedReg &= ~(1 << g);
      if (out.length >= cap || truncated) return;
    }
  }

  dfs(0, -2);
  if (opts.stats) {
    opts.stats.nodes = nodes;
    opts.stats.truncated = truncated;
  }
  return out;
}

function countSolutions(n, region, cap, opts) {
  var stats = { nodes: 0, truncated: false };
  opts = opts || {};
  opts.stats = stats;
  var list = solutionsList(n, region, cap || 2, opts);
  return {
    count: list.length,
    first: list[0] || null,
    list: list,
    truncated: stats.truncated,
    nodes: stats.nodes
  };
}

/**
 * 带完整元数据的计数入口。批量测试与生成器用它区分：
 *   唯一解 / 多解 / 搜索超限（按不合格处理）。
 */
function solveInfo(n, region, cap, opts) {
  var stats = { nodes: 0, truncated: false };
  opts = opts || {};
  var list = solutionsList(n, region, cap || 2, {
    nodeLimit: opts.nodeLimit,
    stats: stats
  });
  return {
    count: list.length,
    first: list[0] || null,
    list: list,
    truncated: stats.truncated,
    nodes: stats.nodes
  };
}

function sameSolution(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

module.exports = {
  DEFAULT_NODE_LIMIT: DEFAULT_NODE_LIMIT,
  solutionsList: solutionsList,
  countSolutions: countSolutions,
  solveInfo: solveInfo,
  sameSolution: sameSolution
};
