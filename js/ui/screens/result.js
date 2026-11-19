/**
 * 结算页：猫爪评分 → 用时/步数/最佳 → 首通金币 → 下一关 / 返回地图。
 * 庆祝粒子只在前 1.5 秒绘制，数量固定，不产生持续开销。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var cats = require('../../data/cats');
var hit = require('../hit');
var format = require('../../core/format');

var PARTICLE_COUNT = 18;
var PARTICLE_LIFE = 1.5;

function ResultScene(app) {
  this.app = app;
  this.info = null;
  this.t = 0;
  this.particles = [];
}

ResultScene.prototype.enter = function (params) {
  this.info = params || {};
  this.t = 0;
  this.particles = [];

  var w = this.app.env.width;
  var theme = this.app.theme;
  for (var i = 0; i < PARTICLE_COUNT; i++) {
    this.particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 26,
      vy: 95 + Math.random() * 110,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 7,
      size: 5 + Math.random() * 6,
      color: theme.region[i % theme.region.length],
      paw: i % 4 === 0,
      phase: Math.random() * Math.PI * 2
    });
  }
};

ResultScene.prototype.update = function (dt) {
  this.t += dt;
  if (this.t > PARTICLE_LIFE + 0.6) return;

  for (var i = 0; i < this.particles.length; i++) {
    var p = this.particles[i];
    p.x += p.vx * dt + Math.sin(this.t * 3 + p.phase) * 0.6;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
};

ResultScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var s = app.layout.s;
  var L = app.layout.result();
  var info = this.info || {};
  this.L = L;

  r.fill(th.color.bg);

  r.ctx.globalAlpha = 0.5;
  r.circle(r.w * 0.92, L.cat.cy + 20 * s, 86 * s, th.color.brandSoft);
  r.circle(r.w * 0.06, L.stats.y + 30 * s, 64 * s, th.color.ctaSoft);
  r.ctx.globalAlpha = 1;

  this._renderConfetti(r);
  this._renderCat(r);
  this._renderTitle(r, info);
  this._renderPaws(r, info);
  this._renderStats(r, info);
  this._renderReward(r, info);
  this._renderButtons(r, info);
};

ResultScene.prototype._renderCat = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var bob = Math.sin(this.t * 1.8) * 2 * s;
  var idx = Math.max(1, (this.info && this.info.levelIndex) || 1);
  var cat = cats.all[(idx - 1) % cats.all.length];

  r.circle(L.cat.cx, L.cat.cy + 3 * s, L.cat.r, th.color.card);
  r.strokeCircle(L.cat.cx, L.cat.cy + 3 * s, L.cat.r, th.color.border, 1);
  draw.catFace(r, L.cat.cx, L.cat.cy + bob, L.cat.size, cat, {});
};

ResultScene.prototype._renderTitle = function (r, info) {
  var th = this.app.theme;
  var L = this.L;

  r.text(copy.resultTitle, r.w / 2, L.titleY, {
    size: th.font.hudValue,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
  r.text(format(copy.resultSub, info.levelIndex || 1, info.n || 5, info.n || 5), r.w / 2, L.subY, {
    size: th.font.small,
    color: th.color.textSoft,
    align: 'center'
  });
};

ResultScene.prototype._renderPaws = function (r, info) {
  var th = this.app.theme;
  var L = this.L;
  var earned = Math.min(3, Math.max(1, info.paws || 1));
  var totalW = L.paws.size * 3 + L.paws.gap * 2;
  var x0 = (r.w - totalW) / 2 + L.paws.size / 2;

  for (var i = 0; i < 3; i++) {
    var px = x0 + i * (L.paws.size + L.paws.gap);

    if (i >= earned) {
      draw.iconPaw(r, px, L.paws.cy, L.paws.size, draw.alpha(th.color.textSoft, 0.18));
      continue;
    }

    var k = (this.t - 0.10 - i * 0.10) / 0.24;
    if (k <= 0) continue;
    if (k > 1) k = 1;
    var grow = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3)) + Math.sin(Math.PI * k) * 0.12;

    r.ctx.save();
    r.ctx.translate(px, L.paws.cy);
    r.ctx.scale(grow, grow);
    draw.iconPaw(r, 0, 0, L.paws.size, th.color.cta);
    r.ctx.restore();
  }

  var label = copy['resultPaws' + earned];
  r.text(label, r.w / 2, L.ratingY, {
    size: th.font.small,
    weight: '600',
    color: th.color.textSoft,
    align: 'center'
  });
};

ResultScene.prototype._renderStats = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var st = this.L.stats;
  var colW = st.w / 2;
  var mid = st.x + colW;
  var yLabel = st.y + 22 * s;
  var yValue = st.y + 47 * s;

  draw.softShadow(r, st.x, st.y, st.w, st.h, th.radius.card);
  r.roundRect(st.x, st.y, st.w, st.h, th.radius.card, th.color.card);
  r.strokeRoundRect(st.x, st.y, st.w, st.h, th.radius.card, th.color.border, 1);
  r.line(mid, st.y + 14 * s, mid, st.y + st.h - 34 * s, th.color.border, 1);

  r.text(copy.resultTime, st.x + colW / 2, yLabel, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center'
  });
  r.text(copy.resultMoves, mid + colW / 2, yLabel, {
    size: th.font.micro,
    color: th.color.textSoft,
    align: 'center'
  });

  r.text(format.duration(info.timeMs || 0), st.x + colW / 2, yValue, {
    size: th.font.banner,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });
  r.text(String(info.moves || 0), mid + colW / 2, yValue, {
    size: th.font.banner,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  if (info.bestTimeMs > 0) {
    var tpl = info.isNewBest ? copy.resultBestNew : copy.resultBest;
    r.text(format(tpl, format.duration(info.bestTimeMs)), st.x + st.w / 2, st.y + st.h - 18 * s, {
      size: th.font.micro,
      weight: info.isNewBest ? '700' : '400',
      color: info.isNewBest ? th.color.cta : th.color.textSoft,
      align: 'center'
    });
  }
};

ResultScene.prototype._renderReward = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var cy = this.L.reward.cy;

  if (!(info.firstClear && info.coins > 0)) {
    r.text(copy.resultReplay, r.w / 2, cy, {
      size: th.font.small,
      color: th.color.textSoft,
      align: 'center'
    });
    return;
  }

  var label = format(copy.resultCoins, info.coins);
  var fs = th.font.body;
  var w = r.measure(label, fs, '700') + 56 * s;
  var h = 34 * s;
  var x = (r.w - w) / 2;
  var y = cy - h / 2;

  r.roundRect(x, y, w, h, h / 2, th.color.highlight);
  draw.iconCoin(r, x + 18 * s, cy, 18 * s);
  r.text(label, x + 34 * s, cy + 1, {
    size: fs,
    weight: '700',
    color: th.color.text
  });
};

ResultScene.prototype._renderButtons = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var cta = L.cta;

  draw.softShadow(r, cta.x, cta.y, cta.w, cta.h, cta.h / 2);
  r.roundRect(cta.x, cta.y, cta.w, cta.h, cta.h / 2, th.color.cta);
  r.text(info.nextIndex ? copy.resultNext : copy.resultMap, r.w / 2, cta.y + cta.h / 2 + 1, {
    size: th.font.banner,
    weight: '700',
    color: th.color.textOnColor,
    align: 'center'
  });

  if (info.nextIndex) {
    var m = L.map;
    r.roundRect(m.x, m.y, m.w, m.h, m.h / 2, th.color.card);
    r.strokeRoundRect(m.x, m.y, m.w, m.h, m.h / 2, th.color.border, 1);
    r.text(copy.resultMap, r.w / 2, m.y + m.h / 2 + 1, {
      size: th.font.body,
      weight: '700',
      color: th.color.text,
      align: 'center'
    });
  }

  if (!info.nextIndex) {
    r.text(copy.resultAllDone || '', r.w / 2, L.cta.y - 18 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center'
    });
  }
};

ResultScene.prototype._renderConfetti = function (r) {
  if (this.t > PARTICLE_LIFE) return;

  var ctx = r.ctx;
  var a = this.t < 0.9 ? 1 : Math.max(0, (PARTICLE_LIFE - this.t) / 0.6);
  ctx.save();
  ctx.globalAlpha = a;

  for (var i = 0; i < this.particles.length; i++) {
    var p = this.particles[i];
    if (p.y > r.h + 24) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.paw) {
      draw.iconPaw(r, 0, 0, p.size * 2.4, p.color);
    } else {
      r.roundRect(-p.size / 2, -p.size / 4, p.size, p.size / 2, p.size / 4, p.color);
    }
    ctx.restore();
  }

  ctx.restore();
};

/* ---------------- 输入 ---------------- */

ResultScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var L = this.L;
  if (!L) return;
  var info = this.info || {};

  if (hit.inRect(x, y, L.cta)) {
    this.app.haptic();
    if (info.nextIndex) this._next();
    else this._toMap();
    return;
  }

  if (info.nextIndex && hit.inRect(x, y, L.map)) {
    this.app.haptic();
    this._toMap();
  }
};

ResultScene.prototype._next = function () {
  var info = this.info || {};
  this.app.sm.pop();
  this.app.sm.replace('game', { levelIndex: info.nextIndex });
};

ResultScene.prototype._toMap = function () {
  this.app.sm.pop();
  var top = this.app.sm.top();
  if (top && top.sceneName === 'game') this.app.sm.pop();
};

module.exports = ResultScene;
