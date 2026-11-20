# 喵喵迷阵 · 项目长期开发规则

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
  规则为每行/列/区各 1 只，且任意两猫切比雪夫距离 > 1：上下左右与**斜角相邻**都不行，
  但同一条斜线上中间隔格的猫是合法的（不要误判为冲突）。
- 关卡：`levels/index.js` 是唯一索引入口（1-based 序号 + 章节 + 稳定 ID）；
  关卡包为生成产物，勿手改。旧存档迁移按「旧播放序号 → 旧稳定 ID → 新序号」，
  只认 `indexOfId`，不认数字序号；旧播放顺序快照在 `levels/legacy-order.js`。
- 数值 / 文案 / 颜色：分别改 `js/data/config.js`、`copy.js`、`theme.js`；绘制代码不写死 hex、字号、坐标。
- 存档：所有写入走 `js/services/*`（内部 `save.touch()` 防抖落盘、切后台双写）。
  对局续玩是单槽 `resume`（盘面/用时/步数/失误/提示次数，不含撤销栈），
  切后台与离开对局时保存，通关时清除；schema 版本为 4，旧档在 `save.normalize` 迁移。
- S5 服务：`daily.js`（日历池/连胜/回拨守护）、`signin.js`（7 日循环/里程碑/补签）、
  `collection.js`（图鉴解锁/出战/碎片合成）、`achievements.js`（只标记、手动领取）、
  `shop.js`（金币购买，不接支付）、`tutorial.js`（规则卡/新手保护判定）。
  业务时间统一走 `core/clock.now()`。
- 每日挑战：`levels/daily-365.json` 是源数据，游戏加载 `levels/daily-365.js`；
  365 道（312 工作日 + 53 周日）按本地日期取题，同一日期全设备同题，跨年复用；
  周日取周日池，其余取工作日池。池子角色固定，`t/d/b` 由新人类求解器重评；
  当前实际档位 `{T2:105,T3:234,T4:26}`。产物由 `tools/gen-daily.js` 生成，勿手改。
- 锁关：`progress.isUnlocked(index)` 是唯一准入判据（解锁前沿 `unlocked`）。
  `GameScene.enter` 与 `ResultScene._next` 都做守卫，地图只能向前切到章节起点已解锁的章节；
  新增进关入口必须走同一判据，不能只靠地图节点置灰。
- 区域配色：`theme.region` 只是 12 色候选池，实际取色由 `js/ui/region-colors.js`
  按区域相邻图（上下左右 + 斜角）+ CIELAB ΔE 确定性分配；绘制层只用
  `GameScene._regionColor`。皮肤必须保持多色相，禁止单色渐变；
  改色板后必须跑冒烟测试的“相邻区域色差 ≥ 30”断言。
- 美术替换边界：`js/ui/draw.js` 的每个绘制函数保持签名不变，内部可换成 `drawImage`。
- 平台 API 只出现在 `js/platform/*`，业务层不直接调 `wx.*`。
- 微信胶囊：`platform/env.js` 读 `wx.getMenuButtonBoundingClientRect()` 存入
  `env.menu`；所有自绘顶部内容（首页资源条、返回/帮助/签到/设置、规则卡与说明弹窗）
  统一从 `layout.topInset()` 起排，禁止再在 `safeTop` 处放右侧按钮；API 失败时
  退回 `safeTop + 8`。矮屏（h < 700）对局页头会压缩，保证棋盘格不缩水。
- 关卡生成（不打包）：`js/domain/generate.js` + `solver.js` + `human.js` + `difficulty.js`
  （运行时与 Node 工具共用）；`tools/gen-pack.js`（300 关产物，前 30 关装入
  `tools/lib/easy-30.json`，第 31–300 关沿用 `tools/lib/base-300.json` 内容与稳定 ID，
  只重算档位/分数）、`gen-easy.js`（前 30 关新曲线 → `tools/lib/easy-30.json`）、
  `gen-daily.js`（365 道日历池重评）、`batch-test.js`（批量验证）、`smoke-test.js`、
  `build-preview.js`。
