import { tx } from "./language.js";
import { routeAngle, routePoint } from "./routePaths.js";

const ENTITY_TYPES = {
  caravan: {
    labelKey: "mapEntityCaravan",
    className: "map-entity-caravan",
    speed: 0.005,
    pauseMin: 2,
    pauseMax: 5,
    behavior: "safeTownRoutes",
    starts: ["ashen_keep", "market_town"]
  },
  patrol: {
    labelKey: "mapEntityPatrol",
    className: "map-entity-patrol",
    speed: 0.0065,
    pauseMin: 1,
    pauseMax: 4,
    behavior: "roadPatrol",
    starts: ["ashen_keep", "old_road", "market_town"]
  },
  monster: {
    labelKey: "mapEntityMonster",
    className: "map-entity-monster",
    speed: 0.004,
    pauseMin: 0,
    pauseMax: 3,
    behavior: "wilderness",
    starts: ["ashen_fields", "forest_edge", "ruined_watchtower"]
  },
  adventurer: {
    labelKey: "mapEntityAdventurer",
    className: "map-entity-adventurer",
    speed: 0.0055,
    pauseMin: 1,
    pauseMax: 3,
    behavior: "landmarks",
    starts: ["old_road", "forest_edge"]
  }
};

const EVENT_TYPES = {
  campfire: {
    labelKey: "mapEventCampfire",
    className: "map-event-campfire",
    anchor: {type: "route", from: "old_road", to: "forest_edge", t: 0.46, offsetX: -2, offsetY: 4},
    duration: 34
  },
  crashedCaravan: {
    labelKey: "mapEventCrashedCaravan",
    className: "map-event-crashed-caravan",
    anchor: {type: "route", from: "old_road", to: "market_town", t: 0.55, offsetX: 2, offsetY: 3},
    duration: 42
  },
  strangeGlow: {
    labelKey: "mapEventStrangeGlow",
    className: "map-event-strange-glow",
    anchor: {type: "location", id: "ruined_watchtower", offsetX: 5, offsetY: -4},
    duration: 38
  },
  burningVillage: {
    labelKey: "mapEventBurningVillage",
    className: "map-event-burning-village",
    anchor: {type: "location", id: "ashen_fields", offsetX: -5, offsetY: 5},
    duration: 30
  },
  monsterNest: {
    labelKey: "mapEventMonsterNest",
    className: "map-event-monster-nest",
    anchor: {type: "location", id: "forest_edge", offsetX: -4, offsetY: 6},
    duration: 40
  },
  travelingMerchant: {
    labelKey: "mapEventTravelingMerchant",
    className: "map-event-traveling-merchant",
    anchor: {type: "route", from: "ashen_keep", to: "market_town", t: 0.42, offsetX: 0, offsetY: -4},
    duration: 32
  }
};

const STARTING_ENTITIES = [
  {id: "ambient_caravan_1", type: "caravan", currentNodeId: "ashen_keep", destinationNodeId: "market_town", progress: 0.18, phase: .1},
  {id: "ambient_patrol_1", type: "patrol", currentNodeId: "ashen_keep", destinationNodeId: "old_road", progress: 0.62, phase: .58},
  {id: "ambient_monster_1", type: "monster", currentNodeId: "forest_edge", destinationNodeId: "ruined_watchtower", progress: 0.34, phase: .86}
];

const STARTING_EVENTS = ["campfire", "crashedCaravan", "strangeGlow"];
const TICK_MS = 450;

let activity = null;
let loopId = null;
let worldLocations = null;

export function startMapActivityLoop(locations){
  worldLocations = locations || worldLocations;
  ensureMapActivity(worldLocations);
  if(loopId)return;
  loopId = setInterval(()=>tickMapActivity(), TICK_MS);
}

export function stopMapActivityLoop(){
  if(loopId)clearInterval(loopId);
  loopId = null;
}

export function ensureMapActivity(locations){
  worldLocations = locations || worldLocations;
  if(activity || !worldLocations)return activity;
  activity = {
    tick: 0,
    actorStateVersion: 2,
    entities: STARTING_ENTITIES.map(seed=>makeEntity(seed)),
    events: STARTING_EVENTS.map((type,index)=>makeEvent(type,index * 6))
  };
  return activity;
}

