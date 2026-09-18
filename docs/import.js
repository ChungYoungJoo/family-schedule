// =====================================================================
//  import.js — 엑셀/CSV 로 시간표·숙제 일괄 등록, PDF 에서 숙제 뽑아내기
//  라이브러리는 실제로 쓸 때만 내려받습니다 (동적 import).
// =====================================================================
import { sb, D, S, WD, CAT, esc, kids, pickers, M } from './core.js';
import { $, openSheet, closeSheet, toast } from './ui.js';
import { run, setReopen } from './sync.js';

const XLSX_URL = 'https://esm.sh/xlsx@0.18.5';
const PDFJS_V  = '4.6.82';

/* ---------------------------------------------------------------
   파싱 도우미
   --------------------------------------------------------------- */
const WD_MAP = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};

function parseWeekday(v){
  const s = String(v ?? '').trim();
  if(!s) return null;
  const ch = s[0];
  if(ch in WD_MAP) return WD_MAP[ch];
  const n = Number(s);
  if(Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return null;
}

/** 'HH:MM' / '8:40' / '오후 3:00' / 엑셀 시간값(0~1) 모두 받아 'HH:MM' 으로 */
function parseTime(v){
  if(v === null || v === undefined || v === '') return null;
  if(typeof v === 'number' && v >= 0 && v < 1){
    const mins = Math.round(v * 24 * 60);
    return String(Math.floor(mins/60)).padStart(2,'0') + ':' + String(mins%60).padStart(2,'0');
  }
  const s = String(v).trim();
  const m = /(\d{1,2})\s*:\s*(\d{2})/.exec(s);
  if(!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  if(/오후|PM/i.test(s) && h < 12) h += 12;
  if(/오전|AM/i.test(s) && h === 12) h = 0;
  if(h > 23 || mi > 59) return null;
  return String(h).padStart(2,'0') + ':' + String(mi).padStart(2,'0');
}

function parseCategory(v){
  const s = String(v ?? '').trim();
  if(/학교|돌봄/.test(s))        return 'school';
  if(/학원|공부|보습|영어|수학/.test(s)) return 'academy';
  if(/운동|체육|수영|축구|태권/.test(s)) return 'sport';
  if(/예체능|예능|음악|미술|피아노|발레/.test(s)) return 'art';
  return s ? 'etc' : 'etc';
}

const isYes = v => /^(o|y|yes|예|필요|true|1|v|✓)$/i.test(String(v ?? '').trim());

function findChild(name){
  const s = String(name ?? '').trim();
  return kids().find(c => c.name === s) || kids().find(c => s && c.name.includes(s)) || null;
}
function findPicker(name){
  const s = String(name ?? '').trim();
  if(!s) return { id:null, self:false };
  if(/자율|혼자|스스로/.test(s)) return { id:null, self:true };
  const p = pickers().find(a => a.id !== 'self' && (a.name === s || a.full_name === s || s.includes(a.name)));
  return { id: p ? p.id : null, self:false };
}

/* 키 이름이 조금 달라도 찾아줍니다 */
function pick(row, names){
  for(const n of names){
    for(const k of Object.keys(row)){
      if(String(k).replace(/\s/g,'') === n) return row[k];
    }
  }
  return '';
}

/* ---------------------------------------------------------------
   엑셀 양식 내려받기
   --------------------------------------------------------------- */
export async function downloadTemplate(){
  try{
    toast('양식을 만드는 중…');
    const XLSX = await import(XLSX_URL);
    const kid = kids()[0]?.name || '아이이름';
    const wb = XLSX.utils.book_new();

    const sched = [
      ['아이','요일','시작','종료','일정','분류','픽업','담당'],
      [kid,'월','08:40','14:20','학교','학교','',''],
      [kid,'월','17:00','18:30','수학학원','학원','O','엄마'],
      [kid,'화','15:30','16:30','피아노','예체능','',''],
      [kid,'수','14:00','16:00','영어학원','학원','O','선생님'],
      [kid,'금','15:30','16:30','피아노','예체능','O','자율'],
    ];
    const hw = [
      ['아이','숙제','메모','요일','포인트'],
      [kid,'독서 20분','읽은 쪽수 적기','매일',10],
      [kid,'수학 문제집 2쪽','채점까지','매일',15],
      [kid,'영어 단어 10개','','월,수,금',15],
    ];
    const guide = [
      ['항목','쓰는 법'],
      ['아이','관리 탭에 등록된 아이 이름과 똑같이'],
      ['요일','월 화 수 목 금 토 일 (한 글자)'],
      ['시작/종료','08:40 처럼. 엑셀 시간 서식도 됩니다'],
      ['분류','학교 / 학원 / 운동 / 예체능 / 기타'],
      ['픽업','데리러 가야 하면 O, 아니면 비워두기'],
      ['담당','엄마 / 아빠 / 선생님 / 자율  (비우면 미정)'],
      ['숙제 요일','매일  또는  월,수,금'],
      ['',''],
      ['주의','업로드하면 지금 선택된 시간표 세트에 등록됩니다'],
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sched), '시간표');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hw),    '숙제');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), '작성방법');
    XLSX.writeFile(wb, '우리집하루_양식.xlsx');
    toast('양식을 내려받았어요');
  }catch(e){
    console.error(e);
    toast('양식을 만들지 못했어요: ' + (e.message||e), true);
  }
}

