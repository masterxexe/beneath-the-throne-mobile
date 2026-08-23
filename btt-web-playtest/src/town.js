import { advanceDays, companionRoleDefinition, companionWage, makeLoot, partyFoodCost, partyLimit, partyWageCost, region, rnd, save, setScreen, state } from "./state.js";
import { title, tx } from "./language.js";
import { byId, esc, modal, toast, updateTop } from "./ui.js";
import { makeCompanion } from "./party.js";
import { currentLocation, locationName, locationServices } from "./world.js";
import { locationArtClass, resolveLocationArt } from "./locationArt.js";
import { resolveInteriorScene, serviceLabel } from "./interiorScenes.js";
import { clearServiceEvents, ensureSceneStores, resolveDailyServiceEvent, serviceUpgradeState, setServiceEvent, setServiceUpgrade } from "./locationEvents.js";
import { npcLine } from "./npcRegistry.js";
import { sceneActionButtonHTML, sceneAnchorHTML, sceneEffectHTML } from "./sceneInteractions.js";
import { playAudioHook } from "./audioHooks.js";

const TABS = ["market","blacksmith","inn","tavern","mine"];
const SCENE_SERVICES = ["market","blacksmith","inn","tavern","townCenter","mine"];
const GEAR_SLOTS = ["weapon","offhand","helmet","chest","shoulders","legs","boots","ring"];
const TOWN_SERVICE_GROUPS = [
  {
    id:"commerce",
    label:"Trade & Forge",
    lead:"Supplies, gear stock, equipped upgrades, and ore work.",
    services:["market","blacksmith","mine"]
  },
  {
    id:"shelter",
    label:"Rest & People",
    lead:"Healing, camp rest, recruits, and rumors.",
    services:["inn","tavern"]
  },
  {
    id:"civic",
    label:"Town Matters",
    lead:"Ledger, notices, refugees, and settlement state.",
    services:["townCenter"]
  },
  {
    id:"road",
    label:"Road",
    lead:"Map routes and outside danger.",
    services:["map"]
  }
];
const HEALTH_POTION_COST = 12;
const MANA_POTION_COST = 14;
const FOOD_COST = 4;
const FOOD_AMOUNT = 2;
const MARKET_REROLL_COST = 10;
const TAVERN_REROLL_COST = 10;
const MINE_DAYS = 5;

let townTab = "market";
let activeScene = null;
let lastResolvedScene = null;

export function renderTown(){
  if(activeScene?.service){
    renderServiceScene();
    return;
  }
  const tabs = availableTabs();
  if(!tabs.includes(townTab))townTab = tabs[0] || "inn";
  byId("town").innerHTML = `
    <div class="panel">
      ${townServiceHeroHTML()}
      <button class="secondary world-return" onclick="FE.show('home')">${tx("backToLocation")}</button>
    </div>
    ${resourcesHTML()}
    ${townHubHTML({currentService:townTab})}
    ${tabs.length ? serviceHTML(townTab) : `<div class="panel"><p>${tx("noServicesHere")}</p></div>`}
  `;
}

function townServiceHeroHTML(){
  const loc = currentLocation();
  const artState = state.world.locationStates?.[loc.id];
  const art = resolveLocationArt(loc, artState);
  const stateClass = locationArtClass(artState);
  return `
    <div class="town-service-hero ${esc(stateClass)}" style="--town-art:url('${esc(art)}')">
      <div>
        <span class="pill">${tx("locationServices")}: ${esc(locationName())}</span>
        <h1>${tx(townTab)}</h1>
      </div>
    </div>
  `;
}

function refreshTown(){
  updateTop();
  renderTown();
}

export function showTownTab(tab){
  const tabs = availableTabs();
  if(!tabs.includes(tab))return toast(tx("serviceUnavailable"));
  townTab = tab;
  renderTown();
}

export function openTownService(tab){
  const tabs = availableTabs();
  if(!tabs.includes(tab))return toast(tx("serviceUnavailable"));
  townTab = tab;
  if(SCENE_SERVICES.includes(tab)){
    activeScene = {service:tab, phase:"scene", selected:null, result:"", serviceMenu:false};
    playAudioHook("town-ambience", {service:tab, location:currentLocation().id});
  }else{
    activeScene = null;
  }
  setScreen("town");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("town")?.classList.add("active");
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>btn.classList.remove("active"));
  updateTop();
  renderTown();
  window.scrollTo(0,0);
  setTimeout(()=>window.scrollTo(0,0),0);
}

export function openTownCenter(){
  townTab = "townCenter";
  activeScene = {service:"townCenter", phase:"scene", selected:null, result:"", serviceMenu:false};
  playAudioHook("town-ambience", {service:"townCenter", location:currentLocation().id});
  setScreen("town");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("town")?.classList.add("active");
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>btn.classList.remove("active"));
  updateTop();
  renderTown();
  window.scrollTo(0,0);
  setTimeout(()=>window.scrollTo(0,0),0);
}

