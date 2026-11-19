/**
 * 布局计算。界面代码不得出现绝对坐标，全部从这里取。
 * 设计基准 375×812，逻辑像素。
 */
var BASE_W = 375;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function Layout(env) {
  this.w = env.width;
  this.h = env.height;
  this.dpr = env.dpr;
  this.safeTop = env.safeTop;
  this.safeBottom = env.safeBottom;
  this.s = clamp(env.width / BASE_W, 0.9, 1.15);
}

Layout.prototype.sp = function (v) { return v * this.s; };

/* ---------------- 棋盘几何 ---------------- */

Layout.prototype.boardGeom = function (n, size) {
  var s = this.s;
  var collapsed = n >= 8;
  var pad = (collapsed ? 6 : 8) * s;
  var gap = (collapsed ? 4 : 6) * s;
  var tile = (size - 2 * pad - (n - 1) * gap) / n;
  var radius = (collapsed ? 8 : 12) * s;
  return { n: n, size: size, pad: pad, gap: gap, tile: tile, radius: radius };
};

/** 格子相对棋盘左上角的矩形 */
Layout.prototype.cellRect = function (geom, r, c) {
  var x = geom.pad + c * (geom.tile + geom.gap);
  var y = geom.pad + r * (geom.tile + geom.gap);
  return { x: x, y: y, size: geom.tile };
};

/* ---------------- 游戏界面 ---------------- */

Layout.prototype.game = function (n) {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 16 * s;
  var collapsed = n >= 8;

  var topY = this.safeTop + 8 * s;
  var topH = 52 * s;

  var legendY = topY + topH + 2 * s;
  var legendH = 30 * s;

  var rulesY = legendY + legendH + 6 * s;
  var rulesH = (collapsed ? 32 : 66) * s;

  var bandH = 116 * s;
  var bandY = h - this.safeBottom - bandH;

  var availTop = rulesY + rulesH + 8 * s;
  var availBottom = bandY - 10 * s;
  var byW = w - 2 * margin;
  var byH = Math.max(120 * s, availBottom - availTop);
  var size = Math.min(byW, byH, h * 0.46);
  size = Math.max(160 * s, size);

  var boardY = availTop + Math.max(0, (availBottom - availTop - size) / 2);
  var boardX = (w - size) / 2;

  // 图例：N 个色块猫头，宽度自适应
  var legendGap = 6 * s;
  var legendItem = Math.min(24 * s, (w - 2 * margin - (n - 1) * legendGap) / n);
  if (legendItem < 14 * s) legendItem = 14 * s;

  // 规则卡
  var cardGap = 8 * s;
  var cardW = (w - 2 * margin - 2 * cardGap) / 3;

  var toolR = 23 * s;
  var toolY = bandY + 32 * s;

  return {
    n: n,
    s: s,
    margin: margin,
    collapsed: collapsed,
    topBar: { x: margin, y: topY, w: w - 2 * margin, h: topH },
    back: { cx: margin + 22 * s, cy: topY + topH / 2, r: 22 * s },
    gear: { cx: w - margin - 22 * s, cy: topY + topH / 2, r: 22 * s },
    legend: { x: margin, y: legendY, w: w - 2 * margin, h: legendH, item: legendItem, gap: legendGap },
    rules: { x: margin, y: rulesY, w: w - 2 * margin, h: rulesH, cardW: cardW, gap: cardGap },
    board: { x: boardX, y: boardY, size: size },
    geom: this.boardGeom(n, size),
    band: { y: bandY, h: bandH + this.safeBottom },
    tools: [
      { key: 'undo', cx: w / 2 - 64 * s, cy: toolY, r: toolR },
      { key: 'restart', cx: w / 2, cy: toolY, r: toolR },
      { key: 'hint', cx: w / 2 + 64 * s, cy: toolY, r: toolR }
    ],
    taglineY: bandY + 86 * s
  };
};

