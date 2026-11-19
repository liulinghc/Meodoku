#!/usr/bin/env node
/**
 * 冒烟测试（Node 环境，不依赖微信开发者工具）。
 *
 * 覆盖：
 *   4×4–9×9 正式关卡包（唯一解/档位/去重/紧凑解码）/ 运行时规则判胜 /
 *   三场景+结算渲染 / 触摸交互 / 提示与资源 / 重开与冲突反馈 /
 *   计时与猫爪评分 / 结算奖励与导航 / 存档落盘与重载 / 小屏布局
 *
 * 说明：Canvas 是桩实现，这里只看"逻辑与坐标是否正确、有没有抛异常"，
 * 真实帧率必须在开发者工具真机调试里看。
 *
 * 用法：node tools/smoke-test.js
 */
var path = require('path');

/* ---------------- wx 环境桩 ---------------- */

var store = {};
var handlers = {};

function FakeCtx() { this.ops = 0; }
['setTransform', 'clearRect', 'fillRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'arcTo', 'arc', 'rect', 'clip', 'fill', 'stroke', 'save', 'restore', 'fillText',
  'quadraticCurveTo', 'bezierCurveTo', 'translate', 'scale', 'rotate'].forEach(function (m) {
  FakeCtx.prototype[m] = function () { this.ops++; };
});
FakeCtx.prototype.measureText = function (s) { return { width: String(s).length * 8 }; };
FakeCtx.prototype.drawImage = function () { this.ops++; };

function FakeCanvas(w, h) {
  this.width = w || 375;
  this.height = h || 812;
  this._ctx = new FakeCtx();
}
FakeCanvas.prototype.getContext = function () { return this._ctx; };

global.wx = {
  createCanvas: function () { return new FakeCanvas(375, 812); },
  createOffscreenCanvas: function (o) { return new FakeCanvas(o.width, o.height); },
  getWindowInfo: function () {
    return {
      windowWidth: 375,
      windowHeight: 812,
      pixelRatio: 3,
      statusBarHeight: 44,
      safeArea: { top: 44, bottom: 778, left: 0, right: 375, width: 375, height: 734 },
      platform: 'devtools'
    };
  },
  getStorageSync: function (k) { return store[k] === undefined ? '' : store[k]; },
  setStorageSync: function (k, v) { store[k] = v; },
  removeStorageSync: function (k) { delete store[k]; },
  onTouchStart: function (fn) { handlers.start = fn; },
  onTouchMove: function (fn) { handlers.move = fn; },
  onTouchEnd: function (fn) { handlers.end = fn; },
  onTouchCancel: function (fn) { handlers.cancel = fn; },
  onHide: function (fn) { handlers.hide = fn; },
  onShow: function (fn) { handlers.show = fn; },
  onError: function (fn) { handlers.error = fn; },
  onUnhandledRejection: function (fn) { handlers.rejection = fn; },
  onMemoryWarning: function (fn) { handlers.memory = fn; },
  vibrateShort: function () {}
};

global.requestAnimationFrame = function () { return 1; };
global.cancelAnimationFrame = function () {};

/* ---------------- 测试骨架 ---------------- */

var passed = 0;
var failed = 0;
var t0 = Date.now();

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.log('  ✗ ' + name + (detail ? '  → ' + detail : ''));
  }
}

function tap(x, y) {
  handlers.start({ touches: [{ identifier: 1, clientX: x, clientY: y }] });
  handlers.end({ changedTouches: [{ identifier: 1, clientX: x, clientY: y }] });
}

function frames(app, n) {
  for (var i = 0; i < n; i++) app.frame(1 / 60);
}

function sceneName(app) {
  var top = app.sm.top();
  return top ? top.sceneName : null;
}

function countCells(game, value) {
  var n = 0;
  for (var i = 0; i < game.cells.length; i++) if (game.cells[i] === value) n++;
  return n;
}

