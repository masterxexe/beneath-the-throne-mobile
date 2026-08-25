import { resolveOffhandCategory, resolveWeaponCategory } from "./characterRenderController.js";
import { resolveEnemyVisualClass } from "./enemyVisuals.js";

export const PLAYER_ATTACK_STYLES = {
  sword:["slash","overhead","rising","cross"],
  axe:["chop","cleave","whirl"],
  spear:["thrust","sweep","lunge"],
  mace:["crush","slam","upper"],
  dagger:["stab","flurry","crosscut"],
  bow:["shot","draw","double"],
  staff:["bolt","nova","hexarc"],
  shield:["bash","check","ram"],
  unarmed:["punch","kick","haymaker"]
};

export const ENEMY_ATTACK_STYLES = {
  skeleton:["bone-slash","bone-thrust","bone-overhead"],
  wolf:["pounce","maul","snap"],
  bandit:["knife-rush","cheap-shot","spin"],
  cultist:["ritual-lunge","hex-strike","dagger-arc"],
  corrupted_knight:["greatslash","shield-crash","execution"],
  generic:["rush","swipe","smash"]
};

export const STYLE_EFFECT = {
  slash:"slash",
  overhead:"cleave",
  rising:"slash",
  cross:"slash",
  chop:"cleave",
  cleave:"cleave",
  whirl:"cleave",
  thrust:"thrust",
  sweep:"slash",
  lunge:"thrust",
  crush:"crush",
  slam:"crush",
  upper:"crush",
  stab:"stab",
  flurry:"stab",
  crosscut:"slash",
  shot:"shot",
  draw:"shot",
  double:"shot",
  bolt:"arcane",
  nova:"arcane",
  hexarc:"arcane",
  bash:"crush",
  check:"crush",
  ram:"crush",
  punch:"strike",
  kick:"strike",
  haymaker:"crush"
};

export const STYLE_POSE = {
  slash:"meleeSlash",
  overhead:"meleeSlash",
  rising:"meleeSlash",
  cross:"meleeSlash",
  chop:"meleeSlash",
  cleave:"meleeSlash",
  whirl:"meleeSlash",
  thrust:"thrustAttack",
  sweep:"meleeSlash",
  lunge:"thrustAttack",
  crush:"meleeSlash",
  slam:"unarmedAttack",
  upper:"unarmedAttack",
  stab:"meleeSlash",
  flurry:"unarmedAttack",
  crosscut:"meleeSlash",
  shot:"rangedAttack",
  draw:"rangedAttack",
  double:"rangedAttack",
  bolt:"castAttack",
  nova:"castAttack",
  hexarc:"castAttack",
  bash:"unarmedAttack",
  check:"block",
  ram:"unarmedAttack",
  punch:"unarmedAttack",
  kick:"unarmedAttack",
  haymaker:"unarmedAttack"
};

export const STYLE_LABEL = {
  slash:"Slash",
  overhead:"Overhead",
  rising:"Rising Slash",
  cross:"Cross Slash",
  chop:"Axe Chop",
  cleave:"Cleave",
  whirl:"Whirl",
  thrust:"Thrust",
  sweep:"Sweep",
  lunge:"Lunge",
  crush:"Crush",
  slam:"Slam",
  upper:"Uppercut",
  stab:"Stab",
  flurry:"Flurry",
  crosscut:"Crosscut",
  shot:"Bow Shot",
  draw:"Draw Shot",
  double:"Double Shot",
  bolt:"Arcane Bolt",
  nova:"Nova",
  hexarc:"Hex Arc",
  bash:"Shield Bash",
  check:"Shield Check",
  ram:"Shield Ram",
  punch:"Punch",
  kick:"Kick",
  haymaker:"Haymaker",
  "bone-slash":"Bone Slash",
  "bone-thrust":"Bone Thrust",
  "bone-overhead":"Bone Overhead",
  pounce:"Pounce",
  maul:"Maul",
  snap:"Snap",
  "knife-rush":"Knife Rush",
  "cheap-shot":"Cheap Shot",
  spin:"Spin Slash",
  "ritual-lunge":"Ritual Lunge",
  "hex-strike":"Hex Strike",
  "dagger-arc":"Dagger Arc",
  greatslash:"Greatslash",
  "shield-crash":"Shield Crash",
  execution:"Execution",
  rush:"Rush",
  swipe:"Swipe",
  smash:"Smash"
};

function equipped(hero, slot){
  return hero?.gear?.[slot] || null;
}

export function resolveHeroWeaponCategory(hero){
  const offhand = resolveOffhandCategory(equipped(hero, "offhand"));
  const weapon = resolveWeaponCategory(equipped(hero, "weapon"));
  if(!weapon && offhand === "shield")return "shield";
  return weapon || "unarmed";
}

