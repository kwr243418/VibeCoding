// 작성: 2026-10-02 01:24 (데스크톱 전용 확장: 진행/완료 묶음, 다중 선택, 우클릭 메뉴, 드래그 순서 변경, 단축키)
//
// app.js는 루트 버전과 같은 파일로 두고, 데스크톱 기능은 여기서만 더한다.
// app.js가 만든 전역 상태(todos 등)와 함수(render, createTodoItem 등)를 그대로 쓰고,
// render·createTodoItem은 원래 함수를 감싸서 바꾼다. 그래서 반드시 app.js 다음에 불러와야 한다.

// ---------- 상태 ----------

const selectedIds = new Set();   // 선택한 할 일 id (화면 상태, 저장 안 함)
let selectionAnchor = null;      // Shift 범위 선택의 시작 항목
let draggedId = null;            // 드래그 중인 항목
let dropTarget = null;           // { id, position: 'before' | 'after' }
let menuTargets = [];            // 우클릭 메뉴가 적용될 id 목록
let menuOriginId = null;         // 메뉴를 연 항목 (닫은 뒤 포커스 복원용)

const composer = document.querySelector('.composer');
const bulkBar = $('bulk-bar');
const bulkCount = $('bulk-count');
const bulkCategory = $('bulk-category');
const selectionStatus = $('selection-status');
const contextMenu = $('context-menu');
const contextCategories = $('context-categories');
const shortcutsDialog = $('shortcuts-dialog');
const ITEM_CONTROLS = ['.todo-checkbox', '.edit-btn', '.delete-btn'];
const wideQuery = window.matchMedia('(min-width: 761px)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

// ---------- 도우미 ----------

function getItems() {
  return [...list.querySelectorAll('.todo-item')];
}

function findItem(id) {
  return id ? list.querySelector(`.todo-item[data-id="${CSS.escape(id)}"]`) : null;
}

function getTodo(id) {
  return todos.find((todo) => todo.id === id);
}

// 글자를 입력하는 곳에서는 단축키를 쓰지 않음
function isTyping(element) {
  return element instanceof Element
    && element.matches('input:not([type]), input[type="text"], input[type="search"], textarea, select, [contenteditable]');
}

function announce(text) {
  selectionStatus.textContent = text;
}

// ---------- 목록 묶음 (F-12: 미완료 먼저, 그 안에서는 저장 순서 = 추가 순서 또는 드래그로 바꾼 순서) ----------

// app.js가 그린 <li>를 "진행 중 / 완료" 두 묶음으로 옮김. 묶음도 #todo-list 안에 있으므로
// app.js의 이벤트 위임·focusItem·삭제 후 포커스 이동이 그대로 동작한다
function groupList() {
  const items = [...list.children];
  if (items.length === 0) return;
  const groups = [
    ['active', '진행 중', '남은 할 일이 없어요', items.filter((li) => !li.classList.contains('completed'))],
    ['done', '완료', '완료한 할 일이 없어요', items.filter((li) => li.classList.contains('completed'))],
  ];
  list.replaceChildren(...groups.map(([key, label, emptyText, groupItems]) => {
    const group = createElement('li', `todo-group todo-group-${key}`);
    const heading = createElement('h2', 'todo-group-title', `${label} `);
    heading.append(createElement('span', 'todo-group-count', String(groupItems.length)));
    if (groupItems.length === 0) {
      group.append(heading, createElement('p', 'todo-group-empty', emptyText));
    } else {
      const sublist = createElement('ul', 'todo-sublist');
      sublist.append(...groupItems);
      group.append(heading, sublist);
    }
    return group;
  }));
}

// ---------- app.js 함수 감싸기 ----------

const baseCreateTodoItem = createTodoItem;
createTodoItem = function (todo) {
  const li = baseCreateTodoItem(todo);
  li.draggable = finePointer.matches; // 마우스 환경에서만 드래그 (터치는 스크롤과 충돌)
  li.classList.toggle('selected', selectedIds.has(todo.id));
  return li;
};

const baseRender = render;
render = function () {
  baseRender();
  // 지워졌거나 필터로 안 보이게 된 항목은 선택에서 뺌
  const visible = new Set(getTodosIn(currentFilter).map((todo) => todo.id));
  selectedIds.forEach((id) => { if (!visible.has(id)) selectedIds.delete(id); });
  groupList();
  updateTabStops();
  renderBulkBar();
};

// ---------- 다중 선택 ----------

function renderBulkBar() {
  bulkBar.hidden = selectedIds.size === 0;
  bulkCount.textContent = `${selectedIds.size}개 선택`;
}

// 다시 그리지 않고 클래스만 바꿔 포커스를 유지
function setSelection(ids, anchor = selectionAnchor) {
  const before = selectedIds.size;
  selectedIds.clear();
  ids.forEach((id) => selectedIds.add(id));
  selectionAnchor = anchor;
  getItems().forEach((li) => li.classList.toggle('selected', selectedIds.has(li.dataset.id)));
  renderBulkBar();
  if (selectedIds.size !== before) announce(selectedIds.size ? `${selectedIds.size}개 선택됨` : '선택 해제됨');
}

function toggleSelect(id) {
  const ids = new Set(selectedIds);
  if (ids.has(id)) ids.delete(id); else ids.add(id);
  setSelection([...ids], id);
}

// 시작 항목부터 id까지 화면 순서대로 선택
function selectRange(id) {
  const ids = getItems().map((li) => li.dataset.id);
  const from = ids.indexOf(selectionAnchor);
  const to = ids.indexOf(id);
  if (from < 0) {
    setSelection([id], id);
    return;
  }
  setSelection(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
}

// ---------- 여러 항목 한 번에 바꾸기 ----------

function updateMany(ids, change) {
  const targets = new Set(ids);
  todos = todos.map((todo) => (targets.has(todo.id) ? { ...todo, ...change(todo) } : todo));
  saveTodos();
  render();
}

function setCompleted(ids, completed) {
  updateMany(ids, (todo) => (todo.completed === completed ? {} : { completed, completedAt: completed ? Date.now() : null }));
}

function setCategory(ids, category) {
  if (isCategory(category)) updateMany(ids, () => ({ category }));
}

// 두 개 이상은 확인 창을 거침. 삭제했으면 true
function deleteMany(ids) {
  if (ids.length > 1 && !confirm(`선택한 할 일 ${ids.length}개를 삭제할까요?`)) return false;
  const targets = new Set(ids);
  todos = todos.filter((todo) => !targets.has(todo.id));
  saveTodos();
  render();
  return true;
}

// ---------- 순서 바꾸기 (드래그, Alt+↑↓) ----------

function reorderTodo(id, targetId, position) {
  const moving = getTodo(id);
  if (!moving || id === targetId) return;
  const rest = todos.filter((todo) => todo.id !== id);
  const index = rest.findIndex((todo) => todo.id === targetId);
  if (index < 0) return;
  rest.splice(index + (position === 'after' ? 1 : 0), 0, moving);
  todos = rest;
  saveTodos();
  render();
}

// 같은 묶음(진행 중/완료) 안에서 한 칸 이동
function moveTodo(id, direction, selector) {
  const li = findItem(id);
  const siblings = [...li.parentElement.children];
  const neighbor = siblings[siblings.indexOf(li) + direction];
  if (!neighbor) return;
  reorderTodo(id, neighbor.dataset.id, direction > 0 ? 'after' : 'before');
  focusItem(id, selector);
  const moved = findItem(id);
  announce(`${[...moved.parentElement.children].indexOf(moved) + 1}번째로 이동`);
}

// ---------- 필터 탭: 화살표로 이동하는 탭 목록 (선택된 탭만 Tab 순서에 들어감) ----------

function updateTabStops() {
  filterTabs.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.tabIndex = tab.classList.contains('selected') ? 0 : -1;
  });
}

