-- =====================================================================
--  우리집 하루 (family-board) — Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--  실행 순서: 01_schema.sql → 02_policies.sql → 03_seed.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 가족 / 계정
-- ---------------------------------------------------------------------
create table families (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  timezone      text not null default 'Asia/Seoul',
  attend_points int  not null default 20,    -- 학원·운동 출석 체크 포인트
  bonus_points  int  not null default 20,    -- 하루 전부 완료 보너스
  created_at    timestamptz not null default now()
);

-- 부모(보호자) 로그인 계정 ↔ 가족 연결
create table family_users (
  family_id uuid not null references families(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- 구성원: 아이 / 보호자 / 도우미(시터 선생님)
--  · kind='child'  → access_token 으로 전용 링크 접속
--  · kind='parent' → user_id 로 로그인
--  · kind='helper' → 계정 없음. 픽업 담당으로만 지정됨
create table members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  kind         text not null check (kind in ('child','parent','helper')),
  name         text not null,                 -- 화면에 짧게 표시 (예: 선생님)
  full_name    text,                          -- 문장에 쓰는 긴 이름 (예: 시터선생님)
  descr        text,                          -- 초4 / 보호자 …
  color        text not null default '#4c6ef5',
  emoji        text not null default '🙂',
  user_id      uuid references auth.users(id) on delete set null,
  access_token text unique,                   -- 아이 전용 링크 토큰
  can_pickup   boolean not null default false,-- 픽업 담당 후보로 노출할지
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on members (family_id);
create unique index members_user_uniq on members (family_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- 스케줄 세트 (학기 중 / 방학 …)
--   세트 하나가 여러 기간을 가질 수 있습니다.
--   예) "학기 중" = 1학기 + 2학기,  "방학" = 여름방학 + 겨울방학
--   날짜가 어느 기간에 드는지로 그날의 시간표가 자동 결정됩니다.
-- ---------------------------------------------------------------------
create table schedule_sets (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  name       text not null,
  emoji      text not null default '📅',
  sort_order int not null default 0
);
create index on schedule_sets (family_id);

create table set_periods (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  set_id    uuid not null references schedule_sets(id) on delete cascade,
  label     text,                       -- '1학기', '여름방학' …
  starts_on date not null,
  ends_on   date not null,
  check (ends_on >= starts_on)
);
create index on set_periods (family_id, starts_on, ends_on);

-- 요일별 반복 일정 (시간표 템플릿)
create table routines (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  set_id      uuid not null references schedule_sets(id) on delete cascade,
  child_id    uuid not null references members(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),   -- 0=일 … 6=토
  starts_at   time not null,
  ends_at     time not null,
  title       text not null,
  category    text not null default 'etc'
              check (category in ('school','academy','sport','art','etc')),
  needs_pickup boolean not null default false,
  -- 요일 기본 담당 (날짜별로 덮어쓸 수 있음)
  default_pickup_id uuid references members(id) on delete set null,
  default_is_self   boolean not null default false,  -- 자율 귀가
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on routines (set_id, child_id, weekday);

-- 숙제 / 할 일 (세트별)
create table tasks (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  set_id    uuid not null references schedule_sets(id) on delete cascade,
  child_id  uuid not null references members(id) on delete cascade,
  title     text not null,
  note      text,
  weekdays  int[],            -- null = 매일, {1,3,5} = 월·수·금
  points    int not null default 10,
  archived  boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on tasks (set_id, child_id);

-- ---------------------------------------------------------------------
-- 하루짜리 예외 — "이 날만 변경"
-- ---------------------------------------------------------------------
-- (1) 하루 표시: 재량휴업일 / 현장학습 / 아픈 날 / 가족 일정
create table date_notes (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  on_date   date not null,
  note_key  text not null,
  emoji     text not null default '📌',
  label     text not null,
  created_at timestamptz not null default now(),
  unique (family_id, on_date)
);

-- (2) 그날만 취소된 반복 일정
create table routine_cancels (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  on_date    date not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (routine_id, on_date)
);

-- (3) 그날만 추가된 일정 (병원, 현장학습, 생일파티 …)
create table extra_events (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id  uuid not null references members(id) on delete cascade,
  on_date   date not null,
  starts_at time not null,
  ends_at   time not null,
  title     text not null,
  emoji     text not null default '📌',
  category  text not null default 'etc'
            check (category in ('school','academy','sport','art','etc')),
  needs_pickup boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on extra_events (family_id, on_date);

-- ---------------------------------------------------------------------
-- 픽업 담당 배정 (날짜 단위)
--   routine_id 또는 extra_event_id 중 정확히 하나를 가리킵니다.
--   assignee_id = null 이고 is_self = false 이면 "그날만 담당 비움"
-- ---------------------------------------------------------------------
create table pickups (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  on_date        date not null,
  routine_id     uuid references routines(id) on delete cascade,
  extra_event_id uuid references extra_events(id) on delete cascade,
  assignee_id    uuid references members(id) on delete set null,
  is_self        boolean not null default false,   -- 자율 귀가
  updated_by     uuid references auth.users(id) on delete set null,
  updated_at     timestamptz not null default now(),
  check (num_nonnulls(routine_id, extra_event_id) = 1),
  check (not (is_self and assignee_id is not null)),
  -- NULLS NOT DISTINCT: 한쪽이 null 이어도 중복을 막아 upsert 대상이 됩니다.
  constraint pickups_target_uniq unique nulls not distinct (routine_id, extra_event_id, on_date)
);

-- ---------------------------------------------------------------------
-- 어른 일정 (출근/재택/반차/휴가/교육/야근 …, 시터 근무시간)
--   weekly_status = 요일 기본값, day_status = 그 날만
-- ---------------------------------------------------------------------
create table weekly_status (
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  weekday   int  not null check (weekday between 0 and 6),
  status    text not null,
  primary key (member_id, weekday)
);

create table day_status (
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  on_date   date not null,
  status    text not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, on_date)
);

-- ---------------------------------------------------------------------
-- 완료 기록
-- ---------------------------------------------------------------------
create table task_logs (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id  uuid not null references members(id) on delete cascade,
  task_id   uuid not null references tasks(id) on delete cascade,
  on_date   date not null,
  done_at   timestamptz not null default now(),
  unique (task_id, on_date)
);
create index on task_logs (family_id, on_date);

-- 학원·운동 출석 체크 (반복 일정 또는 그날 추가 일정)
create table attendance_logs (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  child_id       uuid not null references members(id) on delete cascade,
  routine_id     uuid references routines(id) on delete cascade,
  extra_event_id uuid references extra_events(id) on delete cascade,
  on_date        date not null,
  done_at        timestamptz not null default now(),
  check (num_nonnulls(routine_id, extra_event_id) = 1),
  constraint attendance_target_uniq unique nulls not distinct (routine_id, extra_event_id, on_date)
);

-- ---------------------------------------------------------------------
-- 포인트 / 보상
--   point_ledger 는 트리거로만 쌓입니다 (아이가 직접 넣을 수 없음).
-- ---------------------------------------------------------------------
create table point_ledger (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  child_id  uuid not null references members(id) on delete cascade,
  delta     int  not null,
  reason    text not null,
  ref_type  text,        -- 'task' | 'attend' | 'bonus' | 'reward' | 'manual'
  ref_id    uuid,
  on_date   date,
  created_at timestamptz not null default now()
);
create index on point_ledger (child_id, created_at desc);
create index on point_ledger (ref_type, ref_id);

create table rewards (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  emoji     text not null default '🎁',
  title     text not null,
  cost      int  not null check (cost > 0),
  archived  boolean not null default false,
  sort_order int not null default 0
);

create table redemptions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  child_id    uuid not null references members(id) on delete cascade,
  reward_id   uuid not null references rewards(id) on delete restrict,
  cost        int not null,                 -- 신청 시점 가격 고정
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id) on delete set null
);
create index on redemptions (family_id, status);

-- ---------------------------------------------------------------------
-- 앱 내 알림함 (1차 범위: 푸시 없음)
-- ---------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  audience   text not null default 'parents'
             check (audience in ('parents','child','all')),
  child_id   uuid references members(id) on delete cascade,  -- audience='child' 일 때
  icon       text not null default '🔔',
  title      text not null,
  body       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index on notifications (family_id, created_at desc);

-- =====================================================================
--  헬퍼 함수
-- =====================================================================

-- 로그인한 보호자가 속한 가족들
create or replace function public.my_family_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select family_id from family_users where user_id = auth.uid()
$$;

-- 아이 전용 링크 토큰 → 아이 member.id
--   클라이언트가 x-kid-token 헤더를 붙여 보냅니다.
create or replace function public.kid_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from members
  where kind = 'child'
    and access_token is not null
    and access_token = nullif(current_setting('request.headers', true)::json ->> 'x-kid-token', '')
  limit 1
$$;

-- 아이 클라이언트가 "나는 누구인가"를 물어보는 용도
create or replace function public.whoami_kid()
returns uuid language sql stable security definer set search_path = public as $$
  select public.kid_id()
$$;

create or replace function public.kid_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from members where id = public.kid_id()
$$;

-- 그 날짜에 적용되는 스케줄 세트
create or replace function public.active_set_id(p_family uuid, p_date date)
returns uuid language sql stable security definer set search_path = public as $$
  select p.set_id
  from set_periods p
  where p.family_id = p_family and p_date between p.starts_on and p.ends_on
  order by p.starts_on desc
  limit 1
$$;

-- 아이별 포인트 잔액
create or replace view child_balances
with (security_invoker = true) as
  select child_id, coalesce(sum(delta),0)::int as balance
  from point_ledger group by child_id;

-- =====================================================================
--  포인트 자동 적립 트리거
-- =====================================================================

-- 숙제 완료 → 적립 / 취소 → 회수
create or replace function public.trg_task_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pts int; v_title text;
begin
  if tg_op = 'INSERT' then
    select points, title into v_pts, v_title from tasks where id = new.task_id;
    insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
    values (new.family_id, new.child_id, coalesce(v_pts,0), '숙제: '||coalesce(v_title,''), 'task', new.id, new.on_date);
    return new;
  else
    delete from point_ledger where ref_type = 'task' and ref_id = old.id;
    -- 보너스도 함께 회수
    delete from point_ledger
      where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    return old;
  end if;
end $$;

create trigger task_logs_points
  after insert or delete on task_logs
  for each row execute function public.trg_task_points();

-- 학원 출석 체크 → 적립 / 취소 → 회수
create or replace function public.trg_attend_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pts int; v_title text;
begin
  if tg_op = 'INSERT' then
    select attend_points into v_pts from families where id = new.family_id;
    select coalesce(r.title, e.title) into v_title
      from (select 1) x
      left join routines r     on r.id = new.routine_id
      left join extra_events e on e.id = new.extra_event_id;
    insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
    values (new.family_id, new.child_id, coalesce(v_pts,20), '출석: '||coalesce(v_title,''), 'attend', new.id, new.on_date);
    return new;
  else
    delete from point_ledger where ref_type = 'attend' and ref_id = old.id;
    delete from point_ledger
      where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    return old;
  end if;
end $$;

create trigger attendance_logs_points
  after insert or delete on attendance_logs
  for each row execute function public.trg_attend_points();

-- 보상 교환 승인 → 포인트 차감 (잔액 부족하면 거절)
create or replace function public.trg_redeem_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  if new.status = 'approved' and coalesce(old.status,'') <> 'approved' then
    select coalesce(sum(delta),0) into v_bal from point_ledger where child_id = new.child_id;
    if v_bal < new.cost then
      raise exception '포인트가 부족합니다 (보유 %P / 필요 %P)', v_bal, new.cost;
    end if;
    insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
    values (new.family_id, new.child_id, -new.cost, '보상 교환', 'reward', new.id, current_date);
    new.decided_at := now();
  elsif new.status = 'rejected' and coalesce(old.status,'') <> 'rejected' then
    new.decided_at := now();
  end if;
  return new;
end $$;

create trigger redemptions_points
  before update on redemptions
  for each row execute function public.trg_redeem_points();

-- 아이 클라이언트가 보낸 값이 실제와 맞는지 서버에서 다시 확인
create or replace function public.trg_guard_task_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_child uuid; v_fam uuid;
begin
  select child_id, family_id into v_child, v_fam from tasks where id = new.task_id;
  if v_child is null then raise exception '없는 숙제입니다'; end if;
  new.child_id := v_child; new.family_id := v_fam;
  return new;
end $$;
create trigger task_logs_guard before insert on task_logs
  for each row execute function public.trg_guard_task_log();

create or replace function public.trg_guard_attend()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_child uuid; v_fam uuid;
begin
  if new.routine_id is not null then
    select child_id, family_id into v_child, v_fam from routines where id = new.routine_id;
  else
    select child_id, family_id into v_child, v_fam from extra_events where id = new.extra_event_id;
  end if;
  if v_child is null then raise exception '없는 일정입니다'; end if;
  new.child_id := v_child; new.family_id := v_fam;
  return new;
end $$;
create trigger attendance_guard before insert on attendance_logs
  for each row execute function public.trg_guard_attend();

-- 보상 가격은 서버의 값으로 고정 (클라이언트 값 무시)
create or replace function public.trg_guard_redeem()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cost int; v_fam uuid;
begin
  select cost, family_id into v_cost, v_fam from rewards where id = new.reward_id and not archived;
  if v_cost is null then raise exception '없는 보상입니다'; end if;
  if v_fam <> (select family_id from members where id = new.child_id) then
    raise exception 'not allowed';
  end if;
  new.cost := v_cost; new.family_id := v_fam; new.status := 'pending';
  return new;
end $$;
create trigger redemptions_guard before insert on redemptions
  for each row execute function public.trg_guard_redeem();

-- =====================================================================
--  하루 전부 완료 보너스
--  클라이언트가 호출하되, 실제 완료 여부는 서버가 다시 검증합니다.
-- =====================================================================
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

  select count(*) into v_task_total from tasks
   where set_id=v_set and child_id=p_child and not archived
     and (weekdays is null or v_wd = any(weekdays));
  select count(*) into v_task_done from task_logs
   where child_id=p_child and on_date=p_date;

  -- 출석 체크 대상 = 학교/기타를 제외한 반복 일정 중 그날 취소되지 않은 것 + 그날 추가된 학원류
  select count(*) into v_att_total from routines r
   where r.set_id=v_set and r.child_id=p_child and r.weekday=v_wd
     and r.category in ('academy','sport','art')
     and not exists (select 1 from routine_cancels rc where rc.routine_id=r.id and rc.on_date=p_date);
  v_att_total := v_att_total + (
    select count(*) from extra_events e
     where e.child_id=p_child and e.on_date=p_date and e.category in ('academy','sport','art'));
  select count(*) into v_att_done from attendance_logs
   where child_id=p_child and on_date=p_date;

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

-- 아이 전용 링크 토큰 재발급 (보호자만)
create or replace function public.reset_kid_token(p_child uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_family uuid; v_tok text;
begin
  select family_id into v_family from members where id = p_child;
  if v_family is null or v_family not in (select public.my_family_ids()) then
    raise exception 'not allowed';
  end if;
  v_tok := encode(gen_random_bytes(24), 'hex');
  update members set access_token = v_tok where id = p_child;
  return v_tok;
end $$;

-- =====================================================================
--  실시간 동기화 대상 테이블
-- =====================================================================
--  (1차에서는 12초 폴링으로 동기화합니다. 나중에 WebSocket 을 켤 때를 대비해 등록만 해둡니다.)
do $$
begin
  alter publication supabase_realtime add table
    schedule_sets, set_periods, members,
    routines, tasks, date_notes, routine_cancels, extra_events,
    pickups, weekly_status, day_status,
    task_logs, attendance_logs, point_ledger, redemptions, notifications;
exception when others then
  raise notice 'realtime publication 등록 생략: %', sqlerrm;
end $$;
