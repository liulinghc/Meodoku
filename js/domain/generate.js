/**
 * 关卡生成核心（运行时与 Node 工具共用）。
 *
 * 管线：造解 → 从解格生长区域 → 结构检查 → 唯一解计数 → 定向修补
 *       → 人类技巧难度评级（目标档位匹配）。
 *
 * 不变式：
 *   1. 解本身合法（每行/列各一，|Δ列| ≥ 2，保证八方向不相邻）
 *   2. 每个区域恰好含解中的一只猫
 *   3. 解唯一（求解器计数恰为 1，且等于生成的解）
 *   4. 区域连通、结构阈值合格
 *
 * 生成失败返回 null，绝不以“临时假数据”兜底。
 */
var rng = require('../core/rng');
var solver = require('./solver');
var difficulty = require('./difficulty');

var GENERATOR_VERSION = 2;

function range(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push(i);
  return a;
}

/* ---------------- 生成解 ---------------- */

function buildPermutation(n, rand) {
  var used = new Array(n);
  var sol = new Array(n);

  function dfs(row, prev) {
    if (row === n) return true;
    var order = rng.shuffle(range(n), rand);
    for (var i = 0; i < order.length; i++) {
      var c = order[i];
      if (used[c]) continue;
      if (row > 0 && Math.abs(c - prev) < 2) continue;
      used[c] = true;
      sol[row] = c;
      if (dfs(row + 1, c)) return true;
      used[c] = false;
    }
    return false;
  }

  return dfs(0, -2) ? sol : null;
}

/* ---------------- 生长区域 ---------------- */

function neighborsOf(n) {
  var nb = [];
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var list = [];
      if (r > 0) list.push((r - 1) * n + c);
      if (r < n - 1) list.push((r + 1) * n + c);
      if (c > 0) list.push(r * n + c - 1);
      if (c < n - 1) list.push(r * n + c + 1);
      nb.push(list);
    }
  }
  return nb;
}

/**
 * 多源生长：每轮优先扩张最小区域，选格偏好与本区贴合的位置。
 * 每个区域的种子固定为解格，保证 INV-2/3/4 由构造成立。
 */
function growRegions(n, solution, rand, mode) {
  var N = n * n;
  var nb = neighborsOf(n);
  var region = new Array(N);
  var inFront = new Array(N);
  var sizes = new Array(n);
  var frontier = [];
  var g, i;

  for (i = 0; i < N; i++) {
    region[i] = -1;
    inFront[i] = 0;
  }
  for (g = 0; g < n; g++) {
    sizes[g] = 0;
    frontier.push([]);
  }

  function addFront(cell, reg) {
    if (region[cell] !== -1) return;
    var bit = 1 << reg;
    if (inFront[cell] & bit) return;
    inFront[cell] |= bit;
    frontier[reg].push(cell);
  }

  for (var r = 0; r < n; r++) {
    var seedCell = r * n + solution[r];
    region[seedCell] = r;
    sizes[r] = 1;
  }
  for (var reg = 0; reg < n; reg++) {
    var seed = reg * n + solution[reg];
    for (i = 0; i < nb[seed].length; i++) addFront(nb[seed][i], reg);
  }

  function hasAvailable(reg) {
    var list = frontier[reg];
    for (var k = 0; k < list.length; k++) {
      if (region[list[k]] === -1) return true;
    }
    return false;
  }

  var assigned = n;
  while (assigned < N) {
    var minSize = Infinity;
    var pickList = [];

    for (g = 0; g < n; g++) {
      if (!hasAvailable(g)) continue;
      if (mode === 'random') {
        pickList.push(g);
        continue;
      }
      if (sizes[g] < minSize) {
        minSize = sizes[g];
        pickList = [g];
      } else if (sizes[g] === minSize) {
        pickList.push(g);
      }
    }
    if (!pickList.length) break;

    var pick = pickList[Math.floor(rand() * pickList.length)];
    var list = frontier[pick];
    var best = -1;
    var bestScore = -Infinity;

    for (var k = 0; k < list.length; k++) {
      var cell = list[k];
      if (region[cell] !== -1) continue;
      var same = 0;
      for (var q = 0; q < nb[cell].length; q++) {
        if (region[nb[cell][q]] === pick) same++;
      }
      var score = 1 + 2 * same + 0.6 * rand();
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }

    if (best < 0) {
      frontier[pick] = [];
      continue;
    }

    region[best] = pick;
    sizes[pick]++;
    assigned++;
    for (i = 0; i < nb[best].length; i++) addFront(nb[best][i], pick);
  }

  if (assigned !== N) return null;
  return region;
}

