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

// rest:true = 숙제·준비물까지 쉬고, 연속 달성 🔥 도 끊기지 않는 날
export const DAY_NOTES = [
  {key:'holiday',em:'🎌', label:'공휴일·쉬는 날',  cancels:'all',    rest:true},
  {key:'closed', em:'🏫', label:'재량휴업일',      cancels:'school'},
  {key:'field',  em:'🚌', label:'현장학습',        cancels:'none'},
  {key:'sick',   em:'🤒', label:'아파서 쉬는 날',  cancels:'all',    rest:true},
  {key:'family', em:'🎉', label:'가족 일정',       cancels:'none'},
];
export const REST_KEYS = new Set(DAY_NOTES.filter(n => n.rest).map(n => n.key));
export const noteDef   = key => DAY_NOTES.find(n => n.key === key) || null;

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
// 받침 있으면 a, 없으면 b.  ※ 조사만이 아니라 "이름+조사" 를 돌려줍니다.
//   josa('엄마','이','가') → '엄마가'   josa('소빈','아','야') → '소빈아'
//   그러니 `${name}${josa(name,…)}` 처럼 쓰면 이름이 두 번 나옵니다.
export const josa     = (w,a,b) => w + (((w.charCodeAt(w.length-1)-0xAC00)%28) ? a : b);

/* ---------------- 고양이 아바타 ----------------
 *  이모지로는 «치즈냥 / 회색냥» 을 구분할 수 없어서 작은 그림을 직접 그립니다.
 *  members.emoji 에 'cat:cheese' 또는 'cat:grey' 를 넣으면 이 그림이 나옵니다.
 *  그림은 1em 크기라서 이모지가 있던 자리에 그대로 들어갑니다.            */
const CAT_STYLES = {
  cheese:{fur:'#f0a441', dark:'#cf7a22', face:'#fff1db', ear:'#f3b3a4'},  // 치즈냥
  grey:  {fur:'#a7b3bd', dark:'#84919d', face:'#ffffff', ear:'#eeb9b0'},  // 회색·흰색냥
};
const catKey = m => {
  const e = String(m?.emoji || '');
  const k = e.startsWith('cat:') ? e.slice(4) : '';
  return CAT_STYLES[k] ? k : null;
};

/** 글자만 넣을 수 있는 자리(시트 제목 등)에서 쓸 대체 이모지 */
export const emojiOf = m => catKey(m) ? '🐱' : (m?.emoji || '');

/** HTML 자리용 — 고양이면 그림, 아니면 원래 이모지 그대로 */
export function avatarOf(m){
  const k = catKey(m);
  if(!k) return m?.emoji || '';
  const s = CAT_STYLES[k];
  return `<svg class="catav" viewBox="0 0 32 32" aria-hidden="true">`
    + `<path d="M6.5 13 8 4l7 5.2z" fill="${s.fur}"/>`
    + `<path d="M25.5 13 24 4l-7 5.2z" fill="${s.fur}"/>`
    + `<path d="M9 11.6 9.9 6.8l3.5 2.6z" fill="${s.ear}"/>`
    + `<path d="M23 11.6 22.1 6.8l-3.5 2.6z" fill="${s.ear}"/>`
    + `<ellipse cx="16" cy="18.4" rx="11" ry="9.4" fill="${s.fur}"/>`
    + `<path d="M16 9.4v4.4M11.4 10.8l1.5 3.6M20.6 10.8l-1.5 3.6" stroke="${s.dark}"`
    + ` stroke-width="1.7" stroke-linecap="round" fill="none"/>`
    + `<ellipse cx="16" cy="21.8" rx="7.1" ry="5.1" fill="${s.face}"/>`
    + `<ellipse cx="11.9" cy="17.4" rx="1.7" ry="2.2" fill="#3b2f28"/>`
    + `<ellipse cx="20.1" cy="17.4" rx="1.7" ry="2.2" fill="#3b2f28"/>`
    + `<path d="M16 20.4l-1.5 1.2h3z" fill="#e2857e"/>`
    + `<path d="M16 21.8v1.1M16 22.9c-1.2 0-1.9-.7-1.9-1.5M16 22.9c1.2 0 1.9-.7 1.9-1.5"`
    + ` stroke="#3b2f28" stroke-width="1" stroke-linecap="round" fill="none"/>`
    + `</svg>`;
}

