import { db } from '../db.js';

/**
 * 規格 §9：Backend 不能只相信網址。
 *
 * loadPerson 解析 /persons/:personId，把「目前家庭成員」放進 req.person，
 * 之後所有查詢都必須以 req.person.id 為條件。
 */
export function loadPerson(req, res, next) {
  const id = Number(req.params.personId);
  if (!Number.isInteger(id) || id <= 0) return next(httpError(404, '找不到這位家庭成員'));

  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(id);
  if (!person) return next(httpError(404, '找不到這位家庭成員'));

  req.person = person;
  res.locals.person = person;
  res.locals.personPath = (suffix = '') => `/persons/${person.id}${suffix}`;
  next();
}

/**
 * 解析 :medicationId，並且驗證 medication.person_id === 目前 person.id。
 * 若藥品實際屬於別人 → 一律 404（不洩漏「存在但不屬於你」這件事）。
 */
export function loadOwnedMedication(req, res, next) {
  const id = Number(req.params.medicationId);
  if (!Number.isInteger(id) || id <= 0) return next(httpError(404, '找不到這個藥品'));

  const med = db
    .prepare('SELECT * FROM medication WHERE id = ? AND person_id = ?')
    .get(id, req.person.id);
  if (!med) return next(httpError(404, '找不到這個藥品'));

  req.medication = med;
  res.locals.medication = med;
  next();
}

/** 同樣的規則套用在附件上：附件必須同時屬於這個人與這個藥品 */
export function loadOwnedAttachment(req, res, next) {
  const id = Number(req.params.attachmentId);
  const att = db
    .prepare(
      'SELECT * FROM medication_attachment WHERE id = ? AND person_id = ? AND medication_id = ?'
    )
    .get(id, req.person.id, req.medication.id);
  if (!att) return next(httpError(404, '找不到這個檔案'));
  req.attachment = att;
  next();
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
