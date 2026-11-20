/**
 * 环形日志。小游戏没有后端，出问题时靠它把最近 50 条打出来。
 */
var MAX = 50;
var buf = [];

function push(level, msg) {
  var text = msg;
  if (msg instanceof Error) text = msg.message + '\n' + (msg.stack || '');
  else if (typeof msg !== 'string') {
    try { text = JSON.stringify(msg); } catch (e) { text = String(msg); }
  }
  buf.push({ t: Date.now(), level: level, msg: text });
  if (buf.length > MAX) buf.shift();
  var fn = console[level] || console.log;
  if (fn) fn.call(console, '[喵喵迷阵][' + level + ']', text);
}

module.exports = {
  info: function (msg) { push('log', msg); },
  warn: function (msg) { push('warn', msg); },
  error: function (msg) { push('error', msg); },
  recent: function () { return buf.slice(); }
};
