import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'med.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
//
// 資料隔離的核心：medication / medication_schedule / medication_attachment /
// medication_log 全部都直接帶 person_id，任何查詢都以 person_id 為第一個條件，
// 不依賴 join 推導出來的歸屬。
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS person (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT 'sage',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS time_slot (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS medication (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id    INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  display_name TEXT,
  color        TEXT,
  purpose      TEXT,
  note         TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medication_person ON medication(person_id, is_active);

CREATE TABLE IF NOT EXISTS medication_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id     INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  time_slot_id  INTEGER NOT NULL REFERENCES time_slot(id),
  dose          TEXT,
  meal_relation TEXT    NOT NULL DEFAULT 'none',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(medication_id, time_slot_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_person_slot
  ON medication_schedule(person_id, time_slot_id, sort_order);

CREATE TABLE IF NOT EXISTS medication_attachment (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id     INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL DEFAULT 'leaflet',
  stored_name   TEXT    NOT NULL,
  original_name TEXT,
  content_type  TEXT,
  size          INTEGER,
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachment_med ON medication_attachment(person_id, medication_id);

CREATE TABLE IF NOT EXISTS medication_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id     INTEGER NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medication(id) ON DELETE CASCADE,
  schedule_id   INTEGER,
  time_slot_id  INTEGER NOT NULL REFERENCES time_slot(id),
  log_date      TEXT    NOT NULL,
  taken_at      TEXT    NOT NULL,
  UNIQUE(person_id, medication_id, time_slot_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_log_person_date ON medication_log(person_id, log_date);
`);

// 成員頭像從 emoji 改為「稱呼字 + 顏色」的圓形頭像
const personColumns = db.prepare('PRAGMA table_info(person)').all().map((c) => c.name);
if (!personColumns.includes('color')) {
  db.exec("ALTER TABLE person ADD COLUMN color TEXT NOT NULL DEFAULT 'sage'");
  const palette = ['sage', 'clay', 'indigo', 'amber', 'rose', 'slate'];
  const people = db.prepare('SELECT id FROM person ORDER BY sort_order, id').all();
  const setColor = db.prepare('UPDATE person SET color = ? WHERE id = ?');
  people.forEach((p, i) => setColor.run(palette[i % palette.length], p.id));
}
if (personColumns.includes('emoji')) {
  db.exec('ALTER TABLE person DROP COLUMN emoji');
}

// 藥品顏色（實際藥錠／膠囊的顏色，方便對照藥袋裡的藥）
const medicationColumns = db.prepare('PRAGMA table_info(medication)').all().map((c) => c.name);
if (!medicationColumns.includes('color')) {
  db.exec('ALTER TABLE medication ADD COLUMN color TEXT');
}

// 時段為系統共用字典（每個人的「排序」才是個人資料）
const SLOTS = [
  ['breakfast', '早餐', 1],
  ['lunch', '午餐', 2],
  ['dinner', '晚餐', 3],
  ['bedtime', '睡前', 4],
];
const slotCount = db.prepare('SELECT COUNT(*) AS n FROM time_slot').get().n;
if (slotCount === 0) {
  const ins = db.prepare('INSERT INTO time_slot (code, name, sort_order) VALUES (?, ?, ?)');
  for (const [code, name, order] of SLOTS) ins.run(code, name, order);
}

export const timeSlots = () =>
  db.prepare('SELECT * FROM time_slot ORDER BY sort_order').all();
