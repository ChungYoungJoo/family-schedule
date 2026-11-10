# 우리집 하루 — 작업 메모

가족용 스케줄·숙제 웹앱. 이 파일은 다음에 이어서 작업할 때 먼저 읽는 용도입니다.

## 한 줄 요약

빌드 도구 없는 순수 HTML/CSS/ES모듈 + Supabase. `docs/` 폴더가 GitHub Pages 로 서비스됩니다.

- 배포 주소: https://ChungYoungJoo.github.io/family-schedule/
- 저장소: https://github.com/ChungYoungJoo/family-schedule (Pages: `main` / `/docs`)

## 이 환경의 제약 (중요)

작업 전에 반드시 알아야 할 것들입니다. 여러 번 시행착오를 겪은 부분입니다.

| 제약 | 대응 |
|---|---|
| **Node.js·Python 없음** | 서버 없이 JS 를 돌릴 수는 없음. 문법은 괄호/백틱 균형 확인. **상호작용이 있는 기능은 브라우저 패널(preview)로 실제 모듈을 돌려 검증**할 수 있음 → 아래 «브라우저로 검증하기». **SQL 은 여전히 실행 검증 불가** — 문법·권한을 눈으로 꼼꼼히 읽고, 사용자가 SQL Editor 에서 돌린 결과로 확인 |
| **회사 프록시가 큰 업로드를 차단** | `git push` 403, Netlify 드롭 차단, GitHub 웹 업로드 실패 |
| → 우회 | `upload-to-github.ps1` (GitHub Contents API, JSON PUT) 로 파일별 업로드 |
| **요청 본문 크기 한계 (~45KB)** | JS 모듈은 **20KB 이하** 유지. 커지면 쪼갤 것. 스크립트가 45KB 초과는 자동 SKIP |
| **PowerShell 5.1 은 BOM 없는 .ps1 을 CP949 로 읽음** | `.ps1` 수정 후 **반드시 UTF-8 BOM 으로 다시 저장** |
| 터미널에서 `git` 미인식 | `$env:Path += ";C:\Program Files\Git\cmd"` |

## 구조

```
docs/                  ← 배포되는 앱
  index.html
  config.js            Supabase URL / publishable key
  cats.js              고양이 그림(catSvg)·도감 목록(CAT_BOOK)      ← 어디에도 의존 안 하는 잎
  core.js              상수·유틸·전역 상태(D, S)·파생 조회      ← 의존성 최하위 (cats.js 만 가져옴)
  chat.js              대화 데이터 (읽기·보내기·읽음·안 읽은 개수, 상태 C)   ← core 만 가져옴
  data.js              loadAll / resolveKid
  views-common.js      pickTag, itemChip, statusRow, slotRow, redeemRow, weekNav
  views-day.js         kidToday / parentToday / 내일 미리보기
  views-shop.js        shopView (아이 포인트 상점)
  views-week.js        weekView / familyView
  views-month.js       monthView (월간 달력 — 주간 탭 안에서 S.cal 로 전환)
  views-chat.js        대화 탭 화면 (ui 를 가져오지 않음 — 순환 방지. 설계 10 참고)
  views-manage.js      manageView
  ui.js                render / paintHeader / 바텀시트 / 토스트 / 로그인 화면
  sync.js              refresh / run(쓰기 공통) / reopenFn
  sheets.js            입력 폼 (스케줄, 숙제·준비물, 보상, 세트·기간)
  sheets-day.js        입력 폼 (이 날만 변경, 공휴일·쉬는 날, 지난 날짜 체크)
  sheets-adult.js      입력 폼 (어른 일정 — 그 날짜 / 요일별 기본)
  sheets-member.js     입력 폼 (픽업 도와줄 사람 추가·수정)
  sheets-notice.js     알림함 (아이는 열면 자동 읽음)
  sheets-points.js     포인트 내역·통계 시트 (한 달씩 따로 조회)
  sheets-cats.js       고양이 도감 시트
  actions.js           ACT 테이블 + data-act 이벤트 위임
  chat-events.js       대화 입력창 이벤트 (form submit 으로 보내기, 쓰던 글 보관) — app.js 가 bindChat()
  app.js               진입점 (boot) — 12초 폴링 + 대화용 4초 chatTick
supabase/
  01_schema.sql  02_policies.sql  03_seed.sql  04_supplies.sql
  05_reward_suggestions.sql   아이가 갖고 싶은 보상 제안 → 부모가 포인트 정해 확정
  06_rest_days.sql            task_cancels (그날만 쉬는 숙제) + claim_daily_bonus 갱신
  07_late_checks.sql          task_logs/attendance_logs 에 pending + family_today()
  08_notices.sql              아이 알림 읽음 + 승인/거절·보상 교환 알림 트리거
  09_cat_book.sql             cat_collection + child_streak() + 도감 지급 트리거
  10_chat.sql                 부모↔아이 대화: chat_messages / chat_reads + chat_unread·chat_mark_read RPC
upload-to-github.ps1   배포 스크립트
prototype.html         초기 화면 시안 (앱과 무관, 업로드 안 됨)
```