export function mapMoodForContext(current, traveling){
  if(traveling){
    if(traveling.status === "atRoadStop")return traveling.danger >= 3 ? "storm" : "ash";
    const destination = worldLocations?.[traveling.destinationLocationId];
    if(destination)return mapMoodForContext(destination, null);
  }
  const location = current;
  if(!location){
    return "mist";
  }
  if(location.id?.includes("slum") || location.scene?.includes("slum"))return "ember";
  if(location.id?.includes("ward") || location.scene?.includes("ward"))return "gold";
  if(location.id?.includes("keep") || location.id?.includes("castle"))return "ash";
  const scene = location.scene || "";
  if(scene.includes("forest") || scene.includes("ruins"))return "fog";
  if(scene.includes("ashen") || location.id?.includes("ruin"))return "ash";
  if(location.danger >= 3)return "storm";
  return "mist";
}

export function renderMapActivityHTML({locations, currentId, traveling}){
  const current = ensureMapActivity(locations);
  if(!current)return "";
  const mood = mapMoodForContext(locations?.[currentId], traveling);
  return `
    <div class="map-activity-layer map-mood-${mood}" aria-label="${tx("mapActivity")}">
      <div class="map-static-atmosphere">${ambientHTML(locations)}</div>
      <div class="map-events">${current.events.map(event=>eventHTML(event,locations)).join("")}</div>
      <div class="map-entities">${current.entities.map(entity=>entityHTML(entity,locations)).join("")}</div>
    </div>
  `;
}

function tickMapActivity(){
  if(!activity || !worldLocations)return;
  const previousEvents = activity.events.map(event=>event.id).join("|");
  activity.tick++;
  activity.entities.forEach(entity=>updateEntity(entity,worldLocations));
  updateEvents(activity,worldLocations);
  const layer = document.querySelector(".overworld-map .map-activity-layer");
  if(!layer)return;
  const eventsLayer = layer.querySelector(".map-events");
  const entitiesLayer = layer.querySelector(".map-entities");
  const nextEvents = activity.events.map(event=>event.id).join("|");
  if(previousEvents !== nextEvents && eventsLayer){
    eventsLayer.innerHTML = eventsHTML(activity, worldLocations);
  }
  if(!entitiesLayer)return;
  if(entitiesLayer.querySelectorAll(".map-entity").length !== activity.entities.length){
    entitiesLayer.innerHTML = entitiesHTML(activity, worldLocations);
    return;
  }
  activity.entities.forEach(entity=>updateEntityElement(entity, worldLocations, entitiesLayer));
}

function makeEntity(seed){
  const type = ENTITY_TYPES[seed.type] || ENTITY_TYPES.patrol;
  const currentNodeId = seed.currentNodeId || seed.from || type.starts[0];
  const destinationNodeId = seed.destinationNodeId || seed.to || currentNodeId;
  const progress = clamp(Number(seed.progress) || 0, 0, .98);
  return {
    id: seed.id,
    type: seed.type,
    currentNodeId,
    destinationNodeId,
    previousNodeId: seed.previousNodeId || null,
    progress,
    direction: 1,
    pauseTicks: Number(seed.pauseTicks) || 0,
    state: "traveling",
    speedScale: seed.speedScale || (0.82 + Math.random() * 0.36),
    phase: seed.phase ?? Math.random(),
    arrivalCount: 0
  };
}

function updateEntity(entity,locations){
  const type = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  if(!locations[entity.currentNodeId] || !locations[entity.destinationNodeId]){
    resetEntityRoute(entity, locations);
    return;
  }
  if(entity.pauseTicks > 0){
    entity.pauseTicks--;
    entity.state = "paused";
    return;
  }
  if(entity.state === "paused" || entity.progress >= 1){
    beginNextRoute(entity, locations);
    return;
  }
  entity.state = "traveling";
  const pace = type.speed * entity.speedScale * (0.92 + Math.sin((activity.tick + entity.phase * 10) * .27) * .08);
  entity.progress = clamp(entity.progress + pace, 0, 1);
  if(entity.progress < 1)return;
  arriveAtDestination(entity, locations);
}

function arriveAtDestination(entity, locations){
  const type = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  entity.previousNodeId = entity.currentNodeId;
  entity.currentNodeId = entity.destinationNodeId;
  entity.progress = 1;
  entity.state = "paused";
  entity.arrivalCount++;
  const location = locations[entity.currentNodeId];
  const servicePause = hasServices(location) ? 2 : 0;
  entity.pauseTicks = randomInt(type.pauseMin, type.pauseMax) + servicePause;
}

