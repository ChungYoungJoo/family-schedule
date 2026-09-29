// =====================================================================
//  views-month.js — 월간 달력
//
//  날짜를 누르면 그날 숙제·출석 체크 창이 열립니다 (지난 날짜 포함).
//  칸에 그리는 표시는 이미 읽어둔 데이터만 씁니다 —
//  시간표·숙제(전체), 보너스 기록(최근 95일), 쉬는 날(넓은 범위).
//  그래서 달을 넘겨도 추가 조회 없이 바로 그려집니다.
// =====================================================================
import {
  S, WD, TODAY, esc, wdOf, isKid,
  me, M, kids, monthCells, monthLabel, dueCount, gotBonus, isRest, avatarOf,
} from './core.js';

/* 하루 칸에 찍히는 표시 */
function mark(cid, date){
  if(date > TODAY)        return {em:'',   cls:'future'};
  if(isRest(date))        return {em:'🎌', cls:'rest'};
  if(gotBonus(cid, date)) return {em:'🐾', cls:'done'};
  if(dueCount(cid, date)) return {em:'○',  cls:'miss'};
  return {em:'·', cls:'none'};
}

export function monthView(){
  const kid = isKid();
  // 달력은 한 명 기준입니다 (보호자가 «전체» 로 두었으면 첫째로)
  const target = kid ? me()
    : (M(S.weekWho) && M(S.weekWho).kind === 'child' ? M(S.weekWho) : kids()[0]);
  if(!target) return '<div class="note" style="padding:20px">아이가 없습니다</div>';

  const whoSeg = kid ? '' : `<div class="seg">${kids().map(c => `
    <button class="${target.id===c.id?'on':''}" data-act="weekwho" data-v="${c.id}"
      >${avatarOf(c)} ${c.name}</button>`).join('')}</div>`;

  const cells = monthCells().map(date => {
    if(!date) return '<div class="mcell empty"></div>';
    const wd = wdOf(date), m = mark(target.id, date);
    const tap = date <= TODAY;
    return `<div class="mcell ${m.cls} ${date===TODAY?'today':''} ${tap?'tap':''}"
      ${tap ? `data-act="daycheck" data-v="${target.id}" data-d="${date}"` : ''}>
      <b class="${wd===6?'sat':wd===0?'sun':''}">${Number(date.slice(8))}</b>
      <span>${m.em}</span></div>`;
  }).join('');

  const total = monthCells().filter(d => d && d <= TODAY && dueCount(target.id,d) > 0).length;
  const done  = monthCells().filter(d => d && gotBonus(target.id,d)).length;

  return `${whoSeg}
  <div class="seg">
    <button data-act="calview" data-v="week">주간</button>
    <button class="on" data-act="calview" data-v="month">월간</button>
  </div>
  <div class="seg">
    <button data-act="mooff" data-v="-1">‹ 지난달</button>
    <button class="${S.monthOffset===0?'on':''}" data-act="mooff" data-v="0">이번 달</button>
    <button data-act="mooff" data-v="1">다음달 ›</button>
  </div>

  <div class="sectitle" style="margin-top:0"><h3>${monthLabel()}</h3>
    <em>${esc(target.name)} · 다 한 날 ${done}일 / ${total}일</em></div>

  <div class="card" style="padding:12px 10px">
    <div class="mgrid head">${WD.map((w,i) =>
      `<div class="mcell empty"><b class="${i===6?'sat':i===0?'sun':''}">${w}</b></div>`).join('')}</div>
    <div class="mgrid">${cells}</div>
    <div class="note" style="text-align:left;padding:10px 2px 0">
      🐾 다 한 날 · ○ 남은 게 있던 날 · 🎌 쉬는 날<br>
      지난 날짜를 누르면 그날 숙제·출석을 체크할 수 있어요.
      ${kid ? '지난 날짜는 엄마·아빠가 확인해 준 뒤에 완료돼요.'
            : '아이가 신청한 지난 날짜는 오늘 탭에서 승인합니다.'}
    </div>
  </div>`;
}