export function openTownServiceGroup(groupId){
  if(groupId === "road"){
    activeScene = null;
    window.FE?.show?.("map");
    return;
  }
  const group = TOWN_SERVICE_GROUPS.find(item=>item.id === groupId);
  if(!group)return toast(tx("serviceUnavailable"));
  const services = locationServices();
  if(groupId === "shelter" && services.includes("inn") && services.includes("tavern")){
    modal("Rest & People", `<p>Choose the town service you need. The main town hub keeps these together, but the inn and tavern still do different work.</p>`, [
      {label:"Inn: Rest",cls:"primary",fn:()=>openTownService("inn")},
      {label:"Tavern: Recruits",cls:"secondary",fn:()=>openTownService("tavern")},
      {label:"Close",cls:"secondary"}
    ]);
    return;
  }
  const service = group.services.find(item=>item === "townCenter" || services.includes(item));
  if(!service)return toast(tx("serviceUnavailable"));
  if(service === "townCenter")return openTownCenter();
  openTownService(service);
}

export function continueServiceEntry(){
  if(!activeScene?.service)return;
  activeScene.phase = "scene";
  renderTown();
}

export function leaveServiceScene(){
  activeScene = null;
  window.FE?.show ? window.FE.show("home") : null;
}

function availableTabs(){
  return locationServices().filter(tab=>TABS.includes(tab));
}

function renderServiceScene(){
  const loc = currentLocation();
  ensureSceneStores(state);
  const event = resolveDailyServiceEvent({state, location:loc, service:activeScene.service});
  const upgrade = serviceUpgradeState(state, loc.id, activeScene.service);
  const scene = resolveInteriorScene({
    location:loc,
    service:activeScene.service,
    worldState:state.world.locationStates?.[loc.id],
    upgradeState:upgrade,
    event
  });
  lastResolvedScene = scene;
  if(activeScene.phase === "entry"){
    byId("town").innerHTML = `
      <div class="panel service-entry-panel">
        <h1>${esc(scene.label)}</h1>
        <p>${esc(scene.entry)}</p>
        <p class="muted">${esc(event.text)}</p>
        <div class="grid2">
          <button class="primary" onclick="FE.continueServiceEntry()">Enter</button>
          <button class="secondary" onclick="FE.leaveServiceScene()">${tx("backToLocation")}</button>
        </div>
      </div>
    `;
    return;
  }
  byId("town").innerHTML = `
    <div class="panel populated-scene-shell location-upgrade-${esc(scene.upgradeState)} ${esc(scene.stateClass)}">
      <div class="populated-scene-head">
        <div>
          <span class="pill">${esc(locationName())}</span>
          <h1>${esc(scene.label)}</h1>
          <p>${esc(scene.entry)}</p>
        </div>
        <button class="secondary" onclick="FE.leaveServiceScene()">${tx("backToLocation")}</button>
      </div>
      <div class="populated-scene populated-scene-${esc(activeScene.service)} populated-scene-${esc(scene.mood)}" style="--interior-art:url('${esc(scene.art)}')">
        <div class="populated-scene-vignette"></div>
        <div class="scene-ambient-layer" data-effect-count="${scene.effects.length}">
          ${scene.effects.map(sceneEffectHTML).join("")}
        </div>
        ${sceneAnchors(scene).map(sceneAnchorHTML).join("")}
      </div>
      <div class="grid scene-lower-grid">
        ${sceneDialogueHTML(scene)}
        ${activeScene.serviceMenu ? sceneServicePanelHTML(scene, sceneAnchorById(scene, activeScene.selected)) : sceneEventHTML(event)}
      </div>
      ${townHubHTML({currentService:activeScene.service, compact:true})}
    </div>
  `;
}

function sceneAnchors(scene){
  if(scene.service !== "tavern")return [...scene.anchors, ...companionSceneAnchors(scene)];
  rollTavern();
  const recruitAnchors = state.tavern.recruits.slice(0,3).map((recruit,i)=>({
    id:recruit.id,
    type:"npc",
    interactionType:"recruit",
    name:recruit.name,
    x:[44,62,78][i] || 62,
    y:[64,58,63][i] || 60,
    line:recruitFlavorLine(recruit,i),
    recruit,
    model:recruit.sceneModel || recruit.sprite || "",
    pose:recruit.scenePose || "idle",
    state:"available",
    hoverLabel:`Speak with ${recruit.name}`,
    idleMotion:"breathe",
    presenceAnimation:"soft",
    hoverAnimation:"warm",
    shadow:true,
    actions:["recruit"]
  }));
  return [scene.anchors[0], ...recruitAnchors, ...scene.anchors.slice(1), ...companionSceneAnchors(scene)];
}

function companionSceneAnchors(scene){
  const companions = state.hero.companions.filter(c=>c.active).slice(0,2);
  const placements = scene.service === "tavern"
    ? [{x:35,y:70},{x:86,y:69}]
    : [{x:18,y:68},{x:88,y:68}];
  return companions.map((companion,i)=>({
    id:`companion_${companion.id}`,
    type:"npc",
    interactionType:"companion",
    npcCategory:"companion",
    name:companion.name,
    x:placements[i]?.x || 18,
    y:placements[i]?.y || 68,
    scale:.9,
    depth:4,
    pose:"waiting",
    presenceClass:"presence-steel",
    hoverLabel:`Check on ${companion.name}`,
    line:`${companion.name} keeps close enough to watch the room and the exits.`,
    idleMotion:"breathe",
    presenceAnimation:"soft",
    hoverAnimation:"presence",
    actions:["rumor"]
  }));
}

