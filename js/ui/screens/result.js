/**
 * 结算页：猫爪评分 → 用时/步数/最佳 → 首通金币 → 下一关 / 返回地图。
 *
 * 入场按“猫 → 标题 → 猫爪 → 数据 → 奖励 → 按钮”分段推进，每段约 90–120ms；
 * 所有动效只影响绘制，不锁输入。彩纸分远近两层，总数固定 24 个；
 * 金币奖励只做一次放射，不产生持续开销。
 */
var draw = require('../draw');
var copy = require('../../data/copy');
var hit = require('../hit');
var format = require('../../core/format');

var PARTICLE_FAR = 10;
var PARTICLE_NEAR = 14;
var PARTICLE_COUNT = PARTICLE_FAR + PARTICLE_NEAR;
var PARTICLE_LIFE = 1.2;
var PARTICLE_FADE = 0.35;

var STAGE = {
  cat: 0.00,
  title: 0.09,
  paws: 0.18,
  stats: 0.42,
  reward: 0.54,
  buttons: 0.66
};
var STAGE_IN = 0.12;
var PAW_STEP = 0.09;
var PAW_STAMP = 0.22;
var ROLL_TIME = 0.36;

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function easeOut(k) {
  return 1 - Math.pow(1 - k, 3);
}

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
    var near = i >= PARTICLE_FAR;
    var color = theme.region[i % theme.region.length];
    this.particles.push({
      layer: near ? 1 : 0,
      x: Math.random() * w,
      y: near ? (-24 - Math.random() * 150) : (-10 - Math.random() * 30),
      vx: (Math.random() - 0.5) * (near ? 52 : 16),
      vy: near ? (140 + Math.random() * 100) : (50 + Math.random() * 35),
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * (near ? 7 : 4),
      size: near ? (6.5 + Math.random() * 3.5) : (3 + Math.random() * 2),
      color: near ? color : draw.alpha(color, 0.58),
      paw: near ? (i % 4 === 0) : (i % 7 === 0),
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

/** 单个入场阶段：k 为 0→1，a 为透明度，dy 为自下而上的位移 */
ResultScene.prototype._stage = function (name) {
  var delay = STAGE[name];
  if (delay === undefined) delay = 0;
  var k = clamp01((this.t - delay) / STAGE_IN);
  var s = this.app.layout.s;
  return { k: k, a: k, dy: (1 - easeOut(k)) * 8 * s, ease: easeOut(k) };
};

/** 从 start 开始、持续 dur 的局部淡入进度 */
ResultScene.prototype._fade = function (start, dur) {
  return clamp01((this.t - start) / dur);
};

/** 第 i 枚猫爪的盖章进度，0 表示尚未落下 */
ResultScene.prototype._pawK = function (i) {
  return clamp01((this.t - STAGE.paws - i * PAW_STEP) / PAW_STAMP);
};

/** 当前结算是否有可见奖励（用于决定金币放射一次） */
ResultScene.prototype._hasReward = function (info) {
  if (info.daily) return !!(info.firstClear && !info.replay && !info.guarded);
  return !!(info.firstClear && info.coins > 0);
};

ResultScene.prototype.render = function (r) {
  var app = this.app;
  var th = app.theme;
  var L = app.layout.result();
  var info = this.info || {};
  this.L = L;

  r.fill(th.color.bg);

  this._renderConfetti(r);
  this._renderCat(r);
  this._renderTitle(r, info);
  this._renderPaws(r, info);
  this._renderRewardBurst(r, info);
  this._renderStats(r, info);
  this._renderReward(r, info);
  this._renderButtons(r, info);
};

ResultScene.prototype._renderCat = function (r) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var st = this._stage('cat');
  if (st.a <= 0) return;

  var bob = Math.sin(this.t * 1.8) * 2 * s;
  var cat = this.app.collection.equippedCat();
  var ctx = r.ctx;

  ctx.save();
  ctx.globalAlpha = st.a;
  ctx.translate(0, st.dy);
  r.circle(L.cat.cx, L.cat.cy + 3 * s, L.cat.r, th.color.card);
  r.strokeCircle(L.cat.cx, L.cat.cy + 3 * s, L.cat.r, th.color.border, 1);
  draw.catFace(r, L.cat.cx, L.cat.cy + bob, L.cat.size, cat, { expression: 'happy' });
  ctx.restore();
};

ResultScene.prototype._renderTitle = function (r, info) {
  var th = this.app.theme;
  var L = this.L;
  var st = this._stage('title');
  if (st.a <= 0) return;

  var title = info.daily ? copy.dailyResultTitle : copy.resultTitle;
  var sub = info.daily
    ? format(copy.dailyResultSub, info.streak || 0, info.n || 5)
    : format(copy.resultSub, info.levelIndex || 1, info.n || 5, info.n || 5);
  var ctx = r.ctx;

  ctx.save();
  ctx.globalAlpha = st.a;
  ctx.translate(0, st.dy);
  r.text(title, r.w / 2, L.titleY, {
    size: th.font.hudValue,
    weight: '800',
    color: th.color.text,
    align: 'center'
  });
  r.text(sub, r.w / 2, L.subY, {
    size: th.font.small,
    color: th.color.textSoft,
    align: 'center'
  });
  ctx.restore();
};

ResultScene.prototype._renderPaws = function (r, info) {
  var th = this.app.theme;
  var L = this.L;
  var ctx = r.ctx;
  var earned = Math.min(3, Math.max(1, info.paws || 1));
  var totalW = L.paws.size * 3 + L.paws.gap * 2;
  var x0 = (r.w - totalW) / 2 + L.paws.size / 2;
  var st = this._stage('paws');
  if (st.a <= 0) return;

  for (var i = 0; i < 3; i++) {
    var px = x0 + i * (L.paws.size + L.paws.gap);

    if (i >= earned) {
      ctx.save();
      ctx.globalAlpha = st.a;
      ctx.translate(0, st.dy);
      draw.iconPaw(r, px, L.paws.cy, L.paws.size, draw.alpha(th.color.textSoft, 0.18));
      ctx.restore();
      continue;
    }

    var k = this._pawK(i);
    if (k <= 0) continue;

    // 从上方稍大尺寸落下，像印章一样压到纸上；透明度先于缩放到位
    var drop = 1 - easeOut(k);
    var grow = 1 + 0.55 * drop * drop;
    var alpha = Math.min(1, k * 3.2) * st.a;
    var tilt = -0.12 * drop;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, L.paws.cy);
    ctx.rotate(tilt);
    ctx.scale(grow, grow);
    draw.iconPaw(r, 0, 0, L.paws.size, th.color.cta);
    ctx.restore();
  }

  var ratingStart = STAGE.paws + PAW_STEP * (earned - 1) + PAW_STAMP * 0.65;
  var ra = this._fade(ratingStart, 0.18) * st.a;
  if (ra > 0) {
    ctx.save();
    ctx.globalAlpha = ra;
    ctx.translate(0, st.dy);
    r.text(copy['resultPaws' + earned], r.w / 2, L.ratingY, {
      size: th.font.small,
      weight: '600',
      color: th.color.textSoft,
      align: 'center'
    });
    ctx.restore();
  }
};

