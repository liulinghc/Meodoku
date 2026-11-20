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
var SLIDE_TIME = 0.26;
var SLIDE_TRAVEL = 0.22;

/** 当前能进入的最大章节：按各章起点是否已解锁判断 */
function maxUnlockedChapter(progress) {
  var max = 1;
  for (var c = 1; c <= levels.chapterCount(); c++) {
    if (progress.isUnlocked(levels.chapterRange(c).start)) max = c;
  }
  return max;
}

function LevelmapScene(app) {
  this.app = app;
  this.chapter = 1;
  this.nodes = [];
  this.prevC = null;
  this.nextC = null;
  this.t = 0;
  this.slide = null;
}

LevelmapScene.prototype.enter = function (params) {
  var progress = this.app.progress;
  var maxChapter = maxUnlockedChapter(progress);
  var requested = (params && params.chapter) || levels.currentChapter(progress);
  this.chapter = Math.max(1, Math.min(requested, maxChapter));
  this.nodes = [];
  this.t = 0;
  this.slide = null;
};

LevelmapScene.prototype.update = function (dt) {
  this.t += dt;
  if (this.slide) {
    this.slide.t += dt;
    if (this.slide.t >= SLIDE_TIME) this.slide = null;
  }
};

LevelmapScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.levelmap();
  this.L = L;

  r.fill(th.color.bg);

  this._renderTop(r);

  // 切章时章节头与节点一起横向滑入，顶部栏保持不动
  var slide = this._slideState();
  if (slide) {
    r.save();
    r.ctx.globalAlpha = slide.alpha;
    r.ctx.translate(slide.dx, 0);
  }
  this._renderChapter(r);
  this._renderNodes(r);
  if (slide) r.restore();
  r.ctx.globalAlpha = 1;
};

/** 切章滑动：方向 +1 从右侧进入，-1 从左侧进入 */
LevelmapScene.prototype._startSlide = function (dir) {
  this.slide = { dir: dir > 0 ? 1 : -1, t: 0 };
};

LevelmapScene.prototype._slideState = function () {
  if (!this.slide) return null;
  var p = Math.min(1, this.slide.t / SLIDE_TIME);
  var e = 1 - Math.pow(1 - p, 3);
  return {
    dx: this.slide.dir * (1 - e) * this.app.layout.w * SLIDE_TRAVEL,
    alpha: 0.45 + 0.55 * e,
    p: p
  };
};

LevelmapScene.prototype._renderTop = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;

  draw.iconCircle(r, L.back.cx, L.back.cy, L.back.r, th.color.card, draw.iconBack, 20 * s, th.color.text);

  r.text(copy.levelmapTitle, r.w / 2, L.topBar.y + L.topBar.h / 2, {
    size: th.font.pageTitle,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
};

LevelmapScene.prototype._renderChapter = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var ch = L.chapter;
  var progress = this.app.progress;
  var range = levels.chapterRange(this.chapter);
  var total = range.end - range.start + 1;
  var done = 0;
  for (var i = range.start; i <= range.end; i++) {
    if (progress.isCompleted(i)) done++;
  }
  var chapterLocked = !progress.isUnlocked(range.start);
  var dim = th.color.textSoft;

  // 通栏白色横幅：投影 + 白卡 + 细描边
  draw.softShadow(r, ch.x, ch.y, ch.w, ch.h, th.radius.card);
  r.roundRect(ch.x, ch.y, ch.w, ch.h, th.radius.card, th.color.card);
  r.strokeRoundRect(ch.x, ch.y, ch.w, ch.h, th.radius.card, th.color.border, 1);

  this.prevC = ch.prev;
  this.nextC = ch.next;
  this._renderChapterArrow(r, ch.prev, -1, dim, s, th);
  this._renderChapterArrow(r, ch.next, 1, dim, s, th);

  var titleX = ch.title.x;
  if (chapterLocked) {
    draw.iconLock(r, titleX, ch.title.y, 13 * s, dim);
    titleX += 17 * s;
  }
  r.text(format(copy.chapterTitle, this.chapter), titleX, ch.title.y, {
    size: th.font.banner,
    weight: '800',
    color: chapterLocked ? dim : th.color.text
  });
  r.text(format(copy.chapterProgress, done, total), ch.progress.x, ch.progress.y, {
    size: th.font.small,
    weight: '600',
    color: th.color.textSoft,
    align: 'right'
  });

  // 章节进度条：未解锁章节不填色
  var bar = ch.bar;
  r.roundRect(bar.x, bar.y, bar.w, bar.h, bar.h / 2, th.color.bgSunken);
  if (!chapterLocked && done > 0) {
    var fillW = Math.max(bar.h, bar.w * done / total);
    r.roundRect(bar.x, bar.y, fillW, bar.h, bar.h / 2, th.color.brand);
  }
};

/** 章节翻页圆钮：奶油底 + 细描边 + 左右箭头 */
LevelmapScene.prototype._renderChapterArrow = function (r, a, dir, dim, s, th) {
  r.circle(a.cx, a.cy, a.r, th.color.surfaceWarm);
  r.strokeCircle(a.cx, a.cy, a.r, th.color.border, 1);

  var tipX = a.cx + dir * 3.5 * s;
  var tailX = a.cx - dir * 3.5 * s;
  var color = draw.alpha(dim, 0.85);
  r.line(tailX, a.cy - 5.5 * s, tipX, a.cy, color, 2.2 * s);
  r.line(tipX, a.cy, tailX, a.cy + 5.5 * s, color, 2.2 * s);
};

