// =====================================================================
//  sheets-cats.js — 고양이 도감 (아이 / 보호자 공통 시트)
//
//  연속 달성 3·7·14·21·30·50·75·100일을 채우면 새 친구가 옵니다.
//  지급은 서버(09_cat_book.sql 의 트리거)가 하고, 여기서는 보여주기만 합니다.
//  한 번 만난 친구는 연속이 끊겨도 남습니다.
// =====================================================================
import {
  D, TODAY, esc, josa, isKid, M, streakOf, unlockedCats, mdLabel, ymd, addDays, parseYmd,
} from './core.js';
import { CAT_BOOK, catSvg, nextCat } from './cats.js';
import { openSheet } from './ui.js';
import { setReopen } from './sync.js';

export function sheetCats(cid){
  const c = M(cid);
  if(!c) return;
  setReopen(null);

  const kid  = isKid();
  const have = unlockedCats(cid);
  const n    = streakOf(cid);
  const when = Object.fromEntries(D.cats.filter(x => x.child_id === cid).map(x => [x.milestone, x.unlocked_on]));
  const fresh = ymd(addDays(parseYmd(TODAY), -2));            // 최근 이틀 안에 만난 친구는 NEW
  const nx   = nextCat(have, n);

  // 다음 친구까지 얼마나 왔는지 (이전 기준일부터 다음 기준일까지의 구간 안에서)
  let pct = 0;
  if(nx){
    const lower = Math.max(0, ...CAT_BOOK.filter(x => x.days < nx.cat.days).map(x => x.days));
    pct = Math.max(0, Math.min(100, Math.round((n - lower) / (nx.cat.days - lower) * 100)));
  }

  const nextLine = !nx
    ? (kid ? '고양이 친구를 다 만났어! 🎉' : '모든 고양이 친구를 만났어요 🎉')
    : kid
      ? `${nx.cat.days}일 연속이면 ${josa(nx.cat.name,'이','가')} 와! ${nx.left ? `${nx.left}일 남았어` : '조금만 더!'}`
      : `${nx.cat.days}일 연속이면 ${josa(nx.cat.name,'이','가')} 와요 · ${nx.left ? `${nx.left}일 남았어요` : '곧 만나요'}`;

  const cards = CAT_BOOK.map(cat => {
    const on = have.has(cat.days);
    const isNew = on && (when[cat.days] || '') >= fresh;
    return `<div class="catcard ${on ? '' : 'lock'}">
      ${isNew ? '<span class="newtag">NEW</span>' : ''}
      <span class="big">${catSvg(cat.style)}</span>
      <b>${on ? esc(cat.name) : '???'}</b>
      <span class="n">${on
        ? `${esc(cat.note)}<br>${when[cat.days] ? mdLabel(when[cat.days]) + ' 에 만났어' + (kid ? '' : '요') : ''}`
        : `${cat.days}일 연속이면 만나${kid ? '' : '요'}`}</span></div>`;
  }).join('');

  // 시트 제목은 textContent 라서 SVG 아바타는 쓸 수 없습니다 (글자 이모지만)
  openSheet(`😻 ${c.name}의 고양이 도감`,
    kid ? '연속으로 다 하면 새 고양이 친구가 와!'
        : '연속 달성을 채울 때마다 새 친구가 와요. 한 번 만난 친구는 연속이 끊겨도 남아요.', `
    <div class="mrow" style="padding-top:0">
      <div class="mx"><b>지금 ${n}일 연속${n ? ' 🐾' : ''}</b><span>${nextLine}</span></div>
      <span class="badge ${have.size === CAT_BOOK.length ? 'done' : 'wait'}">${have.size} / ${CAT_BOOK.length}</span>
    </div>
    ${nx ? `<div class="catprog"><i style="width:${pct}%"></i></div>` : ''}
    <div class="catbook" style="margin-top:14px">${cards}</div>`);
}
