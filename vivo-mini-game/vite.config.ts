import { defineConfig } from 'vite';

// 浏览器预览：与 vivo 运行时共用 game/ 下的同一份游戏代码，
// 通过 game/platform/web.ts 提供 DOM 适配层。
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5273,
    strictPort: false,
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    target: 'es2019',
  },
});
