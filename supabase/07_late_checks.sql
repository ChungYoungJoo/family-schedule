-- =====================================================================
--  07_late_checks.sql — 지난 날짜 체크는 보호자 승인 후 완료
--
--  아이가 «어제 것»을 뒤늦게 체크하면 바로 완료되지 않고 «승인 대기»가 됩니다.
--  보호자가 승인해야 포인트가 들어갑니다. 오늘 것은 지금처럼 바로 완료됩니다.
--  보호자가 직접 누르는 것은 날짜와 상관없이 바로 완료입니다.
--
--  새 표를 만들지 않고 기존 기록에 pending 플래그를 더합니다.
--  (task_logs / attendance_logs 의 unique 제약을 그대로 쓸 수 있습니다)
--
--  01~06 을 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
-- =====================================================================

alter table task_logs       add column if not exists pending boolean not null default false;
alter table attendance_logs add column if not exists pending boolean not null default false;

comment on column task_logs.pending       is 'true = 지난 날짜를 뒤늦게 체크함. 보호자 승인 전';
comment on column attendance_logs.pending is 'true = 지난 날짜를 뒤늦게 체크함. 보호자 승인 전';

-- ---------------------------------------------------------------------
--  가족의 «오늘» (한국 시간).  UTC 로 판단하면 아침에 어제로 취급됩니다.
-- ---------------------------------------------------------------------
create or replace function public.family_today(p_family uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone
          coalesce((select timezone from families where id = p_family), 'Asia/Seoul'))::date