ResultScene.prototype._renderStats = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var st = this.L.stats;
  var stg = this._stage('stats');
  if (stg.a <= 0) return;

  var ctx = r.ctx;
  var colW = st.w / 2;
  var mid = st.x + colW;
  var yLabel = st.y + 22 * s;
  var yValue = st.y + 47 * s;

  ctx.save();
  ctx.globalAlpha = stg.a;
  ctx.translate(0, stg.dy);

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

  // 数字滚动：信息卡入场后再从 0 数到最终值
  var roll = easeOut(this._fade(STAGE.stats + STAGE_IN, ROLL_TIME));
  var shownMs = (info.timeMs || 0) * roll;
  var shownMoves = Math.round((info.moves || 0) * roll);

  r.text(format.duration(shownMs), st.x + colW / 2, yValue, {
    size: th.font.banner,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });
  r.text(String(shownMoves), mid + colW / 2, yValue, {
    size: th.font.banner,
    weight: '700',
    color: th.color.text,
    align: 'center'
  });

  if (info.bestTimeMs > 0) {
    var tpl = info.isNewBest ? copy.resultBestNew : copy.resultBest;
    var bestA = this._fade(STAGE.stats + STAGE_IN + ROLL_TIME, 0.18);
    if (bestA > 0) {
      ctx.save();
      ctx.globalAlpha = stg.a * bestA;
      r.text(format(tpl, format.duration(info.bestTimeMs)), st.x + st.w / 2,
        st.y + st.h - 18 * s, {
          size: th.font.micro,
          weight: info.isNewBest ? '700' : '400',
          color: info.isNewBest ? th.color.cta : th.color.textSoft,
          align: 'center'
        });
      ctx.restore();
    }

    this._renderBestRibbon(r, info, stg.a);
  }

  ctx.restore();
};

