import { SpiralRenderer, hexToRgbNorm } from './shader.js';
import { HypnoAudio } from './audio.js';

// ===== Curated Presets =====
const PRESETS = [
  {
    id: 'obsidian',
    name: 'Obsidian Trance',
    tag: 'Strongest illusion',
    mode: 0,
    arms: 6,
    tightness: 4.6,
    balance: 0.5,
    speed: 1.45,
    direction: 1,
    pulse: 0.14,
    warp: 0.04,
    softness: 0.08,
    chroma: 0.26,
    iridescence: 0.0,
    depth: 0.52,
    colorA: '#f5f3ed',
    colorB: '#06060b',
    colorGlow: '#8b5cf6',
  },
  {
    id: 'velvet',
    name: 'Velvet Abyss',
    tag: 'Deep tunnel',
    mode: 2,
    arms: 8,
    tightness: 3.4,
    balance: 0.48,
    speed: 1.3,
    direction: 1,
    pulse: 0.28,
    warp: 0.12,
    softness: 0.22,
    chroma: 0.44,
    iridescence: 0.12,
    depth: 0.72,
    colorA: '#e0d4ff',
    colorB: '#080514',
    colorGlow: '#7c3aed',
  },
  {
    id: 'mirage',
    name: 'Solar Mirage',
    tag: 'Counter-spin moiré',
    mode: 3,
    arms: 7,
    tightness: 4.0,
    balance: 0.52,
    speed: 1.15,
    direction: 1,
    pulse: 0.24,
    warp: 0.18,
    softness: 0.18,
    chroma: 0.34,
    iridescence: 0.0,
    depth: 0.62,
    colorA: '#ffb84d',
    colorB: '#12060a',
    colorGlow: '#f43f5e',
  },
  {
    id: 'biolum',
    name: 'Abyssal Biolume',
    tag: 'Organic ripple',
    mode: 4,
    arms: 5,
    tightness: 3.8,
    balance: 0.46,
    speed: 1.25,
    direction: 1,
    pulse: 0.36,
    warp: 0.48,
    softness: 0.32,
    chroma: 0.38,
    iridescence: 0.18,
    depth: 0.66,
    colorA: '#67f3e4',
    colorB: '#031017',
    colorGlow: '#06b6d4',
  },
  {
    id: 'opal',
    name: 'Liquid Opal',
    tag: 'Color shift',
    mode: 0,
    arms: 8,
    tightness: 5.2,
    balance: 0.5,
    speed: 1.35,
    direction: -1,
    pulse: 0.22,
    warp: 0.26,
    softness: 0.28,
    chroma: 0.52,
    iridescence: 0.88,
    depth: 0.58,
    colorA: '#ffffff',
    colorB: '#090912',
    colorGlow: '#38bdf8',
  },
  {
    id: 'opart',
    name: 'Acid Op-Art',
    tag: 'Crisp Archimedean',
    mode: 1,
    arms: 10,
    tightness: 4.8,
    balance: 0.5,
    speed: 1.55,
    direction: 1,
    pulse: 0.08,
    warp: 0.0,
    softness: 0.02,
    chroma: 0.18,
    iridescence: 0.0,
    depth: 0.42,
    colorA: '#d9ff4d',
    colorB: '#090a08',
    colorGlow: '#84cc16',
  },
];

const DEFAULT_STATE = {
  ...PRESETS[0],
  presetName: PRESETS[0].name,
  interactive: true,
  showDot: false,
};

const ILLUSION_DURATION_SEC = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

// ===== Compact URL Serialization =====
function encodeStateToParams(state, extra = {}) {
  const params = new URLSearchParams();
  params.set('m', String(state.mode));
  params.set('a', String(state.arms));
  params.set('t', state.tightness.toFixed(1));
  params.set('b', state.balance.toFixed(2));
  params.set('s', state.speed.toFixed(2));
  params.set('d', String(state.direction));
  params.set('p', state.pulse.toFixed(2));
  params.set('w', state.warp.toFixed(2));
  params.set('sf', state.softness.toFixed(2));
  params.set('ch', state.chroma.toFixed(2));
  params.set('ir', state.iridescence.toFixed(2));
  params.set('dp', state.depth.toFixed(2));
  params.set('ca', state.colorA.replace('#', ''));
  params.set('cb', state.colorB.replace('#', ''));
  params.set('cg', state.colorGlow.replace('#', ''));
  if (state.showDot) params.set('dot', '1');
  if (!state.interactive) params.set('int', '0');
  for (const [k, v] of Object.entries(extra)) {
    params.set(k, String(v));
  }
  return params.toString();
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function parseHexParam(val, fallback) {
  if (!val) return fallback;
  const clean = val.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 6) return `#${clean.toLowerCase()}`;
  return fallback;
}

