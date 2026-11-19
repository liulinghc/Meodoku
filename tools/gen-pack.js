#!/usr/bin/env node
/**
 * 正式关卡包生成器（S5.1：前 30 关新曲线 + 全量人类难度重评）。
 *
 * 产物：
 *   levels/pack-001.json  源数据（可读 JSON，不打包）
 *   levels/pack-001.js    小游戏加载的 CommonJS 包装（紧凑 JSON，打包）
 *
 * 数据来源：
 *   - 第 1–30 关：tools/lib/easy-30.json（tools/gen-easy.js 生成）
 *       L1–3 预放 3/2/1 只猫；L4 高亮突破口；L5–10 独立完成；
 *       L11–30 为 5×5 零假设入门。
 *   - 第 31–300 关：tools/lib/base-300.json 中原来的第 31–300 关，
 *       内容与稳定 ID 不变，只用新的“人类技巧求解器”重算档位与难度分。
 *       原第 11–30 关的题面被新曲线替换，因此不在新包中。
 *
 * 全部关卡必须：唯一解、结构合格、布局签名不重复、档位与分数一致；
 * 前 30 关必须零假设且难度不倒挂。任何一项失败直接报错，不静默降级。
 *
 * 用法：
 *   node tools/gen-pack.js           重新生成并复验
 *   node tools/gen-pack.js --check   只复验现有 JSON/JS
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gen = require('./lib/generate');
var diff = require('../js/domain/difficulty');

var ROOT = path.resolve(__dirname, '..');
var JSON_OUT = path.join(ROOT, 'levels', 'pack-001.json');
var JS_OUT = path.join(ROOT, 'levels', 'pack-001.js');
var BASE_FILE = path.join(__dirname, 'lib', 'base-300.json');
var EASY_FILE = path.join(__dirname, 'lib', 'easy-30.json');
var LEGACY_FILE = path.join(ROOT, 'levels', 'legacy-order.js');

var TOTAL = 300;
var EASY_COUNT = 30;
var OLD_START = 30;  // base-300 中保留的原第 31–300 关

// 新人类难度指标下的实际分布（前 30 关全部 T1）
var QUOTAS = { 1: 30, 2: 97, 3: 131, 4: 24, 5: 18 };
var SIZES = { 4: 10, 5: 57, 6: 90, 7: 104, 8: 24, 9: 15 };
var GIVEN_COUNTS = [3, 2, 1, 0, 0, 0, 0, 0, 0, 0];
var FOCUS_SLOT = 4;

function pad3(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return s;
}

function loadJson(file, label) {
  if (!fs.existsSync(file)) {
    throw new Error('缺少 ' + label + ' ' + path.relative(ROOT, file));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadBase() {
  var pack = loadJson(BASE_FILE, '基线关卡');
  if (!pack.levels || pack.levels.length !== TOTAL) {
    throw new Error('基线关卡数非法: ' + (pack.levels ? pack.levels.length : 0));
  }
  return pack;
}

function compact(lv) {
  var out = {
    id: lv.id,
    n: lv.n,
    r: lv.r,
    s: lv.s,
    t: lv.t,
    d: lv.d,
    b: lv.b,
    seed: lv.seed
  };
  if (lv.g) out.g = lv.g;
  if (typeof lv.h === 'number') out.h = lv.h;
  return out;
}

function givensOf(lv) {
  if (!lv.g) return { givens: [], errors: [] };
  var solution = gen.decodeSolutionString(lv.s);
  var givens = gen.decodeGivenString(lv.g, lv.n, solution);
  if (givens === null) return { givens: [], errors: ['预放猫编码非法'] };
  return { givens: givens, errors: [] };
}

/** 前 30 关：结构、预放、高亮与难度全部在这里先把关 */
function loadEasy() {
  var pack = loadJson(EASY_FILE, '前 30 关曲线');
  if (pack.schema !== 2 || !pack.levels || pack.levels.length !== EASY_COUNT) {
    throw new Error('前 30 关文件数量/结构非法');
  }
  var out = [];
  var seen = {};
  var lastScore = -1;
  for (var i = 0; i < pack.levels.length; i++) {
    var lv = compact(pack.levels[i]);
    var slot = i + 1;
    lv.id = 'E' + pad3(slot);
    if (lv.n !== (slot <= 10 ? 4 : 5)) {
      throw new Error('第 ' + slot + ' 关尺寸非法');
    }
    var v = gen.validateLevel(lv);
    if (!v.ok) throw new Error('第 ' + slot + ' 关非法: ' + v.errors.join('|'));
    var gd = givensOf(lv);
    if (gd.errors.length) throw new Error('第 ' + slot + ' 关: ' + gd.errors.join('|'));
    var wantGiven = slot <= 3 ? GIVEN_COUNTS[slot - 1] : 0;
    if (gd.givens.length !== wantGiven) {
      throw new Error('第 ' + slot + ' 关预放数 ' + gd.givens.length + '≠' + wantGiven);
    }
    var region = gen.decodeRegionString(lv.r, lv.n);
    var a = diff.analyzeDifficulty(lv.n, region, gd.givens);
    if (!a || !a.guessFree || a.tier !== 1 || a.firstMove < 0) {
      throw new Error('第 ' + slot + ' 关不是零假设入门题');
    }
    if (a.score !== lv.d || a.tier !== lv.t || a.branchCount !== lv.b) {
      throw new Error('第 ' + slot + ' 关难度字段与求解结果不一致');
    }
    if (lv.d < lastScore) throw new Error('前 30 关难度倒挂: #' + slot);
    lastScore = lv.d;
    if (slot === FOCUS_SLOT) {
      if (lv.h !== a.firstMove || a.firstMoveLockSteps > 1) {
        throw new Error('第 4 关高亮格不是直观突破口');
      }
    } else if (lv.h !== undefined) {
      throw new Error('第 ' + slot + ' 关不应高亮');
    }
    var sig = diff.canonicalSignature(lv.n, region);
    if (seen[sig]) throw new Error('第 ' + slot + ' 关布局重复');
    seen[sig] = true;
    out.push(lv);
  }
  return out;
}

