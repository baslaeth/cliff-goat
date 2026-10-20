import { Game, MODES, STEP_COUNT, buildRoundTable, parseStake, dollars, profitDollars, percent, roundHalfUp } from './engine.js';
import { failureVariant } from './cosmetics.js';
import { MountainScene } from './scene.js';
import { AlpineAudio } from './audio.js';
import { AlpineMusic } from './music.js';

const $ = id => document.getElementById(id);
const isQA = new URLSearchParams(location.search).get('test') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const qa = isQA ? await (await import('./qa.js')).installQA() : null;
const game = new Game(qa ? { sample: qa.sample } : {});
const audio = new AlpineAudio();
const music = new AlpineMusic(audio);
const unlockAudio = async () => { await audio.unlock(); music.sync(); };
const scene = new MountainScene($('scene'), audio);
if (qa) qa.connect(game, scene, audio, music);
let startGuard = false;
const presetButtons = [...document.querySelectorAll('[data-stake]')];
let stakePresets = [500, 1000, 2500, 5000];
try {
  const saved = JSON.parse(localStorage.getItem('cliff-goat-stake-presets'));
  if (Array.isArray(saved) && saved.length === 4 && saved.every(cents => Number.isInteger(cents) && cents >= 100 && cents <= 10000)) stakePresets = saved;
} catch { /* Optional local preference. */ }
function updatePresets() {
  presetButtons.forEach((button, index) => { button.dataset.stake = stakePresets[index]; button.textContent = dollars(stakePresets[index]); });
}
updatePresets();
const presetsDialog = $('presets-dialog');
const presetInputs = [1, 2, 3, 4].map(index => $(`preset-${index}`));
$('presets-edit').addEventListener('click', () => {
  if (!game.inactive || startGuard) return;
  presetInputs.forEach((input, index) => { input.value = (stakePresets[index] / 100).toFixed(2); input.removeAttribute('aria-invalid'); });
  $('presets-error').textContent = ''; presetsDialog.showModal();
});
$('presets-cancel').addEventListener('click', () => presetsDialog.close());
$('presets-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!game.inactive || startGuard) return;
  const amounts = presetInputs.map(input => parseStake(input.value));
  presetInputs.forEach((input, index) => input.setAttribute('aria-invalid', String(amounts[index] === null)));
  if (amounts.includes(null)) {
    $('presets-error').textContent = 'Enter $1.00–$100.00 for each preset, with up to two decimals.';
    presetInputs[amounts.indexOf(null)].focus(); return;
  }
  stakePresets = amounts;
  try { localStorage.setItem('cliff-goat-stake-presets', JSON.stringify(stakePresets)); } catch { /* Still usable for this session. */ }
  updatePresets(); presetsDialog.close(); render(); announce('Stake presets saved.');
});

const stageTrack = $('stage-track');
stageTrack.innerHTML = Array.from({ length: STEP_COUNT }, (_, i) => `<span class="stage-step" data-stage="${i + 1}">${i + 1}</span>`).join('');

function updateSound() {
  const label = audio.muted ? 'Unmute sound' : 'Mute sound';
  $('sound-toggle').setAttribute('aria-label', label);
  $('sound-toggle').setAttribute('aria-pressed', String(!audio.muted));
  $('sound-toggle').title = label;
  $('sound-state').textContent = audio.muted ? 'Off' : 'On';
  $('sound-toggle').querySelector('use').setAttribute('href', audio.muted ? '#i-mute' : '#i-sound');
}
updateSound();
$('sound-toggle').addEventListener('click', () => { audio.setMuted(!audio.muted); music.sync(); void unlockAudio(); updateSound(); });
function updateMusicButton() {
  $('music-state').textContent = music.enabled ? 'On' : 'Off';
  $('music-toggle').setAttribute('aria-pressed', String(music.enabled));
  $('music-toggle').setAttribute('aria-label', music.enabled ? 'Turn music off' : 'Turn music on');
  $('music-toggle').title = music.enabled ? 'Turn music off' : 'Turn music on';
}
updateMusicButton();
$('music-toggle').addEventListener('click', () => { music.setEnabled(!music.enabled); updateMusicButton(); void unlockAudio(); });
$('audio-settings').addEventListener('click', () => $('audio-dialog').showModal());
$('audio-close').addEventListener('click', () => $('audio-dialog').close());
document.addEventListener('visibilitychange', () => music.sync());
window.addEventListener('pagehide', () => music.stop());

