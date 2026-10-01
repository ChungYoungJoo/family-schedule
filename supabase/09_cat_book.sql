-- =====================================================================
--  09_cat_book.sql — 고양이 도감
--
--  연속 달성 3 · 7 · 14 · 21 · 30 · 50 · 75 · 100 일을 채울 때마다
--  새 고양이 친구가 도감에 들어옵니다. 한 번 만난 친구는 연속이 끊겨도 남습니다.
--  (고양이 그림과 이름은 앱의 docs/cats.js 에 있습니다. 일수 목록은 서로 같아야 합니다)
--
--  01~08 을 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
--
--  ※ 도감 지급은 «하루 전부 완료 보너스» 가 들어가는 순간 트리거로 일어납니다.
--    begin … exception … end 로 감쌌으므로, 도감 쪽에 문제가 생겨도
--    포인트와 보너스는 정상적으로 들어갑니다.
-- =====================================================================

create table if not exists cat_collection (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  child_id    uuid not null references members(id)  on delete cascade,
  milestone   int  not null,                         -- 연속 달성 일수
  unlocked_on date not null default current_date,
  unique (child_id, milestone)
);
create index if not exists cat_collection_idx on cat_collection (family_id);

alter table cat_collection enable row level security;

-- 읽기만 열어 둡니다. 지급은 서버(트리거)만 합니다.
revoke insert, update, delete on cat_collection from anon, authenticated;
grant  select on cat_collection to anon, authenticated;

drop policy if exists p_parent_cats on cat_collection;
create policy p_parent_cats on cat_collection for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists k_cats on cat_collection;
create policy k_cats on cat_collection for select to anon
  using (child_id = public.kid_id());

-- ---------------------------------------------------------------------
--  연속 달성 일수 — 앱의 streakOf() 와 같은 규칙입니다 (core.js 참고)
--    · 오늘 보너스가 아직 없으면 어제부터 셉니다
--    · 쉬는 날(공휴일·아파서 쉬는 날)과 할 일이 없던 날은 끊지 않고 건너뜁니다
--    · 할 일 = 숙제·준비물 + 학교·기타를 뺀 반복 일정
--    · 최대 90일까지 거슬러 올라갑니다
-- ---------------------------------------------------------------------
create or replace function public.child_streak(p_child uuid, p_today date)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v_family uuid; v_set uuid; v_wd int; v_due int;
  d date := p_today; n int := 0; i int;
begin
  select family_id into v_family from members where id = p_child;
  if v_family is null then return 0; end if;

  if not exists (select 1 from point_ledger
                  where child_id = p_child and ref_type = 'bonus' and on_date = d) then
    d := d - 1;
  end if;

  for i in 0..89 loop
    -- 쉬는 날은 건너뜁니다
    if exists (select 1 from date_notes
                where family_id = v_family and on_date = d and note_key in ('holiday','sick')) then
      d := d - 1; continue;
    end if;

    v_set := coalesce(public.active_set_id(v_family, d),
                      (select id from schedule_sets where family_id = v_family
                        order by sort_order limit 1));
    v_wd  := extract(dow from d)::int;

    select (select count(*) from tasks t
             where t.set_id = v_set and t.child_id = p_child and not t.archived
               and (t.weekdays is null or v_wd = any(t.weekdays)))
         + (select count(*) from routines r
             where r.set_id = v_set and r.child_id = p_child and r.weekday = v_wd
               and r.category not in ('school','etc'))
      into v_due;

    if v_due = 0 then d := d - 1; continue; end if;       -- 할 일이 없던 날

    if not exists (select 1 from point_ledger
                    where child_id = p_child and ref_type = 'bonus' and on_date = d) then
      exit;                                               -- 다 하지 못한 날 → 여기서 끊김
    end if;

    n := n + 1;
    d := d - 1;
  end loop;

  return n;
end $$;

-- ---------------------------------------------------------------------
--  도감 지급 — 이미 만난 친구는 그대로 두고, 새로 채운 일수만 넣고 알립니다
-- ---------------------------------------------------------------------
create or replace function public.unlock_cats(p_child uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_family uuid; v_today date; v_streak int; m int; n int := 0;
begin
  select family_id into v_family from members where id = p_child and kind = 'child';
  if v_family is null then return 0; end if;

  v_today  := public.family_today(v_family);
  v_streak := public.child_streak(p_child, v_today);

  for m in
    insert into cat_collection(family_id, child_id, milestone, unlocked_on)
    select v_family, p_child, t.x, v_today
      from unnest(array[3,7,14,21,30,50,75,100]) as t(x)
     where t.x <= v_streak
    on conflict (child_id, milestone) do nothing
    returning milestone
  loop
    n := n + 1;
    insert into notifications(family_id, audience, child_id, icon, title, body)
    values (v_family, 'child', p_child, '😻', '새 고양이 친구가 왔어!',
            m || '일 연속 달성! 고양이 도감을 열어봐 🐾');
  end loop;

  return n;
end $$;

-- 앱이 직접 부르는 함수가 아닙니다. 트리거만 쓰도록 바깥 호출을 막아 둡니다.
revoke execute on function public.child_streak(uuid, date) from public, anon, authenticated;
revoke execute on function public.unlock_cats(uuid)        from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  하루 전부 완료 보너스가 들어갈 때마다 도감을 확인합니다
-- ---------------------------------------------------------------------
create or replace function public.trg_cat_unlock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.unlock_cats(new.child_id);
  exception when others then
    null;     -- 도감 문제로 보너스 적립이 실패하면 안 됩니다
  end;
  return new;
end $$;

drop trigger if exists point_ledger_cats on point_ledger;
create trigger point_ledger_cats after insert on point_ledger
  for each row when (new.ref_type = 'bonus')
  execute function public.trg_cat_unlock();

-- ---------------------------------------------------------------------
--  이미 연속 달성 중인 아이에게 지금까지의 친구를 한 번에 지급
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in select id from members where kind = 'child' loop
    begin
      perform public.unlock_cats(c.id);
    exception when others then
      raise notice '도감 초기 지급 생략 (%): %', c.id, sqlerrm;
    end;
  end loop;
end $$;
