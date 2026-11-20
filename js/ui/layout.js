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
  this.menu = env.menu || null;
  this.s = clamp(env.width / BASE_W, 0.9, 1.15);
}

Layout.prototype.sp = function (v) { return v * this.s; };

/**
 * 顶部内容的起点。
 *
 * 微信右上角胶囊由系统绘制，永远压在画布最上层。游戏自绘的返回键、金币、
 * 帮助/签到/设置等如果放在安全区顶部就会和胶囊重叠（截图里的问题）。
 * 有胶囊信息时，整条自定义顶栏让到胶囊下方；没有胶囊信息时维持原来
 * 的“安全区 + 8”行为，老版本基础库也不会被顶开。
 */
Layout.prototype.topInset = function () {
  var base = this.safeTop + 8 * this.s;
  if (!this.menu) return base;
  return Math.max(base, this.menu.bottom + 10 * this.s);
};

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

  // 矮屏（如 320×568 / 375×667）压缩页头、HUD、图例与规则条，
  // 把高度还给棋盘，否则胶囊让位后 9×9 格子会掉到 24–28px 的可读阈值以下。
  var short = h < 700;
  var topY = this.topInset();
  var topH = (short ? 46 : 52) * s;

  // 标题下两枚 HUD 胶囊：进度 / 用时与失误
  var hudGap = 8 * s;
  var hudH = (short ? 26 : 30) * s;
  var hudY = topY + topH + 3 * s;
  var hudW = (w - 2 * margin - hudGap) / 2;

  // 低对比区域图例：小尺寸、无底色强调，只作为色区进度辅助行
  var legendGap = 6 * s;
  var legendItem = Math.min((short ? 16 : 18) * s,
    (w - 2 * margin - (n - 1) * legendGap) / n);
  if (legendItem < 14 * s) legendItem = 14 * s;
  var legendY = hudY + hudH + 3 * s;
  var legendH = legendItem + 2 * s;

  // 规则条：始终三块等宽文字卡；8×9 路使用更矮的紧凑版
  var rulesY = legendY + legendH + 4 * s;
  var rulesH = collapsed ? (short ? 30 : 32) * s : (short ? 44 : 48) * s;
  var cardGap = 8 * s;
  var cardW = (w - 2 * margin - 2 * cardGap) / 3;

  var bandH = 116 * s;
  var bandY = h - this.safeBottom - bandH;

  var availTop = rulesY + rulesH + 6 * s;
  var availBottom = bandY - 10 * s;
  var byW = w - 2 * margin;
  var byH = Math.max(120 * s, availBottom - availTop);
  var size = Math.min(byW, byH, h * 0.46);
  size = Math.max(160 * s, size);

  var boardY = availTop + Math.max(0, (availBottom - availTop - size) / 2);
  var boardX = (w - size) / 2;

  // 底部工具胶囊：三等分排开，保留 cx/cy/r 以兼容旧输入测试
  var toolGap = 8 * s;
  var toolW = (w - 2 * margin - toolGap * 2) / 3;
  var toolH = (short ? 38 : 42) * s;
  var toolY = bandY + (short ? 28 : 30) * s;
  var toolKeys = ['undo', 'restart', 'hint'];
  var tools = [];
  for (var ti = 0; ti < 3; ti++) {
    var tx = margin + ti * (toolW + toolGap);
    tools.push({
      key: toolKeys[ti],
      x: tx, y: toolY, w: toolW, h: toolH,
      capsule: { x: tx, y: toolY, w: toolW, h: toolH },
      cx: tx + toolW / 2, cy: toolY + toolH / 2, r: toolH / 2
    });
  }

  return {
    n: n,
    s: s,
    margin: margin,
    collapsed: collapsed,
    topBar: { x: margin, y: topY, w: w - 2 * margin, h: topH },
    back: { cx: margin + 22 * s, cy: topY + topH / 2, r: 22 * s },
    help: { cx: w - margin - 70 * s, cy: topY + topH / 2, r: 22 * s },
    gear: { cx: w - margin - 22 * s, cy: topY + topH / 2, r: 22 * s },
    hud: {
      y: hudY, h: hudH, gap: hudGap,
      progress: { x: margin, y: hudY, w: hudW, h: hudH },
      time: { x: margin + hudW + hudGap, y: hudY, w: hudW, h: hudH }
    },
    legend: { x: margin, y: legendY, w: w - 2 * margin, h: legendH, item: legendItem, gap: legendGap },
    rules: { x: margin, y: rulesY, w: w - 2 * margin, h: rulesH, cardW: cardW, gap: cardGap },
    board: { x: boardX, y: boardY, size: size, inset: 3 * s },
    geom: this.boardGeom(n, size),
    band: { y: bandY, h: bandH + this.safeBottom },
    tools: tools,
    bandPaws: [
      { cx: w * 0.08, cy: bandY + 24 * s, size: 16 * s },
      { cx: w * 0.92, cy: bandY + 58 * s, size: 14 * s },
      { cx: w * 0.16, cy: bandY + 76 * s, size: 11 * s }
    ],
    taglineY: bandY + (short ? 82 : 88) * s
  };
};

