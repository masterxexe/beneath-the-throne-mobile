import { activeAbilities, activeClassDefinition, activeClassId, activeWeaponType, clamp, convertCM, grantCompanionBond, levelHero, makeLoot, normalizeCompanion, pct, region, rnd, save, setScreen, spellMasteryBonus, spellMasteryNeed, spellSchoolForAbility, state, weaponMasteryBonus, weaponMasteryNeed } from "./state.js";
import { abilityBaseCost, abilityKind, abilityKindLabel, abilityName } from "./abilities.js";
import { equip, itemUpgradeDelta } from "./gear.js";
import { title, tx } from "./language.js";
import { bar, byId, esc, modal, render, show } from "./ui.js";
import { backdropHTML, combatBackdrop, companionPortrait, enemyPortrait, isMajorVisual, portraitHTML } from "./visuals.js";
import { getPlayerPoseAsset, preloadPlayerPoseAsset, renderPlayerCombatPortraitHook, resolvePlayerAttackPose } from "./portraitRenderer.js";
import { resolvePlayerCombatPresentation } from "./characterRenderController.js";
import { allEnemyStyleIds, allPlayerStyleIds, attackStyleClass, attackWeaponClass, fxOverlayHTML, nextCompanionAttackStyle, nextEnemyAttackStyle, nextHeroAttackStyle, presentationForStyle, styleDisplayName } from "./combatAnimations.js";
import { applyGearVisuals } from "./gearVisuals.js";
import { playAudioHook } from "./audioHooks.js";
import { presentLevelUp } from "./levelUp.js";
import { debugEnemyVisualRegistry, enemyVisualHTML, resolveEnemyPoseAsset, stampEnemyVisualClass } from "./enemyVisuals.js";
import { actorDirectorAttributes, createBattlefieldComposition, directorStageAttributes } from "./combatSceneDirector.js";
import { companionActorPath } from "./npcRegistry.js";
import { isLocalDebugEnabled } from "./environment.js";

export let battle = null;
let targetIndex = 0;
let skillOpen = false;
let autoFight = false;
let resolvingTimer = null;
let combatPlayerVisualState = "combatIdle";
let combatPlayerVisualTimer = null;
let combatRenderFrame = null;
let debugEnemyVisualPoseOverride = null;
const NUMERIC_POPUP_SELECTOR = ".damage-pop,.damage-popup,.number-popup,.combat-number";

const COMBAT_TIMING = {
  poseAttack:760,
  poseSkill:720,
  poseHurt:640,
  poseBlock:620,
  poseDebug:980,
  motion:720,
  damagePop:760,
  impact:300,
  turnAdvance:820,
  turnWindup:560,
  victorySettle:680,
  defeatedHold:1200
};

const COMBAT_NUMBER_TTL = COMBAT_TIMING.damagePop;
const COMBAT_NUMBER_PHASE_PAUSE = 640;

function combatDebug(message, detail = {}){
  if(typeof location === "undefined")return;
  if(!isLocalDebugEnabled())return;
  console.log(`[combat] ${message}`, detail);
}

function scheduleCombatRender(){
  if(typeof requestAnimationFrame === "undefined"){
    if(battle && byId("combat")?.classList.contains("active"))renderCombat();
    return;
  }
  if(combatRenderFrame != null)return;
  combatRenderFrame = requestAnimationFrame(()=>{
    combatRenderFrame = null;
    if(battle && byId("combat")?.classList.contains("active"))renderCombat();
  });
}

function preloadCombatPlayerVisualAssets(){
  const states = new Set(["combatIdle","hurt","block","defeated",resolvePlayerAttackPose(state.hero)]);
  states.forEach(visualState=>preloadPlayerPoseAsset(state.hero, visualState));
}

export function makeEnemy(elite=false){
  const r = region();
  const heroLevel = state.hero.level || 1;
  const normalMin = Math.max(r.min, heroLevel - 1);
  const normalMax = Math.min(r.max, heroLevel + 2);
  const eliteMin = Math.max(r.min, heroLevel + 1);
  const eliteMax = Math.min(r.max + 2, heroLevel + 5);
  const lv = elite ? rnd(eliteMin, Math.max(eliteMin, eliteMax)) : rnd(normalMin, Math.max(normalMin, normalMax));
  const roles = elite ? ["Elite Raider","Cursed Knight","Ash Warden"] : ["Bandit","Wolf","Skeleton","Cultist"];
  return stampEnemyVisualClass({
    name:roles[rnd(0,roles.length-1)], role:elite?"elite":"enemy", level:lv,
    hp:70+lv*13, maxHp:70+lv*13, attack:12+lv*3, defense:5+lv, speed:5+rnd(0,6),
    xp:35+lv*12, gold:12+lv*4
  });
}

export function makeElite(){
  const e = makeEnemy(true);
  e.name = region().name+" Hunter";
  e.role = "hunter";
  e.hp *= 2;
  e.maxHp = e.hp;
  e.attack += 10;
  e.xp *= 2;
  e.gold *= 2;
  return e;
}

export function startBattle(enemies,text,options = {}){
  clearTimeout(resolvingTimer);
  clearTimeout(combatPlayerVisualTimer);
  if(combatRenderFrame != null && typeof cancelAnimationFrame !== "undefined")cancelAnimationFrame(combatRenderFrame);
  combatRenderFrame = null;
  combatPlayerVisualState = "combatIdle";
  battle = {
    enemies:enemies.map((e,i)=>stampEnemyVisualClass({...e,id:"e"+i,hp:e.hp||e.maxHp,maxHp:e.maxHp||e.hp})),
    queue:[], index:0, round:1, defending:false, resolving:false, heroOffenseUsed:false,
    lastStandUsed:false, guardianPrayerUsed:false, steadyAim:false, heroActionLocked:false,     companionGuard:null, effects:[], numberEvents:[], nextNumberEventId:1, recentNumberEventKeys:{},
    numberPhaseId:0, visibleNumberRegistry:{}, defeatedEnemyIds:{},
    heroCombo:0, enemyCombo:{}, lastHeroAttack:null, lastEnemyAttack:{},
    heroEvasion:0, ironWard:false, taunt:false, heroRegen:0,
    sceneText:text || "", log:[text || "Battle begins."],
    meta: options || {}
  };
  if(hasPassive("ranger_trapper")){
    battle.enemies.forEach(e=>{e.hp = Math.max(1,e.hp - Math.max(4,Math.floor(e.maxHp*.08)));});
  }
  preloadCombatPlayerVisualAssets();
  targetIndex = 0;
  skillOpen = false;
  autoFight = false;
  buildQueue();
  setScreen("combat");
  playAudioHook("combat-enter", {source:options.source || "encounter", enemies:battle.enemies.length});
  playAudioHook("battle-music-start");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("combat").classList.add("active");
  renderCombat();
  window.scrollTo(0,0);
  setTimeout(()=>window.scrollTo(0,0),0);
  setTimeout(()=>window.scrollTo(0,0),120);
  const first = actor();
  if(first && first.side !== "hero"){
    battle.resolving = true;
    renderCombat();
    resolvingTimer = setTimeout(resolveUntilHero,COMBAT_TIMING.turnWindup);
  }
}

function buildQueue(){
  const h = state.hero;
  const q = [{side:"hero",id:"hero",name:h.name,speed:unitSpeed(h)}];
  h.companions.filter(c=>c.active&&c.hp>0).forEach(c=>q.push({side:"comp",id:c.id,name:c.name,speed:unitSpeed(c)}));
  battle.enemies.filter(e=>e.hp>0).forEach(e=>q.push({side:"enemy",id:e.id,name:e.name,speed:unitSpeed(e)}));
  battle.queue = q.sort((a,b)=>b.speed-a.speed);
  if(battle.index>=battle.queue.length)battle.index = 0;
}

function unitSpeed(unit){
  return (unit.speed || 5) + (unit.stats?.speed || 0);
}

function actor(){
  if(!battle.queue.length)buildQueue();
  let guard = 0;
  while(guard++ < 50 && battle.queue.length){
    const a = battle.queue[battle.index % battle.queue.length];
    if(actorAlive(a))return a;
    battle.queue.splice(battle.index,1);
    if(battle.index>=battle.queue.length)battle.index = 0;
  }
  return null;
}

function peekActor(){
  if(!battle || !Array.isArray(battle.queue) || !battle.queue.length)return null;
  const start = Math.max(0,Number(battle.index) || 0);
  for(let offset = 0; offset < battle.queue.length; offset++){
    const candidate = battle.queue[(start + offset) % battle.queue.length];
    if(actorAlive(candidate))return candidate;
  }
  return null;
}

function actorAlive(a){
  if(!a)return false;
  if(a.side==="hero")return state.hero.hp>0;
  if(a.side==="comp"){
    const c = state.hero.companions.find(x=>x.id===a.id);
    return !!(c&&c.active&&c.hp>0);
  }
  const e = battle.enemies.find(x=>x.id===a.id);
  return !!(e&&e.hp>0);
}

function advanceTurn(){
  battle.index++;
  if(battle.index>=battle.queue.length){
    battle.index = 0;
    battle.round++;
    buildQueue();
  }
}

export function renderCombat(){
  if(!battle)return;
  document.body.classList.add("cinematic-combat-active");
  document.body.classList.remove("cinematic-world-home-active");
  pruneCombatNumbers();
  cleanupNumericPopupDOM();
  const h = state.hero, a = actor(), live = liveEnemies(), visible = visibleEnemies(), comps = liveComps();
  const playerTurn = a && a.side==="hero" && !battle.resolving;
  const scene = combatBackdrop(region(),battle);
  const tier = battleVisualTier();
  const enemyPresentations = visible.map(enemy=>{
    const portrait = enemyPortrait(enemy);
    return {enemy,portrait,scaleTier:enemyScaleTier(enemy, portrait)};
  });
  const composition = createBattlefieldComposition({
    hero:h,
    companions:comps,
    enemies:visible,
    enemyScaleTiers:enemyPresentations.map(entry=>entry.scaleTier),
    visualTier:tier,
    scene,
    meta:battle.meta || {}
  });
  const sceneStyle = scene.art ? ` style="--combat-stage-art:url('${scene.art}')"` : "";
  byId("combat").innerHTML = `
    <div class="combat-shell combat-scene-${scene.id} combat-tier-${tier} ${effectClass("battlefield")}"${sceneStyle}>
      ${backdropHTML(scene)}
      <div class="combat-header combat-header-cinematic">
        <div class="combat-header-main">
          <span class="combat-round-pill">${tx("round")} ${battle.round}</span>
          <h2>${a?esc(a.name):tx("combat")}</h2>
        </div>
        <div class="turn-order turn-order-cinematic" aria-label="${tx("turnOrder")}">
          ${battle.queue.slice(0,2).map((x,i)=>`<span class="pill ${x===a?'good':''}">${i===0?esc(x.name):tx("nextUp")}</span>`).join("")}
        </div>
        ${targetBarHTML(playerTurn, live)}
      </div>
      <div class="combat-stage combat-battlefield ${composition.stageClass}" data-combat-viewport="stable" ${directorStageAttributes(composition)} style="${esc(composition.stageStyle)}">
        <div class="combat-atmosphere-layer" aria-hidden="true">
          <span class="combat-embers"></span>
        </div>
        ${moveBannerHTML()}
        <div class="combat-area party-area">
          <div class="combat-party-grid">
            ${unitHTML(h,true,0,composition.partyActors[0])}
            ${comps.map((c,slot)=>unitHTML(c,false,slot + 1,composition.partyActors[slot + 1])).join("")}
          </div>
        </div>
        <div class="combat-area enemy-area">
          <div class="combat-enemy-grid">${enemyPresentations.map((entry,slot)=>enemyHTML(entry.enemy,live.indexOf(entry.enemy),playerTurn,slot,entry,composition.enemyActors[slot])).join("")}</div>
        </div>
      </div>
      <div class="actions combat-actions">
        ${debugEnemyCombatControlsHTML()}
        ${debugCompanionMotionControlsHTML()}
        ${debugAttackStudioHTML()}
        <div class="grid3">
          <button class="primary" ${playerTurn?'onclick="FE.heroAttack()"':'disabled'}>${tx("attack")}</button>
          <button ${playerTurn?'onclick="FE.toggleSkills()"':'disabled'}>${tx("skills")}</button>
          ${potionButtonsHTML(playerTurn,h)}
          <button ${playerTurn?'onclick="FE.defend()"':'disabled'}>${tx("defend")}</button>
          <button class="danger" onclick="FE.runBattle()">${tx("run")}</button>
          <button class="${autoFight?'good':'secondary'}" onclick="FE.toggleAuto()">${tx("auto")}: ${autoFight?tx("audioOn"):tx("audioOff")}</button>
        </div>
        ${skillOpen?skillDrawerHTML(playerTurn):""}
        <details class="battle-log">
          <summary>${tx("battleLog")}</summary>
          <div class="log">${battle.log.slice(-8).map(esc).join("<br>")}</div>
        </details>
      </div>
    </div>
  `;
}