LevelmapScene.prototype._computeNodes = function () {
  var L = this.L;
  var range = levels.chapterRange(this.chapter);
  var count = range.end - range.start + 1;
  var colW = L.list.w / COLS;
  var rows = Math.ceil(count / COLS);
  // 高屏有富余时把行距放宽到上限，低屏保持紧凑，路径仍有足够长度
  var gap = L.nodeGap;
  if (rows > 1) {
    var roomy = (L.list.h - L.nodeR * 2 - L.nodePadTop - L.nodePadBottom) / (rows - 1);
    gap = Math.max(gap, Math.min(roomy, L.nodeGapMax));
  }
  var totalH = (rows - 1) * gap + L.nodeR * 2;
  var startY = L.list.y + Math.max(L.nodePadTop, (L.list.h - totalH) / 2) + L.nodeR;
  var nodes = [];
  for (var k = 0; k < count; k++) {
    var row = Math.floor(k / COLS);
    var pos = k % COLS;
    // 蛇形排布：偶数行从左到右，奇数行从右到左，路径自然折返向下
    var col = row % 2 === 0 ? pos : COLS - 1 - pos;
    nodes.push({
      index: range.start + k,
      x: colW * (col + 0.5),
      y: startY + row * gap
    });
  }
  return nodes;
};

/** 相邻节点之间的路径是否已点亮：两端都通关 */
LevelmapScene.prototype._segmentDone = function (a, b) {
  return this.app.progress.isCompleted(a.index) && this.app.progress.isCompleted(b.index);
};

/** 相邻节点的虚线路径；两端都已通关的段落换成品牌色 */
LevelmapScene.prototype._renderPath = function (r, nodes) {
  var th = this.app.theme;
  var path = this.L.path;
  var pad = path.endPad;

  for (var i = 0; i < nodes.length - 1; i++) {
    var a = nodes[i];
    var b = nodes[i + 1];
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len <= pad * 2 + 1) continue;
    var ux = dx / len;
    var uy = dy / len;
    var bothDone = this._segmentDone(a, b);
    var color = bothDone ? th.color.brand : draw.alpha(th.color.textSoft, 0.26);
    var lw = bothDone ? path.width + 0.5 : path.width;
    this._dashLine(r, a.x + ux * pad, a.y + uy * pad,
      b.x - ux * pad, b.y - uy * pad, color, lw, path.dash, path.gap);
  }
};

LevelmapScene.prototype._dashLine = function (r, x1, y1, x2, y2, color, lw, dash, gap) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len <= 0) return;
  var ux = dx / len;
  var uy = dy / len;
  for (var t = 0; t < len; t += dash + gap) {
    var end = Math.min(len, t + dash);
    r.line(x1 + ux * t, y1 + uy * t, x1 + ux * end, y1 + uy * end, color, lw);
  }
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

  this._renderPath(r, nodes);

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var isDone = progress.isCompleted(node.index);
    var unlocked = progress.isUnlocked(node.index);
    var isCurrent = node.index === current && !isDone;

    // 当前关：双层呼吸圈，节奏缓慢但不抢落猫按钮
    if (isCurrent) {
      var breathe = 0.5 + 0.5 * Math.sin(this.t * 3.2);
      r.strokeCircle(node.x, node.y, L.nodeR + (5 + 3 * breathe) * s,
        draw.alpha(th.color.cta, 0.10 + 0.16 * breathe), 3 * s);
      r.strokeCircle(node.x, node.y, L.nodeR + 2 * s,
        draw.alpha(th.color.cta, 0.16), 1.5 * s);
    }

    if (isDone) {
      r.circle(node.x, node.y, L.nodeR, th.color.brand);
      r.strokeCircle(node.x, node.y, L.nodeR - 1.5 * s,
        draw.alpha(th.color.textOnColor, 0.20), 1.5 * s);
    } else if (isCurrent) {
      r.circle(node.x, node.y, L.nodeR, th.color.cta);
      r.strokeCircle(node.x, node.y, L.nodeR - 1.5 * s,
        draw.alpha(th.color.textOnColor, 0.22), 1.5 * s);
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
      // 通关盖章：白底橙色印章圈，压在节点右上角
      var bx = node.x + L.nodeR * 0.72;
      var by = node.y - L.nodeR * 0.72;
      var stampR = 9 * s;
      r.circle(bx, by, stampR, th.color.card);
      r.strokeCircle(bx, by, stampR, th.color.cta, 1.6 * s);
      r.strokeCircle(bx, by, stampR - 2.2 * s, draw.alpha(th.color.cta, 0.24), 1);
      draw.iconCheck(r, bx, by, 10 * s, th.color.cta);

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

  // 滑入期间内容整体偏移，命中坐标同步回推，所见即所点
  var slide = this._slideState();
  var hx = slide ? x - slide.dx : x;

  if (this.prevC && hit.inCircleLoose(hx, y, this.prevC, 4)) {
    if (this.chapter > 1) {
      this.chapter--;
      this._startSlide(-1);
    } else {
      app.toast.show(copy.toastPrevChapter);
    }
    return;
  }
  if (this.nextC && hit.inCircleLoose(hx, y, this.nextC, 4)) {
    if (this.chapter >= levels.chapterCount()) {
      app.toast.show(copy.toastNextChapter);
    } else if (!app.progress.isUnlocked(levels.chapterRange(this.chapter + 1).start)) {
      app.toast.show(copy.toastChapterLocked);
    } else {
      this.chapter++;
      this._startSlide(1);
    }
    return;
  }

  for (var i = 0; i < this.nodes.length; i++) {
    var node = this.nodes[i];
    var dx = hx - node.x;
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
