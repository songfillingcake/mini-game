import { getSoundEnabled } from '../core/Storage';

export function renderSoundToggle(): string {
  const enabled = getSoundEnabled();
  return '<button class="sound-toggle" type="button" data-sound-toggle aria-pressed="' + enabled + '" aria-label="' + (enabled ? '关闭音效' : '开启音效') + '">' +
    '<span class="sound-icon">' + (enabled ? '♫' : '♪') + '</span><span class="sound-label">' + (enabled ? '音效开' : '静音') + '</span></button>';
}

export function syncSoundToggle(root: ParentNode, enabled: boolean): void {
  root.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]').forEach((button) => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '关闭音效' : '开启音效');
    const icon = button.querySelector<HTMLElement>('.sound-icon');
    const label = button.querySelector<HTMLElement>('.sound-label');
    if (icon) icon.textContent = enabled ? '♫' : '♪';
    if (label) label.textContent = enabled ? '音效开' : '静音';
  });
}
