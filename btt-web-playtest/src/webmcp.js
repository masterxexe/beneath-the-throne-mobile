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
  {name:"get_storyteller_options",type:"read_only_tool",modifiesGameState:false},
  {name:"trigger_story_event",type:"mutation_tool",modifiesGameState:true},
  {name:"use_item",type:"mutation_tool",modifiesGameState:true},
  {name:"equip_item",type:"mutation_tool",modifiesGameState:true}
];
const WEBMCP_TOOL_NAMES = WEBMCP_TOOL_CAPABILITIES.map(tool=>tool.name);
const STORYTELLER_READ_NOTE = "Each issued token is valid only for its exact game-defined event. trigger_story_event can present one event, while every event choice remains player-controlled in the game UI.";
const STORYTELLER_TRIGGER_UNAVAILABLE_NOTE = "Storyteller options are advisory because trigger_story_event is unavailable. Every event choice remains player-controlled in the game UI.";

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

function storytellerTriggerInputSchema(allowedEventIds){
  return {
    type:"object",
    properties:{
      event_id:{type:"string",enum:[...allowedEventIds]},
      token:{type:"string",minLength:20,maxLength:128}
    },
    required:["event_id","token"],
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

function exactStorytellerTriggerArgument(input,allowedEventIds){
  if(!input || typeof input !== "object" || Array.isArray(input)){
    return {ok:false,error:{code:"invalid_arguments",message:"Expected an object containing only event_id and token."}};
  }
  const keys = Object.keys(input).sort();
  if(keys.length !== 2 || keys[0] !== "event_id" || keys[1] !== "token"){
    return {ok:false,error:{code:"invalid_arguments",message:"Only the event_id and token fields are accepted."}};
  }
  if(typeof input.event_id !== "string" || !input.event_id){
    return {ok:false,error:{code:"invalid_event_id",message:"event_id must be an exact non-empty string."}};
  }
  if(!allowedEventIds.has(input.event_id)){
    return {ok:false,error:{code:"unknown_event_id",message:"event_id must match a predefined Storyteller event."}};
  }
  if(
    typeof input.token !== "string"
    || input.token.length < 20
    || input.token.length > 128
    || !/^story-[A-Za-z0-9-]+$/.test(input.token)
  ){
    return {ok:false,error:{code:"invalid_token",message:"token must be an exact Storyteller token returned for this event."}};
  }
  return {ok:true,eventId:input.event_id,token:input.token};
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

function secureStorytellerDecisionToken(){
  try{
    const cryptoApi = globalThis?.crypto;
    if(typeof cryptoApi?.randomUUID === "function")return `story-${cryptoApi.randomUUID()}`;
    if(typeof cryptoApi?.getRandomValues !== "function")return null;
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `story-${[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("")}`;
  }catch{
    return null;
  }
}

function projectStorytellerChoice(choice){
  if(!choice || typeof choice !== "object")return null;
  const choiceId = nullableString(choice.id);
  if(!choiceId)return null;
  return {
    choice_id:choiceId,
    label:stringValue(choice.label),
    interaction_owner:"player_ui",
    currently_presented:false,
    webmcp_invocable:false
  };
}

function projectStorytellerEvent(event){
  if(!event || typeof event !== "object")return null;
  const eventId = nullableString(event.id);
  if(!eventId)return null;
  const choices = Array.isArray(event.choices)
    ? event.choices.map(projectStorytellerChoice).filter(Boolean)
    : [];
  return {
    event_id:eventId,
    title:stringValue(event.title),
    setup_text:stringValue(event.setup),
    category:nullableString(event.category),
    eligibility_reason_code:nullableString(event.reasonCode),
    eligibility_reason:stringValue(event.reason),
    context:{
      location_type:nullableString(event.context?.locationType),
      location_id:nullableString(event.context?.locationId)
    },
    cooldown:{
      days:numberValue(event.cooldown?.days),
      days_remaining:numberValue(event.cooldown?.daysRemaining),
      prior_occurrences:numberValue(event.cooldown?.priorOccurrences),
      max_occurrences:nullableNumber(event.cooldown?.maxOccurrences)
    },
    human_choices:choices
  };
}

function projectStorytellerSnapshot(source){
  if(!source || typeof source !== "object" || !Array.isArray(source.eligibleEvents))return null;
  const seenEventIds = new Set();
  const eligibleEvents = source.eligibleEvents
    .map(projectStorytellerEvent)
    .filter(event=>{
      if(!event || seenEventIds.has(event.event_id))return false;
      seenEventIds.add(event.event_id);
      return true;
    });
  const status = source.status === "ready" || source.status === "blocked" ? source.status : null;
  if(!status)return null;
  const blockedReasonCode = nullableString(source.blockedReasonCode);
  if(status === "blocked"){
    if(!blockedReasonCode)return null;
    eligibleEvents.length = 0;
  }else if(eligibleEvents.length){
    if(blockedReasonCode)return null;
  }else if(blockedReasonCode !== "no_eligible_events"){
    return null;
  }
  return {
    status,
    language:stringValue(source.language) || "en",
    blocked_reason:blockedReasonCode ? {
      code:blockedReasonCode,
      message:stringValue(source.blockedReason)
    } : null,
    context:{
      current_screen:nullableString(source.context?.currentScreen),
      interaction_layer:nullableString(source.context?.interactionLayer),
      blocking_interaction_open:source.context?.blockingInteractionOpen === true,
      combat_active:source.context?.combatActive === true,
      location_type:nullableString(source.context?.locationType),
      location_id:nullableString(source.context?.locationId),
      is_traveling:source.context?.isTraveling === true,
      travel_status:nullableString(source.context?.travelStatus),
      calendar:{
        month:nullableNumber(source.context?.calendar?.month),
        day:nullableNumber(source.context?.calendar?.day)
      }
    },
    cooldown:{
      global_ready:source.cooldown?.globalReady === true,
      global_days_remaining:numberValue(source.cooldown?.globalDaysRemaining)
    },
    eligibleEvents
  };
}

const STORYTELLER_ELIGIBILITY_FAILURE_CODES = new Set([
  "no_active_game",
  "context_unavailable",
  "combat_active",
  "blocking_interaction",
  "world_interaction_active",
  "travel_in_progress",
  "wrong_screen",
  "unsupported_location_context",
  "location_mismatch",
  "pending_story_event",
  "global_cooldown",
  "location_not_supported",
  "required_action_unavailable",
  "progression_requirement_unmet",
  "max_occurrences_reached",
  "event_cooldown"
]);

const STORYTELLER_TRIGGER_FAILURE_MESSAGES = Object.freeze({
  no_active_game:"Start a new game or load a save before triggering a Storyteller event.",
  context_unavailable:"The game could not safely evaluate the current Storyteller context.",
  combat_active:"Storyteller events cannot interrupt active combat.",
  blocking_interaction:"Finish the current dialog or interaction before triggering a Storyteller event.",
  world_interaction_active:"Wait for the current world-scene movement to finish.",
  travel_in_progress:"This Storyteller event requires a stable location, not an active journey.",
  wrong_screen:"Storyteller events can be presented from the Home screen only.",
  unsupported_location_context:"This Storyteller event is not available in the current location context.",
  location_mismatch:"The current location could not be verified safely.",
  pending_story_event:"Resolve the currently presented Storyteller event first.",
  global_cooldown:"The Storyteller is waiting before presenting another event.",
  location_not_supported:"That Storyteller event is not supported at the current location.",
  required_action_unavailable:"The game action required by that Storyteller event is no longer available.",
  progression_requirement_unmet:"The progression requirement for that Storyteller event is no longer met.",
  max_occurrences_reached:"That Storyteller event has already reached its occurrence limit.",
  event_cooldown:"That Storyteller event is still on cooldown.",
  storyteller_options_required:"Call get_storyteller_options and use a current event-specific token first.",
  decision_token_mismatch:"The supplied token is not a current Storyteller token.",
  event_token_mismatch:"The supplied token was issued for a different Storyteller event.",
  stale_decision:"The live game context changed after these Storyteller options were observed.",
  storyteller_context_unavailable:"The game could not safely determine current Storyteller eligibility.",
  execution_rejected:"The canonical Storyteller runtime rejected this event.",
  execution_error:"The canonical Storyteller runtime could not present this event.",
  execution_not_confirmed:"The canonical Storyteller runtime did not provide a verifiable result.",
  save_not_confirmed:"The Storyteller event changed live state, but its pending save could not be confirmed.",
  presentation_not_confirmed:"The Storyteller event could not be confirmed as awaiting the player's choice."
});

function storytellerTriggerFailure(eventId,code,message,{
  accepted = false,
  tokenConsumed = false,
  presentationStatus = "not_presented",
  pendingSequence = null,
  eventTitle = null,
  eventPresented = false,
  awaitingPlayerChoice = false,
  humanChoiceIds = [],
  savePersisted = false
} = {}){
  return {
    ok:false,
    accepted,
    success:false,
    event_id:typeof eventId === "string" ? eventId : null,
    event_title:nullableString(eventTitle),
    event_presented:eventPresented === true,
    token_consumed:tokenConsumed,
    presentation_status:presentationStatus,
    awaiting_player_choice:awaitingPlayerChoice === true,
    human_action_required:awaitingPlayerChoice === true,
    interaction_owner:"player_ui",
    available_human_choice_ids:Array.isArray(humanChoiceIds)
      ? humanChoiceIds.filter(value=>typeof value === "string" && value)
      : [],
    pending_sequence:nullableNumber(pendingSequence),
    save_persisted:savePersisted === true,
    error:{
      code,
      message:stringValue(message) || STORYTELLER_TRIGGER_FAILURE_MESSAGES[code] || STORYTELLER_TRIGGER_FAILURE_MESSAGES.execution_rejected
    }
  };
}

function storytellerEventEligibilityFailure(source,eventId){
  if(!Array.isArray(source?.eventEligibilityStates)){
    return {
      code:"storyteller_context_unavailable",
      message:STORYTELLER_TRIGGER_FAILURE_MESSAGES.storyteller_context_unavailable
    };
  }
  const states = source.eventEligibilityStates;
  const eventState = states.find(entry=>entry?.eventId === eventId);
  if(!eventState){
    return {code:"stale_decision",message:STORYTELLER_TRIGGER_FAILURE_MESSAGES.stale_decision};
  }
  if(eventState.eligible === true)return null;
  const reasonCode = STORYTELLER_ELIGIBILITY_FAILURE_CODES.has(eventState.reasonCode)
    ? eventState.reasonCode
    : "stale_decision";
  return {
    code:reasonCode,
    message:STORYTELLER_TRIGGER_FAILURE_MESSAGES[reasonCode]
  };
}

function storytellerRuntimeFailureCode(code){
  if(STORYTELLER_ELIGIBILITY_FAILURE_CODES.has(code))return code;
  if(code === "invalid_selection")return "storyteller_context_unavailable";
  if(code === "event_not_eligible")return "stale_decision";
  if(code === "save_failed")return "save_not_confirmed";
  if(code === "presentation_failed")return "presentation_not_confirmed";
  return "execution_rejected";
}

function projectedStorytellerPending(source){
  const root = source?.world?.storyteller || source?.storyteller || source;
  const pending = root?.pending || (
    root && typeof root === "object" && (root.eventId || root.event_id) && root.sequence !== undefined
      ? root
      : null
  );
  if(!pending || typeof pending !== "object")return null;
  const eventId = nullableString(pending.eventId ?? pending.event_id);
  const sequence = nullableNumber(pending.sequence);
  if(!eventId || sequence === null || !Number.isInteger(sequence) || sequence < 1)return null;
  return {
    sequence,
    event_id:eventId,
    status:nullableString(pending.status)
  };
}

function projectStorytellerExecutionResult(result){
  if(!result || typeof result !== "object")return null;
  const errorCode = nullableString(result.error?.code);
  return {
    accepted:result.accepted === true,
    success:result.success === true,
    event_id:nullableString(result.eventId ?? result.event_id),
    presentation_status:nullableString(result.status ?? result.presentationStatus ?? result.presentation_status),
    awaiting_player_choice:result.awaitingPlayerChoice === true || result.awaiting_player_choice === true,
    pending:projectedStorytellerPending(result.pending),
    error:errorCode ? {
      code:errorCode,
      message:stringValue(result.error?.message)
    } : null
  };
}

function noActiveStorytellerResult(language,currentScreen){
  return {
    ok:true,
    storyteller:{
      status:"blocked",
      language:language === "es" ? "es" : "en",
      mutation_available:false,
      trigger_tool:null,
      decision_token:null,
      decision_event_id:null,
      decision_token_status:"not_applicable",
      context:{
        current_screen:nullableString(currentScreen),
        interaction_layer:"title",
        blocking_interaction_open:false,
        combat_active:false,
        location_type:null,
        location_id:null,
        is_traveling:false,
        travel_status:null,
        calendar:{month:null,day:null}
      },
      cooldown:{global_ready:false,global_days_remaining:0},
      eligible_event_count:0,
      eligible_events:[],
      blocked_reason:{
        code:"no_active_game",
        message:language === "es"
          ? "Inicia una partida nueva o carga una partida antes de pedir opciones del Narrador."
          : "Start a new game or load a save before asking for Storyteller options."
      }
    },
    note:STORYTELLER_READ_NOTE
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
  getStorytellerOptions = ()=>null,
  storytellerEventIds = [],
  createStorytellerDecisionToken = secureStorytellerDecisionToken,
  getActiveSaveSlot = ()=>null,
  executeStorytellerEvent = ()=>null,
  getSavedStorytellerState = ()=>null,
  getMutationSafetyContext = ()=>null,
  getSavedHero = ()=>null,
  executeUseItem = ()=>null,
  getEquipItemAvailability = ()=>null,
  equipItem = ()=>undefined,
  getRegisteredWebMcpTools = ()=>WEBMCP_TOOL_NAMES,
  gearSlots = []
} = {}){
  const slots = [...gearSlots];
  const allowedStorytellerEventIds = [...new Set(
    (Array.isArray(storytellerEventIds) ? storytellerEventIds : [])
      .filter(eventId=>typeof eventId === "string" && eventId)
  )];
  const allowedStorytellerEvents = new Set(allowedStorytellerEventIds);
  let observedInventoryHero = null;
  const observedInventoryItemIds = new Set();
  const latestStorytellerReceipts = new Map();

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
    readOnlyTool(
      "get_storyteller_options",
      "Get Storyteller options",
      "Return a detached snapshot of currently eligible, game-defined Storyteller events and event-specific trigger tokens when the guarded trigger tool is available.",
      ()=>{
        latestStorytellerReceipts.clear();
        const gameState = safeCall(getState,null);
        if(!gameState?.hero){
          return noActiveStorytellerResult(
            stringValue(safeCall(getLanguage,"en")) || "en",
            safeCall(getCurrentScreen,null)
          );
        }
        const selected = safeCall(getStorytellerOptions,null);
        const snapshot = projectStorytellerSnapshot(selected);
        if(!snapshot){
          return {
            ok:false,
            error:{
              code:"storyteller_context_unavailable",
              message:"The game could not safely determine Storyteller options."
            }
          };
        }
        const eligibilityKey = nullableString(selected?.eligibilityKey);
        const rawActiveSaveSlot = safeCall(getActiveSaveSlot,null);
        const activeSaveSlot = rawActiveSaveSlot === null || rawActiveSaveSlot === undefined || rawActiveSaveSlot === ""
          ? null
          : String(rawActiveSaveSlot);
        const registered = safeCall(getRegisteredWebMcpTools,WEBMCP_TOOL_NAMES);
        const triggerRegistered = Array.isArray(registered) && registered.includes("trigger_story_event");
        const catalogMatchesSnapshot = snapshot.eligibleEvents.every(event=>allowedStorytellerEvents.has(event.event_id));
        const eligibilityStates = Array.isArray(selected?.eventEligibilityStates) ? selected.eventEligibilityStates : [];
        const eligibilityStatesMatch = snapshot.eligibleEvents.every(event=>eligibilityStates.some(entry=>(
          entry?.eventId === event.event_id && entry.eligible === true && entry.reasonCode === null
        )));
        const canIssueTokens = triggerRegistered
          && snapshot.status === "ready"
          && snapshot.blocked_reason === null
          && snapshot.eligibleEvents.length > 0
          && eligibilityKey
          && activeSaveSlot
          && catalogMatchesSnapshot
          && eligibilityStatesMatch;
        const tokensByEvent = new Map();
        if(canIssueTokens){
          for(const event of snapshot.eligibleEvents){
            let token = null;
            for(let attempt = 0;attempt < 3 && !token;attempt += 1){
              const candidate = nullableString(safeCall(createStorytellerDecisionToken,null));
              if(
                candidate
                && candidate.length >= 20
                && candidate.length <= 128
                && /^story-[A-Za-z0-9-]+$/.test(candidate)
                && ![...tokensByEvent.values()].includes(candidate)
              )token = candidate;
            }
            if(token)tokensByEvent.set(event.event_id,token);
          }
          if(tokensByEvent.size !== snapshot.eligibleEvents.length)tokensByEvent.clear();
        }
        const eligibleEvents = snapshot.eligibleEvents.map(event=>{
          const token = tokensByEvent.get(event.event_id) || null;
          if(token){
            latestStorytellerReceipts.set(token,{
              token,
              eventId:event.event_id,
              hero:gameState.hero,
              activeSaveSlot,
              eligibilityKey
            });
          }
          return {
            ...event,
            token,
            token_status:token
              ? "issued"
              : !triggerRegistered
                ? "trigger_unavailable"
                : !eligibilityKey || !activeSaveSlot || !catalogMatchesSnapshot || !eligibilityStatesMatch
                  ? "snapshot_unavailable"
                  : "secure_random_unavailable"
          };
        });
        const firstEvent = eligibleEvents[0] || null;
        const decisionToken = firstEvent?.token || null;
        const decisionEventId = decisionToken ? firstEvent.event_id : null;
        const decisionTokenStatus = !eligibleEvents.length
          ? "not_applicable"
          : !triggerRegistered
            ? "trigger_unavailable"
          : !eligibilityKey
            ? "snapshot_unavailable"
            : !activeSaveSlot
              ? "snapshot_unavailable"
            : !catalogMatchesSnapshot || !eligibilityStatesMatch
              ? "snapshot_unavailable"
            : latestStorytellerReceipts.size > 0
              ? "issued"
              : "secure_random_unavailable";
        const mutationAvailable = triggerRegistered && latestStorytellerReceipts.size > 0;
        return {
          ok:true,
          storyteller:{
            status:snapshot.status,
            language:snapshot.language,
            mutation_available:mutationAvailable,
            trigger_tool:mutationAvailable ? "trigger_story_event" : null,
            decision_token:decisionToken,
            decision_event_id:decisionEventId,
            decision_token_status:decisionTokenStatus,
            context:snapshot.context,
            cooldown:snapshot.cooldown,
            eligible_event_count:eligibleEvents.length,
            eligible_events:eligibleEvents,
            blocked_reason:snapshot.blocked_reason
          },
          note:triggerRegistered ? STORYTELLER_READ_NOTE : STORYTELLER_TRIGGER_UNAVAILABLE_NOTE
        };
      }
    ),
    mutationTool(
      "trigger_story_event",
      "Trigger Storyteller event",
      "Present one exact game-defined Storyteller event using the event-specific token returned by get_storyteller_options. The human player retains control of every event choice.",
      storytellerTriggerInputSchema(allowedStorytellerEventIds),
      input=>{
        const initialGameState = safeCall(getState,null);
        if(!initialGameState?.hero){
          latestStorytellerReceipts.clear();
          return storytellerTriggerFailure(
            null,
            "no_active_game",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.no_active_game
          );
        }
        const argument = exactStorytellerTriggerArgument(input,allowedStorytellerEvents);
        if(!argument.ok){
          return storytellerTriggerFailure(
            typeof input?.event_id === "string" ? input.event_id : null,
            argument.error.code,
            argument.error.message
          );
        }
        const receipt = latestStorytellerReceipts.get(argument.token) || null;
        if(!receipt){
          const code = latestStorytellerReceipts.size
            ? "decision_token_mismatch"
            : "storyteller_options_required";
          return storytellerTriggerFailure(argument.eventId,code,STORYTELLER_TRIGGER_FAILURE_MESSAGES[code]);
        }
        if(receipt.eventId !== argument.eventId){
          return storytellerTriggerFailure(
            argument.eventId,
            "event_token_mismatch",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.event_token_mismatch
          );
        }

        latestStorytellerReceipts.delete(argument.token);
        const consumedFailure = (code,message,extra = {})=>storytellerTriggerFailure(
          argument.eventId,
          code,
          message,
          {tokenConsumed:true,...extra}
        );
        const gameState = safeCall(getState,null);
        if(!gameState?.hero){
          return consumedFailure("no_active_game",STORYTELLER_TRIGGER_FAILURE_MESSAGES.no_active_game);
        }
        const rawActiveSaveSlot = safeCall(getActiveSaveSlot,null);
        const activeSaveSlot = rawActiveSaveSlot === null || rawActiveSaveSlot === undefined || rawActiveSaveSlot === ""
          ? null
          : String(rawActiveSaveSlot);
        if(!activeSaveSlot || activeSaveSlot !== receipt.activeSaveSlot || gameState.hero !== receipt.hero){
          return consumedFailure("stale_decision",STORYTELLER_TRIGGER_FAILURE_MESSAGES.stale_decision);
        }

        const freshSelection = safeCall(getStorytellerOptions,null);
        const freshSnapshot = projectStorytellerSnapshot(freshSelection);
        if(!freshSnapshot){
          return consumedFailure(
            "storyteller_context_unavailable",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.storyteller_context_unavailable
          );
        }
        if(freshSnapshot.status !== "ready"){
          const requestedCode = freshSnapshot.blocked_reason?.code;
          const code = STORYTELLER_ELIGIBILITY_FAILURE_CODES.has(requestedCode)
            ? requestedCode
            : "storyteller_context_unavailable";
          return consumedFailure(
            code,
            freshSnapshot.blocked_reason?.message || STORYTELLER_TRIGGER_FAILURE_MESSAGES[code]
          );
        }
        const eventEligibilityFailure = storytellerEventEligibilityFailure(freshSelection,argument.eventId);
        if(eventEligibilityFailure){
          return consumedFailure(eventEligibilityFailure.code,eventEligibilityFailure.message);
        }
        const freshEligibilityKey = nullableString(freshSelection?.eligibilityKey);
        if(!freshEligibilityKey){
          return consumedFailure(
            "storyteller_context_unavailable",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.storyteller_context_unavailable
          );
        }
        if(freshEligibilityKey !== receipt.eligibilityKey){
          return consumedFailure("stale_decision",STORYTELLER_TRIGGER_FAILURE_MESSAGES.stale_decision);
        }
        const freshEvent = freshSnapshot.eligibleEvents.find(event=>event.event_id === argument.eventId) || null;
        if(!freshEvent){
          return consumedFailure(
            "stale_decision",
            "That Storyteller event is no longer eligible in the live game context."
          );
        }

        let canonicalResult;
        try{
          canonicalResult = executeStorytellerEvent(argument.eventId,freshSelection);
        }catch{
          return consumedFailure(
            "execution_error",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.execution_error,
            {accepted:true}
          );
        }
        const projectedResult = projectStorytellerExecutionResult(canonicalResult);
        if(!projectedResult){
          return consumedFailure(
            "execution_not_confirmed",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.execution_not_confirmed,
            {accepted:true}
          );
        }
        if(!projectedResult.accepted || !projectedResult.success){
          const code = storytellerRuntimeFailureCode(projectedResult.error?.code);
          return consumedFailure(
            code,
            code === "execution_rejected"
              ? STORYTELLER_TRIGGER_FAILURE_MESSAGES.execution_rejected
              : projectedResult.error?.message || STORYTELLER_TRIGGER_FAILURE_MESSAGES[code],
            {
              accepted:projectedResult.accepted,
              presentationStatus:projectedResult.presentation_status || "blocked",
              pendingSequence:projectedResult.pending?.sequence
            }
          );
        }

        const resultPending = projectedResult.pending;
        const livePending = projectedStorytellerPending(safeCall(getState,null));
        const savedPending = projectedStorytellerPending(
          safeCall(()=>getSavedStorytellerState(receipt.activeSaveSlot),null)
        );
        const humanChoiceIds = freshEvent.human_choices.map(choice=>choice.choice_id);
        const resultConfirmed = projectedResult.event_id === argument.eventId
          && projectedResult.presentation_status === "presented"
          && projectedResult.awaiting_player_choice === true
          && resultPending?.event_id === argument.eventId
          && resultPending.sequence !== null;
        const liveConfirmed = livePending?.event_id === argument.eventId
          && livePending.sequence === resultPending?.sequence;
        const saveConfirmed = savedPending?.event_id === argument.eventId
          && savedPending.sequence === resultPending?.sequence;
        if(!resultConfirmed){
          return consumedFailure(
            "presentation_not_confirmed",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.presentation_not_confirmed,
            {
              accepted:true,
              presentationStatus:projectedResult.presentation_status || "not_presented",
              pendingSequence:resultPending?.sequence,
              eventTitle:freshEvent.title,
              eventPresented:projectedResult.presentation_status === "presented",
              awaitingPlayerChoice:projectedResult.awaiting_player_choice,
              humanChoiceIds,
              savePersisted:saveConfirmed
            }
          );
        }
        if(!liveConfirmed){
          return consumedFailure(
            "execution_not_confirmed",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.execution_not_confirmed,
            {
              accepted:true,
              presentationStatus:projectedResult.presentation_status,
              pendingSequence:resultPending.sequence,
              eventTitle:freshEvent.title,
              eventPresented:true,
              awaitingPlayerChoice:true,
              humanChoiceIds,
              savePersisted:saveConfirmed
            }
          );
        }
        if(!saveConfirmed){
          return consumedFailure(
            "save_not_confirmed",
            STORYTELLER_TRIGGER_FAILURE_MESSAGES.save_not_confirmed,
            {
              accepted:true,
              presentationStatus:projectedResult.presentation_status,
              pendingSequence:resultPending.sequence,
              eventTitle:freshEvent.title,
              eventPresented:true,
              awaitingPlayerChoice:true,
              humanChoiceIds,
              savePersisted:false
            }
          );
        }
        return {
          ok:true,
          accepted:true,
          success:true,
          event_id:argument.eventId,
          event_title:freshEvent.title,
          event_presented:true,
          token_consumed:true,
          presentation_status:"presented",
          awaiting_player_choice:true,
          human_action_required:true,
          interaction_owner:"player_ui",
          available_human_choice_ids:freshEvent.human_choices.map(choice=>choice.choice_id),
          pending_sequence:resultPending.sequence,
          save_persisted:true,
          error:null
        };
      },
      {destructive:true}
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
    if(tool.name === "trigger_story_event" && !registered.includes("get_storyteller_options")){
      failed.push({
        name:tool.name,
        message:"Required tool get_storyteller_options was not registered."
      });
      continue;
    }
    try{
      await modelContext.registerTool(tool);
      registered.push(tool.name);
    }catch(error){
      failed.push({name:tool.name,message:error instanceof Error ? error.message : String(error)});
    }
  }
  return {available:true,registered,failed};
}
