import { WEAPON_TYPES, makeLoot, save, state, weaponTypeForItem } from "./state.js";
import { title, tx } from "./language.js";
import { byId, esc, modal, toast, updateTop } from "./ui.js";
import { VISUAL_GEAR_SLOTS, applyGearVisuals } from "./gearVisuals.js";
import { resolvePlayerCombatPresentation } from "./characterRenderController.js";
import { characterOverlayForVisual, itemIconHTML, itemQuality, paperDollLayerDebug, playerPoseAssetDebug, playerVisualDebug, renderPlayerPaperDoll, resolvePlayerAttackPose } from "./portraitRenderer.js";

const SLOTS = VISUAL_GEAR_SLOTS;
let debugPlayerPoseState = null;

export function renderGear(){
  const h = state.hero;
  byId("gear").innerHTML = `
    <div class="gear-screen-layout">
      <div class="panel gear-hero-panel">
        <div class="gear-hero-copy">
          <h1>${tx("gear")}</h1>
          <span class="pill good">${tx("gold")} ${h.gold}</span>
          <span class="pill">${tx("backpack")} ${h.inv.length}</span>
          <div class="grid3 gear-action-row">
            <button class="primary" onclick="FE.equipBest()">${tx("equipBest")}</button>
            <button ${h.inv.length?`onclick="FE.sellWorse()"`:"disabled"}>${tx("sellWorse")}</button>
            <button class="danger" ${h.inv.length?`onclick="FE.sellAll()"`:"disabled"}>${tx("sellAllUnequipped")}</button>
          </div>
        </div>
        <div class="gear-doll-wrap">
          <h2>${tx("characterAppearance")}</h2>
          ${renderPlayerPaperDoll(h, debugPlayerPoseState ? {visualState:debugPlayerPoseState} : {})}
        </div>
      </div>
      <div class="panel"><h2>${tx("equipped")}</h2><div class="gear-slot-grid">${SLOTS.map(slot=>gearSlotHTML(slot,h.gear[slot])).join("")}</div></div>
      <div class="panel"><h2>${tx("backpack")}</h2><div class="gear-inventory-grid">${h.inv.length?h.inv.map(itemHTML).join(""):`<p>${tx("empty")}.</p>`}</div></div>
      ${debugVisualReportHTML()}
    </div>
  `;
}

function refreshGear(){
  updateTop();
  renderGear();
}

function itemScore(item){return (item?.attack||0)*2 + (item?.defense||0) + (item?.level||0);}

function gearSlotHTML(slot,item){
  const content = item ? `${itemLine(item)}<button onclick="FE.unequip('${slot}')">${tx("unequip")}</button>` : `<p>${tx("empty")}.</p>`;
  return `<div class="card gear-slot-card ${item?"":"is-empty"}"><h3>${title(slot)}</h3>${content}</div>`;
}

function itemHTML(item){
  item = applyGearVisuals(item);
  const equipped = state.hero.gear[item.slot];
  const better = itemScore(item)>itemScore(equipped);
  return `<div class="card gear-item-card ${better?"better":""} quality-card-${esc(itemQuality(item))}">${itemLine(item)}<button class="primary" onclick="FE.equip('${item.id}')">${tx("equip")}</button><button onclick="FE.sellItem('${item.id}')">${tx("sell")} ${item.value}g</button></div>`;
}

function itemLine(item){
  item = applyGearVisuals(item);
  const quality = itemQuality(item);
  return `
    <div class="gear-item-line">
      ${itemIconHTML(item)}
      <div class="gear-item-copy">
        <h3>${esc(item.name)}</h3>
        <p>${title(item.slot)} ${tx("level")} ${item.level}</p>
        <span class="pill quality-pill quality-${esc(quality)}">${qualityText(quality)}</span>
        ${item.slot==="weapon" ? `<span class="pill">${tx("weaponType")}: ${esc(WEAPON_TYPES[weaponTypeForItem(item)]?.name || title(weaponTypeForItem(item)))}</span>` : ""}
        <span class="pill">${tx("attackShort")} ${item.attack||0}</span>
        <span class="pill">${tx("defenseShort")} ${item.defense||0}</span>
        ${itemDeltaPills(item)}
      </div>
    </div>
  `;
}

