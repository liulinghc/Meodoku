/**
 * 运行环境信息。所有 wx.get*Info 的兼容处理集中在这里。
 */
var logger = require('../core/logger');

function read() {
  var info = null;
  try {
    if (typeof wx !== 'undefined' && wx.getWindowInfo) info = wx.getWindowInfo();
  } catch (e) { /* 低版本基础库无此 API */ }

  if (!info) {
    try {
      if (typeof wx !== 'undefined' && wx.getSystemInfoSync) info = wx.getSystemInfoSync();
    } catch (e) {
      logger.warn('读取系统信息失败，使用默认值');
    }
  }
  info = info || {};

  var width = info.windowWidth || info.screenWidth || 375;
  var height = info.windowHeight || info.screenHeight || 667;
  var dpr = info.pixelRatio || 2;

  // DPR 上限 2：3x 屏上画布像素翻 4 倍，低端机吃不消，收益极小
  dpr = Math.min(2, dpr);

  var statusBar = info.statusBarHeight || 0;
  var safeTop = statusBar;
  var safeBottom = 0;

  if (info.safeArea) {
    safeTop = info.safeArea.top || statusBar;
    safeBottom = Math.max(0, height - (info.safeArea.bottom || height));
  }

  return {
    width: width,
    height: height,
    dpr: dpr,
    statusBarHeight: statusBar,
    safeTop: safeTop,
    safeBottom: safeBottom,
    platform: info.platform || 'devtools',
    isIOS: (info.platform || '') === 'ios'
  };
}

module.exports = { read: read };
