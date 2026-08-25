import { REGIONS, advanceDays, companionTrainingNeed, ensureLowerWardState, grantCompanionBond, normalizeCompanion, rnd, save, setScreen, state } from "./state.js";
import { getLanguage, regionText, tx } from "./language.js";
import { makeElite, makeEnemy, startBattle } from "./combat.js";
import { stampEnemyVisualClass } from "./enemyVisuals.js";
import { byId, esc, toast, updateTop } from "./ui.js";
import { renderLocationStageHTML, renderOverworldHTML, renderRoadStopSceneStageHTML } from "./overworld.js";
import { routeAngle, routePoint } from "./routePaths.js";
import { getMapNodes } from "./roadNodes.js";
import { resolveRoadStopArt, roadStopArtClass } from "./locationArt.js";
import { availableRoadStopSceneActions, resolveRoadStopScene, resolveWorldScene, worldSceneAction } from "./worldScenes.js";
import { routeLegs, routeStopDanger, travelRouteStops } from "./travelGraph.js";
import { forceNextTravelEncounter, rollTravelEncounter } from "./encounterTables.js";
import { playEncounterTransition } from "./encounterTransition.js";
import { playAudioHook } from "./audioHooks.js";
import { preloadPlayerPoseAsset } from "./portraitRenderer.js";
import { TRAVERSAL_TUNING, cinematicEase, createMapTraversalPresence, createWorldSceneTraversal, traversalPhaseSchedule, withTraversalPhase } from "./traversalController.js";
import { renderSlumProloguePanel } from "./slumPrologue.js";
import { renderLowerWardPanel } from "./lowerWard.js";
import { startActualGame } from "./tutorials.js";

export const START_LOCATION = "ashen_slums";

export const WORLD_LOCATIONS = {
  ashen_slums: {
    id: "ashen_slums",
    region: 0,
    danger: 1,
    scene: "town-outskirts",
    sceneX: "0%",
    sceneY: "66.667%",
    x: 15.5,
    y: 83.5,
    services: ["market", "blacksmith", "inn", "tavern"],
    serviceSpots: {
      market: {x: 34, y: 64},
      blacksmith: {x: 22, y: 70},
      inn: {x: 58, y: 68},
      tavern: {x: 72, y: 58}
    },
    routes: ["lower_ward", "ashen_keep", "market_town"],
    enemies: ["Dock Rat", "Corner Knife", "Desperate Thief"],
    eliteEnemies: ["Dock Rat Enforcer"],
    name: {en: "Cinderhook Slum", es: "Barrio Bajo de Cinderhook"},
    desc: {
      en: "A slum shelf under Ashen Keep where patched roofs, gang marks, and gate debt decide who climbs.",
      es: "Un barrio bajo bajo Bastion de Ceniza donde techos remendados, marcas de bandas y deudas de puerta deciden quien sube."
    },
    lore: {
      en: "The castle is visible from every puddle here. That is the cruelty of the place.",
      es: "El castillo se ve en cada charco. Esa es la crueldad del lugar."
    }
  },
  lower_ward: {
    id: "lower_ward",
    region: 0,
    danger: 3,
    scene: "town-outskirts",
    sceneX: "0%",
    sceneY: "66.667%",
    x: 19.2,
    y: 72.2,
    services: ["market", "blacksmith", "inn", "tavern"],
    serviceSpots: {
      market: {x: 36, y: 64},
      blacksmith: {x: 23, y: 66},
      inn: {x: 61, y: 69},
      tavern: {x: 72, y: 55}
    },
    routes: ["ashen_slums", "ashen_keep", "market_town"],
    enemies: ["Ward Bailiff", "Tax Knife", "Ledger Guard"],
    eliteEnemies: ["Iron Writ Captain", "Bell Tower Duelist"],
    name: {en: "Lower Ward", es: "Barrio Inferior"},
    desc: {
      en: "The first rung above Cinderhook. Here, trainers sell names, clerks sell permission, and every gate has a price.",
      es: "El primer peldano sobre Cinderhook. Aqui los entrenadores venden nombres, los escribas venden permiso y cada puerta tiene precio."
    },
    lore: {
      en: "The lamps are cleaner than the slum, but the knives are better paid.",
      es: "Las lamparas son mas limpias que en el barrio bajo, pero los cuchillos estan mejor pagados."
    }
  },
  ashen_keep: {
    id: "ashen_keep",
    region: 0,
    danger: 0,
    scene: "town-outskirts",
    sceneX: "0%",
    sceneY: "66.667%",
    x: 22.5,
    y: 77.2,
    services: ["inn", "tavern", "blacksmith"],
    serviceSpots: {
      blacksmith: {x: 28, y: 64},
      inn: {x: 53, y: 70},
      tavern: {x: 69, y: 58}
    },
    routes: ["ashen_fields", "old_road", "market_town"],
    name: {en: "Ashen Keep", es: "Bastion de Ceniza"},
    desc: {
      en: "Your first refuge after Ser Kael's fall. Smoke still stains the stone, but the roads now open from its broken gate.",
      es: "Tu primer refugio tras la caida de Ser Kael. El humo aun mancha la piedra, pero los caminos se abren desde su puerta rota."
    },
    lore: {
      en: "Ashen Keep holds the wounded, the desperate, and the first map of roads worth surviving.",
      es: "El Bastion guarda heridos, desesperados y el primer mapa de caminos que vale la pena sobrevivir."
    }
  },
  ashen_fields: {
    id: "ashen_fields",
    region: 0,
    danger: 2,
    scene: "ashen-fields",
    sceneX: "0%",
    sceneY: "0%",
    x: 30,
    y: 37.5,
    services: ["mine"],
    serviceSpots: {
      mine: {x: 70, y: 62}
    },
    routes: ["ashen_keep", "old_road", "ruined_watchtower"],
    enemies: ["Skeleton", "Cultist", "Bandit"],
    eliteEnemies: ["Ash Warden", "Cursed Knight"],
    name: {en: "Ashen Fields", es: "Campos de Ceniza"},
    desc: {
      en: "Burned farms and cinder ditches stretch beyond the Keep. Ore can be scavenged, but the dead do not stay quiet.",
      es: "Granjas quemadas y zanjas de ceniza rodean el Bastion. Se puede reunir mineral, pero los muertos no callan."
    },
    lore: {
      en: "Black grass snaps underfoot. Something moves whenever the wind lifts the ash.",
      es: "La hierba negra cruje bajo tus pies. Algo se mueve cada vez que el viento levanta ceniza."
    }
  },
  old_road: {
    id: "old_road",
    region: 0,
    danger: 2,
    scene: "road",
    sceneX: "100%",
    sceneY: "33.333%",
    x: 52.2,
    y: 54.8,
    services: [],
    routes: ["ashen_keep", "ashen_fields", "forest_edge", "market_town"],
    enemies: ["Bandit", "Wolf", "Cultist"],
    eliteEnemies: ["Elite Raider", "Ash Warden"],
    name: {en: "Old Road", es: "Camino Viejo"},
    desc: {
      en: "A rutted trade road cuts through dead trees and abandoned wagons. It connects safety to everything worse.",
      es: "Un camino comercial lleno de surcos cruza arboles muertos y carretas abandonadas. Une la seguridad con todo lo peor."
    },
    lore: {
      en: "A cracked milestone still points toward towns that no longer answer riders.",
      es: "Un poste agrietado aun senala pueblos que ya no responden a los jinetes."
    }
  },
  forest_edge: {
    id: "forest_edge",
    region: 1,
    danger: 3,
    scene: "forest",
    sceneX: "100%",
    sceneY: "0%",
    x: 75.6,
    y: 31,
    services: [],
    routes: ["old_road", "ruined_watchtower"],
    enemies: ["Wolf", "Bandit", "Cultist"],
    eliteEnemies: ["Elite Raider", "Cursed Knight"],
    name: {en: "Forest Edge", es: "Linde del Bosque"},
    desc: {
      en: "Ancient trees lean over the road, swallowing sound and torchlight. Tracks vanish under wet leaves.",
      es: "Arboles antiguos se inclinan sobre el camino, tragando sonido y antorchas. Las huellas desaparecen bajo hojas mojadas."
    },
    lore: {
      en: "The forest listens. Even the wolves pause before crossing its roots.",
      es: "El bosque escucha. Incluso los lobos dudan antes de cruzar sus raices."
    }
  },
  ruined_watchtower: {
    id: "ruined_watchtower",
    region: 0,
    danger: 4,
    scene: "ruins",
    sceneX: "0%",
    sceneY: "33.333%",
    x: 54,
    y: 15.5,
    services: [],
    routes: ["ashen_fields", "forest_edge"],
    enemies: ["Skeleton", "Cultist", "Bandit"],
    eliteEnemies: ["Cursed Knight", "Ash Warden"],
    name: {en: "Ruined Watchtower", es: "Torre Vigia en Ruinas"},
    desc: {
      en: "Broken arches and old signal stones overlook the fields. The tower sees every road, and something sees from it.",
      es: "Arcos rotos y viejas piedras de senal vigilan los campos. La torre ve todos los caminos, y algo mira desde ella."
    },
    lore: {
      en: "A rusted bell hangs split in half, as if the last alarm never finished ringing.",
      es: "Una campana oxidada cuelga partida, como si la ultima alarma nunca hubiera terminado."
    }
  },
  market_town: {
    id: "market_town",
    region: 0,
    danger: 1,
    scene: "town-outskirts",
    sceneX: "0%",
    sceneY: "66.667%",
    x: 82.8,
    y: 77.4,
    services: ["market", "blacksmith", "inn", "tavern"],
    serviceSpots: {
      market: {x: 47, y: 64},
      blacksmith: {x: 69, y: 58},
      inn: {x: 32, y: 69},
      tavern: {x: 58, y: 48}
    },
    routes: ["ashen_keep", "old_road"],
    enemies: ["Bandit", "Wolf"],
    eliteEnemies: ["Elite Raider"],
    name: {en: "First Market Town", es: "Primer Pueblo Mercado"},
    desc: {
      en: "A palisade market survives under lantern smoke. Traders, smiths, and recruits gather where the road still has guards.",
      es: "Un mercado con empalizada sobrevive bajo humo de faroles. Comerciantes, herreros y reclutas se reunen donde aun hay guardias."
    },
    lore: {
      en: "Coin still matters here, which makes the town feel almost impossible.",
      es: "Aqui la moneda aun importa, y eso hace que el pueblo parezca casi imposible."
    }
  }
};

(function makeRoutesTwoWay(){
  Object.values(WORLD_LOCATIONS).forEach(loc=>{
    (loc.routes || []).forEach(otherId=>{
      const other = WORLD_LOCATIONS[otherId];
      if(other && !other.routes.includes(loc.id)) other.routes.push(loc.id);
    });
  });
})();

