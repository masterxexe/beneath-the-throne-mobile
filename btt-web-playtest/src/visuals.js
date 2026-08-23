import { state } from "./state.js";
import { resolveBattleSceneArt } from "./battleSceneArt.js";

const CLASS_PORTRAITS = {
  warrior:{
    id:"hero-warrior",
    label:"Warrior portrait",
    classes:"portrait-unique portrait-hero portrait-class-cutout portrait-warrior",
    tone:"ember",
    asset:"./assets/tutorial/generated/v80/class-warrior-v80.webp"
  },
  rogue:{
    id:"hero-rogue",
    label:"Rogue portrait",
    classes:"portrait-unique portrait-hero portrait-class-cutout portrait-rogue",
    tone:"shadow",
    asset:"./assets/tutorial/generated/v80/class-rogue-v80.webp"
  },
  mage:{
    id:"hero-mage",
    label:"Mage portrait",
    classes:"portrait-unique portrait-hero portrait-class-cutout portrait-mage",
    tone:"arcane",
    asset:"./assets/tutorial/generated/v80/class-mage-v80.webp"
  },
  ranger:{
    id:"hero-ranger",
    label:"Ranger portrait",
    classes:"portrait-unique portrait-hero portrait-class-cutout portrait-ranger",
    tone:"wild",
    asset:"./assets/tutorial/generated/v80/class-ranger-v80.webp"
  },
  cleric:{
    id:"hero-cleric",
    label:"Cleric portrait",
    classes:"portrait-unique portrait-hero portrait-class-cutout portrait-cleric",
    tone:"gold",
    asset:"./assets/tutorial/generated/v80/class-cleric-v80.webp"
  }
};

const ENEMY_PORTRAITS = {
  skeleton:{id:"enemy-skeleton",label:"Skeleton portrait",classes:"portrait-enemy-art portrait-skeleton",tone:"bone",x:"33.333%",y:"33.333%"},
  cultist:{id:"enemy-cultist",label:"Cultist portrait",classes:"portrait-enemy-art portrait-cultist",tone:"violet",x:"66.667%",y:"33.333%"},
  wolf:{id:"enemy-wolf",label:"Wolf portrait",classes:"portrait-enemy-art portrait-wolf",tone:"beast",x:"100%",y:"33.333%"},
  bandit:{id:"enemy-bandit",label:"Bandit portrait",classes:"portrait-enemy-art portrait-bandit",tone:"rust",x:"0%",y:"66.667%"},
  raider:{id:"enemy-raider",label:"Raider portrait",classes:"portrait-enemy-art portrait-raider",tone:"rust",x:"33.333%",y:"66.667%"},
  cursed:{id:"enemy-cursed",label:"Cursed knight portrait",classes:"portrait-enemy-art portrait-cursed",tone:"cold",x:"66.667%",y:"66.667%"},
  ashen:{id:"enemy-ashen",label:"Ash warden portrait",classes:"portrait-enemy-art portrait-ashen",tone:"ember",x:"100%",y:"66.667%"},
  boss:{id:"enemy-boss",label:"Boss portrait",classes:"portrait-enemy-art portrait-boss",tone:"blood",x:"0%",y:"100%"}
};

const COMPANION_PORTRAITS = {
  fighter:{id:"companion-fighter",label:"Companion portrait",classes:"portrait-companion-art portrait-companion-fighter",tone:"steel",x:"33.333%",y:"100%"},
  healer:{id:"companion-healer",label:"Companion portrait",classes:"portrait-companion-art portrait-companion-healer",tone:"gold",x:"66.667%",y:"100%"},
  scout:{id:"companion-scout",label:"Companion portrait",classes:"portrait-companion-art portrait-companion-scout",tone:"wild",x:"100%",y:"100%"}
};

