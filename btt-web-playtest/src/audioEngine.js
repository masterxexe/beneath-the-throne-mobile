/** Lightweight audio stub — plays subtle WebAudio tones until real assets ship. */
const ENABLED = true;
let ctx = null;

const TONES = {
  "threat-warning": {freq: 220, dur: 0.18, type: "sawtooth", gain: 0.04},
  "transition-whoosh": {freq: 90, dur: 0.35, type: "sine", gain: 0.03},
  "combat-theme": {freq: 146, dur: 0.5, type: "triangle", gain: 0.025},
  "victory-sting": {freq: 392, dur: 0.28, type: "sine", gain: 0.035},
  "defeat-sting": {freq: 98, dur: 0.4, type: "sawtooth", gain: 0.03},
  "settlement-loop": {freq: 165, dur: 0.6, type: "sine", gain: 0.02},
  "road-loop": {freq: 131, dur: 0.55, type: "triangle", gain: 0.018},
  "start-combat-bed": {freq: 110, dur: 0.45, type: "sine", gain: 0.028}
};

function audioContext(){
  if(!ENABLED)return null;
  if(!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC)return null;
    ctx = new AC();
  }
  if(ctx.state === "suspended")ctx.resume().catch(()=>{});
  return ctx;
}

function playTone({freq = 220, dur = 0.2, type = "sine", gain = 0.03} = {}){
  const ac = audioContext();
  if(!ac)return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}

export function initAudioEngine(){
  window.addEventListener("fallen-empire-audio", event => {
    const intent = event?.detail?.intent || "generic";
    const tone = TONES[intent];
    if(tone)playTone(tone);
  });
  document.addEventListener("pointerdown", () => audioContext(), {once: true, passive: true});
}
