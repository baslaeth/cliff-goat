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
