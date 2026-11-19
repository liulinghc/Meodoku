#!/usr/bin/env node
/**
 * 前 10 关教学池生成器。
 *
 * 仅针对 4×4：穷举“4 个连通色区、每区 1 只猫、行列各 1 只”的布局，
 * 只保留唯一解、结构合格、难度分 0（R1–R4 直接推出，不需要分支）的题面，
 * 再按形状差异挑 10 个互不重复的布局。
 *
 * 产物：tools/lib/easy-10.json（由 tools/gen-pack.js 装入前 10 个槽位）。
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
var OUT = path.join(__dirname, 'lib', 'easy-10.json');
var N = 4;
var COUNT = 10;
var SOL = [2, 0, 3, 1];  // 4×4 只有两种合法解，另一种是它的水平镜像

function mirror(r, s) {
  var out = '';
  var sol = '';
  for (var row = 0; row < N; row++) {
    for (var c = N - 1; c >= 0; c--) out += r.charAt(row * N + c);
    sol += String(N - 1 - Number(s.charAt(row)));
  }
  return { r: out, s: sol };
}

function borderBits(region) {
  var bits = '';
  for (var r = 0; r < N; r++) {
    for (var c = 0; c < N; c++) {
      if (c < N - 1) bits += region[r * N + c] === region[r * N + c + 1] ? '1' : '0';
      if (r < N - 1) bits += region[r * N + c] === region[(r + 1) * N + c] ? '1' : '0';
    }
  }
  return bits;
}

function hamming(a, b) {
  var d = 0;
  for (var i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) d++;
  return d;
}

function shapeStats(region) {
  var counts = [0, 0, 0, 0];
  var i;
  for (i = 0; i < region.length; i++) counts[region[i]]++;
  var min = Math.min.apply(null, counts);
  var max = Math.max.apply(null, counts);

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

  return { spread: max - min, density: density / N, counts: counts };
}

/** 穷举：每行解格固定归属本行区域，其余 12 格分给 4 个区域 */
function enumerate() {
  var seeds = [];
  for (var r = 0; r < N; r++) seeds.push(r * N + SOL[r]);

  var cells = [];
  for (var i = 0; i < N * N; i++) if (seeds.indexOf(i) < 0) cells.push(i);

  var region = new Array(N * N);
  for (var g = 0; g < N; g++) region[seeds[g]] = g;

  var bySig = {};

  function connectedAll() {
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

  function accept() {
    var counts = [0, 0, 0, 0];
    var i;
    for (i = 0; i < N * N; i++) counts[region[i]]++;
    for (i = 0; i < N; i++) {
      if (counts[i] < 2 || counts[i] > 7) return;
    }
    for (var g = 0; g < N; g++) {
      for (var r = 0; r < N; r++) {
        var rowCount = 0;
        var colCount = 0;
        for (var c = 0; c < N; c++) {
          if (region[r * N + c] === g) rowCount++;
          if (region[c * N + r] === g) colCount++;
        }
        if (rowCount === N || colCount === N) return;
      }
    }
    if (!connectedAll()) return;
    if (gen.checkStructure(N, region)) return;

    var info = solver.solveInfo(N, region, 2);
    if (info.truncated || info.count !== 1 ||
      !solver.sameSolution(info.first, SOL)) return;

    var analysis = diff.analyzeDifficulty(N, region);
    if (!analysis || analysis.score !== 0) return;

    var rString = gen.encodeRegionString(region, N);
    var sig = diff.canonicalSignature(N, region);
    if (bySig[sig]) return;
    bySig[sig] = {
      r: rString,
      s: gen.encodeSolutionString(info.first),
      sig: sig,
      bits: borderBits(region),
      stats: shapeStats(region)
    };
  }

  (function rec(k) {
    if (k === cells.length) {
      accept();
      return;
    }
    for (var g = 0; g < N; g++) {
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

function better(a, b) {
  // 区域大小更均衡、形状更紧凑者优先
  if (a.stats.spread !== b.stats.spread) return a.stats.spread < b.stats.spread;
  if (Math.abs(a.stats.density - b.stats.density) > 0.001) {
    return a.stats.density > b.stats.density;
  }
  return a.r < b.r;
}

function pick(list) {
  var pool = list.slice();
  pool.sort(function (a, b) {
    if (a.stats.spread !== b.stats.spread) return a.stats.spread - b.stats.spread;
    if (Math.abs(a.stats.density - b.stats.density) > 0.001) {
      return b.stats.density - a.stats.density;
    }
    return a.r < b.r ? -1 : (a.r > b.r ? 1 : 0);
  });

  var chosen = [pool.shift()];
  while (chosen.length < COUNT && pool.length) {
    var best = -1;
    var bestMin = -1;
    for (var i = 0; i < pool.length; i++) {
      var min = 64;
      for (var k = 0; k < chosen.length; k++) {
        var d = hamming(pool[i].bits, chosen[k].bits);
        if (d < min) min = d;
      }
      if (min > bestMin ||
        (min === bestMin && best >= 0 && better(pool[i], pool[best]))) {
        bestMin = min;
        best = i;
      }
    }
    chosen.push(pool.splice(best, 1)[0]);
  }
  return chosen;
}

function build() {
  var list = enumerate();
  if (list.length < COUNT) {
    throw new Error('可用教学布局不足: ' + list.length);
  }
  var picked = pick(list);

  // 隔一个做水平镜像，让两种 4×4 解型都出现；镜像不改变规范签名
  var levels = [];
  for (var i = 0; i < picked.length; i++) {
    var r = picked[i].r;
    var s = picked[i].s;
    if (i % 2 === 1) {
      var m = mirror(r, s);
      r = m.r;
      s = m.s;
    }
    levels.push({
      n: N,
      r: r,
      s: s,
      t: 1,
      d: 0,
      b: 0,
      seed: hash.fnv1a('md-easy:' + r + ':' + s)
    });
  }

  var pack = {
    schema: 1,
    generator: 'md-easy/1',
    note: '前 10 关教学池：4×4、T1、零分支；由 tools/gen-easy.js 枚举生成，勿手改。',
    total: COUNT,
    levels: levels
  };
  fs.writeFileSync(OUT, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  console.log('候选 ' + list.length + ' 个，写入 ' + path.relative(ROOT, OUT) +
    '（' + COUNT + ' 关，' + Math.round(fs.statSync(OUT).size / 1024) + 'KB）');
  for (var j = 0; j < levels.length; j++) {
    console.log('  #' + (j + 1) + ' ' + levels[j].r + ' → ' + levels[j].s);
  }
}

function check() {
  if (!fs.existsSync(OUT)) {
    console.error('缺少 ' + path.relative(ROOT, OUT) + '，请先运行 node tools/gen-easy.js');
    process.exitCode = 1;
    return;
  }
  var pack = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  var bad = [];
  if (pack.schema !== 1 || pack.total !== COUNT || !pack.levels ||
    pack.levels.length !== COUNT) {
    bad.push('文件结构非法');
  } else {
    var seen = {};
    for (var i = 0; i < pack.levels.length; i++) {
      var lv = pack.levels[i];
      if (lv.n !== 4 || lv.t !== 1 || lv.d !== 0 || lv.b !== 0) {
        bad.push('#' + (i + 1) + ' 尺寸/档位/分支非法');
        continue;
      }
      var region = gen.decodeRegionString(lv.r, 4);
      var v = gen.validateLevel(lv);
      if (!v.ok) {
        bad.push('#' + (i + 1) + ':' + v.errors.join('|'));
        continue;
      }
      var a = diff.analyzeDifficulty(4, region);
      if (!a || a.score !== 0 || a.tier !== 1 || a.branchCount !== 0) {
        bad.push('#' + (i + 1) + ' 难度不是零分支');
      }
      var sig = diff.canonicalSignature(4, region);
      if (seen[sig]) bad.push('#' + (i + 1) + ' 布局重复');
      seen[sig] = true;
    }
  }
  if (bad.length) {
    console.error(bad.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('前 10 关教学池校验通过：' + COUNT + ' 关均为 4×4 / T1 / 零分支 / 唯一解');
}

if (process.argv.indexOf('--check') >= 0) check();
else build();