function hasConflict(game) {
  for (var k in game.conflict) if (game.conflict.hasOwnProperty(k)) return true;
  return false;
}

function tapCell(app, game, r, c) {
  var rc = app.layout.cellRect(game.L.geom, r, c);
  tap(game.L.board.x + rc.x + rc.size / 2, game.L.board.y + rc.y + rc.size / 2);
}

function fillSolution(app, game) {
  var sol = game.level.solution;
  for (var r = 0; r < game.n; r++) {
    var c = sol[r];
    if (game.cells[r * game.n + c] === 2) continue;
    tapCell(app, game, r, c);
    tapCell(app, game, r, c);
  }
}

/* ---------------- 1. 关卡包 ---------------- */

console.log('[1] 关卡包');
var gen = require('./lib/generate');
var diff = require('../js/domain/difficulty');
var pack = require('../levels/pack-001');
var levelsIndex = require('../levels/index');

check('关卡总数 300（15 章）', pack.levels.length === 300 && levelsIndex.total() === 300,
  '实际 ' + pack.levels.length);
check('章节数为 15', require('../js/services/levels').chapterCount() === 15,
  'chapterCount=' + require('../js/services/levels').chapterCount());
check('末章区间 281–300', (function () {
  var r = require('../js/services/levels').chapterRange(15);
  return r.start === 281 && r.end === 300;
})());

var bad = [];
var signatures = {};
var duplicateCount = 0;
for (var i = 0; i < pack.levels.length; i++) {
  var lv = pack.levels[i];
  var region = gen.decodeRegionString(lv.r, lv.n);
  var v = gen.validateLevel(lv);
  var connected = gen.regionsConnected(lv.n, region);
  var info = gen.solveInfo(lv.n, region, 2);
  var matches = info.count === 1 && gen.sameSolution(info.first, lv.solution);
  var sig = diff.canonicalSignature(lv.n, region);
  if (signatures[sig]) duplicateCount++;
  signatures[sig] = true;
  if (!v.ok || !connected || !matches) {
    bad.push(lv.id + ':' + (v.errors.join('|') || '') + (connected ? '' : '断开') + (matches ? '' : '解不符'));
  }
}
check('全部唯一解 / 合法 / 区域连通', bad.length === 0, bad.slice(0, 3).join('; '));
check('300 关布局无重复（含对称/重编号）', duplicateCount === 0, '重复 ' + duplicateCount);
check('索引从 1 开始且连续', levelsIndex.get(1) === pack.levels[0] && levelsIndex.get(300) === pack.levels[299],
  'get(300)=' + (levelsIndex.get(300) && levelsIndex.get(300).id));
check('越界返回 null', levelsIndex.get(0) === null && levelsIndex.get(301) === null);
check('旧关卡 ID 在新序号中可查', levelsIndex.indexOfId('L001') === 1 &&
  levelsIndex.indexOfId('L200') > 0 && levelsIndex.indexOfId('L999') === 0,
  'L200→' + levelsIndex.indexOfId('L200'));
check('尺寸覆盖 4/5/6/7/8/9', (function () {
  var set = {};
  for (var k = 0; k < pack.levels.length; k++) set[pack.levels[k].n] = true;
  return set[4] && set[5] && set[6] && set[7] && set[8] && set[9];
})());
check('首关为 4×4 教学关', levelsIndex.get(1).n === 4, 'n=' + levelsIndex.get(1).n);
check('档位分布 30/75/105/60/30', (function () {
  var c = {};
  for (var k = 0; k < pack.levels.length; k++) c[pack.levels[k].t] = (c[pack.levels[k].t] || 0) + 1;
  return c[1] === 30 && c[2] === 75 && c[3] === 105 && c[4] === 60 && c[5] === 30;
})());
check('紧凑关卡已解码为 regions/solution', (function () {
  var a = levelsIndex.get(1);
  return Array.isArray(a.regions) && a.regions.length === a.n &&
    Array.isArray(a.solution) && a.solution.length === a.n &&
    a.regions.join('').length === a.n * a.n;
})());
check('每关档位与难度分由同一判据产生', (function () {
  var badTier = 0;
  for (var k = 0; k < pack.levels.length; k++) {
    var l = pack.levels[k];
    var a = diff.analyzeDifficulty(l.n, gen.decodeRegionString(l.r, l.n));
    if (!a || a.tier !== l.t || a.score !== l.d) badTier++;
  }
  return badTier === 0;
})());