/* ---------------- 首页 ---------------- */

Layout.prototype.home = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 16 * s;

  var topY = this.topInset();
  var topH = 44 * s;

  // 标题 → 副标题胶囊 → 猫咪舞台 → 主按钮 → 三宫格，纵向依次排开。
  // 矮屏（h < 700）缩小猫咪并按顺序下推主按钮，避免与胶囊或标题互相挤压。
  var titleY = topY + 72 * s;
  var pillH = 26 * s;
  var pillY = titleY + 22 * s;

  var catSize = (h < 700 ? 104 : 132) * s;
  var stageR = catSize * 0.74;
  var catCY = Math.max(h * 0.40, pillY + pillH + 12 * s + stageR);

  var tagH = 26 * s;
  var tagW = Math.min(184 * s, w - 2 * margin);
  var catTagY = catCY + catSize * 0.62 + 8 * s - tagH / 2;

  var ctaY = Math.max(h * 0.60, catTagY + tagH + 18 * s);
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
    help: { cx: w - margin - 108 * s, cy: topY + 16 * s, r: 18 * s },
    checkin: { cx: w - margin - 64 * s, cy: topY + 16 * s, r: 18 * s },
    gear: { cx: w - margin - 18 * s, cy: topY + 16 * s, r: 18 * s },
    titleY: titleY,
    kicker: { x: w / 2 - 60 * s, y: pillY, w: 120 * s, h: pillH },
    cat: { cx: w / 2, cy: catCY, size: catSize },
    catTag: { x: (w - tagW) / 2, y: catTagY, w: tagW, h: tagH },
    cta: { x: 24 * s, y: ctaY, w: w - 48 * s, h: ctaH },
    cards: [
      { key: 'daily', x: margin, y: cardsY, w: cardW, h: cardH },
      { key: 'album', x: margin + cardW + gap, y: cardsY, w: cardW, h: cardH },
      { key: 'shop', x: margin + (cardW + gap) * 2, y: cardsY, w: cardW, h: cardH }
    ],
    // 背景装饰只取相对位置，渲染层不写绝对坐标
    deco: {
      blobA: { cx: w * 0.90, cy: titleY - 44 * s, r: 96 * s },
      blobB: { cx: w * 0.06, cy: catCY + 118 * s, r: 72 * s },
      pawL: { cx: margin + 4 * s, cy: titleY + 20 * s, size: 22 * s },
      pawR: { cx: w - margin - 2 * s, cy: catCY - 58 * s, size: 16 * s },
      starL: { cx: margin + 26 * s, cy: catCY - 84 * s, size: 12 * s },
      starR: { cx: w - margin - 22 * s, cy: catCY + 46 * s, size: 10 * s },
      stage: { cx: w / 2, cy: catCY, r: stageR, innerR: catSize * 0.60 },
      // 触摸视差的最大位移；舞台按 0.45 倍跟随，背景装饰按 0.8–1.05 倍分层跟随
      parallax: { x: 5 * s, y: 4 * s, stage: 0.45, bg: 0.8 }
    },
    footerY: h - this.safeBottom - 22 * s
  };
};

