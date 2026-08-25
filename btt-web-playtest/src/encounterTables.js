export const TRAVEL_ENCOUNTER_FORCE_KEY = "fallenEmpireForceTravelEncounter";

export function forceNextTravelEncounter(type = "battle"){
  sessionStorage.setItem(TRAVEL_ENCOUNTER_FORCE_KEY, type);
}

export function rollTravelEncounter({danger = 0, segmentIndex = 0} = {}){
  const forced = readForcedEncounter();
  if(forced)return {type: forced, forced: true};
  if(danger <= 0 && Math.random() > .04)return {type:"nothing"};

  const battleChance = Math.min(.035 + danger * .055 + segmentIndex * .008, .36);
  const strangeChance = Math.min(.04 + danger * .025, .18);
  const merchantChance = Math.max(.015, .09 - danger * .012);
  const discoveryChance = Math.min(.035 + danger * .018, .14);
  const roll = Math.random();
  if(roll < battleChance)return {type:"battle"};
  if(roll < battleChance + strangeChance)return {type:"strange"};
  if(roll < battleChance + strangeChance + merchantChance)return {type:"merchant"};
  if(roll < battleChance + strangeChance + merchantChance + discoveryChance)return {type:"discovery"};
  return {type:"nothing"};
}

function readForcedEncounter(){
  try{
    const forced = sessionStorage.getItem(TRAVEL_ENCOUNTER_FORCE_KEY);
    if(forced)sessionStorage.removeItem(TRAVEL_ENCOUNTER_FORCE_KEY);
    return forced || "";
  }catch(e){
    return "";
  }
}