function sceneAnchorById(scene,id){
  return sceneAnchors(scene).find(anchor=>anchor.id === id) || sceneAnchors(scene)[0];
}

function sceneDialogueHTML(scene){
  const anchor = activeScene.selected ? sceneAnchorById(scene, activeScene.selected) : sceneAnchors(scene)[0];
  const recruit = anchor?.recruit;
  return `
    <div class="panel scene-dialogue-panel">
      <div class="scene-dialogue-title">
        <span>${esc(anchor?.type === "npc" ? "Conversation" : "Interaction")}</span>
        <h2>${esc(anchor?.name || scene.label)}</h2>
      </div>
      <p>${esc(anchor?.line || "The room waits for your choice.")}</p>
      ${recruit ? recruitSceneHTML(recruit) : ""}
      ${activeScene.result ? `<p class="scene-result">${esc(activeScene.result)}</p>` : ""}
      <div class="grid2">
        ${(anchor?.actions || ["serviceMenu"]).map(action=>sceneActionButtonHTML(action, anchor.id)).join("")}
        ${recruit ? `<button class="secondary" onclick="FE.closeScenePanel()">Back</button>` : ""}
      </div>
    </div>
  `;
}

function sceneEventHTML(event){
  return `
    <div class="panel scene-event-panel">
      <h2>Current Event</h2>
      <p>${esc(event.text)}</p>
      <p class="muted">Events remain stable for this service and day.</p>
    </div>
  `;
}

function sceneServicePanelHTML(scene, anchor){
  return `
    <div class="panel scene-service-menu scene-service-menu-${esc(scene.service)}">
      <div class="scene-service-context">
        <span class="pill">${esc(anchor?.type === "npc" ? "In-world service" : "Scene object")}</span>
        <h2>${esc(servicePanelTitle(scene.service, anchor))}</h2>
        <p>${esc(servicePanelLead(scene.service, anchor))}</p>
      </div>
      ${serviceHTML(scene.service, anchor)}
    </div>
  `;
}

function servicePanelTitle(service, anchor){
  const name = anchor?.name || serviceLabel(service);
  const titles = {
    market: `${name}: Trade`,
    blacksmith: `${name}: Forge Work`,
    inn: `${name}: Rest and Shelter`,
    tavern: `${name}: Tavern Business`,
    townCenter: `${name}: Civic Matters`,
    mine: `${name}: Ore Gathering`
  };
  return titles[service] || `${name}: Services`;
}

function servicePanelLead(service, anchor){
  const name = anchor?.name || serviceLabel(service);
  const leads = {
    market: `You handle trade through ${name}, keeping the market's noise and risk around you.`,
    blacksmith: `You work through ${name}, spending only the gold and ore the existing forge rules require.`,
    inn: `You settle matters with ${name}; rest, camp, healing, and time still use the existing inn logic.`,
    tavern: `You keep tavern business grounded in the room. Recruits remain visible NPCs in the scene.`,
    townCenter: `You inspect ${name} for current civic hooks without starting a new town-management system.`,
    mine: `You work the cut with ${name}. Ore gathering still uses the existing five-day mining rules.`
  };
  return leads[service] || `You focus on ${name}.`;
}

function recruitSceneHTML(companion){
  const cost = recruitCost(companion);
  return `
    <div class="scene-character-dossier">
      <div class="scene-character-presence" aria-hidden="true"></div>
      <div>
        <div class="scene-character-tags">
          <span class="pill">${esc(companion.rarity)}</span>
          <span class="pill">${esc(companionRoleDefinition(companion.role || companion.class).name)}</span>
          <span class="pill">${tx("level")} ${companion.level}</span>
          <span class="pill warn">${tx("monthlyWages")} ${companionWage(companion)}g</span>
        </div>
        <p>${tx("hp")} ${companion.hp}/${companion.maxHp} | Atk ${companion.attack} | Def ${companion.defense}</p>
        <p class="scene-hire-cost">Hire cost: ${cost}g</p>
      </div>
    </div>
  `;
}

function recruitFlavorLine(companion,index = 0){
  const rarity = companion.rarity || "common";
  const lines = {
    common: [
      `${companion.name} watches the room with the practical caution of someone who has survived bad roads.`,
      `${companion.name} sits near the candle smoke, gear packed and ready for work.`
    ],
    uncommon: [
      `${companion.name} has the look of a seasoned traveler waiting for the right company.`,
      `${companion.name} studies you over a chipped cup, measuring risk against coin.`
    ],
    rare: [
      `${companion.name} keeps to the shadowed corner, too composed for an ordinary sellsword.`,
      `The room gives ${companion.name} a little space. That usually means skill, trouble, or both.`
    ],
    epic: [
      `${companion.name} carries old scars and older confidence. Even the barkeep speaks carefully nearby.`
    ],
    legendary: [
      `Whispers bend around ${companion.name}. Someone like this does not wait in a tavern by accident.`
    ]
  };
  const pool = lines[rarity] || lines.common;
  return pool[index % pool.length];
}