/** 保留原第 31–300 关的内容与 ID，用新求解器重算 t/d/b */
function retierOld(base) {
  var out = [];
  var seen = {};
  for (var i = OLD_START; i < base.levels.length; i++) {
    var old = base.levels[i];
    var region = gen.decodeRegionString(old.r, old.n);
    var a = diff.analyzeDifficulty(old.n, region, []);
    if (!a) throw new Error('旧关卡难度分析失败: ' + old.id);
    var lv = {
      id: old.id,
      n: old.n,
      r: old.r,
      s: old.s,
      t: a.tier,
      d: a.score,
      b: a.branchCount,
      seed: old.seed
    };
    var sig = diff.canonicalSignature(lv.n, region);
    if (seen[sig]) throw new Error('旧关卡布局重复: ' + lv.id);
    seen[sig] = lv.id;
    out.push(lv);
  }
  out.sort(compareLevels);
  return out;
}

function compareLevels(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  if (a.n !== b.n) return a.n - b.n;
  if (a.d !== b.d) return a.d - b.d;
  return a.seed - b.seed;
}

function build() {
  var base = loadBase();
  var easy = loadEasy();
  var old = retierOld(base);
  var levels = easy.concat(old);
  if (levels.length !== TOTAL) {
    throw new Error('关卡数 ' + levels.length + '≠' + TOTAL);
  }
  if (!verifyLevels(levels, { base: base, easy: easy })) return null;
  printChapters(levels);
  write(levels);
  return levels;
}

function verifyLevels(levels, opts) {
  opts = opts || {};
  var bad = [];
  var byTier = {};
  var bySize = {};
  var seen = {};
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
    var gd = givensOf(lv);
    if (gd.errors.length) {
      bad.push(lv.id + ':' + gd.errors.join('|'));
      continue;
    }
    var a = diff.analyzeDifficulty(lv.n, region, gd.givens);
    if (!a) {
      bad.push(lv.id + ':难度求解失败');
      continue;
    }
    if (a.tier !== lv.t) bad.push(lv.id + ':档位 ' + lv.t + '≠' + a.tier);
    if (a.score !== lv.d) bad.push(lv.id + ':难度分 ' + lv.d + '≠' + a.score);
    if (a.branchCount !== lv.b) bad.push(lv.id + ':假设数 ' + lv.b + '≠' + a.branchCount);
    var sig = diff.canonicalSignature(lv.n, region);
    if (seen[sig]) bad.push(lv.id + ':重复布局 ' + sig);
    seen[sig] = lv.id;
    byTier[lv.t] = (byTier[lv.t] || 0) + 1;
    bySize[lv.n] = (bySize[lv.n] || 0) + 1;
  }

  for (var t = 1; t <= 5; t++) {
    if ((byTier[t] || 0) !== QUOTAS[t]) {
      bad.push('T' + t + ' 数量 ' + (byTier[t] || 0) + '≠' + QUOTAS[t]);
    }
  }
  for (var n = 4; n <= 9; n++) {
    if ((bySize[n] || 0) !== SIZES[n]) {
      bad.push(n + '×' + n + ' 数量 ' + (bySize[n] || 0) + '≠' + SIZES[n]);
    }
  }

  if (opts.base) {
    var baseBad = verifyBase(levels, opts.base);
    for (var b = 0; b < baseBad.length; b++) bad.push(baseBad[b]);
  }
  if (opts.easy) {
    var easyBad = verifyEasy(levels, opts.easy);
    for (var e = 0; e < easyBad.length; e++) bad.push(easyBad[e]);
  }
  var legacyBad = verifyLegacy(opts.base);
  for (var l = 0; l < legacyBad.length; l++) bad.push(legacyBad[l]);

  console.log('复验 ' + levels.length + ' 关：' + (bad.length ? '失败' : '通过') +
    '（' + (Date.now() - t0) + 'ms）');
  console.log('档位分布 ' + JSON.stringify(byTier));
  console.log('尺寸分布 ' + JSON.stringify(bySize));
  if (bad.length) {
    console.error(bad.slice(0, 16).join('\n'));
    if (bad.length > 16) console.error('... 共 ' + bad.length + ' 条');
    process.exitCode = 1;
    return false;
  }
  return true;
}

