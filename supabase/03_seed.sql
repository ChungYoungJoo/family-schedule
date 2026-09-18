-- =====================================================================
--  우리집 하루 — 초기 데이터
--
--  ※ 실행 전에: Supabase 대시보드 > Authentication > Users 에서
--     보호자 계정(이메일)을 먼저 만들어 두세요.
--
--  아래 ▼설정▼ 블록만 우리 집에 맞게 고치고 통째로 실행하면 됩니다.
--  다시 실행해도 안전합니다 (같은 이름의 가족이 있으면 그대로 둡니다).
-- =====================================================================

do $$
declare
  -- ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 설정 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
  v_family_name  text := '우리집';
  v_email_mom    text := 'mom@example.com';    -- 엄마 로그인 이메일
  v_email_dad    text := null;                 -- 아빠 (없으면 null)
  v_kid1_name    text := '소미';   v_kid1_desc text := '초4';
  v_kid2_name    text := '소빈';   v_kid2_desc text := '초1';
  v_sitter_name  text := '선생님'; v_sitter_full text := '시터선생님';
  -- ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  f uuid;                       -- family
  mom uuid; dad uuid; k1 uuid; k2 uuid; sit uuid;
  s_term uuid; s_vac uuid;      -- 스케줄 세트
  u uuid;