export function closeScenePanel(){
  if(!activeScene?.service)return;
  activeScene.selected = null;
  activeScene.result = "";
  activeScene.serviceMenu = false;
  renderTown();
}

function sceneServiceName(service){
  return serviceLabel(service);
}

export function selectSceneAnchor(id){
  if(!activeScene?.service)return;
  activeScene.selected = id;
  activeScene.serviceMenu = false;
  activeScene.result = "";
  renderTown();
}

export function runSceneAction(action,id){
  if(!activeScene?.service)return;
  activeScene.selected = id;
  activeScene.serviceMenu = false;
  if(action === "serviceMenu"){
    activeScene.serviceMenu = true;
    renderTown();
    return;
  }
  if(action === "recruit"){
    const hired = hireRecruit(id);
    activeScene.selected = null;
    activeScene.result = hired?.ok
      ? `${hired.name} gathers their kit and joins your party.`
      : hired?.message || "That recruit is no longer available.";
    renderTown();
    return;
  }
  if(action === "buyFood"){
    buyFood();
    activeScene.result = "You buy what food the stall can spare.";
    renderTown();
    return;
  }
  if(action === "rest"){
    restInn();
    activeScene.result = "You take a room and let the road fall away for a night.";
    renderTown();
    return;
  }
  if(action === "camp"){
    camp();
    activeScene.result = "You make do with a corner, a cloak, and a little food.";
    renderTown();
    return;
  }
  if(action === "chaseThief"){
    activeScene.result = resolveMarketThief();
    save();
    updateTop();
    renderTown();
    return;
  }
  if(action === "aidRefugees"){
    const cost = Math.min(2,state.hero.food);
    if(cost){
      state.hero.food -= cost;
      activeScene.result = `You share ${cost} food. The refugees murmur thanks around the brazier.`;
      state.world.story.push(`Town Center: helped refugees with ${cost} food.`);
      save();
      updateTop();
    }else{
      activeScene.result = "You have no food to spare.";
    }
    renderTown();
    return;
  }
  if(action === "townLedger"){
    activeScene.result = townLedgerResult();
    state.world.story.push(`Town Center: ${activeScene.result}`);
    save();
    renderTown();
    return;
  }
  if(action === "townNotice"){
    activeScene.result = townNoticeResult();
    state.world.story.push(`Town Center: ${activeScene.result}`);
    save();
    renderTown();
    return;
  }
  const seed = state.world.day + String(id || action).length;
  activeScene.result = npcLine(action, seed);
  state.world.story.push(`${sceneServiceName(activeScene.service)}: ${activeScene.result}`);
  save();
  renderTown();
}

function townLedgerResult(){
  const loc = currentLocation();
  const services = locationServices(loc.id).map(serviceLabel).join(", ") || "no formal services";
  const danger = Number(loc.danger || 0);
  return `The ledger records ${services}. Local danger is marked ${danger}, with space left for future prosperity and faction changes.`;
}

function townNoticeResult(){
  const event = resolveDailyServiceEvent({state, location:currentLocation(), service:"townCenter"});
  return `The notice board repeats today's civic concern: ${event.text}`;
}

function resolveMarketThief(){
  const speed = Number(state.hero.speed || state.hero.stats?.speed || 0);
  const roll = rnd(1,20) + speed;
  const stolen = Math.min(state.hero.gold, rnd(6,18));
  state.world.story.push("A thief bolts through the market with your coin pouch.");
  if(roll >= 15){
    const reward = Math.max(stolen, rnd(8,20));
    state.hero.gold += Math.floor(reward / 2);
    const text = `Speed roll ${roll} succeeded. You caught the thief and recovered ${reward} gold.`;
    state.world.story.push(text);
    return text;
  }
  state.hero.gold = Math.max(0,state.hero.gold - stolen);
  const text = `Speed roll ${roll} failed. The thief vanishes with ${stolen} gold.`;
  state.world.story.push(text);
  return text;
}

export function debugEnterScene(service = "tavern"){
  if(service === "town")service = "townCenter";
  activeScene = {service, phase:"scene", selected:null, result:"", serviceMenu:false};
  setScreen("town");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("town")?.classList.add("active");
  updateTop();
  renderTown();
}

export function debugSetLocationEvent(locationId = currentLocation().id, service = activeScene?.service || townTab || "tavern", eventId = "bar_fight"){
  setServiceEvent(state, locationId, service, eventId);
  save();
  renderTown();
}

export function debugClearLocationEvents(){
  clearServiceEvents(state);
  save();
  renderTown();
}

export function debugSetServiceUpgrade(locationId = currentLocation().id, service = activeScene?.service || townTab || "tavern", upgradeState = "improved"){
  setServiceUpgrade(state, locationId, service, upgradeState);
  save();
  renderTown();
}

export function debugTavernRecruits(){
  rollTavern();
  return state.tavern.recruits.map(recruit=>({
    id:recruit.id,
    name:recruit.name,
    rarity:recruit.rarity,
    level:recruit.level,
    wage:companionWage(recruit),
    cost:recruitCost(recruit)
  }));
}

