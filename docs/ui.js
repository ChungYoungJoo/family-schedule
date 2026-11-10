// =====================================================================
//  ui.js — 화면 그리기 / 바텀시트 / 토스트 / 로그인·오류 화면
// =====================================================================
import { sb, D, S, esc, isKid, me, setNameFor, avatarOf, TODAY } from './core.js';
import { kidToday, parentToday } from './views-day.js';
import { shopView } from './views-shop.js';
import { weekView, familyView } from './views-week.js';
import { monthView } from './views-month.js';
import { manageView } from './views-manage.js';
import { chatView, chatLive, paintChat, chatOpened } from './views-chat.js';
import { C, unreadTotal } from './chat.js';

export const $ = id => document.getElementById(id);

/* ---------------- 토스트 ---------------- */
let toastTimer;
export function toast(msg, bad){
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast on' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 2200);
}

/* ---------------- 바텀시트 ---------------- */
export function openSheet(title, hint, html){
  $('shTitle').textContent = title;
  $('shHint').textContent  = hint;
  $('shBody').innerHTML    = html;
  $('sheetWrap').classList.add('on');
}
export function closeSheet(){
  $('sheetWrap').classList.remove('on');
  S.extraDay = null;      // 달력에서 열었던 지난 날짜 조회 범위를 원래대로
}
export const sheetOpen = () => $('sheetWrap').classList.contains('on');

/* ---------------- 헤더 ---------------- */
export function paintHeader(){
  const el = $('hdr');
  if(!el) return;
  const u = me();
  const unread = D.notis.filter(n => !n.read_at).length;
  el.innerHTML = `
    <div class="brandrow">
      <div class="brand">우리집 하루 🐾<small>${esc(setNameFor(TODAY))} · ${
        isKid() ? '오늘 할 일 확인하자!' : '가족 스케줄 · 숙제 보드'}</small></div>
      <div class="bell" data-act="notis">🔔${unread?`<b>${unread}</b>`:''}</div>
      ${u ? `<div class="who" ${isKid()?'':'data-act="who"'}>
        <span class="av" style="background:${u.color}22">${avatarOf(u)}</span>${esc(u.name)}${
          isKid()?'':'<span class="chev">▼</span>'}</div>` : ''}
    </div>
    ${S.syncing ? '<div class="syncing"></div>' : ''}`;
}

/* ---------------- 전체 렌더 ---------------- */
export function render(){
  // 대화 탭이 이미 그려져 있으면 화면을 통째로 다시 만들지 않습니다.
  // 12초 폴링마다 입력창이 새로 만들어져 쓰던 글이 지워지기 때문입니다.
  if(S.tab === 'chat' && chatLive()){ paintHeader(); paintChat(); return; }

  // 10_chat.sql 을 실행하지 않은 서버(C.ok === false)에서는 대화 탭을 숨깁니다
  const chatTab = C.ok === false ? [] : [['chat','💬','대화']];
  const tabs = isKid()
    ? [['today','🐱','오늘'],['week','🗓','내 주간'],...chatTab,['shop','🐾','포인트 상점']]
    : [['today','🏠','오늘'],['week','🗓','주간'],['family','🤝','가족일정'],...chatTab,['manage','⚙️','관리']];
  if(!tabs.some(t => t[0] === S.tab)) S.tab = 'today';

  const view = {
    today : isKid() ? kidToday : parentToday,
    week  : S.cal === 'month' ? monthView : weekView,
    shop  : shopView,
    family: familyView,
    chat  : chatView,
    manage: manageView,
  }[S.tab];

  const unread = unreadTotal();
  const badge = k => (k === 'chat' && unread) ? `<em class="nb">${unread > 9 ? '9+' : unread}</em>` : '';

  $('root').innerHTML = `
    <div class="app">
      <header id="hdr"></header>
      <main id="main">${view()}</main>
      <nav>${tabs.map(([k,i,l]) =>
        `<button class="${S.tab===k?'on':''}" data-act="tab" data-v="${k}"><span class="i">${i}</span>${l}${badge(k)}</button>`
      ).join('')}</nav>
    </div>`;
  paintHeader();
  if(S.tab === 'chat') chatOpened();
}

/* ---------------- 로그인 / 오류 화면 ---------------- */
export function screenLogin(err){
  $('root').innerHTML = `
    <div class="center">
      <div class="logo">🐱</div>
      <h1>우리집 하루</h1>
      <p>보호자 계정으로 로그인해 주세요.<br>아이는 전용 링크로 바로 들어옵니다.</p>
      <form class="loginbox" id="lf">
        <input id="em" type="email" placeholder="이메일" autocomplete="username" required>
        <input id="pw" type="password" placeholder="비밀번호" autocomplete="current-password" required>
        ${err ? `<div class="err">${esc(err)}</div>` : ''}
        <button class="btn" type="submit">로그인</button>
      </form>
    </div>`;
  $('lf').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button');
    btn.disabled = true; btn.textContent = '로그인 중…';
    const { error } = await sb.auth.signInWithPassword({
      email: $('em').value.trim(),
      password: $('pw').value,
    });
    if(error) return screenLogin(error.message);
    location.reload();
  };
}

export function screenError(title, msg){
  $('root').innerHTML = `
    <div class="center"><div class="logo">🙀</div><h1>${esc(title)}</h1>
      <p>${esc(msg)}</p>
      <button class="btn" onclick="location.reload()">다시 시도</button></div>`;
}
