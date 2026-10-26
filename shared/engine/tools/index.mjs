export { encodePng } from './png.mjs';
export { SOUND_SCORES, encodeWav, renderSound } from './wav.mjs';
export { renderIcon } from './icon.mjs';

import { SOUND_SCORES } from './wav.mjs';

/** 构建期需要生成的音效名。 */
export const SOUND_NAMES = Object.keys(SOUND_SCORES);
