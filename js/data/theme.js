/**
 * 设计令牌。
 * 规则：绘制层不得出现字面 hex / 字号 / 圆角，全部从这里取。
 * 具体规格见 docs/03-视觉规格与资源管线.md
 */
var BASE = {
  color: {
    bg: '#FDF4E7',
    bgSunken: '#F6EADA',
    card: '#FFFFFF',
    border: '#EFE4D3',
    text: '#5B4335',
    textSoft: '#9C8776',
    textOnColor: '#FFFFFF',
    brand: '#7ECBE8',
    brandSoft: '#DCF3FB',
    band: '#57B0D2',
    bandDeep: '#3F97BA',
    cta: '#F58B4C',
    ctaSoft: '#FDE4D2',
    conflict: '#E4572E',
    highlight: '#FBE8A6',
    selected: '#FFFFFF',
    shadow: 'rgba(90, 60, 40, 0.10)',
    mask: 'rgba(60, 40, 30, 0.38)',
    ink: '#2E2A28',
    gold: '#B8862B',
    success: '#5FAF7C',
    rarityCommon: '#8C7A69',
    rarityRare: '#5C8DD6',
    rarityEpic: '#A06BC8',
    dot: '#E4572E'
  },

  // 区域色板：色相与明度都拉开，实际取色由 ui/region-colors 按相邻关系分配。
  // 仍是糖果色系，但不再按编号顺序直接映射。
  region: [
    '#E85D75', '#4FAF6E', '#4A90D9', '#E8B33C',
    '#9B59B6', '#EF7B4F', '#2FA9A0', '#8C5E3C',
    '#C75B9E', '#7C8B9E', '#8CC152', '#5B6FD6'
  ],

  radius: { board: 20, tileLg: 12, tileSm: 8, card: 14, chip: 10, pill: 28 },
  space: { page: 16, gapTileLg: 6, gapTileSm: 4, padBoard: 8 },

  font: {
    title: 34,
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
    coachBody: 13
  },

  size: {
    button: 44,
    icon: 20,
    legend: 24,
    tool: 46
  },

  motion: { fast: 0.12, mid: 0.24, slow: 0.4 }
};

var SKINS = [
  { id: 'cream', colors: BASE.region },
  // 皮肤同样保留多色相，靠整体冷暖与明度形成风格差异；
  // 不能做成单色渐变，否则区域边界无法辨认。
  { id: 'skin-mint', colors: [
    '#E87A98', '#63C9A0', '#3FAFC4', '#E3CC5A',
    '#9E7BCB', '#EF8A6A', '#2E8E87', '#9A7157',
    '#D07BAE', '#7D92A0', '#A6CC66', '#5D7ED8'
  ] },
  { id: 'skin-sakura', colors: [
    '#EE7894', '#67B57F', '#6FA3DE', '#EDBF55',
    '#A66FBC', '#F28B6B', '#3EAAA3', '#A47050',
    '#D76CA6', '#8A95A4', '#9FC866', '#7386DA'
  ] },
  { id: 'skin-night', colors: [
    '#C65B74', '#4E9B70', '#5577C7', '#C9A03E',
    '#8F63B8', '#C47A55', '#3E9A94', '#8A6244',
    '#E79BB8', '#6B7B90', '#8AA04F', '#8FD0E0'
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
