import { db, timeSlots } from '../db.js';

export const listPersons = () =>
  db.prepare('SELECT * FROM person ORDER BY sort_order, id').all();

export const countPersons = () =>
  db.prepare('SELECT COUNT(*) AS n FROM person').get().n;

export const listMedications = (personId, { includeInactive = false } = {}) =>
  db
    .prepare(
      `SELECT * FROM medication
        WHERE person_id = ? ${includeInactive ? '' : 'AND is_active = 1'}
        ORDER BY is_active DESC, name`
    )
    .all(personId);

export const listSchedulesForMedication = (personId, medicationId) =>
  db
    .prepare(
      `SELECT s.*, t.name AS slot_name, t.code AS slot_code, t.sort_order AS slot_order
         FROM medication_schedule s
         JOIN time_slot t ON t.id = s.time_slot_id
        WHERE s.person_id = ? AND s.medication_id = ?
        ORDER BY t.sort_order`
    )
    .all(personId, medicationId);

export const listAttachments = (personId, medicationId) =>
  db
    .prepare(
      `SELECT * FROM medication_attachment
        WHERE person_id = ? AND medication_id = ?
        ORDER BY created_at, id`
    )
    .all(personId, medicationId);

/**
 * 某人某天的用藥清單，依時段分組、依個人 sort_order 排序。
 * 回傳 [{ slot, items: [{ schedule..., medication_name, taken_at }] }]
 */
export function buildDayPlan(personId, dateStr) {
  const rows = db
    .prepare(
      `SELECT s.id            AS schedule_id,
              s.medication_id,
              s.time_slot_id,
              s.dose,
              s.meal_relation,
              s.sort_order,
              m.name          AS med_name,
              m.display_name  AS med_display_name,
              m.color         AS med_color,
              m.purpose       AS med_purpose,
              l.taken_at      AS taken_at
         FROM medication_schedule s
         JOIN medication m ON m.id = s.medication_id AND m.person_id = s.person_id
         LEFT JOIN medication_log l
                ON l.person_id     = s.person_id
               AND l.medication_id = s.medication_id
               AND l.time_slot_id  = s.time_slot_id
               AND l.log_date      = ?
        WHERE s.person_id = ? AND m.is_active = 1
        ORDER BY s.sort_order, m.name`
    )
    .all(dateStr, personId);

  const bySlot = new Map();
  for (const r of rows) {
    if (!bySlot.has(r.time_slot_id)) bySlot.set(r.time_slot_id, []);
    bySlot.get(r.time_slot_id).push({ ...r, label: r.med_display_name || r.med_name });
  }

  return timeSlots()
    .map((slot) => ({ slot, items: bySlot.get(slot.id) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function dayProgress(groups) {
  const all = groups.flatMap((g) => g.items);
  return { total: all.length, done: all.filter((i) => i.taken_at).length };
}

/** 歷史紀錄：只取這個人的 log，依日期倒序分組 */
export function buildHistory(personId, { days = 14 } = {}) {
  const rows = db
    .prepare(
      `SELECT l.log_date,
              l.taken_at,
              l.time_slot_id,
              t.name         AS slot_name,
              t.sort_order   AS slot_order,
              m.name         AS med_name,
              m.display_name AS med_display_name
         FROM medication_log l
         JOIN time_slot  t ON t.id = l.time_slot_id
         JOIN medication m ON m.id = l.medication_id AND m.person_id = l.person_id
        WHERE l.person_id = ?
        ORDER BY l.log_date DESC, t.sort_order, l.taken_at`
    )
    .all(personId);

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.log_date)) byDate.set(r.log_date, new Map());
    const slots = byDate.get(r.log_date);
    if (!slots.has(r.slot_name)) slots.set(r.slot_name, []);
    slots.get(r.slot_name).push({ ...r, label: r.med_display_name || r.med_name });
  }

  return [...byDate.entries()].slice(0, days).map(([date, slots]) => ({
    date,
    slots: [...slots.entries()].map(([name, items]) => ({ name, items })),
  }));
}

/** 新增排程時放到該人該時段的最後一位 */
export function nextSortOrder(personId, timeSlotId) {
  const row = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM medication_schedule WHERE person_id = ? AND time_slot_id = ?'
    )
    .get(personId, timeSlotId);
  return row.m + 10;
}
