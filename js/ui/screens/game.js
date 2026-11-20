/**
 * 对局界面。
 *
 * 分层：
 *   1. 静态棋盘（白框 + 色块）预渲染到离屏层，每帧只 drawImage 一次
 *   2. 动态标记（X / 猫 / 冲突圈）直绘
 *   3. 底部色带与工具栏
 *
 * 通关判定走 domain/rules（不读答案）；结算前二次校验，成功后 push 结算页。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var config = require('../../data/config');
var cats = require('../../data/cats');
var levels = require('../../services/levels');
var tutorial = require('../../services/tutorial');
var rules = require('../../domain/rules');
var hit = require('../hit');
var clock = require('../../core/clock');
var format = require('../../core/format');
var logger = require('../../core/logger');
var regionColors = require('../region-colors');
var Renderer = require('../renderer');

var EMPTY = 0;
var MARK = 1;
var CAT = 2;
var POP_MS = 220;
var FX_LIFE = 0.5;      // 放置反馈波纹时长（秒）
var ERROR_SHAKE = 0.18; // 冲突时棋盘短震动时长（秒）

function GameScene(app) {
  this.app = app;
  this.index = 1;
  this.dailyMode = false;
  this.dailyDate = '';
  this.n = 5;
  this.regions = [];
  this.regionColors = [];
  this.cells = [];
  this.givens = [];      // 预放猫格子（不可移动）
  this.givenSet = {};
  this.focus = -1;       // 教学关高亮格
  this.popAt = {};
  this.undoStack = [];
  this.conflict = {};
  this.solvedFlag = false;
  this.boardLayer = null;

  this.elapsed = 0;      // 仅在对局进行中累加，切后台/结算时自然暂停
  this.timeMs = 0;
  this.moves = 0;
  this.mistakes = 0;
  this.hintsUsed = 0;
  this.hintsAtSolve = 0;
  this.settleDelay = 0;
  this.celebrateT = 0;
  this.fx = [];          // 放置反馈波纹（ok/bad）
  this.shakeT = 0;       // 冲突时的短震动倒计时
  this.resultInfo = null;
  this.resultOpened = false;
  this.resumeT = 0;      // 续玩盘面自动保存节流

  this.coach = null;     // 首次规则卡；显示期间暂停计时
  this.idleT = 0;
  this.idleShown = false;
  this.hintGlowT = 0;    // 闲置提示后，提示按钮的柔和高亮
}

/* ---------------- 生命周期 ---------------- */

GameScene.prototype.enter = function (params) {
  var app = this.app;
  this.dailyMode = !!(params && params.mode === 'daily');
  var level;
  if (this.dailyMode) {
    level = app.daily.available() ? app.daily.level() : null;
    if (!level) {
      logger.warn('每日挑战题库不可用');
      app.toast.show(copy.toastDailyUnavailable);
      app.sm.pop();
      return;
    }
    this.dailyDate = level.dailyDate;
    this.index = 0;
  } else {
    var index = (params && params.levelIndex) || 1;
    level = levels.get(index);
    if (!level) {
      logger.warn('关卡不存在: ' + index);
      level = levels.get(1);
    }
    if (!level) {
      logger.error('关卡包为空');
      app.toast.show('关卡数据缺失');
      app.sm.pop();
      return;
    }
    // 锁关守卫：地图之外的入口（结算下一关/未来入口）也不能越过解锁前沿。
    if (!app.progress.isUnlocked(level.index)) {
      logger.warn('关卡尚未解锁: ' + level.index);
      app.toast.show(copy.toastLocked);
      app.sm.pop();
      return;
    }
    this.dailyDate = '';
    this.index = level.index;
  }

  this.level = level;
  this.n = level.n;
  this.regions = parseRegions(level.regions, this.n);
  this.regionColors = regionColors.assign(this.regions, this.n, app.theme.region);
  this.givens = (level.givens || []).slice();
  this.givenSet = {};
  this.focus = level.focus >= 0 ? level.focus : -1;
  this.cells = [];
  for (var i = 0; i < this.n * this.n; i++) this.cells.push(EMPTY);
  for (var g = 0; g < this.givens.length; g++) {
    var gi = this.givens[g];
    if (gi >= 0 && gi < this.cells.length) {
      this.cells[gi] = CAT;
      this.givenSet[gi] = true;
    }
  }
  this.popAt = {};
  this.undoStack = [];
  this.conflict = {};
  this.solvedFlag = false;

  this.elapsed = 0;
  this.timeMs = 0;
  this.moves = 0;
  this.mistakes = 0;
  this.hintsUsed = 0;
  this.hintsAtSolve = 0;
  this.settleDelay = 0;
  this.celebrateT = 0;
  this.fx = [];          // 放置反馈波纹（ok/bad）
  this.shakeT = 0;       // 冲突时的短震动倒计时
  this.resultInfo = null;
  this.resultOpened = false;
  this.resumeT = 0;
  this.coach = null;
  this.idleT = 0;
  this.idleShown = false;
  this.hintGlowT = 0;

  // 续玩：仅主线关卡；每日挑战鼓励当天重试，不与主线单槽混用
  var resume = this.dailyMode ? null : app.progress.getResume(this.index);
  if (resume && resume.n === this.n && resume.cells.length === this.n * this.n) {
    this.cells = resume.cells.slice();
    this.elapsed = resume.timeMs / 1000;
    this.timeMs = resume.timeMs;
    this.moves = resume.moves;
    this.mistakes = resume.mistakes;
    this.hintsUsed = resume.hintsUsed;
    if (resume.moves > 0 || resume.timeMs > 500) app.toast.show(copy.toastResumed);
  }
  // 预放猫永远以关卡数据为准：续玩档也不能把它们清掉或改掉
  this._applyGivens();

  this.L = app.layout.game(this.n);
  this.boardLayer = this._buildBoardLayer();

  this.coach = tutorial.coachFor(this.index, level, app.progress.d().coachSeen);
  if (!this.dailyMode) app.progress.setLastLevel(this.index);
  this._recompute();
};