export const HARD_AREAS = {
  cinderhook_rat_depths: {
    id: "cinderhook_rat_depths",
    locations: ["ashen_slums"],
    danger: 3,
    recommendedLevel: 1,
    enemyCount: 2,
    levelBonus: 1,
    levelSpread: 1,
    hpScale: 1.1,
    attackScale: 1.08,
    defenseScale: 1,
    rewardScale: 1.25,
    enemies: ["Dock Rat Bruiser", "Corner Knife Cutpurse", "Debt Collector"],
    boss: "Dock Rat Pit Boss",
    name: {en: "Cinderhook Rat Depths", es: "Profundidades Rata de Cinderhook"},
    desc: {
      en: "A cramped drain route under the slum where gang collectors send desperate fighters to disappear.",
      es: "Una ruta de drenaje bajo el barrio donde los cobradores mandan luchadores desesperados a desaparecer."
    }
  },
  lower_ward_tax_vault: {
    id: "lower_ward_tax_vault",
    locations: ["lower_ward"],
    danger: 5,
    recommendedLevel: 3,
    enemyCount: 3,
    levelBonus: 1,
    levelSpread: 1,
    hpScale: 1.12,
    attackScale: 1.08,
    defenseScale: 1.05,
    rewardScale: 1.45,
    enemies: ["Tax Knife", "Ledger Guard", "Bribe Runner"],
    boss: "Iron Writ Captain",
    lowerWardReward:{influence:3,writs:1,bond:10,training:12},
    name: {en: "Tax Vault Break-In", es: "Asalto a la Boveda de Impuestos"},
    desc: {
      en: "A guarded counting room where the ward's clerks turn hunger into stamped debt.",
      es: "Una sala de conteo vigilada donde los escribas del barrio convierten hambre en deuda sellada."
    }
  },
  bell_tower_gallows: {
    id: "bell_tower_gallows",
    locations: ["lower_ward"],
    danger: 8,
    recommendedLevel: 5,
    enemyCount: 4,
    levelBonus: 3,
    levelSpread: 2,
    hpScale: 1.26,
    attackScale: 1.18,
    defenseScale: 1.12,
    rewardScale: 1.75,
    enemies: ["Bell Rope Cutthroat", "Ward Bailiff", "Gallows Duelist"],
    boss: "Bell Tower Hangman",
    lowerWardReward:{influence:4,writs:2,bond:16,training:20},
    name: {en: "Bell Tower Gallows", es: "Horca de la Torre Campana"},
    desc: {
      en: "A high stair where bailiffs hang debtors and duelists test anyone climbing toward noble streets.",
      es: "Una escalera alta donde alguaciles cuelgan deudores y duelistas prueban a cualquiera que sube hacia calles nobles."
    }
  },
  candle_court_cellars: {
    id: "candle_court_cellars",
    locations: ["lower_ward"],
    danger: 10,
    recommendedLevel: 8,
    enemyCount: 4,
    levelBonus: 4,
    levelSpread: 3,
    hpScale: 1.32,
    attackScale: 1.23,
    defenseScale: 1.17,
    rewardScale: 1.95,
    enemies: ["Court Mask", "Lantern Bravo", "Hidden Ledger Guard"],
    boss: "Candle Court Factor",
    lowerWardReward:{influence:6,writs:3,bond:22,training:26},
    name: {en: "Candle Court Cellars", es: "Sotanos de la Corte de Velas"},
    desc: {
      en: "A noble service cellar where polished masks buy rough violence before it reaches the ballroom.",
      es: "Un sotano de servicio noble donde mascaras pulidas compran violencia antes de que llegue al salon."
    }
  },
  ash_crypt: {
    id: "ash_crypt",
    locations: ["ashen_keep", "ashen_fields"],
    danger: 5,
    recommendedLevel: 3,
    enemyCount: 3,
    levelBonus: 2,
    levelSpread: 2,
    hpScale: 1.18,
    attackScale: 1.12,
    defenseScale: 1.08,
    rewardScale: 1.5,
    enemies: ["Road Skeleton", "Crypt Cultist", "Ashen Boneguard"],
    boss: "Cursed Knight Gravewarden",
    name: {en: "Ash Crypt", es: "Cripta de Ceniza"},
    desc: {
      en: "A sealed burial stair below the burned fields. The dead here fight as a squad, not as strays.",
      es: "Una escalera funeraria sellada bajo los campos quemados. Los muertos aqui pelean como escuadra, no como rezagados."
    }
  },
  blackroot_den: {
    id: "blackroot_den",
    locations: ["old_road", "forest_edge"],
    danger: 6,
    recommendedLevel: 5,
    enemyCount: 3,
    levelBonus: 3,
    levelSpread: 2,
    hpScale: 1.22,
    attackScale: 1.16,
    defenseScale: 1.08,
    rewardScale: 1.65,
    enemies: ["Blackroot Wolf", "Cultist Tracker", "Road Raider"],
    boss: "Blackroot Alpha Wolf",
    name: {en: "Blackroot Den", es: "Guarida de Raiz Negra"},
    desc: {
      en: "A wet hollow of roots and old snares where hunters become the hunted fast.",
      es: "Un hueco humedo de raices y trampas viejas donde los cazadores se vuelven presa rapido."
    }
  },
  watchtower_summit: {
    id: "watchtower_summit",
    locations: ["ruined_watchtower"],
    danger: 7,
    recommendedLevel: 7,
    enemyCount: 4,
    levelBonus: 4,
    levelSpread: 3,
    hpScale: 1.28,
    attackScale: 1.2,
    defenseScale: 1.14,
    rewardScale: 1.85,
    enemies: ["Cursed Knight", "Ash Warden", "Skeleton Banner Guard"],
    boss: "Ash Warden Tower Captain",
    name: {en: "Watchtower Summit", es: "Cima de la Torre Vigia"},
    desc: {
      en: "The highest broken floor of the tower. Signal stones flare when challengers climb too far.",
      es: "El piso roto mas alto de la torre. Las piedras de senal arden cuando los retadores suben demasiado."
    }
  },
  hollow_breach: {
    id: "hollow_breach",
    locations: ["market_town", "forest_edge"],
    danger: 8,
    recommendedLevel: 10,
    enemyCount: 4,
    levelBonus: 5,
    levelSpread: 3,
    hpScale: 1.35,
    attackScale: 1.24,
    defenseScale: 1.18,
    rewardScale: 2,
    enemies: ["Hollow Cultist", "Cursed Knight", "Ash Warden"],
    boss: "Hollow Kingdom Hunter",
    name: {en: "Hollow Breach", es: "Brecha Hueca"},
    desc: {
      en: "A wrong turn beyond guarded roads where the next kingdom's curse bleeds into the map early.",
      es: "Un desvio equivocado mas alla de los caminos vigilados donde la maldicion del siguiente reino sangra en el mapa."
    }
  }
};

const LOCATION_ORDER = ["lower_ward", "ashen_keep", "ashen_fields", "old_road", "forest_edge", "ruined_watchtower", "market_town"];
const SERVICE_ORDER = ["market", "blacksmith", "inn", "tavern", "mine"];
const TRAVEL_LEG_DURATION_MS = 1450;
const WORLD_SCENE_TRAVERSAL_PRELOAD_STATES = [
  "idle",
  "walk-left","walk-left-a","walk-left-b","walk-left-c","walk-left-d",
  "walk-right","walk-right-a","walk-right-b","walk-right-c","walk-right-d",
  "walk-forward","walk-forward-a","walk-forward-b","walk-forward-c","walk-forward-d",
  "walk-away","walk-away-a","walk-away-b","walk-away-c","walk-away-d",
  "walk-up","walk-up-a","walk-up-b","walk-up-c","walk-up-d",
  "walk-down","walk-down-a","walk-down-b","walk-down-c","walk-down-d",
  "arriving","entering-location","exiting-location"
];

let activeTravel = null;
let selectedMapLocationId = null;
let mapPointerMoved = false;
const mapCamera = { scale: 1.78, x: 18, y: 78, userPanned: false };
let travelTimer = null;
let activeWorldSceneTraversal = null;
let worldSceneTraversalTimers = [];

function clearTravelLoop(){
  if(travelTimer == null)return;
  cancelAnimationFrame(travelTimer);
  clearInterval(travelTimer);
  travelTimer = null;
}

function clearWorldSceneTraversal(){
  worldSceneTraversalTimers.forEach(timer=>clearTimeout(timer));
  worldSceneTraversalTimers = [];
  activeWorldSceneTraversal = null;
}

function preloadWorldSceneTraversalAssets(){
  WORLD_SCENE_TRAVERSAL_PRELOAD_STATES.forEach(visualState=>preloadPlayerPoseAsset(state.hero, visualState));
}

function travelDebug(message, detail = {}){
  if(typeof location === "undefined")return;
  if(!new URLSearchParams(location.search).has("debug"))return;
  console.log(`[travel] ${message}`, detail);
}

function travelSnapshot(travel = activeTravel){
  if(!travel)return null;
  return {
    originLocationId: travel.originLocationId,
    destinationLocationId: travel.destinationLocationId,
    routeNodeIds: [...(travel.routeNodeIds || [])],
    currentIndex: travel.currentIndex,
    currentRoadNodeId: travel.currentRoadNodeId,
    previousRoadNodeId: travel.previousRoadNodeId,
    nextRoadNodeId: travel.nextRoadNodeId,
    status: travel.status,
    encounterPoint: travel.encounterPoint ? {...travel.encounterPoint} : null,
    resumeAfterBattle: travel.resumeAfterBattle,
    direction: travel.direction || 1,
    progress: travel.progress,
    legProgress: travel.legProgress,
    rawLegProgress: travel.rawLegProgress || 0
  };
}

function logTravelProgress(travel){
  const bucket = Math.floor(travel.progress * 20);
  if(bucket === travel.debugProgressBucket)return;
  travel.debugProgressBucket = bucket;
  travelDebug("progress update", {
    progress: Number(travel.progress.toFixed(3)),
    percent: Math.floor(travel.progress * 100),
    currentIndex: travel.currentIndex,
    stop: travel.currentRoadNodeId
  });
}

function clamp(value,min,max){
  return Math.max(min, Math.min(max, value));
}

export function ensureWorld(){
  if(!state?.world)return null;
  if(!WORLD_LOCATIONS[state.world.locationId])state.world.locationId = START_LOCATION;
  if(state.world.previousLocationId && !WORLD_LOCATIONS[state.world.previousLocationId])state.world.previousLocationId = null;
  state.world.routeHistory ||= [];
  const loc = currentLocation();
  state.world.region = loc.region;
  return loc;
}

export function currentLocation(){
  return WORLD_LOCATIONS[state?.world?.locationId] || WORLD_LOCATIONS[START_LOCATION];
}

export function locationById(id){
  return WORLD_LOCATIONS[id] || null;
}

export function locationText(location, field){
  const loc = typeof location === "string" ? locationById(location) : location;
  const value = loc?.[field];
  if(!value)return "";
  if(typeof value === "string")return value;
  return value[getLanguage()] || value.en || "";
}

export function locationName(id = state?.world?.locationId){
  return locationText(id || START_LOCATION, "name");
}

export function locationServices(id = state?.world?.locationId){
  const loc = locationById(id) || currentLocation();
  return SERVICE_ORDER.filter(service => loc.services.includes(service));
}

export function locationSupportsService(service, id = state?.world?.locationId){
  return locationServices(id).includes(service);
}

export function getCurrentPlaceContext(){
  const major = ensureWorld();
  if(activeTravel){
    const allNodes = getMapNodes(WORLD_LOCATIONS);
    const currentNode = allNodes[activeTravel.currentRoadNodeId] || allNodes[activeTravel.originLocationId] || major;
    const nextNode = allNodes[activeTravel.nextRoadNodeId];
    const destination = locationById(activeTravel.destinationLocationId);
    const total = Math.max(1, activeTravel.routeNodeIds.length - 1);
    const moving = activeTravel.status === "moving";
    const name = moving && nextNode
      ? `${nodeName(currentNode)} -> ${nodeName(nextNode)}`
      : nodeName(currentNode);
    return {
      type: "roadStop",
      id: currentNode.id,
      name,
      description: moving ? tx("travelingBetweenRoadStops") : activeTravel.stopMessage || roadStopDescription(currentNode.id),
      danger: routeStopDanger(currentNode.id, allNodes),
      services: [],
      isTraveling: true,
      journeyDestination: destination ? {id: destination.id, name: locationText(destination,"name")} : null,
      journeyProgress: {current: Math.min(total, Math.max(0, activeTravel.currentIndex)), total},
      canUseTownServices: false,
      canContinueJourney: activeTravel.status === "atRoadStop" && !!activeTravel.nextRoadNodeId,
      canTurnBack: activeTravel.status === "atRoadStop" && activeTravel.currentIndex > 0,
      canInspectArea: activeTravel.status === "atRoadStop",
      status: activeTravel.status,
      roadNode: currentNode,
      nextRoadNodeId: activeTravel.nextRoadNodeId,
      build: roadStopBuildContext(currentNode)
    };
  }
  return {
    type: "majorLocation",
    id: major.id,
    name: locationText(major,"name"),
    description: locationText(major,"lore"),
    danger: major.danger,
    services: locationServices(major.id),
    isTraveling: false,
    journeyDestination: null,
    journeyProgress: null,
    canUseTownServices: true,
    canContinueJourney: false,
    canTurnBack: false,
    canInspectArea: false,
    location: major
  };
}

