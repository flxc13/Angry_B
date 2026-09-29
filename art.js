/* Original offline comic scenery. No assets, dependencies, timers or gameplay state.
 * API: BongiArt.draw(ctx, 'park'|'court'|'bangla'|'space', seconds = 0, low = false)
 *      BongiArt.themes[key] -> { label, tag, color }
 *      BongiArt.draw.hero(ctx, theme, seconds, low) -> optional title illustration.
 * Coordinates: 1280 x 720; solid gameplay ground starts at y = 604.
 * Set the destination context's transform to scale/position either illustration.
 * Draw scenery BEFORE gameplay objects. All animation is background-only.
 * At most four detached HTML canvases, created on first use, shared by hero/game.
 */
(() => {
  'use strict';

  const W = 1280, H = 720, GROUND = 604, TAU = Math.PI * 2;
  const INK = '#172938';
  const FONT = '"Segoe UI", "Microsoft JhengHei", "PingFang TC", sans-serif';
  const themes = Object.freeze({
    park: Object.freeze({ label: '維多利亞公園', tag: 'VICTORIA PARK · 城市綠洲，啱晒發爛渣', color: '#43ab72' }),
    court: Object.freeze({ label: '匹克球俱樂部', tag: 'PICKLEBALL · 活力球場，打到你仆街', color: '#278bd1' }),
    bangla: Object.freeze({ label: '布吉・不夜街', tag: 'BANGLA STREET · 霓虹夜遊，唔準唔嬲', color: '#e851ad' }),
    space: Object.freeze({ label: '富林太空站', tag: 'FULIN SPACE STATION · 軌道漫遊，太空都聽到粗口', color: '#68cee0' })
  });
  const cache = Object.create(null);

  // Helpers always receive their context; no mutable global drawing context.
  function finish(ctx, fill, stroke, width = 3) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function box(ctx, x, y, w, h, fill, stroke, width = 3) {
    ctx.beginPath(); ctx.rect(x, y, w, h); finish(ctx, fill, stroke, width);
  }
  function oval(ctx, x, y, rx, ry, fill, stroke, width = 3) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); finish(ctx, fill, stroke, width);
  }
  function poly(ctx, points, fill, stroke, width = 3) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath(); finish(ctx, fill, stroke, width);
  }
  function line(ctx, points, color = INK, width = 3) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    finish(ctx, null, color, width);
  }
  function text(ctx, value, x, y, size, color = INK, maxWidth = W, align = 'center') {
    ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = align;
    ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.fillText(value, x, y, maxWidth);
  }
  function dots(ctx, x, y, w, h, color, spacing = 12, radius = 1.5) {
    // Static-only Ben-Day printing texture, one batched path per patch.
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.beginPath();
    for (let row = 0; row * spacing < h + spacing; row++) {
      for (let col = 0; col * spacing < w + spacing; col++) {
        const px = x + col * spacing + (row % 2) * spacing / 2, py = y + row * spacing;
        ctx.moveTo(px + radius, py); ctx.arc(px, py, radius, 0, TAU);
      }
    }
    finish(ctx, color); ctx.restore();
  }
  function plaque(ctx, x, y, w, title, subtitle, fill, lettering = INK) {
    poly(ctx, [[x + 7,y + 7],[x + w + 7,y + 7],[x + w + 7,y + 71],[x + 7,y + 71]], INK);
    box(ctx, x, y, w, 64, fill, INK, 4);
    box(ctx, x + 6, y + 6, w - 12, 52, null, lettering, 1);
    text(ctx, title, x + w / 2, y + 24, 25, lettering, w - 24);
    text(ctx, subtitle, x + w / 2, y + 47, 12, lettering, w - 24);
  }
  function cloud(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.beginPath(); ctx.moveTo(-70, 15);
    ctx.bezierCurveTo(-100,-8,-60,-34,-39,-21);
    ctx.bezierCurveTo(-35,-62,29,-64,38,-26);
    ctx.bezierCurveTo(73,-35,96,-4,70,15);
    ctx.closePath(); finish(ctx, '#fff8d9', '#568f9c', 2);
    line(ctx, [[-61,24],[48,24]], '#79b8ba', 2); ctx.restore();
  }

  function tower(ctx, x, top, w, base, color, edge, variant) {
    box(ctx, x, top, w, base - top, color, edge, 3);
    poly(ctx, [[x + w,top],[x + w + 13,top + 9],[x + w + 13,base],[x + w,base]], '#87b5b7', edge, 2);
    box(ctx, x + 7, top - 9, w - 14, 9, color, edge, 2);
    if (variant % 3 === 0) line(ctx, [[x + w / 2,top - 9],[x + w / 2,top - 33]], edge, 2);
    for (let y = top + 14; y < base - 10; y += 21) {
      for (let col = 0; col < Math.floor((w - 10) / 15); col++) {
        box(ctx, x + 8 + col * 15, y, 7, 11, (col + variant) % 3 ? '#9ac4c0' : '#e8d7a3');
      }
    }
    line(ctx, [[x + 4,top + 3],[x + 4,base - 3]], '#e5e2ba', 2);
  }
  function tree(ctx, x, y, scale, muted = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const edge = muted ? '#6a9e80' : '#234c40';
    poly(ctx, [[-13,0],[-7,-109],[6,-119],[15,0]], muted ? '#83a884' : '#ab8550', edge, 3);
    line(ctx, [[0,-50],[-30,-102]], edge, 5); line(ctx, [[3,-76],[30,-124]], edge, 5);
    const leaves = [[-47,-123,43,34],[-13,-159,49,38],[36,-142,47,40],[2,-116,58,39]];
    for (let i = 0; i < leaves.length; i++) {
      const [cx, cy, rx, ry] = leaves[i];
      oval(ctx, cx, cy, rx, ry, muted ? '#8ab797' : ['#318d60','#52b969','#29956b','#73bf64'][i], edge, 3);
    }
    if (!muted) {
      dots(ctx, -35, -172, 64, 60, '#28744f', 9, 1.5);
      line(ctx, [[-54,-131],[-40,-143],[-25,-144]], '#abe277', 3);
      line(ctx, [[21,-153],[40,-149],[50,-137]], '#abe277', 3);
    }
    ctx.restore();
  }
  function park(ctx) {
    box(ctx, 0, 0, W, H, '#c5e6cf');
    box(ctx, 0, 0, W, 311, '#76d3df');
    dots(ctx, 0, 0, W, 175, '#409fae', 13, 1.3);
    oval(ctx, 1040, 95, 63, 63, '#ffda65', INK, 3);
    cloud(ctx, 186, 98, .8); cloud(ctx, 602, 66, .7);
    poly(ctx, [[0,299],[92,222],[197,260],[301,204],[450,291],[638,234],[800,283],[981,241],[1280,279],[1280,367],[0,367]], '#8abdb0');
    for (let i = 0; i < 14; i++) {
      const x = 9 + i * 96, top = 130 + (i * 43 % 109);
      tower(ctx, x, top, 55 + i % 3 * 10, 350, ['#bdd3c1','#cbd8b6','#a5cbd0'][i % 3], '#619296', i);
    }
    // A stepped, slender tower evokes Hong Kong density without copying a landmark.
    tower(ctx, 335, 77, 62, 348, '#9cc8d2', '#527f8b', 3);
    box(ctx, 349, 52, 34, 25, '#b8d9d5', '#527f8b', 2);
    line(ctx, [[366,52],[366,28]], '#527f8b', 2);
    for (let i = 0; i < 11; i++) tree(ctx, i * 123 + 25, 373, .6, true);
    poly(ctx, [[0,376],[225,352],[505,376],[789,354],[1041,375],[1280,353],[1280,604],[0,604]], '#a9cda0');
    // Broad open lawn is deliberately quiet behind x700..1150 targets.
    poly(ctx, [[0,493],[200,465],[528,495],[805,513],[1280,515],[1280,539],[660,539],[200,506],[0,530]], '#93bc92');
    tree(ctx, 70, 492, 1.2); tree(ctx, 273, 463, .83); tree(ctx, 1227, 490, .98);
    // Open-sided tiled pavilion, ornamental finial, fascia and balustrade.
    box(ctx, 374, 450, 236, 18, '#c5a45e', INK, 3);
    box(ctx, 387, 367, 13, 83, '#d36448', INK, 3);
    box(ctx, 579, 367, 13, 83, '#d36448', INK, 3);
    box(ctx, 422, 371, 8, 78, '#ae7752', INK, 2);
    box(ctx, 550, 371, 8, 78, '#ae7752', INK, 2);
    poly(ctx, [[355,370],[389,350],[486,296],[592,350],[629,370]], '#28776a', INK, 4);
    poly(ctx, [[369,359],[402,342],[486,306],[576,342],[614,359]], '#44a089', INK, 2);
    for (let i = 0; i < 9; i++) line(ctx, [[486,307],[386 + i * 25,358]], '#24584e', 2);
    line(ctx, [[354,369],[489,376],[629,369]], '#f5c768', 5);
    oval(ctx, 486, 294, 6, 7, '#eebd53', INK, 2);
    box(ctx, 433, 376, 113, 23, '#f2d48a', INK, 2);
    text(ctx, '綠蔭亭', 489, 388, 16, '#435b46', 100);
    for (let i = 0; i < 8; i++) box(ctx, 405 + i * 23, 425, 5, 25, '#9c644c');
    line(ctx, [[400,424],[579,424]], '#81523e', 4);
    plaque(ctx, 391, 187, 270, '維多利亞公園', 'VICTORIA PARK', '#ffe28b');
    // Track curves are flattened in the target region; no competing dark outlines.
    ctx.beginPath(); ctx.moveTo(-20,553); ctx.bezierCurveTo(245,495,438,548,680,565);
    ctx.bezierCurveTo(875,580,1090,563,1300,562); ctx.lineTo(1300,604); ctx.lineTo(-20,604); ctx.closePath();
    finish(ctx, '#cfac86');
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(0,567 + i * 13);
      ctx.bezierCurveTo(235,519 + i * 19,485,575 + i * 9,760,578 + i * 9);
      ctx.lineTo(1280,576 + i * 9); finish(ctx, null, '#ecd5b2', 2);
    }
    box(ctx, 0, GROUND, W, 116, '#e4c690');
    box(ctx, 0, GROUND, W, 8, INK); box(ctx, 0, 612, W, 6, '#6b9d59');
    dots(ctx, 0, 666, W, 54, '#ba9a66', 14, 1.5);
    line(ctx, [[0,653],[1280,653]], '#c4a773', 2);
    for (let x = 36; x < W; x += 105) line(ctx, [[x,619],[x - 24,653]], '#c4a773', 2);
    text(ctx, '城市綠洲 / WALK • RUN • 發爛渣', 470, 682, 13, '#6e754f', 410);
  }

  function paddle(ctx, x, y, angle, color, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    box(ctx, -3, 7, 6, 20, '#edbc79', INK, 2);
    oval(ctx, 0, -5, 13, 17, color, INK, 3);
    line(ctx, [[-7,-12],[5,-16]], '#e5f6d1', 2);
    line(ctx, [[-3,19],[3,19]], INK, 2); ctx.restore();
  }
  function sportPerson(ctx, x, y, scale, shirt, facing) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * facing, scale);
    oval(ctx, 0, 2, 22, 5, '#2e737b');
    line(ctx, [[-6,-23],[-13,-4],[-23,0]], INK, 8);
    line(ctx, [[7,-23],[15,-10],[17,0]], INK, 8);
    poly(ctx, [[-12,-57],[8,-60],[18,-34],[-8,-28]], shirt, INK, 2);
    poly(ctx, [[-8,-32],[18,-35],[15,-19],[-7,-16]], '#334f71', INK, 2);
    oval(ctx, -4, -72, 10, 12, '#dca36d', INK, 2);
    line(ctx, [[-15,-78],[6,-79],[13,-75]], '#f6e7ae', 4);
    line(ctx, [[9,-52],[23,-43],[32,-55]], '#dca36d', 6);
    line(ctx, [[-9,-49],[-20,-38]], '#dca36d', 6);
    ctx.restore();
  }
  function court(ctx) {
    box(ctx, 0, 0, W, H, '#9accc3'); box(ctx, 0, 0, W, 310, '#a3dfec');
    dots(ctx, 0, 0, 1280, 180, '#63b2cf', 12, 1.3);
    cloud(ctx, 191, 115, .85); cloud(ctx, 1030, 88, 1.05);
    for (let i = 0; i < 12; i++) {
      const x = i * 116 - 20, y = 237 + i % 3 * 12;
      oval(ctx, x, y, 85, 54, '#73b9a5', '#66a393', 2);
    }
    box(ctx, 0, 291, W, 89, '#70ac9d');
    // Chain-link texture stays high/left, away from the target silhouettes.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 221, 677, 181); ctx.clip();
    for (let x = -190; x < 860; x += 26) {
      line(ctx, [[x,221],[x + 181,402]], '#528f88', 1);
      line(ctx, [[x,221],[x - 181,402]], '#528f88', 1);
    }
    ctx.restore();
    for (let x = 22; x < 700; x += 162) line(ctx, [[x,207],[x,408]], '#3e6972', 5);
    line(ctx, [[0,218],[677,218]], '#3e6972', 4);
    plaque(ctx, 365, 116, 302, 'PICKLEBALL', '匹克球俱樂部', '#ffe16c');
    // Oversize crossed paddles serve as the club's original graphic emblem.
    paddle(ctx, 169, 246, -.6, '#f28662', 2.2);
    paddle(ctx, 223, 246, .6, '#277fb4', 2.2);
    box(ctx, 0, 378, W, 226, '#8dbab0');
    poly(ctx, [[368,341],[632,341],[681,566],[312,566]], '#367eaa', '#356c79', 3);
    // Two non-volley zones on either side of the actual net.
    poly(ctx, [[352,408],[647,408],[659,465],[339,465]], '#51a999');
    poly(ctx, [[379,356],[622,356],[665,552],[330,552]], null, '#e3edc7', 3);
    line(ctx, [[363,412],[635,412]], '#e3edc7', 3);
    line(ctx, [[350,462],[647,462]], '#e3edc7', 3);
    line(ctx, [[501,356],[501,412]], '#e3edc7', 3);
    line(ctx, [[498,462],[498,552]], '#e3edc7', 3);
    // Extra distant court reads as a quiet blue/green plane behind the targets.
    poly(ctx, [[719,376],[1143,376],[1260,563],[698,563]], '#8eb8b6');
    poly(ctx, [[757,395],[1120,395],[1205,547],[727,547]], null, '#a9cac0', 2);
    line(ctx, [[747,441],[1148,441]], '#a9cac0', 2);
    line(ctx, [[926,395],[966,547]], '#a9cac0', 2);
    sportPerson(ctx, 498, 393, .6, '#f3d368', 1);
    // Net has mesh, posts, a drooping top tape, and a bottom cable.
    poly(ctx, [[341,407],[498,413],[660,407],[660,441],[341,441]], '#387080', '#315b6d', 2);
    for (let x = 349; x < 660; x += 10) line(ctx, [[x,413],[x,440]], '#82a7aa', 1);
    for (let y = 420; y < 441; y += 7) line(ctx, [[343,y],[658,y]], '#82a7aa', 1);
    ctx.beginPath(); ctx.moveTo(339,405); ctx.quadraticCurveTo(499,419,663,405);
    finish(ctx, null, '#f4efce', 5);
    for (const x of [338,663]) {
      line(ctx, [[x,400],[x,451]], INK, 5);
      oval(ctx, x, 400, 4, 4, '#f6c864', INK, 2);
    }
    sportPerson(ctx, 473, 543, .79, '#e78869', -1);
    // Sideline seating and equipment, not collidable game objects.
    for (let i = 0; i < 4; i++) box(ctx, 38, 346 + i * 14, 224, 8, '#e6c175', '#43656c', 2);
    line(ctx, [[54,401],[45,449]], '#43656c', 5); line(ctx, [[244,401],[250,449]], '#43656c', 5);
    box(ctx, 88, 454, 74, 43, '#ebcd86', INK, 3);
    line(ctx, [[100,454],[100,441],[149,441],[149,454]], INK, 3);
    paddle(ctx, 196, 470, .5, '#ec8068', 1.3);
    box(ctx, 0, GROUND, W, 116, '#276989');
    box(ctx, 0, GROUND, W, 8, INK); box(ctx, 0, 612, W, 5, '#f8d85c');
    dots(ctx, 0, 658, W, 62, '#1f547b', 12, 1.8);
    line(ctx, [[0,648],[1280,648]], '#4b8aaa', 3);
    text(ctx, 'COURT 02 / DINK • RALLY • REPEAT', 470, 682, 14, '#afd5cc', 450);
    text(ctx, '02', 1205, 672, 49, '#4487a3', 88);
  }

  function neon(ctx, x, y, w, title, subtitle, accent) {
    box(ctx, x + 5, y + 6, w, 62, '#111d3a', INK, 3);
    box(ctx, x, y, w, 62, '#202445', INK, 5);
    box(ctx, x + 5, y + 5, w - 10, 52, null, accent, 3);
    text(ctx, title, x + w / 2, y + 25, 22, accent, w - 20);
    text(ctx, subtitle, x + w / 2, y + 46, 11, '#ffdbac', w - 20);
  }
  function palm(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    poly(ctx, [[-12,0],[-2,-92],[21,-183],[30,-180],[15,-82],[12,0]], '#484c6a', INK, 4);
    for (let i = 0; i < 9; i++) line(ctx, [[-5 + i * 2,-i * 19],[11 + i * 2,-i * 19 - 5]], '#877585', 2);
    const fronds = [
      [[24,-181],[-21,-215],[-69,-207],[-94,-175],[-43,-193]],
      [[24,-181],[52,-226],[102,-225],[126,-202],[65,-206]],
      [[24,-181],[-7,-244],[-46,-248],[-57,-227],[-11,-213]],
      [[24,-181],[78,-193],[127,-166],[139,-126],[91,-166]],
      [[24,-181],[-19,-178],[-58,-145],[-61,-113],[-15,-152]],
      [[24,-181],[40,-242],[70,-259],[80,-246],[55,-218]]
    ];
    for (let i = 0; i < fronds.length; i++) poly(ctx, fronds[i], i % 2 ? '#278b88' : '#286773', INK, 3);
    line(ctx, [[-62,-204],[24,-181],[106,-166]], '#55bbb0', 2); ctx.restore();
  }
  function visitor(ctx, x, y, scale, color, phase = 0) {
    // Opaque jacket, full-length trousers and shoes; background adults only.
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(Math.sin(phase)*.065);
    oval(ctx, 0, -64, 8, 10, color);
    poly(ctx, [[-11,-50],[8,-51],[14,-22],[-14,-22]], color);
    line(ctx, [[-7,-23],[-8,-3],[-13,0]], color, 7);
    line(ctx, [[7,-23],[10,-4],[16,0]], color, 7);
    line(ctx, [[-11,-45],[-20,-35-Math.sin(phase)*12]], color, 6);
    line(ctx, [[10,-45],[20,-38+Math.sin(phase)*12]], color, 6);
    line(ctx, [[-7,-46],[-5,-29]], '#7f6d90', 2); ctx.restore();
  }
  function bangla(ctx) {
    box(ctx, 0, 0, W, H, '#25274e');
    dots(ctx, 0, 0, W, 252, '#514274', 12, 1.6);
    oval(ctx, 898, 79, 33, 33, '#f9cda8', '#454768', 3);
    oval(ctx, 910, 70, 28, 27, '#25274e');
    // Distant street frontage stops above the gameplay area.
    for (let i = 0; i < 9; i++) {
      const x = 570 + i * 83, y = 166 + i * 37 % 90;
      box(ctx, x, y, 78, 157, '#454461', '#555673', 2);
      for (let k = 0; k < 3; k++) box(ctx, x + 9 + k * 22, y + 13, 10, 21, '#77768a');
    }
    // Quiet mauve avenue, rather than a bright rectangle painted over the targets.
    poly(ctx, [[683,305],[1106,305],[1280,492],[1280,604],[0,604],[407,452]], '#625d78');
    poly(ctx, [[732,337],[1083,337],[1179,604],[620,604]], '#67617b');
    line(ctx, [[805,353],[783,590]], '#746d87', 2);
    line(ctx, [[1007,359],[1109,588]], '#746d87', 2);
    box(ctx, 0, 129, 228, 387, '#3c4770', INK, 5);
    poly(ctx, [[228,129],[283,166],[283,499],[228,516]], '#303251', INK, 4);
    box(ctx, 23, 151, 182, 71, '#253250', INK, 3);
    for (let i = 0; i < 4; i++) box(ctx, 34 + i * 43, 160, 28, 53, '#467994', '#55d2d0', 2);
    line(ctx, [[14,236],[219,236]], '#ef63b8', 5);
    box(ctx, 271, 215, 181, 301, '#66415e', INK, 5);
    box(ctx, 292, 236, 139, 49, '#292944', '#cc6298', 3);
    for (let x = 306; x < 430; x += 31) line(ctx, [[x,239],[x,282]], '#ad6489', 3);
    box(ctx, 463, 268, 166, 240, '#364967', INK, 4);
    poly(ctx, [[463,269],[490,244],[640,244],[629,269]], '#556484', INK, 3);
    for (let x = 18; x < 214; x += 47) box(ctx, x, 351, 32, 133, '#242b47', '#59658a', 3);
    for (let x = 288; x < 432; x += 47) box(ctx, x, 387, 33, 96, '#30273e', '#a56484', 2);
    box(ctx, 486, 389, 113, 112, '#202b45', '#42738b', 3);
    // Original invented venue names; constant neon color, no blinking/blur.
    neon(ctx, 21, 266, 199, 'MANGO COMET', 'LIVE MUSIC / 星芒樂社', '#62e4e1');
    neon(ctx, 286, 313, 153, 'VELVET TIDE', 'FICTIONAL MUSIC BAR', '#ff87c9');
    neon(ctx, 469, 297, 157, 'PINK ORBIT', 'SOUND ROOM / 聲音室', '#64d8e9');
    // Striped canopies and balcony railings frame the left, not the launch arc.
    for (let i = 0; i < 7; i++) {
      poly(ctx, [[i * 33,333],[i * 33 + 33,333],[i * 33 + 42,349],[i * 33 - 6,349]], i % 2 ? '#c16c9a' : '#384e75', INK, 1);
    }
    line(ctx, [[12,241],[217,241],[217,262],[12,262],[12,241]], INK, 3);
    for (let x = 28; x < 220; x += 23) line(ctx, [[x,241],[x,262]], '#8c7b99', 2);
    // Tall right-hand façade lives outside the protected target area.
    box(ctx, 1174, 168, 106, 373, '#43385c', INK, 5);
    for (let i = 0; i < 5; i++) box(ctx, 1193, 193 + i * 61, 73, 36, '#29455e', '#6ebcc4', 2);
    box(ctx, 1224, 214, 48, 196, '#252b49', '#ec75bd', 4);
    for (let i = 0; i < 4; i++) text(ctx, ['夜','色','音','樂'][i], 1248, 242 + i * 45, 25, '#f08abe', 36);
    neon(ctx, 722, 214, 413, 'BANGLA STREET', '布吉・不夜街', '#63e2e4');
    line(ctx, [[748,212],[748,189],[1113,189],[1113,212]], '#787085', 3);
    palm(ctx, 67, 525, 1.07); palm(ctx, 657, 479, .62); palm(ctx, 1250, 540, .79);
    // Restrained flat reflections: none cross the target silhouettes as neon streaks.
    for (let i = 0; i < 5; i++) {
      poly(ctx, [[67 + i * 113,553],[107 + i * 113,553],[92 + i * 113,576],[39 + i * 113,576]], i % 2 ? '#986586' : '#537f8e');
    }
    box(ctx, 0, GROUND, W, 116, '#333750');
    box(ctx, 0, GROUND, W, 8, INK); box(ctx, 0, 612, W, 5, '#a77ca2');
    for (let x = 0; x < W; x += 91) {
      box(ctx, x, 618, 72, 9, '#635670');
      line(ctx, [[x,647],[x - 34,720]], '#4c4967', 2);
    }
    line(ctx, [[0,647],[1280,647]], '#4c4967', 3);
    dots(ctx, 0, 680, W, 40, '#202d46', 13, 1.8);
    text(ctx, 'PHUKET / NIGHT NOTES & NEON SKIES', 476, 674, 13, '#ab8eae', 460);
  }

  function satellite(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.18); ctx.scale(scale, scale);
    line(ctx, [[-88,0],[88,0]], '#a6d5d5', 6);
    for (const sx of [-107,38]) {
      box(ctx, sx, -27, 68, 54, '#346ab1', INK, 3);
      for (let col = 1; col < 4; col++) line(ctx, [[sx + col * 17,-26],[sx + col * 17,26]], '#78c4e6', 1);
      line(ctx, [[sx,0],[sx + 68,0]], '#78c4e6', 1);
    }
    poly(ctx, [[-26,-20],[18,-20],[29,0],[18,20],[-26,20]], '#dfd5b5', INK, 3);
    oval(ctx, -22, 0, 9, 20, '#8caebd', INK, 2);
    line(ctx, [[5,-20],[11,-44],[26,-52]], '#d9dcbf', 3);
    oval(ctx, 26, -52, 10, 5, '#e5d9a6', INK, 2); ctx.restore();
  }
  function space(ctx) {
    box(ctx, 0, 0, W, H, '#698496');
    // Panoramic orbital window: framing is architectural, not gameplay geometry.
    poly(ctx, [[87,64],[1167,64],[1222,123],[1222,420],[1168,474],[88,474],[36,421],[36,119]], '#142c4d', INK, 8);
    dots(ctx, 65, 84, 1136, 205, '#254369', 15, 1.6);
    for (let i = 0; i < 75; i++) {
      const x = 75 + (i * 173 % 1110), y = 89 + (i * 71 % 204);
      oval(ctx, x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1, '#a7c9dd');
    }
    poly(ctx, [[54,317],[207,315],[346,292],[570,306],[807,300],[1209,309],[1209,419],[1163,462],[90,462],[50,419]], '#253d5a');
    // Earth uses clipped flat continent silhouettes and inked cloud bands.
    oval(ctx, 318, 266, 163, 163, '#83d9e4', INK, 5);
    ctx.save(); ctx.beginPath(); ctx.arc(318, 266, 151, 0, TAU); ctx.clip();
    box(ctx, 160, 110, 316, 316, '#348fd0');
    poly(ctx, [[179,181],[216,163],[253,185],[264,215],[290,220],[294,250],[266,269],[259,299],[238,301],[220,261],[187,247],[173,215]], '#89c18d', '#245c83', 3);
    poly(ctx, [[281,297],[311,282],[343,294],[358,330],[340,357],[326,398],[300,411],[303,365]], '#a4ce96', '#245c83', 3);
    poly(ctx, [[356,139],[395,142],[431,178],[419,204],[452,224],[437,254],[399,245],[380,220],[343,211],[336,180]], '#9ccf9a', '#245c83', 3);
    poly(ctx, [[382,262],[414,266],[417,290],[394,313],[371,291]], '#aacb8b', '#245c83', 2);
    dots(ctx, 331, 112, 153, 310, '#286daa', 10, 1.8);
    for (const band of [[183,197,85],[263,165,66],[338,236,91],[231,330,69],[345,367,60]]) {
      const [x,y,w] = band;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x + w / 2,y - 17,x + w,y - 2);
      finish(ctx, null, '#e2eedc', 7);
    }
    ctx.restore();
    // Ringed fictional planet, with separate rear/front ring arcs.
    ctx.save(); ctx.translate(977, 163); ctx.rotate(-.32);
    oval(ctx, 0, 0, 109, 27, '#766c9c', '#b6a1bf', 3);
    oval(ctx, 0, 0, 58, 58, '#d49b91', INK, 3);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 56, 0, TAU); ctx.clip();
    for (let i = 0; i < 4; i++) box(ctx, -60, -37 + i * 26, 120, 9, '#bd8491');
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, 0, 109, 27, 0, 0, Math.PI);
    finish(ctx, null, '#ddc2a3', 10); ctx.restore();
    satellite(ctx, 654, 224, .73);
    // Quiet, broad station bulkhead behind targets; detail pushed to left/top.
    box(ctx, 0, 481, W, 123, '#718796');
    line(ctx, [[0,480],[1280,480]], '#586f83', 9);
    line(ctx, [[699,510],[1137,510]], '#7c92a0', 2);
    line(ctx, [[700,563],[1137,563]], '#7c92a0', 2);
    for (const x of [43,548,1218]) {
      poly(ctx, [[x,72],[x + 19,72],[x + 19,442],[x + 38,478],[x - 16,478],[x,442]], '#809fae', INK, 4);
      line(ctx, [[x + 6,93],[x + 6,424]], '#b3d4d6', 3);
      for (let y = 109; y < 440; y += 92) oval(ctx, x + 9, y, 3, 3, INK);
    }
    plaque(ctx, 613, 17, 485, '富林太空站', 'FULIN SPACE STATION', '#b9e1dc');
    box(ctx, 79, 501, 420, 88, '#364f68', INK, 4);
    for (let i = 0; i < 3; i++) {
      box(ctx, 91 + i * 132, 512, 117, 44, '#173e56', '#7caaaf', 2);
      line(ctx, [[100 + i * 132,541],[114 + i * 132,535],[128 + i * 132,544],[148 + i * 132,520],[171 + i * 132,537],[194 + i * 132,531]], '#70c4c1', 2);
      for (let j = 0; j < 5; j++) box(ctx, 97 + i * 132 + j * 21, 570, 12, 5, j === 1 ? '#d8b968' : '#85aaa9');
    }
    text(ctx, 'ORBITAL OBSERVATORY / DECK 04', 287, 458, 12, '#a9c6ce', 394);
    box(ctx, 0, GROUND, W, 116, '#3e536c');
    box(ctx, 0, GROUND, W, 8, INK); box(ctx, 0, 612, W, 5, '#95e4e3');
    for (let x = -160; x < 1450; x += 185) {
      poly(ctx, [[x + 35,632],[x + 148,632],[x + 182,712],[x - 18,712]], '#50657b', '#2a4058', 2);
      line(ctx, [[x + 45,640],[x + 135,640]], '#668295', 2);
    }
    box(ctx, 832, 649, 298, 39, '#33485f', '#829b9f', 2);
    text(ctx, 'DOCK 04 / 富林', 981, 669, 20, '#bfd6ce', 274);
    for (let i = 0; i < 7; i++) poly(ctx, [[33 + i * 34,618],[48 + i * 34,618],[34 + i * 34,636],[19 + i * 34,636]], '#dabb6c');
    text(ctx, 'STANDARD GRAVITY / 1 g', 469, 681, 13, '#abc3c8', 305);
  }

  // All ambient work is bounded and analytically positioned (no random/delta state).
  function ambient(ctx, theme, t) {
    if (theme === 'park') {
      for (let i = 0; i < 3; i++) {
        const x = 728 + i * 64 + Math.sin(t * .17 + i) * 15;
        const y = 98 + i % 2 * 26 + Math.sin(t * .31 + i) * 5;
        const wing = 4 + Math.sin(t * 1.6 + i) * 2;
        line(ctx, [[x - 9,y - wing],[x,y],[x + 9,y - wing]], '#568f92', 2);
      }
      for(let i=0;i<5;i++){
        const phase=(t*.065+i*.2)%1;
        ctx.save();ctx.translate(380+phase*170+Math.sin(t+i)*8,190+phase*300);ctx.rotate(t*.6+i);
        oval(ctx,0,0,6,2.5,i%2?'#ad984e':'#579765');ctx.restore();
      }
    } else if (theme === 'court') {
      // Rally entirely within the left-hand background court, never a physics ball.
      const phase = t * .95, travel = (1 - Math.cos(phase)) / 2;
      const x = 523 - travel * 78, y = 356 + travel * 150 - Math.sin(phase) ** 2 * 47;
      paddle(ctx, 525, 353, -.4 + Math.cos(phase) * .18, '#edc867', .7);
      paddle(ctx, 444, 498, .6 - Math.cos(phase) * .2, '#db956b', .8);
      oval(ctx, x, y, 7, 7, '#f2e966', '#687854', 1.5);
      for (const [dx,dy] of [[-3,-2],[2,-3],[0,2],[4,2]]) oval(ctx, x + dx, y + dy, 1.1, 1.1, '#727e43');
    } else if (theme === 'bangla') {
      for(let i=0;i<6;i++)visitor(ctx,301+i*52,526+i%2*14,.58+i%3*.07,'#35314c',t*2.3+i);
      for(let i=0;i<3;i++){
        const phase=(t*.25+i/3)%1;
        ctx.save();ctx.globalAlpha=(1-phase)*.7;
        text(ctx,i%2?'♪':'♫',347+i*58+Math.sin(t+i)*7,410-phase*60,17,i%2?'#72e2e4':'#fa91cb',30);ctx.restore();
      }
      // Two low-opacity slow searchlights are clipped to sky, not the target area.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 208); ctx.clip();
      for (let i = 0; i < 2; i++) {
        const x = 484 + i * 219, tip = x + Math.sin(t * .16 + i * 2) * 145;
        poly(ctx, [[x,215],[tip - 71,0],[tip + 71,0]], i ? '#ff92d311' : '#74e2ed16');
      }
      ctx.restore();
    } else {
      // A small inspection craft makes a slow orbit in the upper window only.
      const x = 756 + Math.sin(t * .12) * 53, y = 135 + Math.cos(t * .12) * 13;
      poly(ctx, [[x - 13,y],[x,y - 7],[x + 17,y],[x,y + 5]], '#87b1c5', '#34546d', 2);
      oval(ctx, x + 2, y - 2, 4, 2, '#d6e9d9');
    }
  }

  const painters = { park, court, bangla, space };
  function themeKey(theme) {
    return typeof theme === 'string' && Object.prototype.hasOwnProperty.call(themes, theme) ? theme : 'park';
  }
  function scene(theme) {
    if (!cache[theme]) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('BongiArt requires a Canvas 2D context.');
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      painters[theme](ctx);
      cache[theme] = canvas;
    }
    return cache[theme];
  }

  /** Paint in world coordinates; honors caller transform/clip, restores drawing state.
   * @param {CanvasRenderingContext2D} ctx Destination 2D context.
   * @param {string} [theme='park'] Unknown values safely select park.
   * @param {number} [time=0] Elapsed seconds, not requestAnimationFrame milliseconds.
   * @param {boolean} [low=false] Freeze ambient at exactly t=0, retaining full art.
   */
  function draw(ctx, theme = 'park', time = 0, low = false) {
    const key = themeKey(theme), t = low || !Number.isFinite(time) ? 0 : time;
    const image = scene(key);
    ctx.save();
    try {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.shadowColor = 'transparent'; ctx.filter = 'none';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.drawImage(image, 0, 0);
      ambient(ctx, key, t);
    } finally { ctx.restore(); }
  }

  /** Optional main-page hero: same arguments/world size/cache as draw().
   * Adds an original clothed comic mascot and car; NEVER use for gameplay scenery.
   * Example: scale a title canvas context by canvas.width/1280, canvas.height/720,
   * then call BongiArt.draw.hero(ctx, 'park', 0, true). No additional canvas cache.
   */
  draw.hero = function hero(ctx, theme = 'park', time = 0, low = false) {
    draw(ctx, theme, time, low);
    ctx.save();
    try {
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.filter = 'none';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      // Graphic flight arc and mint commuter, not an external portrait.
      ctx.setLineDash([5,13]); ctx.beginPath(); ctx.moveTo(259,458);
      ctx.bezierCurveTo(327,288,478,241,648,327); finish(ctx, null, '#fff5d7', 5); ctx.setLineDash([]);
      poly(ctx, [[90,490],[120,420],[283,420],[320,489],[349,505],[349,577],[71,577],[71,507]], '#4ebfad', INK, 6);
      poly(ctx, [[133,433],[186,433],[186,485],[113,485]], '#cdf0de', INK, 4);
      poly(ctx, [[200,433],[271,433],[296,485],[200,485]], '#244b57', INK, 4);
      box(ctx, 79, 524, 260, 15, '#ffe091');
      box(ctx, 219, 500, 28, 7, INK);
      for (const x of [128,294]) { oval(ctx, x, 576, 29, 29, INK); oval(ctx, x, 576, 13, 13, '#d3d8bb'); }
      text(ctx, 'BONGI', 147, 552, 17, INK, 114);
      const bob=low?0:Math.sin(time*2)*5;
      ctx.translate(699, 336+bob); ctx.rotate(-.18);
      poly(ctx, [[-100,48],[-158,81],[-183,61],[-174,110],[-128,104],[-72,76]], '#215b68', INK, 5);
      poly(ctx, [[-73,68],[-117,126],[-156,125],[-160,143],[-108,149],[-35,92]], '#346e7c', INK, 5);
      poly(ctx, [[-78,-10],[-28,-33],[45,-1],[23,94],[-75,88],[-105,39]], '#ecba42', INK, 5);
      line(ctx, [[-83,8],[-119,-13],[-142,-48]], INK, 22);
      line(ctx, [[-83,8],[-119,-13],[-142,-48]], '#edc183', 14);
      line(ctx, [[29,9],[78,-7],[102,-44]], INK, 22);
      line(ctx, [[29,9],[78,-7],[102,-44]], '#edc183', 14);
      oval(ctx, 2, -64, 64, 68, '#efc18c', INK, 6);
      poly(ctx, [[-60,-76],[-50,-117],[-18,-139],[16,-135],[40,-118],[58,-95],[29,-105],[2,-119],[-30,-107]], '#253d49', INK, 4);
      for (const x of [-24,29]) {
        oval(ctx, x, -69, 23, 20, '#fbf5d6', INK, 5);
        oval(ctx, x + 5, -66, 5, 7, INK);
      }
      line(ctx, [[-1,-73],[7,-73]], INK, 5);
      line(ctx, [[-45,-100],[-15,-91]], INK, 5); line(ctx, [[15,-91],[44,-102]], INK, 5);
      poly(ctx, [[-18,-29],[25,-31],[17,-12],[-4,-9]], '#fff4d6', INK, 4);
      text(ctx, 'B!', -26, 35, 43, INK, 65);
      line(ctx, [[-64,64],[9,66]], '#d99535', 3);
    } finally { ctx.restore(); }
  };

  window.BongiArt = { draw, themes };
})();