// 本地动态生成能力：运行时域模块同一套管线（每日挑战后续直接复用）
var runtimeGen = require('../js/domain/generate');
var dynamic = runtimeGen.generateLevel(20261119, 5, { attempts: 6000, tier: 2 });
check('运行时本地生成 5×5 成功', !!dynamic);
if (dynamic) {
  var dynCheck = runtimeGen.validateLevel(dynamic);
  var dynRegion = dynamic.regions ? runtimeGen.decodeRegions(dynamic.regions, 5) :
    runtimeGen.decodeRegionString(dynamic.regionString, 5);
  var dynInfo = runtimeGen.solveInfo(5, dynRegion, 2);
  check('运行时生成关卡唯一解/合法', dynCheck.ok && dynInfo.count === 1,
    dynCheck.errors.join('|'));
  check('运行时生成档位匹配', dynamic.tier === 2, 'tier=' + dynamic.tier);
}

// 生成器答案 × 运行时规则交叉验证（运行时判胜不读答案）
var rulesMod = require('../js/domain/rules');
var runtimeBad = [];
for (var ri = 0; ri < pack.levels.length; ri++) {
  var rlv = pack.levels[ri];
  var rgrid = gen.decodeRegionString(rlv.r, rlv.n);
  var rcats = [];
  for (var rr = 0; rr < rlv.n; rr++) {
    var rc = rlv.s.charCodeAt(rr) - 48;
    rcats.push(rr * rlv.n + rc);
  }
  if (!rulesMod.analyze(rcats, rlv.n, rgrid).solved) runtimeBad.push(rlv.id);
}
check('运行时规则判定全部答案通关', runtimeBad.length === 0, runtimeBad.slice(0, 3).join(','));

/* ---------------- 2. 启动与渲染 ---------------- */

console.log('[2] 启动与三场景渲染');
var App = require('../js/app');
var levelsSvc = require('../js/services/levels');
var app = new App();
app.start();
frames(app, 3);
check('入口场景为 home', sceneName(app) === 'home');
check('首页有绘制调用', app.renderer.ctx.ops > 100, 'ops=' + app.renderer.ctx.ops);
check('新档只解锁第 1 关', app.progress.isUnlocked(1) && !app.progress.isUnlocked(2) &&
  !app.progress.isUnlocked(300));
check('DPR 上限为 2', app.env.dpr === 2, 'dpr=' + app.env.dpr);
check('主画布按 DPR 放大', app.renderer.canvas.width === 750, 'width=' + app.renderer.canvas.width);

/* ---------------- 3. 页面跳转 ---------------- */

console.log('[3] 导航');
var homeL = app.layout.home();
tap(homeL.cta.x + homeL.cta.w / 2, homeL.cta.y + homeL.cta.h / 2);
frames(app, 1);
check('首页 → 关卡地图', sceneName(app) === 'levelmap');

var mapScene = app.sm.top();
var nodes = mapScene._computeNodes();
check('地图节点数与关卡数一致', nodes.length === 20, '实际 ' + nodes.length);
tap(nodes[0].x, nodes[0].y);
frames(app, 1);
check('地图 → 对局', sceneName(app) === 'game');

/* ---------------- 4. 棋盘交互、计时与提示 ---------------- */

console.log('[4] 对局交互 / 计时 / 提示');
var game = app.sm.top();
var n = game.n;
var G = app.layout.game(n);