export function renderWorldHome(){
  const place = getCurrentPlaceContext();
  if(place.type === "roadStop"){
    const roadStopScene = resolveRoadStopScene(place.roadNode);
    if(roadStopScene)preloadWorldSceneTraversalAssets();
    document.body.classList.toggle("cinematic-world-home-active", !!roadStopScene);
    renderRoadStopHome(place);
    return;
  }
  const loc = place.location;
  const services = place.services;
  const cinematicScene = resolveWorldScene(loc);
  const showLocationHead = !cinematicScene && loc.id !== START_LOCATION;
  if(cinematicScene)preloadWorldSceneTraversalAssets();
  document.body.classList.toggle("cinematic-world-home-active", !!cinematicScene);
  byId("home").innerHTML = `
    <div class="panel location-panel home-location-panel ${cinematicScene ? "cinematic-home-panel" : ""}">
      ${showLocationHead ? `<div class="location-home-head">
        <div>
          <h1>${tx("currentLocation")}: ${esc(locationText(loc,"name"))}</h1>
          <p>${esc(locationText(loc,"lore"))}</p>
        </div>
        <button class="primary" onclick="FE.show('map')">${tx("openMap")}</button>
      </div>` : ""}
      ${loc.id === START_LOCATION ? renderSlumProloguePanel() : ""}
      ${loc.id === "lower_ward" ? renderLowerWardPanel() : ""}
      ${renderLocationStageHTML({location:loc,services,worldState:state.world.locationStates?.[loc.id],hero:state.hero,traversal:activeWorldSceneTraversal,story:state.world.story})}
      ${cinematicScene ? "" : `<div class="location-info-grid">
        <div class="card">
          <h3>${tx("danger")}</h3>
          <span class="pill ${loc.danger ? "warn" : "good"}">${tx("danger")} ${loc.danger}</span>
        </div>
        <div class="card">
          <h3>${tx("services")}</h3>
          <p>${services.length ? services.map(service=>tx(service)).join(" | ") : tx("noServicesHere")}</p>
        </div>
      </div>`}
    </div>
    ${hardAreasPanelHTML(loc)}
    ${cinematicScene ? "" : `<div class="panel">
      <h2>${tx("story")}</h2>
      <div class="event-feed">${state.world.story.slice(-8).map(e=>`<div class="entry">${esc(e)}</div>`).join("")}</div>
    </div>`}
    ${debugHTML()}
  `;
}

function hardAreasForLocation(loc){
  return Object.values(HARD_AREAS).filter(area=>area.locations.includes(loc.id));
}

function hardAreaText(area, field){
  const value = area?.[field];
  if(!value)return "";
  if(typeof value === "string")return value;
  return value[getLanguage()] || value.en || "";
}

function hardAreasPanelHTML(loc){
  const areas = hardAreasForLocation(loc);
  if(!areas.length)return "";
  return `
    <div class="panel hard-area-panel">
      <div class="hard-area-head">
        <div>
          <span class="pill warn">${tx("highRisk")}</span>
          <h2>${tx("hardAreas")}</h2>
          <p>${tx("hardAreasHelp")}</p>
        </div>
      </div>
      <div class="hard-area-grid">
        ${areas.map(hardAreaCardHTML).join("")}
      </div>
    </div>
  `;
}

function hardAreaCardHTML(area){
  const clears = Number(state.world.hardAreas?.clears?.[area.id] || 0);
  const attempts = Number(state.world.hardAreas?.attempts?.[area.id] || 0);
  const underLevel = (state.hero.level || 1) < area.recommendedLevel;
  return `
    <div class="card hard-area-card ${underLevel ? "under-level" : ""}">
      <h3>${esc(hardAreaText(area,"name"))}</h3>
      <p>${esc(hardAreaText(area,"desc"))}</p>
      <div class="hard-area-meta">
        <span class="pill red">${tx("danger")} ${area.danger}</span>
        <span class="pill ${underLevel ? "warn" : "good"}">${tx("recommendedLevel")} ${area.recommendedLevel}</span>
        <span class="pill">${tx("enemyCount")} ${area.enemyCount}</span>
        <span class="pill">${tx("cleared")} ${clears}</span>
        ${attempts ? `<span class="pill">${tx("attempts")} ${attempts}</span>` : ""}
      </div>
      <button class="danger" onclick="FE.startHardArea('${esc(area.id)}')">${tx("enterHardArea")}</button>
    </div>
  `;
}

function lowerWardUnlocked(){
  return !!state?.prologue?.lowerWardGate?.unlocked;
}

function chapterOneRoadsLocked(){
  if(lowerWardUnlocked())return false;
  const here = state.world?.locationId || START_LOCATION;
  return here === "ashen_slums";
}

function routeLockReason(loc){
  if(!loc)return "";
  if(loc.id === "lower_ward" && !lowerWardUnlocked())return tx("lockLowerWardGate");
  if(chapterOneRoadsLocked() && loc.id !== "ashen_slums" && loc.id !== "lower_ward")return tx("lockUntilGate");
  return "";
}

function renderRoadStopHome(place){
  travelDebug("road stop home rendered", {continueState:journeyContinueState(), contextStatus:place.status, nextRoadNodeId:place.nextRoadNodeId});
  const cinematicScene = resolveRoadStopScene(place.roadNode);
  byId("home").innerHTML = `
    <div class="panel location-panel road-stop-home-panel">
      ${cinematicScene ? "" : `<div class="location-home-head">
        <div>
          <h1>${tx("currentRoadStop")}: ${esc(place.name)}</h1>
          <p>${esc(place.description)}</p>
        </div>
        <button class="primary" onclick="FE.show('map')">${tx("openMap")}</button>
      </div>`}
      ${renderRoadStopStageHTML(place)}
      ${cinematicScene ? `<div class="road-stop-toolbar">
        <button class="secondary" ${place.canTurnBack ? `onclick="FE.turnBackJourney()"` : `disabled title="${esc(tx("turnBackDisabled"))}"`}>${tx("turnBack")}</button>
        <button class="secondary" ${place.build.hasCamp ? "disabled" : place.build.canBuild ? `onclick="FE.establishCamp()"` : `disabled title="${esc(place.build.disabledReason)}"`}>${place.build.hasCamp ? (place.build.fortified ? tx("campFortified") : tx("campEstablished")) : tx("establishCamp")}</button>
        ${place.build.hasCamp && !place.build.fortified ? `<button class="secondary" ${place.build.canFortify ? `onclick="FE.fortifyCamp()"` : `disabled title="${esc(place.build.fortifyDisabledReason)}"`}>${tx("fortifyCamp")}</button>` : ""}
        ${place.build.hasCamp ? `<button class="secondary" onclick="FE.restAtCamp()">${tx("restAtCamp")}</button>` : ""}
        <button class="secondary" onclick="FE.cancelTravel()">${tx("cancelTravel")}</button>
      </div>` : `<div class="actions">
        <div class="grid3">
          <button class="primary" ${place.canContinueJourney ? `onclick="FE.continueJourney()"` : "disabled"}>${tx("continueJourney")}</button>
          <button ${place.canInspectArea ? `onclick="FE.inspectRoadStop()"` : "disabled"}>${tx("inspectArea")}</button>
          <button onclick="FE.show('map')">${tx("openMap")}</button>
          <button class="secondary" onclick="FE.cancelTravel()">${tx("cancelTravel")}</button>
          <button class="secondary" ${place.canTurnBack ? `onclick="FE.turnBackJourney()"` : `disabled title="${esc(tx("turnBackDisabled"))}"`}>${tx("turnBack")}</button>
          <button class="secondary" ${place.build.hasCamp ? "disabled" : place.build.canBuild ? `onclick="FE.establishCamp()"` : `disabled title="${esc(place.build.disabledReason)}"`}>${place.build.hasCamp ? tx("campEstablished") : tx("establishCamp")}</button>
          ${place.build.hasCamp ? `<button class="secondary" onclick="FE.restAtCamp()">${tx("restAtCamp")}</button>` : ""}
        </div>
      </div>`}
    ${debugHTML()}
  `;
}

function renderRoadStopStageHTML(place){
  const sceneId = String(place.id || "road").replace(/[^a-z0-9_-]/gi,"");
  const art = roadStopArtPath(place.roadNode);
  const sceneClass = place.roadNode?.sceneClass || "road-stop-art-road";
  const stateClass = roadStopArtClass(state.world.roadStopStates?.[place.roadNode?.id]);
  const roadScene = resolveRoadStopScene(place.roadNode);
  if(roadScene){
    return renderRoadStopSceneStageHTML({
      place,
      hero: state.hero,
      traversal: activeWorldSceneTraversal,
      worldScene: roadScene,
      art,
      stateClass,
      actions: availableRoadStopSceneActions(roadScene, place)
    });
  }
  return `
    <div class="road-stop-stage has-road-stop-art road-stop-scene-${sceneId} ${esc(sceneClass)} ${esc(stateClass)}" style="--road-stop-art:url('${esc(art)}')">
      <span class="road-stop-depth"></span>
      <span class="road-stop-landmark"></span>
      <span class="road-stop-weather"></span>
      <span class="road-stop-fog"></span>
      <span class="road-stop-vignette"></span>
      <div class="road-stop-stage-copy">
        <div class="location-badge">${tx("currentRoadStop")}</div>
        <h2>${esc(place.name)}</h2>
        <p>${esc(place.description)}</p>
      </div>
    </div>
  `;
}

function roadStopArtPath(node){
  return resolveRoadStopArt(node, state.world.roadStopStates?.[node?.id]);
}

function debugHTML(){
  if(!new URLSearchParams(location.search).has("debug"))return "";
  return `
    <div class="panel">
      <h2>Debug</h2>
      <div class="grid3">
        <button onclick="FE.debugGrantLevel()">Level Up Now</button>
        <button onclick="FE.debugLevelTo(5)">Debug Level 5</button>
        <button onclick="FE.debugLevelTo(10)">Debug Level 10</button>
        <button onclick="FE.debugLevelTo(15)">Debug Level 15</button>
        <button onclick="FE.debugLevelTo(20)">Debug Level 20</button>
        <button onclick="FE.debugGrantCMXp(9000)">Debug CM XP +9000</button>
        <button onclick="FE.debugSetHeroHp(1)">Debug HP 1</button>
        <button onclick="FE.debugEquipVisualTestSet()">Debug Visual Gear</button>
        <button onclick="FE.forceTravelEncounter('battle')">Force Travel Encounter</button>
        <button onclick="FE.debugBattleTransition()">Debug Battle Transition</button>
      </div>
      <h3>Enemy Visual Tester</h3>
      <div class="grid3">
        <select id="debugEnemyVisualSelect" aria-label="Debug enemy visual">
          <option value="skeleton">Skeleton</option>
          <option value="wolf">Wolf</option>
          <option value="bandit">Bandit</option>
          <option value="cultist">Cultist</option>
          <option value="corrupted_knight">Corrupted Knight</option>
        </select>
        <button onclick="FE.debugStartEnemyVisualTest(document.getElementById('debugEnemyVisualSelect').value)">Start Enemy Test</button>
        <button onclick="FE.debugResetEnemyVisualTest()">Reset Enemy Test</button>
        <button onclick="FE.debugForceEnemyVisualPose('idle')">Force Idle</button>
        <button onclick="FE.debugForceEnemyVisualPose('attack')">Force Attack</button>
        <button onclick="FE.debugForceEnemyVisualPose('hurt')">Force Hurt</button>
        <button onclick="FE.debugForceEnemyVisualPose('defeated')">Force Defeated</button>
      </div>
    </div>
  `;
}

function renderCinematicLocationMeta(loc, services, routes){
  return `
    <div class="cinematic-location-meta">
      <span class="pill ${loc.danger ? "warn" : "good"}">${tx("danger")} ${loc.danger}</span>
      <span class="pill">${tx("services")}: ${services.length ? services.map(service=>tx(service)).join(" | ") : tx("noServicesHere")}</span>
      <span class="pill">${tx("routes")}: ${esc(routes || tx("routeLocked"))}</span>
    </div>
  `;
}