$$;
grant execute on function public.family_today(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
--  포인트 적립 — 승인 대기 중에는 적립하지 않고, 승인되는 순간 적립
-- ---------------------------------------------------------------------
create or replace function public.trg_task_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pts int; v_title text;
begin
  if tg_op = 'INSERT' then
    if new.pending then return new; end if;               -- 아직 승인 전
    select points, title into v_pts, v_title from tasks where id = new.task_id;
    insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
    values (new.family_id, new.child_id, coalesce(v_pts,0),
            '숙제: '||coalesce(v_title,''), 'task', new.id, new.on_date);
    return new;

  elsif tg_op = 'UPDATE' then
    if old.pending and not new.pending then               -- 보호자가 승인
      select points, title into v_pts, v_title from tasks where id = new.task_id;
      insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
      values (new.family_id, new.child_id, coalesce(v_pts,0),
              '숙제: '||coalesce(v_title,''), 'task', new.id, new.on_date);
    elsif not old.pending and new.pending then            -- 승인을 되돌림
      delete from point_ledger where ref_type = 'task' and ref_id = old.id;
      delete from point_ledger
        where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    end if;
    return new;

  else
    delete from point_ledger where ref_type = 'task' and ref_id = old.id;
    delete from point_ledger
      where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    return old;
  end if;
end $$;

drop trigger if exists task_logs_points on task_logs;
create trigger task_logs_points
  after insert or update or delete on task_logs
  for each row execute function public.trg_task_points();

create or replace function public.trg_attend_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pts int; v_title text;
begin
  if tg_op = 'INSERT' then
    if new.pending then return new; end if;
    select attend_points into v_pts from families where id = new.family_id;
    select coalesce(r.title, e.title) into v_title
      from (select 1) x
      left join routines r     on r.id = new.routine_id
      left join extra_events e on e.id = new.extra_event_id;
    insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
    values (new.family_id, new.child_id, coalesce(v_pts,20),
            '출석: '||coalesce(v_title,''), 'attend', new.id, new.on_date);
    return new;

  elsif tg_op = 'UPDATE' then
    if old.pending and not new.pending then
      select attend_points into v_pts from families where id = new.family_id;
      select coalesce(r.title, e.title) into v_title
        from (select 1) x
        left join routines r     on r.id = new.routine_id
        left join extra_events e on e.id = new.extra_event_id;
      insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
      values (new.family_id, new.child_id, coalesce(v_pts,20),
              '출석: '||coalesce(v_title,''), 'attend', new.id, new.on_date);
    elsif not old.pending and new.pending then
      delete from point_ledger where ref_type = 'attend' and ref_id = old.id;
      delete from point_ledger
        where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    end if;
    return new;

  else
    delete from point_ledger where ref_type = 'attend' and ref_id = old.id;
    delete from point_ledger
      where ref_type = 'bonus' and child_id = old.child_id and on_date = old.on_date;
    return old;
  end if;
end $$;

drop trigger if exists attendance_logs_points on attendance_logs;
create trigger attendance_logs_points
  after insert or update or delete on attendance_logs
  for each row execute function public.trg_attend_points();

-- ---------------------------------------------------------------------
--  아이 권한
--    · 오늘 것   → 바로 완료 (pending = false)
--    · 지난 날짜 → 승인 대기로만 (pending = true)
--    · 앞으로 올 날짜 → 불가
--  되돌리기는 «오늘 것» 과 «승인 대기 중인 것» 만. 승인된 지난 기록은 못 지웁니다.
-- ---------------------------------------------------------------------
drop policy if exists k_task_logs_ins on task_logs;
create policy k_task_logs_ins on task_logs for insert to anon
  with check (child_id = public.kid_id()
              and family_id = public.kid_family_id()
              and on_date <= public.family_today(family_id)
              and pending = (on_date <> public.family_today(family_id)));

drop policy if exists k_task_logs_del on task_logs;
create policy k_task_logs_del on task_logs for delete to anon
  using (child_id = public.kid_id()
         and (pending or on_date = public.family_today(family_id)));

drop policy if exists k_att_logs_ins on attendance_logs;
create policy k_att_logs_ins on attendance_logs for insert to anon
  with check (child_id = public.kid_id()
              and family_id = public.kid_family_id()
              and on_date <= public.family_today(family_id)
              and pending = (on_date <> public.family_today(family_id)));

drop policy if exists k_att_logs_del on attendance_logs;
create policy k_att_logs_del on attendance_logs for delete to anon
  using (child_id = public.kid_id()
         and (pending or on_date = public.family_today(family_id)));

-- ---------------------------------------------------------------------
--  하루 전부 완료 보너스 — 승인 대기 중인 것은 «한 것»으로 세지 않습니다
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

  if not (public.kid_id() = p_child or v_family in (select public.my_family_ids())) then
    raise exception 'not allowed';
  end if;

  if exists (select 1 from point_ledger
             where ref_type='bonus' and child_id=p_child and on_date=p_date) then
    return 0;
  end if;

  v_set := public.active_set_id(v_family, p_date);
  if v_set is null then return 0; end if;
  v_wd  := extract(dow from p_date)::int;

  select count(*) into v_task_total from tasks t
   where t.set_id=v_set and t.child_id=p_child and not t.archived
     and (t.weekdays is null or v_wd = any(t.weekdays))
     and not exists (select 1 from task_cancels tc
                      where tc.task_id = t.id and tc.on_date = p_date);
  select count(*) into v_task_done from task_logs
   where child_id=p_child and on_date=p_date and not pending;

  select count(*) into v_att_total from routines r
   where r.set_id=v_set and r.child_id=p_child and r.weekday=v_wd
     and r.category in ('academy','sport','art')
     and not exists (select 1 from routine_cancels rc
                      where rc.routine_id=r.id and rc.on_date=p_date);
  v_att_total := v_att_total + (
    select count(*) from extra_events e
     where e.child_id=p_child and e.on_date=p_date and e.category in ('academy','sport','art'));
  select count(*) into v_att_done from attendance_logs
   where child_id=p_child and on_date=p_date and not pending;

  if (v_task_total + v_att_total) = 0 then return 0; end if;
  if v_task_done < v_task_total or v_att_done < v_att_total then return 0; end if;

  select bonus_points into v_bonus from families where id = v_family;
  insert into point_ledger(family_id, child_id, delta, reason, ref_type, ref_id, on_date)
  values (v_family, p_child, coalesce(v_bonus,20), '하루 전부 완료 보너스', 'bonus', null, p_date);

  insert into notifications(family_id, audience, child_id, icon, title, body)
  select v_family, 'parents', p_child, '🏅',
         (select name from members where id=p_child) || '(이)가 할 일을 모두 마쳤어요',
         to_char(p_date,'MM월 DD일') || ' · 보너스 ' || coalesce(v_bonus,20) || 'P 적립';

  return coalesce(v_bonus,20);
end $$;

-- ---------------------------------------------------------------------
--  아이가 지난 날짜를 체크하면 보호자 알림함에 쌓아 둡니다
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_late()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not new.pending then return new; end if;
  select name into v_name from members where id = new.child_id;
  insert into notifications(family_id, audience, child_id, icon, title, body)
  values (new.family_id, 'parents', new.child_id, '🕐',
          coalesce(v_name,'아이') || '(이)가 지난 날짜 완료를 신청했어요',
          to_char(new.on_date,'MM월 DD일') || ' · 승인하면 포인트가 들어갑니다');
  return new;
end $$;

drop trigger if exists task_logs_late_notify on task_logs;
create trigger task_logs_late_notify after insert on task_logs
  for each row execute function public.trg_notify_late();

drop trigger if exists att_logs_late_notify on attendance_logs;
create trigger att_logs_late_notify after insert on attendance_logs
  for each row execute function public.trg_notify_late();