const UNIQUE_PORTRAITS = {
  diseased_dragon:{
    id:"story-diseased-dragon",label:"Diseased Dragon portrait",
    classes:"portrait-unique portrait-story portrait-legendary portrait-diseased-dragon",tone:"plague",tier:"legendary",
    asset:"./assets/portraits/story/diseased-dragon-painted.png"
  },
  ser_kael:{
    id:"story-ser-kael",label:"Ser Kael portrait",
    classes:"portrait-unique portrait-story portrait-legendary portrait-ser-kael",tone:"radiant",tier:"legendary",
    asset:"./assets/portraits/story/ser-kael-painted.png"
  },
  xexe_survivor:{
    id:"story-xexe-survivor",label:"Ashen survivor portrait",
    classes:"portrait-unique portrait-story portrait-xexe-survivor",tone:"ash",tier:"story",
    asset:"./assets/portraits/story/xexe-survivor-painted.png"
  },
  tutorial_skeleton:{
    id:"story-tutorial-skeleton",label:"Road Skeleton portrait",
    classes:"portrait-unique portrait-story portrait-tutorial-skeleton",tone:"bone",tier:"story",
    asset:"./assets/portraits/story/tutorial-skeleton-painted.png"
  },
  regional_boss:{
    id:"boss-regional",label:"Regional boss portrait",
    classes:"portrait-unique portrait-boss-tier portrait-regional-boss",tone:"blood",tier:"boss",
    asset:"./assets/legendary/regional-boss.png"
  },
  elite_rare:{
    id:"elite-rare",label:"Elite rare enemy portrait",
    classes:"portrait-unique portrait-boss-tier portrait-elite-rare",tone:"cold",tier:"rare",
    asset:"./assets/legendary/elite-rare.png"
  }
};

const BACKDROPS = {
  ashen_fields:{id:"ashen-fields",label:"Ashen Fields",classes:"backdrop-ashen-fields",mood:"ember",x:"0%",y:"0%"},
  forest:{id:"forest",label:"Forest",classes:"backdrop-forest",mood:"wild",x:"100%",y:"0%"},
  ruins:{id:"ruins",label:"Ruins",classes:"backdrop-ruins",mood:"cold",x:"0%",y:"33.333%"},
  road:{id:"road",label:"Road",classes:"backdrop-road",mood:"dust",x:"100%",y:"33.333%"},
  town_outskirts:{id:"town-outskirts",label:"Town Outskirts",classes:"backdrop-town-outskirts",mood:"lantern",x:"0%",y:"66.667%"},
  storm:{id:"storm",label:"Storm Coast",classes:"backdrop-storm",mood:"storm",x:"100%",y:"66.667%"},
  hollow:{id:"hollow",label:"Hollow Kingdom",classes:"backdrop-hollow",mood:"shadow",x:"0%",y:"100%"},
  battlefield:{id:"battlefield",label:"Battlefield",classes:"backdrop-battlefield",mood:"blood",x:"100%",y:"100%"},
  dragon_intro:{id:"dragon-intro",label:"Dragon at Ashen Keep",classes:"backdrop-battlefield backdrop-dragon-intro",mood:"plague",x:"100%",y:"100%"}
};

const REGION_BACKDROPS = {
  ashen_fields:"ashen_fields",
  green_march:"forest",
  frostmere:"ruins",
  storm_coast:"storm",
  hollow_kingdom:"hollow"
};

export function heroPortrait(hero){
  if(hero?.portraitId && UNIQUE_PORTRAITS[hero.portraitId])return UNIQUE_PORTRAITS[hero.portraitId];
  return CLASS_PORTRAITS[hero?.advancedClass] || CLASS_PORTRAITS[hero?.class] || CLASS_PORTRAITS.warrior;
}

export function companionPortrait(companion){
  if(companion?.portraitId && UNIQUE_PORTRAITS[companion.portraitId])return UNIQUE_PORTRAITS[companion.portraitId];
  const type = companion?.class || companion?.role || "fighter";
  return COMPANION_PORTRAITS[type] || COMPANION_PORTRAITS.fighter;
}

