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
var CAT_EYES = { dot: 1, sparkle: 1, gentle: 1, wide: 1, happy: 1, sleepy: 1 };
var CAT_MOUTHS = { smile: 1, w: 1, open: 1, tongue: 1, line: 1, pout: 1, smirk: 1, fang: 1 };
var CAT_PATTERNS = { plain: 1, blaze: 1, tabby: 1, muzzle: 1, spot: 1, calico: 1 };
var CAT_ACCESSORIES = {
  bell: 1, scarf: 1, glasses: 1, flower: 1, tear: 1, bow: 1,
  star: 1, leaf: 1, collar: 1, headphones: 1, crown: 1
};
var CAT_EXPRESSIONS = { normal: 1, happy: 1, surprised: 1, sleepy: 1 };

function pick(value, allowed, fallback) {
  return allowed[value] ? value : fallback;
}

function token(name, fallback) {
  return themeBase.color[name] || fallback;
}

/** 宽圆角方脸：比正圆更幼态，也更贴软萌日系贴纸画风 */
function headPath(ctx, cx, cy, R) {
  var w = R * 2.04;
  var h = R * 1.90;
  var x = cx - w / 2;
  var y = cy - h / 2 + R * 0.02;
  var rad = R * 0.66;

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
}

function roundRectPath(ctx, x, y, w, h, rad) {
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
}

/** 尖耳：最经典的三角耳 */
function drawPointEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var sg = side;

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.92, cy - R * 0.52);
  ctx.lineTo(cx + sg * R * 0.72, cy - R * 1.32);
  ctx.lineTo(cx + sg * R * 0.36, cy - R * 0.86);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.82, cy - R * 0.62);
  ctx.lineTo(cx + sg * R * 0.70, cy - R * 1.16);
  ctx.lineTo(cx + sg * R * 0.46, cy - R * 0.84);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

/** 圆耳：圆角三角耳，软但不做成熊耳 */
function drawRoundEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var sg = side;

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.92, cy - R * 0.52);
  ctx.lineTo(cx + sg * R * 0.78, cy - R * 1.16);
  ctx.quadraticCurveTo(cx + sg * R * 0.72, cy - R * 1.28, cx + sg * R * 0.60, cy - R * 1.16);
  ctx.lineTo(cx + sg * R * 0.36, cy - R * 0.86);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.82, cy - R * 0.62);
  ctx.lineTo(cx + sg * R * 0.73, cy - R * 1.04);
  ctx.quadraticCurveTo(cx + sg * R * 0.70, cy - R * 1.12, cx + sg * R * 0.63, cy - R * 1.04);
  ctx.lineTo(cx + sg * R * 0.47, cy - R * 0.84);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

/** 折耳：矮圆的小折耳贴在头顶，避免高尖角像犄角 */
function drawFoldEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
  var sg = side;

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.90, cy - R * 0.54);
  ctx.lineTo(cx + sg * R * 0.86, cy - R * 0.92);
  ctx.quadraticCurveTo(cx + sg * R * 0.84, cy - R * 1.06, cx + sg * R * 0.70, cy - R * 1.04);
  ctx.quadraticCurveTo(cx + sg * R * 0.54, cy - R * 1.00, cx + sg * R * 0.38, cy - R * 0.86);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 折下来的小耳尖：贴近头顶的一块软折片
  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.82, cy - R * 0.88);
  ctx.quadraticCurveTo(cx + sg * R * 0.74, cy - R * 1.00, cx + sg * R * 0.58, cy - R * 0.96);
  ctx.quadraticCurveTo(cx + sg * R * 0.64, cy - R * 0.88, cx + sg * R * 0.82, cy - R * 0.88);
  ctx.closePath();
  ctx.fillStyle = mix(fill, ink, 0.10);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.6, lw * 0.55);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sg * R * 0.80, cy - R * 0.62);
  ctx.lineTo(cx + sg * R * 0.72, cy - R * 0.92);
  ctx.lineTo(cx + sg * R * 0.50, cy - R * 0.82);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

