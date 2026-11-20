/**
 * 程序化绘制：猫头、X、图标、色带。
 * 这是 S1 的占位美术层；最终美术替换后，这些函数改为 drawImage 即可，
 * 调用方签名保持不变。
 */
var themeBase = require('../data/theme').base;

/* ---------------- 颜色工具 ---------------- */

function hexToRgb(hex) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(hex) {
  var c = hexToRgb(hex);
  return (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255;
}

/** 浅色区域用深棕 X，深色区域用白 X */
function xColorFor(hex) {
  return luminance(hex) > 0.62 ? themeBase.color.xDark : themeBase.color.xLight;
}

function alpha(hex, a) {
  var c = hexToRgb(hex);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
}

/** 混合两色，t=0 取 a，t=1 取 b */
function mix(a, b, t) {
  var ca = hexToRgb(a), cb = hexToRgb(b);
  var r = Math.round(ca.r + (cb.r - ca.r) * t);
  var g = Math.round(ca.g + (cb.g - ca.g) * t);
  var bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

/* ---------------- 基础形状 ---------------- */

function ellipseFill(ctx, cx, cy, rx, ry, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function softShadow(r, x, y, w, h, rad) {
  var ctx = r.ctx;
  ctx.fillStyle = themeBase.color.shadowSoft;
  r.roundPath(x, y + 3, w, h, rad);
  ctx.fill();
  ctx.fillStyle = themeBase.color.shadowSofter;
  r.roundPath(x, y + 6, w, h, rad);
  ctx.fill();
}

/* ---------------- 猫头 ---------------- */

var CAT_EARS = { point: 1, round: 1, fold: 1 };
var CAT_EYES = { round: 1, sleepy: 1, bright: 1 };
var CAT_PATTERNS = { blaze: 1, mask: 1, tabby: 1, patch: 1 };
var CAT_ACCESSORIES = { bell: 1, scarf: 1, glasses: 1, flower: 1 };
var CAT_EXPRESSIONS = { normal: 1, happy: 1, surprised: 1, sleepy: 1 };

function pick(value, allowed, fallback) {
  return allowed[value] ? value : fallback;
}

/** 尖耳：最经典的三角耳 */
function drawPointEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var sg = side;
  var b1x = cx + sg * R * 0.94, b1y = cy - R * 0.34;
  var b2x = cx + sg * R * 0.22, b2y = cy - R * 1.00;
  var ax = cx + sg * R * 0.80, ay = cy - R * 1.34;

  ctx.beginPath();
  ctx.moveTo(b1x, b1y);
  ctx.lineTo(ax, ay);
  ctx.lineTo(b2x, b2y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.78, cy - R * 0.52);
  ctx.lineTo(cx + sg * R * 0.68, cy - R * 1.02);
  ctx.lineTo(cx + sg * R * 0.38, cy - R * 0.86);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

/** 圆耳：半圆外露，像幼猫 */
function drawRoundEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var ex = cx + side * R * 0.68;
  var ey = cy - R * 0.72;
  var er = R * 0.40;

  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ex, ey + R * 0.02, er * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();
}

/** 折耳：耳尖向外折一小块 */
function drawFoldEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var sg = side;

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.94, cy - R * 0.26);
  ctx.lineTo(cx + sg * R * 0.68, cy - R * 1.10);
  ctx.lineTo(cx + sg * R * 1.00, cy - R * 0.94);
  ctx.lineTo(cx + sg * R * 0.30, cy - R * 0.94);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.80, cy - R * 0.42);
  ctx.lineTo(cx + sg * R * 0.66, cy - R * 0.92);
  ctx.lineTo(cx + sg * R * 0.42, cy - R * 0.86);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

function drawCatEar(ctx, cx, cy, R, side, ear, fill, inner, ink, lw) {
  if (ear === 'round') drawRoundEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
  else if (ear === 'fold') drawFoldEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
  else drawPointEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
}

