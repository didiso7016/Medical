import express from 'express';
import { db } from '../db.js';
import { listPersons } from '../lib/queries.js';
import { todayStr, PERSON_COLORS, isPersonColor } from '../lib/format.js';

const router = express.Router();

/** 第一層：先選人。不選人就看不到任何用藥資料。 */
router.get('/', (req, res) => {
  const persons = listPersons();
  const today = todayStr();

  // 每個人卡片上顯示今天的完成度，但仍然是各自獨立計算
  const summary = new Map(
    db
      .prepare(
        `SELECT s.person_id,
                COUNT(*) AS total,
                SUM(CASE WHEN l.id IS NULL THEN 0 ELSE 1 END) AS done
           FROM medication_schedule s
           JOIN medication m ON m.id = s.medication_id AND m.person_id = s.person_id
           LEFT JOIN medication_log l
                  ON l.person_id     = s.person_id
                 AND l.medication_id = s.medication_id
                 AND l.time_slot_id  = s.time_slot_id
                 AND l.log_date      = ?
          WHERE m.is_active = 1
          GROUP BY s.person_id`
      )
      .all(today)
      .map((r) => [r.person_id, r])
  );

  res.render('persons/index', {
    title: '家庭用藥',
    persons: persons.map((p) => ({ ...p, summary: summary.get(p.id) })),
  });
});

router.get('/persons/new', (req, res) => {
  res.render('persons/form', {
    title: '新增家庭成員',
    colors: PERSON_COLORS,
    person: null,
    formAction: '/persons',
  });
});

router.post('/persons', (req, res) => {
  const name = (req.body.name ?? '').trim();
  if (!name) {
    return res.status(400).render('persons/form', {
      title: '新增家庭成員',
      colors: PERSON_COLORS,
      person: null,
      formAction: '/persons',
      error: '請輸入稱呼',
    });
  }

  const color = isPersonColor(req.body.color) ? req.body.color : 'sage';
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM person').get().m;

  const info = db
    .prepare('INSERT INTO person (name, color, sort_order, created_at) VALUES (?, ?, ?, ?)')
    .run(name, color, max + 10, new Date().toISOString());

  res.redirect(`/persons/${info.lastInsertRowid}/today`);
});

export default router;
