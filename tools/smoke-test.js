#!/usr/bin/env node
/**
 * 冒烟测试（Node 环境，不依赖微信开发者工具）。
 *
 * 覆盖：
 *   4×4–9×9 正式关卡包（唯一解/档位/去重/紧凑解码）/ 运行时规则判胜 /
 *   三场景+结算渲染 / 触摸交互 / 提示与资源 / 重开与冲突反馈 /
 *   计时与猫爪评分 / 结算奖励与导航 / 存档落盘与重载 /
 *   S5 每日挑战/签到/图鉴/成就/商店 服务与页面流程 / 小屏布局
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

function FakeCtx() { this.ops = 0; this.texts = []; }
['setTransform', 'clearRect', 'fillRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'arcTo', 'arc', 'rect', 'clip', 'fill', 'stroke', 'save', 'restore',
  'quadraticCurveTo', 'bezierCurveTo', 'translate', 'scale', 'rotate'].forEach(function (m) {
  FakeCtx.prototype[m] = function () { this.ops++; };
});
// 记录最近一帧实际绘制的文字，便于检查占位符/undefined 等文案问题
FakeCtx.prototype.clearRect = function () { this.ops++; this.texts.length = 0; };
FakeCtx.prototype.fillText = function (s) { this.ops++; this.texts.push(String(s)); };
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
  getMenuButtonBoundingClientRect: function () {
    return { width: 87, height: 32, top: 48, right: 365, bottom: 80, left: 278 };
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
check('稳定 ID 可跨重排查询', levelsIndex.indexOfId('E001') === 1 &&
  levelsIndex.indexOfId('L031') > 0 && levelsIndex.indexOfId('L001') === 0 &&
  levelsIndex.indexOfId('L999') === 0,
  'L031→' + levelsIndex.indexOfId('L031') + ' L001→' + levelsIndex.indexOfId('L001'));
check('尺寸覆盖 4/5/6/7/8/9', (function () {
  var set = {};
  for (var k = 0; k < pack.levels.length; k++) set[pack.levels[k].n] = true;
  return set[4] && set[5] && set[6] && set[7] && set[8] && set[9];
})());
check('首关为 4×4 教学关', levelsIndex.get(1).n === 4, 'n=' + levelsIndex.get(1).n);
check('前 10 关均为 4×4 / T1 / 零分支', (function () {
  for (var k = 0; k < 10; k++) {
    var l = pack.levels[k];
    if (l.n !== 4 || l.t !== 1 || l.b !== 0) return false;
  }
  return true;
})(), pack.levels.slice(0, 10).map(function (l) {
  return l.n + '/' + l.t + '/' + l.d + '/' + l.b;
}).join(' '));
check('前 30 关稳定 ID 为 E001–E030', (function () {
  for (var k = 0; k < 30; k++) {
    if (!pack.levels[k] || pack.levels[k].id !== 'E' + String(k + 1).padStart(3, '0')) return false;
  }
  return true;
})(), pack.levels[0].id + '…' + pack.levels[29].id);
check('L1–3 预放 3/2/1 只答案猫', (function () {
  for (var k = 0; k < 3; k++) {
    var l = levelsIndex.get(k + 1);
    if (l.givens.length !== 3 - k) return false;
    for (var g = 0; g < l.givens.length; g++) {
      var idx = l.givens[g];
      if (l.solution[Math.floor(idx / l.n)] !== idx % l.n) return false;
    }
  }
  return true;
})());
check('L4 高亮真实突破口，L5 起不再高亮', (function () {
  var l4 = levelsIndex.get(4);
  return l4.focus >= 0 && l4.givens.length === 0 &&
    levelsIndex.get(5).focus === -1;
})());
check('前 30 关难度分不倒挂且全部零分支', (function () {
  var last = -1;
  for (var k = 0; k < 30; k++) {
    var l = pack.levels[k];
    if (l.d < last || l.b !== 0 || l.t !== 1) return false;
    last = l.d;
  }
  return true;
})(), pack.levels.slice(0, 30).map(function (l) { return l.d; }).join(','));
check('第 11 关起进入 5×5', levelsIndex.get(11).n === 5,
  'n=' + levelsIndex.get(11).n);
check('档位分布 30/97/131/24/18', (function () {
  var c = {};
  for (var k = 0; k < pack.levels.length; k++) c[pack.levels[k].t] = (c[pack.levels[k].t] || 0) + 1;
  return c[1] === 30 && c[2] === 97 && c[3] === 131 && c[4] === 24 && c[5] === 18;
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
    var dec = levelsIndex.get(k + 1);
    var a = diff.analyzeDifficulty(l.n, gen.decodeRegionString(l.r, l.n), dec.givens);
    if (!a || a.tier !== l.t || a.score !== l.d || a.branchCount !== l.b) badTier++;
  }
  return badTier === 0;
})());

/* 区域配色：按区域相邻关系取色，保证相邻区域色差足够 */
var regionColors = require('../js/ui/region-colors');
var themeData = require('../js/data/theme');

function regionGridOf(level) {
  var out = [];
  for (var r = 0; r < level.n; r++) {
    for (var c = 0; c < level.n; c++) {
      out.push(level.regions[r].charCodeAt(c) - 97);
    }
  }
  return out;
}

function minAdjacentDeltaE(grid, n, palette) {
  var map = regionColors.assign(grid, n, palette);
  var min = Infinity;
  var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      var g0 = grid[r * n + c];
      for (var d = 0; d < dirs.length; d++) {
        var rr = r + dirs[d][0];
        var cc = c + dirs[d][1];
        if (rr >= n || cc < 0 || cc >= n) continue;
        var g1 = grid[rr * n + cc];
        if (g1 === g0) continue;
        var de = regionColors.deltaE(map[g0], map[g1]);
        if (de < min) min = de;
      }
    }
  }
  return min;
}

check('区域配色按相邻关系分配且结果确定', (function () {
  var lv1 = levelsIndex.get(1);
  var grid = regionGridOf(lv1);
  var a = regionColors.assign(grid, lv1.n, themeData.base.region);
  var b = regionColors.assign(grid, lv1.n, themeData.base.region);
  var seen = {};
  for (var k = 0; k < a.length; k++) seen[a[k]] = true;
  return a.length === lv1.n && Object.keys(seen).length === lv1.n &&
    a.join('|') === b.join('|');
})());

var colorWorst = { de: Infinity, at: '' };
check('全部关卡相邻区域色差 ≥ 30（含皮肤）', (function () {
  var ok = true;
  for (var s = 0; s < themeData.skins.length; s++) {
    var pal = themeData.skins[s].colors;
    for (var k = 0; k < pack.levels.length; k++) {
      var lv = levelsIndex.get(k + 1);
      var de = minAdjacentDeltaE(regionGridOf(lv), lv.n, pal);
      if (de < colorWorst.de) colorWorst = { de: de, at: themeData.skins[s].id + '@' + lv.id };
      if (de < 30) ok = false;
    }
  }
  return ok;
})(), 'worst=' + colorWorst.de.toFixed(1) + ' @ ' + colorWorst.at);

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

// 规则边界：斜对角相邻必须判冲突；同一条斜线但中间隔格不算冲突
var ruleLatin = [];
for (var lr = 0; lr < 5; lr++) {
  for (var lc = 0; lc < 5; lc++) ruleLatin.push((lr + lc) % 5);
}
var diagFull = rulesMod.analyze([0, 6, 12, 18, 24], 5, ruleLatin);
check('五猫全填但斜角相邻仍不通关',
  diagFull.solved === false && diagFull.conflict[0] === true && diagFull.conflict[6] === true,
  'solved=' + diagFull.solved + ' conflict=' + JSON.stringify(diagFull.conflict));
var diagFar = rulesMod.analyze([0, 12], 5, ruleLatin);
check('同一斜线但不相邻不判冲突（只禁相邻）',
  diagFar.conflict[0] !== true && diagFar.conflict[12] !== true,
  JSON.stringify(diagFar.conflict));

/* ---------------- 2. 启动与渲染 ---------------- */

console.log('[2] 启动与三场景渲染');
var App = require('../js/app');
var levelsSvc = require('../js/services/levels');
var copyMod = require('../js/data/copy');
var app = new App();
app.start();
frames(app, 3);
var menuCap = app.env.menu;
var capBottom = menuCap ? menuCap.bottom : 0;
check('首次启动自动展示玩法说明', sceneName(app) === 'guide');
check('玩法说明覆盖首页入栈', app.sm.stack[0] && app.sm.stack[0].sceneName === 'home');
check('玩法说明有绘制调用', app.renderer.ctx.ops > 100, 'ops=' + app.renderer.ctx.ops);
checkNoBadText('玩法说明');
var guideL = app.layout.guide();
check('玩法说明以弹窗展示（不整屏）',
  guideL.card.x > 0 && guideL.card.y > 0 &&
  guideL.card.x + guideL.card.w < app.env.width &&
  guideL.card.y + guideL.card.h < app.env.height,
  'card=' + [guideL.card.x, guideL.card.y, guideL.card.w, guideL.card.h].map(function (v) {
    return v.toFixed(1);
  }).join(','));
