// =====================================================================
//  chat.js — 부모 ↔ 아이 대화 데이터   (화면은 views-chat.js)
//
//  · 대화방은 아이 한 명당 하나 (엄마·아빠·그 아이). 아이끼리는 서로의 방을 못 봄 (서버 RLS)
//  · 새 메시지는 폴링: 대화 탭이 열려 있을 때만 4초마다 (views-chat.js 의 chatTick)
//  · 안 읽은 개수는 서버 RPC chat_unread() 가 셈 — loadAll 의 12초 폴링에 실려 옴
//  · 10_chat.sql 을 아직 실행하지 않았으면 C.ok=false → «대화» 탭이 숨겨짐
//  · core.js 만 가져옴 (화면·시트를 건드리지 않는 데이터 층)
// =====================================================================
import { sb, S, isKid, kids } from './core.js';

const COLS = 'id,child_id,sender_id,body,created_at';
const PAGE = 100;

export const C = {
  ok: null,         // null = 아직 모름 / true = 사용 가능 / false = SQL 미실행
  kid: null,        // 지금 열려 있는 방 (아이 id)
  threads: {},      // 아이 id → { msgs:[], cursor:string|null, err:string|null }
  unread: {},       // 아이 id → 안 읽은 개수
  drafts: {},       // 아이 id → 쓰다 만 글 (탭·방을 옮겨도 남김)
  readUpto: {},     // 아이 id → 마지막으로 서버에 «여기까지 읽음» 보낸 시각
};

/* 지금 보여줄 방: 아이는 자기 방, 보호자는 고른 방(없으면 안 읽은 방 → 첫째) */
export function currentKid(){
  if(isKid()) return S.meId;
  const ids = kids().map(c => c.id);
  if(C.kid && ids.includes(C.kid)) return C.kid;
  return ids.find(id => C.unread[id] > 0) || ids[0] || null;
}

export const unreadTotal = () => isKid()
  ? (C.unread[S.meId] || 0)
  : kids().reduce((a, c) => a + (C.unread[c.id] || 0), 0);

/* ---------------- 안 읽은 개수 ---------------- */
// RPC 가 아직 없다는 오류인지 (10_chat.sql 미실행)
const isMissing = e => e && (e.code === 'PGRST202' || e.code === '42883' || e.status === 404
  || /could not find the function|does not exist/i.test(e.message || ''));

/** 절대 던지지 않습니다 — 대화 쪽 문제로 앱 전체가 멈추면 안 되므로 */
export async function refreshUnread(){
  if(!S.meId) return;
  try{
    const { data, error } = await sb.rpc('chat_unread', { p_as: S.meId });
    if(error){ if(isMissing(error)) C.ok = false; return; }
    C.ok = true;
    C.unread = {};
    (data || []).forEach(r => { C.unread[r.thread] = r.unread; });
  }catch(e){ /* 네트워크 오류는 다음 폴링에서 다시 */ }
}

/* ---------------- 메시지 읽기 ---------------- */
const cmp = (a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;

// id 로 겹침을 거르며 합칩니다. 새로 들어온 것만 돌려줍니다.
function merge(t, rows){
  const seen = new Set(t.msgs.map(m => m.id));
  const add = rows.filter(r => !seen.has(r.id));
  if(add.length){ t.msgs.push(...add); t.msgs.sort(cmp); }
  return add;
}

/** 방을 처음 열 때: 가장 최근 100개 */
export async function loadThread(childId){
  const { data, error } = await sb.from('chat_messages').select(COLS)
    .eq('child_id', childId).order('created_at', { ascending: false }).limit(PAGE);
  if(error) throw error;
  const msgs = (data || []).reverse();
  C.threads[childId] = { msgs, cursor: msgs.length ? msgs[msgs.length-1].created_at : null, err: null };
}

/** 이미 연 방에서 새 것만 가져오기 */
export async function pollThread(childId){
  const t = C.threads[childId];
  if(!t) return loadThread(childId);

  let q = sb.from('chat_messages').select(COLS).eq('child_id', childId)
    .order('created_at', { ascending: true }).limit(PAGE);
  if(t.cursor) q = q.gt('created_at', t.cursor);

  const { data, error } = await q;
  if(error) throw error;
  if(data && data.length) t.cursor = data[data.length-1].created_at;   // 커서는 «가져온 것» 으로만 움직임
  return merge(t, data || []);
}

/* ---------------- 보내기 ---------------- */
export async function sendMessage(childId, text){
  const { data, error } = await sb.from('chat_messages')
    .insert({ child_id: childId, sender_id: S.meId, body: text })
    .select(COLS).single();
  if(error) throw error;

  // 내가 보낸 글은 화면에만 바로 올리고 커서는 건드리지 않습니다.
  // (커서를 옮기면, 바로 직전에 상대가 보낸 글을 영영 못 가져옵니다)
  const t = C.threads[childId] || (C.threads[childId] = { msgs: [], cursor: null, err: null });
  merge(t, [data]);
  return data;
}

/* ---------------- 읽음 표시 ---------------- */
/** 화면에 보여준 마지막 메시지까지 읽음 처리. 같은 시점이면 다시 보내지 않습니다. */
export async function markRead(childId){
  const t = C.threads[childId];
  if(!t || !t.msgs.length) return;
  const upto = t.msgs[t.msgs.length - 1].created_at;
  if(C.readUpto[childId] === upto) return;
  C.readUpto[childId] = upto;
  try{
    const { error } = await sb.rpc('chat_mark_read', { p_child: childId, p_upto: upto, p_as: S.meId });
    if(error){ C.readUpto[childId] = null; return; }
    C.unread[childId] = 0;
  }catch(e){ C.readUpto[childId] = null; }
}