check('静态棋盘图层已生成', !!game.boardLayer);
check('棋盘不越界（底部色带之上）', G.board.y + G.board.size <= G.band.y + 0.5,
  'bottom=' + (G.board.y + G.board.size).toFixed(1) + ' band=' + G.band.y.toFixed(1));
check('所有棋盘格子边长 ≥ 28px', G.geom.tile >= 28, 'tile=' + G.geom.tile.toFixed(1));

var copy = require('../js/data/copy');

tapCell(app, game, 0, 0);
check('点一次 → X 标记', game.cells[0] === 1, 'cell=' + game.cells[0]);
tapCell(app, game, 0, 0);
check('点两次 → 猫', game.cells[0] === 2, 'cell=' + game.cells[0]);
check('合法放置有反馈波纹', game.fx.length > 0 && game.fx[0].kind === 'ok');
check('统计已记录放猫', app.progress.catsPlaced() === 1, 'catsPlaced=' + app.progress.catsPlaced());
check('步数已记录', game.moves === 2, 'moves=' + game.moves);

// 同一行再放一只 → 冲突反馈 + 失误统计
tapCell(app, game, 0, 1);
tapCell(app, game, 0, 1);
check('同行两只猫触发冲突', hasConflict(game));
check('冲突计入失误', game.mistakes === 1, 'mistakes=' + game.mistakes);
check('冲突提示说明原因', app.toast.text === copy.errorRow, 'toast=' + app.toast.text);
check('冲突触发棋盘震动', game.shakeT > 0, 'shakeT=' + game.shakeT);
check('冲突放置显示红色波纹', game.fx.length > 0 && game.fx[game.fx.length - 1].kind === 'bad');

var undoBtn = G.tools[0];
var restartBtn = G.tools[1];
var hintBtn = G.tools[2];

frames(app, 20);
check('重开前计时已推进', game.elapsed > 0.2, 'elapsed=' + game.elapsed.toFixed(2));

tap(undoBtn.cx, undoBtn.cy);
check('撤销回到 X', game.cells[1] === 1, 'cell=' + game.cells[1]);

tap(restartBtn.cx, restartBtn.cy);
check('重开清空棋盘', game.cells[0] === 0 && game.cells[1] === 0);
check('重开重置计时', game.elapsed < 0.05, 'elapsed=' + game.elapsed.toFixed(3));
check('重开重置步数与失误', game.moves === 0 && game.mistakes === 0);
check('重开有明确提示', app.toast.text === copy.toastRestarted);

tap(undoBtn.cx, undoBtn.cy);
check('撤销恢复重开前盘面', game.cells[0] === 2 && game.cells[1] === 1);

tap(restartBtn.cx, restartBtn.cy);
check('再次重开清空盘面', game.cells[0] === 0 && game.cells[1] === 0);

frames(app, 30);
check('对局计时在推进', game.elapsed > 0.4, 'elapsed=' + game.elapsed.toFixed(2));

var ticketsBefore = app.progress.tickets();
var catsBefore = countCells(game, 2);
tap(hintBtn.cx, hintBtn.cy);
check('提示扣 1 张提示券', app.progress.tickets() === ticketsBefore - 1,
  'tickets=' + app.progress.tickets());
check('提示只放下一只猫', countCells(game, 2) === catsBefore + 1);
check('提示落在答案格', (function () {
  for (var k = 0; k < game.cells.length; k++) {
    if (game.cells[k] !== 2) continue;
    var r = Math.floor(k / game.n);
    var c = k % game.n;
    return game.level.solution[r] === c;
  }
  return false;
})());
check('提示后盘面无冲突', !hasConflict(game));
check('提示计入本局统计', game.hintsUsed === 1 && app.progress.d().stats.hintsUsed === 1);

/* ---------------- 4b. 切后台与中断续玩 ---------------- */

