import { tx } from "./language.js";
import { playAudioHook } from "./audioHooks.js";

let activeTransition = null;

export function playEncounterTransition({title, body} = {}){
  if(activeTransition)return activeTransition;
  playAudioHook("encounter-warning");
  playAudioHook("sand-ash-transition");
  activeTransition = new Promise(resolve=>{
    document.querySelectorAll(".encounter-transition").forEach(element=>element.remove());
    const overlay = document.createElement("div");
    overlay.className = "encounter-transition";
    overlay.innerHTML = `
      <div class="encounter-ash encounter-ash-a"></div>
      <div class="encounter-ash encounter-ash-b"></div>
      <div class="encounter-smoke"></div>
      <div class="encounter-warning">
        <h2>${escapeHTML(title || tx("travelAmbush"))}</h2>
        <p>${escapeHTML(body || tx("travelAmbushBody"))}</p>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.getBoundingClientRect();
    requestAnimationFrame(()=>{
      setTimeout(()=>{
        overlay.classList.add("is-ending");
        setTimeout(()=>{
          overlay.remove();
          activeTransition = null;
          playAudioHook("battle-music-start");
          resolve();
        },650);
      },4300);
    });
  });
}

function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
