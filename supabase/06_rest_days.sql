-- =====================================================================
--  06_rest_days.sql — 공휴일·쉬는 날
--
--  추석·설날 같은 날은 학교·학원뿐 아니라 «숙제·준비물»도 쉬어야 하는데,
--  기존에는 반복 일정만 그날 취소할 수 있었습니다(routine_cancels).
--  숙제도 그날만 쉴 수 있도록 짝이 되는 표를 만듭니다.
--
--  쉬는 날 자체는 새 표 없이 date_notes 에 note_key='holiday' 로 기록합니다.
--
--  01~05 를 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
-- =====================================================================

create table if not exists task_cancels (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  on_date    date not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (task_id, on_date)
);
create index if not exists task_cancels_idx on task_cancels (family_id, on_date);

alter table task_cancels enable row level security;

grant select                         on task_cancels to anon;
grant select, insert, update, delete on task_cancels to authenticated;

drop policy if exists p_parent_task_cancels on task_cancels;
create policy p_parent_task_cancels on task_cancels for all to authenticated
  using      (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

-- 아이는 «오늘 쉬는 숙제» 를 알아야 화면에서 빼줄 수 있으므로 읽기만 허용
drop policy if exists k_task_cancels on task_cancels;
create policy k_task_cancels on task_cancels for select to anon
  using (family_id = public.kid_family_id());

-- ---------------------------------------------------------------------
--  하루 전부 완료 보너스 — 그날 쉬기로 한 숙제는 세지 않습니다.
--  (01_schema.sql 의 함수를 이 내용으로 대체합니다)
-- ---------------------------------------------------------------------
create or replace function public.claim_daily_bonus(p_child uuid, p_date date)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_family uuid; v_set uuid; v_wd int;
  v_task_total int; v_task_done int;
  v_att_total int;  v_att_done int;
  v_bonus int;
begin
  select family_id into v_family from members where id = p_child;
  if v_family is null then return 0; end if;

  -- 권한: 본인(아이 링크) 또는 그 가족의 보호자
  if not (public.kid_id() = p_child or v_family in (select public.my_family_ids())) then
    raise exception 'not allowed';
  end if;

  -- 이미 받았으면 종료
  if exists (select 1 from point_ledger
             where ref_type='bonus' and child_id=p_child and on_date=p_date) then
    return 0;
  end if;

  v_set := public.active_set_id(v_family, p_date);
  if v_set is null then return 0; end if;
  v_wd  := extract(dow from p_date)::int;

  -- 숙제·준비물 (그날만 쉬기로 한 것은 제외)
  select count(*) into v_task_total from tasks t
   where t.set_id=v_set and t.child_id=p_child and not t.archived
     and (t.weekdays is null or v_wd = any(t.weekdays))
     and not exists (select 1 from task_cancels tc
                      where tc.task_id = t.id and tc.on_date = p_date);
  select count(*) into v_task_done from task_logs
   where child_id=p_child and on_date=p_date;

  -- 출석 체크 대상 = 학교/기타를 제외한 반복 일정 중 그날 취소되지 않은 것 + 그날 추가된 학원류
  select count(*) into v_att_total from routines r
   where r.set_id=v_set and r.child_id=p_child and r.weekday=v_wd
     and r.category in ('academy','sport','art')
     and not exists (select 1 from routine_cancels rc
                      where rc.routine_id=r.id and rc.on_date=p_date);
  v_att_total := v_att_total + (
    select count(*) from extra_events e
     where e.child_id=p_child and e.on_date=p_date and e.category in ('academy','sport','art'));
  select count(*) into v_att_done from attendance_logs
   where child_id=p_child and on_date=p_date;

  -- 쉬는 날이라 할 일이 하나도 없으면 보너스도 없습니다 (연속 달성은 클라이언트가 건너뜁니다)
  if (v_task_total + v_att_total) = 0 then return 0; end if;
  if v_task_done < v_task_total or v_att_done < v_att_total then return 0; end if;

  select bonus_points into v_bonus from families where id = v_family;
  insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
  values (v_family, p_child, coalesce(v_bonus,20), '하루 전부 완료 보너스', 'bonus', null, p_date);

  insert into notifications(family_id, audience, child_id, icon, title, body)
  select v_family, 'parents', p_child, '🏅',
         (select name from members where id=p_child) || '(이)가 오늘 할 일을 모두 마쳤어요',
         to_char(p_date,'MM월 DD일') || ' · 보너스 ' || coalesce(v_bonus,20) || 'P 적립';

  return coalesce(v_bonus,20);
end $$;

-- 나중에 WebSocket 을 켤 때를 대비해 등록만 해둡니다
do $$
begin
  alter publication supabase_realtime add table task_cancels;
exception when others then
  raise notice 'realtime publication 등록 생략: %', sqlerrm;
end $$;
