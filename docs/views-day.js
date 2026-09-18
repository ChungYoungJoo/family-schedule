// =====================================================================
//  views-day.js — 오늘 화면 (아이 / 보호자) + 포인트 상점
// =====================================================================
import {
  D, S, WD, CAT, TODAY, esc, hm, toMin, mdLabel, wdOf,
  me, kids, dayItems, tasksOn, taskDone, attDone, checkable,
  progress, noteOn, openOn, pendingRedeems,
} from './core.js';
import { emOf, pickTag, itemChip, statusRow, slotRow, redeemRow } from './views-common.js';

const dateTitle = date => `${mdLabel(date).replace('/','월 ')}일 ${WD[wdOf(date)]}요일`;

/* ---------------- 아이: 오늘 ---------------- */
export function kidToday(){
  const c = me(), date = TODAY;
  const p = progress(c.id, date);
  const items = dayItems(c.id, date), ts = tasksOn(c.id, date), nt = noteOn(date);
  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();
  const attPt = D.family?.attend_points ?? 20;

  const tl = items.length ? items.map(it => {
    if(it.off) return `<div class="ev off" style="--dot:#c9cee0"><div class="t">${hm(it.starts_at)}</div>
      <div class="body"><b>${emOf(it)} ${esc(it.title)}</b><div><span class="tag off">오늘은 쉬어요</span></div></div>
      <div style="width:24px;flex:none"></div></div>`;
    const on = attDone(it, date), past = toMin(hm(it.ends_at)) < nowMin;
    const meta = (it.extra ? '<span class="tag new">오늘만 있는 일정</span> ' : '')
      + pickTag(it, date)
      + (checkable(it) ? ` <span class="tag pt">출석 +${attPt}P</span>` : '');
    return `<div class="ev ${past&&!on?'past':''} ${on?'done':''}" style="--dot:${CAT[it.category].color}">
      <div class="t">${hm(it.starts_at)}</div>
      <div class="body"><b>${emOf(it)} ${esc(it.title)}</b>
        <span>${hm(it.starts_at)} ~ ${hm(it.ends_at)}</span>${meta?`<div>${meta}</div>`:''}</div>
      ${checkable(it)
        ? `<div class="box" data-act="att" data-k="${it.kind}" data-v="${it.id}" data-d="${date}">✓</div>`
        : '<div style="width:24px;flex:none"></div>'}</div>`;
  }).join('') : `<div class="note" style="padding:14px">오늘은 정해진 일정이 없어요 🎉</div>`;

  const clear = p.total > 0 && p.done === p.total;

  return `
  <div class="hero" style="background:linear-gradient(135deg,${c.color},${c.color}bb)">
    <div class="date">${dateTitle(date)}</div>
    <div class="hi">${esc(c.name)}야, ${clear?'오늘 다 했어! 최고 🎉':'오늘 할 일이야!'}</div>
    <div class="bar"><i style="width:${p.pct}%"></i></div>
    <div class="barlabel"><span>완료 ${p.done} / ${p.total}</span><span>${p.pct}%</span></div>
    <div class="ptpill">⭐ 내 포인트 ${D.balances[c.id] ?? 0}P</div>
  </div>
  ${nt?`<div class="banner"><span class="em">${nt.emoji}</span>
    <div><b>오늘은 ${esc(nt.label)}이에요</b><span>평소 일정과 다르니 확인해요</span></div></div>`:''}
  <div class="sectitle"><h3>오늘 일정</h3><em>학원 다녀오면 체크!</em></div>
  <div class="card"><div class="tl">${tl}</div></div>
  <div class="sectitle"><h3>오늘 숙제</h3><em>누르면 체크돼요</em></div>
  <div class="card">
    ${ts.length ? ts.map(t => `
      <div class="task ${taskDone(t,date)?'done':''}" data-act="task" data-v="${t.id}" data-d="${date}">
        <div class="box">✓</div>
        <div class="tx"><b>${esc(t.title)}</b>${t.note?`<span>${esc(t.note)}</span>`:''}</div>
        <span class="pt">+${t.points}P</span></div>`).join('')
      : '<div class="note" style="padding:10px">오늘 숙제는 없어요!</div>'}
    ${clear?`<div class="allclear"><div class="big">🏅</div><b>오늘 할 일 끝!</b>
      <span>엄마·아빠 화면에도 바로 표시됐어요</span></div>`:''}
  </div>`;
}

