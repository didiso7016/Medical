/**
 * 建立示範資料：npm run seed
 * 只有在資料庫還沒有任何家庭成員時才會執行，不會覆蓋既有資料。
 */
import { db, timeSlots } from './db.js';
import { countPersons } from './lib/queries.js';

if (countPersons() > 0) {
  console.log('資料庫已有家庭成員，略過示範資料。');
  process.exit(0);
}

const slotId = Object.fromEntries(timeSlots().map((s) => [s.code, s.id]));
const now = new Date().toISOString();

const insertPerson = db.prepare(
  'INSERT INTO person (name, color, sort_order, created_at) VALUES (?, ?, ?, ?)'
);
const insertMed = db.prepare(
  `INSERT INTO medication (person_id, name, display_name, purpose, note, is_active, created_at)
   VALUES (?, ?, ?, ?, ?, 1, ?)`
);
const insertSchedule = db.prepare(
  `INSERT INTO medication_schedule
     (person_id, medication_id, time_slot_id, dose, meal_relation, sort_order)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const FAMILY = [
  {
    name: '爸爸', color: 'indigo',
    // 規格 §6：爸爸的早餐順序是 心臟藥 → 血壓藥 → 胃藥
    meds: [
      { name: 'Digoxin 0.25mg', display: '心臟藥', purpose: '心臟衰竭',
        slots: [['breakfast', '1 顆', 'after', 10]] },
      { name: 'Losartan 50mg', display: '血壓藥', purpose: '降血壓',
        slots: [['breakfast', '1 顆', 'after', 20]] },
      { name: 'Famotidine 20mg', display: '胃藥', purpose: '護胃',
        slots: [['breakfast', '1 顆', 'before', 30]] },
    ],
  },
  {
    name: '媽媽', color: 'rose',
    // 規格 §6：媽媽的早餐順序是 胃藥 → 血壓藥 → 維他命（跟爸爸互不影響）
    meds: [
      { name: 'Famotidine 20mg', display: '胃藥', purpose: '護胃',
        slots: [['breakfast', '1 顆', 'before', 10], ['lunch', '1 顆', 'before', 10]] },
      { name: 'Amlodipine 5mg', display: '血壓藥', purpose: '降血壓',
        note: '收縮壓低於 100 先暫停，並詢問醫師',
        slots: [['breakfast', '1 顆', 'after', 20], ['dinner', '1 顆', 'after', 10]] },
      { name: '綜合維他命', display: '維他命', purpose: '營養補充',
        slots: [['breakfast', '1 顆', 'after', 30]] },
      { name: 'Atorvastatin 10mg', display: '血脂藥', purpose: '降膽固醇',
        slots: [['bedtime', '1 顆', 'none', 10]] },
    ],
  },
  { name: '阿公', color: 'sage', meds: [] },
  { name: '阿嬤', color: 'amber', meds: [] },
  { name: '我', color: 'slate', meds: [] },
];

FAMILY.forEach((p, i) => {
  const personId = Number(insertPerson.run(p.name, p.color, (i + 1) * 10, now).lastInsertRowid);
  for (const m of p.meds) {
    const medId = Number(
      insertMed.run(personId, m.name, m.display, m.purpose ?? null, m.note ?? null, now).lastInsertRowid
    );
    for (const [code, dose, meal, order] of m.slots) {
      insertSchedule.run(personId, medId, slotId[code], dose, meal, order);
    }
  }
  console.log(`建立 ${p.name}（${p.meds.length} 種藥品）`);
});

console.log('\n示範資料建立完成，執行 npm start 後開啟 http://localhost:3000');
