// =====================================================================
//  sheets-day.js — 날짜별 예외 입력 폼
//    · 이 날만 변경 (하루 표시 / 일정·숙제 쉬기 / 그날만 일정 추가)
//    · 공휴일·쉬는 날 지정 (여러 날 한 번에)
//
//  추석·설날처럼 학교도 학원도 숙제도 모두 쉬는 날은 date_notes 에
//  note_key='holiday' 로 기록하고, 그 날짜의 반복 일정(routine_cancels)과
//  숙제·준비물(task_cancels)을 한 번에 쉬게 합니다.
//  주말은 건드리지 않습니다 — 평소처럼 숙제가 그대로 나옵니다.
// =====================================================================
import {
  sb, D, S, WD, DAY_NOTES, PRESETS, TODAY,
  esc, josa, hm, toMin, mdLabel, wdOf, ymd, parseYmd, addDays,
  M, kids, noteOn, setIdFor, dayTasks, isRest,
} from './core.js';
import { $, openSheet, closeSheet, toast } from './ui.js';
import { run, setReopen } from './sync.js';

/* ---------------- 이 날만 변경 ---------------- */
export function sheetEditDay(date){
  const nt = noteOn(date), sid = setIdFor(date), wd = wdOf(date);
  const rows = kids().flatMap(c => D.routines
    .filter(r => r.set_id===sid && r.child_id===c.id && r.weekday===wd)
    .sort((a,b) => toMin(a.starts_at) - toMin(b.starts_at))
    .map(r => ({r,c})));
  const adds = D.extras.filter(e => e.on_date === date);
  const tRows = kids().flatMap(c => dayTasks(c.id, date).map(t => ({t,c})));

  openSheet(`${mdLabel(date)} (${WD[wd]})`,
    '이 날짜에만 적용됩니다. 요일 반복 시간표는 그대로 유지돼요.', `
    ${isRest(date) ? `<div class="banner" style="margin:0 0 4px"><span class="em">🎌</span>
      <div><b>${esc(nt?.label || '쉬는 날')}</b>
        <span>일정·숙제가 모두 쉽니다. 아래에서 하나씩 되살릴 수 있어요</span></div></div>` : ''}
    <h4>하루 표시</h4>
    <div class="opt-grid">
      ${DAY_NOTES.map(n => `<div class="opt ${nt && nt.note_key===n.key ? 'sel':''}"
        data-act="setnote" data-v="${n.key}" data-d="${date}">${n.em} ${n.label}</div>`).join('')}
      ${nt ? `<div class="opt warn" data-act="delnote" data-d="${date}">↺ 표시 지우기</div>` : ''}
    </div>

    <h4>일정 취소 / 되살리기</h4>
    ${rows.length ? rows.map(({r,c}) => {
      const off = D.cancels.has(r.id+'|'+date);
      return `<div class="mrow"><div class="ic" style="background:${c.color}22">${c.emoji}</div>
        <div class="mx"><b style="${off?'text-decoration:line-through;color:var(--ink-3)':''}">${esc(r.title)}</b>
          <span>${esc(c.name)} · ${hm(r.starts_at)}~${hm(r.ends_at)}</span></div>
        <button class="abtn ${off?'on':''}" style="${off?'background:var(--danger)':''};width:70px"
          data-act="cancel" data-v="${r.id}" data-d="${date}">${off?'되살리기':'취소'}</button></div>`;
    }).join('') : '<div class="note" style="padding:6px">이 날 반복 일정이 없습니다</div>'}

    <h4>숙제·준비물 쉬기 / 되살리기</h4>
    ${tRows.length ? tRows.map(({t,c}) => `
      <div class="mrow"><div class="ic" style="background:${c.color}22">${t.kind==='supply'?'🎒':'📝'}</div>
        <div class="mx"><b style="${t.off?'text-decoration:line-through;color:var(--ink-3)':''}">${esc(t.title)}</b>
          <span>${esc(c.name)} · ${t.kind==='supply'?'준비물':'숙제'} · +${t.points}P</span></div>
        <button class="abtn ${t.off?'on':''}" style="${t.off?'background:var(--danger)':''};width:70px"
          data-act="canceltask" data-v="${t.id}" data-d="${date}">${t.off?'되살리기':'쉬기'}</button></div>`).join('')
      : '<div class="note" style="padding:6px">이 날 숙제·준비물이 없습니다</div>'}

    <h4>이 날만 일정 추가</h4>
    <div class="seg">${kids().map(c => `<button class="${S.ovrChild===c.id?'on':''}"
      data-act="ovrchild" data-v="${c.id}">${c.emoji} ${c.name}</button>`).join('')}</div>
    <div class="opt-grid">${PRESETS.map((p,i) =>
      `<div class="opt" data-act="addpreset" data-v="${i}" data-d="${date}">${p.em} ${p.title}
        <br><span style="font-size:11px;color:var(--ink-3);font-weight:600">${p.s}~${p.e}</span></div>`).join('')}</div>

    ${adds.length ? `<h4>이 날 추가된 일정</h4>${adds.map(a => `
      <div class="mrow"><div class="ic">${a.emoji}</div>
        <div class="mx"><b>${esc(a.title)}</b>
          <span>${esc(M(a.child_id)?.name||'')} · ${hm(a.starts_at)}~${hm(a.ends_at)}</span></div>
        <button class="undo" data-act="delextra" data-v="${a.id}">↺ 삭제</button></div>`).join('')}` : ''}`);
}