check('弹窗下方保留首页画面',
  app.renderer.ctx.texts.indexOf(copyMod.titleMain) !== -1 &&
  app.renderer.ctx.texts.indexOf(copyMod.titleAccent) !== -1 &&
  app.renderer.ctx.texts.indexOf(copyMod.guideTitle) !== -1);
check('玩法说明卡片避开胶囊区', guideL.card.y >= capBottom,
  'cardY=' + guideL.card.y + ' capBottom=' + capBottom);
check('玩法说明按钮在屏内', guideL.cta.y + guideL.cta.h <= 812 + 0.5);
check('规则分页展示，首页不铺全部操作说明',
  app.sm.top().page === 0 &&
  app.renderer.ctx.texts.indexOf(copyMod.guideTap1) === -1 &&
  app.renderer.ctx.texts.indexOf(copyMod.guideGuardLine1) === -1);
tap(guideL.cta.x + guideL.cta.w / 2, guideL.cta.y + guideL.cta.h / 2);
frames(app, 1);
check('第二页展示三态点击', app.sm.top().page === 1 &&
  app.renderer.ctx.texts.indexOf(copyMod.guideTap1) !== -1);
tap(guideL.cta.x + guideL.cta.w / 2, guideL.cta.y + guideL.cta.h / 2);
frames(app, 1);
check('第三页展示新手保护', app.sm.top().page === 2 &&
  app.renderer.ctx.texts.indexOf(copyMod.guideGuardLine1) !== -1);
tap(guideL.cta.x + guideL.cta.w / 2, guideL.cta.y + guideL.cta.h / 2);
frames(app, 2);
check('读完三页关闭玩法说明回到首页', sceneName(app) === 'home');
check('玩法说明已记入存档', app.save.data.guideSeen === true);
check('首页有绘制调用', app.renderer.ctx.ops > 100, 'ops=' + app.renderer.ctx.ops);
check('游戏名称更新为喵喵迷阵',
  copyMod.title === '喵喵迷阵' &&
  require('../js/data/config').APP_NAME === '喵喵迷阵');
var homeFlow = app.layout.home();
check('首页标题胶囊 / 猫咪舞台 / 名牌 / 主按钮 / 三宫格依次排开',
  homeFlow.deco.stage.cy - homeFlow.deco.stage.r >
    homeFlow.kicker.y + homeFlow.kicker.h &&
  homeFlow.catTag.y > homeFlow.deco.stage.cy &&
  homeFlow.catTag.y + homeFlow.catTag.h <= homeFlow.cta.y &&
  homeFlow.cta.y + homeFlow.cta.h <= homeFlow.cards[0].y &&
  homeFlow.cards[0].y + homeFlow.cards[0].h < homeFlow.footerY);
check('新档只解锁第 1 关', app.progress.isUnlocked(1) && !app.progress.isUnlocked(2) &&
  !app.progress.isUnlocked(300));
check('DPR 上限为 2', app.env.dpr === 2, 'dpr=' + app.env.dpr);
check('主画布按 DPR 放大', app.renderer.canvas.width === 750, 'width=' + app.renderer.canvas.width);

/* 微信右上角胶囊：系统绘制在画布之上，游戏顶栏必须整体让开 */
check('读取右上角胶囊区域', !!menuCap && menuCap.left === 278 &&
  menuCap.right === 365 && menuCap.bottom === 80,
  menuCap ? JSON.stringify(menuCap) : 'null');
var capHome = app.layout.home();
function circleTop(c) { return c.cy - c.r; }
check('首页顶栏整体位于胶囊下方', capHome.topBar.y >= capBottom,
  'top=' + capHome.topBar.y + ' capBottom=' + capBottom);
check('首页顶部按钮不与胶囊重叠',
  capHome.coin.y >= capBottom &&
  circleTop(capHome.help) >= capBottom &&
  circleTop(capHome.checkin) >= capBottom &&
  circleTop(capHome.gear) >= capBottom);
var capPage = app.layout.page();
check('子页面页头位于胶囊下方',
  capPage.topBar.y >= capBottom &&
  circleTop(capPage.back) >= capBottom);

var envMod = require('../js/platform/env');
var realMenuApi = wx.getMenuButtonBoundingClientRect;
wx.getMenuButtonBoundingClientRect = function () { throw new Error('unsupported'); };
var noMenuEnv = envMod.read();
wx.getMenuButtonBoundingClientRect = realMenuApi;
var LayoutNoMenu = require('../js/ui/layout');
var noMenuLayout = new LayoutNoMenu(noMenuEnv);
check('胶囊 API 异常时安全降级', noMenuEnv.menu === null &&
  Math.abs(noMenuLayout.topInset() -
    (noMenuEnv.safeTop + 8 * noMenuLayout.s)) < 0.001);

/* ---------------- 3. 页面跳转 ---------------- */

console.log('[3] 导航');
var homeL = app.layout.home();
check('首页保留玩法说明入口', !!homeL.help);
tap(homeL.help.cx, homeL.help.cy);
frames(app, 1);
check('首页可再次打开玩法说明', sceneName(app) === 'guide');
var guideL2 = app.layout.guide();
tap(guideL2.close.cx, guideL2.close.cy);
frames(app, 1);
check('玩法说明关闭按钮返回首页', sceneName(app) === 'home');
tap((menuCap.left + menuCap.right) / 2, (menuCap.top + menuCap.bottom) / 2);
frames(app, 1);
check('点击胶囊区域不会误触游戏顶部按钮',
  sceneName(app) === 'home' && app.toast.text !== copyMod.toastGear,
  'scene=' + sceneName(app) + ' toast=' + app.toast.text);
tap(homeL.cta.x + homeL.cta.w / 2, homeL.cta.y + homeL.cta.h / 2);
frames(app, 1);
check('首页 → 关卡地图', sceneName(app) === 'levelmap');

var mapScene = app.sm.top();
var nodes = mapScene._computeNodes();
check('地图节点数与关卡数一致', nodes.length === 20, '实际 ' + nodes.length);
tap(nodes[0].x, nodes[0].y);
frames(app, 1);
check('地图 → 对局', sceneName(app) === 'game');

var gameL0 = app.sm.top();
check('L1 首次进入展示“带锁的猫”规则卡',
  !!gameL0.coach && gameL0.coach.id === 'given');
frames(app, 5);
check('规则卡显示期间暂停计时', gameL0.elapsed === 0, 'elapsed=' + gameL0.elapsed);
var coachL = app.layout.coach();
check('首次规则卡避开胶囊区', coachL.card.y >= capBottom,
  'cardY=' + coachL.card.y + ' capBottom=' + capBottom);
tap(coachL.cta.x + coachL.cta.w / 2, coachL.cta.y + coachL.cta.h / 2);
frames(app, 2);
check('规则卡读完后关闭', !gameL0.coach &&
  app.progress.coachSeen('given') === true);

var gameLx = app.layout.game(gameL0.n);
check('对局顶栏与按钮均避开胶囊区',
  gameLx.topBar.y >= capBottom &&
  circleTop(gameLx.back) >= capBottom &&
  circleTop(gameLx.help) >= capBottom &&
  circleTop(gameLx.gear) >= capBottom,
  'top=' + gameLx.topBar.y + ' capBottom=' + capBottom);
tap(gameLx.help.cx, gameLx.help.cy);
frames(app, 1);
check('对局内可打开玩法说明', sceneName(app) === 'guide');
var guideL3 = app.layout.guide();
tap(guideL3.close.cx, guideL3.close.cy);
frames(app, 1);
check('关闭说明后回到对局', sceneName(app) === 'game');

/* ---------------- 4. 棋盘交互、计时与提示 ---------------- */

console.log('[4] 对局交互 / 计时 / 提示');
var copy = require('../js/data/copy');

// L1：预放猫只读
var l1 = app.sm.top();
check('L1 预放 3 只猫且都来自答案', (function () {
  if (l1.givens.length !== 3) return false;
  for (var g = 0; g < l1.givens.length; g++) {
    var idx = l1.givens[g];
    if (l1.cells[idx] !== 2) return false;
    if (l1.level.solution[Math.floor(idx / l1.n)] !== idx % l1.n) return false;
  }
  return true;
})());
var givenCell = l1.givens[0];
var movesAtLock = l1.moves;
tapCell(app, l1, Math.floor(givenCell / l1.n), givenCell % l1.n);
check('预放猫点击无效，不能删除', l1.cells[givenCell] === 2 &&
  l1.moves === movesAtLock && app.toast.text === copy.toastGivenLocked,
  'cell=' + l1.cells[givenCell] + ' moves=' + l1.moves + ' toast=' + app.toast.text);