/* ---------------- 首页 ---------------- */

Layout.prototype.home = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 16 * s;

  var topY = this.safeTop + 8 * s;
  var topH = 44 * s;

  var titleY = topY + 72 * s;
  var catCY = h * 0.40;
  var catSize = 132 * s;

  var ctaY = h * 0.60;
  var ctaH = 54 * s;

  var cardsY = ctaY + ctaH + 18 * s;
  var cardH = 82 * s;
  var gap = 10 * s;
  var cardW = (w - 2 * margin - 2 * gap) / 3;

  return {
    s: s,
    margin: margin,
    topBar: { y: topY, h: topH },
    coin: { x: margin, y: topY, w: 92 * s, h: 32 * s },
    gear: { cx: w - margin - 18 * s, cy: topY + 16 * s, r: 18 * s },
    titleY: titleY,
    cat: { cx: w / 2, cy: catCY, size: catSize },
    cta: { x: 24 * s, y: ctaY, w: w - 48 * s, h: ctaH },
    cards: [
      { key: 'daily', x: margin, y: cardsY, w: cardW, h: cardH },
      { key: 'album', x: margin + cardW + gap, y: cardsY, w: cardW, h: cardH },
      { key: 'shop', x: margin + (cardW + gap) * 2, y: cardsY, w: cardW, h: cardH }
    ],
    footerY: h - this.safeBottom - 22 * s
  };
};

/* ---------------- 结算界面 ---------------- */

Layout.prototype.result = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 24 * s;

  var topY = this.safeTop + 8 * s;
  var ctaH = 54 * s;
  var mapH = 44 * s;
  var gap = 12 * s;
  var bottomPad = 10 * s;
  var ctaY = h - this.safeBottom - bottomPad - mapH - gap - ctaH;

  var contentTop = topY;
  var contentH = Math.max(300 * s, ctaY - 16 * s - contentTop);

  var pawsSize = 34 * s;
  var pawsGap = 18 * s;
  var statsH = 86 * s;
  var statsTop = contentTop + contentH * 0.60;

  return {
    s: s,
    margin: margin,
    cat: { cx: w / 2, cy: contentTop + contentH * 0.14, r: 54 * s, size: 92 * s },
    titleY: contentTop + contentH * 0.30,
    subY: contentTop + contentH * 0.30 + 34 * s,
    paws: { cy: contentTop + contentH * 0.47, size: pawsSize, gap: pawsGap },
    ratingY: contentTop + contentH * 0.53,
    stats: { x: w / 2 - (w - 2 * margin) / 2, y: statsTop, w: w - 2 * margin, h: statsH },
    reward: { cy: statsTop + statsH + 30 * s },
    cta: { x: margin, y: ctaY, w: w - 2 * margin, h: ctaH },
    map: { x: margin, y: ctaY + ctaH + gap, w: w - 2 * margin, h: mapH }
  };
};

/* ---------------- 关卡地图 ---------------- */

Layout.prototype.levelmap = function () {
  var s = this.s;
  var margin = 16 * s;
  var topY = this.safeTop + 8 * s;
  var topH = 52 * s;
  var chapterY = topY + topH + 6 * s;
  var chapterH = 34 * s;
  var listY = chapterY + chapterH + 10 * s;
  var listH = this.h - this.safeBottom - 12 * s - listY;

  return {
    s: s,
    margin: margin,
    topBar: { x: margin, y: topY, w: this.w - 2 * margin, h: topH },
    back: { cx: margin + 22 * s, cy: topY + topH / 2, r: 22 * s },
    chapter: { x: margin, y: chapterY, w: this.w - 2 * margin, h: chapterH },
    list: { x: 0, y: listY, w: this.w, h: Math.max(120 * s, listH) },
    nodeR: 24 * s,
    nodeGap: 76 * s,
    nodePadTop: 30 * s,
    nodePadBottom: 40 * s
  };
};

module.exports = Layout;
