// =====================================================================
//  sheets-notice.js — 알림함 (종 아이콘)
//
//  · 보호자: 목록 아래 «모두 읽음으로 표시» 버튼
//  · 아이  : 버튼 없이, 종을 여는 순간 읽은 것으로 칩니다 (빨간 숫자가 사라짐)
//    — 08_notices.sql 을 실행하기 전에는 서버가 이 갱신을 조용히 무시합니다
// =====================================================================
import { sb, D, esc, isKid, localMd, localHm } from './core.js';
import { openSheet, closeSheet } from './ui.js';
import { run, refresh, setReopen } from './sync.js';

export function sheetNotis(){
  openSheet('알림', '',
    (D.notis.length ? D.notis.map(n => `
      <div class="noti ${n.read_at?'':'unread'}"><div class="ic">${esc(n.icon)}</div>
        <div class="nx"><b>${esc(n.title)}</b>${n.body?`<span>${esc(n.body)}</span>`:''}
          <em>${localMd(n.created_at)} ${localHm(n.created_at)}</em></div></div>`).join('')
      : '<div class="note" style="padding:10px">알림이 없습니다</div>')
    + (isKid() ? '' : `<button class="ghost" data-act="readall">모두 읽음으로 표시</button>`));

  if(isKid()) markKidRead();
}

/* 아이: 열어 본 알림을 읽음 처리. 시트는 그대로 두고 빨간 숫자만 지웁니다 */
async function markKidRead(){
  const ids = D.notis.filter(n => !n.read_at).map(n => n.id);
  if(!ids.length) return;
  const r = await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  if(!r.error) refresh(true);
}

/* 보호자: 모두 읽음 */
export function readAllNotis(){
  return run(async () => {
    const ids = D.notis.filter(n => !n.read_at).map(n => n.id);
    closeSheet(); setReopen(null);
    if(!ids.length) return;
    return sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  });
}
