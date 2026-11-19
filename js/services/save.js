/**
 * 存档。
 * - 单一根对象，所有业务数据挂在下面，便于迁移
 * - 写入防抖：touch() 只标脏，由主循环 tick() 到点落盘（不依赖定时器，便于测试）
 * - 双槽：主槽 + 备份槽，主槽不可用时回退
 */
var config = require('../data/config');
var storage = require('../platform/storage');
var clock = require('../core/clock');
var logger = require('../core/logger');

function emptyResume() {
  return { index: 0, n: 0, cells: [], timeMs: 0, moves: 0, mistakes: 0, hintsUsed: 0 };
}

function defaults() {
  return {
    schema: config.SAVE_SCHEMA,
    coins: config.INITIAL_COINS,
    tickets: config.INITIAL_TICKETS,
    unlocked: 1,
    lastLevel: 1,
    completed: {},
    resume: emptyResume(),
    stats: { catsPlaced: 0, playedMs: 0, hintsUsed: 0, erases: 0, undos: 0 },
    cats: {},
    daily: { date: '', streak: 0, claimed: false, lastIndex: 0 },
    settings: { haptic: true, debug: false }
  };
}

function int(v, fallback, min, max) {
  if (typeof v !== 'number' || !isFinite(v)) return fallback;
  v = Math.floor(v);
  if (v < min) v = min;
  if (typeof max === 'number' && v > max) v = max;
  return v;
}

function obj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

function pad3(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return s;
}

/**
 * schema 1（S3 200 关）→ schema 2（S4 300 关）。
 * 旧档的 completed 下标指向 S3 的播放顺序；关卡已重排为 15 章，
 * 但每关 ID 不变，因此按 L001…L200 找回新序号，保留玩家真实进度。
 */
function migrateV1(d, raw) {
  var levels = require('../../levels/index');
  var total = levels.total();
  var completed = {};
  var maxNew = 0;
  var key;
  var i;

  for (key in d.completed) {
    if (!d.completed.hasOwnProperty(key)) continue;
    var oldIndex = parseInt(key, 10);
    var newIndex = levels.indexOfId('L' + pad3(oldIndex));
    if (!newIndex) newIndex = oldIndex >= 1 && oldIndex <= total ? oldIndex : 0;
    if (!newIndex) continue;
    completed[newIndex] = d.completed[key];
    if (newIndex > maxNew) maxNew = newIndex;
  }

  // 旧 unlocked 表示"1…unlocked-1 均可进入"，迁移成新序号前缀，
  // 保证玩家已能玩的关卡和插入其间的关卡都不被锁回去。
  var oldUnlocked = int(raw.unlocked, 1, 1, 10000);
  for (i = 1; i < oldUnlocked; i++) {
    var frontier = levels.indexOfId('L' + pad3(i));
    if (frontier > maxNew) maxNew = frontier;
  }

  d.completed = completed;
  d.unlocked = Math.min(total + 1, maxNew ? maxNew + 1 : 1);
  var last = levels.indexOfId('L' + pad3(int(raw.lastLevel, 1, 1, 10000)));
  d.lastLevel = last || 1;
}

function normalizeResume(raw, total) {
  var out = emptyResume();
  raw = obj(raw);
  if (!raw) return out;

  var index = int(raw.index, 0, 0, total);
  var n = int(raw.n, 0, 0, 9);
  if (!index || n < 4) return out;

  var levels = require('../../levels/index');
  var level = levels.get(index);
  if (!level || level.n !== n) return out;
  if (!Array.isArray(raw.cells) || raw.cells.length !== n * n) return out;

  var cells = [];
  for (var i = 0; i < raw.cells.length; i++) {
    var v = raw.cells[i];
    if (v !== 0 && v !== 1 && v !== 2) return out;
    cells.push(v);
  }

  out.index = index;
  out.n = n;
  out.cells = cells;
  out.timeMs = int(raw.timeMs, 0, 0, 24 * 3600 * 1000);
  out.moves = int(raw.moves, 0, 0);
  out.mistakes = int(raw.mistakes, 0, 0);
  out.hintsUsed = int(raw.hintsUsed, 0, 0);
  return out;
}

