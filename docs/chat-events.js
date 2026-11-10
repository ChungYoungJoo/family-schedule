// =====================================================================
//  chat-events.js — 대화 입력창 이벤트 (보내기 · 쓰던 글 보관)
//
//  · Enter 키를 직접 잡지 않고 <form> 의 submit 으로 처리합니다.
//    한글은 글자를 «조합 중» 에 Enter 가 오기 때문에, keydown 으로 잡으면
//    마지막 글자가 잘려서 보내지거나 두 번 보내집니다. form submit 은 조합이 끝난 뒤에만 옵니다.
//  · 보내기 버튼을 눌러도 입력창 포커스를 잃지 않게 해서 키보드가 닫히지 않습니다.
//  · run() 을 쓰지 않습니다 — run() 은 loadAll 과 화면 전체 렌더를 하므로 입력창이 새로 만들어집니다.
//  · 채팅 탭 이동(chatkid)은 actions.js 의 ACT 표에 있습니다.
// =====================================================================
import { C, sendMessage } from './chat.js';
import { paintChat } from './views-chat.js';

const $ = id => document.getElementById(id);
let sending = false;

function setErr(msg){
  const el = $('chatErr');
  if(!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

async function send(){
  const input = $('chatIn');
  if(!input || sending) return;
  const text = input.value.trim();
  if(!text) return;

  const kidId = C.kid;
  const btn = document.querySelector('#chatForm .csend');
  sending = true;
  if(btn) btn.disabled = true;
  setErr('');

  try{
    await sendMessage(kidId, text);
    C.drafts[kidId] = '';
    const cur = $('chatIn');
    if(cur && C.kid === kidId) cur.value = '';           // 보내는 사이 다른 방으로 옮겼으면 건드리지 않음
    paintChat({ stick: true });
  }catch(e){
    setErr('보내지 못했어요: ' + (e.message || e));      // 쓴 글은 그대로 남겨 둡니다
  }finally{
    sending = false;
    const b = document.querySelector('#chatForm .csend');
    if(b) b.disabled = false;
  }
}

export function bindChat(){
  document.addEventListener('submit', ev => {
    if(ev.target && ev.target.id === 'chatForm'){ ev.preventDefault(); send(); }
  });

  // 쓰던 글은 방별로 보관 — 탭이나 방을 옮겼다 돌아와도 남아 있게
  document.addEventListener('input', ev => {
    if(ev.target && ev.target.id === 'chatIn') C.drafts[C.kid] = ev.target.value;
  });

  // 보내기 버튼을 눌러도 입력창이 포커스를 유지하게 (모바일 키보드가 닫히지 않음)
  document.addEventListener('mousedown', ev => {
    if(ev.target.closest && ev.target.closest('.csend')) ev.preventDefault();
  });
}
