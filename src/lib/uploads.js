import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { db, UPLOAD_DIR } from '../db.js';
import { httpError } from './context.js';

const TMP_DIR = path.join(UPLOAD_DIR, '_tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf',
]);

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif', 'image/gif': '.gif',
  'application/pdf': '.pdf',
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(httpError(400, '只接受照片（JPG / PNG / HEIC）或 PDF'));
  },
});

/** 附件實體路徑：data/uploads/<person_id>/<medication_id>/<uuid><ext> */
export const medicationDir = (personId, medicationId) =>
  path.join(UPLOAD_DIR, String(personId), String(medicationId));

export const attachmentPath = (att) =>
  path.join(medicationDir(att.person_id, att.medication_id), att.stored_name);

/**
 * 把 multer 暫存檔搬到「這個人 / 這個藥品」的資料夾，並寫入 DB。
 * person_id 一律由後端 context 決定，絕不從表單欄位取得。
 */
export function saveAttachments(personId, medicationId, files, kind = 'leaflet') {
  if (!files?.length) return;
  const dir = medicationDir(personId, medicationId);
  fs.mkdirSync(dir, { recursive: true });

  const insert = db.prepare(
    `INSERT INTO medication_attachment
       (person_id, medication_id, kind, stored_name, original_name, content_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const file of files) {
    const storedName = file.filename + (EXT[file.mimetype] ?? '');
    fs.renameSync(file.path, path.join(dir, storedName));
    insert.run(
      personId,
      medicationId,
      kind,
      storedName,
      decodeOriginalName(file.originalname),
      file.mimetype,
      file.size,
      new Date().toISOString()
    );
  }
}

export function deleteAttachmentFile(att) {
  try {
    fs.unlinkSync(attachmentPath(att));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export function deleteMedicationDir(personId, medicationId) {
  fs.rmSync(medicationDir(personId, medicationId), { recursive: true, force: true });
}

/**
 * busboy 解析 multipart 的檔名時預設用 latin1，
 * 中文檔名拿到手會是「UTF-8 位元組被當成 latin1」的亂碼，要轉回來。
 * 轉出來若含替代字元代表原本就不是 UTF-8（例如 Big5），那就保留原樣。
 */
function decodeOriginalName(name) {
  if (!name || !/[-ÿ]/.test(name)) return name;
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  return fixed.includes('�') ? name : fixed;
}

export function cleanupTmp(files) {
  for (const f of files ?? []) fs.rmSync(f.path, { force: true });
}

export const isImage = (contentType) => (contentType ?? '').startsWith('image/');