// 引导关：无操作后在正确格显示“点两下”操作引导，阈值随关卡从 3 秒放宽到 10 秒
var tutorialSvc = require('../js/services/tutorial');
var gameCfg = require('../js/data/config');
check('双击引导仅作用于前 10 关', tutorialSvc.isTapHintLevel(1, false) &&
  tutorialSvc.isTapHintLevel(10, false) && !tutorialSvc.isTapHintLevel(11, false) &&
  !tutorialSvc.isTapHintLevel(3, true));
check('双击引导阈值随关卡从 3 秒放宽到 10 秒', (function () {
  if (tutorialSvc.tapHintSeconds(1) !== gameCfg.TAP_HINT_SECONDS_MIN) return false;
  if (tutorialSvc.tapHintSeconds(10) !== gameCfg.TAP_HINT_SECONDS_MAX) return false;
  for (var k = 2; k <= 10; k++) {
    if (tutorialSvc.tapHintSeconds(k) <= tutorialSvc.tapHintSeconds(k - 1)) return false;
  }
  return true;
})(), 'L1=' + tutorialSvc.tapHintSeconds(1) + ' L10=' + tutorialSvc.tapHintSeconds(10));
var l1Wait = tutorialSvc.tapHintSeconds(1);
l1.idleT = l1Wait - 0.1;
check('引导关 3 秒内不显示双击提示', l1._tapHintTarget() === -1,
  'idleT=' + l1.idleT.toFixed(2));
l1.idleT = l1Wait;
var tipIdx = l1._tapHintTarget();
check('3 秒无操作后指向正确落子格', tipIdx >= 0 &&
  l1.level.solution[Math.floor(tipIdx / l1.n)] === tipIdx % l1.n &&
  l1.cells[tipIdx] !== 2,
  'idx=' + tipIdx);
frames(app, 1);
check('双击提示已绘制在棋盘上', app.renderer.ctx.texts.indexOf(copy.tapHintDouble) !== -1,
  'texts=' + app.renderer.ctx.texts.join('/'));

l1._apply(tipIdx, 1, true);
l1.idleT = l1Wait;
frames(app, 1);
check('正确格已打叉时改提示“点一下”',
  app.renderer.ctx.texts.indexOf(copy.tapHintOnce) !== -1 &&
  app.renderer.ctx.texts.indexOf(copy.tapHintDouble) === -1,
  'texts=' + app.renderer.ctx.texts.join('/'));
l1._apply(tipIdx, 0, true);
l1.idleT = 0;

// 锁关：未解锁关卡不能被代码入口直接跳过
app.sm.pop();
frames(app, 1);
var frontierBefore = app.save.data.unlocked;
app.sm.push('game', { levelIndex: 7 });
frames(app, 1);
check('未解锁关卡不能直接进入', sceneName(app) === 'levelmap' &&
  app.toast.text === copy.toastLocked,
  'scene=' + sceneName(app) + ' toast=' + app.toast.text);

// 临时把测试前沿推到第 7 关（无预放、无规则卡），测通用三态交互；
// 第 5 节开始前恢复，继续验证真实解锁链。
app.save.data.unlocked = 7;
app.sm.push('game', { levelIndex: 7 });
frames(app, 1);
var game = app.sm.top();
check('测试前沿允许进入第 7 关', sceneName(app) === 'game' && game.index === 7,
  'scene=' + sceneName(app) + ' index=' + (game && game.index));
var n = game.n;
var G = app.layout.game(n);

check('通用交互关卡无预放/无高亮/无规则卡', game.index === 7 &&
  game.givens.length === 0 && game.focus === -1 && !game.coach);
check('静态棋盘图层已生成', !!game.boardLayer);
check('棋盘不越界（底部色带之上）', G.board.y + G.board.size <= G.band.y + 0.5,
  'bottom=' + (G.board.y + G.board.size).toFixed(1) + ' band=' + G.band.y.toFixed(1));
check('所有棋盘格子边长 ≥ 28px', G.geom.tile >= 28, 'tile=' + G.geom.tile.toFixed(1));

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
check('前 10 关提示免费，不扣提示券', app.progress.tickets() === ticketsBefore,
  'tickets=' + app.progress.tickets());
check('免费提示有明确文案', app.toast.text === copy.toastHintFree,
  'toast=' + app.toast.text);
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
check('提示计入本局统计', game.hintsUsed === 1 &&
  app.progress.d().stats.hintsUsed >= 1);

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

// 恢复测试前沿（第 4 节曾临时推到第 7 关）
app.save.data.unlocked = frontierBefore;

// 回到第 1 关：预放猫 + 免费提示直接补齐最后一只
app.sm.pop();
frames(app, 1);
app.progress.clearResume();
app.sm.push('game', { levelIndex: 1 });
frames(app, 1);
game = app.sm.top();
check('重进 L1 仍保留预放猫，且规则卡不再重复', game.givens.length === 3 &&
  countCells(game, 2) === 3 && !game.coach);
var l1Tickets = app.progress.tickets();
var l1Hint = game.L.tools[2];
tap(l1Hint.cx, l1Hint.cy);
check('L1 免费提示不扣券', app.progress.tickets() === l1Tickets);
check('按答案摆放后判定通关', game.solvedFlag === true);
check('通关时空白格自动补成 X', game.cells.every(function (v) { return v !== 0; }),
  'cells=' + game.cells.join(''));
check('补 X 不影响猫数量与通关判定',
  countCells(game, 2) === game.n && game.solvedFlag === true,
  'cats=' + countCells(game, 2));
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
check('结算数据含步数', result.info.moves === game.moves, 'moves=' + result.info.moves);
check('结算页不残留提示 toast', app.toast.text === '');
check('结算副标题占位符全部填充', (function () {
  var fmt = require('../js/core/format');
  return String(fmt(copy.resultSub, 1, game.n, game.n)).indexOf('%') === -1;
})());

var R = app.layout.result();
check('结算按钮在安全区内', R.cta.y + R.cta.h <= app.env.height - app.env.safeBottom + 0.5);
check('结算信息卡不与按钮重叠', R.stats.y + R.stats.h < R.cta.y);
check('结算内容避开胶囊区', R.cat.cy - R.cat.r >= capBottom,
  'catTop=' + (R.cat.cy - R.cat.r) + ' capBottom=' + capBottom);

tap(R.cta.x + R.cta.w / 2, R.cta.y + R.cta.h / 2);
frames(app, 2);
check('下一关 → 新对局', sceneName(app) === 'game' && app.sm.top().index === 2);
check('新对局计时重置', app.sm.top().elapsed < 0.2, 'elapsed=' + app.sm.top().elapsed.toFixed(2));

var game2 = app.sm.top();
check('L2 规则卡换成“行列各一只”', !!game2.coach && game2.coach.id === 'rowcol');
if (game2.coach) {
  var coach2 = app.layout.coach();
  tap(coach2.cta.x + coach2.cta.w / 2, coach2.cta.y + coach2.cta.h / 2);
  frames(app, 1);
}
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

// 结算页“下一关”守卫：解锁前沿未覆盖时不能越关
app.sm.push('result', { levelIndex: 3, nextIndex: 999 });
frames(app, 1);
var guardResult = app.sm.top();
check('结算页可构造锁定目标', sceneName(app) === 'result' &&
  guardResult.info.nextIndex === 999);
guardResult._next();
frames(app, 1);
check('结算页不能跳到未解锁关卡', sceneName(app) === 'levelmap' &&
  app.toast.text === copy.toastLocked,
  'scene=' + sceneName(app) + ' toast=' + app.toast.text);

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
check('未解锁的 9×9 关卡不能直接进入', sceneName(app) === 'levelmap' &&
  app.toast.text === copy.toastLocked,
  'scene=' + sceneName(app) + ' toast=' + app.toast.text);

var nineFrontier = app.save.data.unlocked;
app.save.data.unlocked = nine.index;
app.sm.push('game', { levelIndex: nine.index });
frames(app, 2);
check('前沿覆盖后 9×9 关卡可进入', sceneName(app) === 'game' && app.sm.top().n === 9,
  'n=' + (app.sm.top().n || '?'));
app.save.data.unlocked = nineFrontier;
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
check('重新载入后资源仍在（教学提示免费）', data2.coins === 150 && data2.tickets === 3,
  'coins=' + data2.coins + ' tickets=' + data2.tickets);
check('统计包含提示与对局时长', data2.stats.hintsUsed === 2 && data2.stats.playedMs > 0,
  'hints=' + data2.stats.hintsUsed);
check('schema 校验生效', data2.schema === 4);

var save3 = new Save();
store['md:save:v1'] = 'not-json-object';
save3.load();
check('主槽损坏时回退备份', save3.data.schema === 4 && !!save3.data.completed['2']);
store['md:save:v1'] = app.save.data;

