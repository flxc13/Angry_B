/* Pure deterministic endless rules. No DOM, network, wall clock or visual RNG. */
(() => {
  'use strict';
  const VERSION = 1, EVENT_CHANCE = .28;
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
  const templates = Object.freeze(['單塔堡壘','雙塔橋樑','玻璃高樓','階梯陣','低矮掩體','三柱門','雙層城','偏心塔','彈床堡','石門陣','分散哨站','核心碉堡']);
  const eventPool = Object.freeze(['headwind','heavy','fog','boost','shield','bonus','train','pants']);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  function hash(text) { let h=2166136261; for(const c of String(text)) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
  function rng(seed) { let a=seed>>>0; return ()=>{ a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function random(run,channel,index=0) { return rng(hash(`${run.seed}/${run.wave}/${channel}/${index}`)); }
  function create(seed,start='explosive',ammo=6,daily=false) {
    return {version:VERSION,seed:String(seed).trim().slice(0,64)||'BONGI',start:Object.hasOwn(starts,start)?start:'explosive',initialAmmo:clamp(Math.round(Number(ammo)||6),4,8),daily:!!daily,wave:1,ammo:clamp(Math.round(Number(ammo)||6),4,8),score:0,route:'normal',upgrades:{},phase:'wave',eventIndex:0};
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
    return upgrades.filter(u=>(run.upgrades[u.id]||0)<u.max).map(u=>({u,n:r()})).sort((a,b)=>a.n-b.n).slice(0,3).map(x=>x.u);
  }
  function advance(run,upgrade,route) {
    if(run.phase!=='choice'||!['normal','elite','supply'].includes(route))return false;
    const available=offers(run);
    if(available.length&&!available.some(u=>u.id===upgrade))return false;
    if(available.length)run.upgrades[upgrade]=(run.upgrades[upgrade]||0)+1;
    run.route=route;run.wave++;run.eventIndex=0;run.phase='wave';
    run.ammo=Math.min(8,run.ammo+stats(run).refill+(route==='supply'?2+stats(run).supply:0));
    return true;
  }
  function rollEvent(run) {
    const r=random(run,'events',run.eventIndex++);
    return r()<EVENT_CHANCE?eventPool[Math.floor(r()*eventPool.length)]:null;
  }
  function layout(run) {
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
    if(!data||data.version!==VERSION||typeof data.seed!=='string'||!data.seed.length||data.seed.length>64||!Object.hasOwn(starts,data.start))return null;
    for(const [key,min,max] of [['wave',1,1000000],['ammo',0,8],['initialAmmo',4,8],['score',0,Number.MAX_SAFE_INTEGER],['eventIndex',0,100]])if(!Number.isSafeInteger(data[key])||data[key]<min||data[key]>max)return null;
    if(typeof data.daily!=='boolean'||!['normal','elite','supply'].includes(data.route)||!['wave','choice'].includes(data.phase)||!data.upgrades||Array.isArray(data.upgrades)||typeof data.upgrades!=='object')return null;
    if(data.phase==='wave'&&(data.ammo<1||data.eventIndex!==0))return null;
    if(data.daily&&(data.initialAmmo!==6||!/^daily-\d{4}-\d{2}-\d{2}$/.test(data.seed)))return null;
    let count=0;const clean={};
    for(const [id,n] of Object.entries(data.upgrades)){const u=upgrades.find(u=>u.id===id);if(!u||!Number.isInteger(n)||n<1||n>u.max)return null;clean[id]=n;count+=n;}
    if(count>data.wave-1)return null;
    return {version:VERSION,seed:data.seed,start:data.start,initialAmmo:data.initialAmmo,daily:data.daily,wave:data.wave,ammo:data.ammo,score:data.score,route:data.route,phase:data.phase,eventIndex:data.eventIndex,upgrades:clean};
  }
  function decode(text){try{return validate(JSON.parse(text));}catch(_){return null;}}
  function recordKey(run){return `${run.daily?'daily':'seed'}:${run.seed}:${run.start}:${run.initialAmmo}`;}
  window.BongiRogue=Object.freeze({VERSION,EVENT_CHANCE,starts,upgrades,templates,eventPool,hash,rng,create,stats,offers,advance,rollEvent,layout,validate,decode,recordKey});
})();