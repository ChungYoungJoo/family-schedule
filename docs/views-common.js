// =====================================================================
//  views-common.js — 여러 화면이 함께 쓰는 조각들
// =====================================================================
import {
  D, S, CAT, HELPFUL, BUSY, esc, josa, hm, A, M, pickers,
  pickupOf, pickupRow, defaultPickup, statusOf,
} from './core.js';

export const emOf = it => it.emoji || CAT[it.category].emoji;

/* 누가 데리러 오는지 한 줄 */
export function pickTag(it, date){
  if(!it.needs_pickup) return '';
  const a = pickupOf(it, date);
  if(!a) return `<span class="tag none">데리러 올 사람 정하는 중</span>`;
  if(a === 'self') return `<span class="tag self">🚶 끝나고 혼자 집으로 와요</span>`;
  const p = A(a);
  if(!p) return '';
  const nm = p.full_name || p.full || p.name;
  // josa() 가 이름까지 붙여서 돌려주므로 이름을 따로 또 넣으면 두 번 나옵니다
  return `<span class="tag ok">${p.emoji} ${esc(josa(nm,'이','가'))} 데리러 와요</span>`;
}

/* 일정 한 칸 (칩) */
export function itemChip(it, date){
  if(it.off) return `<span class="chip off">${emOf(it)} ${esc(it.title)}</span>`;
  const a = it.needs_pickup ? pickupOf(it, date) : null;
  const who = a && A(a) ? A(a).emoji + A(a).name : '❗미정';
  return `<span class="chip ${it.extra?'extra':''}">${emOf(it)} ${hm(it.starts_at)} ${esc(it.title)}`
       + `${it.needs_pickup ? ` · ${who}` : ''}</span>`;
}

/* 어른들 일정 줄 */
export function statusRow(date){
  return D.members.filter(m => m.kind !== 'child').map(m => {
    const v = statusOf(m.id, date);
    const k = m.kind === 'helper'
      ? (v.startsWith('근무') ? 'help' : '')
      : (HELPFUL[v] ? 'help' : BUSY[v] ? 'busy' : '');
    return `<span class="pstate ${k}" data-act="status" data-v="${m.id}" data-d="${date}">`
         + `<i style="background:${m.color}"></i>${esc(m.name)} · ${esc(v)}</span>`;
  }).join('');
}

/* 픽업 담당 배정 줄 */
export function slotRow(it, date){
  const c   = M(it.child_id);
  const cur = pickupOf(it, date);
  const base = defaultPickup(it);
  const ov  = !!pickupRow(it, date);
  return `<div class="slot">
    <div class="info"><b>${c ? c.emoji : ''} ${esc(c ? c.name : '')} · ${emOf(it)} ${esc(it.title)}</b>
      <span>${hm(it.ends_at)} 종료</span>
      ${it.extra ? '<span class="badge ovr">이 날만 있는 일정</span>' : ''}</div>
    <div class="assign">${pickers().map(a => `
      <button class="abtn ${cur===a.id?'on':''}" style="${cur===a.id?`background:${a.color}`:''}"
        data-act="pick" data-k="${it.kind}" data-v="${it.id}" data-d="${date}" data-w="${a.id}"
        >${a.emoji}<br>${esc(a.name)}</button>`).join('')}</div>
    ${ov && !it.extra ? `<div class="ovrline"><span class="badge ovr">이 날만 변경됨</span>
      <span>요일 기본값: ${base && A(base) ? A(base).emoji + A(base).name : '미정'}</span>
      <button class="undo" data-act="pickreset" data-k="${it.kind}" data-v="${it.id}" data-d="${date}"
        >↺ 되돌리기</button></div>` : ''}
  </div>`;
}

/* 보상 승인 요청 줄 */
export function redeemRow(r){
  const c = M(r.child_id);
  const w = D.rewards.find(x => x.id === r.reward_id);
  return `<div class="slot"><div class="info">
      <b>${c?c.emoji:''} ${esc(c?c.name:'')} · ${w?w.emoji:'🎁'} ${esc(w?w.title:'보상')}</b>
      <span>${r.cost}P · ${r.requested_at.slice(5,10)}</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <button class="abtn on" style="background:var(--ok)" data-act="redeemok" data-v="${r.id}">승인</button>
      <button class="abtn" data-act="redeemno" data-v="${r.id}">거절</button></div></div>`;
}

/* 아이가 제안한 보상 — 보호자가 포인트를 넣어 확정하는 줄 */
export function suggestRow(s){
  const c = M(s.child_id);
  return `<div class="slot"><div class="info">
      <b>${c?c.emoji:''} ${esc(c?c.name:'')} · ${esc(s.emoji||'🎁')} ${esc(s.title)}</b>
      <span>${s.created_at.slice(5,10)}${s.note?` · “${esc(s.note)}”`:''}</span></div>
    <div class="sgrow">
      <label class="sgin"><input id="sg${s.id}" type="number" min="1" step="10"
        value="100" inputmode="numeric"><b>P</b></label>
      <button class="abtn on" style="background:var(--ok)" data-act="sugok" data-v="${s.id}">확정</button>
      <button class="abtn" data-act="sugno" data-v="${s.id}">거절</button></div></div>`;
}

/* 주 이동 버튼 */
export function weekNav(){
  return `<div class="seg">
    <button data-act="wkoff" data-v="-1">‹ 지난주</button>
    <button class="${S.weekOffset===0?'on':''}" data-act="wkoff" data-v="0">이번 주</button>
    <button data-act="wkoff" data-v="1">다음주 ›</button>
  </div>`;
}
