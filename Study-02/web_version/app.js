// 작성: 2026-10-02 00:58 (Study-02/app.js를 그대로 가져옴, 기능 코드는 동일)

const STORAGE_KEYS = { todos: 'todo-app:todos', filter: 'todo-app:filter', theme: 'todo-app:theme', classify: 'todo-app:classify' };
const MAX_TITLE = 100;

// 카테고리 정의 — 카테고리 정보는 여기에만 둔다. 색은 style.css 변수라서 다크 모드에서 함께 바뀐다
// keywords: 제목에 들어 있으면 그 카테고리로 자동 분류 (영문은 소문자로 적음)
const CATEGORIES = {
  work: {
    label: '업무',
    color: 'var(--cat-work)',
    keywords: ['업무', '회의', '미팅', '보고서', '보고', '메일', '기획', '발표', '결재', '거래처', '회사', '출근', '출장', '프로젝트', '마감', '계약', '견적', 'meeting'],
  },
  personal: {
    label: '개인',
    color: 'var(--cat-personal)',
    keywords: ['장보기', '마트', '운동', '헬스', '산책', '병원', '약속', '청소', '빨래', '설거지', '은행', '택배', '생일', '가족', '친구', '요리', '쇼핑', '이사'],
  },
  study: {
    label: '공부',
    color: 'var(--cat-study)',
    keywords: ['공부', '강의', '인강', '과제', '시험', '복습', '예습', '독서', '책', '영어', '단어', '수학', '문제집', '논문', '코딩', '자격증', 'toeic', '토익'],
  },
};

// 상태: 할 일 배열과 현재 필터
let todos = [];
let currentFilter = 'all';

const $ = (id) => document.getElementById(id);
const form = $('todo-form');
const input = $('todo-input');
const categorySelect = $('category-select');
const filterTabs = $('filter-tabs');
const list = $('todo-list');
const emptyMessage = $('empty-message');
const progressText = $('progress-text');
const progressBar = $('progress-bar');
const progressMessage = $('progress-message');
const categoryProgress = $('category-progress');
const remainingCount = $('remaining-count');
const clearCompletedBtn = $('clear-completed-btn');
const themeToggle = $('theme-toggle');
const importInput = $('import-input');
const autoHint = $('auto-hint');
const reclassifyBtn = $('reclassify-btn');
const classifyDialog = $('classify-dialog');
const classifyEnabled = $('classify-enabled');
const classifyThreshold = $('classify-threshold');
const classifyThresholdValue = $('classify-threshold-value');
const classifyIncludeCompleted = $('classify-include-completed');

// 분류 설정: 사용 여부, 신뢰도 임계값(0.5~1), 재분류 때 완료 항목 포함 여부
const DEFAULT_CLASSIFY = { enabled: true, threshold: 0.6, includeCompleted: false };
let classifySettings = { ...DEFAULT_CLASSIFY };

// 입력 영역 UI 상태(저장 안 함): 사용자가 직접 고른 카테고리와, 이번 입력에서 직접 골랐는지 여부
let chosenCategory = 'work';
let categoryPicked = false;

// ---------- 검증 ----------

function isCategory(key) {
  return Object.hasOwn(CATEGORIES, key);
}

function isFilter(value) {
  return value === 'all' || isCategory(value);
}

function createId() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 불러오거나 가져온 항목 정리: 제목 없는 항목 제외, 100자 제한, 카테고리·완료 여부 보정, 없거나 중복된 id는 새로 발급
function sanitizeTodos(items) {
  const ids = new Set();
  return items
    .filter((item) => item && typeof item.title === 'string' && item.title.trim())
    .map((item) => {
      let id = item.id == null ? '' : String(item.id);
      if (!id || ids.has(id)) id = createId();
      ids.add(id);
      const completed = item.completed === true;
      return {
        id,
        title: item.title.trim().slice(0, MAX_TITLE),
        category: isCategory(item.category) ? item.category : 'work',
        completed,
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
        completedAt: completed ? (Number.isFinite(item.completedAt) ? item.completedAt : Date.now()) : null,
      };
    });
}

