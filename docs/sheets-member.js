// =====================================================================
//  sheets-member.js — 픽업 도와줄 사람 추가·수정
//
//  엄마·아빠·시터 선생님 말고 가끔 데리러 오는 사람(미술선생님, 할머니 …)을
//  등록해 두면 담당을 고르는 자리에 함께 나옵니다.
//  앱 계정(kind='parent')이 아니라 kind='helper' 로만 만듭니다.
// =====================================================================
import { sb, D, esc, josa } from './core.js';
import { $, openSheet, closeSheet, toast } from './ui.js';
import { run, setReopen } from './sync.js';

const COLORS = ['#0ca678','#e64980','#7950f2','#f59f00','#1c7ed6','#f76707','#22b8cf','#868e96'];

let editing = null;

/** m      : 수정할 구성원 (없으면 새로 추가)
 *  target : {k,v,d} 가 있으면 저장하자마자 그 일정의 담당으로 바로 지정 */
export function sheetMember(m, target){
  editing = { id: m?.id ?? null, target: target || null };
  setReopen(null);
  const color = m?.color || COLORS[0];

  openSheet(m ? `${m.emoji} ${m.name} 수정` : '픽업 도와줄 사람 추가',
    target ? '추가하면 이 일정의 담당으로 바로 정해집니다.'
           : '가끔 데리러 오는 사람을 등록해 두면 담당 고를 때 같이 나와요.', `
    <label>이름</label>
    <input id="mName" value="${esc(m?.name||'')}" placeholder="예: 미술선생님, 할머니">
    <label>아이콘</label><input id="mEm" value="${esc(m?.emoji||'🧑')}" maxlength="4">
    <label>색깔</label>
    <div class="swatches">${COLORS.map(c => `<span class="swatch ${c===color?'sel':''}"
      data-c="${c}" style="background:${c}"></span>`).join('')}</div>
    <button class="btn" style="margin-top:16px" data-act="savemember">저장</button>
    ${m ? `<button class="ghost" data-act="delmember" data-v="${m.id}" data-w="${esc(m.name)}">삭제</button>` : ''}
    <div class="note" style="text-align:left">
      앱 로그인 계정은 만들어지지 않습니다. 담당을 고르는 자리에만 나타나요.<br>
      출퇴근 시간까지 관리하려면 «어른 요일별 기본 일정» 에서 요일을 채워 주세요.
    </div>`);

  document.querySelectorAll('#shBody .swatch').forEach(el => el.onclick = () => {
    document.querySelectorAll('#shBody .swatch').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
  });
}

export function saveMember(){
  const name = $('mName').value.trim();
  if(!name) return toast('이름을 입력해 주세요', true);
  const row = {
    name,
    emoji: $('mEm').value.trim() || '🧑',
    color: document.querySelector('#shBody .swatch.sel')?.dataset.c || COLORS[0],
  };
  const { id, target } = editing;

  run(async () => {
    if(id){
      const r = await sb.from('members').update(row).eq('id', id);
      closeSheet(); setReopen(null);
      return r;
    }

    const ins = await sb.from('members').insert({
      ...row, family_id: D.family.id, kind:'helper', can_pickup:true, descr:'가끔 픽업',
      sort_order: Math.max(0, ...D.members.map(x => x.sort_order || 0)) + 1,
    }).select('id').single();
    if(ins.error) return ins;

    // 담당 고르는 자리에서 추가한 경우 그 일정에 바로 배정합니다
    if(target){
      const it = (target.k === 'routine' ? D.routines : D.extras).find(x => x.id === target.v);
      if(it){
        const p = await sb.from('pickups').upsert({
          family_id: it.family_id,
          on_date: target.d,
          routine_id:     target.k === 'routine' ? target.v : null,
          extra_event_id: target.k === 'extra'   ? target.v : null,
          assignee_id: ins.data.id,
          is_self: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'routine_id,extra_event_id,on_date' });
        if(p.error) return p;
      }
    }

    closeSheet(); setReopen(null);
    return ins;
  }, id      ? '저장했어요'
   : target  ? `${josa(name,'으로','로')} 정했어요`
             : `${josa(name,'을','를')} 추가했어요`);
}