/** 信息卡右上角的最佳成绩缎带；新纪录用暖橙，历史最佳用浅橙 */
ResultScene.prototype._renderBestRibbon = function (r, info, stageAlpha) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var b = this.L.stats.ribbon;
  var ctx = r.ctx;
  var isNew = !!info.isNewBest;
  var start = STAGE.stats + STAGE_IN + ROLL_TIME * 0.55;
  var k = this._fade(start, 0.2);
  if (k <= 0) return;

  var ease = easeOut(k);
  var scale = 0.72 + 0.28 * ease + Math.sin(Math.PI * k) * 0.05;
  var notch = 6 * s;
  var fill = isNew ? th.color.cta : th.color.ctaSoft;
  var ink = isNew ? th.color.textOnColor : th.color.cta;
  var cx = b.x + b.w / 2;
  var cy = b.y + b.h / 2;

  ctx.save();
  ctx.globalAlpha = stageAlpha * k;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // 底部折角，像一枚缝在卡片边缘的缎带
  ctx.beginPath();
  ctx.moveTo(b.x + b.w - notch, b.y + b.h - 1);
  ctx.lineTo(b.x + b.w, b.y + b.h - 1);
  ctx.lineTo(b.x + b.w - 2 * s, b.y + b.h + notch * 0.9);
  ctx.closePath();
  ctx.fillStyle = isNew ? th.color.ctaDeep : th.color.cta;
  ctx.fill();

  // 主体：左侧切出 V 形缺口
  ctx.beginPath();
  ctx.moveTo(b.x + b.h / 2, b.y);
  ctx.lineTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.h / 2, b.y + b.h);
  ctx.lineTo(b.x + notch, b.y + b.h / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (!isNew) {
    ctx.strokeStyle = th.color.cta;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  r.text(isNew ? copy.resultBestTagNew : copy.resultBestTag,
    b.x + (b.w + notch) / 2, b.y + b.h / 2 + 1, {
      size: th.font.micro,
      weight: '700',
      color: ink,
      align: 'center'
    });
  ctx.restore();
};

/** 金币奖励放射：只在奖励条出现后的半秒内绘制一次 */
ResultScene.prototype._renderRewardBurst = function (r, info) {
  if (!this._hasReward(info)) return;

  var th = this.app.theme;
  var s = this.app.layout.s;
  var k = this._fade(STAGE.reward + 0.06, 0.5);
  if (k <= 0 || k >= 1) return;

  var ctx = r.ctx;
  var cx = r.w / 2;
  var cy = this.L.reward.cy;
  var ease = easeOut(k);
  var radius = 18 * s + 58 * s * ease;
  var alpha = 1 - k;
  var count = 14;

  ctx.save();
  ctx.globalAlpha = alpha;
  for (var i = 0; i < count; i++) {
    var angle = (i / count) * Math.PI * 2 + 0.18;
    var dist = radius + (i % 3) * 4 * s;
    var x = cx + Math.cos(angle) * dist;
    var y = cy + Math.sin(angle) * dist * 0.78;
    var dot = (2.8 - 1.3 * k) * s;
    r.circle(x, y, dot, i % 2 ? th.color.coinFace : th.color.gold);
  }
  ctx.strokeStyle = th.color.coinFace;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

ResultScene.prototype._renderReward = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var cy = this.L.reward.cy;
  var st = this._stage('reward');
  if (st.a <= 0) return;

  var ctx = r.ctx;
  var scale = 0.84 + 0.16 * easeOut(st.k);

  ctx.save();
  ctx.globalAlpha = st.a;
  ctx.translate(r.w / 2, cy + st.dy);
  ctx.scale(scale, scale);
  ctx.translate(-r.w / 2, -cy);

  if (info.daily) {
    if (info.guarded) {
      r.text(copy.dailyResultGuarded, r.w / 2, cy, {
        size: th.font.small, color: th.color.conflict, align: 'center'
      });
      ctx.restore();
      return;
    }
    if (info.replay || !info.firstClear) {
      r.text(copy.dailyResultReplay, r.w / 2, cy, {
        size: th.font.small, color: th.color.textSoft, align: 'center'
      });
      ctx.restore();
      return;
    }

    var dlabel = format(copy.dailyResultRewards, info.coins || 0, info.fragments || 0);
    var dfs = th.font.small;
    var dw = Math.min(r.w - 48 * s, r.measure(dlabel, dfs, '700') + 52 * s);
    var dh = 32 * s;
    var dx = (r.w - dw) / 2;
    var dy = cy - dh / 2;
    r.roundRect(dx, dy, dw, dh, dh / 2, th.color.highlight);
    draw.iconCoin(r, dx + 16 * s, cy, 16 * s);
    r.text(dlabel, dx + 30 * s, cy + 1, {
      size: dfs, weight: '700', color: th.color.text, maxWidth: dw - 34 * s
    });
    ctx.restore();
    return;
  }

  if (!(info.firstClear && info.coins > 0)) {
    r.text(copy.resultReplay, r.w / 2, cy, {
      size: th.font.small,
      color: th.color.textSoft,
      align: 'center'
    });
    ctx.restore();
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

  ctx.restore();
};

ResultScene.prototype._renderButtons = function (r, info) {
  var th = this.app.theme;
  var s = this.app.layout.s;
  var L = this.L;
  var st = this._stage('buttons');
  if (st.a <= 0) return;

  var cta = L.cta;
  var depth = L.ctaDepth;
  var ctx = r.ctx;

  ctx.save();
  ctx.globalAlpha = st.a;
  ctx.translate(0, st.dy);

  // 与首页一致的立体主按钮：底座 + 主体 + 顶部高光 + 爪印
  draw.softShadow(r, cta.x, cta.y, cta.w, cta.h, cta.h / 2);
  r.roundRect(cta.x, cta.y + depth, cta.w, cta.h, cta.h / 2, th.color.ctaDeep);
  r.roundRect(cta.x, cta.y, cta.w, cta.h, cta.h / 2, th.color.cta);
  r.roundRect(cta.x + cta.w * 0.16, cta.y + 5 * s, cta.w * 0.68, 3 * s, 1.5 * s,
    draw.alpha(th.color.textOnColor, 0.22));

  var ctaText = info.daily ? copy.resultHome : (info.nextIndex ? copy.resultNext : copy.resultMap);
  var fs = th.font.banner;
  var tw = r.measure(ctaText, fs, '700');
  var icon = 20 * s;
  var gap = 10 * s;
  var startX = r.w / 2 - (icon + gap + tw) / 2;
  var cy = cta.y + cta.h / 2 + 1;
  draw.iconPaw(r, startX + icon / 2, cy, icon, th.color.textOnColor);
  r.text(ctaText, startX + icon + gap, cy, {
    size: fs,
    weight: '700',
    color: th.color.textOnColor
  });

  if (info.nextIndex && !info.daily) {
    var m = L.map;
    draw.softShadow(r, m.x, m.y, m.w, m.h, m.h / 2);
    r.roundRect(m.x, m.y, m.w, m.h, m.h / 2, th.color.card);
    r.strokeRoundRect(m.x, m.y, m.w, m.h, m.h / 2, th.color.border, 1);
    r.text(copy.resultMap, r.w / 2, m.y + m.h / 2 + 1, {
      size: th.font.body,
      weight: '600',
      color: th.color.text,
      align: 'center'
    });
  }

  if (!info.nextIndex && !info.daily) {
    r.text(copy.resultAllDone || '', r.w / 2, L.cta.y - 18 * s, {
      size: th.font.micro,
      color: th.color.textSoft,
      align: 'center'
    });
  }

  ctx.restore();
};

ResultScene.prototype._renderConfetti = function (r) {
  if (this.t > PARTICLE_LIFE) return;

  var ctx = r.ctx;
  var fade = this.t < PARTICLE_LIFE - PARTICLE_FADE
    ? 1
    : Math.max(0, (PARTICLE_LIFE - this.t) / PARTICLE_FADE);

  // 先画远层（更小、更慢、半透明），再画近层，形成前后景深
  for (var layer = 0; layer < 2; layer++) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (p.layer !== layer || p.y > r.h + 24) continue;

      ctx.save();
      ctx.globalAlpha = fade * (layer ? 1 : 0.62);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.paw) {
        draw.iconPaw(r, 0, 0, p.size * 2.2, p.color);
      } else {
        r.roundRect(-p.size / 2, -p.size / 4, p.size, p.size / 2, p.size / 4, p.color);
      }
      ctx.restore();
    }
  }
};

