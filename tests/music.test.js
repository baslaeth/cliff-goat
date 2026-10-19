import test from 'node:test';
import assert from 'node:assert/strict';
import { AlpineMusic } from '../music.js';

globalThis.localStorage = {getItem:()=>null, setItem(){}};
globalThis.document = {hidden:false};
function fixture() {
  const sources=[];
  const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  const ctx={state:'running',currentTime:0,
    createOscillator(){const n={frequency:{},connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t;}};sources.push(n);return n;},
    createGain(){return {gain:param,connect(){},disconnect(){}};}};
  const audio={ctx,master:{},muted:false};
  return {music:new AlpineMusic(audio),audio,sources};
}
test('music has one scheduler, finite voices, and stops for mute, hidden tabs and round end',()=>{
  const {music,audio,sources}=fixture();
  try {
    music.update('ready',6); const timer=music.timer;
    music.sync(); music.update('jumping',6); assert.equal(music.timer,timer);
    assert(sources.length>0); assert(sources.every(n=>Number.isFinite(n.stopAt)));
    audio.muted=true; music.sync(); assert.equal(music.timer,null); assert.equal(music.voices.size,0);
    assert(sources.every(n=>n.disconnected));
    audio.muted=false; music.sync(); assert.notEqual(music.timer,null);
    document.hidden=true; music.sync(); assert.equal(music.timer,null);
    document.hidden=false; music.sync();
    for(const status of ['collecting','ended']) {music.update(status,6);assert.equal(music.timer,null);assert.equal(music.voices.size,0);}
    music.setEnabled(false); music.update('ready',0);assert.equal(music.timer,null);
  } finally {music.stop();document.hidden=false;}
});
test('music does not catch up missed beats or depend on hidden outcomes',()=>{
  const {music,audio,sources}=fixture();
  try {
    music.update('ready',0); const initial=sources.length;
    audio.ctx.currentTime=100; music.tick();
    assert(sources.length-initial<=3, 'no backlog burst');
    assert(sources.slice(initial).every(n=>n.startAt>=100));
    for(const voice of [...music.voices])voice.osc.onended();
    assert.equal(music.voices.size,0);
  } finally {music.stop();}
});