// ---------- 저장 ----------

// 저장소를 쓸 수 없으면(차단, 용량 초과) 안내만 띄우고 메모리 상태로 계속 동작
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    $('storage-warning').hidden = false;
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    $('storage-warning').hidden = false;
  }
}

// 값이 없거나, 파싱 실패, 배열이 아니면 빈 배열로 시작
function loadTodos() {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.todos));
    return Array.isArray(parsed) ? sanitizeTodos(parsed) : [];
  } catch (error) {
    return [];
  }
}

function saveTodos() {
  writeStorage(STORAGE_KEYS.todos, JSON.stringify(todos));
}

function loadFilter() {
  const saved = readStorage(STORAGE_KEYS.filter);
  return isFilter(saved) ? saved : 'all';
}

// ---------- 상태 변경: 모두 "상태 변경 → save → render" ----------

function addTodo(title, category) {
  const trimmed = title.trim().slice(0, MAX_TITLE);
  if (!trimmed) return;
  todos.push({
    id: createId(),
    title: trimmed,
    category: isCategory(category) ? category : 'work',
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  });
  saveTodos();
  render();
}

// 빈 제목이나 잘못된 카테고리로는 바꾸지 않고 원래 값을 유지
function updateTodo(id, changes) {
  todos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    const next = { ...todo, ...changes };
    next.title = String(next.title).trim().slice(0, MAX_TITLE) || todo.title;
    if (!isCategory(next.category)) next.category = todo.category;
    return next;
  });
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  updateTodo(id, { completed: !todo.completed, completedAt: todo.completed ? null : Date.now() });
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
}

// 완료 항목 일괄 삭제 (F-10): 확인 창을 거쳐 한 번에 삭제
function clearCompleted() {
  const count = todos.filter((todo) => todo.completed).length;
  if (count === 0 || !confirm(`완료한 할 일 ${count}개를 삭제할까요?`)) return;
  todos = todos.filter((todo) => !todo.completed);
  saveTodos();
  render();
}

function setFilter(filter) {
  if (!isFilter(filter)) return;
  currentFilter = filter;
  writeStorage(STORAGE_KEYS.filter, filter);
  render();
}

// ---------- 계산 ----------