export function debugSceneAnchors(){
  if(!activeScene?.service)return [];
  const loc = currentLocation();
  const scene = lastResolvedScene || resolveInteriorScene({
    location:loc,
    service:activeScene.service,
    worldState:state.world.locationStates?.[loc.id],
    upgradeState:serviceUpgradeState(state, loc.id, activeScene.service),
    event:resolveDailyServiceEvent({state, location:loc, service:activeScene.service})
  });
  return sceneAnchors(scene).map(anchor=>({
    id:anchor.id,
    name:anchor.name,
    type:anchor.type,
    interactionType:anchor.interactionType || anchor.type,
    npcCategory:anchor.npcCategory || anchor.role || anchor.interactionType || anchor.type,
    x:anchor.x,
    y:anchor.y,
    scale:anchor.scale || 1,
    depth:anchor.depth || 4,
    pose:anchor.pose || "idle",
    presenceClass:anchor.presenceClass || "",
    idleMotion:anchor.idleMotion || "",
    presenceAnimation:anchor.presenceAnimation || "",
    hoverAnimation:anchor.hoverAnimation || "",
    shadow:anchor.shadow !== false,
    hoverLabel:anchor.hoverLabel || anchor.name,
    actions:[...(anchor.actions || [])]
  }));
}

export function debugSceneEffects(){
  if(!activeScene?.service)return [];
  const loc = currentLocation();
  const scene = lastResolvedScene || resolveInteriorScene({
    location:loc,
    service:activeScene.service,
    worldState:state.world.locationStates?.[loc.id],
    upgradeState:serviceUpgradeState(state, loc.id, activeScene.service),
    event:resolveDailyServiceEvent({state, location:loc, service:activeScene.service})
  });
  return (scene.effects || []).map(effect=>({
    id:effect.id,
    type:effect.type,
    x:effect.x,
    y:effect.y,
    width:effect.width,
    height:effect.height,
    intensity:effect.intensity,
    depth:effect.depth,
    duration:effect.duration,
    opacity:effect.opacity,
    className:effect.className || "",
    reducedMotion:effect.reducedMotion || "soften"
  }));
}

export function debugRefreshTavernScene(){
  state.tavern.day = -1;
  state.tavern.recruits = [];
  rollTavern();
  if(activeScene?.service === "tavern"){
    activeScene.selected = null;
    activeScene.result = "New faces drift into the tavern smoke.";
    activeScene.serviceMenu = false;
  }
  save();
  renderTown();
}

function serviceHTML(tab, contextAnchor = null){
  let html = "";
  if(tab==="market" || tab==="blacksmith")html = commerceHTML(tab);
  if(tab==="inn")html = innHTML();
  if(tab==="tavern")html = tavernHTML();
  if(tab==="townCenter")html = townCenterHTML();
  if(tab==="mine")html = mineHTML();
  if(html)return `${serviceContextHTML(tab, contextAnchor)}${html}${returnToLocationHTML()}`;
  return "";
}

function serviceContextHTML(tab, contextAnchor){
  if(!contextAnchor)return "";
  const copy = {
    market: "Trade and forge work now share one commerce surface while preserving the existing stock, purchase, and upgrade rules.",
    blacksmith: "Forge work and market trade now share one commerce surface while preserving the existing gold and ore costs.",
    inn: "Rest and camp still use the existing gold, food, healing, and day-advance rules.",
    tavern: "Recruit hiring still happens through visible tavern NPCs and the existing party economy.",
    townCenter: "Civic interactions are lightweight hooks for the current town state and daily events.",
    mine: "Ore gathering still uses the existing day cost, ore payout, and blacksmith upgrade flow."
  };
  return `
    <div class="scene-service-note">
      <span class="pill">${esc(contextAnchor.name)}</span>
      <p>${esc(copy[tab] || "Existing service rules are preserved.")}</p>
    </div>
  `;
}

function townHubHTML({currentService = "", compact = false} = {}){
  const groups = availableTownServiceGroups();
  if(!groups.length)return "";
  return `
    <div class="panel town-hub-panel ${compact ? "town-hub-compact" : ""}">
      <div class="town-hub-head">
        <div>
          <span class="pill">${tx("services")}</span>
          <h2>Town Hub</h2>
        </div>
        <p>Grouped actions keep the town readable while the old systems keep working underneath.</p>
      </div>
      <div class="town-hub-grid">
        ${groups.map(group=>townHubButtonHTML(group,currentService)).join("")}
      </div>
    </div>
  `;
}

function availableTownServiceGroups(){
  const services = locationServices();
  return TOWN_SERVICE_GROUPS.map(group=>{
    const availableServices = group.services.filter(service=>{
      if(service === "townCenter" || service === "map")return true;
      return services.includes(service);
    });
    if(!availableServices.length)return null;
    return {...group, availableServices};
  }).filter(Boolean);
}

function townHubButtonHTML(group,currentService){
  const active = group.availableServices.includes(currentService);
  const names = group.availableServices
    .filter(service=>service !== "map")
    .map(service=>service === "townCenter" ? serviceLabel(service) : tx(service))
    .join(" | ");
  return `
    <button class="town-hub-button town-hub-${esc(group.id)} ${active ? "active" : ""}" onclick="FE.openTownServiceGroup('${esc(group.id)}')">
      <span>${esc(group.label)}</span>
      <small>${esc(names || group.lead)}</small>
    </button>
  `;
}

