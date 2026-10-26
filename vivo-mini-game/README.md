# 捏捏星球 · Squishy Planet

一款 vivo 小游戏：**没有失败、没有倒计时**，按住一颗软软的星球揉一揉，听它弹回来。
本目录是一个**完全独立的子工程**，与仓库根目录的 Web 游戏厅互不引用、互不干扰。

```
包名      com.pocketplay.squishyplanet
名称      捏捏星球（4 个汉字，满足 vivo「6 个汉字以内」的限制）
方向      竖屏 portrait
引擎      原生 Canvas 2D + TypeScript，零运行时依赖
体积      vivo 运行时工程约 200 KB（游戏代码 51 KB + 图标 21 KB + 音效 130 KB）
```

---

## 1. 为什么是「解压」

vivo 小游戏的用户场景是碎片时间、竖屏、单手持机。仓库里已有的六款游戏（自走棋、钓鱼、躲避、弹跳、消消乐、叠叠乐）都是**目标驱动**的：有分数、有失败、有压力。

「解压」类目正好补上空位：用户不需要学习规则，打开就能捏，随时退出不心疼。它的设计约束也随之变得非常清晰：

| 约束 | 设计对策 |
| --- | --- |
| 首屏 3 秒内必须能玩 | 没有登录、没有主菜单、没有加载条，直接进星球 |
| 触屏、单手、竖屏 | 唯一的主动作是「按住」，任何位置都能按 |
| 不能有挫败感 | 没有失败态、没有倒计时、没有体力 |
| 包体要小、启动要快 | 全部程序化绘制，唯一的位图是 192×192 图标 |
| 要能反复回来 | 星尘 / 材质解锁 / 每日小目标 |

## 2. 玩法

**核心循环（3 秒理解，无限重复）**

```
按住星球 → 软体凹陷 + 星尘飘散 + 音高反馈 + 震动 → 松手回弹 → 攒星尘
```

- **捏**：按压会把星球局部压下去，松手回弹并带一点晃动。多指同时按会捏出多个凹陷。
- **呼吸共振**（唯一的技巧点）：星球每 3.6 秒「呼吸」一次，一圈光环从表面荡开。
  在光环走到后半段（周期的 58%–78%）时按下，触发**共振**：+8 星尘、更强的光效与音效、轻微震动。
  没有按中也没有任何惩罚——只是少拿一点。
- **材质**：星尘累积解锁 5 种星球材质。它们不只是换色，**弹性与阻尼参数不同**，手感真的有差别：

| 材质 | 解锁星尘 | 手感 |
| --- | --- | --- |
| 蜜桃奶冻 | 0 | 标准软糖 |
| 薄荷云朵 | 150 | 更软更慢，回弹拖沓 |
| 星海果冻 | 450 | 更硬更脆，弹得快 |
| 落日布丁 | 900 | 偏厚实，阻尼大 |
| 极光沙沙 | 1600 | 最软，像捏一团沙 |

- **每日小目标**：按日期稳定派生（单日「轻捏 N 下」，双日「呼吸共振 N 次」），完成给星尘。
  纯本地计算，不需要服务端，也不需要联网。

## 3. 技术框架

### 3.1 分层

> **2024 结构调整**：平台无关的玩法核心已抽到 [`../shared/squishy-planet`](../shared/squishy-planet)，
> 本工程现在只保留 vivo 适配层与构建脚本，与 `wx-mini-game/` 共享同一份玩法代码。

```
vivo-mini-game/
├── src/
│   ├── platform/qg.ts      ← 唯一的平台适配：qg.createCanvas / onTouch* / Storage / InnerAudio
│   ├── entry/vivo.ts       ← 真机入口
│   └── entry/web.ts        ← 预览入口
├── vivo/                   ← 交给 mg-service 的运行时工程（manifest + 生成物 + 签名）
├── scripts/                构建 / 打包 / 冒烟测试
└── (玩法实现在 ../shared/squishy-planet/src/game/)
```

共享包里的内容：

```
shared/squishy-planet/src/
├── index.ts           对外 API
├── browser.ts         浏览器挂载入口
├── core/              数学 / 颜色 / 绘制工具
├── platform/          Host 契约 + 浏览器实现
├── audio/             InnerAudioContext 轮播池 / WebAudio 合成
└── game/              软体、星球、粒子、背景、HUD、材质、存档
```

