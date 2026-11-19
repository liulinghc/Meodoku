/**
 * 运行环境信息。所有 wx.get*Info 的兼容处理集中在这里。
 */
var logger = require('../core/logger');

/**
 * 右上角胶囊按钮（微信原生菜单）的位置，逻辑像素，原点为屏幕左上角。
 * 基础库 2.1.0 起支持；低版本或读取失败时返回 null，布局退回安全区。
 * 自定义顶部栏必须让到胶囊下方，不能与它抢同一块区域。
 */
function readMenu(width, height) {
  var m = null;
  try {
    if (typeof wx !== 'undefined' && wx.getMenuButtonBoundingClientRect) {
      m = wx.getMenuButtonBoundingClientRect();
    }
  } catch (e) {
    logger.warn('读取胶囊区域失败，顶部栏退回安全区');
  }
  if (!m || !(m.width > 0) || !(m.height > 0) || !(m.bottom > m.top)) return null;

  var left = Math.max(0, Math.min(width, m.left));
  var right = Math.max(0, Math.min(width, m.right));
  var top = Math.max(0, Math.min(height, m.top));
  var bottom = Math.max(0, Math.min(height, m.bottom));
  if (right <= left || bottom <= top) return null;

  return {
    left: left,
    top: top,
    right: right,
    bottom: bottom,
    width: right - left,
    height: bottom - top
  };
}

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
    menu: readMenu(width, height),
    platform: info.platform || 'devtools',
    isIOS: (info.platform || '') === 'ios'
  };
}

module.exports = { read: read };
