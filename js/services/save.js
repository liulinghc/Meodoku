/**
 * 存档。
 * - 单一根对象，所有业务数据挂在下面，便于迁移
 * - 写入防抖：touch() 只标脏，由主循环 tick() 到点落盘（不依赖定时器，便于测试）
 * - 双槽：主槽 + 备份槽，主槽不可用时回退
 *
 * schema 4（S5.1）：新增 coachSeen（首次规则卡已读标记）。
 * 关卡重排迁移：schema 1 按稳定 ID 映射；schema 2/3 先按旧播放顺序快照
 * （levels/legacy-order.js）找回旧 ID，再按稳定 ID 映射到新序号。
 * 被教学曲线替换的旧第 1–30 关不挂接到新题面，只保证新关卡可进入。
 */
var config = require('../data/config');
var storage = require('../platform/storage');
var clock = require('../core/clock');
var logger = require('../core/logger');
var date = require('../core/date');
var catData = require('../data/cats');
var theme = require('../data/theme');
var tutorial = require('./tutorial');

function emptyResume() {
  return { index: 0, n: 0, cells: [], timeMs: 0, moves: 0, mistakes: 0, hintsUsed: 0 };
}

function defaults() {
  return {
    schema: config.SAVE_SCHEMA,
    coins: config.INITIAL_COINS,
    tickets: config.INITIAL_TICKETS,
    makeupCards: config.INITIAL_MAKEUP_CARDS,
    unlocked: 1,
    lastLevel: 1,
    completed: {},
    resume: emptyResume(),
    stats: { catsPlaced: 0, playedMs: 0, hintsUsed: 0, erases: 0, undos: 0 },
    cats: {},
    fragments: 0,
    daily: {
      date: '',
      streak: 0,
      bestStreak: 0,
      claimed: false,
      lastIndex: 0,
      total: 0,
      history: {},
      lastClaimTs: 0,
      lastSeenTs: 0,
      timeGuardDate: ''
    },
    signin: {
      lastDate: '',
      streak: 0,
      cycleDay: 0,
      totalDays: 0,
      makeupWeek: '',
      makeupUsed: 0,
      claimedMilestones: {},
      history: {}
    },
    collection: { unlocked: {}, equipped: '' },
    achievements: {},
    cosmetics: { skins: { cream: true }, current: 'cream' },
    guideSeen: false,
    coachSeen: {},
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
 * 旧前 30 关已被教学曲线替换：不把旧通关记录挂到新题面上，
 * 但至少保证新前 30 关可以进入，避免老玩家被旧进度锁住。
 */
var TUTORIAL_COUNT = 30;

function unlockedFrom(maxMapped, legacyFrontier) {
  var total = require('../../levels/index').total();
  var unlocked = Math.min(total + 1, maxMapped ? maxMapped + 1 : 1);
  if (legacyFrontier) {
    unlocked = Math.max(unlocked, Math.min(total + 1, TUTORIAL_COUNT + 1));
  }
  return unlocked;
}

/**
 * schema 1（S3 200 关）→ 当前 schema。
 * 旧档的 completed 下标指向 S3 的播放顺序；每关 ID 稳定，
 * 按 L001…L200 找回新序号。找不到的旧 ID（前 30 关）已被替换，
 * 不再按数字序号硬套到新题面——那会把进度记到不同的关卡上。
 */
function migrateV1(d, raw) {
  var levels = require('../../levels/index');
  var completed = {};
  var maxNew = 0;
  var droppedTutorial = false;
  var key;

  for (key in d.completed) {
    if (!d.completed.hasOwnProperty(key)) continue;
    var oldIndex = parseInt(key, 10);
    var newIndex = levels.indexOfId('L' + pad3(oldIndex));
    if (!newIndex) {
      if (oldIndex >= 1 && oldIndex <= TUTORIAL_COUNT) droppedTutorial = true;
      continue;
    }
    completed[newIndex] = d.completed[key];
    if (newIndex > maxNew) maxNew = newIndex;
  }

  // 旧 unlocked 表示“1…unlocked-1 均可进入”，迁移成新序号前缀。
  var oldUnlocked = int(raw.unlocked, 1, 1, 10000);
  var frontierOld = oldUnlocked - 1;
  if (frontierOld >= 1 && frontierOld <= TUTORIAL_COUNT) droppedTutorial = true;
  if (frontierOld > TUTORIAL_COUNT) {
    var frontier = levels.indexOfId('L' + pad3(frontierOld));
    if (frontier > maxNew) maxNew = frontier;
  }

  d.completed = completed;
  d.unlocked = unlockedFrom(maxNew, droppedTutorial);
  var oldLast = int(raw.lastLevel, 1, 1, 10000);
  var last = oldLast > TUTORIAL_COUNT ?
    levels.indexOfId('L' + pad3(oldLast)) : 0;
  d.lastLevel = last || 1;
}

/**
 * schema 2/3（旧 300 关播放顺序）→ 当前 schema。
 * completed / lastLevel / resume 的下标都是旧播放序号，
 * 先经 legacy-order 找回旧稳定 ID，再按 ID 找新序号。
 */
function migrateOldOrder(d, raw) {
  var levels = require('../../levels/index');
  var legacy = require('../../levels/legacy-order');
  var completed = {};
  var maxNew = 0;
  var droppedTutorial = false;
  var key;

  function newIndexOf(oldIndex) {
    if (!(oldIndex >= 1 && oldIndex <= legacy.length)) return 0;
    return levels.indexOfId(legacy[oldIndex - 1]);
  }

  for (key in d.completed) {
    if (!d.completed.hasOwnProperty(key)) continue;
    var oldIndex = parseInt(key, 10);
    var newIndex = newIndexOf(oldIndex);
    if (!newIndex) {
      if (oldIndex >= 1 && oldIndex <= TUTORIAL_COUNT) droppedTutorial = true;
      continue;
    }
    completed[newIndex] = d.completed[key];
    if (newIndex > maxNew) maxNew = newIndex;
  }

  var oldUnlocked = int(raw.unlocked, 1, 1, legacy.length + 1);
  var frontierOld = oldUnlocked - 1;
  if (frontierOld >= 1 && frontierOld <= TUTORIAL_COUNT) droppedTutorial = true;
  if (frontierOld > TUTORIAL_COUNT) {
    var frontier = newIndexOf(frontierOld);
    if (frontier > maxNew) maxNew = frontier;
  }

  d.completed = completed;
  d.unlocked = unlockedFrom(maxNew, droppedTutorial);
  var oldLast = int(raw.lastLevel, 1, 1, legacy.length);
  d.lastLevel = oldLast > TUTORIAL_COUNT ? (newIndexOf(oldLast) || 1) : 1;
}

/** 旧存档的续玩下标同样按旧顺序迁移；落点不存在则放弃续玩 */
function migrateResumeRaw(raw, from) {
  var r = obj(raw);
  if (!r) return null;
  if (from === config.SAVE_SCHEMA) return r;

  var oldIndex = int(r.index, 0, 0, 10000);
  if (!oldIndex) return null;
  var newIndex = 0;
  if (from === 1) {
    newIndex = require('../../levels/index').indexOfId('L' + pad3(oldIndex));
  } else {
    var legacy = require('../../levels/legacy-order');
    var id = oldIndex >= 1 && oldIndex <= legacy.length ? legacy[oldIndex - 1] : '';
    if (id) newIndex = require('../../levels/index').indexOfId(id);
  }
  if (!newIndex) return null;

  var out = {};
  for (var k in r) {
    if (r.hasOwnProperty(k)) out[k] = r[k];
  }
  out.index = newIndex;
  return out;
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

function normalizeHistory(raw, limit, fields) {
  var out = {};
  raw = obj(raw);
  if (!raw) return out;
  var keys = [];
  for (var k in raw) {
    if (!raw.hasOwnProperty(k) || !date.isKey(k)) continue;
    var e = obj(raw[k]);
    if (!e) continue;
    var item = {};
    for (var i = 0; i < fields.length; i++) {
      item[fields[i]] = int(e[fields[i]], 0, 0);
    }
    out[k] = item;
    keys.push(k);
  }
  keys.sort();
  while (keys.length > limit) delete out[keys.shift()];
  return out;
}

function normalizeDaily(raw) {
  var out = defaults().daily;
  raw = obj(raw);
  if (!raw) return out;

  out.date = date.isKey(raw.date) ? raw.date : '';
  out.streak = int(raw.streak, 0, 0);
  out.bestStreak = Math.max(out.streak, int(raw.bestStreak, 0, 0));
  out.claimed = bool(raw.claimed, false);
  out.lastIndex = int(raw.lastIndex, 0, 0);
  out.total = int(raw.total, 0, 0);
  out.history = normalizeHistory(raw.history, config.DAILY_HISTORY_DAYS, ['coins', 'fragments', 'timeMs', 'paws', 'streak']);
  out.lastClaimTs = int(raw.lastClaimTs, 0, 0);
  out.lastSeenTs = int(raw.lastSeenTs, 0, 0);
  out.timeGuardDate = date.isKey(raw.timeGuardDate) ? raw.timeGuardDate : '';
  return out;
}

function normalizeSignin(raw) {
  var out = defaults().signin;
  raw = obj(raw);
  if (!raw) return out;

  out.lastDate = date.isKey(raw.lastDate) ? raw.lastDate : '';
  out.streak = int(raw.streak, 0, 0);
  out.cycleDay = int(raw.cycleDay, 0, 0, 7);
  out.totalDays = int(raw.totalDays, 0, 0);
  out.makeupWeek = date.isKey(raw.makeupWeek) ? raw.makeupWeek : '';
  out.makeupUsed = int(raw.makeupUsed, 0, 0);
  out.history = normalizeHistory(raw.history, 100, ['coins', 'tickets', 'day', 'makeup']);
  var ms = obj(raw.claimedMilestones);
  if (ms) {
    for (var k in ms) {
      if (ms.hasOwnProperty(k) && ms[k]) out.claimedMilestones[k] = true;
    }
  }
  return out;
}

function normalizeCollection(raw) {
  var out = defaults().collection;
  raw = obj(raw);
  if (!raw) return out;

  var unlocked = obj(raw.unlocked);
  if (unlocked) {
    for (var id in unlocked) {
      if (!unlocked.hasOwnProperty(id) || !catData.has(id)) continue;
      out.unlocked[id] = int(unlocked[id], 0, 0);
    }
  }
  if (typeof raw.equipped === 'string' && out.unlocked[raw.equipped]) {
    out.equipped = raw.equipped;
  }
  return out;
}

function normalizeAchievements(raw) {
  var out = {};
  raw = obj(raw);
  if (!raw) return out;
  var known = {};
  for (var i = 0; i < config.ACHIEVEMENTS.length; i++) known[config.ACHIEVEMENTS[i].id] = true;
  for (var id in raw) {
    if (!raw.hasOwnProperty(id) || !known[id]) continue;
    var e = obj(raw[id]);
    if (!e) continue;
    out[id] = {
      unlockedAt: int(e.unlockedAt, 0, 0),
      claimedAt: int(e.claimedAt, 0, 0)
    };
  }
  return out;
}

function normalizeCoachSeen(raw) {
  var out = {};
  raw = obj(raw);
  if (!raw) return out;
  for (var id in raw) {
    if (raw.hasOwnProperty(id) && tutorial.isKnownCoach(id) && raw[id]) {
      out[id] = true;
    }
  }
  return out;
}

function normalizeCosmetics(raw) {
  var out = defaults().cosmetics;
  raw = obj(raw);
  if (!raw) return out;

  var owned = obj(raw.skins);
  out.skins.cream = true;
  if (owned) {
    for (var i = 0; i < theme.skins.length; i++) {
      var id = theme.skins[i].id;
      if (owned[id]) out.skins[id] = true;
    }
  }
  if (typeof raw.current === 'string' && out.skins[raw.current]) out.current = raw.current;
  return out;
}

/** 只接受已知字段，未知/缺失字段一律回落到默认值 */
function normalize(raw) {
  var d = defaults();
  raw = obj(raw);
  if (!raw) return d;
  var from = raw.schema;
  if (from !== 1 && from !== 2 && from !== 3 && from !== config.SAVE_SCHEMA) {
    logger.warn('存档版本不符: ' + from + '，按默认值合并');
  }

  d.coins = int(raw.coins, d.coins, 0);
  d.tickets = int(raw.tickets, d.tickets, 0);
  d.makeupCards = int(raw.makeupCards, d.makeupCards, 0);
  d.fragments = int(raw.fragments, d.fragments, 0);
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
      if (!cats.hasOwnProperty(id) || !catData.has(id)) continue;
      var ce = obj(cats[id]);
      if (!ce) continue;
      d.cats[id] = { count: int(ce.count, 0, 0) };
    }
  }

  d.daily = normalizeDaily(raw.daily);
  d.signin = normalizeSignin(raw.signin);
  d.collection = normalizeCollection(raw.collection);
  d.achievements = normalizeAchievements(raw.achievements);
  d.cosmetics = normalizeCosmetics(raw.cosmetics);
  d.guideSeen = bool(raw.guideSeen, false);
  d.coachSeen = normalizeCoachSeen(raw.coachSeen);

  var st = obj(raw.settings);
  if (st) {
    d.settings.haptic = bool(st.haptic, true);
    d.settings.debug = bool(st.debug, false);
  }

  var levels = require('../../levels/index');
  var total = levels.total();
  if (from === 1) migrateV1(d, raw);
  else if (from === 2 || from === 3) migrateOldOrder(d, raw);

  d.unlocked = Math.min(total + 1, Math.max(1, d.unlocked));
  d.lastLevel = Math.min(total, Math.max(1, d.lastLevel));

  var cleanCompleted = {};
  for (var ck in d.completed) {
    if (!d.completed.hasOwnProperty(ck)) continue;
    var ci = parseInt(ck, 10);
    if (ci >= 1 && ci <= total) cleanCompleted[ci] = d.completed[ck];
  }
  d.completed = cleanCompleted;
  d.resume = normalizeResume(migrateResumeRaw(raw.resume, from), total);
  d.schema = config.SAVE_SCHEMA;
  return d;
}

function usable(raw) {
  return obj(raw) && (raw.schema === 1 || raw.schema === 2 || raw.schema === 3 ||
    raw.schema === config.SAVE_SCHEMA);
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