**关键点：游戏逻辑一行平台代码都没有。** 所有差异收敛在 `Host` 这一个接口里：

```ts
interface Host {
  ctx: CanvasRenderingContext2D;
  storage: StoragePort;
  audio: AudioPort;
  haptics: HapticsPort;
  beginFrame(): Viewport;   // 同步尺寸 + 设置设计坐标变换 + 清屏
  bindInput(sink: InputSink): void;
  loop(step: (dt: number, now: number) => void): void;
}
```

同一份玩法代码，浏览器预览用共享包里的 `platform/web.ts`，vivo 上用 `platform/qg.ts`。
新增一个平台（例如微信小游戏）只需要再写一个 Host 实现，玩法代码零改动。

### 3.2 坐标与适配

- 设计坐标固定 **750 宽**，高度随设备比例变化（`750 × 屏高 / 屏宽`）。
- Host 在 `beginFrame()` 里把变换设为 `scale(dpr × cssWidth/750)`，于是游戏层直接用设计坐标绘制。
- 触摸坐标反向换算，安全区（`safeArea` / `statusBarHeight`）也在 Host 内换算成设计坐标后给出。
- 结果：同一套布局在 16:9 到 21:9 的屏幕上都不会被刘海或手势条盖住。

### 3.3 软体算法

`Jelly` 是一圈 **132 个节点**的环形软体：

1. 每个节点有静止半径 `R`、当前半径、速度。
2. 按压时按角度把附近节点的**目标半径**压下去（高斯权重，σ = 0.44 rad），而不是施加冲量——这样凹陷会稳定地跟着手指，不会抖动。
3. 每帧做一次半隐式欧拉积分：`a = -k(r - target) - c·v`。
4. 再做一次邻接平滑（系数 0.24），消除凹陷两侧的尖角。
5. 松手时给一个向外的冲量，形成回弹晃动。

180 个粒子 + 132 个节点全部用 `Float32Array`，运行期零对象分配，中端机稳定 60fps。

### 3.4 渲染

纯 Canvas 2D，**不使用 `ctx.roundRect` / `ctx.ellipse` / `ctx.filter`**（quick game 的 canvas 实现不一定支持），
圆角、椭圆、星芒、闭合平滑轮廓全部手写路径。

- 轮廓：节点中点 + `quadraticCurveTo` 连成平滑闭合曲线。
- 体积：径向渐变 + 底部线性内阴影 + 凹陷处径向暗部。
- 表情：被捏时眯眼、眨眼、眼珠跟随手指、随舒适度变化的笑弧。
- 渐变对象按「材质 + 半径 + 位置」缓存，避免每帧新建。

### 3.5 存档

| 项 | 值 |
| --- | --- |
| key | `squishy-planet/save/v1` |
| 内容 | 星尘、材质、已解锁列表、音效开关、累计按压/共振、每日进度、新手提示 |
| 写入 | 事件置脏 + 每 3 秒节流落盘 |
| 容错 | 读取时逐字段校验并夹取范围；损坏则回退默认档，不崩 |

## 4. 一键发布

### 4.1 命令

```bash
npm install            # 只装本子工程的依赖
npm i -D @vivo-minigame/cli   # 可选：安装官方打包器，让 pack / publish 在本机直接可用

npm run dev            # 浏览器预览（http://127.0.0.1:5273）
npm run check          # TypeScript 类型检查
npm run build          # 生成 vivo 运行时工程 → vivo/src/
npm run pack           # 调用官方打包器 → dist/vivo/*.rpk
npm run publish:vivo   # build + pack 一步到位（一键发布）
npm run smoke          # 无头冒烟测试（在 Node 里跑真实构建产物）
```

`publish:vivo` 的输出：

```
=== 捏捏星球 · vivo 小游戏一键发布 ===
✔ vivo 运行时工程已就绪
✔ dist/vivo/com.pocketplay.squishyplanet.rpk  0.21 MB
```

### 4.2 构建流水线

