-- =====================================================================
--  08_notices.sql — 알림 빈틈 메우기
--
--  1) 아이가 알림을 읽음 처리할 수 있게 (종 아이콘 빨간 숫자가 사라지도록)
--  2) 지난 날짜 완료를 보호자가 승인/거절하면 아이에게 알림
--  3) 보상 교환을 신청하면 보호자에게, 승인/거절되면 아이에게 알림
--
--  01~07 을 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
--
--  ※ 알림 트리거는 전부 begin … exception … end 로 감쌌습니다.
--    알림은 덤이라, 알림을 못 만들더라도 숙제 체크·포인트·보상 교환이
--    실패하면 안 되기 때문입니다.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) 아이: 자기 알림의 read_at 만 고칠 수 있게
-- ---------------------------------------------------------------------
revoke update on notifications from anon;
grant  update (read_at) on notifications to anon;

drop policy if exists k_notifications_upd on notifications;
create policy k_notifications_upd on notifications for update to anon
  using      (audience = 'child' and child_id = public.kid_id())
  with check (audience = 'child' and child_id = public.kid_id());

-- ---------------------------------------------------------------------
--  2) 지난 날짜 완료 — 보호자의 승인/거절을 아이에게 알림
--     · 승인   : pending true → false (UPDATE)
--     · 거절   : 승인 대기 행을 보호자가 지움 (DELETE)
--     · 아이가 스스로 신청을 취소한 경우(요청에 아이 토큰이 있음)는 알리지 않음
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_late_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_title text;
  v_pts   int;
  v_ok    boolean;
  v_day   text;
begin
  if tg_op = 'UPDATE' then
    if not (old.pending and not new.pending) then return new; end if;
    r := new; v_ok := true;
  else
    if not old.pending or public.kid_id() is not null then return old; end if;
    r := old; v_ok := false;
  end if;

  begin
    if tg_table_name = 'task_logs' then
      select title, points into v_title, v_pts from tasks where id = r.task_id;
    else
      select coalesce(ro.title, e.title) into v_title
        from (select 1) x
        left join routines ro    on ro.id = r.routine_id
        left join extra_events e on e.id  = r.extra_event_id;
      select attend_points into v_pts from families where id = r.family_id;
    end if;

    v_day := to_char(r.on_date, 'MM월 DD일');
    insert into notifications(family_id, audience, child_id, icon, title, body)
    values (r.family_id, 'child', r.child_id,
            case when v_ok then '✅' else '💬' end,
            case when v_ok then '«' || coalesce(v_title,'') || '» ' || v_day || ' 완료로 확인했어!'
                        else '«' || coalesce(v_title,'') || '» ' || v_day || ' 은(는) 확인이 안 됐어' end,
            case when v_ok then '+' || coalesce(v_pts,0) || 'P 가 들어왔어 🐾'
                        else '엄마·아빠한테 물어봐!' end);
  exception when others then
    null;   -- 알림 실패가 체크·승인을 막으면 안 됩니다
  end;

  if tg_op = 'UPDATE' then return new; else return old; end if;
end $$;

drop trigger if exists task_logs_late_result on task_logs;
create trigger task_logs_late_result after update or delete on task_logs
  for each row execute function public.trg_notify_late_result();

drop trigger if exists att_logs_late_result on attendance_logs;
create trigger att_logs_late_result after update or delete on attendance_logs
  for each row execute function public.trg_notify_late_result();

-- ---------------------------------------------------------------------
--  3) 보상 교환 — 신청(보호자에게) / 승인·거절(아이에게)
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_redeem()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text; v_emoji text; v_name text;
begin
  begin
    select title, emoji into v_title, v_emoji from rewards where id = new.reward_id;

    if tg_op = 'INSERT' then
      select name into v_name from members where id = new.child_id;
      insert into notifications(family_id, audience, child_id, icon, title, body)
      values (new.family_id, 'parents', new.child_id, '🎁',
              coalesce(v_name,'아이') || '(이)가 보상 교환을 신청했어요',
              coalesce(v_emoji,'') || ' ' || coalesce(v_title,'') || ' · ' || new.cost || 'P');

    elsif new.status is distinct from old.status and new.status in ('approved','rejected') then
      insert into notifications(family_id, audience, child_id, icon, title, body)
      values (new.family_id, 'child', new.child_id,
              case when new.status = 'approved' then '🎉' else '💬' end,
              case when new.status = 'approved'
                   then '«' || coalesce(v_title,'보상') || '» 교환이 승인됐어!'
                   else '«' || coalesce(v_title,'보상') || '» 교환은 이번엔 어렵대' end,
              case when new.status = 'approved'
                   then new.cost || 'P 를 썼어. 엄마·아빠한테 받아가 🐾'
                   else '포인트는 그대로야. 다른 보상을 골라봐!' end);
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;

drop trigger if exists redemptions_notify on redemptions;
create trigger redemptions_notify after insert or update on redemptions
  for each row execute function public.trg_notify_redeem();