function returnToLocationHTML(){
  return `
    <div class="panel service-return-panel">
      <button class="secondary world-return" onclick="FE.show('home')">${tx("backToLocation")}</button>
    </div>
  `;
}

function resourcesHTML(){
  const h = state.hero;
  const active = h.companions.filter(c=>c.active).length;
  return `
    <div class="panel">
      <h2>${tx("resources")}</h2>
      <span class="pill good">${tx("gold")} ${h.gold}</span>
      <span class="pill">${tx("food")} ${h.food}</span>
      <span class="pill">${tx("ore")} ${h.ore}</span>
      <span class="pill">${tx("healthPotions")} ${h.potions}</span>
      <span class="pill">${tx("manaPotions")} ${h.manaPotions}</span>
      <div style="margin-top:8px">
        ${h.companions.length ? `
          <span class="pill">${tx("activeCompanions")} ${active}/${partyLimit()}</span>
          <span class="pill warn">${tx("monthlyWages")} ${partyWageCost()}g</span>
          <span class="pill warn">${tx("dailyFoodNeed")} ${partyFoodCost()}</span>
        ` : `<p>${tx("noCompanions")}</p>`}
      </div>
    </div>
  `;
}

function innHTML(){
  return `
    <div class="panel">
      <h2>${tx("inn")}</h2>
      <p>${tx("rest")} ${tx("hp")} / ${tx("mana")}.</p>
      <div class="grid2">
        <button class="primary" onclick="FE.restInn()">${tx("rest")} 15g</button>
        <button onclick="FE.camp()">${tx("camp")} 2 ${tx("food").toLowerCase()}</button>
      </div>
    </div>
  `;
}

function commerceHTML(sourceTab = "market"){
  const services = locationServices();
  const hasMarket = services.includes("market");
  const hasBlacksmith = services.includes("blacksmith");
  if(sourceTab === "blacksmith" && !hasMarket)return blacksmithHTML();
  if(sourceTab === "market" && !hasBlacksmith)return marketHTML();
  return `
    <div class="panel town-merged-service town-commerce-service">
      <div class="town-service-section-head">
        <span class="pill">${tx("services")}</span>
        <h2>Trade & Forge</h2>
        <p>Supplies, market gear, and equipped upgrades are grouped here so the town does not feel like three separate shops.</p>
      </div>
      ${hasMarket ? marketSuppliesHTML() : ""}
      ${hasMarket ? marketStockHTML() : ""}
      ${hasBlacksmith ? blacksmithUpgradeSectionHTML(true) : ""}
    </div>
  `;
}

function marketHTML(){
  rollMarket();
  return `
    <div class="panel town-merged-service town-commerce-service">
      <div class="town-service-section-head">
        <span class="pill">${tx("market")}</span>
        <h2>${tx("basicSupplies")}</h2>
        <p>${tx("marketRefresh")}</p>
      </div>
      ${marketSuppliesHTML()}
      ${marketStockHTML()}
    </div>
  `;
}

function marketSuppliesHTML(){
  return `
    <section class="town-service-section">
      <div class="town-service-section-title">
        <h3>${tx("basicSupplies")}</h3>
        <span class="pill good">${tx("gold")} ${state.hero.gold}</span>
      </div>
      <div class="town-action-row">
        <button onclick="FE.buyHealthPotion()">${tx("buyHealthPotion")} ${HEALTH_POTION_COST}g</button>
        <button onclick="FE.buyManaPotion()">${tx("buyManaPotion")} ${MANA_POTION_COST}g</button>
        <button onclick="FE.buyFood()">${tx("buyFood")} ${FOOD_COST}g</button>
      </div>
    </section>
  `;
}

function marketStockHTML(){
  rollMarket();
  return `
    <section class="town-service-section">
      <div class="town-service-section-title">
        <h3>${tx("basicGear")}</h3>
        <span class="pill">${tx("stockRefreshesDaily")}</span>
      </div>
      <div class="grid town-stock-grid">
        ${state.market.items.map((item,i)=>marketItemHTML(item,i)).join("")}
      </div>
      <button class="secondary" onclick="FE.rerollMarket()">${tx("reroll")} ${MARKET_REROLL_COST}g</button>
    </section>
  `;
}

function marketItemHTML(item,index){
  const cost = gearCost(item);
  return `
    <div class="card">
      <h3>${esc(item.name)}</h3>
      <p>${title(item.slot)} ${tx("level")} ${item.level}</p>
      <span class="pill">Atk ${item.attack || 0}</span>
      <span class="pill">Def ${item.defense || 0}</span>
      <span class="pill good">${cost}g</span>
      <button class="primary" onclick="FE.buyMarketItem(${index})">${tx("buy")} ${tx("gear")}</button>
    </div>
  `;
}

