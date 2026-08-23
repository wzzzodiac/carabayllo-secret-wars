const state = { context: null, master: null, timer: null, nextBarAt: 0, enabled: true, started: false };

const NOTES = Object.freeze({
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0
});
const melody = ['C5','E5','G5','E5','D5','G5','A5','G5','E5','D5','C5','E5','G5','D5','E5','C5'];
const bass = ['C4','C4','G4','G4','A4','A4','G4','G4'];
const STEP = 0.18;

function ensureAudio() {
  if (state.context) return state.context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.055;
  master.connect(context.destination);
  state.context = context;
  state.master = master;
  return context;
}

function pluck(frequency, when, duration, type = 'triangle', volume = 0.14) {
  const context = state.context;
  if (!context || !state.master) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain);
  gain.connect(state.master);
  osc.start(when);
  osc.stop(when + duration + 0.03);
}

function scheduleBar(startAt) {
  melody.forEach((note, index) => {
    pluck(NOTES[note], startAt + index * STEP, STEP * 0.82, index % 4 === 0 ? 'square' : 'triangle', index % 4 === 0 ? 0.08 : 0.055);
  });
  bass.forEach((note, index) => {
    pluck(NOTES[note] / 2, startAt + index * STEP * 2, STEP * 1.45, 'sine', 0.075);
  });
}

function pump() {
  if (!state.enabled || !state.context) return;
  while (state.nextBarAt < state.context.currentTime + 1.2) {
    scheduleBar(state.nextBarAt);
    state.nextBarAt += melody.length * STEP;
  }
}

async function startMusic() {
  if (!state.enabled) return;
  const context = ensureAudio();
  if (!context) return;
  if (context.state === 'suspended') await context.resume();
  if (!state.started) {
    state.started = true;
    state.nextBarAt = context.currentTime + 0.05;
    pump();
    state.timer = window.setInterval(pump, 500);
  }
}

function stopMusic() {
  if (state.master && state.context) state.master.gain.setTargetAtTime(0.0001, state.context.currentTime, 0.03);
}

const button = document.createElement('button');
button.type = 'button';
button.textContent = 'MUSIC // ON';
button.setAttribute('aria-label', 'Toggle game music');
Object.assign(button.style, {
  position: 'fixed', right: '18px', bottom: '18px', zIndex: '50', padding: '9px 12px',
  fontSize: '11px', letterSpacing: '.08em', opacity: '.86', backdropFilter: 'blur(8px)'
});
document.body.appendChild(button);

button.addEventListener('click', async event => {
  event.stopPropagation();
  state.enabled = !state.enabled;
  button.textContent = state.enabled ? 'MUSIC // ON' : 'MUSIC // OFF';
  if (state.enabled) {
    if (state.master && state.context) state.master.gain.setTargetAtTime(0.055, state.context.currentTime, 0.04);
    await startMusic();
  } else stopMusic();
});

const unlock = async () => {
  if (!state.enabled) return;
  if (state.master && state.context) state.master.gain.setTargetAtTime(0.055, state.context.currentTime, 0.04);
  await startMusic();
};
window.addEventListener('pointerdown', unlock, { once: true, capture: true });
window.addEventListener('keydown', unlock, { once: true, capture: true });
