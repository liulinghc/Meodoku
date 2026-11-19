/**
 * 文案集中管理。改文案只改这里，界面代码不写死中文。
 */
module.exports = {
  title: '喵谜格',
  subtitle: '猫咪逻辑方阵',

  btnStart: '开 始 游 戏',
  btnContinue: '继 续 探 索',

  cardDaily: '每日挑战',
  cardDailySub: '敬请期待',
  cardAlbum: '猫咪图鉴',
  cardAlbumSub: '敬请期待',
  cardShop: '小 商 店',
  cardShopSub: '敬请期待',

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

  tagline: '今日目标：不看提示过 3 关',

  toastDaily: '每日挑战将在 S6 上线',
  toastAlbum: '图鉴将在 S5 上线',
  toastShop: '商店将在 S5 上线',
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
  toastNoHintRes: '提示券不足，金币也不够',
  toastNoHintCell: '先处理盘面冲突，再用提示',

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
  resultAllDone: '现有章节已全部通关',

  version: 'v%s · %s'
};
