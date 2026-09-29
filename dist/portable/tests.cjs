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
let passed=0;function test(name,fn){try{fn();passed++;console.log('PASS',name);}catch(error){console.error('FAIL',name);throw error;}}
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
  for(let i=0;i<60;i++){run.phase='choice';const offer=r.offers(run);assert.deepEqual(json(offer),json(r.offers(run)));assert.equal(new Set(offer.map(u=>u.id)).size,offer.length);assert(r.advance(run,offer[0]?.id,'normal'));assert(run.ammo<=8);}
  assert(Object.values(run.upgrades).every(n=>n===2));assert.equal(Object.keys(run.upgrades).length,24);assert.equal(r.offers(run).length,0);
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
  for(const patch of [{version:2},{wave:-1},{wave:1.5},{ammo:9},{score:Infinity},{start:'bad'},{phase:'flight'},{eventIndex:1},{upgrades:{power:3}},{upgrades:{power:1}},{daily:true}])assert.equal(r.validate({...run,...patch}),null);
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
  const a=boot(),b=boot();a.t.restore(JSON.stringify(run));b.t.restore(JSON.stringify(run));b.t.configure({low:true});
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
console.log(`\n${passed} suites passed. DOM/Canvas/audio mocked; browser smoke testing is separate.`);