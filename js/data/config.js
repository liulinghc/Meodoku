/**
 * 全局常量与可调数值。
 * 数值改动集中在这里，避免散落到业务代码。
 */
module.exports = {
  APP_NAME: '喵谜格',
  VERSION: '0.4.0',
  STAGE: 'S4',

  SAVE_KEY: 'md:save:v1',
  SAVE_BAK_KEY: 'md:save:bak',
  SAVE_SCHEMA: 2,
  SAVE_DEBOUNCE_MS: 800,

  INITIAL_COINS: 100,
  INITIAL_TICKETS: 3,

  // S2 结算
  LEVEL_COINS: 20,          // 首次通关基础金币
  LEVEL_PERFECT_BONUS: 0.5, // 三爪（无提示、无错格）加成
  RESULT_DELAY: 0.7,        // 通关后停留展示秒数，再进结算

  // S2 提示：优先扣提示券，没有券时可花金币代付
  HINT_COIN_COST: 45,

  CHAPTER_SIZE: 20,
  CHAPTER_COUNT: 15,

  // S4 起使用真实解锁链：通关第 N 关才解锁第 N+1 关。
  UNLOCK_ALL: false,

  DEBUG: false
};