export function debugTraversalTuning(){
  return TRAVERSAL_TUNING;
}

export function startWorldSceneTraversal(actionId){
  const loc = ensureWorld();
  const scene = resolveWorldScene(loc);
  const action = worldSceneAction(scene, actionId);
  if(!scene || !action){
    document.body.classList.remove("cinematic-world-home-active");
    if(actionId === "townCenter")return window.FE?.openTownCenter?.();
    if(locationSupportsService(actionId))return window.FE?.openTownService?.(actionId);
    return toast(tx("serviceUnavailable"));
  }
  if(action.kind === "service" && !locationSupportsService(action.service, loc.id)){
    return toast(tx("serviceUnavailable"));
  }
  if((action.kind === "huntNearby" || action.kind === "scoutNearby") && chapterOneRoadsLocked()){
    return toast(tx("lockUntilGate"));
  }
  clearWorldSceneTraversal();
  activeWorldSceneTraversal = createWorldSceneTraversal({location:loc, scene, action});
  preloadWorldSceneTraversalAssets();
  playAudioHook("town-ambience", {service:action.service || action.kind, location:loc.id, traversal:"world-scene"});
  renderWorldHome();
  scheduleSceneTraversal(completeWorldSceneTraversal);
}

export function startRoadStopSceneTraversal(actionId){
  const place = getCurrentPlaceContext();
  if(place.type !== "roadStop")return toast(tx("journeyNotReady"));
  const scene = resolveRoadStopScene(place.roadNode);
  const action = worldSceneAction(scene, actionId);
  const available = availableRoadStopSceneActions(scene, place);
  if(!scene || !action || !available.includes(action)){
    if(actionId === "continueJourney")return window.FE?.continueJourney?.();
    if(actionId === "inspectArea")return window.FE?.inspectRoadStop?.();
    if(actionId === "turnBack")return window.FE?.turnBackJourney?.();
    if(actionId === "openMap")return window.FE?.show?.("map");
    return toast(tx("journeyNotReady"));
  }
  clearWorldSceneTraversal();
  activeWorldSceneTraversal = createWorldSceneTraversal({location:place.roadNode, scene, action});
  preloadWorldSceneTraversalAssets();
  playAudioHook("travel-ambience", {roadStop:place.id, action:action.kind, traversal:"road-stop-scene"});
  renderWorldHome();
  scheduleSceneTraversal(completeRoadStopSceneTraversal);
}

function scheduleSceneTraversal(onComplete){
  const traversalId = activeWorldSceneTraversal?.id;
  worldSceneTraversalTimers = traversalPhaseSchedule(activeWorldSceneTraversal).map(step=>setTimeout(()=>{
    if(!activeWorldSceneTraversal || activeWorldSceneTraversal.id !== traversalId)return;
    if(step.phase !== "complete"){
      activeWorldSceneTraversal = withTraversalPhase(activeWorldSceneTraversal, step.phase);
      renderWorldHome();
      return;
    }
    const destination = activeWorldSceneTraversal;
    clearWorldSceneTraversal();
    onComplete(destination);
  }, step.delay));
}

function completeWorldSceneTraversal(destination){
  document.body.classList.remove("cinematic-world-home-active");
  const kind = destination?.destinationKind;
  if(kind === "townCenter" || destination?.service === "townCenter"){
    window.FE?.openTownCenter?.();
    window.FE?.continueServiceEntry?.();
    return;
  }
  if(kind === "service" && destination?.service){
    window.FE?.openTownService?.(destination.service);
    window.FE?.continueServiceEntry?.();
    return;
  }
  if(kind === "huntNearby")return window.FE?.huntNearby?.();
  if(kind === "scoutNearby")return window.FE?.scoutNearby?.();
  if(kind === "openMap")return window.FE?.show?.("map");
}

function completeRoadStopSceneTraversal(destination){
  const kind = destination?.destinationKind;
  if(kind === "continueJourney")return window.FE?.continueJourney?.();
  if(kind === "inspectRoadStop")return window.FE?.inspectRoadStop?.();
  if(kind === "turnBackJourney")return window.FE?.turnBackJourney?.();
  if(kind === "openMap")return window.FE?.show?.("map");
}

export function travelToLocation(id){
  if(activeTravel)return toast(tx("alreadyTraveling"));
  const from = ensureWorld();
  const to = locationById(id);
  if(!to)return toast(tx("unknownLocation"));
  const lockReason = routeLockReason(to);
  if(lockReason)return toast(lockReason);
  if(!from.routes.includes(id) && id !== state.world.previousLocationId)return toast(tx("routeLocked"));
  selectedMapLocationId = id;
  mapCamera.userPanned = false;
  activeTravel = createTravelState(from,to);
  travelDebug("started", {from:from.id,to:to.id,routeNodeIds:activeTravel.routeNodeIds});
  playAudioHook("travel-ambience", {from:from.id,to:to.id});
  showWorldMap();
  startTravelLoop();
}

function createTravelState(from,to){
  const routeNodeIds = travelRouteStops(from.id,to.id);
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  const legs = routeLegs(routeNodeIds);
  const nextRoadNodeId = routeNodeIds[1] || to.id;
  return {
    originLocationId: from.id,
    destinationLocationId: to.id,
    routeNodeIds,
    currentIndex: 0,
    currentRoadNodeId: from.id,
    previousRoadNodeId: null,
    nextRoadNodeId,
    status: "moving",
    encounterPoint: null,
    resumeAfterBattle: true,
    inspectedStops: [],
    rolledStops: [],
    legs,
    progress: 0,
    legProgress: 0,
    rawLegProgress: 0,
    direction: 1,
    currentStopName: nodeName(allNodes[nextRoadNodeId]),
    stopMessage: "",
    legStartedAt: 0,
    startedAt: 0,
    debugProgressBucket: -1
  };
}

function startTravelLoop(){
  clearTravelLoop();
  if(!activeTravel)return;
  activeTravel.startedAt = performance.now();
  activeTravel.legStartedAt = activeTravel.startedAt;
  travelTimer = requestAnimationFrame(tickPlayerTravel);
}

function tickPlayerTravel(now = performance.now()){
  if(!activeTravel || activeTravel.status !== "moving")return;
  const leg = currentJourneyLeg(activeTravel);
  if(!leg){
    if((activeTravel.direction || 1) < 0)return completeTravelBackToOrigin();
    return completeTravelToLocation(activeTravel.destinationLocationId);
  }
  const elapsed = Math.max(0, now - activeTravel.legStartedAt);
  activeTravel.rawLegProgress = Math.min(1, elapsed / TRAVEL_LEG_DURATION_MS);
  activeTravel.legProgress = cinematicEase(activeTravel.rawLegProgress);
  activeTravel.progress = travelOverallProgress(activeTravel);
  logTravelProgress(activeTravel);
  updateTravelMapDOM();
  if(activeTravel.rawLegProgress >= 1){
    arriveAtTravelStop(leg.to);
  }
  else travelTimer = requestAnimationFrame(tickPlayerTravel);
}

function arriveAtTravelStop(stopId){
  if(!activeTravel)return;
  const previous = activeTravel.currentRoadNodeId;
  const direction = activeTravel.direction || 1;
  const arrivedIndex = activeTravel.routeNodeIds.indexOf(stopId);
  activeTravel.currentIndex = arrivedIndex >= 0
    ? arrivedIndex
    : clamp(activeTravel.currentIndex + direction, 0, activeTravel.routeNodeIds.length - 1);
  activeTravel.previousRoadNodeId = previous;
  activeTravel.currentRoadNodeId = stopId;
  activeTravel.nextRoadNodeId = activeTravel.routeNodeIds[activeTravel.currentIndex + 1] || null;
  activeTravel.legProgress = 0;
  activeTravel.progress = travelOverallProgress(activeTravel);
  activeTravel.direction = 1;
  activeTravel.currentStopName = nodeName(getMapNodes(WORLD_LOCATIONS)[stopId]);
  clearTravelLoop();
  travelDebug("stop entered", {stop:stopId, direction, currentIndex:activeTravel.currentIndex, progress:Number(activeTravel.progress.toFixed(3))});
  if(activeTravel.currentIndex >= activeTravel.routeNodeIds.length - 1){
    completeTravelToLocation(activeTravel.destinationLocationId);
    return;
  }
  if(activeTravel.currentIndex <= 0 && direction < 0){
    completeTravelBackToOrigin();
    return;
  }
  const result = direction > 0 ? maybeTriggerTravelEncounter(stopId) : false;
  if(result)return;
  activeTravel.status = "atRoadStop";
  activeTravel.stopMessage ||= roadStopDescription(stopId);
  showWorldMap();
}

function maybeTriggerTravelEncounter(stopId){
  if(!activeTravel || activeTravel.rolledStops.includes(stopId) || stopId === activeTravel.destinationLocationId)return false;
  activeTravel.rolledStops.push(stopId);
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  const to = locationById(activeTravel.destinationLocationId);
  const from = locationById(activeTravel.originLocationId);
  const danger = Math.max(from?.danger || 0, to?.danger || 0, routeStopDanger(stopId, allNodes));
  const encounter = rollTravelEncounter({danger, segmentIndex:activeTravel.currentIndex, stopId});
  travelDebug("encounter rolled", {stop:stopId,danger,type:encounter.type,forced:!!encounter.forced});
  if(encounter.type === "battle" && !encounter.forced && consumeCampQuiet()){
    state.world.story.push(tx("campRoadQuiet"));
    activeTravel.stopMessage = tx("campRoadQuiet");
    save();
    return false;
  }
  if(encounter.type === "nothing")return false;
  if(encounter.type === "strange"){
    state.world.story.push(`${tx("travelStrangeEvent")}: ${tx("travelStrangeEventBody")} (${nodeName(allNodes[stopId])}).`);
    activeTravel.stopMessage = `${tx("travelStrangeEvent")}: ${tx("travelStrangeEventBody")}`;
    save();
    return false;
  }
  if(encounter.type === "merchant"){
    state.hero.food += 1;
    state.world.story.push(`${tx("travelMerchantEvent")}: ${tx("travelMerchantEventBody")}`);
    activeTravel.stopMessage = `${tx("travelMerchantEvent")}: ${tx("travelMerchantEventBody")}`;
    save();
    return false;
  }
  if(encounter.type === "discovery"){
    state.hero.gold += 8 + rnd(0,10);
    state.world.story.push(`${tx("travelDiscoveryEvent")}: ${tx("travelDiscoveryEventBody")}`);
    activeTravel.stopMessage = `${tx("travelDiscoveryEvent")}: ${tx("travelDiscoveryEventBody")}`;
    save();
    return false;
  }
  activeTravel.status = "encounter";
  activeTravel.encounterPoint = activeTravelMarkerPoint(activeTravel);
  activeTravel.resumeAfterBattle = true;
  clearTravelLoop();
  showWorldMap();
  beginTravelBattle(from,to);
  return true;
}

function travelOverallProgress(travel){
  const legCount = Math.max(1, travel.routeNodeIds.length - 1);
  const direction = travel.direction || 1;
  const movingProgress = travel.status === "moving" ? travel.legProgress * direction : 0;
  return clamp((travel.currentIndex + movingProgress) / legCount, 0, 1);
}

function activeTravelMarkerPoint(travel){
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  if(travel.status === "encounter" && travel.encounterPoint)return travel.encounterPoint;
  if(travel.status !== "moving")return allNodes[travel.currentRoadNodeId] || allNodes[travel.originLocationId] || {x:50,y:50};
  const leg = currentJourneyLeg(travel);
  if(!leg)return allNodes[travel.destinationLocationId] || allNodes[travel.originLocationId] || {x:50,y:50};
  return routePoint(leg.from, leg.to, travel.legProgress, allNodes);
}

function activeTravelMarkerAngle(travel){
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  const leg = currentJourneyLeg(travel);
  return leg ? routeAngle(leg.from, leg.to, travel.legProgress, allNodes) : 0;
}

