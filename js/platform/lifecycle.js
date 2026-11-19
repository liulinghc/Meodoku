/**
 * 小程序/小游戏生命周期绑定。
 */
var logger = require('../core/logger');

function bind(hooks) {
  if (typeof wx === 'undefined') return;
  hooks = hooks || {};

  try {
    if (wx.onHide && hooks.onHide) wx.onHide(hooks.onHide);
    if (wx.onShow && hooks.onShow) wx.onShow(hooks.onShow);
    if (wx.onError && hooks.onError) wx.onError(function (err) { hooks.onError(err); });
    if (wx.onUnhandledRejection && hooks.onError) {
      wx.onUnhandledRejection(function (res) { hooks.onError(res && res.reason); });
    }
    if (wx.onMemoryWarning) {
      wx.onMemoryWarning(function () { logger.warn('内存告警'); });
    }
  } catch (e) {
    logger.error('生命周期绑定失败: ' + e.message);
  }
}

module.exports = { bind: bind };