// 완료 수 ÷ 전체 수 × 100, 반올림. 할 일이 없으면 0%
function getProgress(items) {
  const total = items.length;
  const done = items.filter((todo) => todo.completed).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// 키워드 점수로 카테고리 추론: 점수 = 맞은 키워드 길이의 합, 신뢰도 = 1등 점수 ÷ 전체 점수
// (예: '저녁 산책'은 개인 '산책' 2점, 공부 '책' 1점 → 개인, 신뢰도 67%). 맞은 키워드가 없거나 1등이 동점이면 null
function scoreCategory(title) {
  const text = title.toLowerCase();
  const scores = Object.entries(CATEGORIES).map(([key, { keywords }]) => ({
    category: key,
    score: keywords.filter((keyword) => text.includes(keyword)).reduce((sum, keyword) => sum + keyword.length, 0),
  }));
  const total = scores.reduce((sum, { score }) => sum + score, 0);
  const best = Math.max(...scores.map(({ score }) => score));
  const winners = scores.filter(({ score }) => score === best);
  if (total === 0 || winners.length > 1) return null;
  return { category: winners[0].category, confidence: best / total };
}

// 설정을 반영한 자동 분류 결과: 꺼져 있거나 신뢰도가 임계값보다 낮으면 null
function detectCategory(title) {
  if (!classifySettings.enabled) return null;
  const result = scoreCategory(title);
  return result && result.confidence >= classifySettings.threshold ? result.category : null;
}

function getTodosIn(filter) {
  return filter === 'all' ? todos : todos.filter((todo) => todo.category === filter);
}

// ---------- 렌더링 (사용자 문자열은 textContent로만 넣음) ----------

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createIconButton(className, icon, label) {
  const button = createElement('button', `icon-btn ${className}`, icon);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  return button;
}

function createCategorySelect(className, selected) {
  const select = createElement('select', className);
  Object.entries(CATEGORIES).forEach(([key, { label }]) => select.add(new Option(label, key, false, key === selected)));
  return select;
}

function createTodoItem(todo) {
  const li = createElement('li', 'todo-item' + (todo.completed ? ' completed' : ''));
  li.dataset.id = todo.id;

  const checkbox = createElement('input', 'todo-checkbox');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.completed;
  checkbox.setAttribute('aria-label', `'${todo.title}' 완료`);

  const badge = createElement('span', 'category-badge', CATEGORIES[todo.category].label);
  badge.style.setProperty('--badge-color', CATEGORIES[todo.category].color);

  const actions = createElement('div', 'item-actions');
  actions.append(
    createIconButton('edit-btn', '✎', `'${todo.title}' 수정`),
    createIconButton('delete-btn', '✕', `'${todo.title}' 삭제`),
  );

  li.append(checkbox, createElement('span', 'todo-title', todo.title), badge, actions);
  return li;
}

function renderList() {
  const visible = getTodosIn(currentFilter);
  list.replaceChildren(...visible.map(createTodoItem));
  emptyMessage.hidden = visible.length > 0;
  emptyMessage.textContent = todos.length === 0 ? '오늘 할 일을 추가해 보세요' : '이 카테고리에 할 일이 없어요';
}

// 탭은 한 번만 만들고 숫자·선택 상태만 바꿔 키보드 포커스를 유지
function renderFilterTabs() {
  filterTabs.querySelectorAll('.filter-tab').forEach((tab) => {
    const selected = tab.dataset.filter === currentFilter;
    tab.querySelector('.filter-count').textContent = getTodosIn(tab.dataset.filter).length;
    tab.classList.toggle('selected', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
}

function updateBar(bar, { done, total, percent }) {
  bar.firstElementChild.style.width = `${percent}%`;
  bar.setAttribute('aria-valuenow', String(percent));
  bar.setAttribute('aria-valuetext', `${total}개 중 ${done}개 완료 (${percent}%)`);
}

// 전체 진행률은 필터와 상관없이 모든 할 일 기준
function renderProgress() {
  const overall = getProgress(todos);
  progressText.textContent = `${overall.done} / ${overall.total} 완료 (${overall.percent}%)`;
  updateBar(progressBar, overall);

  progressMessage.hidden = overall.total > 0 && overall.percent < 100;
  progressMessage.textContent = overall.total === 0 ? '아직 할 일이 없어요' : '오늘 할 일 완료!';

  categoryProgress.querySelectorAll('.category-progress-row').forEach((row) => {
    const progress = getProgress(getTodosIn(row.dataset.category));
    row.querySelector('.category-progress-count').textContent = `${progress.done}/${progress.total}`;
    updateBar(row.querySelector('.progress-bar'), progress);
  });

  remainingCount.textContent = `남은 할 일 ${overall.total - overall.done}개`;
  clearCompletedBtn.disabled = overall.done === 0;
}

function render() {
  renderList();
  renderFilterTabs();
  renderProgress();
}

// 다시 그린 뒤 같은 항목으로 포커스를 돌려 키보드 사용을 이어 감 (항목이 없으면 입력창)
function focusItem(id, selector) {
  const item = id && list.querySelector(`[data-id="${CSS.escape(id)}"]`);
  (item ? item.querySelector(selector) : input).focus();
}

// ---------- 인라인 수정 (화면에서만 바뀌고, 끝낼 때 updateTodo 또는 render) ----------

function startEdit(li) {
  if (li.classList.contains('editing')) return;
  const todo = todos.find((item) => item.id === li.dataset.id);

  const editInput = createElement('input', 'edit-input');
  editInput.maxLength = MAX_TITLE;
  editInput.value = todo.title;
  editInput.setAttribute('aria-label', `'${todo.title}' 제목 수정`);
  const editSelect = createCategorySelect('edit-select', todo.category);
  editSelect.setAttribute('aria-label', `'${todo.title}' 카테고리 수정`);

  li.classList.add('editing');
  li.querySelector('.todo-title').after(editInput, editSelect);
  editInput.focus();
  editInput.select();
}

// Enter·포커스 이탈은 저장, Esc는 취소. 이미 끝난 수정은 무시(blur 중복 방지)
function finishEdit(li, save) {
  if (!li.isConnected || !li.classList.contains('editing')) return;
  li.classList.remove('editing');
  const id = li.dataset.id;
  if (save) {
    updateTodo(id, { title: li.querySelector('.edit-input').value, category: li.querySelector('.edit-select').value });
  } else {
    render();
  }
}

// ---------- 다크 모드 (처음 값은 index.html의 인라인 스크립트가 정함) ----------

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.title = dark ? '라이트 모드로 전환' : '다크 모드로 전환';
  themeToggle.textContent = dark ? '☀︎' : '☾';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  writeStorage(STORAGE_KEYS.theme, next);
  applyTheme(next);
}

// ---------- 자동 분류·재분류 ----------

// 입력하는 동안 키워드로 카테고리 자동 선택. 직접 고른 경우에는 건드리지 않음
function applyAutoCategory() {
  if (categoryPicked) return;
  const detected = detectCategory(input.value);
  categorySelect.value = detected || chosenCategory;
  autoHint.textContent = getAutoHint(input.value, detected);
}

// 안내 문구: 분류됐으면 신뢰도와 함께, 키워드는 있지만 임계값 미달이면 그 이유를 표시
function getAutoHint(title, detected) {
  const result = classifySettings.enabled && scoreCategory(title);
  if (!result) return '';
  const percent = Math.round(result.confidence * 100);
  if (detected) return `${withRo(CATEGORIES[detected].label)} 자동 분류 (신뢰도 ${percent}%)`;
  return `신뢰도 ${percent}%로 기준(${Math.round(classifySettings.threshold * 100)}%)보다 낮아 자동 분류하지 않음`;
}

// 재분류 대상: 설정에 따라 완료 항목 포함, 키워드로 다른 카테고리가 나온 항목만
function getReclassifyChanges() {
  return todos
    .filter((todo) => classifySettings.includeCompleted || !todo.completed)
    .map((todo) => ({ todo, category: detectCategory(todo.title) }))
    .filter(({ todo, category }) => category && category !== todo.category);
}

// 바뀔 항목을 확인 창으로 미리 보여 준 뒤 한 번에 적용
function reclassifyTodos() {
  const changes = getReclassifyChanges();
  if (changes.length === 0) {
    alert('카테고리를 바꿀 할 일이 없습니다');
    return;
  }
  const short = (text) => (text.length > 20 ? `${text.slice(0, 20)}…` : text);
  const preview = changes.slice(0, 5)
    .map(({ todo, category }) => `· ${short(todo.title)}: ${CATEGORIES[todo.category].label} → ${CATEGORIES[category].label}`)
    .join('\n');
  const more = changes.length > 5 ? `\n…외 ${changes.length - 5}개` : '';
  if (!confirm(`할 일 ${changes.length}개의 카테고리를 바꿀까요?\n\n${preview}${more}`)) return;

  const next = new Map(changes.map(({ todo, category }) => [todo.id, category]));
  todos = todos.map((todo) => (next.has(todo.id) ? { ...todo, category: next.get(todo.id) } : todo));
  saveTodos();
  render();
}

// 저장된 분류 설정 불러오기: 값마다 검사하고 잘못되면 기본값
function loadClassifySettings() {
  try {
    const saved = JSON.parse(readStorage(STORAGE_KEYS.classify)) || {};
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_CLASSIFY.enabled,
      threshold: Number.isFinite(saved.threshold) ? Math.min(1, Math.max(0.5, saved.threshold)) : DEFAULT_CLASSIFY.threshold,
      includeCompleted: saved.includeCompleted === true,
    };
  } catch (error) {
    return { ...DEFAULT_CLASSIFY };
  }
}

function setClassifySettings(changes) {
  classifySettings = { ...classifySettings, ...changes };
  writeStorage(STORAGE_KEYS.classify, JSON.stringify(classifySettings));
  renderClassifySettings();
}

// 설정 창 컨트롤과 재분류 버튼 갱신, 입력 중인 제목도 새 설정으로 다시 분류
function renderClassifySettings() {
  const { enabled, threshold, includeCompleted } = classifySettings;
  classifyEnabled.checked = enabled;
  classifyThreshold.value = String(Math.round(threshold * 100));
  classifyThresholdValue.textContent = `${Math.round(threshold * 100)}%`;
  classifyIncludeCompleted.checked = includeCompleted;
  classifyThreshold.disabled = !enabled;
  classifyIncludeCompleted.disabled = !enabled;
  reclassifyBtn.disabled = !enabled;
  applyAutoCategory();
}

// ---------- 백업 (F-14) ----------

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function exportTodos() {
  const backup = { app: 'todo-app', version: 1, exportedAt: new Date().toISOString(), todos };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `todo-backup-${formatDate(new Date())}.json`;
  link.click();
  // 바로 해제하면 일부 브라우저에서 다운로드가 취소되므로 잠시 뒤 해제
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 형식이 맞으면 정리된 할 일 배열, 아니면 null
function parseBackup(text) {
  try {
    const data = JSON.parse(text);
    const valid = data && data.app === 'todo-app' && data.version === 1 && Array.isArray(data.todos);
    return valid ? sanitizeTodos(data.todos) : null;
  } catch (error) {
    return null;
  }
}

async function importTodos(file) {
  const imported = parseBackup(await file.text().catch(() => ''));
  if (!imported) {
    alert('올바른 백업 파일이 아닙니다');
    return;
  }
  if (!confirm(`현재 할 일 ${todos.length}개를 가져온 ${imported.length}개로 대체할까요?`)) return;
  todos = imported;
  saveTodos();
  render();
}

// 받침에 맞춰 '로/으로' 붙이기 (받침 없음·ㄹ 받침은 '로')
function withRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;
  return word + (final === 0 || final === 8 ? '로' : '으로');
}

// 추가 후: 자동 분류를 풀고 사용자가 직접 고른 카테고리로 되돌림
function resetAutoCategory() {
  categoryPicked = false;
  categorySelect.value = chosenCategory;
  autoHint.textContent = '';
}

// ---------- 처음 한 번 만드는 화면 요소 (CATEGORIES 기준) ----------

function buildFilterTabs() {
  const filters = [['all', '전체'], ...Object.entries(CATEGORIES).map(([key, { label }]) => [key, label])];
  filters.forEach(([filter, label]) => {
    const tab = createElement('button', 'filter-tab', `${label} `);
    tab.type = 'button';
    tab.dataset.filter = filter;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'todo-list');
    tab.append(createElement('span', 'filter-count'));
    filterTabs.append(tab);
  });
}

function buildCategoryProgress() {
  Object.entries(CATEGORIES).forEach(([key, { label, color }]) => {
    const row = createElement('div', 'category-progress-row');
    row.dataset.category = key;

    const bar = createElement('div', 'progress-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-label', `${label} 진행률`);
    bar.style.setProperty('--bar-color', color);
    bar.append(createElement('div', 'progress-fill'));

    row.append(createElement('span', 'category-progress-name', label), bar, createElement('span', 'category-progress-count'));
    categoryProgress.append(row);
  });
}

// ---------- 이벤트 ----------

// 추가: Enter와 버튼 모두 submit. 카테고리 선택은 그대로 유지
form.addEventListener('submit', (event) => {
  event.preventDefault();
  addTodo(input.value, categorySelect.value);
  input.value = '';
  resetAutoCategory();
  input.focus();
});

input.addEventListener('input', applyAutoCategory);

categorySelect.addEventListener('change', () => {
  chosenCategory = categorySelect.value;
  categoryPicked = true;
  autoHint.textContent = '';
});

filterTabs.addEventListener('click', (event) => {
  const tab = event.target.closest('.filter-tab');
  if (tab) setFilter(tab.dataset.filter);
});

// 목록 이벤트는 모두 <ul>에 위임하고 data-id로 항목을 찾음
list.addEventListener('change', (event) => {
  if (!event.target.matches('.todo-checkbox')) return;
  const id = event.target.closest('.todo-item').dataset.id;
  toggleTodo(id);
  focusItem(id, '.todo-checkbox');
});

list.addEventListener('click', (event) => {
  const item = event.target.closest('.todo-item');
  if (event.target.closest('.edit-btn')) startEdit(item);
  if (!event.target.closest('.delete-btn')) return;

  // 삭제 후에는 다음 항목(없으면 이전 항목, 그것도 없으면 입력창)으로 포커스 이동
  const neighbor = item.nextElementSibling || item.previousElementSibling;
  deleteTodo(item.dataset.id);
  focusItem(neighbor && neighbor.dataset.id, '.delete-btn');
});

list.addEventListener('dblclick', (event) => {
  if (event.target.matches('.todo-title')) startEdit(event.target.closest('.todo-item'));
});

list.addEventListener('keydown', (event) => {
  if (!event.target.matches('.edit-input, .edit-select')) return;
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    const li = event.target.closest('.todo-item');
    finishEdit(li, event.key === 'Enter');
    focusItem(li.dataset.id, '.edit-btn');
  }
});

