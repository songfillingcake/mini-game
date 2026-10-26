/**
 * vivo 小游戏打包配置（由 @vivo-minigame/cli-packager 读取）。
 *
 * - externals：以外部依赖方式引入的模块，构建时从工程内拷贝到 build 目录。
 *   本项目不依赖任何引擎适配层，游戏代码由 esbuild 打成单个 game.js，因此留空。
 * - devtoolConfig：sourcemap 生成方式，正式包由 release 流程关闭。
 * - fflateEnable：使用 fflate 打包 zip，比 JSZip 快。
 * - enablePluginPack / enableSinglePack：调试模式下跳过插件包 / 原整包，缩短构建时间。
 */
module.exports = function config() {
  return {
    externals: [],
    devtoolConfig: 'cheap-module-source-map',
    fflateEnable: true,
    enablePluginPack: true,
    enableSinglePack: false,
  };
};
