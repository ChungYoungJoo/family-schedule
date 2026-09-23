// =====================================================================
//  views-day.js — 오늘 화면 (아이 / 보호자) + 포인트 상점
// =====================================================================
import {
  D, S, WD, CAT, TODAY, TOMORROW, esc, josa, hm, toMin, mdLabel, wdOf,
  me, kids, A, dayItems, homeworkOn, suppliesOn, taskDone, attDone, checkable,
  progress, noteOn, openOn, pendingRedeems, pendingSuggests, pickupOf, streakOf, weekStamps, isRest,
} from './core.js';
import { emOf, pickTag, statusRow, slotRow, redeemRow, suggestRow } from './views-common.js';

const dateTitle = date => `${mdLabel(date).replace('/','월 ')}일 ${WD[wdOf(date)]}요일`;

/* 픽업 담당 한 칸 */
const whoSpan = a => {
  const p = A(a);
  return p ? `<span class="who">${p.emoji}${esc(p.name)}</span>`
           : `<span class="who miss">❗담당 미정</span>`;
};

/* 체크 한 줄 (숙제 / 준비물 공통) */
const todoRow = (t, date) => `
  <div class="task ${taskDone(t,date)?'done':''}" data-act="task" data-v="${t.id}" data-d="${date}">
    <div class="box">✓</div>
    <div class="tx"><b>${esc(t.title)}</b>${t.note?`<span>${esc(t.note)}</span>`:''}</div>
    <span class="pt">+${t.points}P</span></div>`;

/* 보호자 카드 안의 체크 한 줄 */
const checkLine = (t, date) => {
  const on = taskDone(t, date);
  return `<div class="task" style="padding:5px 0;border:0" data-act="task" data-v="${t.id}" data-d="${date}">
    <span class="mini ${on?'on':''}">${on?'✓':''}</span>
    <div class="tx"><b style="font-size:13.5px;font-weight:700;${
      on?'text-decoration:line-through;color:var(--ink-3)':''}">${esc(t.title)}</b></div></div>`;
};

/* 연속 달성 + 이번 주 도장판 */
function streakCard(cid){
  const n = streakOf(cid);
  const stamps = weekStamps(cid);
  return `<div class="card" style="display:flex;align-items:center;gap:12px">
    <div style="text-align:center;flex:none;width:64px">
      <div style="font-size:26px;line-height:1">${n>0?'😻':'🐱'}</div>
      <b style="font-size:13px">${n>0?`${n}일 연속`:'시작해요'}</b>
    </div>
    <div style="flex:1">
      <div class="sublabel">이번 주 발바닥 도장</div>
      <div style="display:flex;gap:5px">
        ${stamps.map(s => `<div style="flex:1;text-align:center">
          <div style="font-size:10px;font-weight:800;color:var(--ink-3)">${WD[wdOf(s.date)]}</div>
          <div style="font-size:17px;line-height:1.3">${
            s.rest ? '🐟' : s.done ? '🐾' : s.future ? '·' : s.due ? '○' : '–'}</div></div>`).join('')}
      </div>
    </div></div>`;
}