function beginNextRoute(entity, locations){
  const next = chooseNextDestination(entity, entity.currentNodeId, locations);
  entity.destinationNodeId = next;
  entity.progress = 0;
  entity.direction = 1;
  entity.state = "traveling";
  entity.speedScale = 0.82 + Math.random() * 0.36;
}

function resetEntityRoute(entity, locations){
  const type = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  const starts = type.starts.filter(id=>locations[id]);
  entity.currentNodeId = starts[0] || Object.keys(locations)[0];
  entity.previousNodeId = null;
  entity.destinationNodeId = chooseNextDestination(entity, entity.currentNodeId, locations);
  entity.progress = 0;
  entity.pauseTicks = randomInt(type.pauseMin, type.pauseMax);
  entity.state = "paused";
}

function chooseNextDestination(entity, fromId, locations){
  const type = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  const from = locations[fromId];
  if(!from)return entity.currentNodeId;
  if(type.behavior === "safeTownRoutes"){
    const townRoutes = from.routes.filter(id=>locations[id] && hasServices(locations[id]));
    if(townRoutes.length)return townRoutes[randomInt(0,townRoutes.length - 1)];
  }
  const routeIds = from.routes.filter(id=>locations[id] && id !== entity.previousNodeId);
  const options = routeIds.filter(id=>routeAllowed(type.behavior, locations[id], from, locations));
  const pool = options.length ? options : routeIds.length ? routeIds : from.routes.filter(id=>locations[id]).length ? from.routes.filter(id=>locations[id]) : [entity.previousNodeId || entity.currentNodeId];
  return pool[randomInt(0,pool.length - 1)];
}

function routeAllowed(behavior,destination,from,locations){
  if(behavior === "safeTownRoutes"){
    return hasServices(destination) || destination.danger <= 2;
  }
  if(behavior === "roadPatrol"){
    return destination.danger <= 2 || hasServices(destination) || from.danger <= 1;
  }
  if(behavior === "wilderness"){
    return !hasServices(destination) && destination.danger >= 2;
  }
  if(behavior === "landmarks"){
    return destination.danger <= 4;
  }
  return true;
}

function hasServices(location){
  return (location.services || []).length > 0;
}

function updateEvents(current,locations){
  current.events = current.events.filter(event=>event.expiresAt > current.tick);
  const maxEvents = 3;
  while(current.events.length < maxEvents){
    const type = chooseEventType(current.events.map(event=>event.type));
    current.events.push(makeEvent(type,0));
  }
}

function chooseEventType(activeTypes){
  const types = Object.keys(EVENT_TYPES).filter(type=>!activeTypes.includes(type));
  const pool = types.length ? types : Object.keys(EVENT_TYPES);
  return pool[randomInt(0,pool.length - 1)];
}

