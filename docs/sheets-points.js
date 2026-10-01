// =====================================================================
//  sheets-points.js — 포인트 내역·통계 (아이 / 보호자 공통 시트)
//
//  point_ledger 를 «한 달 단위» 로 따로 읽어옵니다. 12초마다 도는 자동 동기화에
//  내역 전체를 실으면 무거워지고, 서버 기본 조회 한도(1000행)에도 걸리기 때문입니다.
//  DB 변경은 필요 없습니다 (적립·사용 이유와 날짜는 이미 쌓이고 있습니다).
// =====================================================================
import {
  sb, D, WD, esc, isKid, M, emojiOf, mdLabel, wdOf, ymd, parseYmd, addDays,
} from './core.js';
import { $, openSheet } from './ui.js';
import { setReopen } from './sync.js';

const KIND = {
  task:   { em:'📝', label:'숙제',   short:'숙제' },
  attend: { em:'🏫', label:'출석',   short:'출석' },
  bonus:  { em:'🏅', label:'하루 완료 보너스', short:'보너스' },
  reward: { em:'🎁', label:'보상 교환' },
};
const cur = { cid:null, off:0 };
const MIN_OFF = -24;                       // 최대 2년 전까지

const monthStart = off => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth() + off, 1); };

/* 이 기록이 «어느 날» 것인지.
   적립은 그 일이 있었던 날(on_date)이고, 보상 교환은 승인한 날입니다.
   보상 행의 on_date 는 서버(UTC) 날짜라 한국 새벽에는 하루 어긋나서 created_at 을 씁니다. */
const dayOf = l => l.ref_type === 'reward'
  ? ymd(new Date(l.created_at))
  : (l.on_date || ymd(new Date(l.created_at)));

const plain = reason => String(reason || '').replace(/^(숙제|출석):\s*/, '');
const sum   = rows => rows.reduce((s, l) => s + l.delta, 0);

async function loadMonth(cid, off){
  const f = monthStart(off);
  const first = ymd(f);
  const last  = ymd(new Date(f.getFullYear(), f.getMonth() + 1, 0));
  // 날짜 경계 보정을 위해 앞뒤 하루씩 넓게 읽고, 아래에서 정확히 거릅니다
  const { data, error } = await sb.from('point_ledger')
    .select('id,delta,reason,ref_type,on_date,created_at')
    .eq('child_id', cid)
    .gte('on_date', ymd(addDays(f, -1)))
    .lte('on_date', ymd(addDays(parseYmd(last), 1)))
    .order('created_at', { ascending:false });
  if(error) throw error;
  return { first, last,
    rows: (data || []).map(l => ({ ...l, day: dayOf(l) })).filter(l => l.day >= first && l.day <= last) };
}

/* ---------------- 그리기 ---------------- */
function summary(rows, cid){
  const earn  = rows.filter(l => l.delta > 0);
  const spent = -sum(rows.filter(l => l.delta < 0));
  const bal   = D.balances[cid] ?? 0;

  // 무엇으로 벌었나
  const by = {};
  earn.forEach(l => { by[l.ref_type] = (by[l.ref_type] || 0) + l.delta; });
  const earned = sum(earn);
  const kinds = ['task','attend','bonus'].filter(k => by[k]).map(k => `
    <div class="pbk"><span>${KIND[k].em} ${KIND[k].short}</span>
      <div class="pbar"><i style="width:${Math.max(4, Math.round(by[k] / earned * 100))}%"></i></div>
      <b>${by[k]}P</b></div>`).join('');

  // 가장 많이 번 것 TOP 3 (숙제·출석만)
  const tally = {};
  earn.filter(l => l.ref_type === 'task' || l.ref_type === 'attend').forEach(l => {
    const t = (tally[plain(l.reason)] ??= { pts:0, n:0 });
    t.pts += l.delta; t.n++;
  });
  const top = Object.entries(tally).sort((a,b) => b[1].pts - a[1].pts).slice(0, 3);

  return `
    <div class="ptsum">
      <div><small>번 포인트</small><b class="plus">+${earned}P</b></div>
      <div><small>쓴 포인트</small><b class="minus">${spent ? '-' + spent : 0}P</b></div>
      <div><small>지금 잔액</small><b>${bal}P</b></div>
    </div>
    ${kinds ? `<h4>무엇으로 모았나</h4>${kinds}` : ''}
    ${top.length ? `<h4>가장 많이 모은 것</h4>${top.map(([name, t], i) => `
      <div class="mrow"><div class="ic">${['🥇','🥈','🥉'][i]}</div>
        <div class="mx"><b>${esc(name)}</b><span>${t.n}번 · ${t.pts}P</span></div></div>`).join('')}` : ''}`;
}

