// =====================================================================
//  actions.js — 클릭 처리 (data-act 기반 이벤트 위임)
// =====================================================================
import {
  sb, D, S, WD, TODAY, DAY_NOTES, PRESETS, STATUS_TYPES, SITTER_TYPES,
  esc, mdLabel, wdOf, M, isKid, pickupOf, statusOf, setIdFor,
} from './core.js';
import { $, render, openSheet, closeSheet, toast } from './ui.js';
import { run, refresh, setReopen, reopenFn } from './sync.js';
import { sheetEditDay, sheetRoutine, saveRoutine, sheetTask, saveTask, sheetReward, saveReward } from './sheets.js';

/* 하루 전부 완료 보너스 — 서버가 실제 완료 여부를 다시 검증합니다 */
async function maybeBonus(childId, date){
  const { data } = await sb.rpc('claim_daily_bonus', { p_child: childId, p_date: date });
  if(data && data > 0) setTimeout(() => toast(`오늘 할 일 전부 완료! 보너스 +${data}P 🎉`), 400);
}

export const ACT = {
  /* ---- 화면 이동 ---- */
  tab:     ({v}) => { S.tab = v; setReopen(null); closeSheet(); render(); },
  weekwho: ({v}) => { S.weekWho = v; render(); },
  wkoff:   ({v}) => { S.weekOffset = v === '0' ? 0 : S.weekOffset + Number(v); refresh(); },
  editset: ({v}) => { S.editSet = v; render(); },
  logout:  async () => { await sb.auth.signOut(); localStorage.removeItem('kidToken'); location.reload(); },

  /* ---- 체크 ---- */
  task: ({v,d}) => run(async () => {
    const t = D.tasks.find(x => x.id === v);
    if(D.taskLogs.has(v+'|'+d)) return sb.from('task_logs').delete().eq('task_id',v).eq('on_date',d);
    const r = await sb.from('task_logs').insert(
      { family_id:t.family_id, child_id:t.child_id, task_id:v, on_date:d });
    if(r.error) return r;
    await maybeBonus(t.child_id, d);
    return r;
  }),

  att: ({v,d,k}) => run(async () => {
    const it  = (k === 'routine' ? D.routines : D.extras).find(x => x.id === v);
    const col = k === 'routine' ? 'routine_id' : 'extra_event_id';
    if(D.attLogs.has(`${k}:${v}|${d}`)) return sb.from('attendance_logs').delete().eq(col,v).eq('on_date',d);
    const r = await sb.from('attendance_logs').insert(
      { family_id:it.family_id, child_id:it.child_id, [col]:v, on_date:d });
    if(r.error) return r;
    await maybeBonus(it.child_id, d);
    return r;
  }),

  /* ---- 픽업 담당 ---- */
  pick: ({v,d,k,w}) => run(async () => {
    const it   = (k === 'routine' ? D.routines : D.extras).find(x => x.id === v);
    const cur  = pickupOf({...it, kind:k}, d);
    const next = cur === w ? null : w;
    return sb.from('pickups').upsert({
      family_id: it.family_id,
      on_date: d,
      routine_id:     k === 'routine' ? v : null,
      extra_event_id: k === 'extra'   ? v : null,
      assignee_id: next && next !== 'self' ? next : null,
      is_self: next === 'self',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'routine_id,extra_event_id,on_date' });
  }),

  pickreset: ({v,d,k}) => run(
    () => sb.from('pickups').delete().eq('on_date',d)
            .eq(k === 'routine' ? 'routine_id' : 'extra_event_id', v),
    '요일 기본값으로 되돌렸어요'),

  /* ---- 어른 일정 ---- */
  status: ({v,d}) => {
    const m = M(v);
    const list = m.kind === 'helper' ? SITTER_TYPES : STATUS_TYPES;
    const cur  = statusOf(v,d);
    const wk   = D.weekly[v+'|'+wdOf(d)] || '';
    openSheet(`${mdLabel(d)} ${WD[wdOf(d)]}요일 · ${m.name}`,
      '이 날짜에만 적용됩니다. 아래에서 요일 기본값도 바꿀 수 있어요.',
      `<div class="opt-grid">${list.map(t => `<div class="opt ${t===cur?'sel':''}"
          data-act="setstatus" data-v="${v}" data-d="${d}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>
       <h4>매주 ${WD[wdOf(d)]}요일 기본값으로 저장</h4>
       <div class="opt-grid">${list.map(t => `<div class="opt ${t===wk?'sel':''}"
          data-act="setweekly" data-v="${v}" data-d="${d}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>`);
  },
  setstatus: ({v,d,w}) => run(async () => {
    const m = M(v);
    const r = await sb.from('day_status').upsert(
      { family_id:m.family_id, member_id:v, on_date:d, status:w }, { onConflict:'member_id,on_date' });
    closeSheet(); setReopen(null);
    return r;
  }, '변경했어요'),
  setweekly: ({v,d,w}) => run(async () => {
    const m = M(v);
    const r = await sb.from('weekly_status').upsert(
      { family_id:m.family_id, member_id:v, weekday:wdOf(d), status:w }, { onConflict:'member_id,weekday' });
    closeSheet(); setReopen(null);
    return r;
  }, '요일 기본값을 바꿨어요'),

  /* ---- 이 날만 변경 ---- */
  editday: ({d}) => { setReopen(() => sheetEditDay(d)); sheetEditDay(d); },

  setnote: ({d,v}) => run(async () => {
    const n = DAY_NOTES.find(x => x.key === v);
    const r = await sb.from('date_notes').upsert(
      { family_id:D.family.id, on_date:d, note_key:v, emoji:n.em, label:n.label },
      { onConflict:'family_id,on_date' });
    if(r.error) return r;
    if(n.cancels !== 'none'){
      const sid = setIdFor(d), wd = wdOf(d);
      const rows = D.routines
        .filter(x => x.set_id===sid && x.weekday===wd && (n.cancels==='all' || x.category==='school'))
        .map(x => ({ family_id:x.family_id, routine_id:x.id, on_date:d, reason:n.label }));
      if(rows.length) await sb.from('routine_cancels').upsert(rows, { onConflict:'routine_id,on_date' });
    }
    return r;
  }, '하루 표시를 저장했어요'),

  delnote: ({d}) => run(() => sb.from('date_notes').delete().eq('on_date',d), '하루 표시를 지웠어요'),

  cancel: ({v,d}) => run(() => {
    const r = D.routines.find(x => x.id === v);
    if(D.cancels.has(v+'|'+d)) return sb.from('routine_cancels').delete().eq('routine_id',v).eq('on_date',d);
    return sb.from('routine_cancels').insert({ family_id:r.family_id, routine_id:v, on_date:d });
  }),
  uncancel: ({v,d}) => run(
    () => sb.from('routine_cancels').delete().eq('routine_id',v).eq('on_date',d), '취소를 되돌렸어요'),

  ovrchild: ({v}) => { S.ovrChild = v; if(reopenFn) reopenFn(); },

  addpreset: ({v,d}) => run(() => {
    const p = PRESETS[Number(v)];
    return sb.from('extra_events').insert({
      family_id:D.family.id, child_id:S.ovrChild, on_date:d,
      starts_at:p.s, ends_at:p.e, title:p.title, emoji:p.em,
      category:p.cat, needs_pickup:p.pickup });
  }, '이 날만 추가했어요'),

  delextra: ({v}) => run(() => sb.from('extra_events').delete().eq('id',v), '삭제했어요'),

  /* ---- 보상 ---- */
  redeem: ({v}) => run(() => {
    const w = D.rewards.find(x => x.id === v);
    return sb.from('redemptions').insert(
      { family_id:w.family_id, child_id:S.meId, reward_id:v, cost:w.cost });
  }, '교환을 신청했어요! 승인을 기다려요 🎁'),
  redeemok: ({v}) => run(() => sb.from('redemptions').update({status:'approved'}).eq('id',v), '승인했어요'),
  redeemno: ({v}) => run(() => sb.from('redemptions').update({status:'rejected'}).eq('id',v), '거절했어요'),

  /* ---- 알림 ---- */
  notis: () => openSheet('알림', '',
    (D.notis.length ? D.notis.map(n => `
      <div class="noti ${n.read_at?'':'unread'}"><div class="ic">${n.icon}</div>
        <div class="nx"><b>${esc(n.title)}</b>${n.body?`<span>${esc(n.body)}</span>`:''}
          <em>${n.created_at.slice(5,16).replace('T',' ')}</em></div></div>`).join('')
      : '<div class="note" style="padding:10px">알림이 없습니다</div>')
    + (isKid() ? '' : `<button class="ghost" data-act="readall">모두 읽음으로 표시</button>`)),

  readall: () => run(async () => {
    const ids = D.notis.filter(n => !n.read_at).map(n => n.id);
    closeSheet(); setReopen(null);
    if(!ids.length) return;
    return sb.from('notifications').update({ read_at:new Date().toISOString() }).in('id', ids);
  }),

  /* ---- 보호자 시점 전환 ---- */
  who: () => openSheet('보기 전환', '다른 보호자 시점으로 화면을 볼 수 있어요.',
    `<div class="who-list">${D.members.filter(m => m.kind === 'parent').map(m => `
      <div class="who-item ${m.id===S.meId?'sel':''}" data-act="setme" data-v="${m.id}">
        <span class="av" style="background:${m.color}22">${m.emoji}</span>
        <div><b>${esc(m.name)}</b><span>${esc(m.descr||'')}</span></div></div>`).join('')}</div>`),
  setme: ({v}) => { S.meId = v; setReopen(null); closeSheet(); render(); },

  /* ---- 관리: 편집 폼 ---- */
  newroutine:  ({v}) => sheetRoutine(null, v),
  editroutine: ({v}) => sheetRoutine(D.routines.find(x => x.id === v)),
  saveroutine: () => saveRoutine(),
  delroutine:  ({v}) => run(async () => {
    const r = await sb.from('routines').delete().eq('id',v);
    closeSheet(); setReopen(null); return r; }, '삭제했어요'),

  newtask:  ({v}) => sheetTask(null, v),
  edittask: ({v}) => sheetTask(D.tasks.find(x => x.id === v)),
  savetask: () => saveTask(),
  deltask:  ({v}) => run(async () => {
    const r = await sb.from('tasks').delete().eq('id',v);
    closeSheet(); setReopen(null); return r; }, '삭제했어요'),

  newreward:  () => sheetReward(null),
  editreward: ({v}) => sheetReward(D.rewards.find(x => x.id === v)),
  savereward: () => saveReward(),
  delreward:  ({v}) => run(async () => {
    const r = await sb.from('rewards').update({archived:true}).eq('id',v);
    closeSheet(); setReopen(null); return r; }, '삭제했어요'),

  editpoints: () => {
    const f = D.family;
    openSheet('포인트 규칙', '아이 화면에 표시되는 기본 포인트입니다.',
      `<label>학원·운동 출석 체크</label><input id="fAtt" type="number" value="${f.attend_points}">
       <label>하루 전부 완료 보너스</label><input id="fBon" type="number" value="${f.bonus_points}">
       <button class="btn" style="margin-top:14px" data-act="savepoints">저장</button>`);
  },
  savepoints: () => run(async () => {
    const r = await sb.from('families').update({
      attend_points: Number($('fAtt').value) || 0,
      bonus_points:  Number($('fBon').value) || 0,
    }).eq('id', D.family.id);
    closeSheet(); setReopen(null); return r;
  }, '저장했어요'),

  /* ---- 아이 전용 링크 ---- */
  kidlink: ({v}) => {
    const m = M(v);
    const url = location.origin + location.pathname + '#kid=' + (m.access_token || '');
    openSheet(`${m.emoji} ${m.name} 전용 링크`,
      '아이 기기에서 이 링크를 열고 홈 화면에 추가하세요. 로그인 없이 자기 화면만 보입니다.',
      `<div class="mrow"><div class="mx"><span style="font-size:12px">${esc(url)}</span></div></div>
       <button class="btn" style="margin-top:10px" data-act="copylink" data-w="${esc(url)}">링크 복사</button>
       <button class="ghost" data-act="resetlink" data-v="${v}">↺ 링크 새로 만들기 (기존 링크 무효)</button>`);
  },
  copylink: ({w}) => { navigator.clipboard.writeText(w); toast('링크를 복사했어요'); },
  resetlink: ({v}) => run(async () => {
    const r = await sb.rpc('reset_kid_token', { p_child:v });
    closeSheet(); setReopen(null); return r;
  }, '새 링크를 만들었어요'),
};

/* ---------------- 이벤트 위임 ---------------- */
export function bindEvents(){
  document.addEventListener('click', ev => {
    if(ev.target.closest('[data-close]')){ setReopen(null); return closeSheet(); }
    const el = ev.target.closest('[data-act]');
    if(!el) return;
    const handler = ACT[el.dataset.act];
    if(!handler) return;
    ev.preventDefault();
    handler({ v: el.dataset.v, d: el.dataset.d, k: el.dataset.k, w: el.dataset.w, el });
  });
}
