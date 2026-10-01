<!-- 작성: 2026-10-01 14:17 / 수정: 2026-10-01 23:58 (할 일 관리 앱 구조), 2026-10-02 00:20 (자동 분류), 2026-10-02 00:38 (재분류·분류 설정) -->
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

`VibeCoding` 저장소(git 루트는 상위 폴더)의 두 번째 연습 프로젝트로, 순수 HTML/CSS/자바스크립트 할 일 관리 앱이다. 요구사항 원본은 `할 일 관리 앱 PRD.md`이고, 기능 ID(F-01 등)는 이 문서를 따른다. 라이브러리·빌드 도구·npm·서버를 쓰지 않으며(PRD 7장), `index.html`을 브라우저로 열면(`open index.html`) 바로 실행된다. 테스트·린트 설정은 없다.

저장소의 각 `Study-NN` 폴더는 서로 독립적으로 실행된다. 다른 Study 폴더의 파일을 import하거나 참조하지 않으며, 의존성·가상환경·`.gitignore`도 이 폴더 안에 둔다(루트 `.gitignore`에는 `.DS_Store`만 있다). 참고 사례는 `../Study-01/`(MNIST 손글씨 인식, PySide6·Flask)이다.

## 구조

- `app.js` 상태는 `todos` 배열과 `currentFilter` 두 개뿐이다. 모든 변경은 "상태 변경 → `saveTodos()`(또는 `writeStorage`) → `render()`" 한 방향으로 흐르며, `render()`가 목록·필터 탭·진행률을 모두 다시 그린다.
- 목록 `<li>`는 `render()`마다 새로 만들지만, 필터 탭과 카테고리별 진행률 줄은 시작할 때 한 번만 만들고 값만 바꾼다(포커스 유지, 바 transition). 다시 그린 뒤 키보드 포커스는 `focusItem(id, selector)`로 복원한다.
- 목록 이벤트는 모두 `<ul>`에 위임하고 `data-id`로 항목을 찾는다. 사용자 문자열은 `textContent`로만 넣는다.
- 인라인 수정은 상태에 넣지 않고 DOM에서만 처리한다(`li.editing` 클래스). 끝날 때 `updateTodo` 또는 `render()`로 원래 흐름에 합류한다.
- 카테고리는 `app.js`의 `CATEGORIES` 한 곳에서 정의하고, 드롭다운·탭·배지·진행률 줄이 모두 여기서 만들어진다. 자동 분류 키워드(`keywords`)도 여기에 있다. `scoreCategory()`는 카테고리별 점수(맞은 키워드 길이의 합)와 신뢰도(1등 점수 ÷ 전체, 1등 동점이면 null)를 내고, `detectCategory()`는 여기에 분류 설정(`classifySettings`: 사용 여부·임계값·완료 항목 포함, 키 `todo-app:classify`)을 적용한다. 입력 중 자동 분류와 자동 재분류(`reclassifyTodos`)는 모두 `detectCategory()`를 거친다. 입력 영역의 `chosenCategory`/`categoryPicked`는 저장하지 않는 UI 상태로, 직접 고른 카테고리가 자동 분류보다 우선하게 한다. 색은 `var(--cat-*)`를 가리키므로 실제 색 값은 `style.css`에 있다.
- 색은 `style.css`의 `:root` 변수로만 쓰고, 다크 모드는 `:root[data-theme="dark"]`에서 같은 변수를 덮어쓴다. 첫 테마는 `index.html` `<head>`의 인라인 스크립트가 CSS보다 먼저 정한다(깜빡임 방지).
- localStorage 키: `todo-app:todos`, `todo-app:filter`, `todo-app:theme`, `todo-app:classify`. 저장된 데이터와 가져온 백업은 모두 `sanitizeTodos()`로 정리한다.

## 데스크톱 버전 (`web_version/`)

- `web_version/`은 넓은 화면용 2단 레이아웃(왼쪽 사이드바, 오른쪽 입력·목록)이다. 760px 미만에서는 `display: contents`와 `order`로 원래 모바일 버전 순서로 쌓인다.
- `index.html`의 요소 id와 클래스는 루트 버전과 같고 배치만 다르다. `web_version/app.js`는 루트 `app.js`의 복사본(첫 줄 주석만 다름)이므로, 기능을 고치면 두 파일에 똑같이 반영한다. 색상 토큰도 두 `style.css`에서 같게 유지한다.
- 데스크톱 전용 기능은 `web_version/desktop.js`에만 있다(`app.js` 다음에 로드). `app.js`의 전역 상태·함수를 그대로 쓰고, `render`와 `createTodoItem`을 감싸서 바꾼다: `render` 뒤에 `groupList()`가 `<li>`를 "진행 중 / 완료" 묶음(`li.todo-group > ul.todo-sublist`)으로 옮긴다. 묶음도 `#todo-list` 안이라 `app.js`의 이벤트 위임과 `focusItem`이 그대로 동작한다. 단, `list.children`은 이제 할 일이 아니라 묶음이므로 항목은 `.todo-item`으로 찾는다.
- 선택(`selectedIds`)은 저장하지 않는 화면 상태이고 클래스만 바꿔 포커스를 유지한다. 순서 변경(드래그, Alt+↑↓)은 `todos` 배열 순서를 바꿔 저장하며, 같은 묶음 안에서만 허용한다. `desktop.js`의 전역 이름이 `app.js`와 겹치면 SyntaxError가 나므로 새 이름을 쓴다.

## 컨벤션 (Study-01에서 이어짐)

- 코드 주석, UI 문자열, 문서는 한국어로 작성한다. 각 블록 위에 짧은 한국어 설명 주석을 다는 스타일을 따른다.
- 새로 만드는 모든 파일의 맨 위에 생성 날짜와 시간을 해당 언어의 주석 문법으로 표시한다(예: Python `# 작성: 2026-10-01 14:17`, Markdown/HTML `<!-- 작성: ... -->`). 기존 파일을 수정하면 같은 줄에 `/ 수정: 날짜 시간 (변경 내용)`을 덧붙인다. 시간은 추측하지 말고 `date '+%Y-%m-%d %H:%M'`로 확인한다. shebang(`#!`)이 있는 파일은 그 다음 줄에 넣고, JSON처럼 주석을 쓸 수 없는 형식은 예외로 한다.
- 프로젝트를 추가하면 폴더 README를 쓰고, 루트 `../README.md`의 프로젝트 표에 한 줄을 추가한다.
