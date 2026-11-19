/**
 * 连续签到：7 日循环、累计里程碑、补签卡。
 * 时间校验复用 daily 的“明显回拨”守护，不重复造一套。
 */
var config = require('../data/config');
var clock = require('../core/clock');
var date = require('../core/date');

function Signin(progress, daily) {
  this.progress = progress;
  this.daily = daily;
  this.save = progress.save;
}

Signin.prototype.d = function () { return this.save.data; };

Signin.prototype.todayKey = function () { return date.key(clock.now()); };

Signin.prototype.claimedToday = function () {
  return this.d().signin.lastDate === this.todayKey();
};

Signin.prototype.canMakeup = function () {
  var d = this.d();
  var today = this.todayKey();
  var s = d.signin;
  if (!s.lastDate || s.lastDate === today) return false;
  if (date.diff(s.lastDate, today) !== 2) return false;
  if (this.progress.makeupCards() <= 0) return false;
  if (s.makeupWeek === date.weekKey(today) && s.makeupUsed >= config.MAKEUP_WEEKLY_LIMIT) return false;
  return true;
};

/** 当前状态与下一次签到的预览 */
Signin.prototype.status = function () {
  var d = this.d();
  var s = d.signin;
  var today = this.todayKey();
  var claimed = s.lastDate === today;
  var future = !!s.lastDate && date.diff(s.lastDate, today) < 0;
  var gap = s.lastDate && !claimed ? date.diff(s.lastDate, today) : 0;
  var nextDay = 1;
  var nextStreak = 1;
  var missed = false;

  if (claimed) {
    nextDay = s.cycleDay;
    nextStreak = s.streak;
  } else if (!s.lastDate) {
    nextDay = 1;
    nextStreak = 1;
  } else if (gap === 1) {
    nextDay = (s.cycleDay % 7) + 1;
    nextStreak = s.streak + 1;
  } else if (gap > 1) {
    missed = true;
    nextDay = 1;
    nextStreak = 1;
  }

  return {
    date: today,
    claimed: claimed,
    future: future,
    missed: missed,
    gap: gap,
    cycleDay: s.cycleDay,
    streak: s.streak,
    totalDays: s.totalDays,
    nextDay: nextDay,
    nextStreak: nextStreak,
    canMakeup: this.canMakeup(),
    makeupCards: this.progress.makeupCards(),
    guarded: this.daily ? this.daily.guarded() : false
  };
};

/** 7 格预览：done / current / pending */
Signin.prototype.week = function () {
  var st = this.status();
  var out = [];
  for (var i = 0; i < 7; i++) {
    var day = i + 1;
    var through = 0;
    if (st.claimed) through = st.cycleDay === 0 ? 7 : st.cycleDay;
    else if (st.gap === 1) through = st.cycleDay;
    var done = day <= through;
    out.push({
      day: day,
      reward: config.SIGNIN_REWARDS[i],
      done: done,
      current: !st.claimed && day === st.nextDay
    });
  }
  return out;
};

Signin.prototype.milestones = function () {
  var out = [];
  var claimed = this.d().signin.claimedMilestones;
  for (var i = 0; i < config.SIGNIN_MILESTONES.length; i++) {
    var m = config.SIGNIN_MILESTONES[i];
    out.push({
      days: m.days,
      coins: m.coins,
      tickets: m.tickets,
      makeup: m.makeup,
      reached: this.d().signin.totalDays >= m.days,
      claimed: !!claimed[m.days]
    });
  }
  return out;
};

Signin.prototype._grantMilestones = function () {
  var d = this.d();
  var out = [];
  for (var i = 0; i < config.SIGNIN_MILESTONES.length; i++) {
    var m = config.SIGNIN_MILESTONES[i];
    if (d.signin.totalDays < m.days) continue;
    if (d.signin.claimedMilestones[m.days]) continue;
    if (m.coins) this.progress.addCoins(m.coins);
    if (m.tickets) this.progress.addTickets(m.tickets);
    if (m.makeup) this.progress.addMakeupCards(m.makeup);
    d.signin.claimedMilestones[m.days] = true;
    out.push(m);
  }
  return out;
};

function grantReward(progress, reward) {
  if (reward.coins) progress.addCoins(reward.coins);
  if (reward.tickets) progress.addTickets(reward.tickets);
  if (reward.fragments) progress.addFragments(reward.fragments);
}

Signin.prototype.claim = function () {
  if (this.daily) this.daily.noteSeen();
  var d = this.d();
  var s = d.signin;
  var today = this.todayKey();

  if (s.lastDate === today) return { ok: false, reason: 'claimed' };
  if (this.daily && this.daily.guarded()) return { ok: false, reason: 'guarded' };
  if (s.lastDate && date.diff(s.lastDate, today) < 0) return { ok: false, reason: 'future' };

  var gap = s.lastDate ? date.diff(s.lastDate, today) : 0;
  var day;
  var streak;
  if (gap === 1) {
    day = (s.cycleDay % 7) + 1;
    streak = s.streak + 1;
  } else {
    day = 1;
    streak = 1;
  }

  var reward = config.SIGNIN_REWARDS[day - 1];
  grantReward(this.progress, reward);

  s.lastDate = today;
  s.cycleDay = day;
  s.streak = streak;
  s.totalDays += 1;
  s.history[today] = {
    coins: reward.coins,
    tickets: reward.tickets,
    day: day,
    makeup: 0
  };
  var milestones = this._grantMilestones();
  this.save.touch();

  return {
    ok: true,
    day: day,
    coins: reward.coins,
    tickets: reward.tickets,
    fragments: reward.fragments,
    streak: streak,
    totalDays: s.totalDays,
    milestones: milestones
  };
};

/** 补签昨天（仅漏 1 天、有卡、且本周未用） */
Signin.prototype.makeup = function () {
  if (this.daily) this.daily.noteSeen();
  if (!this.canMakeup()) return { ok: false, reason: 'unavailable' };
  if (this.daily && this.daily.guarded()) return { ok: false, reason: 'guarded' };

  var d = this.d();
  var s = d.signin;
  var today = this.todayKey();
  var missing = date.add(s.lastDate, 1);
  var day = (s.cycleDay % 7) + 1;
  var reward = config.SIGNIN_REWARDS[day - 1];

  if (!this.progress.spendMakeupCard()) return { ok: false, reason: 'card' };
  grantReward(this.progress, reward);

  s.lastDate = missing;
  s.cycleDay = day;
  s.streak += 1;
  s.totalDays += 1;
  var week = date.weekKey(today);
  s.makeupUsed = (s.makeupWeek === week) ? (s.makeupUsed + 1) : 1;
  s.makeupWeek = week;
  s.history[missing] = {
    coins: reward.coins,
    tickets: reward.tickets,
    day: day,
    makeup: 1
  };
  var milestones = this._grantMilestones();
  this.save.touch();

  return {
    ok: true,
    day: day,
    coins: reward.coins,
    tickets: reward.tickets,
    fragments: reward.fragments,
    streak: s.streak,
    totalDays: s.totalDays,
    milestones: milestones
  };
};

module.exports = Signin;