function blacksmithHTML(){
  return `
    <div class="panel town-merged-service">
      <h2>${tx("blacksmith")}</h2>
      <p>${tx("upgrade")} ${tx("equipped").toLowerCase()} ${tx("gear").toLowerCase()}.</p>
      <span class="pill">${tx("ore")} ${state.hero.ore}</span>
      ${blacksmithUpgradeSectionHTML()}
    </div>
  `;
}

function blacksmithUpgradeSectionHTML(embedded = false){
  const equippedSlots = GEAR_SLOTS.filter(slot=>state.hero.gear[slot]);
  return `
    <section class="town-service-section town-forge-section ${embedded ? "town-service-embedded" : ""}">
      <div class="town-service-section-title">
        <h3>${tx("upgrade")} ${tx("equipped")}</h3>
        <span class="pill">${tx("ore")} ${state.hero.ore}</span>
      </div>
      ${equippedSlots.length ? `
        <div class="grid town-forge-grid">
          ${equippedSlots.map(slot=>upgradeCardHTML(slot,state.hero.gear[slot])).join("")}
        </div>
      ` : `<p class="muted town-empty-note">Equip gear first, then return to the forge for upgrades.</p>`}
    </section>
  `;
}

function upgradeCardHTML(slot,item){
  if(!item){
    return `<div class="card"><h3>${title(slot)}</h3><p>${tx("noGearEquipped")}</p></div>`;
  }
  const cost = upgradeCost(item);
  const disabled = item.upgradeLevel >= 10;
  return `
    <div class="card">
      <h3>${title(slot)}</h3>
      <p><b>${esc(item.name)}</b></p>
      <span class="pill">${tx("upgrade")} +${item.upgradeLevel || 0}/10</span>
      <span class="pill">Atk ${item.attack || 0}</span>
      <span class="pill">Def ${item.defense || 0}</span>
      <p>${disabled ? tx("fullyUpgraded") : `${tx("upgradeCost")}: ${cost.gold}g / ${cost.ore} ${tx("ore").toLowerCase()}`}</p>
      <button class="primary" ${disabled?"disabled":""} onclick="FE.upgradeGear('${slot}')">${tx("upgrade")} ${title(slot)}</button>
    </div>
  `;
}

function tavernHTML(){
  rollTavern();
  return `
    <div class="panel tavern-scene-service">
      <h2>${tx("tavern")}</h2>
      <p>Recruitable travelers are present in the room. Speak with them in the tavern scene to inspect wages, cost, and temperament.</p>
      <div class="tavern-presence-list">
        ${state.tavern.recruits.length
          ? state.tavern.recruits.map(recruit=>`<span class="pill">${esc(recruit.name)} | ${esc(companionRoleDefinition(recruit.role || recruit.class).name)} | ${esc(recruit.rarity)}</span>`).join("")
          : `<span class="pill">No available recruits</span>`}
      </div>
      <button onclick="FE.rerollTavern()">${tx("reroll")} ${TAVERN_REROLL_COST}g</button>
    </div>
  `;
}

function townCenterHTML(){
  const loc = currentLocation();
  const services = locationServices(loc.id).map(serviceLabel).join(" | ") || tx("noServicesHere");
  const event = resolveDailyServiceEvent({state, location:loc, service:"townCenter"});
  return `
    <div class="panel town-center-service-panel">
      <h2>${esc(serviceLabel("townCenter"))}</h2>
      <p>${esc(event.text)}</p>
      <div class="scene-civic-ledger">
        <span class="pill">${tx("services")}: ${esc(services)}</span>
        <span class="pill ${loc.danger ? "warn" : "good"}">${tx("danger")} ${loc.danger}</span>
        <span class="pill">${tx("day")} ${state.world.day}</span>
      </div>
      <p class="muted">Future prosperity, faction ownership, and world-state changes can attach here without replacing existing town behavior.</p>
    </div>
  `;
}

function mineHTML(){
  return `
    <div class="panel">
      <h2>${tx("mine")}</h2>
      <p>${tx("mineBody")}</p>
      <span class="pill">${tx("day")} +${MINE_DAYS}</span>
      <button class="primary" onclick="FE.mineOre()">${tx("mineForOre")}</button>
    </div>
  `;
}

function rollMarket(){
  if(state.market.day === state.world.day && state.market.items.length)return;
  state.market.day = state.world.day;
  state.market.items = Array.from({length:4},()=>makeLoot(Math.max(1,state.hero.level+rnd(-1,1))));
}

function rollTavern(){
  if(state.tavern.day === state.world.day && state.tavern.recruits.length)return;
  state.tavern.day = state.world.day;
  state.tavern.recruits = Array.from({length:3},(_,i)=>{
    const recruit = makeCompanion(Math.max(1,state.hero.level+rnd(0,1)));
    if(i===0)recruit.rarity = "common";
    recruit.active = false;
    return recruit;
  });
}

function gearCost(item){
  return Math.max(10,Math.min(15,item.value || 10));
}

function recruitCost(companion){
  const rarityPremium = {common:0,uncommon:8,rare:18,epic:30,legendary:50};
  return 23 + Math.floor((companion.level || 1) * 2) + (rarityPremium[companion.rarity] || 0);
}

