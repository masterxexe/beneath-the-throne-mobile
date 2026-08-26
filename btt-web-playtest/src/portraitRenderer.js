import { title, tx } from "./language.js";
import { GENERATED_CHARACTER_APPEARANCES, PAPER_DOLL_BASE, PAPER_DOLL_LAYER_ORDER, PLAYER_COMPOSITE_ASSETS, PLAYER_POSE_ASSETS, PLAYER_POSE_STATES, applyGearVisuals, visualForItem } from "./gearVisuals.js";
import { resolveCharacterRenderState, resolveOffhandCategory, resolvePlayerCombatPresentation, resolvePlayerVisualFlags, resolveWeaponCategory } from "./characterRenderController.js";
import { isLocalDebugOverlaysEnabled } from "./environment.js";

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function layerMotionClass(id){
  const body = ["base","legs","boots"];
  const armor = ["chest","belt","gloves","shoulders"];
  const head = ["head","helmet"];
  if(body.includes(id))return "paper-doll-motion-body";
  if(armor.includes(id))return "paper-doll-motion-armor";
  if(head.includes(id))return "paper-doll-motion-head";
  if(id === "weapon")return "paper-doll-motion-weapon";
  if(id === "offhand")return "paper-doll-motion-offhand";
  if(id === "cloak")return "paper-doll-motion-cape";
  if(id === "auraBack" || id === "auraFront" || id === "classOverlay")return "paper-doll-motion-glow";
  return "paper-doll-motion-body";
}

function layerGroup(id){
  if(["chest","belt","gloves","shoulders"].includes(id))return "armor";
  if(["head","helmet"].includes(id))return "head";
  if(["weapon","offhand"].includes(id))return "held";
  if(id === "cloak")return "cape";
  if(["auraBack","auraFront","classOverlay"].includes(id))return "fx";
  return "body";
}

function layerHTML(id, src, quality="base"){
  if(!src)return "";
  return `<img class="paper-doll-layer paper-doll-layer-${esc(id)} ${layerMotionClass(id)} quality-${esc(quality)}" data-paper-layer="${esc(id)}" data-layer-group="${esc(layerGroup(id))}" src="${esc(src)}" alt="" loading="eager" decoding="async" draggable="false">`;
}

function debugOverlaysEnabled(){
  return isLocalDebugOverlaysEnabled();
}

function isTraversalPoseState(state){
  return /^walk-(left|right|forward|away|up|down)(?:-[a-d])?$/.test(state) || ["arriving","entering-location","exiting-location"].includes(state);
}

function overlayModeForPose(pose, options = {}){
  if(options.overlayMode)return options.overlayMode;
  if(options.combat)return "combat";
  const state = pose?.resolvedState || pose?.requested || options.visualState || "idle";
  if(isTraversalPoseState(state))return "idle";
  return state === "idle" ? "idle" : "combat";
}

function overlaySourceForPose(visual, poseState, mode){
  if(!visual)return null;
  if(isTraversalPoseState(poseState)){
    return visual.characterOverlayIdle || visual.characterOverlay || visual.characterOverlayCombat || null;
  }
  if(poseState && poseState !== "idle" && poseState !== "combatIdle"){
    return visual.characterOverlayAttack
      || visual.weaponOverlayAttack
      || visual.weaponOverlayCombatIdle
      || visual.characterOverlayCombat
      || visual.characterOverlayIdle
      || visual.characterOverlay
      || null;
  }
  if(mode === "combat")return visual.weaponOverlayCombatIdle || visual.characterOverlayCombat || visual.characterOverlayIdle || visual.characterOverlay || null;
  return visual.characterOverlayIdle || visual.characterOverlayCombat || visual.characterOverlay || null;
}

export function characterOverlayForVisual(visual, mode = "idle", options = {}){
  if(!visual)return null;
  const source = overlaySourceForPose(visual, options.poseState || null, mode);
  if(!source)return null;
  const quality = visual.qualityStatus || visual.bodyOverlayQuality || "missing";
  const bodyQuality = visual.bodyOverlayQuality || "missing";
  if(["approved","temporary"].includes(quality) || ["approved","temporary"].includes(bodyQuality))return source;
  return (options.debug || debugOverlaysEnabled()) && (quality === "debugOnly" || bodyQuality === "debugOnly") ? source : null;
}

