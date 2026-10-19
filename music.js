// Original alpine motif: soft plucked notes, open fifths and a restrained pulse.
// Uses only public round state, never sampled outcomes or cosmetic randomness.
export class AlpineMusic {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    try { this.enabled = localStorage.getItem('cliff-goat-music') !== 'false'; } catch {}
    this.status = 'idle'; this.stage = 0; this.beat = 0;
    this.voices = new Set(); this.timer = null;
  }
  setEnabled(value) {
    this.enabled = value;
    try { localStorage.setItem('cliff-goat-music', String(value)); } catch {}
    this.sync();
  }
  update(status, stage) {
    this.status = status; this.stage = stage; this.sync();
  }
  sync() {
    const ctx = this.audio.ctx;
    const allowed = this.enabled && !this.audio.muted && !document.hidden && ctx?.state === 'running'
      && !['ended', 'collecting'].includes(this.status);
    if (!allowed) { this.stop(); return; }
    if (this.timer !== null) return;
    this.nextNote = ctx.currentTime + .06; this.beat = 0;
    this.tick();
    this.timer = setInterval(() => this.tick(), 100);
  }
  stop() {
    clearInterval(this.timer); this.timer = null;
    for (const voice of this.voices) {
      voice.osc.stop(); voice.osc.disconnect(); voice.gain.disconnect();
    }
    this.voices.clear();
  }
  note(midi, at, duration, volume, type = 'sine') {
    const ctx = this.audio.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(this.audio.master);
    const voice = { osc, gain }; this.voices.add(voice);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    osc.start(at); osc.stop(at + duration + .02);
  }
  tick() {
    const ctx = this.audio.ctx;
    if (document.hidden || this.audio.muted || !this.enabled || ctx.state !== 'running') { this.stop(); return; }
    // No catch-up burst after a stalled tab. Schedule only a short look-ahead.
    this.nextNote = Math.max(this.nextNote, ctx.currentTime);
    const tension = Math.min(1, this.stage / 12);
    const idle = this.status === 'idle';
    const beatLength = 60 / (idle ? 66 : 72 + tension * 12);
    while (this.nextNote < ctx.currentTime + .16) {
      const step = this.beat % 16, at = this.nextNote;
      const motif = [74, null, 81, 78, null, 76, 74, null, 69, null, 76, 78, 81, null, 76, null];
      const duck = this.status === 'jumping' ? .55 : 1;
      if (motif[step] !== null) this.note(motif[step], at, .65, .055 * duck, 'triangle');
      if (step % 4 === 0) {
        const root = step < 8 ? 50 : 47;
        this.note(root, at, 1.8, .045 * duck);
        this.note(root + 7, at, 1.6, .022 * duck);
      }
      if (!idle && tension > .2 && step % 2 === 1) this.note(62, at, .14, .025 * tension * duck);
      this.beat++; this.nextNote += beatLength;
    }
  }
}