의존 방향: `core → chat → data → views-* → ui → sync → sheets → actions → app` (순환 없음)
(`views-chat` 은 `chat` 과 `core` 만, `chat-events` 는 `chat`·`views-chat` 만 가져옴. `ui` 가 `views-chat` 을 가져오므로 `views-chat` 이 `ui` 를 가져오면 순환 — 토스트가 필요하면 `chat-events` 쪽에서)

## 설계 개념

1. **스케줄 세트 + 적용 기간** — `schedule_sets` 1 : N `set_periods`.
   날짜가 어느 기간에 드는지로 그날 시간표가 자동 결정 (`setIdFor(date)`).
2. **이 날만 변경** — 요일 반복은 그대로 두고 날짜별 예외를 얹음.
   `date_notes`(하루 표시) / `routine_cancels`(그날 취소) / `extra_events`(그날 추가)
   → `dayItems(childId, date)` 가 세 개를 합쳐 그날의 실제 일정을 만듦.
   숙제·준비물은 `task_cancels` → `dayTasks()` / `tasksOn()`
2-1. **쉬는 날** — `DAY_NOTES` 중 `rest:true` 인 표시(`holiday`, `sick`)가 붙은 날.
   지정하면 그날 `routine_cancels` + `task_cancels` 를 한꺼번에 넣고,
   `dueCount()` 가 0을 돌려줘 **연속 달성 🔥 이 끊기지 않음**.
   `D.restDays` 는 과거 95일~미래 200일치를 따로 읽어옴 (연속 달성·관리 화면용).
   **주말은 쉬는 날이 아님** — «매일» 숙제는 토·일에도 그대로 나와야 함 (사용자 요구).
   어른 일정도 쉬는 날엔 `statusOf()` 가 «휴무» 를 기본으로 돌려줌.
   그날 출근하는 사람은 `day_status` 로 덮어쓰면 됨 (날짜별 값이 항상 우선)
3. **픽업 담당** — `routines.default_pickup_id`(요일 기본) 위에 `pickups`(날짜별) 덮어쓰기.
   후보는 `pickers()` = `can_pickup` 인 구성원 + 자율 귀가.
   가끔 오는 사람은 `kind='helper'` 로 추가하며(앱 계정 없음), 요일 기본 일정이
   없으면 `hasWeekly()` 로 «어른들 일정» 줄에서는 빠집니다
4. **포인트** — 클라이언트가 못 건드림. `task_logs`/`attendance_logs` 삽입 시 **DB 트리거**가 적립,
   삭제 시 회수. 하루 전부 완료 보너스는 `claim_daily_bonus()` RPC 가 서버에서 재검증.
   체크는 **지난 날짜에도 가능** (`sheetDayCheck(childId, date)`) — 늦게 끝나 그날 못 누른 것을
   다음날 마무리하는 용도. 그 날짜로 적립되고 보너스도 그날 것으로 들어감.
   그래서 `loadAll` 의 조회 범위는 항상 `YESTERDAY` 까지 포함한다
