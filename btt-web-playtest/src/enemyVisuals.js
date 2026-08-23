const ENEMY_ROOT = "assets/portraits/enemies/";
const V80_ACTOR_ROOT = "assets/actors/generated/v80/";
const ENEMY_ART_CACHE = "v115";

export const ENEMY_POSE_STATES = ["idle","attack","hurt","defeated"];

export const ENEMY_VISUAL_ASSETS = {
  skeleton:{
    label:"Skeleton",
    tone:"bone",
    poses:{
      idle:V80_ACTOR_ROOT+"skeleton-warrior-idle-v80.png",
      attack:V80_ACTOR_ROOT+"skeleton-warrior-attack-v80.png",
      hurt:V80_ACTOR_ROOT+"skeleton-warrior-hurt-v80.png",
      defeated:ENEMY_ROOT+"skeleton/defeated-v80.png"
    }
  },
  wolf:{
    label:"Wolf",
    tone:"beast",
    poses:{
      idle:V80_ACTOR_ROOT+"wolf-stalker-idle-v80.png",
      attack:V80_ACTOR_ROOT+"wolf-stalker-attack-v80.png",
      hurt:V80_ACTOR_ROOT+"wolf-stalker-hurt-v80.png",
      defeated:ENEMY_ROOT+"wolf/defeated-v80.png"
    }
  },
  bandit:{
    label:"Bandit",
    tone:"rust",
    poses:{
      idle:V80_ACTOR_ROOT+"cultist-bandit-idle-v80.png",
      attack:V80_ACTOR_ROOT+"cultist-bandit-attack-v80.png",
      hurt:V80_ACTOR_ROOT+"cultist-bandit-hurt-v80.png",
      defeated:ENEMY_ROOT+"bandit/defeated-v80.png"
    }
  },
  cultist:{
    label:"Cultist",
    tone:"violet",
    poses:{
      idle:V80_ACTOR_ROOT+"cultist-acolyte-idle-v80.png",
      attack:V80_ACTOR_ROOT+"cultist-acolyte-attack-v80.png",
      hurt:V80_ACTOR_ROOT+"cultist-acolyte-hurt-v80.png",
      defeated:ENEMY_ROOT+"cultist/defeated-v80.png"
    }
  },
  corrupted_knight:{
    label:"Corrupted Knight",
    tone:"cold",
    tier:"elite",
    poses:{
      idle:V80_ACTOR_ROOT+"elite-corrupted-knight-idle-v80.png",
      attack:V80_ACTOR_ROOT+"elite-corrupted-knight-attack-v80.png",
      hurt:V80_ACTOR_ROOT+"elite-corrupted-knight-hurt-v80.png",
      defeated:ENEMY_ROOT+"corrupted_knight/defeated-v80.png"
    }
  }
};

const VALID_CLASSES = Object.keys(ENEMY_VISUAL_ASSETS);

function normalizeVisualClass(value){
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function inferEnemyVisualClass(enemy){
  const name = String(enemy?.name || "").toLowerCase();
  const role = String(enemy?.role || "").toLowerCase();
  const text = `${name} ${role}`;

  if(/cult|acolyte|ritual|priest|hexer|knave/.test(text))return "cultist";
  if(/wolf|hound|beast|stalker|fang|lobo/.test(text))return "wolf";
  if(/skeleton|bone|undead|wight|ghoul|grave|banner guard|esqueleto/.test(text))return "skeleton";
  if(/knight|warden|corrupted|cursed|hunter|warlord|king|defender|soldier|caballero/.test(text))return "corrupted_knight";
  if(
    /bandit|thug|raider|knife|rat|bailiff|dock|cutpurse|thief|guard|collector|duelist|bravo|cutthroat|runner|mask|enforcer|desperate|brigand|outlaw|robber|gang|captain|ledger|writ|gallows|lantern|court|bribe|debt|alley/.test(text)
  )return "bandit";
  if(role.includes("elite") || role.includes("boss") || role.includes("hunter"))return "corrupted_knight";
  if(role.includes("beast"))return "wolf";
  if(role.includes("undead"))return "skeleton";
  return "bandit";
}

export function stampEnemyVisualClass(enemy, options = {}){
  if(!enemy || typeof enemy !== "object")return enemy;
  const force = !!options.force;
  const existing = normalizeVisualClass(enemy.enemyVisualClass);
  if(!force && VALID_CLASSES.includes(existing))return enemy;
  enemy.enemyVisualClass = inferEnemyVisualClass(enemy);
  return enemy;
}

export function resolveEnemyVisualClass(enemy){
  const stamped = normalizeVisualClass(enemy?.enemyVisualClass);
  if(VALID_CLASSES.includes(stamped))return stamped;
  return inferEnemyVisualClass(enemy);
}

export function resolveEnemyPoseAsset(enemy, requestedPose = "idle"){
  const visualClass = resolveEnemyVisualClass(enemy);
  const registry = ENEMY_VISUAL_ASSETS[visualClass] || ENEMY_VISUAL_ASSETS.bandit;
  const pose = ENEMY_POSE_STATES.includes(requestedPose) ? requestedPose : "idle";
  const exact = registry.poses[pose] || null;
  const idle = registry.poses.idle || null;
  const file = exact || idle;
  if(!file)return null;
  const path = `${file}?v=${ENEMY_ART_CACHE}`;
  return {
    visualClass,
    label:registry.label,
    tone:registry.tone,
    tier:registry.tier || "common",
    requestedPose:pose,
    resolvedPose:exact ? pose : "idle",
    fallback:!exact,
    path
  };
}

export function enemyVisualHTML(enemy, requestedPose = "idle"){
  const visual = resolveEnemyPoseAsset(enemy, requestedPose);
  if(!visual)return "";
  const name = enemy?.name || visual.label || "Enemy";
  return `
    <div class="enemy-pose-frame enemy-pose-${visual.visualClass} enemy-pose-state-${visual.resolvedPose}" data-enemy-visual="${visual.visualClass}" data-enemy-pose="${visual.resolvedPose}" data-enemy-requested-pose="${visual.requestedPose}" data-tone="${visual.tone}" role="img" aria-label="${name} ${visual.resolvedPose} pose">
      <img class="enemy-pose-art" src="${visual.path}" alt="" loading="eager" decoding="async" draggable="false" />
      <span class="enemy-pose-ground"></span>
      <span class="enemy-pose-glow"></span>
      <span class="enemy-pose-vignette"></span>
      <span class="enemy-pose-frame-line"></span>
    </div>
  `;
}

export function debugEnemyVisualRegistry(){
  return Object.fromEntries(Object.entries(ENEMY_VISUAL_ASSETS).map(([visualClass,entry])=>[
    visualClass,
    ENEMY_POSE_STATES.map(pose=>({
      pose,
      path:entry.poses[pose] || null,
      registered:Boolean(entry.poses[pose])
    }))
  ]));
}