/** 把关卡预放猫强制落回盘面（进入/重开/撤销后调用） */
GameScene.prototype._applyGivens = function () {
  for (var i = 0; i < this.givens.length; i++) {
    var idx = this.givens[i];
    if (idx >= 0 && idx < this.cells.length) {
      this.cells[idx] = CAT;
      delete this.popAt[idx];
    }
  }
};

/* ---------------- 更新 ---------------- */

GameScene.prototype.update = function (dt) {
  this._updateFx(dt);

  if (this.solvedFlag) {
    // 通关后先停留一小段时间展示庆祝，再进结算
    this.celebrateT += dt;
    if (this.settleDelay > 0) {
      this.settleDelay -= dt;
      if (this.settleDelay <= 0) this._openResult();
    }
    return;
  }

  // 规则卡显示期间暂停计时，不让新玩家读说明时被扣时间
  if (this.coach) return;

  this.elapsed += dt;
  this.resumeT += dt;
  if (this.resumeT >= 3) {
    this.resumeT = 0;
    this._saveResume();
  }

  this.idleT += dt;
  if (!this.idleShown && this.idleT >= config.IDLE_HINT_SECONDS) {
    this.idleShown = true;
    this.hintGlowT = 6;
    this.app.toast.show(copy.toastIdleHint);
  }
};

GameScene.prototype._updateFx = function (dt) {
  if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
  if (this.hintGlowT > 0) this.hintGlowT = Math.max(0, this.hintGlowT - dt);
  for (var i = this.fx.length - 1; i >= 0; i--) {
    this.fx[i].t += dt;
    if (this.fx[i].t > FX_LIFE) this.fx.splice(i, 1);
  }
};

/* ---------------- 渲染 ---------------- */

GameScene.prototype.render = function (r) {
  var th = this.app.theme;
  r.fill(th.color.bg);

  this._renderTop(r);
  this._renderLegend(r);
  this._renderRules(r);
  this._renderBoard(r);
  this._renderBand(r);
  if (this.coach) this._renderCoach(r);
};

GameScene.prototype._renderCoach = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.app.layout.coach();
  var c = L.card;

  r.fill(th.color.mask);
  draw.softShadow(r, c.x, c.y, c.w, c.h, th.radius.board);
  r.roundRect(c.x, c.y, c.w, c.h, th.radius.board, th.color.card);

  r.roundRect(c.x + 18 * s, c.y + 22 * s, 28 * s, 5 * s, 2.5 * s, th.color.cta);
  r.text(this.coach.title, L.titleX, L.titleY, {
    size: th.font.coachTitle,
    weight: '700',
    color: th.color.text
  });
  for (var i = 0; i < this.coach.lines.length; i++) {
    r.text(this.coach.lines[i], L.bodyX, L.bodyY + i * L.lineH, {
      size: th.font.coachBody,
      color: th.color.textSoft,
      maxWidth: L.bodyW
    });
  }

  draw.softShadow(r, L.cta.x, L.cta.y, L.cta.w, L.cta.h, L.cta.h / 2);
  r.roundRect(L.cta.x, L.cta.y, L.cta.w, L.cta.h, L.cta.h / 2, th.color.cta);
  r.text(copy.coachDone, L.cta.x + L.cta.w / 2, L.cta.y + L.cta.h / 2 + 1, {
    size: th.font.banner,
    weight: '700',
    color: th.color.textOnColor,
    align: 'center'
  });
};

GameScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.circle(L.help.cx, L.help.cy, L.help.r, th.color.card);
  r.text(copy.guideHelpMark, L.help.cx, L.help.cy + 1, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  draw.iconCircle(r, L.gear.cx, L.gear.cy, L.gear.r, th.color.card, draw.iconGear, 19 * s, th.color.text);

  r.text(this.dailyMode ? copy.dailyGameTitle : format(copy.levelTitle, this.index), r.w / 2, L.topBar.y + 19 * s, {
    size: th.font.pageTitle,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
  var tierName = copy.tierNames[this.level.tier - 1] || '';
  var info = this.n + ' × ' + this.n;
  if (this.dailyMode) info = copy.dailyGameTag + '  ·  ' + info;
  if (tierName) info += '  ·  ' + tierName;
  info += '  ·  ' + format.duration(Math.round(this.elapsed * 1000));
  r.text(info, r.w / 2, L.topBar.y + 37 * s, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center'
  });
};

GameScene.prototype._renderLegend = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var lg = L.legend;
  var n = this.n;
  var item = lg.item;
  var totalW = n * item + (n - 1) * lg.gap;
  var x0 = (r.w - totalW) / 2;
  var y0 = lg.y + (lg.h - item) / 2;

  for (var g = 0; g < n; g++) {
    var x = x0 + g * (item + lg.gap);
    var color = this._regionColor(g);
    var found = this._regionHasCat(g);

    if (found) {
      r.ctx.globalAlpha = 0.32;
      r.roundRect(x, y0, item, item, 6 * s, color);
      r.ctx.globalAlpha = 1;
      draw.iconCheck(r, x + item / 2, y0 + item / 2, item * 0.62, draw.xColorFor(color));
    } else {
      r.roundRect(x, y0, item, item, 6 * s, color);
      draw.catFace(r, x + item / 2, y0 + item * 0.52, item * 0.84, this._catFor(g), {});
    }
  }
};

GameScene.prototype._renderRules = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var ru = this.L.rules;

  if (this.n >= 8) {
    r.roundRect(ru.x, ru.y, ru.w, ru.h, th.radius.card, th.color.card);
    r.text(copy.ruleColor + '  ·  ' + copy.ruleRowCol + '  ·  ' + copy.ruleTouch, r.w / 2, ru.y + ru.h / 2, {
      size: th.font.rule,
      weight: '500',
      color: th.color.textSoft,
      align: 'center'
    });
    return;
  }

  var labels = [copy.ruleColor, copy.ruleRowCol, copy.ruleTouch];
  for (var i = 0; i < 3; i++) {
    var x = ru.x + i * (ru.cardW + ru.gap);
    r.roundRect(x, ru.y, ru.cardW, ru.h, th.radius.card, th.color.card);
    r.strokeRoundRect(x, ru.y, ru.cardW, ru.h, th.radius.card, th.color.border, 1);
    draw.ruleIcon(r, i + 1, x + 22 * s, ru.y + ru.h / 2, 24 * s, th.color.cta, th.color.text);
    r.text(labels[i], x + 42 * s, ru.y + ru.h / 2, {
      size: th.font.rule,
      weight: '600',
      color: th.color.text,
      maxWidth: ru.cardW - 46 * s
    });
  }
};

GameScene.prototype._renderBoard = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var n = this.n;
  var geom = L.geom;

  // 冲突时整盘短促左右震动，幅度随时间衰减
  var shakeX = 0;
  if (this.shakeT > 0) {
    shakeX = Math.sin((ERROR_SHAKE - this.shakeT) * 90) * 3 * s * (this.shakeT / ERROR_SHAKE);
  }

  if (this.boardLayer) {
    this.app.renderer.drawLayer(this.boardLayer.layer, this.boardLayer.x + shakeX, this.boardLayer.y);
  }

  this._renderFocus(r, shakeX);

  var now = clock.now();

  for (var i = 0; i < n * n; i++) {
    var v = this.cells[i];
    if (v === EMPTY) continue;

    var row = Math.floor(i / n);
    var col = i % n;
    var rc = this.app.layout.cellRect(geom, row, col);
    var ax = L.board.x + rc.x + shakeX;
    var ay = L.board.y + rc.y;
    var cx = ax + rc.size / 2;
    var cy = ay + rc.size / 2;
    var g = this.regions[i];
    var color = this._regionColor(g);

    if (this.solvedFlag) {
      cy += Math.sin(this.celebrateT * 9 + i * 1.3) * 2 * s;
    }

    if (v === MARK) {
      draw.xMark(r, cx, cy, rc.size * 1.24, draw.xColorFor(color));
    } else {
      var k = 1;
      if (this.popAt[i]) {
        k = (now - this.popAt[i]) / POP_MS;
        if (k < 0) k = 0;
        if (k > 1) k = 1;
      }
      var ease = 1 - Math.pow(1 - k, 3);
      var scale = 0.7 + 0.3 * ease + 0.06 * Math.sin(Math.PI * k);
      draw.catFace(r, cx, cy + rc.size * 0.05, rc.size * 0.98 * scale, this._catFor(g), {});

      // 预放猫加锁标：视觉上明确“这只不能动”
      if (this.givenSet[i]) {
        var br = Math.max(7 * s, rc.size * 0.15);
        var bx = ax + rc.size - br - 2 * s;
        var by = ay + br + 2 * s;
        r.circle(bx, by, br, th.color.card);
        r.strokeCircle(bx, by, br, th.color.border, 1 * s);
        draw.iconLock(r, bx, by, br * 1.5, th.color.textSoft);
      }
    }

    if (this.conflict[i]) {
      r.strokeRoundRect(ax + 1.5, ay + 1.5, rc.size - 3, rc.size - 3, geom.radius, draw.alpha(th.color.conflict, 0.9), 2.5 * s);
    }
  }

  this._renderFx(r, shakeX);
  this._renderTapHint(r, shakeX);
};