function debugEnemyCombatControlsHTML(){
  if(!isLocalDebugEnabled())return "";
  if(battle?.meta?.source !== "enemy-visual-debug")return "";
  return `
    <div class="panel enemy-visual-debug-panel">
      <h3>Enemy Visual Tester</h3>
      <div class="grid3">
        <button onclick="FE.debugForceEnemyVisualPose('idle')">Force Idle</button>
        <button onclick="FE.debugForceEnemyVisualPose('attack')">Force Attack</button>
        <button onclick="FE.debugForceEnemyVisualPose('hurt')">Force Hurt</button>
        <button onclick="FE.debugForceEnemyVisualPose('defeated')">Force Defeated</button>
        <button onclick="FE.debugResetEnemyVisualTest()">Reset Enemy Test</button>
      </div>
    </div>
  `;
}

function debugCompanionMotionControlsHTML(){
  if(!isLocalDebugEnabled())return "";
  if(!battle || !liveComps().length)return "";
  return `
    <div class="panel companion-motion-debug-panel">
      <h3>Companion Motion Tester</h3>
      <div class="grid3">
        <button onclick="FE.debugTriggerCompanionMotion('attack')">Companion Attack</button>
        <button onclick="FE.debugTriggerCompanionMotion('cast')">Companion Cast</button>
        <button onclick="FE.debugTriggerCompanionMotion('heal')">Companion Heal</button>
        <button onclick="FE.debugTriggerCompanionMotion('guard')">Companion Guard</button>
      </div>
    </div>
  `;
}

function debugAttackStudioHTML(){
  if(!isLocalDebugEnabled())return "";
  const heroButtons = allPlayerStyleIds().map(style=>`<button onclick="FE.debugPlayAttackStyle('${style}','hero')">${esc(styleDisplayName(style))}</button>`).join("");
  const enemyButtons = allEnemyStyleIds().map(style=>`<button onclick="FE.debugPlayAttackStyle('${style}','enemy')">${esc(styleDisplayName(style))}</button>`).join("");
  return `
    <div class="panel attack-studio-debug-panel">
      <h3>Attack Studio</h3>
      <div class="grid3">
        <button onclick="FE.debugEquipWeaponCategory('sword')">Sword</button>
        <button onclick="FE.debugEquipWeaponCategory('axe')">Axe</button>
        <button onclick="FE.debugEquipWeaponCategory('spear')">Spear</button>
        <button onclick="FE.debugEquipWeaponCategory('mace')">Mace</button>
        <button onclick="FE.debugEquipWeaponCategory('dagger')">Dagger</button>
        <button onclick="FE.debugEquipWeaponCategory('bow')">Bow</button>
        <button onclick="FE.debugEquipWeaponCategory('staff')">Staff</button>
        <button onclick="FE.debugEquipWeaponCategory('shield')">Shield</button>
        <button onclick="FE.debugEquipWeaponCategory('unarmed')">Unarmed</button>
      </div>
      <p class="muted">Hero swings</p>
      <div class="grid3">${heroButtons}</div>
      <p class="muted">Enemy strikes</p>
      <div class="grid3">${enemyButtons}</div>
    </div>
  `;
}

function potionButtonsHTML(playerTurn,h){
  const healthDisabled = !playerTurn || h.potions <= 0;
  const manaDisabled = !playerTurn || h.manaPotions <= 0 || h.mana >= h.maxMana;
  return `
    <button ${healthDisabled?"disabled":'onclick="FE.usePotion()"'}>${tx("healthPotion")} (${h.potions})</button>
    ${h.manaPotions > 0 ? `<button ${manaDisabled?"disabled":'onclick="FE.useManaPotion()"'}>${tx("manaPotion")} (${h.manaPotions})</button>` : ""}
  `;
}

function unitHTML(unit,isHero,slotIndex = 0,directorActor = null){
  const id = isHero ? "hero" : `comp_${unit.id}`;
  const manaMax = unit.maxMana || unit.mana || 0;
  const mana = unit.mana || 0;
  const portrait = isHero ? null : companionPortrait(unit);
  const actorRole = isHero ? "hero" : "companion";
  const slot = isHero ? "hero" : slotIndex;
  const companionKind = !isHero ? (unit.class || unit.role || "fighter") : "";
  const companionTone = !isHero ? (portrait?.tone || "steel") : "";
  return `
    <div class="unit combat-card combat-actor combat-actor-${actorRole} combat-slot-${slot} ${!isHero?`combat-companion-${esc(companionKind)}`:""} ${effectClass(id)}" data-combat-actor="${actorRole}" data-combat-slot="${slot}" ${!isHero?`data-companion-kind="${esc(companionKind)}" data-companion-tone="${esc(companionTone)}"`:""}${attackMetaAttrs(id)} ${actorDirectorAttributes(directorActor)}>
      <div class="portrait-wrap">
        ${isHero ? renderPlayerCombatPortraitHook(state.hero, {visualState:combatPlayerVisualState}) : companionSceneArtHTML(unit, portrait)}
        ${effectHTML(id)}
      </div>
      <div class="combat-card-body">
        <div class="combat-name"><b>${esc(unit.name)}</b><span>${unit.level}</span></div>
        ${bar(unit.hp,unit.maxHp)}
        ${bar(mana,manaMax || 1,"mana")}
      </div>
    </div>
  `;
}

function companionSceneArtHTML(unit, portrait){
  const kind = unit?.class || unit?.role || "fighter";
  const path = companionSceneArtPath(kind);
  if(!path)return portraitHTML(portrait);
  return `
    <div class="companion-scene-frame companion-scene-${esc(kind)}" data-companion-scene-art="${esc(kind)}" data-tone="${esc(portrait?.tone || "steel")}" role="img" aria-label="${esc(unit?.name || tx("companion"))} ${tx("companion")}">
      <img class="companion-scene-art" src="${esc(path)}" alt="" loading="eager" decoding="async" draggable="false">
      <span class="companion-scene-ground"></span>
      <span class="companion-scene-haze"></span>
    </div>
  `;
}

function companionSceneArtPath(kind = "fighter"){
  return companionActorPath(kind);
}

function enemyHTML(enemy,index,playerTurn,slotIndex = 0,presentation = null,directorActor = null){
  const id = enemy.id;
  const portrait = presentation?.portrait || enemyPortrait(enemy);
  const majorClass = isMajorVisual(portrait) ? `major-enemy-card major-${portrait.tier}` : "";
  const scaleTier = presentation?.scaleTier || enemyScaleTier(enemy, portrait);
  const pose = enemyPoseState(enemy);
  const poseArt = enemyVisualHTML(enemy, pose);
  const targetable = enemy.hp > 0 && index >= 0;
  const selected = targetable && index === targetIndex;
  return `
    <div class="enemy combat-card combat-actor combat-actor-enemy combat-slot-${slotIndex} enemy-scale-${scaleTier} ${majorClass} ${selected?'target':''} ${effectClass(id)}" data-combat-actor="enemy" data-combat-slot="${slotIndex}" data-enemy-scale="${scaleTier}" data-enemy-state="${pose}"${attackMetaAttrs(id)} ${actorDirectorAttributes(directorActor)} ${playerTurn && targetable?`onclick="FE.setTarget(${index})" role="button" aria-pressed="${selected?"true":"false"}"`:""}>
      <div class="portrait-wrap">
        ${poseArt || portraitHTML(portrait)}
        ${effectHTML(id)}
      </div>
      <div class="combat-card-body">
        <div class="combat-name"><b>${esc(enemy.name)}</b><span>${enemy.hp}</span></div>
        ${selected?`<span class="pill good combat-target-stamp">${tx("combatTarget")}</span>`:""}
        ${bar(enemy.hp,enemy.maxHp)}
      </div>
    </div>
  `;
}

function battleVisualTier(){
  const order = ["legendary","boss","rare","story"];
  const tiers = battle.enemies.map(enemy=>enemyPortrait(enemy)?.tier).filter(Boolean);
  return order.find(tier=>tiers.includes(tier)) || "common";
}

function isNumberEffectType(type){
  return ["damage","heal","mana","miss"].includes(type);
}

function enemyScaleTier(enemy, portrait){
  const tier = portrait?.tier || "";
  const text = `${enemy?.name || ""} ${enemy?.role || ""} ${enemy?.enemyVisualClass || ""} ${tier}`.toLowerCase();
  if(["legendary","boss"].includes(tier) || /boss|dragon|giant|titan|coloss|behemoth|ogre|warden/.test(text))return "large";
  if(["rare","story"].includes(tier) || /elite|captain|champion|knight|brute|bear|warden/.test(text))return "medium";
  return "small";
}

function pruneCombatNumbers(now = Date.now()){
  if(!battle?.numberEvents)return;
  battle.numberEvents = battle.numberEvents.filter(event=>now - (event.createdAt || 0) < COMBAT_NUMBER_TTL);
  pruneVisibleNumberRegistry(now);
}

function pruneRecentNumberEventKeys(now = Date.now()){
  if(!battle?.recentNumberEventKeys)return;
  Object.entries(battle.recentNumberEventKeys).forEach(([key,createdAt])=>{
    if(now - createdAt > COMBAT_NUMBER_TTL)delete battle.recentNumberEventKeys[key];
  });
}

function pruneDefeatedEnemyVisibility(now = Date.now()){
  if(!battle?.defeatedEnemyIds)return;
  Object.entries(battle.defeatedEnemyIds).forEach(([id,expiresAt])=>{
    if(expiresAt <= now)delete battle.defeatedEnemyIds[id];
  });
}

function beginNumberPhase(){
  if(!battle)return;
  battle.numberPhaseId = (battle.numberPhaseId || 0) + 1;
  clearCombatNumbers();
  pruneCombatNumbers();
  cleanupNumericPopupDOM();
}

function numberEventKey(event){
  return event?.key || `${event.phaseId || 0}|${event.source || event.type}|${event.target}|${event.type}|${event.text}`;
}

function pruneVisibleNumberRegistry(now = Date.now()){
  if(!battle?.visibleNumberRegistry)return;
  Object.entries(battle.visibleNumberRegistry).forEach(([key,expiresAt])=>{
    if(expiresAt <= now)delete battle.visibleNumberRegistry[key];
  });
}

function cleanupNumericPopupDOM(){
  if(typeof document === "undefined")return;
  const liveKeys = new Set((battle?.numberEvents || []).map(numberEventKey));
  document.querySelectorAll(NUMERIC_POPUP_SELECTOR).forEach(node=>{
    const key = node.getAttribute("data-combat-number-key");
    if(!key || !liveKeys.has(key))node.remove();
  });
}

function pushCombatNumber(target,type,text = "", detail = {}){
  if(!battle || !text || !isNumberEffectType(type))return null;
  pruneCombatNumbers();
  pruneRecentNumberEventKeys();
  battle.numberEvents ||= [];
  battle.visibleNumberRegistry ||= {};
  battle.recentNumberEventKeys ||= {};
  const now = Date.now();
  const source = detail.source || type;
  const phaseId = battle.numberPhaseId || 0;
  const key = `${phaseId}|${source}|${target}|${type}|${text}`;
  const last = battle.recentNumberEventKeys[key] || 0;
  if(now - last < 320){
    combatDebug("skipped duplicate combat number", {target,type,text,source,age:now-last});
    return null;
  }
  if(battle.visibleNumberRegistry[key] > now){
    combatDebug("skipped active visible combat number", {target,type,text,source});
    return null;
  }
  battle.recentNumberEventKeys[key] = now;
  const activeForTarget = battle.numberEvents.filter(existing=>existing.target === target).length;
  const event = {
    id:`num_${battle.nextNumberEventId++}`,
    target,
    type,
    text,
    source,
    phaseId,
    actor:detail.actor || "",
    createdAt:now,
    lane:activeForTarget % 3
  };
  event.key = key;
  cleanupNumericPopupDOM();
  battle.visibleNumberRegistry[event.key] = event.createdAt + COMBAT_NUMBER_TTL;
  battle.numberEvents.push(event);
  combatDebug("combat number", event);
  setTimeout(()=>{
    if(!battle?.numberEvents)return;
    battle.numberEvents = battle.numberEvents.filter(x=>x.id!==event.id);
    scheduleCombatRender();
  },COMBAT_NUMBER_TTL);
  return event;
}

function clearCombatNumbers(){
  if(!battle?.numberEvents)return;
  battle.numberEvents = [];
  battle.visibleNumberRegistry = {};
  cleanupNumericPopupDOM();
}