/* ---------------------------------------------------------------
   엑셀/CSV 업로드
   --------------------------------------------------------------- */
let parsed = { routines: [], tasks: [] };

export function sheetImportFile(){
  setReopen(null);
  parsed = { routines: [], tasks: [] };
  const setName = D.sets.find(s => s.id === S.editSet)?.name || '';
  openSheet('엑셀/CSV 로 한 번에 등록',
    `지금 선택된 «${setName}» 시간표에 등록됩니다. 관리 탭 위쪽에서 세트를 먼저 확인하세요.`, `
    <label class="filebox">📄 엑셀(.xlsx) 또는 CSV 파일 고르기
      <input type="file" id="impFile" accept=".xlsx,.xls,.csv"></label>
    <button class="ghost" data-act="imptemplate">⬇ 먼저 양식 파일 내려받기</button>
    <div class="note" style="text-align:left">
      «시간표» 시트: 아이 / 요일 / 시작 / 종료 / 일정 / 분류 / 픽업 / 담당<br>
      «숙제» 시트: 아이 / 숙제 / 메모 / 요일 / 포인트
    </div>`);
  $('impFile').onchange = ev => readWorkbook(ev.target.files[0]);
}

async function readWorkbook(file){
  if(!file) return;
  try{
    toast('파일을 읽는 중…');
    const XLSX = await import(XLSX_URL);
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates:false });

    const sheetNamed = re => wb.SheetNames.find(n => re.test(n));
    const rowsOf = name => name
      ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval:'', raw:true })
      : [];

    let sRows = rowsOf(sheetNamed(/시간표|스케줄|schedule/i));
    let tRows = rowsOf(sheetNamed(/숙제|할일|task|homework/i));

    // 시트 이름이 다르면 첫 시트를 헤더로 판별
    if(!sRows.length && !tRows.length && wb.SheetNames.length){
      const first = rowsOf(wb.SheetNames[0]);
      const keys = Object.keys(first[0] || {}).join();
      if(/숙제/.test(keys)) tRows = first; else sRows = first;
    }

    parsed.routines = sRows.map(r => {
      const child = findChild(pick(r, ['아이','이름','아이이름']));
      const wd    = parseWeekday(pick(r, ['요일']));
      const s     = parseTime(pick(r, ['시작','시작시간']));
      const e     = parseTime(pick(r, ['종료','종료시간','끝']));
      const title = String(pick(r, ['일정','제목','수업','이름2']) ?? '').trim();
      const pk    = findPicker(pick(r, ['담당','픽업담당']));
      const need  = isYes(pick(r, ['픽업','픽업필요'])) || pk.self || !!pk.id;
      const bad = !child ? '아이를 찾을 수 없음'
                : wd === null ? '요일 오류'
                : !s || !e   ? '시간 오류'
                : e <= s     ? '종료가 시작보다 빠름'
                : !title     ? '일정 이름 없음' : null;
      return { bad, child, wd, s, e, title,
               category: parseCategory(pick(r, ['분류','종류','카테고리'])),
               needs_pickup: need, pickId: pk.id, isSelf: pk.self };
    });

    parsed.tasks = tRows.map(r => {
      const child = findChild(pick(r, ['아이','이름','아이이름']));
      const title = String(pick(r, ['숙제','할일','내용','제목']) ?? '').trim();
      const raw   = String(pick(r, ['요일','언제']) ?? '').trim();
      let wds = null;
      if(raw && !/매일|every|daily/i.test(raw)){
        wds = [...raw.matchAll(/[일월화수목금토]/g)].map(m => WD_MAP[m[0]]);
        if(!wds.length) wds = null;
      }
      const pts = Number(pick(r, ['포인트','점수','P'])) || 10;
      const bad = !child ? '아이를 찾을 수 없음' : !title ? '숙제 내용 없음' : null;
      return { bad, child, title, note:String(pick(r,['메모','비고']) ?? '').trim() || null,
               weekdays: wds, points: pts };
    });

    if(!parsed.routines.length && !parsed.tasks.length) return toast('읽을 내용이 없어요', true);
    previewImport();
  }catch(e){
    console.error(e);
    toast('파일을 읽지 못했어요: ' + (e.message||e), true);
  }
}