begin
  ------------------------------------------------------------------
  -- 가족
  ------------------------------------------------------------------
  select id into f from families where name = v_family_name;
  if f is null then
    insert into families(name) values (v_family_name) returning id into f;
  else
    raise notice '이미 "%" 가족이 있어 초기화를 건너뜁니다. 다시 만들려면 먼저 삭제하세요.', v_family_name;
    return;
  end if;

  -- 보호자 계정 연결
  select id into u from auth.users where email = v_email_mom;
  if u is null then
    raise exception '계정 %(을)를 찾을 수 없습니다. Authentication > Users 에서 먼저 만들어 주세요.', v_email_mom;
  end if;
  insert into family_users(family_id, user_id) values (f, u);
  insert into members(family_id, kind, name, descr, color, emoji, user_id, can_pickup, sort_order)
    values (f,'parent','엄마','보호자','#e64980','👩',u,true,10) returning id into mom;

  if v_email_dad is not null then
    select id into u from auth.users where email = v_email_dad;
    if u is not null then insert into family_users(family_id, user_id) values (f, u); end if;
    insert into members(family_id, kind, name, descr, color, emoji, user_id, can_pickup, sort_order)
      values (f,'parent','아빠','보호자','#7950f2','👨',u,true,11) returning id into dad;
  end if;

  -- 시터 선생님 (계정 없음, 픽업 담당으로만)
  insert into members(family_id, kind, name, full_name, descr, color, emoji, can_pickup, sort_order)
    values (f,'helper',v_sitter_name,v_sitter_full,'시터 선생님','#0ca678','🧑‍🏫',true,20)
    returning id into sit;

  -- 아이들 (전용 링크 토큰 자동 생성)
  insert into members(family_id, kind, name, descr, color, emoji, access_token, sort_order)
    values (f,'child',v_kid1_name,v_kid1_desc,'#f59f00','🦊',encode(gen_random_bytes(24),'hex'),1)
    returning id into k1;
  insert into members(family_id, kind, name, descr, color, emoji, access_token, sort_order)
    values (f,'child',v_kid2_name,v_kid2_desc,'#22b8cf','🐧',encode(gen_random_bytes(24),'hex'),2)
    returning id into k2;

  ------------------------------------------------------------------
  -- 스케줄 세트 + 적용 기간
  ------------------------------------------------------------------
  insert into schedule_sets(family_id,name,emoji,sort_order) values (f,'학기 중','🏫',1) returning id into s_term;
  insert into schedule_sets(family_id,name,emoji,sort_order) values (f,'방학','🏖',2)   returning id into s_vac;

  insert into set_periods(family_id,set_id,label,starts_on,ends_on) values
    (f,s_term,'1학기','2026-03-02','2026-07-17'),
    (f,s_vac ,'여름방학','2026-07-18','2026-08-16'),
    (f,s_term,'2학기','2026-08-17','2026-12-24'),
    (f,s_vac ,'겨울방학','2026-12-25','2027-02-28'),
    (f,s_term,'1학기','2027-03-02','2027-07-16');

  ------------------------------------------------------------------
  -- 학기 중 시간표  (weekday: 0=일 … 6=토)
  ------------------------------------------------------------------
  insert into routines(family_id,set_id,child_id,weekday,starts_at,ends_at,title,category,needs_pickup,default_pickup_id,default_is_self) values
    (f,s_term,k1,1,'08:40','14:20','학교',    'school' ,false,null ,false),
    (f,s_term,k1,1,'15:00','16:00','태권도',  'sport'  ,false,null ,false),
    (f,s_term,k1,1,'17:00','18:30','수학학원','academy',true ,mom  ,false),
    (f,s_term,k1,2,'08:40','14:20','학교',    'school' ,false,null ,false),
    (f,s_term,k1,2,'15:30','16:30','피아노',  'art'    ,false,null ,false),
    (f,s_term,k1,3,'08:40','13:20','학교',    'school' ,false,null ,false),
    (f,s_term,k1,3,'14:00','16:00','영어학원','academy',true ,sit  ,false),
    (f,s_term,k1,4,'08:40','14:20','학교',    'school' ,false,null ,false),
    (f,s_term,k1,4,'15:00','16:00','태권도',  'sport'  ,false,null ,false),
    (f,s_term,k1,4,'17:00','18:30','수학학원','academy',true ,dad  ,false),
    (f,s_term,k1,5,'08:40','14:20','학교',    'school' ,false,null ,false),
    (f,s_term,k1,5,'15:30','16:30','피아노',  'art'    ,true ,null ,true ),
    (f,s_term,k1,6,'10:00','11:30','축구교실','sport'  ,true ,mom  ,false),

    (f,s_term,k2,1,'08:50','12:40','학교',    'school' ,false,null ,false),
    (f,s_term,k2,1,'12:40','16:00','돌봄교실','school' ,true ,sit  ,false),
    (f,s_term,k2,2,'08:50','12:40','학교',    'school' ,false,null ,false),
    (f,s_term,k2,2,'16:00','17:00','발레',    'art'    ,true ,dad  ,false),
    (f,s_term,k2,3,'08:50','12:40','학교',    'school' ,false,null ,false),
    (f,s_term,k2,3,'12:40','16:00','돌봄교실','school' ,true ,sit  ,false),
    (f,s_term,k2,4,'08:50','12:40','학교',    'school' ,false,null ,false),
    (f,s_term,k2,4,'15:00','16:00','미술',    'art'    ,true ,sit  ,false),
    (f,s_term,k2,5,'08:50','12:40','학교',    'school' ,false,null ,false),
    (f,s_term,k2,5,'12:40','16:00','돌봄교실','school' ,true ,sit  ,false);

  ------------------------------------------------------------------
  -- 방학 시간표
  ------------------------------------------------------------------
  insert into routines(family_id,set_id,child_id,weekday,starts_at,ends_at,title,category,needs_pickup,default_pickup_id) values
    (f,s_vac,k1,1,'09:30','10:30','수영 특강',     'sport'  ,false,null),
    (f,s_vac,k1,1,'14:00','16:00','수학 여름특강', 'academy',true ,sit ),
    (f,s_vac,k1,2,'10:00','12:00','영어캠프',      'academy',true ,mom ),
    (f,s_vac,k1,2,'15:30','16:30','피아노',        'art'    ,false,null),
    (f,s_vac,k1,3,'09:30','10:30','수영 특강',     'sport'  ,false,null),
    (f,s_vac,k1,3,'14:00','16:00','수학 여름특강', 'academy',true ,sit ),
    (f,s_vac,k1,4,'10:00','12:00','영어캠프',      'academy',true ,null),
    (f,s_vac,k1,4,'15:00','16:00','태권도',        'sport'  ,false,null),
    (f,s_vac,k1,5,'09:30','10:30','수영 특강',     'sport'  ,false,null),
    (f,s_vac,k1,5,'15:30','16:30','피아노',        'art'    ,false,null),
    (f,s_vac,k1,6,'10:00','11:30','축구교실',      'sport'  ,true ,dad ),

    (f,s_vac,k2,1,'10:00','12:00','방학 돌봄교실', 'school' ,true ,sit ),
    (f,s_vac,k2,2,'10:00','11:00','발레',          'art'    ,false,null),
    (f,s_vac,k2,2,'14:00','16:00','도서관 독서교실','school',true ,null),
    (f,s_vac,k2,3,'10:00','12:00','방학 돌봄교실', 'school' ,true ,sit ),
    (f,s_vac,k2,4,'10:00','11:00','미술',          'art'    ,false,null),
    (f,s_vac,k2,4,'14:00','16:00','방학 돌봄교실', 'school' ,true ,sit ),
    (f,s_vac,k2,5,'10:00','12:00','방학 돌봄교실', 'school' ,true ,sit );

  ------------------------------------------------------------------
  -- 숙제 / 할 일
  ------------------------------------------------------------------
  insert into tasks(family_id,set_id,child_id,title,note,weekdays,points,sort_order) values
    (f,s_term,k1,'독서 20분',        '읽은 쪽수 적기', null,        10,1),
    (f,s_term,k1,'수학 문제집 2쪽',  '채점까지',       null,        15,2),
    (f,s_term,k1,'영어 단어 10개',   '월·수·금',       '{1,3,5}',   15,3),
    (f,s_term,k1,'피아노 연습 15분', '화·금',          '{2,5}',     10,4),
    (f,s_term,k2,'받아쓰기 연습',    '10문장',         null,        10,1),
    (f,s_term,k2,'그림일기 쓰기',    null,             null,        10,2),
    (f,s_term,k2,'스트레칭',         '화·목',          '{2,4}',     10,3),

    (f,s_vac ,k1,'독서록 1편 쓰기',  '방학 과제',      '{1,3,5}',   20,1),
    (f,s_vac ,k1,'수학 문제집 3쪽',  '채점까지',       null,        20,2),
    (f,s_vac ,k1,'방학 일기 쓰기',   null,             null,        10,3),
    (f,s_vac ,k1,'줄넘기 100개',     null,             null,        10,4),
    (f,s_vac ,k2,'그림일기 쓰기',    '방학 과제',      null,        10,1),
    (f,s_vac ,k2,'책 읽기 15분',     null,             null,        10,2),
    (f,s_vac ,k2,'받아쓰기 연습',    '월·수·금',       '{1,3,5}',   10,3);

  ------------------------------------------------------------------
  -- 어른 요일 기본 일정 / 시터 근무
  ------------------------------------------------------------------
  insert into weekly_status(family_id,member_id,weekday,status)
    select f, mom, g, '출근' from generate_series(1,5) g;
  insert into weekly_status(family_id,member_id,weekday,status) values (f,mom,0,'휴무'),(f,mom,6,'휴무');
  if dad is not null then
    insert into weekly_status(family_id,member_id,weekday,status)
      select f, dad, g, '출근' from generate_series(1,5) g;
    insert into weekly_status(family_id,member_id,weekday,status) values (f,dad,0,'휴무'),(f,dad,6,'휴무');
  end if;
  insert into weekly_status(family_id,member_id,weekday,status)
    select f, sit, g, '근무 12:00~18:00' from generate_series(1,5) g;
  insert into weekly_status(family_id,member_id,weekday,status) values (f,sit,0,'휴무'),(f,sit,6,'휴무');

  ------------------------------------------------------------------
  -- 보상 목록
  ------------------------------------------------------------------
  insert into rewards(family_id,emoji,title,cost,sort_order) values
    (f,'🍬','젤리 한 봉지',      40 ,1),
    (f,'🍪','좋아하는 과자',      50 ,2),
    (f,'📺','영상 30분 추가',     60 ,3),
    (f,'✏️','문구 세트',          150,4),
    (f,'🧸','작은 장난감',        300,5),
    (f,'🎬','가족 영화관 나들이', 500,6),
    (f,'🧱','레고 세트',          800,7);

  raise notice '완료! 가족 id = %', f;
end $$;

-- ---------------------------------------------------------------------
-- 아이 전용 링크 확인 (이 결과의 URL 을 아이 기기 홈화면에 추가하세요)
-- ---------------------------------------------------------------------
select m.name as 아이,
       '#kid=' || m.access_token as 링크_뒤에_붙일_부분
from members m
join families fa on fa.id = m.family_id
where m.kind = 'child'
order by m.sort_order;
