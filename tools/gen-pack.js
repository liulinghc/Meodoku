#!/usr/bin/env node
/**
 * 正式关卡包生成器（S4：扩产到 300 关）。
 *
 * 产物：
 *   levels/pack-001.json  源数据（可读 JSON，不打包）
 *   levels/pack-001.js    小游戏加载的 CommonJS 包装（紧凑 JSON，打包）
 *
 * 已有 S3 的 200 关作为基线（tools/lib/base-200.json），保留其 ID 与盘面，
 * 新增 100 关后按（档位，尺寸，难度分，seed）重新排序成 15 章。
 * 前 10 关使用 tools/lib/easy-10.json 的 4×4 零分支教学池，ID 与播放位置
 * 保持不变（L001 仍在第 1 关），旧存档的下标不会错位；其余旧关内容不变。
 *
 * 300 槽位按档位配额先验固定；每关必须唯一解、结构合格、档位匹配、
 * 布局规范签名不重复，全部通过才写入。生成失败直接报错，不静默降级。
 *
 * 用法：
 *   node tools/gen-pack.js           重新生成 300 关并复验
 *   node tools/gen-pack.js --check   只复验现有 JSON/JS
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gen = require('./lib/generate');
var hash = require('../js/core/hash');
var diff = require('../js/domain/difficulty');

var ROOT = path.resolve(__dirname, '..');
var JSON_OUT = path.join(ROOT, 'levels', 'pack-001.json');
var JS_OUT = path.join(ROOT, 'levels', 'pack-001.js');
var BASE_FILE = path.join(__dirname, 'lib', 'base-200.json');
var EASY_FILE = path.join(__dirname, 'lib', 'easy-10.json');

var TIER_NAMES = diff.TIER_NAMES;
var TOTAL = 300;
var BASE_TOTAL = 200;
var QUOTAS = { 1: 30, 2: 75, 3: 105, 4: 60, 5: 30 };

// 当前前 10 个播放位置的稳定 ID，按原顺序保留；只替换题面，不挪位置
var EASY_SLOTS = ['L001', 'L202', 'L002', 'L003', 'L004',
  'L005', 'L203', 'L006', 'L201', 'L206'];
var EASY_SET = {};
for (var e = 0; e < EASY_SLOTS.length; e++) EASY_SET[EASY_SLOTS[e]] = true;

// 在 S3 的 200 关基础上新增 100 关；与旧配额合并后为 30/75/105/60/30
var EXT_PLAN = [
  { tier: 1, n: 4, count: 3 },
  { tier: 1, n: 5, count: 7 },
  { tier: 2, n: 5, count: 12 },
  { tier: 2, n: 6, count: 13 },
  { tier: 3, n: 6, count: 17 },
  { tier: 3, n: 7, count: 18 },
  { tier: 4, n: 7, count: 13 },
  { tier: 4, n: 8, count: 3 },
  { tier: 5, n: 8, count: 7 },
  { tier: 5, n: 9, count: 7 }
];

var BUDGET = { 4: 3000, 5: 6000, 6: 12000, 7: 18000, 8: 30000, 9: 30000 };
var MAX_SEED_TRIES = 12;
var FALLBACK_N = { 1: 5, 2: 6, 3: 7, 4: 7, 5: 8 };

function pad3(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return s;
}

function loadBase() {
  if (!fs.existsSync(BASE_FILE)) {
    throw new Error('缺少基线关卡 tools/lib/base-200.json');
  }
  var pack = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
  if (!pack.levels || pack.levels.length !== BASE_TOTAL) {
    throw new Error('基线关卡数非法: ' + (pack.levels ? pack.levels.length : 0));
  }
  return pack.levels;
}

function compact(lv) {
  return {
    id: lv.id,
    n: lv.n,
    r: lv.r || lv.regionString,
    s: lv.s || lv.solutionString,
    t: lv.t !== undefined ? lv.t : lv.tier,
    d: lv.d !== undefined ? lv.d : lv.difficulty,
    b: lv.b !== undefined ? lv.b : lv.branch,
    seed: lv.seed
  };
}

/** 前 10 关教学池：4×4、T1、零分支；由 tools/gen-easy.js 生成 */
function loadEasy() {
  if (!fs.existsSync(EASY_FILE)) {
    throw new Error('缺少教学关卡 tools/lib/easy-10.json，请先运行 node tools/gen-easy.js');
  }
  var pack = JSON.parse(fs.readFileSync(EASY_FILE, 'utf8'));
  if (pack.schema !== 1 || !pack.levels || pack.levels.length !== EASY_SLOTS.length) {
    throw new Error('教学关卡池数量/结构非法');
  }

  var out = [];
  var seen = {};
  for (var i = 0; i < pack.levels.length; i++) {
    var lv = compact(pack.levels[i]);
    if (lv.n !== 4 || lv.t !== 1 || lv.d !== 0) {
      throw new Error('教学关卡 #' + (i + 1) + ' 必须是 4×4 / T1 / D0');
    }
    var v = gen.validateLevel(lv);
    if (!v.ok) {
      throw new Error('教学关卡 #' + (i + 1) + ' 非法: ' + v.errors.join('|'));
    }
    var region = gen.decodeRegionString(lv.r, 4);
    var a = diff.analyzeDifficulty(4, region);
    if (!a || a.tier !== 1 || a.score !== 0 || a.branchCount !== 0) {
      throw new Error('教学关卡 #' + (i + 1) + ' 不是零分支难度');
    }
    var sig = diff.canonicalSignature(4, region);
    if (seen[sig]) throw new Error('教学关卡 #' + (i + 1) + ' 布局重复');
    seen[sig] = true;
    out.push(lv);
  }
  return out;
}