function drawCatEar(ctx, cx, cy, R, side, ear, fill, inner, ink, lw) {
  if (ear === 'round') drawRoundEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
  else if (ear === 'fold') drawFoldEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
  else drawPointEar(ctx, cx, cy, R, side, fill, inner, ink, lw);
}

/** 斑纹（已裁剪在头内）：plain / blaze / tabby / muzzle / spot / calico，均不使用单眼罩 */
function drawCatPattern(ctx, cx, cy, R, pattern, patch, patch2, ink, base) {
  if (pattern === 'tabby') {
    ctx.strokeStyle = mix(base, ink, 0.28);
    ctx.lineWidth = Math.max(0.8, R * 0.085);
    ctx.lineCap = 'round';
    var stripes = [
      [0, -0.74, 0, -0.46],
      [-0.20, -0.70, -0.16, -0.48],
      [0.20, -0.70, 0.16, -0.48],
      [-0.60, 0.02, -0.86, -0.04],
      [-0.58, 0.18, -0.84, 0.12],
      [0.60, 0.02, 0.86, -0.04],
      [0.58, 0.18, 0.84, 0.12]
    ];
    for (var i = 0; i < stripes.length; i++) {
      var s = stripes[i];
      ctx.beginPath();
      ctx.moveTo(cx + R * s[0], cy + R * s[1]);
      ctx.lineTo(cx + R * s[2], cy + R * s[3]);
      ctx.stroke();
    }
  } else if (pattern === 'blaze') {
    ellipseFill(ctx, cx, cy - R * 0.56, R * 0.15, R * 0.32, patch);
    ellipseFill(ctx, cx, cy + R * 0.38, R * 0.28, R * 0.155, patch);
  } else if (pattern === 'muzzle') {
    ellipseFill(ctx, cx, cy + R * 0.38, R * 0.28, R * 0.155, patch);
  } else if (pattern === 'spot') {
    ellipseFill(ctx, cx + R * 0.34, cy - R * 0.50, R * 0.16, R * 0.18, patch);
  } else if (pattern === 'calico') {
    // 三花：奶油色口鼻 + 两处双色斑块，斑块避开眼睛，保持干净
    ellipseFill(ctx, cx - R * 0.56, cy - R * 0.52, R * 0.30, R * 0.22, patch);
    ellipseFill(ctx, cx + R * 0.64, cy + R * 0.38, R * 0.24, R * 0.17, patch2);
    ellipseFill(ctx, cx, cy + R * 0.38, R * 0.26, R * 0.145, patch);
  }
}

/**
 * 眼睛：dot / sparkle / gentle / wide / happy / sleepy。
 * 深色脸自动改用浅色眼，不描粗白圈；expression 可覆盖。
 */
