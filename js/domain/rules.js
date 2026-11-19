/**
 * 玩法规则（与表现无关，唯一真相）。
 *
 * 约定：
 * - regionGrid 为长度 n*n 的数组，值为 0..n-1 的区域编号
 * - cats 为已放猫的格子下标数组（i = r*n + c）
 *
 * 通关判定只看规则本身，不读取关卡答案数组——
 * 即使答案被篡改，也不会把"填了另一个合法解"判成错。
 */

function pos(index, n) {
  return { r: Math.floor(index / n), c: index % n };
}

function adjacent(a, b) {
  var pa = a, pb = b;
  return Math.abs(pa.r - pb.r) <= 1 && Math.abs(pa.c - pb.c) <= 1;
}

/**
 * 分析当前摆法。
 * 返回 { conflict: {index: true}, solved: bool }
 * conflict 中的格子用于画警示描边——只标"参与冲突"的猫，不标空位。
 */
function analyze(cats, n, regionGrid) {
  var conflict = {};
  var list = [];
  var i, j;

  for (i = 0; i < cats.length; i++) {
    var p = pos(cats[i], n);
    list.push({ index: cats[i], r: p.r, c: p.c, g: regionGrid[cats[i]] });
  }

  for (i = 0; i < list.length; i++) {
    for (j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      var bad = false;
      if (a.r === b.r) bad = true;            // 同行
      if (a.c === b.c) bad = true;            // 同列
      if (a.g === b.g) bad = true;            // 同区域
      if (adjacent(a, b)) bad = true;         // 相邻（含对角）
      if (bad) {
        conflict[a.index] = true;
        conflict[b.index] = true;
      }
    }
  }

  var solved = list.length === n && isEmpty(conflict);
  return { conflict: conflict, solved: solved };
}

function isEmpty(o) {
  for (var k in o) if (o.hasOwnProperty(k)) return false;
  return true;
}

/** 某格是否被任何一只已放猫的同行/同列/同区域/相邻规则排除（用于自动排除提示，S2 使用） */
function isExcluded(r, c, cats, n, regionGrid) {
  var g = regionGrid[r * n + c];
  for (var i = 0; i < cats.length; i++) {
    var p = pos(cats[i], n);
    if (p.r === r && p.c === c) continue;
    if (p.r === r || p.c === c) return true;
    if (regionGrid[cats[i]] === g) return true;
    if (adjacent(p, { r: r, c: c })) return true;
  }
  return false;
}

/** 校验答案数组（p[r] = 猫所在列）是否满足全部规则 */
function verifySolution(solution, n, regionGrid) {
  if (!solution || solution.length !== n) return false;
  var usedCol = {};
  var usedReg = {};
  for (var r = 0; r < n; r++) {
    var c = solution[r];
    if (typeof c !== 'number' || c < 0 || c >= n) return false;
    if (usedCol[c]) return false;
    usedCol[c] = true;
    var g = regionGrid[r * n + c];
    if (usedReg[g]) return false;
    usedReg[g] = true;
    if (r > 0 && Math.abs(c - solution[r - 1]) < 2) return false;
  }
  return true;
}

module.exports = {
  analyze: analyze,
  isExcluded: isExcluded,
  verifySolution: verifySolution
};
