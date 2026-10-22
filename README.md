# 口袋游乐场 · Pocket Play

一个包含六款游戏的浏览器游乐场：新增《星岛自走棋》单人策略远征，同时保留猫猫钓鱼和四款轻松挑战。

| 游戏 | 玩法 |
| --- | --- |
| 星岛自走棋 | 12 名伙伴、4 种羁绊、三合一升星、布阵与自动战斗、金币经营、三选一奖励和 8 关远征 |
| 猫猫钓鱼 | 4 个海域、24 种鱼、天气与昼夜、岸边相遇、收线挑战、图鉴与鱼友故事、鱼竿成长和猫猫配饰 |
| 躲障碍 | 三种路线、贴边闪避、连续捡星，随着时间切换沿途景色 |
| 弹跳闯关 | 追星、弹簧与稳步路线，预判平台并连续向上攀登 |
| 贝壳消消乐 | 限时三消、星星贝壳、连锁奖励、停留提示与无步数自动换盘 |
| 云朵叠叠乐 | 一键对齐叠塔、两种节奏、完美连击补宽、暮光与星空阶段 |

## 本地启动

建议安装 Node.js 24（与 GitHub Pages 自动构建版本一致）。项目用 pnpm 管理依赖。

```bash
corepack pnpm install
corepack pnpm run dev
```

如果 PowerShell 提示 `node`、`npm` 或 `corepack` 无法识别，请先安装 Node.js，再关闭并重新打开终端。可先运行 `node -v` 确认安装成功。

Node.js 25 及更新版本不再自带 Corepack；如使用这些版本且没有 `corepack`，可运行 `npm install --global pnpm@11.25.0`，再将上面的 `corepack pnpm` 改为 `pnpm`。参见 [Node.js Corepack 说明](https://nodejs.org/api/corepack.html)。

生产构建：

```bash
corepack pnpm run build
```

## 发布到 GitHub Pages

仓库已包含自动部署工作流。将改动提交并推送到 `main` 后，在 GitHub 仓库中打开 **Settings → Pages**，将 **Build and deployment → Source** 设为 **GitHub Actions**。工作流会构建并发布 `dist/`，成功后网站地址为 `https://songfillingcake.github.io/mini-game/`。之后每次推送到 `main` 都会自动更新。

## 技术结构

现有玩法与数量见 [功能总览](FEATURES.md)，最近一轮交付与检查记录见 [迭代记录](ITERATION_LOG.md)。

- Vite + TypeScript
- Canvas 2D 绘制游戏场景，HTML/CSS 实现大厅、HUD 和菜单
- `src/core/` 放置游戏接口、画布适配、主循环和本地记录
- `src/games/` 中每款游戏独立实现，统一由游戏大厅启动
- 每款游戏的最高分保存在浏览器 `localStorage`
- 贝壳消消乐每局 60 秒；交换相邻物件组成三消，四连生成星星贝壳，连锁消除可获得额外分数；180、450、850 分分别获得潮池星级，结算会提示下一局目标
- 云朵叠叠乐可点击画面、使用“放下云朵”按钮或按空格；连续三次完美落点可以恢复云宽，10 层和 20 层进入新天空。提供软云慢游与风之高塔两种节奏，最高分也纳入存档备份
- 游戏界面会铺满浏览器动态视口；右上角“全屏”按钮可切换浏览器全屏，画布保持 16:9 比例并居中显示，窄屏下 HUD、菜单、触控按钮和画布文字更易读。Esc 可退出全屏或返回大厅
- 猫猫钓鱼的五种每日天气会改变鱼群与操作手感，三段潮汐会推动水位和浮标升降；鱼种收集、每日鱼影进度、委托奖励、六种鱼饵与海域偏好、四级鱼竿成长、最大鱼获尺寸、三种最爱收藏和鱼缸布景保存在浏览器 `localStorage`
- 大厅右上角可将本机存档导出为 JSON 文件，并在另一台设备导入；导入会替换当前浏览器的本地进度，网站不会上传存档
- 当前导出格式为 v4，兼容导入 v1/v2/v3；旧备份没有的新游戏纪录和自走棋进度会保留当前浏览器的值
- 自走棋使用按需加载的 Three.js 3D 棋盘，首批包含盾卫、弓手和法师三种角色造型，支持旋转缩放及二维回退；战斗模型独立，准备与领奖阶段自动存档，战斗中断会回到出战前。操作与规则见 [自走棋说明](AUTOCHESS.md)
- 每种鱼会保存最高 1–3 星收线记录和最大尺寸；大个头鱼会获得尺寸加分，分享卡与鱼类小传也会展示尺寸等级
- 音效由浏览器合成，可在大厅或游戏界面切换，偏好保存在本机

键盘方向键或 A/D 可控制移动；触屏设备可以使用画面下方的方向按钮，也可以直接在画布上滑动。猫猫钓鱼支持点击或空格收竿，Esc 返回大厅，P 暂停。

## 后台检查

```bash
pnpm run check:fishing
pnpm run check:gameplay
pnpm run check:autochess
pnpm run check:autochess-ui
pnpm run check:autochess-3d
pnpm run build
```

钓鱼检查使用内存模拟数据。游玩检查需要 Playwright 和可用的 Chromium/Chrome/Edge；脚本会创建独立的无界面浏览器、临时存储和临时端口，并在结束时关闭。不会连接已打开的浏览器、访问玩家存档或占用现有开发端口。

如果 Playwright 已安装在其他目录，可以设置 `QA_NODE_MODULES` 指向该目录的 `node_modules`，并按需通过 `QA_CHROMIUM_EXECUTABLE` 指定浏览器程序。`QA_ARTIFACT_DIR` 可指定检查截图输出目录，默认使用系统临时目录。
