#!/usr/bin/env node
/**
 * 批量生成/验证测试（S3 验收）。
 *
 * 默认生成并验证 1000 关（按 200 关正式配额的 5 倍分布）：
 *   - 每关走正式生成管线（造解/生长/结构/唯一解/修补/难度定档）
 *   - 独立复验：唯一解、规则合法、结构、连通、档位一致
 *   - 统计生成耗时、尺寸/档位分布、多解候选拒收数
 *
 * 用法：
 *   node tools/batch-test.js [数量]
 *   node tools/batch-test.js 1200
 *
 * 这是离线构建工具，不参与小游戏打包。
 */
var hash = require('../js/core/hash');
var gen = require('./lib/generate');
var diff = require('../js/domain/difficulty');
var rules = require('../js/domain/rules');

var DEFAULT_TOTAL = 1000;
var BUDGET = { 4: 3000, 5: 6000, 6: 12000, 7: 18000, 8: 30000, 9: 30000 };
var FALLBACK_N = { 1: 5, 2: 6, 3: 7, 4: 7, 5: 8 };
var MAX_SEED_TRIES = 6;

// 1000 关时的尺寸计划；总数变化时按比例缩放
var BASE_PLAN = [
  { tier: 1, n: 4, weight: 30 },
  { tier: 1, n: 5, weight: 70 },
  { tier: 2, n: 5, weight: 125 },
  { tier: 2, n: 6, weight: 125 },
  { tier: 3, n: 6, weight: 175 },
  { tier: 3, n: 7, weight: 175 },
  { tier: 4, n: 7, weight: 190 },
  { tier: 4, n: 8, weight: 30 },
  { tier: 5, n: 8, weight: 40 },
  { tier: 5, n: 9, weight: 40 }
];

function scalePlan(total) {
  var sum = 0;
  var i;
  for (i = 0; i < BASE_PLAN.length; i++) sum += BASE_PLAN[i].weight;
  var plan = [];
  var assigned = 0;
  for (i = 0; i < BASE_PLAN.length; i++) {
    var p = BASE_PLAN[i];
    var count = i === BASE_PLAN.length - 1 ? total - assigned :
      Math.round(total * p.weight / sum);
    if (count > 0) plan.push({ tier: p.tier, n: p.n, count: count });
    assigned += count;
  }
  return plan;
}

function seedOf(tier, n, slot, attempt) {
  return hash.fnv1a('md-batch:' + gen.GENERATOR_VERSION + ':' + tier + ':' +
    n + ':' + slot + ':' + attempt);
}

function makeOne(tier, n, slot) {
  for (var k = 0; k < MAX_SEED_TRIES; k++) {
    var seed = seedOf(tier, n, slot, k);
    var lv = gen.generateLevel(seed, n, {
      attempts: BUDGET[n],
      mode: n === 7 ? 'random' : 'balanced',
      tier: tier
    });
    if (lv) return lv;
  }
  if (FALLBACK_N[tier] !== n) {
    return makeOne(tier, FALLBACK_N[tier], slot + ':fb');
  }
  return null;
}

