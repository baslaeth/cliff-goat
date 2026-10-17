export const STEP_COUNT = 12;
export const INITIAL_BALANCE_CENTS = 100_000;
export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 10_000;

export const MODES = Object.freeze(Object.fromEntries(
  [['easy', 'Easy', 10], ['medium', 'Medium', 100], ['hard', 'Hard', 1000]].map(([id, name, cap]) => [id, Object.freeze({
    id, name, cap,
    stages: Object.freeze(Array.from({ length: STEP_COUNT }, (_, index) => {
      const multiplierHundredths = index === STEP_COUNT - 1 ? cap * 100 : Math.round(cap ** (((index + 1) / STEP_COUNT) ** 1.2) * 100);
      return Object.freeze({ step: index + 1, multiplierHundredths, multiplier: multiplierHundredths / 100 });
    })),
  })]),
));

export function parseStake(value) {
  // Parse the decimal string; no floating-point dollar arithmetic.
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return cents >= MIN_STAKE_CENTS && cents <= MAX_STAKE_CENTS ? cents : null;
}

export const dollars = cents => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const profitDollars = cents => `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${dollars(Math.abs(cents))}`;
export const percent = probability => `${(probability * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function roundHalfUp(numerator, denominator = 100) {
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) throw new RangeError('Invalid rounding operands');
  return Math.floor(numerator / denominator) + (numerator % denominator * 2 >= denominator ? 1 : 0);
}

export function buildRoundTable(mode, stakeCents) {
  if (!MODES[mode] || !Number.isInteger(stakeCents) || stakeCents < MIN_STAKE_CENTS || stakeCents > MAX_STAKE_CENTS) throw new RangeError('Invalid mode or stake');
  let previousPayout = stakeCents;
  let previousNumerator = 1, previousDenominator = 1;
  return Object.freeze(MODES[mode].stages.map((stage, index) => {
    const rounded = roundHalfUp(stakeCents * stage.multiplierHundredths);
    const numerator = index === 0 ? 97 * stakeCents : previousPayout;
    // Half-up, then the minimum upward cent correction needed for strictly
    // declining odds. Seven Easy stakes need one extra cent at step 6 only.
    const minimum = index === 0 ? rounded : Math.floor(numerator * previousDenominator / previousNumerator) + 1;
    const payoutCents = Math.max(rounded, minimum);
    const denominator = index === 0 ? 100 * payoutCents : payoutCents;
    previousPayout = payoutCents;
    previousNumerator = numerator; previousDenominator = denominator;
    return Object.freeze({ ...stage, payoutCents, roundingAdjustmentCents: payoutCents - rounded, numerator, denominator,
      probability: numerator / denominator, cumulativeProbability: 97 * stakeCents / (100 * payoutCents) });
  }));
}

export function cryptoWord() {
  const word = new Uint32Array(1);
  crypto.getRandomValues(word);
  return word[0];
}

export function sampleFraction(numerator, denominator, nextWord = cryptoWord) {
  const range = 2 ** 32;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || numerator > denominator || denominator < 1 || denominator > range) throw new RangeError('Invalid probability fraction');
  // Reject the incomplete bucket before taking a remainder. Each accepted
  // integer in [0, denominator) has exactly the same number of preimages.
  const limit = range - range % denominator;
  let word;
  do {
    word = nextWord();
    if (!Number.isInteger(word) || word < 0 || word >= range) throw new RangeError('Expected an unsigned 32-bit word');
  } while (word >= limit);
  return word % denominator < numerator;
}

export class Game {
  #mode;
  #stakeCents = 1000;
  #balanceCents;
  #table = null;
  #sample;
  constructor({ balanceCents = INITIAL_BALANCE_CENTS, sample = sampleFraction, mode = 'easy' } = {}) {
    if (!MODES[mode] || !Number.isSafeInteger(balanceCents) || balanceCents < 0) throw new RangeError('Invalid initial state');
    this.#mode = mode; this.#balanceCents = balanceCents; this.#sample = sample;
    this.status = 'idle'; this.stage = 0; this.round = 0; this.attempt = 0;
    this.pending = null; this.result = null; this.history = [];
  }
  get mode() { return this.#mode; }
  get stakeCents() { return this.#stakeCents; }
  get balanceCents() { return this.#balanceCents; }
  get table() { return this.#table; }
  get inactive() { return this.status === 'idle' || this.status === 'ended'; }
  get multiplier() { return this.stage ? this.#table[this.stage - 1].multiplier : 1; }
  get payoutCents() { return this.stage ? this.#table[this.stage - 1].payoutCents : this.#stakeCents; }
  get next() { return this.#table?.[this.stage] || null; }
  selectMode(mode) {
    if (!this.inactive || !MODES[mode]) return false;
    if (mode !== this.#mode && this.status === 'ended') {
      // A new route previews from base; the completed result remains in history.
      this.status = 'idle'; this.stage = 0; this.#table = null; this.result = null;
    }
    this.#mode = mode;
    return true;
  }
  start(stakeCents) {
    if (!this.inactive || !Number.isInteger(stakeCents) || stakeCents < MIN_STAKE_CENTS || stakeCents > MAX_STAKE_CENTS || stakeCents > this.#balanceCents) return false;
    this.#table = buildRoundTable(this.#mode, stakeCents);
    this.#stakeCents = stakeCents; this.#balanceCents -= stakeCents;
    this.stage = 0; this.round++; this.status = 'ready'; this.pending = null; this.result = null;
    return true;
  }
  beginJump() {
    if (this.status !== 'ready' || !this.next) return null;
    this.status = 'jumping'; // Guard even against a reentrant injected sampler.
    let success;
    try {
      success = this.#sample(this.next.numerator, this.next.denominator);
      if (typeof success !== 'boolean') throw new TypeError('Sampler must return a boolean');
    } catch (error) { this.status = 'ready'; throw error; }
    this.pending = Object.freeze({ id: ++this.attempt, round: this.round, from: this.stage, success });
    return this.pending;
  }
  finishJump(id) {
    if (this.status !== 'jumping' || this.pending?.id !== id) return false;
    const success = this.pending.success; this.pending = null;
    if (!success) this.#settle('lost', 0);
    else { this.stage++; this.status = this.stage === STEP_COUNT ? 'collecting' : 'ready'; }
    return true;
  }
  collect() {
    if (this.status !== 'ready') return false;
    this.status = 'collecting'; return true;
  }
  finishCollect(round) {
    if (this.status !== 'collecting' || this.round !== round) return false;
    this.#settle(this.stage === 0 ? 'cancelled' : this.stage === STEP_COUNT ? 'summit' : 'collected', this.payoutCents);
    return true;
  }
  #settle(kind, payoutCents) {
    this.#balanceCents += payoutCents; this.status = 'ended';
    this.result = Object.freeze({ kind, payoutCents, profitCents: payoutCents - this.#stakeCents, stakeCents: this.#stakeCents,
      multiplier: this.multiplier, stage: this.stage, round: this.round, mode: this.#mode });
    this.history.unshift(this.result); this.history.length = Math.min(this.history.length, 8);
  }
  refill() {
    if (!this.inactive || this.#balanceCents >= MIN_STAKE_CENTS) return false;
    this.#balanceCents = INITIAL_BALANCE_CENTS; return true;
  }
}