/* ---------------- 아이: 오늘 ---------------- */
export function kidToday(){
  const c = me(), date = TODAY;
  const p = progress(c.id, date);
  const items = dayItems(c.id, date), nt = noteOn(date);
  const hw = homeworkOn(c.id, date), sup = suppliesOn(c.id, date);
  const supTom = suppliesOn(c.id, TOMORROW);
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
  }).join('') : `<div class="note" style="padding:14px">오늘은 정해진 일정이 없어! 뒹굴뒹굴~ 🐈</div>`;

  const clear = p.total > 0 && p.done === p.total;
  const rest  = isRest(date);          // 공휴일 등 통째로 쉬는 날

  return `
  <div class="hero" style="background:linear-gradient(135deg,${c.color},${c.color}bb)">
    <div class="catwm">${rest && !p.total ? '😽' : clear ? '😻' : '🐱'}</div>
    <div class="date">${dateTitle(date)}</div>
    <div class="hi">${esc(josa(c.name,'아','야'))}, ${
      rest && !p.total ? '오늘은 쉬는 날! 뒹굴뒹굴 하자 🐾'
      : clear ? '오늘 다 했다! 최고야 😻' : '오늘 할 일이야!'}</div>
    ${rest && !p.total ? '' : `
    <div class="bar"><i style="width:${p.pct}%"></i></div>
    <div class="barlabel"><span>완료 ${p.done} / ${p.total}</span><span>${p.pct}%</span></div>`}
    <div class="ptpill">⭐ 내 포인트 ${D.balances[c.id] ?? 0}P</div>
  </div>
  ${nt ? (rest
    ? `<div class="banner"><span class="em">${nt.emoji}</span>
        <div><b>오늘은 ${esc(nt.label)} 🎉</b><span>학교도 학원도 숙제도 쉬어요</span></div></div>`
    : `<div class="banner"><span class="em">${nt.emoji}</span>
        <div><b>오늘은 ${esc(nt.label)}이에요</b><span>평소 일정과 다르니 확인해요</span></div></div>`) : ''}

  ${streakCard(c.id)}

  <div class="sectitle"><h3>🐾 오늘 일정</h3><em>학원 다녀오면 체크!</em></div>
  <div class="card"><div class="tl">${tl}</div></div>

  ${sup.length ? `<div class="sectitle"><h3>🎒 오늘 챙길 것</h3><em>가방에 넣고 체크!</em></div>
  <div class="card">${sup.map(t => todoRow(t,date)).join('')}</div>` : ''}

  <div class="sectitle"><h3>📝 오늘 숙제</h3><em>누르면 체크돼요</em></div>
  <div class="card">
    ${hw.length ? hw.map(t => todoRow(t,date)).join('')
                : `<div class="note" style="padding:10px">${
                    rest ? '오늘은 숙제도 쉬어! 🐟' : '오늘 숙제는 없어! 🐾'}</div>`}
    ${clear?`<div class="allclear"><div class="big">😻</div><b>오늘 할 일 끝! 야옹~</b>
      <span>엄마·아빠 화면에도 바로 표시됐어요</span></div>`:''}
  </div>

  ${supTom.length ? `<div class="sectitle"><h3>🌙 내일 챙길 것</h3><em>자기 전에 미리!</em></div>
  <div class="card">${supTom.map(t => `<div class="litem">
      <span class="ttl">🎒 ${esc(t.title)}</span></div>`).join('')}</div>` : ''}`;
}

