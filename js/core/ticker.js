/**
 * 主循环。dt 以秒为单位，单帧上限 50ms，避免切后台回来的巨大跳变。
 */
function Ticker(onFrame) {
  this.onFrame = onFrame;
  this.running = false;
  this.last = 0;
  this._raf = null;
  this._tick = this._tick.bind(this);
}

Ticker.prototype.start = function () {
  if (this.running) return;
  this.running = true;
  this.last = 0;
  this._schedule();
};

Ticker.prototype._schedule = function () {
  var self = this;
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  if (raf) {
    this._raf = raf(function (ts) { self._tick(ts); });
  } else {
    this._raf = setTimeout(function () { self._tick(Date.now()); }, 16);
  }
};

Ticker.prototype._tick = function (ts) {
  if (!this.running) return;
  var dt = this.last ? (ts - this.last) / 1000 : 0.016;
  if (dt < 0) dt = 0;
  if (dt > 0.05) dt = 0.05;
  this.last = ts;
  this.onFrame(dt);
  if (this.running) this._schedule();
};

Ticker.prototype.stop = function () {
  this.running = false;
  if (this._raf != null) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    else clearTimeout(this._raf);
  }
  this._raf = null;
};

module.exports = Ticker;
