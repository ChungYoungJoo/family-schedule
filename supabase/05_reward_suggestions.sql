-- =====================================================================
--  05_reward_suggestions.sql — 아이가 갖고 싶은 보상 제안하기
--
--  아이가 «포인트 상점» 에서 "이런 보상 갖고 싶어요" 를 올리면,
--  보호자가 몇 포인트로 할지 정해서 확정합니다.
--  확정하면 rewards 에 새 보상이 생기고 아이 상점에 바로 보입니다.
--
--  01~04 를 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
-- =====================================================================

create table if not exists reward_suggestions (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  child_id   uuid not null references members(id)  on delete cascade,
  emoji      text not null default '🎁',
  title      text not null,
  note       text,                                  -- 아이가 쓴 이유 (선택)
  status     text not null default 'pending'
             check (status in ('pending','approved','rejected')),
  reward_id  uuid references rewards(id) on delete set null,   -- 확정하며 만들어진 보상
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

create index if not exists reward_suggestions_idx
  on reward_suggestions (family_id, status, created_at desc);

alter table reward_suggestions enable row level security;

grant select, insert, delete         on reward_suggestions to anon;
grant select, insert, update, delete on reward_suggestions to authenticated;

-- ---------------------------------------------------------------------
-- 아이가 보낸 값은 믿지 않습니다 (가족·상태는 서버가 다시 채움)
-- ---------------------------------------------------------------------
create or replace function public.trg_guard_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_fam uuid;
begin
  select family_id into v_fam from members where id = new.child_id and kind = 'child';
  if v_fam is null then raise exception '없는 아이입니다'; end if;
  new.family_id  := v_fam;
  new.status     := 'pending';
  new.reward_id  := null;
  new.decided_at := null;
  new.decided_by := null;
  new.title      := btrim(new.title);
  new.emoji      := coalesce(nullif(btrim(new.emoji), ''), '🎁');
  if new.title = '' then raise exception '갖고 싶은 것을 적어 주세요'; end if;
  return new;
end $$;

drop trigger if exists reward_suggestions_guard on reward_suggestions;
create trigger reward_suggestions_guard before insert on reward_suggestions
  for each row execute function public.trg_guard_suggestion();

-- 보호자 알림함에 쌓아 둡니다 (아이는 notifications 에 직접 못 넣으므로 트리거로)
create or replace function public.trg_notify_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(family_id, audience, child_id, icon, title, body)
  select new.family_id, 'parents', new.child_id, '💡',
         (select name from members where id = new.child_id) || '(이)가 갖고 싶은 보상을 말했어요',
         new.emoji || ' ' || new.title || coalesce(' · ' || new.note, '');
  return new;
end $$;

drop trigger if exists reward_suggestions_notify on reward_suggestions;
create trigger reward_suggestions_notify after insert on reward_suggestions
  for each row execute function public.trg_notify_suggestion();

-- ---------------------------------------------------------------------
-- 행 수준 보안
-- ---------------------------------------------------------------------
drop policy if exists p_parent_suggestions on reward_suggestions;
create policy p_parent_suggestions on reward_suggestions for all to authenticated
  using      (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));

drop policy if exists k_suggestions_read on reward_suggestions;
create policy k_suggestions_read on reward_suggestions for select to anon
  using (child_id = public.kid_id());

drop policy if exists k_suggestions_ins on reward_suggestions;
create policy k_suggestions_ins on reward_suggestions for insert to anon
  with check (child_id = public.kid_id() and family_id = public.kid_family_id());

-- 아직 검토 전인 제안은 아이가 스스로 지울 수 있습니다
drop policy if exists k_suggestions_del on reward_suggestions;
create policy k_suggestions_del on reward_suggestions for delete to anon
  using (child_id = public.kid_id() and status = 'pending');

-- ---------------------------------------------------------------------
-- 확정 / 거절 (보호자 전용)
--   확정: 보상 목록에 새 항목을 만들고 제안을 approved 로 닫습니다.
-- ---------------------------------------------------------------------
create or replace function public.approve_reward_suggestion(p_id uuid, p_cost int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_s reward_suggestions%rowtype; v_rid uuid; v_order int;
begin
  select * into v_s from reward_suggestions where id = p_id;
  if v_s.id is null then raise exception '없는 제안입니다'; end if;
  if v_s.family_id not in (select public.my_family_ids()) then raise exception 'not allowed'; end if;
  if v_s.status <> 'pending' then raise exception '이미 처리된 제안입니다'; end if;
  if coalesce(p_cost, 0) <= 0 then raise exception '포인트는 1 이상이어야 합니다'; end if;

  select coalesce(max(sort_order), 0) + 1 into v_order
    from rewards where family_id = v_s.family_id;

  insert into rewards(family_id, emoji, title, cost, sort_order)
  values (v_s.family_id, v_s.emoji, v_s.title, p_cost, v_order)
  returning id into v_rid;

  update reward_suggestions
     set status = 'approved', reward_id = v_rid, decided_at = now(), decided_by = auth.uid()
   where id = p_id;

  insert into notifications(family_id, audience, child_id, icon, title, body)
  values (v_s.family_id, 'child', v_s.child_id, '🎁',
          '«' || v_s.title || '» 보상이 상점에 생겼어요!',
          p_cost || 'P 를 모으면 바꿀 수 있어요');

  return v_rid;
end $$;

create or replace function public.reject_reward_suggestion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_s reward_suggestions%rowtype;
begin
  select * into v_s from reward_suggestions where id = p_id;
  if v_s.id is null then raise exception '없는 제안입니다'; end if;
  if v_s.family_id not in (select public.my_family_ids()) then raise exception 'not allowed'; end if;
  if v_s.status <> 'pending' then raise exception '이미 처리된 제안입니다'; end if;

  update reward_suggestions
     set status = 'rejected', decided_at = now(), decided_by = auth.uid()
   where id = p_id;

  insert into notifications(family_id, audience, child_id, icon, title, body)
  values (v_s.family_id, 'child', v_s.child_id, '💬',
          '«' || v_s.title || '» 은(는) 이번엔 어렵대요',
          '다른 보상을 말해 볼까요?');
end $$;

grant execute on function public.approve_reward_suggestion(uuid, int) to authenticated;
grant execute on function public.reject_reward_suggestion(uuid)       to authenticated;

-- 나중에 WebSocket 을 켤 때를 대비해 등록만 해둡니다
do $$
begin
  alter publication supabase_realtime add table reward_suggestions;
exception when others then
  raise notice 'realtime publication 등록 생략: %', sqlerrm;
end $$;
