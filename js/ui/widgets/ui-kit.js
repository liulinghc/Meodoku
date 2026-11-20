/**
 * S5.3 阶段 6：经济与收集页面的共享视觉组件。
 * 只画形状、不读写业务数据；颜色/圆角/字号全部来自 theme。
 */
var draw = require('../draw');

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(v) {
  var p = clamp01(v);
  return 1 - Math.pow(1 - p, 3);
}

function easeOutBack(v) {
  var p = clamp01(v);
  var c1 = 1.70158;
  var c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/** 统一白卡：可选投影、填充色与描边 */
function card(r, rect, th, opts) {
  opts = opts || {};
  var radius = opts.radius || th.radius.card;
  if (opts.shadow !== false) draw.softShadow(r, rect.x, rect.y, rect.w, rect.h, radius);
  r.roundRect(rect.x, rect.y, rect.w, rect.h, radius, opts.fill || th.color.card);
  if (opts.border !== false) {
    r.strokeRoundRect(rect.x, rect.y, rect.w, rect.h, radius,
      opts.borderColor || th.color.border, opts.borderWidth || 1);
  }
}

/** 图标托：浅色圆底 + 居中图标 */
function iconTray(r, cx, cy, radius, tint, icon, iconSize, color) {
  r.circle(cx, cy, radius, draw.alpha(tint, 0.13));
  icon(r, cx, cy, iconSize, color);
}

/** 进度条：圆角槽 + 圆角填充，ratio 由调用方负责缓动 */
function progress(r, rect, ratio, th, opts) {
  opts = opts || {};
  var rad = rect.h / 2;
  var value = clamp01(ratio);
  r.roundRect(rect.x, rect.y, rect.w, rect.h, rad, opts.track || th.color.bgSunken);
  if (value > 0) {
    r.roundRect(rect.x, rect.y, Math.max(rect.h, rect.w * value), rect.h, rad,
      opts.color || th.color.brand);
  }
}

/**
 * 统一按钮：primary（CTA）/ soft（浅蓝次按钮）/ flat（不可用或已完成）。
 * 呼吸光环只做视觉，不改变命中矩形。
 */
function button(r, rect, label, th, opts) {
  opts = opts || {};
  var style = opts.style || 'primary';
  var disabled = !!opts.disabled;
  var bg, fg;

  if (disabled) {
    bg = th.color.bgSunken;
    fg = th.color.textSoft;
  } else if (style === 'soft') {
    bg = th.color.brandSoft;
    fg = th.color.bandDeep;
  } else if (style === 'flat') {
    bg = th.color.bgSunken;
    fg = th.color.textSoft;
  } else {
    bg = th.color.cta;
    fg = th.color.textOnColor;
  }

  if (opts.breath) {
    var halo = rect.h * 0.10;
    r.strokeRoundRect(rect.x - halo, rect.y - halo, rect.w + halo * 2, rect.h + halo * 2,
      rect.h / 2 + halo, draw.alpha(th.color.cta, 0.08 + 0.16 * opts.breath), 2);
  }
  if (!disabled && style === 'primary') {
    draw.softShadow(r, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
  }
  r.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2, bg);
  r.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, {
    size: opts.size || th.font.small,
    weight: opts.weight || '700',
    color: opts.color || fg,
    align: 'center',
    maxWidth: rect.w - rect.h * 0.4
  });
}

/** 盖章：白圈垫底 + 实色印面 + 对勾，scale 用于回弹动画 */
function stamp(r, cx, cy, radius, color, th, opts) {
  opts = opts || {};
  var scale = typeof opts.scale === 'number' ? opts.scale : 1;
  var rad = radius * scale;
  if (rad <= 0.2) return;
  var ring = opts.ring === false ? null : (opts.ringColor || th.color.card);
  if (ring) r.circle(cx, cy, rad * 1.16, ring);
  r.circle(cx, cy, rad, color);
  draw.iconCheck(r, cx, cy, rad * 1.12, opts.checkColor || th.color.textOnColor);
}

/** 稀有度缎带：右侧带缺口的标签，用于图鉴卡片与详情 */
function ribbonWidth(r, label, th, s) {
  return r.measure(label, th.font.micro, '700') + 14 * s + 7 * s;
}

function ribbon(r, x, y, w, h, color, label, th, opts) {
  opts = opts || {};
  var notch = h * 0.36;
  var bodyW = Math.max(0, w - notch);
  var ctx = r.ctx;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + bodyW, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + bodyW, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = draw.alpha(color, opts.alpha || 0.16);
  ctx.fill();
  r.text(label, x + bodyW / 2, y + h / 2 + 0.5, {
    size: opts.size || th.font.micro,
    weight: '700',
    color: color,
    align: 'center'
  });
}

module.exports = {
  clamp01: clamp01,
  easeOutCubic: easeOutCubic,
  easeOutBack: easeOutBack,
  card: card,
  iconTray: iconTray,
  progress: progress,
  button: button,
  stamp: stamp,
  ribbonWidth: ribbonWidth,
  ribbon: ribbon
};