export function enemyPortrait(enemy){
  const text = `${enemy?.name || ""} ${enemy?.role || ""}`.toLowerCase();
  const unique = uniqueEnemyPortrait(text);
  if(unique)return unique;
  if(text.includes("skeleton"))return ENEMY_PORTRAITS.skeleton;
  if(text.includes("cultist"))return ENEMY_PORTRAITS.cultist;
  if(text.includes("wolf") || text.includes("beast"))return ENEMY_PORTRAITS.wolf;
  if(text.includes("boss") || text.includes("warlord") || text.includes("king"))return UNIQUE_PORTRAITS.regional_boss;
  if(text.includes("raider"))return ENEMY_PORTRAITS.raider;
  if(text.includes("cursed"))return ENEMY_PORTRAITS.cursed;
  if(text.includes("warden") || text.includes("ash"))return ENEMY_PORTRAITS.ashen;
  return ENEMY_PORTRAITS.bandit;
}

function uniqueEnemyPortrait(text){
  if(text.includes("diseased dragon") || text.includes("dragon enfermo"))return UNIQUE_PORTRAITS.diseased_dragon;
  if(text.includes("regional boss") || text.includes("jefe regional"))return UNIQUE_PORTRAITS.regional_boss;
  if(text.includes("hunter") || text.includes("elite") || text.includes("cursed knight") || text.includes("ash warden"))return UNIQUE_PORTRAITS.elite_rare;
  return null;
}

export function uniquePortrait(id){
  return UNIQUE_PORTRAITS[id] || null;
}

export function isMajorVisual(visual){
  return ["story","rare","boss","legendary"].includes(visual?.tier);
}

export function combatBackdrop(region,battle){
  const text = `${battle?.sceneText || battle?.log?.[0] || ""}`.toLowerCase();
  if(text.includes("diseased dragon") || text.includes("dragon"))return BACKDROPS.dragon_intro;
  const meta = battle?.meta || {};
  const locationId = meta.locationId || state?.world?.locationId || "";
  const roadNodeId = meta.encounterRoadNodeId || null;
  const dynamic = resolveBattleSceneArt({
    locationId,
    roadNodeId,
    regionId: region?.id,
    battle,
    worldState: state?.world?.locationStates?.[locationId],
    roadStopState: roadNodeId ? state?.world?.roadStopStates?.[roadNodeId] : null
  });
  if(dynamic)return dynamic;
  if(text.includes("boss") || text.includes("warlord") || text.includes("hunter") || text.includes("king"))return BACKDROPS.battlefield;
  if(text.includes("town") || text.includes("keep"))return BACKDROPS.town_outskirts;
  if(text.includes("road") || text.includes("ambush"))return BACKDROPS.road;
  return BACKDROPS[REGION_BACKDROPS[region?.id] || "ashen_fields"];
}

function portraitStyle(visual){
  if(visual?.asset){
    return `--portrait-image:url(${visual.asset});--portrait-x:center;--portrait-y:center`;
  }
  return `--portrait-x:${visual?.x || "0%"};--portrait-y:${visual?.y || "0%"}`;
}

export function portraitHTML(visual){
  const v = visual || CLASS_PORTRAITS.warrior;
  return `
    <div class="portrait-art ${v.classes}" style="${portraitStyle(v)}" data-tone="${v.tone}" data-tier="${v.tier || "common"}" role="img" aria-label="${v.label}">
      <span class="portrait-grain"></span>
      <span class="portrait-shadow"></span>
      <span class="portrait-glow"></span>
      <span class="portrait-frame"></span>
    </div>
  `;
}

export function backdropHTML(backdrop){
  const b = backdrop || BACKDROPS.ashen_fields;
  const artStyle = b.art ? `;--combat-art:url('${b.art}')` : "";
  const artClass = b.art ? "has-combat-art" : "";
  return `
    <div class="combat-backdrop ${b.classes} ${artClass}" style="--backdrop-x:${b.x || "0%"};--backdrop-y:${b.y || "0%"}${artStyle}" data-mood="${b.mood}" aria-hidden="true">
      <span class="scene-depth"></span>
      <span class="scene-silhouette"></span>
      <span class="scene-weather"></span>
      <span class="scene-fog scene-fog-a"></span>
      <span class="scene-fog scene-fog-b"></span>
      <span class="scene-light"></span>
      <span class="scene-vignette"></span>
    </div>
  `;
}