function drawCatEyes(ctx, cx, cy, R, style, expr, ink, base, hasDetail) {
  var eyeDX = R * 0.36;
  var eyeY = cy - R * 0.02;
  var dark = luminance(base) < 0.45;
  var lineColor = dark ? themeBase.color.card : themeBase.color.catLine;
  var happy = expr === 'happy' || (expr === 'normal' && style === 'happy');
  var sleepy = expr === 'sleepy' || (expr === 'normal' && style === 'sleepy');
  var wide = expr === 'surprised' || (expr === 'normal' && style === 'wide');

  for (var si = -1; si <= 1; si += 2) {
    var ex = cx + si * eyeDX;

    if (happy) {
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.16, eyeY + R * 0.04);
      ctx.quadraticCurveTo(ex, eyeY - R * 0.13, ex + R * 0.16, eyeY + R * 0.04);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(1, R * 0.065);
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    if (sleepy) {
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.16, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + R * 0.13, ex + R * 0.16, eyeY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(1, R * 0.065);
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    if (wide) {
      // 大眼仍是实心眼，不描白色眼罩，避免“护目镜”
      var wrx = R * (expr === 'surprised' ? 0.17 : 0.155);
      var wry = R * (expr === 'surprised' ? 0.19 : 0.175);
      var weye = dark ? themeBase.color.card : ink;
      ellipseFill(ctx, ex, eyeY, wrx, wry, weye);
      if (dark) {
        ellipseFill(ctx, ex, eyeY + wry * 0.06, wrx * 0.58, wry * 0.62, ink);
      }
      if (hasDetail) {
        ctx.beginPath();
        ctx.arc(ex - wrx * 0.34, eyeY - wry * 0.38, wry * 0.30, 0, Math.PI * 2);
        ctx.fillStyle = themeBase.color.card;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + wrx * 0.36, eyeY + wry * 0.34, wry * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = themeBase.color.card;
        ctx.fill();
      }
      continue;
    }

    var rx = R * (style === 'sparkle' ? 0.14 : 0.13);
    var ry = R * (style === 'sparkle' ? 0.16 : 0.15);
    var eyeColor = dark ? themeBase.color.card : ink;
    ellipseFill(ctx, ex, eyeY, rx, ry, eyeColor);

    if (dark) {
      ellipseFill(ctx, ex, eyeY + ry * 0.06, rx * 0.58, ry * 0.62, ink);
    }

    if (hasDetail) {
      var hr = ry * 0.32;
      ctx.beginPath();
      ctx.arc(ex - rx * 0.34, eyeY - ry * 0.38, hr, 0, Math.PI * 2);
      ctx.fillStyle = themeBase.color.card;
      ctx.fill();
      // 第二点高光：让眼睛更明亮，但保持实心眼、不描白圈
      ctx.beginPath();
      ctx.arc(ex + rx * 0.40, eyeY + ry * 0.34, hr * (style === 'sparkle' ? 0.58 : 0.46), 0, Math.PI * 2);
      ctx.fillStyle = themeBase.color.card;
      ctx.fill();
    }

    if (style === 'gentle') {
      ctx.beginPath();
      ctx.moveTo(ex - rx * 1.10, eyeY - ry * 0.20);
      ctx.quadraticCurveTo(ex, eyeY - ry * 1.35, ex + rx * 1.10, eyeY - ry * 0.20);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(0.7, R * 0.045);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

/** 嘴型：smile / w / open / tongue / line / pout / smirk / fang */
function drawCatMouth(ctx, cx, cy, R, mouth, expr, ink, lw, alphaValue, hasDetail) {
  if (expr === 'happy') mouth = 'open';
  else if (expr === 'surprised') mouth = 'open';
  else if (expr === 'sleepy') mouth = 'line';

  var y = cy + R * 0.35;
  var lineW = Math.max(0.8, lw * 0.60);

  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = lineW;
  ctx.globalAlpha = alphaValue * 0.62;

  if (mouth === 'open') {
    ellipseFill(ctx, cx, cy + R * 0.38, R * 0.075, R * 0.095, ink);
    if (hasDetail) {
      ellipseFill(ctx, cx, cy + R * 0.42, R * 0.048, R * 0.038, themeBase.color.catBlush);
    }
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'tongue') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.09, y);
    ctx.quadraticCurveTo(cx, y + R * 0.07, cx + R * 0.09, y);
    ctx.stroke();
    ellipseFill(ctx, cx, y + R * 0.055, R * 0.055, R * 0.065, themeBase.color.catNose);
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'line') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.07, y);
    ctx.lineTo(cx + R * 0.07, y);
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'pout') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.075, y + R * 0.02);
    ctx.quadraticCurveTo(cx, y - R * 0.06, cx + R * 0.075, y + R * 0.02);
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'smirk') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.05, y);
    ctx.quadraticCurveTo(cx + R * 0.04, y - R * 0.03, cx + R * 0.11, y - R * 0.07);
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'fang') {
    // 深色小开口 + 白色小虎牙，浅色口鼻上也看得见
    ellipseFill(ctx, cx, y + R * 0.03, R * 0.105, R * 0.075, ink);
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.055, y - R * 0.035);
    ctx.lineTo(cx - R * 0.015, y + R * 0.055);
    ctx.lineTo(cx + R * 0.025, y - R * 0.035);
    ctx.closePath();
    ctx.fillStyle = themeBase.color.card;
    ctx.fill();
    if (hasDetail) {
      ellipseFill(ctx, cx, y + R * 0.070, R * 0.040, R * 0.025, themeBase.color.catBlush);
    }
    ctx.globalAlpha = alphaValue;
    return;
  }

  if (mouth === 'w') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.11, y - R * 0.02);
    ctx.quadraticCurveTo(cx - R * 0.055, y + R * 0.06, cx, y);
    ctx.quadraticCurveTo(cx + R * 0.055, y + R * 0.06, cx + R * 0.11, y - R * 0.02);
    ctx.stroke();
    ctx.globalAlpha = alphaValue;
    return;
  }

  // smile：默认
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.09, y - R * 0.02);
  ctx.quadraticCurveTo(cx, y + R * 0.07, cx + R * 0.09, y - R * 0.02);
  ctx.stroke();
  ctx.globalAlpha = alphaValue;
}

