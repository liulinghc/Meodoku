/**
 * 玩法说明：以弹窗形式覆盖在当前场景上（背景保留并压暗），不整屏切换。
 * 首次启动自动展示，也可从首页 / 对局右上角随时打开。
 * 说明内容只描述真实操作：单击打叉 → 再点放猫 → 再点清空。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var hit = require('../hit');

function GuideScene(app) {
  this.app = app;
  this.L = null;
}

GuideScene.prototype.enter = function () {
  this.L = null;
};

GuideScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.guide();
  this.L = L;

  // 重绘下层场景作为弹窗背景（只渲染，不转发输入）
  var stack = app.sm.stack;
  var below = stack.length > 1 ? stack[stack.length - 2] : null;
  if (below && below.render) {
    below.render(r);
  } else {
    r.fill(th.color.bg);
  }

  r.ctx.globalAlpha = 1;
  r.fill(th.color.mask);

  var c = L.card;
  draw.softShadow(r, c.x, c.y, c.w, c.h, th.radius.board);
  r.roundRect(c.x, c.y, c.w, c.h, th.radius.board, th.color.card);

  this._renderHeader(r, L);
  this._renderGoal(r, L);
  this._renderTap(r, L);
  this._renderTip(r, L);
  this._renderCta(r, L);
};

GuideScene.prototype._renderHeader = function (r, L) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var c = L.close;

  r.text(copy.guideTitle, r.w / 2, L.titleY, {
    size: th.font.body,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  r.circle(c.cx, c.cy, c.r, th.color.bgSunken);
  r.text(copy.guideCloseMark, c.cx, c.cy + 1, {
    size: th.font.banner,
    weight: '700',
    color: th.color.textSoft,
    align: 'center'
  });

  r.line(L.goal.x, L.dividerY, L.goal.x + L.goal.w, L.dividerY, th.color.border, 1);
};

GuideScene.prototype._renderGoal = function (r, L) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var g = L.goal;

  r.text(copy.guideGoalTitle, g.x, g.y + 22 * s, {
    size: th.font.body,
    weight: '700',
    color: th.color.text
  });
  r.text(copy.guideGoalLine1, g.x, g.y + 44 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    maxWidth: g.w
  });
  r.text(copy.guideGoalLine2, g.x, g.y + 62 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    maxWidth: g.w
  });
};

GuideScene.prototype._renderTap = function (r, L) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var t = L.tap;
  var labels = [copy.guideTap1, copy.guideTap2, copy.guideTap3];
  var color = th.region[0];
  var cat = this.app.collection.equippedCat();

  r.text(copy.guideTapTitle, t.x, t.y + 22 * s, {
    size: th.font.body,
    weight: '700',
    color: th.color.text
  });

  for (var i = 0; i < t.rows.length; i++) {
    var row = t.rows[i];
    var cx = row.x + row.size / 2;
    var cy = row.y + row.size / 2;

    r.roundRect(row.x, row.y, row.size, row.size, th.radius.tileSm, color);
    if (i === 0) {
      draw.xMark(r, cx, cy, row.size * 1.15, draw.xColorFor(color));
    } else if (i === 1) {
      draw.catFace(r, cx, cy + row.size * 0.04, row.size, cat, {});
    } else {
      r.text(copy.guideEmptyMark, cx, cy + 1, {
        size: th.font.small,
        weight: '700',
        color: draw.xColorFor(color),
        align: 'center'
      });
    }

    r.text(labels[i], row.x + row.size + 14 * s, cy + 1, {
      size: th.font.small,
      weight: '600',
      color: th.color.text,
      maxWidth: t.w - row.size - 18 * s
    });
  }
};

GuideScene.prototype._renderTip = function (r, L) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var t = L.tip;

  r.roundRect(t.x, t.y, t.w, t.h, th.radius.card, th.color.bgSunken);

  r.text(copy.guideTipTitle, t.x + 14 * s, t.y + 18 * s, {
    size: th.font.small,
    weight: '700',
    color: th.color.text
  });
  r.text(copy.guideTipLine1, t.x + 14 * s, t.y + 36 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    maxWidth: t.w - 28 * s
  });
  r.text(copy.guideTipLine2, t.x + 14 * s, t.y + 51 * s, {
    size: th.font.small,
    color: th.color.textSoft,
    maxWidth: t.w - 28 * s
  });
};

GuideScene.prototype._renderCta = function (r, L) {
  var th = this.app.theme;
  var c = L.cta;

  draw.softShadow(r, c.x, c.y, c.w, c.h, c.h / 2);
  r.roundRect(c.x, c.y, c.w, c.h, c.h / 2, th.color.cta);
  r.text(copy.guideDone, c.x + c.w / 2, c.y + c.h / 2 + 1, {
    size: th.font.banner,
    weight: '700',
    color: th.color.textOnColor,
    align: 'center'
  });
};

GuideScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var L = this.L || this.app.layout.guide();

  if (hit.inCircleLoose(x, y, L.close, 6) || hit.inRect(x, y, L.cta)) {
    this._close();
  }
};

GuideScene.prototype._close = function () {
  var app = this.app;
  if (!app.save.data.guideSeen) {
    app.save.data.guideSeen = true;
    app.save.touch();
  }
  app.sm.pop();
};

module.exports = GuideScene;