function loadInitialState() {
  const params = new URLSearchParams(window.location.search);
  const presetId = params.get('preset');
  const basePreset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];

  const state = {
    ...DEFAULT_STATE,
    ...basePreset,
    presetName: basePreset.name,
  };

  if (!params.has('s') && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    state.speed = 0.45;
  }

  let customized = false;
  const numParam = (key, min, max, isInt = false) => {
    if (!params.has(key)) return null;
    const n = parseFloat(params.get(key));
    if (!Number.isFinite(n)) return null;
    customized = true;
    const clamped = clamp(n, min, max);
    return isInt ? Math.round(clamped) : clamped;
  };

  const m = numParam('m', 0, 4, true);
  if (m !== null) state.mode = m;
  const a = numParam('a', 1, 24, true);
  if (a !== null) state.arms = a;
  const t = numParam('t', 0.5, 14);
  if (t !== null) state.tightness = t;
  const b = numParam('b', 0.15, 0.85);
  if (b !== null) state.balance = b;
  const s = numParam('s', 0, 4.5);
  if (s !== null) state.speed = s;
  if (params.has('d')) {
    state.direction = params.get('d') === '-1' ? -1 : 1;
    customized = true;
  }
  const p = numParam('p', 0, 1);
  if (p !== null) state.pulse = p;
  const w = numParam('w', 0, 1);
  if (w !== null) state.warp = w;
  const sf = numParam('sf', 0, 1);
  if (sf !== null) state.softness = sf;
  const ch = numParam('ch', 0, 1);
  if (ch !== null) state.chroma = ch;
  const ir = numParam('ir', 0, 1);
  if (ir !== null) state.iridescence = ir;
  const dp = numParam('dp', 0, 1);
  if (dp !== null) state.depth = dp;

  if (params.has('ca')) { state.colorA = parseHexParam(params.get('ca'), state.colorA); customized = true; }
  if (params.has('cb')) { state.colorB = parseHexParam(params.get('cb'), state.colorB); customized = true; }
  if (params.has('cg')) { state.colorGlow = parseHexParam(params.get('cg'), state.colorGlow); customized = true; }

  if (params.get('dot') === '1') state.showDot = true;
  if (params.get('int') === '0') state.interactive = false;

  if (customized && !presetId) {
    state.presetName = 'Custom';
  }

  return {
    state,
    autoTrick: params.get('trick') === '1',
  };
}

// ===== Main Application =====
const canvas = document.getElementById('spiral-canvas');
const renderer = new SpiralRenderer(canvas);
const audio = new HypnoAudio();

const { state: targetState, autoTrick } = loadInitialState();

const liveState = { ...targetState };
const runtime = {
  phase: 0,
  clock: 0,
  pointerX: 0,
  pointerY: 0,
  targetPointerX: 0,
  targetPointerY: 0,
  pointerStrength: 0,
  targetPointerStrength: 0,
  pointerActiveUntil: 0,
  isDragging: false,
  colorA: hexToRgbNorm(targetState.colorA),
  colorB: hexToRgbNorm(targetState.colorB),
  colorGlow: hexToRgbNorm(targetState.colorGlow),
};

let isPlaying = true;
let isDrawerOpen = false;
let isHudVisible = false; // Hidden on initial load until user clicks or taps once

// 20-Second Optical Illusion State
const illusion = {
  active: false,
  startTime: 0,
  savedState: null,
};

