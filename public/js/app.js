// 漸進增強：沒有 JS 時所有功能仍可用（表單送出 + 重新整理），
// 有 JS 時勾選不跳頁、排序可拖曳。

// ---------------------------------------------------------------- 危險操作確認
document.addEventListener('submit', (e) => {
  const message = e.target.dataset.confirm;
  if (message && !confirm(message)) e.preventDefault();
});

// ------------------------------------------------------------ 今日：勾選服藥
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.classList.contains('js-toggle')) return;

  e.preventDefault();
  const button = form.querySelector('.dose');
  const wasDone = button.classList.contains('is-done');

  // 先更新畫面，失敗再還原
  setDoseState(button, !wasDone, null);

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams(new FormData(form)),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    setDoseState(button, Boolean(data.taken_at), data.taken_at);
    updateProgress();
  } catch {
    setDoseState(button, wasDone, null);
    form.submit(); // 退回一般表單送出，讓使用者看到真正的結果
  }
});

function setDoseState(button, done, takenAt) {
  button.classList.toggle('is-done', done);
  button.setAttribute('aria-pressed', String(done));
  const time = button.querySelector('.dose__time');
  if (time) time.textContent = done ? formatTime(takenAt ?? new Date()) : '';
}

function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateProgress() {
  const doses = [...document.querySelectorAll('.dose')];
  const progress = document.querySelector('.progress strong');
  if (progress) progress.textContent = String(doses.filter((d) => d.classList.contains('is-done')).length);

  for (const section of document.querySelectorAll('.section')) {
    const count = section.querySelector('.count');
    if (!count) continue;
    const items = [...section.querySelectorAll('.dose')];
    count.textContent = `${items.filter((d) => d.classList.contains('is-done')).length}/${items.length}`;
  }
}

// ------------------------------------------------------------------ 新增藥品
// 勾選時段才讓劑量欄位看起來可用
document.addEventListener('change', (e) => {
  if (e.target.matches('.slot-row input[type="checkbox"]')) {
    e.target.closest('.slot-row').classList.toggle('is-off', !e.target.checked);
  }
  if (e.target.matches('.file-drop input[type="file"]')) {
    const label = e.target.parentElement.querySelector('.file-drop__label');
    const n = e.target.files.length;
    if (label) label.textContent = n ? `已選擇 ${n} 個檔案` : '📷 拍照上傳（可多張）';
  }
});

// 打字在劑量欄位時自動勾選該時段
document.addEventListener('input', (e) => {
  const row = e.target.closest?.('.slot-row');
  if (!row || !e.target.matches('input[type="text"]') || !e.target.value) return;
  const box = row.querySelector('input[type="checkbox"]');
  if (box && !box.checked) {
    box.checked = true;
    row.classList.remove('is-off');
  }
});

// -------------------------------------------------------------------- 排序頁
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-move]');
  if (!button) return;
  const item = button.closest('li');
  const sibling = button.dataset.move === 'up'
    ? item.previousElementSibling
    : item.nextElementSibling;
  if (!sibling) return;
  button.dataset.move === 'up'
    ? item.parentElement.insertBefore(item, sibling)
    : item.parentElement.insertBefore(sibling, item);
  refreshMoveButtons(item.parentElement);
  item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

function refreshMoveButtons(list) {
  const items = [...list.children];
  items.forEach((li, i) => {
    li.querySelector('[data-move="up"]').disabled = i === 0;
    li.querySelector('[data-move="down"]').disabled = i === items.length - 1;
  });
}

// 以 pointer 事件實作拖曳，手機與滑鼠都通用
function initDrag(list) {
  let dragging = null;

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    dragging = handle.closest('li');
    dragging.classList.add('is-dragging');
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  list.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const target = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el.tagName === 'LI' && el.parentElement === list);
    if (!target || target === dragging) return;

    const box = target.getBoundingClientRect();
    const after = e.clientY > box.top + box.height / 2;
    list.insertBefore(dragging, after ? target.nextElementSibling : target);
  });

  const stop = () => {
    if (!dragging) return;
    dragging.classList.remove('is-dragging');
    dragging = null;
    refreshMoveButtons(list);
  };
  list.addEventListener('pointerup', stop);
  list.addEventListener('pointercancel', stop);
}

for (const list of document.querySelectorAll('[data-sortable]')) {
  refreshMoveButtons(list);
  initDrag(list);
}