console.log('[4b] 切后台与中断续玩');
frames(app, 20); // 保证用时超过 0.5s，续玩提示会展示
var snapshot = game.cells.slice();
var snapshotIndex = game.index;
var elapsedAtHide = game.elapsed;

handlers.hide();
var savedResume = app.progress.getResume(snapshotIndex);
check('切后台保存未完成盘面', !!savedResume && savedResume.cells.join('') === snapshot.join(''),
  'resume=' + (savedResume && savedResume.cells.join('')));
check('切后台立即双写存档', !!store['md:save:v1']);

app.sm.pop();
frames(app, 1);
app.sm.push('game', { levelIndex: snapshotIndex });
frames(app, 1);
game = app.sm.top();

check('重进同关恢复盘面', game.cells.join('') === snapshot.join(''),
  'cells=' + game.cells.join(''));
check('重进同关恢复用时与提示计数', game.elapsed >= elapsedAtHide - 0.02 &&
  game.elapsed < elapsedAtHide + 0.5 && game.hintsUsed === 1,
  'elapsed=' + game.elapsed.toFixed(2) + ' hints=' + game.hintsUsed);
check('续玩不恢复撤销栈', game.undoStack.length === 0);
check('续玩有提示文案', app.toast.text === copy.toastResumed, 'toast=' + app.toast.text);

/* ---------------- 5. 通关、结算与下一关 ---------------- */

console.log('[5] 通关与结算');
fillSolution(app, game);
check('按答案摆放后判定通关', game.solvedFlag === true);
check('结算前记录用时', game.timeMs > 0, 'timeMs=' + game.timeMs);
check('用过提示 → 1 猫爪', game.resultInfo && game.resultInfo.paws === 1);
check('首通金币已到账（20）', app.progress.coins() === 120, 'coins=' + app.progress.coins());
check('通关记录含猫爪与最佳用时', (function () {
  var e = app.progress.d().completed['1'];
  return !!e && e.paws === 1 && e.bestTimeMs > 0;
})());

frames(app, 50);
check('通关后进入结算页', sceneName(app) === 'result');
var result = app.sm.top();
check('结算数据带下一关', result.info.nextIndex === 2, 'next=' + result.info.nextIndex);
check('结算数据含步数', result.info.moves > 0, 'moves=' + result.info.moves);
check('结算页不残留提示 toast', app.toast.text === '');
check('结算副标题占位符全部填充', (function () {
  var fmt = require('../js/core/format');
  return String(fmt(copy.resultSub, 1, game.n, game.n)).indexOf('%') === -1;
})());

var R = app.layout.result();
check('结算按钮在安全区内', R.cta.y + R.cta.h <= app.env.height - app.env.safeBottom + 0.5);
check('结算信息卡不与按钮重叠', R.stats.y + R.stats.h < R.cta.y);

tap(R.cta.x + R.cta.w / 2, R.cta.y + R.cta.h / 2);
frames(app, 2);
check('下一关 → 新对局', sceneName(app) === 'game' && app.sm.top().index === 2);
check('新对局计时重置', app.sm.top().elapsed < 0.2, 'elapsed=' + app.sm.top().elapsed.toFixed(2));

var game2 = app.sm.top();
tap(G.back.cx, G.back.cy);
frames(app, 2);
check('对局 → 地图', sceneName(app) === 'levelmap');
check('地图当前关推进到第 2 关', levelsSvc.current(app.progress) === 2);
check('通关第 1 关只解锁第 2 关', app.progress.isUnlocked(2) && !app.progress.isUnlocked(3));

var map2 = app.sm.top();
var nodes2 = map2._computeNodes();
tap(nodes2[1].x, nodes2[1].y);
frames(app, 20);
check('地图 → 第 2 关对局', sceneName(app) === 'game' && app.sm.top().index === 2);