4-1. **지난 날짜는 보호자 승인 후 완료** — `task_logs`/`attendance_logs` 의 `pending` 컬럼.
   아이가 지난 날짜를 누르면 `pending=true` 로 들어가고 포인트는 아직 안 준다.
   보호자가 `pending=false` 로 바꾸면 트리거가 그때 적립한다.
   서버가 `family_today(family_id)`(한국 시간)로 «오늘/지난 날»을 판정하므로
   아이는 오늘 것만 바로 완료할 수 있고, 승인된 지난 기록은 지우지 못한다.
   보호자가 직접 누르는 것은 날짜와 무관하게 바로 완료.
   클라이언트는 `D.taskWait`/`D.attWait`(대기 여부)와 `D.waits`(승인 목록)로 구분한다
4-2. **월간 달력** — `S.cal='month'` 일 때 주간 탭에 `monthView`.
   칸 표시는 이미 읽어둔 것(시간표·`bonusDates` 95일·`restDays`)만 써서 추가 조회가 없다.
   날짜를 누르면 `S.extraDay` 를 세워 그날 기록을 읽어온 뒤 체크 창을 연다
   (`closeSheet()` 가 `S.extraDay` 를 비운다)
5. **연속 달성** — `point_ledger` 의 `ref_type='bonus'` 행이 있는 날 = 다 한 날
6. **보상 제안** — 아이가 `reward_suggestions` 에 올리면 부모가 포인트를 정해
   `approve_reward_suggestion(id, cost)` RPC 로 확정 → `rewards` 행이 생김.
   `data.js` 는 이 테이블 조회 실패를 무시하므로 SQL 미실행 상태에서도 앱은 뜸
7. **알림** — 아이는 `read_at` 컬럼만 고칠 수 있음(`08_notices.sql`). 종을 열면 자동 읽음.
   보호자 종 아이콘에는 `audience='child'` 알림을 **섞지 않는다** (`data.js` 에서 거름) —
   섞이면 보호자의 «모두 읽음» 이 아이 알림까지 미리 읽음 처리해 버림.
   알림 트리거는 전부 `exception when others then null` 로 감싼다: 알림 실패가
   체크·승인·보상 교환을 막으면 안 되기 때문. 시각은 `localMd/localHm` (created_at 은 UTC)
8. **포인트 내역·통계** — DB 변경 없음. `sheetPoints(childId)` 가 `point_ledger` 를
   **한 달 단위로 따로 조회**한다 (12초 폴링에 싣지 않으려고. 서버 조회 한도 1000행 대비).
   보상 교환 행의 `on_date` 는 서버(UTC) 날짜라 `created_at` 으로 «어느 날» 인지 판단
9. **고양이 도감** — 연속 달성 3·7·14·21·30·50·75·100일에 새 친구. 한 번 만나면 안 사라짐.
   `cat_collection` 은 **서버 트리거만 쓴다** (보너스 적립 시 `unlock_cats`).
   서버의 `child_streak()` 는 클라이언트 `streakOf()`(core.js) 와 **같은 규칙을 SQL 로 한 번 더
   쓴 것**이라, 연속 달성 규칙을 바꾸면 두 곳을 같이 고쳐야 함. 일수 목록도 `cats.js` 의
   `CAT_BOOK` 과 `09_cat_book.sql` 이 같아야 함. 도감 쪽 오류가 보너스 적립을 막지 않도록
   트리거를 예외로 감쌌다