function compareLevels(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  if (a.n !== b.n) return a.n - b.n;
  if (a.d !== b.d) return a.d - b.d;
  return a.seed - b.seed;
}

function seedOf(prefix, tier, n, slot, attempt) {
  return hash.fnv1a(prefix + ':' + tier + ':n' + n + ':slot' + slot + ':try' + attempt);
}

function makeOne(prefix, tier, n, slot, seen) {
  for (var k = 0; k < MAX_SEED_TRIES; k++) {
    var seed = seedOf(prefix, tier, n, slot, k);
    var lv = gen.generateLevel(seed, n, {
      attempts: BUDGET[n],
      mode: n === 7 ? 'random' : 'balanced',
      tier: tier
    });
    if (!lv) continue;
    var region = gen.decodeRegionString(lv.regionString, n);
    var sig = diff.canonicalSignature(n, region);
    if (seen[sig]) continue;
    seen[sig] = true;
    return lv;
  }
  return null;
}

function signatureSeen(levels) {
  var seen = {};
  for (var i = 0; i < levels.length; i++) {
    var lv = levels[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    seen[diff.canonicalSignature(lv.n, region)] = lv.id;
  }
  return seen;
}

function build() {
  var base = loadBase();
  var levels = [];
  var i;

  for (i = 0; i < base.length; i++) levels.push(compact(base[i]));

  // 旧关卡签名先进 seen，新增关卡不会与之重复
  var seen = signatureSeen(levels);
  var nextId = BASE_TOTAL + 1;
  var fallback = 0;
  var t0 = Date.now();
  var added = 0;

  for (var p = 0; p < EXT_PLAN.length; p++) {
    var plan = EXT_PLAN[p];
    var made = 0;
    for (var j = 0; j < plan.count; j++) {
      var prefix = 'md-extend:' + gen.GENERATOR_VERSION;
      var lv = makeOne(prefix, plan.tier, plan.n, p + ':' + j, seen);
      if (!lv && plan.n !== FALLBACK_N[plan.tier]) {
        // 极端情况下退到同档的备用尺寸（仍在档位范围），并记录，不降档
        fallback++;
        var fb = FALLBACK_N[plan.tier];
        console.warn('  ! T' + plan.tier + ' ' + plan.n + '×' + plan.n +
          ' 槽位 ' + j + ' 重试耗尽，回退同档 ' + fb + '×' + fb);
        lv = makeOne(prefix, plan.tier, fb, 'fb:' + p + ':' + j, seen);
      }
      if (!lv) {
        throw new Error('生成失败 T' + plan.tier + ' n=' + plan.n + ' slot=' + j);
      }
      var item = compact(lv);
      item.id = 'L' + pad3(nextId++);
      levels.push(item);
      made++;
      added++;
    }
    console.log('  新增 T' + plan.tier + ' ' + plan.n + '×' + plan.n +
      ' 完成 ' + made + ' 关');
  }

  // 前 10 关换为零分支 4×4 教学池：ID 与播放位置固定，存档下标不错位
  var easy = loadEasy();
  var byId = {};
  for (i = 0; i < levels.length; i++) byId[levels[i].id] = levels[i];

  var early = [];
  for (i = 0; i < EASY_SLOTS.length; i++) {
    if (!byId[EASY_SLOTS[i]]) {
      throw new Error('缺少教学槽位 ' + EASY_SLOTS[i]);
    }
    var easyLv = easy[i];
    easyLv.id = EASY_SLOTS[i];
    early.push(easyLv);
  }

  var rest = [];
  for (i = 0; i < levels.length; i++) {
    if (!EASY_SET[levels[i].id]) rest.push(levels[i]);
  }
  // 其余关卡仍按档位、尺寸、难度升序排列
  rest.sort(compareLevels);
  levels = early.concat(rest);

  var sizeCount = {};
  for (i = 0; i < levels.length; i++) {
    sizeCount[levels[i].n] = (sizeCount[levels[i].n] || 0) + 1;
  }

  console.log('生成 ' + added + ' 关，合计 ' + levels.length + ' 关，用时 ' +
    (Date.now() - t0) + 'ms' + (fallback ? '，回退 ' + fallback + ' 次' : ''));
  console.log('尺寸分布 ' + JSON.stringify(sizeCount));
  return levels;
}

function verifyBase(levels, base) {
  var bad = [];
  var byId = {};
  for (var i = 0; i < levels.length; i++) byId[levels[i].id] = levels[i];

  for (var j = 0; j < base.length; j++) {
    var old = compact(base[j]);
    var cur = byId[old.id];
    if (!cur) {
      bad.push('旧关卡丢失 ' + old.id);
      continue;
    }
    if (EASY_SET[old.id]) {
      // 前 10 关教学池会随难度曲线调整题面；ID 与位置必须保持
      if (cur.n !== 4 || cur.t !== 1 || cur.d !== 0) {
        bad.push('教学关属性异常 ' + old.id);
      }
      continue;
    }
    if (cur.n !== old.n || cur.r !== old.r || cur.s !== old.s ||
      cur.t !== old.t || cur.d !== old.d) {
      bad.push('旧关卡内容变化 ' + old.id);
    }
  }
  return bad;
}

/** 前 10 关必须仍是原来的 ID/顺序，避免旧存档的播放下标错位 */
function verifyEarly(levels) {
  var bad = [];
  for (var i = 0; i < EASY_SLOTS.length; i++) {
    var lv = levels[i];
    if (!lv || lv.id !== EASY_SLOTS[i]) {
      bad.push('前 10 关 ID/顺序变化: ' + (lv ? lv.id : '缺失') + ' ≠ ' + EASY_SLOTS[i]);
      continue;
    }
    if (lv.n !== 4 || lv.t !== 1 || lv.d !== 0 || lv.b !== 0) {
      bad.push('教学关属性异常: ' + lv.id);
    }
  }
  return bad;
}

function verifyLevels(levels, opts) {
  opts = opts || {};
  var bad = [];
  var byTier = {};
  var bySize = {};
  var seen = {};
  var duplicates = 0;
  var t0 = Date.now();

  if (levels.length !== TOTAL) bad.push('关卡数=' + levels.length);
  for (var i = 0; i < levels.length; i++) {
    var lv = levels[i];
    var region = gen.decodeRegionString(lv.r, lv.n);
    var v = gen.validateLevel(lv);
    if (!v.ok) {
      bad.push(lv.id + ':' + v.errors.join('|'));
      continue;
    }
    var analysis = diff.analyzeDifficulty(lv.n, region);
    if (!analysis) {
      bad.push(lv.id + ':难度求解失败');
      continue;
    }
    if (analysis.tier !== lv.t) bad.push(lv.id + ':档位 ' + lv.t + '≠' + analysis.tier);
    if (analysis.score !== lv.d) bad.push(lv.id + ':难度分不一致');
    var sig = diff.canonicalSignature(lv.n, region);
    if (seen[sig]) {
      duplicates++;
      bad.push(lv.id + ':重复布局 ' + sig);
    }
    seen[sig] = lv.id;
    byTier[lv.t] = (byTier[lv.t] || 0) + 1;
    bySize[lv.n] = (bySize[lv.n] || 0) + 1;
  }
  for (var t = 1; t <= 5; t++) {
    if ((byTier[t] || 0) !== QUOTAS[t]) {
      bad.push('T' + t + ' 数量 ' + (byTier[t] || 0) + '≠' + QUOTAS[t]);
    }
  }
  if (opts.base) {
    var baseBad = verifyBase(levels, opts.base);
    for (var b = 0; b < baseBad.length; b++) bad.push(baseBad[b]);
  }
  var earlyBad = verifyEarly(levels);
  for (var eb = 0; eb < earlyBad.length; eb++) bad.push(earlyBad[eb]);
  var ms = Date.now() - t0;
  console.log('复验 ' + levels.length + ' 关：' + (bad.length ? '失败' : '通过') +
    '（' + ms + 'ms）');
  console.log('档位分布 ' + JSON.stringify(byTier));
  console.log('尺寸分布 ' + JSON.stringify(bySize));
  if (duplicates) console.log('重复布局 ' + duplicates + ' 个');
  if (bad.length) {
    console.error(bad.slice(0, 12).join('\n'));
    if (bad.length > 12) console.error('... 共 ' + bad.length + ' 条');
    process.exitCode = 1;
    return false;
  }
  if (opts.sizeOf) opts.sizeOf();
  return true;
}

function packObject(levels) {
  return {
    schema: 3,
    pack: 1,
    version: 3,
    generator: 'md-levelgen/' + gen.GENERATOR_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    total: levels.length,
    tierNames: TIER_NAMES,
    levels: levels
  };
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function write(levels) {
  var pack = packObject(levels);
  var compactJson = JSON.stringify(pack);
  var levelBytes = Buffer.byteLength(JSON.stringify(pack.levels), 'utf8');
  var js = [
    '/**',
    ' * 关卡包 001 —— 正式 300 关（4×4–9×9，T1–T5，15 章）。',
    ' * 由 tools/gen-pack.js 自动生成，请勿手改。',
    ' * r：n² 个区域字母；s：每行猫所在列；t：档位；d：难度分。',
    ' * 源数据见 levels/pack-001.json；游戏只加载本 JS。',
    ' */',
    'module.exports = ' + compactJson + ';',
    ''
  ].join('\n');

  fs.writeFileSync(JSON_OUT, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  fs.writeFileSync(JS_OUT, js, 'utf8');
  console.log('已写入 ' + path.relative(ROOT, JSON_OUT) + '（' +
    Math.round(fs.statSync(JSON_OUT).size / 1024) + 'KB，不打包）');
  console.log('已写入 ' + path.relative(ROOT, JS_OUT) + '（' +
    Math.round(js.length / 1024) + 'KB，关卡数据 ' +
    Math.round(levelBytes / 1024) + 'KB）');
  console.log('关卡数据哈希 ' + sha(JSON.stringify(pack.levels)).slice(0, 16));
  if (levelBytes >= 40 * 1024) {
    console.error('关卡数据超过 40KB 目标');
    process.exitCode = 1;
  }
}

function check() {
  if (!fs.existsSync(JSON_OUT) || !fs.existsSync(JS_OUT)) {
    console.error('缺少关卡包，请先运行 node tools/gen-pack.js');
    process.exitCode = 1;
    return;
  }
  var jsonPack = JSON.parse(fs.readFileSync(JSON_OUT, 'utf8'));
  var jsPack = require(JS_OUT);
  if (JSON.stringify(jsonPack) !== JSON.stringify(jsPack)) {
    console.error('pack-001.json 与 pack-001.js 数据不一致');
    process.exitCode = 1;
    return;
  }
  if (jsonPack.total !== TOTAL || jsonPack.schema !== 3) {
    console.error('关卡包版本/数量非法: schema=' + jsonPack.schema +
      ' total=' + jsonPack.total);
    process.exitCode = 1;
    return;
  }
  var ok = verifyLevels(jsonPack.levels, {
    base: loadBase(),
    sizeOf: function () {
      var bytes = Buffer.byteLength(JSON.stringify(jsonPack.levels), 'utf8');
      console.log('关卡数据 ' + Math.round(bytes / 1024) + 'KB');
    }
  });
  if (ok) {
    console.log('哈希 ' + sha(JSON.stringify(jsonPack.levels)).slice(0, 16));
    console.log('关卡包校验通过');
  }
}

function main() {
  if (process.argv.indexOf('--check') >= 0) {
    check();
    return;
  }
  var levels = build();
  if (!verifyLevels(levels, { base: loadBase() })) return;
  write(levels);
}

main();