// ===== DOM References =====
const els = {
  presetGrid: document.getElementById('preset-grid'),
  drawer: document.getElementById('config-drawer'),
  btnToggleDrawer: document.getElementById('btn-toggle-drawer'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  btnPlay: document.getElementById('btn-play'),
  iconPause: document.getElementById('icon-pause'),
  iconPlay: document.getElementById('icon-play'),
  btnIllusion: document.getElementById('btn-illusion'),
  btnRandomize: document.getElementById('btn-randomize'),
  btnAudio: document.getElementById('btn-audio'),
  iconSoundOff: document.getElementById('icon-sound-off'),
  iconSoundOn: document.getElementById('icon-sound-on'),
  btnShare: document.getElementById('btn-share'),
  btnFullscreen: document.getElementById('btn-fullscreen'),
  btnReset: document.getElementById('btn-reset'),
  btnCopyLink: document.getElementById('btn-copy-link'),
  btnCopyTrickLink: document.getElementById('btn-copy-trick-link'),
  modeBtns: Array.from(document.querySelectorAll('#mode-selector .seg-btn')),
  dirInward: document.getElementById('dir-inward'),
  dirOutward: document.getElementById('dir-outward'),
  arms: document.getElementById('ctrl-arms'),
  tightness: document.getElementById('ctrl-tightness'),
  balance: document.getElementById('ctrl-balance'),
  speed: document.getElementById('ctrl-speed'),
  pulse: document.getElementById('ctrl-pulse'),
  warp: document.getElementById('ctrl-warp'),
  softness: document.getElementById('ctrl-softness'),
  chroma: document.getElementById('ctrl-chroma'),
  iridescence: document.getElementById('ctrl-iridescence'),
  depth: document.getElementById('ctrl-depth'),
  colorA: document.getElementById('ctrl-color-a'),
  colorB: document.getElementById('ctrl-color-b'),
  colorGlow: document.getElementById('ctrl-color-glow'),
  interactive: document.getElementById('ctrl-interactive'),
  showDot: document.getElementById('ctrl-dot'),
  vals: {
    arms: document.getElementById('val-arms'),
    tightness: document.getElementById('val-tightness'),
    balance: document.getElementById('val-balance'),
    speed: document.getElementById('val-speed'),
    pulse: document.getElementById('val-pulse'),
    warp: document.getElementById('val-warp'),
    softness: document.getElementById('val-softness'),
    chroma: document.getElementById('val-chroma'),
    iridescence: document.getElementById('val-iridescence'),
    depth: document.getElementById('val-depth'),
    hexA: document.getElementById('hex-color-a'),
    hexB: document.getElementById('hex-color-b'),
    hexGlow: document.getElementById('hex-color-glow'),
  },
  ringProgress: document.getElementById('ring-progress'),
  illusionCountdown: document.getElementById('illusion-countdown'),
  illusionHint: document.getElementById('illusion-hint'),
  aftereffectScreen: document.getElementById('aftereffect-screen'),
  btnBackToSpiral: document.getElementById('btn-back-to-spiral'),
  btnRetryIllusion: document.getElementById('btn-retry-illusion'),
  toast: document.getElementById('toast'),
};

// ===== Toast Helper =====
let toastTimeout = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.toast.classList.remove('visible');
  }, 2200);
}

// ===== Build Preset Cards =====
function buildPresetGrid() {
  els.presetGrid.innerHTML = '';
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-card';
    btn.dataset.presetId = preset.id;
    btn.innerHTML = `
      <span class="preset-swatch" style="background: conic-gradient(from 0deg, ${preset.colorA}, ${preset.colorGlow}, ${preset.colorB}, ${preset.colorA});"></span>
      <span>
        <span class="preset-name">${preset.name}</span>
        <span class="preset-tag">${preset.tag}</span>
      </span>
    `;
    btn.addEventListener('click', () => applyPreset(preset));
    els.presetGrid.appendChild(btn);
  }
}

function applyPreset(preset) {
  Object.assign(targetState, preset, { presetName: preset.name });
  syncUIFromState();
  syncUrlSilently();
  showToast(preset.name);
}

function markCustom() {
  targetState.presetName = 'Custom';
  for (const card of els.presetGrid.children) {
    card.classList.remove('active');
  }
  syncUrlSilently();
}

