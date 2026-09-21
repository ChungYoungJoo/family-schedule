// =====================================================================
//  core.js — 상수 / 유틸 / 전역 상태 / 파생 조회
//  (다른 모듈에 의존하지 않는 가장 아래층)
// =====================================================================

/* ---------------- 상수 ---------------- */
export const WD = ['일','월','화','수','목','금','토'];

export const CAT = {
  school :{color:'#4c6ef5', emoji:'🏫', label:'학교·돌봄'},
  academy:{color:'#f76707', emoji:'📚', label:'학원'},
  sport  :{color:'#2fb344', emoji:'🏃', label:'운동'},
  art    :{color:'#ae3ec9', emoji:'🎨', label:'예체능'},
  etc    :{color:'#868e96', emoji:'📌', label:'기타'},
};

export const STATUS_TYPES = ['출근','재택','정시 퇴근','조기 퇴근','야근','반차','휴가','교육(재택)','교육(출근)','휴무'];
export const SITTER_TYPES = ['근무 09:00~18:00','근무 12:00~18:00','근무 12:00~19:00','근무 14:00~19:00','근무 15:00~20:00','휴무'];
export const HELPFUL = {'정시 퇴근':1,'조기 퇴근':1,'반차':1,'휴가':1,'재택':1,'교육(재택)':1,'휴무':1};
export const BUSY    = {'야근':1,'교육(출근)':1};

export const DAY_NOTES = [
  {key:'closed', em:'🏫', label:'재량휴업일',      cancels:'school'},
  {key:'field',  em:'🚌', label:'현장학습',        cancels:'none'},
  {key:'sick',   em:'🤒', label:'아파서 쉬는 날',  cancels:'all'},
  {key:'family', em:'🎉', label:'가족 일정',       cancels:'none'},
];

export const PRESETS = [
  {em:'🏥', title:'병원 진료',     s:'15:30', e:'16:30', cat:'etc',     pickup:true},
  {em:'🚌', title:'현장학습',      s:'09:00', e:'15:00', cat:'school',  pickup:true},
  {em:'🎂', title:'친구 생일파티', s:'14:00', e:'17:00', cat:'etc',     pickup:true},
  {em:'👵', title:'할머니댁',      s:'13:00', e:'18:00', cat:'etc',     pickup:false},
  {em:'🎉', title:'가족 나들이',   s:'10:00', e:'17:00', cat:'etc',     pickup:false},
  {em:'📖', title:'학원 보충수업', s:'16:00', e:'17:30', cat:'academy', pickup:true},
];

export const SELF = {id:'self', name:'자율', full:'자율 귀가', emoji:'🚶', color:'#868e96'};

/* ---------------- 유틸 ---------------- */
const pad = n => String(n).padStart(2,'0');
export const ymd      = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y,m,dd]=s.split('-').map(Number); return new Date(y, m-1, dd); };
export const addDays  = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
export const mdLabel  = s => { const d=parseYmd(s); return `${d.getMonth()+1}/${d.getDate()}`; };
export const wdOf     = s => parseYmd(s).getDay();
export const hm       = t => (t||'').slice(0,5);
export const toMin    = t => +t.slice(0,2)*60 + +t.slice(3,5);
export const esc      = s => String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// 받침 있으면 a, 없으면 b  (예: josa('엄마','이','가') → '엄마가', josa('소빈','아','야') → '소빈아')
export const josa     = (w,a,b) => w + (((w.charCodeAt(w.length-1)-0xAC00)%28) ? a : b);

/** 문장에 쓸 이름. 짧은 이름(name)과 긴 이름(full_name) 중 하나만 고르고,
 *  같은 말이 겹쳐 들어간 경우 한 번만 남깁니다.
 *    '선생님' + '시터선생님'        → '시터선생님'
 *    '시터선생님 시터선생님'        → '시터선생님'
 *    '시터선생님 선생님'            → '시터선생님' */
// 이름을 끊어 읽는 구분자 (\s 가 못 잡는 폭 없는 공백·중점류까지 포함)
const NAMESEP = /[\s​　·・‧•|/\\,]+/;