/** 引导关无操作 3 秒后，指向下一处正确落子格 */
GameScene.prototype._tapHintTarget = function () {
  if (!tutorial.isTapHintLevel(this.index, this.dailyMode)) return -1;
  if (this.solvedFlag || this.coach) return -1;
  if (this.idleT < tutorial.tapHintSeconds(this.index)) return -1;
  return this._hintCell();
};

GameScene.prototype._renderTapHint = function (r, shakeX) {
  var idx = this._tapHintTarget();
  if (idx < 0) return;

  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var rc = this.app.layout.cellRect(L.geom, Math.floor(idx / this.n), idx % this.n);
  var ax = L.board.x + rc.x + shakeX;
  var ay = L.board.y + rc.y;
  var cx = ax + rc.size / 2;
  var cy = ay + rc.size / 2;
  var now = clock.now();
  var pulse = (Math.sin(now / 260) + 1) / 2;

  r.strokeRoundRect(ax + 1 * s, ay + 1 * s, rc.size - 2 * s, rc.size - 2 * s,
    L.geom.radius, draw.alpha(th.color.cta, 0.55 + 0.35 * pulse), 3 * s);

  // 两圈错开的扩散环表示“连点两下”
  for (var k = 0; k < 2; k++) {
    var phase = ((now / 520) + k * 0.5) % 1;
    r.strokeCircle(cx, cy, rc.size * (0.13 + 0.30 * phase),
      draw.alpha(th.color.cta, 0.34 * (1 - phase)), 2 * s);
  }

  var label = this.cells[idx] === MARK ? copy.tapHintOnce : copy.tapHintDouble;
  var fs = th.font.tool;
  var pillH = Math.min(24 * s, rc.size * 0.42);
  var pillW = Math.min(rc.size - 6 * s, r.measure(label, fs, '700') + 18 * s);
  var px = cx - pillW / 2;
  var py = cy - pillH / 2;

  r.roundRect(px, py, pillW, pillH, pillH / 2, th.color.card);
  r.strokeRoundRect(px, py, pillW, pillH, pillH / 2,
    draw.alpha(th.color.cta, 0.55), 1 * s);
  r.text(label, cx, cy + 1, {
    size: fs,
    weight: '700',
    color: th.color.cta,
    align: 'center',
    maxWidth: pillW - 8 * s
  });
};

/** 教学关突破口：在空格上画柔和的呼吸光，放下猫后自动消失 */
GameScene.prototype._renderFocus = function (r, shakeX) {
  if (this.focus < 0 || this.focus >= this.cells.length) return;
  if (this.cells[this.focus] === CAT) return;

  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var geom = L.geom;
  var rc = this.app.layout.cellRect(geom, Math.floor(this.focus / this.n), this.focus % this.n);
  var ax = L.board.x + rc.x + shakeX;
  var ay = L.board.y + rc.y;
  var pulse = (Math.sin(clock.now() / 320) + 1) / 2;

  r.roundRect(ax - 1, ay - 1, rc.size + 2, rc.size + 2, geom.radius,
    draw.alpha(th.color.highlight, 0.30 + 0.28 * pulse));
  r.strokeRoundRect(ax - 1, ay - 1, rc.size + 2, rc.size + 2, geom.radius,
    draw.alpha(th.color.cta, 0.55 + 0.35 * pulse), 2.5 * s);

  r.ctx.globalAlpha = 0.55 + 0.35 * pulse;
  draw.iconStar(r, ax + rc.size / 2, ay + rc.size / 2, rc.size * 0.42, th.color.cta);
  r.ctx.globalAlpha = 1;
};

/** 放置反馈：合法放置为品牌色扩散环，冲突放置为红色扩散环 */
GameScene.prototype._renderFx = function (r, shakeX) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var geom = L.geom;

  for (var f = 0; f < this.fx.length; f++) {
    var fx = this.fx[f];
    var rc = this.app.layout.cellRect(geom, Math.floor(fx.i / this.n), fx.i % this.n);
    var k = Math.min(1, fx.t / FX_LIFE);
    var e = 1 - Math.pow(1 - k, 2);
    var grow = rc.size * (0.05 + 0.30 * e);
    var color = fx.kind === 'bad' ? th.color.conflict : th.color.brand;

    r.strokeRoundRect(
      L.board.x + rc.x + shakeX - grow,
      L.board.y + rc.y - grow,
      rc.size + grow * 2,
      rc.size + grow * 2,
      geom.radius + grow * 0.5,
      draw.alpha(color, 0.9 * (1 - k)),
      3 * s * (1 - k * 0.6)
    );
  }
};

