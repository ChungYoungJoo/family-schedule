// =====================================================================
//  views-manage.js — 관리 탭
// =====================================================================
import {
  D, S, WD, CAT, TODAY, esc, hm, toMin, mdLabel,
  M, A, kids, setNameFor, pendingRedeems, pendingSuggests, restGroups, restRange, isRest,
} from './core.js';
import { redeemRow, suggestRow } from './views-common.js';

/* 이번 주에 걸려 있는 "이 날만 변경" 목록
   쉬는 날(공휴일 등)은 위의 «쉬는 날» 카드에서 관리하므로 여기서는 뺍니다.
   안 그러면 연휴 때 취소된 일정이 목록을 가득 채웁니다. */
function exceptionRows(){
  const rows = [];

  Object.values(D.notes).filter(n => !isRest(n.on_date)).forEach(n => rows.push({ d:n.on_date, html:
    `<div class="mrow"><div class="ic">${n.emoji}</div>
      <div class="mx"><b>${mdLabel(n.on_date)} · ${esc(n.label)}</b><span>하루 표시</span></div>
      <button class="undo" data-act="delnote" data-d="${n.on_date}">↺</button></div>` }));

  [...D.cancels].forEach(key => {
    const [rid, d] = key.split('|');
    const r = D.routines.find(x => x.id === rid);
    if(!r || isRest(d)) return;
    rows.push({ d, html:
      `<div class="mrow"><div class="ic">🚫</div>
        <div class="mx"><b>${mdLabel(d)} · ${esc(r.title)} 취소</b>
          <span>${esc(M(r.child_id)?.name||'')} · 이 날만</span></div>
        <button class="undo" data-act="uncancel" data-v="${rid}" data-d="${d}">↺</button></div>` });
  });

  D.extras.forEach(e => rows.push({ d:e.on_date, html:
    `<div class="mrow"><div class="ic">${e.emoji}</div>
      <div class="mx"><b>${mdLabel(e.on_date)} · ${esc(e.title)}</b>
        <span>${esc(M(e.child_id)?.name||'')} · ${hm(e.starts_at)}~${hm(e.ends_at)}</span></div>
      <button class="undo" data-act="delextra" data-v="${e.id}">↺</button></div>` }));

  return rows.sort((a,b) => a.d < b.d ? -1 : 1);
}