function itemDeltaPills(item){
  const delta = itemUpgradeDelta(item);
  const pills = [];
  if(delta.attack)pills.push(`<span class="pill ${delta.attack>0?"good":"warn"}">${delta.attack>0?"+":""}${delta.attack} ${tx("attackShort")}</span>`);
  if(delta.defense)pills.push(`<span class="pill ${delta.defense>0?"good":"warn"}">${delta.defense>0?"+":""}${delta.defense} ${tx("defenseShort")}</span>`);
  return pills.join("");
}

export function itemUpgradeDelta(item){
  const equipped = state.hero?.gear?.[item.slot];
  return {
    attack:(item.attack||0)-(equipped?.attack||0),
    defense:(item.defense||0)-(equipped?.defense||0),
    better:itemScore(item)>itemScore(equipped)
  };
}

export function selectEquipItemAvailability(id,hero = state?.hero){
  if(!hero)return {allowed:false,reason_code:"no_active_game",reason:"Start a new game or load a save before equipping an item."};
  if(typeof id !== "string" || !id)return {allowed:false,reason_code:"invalid_item_id",reason:"An exact inventory item ID is required."};
  const inventory = Array.isArray(hero.inv) ? hero.inv : [];
  const matches = inventory.filter(item=>item?.id === id);
  if(!matches.length)return {allowed:false,reason_code:"item_not_found",reason:"That item is not in the current inventory."};
  if(matches.length !== 1 || Object.values(hero.gear || {}).some(item=>item?.id === id)){
    return {allowed:false,reason_code:"ambiguous_item_id",reason:"That item ID does not identify exactly one unequipped item."};
  }
  const item = matches[0];
  if(typeof item.slot !== "string" || !SLOTS.includes(item.slot)){
    return {allowed:false,reason_code:"item_not_equippable",reason:"That inventory entry is not equippable gear."};
  }
  return {allowed:true,reason_code:null,reason:"",slot:item.slot};
}

function qualityText(quality){
  return tx("quality_"+quality) || title(quality);
}

export function equip(id){
  const h = state.hero;
  const idx = h.inv.findIndex(i=>i.id===id);
  if(idx<0)return;
  const item = applyGearVisuals(h.inv.splice(idx,1)[0]);
  const old = h.gear[item.slot];
  if(old)h.inv.push(old);
  h.gear[item.slot] = item;
  save();
  refreshGear();
}

export function unequip(slot){
  const item = state.hero.gear[slot];
  if(!item)return;
  state.hero.gear[slot] = null;
  state.hero.inv.push(item);
  save();
  refreshGear();
}

export function equipBest(){
  [...state.hero.inv].sort((a,b)=>itemScore(b)-itemScore(a)).forEach(item=>{
    if(itemScore(item)>itemScore(state.hero.gear[item.slot]))equip(item.id);
  });
  refreshGear();
}

export function sellItem(id){
  const h = state.hero;
  const idx = h.inv.findIndex(i=>i.id===id);
  if(idx<0)return;
  const item = h.inv.splice(idx,1)[0];
  h.gold += item.value;
  save();
  refreshGear();
}

export function sellWorse(){
  const h = state.hero;
  const worse = h.inv.filter(item=>itemScore(item)<=itemScore(h.gear[item.slot]));
  if(!worse.length){
    toast(tx("nothingToSell"));
    return;
  }
  const gold = worse.reduce((sum,item)=>sum+item.value,0);
  modal(tx("sellWorse"), `<p>${esc(tx("sellWorseConfirm"))}</p><p>${worse.length} · ${gold}g</p>`, [
    {label:tx("sellWorse"),cls:"danger",fn:()=>{
      h.inv = h.inv.filter(item=>{
        if(itemScore(item)<=itemScore(h.gear[item.slot])){
          h.gold += item.value;
          return false;
        }
        return true;
      });
      save();
      refreshGear();
    }},
    {label:tx("close"),cls:"secondary"}
  ]);
}