function currentJourneyLeg(travel){
  const from = travel.currentRoadNodeId || travel.routeNodeIds[travel.currentIndex];
  const to = travel.nextRoadNodeId || travel.routeNodeIds[travel.currentIndex + (travel.direction || 1)];
  return from && to ? {from,to} : null;
}

function updateTravelMapDOM(){
  if(!activeTravel)return;
  const marker = document.querySelector(".overworld-marker");
  if(marker){
    const point = activeTravelMarkerPoint(activeTravel);
    const angle = activeTravelMarkerAngle(activeTravel);
    const markerPresence = createMapTraversalPresence({
      status:activeTravel.status,
      rawProgress:activeTravel.rawLegProgress ?? activeTravel.legProgress ?? 0,
      angle,
      direction:activeTravel.direction || 1
    });
    marker.style.setProperty("--marker-x", `${point.x}%`);
    marker.style.setProperty("--marker-y", `${point.y}%`);
    marker.style.setProperty("--marker-angle", `${angle}deg`);
    marker.style.setProperty("--journey-facing", markerPresence.direction);
    marker.style.setProperty("--journey-heading", `${angle}deg`);
    marker.style.setProperty("--journey-step-progress", markerPresence.progress);
    marker.style.setProperty("--journey-marker-lift", activeTravel.status === "moving" ? "-0.18px" : "0px");
    marker.dataset.traversalKind = "road-travel";
    marker.dataset.traversalPhase = markerPresence.phase;
    marker.dataset.traversalFacing = markerPresence.facing;
    marker.dataset.traversalPose = markerPresence.pose;
    marker.classList.add("traversal-map-presence");
    ["idle","preparing-to-move","walking","arriving","entering-location","exiting-location"].forEach(phase=>{
      marker.classList.toggle(`traversal-phase-${phase}`, markerPresence.phase === phase);
    });
    ["left","right","forward","away"].forEach(facing=>{
      marker.classList.toggle(`traversal-facing-${facing}`, markerPresence.facing === facing);
    });
    ["idle","walk-left","walk-right","walk-forward","walk-away","arriving","entering-location","exiting-location"].forEach(pose=>{
      marker.classList.toggle(`traversal-pose-${pose}`, markerPresence.pose === pose);
    });
    marker.classList.toggle("is-walking", markerPresence.phase === "walking");
    marker.classList.toggle("is-alert", activeTravel.status === "encounter");
  }
  const progress = document.querySelector("[data-travel-progress]");
  if(progress)progress.textContent = `${Math.floor((activeTravel.progress || 0) * 100)}%`;
  const dockProgress = document.querySelector("[data-map-progress]");
  if(dockProgress)dockProgress.textContent = `${Math.floor((activeTravel.progress || 0) * 100)}%`;
  const stopLabel = document.querySelector("[data-travel-stop-label]");
  if(stopLabel)stopLabel.textContent = `${tx("travelRoadStop")}: ${activeTravel.currentStopName || ""}`;
  document.querySelectorAll(".travel-stop").forEach(stop=>{
    const id = stop.getAttribute("data-stop-id");
    stop.classList.toggle("active-travel-stop", id === activeTravel.currentRoadNodeId || id === activeTravel.nextRoadNodeId);
  });
  if(!mapCamera.userPanned && marker){
    mapCamera.x = parseFloat(marker.style.getPropertyValue("--marker-x")) || mapCamera.x;
    mapCamera.y = parseFloat(marker.style.getPropertyValue("--marker-y")) || mapCamera.y;
    applyMapCamera();
  }
}

function nodeName(node){
  const value = node?.name;
  if(!value)return "";
  if(typeof value === "string")return value;
  return value[getLanguage()] || value.en || "";
}

function nodeText(node,field){
  const value = node?.[field];
  if(!value)return "";
  if(typeof value === "string")return value;
  return value[getLanguage()] || value.en || "";
}

function roadStopDescription(stopId){
  const node = getMapNodes(WORLD_LOCATIONS)[stopId];
  return nodeText(node,"desc") || nodeText(node,"condition") || tx("roadStopDefaultDesc");
}

function normalizeJourneyStop(travel, preferredStopId = null){
  if(!travel)return null;
  const route = Array.isArray(travel.routeNodeIds) ? travel.routeNodeIds : [];
  let index = Number.isFinite(Number(travel.currentIndex)) ? Number(travel.currentIndex) : 0;
  if(preferredStopId && route.includes(preferredStopId))index = route.indexOf(preferredStopId);
  else if(travel.currentRoadNodeId && route.includes(travel.currentRoadNodeId))index = route.indexOf(travel.currentRoadNodeId);
  index = clamp(Math.floor(index), 0, Math.max(0, route.length - 1));
  travel.currentIndex = index;
  travel.currentRoadNodeId = route[index] || travel.currentRoadNodeId || travel.originLocationId;
  travel.nextRoadNodeId = route[index + 1] || null;
  travel.legProgress = 0;
  travel.rawLegProgress = 0;
  travel.direction = 1;
  travel.progress = travelOverallProgress(travel);
  travel.currentStopName = nodeName(getMapNodes(WORLD_LOCATIONS)[travel.currentRoadNodeId]);
  return travel;
}

function journeyContinueState(travel = activeTravel){
  if(!travel)return {enabled:false, reason:"no active journey"};
  if(travel.status !== "atRoadStop")return {enabled:false, reason:`status is ${travel.status}`};
  if(!travel.nextRoadNodeId)return {enabled:false, reason:"no next road node"};
  return {enabled:true, reason:"ready"};
}

function journeyTurnBackState(travel = activeTravel){
  if(!travel)return {enabled:false, reason:"no active journey"};
  if(travel.status !== "atRoadStop")return {enabled:false, reason:`status is ${travel.status}`};
  if(travel.currentIndex <= 0)return {enabled:false, reason:"already at origin"};
  return {enabled:true, reason:"ready"};
}

function campFortifyCost(node){
  const base = node?.roadBuildCost || {gold: 30, ore: 2};
  return {
    gold: Math.max(40, (base.gold || 30) + 20),
    ore: Math.max(4, (base.ore || 2) + 2),
    food: 3
  };
}

function campFortifyContext(node, existing){
  const stage = existing?.stage || "basic";
  if(stage === "fortified"){
    return {
      canFortify: false,
      fortified: true,
      disabledReason: tx("campAlreadyFortified"),
      summary: tx("campFortifiedSummary")
    };
  }
  const cost = campFortifyCost(node);
  const canAfford = state.hero.gold >= cost.gold
    && state.hero.ore >= cost.ore
    && state.hero.food >= cost.food;
  const atStop = activeTravel?.status === "atRoadStop";
  let disabledReason = "";
  if(!atStop)disabledReason = tx("travelingBetweenRoadStops");
  else if(state.hero.ore < cost.ore)disabledReason = tx("notEnoughOre");
  else if(state.hero.food < cost.food)disabledReason = tx("notEnoughFood");
  else if(state.hero.gold < cost.gold)disabledReason = tx("notEnoughGold");
  const costParts = [`${cost.gold} ${tx("gold")}`, `${cost.ore} ${tx("ore")}`, `${cost.food} ${tx("food")}`];
  return {
    canFortify: atStop && canAfford,
    fortified: false,
    disabledReason,
    summary: `${tx("fortifyCamp")}: ${costParts.join(", ")}.`,
    cost
  };
}

function roadStopBuildContext(node){
  if(!node || node.type !== "road"){
    return {
      summary: tx("cannotBuildHere"),
      disabledReason: tx("cannotBuildHere"),
      canBuild: false,
      hasCamp: false
    };
  }
  const existing = state.world.roadStopStates?.[node.id];
  if(existing?.type === "camp"){
    const fortify = campFortifyContext(node, existing);
    return {
      summary: fortify.fortified ? fortify.summary : tx("campActiveSummary"),
      disabledReason: tx("campAlreadyEstablished"),
      canBuild: false,
      hasCamp: true,
      fortified: fortify.fortified,
      canFortify: fortify.canFortify,
      fortifyDisabledReason: fortify.disabledReason,
      fortifySummary: fortify.summary,
      fortifyCost: fortify.cost
    };
  }
  if(!node.buildable){
    const reason = tx(node.buildRestrictionReason || "cannotBuildHere");
    return {
      summary: `${tx("cannotBuildHere")}: ${reason}`,
      disabledReason: reason,
      canBuild: false,
      hasCamp: false
    };
  }
  const cost = node.roadBuildCost || {gold: 30};
  const costParts = [];
  if(cost.gold)costParts.push(`${cost.gold} ${tx("gold")}`);
  if(cost.ore)costParts.push(`${cost.ore} ${tx("ore")}`);
  if(cost.food)costParts.push(`${cost.food} ${tx("food")}`);
  const threatText = node.nearbyThreats?.length ? `${tx("nearbyThreats")}: ${node.nearbyThreats.join(", ")}.` : "";
  const canAfford = state.hero.gold >= (cost.gold || 0)
    && state.hero.ore >= (cost.ore || 0)
    && state.hero.food >= (cost.food || 0);
  const atStop = activeTravel?.status === "atRoadStop";
  let disabledReason = "";
  if(!atStop)disabledReason = tx("travelingBetweenRoadStops");
  else if(!canAfford)disabledReason = cost.food && state.hero.food < cost.food ? tx("notEnoughFood") : tx("notEnoughGold");
  return {
    summary: `${tx("establishCamp")}${costParts.length ? `: ${costParts.join(", ")}` : ""}. ${tx("strategicValue")}: ${node.strategicValue || 1}. ${threatText}`.trim(),
    disabledReason,
    canBuild: atStop && canAfford,
    hasCamp: false,
    cost
  };
}

export function establishCamp(){
  const place = getCurrentPlaceContext();
  if(place.type !== "roadStop" || activeTravel?.status !== "atRoadStop"){
    return toast(tx("cannotBuildHere"));
  }
  const node = place.roadNode;
  if(!node?.buildable)return toast(place.build.disabledReason || tx("cannotBuildHere"));
  if(state.world.roadStopStates?.[node.id]?.type === "camp"){
    return toast(tx("campAlreadyEstablished"));
  }
  const cost = node.roadBuildCost || {gold: 30};
  if(state.hero.gold < (cost.gold || 0))return toast(tx("notEnoughGold"));
  if(state.hero.ore < (cost.ore || 0))return toast(tx("needOre"));
  if(state.hero.food < (cost.food || 0))return toast(tx("notEnoughFood"));
  state.hero.gold -= cost.gold || 0;
  state.hero.ore -= cost.ore || 0;
  state.hero.food -= cost.food || 0;
  state.world.roadStopStates ||= {};
  state.world.roadStopStates[node.id] = {type: "camp", stage: "basic", builtDay: state.world.day || 1};
  recoverPartyAtCamp(false);
  grantCampQuiet(node, false);
  state.world.story.push(`${tx("campEstablished")}: ${nodeName(node)}.`);
  playAudioHook("town-ambience", {intent: "settlement-loop"});
  advanceDays(1);
  save();
  updateTop();
  renderWorldHome();
  toast(tx("campEstablished"));
}

export function fortifyCamp(){
  const place = getCurrentPlaceContext();
  if(place.type !== "roadStop" || activeTravel?.status !== "atRoadStop"){
    return toast(tx("cannotBuildHere"));
  }
  const node = place.roadNode;
  const existing = state.world.roadStopStates?.[node?.id];
  if(existing?.type !== "camp")return toast(tx("cannotBuildHere"));
  if(existing.stage === "fortified")return toast(tx("campAlreadyFortified"));
  const cost = campFortifyCost(node);
  if(state.hero.gold < cost.gold)return toast(tx("notEnoughGold"));
  if(state.hero.ore < cost.ore)return toast(tx("notEnoughOre"));
  if(state.hero.food < cost.food)return toast(tx("notEnoughFood"));
  state.hero.gold -= cost.gold;
  state.hero.ore -= cost.ore;
  state.hero.food -= cost.food;
  state.world.roadStopStates[node.id] = {...existing, stage: "fortified", fortifiedDay: state.world.day || 1};
  recoverPartyAtCamp(true);
  grantCampQuiet(node, true);
  state.world.story.push(`${tx("campFortified")}: ${nodeName(node)}.`);
  playAudioHook("town-ambience", {intent: "settlement-loop"});
  advanceDays(2);
  save();
  updateTop();
  renderWorldHome();
  toast(tx("campFortified"));
}

