/**
 * 命中测试。界面的可点区域一律用这里的函数判断，避免散落比较逻辑。
 */

function inRect(x, y, rc) {
  return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
}

function inCircle(x, y, c) {
  var dx = x - c.cx;
  var dy = y - c.cy;
  return dx * dx + dy * dy <= c.r * c.r;
}

/** 圆形按钮的点击热区比视觉半径大 6px，手指友好 */
function inCircleLoose(x, y, c, slack) {
  var dx = x - c.cx;
  var dy = y - c.cy;
  var rr = c.r + (slack == null ? 6 : slack);
  return dx * dx + dy * dy <= rr * rr;
}

module.exports = { inRect: inRect, inCircle: inCircle, inCircleLoose: inCircleLoose };
