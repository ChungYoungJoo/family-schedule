// =====================================================================
//  ui.js — 화면 그리기 / 바텀시트 / 토스트 / 로그인·오류 화면
// =====================================================================
import { sb, D, S, esc, isKid, me, setNameFor, TODAY } from './core.js';
import { kidToday, shopView, parentToday } from './views-day.js';
import { weekView, familyView } from './views-week.js';
import { manageView } from './views-manage.js';

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
export function closeSheet(){ $('sheetWrap').classList.remove('on'); }
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
        <span class="av" style="background:${u.color}22">${u.emoji}</span>${esc(u.name)}${
          isKid()?'':'<span class="chev">▼</span>'}</div>` : ''}
    </div>
    ${S.syncing ? '<div class="syncing"></div>' : ''}`;
}

/* ---------------- 전체 렌더 ---------------- */
export function render(){
  const tabs = isKid()
    ? [['today','🐱','오늘'],['week','🗓','내 주간'],['shop','🐾','포인트 상점']]
    : [['today','🏠','오늘'],['week','🗓','주간'],['family','🤝','가족일정'],['manage','⚙️','관리']];
  if(!tabs.some(t => t[0] === S.tab)) S.tab = 'today';

  const view = {
    today : isKid() ? kidToday : parentToday,
    week  : weekView,
    shop  : shopView,
    family: familyView,
    manage: manageView,
  }[S.tab];

  $('root').innerHTML = `
    <div class="app">
      <header id="hdr"></header>
      <main id="main">${view()}</main>
      <nav>${tabs.map(([k,i,l]) =>
        `<button class="${S.tab===k?'on':''}" data-act="tab" data-v="${k}"><span class="i">${i}</span>${l}</button>`
      ).join('')}</nav>
    </div>`;
  paintHeader();
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