function playCombatSfx(type){
  if(type === "attack")playAudioHook("hero-swing");
  else if(type === "enemyAttack")playAudioHook("enemy-swing");
  else if(["slash","cleave","thrust","stab","crush","shot","strike"].includes(type))playAudioHook("hero-hit");
  else if(["arcane","spellFire","spellFrost","spellStorm","spellHoly","spellShadow","spellWard"].includes(type))playAudioHook("magic");
  else if(type === "hurt")playAudioHook("hero-hurt");
  else if(type === "brace")playAudioHook("block");
  else if(type === "spellHeal")playAudioHook("potion");
  else if(type === "spellMana")playAudioHook("potion-mana");
  else if(type === "miss")playAudioHook("miss");
}

function pushEffect(target,type,text = "", detail = {}){
  if(!battle)return;
  playCombatSfx(type);
  if(text && isNumberEffectType(type)){
    return pushCombatNumber(target,type,text,detail);
  }
  battle.effects ||= [];
  const effect = {
    id:"fx_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    target,
    type,
    style:detail.style || "",
    weapon:detail.weapon || "",
    combo:detail.combo || 0,
    heavy:!!detail.heavy,
    side:detail.side || "",
    fx:detail.fx || ""
  };
  battle.effects.push(effect);
  const duration = {
    attack:COMBAT_TIMING.motion,
    enemyAttack:COMBAT_TIMING.motion,
    hurt:COMBAT_TIMING.motion,
    enemyHurt:COMBAT_TIMING.motion,
    slash:COMBAT_TIMING.motion,
    cleave:COMBAT_TIMING.motion,
    thrust:COMBAT_TIMING.motion,
    stab:COMBAT_TIMING.motion,
    crush:COMBAT_TIMING.motion,
    shot:COMBAT_TIMING.motion,
    arcane:COMBAT_TIMING.motion,
    strike:COMBAT_TIMING.motion,
    spellFire:COMBAT_TIMING.motion,
    spellFrost:COMBAT_TIMING.motion,
    spellStorm:COMBAT_TIMING.motion,
    spellHoly:COMBAT_TIMING.motion,
    spellShadow:COMBAT_TIMING.motion,
    spellHeal:COMBAT_TIMING.motion,
    spellMana:COMBAT_TIMING.motion,
    spellWard:COMBAT_TIMING.motion,
    defeated:COMBAT_TIMING.poseDebug,
    brace:COMBAT_TIMING.motion,
    cast:COMBAT_TIMING.motion,
    impact:detail.heavy ? 420 : COMBAT_TIMING.impact
  }[type] || COMBAT_TIMING.damagePop;
  setTimeout(()=>{
    if(!battle?.effects)return;
    battle.effects = battle.effects.filter(x=>x.id!==effect.id);
    scheduleCombatRender();
  },duration);
}

function pushImpact(heavy = false){
  pushEffect("battlefield","impact","",{heavy});
}

function beginHeroAttackPresentation(){
  battle.heroCombo = (battle.heroCombo || 0) + 1;
  const presentation = nextHeroAttackStyle(state.hero, battle.heroCombo - 1);
  battle.lastHeroAttack = presentation;
  return presentation;
}

function beginEnemyAttackPresentation(enemy){
  battle.enemyCombo ||= {};
  const id = enemy?.id || "enemy";
  battle.enemyCombo[id] = (battle.enemyCombo[id] || 0) + 1;
  const presentation = nextEnemyAttackStyle(enemy, battle.enemyCombo[id] - 1);
  battle.lastEnemyAttack ||= {};
  battle.lastEnemyAttack[id] = presentation;
  return presentation;
}

function beginCompanionAttackPresentation(companion){
  battle.companionCombo ||= {};
  const id = companion?.id || "comp";
  battle.companionCombo[id] = (battle.companionCombo[id] || 0) + 1;
  return nextCompanionAttackStyle(companion, battle.companionCombo[id] - 1);
}

function presentationDetail(presentation, side, extra = {}){
  return {
    style:presentation.style,
    weapon:presentation.category,
    combo:presentation.combo,
    fx:presentation.effect,
    heavy:!!extra.heavy || presentation.combo >= 3,
    side
  };
}

function attackMetaAttrs(id){
  const attack = targetEffects(id).find(effect=>effect.type==="attack" || effect.type==="enemyAttack" || effect.type==="cast");
  if(!attack?.style)return "";
  return ` data-attack-style="${esc(attack.style)}" data-weapon-category="${esc(attack.weapon || "")}"`;
}

function moveBannerHTML(){
  const attack = (battle?.effects || []).find(effect=>(effect.type==="attack" || effect.type==="enemyAttack") && effect.style);
  if(!attack)return "";
  return `<div class="combat-move-banner combat-move-${esc(attack.side || "hero")}" aria-hidden="true">${esc(styleDisplayName(attack.style))}</div>`;
}

function setCombatPlayerVisualState(visualState = "combatIdle", duration = COMBAT_TIMING.poseAttack){
  const pose = getPlayerPoseAsset(state.hero, visualState);
  preloadPlayerPoseAsset(state.hero, visualState);
  preloadPlayerPoseAsset(state.hero, "combatIdle");
  combatPlayerVisualState = pose.requested || "combatIdle";
  clearTimeout(combatPlayerVisualTimer);
  if(duration > 0){
    combatPlayerVisualTimer = setTimeout(()=>{
      combatPlayerVisualState = state.hero.hp <= 0 ? "defeated" : "combatIdle";
      scheduleCombatRender();
    },duration);
  }
}

export function resetCombatPlayerVisualState(){
  clearTimeout(combatPlayerVisualTimer);
  combatPlayerVisualState = "combatIdle";
  if(battle && byId("combat")?.classList.contains("active"))renderCombat();
  return {ok:true,state:combatPlayerVisualState};
}

export function debugTriggerCombatPose(visualState = "attack"){
  if(!battle)startBattle([makeEnemy(false)], "Debug combat pose state.", {source:"debug"});
  setCombatPlayerVisualState(visualState, COMBAT_TIMING.poseDebug);
  renderCombat();
  return {
    ok:true,
    requested:visualState,
    pose:getPlayerPoseAsset(state.hero, visualState)
  };
}

function targetEffects(target){
  return (battle?.effects || []).filter(effect=>effect.target===target);
}

function targetNumberEvents(target){
  return (battle?.numberEvents || []).filter(event=>event.target===target);
}

function enemyPoseState(enemy){
  if(debugEnemyVisualPoseOverride && battle?.meta?.source === "enemy-visual-debug")return debugEnemyVisualPoseOverride;
  if(enemy?.hp <= 0)return "defeated";
  const effects = targetEffects(enemy?.id);
  const numbers = targetNumberEvents(enemy?.id);
  if(effects.some(effect=>effect.type==="enemyAttack"))return "attack";
  if(effects.some(effect=>effect.type==="enemyHurt") || numbers.some(event=>event.type==="damage"))return "hurt";
  return "idle";
}

function effectClass(target){
  const effects = targetEffects(target);
  const numbers = targetNumberEvents(target);
  const classes = [];
  if(numbers.some(event=>event.type==="damage" || event.type==="miss"))classes.push("hit-flash");
  const attack = effects.find(effect=>effect.type==="attack" || effect.type==="enemyAttack" || effect.type==="cast");
  if(effects.some(effect=>effect.type==="attack"))classes.push("combat-motion-attack");
  if(effects.some(effect=>effect.type==="enemyAttack"))classes.push("combat-motion-enemy-attack");
  if(effects.some(effect=>effect.type==="hurt"))classes.push("combat-motion-hurt");
  if(effects.some(effect=>effect.type==="enemyHurt"))classes.push("combat-motion-enemy-hurt");
  if(effects.some(effect=>effect.type==="defeated"))classes.push("combat-motion-defeated");
  if(effects.some(effect=>effect.type==="brace"))classes.push("combat-motion-brace");
  if(effects.some(effect=>effect.type==="cast"))classes.push("combat-motion-cast");
  if(effects.some(effect=>effect.type==="impact"))classes.push("combat-impact");
  if(effects.some(effect=>effect.type==="impact" && effect.heavy))classes.push("combat-impact-heavy");
  if(attack?.style)classes.push(attackStyleClass(attack.style));
  if(attack?.weapon)classes.push(attackWeaponClass(attack.weapon));
  if(attack?.combo)classes.push(`combat-combo-${attack.combo}`);
  if(!classes.some(cls=>cls.startsWith("combat-motion-")))classes.push("combat-motion-idle");
  return classes.join(" ");
}

function effectHTML(target){
  const overlayEffects = targetEffects(target).map(effect=>{
    if(effect.type==="attack" || effect.type==="enemyAttack" || effect.type==="cast"){
      return fxOverlayHTML(effect.style || effect.type, effect.fx || effect.type, effect.side || (effect.type==="enemyAttack" ? "enemy" : "hero"));
    }
    if(isWeaponImpactEffect(effect.type))return `<span class="combat-weapon-effect combat-${esc(effect.type)}-effect" data-weapon-effect="${esc(effect.type)}" aria-hidden="true"></span>${fxOverlayHTML(effect.style || effect.type, effect.type, effect.side || "hero")}`;
    if(isSpellImpactEffect(effect.type))return `<span class="combat-spell-effect combat-${esc(effect.type)}-effect" data-spell-effect="${esc(effect.type)}" aria-hidden="true"></span>`;
    return "";
  }).join("");
  const renderedKeys = new Set();
  const numbers = targetNumberEvents(target).filter(event=>{
    const key = event.key || numberEventKey(event);
    if(renderedKeys.has(key))return false;
    renderedKeys.add(key);
    return true;
  }).map(event=>{
    const age = Math.min(COMBAT_NUMBER_TTL,Math.max(0,Date.now() - (event.createdAt || Date.now())));
    const lane = Number(event.lane) || 0;
    const x = lane === 1 ? -16 : lane === 2 ? 16 : 0;
    const y = lane === 1 ? -7 : lane === 2 ? -13 : 0;
    return `<span class="damage-pop ${event.type}" data-combat-number-key="${esc(event.key || numberEventKey(event))}" data-combat-number-id="${esc(event.id)}" data-combat-number-source="${esc(event.source)}" data-combat-number-created="${esc(String(event.createdAt || ""))}" data-combat-number-phase="${esc(String(event.phaseId || 0))}" data-combat-number-actor="${esc(event.actor || "")}" data-combat-number-target="${esc(event.target || "")}" style="--combat-number-age:-${age}ms;--combat-number-x:${x}px;--combat-number-y:${y}px">${esc(event.text)}</span>`;
  }).join("");
  return overlayEffects + numbers;
}

function isWeaponImpactEffect(type){
  return ["slash","cleave","thrust","stab","crush","shot","arcane","strike"].includes(type);
}

function isSpellImpactEffect(type){
  return ["spellFire","spellFrost","spellStorm","spellHoly","spellShadow","spellHeal","spellMana","spellWard"].includes(type);
}

function pushWeaponImpact(target, presentation = null){
  const style = presentation || battle?.lastHeroAttack || resolvePlayerCombatPresentation(state.hero);
  pushEffect(target, style.effect || "slash", "", {style:style.style, weapon:style.category || style.weaponCategory, combo:style.combo, side:"hero"});
}

function spellImpactForAbility(id, fallback = "spellHoly"){
  const low = String(id || "").toLowerCase();
  if(/heal|mend|renew|restore|nature/.test(low))return "spellHeal";
  if(/guard|shield|wall|ward|sanctuary/.test(low))return "spellWard";
  if(/fire|flame|ember|cinder/.test(low))return "spellFire";
  if(/ice|frost/.test(low))return "spellFrost";
  if(/lightning|storm|shock/.test(low))return "spellStorm";
  if(/shadow|smoke|vanish/.test(low))return "spellShadow";
  if(/holy|smite|radiant/.test(low))return "spellHoly";
  if(/arcane|mana|bolt|burst/.test(low))return "arcane";
  return fallback;
}

function companionVisualAbility(c){
  const loadout = (c.abilityLoadout || []).filter(Boolean);
  const known = (c.known || []).filter(Boolean);
  const abilities = [...loadout,...known];
  if(c.role === "healer")return abilities.find(id=>/heal|mend|renew|holy|ward/i.test(id)) || "minor_mend";
  if(c.role === "mystic")return abilities.find(id=>/fire|flame|ember|arcane|bolt|burst|mana|holy/i.test(id)) || "fire_bolt";
  if(c.role === "guard")return abilities.find(id=>/guard|shield|wall|bash|taunt/i.test(id)) || "guard_wall";
  if(c.role === "scout")return abilities.find(id=>/quick|smoke|shadow|trap|shot|strike/i.test(id)) || "quick_strike";
  return abilities[0] || "strike";
}

function companionAttackEffect(c){
  const ability = companionVisualAbility(c);
  const low = String(ability).toLowerCase();
  if(isMagicSkill(ability) || c.role === "mystic")return spellImpactForAbility(ability, "arcane");
  if(/shot|aim|bow|ranger/.test(low) || c.role === "scout")return "shot";
  if(/stab|dagger|knife|quick|shadow|smoke/.test(low))return "stab";
  if(/bash|mace|hammer|guard|shield/.test(low) || c.role === "guard")return "crush";
  if(/cleave|axe/.test(low))return "cleave";
  return "slash";
}