function stakeValue() { return parseStake($('stake').value); }
function validateStake() {
  const stake = stakeValue();
  if (stake === null) return 'Enter $1.00–$100.00, with up to two decimals.';
  return stake > game.balanceCents ? `Stake exceeds your ${dollars(game.balanceCents)} balance.` : '';
}
function setStake(cents) {
  if (!game.inactive || startGuard) return;
  $('stake').value = (Math.min(10000, Math.max(100, cents)) / 100).toFixed(2);
  render();
}
$('stake').addEventListener('input', render);
$('stake').addEventListener('blur', () => { const cents = stakeValue(); if (cents !== null) $('stake').value = (cents / 100).toFixed(2); });
$('stake-half').addEventListener('click', () => setStake(roundHalfUp(stakeValue() ?? 1000, 2)));
$('stake-double').addEventListener('click', () => setStake((stakeValue() ?? 1000) * 2));
document.querySelectorAll('[data-stake]').forEach(button => button.addEventListener('click', () => setStake(Number(button.dataset.stake))));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  if (startGuard || !game.selectMode(button.dataset.mode)) return;
  if (game.status === 'idle') { scene.reset(); }
  render(); announce(`${MODES[game.mode].name} selected. Maximum ${MODES[game.mode].cap.toLocaleString('en-US')}×. Twelve steps. 97% theoretical RTP.`);
}));

function announce(message) { $('round-message').textContent = message; }

function render() {
  music.update(game.status, game.stage);
  const inactive = game.inactive;
  const busy = game.status === 'jumping' || game.status === 'collecting' || startGuard;
  const stakeCents = inactive ? stakeValue() : game.stakeCents;
  const table = inactive ? (stakeCents === null ? null : buildRoundTable(game.mode, stakeCents)) : game.table;
  const next = inactive ? table?.[0] : game.next;
  const mode = MODES[game.mode];
  const error = inactive ? validateStake() : '';
  $('scene-wrap').classList.toggle('is-playing', !inactive);
  $('balance').textContent = dollars(game.balanceCents);
  $('multiplier').innerHTML = `${game.multiplier.toFixed(2)}<span>×</span>`;
  const result = game.result;
  $('payout-label').textContent = result ? (result.kind === 'lost' ? 'Paid' : result.kind === 'cancelled' ? 'Refunded' : 'Collected') : game.status === 'idle' ? 'Stake refund' : 'Collectible';
  $('payout').textContent = dollars(result ? result.payoutCents : game.status === 'idle' ? stakeCents ?? 0 : game.payoutCents);
  $('next-label').textContent = inactive ? 'FIRST JUMP PAYS' : 'NEXT JUMP PAYS';
  $('next-payout').textContent = next ? dollars(next.payoutCents) : game.stage === STEP_COUNT && !inactive ? 'Summit' : '—';
  $('probability').textContent = next ? percent(next.probability) : '—';
  $('odds-label').textContent = next ? 'success chance' : game.stage === STEP_COUNT ? 'auto-collect' : 'choose a stake';
  $('stake-error').textContent = error;
  $('stake').setAttribute('aria-invalid', String(Boolean(error)));
  $('stake').disabled = !inactive || busy;
  $('stake-half').disabled = !inactive || busy;
  $('stake-double').disabled = !inactive || busy;
  $('presets-edit').disabled = !inactive || busy;
  document.querySelectorAll('[data-stake]').forEach(button => { button.disabled = !inactive || busy; button.classList.toggle('selected', Number(button.dataset.stake) === stakeCents); });
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.disabled = !inactive || busy;
    button.setAttribute('aria-pressed', String(button.dataset.mode === game.mode));
  });
  $('mode-summary').textContent = `${mode.name} · Step ${inactive && result?.mode !== game.mode ? 0 : game.stage} / ${STEP_COUNT}`;
  $('jump').disabled = busy || (inactive && Boolean(error));
  $('collect').disabled = game.status !== 'ready' || busy;
  $('jump').setAttribute('aria-busy', String(busy));
  $('jump-label').textContent = startGuard ? 'Getting ready…' : game.status === 'jumping' ? 'Jumping…' : game.status === 'collecting' ? 'Collecting…' : game.status === 'ended' ? 'Climb again' : game.status === 'ready' ? 'Jump' : 'Start climb';
  $('refill').hidden = !(inactive && game.balanceCents < 100);
  $('altitude').textContent = (1240 + game.stage * 120).toLocaleString('en-US');
  $('altitude').setAttribute('aria-label', `Altitude ${$('altitude').textContent} meters`);
  document.querySelectorAll('.stage-step').forEach(step => {
    const index = Number(step.dataset.stage);
    step.textContent = `${mode.stages[index - 1].multiplier.toLocaleString('en-US', { maximumFractionDigits: 2 })}×`;
    step.classList.toggle('current', index === game.stage);
    step.classList.toggle('passed', index < game.stage);
    step.classList.toggle('next', index === game.stage + 1);
    step.title = `Step ${index} · ${mode.stages[index - 1].multiplier.toFixed(2)}×${table ? ` · ${percent(table[index - 1].probability)} next-jump chance` : ''}`;
    step.setAttribute('aria-label', step.title);
    if (index === game.stage) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  });
  $('result-card').hidden = !result;
  if (result) {
    const lost = result.kind === 'lost', summit = result.kind === 'summit', cancelled = result.kind === 'cancelled';
    $('result-card').classList.toggle('lost', lost);
    ['result-kicker', 'result-title', 'result-profit', 'result-description'].forEach(id => { $(id).hidden = lost; });
    $('result-kicker').textContent = lost ? 'FOOTING LOST' : cancelled ? 'ROUND CANCELLED' : summit ? 'TOP OF THE WORLD' : 'SAFELY SHELTERED';
    $('result-title').textContent = lost ? 'Back to solid ground.' : cancelled ? 'Stake returned.' : summit ? 'Peak stubbornness.' : 'Nicely climbed.';
    $('result-label').textContent = lost ? 'Loss' : cancelled ? 'Refund' : 'Collected';
    $('result-value').textContent = dollars(lost ? result.stakeCents : result.payoutCents);
    $('result-profit').textContent = lost ? 'Payout $0.00' : `Profit ${profitDollars(result.profitCents)}`;
    $('result-description').textContent = cancelled ? 'No jump attempted. No round charge.' : `${MODES[result.mode].name} · Step ${result.stage} / 12${summit ? ' · Automatically collected' : ''}`;
  }
  $('history').innerHTML = game.history.length ? game.history.slice(0, 5).map(r => {
    const label = r.kind === 'lost' ? `Loss ${dollars(r.stakeCents)}` : r.kind === 'cancelled' ? `Refund ${dollars(r.payoutCents)}` : `Collected ${dollars(r.payoutCents)}`;
    return `<span class="history-item ${r.kind === 'lost' ? 'lost' : ''}" title="${MODES[r.mode].name} · ${r.multiplier.toFixed(2)}×"><span>${label}</span><small>${r.kind === 'lost' ? 'Payout $0.00' : `Profit ${profitDollars(r.profitCents)}`}</small></span>`;
  }).join('') : '<span class="empty-history">Every climb starts somewhere.</span>';
  $('rules-table-caption').textContent = `${mode.name} · ${dollars(stakeCents ?? 0)} stake. “Next jump” is conditional; “Reach step” is cumulative from the start.`;
  $('odds-table').innerHTML = table ? table.map(s => `<tr><td>${s.step}</td><td>${s.multiplier.toFixed(2)}×</td><td>${percent(s.probability)}</td><td>${(s.cumulativeProbability * 100).toFixed(3)}%</td></tr>`).join('') : '<tr><td colspan="4">Enter a valid stake to see its exact rounded-payout odds.</td></tr>';
  qa?.update();
}

