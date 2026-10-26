import { mountSquishyPlanet } from '@pocket-play/squishy-planet/browser';

const container = document.querySelector<HTMLElement>('#stage');
if (!container) throw new Error('缺少 #stage 容器');

mountSquishyPlanet(container);
