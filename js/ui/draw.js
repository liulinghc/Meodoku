/**
 * 程序化绘制：猫头、X、图标、色带。
 * 这是 S1 的占位美术层；最终美术替换后，这些函数改为 drawImage 即可，
 * 调用方签名保持不变。
 */

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
  return luminance(hex) > 0.62 ? '#6B4A35' : '#FFFFFF';
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
  ctx.fillStyle = 'rgba(90, 60, 40, 0.06)';
  r.roundPath(x, y + 3, w, h, rad);
  ctx.fill();
  ctx.fillStyle = 'rgba(90, 60, 40, 0.05)';
  r.roundPath(x, y + 6, w, h, rad);
  ctx.fill();
}

/* ---------------- 猫头 ---------------- */

function drawEar(ctx, cx, cy, R, side, fill, inner, ink, lw) {
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

/**
 * 贴纸式猫头。size 为外接框宽度，猫头占满框。
 */
function catFace(r, cx, cy, size, cat, opts) {
  var ctx = r.ctx;
  var R = size * 0.34;
  var ink = (opts && opts.ink) || '#2E2A28';
  var lw = Math.max(1, R * 0.10);
  var alpha = (opts && opts.alpha != null) ? opts.alpha : 1;
  var base = cat.base;
  var patch = cat.patch || '#FFFFFF';
  var inner = cat.inner || '#F4B8C8';
  var hasDetail = R > 8;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawEar(ctx, cx, cy, R, -1, base, inner, ink, lw);
  drawEar(ctx, cx, cy, R, 1, base, inner, ink, lw);

  // 头
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  // 斑纹：额头 + 口鼻（裁剪在头内）
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ellipseFill(ctx, cx, cy - R * 0.50, R * 0.30, R * 0.44, patch);
  ellipseFill(ctx, cx, cy + R * 0.36, R * 0.42, R * 0.27, patch);
  ctx.restore();

  // 眼睛：白眼球 + 描边 + 瞳孔 + 高光 —— 深色猫也能看清
  var eyeDX = R * 0.37;
  var eyeY = cy - R * 0.04;
  var sclera = R * 0.20;
  for (var si = -1; si <= 1; si += 2) {
    var ex = cx + si * eyeDX;
    ctx.beginPath();
    ctx.arc(ex, eyeY, sclera, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(0.7, lw * 0.5);
    ctx.stroke();

    var pr = sclera * 0.55;
    ctx.beginPath();
    ctx.arc(ex, eyeY + sclera * 0.06, pr, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();

    if (hasDetail) {
      ctx.beginPath();
      ctx.arc(ex - pr * 0.40, eyeY - pr * 0.42, pr * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }

  // 鼻子
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.08, cy + R * 0.26);
  ctx.lineTo(cx + R * 0.08, cy + R * 0.26);
  ctx.lineTo(cx, cy + R * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#E8879B';
  ctx.fill();

  // 嘴
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.13, cy + R * 0.38);
  ctx.quadraticCurveTo(cx - R * 0.065, cy + R * 0.49, cx, cy + R * 0.42);
  ctx.quadraticCurveTo(cx + R * 0.065, cy + R * 0.49, cx + R * 0.13, cy + R * 0.38);
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(0.8, lw * 0.62);
  ctx.globalAlpha = alpha * 0.55;
  ctx.stroke();
  ctx.globalAlpha = alpha;

  // 腮红
  if (hasDetail) {
    ctx.fillStyle = '#F6A6B8';
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
      ctx.lineTo(cx - R * 1.16, wy - R * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.78, wy);
      ctx.lineTo(cx + R * 1.16, wy - R * 0.08);
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
  ctx.fillStyle = color || '#F2C94C';
  ctx.fill();
  r.strokeCircle(cx, cy, rad * 0.72, '#D9A62E', Math.max(1, size * 0.07));
  ellipseFill(ctx, cx, cy, rad * 0.16, rad * 0.20, '#D9A62E');
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
  ctx.strokeStyle = alpha(ink || '#5B4335', 0.16);
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
    cross(0, 1, alpha('#5B4335', 0.35));
    cross(2, 1, alpha('#5B4335', 0.35));
  } else {
    dot(0, 0, accent);
    cross(0, 1, alpha('#5B4335', 0.35));
    cross(1, 0, alpha('#5B4335', 0.35));
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
  iconBack: iconBack,
  iconGear: iconGear,
  iconUndo: iconUndo,
  iconRestart: iconRestart,
  iconEraser: iconEraser,
  iconBulb: iconBulb,
  iconPaw: iconPaw,
  iconCoin: iconCoin,
  iconLock: iconLock,
  iconCheck: iconCheck,
  ruleIcon: ruleIcon,
  waveBand: waveBand
};