function previewImport(){
  const okR = parsed.routines.filter(x => !x.bad).length;
  const okT = parsed.tasks.filter(x => !x.bad).length;
  const badAll = [...parsed.routines, ...parsed.tasks].filter(x => x.bad);

  const rowR = (x,i) => `<div class="improw ${x.bad?'bad':'sel'}" data-imp="r" data-i="${i}">
    <div class="bx">✓</div>
    <div class="c1">${x.bad ? '⚠ ' + esc(x.bad)
      : `${esc(x.child.name)} · ${WD[x.wd]} ${x.s}~${x.e} ${esc(x.title)}`}</div>
    <div class="c2">${x.bad ? '' : (CAT[x.category].emoji + (x.needs_pickup?' 🚗':''))}</div></div>`;

  const rowT = (x,i) => `<div class="improw ${x.bad?'bad':'sel'}" data-imp="t" data-i="${i}">
    <div class="bx">✓</div>
    <div class="c1">${x.bad ? '⚠ ' + esc(x.bad)
      : `${esc(x.child.name)} · ${esc(x.title)}`}</div>
    <div class="c2">${x.bad ? '' : (x.weekdays ? x.weekdays.map(w=>WD[w]).join('') : '매일') + ` ${x.points}P`}</div></div>`;

  openSheet('가져올 내용 확인',
    `일정 ${okR}건, 숙제 ${okT}건${badAll.length?` · 문제 ${badAll.length}건은 제외됩니다`:''}`, `
    ${parsed.routines.length ? `<h4>시간표</h4>${parsed.routines.map(rowR).join('')}` : ''}
    ${parsed.tasks.length ? `<h4>숙제</h4>${parsed.tasks.map(rowT).join('')}` : ''}
    <h4>등록 방식</h4>
    <div class="mrow"><div class="mx"><b>기존 내용 지우고 교체</b>
      <span>이 세트의 기존 시간표·숙제를 모두 지운 뒤 등록합니다</span></div>
      <div class="sw" id="impReplace"></div></div>
    <button class="btn" style="margin-top:8px" data-act="impcommit">${okR+okT}건 등록하기</button>`);

  // 체크 토글 / 교체 스위치
  document.querySelectorAll('#shBody .improw').forEach(el => {
    if(el.classList.contains('bad')) return;
    el.onclick = () => el.classList.toggle('sel');
  });
  $('impReplace').onclick = () => $('impReplace').classList.toggle('on');
}

