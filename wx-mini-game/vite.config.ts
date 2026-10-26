import { defineConfig } from 'vite';

// 浏览器预览：和真机跑同一份 @pocket-play/squishy-planet 代码，
// 只是把 Host 换成 shared 里的 DOM 实现。
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5274,
    strictPort: false,
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    target: 'es2019',
  },
  optimizeDeps: {
    // 共享包直接以 TS 源码分发，交给 Vite 编译。
    exclude: ['@pocket-play/squishy-planet'],
  },
});