/** 같은 말이 붙어서 두 번 나오면 한 번으로 줄입니다.
 *    '시터선생님 시터선생님' · '시터선생님시터선생님' · '선생님 시터선생님' → '시터선생님' */
export function dedupeRepeat(s){
  const out = [];
  for(const w of String(s ?? '').split(NAMESEP).filter(Boolean)){
    const prev = out[out.length-1];
    if(prev && (prev.includes(w) || w.includes(prev))){
      if(w.length > prev.length) out[out.length-1] = w;   // 긴 쪽만 남김
      continue;
    }
    out.push(w);
  }
  const r = out.join(' ');
  const h = r.length / 2;                                  // 구분자 없이 이어 붙은 경우
  return (Number.isInteger(h) && h > 1 && r.slice(0,h) === r.slice(h)) ? r.slice(0,h) : r;
}

export function fullNameOf(p){
  if(!p) return '';
  const short = String(p.name || '').trim();
  const long  = String(p.full_name || p.full || '').trim();
  const nm = !long ? short : !short ? long
           : long.includes(short)  ? long
           : short.includes(long)  ? short
           : long;
  return dedupeRepeat(nm) || short;
}

/** 아이콘 칸(emoji)에 이모지가 아니라 이름 같은 글자가 들어간 경우는 버립니다.
 *  이름 옆에 아이콘으로 붙으면 «시터선생님 시터선생님이 …» 처럼 두 번 나오기 때문입니다. */
export const iconOf = e => {
  const s = String(e ?? '').trim();
  return /[\p{L}\p{N}]/u.test(s) ? '' : s;
};

/* ---------------- Supabase 클라이언트 ---------------- */
export let sb = null;
export function setSb(client){ sb = client; }

/* ---------------- 전역 상태 ---------------- */
export const D = {                 // 서버에서 읽어온 데이터
  family:null, members:[], sets:[], periods:[], routines:[], tasks:[],
  notes:{}, cancels:new Set(), extras:[], pickups:{},
  weekly:{}, dayst:{}, taskLogs:new Set(), attLogs:new Set(),
  balances:{}, weekEarned:{}, bonusDates:{},   // bonusDates[childId] = Set('YYYY-MM-DD')
  rewards:[], redemptions:[], suggests:[], notis:[],
};

export const S = {                 // 화면 상태
  mode:'parent', tab:'today', meId:null, weekWho:'all',
  editSet:null, ovrChild:null, weekOffset:0, syncing:false,
};

export const TODAY    = ymd(new Date());
export const TOMORROW = ymd(addDays(new Date(), 1));
export const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay()+6)%7) + S.weekOffset*7);
  return ymd(d);
};
export const weekDays = () => {
  const m = parseYmd(weekStart());
  return [0,1,2,3,4,5,6].map(i => ymd(addDays(m,i)));
};

/* ---------------- 파생 조회 ---------------- */
export const M       = id => D.members.find(m => m.id === id) || null;
export const A       = id => id === 'self' ? SELF : M(id);
export const me      = () => M(S.meId);
export const isKid   = () => S.mode === 'kid';
export const kids    = () => D.members.filter(m => m.kind === 'child');
export const pickers = () => [...D.members.filter(m => m.can_pickup), SELF];

export function setIdFor(date){
  const p = D.periods.find(p => date >= p.starts_on && date <= p.ends_on);
  return p ? p.set_id : (D.sets[0]?.id ?? null);
}
export const setNameFor = date => {
  const s = D.sets.find(s => s.id === setIdFor(date));
  return s ? `${s.emoji} ${s.name}` : '';
};

// 그 날짜의 실제 일정 = 요일 반복 − 그날 취소 + 그날만 추가
export function dayItems(childId, date){
  const sid = setIdFor(date), wd = wdOf(date);
  const base = D.routines
    .filter(r => r.set_id === sid && r.child_id === childId && r.weekday === wd)
    .map(r => ({ ...r, kind:'routine', off: D.cancels.has(r.id+'|'+date) }));
  const ex = D.extras
    .filter(e => e.child_id === childId && e.on_date === date)
    .map(e => ({ ...e, kind:'extra', extra:true }));
  return [...base, ...ex].sort((a,b) => toMin(a.starts_at) - toMin(b.starts_at));
}
export const liveItems = (cid,date) => dayItems(cid,date).filter(x => !x.off);