function liveEnemies(){return battle.enemies.filter(e=>e.hp>0);}
function visibleEnemies(){
  pruneDefeatedEnemyVisibility();
  return battle.enemies.filter(e=>e.hp>0 || targetEffects(e.id).some(effect=>effect.type==="defeated") || (battle.defeatedEnemyIds?.[e.id] || 0) > Date.now());
}
function liveComps(){return state.hero.companions.filter(c=>c.active&&c.hp>0);}

function markEnemyDefeated(enemy){
  if(!enemy || enemy.hp>0)return;
  battle.defeatedEnemyIds ||= {};
  battle.defeatedEnemyIds[enemy.id] = Date.now() + COMBAT_TIMING.defeatedHold;
  if(targetEffects(enemy.id).some(effect=>effect.type==="defeated"))return;
  pushEffect(enemy.id,"defeated");
}

export function setTarget(index){
  targetIndex = clamp(index,0,Math.max(0,liveEnemies().length-1));
  renderCombat();
}

export function cycleTarget(){
  const live = liveEnemies();
  if(!live.length)return;
  targetIndex = (targetIndex + 1) % live.length;
  renderCombat();
}

function targetBarHTML(playerTurn, live){
  const current = liveTarget();
  const canCycle = playerTurn && live.length > 1;
  return `
    <div class="combat-target-bar">
      <span class="pill ${current?"good":"warn"}">${tx("combatTarget")}: ${esc(current?.name || tx("noTarget"))}</span>
      ${live.length > 1 ? `<button ${canCycle?'onclick="FE.cycleTarget()"':'disabled'}>${tx("nextTarget")}</button>` : ""}
    </div>
  `;
}

function liveTarget(){
  const live = liveEnemies();
  targetIndex = clamp(targetIndex,0,Math.max(0,live.length-1));
  return live[targetIndex];
}

function peekLiveTarget(live = liveEnemies()){
  const index = clamp(targetIndex,0,Math.max(0,live.length - 1));
  return live[index] || null;
}

function heroTurnReadyFor(currentActor){
  return !!(battle && currentActor?.side === "hero" && !battle.resolving && !battle.heroActionLocked && state.hero.hp > 0);
}

function combatMutationContext(){
  const currentActor = peekActor();
  return {
    active:!!battle,
    resolving:!!battle?.resolving,
    hero_action_locked:!!battle?.heroActionLocked,
    current_actor_side:currentActor?.side || null,
    current_actor_id:currentActor?.id || null
  };
}

function potionStateSnapshot(itemId){
  const hero = state?.hero;
  const quantity = itemId === "mana_potion" ? hero?.manaPotions : hero?.potions;
  return {
    quantity:Number(quantity || 0),
    health:{current:Number(hero?.hp || 0),maximum:Number(hero?.maxHp || 0)},
    mana:{current:Number(hero?.mana || 0),maximum:Number(hero?.maxMana || 0)}
  };
}

function potionFailureMessage(code){
  if(code === "no_health_potions")return tx("noPotions");
  if(code === "no_mana_potions")return tx("noManaPotions");
  if(code === "mana_full")return tx("manaFull");
  if(code === "combat_not_active")return "Potion use is only available during active combat.";
  if(code === "combat_resolving")return "Combat is currently resolving another action.";
  if(code === "hero_action_locked")return "The hero's current combat action is locked.";
  if(code === "hero_defeated")return "A defeated hero cannot use a potion.";
  if(code === "hero_turn_required")return "Potions can only be used during the hero's turn.";
  if(code === "blocking_interaction")return "A blocking interaction must be resolved before using a potion.";
  return "That item is not supported by this action.";
}

export function selectPotionUseAvailability(itemId,{blockingInteraction = false} = {}){
  if(itemId !== "health_potion" && itemId !== "mana_potion"){
    return {allowed:false,reason_code:"unsupported_item",reason:potionFailureMessage("unsupported_item")};
  }
  if(!state?.hero || !battle){
    return {allowed:false,reason_code:"combat_not_active",reason:potionFailureMessage("combat_not_active")};
  }
  if(blockingInteraction){
    return {allowed:false,reason_code:"blocking_interaction",reason:potionFailureMessage("blocking_interaction")};
  }
  if(battle.resolving){
    return {allowed:false,reason_code:"combat_resolving",reason:potionFailureMessage("combat_resolving")};
  }
  if(battle.heroActionLocked){
    return {allowed:false,reason_code:"hero_action_locked",reason:potionFailureMessage("hero_action_locked")};
  }
  if(state.hero.hp <= 0){
    return {allowed:false,reason_code:"hero_defeated",reason:potionFailureMessage("hero_defeated")};
  }
  if(peekActor()?.side !== "hero"){
    return {allowed:false,reason_code:"hero_turn_required",reason:potionFailureMessage("hero_turn_required")};
  }
  if(itemId === "health_potion" && Number(state.hero.potions || 0) <= 0){
    return {allowed:false,reason_code:"no_health_potions",reason:potionFailureMessage("no_health_potions")};
  }
  if(itemId === "mana_potion" && Number(state.hero.manaPotions || 0) <= 0){
    return {allowed:false,reason_code:"no_mana_potions",reason:potionFailureMessage("no_mana_potions")};
  }
  if(itemId === "mana_potion" && state.hero.mana >= state.hero.maxMana){
    return {allowed:false,reason_code:"mana_full",reason:potionFailureMessage("mana_full")};
  }
  return {allowed:true,reason_code:null,reason:""};
}

function isHeroTurnReady(){
  return heroTurnReadyFor(actor());
}

function hasPassive(id){
  return !!state.hero.passives?.[id];
}

function heroCritChance(){
  let chance = state.hero.crit || 0;
  if(hasPassive("rogue_critical_precision"))chance += 8;
  if(hasPassive("ranger_precision_shots"))chance += 5;
  chance += activeClassDefinition(state.hero)?.bonus?.crit || 0;
  chance += weaponMasteryBonus(activeWeaponType(state.hero), state.hero).critBonus;
  return chance;
}

function skillCost(id){
  const discount = (hasPassive("mage_mana_efficiency") ? 2 : 0) + (activeClassDefinition(state.hero)?.bonus?.manaDiscount || 0);
  const low = String(id || "").toLowerCase();
  let cost = abilityBaseCost(id);
  if(/quick_strike/.test(low))cost = 6;
  if(/smoke_step|vanish/.test(low))cost = 6;
  if(/aimed_shot|power_strike|cleave|execute/.test(low))cost = 11;
  if(/second_wind/.test(low))cost = 8;
  return Math.max(1,cost-discount);
}

function skillAvailability(id,heroTurnReady,hero = state.hero,target = liveTarget()){
  const cost = skillCost(id);
  const kind = abilityKind(id);
  let blockedReasonCode = null;
  if(!heroTurnReady)blockedReasonCode = "hero_turn_not_ready";
  else if(kind === "strike" && !target)blockedReasonCode = "no_live_target";
  else if(hero.mana < cost)blockedReasonCode = "not_enough_mana";
  return {cost,kind,enabled:blockedReasonCode === null,blockedReasonCode};
}

function combatAction({id,label,category = "combat",enabled = true,blockedReasonCode = null,parameters = {}}){
  return {
    id,
    label:String(label || id),
    category,
    enabled:!!enabled,
    blocked_reason_code:enabled ? null : blockedReasonCode,
    parameters:{...parameters}
  };
}

function peekActiveAbilities(hero = state.hero){
  return activeAbilities({
    known:Array.isArray(hero?.known) ? [...hero.known] : [],
    abilityLoadout:Array.isArray(hero?.abilityLoadout) ? [...hero.abilityLoadout] : []
  });
}

export function selectCombatAvailableActions(){
  if(!battle)return {id:"combat",applicable:false,context:null,actions:[]};
  const currentActor = peekActor();
  const heroTurnReady = heroTurnReadyFor(currentActor);
  const enemies = liveEnemies();
  const target = peekLiveTarget(enemies);
  const turnBlock = heroTurnReady ? null : "hero_turn_not_ready";
  const actions = [
    combatAction({
      id:"combat.attack",
      label:tx("attack"),
      enabled:heroTurnReady && !!target,
      blockedReasonCode:turnBlock || "no_live_target",
      parameters:{target_id:target?.id || null,target_name:target?.name || null}
    }),
    combatAction({id:"combat.defend",label:tx("defend"),enabled:heroTurnReady,blockedReasonCode:turnBlock}),
    combatAction({
      id:"combat.use_health_potion",
      label:tx("healthPotion"),
      category:"consumable",
      enabled:heroTurnReady && Number(state.hero.potions || 0) > 0,
      blockedReasonCode:turnBlock || (Number(state.hero.potions || 0) > 0 ? null : "no_health_potions"),
      parameters:{quantity:Number(state.hero.potions || 0)}
    }),
    combatAction({
      id:"combat.use_mana_potion",
      label:tx("manaPotion"),
      category:"consumable",
      enabled:heroTurnReady && Number(state.hero.manaPotions || 0) > 0 && state.hero.mana < state.hero.maxMana,
      blockedReasonCode:turnBlock
        || (Number(state.hero.manaPotions || 0) <= 0 ? "no_mana_potions" : state.hero.mana >= state.hero.maxMana ? "mana_full" : null),
      parameters:{quantity:Number(state.hero.manaPotions || 0)}
    }),
    combatAction({id:"combat.run",label:tx("run")}),
    combatAction({id:"combat.toggle_auto",label:tx("auto")})
  ];
  peekActiveAbilities(state.hero).forEach(id=>{
    const availability = skillAvailability(id,heroTurnReady,state.hero,target);
    actions.push(combatAction({
      id:`combat.use_skill.${id}`,
      label:abilityName(id),
      category:"combat_skill",
      enabled:availability.enabled,
      blockedReasonCode:availability.blockedReasonCode,
      parameters:{ability_id:id,mana_cost:availability.cost,ability_kind:availability.kind,target_id:availability.kind === "strike" ? target?.id || null : null}
    }));
  });
  if(enemies.length > 1){
    actions.push(combatAction({
      id:"combat.cycle_target",
      label:tx("nextTarget"),
      enabled:heroTurnReady,
      blockedReasonCode:turnBlock
    }));
  }
  return {
    id:"combat",
    applicable:true,
    context:{
      round:Number(battle.round || 0),
      current_actor_side:currentActor?.side || null,
      current_actor_id:currentActor?.id || null,
      hero_turn_ready:heroTurnReady,
      target_id:target?.id || null,
      live_enemy_count:enemies.length
    },
    actions
  };
}

function isMagicSkill(id){
  return /fire|bolt|arcane|ice|frost|lightning|storm|radiant|holy|smite|ember|judgment/.test(id.toLowerCase());
}

function skillDamageMultiplier(id){
  let mult = 1;
  const spellBonus = spellMasteryBonus(id,state.hero);
  if(isMagicSkill(id)){
    if(hasPassive("mage_spell_focus"))mult += .15;
    if(hasPassive("mage_elemental_amplification"))mult += .2;
    if(hasPassive("cleric_radiant_burst") && /holy|radiant|smite/.test(id.toLowerCase()))mult += .2;
    mult += activeClassDefinition(state.hero)?.bonus?.spellDamagePct || 0;
    mult += spellBonus.damagePct;
    mult += classPathCombatBonus("spell", {school:spellBonus.school});
  }else{
    if(hasPassive("ranger_bow_discipline"))mult += .12;
    if(hasPassive("warrior_armor_splitter"))mult += .08;
    const weaponType = activeWeaponType(state.hero);
    mult += weaponMasteryBonus(weaponType,state.hero).damagePct;
    mult += activeClassDefinition(state.hero)?.bonus?.physicalDamagePct || 0;
    mult += classPathCombatBonus("physical", {weaponType});
  }
  return mult;
}

function classPathCombatBonus(kind, context = {}){
  const pathId = activeClassId(state.hero);
  const path = activeClassDefinition(state.hero);
  if(!path?.baseClass)return 0;
  const passives = state.hero.passives || {};
  let bonus = 0;
  if(passives[`${pathId}_adept`])bonus += kind === "defense" ? .04 : .05;
  if(passives[`${pathId}_specialist`]){
    if(context.weaponType && path.focusWeapons?.includes(context.weaponType))bonus += .08;
    if(context.school && path.focusSchools?.includes(context.school))bonus += .08;
    if(kind === "defense" && (path.bonus?.defense || 0) > 0)bonus += .05;
    if(kind === "heal" && path.focusSchools?.includes("restoration"))bonus += .08;
  }
  if(passives[`${pathId}_capstone`])bonus += kind === "defense" ? .06 : .1;
  return bonus;
}

