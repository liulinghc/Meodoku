#!/usr/bin/env node
/**
 * 浏览器预览构建（开发用，不参与小游戏打包）。
 *
 * 把 js/**  与 levels/** 按 CommonJS 包成单文件，配一个最小 wx 桩，
 * 输出 preview/bundle.js + preview/index.html，用浏览器打开即可看到真实 Canvas 效果。
 *
 * 用法：
 *   node tools/build-preview.js
 *   open preview/index.html
 *   # 也可直接指定场景：preview/index.html?scene=map | ?scene=game&level=12
 *   # 大棋盘/后期关卡：?scene=game&level=300&unlock=1（仅预览放开解锁）
 *   # 对局演示：&demo=marks | conflict | solve | win
 *   # 玩法说明：?scene=guide；S5 页面：?scene=daily | checkin | album | achievements | shop
 *
 * 注意：这是近似环境（尺寸固定 375×812、DPR=2），
 * 最终效果以微信开发者工具/真机为准。
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var OUT_DIR = path.join(ROOT, 'preview');

function walk(dir, out) {
  var list = fs.readdirSync(path.join(ROOT, dir));
  for (var i = 0; i < list.length; i++) {
    var name = list[i];
    var rel = dir + '/' + name;
    var stat = fs.statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) walk(rel, out);
    else if (/\.js$/.test(name)) out.push(rel);
  }
  return out;
}

function collect() {
  var files = [];
  walk('js', files);
  files.push('levels/index.js');
  files.push('levels/pack-001.js');
  files.push('levels/daily-365.js');
  return files;
}

function escapeForWrapper(src) {
  // 源码里若出现 </script> 也不影响外部 .js 文件，无需转义
  return src;
}

function buildBundle(files) {
  var parts = [];
  parts.push('/* 自动生成：node tools/build-preview.js —— 勿手改 */');
  parts.push('(function () {');
  parts.push('var DEFS = {};');
  parts.push('var CACHE = {};');

  for (var i = 0; i < files.length; i++) {
    var rel = files[i];
    var src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    parts.push('DEFS[' + JSON.stringify(rel) + '] = function (require, module, exports) {\n' +
      escapeForWrapper(src) + '\n};');
  }

  parts.push([
    'function normalizePath(p) {',
    '  var parts = p.split("/");',
    '  var out = [];',
    '  for (var i = 0; i < parts.length; i++) {',
    '    var seg = parts[i];',
    '    if (seg === "" || seg === ".") continue;',
    '    if (seg === "..") { out.pop(); continue; }',
    '    out.push(seg);',
    '  }',
    '  return out.join("/");',
    '}',
    'function resolve(from, req) {',
    '  if (req.charAt(0) !== ".") {',
    '    var abs = normalizePath(req);',
    '    return /\\.js$/.test(abs) ? abs : abs + ".js";',
    '  }',
    '  var dir = from.split("/").slice(0, -1).join("/");',
    '  var p = normalizePath(dir + "/" + req);',
    '  return /\\.js$/.test(p) ? p : p + ".js";',
    '}',
    'function load(id) {',
    '  if (CACHE[id]) return CACHE[id].exports;',
    '  var def = DEFS[id];',
    '  if (!def) throw new Error("模块不存在: " + id);',
    '  var m = { exports: {} };',
    '  CACHE[id] = m;',
    '  def(function (req) { return load(resolve(id, req)); }, m, m.exports);',
    '  return m.exports;',
    '}'
  ].join('\n'));

  parts.push(RUNTIME);
  parts.push('})();');
  return parts.join('\n\n');
}

