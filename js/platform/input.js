/**
 * 触摸输入 → 语义事件。
 * 只识别单指：tap / drag / cancel。坐标已转换为逻辑像素（与 wx 返回一致）。
 */
var TAP_MS = 250;
var TAP_SLOP = 12;

function Input(sceneManager) {
  this.sm = sceneManager;
  this.active = false;
  this.id = null;
  this.x0 = 0;
  this.y0 = 0;
  this.x = 0;
  this.y = 0;
  this.t0 = 0;
  this.moved = false;
  this._bound = false;
}

Input.prototype.bind = function () {
  if (this._bound || typeof wx === 'undefined') return;
  var self = this;

  if (wx.onTouchStart) {
    wx.onTouchStart(function (e) { self._start(e); });
    wx.onTouchMove(function (e) { self._move(e); });
    wx.onTouchEnd(function (e) { self._end(e); });
    wx.onTouchCancel(function () { self._cancel(); });
  }
  this._bound = true;
};

Input.prototype._start = function (e) {
  var touches = e.touches || [];
  if (!touches.length) return;
  var t = touches[0];
  this.active = true;
  this.id = t.identifier;
  this.x0 = t.clientX; this.y0 = t.clientY;
  this.x = t.clientX; this.y = t.clientY;
  this.t0 = Date.now();
  this.moved = false;
  this.sm.onTouchStart(this.x, this.y);
};

Input.prototype._move = function (e) {
  if (!this.active) return;
  var t = this._find(e.changedTouches) || this._find(e.touches);
  if (!t) return;
  var dx = t.clientX - this.x;
  var dy = t.clientY - this.y;
  this.x = t.clientX; this.y = t.clientY;
  if (Math.abs(t.clientX - this.x0) > TAP_SLOP || Math.abs(t.clientY - this.y0) > TAP_SLOP) {
    this.moved = true;
  }
  this.sm.onTouchMove(this.x, this.y, dx, dy);
};

Input.prototype._end = function (e) {
  if (!this.active) return;
  var t = this._find(e.changedTouches) || this._find(e.touches);
  var x = t ? t.clientX : this.x;
  var y = t ? t.clientY : this.y;
  var dt = Date.now() - this.t0;
  var isTap = !this.moved && dt < TAP_MS;
  this.active = false;
  this.id = null;
  this.sm.onTouchEnd(x, y, isTap);
};

Input.prototype._cancel = function () {
  if (!this.active) return;
  this.active = false;
  this.id = null;
  this.sm.onTouchCancel();
};

Input.prototype._find = function (list) {
  if (!list || !list.length) return null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].identifier === this.id) return list[i];
  }
  return list[0];
};

module.exports = Input;
