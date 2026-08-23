export const PAPER_DOLL_BASE = {
  body: "assets/portraits/player/base/survivor.svg",
  head: "assets/portraits/player/head/survivor-head.svg"
};

export const PAPER_DOLL_LAYER_ORDER = [
  {id:"auraBack", type:"futureHook"},
  {id:"cloak", slot:"cloak"},
  {id:"base", asset:PAPER_DOLL_BASE.body},
  {id:"legs", slot:"legs"},
  {id:"boots", slot:"boots"},
  {id:"chest", slot:"chest"},
  {id:"belt", slot:"belt"},
  {id:"gloves", slot:"gloves"},
  {id:"shoulders", slot:"shoulders"},
  {id:"head", asset:PAPER_DOLL_BASE.head},
  {id:"helmet", slot:"helmet"},
  {id:"offhand", slot:"offhand"},
  {id:"weapon", slot:"weapon"},
  {id:"auraFront", type:"futureHook"},
  {id:"classOverlay", type:"futureHook"}
];

export const VISUAL_GEAR_SLOTS = [
  "weapon","offhand","helmet","shoulders","chest","gloves","belt","legs","boots","cloak","ring"
];

export const DEFAULT_VISUAL_HOOKS = {
  auraLayer:null,
  classOverlayLayer:null,
  characterOverlay:null,
  characterOverlayIdle:null,
  characterOverlayCombat:null,
  characterOverlayAttack:null,
  armorVisualClass:null,
  weaponOverlayCombatIdle:null,
  weaponOverlayAttack:null,
  bodyOverlayQuality:"missing",
  qualityStatus:"missing",
  hideDuringAttackIfNoAttackPose:true,
  faceVariant:"survivor",
  alignmentVariant:"neutral",
  corruptionVariant:null,
  holyVariant:null,
  classAffinity:null,
  auraAffinity:null,
  alignmentAffinity:null
};

const P = "assets/portraits/player/";
const I = "assets/items/icons/";
const O = P+"overlays/";

export const GENERATED_CHARACTER_APPEARANCES = {
  base:P+"generated/survivor-base-v16.png",
  rusted:P+"generated/survivor-rusted-armor-v17.png",
  road:P+"generated/survivor-road-armor-v17.png",
  knight:P+"generated/survivor-knight-armor-v17.png",
  legacyRusted:P+"generated/survivor-rusted-v16.png",
  legacyRoad:P+"generated/survivor-road-v16.png",
  legacyKnight:P+"generated/survivor-knight-v16.png"
};

export const PLAYER_POSE_STATES = [
  "idle",
  "walk-left",
  "walk-left-a",
  "walk-left-b",
  "walk-left-c",
  "walk-left-d",
  "walk-right",
  "walk-right-a",
  "walk-right-b",
  "walk-right-c",
  "walk-right-d",
  "walk-forward",
  "walk-forward-a",
  "walk-forward-b",
  "walk-forward-c",
  "walk-forward-d",
  "walk-away",
  "walk-away-a",
  "walk-away-b",
  "walk-away-c",
  "walk-away-d",
  "walk-up",
  "walk-up-a",
  "walk-up-b",
  "walk-up-c",
  "walk-up-d",
  "walk-down",
  "walk-down-a",
  "walk-down-b",
  "walk-down-c",
  "walk-down-d",
  "arriving",
  "entering-location",
  "exiting-location",
  "combatIdle",
  "attack",
  "meleeAttack",
  "meleeSlash",
  "thrustAttack",
  "rangedAttack",
  "unarmedAttack",
  "castAttack",
  "block",
  "hurt",
  "defeated"
];

const POSE = P+"poses/base/";

