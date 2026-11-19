/**
 * 极简模板：%d 与 %s 按顺序替换，只用于文案。
 */
function format(tpl) {
  var args = arguments;
  var i = 1;
  return String(tpl).replace(/%[ds]/g, function () {
    return i < args.length ? String(args[i++]) : '';
  });
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** 毫秒 → mm:ss，用于对局计时与结算 */
format.duration = function (ms) {
  var total = Math.round((Number(ms) || 0) / 1000);
  if (total < 0) total = 0;
  var m = Math.floor(total / 60);
  var sec = total % 60;
  if (m > 99) { m = 99; sec = 59; }
  return pad2(m) + ':' + pad2(sec);
};

module.exports = format;