var RUNTIME = String.raw`
/* ---------------- wx 桩 ---------------- */

(function () {
  var W = 375;
  var H = 812;
  var DPR = 2;
  var SAFE_TOP = 44;
  var SAFE_BOTTOM = 34;

  var canvasEl = document.getElementById('game');
  var handlers = {};
  var storage = {};
  var dbKey = 'mdpreview:db';

  try {
    var raw = window.localStorage.getItem(dbKey);
    if (raw) storage = JSON.parse(raw) || {};
  } catch (e) { storage = {}; }

  var q = new URLSearchParams(window.location.search);
  if (q.get('reset') === '1') {
    storage = {};
    try { window.localStorage.removeItem(dbKey); } catch (e) {}
  }

  function persist() {
    try { window.localStorage.setItem(dbKey, JSON.stringify(storage)); } catch (e) {}
  }

  window.wx = {
    createCanvas: function () { return canvasEl; },
    createOffscreenCanvas: function (o) {
      var c = document.createElement('canvas');
      c.width = o && o.width ? o.width : 1;
      c.height = o && o.height ? o.height : 1;
      return c;
    },
    getWindowInfo: function () {
      return {
        windowWidth: W,
        windowHeight: H,
        pixelRatio: DPR,
        statusBarHeight: SAFE_TOP,
        safeArea: { top: SAFE_TOP, bottom: H - SAFE_BOTTOM, left: 0, right: W, width: W, height: H - SAFE_TOP - SAFE_BOTTOM },
        platform: 'devtools'
      };
    },
    getSystemInfoSync: function () { return window.wx.getWindowInfo(); },
    // 与 375×812 真机胶囊同尺寸，预览也必须验证“顶栏让开胶囊”
    getMenuButtonBoundingClientRect: function () {
      return { width: 87, height: 32, top: 48, right: 365, bottom: 80, left: 278 };
    },
    getStorageSync: function (k) {
      return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : '';
    },
    setStorageSync: function (k, v) { storage[k] = v; persist(); },
    removeStorageSync: function (k) { delete storage[k]; persist(); },
    onTouchStart: function (fn) { handlers.start = fn; },
    onTouchMove: function (fn) { handlers.move = fn; },
    onTouchEnd: function (fn) { handlers.end = fn; },
    onTouchCancel: function (fn) { handlers.cancel = fn; },
    onHide: function (fn) { handlers.hide = fn; },
    onShow: function (fn) { handlers.show = fn; },
    onError: function (fn) { handlers.error = fn; },
    onUnhandledRejection: function (fn) { handlers.rejection = fn; },
    onMemoryWarning: function (fn) { handlers.memory = fn; },
    vibrateShort: function () {}
  };

  function point(clientX, clientY) {
    var r = canvasEl.getBoundingClientRect();
    return {
      identifier: 1,
      clientX: (clientX - r.left) * W / r.width,
      clientY: (clientY - r.top) * H / r.height
    };
  }

  var down = false;

  canvasEl.addEventListener('mousedown', function (e) {
    if (!handlers.start) return;
    down = true;
    handlers.start({ touches: [point(e.clientX, e.clientY)] });
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!down || !handlers.move) return;
    var t = point(e.clientX, e.clientY);
    handlers.move({ touches: [t], changedTouches: [t] });
  });

  window.addEventListener('mouseup', function (e) {
    if (!down) return;
    down = false;
    var t = point(e.clientX, e.clientY);
    if (handlers.end) handlers.end({ changedTouches: [t], touches: [] });
  });

  function touchPoint(t) { return point(t.clientX, t.clientY); }

  canvasEl.addEventListener('touchstart', function (e) {
    if (!handlers.start || !e.touches.length) return;
    handlers.start({ touches: [touchPoint(e.touches[0])] });
    e.preventDefault();
  }, { passive: false });

  canvasEl.addEventListener('touchmove', function (e) {
    if (!handlers.move || !e.touches.length) return;
    var t = touchPoint(e.touches[0]);
    handlers.move({ touches: [t], changedTouches: [t] });
    e.preventDefault();
  }, { passive: false });

  canvasEl.addEventListener('touchend', function (e) {
    if (!handlers.end || !e.changedTouches.length) return;
    handlers.end({ changedTouches: [touchPoint(e.changedTouches[0])], touches: [] });
    e.preventDefault();
  }, { passive: false });

  /* ---------------- 启动 ---------------- */

  var app = load('js/main.js').start();
  window.__app = app;

  var scene = q.get('scene');
  // 直接打开某个演示场景时，先收起首次启动的玩法说明，避免返回键回到说明页
  if (scene && scene !== 'guide' && app.sm.top() && app.sm.top().sceneName === 'guide') {
    app.sm.top()._close();
  }

  if (app && scene === 'map') {
    app.sm.push('levelmap');
    if (q.get('demo') === 'progress') {
      for (var pi = 1; pi <= 5; pi++) app.progress.completeLevel(pi);
      app.progress.setLastLevel(6);
      app.sm.replace('levelmap');
    }
  } else if (app && scene === 'guide') {
    if (!app.sm.top() || app.sm.top().sceneName !== 'guide') app.sm.push('guide');
  } else if (app && /^(daily|checkin|album|achievements|shop)$/.test(scene || '')) {
    // 图鉴预览：?scene=album&demo=all 解锁全部 16 只猫，方便检查猫头差异
    if (scene === 'album' && q.get('demo') === 'all') {
      var catList = load('js/data/cats.js').all;
      for (var ci = 0; ci < catList.length; ci++) {
        app.save.data.collection.unlocked[catList[ci].id] = 1;
      }
      app.save.data.collection.equipped = catList[0].id;
    }
    app.sm.push(scene);
  } else if (app && scene === 'game') {
    var level = parseInt(q.get('level') || '1', 10);
    // ?unlock=1 仅供预览直接检查大棋盘/后期关卡，不改变游戏内解锁逻辑
    if (q.get('unlock') === '1') app.save.data.unlocked = 9999;
    app.sm.push('levelmap');
    app.sm.push('game', { levelIndex: level });

    // 开发态演示：
    //   solve 摆出答案 / marks 打两个 X 再摆答案 / hint 用一次提示再摆完
    //   mistake 先放错再撤销、最后摆完 / conflict 造一行两猫冲突
    //   win 摆出答案并停在庆祝画面，便于检查金圈与棋盘扫光
    var demo = q.get('demo');
    if (demo) {
      var g = app.sm.top();
      var sol = (g.level && g.level.solution) || [];
      if (demo === 'conflict') {
        g._cycle(0); g._cycle(0);
        g._cycle(1); g._cycle(1);
      } else {
        if (demo === 'marks') { g._cycle(0); g._cycle(5); }
        if (demo === 'hint') { g._hint(); }
        if (demo === 'mistake') {
          g._cycle(0); g._cycle(0);      // 合法放猫
          g._cycle(1); g._cycle(1);      // 同行第二只 → 冲突/失误
          g._undo(); g._undo();          // 撤销冲突操作
          g._undo(); g._undo();          // 撤销第一只猫，盘面归空
        }
        if (demo === 'solve' || demo === 'marks' || demo === 'hint' ||
            demo === 'mistake' || demo === 'win') {
          g.elapsed = 47; // 预览专用：让截图里的用时不是 00:00
          for (var r = 0; r < g.n; r++) {
            var idx = r * g.n + sol[r];
            if (g.cells[idx] === 2) continue;
            g._cycle(idx);
            g._cycle(idx);
          }
          if (demo === 'win') {
            // 预览专用：清掉落子波纹并冻结 update，停在庆祝画面检查金圈与扫光
            g.fx = [];
            g.settleDelay = 999;
            g.celebrateT = 0.18;
            g.update = function () {};
            app.frame(0.05);
          } else {
            // 预览专用：手动推进 1.6s，跨过结算延时，让结算页动画展开到可读状态
            for (var f = 0; f < 16; f++) app.frame(0.1);
          }
        }
      }
    }
  }
})();
`;