function recoverPartyAtCamp(fortified){
  const h = state.hero;
  if(!h)return;
  const pct = fortified ? 1 : 0.6;
  h.hp = Math.min(h.maxHp, Math.max(h.hp, Math.floor(h.maxHp * pct)));
  h.mana = Math.min(h.maxMana, Math.max(h.mana || 0, Math.floor((h.maxMana || 0) * pct)));
  (h.companions || []).forEach(c=>{
    if(!c)return;
    const maxHp = c.maxHp || c.hp || 1;
    c.hp = Math.min(maxHp, Math.max(c.hp || 0, Math.floor(maxHp * pct)));
    if(c.maxMana)c.mana = Math.min(c.maxMana, Math.max(c.mana || 0, Math.floor(c.maxMana * pct)));
  });
}

function grantCampQuiet(node, fortified){
  state.world.campShelter = {
    nodeId: node?.id || "",
    quietLegs: fortified ? 2 : 1,
    fortified: !!fortified
  };
}

function consumeCampQuiet(){
  const shelter = state.world?.campShelter;
  if(!shelter || !(shelter.quietLegs > 0))return false;
  shelter.quietLegs -= 1;
  return true;
}

export function restAtCamp(){
  const place = getCurrentPlaceContext();
  if(place.type !== "roadStop" || activeTravel?.status !== "atRoadStop"){
    return toast(tx("cannotBuildHere"));
  }
  const existing = state.world.roadStopStates?.[place.roadNode?.id];
  if(existing?.type !== "camp")return toast(tx("cannotBuildHere"));
  if(state.hero.food < 1)return toast(tx("needFood"));
  state.hero.food -= 1;
  recoverPartyAtCamp(existing.stage === "fortified");
  grantCampQuiet(place.roadNode, existing.stage === "fortified");
  advanceDays(1);
  save();
  updateTop();
  renderWorldHome();
  toast(tx("campRested"));
}

async function beginTravelBattle(from,to){
  travelDebug("encounter transition started", {from:from?.id,to:to?.id});
  playAudioHook("encounter-warning", {from:from?.id,to:to?.id});
  await playEncounterTransition({
    title: tx("travelAmbush"),
    body: tx("travelAmbushBody")
  });
  const target = to || locationById(activeTravel?.destinationLocationId) || currentLocation();
  const enemy = makeLocationEnemy(target, target.danger >= 3 && Math.random() < .22);
  state.world.story.push(`${tx("travelEncounter")}: ${locationText(from,"name")} -> ${locationText(target,"name")}.`);
  save();
  travelDebug("battle started", {target:target.id, enemy:enemy.name});
  startBattle([enemy], `${tx("travelEncounter")}: ${locationText(target,"name")}.`, {
    source: "travel",
    onVictory: "resumeJourney",
    onDefeat: "cancelJourney",
    encounterRoadNodeId: activeTravel?.currentRoadNodeId || null,
    locationId: activeTravel?.destinationLocationId || state.world.locationId
  });
}

function completeTravelToLocation(id){
  const from = locationById(activeTravel?.originLocationId) || ensureWorld();
  const to = locationById(id);
  activeTravel = null;
  clearTravelLoop();
  if(!to)return showWorldHome();
  travelDebug("completed", {from:from.id,to:to.id});
  state.world.previousLocationId = from.id;
  state.world.routeHistory.push(from.id);
  state.world.routeHistory = state.world.routeHistory.slice(-12);
  state.world.locationId = to.id;
  state.world.region = to.region;
  advanceDays(1);
  if(to.danger > 0)state.hero.food = Math.max(0, state.hero.food - 1);
  const event = travelArrivalEvent(from,to);
  save();
  showWorldHome();
}

function completeTravelBackToOrigin(){
  const origin = locationById(activeTravel?.originLocationId) || ensureWorld();
  activeTravel = null;
  clearTravelLoop();
  if(origin){
    state.world.locationId = origin.id;
    state.world.region = origin.region;
  }
  save();
  travelDebug("turned back to origin", {origin:origin?.id});
  showWorldHome();
}

export function cancelTravel(){
  if(!activeTravel)return;
  clearTravelLoop();
  activeTravel = null;
  toast(tx("travelCanceled"));
  showWorldHome();
}

export function returnToPreviousLocation(){
  const previous = state?.world?.previousLocationId;
  if(!previous || !locationById(previous))return toast(tx("noPreviousLocation"));
  travelToLocation(previous);
}

function travelArrivalEvent(from,to){
  const roll = Math.random();
  if(roll < 0.24){
    const food = rnd(1,2);
    state.hero.food += food;
    state.world.story.push(`${tx("travelResource")}: +${food} ${tx("food").toLowerCase()} near ${locationText(to,"name")}.`);
    return "resource";
  }
  if(roll < 0.68){
    state.world.story.push(locationText(to,"lore"));
    return "lore";
  }
  state.world.story.push(`${tx("arrivedAt")} ${locationText(to,"name")}.`);
  return "safe";
}

export function forceTravelEncounter(type = "battle"){
  forceNextTravelEncounter(type);
  travelDebug("forced encounter armed", {type});
  toast(tx("forceTravelEncounterReady"));
}

export function continueJourney(){
  travelDebug("continueJourney clicked", {before:travelSnapshot(), continueState:journeyContinueState()});
  if(activeTravel)normalizeJourneyStop(activeTravel);
  const continueState = journeyContinueState();
  if(!continueState.enabled){
    travelDebug("continueJourney blocked", {continueState, afterNormalize:travelSnapshot()});
    return toast(tx("journeyNotReady"));
  }
  if(!activeTravel.nextRoadNodeId)return completeTravelToLocation(activeTravel.destinationLocationId);
  activeTravel.status = "moving";
  activeTravel.direction = 1;
  activeTravel.nextRoadNodeId = activeTravel.routeNodeIds[activeTravel.currentIndex + 1] || null;
  activeTravel.previousRoadNodeId = activeTravel.currentRoadNodeId;
  activeTravel.legProgress = 0;
  activeTravel.rawLegProgress = 0;
  activeTravel.stopMessage = "";
  activeTravel.currentStopName = nodeName(getMapNodes(WORLD_LOCATIONS)[activeTravel.nextRoadNodeId]);
  travelDebug("continue journey", {
    from: activeTravel.currentRoadNodeId,
    to: activeTravel.nextRoadNodeId,
    currentIndex: activeTravel.currentIndex
  });
  showWorldMap();
  startTravelLoop();
}

export function turnBackJourney(){
  travelDebug("turnBackJourney clicked", {before:travelSnapshot(), turnBackState:journeyTurnBackState()});
  if(activeTravel)normalizeJourneyStop(activeTravel);
  const turnBackState = journeyTurnBackState();
  if(!turnBackState.enabled){
    travelDebug("turnBackJourney blocked", {turnBackState, afterNormalize:travelSnapshot()});
    return toast(tx("journeyNotReady"));
  }
  activeTravel.status = "moving";
  activeTravel.direction = -1;
  activeTravel.previousRoadNodeId = activeTravel.currentRoadNodeId;
  activeTravel.nextRoadNodeId = activeTravel.routeNodeIds[activeTravel.currentIndex - 1] || null;
  activeTravel.legProgress = 0;
  activeTravel.rawLegProgress = 0;
  activeTravel.stopMessage = "";
  activeTravel.currentStopName = nodeName(getMapNodes(WORLD_LOCATIONS)[activeTravel.nextRoadNodeId]);
  travelDebug("turn back journey", {
    from: activeTravel.currentRoadNodeId,
    to: activeTravel.nextRoadNodeId,
    currentIndex: activeTravel.currentIndex
  });
  showWorldMap();
  startTravelLoop();
}

export function inspectRoadStop(){
  if(!activeTravel || activeTravel.status !== "atRoadStop")return toast(tx("journeyNotReady"));
  const stopId = activeTravel.currentRoadNodeId;
  if(activeTravel.inspectedStops.includes(stopId)){
    activeTravel.stopMessage = tx("roadStopAlreadyInspected");
    showWorldMap();
    return;
  }
  activeTravel.inspectedStops.push(stopId);
  const found = Math.random() < .45;
  if(found){
    const gold = rnd(3,9);
    state.hero.gold += gold;
    activeTravel.stopMessage = `${tx("roadStopInspectFound")} +${gold} ${tx("gold").toLowerCase()}.`;
  }else{
    activeTravel.stopMessage = tx("roadStopInspectQuiet");
  }
  state.world.story.push(`${tx("inspectArea")}: ${activeTravel.stopMessage}`);
  save();
  showWorldMap();
}

export function resumeJourneyAfterBattle(meta = {}){
  travelDebug("resumeJourneyAfterBattle called", {meta, before:travelSnapshot()});
  if(!activeTravel)return showWorldMap();
  const encounterStopId = meta.encounterRoadNodeId || activeTravel.currentRoadNodeId;
  clearTravelLoop();
  normalizeJourneyStop(activeTravel, encounterStopId);
  activeTravel.status = "atRoadStop";
  activeTravel.resumeAfterBattle = false;
  activeTravel.encounterPoint = null;
  activeTravel.stopMessage = tx("roadStopAfterBattle");
  document.querySelectorAll(".encounter-transition").forEach(element=>element.remove());
  const context = getCurrentPlaceContext();
  travelDebug("resumed after battle", {
    after: travelSnapshot(),
    context,
    continueState: journeyContinueState()
  });
  showWorldHome();
}

export function debugBootRoadStop(stopId = "broken_road", name = "Xexe", classId = "warrior"){
  if(!state?.hero?.name)startActualGame(name, classId);
  state.hero.gold = Math.max(state.hero.gold || 0, 120);
  state.hero.ore = Math.max(state.hero.ore || 0, 12);
  state.hero.food = Math.max(state.hero.food || 0, 8);
  return debugEnterRoadStopScene(stopId);
}

export function debugBattleTransition(){
  return playEncounterTransition({
    title: tx("travelAmbush"),
    body: tx("travelAmbushBody")
  });
}

export function debugBootSlumScene(name = "Xexe", classId = "warrior"){
  if(!state?.hero?.name)startActualGame(name, classId);
  state.world.locationId = START_LOCATION;
  state.world.previousLocationId = null;
  state.world.routeHistory.push(START_LOCATION);
  save(1);
  showWorldHome();
  return START_LOCATION;
}

export function debugBootLowerWard(name = "Xexe", classId = "warrior"){
  if(!state?.hero?.name)startActualGame(name, classId);
  state.prologue ||= {};
  state.prologue.lowerWardGate = {unlocked: true};
  state.prologue.phase = "gateUnlocked";
  state.world.locationId = "lower_ward";
  state.world.routeHistory.push("lower_ward");
  save(1);
  showWorldHome();
  return "lower_ward";
}

export function debugJourneyState(){
  const context = getCurrentPlaceContext();
  const info = {
    activeJourney: travelSnapshot(),
    currentPlaceContext: context,
    continueState: journeyContinueState(),
    turnBackState: journeyTurnBackState(),
    currentIndex: activeTravel?.currentIndex ?? null,
    nextRoadNodeId: activeTravel?.nextRoadNodeId ?? null,
    status: activeTravel?.status ?? "none"
  };
  console.log("[travel] debugJourneyState", info);
  return info;
}