/** 斑纹（已裁剪在头内）：blaze=鼻梁 / mask=面罩 / tabby=虎斑 / patch=补丁 */
function drawCatPattern(ctx, cx, cy, R, pattern, patch, ink, base) {
  if (pattern === 'mask') {
    ellipseFill(ctx, cx - R * 0.38, cy - R * 0.08, R * 0.32, R * 0.36, patch);
    ellipseFill(ctx, cx + R * 0.38, cy - R * 0.08, R * 0.32, R * 0.36, patch);
    ellipseFill(ctx, cx, cy + R * 0.40, R * 0.40, R * 0.22, patch);
  } else if (pattern === 'tabby') {
    ctx.strokeStyle = mix(base, ink, 0.32);
    ctx.lineWidth = Math.max(0.8, R * 0.09);
    ctx.lineCap = 'round';
    var stripes = [
      [0, -0.86, 0, -0.48],
      [-0.24, -0.82, -0.18, -0.50],
      [0.24, -0.82, 0.18, -0.50],
      [-0.62, 0.04, -0.88, -0.02],
      [-0.60, 0.20, -0.86, 0.14],
      [0.62, 0.04, 0.88, -0.02],
      [0.60, 0.20, 0.86, 0.14]
    ];
    for (var i = 0; i < stripes.length; i++) {
      var s = stripes[i];
      ctx.beginPath();
      ctx.moveTo(cx + R * s[0], cy + R * s[1]);
      ctx.lineTo(cx + R * s[2], cy + R * s[3]);
      ctx.stroke();
    }
  } else if (pattern === 'patch') {
    ellipseFill(ctx, cx + R * 0.42, cy - R * 0.14, R * 0.34, R * 0.42, patch);
    ellipseFill(ctx, cx, cy + R * 0.36, R * 0.42, R * 0.27, patch);
    ellipseFill(ctx, cx - R * 0.52, cy + R * 0.40, R * 0.22, R * 0.16, patch);
  } else {
    ellipseFill(ctx, cx, cy - R * 0.50, R * 0.30, R * 0.44, patch);
    ellipseFill(ctx, cx, cy + R * 0.36, R * 0.42, R * 0.27, patch);
  }
}

/**
 * 眼睛：round=圆眼 / sleepy=睡眼 / bright=亮眼；
 * expression 覆盖：happy=弯月眼、surprised=瞪圆、sleepy=闭眼。
 */
function drawCatEyes(ctx, cx, cy, R, style, expr, ink, hasDetail) {
  var eyeDX = R * 0.38;
  var eyeY = cy - R * 0.06;
  var lw = Math.max(1, R * 0.09);

  for (var si = -1; si <= 1; si += 2) {
    var ex = cx + si * eyeDX;

    if (expr === 'happy') {
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.17, eyeY + R * 0.05);
      ctx.quadraticCurveTo(ex, eyeY - R * 0.16, ex + R * 0.17, eyeY + R * 0.05);
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    if (expr === 'sleepy' || (expr === 'normal' && style === 'sleepy')) {
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.17, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + R * 0.16, ex + R * 0.17, eyeY);
      ctx.strokeStyle = ink;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    var wide = expr === 'surprised';
    var sclera = R * (wide ? 0.27 : style === 'bright' ? 0.245 : 0.225);
    ctx.beginPath();
    ctx.arc(ex, eyeY, sclera, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.card;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.7, R * 0.05);
    ctx.stroke();

    var pr = sclera * (style === 'bright' ? 0.62 : 0.55);
    ctx.beginPath();
    ctx.arc(ex, eyeY + sclera * 0.08, pr, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();

    if (hasDetail) {
      ctx.beginPath();
      ctx.arc(ex - pr * 0.38, eyeY - pr * 0.40, pr * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = themeBase.color.card;
      ctx.fill();
      if (style === 'bright' && !wide) {
        ctx.beginPath();
        ctx.arc(ex + pr * 0.34, eyeY + pr * 0.42, pr * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = themeBase.color.card;
        ctx.fill();
      }
    }
  }
}

function drawCatMouth(ctx, cx, cy, R, expr, ink, lw, alphaValue, hasDetail) {
  if (expr === 'surprised') {
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.42, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    return;
  }

  if (expr === 'happy') {
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.34, R * 0.15, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, lw * 0.62);
    ctx.lineCap = 'round';
    ctx.globalAlpha = alphaValue * 0.6;
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    if (hasDetail) {
      ctx.beginPath();
      ctx.arc(cx, cy + R * 0.45, R * 0.055, 0, Math.PI);
      ctx.fillStyle = themeBase.color.catBlush;
      ctx.fill();
    }
    return;
  }

  if (expr === 'sleepy') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.10, cy + R * 0.42);
    ctx.lineTo(cx + R * 0.10, cy + R * 0.42);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.8, lw * 0.62);
    ctx.globalAlpha = alphaValue * 0.55;
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    return;
  }

  ctx.beginPath();
  ctx.moveTo(cx - R * 0.13, cy + R * 0.38);
  ctx.quadraticCurveTo(cx - R * 0.065, cy + R * 0.49, cx, cy + R * 0.42);
  ctx.quadraticCurveTo(cx + R * 0.065, cy + R * 0.49, cx + R * 0.13, cy + R * 0.38);
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.8, lw * 0.62);
  ctx.globalAlpha = alphaValue * 0.55;
  ctx.stroke();
  ctx.globalAlpha = alphaValue;
}

