export const DEFAULT_WORLD_STATE_ART = "assets/worldstates/generated/settlement-ruined-v18.png";

export const WORLD_STATE_ART = {
  camp: {
    initial: "assets/worldstates/generated/camp-basic-v18.png",
    basic: "assets/worldstates/generated/camp-basic-v18.png",
    growing: "assets/worldstates/generated/camp-fortified-v18.png",
    reinforced: "assets/worldstates/generated/camp-fortified-v18.png",
    advanced: "assets/worldstates/generated/camp-fortified-v18.png",
    fortified: "assets/worldstates/generated/camp-fortified-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  village: {
    initial: "assets/worldstates/generated/village-poor-v18.png",
    poor: "assets/worldstates/generated/village-poor-v18.png",
    growing: "assets/worldstates/generated/village-poor-v18.png",
    developed: "assets/worldstates/generated/village-fortified-v18.png",
    advanced: "assets/worldstates/generated/village-fortified-v18.png",
    fortified: "assets/worldstates/generated/village-fortified-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    abandoned: "assets/worldstates/generated/settlement-abandoned-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  town: {
    initial: "assets/worldstates/generated/town-developed-v18.png",
    growing: "assets/worldstates/generated/town-developed-v18.png",
    developed: "assets/worldstates/generated/town-developed-v18.png",
    advanced: "assets/worldstates/generated/town-developed-v18.png",
    fortified: "assets/worldstates/generated/village-fortified-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    abandoned: "assets/worldstates/generated/settlement-abandoned-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  fort: {
    initial: "assets/worldstates/generated/fortress-growing-v18.png",
    growing: "assets/worldstates/generated/fortress-growing-v18.png",
    developed: "assets/worldstates/generated/fortress-growing-v18.png",
    advanced: "assets/worldstates/generated/castle-massive-v18.png",
    fortified: "assets/worldstates/generated/castle-massive-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  castle: {
    initial: "assets/worldstates/generated/fortress-growing-v18.png",
    growing: "assets/worldstates/generated/fortress-growing-v18.png",
    developed: "assets/worldstates/generated/castle-massive-v18.png",
    advanced: "assets/worldstates/generated/castle-massive-v18.png",
    fortified: "assets/worldstates/generated/castle-massive-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  settlement: {
    initial: "assets/worldstates/generated/village-poor-v18.png",
    growing: "assets/worldstates/generated/town-developed-v18.png",
    advanced: "assets/worldstates/generated/village-fortified-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    abandoned: "assets/worldstates/generated/settlement-abandoned-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  ruin: {
    initial: "assets/worldstates/generated/settlement-ruined-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    abandoned: "assets/worldstates/generated/settlement-abandoned-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  }
};

const STATE_ALIASES = {
  camps: "camp",
  encampment: "camp",
  villages: "village",
  towns: "town",
  city: "town",
  cities: "town",
  forts: "fort",
  fortress: "fort",
  castles: "castle",
  ruins: "ruin",
  ruined: "ruin",
  abandoned: "settlement",
  burned: "settlement",
  plague: "settlement",
  rebuilt: "settlement"
};

export function hasWorldArtState(value){
  return !!(value && (value.art || value.type || value.stage || value.state || value.condition || value.builtStructure || value.settlementType));
}

export function normalizeWorldArtState(value = {}){
  if(!hasWorldArtState(value))return null;
  const rawType = value.type || value.settlementType || value.builtStructure || "settlement";
  const normalizedRawType = normalizeToken(rawType);
  const type = normalizeToken(STATE_ALIASES[normalizedRawType] || normalizedRawType || "settlement");
  const impliedStage = ["abandoned","burned","plague","rebuilt","ruined"].includes(normalizedRawType) ? normalizedRawType : "initial";
  const stage = normalizeToken(value.stage || value.state || value.condition || value.level || impliedStage);
  return {
    ...value,
    type: WORLD_STATE_ART[type] ? type : "settlement",
    stage: stage || "initial"
  };
}

export function resolveWorldStateArt(value, fallback = ""){
  if(!hasWorldArtState(value))return fallback;
  if(value.art)return value.art;
  const state = normalizeWorldArtState(value);
  if(!state)return fallback;
  const group = WORLD_STATE_ART[state.type] || WORLD_STATE_ART.settlement;
  return group[state.stage] || group.initial || fallback || DEFAULT_WORLD_STATE_ART;
}

export function worldStateClass(value){
  const state = normalizeWorldArtState(value);
  if(!state)return "";
  return `world-state-${state.type} world-state-${state.stage}`;
}

function normalizeToken(value){
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}
