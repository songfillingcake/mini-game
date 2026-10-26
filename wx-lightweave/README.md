# 织光 · 微信小游戏

连线解谜：从一端拖到另一端，用彩色的线把整块夜园点亮。

这是**平台工程**，只放微信小游戏的入口与构建脚本。
玩法、关卡、渲染全部在 [`../shared/lightweave`](../shared/lightweave)，平台层在 [`../shared/engine`](../shared/engine)。

```
wx-lightweave/
├── game.json              小游戏配置（竖屏、隐藏状态栏）
├── project.config.json    微信开发者工具配置（记得换掉 appid）
├── src/entry/
│   ├── wx.ts              真机入口：new 一个 wx Host 就完事
│   └── web.ts             浏览器预览入口
├── scripts/
│   ├── build.mjs          esbuild → dist/wx/game.js
│   └── smoke.mjs          按正解自动通关第一关，验证规则与存档
└── dist/wx/               交给微信开发者工具的目录
```

## 命令

```bash
npm install

npm run dev      # 浏览器预览（http://127.0.0.1:5275）
npm run check    # 类型检查（连带检查 shared 包）
npm run levels   # 重新生成 72 关（种子固定，结果一致）
npm run build    # 产出 dist/wx/
npm run smoke    # 无头跑真实构建产物：自动通关第一关
```

产物大约 **180 KB**（game.js + 5 个音效 + 配置），主包上限 4 MB。

## 用微信开发者工具

1. 导入项目 → 选 `dist/wx`（有 `game.js` 和 `game.json` 的那一层）。
2. AppID 填自己的；没有就选测试号。`project.config.json` 里的 `touristappid` 是占位。
3. 模拟器里点第一关，按住一个光点拖到同色的另一个光点。

## 玩法速查

- 点亮全部颜色即过关；**所有格子被填满**才是完美（3 星）。
- 用「提示」会掉到 1 星，并扣 40 星屑。
- 星屑：首次通关 `10 + 星数 × 5`，重复通关只给 3。
- 第二章需要累计 10 颗星解锁，第三章 20 颗。

## 已知取舍

- **单向格暂未生成**：单向格会让「从另一端反向连线」无解，对玩家不公平。
  数据结构（`Level.arrows`）与渲染都已支持，等想清楚规则再放进关卡。
- 关卡的正解（`levels.json` 的 `solution`）会随包下发，只用于提示。
  单机休闲游戏可以接受；如果以后要做排行榜防作弊，需要改成运行时校验。
- `appid` 目前是 `touristappid`，提审前必须换成真实的。
