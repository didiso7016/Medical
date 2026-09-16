const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 取得本地時區的 YYYY-MM-DD（不可用 toISOString，那是 UTC） */
export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowTimeStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function parseDateStr(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 9 月 16 日 星期三 */
export function formatLongDate(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return dateStr;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${WEEKDAYS[d.getDay()]}`;
}

/** 9/15 */
export function formatShortDate(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function shiftDate(dateStr, days) {
  const d = parseDateStr(dateStr) ?? new Date();
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

export const MEAL_LABELS = { before: '飯前', after: '飯後', none: '' };
export const mealLabel = (v) => MEAL_LABELS[v] ?? '';

/** 「1 顆｜飯前」 */
export function doseLine(schedule) {
  return [schedule.dose, mealLabel(schedule.meal_relation)].filter(Boolean).join('｜');
}

/** ISO 字串 → 本地 HH:MM */
export function hhmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return nowTimeStr(d);
}

/** 成員頭像的配色（柔和、易分辨，不靠 emoji） */
export const PERSON_COLORS = [
  { key: 'sage', label: '苔綠' },
  { key: 'clay', label: '磚紅' },
  { key: 'indigo', label: '靛藍' },
  { key: 'amber', label: '琥珀' },
  { key: 'rose', label: '玫瑰' },
  { key: 'slate', label: '石墨' },
];

export const isPersonColor = (key) => PERSON_COLORS.some((c) => c.key === key);

/** 頭像上的字：兩個字以內就整個顯示，更長就取最後兩個字（阿公 / 阿嬤 才分得出來） */
export function avatarText(name) {
  const n = (name ?? '').trim();
  return n.length <= 2 ? n : n.slice(-2);
}
