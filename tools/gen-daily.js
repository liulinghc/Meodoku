#!/usr/bin/env node
/**
 * 每日挑战日历池生成器（S5）。
 *
 * 产物：
 *   levels/daily-365.json  源数据（不打包）
 *   levels/daily-365.js    小游戏 CommonJS 包（打包）
 *
 * 池子 = 312 道 T3 + 53 道 T4，共 365 道。
 * 每日服务按“当天是周日 → T4，否则 T3”取池内序号：
 *   同一个本地日期，在所有设备上得到同一道题；池子跨年复用。
 * 每道题都与正式 300 关布局签名去重，且池内无重复。
 *
 * 用法：
 *   node tools/gen-daily.js           生成并复验
 *   node tools/gen-daily.js --check   只复验现有产物
 */
var fs = require('fs');
var path = require('path');
var gen = require('./lib/generate');
var diff = require('../js/domain/difficulty');

var ROOT = path.resolve(__dirname, '..');
var JSON_OUT = path.join(ROOT, 'levels', 'daily-365.json');
var JS_OUT = path.join(ROOT, 'levels', 'daily-365.js');
var MAIN_PACK = path.join(ROOT, 'levels', 'pack-001.json');

var T3_TOTAL = 312;
var T4_TOTAL = 53;
var T3_PLAN = [
  { n: 6, count: 180 },
  { n: 7, count: 132 }
];
var T4_PLAN = [
  { n: 7, count: 37 },
  { n: 8, count: 16 }
];
var BUDGET = { 6: 15000, 7: 24000, 8: 36000 };
var MAX_TRIES = 16;

function seedOf(tier, n, slot, attempt) {
  return require('../js/core/hash').fnv1a('md-daily:v1:t' + tier + ':n' + n + ':slot' + slot + ':try' + attempt);
}

function loadMainSignatures() {
  if (!fs.existsSync(MAIN_PACK)) return {};
  var pack = JSON.parse(fs.readFileSync(MAIN_PACK, 'utf8'));
  var seen = {};
  for (var i = 0; i < pack.levels.length; i++) {
    var lv = pack.levels[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    seen[diff.canonicalSignature(lv.n, region)] = lv.id;
  }
  return seen;
}

function compact(lv, id) {
  return {
    id: id,
    n: lv.n,
    r: lv.regionString,
    s: lv.solutionString,
    t: lv.tier,
    d: lv.difficulty,
    b: lv.branch,
    seed: lv.seed
  };
}

function makePool(tier, total, plan, seen) {
  var out = [];
  var slot = 0;
  for (var p = 0; p < plan.length; p++) {
    var part = plan[p];
    for (var j = 0; j < part.count; j++) {
      var made = null;
      for (var k = 0; k < MAX_TRIES; k++) {
        var seed = seedOf(tier, part.n, p + ':' + j, k);
        var lv = gen.generateLevel(seed, part.n, {
          attempts: BUDGET[part.n],
          mode: part.n >= 7 ? 'random' : 'balanced',
          tier: tier
        });
        if (!lv) continue;
        var region = gen.decodeRegionString(lv.regionString, part.n);
        var sig = diff.canonicalSignature(part.n, region);
        if (seen[sig]) continue;
        seen[sig] = true;
        made = lv;
        break;
      }
      if (!made) throw new Error('每日挑战生成失败 T' + tier + ' n=' + part.n + ' slot=' + slot);
      var id = 'D' + tier + '-' + (slot + 1 < 10 ? '00' : (slot + 1 < 100 ? '0' : '')) + (slot + 1);
      out.push(compact(made, id));
      slot++;
      if (slot % 25 === 0 || slot === total) {
        console.log('  T' + tier + ' 进度 ' + slot + '/' + total);
      }
    }
  }
  if (out.length !== total) throw new Error('T' + tier + ' 数量错误: ' + out.length);
  return out;
}

function build() {
  var t0 = Date.now();
  var seen = loadMainSignatures();
  console.log('生成每日挑战池（与正式包去重）…');
  var t3 = makePool(3, T3_TOTAL, T3_PLAN, seen);
  var t4 = makePool(4, T4_TOTAL, T4_PLAN, seen);

  var data = {
    schema: 1,
    version: 1,
    generator: gen.GENERATOR_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { t3: t3.length, t4: t4.length },
    t3: t3,
    t4: t4
  };
  fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(JS_OUT,
    '/**\n * 每日挑战日历池 —— 365 道（312 T3 + 53 T4）。\n' +
    ' * 由 tools/gen-daily.js 自动生成，请勿手改。\n' +
    ' * 源数据见 levels/daily-365.json；游戏只加载本 JS。\n */\n' +
    'module.exports = ' + JSON.stringify(data) + ';\n', 'utf8');
  console.log('写入 ' + t3.length + ' + ' + t4.length + ' 道，用时 ' + (Date.now() - t0) + 'ms');
  return data;
}

function verify(data, opts) {
  opts = opts || {};
  var bad = [];
  var seen = opts.againstMain ? loadMainSignatures() : {};
  var pools = [['t3', 3], ['t4', 4]];
  var total = 0;
  for (var p = 0; p < pools.length; p++) {
    var key = pools[p][0];
    var tier = pools[p][1];
    var list = data[key] || [];
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      total++;
      var region = gen.decodeRegionString(lv.r, lv.n);
      var v = gen.validateLevel(lv);
      if (!v.ok) { bad.push(lv.id + ':' + v.errors.join('|')); continue; }
      if (!gen.regionsConnected(lv.n, region)) { bad.push(lv.id + ':区域断开'); continue; }
      var info = gen.solveInfo(lv.n, region, 2);
      if (info.count !== 1 || !gen.sameSolution(info.first, gen.decodeSolutionString(lv.s, lv.n))) {
        bad.push(lv.id + ':非唯一解/答案不符');
        continue;
      }
      var a = diff.analyzeDifficulty(lv.n, region);
      if (!a || a.tier !== tier || a.tier !== lv.t) {
        bad.push(lv.id + ':档位不符');
        continue;
      }
      var sig = diff.canonicalSignature(lv.n, region);
      if (seen[sig]) bad.push(lv.id + ':布局重复 ' + seen[sig]);
      seen[sig] = lv.id;
    }
  }
  if (total !== 365) bad.push('总数量=' + total);
  if ((data.t3 || []).length !== T3_TOTAL || (data.t4 || []).length !== T4_TOTAL) {
    bad.push('池数量=' + (data.t3 || []).length + '/' + (data.t4 || []).length);
  }
  return bad;
}

function main() {
  var check = process.argv.indexOf('--check') >= 0;
  var data;
  if (check) {
    if (!fs.existsSync(JSON_OUT)) throw new Error('缺少 levels/daily-365.json');
    data = JSON.parse(fs.readFileSync(JSON_OUT, 'utf8'));
  } else {
    data = build();
  }
  var t0 = Date.now();
  var bad = verify(data, { againstMain: true });
  if (bad.length) {
    console.error('每日挑战池复验失败：\n  ' + bad.slice(0, 20).join('\n  '));
    process.exit(1);
  }
  var jsSize = fs.statSync(JS_OUT).size;
  var jsonSize = fs.statSync(JSON_OUT).size;
  console.log('复验通过：365/365 唯一解，T3 312 + T4 53，布局与正式包无重复；' +
    '复验 ' + (Date.now() - t0) + 'ms；JSON ' + Math.round(jsonSize / 1024) + 'KB，JS ' +
    Math.round(jsSize / 1024) + 'KB');
}

main();