export function debugEnterRoadStopScene(stopId = "ashen_gate", destinationLocationId = "market_town"){
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  const node = allNodes[stopId];
  const destination = locationById(destinationLocationId) || WORLD_LOCATIONS.market_town;
  const origin = currentLocation() || WORLD_LOCATIONS.ashen_keep;
  if(!node || node.type !== "road" || !destination)return null;
  clearTravelLoop();
  activeTravel = {
    originLocationId: origin.id,
    destinationLocationId: destination.id,
    routeNodeIds: [origin.id, node.id, destination.id],
    currentIndex: 1,
    currentRoadNodeId: node.id,
    previousRoadNodeId: origin.id,
    nextRoadNodeId: destination.id,
    status: "atRoadStop",
    encounterPoint: null,
    resumeAfterBattle: false,
    direction: 1,
    progress: .5,
    legProgress: 0,
    rawLegProgress: 0,
    inspectedStops: [],
    stopMessage: roadStopDescription(node.id),
    currentStopName: nodeName(node)
  };
  showWorldHome();
  return debugJourneyState();
}

export function debugSetLocationState(id = state.world.locationId, type = "town", stage = "developed"){
  if(!locationById(id))return null;
  state.world.locationStates ||= {};
  state.world.locationStates[id] = {type, stage};
  save();
  refreshWorldScreen();
  return state.world.locationStates[id];
}

export function debugSetRoadStopState(id, type = "camp", stage = "basic"){
  const node = getMapNodes(WORLD_LOCATIONS)[id];
  if(!node || node.type !== "road")return null;
  state.world.roadStopStates ||= {};
  state.world.roadStopStates[id] = {type, stage};
  save();
  refreshWorldScreen();
  return state.world.roadStopStates[id];
}

export function debugClearWorldArtState(id = state.world.locationId){
  state.world.locationStates ||= {};
  state.world.roadStopStates ||= {};
  delete state.world.locationStates[id];
  delete state.world.roadStopStates[id];
  save();
  refreshWorldScreen();
}

function refreshWorldScreen(){
  updateTop();
  if(byId("map")?.classList.contains("active"))renderWorldMap();
  if(byId("home")?.classList.contains("active"))renderWorldHome();
}

export function scoutNearby(){
  const loc = ensureWorld();
  if(chapterOneRoadsLocked())return toast(tx("lockUntilGate"));
  if(loc.danger > 0 && Math.random() < 0.35){
    state.world.story.push(`${tx("scoutEncounter")}: ${locationText(loc,"name")}.`);
    save();
    startBattle([makeLocationEnemy(loc,false)], `${tx("scoutEncounter")}: ${locationText(loc,"name")}.`, {locationId: loc.id});
    return;
  }
  const ore = loc.services.includes("mine") ? 1 : 0;
  if(ore)state.hero.ore += ore;
  state.world.story.push(ore ? `${tx("scoutFind")}: +${ore} ${tx("ore").toLowerCase()}.` : locationText(loc,"lore"));
  advanceDays(1);
  save();
  updateTop();
  renderWorldHome();
}

export function huntNearby(){
  const loc = ensureWorld();
  if(chapterOneRoadsLocked())return toast(tx("lockUntilGate"));
  const count = loc.danger >= 3 ? 2 : 1;
  state.world.story.push(`${tx("huntNearby")}: ${locationText(loc,"name")}.`);
  save();
  startBattle(Array.from({length:count},()=>makeLocationEnemy(loc, loc.danger >= 4 && Math.random() < 0.25)), `${tx("huntNearby")}: ${locationText(loc,"name")}.`, {locationId: loc.id});
}

export function startHardArea(id){
  const loc = ensureWorld();
  const area = HARD_AREAS[id];
  if(!area || !area.locations.includes(loc.id))return toast(tx("hardAreaLocked"));
  state.world.hardAreas ||= {attempts:{},clears:{}};
  state.world.hardAreas.attempts ||= {};
  state.world.hardAreas.clears ||= {};
  state.world.hardAreas.attempts[id] = Number(state.world.hardAreas.attempts[id] || 0) + 1;
  const enemies = Array.from({length:area.enemyCount},(_,index)=>makeHardAreaEnemy(area,index));
  state.world.story.push(`${tx("hardAreaStarted")}: ${hardAreaText(area,"name")}.`);
  save();
  startBattle(enemies, `${tx("hardAreas")}: ${hardAreaText(area,"name")}.`, {
    source:"hard-area",
    onVictory:"hardAreaWon",
    hardAreaId:id,
    locationId:loc.id
  });
}

export function completeHardArea(meta = {}){
  const area = HARD_AREAS[meta.hardAreaId];
  if(!area)return showWorldHome();
  state.world.hardAreas ||= {attempts:{},clears:{}};
  state.world.hardAreas.clears ||= {};
  const previousClears = Number(state.world.hardAreas.clears[area.id] || 0);
  state.world.hardAreas.clears[area.id] = previousClears + 1;
  if(previousClears === 0){
    const bonusGold = Math.max(10,Math.floor(area.danger * area.rewardScale * 6));
    state.hero.gold += bonusGold;
    state.world.story.push(`${tx("hardAreaCleared")}: ${hardAreaText(area,"name")}. ${tx("gold")} +${bonusGold}.`);
  }else{
    state.world.story.push(`${tx("hardAreaCleared")}: ${hardAreaText(area,"name")}.`);
  }
  applyLowerWardHardAreaReward(area, previousClears);
  save();
  showWorldHome();
}

function grantHardAreaCompanionTraining(companion,xp){
  normalizeCompanion(companion);
  companion.training.xp += Math.max(0,Math.floor(Number(xp) || 0));
  let ranks = 0;
  while(companion.training.rank < 20 && companion.training.xp >= companionTrainingNeed(companion.training.rank)){
    companion.training.xp -= companionTrainingNeed(companion.training.rank);
    companion.training.rank++;
    companion.maxHp += 4;
    companion.hp = companion.maxHp;
    companion.attack += companion.role === "healer" ? 1 : 2;
    companion.defense += companion.role === "guard" ? 2 : 1;
    ranks++;
  }
  return ranks;
}

function applyLowerWardHardAreaReward(area,previousClears){
  const reward = area.lowerWardReward;
  if(!reward)return;
  const repeat = previousClears > 0;
  const companionLine = applyLowerWardCompanionFieldReward(reward, repeat);
  const ward = ensureLowerWardState();
  const influence = repeat ? Math.max(1,Math.floor((reward.influence || 1) / 2)) : reward.influence || 0;
  const writs = repeat ? 0 : reward.writs || 0;
  ward.influence = clamp(ward.influence + influence,0,100);
  ward.writs += writs;
  const line = `${hardAreaText(area,"name")} changes the ward ledger: influence +${influence}${writs ? `, writs +${writs}` : ""}${companionLine ? `. ${companionLine}` : ""}.`;
  ward.log.push(line);
  ward.log = ward.log.slice(-12);
  state.world.story.push(line);
}

function applyLowerWardCompanionFieldReward(reward,repeat){
  const active = (state.hero.companions || []).filter(companion=>companion.active && companion.hp > 0);
  if(!active.length)return "";
  const bondXp = Math.max(4,Math.floor((reward.bond || 8) * (repeat ? .45 : 1)));
  const trainingXp = Math.max(5,Math.floor((reward.training || 10) * (repeat ? .45 : 1)));
  const notes = active.map(companion=>{
    normalizeCompanion(companion);
    const bondLevels = grantCompanionBond(companion,bondXp);
    const trainingRanks = grantHardAreaCompanionTraining(companion,trainingXp);
    companion.morale = clamp((companion.morale || 50) + (repeat ? 1 : 2),0,100);
    return `${companion.name}${bondLevels ? " bond grew" : ""}${trainingRanks ? " training improved" : ""}`;
  });
  const ward = ensureLowerWardState();
  ward.companionReports++;
  return `Companions report in: ${notes.join("; ")}`;
}

function makeLocationEnemy(loc, elite=false){
  const enemy = elite ? makeElite() : makeEnemy(false);
  const pool = elite && loc.eliteEnemies?.length ? loc.eliteEnemies : loc.enemies;
  if(pool?.length){
    enemy.name = pool[rnd(0,pool.length-1)];
    stampEnemyVisualClass(enemy, {force:true});
  }
  if(elite)enemy.role = "elite";
  return stampEnemyVisualClass(enemy);
}

function makeHardAreaEnemy(area,index = 0){
  const isBoss = !!area.boss && index === area.enemyCount - 1;
  const heroLevel = state.hero.level || 1;
  const level = Math.max(
    area.recommendedLevel || 1,
    heroLevel + (area.levelBonus || 1) + rnd(0,area.levelSpread || 1)
  );
  const danger = area.danger || 4;
  const bossScale = isBoss ? 1.75 : 1;
  const name = isBoss ? area.boss : area.enemies[rnd(0,area.enemies.length - 1)];
  const hp = Math.floor((86 + level * 18 + danger * 13) * (area.hpScale || 1) * bossScale);
  const attack = Math.floor((14 + level * 4 + danger * 2) * (area.attackScale || 1) * (isBoss ? 1.12 : 1));
  const defense = Math.floor((5 + level * 1.8 + danger) * (area.defenseScale || 1) * (isBoss ? 1.08 : 1));
  return stampEnemyVisualClass({
    name,
    role:isBoss ? "boss" : "hard enemy",
    level,
    hp,
    maxHp:hp,
    attack,
    defense,
    speed:5 + rnd(0,5) + Math.floor(danger / 2) + (isBoss ? 1 : 0),
    xp:Math.floor((42 + level * 16 + danger * 12) * (area.rewardScale || 1) * bossScale),
    gold:Math.floor((14 + level * 5 + danger * 3) * (area.rewardScale || 1) * bossScale)
  });
}

export function renderWorldMap(){
  const current = ensureWorld();
  if(!selectedMapLocationId || !WORLD_LOCATIONS[selectedMapLocationId]){
    selectedMapLocationId = activeTravel?.destinationLocationId || current.id;
  }
  if(!mapCamera.userPanned){
    const focus = WORLD_LOCATIONS[selectedMapLocationId] || current;
    mapCamera.x = focus.x;
    mapCamera.y = focus.y;
  }
  const lockedIds = Object.values(WORLD_LOCATIONS).filter(loc=>routeLockReason(loc)).map(loc=>loc.id);
  byId("map").innerHTML = `
    <div class="map-screen map-screen-usable">
      ${renderOverworldHTML({
        locations:WORLD_LOCATIONS,
        currentId:current.id,
        previousId:state.world.previousLocationId,
        traveling:activeTravel,
        selectedId:selectedMapLocationId,
        lockedIds
      })}
      ${mapDockHTML(current, selectedMapLocationId, activeTravel)}
    </div>
  `;
  bindMapViewport();
}

export function selectMapLocation(id){
  if(mapPointerMoved)return;
  if(!locationById(id))return;
  selectedMapLocationId = id;
  mapCamera.userPanned = false;
  renderWorldMap();
}

export function zoomWorldMap(direction = 1){
  const next = Math.max(1.05, Math.min(2.7, mapCamera.scale + (direction > 0 ? 0.22 : -0.22)));
  if(next === mapCamera.scale)return;
  mapCamera.scale = next;
  applyMapCamera();
}

export function centerWorldMap(){
  const current = ensureWorld();
  const focus = activeTravel
    ? {x: parseFloat(document.querySelector(".overworld-marker")?.style.getPropertyValue("--marker-x")) || current.x, y: parseFloat(document.querySelector(".overworld-marker")?.style.getPropertyValue("--marker-y")) || current.y}
    : current;
  mapCamera.x = Number.isFinite(focus.x) ? focus.x : current.x;
  mapCamera.y = Number.isFinite(focus.y) ? focus.y : current.y;
  mapCamera.scale = 1.78;
  mapCamera.userPanned = false;
  applyMapCamera();
}