game2 = app.sm.top();
fillSolution(app, game2);
check('无提示无错格 → 3 猫爪', game2.resultInfo && game2.resultInfo.paws === 3);
check('完美加成金币已到账（+30）', app.progress.coins() === 150, 'coins=' + app.progress.coins());
check('第 2 关记录 3 猫爪', (function () {
  var e = app.progress.d().completed['2'];
  return !!e && e.paws === 3;
})());

frames(app, 50);
check('第 2 关也进入结算', sceneName(app) === 'result');
var result2 = app.sm.top();
check('结算展示首通奖励 30', result2.info.coins === 30, 'coins=' + result2.info.coins);

var R2 = app.layout.result();
tap(R2.map.x + R2.map.w / 2, R2.map.y + R2.map.h / 2);
frames(app, 2);
check('结算 → 返回地图', sceneName(app) === 'levelmap');
check('地图当前关推进到第 3 关', levelsSvc.current(app.progress) === 3);
check('通关第 2 关解锁第 3 关', app.progress.isUnlocked(3) && !app.progress.isUnlocked(4));
check('地图可读取历史猫爪评分', app.progress.pawsOf(1) === 1 && app.progress.pawsOf(2) === 3,
  'paws=' + app.progress.pawsOf(1) + '/' + app.progress.pawsOf(2));

// 9×9 关卡：正式包在后续章节，直接从地图压入对局验证大尺寸渲染
var nine = null;
var eight = null;
for (var li = 0; li < levelsSvc.all.length; li++) {
  if (!nine && levelsSvc.all[li].n === 9) nine = levelsSvc.all[li];
  if (!eight && levelsSvc.all[li].n === 8) eight = levelsSvc.all[li];
}
check('关卡包包含 8×8 与 9×9', !!eight && !!nine);
app.sm.push('game', { levelIndex: nine.index });
frames(app, 2);
check('9×9 关卡可进入', sceneName(app) === 'game' && app.sm.top().n === 9,
  'n=' + (app.sm.top().n || '?'));
var G9 = app.layout.game(9);
check('9×9 棋盘不越界', G9.board.y + G9.board.size <= G9.band.y + 0.5,
  'bottom=' + (G9.board.y + G9.board.size).toFixed(1) + ' band=' + G9.band.y.toFixed(1));
check('9×9 格子边长 ≥ 28px', G9.geom.tile >= 28, 'tile=' + G9.geom.tile.toFixed(1));
check('9×9 使用单行规则条', G9.collapsed === true);
var G8 = app.layout.game(8);
check('8×8 棋盘布局可用', G8.board.y + G8.board.size <= G8.band.y + 0.5 &&
  G8.geom.tile >= 28, 'tile=' + G8.geom.tile.toFixed(1));
frames(app, 5);

/* ---------------- 6. 存档 ---------------- */

console.log('[6] 存档');
app.save.flushHard();
check('主槽已写入', !!store['md:save:v1']);

var Save = require('../js/services/save');
var save2 = new Save();
var data2 = save2.load();
check('重新载入后进度仍在', !!data2.completed['1'] && !!data2.completed['2']);
check('重新载入后猫爪仍在', data2.completed['1'].paws === 1 && data2.completed['2'].paws === 3);
check('重新载入后最佳用时仍在', data2.completed['2'].bestTimeMs > 0);
check('重新载入后资源仍在', data2.coins === 150 && data2.tickets === 2,
  'coins=' + data2.coins + ' tickets=' + data2.tickets);
check('统计包含提示与对局时长', data2.stats.hintsUsed === 1 && data2.stats.playedMs > 0);
check('schema 校验生效', data2.schema === 2);

var save3 = new Save();
store['md:save:v1'] = 'not-json-object';
save3.load();
check('主槽损坏时回退备份', save3.data.schema === 2 && !!save3.data.completed['2']);
store['md:save:v1'] = app.save.data;

