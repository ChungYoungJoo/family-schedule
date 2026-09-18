-- =====================================================================
--  04_supplies.sql — 준비물 체크리스트 추가
--
--  tasks 테이블에 종류(숙제 / 준비물) 구분을 넣습니다.
--  기존 항목은 모두 '숙제'로 남습니다. SQL Editor 에서 한 번만 실행하세요.
-- =====================================================================

alter table tasks
  add column if not exists kind text not null default 'homework'
  check (kind in ('homework','supply'));

comment on column tasks.kind is 'homework = 숙제, supply = 준비물(가져갈 것)';

create index if not exists tasks_kind_idx on tasks (set_id, child_id, kind);

-- 예시 (원하면 주석을 풀고 아이 이름만 바꿔서 실행하세요)
-- insert into tasks (family_id, set_id, child_id, kind, title, weekdays, points)
-- select m.family_id,
--        public.active_set_id(m.family_id, current_date),
--        m.id, 'supply', '체육복', '{2,4}', 5
-- from members m where m.kind = 'child' and m.name = '소빈';
