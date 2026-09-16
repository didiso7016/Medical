/**
 * 介面圖示：24x24 線條圖示，跟一般 App（iOS / Material）用的同一套視覺語言。
 * 不使用 emoji 當功能圖示——emoji 在不同裝置長得不一樣，也對不齊文字基線。
 */
const PATHS = {
  // 導覽
  today: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
  pill: '<path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.8-6.5L3 8"/><path d="M3 3.5V8h4.5"/><path d="M12 7.5V12l3 1.8"/>',

  // 方向
  'chevron-left': '<path d="m14.5 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9.5 18 6-6-6-6"/>',
  'chevron-up': '<path d="m6 14.5 6-6 6 6"/>',
  'chevron-down': '<path d="m6 9.5 6 6 6-6"/>',
  sort: '<path d="M3 16.5 6.5 20l3.5-3.5"/><path d="M6.5 20V4"/><path d="M14 7.5 17.5 4 21 7.5"/><path d="M17.5 4v16"/>',

  // 動作
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  check: '<path d="m4.5 12.5 4.8 4.8L19.5 6.5"/>',
  x: '<path d="M17.5 6.5l-11 11M6.5 6.5l11 11"/>',
  pencil: '<path d="M12.5 20H21"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7.6 18.4 3.5 19.5l1.1-4.1L16.4 3.6Z"/>',
  trash: '<path d="M3.5 6.5h17"/><path d="M8.5 6.5V4.8A1.3 1.3 0 0 1 9.8 3.5h4.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M18.5 6.5 17.7 19a1.6 1.6 0 0 1-1.6 1.5H7.9A1.6 1.6 0 0 1 6.3 19L5.5 6.5"/><path d="M10 10.5v6M14 10.5v6"/>',
  camera: '<path d="M14.6 4H9.4L7.2 6.8H4.4A2 2 0 0 0 2.4 8.8v9.2a2 2 0 0 0 2 2h15.2a2 2 0 0 0 2-2V8.8a2 2 0 0 0-2-2h-2.8L14.6 4Z"/><circle cx="12" cy="13.2" r="3.6"/>',
  paperclip: '<path d="M20.5 11.3 12 19.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  file: '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8l-4.5-4.5Z"/><path d="M14 3.5V8h4.5"/><path d="M9 13.5h6M9 17h4"/>',
  power: '<path d="M12 4v8.5"/><path d="M6.8 7.3a7.5 7.5 0 1 0 10.4 0"/>',
  settings:
    '<circle cx="12" cy="12" r="2.9"/><path d="M19.2 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.7 0V20a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.7H4a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.7 0V4a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.7H20a1.5 1.5 0 0 0-1.4.9Z"/>',
  grip: '<circle cx="9" cy="6.5" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="9" cy="17.5" r="1.1"/><circle cx="15" cy="6.5" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="15" cy="17.5" r="1.1"/>',
  'user-plus':
    '<path d="M15.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.2a3.7 3.7 0 0 0-3.7 3.7v1.8"/><circle cx="9" cy="7.5" r="3.7"/><path d="M18.5 8.5v5M21 11h-5"/>',
  search: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.2-4.2"/>',
  alert: '<path d="M10.3 4 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5v4"/><path d="M12 17h.01"/>',

  // 時段
  sunrise: '<path d="M12 10.5V3.5M8.8 6.7 12 3.5l3.2 3.2"/><path d="M3 18.5h18"/><path d="M6.8 18.5a5.2 5.2 0 0 1 10.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  sunset: '<path d="M12 3.5v7M8.8 7.3 12 10.5l3.2-3.2"/><path d="M3 18.5h18"/><path d="M6.8 18.5a5.2 5.2 0 0 1 10.4 0"/>',
  moon: '<path d="M20.3 14.8A8.6 8.6 0 1 1 9.2 3.7a6.7 6.7 0 0 0 11.1 11.1Z"/>',
};

/** 時段代碼 → 圖示 */
export const SLOT_ICONS = {
  breakfast: 'sunrise',
  lunch: 'sun',
  dinner: 'sunset',
  bedtime: 'moon',
};

export function icon(name, { size = 20, stroke = 1.7, className = '' } = {}) {
  const path = PATHS[name];
  if (!path) throw new Error(`未定義的圖示：${name}`);
  return (
    `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`
  );
}
