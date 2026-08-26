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
const WEBMCP_TOOL_CAPABILITIES = [
  {name:"get_player_status",type:"read_only_tool",modifiesGameState:false},
  {name:"get_inventory",type:"read_only_tool",modifiesGameState:false},
  {name:"get_equipment",type:"read_only_tool",modifiesGameState:false},
  {name:"get_current_location",type:"read_only_tool",modifiesGameState:false},
  {name:"get_quest_log",type:"read_only_tool",modifiesGameState:false},
  {name:"get_available_actions",type:"read_only_tool",modifiesGameState:false},
  {name:"use_item",type:"mutation_tool",modifiesGameState:true},
  {name:"equip_item",type:"mutation_tool",modifiesGameState:true}
];
const WEBMCP_TOOL_NAMES = WEBMCP_TOOL_CAPABILITIES.map(tool=>tool.name);

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

function copyJsonValue(value,seen = new WeakSet(),depth = 0){
  if(value === null || typeof value === "string" || typeof value === "boolean")return value;
  if(typeof value === "number")return Number.isFinite(value) ? value : null;
  if(depth >= 12 || typeof value !== "object")return null;
  if(seen.has(value))return null;
  seen.add(value);
  if(Array.isArray(value)){
    const copy = value.map(item=>copyJsonValue(item,seen,depth + 1));
    seen.delete(value);
    return copy;
  }
  const copy = {};
  for(const [key,item] of Object.entries(value)){
    if(key === "__proto__" || key === "constructor" || typeof item === "function" || item === undefined)continue;
    copy[key] = copyJsonValue(item,seen,depth + 1);
  }
  seen.delete(value);
  return copy;
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

function mutationTool(name,title,description,inputSchema,execute,{destructive = false} = {}){
  return {
    name,
    title,
    description,
    inputSchema,
    annotations:{
      readOnlyHint:false,
      destructiveHint:destructive,
      idempotentHint:false,
      openWorldHint:false,
      untrustedContentHint:true
    },
    execute
  };
}

function itemInputSchema(allowedIds = null){
  const itemId = {type:"string",minLength:1};
  if(Array.isArray(allowedIds))itemId.enum = [...allowedIds];
  return {
    type:"object",
    properties:{item_id:itemId},
    required:["item_id"],
    additionalProperties:false
  };
}

function exactItemArgument(input){
  if(!input || typeof input !== "object" || Array.isArray(input)){
    return {ok:false,error:{code:"invalid_arguments",message:"Expected an object containing only item_id."}};
  }
  const keys = Object.keys(input);
  if(keys.length !== 1 || keys[0] !== "item_id"){
    return {ok:false,error:{code:"invalid_arguments",message:"Only the item_id field is accepted."}};
  }
  if(typeof input.item_id !== "string" || !input.item_id){
    return {ok:false,error:{code:"invalid_item_id",message:"item_id must be an exact non-empty string."}};
  }
  return {ok:true,itemId:input.item_id};
}

function mutationFailure(itemId,code,message,extra = {}){
  return {
    ok:false,
    accepted:false,
    success:false,
    item_id:typeof itemId === "string" ? itemId : null,
    ...copyJsonValue(extra),
    error:{code,message}
  };
}

function useItemFailure(itemId,code,message,extra = {}){
  return mutationFailure(itemId,code,message,{
    item_used:null,
    item_consumed:false,
    before:null,
    after:null,
    combat:null,
    combat_resolving:false,
    ...extra
  });
}

function equipItemFailure(itemId,code,message,extra = {}){
  return mutationFailure(itemId,code,message,{
    slot:null,
    previously_equipped:null,
    newly_equipped:null,
    previous_item_returned_to_inventory:null,
    derived_stats:{
      total_attack:derivedStatChange(null,null),
      total_defense:derivedStatChange(null,null)
    },
    ...extra
  });
}

function derivedStatChange(before,after){
  const beforeValue = nullableNumber(before);
  const afterValue = nullableNumber(after);
  return {
    before:beforeValue,
    after:afterValue,
    change:beforeValue === null || afterValue === null ? null : afterValue - beforeValue
  };
}

function validMutationSafetyContext(context){
  return !!context
    && typeof context === "object"
    && typeof context.combat_active === "boolean"
    && typeof context.blocking_interaction_open === "boolean";
}

function potionValueSnapshot(source){
  return {
    quantity:nullableNumber(source?.quantity),
    health:{
      current:nullableNumber(source?.health?.current),
      maximum:nullableNumber(source?.health?.maximum)
    },
    mana:{
      current:nullableNumber(source?.mana?.current),
      maximum:nullableNumber(source?.mana?.maximum)
    }
  };
}

function potionCombatSnapshot(source){
  if(!source || typeof source !== "object")return null;
  return {
    active:source.active === true,
    resolving:source.resolving === true,
    hero_action_locked:source.hero_action_locked === true,
    current_actor_side:nullableString(source.current_actor_side),
    current_actor_id:nullableString(source.current_actor_id)
  };
}

function projectPotionMutationResult(result,itemId){
  const accepted = result?.accepted === true;
  const success = accepted && result?.success === true && result?.ok === true;
  const errorCode = nullableString(result?.error?.code);
  const errorMessage = nullableString(result?.error?.message);
  return {
    ok:success,
    accepted,
    success,
    item_id:itemId,
    item_used:accepted && result?.item_used === itemId ? itemId : null,
    item_consumed:accepted && result?.item_consumed === true,
    before:potionValueSnapshot(result?.before),
    after:potionValueSnapshot(result?.after),
    combat_before:potionCombatSnapshot(result?.combat_before),
    combat:potionCombatSnapshot(result?.combat),
    combat_resolving:result?.combat_resolving === true,
    error:success ? null : {
      code:errorCode || "execution_not_confirmed",
      message:errorMessage || "The canonical potion action did not provide a verifiable result."
    }
  };
}

export function createWebMcpTools({
  getState = ()=>null,
  getCurrentScreen = ()=>null,
  getTotalAttack = ()=>null,
  getTotalDefense = ()=>null,
  getWeaponType = ()=>null,
  getCurrentPlaceContext = ()=>null,
  getLanguage = ()=>"en",
  getQuestLogSections = ()=>[],
  getUiInteractionContext = ()=>null,
  getActionSnapshots = ()=>[],
  getMutationSafetyContext = ()=>null,
  getSavedHero = ()=>null,
  executeUseItem = ()=>null,
  getEquipItemAvailability = ()=>null,
  equipItem = ()=>undefined,
  getRegisteredWebMcpTools = ()=>WEBMCP_TOOL_NAMES,
  gearSlots = []
} = {}){
  const slots = [...gearSlots];
  let observedInventoryHero = null;
  const observedInventoryItemIds = new Set();

  const syncObservedInventoryHero = hero=>{
    if(hero !== observedInventoryHero){
      observedInventoryHero = hero || null;
      observedInventoryItemIds.clear();
    }
  };

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
        syncObservedInventoryHero(hero);
        if(!hero)return noActiveGame();
        observedInventoryItemIds.clear();
        const items = Array.isArray(hero.inv) ? hero.inv.map(item=>copyGearItem(item,getWeaponType)).filter(Boolean) : [];
        items.forEach(item=>{
          if(typeof item.id === "string" && item.id)observedInventoryItemIds.add(item.id);
        });
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
    ),
    readOnlyTool(
      "get_quest_log",
      "Get quest log",
      "Return a safe combined projection of the existing Cinderhook contract and Lower Ward quest systems without creating or changing saved quest state.",
      ()=>{
        const gameState = safeCall(getState,null);
        if(!gameState?.hero)return noActiveGame();
        const sections = safeCall(getQuestLogSections,[]);
        return {
          ok:true,
          quest_log:{
            language:stringValue(safeCall(getLanguage,"en")) || "en",
            chapters:copyJsonValue(Array.isArray(sections) ? sections : []),
            recent_story:Array.isArray(gameState.world?.story) ? gameState.world.story.slice(-20).map(String) : []
          }
        };
      }
    ),
    readOnlyTool(
      "get_available_actions",
      "Get available actions",
      "Return registered WebMCP capabilities separately from valid gameplay actions that remain controlled exclusively by the player UI.",
      ()=>{
        const gameState = safeCall(getState,null);
        if(!gameState?.hero)return noActiveGame();
        const uiContext = safeCall(getUiInteractionContext,{}) || {};
        const snapshots = safeCall(getActionSnapshots,[]);
        const safeSnapshots = Array.isArray(snapshots) ? snapshots.filter(snapshot=>snapshot && typeof snapshot === "object") : [];
        const interactionLayer = uiContext.interaction_layer || "screen";
        const selectedSnapshots = interactionLayer === "combat"
          ? safeSnapshots.filter(snapshot=>snapshot.id === "combat" && snapshot.applicable !== false)
          : interactionLayer === "modal"
            ? []
            : safeSnapshots.filter(snapshot=>snapshot.id !== "combat" && snapshot.applicable !== false);
        const uiActions = selectedSnapshots.flatMap(snapshot=>Array.isArray(snapshot.actions) ? snapshot.actions : [])
          .filter(action=>action && typeof action === "object")
          .map(action=>({
            ...copyJsonValue(action),
            execution:"player_ui_only",
            webmcp_invocable:false,
            webmcp_tool:null
          }));
        const registered = safeCall(getRegisteredWebMcpTools,WEBMCP_TOOL_NAMES);
        const registeredSet = new Set(Array.isArray(registered) ? registered : []);
        const webmcpInvocable = WEBMCP_TOOL_CAPABILITIES
          .filter(tool=>registeredSet.has(tool.name))
          .map(tool=>({id:tool.name,type:tool.type,modifies_game_state:tool.modifiesGameState}));
        const worldContext = safeSnapshots.find(snapshot=>snapshot.id === "world")?.context || null;
        const combatContext = safeSnapshots.find(snapshot=>snapshot.id === "combat")?.context || null;
        return {
          ok:true,
          context:{
            ...copyJsonValue(uiContext),
            world:copyJsonValue(worldContext),
            combat:interactionLayer === "combat" ? copyJsonValue(combatContext) : null
          },
          actions:{
            webmcp_invocable:webmcpInvocable,
            player_ui_controlled:uiActions.filter(action=>action.enabled !== false),
            blocked_player_ui_actions:uiActions.filter(action=>action.enabled === false)
          },
          mutation_tools_enabled:webmcpInvocable.some(action=>action.modifies_game_state),
          note:interactionLayer === "modal"
            ? "A blocking dialog is open. Its choices remain player-controlled and are not exposed as WebMCP tools."
            : "Only the listed mutation tools can modify game state through WebMCP; all listed gameplay actions remain player-controlled."
        };
      }
    ),
    mutationTool(
      "use_item",
      "Use item",
      "Use exactly one supported combat potion through the game's canonical potion action and return a verified before/after result.",
      itemInputSchema(["health_potion","mana_potion"]),
      input=>{
        const gameState = safeCall(getState,null);
        if(!gameState?.hero)return useItemFailure(null,"no_active_game","Start a new game or load a save before using an item.");
        const argument = exactItemArgument(input);
        if(!argument.ok)return useItemFailure(null,argument.error.code,argument.error.message);
        if(argument.itemId !== "health_potion" && argument.itemId !== "mana_potion"){
          return useItemFailure(argument.itemId,"unsupported_item","Only health_potion and mana_potion are supported.");
        }
        const safetyContext = safeCall(getMutationSafetyContext,null);
        if(!validMutationSafetyContext(safetyContext)){
          return useItemFailure(argument.itemId,"safety_context_unavailable","The game could not verify whether this action is currently safe.");
        }
        let result;
        try{
          result = executeUseItem(argument.itemId,{
            blockingInteraction:safetyContext.blocking_interaction_open === true
          });
        }catch(error){
          return useItemFailure(argument.itemId,"execution_error",error instanceof Error ? error.message : String(error));
        }
        if(!result || typeof result !== "object"){
          return {
            ...useItemFailure(argument.itemId,"execution_not_confirmed","The canonical item action did not provide a verifiable result."),
            accepted:true
          };
        }
        const projected = projectPotionMutationResult(result,argument.itemId);
        if(projected.success){
          const savedHero = safeCall(getSavedHero,null);
          const expected = projected.after;
          const savedQuantity = argument.itemId === "mana_potion" ? savedHero?.manaPotions : savedHero?.potions;
          const saveConfirmed = !!savedHero
            && expected?.quantity !== null
            && expected?.health?.current !== null
            && expected?.mana?.current !== null
            && Number(savedQuantity) === Number(expected?.quantity)
            && Number(savedHero.hp) === Number(expected?.health?.current)
            && Number(savedHero.mana) === Number(expected?.mana?.current);
          if(!saveConfirmed){
            return {
              ...projected,
              ok:false,
              success:false,
              save_persisted:false,
              error:{code:"save_not_confirmed",message:"The potion changed live state, but the active save could not be confirmed."}
            };
          }
          return {...projected,save_persisted:true};
        }
        return projected;
      },
      {destructive:true}
    ),
    mutationTool(
      "equip_item",
      "Equip item",
      "Equip one exact previously observed inventory item through the game's canonical gear action and return a verified swap result.",
      itemInputSchema(),
      input=>{
        const gameState = safeCall(getState,null);
        const hero = gameState?.hero;
        syncObservedInventoryHero(hero);
        if(!hero)return equipItemFailure(null,"no_active_game","Start a new game or load a save before equipping an item.");
        const argument = exactItemArgument(input);
        if(!argument.ok)return equipItemFailure(null,argument.error.code,argument.error.message);
        const itemId = argument.itemId;
        if(!observedInventoryItemIds.has(itemId)){
          return equipItemFailure(itemId,"item_not_observed","Call get_inventory and use an exact item ID from its current-game results before equipping it.");
        }
        const safetyContext = safeCall(getMutationSafetyContext,null);
        if(!validMutationSafetyContext(safetyContext)){
          return equipItemFailure(itemId,"safety_context_unavailable","The game could not verify whether equipment changes are currently safe.");
        }
        if(safetyContext.combat_active === true){
          return equipItemFailure(itemId,"combat_active","Equipment cannot be changed while combat is active.");
        }
        if(safetyContext.blocking_interaction_open === true){
          return equipItemFailure(itemId,"blocking_interaction","Equipment cannot be changed while a blocking interaction is open.");
        }
        const availability = safeCall(()=>getEquipItemAvailability(itemId),null);
        if(!availability?.allowed){
          return equipItemFailure(
            itemId,
            availability?.reason_code || "item_not_equippable",
            availability?.reason || "That inventory item cannot be equipped.",
            {slot:availability?.slot || null}
          );
        }
        const slot = availability.slot;
        if(typeof slot !== "string" || !slots.includes(slot)){
          return equipItemFailure(itemId,"item_not_equippable","That inventory entry does not resolve to a canonical equipment slot.");
        }
        const inventoryBefore = Array.isArray(hero.inv) ? hero.inv : [];
        const requestedBefore = inventoryBefore.find(item=>item?.id === itemId);
        const previousBefore = hero.gear?.[slot] || null;
        const requestedCountBefore = inventoryBefore.filter(item=>item?.id === itemId).length;
        const previousCountBefore = previousBefore
          ? inventoryBefore.filter(item=>item?.id === previousBefore.id).length
          : null;
        const totalAttackBefore = safeCall(getTotalAttack,null);
        const totalDefenseBefore = safeCall(getTotalDefense,null);
        let executionError = null;
        let executionCompleted = false;
        try{
          equipItem(itemId);
          executionCompleted = true;
        }catch(error){
          executionError = error instanceof Error ? error.message : String(error);
        }
        observedInventoryItemIds.delete(itemId);
        const afterState = safeCall(getState,null);
        const afterHero = afterState?.hero;
        const inventoryAfter = Array.isArray(afterHero?.inv) ? afterHero.inv : [];
        const newlyEquipped = afterHero?.gear?.[slot] || null;
        const requestedCountAfter = inventoryAfter.filter(item=>item?.id === itemId).length;
        const liveConfirmed = newlyEquipped?.id === itemId
          && requestedCountAfter === requestedCountBefore - 1;
        const previousItemReturned = previousBefore
          ? inventoryAfter.filter(item=>item?.id === previousBefore.id).length === previousCountBefore + 1
          : null;
        const savedHero = safeCall(getSavedHero,null);
        const savedInventory = Array.isArray(savedHero?.inv) ? savedHero.inv : [];
        const saveConfirmed = !!savedHero
          && savedHero.gear?.[slot]?.id === itemId
          && savedInventory.filter(item=>item?.id === itemId).length === requestedCountAfter
          && (!previousBefore
            || savedInventory.filter(item=>item?.id === previousBefore.id).length
              === inventoryAfter.filter(item=>item?.id === previousBefore.id).length);
        const success = executionCompleted
          && liveConfirmed
          && saveConfirmed
          && (previousBefore ? previousItemReturned : true);
        return {
          ok:success,
          accepted:true,
          success,
          item_id:itemId,
          slot,
          previously_equipped:copyGearItem(previousBefore,getWeaponType),
          newly_equipped:copyGearItem(newlyEquipped,getWeaponType),
          previous_item_returned_to_inventory:previousItemReturned,
          derived_stats:{
            total_attack:derivedStatChange(totalAttackBefore,safeCall(getTotalAttack,null)),
            total_defense:derivedStatChange(totalDefenseBefore,safeCall(getTotalDefense,null))
          },
          save_persisted:saveConfirmed,
          error:success ? null : {
            code:liveConfirmed && !saveConfirmed
              ? "save_not_confirmed"
              : executionError
                ? "execution_error"
                : liveConfirmed && previousBefore && !previousItemReturned
                  ? "previous_item_not_returned"
                  : "execution_not_confirmed",
            message:liveConfirmed && !saveConfirmed
              ? "The equipment changed live state, but the active save could not be confirmed."
              : executionError
                || (liveConfirmed && previousBefore && !previousItemReturned
                  ? "The previously equipped item was not returned to inventory."
                  : "The canonical equip action did not produce the expected inventory and equipment change.")
          },
          requested_item:copyGearItem(requestedBefore,getWeaponType)
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
  const tools = createWebMcpTools({...dependencies,getRegisteredWebMcpTools:()=>[...registered]});
  for(const tool of tools){
    try{
      await modelContext.registerTool(tool);
      registered.push(tool.name);
    }catch(error){
      failed.push({name:tool.name,message:error instanceof Error ? error.message : String(error)});
    }
  }
  return {available:true,registered,failed};
}