function upgradeCost(item){
  const next = (item.upgradeLevel || 0) + 1;
  return {
    next,
    gold: 5 + next * 3,
    ore: Math.max(1,Math.ceil(next / 2))
  };
}

export function buyHealthPotion(){
  buyResource(HEALTH_POTION_COST,()=>state.hero.potions++,tx("healthPotions"));
}

export function buyManaPotion(){
  buyResource(MANA_POTION_COST,()=>state.hero.manaPotions++,tx("manaPotions"));
}

export function buyFood(){
  buyResource(FOOD_COST,()=>state.hero.food += FOOD_AMOUNT,`${tx("food")} +${FOOD_AMOUNT}`);
}

function buyResource(cost,apply,label){
  if(state.hero.gold < cost)return toast(tx("needGold"));
  state.hero.gold -= cost;
  apply();
  save();
  toast(`${tx("bought")}: ${label}`);
  refreshTown();
}

export function buyMarketItem(index){
  const item = state.market.items[index];
  if(!item)return;
  const cost = gearCost(item);
  if(state.hero.gold < cost)return toast(tx("needGold"));
  state.hero.gold -= cost;
  const bought = {...item, value:cost, upgradeLevel:item.upgradeLevel || 0};
  state.hero.inv.push(bought);
  state.market.items.splice(index,1);
  save();
  refreshTown();
}

export function rerollMarket(){
  if(state.hero.gold < MARKET_REROLL_COST)return toast(tx("needGold"));
  state.hero.gold -= MARKET_REROLL_COST;
  state.market.day = -1;
  rollMarket();
  save();
  refreshTown();
}

export function upgradeGear(slot){
  const item = state.hero.gear[slot];
  if(!item)return toast(tx("noGearEquipped"));
  item.upgradeLevel ||= 0;
  if(item.upgradeLevel >= 10)return toast(tx("fullyUpgraded"));
  const cost = upgradeCost(item);
  if(state.hero.gold < cost.gold)return toast(tx("needGold"));
  if(state.hero.ore < cost.ore)return toast(tx("needOre"));
  state.hero.gold -= cost.gold;
  state.hero.ore -= cost.ore;
  item.upgradeLevel = cost.next;
  item.name = item.name.replace(/\s\+\d+$/,"") + ` +${item.upgradeLevel}`;
  if(item.slot === "weapon" || (item.attack || 0) > (item.defense || 0))item.attack = (item.attack || 0) + 1;
  else item.defense = (item.defense || 0) + 1;
  item.value = (item.value || 10) + Math.ceil(cost.gold / 2);
  state.world.story.push(`${item.name} ${tx("upgraded").toLowerCase()}.`);
  save();
  toast(`${tx("upgraded")}: ${item.name}`);
  refreshTown();
}

export function hireRecruit(id){
  rollTavern();
  const idx = state.tavern.recruits.findIndex(c=>c.id===id);
  if(idx<0)return {ok:false,message:"That recruit is no longer available."};
  const recruit = state.tavern.recruits[idx];
  const cost = recruitCost(recruit);
  if(state.hero.gold < cost){
    toast(tx("needGold"));
    return {ok:false,message:tx("needGold")};
  }
  state.hero.gold -= cost;
  recruit.active = state.hero.companions.filter(c=>c.active).length < partyLimit();
  state.hero.companions.push(recruit);
  state.tavern.recruits.splice(idx,1);
  state.world.story.push(`${recruit.name} ${tx("hired").toLowerCase()}.`);
  save();
  toast(`${tx("hired")}: ${recruit.name}`);
  refreshTown();
  return {ok:true,name:recruit.name,cost};
}

export function rerollTavern(){
  if(state.hero.gold < TAVERN_REROLL_COST)return toast(tx("needGold"));
  state.hero.gold -= TAVERN_REROLL_COST;
  state.tavern.day = -1;
  rollTavern();
  save();
  refreshTown();
}

export function mineOre(){
  const gained = rnd(1,3) + region().tier;
  advanceDays(MINE_DAYS);
  state.hero.ore += gained;
  state.world.story.push(`${tx("mine")}: +${gained} ${tx("ore")}.`);
  save();
  refreshTown();
  modal(tx("mineResult"), `<p>${tx("mineGathered")}</p><span class="pill good">+${gained} ${tx("ore")}</span>`, [{label:tx("continue"),fn:()=>refreshTown()}]);
}

export function restInn(){
  if(state.hero.gold < 15)return toast(tx("needGold"));
  state.hero.gold -= 15;
  state.hero.hp = state.hero.maxHp;
  state.hero.mana = state.hero.maxMana;
  state.hero.companions.forEach(c=>{c.hp=c.maxHp;c.mana=c.maxMana||c.mana||0;});
  advanceDays(1);
  save();
  refreshTown();
}

export function camp(){
  if(state.hero.food < 2)return toast(tx("needFood"));
  state.hero.food -= 2;
  state.hero.hp = Math.min(state.hero.maxHp,state.hero.hp+Math.floor(state.hero.maxHp*.45));
  state.hero.mana = Math.min(state.hero.maxMana,state.hero.mana+Math.floor(state.hero.maxMana*.45));
  advanceDays(1);
  save();
  refreshTown();
}