export const PLAYER_POSE_ASSETS = {
  idle:{base:POSE+"player-idle-v80.png"},
  "walk-left":{base:POSE+"player-walk-left-v80.png"},
  "walk-left-a":{base:POSE+"player-walk-left-v80.png"},
  "walk-left-b":{base:POSE+"player-walk-left-b-v80.png"},
  "walk-left-c":{base:POSE+"player-walk-left-c-v80.png"},
  "walk-left-d":{base:POSE+"player-walk-left-d-v80.png"},
  "walk-right":{base:POSE+"player-walk-right-v80.png"},
  "walk-right-a":{base:POSE+"player-walk-right-v80.png"},
  "walk-right-b":{base:POSE+"player-walk-right-b-v80.png"},
  "walk-right-c":{base:POSE+"player-walk-right-c-v80.png"},
  "walk-right-d":{base:POSE+"player-walk-right-d-v80.png"},
  "walk-forward":{base:POSE+"player-walk-forward-v80.png"},
  "walk-forward-a":{base:POSE+"player-walk-forward-v80.png"},
  "walk-forward-b":{base:POSE+"player-walk-forward-b-v80.png"},
  "walk-forward-c":{base:POSE+"player-walk-forward-c-v80.png"},
  "walk-forward-d":{base:POSE+"player-walk-forward-d-v80.png"},
  "walk-away":{base:POSE+"player-walk-away-v80.png"},
  "walk-away-a":{base:POSE+"player-walk-away-v80.png"},
  "walk-away-b":{base:POSE+"player-walk-away-b-v80.png"},
  "walk-away-c":{base:POSE+"player-walk-away-c-v80.png"},
  "walk-away-d":{base:POSE+"player-walk-away-d-v80.png"},
  "walk-up":{base:POSE+"player-walk-away-v80.png"},
  "walk-up-a":{base:POSE+"player-walk-away-v80.png"},
  "walk-up-b":{base:POSE+"player-walk-away-b-v80.png"},
  "walk-up-c":{base:POSE+"player-walk-away-c-v80.png"},
  "walk-up-d":{base:POSE+"player-walk-away-d-v80.png"},
  "walk-down":{base:POSE+"player-walk-forward-v80.png"},
  "walk-down-a":{base:POSE+"player-walk-forward-v80.png"},
  "walk-down-b":{base:POSE+"player-walk-forward-b-v80.png"},
  "walk-down-c":{base:POSE+"player-walk-forward-c-v80.png"},
  "walk-down-d":{base:POSE+"player-walk-forward-d-v80.png"},
  arriving:{base:POSE+"player-arriving-v80.png"},
  "entering-location":{base:POSE+"player-entering-location-v80.png"},
  "exiting-location":{base:POSE+"player-idle-v80.png"},
  combatIdle:{base:POSE+"player-combat-idle-v80.png"},
  attack:{base:POSE+"player-melee-slash-v80.png"},
  meleeAttack:{base:POSE+"player-melee-slash-v80.png"},
  meleeSlash:{base:POSE+"player-melee-slash-v80.png"},
  thrustAttack:{base:POSE+"player-thrust-attack-v80.png"},
  rangedAttack:{base:POSE+"player-ranged-attack-v80.png"},
  unarmedAttack:{base:POSE+"player-unarmed-attack-v80.png"},
  castAttack:{base:POSE+"player-cast-attack-v80.png"},
  block:{base:POSE+"player-block-v80.png"},
  hurt:{base:POSE+"player-hurt-v80.png"},
  defeated:{base:POSE+"player-defeated-v80.png"}
};

export const PLAYER_COMPOSITE_ASSETS = {
  idle:{
    scout_hood:P+"composites/scout_hood/idle-v80.png",
    ash_axe:P+"composites/ash_axe/idle-v80.png",
    leather_armor:P+"composites/leather_armor/idle-v80.png",
    leather_armor_scout_hood:P+"composites/leather_armor_scout_hood/idle-v80.png",
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/idle-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/idle-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/idle-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/idle-v80.png"
  },
  combatIdle:{
    scout_hood:P+"composites/scout_hood/combat-idle-v80.png",
    ash_axe:P+"composites/ash_axe/combat-idle-v80.png",
    leather_armor:P+"composites/leather_armor/combat-idle-v80.png",
    leather_armor_scout_hood:P+"composites/leather_armor_scout_hood/combat-idle-v80.png",
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/combat-idle-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/combat-idle-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/combat-idle-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/combat-idle-v80.png"
  },
  attack:{
    scout_hood:P+"composites/scout_hood/melee-slash-v80.png",
    ash_axe:P+"composites/ash_axe/melee-slash-v80.png",
    leather_armor:P+"composites/leather_armor/melee-slash-v80.png",
    leather_armor_scout_hood:P+"composites/leather_armor_scout_hood/melee-slash-v80.png",
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/melee-slash-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/ranged-attack-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/melee-slash-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/cast-attack-v80.png"
  },
  meleeAttack:{
    scout_hood:P+"composites/scout_hood/melee-slash-v80.png",
    ash_axe:P+"composites/ash_axe/melee-slash-v80.png",
    leather_armor:P+"composites/leather_armor/melee-slash-v80.png",
    leather_armor_scout_hood:P+"composites/leather_armor_scout_hood/melee-slash-v80.png",
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/melee-slash-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/ranged-attack-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/melee-slash-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/cast-attack-v80.png"
  },
  meleeSlash:{
    scout_hood:P+"composites/scout_hood/melee-slash-v80.png",
    ash_axe:P+"composites/ash_axe/melee-slash-v80.png",
    leather_armor:P+"composites/leather_armor/melee-slash-v80.png",
    leather_armor_scout_hood:P+"composites/leather_armor_scout_hood/melee-slash-v80.png",
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/melee-slash-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/melee-slash-v80.png"
  },
  rangedAttack:{
    hunter_ranger:P+"composites/hunter_ranger/ranged-attack-v80.png"
  },
  castAttack:{
    mage_robe_staff:P+"composites/mage_robe_staff/cast-attack-v80.png"
  },
  block:{
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/block-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/block-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/block-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/block-v80.png"
  },
  hurt:{
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/hurt-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/hurt-v80.png",
    chainmail_sword:P+"composites/chainmail_sword/hurt-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/hurt-v80.png"
  },
  defeated:{
    starter_leather_hood_axe:P+"composites/starter_leather_hood_axe/defeated-v80.png",
    hunter_ranger:P+"composites/hunter_ranger/defeated-v80.png",
    mage_robe_staff:P+"composites/mage_robe_staff/defeated-v80.png"
  }
};