export function commitImport(){
  const chosen = kind => [...document.querySelectorAll(`#shBody .improw[data-imp="${kind}"].sel`)]
    .map(el => Number(el.dataset.i));
  const rIdx = new Set(chosen('r')), tIdx = new Set(chosen('t'));
  const replace = $('impReplace')?.classList.contains('on');

  const routines = parsed.routines
    .map((x,i) => ({x,i})).filter(({x,i}) => !x.bad && rIdx.has(i))
    .map(({x}) => ({
      family_id: D.family.id, set_id: S.editSet, child_id: x.child.id,
      weekday: x.wd, starts_at: x.s, ends_at: x.e, title: x.title,
      category: x.category, needs_pickup: x.needs_pickup,
      default_pickup_id: x.pickId, default_is_self: x.isSelf,
    }));

  const tasks = parsed.tasks
    .map((x,i) => ({x,i})).filter(({x,i}) => !x.bad && tIdx.has(i))
    .map(({x}, n) => ({
      family_id: D.family.id, set_id: S.editSet, child_id: x.child.id,
      title: x.title, note: x.note, weekdays: x.weekdays, points: x.points, sort_order: n+1,
    }));

  if(!routines.length && !tasks.length) return toast('등록할 항목을 골라 주세요', true);
  if(replace && !confirm('이 세트의 기존 시간표와 숙제를 모두 지우고 새로 등록합니다.\n계속할까요?')) return;

  run(async () => {
    if(replace){
      if(routines.length){
        const e1 = await sb.from('routines').delete().eq('set_id', S.editSet);
        if(e1.error) return e1;
      }
      if(tasks.length){
        const e2 = await sb.from('tasks').delete().eq('set_id', S.editSet);
        if(e2.error) return e2;
      }
    }
    if(routines.length){
      const r1 = await sb.from('routines').insert(routines);
      if(r1.error) return r1;
    }
    if(tasks.length){
      const r2 = await sb.from('tasks').insert(tasks);
      if(r2.error) return r2;
    }
    closeSheet(); setReopen(null);
    return { error:null };
  }, `일정 ${routines.length}건, 숙제 ${tasks.length}건을 등록했어요`);
}

/* ---------------------------------------------------------------
   PDF 에서 숙제 뽑아내기
   --------------------------------------------------------------- */
let pdfLines = [];

export function sheetImportPdf(){
  setReopen(null);
  pdfLines = [];
  openSheet('PDF 로 숙제 등록',
    '학원에서 받은 안내문을 올리면 글자를 뽑아내 보여줍니다. 숙제로 만들 줄만 고르세요.', `
    <label class="filebox">📕 PDF 파일 고르기
      <input type="file" id="pdfFile" accept="application/pdf,.pdf"></label>
    <div class="note" style="text-align:left">
      글자가 들어 있는 PDF만 됩니다. 스캔한 사진 PDF는 글자를 읽을 수 없어요.
    </div>`);
  $('pdfFile').onchange = ev => readPdf(ev.target.files[0]);
}

async function readPdf(file){
  if(!file) return;
  try{
    toast('PDF 를 읽는 중…');
    const base = `https://esm.sh/pdfjs-dist@${PDFJS_V}/build/`;
    const pdfjs = await import(base + 'pdf.min.mjs');
    try{
      const blob = new Blob([`import "${base}pdf.worker.min.mjs";`], { type:'text/javascript' });
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    }catch{ /* 워커를 못 만들면 pdf.js 가 알아서 메인 스레드로 처리합니다 */ }

    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = [];
    for(let p = 1; p <= doc.numPages; p++){
      const content = await (await doc.getPage(p)).getTextContent();
      let cur = '', lastY = null;
      for(const it of content.items){
        const y = Math.round(it.transform[5]);
        if(lastY !== null && Math.abs(y - lastY) > 3){ lines.push(cur); cur = ''; }
        cur += it.str;
        lastY = y;
      }
      if(cur) lines.push(cur);
    }

    pdfLines = [...new Set(lines.map(l => l.replace(/\s+/g,' ').trim()))]
      .filter(l => l.length >= 2 && l.length <= 60);

    if(!pdfLines.length) return toast('글자를 찾지 못했어요 (스캔 PDF 인 것 같아요)', true);
    previewPdf();
  }catch(e){
    console.error(e);
    toast('PDF 를 읽지 못했어요: ' + (e.message||e), true);
  }
}

