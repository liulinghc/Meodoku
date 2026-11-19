# 喵谜格（Meodoku 类型 · 猫咪逻辑方阵）

微信小游戏，纯原生 JavaScript + Canvas，零引擎、零后端、离线可玩。

当前阶段：**S5 经济与收集**。300 关正式关卡（4×4–9×9，T1–T5，15 章），
全部唯一解、结构合格、逻辑难度定档、布局去重；真实章节/关卡解锁链、
中断续玩、旧存档迁移、地图猫爪评分已接入。S5 新增每日挑战（365 道日历池）、
7 日签到与补签、16 只猫图鉴、9 个成就、金币商店与棋盘皮肤。
三态标记、撤销/重开/提示、实时冲突反馈、计时步数与结算页均可直接运行。

## 运行

1. 微信开发者工具 → 导入项目 → 选择本目录
2. AppID 用「测试号」或填自己的小游戏 AppID（`project.config.json` 里当前是 `touristappid`）
3. 编译后即为首页；点「开始游戏」进入关卡地图

> 没有后端、没有网络请求。断网状态下功能完整。

## 核心玩法自测

- 首关为 4×4 教学关；300 关尺寸分布：4×4×9、5×5×58、6×6×90、7×7×104、8×8×24、9×9×15
- 档位分布：入门 30 / 简单 75 / 普通 105 / 困难 60 / 专家 30；每 20 关一章，共 15 章
- 解锁：新档只开第 1 关；通关第 N 关解锁第 N+1 关；地图按章浏览，未解锁章显示锁标
- 单击空格：空 → X → 猫 → 空；点已放置的猫可移除
- 故意在同一行/列/区域或八邻格放第二只猫：应出现红色冲突描边、红波纹、
  短震动和具体原因提示，并计入本局失误
- 撤销/重开：重开清空盘面并重置计时、步数、失误；已消耗的提示券不返还
- 通关：每行、每列、每区域各一只猫且互不相邻（含对角）
- 续玩：对局中切后台会保存盘面/用时/步数/失误/提示次数，重进同关自动恢复；
  通关后清除续玩数据，不保留撤销栈
- 每日挑战：首页大卡进入；同一天所有设备取同一道题（周日 T4，其余 T3）；
  首通发 80 + 10×连胜金币（加成上限 +70）和 1–2 枚碎片，同日重玩可练手但不发奖
- 签到：7 日循环，第 3 日发提示券，第 7 日发券 + 碎片；累计 7/14/30/60/100 天
  有里程碑奖励；漏签 1 天可消耗补签卡补上（每自然周最多 1 次）
- 图鉴：16 只猫按通关数 / 签到 / 每日挑战 / 成就 / 碎片合成解锁；
  已解锁猫可出战，棋盘与首页的猫会同步换装；碎片合成猫各需 3 枚
- 成就：9 条长期目标，达成后需在成就页手动领取金币/提示券
- 商店：金币购买提示券、补签卡与 3 款棋盘皮肤，不接支付与广告；金币不足会明确提示
- 改时间：检测到系统时间回拨超过 60 秒时，当天不发放每日/签到奖励，不弹警告

## 目录

```
game.js                 入口（require js/main）
game.json               小游戏配置（竖屏）
project.config.json     开发者工具配置；packOptions.ignore 已排除 docs/tools/README
docs/                   产品方案、生成算法、视觉规格（不打包）
levels/
  index.js              关卡索引：全局 1-based 序号、章节归属、稳定 ID → 序号
  pack-001.json         300 关源数据（紧凑字段，不打包）
  pack-001.js           小游戏加载包（同一份数据的 CommonJS 包装，勿手改）
  daily-365.json        365 道每日挑战源数据（312 T3 + 53 T4，不打包）
  daily-365.js          每日挑战加载包（勿手改，跨年复用）
js/
  main.js               启动 + 错误兜底
  app.js                装配：环境/布局/主题/渲染器/存档/场景栈/主循环
  core/                 logger clock hash rng event-bus ticker scene-manager format
  data/                 config theme cats copy
  domain/rules.js       规则判定：冲突、通关、答案校验（唯一真相）
  domain/solver.js      唯一解计数（构建期/运行时共用）
  domain/difficulty.js  人类技巧求解器、难度定档、布局规范签名
  domain/generate.js    生成管线（造解/生长/修补/定档；每日挑战可复用）
  platform/             env storage input lifecycle haptics（wx API 全在这里）
  services/             save progress settings levels daily signin collection
                        achievements shop
  ui/
    renderer.js         Canvas 底座（DPR、圆角、文字、离屏层）
    layout.js           所有界面布局（界面代码不写绝对坐标）
    draw.js             程序化占位美术（猫头/X/图标/波浪带），美术替换只改这里
    hit.js              命中测试
    widgets/toast.js    轻提示
    debug.js            调试浮层（首页版本号连点 5 次）
    screens/            home levelmap game result daily checkin album
                        achievements shop
tools/                  Node 侧工具（不打包）
  lib/generate.js       兼容转发到 js/domain/generate.js
  lib/base-200.json     旧 200 关基线（用于追加新关并保持 ID 稳定）
  gen-pack.js           正式 300 关生成 + 全量复验 + JSON/JS 产物
  gen-daily.js          365 道每日挑战日历池生成 + 全量复验
  batch-test.js         1000 关批量生成/验证统计
  gen-mini.js           旧命令兼容入口（转发 gen-pack）
  smoke-test.js         Node 冒烟测试（模拟 wx + Canvas 桩，260 项）
  build-preview.js      浏览器预览构建 → preview/（不打包）
```