GameScene.prototype._renderBand = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var band = L.band;

  draw.waveBand(r, 0, band.y, r.w, band.h, th.color.band, th.color.bandDeep);

  var icons = [draw.iconUndo, draw.iconRestart, draw.iconBulb];
  var labels = [copy.toolUndo, copy.toolRestart, copy.toolHint];
  var shade = 'rgba(18, 62, 82, 0.28)';

  for (var i = 0; i < L.tools.length; i++) {
    var t = L.tools[i];

    // 闲置一段时间后，提示按钮柔和呼吸，提醒玩家可以求助
    if (t.key === 'hint' && this.hintGlowT > 0) {
      var gk = (Math.sin(clock.now() / 260) + 1) / 2;
      r.strokeCircle(t.cx, t.cy, t.r + (5 + 3 * gk) * s,
        draw.alpha(th.color.highlight, 0.45 + 0.45 * gk), 3 * s);
    }

    r.circle(t.cx, t.cy, t.r, 'rgba(255, 255, 255, 0.95)');
    icons[i](r, t.cx, t.cy, 22 * s, th.color.ink);
    // 先画 1px 阴影再画正文，浅蓝底上白字也读得清
    r.text(labels[i], t.cx, t.cy + t.r + 11 * s + 1, {
      size: th.font.tool,
      weight: '600',
      color: shade,
      align: 'center'
    });
    r.text(labels[i], t.cx, t.cy + t.r + 11 * s, {
      size: th.font.tool,
      weight: '600',
      color: th.color.textOnColor,
      align: 'center'
    });

    // 提示按钮右上角：教学关显示“免”，其余显示剩余提示券
    if (t.key === 'hint') {
      var free = this._freeHint();
      var tickets = this.app.progress.tickets();
      var br = 9 * s;
      var bx = t.cx + t.r * 0.70;
      var by = t.cy - t.r * 0.70;
      r.circle(bx, by, br, free || tickets > 0 ? th.color.cta : th.color.bgSunken);
      r.strokeCircle(bx, by, br, th.color.card, 1.5 * s);
      r.text(free ? copy.hintFreeBadge : String(Math.min(99, tickets)), bx, by + 0.5, {
        size: th.font.micro,
        weight: '700',
        color: free || tickets > 0 ? th.color.textOnColor : th.color.textSoft,
        align: 'center'
      });
    }
  }

  r.text(copy.tagline, r.w / 2, L.taglineY + 1, {
    size: th.font.tagline,
    weight: '600',
    color: shade,
    align: 'center',
    maxWidth: r.w - 32 * s
  });
  r.text(copy.tagline, r.w / 2, L.taglineY, {
    size: th.font.tagline,
    weight: '600',
    color: th.color.textOnColor,
    align: 'center',
    maxWidth: r.w - 32 * s
  });
};

/* ---------------- 棋盘图层 ---------------- */

GameScene.prototype._buildBoardLayer = function () {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = this.L;
  var geom = L.geom;
  var size = L.board.size;
  var margin = 10 * s;
  var lw = size + margin * 2;

  var layer = app.renderer.layer(lw, lw);
  if (!layer) return null;

  var lr = new Renderer(layer.canvas, layer.ctx, lw, lw, app.renderer.dpr);
  lr.begin();
  var ctx = lr.ctx;

  // 两层低透明度外扩当作阴影，避免每帧 shadowBlur
  ctx.fillStyle = 'rgba(90, 60, 40, 0.06)';
  lr.roundPath(margin, margin + 4, size, size, th.radius.board);
  ctx.fill();
  ctx.fillStyle = 'rgba(90, 60, 40, 0.05)';
  lr.roundPath(margin, margin + 8, size, size, th.radius.board);
  ctx.fill();

  lr.roundRect(margin, margin, size, size, th.radius.board, th.color.card);
  lr.strokeRoundRect(margin, margin, size, size, th.radius.board, th.color.border, 1);

  for (var row = 0; row < this.n; row++) {
    for (var col = 0; col < this.n; col++) {
      var rc = app.layout.cellRect(geom, row, col);
      var color = this._regionColor(this.regions[row * this.n + col]);
      lr.roundRect(margin + rc.x, margin + rc.y, rc.size, rc.size, geom.radius, color);
    }
  }

  return { layer: layer, x: L.board.x - margin, y: L.board.y - margin };
};

/* ---------------- 状态 ---------------- */

GameScene.prototype._regionColor = function (g) {
  if (this.regionColors && this.regionColors[g]) return this.regionColors[g];
  var region = this.app.theme.region;
  return region[g % region.length];
};

