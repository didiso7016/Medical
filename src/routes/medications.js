import express from 'express';
import fs from 'node:fs';
import { db, timeSlots } from '../db.js';
import { httpError, loadOwnedMedication, loadOwnedAttachment } from '../lib/context.js';
import {
  listMedications, listSchedulesForMedication, listAttachments, nextSortOrder,
} from '../lib/queries.js';
import {
  upload, saveAttachments, deleteAttachmentFile, deleteMedicationDir, attachmentPath, isImage,
} from '../lib/uploads.js';

const router = express.Router({ mergeParams: true });

const MEAL_OPTIONS = [
  { value: 'none', label: '不限' },
  { value: 'before', label: '飯前' },
  { value: 'after', label: '飯後' },
];
const KIND_LABELS = { bag: '藥袋', leaflet: '仿單', other: '其他' };

/** 從表單取出「哪些時段要吃、吃多少」 */
function parseSlotInput(body) {
  const raw = body.slots ?? {};
  return timeSlots()
    .filter((slot) => raw[slot.id]?.enabled)
    .map((slot) => ({
      time_slot_id: slot.id,
      dose: (raw[slot.id].dose ?? '').trim() || null,
      meal_relation: ['before', 'after'].includes(raw[slot.id].meal) ? raw[slot.id].meal : 'none',
    }));
}

function renderForm(res, status, opts) {
  res.status(status).render('medications/form', {
    active: 'medications',
    slots: timeSlots(),
    mealOptions: MEAL_OPTIONS,
    ...opts,
  });
}

// ---------------------------------------------------------------- 藥品清單
router.get('/', (req, res) => {
  const meds = listMedications(req.person.id, { includeInactive: true }).map((m) => ({
    ...m,
    schedules: listSchedulesForMedication(req.person.id, m.id),
    attachmentCount: db
      .prepare('SELECT COUNT(*) AS n FROM medication_attachment WHERE person_id = ? AND medication_id = ?')
      .get(req.person.id, m.id).n,
  }));

  res.render('medications/index', {
    title: `${req.person.name}｜藥品`,
    active: 'medications',
    medications: meds,
  });
});

// ---------------------------------------------------------------- 新增藥品
// 這裡沒有「家庭成員」欄位：person 由網址 context 決定（規格 §4）
router.get('/new', (req, res) => {
  renderForm(res, 200, {
    title: `${req.person.name}｜新增藥品`,
    medication: null,
    scheduleMap: {},
    formAction: `/persons/${req.person.id}/medications`,
  });
});