/* ---------------- 아이: 포인트 상점 ---------------- */
export function shopView(){
  const c = me(), bal = D.balances[c.id] ?? 0;
  const my = D.redemptions.filter(r => r.child_id === c.id);
  const label = {pending:['wait','승인 대기'], approved:['done','교환 완료'], rejected:['need','거절됨']};

  return `
  <div class="ptcard">
    <div class="lbl">${esc(c.name)}의 포인트</div>
    <div class="val">${bal}<small>P</small></div>
    <div class="meta"><span>이번 주 +${D.weekEarned[c.id] ?? 0}P</span>
      <span>교환 ${my.filter(r=>r.status==='approved').length}회</span></div>
  </div>
  <div class="sectitle"><h3>보상 교환하기</h3><em>엄마·아빠 승인 후 받을 수 있어요</em></div>
  <div class="shop">${D.rewards.map(w => {
    const req = my.find(r => r.reward_id === w.id && r.status === 'pending');
    const can = bal >= w.cost;
    return `<div class="item"><div class="em">${w.emoji}</div><b>${esc(w.title)}</b>
      <div class="cost">${w.cost}P</div>
      ${req ? `<button class="wait" disabled>승인 대기중</button>`
            : `<button ${can?'':'disabled'} data-act="redeem" data-v="${w.id}"
                >${can?'교환 신청':`${w.cost-bal}P 더 모아요`}</button>`}</div>`;
  }).join('')}</div>
  <div class="sectitle"><h3>내 신청 내역</h3></div>
  <div class="card">${my.length ? my.slice(0,10).map(r => {
    const w = D.rewards.find(x => x.id === r.reward_id);
    const st = label[r.status];
    return `<div class="mrow"><div class="ic">${w?w.emoji:'🎁'}</div>
      <div class="mx"><b>${esc(w?w.title:'보상')}</b><span>${r.requested_at.slice(5,10)} · ${r.cost}P</span></div>
      <span class="badge ${st[0]}">${st[1]}</span></div>`;
  }).join('') : '<div class="note" style="padding:8px">아직 신청한 보상이 없어요</div>'}</div>`;
}

/* ---------------- 보호자: 오늘 ---------------- */
export function parentToday(){
  const date = TODAY;
  const open = openOn(date), pend = pendingRedeems(), nt = noteOn(date);

  const alertCard = open.length ? `
    <div class="card" style="border-left:4px solid var(--danger)">
      <h2 style="color:var(--danger)">⚠️ 오늘 조율이 필요해요</h2>
      <div class="sub">데려다주거나 데려올 사람이 정해지지 않은 일정</div>
      ${open.map(it => slotRow(it,date)).join('')}</div>` : `
    <div class="card" style="border-left:4px solid var(--ok)">
      <h2 style="color:var(--ok)">✅ 오늘 담당은 모두 정해졌어요</h2>
      <div class="sub" style="margin:0">조율이 필요한 일정이 없습니다</div></div>`;

  const redeemCard = pend.length ? `
    <div class="card" style="border-left:4px solid var(--gold)">
      <h2 style="color:#b07400">🎁 보상 승인 요청 ${pend.length}건</h2>
      <div class="sub">아이가 포인트로 교환을 신청했어요</div>
      ${pend.map(redeemRow).join('')}</div>` : '';

  const kidCards = kids().map(c => {
    const p = progress(c.id,date), items = dayItems(c.id,date), ts = tasksOn(c.id,date);
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">
        <span style="width:32px;height:32px;border-radius:50%;background:${c.color}22;display:grid;place-items:center;font-size:18px">${c.emoji}</span>
        <div style="flex:1"><b style="font-size:15px">${esc(c.name)}</b>
          <span style="font-size:11.5px;color:var(--ink-3);font-weight:600"> · ${esc(c.descr||'')}</span></div>
        <span class="badge" style="background:var(--gold-soft);color:#b07400">⭐ ${D.balances[c.id]??0}P</span>
        <span class="badge ${p.total&&p.done===p.total?'done':'need'}">${p.done}/${p.total}</span></div>
      <div class="bar" style="background:#eef0f6"><i style="width:${p.pct}%;background:${c.color}"></i></div>
      <div style="margin-top:12px" class="chips">${items.length
        ? items.map(it => itemChip(it,date)).join('')
        : '<span class="chip empty">일정 없음</span>'}</div>
      <div style="margin-top:10px;border-top:1px solid var(--line);padding-top:6px">
        ${ts.map(t => {
          const on = taskDone(t,date);
          return `<div class="task" style="padding:5px 0;border:0" data-act="task" data-v="${t.id}" data-d="${date}">
            <span style="font-size:13px">${on?'✅':'⬜'}</span>
            <div class="tx"><b style="font-size:13px;font-weight:600;${on?'text-decoration:line-through;color:var(--ink-3)':''}"
              >${esc(t.title)}</b></div></div>`;
        }).join('') || '<div class="note" style="text-align:left;padding:6px 0">숙제 없음</div>'}
      </div></div>`;
  }).join('');

  return `
  <div class="sectitle" style="margin-top:4px"><h3>${dateTitle(date)}</h3>
    <em><button class="editday" data-act="editday" data-d="${date}">✏️ 이 날만 변경</button></em></div>
  ${nt?`<div class="banner"><span class="em">${nt.emoji}</span>
    <div><b>오늘은 ${esc(nt.label)}</b><span>해당 일정이 오늘만 취소·변경됐습니다</span></div></div>`:''}
  ${alertCard}${redeemCard}
  <div class="sectitle"><h3>오늘 어른들 일정</h3><em>눌러서 변경</em></div>
  <div class="card"><div class="prow" style="margin:0">${statusRow(date)}</div></div>
  <div class="sectitle"><h3>아이별 현황</h3></div>
  ${kidCards}`;
}
