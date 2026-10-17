# Cliff Goat

A browser-based alpine Jump-or-Collect game, using native ES modules, Canvas 2D, CSS and synthesized Web Audio. The original alpine landscape and palette are preserved. There are no runtime dependencies or build steps.

## Run

Requires Node.js 20 or newer. Run `npm start`, then open http://localhost:4285. Set `PORT` to use another port. Run `npm test` and `npm run check` for verification.

Choose Easy (10×), Medium (100×) or Hard (1,000×), then a $1.00–$100.00 stake in cent increments. Start the round, then press Jump once per attempt or Collect. Twelve successful jumps automatically collect. The selected mode persists between rounds and mode/stake are locked during a round. Collecting before any attempt refunds the stake with $0.00 profit.

The displayed dollars are a local, non-withdrawable game balance. There are no accounts, deposits, withdrawals or payments. A page session starts at $1,000.00; reload resets the session. A free refill is offered below $1.00. Mute preference is stored locally. Sound starts after a user gesture. Controls support keyboard activation and live announcements. Animation pauses in hidden tabs and respects reduced motion.

## Published multiplier curve

For step i = 1…12, `M_i = round(cap ** ((i / 12) ** 1.2), 2)`. The last step is explicitly its cap. Multipliers are stored as integer hundredths. All 36 values are strictly increasing within each mode.

At a $10.00 stake, these are the conditional probabilities of the **next** successful jump from the preceding step. Percentages below are display-rounded; sampling uses exact integer fractions.

| Step | Easy multiplier | Easy chance | Medium multiplier | Medium chance | Hard multiplier | Hard chance |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1.12× | 86.61% | 1.26× | 76.98% | 1.42× | 68.31% |
| 2 | 1.31× | 85.50% | 1.71× | 73.68% | 2.24× | 63.39% |
| 3 | 1.55× | 84.52% | 2.39× | 71.55% | 3.70× | 60.54% |
| 4 | 1.85× | 83.78% | 3.43× | 69.68% | 6.35× | 58.27% |
| 5 | 2.24× | 82.59% | 5.01× | 68.46% | 11.20× | 56.70% |
| 6 | 2.72× | 82.35% | 7.42× | 67.52% | 20.22× | 55.39% |
| 7 | 3.34× | 81.44% | 11.15× | 66.55% | 37.25× | 54.28% |
| 8 | 4.12× | 81.07% | 16.96× | 65.74% | 69.86× | 53.32% |
| 9 | 5.11× | 80.63% | 26.07× | 65.06% | 133.11× | 52.48% |
| 10 | 6.36× | 80.35% | 40.46× | 64.43% | 257.32× | 51.73% |
| 11 | 7.96× | 79.90% | 63.34× | 63.88% | 504.15× | 51.04% |
| 12 | 10.00× | 79.60% | 100.00× | 63.34% | 1,000.00× | 50.42% |

## Settlement and exact 97% RTP

All money is integer cents. Input is parsed as decimal text, avoiding floating-point dollar conversion. Let S be the original stake in cents, H_i the published multiplier in hundredths, and A_i the precomputed gross payout in cents.

Settlement starts with nearest-cent rounding, half cents upward: `B_i = floor(S * H_i / 100 + 0.5)`, implemented with integer quotient/remainder. To retain strictly decreasing conditional chances across the entire supported cent-valued stake range, subsequent payouts use the smallest upward cent correction necessary:

`A_1 = B_1`

`A_i = max(B_i, floor(A_previous * d_previous / n_previous) + 1)`

Here `n_previous / d_previous` is the preceding conditional probability. This correction changes only Easy step 6 for stakes $1.11, $1.19, $1.24, $1.32, $1.44, $1.45 and $1.57, adding exactly one cent. Plain nearest-cent rounding would slightly increase that step's chance for those seven stakes. All other payouts use ordinary half-up rounding, every cap remains exact, and all $10.00 table payouts equal stake × published multiplier. The displayed dollar payout is authoritative and is settled exactly once. The in-game rules disclose this rule.

Probabilities are:

