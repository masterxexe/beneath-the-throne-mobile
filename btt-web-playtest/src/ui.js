import { currentScreen, load, pct, save, setScreen, slotInfo, state } from "./state.js";
import { getLanguage, setLanguage, title, tx } from "./language.js";
import { renderTown } from "./town.js";
import { renderGear } from "./gear.js";
import { renderParty } from "./party.js";
import { renderProgression, showPendingAbilityChoice, showPendingGrowthHint } from "./progression.js";
import { renderCombat, battle } from "./combat.js";
import { renderWorldHome, renderWorldKingdoms, renderWorldMap } from "./world.js";
import { renderPlayerHudPortrait } from "./portraitRenderer.js";

export function byId(id){return document.getElementById(id);}
export function esc(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
export function bar(value,max,cls=""){return `<div class="bar ${cls}"><div style="width:${pct(value,max)}%"></div></div>`;}

export function show(id){
  if(battle && id !== "combat"){
    toast(tx("combatInProgress"));
    return;
  }
  document.body.classList.toggle("cinematic-combat-active", id === "combat");
  document.body.classList.toggle("combat-dock-locked", id === "combat");
  if(id !== "home")document.body.classList.remove("cinematic-world-home-active");
  const previous = currentScreen;
  setScreen(id);
  const screens = document.querySelectorAll(".screen");
  const next = byId(id);
  const animate = previous && previous !== id && next;
  screens.forEach(screen=>{
    screen.classList.remove("active","screen-enter");
    if(animate && screen.id === previous)screen.classList.add("screen-leave");
  });
  if(animate){
    requestAnimationFrame(()=>{
      screens.forEach(screen=>screen.classList.remove("screen-leave"));
      next.classList.add("active","screen-enter");
      document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
        btn.classList.toggle("active", btn.dataset.screen === id);
      });
      render();
      window.scrollTo(0,0);
    });
    return;
  }
  screens.forEach(screen=>screen.classList.remove("screen-leave"));
  next?.classList.add("active");
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
    setTimeout(()=>{
      if(showPendingAbilityChoice())return;
      showPendingGrowthHint();
    },0);
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

function hudVitalClass(value, max){
  const ratio = max > 0 ? value / max : 0;
  if(ratio <= 0.25)return "is-critical";
  if(ratio <= 0.5)return "is-warn";
  return "";
}

export function updateTop(){
  if(!state?.hero || !byId("topStats"))return;
  const h = state.hero;
  const screen = currentScreen;
  const showSupplies = screen === "gear" || screen === "town" || screen === "party";
  applyUiTheme(h);
  updateNavLabels();
  byId("topStats").innerHTML = `
    <div class="top-status-hero">
      <div class="top-status-portrait">${renderPlayerHudPortrait(h, {supporterFrame:state.supporter?.equipped?.frame, supporterCloak:state.supporter?.equipped?.cloak})}</div>
      <div class="top-vital-readout" aria-label="${tx("hp")} ${h.hp}/${h.maxHp}, ${tx("mana")} ${h.mana}/${h.maxMana}, ${tx("xp")} ${h.xp}/${h.nextXp}">
        <div class="top-vital-line ${hudVitalClass(h.hp, h.maxHp)}">
          ${bar(h.hp, h.maxHp, "hp vital-hp")}
          <span class="top-vital-value">${h.hp}</span>
        </div>
        <div class="top-vital-line ${hudVitalClass(h.mana, h.maxMana)}">
          ${bar(h.mana, h.maxMana, "mana vital-mana")}
          <span class="top-vital-value">${h.mana}</span>
        </div>
        <div class="top-vital-line top-vital-xp" aria-label="${tx("xp")} ${h.xp}/${h.nextXp}">
          ${bar(h.xp, h.nextXp, "xp vital-xp")}
          <span class="top-vital-value">${h.xp}</span>
        </div>
      </div>
    </div>
    <div class="top-status-meta">
      <div class="top-status-pills top-pills-core">
        <span class="pill good hud-token hud-token-hero">${esc(h.name)} ${tx("level")} ${h.level}</span>
        ${state.supporter?.title ? `<span class="pill hud-token hud-token-founder">${esc(state.supporter.title)}</span>` : ""}
        <span class="pill hud-token hud-token-gold">${h.gold}g</span>
        ${showSupplies ? `
          <span class="pill hud-token hud-token-supply">${h.food} ${tx("food")}</span>
          <span class="pill hud-token hud-token-craft">${h.ore} ${tx("ore")}</span>
        ` : ""}
      </div>
    </div>
  `;
}