function resolveArmorCompositeAsset(hero, pose){
  const render = resolveCharacterRenderState(hero);
  const armorClass = render.armorVisualClass || "base_survivor";
  if(armorClass === "base_survivor")return null;
  const requested = pose?.resolvedState || pose?.requested || "idle";
  const traversalPose = isTraversalPoseState(requested);
  const composite = PLAYER_COMPOSITE_ASSETS[requested]?.[armorClass]
    || (!traversalPose && requested !== "idle" ? PLAYER_COMPOSITE_ASSETS.combatIdle?.[armorClass] : null)
    || null;
  if(!composite)return null;
  return {
    src:composite,
    armorVisualClass:armorClass
  };
}

function missingOverlayHTML(id, item){
  if(!item)return "";
  const name = item.visualVariant || item.name || id;
  return `<span class="paper-doll-missing-overlay" data-paper-layer="${esc(id)}" data-missing-overlay="${esc(name)}" aria-hidden="true"></span>`;
}

function heroVisualHooks(hero){
  const visual = hero?.visual || {};
  return {
    auraBack: visual.auraBackLayer || visual.auraLayer || null,
    auraFront: visual.auraFrontLayer || null,
    classOverlay: visual.classOverlayLayer || null
  };
}

function weaponType(item){
  return resolveWeaponCategory(item);
}

function offHandType(item){
  return resolveOffhandCategory(item);
}

export function resolvePlayerVisualState(hero){
  return resolvePlayerVisualFlags(hero);
}

export function playerAppearanceState(hero){
  return resolvePlayerVisualState(hero).armorState;
}

export function playerAppearanceImage(hero){
  return GENERATED_CHARACTER_APPEARANCES[playerAppearanceState(hero)] || GENERATED_CHARACTER_APPEARANCES.base;
}

export function normalizePlayerPoseState(state = "idle"){
  return PLAYER_POSE_STATES.includes(state) ? state : "idle";
}

export function resolvePlayerAttackPose(hero){
  return resolvePlayerCombatPresentation(hero).attackPose;
}

export function getPlayerPoseAsset(hero, visualState = "idle"){
  const requested = normalizePlayerPoseState(visualState);
  const traversalPose = isTraversalPoseState(requested);
  const armorState = playerAppearanceState(hero);
  const controller = resolveCharacterRenderState(hero);
  const compositeExact = controller.armorVisualClass && controller.armorVisualClass !== "base_survivor"
    ? PLAYER_COMPOSITE_ASSETS[requested]?.[controller.armorVisualClass] || null
    : null;
  const compositeFallback = !traversalPose && !compositeExact && requested !== "idle" && controller.armorVisualClass && controller.armorVisualClass !== "base_survivor"
    ? PLAYER_COMPOSITE_ASSETS.combatIdle?.[controller.armorVisualClass] || PLAYER_COMPOSITE_ASSETS.idle?.[controller.armorVisualClass] || null
    : null;
  const composite = compositeExact || compositeFallback;
  const exact = composite || PLAYER_POSE_ASSETS[requested]?.[armorState] || PLAYER_POSE_ASSETS[requested]?.base || null;
  const fallbackState = compositeFallback ? "combatIdle" : requested === "idle" ? "idle" : "combatIdle";
  const fallback = PLAYER_POSE_ASSETS[fallbackState]?.[armorState] || PLAYER_POSE_ASSETS.idle?.[armorState] || playerAppearanceImage(hero);
  return {
    requested,
    resolvedState:compositeFallback ? fallbackState : exact ? requested : fallbackState,
    armorState,
    armorVisualClass:controller.armorVisualClass || "base_survivor",
    composite:!!composite,
    src:exact || fallback,
    available:!!exact,
    fallback:!exact
  };
}

