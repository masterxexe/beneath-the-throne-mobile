/** Procedural fight SFX and looping beds. No licensed samples. */
const STORAGE_KEY = "btt_audio";
const DEFAULTS = {music: true, sfx: true};

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let noiseBuffer = null;
let currentBed = "";
let bedTimer = 0;
let stingTimer = 0;
let prefs = loadPrefs();

function loadPrefs(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return {
      music: raw?.music !== false,
      sfx: raw?.sfx !== false
    };
  }catch{
    return {...DEFAULTS};
  }
}

function savePrefs(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  applyGains();
  syncAudioButtons();
}

function audioContext(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC)return null;
  if(!ctx){
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    applyGains();
    noiseBuffer = makeNoiseBuffer(ctx);
  }
  if(ctx.state === "suspended")ctx.resume().catch(()=>{});
  return ctx;
}

function applyGains(){
  if(!musicBus || !sfxBus)return;
  musicBus.gain.value = prefs.music ? 0.22 : 0;
  sfxBus.gain.value = prefs.sfx ? 0.42 : 0;
}

function makeNoiseBuffer(ac){
  const length = ac.sampleRate * 1.2;
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < length; i += 1)data[i] = Math.random() * 2 - 1;
  return buffer;
}

function now(){
  return audioContext()?.currentTime || 0;
}

function noiseBurst({time, dur = 0.12, freq = 1200, q = 0.8, gain = 0.2, type = "bandpass", dest = sfxBus} = {}){
  const ac = audioContext();
  if(!ac || !noiseBuffer || !dest)return;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const amp = ac.createGain();
  src.buffer = noiseBuffer;
  filter.type = type;
  filter.frequency.setValueAtTime(freq, time);
  filter.Q.value = q;
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter);
  filter.connect(amp);
  amp.connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
}

function tone({time, freq = 220, dur = 0.18, type = "sine", gain = 0.08, slide = 0, dest = sfxBus} = {}){
  const ac = audioContext();
  if(!ac || !dest)return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), time + dur);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(amp);
  amp.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

const SFX = {
  "hero-swing"(){
    const t = now();
    noiseBurst({time:t, dur:0.14, freq:1800, q:0.7, gain:0.18, type:"highpass"});
    tone({time:t, freq:420, dur:0.12, type:"square", gain:0.04, slide:-220});
  },
  "enemy-swing"(){
    const t = now();
    noiseBurst({time:t, dur:0.16, freq:900, q:0.6, gain:0.16, type:"bandpass"});
    tone({time:t, freq:180, dur:0.16, type:"sawtooth", gain:0.05, slide:-80});
  },
  "hero-hit"(){
    const t = now();
    noiseBurst({time:t, dur:0.1, freq:2400, q:1.2, gain:0.22, type:"bandpass"});
    tone({time:t, freq:160, dur:0.18, type:"square", gain:0.07, slide:-90});
    tone({time:t + 0.02, freq:90, dur:0.12, type:"sine", gain:0.06});
  },
  "hero-hurt"(){
    const t = now();
    noiseBurst({time:t, dur:0.18, freq:420, q:0.5, gain:0.2, type:"lowpass"});
    tone({time:t, freq:140, dur:0.22, type:"sawtooth", gain:0.05, slide:-60});
  },
  block(){
    const t = now();
    noiseBurst({time:t, dur:0.09, freq:3200, q:2.4, gain:0.18, type:"bandpass"});
    tone({time:t, freq:620, dur:0.14, type:"square", gain:0.05, slide:-180});
    tone({time:t, freq:310, dur:0.16, type:"triangle", gain:0.04});
  },
  potion(){
    const t = now();
    tone({time:t, freq:523, dur:0.16, type:"sine", gain:0.06});
    tone({time:t + 0.08, freq:659, dur:0.18, type:"sine", gain:0.05});
    tone({time:t + 0.16, freq:784, dur:0.22, type:"sine", gain:0.04});
  },
  "potion-mana"(){
    const t = now();
    tone({time:t, freq:392, dur:0.14, type:"sine", gain:0.05});
    tone({time:t + 0.1, freq:587, dur:0.2, type:"triangle", gain:0.05});
  },
  miss(){
    const t = now();
    noiseBurst({time:t, dur:0.1, freq:2100, q:0.4, gain:0.1, type:"highpass"});
  },
  magic(){
    const t = now();
    tone({time:t, freq:480, dur:0.22, type:"triangle", gain:0.05, slide:220});
    noiseBurst({time:t, dur:0.2, freq:1400, q:1.1, gain:0.12, type:"bandpass"});
  },
  "ui-click"(){
    const t = now();
    tone({time:t, freq:880, dur:0.05, type:"square", gain:0.03});
  },
  "threat-warning"(){
    const t = now();
    tone({time:t, freq:196, dur:0.22, type:"sawtooth", gain:0.07});
    tone({time:t + 0.18, freq:147, dur:0.28, type:"sawtooth", gain:0.06});
  },
  "transition-whoosh"(){
    const t = now();
    noiseBurst({time:t, dur:0.42, freq:700, q:0.4, gain:0.16, type:"lowpass"});
    tone({time:t, freq:90, dur:0.4, type:"sine", gain:0.05, slide:-40});
  },
  "victory-sting"(){
    const t = now();
    [392, 494, 587, 784].forEach((freq, i) => tone({time:t + i * 0.11, freq, dur:0.28, type:"triangle", gain:0.07, dest:musicBus}));
  },
  "defeat-sting"(){
    const t = now();
    [196, 147, 98].forEach((freq, i) => tone({time:t + i * 0.16, freq, dur:0.34, type:"sawtooth", gain:0.06, dest:musicBus}));
  },
  "dragon-hit"(){
    const t = now();
    noiseBurst({time:t, dur:0.28, freq:180, q:0.4, gain:0.24, type:"lowpass"});
    tone({time:t, freq:55, dur:0.36, type:"sawtooth", gain:0.08, slide:-20});
  },
  "kael-hit"(){
    const t = now();
    noiseBurst({time:t, dur:0.12, freq:2600, q:1.4, gain:0.16, type:"bandpass"});
    tone({time:t, freq:740, dur:0.16, type:"triangle", gain:0.05});
  }
};

