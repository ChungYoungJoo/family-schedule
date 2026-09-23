// =====================================================================
//  actions.js — 클릭 처리 (data-act 기반 이벤트 위임)
// =====================================================================
import {
  sb, D, S, WD, TODAY, DAY_NOTES, PRESETS, STATUS_TYPES, SITTER_TYPES,
  esc, mdLabel, wdOf, M, isKid, pickupOf, statusOf, setIdFor,
} from './core.js';
import { $, render, openSheet, closeSheet, toast } from './ui.js';
import { run, refresh, setReopen, reopenFn } from './sync.js';
import { sheetRoutine, saveRoutine, sheetTask, saveTask,
         sheetReward, saveReward, sheetWeekly, saveWeeklyAll,
         sheetSet, saveSet, sheetPeriod, savePeriod,
         sheetSuggest, saveSuggest } from './sheets.js';
import { sheetMember, saveMember } from './sheets-member.js';
import { sheetEditDay, sheetRest, saveRest, removeRest } from './sheets-day.js';

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
    const cur = statusOf(v,d);
    const wk  = D.weekly[v+'|'+wdOf(d)] || '';
    const title = `${mdLabel(d)} ${WD[wdOf(d)]}요일 · ${m.name}`;

    // 시터 선생님은 근무 시간을 직접 입력합니다 (매일 달라서)
    if(m.kind === 'helper'){
      const t = /(\d{2}:\d{2})\s*~\s*(\d{2}:\d{2})/.exec(cur);
      const s0 = t ? t[1] : '12:00', e0 = t ? t[2] : '18:00';
      return openSheet(title, '근무 시간을 직접 정할 수 있어요. 이 날짜에만 적용됩니다.', `
        <div class="row2">
          <div><label>출근</label><input id="sitS" type="time" value="${s0}"></div>
          <div><label>퇴근</label><input id="sitE" type="time" value="${e0}"></div>
        </div>
        <button class="btn" style="margin-top:14px" data-act="savesitter" data-v="${v}" data-d="${d}" data-w="day"
          >이 날짜에 적용</button>
        <button class="ghost" data-act="savesitter" data-v="${v}" data-d="${d}" data-w="week"
          >매주 ${WD[wdOf(d)]}요일 기본값으로 저장</button>
        <h4>빠른 설정</h4>
        <div class="opt-grid">
          <div class="opt ${cur==='휴무'?'sel':''}" data-act="setstatus" data-v="${v}" data-d="${d}" data-w="휴무">휴무</div>
          ${SITTER_TYPES.filter(x => x !== '휴무').map(x => `<div class="opt ${x===cur?'sel':''}"
            data-act="setstatus" data-v="${v}" data-d="${d}" data-w="${esc(x)}">${esc(x.replace('근무 ',''))}</div>`).join('')}
        </div>
        <div class="note" style="text-align:left">현재 요일 기본값: ${esc(wk || '없음')}</div>`);
    }

    openSheet(title, '이 날짜에만 적용됩니다. 아래에서 요일 기본값도 바꿀 수 있어요.',
      `<div class="opt-grid">${STATUS_TYPES.map(t => `<div class="opt ${t===cur?'sel':''}"
          data-act="setstatus" data-v="${v}" data-d="${d}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>
       <h4>매주 ${WD[wdOf(d)]}요일 기본값으로 저장</h4>
       <div class="opt-grid">${STATUS_TYPES.map(t => `<div class="opt ${t===wk?'sel':''}"
          data-act="setweekly" data-v="${v}" data-d="${d}" data-w="${esc(t)}">${esc(t)}</div>`).join('')}</div>`);
  },

  /* 시터 근무시간 직접 입력 저장 (w='day' | 'week') */
  savesitter: ({v,d,w}) => {
    const s = $('sitS').value, e = $('sitE').value;
    if(!s || !e) return toast('시간을 입력해 주세요', true);
    if(e <= s)   return toast('퇴근 시간이 출근보다 빨라요', true);
    const status = `근무 ${s}~${e}`;
    const m = M(v);
    run(async () => {
      const r = w === 'week'
        ? await sb.from('weekly_status').upsert(
            { family_id:m.family_id, member_id:v, weekday:wdOf(d), status }, { onConflict:'member_id,weekday' })
        : await sb.from('day_status').upsert(
            { family_id:m.family_id, member_id:v, on_date:d, status }, { onConflict:'member_id,on_date' });
      closeSheet(); setReopen(null);
      return r;
    }, w === 'week' ? `매주 ${WD[wdOf(d)]}요일 ${status}` : `${mdLabel(d)} ${status}`);
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
    // 통째로 쉬는 날은 숙제·준비물도 함께 쉽니다
    if(n.rest){
      const sid = setIdFor(d), wd = wdOf(d);
      const rows = D.tasks
        .filter(x => x.set_id===sid && !x.archived
          && (x.weekdays === null || (x.weekdays||[]).includes(wd)))
        .map(x => ({ family_id:x.family_id, task_id:x.id, on_date:d, reason:n.label }));
      if(rows.length) await sb.from('task_cancels').upsert(rows, { onConflict:'task_id,on_date' });
    }
    return r;
  }, '하루 표시를 저장했어요'),

  // 표시를 지우면 그 표시 때문에 걸어둔 취소도 함께 풉니다
  delnote: ({d}) => run(async () => {
    const n = DAY_NOTES.find(x => x.key === D.notes[d]?.note_key);
    if(n && n.cancels !== 'none'){
      const a = await sb.from('routine_cancels').delete().eq('on_date',d); if(a.error) return a;
    }
    if(n && n.rest){
      const b = await sb.from('task_cancels').delete().eq('on_date',d);    if(b.error) return b;
    }
    return sb.from('date_notes').delete().eq('on_date',d);
  }, '하루 표시를 지웠어요'),

  // 숙제·준비물을 그날만 쉬기 / 되살리기
  canceltask: ({v,d}) => run(() => {
    const t = D.tasks.find(x => x.id === v);
    if(D.taskCancels.has(v+'|'+d)) return sb.from('task_cancels').delete().eq('task_id',v).eq('on_date',d);
    return sb.from('task_cancels').insert({ family_id:t.family_id, task_id:v, on_date:d });
  }),

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

  /* ---- 아이가 제안한 보상 ---- */
  suggest:     () => sheetSuggest(),
  savesuggest: () => saveSuggest(),
  delsuggest:  ({v,w}) => {
    if(!confirm(`'${w || '이 제안'}' 을(를) 지울까요?`)) return;
    run(() => sb.from('reward_suggestions').delete().eq('id',v), '지웠어요');
  },
  /* 포인트를 정해 확정 → 보상 목록에 추가 (서버 RPC 가 한 번에 처리) */
  sugok: ({v}) => {
    const el = $('sg'+v);
    const pt = Number(el && el.value);
    if(!Number.isFinite(pt) || pt <= 0) return toast('포인트를 1 이상으로 입력해 주세요', true);
    const s = D.suggests.find(x => x.id === v);
    if(!confirm(`'${s?.title || '이 보상'}' 을(를) ${pt}P 짜리 보상으로 상점에 올릴까요?`)) return;
    run(() => sb.rpc('approve_reward_suggestion', { p_id:v, p_cost:pt }), `${pt}P 보상으로 추가했어요`);
  },
  sugno: ({v}) => {
    const s = D.suggests.find(x => x.id === v);
    if(!confirm(`'${s?.title || '이 제안'}' 을(를) 거절할까요?\n아이 화면에 알림이 갑니다.`)) return;
    run(() => sb.rpc('reject_reward_suggestion', { p_id:v }), '거절했어요');
  },

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
  delroutine:  ({v,w}) => {
    const name = w || D.routines.find(x => x.id === v)?.title || '이 일정';
    if(!confirm(`'${name}' 일정을 삭제할까요?\n이 요일 시간표에서 완전히 사라집니다.`)) return;
    run(async () => {
      const r = await sb.from('routines').delete().eq('id',v);
      closeSheet(); setReopen(null); return r; }, '삭제했어요');
  },

  newtask:   ({v}) => sheetTask(null, v, 'homework'),
  newsupply: ({v}) => sheetTask(null, v, 'supply'),
  edittask:  ({v}) => sheetTask(D.tasks.find(x => x.id === v)),
  savetask: () => saveTask(),
  deltask:  ({v,w}) => {
    const name = w || D.tasks.find(x => x.id === v)?.title || '이 숙제';
    if(!confirm(`'${name}' 숙제를 삭제할까요?\n지금까지의 완료 기록도 함께 사라집니다.`)) return;
    run(async () => {
      const r = await sb.from('tasks').delete().eq('id',v);
      closeSheet(); setReopen(null); return r; }, '삭제했어요');
  },

  /* ---- 시간표 세트 / 적용 기간 ---- */
  setrename:  ({v}) => sheetSet(D.sets.find(s => s.id === v)),
  newset:     () => sheetSet(null),
  saveset:    () => saveSet(),
  delset:     ({v,w}) => {
    const n = D.routines.filter(r => r.set_id === v).length + D.tasks.filter(t => t.set_id === v).length;
    if(!confirm(`«${w}» 세트를 삭제할까요?\n이 세트의 시간표·숙제 ${n}건과 적용 기간이 모두 사라집니다.`)) return;
    run(async () => {
      const r = await sb.from('schedule_sets').delete().eq('id', v);
      S.editSet = null; closeSheet(); setReopen(null);
      return r;
    }, '세트를 삭제했어요');
  },
  editperiod: ({v}) => sheetPeriod(D.periods.find(p => p.id === v)),
  newperiod:  ({v}) => sheetPeriod(null, v),
  saveperiod: () => savePeriod(),
  delperiod:  ({v}) => {
    if(!confirm('이 적용 기간을 삭제할까요?\n해당 날짜에는 다른 시간표가 적용되거나, 없으면 첫 번째 세트가 쓰입니다.')) return;
    run(async () => {
      const r = await sb.from('set_periods').delete().eq('id', v);
      closeSheet(); setReopen(null);
      return r;
    }, '삭제했어요');
  },

  weeklyedit:    ({v}) => sheetWeekly(v),
  saveweeklyall: ({v}) => saveWeeklyAll(v),

  newreward:  () => sheetReward(null),
  editreward: ({v}) => sheetReward(D.rewards.find(x => x.id === v)),
  savereward: () => saveReward(),
  delreward:  ({v,w}) => {
    const name = w || D.rewards.find(x => x.id === v)?.title || '이 보상';
    if(!confirm(`'${name}' 보상을 목록에서 뺄까요?\n이미 교환한 기록은 그대로 남습니다.`)) return;
    run(async () => {
      const r = await sb.from('rewards').update({archived:true}).eq('id',v);
      closeSheet(); setReopen(null); return r; }, '삭제했어요');
  },

  /* ---- 공휴일·쉬는 날 ---- */
  newrest:  () => sheetRest(),
  saverest: () => saveRest(),
  delrest:  ({v,w}) => { const [from,to] = v.split('~'); removeRest(from, to, w || '이 기간'); },

  /* ---- 픽업 도와줄 사람 ---- */
  newmember:  () => sheetMember(null),
  editmember: ({v}) => sheetMember(M(v)),
  savemember: () => saveMember(),
  /* 담당 고르는 자리에서 바로 추가 → 저장하면 그 일정에 배정됩니다 */
  newpicker:  ({k,v,d}) => sheetMember(null, {k,v,d}),

  delmember: ({v,w}) => {
    const m = M(v);
    const name = w || m?.name || '이 구성원';
    const extra = m?.kind === 'child'
      ? '\n\n⚠️ 이 아이의 스케줄·숙제·포인트 기록이 모두 사라집니다. 되돌릴 수 없습니다.'
      : '\n\n이 사람이 담당으로 지정된 일정은 담당 미정이 됩니다.';
    if(!confirm(`'${name}' 을(를) 삭제할까요?${extra}`)) return;
    run(async () => {
      const r = await sb.from('members').delete().eq('id',v);
      closeSheet(); setReopen(null);
      return r;
    }, '삭제했어요');
  },

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
