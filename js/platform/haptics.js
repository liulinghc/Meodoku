/**
 * 轻触反馈。失败静默——振动不是核心功能。
 */
function light() {
  try {
    if (typeof wx !== 'undefined' && wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  } catch (e) { /* ignore */ }
}

module.exports = { light: light };
