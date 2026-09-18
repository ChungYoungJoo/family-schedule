// =====================================================================
//  sync.js — 다시 읽기 / 쓰기 작업 공통 래퍼
// =====================================================================
import { S } from './core.js';
import { loadAll } from './data.js';
import { render, paintHeader, toast, sheetOpen } from './ui.js';

/* 시트를 열어둔 채 작업했을 때 다시 그려줄 함수 */
export let reopenFn = null;
export function setReopen(fn){ reopenFn = fn; }

let busy = false;

/** 서버에서 다시 읽어 화면 갱신 (silent = 로딩 표시 없이) */
export async function refresh(silent){
  if(busy) return;
  busy = true;
  if(!silent){ S.syncing = true; paintHeader(); }
  try{
    await loadAll();
    render();
  }catch(e){
    console.error(e);
    if(!silent) toast('불러오지 못했어요: ' + (e.message || e), true);
  }finally{
    busy = false;
    S.syncing = false;
  }
}

/**
 * 쓰기 작업 공통 처리
 *  - fn() 실행 → 오류면 토스트
 *  - 성공하면 다시 읽고 렌더, 열려 있던 시트도 갱신
 */
export async function run(fn, okMsg){
  try{
    const r = await fn();
    if(r && r.error) throw r.error;
    await loadAll();
    render();
    if(sheetOpen() && reopenFn) reopenFn();
    if(okMsg) toast(okMsg);
  }catch(e){
    console.error(e);
    toast(e.message || String(e), true);
  }
}