function kick(time){
  tone({time, freq:90, dur:0.16, type:"sine", gain:0.09, slide:-50, dest:musicBus});
  noiseBurst({time, dur:0.08, freq:120, q:0.6, gain:0.1, type:"lowpass", dest:musicBus});
}

function hat(time){
  noiseBurst({time, dur:0.04, freq:7000, q:0.7, gain:0.035, type:"highpass", dest:musicBus});
}

function padNote(time, freq, dur){
  tone({time, freq, dur, type:"sine", gain:0.035, dest:musicBus});
  tone({time, freq: freq * 1.005, dur, type:"triangle", gain:0.02, dest:musicBus});
}

function scheduleBed(kind, time){
  if(kind === "combat"){
    kick(time);
    hat(time + 0.21);
    kick(time + 0.42);
    hat(time + 0.63);
    padNote(time, 146.83, 0.8);
    padNote(time + 0.42, 174.61, 0.38);
    tone({time, freq:73.42, dur:0.38, type:"sine", gain:0.045, dest:musicBus});
    tone({time:time + 0.42, freq:87.31, dur:0.32, type:"triangle", gain:0.025, dest:musicBus});
    return 0.84;
  }
  if(kind === "dragon"){
    kick(time);
    noiseBurst({time, dur:0.4, freq:90, q:0.3, gain:0.08, type:"lowpass", dest:musicBus});
    padNote(time, 110, 1.05);
    padNote(time + 0.5, 130.81, 0.55);
    return 1.1;
  }
  if(kind === "road"){
    padNote(time, 130.81, 1.4);
    hat(time + 0.7);
    return 1.4;
  }
  padNote(time, 146.83, 1.8);
  padNote(time + 0.9, 196, 0.9);
  hat(time + 1.2);
  return 1.8;
}

function pauseBed(){
  if(bedTimer){
    clearTimeout(bedTimer);
    bedTimer = 0;
  }
}

function startBed(kind, force = false){
  if(!kind)return;
  const ac = audioContext();
  if(!ac || !prefs.music){
    currentBed = kind;
    return;
  }
  if(!force && currentBed === kind && bedTimer)return;
  pauseBed();
  currentBed = kind;
  const loop = () => {
    if(currentBed !== kind || !prefs.music)return;
    const step = scheduleBed(kind, now() + 0.02);
    bedTimer = window.setTimeout(loop, Math.max(80, step * 1000));
  };
  loop();
}

const MUSIC_BEDS = {
  "combat-theme": "combat",
  "start-combat-bed": "combat",
  "title-music": "keep",
  "settlement-loop": "keep",
  "road-loop": "road",
  "dragon-music": "dragon"
};

const STINGS = new Set(["victory-sting", "defeat-sting"]);

function handleIntent(intent){
  audioContext();
  if(MUSIC_BEDS[intent]){
    startBed(MUSIC_BEDS[intent]);
    return;
  }
  if(STINGS.has(intent)){
    pauseBed();
    currentBed = "";
    if(prefs.music)SFX[intent]?.();
    clearTimeout(stingTimer);
    stingTimer = window.setTimeout(() => {
      if(!currentBed)startBed("keep");
    }, 1100);
    return;
  }
  if(!prefs.sfx)return;
  if(SFX[intent])SFX[intent]();
}

export function getAudioPrefs(){
  return {...prefs};
}

export function setMusicEnabled(on){
  prefs.music = !!on;
  savePrefs();
  if(prefs.music)startBed(currentBed || "keep", true);
  else pauseBed();
}

export function setSfxEnabled(on){
  prefs.sfx = !!on;
  savePrefs();
}

export function toggleMasterMute(){
  const on = !(prefs.music || prefs.sfx);
  prefs.music = on;
  prefs.sfx = on;
  savePrefs();
  if(on)startBed(currentBed || "keep", true);
  else pauseBed();
  return on;
}

export function audioMuted(){
  return !prefs.music && !prefs.sfx;
}

function syncAudioButtons(){
  document.querySelectorAll("[data-action='audio-toggle']").forEach(btn => {
    const muted = audioMuted();
    btn.textContent = muted ? "🔇" : "♪";
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    btn.title = muted ? "Unmute" : "Mute";
  });
}

export function initAudioEngine(){
  window.addEventListener("fallen-empire-audio", event => {
    handleIntent(event?.detail?.intent || "ui-click");
  });
  const unlock = () => {
    audioContext();
    if(prefs.music)startBed(currentBed || "keep", true);
  };
  document.addEventListener("pointerdown", unlock, {once: true, passive: true});
  document.addEventListener("keydown", unlock, {once: true});
  window.addEventListener("btt:booted", () => syncAudioButtons());
  syncAudioButtons();
}