export function sellAll(){
  const h = state.hero;
  if(!h.inv.length){
    toast(tx("nothingToSell"));
    return;
  }
  const gold = h.inv.reduce((sum,item)=>sum+item.value,0);
  modal(tx("sellAllUnequipped"), `<p>${esc(tx("sellAllConfirm"))}</p><p>${h.inv.length} · ${gold}g</p>`, [
    {label:tx("sellAllUnequipped"),cls:"danger",fn:()=>{
      h.gold += h.inv.reduce((sum,item)=>sum+item.value,0);
      h.inv = [];
      save();
      refreshGear();
    }},
    {label:tx("close"),cls:"secondary"}
  ]);
}

export function debugPaperDollLayers(forceLayered = false){
  return paperDollLayerDebug(state.hero, {forceLayered});
}

export function debugPlayerVisualState(){
  return playerVisualDebug(state.hero);
}

export function debugPlayerPoseAssets(){
  return playerPoseAssetDebug(state.hero);
}

export function debugSetPlayerPose(visualState = "combatIdle"){
  debugPlayerPoseState = visualState;
  renderGear();
  return {
    requested:visualState,
    active:debugPlayerPoseState,
    poses:playerPoseAssetDebug(state.hero).filter(pose=>pose.requested === visualState)
  };
}

export function debugResetPlayerPose(){
  debugPlayerPoseState = null;
  renderGear();
  return {active:"normal"};
}

export function debugResolveAttackPose(){
  const presentation = resolvePlayerCombatPresentation(state.hero);
  return {
    pose:resolvePlayerAttackPose(state.hero),
    weaponCategory:presentation.weaponCategory,
    effect:presentation.effect,
    weapon:state.hero.gear.weapon?.name || null
  };
}

export function debugPortraitFrame(){
  if(typeof document === "undefined")return {available:false};
  const wrap = document.querySelector(".top-status-portrait");
  const frame = document.querySelector(".top-status-portrait .paper-doll-frame");
  const image = document.querySelector(".top-status-portrait .paper-doll-layer-base, .top-status-portrait .paper-doll-generated");
  const box = node => {
    if(!node)return null;
    const rect = node.getBoundingClientRect();
    return {left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height};
  };
  return {
    available:!!(wrap && frame && image),
    wrap:box(wrap),
    frame:box(frame),
    image:box(image),
    renderMode:frame?.dataset?.paperRender || null,
    weaponCategory:frame?.dataset?.weaponCategory || null,
    equippedHelmet:frame?.dataset?.equippedHelmet || null,
    equippedChest:frame?.dataset?.equippedChest || null,
    equippedShoulders:frame?.dataset?.equippedShoulders || null,
    renderSource:frame?.dataset?.renderSource || null,
    pose:frame?.dataset?.poseResolved || null,
    src:image?.getAttribute("src") || null
  };
}