export const GEAR_VISUALS = {
  "rusted sword": {
    slot:"weapon", quality:"poor", visualVariant:"rusted",
    portraitLayer:P+"weapons/rusted-sword.svg", icon:I+"weapons/rusted-sword-v16.png"
  },
  "iron sword": {
    slot:"weapon", quality:"common", visualVariant:"iron",
    portraitLayer:P+"weapons/iron-sword.svg", icon:I+"weapons/iron-sword-v16.png"
  },
  "basic iron sword": {
    slot:"weapon", quality:"common", visualVariant:"iron",
    portraitLayer:P+"weapons/iron-sword.svg", icon:I+"weapons/iron-sword-v16.png"
  },
  "ash axe": {
    slot:"weapon", quality:"fine", visualVariant:"ashAxe", weaponCategory:"axe", combatEffect:"cleave",
    portraitLayer:P+"weapons/ash-axe.svg", icon:I+"weapons/ash-axe-v16.png",
    characterOverlayIdle:O+"idle/weapons/ash-axe.png",
    characterOverlayCombat:O+"combat/weapons/ash-axe.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"approved"
  },
  "knight blade": {
    slot:"weapon", quality:"rare", visualVariant:"knightBlade", auraAffinity:"holy",
    portraitLayer:P+"weapons/knight-blade.svg", icon:I+"weapons/knight-blade-v16.png"
  },
  "wooden shield": {
    slot:"offhand", quality:"poor", visualVariant:"woodenShield",
    portraitLayer:P+"shields/wooden-shield.svg", icon:I+"shields/wooden-shield-v16.png"
  },
  "buckler": {
    slot:"offhand", quality:"common", visualVariant:"buckler",
    portraitLayer:P+"shields/buckler.svg", icon:I+"shields/buckler-v16.png"
  },
  "ward charm": {
    slot:"offhand", quality:"fine", visualVariant:"wardCharm", auraAffinity:"warded",
    portraitLayer:P+"shields/ward-charm.svg", icon:I+"shields/ward-charm-v16.png"
  },
  "rusted helm": {
    slot:"helmet", quality:"poor", visualVariant:"rustedHelm",
    portraitLayer:P+"helmets/rusted-helm.svg", icon:I+"helmets/rusted-helm-v16.png"
  },
  "scout hood": {
    slot:"helmet", quality:"common", visualVariant:"scoutHood",
    portraitLayer:P+"helmets/scout-hood.svg", icon:I+"helmets/scout-hood-v16.png",
    characterOverlayIdle:O+"idle/helmet/scout-hood.png",
    characterOverlayCombat:O+"combat/helmet/scout-hood.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"temporary"
  },
  "leather armor": {
    slot:"chest", quality:"common", visualVariant:"leatherArmor", armorVisualClass:"leather_armor",
    portraitLayer:P+"chest/leather-armor.svg", icon:I+"chest/leather-armor-v16.png",
    characterOverlayIdle:O+"idle/chest/leather-armor.png",
    characterOverlayCombat:O+"combat/chest/leather-armor.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"approved"
  },
  "rusted armor": {
    slot:"chest", quality:"poor", visualVariant:"rustedArmor",
    portraitLayer:P+"chest/rusted-armor.svg", icon:I+"chest/rusted-armor-v16.png"
  },
  "chain vest": {
    slot:"chest", quality:"common", visualVariant:"chainVest",
    portraitLayer:P+"chest/chain-vest.svg", icon:I+"chest/chain-vest-v16.png"
  },
  "ash plate": {
    slot:"chest", quality:"fine", visualVariant:"ashPlate", alignmentAffinity:"guardian",
    portraitLayer:P+"chest/ash-plate.svg", icon:I+"chest/ash-plate-v16.png"
  },
  "guard pauldrons": {
    slot:"shoulders", quality:"common", visualVariant:"guardPauldrons",
    portraitLayer:P+"shoulders/guard-pauldrons.svg", icon:I+"shoulders/guard-pauldrons-v16.png"
  },
  "hunter mantle": {
    slot:"shoulders", quality:"fine", visualVariant:"hunterMantle",
    portraitLayer:P+"shoulders/hunter-mantle.svg", icon:I+"shoulders/hunter-mantle-v16.png",
    characterOverlayIdle:O+"idle/shoulders/hunter-mantle.png",
    characterOverlayCombat:O+"combat/shoulders/hunter-mantle.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"temporary"
  },
  "wool trousers": {
    slot:"legs", quality:"poor", visualVariant:"woolTrousers",
    portraitLayer:P+"legs/wool-trousers.svg", icon:I+"legs/wool-trousers.svg"
  },
  "road greaves": {
    slot:"legs", quality:"common", visualVariant:"roadGreaves",
    portraitLayer:P+"legs/road-greaves.svg", icon:I+"legs/road-greaves.svg"
  },
  "traveler boots": {
    slot:"boots", quality:"common", visualVariant:"travelerBoots",
    portraitLayer:P+"boots/traveler-boots.svg", icon:I+"boots/traveler-boots-v35-temp.png",
    temporaryIcon:true,
    characterOverlayIdle:O+"idle/boots/traveler-boots.png",
    characterOverlayCombat:O+"combat/boots/traveler-boots.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"temporary"
  },
  "iron sabatons": {
    slot:"boots", quality:"fine", visualVariant:"ironSabatons",
    portraitLayer:P+"boots/iron-sabatons.svg", icon:I+"boots/iron-sabatons-v16.png"
  },
  "leather bracers": {
    slot:"gloves", quality:"common", visualVariant:"leatherBracers",
    portraitLayer:P+"gloves/leather-bracers.svg", icon:I+"gloves/leather-bracers-v35-temp.png",
    temporaryIcon:true,
    characterOverlayIdle:O+"idle/gloves/leather-bracers.png",
    characterOverlayCombat:O+"combat/gloves/leather-bracers.png",
    bodyOverlayQuality:"debugOnly",
    qualityStatus:"temporary"
  },
  "worn belt": {
    slot:"belt", quality:"common", visualVariant:"wornBelt",
    portraitLayer:P+"belts/worn-belt.svg", icon:I+"belts/worn-belt.svg"
  },
  "torn cloak": {
    slot:"cloak", quality:"poor", visualVariant:"tornCloak",
    portraitLayer:P+"cloaks/torn-cloak.svg", icon:I+"cloaks/torn-cloak.svg"
  },
  "copper ring": {
    slot:"ring", quality:"common", visualVariant:"copperRing",
    portraitLayer:null, icon:I+"rings/copper-ring.svg"
  },
  "oath band": {
    slot:"ring", quality:"fine", visualVariant:"oathBand", auraAffinity:"oath",
    portraitLayer:null, icon:I+"rings/oath-band.svg"
  }
};

