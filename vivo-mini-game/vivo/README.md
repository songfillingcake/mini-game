# vivo 工程目录

这个目录就是交给 vivo 打包工具（`mg-service` / 快游戏联盟 IDE）的**运行时工程根**。

- `src/manifest.json` —— 唯一需要手工维护的发布配置（包名、名称、版本号、图标、屏幕方向）。
- `src/game.js`、`src/js/`、`src/audio/`、`src/image/` —— **全部由 `npm run build` 生成**，不要手改。
- `minigame.config.js` —— 打包器配置。
- `sign/release/` —— 正式签名，需自行放入 `certificate.pem` 与 `private.pem`，且不要提交到仓库。
- `sign/debug/` —— 调试签名，首次构建时自动获取（可离线时手工放入）。

游戏源码在上一层的 `game/` 目录，与这里没有任何构建期耦合。
