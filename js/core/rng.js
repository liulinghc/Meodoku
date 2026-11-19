/**
 * 可复现随机数（mulberry32）。
 * 禁用 Math.random 于一切影响关卡内容的逻辑，否则坏关无法定位、无法回归。
 */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

module.exports = { mulberry32: mulberry32, shuffle: shuffle, pick: pick };