function makeEvent(type,delay=0){
  const def = EVENT_TYPES[type] || EVENT_TYPES.campfire;
  return {
    id: `map_event_${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    expiresAt: (activity?.tick || 0) + def.duration + delay
  };
}

function entityHTML(entity,locations){
  const def = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  const point = entityPoint(entity, locations);
  const angle = entityAngle(entity, locations);
  const orientation = entityOrientation(angle);
  const label = tx(def.labelKey);
  return `
    <span class="map-entity ${def.className} ${entity.pauseTicks ? "is-paused" : ""}"
      data-activity-id="${esc(entity.id)}"
      title="${esc(label)}"
      aria-label="${esc(label)}"
      style="--activity-x:${point.x}%;--activity-y:${point.y}%;--entity-angle:${angle}deg;--entity-heading:${orientation.heading}deg;--entity-flip:${orientation.flip}">
      <span class="entity-shadow"></span>
      <span class="entity-dust"></span>
      <span class="entity-glow"></span>
      <span class="entity-glyph"></span>
    </span>
  `;
}

function updateEntityElement(entity, locations, layer){
  const element = layer.querySelector(`[data-activity-id="${cssEscape(entity.id)}"]`);
  if(!element){
    layer.innerHTML = entitiesHTML(activity, worldLocations);
    return;
  }
  const def = ENTITY_TYPES[entity.type] || ENTITY_TYPES.patrol;
  const point = entityPoint(entity, locations);
  const angle = entityAngle(entity, locations);
  const orientation = entityOrientation(angle);
  element.style.setProperty("--activity-x", `${point.x}%`);
  element.style.setProperty("--activity-y", `${point.y}%`);
  element.style.setProperty("--entity-angle", `${angle}deg`);
  element.style.setProperty("--entity-heading", `${orientation.heading}deg`);
  element.style.setProperty("--entity-flip", orientation.flip);
  element.className = `map-entity ${def.className} ${entity.pauseTicks ? "is-paused" : ""}`;
}

function eventsHTML(current, locations){
  return current.events.map(event=>eventHTML(event,locations)).join("");
}

function entitiesHTML(current, locations){
  return current.entities.map(entity=>entityHTML(entity,locations)).join("");
}

function eventHTML(event,locations){
  const def = EVENT_TYPES[event.type] || EVENT_TYPES.campfire;
  const point = eventPoint(def,locations);
  const label = tx(def.labelKey);
  return `
    <span class="map-event ${def.className}"
      title="${esc(label)}"
      aria-label="${esc(label)}"
      style="--activity-x:${point.x}%;--activity-y:${point.y}%">
      <span class="event-glow"></span>
      <span class="event-glyph"></span>
    </span>
  `;
}

function ambientHTML(locations){
  const weather = weatherZoneHTML(locations);
  const lights = Object.values(locations || {})
    .filter(location=>hasServices(location))
    .map(location=>`<span class="map-town-light" style="--activity-x:${location.x}%;--activity-y:${location.y}%"></span>`)
    .join("");
  return `
    <span class="map-atmosphere map-mist map-mist-a"></span>
    <span class="map-atmosphere map-mist map-mist-b"></span>
    <span class="map-atmosphere map-rain map-rain-global"></span>
    <span class="map-atmosphere map-ash map-ash-global"></span>
    <span class="map-cloud map-cloud-a"></span>
    <span class="map-cloud map-cloud-b"></span>
    ${weather}
    <span class="map-bird map-bird-a"></span>
    <span class="map-bird map-bird-b"></span>
    ${lights}
  `;
}

function weatherZoneHTML(locations){
  return Object.values(locations || {}).map(location=>{
    const kind = weatherForLocation(location);
    if(!kind)return "";
    const size = kind === "rain" ? 30 : kind === "ash" ? 26 : 24;
    return `<span class="map-weather-zone map-weather-${kind}" style="--activity-x:${location.x}%;--activity-y:${location.y}%;--weather-size:${size}%"></span>`;
  }).join("");
}

function weatherForLocation(location){
  if(hasServices(location) && location.danger <= 1)return "";
  const scene = location.scene || "";
  if(scene.includes("forest") || scene.includes("ruins"))return "fog";
  if(scene.includes("ashen") || location.id?.includes("ruin"))return "ash";
  if(location.danger >= 3)return "rain";
  return "";
}

function eventPoint(def,locations){
  const anchor = def.anchor;
  if(anchor.type === "route"){
    const point = routePoint(anchor.from, anchor.to, anchor.t, locations);
    return {x: point.x + (anchor.offsetX || 0), y: point.y + (anchor.offsetY || 0)};
  }
  const location = locations[anchor.id];
  return {x: (location?.x || 50) + (anchor.offsetX || 0), y: (location?.y || 50) + (anchor.offsetY || 0)};
}

function entityPoint(entity, locations){
  const from = locations[entity.currentNodeId];
  if(entity.state === "paused" || entity.progress >= 1)return {x: from?.x || 50, y: from?.y || 50};
  return routePoint(entity.currentNodeId, entity.destinationNodeId, easeTravel(entity.progress), locations);
}

function entityAngle(entity, locations){
  const from = locations[entity.currentNodeId];
  if(entity.state === "paused" || entity.progress >= 1){
    return routeAngle(entity.previousNodeId || entity.currentNodeId, entity.currentNodeId, .98, locations);
  }
  return routeAngle(entity.currentNodeId, entity.destinationNodeId, easeTravel(entity.progress), locations);
}

function entityOrientation(angle){
  if(angle > 90)return {heading: angle - 180, flip: -1};
  if(angle < -90)return {heading: angle + 180, flip: -1};
  return {heading: angle, flip: 1};
}

function easeTravel(t){
  return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function clamp(value,min,max){
  return Math.max(min, Math.min(max, value));
}

function randomInt(min,max){
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function cssEscape(value){
  if(typeof CSS !== "undefined" && CSS.escape)return CSS.escape(value);
  return esc(value).replace(/\\/g,"\\\\").replace(/"/g,'\\"');
}