/** 只接受已知字段，未知/缺失字段一律回落到默认值 */
function normalize(raw) {
  var d = defaults();
  raw = obj(raw);
  if (!raw) return d;
  var from = raw.schema;
  if (from !== 1 && from !== config.SAVE_SCHEMA) {
    logger.warn('存档版本不符: ' + from + '，按默认值合并');
  }

  d.coins = int(raw.coins, d.coins, 0);
  d.tickets = int(raw.tickets, d.tickets, 0);
  d.unlocked = int(raw.unlocked, d.unlocked, 1);
  d.lastLevel = int(raw.lastLevel, d.lastLevel, 1);

  var c = obj(raw.completed);
  if (c) {
    for (var k in c) {
      if (!c.hasOwnProperty(k)) continue;
      var e = obj(c[k]);
      if (!e) continue;
      d.completed[k] = {
        at: int(e.at, 0, 0),
        tries: int(e.tries, 1, 1),
        paws: int(e.paws, 1, 1, 3),
        bestTimeMs: int(e.bestTimeMs, 0, 0)
      };
    }
  }

  var s = obj(raw.stats);
  if (s) {
    for (var key in d.stats) {
      if (d.stats.hasOwnProperty(key)) d.stats[key] = int(s[key], d.stats[key], 0);
    }
  }

  var cats = obj(raw.cats);
  if (cats) {
    for (var id in cats) {
      if (!cats.hasOwnProperty(id)) continue;
      var ce = obj(cats[id]);
      if (!ce) continue;
      d.cats[id] = { count: int(ce.count, 0, 0) };
    }
  }

  var day = obj(raw.daily);
  if (day) {
    d.daily.date = typeof day.date === 'string' ? day.date : '';
    d.daily.streak = int(day.streak, 0, 0);
    d.daily.claimed = bool(day.claimed, false);
    d.daily.lastIndex = int(day.lastIndex, 0, 0);
  }

  var st = obj(raw.settings);
  if (st) {
    d.settings.haptic = bool(st.haptic, true);
    d.settings.debug = bool(st.debug, false);
  }

  var levels = require('../../levels/index');
  var total = levels.total();
  if (from === 1) migrateV1(d, raw);

  d.unlocked = Math.min(total + 1, Math.max(1, d.unlocked));
  d.lastLevel = Math.min(total, Math.max(1, d.lastLevel));

  var cleanCompleted = {};
  for (var ck in d.completed) {
    if (!d.completed.hasOwnProperty(ck)) continue;
    var ci = parseInt(ck, 10);
    if (ci >= 1 && ci <= total) cleanCompleted[ci] = d.completed[ck];
  }
  d.completed = cleanCompleted;
  d.resume = normalizeResume(raw.resume, total);
  d.schema = config.SAVE_SCHEMA;
  return d;
}

function usable(raw) {
  return obj(raw) && (raw.schema === 1 || raw.schema === config.SAVE_SCHEMA);
}

function readKey(key) {
  var v = storage.get(key, null);
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch (e) { return null; }
  }
  return v;
}

function Save() {
  this.data = null;
  this.dirty = false;
  this.dueAt = 0;
  this.writes = 0;
}

Save.prototype.load = function () {
  var raw = readKey(config.SAVE_KEY);
  if (!usable(raw)) {
    var bak = readKey(config.SAVE_BAK_KEY);
    if (usable(bak)) {
      logger.warn('主存档不可用，已回退备份');
      raw = bak;
    }
  }
  this.data = normalize(raw);
  this.dirty = false;
  return this.data;
};

/** 标脏并延后落盘，默认 800ms 内多次改动只写一次 */
Save.prototype.touch = function () {
  this.dirty = true;
  this.dueAt = clock.now() + config.SAVE_DEBOUNCE_MS;
};

/** 由主循环驱动；到点才真正写入 */
Save.prototype.tick = function (now) {
  if (this.dirty && now >= this.dueAt) this.flush();
};

Save.prototype.flush = function () {
  if (!this.data || !this.dirty) return;
  if (storage.set(config.SAVE_KEY, this.data)) {
    this.writes++;
    this.dirty = false;
    // 每 5 次成功写入刷新一次备份，避免存档键层面损坏后无路可退
    if (this.writes % 5 === 0) storage.set(config.SAVE_BAK_KEY, this.data);
  }
};

/** 切后台/退出前调用：无视防抖立即双写 */
Save.prototype.flushHard = function () {
  if (!this.data) return;
  storage.set(config.SAVE_KEY, this.data);
  storage.set(config.SAVE_BAK_KEY, this.data);
  this.dirty = false;
  this.writes++;
};

Save.prototype.reset = function () {
  this.data = defaults();
  this.flushHard();
};

Save.normalize = normalize;
Save.defaults = defaults;

module.exports = Save;