const preloadedPlayerPoseAssets = new Set();

function playerOverlaySourcesForPose(hero, pose){
  const gear = hero?.gear || {};
  const overlayMode = overlayModeForPose(pose, {visualState:pose?.requested || "idle"});
  const poseState = pose?.resolvedState || pose?.requested || "idle";
  return PAPER_DOLL_LAYER_ORDER.map(layer=>{
    if(layer.asset)return layer.asset;
    const item = gear[layer.slot] ? applyGearVisuals(gear[layer.slot]) : null;
    const visual = visualForItem(item);
    return characterOverlayForVisual(visual, overlayMode, {poseState});
  }).filter(Boolean);
}

export function preloadPlayerPoseAsset(hero, visualState = "idle"){
  if(typeof Image === "undefined")return null;
  const pose = getPlayerPoseAsset(hero, visualState);
  const sources = [pose.src, playerAppearanceImage(hero), ...playerOverlaySourcesForPose(hero, pose)].filter(Boolean);
  sources.forEach(src=>{
    if(preloadedPlayerPoseAssets.has(src))return;
    preloadedPlayerPoseAssets.add(src);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
  return pose;
}

function portraitBadgeHTML(slot,item){
  const visual = visualForItem(item);
  const icon = visual?.icon || item?.icon;
  if(!/\.png($|\?)/i.test(icon || ""))return "";
  if(!icon)return "";
  const quality = visual?.quality || item?.quality || "common";
  const type = slot === "weapon" ? weaponType(item) : slot === "offhand" ? offHandType(item) : slot;
  return `<span class="paper-doll-gear-badge paper-doll-gear-${esc(slot)} paper-doll-gear-${esc(type)} quality-${esc(quality)}"><img src="${esc(icon)}" alt=""></span>`;
}

function badgeSlotsForState(hero, state){
  const gear = hero?.gear || {};
  const slots = ["weapon","offhand"];
  if(state.armorState === "base")slots.push("helmet","chest","shoulders","boots");
  if(state.armorState === "rusted" && gear.offhand == null)slots.push("chest");
  return slots;
}

function generatedAppearanceHTML(hero, visualState = "idle"){
  const state = resolvePlayerVisualState(hero);
  const pose = getPlayerPoseAsset(hero, visualState);
  const badges = badgeSlotsForState(hero,state)
    .map(slot=>hero?.gear?.[slot] ? portraitBadgeHTML(slot, applyGearVisuals(hero.gear[slot])) : "")
    .join("");
  return `
    <div class="paper-doll-generated-stack paper-doll-motion-body" data-layer-group="body">
      <img class="paper-doll-generated paper-doll-generated-${esc(state.armorState)} paper-doll-pose-${esc(pose.resolvedState)}${pose.fallback ? " paper-doll-pose-fallback" : ""}" data-paper-layer="generated-${esc(state.armorState)}" data-pose-requested="${esc(pose.requested)}" data-pose-resolved="${esc(pose.resolvedState)}" data-pose-available="${pose.available ? "true" : "false"}" src="${esc(pose.src)}" alt="" loading="eager" decoding="async" draggable="false">
    </div>
    <div class="paper-doll-gear-badges paper-doll-motion-gear" aria-hidden="true">${badges}</div>
  `;
}

function layeredAppearanceHTML(hero, options = {}){
  const gear = hero?.gear || {};
  const hooks = heroVisualHooks(hero);
  const pose = options.pose || getPlayerPoseAsset(hero, options.visualState || "idle");
  const usePoseBase = options.usePoseBase !== false;
  const overlayMode = overlayModeForPose(pose, options);
  const composite = resolveArmorCompositeAsset(hero, pose);
  const poseState = pose.resolvedState || pose.requested;
  return PAPER_DOLL_LAYER_ORDER.map(layer=>{
    if(layer.id === "base")return layerHTML("base", usePoseBase ? (composite?.src || pose.src) : PAPER_DOLL_BASE.body);
    if(layer.id === "head" && usePoseBase)return "";
    if(layer.asset)return layerHTML(layer.id, layer.asset);
    if(layer.type === "futureHook")return layerHTML(layer.id, hooks[layer.id], "effect");
    const item = gear[layer.slot] ? applyGearVisuals(gear[layer.slot]) : null;
    const visual = visualForItem(item);
    const overlay = characterOverlayForVisual(visual, overlayMode, {poseState});
    if(composite && ["chest","shoulders","gloves","boots","legs","belt","cloak"].includes(layer.id)){
      if(layer.id === "chest")return "";
      return overlay ? layerHTML(layer.id, overlay, visual.quality || "common") : "";
    }
    return overlay
      ? layerHTML(layer.id, overlay, visual.quality || "common")
      : missingOverlayHTML(layer.id, item);
  }).join("");
}

export function renderPlayerPaperDoll(hero, options={}){
  const hooks = heroVisualHooks(hero);
  const defaultPose = options.visualState || (options.combat ? "combatIdle" : "idle");
  const pose = getPlayerPoseAsset(hero, defaultPose);
  const useGeneratedOnly = options.renderMode === "generated";
  const layers = useGeneratedOnly
    ? generatedAppearanceHTML(hero, pose.requested)
    : layeredAppearanceHTML(hero, {...options, pose, visualState:pose.requested});
  const overlayLayers = useGeneratedOnly ? [
    layerHTML("auraBack", hooks.auraBack, "effect"),
    layerHTML("auraFront", hooks.auraFront, "effect"),
    layerHTML("classOverlay", hooks.classOverlay, "effect")
  ].join("") : "";
  const className = hero?.class ? title(hero.class) : tx("survivor");
  const label = options.label || `${hero?.name || tx("survivor")} ${className}`;
  const frameClass = `${options.compact ? " paper-doll-frame-compact" : ""}${options.hud ? " paper-doll-frame-hud" : ""}${options.combat ? " paper-doll-frame-combat" : ""}${options.supporterFrame ? ` supporter-frame-${options.supporterFrame}` : ""}${options.supporterCloak ? ` supporter-cloak-${options.supporterCloak}` : ""}`;
  const visual = resolvePlayerVisualState(hero);
  const motionMode = options.motion === false ? "static" : options.motionState || (options.hud ? "hudIdle" : options.combat ? "combatIdle" : "idle");
  const renderMode = useGeneratedOnly ? "generated" : "layered";
  const controller = resolveCharacterRenderState(hero, {combatPose:options.combat ? pose.requested : undefined});
  const equipped = controller.equipped;
  const composite = resolveArmorCompositeAsset(hero, pose);
  const renderSource = useGeneratedOnly ? pose.src : composite?.src || pose.src || "layered-master";
  return `
    <div class="paper-doll-frame paper-doll-root paper-doll-render-${esc(renderMode)} paper-doll-state-${esc(motionMode)} paper-doll-visual-${esc(pose.requested)} paper-doll-pose-resolved-${esc(pose.resolvedState)} paper-doll-armor-${esc(visual.armorState)}${pose.fallback ? " paper-doll-pose-fallback" : ""}${frameClass}"
      aria-label="${esc(label)}" data-paper-render="${esc(renderMode)}" data-visual-state="${esc(visual.armorState)}" data-motion-state="${esc(motionMode)}" data-paper-visual-state="${esc(pose.requested)}" data-pose-resolved="${esc(pose.resolvedState)}" data-pose-available="${pose.available ? "true" : "false"}"
      data-render-controller="character" data-weapon-category="${esc(controller.weaponCategory || "unarmed")}" data-combat-effect="${esc(controller.combatEffect)}"
      data-render-source="${esc(renderSource)}" data-armor-visual-class="${esc(controller.armorVisualClass || "base_survivor")}" data-composite-source="${esc(composite?.src || "")}" data-equipped-helmet="${esc(equipped.helmet?.visualVariant || equipped.helmet?.name || "")}" data-equipped-chest="${esc(equipped.chest?.visualVariant || equipped.chest?.name || "")}" data-equipped-shoulders="${esc(equipped.shoulders?.visualVariant || equipped.shoulders?.name || "")}" data-equipped-weapon="${esc(equipped.weapon?.visualVariant || equipped.weapon?.name || "")}"
      data-has-weapon="${visual.hasMainHand ? "true" : "false"}" data-has-offhand="${visual.hasOffHand ? "true" : "false"}">
      <div class="paper-doll-scene">
        <span class="paper-doll-haze"></span>
        <span class="paper-doll-ground paper-doll-shadow" data-paper-layer="shadow"></span>
        <div class="paper-doll">
          <div class="paper-doll-avatar paper-doll-layered paper-doll-motion-breathe" data-character-state="${esc(pose.requested)}">
            ${layers || layerHTML("base", pose.src || PAPER_DOLL_BASE.body)}
            ${overlayLayers}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function playerVisualDebug(hero){
  const visual = resolvePlayerVisualState(hero);
  const pose = getPlayerPoseAsset(hero, "combatIdle");
  return {
    renderDefault:"layered",
    generatedImage:playerAppearanceImage(hero),
    poseState:pose,
    armorState:visual.armorState,
    controller:resolveCharacterRenderState(hero),
    renderSource:pose.src || "layered-master",
    flags:visual,
    hudUsesPaperDoll:true,
    combatUsesPaperDoll:true
  };
}

export function playerPoseAssetDebug(hero){
  return PLAYER_POSE_STATES.map(state=>getPlayerPoseAsset(hero, state));
}

export function paperDollLayerDebug(hero, options={}){
  const visual = resolvePlayerVisualState(hero);
  const gear = hero?.gear || {};
  const mode = options.renderMode || (options.forceLayered ? "layered" : "layered");
  const generatedLayers = [
    {id:`generated-${visual.armorState}`, group:"body", motion:"body", present:true},
    ...badgeSlotsForState(hero, visual).map(slot=>({
      id:`gear-badge-${slot}`,
      group:slot === "weapon" || slot === "offhand" ? "held" : "gearBadge",
      motion:slot === "weapon" ? "weapon" : slot === "offhand" ? "offhand" : "gear",
      present:!!gear[slot],
      item:gear[slot]?.name || null
    }))
  ];
  if(mode === "generated")return generatedLayers;
  return PAPER_DOLL_LAYER_ORDER.map(layer=>{
    const item = layer.slot && gear[layer.slot] ? applyGearVisuals(gear[layer.slot]) : null;
    const visual = item ? visualForItem(item) : null;
    const overlayMode = options.overlayMode || (options.combat ? "combat" : "idle");
    const poseState = options.visualState || (options.combat ? "combatIdle" : "idle");
    const overlay = characterOverlayForVisual(visual, overlayMode, {poseState, debug:!!options.debug});
    return {
      id:layer.id,
      group:layerGroup(layer.id),
      motion:layerMotionClass(layer.id).replace("paper-doll-motion-",""),
      present:!!(layer.id === "base" || layer.type === "futureHook" || overlay),
      item:item?.name || null,
      source:layer.id === "base" ? getPlayerPoseAsset(hero, options.visualState || "idle").src : overlay || layer.type || null,
      overlayMode,
      missingCharacterOverlay:!!(item && !overlay)
    };
  });
}

export function itemIconHTML(item){
  const visual = visualForItem(item);
  const icon = visual?.icon || item?.icon;
  const quality = item?.quality || visual?.quality || "common";
  if(!icon)return `<span class="item-icon item-icon-empty quality-${esc(quality)}"></span>`;
  return `<span class="item-icon quality-${esc(quality)}"><img src="${esc(icon)}" alt=""></span>`;
}

export function itemQuality(item){
  return visualForItem(item)?.quality || item?.quality || "common";
}

export function renderPlayerCombatPortraitHook(hero, options={}){
  return renderPlayerPaperDoll(hero, {...options, compact:true, combat:true});
}

export function renderPlayerHudPortrait(hero, extra={}){
  return renderPlayerPaperDoll(hero, {compact:true, hud:true, ...extra});
}
