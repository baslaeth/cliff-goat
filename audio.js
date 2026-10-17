export class AlpineAudio {
  constructor() {
    try { this.muted = localStorage.getItem('cliff-goat-muted') === 'true'; } catch { this.muted = false; }
    this.ctx = null;
  }
  async unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .36;
      this.master.connect(this.ctx.destination);
      this.wind();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
  }
  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('cliff-goat-muted', String(muted)); } catch { /* Optional preference storage. */ }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : .36, this.ctx.currentTime, .06);
  }
  noiseBuffer(seconds) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  wind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4); src.loop = true;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400;
    const gain = this.ctx.createGain(); gain.gain.value = .055;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = .13;
    const depth = this.ctx.createGain(); depth.gain.value = .015;
    lfo.connect(depth); depth.connect(gain.gain); src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(); lfo.start();
  }
  tone(frequency, duration, { type = 'sine', volume = .3, delay = 0, end = frequency } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .008);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(now); oscillator.stop(now + duration + .02);
  }
  noise(duration, frequency = 1200, volume = .2, delay = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource(); source.buffer = this.noiseBuffer(duration);
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency;
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now); source.stop(now + duration);
  }
  play(event) {
    this.onEvent?.(event, this.muted);
    if (!this.ctx || this.muted) return;
    if (event === 'takeoff') { this.noise(.22, 900, .19); this.tone(130, .15, { end: 240, volume: .15 }); }
    if (event === 'hoof') { this.tone(180, .065, { type: 'triangle', end: 65, volume: .5 }); this.noise(.04, 2100, .2); this.tone(220, .06, { delay: .065, end: 80, volume: .3 }); }
    if (event === 'scramble') { this.noise(.12, 1900, .13); this.tone(170, .045, { delay: .07, end: 80, volume: .2 }); }
    if (event === 'crack') { this.noise(.30, 450, .40); this.noise(.08, 2300, .20); this.tone(85, .20, { type: 'triangle', end: 30, volume: .2 }); }
    if (event === 'pebbles') { for (let i = 0; i < 3; i++) this.tone(700 + i * 270, .035, { delay: i * .075, volume: .065, type: 'triangle' }); }
    if (event === 'bleat') {
      for (let i = 0; i < 5; i++) this.tone(270 - i * 13, .09, { type: 'sawtooth', volume: .065, end: 210 - i * 9, delay: i * .047 });
      this.tone(510, .3, { volume: .075, end: 370 });
    }
    if (event === 'bell') { [784, 1568, 2093].forEach((f, i) => this.tone(f, 1.45 - i * .25, { volume: .22 / (i + 1) })); }
    if (event === 'summit') { [523, 659, 784].forEach((f, i) => this.tone(f, .5, { delay: i * .1, volume: .09 })); }
  }
}