function enemyMisses(){
  let chance = state.hero.dodge || 0;
  if(hasPassive("rogue_evasion"))chance += 12;
  if(hasPassive("ranger_beast_sense"))chance += 8;
  if(hasPassive("rogue_smoke_footwork") && battle.defending)chance += 10;
  return Math.random()*100 < chance;
}

function applyIncomingPassives(dmg,enemy){
  let next = dmg;
  if(hasPassive("cleric_divine_ward"))next *= .9;
  if(hasPassive("mage_arcane_barrier") && state.hero.mana >= 2){
    state.hero.mana -= 2;
    next *= .82;
  }
  if(hasPassive("cleric_undead_resistance") && /skeleton|cultist|cursed|shadow/i.test(`${enemy.name} ${enemy.role}`))next *= .75;
  return Math.max(1,Math.floor(next));
}

function applyVictoryPassives(h){
  if(h.passives.mana_recovery || hasPassive("mage_arcane_recovery") || hasPassive("cleric_mana_prayer")){
    const gain = hasPassive("mage_arcane_recovery") || hasPassive("cleric_mana_prayer") ? 14 : 8;
    h.mana = Math.min(h.maxMana,h.mana+gain);
  }
  if(hasPassive("warrior_battle_endurance")){
    h.hp = Math.min(h.maxHp,h.hp+Math.max(8,Math.floor(h.maxHp*.12)));
  }
}

export function heroAttack(){
  if(!isHeroTurnReady())return;
  const e = liveTarget();
  if(!e)return;
  battle.heroActionLocked = true;
  beginNumberPhase();
  const presentation = beginHeroAttackPresentation();
  const armor = hasPassive("warrior_armor_splitter") ? Math.floor(e.defense*.7) : e.defense;
  const weaponType = activeWeaponType(state.hero);
  const weaponBonus = weaponMasteryBonus(weaponType,state.hero);
  let dmg = Math.max(1,rnd(totalAttack()-3,totalAttack()+7)-armor);
  dmg *= weaponBonus.damageMultiplier;
  dmg *= 1 + (activeClassDefinition(state.hero)?.bonus?.physicalDamagePct || 0) + classPathCombatBonus("physical", {weaponType});
  if(hasPassive("rogue_ambush_discipline") && !battle.heroOffenseUsed)dmg *= 1.3;
  if(hasPassive("ranger_steady_aim") && battle.steadyAim){dmg *= 1.25; battle.steadyAim = false;}
  let crit = false;
  if(Math.random()*100<heroCritChance()){
    crit = true;
    dmg *= hasPassive("rogue_deadly_timing") || state.hero.passives.deadly_timing ? 2.35 : 2;
    battle.log.push("Critical hit!");
  }
  setCombatPlayerVisualState(presentation.pose, COMBAT_TIMING.poseAttack);
  pushEffect("hero","attack","",presentationDetail(presentation,"hero",{heavy:crit || presentation.combo >= 3}));
  const dealt = Math.floor(dmg);
  e.hp = Math.max(0,e.hp-dealt);
  pushImpact(crit || presentation.combo >= 3);
  pushEffect(e.id,"enemyHurt");
  pushWeaponImpact(e.id, presentation);
  pushEffect(e.id,"damage",`-${dealt}`,{source:"heroAttack",actor:"hero"});
  battle.log.push(`${state.hero.name} uses ${styleDisplayName(presentation.style)} on ${e.name} for ${dealt}.`);
  if(hasPassive("rogue_bleed_pressure") && e.hp>0){
    const bleed = Math.max(2,Math.floor(state.hero.level*.8)+3);
    e.hp = Math.max(0,e.hp-bleed);
    pushImpact();
    pushEffect(e.id,"enemyHurt");
    pushEffect(e.id,"damage",`-${bleed}`,{source:"heroBleed"});
    battle.log.push(`${e.name} bleeds for ${bleed}.`);
  }
  if(hasPassive("warrior_double_strike") && e.hp>0 && Math.random()<.18){
    const extra = Math.max(1,Math.floor(dealt*.45));
    e.hp = Math.max(0,e.hp-extra);
    pushImpact();
    pushEffect(e.id,"enemyHurt");
    pushEffect(e.id,"damage",`-${extra}`,{source:"heroDoubleStrike"});
    const follow = beginHeroAttackPresentation();
    setCombatPlayerVisualState(follow.pose, COMBAT_TIMING.poseAttack);
    pushEffect("hero","attack","",presentationDetail(follow,"hero",{heavy:true}));
    battle.log.push(`${state.hero.name} follows through with ${styleDisplayName(follow.style)} for ${extra}.`);
  }
  markEnemyDefeated(e);
  addWeaponXp(weaponType,5);
  battle.heroOffenseUsed = true;
  afterHeroAction();
}

export function toggleSkills(){
  skillOpen = !skillOpen;
  renderCombat();
}

function skillDrawerHTML(enabled){
  const h = state.hero;
  const active = activeAbilities(h);
  return `<div class="skill-drawer">${active.length
    ? `<div class="skill-drawer-grid">${active.map(id=>skillButtonHTML(id, enabled, h)).join("")}</div>`
    : `<p>${tx("noActiveAbilities")}</p><p class="skill-drawer-hint">${esc(tx("equipInAbilityBook"))}</p>`}
  </div>`;
}

function skillButtonHTML(id, enabled, hero){
  const availability = skillAvailability(id,enabled,hero,liveTarget());
  return `<button class="skill-drawer-btn" ${availability.enabled?`onclick="FE.useSkill('${id}')"`:"disabled"}>
    <b>${esc(abilityName(id))}</b>
    <span class="skill-drawer-meta">
      <span class="pill">${tx("mana")} ${availability.cost}</span>
      <span class="pill">${esc(abilityKindLabel(id))}</span>
    </span>
  </button>`;
}

export function useSkill(id){
  if(!isHeroTurnReady())return;
  const h = state.hero, low = id.toLowerCase();
  if(!activeAbilities(h).includes(id)){
    battle.log.push(tx("abilityNotActive"));
    renderCombat();
    return;
  }
  const cost = skillCost(id);
  const kind = abilityKind(id);
  const cleave = /cleave|arcane_burst/.test(low);
  if(kind === "strike" && !cleave && !liveTarget()){
    battle.log.push(tx("noTarget"));
    renderCombat();
    return;
  }
  if(h.mana<cost){
    battle.log.push(tx("notEnoughMana"));
    renderCombat();
    return;
  }
  battle.heroActionLocked = true;
  beginNumberPhase();
  h.mana -= cost;
  const school = spellSchoolForAbility(id);
  if(kind === "heal"){
    setCombatPlayerVisualState("castAttack", COMBAT_TIMING.poseSkill);
    pushEffect("hero","cast");
    pushEffect("hero",spellImpactForAbility(id,"spellHeal"));
    const spellBonus = spellMasteryBonus(id,h);
    const classHeal = (activeClassDefinition(h)?.bonus?.healingPct || 0) + classPathCombatBonus("heal", {school:spellBonus.school});
    let heal = Math.floor((20+h.level*4+(h.stats.wisdom||0)*9)*((h.passives.healer_training||hasPassive("cleric_healing_focus"))?1.25:1)*spellBonus.healingMultiplier*(1+classHeal));
    if(/field_mend/.test(low))heal = Math.floor(heal * .72);
    if(/second_wind/.test(low))heal = Math.floor(h.maxHp * (0.18 + (h.stats.endurance || 0) * 0.01));
    if(/renew/.test(low)){
      heal = Math.floor(heal * .55);
      battle.heroRegen = Math.max(battle.heroRegen || 0, Math.max(6, Math.floor(heal * .5)));
    }
    h.hp = Math.min(h.maxHp,h.hp+Math.floor(heal));
    pushEffect("hero","heal",`+${Math.floor(heal)}`,{source:`skill:${id}`,actor:"hero"});
    battle.log.push(`${h.name} uses ${title(id)} and heals ${Math.floor(heal)}.`);
    addSpellXp(id,5);
  }else if(kind === "ward"){
    battle.defending = true;
    battle.heroCombo = 0;
    if(/guard_wall/.test(low))battle.ironWard = true;
    if(/smoke_step|vanish/.test(low))battle.heroEvasion = (battle.heroEvasion || 0) + 1;
    if(/taunt/.test(low))battle.taunt = true;
    if(/holy_guard/.test(low)){
      const wardHeal = 8 + h.level * 2 + (h.stats.wisdom || 0) * 2;
      h.hp = Math.min(h.maxHp, h.hp + wardHeal);
      pushEffect("hero","heal",`+${wardHeal}`,{source:`skill:${id}`,actor:"hero"});
    }
    setCombatPlayerVisualState("block", COMBAT_TIMING.poseBlock);
    pushEffect("hero","brace");
    pushEffect("hero",spellImpactForAbility(id,"spellWard"));
    battle.log.push(`${h.name} uses ${title(id)}${/smoke_step|vanish/.test(low) ? " and slips the next blow." : /taunt/.test(low) ? " and draws the next strike." : " and braces."}`);
    if(school)addSpellXp(id,4);
  }else{
    const targets = cleave ? liveEnemies() : [liveTarget()].filter(Boolean);
    if(!targets.length){
      battle.log.push(tx("noTarget"));
      battle.heroActionLocked = false;
      h.mana += cost;
      renderCombat();
      return;
    }
    const magic = isMagicSkill(id);
    const presentation = magic ? null : beginHeroAttackPresentation();
    setCombatPlayerVisualState(magic ? "castAttack" : presentation.pose, COMBAT_TIMING.poseSkill);
    pushEffect("hero", magic ? "cast" : "attack", "", magic ? {side:"hero"} : presentationDetail(presentation,"hero"));
    targets.forEach(e=>{
      let dmg = magic
        ? Math.floor(16+h.level*5+(h.stats.wisdom||0)*7)
        : Math.floor(12+h.level*4+(h.stats.strength||0)*4+totalAttack()*.8);
      dmg = Math.floor(dmg * skillDamageMultiplier(id));
      if(/power_strike/.test(low))dmg = Math.floor(dmg * 1.28);
      if(/quick_strike/.test(low))dmg = Math.floor(dmg * 0.88);
      if(/aimed_shot/.test(low))dmg = Math.floor(dmg * 1.12 + Math.max(0, e.defense * 0.5));
      if(/execute/.test(low) && e.hp <= e.maxHp * 0.4)dmg = Math.floor(dmg * 1.75);
      if(/shadow_strike/.test(low))dmg = Math.floor(dmg * 1.45);
      if(/cleave/.test(low) && targets.length > 1)dmg = Math.floor(dmg * 0.78);
      if(/shield_bash/.test(low)){
        dmg = Math.floor(dmg * 0.7);
        e.snared = (e.snared || 0) + 1;
      }
      if(/trap_snare/.test(low))e.snared = (e.snared || 0) + 1;
      if(hasPassive("rogue_ambush_discipline") && !battle.heroOffenseUsed)dmg = Math.floor(dmg*1.25);
      if(hasPassive("mage_overchannel") && magic && Math.random()<.15){
        dmg = Math.floor(dmg*1.35);
        battle.log.push("Overchannel!");
      }
      e.hp = Math.max(0,e.hp-dmg);
      if(/fire_bolt|ember/.test(low))e.burn = Math.max(e.burn || 0, 3);
      pushImpact(presentation?.combo >= 3);
      pushEffect(e.id,"enemyHurt");
      if(magic)pushEffect(e.id,spellImpactForAbility(id,"arcane"));
      else pushWeaponImpact(e.id, presentation);
      pushEffect(e.id,"damage",`-${dmg}`,{source:`skill:${id}`,actor:"hero"});
      markEnemyDefeated(e);
      battle.log.push(`${h.name} uses ${title(id)}${presentation ? ` (${styleDisplayName(presentation.style)})` : ""} on ${e.name} for ${dmg}.`);
    });
    if(/quick_strike/.test(low) && targets[0] && targets[0].hp > 0 && targets[0].hp < targets[0].maxHp){
      const e = targets[0];
      const poke = Math.max(1, Math.floor((8 + h.level * 2 + (h.stats.speed || 0) * 2) * skillDamageMultiplier(id)));
      e.hp = Math.max(0, e.hp - poke);
      pushEffect(e.id,"damage",`-${poke}`,{source:`skill:${id}:follow`,actor:"hero"});
      markEnemyDefeated(e);
      battle.log.push(`${h.name} cuts again for ${poke}.`);
    }
    battle.heroOffenseUsed = true;
    if(isMagicSkill(id) || school)addSpellXp(id,6);
    else addWeaponXp(activeWeaponType(h),3);
  }
  skillOpen = false;
  afterHeroAction();
}