export function nextHeroAttackStyle(hero, comboStep = 0){
  const category = resolveHeroWeaponCategory(hero);
  const styles = PLAYER_ATTACK_STYLES[category] || PLAYER_ATTACK_STYLES.unarmed;
  const style = styles[Math.abs(comboStep) % styles.length];
  return {
    category,
    style,
    combo:(Math.abs(comboStep) % styles.length) + 1,
    comboMax:styles.length,
    pose:STYLE_POSE[style] || "meleeSlash",
    effect:STYLE_EFFECT[style] || "slash"
  };
}

export function nextEnemyAttackStyle(enemy, comboStep = 0){
  const visualClass = resolveEnemyVisualClass(enemy) || "generic";
  const styles = ENEMY_ATTACK_STYLES[visualClass] || ENEMY_ATTACK_STYLES.generic;
  const style = styles[Math.abs(comboStep) % styles.length];
  return {
    category:visualClass,
    style,
    combo:(Math.abs(comboStep) % styles.length) + 1,
    comboMax:styles.length,
    pose:"attack",
    effect:enemyEffectForStyle(style)
  };
}

export function nextCompanionAttackStyle(companion, comboStep = 0){
  const category = companionWeaponCategory(companion);
  const styles = PLAYER_ATTACK_STYLES[category] || PLAYER_ATTACK_STYLES.unarmed;
  const style = styles[Math.abs(comboStep) % styles.length];
  return {
    category,
    style,
    combo:(Math.abs(comboStep) % styles.length) + 1,
    comboMax:styles.length,
    pose:STYLE_POSE[style] || "meleeSlash",
    effect:STYLE_EFFECT[style] || "slash"
  };
}

function companionWeaponCategory(companion){
  const weapon = resolveWeaponCategory(companion?.gear?.weapon);
  if(weapon)return weapon;
  const role = `${companion?.role || ""} ${companion?.class || ""}`.toLowerCase();
  if(/scout|ranger|hunter|archer/.test(role))return "bow";
  if(/rogue|thief/.test(role))return "dagger";
  if(/mystic|mage|caster|healer|cleric/.test(role))return "staff";
  if(/guard|knight/.test(role))return "mace";
  return "sword";
}

export function presentationForStyle(style, side = "hero", actor = null){
  if(side === "enemy"){
    return {
      category:actor ? (resolveEnemyVisualClass(actor) || "generic") : "generic",
      style,
      combo:1,
      comboMax:1,
      pose:"attack",
      effect:enemyEffectForStyle(style)
    };
  }
  return {
    category:actor ? resolveHeroWeaponCategory(actor) : "sword",
    style,
    combo:1,
    comboMax:1,
    pose:STYLE_POSE[style] || "meleeSlash",
    effect:STYLE_EFFECT[style] || "slash"
  };
}

export function styleDisplayName(style){
  if(STYLE_LABEL[style])return STYLE_LABEL[style];
  return String(style || "Strike").replace(/-/g," ").replace(/\b\w/g, char => char.toUpperCase());
}

export function allPlayerStyleIds(){
  return [...new Set(Object.values(PLAYER_ATTACK_STYLES).flat())];
}

export function allEnemyStyleIds(){
  return [...new Set(Object.values(ENEMY_ATTACK_STYLES).flat())];
}

function enemyEffectForStyle(style){
  if(/thrust|lunge/.test(style))return "thrust";
  if(/pounce|maul|snap/.test(style))return "cleave";
  if(/hex|ritual/.test(style))return "arcane";
  if(/crash|smash|execution/.test(style))return "crush";
  if(/stab|knife/.test(style))return "stab";
  return "slash";
}

export function attackStyleClass(style){
  return `combat-style-${String(style || "slash").replace(/[^a-z0-9-]/gi,"")}`;
}

export function attackWeaponClass(category){
  return `combat-weapon-${String(category || "unarmed").replace(/[^a-z0-9-]/gi,"")}`;
}

export function fxOverlayHTML(style, effect, side = "hero"){
  const safeStyle = String(style || effect || "slash");
  const safeEffect = String(effect || "slash");
  return `
    <span class="combat-fx combat-fx-${escAttr(safeEffect)} combat-fx-style-${escAttr(safeStyle)} combat-fx-${escAttr(side)}" aria-hidden="true">
      <i class="combat-fx-arc"></i>
      <i class="combat-fx-arc combat-fx-arc-b"></i>
      <i class="combat-fx-spark"></i>
      <i class="combat-fx-spark combat-fx-spark-b"></i>
      <i class="combat-fx-burst"></i>
      <i class="combat-fx-afterimage"></i>
    </span>
  `;
}

function escAttr(value){
  return String(value ?? "").replace(/[^a-z0-9_-]/gi,"");
}
