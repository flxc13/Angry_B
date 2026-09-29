/* Pure deterministic endless rules. No DOM, network, wall clock or visual RNG. */
(() => {
  'use strict';
  const VERSION = 2, EVENT_CHANCE = .28;
  const starts = Object.freeze({ explosive:'爆破', giant:'巨人', split:'分裂', speed:'極速' });
  const definitions = [
    ['power','強力彈弓','power',.10], ['mass','加重核心','mass',.25],
    ['radius','爆炸範圍','radius',15], ['blast','爆破增幅','blast',20],
    ['toxin','濃縮綠霧','toxin',4], ['cloud','霧場擴張','cloud',10],
    ['giant','巨人基因','size',3], ['split','分裂基因','children',1],
    ['speed','極速基因','dash',.12], ['explosive','爆破基因','blast',25],
    ['pierce','穿甲撞擊','pierce',.12], ['impact','直接撞擊','damage',.12],
    ['shatter','碎石專家','structure',.18], ['venom','破盾毒素','toxin',5],
    ['bounce','彈力鞋','bounce',.10], ['focus','穩定推進','power',.08],
    ['reserve','備用彈藥','refill',1], ['supply','補給折扣','supply',1],
    ['fortune','獎勵積分','points',.15], ['guard','事件護符','guard',1],
    ['coolant','維修干擾','disrupt',.20], ['aura','指揮干擾','aura',.15],
    ['double','雙次技能','charges',1], ['burst','技能加速','dash',.10]
  ];
  const statNames={power:'發射速度',mass:'質量',radius:'爆破半徑',blast:'技能爆破傷害',toxin:'每秒毒傷',cloud:'毒霧半徑',size:'角色半徑',children:'分裂子彈',dash:'技能速度倍率',pierce:'穿盾傷害比例',damage:'直擊倍率',structure:'結構傷害倍率',bounce:'反彈係數',refill:'每波補彈',supply:'補給路線額外彈藥',points:'敵人得分倍率',guard:'每波事件護符',disrupt:'維修削弱比例',aura:'指揮減傷削弱',charges:'每發技能次數'};
  const upgrades = Object.freeze(definitions.map(([id,name,stat,value])=>Object.freeze({id,name,stat,value,max:2,description:`${statNames[stat]} +${value}（最多 2 層；總效果另設上限）`})));
  // minWave is the CLEARED wave at whose choice a node first becomes available.
  // Special nodes deliberately have no stat/value: stats() only reads the original 24.
  const giantNodes = Object.freeze([
    {id:'giantReach',name:'大隻佬識轉彎',kind:'initial',minWave:1,description:'落地前仲扭得！俯衝修正距離由 180 加到 300，唔使兜路搵落腳位。'},
    {id:'giantHeight',name:'高空加餸',kind:'initial',minWave:1,description:'企得高，落得夠料！每格高度傷害加成由 0.16 加到 0.28。'},
    {id:'quake',name:'地震派：樓下投訴',kind:'branch',minWave:2,exclusive:'branch',description:'落地開地波，樓下話天花震緊！解鎖巨人終極技，即時充滿 100。'},
    {id:'magnet',name:'磁力派：回收大王',kind:'branch',minWave:2,exclusive:'branch',description:'附近碎料唔好嘥，最多收 4 件！解鎖巨人終極技，即時充滿 100。'},
    {id:'quakeEcho',name:'地波返轉頭',kind:'branchUpgrade',minWave:3,requires:['quake'],description:'第一浸未夠喉？0.35 秒後補一浸地波，只補一次，唔會無限返場。'},
    {id:'quakeReach',name:'隔籬街都知',kind:'branchUpgrade',minWave:3,requires:['quake'],description:'地波距離由 230 加到 320，隔籬街都問邊個搬緊櫃。'},
    {id:'magnetReach',name:'隔空執紙皮',kind:'branchUpgrade',minWave:3,requires:['magnet'],description:'收料半徑由 160 加到 240，企遠啲都執到，慳返兩步路！'},
    {id:'giantPocket',name:'環保袋加大碼',kind:'branchUpgrade',minWave:3,requires:['magnet'],description:'磁力收料上限由 4 件加到 6 件；袋夠大，唔使夾硬塞。'},
    {id:'giantWide',name:'橫向發展',kind:'mutation',minWave:4,requiresAny:['quake','magnet'],exclusive:'mutation',description:'落地範圍由 100 加到 150，地波再遠 90；唔係肥，係覆蓋面積大！'},
    {id:'giantHeavy',name:'實心唔呃秤',kind:'mutation',minWave:4,requiresAny:['quake','magnet'],exclusive:'mutation',description:'巨人技能傷害 ×1.35、對結構再 ×1.5；體重磅話要放假。'}
  ].map(n=>Object.freeze({...n,max:1,requires:Object.freeze(n.requires||[]),requiresAny:Object.freeze(n.requiresAny||[])})));
  const allUpgrades = Object.freeze([...upgrades,...giantNodes]);
  /** HUD lookup: node(id) or node(run,id); null for unknown IDs. Not an eligibility check. */
  function node(runOrId,id) { return allUpgrades.find(u=>u.id===(id===undefined?runOrId:id))||null; }
  const owns = (run,id)=>!!run?.upgrades&&Object.hasOwn(run.upgrades,id)&&run.upgrades[id]===1;
  /** Pure mechanic parameters; ignores any run.branch/run.mutation fields.
   * active: only the giant START (the old 'giant' stat upgrade is not a giant start).
   * branch/ultimate: exactly one branch node unlocks the ultimate; caller owns execution.
   * All distances are world pixels. reach aliases plungeReach (horizontal steering).
   * heightBonus is added damage per pixel of plunge height; caller measures the height.
   * waveReach: 230, quakeReach => 320, wide adds 90. impactRadius: 100, wide => 150.
   * magnetRadius: 160, magnetReach => 240; magnetLimit: 4, giantPocket => 6.
   * aftershock means ONE delayed second ground wave, never a recursive echo;
   * aftershockCount is 0/1 and aftershockDelay is seconds (0 when disabled).
   * damageMultiplier scales giant skill damage; structureMultiplier additionally
   * scales that damage against blocks (heavy: 1.35 / 1.5, otherwise 1 / 1).
   * Defaults are returned for non-giants, but active/ultimate/aftershock are false.
   * ultimateCharge is persisted on run, not here; consuming/recharging is caller-owned.
   */
  function giantBuild(run) {
    const active=run?.start==='giant', has=id=>active&&owns(run,id);
    const branch=has('quake')!==has('magnet')?(has('quake')?'quake':'magnet'):null;
    const mutation=branch&&has('giantWide')!==has('giantHeavy')?(has('giantWide')?'wide':'heavy'):null;
    const plungeReach=has('giantReach')?300:180, aftershock=branch==='quake'&&has('quakeEcho');
    return {active,branch,branchName:branch?node(branch).name:'巨人未分派，落地先講！',ultimate:branch!==null,mutation,
      reach:plungeReach,plungeReach,heightBonus:has('giantHeight')?.28:.16,
      waveReach:(branch==='quake'&&has('quakeReach')?320:230)+(mutation==='wide'?90:0),
      impactRadius:mutation==='wide'?150:100,magnetRadius:branch==='magnet'&&has('magnetReach')?240:160,
      magnetLimit:branch==='magnet'&&has('giantPocket')?6:4,aftershock,aftershockCount:aftershock?1:0,aftershockDelay:aftershock?.35:0,
      damageMultiplier:mutation==='heavy'?1.35:1,structureMultiplier:mutation==='heavy'?1.5:1};
  }
  function prerequisites(run,u) {
    return run.start==='giant'&&u.requires.every(id=>owns(run,id))&&(!u.requiresAny.length||u.requiresAny.some(id=>owns(run,id)))&&
      (!u.exclusive||!giantNodes.some(other=>other.id!==u.id&&other.exclusive===u.exclusive&&owns(run,other.id)));
  }
  const templates = Object.freeze(['單塔堡壘','雙塔橋樑','玻璃高樓','階梯陣','低矮掩體','三柱門','雙層城','偏心塔','彈床堡','石門陣','分散哨站','核心碉堡']);
  const giantTemplates = Object.freeze(['落腳先，唔使急','升高兩層當搭棚','紙皮有價，唔好亂掉','兩邊分開，唔好貪心','高矮肥瘦，一齊開檔']);
  const eventPool = Object.freeze(['headwind','heavy','fog','boost','shield','bonus','train','pants']);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(text) { let h=2166136261; for(const c of String(text)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
  function rng(seed) { let a=seed>>>0; return ()=>{ a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function random(run,channel,index=0) { return rng(hash(`${run.seed}/${run.wave}/${channel}/${index}`)); }
  function create(seed,start='explosive',ammo=6,daily=false) {
    return {version:VERSION,seed:String(seed).trim().slice(0,64)||'BONGI',start:Object.hasOwn(starts,start)?start:'explosive',initialAmmo:clamp(Math.round(Number(ammo)||6),4,8),daily:!!daily,wave:1,ammo:clamp(Math.round(Number(ammo)||6),4,8),score:0,route:'normal',upgrades:{},phase:'wave',eventIndex:0,ultimateCharge:0};
  }
  function stats(run) {
    const s={power:1,mass:1,size:29,radius:115,blast:0,toxin:10,cloud:80,children:0,dash:1,damage:1,structure:1,pierce:0,bounce:.37,refill:3,supply:0,points:1,guard:0,disrupt:0,aura:0,charges:1};
    if(run.start==='explosive')s.blast=95;
    if(run.start==='giant'){s.size+=10;s.mass+=.9;}
    if(run.start==='split')s.children=2;
    if(run.start==='speed')s.dash=1.65;
    for(const u of upgrades)s[u.stat]+=u.value*(run.upgrades[u.id]||0);
    for(const [key,max] of Object.entries({power:1.5,mass:2.5,size:44,radius:175,blast:180,toxin:32,cloud:120,children:3,dash:2,damage:1.5,structure:1.6,pierce:.45,bounce:.65,refill:5,supply:2,points:1.6,guard:2,disrupt:.6,aura:.45,charges:2}))s[key]=Math.min(s[key],max);
    return s;
  }
  function offers(run) {
    const r=random(run,'upgrade');
    const shuffle=pool=>pool.map(u=>({u,n:r()})).sort((a,b)=>a.n-b.n).map(x=>x.u);
    const before=stats(run), giant=run.start==='giant';
    const useful=upgrades.filter(u=>{
      if((run.upgrades[u.id]||0)>=u.max)return false;
      if(giant&&['blast','radius','children','dash'].includes(u.stat))return false;
      if(u.stat==='radius'&&before.blast===0)return false;
      const after=stats({...run,upgrades:{...run.upgrades,[u.id]:(run.upgrades[u.id]||0)+1}});
      return after[u.stat]>before[u.stat];
    });
    if(!giant)return shuffle(useful).slice(0,3);
    const build=giantBuild(run), special=giantNodes.filter(u=>!owns(run,u.id)&&run.wave>=u.minWave&&prerequisites(run,u));
    if(run.wave===1)return special.filter(u=>u.kind==='initial');
    // Missing milestones catch up one choice at a time, including migrated v1 runs.
    if(!build.branch&&run.wave>=2)return special.filter(u=>u.kind==='branch');
    if(build.branch&&!build.mutation&&run.wave>=4)return special.filter(u=>u.kind==='mutation');
    const branch=shuffle(special.filter(u=>u.kind==='branchUpgrade'));
    const general=shuffle([...useful,...special.filter(u=>u.kind==='initial')]);
    // Guarantee a branch card plus two compatible stat/utility cards while available.
    // Once general choices run out, remaining branch cards fill the spare slots.
    return [...branch.slice(0,1),...general,...branch.slice(1)].slice(0,3);
  }
  function advance(run,upgrade,route) {
    const clean=validate(run);
    if(!clean||clean.phase!=='choice'||clean.wave>=1000000||!['normal','elite','supply'].includes(route))return false;
    const available=offers(clean);
    if(available.length&&!available.some(u=>u.id===upgrade))return false;
    if(!available.length&&upgrade!=null)return false;
    if(available.length)clean.upgrades[upgrade]=(clean.upgrades[upgrade]||0)+1;
    if(node(upgrade)?.kind==='branch')clean.ultimateCharge=100;
    clean.route=route;clean.wave++;clean.eventIndex=0;clean.phase='wave';
    clean.ammo=Math.min(8,clean.ammo+stats(clean).refill+(route==='supply'?2+stats(clean).supply:0));
    Object.assign(run,clean);
    return true;
  }
  function rollEvent(run) {
    const r=random(run,'events',run.eventIndex++);
    return r()<EVENT_CHANCE?eventPool[Math.floor(r()*eventPool.length)]:null;
  }
  // Curated for ALL giant starts, daily included. No random draws: later waves and
  // other starts retain the original layout stream. Every body has resting support.
  function giantLayout(run) {
    const bodies=[], ground=604, deck=474, upper=344;
    const block=(x,surface,w,h,material='wood')=>bodies.push({type:'block',x,y:surface-h/2,w,h,material});
    const perch=(x,surface=ground,kind='mud')=>{
      const radius={mud:25,vendor:27,soda:25,shield:28,repair:25,commander:30};
      bodies.push({type:'enemy',x,y:surface-radius[kind],kind});
    };
    const tower=(x,width,base=ground,material='wood')=>{
      block(x-width/2+12,base,24,108,material);block(x+width/2-12,base,24,108,material);
      block(x,base-108,width+30,22,material);
    };
    const debris=(x,surface=ground,material='wood')=>block(x,surface,28,24,material);
    switch(run.wave){
      case 1:
        tower(850,180);perch(850);perch(850,deck,'vendor');
        debris(690);debris(1010);break;
      case 2:
        tower(830,200);tower(830,140,deck,'glass');
        perch(830);perch(830,deck);perch(830,upper,'vendor');
        debris(680);debris(1010);debris(1060,ground,'glass');break;
      case 3:
        tower(790,160,ground,'glass');tower(1040,130);
        perch(790);perch(790,deck,'soda');perch(1040);perch(1040,deck,'shield');
        debris(680);debris(890);debris(940,ground,'glass');debris(740,deck);break;
      case 4:
        tower(735,110);tower(1050,150);tower(1050,100,deck,'glass');
        perch(735);perch(735,deck,'shield');perch(1050,ground,'repair');perch(1050,upper,'vendor');
        debris(865);debris(915);debris(675,deck);break;
      case 5:
        tower(780,180);tower(780,130,deck,'glass');tower(780,90,upper,'glass');
        tower(1040,120);perch(780);perch(780,deck,'soda');perch(780,upper-130,'vendor');
        perch(1040,ground,'shield');perch(1040,deck,'repair');
        debris(650);debris(910);debris(945,ground,'glass');break;
    }
    const elite=run.wave%5===0||run.route==='elite', boss=run.wave%10===0;
    if(elite)perch(1170,ground,'commander');
    return {template:templates.length+run.wave-1,name:giantTemplates[run.wave-1],
      difficulty:1+(run.wave-1)*.065+(elite?.28:0)+(run.route==='supply'?.10:0),elite,boss,bodies};
  }
  function layout(run) {
    if(run.start==='giant'&&run.wave>=1&&run.wave<=5)return giantLayout(run);
    const r=random(run,'layout'), t=Math.floor(r()*12), elite=run.wave%5===0||run.route==='elite', boss=run.wave%10===0;
    const difficulty=1+(run.wave-1)*.065+(elite?.28:0)+(run.route==='supply'?.10:0);
    const result=[], add=(type,x,y,extra={})=>result.push({type,x,y,...extra});
    const material=()=>{const n=r();return n<.18?'glass':n<.32?'elastic':n<.50&&run.wave>=3?'stone':n<.68&&run.wave>=6?'metal':'wood';};
    const tower=(x,width,base,mat)=>{add('block',x-width/2+12,base-54,{w:24,h:108,material:mat});add('block',x+width/2-12,base-54,{w:24,h:108,material:mat});add('block',x,base-119,{w:width+30,h:22,material:mat});};
    const kind=()=>{const pool=['mud','vendor','soda',...(run.wave>=2?['shield']:[]),...(run.wave>=3?['repair']:[]),...(run.wave>=4?['commander']:[]),...(run.wave>=8?['brute']:[])];return pool[Math.floor(r()*pool.length)];};
    const target=(x,y,k=kind())=>add('enemy',x,y,{kind:k});
    switch(t){
      case 0:tower(860,210,604,material());target(860,576);target(860,447);break;
      case 1:for(const x of [760,1040]){tower(x,130,604,material());target(x,447);target(x,576);}add('block',900,465,{w:115,h:20,material:'glass'});break;
      case 2:for(let i=0;i<3;i++){tower(875,180-i*25,604-i*130,'glass');target(875,576-i*130);}target(875,187);break;
      case 3:for(let i=0;i<3;i++){tower(730+i*165,125,604,material());if(i)tower(730+i*165,100,474,'wood');target(730+i*165,i?317:447);}break;
      case 4:for(const x of [750,915,1080]){add('block',x-48,572,{w:25,h:64,material:material()});target(x,576);}break;
      case 5:for(const x of [750,890,1030]){add('block',x,550,{w:26,h:108,material:material()});target(x+65,576);}add('block',890,485,{w:340,h:22,material:'wood'});target(890,447);break;
      case 6:for(const x of [780,1050]){tower(x,165,604,material());tower(x,110,474,'wood');target(x,317);target(x,576);}break;
      case 7:tower(840,210,604,material());tower(900,115,474,'wood');target(900,317);target(800,447);target(840,576);break;
      case 8:for(const x of [790,1040]){tower(x,150,604,'elastic');target(x,447);target(x,576);}break;
      case 9:tower(865,220,604,run.wave>=6?'metal':'stone');target(865,576);target(865,447);target(1090,576,'soda');break;
      case 10:for(const x of [700,850,1000,1150]){target(x,576);add('block',x-42,575,{w:20,h:58,material:material()});}break;
      case 11:tower(890,240,604,material());tower(890,140,474,'glass');target(890,317);target(825,576);target(955,576);break;
    }
    // Extra exposed flank units raise pressure without unlimited body counts.
    for(let i=0;i<Math.min(3,Math.floor(run.wave/7));i++)target(660+i*95,570-i*12);
    if(elite)target(1150,560,'commander');
    if(boss){target(1030,550,'boss');add('block',970,570,{w:24,h:68,material:'metal',relay:true});add('block',1110,570,{w:24,h:68,material:'metal',relay:true});}
    return {template:t,name:templates[t],difficulty,elite,boss,bodies:result};
  }
  function validate(data) {
    if(!data||typeof data!=='object'||Array.isArray(data)||![1,VERSION].includes(data.version)||typeof data.seed!=='string'||!data.seed.length||data.seed.length>64||typeof data.start!=='string'||!Object.hasOwn(starts,data.start))return null;
    for(const [key,min,max] of [['wave',1,1000000],['ammo',0,8],['initialAmmo',4,8],['score',0,Number.MAX_SAFE_INTEGER],['eventIndex',0,100]])if(!Number.isSafeInteger(data[key])||data[key]<min||data[key]>max)return null;
    if(typeof data.daily!=='boolean'||!['normal','elite','supply'].includes(data.route)||!['wave','choice'].includes(data.phase)||!data.upgrades||Array.isArray(data.upgrades)||typeof data.upgrades!=='object')return null;
    if(data.phase==='wave'&&(data.ammo<1||data.eventIndex!==0))return null;
    if(data.daily&&(data.initialAmmo!==6||!/^daily-\d{4}-\d{2}-\d{2}$/.test(data.seed)))return null;
    let count=0;const clean={};
    for(const [id,n] of Object.entries(data.upgrades)){
      const u=node(id);
      if(!u||!Number.isInteger(n)||n<1||n>u.max||(data.version===1&&u.kind))return null;
      clean[id]=n;count+=n;
    }
    if(count>data.wave-1)return null;
    const checked={start:data.start,upgrades:clean};
    for(const u of giantNodes)if(owns(checked,u.id)&&
      (data.wave<=u.minWave||!prerequisites(checked,u)))return null;
    // v1 had no special nodes/charge. Preserve every original upgrade, even old
    // inactive giant hybrids. A missing branch is OFFERED next, never granted free.
    const ultimateCharge=data.version===1?0:data.ultimateCharge;
    if(!Number.isInteger(ultimateCharge)||ultimateCharge<0||ultimateCharge>100||(!giantBuild(checked).ultimate&&ultimateCharge!==0))return null;
    return {version:VERSION,seed:data.seed,start:data.start,initialAmmo:data.initialAmmo,daily:data.daily,wave:data.wave,ammo:data.ammo,score:data.score,route:data.route,phase:data.phase,eventIndex:data.eventIndex,upgrades:clean,ultimateCharge};
  }
  function decode(text){try{return validate(JSON.parse(text));}catch(_){return null;}}
  // v2 balance/offer rules are a separate leaderboard, including migrated runs.
  function recordKey(run){return `v${VERSION}:${run.daily?'daily':'seed'}:${run.seed}:${run.start}:${run.initialAmmo}`;}
  window.BongiRogue=Object.freeze({VERSION,EVENT_CHANCE,starts,upgrades,giantNodes,allUpgrades,node,giantBuild,templates,giantTemplates,eventPool,hash,rng,create,stats,offers,advance,rollEvent,layout,validate,decode,recordKey});
})();