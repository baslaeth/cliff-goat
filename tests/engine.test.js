import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, MODES, STEP_COUNT, buildRoundTable, parseStake, roundHalfUp, sampleFraction, dollars, profitDollars } from '../engine.js';
import { failureVariant } from '../cosmetics.js';

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const win = () => true;
const jump = g => { const a = g.beginJump(); assert(a); assert.equal(g.finishJump(a.id), true); return a; };

test('all 36 published multipliers, formula, checkpoints, and exact caps', () => {
  const expected = {
    easy: [1.12,1.31,1.55,1.85,2.24,2.72,3.34,4.12,5.11,6.36,7.96,10],
    medium: [1.26,1.71,2.39,3.43,5.01,7.42,11.15,16.96,26.07,40.46,63.34,100],
    hard: [1.42,2.24,3.70,6.35,11.20,20.22,37.25,69.86,133.11,257.32,504.15,1000],
  };
  assert.equal(STEP_COUNT, 12);
  for (const mode of Object.values(MODES)) {
    assert.deepEqual(mode.stages.map(s => s.multiplier), expected[mode.id]);
    for (let i = 0; i < 12; i++) {
      assert.equal(mode.stages[i].multiplierHundredths, Math.round(mode.cap ** (((i+1)/12)**1.2) * 100));
      assert(mode.stages[i].multiplier > (mode.stages[i-1]?.multiplier ?? 1));
    }
    assert.equal(mode.stages[11].multiplier, mode.cap);
  }
});

test('exhaustive exact analytical RTP, decreasing odds, rounding and caps for every supported cent stake', () => {
  const corrections = [];
  let checked = 0;
  for (const mode of Object.values(MODES)) for (let stake = 100; stake <= 10000; stake++) {
    const table = buildRoundTable(mode.id, stake);
    let cumulativeN = 1n, cumulativeD = 1n, priorN = 1n, priorD = 1n, payout = stake;
    for (const s of table) {
      const n = BigInt(s.numerator), d = BigInt(s.denominator), a = BigInt(s.payoutCents);
      assert(n > 0n && n < d);
      assert(n * priorD < priorN * d, `${mode.id} ${stake} step ${s.step}: decreasing odds`);
      assert(s.payoutCents > payout);
      assert(Number.isSafeInteger(s.payoutCents));
      cumulativeN *= n; cumulativeD *= d;
      const common = gcd(cumulativeN, cumulativeD); cumulativeN /= common; cumulativeD /= common;
      assert.equal(cumulativeN * a * 100n, 97n * BigInt(stake) * cumulativeD, `${mode.id} ${stake} step ${s.step}: exact 97% RTP`);
      const raw = (BigInt(stake) * BigInt(s.multiplierHundredths) + 50n) / 100n;
      assert.equal(BigInt(s.payoutCents - s.roundingAdjustmentCents), raw);
      if (s.roundingAdjustmentCents) corrections.push([mode.id, stake, s.step, s.roundingAdjustmentCents]);
      priorN = n; priorD = d; payout = s.payoutCents; checked++;
    }
    assert.equal(payout, stake * mode.cap);
    assert.equal(cumulativeN * BigInt(mode.cap) * 100n, cumulativeD * 97n);
  }
  assert.equal(checked, 356436);
  assert.deepEqual(corrections, [111,119,124,132,144,145,157].map(stake => ['easy', stake, 6, 1]));
});

test('strict decimal parsing, integer money and half-up boundaries', () => {
  for (const [text, cents] of [['1',100],['1.01',101],['1.05',105],['10.10',1010],['99.99',9999],['100.00',10000]]) assert.equal(parseStake(text), cents);
  for (const value of ['', '0.99', '100.01', '-1', 'NaN', 'Infinity', '1e1', '1.001', '10.000', '$10.00']) assert.equal(parseStake(value), null);
  for (let cents = 100; cents <= 10000; cents++) assert.equal(parseStake((cents / 100).toFixed(2)), cents);
  assert.equal(roundHalfUp(1049),10); assert.equal(roundHalfUp(1050),11); assert.equal(roundHalfUp(1051),11);
  assert.equal(dollars(100000),'$1,000.00'); assert.equal(profitDollars(200),'+$2.00'); assert.equal(profitDollars(0),'$0.00'); assert.equal(profitDollars(-1000),'−$10.00');
  const g = new Game();
  for (const value of [0,99,10001,100.5,NaN,Infinity]) assert.equal(g.start(value),false);
  assert.equal(g.balanceCents,100000);
  assert.equal(new Game({balanceCents:100}).start(101),false);
});

test('unbiased integer rejection sampler: boundary, rejection, and invalid source handling', () => {
  for (const mode of Object.keys(MODES)) for (const s of buildRoundTable(mode,1000)) {
    assert.equal(sampleFraction(s.numerator,s.denominator,()=>s.numerator-1),true);
    assert.equal(sampleFraction(s.numerator,s.denominator,()=>s.numerator),false);
    assert.equal(sampleFraction(s.numerator,s.denominator,()=>s.denominator-1),false);
    const limit = 2**32 - 2**32 % s.denominator;
    assert.equal(limit % s.denominator,0);
    if (limit < 2**32) {
      const words = [limit,2**32-1,s.numerator-1]; let reads=0;
      assert.equal(sampleFraction(s.numerator,s.denominator,()=>{reads++;return words.shift();}),true);
      assert.equal(reads,3); // Three source words, one Bernoulli outcome.
    }
  }
  for (const value of [-1,2**32,.5,NaN]) assert.throws(()=>sampleFraction(1,2,()=>value),RangeError);
  assert.throws(()=>sampleFraction(3,2),RangeError);
  assert.throws(()=>sampleFraction(1,2**32+1),RangeError);
  assert.equal(sampleFraction(0,7,()=>0),false); assert.equal(sampleFraction(7,7,()=>6),true);
});