function starPath(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.quadraticCurveTo(cx + size * 0.18, cy - size * 0.18, cx + size, cy);
  ctx.quadraticCurveTo(cx + size * 0.18, cy + size * 0.18, cx, cy + size);
  ctx.quadraticCurveTo(cx - size * 0.18, cy + size * 0.18, cx - size, cy);
  ctx.quadraticCurveTo(cx - size * 0.18, cy - size * 0.18, cx, cy - size);
  ctx.closePath();
}

/** 配饰：铃铛/围巾/眼镜/小花/泪滴/蝴蝶结/星星/叶子/项圈/耳机/小皇冠 */
function drawCatAccessory(ctx, cx, cy, R, type, accColor, ink, hasDetail) {
  var deep = mix(accColor, ink, 0.22);

  if (type === 'bell') {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.30, cy + R * 0.78);
    ctx.lineTo(cx + R * 0.30, cy + R * 0.78);
    ctx.strokeStyle = accColor;
    ctx.lineWidth = Math.max(1, R * 0.055);
    ctx.lineCap = 'round';
    ctx.stroke();

    var by = cy + R * 0.95;
    var br = R * 0.105;
    ctx.beginPath();
    ctx.arc(cx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    ctx.strokeStyle = themeBase.color.coinDeep;
    ctx.lineWidth = Math.max(0.7, R * 0.04);
    ctx.stroke();
    if (hasDetail) {
      ctx.beginPath();
      ctx.moveTo(cx, by - R * 0.035);
      ctx.lineTo(cx, by + R * 0.035);
      ctx.strokeStyle = themeBase.color.coinDeep;
      ctx.lineWidth = Math.max(0.6, R * 0.025);
      ctx.stroke();
    }
    return;
  }

  if (type === 'scarf') {
    var w = R * 1.04;
    var h = R * 0.20;
    var x = cx - w / 2;
    var y = cy + R * 0.83;
    roundRectPath(ctx, x, y, w, h, h * 0.5);
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.7, R * 0.03);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + R * 0.34, y + h / 2, R * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = deep;
    ctx.fill();

    // 一小截围巾尾巴，避免看起来像项圈/奶嘴
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.28, y + h * 0.72);
    ctx.lineTo(cx + R * 0.42, y + h * 0.72);
    ctx.lineTo(cx + R * 0.35, y + h + R * 0.16);
    ctx.closePath();
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.stroke();
    return;
  }

  if (type === 'glasses') {
    var gdx = R * 0.36;
    var gy = cy - R * 0.02;
    var gr = R * 0.235;
    ctx.strokeStyle = accColor;
    ctx.lineWidth = Math.max(0.8, R * 0.04);
    ctx.fillStyle = alpha(themeBase.color.card, 0.16);
    ctx.beginPath();
    ctx.arc(cx - gdx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + gdx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - gdx + gr, gy);
    ctx.lineTo(cx + gdx - gr, gy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - gdx - gr, gy);
    ctx.lineTo(cx - R * 0.94, gy - R * 0.02);
    ctx.moveTo(cx + gdx + gr, gy);
    ctx.lineTo(cx + R * 0.94, gy - R * 0.02);
    ctx.stroke();
    return;
  }

  if (type === 'flower') {
    var fx = cx - R * 0.56;
    var fy = cy - R * 0.52;
    var pr = R * 0.10;
    var spread = R * 0.085;
    ctx.fillStyle = accColor;
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + (Math.PI * 2 / 5) * i;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * spread, fy + Math.sin(a) * spread, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(fx, fy, pr * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    return;
  }

  if (type === 'tear') {
    var tx = cx + R * 0.58;
    var ty = cy + R * 0.12;
    ctx.beginPath();
    ctx.moveTo(tx, ty - R * 0.15);
    ctx.quadraticCurveTo(tx + R * 0.12, ty + R * 0.02, tx, ty + R * 0.08);
    ctx.quadraticCurveTo(tx - R * 0.12, ty + R * 0.02, tx, ty - R * 0.15);
    ctx.closePath();
    ctx.fillStyle = accColor;
    ctx.fill();
    if (hasDetail) {
      ctx.beginPath();
      ctx.arc(tx - R * 0.03, ty - R * 0.02, R * 0.028, 0, Math.PI * 2);
      ctx.fillStyle = themeBase.color.card;
      ctx.fill();
    }
    return;
  }

  if (type === 'bow') {
    var bx = cx - R * 0.58;
    var byy = cy - R * 0.56;
    var lw2 = Math.max(0.7, R * 0.03);
    ctx.fillStyle = accColor;
    ctx.strokeStyle = deep;
    ctx.lineWidth = lw2;
    ctx.beginPath();
    ctx.moveTo(bx, byy);
    ctx.quadraticCurveTo(bx - R * 0.17, byy - R * 0.11, bx - R * 0.19, byy + R * 0.02);
    ctx.quadraticCurveTo(bx - R * 0.15, byy + R * 0.10, bx, byy + R * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, byy);
    ctx.quadraticCurveTo(bx + R * 0.17, byy - R * 0.11, bx + R * 0.19, byy + R * 0.02);
    ctx.quadraticCurveTo(bx + R * 0.15, byy + R * 0.10, bx, byy + R * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, byy + R * 0.01, R * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    return;
  }

  if (type === 'star') {
    var sx = cx - R * 0.56;
    var sy = cy - R * 0.54;
    starPath(ctx, sx, sy, R * 0.14);
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.stroke();
    return;
  }

  if (type === 'leaf') {
    var lx = cx - R * 0.58;
    var ly = cy - R * 0.50;
    var leafColor = mix(accColor, ink, 0.18);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-0.55);
    ellipseFill(ctx, -R * 0.045, 0, R * 0.055, R * 0.12, leafColor);
    ellipseFill(ctx, R * 0.055, R * 0.04, R * 0.045, R * 0.10, leafColor);
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.5, R * 0.02);
    ctx.beginPath();
    ctx.moveTo(-R * 0.045, -R * 0.10);
    ctx.lineTo(-R * 0.045, R * 0.10);
    ctx.moveTo(R * 0.055, -R * 0.05);
    ctx.lineTo(R * 0.055, R * 0.13);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(lx - R * 0.03, ly + R * 0.08);
    ctx.lineTo(lx + R * 0.02, ly + R * 0.18);
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.stroke();
    return;
  }

  if (type === 'collar') {
    var cw = R * 0.84;
    var ch = R * 0.10;
    roundRectPath(ctx, cx - cw / 2, cy + R * 0.82, cw, ch, ch * 0.5);
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.stroke();

    var ty2 = cy + R * 0.98;
    ctx.beginPath();
    ctx.moveTo(cx, ty2 - R * 0.07);
    ctx.lineTo(cx + R * 0.07, ty2);
    ctx.lineTo(cx, ty2 + R * 0.07);
    ctx.lineTo(cx - R * 0.07, ty2);
    ctx.closePath();
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    ctx.strokeStyle = themeBase.color.coinDeep;
    ctx.lineWidth = Math.max(0.6, R * 0.025);
    ctx.stroke();
    return;
  }

  if (type === 'headphones') {
    var hw = R * 0.84;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - R * 0.06);
    ctx.quadraticCurveTo(cx, cy - R * 1.28, cx + hw, cy - R * 0.06);
    ctx.strokeStyle = accColor;
    ctx.lineWidth = Math.max(1, R * 0.06);
    ctx.lineCap = 'round';
    ctx.stroke();

    var cupW = R * 0.20;
    var cupH = R * 0.32;
    var cupY = cy - R * 0.22;
    roundRectPath(ctx, cx - hw - cupW * 0.5, cupY, cupW, cupH, R * 0.07);
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.7, R * 0.03);
    ctx.stroke();
    roundRectPath(ctx, cx + hw - cupW * 0.5, cupY, cupW, cupH, R * 0.07);
    ctx.fillStyle = accColor;
    ctx.fill();
    ctx.stroke();
    if (hasDetail) {
      roundRectPath(ctx, cx - hw - cupW * 0.3, cupY + cupH * 0.18, cupW * 0.6, cupH * 0.62, R * 0.04);
      ctx.fillStyle = alpha(themeBase.color.card, 0.45);
      ctx.fill();
      roundRectPath(ctx, cx + hw - cupW * 0.3, cupY + cupH * 0.18, cupW * 0.6, cupH * 0.62, R * 0.04);
      ctx.fill();
    }
    return;
  }

  if (type === 'crown') {
    var cy2 = cy - R * 0.86;
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.23, cy2);
    ctx.lineTo(cx - R * 0.18, cy2 - R * 0.25);
    ctx.lineTo(cx - R * 0.06, cy2 - R * 0.10);
    ctx.lineTo(cx, cy2 - R * 0.30);
    ctx.lineTo(cx + R * 0.06, cy2 - R * 0.10);
    ctx.lineTo(cx + R * 0.18, cy2 - R * 0.25);
    ctx.lineTo(cx + R * 0.23, cy2);
    ctx.closePath();
    ctx.fillStyle = themeBase.color.coinFace;
    ctx.fill();
    ctx.strokeStyle = themeBase.color.coinDeep;
    ctx.lineWidth = Math.max(0.7, R * 0.03);
    ctx.stroke();
    if (hasDetail) {
      ctx.beginPath();
      ctx.arc(cx, cy2 - R * 0.06, R * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = themeBase.color.catNose;
      ctx.fill();
    }
    return;
  }
}

