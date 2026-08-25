const GEAR_ITEM_FIELDS = [
  ["id", "id", "string"],
  ["name", "name", "string"],
  ["slot", "slot", "string"],
  ["level", "level", "number"],
  ["attack", "attack", "number"],
  ["defense", "defense", "number"],
  ["value", "value", "number"],
  ["quality", "quality", "string"],
  ["upgrade_level", "upgradeLevel", "number"]
];

const ATTRIBUTE_KEYS = ["strength", "endurance", "speed", "wisdom", "luck"];
const RESISTANCE_KEYS = ["fire", "frost", "poison", "shadow", "lightning"];

function numberValue(value){
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value){
  if(value === null || value === undefined || value === "")return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringValue(value){
  return typeof value === "string" ? value : "";
}

function nullableString(value){
  return typeof value === "string" && value ? value : null;
}

function copyNumberRecord(source, keys){
  return Object.fromEntries(keys.map(key=>[key,numberValue(source?.[key])]));
}

function copyGearItem(item,getWeaponType){
  if(!item || typeof item !== "object")return null;
  const copy = {};
  for(const [outputKey,sourceKey,type] of GEAR_ITEM_FIELDS){
    const value = item[sourceKey];
    if(type === "number")copy[outputKey] = numberValue(value);
    else if(typeof value === "string" && value)copy[outputKey] = value;
    else copy[outputKey] = null;
  }
  const resolvedWeaponType = item.slot === "weapon" ? safeCall(()=>getWeaponType(item),null) : null;
  const weaponCategory = nullableString(resolvedWeaponType) || item.weaponCategory;
  copy.weapon_category = nullableString(weaponCategory);
  return copy;
}

function noActiveGame(){
  return {
    ok:false,
    error:{
      code:"no_active_game",
      message:"Start a new game or load a save before using this tool."
    }
  };
}

function safeCall(callback,fallback){
  try{
    const value = callback();
    return value === undefined ? fallback : value;
  }catch{
    return fallback;
  }
}

function emptyInputSchema(){
  return {type:"object",properties:{},additionalProperties:false};
}

function readOnlyTool(name,title,description,execute){
  return {
    name,
    title,
    description,
    inputSchema:emptyInputSchema(),
    annotations:{readOnlyHint:true,untrustedContentHint:true},
    execute
  };
}

export function createWebMcpTools({
  getState = ()=>null,
  getCurrentScreen = ()=>null,
  getTotalAttack = ()=>null,
  getTotalDefense = ()=>null,
  getWeaponType = ()=>null,
  getCurrentPlaceContext = ()=>null,
  gearSlots = []
} = {}){
  const slots = [...gearSlots];

  return [
    readOnlyTool(
      "get_player_status",
      "Get player status",
      "Return the live hero's identity, progression, health, mana, combat totals, attributes, currency, companion counts, and current UI screen.",
      ()=>{
        const gameState = safeCall(getState,null);
        const hero = gameState?.hero;
        if(!hero)return noActiveGame();
        const companions = Array.isArray(hero.companions) ? hero.companions : [];
        return {
          ok:true,
          player:{
            name:stringValue(hero.name),
            class_id:nullableString(hero.class),
            advanced_class_id:nullableString(hero.advancedClass),
            level:numberValue(hero.level),
            experience:{
              current:numberValue(hero.xp),
              required_for_next_level:numberValue(hero.nextXp)
            },
            unspent_attribute_points:numberValue(hero.points),
            health:{current:numberValue(hero.hp),maximum:numberValue(hero.maxHp)},
            mana:{current:numberValue(hero.mana),maximum:numberValue(hero.maxMana)},
            combat:{
              total_attack:nullableNumber(safeCall(getTotalAttack,null)),
              total_defense:nullableNumber(safeCall(getTotalDefense,null)),
              base_attack:numberValue(hero.attack),
              base_defense:numberValue(hero.defense)
            },
            attributes:copyNumberRecord(hero.stats,ATTRIBUTE_KEYS),
            elemental_resistances:copyNumberRecord(hero.resists,RESISTANCE_KEYS),
            currency:{gold:numberValue(hero.gold)},
            companions:{
              total:companions.length,
              active:companions.filter(companion=>companion?.active).length
            }
          },
          ui:{current_screen:nullableString(safeCall(getCurrentScreen,null))}
        };
      }
    ),
    readOnlyTool(
      "get_inventory",
      "Get inventory",
      "Return a safe snapshot of unequipped gear, consumable counts, and carried resources from the live hero inventory.",
      ()=>{
        const hero = safeCall(getState,null)?.hero;
        if(!hero)return noActiveGame();
        const items = Array.isArray(hero.inv) ? hero.inv.map(item=>copyGearItem(item,getWeaponType)).filter(Boolean) : [];
        return {
          ok:true,
          inventory:{
            items,
            gear_item_count:items.length,
            consumables:{
              health_potion:{id:"health_potion",quantity:numberValue(hero.potions)},
              mana_potion:{id:"mana_potion",quantity:numberValue(hero.manaPotions)}
            },
            resources:{
              food:numberValue(hero.food),
              ore:numberValue(hero.ore)
            }
          }
        };
      }
    ),
    readOnlyTool(
      "get_equipment",
      "Get equipment",
      "Return a safe snapshot of every canonical equipment slot plus the game's derived attack and defense totals.",
      ()=>{
        const hero = safeCall(getState,null)?.hero;
        if(!hero)return noActiveGame();
        const equipment = Object.fromEntries(slots.map(slot=>[
          slot,
          copyGearItem(hero.gear?.[slot],getWeaponType)
        ]));
        return {
          ok:true,
          equipment:{
            slots:equipment,
            total_attack:nullableNumber(safeCall(getTotalAttack,null)),
            total_defense:nullableNumber(safeCall(getTotalDefense,null))
          }
        };
      }
    ),
    readOnlyTool(
      "get_current_location",
      "Get current location",
      "Return a safe snapshot of the hero's current major location or in-progress road stop, including journey progress when traveling.",
      ()=>{
        const gameState = safeCall(getState,null);
        if(!gameState?.hero)return noActiveGame();
        const place = safeCall(getCurrentPlaceContext,null);
        if(!place){
          return {
            ok:false,
            error:{code:"location_unavailable",message:"The current location could not be resolved."}
          };
        }
        const traveling = place.isTraveling === true;
        return {
          ok:true,
          location:{
            type:nullableString(place.type),
            id:nullableString(place.id),
            name:stringValue(place.name),
            description:stringValue(place.description),
            danger:numberValue(place.danger),
            services:Array.isArray(place.services) ? place.services.filter(service=>typeof service === "string") : [],
            is_traveling:traveling
          },
          previous_location_id:nullableString(gameState.world?.previousLocationId),
          journey:traveling ? {
            status:nullableString(place.status),
            origin_location_id:nullableString(gameState.world?.locationId),
            destination:place.journeyDestination ? {
              id:nullableString(place.journeyDestination.id),
              name:stringValue(place.journeyDestination.name)
            } : null,
            progress:place.journeyProgress ? {
              current:numberValue(place.journeyProgress.current),
              total:numberValue(place.journeyProgress.total)
            } : null,
            next_road_node_id:nullableString(place.nextRoadNodeId)
          } : null
        };
      }
    )
  ];
}

function findModelContext(){
  try{
    if(typeof document !== "undefined" && typeof document.modelContext?.registerTool === "function")return document.modelContext;
  }catch{}
  try{
    if(typeof navigator !== "undefined" && typeof navigator.modelContext?.registerTool === "function")return navigator.modelContext;
  }catch{}
  return null;
}

export async function initWebMcp(dependencies = {}){
  const modelContext = findModelContext();
  if(!modelContext)return {available:false,registered:[],failed:[]};

  const registered = [];
  const failed = [];
  for(const tool of createWebMcpTools(dependencies)){
    try{
      await modelContext.registerTool(tool);
      registered.push(tool.name);
    }catch(error){
      failed.push({name:tool.name,message:error instanceof Error ? error.message : String(error)});
    }
  }
  return {available:true,registered,failed};
}