/* ---------------- 玩法说明 ---------------- */

Layout.prototype.guide = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 16 * s;
  var pad = 18 * s;
  var ctaH = 46 * s;

  // 弹窗：不铺满整屏，居中显示在当前场景之上；顶部同样让开胶囊
  var top = this.topInset();
  var cardW = Math.min(w - 2 * margin, 360 * s);
  var cardH = Math.min(414 * s, h - top - this.safeBottom - 24 * s);
  var x = (w - cardW) / 2;
  var y = top + Math.max(6 * s, (h - top - this.safeBottom - cardH) / 2);

  var contentX = x + pad;
  var contentW = cardW - 2 * pad;
  var ctaY = y + cardH - pad - ctaH;
  var dotsY = ctaY - 22 * s;

  var tile = 26 * s;
  var rowGap = 38 * s;
  var row0 = y + 116 * s;
  var rows = [];
  for (var i = 0; i < 3; i++) {
    rows.push({ x: contentX, y: row0 + i * rowGap, size: tile });
  }

  var dots = [];
  for (var d = 0; d < 3; d++) {
    dots.push({ cx: w / 2 + (d - 1) * 18 * s, cy: dotsY, r: 4 * s });
  }

  return {
    card: { x: x, y: y, w: cardW, h: cardH },
    close: { cx: x + cardW - pad - 14 * s, cy: y + pad + 14 * s, r: 14 * s },
    titleY: y + 36 * s,
    dividerY: y + 56 * s,
    goal: { x: contentX, y: y + 78 * s, w: contentW, h: 110 * s },
    tap: { x: contentX, y: y + 72 * s, w: contentW, h: 160 * s, rows: rows },
    tip: { x: contentX, y: y + 82 * s, w: contentW, h: 118 * s },
    dots: dots,
    cta: { x: contentX, y: ctaY, w: contentW, h: ctaH }
  };
}

/* ---------------- 首次规则卡 ---------------- */

Layout.prototype.coach = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 16 * s;
  var pad = 18 * s;
  var cardW = Math.min(w - 2 * margin, 336 * s);
  var cardH = 196 * s;
  var x = (w - cardW) / 2;
  var y = Math.max(this.topInset() + 28 * s, h * 0.5 - cardH * 0.62);
  var btnH = 42 * s;

  return {
    card: { x: x, y: y, w: cardW, h: cardH },
    titleX: x + pad,
    titleY: y + 34 * s,
    bodyX: x + pad,
    bodyY: y + 66 * s,
    bodyW: cardW - 2 * pad,
    lineH: 21 * s,
    cta: { x: x + pad, y: y + cardH - pad - btnH, w: cardW - 2 * pad, h: btnH }
  };
};;

/* ---------------- 结算界面 ---------------- */

Layout.prototype.result = function () {
  var s = this.s;
  var w = this.w;
  var h = this.h;
  var margin = 24 * s;

  var topY = this.topInset();
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
  var statsW = w - 2 * margin;
  var statsTop = contentTop + contentH * 0.60;
  var ribbonW = 62 * s;
  var ribbonH = 20 * s;

  return {
    s: s,
    margin: margin,
    cat: { cx: w / 2, cy: contentTop + contentH * 0.14, r: 54 * s, size: 92 * s },
    titleY: contentTop + contentH * 0.30,
    subY: contentTop + contentH * 0.30 + 34 * s,
    paws: { cy: contentTop + contentH * 0.47, size: pawsSize, gap: pawsGap },
    ratingY: contentTop + contentH * 0.53,
    stats: {
      x: margin, y: statsTop, w: statsW, h: statsH,
      // 最佳成绩角标压在信息卡右上边缘，避免另占一行
      ribbon: {
        x: margin + statsW - ribbonW - 10 * s,
        y: statsTop - ribbonH * 0.5,
        w: ribbonW,
        h: ribbonH
      }
    },
    reward: { cy: statsTop + statsH + 30 * s },
    cta: { x: margin, y: ctaY, w: w - 2 * margin, h: ctaH },
    ctaDepth: 4 * s,
    map: { x: margin, y: ctaY + ctaH + gap, w: w - 2 * margin, h: mapH }
  };
};

