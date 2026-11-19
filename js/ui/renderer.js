/**
 * Canvas 绘制底座。
 * 只提供"画形状"的能力，不含任何业务语义。
 * 坐标系统一为逻辑像素（与 wx 触摸坐标一致），DPR 在内部处理。
 */
var FONT_FAMILY = 'sans-serif';

function Renderer(canvas, ctx, width, height, dpr) {
  this.canvas = canvas;
  this.ctx = ctx;
  this.w = width;
  this.h = height;
  this.dpr = dpr;
  this.offscreenCount = 0;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

Renderer.prototype.begin = function () {
  var ctx = this.ctx;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.clearRect(0, 0, this.w, this.h);
};

Renderer.prototype.fill = function (color) {
  this.ctx.fillStyle = color;
  this.ctx.fillRect(0, 0, this.w, this.h);
};

Renderer.prototype.rect = function (x, y, w, h, color) {
  this.ctx.fillStyle = color;
  this.ctx.fillRect(x, y, w, h);
};

Renderer.prototype.roundPath = function (x, y, w, h, r) {
  var ctx = this.ctx;
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

Renderer.prototype.roundRect = function (x, y, w, h, r, color) {
  this.roundPath(x, y, w, h, r);
  this.ctx.fillStyle = color;
  this.ctx.fill();
};

Renderer.prototype.strokeRoundRect = function (x, y, w, h, r, color, lw) {
  this.roundPath(x, y, w, h, r);
  this.ctx.strokeStyle = color;
  this.ctx.lineWidth = lw || 1;
  this.ctx.stroke();
};

Renderer.prototype.circle = function (cx, cy, radius, color) {
  var ctx = this.ctx;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, radius), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};

Renderer.prototype.strokeCircle = function (cx, cy, radius, color, lw) {
  var ctx = this.ctx;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, radius), 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 1;
  ctx.stroke();
};

Renderer.prototype.line = function (x1, y1, x2, y2, color, lw, cap) {
  var ctx = this.ctx;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 1;
  ctx.lineCap = cap || 'round';
  ctx.stroke();
};

Renderer.prototype.text = function (str, x, y, opt) {
  opt = opt || {};
  var ctx = this.ctx;
  var size = Math.round(opt.size || 14);
  var weight = opt.weight || '400';
  ctx.font = weight + ' ' + size + 'px ' + FONT_FAMILY;
  ctx.fillStyle = opt.color || '#000000';
  ctx.textAlign = opt.align || 'left';
  ctx.textBaseline = opt.baseline || 'middle';
  if (opt.maxWidth) ctx.fillText(str, x, y, opt.maxWidth);
  else ctx.fillText(str, x, y);
};

Renderer.prototype.measure = function (str, size, weight) {
  var ctx = this.ctx;
  ctx.font = (weight || '400') + ' ' + Math.round(size) + 'px ' + FONT_FAMILY;
  return ctx.measureText(str).width;
};

Renderer.prototype.save = function () { this.ctx.save(); };
Renderer.prototype.restore = function () { this.ctx.restore(); };

Renderer.prototype.clipRect = function (x, y, w, h) {
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
};

Renderer.prototype.unclip = function () { this.ctx.restore(); };

/**
 * 创建离屏图层（已按 DPR 缩放，绘制时仍用逻辑坐标）。
 * 低端机离屏画布数量有限，用完即弃，不要缓存太多张。
 */
Renderer.prototype.layer = function (w, h) {
  var dpr = this.dpr;
  var pw = Math.max(1, Math.round(w * dpr));
  var ph = Math.max(1, Math.round(h * dpr));
  var canvas = null;

  try {
    if (typeof wx !== 'undefined' && wx.createOffscreenCanvas) {
      canvas = wx.createOffscreenCanvas({ type: '2d', width: pw, height: ph });
    } else if (typeof wx !== 'undefined' && wx.createCanvas) {
      canvas = wx.createCanvas();
    }
  } catch (e) { canvas = null; }

  if (!canvas) return null;

  canvas.width = pw;
  canvas.height = ph;
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.offscreenCount++;

  return { canvas: canvas, ctx: ctx, w: w, h: h };
};

Renderer.prototype.drawLayer = function (layer, x, y) {
  if (!layer) return;
  this.ctx.drawImage(layer.canvas, x, y, layer.w, layer.h);
};

module.exports = Renderer;
