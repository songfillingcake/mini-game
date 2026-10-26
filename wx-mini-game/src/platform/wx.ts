// 微信适配层已收敛到 @pocket-play/engine，这里只做转发，
// 保证 entry 里的引用路径不变。
export { createWxHost, type WxApi } from '@pocket-play/engine/platform/wx';