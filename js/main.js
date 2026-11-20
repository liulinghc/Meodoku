/**
 * 入口。任何启动期异常都要被兜住并给出可见反馈，
 * 否则小游戏会白屏且无日志。
 */
var App = require('./app');
var theme = require('./data/theme');
var logger = require('./core/logger');

function drawFatal(err) {
  try {
    var canvas = wx.createCanvas();
    var ctx = canvas.getContext('2d');
    var info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    var w = (info.windowWidth || 375) * (info.pixelRatio || 2);
    var h = (info.windowHeight || 667) * (info.pixelRatio || 2);

    var c = theme.base.color;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.font = '600 16px sans-serif';
    ctx.fillText('启动失败，请重试', w / 2, h * 0.44);
    ctx.font = '400 12px sans-serif';
    ctx.fillStyle = c.textSoft;
    ctx.fillText(String((err && err.message) || err).slice(0, 120), w / 2, h * 0.48);
  } catch (e) {
    logger.error('错误屏绘制失败: ' + e.message);
  }
}

function start() {
  try {
    var app = new App();
    app.start();
    logger.info('启动完成');
    return app;
  } catch (e) {
    logger.error(e);
    drawFatal(e);
    return null;
  }
}

module.exports = { start: start };