function syncUIFromState() {
  for (const card of els.presetGrid.children) {
    card.classList.toggle('active', card.dataset.presetId === targetState.id && targetState.presetName !== 'Custom');
  }

  for (const btn of els.modeBtns) {
    btn.classList.toggle('active', Number(btn.dataset.mode) === targetState.mode);
  }

  els.dirInward.classList.toggle('active', targetState.direction === 1);
  els.dirOutward.classList.toggle('active', targetState.direction === -1);

  els.arms.value = targetState.arms;
  els.tightness.value = targetState.tightness;
  els.balance.value = targetState.balance;
  els.speed.value = targetState.speed;
  els.pulse.value = targetState.pulse;
  els.warp.value = targetState.warp;
  els.softness.value = targetState.softness;
  els.chroma.value = targetState.chroma;
  els.iridescence.value = targetState.iridescence;
  els.depth.value = targetState.depth;

  els.colorA.value = targetState.colorA;
  els.colorB.value = targetState.colorB;
  els.colorGlow.value = targetState.colorGlow;

  els.interactive.checked = targetState.interactive;
  els.showDot.checked = targetState.showDot;
  document.body.classList.toggle('dot-hidden', !targetState.showDot);

  els.vals.arms.textContent = String(targetState.arms);
  els.vals.tightness.textContent = targetState.tightness.toFixed(1);
  els.vals.balance.textContent = `${Math.round(targetState.balance * 100)}%`;
  els.vals.speed.textContent = `${targetState.speed.toFixed(2)}×`;
  els.vals.pulse.textContent = targetState.pulse.toFixed(2);
  els.vals.warp.textContent = targetState.warp.toFixed(2);
  els.vals.softness.textContent = targetState.softness.toFixed(2);
  els.vals.chroma.textContent = targetState.chroma.toFixed(2);
  els.vals.iridescence.textContent = targetState.iridescence.toFixed(2);
  els.vals.depth.textContent = targetState.depth.toFixed(2);

  els.vals.hexA.textContent = targetState.colorA.toUpperCase();
  els.vals.hexB.textContent = targetState.colorB.toUpperCase();
  els.vals.hexGlow.textContent = targetState.colorGlow.toUpperCase();
}

let urlDebounce = null;
function syncUrlSilently() {
  clearTimeout(urlDebounce);
  urlDebounce = setTimeout(() => {
    const query = encodeStateToParams(targetState);
    const nextUrl = `${window.location.pathname}?${query}`;
    window.history.replaceState(null, '', nextUrl);
  }, 180);
}

// ===== Drawer & HUD Visibility =====
function setHudVisible(visible) {
  isHudVisible = visible;
  document.body.classList.toggle('hud-hidden', !visible);
  if (!visible && isDrawerOpen) {
    setDrawerOpen(false);
  }
}

function setDrawerOpen(open) {
  isDrawerOpen = open;
  document.body.classList.toggle('drawer-open', open);
  els.drawer.classList.toggle('open', open);
  els.drawer.setAttribute('aria-hidden', String(!open));
  els.btnToggleDrawer.setAttribute('aria-expanded', String(open));
  els.btnToggleDrawer.classList.toggle('active', open);
  if (open && !isHudVisible) {
    setHudVisible(true);
  }
}

// ===== Play / Pause =====
function setPlaying(playing) {
  isPlaying = playing;
  els.iconPause.hidden = !playing;
  els.iconPlay.hidden = playing;
  els.btnPlay.classList.toggle('active', !playing);
  audio.sync(targetState.speed, targetState.direction, isPlaying);
}

// ===== Randomize Generator =====
const RANDOM_PALETTES = [
  ['#f7f5ef', '#06060b', '#a78bfa'],
  ['#ffd166', '#0e0714', '#ef476f'],
  ['#64ffda', '#04121c', '#00b4d8'],
  ['#ff99c8', '#0c0612', '#c77dff'],
  ['#d9ff4d', '#080b07', '#4ade80'],
  ['#e2f1ff', '#050816', '#38bdf8'],
  ['#ff7b54', '#120608', '#ffb26b'],
  ['#f3e8ff', '#0c0519', '#d946ef'],
];

function randomizeSpiral() {
  const palette = RANDOM_PALETTES[Math.floor(Math.random() * RANDOM_PALETTES.length)];
  const mode = Math.floor(Math.random() * 5);
  const arms = [3, 4, 5, 6, 7, 8, 10, 12][Math.floor(Math.random() * 8)];

  Object.assign(targetState, {
    id: null,
    presetName: 'Random',
    mode,
    arms,
    tightness: Number((2.2 + Math.random() * 5.8).toFixed(1)),
    balance: Number((0.42 + Math.random() * 0.16).toFixed(2)),
    speed: Number((0.95 + Math.random() * 1.15).toFixed(2)),
    direction: Math.random() > 0.25 ? 1 : -1,
    pulse: Number((Math.random() * 0.42).toFixed(2)),
    warp: Number((mode === 4 ? 0.25 + Math.random() * 0.45 : Math.random() * 0.3).toFixed(2)),
    softness: Number((0.04 + Math.random() * 0.32).toFixed(2)),
    chroma: Number((0.15 + Math.random() * 0.5).toFixed(2)),
    iridescence: Math.random() > 0.72 ? Number((0.45 + Math.random() * 0.5).toFixed(2)) : 0,
    depth: Number((0.42 + Math.random() * 0.36).toFixed(2)),
    colorA: palette[0],
    colorB: palette[1],
    colorGlow: palette[2],
  });

  syncUIFromState();
  syncUrlSilently();
  showToast('Randomized');
}

