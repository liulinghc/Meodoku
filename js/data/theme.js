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

  region: [
    '#F07AB4', '#F2917A', '#F2A85E', '#D4B24C',
    '#A8CF6B', '#6FD3A0', '#56C6C0', '#5CC3EE',
    '#8E6BC8', '#A87B5D', '#7A82D8', '#7C8B9E'
  ],

  radius: { board: 20, tileLg: 12, tileSm: 8, card: 14, chip: 10, pill: 28 },
  space: { page: 16, gapTileLg: 6, gapTileSm: 4, padBoard: 8 },

  font: {
    title: 34,
    hudValue: 26,
    hudLabel: 12,
    banner: 22,
    rule: 12,
    body: 15,
    small: 11,
    micro: 10
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
  { id: 'skin-mint', colors: [
    '#6FD3A0', '#7ED9B2', '#8FD9A6', '#A8D987',
    '#C2DF8A', '#DDE6A0', '#9ED9C9', '#7CCBC6',
    '#6BBFC4', '#8FC7D3', '#A6D3C9', '#BCDCC9'
  ] },
  { id: 'skin-sakura', colors: [
    '#F07AB4', '#F58FA8', '#F4A0A0', '#F2B08E',
    '#E8B98A', '#D8B9A0', '#C7A8C8', '#B79BD3',
    '#A991D8', '#C38AC0', '#D990B3', '#E6A2B4'
  ] },
  { id: 'skin-night', colors: [
    '#4C6B8A', '#566F9E', '#5E7AA8', '#647FA0',
    '#6B8C9E', '#5A8C96', '#4F8F8A', '#5C8C7A',
    '#718A66', '#8A865F', '#7C6B8A', '#675E7E'
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
