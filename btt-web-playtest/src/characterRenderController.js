import { applyGearVisuals, visualForItem } from "./gearVisuals.js";

export const CHARACTER_RENDER_SLOTS = [
  "body","armor","shoulders","gloves","boots","cloak","helmet","weapon","offhand","idlePose","combatPose","travelPose"
];

export const WEAPON_CATEGORIES = ["sword","axe","spear","mace","dagger","bow","staff"];

const QUALITY_RANK = {poor:1, common:2, fine:3, rare:4};
const ARMOR_SLOTS = ["helmet","chest","shoulders","gloves","belt","legs","boots","cloak"];

function equippedItem(hero, slot){
  return hero?.gear?.[slot] ? applyGearVisuals(hero.gear[slot]) : null;
}

function gearName(item){
  return String(item?.name || item?.visualVariant || "").toLowerCase();
}

function isGear(item, pattern){
  return pattern.test(gearName(item));
}

export function resolveWeaponCategory(item){
  const name = String(item?.name || item?.visualVariant || "").toLowerCase();
  if(/bow|crossbow/.test(name))return "bow";
  if(/spear|pike|lance|polearm|halberd/.test(name))return "spear";
  if(/staff|wand|focus|scepter|orb/.test(name))return "staff";
  if(/mace|hammer|club/.test(name))return "mace";
  if(/dagger|knife|dirk/.test(name))return "dagger";
  if(/axe|hatchet/.test(name))return "axe";
  if(/sword|blade|sabre|saber/.test(name))return "sword";
  return item ? "sword" : null;
}

export function resolveOffhandCategory(item){
  const name = String(item?.name || "").toLowerCase();
  if(/charm|ward|band|focus|orb/.test(name))return "charm";
  if(/shield|buckler/.test(name))return "shield";
  return item ? "offhand" : null;
}

function armorScore(item){
  const visual = visualForItem(item);
  return QUALITY_RANK[visual?.quality || item?.quality] || 0;
}

export function resolveArmorState(hero){
  const gear = hero?.gear || {};
  const armorItems = ARMOR_SLOTS.map(slot=>equippedItem(hero, slot)).filter(Boolean);
  const poorArmorCount = armorItems.filter(item=>armorScore(item) === QUALITY_RANK.poor).length;
  const commonArmorCount = armorItems.filter(item=>armorScore(item) >= QUALITY_RANK.common).length;
  const fineArmorCount = armorItems.filter(item=>armorScore(item) >= QUALITY_RANK.fine).length;
  if(gear.chest && gear.shoulders && gear.boots && fineArmorCount >= 3)return "knight";
  if(gear.chest && (gear.shoulders || gear.boots || gear.legs) && commonArmorCount >= 3)return "road";
  if(gear.chest && gear.helmet && poorArmorCount >= 3)return "rusted";
  return "base";
}

export function resolveArmorVisualClass(hero){
  const chest = equippedItem(hero, "chest");
  const helmet = equippedItem(hero, "helmet");
  const shoulders = equippedItem(hero, "shoulders");
  const cloak = equippedItem(hero, "cloak");
  const weapon = equippedItem(hero, "weapon");
  const weaponCategory = resolveWeaponCategory(weapon);
  const hasLeatherArmor = chest?.armorVisualClass === "leather_armor" || isGear(chest, /leather armor/);
  const hasScoutHood = isGear(helmet, /scout hood/);
  const hasAshAxe = isGear(weapon, /ash axe|ashaxe/);
  const hasHunterGear = isGear(shoulders, /hunter mantle/) || isGear(cloak, /travel|cloak|mantle/);
  const hasChainmail = isGear(chest, /chain vest|chainmail|mail/);
  const hasMageGear = isGear(chest, /robe|mage/) || isGear(cloak, /robe|mage/);
  const hasChestArmor = !!chest;
  if(hasLeatherArmor && hasScoutHood && hasAshAxe)return "starter_leather_hood_axe";
  if(hasLeatherArmor && hasScoutHood)return "leather_armor_scout_hood";
  if(hasChainmail)return "chainmail_sword";
  if(hasLeatherArmor)return "leather_armor";
  if(hasMageGear || (!hasChestArmor && weaponCategory === "staff"))return "mage_robe_staff";
  if(!hasChestArmor && (hasHunterGear || weaponCategory === "bow"))return "hunter_ranger";
  if(hasScoutHood && hasAshAxe)return "ash_axe";
  if(hasScoutHood)return "scout_hood";
  if(hasAshAxe)return "ash_axe";
  if(chest?.armorVisualClass)return chest.armorVisualClass;
  return "base_survivor";
}

