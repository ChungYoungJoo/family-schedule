// =====================================================================
//  views-chat.js — 대화 탭 화면
//
//  ★ 화면을 통째로 다시 그리지 않는 유일한 탭입니다.
//    이 앱은 12초 폴링마다 render() 가 #root 를 새로 만드는데, 입력창이 있으면
//    쓰던 글이 지워집니다. 그래서 ui.js 의 render() 는 대화 탭이 «이미 그려져 있으면»
//    (chatLive) paintChat() 만 불러 메시지 목록·배지만 고칩니다.
//
//  ui.js 가 이 파일을 가져오므로, 여기서는 ui.js 를 가져오지 않습니다 (순환 방지).
//  → 토스트 대신 입력창 위 오류 줄(#chatErr)을 씁니다.
// =====================================================================
import { S, WD, M, esc, josa, me, kids, isKid, avatarOf, localHm, ymd, addDays, parseYmd } from './core.js';
import { C, currentKid, unreadTotal, loadThread, pollThread, markRead } from './chat.js';

const $ = id => document.getElementById(id);

/* ---------------- 조각 ---------------- */
function dayLabel(d){
  const today = ymd(new Date()), yest = ymd(addDays(new Date(), -1));
  if(d === today) return '오늘';
  if(d === yest)  return '어제';
  const x = parseYmd(d);
  return `${x.getMonth()+1}월 ${x.getDate()}일 (${WD[x.getDay()]})`;
}

function switchInner(){
  return kids().map(c => `<button class="${C.kid===c.id?'on':''}" data-act="chatkid" data-v="${c.id}">
    ${avatarOf(c)} ${esc(c.name)}${C.unread[c.id] ? `<i class="cdot">${C.unread[c.id]}</i>` : ''}</button>`).join('');
}

function listHtml(kidId){
  const t = C.threads[kidId];
  if(!t) return '<div class="cempty">불러오는 중…</div>';
  if(t.err && !t.msgs.length){
    return `<div class="cempty">대화를 불러오지 못했어요<br><small>${esc(t.err)}</small></div>`;
  }
  if(!t.msgs.length){
    return `<div class="cempty">${isKid()
      ? '🐾 아직 대화가 없어.<br>먼저 말을 걸어봐!'
      : '아직 대화가 없어요.<br>먼저 말을 걸어 보세요.'}</div>`;
  }

  let html = '', prevDay = '', prevSender = null;
  t.msgs.forEach((m, i) => {
    const day = ymd(new Date(m.created_at));
    if(day !== prevDay){ html += `<div class="cday">${dayLabel(day)}</div>`; prevDay = day; prevSender = null; }

    const mine  = m.sender_id === S.meId;
    const who   = M(m.sender_id);
    const first = m.sender_id !== prevSender;           // 같은 사람이 이어 쓴 글은 첫 줄에만 이름·얼굴
    const next  = t.msgs[i+1];
    const lastOfRun = !next || next.sender_id !== m.sender_id
      || ymd(new Date(next.created_at)) !== day
      || localHm(next.created_at) !== localHm(m.created_at);   // 같은 분의 연속 글은 마지막에만 시각
    prevSender = m.sender_id;

    html += `<div class="cmsg ${mine?'mine':'other'} ${first?'':'cont'}">
      ${mine ? '' : `<div class="cav ${first?'':'sp'}" style="background:${who?.color||'#999'}22">${first ? avatarOf(who) : ''}</div>`}
      <div class="cbody">
        ${!mine && first ? `<div class="cname">${esc(who?.name || '')}</div>` : ''}
        <div class="crow"><div class="cbub">${esc(m.body)}</div>
          ${lastOfRun ? `<span class="ctime">${localHm(m.created_at)}</span>` : ''}</div>
      </div></div>`;
  });
  return html;
}

/* 방 바꾸는 버튼의 숫자 + 하단 탭의 숫자.
 * 대화 탭에서는 render() 가 화면을 다시 만들지 않으므로 탭바도 여기서 직접 고칩니다. */
function paintBadges(){
  const sw = $('chatSwitch');
  if(sw) sw.innerHTML = switchInner();

  const tab = document.querySelector('nav button[data-v="chat"]');
  if(tab){
    const old = tab.querySelector('.nb');
    if(old) old.remove();
    const n = unreadTotal();
    if(n) tab.insertAdjacentHTML('beforeend', `<em class="nb">${n > 9 ? '9+' : n}</em>`);
  }
}

