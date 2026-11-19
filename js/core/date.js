/**
 * 本地自然日工具。所有日期以 'YYYY-MM-DD' 字符串保存，按本地日历切日。
 * 天序号统一用 UTC 零点计算，避免夏令时造成 23/25 小时误差。
 */
var DAY_MS = 24 * 3600 * 1000;
var KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** 既是格式合法、也必须是真实存在的日历日（拒绝 02-30 / 13-40） */
function isKey(v) {
  return parseParts(v) !== null;
}

function parseParts(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return null;
  var y = parseInt(key.slice(0, 4), 10);
  var m = parseInt(key.slice(5, 7), 10);
  var d = parseInt(key.slice(8, 10), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  var check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y: y, m: m, d: d };
}

/** 时间戳 → 本地日期键 */
function key(ts) {
  var d = new Date(typeof ts === 'number' ? ts : Date.now());
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** 日期键 → 天序号（1970-01-01 为 0） */
function dayNumber(dateKey) {
  var p = parseParts(dateKey);
  if (!p) return NaN;
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / DAY_MS);
}

function fromDayNumber(n) {
  var d = new Date(n * DAY_MS);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

/** b 比 a 晚多少天；b 更早时为负数 */
function diff(a, b) {
  return dayNumber(b) - dayNumber(a);
}

function add(dateKey, days) {
  var n = dayNumber(dateKey);
  if (!isFinite(n)) return '';
  return fromDayNumber(n + (days || 0));
}

/** 0=周日 … 6=周六 */
function weekday(dateKey) {
  var n = dayNumber(dateKey);
  if (!isFinite(n)) return -1;
  return new Date(n * DAY_MS).getUTCDay();
}

/** 一年中的第几天，1-based */
function dayOfYear(dateKey) {
  var p = parseParts(dateKey);
  if (!p) return 0;
  return Math.floor((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(p.y, 0, 1)) / DAY_MS) + 1;
}

/** 所在自然周（周一为起点）的周一日期键，用于“每周一次”限次 */
function weekKey(dateKey) {
  var n = dayNumber(dateKey);
  if (!isFinite(n)) return '';
  var dow = weekday(dateKey);
  var back = (dow + 6) % 7;
  return fromDayNumber(n - back);
}

function isSunday(dateKey) {
  return weekday(dateKey) === 0;
}

module.exports = {
  key: key,
  isKey: isKey,
  dayNumber: dayNumber,
  fromDayNumber: fromDayNumber,
  diff: diff,
  add: add,
  weekday: weekday,
  dayOfYear: dayOfYear,
  weekKey: weekKey,
  isSunday: isSunday
};