// schema 1（旧 200 关）→ schema 2（300 关）：完成记录/解锁前沿按稳定 ID 迁移
var m1 = levelsIndex.indexOfId('L001');
var m2 = levelsIndex.indexOfId('L002');
var m3 = levelsIndex.indexOfId('L003');
var migrated = Save.normalize({
  schema: 1,
  coins: 77,
  tickets: 2,
  unlocked: 4,
  lastLevel: 3,
  completed: {
    '1': { at: 1, tries: 1, paws: 2, bestTimeMs: 1000 },
    '2': { at: 2, tries: 1, paws: 3, bestTimeMs: 900 },
    '3': { at: 3, tries: 1, paws: 1, bestTimeMs: 800 }
  },
  stats: { catsPlaced: 10 }
});
check('旧档 schema1 迁移到 schema2', migrated.schema === 2 && migrated.coins === 77);
check('旧档完成记录按关卡 ID 重映射', !!migrated.completed[m1] && !!migrated.completed[m2] &&
  !!migrated.completed[m3] && migrated.completed[m2].paws === 3,
  'mapped=' + m1 + ',' + m2 + ',' + m3);
check('旧档解锁前沿按 ID 映射', migrated.unlocked === m3 + 1, 'unlocked=' + migrated.unlocked);
check('旧档 lastLevel 按 ID 映射', migrated.lastLevel === m3, 'last=' + migrated.lastLevel);

var fullLegacy = Save.normalize({
  schema: 1,
  unlocked: 201,
  lastLevel: 200,
  completed: { '200': { at: 1, tries: 1, paws: 3, bestTimeMs: 5000 } }
});
check('旧档全通后解锁到 L200 的新位置之后',
  fullLegacy.unlocked === levelsIndex.indexOfId('L200') + 1,
  'unlocked=' + fullLegacy.unlocked + ' L200@' + levelsIndex.indexOfId('L200'));

var lv1 = levelsIndex.get(1);
var cleanCells = [];
for (var ci = 0; ci < lv1.n * lv1.n; ci++) cleanCells.push(ci % 3);
var resumedData = Save.normalize({
  schema: 2,
  resume: { index: 1, n: lv1.n, cells: cleanCells, timeMs: 1234, moves: 5, mistakes: 1, hintsUsed: 0 }
});
check('合法续玩数据可通过存档校验', resumedData.resume.index === 1 &&
  resumedData.resume.cells.length === lv1.n * lv1.n && resumedData.resume.timeMs === 1234 &&
  resumedData.resume.moves === 5);
var badResumeData = Save.normalize({
  schema: 2,
  resume: { index: 1, n: lv1.n, cells: [9, 9], timeMs: 1, moves: 1, mistakes: 0, hintsUsed: 0 }
});
check('非法续玩数据被丢弃', badResumeData.resume.index === 0 && badResumeData.resume.cells.length === 0);

/* ---------------- 7. 返回与调试浮层 ---------------- */

console.log('[7] 返回、章节与调试');
frames(app, 1);
var game9L = app.sm.top().L;
tap(game9L.back.cx, game9L.back.cy);
frames(app, 2);
check('9×9 对局 → 地图', sceneName(app) === 'levelmap');

var map3 = app.sm.top();
map3.render(app.renderer);
var mapL = map3.L;
tap(map3.nextC.cx, map3.nextC.cy);
map3.render(app.renderer);
check('地图可切到第 2 章', map3.chapter === 2 && map3._computeNodes()[0].index === 21,
  'chapter=' + map3.chapter);
check('未通关章节的节点仍锁定', !app.progress.isUnlocked(21));
tap(map3.prevC.cx, map3.prevC.cy);
map3.render(app.renderer);
check('地图可切回第 1 章', map3.chapter === 1 && map3._computeNodes()[0].index === 1);

map3.chapter = 15;
map3.render(app.renderer);
check('第 15 章节点 281–300', map3._computeNodes()[0].index === 281 &&
  map3._computeNodes()[19].index === 300);
