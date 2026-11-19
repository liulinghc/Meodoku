/**
 * 设置读写。字段固定，缺省走默认值。
 */
function get(save, key) {
  var s = save.data.settings;
  if (s && typeof s[key] !== 'undefined') return s[key];
  return key === 'haptic' ? true : false;
}

function set(save, key, value) {
  if (!save.data.settings) save.data.settings = {};
  if (save.data.settings[key] === value) return value;
  save.data.settings[key] = value;
  save.touch();
  return value;
}

function toggle(save, key) {
  return set(save, key, !get(save, key));
}

module.exports = { get: get, set: set, toggle: toggle };
