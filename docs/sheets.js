// =====================================================================
//  sheets.js — 입력 폼 바텀시트 (이 날만 변경 / 스케줄 / 숙제 / 보상)
// =====================================================================
import {
  sb, D, S, WD, CAT, DAY_NOTES, PRESETS, STATUS_TYPES,
  esc, hm, toMin, mdLabel, wdOf, M, kids, pickers, noteOn, setIdFor, weekDays,
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
export function sheetTask(t, childId, kind){
  const k = t ? (t.kind || 'homework') : (kind || 'homework');
  editing = t ? {id:t.id, kind:k} : {id:null, child:childId, kind:k};
  setReopen(null);
  const cid = t ? t.child_id : childId;
  const daily = !t || t.weekdays === null;
  const isSup = k === 'supply';

  openSheet((isSup ? '준비물 ' : '숙제 ') + (t ? '수정' : '추가'),
    `${esc(M(cid)?.name||'')} · ${esc(D.sets.find(s => s.id === S.editSet)?.name || '')}`, `
    <label>${isSup ? '무엇을 챙기나요' : '내용'}</label>
    <input id="tTitle" value="${esc(t?.title||'')}" placeholder="${isSup ? '예: 체육복' : '예: 수학 문제집 2쪽'}">
    <label>메모 (선택)</label><input id="tNote" value="${esc(t?.note||'')}"
      placeholder="${isSup ? '예: 세탁해서 넣기' : '예: 채점까지'}">
    <label>언제</label>
    <div class="seg">
      <button class="${daily?'on':''}" id="tDaily" type="button">매일</button>
      <button class="${daily?'':'on'}" id="tPick" type="button">요일 선택</button></div>
    <div class="opt-grid" id="tWds" style="${daily?'display:none':''}">
      ${[1,2,3,4,5,6,0].map(w => `<div class="opt ${t && (t.weekdays||[]).includes(w) ? 'sel':''}"
        data-wd="${w}">${WD[w]}</div>`).join('')}</div>
    <label>포인트</label><input id="tPt" type="number" value="${t?.points ?? (isSup ? 5 : 10)}">
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
    kind:      editing.kind || 'homework',
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

/* ---------------- 스케줄 세트 / 적용 기간 ---------------- */
export function sheetSet(s){
  editing = { id: s?.id ?? null };
  setReopen(null);
  const used = s ? D.routines.filter(r => r.set_id === s.id).length
                 + D.tasks.filter(t => t.set_id === s.id).length : 0;
  openSheet(s ? '시간표 세트 수정' : '시간표 세트 추가',
    '«학기 중», «방학» 처럼 통째로 다른 시간표를 담는 묶음입니다.', `
    <label>아이콘</label><input id="stEm" value="${esc(s?.emoji||'📅')}" maxlength="4">
    <label>이름</label><input id="stName" value="${esc(s?.name||'')}" placeholder="예: 겨울방학">
    <button class="btn" style="margin-top:14px" data-act="saveset">저장</button>
    ${s ? `<button class="ghost" data-act="delset" data-v="${s.id}" data-w="${esc(s.name)}"
      >삭제 (일정 ${used}건도 함께 사라짐)</button>` : ''}`);
}

export function saveSet(){
  const row = { family_id: D.family.id,
                emoji: $('stEm').value.trim() || '📅',
                name:  $('stName').value.trim() };
  if(!row.name) return toast('이름을 입력해 주세요', true);
  run(async () => {
    const r = editing.id
      ? await sb.from('schedule_sets').update(row).eq('id', editing.id)
      : await sb.from('schedule_sets').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '저장했어요');
}

export function sheetPeriod(p, setId){
  editing = { id: p?.id ?? null, set: p?.set_id || setId };
  setReopen(null);
  const setName = D.sets.find(s => s.id === editing.set)?.name || '';
  const today = new Date().toISOString().slice(0,10);
  openSheet(p ? '적용 기간 수정' : '적용 기간 추가',
    `«${esc(setName)}» 시간표가 적용될 날짜 범위입니다.`, `
    <label>이름 (선택)</label>
    <input id="pLabel" value="${esc(p?.label||'')}" placeholder="예: 2학기, 여름방학">
    <label>시작일</label><input id="pFrom" type="date" value="${p?.starts_on || today}">
    <label>종료일</label><input id="pTo" type="date" value="${p?.ends_on || today}">
    <button class="btn" style="margin-top:14px" data-act="saveperiod">저장</button>
    ${p ? `<button class="ghost" data-act="delperiod" data-v="${p.id}">삭제</button>` : ''}
    <div class="note" style="text-align:left">
      기간이 서로 겹치지 않게 넣어주세요. 겹치면 시작일이 늦은 쪽이 적용됩니다.
    </div>`);
}

export function savePeriod(){
  const row = {
    family_id: D.family.id, set_id: editing.set,
    label: $('pLabel').value.trim() || null,
    starts_on: $('pFrom').value,
    ends_on:   $('pTo').value,
  };
  if(!row.starts_on || !row.ends_on) return toast('날짜를 입력해 주세요', true);
  if(row.ends_on < row.starts_on)    return toast('종료일이 시작일보다 빨라요', true);

  const clash = D.periods.find(p => p.id !== editing.id
    && row.starts_on <= p.ends_on && row.ends_on >= p.starts_on);
  if(clash){
    const nm = D.sets.find(s => s.id === clash.set_id)?.name || '다른 기간';
    if(!confirm(`«${nm}» (${clash.starts_on} ~ ${clash.ends_on}) 와 날짜가 겹칩니다.\n그대로 저장할까요?`)) return;
  }

  run(async () => {
    const r = editing.id
      ? await sb.from('set_periods').update(row).eq('id', editing.id)
      : await sb.from('set_periods').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '저장했어요');
}

/* ---------------- 어른 요일 기본 일정 일괄 편집 ---------------- */
const WK_ORDER = [1,2,3,4,5,6,0];
const wdClass = w => w === 6 ? 'sat' : w === 0 ? 'sun' : '';

export function sheetWeekly(mid){
  const m = M(mid);
  if(!m) return;
  setReopen(null);
  const helper = m.kind === 'helper';

  const rows = WK_ORDER.map(w => {
    const cur = D.weekly[mid+'|'+w] || '';
    if(!helper){
      return `<div class="wkrow"><span class="wd ${wdClass(w)}">${WD[w]}</span>
        <select id="wk${w}">${STATUS_TYPES.map(t =>
          `<option value="${esc(t)}" ${t===cur?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
    }
    const t   = /(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/.exec(cur);
    const off = !t;
    return `<div class="wkrow"><span class="wd ${wdClass(w)}">${WD[w]}</span>
      <button class="offbtn ${off?'on':''}" data-off="${w}" type="button">휴무</button>
      <input type="time" id="wk${w}S" value="${t?t[1]:'12:00'}" ${off?'disabled':''}>
      <span class="wkdash">~</span>
      <input type="time" id="wk${w}E" value="${t?t[2]:'18:00'}" ${off?'disabled':''}></div>`;
  }).join('');

  openSheet(`${m.emoji} ${m.name} · 요일별 기본 일정`,
    helper ? '매주 반복되는 근무 시간입니다. 특정 날짜만 다를 때는 가족일정 탭에서 그날만 바꾸세요.'
           : '매주 반복되는 기본값입니다. 특정 날짜만 다를 때는 가족일정 탭에서 그날만 바꾸세요.', `
    ${helper ? `<h4>월~금 한 번에 채우기</h4>
      <div class="wkrow" style="border:0">
        <input type="time" id="allS" value="12:00"><span class="wkdash">~</span>
        <input type="time" id="allE" value="18:00">
        <button class="offbtn" id="applyAll" type="button" style="width:62px">적용</button></div>` : ''}
    <h4>요일별</h4>
    ${rows}
    <div class="mrow" style="margin-top:6px"><div class="mx"><b>이번 주 날짜별 설정 지우기</b>
      <span>하루만 다르게 해둔 값을 지우고 위 기본값을 따르게 합니다</span></div>
      <div class="sw" id="wkClear"></div></div>
    <button class="btn" style="margin-top:8px" data-act="saveweeklyall" data-v="${mid}">저장</button>`);

  // 휴무 토글
  document.querySelectorAll('#shBody [data-off]').forEach(b => b.onclick = () => {
    const w = b.dataset.off;
    b.classList.toggle('on');
    const off = b.classList.contains('on');
    $(`wk${w}S`).disabled = off;
    $(`wk${w}E`).disabled = off;
  });
  // 월~금 일괄 적용
  const all = $('applyAll');
  if(all) all.onclick = () => {
    [1,2,3,4,5].forEach(w => {
      const b = document.querySelector(`#shBody [data-off="${w}"]`);
      b.classList.remove('on');
      $(`wk${w}S`).disabled = false; $(`wk${w}E`).disabled = false;
      $(`wk${w}S`).value = $('allS').value;
      $(`wk${w}E`).value = $('allE').value;
    });
    toast('월~금에 채웠어요');
  };
  $('wkClear').onclick = () => $('wkClear').classList.toggle('on');
}

export function saveWeeklyAll(mid){
  const m = M(mid);
  const helper = m.kind === 'helper';
  const rows = [];

  for(const w of WK_ORDER){
    let status;
    if(!helper){
      status = $(`wk${w}`).value;
    } else {
      const off = document.querySelector(`#shBody [data-off="${w}"]`).classList.contains('on');
      if(off) status = '휴무';
      else {
        const s = $(`wk${w}S`).value, e = $(`wk${w}E`).value;
        if(!s || !e) return toast(`${WD[w]}요일 시간을 입력해 주세요`, true);
        if(e <= s)   return toast(`${WD[w]}요일 퇴근이 출근보다 빨라요`, true);
        status = `근무 ${s}~${e}`;
      }
    }
    rows.push({ family_id: m.family_id, member_id: mid, weekday: w, status });
  }

  const clearDays = $('wkClear').classList.contains('on');
  const days = weekDays();

  run(async () => {
    const r = await sb.from('weekly_status').upsert(rows, { onConflict:'member_id,weekday' });
    if(r.error) return r;
    if(clearDays){
      const d = await sb.from('day_status').delete()
        .eq('member_id', mid).gte('on_date', days[0]).lte('on_date', days[6]);
      if(d.error) return d;
    }
    closeSheet(); setReopen(null);
    return r;
  }, `${m.name} 요일별 일정을 저장했어요`);
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

/* ---------------- 아이: 갖고 싶은 보상 제안 ---------------- */
export function sheetSuggest(){
  setReopen(null);
  openSheet('이런 보상 갖고 싶어요',
    '엄마·아빠가 보고 몇 포인트로 할지 정해줄 거예요.', `
    <label>아이콘</label><input id="sgEm" value="🎁" maxlength="4">
    <label>무엇을 갖고 싶어?</label>
    <input id="sgTitle" placeholder="예: 친구랑 놀이터에서 1시간 놀기">
    <label>왜 갖고 싶은지 (안 써도 돼)</label>
    <input id="sgNote" placeholder="예: 이번 주에 숙제를 다 했어요">
    <button class="btn" style="margin-top:14px" data-act="savesuggest">보내기</button>`);
}

export function saveSuggest(){
  const row = {
    family_id: D.family.id,
    child_id:  S.meId,
    emoji: $('sgEm').value.trim() || '🎁',
    title: $('sgTitle').value.trim(),
    note:  $('sgNote').value.trim() || null,
  };
  if(!row.title) return toast('무엇을 갖고 싶은지 써 줘', true);

  run(async () => {
    const r = await sb.from('reward_suggestions').insert(row);
    closeSheet(); setReopen(null);
    return r;
  }, '보냈어요! 엄마·아빠가 곧 확인할 거예요 🎁');
}
