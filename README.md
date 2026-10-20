# 口袋游乐场 · Pocket Play

一个包含三款小游戏的轻量浏览器游戏项目：猫猫钓鱼、躲障碍和弹跳闯关。

## 本地启动

需要 Node.js 18+。

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 技术结构

- Vite + TypeScript
- Canvas 2D 绘制游戏场景，HTML/CSS 实现大厅、HUD 和菜单
- `src/core/` 放置游戏接口、画布适配、主循环和本地记录
- `src/games/` 中每款游戏独立实现，统一由游戏大厅启动
- 每款游戏的最高分保存在浏览器 `localStorage`

键盘方向键或 A/D 可控制移动；触屏设备可以使用画面下方的方向按钮，也可以直接在画布上滑动。猫猫钓鱼支持点击或空格收竿，Esc 返回大厅，P 暂停。