/* ---------------- 关卡地图 ---------------- */

Layout.prototype.levelmap = function () {
  var s = this.s;
  var margin = 16 * s;
  var topY = this.topInset();
  var topH = 52 * s;

  // 章节横幅：通栏白卡，左右各一枚翻页圆钮，中间两行（标题 / 进度条）
  var chapterY = topY + topH + 8 * s;
  var chapterH = 56 * s;
  var arrowR = 15 * s;
  var arrowX = 24 * s;
  var contentPad = 58 * s;
  var chapter = {
    x: margin, y: chapterY, w: this.w - 2 * margin, h: chapterH,
    prev: { cx: margin + arrowX, cy: chapterY + chapterH / 2, r: arrowR },
    next: { cx: this.w - margin - arrowX, cy: chapterY + chapterH / 2, r: arrowR },
    title: { x: margin + contentPad, y: chapterY + 21 * s },
    progress: { x: this.w - margin - contentPad, y: chapterY + 21 * s },
    bar: {
      x: margin + contentPad, y: chapterY + 38 * s,
      w: this.w - 2 * margin - contentPad * 2, h: 5 * s
    }
  };

  var listY = chapterY + chapterH + 10 * s;
  var listH = this.h - this.safeBottom - 12 * s - listY;
  var nodeR = 24 * s;

  return {
    s: s,
    margin: margin,
    topBar: { x: margin, y: topY, w: this.w - 2 * margin, h: topH },
    back: { cx: margin + 22 * s, cy: topY + topH / 2, r: 22 * s },
    chapter: chapter,
    list: { x: 0, y: listY, w: this.w, h: Math.max(120 * s, listH) },
    nodeR: nodeR,
    nodeGap: 88 * s,
    nodeGapMax: 104 * s,
    nodePadTop: 30 * s,
    nodePadBottom: 40 * s,
    // 节点间的虚线路径：手工分段绘制，不依赖 Canvas 的 setLineDash
    path: { dash: 6 * s, gap: 5 * s, width: 3 * s, endPad: nodeR + 3 * s }
  };
};


/* ---------------- 公共页头 ---------------- */

/** 子页面统一页头：返回按钮 + 居中标题 */
Layout.prototype.page = function () {
  var s = this.s;
  var margin = 16 * s;
  var topY = this.topInset();
  var topH = 52 * s;
  return {
    s: s,
    w: this.w,
    h: this.h,
    margin: margin,
    topBar: { x: margin, y: topY, w: this.w - 2 * margin, h: topH },
    back: { cx: margin + 22 * s, cy: topY + topH / 2, r: 22 * s },
    contentY: topY + topH + 12 * s,
    bottom: this.h - this.safeBottom - 12 * s
  };
};

/* ---------------- 每日挑战 ---------------- */

