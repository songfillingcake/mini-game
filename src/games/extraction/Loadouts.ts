export const extractionLoadouts = {
  runner: { name: '遗迹行者', icon: '🧭', detail: '100 生命，均衡移速与火力', hp: 100, speed: 210, damage: 24, reload: .45, dashCooldown: 3, color: '#62c9b8' },
  warden: { name: '重装护卫', icon: '🛡️', detail: '130 生命，单发更重；移动、射击和冲刺恢复较慢', hp: 130, speed: 185, damage: 32, reload: .6, dashCooldown: 4.2, color: '#d7b681' },
  scout: { name: '轻装斥候', icon: '🪽', detail: '80 生命，跑得更快、冲刺更频繁；单发较轻', hp: 80, speed: 235, damage: 18, reload: .4, dashCooldown: 2.4, color: '#a4b4ed' },
} as const;
export type ExtractionLoadoutId = keyof typeof extractionLoadouts;
