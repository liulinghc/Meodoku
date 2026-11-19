#!/usr/bin/env node
/**
 * 前 30 关新曲线生成器。
 *
 * 第 1–10 关：4×4。第 1–3 关分别预放 3/2/1 只猫（均来自唯一答案），
 *   第 4 关不预放并高亮第一处必然突破（h），第 5 关独立完成（运行时免费提示），
 *   第 6–10 关为色区较规整、零假设的入门题。
 * 第 11–30 关：5×5，零假设、唯一解，按人类推演指标从易到难排列。
 *
 * 所有题面都必须：
 *   - 唯一解，且预放猫来自答案、互不同行同区；
 *   - 人类求解器不需要假设（第一档入门关禁止靠猜）；
 *   - 布局规范签名不重复，并与现有 300 关、每日挑战去重。
 *
 * 产物：tools/lib/easy-30.json（由 tools/gen-pack.js 装入前 30 个位置）。
 *
 * 用法：
 *   node tools/gen-easy.js           重新枚举并写入
 *   node tools/gen-easy.js --check   只复验现有文件
 */
var fs = require('fs');
var path = require('path');
var gen = require('./lib/generate');
var solver = require('../js/domain/solver');
var diff = require('../js/domain/difficulty');
var hash = require('../js/core/hash');

var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(__dirname, 'lib', 'easy-30.json');
var BASE_FILE = path.join(__dirname, 'lib', 'base-300.json');
var COUNT = 30;
var N4 = 4;
var N5 = 5;
var SOL4 = [2, 0, 3, 1];  // 4×4 只有两种合法解，另一种是它的水平镜像
var GIVEN_COUNTS = [3, 2, 1, 0, 0, 0, 0, 0, 0, 0];
var FOCUS_SLOT = 4;       // 第 4 关高亮突破口

function pad3(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return s;
}

function mirrorLayout(region, solution) {
  var N = N4;
  var out = new Array(N * N);
  var sol = new Array(N);
  for (var r = 0; r < N; r++) {
    sol[r] = N - 1 - solution[r];
    for (var c = 0; c < N; c++) out[r * N + c] = region[r * N + (N - 1 - c)];
  }
  return { region: out, solution: sol };
}

function connectedAll(region, N) {
  for (var g = 0; g < N; g++) {
    var start = -1;
    var total = 0;
    for (var i = 0; i < N * N; i++) {
      if (region[i] === g) {
        if (start < 0) start = i;
        total++;
      }
    }
    if (start < 0) return false;
    var seen = {};
    var stack = [start];
    seen[start] = true;
    var count = 0;
    while (stack.length) {
      var x = stack.pop();
      count++;
      var rr = Math.floor(x / N);
      var cc = x % N;
      var nb = [];
      if (rr > 0) nb.push(x - N);
      if (rr < N - 1) nb.push(x + N);
      if (cc > 0) nb.push(x - 1);
      if (cc < N - 1) nb.push(x + 1);
      for (var k = 0; k < nb.length; k++) {
        var y = nb[k];
        if (region[y] === g && !seen[y]) {
          seen[y] = true;
          stack.push(y);
        }
      }
    }
    if (count !== total) return false;
  }
  return true;
}

function shapeStats(region, N) {
  var counts = new Array(N);
  var i;
  for (i = 0; i < N; i++) counts[i] = 0;
  for (i = 0; i < region.length; i++) counts[region[i]]++;

  var density = 0;
  for (var g = 0; g < N; g++) {
    var minR = N, maxR = -1, minC = N, maxC = -1, total = 0;
    for (i = 0; i < region.length; i++) {
      if (region[i] !== g) continue;
      var r = Math.floor(i / N);
      var c = i % N;
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      total++;
    }
    density += total / ((maxR - minR + 1) * (maxC - minC + 1));
  }

  return {
    spread: Math.max.apply(null, counts) - Math.min.apply(null, counts),
    density: density / N,
    counts: counts
  };
}