Layout.prototype.daily = function () {
  var p = this.page();
  var s = p.s;
  var w = p.w - 2 * p.margin;

  var ctaH = 54 * s;
  var ctaY = p.bottom - ctaH;
  var heroH = 158 * s;
  var statsH = 64 * s;
  var histLabelH = 18 * s;
  var histH = 44 * s;
  var rewardH = 62 * s;
  var gap1 = 12 * s;
  var gap2 = 18 * s;
  var gap3 = 10 * s;
  var gap4 = 18 * s;

  var clusterH = heroH + gap1 + statsH + gap2 + histLabelH + histH + gap3 + rewardH;
  var top = p.contentY + Math.max(0, (ctaY - 16 * s - p.contentY - clusterH) / 2);

  var heroY = top;
  var statsY = heroY + heroH + gap1;
  var histLabelY = statsY + statsH + gap2;
  var histY = histLabelY + histLabelH;
  var rewardY = histY + histH + gap3;

  var histGap = 6 * s;
  var histCellW = (w - histGap * 6) / 7;

  return {
    s: s,
    w: p.w,
    h: p.h,
    margin: p.margin,
    topBar: p.topBar,
    back: p.back,
    hero: {
      x: p.margin, y: heroY, w: w, h: heroH,
      // 日期印章与猫咪各占右上、右下，互不遮挡文字区
      date: { cx: p.margin + w - 42 * s, cy: heroY + 34 * s, r: 22 * s },
      cat: { cx: p.margin + w - 50 * s, cy: heroY + 86 * s, size: 52 * s }
    },
    stats: { x: p.margin, y: statsY, w: w, h: statsH },
    historyLabelY: histLabelY + histLabelH / 2,
    history: {
      x: p.margin,
      y: histY,
      w: w,
      h: histH,
      cellW: histCellW,
      gap: histGap
    },
    reward: { x: p.margin, y: rewardY, w: w, h: rewardH },
    cta: { x: 24 * s, y: ctaY, w: p.w - 48 * s, h: ctaH }
  };
};

/* ---------------- 签到 ---------------- */

Layout.prototype.checkin = function () {
  var p = this.page();
  var s = p.s;
  var w = p.w - 2 * p.margin;

  var claimH = 52 * s;
  var claimY = p.bottom - claimH;
  var makeupH = 40 * s;
  var makeupY = claimY - 10 * s - makeupH;

  var statsH = 62 * s;
  var weekH = 88 * s;
  var mileLabelH = 18 * s;
  var mileH = 56 * s;

  var clusterH = statsH + 16 * s + weekH + 22 * s + mileLabelH + 8 * s + mileH;
  var top = p.contentY + Math.max(0, (makeupY - 14 * s - p.contentY - clusterH) / 2);

  var statsY = top;
  var weekY = statsY + statsH + 16 * s;
  var mileLabelY = weekY + weekH + 22 * s;
  var mileY = mileLabelY + mileLabelH + 8 * s;

  var weekGap = 5 * s;
  var weekCellW = (w - weekGap * 6) / 7;
  var mileGap = 6 * s;
  var mileW = (w - mileGap * 4) / 5;

  return {
    s: s,
    w: p.w,
    h: p.h,
    margin: p.margin,
    topBar: p.topBar,
    back: p.back,
    stats: { x: p.margin, y: statsY, w: w, h: statsH },
    week: {
      x: p.margin,
      y: weekY,
      w: w,
      h: weekH,
      cellW: weekCellW,
      cellH: weekH,
      gap: weekGap
    },
    mileLabelY: mileLabelY + mileLabelH / 2,
    miles: {
      x: p.margin,
      y: mileY,
      w: w,
      h: mileH,
      itemW: mileW,
      itemH: mileH,
      gap: mileGap,
      // 里程碑总进度条贴在标题行右侧，不额外占纵向空间
      bar: {
        x: p.margin + 96 * s,
        y: mileLabelY + mileLabelH / 2 - 2.5 * s,
        w: w - 96 * s,
        h: 5 * s
      }
    },
    makeup: { x: p.margin, y: makeupY, w: w, h: makeupH },
    claim: { x: 24 * s, y: claimY, w: p.w - 48 * s, h: claimH }
  };
};

/* ---------------- 图鉴 ---------------- */