export function manageView(){
  const pend = pendingRedeems();
  const sug  = pendingSuggests();
  const rest = restGroups();
  const sid  = S.editSet;
  const setObj = D.sets.find(s => s.id === sid);
  const ex = exceptionRows();

  return `
  ${pend.length ? `<div class="sectitle" style="margin-top:0"><h3>보상 승인 대기</h3><em>${pend.length}건</em></div>
  <div class="card">${pend.map(redeemRow).join('')}</div>` : ''}

  <div class="sectitle" ${pend.length?'':'style="margin-top:0"'}><h3>이번 주 예외 일정</h3><em>${ex.length}건</em></div>
  <div class="card">
    ${ex.length ? ex.map(x => x.html).join('')
                : '<div class="note" style="padding:8px">이번 주에 등록된 예외가 없습니다</div>'}
    <button class="ghost" data-act="editday" data-d="${TODAY}">＋ 오늘 일정 예외 추가</button>
  </div>

  <div class="sectitle"><h3>쉬는 날 · 공휴일</h3><em>${rest.length ? rest.length+'건 예정' : '없음'}</em></div>
  <div class="card">
    ${rest.map(g => `<div class="mrow"><div class="ic">${g.emoji}</div>
      <div class="mx"><b>${esc(g.label)}</b><span>${restRange(g)}</span></div>
      <button class="del" data-act="delrest" data-v="${g.from}~${g.to}" data-w="${esc(g.label)}">🗑</button></div>`).join('')
      || '<div class="note" style="padding:6px">예정된 쉬는 날이 없습니다</div>'}
    <button class="ghost" data-act="newrest">＋ 쉬는 날 추가</button>
    <div class="note" style="text-align:left;padding:8px 2px 0">
      추석·설날처럼 학교도 학원도 쉬는 날입니다. 지정하면 그날 숙제·준비물도 함께 쉬고,
      연속 달성 🔥 이 끊기지 않습니다. <b>주말은 평소대로</b> — 매일 하는 숙제는 토·일에도 그대로 나옵니다.
    </div>
  </div>

  <div class="sectitle"><h3>시간표 편집</h3><em>지금 적용 중: ${esc(setNameFor(TODAY))}</em></div>
  <div class="card">
    <div class="seg">${D.sets.map(s => `<button class="${sid===s.id?'on':''}" data-act="editset" data-v="${s.id}"
      >${s.emoji} ${esc(s.name)}</button>`).join('')}</div>

    <div class="mrow" data-act="setrename" data-v="${sid}">
      <div class="ic">${setObj?.emoji || '📅'}</div>
      <div class="mx"><b>${esc(setObj?.name||'')}</b><span>세트 이름·아이콘 바꾸기</span></div>
      <span class="chev">›</span></div>

    <div class="sublabel" style="margin-top:12px">적용 기간</div>
    ${D.periods.filter(p => p.set_id === sid)
      .sort((a,b) => a.starts_on < b.starts_on ? -1 : 1)
      .map(p => {
        const now = TODAY >= p.starts_on && TODAY <= p.ends_on;
        return `<div class="mrow" data-act="editperiod" data-v="${p.id}">
          <div class="ic" style="${now?'background:var(--ok-soft)':''}">📅</div>
          <div class="mx"><b>${esc(p.label||'기간')}${now?' · 지금':''}</b>
            <span>${p.starts_on} ~ ${p.ends_on}</span></div>
          <span class="chev">›</span></div>`;
      }).join('') || '<div class="note" style="padding:6px">적용 기간이 없습니다</div>'}
    <button class="ghost" data-act="newperiod" data-v="${sid}">＋ 적용 기간 추가</button>
    <button class="ghost" data-act="newset">＋ 시간표 세트 추가</button>
    <div class="note" style="text-align:left;padding:8px 2px 0">
      오늘 날짜가 어느 기간에 드는지로 시간표가 자동 선택됩니다. 개학·방학 날짜가 바뀌면 여기서 고치세요.
    </div>
  </div>

  ${kids().map(c => `
  <div class="sectitle"><h3>${c.emoji} ${esc(c.name)} · 반복 스케줄</h3><em>${esc(setObj?.name||'')}</em></div>
  <div class="card">
    ${[1,2,3,4,5,6,0].flatMap(wd => D.routines
      .filter(r => r.set_id===sid && r.child_id===c.id && r.weekday===wd)
      .sort((a,b) => toMin(a.starts_at) - toMin(b.starts_at))
      .map(r => {
        const a = r.default_is_self ? 'self' : r.default_pickup_id;
        return `<div class="mrow" data-act="editroutine" data-v="${r.id}">
          <div class="ic" style="background:${CAT[r.category].color}1a">${CAT[r.category].emoji}</div>
          <div class="mx"><b>${WD[r.weekday]} · ${esc(r.title)}</b>
            <span>${hm(r.starts_at)}~${hm(r.ends_at)}${r.needs_pickup
              ? ` · 기본 담당 ${a && A(a) ? A(a).name : '미정'}` : ''}</span></div>
          <button class="del" data-act="delroutine" data-v="${r.id}" data-w="${esc(r.title)}">🗑</button></div>`;
      })).join('') || '<div class="note" style="padding:6px">등록된 일정이 없습니다</div>'}
    <button class="ghost" data-act="newroutine" data-v="${c.id}">＋ 스케줄 추가</button>
  </div>
  <div class="sectitle"><h3>${c.emoji} ${esc(c.name)} · 준비물</h3><em>가져갈 것</em></div>
  <div class="card">
    ${D.tasks.filter(t => t.set_id===sid && t.child_id===c.id && t.kind==='supply')
      .sort((a,b) => a.sort_order - b.sort_order)
      .map(t => `<div class="mrow" data-act="edittask" data-v="${t.id}"><div class="ic">🎒</div>
        <div class="mx"><b>${esc(t.title)}</b><span>${t.weekdays===null
          ? '매일' : (t.weekdays||[]).map(x => WD[x]).join('·')+'요일'}${t.note?' · '+esc(t.note):''}</span></div>
        <span class="pt">+${t.points}P</span>
        <button class="del" data-act="deltask" data-v="${t.id}" data-w="${esc(t.title)}">🗑</button></div>`).join('')
      || '<div class="note" style="padding:6px">등록된 준비물이 없습니다 (체육복·리코더 등)</div>'}
    <button class="ghost" data-act="newsupply" data-v="${c.id}">＋ 준비물 추가</button>
  </div>

  <div class="sectitle"><h3>${c.emoji} ${esc(c.name)} · 숙제/할 일</h3><em>${esc(setObj?.name||'')}</em></div>
  <div class="card">
    ${D.tasks.filter(t => t.set_id===sid && t.child_id===c.id && (t.kind||'homework')==='homework')
      .sort((a,b) => a.sort_order - b.sort_order)
      .map(t => `<div class="mrow" data-act="edittask" data-v="${t.id}"><div class="ic">📝</div>
        <div class="mx"><b>${esc(t.title)}</b><span>${t.weekdays===null
          ? '매일' : (t.weekdays||[]).map(x => WD[x]).join('·')+'요일'}${t.note?' · '+esc(t.note):''}</span></div>
        <span class="pt">+${t.points}P</span>
        <button class="del" data-act="deltask" data-v="${t.id}" data-w="${esc(t.title)}">🗑</button></div>`).join('')
      || '<div class="note" style="padding:6px">등록된 숙제가 없습니다</div>'}
    <button class="ghost" data-act="newtask" data-v="${c.id}">＋ 숙제 추가</button>
  </div>`).join('')}

  <div class="sectitle"><h3>어른 요일별 기본 일정</h3><em>눌러서 한 번에 편집</em></div>
  <div class="card">
    ${D.members.filter(m => m.kind !== 'child').map(m => {
      const days = [1,2,3,4,5,6,0].map(w => D.weekly[m.id+'|'+w] || '');
      const work = days.filter(v => v && v !== '휴무');
      const same = work.length && work.every(v => v === work[0]);
      const summary = !days.some(Boolean) ? '요일 기본 일정 없음 · 픽업 담당으로만'
        : !work.length ? '전부 휴무'
        : same ? `${work.length}일 · ${work[0]}`
        : `${work.length}일 근무 · 요일마다 다름`;
      return `<div class="mrow" data-act="weeklyedit" data-v="${m.id}">
        <div class="ic" style="background:${m.color}22">${m.emoji}</div>
        <div class="mx"><b>${esc(m.name)}</b><span>${esc(summary)}</span></div>
        <span class="chev">›</span></div>`;
    }).join('')}
    <div class="note" style="text-align:left;padding:8px 2px 0">
      선생님은 출근·퇴근 시각을 요일마다 직접 넣을 수 있고, «월~금 한 번에 채우기»로 한 번에 맞출 수 있습니다.
    </div>
  </div>

  <div class="sectitle"><h3>아이가 제안한 보상</h3><em>${sug.length ? sug.length+'건 검토 대기' : '대기 없음'}</em></div>
  <div class="card">
    ${sug.length ? sug.map(suggestRow).join('')
                 : '<div class="note" style="padding:8px">아이가 제안한 보상이 없습니다</div>'}
    <div class="note" style="text-align:left;padding:8px 2px 0">
      아이가 «포인트 상점» 에서 갖고 싶은 것을 올리면 여기에 쌓입니다.
      포인트를 정해 확정하면 아래 보상 목록에 바로 추가됩니다.
    </div>
  </div>

  <div class="sectitle"><h3>보상 목록</h3><em>${D.rewards.length}개</em></div>
  <div class="card">
    ${D.rewards.map(w => `<div class="mrow" data-act="editreward" data-v="${w.id}">
      <div class="ic">${w.emoji}</div>
      <div class="mx"><b>${esc(w.title)}</b><span>${w.cost}P</span></div>
      <button class="del" data-act="delreward" data-v="${w.id}" data-w="${esc(w.title)}">🗑</button></div>`).join('')}
    <button class="ghost" data-act="newreward">＋ 보상 추가</button>
  </div>

  <div class="sectitle"><h3>가족 구성원</h3><em>선생님·도우미는 눌러서 수정</em></div>
  <div class="card">
    ${D.members.map(m => `<div class="mrow" ${
        m.kind==='helper' ? `data-act="editmember" data-v="${m.id}"` : ''}>
      <div class="ic" style="background:${m.color}22">${m.emoji}</div>
      <div class="mx"><b>${esc(m.name)}</b><span>${esc(m.descr||'')} · ${
        m.kind==='child' ? '아이 화면'
        : m.kind==='helper' ? '앱 계정 없음 · 픽업 담당으로만'
        : '보호자 화면'}</span></div>
      ${m.kind==='child' ? `<button class="undo" data-act="kidlink" data-v="${m.id}">🔗 링크</button>` : ''}
      ${m.kind==='parent' ? '' : `<button class="del" data-act="delmember" data-v="${m.id}" data-w="${esc(m.name)}">🗑</button>`}
      </div>`).join('')}
    <button class="ghost" data-act="newmember">＋ 픽업 도와줄 사람 추가</button>
    <div class="note" style="text-align:left;padding:8px 2px 0">
      미술선생님·할머니처럼 가끔 데리러 오는 사람을 등록해 두면 담당 고를 때 같이 나옵니다.
      아이를 삭제하면 그 아이의 스케줄·숙제·포인트 기록도 함께 사라집니다.
    </div>
  </div>

  <div class="sectitle"><h3>포인트 규칙</h3></div>
  <div class="card">
    <div class="mrow"><div class="ic">📝</div><div class="mx"><b>숙제 완료</b><span>숙제마다 개별 설정</span></div></div>
    <div class="mrow"><div class="ic">🏫</div><div class="mx"><b>학원·운동 출석 체크</b>
      <span>+${D.family?.attend_points ?? 20}P</span></div></div>
    <div class="mrow"><div class="ic">🎯</div><div class="mx"><b>하루 전부 완료 보너스</b>
      <span>+${D.family?.bonus_points ?? 20}P</span></div></div>
    <button class="ghost" data-act="editpoints">규칙 수정</button>
  </div>

  <div class="card" style="margin-top:20px">
    <button class="ghost" data-act="logout">로그아웃</button>
  </div>`;
}