/* ---------------- 아이: 포인트 상점 ---------------- */
export function shopView(){
  const c = me(), bal = D.balances[c.id] ?? 0;
  const my = D.redemptions.filter(r => r.child_id === c.id);
  const label = {pending:['wait','승인 대기'], approved:['done','교환 완료'], rejected:['need','거절됨']};

  // 내가 제안한 보상
  const mySug = D.suggests.filter(s => s.child_id === c.id);
  const sLabel = {pending:['wait','엄마·아빠가 보는 중'], approved:['done','상점에 생겼어요'], rejected:['need','다음에 해요']};
  const catFace = bal >= 300 ? '😻' : bal >= 100 ? '😺' : '🐱';
  const sugRows = mySug.slice(0,10).map(s => {
    const st = sLabel[s.status];
    const w  = s.reward_id ? D.rewards.find(x => x.id === s.reward_id) : null;
    const sub = s.status === 'approved' && w ? `${w.cost}P 로 정해졌어요`
              : s.status === 'rejected' ? '🗑 을 눌러 목록에서 지울 수 있어요'
              : s.note ? esc(s.note) : s.created_at.slice(5,10);
    // 확정된 제안은 보상이 만들어졌으니 기록으로 남기고, 나머지는 아이가 지울 수 있습니다
    const canDel = s.status === 'pending' || s.status === 'rejected';
    return `<div class="mrow"><div class="ic">${esc(s.emoji||'🎁')}</div>
      <div class="mx"><b>${esc(s.title)}</b><span>${sub}</span></div>
      <span class="badge ${st[0]}">${st[1]}</span>
      ${canDel
        ? `<button class="del" data-act="delsuggest" data-v="${s.id}" data-w="${esc(s.title)}">🗑</button>` : ''}</div>`;
  }).join('');

  return `
  <div class="ptcard">
    <div class="catwm">${catFace}</div>
    <div class="lbl">${esc(c.name)}의 포인트</div>
    <div class="val">${bal}<small>P</small></div>
    <div class="meta"><span>이번 주 +${D.weekEarned[c.id] ?? 0}P</span>
      <span>교환 ${my.filter(r=>r.status==='approved').length}회</span></div>
  </div>
  <div class="sectitle"><h3>🎁 보상 교환하기</h3><em>엄마·아빠 승인 후 받을 수 있어요</em></div>
  <div class="shop">${D.rewards.map(w => {
    const req = my.find(r => r.reward_id === w.id && r.status === 'pending');
    const can = bal >= w.cost;
    return `<div class="item"><div class="em">${w.emoji}</div><b>${esc(w.title)}</b>
      <div class="cost">${w.cost}P</div>
      ${req ? `<button class="wait" disabled>승인 대기중</button>`
            : `<button ${can?'':'disabled'} data-act="redeem" data-v="${w.id}"
                >${can?'교환 신청':`${w.cost-bal}P 더 모아요`}</button>`}</div>`;
  }).join('')}</div>
  <div class="sectitle"><h3>😺 갖고 싶은 보상 말하기</h3><em>엄마·아빠가 포인트를 정해줘요</em></div>
  <div class="card">
    ${sugRows || '<div class="note" style="padding:8px">갖고 싶은 게 있으면 말해봐! 🐾</div>'}
    <button class="ghost" data-act="suggest">＋ 이런 보상 갖고 싶어요</button>
  </div>
  <div class="sectitle"><h3>📜 내 신청 내역</h3></div>
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
  const sug = pendingSuggests();

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

  const suggestCard = sug.length ? `
    <div class="card" style="border-left:4px solid var(--primary)">
      <h2 style="color:var(--primary)">💡 아이가 갖고 싶다는 보상 ${sug.length}건</h2>
      <div class="sub">포인트를 정해서 확정하면 아이 상점에 올라갑니다</div>
      ${sug.map(suggestRow).join('')}</div>` : '';

  const kidCards = kids().map(c => {
    const p = progress(c.id,date), items = dayItems(c.id,date);
    const hw = homeworkOn(c.id,date), sup = suppliesOn(c.id,date);
    const streak = streakOf(c.id);
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">
        <span style="width:32px;height:32px;border-radius:50%;background:${c.color}22;display:grid;place-items:center;font-size:18px">${c.emoji}</span>
        <div style="flex:1"><b style="font-size:15px">${esc(c.name)}</b>
          <span style="font-size:11.5px;color:var(--ink-3);font-weight:600"> · ${esc(c.descr||'')}</span></div>
        ${streak>0?`<span class="badge" style="background:#fff0e6;color:#d9480f">🔥 ${streak}일</span>`:''}
        <span class="badge" style="background:var(--gold-soft);color:#b07400">⭐ ${D.balances[c.id]??0}P</span>
        ${p.total ? `<span class="badge ${p.done===p.total?'done':'need'}">${p.done}/${p.total}</span>`
                  : `<span class="badge" style="background:#f1f3f9;color:var(--ink-3)">${
                      isRest(date) ? '🎌 쉬는 날' : '할 일 없음'}</span>`}</div>
      <div class="bar" style="background:#eef0f6"><i style="width:${p.pct}%;background:${c.color}"></i></div>

      <div class="sublabel" style="margin-top:12px">오늘 일정 <em style="font-style:normal;font-weight:600">· 눌러서 출석 체크</em></div>
      ${items.length ? items.map(it => {
        const a = it.needs_pickup ? pickupOf(it,date) : null;
        const who = it.needs_pickup ? whoSpan(a) : '';
        // 학교·기타는 출석 체크 대상이 아니고, 휴강인 날은 체크할 게 없습니다
        const can = checkable(it) && !it.off;
        const on  = can && attDone(it,date);
        return `<div class="litem ${it.off?'off':''} ${on?'done':''} ${can?'tap':''}"
          ${can?`data-act="att" data-k="${it.kind}" data-v="${it.id}" data-d="${date}"`:''}>
          <span class="tm">${hm(it.starts_at)}~${hm(it.ends_at)}</span>
          <span class="mini ${can?(on?'on':''):'na'}">${can?(on?'✓':''):'–'}</span>
          <span class="ttl">${emOf(it)} ${esc(it.title)}${it.off?' (휴강)':''}</span>${who}</div>`;
      }).join('') : '<div class="note" style="text-align:left;padding:4px 0">일정 없음</div>'}

      <div class="splitline"></div>

      ${sup.length ? `<div class="sublabel">오늘 챙길 것</div>
        ${sup.map(t => checkLine(t,date)).join('')}
        <div class="splitline"></div>` : ''}

      <div class="sublabel">오늘 숙제</div>
      ${hw.map(t => checkLine(t,date)).join('')
        || '<div class="note" style="text-align:left;padding:4px 0">숙제 없음</div>'}
      </div>`;
  }).join('');

  return `
  <div class="sectitle" style="margin-top:4px"><h3>${dateTitle(date)}</h3>
    <em><button class="editday" data-act="editday" data-d="${date}">✏️ 이 날만 변경</button></em></div>
  ${nt?`<div class="banner"><span class="em">${nt.emoji}</span>
    <div><b>오늘은 ${esc(nt.label)}</b><span>해당 일정이 오늘만 취소·변경됐습니다</span></div></div>`:''}
  ${alertCard}${redeemCard}${suggestCard}
  <div class="sectitle"><h3>오늘 어른들 일정</h3><em>눌러서 변경</em></div>
  <div class="card"><div class="prow" style="margin:0">${statusRow(date)}</div></div>
  <div class="sectitle"><h3>아이별 현황</h3></div>
  ${kidCards}
  ${tomorrowCard()}`;
}