Layout.prototype.album = function () {
  var p = this.page();
  var s = p.s;
  var w = p.w - 2 * p.margin;

  var achW = 84 * s;
  var achH = 32 * s;

  var pillsY = p.contentY;
  var pillsH = 34 * s;
  var gridY = pillsY + pillsH + 14 * s;
  var gap = 8 * s;
  var cols = 4;
  var cellW = (w - gap * (cols - 1)) / cols;
  var cellH = Math.min(106 * s, Math.max(82 * s, (p.bottom - gridY - gap * 3) / 4));
  var gridH = cellH * 4 + gap * 3;
  var gridTop = gridY + Math.max(0, (p.bottom - gridY - gridH) / 2);

  var dCardX = 24 * s;
  var dCardW = p.w - 48 * s;
  var dCardY = this.topInset() + 56 * s;
  var dCardH = Math.min(520 * s, this.h - this.safeBottom - 20 * s - dCardY);

  return {
    s: s,
    w: p.w,
    h: p.h,
    margin: p.margin,
    topBar: p.topBar,
    back: p.back,
    ach: {
      x: p.topBar.x + p.topBar.w - achW,
      y: p.topBar.y + (p.topBar.h - achH) / 2,
      w: achW,
      h: achH
    },
    pills: { x: p.margin, y: pillsY, w: w, h: pillsH, half: (w - 8 * s) / 2 },
    grid: {
      x: p.margin,
      y: gridTop,
      w: w,
      h: gridH,
      cols: cols,
      cellW: cellW,
      cellH: cellH,
      gap: gap
    },
    detail: {
      x: dCardX,
      y: dCardY,
      w: dCardW,
      h: dCardH,
      close: { cx: dCardX + dCardW - 24 * s, cy: dCardY + 24 * s, r: 16 * s },
      cat: { cx: p.w / 2, cy: dCardY + 118 * s, size: 132 * s },
      nameY: dCardY + 202 * s,
      titleY: dCardY + 228 * s,
      rarityY: dCardY + 252 * s,
      quoteY: dCardY + 284 * s,
      condY: dCardY + dCardH - 152 * s,
      condBar: { x: dCardX + 24 * s, y: dCardY + dCardH - 128 * s, w: dCardW - 48 * s, h: 6 * s },
      fragY: dCardY + dCardH - 108 * s,
      action: { x: dCardX + 20 * s, y: dCardY + dCardH - 66 * s, w: dCardW - 40 * s, h: 46 * s }
    }
  };
};

/* ---------------- 成就 ---------------- */

Layout.prototype.achievements = function () {
  var p = this.page();
  var s = p.s;
  var w = p.w - 2 * p.margin;

  var summaryY = p.contentY + 8 * s;
  var listY = p.contentY + 30 * s;
  var gap = 6 * s;
  var avail = p.bottom - listY;
  var rowH = Math.min(58 * s, Math.max(44 * s, (avail - gap * 8) / 9));

  return {
    s: s,
    w: p.w,
    h: p.h,
    margin: p.margin,
    topBar: p.topBar,
    back: p.back,
    summaryY: summaryY,
    // 领取奖励后的飞行终点：顶栏右侧资源胶囊内的金币图标
    // 124s 宽，金币与券各留 40s 数字区，5 位数也不会压到右侧图标
    wallet: {
      x: p.topBar.x + p.topBar.w - 124 * s,
      y: p.topBar.y + (p.topBar.h - 32 * s) / 2,
      w: 124 * s,
      h: 32 * s,
      coin: { cx: p.topBar.x + p.topBar.w - 109 * s, cy: p.topBar.y + p.topBar.h / 2 },
      ticket: { cx: p.topBar.x + p.topBar.w - 43 * s, cy: p.topBar.y + p.topBar.h / 2 }
    },
    list: { x: p.margin, y: listY, w: w, rowH: rowH, gap: gap }
  };
};

/* ---------------- 商店 ---------------- */

Layout.prototype.shop = function () {
  var p = this.page();
  var s = p.s;
  var w = p.w - 2 * p.margin;

  var walletH = 66 * s;
  var listY = p.contentY + walletH + 14 * s;
  var gap = 8 * s;
  var avail = p.bottom - listY;
  var rowH = Math.min(72 * s, Math.max(58 * s, (avail - gap * 4) / 5));

  return {
    s: s,
    w: p.w,
    h: p.h,
    margin: p.margin,
    topBar: p.topBar,
    back: p.back,
    wallet: {
      x: p.margin, y: p.contentY, w: w, h: walletH,
      // 购买成功后的金币飞行终点（第一格金币图标）
      coin: { cx: p.margin + 14 * s, cy: p.contentY + 27 * s }
    },
    list: { x: p.margin, y: listY, w: w, rowH: rowH, gap: gap }
  };
};

module.exports = Layout;
