import { esc } from "./ui.js";
import { NPC_ACTOR_ASSETS } from "./npcRegistry.js";

export function sceneAnchorHTML(anchor){
  const model = anchor.model || anchor.sprite || defaultNpcModel(anchor);
  const pose = anchor.pose || "idle";
  const state = anchor.state || "available";
  const interaction = anchor.interactionType || anchor.type;
  const presence = anchor.presenceClass || "";
  const npcCategory = anchor.npcCategory || anchor.role || interaction;
  const hoverLabel = anchor.hoverLabel || anchor.name;
  const depth = Number.isFinite(Number(anchor.depth)) ? Number(anchor.depth) : 4;
  const scale = Number.isFinite(Number(anchor.scale)) ? Number(anchor.scale) : 1;
  const idleMotion = anchor.idleMotion || defaultIdleMotion(anchor);
  const presenceAnimation = anchor.presenceAnimation || "";
  const hoverAnimation = anchor.hoverAnimation || "presence";
  const shadow = anchor.shadow === false ? "" : `<span class="scene-anchor-shadow" aria-hidden="true"></span>`;
  const visualKind = anchorVisualKind(anchor, model);
  return `
    <button class="scene-anchor scene-anchor-${esc(anchor.type)} scene-anchor-${esc(interaction)} scene-npc-${esc(npcCategory)} ${esc(presence)} scene-idle-${esc(idleMotion)} ${presenceAnimation ? `scene-presence-${esc(presenceAnimation)}` : ""} scene-hover-${esc(hoverAnimation)}"
      style="--anchor-x:${anchor.x}%;--anchor-y:${anchor.y}%;--anchor-depth:${depth};--anchor-scale:${scale};${model ? `--anchor-model:url('${esc(model)}');` : ""}"
      data-anchor-id="${esc(anchor.id)}" data-anchor-state="${esc(state)}" data-anchor-pose="${esc(pose)}"
      data-anchor-visual="${esc(visualKind)}" data-anchor-has-model="${model ? "true" : "false"}"
      data-interaction-type="${esc(interaction)}" data-idle-motion="${esc(idleMotion)}" data-hover-animation="${esc(hoverAnimation)}"
      onclick="FE.selectSceneAnchor('${esc(anchor.id)}')" title="${esc(hoverLabel)}">
      ${shadow}
      <span class="scene-anchor-presence" aria-hidden="true"></span>
      <span>${esc(anchor.name)}</span>
    </button>
  `;
}

function anchorVisualKind(anchor, model){
  if(!model)return "marker";
  if(anchor.type === "object")return "object";
  return "npc";
}

function defaultNpcModel(anchor){
  if(anchor.type === "object")return "";
  const text = `${anchor.id || ""} ${anchor.name || ""} ${anchor.npcCategory || ""} ${anchor.role || ""} ${anchor.interactionType || ""} ${anchor.class || ""}`.toLowerCase();
  if(/blacksmith|smith|forge/.test(text))return NPC_ACTOR_ASSETS.blacksmith;
  if(/merchant|market|vendor|carrier|crate/.test(text))return NPC_ACTOR_ASSETS.marketMerchant;
  if(/barkeep|tapkeep|tavern|guest/.test(text))return NPC_ACTOR_ASSETS.tavernKeeper;
  if(/inn|hearth|nessa/.test(text))return NPC_ACTOR_ASSETS.innkeeper;
  if(/healer|herbal|mend|cleric/.test(text))return NPC_ACTOR_ASSETS.healerHerbalist;
  if(/guard|captain|watch|castle/.test(text))return NPC_ACTOR_ASSETS.castleGuard;
  if(/steward|clerk|ledger|notice|towncenter/.test(text))return NPC_ACTOR_ASSETS.townClerk;
  if(/gang|thief|cutpurse|lookout|stranger|shadow|threat/.test(text))return NPC_ACTOR_ASSETS.gangLookout;
  if(/mystic|mage|caster|arcane|vale|iri|corven/.test(text))return NPC_ACTOR_ASSETS.companionMage;
  if(/companion|scout|ranger|mira|talia|vessa|traveler|recruit/.test(text))return NPC_ACTOR_ASSETS.companionScout;
  if(/refugee|beggar|slum/.test(text))return NPC_ACTOR_ASSETS.slumBeggar;
  return anchor.type === "npc" || anchor.type === "event" ? NPC_ACTOR_ASSETS.caravanTrader : "";
}

function defaultIdleMotion(anchor){
  const interaction = anchor.interactionType || anchor.type;
  if(anchor.pose === "hammering")return "hammer";
  if(anchor.pose === "patrolling" || anchor.pose === "moving")return "patrol";
  if(anchor.pose === "cleaning" || anchor.pose === "carrying")return "work";
  if(interaction === "recruit" || anchor.type === "npc")return "sway";
  if(["hearth","service","notice","ledger"].includes(interaction))return "pulse";
  if(anchor.type === "event")return "watch";
  return "still";
}

export function sceneEffectHTML(effect){
  const type = effect.type || "light-pulse";
  const depth = Number.isFinite(Number(effect.depth)) ? Number(effect.depth) : 3;
  const width = Number.isFinite(Number(effect.width)) ? Number(effect.width) : 20;
  const height = Number.isFinite(Number(effect.height)) ? Number(effect.height) : 20;
  const scale = Number.isFinite(Number(effect.scale)) ? Number(effect.scale) : 1;
  const intensity = Number.isFinite(Number(effect.intensity)) ? Number(effect.intensity) : .5;
  const duration = Number.isFinite(Number(effect.duration)) ? Number(effect.duration) : 8;
  const opacity = Number.isFinite(Number(effect.opacity)) ? Number(effect.opacity) : .28;
  const className = effect.className || "";
  const reduced = effect.reducedMotion || "soften";
  return `
    <span class="scene-ambient-effect scene-effect-${esc(type)} ${esc(className)}"
      style="--effect-x:${effect.x || 50}%;--effect-y:${effect.y || 50}%;--effect-w:${width}%;--effect-h:${height}%;--effect-depth:${depth};--effect-scale:${scale};--effect-intensity:${intensity};--effect-duration:${duration}s;--effect-opacity:${opacity};"
      data-effect-id="${esc(effect.id || type)}" data-effect-type="${esc(type)}" data-reduced-motion="${esc(reduced)}" aria-hidden="true"></span>
  `;
}

export function sceneActionButtonHTML(action, anchorId){
  const labels = {
    rumor: "Ask Rumors",
    serviceMenu: "Open Services",
    gamble: "Gamble",
    investigate: "Investigate",
    recruit: "Hire",
    chaseThief: "Chase",
    buyFood: "Buy Food",
    rest: "Rest",
    camp: "Camp",
    aidRefugees: "Aid",
    townLedger: "Read Ledger",
    townNotice: "Read Notices"
  };
  return `<button onclick="FE.runSceneAction('${esc(action)}','${esc(anchorId)}')">${esc(labels[action] || action)}</button>`;
}