/* ---------------- Supabase 클라이언트 ---------------- */
export let sb = null;
export function setSb(client){ sb = client; }

/* ---------------- 전역 상태 ---------------- */
export const D = {                 // 서버에서 읽어온 데이터
  family:null, members:[], sets:[], periods:[], routines:[], tasks:[],
  notes:{}, cancels:new Set(), taskCancels:new Set(), extras:[], pickups:{},
  restDays:new Set(), restList:[],   // 쉬는 날 (연속 달성 계산·관리 화면용, 넓은 기간)
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

// 그 날짜의 숙제·준비물 (그날만 쉬기로 한 것은 off 로 표시)
export function dayTasks(cid, date){
  const sid = setIdFor(date), wd = wdOf(date);
  return D.tasks
    .filter(t => t.set_id===sid && t.child_id===cid && !t.archived
      && (t.weekdays === null || (t.weekdays||[]).includes(wd)))
    .map(t => ({ ...t, off: D.taskCancels.has(t.id+'|'+date) }))
    .sort((a,b) => a.sort_order - b.sort_order);
}
export const tasksOn = (cid,date) => dayTasks(cid,date).filter(t => !t.off);

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

/** 어른(보호자·선생님)의 그날 일정.
 *  날짜별 값(day_status) > 쉬는 날이면 휴무 > 요일 기본값 > 출근
 *  공휴일에도 출근하는 사람은 그 날짜만 직접 바꾸면 됩니다 (day_status 가 이깁니다). */
export function statusOf(mid, date){
  const day = D.dayst[mid+'|'+date];
  if(day !== undefined) return day;
  if(D.restDays.has(date)) return '휴무';
  return D.weekly[mid+'|'+wdOf(date)] ?? '출근';
}
// 요일 기본 일정이 하나라도 등록된 사람인지.
// 가끔 픽업만 도와주는 사람은 «어른들 일정» 줄에 넣지 않습니다.
export const hasWeekly = mid => Object.keys(D.weekly).some(k => k.startsWith(mid + '|'));

export const noteOn          = date => D.notes[date] || null;
// 학교·학원·숙제를 통째로 쉬는 날 (공휴일, 아파서 쉬는 날)
export const isRest          = date => D.restDays.has(date);

/** 앞으로의 쉬는 날을 연속된 기간끼리 묶습니다 (관리 화면용) */
export function restGroups(){
  const groups = [];
  (D.restList || []).filter(n => n.on_date >= TODAY).forEach(n => {
    const g = groups[groups.length-1];
    if(g && g.label === n.label && ymd(addDays(parseYmd(g.to), 1)) === n.on_date){ g.to = n.on_date; return; }
    groups.push({ label:n.label, emoji:n.emoji || '🎌', from:n.on_date, to:n.on_date });
  });
  return groups;
}
export const restRange = g => `${mdLabel(g.from)}${g.from === g.to ? '' : ` ~ ${mdLabel(g.to)}`}`;
export const pendingRedeems  = () => D.redemptions.filter(r => r.status === 'pending');
export const pendingSuggests = () => D.suggests.filter(s => s.status === 'pending');

/* ---------------- 연속 달성 ---------------- */
// 그날 할 일이 하나라도 있었는지 (지난 날짜는 취소·추가 예외를 빼고 대략만 계산)
function dueCount(cid, date){
  if(D.restDays.has(date)) return 0;   // 쉬는 날은 할 일이 없던 날로 봅니다
  const sid = setIdFor(date), wd = wdOf(date);
  const t = D.tasks.filter(x => x.set_id===sid && x.child_id===cid && !x.archived
    && (x.weekdays === null || (x.weekdays||[]).includes(wd))).length;
  const r = D.routines.filter(x => x.set_id===sid && x.child_id===cid && x.weekday===wd
    && checkable(x)).length;
  return t + r;
}

const gotBonus = (cid, date) => !!D.bonusDates[cid]?.has(date);

/** 오늘(또는 어제)부터 거슬러 올라가며 "다 한 날"이 며칠 이어졌는지.
 *  할 일이 없던 날(주말·공휴일 등)은 끊지 않고 건너뜁니다.
 *  주말이라도 «매일» 숙제가 있으면 할 일이 있는 날이므로 그대로 셉니다. */
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
    rest: D.restDays.has(date),
    future: date > TODAY,
  }));
}