function updateOrientation() {
  filterTabs.setAttribute('aria-orientation', wideQuery.matches ? 'vertical' : 'horizontal');
}

filterTabs.addEventListener('keydown', (event) => {
  const tabs = [...filterTabs.querySelectorAll('.filter-tab')];
  const index = tabs.indexOf(event.target);
  const moves = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
  if (index < 0 || !(event.key in moves)) return;
  event.preventDefault();
  const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
  setFilter(next.dataset.filter);
  next.focus();
});

// ---------- 우클릭 메뉴 ----------

function getMenuItems() {
  return [...contextMenu.querySelectorAll('.menu-item:not([hidden])')];
}

function openContextMenu(li, x, y) {
  const id = li.dataset.id;
  // 선택 밖의 항목에서 열면 선택을 풀고 그 항목에만 적용
  if (!selectedIds.has(id)) setSelection([], null);
  menuTargets = selectedIds.has(id) ? [...selectedIds] : [id];
  menuOriginId = id;
  const targets = menuTargets.map(getTodo);
  const multiple = targets.length > 1;

  $('context-menu-title').hidden = !multiple;
  $('context-menu-title').textContent = `${targets.length}개 선택`;
  contextMenu.querySelector('[data-action="edit"]').hidden = multiple;
  $('context-toggle-label').textContent = targets.every((todo) => todo.completed) ? '미완료로 표시' : '완료로 표시';
  contextCategories.querySelectorAll('.menu-item').forEach((item) => {
    item.setAttribute('aria-checked', String(targets.every((todo) => todo.category === item.dataset.category)));
  });

  // 화면 밖으로 나가지 않게 위치를 맞춤
  contextMenu.hidden = false;
  const { width, height } = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${Math.max(8, Math.min(x, innerWidth - width - 8))}px`;
  contextMenu.style.top = `${Math.max(8, Math.min(y, innerHeight - height - 8))}px`;
  getMenuItems()[0].focus();
}

function closeContextMenu(restoreFocus) {
  if (contextMenu.hidden) return;
  contextMenu.hidden = true;
  if (restoreFocus) focusItem(menuOriginId, '.todo-checkbox');
}

function openContextMenuFor(li) {
  const rect = li.getBoundingClientRect();
  openContextMenu(li, rect.left + 48, rect.bottom - 4);
}

function runMenuAction(item) {
  const ids = menuTargets;
  const action = item.dataset.action;
  closeContextMenu(false);
  if (action === 'edit') {
    startEdit(findItem(ids[0]));
    return;
  }
  if (action === 'delete') {
    // 한 개는 ✕ 버튼과 같은 흐름(다음 항목으로 포커스), 여러 개는 확인 후 삭제
    if (ids.length === 1) findItem(ids[0]).querySelector('.delete-btn').click();
    else if (deleteMany(ids)) input.focus();
    else focusItem(menuOriginId, '.todo-checkbox');
    return;
  }
  if (action === 'toggle') setCompleted(ids, !ids.map(getTodo).every((todo) => todo.completed));
  if (action === 'category') setCategory(ids, item.dataset.category);
  focusItem(menuOriginId, '.todo-checkbox');
}

list.addEventListener('contextmenu', (event) => {
  const li = event.target.closest('.todo-item');
  if (!li || li.classList.contains('editing')) return; // 수정 중에는 브라우저 기본 메뉴(복사·붙여넣기)
  event.preventDefault();
  // 메뉴 키로 열면 좌표가 0이므로 항목 위치를 씀
  if (event.clientX === 0 && event.clientY === 0) openContextMenuFor(li);
  else openContextMenu(li, event.clientX, event.clientY);
});

contextMenu.addEventListener('click', (event) => {
  const item = event.target.closest('.menu-item');
  if (item) runMenuAction(item);
});

contextMenu.addEventListener('keydown', (event) => {
  const items = getMenuItems();
  const index = items.indexOf(document.activeElement);
  const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
  if (event.key in moves) {
    event.preventDefault();
    items[(moves[event.key] + items.length) % items.length].focus();
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    event.preventDefault();
    closeContextMenu(true);
  }
});

// 메뉴 밖을 누르거나, 스크롤·창 크기 변경·창 전환 시 닫음
document.addEventListener('pointerdown', (event) => {
  if (!contextMenu.contains(event.target)) closeContextMenu(false);
});
window.addEventListener('scroll', () => closeContextMenu(false), true);
window.addEventListener('resize', () => closeContextMenu(false));
window.addEventListener('blur', () => closeContextMenu(false));

// ---------- 마우스: Ctrl/⌘·Shift+클릭 선택 ----------

// Shift+클릭 때 글자가 드래그 선택되지 않게
list.addEventListener('mousedown', (event) => {
  if (event.shiftKey && event.target.closest('.todo-item') && !event.target.closest('input, select')) event.preventDefault();
});

list.addEventListener('click', (event) => {
  const li = event.target.closest('.todo-item');
  if (!li || li.classList.contains('editing') || event.target.closest('input, button, select')) return;
  const id = li.dataset.id;
  if (event.shiftKey) selectRange(id);
  else if (event.metaKey || event.ctrlKey) toggleSelect(id);
  else if (selectedIds.size > 0) setSelection([], null); // 그냥 클릭하면 선택 해제
  else return;
  li.querySelector('.todo-checkbox').focus({ preventScroll: true });
});

// ---------- 드래그로 순서 바꾸기 (같은 묶음 안에서만) ----------

function clearDropMarker() {
  list.querySelectorAll('.drop-before, .drop-after').forEach((li) => li.classList.remove('drop-before', 'drop-after'));
}

function endDrag() {
  clearDropMarker();
  const li = findItem(draggedId);
  if (li) li.classList.remove('dragging');
  draggedId = null;
  dropTarget = null;
}

list.addEventListener('dragstart', (event) => {
  const li = event.target.closest('.todo-item');
  if (!li || li.classList.contains('editing')) {
    event.preventDefault();
    return;
  }
  closeContextMenu(false);
  draggedId = li.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', getTodo(draggedId).title);
  li.classList.add('dragging');
});

list.addEventListener('dragover', (event) => {
  if (!draggedId) return;
  const li = event.target.closest('.todo-item');
  const dragged = findItem(draggedId);
  clearDropMarker();
  dropTarget = null;
  if (!li || li === dragged || li.parentElement !== dragged.parentElement) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const rect = li.getBoundingClientRect();
  const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  li.classList.add(`drop-${position}`);
  dropTarget = { id: li.dataset.id, position };
});

list.addEventListener('dragleave', (event) => {
  if (!list.contains(event.relatedTarget)) clearDropMarker();
});

// 놓으면 다시 그려져 원래 <li>가 사라지므로(dragend가 목록까지 오지 않음) 여기서 상태를 정리
list.addEventListener('drop', (event) => {
  event.preventDefault();
  const move = draggedId && dropTarget && [draggedId, dropTarget.id, dropTarget.position];
  endDrag();
  if (move) reorderTodo(...move);
});
list.addEventListener('dragend', endDrag);

// 수정 입력창 안에서는 글자 선택이 되도록 드래그를 끔 (수정이 끝나면 다시 그려지며 복구)
list.addEventListener('focusin', (event) => {
  if (event.target.matches('.edit-input, .edit-select')) event.target.closest('.todo-item').draggable = false;
});

// ---------- 키보드: 목록 안 ----------

list.addEventListener('keydown', (event) => {
  if (event.target.matches('.edit-input, .edit-select') || event.isComposing) return;
  const li = event.target.closest('.todo-item');
  if (!li) return;
  const id = li.dataset.id;
  const items = getItems();
  const index = items.indexOf(li);
  const selector = ITEM_CONTROLS.find((s) => event.target.matches(s)) || '.todo-checkbox';
  const key = event.key;
  const modifier = event.metaKey || event.ctrlKey;

  if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
    event.preventDefault();
    moveTodo(id, key === 'ArrowUp' ? -1 : 1, selector);
  } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
    event.preventDefault();
    const next = items[{ ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: items.length - 1 }[key]];
    if (!next) return;
    if (event.shiftKey) {
      if (selectedIds.size === 0) selectionAnchor = id;
      selectRange(next.dataset.id);
    }
    next.querySelector(selector).focus();
  } else if (key === 'F2') {
    event.preventDefault();
    startEdit(li);
  } else if (key === 'Delete' || key === 'Backspace') {
    event.preventDefault();
    if (selectedIds.size > 1 && selectedIds.has(id)) {
      if (deleteMany([...selectedIds])) input.focus();
    } else {
      li.querySelector('.delete-btn').click();
    }
  } else if (modifier && key.toLowerCase() === 'a') {
    event.preventDefault();
    setSelection(items.map((item) => item.dataset.id), id);
  } else if (!modifier && !event.altKey && (key === 'x' || key === 'X' || key === 'ㅌ')) {
    event.preventDefault();
    toggleSelect(id);
  } else if (event.shiftKey && key === 'F10') {
    event.preventDefault();
    openContextMenuFor(li);
  } else if (key === 'Escape' && selectedIds.size > 0) {
    event.preventDefault();
    setSelection([], null);
  }
});

// ---------- 키보드: 화면 전체 ----------

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing || !contextMenu.hidden) return;
  if (document.querySelector('dialog[open]')) return;
  const target = event.target;

  // 입력창에서 Esc: 목록 첫 항목으로 이동
  if (target === input && event.key === 'Escape') {
    const first = getItems()[0];
    if (first) {
      event.preventDefault();
      first.querySelector('.todo-checkbox').focus();
    }
    return;
  }
  if (isTyping(target) || event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === '/' || event.key === 'n' || event.key === 'N' || event.key === 'ㅜ') {
    event.preventDefault();
    input.focus();
  } else if (event.key === '?') {
    event.preventDefault();
    shortcutsDialog.showModal();
  } else if (/^[1-9]$/.test(event.key)) {
    const tab = filterTabs.querySelectorAll('.filter-tab')[Number(event.key) - 1];
    if (tab) {
      event.preventDefault();
      setFilter(tab.dataset.filter);
    }
  } else if (event.key === 'Escape' && selectedIds.size > 0) {
    setSelection([], null);
  }
});

// ---------- 선택 도구 막대 ----------

bulkBar.addEventListener('click', (event) => {
  const action = event.target.closest('[data-bulk]')?.dataset.bulk;
  const ids = [...selectedIds];
  if (action === 'complete') setCompleted(ids, true);
  if (action === 'uncomplete') setCompleted(ids, false);
  if (action === 'clear') setSelection([], null);
  if (action === 'delete') deleteMany(ids);
  // 막대가 사라지면 포커스를 잃으므로 입력창으로
  if (bulkBar.hidden) input.focus();
});

bulkCategory.addEventListener('change', () => {
  setCategory([...selectedIds], bulkCategory.value);
  bulkCategory.value = '';
});

$('shortcuts-btn').addEventListener('click', () => shortcutsDialog.showModal());

// ---------- 고정 입력창 높이만큼 스크롤 여백: 포커스한 항목이 입력창 뒤에 가려지지 않게 ----------

function updateScrollPadding() {
  const sticky = getComputedStyle(composer).position === 'sticky';
  document.documentElement.style.scrollPaddingTop = sticky ? `${composer.offsetHeight + 12}px` : '';
}

// ---------- 시작 ----------

Object.entries(CATEGORIES).forEach(([key, { label }]) => {
  bulkCategory.add(new Option(label, key));
  const item = createElement('button', 'menu-item', '');
  item.type = 'button';
  item.setAttribute('role', 'menuitemradio');
  item.dataset.action = 'category';
  item.dataset.category = key;
  item.append(createElement('span', 'menu-check'), label);
  contextCategories.append(item);
});

new ResizeObserver(updateScrollPadding).observe(composer);
wideQuery.addEventListener('change', () => {
  updateOrientation();
  updateScrollPadding();
});
finePointer.addEventListener('change', render);
updateOrientation();
render();