export function debugEquippedVisuals(){
  return SLOTS.map(slot=>{
    const item = state.hero.gear[slot] ? applyGearVisuals(state.hero.gear[slot]) : null;
    const idleOverlay = characterOverlayForVisual(item, "idle");
    const combatOverlay = characterOverlayForVisual(item, "combat");
    const rawIdleOverlay = item?.characterOverlayIdle || item?.characterOverlay || null;
    const rawCombatOverlay = item?.characterOverlayCombat || item?.characterOverlayIdle || item?.characterOverlay || null;
    const hiddenBodyOverlay = !!item && !!(rawIdleOverlay || rawCombatOverlay) && !idleOverlay;
    const reason = !item ? null
      : hiddenBodyOverlay ? `hidden: ${item.bodyOverlayQuality || item.qualityStatus || "unapproved"} body overlay`
      : !idleOverlay && item.armorVisualClass ? "uses armor composite when available"
      : !idleOverlay ? "missing body-aligned overlay asset" : null;
    return {
      itemId:item?.id || null,
      slot,
      equipped:!!item,
      name:item?.name || null,
      quality:item ? itemQuality(item) : null,
      itemIcon:item?.itemIcon || item?.icon || null,
      portraitLayer:item?.portraitLayer || null,
      characterOverlay:item?.characterOverlay || null,
      characterOverlayIdle:rawIdleOverlay,
      characterOverlayCombat:rawCombatOverlay,
      idleAssetExists:!!rawIdleOverlay,
      combatAssetExists:!!rawCombatOverlay,
      rendered:!!idleOverlay,
      reason,
      armorVisualClass:item?.armorVisualClass || null,
      bodyOverlayQuality:item?.bodyOverlayQuality || item?.qualityStatus || null,
      normalIdleOverlayRendered:!!idleOverlay,
      normalCombatOverlayRendered:!!combatOverlay,
      visualVariant:item?.visualVariant || null,
      temporaryIcon:!!item?.temporaryIcon
    };
  });
}

function debugVisualReportHTML(){
  if(typeof location === "undefined" || !new URLSearchParams(location.search).has("debug"))return "";
  const rows = debugEquippedVisuals().filter(row=>row.equipped).map(row=>`
    <tr>
      <td>${esc(row.itemId)}</td>
      <td>${esc(row.slot)}</td>
      <td>${esc(row.itemIcon || "")}</td>
      <td>${esc(row.characterOverlayIdle || "")}</td>
      <td>${esc(row.characterOverlayCombat || "")}</td>
      <td>${row.idleAssetExists && row.combatAssetExists ? "true" : "false"}</td>
      <td>${row.rendered ? "true" : "false"}</td>
      <td>${esc(row.reason || (row.temporaryIcon ? "temporary item icon" : ""))}</td>
    </tr>
  `).join("");
  return `
    <div class="panel gear-debug-visual-report">
      <h2>Debug Equipment Visual Report</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>itemId</th><th>slot</th><th>itemIcon</th><th>characterOverlayIdle</th><th>characterOverlayCombat</th><th>asset exists</th><th>rendered</th><th>reason</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">No equipped visual items.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

export function debugEquipVisualTestSet(){
  const h = state.hero;
  const item = (slot,name,id,attack = 0,defense = 3)=>applyGearVisuals({
    id,
    slot,
    name,
    level:Math.max(1,h.level || 1),
    attack,
    defense,
    value:10,
    upgradeLevel:0
  });
  h.gear.helmet = item("helmet","Scout Hood","debug_scout_hood");
  h.gear.shoulders = item("shoulders","Hunter Mantle","debug_hunter_mantle");
  h.gear.chest = item("chest","Leather Armor","debug_leather_armor");
  h.gear.gloves = item("gloves","Leather Bracers","debug_leather_bracers");
  h.gear.boots = item("boots","Traveler Boots","debug_traveler_boots");
  h.gear.weapon = item("weapon","Ash Axe","debug_ash_axe",7,0);
  save();
  refreshGear();
  return debugEquippedVisuals();
}

export function debugPaperDollMotion(mode = "preview"){
  const allowed = ["preview","normal","off","inspect"];
  const next = allowed.includes(mode) ? mode : "preview";
  if(typeof document !== "undefined"){
    if(next === "normal"){
      delete document.body.dataset.paperDollMotion;
    }else{
      document.body.dataset.paperDollMotion = next;
    }
  }
  return {
    mode:next,
    active:typeof document !== "undefined" ? document.body.dataset.paperDollMotion || "normal" : next,
    reducedMotion:typeof matchMedia !== "undefined" ? matchMedia("(prefers-reduced-motion: reduce)").matches : false
  };
}
