# 发布到 vivo 小游戏

> 本文按「第一次发布」的顺序写。已经配置过环境的可以跳到第 3 节。

## 0. 平台背景（先搞清楚你面对的是什么）

vivo 小游戏属于**快游戏联盟**（vivo / OPPO / 小米 / 荣耀统一技术标准）：

- 包格式是 `.rpk`，本质上是一个压缩包 + 签名。
- 运行时没有 DOM，能力通过全局 `qg` 命名空间提供（对齐微信小游戏的 `wx`）。
- 官方文档：<https://minigame.vivo.com.cn/documents/#/>
- 联盟统一文档（API 更全）：<https://gamedoc.quickapp.cn/>
- 体积限制：主包 ≤ 4 MB，主包 + 分包 ≤ 20 MB。本项目主包约 200 KB。

## 1. 工程结构

```
vivo-mini-game/
├── game/                 游戏源码（TypeScript，平台无关）
├── vivo/                 ← 交给打包工具的运行时工程
│   ├── package.json
│   ├── minigame.config.js
│   ├── src/
│   │   ├── manifest.json  ← 唯一需要手工维护的发布配置
│   │   ├── game.js        (生成)
│   │   ├── js/main.js     (生成)
│   │   ├── image/         (生成)
│   │   └── audio/         (生成)
│   └── sign/
│       ├── debug/         调试签名（自动化获取，可手工放入）
│       └── release/       正式签名（必须自己提供）
└── scripts/              构建 / 打包 / 冒烟测试
```

## 2. 环境准备

| 需要 | 说明 |
| --- | --- |
| Node.js ≥ 18 | 构建与冒烟测试 |
| npm 或 pnpm | 装依赖 |
| 手机 | 必须是 vivo 手机 |
| 快应用调试器 | <https://minigame.vivo.com.cn/documents/#/download/debugger> |
| vivo 小游戏引擎 | <https://minigame.vivo.com.cn/documents/#/download/engine>（平台版本尽量用新的） |
| ADB | 真机调试 / 推送 rpk |
| Chrome | 远程调试面板 |

## 3. 本地开发

```bash
cd vivo-mini-game
npm install

npm run dev      # 浏览器里预览，热更新
npm run check    # 类型检查
npm run smoke    # 无头跑真实构建产物，验证逻辑没坏
```

浏览器预览用的是 `game/platform/web.ts`（DOM 实现），
vivo 真机用的是 `game/platform/qg.ts`。**两边跑的是同一份玩法代码。**

## 4. 打包

### 4.1 一条命令

```bash
npm run publish:vivo
```

它做三件事：

1. `esbuild` 把 `game/entry/vivo.ts` 打成一个 IIFE 单文件 `vivo/src/js/main.js`；
2. 生成 `game.js`、192×192 图标、5 个 wav 音效；
3. 调用官方 `mg-service`（`mgs`）在 `vivo/` 目录打包，把 `.rpk` 拷到 `dist/vivo/`。

### 4.2 打包器从哪来

`scripts/pack-vivo.mjs` 按顺序找：

1. `node_modules/.bin/mgs`（你自己装过 `@vivo-minigame/cli`）；
2. `npx --yes -p @vivo-minigame/cli mgs build`（临时下载）。

> 首次打包会额外下载 vivo 的 **rpk 发布环境**（一个原生工具），需要联网且耗时较长，属正常现象。

如果命令行始终不可用，**用快游戏联盟 IDE 打开 `vivo/` 目录**同样可以打包，
因为 `vivo/` 就是一个标准工程（`manifest.json` + `src/` + `minigame.config.js`）。

### 4.3 签名

| 类型 | 位置 | 说明 |
| --- | --- | --- |
| 调试 | `vivo/sign/debug/` | 构建脚本会自动从官方模板取一份公开调试密钥 |
| 正式 | `vivo/sign/release/` | **必须自己提供** `certificate.pem` + `private.pem`，且不要提交仓库 |

正式签名在 vivo 开发者平台生成，一个公司/个人通常只需要一套，可以跨项目复用。

## 5. 真机验收

1. 手机安装「快应用调试器」和最新版「vivo 小游戏引擎」。
2. 把 `dist/vivo/*.rpk` 传到手机（数据线 / 微信文件传输助手都行）。
3. 调试器里点 **本地安装**，选中 rpk。
4. USB 连接电脑，`adb shell` 确认已授权。
5. 调试器里点 **开始调试**，然后在 PC Chrome 打开：

```
chrome-devtools://devtools/bundled/inspector.html?v8only=true&ws={手机IP}:5086/00010002-0003-4004-8005-000600070008
```

把 `{手机IP}` 换成手机在局域网里的地址（手机和电脑必须在同一网段）。

### 验收清单

- [ ] 首屏 3 秒内出现星球，没有任何加载条
- [ ] 单指按住能捏出凹陷，松手有回弹
- [ ] 多指同时按有多个凹陷
- [ ] 呼吸光环能被看见，窗口内按下有共振反馈
- [ ] 星尘数字会涨，切后台再回来不丢
- [ ] 连续捏 2–3 分钟能解锁第二款材质
- [ ] 材质栏能切换，未解锁的点了有提示
- [ ] 音效开关有效，静音后重进游戏仍是静音
- [ ] 有刘海 / 手势条的机型上，顶栏和材质栏都没被遮挡
- [ ] 连续玩 10 分钟机身不发烫、帧率稳定

## 6. 提审

1. **改版本号**：`vivo/src/manifest.json` 里的 `versionCode` 必须是正整数，
   且每次提审都要比上一次大（建议 +1）。`versionName` 是给人看的，随意。
2. **换正式签名**：把 `vivo/sign/release/` 换成自己的证书，然后**用 release 模式**打包。
3. **上传**：登录 vivo 开放平台 / 快游戏联盟后台，上传 `dist/vivo/*.rpk`，填写素材与资质。
4. **备案**：单机游戏签合同即可；联网游戏需要走统一备案流程。

### manifest 字段速查

| 字段 | 本项目值 | 说明 |
| --- | --- | --- |
| `package` | `com.pocketplay.squishyplanet` | 包名，`com.公司.项目` |
| `name` | `捏捏星球` | 6 个汉字以内，与后台保存的名称一致 |
| `versionName` | `1.0.0` | 版本名 |
| `versionCode` | `1` | 提审必增 |
| `minPlatformVersion` | `1030` | 支持的最小平台版本 |
| `icon` | `/image/logo.png` | 192×192 |
| `deviceOrientation` | `portrait` | 竖屏 |
| `type` | `game` | 固定 |

## 7. 常见问题

**Q：打包报错「找不到 rpk 发布环境」**
A：首次打包需要联网下载，检查网络后重试；或改用快游戏联盟 IDE 打包。

**Q：真机上黑屏 / 白屏**
A：先看 Chrome 远程调试的 Console 有没有异常。本项目产物不依赖 DOM，
如果报 `qg is not defined`，说明包被当成了网页而不是小游戏——检查 `manifest.json` 的 `type: "game"`。

**Q：有声音但很小 / 没有声音**
A：vivo 的 `InnerAudioContext` 需要正确的相对路径（本项目是 `/audio/xxx.wav`）。
确认 `vivo/src/audio/` 下的 wav 被打进了 rpk。

**Q：图标是旧的吗**
A：图标是构建期现算的，改 `scripts/gen-assets.mjs` 里的配色后重新 `npm run build` 即可。

**Q：能不能同时发微信小游戏**
A：可以。再写一个 `platform/wx.ts` 实现同一个 `Host` 接口，`game/` 一行都不用改。
