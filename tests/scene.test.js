import test from 'node:test';
import assert from 'node:assert/strict';
import { MountainScene } from '../scene.js';

globalThis.devicePixelRatio=1;
globalThis.requestAnimationFrame=()=>1;
globalThis.ResizeObserver=class { observe() {} };
const visibilityListeners=[];
globalThis.document={hidden:false,addEventListener:(event,fn)=>{if(event==='visibilitychange')visibilityListeners.push(fn);}};
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
function makeScene(width=1100,height=480) {
  const ctx=new Proxy({globalAlpha:1,createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:()=>{}});
  const sounds=[];
  const scene=new MountainScene({getContext:()=>ctx,getBoundingClientRect:()=>({width,height})},{play:e=>sounds.push(e)});
  return {scene,sounds};
}

test('success and both failure animations settle once within two seconds, including reduced motion', () => {
  for(const reduced of [false,true]) for(const variant of [null,'crumble','shear']) {
    const {scene,sounds}=makeScene(); scene.setReducedOverride(reduced); let settled=0;
    scene.jump({from:0,success:!variant,variant},()=>settled++); const start=scene.motion.start;
    assert.equal(scene.jump({from:0,success:true},()=>{}),false);
    scene.draw(start+800); assert.equal(settled,0); assert(!sounds.includes('hoof'));
    scene.draw(start+900); assert(sounds.includes('hoof')); assert(!sounds.includes('crack'));
    scene.draw(start+1999); assert.equal(settled,0);
    scene.draw(start+2001); scene.draw(start+2500); assert.equal(settled,1);
    assert.equal(sounds.filter(s=>s==='takeoff').length,1); assert.equal(sounds.filter(s=>s==='hoof').length,1);
    assert.equal(sounds.includes('crack'),Boolean(variant)); assert.equal(scene.fallen,Boolean(variant));
    if(!variant) {assert.equal(scene.stage,1);assert.equal(scene.camera,1);}
    scene.reset(); assert.equal(scene.fallen,false); assert.equal(scene.failedLedge,-1); assert.equal(scene.stage,0);
  }
});

test('expressions before contact do not disclose success or failure; failure reacts only after the crack', () => {
  const poses=[];
  for(const success of [true,false]) {
    const {scene}=makeScene(); scene.goat=(x,y,p)=>poses.push({...p}); scene.jump({from:0,success,variant:'shear'},()=>{});
    scene.draw(scene.motion.start+600);
  }
  assert.deepEqual(poses[0],poses[1]); assert.equal(poses[0].startled,0);
});

test('both failed ledges stay absent after settlement and reappear only on reset', () => {
  for (const reduced of [false, true]) for (const variant of ['crumble', 'shear']) {
    const {scene} = makeScene(320, 340);
    scene.setReducedOverride(reduced);
    const drawn = [];
    scene.ledge = index => drawn.push(index);
    scene.shearLedge = index => drawn.push(index);
    scene.jump({from:0, success:false, variant}, () => {});
    const start = scene.motion.start;
    scene.draw(start + 2001);
    for (const ms of [2100, 3000, 10000]) {
      drawn.length = 0; scene.draw(start + ms);
      assert(!drawn.includes(1), `${variant} left a failed ledge at ${ms}ms`);
      assert(drawn.includes(0)); assert(drawn.includes(2));
    }
    scene.reset(); drawn.length = 0; scene.draw(start + 11000);
    assert(drawn.includes(1));
  }
});

test('sheared edge falls with the slab and leaves no geometry at completion', () => {
  for (const reduced of [false, true]) {
    const {scene} = makeScene(); scene.setReducedOverride(reduced);
    const translations = [];
    scene.ctx.translate = (x, y) => translations.push([x, y]);
    scene.ledge = () => {};
    scene.shearLedge(1, .6);
    assert(translations[0][1] > 0, 'unsupported edge must fall');
    assert(translations[1][1] > translations[0][1], 'main slab falls first');
    let geometry = 0;
    scene.ledge = scene.line = scene.polygon = () => geometry++;
    scene.shearLedge(1, 1);
    assert.equal(geometry, 0);
  }
});