/** 穷举 4×4：每行解格固定归属本行区域，其余 12 格分给 4 个区域 */
function enumerate4() {
  var seeds = [];
  for (var r = 0; r < N4; r++) seeds.push(r * N4 + SOL4[r]);

  var cells = [];
  for (var i = 0; i < N4 * N4; i++) {
    if (seeds.indexOf(i) < 0) cells.push(i);
  }

  var region = new Array(N4 * N4);
  for (var g = 0; g < N4; g++) region[seeds[g]] = g;

  var bySig = {};

  function accept() {
    var counts = [0, 0, 0, 0];
    for (var i = 0; i < N4 * N4; i++) counts[region[i]]++;
    for (i = 0; i < N4; i++) {
      if (counts[i] < 2 || counts[i] > 7) return;
    }
    for (var g = 0; g < N4; g++) {
      for (var r = 0; r < N4; r++) {
        var rowCount = 0;
        var colCount = 0;
        for (var c = 0; c < N4; c++) {
          if (region[r * N4 + c] === g) rowCount++;
          if (region[c * N4 + r] === g) colCount++;
        }
        if (rowCount === N4 || colCount === N4) return;
      }
    }
    if (!connectedAll(region, N4)) return;
    if (gen.checkStructure(N4, region)) return;

    var info = solver.solveInfo(N4, region, 2);
    if (info.truncated || info.count !== 1 ||
      !solver.sameSolution(info.first, SOL4)) return;

    var a = diff.analyzeDifficulty(N4, region, []);
    if (!a || !a.guessFree || a.firstMove < 0) return;
    if (a.score !== 28 && a.score !== 32) return;

    var sig = diff.canonicalSignature(N4, region);
    if (bySig[sig]) return;
    bySig[sig] = {
      region: region.slice(),
      solution: info.first.slice(),
      r: gen.encodeRegionString(region, N4),
      s: gen.encodeSolutionString(info.first),
      sig: sig,
      stats: shapeStats(region, N4),
      analysis: a
    };
  }

  (function rec(k) {
    if (k === cells.length) {
      accept();
      return;
    }
    for (var g = 0; g < N4; g++) {
      region[cells[k]] = g;
      rec(k + 1);
    }
  })(0);

  var list = [];
  for (var key in bySig) {
    if (bySig.hasOwnProperty(key)) list.push(bySig[key]);
  }
  list.sort(function (a, b) { return a.r < b.r ? -1 : (a.r > b.r ? 1 : 0); });
  return list;
}

function byShape(a, b) {
  if (a.stats.spread !== b.stats.spread) return a.stats.spread - b.stats.spread;
  if (Math.abs(a.stats.density - b.stats.density) > 0.001) {
    return b.stats.density - a.stats.density;
  }
  return a.r < b.r ? -1 : (a.r > b.r ? 1 : 0);
}

