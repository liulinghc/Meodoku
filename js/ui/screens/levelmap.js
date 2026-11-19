/**
 * 关卡地图：按章展示 20 个关卡节点（300 关共 15 章）。
 * 节点按真实解锁链置灰；已通关节点显示猫爪评分。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var levels = require('../../services/levels');
var hit = require('../hit');
var format = require('../../core/format');

var COLS = 4;

function LevelmapScene(app) {
  this.app = app;
  this.chapter = 1;
  this.nodes = [];
  this.prevC = null;
  this.nextC = null;
}

LevelmapScene.prototype.enter = function (params) {
  this.chapter = (params && params.chapter) || levels.currentChapter(this.app.progress);
  this.nodes = [];
};

LevelmapScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.levelmap();
  this.L = L;

  r.fill(th.color.bg);
  r.ctx.globalAlpha = 0.5;
  r.circle(r.w * 0.92, L.topBar.y + 160 * s, 90 * s, th.color.brandSoft);
  r.ctx.globalAlpha = 1;

  this._renderTop(r);
  this._renderChapter(r);
  this._renderNodes(r);
};

LevelmapScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  r.circle(L.back.cx, L.back.cy, L.back.r, th.color.card);
  r.strokeCircle(L.back.cx, L.back.cy, L.back.r, th.color.border, 1);
  draw.iconBack(r, L.back.cx, L.back.cy, 20 * s, th.color.text);

  r.text(copy.levelmapTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });
};

LevelmapScene.prototype._renderChapter = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var progress = this.app.progress;
  var range = levels.chapterRange(this.chapter);
  var total = range.end - range.start + 1;
  var done = 0;
  for (var i = range.start; i <= range.end; i++) {
    if (progress.isCompleted(i)) done++;
  }

  var w = Math.min(L.chapter.w, 210 * s);
  var x = (r.w - w) / 2;
  var y = L.chapter.y;
  var h = L.chapter.h;

  r.roundRect(x, y, w, h, h / 2, th.color.card);
  r.strokeRoundRect(x, y, w, h, h / 2, th.color.border, 1);

  var cy = y + h / 2;
  this.prevC = { cx: x + 20 * s, cy: cy, r: 14 * s };
  this.nextC = { cx: x + w - 20 * s, cy: cy, r: 14 * s };

  var dim = th.color.textSoft;
  r.line(this.prevC.cx + 3 * s, cy - 6 * s, this.prevC.cx - 3 * s, cy, dim, 2.2 * s);
  r.line(this.prevC.cx - 3 * s, cy, this.prevC.cx + 3 * s, cy + 6 * s, dim, 2.2 * s);
  r.line(this.nextC.cx - 3 * s, cy - 6 * s, this.nextC.cx + 3 * s, cy, dim, 2.2 * s);
  r.line(this.nextC.cx + 3 * s, cy, this.nextC.cx - 3 * s, cy + 6 * s, dim, 2.2 * s);

  // 整章未解锁时，标题前加锁并置灰
  var chapterLocked = !progress.isUnlocked(range.start);
  var titleX = this.prevC.cx + 22 * s;
  if (chapterLocked) {
    draw.iconLock(r, titleX, cy, 12 * s, dim);
    titleX += 14 * s;
  }

  r.text(format(copy.chapterTitle, this.chapter), titleX, cy, {
    size: th.font.body,
    weight: '700',
    color: chapterLocked ? dim : th.color.text
  });
  r.text(format(copy.chapterProgress, done, total), this.nextC.cx - 22 * s, cy, {
    size: th.font.small,
    weight: '600',
    color: th.color.textSoft,
    align: 'right'
  });
};

LevelmapScene.prototype._computeNodes = function () {
  var L = this.L;
  var range = levels.chapterRange(this.chapter);
  var count = range.end - range.start + 1;
  var colW = L.list.w / COLS;
  var rows = Math.ceil(count / COLS);
  var totalH = (rows - 1) * L.nodeGap + L.nodeR * 2;
  var startY = L.list.y + Math.max(L.nodePadTop, (L.list.h - totalH) / 2) + L.nodeR;
  var nodes = [];
  for (var k = 0; k < count; k++) {
    var row = Math.floor(k / COLS);
    var col = k % COLS;
    nodes.push({
      index: range.start + k,
      x: colW * (col + 0.5),
      y: startY + row * L.nodeGap
    });
  }
  return nodes;
};

LevelmapScene.prototype._renderNodes = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var progress = app.progress;
  var L = this.L;
  var nodes = this._computeNodes();
  var current = levels.current(progress);
  this.nodes = nodes;

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var isDone = progress.isCompleted(node.index);
    var unlocked = progress.isUnlocked(node.index);
    var isCurrent = node.index === current && !isDone;

    if (isCurrent) {
      r.strokeCircle(node.x, node.y, L.nodeR + 6 * s, draw.alpha(th.color.cta, 0.25), 4 * s);
    }

    if (isDone) {
      r.circle(node.x, node.y, L.nodeR, th.color.brand);
    } else if (isCurrent) {
      r.circle(node.x, node.y, L.nodeR, th.color.cta);
    } else if (unlocked) {
      r.circle(node.x, node.y, L.nodeR, th.color.card);
      r.strokeCircle(node.x, node.y, L.nodeR, th.color.border, 1.5);
    } else {
      r.circle(node.x, node.y, L.nodeR, th.color.bgSunken);
    }

    if (!unlocked) {
      draw.iconLock(r, node.x, node.y, 18 * s, th.color.textSoft);
      continue;
    }

    var fg = (isDone || isCurrent) ? th.color.textOnColor : th.color.text;
    r.text(String(node.index), node.x, node.y + 1, {
      size: th.font.body,
      weight: '700',
      color: fg,
      align: 'center'
    });

    if (isDone) {
      var bx = node.x + L.nodeR * 0.72;
      var by = node.y - L.nodeR * 0.72;
      r.circle(bx, by, 8 * s, th.color.card);
      draw.iconCheck(r, bx, by, 11 * s, th.color.brand);

      // 节点下方三枚爪印表示历史最佳评分
      var paws = progress.pawsOf(node.index);
      var pg = 9 * s;
      var py = node.y + L.nodeR + 9 * s;
      for (var p = 0; p < 3; p++) {
        var pc = p < paws ? th.color.cta : draw.alpha(th.color.textSoft, 0.22);
        draw.iconPaw(r, node.x + (p - 1) * pg, py, 7 * s, pc);
      }
    }
  }
};

LevelmapScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var app = this.app;
  var L = this.L;
  var s = app.layout.s;

  if (hit.inCircleLoose(x, y, L.back, 4)) {
    app.sm.pop();
    return;
  }

  if (this.prevC && hit.inCircleLoose(x, y, this.prevC, 4)) {
    if (this.chapter > 1) this.chapter--;
    else app.toast.show(copy.toastPrevChapter);
    return;
  }
  if (this.nextC && hit.inCircleLoose(x, y, this.nextC, 4)) {
    if (this.chapter < levels.chapterCount()) this.chapter++;
    else app.toast.show(copy.toastNextChapter);
    return;
  }

  for (var i = 0; i < this.nodes.length; i++) {
    var node = this.nodes[i];
    var dx = x - node.x;
    var dy = y - node.y;
    var rr = L.nodeR + 6 * s;
    if (dx * dx + dy * dy <= rr * rr) {
      if (!app.progress.isUnlocked(node.index)) {
        var range = levels.chapterRange(this.chapter);
        app.toast.show(app.progress.isUnlocked(range.start) ? copy.toastLocked : copy.toastChapterLocked);
      } else {
        app.sm.push('game', { levelIndex: node.index });
      }
      return;
    }
  }
};

module.exports = LevelmapScene;
