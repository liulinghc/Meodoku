/**
 * 文案集中管理。改文案只改这里，界面代码不写死中文。
 */
module.exports = {
  title: '喵谜格',
  subtitle: '猫咪逻辑方阵',

  btnStart: '开 始 游 戏',
  btnContinue: '继 续 探 索',

  cardDaily: '每日挑战',
  cardDailySub: '每日一题',
  cardAlbum: '猫咪图鉴',
  cardAlbumSub: '收集猫咪',
  cardShop: '小 商 店',
  cardShopSub: '金币道具',
  homeCheckin: '签到',
  homeDailyDone: '已通关 · %d 连胜',
  homeDailyNew: '今日 %d×%d 挑战',
  homeAlbumSub: '%d / %d 只猫咪',
  homeShopSub: '%d 张提示券',

  homeStat: '累计放置 %d 只猫',

  chapterTitle: '第 %d 章',
  chapterProgress: '%d / %d',
  levelTitle: '第 %d 关',
  levelmapTitle: '关卡选择',
  levelLocked: '先完成前面的关卡',
  levelLockedS2: '敬请期待',
  tierNames: ['入门', '简单', '普通', '困难', '专家'],

  ruleColor: '每区一猫',
  ruleRowCol: '行列各一',
  ruleTouch: '猫不相邻',

  toolUndo: '撤销',
  toolRestart: '重开',
  toolHint: '提示',

  tagline: '点一下打叉 · 再点放猫 · 再点清空',

  // 玩法说明
  guideTitle: '玩法说明',
  guideGoalTitle: '怎么算赢？',
  guideGoalLine1: '每行、每列、每个色区，各放 1 只猫。',
  guideGoalLine2: '猫与猫不能相邻（含斜对角）。',
  guideTapTitle: '点一下格子会怎样',
  guideTap1: '单击：打叉（X），这格不放猫',
  guideTap2: '再点：放一只猫',
  guideTap3: '再点：清空这一格',
  guideEmptyMark: '空',
  guideTipTitle: '卡住了？',
  guideTipLine1: '底部工具：撤销 / 重开 / 提示。',
  guideTipLine2: '提示会直接放下一只正确的猫。',
  guideGuardTitle: '新手保护',
  guideGuardLine1: '前 5 关不会失败，放心试。',
  guideGuardLine2: '前 10 关提示免费，不花券和金币。',
  guideGuardLine3: '带小锁的猫是题目放好的，不能移动。',
  guideNext: '下一步',
  guideDone: '知道啦',
  guideHelpMark: '?',
  guideCloseMark: '×',

  // 首次出现规则时的单页提示（每关最多一张，读过后不再出现）
  coachDone: '知道啦',
  coachCards: {
    given: {
      title: '带锁的猫',
      lines: [
        '带小锁的猫是题目放好的，不能移动。',
        '还差 1 只猫：点两下空格，',
        '第一下打叉，第二下才放猫。'
      ]
    },
    rowcol: {
      title: '行、列各一只',
      lines: [
        '每一行、每一列都只能有 1 只猫。',
        '先看只剩一个空位的行或列。'
      ]
    },
    region: {
      title: '每区一猫',
      lines: [
        '每个颜色区也只能有 1 只猫。',
        '猫和猫斜着挨着也不行。'
      ]
    },
    focus: {
      title: '找突破口',
      lines: [
        '发光的格子是这题的突破口。',
        '点两下把猫放进去试试。'
      ]
    },
    freehint: {
      title: '提示免费',
      lines: [
        '前 10 关的提示不花券和金币。',
        '卡住时点下面的「提示」。'
      ]
    },
    mark: {
      title: '先打叉再推理',
      lines: [
        '不确定的格子先点一下打叉。',
        '一行/列/区只剩一格时，就放猫。'
      ]
    },
    bigboard: {
      title: '5×5 入门',
      lines: [
        '棋盘变大成 5×5 了。',
        '先找只剩一个候选的色区。'
      ]
    }
  },

  toastDailyUnavailable: '今日题库暂不可用',
  toastLocked: '先完成前面的关卡',
  toastRestarted: '已重新开始本关',
  toastNoUndo: '没有可撤销的操作',
  toastResumed: '已恢复上次的盘面',
  toastNextChapter: '已经是最新一章',
  toastPrevChapter: '已经是第一章',
  toastChapterLocked: '通关上一章后才能进入',
  toastDebugOn: '调试信息已开启',
  toastDebugOff: '调试信息已关闭',
  toastGear: '设置将在 S7 上线',

  toastHintTicket: '提示券 -1 · 已放下一只猫',
  toastHintCoin: '金币 -%d · 已放下一只猫',
  toastHintFree: '教学提示 · 已放下一只猫',
  toastNoHintRes: '提示券不足，金币也不够',
  toastNoHintCell: '先处理盘面冲突，再用提示',
  toastGivenLocked: '带小锁的猫不能移动',
  toastMistakeSafe: '没关系，前 5 关不会失败，改一改继续',
  toastIdleHint: '卡住了？可以点下面的「提示」',
  tapHintDouble: '点两下',
  tapHintOnce: '点一下',
  hintFreeBadge: '免',

  errorRow: '同一行不能有两只猫',
  errorCol: '同一列不能有两只猫',
  errorRegion: '每个区域只能有一只猫',
  errorAdjacent: '两只猫不能相邻（含对角）',
  toastConflict: '这只猫的位置有冲突',

  resultTitle: '喵呜，通关啦',
  resultSub: '第 %d 关 · %d × %d',
  resultPaws3: '完美拆解，一次都没错',
  resultPaws2: '没有借助提示，很棒',
  resultPaws1: '猫咪为你鼓掌',
  resultTime: '用时',
  resultMoves: '步数',
  resultBest: '最佳用时 %s',
  resultBestNew: '新纪录 · 最佳用时 %s',
  resultCoins: '金币 +%d',
  resultReplay: '再次通关，本关无重复奖励',
  resultNext: '下 一 关',
  resultMap: '返 回 地 图',
  resultHome: '返 回 首 页',
  resultAllDone: '现有章节已全部通关',

  // S5 每日挑战
  dailyTitle: '每日挑战',
  dailyCardLabel: '今日谜题',
  dailySub: '%s · %s',
  dailyStreak: '连胜 %d 天',
  dailyBest: '最佳连胜 %d',
  dailyTotal: '累计完成 %d 天',
  dailyDateLabel: '%d月%d日 · %s',
  dailyMeta: '%s · %d × %d',
  dailyStatStreak: '连胜',
  dailyStatBest: '最佳',
  dailyStatTotal: '累计',
  dailyStreakBonus: '连胜加成最高 +%d',
  dailyDoneBadge: '今日已通关',
  dailyGoal: '完成今日谜题，保持连胜',
  dailyRewardTitle: '首次通关奖励',
  dailyRewardDesc: '%d 金币起 · 1–2 猫爪碎片',
  dailyHistoryTitle: '最近 7 天',
  dailyPlay: '开始今日挑战',
  dailyReplay: '今日已通关 · 再玩一次',
  dailyGuarded: '系统时间异常，今日奖励暂停',
  dailyWeekdays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  dailyGameTitle: '每日挑战',
  dailyGameTag: '每日',
  dailyResultTitle: '今日挑战完成',
  dailyResultSub: '连胜 %d 天 · %d × %d',
  dailyResultRewards: '金币 +%d · 碎片 +%d',
  dailyResultReplay: '今日奖励已领取，重玩不计连胜',
  dailyResultGuarded: '系统时间异常，本次不计奖励与连胜',
  toastDailyReward: '金币 +%d · 碎片 +%d',
  toastDailyReplay: '今日奖励已领取',

  // S5 签到
  checkinTitle: '每日签到',
  checkinStreak: '连续签到 %d 天',
  checkinTotal: '累计 %d 天',
  checkinDay: '第 %d 天',
  checkinDayShort: '%d 天',
  checkinShop: '去商店',
  checkinBtn: '签 到',
  checkinDone: '今日已签到',
  checkinMakeup: '补签昨天（消耗 1 张）',
  checkinMakeupNeed: '漏签 1 天，可用补签卡保住连签',
  checkinMissed: '已断签，本次签到从第 1 天开始',
  checkinCards: '补签卡 %d 张',
  checkinStatStreak: '连续',
  checkinStatTotal: '累计',
  checkinStatCards: '补签卡',
  checkinMakeupLimit: '本周已补签，明天再来',
  checkinMilestone: '累计里程碑',
  checkinMilestoneDays: '%d 天',
  checkinRewardCoins: '%d币',
  checkinRewardTicket: '+1 券',
  checkinRewardFragment: '+1 碎',
  checkinRewardCat: '猫咪',
  checkinRewardMakeup: '补签卡',
  toastCheckinDone: '签到成功，明天见',
  toastCheckinToday: '今天已经签过啦',
  toastMakeupDone: '补签成功，连签保住了',
  toastNoMakeupCard: '没有补签卡，可在商店购买',
  toastMakeupLimit: '本周补签次数已用完',
  toastTimeGuarded: '系统时间异常，请校准后再领取奖励',

  // S5 图鉴
  albumTitle: '猫咪图鉴',
  albumCount: '%d / %d 已收集',
  albumAchievements: '成就 %d/%d',
  albumLocked: '未解锁',
  albumEquipped: '出战中',
  albumEquip: '设为棋盘猫咪',
  albumEquippedDone: '已装备',
  albumCraft: '用 %d 碎片合成',
  albumCraftNeed: '碎片不足（%d / %d）',
  albumFragments: '猫爪碎片 ×%d',
  albumCondition: '解锁条件：%s',
  albumConditionClears: '通关 %d 关（%d / %d）',
  albumConditionSignin: '累计签到 %d 天（%d / %d）',
  albumConditionDaily: '完成每日挑战 %d 天（%d / %d）',
  albumConditionAchievements: '达成 %d 个成就（%d / %d）',
  albumConditionCraft: '消耗 %d 片猫爪碎片合成',
  albumBackToGrid: '返回图鉴',
  rarityNames: { common: '普通', rare: '稀有', epic: '史诗' },
  toastCatEquipped: '%s 已站上棋盘',
  toastCatCrafted: '%s 加入图鉴',
  toastFragmentsShort: '猫爪碎片不足',

  // S5 成就
  achievementsTitle: '成就',
  achievementsCount: '%d / %d 已达成',
  achievementClaim: '领取 %d 金币',
  achievementClaimTicket: '领取 %d 金币 + %d 券',
  achievementClaimed: '已领取',
  achievementClaimBtn: '领取',
  achievementRewardShort: '%d 金币',
  achievementRewardShortTicket: '%d 金币 + %d 券',
  achievementLocked: '未达成',
  achievementProgress: '%d / %d',
  toastAchievementClaimed: '奖励已领取',
  achievements: {
    first_clear: { name: '初次落爪', desc: '完成第 1 个主线关卡' },
    clear_50: { name: '渐入佳境', desc: '主线通关 50 关' },
    clear_150: { name: '半程旅猫', desc: '主线通关 150 关' },
    clear_300: { name: '喵界传奇', desc: '主线通关全部 300 关' },
    perfect_20: { name: '三爪收藏家', desc: '20 关拿到 3 猫爪' },
    daily_7: { name: '七日谜题', desc: '累计完成 7 天每日挑战' },
    signin_7: { name: '七日之约', desc: '累计签到 7 天' },
    collection_8: { name: '猫猫成群', desc: '收集 8 只猫咪' },
    collection_16: { name: '全猫之家', desc: '收集全部 16 只猫咪' }
  },

  // S5 商店
  shopTitle: '小商店',
  shopSubtitle: '金币购买 · 离线可用',
  shopBalance: '金币 %d',
  shopCoin: '金币',
  shopWallet: '提示券 %d · 补签卡 %d',
  shopBuy: '%d 金币',
  shopOwned: '已拥有',
  shopUse: '使用',
  shopUsing: '使用中',
  shopNotEnough: '金币不足',
  toastNotEnoughCoins: '金币不足',
  toastBoughtTicket: '提示券 +%d',
  toastBoughtMakeup: '补签卡 +%d',
  toastBoughtSkin: '获得新棋盘皮肤',
  toastSkinUsed: '棋盘皮肤已切换',
  shopItems: {
    ticket: { name: '提示券', desc: '立即放下一只正确的猫' },
    makeup: { name: '补签卡', desc: '补回漏签的 1 天' },
    'skin-mint': { name: '薄荷棋盘', desc: '区域色板 · 棋盘皮肤' },
    'skin-sakura': { name: '樱花棋盘', desc: '区域色板 · 棋盘皮肤' },
    'skin-night': { name: '夜空棋盘', desc: '区域色板 · 棋盘皮肤' }
  },

  version: 'v%s · %s'
};