- 新手曲线：第 1–3 关 4×4 预放 3/2/1 只猫（来自答案，运行时锁定不可删）；
  第 4 关不预放、`h` 高亮第一处必然格；第 5–10 关 4×4、第 11–30 关 5×5，
  全部零假设（`b=0`）。前 10 关提示免费，前 5 关首次违规温和提示；
  前 10 关无操作双击引导的等待时间从第 1 关 3 秒逐关放宽到第 10 关 10 秒，
  在下一处正确落子格显示“点两下”（已打叉则“点一下”）；
  连续 20 秒无操作给一次提示；新规则首次出现用规则卡分步说明（暂停计时）。
- 预放猫编码：紧凑字段 `g` 长度 n，第 r 行数字为该行预放列（`.` 不预放），
  必须来自唯一答案且互不同行/同区；`h` 为高亮格 0-based 下标。
- 正式关卡源数据 `levels/pack-001.json`，游戏加载 `levels/pack-001.js`；
  `levels/index.js` 解码 `r/s/g/h` 为 `regions/solution/givens/focus`。

## 验证命令

```bash
node tools/smoke-test.js          # 必须全绿
node tools/gen-easy.js --check    # 前 30 关：预放 3/2/1、高亮、零假设、唯一解、不倒挂
node tools/gen-pack.js --check    # 300 关唯一解/档位/去重/旧 ID 保留/教学槽位/大小校验
node tools/gen-daily.js --check   # 365 道日历池唯一解/档位/与主线去重/大小校验
node tools/batch-test.js 1000     # 批量生成/验证统计（至少 1000 关）
node tools/build-preview.js       # 视觉验收（可选，open preview/index.html）
```

## 当前阶段

- S1 工程底座、S2 对局闭环（计时/步数/猫爪、提示经济、结算页与金币奖励）、
  S3 内容管线（4×4–9×9、唯一解、人类技巧难度、去重、JSON/JS 包）、
  S4 解锁与续玩（300 关/15 章、真实解锁链、章节锁与爪印、中断续玩、旧档迁移）、
  S5 经济与收集（每日挑战、7 日签到与补签、16 猫图鉴、9 个成就、商店与棋盘皮肤）、
  S5.1 新手曲线重做（前 30 关预放猫/高亮/零假设、人类推演重评、规则卡与免费提示）、
  S5.2 首页视觉重制（更名《喵喵迷阵》、双色标题/猫咪舞台/名牌/立体主按钮/三色功能卡）、
  S5.3 阶段 1 画风底座（暖色令牌/粉彩区域板/无描边顶栏/场景转场/点按水波）、
  S5.3 阶段 2 猫咪形象 v3（16 只猫宽脸贴纸画风、耳形/眼神/嘴型/斑纹/配饰/配饰色、
  四种表情、结算页开心脸、小尺寸细节）、
  S5.3 阶段 2.1 猫咪形象 v4（正圆猫头、马卡龙低饱和配色、暖棕细线与深色猫浅描边、
  顶部柔光、矮圆折耳、三花双色斑块、大图渐变/小图平涂）、
  S5.3 阶段 3 对局页（标题+胶囊、两枚 HUD 胶囊、低对比图例、三卡规则条、
  白底内衬棋盘、落猫/打叉/冲突/通关动效、天蓝工具底座+三枚白胶囊）、
  S5.3 阶段 4 结算页（分段入场、逐爪盖章、数字滚动、最佳缎带、双层彩纸、
  金币放射、立体 CTA 与白卡次按钮）
  已完成；三态点击、撤销/重开/提示、实时冲突判定、放置反馈均已接入；
  冒烟测试 402 项全绿（含预放猫锁定、规则卡暂停计时、免费提示、3 页玩法说明、
  引导关双击提示 3–10s 递进、锁关与章节跳转拦截、区域配色色差、
  首页标题/舞台/按钮排布、对局页 HUD/规则条/工具胶囊层级与命中、
  X 书写动画时间戳、庆祝横扫、结算页分阶段入场/逐爪盖章/数字滚动/
  最佳缎带/双层彩纸、动效期间点击可用、五页文案占位符、小屏布局与微信胶囊避让、
  转场与点按水波、16 只猫六元组签名、正圆头形、11 种配饰与三花双色斑块），
  批量 1000 关全部唯一解。