var HTML = [
  '<!DOCTYPE html>',
  '<html lang="zh-CN">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">',
  '<title>喵喵迷阵 · 浏览器预览</title>',
  '<style>',
  '  html, body { margin: 0; padding: 0; height: 100%; background: #241f1b; }',
  '  body { display: flex; align-items: center; justify-content: center; }',
  '  #stage { position: relative; width: 375px; height: 812px;',
  '           box-shadow: 0 0 48px rgba(0,0,0,0.55); }',
  '  #game { display: block; width: 375px; height: 812px; background: #F7F1E9; }',
  '  /* 预览专用：模拟微信右上角胶囊，验证游戏 UI 不与其重叠 */',
  '  #capsule { position: absolute; top: 48px; right: 10px; width: 87px; height: 32px;',
  '             box-sizing: border-box; border-radius: 16px;',
  '             background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.16);',
  '             display: flex; align-items: center; justify-content: center; gap: 8px;',
  '             pointer-events: none; }',
  '  #capsule .dots { display: flex; gap: 4px; }',
  '  #capsule i { display: block; width: 5px; height: 5px; border-radius: 50%; background: #fff; }',
  '  #capsule .sep { width: 1px; height: 18px; background: rgba(255,255,255,0.28); }',
  '  #capsule .ring { width: 15px; height: 15px; border: 2px solid #fff; border-radius: 50%; }',
  '</style>',
  '</head>',
  '<body>',
  '<div id="stage">',
  '  <canvas id="game" width="375" height="812"></canvas>',
  '  <div id="capsule">',
  '    <span class="dots"><i></i><i></i><i></i></span>',
  '    <span class="sep"></span>',
  '    <span class="ring"></span>',
  '  </div>',
  '</div>',
  '<script src="./bundle.js"></script>',
  '</body>',
  '</html>'
].join('\n');

function main() {
  var files = collect();
  var bundle = buildBundle(files);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'bundle.js'), bundle, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), HTML, 'utf8');
  console.log('已生成 preview/index.html 与 preview/bundle.js（' +
    Math.round(bundle.length / 1024) + 'KB，' + files.length + ' 个模块）');
}

main();