/* ---------------- 공휴일·쉬는 날 ---------------- */
const MAX_DAYS = 60;

export function sheetRest(){
  setReopen(null);
  openSheet('쉬는 날 추가',
    '추석 연휴처럼 여러 날이면 시작일~종료일을 한 번에 지정하세요.', `
    <label>이름</label>
    <input id="rsName" placeholder="예: 추석 연휴, 개천절, 대체공휴일">
    <div class="row2">
      <div><label>시작일</label><input id="rsFrom" type="date" value="${TODAY}"></div>
      <div><label>종료일</label><input id="rsTo"   type="date" value="${TODAY}"></div>
    </div>
    <button class="btn" style="margin-top:14px" data-act="saverest">쉬는 날로 지정</button>
    <div class="note" style="text-align:left">
      지정한 날은 학교·학원 일정과 숙제·준비물이 모두 쉬고, 연속 달성 🔥 도 끊기지 않습니다.<br>
      그날도 가는 학원이 있으면 «이 날만 변경» 에서 하나씩 되살릴 수 있어요.
    </div>`);
}

export function saveRest(){
  const name = $('rsName').value.trim() || '쉬는 날';
  const from = $('rsFrom').value, to = $('rsTo').value;
  if(!from || !to) return toast('날짜를 입력해 주세요', true);
  if(to < from)    return toast('종료일이 시작일보다 빨라요', true);

  const days = [];
  for(let d = parseYmd(from); ymd(d) <= to && days.length <= MAX_DAYS; d = addDays(d,1)) days.push(ymd(d));
  if(days.length > MAX_DAYS) return toast(`한 번에 ${MAX_DAYS}일까지만 지정할 수 있어요`, true);

  run(async () => {
    const notes = days.map(d => ({
      family_id: D.family.id, on_date: d, note_key: 'holiday', emoji: '🎌', label: name }));
    const r = await sb.from('date_notes').upsert(notes, { onConflict:'family_id,on_date' });
    if(r.error) return r;

    // 그날의 반복 일정과 숙제·준비물을 모두 쉬게 합니다
    const rc = [], tc = [];
    for(const d of days){
      const sid = setIdFor(d), wd = wdOf(d);
      D.routines.filter(x => x.set_id===sid && x.weekday===wd)
        .forEach(x => rc.push({ family_id:x.family_id, routine_id:x.id, on_date:d, reason:name }));
      D.tasks.filter(x => x.set_id===sid && !x.archived
          && (x.weekdays === null || (x.weekdays||[]).includes(wd)))
        .forEach(x => tc.push({ family_id:x.family_id, task_id:x.id, on_date:d, reason:name }));
    }
    if(rc.length){
      const a = await sb.from('routine_cancels').upsert(rc, { onConflict:'routine_id,on_date' });
      if(a.error) return a;
    }
    if(tc.length){
      const b = await sb.from('task_cancels').upsert(tc, { onConflict:'task_id,on_date' });
      if(b.error) return b;
    }

    closeSheet(); setReopen(null);
    return r;
  }, `${mdLabel(from)}${from===to?'':` ~ ${mdLabel(to)}`} ${josa(name,'을','를')} 쉬는 날로 정했어요`);
}

/** 지정 취소 — 그 기간의 쉬는 날 표시와 함께 걸어둔 취소도 모두 풉니다 */
export function removeRest(from, to, label){
  if(!confirm(`'${label}' 쉬는 날 지정을 취소할까요?\n`
            + '그 기간에 쉬기로 했던 일정과 숙제가 다시 나타납니다.')) return;
  run(async () => {
    const inRange = q => q.gte('on_date', from).lte('on_date', to);
    const a = await inRange(sb.from('routine_cancels').delete()); if(a.error) return a;
    const b = await inRange(sb.from('task_cancels').delete());    if(b.error) return b;
    const r = await inRange(sb.from('date_notes').delete());
    closeSheet(); setReopen(null);
    return r;
  }, '쉬는 날 지정을 취소했어요');
}