- 画风底座真相：令牌集中在 `theme.js`（底色 `#F7F1E9`、暖棕文字 `#6E4A42`）；
  区域板向白色混入 12%，实测最小相邻 ΔE 32.9（断言 ≥ 30）。
  场景转场 `ui/transition.js` 为 200ms 淡入 + 1.5% 缩放，**只做视觉不锁输入**；
  全局点按反馈 `ui/widgets/touch-fx.js` 在 `SceneManager.onTouchStart` 触发；
  顶栏圆形按钮统一走 `draw.iconCircle`（白圆无描边），子页面标题用 `font.pageTitle`。
  子页面不再画背景色斑；首页色斑降到 38%。绘制代码禁止写死 hex。
- 猫咪形象真相：`data/cats.js` 每只猫带 `ear`（point/round/fold）、
  `eyes`（dot/sparkle/gentle/wide/happy/sleepy）、
  `mouth`（smile/w/open/tongue/line/pout/smirk/fang）、
  `pattern`（plain/blaze/tabby/muzzle/spot/calico；三花带 `patch2` 双色斑块）、
  `accessory`（bell/scarf/glasses/flower/tear/bow/star/leaf/collar/headphones/crown）
  与 `acc`（theme 颜色令牌名）；16 只猫六元组签名两两不同。
  头形为正圆（直径 2R），R = size × 0.37；
  不使用面罩/单眼补丁或白色大眼罩；深色脸自动用浅色实心眼 + 深色瞳孔，
  浅色脸用深色实心眼。底色统一为低饱和马卡龙（奶油白/浅粉/薄荷/淡黄/
  天空蓝/浅紫 + 橘/灰/炭等点缀），浅色猫轮廓走 `catLine` 暖棕细线，
  深色猫自动换浅色轮廓，线宽统一 `0.065R`。
  `draw.catFace` 签名不变，内部按参数绘制，`opts.expression` 支持
  normal/happy/surprised/sleepy（未知值回退 normal；缺参数回退
  point/dot/smile/plain/无配饰）。结算页传 happy；
  光影为左上柔光 + 下半脸浅阴影：大图（size > 64）用一次径向/线性渐变，
  棋盘小图用平涂，禁止为每只棋盘猫创建渐变；斑纹压在光影之上。
  共用 `theme` 的 `catInk/catLine/catNose/catBlush/catInner/coinFace/coinDeep/cta`
  等令牌，禁止在猫脸绘制里新增写死颜色。猫头约 28px 时仍保留耳朵、眼睛与配饰，
  新增猫必须补齐外观参数并跑冒烟。樱井为三花：`calico` + 双色 `patch2`，
  斑块避开眼睛。
- 对局页真相：`layout.game(n)` 产出 `hud`（progress/time 两枚白胶囊）、
  `legend`（低对比辅助行）、`rules`（始终三块等宽文字卡，`cardW/gap`）、
  `board.inset`（3×s 奶油内衬）、`bandPaws`（淡爪印纹理）与 `tools[].capsule`；
  矮屏 h<700 时页头 46、HUD 26、图例 16、规则条 44（8/9 路 30）、工具高 38。
  工具命中必须用 `hit.inRect(x,y,t.capsule)`，不能退回圆心；提示券徽标在胶囊右上角。
  规则条高亮只认 `_activeRule()` → `tutorial.ruleStripIndex()`（第 3 关 `region`→第 1 卡、
  第 2 关 `rowcol`→第 2 卡，其余常态；每日挑战不套用），
  规则卡关闭后本关仍保持高亮，不要在渲染层另写映射。
  落猫/打叉时间戳只用 `popAt`/`markAt` 驱动动画（X 两笔 180ms、落猫挤压回弹、
  最后一猫 420ms 高亮）；`domain/rules` 仍是判定唯一真相。
  通关先由 `celebrateT` 播放金圈呼吸 + 0.7s 棋盘扫光，`settleDelay` 结束才进结算。
  HUD 进度用色区去重计数；颜色只用 `theme.successSoft/success/band/bandDeep/
  bandShadow/shadowSoft/shadowSofter` 等令牌，禁止写死 rgba。
