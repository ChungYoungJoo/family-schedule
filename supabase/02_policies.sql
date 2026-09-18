-- =====================================================================
--  우리집 하루 — 행 수준 보안(RLS)
--  · 보호자(authenticated) : 자기 가족 데이터 전체 읽기/쓰기
--  · 아이(anon + x-kid-token 헤더) : 자기 것만 읽기 + 체크/교환신청만 쓰기
--  01_schema.sql 실행 후에 실행하세요.
-- =====================================================================

alter table families        enable row level security;
alter table family_users    enable row level security;
alter table members         enable row level security;
alter table schedule_sets   enable row level security;
alter table set_periods     enable row level security;
alter table routines        enable row level security;
alter table tasks           enable row level security;
alter table date_notes      enable row level security;
alter table routine_cancels enable row level security;
alter table extra_events    enable row level security;
alter table pickups         enable row level security;
alter table weekly_status   enable row level security;
alter table day_status      enable row level security;
alter table task_logs       enable row level security;
alter table attendance_logs enable row level security;
alter table point_ledger    enable row level security;
alter table rewards         enable row level security;
alter table redemptions     enable row level security;
alter table notifications   enable row level security;

-- 아이 링크 토큰과 계정 id 는 익명 클라이언트에 절대 노출하지 않습니다.
-- (테이블 단위 select 를 걷어내고 필요한 컬럼만 다시 부여)
revoke select on members from anon;
grant select (id, family_id, kind, name, full_name, descr, color, emoji, can_pickup, sort_order)
  on members to anon;

-- ---------------------------------------------------------------------
-- 보호자: 자기 가족 전체 권한
-- ---------------------------------------------------------------------
create policy p_families on families for all to authenticated
  using (id in (select public.my_family_ids()))
  with check (id in (select public.my_family_ids()));

create policy p_family_users on family_users for select to authenticated
  using (user_id = auth.uid() or family_id in (select public.my_family_ids()));

do $$
declare t text;
begin
  foreach t in array array[
    'members','schedule_sets','set_periods','routines','tasks','date_notes','routine_cancels',
    'extra_events','pickups','weekly_status','day_status','task_logs',
    'attendance_logs','rewards','redemptions','notifications'
  ] loop
    execute format($f$
      create policy p_parent_all on %I for all to authenticated
        using (family_id in (select public.my_family_ids()))
        with check (family_id in (select public.my_family_ids()));
    $f$, t);
  end loop;
end $$;

-- point_ledger 는 읽기만 (적립/차감은 트리거·RPC가 담당)
create policy p_ledger_read on point_ledger for select to authenticated
  using (family_id in (select public.my_family_ids()));

-- ---------------------------------------------------------------------
-- 아이(전용 링크): 읽기
-- ---------------------------------------------------------------------
create policy k_families on families for select to anon
  using (id = public.kid_family_id());

create policy k_members on members for select to anon
  using (family_id = public.kid_family_id());

create policy k_sets on schedule_sets for select to anon
  using (family_id = public.kid_family_id());

create policy k_periods on set_periods for select to anon
  using (family_id = public.kid_family_id());

create policy k_routines on routines for select to anon
  using (child_id = public.kid_id());

create policy k_tasks on tasks for select to anon
  using (child_id = public.kid_id());

create policy k_notes on date_notes for select to anon
  using (family_id = public.kid_family_id());

create policy k_cancels on routine_cancels for select to anon
  using (family_id = public.kid_family_id());

create policy k_extras on extra_events for select to anon
  using (child_id = public.kid_id());

-- 누가 데리러 오는지 확인하는 용도
create policy k_pickups on pickups for select to anon
  using (family_id = public.kid_family_id());

create policy k_rewards on rewards for select to anon
  using (family_id = public.kid_family_id());

create policy k_ledger on point_ledger for select to anon
  using (child_id = public.kid_id());

create policy k_redemptions_read on redemptions for select to anon
  using (child_id = public.kid_id());

create policy k_task_logs_read on task_logs for select to anon
  using (child_id = public.kid_id());

create policy k_att_logs_read on attendance_logs for select to anon
  using (child_id = public.kid_id());

create policy k_notifications on notifications for select to anon
  using (audience = 'child' and child_id = public.kid_id());

-- ---------------------------------------------------------------------
-- 아이: 쓰기 (체크 / 체크 해제 / 보상 교환 신청)
-- ---------------------------------------------------------------------
create policy k_task_logs_ins on task_logs for insert to anon
  with check (child_id = public.kid_id() and family_id = public.kid_family_id());
create policy k_task_logs_del on task_logs for delete to anon
  using (child_id = public.kid_id());

create policy k_att_logs_ins on attendance_logs for insert to anon
  with check (child_id = public.kid_id() and family_id = public.kid_family_id());
create policy k_att_logs_del on attendance_logs for delete to anon
  using (child_id = public.kid_id());

-- 신청만 가능 (승인/거절은 보호자만)
create policy k_redeem_ins on redemptions for insert to anon
  with check (child_id = public.kid_id()
              and family_id = public.kid_family_id()
              and status = 'pending');

-- 어른 일정(weekly_status / day_status)은 아이에게 공개하지 않습니다.

-- ---------------------------------------------------------------------
-- 실행 권한
-- ---------------------------------------------------------------------
grant select on child_balances to anon, authenticated;

grant execute on function public.whoami_kid()                   to anon;
grant execute on function public.claim_daily_bonus(uuid, date) to anon, authenticated;
grant execute on function public.reset_kid_token(uuid)          to authenticated;
grant execute on function public.active_set_id(uuid, date)      to anon, authenticated;
