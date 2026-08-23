import { resolveWorldStateArt, worldStateClass } from "./worldStateArt.js";

export const DEFAULT_LOCATION_ART = "assets/towns/generated/old-road-v18.png";
export const DEFAULT_ROAD_STOP_ART = "assets/ministops/generated/default-road-stop-v18.png";

export const LOCATION_ART = {
  ashen_slums: {
    initial: "assets/towns/generated/ashen-keep-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  ashen_keep: {
    initial: "assets/towns/generated/ashen-keep-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png"
  },
  ashen_fields: {
    initial: "assets/towns/generated/ashen-fields-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  old_road: {
    initial: "assets/towns/generated/old-road-v18.png",
    camp: "assets/worldstates/generated/camp-basic-v18.png",
    fortified: "assets/worldstates/generated/camp-fortified-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  market_town: {
    initial: "assets/towns/generated/market-town-v18.png",
    developed: "assets/worldstates/generated/town-developed-v18.png",
    fortified: "assets/worldstates/generated/village-fortified-v18.png",
    burned: "assets/worldstates/generated/settlement-burned-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  },
  forest_edge: {
    initial: "assets/towns/generated/forest-edge-v18.png",
    camp: "assets/worldstates/generated/camp-basic-v18.png",
    fortified: "assets/worldstates/generated/camp-fortified-v18.png",
    plague: "assets/worldstates/generated/settlement-plague-v18.png"
  },
  ruined_watchtower: {
    initial: "assets/towns/generated/ruined-watchtower-v18.png",
    fort: "assets/worldstates/generated/fortress-growing-v18.png",
    castle: "assets/worldstates/generated/castle-massive-v18.png",
    ruined: "assets/worldstates/generated/settlement-ruined-v18.png",
    rebuilt: "assets/worldstates/generated/settlement-rebuilt-v18.png"
  }
};

export const ROAD_STOP_ART = {
  ashen_gate: {initial: "assets/ministops/generated/ashen-gate-v18.png"},
  broken_road: {initial: "assets/ministops/generated/broken-road-v18.png"},
  ruined_waystone: {initial: "assets/ministops/generated/ruined-waystone-v18.png"},
  burned_shrine: {initial: "assets/ministops/generated/burned-shrine-v18.png"},
  ashen_slope: {initial: "assets/ministops/generated/ashen-slope-v18.png"},
  watchtower_approach: {initial: "assets/ministops/generated/watchtower-approach-v18.png"},
  old_crossroads: {initial: "assets/ministops/generated/old-crossroads-v18.png"},
  abandoned_cart: {initial: "assets/ministops/generated/abandoned-cart-v18.png"},
  traveler_camp: {initial: "assets/ministops/generated/traveler-camp-v18.png"},
  market_outskirts: {initial: "assets/ministops/generated/market-outskirts-v18.png"},
  forest_trail: {initial: "assets/ministops/generated/forest-trail-v18.png"},
  ridge_path: {initial: "assets/ministops/generated/ridge-path-v18.png"}
};

export function resolveLocationArt(location, stateValue){
  const id = typeof location === "string" ? location : location?.id;
  const entry = LOCATION_ART[id] || {};
  const stateArt = resolveWorldStateArt(stateValue, "");
  if(stateArt)return stateArt;
  return entry.initial || DEFAULT_LOCATION_ART;
}

export function resolveRoadStopArt(node, stateValue){
  const id = typeof node === "string" ? node : node?.id;
  const entry = ROAD_STOP_ART[id] || {};
  const stateArt = resolveWorldStateArt(stateValue, "");
  if(stateArt)return stateArt;
  return entry.initial || DEFAULT_ROAD_STOP_ART;
}

export function locationArtClass(stateValue){
  return worldStateClass(stateValue);
}

export function roadStopArtClass(stateValue){
  return worldStateClass(stateValue);
}