GameScene.prototype._catFor = function (g) {
  // S5：装备的猫会出现在棋盘的每一只猫上；未解锁时回退默认猫
  return this.app.collection.equippedCat();
};

GameScene.prototype._regionHasCat = function (g) {
  var n = this.n;
  for (var i = 0; i < n * n; i++) {
    if (this.cells[i] === CAT && this.regions[i] === g) return true;
  }
  return false;
};

GameScene.prototype._recompute = function () {
  var list = [];
  for (var i = 0; i < this.cells.length; i++) {
    if (this.cells[i] === CAT) list.push(i);
  }
  var res = rules.analyze(list, this.n, this.regions);
  this.conflict = res.conflict;

  if (res.solved && !this.solvedFlag) {
    this.solvedFlag = true;
    this.timeMs = Math.round(this.elapsed * 1000);
    this.hintsAtSolve = this.hintsUsed;
    this.settleDelay = config.RESULT_DELAY;
    this._settle();
  } else if (!res.solved) {
    this.solvedFlag = false;
  }
};

/** 只保存盘面与计数，不保存撤销栈/动画；已通关则不写 */
GameScene.prototype._saveResume = function () {
  if (this.dailyMode || this.solvedFlag || !this.level) return;
  this.app.progress.saveResume({
    index: this.index,
    n: this.n,
    cells: this.cells,
    timeMs: Math.round(this.elapsed * 1000),
    moves: this.moves,
    mistakes: this.mistakes,
    hintsUsed: this.hintsUsed
  });
};

GameScene.prototype.onHide = function () {
  this._saveResume();
};

GameScene.prototype.exit = function () {
  this._saveResume();
};

GameScene.prototype._apply = function (i, v, silent) {
  if (this.givenSet[i]) return;
  this.cells[i] = v;
  if (v === CAT) {
    this.popAt[i] = clock.now();
    if (!silent) this.app.progress.addCatsPlaced(1);
  } else {
    delete this.popAt[i];
  }
  this._recompute();

  // 错格按规则统计：放下即冲突算一次，提示放置不会触发
  if (!silent && v === CAT && this.conflict[i]) this.mistakes++;
};

GameScene.prototype._cycle = function (i) {
  if (this.solvedFlag) return;
  this.idleT = 0;
  this.hintGlowT = 0;
  if (this.givenSet[i]) {
    this.app.toast.show(copy.toastGivenLocked);
    return;
  }

  var prev = this.cells[i];
  var next = prev === EMPTY ? MARK : (prev === MARK ? CAT : EMPTY);
  this.undoStack.push({ i: i, prev: prev });
  if (this.undoStack.length > 300) this.undoStack.shift();
  this.moves++;
  this._apply(i, next);

  if (next === CAT) {
    if (this.conflict[i]) {
      this.shakeT = ERROR_SHAKE;
      this.fx.push({ i: i, kind: 'bad', t: 0 });
      // 前 5 关的第一次冲突优先给“不会失败”的安抚；之后恢复具体原因
      var msg = tutorial.isMerciful(this.index, this.dailyMode) && this.mistakes <= 1 ?
        copy.toastMistakeSafe : this._conflictReason(i);
      this.app.toast.show(msg);
    } else {
      this.fx.push({ i: i, kind: 'ok', t: 0 });
    }
  }

  this._saveResume();
};

/** 新放下的猫与哪只猫冲突，返回对应文案 */
GameScene.prototype._conflictReason = function (idx) {
  var n = this.n;
  var r = Math.floor(idx / n);
  var c = idx % n;
  var g = this.regions[idx];

  for (var j = 0; j < this.cells.length; j++) {
    if (j === idx || this.cells[j] !== CAT) continue;
    var r2 = Math.floor(j / n);
    var c2 = j % n;
    if (r2 === r) return copy.errorRow;
    if (c2 === c) return copy.errorCol;
    if (this.regions[j] === g) return copy.errorRegion;
    if (Math.abs(r2 - r) <= 1 && Math.abs(c2 - c) <= 1) return copy.errorAdjacent;
  }
  return copy.toastConflict;
};

GameScene.prototype._undo = function () {
  if (this.solvedFlag) return;
  this.idleT = 0;
  this.hintGlowT = 0;
  if (!this.undoStack.length) {
    this.app.toast.show(copy.toastNoUndo);
    return;
  }
  var op = this.undoStack.pop();
  if (op.snapshot) {
    this.cells = op.snapshot.slice();
    this.popAt = {};
    this._applyGivens();
    this.app.progress.addUndos();
    this._recompute();
  } else {
    this._apply(op.i, op.prev, true);
    this._applyGivens();
    this.app.progress.addUndos();
  }
  this._saveResume();
};

/**
 * 重新开始：清空盘面并重置本局计时/步数/失误。
 * 已消耗的提示券不回退，hintsUsed 也保留，避免"提示后重开拿满分"。
 * 清盘前压入快照，误触后可用撤销恢复盘面。
 */
