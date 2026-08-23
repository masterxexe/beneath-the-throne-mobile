import { getLanguage, setLanguage } from "./language.js";
import { debugGrantCMXp, debugLevelTo, debugSetHeroHp } from "./state.js";
import { renderStart } from "./tutorials-v19d.js";
import { show, showSaveSlots } from "./ui.js";
import * as tutorials from "./tutorials-v19d.js";
import * as combat from "./combat.js";
import * as town from "./town.js";
import * as gear from "./gear.js";
import * as party from "./party.js";
import * as progression from "./progression.js";
import * as ui from "./ui.js";
import * as world from "./world.js";
import * as mapActivity from "./mapActivity.js";
import * as slumPrologue from "./slumPrologue.js";
import * as lowerWard from "./lowerWard.js";
import * as pwa from "./pwa.js";
import * as supporterStore from "./supporterStore.js";
import { initAudioEngine } from "./audioEngine.js";

setLanguage(getLanguage());

window.FE = {
  ...tutorials,
  ...combat,
  ...town,
  ...gear,
  ...party,
  ...progression,
  ...ui,
  ...world,
  ...mapActivity,
  ...slumPrologue,
  ...lowerWard,
  ...pwa,
  ...supporterStore,
  show,
  showSaveSlots
};

const debugMode = new URLSearchParams(location.search).has("debug");

if(debugMode){
  window.FE.debugLevelTo = level => {
    debugLevelTo(level);
    ui.render();
  };
  window.FE.debugGrantCMXp = amount => {
    debugGrantCMXp(amount);
    ui.render();
  };
  window.FE.debugSetHeroHp = value => {
    debugSetHeroHp(value);
    ui.render();
  };
  window.FE.debugBootCombatLayoutTest = (enemyCount = 3, companionCount = 2) => {
    tutorials.startActualGame("Xexe","warrior");
    setTimeout(()=>window.FE.debugStartCombatLayoutTest?.(enemyCount, companionCount),80);
  };
}

document.addEventListener("click", event => {
  const screenButton = event.target.closest("[data-screen]");
  if(screenButton){
    show(screenButton.dataset.screen);
    return;
  }
  const saveButton = event.target.closest("[data-action='save-slots']");
  if(saveButton)showSaveSlots("save");
  const appUpdateButton = event.target.closest("[data-action='app-update']");
  if(appUpdateButton)window.FE.showAppUpdatePanel?.();
});

renderStart();
if(debugMode)installDebugBootControls();
window.__BTT_BOOTED = true;
window.dispatchEvent(new Event("btt:booted"));
pwa.initPwa();
initAudioEngine();
mapActivity.startMapActivityLoop(world.WORLD_LOCATIONS);

function installDebugBootControls(){
  setTimeout(()=>{
    const setup = document.querySelector("#setup");
    if(!setup || setup.style.display === "none" || setup.querySelector(".debug-boot-controls"))return;
    const panel = document.createElement("div");
    panel.className = "debug-boot-controls panel";
    panel.innerHTML = `
      <h3>Debug Boot</h3>
      <div class="grid3">
        <button onclick="FE.debugBootCombatLayoutTest(1,0)">1v1</button>
        <button onclick="FE.debugBootCombatLayoutTest(2,1)">1v2</button>
        <button onclick="FE.debugBootCombatLayoutTest(3,2)">2v3</button>
      </div>
      <div class="grid3" style="margin-top:8px">
        <button onclick="FE.debugBootSlumScene()">Slums</button>
        <button onclick="FE.debugBootLowerWard()">Lower Ward</button>
        <button onclick="FE.debugStartEnemyVisualTest('cultist')">Cultist</button>
      </div>
    `;
    setup.appendChild(panel);
  },0);
}