router.post('/', upload.array('files', 8), (req, res) => {
  const personId = req.person.id;
  const name = (req.body.name ?? '').trim();

  if (!name) {
    return renderForm(res, 400, {
      title: `${req.person.name}｜新增藥品`,
      medication: req.body,
      scheduleMap: buildScheduleMapFromBody(req.body),
      formAction: `/persons/${personId}/medications`,
      error: '請輸入藥品名稱',
    });
  }

  const info = db
    .prepare(
      `INSERT INTO medication (person_id, name, display_name, purpose, note, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    )
    .run(
      personId,
      name,
      (req.body.display_name ?? '').trim() || null,
      (req.body.purpose ?? '').trim() || null,
      (req.body.note ?? '').trim() || null,
      new Date().toISOString()
    );

  const medicationId = Number(info.lastInsertRowid);
  const insertSchedule = db.prepare(
    `INSERT INTO medication_schedule
       (person_id, medication_id, time_slot_id, dose, meal_relation, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const s of parseSlotInput(req.body)) {
    insertSchedule.run(
      personId, medicationId, s.time_slot_id, s.dose, s.meal_relation,
      nextSortOrder(personId, s.time_slot_id)
    );
  }

  saveAttachments(personId, medicationId, req.files, req.body.kind || 'leaflet');
  res.redirect(`/persons/${personId}/medications/${medicationId}`);
});

// ------------------------------------------------- 以下皆需通過「藥品歸屬」驗證
router.use('/:medicationId', loadOwnedMedication);

router.get('/:medicationId', (req, res) => {
  const attachments = listAttachments(req.person.id, req.medication.id).map((a) => ({
    ...a,
    isImage: isImage(a.content_type),
    kindLabel: KIND_LABELS[a.kind] ?? a.kind,
  }));

  res.render('medications/show', {
    title: `${req.person.name}｜${req.medication.name}`,
    active: 'medications',
    schedules: listSchedulesForMedication(req.person.id, req.medication.id),
    attachments,
    kindLabels: KIND_LABELS,
  });
});

router.get('/:medicationId/edit', (req, res) => {
  renderForm(res, 200, {
    title: `${req.person.name}｜編輯 ${req.medication.name}`,
    medication: req.medication,
    scheduleMap: Object.fromEntries(
      listSchedulesForMedication(req.person.id, req.medication.id).map((s) => [s.time_slot_id, s])
    ),
    formAction: `/persons/${req.person.id}/medications/${req.medication.id}`,
  });
});

router.post('/:medicationId', (req, res) => {
  const personId = req.person.id;
  const medId = req.medication.id;
  const name = (req.body.name ?? '').trim() || req.medication.name;

  db.prepare(
    `UPDATE medication SET name = ?, display_name = ?, purpose = ?, note = ?
      WHERE id = ? AND person_id = ?`
  ).run(
    name,
    (req.body.display_name ?? '').trim() || null,
    (req.body.purpose ?? '').trim() || null,
    (req.body.note ?? '').trim() || null,
    medId,
    personId
  );

  // 重建排程：有勾的 upsert（保留原本排序），沒勾的移除
  const wanted = parseSlotInput(req.body);
  const wantedIds = new Set(wanted.map((s) => s.time_slot_id));
  const existing = new Map(
    listSchedulesForMedication(personId, medId).map((s) => [s.time_slot_id, s])
  );

  for (const s of wanted) {
    if (existing.has(s.time_slot_id)) {
      db.prepare(
        `UPDATE medication_schedule SET dose = ?, meal_relation = ?
          WHERE id = ? AND person_id = ?`
      ).run(s.dose, s.meal_relation, existing.get(s.time_slot_id).id, personId);
    } else {
      db.prepare(
        `INSERT INTO medication_schedule
           (person_id, medication_id, time_slot_id, dose, meal_relation, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(personId, medId, s.time_slot_id, s.dose, s.meal_relation,
            nextSortOrder(personId, s.time_slot_id));
    }
  }
  for (const [slotId, s] of existing) {
    if (!wantedIds.has(slotId)) {
      db.prepare('DELETE FROM medication_schedule WHERE id = ? AND person_id = ?').run(s.id, personId);
    }
  }

  res.redirect(`/persons/${personId}/medications/${medId}`);
});

router.post('/:medicationId/active', (req, res) => {
  const isActive = req.body.is_active === '1' ? 1 : 0;
  db.prepare('UPDATE medication SET is_active = ? WHERE id = ? AND person_id = ?')
    .run(isActive, req.medication.id, req.person.id);
  res.redirect(`/persons/${req.person.id}/medications/${req.medication.id}`);
});

router.post('/:medicationId/delete', (req, res) => {
  deleteMedicationDir(req.person.id, req.medication.id);
  db.prepare('DELETE FROM medication WHERE id = ? AND person_id = ?')
    .run(req.medication.id, req.person.id);
  res.redirect(`/persons/${req.person.id}/medications`);
});

// ---------------------------------------------------------------- 仿單／藥袋
router.post('/:medicationId/attachments', upload.array('files', 8), (req, res, next) => {
  if (!req.files?.length) return next(httpError(400, '請先選擇要上傳的照片或 PDF'));
  saveAttachments(req.person.id, req.medication.id, req.files, req.body.kind || 'leaflet');
  res.redirect(`/persons/${req.person.id}/medications/${req.medication.id}`);
});

/**
 * 附件檔案不用 express.static 直接對外，而是走這條路由，
 * 這樣每次讀檔都會再驗一次 person + medication 歸屬（規格 §5、§9）。
 */
router.get('/:medicationId/attachments/:attachmentId/file', loadOwnedAttachment, (req, res, next) => {
  const filePath = attachmentPath(req.attachment);
  if (!fs.existsSync(filePath)) return next(httpError(404, '檔案已遺失'));

  res.type(req.attachment.content_type || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (req.query.download) {
    const filename = encodeURIComponent(req.attachment.original_name || req.attachment.stored_name);
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + filename);
  }
  fs.createReadStream(filePath).pipe(res);
});

router.post('/:medicationId/attachments/:attachmentId/delete', loadOwnedAttachment, (req, res) => {
  deleteAttachmentFile(req.attachment);
  db.prepare('DELETE FROM medication_attachment WHERE id = ? AND person_id = ?')
    .run(req.attachment.id, req.person.id);
  res.redirect(`/persons/${req.person.id}/medications/${req.medication.id}`);
});

function buildScheduleMapFromBody(body) {
  const raw = body.slots ?? {};
  const map = {};
  for (const [slotId, v] of Object.entries(raw)) {
    if (v?.enabled) map[slotId] = { dose: v.dose, meal_relation: v.meal };
  }
  return map;
}

export default router;
