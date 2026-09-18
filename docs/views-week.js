// =====================================================================
//  views-week.js — 주간 시간표 / 가족일정 조율
// =====================================================================
import {
  S, WD, TODAY, esc, hm, mdLabel, wdOf, weekDays, weekStart,
  me, M, A, kids, isKid, dayItems, pickupOf, noteOn, slotsOn, openOn, setNameFor,
} from './core.js';
import { statusRow, slotRow, weekNav } from './views-common.js';

/* ---------------- 주간 ---------------- */
export function weekView(){
  const kid = isKid();
  const targets = (kid ? [me()] : (S.weekWho==='all' ? kids() : [M(S.weekWho)])).filter(Boolean);

  const whoSeg = kid ? '' : `<div class="seg">
      <button class="${S.weekWho==='all'?'on':''}" data-act="weekwho" data-v="all">전체</button>
      ${kids().map(c => `<button class="${S.weekWho===c.id?'on':''}" data-act="weekwho" data-v="${c.id}"
        >${c.emoji} ${c.name}</button>`).join('')}
    </div>`;

  const days = weekDays().map(date => {
    const wd = wdOf(date), nt = noteOn(date);
    const items = targets.flatMap(c => dayItems(c.id,date).map(it => ({it,c})));
    return `<div class="day ${wd===6?'sat':wd===0?'sun':''} ${date===TODAY?'today':''}">
      <div class="dcol"><b>${WD[wd]}</b><span>${mdLabel(date)}</span></div>
      <div class="chips">
        ${nt?`<span class="chip note">${nt.emoji} ${esc(nt.label)}</span>`:''}
        ${items.length ? items.map(({it,c}) => {
          if(it.off) return `<span class="chip off"><i class="who-dot" style="background:${c.color}"></i>${esc(it.title)}</span>`;
          const a = it.needs_pickup ? pickupOf(it,date) : null;
          const mark = it.needs_pickup ? ` ${a && A(a) ? A(a).emoji : '❗'}` : '';
          return `<span class="chip ${it.extra?'extra':''}"><i class="who-dot" style="background:${c.color}"></i>`
               + `${hm(it.starts_at)} ${esc(it.title)}${mark}</span>`;
        }).join('') : '<span class="chip empty">일정 없음</span>'}</div>
      ${kid?'':`<button class="editday" data-act="editday" data-d="${date}">✏️</button>`}</div>`;
  }).join('');

  return `${whoSeg}${weekNav()}
  <div class="sectitle" style="margin-top:0"><h3>${esc(setNameFor(weekStart()))}</h3>
    <em>👩👨🧑‍🏫🚶 = 하원 담당</em></div>
  <div class="wk">${days}</div>`;
}

/* ---------------- 가족일정 조율 ---------------- */
export function familyView(){
  const days = weekDays().map(date => {
    const nt = noteOn(date), slots = slotsOn(date);
    const open = slots.filter(x => !pickupOf(x,date)).length;
    return `<div class="coord" ${date===TODAY?'style="outline:2px solid var(--primary);outline-offset:-2px"':''}>
      <div class="head"><b>${mdLabel(date)} ${WD[wdOf(date)]}요일${date===TODAY?' · 오늘':''}</b>
        ${nt?`<span class="badge ovr">${nt.emoji} ${esc(nt.label)}</span>`:''}
        ${slots.length?`<span class="badge ${open?'need':'done'}">${open?`조율 필요 ${open}`:'담당 확정'}</span>`:''}
        <button class="editday" data-act="editday" data-d="${date}">✏️</button></div>
      <div class="prow">${statusRow(date)}</div>
      ${slots.map(it => slotRow(it,date)).join('')}</div>`;
  }).join('');

  const total = weekDays().reduce((a,d) => a + openOn(d).length, 0);

  return `${weekNav()}
  <div class="card" style="background:linear-gradient(135deg,#4c6ef5,#7950f2);color:#fff;box-shadow:0 10px 24px rgba(76,110,245,.28)">
    <h2 style="color:#fff">${esc(setNameFor(weekStart()))} · 조율 현황</h2>
    <div class="sub" style="color:rgba(255,255,255,.82);margin-bottom:0">
      담당자를 정해야 하는 일정 <b style="color:#fff">${total}건</b>${total?' 남았어요':' — 모두 정리됐어요 👏'}</div></div>
  <div class="sectitle"><h3>날짜별 담당 정하기</h3><em>담당·일정 모두 눌러서 변경</em></div>
  ${days}`;
}
