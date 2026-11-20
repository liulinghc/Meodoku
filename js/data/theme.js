/**
 * 设计令牌。
 * 规则：绘制层不得出现字面 hex / 字号 / 圆角，全部从这里取。
 * 具体规格见 docs/03-视觉规格与资源管线.md
 */
var BASE = {
  color: {
    bg: '#F7F1E9',            // 暖象牙底，贴近竞品的低饱和奶油纸感
    bgSunken: '#F0E6DA',
    card: '#FFFFFF',
    border: '#E9DDD1',
    text: '#6E4A42',          // 暖棕主文字，对比度仍 ≥ 7:1
    textSoft: '#9C867C',
    textOnColor: '#FFFFFF',
    brand: '#7FCEEA',
    brandSoft: '#E2F5FC',
    band: '#57B0D2',
    bandDeep: '#3F97BA',
    cta: '#F58B4C',
    ctaSoft: '#FCE6D7',
    ctaDeep: '#DE7233',       // 主按钮的立体底座
    titleShadow: '#EFD8C6',   // 首页标题的暖色投影
    surfaceWarm: '#F9F0E7',   // 未选中标签页的浅奶油底
    progress: '#3E9B4E',      // 进度数字（竞品同款绿色）
    pressed: 'rgba(110, 74, 66, 0.10)', // 按压反馈叠加
    ripple: 'rgba(110, 74, 66, 0.16)',  // 全局点按水波
    conflict: '#E4572E',
    highlight: '#FBE8A6',
    selected: '#FFFFFF',
    shadow: 'rgba(90, 60, 40, 0.08)',
    shadowSoft: 'rgba(90, 60, 40, 0.05)',
    shadowSofter: 'rgba(90, 60, 40, 0.035)',
    mask: 'rgba(60, 40, 30, 0.38)',
    ink: '#2E2A28',
    xDark: '#6B4A35',
    xLight: '#FFFFFF',
    catInk: '#3A3230',        // 五官深色：暖炭墨，避免纯黑
    catLine: '#6E594F',       // 浅色猫轮廓：暖棕细线，轻手绘感
    catInner: '#F2C4CE',      // 耳内软粉
    catNose: '#D98F9B',       // 低饱和鼻粉
    catBlush: '#F2B6C1',      // 低饱和腮红
    gold: '#B8862B',
    coinFace: '#F2C94C',
    coinDeep: '#D9A62E',
    success: '#5FAF7C',
    rarityCommon: '#8C7A69',
    rarityRare: '#5C8DD6',
    rarityEpic: '#A06BC8',
    dot: '#E4572E'
  },

  // 区域色板：色相与明度都拉开，实际取色由 ui/region-colors 按相邻关系分配。
  // 仍是糖果色系，但不再按编号顺序直接映射。
  // 在旧色板基础上向白色混入 12%，保留多色相与可识别性，
  // 同时更接近竞品的粉彩色块；冒烟测试仍要求相邻 ΔE ≥ 30。
  region: [
    '#EB7086', '#64B97F', '#609DDE', '#EBBC53',
    '#A76DBF', '#F18B64', '#48B3AB', '#9A7153',
    '#CE6FAA', '#8C99AA', '#9AC867', '#6F80DB'
  ],

  radius: { board: 20, tileLg: 12, tileSm: 8, card: 14, chip: 10, pill: 28 },
  space: { page: 16, gapTileLg: 6, gapTileSm: 4, padBoard: 8 },

  font: {
    title: 34,
    pageTitle: 20,   // 子页面居中标题：比正文大、比首页标题克制
    hudValue: 26,
    hudLabel: 12,
    banner: 22,
    rule: 13,
    body: 15,
    small: 11,
    micro: 10,
    // 轻提示 / 玩法说明 / 规则卡 / 工具按钮标签的字号单列，
    // 避免为它们放大而影响其它页面版式
    toast: 17,
    tool: 12,
    tagline: 13,
    guideTitle: 18,
    guideSection: 17,
    guideBody: 13,
    guideNote: 12,
    coachTitle: 17,
    coachBody: 13,
    // 首页专用字号，避免为首页视觉放大而影响其它页面
    homeTitle: 42,
    homeKicker: 13,
    homeCatTag: 12,
    homeCta: 24
  },

  size: {
    button: 44,
    icon: 20,
    legend: 24,
    tool: 46
  },

  motion: {
    press: 0.09,        // 按压反馈
    ripple: 0.22,       // 全局点按水波
    fast: 0.12,
    transition: 0.2,    // 场景淡入 + 轻微缩放
    mid: 0.24,
    slow: 0.4
  }
};

var SKINS = [
  { id: 'cream', colors: BASE.region },
  // 皮肤同样保留多色相，靠整体冷暖与明度形成风格差异；
  // 不能做成单色渐变，否则区域边界无法辨认。
  { id: 'skin-mint', colors: [
    '#EB8AA4', '#76CFAB', '#56B9CB', '#E6D26E',
    '#AA8BD1', '#F1987C', '#479C95', '#A6826B',
    '#D68BB8', '#8D9FAB', '#B1D278', '#708DDD'
  ] },
  { id: 'skin-sakura', colors: [
    '#F088A1', '#79BE8E', '#80AEE2', '#EFC769',
    '#B180C4', '#F4997D', '#55B4AE', '#AF8165',
    '#DC7EB1', '#98A2AF', '#ABCF78', '#8495DE'
  ] },
  { id: 'skin-night', colors: [
    '#CD6F85', '#63A781', '#6987CE', '#CFAB55',
    '#9C76C1', '#CB8A69', '#55A6A1', '#98755A',
    '#EAA7C1', '#7D8B9D', '#98AB64', '#9CD6E4'
  ] }
];

var SKIN_BY_ID = {};
for (var si = 0; si < SKINS.length; si++) SKIN_BY_ID[SKINS[si].id] = SKINS[si];

function palette(id) {
  var skin = SKIN_BY_ID[id];
  return (skin || SKINS[0]).colors;
}

function scale(s) {
  var out = {
    color: BASE.color,
    region: BASE.region.slice(),
    motion: BASE.motion,
    radius: {},
    space: {},
    font: {},
    size: {}
  };
  var k;
  for (k in BASE.radius) out.radius[k] = Math.round(BASE.radius[k] * s);
  for (k in BASE.space) out.space[k] = Math.round(BASE.space[k] * s);
  for (k in BASE.font) out.font[k] = Math.max(10, Math.round(BASE.font[k] * s));
  for (k in BASE.size) out.size[k] = Math.round(BASE.size[k] * s);
  return out;
}

module.exports = { base: BASE, skins: SKINS, palette: palette, scale: scale };
