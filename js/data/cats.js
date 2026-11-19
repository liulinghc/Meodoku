/**
 * 猫咪图鉴数据。
 * S1 阶段用参数化程序化猫头渲染，最终美术到位后替换图集，数据字段不变。
 * 新增一只猫 = 在这里加一条 + 图集加帧（可选），不改业务代码。
 */
var CATS = [
  { id: 'mo',     name: '墨墨',   base: '#2E2A28', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'naitang', name: '奶糖',  base: '#F2DCC0', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'juzuo',  name: '橘座',   base: '#F2A35E', patch: '#FFF3E0', inner: '#F4B8C8' },
  { id: 'xuetuan', name: '雪团',  base: '#FFFFFF', patch: '#E8E1D8', inner: '#F4B8C8' },
  { id: 'huihui', name: '灰灰',   base: '#9AA0A6', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'keke',   name: '可可',   base: '#A87B5D', patch: '#F5E6D3', inner: '#F4B8C8' },
  { id: 'buding', name: '布丁',   base: '#F2C94C', patch: '#FFF8DC', inner: '#F4B8C8' },
  { id: 'bohe',   name: '薄荷',   base: '#9BE3C8', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'lanmei', name: '蓝莓',   base: '#8FB8E8', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'yingjing', name: '樱井', base: '#F4B8C8', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'yecha',  name: '夜叉',   base: '#4A4A55', patch: '#E8E8F0', inner: '#F4B8C8' },
  { id: 'mocha',  name: '抹茶',   base: '#A8CF6B', patch: '#F3F9E8', inner: '#F4B8C8' },
  { id: 'naicha', name: '奶茶',   base: '#D9BF9E', patch: '#FFF9F0', inner: '#F4B8C8' },
  { id: 'wuyun',  name: '乌云',   base: '#5E6670', patch: '#FFFFFF', inner: '#F4B8C8' },
  { id: 'jiaotang', name: '焦糖', base: '#C98B4B', patch: '#FFF2DD', inner: '#F4B8C8' },
  { id: 'yunduo', name: '云朵',   base: '#F5F1EA', patch: '#D8CFC4', inner: '#F4B8C8' }
];

var BY_ID = {};
for (var i = 0; i < CATS.length; i++) BY_ID[CATS[i].id] = CATS[i];

function get(id) {
  return BY_ID[id] || CATS[0];
}

module.exports = { all: CATS, get: get };