/* ---------------- 输入 ---------------- */

ResultScene.prototype.onTouchEnd = function (x, y, isTap) {
  if (!isTap) return;
  var L = this.L;
  if (!L) return;
  var info = this.info || {};

  if (hit.inRect(x, y, L.cta)) {
    if (info.daily) this._toHome();
    else if (info.nextIndex) this._next();
    else this._toMap();
    return;
  }

  if (!info.daily && info.nextIndex && hit.inRect(x, y, L.map)) {
    this._toMap();
  }
};

ResultScene.prototype._next = function () {
  var info = this.info || {};
  if (!info.nextIndex) return;
  // 正常情况下 completeLevel 已推进解锁前沿；这里仍守卫，防止旧档/异常数据越关。
  if (!this.app.progress.isUnlocked(info.nextIndex)) {
    this.app.toast.show(copy.toastLocked);
    this._toMap();
    return;
  }
  this.app.sm.pop();
  this.app.sm.replace('game', { levelIndex: info.nextIndex });
};

ResultScene.prototype._toMap = function () {
  this.app.sm.pop();
  var top = this.app.sm.top();
  if (top && top.sceneName === 'game') this.app.sm.pop();
};

ResultScene.prototype._toHome = function () {
  var sm = this.app.sm;
  while (sm.stack.length > 1) {
    var top = sm.top();
    sm.pop();
    if (top && top.sceneName === 'daily') break;
    if (sm.top() && sm.top().sceneName === 'home') break;
  }
};

module.exports = ResultScene;
