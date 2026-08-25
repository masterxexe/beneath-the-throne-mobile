import { hasWorldArtState, normalizeWorldArtState } from "./worldStateArt.js";

const DEFAULT_BATTLE_ART = "assets/battlebacks/generated/ash-road-ambush-v18.png";

export const BATTLE_SCENE_ART = {
  road: {
    id: "road-ambush-v18",
    label: "Ash road ambush",
    classes: "backdrop-road backdrop-v18-art",
    mood: "dust",
    art: DEFAULT_BATTLE_ART
  },
  forest: {
    id: "forest-ambush-v18",
    label: "Forest ambush",
    classes: "backdrop-forest backdrop-v18-art",
    mood: "wild",
    art: "assets/battlebacks/generated/forest-ambush-v18.png"
  },
  ruins: {
    id: "ruined-watchtower-battle-v18",
    label: "Ruined watchtower battle",
    classes: "backdrop-ruins backdrop-v18-art",
    mood: "cold",
    art: "assets/battlebacks/generated/ruined-watchtower-battle-v18.png"
  },
  town: {
    id: "market-outskirts-defense-v18",
    label: "Market outskirts defense",
    classes: "backdrop-town-outskirts backdrop-v18-art",
    mood: "lantern",
    art: "assets/battlebacks/generated/market-outskirts-defense-v18.png"
  },
  camp: {
    id: "forest-camp-ambush-v18",
    label: "Camp ambush",
    classes: "backdrop-forest backdrop-v18-art",
    mood: "campfire",
    art: "assets/battlebacks/generated/forest-camp-ambush-v18.png"
  },
  burned: {
    id: "burning-settlement-raid-v18",
    label: "Burning settlement raid",
    classes: "backdrop-battlefield backdrop-v18-art",
    mood: "ember",
    art: "assets/battlebacks/generated/burning-settlement-raid-v18.png"
  },
  plague: {
    id: "plague-village-outskirts-v18",
    label: "Plague village outskirts",
    classes: "backdrop-hollow backdrop-v18-art",
    mood: "plague",
    art: "assets/battlebacks/generated/plague-village-outskirts-v18.png"
  },
  castle: {
    id: "castle-gate-defense-v18",
    label: "Castle gate defense",
    classes: "backdrop-battlefield backdrop-v18-art",
    mood: "siege",
    art: "assets/battlebacks/generated/castle-gate-defense-v18.png"
  },
  mountain: {
    id: "mountain-pass-fight-v18",
    label: "Mountain pass fight",
    classes: "backdrop-ruins backdrop-v18-art",
    mood: "wind",
    art: "assets/battlebacks/generated/mountain-pass-fight-v18.png"
  },
  forest_road: {
    id: "forest-road-v42",
    label: "Forest Road",
    classes: "backdrop-forest backdrop-environmental backdrop-forest-road",
    mood: "road-fog",
    art: "assets/battlebacks/generated/forest-road-v42.png"
  },
  ruined_camp: {
    id: "ruined-camp-v42",
    label: "Ruined Camp",
    classes: "backdrop-forest backdrop-environmental backdrop-ruined-camp",
    mood: "campfire",
    art: "assets/battlebacks/generated/ruined-camp-v42.png"
  },
  foggy_graveyard: {
    id: "foggy-graveyard-v42",
    label: "Foggy Graveyard",
    classes: "backdrop-ruins backdrop-environmental backdrop-foggy-graveyard",
    mood: "grave-fog",
    art: "assets/battlebacks/generated/foggy-graveyard-v42.png"
  },
  dark_forest: {
    id: "dark-forest-v42",
    label: "Dark Forest",
    classes: "backdrop-forest backdrop-environmental backdrop-dark-forest",
    mood: "deep-woods",
    art: "assets/battlebacks/generated/dark-forest-v42.png"
  },
  broken_ruins: {
    id: "broken-ruins-v42",
    label: "Broken Ruins",
    classes: "backdrop-ruins backdrop-environmental backdrop-broken-ruins",
    mood: "cold",
    art: "assets/battlebacks/generated/broken-ruins-v42.png"
  }
};