## 常用命令

```bash
node tools/smoke-test.js          # 冒烟测试：关卡 / 交互 / 结算 / 存档 / S5 页面 / 小屏
node tools/gen-pack.js            # 生成 300 关正式包（JSON + JS）并全量复验
node tools/gen-pack.js --check    # 只复验正式包（唯一解/档位/去重/大小）
node tools/gen-daily.js           # 生成 365 道每日挑战日历池并全量复验
node tools/gen-daily.js --check   # 只复验每日池（唯一解/档位/与主线去重/大小）
node tools/batch-test.js 1000     # 至少 1000 关批量生成 + 独立复验统计
node tools/build-preview.js       # 生成 preview/index.html（浏览器预览，非小游戏包）
```

浏览器预览（无开发者工具时看真实 Canvas 效果，固定 375×812 / DPR2）：

```bash
open preview/index.html                     # 首页
open "preview/index.html?scene=map"         # 关卡地图
open "preview/index.html?scene=game&level=1"                 # 4×4 教学关
open "preview/index.html?scene=game&level=21"                # 5×5（第 2 章起手）
open "preview/index.html?scene=game&level=300"               # 9×9 专家关
open "preview/index.html?scene=game&level=1&demo=solve"      # 自动摆出答案 → 结算页
open "preview/index.html?scene=game&level=1&demo=marks"      # 答案 + 两个 X
open "preview/index.html?scene=game&level=1&demo=hint"       # 用一次提示再通关
open "preview/index.html?scene=game&level=1&demo=mistake"    # 放错再撤销，最后通关
open "preview/index.html?scene=game&level=1&demo=conflict"   # 造一行两猫冲突
open "preview/index.html?scene=map&demo=progress"            # 前 5 关已完成
open "preview/index.html?scene=daily"                        # 每日挑战
open "preview/index.html?scene=checkin"                      # 签到
open "preview/index.html?scene=album"                        # 猫咪图鉴
open "preview/index.html?scene=achievements"                 # 成就
open "preview/index.html?scene=shop"                         # 商店
```

`preview/` 是演示产物，已在 `packOptions.ignore` 中排除。

## 约定（改代码前先看）

- **数值/文案/颜色**：分别改 `js/data/config.js`、`js/data/copy.js`、`js/data/theme.js`，
  绘制代码里不出现字面 hex、字号、坐标。
- **美术替换**：`js/ui/draw.js` 的每个函数对应一个视觉元素。接入图集后，
  保持函数签名不变，把内部实现换成 `drawImage` 即可，业务代码零改动。
- **关卡数据**：只认 `levels/index.js` 的 1-based 序号；加包时在 `levels/index.js`
  的 `PACKS` 里追加 require。
- **存档**：所有写入走 `js/services/*`，它们会统一 `save.touch()`；
  防抖 800ms 落盘，切后台立即双写（主槽 + 备份槽）。
- **通关判定**：只看规则（`js/domain/rules.js`），不读关卡答案数组。

## 完成度

- [x] 核心玩法：4×4–9×9 棋盘、区域/行列/相邻实时判定、三态点击（X → 猫 → 空）、
      撤销、重开、提示、合法放置波纹、冲突红波纹 + 震动 + 原因提示
- [x] S1：目录骨架 / 三场景 / 场景栈、Canvas 分层（DPR≤2、静态棋盘离屏层）、
      规则判定、存档防抖双槽回退、唯一解关卡、小屏布局
- [x] S2：对局计时/步数/失误统计、提示（提示券 → 金币兜底）、通关庆祝与结算页、
      猫爪评分（1/2/3）、首通金币 + 完美加成、最佳用时、连续过关导航
- [x] S3：4×4–9×9 生成、唯一解求解器、人类技巧难度定档（T1–T5）、
      布局去重、200 关正式包（JSON 源 + JS 加载）、1000 关批量验证