export function usePotion(){
  if(!isHeroTurnReady())return;
  const h = state.hero;
  if(h.potions<=0){
    battle.log.push(tx("noPotions"));
    renderCombat();
    return;
  }
  battle.heroActionLocked = true;
  beginNumberPhase();
  h.potions--;
  setCombatPlayerVisualState("castAttack", COMBAT_TIMING.poseSkill);
  pushEffect("hero","cast");
  pushEffect("hero","spellHeal");
  const heal = Math.floor((50+h.level*8) * (hasPassive("ranger_survival_tactics") ? 1.15 : 1));
  h.hp = Math.min(h.maxHp,h.hp+heal);
  pushEffect("hero","heal",`+${heal}`,{source:"healthPotion",actor:"hero"});
  battle.log.push(`${h.name} ${tx("heroHealthPotion")} ${heal} ${tx("hp")}.`);
  save();
  afterHeroAction();
}

export function useManaPotion(){
  if(!isHeroTurnReady())return;
  const h = state.hero;
  if(h.manaPotions<=0){
    battle.log.push(tx("noManaPotions"));
    renderCombat();
    return;
  }
  if(h.mana>=h.maxMana){
    battle.log.push(tx("manaFull"));
    renderCombat();
    return;
  }
  battle.heroActionLocked = true;
  beginNumberPhase();
  h.manaPotions--;
  setCombatPlayerVisualState("castAttack", COMBAT_TIMING.poseSkill);
  pushEffect("hero","cast");
  pushEffect("hero","spellMana");
  const gain = 35 + h.level * 6;
  const before = h.mana;
  h.mana = Math.min(h.maxMana,h.mana+gain);
  pushEffect("hero","mana",`+${h.mana-before}`,{source:"manaPotion",actor:"hero"});
  battle.log.push(`${h.name} ${tx("heroManaPotion")} ${h.mana-before} ${tx("mana")}.`);
  save();
  afterHeroAction();
}

export function executeSupportedPotionUse(itemId,options = {}){
  const before = potionStateSnapshot(itemId);
  const combatBefore = combatMutationContext();
  const availability = selectPotionUseAvailability(itemId,options);
  if(!availability.allowed){
    return {
      ok:false,
      accepted:false,
      success:false,
      item_id:itemId,
      item_used:null,
      item_consumed:false,
      before,
      after:potionStateSnapshot(itemId),
      combat:combatMutationContext(),
      combat_resolving:!!battle?.resolving,
      error:{code:availability.reason_code,message:availability.reason}
    };
  }

  let executionError = null;
  let executionCompleted = false;
  try{
    if(itemId === "health_potion")usePotion();
    else useManaPotion();
    executionCompleted = true;
  }catch(error){
    executionError = error instanceof Error ? error.message : String(error);
  }

  const after = potionStateSnapshot(itemId);
  const combatAfter = combatMutationContext();
  const itemConsumed = after.quantity === before.quantity - 1;
  const success = executionCompleted && itemConsumed && combatAfter.resolving && combatAfter.hero_action_locked;
  return {
    ok:success,
    accepted:true,
    success,
    item_id:itemId,
    item_used:itemConsumed ? itemId : null,
    item_consumed:itemConsumed,
    before,
    after,
    combat_before:combatBefore,
    combat:combatAfter,
    combat_resolving:combatAfter.resolving,
    error:success ? null : {
      code:executionError ? "execution_error" : itemConsumed ? "execution_incomplete" : "execution_not_confirmed",
      message:executionError || (itemConsumed
        ? "The potion was consumed, but combat did not enter its canonical resolving state."
        : "The canonical potion action did not consume the requested item.")
    }
  };
}

export function defend(){
  if(!isHeroTurnReady())return;
  battle.heroActionLocked = true;
  beginNumberPhase();
  battle.defending = true;
  battle.heroCombo = 0;
  if(hasPassive("ranger_steady_aim"))battle.steadyAim = true;
  setCombatPlayerVisualState("block", COMBAT_TIMING.poseBlock);
  pushEffect("hero","brace");
  battle.log.push(`${state.hero.name} defends.`);
  afterHeroAction();
}

function afterHeroAction(){
  if(checkEnd())return;
  battle.resolving = true;
  renderCombat();
  resolvingTimer = setTimeout(()=>{advanceTurn();resolveUntilHero();},COMBAT_TIMING.turnAdvance);
}

function resolveUntilHero(){
  if(!battle)return;
  let a = actor();
  if(!a)return;
  if(a.side==="hero"){
    tickHeroRegen();
    battle.resolving = false;
    battle.heroActionLocked = false;
    renderCombat();
    if(autoFight)resolvingTimer = setTimeout(heroAttack,900);
    return;
  }
  battle.resolving = true;
  renderCombat();
  resolvingTimer = setTimeout(()=>{
    a = actor();
    if(a?.side==="comp")compAct(a.id);
    if(a?.side==="enemy")enemyAct(a.id);
    if(checkEnd())return;
    renderCombat();
    resolvingTimer = setTimeout(()=>{
      beginNumberPhase();
      advanceTurn();
      resolveUntilHero();
    },COMBAT_NUMBER_PHASE_PAUSE);
  },COMBAT_TIMING.turnWindup);
}

function compAct(id){
  const c = state.hero.companions.find(x=>x.id===id);
  const e = liveTarget();
  if(!c)return;
  normalizeCompanion(c);
  beginNumberPhase();
  if(companionShouldHeal(c)){
    companionHeal(c);
    return;
  }
  if(companionShouldGuard(c)){
    battle.companionGuard = {id:c.id,name:c.name,reduction:companionGuardReduction(c)};
    pushEffect(`comp_${c.id}`,"brace");
    pushEffect(`comp_${c.id}`,"spellWard");
    pushEffect("hero","spellWard");
    battle.log.push(`${c.name} guards ${state.hero.name}.`);
    return;
  }
  if(!e)return;
  const attackEffect = companionAttackEffect(c);
  const isCasterAttack = isSpellImpactEffect(attackEffect) || attackEffect === "arcane";
  const presentation = isCasterAttack ? null : beginCompanionAttackPresentation(c);
  pushEffect(`comp_${c.id}`, isCasterAttack ? "cast" : "attack", "", isCasterAttack ? {side:"hero"} : presentationDetail(presentation,"hero"));
  if(isCasterAttack)pushEffect(`comp_${c.id}`,attackEffect);
  const dmg = companionDamage(c,e);
  e.hp = Math.max(0,e.hp-dmg);
  pushImpact(presentation?.combo >= 3);
  pushEffect(e.id,"enemyHurt");
  pushEffect(e.id,attackEffect);
  pushEffect(e.id,"damage",`-${dmg}`,{source:`comp:${id}`,actor:id});
  markEnemyDefeated(e);
  battle.log.push(`${c.name} ${presentation ? `uses ${styleDisplayName(presentation.style)} on` : "hits"} ${e.name} for ${dmg}.`);
}

function companionShouldHeal(c){
  if(!["support","balanced"].includes(c.tactic) && c.role !== "healer")return false;
  if(!/heal|mend|renew|minor_mend|nature/i.test((c.known || []).join(" ")))return false;
  if((c.mana || 0) < 8)return false;
  return !!companionHealTarget(c);
}

function companionHealTarget(c){
  const allies = [state.hero,...liveComps()].filter(unit=>unit && unit.hp > 0 && unit.id !== c.id);
  return allies
    .filter(unit=>unit.hp < unit.maxHp * (c.tactic === "support" || c.role === "healer" ? .72 : .45))
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0] || null;
}

function companionHeal(c){
  const target = companionHealTarget(c);
  if(!target)return;
  const cost = c.role === "healer" ? 7 : 9;
  c.mana = Math.max(0,(c.mana || 0) - cost);
  const bondBonus = 1 + ((c.bond?.level || 1) - 1) * .025;
  const trainingBonus = 1 + (c.training?.rank || 0) * .018;
  const heal = Math.floor((18 + c.level * 5 + (c.role === "healer" ? 8 : 0)) * bondBonus * trainingBonus);
  target.hp = Math.min(target.maxHp,target.hp + heal);
  const targetId = target === state.hero ? "hero" : `comp_${target.id}`;
  const ability = companionVisualAbility(c);
  pushEffect(`comp_${c.id}`,"cast");
  pushEffect(`comp_${c.id}`,spellImpactForAbility(ability,"spellHeal"));
  pushEffect(targetId,"spellHeal");
  pushEffect(targetId,"heal",`+${heal}`,{source:`compHeal:${c.id}`,actor:c.id});
  battle.log.push(`${c.name} heals ${target.name} for ${heal}.`);
}

function companionShouldGuard(c){
  if(c.tactic !== "guardian" && c.role !== "guard")return false;
  if(state.hero.hp <= state.hero.maxHp * .85)return true;
  return Math.random() < (c.role === "guard" ? .32 : .18);
}

function companionGuardReduction(c){
  return Math.min(.42,.22 + (c.training?.rank || 0) * .012 + ((c.bond?.level || 1) - 1) * .01 + (c.role === "guard" ? .08 : 0));
}

function companionDamage(c,e){
  const roleMult = c.role === "scout" ? 1.08 : c.role === "mystic" ? 1.12 : c.role === "guard" ? .9 : 1;
  const tacticMult = c.tactic === "aggressive" ? 1.18 : c.tactic === "support" ? .82 : c.tactic === "guardian" ? .9 : 1;
  const bondMult = 1 + ((c.bond?.level || 1) - 1) * .025;
  const trainingMult = 1 + (c.training?.rank || 0) * .018;
  let dmg = Math.max(1,rnd(c.attack,c.attack+c.level+6)-e.defense);
  dmg = Math.floor(dmg * roleMult * tacticMult * bondMult * trainingMult);
  const critChance = (c.role === "scout" ? 12 : 4) + Math.floor(((c.bond?.level || 1) - 1) / 2);
  if(Math.random() * 100 < critChance){
    dmg = Math.floor(dmg * 1.65);
    battle.log.push(`${c.name} finds an opening.`);
  }
  return Math.max(1,dmg);
}

function tickHeroRegen(){
  if(!battle?.heroRegen || state.hero.hp <= 0)return;
  const heal = battle.heroRegen;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + heal);
  pushEffect("hero","heal",`+${heal}`,{source:"regen",actor:"hero"});
  battle.log.push(`${state.hero.name} mends for ${heal}.`);
  battle.heroRegen = 0;
}

function tickEnemyBurn(e){
  if(!e || e.hp <= 0 || !e.burn)return;
  const burn = Math.max(1, Math.min(8, e.burn));
  e.hp = Math.max(0, e.hp - burn);
  pushEffect(e.id,"damage",`-${burn}`,{source:"burn",actor:"hero"});
  battle.log.push(`${e.name} burns for ${burn}.`);
  e.burn = Math.max(0, e.burn - 1);
  markEnemyDefeated(e);
}

function enemyAct(id){
  const e = battle.enemies.find(x=>x.id===id);
  if(!e||e.hp<=0)return;
  tickEnemyBurn(e);
  if(e.hp<=0)return;
  if(e.snared){
    e.snared -= 1;
    beginNumberPhase();
    battle.log.push(`${e.name} is held and skips the strike.`);
    return;
  }
  beginNumberPhase();
  const presentation = beginEnemyAttackPresentation(e);
  pushEffect(e.id,"enemyAttack","",presentationDetail(presentation,"enemy"));
  const targets = [{type:"hero",u:state.hero},...liveComps().map(c=>({type:"comp",u:c}))];
  const target = battle.taunt ? {type:"hero",u:state.hero} : targets[rnd(0,targets.length-1)];
  if(battle.taunt && target.type==="hero")battle.taunt = false;
  if(target.type==="hero" && (battle.heroEvasion || enemyMisses())){
    if(battle.heroEvasion)battle.heroEvasion = Math.max(0, battle.heroEvasion - 1);
    pushEffect("hero","miss",tx("miss"),{source:`enemyMiss:${id}`,actor:id});
    battle.log.push(`${e.name} misses ${target.u.name}.`);
    return;
  }
  const armor = target.type==="hero" ? totalDefense() : target.u.defense;
  let dmg = Math.max(1,rnd(e.attack-3,e.attack+3)-armor);
  const capRate = target.type==="hero" && hasPassive("ranger_survival_tactics") ? .14 : .16;
  const cap = Math.max(3,Math.ceil(target.u.maxHp*capRate));
  dmg = Math.min(dmg,cap);
  if(target.type==="hero" && battle.companionGuard){
    const guard = battle.companionGuard;
    dmg = Math.max(1,Math.floor(dmg * (1 - guard.reduction)));
    pushEffect(`comp_${guard.id}`,"brace");
    battle.log.push(`${guard.name} softens the blow.`);
    battle.companionGuard = null;
  }
  if(target.type==="hero" && battle.defending){
    dmg = Math.max(1,Math.floor(dmg*(hasPassive("warrior_guard_wall") || battle.ironWard ? .28 : .45)));
    battle.defending = false;
    battle.ironWard = false;
  }
  if(target.type==="hero")dmg = applyIncomingPassives(dmg,e);
  if(target.type==="hero" && dmg >= target.u.hp){
    if(hasPassive("warrior_last_stand") && !battle.lastStandUsed){
      battle.lastStandUsed = true;
      target.u.hp = 1;
      pushEffect("hero","miss","1",{source:"lastStand",actor:"hero"});
      battle.log.push(`${target.u.name} holds the Last Stand.`);
      return;
    }
    if(hasPassive("cleric_guardian_prayer") && !battle.guardianPrayerUsed){
      battle.guardianPrayerUsed = true;
      target.u.hp = 1;
      pushEffect("hero","miss","1",{source:"guardianPrayer",actor:"hero"});
      battle.log.push(`${target.u.name} is saved by Guardian Prayer.`);
      return;
    }
  }
  target.u.hp = Math.max(0,target.u.hp-dmg);
  const hitTarget = target.type==="hero" ? "hero" : `comp_${target.u.id}`;
  if(target.type==="hero")setCombatPlayerVisualState(target.u.hp <= 0 ? "defeated" : "hurt", target.u.hp <= 0 ? 0 : COMBAT_TIMING.poseHurt);
  pushImpact(presentation.combo >= 3);
  pushEffect(hitTarget,"hurt");
  pushEffect(hitTarget, presentation.effect, "", presentationDetail(presentation,"enemy"));
  pushEffect(hitTarget,"damage",`-${dmg}`,{source:`enemyAttack:${id}`,actor:id});
  battle.log.push(`${e.name} uses ${styleDisplayName(presentation.style)} on ${target.u.name} for ${dmg}.`);
}