// schema 1（旧 200 关）→ schema 4：旧前 30 关已被教学曲线替换
var dropped = Save.normalize({
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
check('旧档 schema1 迁移到 schema4', dropped.schema === 4 && dropped.coins === 77);
check('旧档前 30 关不误挂到新题面', Object.keys(dropped.completed).length === 0 &&
  dropped.unlocked === 31 && dropped.lastLevel === 1,
  'completed=' + Object.keys(dropped.completed).length +
  ' unlocked=' + dropped.unlocked + ' last=' + dropped.lastLevel);

// 保留内容的旧关（L031 起）仍按稳定 ID 映射
var m1 = levelsIndex.indexOfId('L031');
var m2 = levelsIndex.indexOfId('L032');
var m3 = levelsIndex.indexOfId('L033');
var migrated = Save.normalize({
  schema: 1,
  coins: 77,
  unlocked: 34,
  lastLevel: 33,
  completed: {
    '31': { at: 1, tries: 1, paws: 2, bestTimeMs: 1000 },
    '32': { at: 2, tries: 1, paws: 3, bestTimeMs: 900 },
    '33': { at: 3, tries: 1, paws: 1, bestTimeMs: 800 }
  }
});
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

// schema 2/3 的续玩下标是旧播放序号：31 → legacy-order[30] → 新序号
var legacyOrder = require('../levels/legacy-order');
var oldResumeIndex = 31;
var legacyId = legacyOrder[oldResumeIndex - 1];
var lvResumeIndex = levelsIndex.indexOfId(legacyId);
var lvResume = levelsIndex.get(lvResumeIndex);
var cleanCells = [];
for (var ci = 0; ci < lvResume.n * lvResume.n; ci++) cleanCells.push(ci % 3);
var resumedData = Save.normalize({
  schema: 2,
  resume: { index: oldResumeIndex, n: lvResume.n, cells: cleanCells,
    timeMs: 1234, moves: 5, mistakes: 1, hintsUsed: 0 }
});
check('合法续玩数据可通过存档校验', resumedData.resume.index === lvResumeIndex &&
  resumedData.resume.cells.length === lvResume.n * lvResume.n && resumedData.resume.timeMs === 1234 &&
  resumedData.resume.moves === 5,
  'legacy=' + legacyId + ' new=' + lvResumeIndex);
var badResumeData = Save.normalize({
  schema: 2,
  resume: { index: oldResumeIndex, n: lvResume.n, cells: [9, 9],
    timeMs: 1, moves: 1, mistakes: 0, hintsUsed: 0 }
});
check('非法续玩数据被丢弃', badResumeData.resume.index === 0 && badResumeData.resume.cells.length === 0);

/* ---------------- 6b. S5 服务层 ---------------- */

console.log('[6b] S5 服务层（每日 / 签到 / 图鉴 / 成就 / 商店）');
(function () {
  var clock = require('../js/core/clock');
  var date = require('../js/core/date');
  var config = require('../js/data/config');
  var ProgressSvc = require('../js/services/progress');
  var DailySvc = require('../js/services/daily');
  var SigninSvc = require('../js/services/signin');
  var CollectionSvc = require('../js/services/collection');
  var AchievementsSvc = require('../js/services/achievements');
  var ShopSvc = require('../js/services/shop');
  var catData = require('../js/data/cats');
  var dailyRaw = require('../levels/daily-365');

  function makeS5(seed) {
    var save = {
      data: Save.defaults(),
      dirty: false,
      touch: function () { this.dirty = true; }
    };
    if (seed) {
      for (var k in seed) {
        if (seed.hasOwnProperty(k)) save.data[k] = seed[k];
      }
    }
    var progress = new ProgressSvc(save);
    var daily = new DailySvc(progress);
    var signin = new SigninSvc(progress, daily);
    var collection = new CollectionSvc(progress);
    var achievements = new AchievementsSvc(progress, collection);
    var shop = new ShopSvc(progress);
    return {
      save: save,
      progress: progress,
      daily: daily,
      signin: signin,
      collection: collection,
      achievements: achievements,
      shop: shop
    };
  }

  var REAL_NOW = function () { return Date.now(); };
  function at(y, m, d, h) {
    return new Date(y, m - 1, d, h || 10, 0, 0, 0).getTime();
  }
  function setDay(y, m, d) {
    clock.setSource(function () { return at(y, m, d); });
  }

  try {
    /* ---- 日历题库与选关 ---- */
    check('每日题库 365 道（312 T3 + 53 T4）',
      dailyRaw.t3.length === 312 && dailyRaw.t4.length === 53,
      't3=' + dailyRaw.t3.length + ' t4=' + dailyRaw.t4.length);
    check('每日题 ID 全库唯一', (function () {
      var seen = {};
      var dup = 0;
      var pools = [dailyRaw.t3, dailyRaw.t4];
      for (var p = 0; p < pools.length; p++) {
        for (var i = 0; i < pools[p].length; i++) {
          if (seen[pools[p][i].id]) dup++;
          seen[pools[p][i].id] = true;
        }
      }
      return dup === 0;
    })());

    var poolSvc = makeS5();
    var sameA = poolSvc.daily.level('2026-11-19');
    var sameB = poolSvc.daily.level('2026-11-19');
    check('同一日期取题稳定（全设备同题）', sameA && sameB && sameA.id === sameB.id &&
      sameA.dailySlot === sameB.dailySlot, 'id=' + (sameA && sameA.id));
    check('周日使用 T4 池', date.isSunday('2026-11-22') &&
      poolSvc.daily.level('2026-11-22').dailyPool === 't4');
    check('工作日使用 T3 池', poolSvc.daily.level('2026-11-19').dailyPool === 't3');

    var poolLevel = poolSvc.daily.level('2026-11-19');
    var poolCats = [];
    for (var pr = 0; pr < poolLevel.n; pr++) poolCats.push(pr * poolLevel.n + poolLevel.solution[pr]);
    check('每日题面解码后可通过运行时规则',
      rulesMod.analyze(poolCats, poolLevel.n,
        runtimeGen.decodeRegions(poolLevel.regions, poolLevel.n)).solved);

    /* ---- 每日挑战：发奖 / 连胜 / 重玩 ---- */
    var dl = makeS5();
    var dlCoins0 = dl.progress.coins();
    setDay(2026, 11, 17);
    var day1 = dl.daily.complete({ timeMs: 60000, paws: 3 });
    check('每日首通发基础金币与连胜加成',
      day1.ok && day1.streak === 1 &&
      day1.coins === config.DAILY_BASE_COINS + config.DAILY_STREAK_STEP,
      'coins=' + day1.coins);
    check('每日通关发放 1–2 枚碎片',
      day1.fragments >= config.DAILY_FRAGMENT_MIN && day1.fragments <= config.DAILY_FRAGMENT_MAX,
      'fragments=' + day1.fragments);
    check('每日奖励到账并写入历史',
      dl.progress.coins() === dlCoins0 + day1.coins &&
      dl.progress.fragments() === day1.fragments && dl.daily.isCleared('2026-11-17'));

    var replaySameDay = dl.daily.complete({ timeMs: 1, paws: 3 });
    check('同日重玩不重复发奖',
      replaySameDay.replay === true && replaySameDay.coins === 0 &&
      dl.progress.coins() === dlCoins0 + day1.coins);

    setDay(2026, 11, 18);
    var day2 = dl.daily.complete({ timeMs: 50000, paws: 3 });
    check('连续第二天连胜 +1，奖励递增',
      day2.ok && day2.streak === 2 &&
      day2.coins === config.DAILY_BASE_COINS + config.DAILY_STREAK_STEP * 2,
      'streak=' + day2.streak + ' coins=' + day2.coins);

    setDay(2026, 11, 19);
    var day3 = dl.daily.complete({ timeMs: 40000, paws: 3 });
    check('连续第三天累计连胜与最佳', day3.streak === 3 && dl.daily.bestStreak() === 3 &&
      dl.daily.totalDays() === 3);

    setDay(2026, 11, 21);
    var broken = dl.daily.complete({ timeMs: 30000, paws: 3 });
    check('跳过一天后连胜重置为 1', broken.streak === 1 && broken.coins ===
      config.DAILY_BASE_COINS + config.DAILY_STREAK_STEP, 'streak=' + broken.streak);
    check('历史只保留已通关日期', Object.keys(dl.save.data.daily.history).length === 4);

    /* ---- 改时间：止损式守护 ---- */
    var guard = makeS5();
    setDay(2026, 11, 20);
    guard.daily.complete({ timeMs: 1000, paws: 1 });
    var guardCoins = guard.progress.coins();
    setDay(2026, 11, 19);
    var gRes = guard.daily.complete({ timeMs: 1000, paws: 3 });
    check('时钟回拨当天不发奖、不计连胜',
      gRes.ok === false && gRes.guarded === true && guard.daily.guarded() &&
      guard.progress.coins() === guardCoins);
    setDay(2026, 11, 21);
    check('回拨守护只标记当天', guard.daily.guarded() === false);
    var gNext = guard.daily.complete({ timeMs: 1000, paws: 3 });
    check('次日恢复正常发奖', gNext.ok === true && gNext.guarded === false);

    /* ---- 签到：7 日循环 / 里程碑 / 补签 ---- */
    var si = makeS5();
    var R = config.SIGNIN_REWARDS;
    var siCoins0 = si.progress.coins();
    var siTickets0 = si.progress.tickets();
    var siFrags0 = si.progress.fragments();

    setDay(2026, 11, 10);
    var c1 = si.signin.claim();
    check('签到第 1 天领取', c1.ok && c1.day === 1 && c1.streak === 1 &&
      si.progress.coins() === siCoins0 + R[0].coins, 'coins=' + si.progress.coins());
    setDay(2026, 11, 11);
    var c2 = si.signin.claim();
    check('签到第 2 天连续', c2.ok && c2.day === 2 && c2.streak === 2);
    setDay(2026, 11, 12);
    var c3 = si.signin.claim();
    check('签到第 3 天发提示券', c3.ok && c3.day === 3 && c3.tickets === 1 &&
      si.progress.tickets() === siTickets0 + 1);
    setDay(2026, 11, 13);
    si.signin.claim();
    setDay(2026, 11, 14);
    si.signin.claim();
    setDay(2026, 11, 15);
    si.signin.claim();
    setDay(2026, 11, 16);
    var c7 = si.signin.claim();

    var expectedCoins = siCoins0;
    for (var i = 0; i < 7; i++) expectedCoins += R[i].coins;
    expectedCoins += 50; // 7 日累计里程碑
    check('签到第 7 天发金币/券/碎片并触发里程碑',
      c7.ok && c7.day === 7 && c7.fragments === 1 && c7.tickets === 1 &&
      c7.milestones.length === 1 && c7.milestones[0].days === 7,
      'milestones=' + c7.milestones.length);
    check('签到 7 日总账正确',
      si.progress.coins() === expectedCoins &&
      si.progress.tickets() === siTickets0 + 3 &&
      si.progress.fragments() === siFrags0 + 1,
      'coins=' + si.progress.coins() + ' tickets=' + si.progress.tickets());
    check('里程碑不可重复领取', si.signin.milestones()[0].claimed === true &&
      si.save.data.signin.claimedMilestones['7'] === true);
    check('7 日循环全部标记已完成', si.signin.week().every(function (w) { return w.done; }));

    // 漏签 1 天：需补签卡，补签后连续；本周第二次补签受限
    setDay(2026, 11, 18);
    var missSt = si.signin.status();
    check('漏签 1 天且无卡时不能补签',
      missSt.gap === 2 && missSt.missed === true && missSt.canMakeup === false &&
      missSt.makeupCards === 0);
    si.progress.addMakeupCards(1);
    check('有补签卡后允许补签', si.signin.status().canMakeup === true);
    var mk = si.signin.makeup();
    check('补签昨天并消耗 1 张卡', mk.ok && mk.day === 1 && mk.streak === 8 &&
      si.progress.makeupCards() === 0 &&
      si.save.data.signin.lastDate === '2026-11-17' &&
      si.save.data.signin.history['2026-11-17'].makeup === 1,
      'streak=' + mk.streak);
    var c18 = si.signin.claim();
    check('补签后当天继续连续', c18.ok && c18.day === 2 && c18.streak === 9 &&
      si.signin.status().totalDays === 9);
    setDay(2026, 11, 19);
    si.signin.claim();
    setDay(2026, 11, 21);
    si.progress.addMakeupCards(1);
    var weekSt = si.signin.status();
    check('同一自然周补签次数受限',
      weekSt.gap === 2 && weekSt.canMakeup === false && weekSt.makeupCards === 1);
    check('超限时补签接口拒绝', si.signin.makeup().ok === false);

    // 漏签多天：补签不处理，重新从第 1 天开始
    var si2 = makeS5();
    setDay(2026, 11, 10);
    si2.signin.claim();
    setDay(2026, 11, 13);
    check('漏签多天标记 missed', si2.signin.status().missed === true);
    var resetClaim = si2.signin.claim();
    check('漏签多天后签到从第 1 天重新开始',
      resetClaim.ok && resetClaim.day === 1 && resetClaim.streak === 1);

    // 改时间守护：签到同样受 daily 回拨标记保护
    var si3 = makeS5();
    setDay(2026, 11, 10);
    si3.signin.claim();
    var si3Coins = si3.progress.coins();
    setDay(2026, 11, 12);
    si3.daily.noteSeen();
    setDay(2026, 11, 11);
    var blocked = si3.signin.claim();
    check('时钟回拨当天签到不发奖',
      blocked.ok === false && blocked.reason === 'guarded' &&
      si3.progress.coins() === si3Coins);

    /* ---- 图鉴：阈值 / 出战 / 合成 ---- */
    var col = makeS5();
    check('初始无猫解锁', col.collection.refresh().length === 0 && col.collection.count() === 0);
    for (var ci = 1; ci <= 29; ci++) col.progress.completeLevel(ci, { paws: 1, timeMs: 1000 });
    col.collection.refresh();
    check('通关 1 关解锁墨墨并自动出战',
      col.collection.isUnlocked('mo') && col.collection.equippedId() === 'mo');
    check('29 关时未提前解锁奶糖', !col.collection.isUnlocked('naitang'));
    col.progress.completeLevel(30, { paws: 1, timeMs: 1000 });
    col.collection.refresh();
    check('满 30 关精确解锁奶糖', col.collection.isUnlocked('naitang'));
    check('未到 60 关的橘座仍锁定', !col.collection.isUnlocked('juzuo'));

    col.save.data.signin.totalDays = 7;
    col.collection.refresh();
    check('签到 7 天解锁抹茶', col.collection.isUnlocked('mocha'));
    col.save.data.daily.total = 7;
    col.collection.refresh();
    check('每日 7 天解锁奶茶', col.collection.isUnlocked('naicha'));
    for (var ai = 0; ai < 6; ai++) {
      col.save.data.achievements[config.ACHIEVEMENTS[ai].id] = { unlockedAt: 1, claimedAt: 0 };
    }
    col.collection.refresh();
    check('达成 6 个成就解锁乌云', col.collection.isUnlocked('wuyun'));

    col.save.data.fragments = 2;
    var craftFail = col.collection.craft('jiaotang');
    check('碎片不足不能合成', craftFail.ok === false && craftFail.reason === 'fragments');
    col.progress.addFragments(1);
    var craftOk = col.collection.craft('jiaotang');
    check('3 碎片合成焦糖并扣除碎片',
      craftOk.ok && col.collection.isUnlocked('jiaotang') && col.progress.fragments() === 0);
    check('已解锁猫不可重复合成', col.collection.craft('jiaotang').reason === 'owned');
    check('非合成猫不可合成', col.collection.craft('juzuo').reason === 'not_craft');
    check('可切换已解锁的出战猫',
      col.collection.equip('naitang') && col.collection.equippedCat().id === 'naitang');
    check('未解锁猫不能出战', col.collection.equip('yecha') === false);
    check('图鉴共 16 只', col.collection.total() === 16 && catData.all.length === 16);

    /* ---- 成就：只标记，手动领取 ---- */
    var ac = makeS5();
    ac.progress.completeLevel(1, { paws: 2, timeMs: 1000 });
    var achCoins0 = ac.progress.coins();
    ac.achievements.check();
    check('首通成就自动标记', ac.achievements.isUnlocked('first_clear'));
    check('标记成就不自动发金币', ac.progress.coins() === achCoins0);
    var claimA = ac.achievements.claim('first_clear');
    check('手动领取成就发奖', claimA.ok && claimA.coins === 50 &&
      ac.progress.coins() === achCoins0 + 50);
    check('成就不可重复领取', ac.achievements.claim('first_clear').reason === 'claimed');
    check('未达成成就不可领取', ac.achievements.claim('clear_50').reason === 'locked');

    for (var pi = 1; pi <= 20; pi++) ac.progress.completeLevel(pi, { paws: 3, timeMs: 1000 });
    ac.achievements.check();
    check('20 个三爪成就达成', ac.achievements.isUnlocked('perfect_20'));
    check('成就进度按目标封顶',
      ac.achievements.progressOf(ac.achievements.getDef('clear_50')).current === 20);

    for (var si2i = 0; si2i < 8; si2i++) ac.save.data.collection.unlocked[catData.all[si2i].id] = 1;
    ac.save.data.daily.total = 7;
    ac.save.data.signin.totalDays = 7;
    var coinsBeforeBatch = ac.progress.coins();
    ac.achievements.check();
    check('图鉴 / 每日 / 签到成就达成',
      ac.achievements.isUnlocked('collection_8') &&
      ac.achievements.isUnlocked('daily_7') &&
      ac.achievements.isUnlocked('signin_7'));
    check('批量标记仍不发金币', ac.progress.coins() === coinsBeforeBatch);
    var ticketsBeforeClaim = ac.progress.tickets();
    var claimP = ac.achievements.claim('perfect_20');
    check('带券成就领取同时发券',
      claimP.ok && claimP.tickets === 1 && ac.progress.tickets() === ticketsBeforeClaim + 1);

    /* ---- 商店：扣币 / 售罄 / 换肤 ---- */
    var sh = makeS5();
    var shCoins = sh.progress.coins();
    var shTickets = sh.progress.tickets();
    var buyTicket = sh.shop.buy('ticket');
    check('商店购买提示券',
      buyTicket.ok && sh.progress.tickets() === shTickets + 1 &&
      sh.progress.coins() === shCoins - 45);
    var shCoinsAfter = sh.progress.coins();
    var buyPoor = sh.shop.buy('makeup');
    check('金币不足时购买失败且不扣款',
      buyPoor.ok === false && buyPoor.reason === 'coins' &&
      sh.progress.coins() === shCoinsAfter && sh.progress.makeupCards() === 0);

    var sh2 = makeS5({ coins: 1200 });
    var m1 = sh2.shop.buy('skin-mint');
    check('购买皮肤并立即使用',
      m1.ok && sh2.progress.coins() === 900 &&
      sh2.shop.ownsSkin('skin-mint') && sh2.progress.currentSkin() === 'skin-mint');
    check('已拥有皮肤不再出售', sh2.shop.isSoldOut(sh2.shop.item('skin-mint')) &&
      sh2.shop.buy('skin-mint').reason === 'owned');
    check('可切回已拥有的基础皮肤', sh2.shop.useSkin('cream') &&
      sh2.progress.currentSkin() === 'cream');
    check('未拥有皮肤不能使用', sh2.shop.useSkin('skin-night') === false);
    var night = sh2.shop.buy('skin-night');
    check('购买第二款皮肤切换成功',
      night.ok && sh2.progress.coins() === 100 &&
      sh2.progress.currentSkin() === 'skin-night');
    var makeupBuy = sh2.shop.buy('makeup');
    check('购买补签卡并清空余额',
      makeupBuy.ok && sh2.progress.coins() === 0 && sh2.progress.makeupCards() === 1);
    check('所有货币始终非负',
      sh2.progress.coins() >= 0 && sh2.progress.tickets() >= 0 &&
      sh2.progress.makeupCards() >= 0 && sh2.progress.fragments() >= 0);
    check('商店共 5 个商品', sh.shop.items().length === 5);
  } finally {
    clock.setSource(REAL_NOW);
  }
})();

/* ---------------- 6c. S5 存档 ---------------- */

console.log('[6c] S5 存档迁移与清洗');
check('默认 schema 为 4', Save.defaults().schema === 4);
check('默认未看过玩法说明', Save.defaults().guideSeen === false);
check('玩法说明状态按布尔清洗',
  Save.normalize({ schema: 3, guideSeen: true }).guideSeen === true &&
  Save.normalize({ schema: 3, guideSeen: 'yes' }).guideSeen === false);
check('日历日期校验拒绝不存在的日期',
  require('../js/core/date').isKey('2026-02-30') === false &&
  require('../js/core/date').isKey('2026-13-40') === false &&
  require('../js/core/date').isKey('2026-02-28') === true);

var mig3 = Save.normalize({ schema: 2, coins: 321, tickets: 7 });
check('schema2 存档补全 S5 默认结构',
  mig3.schema === 4 && mig3.coins === 321 && mig3.tickets === 7 &&
  mig3.makeupCards === 0 && mig3.fragments === 0 &&
  !!mig3.daily && !!mig3.signin && !!mig3.collection &&
  !!mig3.achievements && mig3.cosmetics.current === 'cream');

var hist40 = {};
for (var hi = 0; hi < 40; hi++) {
  hist40[require('../js/core/date').add('2026-01-01', hi)] = {
    coins: 10, fragments: 1, timeMs: 1, paws: 3, streak: 1
  };
}
hist40['bad'] = { coins: 1 };
var cleanSave = Save.normalize({
  schema: 3,
  daily: { history: hist40, timeGuardDate: '2026-13-40' },
  signin: { history: hist40 },
  collection: { unlocked: { mo: 1, dragon: 1 }, equipped: 'dragon' },
  achievements: { first_clear: { unlockedAt: 1, claimedAt: 2 }, hack: { unlockedAt: 1 } },
  cosmetics: { skins: { cream: true, 'skin-rainbow': true }, current: 'skin-rainbow' }
});
check('每日历史只保留最近 31 天',
  Object.keys(cleanSave.daily.history).length === 31 &&
  !cleanSave.daily.history['2026-01-01'] && !!cleanSave.daily.history['2026-02-09'],
  'len=' + Object.keys(cleanSave.daily.history).length);
check('非法日期与非法守护日被丢弃',
  !cleanSave.daily.history.bad && cleanSave.daily.timeGuardDate === '');
check('未知猫与非法出战猫被丢弃',
  !!cleanSave.collection.unlocked.mo && !cleanSave.collection.unlocked.dragon &&
  cleanSave.collection.equipped === '');
check('未知成就被丢弃、已知成就保留',
  !!cleanSave.achievements.first_clear && !cleanSave.achievements.hack);
check('未知皮肤被丢弃并回退默认皮肤',
  !!cleanSave.cosmetics.skins.cream && !cleanSave.cosmetics.skins['skin-rainbow'] &&
  cleanSave.cosmetics.current === 'cream');

var s5Persist = Save.normalize({
  schema: 3,
  coins: 222,
  tickets: 9,
  makeupCards: 2,
  fragments: 4,
  daily: {
    date: '2026-11-19', streak: 4, bestStreak: 6, total: 9, claimed: true,
    history: { '2026-11-19': { coins: 110, fragments: 2, timeMs: 30000, paws: 3, streak: 4 } },
    lastSeenTs: 1700000000000
  },
  signin: {
    lastDate: '2026-11-19', streak: 5, cycleDay: 5, totalDays: 12,
    claimedMilestones: { '7': true },
    history: { '2026-11-19': { coins: 60, tickets: 0, day: 5, makeup: 0 } }
  },
  collection: { unlocked: { mo: 1, naitang: 2 }, equipped: 'naitang' },
  achievements: { first_clear: { unlockedAt: 5, claimedAt: 6 } },
  cosmetics: { skins: { cream: true, 'skin-mint': true }, current: 'skin-mint' },
  guideSeen: true
});
store['md:save:v1'] = JSON.stringify(s5Persist);
var reloadS5 = new Save();
var rd5 = reloadS5.load();
check('S5 状态经 JSON 落盘后可完整重载',
  rd5.schema === 4 && rd5.coins === 222 && rd5.tickets === 9 &&
  rd5.makeupCards === 2 && rd5.fragments === 4 &&
  rd5.daily.streak === 4 && rd5.daily.bestStreak === 6 &&
  rd5.daily.history['2026-11-19'].coins === 110 &&
  rd5.signin.totalDays === 12 && rd5.signin.claimedMilestones['7'] === true &&
  rd5.collection.equipped === 'naitang' &&
  rd5.achievements.first_clear.claimedAt === 6 &&
  rd5.cosmetics.current === 'skin-mint' && rd5.guideSeen === true);
store['md:save:v1'] = app.save.data;

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
var navFrontier = app.save.data.unlocked;
tap(map3.nextC.cx, map3.nextC.cy);
map3.render(app.renderer);
check('未解锁章节不能向前跳转', map3.chapter === 1 &&
  app.toast.text === copy.toastChapterLocked,
  'chapter=' + map3.chapter + ' toast=' + app.toast.text);
check('未通关章节的节点仍锁定', !app.progress.isUnlocked(21));

app.save.data.unlocked = 21;
tap(map3.nextC.cx, map3.nextC.cy);
map3.render(app.renderer);
check('章节起点解锁后可切到第 2 章', map3.chapter === 2 &&
  map3._computeNodes()[0].index === 21,
  'chapter=' + map3.chapter);
check('章节起点解锁后节点可进入', app.progress.isUnlocked(21));
app.save.data.unlocked = navFrontier;
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

/* ---------------- 7b. S5 页面流程 ---------------- */

console.log('[7b] S5 页面流程（签到 / 每日 / 图鉴 / 成就 / 商店）');
var configUI = require('../js/data/config');
var themeData = require('../js/data/theme');

function checkNoBadText(label) {
  var texts = app.renderer.ctx.texts || [];
  var bad = texts.filter(function (t) { return /%[ds]|undefined|NaN/.test(t); });
  check(label + '文案无占位符/NaN', texts.length > 0 && bad.length === 0,
    bad.slice(0, 3).join(' | '));
}

// 首页 → 签到 → 领取 → 返回
var HL7 = app.layout.home();
tap(HL7.checkin.cx, HL7.checkin.cy);
frames(app, 1);
check('首页签到入口进入签到页', sceneName(app) === 'checkin');
checkNoBadText('签到页');
var CL7 = app.layout.checkin();
var coinsBeforeSignin = app.progress.coins();
tap(CL7.claim.x + CL7.claim.w / 2, CL7.claim.y + CL7.claim.h / 2);
frames(app, 2);
check('签到页领取到账',
  app.signin.claimedToday() &&
  app.progress.coins() === coinsBeforeSignin + configUI.SIGNIN_REWARDS[0].coins,
  'coins=' + app.progress.coins());
check('签到领取有成功提示', app.toast.text === copy.toastCheckinDone);
check('签到后按钮变为已签到', app.sm.top().makeupMode === 0);
tap(CL7.back.cx, CL7.back.cy);
frames(app, 2);
check('签到页返回首页', sceneName(app) === 'home');

// 首页 → 每日挑战 → 对局 → 结算 → 首页
var HL8 = app.layout.home();
tap(HL8.cards[0].x + HL8.cards[0].w / 2, HL8.cards[0].y + HL8.cards[0].h / 2);
frames(app, 1);
check('首页每日入口进入每日页', sceneName(app) === 'daily');
checkNoBadText('每日页');
var dailySt = app.daily.status();
check('每日页有今日题面', !!dailySt.level && dailySt.level.daily === true &&
  dailySt.level.tier >= 3, 'tier=' + (dailySt.level && dailySt.level.tier));
var DL7 = app.layout.daily();
var coinsBeforeDaily = app.progress.coins();
tap(DL7.cta.x + DL7.cta.w / 2, DL7.cta.y + DL7.cta.h / 2);
frames(app, 1);
check('每日页进入每日对局',
  sceneName(app) === 'game' && app.sm.top().dailyMode === true &&
  app.sm.top().dailyDate === app.daily.todayKey());

var dg7 = app.sm.top();

// 挑战模式回归：斜角相邻的两只猫必须判冲突，不能进入结算
dg7._restart();
tapCell(app, dg7, 0, 0);
tapCell(app, dg7, 0, 0);
tapCell(app, dg7, 1, 1);
tapCell(app, dg7, 1, 1);
frames(app, 2);
check('每日挑战斜角相邻两只猫判冲突且不结算',
  dg7.conflict[0] === true && dg7.conflict[dg7.n + 1] === true &&
  dg7.solvedFlag === false && sceneName(app) === 'game',
  'conflict=' + JSON.stringify(dg7.conflict) + ' scene=' + sceneName(app));
dg7._restart();
frames(app, 1);

fillSolution(app, dg7);
frames(app, 50);
check('每日对局完成进入每日结算',
  sceneName(app) === 'result' && app.sm.top().info.daily === true);
var dailyInfo = app.sm.top().info;
check('每日结算首通发币与碎片',
  dailyInfo.firstClear === true && dailyInfo.coins > 0 && dailyInfo.fragments >= 1 &&
  app.progress.coins() === coinsBeforeDaily + dailyInfo.coins,
  'coins=' + dailyInfo.coins + ' frag=' + dailyInfo.fragments);
check('每日结算写入今日历史', app.daily.isCleared(app.daily.todayKey()) &&
  app.daily.totalDays() >= 1);

var RD7 = app.layout.result();
tap(RD7.cta.x + RD7.cta.w / 2, RD7.cta.y + RD7.cta.h / 2);
frames(app, 2);
check('每日结算一键回首页', sceneName(app) === 'home');

// 同一天重玩不计奖励
var HL9 = app.layout.home();
tap(HL9.cards[0].x + HL9.cards[0].w / 2, HL9.cards[0].y + HL9.cards[0].h / 2);
frames(app, 1);
var DL8 = app.layout.daily();
var coinsBeforeReplay = app.progress.coins();
tap(DL8.cta.x + DL8.cta.w / 2, DL8.cta.y + DL8.cta.h / 2);
frames(app, 1);
var dg8 = app.sm.top();
fillSolution(app, dg8);
frames(app, 50);
check('每日重玩进入结算且不发奖',
  sceneName(app) === 'result' && app.sm.top().info.replay === true &&
  app.sm.top().info.coins === 0 && app.progress.coins() === coinsBeforeReplay);
var RD8 = app.layout.result();
tap(RD8.cta.x + RD8.cta.w / 2, RD8.cta.y + RD8.cta.h / 2);
frames(app, 2);
check('每日重玩后返回首页', sceneName(app) === 'home');

// 首页 → 图鉴 → 详情 → 成就 → 领取
var HL10 = app.layout.home();
tap(HL10.cards[1].x + HL10.cards[1].w / 2, HL10.cards[1].y + HL10.cards[1].h / 2);
frames(app, 1);
check('首页图鉴入口进入图鉴', sceneName(app) === 'album');
checkNoBadText('图鉴页');
var album7 = app.sm.top();
var AL7 = app.layout.album();
check('图鉴展示 16 只猫、4 列网格',
  album7.cells.length === 16 && AL7.grid.cols === 4);
check('图鉴详情卡避开胶囊区', AL7.detail.y >= capBottom,
  'detailY=' + AL7.detail.y + ' capBottom=' + capBottom);
check('墨墨已解锁、奶糖仍锁定',
  app.collection.isUnlocked('mo') && !app.collection.isUnlocked('naitang'));

var cellNai = album7.cells[1];
tap(cellNai.x + cellNai.w / 2, cellNai.y + cellNai.h / 2);
frames(app, 1);
check('点击锁定猫打开详情', album7.selected === 'naitang' && album7.detailAction === '');
tap(AL7.detail.close.cx, AL7.detail.close.cy);
frames(app, 1);
check('详情右上角可关闭', album7.selected === null);

var cellMo = album7.cells[0];
tap(cellMo.x + cellMo.w / 2, cellMo.y + cellMo.h / 2);
frames(app, 1);
check('点击已出战猫显示已出战状态',
  album7.selected === 'mo' && album7.detailAction === '');
tap(AL7.detail.close.cx, AL7.detail.close.cy);
frames(app, 1);

tap(AL7.ach.x + AL7.ach.w / 2, AL7.ach.y + AL7.ach.h / 2);
frames(app, 1);
check('图鉴右上角进入成就页', sceneName(app) === 'achievements');
checkNoBadText('成就页');
var AS7 = app.sm.top();
check('成就页列出 9 条成就', AS7.rows.length === configUI.ACHIEVEMENTS.length);
check('首通成就已由进度自动标记',
  app.achievements.isUnlocked('first_clear') &&
  !app.achievements.isClaimed('first_clear') && !!AS7.rows[0].btn);
var coinsBeforeAch = app.progress.coins();
var ar = AS7.rows[0].btn;
tap(ar.x + ar.w / 2, ar.y + ar.h / 2);
frames(app, 2);
check('成就领取入账并标记已领',
  app.achievements.isClaimed('first_clear') &&
  app.progress.coins() === coinsBeforeAch + configUI.ACHIEVEMENTS[0].coins);
check('成就领取提示', app.toast.text === copy.toastAchievementClaimed);
tap(AS7.L.back.cx, AS7.L.back.cy);
frames(app, 2);
check('成就页返回图鉴', sceneName(app) === 'album');
tap(AL7.back.cx, AL7.back.cy);
frames(app, 2);
check('图鉴返回首页', sceneName(app) === 'home');

// 首页 → 商店 → 买券/补签卡/皮肤 → 当前皮肤不重复扣款
var HL11 = app.layout.home();
tap(HL11.cards[2].x + HL11.cards[2].w / 2, HL11.cards[2].y + HL11.cards[2].h / 2);
frames(app, 1);
check('首页商店入口进入商店', sceneName(app) === 'shop');
checkNoBadText('商店页');
var shop7 = app.sm.top();
var SL7 = app.layout.shop();
check('商店渲染 5 个商品', shop7.rows.length === 5);

var shopCoins0 = app.progress.coins();
var shopTickets0 = app.progress.tickets();
tap(shop7.rows[0].btn.x + shop7.rows[0].btn.w / 2, shop7.rows[0].btn.y + shop7.rows[0].btn.h / 2);
frames(app, 2);
check('商店购买提示券',
  app.progress.tickets() === shopTickets0 + 1 &&
  app.progress.coins() === shopCoins0 - 45);

var shopCoins1 = app.progress.coins();
var shopCards0 = app.progress.makeupCards();
tap(shop7.rows[1].btn.x + shop7.rows[1].btn.w / 2, shop7.rows[1].btn.y + shop7.rows[1].btn.h / 2);
frames(app, 2);
check('商店购买补签卡',
  app.progress.makeupCards() === shopCards0 + 1 &&
  app.progress.coins() === shopCoins1 - 100);

app.progress.addCoins(1000);
frames(app, 1);
var coinsBeforeSkin = app.progress.coins();
tap(shop7.rows[2].btn.x + shop7.rows[2].btn.w / 2,
  shop7.rows[2].btn.y + shop7.rows[2].btn.h / 2);
frames(app, 2);
check('商店购买皮肤并切换棋盘配色',
  app.progress.currentSkin() === 'skin-mint' &&
  app.progress.coins() === coinsBeforeSkin - 300 &&
  app.theme.region[0] === themeData.palette('skin-mint')[0] &&
  app.theme.region[0] !== themeData.palette('cream')[0]);
var coinsAfterSkin = app.progress.coins();
tap(shop7.rows[2].btn.x + shop7.rows[2].btn.w / 2,
  shop7.rows[2].btn.y + shop7.rows[2].btn.h / 2);
frames(app, 1);
check('当前皮肤按钮不会重复扣款',
  shop7.rows[2].action === '' && app.progress.coins() === coinsAfterSkin);
tap(SL7.back.cx, SL7.back.cy);
frames(app, 2);
check('商店返回首页', sceneName(app) === 'home');

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

var SH = small.home();
check('小屏首页内容依次排开不越界',
  SH.deco.stage.cy - SH.deco.stage.r > SH.kicker.y + SH.kicker.h &&
  SH.catTag.y + SH.catTag.h <= SH.cta.y &&
  SH.cta.y + SH.cta.h <= SH.cards[0].y &&
  SH.cards[0].y + SH.cards[0].h < SH.footerY && SH.footerY <= 568,
  'tagBottom=' + (SH.catTag.y + SH.catTag.h).toFixed(1) +
  ' cta=' + SH.cta.y.toFixed(1) +
  ' cardsBottom=' + (SH.cards[0].y + SH.cards[0].h).toFixed(1) +
  ' footer=' + SH.footerY.toFixed(1));

// 320×568 且带胶囊：顶栏让位后棋盘仍要可用
var smallMenu = new Layout({
  width: 320, height: 568, dpr: 2, safeTop: 20, safeBottom: 0,
  menu: { left: 223, top: 24, right: 310, bottom: 56, width: 87, height: 32 }
});
var SM9 = smallMenu.game(9);
check('小屏胶囊下顶栏避开胶囊', SM9.topBar.y >= 56,
  'top=' + SM9.topBar.y.toFixed(1));
check('小屏胶囊下 9×9 棋盘不越界',
  SM9.board.y + SM9.board.size <= SM9.band.y + 0.5,
  'bottom=' + (SM9.board.y + SM9.board.size).toFixed(1) +
  ' band=' + SM9.band.y.toFixed(1));
check('小屏胶囊下 9×9 格子边长 ≥ 24px', SM9.geom.tile >= 24,
  'tile=' + SM9.geom.tile.toFixed(1));
check('小屏胶囊下 4×4 格子边长 ≥ 40px', smallMenu.game(4).geom.tile >= 40,
  'tile=' + smallMenu.game(4).geom.tile.toFixed(1));

var SHM = smallMenu.home();
check('小屏胶囊下首页整体让开胶囊且不越界',
  SHM.topBar.y >= 56 &&
  SHM.deco.stage.cy - SHM.deco.stage.r > SHM.kicker.y + SHM.kicker.h &&
  SHM.catTag.y + SHM.catTag.h <= SHM.cta.y &&
  SHM.cards[0].y + SHM.cards[0].h < SHM.footerY,
  'stageTop=' + (SHM.deco.stage.cy - SHM.deco.stage.r).toFixed(1) +
  ' pillBottom=' + (SHM.kicker.y + SHM.kicker.h).toFixed(1) +
  ' tagBottom=' + (SHM.catTag.y + SHM.catTag.h).toFixed(1) +
  ' cta=' + SHM.cta.y.toFixed(1));

// S5 五个子页面：320×568 全部不越界、不重叠
var SDAILY = small.daily();
check('小屏每日页按钮在屏内', SDAILY.cta.y + SDAILY.cta.h <= 568 + 0.5);
check('小屏每日页奖励卡不与按钮重叠', SDAILY.reward.y + SDAILY.reward.h < SDAILY.cta.y);
check('小屏每日 7 日历史不溢出',
  SDAILY.history.x + SDAILY.history.cellW * 7 + SDAILY.history.gap * 6 <= 320 + 0.5,
  'right=' + (SDAILY.history.x + SDAILY.history.cellW * 7 + SDAILY.history.gap * 6).toFixed(1));

var SCHK = small.checkin();
check('小屏签到按钮在屏内', SCHK.claim.y + SCHK.claim.h <= 568 + 0.5);
check('小屏补签条在按钮上方', SCHK.makeup.y + SCHK.makeup.h < SCHK.claim.y);
check('小屏里程碑在补签条上方', SCHK.miles.y + SCHK.miles.h < SCHK.makeup.y);
check('小屏签到 7 格不溢出',
  SCHK.week.x + SCHK.week.cellW * 7 + SCHK.week.gap * 6 <= 320 + 0.5);

var SALB = small.album();
check('小屏图鉴 4×4 网格在屏内', SALB.grid.y + SALB.grid.h <= 568 + 0.5,
  'bottom=' + (SALB.grid.y + SALB.grid.h).toFixed(1));
check('小屏图鉴格子宽度可用', SALB.grid.cellW >= 60, 'w=' + SALB.grid.cellW.toFixed(1));
check('小屏图鉴详情卡在屏内',
  SALB.detail.y + SALB.detail.h <= 568 + 0.5 &&
  SALB.detail.action.y + SALB.detail.action.h <= SALB.detail.y + SALB.detail.h + 0.5);

var SACH = small.achievements();
check('小屏成就列表 9 条在屏内',
  SACH.list.y + SACH.list.rowH * 9 + SACH.list.gap * 8 <= 568 + 0.5,
  'bottom=' + (SACH.list.y + SACH.list.rowH * 9 + SACH.list.gap * 8).toFixed(1));
check('小屏成就行高可读', SACH.list.rowH >= 38, 'rowH=' + SACH.list.rowH.toFixed(1));

var SSHOP = small.shop();
check('小屏商店 5 个商品在屏内',
  SSHOP.list.y + SSHOP.list.rowH * 5 + SSHOP.list.gap * 4 <= 568 + 0.5,
  'bottom=' + (SSHOP.list.y + SSHOP.list.rowH * 5 + SSHOP.list.gap * 4).toFixed(1));
check('小屏商店行高可读', SSHOP.list.rowH >= 52, 'rowH=' + SSHOP.list.rowH.toFixed(1));

var SGUIDE = small.guide();
check('小屏玩法说明弹窗在安全区内',
  SGUIDE.card.x >= 0 && SGUIDE.card.x + SGUIDE.card.w <= 320 + 0.5 &&
  SGUIDE.card.y >= 20 - 0.5 && SGUIDE.card.y + SGUIDE.card.h <= 568 + 0.5,
  'card=' + [SGUIDE.card.x, SGUIDE.card.y, SGUIDE.card.w, SGUIDE.card.h].map(function (v) {
    return v.toFixed(1);
  }).join(','));
var guideDotsTop = SGUIDE.dots[0].cy - SGUIDE.dots[0].r;
check('小屏玩法说明各区块不重叠',
  SGUIDE.dividerY <= SGUIDE.goal.y &&
  SGUIDE.dividerY <= SGUIDE.tap.y &&
  SGUIDE.dividerY <= SGUIDE.tip.y &&
  SGUIDE.goal.y + SGUIDE.goal.h <= guideDotsTop &&
  SGUIDE.tap.y + SGUIDE.tap.h <= guideDotsTop &&
  SGUIDE.tip.y + SGUIDE.tip.h <= guideDotsTop &&
  SGUIDE.tap.rows[2].y + SGUIDE.tap.rows[2].size <= SGUIDE.tap.y + SGUIDE.tap.h &&
  SGUIDE.dots[0].cy + SGUIDE.dots[0].r <= SGUIDE.cta.y &&
  SGUIDE.cta.y + SGUIDE.cta.h <= SGUIDE.card.y + SGUIDE.card.h);
check('小屏玩法说明关闭按钮在卡内',
  SGUIDE.close.cx - SGUIDE.close.r >= SGUIDE.card.x &&
  SGUIDE.close.cx + SGUIDE.close.r <= SGUIDE.card.x + SGUIDE.card.w &&
  SGUIDE.close.cy - SGUIDE.close.r >= SGUIDE.card.y &&
  SGUIDE.close.cy + SGUIDE.close.r <= SGUIDE.card.y + SGUIDE.card.h);
check('小屏玩法说明点击示例在卡内',
  SGUIDE.tap.rows[2].y + SGUIDE.tap.rows[2].size <= SGUIDE.tap.y + SGUIDE.tap.h + 0.5);

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