export const pkey      = (it,date) => `${it.kind}:${it.id}|${date}`;
export const pickupRow = (it,date) => D.pickups[pkey(it,date)] || null;

export function pickupOf(it, date){
  const row = pickupRow(it,date);
  if(row) return row.is_self ? 'self' : (row.assignee_id || null);
  if(it.kind === 'routine') return it.default_is_self ? 'self' : (it.default_pickup_id || null);
  return null;
}
export const defaultPickup = it =>
  it.kind === 'routine' ? (it.default_is_self ? 'self' : (it.default_pickup_id || null)) : null;

export const slotsOn = date => kids().flatMap(c => liveItems(c.id,date)).filter(x => x.needs_pickup);
export const openOn  = date => slotsOn(date).filter(x => !pickupOf(x,date));

export const tasksOn = (cid,date) => {
  const sid = setIdFor(date), wd = wdOf(date);
  return D.tasks
    .filter(t => t.set_id===sid && t.child_id===cid && !t.archived
      && (t.weekdays === null || (t.weekdays||[]).includes(wd)))
    .sort((a,b) => a.sort_order - b.sort_order);
};

// 숙제와 준비물을 나눠 보고 싶을 때
export const homeworkOn = (cid,date) => tasksOn(cid,date).filter(t => (t.kind||'homework') === 'homework');
export const suppliesOn = (cid,date) => tasksOn(cid,date).filter(t => t.kind === 'supply');

export const taskDone  = (t,date)  => D.taskLogs.has(t.id+'|'+date);
export const attDone   = (it,date) => D.attLogs.has(pkey(it,date));
export const checkable = it => it.category !== 'school' && it.category !== 'etc';

export function progress(cid, date){
  const ts = tasksOn(cid,date), rs = liveItems(cid,date).filter(checkable);
  const done  = ts.filter(t => taskDone(t,date)).length + rs.filter(r => attDone(r,date)).length;
  const total = ts.length + rs.length;
  return { done, total, pct: total ? Math.round(done/total*100) : 0 };
}

export function statusOf(mid, date){
  return D.dayst[mid+'|'+date] ?? D.weekly[mid+'|'+wdOf(date)] ?? '출근';
}

export const noteOn          = date => D.notes[date] || null;
export const pendingRedeems  = () => D.redemptions.filter(r => r.status === 'pending');
export const pendingSuggests = () => D.suggests.filter(s => s.status === 'pending');

/* ---------------- 연속 달성 ---------------- */
// 그날 할 일이 하나라도 있었는지 (지난 날짜는 취소·추가 예외를 빼고 대략만 계산)
function dueCount(cid, date){
  const sid = setIdFor(date), wd = wdOf(date);
  const t = D.tasks.filter(x => x.set_id===sid && x.child_id===cid && !x.archived
    && (x.weekdays === null || (x.weekdays||[]).includes(wd))).length;
  const r = D.routines.filter(x => x.set_id===sid && x.child_id===cid && x.weekday===wd
    && checkable(x)).length;
  return t + r;
}

const gotBonus = (cid, date) => !!D.bonusDates[cid]?.has(date);

/** 오늘(또는 어제)부터 거슬러 올라가며 "다 한 날"이 며칠 이어졌는지.
 *  할 일이 없던 날(주말 등)은 끊지 않고 건너뜁니다. */
export function streakOf(cid){
  let d = parseYmd(TODAY);
  // 오늘은 아직 진행 중일 수 있으니, 아직 못 받았으면 어제부터 셉니다
  if(!gotBonus(cid, TODAY)) d = addDays(d, -1);
  let n = 0;
  for(let i = 0; i < 90; i++){
    const key = ymd(d);
    if(dueCount(cid, key) === 0){ d = addDays(d, -1); continue; }  // 할 일 없던 날은 통과
    if(!gotBonus(cid, key)) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** 이번 주 월~일 도장판 */
export function weekStamps(cid){
  return weekDays().map(date => ({
    date,
    due:  dueCount(cid, date) > 0,
    done: gotBonus(cid, date),
    future: date > TODAY,
  }));
}
