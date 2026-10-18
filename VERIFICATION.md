# Verification — 17 October 2026

## Automated checks

`npm test`: 14 passing test groups, zero failures. `npm run check`: all seven JavaScript modules pass Node syntax checks.

The analytical suite enumerates every supported cent stake from $1.00 through $100.00 in all three modes, covering 356,436 stage/stake combinations. Exact BigInt rational products prove 97/100 expected gross return at every eligible collection step, including settlement rounding. It also proves increasing multipliers/payouts, decreasing conditional probabilities, correct caps, and the seven documented one-cent corrections. No simulation is used as RTP evidence.

State-machine tests cover every possible collection and failure position, refund, automatic summit settlement, no duplicate debit/sample/payout, reentrant/stale callbacks, locked mode/stake, route reset, refill, and random-source failure recovery. Sampler tests exercise success/failure boundaries and rejection of the incomplete modulo bucket. Cosmetic selection is tested separately from outcome generation. Scene tests cover both variants and reduced motion, equal pre-contact expressions, event timing, hidden-tab clock adjustment, 12-step geometry and horn clearance.

## Browser checks

Verified the running native-module game in the Codex in-app Chromium browser at the default desktop viewport and at 390×844 and 320×844.

- Easy and Medium: all twelve jumps completed through normal controls/animations; $10.00 stakes automatically collected $100.00 and $1,000.00, with $90.00 and $990.00 profit.
- Hard: all twelve steps at a $100.00 stake, reduced motion, automatic $100,000.00 payout and $99,900.00 profit. Rechecked after the narrow-screen layout correction.
- Observed ordinary jump completion around 2.03–2.05 seconds including the testing panel's polling interval; the animation timeline itself is 2.00 seconds.
- Manual collection on a $1.11 stake at Easy step 1 returned $1.24 and showed +$0.13 profit. Cancellation refunded $1.11 with $0.00 profit and no additional attempt.
- Rapid double-clicking Start, Jump and Collect produced one debit, one jump attempt and one settlement. Mode and stake were disabled throughout transitions and active rounds. Enter activated the normal buttons.
- Crumble and shear failures were inspected using captured pixels from the actual browser animation: preparation, flight, hoof contact, reaction/scramble, break and fall. Both showed a $10.00 loss and $0.00 payout. Reduced-motion versions were inspected at 320 pixels; an intermediate shear failure followed a successful first jump.
- Confirmed original mountain shapes, alpine palette, valley, sun, distant peaks and cloud progression. The scarf is absent; the horn/beard silhouette, articulation, cream shading and brief expressions remain readable on mobile.
- Fixed a short-desktop flight clearance issue found in the captured frames, and added a regression test. Fixed mobile stake truncation; $100.00 input, the twelve-step bar, mode buttons and $100,000.00 result fit the narrow screen.
- Checked the responsive rules dialog, conditional/cumulative odds, currency labels, profit/history, keyboard dismissal, saved mute preference, replay and reload reset. No browser console warnings or errors were reported during these checks.
- Sound event traces show takeoff → hoof → cracks/stones/bleat or recovery, and collection footsteps → bell, with the summit accent only on the final stage. Muted traces and restored preference were verified. Perceptual volume/timbre was not independently auditioned on external speakers.

The explicit localhost `?test=1` facility supplies boundary words to the production sampler and separately chooses cosmetic variants. It uses the same engine, UI, animations and settlement functions. Frame capture only reads rendered canvas pixels. Normal play has no testing controls and uses cryptographic randomness.

## Scope

The balance remains local to the page session and cannot be withdrawn. This is a client-side prototype, with no server authority, accounts or payment processing. Browser checks cover Chromium desktop and emulated narrow viewports; physical iOS/Android devices and other browser engines were not available for this verification.

# Annotation and audio verification — 18 October 2026

Applied the sixteen requested interface annotations: compact loss result, numeric altitude, header balance beside sound, removed marketing copy/footer/redundant hints and action icons, mode names without caps, History label, and a persistent four-value stake preset editor. Visible odds and round-message rows were removed as requested; screen-reader announcements and the information dialog retain the probability information. The Canvas scene, engine, cosmetic selection, animation timing, probabilities and settlement are unchanged.

The constant hiss came from the four-second looping white-noise buffer in AlpineAudio.wind(), started by unlock(). Removed that source and its modulation oscillator entirely. Takeoff now uses a 110 ms low-volume filtered whoosh; hoof contact uses short tonal impacts. All one-shot sources disconnect their effect nodes when finished. Mute immediately stops active and scheduled voices, preventing lingering or replayed sound after unmute.

- npm test: 18 groups passed, including all existing engine/scene tests and four new audio lifecycle tests. npm run check and git diff --check passed.
- Real Chromium Web Audio analyser: three consecutive successful jumps generated peak output 0.08277–0.08304. Initial unmuted idle, the second after each jump, muted jump/idle, unmuted idle and post-bell idle each measured peak 0 with zero active voices. Muted during the fourth jump, then unmuted without replay. Collection completed at step 4. These are signal measurements, not an external-speaker listening assessment.
- Preset editor rejected $0.99, saved $2.50/$12.34/$40.00/$100.00, retained them after reload, and selected exactly $12.34. Cancel discarded edits; the editor was disabled during an active round. Restored the default four presets after testing.
- Verified loss result contains only Loss and $10.00. Inspected the desktop interface and 320×844 mobile layout, including balance/sound placement, numeric altitude, name-only modes, text-only actions and the preset dialog. Information dialog still exposes the full odds table; normal play contains no testing controls. Browser console showed no warnings or errors.
- Browser verification is Chromium with an emulated mobile viewport; physical device/speaker checks were not performed. The existing synthesized bell and failure cues remain finite and retain their event timing.

## Complete ledge collapse — 18 October 2026

The shear variant previously retained a narrow anchored strip indefinitely. The unsupported strip now drops just after the main slab, and completed failures omit the entire failed ledge. The crack line stops before the pieces separate, avoiding a floating seam. Replay restores the intact ledge. Gameplay, odds, payouts, two-second timing, sound and background are unchanged.

All 20 tests and syntax checks pass. New regression checks cover both failure variants in normal/reduced motion, no failed-ledge geometry after settlement, neighbouring ledges remaining intact, delayed edge descent and replay restoration. Browser animation captures verified the shear sequence on desktop and reduced-motion shear and crumble on a 320-pixel viewport.