export function debugCombatMotion(){
  if(!battle){
    startBattle([makeEnemy(false)], "Debug combat motion test.", {source:"debug"});
  }
  pushEffect("hero","attack");
  setCombatPlayerVisualState(resolvePlayerAttackPose(state.hero), COMBAT_TIMING.poseDebug);
  pushImpact();
  pushEffect("hero","hurt");
  const e = liveEnemies()[0];
  if(e){
    pushEffect(e.id,"enemyAttack");
    pushEffect(e.id,"enemyHurt");
    pushWeaponImpact(e.id);
    pushEffect(e.id,"damage","-12",{source:"debugCombatMotion"});
  }
  renderCombat();
  return {ok:true, effects:battle?.effects?.map(({target,type,text})=>({target,type,text})) || []};
}

export function debugTriggerPlayerAttackMotion(){
  if(!battle)startBattle([makeEnemy(false)], "Debug player attack motion.", {source:"debug"});
  const presentation = beginHeroAttackPresentation();
  setCombatPlayerVisualState(presentation.pose, COMBAT_TIMING.poseDebug);
  pushEffect("hero","attack","",presentationDetail(presentation,"hero",{heavy:true}));
  pushImpact(true);
  renderCombat();
  return {ok:true,target:"hero",type:"attack",style:presentation.style,pose:getPlayerPoseAsset(state.hero, combatPlayerVisualState)};
}

export function debugPlayAttackStyle(style, side = "hero"){
  if(!battle)startBattle([makeEnemy(false)], "Attack style preview.", {source:"debug"});
  if(side === "enemy"){
    const e = liveEnemies()[0];
    if(!e)return {ok:false,reason:"no enemy"};
    const presentation = presentationForStyle(style, "enemy", e);
    pushEffect(e.id,"enemyAttack","",presentationDetail(presentation,"enemy",{heavy:true}));
    pushImpact(true);
    pushEffect("hero","hurt");
    setCombatPlayerVisualState("hurt", COMBAT_TIMING.poseHurt);
  }else{
    const presentation = presentationForStyle(style, "hero", state.hero);
    setCombatPlayerVisualState(presentation.pose, COMBAT_TIMING.poseDebug);
    pushEffect("hero","attack","",presentationDetail(presentation,"hero",{heavy:true}));
    const e = liveEnemies()[0];
    if(e){
      pushEffect(e.id,"enemyHurt");
      pushWeaponImpact(e.id, presentation);
    }
    pushImpact(true);
  }
  renderCombat();
  return {ok:true,style,side};
}

export function debugEquipWeaponCategory(category){
  state.hero.gear ||= {};
  if(category === "unarmed"){
    state.hero.gear.weapon = null;
  }else if(category === "shield"){
    state.hero.gear.weapon = null;
    state.hero.gear.offhand = applyGearVisuals({name:"Wooden Shield", slot:"offhand", defense:4});
  }else{
    const names = {
      sword:"Iron Sword",
      axe:"Ash Axe",
      spear:"War Spear",
      mace:"Iron Mace",
      dagger:"Crypt Dagger",
      bow:"Hunter Bow",
      staff:"Oak Staff"
    };
    state.hero.gear.weapon = applyGearVisuals({name:names[category] || "Iron Sword", slot:"weapon", attack:8, level:3});
    if(category !== "unarmed")state.hero.gear.offhand = category === "bow" ? null : state.hero.gear.offhand;
  }
  save();
  if(battle){
    battle.heroCombo = 0;
    renderCombat();
  }
  return {ok:true, category, weapon:state.hero.gear.weapon, offhand:state.hero.gear.offhand};
}

export function debugTriggerPlayerHurtMotion(){
  if(!battle)startBattle([makeEnemy(false)], "Debug player hurt motion.", {source:"debug"});
  setCombatPlayerVisualState("hurt", COMBAT_TIMING.poseDebug);
  pushEffect("hero","hurt");
  pushEffect("hero","damage","-7",{source:"debugPlayerHurt"});
  renderCombat();
  return {ok:true,target:"hero",type:"hurt",pose:getPlayerPoseAsset(state.hero, "hurt")};
}

export function debugTriggerEnemyHurtMotion(){
  if(!battle)startBattle([makeEnemy(false)], "Debug enemy hurt motion.", {source:"debug"});
  const e = liveEnemies()[0];
  if(e){
    pushEffect(e.id,"enemyHurt");
    pushWeaponImpact(e.id);
    pushEffect(e.id,"damage","-9",{source:"debugEnemyHurt"});
    pushImpact();
  }
  renderCombat();
  return {ok:!!e,target:e?.id || null,type:"enemyHurt"};
}

export function debugTriggerCompanionMotion(mode = "attack"){
  if(!battle || !liveComps().length){
    if(isLocalDebugEnabled())debugStartCombatLayoutTest(2,2);
    else startBattle([makeEnemy(false)], "Debug companion motion.", {source:"debug"});
  }
  const c = liveComps()[0];
  const e = liveEnemies()[0];
  if(!c)return {ok:false,reason:"no active companion"};
  normalizeCompanion(c);
  const targetId = `comp_${c.id}`;
  const requested = String(mode || "attack").toLowerCase();
  beginNumberPhase();
  if(requested === "guard" || requested === "brace"){
    pushEffect(targetId,"brace");
    pushEffect(targetId,"spellWard");
    pushEffect("hero","spellWard");
  }else if(requested === "heal"){
    pushEffect(targetId,"cast");
    pushEffect(targetId,"spellHeal");
    pushEffect("hero","spellHeal");
    pushEffect("hero","heal","+22",{source:"debugCompanionHeal",actor:c.id});
  }else if(requested === "cast"){
    const spellEffect = spellImpactForAbility(companionVisualAbility(c),"spellHoly");
    pushEffect(targetId,"cast");
    pushEffect(targetId,spellEffect);
    if(e){
      pushEffect(e.id,"enemyHurt");
      pushEffect(e.id,spellEffect);
      pushEffect(e.id,"damage","-11",{source:"debugCompanionCast",actor:c.id});
    }
  }else{
    const attackEffect = companionAttackEffect(c);
    const isCasterAttack = isSpellImpactEffect(attackEffect) || attackEffect === "arcane";
    pushEffect(targetId,isCasterAttack ? "cast" : "attack");
    if(isCasterAttack)pushEffect(targetId,attackEffect);
    if(e){
      pushEffect(e.id,"enemyHurt");
      pushEffect(e.id,attackEffect);
      pushEffect(e.id,"damage","-9",{source:"debugCompanionAttack",actor:c.id});
      pushImpact();
    }
  }
  renderCombat();
  return {
    ok:true,
    companion:c.name,
    requested,
    effects:battle?.effects?.map(({target,type})=>({target,type})) || [],
    numbers:battle?.numberEvents?.map(({target,type,text,source})=>({target,type,text,source})) || []
  };
}

export function debugCombatTiming(){
  return {
    ...COMBAT_TIMING,
    activePose:combatPlayerVisualState,
    activeEffects:battle?.effects?.map(({target,type})=>({target,type})) || [],
    activeNumberEvents:battle?.numberEvents?.map(({id,target,type,text,source,phaseId,actor,createdAt,key})=>({id,target,type,text,source,phaseId,actor,createdAt,key})) || []
  };
}

export function debugCombatPopupDom(){
  if(typeof document === "undefined")return [];
  const rows = [...document.querySelectorAll(NUMERIC_POPUP_SELECTOR)].map(node=>({
    text:node.textContent.trim(),
    className:node.className,
    key:node.getAttribute("data-combat-number-key") || "",
    id:node.getAttribute("data-combat-number-id") || "",
    source:node.getAttribute("data-combat-number-source") || "",
    phase:node.getAttribute("data-combat-number-phase") || "",
    target:node.getAttribute("data-combat-number-target") || ""
  }));
  if(typeof console !== "undefined" && console.table)console.table(rows);
  return rows;
}

function debugEnemyTemplate(enemyVisualClass = "skeleton"){
  const templates = {
    skeleton:{name:"Skeleton",role:"enemy",enemyVisualClass:"skeleton",level:1,hp:88,maxHp:88,attack:6,defense:1,speed:1,xp:1,gold:1},
    wolf:{name:"Wolf",role:"enemy",enemyVisualClass:"wolf",level:1,hp:88,maxHp:88,attack:6,defense:1,speed:1,xp:1,gold:1},
    bandit:{name:"Bandit",role:"enemy",enemyVisualClass:"bandit",level:1,hp:88,maxHp:88,attack:6,defense:1,speed:1,xp:1,gold:1},
    cultist:{name:"Cultist",role:"enemy",enemyVisualClass:"cultist",level:1,hp:88,maxHp:88,attack:6,defense:1,speed:1,xp:1,gold:1},
    corrupted_knight:{name:"Corrupted Knight",role:"elite",enemyVisualClass:"corrupted_knight",level:4,hp:148,maxHp:148,attack:10,defense:5,speed:1,xp:1,gold:1}
  };
  return {...(templates[enemyVisualClass] || templates.skeleton)};
}

export function debugStartEnemyVisualTest(enemyVisualClass = "skeleton"){
  if(!isLocalDebugEnabled())return {ok:false,reason:"debug only"};
  debugEnemyVisualPoseOverride = "idle";
  startBattle([debugEnemyTemplate(enemyVisualClass)], `Debug enemy visual test: ${enemyVisualClass}.`, {source:"enemy-visual-debug"});
  battle.resolving = false;
  battle.index = Math.max(0,battle.queue.findIndex(entry=>entry.side === "hero"));
  renderCombat();
  return {ok:true,enemyVisualClass,pose:debugEnemyVisualPoseOverride};
}

export function debugForceEnemyVisualPose(pose = "idle"){
  if(!isLocalDebugEnabled())return {ok:false,reason:"debug only"};
  if(!["idle","attack","hurt","defeated"].includes(pose))pose = "idle";
  if(!battle || battle.meta?.source !== "enemy-visual-debug")debugStartEnemyVisualTest("skeleton");
  debugEnemyVisualPoseOverride = pose;
  battle.effects = [];
  battle.resolving = false;
  if(pose === "attack")pushEffect(battle.enemies[0].id,"enemyAttack");
  if(pose === "hurt"){
    pushEffect(battle.enemies[0].id,"enemyHurt");
    pushEffect(battle.enemies[0].id,"damage","-9",{source:"debugForceEnemyHurt"});
  }
  renderCombat();
  return {ok:true,pose,enemy:battle.enemies[0]?.name};
}

export function debugResetEnemyVisualTest(){
  debugEnemyVisualPoseOverride = null;
  if(battle?.meta?.source === "enemy-visual-debug"){
    battle = null;
    autoFight = false;
    skillOpen = false;
    show("home");
  }
  return {ok:true};
}