/** 配饰：bell=铃铛 / scarf=围巾 / glasses=眼镜 / flower=小花 */
function drawCatAccessory(ctx, cx, cy, R, type, ink, hasDetail) {
  if (type === 'bell') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.30, cy + R * 0.80);
    ctx.lineTo(cx + R * 0.30, cy + R * 0.80);
    ctx.strokeStyle = themeBase.color.ctaDeep;
    ctx.lineWidth = Math.max(1, R * 0.06);
    ctx.stroke();

    var br = R * 0.13;
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.97, br, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    ctx.strokeStyle = themeBase.color.coinDeep;
    ctx.lineWidth = Math.max(0.7, R * 0.045);
    ctx.stroke();
    if (hasDetail) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + R * 0.93);
      ctx.lineTo(cx, cy + R * 1.01);
      ctx.strokeStyle = themeBase.color.coinDeep;
      ctx.lineWidth = Math.max(0.6, R * 0.03);
      ctx.stroke();
    }
    return;
  }

  if (type === 'scarf') {
    var w = R * 1.14;
    var h = R * 0.25;
    var x = cx - w / 2;
    var y = cy + R * 0.80;
    var rad = h * 0.5;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
    ctx.fillStyle = themeBase.color.cta;
    ctx.fill();
    ctx.strokeStyle = themeBase.color.ctaDeep;
    ctx.lineWidth = Math.max(0.7, R * 0.04);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + R * 0.34, cy + R * 1.00, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.ctaDeep;
    ctx.fill();
    return;
  }

  if (type === 'glasses') {
    var eyeDX = R * 0.38;
    var eyeY = cy - R * 0.06;
    var gr = R * 0.27;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.9, R * 0.055);
    ctx.fillStyle = alpha(themeBase.color.card, 0.18);
    ctx.beginPath();
    ctx.arc(cx - eyeDX, eyeY, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + eyeDX, eyeY, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - eyeDX + gr, eyeY);
    ctx.lineTo(cx + eyeDX - gr, eyeY);
    ctx.stroke();
    return;
  }

  // flower
  var fx = cx - R * 0.56;
  var fy = cy - R * 0.56;
  var pr = R * 0.11;
  var spread = R * 0.10;
  ctx.fillStyle = themeBase.color.brand;
  for (var i = 0; i < 5; i++) {
    var a = -Math.PI / 2 + (Math.PI * 2 / 5) * i;
    ctx.beginPath();
    ctx.arc(fx + Math.cos(a) * spread, fy + Math.sin(a) * spread, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(fx, fy, pr * (hasDetail ? 0.72 : 0.9), 0, Math.PI * 2);
  ctx.fillStyle = themeBase.color.coinFace;
  ctx.fill();
}

/**
 * 贴纸式猫头。size 为外接框宽度，猫头占满框。
 * 参数：cat.ear / cat.eyes / cat.pattern / cat.accessory；
 * opts.expression: normal / happy / surprised / sleepy。
 * 签名保持不变，美术替换时内部改成 drawImage 即可。
 */
function catFace(r, cx, cy, size, cat, opts) {
  var ctx = r.ctx;
  var R = size * 0.35;
  var ink = (opts && opts.ink) || themeBase.color.catInk;
  var lw = Math.max(1, R * 0.10);
  var alpha = (opts && opts.alpha != null) ? opts.alpha : 1;
  var expr = pick(opts && opts.expression, CAT_EXPRESSIONS, 'normal');
  var ear = pick(cat.ear, CAT_EARS, 'point');
  var eyeStyle = pick(cat.eyes, CAT_EYES, 'round');
  var pattern = pick(cat.pattern, CAT_PATTERNS, 'blaze');
  var accessory = pick(cat.accessory, CAT_ACCESSORIES, '');
  var base = cat.base;
  var patch = cat.patch || themeBase.color.card;
  var inner = cat.inner || themeBase.color.catInner;
  var hasDetail = R > 8;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawCatEar(ctx, cx, cy, R, -1, ear, base, inner, ink, lw);
  drawCatEar(ctx, cx, cy, R, 1, ear, base, inner, ink, lw);

  // 头
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  // 两层平涂：底色 + 下半张脸的暗面；斑纹压在暗面之上
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = alpha * 0.5;
  ellipseFill(ctx, cx, cy + R * 0.60, R * 0.84, R * 0.42, mix(base, ink, 0.14));
  ctx.globalAlpha = alpha;
  drawCatPattern(ctx, cx, cy, R, pattern, patch, ink, base);
  ctx.restore();

  drawCatEyes(ctx, cx, cy, R, eyeStyle, expr, ink, hasDetail);

  // 鼻子
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.08, cy + R * 0.26);
  ctx.lineTo(cx + R * 0.08, cy + R * 0.26);
  ctx.lineTo(cx, cy + R * 0.35);
  ctx.closePath();
  ctx.fillStyle = themeBase.color.catNose;
  ctx.fill();

  drawCatMouth(ctx, cx, cy, R, expr, ink, lw, alpha, hasDetail);

  // 腮红
  if (hasDetail) {
    ctx.fillStyle = themeBase.color.catBlush;
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath(); ctx.arc(cx - R * 0.63, cy + R * 0.34, R * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + R * 0.63, cy + R * 0.34, R * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // 胡须
  if (size > 48) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.8, lw * 0.5);
    ctx.globalAlpha = alpha * 0.3;
    for (var i = 0; i < 2; i++) {
      var wy = cy + R * (0.20 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.78, wy);
      ctx.lineTo(cx - R * 1.14, wy - R * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.78, wy);
      ctx.lineTo(cx + R * 1.14, wy - R * 0.08);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  }

  // 轮廓（最后描，压住斑纹边缘）
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.stroke();

  if (accessory) drawCatAccessory(ctx, cx, cy, R, accessory, ink, hasDetail);

  ctx.restore();
}

/* ---------------- X 标记 ---------------- */

function xMark(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var half = size * 0.26;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.15);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - half, cy - half);
  ctx.lineTo(cx + half, cy + half);
  ctx.moveTo(cx + half, cy - half);
  ctx.lineTo(cx - half, cy + half);
  ctx.stroke();
  ctx.restore();
}