/* ---------------- 结构检查 ---------------- */

function checkStructure(n, region) {
  var counts = new Array(n);
  var regRow = [];
  var regCol = [];
  var minX = [];
  var maxX = [];
  var minY = [];
  var maxY = [];
  var g, r, c;

  for (g = 0; g < n; g++) {
    counts[g] = 0;
    regRow.push(new Array(n));
    regCol.push(new Array(n));
    minX.push(Infinity); maxX.push(-Infinity);
    minY.push(Infinity); maxY.push(-Infinity);
    for (r = 0; r < n; r++) {
      regRow[g][r] = 0;
      regCol[g][r] = 0;
    }
  }

  for (r = 0; r < n; r++) {
    for (c = 0; c < n; c++) {
      g = region[r * n + c];
      counts[g]++;
      regRow[g][r]++;
      regCol[g][c]++;
      if (c < minX[g]) minX[g] = c;
      if (c > maxX[g]) maxX[g] = c;
      if (r < minY[g]) minY[g] = r;
      if (r > maxY[g]) maxY[g] = r;
    }
  }

  var smin = Math.max(2, Math.floor(n / 3));
  var smax = Math.ceil(n * 2.2);
  var maxCount = 0;
  var minCount = Infinity;

  for (g = 0; g < n; g++) {
    if (counts[g] < smin || counts[g] > smax) return '面积越界';
    for (r = 0; r < n; r++) {
      if (regRow[g][r] === n) return '占满整行';
      if (regCol[g][r] === n) return '占满整列';
      // 近满行只对 N≥5 生效；4×4 教学关保留形状空间
      if (n >= 5 && regRow[g][r] >= n - 1) return '近满行';
      if (n >= 5 && regCol[g][r] >= n - 1) return '近满列';
    }
    var bbox = (maxX[g] - minX[g] + 1) * (maxY[g] - minY[g] + 1);
    if (counts[g] / bbox < 0.55) return '过于稀疏';
    if (counts[g] > maxCount) maxCount = counts[g];
    if (counts[g] < minCount) minCount = counts[g];
  }

  if (maxCount / minCount > 3.5) return '区域失衡';

  // 周长比：区域与外部（其他区域或棋盘边界）相邻的边数
  var perimeter = new Array(n);
  for (g = 0; g < n; g++) perimeter[g] = 0;
  for (r = 0; r < n; r++) {
    for (c = 0; c < n; c++) {
      g = region[r * n + c];
      if (r === 0 || region[(r - 1) * n + c] !== g) perimeter[g]++;
      if (r === n - 1 || region[(r + 1) * n + c] !== g) perimeter[g]++;
      if (c === 0 || region[r * n + c - 1] !== g) perimeter[g]++;
      if (c === n - 1 || region[r * n + c + 1] !== g) perimeter[g]++;
    }
  }
  for (g = 0; g < n; g++) {
    if (perimeter[g] / (4 * Math.sqrt(counts[g])) > 2.0) return '形状过细';
  }
  return null;
}

/* ---------------- 求解与修补 ---------------- */

function regionSizes(n, region) {
  var sizes = new Array(n);
  for (var i = 0; i < n; i++) sizes[i] = 0;
  for (var j = 0; j < n * n; j++) sizes[region[j]]++;
  return sizes;
}

/** 从区域 g 中去掉 skip 后是否仍连通 */
function connectedWithout(n, region, g, skip, nb) {
  var start = -1;
  var total = 0;
  for (var i = 0; i < n * n; i++) {
    if (region[i] === g && i !== skip) {
      if (start < 0) start = i;
      total++;
    }
  }
  if (start < 0) return false;

  var seen = {};
  var stack = [start];
  var count = 0;
  seen[start] = true;
  while (stack.length) {
    var cell = stack.pop();
    count++;
    var list = nb[cell];
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      if (!seen[x] && region[x] === g && x !== skip) {
        seen[x] = true;
        stack.push(x);
      }
    }
  }
  return count === total;
}

/**
 * 定向修补：把替代解 alt 的某个非目标解格改划到相邻区域，
 * 使 alt 因区域重复失效；目标解格不动，因此原解仍成立。
 */
