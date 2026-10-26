# @pocket-play/squishy-planet

捏捏星球的**平台无关核心**。vivo 小游戏、微信小游戏、H5 预览跑的都是这一份代码。

```
src/
├── index.ts            对外 API
├── browser.ts          浏览器挂载入口（各平台工程的 npm run dev 用）
├── core/               数学 / 颜色 / Canvas 绘制工具
├── platform/
│   ├── types.ts        ★ Host 契约
│   └── web.ts          浏览器实现（唯一一份）
├── audio/
│   ├── innerAudio.ts   小游戏 InnerAudioContext 轮播池（vivo / 微信通用）
│   └── webAudio.ts     WebAudio 现场合成（预览用）
└── game/               玩法：软体、星球、粒子、背景、HUD、材质、存档
tools/
├── png.mjs             手写 PNG 编码器
├── wav.mjs             音效合成
├── icon.mjs            图标现算
├── harness.mjs         无头冒烟测试（假平台 API + 真构建产物）
└── index.mjs
```

## Host 契约

平台工程唯一要实现的接口：

```ts
interface Host {
  readonly ctx: CanvasRenderingContext2D;
  readonly storage: StoragePort;   // read / write
  readonly audio: AudioPort;       // play(name, intensity) / setEnabled
  readonly haptics: HapticsPort;   // tap(intensity)
  beginFrame(): Viewport;          // 同步画布尺寸 + 设设计坐标变换 + 清屏
  bindInput(sink: InputSink): void;// 把触摸换算成设计坐标后回调
  loop(step: (dt, now) => void): void;
}
```

约定：

- 坐标一律以 **750 宽的设计空间** 交给游戏，缩放由 Host 自己乘；
- `beginFrame()` 返回的 `Viewport` 里，`insetTop` / `insetBottom` 必须是设计坐标下的安全区；
- `dt` 由 Host 钳制到 ≤ 50 ms，游戏层不再重复处理切后台；
- `audio.play()` 在关闭音效或资源缺失时应该是静默 no-op，不能抛错。

## 新增一个平台（约 200 行）

1. 抄一份 `wx-mini-game/src/platform/wx.ts`，把 `wx.` 换成目标平台的命名空间；
2. 写入口：`startSquishyPlanet(createXxxHost(api))`；
3. 打包成一个 `game.js`（esbuild `format: 'iife'`），把音效放到包内。

`game/` 一行都不用动。

## 工具链复用

平台工程的构建脚本直接引这里的东西，避免每个平台各写一份：

```js
import { renderIcon, renderSound, SOUND_NAMES } from '@pocket-play/squishy-planet/tools';

await writeFile('dist/wx/audio/press.wav', renderSound('press'));
await writeFile('dist/wx/icon.png', renderIcon(192));
```

冒烟测试同理：

```js
import { runSmoke } from '@pocket-play/squishy-planet/tools';

await runSmoke({ bundlePath: 'dist/wx/game.js', apiName: 'wx', label: '微信小游戏' });
```

它会用假的平台 API 拉起真实构建产物，跑 800 帧、模拟按压与共振、校验存档与解锁。

## 约定

- 这个包**不允许**出现任何平台专有 API（`wx` / `qg` / `document` 只能在 `platform/web.ts` 里出现）。
- 不要在这里写构建脚本或平台配置——那些属于平台工程。
- 存档结构变更时同步改 `save.ts` 的 `version` 与 `sanitize()`，旧档要能平滑升级。
