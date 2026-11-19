/**
 * 每日挑战。
 *
 * 题库：包内 365 道日历池（312 工作日 + 53 周日），跨年复用。
 * 选关：周日从周日池按“当年第几个周日”取题；其余日期从工作日池按
 *      “当年第几个非周日”取题。同一本地日期在所有设备上同题。
 * 档位：S5.1 起由人类求解器重评，实际分布 {T2:105,T3:234,T4:26}；
 *      池子的工作日/周日角色与题目内容不变。
 * 时间：只做止损式校验；检测到明显回拨后，当日不再发放奖励/连胜。
 */
var config = require('../data/config');
var clock = require('../core/clock');
var date = require('../core/date');
var raw = require('../../levels/daily-365');

function decode(rawLevel) {
  var n = rawLevel.n;
  var regions = [];
  var solution = [];
  for (var i = 0; i < n * n; i++) {
    var g = rawLevel.r.charCodeAt(i) - 97;
    if (g < 0 || g >= n) return null;
  }
  for (var r = 0; r < n; r++) {
    regions.push(rawLevel.r.slice(r * n, r * n + n));
    var c = rawLevel.s.charCodeAt(r) - 48;
    if (c < 0 || c >= n) return null;
    solution.push(c);
  }
  return {
    id: rawLevel.id,
    n: n,
    regions: regions,
    solution: solution,
    tier: rawLevel.t,
    tierLevel: rawLevel.t,
    difficulty: rawLevel.d,
    seed: rawLevel.seed,
    daily: true
  };
}

var POOLS = {
  t3: (raw.t3 || []).map(decode),
  t4: (raw.t4 || []).map(decode)
};

function ordinalWithinYear(dateKey, sunday) {
  var p = dateKey.slice(0, 4) + '-01-01';
  var end = date.dayNumber(dateKey);
  var start = date.dayNumber(p);
  var count = 0;
  for (var n = start; n < end; n++) {
    var isSun = date.isSunday(date.fromDayNumber(n));
    if (sunday ? isSun : !isSun) count++;
  }
  return count;
}

function levelFor(dateKey) {
  var sunday = date.isSunday(dateKey);
  var pool = sunday ? POOLS.t4 : POOLS.t3;
  if (!pool.length) return null;
  var slot = ordinalWithinYear(dateKey, sunday) % pool.length;
  var level = pool[slot];
  if (!level) return null;
  level.dailyDate = dateKey;
  level.dailySlot = slot;
  level.dailyPool = sunday ? 't4' : 't3';
  return level;
}

function Daily(progress) {
  this.progress = progress;
  this.save = progress.save;
}

Daily.prototype.d = function () { return this.save.data; };

Daily.prototype.available = function () {
  return POOLS.t3.length > 0 && POOLS.t4.length > 0;
};

Daily.prototype.todayKey = function () { return date.key(clock.now()); };

Daily.prototype.level = function (dateKey) {
  return levelFor(dateKey || this.todayKey());
};

Daily.prototype.isCleared = function (dateKey) {
  return !!this.d().daily.history[dateKey || this.todayKey()];
};

Daily.prototype.streak = function () { return this.d().daily.streak; };
Daily.prototype.bestStreak = function () { return this.d().daily.bestStreak; };
Daily.prototype.totalDays = function () { return this.d().daily.total; };

/** 观察当前时间；明显回拨时把“今天”标记为受限日 */
Daily.prototype.noteSeen = function () {
  var d = this.d();
  var now = clock.now();
  var last = d.daily.lastSeenTs || 0;
  var changed = false;
  if (last && now < last - config.TIME_ROLLBACK_TOLERANCE_MS) {
    var today = date.key(now);
    if (d.daily.timeGuardDate !== today) {
      d.daily.timeGuardDate = today;
      changed = true;
    }
  }
  if (now > last && now - last > 5 * 60 * 1000) {
    d.daily.lastSeenTs = now;
    changed = true;
  } else if (!last) {
    d.daily.lastSeenTs = now;
    changed = true;
  }
  if (changed) this.save.touch();
  return changed;
};

Daily.prototype.guarded = function () {
  return this.d().daily.timeGuardDate === this.todayKey();
};

Daily.prototype.status = function () {
  var today = this.todayKey();
  var level = this.level(today);
  return {
    date: today,
    weekday: date.weekday(today),
    level: level,
    cleared: this.isCleared(today),
    guarded: this.guarded(),
    streak: this.streak(),
    bestStreak: this.bestStreak(),
    total: this.totalDays()
  };
};

/** 最近 days 天（含今天）的通关状态，用于日历横排 */
Daily.prototype.recent = function (days) {
  var out = [];
  var today = this.todayKey();
  var d = this.d();
  for (var i = days - 1; i >= 0; i--) {
    var key = date.add(today, -i);
    out.push({
      date: key,
      done: !!d.daily.history[key],
      today: i === 0,
      future: false
    });
  }
  return out;
};

/**
 * 完成今日挑战。只有当天第一次完成发奖并计连胜；
 * 重试可无限玩，但不重复发奖。
 */
Daily.prototype.complete = function (info) {
  info = info || {};
  this.noteSeen();
  var d = this.d();
  var today = this.todayKey();
  // 对局可能跨过零点：优先记录开局的日期，避免把昨天的题算到今天头上
  var target = date.isKey(info.date) ? info.date : today;
  if (date.diff(target, today) < 0) target = today;
  var level = this.level(target);
  if (!level) return { ok: false, reason: 'unavailable' };

  if (d.daily.history[target]) {
    return {
      ok: false,
      replay: true,
      guarded: false,
      coins: 0,
      fragments: 0,
      streak: d.daily.streak,
      bestStreak: d.daily.bestStreak,
      total: d.daily.total
    };
  }

  if (this.guarded()) {
    return {
      ok: false,
      guarded: true,
      replay: false,
      coins: 0,
      fragments: 0,
      streak: d.daily.streak,
      bestStreak: d.daily.bestStreak,
      total: d.daily.total
    };
  }

  var last = d.daily.date;
  var streak = 1;
  if (last && date.diff(last, target) === 1) streak = d.daily.streak + 1;
  if (!isFinite(streak) || streak < 1) streak = 1;

  var bonus = Math.min(config.DAILY_STREAK_BONUS_MAX, config.DAILY_STREAK_STEP * streak);
  var coins = config.DAILY_BASE_COINS + bonus;
  var span = Math.max(0, config.DAILY_FRAGMENT_MAX - config.DAILY_FRAGMENT_MIN + 1);
  var fragments = config.DAILY_FRAGMENT_MIN + (span ? (date.dayNumber(target) % span) : 0);

  this.progress.addCoins(coins);
  this.progress.addFragments(fragments);
  this.save.touch();

  d.daily.date = target;
  d.daily.streak = streak;
  d.daily.bestStreak = Math.max(d.daily.bestStreak, streak);
  d.daily.claimed = true;
  d.daily.lastIndex = (level.dailySlot || 0) + 1;
  d.daily.total += 1;
  d.daily.lastClaimTs = clock.now();
  d.daily.history[target] = {
    coins: coins,
    fragments: fragments,
    timeMs: Math.max(0, Math.round(info.timeMs || 0)),
    paws: Math.min(3, Math.max(1, info.paws || 1)),
    streak: streak
  };
  this.save.touch();

  return {
    ok: true,
    replay: false,
    guarded: false,
    coins: coins,
    fragments: fragments,
    streak: streak,
    bestStreak: d.daily.bestStreak,
    total: d.daily.total
  };
};

module.exports = Daily;