function verifyBase(levels, base) {
  var bad = [];
  var byId = {};
  for (var i = 0; i < levels.length; i++) byId[levels[i].id] = levels[i];

  var kept = base.levels.slice(OLD_START);
  for (var j = 0; j < kept.length; j++) {
    var old = kept[j];
    var cur = byId[old.id];
    if (!cur) {
      bad.push('旧关卡丢失 ' + old.id);
      continue;
    }
    if (cur.n !== old.n || cur.r !== old.r || cur.s !== old.s ||
      cur.seed !== old.seed) {
      bad.push('旧关卡内容变化 ' + old.id);
    }
  }

  // 原第 11–30 关由新曲线取代，不应再出现在包内
  for (var d = 10; d < OLD_START; d++) {
    if (byId[base.levels[d].id]) {
      bad.push('被替换的旧关仍在包内 ' + base.levels[d].id);
    }
  }
  return bad;
}

function verifyEasy(levels, easy) {
  var bad = [];
  for (var i = 0; i < EASY_COUNT; i++) {
    var lv = levels[i];
    var want = easy[i];
    if (!lv || lv.id !== want.id) {
      bad.push('前 30 关 ID/顺序变化: ' + (lv ? lv.id : '缺失') + ' ≠ ' + want.id);
      continue;
    }
    if (lv.n !== want.n || lv.r !== want.r || lv.s !== want.s ||
      lv.t !== want.t || lv.d !== want.d || lv.b !== want.b) {
      bad.push('前 30 关内容变化: ' + want.id);
    }
  }
  return bad;
}

function verifyLegacy(base) {
  var bad = [];
  if (!base) return ['缺少基线，无法校验旧顺序快照'];
  var legacy;
  try {
    legacy = require(LEGACY_FILE);
  } catch (e) {
    return ['缺少 levels/legacy-order.js，旧存档无法按稳定 ID 迁移'];
  }
  if (!Array.isArray(legacy) || legacy.length !== TOTAL) {
    return ['legacy-order 数量非法'];
  }
  for (var i = 0; i < TOTAL; i++) {
    if (legacy[i] !== base.levels[i].id) {
      bad.push('legacy-order 第 ' + (i + 1) + ' 位 ' + legacy[i] +
        '≠' + base.levels[i].id);
      break;
    }
  }
  return bad;
}

function printChapters(levels) {
  var chapters = Math.ceil(levels.length / 20);
  console.log('章节难度分布（每 20 关一章）：');
  for (var c = 1; c <= chapters; c++) {
    var start = (c - 1) * 20;
    var end = Math.min(levels.length, c * 20);
    var tiers = {};
    var sizes = {};
    for (var i = start; i < end; i++) {
      tiers[levels[i].t] = (tiers[levels[i].t] || 0) + 1;
      sizes[levels[i].n] = (sizes[levels[i].n] || 0) + 1;
    }
    console.log('  第 ' + c + ' 章 ' + (start + 1) + '–' + end +
      ' 档位 ' + JSON.stringify(tiers) + ' 尺寸 ' + JSON.stringify(sizes));
  }
}

function packObject(levels) {
  return {
    schema: 4,
    pack: 1,
    version: 4,
    generator: 'md-levelgen/' + gen.GENERATOR_VERSION,
    generatedAt: new Date().toISOString().slice(0, 10),
    total: levels.length,
    tierNames: diff.TIER_NAMES,
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
    ' * 前 30 关：4×4 预放教学 + 5×5 零假设入门；g=预放猫，h=高亮格。',
    ' * r：n² 个区域字母；s：每行猫所在列；t：档位；d：难度分；b：假设数。',
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
  if (jsonPack.total !== TOTAL || jsonPack.schema !== 4) {
    console.error('关卡包版本/数量非法: schema=' + jsonPack.schema +
      ' total=' + jsonPack.total);
    process.exitCode = 1;
    return;
  }
  var base = loadBase();
  var easy = loadEasy();
  var ok = verifyLevels(jsonPack.levels, { base: base, easy: easy });
  if (ok) {
    var bytes = Buffer.byteLength(JSON.stringify(jsonPack.levels), 'utf8');
    console.log('关卡数据 ' + Math.round(bytes / 1024) + 'KB');
    console.log('哈希 ' + sha(JSON.stringify(jsonPack.levels)).slice(0, 16));
    console.log('关卡包校验通过');
  }
}

function main() {
  if (process.argv.indexOf('--check') >= 0) {
    check();
    return;
  }
  build();
}

main();
