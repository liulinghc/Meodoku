#!/usr/bin/env node
/**
 * 每日挑战日历池（S6：全量人类难度重评）。
 *
 * 产物：
 *   levels/daily-365.json  源数据（不打包）
 *   levels/daily-365.js    小游戏 CommonJS 包（打包）
 *
 * 池子保留 312 道工作日题 + 53 道周日题，题目内容不变；
 * 每道题用与正式关卡相同的人类技巧求解器重算 t/d/b，
 * 保证每日挑战显示的档位与真实推演难度一致。
 *
 * 每道题都必须唯一解，且与正式 300 关、池内其他题布局签名去重。
 *
 * 用法：
 *   node tools/gen-daily.js           重评并写入
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

function loadMainSignatures() {
  if (!fs.existsSync(MAIN_PACK)) {
    throw new Error('缺少 levels/pack-001.json，无法与正式包去重');
  }
  var pack = JSON.parse(fs.readFileSync(MAIN_PACK, 'utf8'));
  var seen = {};
  for (var i = 0; i < pack.levels.length; i++) {
    var lv = pack.levels[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    seen[diff.canonicalSignature(lv.n, region)] = lv.id;
  }
  return seen;
}

function retier(list) {
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var lv = list[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    var a = diff.analyzeDifficulty(lv.n, region, []);
    if (!a) throw new Error(lv.id + ':难度分析失败');
    out.push({
      id: lv.id,
      n: lv.n,
      r: lv.r,
      s: lv.s,
      t: a.tier,
      d: a.score,
      b: a.branchCount,
      seed: lv.seed
    });
  }
  return out;
}

function build() {
  if (!fs.existsSync(JSON_OUT)) {
    throw new Error('缺少 levels/daily-365.json 源数据，无法重评');
  }
  var old = JSON.parse(fs.readFileSync(JSON_OUT, 'utf8'));
  if (!old.t3 || old.t3.length !== T3_TOTAL ||
    !old.t4 || old.t4.length !== T4_TOTAL) {
    throw new Error('每日池数量非法');
  }
  var t0 = Date.now();
  var t3 = retier(old.t3);
  var t4 = retier(old.t4);

  var data = {
    schema: 2,
    version: 2,
    generator: 'md-daily/' + gen.GENERATOR_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { t3: t3.length, t4: t4.length },
    t3: t3,
    t4: t4
  };
  fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(JS_OUT,
    '/**\n * 每日挑战日历池 —— 365 道（312 工作日 + 53 周日）。\n' +
    ' * 由 tools/gen-daily.js 自动生成，请勿手改。\n' +
    ' * t/d/b 为人类技巧求解器结果；源数据见 levels/daily-365.json。\n */\n' +
    'module.exports = ' + JSON.stringify(data) + ';\n', 'utf8');
  console.log('重评 365 道，用时 ' + (Date.now() - t0) + 'ms');
  return data;
}

function verify(data, opts) {
  opts = opts || {};
  var bad = [];
  var seen = opts.againstMain ? loadMainSignatures() : {};
  var pools = [['t3', T3_TOTAL], ['t4', T4_TOTAL]];
  var total = 0;
  var byTier = {};
  for (var p = 0; p < pools.length; p++) {
    var key = pools[p][0];
    var expect = pools[p][1];
    var list = data[key] || [];
    if (list.length !== expect) {
      bad.push(key + ' 数量 ' + list.length + '≠' + expect);
    }
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      total++;
      var region = gen.decodeRegionString(lv.r, lv.n);
      var v = gen.validateLevel(lv);
      if (!v.ok) {
        bad.push(lv.id + ':' + v.errors.join('|'));
        continue;
      }
      var info = gen.solveInfo(lv.n, region, 2);
      if (info.count !== 1 ||
        !gen.sameSolution(info.first, gen.decodeSolutionString(lv.s))) {
        bad.push(lv.id + ':非唯一解/答案不符');
        continue;
      }
      var a = diff.analyzeDifficulty(lv.n, region, []);
      if (!a) {
        bad.push(lv.id + ':难度分析失败');
        continue;
      }
      if (a.tier !== lv.t || a.score !== lv.d || a.branchCount !== lv.b) {
        bad.push(lv.id + ':档位/分数/假设数与求解结果不一致');
        continue;
      }
      var sig = diff.canonicalSignature(lv.n, region);
      if (seen[sig]) bad.push(lv.id + ':布局重复 ' + seen[sig]);
      seen[sig] = lv.id;
      byTier[lv.t] = (byTier[lv.t] || 0) + 1;
    }
  }
  if (total !== 365) bad.push('总数量=' + total);
  console.log('每日池档位分布 ' + JSON.stringify(byTier));
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
  console.log('复验通过：365/365 唯一解，布局与正式包无重复；' +
    '复验 ' + (Date.now() - t0) + 'ms；JSON ' + Math.round(jsonSize / 1024) +
    'KB，JS ' + Math.round(jsSize / 1024) + 'KB');
}

main();