// ===== 20-Second Motion Aftereffect ("The Trick") =====
function startIllusionChallenge() {
  els.aftereffectScreen.hidden = true;
  setDrawerOpen(false);
  setPlaying(true);

  illusion.savedState = { ...targetState };
  illusion.active = true;
  illusion.startTime = performance.now();

  if (targetState.speed < 1.35) {
    targetState.speed = 1.65;
  }

  document.body.classList.add('illusion-active');
  els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  els.illusionCountdown.textContent = String(ILLUSION_DURATION_SEC);
  els.illusionHint.textContent = 'Keep your eyes on the center';
}

function stopIllusionChallenge(showReveal = false) {
  if (!illusion.active) return;
  illusion.active = false;
  document.body.classList.remove('illusion-active');

  if (illusion.savedState) {
    targetState.speed = illusion.savedState.speed;
    illusion.savedState = null;
  }

  if (showReveal) {
    setPlaying(false);
    els.aftereffectScreen.hidden = false;
  } else {
    setHudVisible(true);
  }
}

function updateIllusion(now) {
  if (!illusion.active) return;
  const elapsed = (now - illusion.startTime) / 1000;
  const progress = clamp(elapsed / ILLUSION_DURATION_SEC, 0, 1);
  const remaining = Math.max(0, Math.ceil(ILLUSION_DURATION_SEC - elapsed));

  els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  els.illusionCountdown.textContent = String(remaining);

  if (remaining <= 5 && remaining > 0) {
    els.illusionHint.textContent = 'Almost done — stay locked on the dot';
  } else if (remaining <= 12) {
    els.illusionHint.textContent = 'Stay relaxed and keep staring at the center';
  }

  if (elapsed >= ILLUSION_DURATION_SEC) {
    stopIllusionChallenge(true);
  }
}

