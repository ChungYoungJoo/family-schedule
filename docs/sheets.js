// =====================================================================
//  sheets.js — 입력 폼 바텀시트 (이 날만 변경 / 스케줄 / 숙제 / 보상)
// =====================================================================
import {
  sb, D, S, WD, CAT, DAY_NOTES, PRESETS,
  esc, hm, toMin, mdLabel, wdOf, M, kids, pickers, noteOn, setIdFor,
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

  openSheet(`${mdLabel(date)} (${WD[wd]})`,
    '이 날짜에만 적용됩니다. 요일 반복 시간표는 그대로 유지돼요.', `
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

/* ---------------- 반복 스케줄 ---------------- */
let editing = null;

export function sheetRoutine(r, childId){
  editing = r ? {id:r.id} : {id:null, child:childId};
  setReopen(null);
  const cid = r ? r.child_id : childId;
  const cur = r ? (r.default_is_self ? 'self' : (r.default_pickup_id || '')) : '';

  openSheet(r ? '스케줄 수정' : '스케줄 추가',
    `${esc(M(cid)?.name||'')} · ${esc(D.sets.find(s => s.id === S.editSet)?.name || '')}`, `
    <label>요일</label>
    <select id="rWd">${[1,2,3,4,5,6,0].map(w =>
      `<option value="${w}" ${r&&r.weekday===w?'selected':''}>${WD[w]}요일</option>`).join('')}</select>
    <label>이름</label><input id="rTitle" value="${esc(r?.title||'')}" placeholder="예: 수학학원">
    <div class="row2">
      <div><label>시작</label><input id="rS" type="time" value="${hm(r?.starts_at)||'15:00'}"></div>
      <div><label>종료</label><input id="rE" type="time" value="${hm(r?.ends_at)||'16:00'}"></div>
    </div>
    <label>분류</label>
    <select id="rCat">${Object.entries(CAT).map(([k,v]) =>
      `<option value="${k}" ${r&&r.category===k?'selected':''}>${v.emoji} ${v.label}</option>`).join('')}</select>
    <label>하원 시 데리러 갈 사람이 필요한가요?</label>
    <select id="rPick">
      <option value="">필요 없음</option>
      ${pickers().map(a => `<option value="${a.id}" ${cur===a.id?'selected':''}>${a.emoji} ${a.name}</option>`).join('')}
      <option value="__none" ${r && r.needs_pickup && !cur ? 'selected':''}>필요함 · 담당 미정</option>
    </select>
    <button class="btn" style="margin-top:14px" data-act="saveroutine">저장</button>
    ${r ? `<button class="ghost" data-act="delroutine" data-v="${r.id}">삭제</button>` : ''}`);
}

export function saveRoutine(){
  const p = $('rPick').value;
  const row = {
    family_id: D.family.id,
    set_id:    S.editSet,
    child_id:  editing.id ? D.routines.find(x => x.id === editing.id).child_id : editing.child,
    weekday:   Number($('rWd').value),
    title:     $('rTitle').value.trim(),
    starts_at: $('rS').value,
    ends_at:   $('rE').value,
    category:  $('rCat').value,
    needs_pickup: p !== '',
    default_pickup_id: (p && p !== 'self' && p !== '__none') ? p : null,
    default_is_self:   p === 'self',
  };
  if(!row.title) return toast('이름을 입력해 주세요', true);
  if(row.ends_at <= row.starts_at) return toast('종료 시간이 시작보다 빨라요', true);

  run(async () => {
    const r = editing.id
      ? await sb.from('routines').update(row).eq('id', editing.id)
      : await sb.from('routines').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '저장했어요');
}

/* ---------------- 숙제 ---------------- */
export function sheetTask(t, childId){
  editing = t ? {id:t.id} : {id:null, child:childId};
  setReopen(null);
  const cid = t ? t.child_id : childId;
  const daily = !t || t.weekdays === null;

  openSheet(t ? '숙제 수정' : '숙제 추가',
    `${esc(M(cid)?.name||'')} · ${esc(D.sets.find(s => s.id === S.editSet)?.name || '')}`, `
    <label>내용</label><input id="tTitle" value="${esc(t?.title||'')}" placeholder="예: 수학 문제집 2쪽">
    <label>메모 (선택)</label><input id="tNote" value="${esc(t?.note||'')}" placeholder="예: 채점까지">
    <label>언제</label>
    <div class="seg">
      <button class="${daily?'on':''}" id="tDaily" type="button">매일</button>
      <button class="${daily?'':'on'}" id="tPick" type="button">요일 선택</button></div>
    <div class="opt-grid" id="tWds" style="${daily?'display:none':''}">
      ${[1,2,3,4,5,6,0].map(w => `<div class="opt ${t && (t.weekdays||[]).includes(w) ? 'sel':''}"
        data-wd="${w}">${WD[w]}</div>`).join('')}</div>
    <label>포인트</label><input id="tPt" type="number" value="${t?.points ?? 10}">
    <button class="btn" style="margin-top:14px" data-act="savetask">저장</button>
    ${t ? `<button class="ghost" data-act="deltask" data-v="${t.id}">삭제</button>` : ''}`);

  $('tDaily').onclick = () => {
    $('tDaily').classList.add('on'); $('tPick').classList.remove('on');
    $('tWds').style.display = 'none';
  };
  $('tPick').onclick = () => {
    $('tPick').classList.add('on'); $('tDaily').classList.remove('on');
    $('tWds').style.display = '';
  };
  $('tWds').querySelectorAll('[data-wd]').forEach(e =>
    e.onclick = () => e.classList.toggle('sel'));
}

export function saveTask(){
  const daily = $('tDaily').classList.contains('on');
  const wds = [...$('tWds').querySelectorAll('.opt.sel')].map(e => Number(e.dataset.wd)).sort();
  const row = {
    family_id: D.family.id,
    set_id:    S.editSet,
    child_id:  editing.id ? D.tasks.find(x => x.id === editing.id).child_id : editing.child,
    title:     $('tTitle').value.trim(),
    note:      $('tNote').value.trim() || null,
    weekdays:  daily ? null : wds,
    points:    Number($('tPt').value) || 0,
  };
  if(!row.title) return toast('내용을 입력해 주세요', true);
  if(!daily && !wds.length) return toast('요일을 하나 이상 골라 주세요', true);

  run(async () => {
    const r = editing.id
      ? await sb.from('tasks').update(row).eq('id', editing.id)
      : await sb.from('tasks').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '저장했어요');
}

/* ---------------- 보상 ---------------- */
export function sheetReward(w){
  editing = { id: w?.id ?? null };
  setReopen(null);
  openSheet(w ? '보상 수정' : '보상 추가', '아이 상점에 보이는 항목입니다.', `
    <label>아이콘</label><input id="wEm" value="${esc(w?.emoji||'🎁')}" maxlength="4">
    <label>이름</label><input id="wTitle" value="${esc(w?.title||'')}" placeholder="예: 좋아하는 과자">
    <label>필요 포인트</label><input id="wCost" type="number" value="${w?.cost ?? 50}">
    <button class="btn" style="margin-top:14px" data-act="savereward">저장</button>
    ${w ? `<button class="ghost" data-act="delreward" data-v="${w.id}">삭제</button>` : ''}`);
}

export function saveReward(){
  const row = {
    family_id: D.family.id,
    emoji: $('wEm').value.trim() || '🎁',
    title: $('wTitle').value.trim(),
    cost:  Number($('wCost').value) || 0,
  };
  if(!row.title) return toast('이름을 입력해 주세요', true);
  if(row.cost <= 0) return toast('포인트는 1 이상이어야 해요', true);

  run(async () => {
    const r = editing.id
      ? await sb.from('rewards').update(row).eq('id', editing.id)
      : await sb.from('rewards').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '저장했어요');
}