function finishRound() {
  render();
  const r = game.result;
  if (r.kind === 'lost') {
    announce(`Jump failed. Loss ${dollars(r.stakeCents)}. Payout $0.00. Balance ${dollars(game.balanceCents)}.`);
  } else if (r.kind === 'cancelled') {
    announce(`Round cancelled. Refund ${dollars(r.payoutCents)}. Profit $0.00. Balance ${dollars(game.balanceCents)}.`);
  } else {
    announce(`${r.kind === 'summit' ? 'Summit reached. Automatically collected' : 'Collected'} ${dollars(r.payoutCents)}. Profit ${profitDollars(r.profitCents)}. Balance ${dollars(game.balanceCents)}.`);
  }
}
function animateCollection() {
  const round = game.round;
  announce(`${game.stage === 0 ? 'Refunding' : 'Collecting'} ${dollars(game.payoutCents)}. Heading into the shelter.`);
  render();
  scene.collect(game.stage === STEP_COUNT, () => { if (game.finishCollect(round)) finishRound(); });
}

$('jump').addEventListener('click', () => {
  if (startGuard || $('jump').disabled) return;
  void unlockAudio();
  if (game.inactive) {
    if (validateStake() || !game.start(stakeValue())) { render(); return; }
    scene.reset(); startGuard = true;
    announce(`${MODES[game.mode].name} climb started. Stake ${dollars(game.stakeCents)}. First jump pays ${dollars(game.next.payoutCents)} at ${percent(game.next.probability)} success. Collect now for a full refund.`);
    render();
    setTimeout(() => { startGuard = false; render(); }, 320);
    return;
  }
  let attempt;
  try { attempt = game.beginJump(); }
  catch { announce('The random source is unavailable. No jump was attempted. You can collect your current payout.'); render(); return; }
  if (!attempt) return;
  // Cosmetic selection happens only AFTER the game has resolved a failure.
  const variant = failureVariant(attempt.success, qa?.cosmeticBit);
  qa?.recordVariant(variant);
  announce(`Attempting step ${attempt.from + 1} of ${STEP_COUNT}.`); render();
  scene.jump({ ...attempt, variant }, () => {
    if (!game.finishJump(attempt.id)) return;
    if (game.status === 'ended') finishRound();
    else if (game.status === 'collecting') animateCollection();
    else {
      announce(`Step ${game.stage} of ${STEP_COUNT} reached. ${game.multiplier.toFixed(2)}×. Collect ${dollars(game.payoutCents)}, or jump at ${percent(game.next.probability)} success.`);
      render();
    }
  });
});
$('collect').addEventListener('click', () => { if (startGuard || !game.collect()) return; void unlockAudio(); animateCollection(); });
$('refill').addEventListener('click', () => { if (game.refill()) { render(); announce('Local balance reset to $1,000.00.'); } });

const dialog = $('help-dialog');
$('help-open').addEventListener('click', () => dialog.showModal());
[$('help-close'), $('help-done')].forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
render();
