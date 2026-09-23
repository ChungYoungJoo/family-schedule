// =====================================================================
//  data.js — 서버에서 한 번에 읽어오기
// =====================================================================
import { sb, D, S, isKid, kids, weekDays, setIdFor, REST_KEYS,
         TODAY, TOMORROW, ymd, parseYmd, addDays } from './core.js';

export async function loadAll(){
  const days = weekDays();
  // 다른 주를 보고 있어도 "오늘/내일" 카드가 그려져야 하므로 항상 포함시킵니다
  const from = [days[0], TODAY].sort()[0];
  const to   = [days[6], TOMORROW].sort().pop();
  const inWin = q => q.gte('on_date', from).lte('on_date', to);
  // 연속 달성 계산용 (최근 90일 보너스 기록)
  const ledgerFrom = ymd(addDays(parseYmd(TODAY), -95));
  // 쉬는 날은 연속 달성(과거)과 관리 화면(미래)에 둘 다 필요해서 넓게 읽습니다
  const restTo = ymd(addDays(parseYmd(TODAY), 200));

  // 아이 클라이언트에는 access_token / user_id 컬럼 권한이 없으므로 컬럼을 명시합니다.
  const memberCols = isKid()
    ? 'id,family_id,kind,name,full_name,descr,color,emoji,can_pickup,sort_order'
    : '*';

  const res = await Promise.all([
    sb.from('families').select('*').limit(1).maybeSingle(),
    sb.from('members').select(memberCols).order('sort_order'),
    sb.from('schedule_sets').select('*').order('sort_order'),
    sb.from('set_periods').select('*').order('starts_on'),
    sb.from('routines').select('*'),
    sb.from('tasks').select('*').eq('archived', false),
    inWin(sb.from('date_notes').select('*')),
    inWin(sb.from('routine_cancels').select('*')),
    inWin(sb.from('extra_events').select('*')),
    inWin(sb.from('pickups').select('*')),
    sb.from('weekly_status').select('*'),
    inWin(sb.from('day_status').select('*')),
    inWin(sb.from('task_logs').select('*')),
    inWin(sb.from('attendance_logs').select('*')),
    sb.from('child_balances').select('*'),
    sb.from('rewards').select('*').eq('archived', false).order('sort_order'),
    sb.from('redemptions').select('*').order('requested_at', {ascending:false}).limit(40),
    sb.from('notifications').select('*').order('created_at', {ascending:false}).limit(40),
    sb.from('point_ledger').select('child_id,delta,on_date,ref_type').gte('on_date', ledgerFrom),
    sb.from('date_notes').select('on_date,note_key,emoji,label').gte('on_date', ledgerFrom).lte('on_date', restTo),
    // ↓ 아래 둘은 선택 테이블입니다 (05·06 SQL 미실행 상태에서도 앱은 떠야 하므로 따로 처리)
    sb.from('reward_suggestions').select('*').order('created_at', {ascending:false}).limit(40),
    inWin(sb.from('task_cancels').select('*')),
  ]);

  // 붙인 역순으로 꺼냅니다 (task_cancels → reward_suggestions → date_notes 넓은 범위)
  const tcan  = res.pop();
  const sug   = res.pop();
  const rest  = res.pop();

  D.taskCancels = new Set(tcan.error ? [] : (tcan.data||[]).map(c => c.task_id+'|'+c.on_date));
  D.suggests    = sug.error ? [] : (sug.data || []);

  const restRows = (rest.error ? [] : (rest.data||[])).filter(n => REST_KEYS.has(n.note_key));
  D.restDays = new Set(restRows.map(n => n.on_date));
  D.restList = restRows.sort((a,b) => a.on_date < b.on_date ? -1 : 1);

  const bad = res.find(r => r.error);
  if(bad) throw bad.error;

  const [fam, mem, sets, per, rou, tas, notes, canc, extras, picks,
         wsta, dsta, tlogs, alogs, bal, rew, red, noti, ledger] = res.map(r => r.data);

  D.family      = fam;
  D.members     = mem || [];
  D.sets        = sets || [];
  D.periods     = per || [];
  D.routines    = rou || [];
  D.tasks       = tas || [];
  D.extras      = extras || [];
  D.rewards     = rew || [];
  D.redemptions = red || [];
  D.notis       = noti || [];

  D.notes = {};
  (notes||[]).forEach(n => D.notes[n.on_date] = n);

  D.cancels = new Set((canc||[]).map(c => c.routine_id+'|'+c.on_date));

  D.pickups = {};
  (picks||[]).forEach(p => {
    const k = p.routine_id
      ? `routine:${p.routine_id}|${p.on_date}`
      : `extra:${p.extra_event_id}|${p.on_date}`;
    D.pickups[k] = p;
  });

  D.weekly = {}; (wsta||[]).forEach(w => D.weekly[w.member_id+'|'+w.weekday] = w.status);
  D.dayst  = {}; (dsta||[]).forEach(w => D.dayst[w.member_id+'|'+w.on_date]  = w.status);

  D.taskLogs = new Set((tlogs||[]).map(l => l.task_id+'|'+l.on_date));
  D.attLogs  = new Set((alogs||[]).map(l =>
    (l.routine_id ? `routine:${l.routine_id}` : `extra:${l.extra_event_id}`) + '|' + l.on_date));

  D.balances = {}; (bal||[]).forEach(b => D.balances[b.child_id] = b.balance);

  D.weekEarned = {};
  D.bonusDates = {};
  (ledger||[]).forEach(l => {
    if(l.delta > 0 && l.on_date >= days[0] && l.on_date <= days[6]){
      D.weekEarned[l.child_id] = (D.weekEarned[l.child_id]||0) + l.delta;
    }
    if(l.ref_type === 'bonus' && l.on_date){
      (D.bonusDates[l.child_id] ??= new Set()).add(l.on_date);
    }
  });

  if(!S.editSet)  S.editSet  = setIdFor(TODAY);
  if(!S.ovrChild) S.ovrChild = kids()[0]?.id || null;

  if(!S.meId && !isKid()){
    const uid = (await sb.auth.getUser()).data.user?.id;
    S.meId = D.members.find(m => m.user_id === uid)?.id
          || D.members.find(m => m.kind === 'parent')?.id
          || null;
  }
}

/* 아이 모드에서 "나"를 확정 */
export async function resolveKid(){
  const { data, error } = await sb.rpc('whoami_kid');
  if(error) throw error;
  return data || null;
}