/* ---------------- 图标 ---------------- */

/**
 * 无描边圆形图标按钮：白底 + 居中图标。
 * 各页顶栏统一走这里，避免每个页面各画一套“白圆 + 描边”。
 */
function iconCircle(r, cx, cy, radius, fill, icon, size, color) {
  r.circle(cx, cy, radius, fill);
  if (icon) icon(r, cx, cy, size || radius * 0.9, color || themeBase.color.text);
}

function iconBack(r, cx, cy, size, color) {
  var L = size * 0.30;
  r.line(cx + L * 0.45, cy - L, cx - L * 0.42, cy, color, Math.max(2, size * 0.13));
  r.line(cx - L * 0.42, cy, cx + L * 0.45, cy + L, color, Math.max(2, size * 0.13));
}

function iconGear(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var r1 = size * 0.26;
  var r2 = size * 0.40;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.lineCap = 'round';
  for (var i = 0; i < 8; i++) {
    var a = (Math.PI * 2 / 8) * i + Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  r.strokeCircle(cx, cy, size * 0.20, color, Math.max(1.5, size * 0.09));
}

function iconUndo(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var rad = size * 0.28;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, size * 0.10);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, Math.PI * 0.72, Math.PI * 2.25, false);
  ctx.stroke();

  var ax = cx + Math.cos(Math.PI * 0.72) * rad;
  var ay = cy + Math.sin(Math.PI * 0.72) * rad;
  ctx.beginPath();
  ctx.moveTo(ax + size * 0.10, ay - size * 0.10);
  ctx.lineTo(ax, ay + size * 0.05);
  ctx.lineTo(ax - size * 0.13, ay - size * 0.04);
  ctx.stroke();
  ctx.restore();
}

