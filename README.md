# 家庭用藥管理系統

以「家庭成員」為第一層的用藥管理：**先選人，才看得到資料**。
不同家庭成員的藥品、排程、仿單與服藥紀錄完全隔離，不會互相顯示。

## 啟動

```bash
npm install
npm run seed    # 建立示範家庭（只在資料庫是空的時候會執行）
npm start
```

- 本機：<http://localhost:3000>
- 同一個 Wi-Fi 下的手機／平板：`http://<這台電腦的區網 IP>:3000`
- 換 port：`PORT=8080 npm start`

需要 Node.js 22.5 以上（使用內建的 `node:sqlite`，不需要編譯任何原生套件）。

## 資料放哪裡

| 內容 | 位置 |
| --- | --- |
| 資料庫 | `data/med.db` |
| 仿單／藥袋原始檔 | `data/uploads/<person_id>/<medication_id>/` |

`data/` 已列入 `.gitignore`——家人的用藥資料與藥袋照片不會被推上 git。
備份就是把整個 `data/` 資料夾複製走。

## 資料隔離怎麼做的

```
Person
  ├── Medication
  │     ├── MedicationSchedule   （時段 + 劑量 + 個人排序）
  │     └── MedicationAttachment （仿單 / 藥袋）
  └── MedicationLog              （服藥紀錄）
```

四張子表都直接帶 `person_id`，查詢一律以 `person_id` 為第一個條件，
不靠 join 推導歸屬。即使兩個人都有「血壓藥」，也是兩筆不同的 Medication。

### 網址帶人，後端仍要驗

```
/persons/2/today
/persons/2/medications
/persons/2/medications/new
/persons/2/medications/15
/persons/2/history
```

網址只是 context，**後端不相信網址**：

- `loadPerson` 解析 `:personId`，找不到就 404。
- `loadOwnedMedication` 會確認 `medication.person_id === person.id`，
  屬於別人的藥品一律回 404（不透露「存在但不屬於你」）。
- 附件不用 `express.static` 對外，每次讀檔都再驗一次人員與藥品歸屬。
- 打勾服藥、改排序、改資料的 SQL，`WHERE` 都帶 `person_id`。

實測（`爸爸 = 1`、`媽媽 = 2`，藥品 5 屬於媽媽）：

| 請求 | 結果 |
| --- | --- |
| `GET /persons/2/medications/5` | 200 |
| `GET /persons/1/medications/5` | 404 |
| `POST /persons/1/medications/5` | 404 |
| `POST /persons/1/today/toggle`（medication 5） | 404 |
| 爸爸送出媽媽的排序 | 302，但媽媽的順序不變 |

## 畫面

| 路徑 | 內容 |
| --- | --- |
| `/` | 選家庭成員（第一層，不選人看不到任何用藥資料） |
| `/persons/:id/today` | 今日用藥，依時段分組、可勾選、可翻日期 |
| `/persons/:id/order` | 用藥排序，拖曳或上下鍵，每個人每個時段各自獨立 |
| `/persons/:id/medications` | 該成員的藥品清單 |
| `/persons/:id/medications/new` | 新增藥品（不需要再選人） |
| `/persons/:id/medications/:mid` | 藥品詳細、仿單／藥袋上傳 |
| `/persons/:id/history` | 該成員的服藥紀錄 |
| `/persons/:id/settings` | 稱呼與標示顏色 |

進入某位成員後，畫面上方持續顯示目前是誰，按「換人」才會離開。

## 專案結構

```
server.js              Express 進入點、錯誤處理
src/db.js              SQLite schema 與遷移
src/seed.js            示範資料
src/lib/context.js     人員 context 與資料歸屬驗證（核心）
src/lib/queries.js     所有查詢，全部以 person_id 為界線
src/lib/uploads.js     仿單／藥袋的儲存與讀取
src/lib/icons.js       介面線條圖示
src/lib/format.js      日期、劑量文字、成員配色
src/routes/            root（選人）、person（今日／排序／紀錄／設定）、medications
views/                 EJS 樣板
public/                CSS 與前端 JS
```

## 藥品顏色

每個藥品可以標記實際藥錠／膠囊的顏色（白、米黃、黃、橘、粉紅、紅、棕、綠、藍、紫、透明），
在「新增／編輯藥品」表單裡選，今日用藥、藥品清單、排序頁都會在藥名前面顯示對應的色點，
方便拿到藥時直接核對。顏色是選填的，沒選就不會顯示色點。

顏色屬於 Medication，所以跟其他資料一樣是跟著人走的：
媽媽的「血壓藥」標粉紅，不會影響爸爸的「血壓藥」。

## 備註

- 定位是家中內網自用，沒有帳號密碼；隔離是為了避免「以為在改媽媽，結果存到爸爸身上」。
  若要放到外網，必須另外加上登入機制。
- 藥品「停用」不會刪掉歷史紀錄，「刪除」才會連同仿單與紀錄一起移除。
