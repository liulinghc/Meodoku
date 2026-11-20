/**
 * 全局常量与可调数值。
 * 数值改动集中在这里，避免散落到业务代码。
 */
module.exports = {
  APP_NAME: '喵喵迷阵',
  VERSION: '0.5.1',
  STAGE: 'S5.1',

  SAVE_KEY: 'md:save:v1',
  SAVE_BAK_KEY: 'md:save:bak',
  SAVE_SCHEMA: 4,
  SAVE_DEBOUNCE_MS: 800,

  INITIAL_COINS: 100,
  INITIAL_TICKETS: 3,
  INITIAL_MAKEUP_CARDS: 0,

  // S2 结算
  LEVEL_COINS: 20,          // 首次通关基础金币
  LEVEL_PERFECT_BONUS: 0.5, // 三爪（无提示、无错格）加成
  RESULT_DELAY: 0.7,        // 通关后停留展示秒数，再进结算

  // S2 提示：优先扣提示券，没有券时可花金币代付
  HINT_COIN_COST: 45,

  // S5.1 新手保护（只作用于主线前若干关）
  FREE_HINT_LEVELS: 10,     // 前 10 关提示免费
  MERCY_LEVELS: 5,          // 前 5 关不设失误上限（当前版本本来就不会因失误失败）
  IDLE_HINT_SECONDS: 20,    // 连续无操作多久后给一次温和提示
  TAP_HINT_LEVELS: 10,      // 前 10 关为引导关，显示位置级操作引导
  TAP_HINT_SECONDS_MIN: 3,  // 第 1 关无操作多久后提示“点两下”
  TAP_HINT_SECONDS_MAX: 10, // 第 10 关无操作多久后提示“点两下”（关卡越往后越放宽）

  CHAPTER_SIZE: 20,
  CHAPTER_COUNT: 15,

  // S4 起使用真实解锁链：通关第 N 关才解锁第 N+1 关。
  UNLOCK_ALL: false,

  // S5 每日挑战：全服同一套本地日历池，周日用 T4 池
  DAILY_BASE_COINS: 80,
  DAILY_STREAK_STEP: 10,
  DAILY_STREAK_BONUS_MAX: 70,
  DAILY_FRAGMENT_MIN: 1,
  DAILY_FRAGMENT_MAX: 2,
  DAILY_HISTORY_DAYS: 31,
  TIME_ROLLBACK_TOLERANCE_MS: 60 * 1000,

  // S5 签到：7 日循环 + 累计里程碑
  SIGNIN_REWARDS: [
    { coins: 20, tickets: 0, fragments: 0 },
    { coins: 30, tickets: 0, fragments: 0 },
    { coins: 40, tickets: 1, fragments: 0 },
    { coins: 50, tickets: 0, fragments: 0 },
    { coins: 60, tickets: 0, fragments: 0 },
    { coins: 80, tickets: 0, fragments: 0 },
    { coins: 120, tickets: 1, fragments: 1 }
  ],
  SIGNIN_MILESTONES: [
    { days: 7, coins: 50, tickets: 1, makeup: 0 },
    { days: 14, coins: 80, tickets: 0, makeup: 1 },
    { days: 30, coins: 120, tickets: 1, makeup: 0 },
    { days: 60, coins: 180, tickets: 0, makeup: 1 },
    { days: 100, coins: 300, tickets: 2, makeup: 0 }
  ],
  MAKEUP_WEEKLY_LIMIT: 1,
  MAKEUP_CARD_COST: 100,

  // S5 图鉴
  CRAFT_FRAGMENT_COST: 3,
  ACHIEVEMENT_CAT_THRESHOLD: 6,

  // S5 成就（奖励需在成就页手动领取）
  ACHIEVEMENTS: [
    { id: 'first_clear', type: 'clears', target: 1, coins: 50, tickets: 0 },
    { id: 'clear_50', type: 'clears', target: 50, coins: 100, tickets: 0 },
    { id: 'clear_150', type: 'clears', target: 150, coins: 180, tickets: 1 },
    { id: 'clear_300', type: 'clears', target: 300, coins: 300, tickets: 2 },
    { id: 'perfect_20', type: 'perfects', target: 20, coins: 150, tickets: 1 },
    { id: 'daily_7', type: 'daily', target: 7, coins: 120, tickets: 1 },
    { id: 'signin_7', type: 'signin', target: 7, coins: 100, tickets: 1 },
    { id: 'collection_8', type: 'collection', target: 8, coins: 160, tickets: 1 },
    { id: 'collection_16', type: 'collection', target: 16, coins: 300, tickets: 2 }
  ],

  // S5 商店（只收金币，不接支付）
  SHOP_ITEMS: [
    { id: 'ticket', type: 'ticket', price: 45, amount: 1 },
    { id: 'makeup', type: 'makeup', price: 100, amount: 1 },
    { id: 'skin-mint', type: 'skin', price: 300, amount: 1 },
    { id: 'skin-sakura', type: 'skin', price: 500, amount: 1 },
    { id: 'skin-night', type: 'skin', price: 800, amount: 1 }
  ],

  DEBUG: false
};