/** 重开：上下两段带箭头的圆弧，和撤销的开口弧区分开 */
function iconRestart(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var rad = size * 0.27;
  var len = size * 0.13;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.7, size * 0.095);
  ctx.lineCap = 'round';

  function arcArrow(a0, a1) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad, a0, a1, false);
    ctx.stroke();

    var tx = cx + Math.cos(a1) * rad;
    var ty = cy + Math.sin(a1) * rad;
    var dir = a1 + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(dir + 2.4) * len, ty + Math.sin(dir + 2.4) * len);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + Math.cos(dir - 2.4) * len, ty + Math.sin(dir - 2.4) * len);
    ctx.stroke();
  }

  arcArrow(Math.PI * 1.10, Math.PI * 1.85);
  arcArrow(Math.PI * 0.10, Math.PI * 0.85);
  ctx.restore();
}

function iconEraser(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.52;
  var h = size * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.55);
  r.roundPath(-w / 2, -h / 2, w, h, h * 0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.09);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, -h / 2);
  ctx.lineTo(-w * 0.05, h / 2);
  ctx.stroke();
  ctx.restore();
}

function iconBulb(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var rad = size * 0.19;
  r.strokeCircle(cx, cy - size * 0.06, rad, color, Math.max(1.6, size * 0.09));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - rad * 0.55, cy + size * 0.17);
  ctx.lineTo(cx + rad * 0.55, cy + size * 0.17);
  ctx.moveTo(cx - rad * 0.45, cy + size * 0.26);
  ctx.lineTo(cx + rad * 0.45, cy + size * 0.26);
  ctx.stroke();
}

function iconPaw(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var u = size * 0.5;
  ellipseFill(ctx, cx, cy + u * 0.22, u * 0.34, u * 0.28, color);
  var toes = [
    { x: -0.42, y: -0.16, rx: 0.13, ry: 0.16 },
    { x: -0.15, y: -0.34, rx: 0.13, ry: 0.16 },
    { x: 0.15, y: -0.34, rx: 0.13, ry: 0.16 },
    { x: 0.42, y: -0.16, rx: 0.13, ry: 0.16 }
  ];
  for (var i = 0; i < toes.length; i++) {
    var t = toes[i];
    ellipseFill(ctx, cx + u * t.x, cy + u * t.y, u * t.rx, u * t.ry, color);
  }
}

function iconCoin(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var rad = size * 0.40;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = color || themeBase.color.coinFace;
  ctx.fill();
  r.strokeCircle(cx, cy, rad * 0.72, themeBase.color.coinDeep, Math.max(1, size * 0.07));
  ellipseFill(ctx, cx, cy, rad * 0.16, rad * 0.20, themeBase.color.coinDeep);
}

function iconLock(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.46;
  var h = size * 0.36;
  r.roundRect(cx - w / 2, cy - h * 0.05, w, h, size * 0.09, color);
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.08, w * 0.27, Math.PI, 0, false);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.08);
  ctx.stroke();
}

function iconCheck(r, cx, cy, size, color) {
  var ctx = r.ctx;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.22, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.05, cy + size * 0.19);
  ctx.lineTo(cx + size * 0.24, cy - size * 0.18);
  ctx.stroke();
}

function iconCalendar(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.52;
  var h = size * 0.48;
  var x = cx - w / 2;
  var y = cy - h / 2 + size * 0.04;
  r.strokeRoundRect(x, y, w, h, size * 0.08, color, Math.max(1.4, size * 0.075));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.075);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.28);
  ctx.lineTo(x + w, y + h * 0.28);
  ctx.moveTo(x + w * 0.28, y - size * 0.06);
  ctx.lineTo(x + w * 0.28, y + size * 0.04);
  ctx.moveTo(x + w * 0.72, y - size * 0.06);
  ctx.lineTo(x + w * 0.72, y + size * 0.04);
  ctx.stroke();
  r.circle(cx - w * 0.18, y + h * 0.62, size * 0.045, color);
  r.circle(cx + w * 0.18, y + h * 0.62, size * 0.045, color);
}

function iconTicket(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.56;
  var h = size * 0.36;
  var x = cx - w / 2;
  var y = cy - h / 2;
  r.strokeRoundRect(x, y, w, h, size * 0.06, color, Math.max(1.4, size * 0.075));
  // 票根分隔：用两个小圆点代替虚线，兼容性更好
  r.line(cx + w * 0.12, y + h * 0.22, cx + w * 0.12, y + h * 0.78, color, Math.max(1.2, size * 0.06), 'round');
  r.circle(cx + w * 0.12, y + h * 0.12, size * 0.03, color);
  r.circle(cx + w * 0.12, y + h * 0.88, size * 0.03, color);
  r.line(cx - w * 0.28, cy, cx - w * 0.04, cy, color, Math.max(1.4, size * 0.075), 'round');
}