export function debugStartCombatLayoutTest(enemyCount = 3, companionCount = 2){
  if(!isLocalDebugEnabled())return {ok:false,reason:"debug only"};
  if(!state?.hero)return {ok:false,reason:"no hero"};
  const desiredCompanions = Math.max(0,Math.min(3,Number(companionCount) || 0));
  const templates = [
    {id:"layout_comp_scout",name:"Mira",class:"scout",role:"scout",level:2,hp:88,maxHp:88,mana:18,maxMana:18,attack:12,defense:4,speed:8,active:true,known:["quick_strike"],abilityLoadout:["quick_strike"]},
    {id:"layout_comp_guard",name:"Old Garran",class:"fighter",role:"fighter",level:2,hp:118,maxHp:118,mana:10,maxMana:10,attack:11,defense:7,speed:4,active:true,known:["guard_wall"],abilityLoadout:["guard_wall"]},
    {id:"layout_comp_healer",name:"Sella",class:"healer",role:"healer",level:2,hp:82,maxHp:82,mana:34,maxMana:34,attack:8,defense:3,speed:5,active:true,known:["minor_mend"],abilityLoadout:["minor_mend"]}
  ];
  state.hero.companions = templates.slice(0,desiredCompanions).map(companion=>({...companion}));
  const enemyTemplates = [
    {name:"Corner Knife",role:"enemy",enemyVisualClass:"bandit",level:3,hp:109,maxHp:109,attack:12,defense:4,speed:5,xp:1,gold:1},
    {name:"Road Skeleton",role:"enemy",enemyVisualClass:"skeleton",level:2,hp:88,maxHp:88,attack:9,defense:3,speed:3,xp:1,gold:1},
    {name:"Ash Wolf",role:"enemy",enemyVisualClass:"wolf",level:2,hp:92,maxHp:92,attack:11,defense:3,speed:7,xp:1,gold:1},
    {name:"Cultist Knave",role:"enemy",enemyVisualClass:"cultist",level:4,hp:126,maxHp:126,attack:13,defense:5,speed:4,xp:1,gold:1}
  ];
  const count = Math.max(1,Math.min(4,Number(enemyCount) || 1));
  startBattle(enemyTemplates.slice(0,count).map(enemy=>({...enemy})), "Debug crowded combat layout test.", {
    source:"combat-layout-debug",
    locationId:state.world?.locationId || ""
  });
  battle.resolving = false;
  battle.index = Math.max(0,battle.queue.findIndex(entry=>entry.side === "hero"));
  renderCombat();
  return {ok:true,enemies:count,companions:desiredCompanions};
}

function checkEnd(){
  if(!battle.enemies.some(e=>e.hp>0)){
    if((battle.effects || []).some(effect=>effect.type==="defeated")){
      battle.resolving = true;
      renderCombat();
      clearTimeout(resolvingTimer);
      resolvingTimer = setTimeout(()=>{
        if(battle && !battle.enemies.some(e=>e.hp>0))victory();
      },COMBAT_TIMING.victorySettle);
      return true;
    }
    victory();
    return true;
  }
  if(state.hero.hp<=0){defeat();return true;}
  return false;
}

export function debugEnemyVisualAssets(){
  return debugEnemyVisualRegistry();
}

export function debugResolveEnemyPose(name = "Skeleton", pose = "idle"){
  return resolveEnemyPoseAsset({name,role:"enemy"}, pose);
}

function victory(){
  const h = state.hero, enemies = battle.enemies, comps = liveComps();
  const meta = battle.meta || {};
  const xp = enemies.reduce((sum,e)=>sum+e.xp,0);
  const gold = enemies.reduce((sum,e)=>sum+e.gold,0);
  const each = Math.floor(xp/(1+comps.length));
  const cm = Math.floor(each*(Number(h.mastery.cmAllocation)||0)/100);
  const normal = each - cm;
  const cmPointsBefore = h.mastery.cmPoints;
  h.xp += normal;
  h.mastery.cmXp += cm;
  h.gold += gold;
  const lootLevel = Math.max(1,Math.floor(enemies.reduce((sum,e)=>sum+e.level,0)/Math.max(1,enemies.length)));
  const loot = makeLoot(lootLevel);
  h.inv.push(loot);
  applyVictoryPassives(h);
  comps.forEach(c=>{
    normalizeCompanion(c);
    c.xp += each;
    while(c.xp>=c.nextXp){
      c.xp-=c.nextXp;
      c.level++;
      c.nextXp = 80 + c.level*45;
      c.maxHp += 8;
      c.hp = c.maxHp;
      c.attack += 2;
      c.defense += 1;
      if(c.level%5===0){
        const pool = c.role === "healer" ? ["minor_mend","holy_guard","renew"]
          : c.role === "scout" ? ["quick_strike","smoke_step","trap_snare"]
          : c.role === "mystic" ? ["fire_bolt","arcane_burst","minor_mend"]
          : c.role === "guard" ? ["guard_wall","shield_bash","taunt"]
          : ["guard_wall","quick_strike","strike"];
        const learned = pool[rnd(0,pool.length-1)];
        if(!c.known.includes(learned))c.known.push(learned);
      }
    }
    const bondLevels = grantCompanionBond(c, Math.max(5,Math.floor(each*.16)));
    if(bondLevels)state.world.story.push(`${c.name} ${tx("bondGrew").toLowerCase()}.`);
  });
  const leveled = levelHero();
  if(!leveled)playAudioHook("combat-victory", {source:meta.source || "normal"});
  convertCM();
  const cmPointsGained = h.mastery.cmPoints - cmPointsBefore;
  const delta = itemUpgradeDelta(loot);
  const lootDelta = [delta.attack?`${delta.attack>0?"+":""}${delta.attack} ${tx("attackShort")}`:"", delta.defense?`${delta.defense>0?"+":""}${delta.defense} ${tx("defenseShort")}`:""].filter(Boolean).join(" · ");
  const body = `<div class="result-state victory-state"><h3>${tx("victory")}</h3><span class="pill">${tx("totalXp")} ${xp}</span><span class="pill good">${tx("gold")} +${gold}</span><p>${tx("xpSplit")}: ${tx("normalXp")} +${normal} | ${tx("classMasteryXp")} +${cm}${cmPointsGained?` | ${tx("cmPoints")} +${cmPointsGained}`:""}</p><p>${tx("loot")}: ${esc(loot.name)}${lootDelta?` <span class="pill ${delta.better?"good":"warn"}">${esc(lootDelta)}</span>`:""}</p>${comps.map(c=>`<p>${esc(c.name)}: +${each} XP</p>`).join("")}</div>`;
  battle = null;
  autoFight = false;
  skillOpen = false;
  save();
  combatDebug("battle victory", {source: meta.source || "normal", onVictory: meta.onVictory || "home", encounterRoadNodeId: meta.encounterRoadNodeId || null});
  const continueFn = meta.source === "slum-prologue" && meta.onVictory === "slumFightWon"
    ? ()=>window.FE?.completeSlumFight ? window.FE.completeSlumFight(meta) : show("home")
    : meta.source === "slum-prologue" && meta.onVictory === "slumAlleyWon"
    ? ()=>window.FE?.completeSlumAlleyFight ? window.FE.completeSlumAlleyFight(meta) : show("home")
    : meta.source === "slum-prologue" && meta.onVictory === "slumContractWon"
    ? ()=>window.FE?.completeSlumContractFight ? window.FE.completeSlumContractFight(meta) : show("home")
    : meta.source === "travel" && meta.onVictory === "resumeJourney"
    ? ()=>window.FE?.resumeJourneyAfterBattle ? window.FE.resumeJourneyAfterBattle(meta) : show("map")
    : meta.source === "hard-area" && meta.onVictory === "hardAreaWon"
    ? ()=>window.FE?.completeHardArea ? window.FE.completeHardArea(meta) : show("home")
    : meta.source === "lower-ward" && meta.onVictory === "wardCommissionWon"
    ? ()=>window.FE?.completeWardCommissionFight ? window.FE.completeWardCommissionFight(meta) : show("home")
    : ()=>show("home");
  const victoryButtons = [];
  if(loot){
    victoryButtons.push({
      label:delta.better?`${tx("equipLoot")} · ${tx("upgrade")}`:tx("equipLoot"),
      cls:delta.better?"primary":"secondary",
      fn:()=>{ equip(loot.id); continueFn(); }
    });
  }
  victoryButtons.push({label:tx("continue"),cls:delta.better?"secondary":"primary",fn:continueFn});
  const showRewards = ()=>modal(tx("victory"), body, victoryButtons);
  if(leveled)presentLevelUp(leveled, {onDone:showRewards, continueLabel:tx("levelUpContinue")});
  else showRewards();
}

function defeat(){
  const meta = battle?.meta || {};
  playAudioHook("combat-defeat", {source:meta.source || "normal"});
  state.hero.hp = Math.max(1,Math.floor(state.hero.maxHp*.35));
  state.hero.gold = Math.floor(state.hero.gold*.94);
  battle = null;
  autoFight = false;
  skillOpen = false;
  save();
  const settle = () => {
    if(meta.source === "slum-prologue" && meta.onDefeat === "slumFightLost"){
      if(window.FE?.recordSlumFightDefeat)window.FE.recordSlumFightDefeat(meta);
      else show("home");
      return;
    }
    if(meta.source === "slum-prologue" && meta.onDefeat === "slumAlleyLost"){
      if(window.FE?.recordSlumAlleyDefeat)window.FE.recordSlumAlleyDefeat(meta);
      else show("home");
      return;
    }
    if(meta.source === "slum-prologue" && meta.onDefeat === "slumContractLost"){
      if(window.FE?.recordSlumContractDefeat)window.FE.recordSlumContractDefeat(meta);
      else show("home");
      return;
    }
    if(meta.source === "travel" && meta.onDefeat === "cancelJourney"){
      if(window.FE?.cancelTravel)window.FE.cancelTravel();
      else show("home");
      return;
    }
    show("home");
  };
  const crawlInn = () => {
    settle();
    if(meta.source === "travel")return;
    state.hero.hp = Math.max(state.hero.hp, Math.floor(state.hero.maxHp * 0.5));
    save();
    setTimeout(()=>window.FE?.openTownService?.("inn"), 180);
  };
  modal(tx("defeat"), `<div class="result-state defeat-state"><h3>${tx("defeat")}</h3><p>${tx("defeatBody")}</p><p>${tx("defeatInnHint")}</p></div>`, [
    {label:tx("defeatCrawlInn"),cls:"primary",fn:crawlInn},
    {label:tx("continue"),cls:"secondary",fn:settle}
  ]);
}

export function runBattle(){
  const meta = battle?.meta || {};
  clearTimeout(resolvingTimer);
  battle = null;
  autoFight = false;
  skillOpen = false;
  save();
  if(meta.source === "slum-prologue" && meta.onDefeat === "slumFightLost"){
    if(window.FE?.recordSlumFightDefeat)window.FE.recordSlumFightDefeat(meta);
    else show("home");
  }
  else if(meta.source === "slum-prologue" && meta.onDefeat === "slumAlleyLost"){
    if(window.FE?.recordSlumAlleyDefeat)window.FE.recordSlumAlleyDefeat(meta);
    else show("home");
  }
  else if(meta.source === "slum-prologue" && meta.onDefeat === "slumContractLost"){
    if(window.FE?.recordSlumContractDefeat)window.FE.recordSlumContractDefeat(meta);
    else show("home");
  }
  else if(meta.source === "travel" && meta.onDefeat === "cancelJourney"){
    if(window.FE?.cancelTravel)window.FE.cancelTravel();
    else show("home");
  }
  else show("home");
  playAudioHook("town-ambience");
}

export function toggleAuto(){
  autoFight = !autoFight;
  renderCombat();
  if(autoFight && battle && actor()?.side==="hero" && !battle.resolving)heroAttack();
}

export function totalAttack(){
  const h = state.hero;
  return h.attack + (h.stats.strength||0)*3 + (h.gear.weapon?.attack||0) + (activeClassDefinition(h)?.bonus?.attack || 0);
}

export function totalDefense(){
  const h = state.hero;
  const shieldBonus = hasPassive("warrior_shield_discipline") && h.gear.offhand ? 2 : 0;
  const base = h.defense + shieldBonus + (h.stats.endurance||0)*2 + Object.values(h.gear).reduce((sum,it)=>sum+(it?.defense||0),0) + (activeClassDefinition(h)?.bonus?.defense || 0);
  return Math.floor(base * (1 + classPathCombatBonus("defense")));
}

export function addWeaponXp(type,xp){
  const safeType = type || "unarmed";
  const m = state.hero.mastery.weapon[safeType] ||= {level:1,xp:0};
  m.xp += xp;
  while(m.level<100 && m.xp>=weaponMasteryNeed(m.level)){
    m.xp -= weaponMasteryNeed(m.level);
    m.level++;
    battle?.log.push(`${title(safeType)} mastery increased to ${m.level}.`);
  }
}

export function addSpellXp(abilityId,xp){
  const school = spellSchoolForAbility(abilityId);
  if(!school)return;
  const m = state.hero.mastery.spells[school] ||= {level:1,xp:0};
  m.xp += xp;
  while(m.level<100 && m.xp>=spellMasteryNeed(m.level)){
    m.xp -= spellMasteryNeed(m.level);
    m.level++;
    battle?.log.push(`${title(school)} mastery increased to ${m.level}.`);
  }
}
