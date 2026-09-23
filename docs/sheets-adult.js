// =====================================================================
//  sheets-adult.js — 어른(보호자·시터 선생님) 일정 입력 폼
//    · 그 날짜만 바꾸기 (출근/재택/휴가 …, 시터는 근무 시간 직접 입력)
//    · 요일별 기본 일정 일괄 편집
//
//  공휴일·쉬는 날에는 기본값이 «휴무» 입니다 (core.js 의 statusOf).
//  그날도 출근하는 사람은 여기서 날짜별로 덮어씁니다.
// =====================================================================
import {
  sb, D, WD, STATUS_TYPES, SITTER_TYPES,
  esc, mdLabel, wdOf, M, weekDays, statusOf, isRest,
} from './core.js';
import { $, openSheet, closeSheet, toast } from './ui.js';
import { run, setReopen } from './sync.js';

/* ---------------- 어른 일정 (그 날짜) ---------------- */
export function sheetStatus(mid, date){
  const m = M(mid);
  if(!m) return;
  const cur = statusOf(mid, date);
  const wk  = D.weekly[mid+'|'+wdOf(date)] || '';
  const title = `${mdLabel(date)} ${WD[wdOf(date)]}요일 · ${m.name}`;
  // 쉬는 날은 기본이 휴무입니다. 그래도 출근하면 여기서 바꿔 덮어씁니다.
  const restHint = isRest(date)
    ? `<div class="banner" style="margin:0 0 12px"><span class="em">${esc(D.notes[date]?.emoji || '🎌')}</span>
        <div><b>${esc(D.notes[date]?.label || '쉬는 날')}</b>
          <span>쉬는 날이라 기본값이 휴무예요. 출근하시면 아래에서 바꿔주세요</span></div></div>`
    : '';

  // 시터 선생님은 근무 시간을 직접 입력합니다 (매일 달라서)
  if(m.kind === 'helper'){
    const t = /(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/.exec(cur);
    const s0 = t ? t[1] : '12:00', e0 = t ? t[2] : '18:00';
    return openSheet(title, '근무 시간을 직접 정할 수 있어요. 이 날짜에만 적용됩니다.', `
      ${restHint}
      <div class="row2">
        <div><label>출근</label><input id="sitS" type="time" value="${s0}"></div>
        <div><label>퇴근</label><input id="sitE" type="time" value="${e0}"></div>
      </div>
      <button class="btn" style="margin-top:14px" data-act="savesitter" data-v="${mid}" data-d="${date}" data-w="day"
        >이 날짜에 적용</button>
      <button class="ghost" data-act="savesitter" data-v="${mid}" data-d="${date}" data-w="week"
        >매주 ${WD[wdOf(date)]}요일 기본값으로 저장</button>
      <h4>빠른 설정</h4>
      <div class="opt-grid">
        <div class="opt ${cur==='휴무'?'sel':''}" data-act="setstatus" data-v="${mid}" data-d="${date}" data-w="휴무">휴무</div>
        ${SITTER_TYPES.filter(x => x !== '휴무').map(x => `<div class="opt ${x===cur?'sel':''}"
          data-act="setstatus" data-v="${mid}" data-d="${date}" data-w="${esc(x)}">${esc(x.replace('근무 ',''))}</div>`).join('')}
      </div>
      <div class="note" style="text-align:left">현재 요일 기본값: ${esc(wk || '없음')}</div>`);
  }

  openSheet(title, '이 날짜에만 적용됩니다. 아래에서 요일 기본값도 바꿀 수 있어요.',
    `${restHint}
     <div class="opt-grid">${STATUS_TYPES.map(t => `<div class="opt ${t===cur?'sel':''}"
        data-act="setstatus" data-v="${mid}" data-d="${date}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>
     <h4>매주 ${WD[wdOf(date)]}요일 기본값으로 저장</h4>
     <div class="opt-grid">${STATUS_TYPES.map(t => `<div class="opt ${t===wk?'sel':''}"
        data-act="setweekly" data-v="${mid}" data-d="${date}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>`);
}

/* 시터 근무시간 직접 입력 저장 (w='day' | 'week') */
export function saveSitter(mid, date, w){
  const s = $('sitS').value, e = $('sitE').value;
  if(!s || !e) return toast('시간을 입력해 주세요', true);
  if(e <= s)   return toast('퇴근 시간이 출근보다 빨라요', true);
  const status = `근무 ${s}~${e}`;
  const m = M(mid);
  run(async () => {
    const r = w === 'week'
      ? await sb.from('weekly_status').upsert(
          { family_id:m.family_id, member_id:mid, weekday:wdOf(date), status }, { onConflict:'member_id,weekday' })
      : await sb.from('day_status').upsert(
          { family_id:m.family_id, member_id:mid, on_date:date, status }, { onConflict:'member_id,on_date' });
    closeSheet(); setReopen(null);
    return r;
  }, w === 'week' ? `매주 ${WD[wdOf(date)]}요일 ${status}` : `${mdLabel(date)} ${status}`);
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
