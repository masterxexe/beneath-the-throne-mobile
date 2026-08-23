const EVENTS = {
  tavern: ["quiet_tavern", "bar_fight", "rare_companion", "suspicious_stranger"],
  market: ["market_thief", "rare_trader", "food_shortage", "tax_collector"],
  inn: ["restful_night", "overheard_rumor", "wounded_traveler", "uneasy_dream"],
  blacksmith: ["ore_shortage", "master_smith", "cursed_blade_rumor"],
  townCenter: ["public_notice", "refugee_arrival", "guard_search"]
};

const EVENT_COPY = {
  quiet_tavern: "The room is subdued, but every table has a story.",
  bar_fight: "A shove near the back table threatens to become a real fight.",
  rare_companion: "A capable traveler keeps to the corner, watching for worthy company.",
  suspicious_stranger: "Someone in a hood looks away whenever you look back.",
  market_thief: "A cutpurse prowls the busiest lane.",
  rare_trader: "A traveling trader has opened a guarded chest of unusual goods.",
  food_shortage: "Food stalls are tense. Prices climb with every wagon that fails to arrive.",
  tax_collector: "A faction tax collector counts coin with armed help nearby.",
  restful_night: "For once, the fire sounds kinder than the road.",
  overheard_rumor: "Travelers trade rumors in careful voices.",
  wounded_traveler: "A wounded traveler clutches a blood-dark bandage.",
  uneasy_dream: "Sleep here carries strange dreams.",
  ore_shortage: "The smith is short on decent ore.",
  master_smith: "A master smith has stopped here to inspect the forge.",
  cursed_blade_rumor: "The forge talk turns to a blade no one wants to touch.",
  public_notice: "Fresh notices are nailed over older warnings.",
  refugee_arrival: "Refugees gather in the square, exhausted and watchful.",
  guard_search: "Guards search faces in the square."
};

function hash(value){
  let h = 2166136261;
  for(const ch of String(value)){
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function ensureSceneStores(state){
  state.world ||= {};
  state.world.serviceSceneStates ||= {};
  state.world.dailyLocationEvents ||= {};
  state.world.serviceUpgradeStates ||= {};
}

export function serviceSceneKey({locationId, service, day}){
  return `${locationId || "unknown"}:${service || "townCenter"}:${day || 1}`;
}

export function resolveDailyServiceEvent({state, location, service}){
  ensureSceneStores(state);
  const key = serviceSceneKey({locationId: location?.id, service, day: state.world.day});
  if(state.world.dailyLocationEvents[key])return eventDetails(state.world.dailyLocationEvents[key]);
  const pool = EVENTS[service] || EVENTS.townCenter;
  const index = hash(`${key}:${location?.danger || 0}`) % pool.length;
  const id = pool[index];
  state.world.dailyLocationEvents[key] = id;
  return eventDetails(id);
}

export function eventDetails(id){
  return {id, text: EVENT_COPY[id] || "Something waits beneath the surface of the room."};
}

export function setServiceEvent(state, locationId, service, eventId){
  ensureSceneStores(state);
  const key = serviceSceneKey({locationId, service, day: state.world.day});
  state.world.dailyLocationEvents[key] = eventId;
}

export function clearServiceEvents(state){
  ensureSceneStores(state);
  state.world.dailyLocationEvents = {};
}

export function setServiceUpgrade(state, locationId, service, upgradeState){
  ensureSceneStores(state);
  const key = `${locationId || "unknown"}:${service || "townCenter"}`;
  state.world.serviceUpgradeStates[key] = upgradeState || "basic";
}

export function serviceUpgradeState(state, locationId, service){
  ensureSceneStores(state);
  return state.world.serviceUpgradeStates[`${locationId || "unknown"}:${service || "townCenter"}`] || "basic";
}
