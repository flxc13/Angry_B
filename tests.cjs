'use strict';
// No dependencies: executes the real rules, enemies, campaign and physics in Node VM.
// Canvas/audio/DOM mocks deliberately do NOT certify layout, media or browser input.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=__dirname;
function boot({storage=new Map(),blocked=false}={}){
  const context=new Proxy({measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={setProperty(){}};this.dataset={};this.listeners={};this.children=[];this.options=[];this.hidden=false;this.open=false;this.value='';this.width=1280;this.height=720;this.attributes={};this.classList={toggle(){},add(){},remove(){}};}
    addEventListener(k,f){(this.listeners[k]||=[]).push(f);}
    emit(k,extra={}){for(const f of this.listeners[k]||[])f({target:this,preventDefault(){},...extra});}
    click(){if(!this.disabled)this.emit('click');}
    getContext(){return context;} getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:1280,height:720};}
    querySelector(s){if(!this.child)this.child=new Element(s==='canvas'?'canvas':'div');return this.child;}
    querySelectorAll(){return [];}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}
    append(e){this.children.push(e);}replaceChildren(){this.children=[];}focus(){}matches(){return false;}
    hasPointerCapture(){return false;}setPointerCapture(){}releasePointerCapture(){}
    showModal(){this.open=true;}close(){this.open=false;this.emit('close');}
  }
  const elements=new Map(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const m of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(m[1]);el.id=m[2];elements.set(m[2],el);}
  elements.get('rogueCosmetic').options=['classic','mint','gold'].map(value=>({value}));
  const extras=new Map(),dialogs=[...elements.values()].filter(e=>e.tagName==='DIALOG');
  const document=new Element();document.body=new Element();document.hidden=false;
  document.getElementById=id=>{assert(elements.has(id),`missing DOM id ${id}`);return elements.get(id);};
  document.createElement=tag=>new Element(tag);
  document.querySelector=s=>{if(s==='dialog[open]')return dialogs.find(d=>d.open)||null;if(!extras.has(s))extras.set(s,new Element());return extras.get(s);};
  document.querySelectorAll=s=>s==='dialog'?dialogs:s==='dialog[open]'?dialogs.filter(d=>d.open):[];
  const localStorage={getItem(k){if(blocked)throw Error('blocked');return storage.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');storage.set(k,v);},removeItem(k){if(blocked)throw Error('blocked');storage.delete(k);}};
  const art={themes:Object.fromEntries(['park','court','bangla','space'].map(k=>[k,{label:k,tag:k,color:'#fff'}])),draw:Object.assign(()=>{},{hero(){}})};
  const sandbox={console,document,localStorage,URLSearchParams,location:{search:'?test=1'},matchMedia:()=>({matches:false,addEventListener(){}}),Image:class{set src(v){}},requestAnimationFrame(){},devicePixelRatio:1,addEventListener(){},BongiArt:art,BongiAudio:{play(){},configure(){},setPaused(){},unlock(){},snapshot:()=>({errors:{}})}};
  sandbox.window=sandbox;vm.createContext(sandbox);
  for(const file of ['rogue.js','enemies.js','levels.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  return {t:sandbox.BongiTest,r:sandbox.BongiRogue,e:elements,storage,document};
}
const json=x=>JSON.parse(JSON.stringify(x));
let passed=0;const failures=[];
function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(error){failures.push(name);console.error('FAIL',name,error.stack);}}
// Boundary fixtures own only real nodes, with enough cleared waves for every pick.
function giantRun(r,branch=null,wave=3,nodes=[]){
  const run=r.create('giant-mechanics','giant');
  run.upgrades=Object.fromEntries([...new Set(['giantReach',...(branch?[branch]:[]),...nodes])].map(id=>[id,1]));
  run.wave=Math.max(wave,1+Object.values(run.upgrades).reduce((a,b)=>a+b,0),...Object.keys(run.upgrades).map(id=>(r.node(id).minWave||0)+1));
  run.ultimateCharge=branch?100:0;assert(r.validate(run),'giant fixture must be a valid v2 boundary');return run;
}
function assertOffers(r,run){
  const before=JSON.stringify(run),offer=r.offers(run);
  assert.deepEqual(json(offer),json(r.offers(run)),'offers must replay deterministically');
  assert.equal(JSON.stringify(run),before,'offers must not mutate the run');
  assert(offer.length<=3);assert.equal(new Set(offer.map(u=>u.id)).size,offer.length);
  for(const u of offer){
    assert((run.upgrades[u.id]||0)<u.max,`capped offer ${u.id}`);
    if(u.kind){
      assert.equal(run.start,'giant');assert(run.wave>=u.minWave,`early node ${u.id}`);
      assert(u.requires.every(id=>run.upgrades[id]===1),`missing prerequisite ${u.id}`);
      assert(!u.requiresAny.length||u.requiresAny.some(id=>run.upgrades[id]===1));
      assert(!u.exclusive||!r.giantNodes.some(other=>other.id!==u.id&&other.exclusive===u.exclusive&&run.upgrades[other.id]));
    }else{
      const after=r.stats({...run,upgrades:{...run.upgrades,[u.id]:(run.upgrades[u.id]||0)+1}});
      assert(after[u.stat]>r.stats(run)[u.stat],`no-effect offer ${u.id}`);
      if(run.start==='giant')assert(!['blast','radius','children','dash'].includes(u.stat),`inactive giant hybrid ${u.id}`);
      if(u.stat==='radius')assert(r.stats(run).blast>0);
    }
  }
  return offer;
}
function until(t,predicate,seconds=5){
  for(let i=0;i<Math.ceil(seconds*120);i++){
    if(predicate(t.rogueSnapshot()))return;
    t.advance(1/120);
  }
  assert(predicate(t.rogueSnapshot()),`condition not reached within ${seconds}s`);
}
const projectile=t=>t.rogueSnapshot().projectiles[0];
const liveBody=(t,id)=>t.snapshot().bodies.find(b=>b.id===id);
const {r}=boot();
test('12 deterministic templates; bounded bodies; rising difficulty; elite/boss schedule',()=>{
  const templates=new Set();
  for(let seed=0;seed<200;seed++)for(const wave of [1,5,10,30,100]){
    const run=r.create(seed);run.wave=wave;const a=r.layout(run),b=r.layout(run);assert.deepEqual(json(a),json(b));templates.add(a.template);
    assert(a.bodies.length<50);assert(a.bodies.every(b=>Number.isFinite(b.x)&&b.x>=600&&b.x<=1200&&b.y>=150&&b.y<=604));
    assert.equal(a.boss,wave%10===0);assert.equal(a.elite,wave%5===0);
    assert.equal(a.bodies.filter(b=>b.relay).length,a.boss?2:0);
  }
  assert.equal(templates.size,12);const a=r.create('difficulty'),d=r.layout(a).difficulty;a.wave=50;assert(r.layout(a).difficulty>d);
});
test('24 upgrades, deterministic unique offers, stack caps and mixed stats',()=>{
  assert.equal(r.upgrades.length,24);const run=r.create('build','split');
  for(let i=0;i<60;i++){run.phase='choice';const offer=assertOffers(r,run);assert(r.advance(run,offer[0]?.id,'normal'));assert(r.validate(run));assert(run.ammo<=8);}
  assert(Object.entries(run.upgrades).every(([id,n])=>n>=1&&n<=r.node(id).max));assert(Object.keys(run.upgrades).length<=24);assert.equal(r.offers(run).length,0);
  const s=r.stats(run);assert(s.children<=3&&s.charges<=2&&s.power<=1.5&&s.blast<=180&&s.radius<=175);
});
test('route transactions reject invalid input and replenish ammo 6 / +3 / max8',()=>{
  const run=r.create('ammo');assert.equal(run.ammo,6);const before=JSON.stringify(run);assert(!r.advance(run,'power','normal'));assert.equal(JSON.stringify(run),before);
  run.phase='choice';run.ammo=1;assert(!r.advance(run,'invalid','normal'));assert(!r.advance(run,r.offers(run)[0].id,'invalid'));
  assert(r.advance(run,r.offers(run).find(u=>u.id!=='reserve').id,'normal'));assert.equal(run.ammo,4);
  run.phase='choice';assert(r.advance(run,r.offers(run)[0].id,'supply'));assert.equal(run.ammo,8);
});
test('immutable 28% event distribution: reproducible, good/bad, no forced miss',()=>{
  assert(Object.isFrozen(r));assert(Object.isFrozen(r.eventPool));assert.throws(()=>{r.EVENT_CHANCE=1;});
  let count=0;const kinds=new Set();for(let i=0;i<10000;i++){const a=r.create(`event${i}`),b=r.create(`event${i}`);const event=r.rollEvent(a);assert.equal(event,r.rollEvent(b));if(event){count++;kinds.add(event);}}
  assert(count>2500&&count<3100);assert.equal(kinds.size,8);assert(!kinds.has('miss'));assert(!kinds.has('glasses'));
});
test('snapshot schema rejects corruption, prototype keys, impossible caps and versions',()=>{
  const run=r.create('save');assert.deepEqual(json(r.decode(JSON.stringify(run))),json(run));
  for(const patch of [{version:999},{wave:-1},{wave:1.5},{ammo:9},{score:Infinity},{start:'bad'},{phase:'flight'},{eventIndex:1},{upgrades:{power:3}},{upgrades:{power:1}},{daily:true}])assert.equal(r.validate({...run,...patch}),null);
  assert.equal(r.decode('{bad'),null);assert.equal(r.decode(JSON.stringify({...run,upgrades:JSON.parse('{"__proto__":1}')})),null);
  assert.notEqual(r.recordKey(run),r.recordKey({...run,initialAmmo:4}));
});
test('all 15 campaign layouts remain idle-stable and campaign settings remain editable',()=>{
  const {t,e}=boot();for(let i=0;i<15;i++){t.load(i);const before=t.snapshot();t.advance(1);assert.equal(t.snapshot().levelCount,15);assert.deepEqual(json(t.snapshot().bodies),json(before.bodies));assert.equal(e.get('eventChance').disabled,false);}
});
test('four starting skills execute; split tracks all projectiles; charges are bounded',()=>{
  for(const start of Object.keys(r.starts)){const {t}=boot();t.startRogue('skills',start);assert.equal(t.snapshot().shots,6);assert(t.launch(-90,35,null));t.advance(.3);assert(t.skill());assert(!t.skill());
    const s=t.rogueSnapshot();assert.equal(s.projectiles.length,start==='split'?3:1);assert.equal(s.skillCharges,0);if(start==='giant')assert(s.projectiles[0].r>29);t.advance(14);assert.notEqual(t.snapshot().state,'flight');}
});
test('roguelike runtime events independent of campaign slider and visual RNG',()=>{
  const a=boot(),b=boot();for(let i=0;i<50;i++){
    a.t.configure({chance:0,low:false});b.t.configure({chance:100,low:true});a.t.startRogue('fixed'+i,'speed');b.t.startRogue('fixed'+i,'speed');
    a.t.naturalLaunch(-90,35);b.t.naturalLaunch(-90,35);assert.equal(a.t.snapshot().event,b.t.snapshot().event);assert(a.e.get('eventChance').disabled&&b.e.get('eventChance').disabled);
    a.t.advance(.5);b.t.advance(.5);assert.deepEqual(json(a.t.snapshot().bodies),json(b.t.snapshot().bodies));
  }
});
test('train is a physical local effect, never timed blanket clear',()=>{
  const {t}=boot();t.load(14);const targets=t.snapshot().targets;t.launch(-20,100,'train');t.advance(1);assert.equal(t.snapshot().targets,targets);assert.equal(t.snapshot().trainClears,0);
  t.load(14);t.launch(-100,5,'train');t.advance(1);assert(t.snapshot().collisionCount>0);assert(t.snapshot().targets>0);assert.equal(t.snapshot().trainClears,0);
});
test('beneficial/adverse events bounded and protective event consumes one guard',()=>{
  const {t}=boot();t.startRogue('events','speed');t.launch(-90,35,'bonus');assert.equal(t.snapshot().shots,6);
  t.startRogue('events','speed');t.launch(-90,35,'shield');t.advance(13);assert.equal(t.rogueSnapshot().eventGuards,1);t.launch(-90,35,'headwind');assert.equal(t.snapshot().event,null);assert.equal(t.rogueSnapshot().eventGuards,0);
  t.startRogue('events','speed');t.launch(-90,35,'fog');t.advance(2.1);assert.equal(t.snapshot().blurTime,0);
});
test('boundary resume reconstructs same wave and ignores in-flight progress',()=>{
  const storage=new Map(),a=boot({storage});a.t.startRogue('resume','split');const initial=a.t.snapshot().bodies,checkpoint=a.t.checkpoint();a.t.launch(-90,35,null);a.t.advance(.5);a.t.skill();
  assert.equal(a.t.checkpoint(),checkpoint);const b=boot({storage});assert(b.t.resumeRogue());assert.deepEqual(json(b.t.snapshot().bodies),json(initial));assert.equal(b.t.snapshot().shots,6);assert.equal(b.t.rogueSnapshot().projectiles.length,0);
  storage.set('bongi-rogue-save','{"version":999}');assert(!b.t.resumeRogue());
});
test('win -> saved choice -> resume -> upgrade/route -> next wave; campaign records isolated',()=>{
  const {t,storage}=boot();t.startRogue('choice','explosive');for(const b of t.snapshot().bodies.filter(b=>b.type==='enemy'))t.damage(b.id,100000,true);
  t.launch(-90,35,null);t.advance(1.2);assert.equal(t.rogueSnapshot().run.phase,'choice');assert.equal(t.snapshot().state,'won');assert(!storage.has('bongi-records'));
  const resumed=boot({storage});assert(resumed.t.resumeRogue());const run=resumed.t.rogueSnapshot().run;assert(resumed.t.choose(r.offers(run)[0].id,'elite'));assert.equal(resumed.t.rogueSnapshot().run.wave,2);assert(resumed.t.snapshot().shots<=8);assert.equal(resumed.t.rogueSnapshot().run.route,'elite');
});
test('boss relays and timed vulnerability change actual damage',()=>{
  const {t}=boot();const run=r.create('boss');run.wave=10;assert(t.restore(JSON.stringify(run)));const boss=t.snapshot().bodies.find(b=>b.kind==='boss');assert(boss);
  for(const b of t.snapshot().bodies.filter(b=>b.kind==='commander'))t.setBody(b.id,{x:600,y:200});
  t.damage(boss.id,100,true);const armoured=t.snapshot().bodies.find(b=>b.id===boss.id).hp;assert(Math.abs(boss.hp-armoured-18)<.001);
  const relays=r.layout(run).bodies.filter(b=>b.relay);for(const relay of relays){const b=t.snapshot().bodies.find(b=>b.type==='block'&&b.x===relay.x&&b.y===relay.y);t.damage(b.id,100000,true);}
  t.damage(boss.id,100,true);assert(Math.abs(armoured-t.snapshot().bodies.find(b=>b.id===boss.id).hp-100)<.001);
});
test('repair/commander/shield mechanics are functional and bounded',()=>{
  const {t}=boot();let run;
  for(let i=0;i<100;i++){run=r.create('enemy'+i);run.wave=15;const kinds=r.layout(run).bodies.map(b=>b.kind);if(kinds.includes('repair')&&kinds.includes('shield'))break;}
  t.restore(JSON.stringify(run));const all=t.snapshot().bodies,repair=all.find(b=>b.kind==='repair'),shield=all.find(b=>b.kind==='shield'),commander=all.find(b=>b.kind==='commander');assert(repair&&shield&&commander);
  t.setBody(shield.id,{x:800,y:570});t.setBody(commander.id,{x:810,y:570});t.damage(shield.id,100);assert.equal(t.snapshot().bodies.find(b=>b.id===shield.id).hp,shield.hp);assert.equal(t.snapshot().bodies.find(b=>b.id===shield.id).shield,false);
  t.damage(shield.id,100,true);assert.equal(t.snapshot().bodies.find(b=>b.id===shield.id).hp,shield.hp-75);
  // Keep the fixture sleeping, out of the projectile path: only repair timers operate.
  for(const b of t.snapshot().bodies)t.setBody(b.id,{x:1100,y:200,sleeping:true});
  t.setBody(repair.id,{x:1000,y:200});const old=t.snapshot().bodies.find(b=>b.id===shield.id).hp;t.launch(-20,100,null);t.advance(4.1);const healed=t.snapshot().bodies.find(b=>b.id===shield.id).hp;assert(healed>old&&healed<=old+56);t.advance(2);assert.equal(t.snapshot().bodies.find(b=>b.id===shield.id).hp,healed);
});
test('storage blocked still plays and can restart from in-memory checkpoint',()=>{
  const {t}=boot({blocked:true});t.startRogue('blocked','split');t.launch(-90,35,null);t.advance(.3);t.restart();assert.equal(t.snapshot().shots,6);assert.equal(t.snapshot().state,'ready');
});
test('daily UI locks 6 initial ammo; daily replay and local record keys are stable',()=>{
  const {t,e}=boot();e.get('rogueStart').value='giant';e.get('rogueAmmo').value='4';e.get('dailyBtn').click();
  const run=t.rogueSnapshot().run;assert(run.daily);assert.equal(run.initialAmmo,6);assert.match(run.seed,/^daily-\d{4}-\d{2}-\d{2}$/);assert(r.validate(run));
  const before=t.snapshot().bodies;e.get('dailyBtn').click();assert.deepEqual(json(t.snapshot().bodies),json(before));
});
test('boss timed window opens with intact relays and visible core state',()=>{
  const {t}=boot(),run=r.create('timed');run.wave=10;t.restore(JSON.stringify(run));
  const boss=t.snapshot().bodies.find(b=>b.kind==='boss');for(const b of t.snapshot().bodies.filter(b=>b.kind==='commander'))t.setBody(b.id,{x:600,y:200});
  t.launch(-20,100,null);t.advance(2.1);const before=t.snapshot().bodies.find(b=>b.id===boss.id).hp;t.damage(boss.id,100,true);assert(Math.abs(before-t.snapshot().bodies.find(b=>b.id===boss.id).hp-100)<.001);
});
test('high-speed projectile contacts a thin wall rather than tunnelling',()=>{
  const {t}=boot();t.load(0);const wall=t.snapshot().bodies.find(b=>b.type==='block');
  for(const b of t.snapshot().bodies)t.setBody(b.id,{x:1200,y:100,sleeping:true});t.setBody(wall.id,{x:800,y:420,w:10,h:180,hp:10000,maxHp:10000});
  t.launch(-100,0,null);const p=t.rogueSnapshot().projectiles[0];t.setBody(p.id,{x:730,y:420,vx:2400,vy:0});t.advance(.06);assert(t.snapshot().collisionCount>0);assert(t.snapshot().bodies.find(b=>b.id===wall.id).hp<10000);
});
test('moving split child prevents finish even when original leaves the screen',()=>{
  const {t}=boot();t.startRogue('settlement','split');t.launch(-90,35,null);t.skill();
  const p=t.rogueSnapshot().projectiles;t.setBody(p[0].id,{x:-500,vx:-10,vy:0});for(const child of p.slice(1))t.setBody(child.id,{x:350,y:-1600,vx:55,vy:0});t.advance(2);assert.equal(t.snapshot().state,'flight');assert(t.rogueSnapshot().projectiles.length===3);
});
test('achievement/cosmetic thresholds persist; lost run removes its checkpoint',()=>{
  const {t,e,storage}=boot(),run=r.create('unlock');run.wave=10;t.restore(JSON.stringify(run));for(const b of t.snapshot().bodies.filter(b=>b.type==='enemy'))t.damage(b.id,100000,true);
  t.launch(-90,35,null);t.advance(1.2);assert(t.rogueSnapshot().meta.achievements.includes('boss'));assert.equal(e.get('rogueCosmetic').options.find(o=>o.value==='gold').disabled,false);
  e.get('rogueCosmetic').value='gold';e.get('rogueCosmetic').emit('change');assert.equal(boot({storage}).t.rogueSnapshot().meta.cosmetic,'gold');
  t.startRogue('loss','speed',4);for(let i=0;i<4;i++){t.launch(-20,100,'miss');t.advance(2.1);}t.advance(3);assert.equal(t.snapshot().state,'lost');assert(!storage.has('bongi-rogue-save'));assert.equal(t.checkpoint(),null);
});
test('desktop skill key and mobile skill button share real handler; pause blocks skill',()=>{
  const {t,e,document}=boot();t.startRogue('input','split');t.launch(-90,35,null);document.emit('keydown',{code:'KeyE',repeat:false,target:e.get('gameCanvas')});assert.equal(t.rogueSnapshot().projectiles.length,3);
  t.restart();t.launch(-90,35,null);e.get('pauseBtn').click();assert(!t.skill());e.get('resumeBtn').click();e.get('skillBtn').click();assert.equal(t.rogueSnapshot().projectiles.length,3);
});
test('finite physics at high speed and maximal hybrid, normal/low effects identical',()=>{
  const run=r.create('stress','split');run.wave=60;run.upgrades=Object.fromEntries(r.upgrades.map(u=>[u.id,2]));
  assert.equal(run.version,2);assert.equal(Object.keys(run.upgrades).length,24);assert(r.validate(run));
  const a=boot(),b=boot();assert(a.t.restore(JSON.stringify(run)));assert(b.t.restore(JSON.stringify(run)));b.t.configure({low:true});
  for(const x of [a,b]){x.t.launch(-100,30,'train');x.t.advance(.6);x.t.skill();x.t.advance(.3);x.t.skill();x.t.advance(13);assert(x.t.snapshot().bodies.every(b=>[b.x,b.y,b.vx,b.vy,b.hp].every(Number.isFinite)));}
  assert.deepEqual(json(a.t.snapshot().bodies),json(b.t.snapshot().bodies));
});
test('ordinary real-physics campaign regression (all 15, no forced wins)',()=>{
  const {t}=boot();const results=[];
  for(let i=0;i<15;i++){
    t.load(i);let used=0;
    while(t.snapshot().state==='ready'&&used<8){
      const target=t.snapshot().bodies.filter(b=>b.type==='enemy').sort((a,b)=>a.x-b.x||b.y-a.y)[0];
      const time=(target.x-226)/690,dy=(370*time*time-(target.y-432))/time/8.05;
      t.launch(-690/8.05,Math.max(3,dy),null);t.advance(15);used++;
    }
    results.push(`${i+1}:${t.snapshot().state}/${used}`);
  }
  console.log('Campaign:',results.join(' '));assert(results.every(s=>s.includes(':won/')));
});
test('endless playable progression through 3 waves with actual shots and skills',()=>{
  const {t}=boot();t.startRogue('BONGI','explosive');const results=[];
  for(let wave=1;wave<=3;wave++){
    let used=0;
    while(t.snapshot().state==='ready'&&used<8){
      const target=t.snapshot().bodies.filter(b=>b.type==='enemy').sort((a,b)=>a.x-b.x||b.y-a.y)[0];
      const time=(target.x-226)/690,dy=(370*time*time-(target.y-432))/time/8.05;
      t.launch(-690/8.05,Math.max(3,dy),null);t.advance(Math.max(.2,time-.08));t.skill();t.advance(15);used++;
    }
    results.push(`${wave}:${t.snapshot().state}/${used}`);assert.equal(t.rogueSnapshot().run.phase,'choice');
    if(wave<3){const run=t.rogueSnapshot().run;assert(t.choose(r.offers(run)[0].id,'normal'));}
  }
  console.log('Endless ordinary shots + skill:',results.join(' '));
});
test('both giant branches clear five curated waves with real aimed shots, skills and earned upgrades',()=>{
  for(const branch of ['quake','magnet']){
    const {t}=boot(),results=[];t.startRogue('BONGI','giant');
    for(let wave=1;wave<=5;wave++){
      let used=0;
      while(t.snapshot().state==='ready'&&used<8){
        const target=t.snapshot().bodies.filter(b=>b.type==='enemy').sort((a,b)=>a.x-b.x||a.y-b.y)[0];
        const speed=720,time=(target.x-226)/speed;
        const pullY=(370*time*time-(Math.min(target.y-140,220)-432))/time/8.05;
        t.target(target.x);assert(t.launch(-speed/8.05,Math.max(3,pullY),null));t.advance(Math.max(.25,time-.12));
        if(t.rogueSnapshot().run.ultimateCharge===100)t.ultimate();else t.skill();
        t.advance(14);used++;
      }
      results.push(`${wave}:${t.snapshot().state}/${used}`);assert.equal(t.snapshot().state,'won');
      if(wave<5){
        const offers=r.offers(t.rogueSnapshot().run);
        const pick=offers.find(u=>u.id===branch)||offers.find(u=>u.id==='giantReach')||offers.find(u=>u.id==='giantWide')||offers[0];
        assert(t.choose(pick.id,'normal'));
      }
    }
    console.log(`Giant ${branch}:`,results.join(' '));
  }
});
test('giant milestones guarantee initial / exclusive branch / mutation choices and first full charge',()=>{
  for(let seed=0;seed<30;seed++)for(const initial of ['giantReach','giantHeight'])for(const branch of ['quake','magnet']){
    const run=r.create(`milestone-${seed}`,'giant');run.phase='choice';
    assert.deepEqual(json(assertOffers(r,run).map(u=>u.id).sort()),['giantHeight','giantReach']);
    assert(!r.giantBuild(run).ultimate);assert.equal(run.ultimateCharge,0);
    assert(r.advance(run,initial,'normal'));assert.equal(run.wave,2);assert(!r.giantBuild(run).ultimate);
    run.phase='choice';assert.deepEqual(json(assertOffers(r,run).map(u=>u.id).sort()),['magnet','quake']);
    assert(r.advance(run,branch,'normal'));assert.equal(run.wave,3);assert.equal(run.ultimateCharge,100);
    assert.equal(r.giantBuild(run).branch,branch);assert(r.giantBuild(run).ultimate);
    run.phase='choice';const third=assertOffers(r,run);assert(third.some(u=>u.kind==='branchUpgrade'));
    assert(!third.some(u=>u.kind==='branch'||u.kind==='mutation'));
    assert(r.advance(run,third[0].id,'normal'));run.phase='choice';
    assert.deepEqual(json(assertOffers(r,run).map(u=>u.id).sort()),['giantHeavy','giantWide']);
    for(const mutation of ['giantWide','giantHeavy']){
      const fork=json(run);assert(r.advance(fork,mutation,'normal'));assert(r.validate(fork));
      assert.equal(r.giantBuild(fork).mutation,mutation==='giantWide'?'wide':'heavy');
      for(let i=0;i<65;i++){
        fork.phase='choice';const offer=assertOffers(r,fork);
        assert(!offer.some(u=>u.kind==='branch'||u.kind==='mutation'));
        assert(r.advance(fork,offer[0]?.id,'normal'));assert(r.validate(fork));
      }
      assert.equal(r.offers(fork).length,0);
    }
  }
});
test('split child and shared stat caps never offer a useless second upgrade; other starts exclude giant nodes',()=>{
  let sawSplit=false;
  for(let seed=0;seed<100;seed++){
    const run=r.create(`split-cap-${seed}`,'split');run.phase='choice';
    sawSplit ||= assertOffers(r,run).some(u=>u.id==='split');
    run.wave=6;run.upgrades={split:1,double:1,power:2,focus:1};
    assert(r.validate(run));assert.equal(r.stats(run).children,3);assert.equal(r.stats(run).charges,2);
    assert(!assertOffers(r,run).some(u=>u.id==='split'||u.id==='double'));
  }
  assert(sawSplit,'first split upgrade remains useful');
  for(const start of ['explosive','split','speed']){
    const run=r.create('non-giant',start);
    for(let i=0;i<60;i++){run.phase='choice';const offer=assertOffers(r,run);assert(offer.every(u=>!u.kind));assert(r.advance(run,offer[0]?.id,'normal'));}
    assert.equal(r.offers(run).length,0);
  }
});
test('giant build parameters apply branch prerequisites, mutations and bounded enhancements',()=>{
  const quake=r.giantBuild(giantRun(r,'quake',8,['quakeEcho','quakeReach','giantHeight','giantWide']));
  assert.equal(quake.plungeReach,300);assert.equal(quake.heightBonus,.28);assert.equal(quake.waveReach,410);
  assert.equal(quake.impactRadius,150);assert.equal(quake.aftershockCount,1);assert.equal(quake.aftershockDelay,.35);
  const magnet=r.giantBuild(giantRun(r,'magnet',8,['magnetReach','giantPocket','giantHeavy']));
  assert.equal(magnet.magnetRadius,240);assert.equal(magnet.magnetLimit,6);assert.equal(magnet.damageMultiplier,1.35);
  assert.equal(magnet.structureMultiplier,1.5);assert.equal(magnet.aftershockCount,0);
  const ordinary=r.create('not-a-giant','split');ordinary.wave=3;ordinary.upgrades={giant:2};
  assert(r.validate(ordinary));assert(!r.giantBuild(ordinary).active);assert(!r.giantBuild(ordinary).ultimate);
  assert(!r.giantBuild({...r.create('forged','giant'),branch:'quake',mutation:'wide'}).ultimate);
});
test('v2 schema rejects malformed giant nodes, prerequisite/exclusivity violations and invalid charge',()=>{
  const run=giantRun(r,'quake',12,['quakeEcho','giantWide']);
  assert.deepEqual(json(r.decode(JSON.stringify(run))),json(run));
  for(const upgrades of [
    {quake:1,magnet:1},{quake:1,giantWide:1,giantHeavy:1},{quakeEcho:1},{magnetReach:1},
    {quake:1,giantPocket:1},{magnet:1,quakeReach:1},{giantWide:1},{giantReach:2},
    {quake:0},{quake:-1},{quake:1.5},{quake:'1'},{quake:true},{unknown:1},[],null,
    JSON.parse('{"__proto__":1}'),JSON.parse('{"constructor":1}')
  ])assert.equal(r.validate({...run,upgrades}),null,`invalid nodes ${JSON.stringify(upgrades)}`);
  for(const charge of [undefined,null,-1,101,1.5,'100',true,NaN,Infinity])assert.equal(r.validate({...run,ultimateCharge:charge}),null,`charge ${charge}`);
  for(const charge of [0,1,99,100])assert(r.validate({...run,ultimateCharge:charge}));
  assert.equal(r.validate({...run,start:'split'}),null);
  assert.equal(r.validate({...r.create('locked','giant'),ultimateCharge:1}),null);
  for(const [wave,upgrades] of [[1,{giantReach:1}],[2,{quake:1}],[3,{quake:1,quakeEcho:1}],[4,{quake:1,giantWide:1}]]){
    assert.equal(r.validate({...run,wave,upgrades,ultimateCharge:0}),null,`node before cleared milestone ${wave}`);
  }
  assert.equal(r.validate({...run,wave:5,upgrades:{giantReach:1,quake:1,quakeEcho:1,giantWide:1,power:1}}),null,'too many picks');
});
test('v1 migration preserves original 24 upgrades, clears charge and catches up via real milestone offers',()=>{
  for(const start of Object.keys(r.starts)){
    const legacy={...r.create('legacy',start),version:1,wave:60,upgrades:Object.fromEntries(r.upgrades.map(u=>[u.id,2]))};
    delete legacy.ultimateCharge;
    const migrated=r.decode(JSON.stringify(legacy));assert(migrated);assert.equal(migrated.version,2);
    assert.deepEqual(json(migrated.upgrades),legacy.upgrades);assert.equal(migrated.ultimateCharge,0);assert(r.validate(migrated));
    assert.match(r.recordKey(migrated),/^v2:/);
    const {t}=boot();assert(t.restore(JSON.stringify(legacy)));assert.equal(t.rogueSnapshot().run.version,2);
    if(start==='giant'){
      assert(!r.giantBuild(migrated).ultimate);migrated.phase='choice';
      assert.deepEqual(json(assertOffers(r,migrated).map(u=>u.id).sort()),['magnet','quake']);
      assert(r.advance(migrated,'quake','normal'));assert.equal(migrated.ultimateCharge,100);
      migrated.phase='choice';assert(assertOffers(r,migrated).every(u=>u.kind==='mutation'));
    }
    assert.equal(r.decode(JSON.stringify({...legacy,upgrades:{quake:1}})),null,'v1 cannot smuggle special nodes');
  }
});
test('five curated giant arenas are distinct, deterministic, bounded and idle-stable (including daily)',()=>{
  const {t}=boot(),names=new Set(),layouts=new Set();
  for(let wave=1;wave<=5;wave++){
    const run=r.create('arena','giant');run.wave=wave;
    const layout=r.layout(run);names.add(layout.name);layouts.add(JSON.stringify(layout.bodies));
    assert.equal(layout.template,12+wave-1);assert(layout.bodies.length<50);assert(layout.bodies.some(b=>b.type==='enemy'));
    assert(layout.bodies.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=600&&b.x<=1200&&b.y>0&&b.y<=604));
    assert.equal(layout.elite,wave===5);assert(!layout.boss);
    for(const daily of [false,true]){
      const other={...run,seed:daily?'daily-2026-09-29':'other-seed',daily};
      assert.deepEqual(json(r.layout(other)),json(layout));assert(t.restore(JSON.stringify(other)));
      const before=json(t.snapshot().bodies);t.advance(5);assert.deepEqual(json(t.snapshot().bodies),before);
      assert.equal(t.rogueSnapshot().giantLandings,0);assert.equal(t.snapshot().state,'ready');
    }
  }
  assert.equal(names.size,5);assert.equal(layouts.size,5);
  const later=giantRun(r,'quake',6);assert(r.layout(later).template<12,'wave six returns to seeded templates');
});
test('plunge target changes real horizontal velocity and stays inside reachable bounds',()=>{
  for(const [target,sign] of [[400,-1],[1000,1]]){
    const {t}=boot();assert(t.restore(JSON.stringify(giantRun(r))));assert(t.launch(-90,35,null));
    const p=projectile(t);t.setBody(p.id,{x:700,y:200,vx:0,vy:0});assert(t.target(target));
    assert(t.skill());const plunging=projectile(t);
    assert(plunging.plunging);assert.equal(Math.sign(plunging.vx),sign);assert(plunging.vy>=950);
    assert(Math.abs(plunging.plungeX-700)<=300);assert.equal(Math.sign(plunging.plungeX-700),sign);
    assert(!t.skill());t.advance(.05);assert.equal(Math.sign(projectile(t).x-700),sign);
  }
  const {t}=boot();assert(t.target(-100));assert.equal(t.rogueSnapshot().giantTarget,400);
  assert(t.target(9999));assert.equal(t.rogueSnapshot().giantTarget,1200);assert(!t.target(NaN));assert(!t.target(Infinity));
});
test('real plunge landing damages a nearby non-contact target, not the whole arena',()=>{
  const {t}=boot();t.startRogue('local-plunge','giant');
  const [near,far]=t.snapshot().bodies.filter(b=>b.type==='enemy');
  t.setBody(near.id,{x:590,y:579,hp:10000,maxHp:10000});t.setBody(far.id,{x:1150,y:577,hp:10000,maxHp:10000});
  assert(t.launch(-90,35,null));t.setBody(projectile(t).id,{x:500,y:200,vx:0,vy:0});t.target(500);
  assert(t.skill());assert.equal(liveBody(t,near.id).hp,10000,'no immediate remote damage');
  until(t,s=>s.giantLandings===1,1);
  assert(liveBody(t,near.id).hp<10000,'landing splash reaches nearby target outside contact radius');
  assert.equal(liveBody(t,far.id).hp,10000);assert(!projectile(t).plunging);
  assert.equal(t.rogueSnapshot().giantWaves,0);assert.equal(t.rogueSnapshot().giantEchoes,0);
  t.advance(2);assert.equal(t.rogueSnapshot().giantLandings,1);assert.equal(t.rogueSnapshot().run.ultimateCharge,0);
});
test('quake landing emits a finite ground wave and exactly one delayed echo',()=>{
  const {t}=boot();assert(t.restore(JSON.stringify(giantRun(r,'quake',4,['quakeEcho']))));
  assert(t.launch(-90,35,null));t.setBody(projectile(t).id,{x:400,y:200,vx:0,vy:0});t.target(400);assert(t.skill());
  until(t,s=>s.giantLandings===1,1);assert.equal(t.rogueSnapshot().giantWaves,1);assert.equal(t.rogueSnapshot().giantEchoes,1);
  t.advance(.3);assert.equal(t.rogueSnapshot().giantEchoes,1);
  until(t,s=>s.giantEchoes===0,.1);assert.equal(t.rogueSnapshot().giantWaves,1,'one delayed echo is now travelling');
  t.advance(1);assert.equal(t.rogueSnapshot().giantWaves,0);assert.equal(t.rogueSnapshot().giantEchoes,0);
  assert.equal(t.rogueSnapshot().giantLandings,1);
});
test('ultimate makes three finite local landings, restores radius and cannot reactivate without charge',()=>{
  for(const branch of ['quake','magnet'])for(const manualFinish of [false,true]){
    const {t}=boot();assert(t.restore(JSON.stringify(giantRun(r,branch))));
    const near=t.snapshot().bodies.find(b=>b.kind==='mud'),far=t.snapshot().bodies.find(b=>b.kind==='shield');assert(near&&far);
    t.setBody(near.id,{x:510,y:579,hp:10000,maxHp:10000});const farHp=far.hp;
    assert(t.launch(-90,35,null));const normalRadius=projectile(t).r;
    t.setBody(projectile(t).id,{x:400,y:200,vx:0,vy:0});t.target(400);
    assert(t.ultimate());assert.equal(t.rogueSnapshot().run.ultimateCharge,0);assert(projectile(t).r>normalRadius);
    assert(projectile(t).ultimate&&projectile(t).plunging);assert(!t.ultimate());assert(!t.skill());
    until(t,s=>s.giantLandings===1,1);assert.equal(projectile(t).bounces,1);
    assert(liveBody(t,near.id).hp<10000);assert.equal(liveBody(t,far.id).hp,farHp);
    until(t,s=>s.giantLandings===2,3);assert.equal(projectile(t).bounces,2);
    if(manualFinish){t.advance(.25);assert(t.ultimate());assert(!t.ultimate());}
    until(t,s=>s.giantLandings===3,3);
    assert(!projectile(t).ultimate);assert.equal(projectile(t).r,normalRadius);assert.equal(projectile(t).bounces,2);
    assert(!t.ultimate());assert.equal(liveBody(t,far.id).hp,farHp);
    t.advance(14);assert.notEqual(t.snapshot().state,'flight');assert.equal(t.rogueSnapshot().giantLandings,3);
    assert(!t.ultimate());assert(t.rogueSnapshot().run.ultimateCharge<=40);
  }
});
test('keyboard Q and mobile ultimate button use the same handler; pause and key repeat block activation',()=>{
  const keyboard=boot(),mobile=boot();
  for(const h of [keyboard,mobile]){
    assert(h.t.restore(JSON.stringify(giantRun(h.r,'magnet'))));assert(!h.t.ultimate());
    assert(h.t.launch(-90,35,null));h.t.advance(.3);h.t.target(500);
    h.e.get('pauseBtn').click();const before=json(h.t.rogueSnapshot());
    h.document.emit('keydown',{code:'KeyQ',repeat:false,target:h.e.get('gameCanvas')});h.e.get('ultimateBtn').click();assert(!h.t.ultimate());
    h.t.advance(1);assert.deepEqual(json(h.t.rogueSnapshot()),before);h.e.get('resumeBtn').click();
    h.document.emit('keydown',{code:'KeyQ',repeat:true,target:h.e.get('gameCanvas')});assert(!projectile(h.t).ultimate);
  }
  keyboard.document.emit('keydown',{code:'KeyQ',repeat:false,target:keyboard.e.get('gameCanvas')});mobile.e.get('ultimateBtn').click();
  assert(projectile(keyboard.t).ultimate);assert(projectile(mobile.t).ultimate);
  assert.deepEqual(json(keyboard.t.rogueSnapshot()),json(mobile.t.rogueSnapshot()));
  for(const h of [keyboard,mobile])h.t.advance(.4);
  assert.deepEqual(json(keyboard.t.rogueSnapshot()),json(mobile.t.rogueSnapshot()));
  assert.deepEqual(json(keyboard.t.snapshot().bodies),json(mobile.t.snapshot().bodies));
});
test('magnet collects only bounded nearby debris and releases the same real blocks on landing',()=>{
  for(const pocket of [false,true]){
    const {t}=boot(),run=giantRun(r,'magnet',5,pocket?['giantPocket']:[]);
    assert(r.validate(run));assert(t.restore(JSON.stringify(run)));
    const blocks=t.snapshot().bodies.filter(b=>b.type==='block');assert(blocks.length>=9);
    // Seven separated fragments of real block bodies, not injected cargo/ability flags.
    // Include a damaged, moving 64x24 fragment to exercise the second eligibility path.
    const pieces=blocks.slice(0,7),far=blocks[7],intact=blocks[8];
    pieces.forEach((b,i)=>{const angle=i*Math.PI*2/7;t.setBody(b.id,{x:450+Math.cos(angle)*70,y:250+Math.sin(angle)*70,w:i===0?64:28,h:24,hp:10000,maxHp:i===0?20000:10000,sleeping:i!==0});});
    t.setBody(far.id,{x:950,y:250,w:28,h:24,hp:10000,maxHp:10000});
    t.setBody(intact.id,{x:570,y:250,w:24,h:108,hp:10000,maxHp:10000,sleeping:true});
    assert(t.launch(-90,35,null));t.setBody(projectile(t).id,{x:450,y:250,vx:0,vy:0});t.target(450);assert(t.skill());t.advance(1/120);
    assert.equal(projectile(t).cargo,pocket?6:4);assert.equal(t.rogueSnapshot().shotCharge,0,'collecting is not destroying');
    const carried=pieces.filter(b=>!liveBody(t,b.id));assert.equal(carried.length,pocket?6:4);
    assert(carried.some(b=>b.id===pieces[0].id),'nearby damaged moving fragment is eligible');
    assert(liveBody(t,far.id));assert.equal(liveBody(t,far.id).vx,0);assert.equal(liveBody(t,far.id).vy,0);
    assert(liveBody(t,intact.id));assert.equal(liveBody(t,intact.id).vx,0,'intact structural support is not attracted');
    until(t,s=>s.giantLandings===1,1);assert.equal(projectile(t).cargo,0);
    for(const b of carried){const released=liveBody(t,b.id);assert(released,`released real block ${b.id}`);assert.equal(released.type,'block');assert(Math.hypot(released.vx,released.vy)>0);}
  }
});
test('magnet reach upgrade attracts a loose piece at 200px but baseline radius does not',()=>{
  for(const enhanced of [false,true]){
    const {t}=boot(),run=giantRun(r,'magnet',4,enhanced?['magnetReach']:[]);assert(t.restore(JSON.stringify(run)));
    const layout=r.layout(run),spec=layout.bodies.find(b=>b.type==='block'&&b.w<=60&&b.h<=60);assert(spec);
    const piece=t.snapshot().bodies.find(b=>b.type==='block'&&b.x===spec.x&&b.y===spec.y);assert(piece);
    t.setBody(piece.id,{x:700,y:250});assert(t.launch(-90,35,null));t.setBody(projectile(t).id,{x:500,y:250,vx:0,vy:0});
    t.target(500);assert(t.skill());t.advance(1/120);
    assert.equal(projectile(t).cargo,0,'attraction is not remote instant capture');
    if(enhanced)assert(liveBody(t,piece.id).vx<0,'240px reach pulls the piece toward the giant');
    else assert.equal(liveBody(t,piece.id).vx,0,'piece beyond 160px remains untouched');
  }
});
test('magnet cannot steal nearby damaged boss relays',()=>{
  const {t}=boot(),run=giantRun(r,'magnet',10);assert(t.restore(JSON.stringify(run)));
  const relaySpec=r.layout(run).bodies.find(b=>b.relay);const relay=t.snapshot().bodies.find(b=>b.type==='block'&&b.x===relaySpec.x&&b.y===relaySpec.y);assert(relay);
  t.setBody(relay.id,{x:450,y:250,hp:relay.hp/2,sleeping:false});
  assert(t.launch(-90,35,null));t.setBody(projectile(t).id,{x:400,y:250,vx:0,vy:0});t.target(400);assert(t.skill());t.advance(1/120);
  assert.equal(projectile(t).cargo,0);assert(liveBody(t,relay.id));assert.equal(liveBody(t,relay.id).vx,0);
});
test('landing grants six charge once; ordinary repeated contacts do not farm charge',()=>{
  const {t}=boot(),run=giantRun(r,'magnet');run.ultimateCharge=0;assert(t.restore(JSON.stringify(run)));
  assert(t.launch(-90,35,null));const id=projectile(t).id;t.setBody(id,{x:400,y:200,vx:0,vy:0});t.target(400);assert(t.skill());
  until(t,s=>s.giantLandings===1,1);assert.equal(t.rogueSnapshot().shotCharge,6);assert.equal(t.rogueSnapshot().run.ultimateCharge,6);
  // Re-contact the floor at ordinary physical velocities without rearming the skill.
  for(let i=0;i<4;i++){t.setBody(id,{x:400,y:510,vx:0,vy:500});t.advance(.15);assert.equal(t.rogueSnapshot().shotCharge,6);assert.equal(t.rogueSnapshot().giantLandings,1);}
  t.advance(14);assert.equal(t.rogueSnapshot().run.ultimateCharge,18,'six landing + twelve settlement');
  t.advance(5);assert.equal(t.rogueSnapshot().run.ultimateCharge,18,'settlement cannot repeat');
});
test('charge is bounded 0..100, destruction awards once, action cap28 + end12 and each shot resets its budget',()=>{
  const {t}=boot(),run=giantRun(r,'magnet',5);run.ultimateCharge=0;assert(t.restore(JSON.stringify(run)));
  assert(t.launch(-20,100,null));const blocks=t.snapshot().bodies.filter(b=>b.type==='block');assert(blocks.length>=10);
  let expected=0;
  for(const b of blocks.slice(0,10)){
    t.damage(b.id,100000,true);expected=Math.min(28,expected+3);assert.equal(t.rogueSnapshot().shotCharge,expected);
    t.damage(b.id,100000,true);assert.equal(t.rogueSnapshot().shotCharge,expected,'destroyed block never awards twice');
    assert.equal(t.rogueSnapshot().run.ultimateCharge,expected);
  }
  t.advance(14);assert.equal(t.snapshot().state,'ready');assert.equal(t.rogueSnapshot().run.ultimateCharge,40);
  t.advance(2);assert.equal(t.rogueSnapshot().run.ultimateCharge,40);
  assert(t.launch(-20,100,'miss'));assert.equal(t.rogueSnapshot().shotCharge,0);t.advance(2.1);
  assert.equal(t.rogueSnapshot().run.ultimateCharge,52);
  for(const charge of [0,95,100]){
    const h=boot(),boundary=giantRun(h.r,'magnet');boundary.ultimateCharge=charge;assert(h.t.restore(JSON.stringify(boundary)));
    assert(h.t.launch(-20,100,'miss'));h.t.advance(2.1);assert.equal(h.t.rogueSnapshot().run.ultimateCharge,Math.min(100,charge+12));
  }
});
test('first branch charge and later saved charge survive restart/resume at boundaries, never in-flight spending',()=>{
  const storage=new Map(),a=boot({storage}),choice=giantRun(a.r,null,2);choice.phase='choice';
  assert(a.t.restore(JSON.stringify(choice)));assert(a.t.choose('quake','normal'));
  assert.equal(a.t.rogueSnapshot().run.ultimateCharge,100);const first=a.t.checkpoint();assert.equal(JSON.parse(first).ultimateCharge,100);
  assert(a.t.launch(-90,35,null));a.t.advance(.3);assert(a.t.ultimate());assert.equal(a.t.rogueSnapshot().run.ultimateCharge,0);
  assert.equal(a.t.checkpoint(),first);a.t.restart();assert.equal(a.t.rogueSnapshot().run.ultimateCharge,100);assert.equal(a.t.rogueSnapshot().giantLandings,0);
  const b=boot({storage});assert(b.t.resumeRogue());assert.equal(b.t.rogueSnapshot().run.ultimateCharge,100);assert.equal(b.t.rogueSnapshot().projectiles.length,0);
  // Controlled clear tests persistence, not a claim of ordinary-shot playability.
  assert(b.t.launch(-90,35,null));assert(b.t.ultimate());
  for(const enemy of b.t.snapshot().bodies.filter(x=>x.type==='enemy'))b.t.damage(enemy.id,100000,true);
  b.t.advance(1.2);assert.equal(b.t.rogueSnapshot().run.phase,'choice');
  const charge=b.t.rogueSnapshot().run.ultimateCharge;assert(charge>0&&charge<=40);assert.equal(JSON.parse(b.t.checkpoint()).ultimateCharge,charge);
  const c=boot({storage});assert(c.t.resumeRogue());assert.equal(c.t.rogueSnapshot().run.ultimateCharge,charge);c.t.restart();assert.equal(c.t.rogueSnapshot().run.ultimateCharge,charge);
  const offer=assertOffers(c.r,c.t.rogueSnapshot().run);assert(c.t.choose(offer[0].id,'normal'));assert.equal(c.t.rogueSnapshot().run.ultimateCharge,charge);
});
test('giant plunge, ultimate, echo and magnet physics are identical with reduced effects',()=>{
  for(const [branch,nodes] of [['quake',['quakeEcho','quakeReach','giantWide']],['magnet',['magnetReach','giantPocket','giantHeavy']]]){
    const a=boot(),b=boot(),run=giantRun(r,branch,8,nodes);
    for(const [h,low] of [[a,false],[b,true]]){
      assert(h.t.restore(JSON.stringify(run)));h.t.configure({low});assert(h.t.launch(-90,35,null));h.t.advance(.7);h.t.target(850);assert(h.t.ultimate());
    }
    for(let i=0;i<50;i++){
      a.t.advance(.1);b.t.advance(.1);
      assert.deepEqual(json(a.t.rogueSnapshot()),json(b.t.rogueSnapshot()));assert.deepEqual(json(a.t.snapshot().bodies),json(b.t.snapshot().bodies));
      for(const h of [a,b]){const s=h.t.rogueSnapshot();assert(s.giantWaves<=8&&s.giantEchoes<=4&&s.shotCharge<=28);assert(s.run.ultimateCharge>=0&&s.run.ultimateCharge<=100);}
    }
    assert(a.t.rogueSnapshot().giantLandings>0);
  }
});
console.log(`\n${passed} suites passed; ${failures.length} failed. DOM/Canvas/audio mocked; browser smoke testing is separate.`);
if(failures.length){console.error('Failing suites:',failures.join('\n'));process.exitCode=1;}