export const SLOT_VISUAL_FALLBACKS = {
  weapon: null,
  offhand: GEAR_VISUALS.buckler,
  helmet: GEAR_VISUALS["scout hood"],
  shoulders: GEAR_VISUALS["guard pauldrons"],
  chest: GEAR_VISUALS["leather armor"],
  gloves: GEAR_VISUALS["leather bracers"],
  belt: GEAR_VISUALS["worn belt"],
  legs: GEAR_VISUALS["wool trousers"],
  boots: GEAR_VISUALS["traveler boots"],
  cloak: GEAR_VISUALS["torn cloak"],
  ring: GEAR_VISUALS["copper ring"]
};

export function normalizeGearName(name=""){
  return String(name).trim().toLowerCase().replace(/\s+/g," ");
}

export function inferGearQuality(item={}){
  if(item.quality)return item.quality;
  const name = normalizeGearName(item.name);
  if(name.includes("rusted") || name.includes("wool") || name.includes("wooden") || name.includes("torn"))return "poor";
  if(name.includes("knight") || name.includes("oath"))return "rare";
  if(name.includes("ash") || name.includes("iron sabatons") || name.includes("hunter") || name.includes("ward"))return "fine";
  const upgrade = Number(item.upgradeLevel) || 0;
  if(upgrade >= 3)return "rare";
  if(upgrade >= 1 || Number(item.level) >= 5)return "fine";
  return "common";
}