- [x] S4：扩到 300 关 / 15 章并重排难度曲线、真实解锁链（`UNLOCK_ALL=false`）、
      地图章节锁与猫爪评分、中断续玩（盘面/用时/步数/失误/提示）、
      schema 2 旧档迁移（按稳定关卡 ID 重映射）
- [x] S5：每日挑战（365 道日历池 / 连胜 / 回拨止损）、7 日签到与补签、
      16 猫图鉴（解锁 / 出战 / 碎片合成）、9 个成就（手动领奖）、
      金币商店（提示券 / 补签卡 / 3 款棋盘皮肤）、schema 3 旧档迁移
- [ ] S6：激励视频广告（提示券 / 复活 / 双倍奖励）
- [ ] S7：设置页、音效与打磨

## S3 验证记录

- 200 关全部唯一解/合法/连通，布局规范签名无重复，档位 20/50/70/44/16。
- 关卡数据 23KB（JS 包装 24KB，低于 40KB 目标）；生成 200 关约 8 秒。
- `node tools/batch-test.js 1000`：1000/1000 唯一解，0 无解、0 多解入池、
  0 校验不合格，平均 33.0ms/关；期间拒收 156,586 个多解候选。

## S4 验证记录

- 300 关全部唯一解/合法/连通，布局签名无重复；档位 30/75/105/60/30，
  尺寸 4×4×9、5×5×58、6×6×90、7×7×104、8×8×24、9×9×15。
- 旧 200 关内容与 ID 原样保留，新增 100 关；全局按档位/尺寸/难度分重排，
  章节曲线为 T1 1–2 章、T2 2–6 章、T3 6–11 章、T4 11–14 章、T5 14–15 章。
- 关卡数据 35KB（JS 包装 35KB，低于 40KB 目标）；生成 100 关新增部分约 8 秒
  （实测 7.6–8.2s），全量复验 300 关 < 30ms（实测 15–27ms）；
  两次构建 SHA-256 一致，数据哈希 `d8d4feded5423e38`。
- 冒烟测试 130 项全绿：300 关/15 章、解锁链、续玩恢复、schema 1→2 迁移、
  章节锁与爪印、小屏布局、300 帧无异常。
- 旧档迁移：`completed` 按 L001…L200 稳定 ID 找回新序号，`unlocked` 取旧可玩
  前沿的最大新序号 +1，`lastLevel` 按 ID 映射；金币/券/统计/设置原样保留。

## S5 验证记录

- 每日挑战日历池：365/365 唯一解，T3 312 + T4 53，池内无重复且与 300 关主线
  布局签名无重复；复验 33ms；JSON 70KB，小游戏 JS 44KB。
- 每日取题：同一日期全设备同题；周日取 T4，工作日取 T3；跨年按池长度循环复用。
- 每日奖励：80 + 10×连胜（上限 +70），首通 1–2 碎片；同日重玩不发奖；
  回拨超过 60 秒仅封当天奖励与连胜，次日恢复。
- 签到：7 日循环、累计里程碑、漏 1 天补签（有卡且每自然周 ≤1 次）、漏多天归零；
  时间回拨时签到与每日共用同一守护。
- 图鉴：16 只猫阈值精确触发（1/30/60/90/120/150/180/210/240/270/300 关、
  签到 7、每日 7、成就 6、两只需要 3 碎片）；解锁后出战，棋盘与首页同步换装。
- 成就：9 条，达成只标记，领取才发金币/券，避免悄悄改变结算数值。
- 商店：金币购买提示券 45、补签卡 100、皮肤 300/500/800；余额不足有明确提示，
  任何购买路径都不会出现负数；当前皮肤按钮不会重复扣款。
- 存档：schema 2/1 → 3 迁移保留金币、券、通关记录、统计与皮肤；每日历史只留
  最近 31 天，未知猫/成就/皮肤与非法日期一律清洗；S5 状态 JSON 落盘后可完整重载。
- 冒烟测试 260 项全绿：S5 服务逻辑、五个页面完整流程、页面文案占位符、320×568 小屏布局、
  300 帧无异常；正式包 300 关复验 21ms；批量 1000 关全部唯一解（平均 32.6ms/关）；
  浏览器预览 51 个模块构建通过。
- 已知范围：广告、签到补签的广告补充、存档导入导出尚未接入（S6/S7）。
  真机帧率、触控与视觉细节仍需在微信开发者工具/真机确认。

## 未验证项

真机帧率与视觉细节需在开发者工具/真机确认；Node 冒烟测试只验证逻辑与布局坐标。
9×9 在 320×568 小屏格子约 24.6px，已过坐标检查，仍需真机触控确认。
