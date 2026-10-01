// =====================================================================
//  cats.js — 고양이 그림 / 고양이 도감 목록
//  (어떤 모듈에도 의존하지 않는 잎 모듈. core.js 와 화면 모듈이 가져다 씁니다)
// =====================================================================

/** 아이 아이콘용 털색. members.emoji 에 'cat:cheese' 처럼 적으면 이 그림이 나옵니다 */
export const KID_CATS = {
  cheese:{fur:'#f0a441', dark:'#cf7a22', face:'#fff1db', ear:'#f3b3a4'},  // 치즈냥
  grey:  {fur:'#a7b3bd', dark:'#84919d', face:'#ffffff', ear:'#eeb9b0'},  // 회색·흰색냥
};

/**
 * 고양이 얼굴 SVG. 1em 크기라서 이모지가 있던 자리에 그대로 들어갑니다.
 *   fur 털 / dark 이마 줄무늬 / face 주둥이 / ear 귓속        (필수)
 *   eye 눈동자색(주면 세로 동공도 그림) / line 입 선 색
 *   earL earR 귀 겉 색 / outline 윤곽선(흰 고양이용)
 *   patch [{x,y,rx,ry,c}] 얼굴 얼룩 / mask 샴 고양이 마스크 / cheek 볼 줄무늬 / crown 왕관
 * 옵션 없이 필수 값만 주면 예전 아이 아이콘과 똑같은 그림이 나옵니다.
 */
export function catSvg(s){
  const eye  = s.eye  || '#3b2f28';
  const line = s.line || '#3b2f28';
  const ol   = s.outline ? ` stroke="${s.outline}" stroke-width=".7" stroke-linejoin="round"` : '';
  const eyes = s.eye
    ? `<ellipse cx="11.9" cy="17.4" rx="1.8" ry="2.3" fill="${eye}"/>`
    + `<ellipse cx="20.1" cy="17.4" rx="1.8" ry="2.3" fill="${eye}"/>`
    + `<ellipse cx="11.9" cy="17.5" rx=".75" ry="1.8" fill="#1b1410"/>`
    + `<ellipse cx="20.1" cy="17.5" rx=".75" ry="1.8" fill="#1b1410"/>`
    : `<ellipse cx="11.9" cy="17.4" rx="1.7" ry="2.2" fill="${eye}"/>`
    + `<ellipse cx="20.1" cy="17.4" rx="1.7" ry="2.2" fill="${eye}"/>`;

  return `<svg class="catav" viewBox="0 0 32 32" aria-hidden="true">`
    + `<path d="M6.5 13 8 4l7 5.2z" fill="${s.earL || s.fur}"${ol}/>`
    + `<path d="M25.5 13 24 4l-7 5.2z" fill="${s.earR || s.fur}"${ol}/>`
    + `<path d="M9 11.6 9.9 6.8l3.5 2.6z" fill="${s.ear}"/>`
    + `<path d="M23 11.6 22.1 6.8l-3.5 2.6z" fill="${s.ear}"/>`
    + `<ellipse cx="16" cy="18.4" rx="11" ry="9.4" fill="${s.fur}"${ol}/>`
    + (s.patch || []).map(p =>
        `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${p.c}"/>`).join('')
    + `<path d="M16 9.4v4.4M11.4 10.8l1.5 3.6M20.6 10.8l-1.5 3.6" stroke="${s.dark}"`
    + ` stroke-width="1.7" stroke-linecap="round" fill="none"/>`
    + (s.cheek ? `<path d="M6.8 18.2h3.2M7.4 20.8l2.9-.7M25.2 18.2H22M24.6 20.8l-2.9-.7" stroke="${s.dark}"`
               + ` stroke-width="1.4" stroke-linecap="round" fill="none"/>` : '')
    + (s.mask ? `<ellipse cx="16" cy="20.2" rx="7.6" ry="6" fill="${s.mask}"/>` : '')
    + `<ellipse cx="16" cy="21.8" rx="7.1" ry="5.1" fill="${s.face}"/>`
    + eyes
    + `<path d="M16 20.4l-1.5 1.2h3z" fill="#e2857e"/>`
    + `<path d="M16 21.8v1.1M16 22.9c-1.2 0-1.9-.7-1.9-1.5M16 22.9c1.2 0 1.9-.7 1.9-1.5"`
    + ` stroke="${line}" stroke-width="1" stroke-linecap="round" fill="none"/>`
    + (s.crown ? `<path d="M11.4 9.4 12.4 4.6l1.9 2.2L16 3l1.7 3.8 1.9-2.2 1 4.8z" fill="#ff7a59"/>`
               + `<circle cx="16" cy="6.6" r=".75" fill="#fff"/>` : '')
    + `</svg>`;
}