function applyUiTheme(hero){
  const body = document.body;
  const themes = ["ui-theme-ruined","ui-theme-imperial","ui-theme-holy","ui-theme-corrupted","ui-theme-nature","ui-theme-royal"];
  const classId = hero?.advancedClass || hero?.class || "survivor";
  const themeByClass = {
    warrior: "ui-theme-imperial",
    fighter: "ui-theme-imperial",
    guard: "ui-theme-imperial",
    mage: "ui-theme-corrupted",
    mystic: "ui-theme-corrupted",
    healer: "ui-theme-holy",
    hunter: "ui-theme-nature",
    ranger: "ui-theme-nature",
    rogue: "ui-theme-royal",
    scout: "ui-theme-nature"
  };
  body.classList.remove(...themes);
  body.classList.add(themeByClass[classId] || "ui-theme-ruined");
  body.dataset.heroClass = hero?.advancedClass || hero?.class || "survivor";
  body.dataset.heroLevel = String(hero?.level || 1);
  body.dataset.uiTier = hero?.level >= 20 ? "advanced" : hero?.level >= 10 ? "growing" : "initial";
  body.dataset.alignment = hero?.alignment || "neutral";
  body.dataset.kingdomProgression = state?.world?.kingdomProgression || "fallen";
  body.dataset.debugOverlays = typeof location !== "undefined" && new URLSearchParams(location.search).has("debugOverlays") ? "true" : "false";
}

function updateNavLabels(){
  const labels = {home:tx("home"),gear:tx("gear"),party:tx("party"),progression:tx("growth"),map:tx("map"),kingdoms:tx("kingdoms")};
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
    const label = labels[btn.dataset.screen] || btn.getAttribute("aria-label") || "";
    btn.setAttribute("aria-label", label);
    const text = btn.querySelector(".dock-label");
    if(text)text.textContent = label;
  });
  const saveBtn = document.querySelector("[data-action='save-slots']");
  if(saveBtn){
    saveBtn.setAttribute("aria-label", tx("save"));
    saveBtn.title = tx("save");
  }
  const ledgerBtn = document.querySelector("[data-action='court-ledger']");
  if(ledgerBtn){
    ledgerBtn.setAttribute("aria-label", tx("courtLedger"));
    ledgerBtn.title = tx("courtLedger");
  }
  const audioBtn = document.querySelector("[data-action='audio-toggle']");
  if(audioBtn){
    const muted = window.FE?.audioMuted?.() ?? false;
    audioBtn.textContent = muted ? "🔇" : "♪";
    audioBtn.classList.toggle("is-muted", muted);
    audioBtn.setAttribute("aria-label", muted ? tx("unmute") : tx("mute"));
    audioBtn.title = muted ? tx("unmute") : tx("mute");
  }
}

function saveSlotCount(){
  const owned = state?.supporter?.owned || [];
  return state?.supporter?.extraSlots || owned.includes("founder_pack") || owned.includes("ash_court_pass") ? 5 : 3;
}

export function showSaveSlots(mode){
  const saveMode = mode === "save";
  const slots = Array.from({length: saveSlotCount()}, (_, i) => i + 1);
  const body = slots.map(slot=>{
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
