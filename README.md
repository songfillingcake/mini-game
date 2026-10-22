# 口袋游乐场 · Pocket Play

一个包含三款小游戏的轻量浏览器游戏项目：猫猫钓鱼（24 种鱼、4 个可解锁海域、每日天气与海域奇遇、奇遇限定鱼、委托与鱼影目标、可手动追踪已发现鱼种、鱼竿成长、鱼饵收集、收线徽章、鱼类尺寸评分与最大鱼获纪录、鱼友关系故事、最爱鱼收藏、可布置小鱼缸、猫猫配饰、鱼类小传、结算目标的一键续玩和可分享或保存的图鉴收藏卡）、会随时间切换路线景色的躲障碍，以及可选追星、弹簧或稳步路线、随高度进入云朵海与星光天际的弹跳闯关。

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

- Vite + TypeScript
- Canvas 2D 绘制游戏场景，HTML/CSS 实现大厅、HUD 和菜单
- `src/core/` 放置游戏接口、画布适配、主循环和本地记录
- `src/games/` 中每款游戏独立实现，统一由游戏大厅启动
- 每款游戏的最高分保存在浏览器 `localStorage`
- 猫猫钓鱼的鱼种收集、每日鱼影进度、委托奖励、鱼饵与海域偏好、四级鱼竿成长、最大鱼获尺寸、三种最爱收藏和鱼缸布景保存在浏览器 `localStorage`
- 大厅右上角可将本机存档导出为 JSON 文件，并在另一台设备导入；导入会替换当前浏览器的本地进度，网站不会上传存档
- 每种鱼会保存最高 1–3 星收线记录和最大尺寸；大个头鱼会获得尺寸加分，分享卡与鱼类小传也会展示尺寸等级
- 音效由浏览器合成，可在大厅或游戏界面切换，偏好保存在本机

键盘方向键或 A/D 可控制移动；触屏设备可以使用画面下方的方向按钮，也可以直接在画布上滑动。猫猫钓鱼支持点击或空格收竿，Esc 返回大厅，P 暂停。