/* ---------------- 보호자: 내일 미리보기 ---------------- */
function tomorrowCard(){
  const date = TOMORROW;
  const nt = noteOn(date);
  const open = openOn(date);

  const perKid = kids().map(c => {
    const items = dayItems(c.id, date).filter(x => !x.off);
    const sup = suppliesOn(c.id, date);
    const hwN = homeworkOn(c.id, date).length;
    if(!items.length && !sup.length && !hwN) return '';
    return `<div style="margin-top:12px">
      <div class="sublabel">${c.emoji} ${esc(c.name)}</div>
      ${items.map(it => {
        const a = it.needs_pickup ? pickupOf(it,date) : null;
        const who = it.needs_pickup ? whoSpan(a) : '';
        return `<div class="litem"><span class="tm">${hm(it.starts_at)}~${hm(it.ends_at)}</span>
          <span class="ttl">${emOf(it)} ${esc(it.title)}</span>${who}</div>`;
      }).join('') || '<div class="litem"><span class="ttl" style="color:var(--ink-3)">일정 없음</span></div>'}
      ${sup.length ? `<div class="litem"><span class="tm">🎒 챙길 것</span>
        <span class="ttl">${sup.map(t => esc(t.title)).join(', ')}</span></div>` : ''}
      ${hwN ? `<div class="litem"><span class="tm">📝 숙제</span>
        <span class="ttl">${hwN}개</span></div>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="sectitle"><h3>내일 미리보기</h3>
    <em><button class="editday" data-act="editday" data-d="${date}">✏️ 내일만 변경</button></em></div>
  <div class="card" style="border-left:4px solid ${open.length?'var(--warn)':'var(--primary)'}">
    <h2>${dateTitle(date)}</h2>
    <div class="sub" style="margin-bottom:6px">${
      open.length ? `⚠️ 픽업 담당이 ${open.length}건 비어 있어요 — 오늘 저녁에 정해두세요`
                  : '픽업 담당은 모두 정해졌어요 👍'}</div>
    ${nt?`<div class="banner" style="margin:10px 0 0"><span class="em">${nt.emoji}</span>
      <div><b>${esc(nt.label)}</b><span>평소와 다른 날입니다</span></div></div>`:''}
    <div class="splitline"></div>
    <div class="prow" style="margin:0">${statusRow(date)}</div>
    ${perKid}
    ${open.length ? `<div class="splitline"></div>
      <div class="sublabel">담당 정하기</div>
      ${open.map(it => slotRow(it,date)).join('')}` : ''}
  </div>`;
}