10. **대화** — 아이 한 명당 방 하나(엄마·아빠·그 아이). 형제 방은 RLS 로 안 보이고, 메시지는 수정·삭제 불가.
   - 보낸 사람은 `trg_guard_chat` 트리거가 정함: 아이 링크면 그 아이로 **고정**, 보호자는 같은 가족 보호자 중
     `S.meId`(«보기 전환» 으로 고른 쪽). 한 계정을 엄마·아빠가 같이 쓸 수 있어서 보호자는 고를 수 있게 했음
   - **대화 탭만 화면을 통째로 다시 그리지 않는다.** 12초 폴링의 `render()` 가 `#root` 를 새로 만들면
     입력창에 쓰던 글이 지워지므로, `ui.render()` 는 `chatLive()`(이미 그려진 방·보는 사람이 같음)면
     `paintChat()` 만 부름. 방이나 보는 사람이 바뀌면 통째로 다시 그림.
     → **대화 탭 안의 변화는 `paintChat` 이 책임진다** (탭바 배지도 `paintBadges()` 가 직접 고침 — 안 하면 «4» 가 남음)
   - 새 글: 대화 탭이 열려 있을 때만 4초마다 `chatTick`. 안 읽은 개수: `loadAll` 끝의 `refreshUnread()` (RPC `chat_unread`)
   - **폴링 커서는 «가져온 글» 로만 움직인다.** 내가 보낸 글의 시각으로 옮기면, 그 직전에 도착한 상대 글을
     영영 못 가져옴 (`sendMessage` 주석). 시험으로 확인한 함정
   - 읽음은 사람별(`chat_reads`), 화면에 실제로 보여준 마지막 글 시각까지만(`chat_mark_read(p_upto)`)
   - Enter 전송은 keydown 이 아니라 `<form>` submit — 한글 조합 중 Enter 로 마지막 글자가 잘리거나 두 번 보내지는 것을 피함.
     보내기 버튼 `mousedown` 은 preventDefault 로 입력창 포커스 유지(모바일 키보드가 안 닫힘)
   - `10_chat.sql` 이 없으면 `C.ok=false` → 대화 탭만 숨고 앱은 정상. 네트워크 오류는 «SQL 없음» 으로 오해하지 않음
   - 푸시 알림이 없어서 앱을 열어둔 동안에만 배지가 뜸 (카톡처럼 폰이 울리지 않음)

## 권한

- 보호자: Supabase 이메일 로그인 → 자기 가족 전체 읽기/쓰기
- 아이: 로그인 없이 `#kid=<access_token>` 링크. 토큰은 `localStorage.kidToken` 에 남아
  그 기기는 계속 아이 화면으로 뜸 → 보호자 기기로 되돌릴 때는 `#parent` 로 접속
- 아이: 클라이언트가 `x-kid-token` 헤더를 붙이고,
  RLS 가 `public.kid_id()` 로 본인 것만 통과시킴. 어른 일정은 아이에게 안 보임
- `members.access_token` / `user_id` 는 anon 에게 컬럼 권한 자체가 없음
  → **아이 모드에서는 `select('*')` 금지**, 컬럼을 명시해야 함 (`data.js` 의 `memberCols`)

## 작업 순서

1. `docs/` 안의 파일 수정 (모듈 20KB 이하 유지)
2. DB 변경이 있으면 `supabase/0N_*.sql` 추가 → 사용자가 SQL Editor 에서 실행
3. 괄호·백틱 균형 확인
4. 커밋
5. 사용자가 터미널에서 업로드:
   ```
   powershell -ExecutionPolicy Bypass -File .\upload-to-github.ps1
   ```
   파일을 지웠으면 원격에서도 지워야 함:
   ```
   powershell -ExecutionPolicy Bypass -File .\upload-to-github.ps1 -Delete docs/지운파일.js
   ```
6. 사용자가 `Ctrl+Shift+R` 로 확인

업로드에는 GitHub 토큰이 필요합니다 (fine-grained, `family-schedule` 저장소만, Contents: Read and write).
만료돼도 **앱 동작에는 영향 없음** — 코드를 올릴 때만 씁니다.