// 수정 중 입력창 ↔ 카테고리 사이 이동은 계속 수정, 그 밖으로 포커스가 나가면 저장
list.addEventListener('focusout', (event) => {
  if (!event.target.matches('.edit-input, .edit-select')) return;
  const li = event.target.closest('.todo-item');
  const next = event.relatedTarget;
  if (next && li.contains(next) && next.matches('.edit-input, .edit-select')) return;

  // 목록 안의 다른 요소로 가던 중이면, 다시 그린 뒤 같은 요소로 포커스를 이어 줌
  const nextItem = next && list.contains(next) && next.closest('.todo-item');
  const selector = nextItem && ['.todo-checkbox', '.edit-btn', '.delete-btn'].find((s) => next.matches(s));
  finishEdit(li, true);
  if (selector) focusItem(nextItem.dataset.id, selector);
});

themeToggle.addEventListener('click', toggleTheme);
clearCompletedBtn.addEventListener('click', () => {
  clearCompleted();
  // 버튼이 비활성화되면 포커스를 잃으므로 입력창으로 옮김
  if (clearCompletedBtn.disabled) input.focus();
});
$('export-btn').addEventListener('click', exportTodos);
$('import-btn').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async () => {
  if (importInput.files[0]) await importTodos(importInput.files[0]);
  importInput.value = ''; // 같은 파일을 다시 고를 수 있게
});

reclassifyBtn.addEventListener('click', reclassifyTodos);
$('classify-settings-btn').addEventListener('click', () => classifyDialog.showModal());
classifyEnabled.addEventListener('change', () => setClassifySettings({ enabled: classifyEnabled.checked }));
classifyThreshold.addEventListener('input', () => setClassifySettings({ threshold: Number(classifyThreshold.value) / 100 }));
classifyIncludeCompleted.addEventListener('change', () => setClassifySettings({ includeCompleted: classifyIncludeCompleted.checked }));

// ---------- 시작 ----------

todos = loadTodos();
currentFilter = loadFilter();
Object.entries(CATEGORIES).forEach(([key, { label }]) => categorySelect.add(new Option(label, key)));
buildFilterTabs();
buildCategoryProgress();
classifySettings = loadClassifySettings();
renderClassifySettings();
applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
$('today').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
render();
input.focus();