// ===== Share Links =====
async function copyUrlToClipboard(extra = {}, toastMsg = 'Link copied') {
  const query = encodeStateToParams(targetState, extra);
  const url = `${window.location.origin}${window.location.pathname}?${query}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast(toastMsg);
  } catch {
    window.prompt('Copy this link:', url);
  }
}

// ===== Pointer / Touch Helpers =====
function updatePointerCoords(clientX, clientY, strength) {
  if (!targetState.interactive || illusion.active) return;
  const minDim = Math.min(window.innerWidth, window.innerHeight) || 1;
  runtime.targetPointerX = clamp((clientX - window.innerWidth * 0.5) / minDim, -0.75, 0.75);
  runtime.targetPointerY = clamp(-(clientY - window.innerHeight * 0.5) / minDim, -0.75, 0.75);
  runtime.targetPointerStrength = strength;
  runtime.pointerActiveUntil = performance.now() + 2400;
}

// ===== Bind UI Controls =====
function bindControls() {
  for (const btn of els.modeBtns) {
    btn.addEventListener('click', () => {
      targetState.mode = Number(btn.dataset.mode);
      syncUIFromState();
      markCustom();
    });
  }

  const setDir = (d) => {
    targetState.direction = d;
    syncUIFromState();
    markCustom();
    audio.sync(targetState.speed, targetState.direction, isPlaying);
  };
  els.dirInward.addEventListener('click', () => setDir(1));
  els.dirOutward.addEventListener('click', () => setDir(-1));

  const bindRange = (el, key, parseFn = parseFloat) => {
    el.addEventListener('input', () => {
      targetState[key] = parseFn(el.value);
      syncUIFromState();
      markCustom();
      if (key === 'speed') {
        audio.sync(targetState.speed, targetState.direction, isPlaying);
      }
    });
  };

  bindRange(els.arms, 'arms', (v) => parseInt(v, 10));
  bindRange(els.tightness, 'tightness');
  bindRange(els.balance, 'balance');
  bindRange(els.speed, 'speed');
  bindRange(els.pulse, 'pulse');
  bindRange(els.warp, 'warp');
  bindRange(els.softness, 'softness');
  bindRange(els.chroma, 'chroma');
  bindRange(els.iridescence, 'iridescence');
  bindRange(els.depth, 'depth');

  const bindColor = (el, key) => {
    el.addEventListener('input', () => {
      targetState[key] = el.value;
      syncUIFromState();
      markCustom();
    });
  };
  bindColor(els.colorA, 'colorA');
  bindColor(els.colorB, 'colorB');
  bindColor(els.colorGlow, 'colorGlow');

  els.interactive.addEventListener('change', () => {
    targetState.interactive = els.interactive.checked;
    syncUrlSilently();
  });

  els.showDot.addEventListener('change', () => {
    targetState.showDot = els.showDot.checked;
    document.body.classList.toggle('dot-hidden', !targetState.showDot);
    syncUrlSilently();
  });

  els.btnPlay.addEventListener('click', () => setPlaying(!isPlaying));
  els.btnIllusion.addEventListener('click', () => startIllusionChallenge());
  els.btnRandomize.addEventListener('click', () => randomizeSpiral());

  els.btnAudio.addEventListener('click', async () => {
    const on = await audio.toggle();
    els.btnAudio.classList.toggle('active', on);
    els.btnAudio.setAttribute('aria-pressed', String(on));
    els.iconSoundOff.hidden = on;
    els.iconSoundOn.hidden = !on;
    if (on) {
      audio.sync(targetState.speed, targetState.direction, isPlaying);
      showToast('Audio on');
    } else {
      showToast('Audio muted');
    }
  });

  els.btnShare.addEventListener('click', () => copyUrlToClipboard({}, 'Share link copied'));
  els.btnCopyLink.addEventListener('click', () => copyUrlToClipboard({}, 'Share link copied'));
  els.btnCopyTrickLink.addEventListener('click', () =>
    copyUrlToClipboard({ trick: 1 }, '20s trick link copied')
  );

  els.btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  els.btnToggleDrawer.addEventListener('click', () => setDrawerOpen(!isDrawerOpen));
  els.btnCloseDrawer.addEventListener('click', () => setDrawerOpen(false));
  els.btnReset.addEventListener('click', () => applyPreset(PRESETS[0]));

  els.btnBackToSpiral.addEventListener('click', () => {
    els.aftereffectScreen.hidden = true;
    setPlaying(true);
  });

  els.btnRetryIllusion.addEventListener('click', () => {
    startIllusionChallenge();
  });

  // ===== Canvas Interaction: Distinguish Tap/Click vs Finger/Mouse Drag =====
  const gesture = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: 0,
    isTouch: false,
  };

  canvas.addEventListener('pointerdown', (e) => {
    gesture.active = true;
    gesture.pointerId = e.pointerId;
    gesture.startX = e.clientX;
    gesture.startY = e.clientY;
    gesture.moved = 0;
    gesture.isTouch = e.pointerType === 'touch';

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }

    runtime.isDragging = true;
    // Touching or pressing immediately engages smooth vortex pull
    updatePointerCoords(e.clientX, e.clientY, gesture.isTouch ? 1.3 : 1.0);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (gesture.active && e.pointerId === gesture.pointerId) {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
      // Running finger or dragging mouse bends & pulls the spiral smoothly
      updatePointerCoords(e.clientX, e.clientY, gesture.isTouch ? 1.4 : 1.1);
    } else if (e.pointerType === 'mouse') {
      // Subtle desktop hover pull — never reveals controls on its own
      updatePointerCoords(e.clientX, e.clientY, 0.55);
    }
  });

  const finishGesture = (e, cancelled = false) => {
    if (!gesture.active || e.pointerId !== gesture.pointerId) return;
    const wasTap = !cancelled && gesture.moved < 12;

    gesture.active = false;
    gesture.pointerId = null;
    runtime.isDragging = false;
    // Gently drift vortex back to center after lifting finger
    if (gesture.isTouch) {
      runtime.pointerActiveUntil = performance.now() + 350;
    }

    if (!wasTap) return;

    // Single click (desktop) or tap (mobile) reveals/toggles controls
    if (illusion.active) {
      stopIllusionChallenge(false);
      showToast('20s trick cancelled');
      return;
    }

    if (isDrawerOpen) {
      setDrawerOpen(false);
      return;
    }

    setHudVisible(!isHudVisible);
  };

  canvas.addEventListener('pointerup', (e) => finishGesture(e, false));
  canvas.addEventListener('pointercancel', (e) => finishGesture(e, true));

  // Prevent iOS Safari scroll/rubber-banding while sliding finger across spiral
  canvas.addEventListener('touchmove', (e) => {
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener('pointerleave', () => {
    if (!runtime.isDragging) {
      runtime.pointerActiveUntil = 0;
    }
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();

    if (e.code === 'Space') {
      e.preventDefault();
      if (illusion.active) {
        stopIllusionChallenge(false);
      } else {
        setPlaying(!isPlaying);
      }
    } else if (key === 'i') {
      if (illusion.active) stopIllusionChallenge(false);
      else startIllusionChallenge();
    } else if (key === 'r') {
      randomizeSpiral();
    } else if (key === 'c') {
      setDrawerOpen(!isDrawerOpen);
    } else if (key === 'f') {
      els.btnFullscreen.click();
    } else if (key === 'm') {
      els.btnAudio.click();
    } else if (key === 'h') {
      setHudVisible(!isHudVisible);
    } else if (key === 'escape') {
      if (illusion.active) stopIllusionChallenge(false);
      else if (!els.aftereffectScreen.hidden) {
        els.aftereffectScreen.hidden = true;
        setPlaying(true);
      } else if (isDrawerOpen) {
        setDrawerOpen(false);
      } else if (isHudVisible) {
        setHudVisible(false);
      }
    }
  });

  window.addEventListener('resize', () => renderer.resize());
}

// ===== Smooth Parameter Interpolation & Render Loop =====
function lerp(a, b, t) {
  return a + (b - a) * t;
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const smooth = 1 - Math.exp(-dt * 8.5);
  const colorSmooth = 1 - Math.exp(-dt * 6.5);

  liveState.mode = targetState.mode;
  liveState.arms = targetState.arms;
  liveState.tightness = lerp(liveState.tightness, targetState.tightness, smooth);
  liveState.balance = lerp(liveState.balance, targetState.balance, smooth);
  liveState.speed = lerp(liveState.speed, targetState.speed, smooth);
  liveState.pulse = lerp(liveState.pulse, targetState.pulse, smooth);
  liveState.warp = lerp(liveState.warp, targetState.warp, smooth);
  liveState.softness = lerp(liveState.softness, targetState.softness, smooth);
  liveState.chroma = lerp(liveState.chroma, targetState.chroma, smooth);
  liveState.iridescence = lerp(liveState.iridescence, targetState.iridescence, smooth);
  liveState.depth = lerp(liveState.depth, targetState.depth, smooth);

  const dstA = hexToRgbNorm(targetState.colorA);
  const dstB = hexToRgbNorm(targetState.colorB);
  const dstG = hexToRgbNorm(targetState.colorGlow);
  for (let i = 0; i < 3; i++) {
    runtime.colorA[i] = lerp(runtime.colorA[i], dstA[i], colorSmooth);
    runtime.colorB[i] = lerp(runtime.colorB[i], dstB[i], colorSmooth);
    runtime.colorGlow[i] = lerp(runtime.colorGlow[i], dstG[i], colorSmooth);
  }

  // Smooth pointer / finger tracking (returns to center when lifted or during 20s Trick)
  const pointerAlive =
    targetState.interactive &&
    !illusion.active &&
    (runtime.isDragging || now < runtime.pointerActiveUntil);

  const trackRate = runtime.isDragging ? 14.0 : 4.5;
  const ptrSmooth = 1 - Math.exp(-dt * trackRate);
  const desiredStrength = pointerAlive ? runtime.targetPointerStrength : 0;

  runtime.pointerStrength = lerp(runtime.pointerStrength, desiredStrength, ptrSmooth);
  runtime.pointerX = lerp(runtime.pointerX, pointerAlive ? runtime.targetPointerX : 0, ptrSmooth);
  runtime.pointerY = lerp(runtime.pointerY, pointerAlive ? runtime.targetPointerY : 0, ptrSmooth);

  if (isPlaying) {
    const velocity = liveState.speed * 2.4 * targetState.direction;
    runtime.phase += dt * velocity;
    runtime.clock += dt;
  }

  updateIllusion(now);
  renderer.render(liveState, runtime);
  requestAnimationFrame(frame);
}

// ===== Boot =====
buildPresetGrid();
syncUIFromState();
bindControls();
setHudVisible(false);

if (autoTrick) {
  setTimeout(() => startIllusionChallenge(), 350);
}

requestAnimationFrame(frame);
