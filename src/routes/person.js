import express from 'express';
import { db } from '../db.js';
import { httpError } from '../lib/context.js';
import medicationsRouter from './medications.js';
import { buildDayPlan, buildHistory, dayProgress, listPersons } from '../lib/queries.js';
import { deleteMedicationDir } from '../lib/uploads.js';
import {
  formatLongDate, formatShortDate, todayStr, shiftDate, parseDateStr, doseLine, hhmm,
  PERSON_COLORS, isPersonColor,
} from '../lib/format.js';
import { timeSlots } from '../db.js';

// mergeParams：讓子路由也拿得到 :personId
const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  res.locals.doseLine = doseLine;
  res.locals.hhmm = hhmm;
  res.locals.formatShortDate = formatShortDate;
  next();
});

router.get('/', (req, res) => res.redirect(`/persons/${req.person.id}/today`));

// ---------------------------------------------------------------- 今日用藥
router.get('/today', (req, res) => {
  const date = parseDateStr(req.query.date) ? req.query.date : todayStr();
  const groups = buildDayPlan(req.person.id, date);

  res.render('today', {
    title: `${req.person.name}｜今日`,
    active: 'today',
    date,
    isToday: date === todayStr(),
    dateLabel: formatLongDate(date),
    prevDate: shiftDate(date, -1),
    nextDate: shiftDate(date, 1),
    groups,
    progress: dayProgress(groups),
  });
});

/**
 * 勾選 / 取消服藥。
 * 即使前端送來任何 medication_id，後端仍會確認它屬於目前 person，
 * 而且確實有掛在這個時段（規格 §9）。
 */
router.post('/today/toggle', (req, res, next) => {
  const personId = req.person.id;
  const medicationId = Number(req.body.medication_id);
  const timeSlotId = Number(req.body.time_slot_id);
  const date = parseDateStr(req.body.date) ? req.body.date : todayStr();

  const schedule = db
    .prepare(
      `SELECT s.id FROM medication_schedule s
         JOIN medication m ON m.id = s.medication_id AND m.person_id = s.person_id
        WHERE s.person_id = ? AND s.medication_id = ? AND s.time_slot_id = ?`
    )
    .get(personId, medicationId, timeSlotId);
  if (!schedule) return next(httpError(404, '找不到這筆用藥排程'));

  const existing = db
    .prepare(
      `SELECT id FROM medication_log
        WHERE person_id = ? AND medication_id = ? AND time_slot_id = ? AND log_date = ?`
    )
    .get(personId, medicationId, timeSlotId, date);

  let takenAt = null;
  if (existing) {
    db.prepare('DELETE FROM medication_log WHERE id = ? AND person_id = ?').run(existing.id, personId);
  } else {
    takenAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO medication_log
         (person_id, medication_id, schedule_id, time_slot_id, log_date, taken_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(personId, medicationId, schedule.id, timeSlotId, date, takenAt);
  }

  if (req.get('accept')?.includes('application/json')) {
    return res.json({ ok: true, taken_at: takenAt });
  }
  res.redirect(`/persons/${personId}/today?date=${date}`);
});

// ---------------------------------------------------------------- 用藥排序
router.get('/order', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.time_slot_id, s.sort_order, s.dose, s.meal_relation,
              m.name AS med_name, m.display_name AS med_display_name
         FROM medication_schedule s
         JOIN medication m ON m.id = s.medication_id AND m.person_id = s.person_id
        WHERE s.person_id = ? AND m.is_active = 1
        ORDER BY s.sort_order, m.name`
    )
    .all(req.person.id);

  const groups = timeSlots()
    .map((slot) => ({
      slot,
      items: rows
        .filter((r) => r.time_slot_id === slot.id)
        .map((r) => ({ ...r, label: r.med_display_name || r.med_name })),
    }))
    .filter((g) => g.items.length > 0);

  res.render('order', {
    title: `${req.person.name}｜用藥排序`,
    active: 'today',
    groups,
  });
});

router.post('/order', (req, res) => {
  const personId = req.person.id;
  const order = req.body.order ?? {};
  const update = db.prepare(
    'UPDATE medication_schedule SET sort_order = ? WHERE id = ? AND person_id = ? AND time_slot_id = ?'
  );

  // 每個時段獨立編號；WHERE 帶 person_id，別人的排序絕對動不到
  for (const [key, ids] of Object.entries(order)) {
    const slotId = Number(String(key).replace(/^slot_/, ''));
    if (!Number.isInteger(slotId) || slotId <= 0) continue;

    const list = Array.isArray(ids) ? ids : [ids];
    list.forEach((scheduleId, index) => {
      update.run((index + 1) * 10, Number(scheduleId), personId, slotId);
    });
  }
  res.redirect(`/persons/${personId}/today`);
});

// ---------------------------------------------------------------- 歷史紀錄
router.get('/history', (req, res) => {
  res.render('history', {
    title: `${req.person.name}｜紀錄`,
    active: 'history',
    days: buildHistory(req.person.id),
    formatLongDate,
  });
});

// ---------------------------------------------------------------- 成員設定
router.get('/settings', (req, res) => {
  res.render('persons/form', {
    title: `${req.person.name}｜設定`,
    colors: PERSON_COLORS,
    person: req.person,
    formAction: `/persons/${req.person.id}/settings`,
    canDelete: listPersons().length > 1,
  });
});

router.post('/settings', (req, res) => {
  const name = (req.body.name ?? '').trim() || req.person.name;
  const color = isPersonColor(req.body.color) ? req.body.color : req.person.color;
  db.prepare('UPDATE person SET name = ?, color = ? WHERE id = ?').run(name, color, req.person.id);
  res.redirect(`/persons/${req.person.id}/today`);
});

router.post('/settings/delete', (req, res) => {
  const personId = req.person.id;
  for (const m of db.prepare('SELECT id FROM medication WHERE person_id = ?').all(personId)) {
    deleteMedicationDir(personId, m.id);
  }
  db.prepare('DELETE FROM person WHERE id = ?').run(personId); // 其餘資料由 ON DELETE CASCADE 清掉
  res.redirect('/');
});

router.use('/medications', medicationsRouter);

export default router;
