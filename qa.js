import { sampleFraction, cryptoWord, MODES, dollars } from './engine.js';
import { cosmeticBit } from './cosmetics.js';

// Dynamically loaded ONLY in explicit localhost testing mode. All test jumps
// still pass through the real rational sampler, engine, animation and controls.
export function installQA() {
  const panel = document.getElementById('qa-panel');
  panel.hidden = false;
  panel.innerHTML = `<strong>Local verification controls</strong><label>Browser test outcome <select id="qa-outcome"><option value="random">Random</option><option value="success">Success</option><option value="failure">Failure</option></select></label><label>Failure animation <select id="qa-variant"><option value="random">Random 50/50</option><option value="crumble">Crumble</option><option value="shear">Shear</option></select></label><label><input type="checkbox" id="qa-reduced"> Force reduced motion</label><button id="qa-run">Run all 12 steps</button><button id="qa-stop" disabled>Stop test run</button><output id="qa-state"></output><output id="qa-audio"></output><pre id="qa-report"></pre>`;
  const $ = id => document.getElementById(id);
  const captureControls = document.createElement('div');
  captureControls.className = 'qa-capture';
  captureControls.innerHTML = '<label><input type="checkbox" id="qa-capture"> Capture animation frames</label><details id="qa-frames-detail"><summary>Latest animation frames</summary><div id="qa-frames"></div></details>';
  panel.append(captureControls);
  let game, scene, running = false, lastVariant = 'none', sounds = [];
  const capture = type => {
    if (!$('qa-capture').checked) return;
    const motion = scene.motion;
    const times = type === 'jump' ? [.15, .45, .72, .86, 1.02, 1.18, 1.42, 1.8] : [.2, .55, .9, 1.2, 1.6];
    $('qa-frames').replaceChildren();
    const frame = now => {
      if (scene.motion !== motion) return;
      const elapsed = (now - motion.start) / 1000;
      if (times.length && elapsed >= times[0]) {
        times.shift();
        const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
        image.src = scene.canvas.toDataURL('image/png');
        image.alt = `${type} at ${elapsed.toFixed(2)} seconds`;
        caption.textContent = image.alt;
        figure.append(image, caption); $('qa-frames').append(figure);
      }
      if (times.length) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const update = () => {
    if (!game) return;
    $('qa-state').textContent = `${game.status} · ${game.mode} · step ${game.stage} · attempts ${game.attempt} · last failure ${lastVariant}`;
    $('qa-run').disabled = running || !game.inactive;
    $('qa-stop').disabled = !running;
  };
  const waitUntil = condition => new Promise((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (!running) return reject(new Error('Test stopped'));
      if (condition()) return resolve();
      if (performance.now() - start > 60_000) return reject(new Error('Timed out waiting for game transition'));
      setTimeout(check, 40);
    }; check();
  });
  $('qa-reduced').addEventListener('change', () => scene?.setReducedOverride($('qa-reduced').checked ? true : null));
  $('qa-stop').addEventListener('click', () => { running = false; update(); });
  $('qa-run').addEventListener('click', async () => {
    if (!game.inactive || running) return;
    running = true; $('qa-outcome').value = 'success'; $('qa-report').textContent = ''; update();
    const output = text => { $('qa-report').textContent += `${text}\n`; };
    try {
      document.getElementById('jump').click();
      await waitUntil(() => game.status === 'ready' && !document.getElementById('jump').disabled);
      const startBalance = game.balanceCents, startAttempts = game.attempt;
      output(`${MODES[game.mode].name} · ${dollars(game.stakeCents)} · started`);
      for (let i = 1; i <= 12; i++) {
        const start = performance.now();
        document.getElementById('jump').click();
        await waitUntil(() => game.stage === i && game.status !== 'jumping');
        if (game.attempt !== startAttempts + i) throw new Error('Attempt count mismatch');
        if (i < 12 && game.balanceCents !== startBalance) throw new Error('Unexpected debit or payout');
        output(`Step ${i}: ${game.multiplier.toFixed(2)}× · ${dollars(game.payoutCents)} · ${Math.round(performance.now() - start)} ms`);
      }
      await waitUntil(() => game.status === 'ended');
      if (game.result.kind !== 'summit' || game.balanceCents !== startBalance + game.result.payoutCents) throw new Error('Summit settlement mismatch');
      output(`PASS: automatically collected ${dollars(game.result.payoutCents)}; profit ${dollars(game.result.profitCents)}; balance ${dollars(game.balanceCents)}.`);
    } catch (error) { output(`STOP: ${error.message}`); }
    finally { running = false; update(); }
  });
  return {
    sample: (n, d) => sampleFraction(n, d, () => $('qa-outcome').value === 'success' ? n - 1 : $('qa-outcome').value === 'failure' ? n : cryptoWord()),
    cosmeticBit: () => $('qa-variant').value === 'crumble' ? 0 : $('qa-variant').value === 'shear' ? 1 : cosmeticBit(),
    connect(g, s, audio) {
      game = g; scene = s;
      // Observe rendered pixels only. The production methods and timelines run unchanged.
      for (const method of ['jump', 'collect']) {
        const original = scene[method].bind(scene);
        scene[method] = (...args) => { const started = original(...args); if (started) capture(method); return started; };
      }
      audio.onEvent = (event, muted) => { sounds.push(`${event}${muted ? ' (muted)' : ''}`); sounds = sounds.slice(-8); $('qa-audio').textContent = `Audio cues: ${sounds.join(' → ')}`; };
      update();
    },
    recordVariant(variant) { lastVariant = variant || 'none'; },
    update,
  };
}