`p_1 = (97 * S) / (100 * A_1)`

`p_i = A_previous / A_i`, for i > 1.

Their product telescopes: `P(reach i) = p_1 * … * p_i = 97 * S / (100 * A_i)`. Thus `P(reach i) * A_i / S = 0.97` at every played collection step. The house edge occurs only on the first attempt; later jumps have conditional expected gross payout equal to the currently collectible amount. No further stake is charged. A failure pays zero. Net profit is `gross payout - original stake`, and returned stake is never called profit.

Before cent rounding the same derivation uses `p_1 = 0.97 / M_1` and `p_i = M_previous / M_i`. Summit reach probabilities are exactly 9.7%, 0.97% and 0.097% because the final payouts equal S × cap. Conditional chance answers “given that I am here, will the next jump succeed?” Cumulative chance answers “starting before any attempt, will I reach this step?” Both are shown in the rules. Modes change volatility, not theoretical RTP. RTP is a long-run theoretical average, never a guarantee for an individual session. Cancellation before the first attempt is a full refund and is outside the played-round calculation.

## Sampling and transition guarantees

For each attempt the engine locks its state, samples one Bernoulli result, and stores it before animation. `crypto.getRandomValues` supplies uniform unsigned 32-bit words. For exact probability n/d, reject words at or above `2^32 - (2^32 % d)`, then succeed if `word % d < n`. Removing the incomplete bucket avoids modulo bias. Rejection may require more than one random word, but there is only one resolved outcome per attempted jump. Display-rounded percentages never enter sampling.

After a failure is resolved, a separate cryptographic byte's low bit chooses crumble or shear with equal probability. Success draws no cosmetic failure bit. Cosmetic randomness cannot change game state, odds or settlement. Timing, camera, goat expressions and animation do not affect outcomes. Both failures have the same two-second timeline. The goat has identical preparation/flight expressions for success and failure until contact reveals the result.

Attempt and round identifiers guard callbacks; private settlement prevents repeated payouts. Disabled controls and synchronous engine locks prevent repeated activation, debit and sampling. Ordinary jumps take 2.00 seconds; collection takes approximately 1.67 seconds, with the bell during entry and a restrained summit accent. Reduced motion preserves timing and outcomes while reducing arcs, tilt, scramble and particles.

## Verification

`npm test` includes 14 test groups. The primary RTP evidence is exhaustive analytical arithmetic, not simulation: all 9,901 stakes from 100 through 10,000 cents × three modes × twelve stages = **356,436 stage/stake cases**. Independent BigInt rational products verify exact 97/100 gross return. The suite also checks all multipliers/checkpoints/caps, increasing payouts, strictly decreasing valid chances, all rounding corrections, decimal input boundaries, sampler rejection and boundary words, every failure position and collection position, cancellation, summit settlement, retained/locked mode, duplicate and reentrant actions, stale callbacks, refill and random-source failure. Scene tests cover both failure variants, pre-contact expression equality, sound event timing, two-second jumps, shared collection/summit timing, hidden-tab pause and 12-step geometry.

For browser verification, open http://localhost:4285/?test=1. The explicit testing panel is restricted to localhost and is absent from normal play. It can inject boundary words through the production sampler, independently select a failure variant, request reduced motion, and run all twelve steps through the ordinary buttons and animations. It does not replace outcome, transition or settlement logic. Its report checks one attempt per step, no intermediate debit/payout, and exact summit settlement. Audio events are shown for synchronization checks. Optional animation frame capture records actual rendered canvas pixels for visual inspection without changing the animation timeline. A clearance regression test keeps the horns inside short desktop and mobile views. Test results and screenshots are ignored by Git.

`engine.js` owns money, stages and state; `cosmetics.js` owns independent failure selection; `scene.js` draws the preserved alpine world and redesigned goat; `audio.js` synthesizes sounds; `app.js` connects accessible controls; `qa.js` is dynamically imported only in explicit localhost testing mode. The optional Google Fonts stylesheet has system fallbacks. This is a client-side prototype, not a server-authoritative money game.
