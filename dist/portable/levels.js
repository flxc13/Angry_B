/* Append-only campaign data: the original five levels belong to the caller. */
(() => {
  'use strict';

  /** factory.enemy must apply BongiEnemies.types before constructing its body.
   * No ability implementation here; soda's radius 175 / damage 130 is caller-owned.
   * tower uses 24x108 posts and a (width+30)x22 cap, top = base-130.
   * All coordinates are resting contacts, not suspended sleeping bodies.
   */
  window.BongiExtraLevels = function BongiExtraLevels({ tower, block, enemy, GROUND }) {
    const radius = { mud: 25, vendor: 27, performer: 25, helmet: 27, soda: 25, brute: 36 };
    const deck = GROUND - 130; // 474 with the standard ground at 604.
    const upper = deck - 130; // 344; third-storey towers start here.
    const perch = (x, surface = GROUND, kind = 'mud') => enemy(x, surface - radius[kind], kind);
    // Bridge planks sit ON adjacent caps, not in them. Their top is 452.
    const bridge = (x, width, material = 'wood') => block(x, deck - 11, width, 22, material);

    return [
      {
        title: '安全帽試工日', area: '紙板工地', chapter: 2, shots: 5, color: '#efdc9e',
        description: '先撞前排安全帽破盾，或者拆玻璃腳等高處啲友跌落嚟；後排冇封牆，任砌。',
        build: () => [
          ...tower(820, 152, GROUND, 'glass'),
          perch(678, GROUND, 'helmet'), perch(820), perch(820, deck, 'helmet'), perch(1020, GROUND, 'vendor')
        ]
      },
      {
        title: '汽水裝卸站', area: '泡泡貨場', chapter: 2, shots: 5, color: '#bce3cf',
        description: '左架汽水同地面汽水貼到實一實；先引爆一鑊，再慢慢收拾右邊嗰個嘴臭小販。',
        build: () => [
          ...tower(754, 136, GROUND, 'glass'), ...tower(1010, 180),
          perch(754, deck, 'soda'), perch(851, GROUND, 'soda'),
          perch(754, GROUND, 'mud'), perch(1010, deck, 'vendor')
        ]
      },
      {
        title: '偏心小劇台', area: '斜陽戲棚', chapter: 2, shots: 5, color: '#dfcce8',
        description: '窄樓偏晒去寬台左邊；拆左腳可以帶冧上層，右邊汽水順便照顧埋地面，一鑊熟。',
        build: () => [
          ...tower(864, 268), ...tower(808, 108, deck, 'glass'),
          perch(808, upper, 'helmet'), perch(808, deck, 'performer'),
          perch(948, deck, 'soda'), perch(822), perch(909, GROUND, 'vendor')
        ]
      },
      {
        title: '泡泡天橋', area: '雙棚連廊', chapter: 2, shots: 6, color: '#bbdae8',
        description: '天橋兩端真係落咗喺棚頂；瞄準橋中間嘅汽水，一嘢鬆撚晒兩座玻璃棚，爽！',
        build: () => [
          ...tower(746, 142, GROUND, 'glass'), ...tower(1034, 142, GROUND, 'glass'),
          bridge(890, 300),
          perch(800, deck - 22, 'helmet'), perch(889, deck - 22, 'soda'), perch(980, deck - 22, 'performer'),
          perch(746), perch(1034, GROUND, 'vendor')
        ]
      },
      {
        title: '紫泥監工', area: '開放裝配場', chapter: 3, shots: 6, color: '#d2c6e6',
        description: '重裝監工企喺開放地面曬命；左邊汽水先削弱佢，再用矮架碎片或者直擊收尾，仆街啦佢。',
        build: () => [
          ...tower(750, 142, GROUND, 'glass'), ...tower(1040, 140),
          perch(750, deck, 'performer'), perch(858, GROUND, 'soda'), perch(925, GROUND, 'brute'),
          perch(1040, deck, 'helmet'), perch(1040)
        ]
      },
      {
        title: '三層紙盒電梯', area: '回收高台', chapter: 3, shots: 6, color: '#e9d5b5',
        description: '下寬上窄嘅三層架，左腳係入口；中層汽水連到頂層，唔好浪費子彈逐發都打帽，戇居。',
        build: () => [
          ...tower(850, 238, GROUND, 'glass'), ...tower(850, 170, deck), ...tower(850, 106, upper, 'glass'),
          perch(803), perch(897, GROUND, 'vendor'), perch(850, deck, 'soda'),
          perch(850, upper, 'soda'), perch(850, upper - 130, 'helmet'), perch(1055, GROUND, 'performer')
        ]
      },
      {
        title: '三攤接力賽', area: '長桌市集', chapter: 3, shots: 6, color: '#c6e1b5',
        description: '三座唔同闊度嘅小攤，帽同汽水穿插住；先拆前兩攤，再低射最後嗰攤，冚唪唥冧。',
        build: () => [
          ...tower(716, 100, GROUND, 'glass'), ...tower(892, 142), ...tower(1070, 112, GROUND, 'glass'),
          perch(716, deck, 'soda'), perch(716, GROUND, 'mud'),
          perch(892, deck, 'helmet'), perch(892, GROUND, 'soda'),
          perch(1070, deck, 'performer'), perch(1070, GROUND, 'helmet')
        ]
      },
      {
        title: '分岔屋頂派對', area: '雙閣舞場', chapter: 3, shots: 7, color: '#e5c8d3',
        description: '一張寬台托住兩間小閣，中間汽水露出嚟曬；打爆玻璃大腳就可以一齊落台，好唔好睇？',
        build: () => [
          ...tower(886, 350, GROUND, 'glass'), ...tower(782, 106, deck), ...tower(986, 116, deck, 'glass'),
          perch(782, upper, 'helmet'), perch(986, upper, 'performer'),
          perch(782, deck, 'vendor'), perch(886, deck, 'soda'), perch(986, deck, 'helmet'),
          perch(826, GROUND, 'soda'), perch(937)
        ]
      },
      {
        title: '錯層轉運橋', area: '晚班貨廊', chapter: 3, shots: 7, color: '#bcdedc',
        description: '高塔同短橋錯晒開，唔使硬闖成座塔；前面汽水引冧高塔，橋上汽水執埋後排，乾淨俐落。',
        build: () => [
          ...tower(760, 184, GROUND, 'glass'), ...tower(740, 108, deck),
          ...tower(1040, 144, GROUND, 'glass'), bridge(941, 250, 'glass'),
          perch(740, upper, 'helmet'), perch(740, deck, 'soda'),
          perch(725, GROUND, 'soda'), perch(795, GROUND, 'vendor'),
          perch(922, deck - 22, 'soda'), perch(1010, deck - 22, 'helmet'), perch(1040, GROUND, 'performer')
        ]
      },
      {
        title: '監工最後的午休', area: '泡泡總裝台', chapter: 3, shots: 7, color: '#d5c5df',
        description: '兩個紫泥監工：一個企玻璃架頂，一個喺露天地面。汽水貼實兩條友，先連爆再補多兩鑊直擊，收工！',
        build: () => [
          ...tower(772, 180, GROUND, 'glass'), ...tower(1040, 156, GROUND, 'glass'),
          perch(734, deck, 'brute'), perch(811, deck, 'soda'),
          perch(736, GROUND, 'helmet'), perch(811, GROUND, 'soda'),
          perch(907, GROUND, 'brute'), perch(1040, GROUND, 'vendor'),
          perch(1002, deck, 'soda'), perch(1073, deck, 'helmet')
        ]
      }
    ];
  };
})();