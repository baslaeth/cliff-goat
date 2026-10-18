import test from 'node:test';
import assert from 'node:assert/strict';
import { AlpineAudio } from '../audio.js';

class Param {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param();
  loop = false; disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
  start(at=0) { this.startAt = at; }
  stop(at=0) { this.stopAt = at; }
}
class Context {
  currentTime = 0; sampleRate = 48000; state = 'running'; destination = {}; sources = []; nodes = [];
  createGain() { const n = new Node(); this.nodes.push(n); return n; }
  createBiquadFilter() { const n = new Node(); this.nodes.push(n); return n; }
  createOscillator() { const n = new Node(); this.sources.push(n); return n; }
  createBufferSource() { const n = new Node(); this.sources.push(n); return n; }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.state = 'running'; }
  advance(seconds) {
    this.currentTime += seconds;
    this.sources.filter(n => !n.ended && n.stopAt <= this.currentTime).forEach(n => { n.ended = true; n.onended?.(); });
  }
}
globalThis.window = { AudioContext: Context };
globalThis.localStorage = { getItem: () => null, setItem() {} };

test('audio unlock and repeated mute/unmute create no ambient sources', async () => {
  const audio = new AlpineAudio(); await audio.unlock(); await audio.unlock();
  for(let i=0;i<10;i++) { audio.setMuted(true); audio.setMuted(false); }
  assert.equal(audio.ctx.sources.length,0); assert.equal(audio.activeVoiceCount,0);
});

test('consecutive jump cues are bounded, non-looping, and fully disconnected between actions', async () => {
  const audio = new AlpineAudio(); await audio.unlock();
  for(let i=0;i<20;i++) {
    for(const [event, maxDuration] of [['takeoff',.12],['hoof',.10],['scramble',.11]]) {
      const prior = audio.ctx.sources.length; audio.play(event);
      const current = audio.ctx.sources.slice(prior);
      assert(current.length>0);
      for(const source of current) {
        assert.equal(source.loop,false);
        assert(source.stopAt-audio.ctx.currentTime<=maxDuration+1e-8);
      }
      audio.ctx.advance(.2);
      assert.equal(audio.activeVoiceCount,0);
      assert(current.every(source=>source.disconnected));
    }
    audio.ctx.advance(5); assert.equal(audio.activeVoiceCount,0);
  }
  assert(audio.ctx.nodes.slice(1).every(node=>node.disconnected));
});

test('mute stops active and scheduled voices; unmute never replays them', async () => {
  const audio = new AlpineAudio(); await audio.unlock();
  audio.play('summit'); const sources=[...audio.ctx.sources];
  assert(sources.some(source=>source.startAt>audio.ctx.currentTime));
  audio.setMuted(true);
  assert.equal(audio.activeVoiceCount,0); assert(sources.every(source=>source.disconnected && source.stopAt===0));
  audio.play('hoof'); audio.setMuted(false); await audio.unlock();
  assert.equal(audio.ctx.sources.length,sources.length); assert.equal(audio.activeVoiceCount,0);
  audio.ctx.advance(5); assert.equal(audio.activeVoiceCount,0);
});

test('failure, bell and summit cues also release every source and effect node', async () => {
  const audio = new AlpineAudio(); await audio.unlock();
  for(const event of ['crack','pebbles','bleat','bell','summit']) {
    audio.play(event); assert(audio.activeVoiceCount>0);
    audio.ctx.advance(1.5); assert.equal(audio.activeVoiceCount,0,event);
  }
  assert(audio.ctx.sources.every(source=>!source.loop && source.disconnected));
  assert(audio.ctx.nodes.slice(1).every(node=>node.disconnected));
});