function main() {
  var total = parseInt(process.argv[2] || String(DEFAULT_TOTAL), 10);
  if (!(total >= 1000)) {
    console.error('批量测试至少 1000 关');
    process.exitCode = 1;
    return;
  }

  var plan = scalePlan(total);
  var stats = {
    requested: 0,
    generated: 0,
    failed: 0,
    fallback: 0,
    unsolvable: 0,
    multiAccepted: 0,
    unique: 0,
    invalid: 0,
    tierMismatch: 0,
    runtimeRuleFail: 0,
    candidateAttempts: 0,
    multiRejected: 0,
    structureRejected: 0,
    solveLimit: 0,
    byTier: {},
    bySize: {},
    scores: [],
    totalMs: 0
  };

  var tAll = Date.now();
  var slot = 0;
  for (var p = 0; p < plan.length; p++) {
    var item = plan[p];
    for (var j = 0; j < item.count; j++) {
      stats.requested++;
      var t0 = Date.now();
      var lv = makeOne(item.tier, item.n, slot++);
      stats.totalMs += Date.now() - t0;
      if (!lv) {
        stats.failed++;
        continue;
      }
      if (lv.n !== item.n) stats.fallback++;
      stats.generated++;
      stats.candidateAttempts += lv.stats.attempts;
      stats.multiRejected += lv.stats.nonUnique || 0;
      stats.structureRejected += lv.stats.structure || 0;
      stats.solveLimit += lv.stats.solveLimit || 0;

      var region = gen.decodeRegionString(lv.regionString, lv.n);
      var info = gen.solveInfo(lv.n, region, 3);
      if (info.truncated) {
        stats.solveLimit++;
      } else if (info.count === 0) {
        stats.unsolvable++;
      } else if (info.count > 1) {
        stats.multiAccepted++;
      } else {
        stats.unique++;
      }

      var v = gen.validateLevel(lv);
      if (!v.ok) {
        stats.invalid++;
        console.error('  ✗ ' + 'T' + item.tier + ' n=' + lv.n + ' seed=' + lv.seed +
          ' ' + v.errors.join('|'));
      }

      var analysis = diff.analyzeDifficulty(lv.n, region);
      if (!analysis || analysis.tier !== item.tier) stats.tierMismatch++;

      var cats = [];
      for (var r = 0; r < lv.n; r++) cats.push(r * lv.n + lv.solution[r]);
      if (!rules.analyze(cats, lv.n, region).solved) stats.runtimeRuleFail++;

      if (!stats.byTier[item.tier]) stats.byTier[item.tier] = 0;
      stats.byTier[item.tier]++;
      if (!stats.bySize[lv.n]) stats.bySize[lv.n] = 0;
      stats.bySize[lv.n]++;
      stats.scores.push(lv.difficulty);
    }
    console.log('  完成 T' + item.tier + ' ' + item.n + '×' + item.n +
      '：' + item.count + ' 关');
  }

  var elapsed = Date.now() - tAll;
  var scoreAvg = stats.scores.length ?
    stats.scores.reduce(function (a, b) { return a + b; }, 0) / stats.scores.length : 0;
  var scoreMin = stats.scores.length ? Math.min.apply(null, stats.scores) : 0;
  var scoreMax = stats.scores.length ? Math.max.apply(null, stats.scores) : 0;

  console.log('');
  console.log('===== 批量生成/验证报告 =====');
  console.log('计划生成         ' + stats.requested);
  console.log('成功生成         ' + stats.generated);
  console.log('生成失败         ' + stats.failed);
  console.log('无解关卡         ' + stats.unsolvable);
  console.log('多解关卡（入池） ' + stats.multiAccepted);
  console.log('唯一解关卡       ' + stats.unique);
  console.log('校验不合格       ' + stats.invalid);
  console.log('档位不一致       ' + stats.tierMismatch);
  console.log('运行时规则失败   ' + stats.runtimeRuleFail);
  console.log('候选总尝试       ' + stats.candidateAttempts);
  console.log('多解候选（拒收） ' + stats.multiRejected);
  console.log('结构候选（拒收） ' + stats.structureRejected);
  console.log('求解超限（拒收） ' + stats.solveLimit);
  console.log('尺寸回退         ' + stats.fallback);
  console.log('总耗时           ' + elapsed + 'ms');
  console.log('平均生成耗时     ' + (stats.generated ? (stats.totalMs / stats.generated).toFixed(1) : '-') + 'ms/关');
  console.log('难度分布         ' + JSON.stringify(stats.byTier));
  console.log('尺寸分布         ' + JSON.stringify(stats.bySize));
  console.log('难度分           ' + scoreMin + ' ~ ' + scoreMax +
    '（平均 ' + scoreAvg.toFixed(1) + '）');

  var ok = stats.generated === total && stats.failed === 0 &&
    stats.unsolvable === 0 && stats.multiAccepted === 0 &&
    stats.invalid === 0 && stats.tierMismatch === 0 &&
    stats.runtimeRuleFail === 0 && stats.unique === total;
  if (!ok) {
    console.error('批量测试未通过');
    process.exitCode = 1;
  } else {
    console.log('批量测试通过：' + total + ' 关全部唯一解、合法、档位一致');
  }
}

main();
