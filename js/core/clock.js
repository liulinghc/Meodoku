/**
 * 时间源。业务代码不直接 Date.now()，方便测试注入。
 */
var source = function () { return Date.now(); };

module.exports = {
  now: function () { return source(); },
  setSource: function (fn) { source = fn; }
};
