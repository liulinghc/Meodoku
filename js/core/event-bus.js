/**
 * 极简发布订阅。用于跨层通知（存档变更、设置变更等），不做全局状态。
 */
function EventBus() {
  this._map = {};
}

EventBus.prototype.on = function (name, fn) {
  if (!this._map[name]) this._map[name] = [];
  this._map[name].push(fn);
  return fn;
};

EventBus.prototype.off = function (name, fn) {
  var list = this._map[name];
  if (!list) return;
  for (var i = list.length - 1; i >= 0; i--) {
    if (list[i] === fn) list.splice(i, 1);
  }
};

EventBus.prototype.emit = function (name, payload) {
  var list = this._map[name];
  if (!list) return;
  for (var i = 0; i < list.length; i++) {
    try { list[i](payload); } catch (e) { /* 单个订阅者异常不影响其余 */ }
  }
};

module.exports = EventBus;