export function resolvePoseForWeaponCategory(category){
  if(!category)return "unarmedAttack";
  if(category === "bow")return "rangedAttack";
  if(category === "spear")return "thrustAttack";
  if(category === "staff")return "castAttack";
  return "meleeSlash";
}

export function resolveCombatEffectForWeaponCategory(category){
  if(!category)return "strike";
  if(category === "bow")return "shot";
  if(category === "spear")return "thrust";
  if(category === "staff")return "arcane";
  if(category === "axe")return "cleave";
  if(category === "mace")return "crush";
  if(category === "dagger")return "stab";
  return "slash";
}

export function resolveCharacterRenderState(hero, options = {}){
  const gear = hero?.gear || {};
  const mainHand = equippedItem(hero, "weapon");
  const offHand = equippedItem(hero, "offhand");
  const armorItems = ARMOR_SLOTS.map(slot=>equippedItem(hero, slot)).filter(Boolean);
  const weaponCategory = resolveWeaponCategory(mainHand);
  const attackPose = resolvePoseForWeaponCategory(weaponCategory);
  const combatPose = options.combatPose || "combatIdle";
  return {
    slots: CHARACTER_RENDER_SLOTS,
    body:"survivor",
    armorState:resolveArmorState(hero),
    armorVisualClass:resolveArmorVisualClass(hero),
    armorItems,
    equipped:{
      weapon:mainHand,
      offhand:offHand,
      helmet:equippedItem(hero, "helmet"),
      shoulders:equippedItem(hero, "shoulders"),
      chest:equippedItem(hero, "chest"),
      gloves:equippedItem(hero, "gloves"),
      belt:equippedItem(hero, "belt"),
      legs:equippedItem(hero, "legs"),
      boots:equippedItem(hero, "boots"),
      cloak:equippedItem(hero, "cloak")
    },
    flags:{
      hasMainHand:!!mainHand,
      mainHandType:weaponCategory,
      weaponCategory,
      hasOffHand:!!offHand,
      offHandType:resolveOffhandCategory(offHand),
      hasHelmet:!!gear.helmet,
      hasChest:!!gear.chest,
      hasShoulders:!!gear.shoulders,
      hasBoots:!!gear.boots,
      armorTierScore:armorItems.reduce((sum,item)=>sum + armorScore(item),0),
      armorItemCount:armorItems.length,
      poorArmorCount:armorItems.filter(item=>armorScore(item) === QUALITY_RANK.poor).length,
      commonArmorCount:armorItems.filter(item=>armorScore(item) >= QUALITY_RANK.common).length,
      fineArmorCount:armorItems.filter(item=>armorScore(item) >= QUALITY_RANK.fine).length
    },
    poses:{
      idle:options.idlePose || "idle",
      combat:combatPose,
      travel:options.travelPose || "idle",
      attack:attackPose
    },
    weaponCategory,
    combatEffect:resolveCombatEffectForWeaponCategory(weaponCategory)
  };
}

export function resolvePlayerVisualFlags(hero){
  const render = resolveCharacterRenderState(hero);
  return {...render.flags, armorState:render.armorState};
}

export function resolvePlayerCombatPresentation(hero){
  const render = resolveCharacterRenderState(hero);
  return {
    weaponCategory:render.weaponCategory,
    attackPose:render.poses.attack,
    effect:render.combatEffect,
    armorState:render.armorState
  };
}
