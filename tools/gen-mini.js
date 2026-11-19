#!/usr/bin/env node
/**
 * 兼容入口：S3 起正式关卡包统一由 tools/gen-pack.js 生成。
 *
 * 早期版本这里产出 20 关样张；现在如继续生成，会覆盖 200 关正式包。
 * 为避免误操作，本命令转发到 gen-pack：
 *   node tools/gen-mini.js           = node tools/gen-pack.js
 *   node tools/gen-mini.js --check   = node tools/gen-pack.js --check
 */
console.log('提示：正式关卡由 tools/gen-pack.js 生成，本命令已转发。');
require('./gen-pack');
