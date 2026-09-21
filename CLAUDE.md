# 우리집 하루 — 작업 메모

가족용 스케줄·숙제 웹앱. 이 파일은 다음에 이어서 작업할 때 먼저 읽는 용도입니다.

## 한 줄 요약

빌드 도구 없는 순수 HTML/CSS/ES모듈 + Supabase. `docs/` 폴더가 GitHub Pages 로 서비스됩니다.

- 배포 주소: https://ChungYoungJoo.github.io/family-schedule/
- 저장소: https://github.com/ChungYoungJoo/family-schedule (Pages: `main` / `/docs`)
- 로컬 경로: `C:\Users\youngjoo.chung\Documents\projects\family-board`

## 이 환경의 제약 (중요)

작업 전에 반드시 알아야 할 것들입니다. 여러 번 시행착오를 겪은 부분입니다.

| 제약 | 대응 |
|---|---|
| **Node.js·Python 없음** | 코드 실행 검증 불가. 문법은 괄호/백틱 균형 확인 + 리뷰로만. 배포 후 브라우저 콘솔로 확인 |
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
  core.js              상수·유틸·전역 상태(D, S)·파생 조회      ← 의존성 최하위
  data.js              loadAll / resolveKid
  views-common.js      pickTag, itemChip, statusRow, slotRow, redeemRow, weekNav
  views-day.js         kidToday / shopView / parentToday / 내일 미리보기
  views-week.js        weekView / familyView
  views-manage.js      manageView
  ui.js                render / paintHeader / 바텀시트 / 토스트 / 로그인 화면
  sync.js              refresh / run(쓰기 공통) / reopenFn
  sheets.js            입력 폼 (이 날만 변경, 스케줄, 숙제·준비물, 보상, 세트·기간, 요일 일괄)
  actions.js           ACT 테이블 + data-act 이벤트 위임
  app.js               진입점 (boot)
supabase/
  01_schema.sql  02_policies.sql  03_seed.sql  04_supplies.sql
  05_reward_suggestions.sql   아이가 갖고 싶은 보상 제안 → 부모가 포인트 정해 확정
upload-to-github.ps1   배포 스크립트
prototype.html         초기 화면 시안 (앱과 무관, 업로드 안 됨)
```

의존 방향: `core → data → views-* → ui → sync → sheets → actions → app` (순환 없음)

## 설계 개념

1. **스케줄 세트 + 적용 기간** — `schedule_sets` 1 : N `set_periods`.
   날짜가 어느 기간에 드는지로 그날 시간표가 자동 결정 (`setIdFor(date)`).
2. **이 날만 변경** — 요일 반복은 그대로 두고 날짜별 예외를 얹음.
   `date_notes`(하루 표시) / `routine_cancels`(그날 취소) / `extra_events`(그날 추가)
   → `dayItems(childId, date)` 가 세 개를 합쳐 그날의 실제 일정을 만듦
3. **픽업 담당** — `routines.default_pickup_id`(요일 기본) 위에 `pickups`(날짜별) 덮어쓰기
4. **포인트** — 클라이언트가 못 건드림. `task_logs`/`attendance_logs` 삽입 시 **DB 트리거**가 적립,
   삭제 시 회수. 하루 전부 완료 보너스는 `claim_daily_bonus()` RPC 가 서버에서 재검증
5. **연속 달성** — `point_ledger` 의 `ref_type='bonus'` 행이 있는 날 = 다 한 날
6. **보상 제안** — 아이가 `reward_suggestions` 에 올리면 부모가 포인트를 정해
   `approve_reward_suggestion(id, cost)` RPC 로 확정 → `rewards` 행이 생김.
   `data.js` 는 이 테이블 조회 실패를 무시하므로 SQL 미실행 상태에서도 앱은 뜸

## 권한

- 보호자: Supabase 이메일 로그인 → 자기 가족 전체 읽기/쓰기
- 아이: 로그인 없이 `#kid=<access_token>` 링크. 클라이언트가 `x-kid-token` 헤더를 붙이고,
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

## 코드 관례

- UI 문구는 전부 한국어, 존댓말. 아이 화면은 반말·쉬운 말
- 조사는 `josa(name,'이','가')` (받침 판별). 부르는 말도 `josa(name,'아','야')`.
  **`josa` 는 "이름+조사" 를 통째로 돌려줍니다.** `${name}${josa(name,…)}` 로 쓰면
  이름이 두 번 나옵니다 — 실제로 한 번 겪은 버그입니다
- 사람 이름을 문장에 넣을 때는 `member.full_name || member.name` (짧은 이름은 칩·목록용)
- 이벤트는 전부 `data-act` 위임. 인라인 `onclick` 은 시트 내부 임시 요소에만
- 쓰기는 `run(fn, 성공메시지)` 로 감싸면 오류 토스트 + 재조회 + 렌더까지 처리됨
- 동기화는 12초 폴링 + 화면 복귀 시 즉시 (실시간 WebSocket 미사용)

## 아직 안 한 것

- 휴대폰 푸시 알림 (서비스워커 + VAPID + Edge Function + 스케줄러 필요)
- 월간 달력 보기
- 포인트 사용 내역·통계
- 엑셀/PDF 가져오기 — 한 번 만들었다가 "직접 입력이 낫다"는 판단으로 제거함 (되살릴 필요 없음)
- 시간표 사진(이미지) 자동 인식 — AI API + 서버 필요해서 보류