export function visualForItem(item){
  if(!item)return null;
  const slot = item.slot || "weapon";
  const mapped = GEAR_VISUALS[normalizeGearName(item.name)] || SLOT_VISUAL_FALLBACKS[slot] || null;
  if(!mapped)return {...DEFAULT_VISUAL_HOOKS, slot, quality:inferGearQuality(item), icon:null, itemIcon:null, portraitLayer:null, characterOverlay:null};
  const quality = inferGearQuality({...item, quality:item.quality || mapped.quality});
  const icon = mapped.itemIcon || mapped.icon || null;
  return {...DEFAULT_VISUAL_HOOKS, ...mapped, icon, itemIcon:icon, slot:item.slot || mapped.slot || slot, quality};
}

export function applyGearVisuals(item){
  if(!item)return item;
  const visual = visualForItem(item);
  return {
    ...item,
    slot:item.slot || visual.slot,
    icon:visual.icon || item.icon,
    itemIcon:visual.itemIcon || visual.icon || item.itemIcon || item.icon,
    portraitLayer:visual.portraitLayer || item.portraitLayer,
    characterOverlay:item.characterOverlay ?? visual.characterOverlay ?? null,
    characterOverlayIdle:item.characterOverlayIdle ?? visual.characterOverlayIdle ?? null,
    characterOverlayCombat:item.characterOverlayCombat ?? visual.characterOverlayCombat ?? null,
    characterOverlayAttack:item.characterOverlayAttack ?? visual.characterOverlayAttack ?? null,
    armorVisualClass:item.armorVisualClass ?? visual.armorVisualClass ?? null,
    weaponOverlayCombatIdle:item.weaponOverlayCombatIdle ?? visual.weaponOverlayCombatIdle ?? null,
    weaponOverlayAttack:item.weaponOverlayAttack ?? visual.weaponOverlayAttack ?? null,
    bodyOverlayQuality:item.bodyOverlayQuality ?? visual.bodyOverlayQuality ?? "missing",
    qualityStatus:item.qualityStatus ?? visual.qualityStatus ?? "missing",
    hideDuringAttackIfNoAttackPose:item.hideDuringAttackIfNoAttackPose ?? visual.hideDuringAttackIfNoAttackPose ?? true,
    temporaryIcon:item.temporaryIcon ?? visual.temporaryIcon ?? false,
    quality:item.quality || visual.quality,
    visualVariant:item.visualVariant || visual.visualVariant || null,
    classAffinity:item.classAffinity ?? visual.classAffinity ?? null,
    auraAffinity:item.auraAffinity ?? visual.auraAffinity ?? null,
    alignmentAffinity:item.alignmentAffinity ?? visual.alignmentAffinity ?? null,
    auraLayer:item.auraLayer ?? visual.auraLayer ?? null,
    classOverlayLayer:item.classOverlayLayer ?? visual.classOverlayLayer ?? null,
    faceVariant:item.faceVariant ?? visual.faceVariant ?? "survivor",
    alignmentVariant:item.alignmentVariant ?? visual.alignmentVariant ?? "neutral",
    corruptionVariant:item.corruptionVariant ?? visual.corruptionVariant ?? null,
    holyVariant:item.holyVariant ?? visual.holyVariant ?? null
  };
}

export function normalizeGearObject(gear={}){
  VISUAL_GEAR_SLOTS.forEach(slot=>{
    if(!(slot in gear))gear[slot] = null;
    if(gear[slot])gear[slot] = applyGearVisuals(gear[slot]);
  });
  return gear;
}