function repairToOne(n, region, solution, rand, maxIter) {
  var nb = neighborsOf(n);
  var smax = Math.ceil(n * 2.2);

  for (var it = 0; it < maxIter; it++) {
    var info = solver.solveInfo(n, region, 3);
    if (info.truncated) return null;
    var sols = info.list;
    if (sols.length === 1) {
      return solver.sameSolution(sols[0], solution) ? region : null;
    }
    if (!sols.length) return null;

    var alt = null;
    for (var s = 0; s < sols.length; s++) {
      if (!solver.sameSolution(sols[s], solution)) { alt = sols[s]; break; }
    }
    if (!alt) return null;

    var sizes = regionSizes(n, region);
    var cells = [];
    for (var r = 0; r < n; r++) cells.push(r * n + alt[r]);
    rng.shuffle(cells, rand);

    var moved = false;
    for (var ci = 0; ci < cells.length && !moved; ci++) {
      var x = cells[ci];
      var row = Math.floor(x / n);
      if (x === row * n + solution[row]) continue;
      var A = region[x];
      if (sizes[A] <= 2) continue;

      var targets = [];
      for (var q = 0; q < nb[x].length; q++) {
        var B = region[nb[x][q]];
        if (B !== A && targets.indexOf(B) < 0) targets.push(B);
      }
      rng.shuffle(targets, rand);

      for (var ti = 0; ti < targets.length; ti++) {
        var to = targets[ti];
        if (sizes[to] + 1 > smax) continue;
        if (!connectedWithout(n, region, A, x, nb)) continue;
        var old = region[x];
        region[x] = to;
        if (checkStructure(n, region)) {
          region[x] = old;
          continue;
        }
        sizes[A]--;
        sizes[to]++;
        moved = true;
        break;
      }
    }
    if (!moved) return null;
  }

  var fin = solver.solveInfo(n, region, 2);
  return !fin.truncated && fin.count === 1 &&
    solver.sameSolution(fin.first, solution) ? region : null;
}

/* ---------------- 编码 ---------------- */

function encodeRegions(region, n) {
  var rows = [];
  for (var r = 0; r < n; r++) {
    var s = '';
    for (var c = 0; c < n; c++) s += String.fromCharCode(97 + region[r * n + c]);
    rows.push(s);
  }
  return rows;
}

function decodeRegions(rows, n) {
  var out = new Array(n * n);
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) out[r * n + c] = rows[r].charCodeAt(c) - 97;
  }
  return out;
}

/** 单字符串区域编码：长度为 n² 的字母串 */
function encodeRegionString(region, n) {
  var s = '';
  for (var i = 0; i < n * n; i++) s += String.fromCharCode(97 + region[i]);
  return s;
}

function decodeRegionString(str, n) {
  var out = new Array(n * n);
  for (var i = 0; i < n * n; i++) out[i] = str.charCodeAt(i) - 97;
  return out;
}

function encodeSolutionString(solution) {
  var s = '';
  for (var i = 0; i < solution.length; i++) s += String(solution[i]);
  return s;
}

function decodeSolutionString(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) out.push(str.charCodeAt(i) - 48);
  return out;
}

/* ---------------- 对外 ---------------- */

/**
 * 生成一关。返回 null 表示 attempts 次内没找到合格布局。
 * 种子固定 → 结果可复现。opts.tier 指定目标档位（1–5）。
 */
function generateLevel(seed, n, opts) {
  opts = opts || {};
  var attempts = opts.attempts || 400;
  var mode = opts.mode || 'balanced';
  var maxIter = opts.repairIter || 60;
  var targetTier = opts.tier || 0;
  var stat = {
    attempts: 0,
    structure: 0,
    nonUnique: 0,
    repaired: 0,
    tierReject: 0,
    difficultyFail: 0,
    solveLimit: 0
  };

  for (var a = 0; a < attempts; a++) {
    stat.attempts++;
    var s = (seed + Math.imul(a, 2654435761)) >>> 0;
    var rand = rng.mulberry32(s);

    var solution = buildPermutation(n, rand);
    if (!solution) continue;

    var region = growRegions(n, solution, rand, mode);
    if (!region) continue;

    if (checkStructure(n, region)) {
      stat.structure++;
      continue;
    }

    var info = solver.solveInfo(n, region, 2);
    if (info.truncated) {
      stat.solveLimit++;
      continue;
    }
    if (info.count !== 1) {
      if (info.count === 2) {
        var fixed = repairToOne(n, region, solution, rand, maxIter);
        if (fixed) {
          region = fixed;
          stat.repaired++;
          info = solver.solveInfo(n, region, 2);
        }
      }
      if (info.truncated) {
        stat.solveLimit++;
        continue;
      }
      if (info.count !== 1) {
        stat.nonUnique++;
        continue;
      }
    }

    if (!solver.sameSolution(info.first, solution)) {
      stat.nonUnique++;
      continue;
    }

    var diff = difficulty.analyzeDifficulty(n, region);
    if (!diff) {
      stat.difficultyFail++;
      continue;
    }
    if (targetTier && diff.tier !== targetTier) {
      stat.tierReject++;
      continue;
    }

    return {
      n: n,
      seed: seed,
      regions: encodeRegions(region, n),
      regionString: encodeRegionString(region, n),
      solution: solution,
      solutionString: encodeSolutionString(solution),
      tier: diff.tier,
      difficulty: diff.score,
      branch: diff.branchCount,
      failedBranches: diff.failedBranches,
      propagationRatio: diff.propagationRatio,
      attempts: stat.attempts,
      repair: stat.repaired > 0,
      stats: stat
    };
  }

  return null;
}

