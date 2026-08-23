const ENEMY_ROOT = "assets/portraits/enemies/";
const V80_ACTOR_ROOT = "assets/actors/generated/v80/";

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

export function resolveEnemyVisualClass(enemy){
  const text = `${enemy?.enemyVisualClass || ""} ${enemy?.name || ""} ${enemy?.role || ""}`.toLowerCase();
  if(text.includes("skeleton"))return "skeleton";
  if(text.includes("corrupted knight") || text.includes("cursed knight") || text.includes("warden"))return "corrupted_knight";
  if(text.includes("cultist"))return "cultist";
  if(text.includes("wolf") || text.includes("beast"))return "wolf";
  if(text.includes("hunter") && !text.includes("ranger"))return "bandit";
  if(text.includes("bailiff") || text.includes("writ captain") || text.includes("bell tower"))return "bandit";
  if(
    text.includes("bandit") ||
    text.includes("raider") ||
    text.includes("gang") ||
    text.includes("enforcer") ||
    text.includes("thief") ||
    text.includes("cutpurse") ||
    text.includes("robber") ||
    text.includes("outlaw") ||
    text.includes("brigand") ||
    text.includes("desperate") ||
    text.includes("dock rat") ||
    text.includes("corner knife") ||
    text.includes("knife")
  )return "bandit";
  return null;
}

export function resolveEnemyPoseAsset(enemy, requestedPose = "idle"){
  const visualClass = resolveEnemyVisualClass(enemy);
  const registry = visualClass ? ENEMY_VISUAL_ASSETS[visualClass] : null;
  if(!registry)return null;
  const pose = ENEMY_POSE_STATES.includes(requestedPose) ? requestedPose : "idle";
  const exact = registry.poses[pose] || null;
  const idle = registry.poses.idle || null;
  const path = exact || idle;
  if(!path)return null;
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
