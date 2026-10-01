// =====================================================================
//  views-shop.js — 아이: 포인트 상점
//  (views-day.js 가 20KB 에 닿아 분리)
// =====================================================================
import { D, me, esc, unlockedCats } from './core.js';
import { CAT_BOOK } from './cats.js';

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
    <div class="catpeek">${catFace}</div>
    <div class="lbl">${esc(c.name)}의 포인트</div>
    <div class="val">${bal}<small>P</small></div>
    <div class="meta"><span>이번 주 +${D.weekEarned[c.id] ?? 0}P</span>
      <span>교환 ${my.filter(r=>r.status==='approved').length}회</span></div>
  </div>
  <div class="opt-grid" style="margin-top:12px">
    <div class="opt" data-act="ptlog" data-v="${c.id}">📜 포인트 내역</div>
    <div class="opt" data-act="catbook" data-v="${c.id}">😻 고양이 도감
      <br><span style="font-size:11px;color:var(--ink-3);font-weight:700">${unlockedCats(c.id).size} / ${CAT_BOOK.length} 마리</span></div>
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
