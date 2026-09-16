import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import { loadPerson } from './src/lib/context.js';
import { icon, SLOT_ICONS } from './src/lib/icons.js';
import { avatarText, medColorLabel } from './src/lib/format.js';
import rootRouter from './src/routes/root.js';
import personRouter from './src/routes/person.js';
import { cleanupTmp } from './src/lib/uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 所有畫面都用得到的輔助函式
app.locals.icon = icon;
app.locals.SLOT_ICONS = SLOT_ICONS;
app.locals.avatarText = avatarText;
app.locals.medColorLabel = medColorLabel;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// 第一層：選擇家庭成員
app.use('/', rootRouter);

// 第二層：進入某位家庭成員的資料空間。
// loadPerson 之後，router 內所有查詢都以 req.person.id 為界線。
app.use('/persons/:personId', loadPerson, personRouter);

app.use((req, res) => {
  res.status(404).render('error', { title: '找不到頁面', status: 404, message: '找不到這個頁面' });
});

app.use((err, req, res, next) => {
  cleanupTmp(req.files);
  const status = err.status ?? (err instanceof multer.MulterError ? 400 : 500);
  if (status >= 500) console.error(err);
  const message =
    err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
      ? '檔案太大了（單檔上限 25MB）'
      : err.message || '發生錯誤';
  res.status(status).render('error', { title: '發生錯誤', status, message });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`家庭用藥系統已啟動： http://localhost:${PORT}`);
  console.log('同一個 Wi-Fi 下的手機可用本機 IP 連線，例如 http://192.168.x.x:' + PORT);
});