test('all modes settle every possible collection step exactly once and keep the selected mode', () => {
  for (const mode of Object.keys(MODES)) for (let stop = 0; stop <= 12; stop++) {
    let samples=0; const g = new Game({mode,sample:()=>{samples++;return true;}});
    assert.equal(g.start(111),true);
    for (let i=0;i<stop;i++) jump(g);
    const expected = stop ? buildRoundTable(mode,111)[stop-1].payoutCents : 111;
    assert.equal(g.balanceCents,100000-111);
    assert.equal(samples,stop);
    if (stop<12) assert.equal(g.collect(),true);
    else { assert.equal(g.status,'collecting'); assert.equal(g.collect(),false); assert.equal(g.beginJump(),null); }
    assert.equal(g.finishCollect(g.round),true); assert.equal(g.finishCollect(g.round),false);
    assert.equal(g.result.payoutCents,expected); assert.equal(g.result.profitCents,expected-111);
    assert.equal(g.result.kind,stop===0?'cancelled':stop===12?'summit':'collected');
    assert.equal(g.balanceCents,100000-111+expected); assert.equal(g.history.length,1);
    assert.equal(g.start(1000),true); assert.equal(g.mode,mode); assert.equal(g.stage,0); assert.equal(g.result,null);
  }
});

test('failures at every step pay zero and lose only the original stake', () => {
  for (const mode of Object.keys(MODES)) for (let failAt=1;failAt<=12;failAt++) {
    let samples=0; const g=new Game({mode,sample:()=>++samples<failAt}); g.start(9999);
    for(let i=0;i<failAt;i++) jump(g);
    assert.equal(g.status,'ended'); assert.equal(g.result.kind,'lost'); assert.equal(g.result.payoutCents,0);
    assert.equal(g.result.profitCents,-9999); assert.equal(g.balanceCents,90001); assert.equal(g.collect(),false);
    assert.equal(g.finishCollect(g.round),false); assert.equal(samples,failAt);
  }
});

test('rapid activation, reentrant sampler, immutable stake/mode, and stale settlement are guarded', () => {
  let calls=0; let g;
  g=new Game({sample:()=>{calls++;assert.equal(g.beginJump(),null);assert.equal(g.collect(),false);return true;}});
  g.selectMode('hard'); g.start(1000); const oldRound=g.round;
  assert.equal(g.selectMode('easy'),false); assert.throws(()=>{g.stakeCents=500;},TypeError); assert.throws(()=>{g.mode='easy';},TypeError);
  const attempt=g.beginJump();
  for(let i=0;i<100;i++){assert.equal(g.beginJump(),null);assert.equal(g.collect(),false);assert.equal(g.start(100),false);assert.equal(g.selectMode('medium'),false);}
  assert.equal(calls,1); assert.equal(g.balanceCents,99000);
  assert.equal(g.finishJump(attempt.id+1),false); assert.equal(g.finishJump(attempt.id),true); assert.equal(g.finishJump(attempt.id),false);
  g.collect(); assert.equal(g.selectMode('easy'),false); assert.equal(g.collect(),false); assert.equal(g.beginJump(),null);
  g.finishCollect(oldRound); assert.equal(g.history.length,1);
  const settledBalance=g.balanceCents;
  assert.equal(g.selectMode('medium'),true);
  assert.equal(g.status,'idle'); assert.equal(g.stage,0); assert.equal(g.result,null);
  assert.equal(g.balanceCents,settledBalance); assert.equal(g.history.length,1);
  g.start(1000); g.collect();
  assert.equal(g.finishCollect(oldRound),false); assert.equal(g.finishJump(attempt.id),false); assert.equal(g.finishCollect(g.round),true);
});

test('cosmetic variants are equally mapped, only selected after failure, and cannot affect the game', () => {
  let calls=0;
  assert.equal(failureVariant(true,()=>{calls++;return 0;}),null); assert.equal(calls,0);
  assert.equal(failureVariant(false,()=>0),'crumble'); assert.equal(failureVariant(false,()=>1),'shear');
  assert.throws(()=>failureVariant(false,()=>2),RangeError);
  const outcomes=[];
  for(const bit of [0,1]) {
    const g=new Game({mode:'hard',sample:()=>false}); g.start(1000); const attempt=g.beginJump();
    const variant=failureVariant(attempt.success,()=>bit); assert(variant); g.finishJump(attempt.id);
    outcomes.push({balance:g.balanceCents,result:g.result,attempt});
  }
  assert.deepEqual(outcomes[0],outcomes[1]);
});

test('empty balance refill is inactive-only; sampler errors leave balance and round recoverable', () => {
  const g=new Game({balanceCents:100,sample:()=>false}); g.start(100); assert.equal(g.refill(),false); jump(g);
  assert.equal(g.refill(),true); assert.equal(g.balanceCents,100000); assert.equal(g.refill(),false);
  const broken=new Game({sample:()=>{throw new Error('source unavailable');}}); broken.start(1000);
  assert.throws(()=>broken.beginJump(),/unavailable/); assert.equal(broken.status,'ready'); assert.equal(broken.balanceCents,99000);
  assert.equal(broken.collect(),true); broken.finishCollect(broken.round); assert.equal(broken.balanceCents,100000);
});