GameScene.prototype._restart = function () {
  if (this.solvedFlag) return;
  this.idleT = 0;
  this.hintGlowT = 0;

  // 预放猫不算玩家的操作：只统计/快照玩家自己放下的内容
  var has = false;
  for (var i = 0; i < this.cells.length; i++) {
    if (!this.givenSet[i] && this.cells[i] !== EMPTY) { has = true; break; }
  }

  if (has) {
    this.undoStack.push({ snapshot: this.cells.slice() });
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.app.progress.addErases();
  }

  for (var j = 0; j < this.cells.length; j++) this.cells[j] = EMPTY;
  this.popAt = {};
  this.fx = [];
  this.shakeT = 0;
  this.elapsed = 0;
  this.moves = 0;
  this.mistakes = 0;
  this.idleShown = false;
  this._applyGivens();
  this._recompute();
  this._saveResume();

  this.app.toast.show(copy.toastRestarted);
};

/* ---------------- 提示 ---------------- */

/**
 * 选一个"当前盘面可放"的答案格。
 * 优先返回被 R1–R3 局部推导强制的格子（某行/列/区只剩一个可放位置），
 * 否则退回第一个可放的答案格。盘面无冲突时可保证返回 -1 以外的值。
 */
GameScene.prototype._hintCell = function () {
  var n = this.n;
  var cells = this.cells;
  var regions = this.regions;
  var solution = this.level.solution;
  var hasRow = [];
  var hasCol = [];
  var hasRegion = [];
  var i;

  for (i = 0; i < cells.length; i++) {
    if (cells[i] !== CAT) continue;
    var r0 = Math.floor(i / n);
    var c0 = i % n;
    hasRow[r0] = true;
    hasCol[c0] = true;
    hasRegion[regions[i]] = true;
  }

  function canPlace(idx) {
    var r = Math.floor(idx / n);
    var c = idx % n;
    var g = regions[idx];
    if (hasRow[r] || hasCol[c] || hasRegion[g]) return false;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr;
        var cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        if (cells[rr * n + cc] === CAT) return false;
      }
    }
    return true;
  }

  var rowAvail = [];
  var colAvail = [];
  var regAvail = [];
  for (i = 0; i < cells.length; i++) {
    if (!canPlace(i)) continue;
    var r1 = Math.floor(i / n);
    var c1 = i % n;
    rowAvail[r1] = (rowAvail[r1] || 0) + 1;
    colAvail[c1] = (colAvail[c1] || 0) + 1;
    regAvail[regions[i]] = (regAvail[regions[i]] || 0) + 1;
  }

  var fallback = -1;
  for (var r = 0; r < n; r++) {
    var c = solution[r];
    var idx = r * n + c;
    if (!canPlace(idx)) continue;
    if (fallback < 0) fallback = idx;
    var g = regions[idx];
    if (rowAvail[r] === 1 || colAvail[c] === 1 || regAvail[g] === 1) return idx;
  }
  return fallback;
};

GameScene.prototype._freeHint = function () {
  return tutorial.isFreeHintLevel(this.index, this.dailyMode);
};

/** 返回 'ticket' | 'coin'；资源不足时提示并返回 '' */
GameScene.prototype._payHint = function () {
  var progress = this.app.progress;
  if (progress.tickets() > 0) {
    progress.spendTicket();
    return 'ticket';
  }
  if (progress.coins() >= config.HINT_COIN_COST) {
    progress.spendCoins(config.HINT_COIN_COST);
    return 'coin';
  }
  this.app.toast.show(copy.toastNoHintRes);
  return '';
};

GameScene.prototype._hint = function () {
  if (this.solvedFlag) return;
  this.idleT = 0;
  this.hintGlowT = 0;
  var idx = this._hintCell();
  if (idx < 0) {
    this.app.toast.show(copy.toastNoHintCell);
    return;
  }

  // 前 10 关教学提示免费；仍计入 hintsUsed，避免用提示刷三爪
  var paid = this._freeHint() ? 'free' : this._payHint();
  if (!paid) return;

  this.hintsUsed++;
  this.app.progress.addHints(1);
  this._apply(idx, CAT);
  this._saveResume();

  if (!this.solvedFlag) {
    if (paid === 'free') this.app.toast.show(copy.toastHintFree);
    else if (paid === 'ticket') this.app.toast.show(copy.toastHintTicket);
    else this.app.toast.show(format(copy.toastHintCoin, config.HINT_COIN_COST));
  }
};

/* ---------------- 结算 ---------------- */