function baseSignatures() {
  var pack = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
  var seen = {};
  for (var i = 0; i < pack.levels.length; i++) {
    var lv = pack.levels[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    seen[diff.canonicalSignature(lv.n, region)] = lv.id;
  }
  return seen;
}

/** 5×5 候选池：零假设、T1、与现有 300 关布局去重 */
function collect5(reserved) {
  var seen = {};
  var out = [];
  for (var i = 0; i < 500 && out.length < 60; i++) {
    var seed = hash.fnv1a('md-easy30:n5:' + i);
    var lv = gen.generateLevel(seed, N5, {
      attempts: 1500,
      mode: 'balanced',
      guessFree: true,
      maxScore: 38
    });
    if (!lv) continue;
    var region = gen.decodeRegionString(lv.regionString, N5);
    var sig = diff.canonicalSignature(N5, region);
    if (reserved[sig] || seen[sig]) continue;
    seen[sig] = true;
    out.push({
      region: region,
      solution: lv.solution,
      r: lv.regionString,
      s: lv.solutionString,
      sig: sig,
      seed: seed,
      analysis: lv.analysis
    });
  }
  return out;
}

function byPoolOrder(a, b) {
  var A = a.analysis;
  var B = b.analysis;
  if (A.score !== B.score) return A.score - B.score;
  if (A.initial.avgCellOptions !== B.initial.avgCellOptions) {
    return A.initial.avgCellOptions - B.initial.avgCellOptions;
  }
  if (A.lockSteps !== B.lockSteps) return A.lockSteps - B.lockSteps;
  return a.r < b.r ? -1 : (a.r > b.r ? 1 : 0);
}

function metricsOf(a) {
  return {
    given: a.givenCount,
    play: a.playable,
    placements: a.placements,
    marks: a.marks,
    lock: a.lockSteps,
    lockMarks: a.lockMarks,
    singles: a.singles,
    branches: a.branchCount,
    hints: a.hintsNeeded,
    first: a.firstMove,
    firstRule: a.firstRule,
    firstLock: a.firstMoveLockSteps
  };
}

function makeLevel(slot, n, r, s, region, solution, givens, analysis) {
  var lv = {
    slot: slot,
    id: 'E' + pad3(slot),
    n: n,
    r: r,
    s: s,
    t: analysis.tier,
    d: analysis.score,
    b: analysis.branchCount,
    seed: hash.fnv1a('md-easy30:v4:' + slot + ':' + r + ':' + s)
  };
  if (givens.length) {
    lv.g = gen.encodeGivenString(n, solution, givens);
  }
  if (slot === FOCUS_SLOT) {
    lv.h = analysis.firstMove;
  }
  lv.m = metricsOf(analysis);
  return lv;
}

function build() {
  var list4 = enumerate4();
  var pool28 = list4.filter(function (x) { return x.analysis.score === 28; });
  var pool32 = list4.filter(function (x) { return x.analysis.score === 32; });
  if (pool28.length < 1) throw new Error('4×4 无预放关候选不足: ' + pool28.length);
  if (pool32.length < 9) throw new Error('4×4 入门关候选不足: ' + pool32.length);

  pool28.sort(byShape);
  pool32.sort(byShape);

  var reserved = baseSignatures();
  var list5 = collect5(reserved);
  var low5 = list5.filter(function (x) { return x.analysis.score <= 35; }).sort(byPoolOrder);
  var high5 = list5.filter(function (x) { return x.analysis.score === 38; }).sort(byPoolOrder);
  if (low5.length < 10) throw new Error('5×5 简单候选不足: ' + low5.length);
  if (high5.length < 10) throw new Error('5×5 进阶候选不足: ' + high5.length);

  var levels = [];
  var sigSeen = {};
  var i;

  function push4(slot, cand, mirrored, givenCount) {
    var region = cand.region.slice();
    var solution = cand.solution.slice();
    if (mirrored) {
      var m = mirrorLayout(region, solution);
      region = m.region;
      solution = m.solution;
    }
    var r = gen.encodeRegionString(region, N4);
    var s = gen.encodeSolutionString(solution);
    var givens = [];
    var analysis;
    if (givenCount > 0) {
      var selected = gen.selectGivens(N4, region, solution, givenCount, {
        guessFree: true,
        maxScore: 39
      });
      if (!selected || !selected.analysis.guessFree || selected.focus < 0) {
        throw new Error('第 ' + slot + ' 关预放猫选择失败');
      }
      givens = selected.givens;
      analysis = selected.analysis;
    } else {
      analysis = diff.analyzeDifficulty(N4, region, []);
      if (!analysis || !analysis.guessFree || analysis.firstMove < 0) {
        throw new Error('第 ' + slot + ' 关无预放题面不合格');
      }
    }
    if (slot === FOCUS_SLOT && analysis.firstMoveLockSteps > 1) {
      throw new Error('第 4 关突破口需要 ' + analysis.firstMoveLockSteps + ' 次锁定，不够直观');
    }
    if (sigSeen[cand.sig]) throw new Error('第 ' + slot + ' 关布局重复');
    sigSeen[cand.sig] = true;
    levels.push(makeLevel(slot, N4, r, s, region, solution, givens, analysis));
  }

  // 第 1–3 关：最规整的 4×4 色区，分别预放 3/2/1 只猫
  push4(1, pool32[0], false, 3);
  push4(2, pool32[1], true, 2);
  push4(3, pool32[2], false, 1);
  // 第 4 关：最容易的空盘 4×4，高亮第一处必然突破
  push4(4, pool28[0], true, 0);
  // 第 5–10 关：独立完成的 4×4 入门题
  for (i = 0; i < 6; i++) {
    push4(5 + i, pool32[3 + i], i % 2 === 1, 0);
  }

  // 第 11–20 关：5×5 低难度段；第 21–30 关：5×5 进阶段
  var picked5 = low5.slice(0, 10).concat(high5.slice(0, 10));
  for (i = 0; i < picked5.length; i++) {
    var c = picked5[i];
    if (sigSeen[c.sig]) throw new Error('第 ' + (11 + i) + ' 关布局重复');
    sigSeen[c.sig] = true;
    levels.push(makeLevel(11 + i, N5, c.r, c.s, c.region, c.solution, [], c.analysis));
    levels[levels.length - 1].seed = c.seed;
  }

  if (levels.length !== COUNT) {
    throw new Error('生成数量 ' + levels.length + '≠' + COUNT);
  }

  var pack = {
    schema: 2,
    generator: 'md-easy/2',
    note: '前 30 关新曲线：4×4 预放教学 + 5×5 零假设入门；由 tools/gen-easy.js 生成，勿手改。',
    total: COUNT,
    levels: levels
  };
  fs.writeFileSync(OUT, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  console.log('4×4 候选 ' + list4.length + ' 个（D28 ' + pool28.length +
    ' / D32 ' + pool32.length + '），5×5 候选 ' + list5.length + ' 个');
  console.log('已写入 ' + path.relative(ROOT, OUT) + '（' + COUNT + ' 关，' +
    Math.round(fs.statSync(OUT).size / 1024) + 'KB）');
  printReport(levels);
}

function tableRow(lv) {
  var m = lv.m;
  return [
    '#' + String(lv.slot),
    lv.n + '×' + lv.n,
    '预放' + m.given,
    'D' + lv.d + '/T' + lv.t,
    '推理' + m.placements,
    '打叉' + m.marks,
    '锁定' + m.lock,
    '假设' + m.branches,
    '首选' + (m.first < 0 ? '-' : m.first) + '/' + (m.firstRule || '-'),
    '提示' + m.hints
  ].join('  ');
}

function printReport(levels) {
  for (var i = 0; i < levels.length; i++) console.log('  ' + tableRow(levels[i]));
}

function check() {
  if (!fs.existsSync(OUT)) {
    console.error('缺少 ' + path.relative(ROOT, OUT) + '，请先运行 node tools/gen-easy.js');
    process.exitCode = 1;
    return;
  }
  var pack = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  var bad = [];
  var seen = {};
  var lastScore = -1;
  if (pack.schema !== 2 || pack.total !== COUNT || !pack.levels ||
    pack.levels.length !== COUNT) {
    bad.push('文件结构非法');
  } else {
    for (var i = 0; i < pack.levels.length; i++) {
      var lv = pack.levels[i];
      var slot = i + 1;
      var givens = [];
      if (lv.slot !== slot || lv.id !== 'E' + pad3(slot)) {
        bad.push('#' + slot + ' 槽位/ID 非法');
        continue;
      }
      if (!(lv.n === 4 || lv.n === 5)) {
        bad.push('#' + slot + ' 尺寸非法');
        continue;
      }
      if ((slot <= 10) !== (lv.n === 4)) {
        bad.push('#' + slot + ' 尺寸与关段不符');
      }
      var v = gen.validateLevel(lv);
      if (!v.ok) {
        bad.push('#' + slot + ':' + v.errors.join('|'));
        continue;
      }
      var region = gen.decodeRegionString(lv.r, lv.n);
      var solution = gen.decodeSolutionString(lv.s);
      if (lv.g) {
        givens = gen.decodeGivenString(lv.g, lv.n, solution);
        if (givens === null) {
          bad.push('#' + slot + ' 预放编码非法');
          continue;
        }
      }
      var expectGiven = slot <= 3 ? GIVEN_COUNTS[slot - 1] : 0;
      if (givens.length !== expectGiven) {
        bad.push('#' + slot + ' 预放数 ' + givens.length + '≠' + expectGiven);
      }
      var a = diff.analyzeDifficulty(lv.n, region, givens);
      if (!a) {
        bad.push('#' + slot + ' 难度分析失败');
        continue;
      }
      if (a.tier !== 1 || a.score !== lv.d || lv.t !== 1) {
        bad.push('#' + slot + ' 档位/分数不一致');
      }
      if (!a.guessFree || a.branchCount !== 0) {
        bad.push('#' + slot + ' 入门关需要假设');
      }
      if (a.firstMove < 0) bad.push('#' + slot + ' 无第一处突破口');
      if (slot <= 10 && lv.d > 39) bad.push('#' + slot + ' 4×4 难度超出入门');
      if (slot >= 11 && (lv.d < 34 || lv.d > 38)) {
        bad.push('#' + slot + ' 5×5 难度不在入门段');
      }
      if (slot === FOCUS_SLOT) {
        if (typeof lv.h !== 'number' || lv.h !== a.firstMove) {
          bad.push('#4 高亮格不是第一处突破口');
        }
        if (a.firstMoveLockSteps > 1) bad.push('#4 突破口不够直观');
      } else if (lv.h !== undefined) {
        bad.push('#' + slot + ' 不应高亮');
      }
      if (lv.d < lastScore) bad.push('#' + slot + ' 难度分倒挂');
      lastScore = lv.d;
      var sig = diff.canonicalSignature(lv.n, region);
      if (seen[sig]) bad.push('#' + slot + ' 布局重复');
      seen[sig] = true;
    }
  }
  if (bad.length) {
    console.error(bad.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('前 30 关校验通过：4×4 预放 3/2/1、第 4 关高亮、' +
    '全部零假设入门、唯一解、难度不倒挂');
  printReport(pack.levels);
}

if (process.argv.indexOf('--check') >= 0) check();
else build();
