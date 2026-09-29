/* Native-script extension. Rendering only: the caller owns damage and abilities. */
(() => {
  'use strict';

  const types = {
    mud: { name: '泥臭臭', hp: 64, r: 25, mass: 1.1, points: 1000, description: '普通泥臭臭，廢柴一隻，撞冧支架就搞撚掂。', color: '#9caa61' },
    vendor: { name: '小販', hp: 64, r: 27, mass: 1.1, points: 1000, description: '嘴硬小販，把口臭過鹹魚，小心腳下啲支架。', color: '#cb8d5d' },
    performer: { name: '脫衣舞女', hp: 64, r: 25, mass: 1.1, points: 1000, description: '小心仙人跳，俾人報警拉撚咗就唔好啦。', color: '#af83b4' },
    helmet: { name: '職安真漢子', hp: 90, r: 27, mass: 1.3, points: 1250, description: '護盾擋到一鑊撞擊或爆破；毒霧可以穿盾，盾一破就隨便砌佢。', color: '#a6ad69' },
    soda: { name: '汽水背包泥臭臭', hp: 55, r: 25, mass: 1.1, points: 1250, description: '擊倒後汽水爆撚開，附近啲敵人同支架冚唪唥一齊遭殃。', color: '#63bba2' },
    brute: { name: '重裝泥臭臭', hp: 200, r: 36, mass: 2.5, points: 2000, description: '大型重裝頭目，硬淨到鬼咁；靠墜落、支架同汽水連鎖先砌得低佢。', color: '#9870b5' }
  };
  const INK = '#263344';
  Object.assign(types,{
    shield:{name:'護盾兵',hp:110,r:28,mass:1.5,points:1400,color:'#6bb8d5',description:'一次護盾擋撞擊與爆破；毒霧可穿盾。'},
    repair:{name:'維修兵',hp:90,r:25,mass:1.2,points:1500,color:'#78c4a0',description:'附近 210 範圍每 2 秒修復 28 HP，每波最多兩次，不會復活。'},
    commander:{name:'指揮官',hp:160,r:30,mass:1.7,points:1800,color:'#d794ba',description:'附近 220 範圍友軍減傷 25%；先擊倒指揮官解除。'},
    boss:{name:'機械核心',hp:520,r:42,mass:4,points:5000,color:'#e6ae52',description:'每 10 波出現；兩根電力支柱維持護甲。拆柱或抓住每 3 秒一次的 1 秒開放窗口。'}
  });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function finish(ctx, fill, edge = INK, width = 2) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke(); }
  }
  function oval(ctx, x, y, rx, ry, fill, edge = null, width = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); finish(ctx, fill, edge, width);
  }
  function path(ctx, points, fill, edge = INK, width = 2) {
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    if (fill) ctx.closePath();
    finish(ctx, fill, edge, width);
  }
  function box(ctx, x, y, w, h, fill, edge = INK, width = 2) {
    ctx.beginPath(); ctx.rect(x, y, w, h); finish(ctx, fill, edge, width);
  }
  function text(ctx, value, x, y, size, color = INK) {
    ctx.font = `900 ${size}px "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }
  function mud(ctx, color) {
    ctx.beginPath(); ctx.moveTo(-24, 19);
    ctx.bezierCurveTo(-32, 4, -23, -20, -11, -22);
    ctx.bezierCurveTo(-5, -32, 5, -28, 10, -22);
    ctx.bezierCurveTo(26, -25, 31, 5, 24, 19);
    ctx.quadraticCurveTo(0, 29, -24, 19); ctx.closePath(); finish(ctx, color, INK, 2.8);
    oval(ctx, -16, 12, 5, 3, '#ffffff35'); oval(ctx, 18, 14, 4, 2, '#26334430');
    for (const [x, y] of [[-20, 4], [-16, 7], [18, 4], [21, 8]]) oval(ctx, x, y, .9, .9, '#26334455');
  }
  function hardhat(ctx, shield) {
    // The hat stays; the blue face shield and intact badge disappear together.
    ctx.beginPath(); ctx.moveTo(-24, -19);
    ctx.quadraticCurveTo(-25, -39, 0, -39); ctx.quadraticCurveTo(25, -39, 24, -19);
    ctx.closePath(); finish(ctx, shield ? '#ffcd54' : '#cda35e', INK, 2.5);
    box(ctx, -4, -39, 8, 19, '#ffe895');
    path(ctx, [[-28, -20], [27, -20], [29, -15], [-29, -15]], '#f6b342');
    path(ctx, [[-18, -27], [-16, -32], [-10, -34]], null, '#fff3b0', 2);
    if (shield) {
      path(ctx, [[-25, -13], [25, -13], [22, 11], [0, 20], [-22, 11]], '#9de2ed55', '#d4fbf3', 2);
      path(ctx, [[-20, -10], [-22, 7], [0, 16], [21, 8]], null, '#467a91', 1.5);
      path(ctx, [[-17, -8], [-10, -11]], null, '#ffffff', 2);
      path(ctx, [[12, 11], [25, 11], [24, 21], [18, 25], [12, 21]], '#75d4dd');
      text(ctx, '1', 18, 18, 10);
    } else {
      path(ctx, [[6, -34], [2, -28], [9, -26], [5, -20]], null, '#76503f', 2);
      box(ctx, -27, -13, 4, 6, '#72818c'); box(ctx, 23, -13, 4, 6, '#72818c');
      path(ctx, [[12, 14], [24, 14], [24, 22], [12, 22]], '#f8ba90');
      path(ctx, [[15, 16], [21, 20]], null, '#9a483e', 2);
    }
  }
  function pack(ctx, t) {
    box(ctx, 13, -22, 17, 39, '#446778', INK, 2.5);
    for (const [x, color] of [[17, '#f88d65'], [28, '#f9ce59']]) {
      box(ctx, x - 5, -27, 10, 36, color);
      oval(ctx, x, -27, 5, 3, '#d7e4df', INK, 1.5);
      oval(ctx, x, -27, 2, 1, '#556b77');
      box(ctx, x - 5, -16, 10, 10, '#fff1c4', null);
      path(ctx, [[x + 1, -15], [x - 2, -10], [x + 2, -10], [x - 1, -6]], null, '#c85946', 1.5);
      path(ctx, [[x - 3, -23], [x - 3, -19]], null, '#ffffffa0', 1.5);
    }
    path(ctx, [[26, -28], [26, -34], [13, -34], [10, -22]], null, INK, 3);
    oval(ctx, 21, -34, 6, 6, '#fff6d9', INK, 1.5);
    const needle = -.8 + Math.sin(t * 1.6) * .1;
    path(ctx, [[21, -34], [21 + Math.cos(needle) * 4, -34 + Math.sin(needle) * 4]], null, '#c25746', 1.5);
  }
  function vest(ctx, t, damaged) {
    path(ctx, [[-23, -1], [-14, -4], [-8, 4], [8, 4], [15, -4], [24, 0], [25, 20], [-25, 20]], '#4d596e', INK, 2.5);
    path(ctx, [[-20, 0], [-17, 18], [-11, 18], [-12, 3]], '#e8b756', INK, 1);
    path(ctx, [[14, 2], [11, 18], [18, 18], [21, 0]], '#e8b756', INK, 1);
    box(ctx, -22, 10, 44, 4, '#f9dfa0', null);
    box(ctx, -7, 7, 14, 13, '#788699'); text(ctx, 'B', 0, 14, 10, '#fff0bb');
    for (const x of [-22, 22]) {
      oval(ctx, x, 0, 5, 4, '#9eabba', INK, 1.5);
      oval(ctx, x, 0, 1.2, 1.2, '#e8e9d9');
    }
    if (damaged) path(ctx, [[-5, 8], [0, 11], [-3, 15], [4, 18]], null, '#332c4d', 1.5);
    path(ctx, [[18, -19], [23, -35], [28 + Math.sin(t * 1.8), -40]], null, INK, 2.5);
    oval(ctx, 28 + Math.sin(t * 1.8), -40, 3, 3, '#f8a776', INK, 1.5);
  }
  function face(ctx, kind, blink, threatened, vulnerable) {
    const brute = kind === 'brute', y = brute ? -11 : -5;
    const eyeH = blink ? 1 : threatened ? 9 : 7;
    for (const x of [-9, 9]) {
      oval(ctx, x, y, 6, eyeH, '#fff7db', INK, 1.2);
      if (!blink) oval(ctx, x - 1.8, y + 1, 2, threatened ? 3.6 : 3, INK);
    }
    path(ctx, [[-17, y - 10], [-4, y - (brute ? 5 : 8)]], null, INK, brute ? 3.5 : 2.5);
    path(ctx, [[4, y - (brute ? 5 : 8)], [17, y - 10]], null, INK, brute ? 3.5 : 2.5);
    if (threatened || vulnerable) oval(ctx, 0, y + 17, 4, 5, '#61404e', INK, 1.5);
    else if (brute) {
      box(ctx, -9, -1, 18, 6, '#fff3d1', INK, 1.5);
      path(ctx, [[-3, 0], [-3, 4]], null, INK, 1);
      path(ctx, [[3, 0], [3, 4]], null, INK, 1);
    } else path(ctx, [[-6, 10], [0, 13], [7, 9]], null, INK, 2);
  }

  /** Returns false for legacy/unknown kinds without touching ctx or b.
   * time is seconds; low freezes breath, blink, squash, gauge and antenna.
   * b.cooldown (optional, seconds) supplies a non-periodic impact tint.
   * b.shield, b.hp/maxHp and all physics state are strictly read-only.
   */
  function draw(ctx, b, time = 0, low = false, threatened = false) {
    if (!b || !['helmet', 'soda', 'brute','shield','repair','commander','boss'].includes(b.kind)) return false;
    const def = types[b.kind], r = b.r || def.r;
    const t = low ? 0 : (Number.isFinite(time) ? time : 0);
    const phase = low ? 0 : (b.id || 0) * .63;
    const breath = low ? 0 : Math.sin(t * 2.3 + phase) * .018;
    const squash = low ? 0 : clamp(b.squash || 0, 0, .8) * .3;
    const health = clamp((b.hp ?? def.hp) / (b.maxHp > 0 ? b.maxHp : def.hp), 0, 1);
    const vulnerable = b.kind === 'helmet' && !b.shield;
    const blink = !low && (t + phase) % 5.3 < .13;
    ctx.save();
    try {
      ctx.translate(b.x, b.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.save();
      try {
        ctx.rotate(b.angle || 0);
        ctx.translate(0, r); ctx.scale(1 + breath + squash, 1 - breath - squash); ctx.translate(0, -r);
        ctx.scale(r / 27, r / 27);
        if (b.kind === 'soda') pack(ctx, t);
        mud(ctx, def.color);
        // A single low-opacity tint follows the existing impact cooldown: no oscillator/strobe.
        if (!low && b.cooldown > 0) {
          ctx.save(); ctx.globalAlpha *= .16 * clamp(b.cooldown / .18, 0, 1);
          mud(ctx, '#fff2ca'); ctx.restore();
        }
        if (b.kind === 'brute') vest(ctx, t, health < .55);
        if (b.kind === 'soda') {
          path(ctx, [[-15, -18], [-10, 19], [-4, 20], [-9, -18]], '#526675', INK, 1.5);
          path(ctx, [[11, -18], [8, 20], [14, 19], [17, -17]], '#526675', INK, 1.5);
          box(ctx, -15, 15, 30, 6, '#f7d563'); text(ctx, '汽', 0, 18, 8);
        }
        face(ctx, b.kind, blink, threatened, vulnerable);
        if (b.kind === 'helmet') hardhat(ctx, !!b.shield);
        if (b.kind === 'shield') hardhat(ctx, !!b.shield);
        if (b.kind === 'repair') {box(ctx,-12,-36,24,16,'#fff6dd');text(ctx,'+',0,-28,20,'#358577');}
        if (b.kind === 'commander') {path(ctx,[[-23,-21],[-23,-37],[-11,-28],[0,-40],[12,-28],[23,-37],[23,-21]],'#ffd86b');text(ctx,'★',0,12,18);}
        if (b.kind === 'boss') {vest(ctx,t,health<.5);oval(ctx,0,-9,12,12,b.coreOpen?'#a6efa7':'#eea355',INK,2);text(ctx,b.coreOpen?'開':'鎖',0,-9,12);}
        if (health < .5) path(ctx, [[-21, -2], [-18, 1], [-21, 4]], null, '#644e57', 1.5);
        if (threatened) {
          const drop = low ? 0 : Math.sin(t * 3 + phase) * 2;
          path(ctx, [[-30, -13 + drop], [-34, -5 + drop], [-30, -2 + drop], [-27, -6 + drop]], '#9be8f2', INK, 1.3);
          text(ctx, '!', -33, -24, 16, '#a8463c');
        }
      } finally { ctx.restore(); }
      // Upright status plates stay readable even when a body tumbles.
      const label = ['shield','repair','commander','boss'].includes(b.kind)?`${def.name}${b.kind==='shield'?(b.shield?' · 有盾':' · 盾破'):''}`:b.kind === 'helmet' ? (b.shield ? '安全帽 · 擋一鑊' : '盾破 · 砌佢啦！')
        : b.kind === 'soda' ? '汽水 · 一冧就爆' : '重裝 · 硬到鬼';
      const top = -r * 1.62 - 24, width = b.kind === 'brute' ? 90 : 86;
      box(ctx, -width / 2, top, width, 17, '#fff6dd', INK, 1.4);
      text(ctx, label, 0, top + 8.5, 10, vulnerable ? '#a34438' : INK);
      box(ctx, -24, top + 20, 48, 5, '#e5dfcd', INK, 1);
      if (health > 0) box(ctx, -23, top + 21, 46 * health, 3, health < .35 ? '#c57653' : def.color, null);
    } finally { ctx.restore(); }
    return true;
  }

  window.BongiEnemies = { types, draw };
})();