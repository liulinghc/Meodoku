/**
 * 猫咪图鉴数据（16 只）。
 * S1 起用参数化程序化猫头渲染；美术到位后只替换 ui/draw.js 内部实现。
 * unlock.type: clears=主线通关数 / signin=累计签到天数 / daily=每日挑战完成天数 /
 *              achievements=已达成成就数 / craft=消耗碎片合成
 * unlock.need: 对应阈值；craft 为碎片数。
 */
var CATS = [
  { id: 'mo', name: '墨墨', title: '夜行侦探', quote: '先别开灯，我在思考。',
    rarity: 'common', base: '#2E2A28', patch: '#F7F1E9', inner: '#F4B8C8',
    ear: 'point', eyes: 'sparkle', mouth: 'smile', pattern: 'muzzle', accessory: 'bell', acc: 'gold',
    unlock: { type: 'clears', need: 1 } },
  { id: 'naitang', name: '奶糖', title: '午睡冠军', quote: '晒太阳也算推理的一部分。',
    rarity: 'common', base: '#F2DCC0', patch: '#FFFFFF', inner: '#F4B8C8',
    ear: 'round', eyes: 'sleepy', mouth: 'w', pattern: 'tabby', accessory: 'scarf', acc: 'catBlush',
    unlock: { type: 'clears', need: 30 } },
  { id: 'juzuo', name: '橘座', title: '沙发领主', quote: '这块软垫，归我了。',
    rarity: 'common', base: '#F2A35E', patch: '#FFF3E0', inner: '#F4B8C8',
    ear: 'point', eyes: 'dot', mouth: 'open', pattern: 'tabby', accessory: 'glasses', acc: 'text',
    unlock: { type: 'clears', need: 60 } },
  { id: 'xuetuan', name: '雪团', title: '雪地巡游', quote: '脚印会被雪藏起来，线索不会。',
    rarity: 'rare', base: '#FFFFFF', patch: '#E8E1D8', inner: '#F4B8C8',
    ear: 'round', eyes: 'sparkle', mouth: 'tongue', pattern: 'plain', accessory: 'flower', acc: 'brand',
    unlock: { type: 'clears', need: 90 } },
  { id: 'huihui', name: '灰灰', title: '安静观察员', quote: '我不说话，只是在数猫。',
    rarity: 'common', base: '#9AA0A6', patch: '#FFFFFF', inner: '#F4B8C8',
    ear: 'fold', eyes: 'gentle', mouth: 'line', pattern: 'tabby', accessory: 'tear', acc: 'brand',
    unlock: { type: 'clears', need: 120 } },
  { id: 'keke', name: '可可', title: '甜点品鉴师', quote: '解完这一格，奖励一块饼干。',
    rarity: 'common', base: '#A87B5D', patch: '#F5E6D3', inner: '#F4B8C8',
    ear: 'point', eyes: 'gentle', mouth: 'smirk', pattern: 'muzzle', accessory: 'scarf', acc: 'gold',
    unlock: { type: 'clears', need: 150 } },
  { id: 'buding', name: '布丁', title: '布丁守卫', quote: '抖一抖，思路就顺了。',
    rarity: 'rare', base: '#F2C94C', patch: '#E6B53A', inner: '#F4B8C8',
    ear: 'round', eyes: 'happy', mouth: 'open', pattern: 'spot', accessory: 'flower', acc: 'catBlush',
    unlock: { type: 'clears', need: 180 } },
  { id: 'bohe', name: '薄荷', title: '清醒薄荷', quote: '再看一眼行列，答案就在那。',
    rarity: 'common', base: '#9BE3C8', patch: '#FFFFFF', inner: '#F4B8C8',
    ear: 'fold', eyes: 'sparkle', mouth: 'smile', pattern: 'tabby', accessory: 'star', acc: 'gold',
    unlock: { type: 'clears', need: 210 } },
  { id: 'lanmei', name: '蓝莓', title: '蓝莓收藏家', quote: '紫色的小东西，都归我管。',
    rarity: 'rare', base: '#8FB8E8', patch: '#EAF4FF', inner: '#F4B8C8',
    ear: 'point', eyes: 'wide', mouth: 'pout', pattern: 'muzzle', accessory: 'scarf', acc: 'catNose',
    unlock: { type: 'clears', need: 240 } },
  { id: 'yingjing', name: '樱井', title: '春日信使', quote: '春天来了，谜题也会开花。',
    rarity: 'rare', base: '#F4B8C8', patch: '#FFF0F4', inner: '#F4B8C8',
    ear: 'round', eyes: 'happy', mouth: 'tongue', pattern: 'blaze', accessory: 'bow', acc: 'brand',
    unlock: { type: 'clears', need: 270 } },
  { id: 'yecha', name: '夜叉', title: '深夜守卫', quote: '最后一只猫，交给我。',
    rarity: 'epic', base: '#4A4A55', patch: '#E8E8F0', inner: '#F4B8C8',
    ear: 'fold', eyes: 'sleepy', mouth: 'line', pattern: 'muzzle', accessory: 'collar', acc: 'gold',
    unlock: { type: 'clears', need: 300 } },
  { id: 'mocha', name: '抹茶', title: '签到监督员', quote: '每天都来，我就每天都来。',
    rarity: 'common', base: '#A8CF6B', patch: '#7FAE4E', inner: '#F4B8C8',
    ear: 'point', eyes: 'dot', mouth: 'smile', pattern: 'spot', accessory: 'leaf', acc: 'success',
    unlock: { type: 'signin', need: 7 } },
  { id: 'naicha', name: '奶茶', title: '每日全勤', quote: '今天的谜题，加珍珠吗？',
    rarity: 'rare', base: '#D9BF9E', patch: '#FFF9F0', inner: '#F4B8C8',
    ear: 'round', eyes: 'gentle', mouth: 'smile', pattern: 'tabby', accessory: 'glasses', acc: 'textSoft',
    unlock: { type: 'daily', need: 7 } },
  { id: 'wuyun', name: '乌云', title: '成就见证者', quote: '每一条记录，我都替你记着。',
    rarity: 'epic', base: '#5E6670', patch: '#E6EAF0', inner: '#F4B8C8',
    ear: 'point', eyes: 'dot', mouth: 'fang', pattern: 'blaze', accessory: 'star', acc: 'brand',
    unlock: { type: 'achievements', need: 6 } },
  { id: 'jiaotang', name: '焦糖', title: '焦糖炼金', quote: '三枚碎片，正好够熬一锅。',
    rarity: 'epic', base: '#C98B4B', patch: '#FFF2DD', inner: '#F4B8C8',
    ear: 'point', eyes: 'sleepy', mouth: 'smirk', pattern: 'muzzle', accessory: 'crown', acc: 'gold',
    unlock: { type: 'craft', need: 3 } },
  { id: 'yunduo', name: '云朵', title: '云朵旅人', quote: '最后一格，落在云上。',
    rarity: 'epic', base: '#F5F1EA', patch: '#D8CFC4', inner: '#F4B8C8',
    ear: 'round', eyes: 'dot', mouth: 'pout', pattern: 'plain', accessory: 'headphones', acc: 'brand',
    unlock: { type: 'craft', need: 3 } }
];

var BY_ID = {};
for (var i = 0; i < CATS.length; i++) BY_ID[CATS[i].id] = CATS[i];

function get(id) {
  return BY_ID[id] || CATS[0];
}

function has(id) {
  return !!BY_ID[id];
}

module.exports = { all: CATS, get: get, has: has };
