-- =====================================================================
--  10_chat.sql — 부모 ↔ 아이 대화
--
--  · 대화방은 아이 한 명당 하나입니다 (엄마·아빠·그 아이).
--    아이끼리는 서로의 방을 볼 수도, 글을 쓸 수도 없습니다.
--  · 한 번 보낸 메시지는 고칠 수도 지울 수도 없습니다 (기록으로 남음).
--  · 보낸 사람은 서버가 정합니다. 아이가 엄마·아빠 이름으로 보낼 수 없습니다.
--  · 안 읽은 개수는 chat_reads + RPC 로 셉니다 (사람마다 읽은 위치가 따로 있음).
--
--  01~09 를 실행한 뒤, SQL Editor 에서 한 번만 실행하세요.
--  (여러 번 실행해도 안전합니다)
--
--  ※ 이 SQL 을 실행하기 전에도 앱은 정상으로 뜹니다. 그때는 «대화» 탭만 숨겨집니다.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) 메시지
-- ---------------------------------------------------------------------
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  child_id   uuid not null references members(id)  on delete cascade,   -- 대화방 = 아이
  sender_id  uuid not null references members(id)  on delete cascade,   -- 아이 본인 또는 보호자
  body       text not null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists chat_messages_thread_idx on chat_messages (child_id,  created_at desc);
create index if not exists chat_messages_family_idx on chat_messages (family_id, created_at desc);

alter table chat_messages enable row level security;

-- 읽기·보내기만 허용. 수정·삭제 권한은 아무에게도 주지 않습니다.
revoke all on chat_messages from anon, authenticated;
grant select, insert on chat_messages to anon, authenticated;

-- ---------------------------------------------------------------------
--  2) 읽은 위치 — RPC 로만 다룹니다 (정책을 하나도 두지 않아 직접 접근 불가)
-- ---------------------------------------------------------------------
create table if not exists chat_reads (
  reader_id    uuid not null references members(id) on delete cascade,   -- 읽는 사람
  child_id     uuid not null references members(id) on delete cascade,   -- 어느 방
  last_read_at timestamptz not null default 'epoch',
  primary key (reader_id, child_id)
);

alter table chat_reads enable row level security;
revoke all on chat_reads from anon, authenticated;

-- ---------------------------------------------------------------------
--  3) 보낼 때 서버가 다시 채우는 값 (클라이언트가 보낸 값은 믿지 않음)
-- ---------------------------------------------------------------------
create or replace function public.trg_guard_chat()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fam uuid;
  v_kid uuid := public.kid_id();      -- 아이 링크로 들어온 요청이면 그 아이
begin
  select family_id into v_fam from members where id = new.child_id and kind = 'child';
  if v_fam is null then raise exception '없는 대화방입니다'; end if;

  if v_kid is not null then
    -- 아이: 자기 방에만, 자기 이름으로만
    if new.child_id <> v_kid then raise exception 'not allowed'; end if;
    new.sender_id := v_kid;
  else
    -- 보호자: 같은 가족의 보호자 이름으로만
    -- (한 계정을 엄마·아빠가 같이 쓸 수 있어서, 보내는 사람은 «보기 전환» 에서 고른 쪽)
    if not exists (select 1 from members
                    where id = new.sender_id and family_id = v_fam and kind = 'parent') then
      raise exception '보내는 사람이 올바르지 않습니다';
    end if;
  end if;

  new.family_id  := v_fam;
  new.body       := btrim(new.body);
  new.created_at := clock_timestamp();            -- 시각은 항상 서버 시계

  if new.body = ''                 then raise exception '내용을 적어 주세요'; end if;
  if char_length(new.body) > 500   then raise exception '메시지는 500자까지 보낼 수 있어요'; end if;
  return new;
end $$;

drop trigger if exists chat_messages_guard on chat_messages;
create trigger chat_messages_guard before insert on chat_messages
  for each row execute function public.trg_guard_chat();

-- ---------------------------------------------------------------------
--  4) 행 수준 보안
-- ---------------------------------------------------------------------
-- 보호자: 우리 가족의 모든 방을 읽고 쓸 수 있음
drop policy if exists p_chat_read on chat_messages;
create policy p_chat_read on chat_messages for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists p_chat_ins on chat_messages;
create policy p_chat_ins on chat_messages for insert to authenticated
  with check (family_id in (select public.my_family_ids()));

-- 아이: 자기 방만 읽고, 자기 방에만 씀 (형제자매 방은 보이지 않음)
drop policy if exists k_chat_read on chat_messages;
create policy k_chat_read on chat_messages for select to anon
  using (child_id = public.kid_id());

drop policy if exists k_chat_ins on chat_messages;
create policy k_chat_ins on chat_messages for insert to anon
  with check (child_id = public.kid_id()
              and sender_id = public.kid_id()
              and family_id = public.kid_family_id());

-- ---------------------------------------------------------------------
--  5) 안 읽은 개수 / 읽음 표시
-- ---------------------------------------------------------------------
-- 이 요청을 보낸 사람이 대화에서 «누구» 인지.
--   아이 링크 → 그 아이 / 보호자 → p_as (보기 전환으로 고른 보호자, 우리 가족일 때만)
create or replace function public.chat_reader(p_as uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_kid uuid := public.kid_id();
begin
  if v_kid is not null then return v_kid; end if;
  if p_as is not null and exists (
       select 1 from members m
        where m.id = p_as and m.kind = 'parent'
          and m.family_id in (select public.my_family_ids())) then
    return p_as;
  end if;
  return null;
end $$;

revoke execute on function public.chat_reader(uuid) from public, anon, authenticated;

-- 방마다 안 읽은 개수 (내가 보낸 것은 세지 않음)
create or replace function public.chat_unread(p_as uuid default null)
returns table (thread uuid, unread int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me   uuid := public.chat_reader(p_as);
  v_kind text;
  v_fam  uuid;
begin
  if v_me is null then return; end if;
  select kind, family_id into v_kind, v_fam from members where id = v_me;

  return query
    select m.child_id, count(*)::int
      from chat_messages m
      left join chat_reads r on r.reader_id = v_me and r.child_id = m.child_id
     where m.sender_id <> v_me
       and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
       and (case when v_kind = 'child' then m.child_id = v_me else m.family_id = v_fam end)
     group by m.child_id;
end $$;

-- «여기까지 읽었다» 표시. 화면에 실제로 보여준 마지막 메시지 시각(p_upto)까지만 읽음 처리해서,
-- 읽는 도중에 막 도착한 메시지가 보지도 않았는데 읽은 것이 되지 않게 합니다.
create or replace function public.chat_mark_read(p_child uuid, p_upto timestamptz, p_as uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := public.chat_reader(p_as);
  v_kind  text;
  v_fam   uuid;
  v_cfam  uuid;
begin
  if v_me is null then raise exception 'not allowed'; end if;
  select kind, family_id into v_kind, v_fam from members where id = v_me;
  select family_id into v_cfam from members where id = p_child and kind = 'child';

  if v_cfam is null or v_cfam <> v_fam          then raise exception 'not allowed'; end if;
  if v_kind = 'child' and p_child <> v_me       then raise exception 'not allowed'; end if;

  insert into chat_reads (reader_id, child_id, last_read_at)
  values (v_me, p_child, p_upto)
  on conflict (reader_id, child_id)
  do update set last_read_at = greatest(chat_reads.last_read_at, excluded.last_read_at);
end $$;

grant execute on function public.chat_unread(uuid)                       to anon, authenticated;
grant execute on function public.chat_mark_read(uuid, timestamptz, uuid) to anon, authenticated;
