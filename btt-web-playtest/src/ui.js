import { currentScreen, load, pct, save, setScreen, slotInfo, state } from "./state.js";
import { getLanguage, setLanguage, title, tx } from "./language.js";
import { renderTown } from "./town.js";
import { renderGear } from "./gear.js";
import { renderParty } from "./party.js";
import { renderProgression, showPendingAbilityChoice } from "./progression.js";
import { renderCombat, battle } from "./combat.js";
import { renderWorldHome, renderWorldKingdoms, renderWorldMap } from "./world.js";
import { renderPlayerHudPortrait } from "./portraitRenderer.js";

export function byId(id){return document.getElementById(id);}
export function esc(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
export function bar(value,max,cls=""){return `<div class="bar ${cls}"><div style="width:${pct(value,max)}%"></div></div>`;}

export function show(id){
  if(battle && id !== "combat"){
    toast("You are in combat. Use Run to escape.");
    return;
  }
  document.body.classList.toggle("cinematic-combat-active", id === "combat");
  document.body.classList.toggle("combat-dock-locked", id === "combat");
  if(id !== "home")document.body.classList.remove("cinematic-world-home-active");
  setScreen(id);
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId(id)?.classList.add("active");
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.screen === id);
  });
  render();
  window.scrollTo(0,0);
  setTimeout(()=>window.scrollTo(0,0),0);
}

export function startGame(){
  document.body.classList.add("game-lock");
  document.body.classList.remove("start-lock");
  byId("setup").style.display = "none";
  byId("game").style.display = "block";
  show("home");
}

export function render(){
  if(!state)return;
  updateTop();
  if(currentScreen==="home"){
    renderWorldHome();
    setTimeout(()=>showPendingAbilityChoice(),0);
  }
  if(currentScreen==="town")renderTown();
  if(currentScreen==="gear")renderGear();
  if(currentScreen==="party")renderParty();
  if(currentScreen==="progression")renderProgression();
  if(currentScreen==="map")renderWorldMap();
  if(currentScreen==="kingdoms")renderWorldKingdoms();
  if(currentScreen==="support")window.FE?.renderSupport?.();
  if(currentScreen==="combat")renderCombat();
}

export function updateTop(){
  const h = state.hero;
  const p = state.prologue;
  applyUiTheme(h);
  updateNavLabels();
  byId("topStats").innerHTML = `
    <div class="top-status-portrait">${renderPlayerHudPortrait(h)}</div>
    <div class="top-status-pills">
      <span class="pill good hud-token hud-token-hero">${esc(h.name)} ${tx("level")} ${h.level}</span>
      <span class="pill hud-token hud-token-class">${title(h.class)}</span>
      <span class="pill hud-token hud-token-vital">${tx("hp")} ${h.hp}/${h.maxHp}</span>
      <span class="pill hud-token hud-token-mana">${tx("mana")} ${h.mana}/${h.maxMana}</span>
      <span class="pill hud-token hud-token-gold">${tx("gold")} ${h.gold}</span>
      <span class="pill hud-token hud-token-supply">${tx("food")} ${h.food}</span>
      <span class="pill hud-token hud-token-craft">${tx("ore")} ${h.ore}</span>
      <span class="pill hud-token hud-token-potion">${tx("healthPotions")} ${h.potions}</span>
      <span class="pill hud-token hud-token-potion">${tx("manaPotions")} ${h.manaPotions}</span>
      <span class="pill hud-token hud-token-day">${tx("day")} ${state.world.day}</span>
      ${p?.phase === "active" ? `
        <span class="pill warn hud-token">Rep ${p.status}/${p.statusGoal}</span>
        <span class="pill hud-token">Safety ${p.safety}</span>
        <span class="pill red hud-token">Danger ${p.danger}</span>
      ` : p?.lowerWardGate?.unlocked ? `
        <span class="pill good hud-token">Lower Ward Gate</span>
        <span class="pill hud-token">Ward Influence ${state.world?.lowerWard?.influence || 0}</span>
      ` : ""}
    </div>
  `;
}

function applyUiTheme(hero){
  const body = document.body;
  const themes = ["ui-theme-ruined","ui-theme-imperial","ui-theme-holy","ui-theme-corrupted","ui-theme-nature","ui-theme-royal"];
  body.classList.remove(...themes);
  body.classList.add("ui-theme-ruined");
  body.dataset.heroClass = hero?.advancedClass || hero?.class || "survivor";
  body.dataset.heroLevel = String(hero?.level || 1);
  body.dataset.uiTier = hero?.level >= 20 ? "advanced" : hero?.level >= 10 ? "growing" : "initial";
  body.dataset.alignment = hero?.alignment || "neutral";
  body.dataset.kingdomProgression = state?.world?.kingdomProgression || "fallen";
  body.dataset.debugOverlays = typeof location !== "undefined" && new URLSearchParams(location.search).has("debugOverlays") ? "true" : "false";
}

function updateNavLabels(){
  const labels = {home:tx("home"),gear:tx("gear"),party:tx("party"),progression:tx("progression"),map:tx("map"),kingdoms:tx("kingdoms")};
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
    btn.textContent = labels[btn.dataset.screen] || btn.textContent;
  });
  const saveBtn = document.querySelector("[data-action='save-slots']");
  if(saveBtn)saveBtn.textContent = tx("save");
  const updateBtn = document.querySelector("[data-action='app-update']");
  if(updateBtn && !updateBtn.classList.contains("app-update-ready"))updateBtn.textContent = "Update";
}

export function showSaveSlots(mode){
  const saveMode = mode === "save";
  const body = [1,2,3].map(slot=>{
    const info = slotInfo(slot);
    let text = tx("emptySlot");
    if(info===false)text = tx("damagedSave");
    if(info && info.hero)text = `<b>${esc(info.hero.name)}</b><br>Lv ${info.hero.level} ${title(info.hero.class)}<br>${tx("gold")} ${info.hero.gold} | ${tx("day")} ${info.world.day}`;
    return `<div class="card"><h3>Slot ${slot}</h3><p>${text}</p><button class="primary" onclick="FE.${saveMode?"saveToSlot":"loadFromSlot"}(${slot})">${saveMode?tx("save"):tx("load")} Slot ${slot}</button></div>`;
  }).join("");
  modal(saveMode?tx("save"):tx("load"), body, [{label:tx("close"),cls:"secondary"}]);
}

export function saveToSlot(slot){
  save(slot);
  closeModals();
  toast("Saved.");
}

export function loadFromSlot(slot){
  if(!load(slot)){
    toast(tx("noSave"));
    return;
  }
  closeModals();
  startGame();
}

export function modal(titleText, body, buttons=[{label:"Close",cls:"secondary"}]){
  closeModals();
  const div = document.createElement("div");
  div.className = "modal-back";
  div.innerHTML = `<div class="modal"><h2>${esc(titleText)}</h2><div>${body}</div><div class="grid2" id="modalButtons"></div></div>`;
  document.body.appendChild(div);
  const root = div.querySelector("#modalButtons");
  buttons.forEach(btn=>{
    const el = document.createElement("button");
    el.textContent = btn.label;
    el.className = btn.cls || "primary";
    el.addEventListener("click",()=>{
      if(btn.fn)btn.fn();
      closeModals();
    });
    root.appendChild(el);
  });
}

export function closeModals(){
  document.querySelectorAll(".modal-back").forEach(x=>x.remove());
}

export function toast(text){
  document.querySelectorAll(".toast").forEach(x=>x.remove());
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),1800);
}

export function changeGameLanguage(lang){
  setLanguage(lang);
  if(state)state.settings.language = getLanguage();
  render();
}
