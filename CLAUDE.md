# 喵谜格 · 项目长期开发规则

微信小游戏（猫咪逻辑方阵）。本文件是本项目的长期开发准则，每次改动都必须遵守。
产品细节见 `docs/01-产品方案与技术架构.md`，生成算法见 `docs/02`，视觉规格见 `docs/03`，
运行方式与目录说明见 `README.md`。

## 技术约束（硬性）

1. 只用微信小游戏原生 API。
2. 原生 JavaScript（CommonJS，无打包器）。
3. 画面用 Canvas 绘制。
4. 禁止任何游戏引擎（Cocos / Unity / Laya / Egret 等）。
5. 禁止后端服务器、数据库、注册登录。
6. 核心玩法不得依赖联网；断网必须完整可玩。
7. 全部数据保存在本地 Storage（经 `js/services/save.js`）。
8. 不确定的微信 API 必须先核实官方文档，禁止臆造接口。

## 代码管理规则

1. 改代码前先读现有结构，不理解就继续读，不做大规模重写。
2. 不随意删除已有功能；新功能必须与现有功能兼容。
3. 不用临时假数据替代已实现的真实功能。
4. 不留无效按钮：新按钮必须接真实逻辑；阶段性占位必须给出明确文案并在计划内落地。
5. 改完必须自查相关代码与调用方。
6. 每次开发结束必须总结修改了哪些文件、完成了什么功能。
7. 发现 Bug 必须定位根因并修复，不用 catch 掩盖或隐藏报错。

## 开发流程（每次需求）

1. 分析现有项目结构。
2. 确认需求涉及哪些模块。
3. 分析对已有功能的影响。
4. 制定修改计划。
5. 执行修改。
6. 运行与测试。
7. 报告修改结果（文件 + 功能 + 验证证据）。

## 项目约定（现有架构，改动前必读）

- 入口：`game.js` → `js/main.js` → `js/app.js`（装配环境/布局/主题/渲染器/存档/场景栈/主循环）。
- 场景：`js/ui/screens/*`，经 `SceneManager` 栈管理；只栈顶收输入与渲染。
- 通关判定唯一真相：`js/domain/rules.js` 按规则判定，**不读关卡答案**。
- 关卡：`levels/index.js` 是唯一索引入口（1-based 序号 + 章节 + 稳定 ID）；
  关卡包为生成产物，勿手改。旧存档迁移只认稳定 ID（`indexOfId`），不认序号。
- 数值 / 文案 / 颜色：分别改 `js/data/config.js`、`copy.js`、`theme.js`；绘制代码不写死 hex、字号、坐标。
- 存档：所有写入走 `js/services/*`（内部 `save.touch()` 防抖落盘、切后台双写）。
  对局续玩是单槽 `resume`（盘面/用时/步数/失误/提示次数，不含撤销栈），
  切后台与离开对局时保存，通关时清除；schema 版本为 2，旧档在 `save.normalize` 迁移。
- 美术替换边界：`js/ui/draw.js` 的每个绘制函数保持签名不变，内部可换成 `drawImage`。
- 平台 API 只出现在 `js/platform/*`，业务层不直接调 `wx.*`。
- 关卡生成（不打包）：`js/domain/generate.js` + `solver.js` + `difficulty.js`
  （运行时与 Node 工具共用）；`tools/gen-pack.js`（300 关产物，基于
  `tools/lib/base-200.json` 追加并保持旧 ID）、`batch-test.js`（批量验证）、
  `smoke-test.js`、`build-preview.js`。
- 正式关卡源数据 `levels/pack-001.json`，游戏加载 `levels/pack-001.js`；
  `levels/index.js` 解码紧凑字段。

## 验证命令

```bash
node tools/smoke-test.js          # 必须全绿
node tools/gen-pack.js --check    # 300 关唯一解/档位/去重/旧 ID 保留/大小校验
node tools/batch-test.js 1000     # 批量生成/验证统计（至少 1000 关）
node tools/build-preview.js       # 视觉验收（可选，open preview/index.html）
```

## 当前阶段

- S1 工程底座、S2 对局闭环（计时/步数/猫爪、提示经济、结算页与金币奖励）、
  S3 内容管线（4×4–9×9、唯一解、人类技巧难度、去重、JSON/JS 包）、
  S4 解锁与续玩（300 关/15 章、真实解锁链、章节锁与爪印、中断续玩、旧档迁移）
  已完成；三态点击、撤销/重开/提示、实时冲突判定、放置反馈均已接入；
  冒烟测试 130 项全绿，批量 1000 关全部唯一解。
- 结算真相：`GameScene._settle()` 用 `domain/rules` 二次校验后调
  `progress.completeLevel()`；奖励参数在 `js/data/config.js`（`LEVEL_COINS`、
  `LEVEL_PERFECT_BONUS`、`HINT_COIN_COST`、`RESULT_DELAY`）。
- 解锁真相：`config.UNLOCK_ALL = false`；`progress.completeLevel()` 把
  `unlocked` 推进到 `index + 1`，`progress.isUnlocked()` 只认该前缀。
  难度档位 T1–T5 数量 30/75/105/60/30，共 15 章，章内先小后大、同档按逻辑分递增。
- 下一步 S5：猫咪图鉴 / 商店 / 提示券获取、每日挑战与签到。
- 已知待办：首页「每日挑战 / 猫咪图鉴 / 小商店」与齿轮为阶段性占位（toast 提示），
  分别在 S5 / S5 / S5 / S7 接入真实功能，不得长期停留为无效按钮；
  提示券目前已可消耗，获取途径（广告/签到）在 S5–S6 接入。