test('collection and summit use the same short shelter sequence, one bell, and distinct summit accent', () => {
  for(const final of [false,true]) {
    const {scene,sounds}=makeScene(); scene.stage=final?12:1; scene.camera=scene.stage; let settled=0;
    scene.collect(final,()=>settled++); const start=scene.motion.start;
    scene.draw(start+1000); assert(sounds.includes('bell')); assert.equal(settled,0);
    scene.draw(start+1670); scene.draw(start+2300); assert.equal(settled,1);
    assert.equal(sounds.filter(s=>s==='bell').length,1); assert.equal(sounds.includes('summit'),final);
    assert(scene.shelterOffset()+34<=scene.ledgeHalf(scene.stage));
  }
});

test('background tab pause shifts the motion clock; all 12 ledges retain usable geometry', () => {
  const {scene}=makeScene(); scene.jump({from:0,success:true},()=>{});
  const initial=scene.motion.start;
  document.hidden=true; visibilityListeners.at(-1)(); scene.pausedAt-=2000;
  document.hidden=false; visibilityListeners.at(-1)();
  assert(scene.motion.start-initial>=2000);
  for(let i=1;i<=12;i++)assert(scene.ledgeHalf(i)>=45);
});

test('flight reserves horn clearance on short desktop and narrow mobile scenes', () => {
  for(const [width,height] of [[1154,400],[1400,400],[277,340],[347,340]]) for(const reduced of [false,true]) {
    const {scene}=makeScene(width,height); scene.setReducedOverride(reduced);
    scene.goat=(x,y)=>assert(y-135*scene.s>=0,`Clipped horns at ${width}×${height}`);
    scene.jump({from:0,success:true},()=>{}); const start=scene.motion.start;
    for(let ms=0;ms<=850;ms+=10)scene.draw(start+ms);
  }
});


test('hoof contact stays planted through weight compression, with cloven toes on all legs', () => {
  const {scene}=makeScene(); scene.reduced=true;
  const base={scale:1,opacity:1,airborne:0,tilt:0,crouch:0,scramble:0,walk:0,nod:0,focus:0,startled:0,relief:0};
  const feet=[];
  scene.polygon=(points,color)=>{if(['#596052','#414b40'].includes(color))feet.push(points);};
  scene.goat(0,0,base); const resting=feet.splice(0);
  scene.goat(0,0,{...base,crouch:1});
  assert.equal(resting.length,4); assert.deepEqual(feet,resting);
  feet.length=0;scene.goat(0,0,{...base,airborne:1});
  assert(feet.every(foot=>foot.every(point=>point[1]<-2)), 'all hooves clear the ground during flight');
});

test('day/night interpolation is bounded, reversible, reduced-motion aware and independent of the round', () => {
  const {scene}=makeScene(); scene.jump({from:0,success:true},()=>{});
  const attempt=scene.motion;
  scene.setNight(true); const start=scene.themeTransition.start;
  scene.draw(start+175); assert(scene.night>0 && scene.night<1);
  assert.notEqual(scene.color('#b8d8d8'),'#b8d8d8');
  scene.draw(start+351); assert.equal(scene.night,1);
  assert.equal(scene.color('#b8d8d8'),'#182c49'); assert.equal(scene.motion,attempt);
  scene.setNight(false);scene.draw(scene.themeTransition.start+351);assert.equal(scene.night,0);
  scene.setReducedOverride(true);scene.setNight(true);assert.equal(scene.night,1);assert.equal(scene.themeTransition,null);
});

test('mascot reacts to settled events with focus, pride, surprise and collection relief', () => {
  for(const success of [true,false]) {
    const {scene}=makeScene();let pose;
    scene.goat=(x,y,p)=>{pose=p;};scene.jump({from:0,success,variant:'crumble'},()=>{});
    const start=scene.motion.start;
    scene.draw(start+150);assert(pose.focus>0);assert.equal(pose.startled,0);assert.equal(pose.proud,0);
    scene.draw(start+1400);
    if(success){assert(pose.proud>0);assert.equal(pose.startled,0);}
    else {assert.equal(pose.startled,1);assert.equal(pose.proud,0);}
  }
  const {scene}=makeScene();let pose;scene.goat=(x,y,p)=>{pose=p;};
  scene.collect(false,()=>{});scene.draw(scene.motion.start+300);assert(pose.relief>0);
});