function previewPdf(){
  const setName = D.sets.find(s => s.id === S.editSet)?.name || '';
  openSheet('숙제로 만들 줄 고르기',
    `${pdfLines.length}줄을 찾았어요. 체크한 줄이 «${setName}» 숙제로 등록됩니다.`, `
    <label>어느 아이의 숙제인가요?</label>
    <div class="seg">${kids().map((c,i) => `<button class="${i===0?'on':''}" data-pdfkid="${c.id}"
      >${c.emoji} ${c.name}</button>`).join('')}</div>
    <label>언제 하나요?</label>
    <div class="seg">
      <button class="on" id="pdDaily" type="button">매일</button>
      <button id="pdPick" type="button">요일 선택</button></div>
    <div class="opt-grid" id="pdWds" style="display:none">
      ${[1,2,3,4,5,6,0].map(w => `<div class="opt" data-wd="${w}">${WD[w]}</div>`).join('')}</div>
    <label>포인트</label><input id="pdPt" type="number" value="10">
    <h4>내용 (${pdfLines.length}줄)</h4>
    ${pdfLines.map((l,i) => `<div class="improw" data-i="${i}">
      <div class="bx">✓</div><div class="c1">${esc(l)}</div></div>`).join('')}
    <button class="btn" style="margin-top:12px" data-act="pdfcommit">체크한 줄 등록하기</button>`);

  document.querySelectorAll('#shBody .improw').forEach(el =>
    el.onclick = () => el.classList.toggle('sel'));
  document.querySelectorAll('#shBody [data-pdfkid]').forEach(b => b.onclick = () => {
    document.querySelectorAll('#shBody [data-pdfkid]').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
  $('pdDaily').onclick = () => {
    $('pdDaily').classList.add('on'); $('pdPick').classList.remove('on'); $('pdWds').style.display='none'; };
  $('pdPick').onclick = () => {
    $('pdPick').classList.add('on'); $('pdDaily').classList.remove('on'); $('pdWds').style.display=''; };
  document.querySelectorAll('#shBody #pdWds .opt').forEach(e =>
    e.onclick = () => e.classList.toggle('sel'));
}

export function commitPdf(){
  const childId = document.querySelector('#shBody [data-pdfkid].on')?.dataset.pdfkid;
  if(!childId) return toast('아이를 골라 주세요', true);
  const daily = $('pdDaily').classList.contains('on');
  const wds = [...document.querySelectorAll('#shBody #pdWds .opt.sel')].map(e => Number(e.dataset.wd)).sort();
  if(!daily && !wds.length) return toast('요일을 하나 이상 골라 주세요', true);

  const points = Number($('pdPt').value) || 10;
  const rows = [...document.querySelectorAll('#shBody .improw.sel')]
    .map(el => pdfLines[Number(el.dataset.i)])
    .filter(Boolean)
    .map((title, n) => ({
      family_id: D.family.id, set_id: S.editSet, child_id: childId,
      title, note: 'PDF 에서 가져옴', weekdays: daily ? null : wds, points, sort_order: 100+n,
    }));

  if(!rows.length) return toast('등록할 줄을 골라 주세요', true);

  run(async () => {
    const r = await sb.from('tasks').insert(rows);
    closeSheet(); setReopen(null);
    return r;
  }, `숙제 ${rows.length}건을 등록했어요`);
}
