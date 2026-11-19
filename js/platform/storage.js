/**
 * 本地存储封装。所有异常必须吞掉，存储不可用时游戏仍要能跑（只是不保存）。
 */
var logger = require('../core/logger');

function get(key, fallback) {
  try {
    if (typeof wx === 'undefined' || !wx.getStorageSync) return fallback;
    var v = wx.getStorageSync(key);
    if (v === '' || v === undefined || v === null) return fallback;
    return v;
  } catch (e) {
    logger.warn('读取存储失败: ' + key);
    return fallback;
  }
}

function set(key, value) {
  try {
    if (typeof wx === 'undefined' || !wx.setStorageSync) return false;
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    logger.warn('写入存储失败: ' + key);
    return false;
  }
}

function remove(key) {
  try {
    if (typeof wx !== 'undefined' && wx.removeStorageSync) wx.removeStorageSync(key);
  } catch (e) { /* ignore */ }
}

module.exports = { get: get, set: set, remove: remove };