function mapDockHTML(current, selectedId, traveling){
  const selected = locationById(selectedId) || current;
  const lockReason = routeLockReason(selected);
  const isHere = selected.id === current.id;
  const connected = current.routes.includes(selected.id) || selected.id === state.world.previousLocationId;
  const roads = current.routes.map(id=>locationById(id)).filter(Boolean);
  const danger = selected.danger || 0;
  let stampClass = "map-stamp-far";
  let stamp = tx("statusFar");
  if(isHere){
    stampClass = "map-stamp-here";
    stamp = tx("statusHere");
  }else if(lockReason){
    stampClass = "map-stamp-locked";
    stamp = tx("statusLocked");
  }else if(connected){
    stampClass = "map-stamp-open";
    stamp = tx("statusOpen");
  }
  let action = "";
  if(traveling){
    const dest = locationById(traveling.destinationLocationId);
    const pct = Math.floor((traveling.progress || 0) * 100);
    action = `
      <div class="map-dock-travel">
        <span class="map-dock-kicker">${tx("travelInProgress")}</span>
        <strong>${esc(locationText(dest, "name"))}</strong>
        <span class="pill" data-map-progress>${pct}%</span>
        <button class="secondary" onclick="FE.cancelTravel()">${tx("cancelTravel")}</button>
      </div>
    `;
  }else if(isHere){
    action = `<button class="secondary" onclick="FE.show('home')">${tx("backToLocation")}</button>`;
  }else if(lockReason){
    action = `<button class="primary" disabled title="${esc(lockReason)}">${tx("locked")}</button>`;
  }else if(connected){
    action = `<button class="primary" onclick="FE.travelToLocation('${selected.id}')">${tx("travelTo")} ${esc(locationText(selected,"name"))}</button>`;
  }else{
    action = "";
  }
  const previousId = state.world.previousLocationId;
  const returnBtn = !traveling && isHere && previousId && previousId !== current.id && WORLD_LOCATIONS[previousId]
    ? `<button class="secondary" onclick="FE.returnToPreviousLocation()">${tx("returnTo")} ${esc(locationText(previousId,"name"))}</button>`
    : "";
  const reason = !isHere && lockReason
    ? `<p class="map-dock-lock">${esc(lockReason)}</p>`
    : !isHere && !connected
      ? `<p class="map-dock-lock">${tx("distantPlaceHint")}</p>`
      : "";
  return `
    <aside class="map-dock">
      <p class="map-dock-help">${tx("tapPlaceToInspect")}</p>
      <div class="map-dock-card">
        <div class="map-dock-head">
          <span class="map-status-stamp ${stampClass}">${stamp}</span>
          <h2>${esc(locationText(selected,"name"))}</h2>
        </div>
        <span class="pill ${danger >= 3 ? "warn" : "good"}">${tx("danger")} ${danger}</span>
        <p class="map-dock-desc">${esc(locationText(selected,"desc"))}</p>
        ${reason}
        <div class="map-dock-actions">${action}${returnBtn}</div>
      </div>
      ${traveling ? roadStopPanelHTML(traveling) : `
        <div class="map-dock-roads">
          <span class="map-dock-kicker">${tx("roadsFromHere")}</span>
          <div class="map-road-chips">
            ${roads.length ? roads.map(loc=>{
              const locked = routeLockReason(loc);
              return `<button type="button" class="map-road-chip ${loc.id === selected.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}" onclick="FE.selectMapLocation('${loc.id}')">
                <strong>${esc(locationText(loc,"name"))}</strong>
                <small>${locked ? tx("legendLocked") : tx("legendOpenRoad")}</small>
              </button>`;
            }).join("") : `<p class="map-dock-lock">${tx("noRoadFromHere")}</p>`}
          </div>
        </div>
      `}
    </aside>
  `;
}

function bindMapViewport(){
  const viewport = document.querySelector("[data-map-viewport]");
  const stage = document.querySelector("[data-map-stage]");
  if(!viewport || !stage)return;
  applyMapCamera();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = false;
  const start = event=>{
    if(event.pointerType === "mouse" && event.button !== 0)return;
    if(event.target.closest("button, .overworld-node, .map-zoom-bar, .map-travel-slim, .map-you-chip, .map-key"))return;
    dragging = true;
    moved = false;
    mapPointerMoved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture?.(event.pointerId);
  };
  const move = event=>{
    if(!dragging)return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if(Math.abs(dx) + Math.abs(dy) < 8 && !moved)return;
    moved = true;
    mapPointerMoved = true;
    mapCamera.userPanned = true;
    lastX = event.clientX;
    lastY = event.clientY;
    const rect = viewport.getBoundingClientRect();
    const mapW = rect.width;
    const mapH = rect.width * 9 / 16;
    mapCamera.x -= (dx / (mapW * mapCamera.scale)) * 100;
    mapCamera.y -= (dy / (mapH * mapCamera.scale)) * 100;
    mapCamera.x = Math.max(-8, Math.min(108, mapCamera.x));
    mapCamera.y = Math.max(-8, Math.min(108, mapCamera.y));
    applyMapCamera();
  };
  const end = ()=>{
    dragging = false;
    setTimeout(()=>{ mapPointerMoved = false; }, 0);
  };
  viewport.addEventListener("pointerdown", start);
  viewport.addEventListener("pointermove", move);
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", end);
  viewport.addEventListener("wheel", event=>{
    event.preventDefault();
    zoomWorldMap(event.deltaY < 0 ? 1 : -1);
  }, {passive:false});
}

function applyMapCamera(){
  const viewport = document.querySelector("[data-map-viewport]");
  const stage = document.querySelector("[data-map-stage]");
  if(!viewport || !stage)return;
  const rect = viewport.getBoundingClientRect();
  const scale = mapCamera.scale;
  const mapW = rect.width || 1;
  const mapH = mapW * 9 / 16;
  const panX = rect.width / 2 - (mapCamera.x / 100) * mapW * scale;
  const panY = rect.height / 2 - (mapCamera.y / 100) * mapH * scale;
  stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function roadStopPanelHTML(journey){
  if(!journey || (journey.status !== "atRoadStop" && journey.status !== "encounter"))return "";
  const allNodes = getMapNodes(WORLD_LOCATIONS);
  const node = allNodes[journey.currentRoadNodeId];
  const destination = locationById(journey.destinationLocationId);
  const totalStops = Math.max(1, journey.routeNodeIds.length - 1);
  const currentStop = Math.min(totalStops, Math.max(0, journey.currentIndex));
  const danger = routeStopDanger(journey.currentRoadNodeId, allNodes);
  const canContinue = journey.status === "atRoadStop" && !!journey.nextRoadNodeId;
  const canTurnBack = journey.status === "atRoadStop" && journey.currentIndex > 0;
  travelDebug("road stop map panel rendered", {continueState:journeyContinueState(journey), turnBackState:journeyTurnBackState(journey), canContinue, canTurnBack});
  const body = journey.stopMessage || roadStopDescription(journey.currentRoadNodeId);
  return `
    <div class="panel road-stop-panel">
      <div class="road-stop-head">
        <div>
          <h2>${tx("currentRoadStop")}: ${esc(nodeName(node))}</h2>
          <p>${esc(body)}</p>
        </div>
        <span class="pill ${danger >= 3 ? "warn" : "good"}">${tx("danger")} ${danger}</span>
      </div>
      <div class="road-stop-meta">
        <span class="pill">${tx("destination")}: ${esc(locationText(destination,"name"))}</span>
        <span class="pill">${tx("journeyProgress")}: ${currentStop} / ${totalStops}</span>
        <span class="pill">${tx("roadCondition")}: ${esc(nodeText(node,"condition") || tx("roadConditionUncertain"))}</span>
      </div>
      <div class="grid3">
        <button class="primary" ${canContinue ? `onclick="FE.continueJourney()"` : "disabled"}>${tx("continueJourney")}</button>
        <button ${journey.status === "atRoadStop" ? `onclick="FE.inspectRoadStop()"` : "disabled"}>${tx("inspectArea")}</button>
        <button class="secondary" ${canTurnBack ? `onclick="FE.turnBackJourney()"` : `disabled title="${esc(tx("turnBackDisabled"))}"`}>${tx("turnBack")}</button>
      </div>
    </div>
  `;
}

function mapRouteHTML(loc){
  const lockReason = routeLockReason(loc);
  const disabled = activeTravel || lockReason ? `disabled ${lockReason ? `title="${esc(lockReason)}"` : ""}` : "";
  const tier = loc.danger >= 4 ? "extreme" : loc.danger >= 3 ? "high" : loc.danger >= 2 ? "mid" : loc.danger >= 1 ? "low" : "safe";
  return `
    <div class="card map-route-card danger-tier-${tier}">
      <div class="map-route-card-head">
        <h2>${esc(locationText(loc,"name"))}</h2>
        <span class="pill ${loc.danger >= 3 ? "warn" : "good"}">${tx("danger")} ${loc.danger}</span>
      </div>
      <div class="map-route-danger-meter" aria-hidden="true">
        ${Array.from({length:5}, (_,index)=>`<span class="${index < loc.danger ? "is-on" : ""}"></span>`).join("")}
      </div>
      <p>${esc(locationText(loc,"desc"))}</p>
      <div class="map-route-card-meta">
        <span class="pill">${tx("services")}: ${locationServices(loc.id).length || 0}</span>
      </div>
      <button class="primary" ${disabled} onclick="FE.travelToLocation('${loc.id}')">${lockReason ? tx("locked") : tx("travelTo")} ${esc(locationText(loc,"name"))}</button>
    </div>
  `;
}

export function renderWorldKingdoms(){
  const loc = ensureWorld();
  const place = getCurrentPlaceContext();
  byId("kingdoms").innerHTML = `
    <div class="panel">
      <h1>${tx("kingdoms")}</h1>
      <p>${tx("kingdomWorldBody")}</p>
      <span class="pill">${place.type === "roadStop" ? tx("currentRoadStop") : tx("currentLocation")}: ${esc(place.name)}</span>
      <span class="pill">${esc(regionText(REGIONS[loc.region],"name"))}</span>
    </div>
    <div class="grid">
      ${state.kingdoms.map((k,i)=>kingdomHTML(k,i)).join("")}
    </div>
  `;
}

function kingdomHTML(k,index){
  const region = REGIONS[index] || REGIONS[0];
  const regionLocation = LOCATION_ORDER.map(locationById).find(loc=>loc.region === index) || WORLD_LOCATIONS.ashen_keep;
  return `
    <div class="card">
      <h2>${esc(k.name)}</h2>
      <span class="pill">${esc(k.status)}</span>
      <span class="pill">${esc(regionText(region,"name"))}</span>
      <p>${tx("kingdomLocation")}: ${esc(locationText(regionLocation,"name"))}</p>
      <p>King: ${esc(k.king.name)} Lv ${k.king.level}</p>
      <p>Capital soldiers ${k.capital.soldiers} | Forts ${k.forts.map(f=>f.soldiers).join(", ")} | Villages ${k.villages.map(v=>v.soldiers).join(", ")}</p>
      <button onclick="FE.enlist('${k.id}')">Enlist</button>
      <button onclick="FE.attackSettlement('${k.id}','capital')">Attack Capital</button>
    </div>
  `;
}

export function enlist(id){
  const kingdom = state.kingdoms.find(k=>k.id===id);
  if(!kingdom)return;
  state.hero.commander.kingdom = id;
  state.world.story.push(`You enlisted with ${kingdom.name}.`);
  save();
  renderWorldKingdoms();
}

export function attackSettlement(id,type){
  const k = state.kingdoms.find(x=>x.id===id);
  if(!k)return;
  const count = type==="capital" ? 8 : 5;
  const enemies = Array.from({length:count},(_,i)=>({
    name:i===0?k.king.name:"Kingdom Defender",role:i===0?"king":"soldier",level:i===0?k.king.level:55,
    hp:i===0?900:220,maxHp:i===0?900:220,attack:i===0?60:32,defense:i===0?34:18,speed:i===0?12:8,xp:i===0?600:120,gold:i===0?300:40
  }));
  startBattle(enemies,`You attack ${k.name}'s ${type}.`, {locationId: state.world.locationId});
}

function showWorldHome(){
  setScreen("home");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("home")?.classList.add("active");
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.screen === "home");
  });
  updateTop();
  renderWorldHome();
}

function showWorldMap(){
  setScreen("map");
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  byId("map")?.classList.add("active");
  document.querySelectorAll(".topline button[data-screen]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.screen === "map");
  });
  updateTop();
  renderWorldMap();
}