/**
 * 软萌日系贴纸猫头。size 为外接框宽度，头部略大、占满框。
 * 参数：cat.ear / eyes / mouth / pattern / accessory / acc；
 * 浅色猫用暖棕细线，深色猫自动换浅色轮廓；大图用一次渐变做柔光，
 * 棋盘小图用平涂，避免大量猫头每帧创建渐变对象。
 * opts.expression: normal / happy / surprised / sleepy。
 * 签名保持不变，美术替换时内部改成 drawImage 即可。
 */
function catFace(r, cx, cy, size, cat, opts) {
  var ctx = r.ctx;
  var R = size * 0.37;
  var ink = (opts && opts.ink) || themeBase.color.catInk;
  var base = cat.base;
  var dark = luminance(base) < 0.45;
  // 统一暖棕细线；深色脸改用暖白轮廓保证可读性
  var line = dark ? mix(base, themeBase.color.card, 0.62) : themeBase.color.catLine;
  var detailInk = dark ? ink : themeBase.color.catLine;
  var lw = Math.max(1, R * 0.065);
  var alphaValue = (opts && opts.alpha != null) ? opts.alpha : 1;
  var expr = pick(opts && opts.expression, CAT_EXPRESSIONS, 'normal');
  var ear = pick(cat.ear, CAT_EARS, 'point');
  var eyeStyle = pick(cat.eyes, CAT_EYES, 'dot');
  var mouthStyle = pick(cat.mouth, CAT_MOUTHS, 'smile');
  var pattern = pick(cat.pattern, CAT_PATTERNS, 'plain');
  var accessory = pick(cat.accessory, CAT_ACCESSORIES, '');
  var accColor = token(cat.acc, themeBase.color.cta);
  var patch = cat.patch || themeBase.color.card;
  var patch2 = cat.patch2 || patch;
  var inner = cat.inner || themeBase.color.catInner;
  var hasDetail = R > 8;

  ctx.save();
  ctx.globalAlpha = alphaValue;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawCatEar(ctx, cx, cy, R, -1, ear, base, inner, line, lw);
  drawCatEar(ctx, cx, cy, R, 1, ear, base, inner, line, lw);

  headPath(ctx, cx, cy, R);
  ctx.fillStyle = base;
  ctx.fill();

  // 底色 + 左上柔光 + 下半脸浅暗面；斑纹压在光影之上。
  // 大图用一次渐变做柔光，棋盘小图用平涂，避免每只猫都创建渐变对象。
  ctx.save();
  headPath(ctx, cx, cy, R);
  ctx.clip();
  ctx.globalAlpha = alphaValue;
  if (size > 64) {
    var hx = cx - R * 0.28;
    var hy = cy - R * 0.44;
    var hg = ctx.createRadialGradient(hx, hy, R * 0.06, hx, hy, R * 0.92);
    hg.addColorStop(0, alpha(themeBase.color.card, 0.17));
    hg.addColorStop(0.58, alpha(themeBase.color.card, 0.055));
    hg.addColorStop(1, alpha(themeBase.color.card, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    var shade = mix(base, ink, 0.10);
    var sg = ctx.createLinearGradient(0, cy - R * 0.12, 0, cy + R * 1.02);
    sg.addColorStop(0, alpha(shade, 0));
    sg.addColorStop(0.62, alpha(shade, 0.13));
    sg.addColorStop(1, alpha(shade, 0.24));
    ctx.fillStyle = sg;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  } else {
    ctx.globalAlpha = alphaValue * 0.10;
    ellipseFill(ctx, cx - R * 0.28, cy - R * 0.42, R * 0.62, R * 0.36, themeBase.color.card);
    ctx.globalAlpha = alphaValue * 0.22;
    ellipseFill(ctx, cx, cy + R * 0.66, R * 0.82, R * 0.32, mix(base, ink, 0.10));
  }
  ctx.globalAlpha = alphaValue;
  drawCatPattern(ctx, cx, cy, R, pattern, patch, patch2, ink, base);
  ctx.restore();

  drawCatEyes(ctx, cx, cy, R, eyeStyle, expr, ink, base, hasDetail);

  // 鼻子
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.07, cy + R * 0.21);
  ctx.lineTo(cx + R * 0.07, cy + R * 0.21);
  ctx.lineTo(cx, cy + R * 0.28);
  ctx.closePath();
  ctx.fillStyle = themeBase.color.catNose;
  ctx.fill();

  drawCatMouth(ctx, cx, cy, R, mouthStyle, expr, detailInk, lw, alphaValue, hasDetail);

  // 腮红
  if (hasDetail) {
    ctx.fillStyle = themeBase.color.catBlush;
    ctx.globalAlpha = alphaValue * (dark ? 0.68 : 0.42);
    ctx.beginPath(); ctx.arc(cx - R * 0.62, cy + R * 0.27, R * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + R * 0.62, cy + R * 0.27, R * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alphaValue;
  }

  // 胡须（只在大尺寸显示，避免小图变乱）
  if (size > 48) {
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(0.7, R * 0.04);
    ctx.globalAlpha = alphaValue * (dark ? 0.45 : 0.28);
    for (var i = 0; i < 2; i++) {
      var wy = cy + R * (0.12 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.80, wy);
      ctx.lineTo(cx - R * 1.14, wy - R * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.80, wy);
      ctx.lineTo(cx + R * 1.14, wy - R * 0.06);
      ctx.stroke();
    }
    ctx.globalAlpha = alphaValue;
  }

  // 轮廓（最后描，压住斑纹边缘）
  headPath(ctx, cx, cy, R);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.stroke();

  if (accessory) drawCatAccessory(ctx, cx, cy, R, accessory, accColor, detailInk, hasDetail);

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