const LOCATION_BATTLE_KEY = {
  ashen_keep: "castle",
  ashen_fields: "forest_road",
  old_road: "forest_road",
  market_town: "town",
  forest_edge: "forest",
  ruined_watchtower: "ruins"
};

const ROAD_STOP_BATTLE_KEY = {
  ashen_gate: "forest_road",
  broken_road: "forest_road",
  ruined_waystone: "forest_road",
  burned_shrine: "burned",
  ashen_slope: "mountain",
  watchtower_approach: "ruins",
  old_crossroads: "forest_road",
  abandoned_cart: "forest_road",
  traveler_camp: "ruined_camp",
  market_outskirts: "town",
  forest_trail: "forest",
  ridge_path: "mountain"
};

const REGION_BATTLE_KEY = {
  ashen_fields: "forest_road",
  green_march: "forest",
  frostmere: "ruins",
  storm_coast: "mountain",
  hollow_kingdom: "plague"
};

export function resolveBattleSceneArt({locationId, roadNodeId, regionId, battle, worldState, roadStopState} = {}){
  const text = `${battle?.sceneText || battle?.log?.[0] || ""}`.toLowerCase();
  const stateKey = battleStateKey(roadStopState) || battleStateKey(worldState);
  const textKey = textBattleKey(text);
  const enemyKey = enemyBattleKey(battle);
  const key = stateKey
    || enemyKey
    || textKey
    || ROAD_STOP_BATTLE_KEY[roadNodeId]
    || LOCATION_BATTLE_KEY[locationId]
    || REGION_BATTLE_KEY[regionId]
    || "road";
  return BATTLE_SCENE_ART[key] || BATTLE_SCENE_ART.road;
}

function battleStateKey(value){
  if(!hasWorldArtState(value))return "";
  const state = normalizeWorldArtState(value);
  if(!state)return "";
  if(["burned","plague"].includes(state.stage))return state.stage;
  if(state.type === "camp")return "camp";
  if(state.type === "castle" || state.type === "fort")return "castle";
  if(state.type === "village" || state.type === "town")return "town";
  if(state.type === "ruin" || state.stage === "ruined" || state.stage === "abandoned")return "ruins";
  return "";
}

function textBattleKey(text){
  if(!text)return "";
  if(text.includes("plague") || text.includes("peste"))return "plague";
  if(text.includes("burn") || text.includes("flame") || text.includes("llama") || text.includes("quem"))return "burned";
  if(text.includes("camp") || text.includes("campamento"))return "ruined_camp";
  if(text.includes("castle") || text.includes("fort") || text.includes("keep") || text.includes("bastion"))return "castle";
  if(text.includes("forest") || text.includes("bosque"))return "forest";
  if(text.includes("tower") || text.includes("ruin") || text.includes("torre"))return "ruins";
  if(text.includes("market") || text.includes("town") || text.includes("pueblo") || text.includes("mercado"))return "town";
  if(text.includes("ridge") || text.includes("slope") || text.includes("mountain") || text.includes("cresta") || text.includes("ladera"))return "mountain";
  return "";
}

function enemyBattleKey(battle){
  const text = (battle?.enemies || []).map(enemy=>`${enemy.enemyVisualClass || ""} ${enemy.name || ""} ${enemy.role || ""}`).join(" ").toLowerCase();
  if(!text)return "";
  if(text.includes("corrupted knight") || text.includes("cursed knight") || text.includes("warden"))return "broken_ruins";
  if(text.includes("cultist"))return "broken_ruins";
  if(text.includes("skeleton"))return "foggy_graveyard";
  if(text.includes("wolf") || text.includes("beast"))return "dark_forest";
  if(text.includes("raider"))return "ruined_camp";
  if(text.includes("bandit") || text.includes("thief") || text.includes("cutpurse") || text.includes("robber") || text.includes("outlaw") || text.includes("brigand"))return "forest_road";
  return "";
}