function iconFlame(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.38;
  var h = size * 0.54;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.55);
  ctx.bezierCurveTo(cx + w * 0.8, cy - h * 0.12, cx + w * 0.55, cy + h * 0.30, cx, cy + h * 0.48);
  ctx.bezierCurveTo(cx - w * 0.55, cy + h * 0.30, cx - w * 0.8, cy - h * 0.12, cx, cy - h * 0.55);
  ctx.fillStyle = color;
  ctx.fill();
}

function iconStar(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var R = size * 0.46;
  ctx.beginPath();
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 5;
    var rad = i % 2 === 0 ? R : R * 0.46;
    var px = cx + Math.cos(a) * rad;
    var py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function iconBag(r, cx, cy, size, color) {
  var ctx = r.ctx;
  var w = size * 0.50;
  var h = size * 0.42;
  var x = cx - w / 2;
  var y = cy - h * 0.20;
  r.roundRect(x, y, w, h, size * 0.10, color);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.08);
  ctx.beginPath();
  ctx.arc(cx, y, w * 0.24, Math.PI, 0, false);
  ctx.stroke();
}

/* ---------------- 规则卡小示意图 ---------------- */

/**
 * kind: 1 每区一猫 / 2 行列各一 / 3 猫不相邻
 */
function ruleIcon(r, kind, cx, cy, size, accent, ink) {
  var ctx = r.ctx;
  var cell = size / 3;
  var x0 = cx - size / 2;
  var y0 = cy - size / 2;
  var inner = Math.max(1.5, cell - 2);
  var i;

  // 网格
  ctx.save();
  ctx.strokeStyle = alpha(ink || themeBase.color.text, 0.16);
  ctx.lineWidth = 1;
  for (i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + cell * i, y0);
    ctx.lineTo(x0 + cell * i, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + cell * i);
    ctx.lineTo(x0 + size, y0 + cell * i);
    ctx.stroke();
  }
  ctx.restore();

  function dot(cr, cc, color) {
    r.roundRect(x0 + cc * cell + 1, y0 + cr * cell + 1, inner, inner, 3, color);
  }
  function cross(cr, cc, color) {
    var px = x0 + cc * cell + cell / 2;
    var py = y0 + cr * cell + cell / 2;
    xMark(r, px, py, cell * 0.86, color);
  }

  if (kind === 1) {
    dot(1, 1, accent);
  } else if (kind === 2) {
    dot(1, 1, accent);
    cross(0, 1, alpha(themeBase.color.text, 0.35));
    cross(2, 1, alpha(themeBase.color.text, 0.35));
  } else {
    dot(0, 0, accent);
    cross(0, 1, alpha(themeBase.color.text, 0.35));
    cross(1, 0, alpha(themeBase.color.text, 0.35));
  }
}

/* ---------------- 底部色带 ---------------- */

function waveBand(r, x, y, w, h, color, color2) {
  var ctx = r.ctx;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.20);
  ctx.bezierCurveTo(x + w * 0.26, y - h * 0.10, x + w * 0.56, y + h * 0.08, x + w, y + h * 0.16);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  if (color2) {
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.36);
    ctx.bezierCurveTo(x + w * 0.32, y + h * 0.16, x + w * 0.62, y + h * 0.30, x + w, y + h * 0.40);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = color2;
    ctx.fill();
  }
}

module.exports = {
  hexToRgb: hexToRgb,
  luminance: luminance,
  xColorFor: xColorFor,
  alpha: alpha,
  mix: mix,
  ellipseFill: ellipseFill,
  softShadow: softShadow,
  catFace: catFace,
  xMark: xMark,
  iconCircle: iconCircle,
  iconBack: iconBack,
  iconGear: iconGear,
  iconUndo: iconUndo,
  iconRestart: iconRestart,
  iconEraser: iconEraser,
  iconBulb: iconBulb,
  iconCalendar: iconCalendar,
  iconTicket: iconTicket,
  iconFlame: iconFlame,
  iconStar: iconStar,
  iconBag: iconBag,
  iconPaw: iconPaw,
  iconCoin: iconCoin,
  iconLock: iconLock,
  iconCheck: iconCheck,
  ruleIcon: ruleIcon,
  waveBand: waveBand
};