## 브라우저로 검증하기

Node 는 없지만 브라우저 패널(`preview_*` 도구)로 **실제 모듈을 그대로** 돌려볼 수 있다.
Supabase 는 로그인 정보가 없으니 메모리 가짜로 갈아 끼운다 (대화 기능은 이렇게 검증함).

1. 스크래치패드에 시험 폴더를 만들고 `index.html` 에서 `/app/core.js` 등을 import,
   `setSb({ from, rpc, auth })` 로 가짜 클라이언트를 꽂고 `D`/`S` 를 채운 뒤 `render()`
2. 서버 스크립트(ASCII 만, BOM 문제 회피)는 `/app/*` → `docs/`, 나머지 → 시험 폴더로 서빙 (`money-note/serve.ps1` 참고)
3. **`launch.json` 은 세션을 «시작한» 작업 폴더의 `.claude/launch.json`** 에 둬야 인식됨. 도중에 작업 폴더가
   바뀌어도 처음 폴더를 읽는다. 저장소 안에 두면 `upload-to-github.ps1` 이 공개 저장소로 올려버리니 **절대 저장소 안에 두지 말 것**
4. `preview_eval` 로 시나리오를 돌리고 `preview_screenshot`(모바일 375×812)으로 화면 확인. 끝나면 임시 항목·서버 정리

가짜 서버가 검증하는 것은 **클라이언트 코드**(폴링 커서, 입력창 보존, 배지)이고 **SQL 과 RLS 는 검증하지 못한다.**
키보드가 올라올 때의 입력줄 위치, 한글 IME 같은 **실기기 동작도 이 방법으로는 못 본다.**

## 코드 관례

- UI 문구는 전부 한국어, 존댓말. 아이 화면은 반말·쉬운 말
- 아이 아이콘은 `members.emoji` 에 `cat:cheese` / `cat:grey` 를 넣고 `avatarOf(m)` 이
  1em 짜리 SVG 고양이를 그림. 이모지로는 털색을 구분할 수 없어서 도입.
  **시트 제목처럼 `textContent` 로 들어가는 자리에는 `emojiOf(m)`** 를 써야 함
- **고양이 테마** (아이들이 고양이를 좋아함). 크림색 바탕 + 생강고양이 색 포인트,
  바탕에 옅은 발바닥 패턴(`body` background-image), 히어로/포인트 카드에 `.catwm` 고양이.
  아이 화면은 🐾😻🐟 등 고양이 이모지, 보호자 화면은 색감만 맞추고 문구는 담백하게
- 조사는 `josa(name,'이','가')` (받침 판별). 부르는 말도 `josa(name,'아','야')`.
  **`josa` 는 "이름+조사" 를 통째로 돌려줍니다.** `${name}${josa(name,…)}` 로 쓰면
  이름이 두 번 나옵니다 — 실제로 한 번 겪은 버그입니다
- 사람 이름을 문장에 넣을 때는 `member.full_name || member.name` (짧은 이름은 칩·목록용)
- 이벤트는 전부 `data-act` 위임. 인라인 `onclick` 은 시트 내부 임시 요소에만
- 쓰기는 `run(fn, 성공메시지)` 로 감싸면 오류 토스트 + 재조회 + 렌더까지 처리됨
- 동기화는 12초 폴링 + 화면 복귀 시 즉시 (실시간 WebSocket 미사용)

## 아직 안 한 것

- 휴대폰 푸시 알림 (서비스워커 + VAPID + Edge Function + 스케줄러 필요) — 대화 알림도 이게 있어야 폰이 울림
- 대화: 메시지 삭제·수정, 이전 대화 더 보기(지금은 방마다 최근 100개만), 사진 첨부
- 엑셀/PDF 가져오기 — 한 번 만들었다가 "직접 입력이 낫다"는 판단으로 제거함 (되살릴 필요 없음)
- 시간표 사진(이미지) 자동 인식 — AI API + 서버 필요해서 보류
