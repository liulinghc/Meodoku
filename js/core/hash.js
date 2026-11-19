/**
 * FNV-1a 32 位字符串哈希。
 * 用途：关卡种子、玩家本地 id 等需要稳定且可复现的散列。
 */
function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

module.exports = { fnv1a: fnv1a };