/* 하루하루 얼마나 모았는지 막대로 */
function bars(rows, first, last){
  const per = {};
  rows.filter(l => l.delta > 0).forEach(l => { per[l.day] = (per[l.day] || 0) + l.delta; });
  const days = [];
  for(let d = parseYmd(first); ymd(d) <= last; d = addDays(d, 1)) days.push(ymd(d));
  const max = Math.max(1, ...Object.values(per));
  return `<h4>하루하루</h4>
    <div class="pdays">${days.map(d => `<i title="${mdLabel(d)} ${per[d] || 0}P"
      style="height:${per[d] ? Math.max(8, Math.round(per[d] / max * 100)) : 4}%"
      class="${per[d] ? 'on' : ''}"></i>`).join('')}</div>
    <div class="pdl"><span>1일</span><span>${Number(last.slice(8))}일</span></div>`;
}

function list(rows){
  const g = {};
  rows.forEach(l => (g[l.day] ??= []).push(l));
  return `<h4>내역</h4>` + Object.keys(g).sort().reverse().map(day => {
    const net = sum(g[day]);
    return `<div class="pday"><b>${mdLabel(day)} (${WD[wdOf(day)]})</b>
        <span class="${net < 0 ? 'minus' : 'plus'}">${net > 0 ? '+' : ''}${net}P</span></div>
      ${g[day].map(l => {
        const k = KIND[l.ref_type] || { em:'⭐', label:'' };
        return `<div class="mrow"><div class="ic">${k.em}</div>
          <div class="mx"><b>${esc(plain(l.reason) || k.label)}</b><span>${k.label}</span></div>
          <b class="amt ${l.delta < 0 ? 'minus' : 'plus'}">${l.delta > 0 ? '+' : ''}${l.delta}</b></div>`;
      }).join('')}`;
  }).join('');
}

/* ---------------- 시트 ---------------- */
/** cid 의 포인트 내역을 엽니다. step 이 없으면 이번 달부터, 있으면 달을 옮깁니다 */
export async function sheetPoints(cid, step){
  const c = M(cid);
  if(!c) return;
  if(step === undefined){ cur.cid = cid; cur.off = 0; }
  else if(step === '0')  { cur.off = 0; }
  else                   { cur.off = Math.max(MIN_OFF, Math.min(0, cur.off + Number(step))); }
  const off = cur.off;
  setReopen(null);

  const f = monthStart(off);
  const nav = `
    <div class="seg">
      <button data-act="ptmo" data-v="-1" data-w="${cid}">‹ 지난달</button>
      <button class="${off === 0 ? 'on' : ''}" data-act="ptmo" data-v="0" data-w="${cid}">이번 달</button>
      <button data-act="ptmo" data-v="1" data-w="${cid}"
        style="${off >= 0 ? 'opacity:.35;pointer-events:none' : ''}">다음달 ›</button>
    </div>
    <div class="sectitle" style="margin:4px 2px 8px"><h3>${f.getFullYear()}년 ${f.getMonth() + 1}월</h3></div>`;

  // 시트 제목은 textContent 로 들어가므로 SVG 아바타(avatarOf) 대신 글자용 emojiOf 를 씁니다
  openSheet(`${emojiOf(c)} ${c.name} · 포인트 내역`,
    isKid() ? '이번 달에 포인트를 어떻게 모았는지 볼 수 있어!'
            : '아이가 포인트를 어떻게 모으고 쓰는지 한 달씩 볼 수 있어요.',
    `${nav}<div id="ptwait" class="note" style="padding:18px">불러오는 중… 🐾</div>`);

  try{
    const { first, last, rows } = await loadMonth(cid, off);
    if(!$('ptwait')) return;                       // 그 사이 시트가 닫히거나 다른 시트가 열림
    $('ptwait').outerHTML = rows.length
      ? summary(rows, cid) + bars(rows, first, last) + list(rows)
      : '<div class="note" style="padding:18px">이 달에는 아직 기록이 없어요 🐾</div>';
  }catch(e){
    console.error(e);
    if($('ptwait')) $('ptwait').outerHTML =
      `<div class="note" style="padding:18px;color:var(--danger)">불러오지 못했어요: ${esc(e.message || e)}</div>`;
  }
}