function levelGrid(level) {
  var n = level.n;
  if (level.regions) return decodeRegions(level.regions, n);
  return decodeRegionString(level.r, n);
}

function levelSolution(level) {
  if (level.solution) return level.solution;
  return decodeSolutionString(level.s);
}

/** 完整校验：解合法 + 唯一解 + 结构 + 连通 */
function validateLevel(level, opts) {
  var n = level.n;
  var region = levelGrid(level);
  var solution = levelSolution(level);
  var errs = [];
  var i;

  if (region.length !== n * n) errs.push('区域长度');
  for (i = 0; i < region.length; i++) {
    if (!(region[i] >= 0 && region[i] < n)) { errs.push('区域编号'); break; }
  }
  if (solution.length !== n) errs.push('答案长度');

  var usedCol = {};
  var usedReg = {};
  for (var r = 0; r < n; r++) {
    var c = solution[r];
    if (!(c >= 0 && c < n)) { errs.push('列越界 r' + r); continue; }
    if (usedCol[c]) errs.push('列重复 r' + r);
    usedCol[c] = true;
    var g = region[r * n + c];
    if (usedReg[g]) errs.push('区域重复 r' + r);
    usedReg[g] = true;
    if (r > 0 && Math.abs(c - solution[r - 1]) < 2) errs.push('相邻 r' + r);
  }
  for (var g2 = 0; g2 < n; g2++) if (!usedReg[g2]) errs.push('区域缺解格 g' + g2);

  var struct = checkStructure(n, region);
  if (struct) errs.push(struct);
  if (!regionsConnected(n, region)) errs.push('区域不连通');

  var info = solver.solveInfo(n, region, 2, { nodeLimit: opts && opts.nodeLimit });
  if (info.truncated) errs.push('求解超限');
  else if (info.count !== 1) errs.push('解数=' + info.count);
  else if (!solver.sameSolution(info.first, solution)) errs.push('解不符');

  return { ok: errs.length === 0, errors: errs };
}

/** 区域连通性检查（4 邻接 BFS 覆盖区域全集） */
function regionsConnected(n, region) {
  var nb = neighborsOf(n);
  for (var g = 0; g < n; g++) {
    var start = -1;
    for (var i = 0; i < n * n; i++) {
      if (region[i] === g) { start = i; break; }
    }
    if (start < 0) return false;
    var stack = [start];
    var visited = {};
    visited[start] = true;
    var count = 0;
    while (stack.length) {
      var cell = stack.pop();
      count++;
      var list = nb[cell];
      for (var k = 0; k < list.length; k++) {
        var nx = list[k];
        if (!visited[nx] && region[nx] === g) {
          visited[nx] = true;
          stack.push(nx);
        }
      }
    }
    var total = 0;
    for (var j = 0; j < n * n; j++) if (region[j] === g) total++;
    if (count !== total) return false;
  }
  return true;
}

module.exports = {
  GENERATOR_VERSION: GENERATOR_VERSION,
  buildPermutation: buildPermutation,
  growRegions: growRegions,
  checkStructure: checkStructure,
  repairToOne: repairToOne,
  encodeRegions: encodeRegions,
  decodeRegions: decodeRegions,
  encodeRegionString: encodeRegionString,
  decodeRegionString: decodeRegionString,
  encodeSolutionString: encodeSolutionString,
  decodeSolutionString: decodeSolutionString,
  generateLevel: generateLevel,
  validateLevel: validateLevel,
  regionsConnected: regionsConnected,
  neighborsOf: neighborsOf,
  solutionsList: solver.solutionsList,
  countSolutions: solver.countSolutions,
  solveInfo: solver.solveInfo,
  sameSolution: solver.sameSolution,
  analyzeDifficulty: difficulty.analyzeDifficulty,
  canonicalSignature: difficulty.canonicalSignature,
  maxTierOf: difficulty.maxTierOf,
  TIER_NAMES: difficulty.TIER_NAMES
};