const scrollDown = () => window.scrollTo(0, document.documentElement.scrollHeight);
const nearBottom = () => document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 160;

/* ---------------- 탭 전체 ---------------- */
export function chatView(){
  const kidId = (C.kid = currentKid());
  const kid = M(kidId);
  if(!kid) return '<div class="note" style="padding:30px">대화할 아이가 아직 없어요</div>';

  const head = isKid()
    ? { title:'💬 엄마·아빠와 대화', sub:'여기 쓴 글은 엄마·아빠만 볼 수 있어 🐾' }
    : { title:`💬 ${esc(josa(kid.name,'과','와'))}의 대화`,
        sub:`${esc(josa(kid.name,'과','와'))} 보호자만 볼 수 있어요 · ${esc(me()?.name || '')}(으)로 보내요` };
  const t = C.threads[kidId];

  return `<div class="chatwrap">
    <div class="chathead"><b>${head.title}</b><span>${head.sub}</span></div>
    ${isKid() ? '' : `<div class="seg" id="chatSwitch">${switchInner()}</div>`}
    <div class="chat" id="chatList" data-kid="${kidId}" data-me="${S.meId || ''}"
      data-sig="${t ? t.msgs.length + ':' + (t.msgs[t.msgs.length-1]?.id || '') : 'load'}">${listHtml(kidId)}</div>
    <div class="cbar">
      <div class="cerr" id="chatErr" hidden></div>
      <form class="cform" id="chatForm" autocomplete="off">
        <input id="chatIn" type="text" maxlength="500" enterkeyhint="send" autocomplete="off"
          placeholder="메시지 쓰기" value="${esc(C.drafts[kidId] || '')}">
        <button class="csend" type="submit">보내기</button>
      </form>
    </div></div>`;
}

/** 이미 그려진 대화 화면이 «지금 보려는 방, 지금 보는 사람» 과 같은지 */
export function chatLive(){
  const l = $('chatList');
  return !!l && l.dataset.kid === currentKid() && l.dataset.me === (S.meId || '');
}

/** 메시지 목록·배지만 고칩니다. 입력창은 건드리지 않으므로 쓰던 글이 남습니다. */
export function paintChat(opts = {}){
  const l = $('chatList');
  if(!l) return;
  const kidId = l.dataset.kid, t = C.threads[kidId];
  const sig = t ? (t.msgs.length + ':' + (t.msgs[t.msgs.length-1]?.id || '')) : 'load';

  if(l.dataset.sig !== sig || opts.force){
    const stick = opts.stick || nearBottom();           // 위로 올려 읽는 중이면 끌어내리지 않음
    l.innerHTML = listHtml(kidId);
    l.dataset.sig = sig;
    if(stick) scrollDown();
  }

  paintBadges();

  // 보고 있는 방의 메시지는 읽음 처리 (화면이 켜져 있을 때만)
  if(document.visibilityState === 'visible'){
    markRead(kidId).then(paintBadges);
  }
}

/* ---------------- 열기 / 새 글 가져오기 ---------------- */
async function fetchLatest(kidId){
  const t = C.threads[kidId];
  try{
    if(!t || t.err) await loadThread(kidId);
    else await pollThread(kidId);
  }catch(e){
    const msg = e.message || String(e);
    if(!t) C.threads[kidId] = { msgs: [], cursor: null, err: msg };
    else if(!t.msgs.length) t.err = msg;
    // 이미 대화가 보이는 중이면 조용히 다음 기회에 다시 시도합니다
  }
}

/** 대화 탭을 방금 그렸을 때 (ui.js 의 render 가 부름) */
export async function chatOpened(){
  const kidId = C.kid;
  scrollDown();                                         // 캐시된 내용이 있으면 일단 맨 아래로
  await fetchLatest(kidId);
  if(S.tab === 'chat' && C.kid === kidId) paintChat({ force: true, stick: true });
}

/** 4초마다 (app.js). 대화 탭이 열려 있고 화면이 보일 때만 움직입니다. */
let ticking = false;
export async function chatTick(){
  if(ticking || S.tab !== 'chat' || document.visibilityState !== 'visible' || !chatLive()) return;
  ticking = true;
  try{ await fetchLatest(C.kid); }
  finally{ ticking = false; }
  if(S.tab === 'chat' && chatLive()) paintChat();
}