/**
 * 고양이 도감 — 연속 달성 일수를 채울 때마다 새 친구가 옵니다.
 * ※ 일수(days)는 supabase/09_cat_book.sql 의 목록과 같아야 합니다.
 */
export const CAT_BOOK = [
  { days:3,   name:'까망이',  note:'밤처럼 까만 고양이. 눈이 반짝반짝!',
    style:{fur:'#3d3d48', dark:'#565664', face:'#4d4d59', ear:'#b98f92', eye:'#ffd23f', line:'#a4a4b4'} },
  { days:7,   name:'삼색이',  note:'주황·검정·하양, 행운을 주는 고양이',
    style:{fur:'#fff6ea', dark:'#ecdcc8', face:'#ffffff', ear:'#f2b8b0', earL:'#e8913a', earR:'#34343e',
           patch:[{x:10.6,y:15,rx:3.6,ry:3.2,c:'#e8913a'},{x:21.8,y:14.6,rx:3.8,ry:3.4,c:'#34343e'}],
           eye:'#6fb36a'} },
  { days:14,  name:'샴이',    note:'파란 눈이 예쁜 우아한 고양이',
    style:{fur:'#f3e5cd', dark:'#d8c3a2', face:'#8d6e5a', ear:'#6f5547', earL:'#8d6e5a', earR:'#8d6e5a',
           mask:'#8d6e5a', eye:'#5ab0ff', line:'#2a1f19'} },
  { days:21,  name:'하양이',  note:'눈처럼 하얗고 포근한 고양이',
    style:{fur:'#ffffff', dark:'#efe3d6', face:'#ffffff', ear:'#f6b9b9', outline:'#e3d5c6', eye:'#5aa9e6'} },
  { days:30,  name:'턱시',    note:'턱시도를 입은 멋쟁이 고양이',
    style:{fur:'#2f2f3a', dark:'#464655', face:'#ffffff', ear:'#d9a0a0',
           patch:[{x:16,y:13.6,rx:1.9,ry:4.2,c:'#ffffff'}], eye:'#8ad06a'} },
  { days:50,  name:'고등어',  note:'줄무늬가 멋진 고등어 고양이',
    style:{fur:'#b88e62', dark:'#7b5636', face:'#f4e3c8', ear:'#e8b4a0', cheek:true, eye:'#e0a526'} },
  { days:75,  name:'푸른이',  note:'은빛 털이 반짝이는 고양이',
    style:{fur:'#8497ab', dark:'#677c92', face:'#a9b8c7', ear:'#d2a4a8', eye:'#6fd08a'} },
  { days:100, name:'황금이',  note:'100일을 해낸 전설의 고양이! 👑',
    style:{fur:'#f5c542', dark:'#d49a1c', face:'#fff3c4', ear:'#f2b09a', crown:true} },
];

/** 다음에 만날 친구. unlocked 는 이미 만난 days 의 Set, streak 는 지금 연속 일수 */
export function nextCat(unlocked, streak){
  const cat = CAT_BOOK.find(c => !unlocked.has(c.days));
  return cat ? { cat, left: Math.max(0, cat.days - streak) } : null;
}
