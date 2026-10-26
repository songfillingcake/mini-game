import { mountLightweave } from '@pocket-play/lightweave/browser';

const container = document.querySelector<HTMLElement>('#stage');
if (!container) throw new Error('缺少 #stage 容器');

mountLightweave(container);