GameScene.prototype._settle = function () {
  var list = [];
  for (var i = 0; i < this.cells.length; i++) {
    if (this.cells[i] === CAT) list.push(i);
  }

  // 二次校验：只按规则，不读答案；异常时不结算，回到对局
  var check = rules.analyze(list, this.n, this.regions);
  if (!check.solved) {
    logger.warn('结算校验未通过，回到对局');
    this.solvedFlag = false;
    this.settleDelay = 0;
    return;
  }

  // 通关瞬间把剩余空格补成打叉，结算前的庆祝画面盘面完整，不做空白结算
  for (var j = 0; j < this.cells.length; j++) {
    if (this.cells[j] === EMPTY) this.cells[j] = MARK;
  }

  var paws = 1;
  if (this.hintsAtSolve === 0) {
    paws = 2;
    if (this.mistakes === 0) paws = 3;
  }

  if (this.dailyMode) {
    var dailyRes = this.app.daily.complete({ date: this.dailyDate, timeMs: this.timeMs, paws: paws });
    var meta = this.app.metaRefresh();
    this.app.save.flushHard();
    this.resultInfo = {
      daily: true,
      dailyDate: this.dailyDate,
      levelIndex: 0,
      n: this.n,
      timeMs: this.timeMs,
      moves: this.moves,
      hints: this.hintsAtSolve,
      mistakes: this.mistakes,
      paws: paws,
      coins: dailyRes.coins || 0,
      fragments: dailyRes.fragments || 0,
      firstClear: !!dailyRes.ok,
      replay: !!dailyRes.replay,
      guarded: !!dailyRes.guarded,
      streak: dailyRes.streak || 0,
      bestStreak: dailyRes.bestStreak || 0,
      dailyTotal: dailyRes.total || 0,
      newCats: meta.cats,
      newAchievements: meta.achievements,
      nextIndex: 0
    };
    return;
  }

  var res = this.app.progress.completeLevel(this.index, { timeMs: this.timeMs, paws: paws });
  var meta2 = this.app.metaRefresh();
  this.app.save.flushHard();

  this.resultInfo = {
    levelIndex: this.index,
    n: this.n,
    timeMs: this.timeMs,
    moves: this.moves,
    hints: this.hintsAtSolve,
    mistakes: this.mistakes,
    paws: paws,
    coins: res.coins,
    firstClear: res.firstClear,
    isNewBest: res.isNewBest,
    bestTimeMs: res.bestTimeMs,
    newCats: meta2.cats,
    newAchievements: meta2.achievements,
    nextIndex: levels.get(this.index + 1) ? this.index + 1 : 0
  };
};

GameScene.prototype._openResult = function () {
  if (this.resultOpened || !this.resultInfo) return;
  this.resultOpened = true;
  this.settleDelay = 0;
  this.app.toast.clear(); // 提示 toast 不跟随进入结算页
  this.app.sm.push('result', this.resultInfo);
};

/* ---------------- 输入 ---------------- */

GameScene.prototype._cellAt = function (x, y) {
  var L = this.L;
  var g = L.geom;
  var lx = x - L.board.x;
  var ly = y - L.board.y;
  if (lx < 0 || ly < 0 || lx > L.board.size || ly > L.board.size) return -1;

  var step = g.tile + g.gap;
  var col = Math.floor((lx - g.pad) / step);
  var row = Math.floor((ly - g.pad) / step);
  if (col < 0 || col >= this.n || row < 0 || row >= this.n) return -1;

  var ox = lx - g.pad - col * step;
  var oy = ly - g.pad - row * step;
  if (ox < 0 || oy < 0 || ox > g.tile || oy > g.tile) return -1; // 点在缝隙里，忽略

  return row * this.n + col;
};

GameScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;

  // 规则卡是唯一输入目标：读完点“知道啦”才继续
  if (this.coach) {
    var CL = this.app.layout.coach();
    if (hit.inRect(x, y, CL.cta)) this._dismissCoach();
    return;
  }

  if (this.solvedFlag) return;
  var app = this.app;
  var L = this.L;
  this.idleT = 0;

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }
  if (hit.inCircleLoose(x, y, L.help, 4)) {
    app.sm.push('guide');
    return;
  }
  if (hit.inCircleLoose(x, y, L.gear, 4)) {
    app.toast.show(copy.toastGear);
    return;
  }
  for (var i = 0; i < L.tools.length; i++) {
    var t = L.tools[i];
    if (hit.inCircle(x, y, t)) {
      if (t.key === 'undo') this._undo();
      else if (t.key === 'restart') this._restart();
      else this._hint();
      return;
    }
  }

  var idx = this._cellAt(x, y);
  if (idx >= 0) this._cycle(idx);
};

/* ---------------- 工具 ---------------- */

GameScene.prototype._dismissCoach = function () {
  if (!this.coach) return;
  this.app.progress.markCoachSeen(this.coach.id);
  this.coach = null;
  this.idleT = 0;
};

function parseRegions(rows, n) {
  var out = [];
  for (var r = 0; r < n; r++) {
    var row = rows[r] || '';
    for (var c = 0; c < n; c++) {
      var code = row.charCodeAt(c) - 97; // 'a' -> 0
      if (isNaN(code) || code < 0 || code >= n) code = 0;
      out.push(code);
    }
  }
  return out;
}

module.exports = GameScene;
