// =====================================================================
//  우리집 하루 — 진입점
//
//  파일 구성
//    core.js          상수 / 유틸 / 전역 상태 / 파생 조회
//    data.js          서버에서 데이터 읽기
//    views-common.js  화면 공통 조각
//    views-day.js     오늘 / 포인트 상점
//    views-week.js    주간 / 가족일정
//    views-manage.js  관리
//    ui.js            렌더 / 바텀시트 / 토스트 / 로그인 화면
//    sync.js          다시 읽기 · 쓰기 공통 처리
//    sheets.js        입력 폼
//    actions.js       클릭 처리
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { setSb, sb, S, D } from './core.js';
import { loadAll, resolveKid } from './data.js';
import { render, screenLogin, screenError } from './ui.js';
import { refresh } from './sync.js';
import { bindEvents } from './actions.js';

async function boot(){
  const hash = new URLSearchParams(location.hash.slice(1));

  // 아이 링크를 한 번 열면 그 기기는 계속 아이 화면으로 뜹니다.
  // 보호자 기기에서 실수로 열었을 때 #parent 로 되돌립니다.
  if(hash.has('parent')){
    localStorage.removeItem('kidToken');
    history.replaceState(null, '', location.pathname);
  }

  const fromHash = hash.get('kid');
  const token = fromHash || localStorage.getItem('kidToken');

  if(fromHash){
    localStorage.setItem('kidToken', fromHash);
    history.replaceState(null, '', location.pathname);
  }

  if(token){
    // ---- 아이 모드: 전용 링크 토큰을 헤더로 보냅니다 ----
    S.mode = 'kid';
    setSb(createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth:   { persistSession: false },
      global: { headers: { 'x-kid-token': token } },
    }));
    try{
      S.meId = await resolveKid();
      if(!S.meId) throw new Error('링크가 올바르지 않거나 만료됐어요');
      await loadAll();
    }catch(e){
      localStorage.removeItem('kidToken');
      return screenError('링크를 열 수 없어요', e.message || String(e));
    }
  } else {
    // ---- 보호자 모드 ----
    setSb(createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    const { data:{ session } } = await sb.auth.getSession();
    if(!session) return screenLogin();
    S.mode = 'parent';
    try { await loadAll(); }
    catch(e){ return screenError('데이터를 불러오지 못했어요', e.message || String(e)); }
  }

  if(!D.family){
    return screenError('연결된 가족이 없어요',
      '이 계정이 어느 가족에도 속해 있지 않습니다. Supabase 에서 03_seed.sql 을 실행했는지 확인해 주세요.');
  }

  render();
  startSync();
}

/* 12초마다, 그리고 화면으로 돌아올 때마다 다시 읽습니다 */
function startSync(){
  setInterval(() => { if(document.visibilityState === 'visible') refresh(true); }, 12000);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') refresh(true);
  });
}

bindEvents();
boot().catch(e => {
  console.error(e);
  screenError('시작할 수 없어요', e.message || String(e));
});
