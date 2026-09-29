/* 憤怒的邦基 — original offline Canvas game, no libraries or network requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = 1280, H = 720, GROUND = 604, GRAVITY = 740, DT = 1 / 120;
  const ANCHOR = { x: 226, y: 432 }, MAX_PULL = 111, POWER = 8.05;
  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const quotes = ['屌你老母！撞死你班撚樣！', '係咪唔撚玩得？', '一出嚟就死，屌！', '唔撚玩啦，戇鳩！', 'u u wa wa uwa', '仆街啦你哋！', '食屎啦！冚家剷！', '死撚開啲，唔好阻住我砌！', '頂你個肺，再嚟多次！', '痴撚線！邊個整飛我個眼鏡？', '柒頭，企定啲，唔好咁戇鳩！', '屌你老母，今次真係大含撚喇！'];
  const events = {
    miss: { title: '送撚咗頭！', detail: '方向失控 · 今次直接 MISS，俾你老母笑撚到仆街！', icon: '↖' },
    glasses: { title: '眼鏡飛撚埋！', detail: '睇唔撚清呀！模糊 2.4 秒後恢復，屌你老母', icon: '◎' },
    pants: { title: '條褲爆撚左軚！', detail: '底褲仲喺度 · 彈射力 +28%，好撚肉酸呀！', icon: '✦' },
    train: { title: '化身火車頭！', detail: '高速實體撞擊 · 首次接觸爆破半徑 135，唔使咁戇鳩', icon: '▣' },
    headwind: { title: '性無能', detail: '今發水平速度 -10%，但你仲有得屌，唔使咁死氣', icon: '↤' },
    heavy: { title: '好撚重呀', detail: '今發重力 +12%，冇強制射失，但你都識屌', icon: '↓' },
    fog: { title: '霧霾來襲', detail: '2 秒淡霧；目標輪廓及瞄準仍可見，唔好再瞎撚咁砌', icon: '≋' },
    boost: { title: '瘋狂射精', detail: '大爆射，今發速度 +12%，屌你老母猛！', icon: '↗' },
    shield: { title: 'Lady Boy加護', detail: '抵擋下一次不利事件（最多 2 層），唔好屌你老母咁弱', icon: '◇' },
    bonus: { title: '泰國小販補給', detail: '立即 +1 發，最多 8 發，屌你老母有得打', icon: '+' }
  };
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const art = window.BongiArt;
  const heroCanvas = $('heroCanvas'), heroCtx = heroCanvas.getContext('2d');
  const defaultSettings = { chance: 24, low: motionPreference.matches, sound: false, scene: 'bangla', music: true, musicVolume: .25, sfxVolume: .45, impact: true };
  let settings = { ...defaultSettings }, records = {};
  try {
    const saved = JSON.parse(localStorage.getItem('bongi-settings') || '{}');
    settings = { chance: Number.isFinite(saved.chance) ? clamp(saved.chance, 0, 100) : 24,
      low: typeof saved.low === 'boolean' ? saved.low : defaultSettings.low, sound: saved.sound === true,
      scene: Object.prototype.hasOwnProperty.call(art.themes, saved.scene) ? saved.scene : 'bangla',
      music: saved.music !== false, musicVolume: Number.isFinite(saved.musicVolume)?clamp(saved.musicVolume,0,.4):.25,
      sfxVolume: Number.isFinite(saved.sfxVolume)?clamp(saved.sfxVolume,0,1):.45, impact: saved.impact !== false };
    const data = JSON.parse(localStorage.getItem('bongi-records') || '{}');
    if (data && typeof data === 'object') records = data;
  } catch (_) { /* Storage is optional, including file:// and private browsing. */ }
  function save() { try { localStorage.setItem('bongi-settings', JSON.stringify(settings)); localStorage.setItem('bongi-records', JSON.stringify(records)); } catch (_) { /* Still playable. */ } }
  const portrait = new Image();
  let portraitReady = false;
  portrait.onload = () => { portraitReady = true; };
  portrait.src = './resource/邦基.jpeg';
  const homePortrait = document.querySelector('.hero-bongi img');
  function homeFallback() { homePortrait.hidden = true; document.querySelector('.fallback-face').hidden = false; }
  homePortrait.addEventListener('error', homeFallback);
  if (homePortrait.complete && !homePortrait.naturalWidth) homeFallback();

  const audio = window.BongiAudio;
  function sound(kind) { audio.play(kind); }
  function syncAudio() {
    audio.configure(settings);
    audio.setPaused(document.hidden || paused || $('pauseDialog').open || $('helpDialog').open || $('settingsDialog').open || $('bestiaryDialog').open);
  }

  let id = 0;
  function body(type, x, y, options = {}) {
    const r = options.r || 25, w = options.w || r * 2, h = options.h || r * 2;
    const mass = options.mass || (type === 'block' ? w * h / 1600 : type === 'bongi' ? 3.6 : 1.1);
    const rect = type === 'block';
    return { id: ++id, type, x, y, r, w, h, shape: rect ? 'box' : 'circle',
      vx: 0, vy: 0, angle: 0, spin: 0, invMass: 1 / mass,
      invI: 1 / (rect ? mass * (w * w + h * h) / 12 : mass * r * r / 2),
      hp: type === 'enemy' ? 64 : options.material === 'glass' ? 48 : 105,
      maxHp: type === 'enemy' ? 64 : options.material === 'glass' ? 48 : 105,
      cooldown: 0, poison: 0, alive: true, material: 'wood', kind: 'mud', ...options };
  }
  const block = (x, y, w, h, material = 'wood') => {
    const hp={wood:105,glass:48,stone:220,metal:320,elastic:130}[material]||105;
    const density={stone:1.7,metal:2.2,elastic:.8}[material]||1;
    return body('block', x, y, { w, h, material,hp,maxHp:hp,mass:w*h/1600*density });
  };
  const enemy = (x, y, kind = 'mud') => {
    const def=window.BongiEnemies.types[kind]||window.BongiEnemies.types.mud;
    return body('enemy',x,y,{kind,r:def.r,mass:def.mass,hp:def.hp,maxHp:def.hp,shield:kind==='helmet'||kind==='shield',points:def.points});
  };
  function tower(x, width = 160, base = GROUND, material = 'wood') {
    return [block(x - width / 2 + 12, base - 54, 24, 108, material), block(x + width / 2 - 12, base - 54, 24, 108, material), block(x, base - 119, width + 30, 22, material)];
  }
  const levels = [
    { title: '初次跳車', area: '薄荷街', description: '先熱下身，撞撚散街角啲紙皮架先。', shots: 4, color: '#dce9c3',
      build: () => [...tower(822), enemy(822, 576), enemy(822, 446)] },
    { title: '泰國小販', area: '午後夜市', description: '小販把口咁屌你老母咁硬，邦基一撞就散，冚家剷。', shots: 4, color: '#efe4ba',
      build: () => [...tower(755, 152, GROUND, 'glass'), enemy(755, 447, 'vendor'), enemy(755, 576), ...tower(1010, 132), enemy(1010, 447)] },
    { title: '一齊玩泰國雞', area: '脫衣舞俱樂部', description: '成年舞台藝人返場，睇到眼冤，屌你老母，冚唪唥冧晒落嚟啦！', shots: 4, color: '#dce0ed',
      build: () => [...tower(855, 265), ...tower(855, 145, 474, 'glass'), enemy(855, 576, 'performer'), enemy(855, 446), enemy(855, 316, 'performer'), enemy(1080, 576)] },
    { title: '雙子塔大混亂', area: '舊城停車場', description: '打中支點，等兩座塔一齊收工放假，屌你老母，真係猛。', shots: 5, color: '#ead8c4',
      build: () => [...tower(738, 132), ...tower(1033, 132, GROUND, 'glass'), ...tower(738, 106, 474, 'glass'), enemy(738, 316, 'vendor'), enemy(738, 576), enemy(1033, 446, 'performer'), enemy(1033, 576), enemy(900, 576)] },
    { title: '終極街坊大會', area: '邦基大道', description: '成條街嘅街坊都等緊你呢最後一鑊，唔好丟架呀柒頭！', shots: 5, color: '#cfe4d8',
      build: () => [...tower(808, 220), ...tower(808, 138, 474), ...tower(1080, 126, GROUND, 'glass'), enemy(808, 316, 'vendor'), enemy(808, 446, 'performer'), enemy(765, 576), enemy(855, 576), enemy(1080, 446, 'performer'), enemy(1080, 576)] }
  ];
  levels.push(...window.BongiExtraLevels({tower,block,enemy,GROUND}));
  let screen = 'home', state = 'ready', levelIndex = 0, bodies = [], particles = [], floaters = [];
  let shots = 0, score = 0, shotCount = 0, current = null, drag = null, pointerId = null;
  let pull = { x: -82, y: 49 }, flightTime = 0, quietTime = 0, clearTime = 0, clock = 0;
  let shake = 0, flash = 0, blurTime = 0, toastTime = 0, quoteTime = 0, quoteCooldown = 0;
  let eventName = null, eventDone = false, paused = false, arrestTime = 0, hudDirty = true;
  let nextTaunt = 5, lastFrame = 0, accumulator = 0, collisionCount = 0, trainClears = 0;
  let heroClock = 0, rage = 0, recoil = 0, impactCooldown = 0, impacts = [], trail = [], trailTimer = 0;
  let renderAlpha = 1, lastRageLabel = -1;
  let blastTime=0, sodaBursts=0, shieldsBroken=0, waveRings=[];
  const lowMotion = () => settings.low || motionPreference.matches;
  const isTest = new URLSearchParams(location.search).has('test');
  let forcedEvent;
  const rogue=window.BongiRogue;
  let run=null, projectiles=[], skillCharges=0, eventGuards=0, selectedUpgrade=null, boundary=null;
  let meta={best:0,records:{},achievements:[],cosmetic:'classic'}, storageAvailable=true;
  try {
    const m=JSON.parse(localStorage.getItem('bongi-rogue-meta')||'null');
    if(m&&Number.isSafeInteger(m.best)&&m.best>=0&&m.best<=1000000){
      meta.best=m.best;
      meta.cosmetic=['classic','mint','gold'].includes(m.cosmetic)?m.cosmetic:'classic';
      if(m.records&&typeof m.records==='object')for(const [key,v] of Object.entries(m.records).slice(-100))if(key.length<110&&v&&Number.isSafeInteger(v.wave)&&v.wave>=0&&Number.isSafeInteger(v.score)&&v.score>=0)meta.records[key]={wave:v.wave,score:v.score};
      meta.achievements=Array.isArray(m.achievements)?m.achievements.filter(x=>['first','five','boss','hybrid'].includes(x)):[];
    }
  } catch(_){storageAvailable=false;}
  function persistBoundary(){
    boundary=JSON.stringify(run);
    try{localStorage.setItem('bongi-rogue-save',boundary);}catch(_){storageAvailable=false;}
    refreshRogueHome();
  }
  function refreshRogueHome(){
    const labels={first:'首次清波',five:'精英征服者',boss:'機械拆解員',hybrid:'混合流派'};
    $('rogueCosmetic').value=meta.cosmetic;
    for(const o of $('rogueCosmetic').options)o.disabled=o.value==='mint'?meta.best<5:o.value==='gold'?meta.best<10:false;
    const latest=Object.entries(meta.records).slice(-3).map(([k,v])=>`${k}：${v.wave} 波 / ${v.score} 分`).join('；');
    $('rogueRecords').textContent=`最高 ${meta.best} 波 · ${meta.achievements.map(x=>labels[x]).join(' / ')||'尚未解鎖成就'}。${latest}${storageAvailable?'':'（儲存不可用，本次只留記憶體）'}`;
  }
  function recordRun(cleared){
    const key=rogue.recordKey(run), old=meta.records[key]||{wave:0,score:0};
    delete meta.records[key];meta.records[key]={wave:Math.max(old.wave,cleared),score:Math.max(old.score,run.score)};
    // Bound local challenge records to the most recent 100 keys.
    const keys=Object.keys(meta.records);if(keys.length>100)delete meta.records[keys[0]];
    meta.best=Math.max(meta.best,cleared);
    for(const [name,yes] of [['first',cleared>=1],['five',cleared>=5],['boss',cleared>=10],['hybrid',Object.keys(run.upgrades).filter(k=>['giant','split','speed','explosive'].includes(k)).length>=2]])if(yes&&!meta.achievements.includes(name))meta.achievements.push(name);
    try{localStorage.setItem('bongi-rogue-meta',JSON.stringify(meta));}catch(_){storageAvailable=false;}
    refreshRogueHome();
  }
  function startRogue(seed,start,ammo=6,daily=false){run=rogue.create(seed,start,daily?6:ammo,daily);loadWave();}
  function loadWave(){
    const layout=rogue.layout(run), stats=rogue.stats(run);
    loadLevel(0,true);
    bodies=layout.bodies.map(spec=>{
      const b=spec.type==='block'?block(spec.x,spec.y,spec.w,spec.h,spec.material):enemy(spec.x,spec.y,spec.kind);
      b.hp*=spec.relay?1:layout.difficulty;b.maxHp=b.hp;b.sleeping=true;b.relay=!!spec.relay;
      if(b.type==='enemy')b.points=Math.round(b.points*(layout.elite?1.5:1)*stats.points);
      return b;
    });
    shots=run.ammo;score=run.score;eventGuards=stats.guard;run.eventIndex=0;skillCharges=0;
    $('levelNumber').textContent=`∞ ${run.wave}`;$('levelTitle').textContent=`${layout.boss?'機械頭目':layout.elite?'精英':'無盡'} · ${layout.name}`;
    $('enemyRoster').textContent='優先處理維修兵／指揮官。石材硬、金屬重、彈性材質會反彈。'+(layout.boss?'頭目：拆兩個「電」支柱，或等每 3 秒中 1 秒核心開放。':'');
    $('statusText').textContent=`第 ${run.wave} 波 · 強度 ×${layout.difficulty.toFixed(2)} · 固定事件 28%`;
    syncSettings();hudDirty=true;updateHud();updateRogueHud();persistBoundary();
  }
  function restartCurrent(){
    if(!run){loadLevel(levelIndex);return;}
    const saved=rogue.decode(boundary);if(saved){run=saved;if(run.phase==='choice')showRogueChoice();else loadWave();}
  }
  function resumeRogue(){
    let data=boundary;try{data=localStorage.getItem('bongi-rogue-save')||boundary;}catch(_){storageAvailable=false;}
    const saved=rogue.decode(data);
    if(!saved){$('rogueRecords').textContent='未有有效波次存檔；損壞／舊版本資料已忽略。';return false;}
    run=saved;boundary=JSON.stringify(run);
    if(run.phase==='choice')showRogueChoice();else loadWave();return true;
  }
  function updateRogueHud(){
    $('rogueHud').hidden=!run;if(!run)return;
    $('rogueStatus').textContent=`第 ${run.wave} 波 · ${rogue.starts[run.start]} · ${run.route} · 護符 ${eventGuards}`;
    $('rogueBuild').textContent=Object.entries(run.upgrades).map(([key,n])=>`${rogue.upgrades.find(u=>u.id===key).name} ×${n}`).join(' / ')||'起始流派：飛行中按 E / 空白鍵或技能按鈕。';
    $('skillBtn').disabled=state!=='flight'||skillCharges<=0||paused;
    $('skillBtn').textContent=`技能 ${skillCharges} · E / 空白鍵`;
  }
  function showRogueChoice(){
    closeDialogs();state='won';selectedUpgrade=null;$('upgradeChoices').replaceChildren();
    bodies=[];projectiles=[];current=null;skillCharges=0;shots=run.ammo;score=run.score;
    $('levelNumber').textContent=`∞ ${run.wave}`;$('levelTitle').textContent='波次完成 · 準備下一站';
    $('aimHint').hidden=true;$('subtitle').hidden=true;$('eventToast').hidden=true;
    setScreen('game');hudDirty=true;updateHud();updateRogueHud();
    const choices=rogue.offers(run);
    for(const u of choices){const b=document.createElement('button');b.className='button secondary full';b.textContent=`${u.name} · ${u.description}`;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{selectedUpgrade=u.id;for(const c of $('upgradeChoices').children)c.setAttribute('aria-pressed',String(c===b));$('rogueContinue').disabled=false;});$('upgradeChoices').append(b);}
    $('rogueContinue').disabled=choices.length>0;$('routeChoice').value='normal';
    $('choiceSummary').textContent=`已清 ${run.wave} 波 · ${run.score} 分 · 剩 ${run.ammo} 發；下波補充 ${rogue.stats(run).refill} 發，最多 8。${choices.length?'':'所有升級已達上限，選路繼續。'}`;
    openDialog($('rogueChoice'));
  }
  function blastAt(source,radius,damage){
    waveRings.push({x:source.x,y:source.y,life:.65});sound('bomb');
    for(const b of bodies){if(!b.alive||b.type==='bongi')continue;const dx=b.x-source.x,dy=b.y-source.y,d=Math.hypot(dx,dy);if(d>radius)continue;
      wakeStructure(b);b.vx+=dx/(d||1)*180*(1-d/radius);b.vy-=100*(1-d/radius);
      applyDamage(b,damage*(1-.45*d/radius),false);
    }
  }
  function activateSkill(){
    if(!run||state!=='flight'||paused||skillCharges<=0)return false;
    const active=projectiles.filter(p=>p.alive&&p.x>-90&&p.x<W+110&&p.y<H+90);if(!active.length)return false;
    skillCharges--;const s=rogue.stats(run);
    for(const p of active){
      if(s.blast)blastAt(p,s.radius,s.blast);
      p.vx=clamp(p.vx*(s.dash>1?s.dash:1.08),-1800,1800);p.vy-=run.start==='giant'?110:35;
      if(s.children&&!p.child&&!p.split){p.split=true;for(let i=0;i<s.children;i++){
        const child=body('bongi',p.x,p.y,{r:18,mass:1.7,child:true,gravityScale:p.gravityScale||1});child.vx=p.vx*.87;child.vy=p.vy+(i-(s.children-1)/2)*145;child.spin=p.spin;projectiles.push(child);bodies.push(child);
      }}
    }
    updateRogueHud();return true;
  }

  function setScreen(next) {
    cancelDrag(); screen = next;
    $('homeScreen').hidden = next !== 'home'; $('levelScreen').hidden = next !== 'levels'; $('gameScreen').hidden = next !== 'game';
    if (next === 'levels') renderLevelCards();
    resize();syncAudio();syncSettings();
  }
  function renderLevelCards() {
    $('levelCards').replaceChildren();
    levels.forEach((level, i) => {
      const card = document.createElement('button'); card.className = 'level-card';
      card.style.setProperty('--card-color', art.themes[settings.scene].color);
      const best = records[i] || { score: 0, stars: 0 };
      const stars = clamp(Number(best.stars) || 0, 0, 3), bestScore = Math.max(0, Number(best.score) || 0);
      card.innerHTML = `<div class="level-card-art"><canvas width="384" height="216" aria-hidden="true"></canvas><span>CHAPTER ${level.chapter||1} · ${art.themes[settings.scene].label}</span><b>${String(i+1).padStart(2,'0')}</b></div><div class="level-card-body"><div class="card-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><h3>${level.title}</h3><p>${level.description}</p><small>${level.shots} 次發射 · 最佳 ${bestScore.toLocaleString()} →</small></div>`;
      card.addEventListener('click', () => loadLevel(i)); $('levelCards').append(card);
      const preview = card.querySelector('canvas').getContext('2d');
      preview.scale(.3,.3); art.draw(preview,settings.scene,0,true);
    });
  }
  function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); paused = false;syncAudio(); }
  function loadLevel(index,keepRun=false) {
    if(!keepRun)run=null;
    closeDialogs(); levelIndex = clamp(index, 0, levels.length - 1); const level = levels[levelIndex];
    id = 0; bodies = level.build(); particles = []; floaters = []; current = null;projectiles=[];skillCharges=0;eventGuards=0;
    shots = level.shots; score = 0; shotCount = 0; flightTime = 0; quietTime = 0; clearTime = 0;
    shake = 0; flash = 0; blurTime = 0; toastTime = 0; quoteTime = 0; quoteCooldown = 0;
    clock = 0; arrestTime = 0; nextTaunt = 5; collisionCount = 0; trainClears = 0;
    rage = 0; recoil = 0; impacts = []; trail = []; trailTimer = 0; impactCooldown = 0;
    lastRageLabel = -1; keyboardAim = false;
    blastTime=0;sodaBursts=0;shieldsBroken=0;waveRings=[];
    eventName = null; eventDone = false; state = 'ready'; pull = { x: -82, y: 49 }; accumulator = 0;
    // Prebuilt structures sleep until touched. This prevents tiny solver errors
    // from accumulating while aiming, especially in multi-storey stacks.
    bodies.forEach(b => { b.sleeping = true; });
    $('subtitle').hidden = true; $('eventToast').hidden = true; $('powerMeter').hidden = true;
    canvas.classList.remove('blurry'); $('aimHint').hidden = false;
    $('levelNumber').textContent = String(levelIndex + 1).padStart(2, '0');
    $('levelTitle').textContent = level.title; updateSceneLabels();
    $('enemyRoster').textContent='本關敵人：'+[...new Set(bodies.filter(b=>b.type==='enemy').map(b=>b.kind))].map(kind=>window.BongiEnemies.types[kind].name).join(' / ');
    $('statusText').textContent = level.description;
    hudDirty = true; updateHud(); setScreen('game');updateRogueHud(); canvas.focus({ preventScroll: true });
  }
  function updateHud() {
    if (!hudDirty) return; hudDirty = false;
    $('scoreValue').textContent = score.toLocaleString();
    $('shotsValue').textContent = shots > 0 ? '● '.repeat(shots).trim() : state === 'flight' ? '最後一發在途' : '0';
    $('shotsValue').setAttribute('aria-label', `剩餘 ${shots} 次發射`);
    $('targetsValue').textContent = bodies.filter(b => b.type === 'enemy' && b.alive).length;
  }
  function subtitle(text, duration = 2.4) { $('subtitle').textContent = text; $('subtitle').hidden = false; quoteTime = duration; }
  function quote() { if (quoteCooldown <= 0) { subtitle(quotes[Math.floor(Math.random() * quotes.length)]); quoteCooldown = 1.5; } }
  function toast(name) { const e = events[name]; $('eventTitle').textContent = e.title; $('eventDetail').textContent = e.detail; $('eventIcon').textContent = e.icon; $('eventToast').hidden = false; toastTime = name === 'train' ? 2.7 : 3; sound('event'); }
  function syncSettings() {
    document.body.classList.toggle('low-effects',lowMotion());
    const locked=!!run&&screen==='game';
    $('eventChance').disabled=locked;$('eventChance').setAttribute('aria-describedby','chanceExplanation');
    $('eventChance').value = locked?rogue.EVENT_CHANCE*100:settings.chance; $('chanceOutput').textContent = locked?'28% · 無盡固定，設定無效':`${settings.chance}%`;
    $('lowEffects').checked = settings.low; $('soundSetting').checked = settings.sound;
    $('soundBtn').innerHTML = `♪<span>音效${settings.sound ? '開' : '關'}</span>`;
    $('soundBtn').setAttribute('aria-pressed', String(settings.sound)); $('soundBtn').setAttribute('aria-label', `${settings.sound ? '關閉' : '開啟'}音效`);
    $('musicSetting').checked=settings.music;$('impactSetting').checked=settings.impact;
    $('musicVolume').value=Math.round(settings.musicVolume*100);$('musicOutput').textContent=`${Math.round(settings.musicVolume*100)}%`;
    $('sfxVolume').value=Math.round(settings.sfxVolume*100);$('sfxOutput').textContent=`${Math.round(settings.sfxVolume*100)}%`;
    $('musicBtn').setAttribute('aria-pressed',String(settings.music));
    $('musicBtn').setAttribute('aria-label',settings.music?'關閉背景音樂':'開啟背景音樂');
    syncAudio();
  }
  function updateSceneLabels() {
    const theme=art.themes[settings.scene];
    $('heroThemeLabel').textContent=theme.label;
    $('levelArea').textContent=theme.label;
    $('sceneTag').textContent=theme.tag;
    document.querySelector('.hero-art').setAttribute('aria-label',`原創漫畫場景預覽：${theme.label}`);
    document.querySelectorAll('[data-theme]').forEach(button=>{
      const active=button.dataset.theme===settings.scene;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
  }
  function chooseScene(name) {
    if(!Object.prototype.hasOwnProperty.call(art.themes,name))return;
    settings.scene=name;updateSceneLabels();save();
    if(screen==='levels')renderLevelCards();
  }
  function openDialog(dialog) { cancelDrag(); paused = screen === 'game'; dialog.showModal();syncAudio();updateRogueHud(); }
  function launch(vector) {
    if (screen !== 'game' || state !== 'ready' || paused || shots <= 0) return false;
    let dx = vector.x, dy = vector.y; const length = Math.hypot(dx, dy);
    if (length < 10) return false;
    if (length > MAX_PULL) { dx *= MAX_PULL / length; dy *= MAX_PULL / length; }
    shots--; shotCount++; eventName = null; eventDone = false;
    if (isTest && forcedEvent !== undefined) { eventName = forcedEvent; forcedEvent = undefined; }
    else if(run)eventName=rogue.rollEvent(run);
    else if (Math.random() * 100 < settings.chance) eventName = Object.keys(events)[Math.floor(Math.random() * Object.keys(events).length)];
    if(['headwind','heavy','fog'].includes(eventName)&&eventGuards>0){eventGuards--;eventName=null;}
    const s=run?rogue.stats(run):null;
    current = body('bongi', ANCHOR.x, ANCHOR.y, { r:s?s.size:29,mass:3.6*(s?s.mass:1) });
    current.vx = -dx * POWER; current.vy = -dy * POWER; current.spin = current.vx >= 0 ? 17 : -17;
    if(s){current.vx*=s.power;current.vy*=s.power;skillCharges=s.charges;}
    recoil = .7; rage = Math.max(rage,.85); trail=[];blastTime=.9;
    if(settings.impact&&!lowMotion())shake=12;
    burst(ANCHOR.x,ANCHOR.y,'#ffd350',lowMotion()?5:26,240);
    comicImpact(ANCHOR.x+90,ANCHOR.y-100,'衝撚呀！','#ffe066');
    current.ghost = eventName === 'miss';
    if (eventName === 'miss') { current.vx = -330; current.vy = -650; }
    if (eventName === 'pants') { current.vx *= 1.28; current.vy *= 1.28; burst(ANCHOR.x, ANCHOR.y, '#486eab', 18, 210); }
    if (eventName === 'glasses') { blurTime = 2.4; particles.push({ x: ANCHOR.x, y: ANCHOR.y - 12, vx: -130, vy: -240, life: 2.4, max: 2.4, size: 18, color: '#254636', kind: 'glasses', angle: 0 }); }
    if (eventName === 'train') { current.vx *= 1.3; current.vy *= 1.1; current.train=true; }
    if(eventName==='headwind')current.vx*=.9;
    if(eventName==='heavy')current.gravityScale=1.12;
    if(eventName==='fog')blurTime=2;
    if(eventName==='boost'){current.vx*=1.12;current.vy*=1.12;}
    if(eventName==='shield')eventGuards=Math.min(2,eventGuards+1);
    if(eventName==='bonus')shots=Math.min(8,shots+1);
    bodies.push(current);projectiles=[current]; flightTime = 0; quietTime = 0; clearTime = 0; state = 'flight';updateRogueHud();
    $('aimHint').hidden = true; $('powerMeter').hidden = true;
    $('statusText').textContent = shots <= 1 ? '最後機會！路邊嘅差佬已經開始睇錶，今鑊唔好柒呀！' : '邦基飛緊！撞埋支架都可以令成座嘢冚唪唥冧落嚟！';
    if (eventName) toast(eventName); sound('launch'); quote(); hudDirty = true; return true;
  }

  // Small rigid-body engine: oriented box SAT, circle/box contacts, angular impulses,
  // Coulomb friction, iterative stabilization and 120 Hz fixed time steps.
  function axes(b) { const c = Math.cos(b.angle), s = Math.sin(b.angle); return [{ x: c, y: s }, { x: -s, y: c }]; }
  function vertices(b) {
    const [u, v] = axes(b);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j]) => ({ x: b.x + u.x * b.w * .5 * i + v.x * b.h * .5 * j, y: b.y + u.y * b.w * .5 * i + v.y * b.h * .5 * j }));
  }
  function projection(b, axis) {
    if (b.shape === 'circle') return b.r;
    const [u, v] = axes(b); return Math.abs(u.x * axis.x + u.y * axis.y) * b.w / 2 + Math.abs(v.x * axis.x + v.y * axis.y) * b.h / 2;
  }
  function support(b, nx, ny) {
    if (b.shape === 'circle') return { x: b.x + nx * b.r, y: b.y + ny * b.r };
    const verts = vertices(b), dots = verts.map(v => v.x * nx + v.y * ny), max = Math.max(...dots);
    const edge = verts.filter((_, i) => dots[i] > max - .5);
    return { x: edge.reduce((s, v) => s + v.x, 0) / edge.length, y: edge.reduce((s, v) => s + v.y, 0) / edge.length };
  }
  function contact(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) > (a.w + a.h + b.w + b.h) / 2 || Math.abs(dy) > (a.w + a.h + b.w + b.h) / 2) return null;
    if (a.shape === 'circle' && b.shape === 'circle') {
      const d = Math.hypot(dx, dy), depth = a.r + b.r - d;
      if (depth <= 0) return null;
      const nx = d ? dx / d : 1, ny = d ? dy / d : 0;
      return { nx, ny, depth, x: a.x + nx * (a.r - depth / 2), y: a.y + ny * (a.r - depth / 2) };
    }
    if (a.shape === 'box' && b.shape === 'circle') {
      const c = contact(b, a); return c && { ...c, nx: -c.nx, ny: -c.ny };
    }
    if (a.shape === 'circle') {
      const [u, v] = axes(b), rx = a.x - b.x, ry = a.y - b.y;
      const lx = rx * u.x + ry * u.y, ly = rx * v.x + ry * v.y;
      let qx = clamp(lx, -b.w / 2, b.w / 2), qy = clamp(ly, -b.h / 2, b.h / 2);
      let ex = qx - lx, ey = qy - ly, d = Math.hypot(ex, ey), depth = a.r - d;
      if (depth <= 0) return null;
      if (d < .0001) {
        const gapX = b.w / 2 - Math.abs(lx), gapY = b.h / 2 - Math.abs(ly);
        if (gapX < gapY) { ex = lx >= 0 ? -1 : 1; ey = 0; depth = a.r + gapX; qx = lx >= 0 ? b.w / 2 : -b.w / 2; }
        else { ex = 0; ey = ly >= 0 ? -1 : 1; depth = a.r + gapY; qy = ly >= 0 ? b.h / 2 : -b.h / 2; }
        d = 1;
      }
      return { nx: (ex * u.x + ey * v.x) / d, ny: (ex * u.y + ey * v.y) / d, depth, x: b.x + qx * u.x + qy * v.x, y: b.y + qx * u.y + qy * v.y };
    }
    let best = Infinity, normal;
    for (const axis of [...axes(a), ...axes(b)]) {
      const dist = dx * axis.x + dy * axis.y;
      const overlap = projection(a, axis) + projection(b, axis) - Math.abs(dist);
      if (overlap <= 0) return null;
      if (overlap < best) { best = overlap; normal = { x: axis.x * (dist >= 0 ? 1 : -1), y: axis.y * (dist >= 0 ? 1 : -1) }; }
    }
    const sa = support(a, normal.x, normal.y), sb = support(b, -normal.x, -normal.y);
    // Place the contact inside the overlapping faces, not between body centres.
    // The latter creates a spurious lever arm under long beams and topples idle towers.
    const tx = -normal.y, ty = normal.x;
    const va = vertices(a).map(p => p.x * tx + p.y * ty);
    const vb = vertices(b).map(p => p.x * tx + p.y * ty);
    const tangent = (Math.max(Math.min(...va), Math.min(...vb)) + Math.min(Math.max(...va), Math.max(...vb))) / 2;
    const normalDistance = ((sa.x + sb.x) * normal.x + (sa.y + sb.y) * normal.y) / 2;
    return { nx: normal.x, ny: normal.y, depth: best, x: normal.x * normalDistance + tx * tangent, y: normal.y * normalDistance + ty * tangent };
  }
  function impulse(b, jx, jy, rx, ry) { b.vx += jx * b.invMass; b.vy += jy * b.invMass; b.spin += (rx * jy - ry * jx) * b.invI; }
  function resolve(a, b, c, damage) {
    const { nx, ny, depth, x, y } = c, total = a.invMass + b.invMass;
    const correct = Math.max(0, depth - .18) * .6 / total;
    a.x -= nx * correct * a.invMass; a.y -= ny * correct * a.invMass;
    b.x += nx * correct * b.invMass; b.y += ny * correct * b.invMass;
    const ax = x - a.x, ay = y - a.y, bx = x - b.x, by = y - b.y;
    const rvx = b.vx - b.spin * by - a.vx + a.spin * ay;
    const rvy = b.vy + b.spin * bx - a.vy - a.spin * ax;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const crossA = ax * ny - ay * nx, crossB = bx * ny - by * nx;
    const elastic=a.material==='elastic'||b.material==='elastic';
    const j = -(1 + (vn < -85 ? (elastic?.65:.2) : 0)) * vn / (total + crossA * crossA * a.invI + crossB * crossB * b.invI);
    impulse(a, -nx * j, -ny * j, ax, ay); impulse(b, nx * j, ny * j, bx, by);
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    const ca = ax * ty - ay * tx, cb = bx * ty - by * tx;
    const f = clamp(-vt / (total + ca * ca * a.invI + cb * cb * b.invI), -j * .5, j * .5);
    impulse(a, -tx * f, -ty * f, ax, ay); impulse(b, tx * f, ty * f, bx, by);
    if (damage && -vn > 90) {
      collisionCount++;
      hurt(a, -vn, b.type === 'bongi'); hurt(b, -vn, a.type === 'bongi');
      if (a.type === 'bongi' || b.type === 'bongi') {
        shake = Math.max(shake, Math.min(8, -vn / 90)); quote();
        const hero=a.type==='bongi'?a:b;hero.squash=.65;rage=1;
        if(hero.train&&!hero.trainSpent){hero.trainSpent=true;eventDone=true;blastAt(hero,135,110);}
        comicImpact(x,y-70,['KAPOW!','撞撚！','唔忍啦！'][collisionCount%3],'#ffd753');
      }
    }
  }
  function groundCollision(b, damage) {
    const points = b.shape === 'circle' ? [{ x: b.x, y: b.y + b.r }] : vertices(b);
    const low = Math.max(...points.map(p => p.y));
    if (low <= GROUND) return;
    const touching = points.filter(p => p.y > low - 2), x = touching.reduce((sum, p) => sum + p.x, 0) / touching.length;
    b.y -= (low - GROUND) * .83;
    const rx = x - b.x, ry = GROUND - b.y, speed = b.vy + b.spin * rx;
    if (speed > 0) {
      const bounce=b.material==='elastic'?.65:b.type==='bongi'?(run?rogue.stats(run).bounce:.37):.13;
      const j = (1 + (speed > 85 ? bounce : 0)) * speed / (b.invMass + rx * rx * b.invI);
      impulse(b, 0, -j, rx, ry);
      const friction = clamp(-(b.vx - b.spin * ry) / (b.invMass + ry * ry * b.invI), -j * .68, j * .68);
      impulse(b, friction, 0, rx, ry);
      if (damage && speed > 120) {
        hurt(b, speed * .6, false); b.squash=Math.min(.65,speed/800);
        if(b.type==='bongi'){
          comicImpact(b.x,GROUND-95,'BOING!','#7ce4ee');
          if(b.train&&!b.trainSpent){b.trainSpent=true;eventDone=true;blastAt(b,135,110);}
        }
      }
    }
    b.vx *= .988; b.spin *= b.type === 'bongi' ? .985 : .96;
    if (Math.abs(b.vx) < 1.5) b.vx = 0;
    if (Math.abs(b.spin) < .04) b.spin = 0;
  }
  function hurt(b, speed, direct) {
    if (!b.alive || b.type === 'bongi' || b.cooldown > 0) return;
    const s=run?rogue.stats(run):null;
    const amount = (direct ? speed * (run?.48:.65)*(s?s.damage:1) : Math.max(0, speed - 65) * (b.type === 'enemy' ? .62 : .24))*(s&&b.type==='block'?s.structure:1);
    if (amount < 9) return;
    applyDamage(b,amount,direct);b.cooldown = .18; b.squash=.5;
    burst(b.x, b.y, b.type === 'enemy' ? '#8d9c4c' : b.material === 'glass' ? '#b3e5df' : '#ce9a59', settings.low ? 3 : 7, 110);
    sound('hit');
    if (b.hp <= 0) destroy(b);
  }
  function applyDamage(b,amount,direct=false,poison=false){
    if(!b.alive||b.type==='bongi')return;
    const s=run?rogue.stats(run):null;
    // Boss core can always be damaged a little; relays disable its periodic armour.
    if(b.kind==='boss'&&bodies.some(x=>x.alive&&x.relay)&&flightTime%3<2)amount*=.18;
    if(run&&b.kind!=='commander'&&b.type==='enemy'&&bodies.some(x=>x.alive&&x.kind==='commander'&&Math.hypot(x.x-b.x,x.y-b.y)<220))amount*=.75+(s?s.aura:0)*.25;
    if(b.shield&&!poison){breakShield(b);amount*=direct&&s?s.pierce:0;}
    b.hp-=amount;if(b.hp<=0)destroy(b);
  }
  function enemyAbilities(dt){
    if(!run||state!=='flight')return;
    const s=rogue.stats(run);
    for(const healer of bodies)if(healer.alive&&healer.kind==='repair'){
      healer.repairClock=(healer.repairClock||0)+dt;
      if(healer.repairClock>=2&&(healer.repairs||0)<2){
        healer.repairClock=0;healer.repairs=(healer.repairs||0)+1;
        const target=bodies.filter(b=>b.alive&&b!==healer&&b.type!=='bongi'&&b.hp<b.maxHp&&Math.hypot(b.x-healer.x,b.y-healer.y)<210).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(target){target.hp=Math.min(target.maxHp,target.hp+28*(1-s.disrupt));floaters.push({x:target.x,y:target.y-40,text:'維修 +',life:1,color:'#397e8a'});}
      }
    }
  }
  function destroy(b) {
    if (!b.alive) return; b.alive = false;
    if(b.type==='enemy')comicImpact(b.x,b.y-70,'扁撚咗！','#fca2ca');
    const points = b.type === 'enemy' ? b.points||1000 : 150; score += points; hudDirty = true;
    burst(b.x, b.y, b.type === 'enemy' ? '#a7b966' : b.material === 'glass' ? '#defbfa' : '#d9ad71', settings.low ? 6 : 15, 185);
    floaters.push({ x: b.x, y: b.y - 30, text: `+${points}`, life: 1.2, color: '#254d34' });
    if (b.type === 'enemy') { sound('pop'); particles.push({ x: b.x, y: Math.min(GROUND - 5, b.y + 10), vx: 0, vy: 0, life: .45, max: .45, size: b.r, color: '#93a460', kind: 'squash' }); }
    if(b.kind==='soda'&&b.type==='enemy')sodaExplosion(b);
  }
  function breakShield(b){
    if(!b.shield)return;b.shield=false;shieldsBroken++;b.squash=.5;
    burst(b.x,b.y,'#94e9f5',lowMotion()?4:12,190);comicImpact(b.x,b.y-65,'破盾！','#94e9f5');sound('shield');
  }
  function sodaExplosion(source){
    sodaBursts++;sound('bomb');shake=Math.max(shake,9);
    waveRings.push({x:source.x,y:source.y,life:.65});if(waveRings.length>6)waveRings.shift();
    burst(source.x,source.y,'#88e8bc',lowMotion()?8:24,270);
    comicImpact(source.x,source.y-75,'汽水連撚爆！','#b9f276');
    // Source already marked dead before recursion: each backpack can burst once.
    for(const target of bodies){
      if(!target.alive||target.type==='bongi')continue;
      const dx=target.x-source.x,dy=target.y-source.y,d=Math.hypot(dx,dy);
      if(d>175)continue;
      wakeStructure(target);const force=(1-d/220)*180;
      target.vx+=(dx/(d||1))*force;target.vy+=(dy/(d||1))*force-60;
      applyDamage(target,130);
    }
  }
  function wakeStructure(root) {
    const queue = [root]; root.sleeping = false;
    while (queue.length) {
      const a = queue.pop();
      for (const b of bodies) {
        if (!b.alive || !b.sleeping) continue;
        const gapX = Math.abs(a.x - b.x) - projection(a, { x: 1, y: 0 }) - projection(b, { x: 1, y: 0 });
        const gapY = Math.abs(a.y - b.y) - projection(a, { x: 0, y: 1 }) - projection(b, { x: 0, y: 1 });
        if (gapX < 8 && gapY < 8) { b.sleeping = false; queue.push(b); }
      }
    }
  }
  function physics(dt, damage = true) {
    // At most eight microsteps; velocity cap keeps travel below the thinnest wall.
    const fastest=bodies.reduce((max,b)=>b.alive&&!b.sleeping?Math.max(max,Math.hypot(b.vx,b.vy)):max,0);
    const steps=clamp(Math.ceil(Math.min(fastest,2400)*dt/8),1,8);
    for(let n=0;n<steps;n++)physicsSubstep(dt/steps,damage);
  }
  function physicsSubstep(dt, damage) {
    for (const b of bodies) {
      b.previousX=b.x;b.previousY=b.y;b.previousAngle=b.angle;
      b.squash=Math.max(0,(b.squash||0)-dt*3.5);
      if (!b.alive || b.sleeping) continue;
      b.cooldown = Math.max(0, b.cooldown - dt);
      b.vy += GRAVITY * (b.gravityScale||1) * dt;
      b.vx *= Math.pow(.9995,dt/DT); b.vy *= Math.pow(.9998,dt/DT);
      const speed=Math.hypot(b.vx,b.vy);if(speed>2400){b.vx*=2400/speed;b.vy*=2400/speed;}
      b.x += b.vx * dt; b.y += b.vy * dt; b.angle += b.spin * dt;
      b.spin = clamp(b.spin * .999, -23, 23);
    }
    for (let iteration = 0; iteration < 7; iteration++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i]; if (!a.alive || a.ghost) continue;
        if (!a.sleeping) groundCollision(a, damage && iteration === 0);
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j]; if (!b.alive || b.ghost || (a.sleeping && b.sleeping)) continue;
          // Conservative bounding-circle broadphase before costly rotated SAT.
          const reach=(a.shape==='circle'?a.r:Math.hypot(a.w,a.h)/2)+(b.shape==='circle'?b.r:Math.hypot(b.w,b.h)/2);
          if(Math.abs(a.x-b.x)>reach||Math.abs(a.y-b.y)>reach)continue;
          if(a.type==='bongi'&&b.type==='bongi')continue;
          const c = contact(a, b);
          if (c) {
            if (a.sleeping) wakeStructure(a);
            if (b.sleeping) wakeStructure(b);
            resolve(a, b, c, damage && iteration === 0);
          }
        }
      }
    }
    if (damage) for (const b of bodies) {
      if (b.alive && b.type !== 'bongi' && (b.x < -120 || b.x > W + 120 || b.y > H + 100)) destroy(b);
    }
  }
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), v = rand(speed * .2, speed), life = rand(.3, .7);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life, max: life, size: rand(3, 8), color, kind: 'chip', angle: rand(0, TAU) });
    }
    limitParticles();
  }
  function limitParticles() { const max = settings.low ? 75 : 220; if (particles.length > max) particles.splice(0, particles.length - max); }
  function comicImpact(x,y,label,color) {
    if(impactCooldown>0)return;
    impacts.push({x:clamp(x,90,W-100),y:clamp(y,115,GROUND-75),label,color,life:.75,max:.75});
    if(impacts.length>3)impacts.shift();impactCooldown=.16;
  }
  function poisonCloud() {
    if (!current || current.ghost || !current.alive || flightTime > 5.8 || Math.hypot(current.vx, current.vy) < 45) return;
    if (Math.random() > (settings.low ? .25 : .65)) return;
    particles.push({ x: current.x + rand(-12,12), y: current.y + rand(-12,12), vx: rand(-30, 5), vy: rand(-30,-5), life: 1.5, max: 1.5, size: rand(12,23), color: '#93be4d', kind: 'gas' }); limitParticles();
  }
  function step(dt) {
    if (screen !== 'game' || paused || state === 'won' || state === 'lost') return;
    clock += dt; quoteCooldown -= dt;
    blastTime=Math.max(0,blastTime-dt);
    for(const wave of waveRings)wave.life-=dt;
    waveRings=waveRings.filter(wave=>wave.life>0);
    recoil=Math.max(0,recoil-dt);impactCooldown=Math.max(0,impactCooldown-dt);
    const targetRage=state==='ready'?(drag||keyboardAim?Math.hypot((drag||pull).x,(drag||pull).y)/MAX_PULL:.22):state==='flight'?.86:.48;
    rage+=(targetRage-rage)*(1-Math.exp(-dt*8));
    for(const mark of impacts)mark.life-=dt;
    impacts=impacts.filter(mark=>mark.life>0);
    for(const pose of trail)pose.life-=dt;
    trail=trail.filter(pose=>pose.life>0);
    trailTimer+=dt;
    if(state==='flight'&&current&&current.alive&&!lowMotion()&&trailTimer>.035){
      trailTimer=0;trail.push({x:current.x,y:current.y,angle:current.angle,life:.24});
      if(trail.length>7)trail.shift();
    }
    if (blurTime > 0) blurTime = Math.max(0, blurTime - dt);
    if (toastTime > 0) { toastTime -= dt; if (toastTime <= 0) $('eventToast').hidden = true; }
    if (quoteTime > 0) { quoteTime -= dt; if (quoteTime <= 0) $('subtitle').hidden = true; }
    shake *= .96; flash = Math.max(0, flash - dt * 2.5);
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'chip' || p.kind === 'glasses') { p.vy += 450 * dt; p.angle += dt * 4; }
      if (p.kind === 'gas') p.size += dt * 10;
    }
    particles = particles.filter(p => p.life > 0);
    for (const f of floaters) { f.life -= dt; f.y -= 28 * dt; }
    floaters = floaters.filter(f => f.life > 0);
    if (state === 'arrest') {
      arrestTime += dt;
      if (arrestTime >= 2.25) finish(false);
      return;
    }
    physics(dt, shotCount > 0);
    enemyAbilities(dt);
    if (state === 'ready' && clock > nextTaunt) {
      if (bodies.some(b => b.type === 'enemy' && b.kind === 'vendor' && b.alive)) subtitle('小販：瞄準未呀柒頭？我杯茶都凍撚晒喇！', 2.5);
      nextTaunt = clock + 12;
    }
    if (state === 'flight') {
      flightTime += dt; poisonCloud();
      if (eventName === 'miss' && flightTime > .8 && !eventDone) { eventDone = true; floaters.push({ x: 270, y: 290, text: 'MISS!', life: 1.8, color: '#a95633' }); quoteCooldown = 0; quote(); }
      // Gas damage is elapsed-time based, independent of visual particle count/quality.
      if (projectiles.length && flightTime < 5.8) {
        const s=run?rogue.stats(run):null;
        for (const b of bodies) if (b.alive && b.type === 'enemy') {
          if (projectiles.some(p=>p.alive&&!p.ghost&&Math.hypot(b.x-p.x,b.y-p.y)<(s?s.cloud:95))) b.poison = .75;
          if (b.poison > 0) { b.poison -= dt;applyDamage(b,(s?s.toxin:17)*dt,false,true); }
        }
      }
      const settled=projectiles.every(p=>!p.alive||p.x < -90||p.x > W+110||p.y>H+90||Math.hypot(p.vx,p.vy)<43);
      const moving = bodies.some(b => b.alive && b.type !== 'bongi' && (Math.hypot(b.vx, b.vy) > 27 || Math.abs(b.spin) > .6));
      if (settled && !moving) quietTime += dt; else quietTime = 0;
      if ((quietTime > 1.15 && flightTime > 1.5) || flightTime > 12 || (eventName === 'miss' && flightTime > 2)) endShot();
    }
    const remaining = bodies.filter(b => b.type === 'enemy' && b.alive).length;
    if (remaining === 0 && shotCount > 0) { clearTime += dt; if (clearTime > 1) finish(true); }
    else clearTime = 0;
  }
  function endShot() {
    if (!bodies.some(b => b.alive && b.type === 'enemy')) return;
    bodies = bodies.filter(b => b.alive && b.type !== 'bongi'); current = null;projectiles=[];skillCharges=0;
    if (shots > 0) {
      state = 'ready'; $('aimHint').hidden = false;
      $('statusText').textContent = shots === 1 ? '最後一發！差佬已經喺路邊等緊，唔好射失呀死蠢！' : '再拉多次！試下瞄準結構底部，一鑊過冧撚晒佢！';
    } else {
      state = 'arrest'; arrestTime = 0; blurTime = 0;
      $('statusText').textContent = '差佬：先生，唔該跟我返去冷靜區飲杯茶，乖啦。';
      subtitle('差佬：冇事冇事，跟我去飲杯茶先，死蠢。', 2.2); sound('loss');
    }
    hudDirty = true;updateRogueHud();
  }
  function finish(won) {
    if (state === 'won' || state === 'lost') return;
    if(run){
      state=won?'won':'lost';blurTime=0;canvas.classList.remove('blurry');
      run.ammo=shots;run.score=Math.min(Number.MAX_SAFE_INTEGER,score+(won?shots*100:0));score=run.score;
      recordRun(won?run.wave:run.wave-1);hudDirty=true;updateHud();updateRogueHud();
      if(won){run.phase='choice';persistBoundary();showRogueChoice();sound('win');return;}
      boundary=null;try{localStorage.removeItem('bongi-rogue-save');}catch(_){storageAvailable=false;}
      $('resultTitle').textContent=`無盡結束 · 清 ${run.wave-1} 波`;$('resultMessage').textContent='以同種子及流派再挑戰，或返回標題選每日挑戰。';
      $('resultScore').textContent=String(score);$('resultBest').textContent=String(meta.records[rogue.recordKey(run)]?.score||0);
      $('resultStars').textContent=`最高 ${meta.best} 波`;$('resultEyebrow').textContent='ENDLESS / LOCAL RECORD';$('resultStamp').textContent='∞';$('resultDialog').classList.add('loss');$('nextBtn').hidden=true;$('resultDialog').showModal();return;
    }
    state = won ? 'won' : 'lost'; blurTime = 0; canvas.classList.remove('blurry');
    $('aimHint').hidden = true; $('subtitle').hidden = true; $('eventToast').hidden = true;
    const stars = won ? (shots >= 2 ? 3 : shots >= 1 ? 2 : 1) : 0;
    if (won) { score += shots * 600; const old = records[levelIndex] || {}; records[levelIndex] = { score: Math.max(Number(old.score) || 0, score), stars: Math.max(Number(old.stars) || 0, stars) }; save(); sound('win'); }
    hudDirty = true; updateHud();
    $('resultDialog').classList.toggle('loss', !won); $('resultStamp').textContent = won ? '✓' : '…';
    $('resultEyebrow').textContent = won ? 'STREET CLEARED' : 'PLEASE TRY AGAIN';
    $('resultTitle').textContent = won ? (levelIndex === levels.length-1 ? `${levels.length} 關，全部搞撚掂！` : '全場清撚晒！') : '又輸撚咗！！！！！';
    $('resultMessage').textContent = won ? `邦基成功出窗！剩餘 ${shots} 次發射，獎勵 ${shots * 600} 分，好嘢！${levelIndex === levels.length-1 ? '可以重玩所有關卡，挑戰更高分，威到盡！' : '下一個街角，繼續砌佢！'}` : '邦基俾差佬禮貌咁帶咗去冷靜區。飲完杯茶，再嚟撚過！';
    $('resultScore').textContent = score.toLocaleString(); $('resultBest').textContent = (Number(records[levelIndex]?.score) || 0).toLocaleString();
    $('resultStars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '下次一定撚得！';
    $('resultStars').setAttribute('aria-label', won ? `${stars} 顆星` : '挑戰失敗');
    $('nextBtn').hidden = !won; $('nextBtn').textContent = levelIndex === levels.length-1 ? '通撚關！重遊街區 →' : '下一關 →';
    $('resultDialog').showModal();
  }

  function roundRect(x, y, w, h, r, fill, stroke, line = 2) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke, line = 2) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } }
  function line(points, color, width = 3) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  function text(value, x, y, size = 16, color = '#254b39', weight = 700, align = 'center') { ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Segoe UI", "Microsoft JhengHei", sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y); }
  function cloud(x, y, scale = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ellipse(0,0,55,13,'#fbfcdf'); ellipse(-23,-10,24,18,'#fbfcdf'); ellipse(15,-15,30,22,'#fbfcdf'); ctx.restore(); }
  function background() {
    art.draw(ctx,settings.scene,clock,lowMotion());
  }
  function car() {
    ctx.save();ctx.translate(53,GROUND-5);
    if(!lowMotion()) {
      const kick=Math.sin(recoil*32)*recoil;
      ctx.translate(-kick*12,Math.sin(clock*11)*.55-kick*3);
      ctx.rotate(kick*.025);
    }
    ellipse(137,4,156,13,'#29463125');
    ctx.beginPath();ctx.moveTo(4,-41);ctx.lineTo(4,-115);ctx.quadraticCurveTo(4,-128,20,-130);ctx.lineTo(44,-191);ctx.quadraticCurveTo(49,-203,64,-203);ctx.lineTo(186,-203);ctx.quadraticCurveTo(203,-203,209,-184);ctx.lineTo(227,-130);ctx.lineTo(252,-122);ctx.lineTo(269,-56);ctx.quadraticCurveTo(270,-40,253,-40);ctx.closePath();ctx.fillStyle='#79c6b1';ctx.fill();ctx.strokeStyle='#284f40';ctx.lineWidth=5;ctx.stroke();
    roundRect(62,-189,62,63,5,'#cbe5cb','#335c4b',4);roundRect(136,-189,55,63,5,'#294f46','#335c4b',4);
    line([[143,-176],[143,-143]],'#578276',3);line([[30,-86],[259,-86]],'#eee1a3',15);
    line([[130,-119],[130,-46]],'#559980',2);roundRect(146,-111,22,5,2,'#315848');
    roundRect(251,-109,16,23,5,'#f7eec7','#355547',2);roundRect(0,-70,24,15,4,'#e9d5a1','#355547',2);
    ellipse(61,-38,31,31,'#294238');ellipse(61,-38,15,15,'#e1ddbd');ellipse(61,-38,5,5,'#6e8970');
    ellipse(218,-38,31,31,'#294238');ellipse(218,-38,15,15,'#e1ddbd');ellipse(218,-38,5,5,'#6e8970');
    text('BONGI',65,-105,12,'#192535',900);
    roundRect(149,-77,78,22,2,'#ffe264','#192535',2);text('唔好惹我',188,-66,12,'#b53d37');
    line([[72,-186],[108,-179]],'#192535',6);line([[142,-179],[182,-189]],'#192535',6);
    ctx.restore();
    line([[209,478],[205,407]],'#76583d',10);line([[251,478],[251,407]],'#76583d',10);
    ellipse(205,406,7,6,'#d1b475','#5c4f37');ellipse(251,406,7,6,'#d1b475','#5c4f37');
  }
  function angerMark(x,y,size=13,intensity=1) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/13,size/13);
    line([[-12,-5],[-5,-5],[-5,-12]],'#fff4d7',7);
    line([[5,-12],[5,-5],[12,-5]],'#fff4d7',7);
    line([[-12,5],[-5,5],[-5,12]],'#fff4d7',7);
    line([[5,12],[5,5],[12,5]],'#fff4d7',7);
    const color=intensity>.7?'#e33c40':'#f17635';
    line([[-12,-5],[-5,-5],[-5,-12]],color,4);
    line([[5,-12],[5,-5],[12,-5]],color,4);
    line([[-12,5],[-5,5],[-5,12]],color,4);
    line([[5,12],[5,5],[12,5]],color,4);ctx.restore();
  }
  function steam(x,y,intensity) {
    if(lowMotion()||intensity<.45)return;
    for(let i=0;i<4;i++){
      const phase=(clock*1.05+i*.25)%1;
      ctx.globalAlpha=(1-phase)*.65;
      ellipse(x+(i%2?1:-1)*(34+phase*14),y-15-phase*40,4+phase*8,3+phase*6,'#fff9e2','#edb2a4',1);
    }
    ctx.globalAlpha=1;
  }
  function bongi(x,y,angle=0,mode=null,r=29,squash=0,anger=rage) {
    steam(x,y,anger);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if(!lowMotion())ctx.scale(1+squash*.3,1-squash*.22);
    if (mode==='train') {
      roundRect(-53,-27,99,50,8,'#63a393','#244e3e',4);roundRect(-29,-47,35,29,4,'#f1da9d','#244e3e',3);roundRect(23,-49,15,25,3,'#35594d');
      line([[-49,-51],[7,-51]],'#244e3e',5);for(let i=0;i<3;i++)ellipse(-32+i*30,27,12,12,'#334e3b','#dcd4a4',4);
      ctx.beginPath();ctx.moveTo(46,1);ctx.lineTo(67,23);ctx.lineTo(46,23);ctx.closePath();ctx.fillStyle='#dfad5c';ctx.fill();
      r=24;
    } else {
      // Clothes are always opaque; the pants gag is just scraps plus striped safety shorts.
      roundRect(-r*.8,r*.43,r*1.6,r*.62,7,mode==='pants'?'#f5cf6e':'#3f8270','#264c3c',3);
      if(mode==='pants'){line([[-13,r*.64],[13,r*.64]],'#f1f0cb',4);line([[0,r*.5],[0,r]],'#294e3c',2);}
    }
    ellipse(0,0,r+5,r+5,anger>.75?'#f06a45':'#ffd256','#192535',4);
    ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.clip();
    if(portraitReady) { const size=Math.min(portrait.width,portrait.height);ctx.drawImage(portrait,(portrait.width-size)/2,(portrait.height-size)*.27,size,size,-r,-r,r*2,r*2); }
    else {ctx.fillStyle='#e5ba83';ctx.fillRect(-r,-r,r*2,r*2);ellipse(-10,-3,9,10,'#fffce9','#274b3a',2);ellipse(10,-3,9,10,'#fffce9','#274b3a',2);line([[-2,-3],[2,-3]],'#274b3a',2);ellipse(-8,-2,2,3,'#274b3a');ellipse(8,-2,2,3,'#274b3a');line([[-9,14],[0,18],[10,13]],'#274b3a',2);}
    ctx.restore();
    // Expressive ink eyebrows sit at the portrait edge, retaining the original photo.
    line([[-r*.78,-r*.65],[-r*.22,-r*.43]],'#192535',4);
    line([[r*.2,-r*.43],[r*.75,-r*.7]],'#192535',4);
    if(!portraitReady)text('原創暫代',0,-r-13,10);
    ctx.restore();angerMark(x+r*.9,y-r*1.08,8+anger*5,anger);
  }
  function drawEnemy(b) {
    const danger=state==='flight'&&current&&Math.hypot(current.x-b.x,current.y-b.y)<240;
    if(window.BongiEnemies.draw(ctx,b,clock,lowMotion(),danger))return;
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);const r=b.r;
    const threatened=state==='flight'&&current&&Math.hypot(current.x-b.x,current.y-b.y)<240;
    if(!lowMotion()) {
      const breath=Math.sin(clock*(b.kind==='performer'?4:2.6)+b.id)*.028;
      const squash=(b.squash||0)*.35;
      ctx.translate(0,r);ctx.scale(1+breath+squash,1-breath-squash);ctx.translate(0,-r);
    }
    if(b.kind==='mud') {
      ctx.beginPath();ctx.moveTo(-r,r*.7);ctx.bezierCurveTo(-r*1.5,-r*.6,-r*.4,-r*.9,-r*.2,-r*.87);ctx.bezierCurveTo(r*.2,-r*1.5,r*.55,-r*.7,r*.8,-r*.5);ctx.bezierCurveTo(r*1.3,-r*.1,r*1.2,r*.7,r,r*.7);ctx.quadraticCurveTo(0,r*1.1,-r,r*.7);ctx.fillStyle=b.poison>0?'#acbf53':'#9caa61';ctx.fill();ctx.strokeStyle='#3d5538';ctx.lineWidth=3;ctx.stroke();
      ellipse(-16,10,5,3,'#bfc579');ellipse(17,12,4,3,'#778a46');
    } else {
      roundRect(-r*.85,0,r*1.7,r,8,b.kind==='vendor'?'#cb8d5d':'#af83b4','#405640',3);
      ellipse(0,-7,r*.78,r*.74,'#e9c190','#405640',3);
      if(b.kind==='vendor') {roundRect(-r-7,-r+1,r*2+14,7,3,'#dfb75e','#405640',2);roundRect(-r*.7,-r-11,r*1.4,13,3,'#edce7a','#405640',2);line([[-15,10],[15,10]],'#f0e3b0',4);}
      else { for(let i=-1;i<=1;i++){ellipse(i*14,-r-10-Math.abs(i)*3,6,18,i===0?'#e4bd58':'#8bb9a8','#405640',2);}ellipse(0,-r,4,4,'#f7e7a1');line([[-23,9],[0,20],[23,9]],'#f4d983',4); }
    }
    const eyeY=b.kind==='mud'?-5:-9;
    const blink=!lowMotion()&&(clock+b.id*.63)%4.7<.12;
    const eyeHeight=blink?1.3:threatened?11:9;
    ellipse(-9,eyeY,7,eyeHeight,'#fffce5');ellipse(10,eyeY,7,eyeHeight,'#fffce5');
    if(!blink){ellipse(-11,eyeY+2,2.7,3.5,'#192535');ellipse(8,eyeY+2,2.7,3.5,'#192535');}
    line([[-16,eyeY-12],[-4,eyeY-9]],'#3b5237',3);line([[5,eyeY-9],[17,eyeY-12]],'#3b5237',3);
    if(threatened) {
      ellipse(2,eyeY+17,6,7,'#263645','#fff2ca',2);
      text('!',r+12,-r-20,27,'#cf383a',900);
      ellipse(r+8,-8,3,6,'#7ce4ee','#263645',1);
    } else {
      ctx.beginPath();ctx.moveTo(-6,eyeY+15);ctx.quadraticCurveTo(2,eyeY+21,10,eyeY+13);ctx.strokeStyle='#3b5237';ctx.lineWidth=2;ctx.stroke();
    }
    if(b.hp<b.maxHp){roundRect(-23,38,46,5,3,'#eef2d8');roundRect(-23,38,46*Math.max(0,b.hp/b.maxHp),5,3,'#829b43');}
    ctx.restore();
  }
  function drawBlock(b) {
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);const glass=b.material==='glass';
    roundRect(-b.w/2,-b.h/2,b.w,b.h,2,({glass:'#9ce5ee',stone:'#a3a5ae',metal:'#7e9bad',elastic:'#d798d6'})[b.material]||'#efb65d','#192535',3.5);
    if(b.relay||['stone','metal','elastic'].includes(b.material))text(b.relay?'電':({stone:'石',metal:'鋼',elastic:'彈'})[b.material],0,0,12,'#192535');
    line([[-b.w/2+3,-b.h/2+3],[-b.w/2+3,b.h/2-3]],'#fff5d6',2);
    if(glass){line([[-b.w/2+5,-b.h/2+5],[b.w/2-5,b.h/2-5]],'#ecf9d5',2);}
    else {line([[-b.w/2+5,-b.h/2+6],[b.w/2-5,-b.h/2+6]],'#e1c490',2);line([[-b.w/2+5,b.h/2-5],[b.w/2-5,b.h/2-5]],'#ac8956',2);ellipse(-b.w/2+7,-b.h/2+7,2,2,'#796240');ellipse(b.w/2-7,b.h/2-7,2,2,'#796240');}
    if(b.hp<b.maxHp*.7)line([[-b.w*.2,-b.h*.45],[0,0],[-b.w*.1,b.h*.2],[b.w*.2,b.h*.45]],glass?'#f6ffef':'#77593b',2);
    ctx.restore();
  }
  function policeman(x, y, walk = false) {
    ctx.save();ctx.translate(x,y);const stride=walk?Math.sin(clock*13)*6:0;
    ellipse(0,2,28,6,'#29463122');line([[-9,-20],[-11-stride,0]],'#354d59',9);line([[9,-20],[11+stride,0]],'#354d59',9);
    roundRect(-19,-69,38,49,9,'#779bad','#3a5361',3);line([[-18,-55],[-26,-32]],'#779bad',9);line([[18,-55],[26,-34]],'#779bad',9);
    ellipse(0,-85,20,23,'#e7c298','#3a5361',2);roundRect(-24,-111,48,16,5,'#4d7185','#3a5361',3);roundRect(-25,-98,51,5,2,'#3b5969');
    ellipse(0,-107,4,5,'#f1ce72');ellipse(-7,-85,2,3,'#354c46');ellipse(7,-85,2,3,'#354c46');line([[-5,-74],[4,-72],[9,-76]],'#735f46',2);ellipse(10,-55,5,6,'#ecd481');
    if(walk){roundRect(21,-46,27,17,3,'#f3e9bf','#566c63',2);text('茶',34,-37,11);}
    ctx.restore();
  }
  function trajectory() {
    const p=drag||pull;let x=ANCHOR.x,y=ANCHOR.y,vx=-p.x*POWER,vy=-p.y*POWER;
    if(run){const power=rogue.stats(run).power;vx*=power;vy*=power;}
    ctx.save();
    for(let i=0;i<32;i++){x+=vx*.055;y+=vy*.055;vy+=GRAVITY*.055;if(y>GROUND-10||x>W-10||x<10)break;ctx.globalAlpha=1-i/39;ellipse(x,y,i%4===0?4:2.4,i%4===0?4:2.4,'#fffbed','#3f70552a',1);}
    ctx.restore();
  }
  function renderPose(b) {
    const a=renderAlpha;
    return {...b,x:(b.previousX??b.x)*(1-a)+b.x*a,y:(b.previousY??b.y)*(1-a)+b.y*a,angle:(b.previousAngle??b.angle)*(1-a)+b.angle*a};
  }
  function drawComicImpact(mark) {
    const age=1-mark.life/mark.max;
    const scale=lowMotion()?1:Math.min(1.12,.45+age*6)*(1-Math.max(0,age-.7)*.25);
    ctx.save();ctx.translate(mark.x,mark.y);ctx.rotate(-.12);ctx.scale(scale,scale);
    ctx.globalAlpha=Math.min(1,mark.life*6);
    ctx.beginPath();
    for(let i=0;i<24;i++){
      const a=i/24*TAU,r=i%2?48:65;
      const x=Math.cos(a)*r*1.2,y=Math.sin(a)*r*.55;
      if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    }
    ctx.closePath();ctx.fillStyle=mark.color;ctx.fill();ctx.strokeStyle='#192535';ctx.lineWidth=3;ctx.stroke();
    text(mark.label,2,2,21,'#fff6dc',900);text(mark.label,0,0,21,'#192535',900);ctx.restore();
  }
  function launchBackdrop(){
    if(blastTime<=0||lowMotion()||!settings.impact)return;
    const p=1-blastTime/.9,fade=Math.pow(1-p,2);
    ctx.save();ctx.globalAlpha=fade*.6;
    for(let i=0;i<30;i++){
      const a=i/30*TAU+.07,inner=170+p*650,outer=1700;
      const x=ANCHOR.x,y=ANCHOR.y;
      ctx.beginPath();ctx.moveTo(x+Math.cos(a)*inner,y+Math.sin(a)*inner);
      ctx.lineTo(x+Math.cos(a-.009)*outer,y+Math.sin(a-.009)*outer);
      ctx.lineTo(x+Math.cos(a+.009)*outer,y+Math.sin(a+.009)*outer);
      ctx.closePath();ctx.fillStyle=i%3?'#fff3b3':'#ff744c';ctx.fill();
    }
    for(let i=0;i<3;i++){
      const radius=40+p*(650+i*120);
      ellipse(ANCHOR.x,ANCHOR.y,radius,radius*.8,null,i%2?'#f7725c':'#fff0a1',Math.max(1,13*(1-p)-i*2));
    }
    ctx.restore();
  }
  function blastCaption(){
    if(blastTime<=0||lowMotion()||!settings.impact)return;
    const p=1-blastTime/.9;
    if(p>.7)return;
    ctx.save();ctx.globalAlpha=Math.min(1,blastTime*3);ctx.translate(470,245);ctx.rotate(-.13);
    const s=.85+Math.sin(Math.min(1,p*5)*Math.PI/2)*.2;ctx.scale(s,s);
    ctx.font='italic 900 58px "Microsoft JhengHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=11;ctx.strokeStyle='#202632';ctx.strokeText('BONGI BOOM!',0,0);ctx.fillStyle='#ffdf55';ctx.fillText('BONGI BOOM!',0,0);
    ctx.restore();
  }
  function drawHero() {
    if(screen!=='home')return;
    const c=heroCtx,t=lowMotion()?0:heroClock;
    c.setTransform(heroCanvas.width/W,0,0,heroCanvas.height/H,0,0);
    c.clearRect(0,0,W,H);
    art.draw.hero(c,settings.scene,t,lowMotion());
    // Replace only the illustrated head with the supplied portrait, keeping the
    // original comic pose, clothes and expressive fists around it.
    c.save();c.translate(699,336+Math.sin(t*2)*5);c.rotate(-.18);c.translate(2,-64);
    c.beginPath();c.arc(0,0,60,0,TAU);c.fillStyle='#ffba4a';c.fill();c.strokeStyle='#192535';c.lineWidth=8;c.stroke();
    c.save();c.clip();
    if(portraitReady){const s=Math.min(portrait.width,portrait.height);c.drawImage(portrait,(portrait.width-s)/2,(portrait.height-s)*.27,s,s,-59,-59,118,118);}
    else{c.fillStyle='#f2cd96';c.fillRect(-60,-60,120,120);c.fillStyle='#192535';c.font='bold 18px sans-serif';c.textAlign='center';c.fillText('原創暫代',0,10);c.fillText('◉ ︿ ◉',0,-18);}
    c.restore();
    c.strokeStyle='#192535';c.lineWidth=7;c.lineCap='round';
    c.beginPath();c.moveTo(-48,-35);c.lineTo(-16,-21);c.moveTo(14,-21);c.lineTo(47,-38);c.stroke();
    c.restore();
    // Bounded floating ink accents and toxic puffs. Never flash the whole panel.
    for(let i=0;i<5;i++){
      const phase=(t*.4+i*.2)%1;
      c.globalAlpha=lowMotion()?.23:(1-phase)*.4;
      c.beginPath();c.ellipse(413+phase*175,407-phase*78,14+phase*24,10+phase*19,0,0,TAU);c.fillStyle='#a5dc50';c.fill();
    }
    c.globalAlpha=1;c.save();c.translate(860,350+Math.sin(t*2)*5);c.rotate(.12);
    c.beginPath();for(let i=0;i<24;i++){const a=i/24*TAU,r=i%2?74:93;const x=Math.cos(a)*r,y=Math.sin(a)*r*.56;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle='#ffdd50';c.fill();c.strokeStyle='#192535';c.lineWidth=5;c.stroke();
    c.font='900 34px "Microsoft JhengHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#d93f3e';c.fillText('唔忍啦！',0,0);c.restore();
    c.save();c.translate(768,210);c.rotate(Math.sin(t*2)*.1);c.strokeStyle='#fff8d8';c.lineWidth=10;
    const vein=()=>{c.beginPath();c.moveTo(-20,-8);c.lineTo(-8,-8);c.lineTo(-8,-20);c.moveTo(8,-20);c.lineTo(8,-8);c.lineTo(20,-8);c.moveTo(-20,8);c.lineTo(-8,8);c.lineTo(-8,20);c.moveTo(8,20);c.lineTo(8,8);c.lineTo(20,8);c.stroke();};
    vein();c.strokeStyle='#ec4b49';c.lineWidth=5;vein();c.restore();
  }
  function draw() {
    if(screen!=='game')return;
    canvas.classList.toggle('blurry',blurTime>0&&eventName!=='fog');
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);ctx.save();
    if(blastTime>0&&!lowMotion()&&settings.impact){
      const zoom=1+.032*Math.sin((1-blastTime/.9)*Math.PI)*blastTime/.9;
      ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-W/2,-H/2);
    }
    if(shake>.15&&!lowMotion())ctx.translate(Math.sin(clock*93)*shake,Math.cos(clock*117)*shake);
    background();
    launchBackdrop();
    for(const wave of waveRings){ctx.save();ctx.globalAlpha=wave.life/.65*.6;const r=175*(1-wave.life/.65);ellipse(wave.x,wave.y,r,r,null,'#b8f57a',lowMotion()?2:7);ctx.restore();}
    for(const p of particles)if(p.kind==='gas'){ctx.globalAlpha=Math.max(0,p.life/p.max)*.32;ellipse(p.x,p.y,p.size,p.size*.8,p.color);}ctx.globalAlpha=1;
    car();
    for(const b of bodies)if(b.alive&&b.type==='block')drawBlock(renderPose(b));
    for(const b of bodies)if(b.alive&&b.type==='enemy')drawEnemy({...renderPose(b),coreOpen:!bodies.some(x=>x.alive&&x.relay)||flightTime%3>=2});
    if(!lowMotion()&&state==='flight')for(const pose of trail){
      ctx.save();ctx.globalAlpha=pose.life/.24*.14;ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
      ellipse(0,0,30,28,'#d8f579','#213644',2);ctx.restore();
    }
    if(state==='ready') {
      if(drag||keyboardAim)trajectory();
      const x=ANCHOR.x+(drag?drag.x:0),y=ANCHOR.y+(drag?drag.y:0);
      const stretch=drag?Math.hypot(drag.x,drag.y)/MAX_PULL:0;
      line([[205,410],[x,y],[251,410]],'#192535',7);
      line([[205,410],[x,y]],'#e35d48',3);
      bongi(x,y,drag?Math.atan2(-drag.y,-drag.x)*.18:lowMotion()?0:Math.sin(clock*2)*.04,null,29,-stretch*.65);
      if(!drag){ctx.setLineDash([3,7]);ellipse(ANCHOR.x,ANCHOR.y,43,43,null,'#f8f4cfb0',2);ctx.setLineDash([]);}
    } else if(current&&current.alive&&state!=='arrest'&&state!=='lost'){
      for(const p of projectiles){if(!p.alive||p===current)continue;const child=renderPose(p);bongi(child.x,child.y,child.angle,null,p.r,p.squash||0);}
      const pose=renderPose(current);
      if(run&&meta.cosmetic!=='classic')ellipse(pose.x,pose.y,current.r+6,current.r+6,null,meta.cosmetic==='gold'?'#ffd45b':'#8bf0c5',4);
      bongi(pose.x,pose.y,pose.angle,eventName,current.r,current.squash||0);
      if(!lowMotion()&&Math.hypot(current.vx,current.vy)>250){
        const angle=Math.atan2(current.vy,current.vx);ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(angle);
        for(let i=0;i<3;i++)line([[-48-i*9,(i-1)*19],[-83-i*14,(i-1)*23]],i%2?'#ffda58':'#fff7df',2.5);
        ctx.restore();
      }
    }
    if(shots<=1||state==='arrest'||state==='lost') {
      const travel=state==='arrest'?clamp(arrestTime/1.25,0,1):state==='lost'?1:0;
      const escort=state==='arrest'?clamp((arrestTime-1.3)/.95,0,1)*100:state==='lost'?100:0;
      const x=75+travel*93-escort;policeman(x,GROUND,(travel>0&&travel<1)||escort>0);
      if(state==='arrest'||state==='lost') {bongi(233-travel*12-escort,GROUND-37,Math.sin(clock*4)*.1);if(travel>.85){roundRect(119-escort,GROUND-155,205,29,7,'#fffbea','#76916b',2);text('卡通拘捕 · 去冷靜區飲茶啦死蠢。',221-escort,GROUND-140,12);}}
      else {roundRect(25,GROUND-158,112,26,7,'#fffbea','#76916b',2);text('我喺度等緊你。',81,GROUND-145,12);}
    }
    for(const p of particles) {
      if(p.kind==='gas')continue;ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.translate(p.x,p.y);
      if(p.kind==='squash')ellipse(0,0,p.size*1.35,p.size*.24,p.color);
      else if(p.kind==='glasses'){ctx.rotate(p.angle);ellipse(-10,0,9,10,null,p.color,3);ellipse(11,0,9,10,null,p.color,3);line([[-1,0],[2,0]],p.color,3);}
      else{ctx.rotate(p.angle);roundRect(-p.size/2,-p.size/2,p.size,p.size,1,p.color);}ctx.restore();
    }
    for(const f of floaters){ctx.globalAlpha=Math.min(1,f.life*2);text(f.text,f.x,f.y,f.text==='MISS!'?44:21,f.color,900);}ctx.globalAlpha=1;
    if(eventName==='train'&&state==='flight'&&flightTime<1.8){ctx.globalAlpha=.55;for(let i=0;i<6;i++)line([[420+i*140,365+i*13],[500+i*140,365+i*13]],'#faf4c5',4);ctx.globalAlpha=1;}
    for(const mark of impacts)drawComicImpact(mark);
    if(eventName==='fog'&&blurTime>0){ctx.fillStyle='rgba(236,242,230,.16)';ctx.fillRect(0,0,W,GROUND);}
    blastCaption();
    if(flash>0&&!lowMotion()){ctx.fillStyle=`rgba(255,248,208,${Math.min(.15,flash)})`;ctx.fillRect(0,0,W,H);}
    ctx.restore();updateHud();
    const percent=Math.round(rage*100);
    if(percent!==lastRageLabel){lastRageLabel=percent;$('rageFill').style.width=`${percent}%`;$('rageLabel').textContent=`${percent}%`;}
  }
  function resize() {
    const heroRect=heroCanvas.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,lowMotion()?1.25:2);
    if(heroRect.width){heroCanvas.width=Math.round(heroRect.width*scale);heroCanvas.height=Math.round(heroRect.height*scale);}
    const rect=canvas.getBoundingClientRect();if(!rect.width)return;
    const dpr=scale;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  }
  let keyboardAim=false;
  function position(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  function setPull(p) {
    let dx=p.x-ANCHOR.x,dy=p.y-ANCHOR.y,len=Math.hypot(dx,dy);
    if(len>MAX_PULL){dx*=MAX_PULL/len;dy*=MAX_PULL/len;}
    drag={x:dx,y:dy};pull={...drag};updatePower();
  }
  function updatePower(){const p=drag||pull,percent=Math.round(Math.hypot(p.x,p.y)/MAX_PULL*100);$('powerMeter').hidden=false;$('powerFill').style.width=`${percent}%`;$('powerValue').textContent=`${percent}%`;}
  function cancelDrag(){drag=null;if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);pointerId=null;$('powerMeter').hidden=true;}
  canvas.addEventListener('pointerdown',e=>{
    if(state!=='ready'||paused||screen!=='game'||pointerId!==null||(e.pointerType==='mouse'&&e.button!==0))return;
    const p=position(e),rect=canvas.getBoundingClientRect(),radius=Math.max(53,26*W/rect.width);
    if(Math.hypot(p.x-ANCHOR.x,p.y-ANCHOR.y)>radius)return;
    e.preventDefault();canvas.focus({preventScroll:true});pointerId=e.pointerId;canvas.setPointerCapture(pointerId);keyboardAim=false;setPull(p);$('aimHint').hidden=true;
  });
  canvas.addEventListener('pointermove',e=>{if(pointerId===e.pointerId&&drag){e.preventDefault();setPull(position(e));}});
  canvas.addEventListener('pointerup',e=>{if(pointerId!==e.pointerId||!drag)return;const vector={...drag};cancelDrag();if(!launch(vector))$('aimHint').hidden=false;});
  canvas.addEventListener('pointercancel',()=>{cancelDrag();if(state==='ready')$('aimHint').hidden=false;});
  canvas.addEventListener('lostpointercapture',()=>{if(drag){cancelDrag();if(state==='ready')$('aimHint').hidden=false;}});
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select')||screen!=='game')return;
    const modal=document.querySelector('dialog[open]');
    if(modal){
      if(e.code==='Escape'){e.preventDefault();if(modal!==$('resultDialog')&&modal!==$('rogueChoice'))modal.close();}
      return;
    }
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();openDialog($('pauseDialog'));return;}
    if(e.code==='KeyR'){e.preventDefault();restartCurrent();return;}
    if(run&&state==='flight'&&(e.code==='KeyE'||e.code==='Space')){e.preventDefault();if(!e.repeat)activateSkill();return;}
    if(paused||state!=='ready')return;
    if(e.code==='Space'&&e.target===canvas){e.preventDefault();launch(pull);return;}
    if(e.code.startsWith('Arrow')){
      e.preventDefault();keyboardAim=true;let angle=Math.atan2(pull.y,-pull.x),power=Math.hypot(pull.x,pull.y);
      if(e.code==='ArrowUp')angle+=.055;if(e.code==='ArrowDown')angle-=.055;if(e.code==='ArrowRight')power+=5;if(e.code==='ArrowLeft')power-=5;
      angle=clamp(angle,.05,1.35);power=clamp(power,20,MAX_PULL);pull={x:-Math.cos(angle)*power,y:Math.sin(angle)*power};updatePower();
    }
  });
  document.querySelectorAll('dialog').forEach(d=>{
    d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));
    d.addEventListener('cancel',e=>{if(d===$('resultDialog')||d===$('rogueChoice'))e.preventDefault();});
    d.addEventListener('close',()=>{paused=!!document.querySelector('dialog[open]');syncAudio();audio.unlock();updateRogueHud();lastFrame=0;accumulator=0;if(screen==='game')canvas.focus({preventScroll:true});});
  });
  $('playBtn').addEventListener('click',()=>loadLevel(0));$('chooseBtn').addEventListener('click',()=>setScreen('levels'));
  $('brandHome').addEventListener('click',e=>{e.preventDefault();closeDialogs();setScreen('home');});
  $('levelsBack').addEventListener('click',()=>setScreen('home'));
  $('helpBtn').addEventListener('click',()=>openDialog($('helpDialog')));
  $('settingsBtn').addEventListener('click',()=>{syncSettings();openDialog($('settingsDialog'));});
  $('soundBtn').addEventListener('click',()=>{settings.sound=!settings.sound;syncSettings();save();sound('pop');});
  $('eventChance').addEventListener('input',e=>{settings.chance=Number(e.target.value);syncSettings();save();});
  $('lowEffects').addEventListener('change',e=>{settings.low=e.target.checked;if(lowMotion())trail=[];syncSettings();save();resize();});
  $('soundSetting').addEventListener('change',e=>{settings.sound=e.target.checked;syncSettings();save();sound('pop');});
  $('restartBtn').addEventListener('click',restartCurrent);$('pauseBtn').addEventListener('click',()=>openDialog($('pauseDialog')));
  $('resumeBtn').addEventListener('click',()=>$('pauseDialog').close());$('pauseRestart').addEventListener('click',restartCurrent);
  $('pauseHome').addEventListener('click',()=>{closeDialogs();setScreen('home');});
  $('gameLevelsBtn').addEventListener('click',()=>setScreen('levels'));
  $('retryBtn').addEventListener('click',()=>run?startRogue(run.seed,run.start,run.initialAmmo,run.daily):loadLevel(levelIndex));$('resultLevels').addEventListener('click',()=>{closeDialogs();setScreen('levels');});
  $('endlessBtn').addEventListener('click',()=>startRogue($('rogueSeed').value,$('rogueStart').value,Number($('rogueAmmo').value)));
  $('dailyBtn').addEventListener('click',()=>startRogue(`daily-${new Date().toISOString().slice(0,10)}`,$('rogueStart').value,6,true));
  $('rogueResume').addEventListener('click',resumeRogue);
  $('skillBtn').addEventListener('click',activateSkill);
  $('rogueContinue').addEventListener('click',()=>{if(rogue.advance(run,selectedUpgrade,$('routeChoice').value))loadWave();});
  $('rogueSaveHome').addEventListener('click',()=>{closeDialogs();setScreen('home');});
  $('rogueCosmetic').addEventListener('change',()=>{const value=$('rogueCosmetic').value;if(value==='classic'||value==='mint'&&meta.best>=5||value==='gold'&&meta.best>=10){meta.cosmetic=value;try{localStorage.setItem('bongi-rogue-meta',JSON.stringify(meta));}catch(_){storageAvailable=false;}}refreshRogueHome();});
  refreshRogueHome();
  $('nextBtn').addEventListener('click',()=>{if(levelIndex<levels.length-1)loadLevel(levelIndex+1);else{closeDialogs();setScreen('levels');}});
  $('musicBtn').addEventListener('click',()=>{settings.music=!settings.music;syncSettings();save();audio.unlock();});
  $('musicSetting').addEventListener('change',e=>{settings.music=e.target.checked;syncSettings();save();audio.unlock();});
  $('impactSetting').addEventListener('change',e=>{settings.impact=e.target.checked;save();});
  for(const id of ['musicVolume','sfxVolume'])$(id).addEventListener('input',e=>{settings[id]=Number(e.target.value)/100;syncSettings();save();});
  $('testSoundBtn').addEventListener('click',()=>{
    settings.sound=true;syncSettings();save();audio.setPaused(false);audio.unlock();sound('launch');
  });
  $('bestiaryBtn').addEventListener('click',()=>openDialog($('bestiaryDialog')));
  for(const [kind,def] of Object.entries(window.BongiEnemies.types)){
    const card=document.createElement('article');card.className='enemy-card';
    card.innerHTML=`<canvas class="bestiary-art" width="180" height="150" aria-hidden="true"></canvas><h3>${def.name}</h3><p>${def.description}</p><small>HP ${def.hp} · ${def.points} 分</small>`;
    $('enemyCards').append(card);const c=card.querySelector('canvas').getContext('2d');
    const b={kind,x:90,y:96,angle:0,hp:def.hp,maxHp:def.hp,r:def.r,shield:kind==='helmet'||kind==='shield'};
    if(!window.BongiEnemies.draw(c,b,0,true,false)){
      c.fillStyle=def.color;c.strokeStyle='#263344';c.lineWidth=3;c.beginPath();c.roundRect(60,85,60,40,10);c.fill();c.stroke();
      c.fillStyle=kind==='mud'?def.color:'#ebbd8c';c.beginPath();c.ellipse(90,77,30,31,0,0,TAU);c.fill();c.stroke();
      if(kind==='vendor'){
        c.fillStyle='#f9d36c';c.fillRect(55,49,70,9);c.strokeRect(55,49,70,9);c.fillRect(68,33,44,17);c.strokeRect(68,33,44,17);
        c.fillStyle='#fff3c9';c.fillRect(76,101,30,22);c.strokeRect(76,101,30,22);c.font='bold 12px sans-serif';c.fillStyle='#a65343';c.fillText('$',85,117);
      } else if(kind==='performer'){
        for(let i=-1;i<=1;i++){c.fillStyle=i?'#69c5c1':'#f3cc68';c.beginPath();c.ellipse(90+i*16,36,7,23,i*.3,0,TAU);c.fill();c.stroke();}
        c.fillStyle='#f9de83';c.beginPath();c.moveTo(66,52);c.lineTo(90,42);c.lineTo(114,52);c.fill();c.stroke();
        c.strokeStyle='#f8df8e';c.lineWidth=5;c.beginPath();c.moveTo(62,104);c.lineTo(90,115);c.lineTo(118,104);c.stroke();
      } else {c.fillStyle='#b9ca78';c.beginPath();c.ellipse(68,91,8,4,0,0,TAU);c.fill();c.fillStyle='#6c8144';c.beginPath();c.ellipse(112,99,5,3,0,0,TAU);c.fill();}
      c.fillStyle='#fff6da';for(const x of [79,101]){c.beginPath();c.ellipse(x,75,8,10,0,0,TAU);c.fill();}
      c.fillStyle='#263344';c.fillRect(75,73,5,7);c.fillRect(97,73,5,7);c.strokeStyle='#263344';c.lineWidth=3;
      c.beginPath();c.moveTo(68,61);c.lineTo(86,66);c.moveTo(94,66);c.lineTo(112,60);c.moveTo(80,91);c.quadraticCurveTo(90,101,102,91);c.stroke();
    }
  }
  function audioGesture(){syncAudio();audio.unlock();}
  document.addEventListener('pointerdown',audioGesture,{capture:true});
  document.addEventListener('keydown',audioGesture,{capture:true});
  document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>chooseScene(button.dataset.theme)));
  $('changeSceneBtn').addEventListener('click',()=>{
    const keys=Object.keys(art.themes);chooseScene(keys[(keys.indexOf(settings.scene)+1)%keys.length]);
  });
  motionPreference.addEventListener('change',()=>{syncSettings();resize();});
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game'&&!paused&&(state==='ready'||state==='flight'||state==='arrest'))openDialog($('pauseDialog'));});
  window.addEventListener('blur',()=>{if(screen==='game'&&!paused&&(state==='ready'||state==='flight'||state==='arrest'))openDialog($('pauseDialog'));});
  function frame(now){
    const elapsed=lastFrame?Math.min((now-lastFrame)/1000,.05):0;lastFrame=now;
    const modal=!!document.querySelector('dialog[open]');
    const musicState=audio.snapshot();
    const audioText=musicState.errors.musicLoad||musicState.errors.musicPlay?'音樂暫不可播，遊戲與合成音效仍可使用。':musicState.musicStatus==='playing'?'正在循環播放：Bon Bon Bonji':musicState.musicStatus==='waiting-gesture'?'按下開始後播放 Bon Bon Bonji':musicState.musicStatus==='muted'?'背景音樂已關閉':'背景音樂已暫停／等待播放。';
    if($('audioStatus').textContent!==audioText)$('audioStatus').textContent=audioText;
    document.body.classList.toggle('motion-paused',modal||paused||document.hidden);
    if(!paused&&screen==='game'&&state!=='won'&&state!=='lost'){
      accumulator+=elapsed;let n=0;
      while(accumulator>=DT&&n++<8){step(DT);accumulator-=DT;}
      renderAlpha=clamp(accumulator/DT,0,1);
    }
    if(screen==='home'&&!modal&&!document.hidden)heroClock+=elapsed;
    drawHero();draw();requestAnimationFrame(frame);
  }
  syncSettings();updateSceneLabels();resize();requestAnimationFrame(frame);
  // Opt-in deterministic test harness. Absent in normal play; exercises the real engine.
  if(isTest)window.BongiTest={
    startRogue,skill:activateSkill,resumeRogue,restart:restartCurrent,
    naturalLaunch:(x,y)=>launch({x,y}),
    configure:values=>{Object.assign(settings,values);syncSettings();},
    checkpoint:()=>boundary,
    restore:text=>{const saved=rogue.decode(text);if(!saved)return false;run=saved;boundary=JSON.stringify(saved);if(run.phase==='choice')showRogueChoice();else loadWave();return true;},
    choose:(upgrade,route)=>{if(!run||!rogue.advance(run,upgrade,route))return false;loadWave();return true;},
    damage:(id,amount,poison=false)=>{const b=bodies.find(b=>b.id===id);if(b)applyDamage(b,amount,true,poison);},
    setBody:(id,values)=>{const b=bodies.find(b=>b.id===id);if(b)Object.assign(b,values);},
    rogueSnapshot:()=>({run:run?JSON.parse(JSON.stringify(run)):null,skillCharges,eventGuards,projectiles:projectiles.map(p=>({id:p.id,x:p.x,y:p.y,vx:p.vx,vy:p.vy,r:p.r})),meta:JSON.parse(JSON.stringify(meta))}),
    load:loadLevel,
    launch:(x,y,event=null)=>{forcedEvent=event;return launch({x,y});},
    advance:seconds=>{for(let i=0;i<Math.ceil(seconds/DT);i++)step(DT);if(!paused)renderAlpha=1;draw();},
    scene:chooseScene,
    snapshot:()=>({screen,state,paused,level:levelIndex,levelCount:levels.length,shots,score,shotCount,flightTime,blurTime,event:eventName,collisionCount,trainClears,portraitReady,particles:particles.length,police:shots<=1,clock,rage,blastTime,sodaBursts,shieldsBroken,trail:trail.length,impacts:impacts.length,renderAlpha,lowMotion:lowMotion(),targets:bodies.filter(b=>b.alive&&b.type==='enemy').length,bodies:bodies.filter(b=>b.alive).map(b=>({id:b.id,type:b.type,kind:b.kind,x:b.x,y:b.y,vx:b.vx,vy:b.vy,angle:b.angle,hp:b.hp,shield:b.shield})),settings:{...settings}})
  };
})();