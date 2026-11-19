/**
 * 区域配色分配。
 *
 * 关卡里的区域编号只是 0..n-1。直接按编号取色时，相邻区域可能撞进同一
 * 色系，棋盘就会糊成一片。这里根据区域相邻关系为每个区域挑颜色：
 * - 相邻区域优先拉开 CIELAB 色差（ΔE）
 * - 同时避免整盘出现过于接近的两个颜色
 * - 计算固定、无随机，同一关每次进入的配色一致
 *
 * 配色只在进入对局时算一次，不影响每帧绘制。
 */
var CLOSE_THRESHOLD = 28;

var LAB_CACHE = {};

function hexToRgb(hex) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function pivot(t) {
  return t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t + 16 / 116);
}

function labOf(hex) {
  if (LAB_CACHE[hex]) return LAB_CACHE[hex];
  var rgb = hexToRgb(hex);
  function channel(v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  var r = channel(rgb.r);
  var g = channel(rgb.g);
  var b = channel(rgb.b);
  var x = pivot((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  var y = pivot(r * 0.2126 + g * 0.7152 + b * 0.0722);
  var z = pivot((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  var lab = [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  LAB_CACHE[hex] = lab;
  return lab;
}

function deltaE(a, b) {
  var A = labOf(a);
  var B = labOf(b);
  var dl = A[0] - B[0];
  var da = A[1] - B[1];
  var db = A[2] - B[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/** 区域相邻关系：右、下、右下、左下；上下左右与斜角都算相邻 */
function buildAdjacency(regionGrid, n) {
  var adj = {};
  var i;
  for (i = 0; i < n; i++) adj[i] = {};

  function link(a, b) {
    if (a === b || a === undefined || b === undefined) return;
    adj[a][b] = true;
    adj[b][a] = true;
  }

  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      i = r * n + c;
      var a = regionGrid[i];
      if (c + 1 < n) link(a, regionGrid[i + 1]);
      if (r + 1 < n) link(a, regionGrid[i + n]);
      if (r + 1 < n && c + 1 < n) link(a, regionGrid[i + n + 1]);
      if (r + 1 < n && c - 1 >= 0) link(a, regionGrid[i + n - 1]);
    }
  }
  return adj;
}

function degreeOf(adj, id) {
  var n = 0;
  for (var k in adj[id]) if (adj[id].hasOwnProperty(k)) n++;
  return n;
}

function orderRegions(adj, n, mode) {
  var ids = [];
  for (var i = 0; i < n; i++) ids.push(i);
  ids.sort(function (a, b) {
    var da = degreeOf(adj, a);
    var db = degreeOf(adj, b);
    if (mode === 0) return db - da || a - b;
    if (mode === 1) return da - db || a - b;
    if (mode === 2) return a - b;
    return b - a;
  });
  return ids;
}

function greedy(adj, n, colors, order, anchor) {
  var ids = order.slice();
  var pos = ids.indexOf(anchor);
  if (pos > 0) {
    ids.splice(pos, 1);
    ids.unshift(anchor);
  }

  var assigned = {};
  var used = {};

  for (var oi = 0; oi < ids.length; oi++) {
    var id = ids[oi];
    var best = -1;
    var bestScore = -Infinity;

    for (var k = 0; k < colors.length; k++) {
      if (used[k]) continue;
      var adjMin = Infinity;
      var allMin = Infinity;
      var jid, g;

      for (jid in adj[id]) {
        if (!adj[id].hasOwnProperty(jid)) continue;
        g = assigned[jid];
        if (g === undefined) continue;
        var d = deltaE(colors[k], colors[g]);
        if (d < adjMin) adjMin = d;
      }

      for (g in assigned) {
        if (!assigned.hasOwnProperty(g)) continue;
        var da = deltaE(colors[k], colors[assigned[g]]);
        if (da < allMin) allMin = da;
      }

      // 相邻色差是主目标；整盘色差用来排除“隔着别的区域但看起来一样”的颜色。
      var score = 0;
      if (adjMin < Infinity) score = adjMin;
      if (allMin < Infinity) {
        if (allMin < CLOSE_THRESHOLD) score -= (CLOSE_THRESHOLD - allMin) * 6;
        if (adjMin === Infinity) score += allMin * 0.01;
      }
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }

    assigned[id] = best;
    used[best] = true;
  }
  return assigned;
}

function scoreMapping(adj, assigned, colors) {
  var adjMin = Infinity;
  var allMin = Infinity;
  var a, b;

  for (a in adj) {
    if (!adj.hasOwnProperty(a)) continue;
    for (b in adj[a]) {
      if (!adj[a].hasOwnProperty(b)) continue;
      if (+a > +b) continue;
      var d = deltaE(colors[assigned[a]], colors[assigned[b]]);
      if (d < adjMin) adjMin = d;
    }
  }

  for (a in assigned) {
    if (!assigned.hasOwnProperty(a)) continue;
    for (b in assigned) {
      if (!assigned.hasOwnProperty(b) || +a >= +b) continue;
      var da = deltaE(colors[assigned[a]], colors[assigned[b]]);
      if (da < allMin) allMin = da;
    }
  }

  if (adjMin === Infinity) adjMin = 0;
  if (allMin === Infinity) allMin = 0;
  return adjMin * 10000 + allMin;
}

/**
 * 返回长度为 n 的颜色数组：第 g 个元素是区域 g 的颜色。
 * 同一区域网格与配色每次返回完全相同的结果。
 */
function assign(regionGrid, n, colors) {
  if (!regionGrid || !n || !colors || !colors.length) return [];

  if (colors.length < n) {
    var fallback = [];
    for (var f = 0; f < n; f++) fallback.push(colors[f % colors.length]);
    return fallback;
  }

  var adj = buildAdjacency(regionGrid, n);
  var best = null;
  var bestScore = -Infinity;

  // 多起点贪心：不同区域排序 + 不同锚点，取整盘相邻色差最大的方案。
  for (var mode = 0; mode < 4; mode++) {
    var order = orderRegions(adj, n, mode);
    for (var anchor = 0; anchor < n; anchor++) {
      var assigned = greedy(adj, n, colors, order, anchor);
      var score = scoreMapping(adj, assigned, colors);
      if (score > bestScore) {
        bestScore = score;
        best = assigned;
      }
    }
  }

  var out = [];
  for (var g = 0; g < n; g++) out.push(colors[best[g]]);
  return out;
}

module.exports = {
  assign: assign,
  deltaE: deltaE
};
