/**
 * Node 工具兼容入口。
 *
 * S3 起生成/求解/难度只有一份实现，位于 js/domain/：
 *   generate.js   生成管线（运行时每日挑战也用它）
 *   solver.js     唯一解计数
 *   difficulty.js 人类技巧难度与布局签名
 * 这里仅做转发，避免工具与运行时出现两套逻辑。
 */
module.exports = require('../../js/domain/generate');
