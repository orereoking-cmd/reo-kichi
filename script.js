(() => {
  const STORAGE_KEY = 'reo-kichi-memos';
  const DEFAULT_TAG = 'personal_memo';

  const TAGS = {
    personal_task: { icon: '✅', label: '通常タスク', group: 'personal', task: true },
    personal_memo: { icon: '💡', label: 'アイデア・メモ', group: 'personal', task: false },
    nekkyo_routine: { icon: '🔁', label: 'ルーティンタスク', group: 'nekkyo', task: true },
    nekkyo_task: { icon: '✅', label: '通常タスク', group: 'nekkyo', task: true },
    nekkyo_think: { icon: '🧠', label: '思考タスク', group: 'nekkyo', task: true },
    nekkyo_system: { icon: '⚙️', label: '仕組化タスク', group: 'nekkyo', task: true },
    nekkyo_memo: { icon: '💡', label: 'アイデア・メモ', group: 'nekkyo', task: false },
  };

  // Only tags with an unambiguous name get hashtag auto-detection.
  // "通常タスク" / "アイデア・メモ" exist in both groups, so they're chip-only.
  const HASHTAG_MAP = {
    '#ルーティン': 'nekkyo_routine',
    '#routine': 'nekkyo_routine',
    '#思考': 'nekkyo_think',
    '#think': 'nekkyo_think',
    '#仕組化': 'nekkyo_system',
    '#system': 'nekkyo_system',
  };

  const HASHTAG_HIGHLIGHT = /#(ルーティン|routine|思考|think|仕組化|system)/gi;

  const DEFAULT_TAG_BY_GROUP = { personal: 'personal_memo', nekkyo: 'nekkyo_memo' };
  const GROUP_LABEL = { personal: '個人', nekkyo: 'Nekkyo' };
  const VIEW_KEY = 'reo-kichi-view';
  const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
  const ROUTINE_TAG = 'nekkyo_routine';

  const memoInput = document.getElementById('memoInput');
  const addBtn = document.getElementById('addBtn');
  const tagSelector = document.getElementById('tagSelector');
  const viewTabs = document.getElementById('viewTabs');
  const memoList = document.getElementById('memoList');
  const emptyState = document.getElementById('emptyState');
  const logCount = document.getElementById('logCount');
  const toast = document.getElementById('toast');

  const menuToggle = document.getElementById('menuToggle');
  const menuPanel = document.getElementById('menuPanel');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuClose = document.getElementById('menuClose');

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const clearBtn = document.getElementById('clearBtn');

  const dueDateRow = document.getElementById('dueDateRow');
  const dueDateInput = document.getElementById('dueDateInput');
  const recurRow = document.getElementById('recurRow');
  const recurDays = document.getElementById('recurDays');
  const hideCompletedToggle = document.getElementById('hideCompletedToggle');

  const HIDE_COMPLETED_KEY = 'reo-kichi-hide-completed';

  let selectedTag = DEFAULT_TAG;
  let selectedRecurDay = null;
  let memos = loadMemos();
  let hideCompleted = localStorage.getItem(HIDE_COMPLETED_KEY) !== 'false';
  hideCompletedToggle.checked = hideCompleted;
  let currentView = localStorage.getItem(VIEW_KEY) === 'nekkyo' ? 'nekkyo' : 'personal';

  function isTaskTag(tag) {
    return Boolean(TAGS[tag] && TAGS[tag].task);
  }

  function selectTag(tagKey) {
    selectedTag = tagKey;
    tagSelector.querySelectorAll('.tag-chip').forEach((c) => c.classList.toggle('is-active', c.dataset.tag === tagKey));
    dueDateRow.classList.toggle('is-hidden', !isTaskTag(selectedTag) || selectedTag === ROUTINE_TAG);
    recurRow.classList.toggle('is-hidden', selectedTag !== ROUTINE_TAG);
  }

  function todayISODate() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // The most recent date (possibly today) that falls on the given weekday (0=Sun..6=Sat).
  function mostRecentOccurrence(recurDay) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = (today.getDay() - recurDay + 7) % 7;
    today.setDate(today.getDate() - diff);
    return today;
  }

  function isRoutineDoneThisCycle(memo) {
    if (memo.recurDay === null || memo.recurDay === undefined || !memo.lastCompletedAt) return false;
    const cycleStart = mostRecentOccurrence(memo.recurDay);
    const completedDate = new Date(memo.lastCompletedAt);
    completedDate.setHours(0, 0, 0, 0);
    return completedDate >= cycleStart;
  }

  function isMemoComplete(memo) {
    if (memo.tag === ROUTINE_TAG && memo.recurDay !== null && memo.recurDay !== undefined) {
      return isRoutineDoneThisCycle(memo);
    }
    return Boolean(memo.completed);
  }

  function setView(group) {
    currentView = group;
    localStorage.setItem(VIEW_KEY, group);
    viewTabs.querySelectorAll('.view-tab').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.group === group));
    tagSelector.querySelectorAll('.tag-group').forEach((g) => g.classList.toggle('is-hidden-group', g.dataset.group !== group));
    selectTag(DEFAULT_TAG_BY_GROUP[group]);
    render();
  }

  function loadMemos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveMemos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  }

  function detectTagFromText(text) {
    const lower = text.toLowerCase();
    for (const [hashtag, tag] of Object.entries(HASHTAG_MAP)) {
      if (lower.includes(hashtag.toLowerCase())) return tag;
    }
    return null;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderText(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(HASHTAG_HIGHLIGHT, '<span class="hashtag">#$1</span>');
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatDueDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  }

  function isOverdue(memo) {
    if (memo.tag === ROUTINE_TAG || !memo.dueDate || memo.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(memo.dueDate) < today;
  }

  function render() {
    memoList.innerHTML = '';
    const inView = memos.filter((m) => (TAGS[m.tag] || TAGS[DEFAULT_TAG]).group === currentView);
    const visible = inView.filter((m) => !(hideCompleted && isTaskTag(m.tag) && isMemoComplete(m)));
    const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    for (const memo of sorted) {
      const tagInfo = TAGS[memo.tag] || TAGS[DEFAULT_TAG];
      const li = document.createElement('li');
      const completed = isTaskTag(memo.tag) && isMemoComplete(memo);
      li.className = `memo-card card-${memo.tag}${completed ? ' is-completed' : ''}`;
      li.dataset.id = memo.id;

      const checkboxHtml = isTaskTag(memo.tag)
        ? `<input type="checkbox" class="memo-complete-checkbox" data-id="${memo.id}" ${completed ? 'checked' : ''} aria-label="完了">`
        : '';
      let dueBadgeHtml = '';
      if (memo.tag === ROUTINE_TAG && memo.recurDay !== null && memo.recurDay !== undefined) {
        dueBadgeHtml = `<span class="due-badge">🔁 毎週${WEEKDAY_LABELS[memo.recurDay]}</span>`;
      } else if (isTaskTag(memo.tag) && memo.dueDate) {
        dueBadgeHtml = `<span class="due-badge${isOverdue(memo) ? ' is-overdue' : ''}">📅 ${formatDueDate(memo.dueDate)}</span>`;
      }

      li.innerHTML = `
        <div class="memo-card-head">
          <div class="memo-meta">
            ${checkboxHtml}
            <span class="tag-chip tag-${memo.tag} is-active">${tagInfo.icon} ${tagInfo.label}</span>
            <span class="memo-time">${formatTime(memo.createdAt)}</span>
            ${dueBadgeHtml}
          </div>
          <button class="memo-delete" aria-label="削除" data-id="${memo.id}">×</button>
        </div>
        <div class="memo-text${completed ? ' is-struck' : ''}">${renderText(memo.text)}</div>
      `;
      memoList.appendChild(li);
    }

    logCount.textContent = `${inView.length}件`;
    emptyState.classList.toggle('is-visible', inView.length === 0);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function addMemo() {
    const text = memoInput.value.trim();
    if (!text) return;

    const detected = detectTagFromText(text);
    const tag = detected || selectedTag;

    const memo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      tag,
      createdAt: new Date().toISOString(),
    };

    if (tag === ROUTINE_TAG) {
      memo.recurDay = selectedRecurDay;
      memo.lastCompletedAt = null;
    } else if (isTaskTag(tag)) {
      memo.completed = false;
      memo.dueDate = dueDateInput.value || null;
    }

    memos.push(memo);
    saveMemos();

    const tagInfo = TAGS[tag];
    if (tagInfo.group !== currentView) {
      showToast(`${GROUP_LABEL[tagInfo.group]}の${tagInfo.icon} ${tagInfo.label}として追加しました`);
    }

    memoInput.value = '';
    dueDateInput.value = '';
    selectedRecurDay = null;
    recurDays.querySelectorAll('.recur-day').forEach((c) => c.classList.remove('is-active'));
    render();
    memoInput.focus();
  }

  memoInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      addMemo();
    }
  });

  addBtn.addEventListener('click', addMemo);

  tagSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-chip');
    if (!btn) return;
    selectTag(btn.dataset.tag);
  });

  viewTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;
    setView(btn.dataset.group);
  });

  recurDays.addEventListener('click', (e) => {
    const btn = e.target.closest('.recur-day');
    if (!btn) return;
    selectedRecurDay = Number(btn.dataset.day);
    recurDays.querySelectorAll('.recur-day').forEach((c) => c.classList.toggle('is-active', c === btn));
  });

  memoList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.memo-delete');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      memos = memos.filter((m) => m.id !== id);
      saveMemos();
      render();
      return;
    }

    const checkbox = e.target.closest('.memo-complete-checkbox');
    if (checkbox) {
      const id = checkbox.dataset.id;
      const memo = memos.find((m) => m.id === id);
      if (memo) {
        if (memo.tag === ROUTINE_TAG && memo.recurDay !== null && memo.recurDay !== undefined) {
          memo.lastCompletedAt = checkbox.checked ? todayISODate() : null;
        } else {
          memo.completed = checkbox.checked;
        }
        saveMemos();
        render();
      }
    }
  });

  hideCompletedToggle.addEventListener('change', () => {
    hideCompleted = hideCompletedToggle.checked;
    localStorage.setItem(HIDE_COMPLETED_KEY, String(hideCompleted));
    render();
  });

  // Menu panel
  function openMenu() {
    menuPanel.classList.add('is-open');
    menuOverlay.classList.add('is-open');
    menuPanel.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    menuPanel.classList.remove('is-open');
    menuOverlay.classList.remove('is-open');
    menuPanel.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  menuToggle.addEventListener('click', () => {
    menuPanel.classList.contains('is-open') ? closeMenu() : openMenu();
  });
  menuClose.addEventListener('click', closeMenu);
  menuOverlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // Export
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(memos, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    a.href = url;
    a.download = `reo-kichi-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('エクスポートしました');
  });

  // Import
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error('invalid');
        const existingIds = new Set(memos.map((m) => m.id));
        let added = 0;
        for (const item of parsed) {
          if (!item || typeof item.text !== 'string') continue;
          const tag = TAGS[item.tag] ? item.tag : DEFAULT_TAG;
          const id = item.id && !existingIds.has(item.id)
            ? item.id
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          existingIds.add(id);
          const newMemo = {
            id,
            text: item.text,
            tag,
            createdAt: item.createdAt || new Date().toISOString(),
          };
          if (tag === ROUTINE_TAG) {
            newMemo.recurDay = Number.isInteger(item.recurDay) ? item.recurDay : null;
            newMemo.lastCompletedAt = typeof item.lastCompletedAt === 'string' ? item.lastCompletedAt : null;
          } else if (isTaskTag(tag)) {
            newMemo.completed = Boolean(item.completed);
            newMemo.dueDate = typeof item.dueDate === 'string' ? item.dueDate : null;
          }
          memos.push(newMemo);
          added++;
        }
        saveMemos();
        render();
        showToast(`${added}件を読み込みました`);
      } catch (e) {
        showToast('読み込みに失敗しました');
      } finally {
        importFile.value = '';
      }
    };
    reader.readAsText(file);
  });

  // Clear all
  clearBtn.addEventListener('click', () => {
    if (memos.length === 0) return;
    const ok = confirm('この基地の全メモを削除します。元に戻せません。よろしいですか？');
    if (!ok) return;
    memos = [];
    saveMemos();
    render();
    closeMenu();
    showToast('全データを削除しました');
  });

  setView(currentView);
})();