```
src/entry/vivo.ts
      │ esbuild（iife · es2017 · 单文件）
      ▼
vivo/src/js/main.js ──┐
vivo/src/game.js ─────┤  (import './js/main.js')
vivo/src/manifest.json┤  (手写，唯一需要维护的发布配置)
vivo/src/image/*.png ─┤  构建期由 shared/tools 现算
vivo/src/audio/*.wav ─┘
      │ mg-service / mgs（官方 @vivo-minigame/cli）
      ▼
vivo/build/ + vivo/dist/*.rpk → dist/vivo/
```

- **图标和音效都是现算的**：`shared/squishy-planet/tools/png.mjs` 是手写 PNG 编码器，
  `tools/wav.mjs` 用振荡器合成音效。仓库里没有任何二进制资源，改配色就是改代码。
- 首次打包会自动获取官方模板里的**调试签名**（公开密钥，仅真机调试可用）；
  正式包必须在 `vivo/sign/release/` 放自己的证书。

### 4.3 提审清单

1. 改 `vivo/src/manifest.json` 的 `versionCode`（每次提审必须 +1，正整数）。
2. 把 `vivo/sign/release/{certificate.pem,private.pem}` 换成自己的正式签名。
3. 在 vivo 开放平台 / 快游戏联盟上传 `dist/vivo/*.rpk`。

详细步骤见 [docs/publish.md](docs/publish.md)，玩法与数值见 [docs/design.md](docs/design.md)。

## 5. 目录隔离约定

这个子工程是**有意做成「仓库里的另一个项目」**的：

| 维度 | 仓库根（Web 游戏厅） | 本子工程 |
| --- | --- | --- |
| 依赖 | 根 `package.json` + 根 `node_modules` | 自己的 `package.json` + 自己的 `node_modules` |
| 类型 | 根 `tsconfig.json`（`include: ["src"]`） | 自己的 `tsconfig.json`（`include: ["src"]`） |
| 构建 | Vite，产物 `dist/` | esbuild + mgs，产物 `vivo/build`、`dist/vivo` |
| 运行时 | 浏览器 DOM | qg 小游戏运行时 |
| 代码 | 不 import 子工程 | 不 import 仓库根 |

硬性规则：

1. **禁止跨目录 import**。本工程的 `src/` 只能引用 `@pocket-play/squishy-planet`，不能出现 `../../src/...`。
2. **禁止共享 node_modules**。本目录有自己的 `pnpm-lock.yaml`；
   即使 Node 的模块解析可能向上找到仓库根的依赖，也应当 `npm install` 后再构建，保证可复现。
3. **禁止共享构建产物**。`vivo/` 只认自己的 `manifest.json` 和 `minigame.config.js`。
4. 根目录的 `tsc --noEmit` 与 `vite build` 不会扫描到这里（`include` 与 Vite 入口都已限定）。

接入新平台时，开一个同级目录、只写适配层，玩法统一走共享包：

```
mini-game/
├── src/                      # 现有 Web 游戏厅
├── shared/squishy-planet/    # 平台无关玩法 + 工具链（唯一真相）
├── vivo-mini-game/           # vivo 平台工程（已暂停）
│   ├── src/platform/qg.ts    #   适配层
│   └── vivo/                 #   vivo 运行时工程
└── wx-mini-game/             # 微信小游戏平台工程
    ├── src/platform/wx.ts    #   适配层
    └── dist/wx/              #   开发者工具导入目录
```

## 6. 已验证

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit`（strict + noUnusedLocals） | 0 error |
| esbuild 打包 | 54.8 KB |
| 无头冒烟测试（真实构建产物 + 模拟 qg 运行时） | 800 帧无异常，按压/共振/存档/解锁全部通过 |
| 产物对 DOM 的依赖 | `grep document\.\|window\.` → 无命中，可在纯 qg 环境运行 |
| 包体 | 运行时工程约 200 KB，远低于主包 4 MB 上限 |

## 7. 已知限制

- **视觉手感需要在真机上微调**。软体刚度、音高、光环窗口宽度都是经验值，
  建议用「快应用调试器 + Chrome 远程调试」在目标机型上再校准一轮。
- **rpk 打包依赖官方工具链**，首次打包会下载 vivo 的 rpk 发布环境，需要联网。
  命令行不可用时，用快游戏联盟 IDE 打开 `vivo/` 目录同样可以打包。
- 目前只有中文文案；vivo 提审时如需多语言，在 `hud.ts` / `save.ts` 里抽出文案表即可。
