# 捏捏星球 · 微信小游戏

这是**平台工程**，只放微信小游戏的适配层和构建脚本。
玩法、渲染、存档全部在 [`../shared/squishy-planet`](../shared/squishy-planet)，改一次两个平台同时生效。

```
wx-mini-game/
├── game.json              小游戏配置（竖屏、隐藏状态栏）
├── project.config.json    微信开发者工具配置（记得换掉 appid）
├── index.html             浏览器预览入口
├── src/
│   ├── platform/wx.ts     ← 唯一的平台适配：wx.createCanvas / onTouch* / Storage / InnerAudio
│   ├── entry/wx.ts        ← 真机入口
│   └── entry/web.ts       ← 预览入口
├── scripts/
│   ├── build.mjs          esbuild → dist/wx/game.js
│   └── smoke.mjs          无头冒烟测试
└── dist/wx/               交给微信开发者工具的目录
```

## 命令

```bash
npm install

npm run dev      # 浏览器预览（http://127.0.0.1:5274）
npm run check    # 类型检查（会连带检查 shared 包）
npm run build    # 产出 dist/wx/
npm run smoke    # 在 Node 里跑真实构建产物，验证玩法没坏
```

`npm run build` 的产物：

```
dist/wx/
├── game.js               55 KB   小游戏入口（esbuild 单文件）
├── game.json             340 B
├── project.config.json
└── audio/                127 KB  5 个音效
                          合计约 182 KB（主包上限 4 MB）
```

## 用微信开发者工具跑起来

1. 打开微信开发者工具 → **导入项目** → 目录选 `dist/wx`。
2. AppID 处填你自己的小游戏 AppID；没有就选「测试号」。
   （`project.config.json` 里的 `touristappid` 只是占位，提审前必须换掉。）
3. 模拟器里应该直接看到星球，按住就能捏。

### 真机预览

工具右上角 **预览** → 手机微信扫码。注意：

- 预览要求 AppID 与登录账号有绑定关系；
- 真机首帧比模拟器慢，属正常；
- 想连 Chrome DevTools，用工具栏的 **真机调试**。

## 上传与提审

1. `project.config.json` 里换成真实 `appid`，并确认 `compileType` 是 `game`。
2. 工具右上角 **上传**，填版本号与备注。
3. 登录 <https://mp.weixin.qq.com> → 版本管理 → 提交审核。
4. 小游戏类目需要相应资质（软著、类目许可），首次上线前先在小程序后台「设置 → 基本设置」补齐。

### 体积限制

| 项 | 上限 | 本项目 |
| --- | --- | --- |
| 主包 | 4 MB | 约 182 KB |
| 主包 + 分包 | 20 MB | 未使用分包 |

还有很大余量，后续加素材不需要立刻考虑分包。

## 和 vivo 工程的区别

| | vivo (`vivo-mini-game`) | 微信 (`wx-mini-game`) |
| --- | --- | --- |
| 全局对象 | `qg` | `wx` |
| 入口 | `src/game.js`（`import` 打包产物） | `game.js`（直接就是打包产物） |
| 配置 | `manifest.json`（包名 / 版本 / 图标） | `game.json` + `project.config.json` |
| 打包 | 多一层官方 `mg-service` → `.rpk` | 开发者工具直接吃目录 |
| 音频路径 | `/audio/xxx.wav` | `audio/xxx.wav`（相对包根目录） |

适配层代码两百行不到，因为 `Host` 接口把差异全挡住了。

## 常见问题

**Q：导入后提示「不是合法的 game.json」**
A：确认导入的是 `dist/wx` 目录（有 `game.js` 和 `game.json` 的那一层），不是仓库根。

**Q：模拟器白屏**
A：先看 Console。如果报 `wx is not defined`，说明导入目录选错了或者 `compileType` 不是 `game`。

**Q：真机没有声音**
A：小游戏首帧不允许自动播放，本项目所有音效都由触摸触发，正常情况不会有问题；
若个别机型仍无声，先确认 `audio/` 目录确实在包里。

**Q：想改玩法数值**
A：改 `shared/squishy-planet/src/game/` 下的文件，两个平台重新 `npm run build` 即可。
存档格式变了记得同步 `save.ts` 里的 `version` 和 `sanitize()`。