map3.chapter = 1;

tap(mapL.back.cx, mapL.back.cy);
frames(app, 2);
check('地图 → 首页', sceneName(app) === 'home');

var HL = app.layout.home();
for (var t = 0; t < 5; t++) tap(app.env.width / 2, HL.footerY - 4);
check('连点版本号开启调试浮层', app.debug.on === true);
frames(app, 5);
app.debug.setEnabled(false);

/* ---------------- 8. 小屏布局 ---------------- */

console.log('[8] 320×568 小屏布局');
var Layout = require('../js/ui/layout');
var small = new Layout({ width: 320, height: 568, dpr: 2, safeTop: 20, safeBottom: 0 });
var SG = small.game(7);
check('小屏棋盘不越界', SG.board.y + SG.board.size <= SG.band.y + 0.5,
  'bottom=' + (SG.board.y + SG.board.size).toFixed(1) + ' band=' + SG.band.y.toFixed(1));
check('小屏缩放被限制在 0.9~1.15', small.s >= 0.9 && small.s <= 1.15, 's=' + small.s);
check('小屏图例不溢出', small.game(9).legend.item >= 14, 'item=' + small.game(9).legend.item.toFixed(1));

var SR = small.result();
check('小屏结算主按钮在屏内', SR.cta.y + SR.cta.h <= 568 + 0.5);
check('小屏结算次按钮在屏内', SR.map.y + SR.map.h <= 568 + 0.5);
check('小屏结算信息卡不与按钮重叠', SR.stats.y + SR.stats.h < SR.cta.y);
check('小屏三爪横排放得下', SR.paws.size * 3 + SR.paws.gap * 2 <= 320);

var S4 = small.game(4);
check('小屏 4×4 棋盘不越界', S4.board.y + S4.board.size <= S4.band.y + 0.5);
check('小屏 4×4 格子边长 ≥ 40px', S4.geom.tile >= 40, 'tile=' + S4.geom.tile.toFixed(1));

var S8 = small.game(8);
check('小屏 8×8 棋盘不越界', S8.board.y + S8.board.size <= S8.band.y + 0.5,
  'bottom=' + (S8.board.y + S8.board.size).toFixed(1) + ' band=' + S8.band.y.toFixed(1));
check('小屏 8×8 格子边长 ≥ 24px', S8.geom.tile >= 24, 'tile=' + S8.geom.tile.toFixed(1));
check('小屏 8×8 图例不溢出', S8.legend.item * 8 + S8.legend.gap * 7 <= 320,
  'legend=' + (S8.legend.item * 8 + S8.legend.gap * 7).toFixed(1));

var S9 = small.game(9);
check('小屏 9×9 棋盘不越界', S9.board.y + S9.board.size <= S9.band.y + 0.5,
  'bottom=' + (S9.board.y + S9.board.size).toFixed(1) + ' band=' + S9.band.y.toFixed(1));
check('小屏 9×9 格子边长 ≥ 24px', S9.geom.tile >= 24, 'tile=' + S9.geom.tile.toFixed(1));
check('小屏 9×9 图例不溢出', S9.legend.item * 9 + S9.legend.gap * 8 <= 320,
  'legend=' + (S9.legend.item * 9 + S9.legend.gap * 8).toFixed(1));

/* ---------------- 9. 连续帧 ---------------- */

console.log('[9] 连续渲染');
var f0 = Date.now();
try {
  frames(app, 300);
  check('300 帧无异常', true);
} catch (e) {
  check('300 帧无异常', false, e.message);
}
check('300 帧耗时 < 1500ms（桩渲染）', Date.now() - f0 < 1500, (Date.now() - f0) + 'ms');

/* ---------------- 汇总 ---------------- */

console.log('');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项，用时 ' + (Date.now() - t0) + 'ms');
if (failed) {
  process.exitCode = 1;
} else {
  console.log('冒烟测试通过');
}