- 难度曲线：前 30 关为 `E001`–`E030`，4×4（1–10）/ 5×5（11–30），全部 T1、b0、
  零假设；难度分 4/6/12/28/32（4×4）与 35/38（5×5）；第 4 关高亮第一处必然格。
  档位实产 30/97/131/24/18，尺寸 4×4×10、5×5×57、6×6×90、7×7×104、8×8×24、9×9×15；
  数据哈希 `1494a0842ce50d84`。
- 新手引导：`guide` 场景首次启动自动弹出，以 3 页弹窗覆盖当前场景
  （下层画面保留并压暗）；关闭后写 `guideSeen`（存档，不清零进度）；
  首页与对局右上角 `?` 可随时重开。界面内的操作提示以
  “单击打叉 → 再点放猫 → 再点清空”为准。
- 规则卡：`services/tutorial.js` 按关卡/盘面生成规则卡（given/rowcol/region/focus/
  freehint/mark/bigboard），`coachSeen` 记已读；显示期间暂停计时并拦截输入。
- 预放猫：`GameScene` 开局写入 `givens`，点击/撤销/重开/续玩都保持锁定；
  失误判定与结算仍只走 `domain/rules`，不读答案。
- 触感：全部点击不调用 `wx.vibrateShort`；`platform/haptics.js` 仅保留封装，当前无调用方。
- 结算真相：`GameScene._settle()` 用 `domain/rules` 二次校验后调
  `progress.completeLevel()`；奖励参数在 `js/data/config.js`（`LEVEL_COINS`、
  `LEVEL_PERFECT_BONUS`、`HINT_COIN_COST`、`RESULT_DELAY`）。
  `ResultScene` 的入场阶段常量在文件顶部 `STAGE`（猫 0 / 标题 0.09 / 猫爪 0.18 /
  数据 0.42 / 奖励 0.54 / 按钮 0.66，单段 120ms），**只做视觉、不锁输入**；
  猫爪逐枚盖章由 `_pawK(i)` 驱动，数字滚动 `ROLL_TIME = 0.36s`；
  彩纸固定 24 片（远 10 + 近 14），金币放射为一次性时间函数、不累积粒子。
  最佳缎带锚点来自 `layout.result().stats.ribbon`，主按钮立体深度来自 `ctaDepth`。
- 解锁真相：`config.UNLOCK_ALL = false`；`progress.completeLevel()` 把
  `unlocked` 推进到 `index + 1`，`progress.isUnlocked()` 只认该前缀。
  难度档位 T1–T5 数量 30/97/131/24/18，共 15 章，章内先小后大、同档按逻辑分递增。
- 锁关与配色：解锁前沿外的关卡在任何入口都进不去（地图、代码入口、结算“下一关”）；
  地图只能切到已解锁章节。区域配色从“编号直接映射”改为“按相邻关系分配”，
  300 关 × 4 套皮肤实测最小相邻 CIELAB ΔE 为 32.9（断言 ≥ 30）。
- S5 真相：每日奖励 `DAILY_BASE_COINS + 10×连胜`（上限 +70），同日重玩不发奖；
  回拨超过 60s 只封当天奖励/连胜（`daily.timeGuardDate`），不封号。
  签到第 3 日发券、第 7 日发券+碎片，累计 7/14/30/60/100 天发里程碑；
  补签仅限漏 1 天、有卡、每自然周 1 次。成就只标记，奖励必须手动领取；
  图鉴 16 只按通关/签到/每日/成就/碎片精确解锁；棋盘皮肤只换区域配色，无数值加成。
- S5.1 迁移真相：旧前 30 关被新曲线替换，迁移时不把旧通关记录挂到新题面，
  只保证新前 30 关可进入；旧第 31–300 关按 `legacy-order` 快照找回稳定 ID 后映射，
  `unlocked` 取映射后的最大新序号 +1（至少 31），`lastLevel`/`resume` 同规则；
  schema 4 新增 `coachSeen`，只白名单已知规则卡 ID。
- 下一步 S6：激励视频广告（提示券 / 双倍奖励 / 补签），仍须保持断网可玩。
- 已知待办：首页齿轮仍是阶段性占位（toast 提示），计划 S7 接入真实设置页；
  提示券已可通过签到、里程碑、商店与成就获取，广告途径留待 S6。
