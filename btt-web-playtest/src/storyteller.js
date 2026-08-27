const SUPPORTED_LANGUAGES = new Set(["en","es"]);
const SHARED_BLOCKING_CONDITIONS = [
  "active_game",
  "home_screen",
  "screen_interaction_layer",
  "no_combat",
  "no_blocking_interaction",
  "no_world_scene_traversal",
  "stable_major_location",
  "no_pending_storyteller_event",
  "global_cooldown_ready",
  "event_cooldown_ready"
];

function deepFreeze(value){
  if(!value || typeof value !== "object" || Object.isFrozen(value))return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const EVENT_DEFINITIONS = deepFreeze([
  {
    id:"cinderhook_warning_messenger",
    category:"warning",
    eligibleLocationIds:["ashen_slums"],
    requiredActionId:"cinderhook.open_contract_board",
    progressionRequirements:{
      chapterId:"cinderhook",
      chapterActive:true,
      gateLocked:true,
      gangPressureUnresolved:true
    },
    blockingConditions:SHARED_BLOCKING_CONDITIONS,
    cooldownDays:3,
    maxOccurrences:1,
    futureRoute:{type:"story_only"},
    copy:{
      en:{
        title:"A Warning at the Door",
        setup:"A soot-marked messenger waits outside your shelter. The Dock Rats want every newcomer in Cinderhook to know who watches the alleys.",
        reason:"Cinderhook's gate is still locked and gang pressure remains unresolved."
      },
      es:{
        title:"Una advertencia en la puerta",
        setup:"Un mensajero manchado de hollín espera fuera de tu refugio. Las Ratas del Muelle quieren que cada recién llegado a Cinderhook sepa quién vigila los callejones.",
        reason:"La puerta de Cinderhook sigue cerrada y la presión de la banda continúa sin resolverse."
      }
    },
    choices:[
      {
        id:"hear_warning",
        label:{en:"Hear the warning",es:"Escuchar la advertencia"},
        outcome:{
          en:"The warning is plain: pay the Dock Rats, break them, or never reach the gate unseen.",
          es:"La advertencia es clara: paga a las Ratas del Muelle, acaba con ellas o nunca llegarás a la puerta sin que te vean."
        }
      },
      {
        id:"send_away",
        label:{en:"Send the messenger away",es:"Despedir al mensajero"},
        outcome:{
          en:"You send the messenger away. The warning remains in the soot on your door.",
          es:"Despides al mensajero. La advertencia permanece en el hollín de tu puerta."
        }
      }
    ]
  },
  {
    id:"tavern_suspicious_stranger",
    category:"mystery",
    eligibleLocationIds:["ashen_slums","lower_ward","ashen_keep","market_town"],
    requiredActionId:"location.open_service.tavern",
    progressionRequirements:{requiredServiceAction:"location.open_service.tavern"},
    blockingConditions:SHARED_BLOCKING_CONDITIONS,
    cooldownDays:4,
    maxOccurrences:null,
    futureRoute:{type:"service_event",serviceId:"tavern",serviceEventId:"suspicious_stranger"},
    copy:{
      en:{
        title:"The Hooded Stranger",
        setup:"A hooded traveler lingers near the tavern door, watching the street whenever your back is turned.",
        reason:"A tavern is open here, and its crowd gives a suspicious traveler somewhere to hide."
      },
      es:{
        title:"El desconocido encapuchado",
        setup:"Un viajero encapuchado ronda la puerta de la taberna y observa la calle cada vez que le das la espalda.",
        reason:"Aquí hay una taberna abierta, y su multitud ofrece refugio a un viajero sospechoso."
      }
    },
    choices:[
      {
        id:"enter_tavern",
        label:{en:"Follow them into the tavern",es:"Seguirlo dentro de la taberna"},
        outcome:{
          en:"You follow the stranger into the tavern, where the crowd swallows their trail.",
          es:"Sigues al desconocido hasta la taberna, donde la multitud se traga su rastro."
        }
      },
      {
        id:"let_them_leave",
        label:{en:"Let them leave",es:"Dejar que se marche"},
        outcome:{
          en:"You let the stranger disappear into the street.",
          es:"Dejas que el desconocido desaparezca entre las calles."
        }
      }
    ]
  },
  {
    id:"market_cutpurse",
    category:"opportunity",
    eligibleLocationIds:["ashen_slums","lower_ward","market_town"],
    requiredActionId:"location.open_service.market",
    progressionRequirements:{requiredServiceAction:"location.open_service.market",minimumGold:6},
    blockingConditions:SHARED_BLOCKING_CONDITIONS,
    cooldownDays:5,
    maxOccurrences:null,
    futureRoute:{type:"service_event",serviceId:"market",serviceEventId:"market_thief"},
    copy:{
      en:{
        title:"A Hand in the Crowd",
        setup:"A market runner brushes past with a warning: a cutpurse is working the busiest lane and watching your coin.",
        reason:"A market is open here, and you carry enough gold to draw a cutpurse's attention."
      },
      es:{
        title:"Una mano entre la multitud",
        setup:"Un corredor del mercado pasa rozándote con una advertencia: un carterista acecha el callejón más concurrido y vigila tu oro.",
        reason:"Aquí hay un mercado abierto, y llevas suficiente oro para atraer la atención de un carterista."
      }
    },
    choices:[
      {
        id:"enter_market",
        label:{en:"Enter the market",es:"Entrar al mercado"},
        outcome:{
          en:"You enter the market with one hand near your coin purse.",
          es:"Entras al mercado con una mano cerca de la bolsa de monedas."
        }
      },
      {
        id:"guard_purse",
        label:{en:"Guard your purse and move on",es:"Proteger tu bolsa y seguir adelante"},
        outcome:{
          en:"You secure your purse and leave the cutpurse searching for an easier mark.",
          es:"Aseguras tu bolsa y dejas que el carterista busque una presa más fácil."
        }
      }
    ]
  }
]);

export const STORYTELLER_EVENT_IDS = Object.freeze(EVENT_DEFINITIONS.map(event=>event.id));

const STORYTELLER_STATE_VERSION = 1;
const STORYTELLER_HISTORY_LIMIT = 20;
const STORYTELLER_GLOBAL_COOLDOWN_DAYS = 1;

const BLOCKED_COPY = deepFreeze({
  no_active_game:{
    en:"Start a new game or load a save before asking for Storyteller options.",
    es:"Inicia una partida nueva o carga una partida antes de pedir opciones del Narrador."
  },
  wrong_screen:{
    en:"Storyteller options are available from the Home screen only.",
    es:"Las opciones del Narrador solo están disponibles desde la pantalla de Inicio."
  },
  combat_active:{
    en:"Storyteller events cannot interrupt active combat.",
    es:"Los eventos del Narrador no pueden interrumpir un combate activo."
  },
  blocking_interaction:{
    en:"Finish the current dialog or interaction before checking Storyteller options.",
    es:"Termina el diálogo o la interacción actual antes de consultar opciones del Narrador."
  },
  world_interaction_active:{
    en:"Wait for the current world-scene movement to finish.",
    es:"Espera a que termine el movimiento actual en la escena del mundo."
  },
  travel_in_progress:{
    en:"These first Storyteller events require a stable major location, not an active journey.",
    es:"Estos primeros eventos del Narrador requieren una ubicación principal estable, no un viaje activo."
  },
  location_mismatch:{
    en:"The current location could not be verified safely.",
    es:"No se pudo verificar con seguridad la ubicación actual."
  },
  unsupported_location_context:{
    en:"No initial Storyteller events are available in this location context.",
    es:"No hay eventos iniciales del Narrador disponibles en este contexto de ubicación."
  },
  pending_story_event:{
    en:"A Storyteller event is already awaiting resolution.",
    es:"Ya hay un evento del Narrador pendiente de resolución."
  },
  global_cooldown:{
    en:"The Storyteller is waiting before offering another event.",
    es:"El Narrador está esperando antes de ofrecer otro evento."
  },
  context_unavailable:{
    en:"The game could not safely evaluate the current Storyteller context.",
    es:"El juego no pudo evaluar con seguridad el contexto actual del Narrador."
  },
  no_eligible_events:{
    en:"No predefined Storyteller events are eligible right now.",
    es:"No hay eventos predefinidos del Narrador disponibles en este momento."
  }
});

function languageCode(value){
  return SUPPORTED_LANGUAGES.has(value) ? value : "en";
}

function localized(copy,language){
  if(typeof copy === "string")return copy;
  return String(copy?.[language] || copy?.en || "");
}

function finiteNumber(value,fallback = 0){
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function calendarContext(world){
  const month = Number(world?.month);
  const day = Number(world?.day);
  const valid = Number.isInteger(month) && month >= 1 && Number.isInteger(day) && day >= 1 && day <= 30;
  return valid
    ? {month,day,ordinal:(month - 1) * 30 + day,valid:true}
    : {month:null,day:null,ordinal:null,valid:false};
}

function nonNegativeInteger(value,fallback = 0){
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function positiveOrdinal(value){
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

function eventById(eventId){
  return typeof eventId === "string" ? EVENT_DEFINITIONS.find(event=>event.id === eventId) || null : null;
}

function choiceById(event,choiceId){
  return event && typeof choiceId === "string"
    ? event.choices.find(choice=>choice.id === choiceId) || null
    : null;
}

function normalizedPending(value){
  if(!value || typeof value !== "object" || Array.isArray(value))return null;
  const event = eventById(value.eventId ?? value.event_id);
  const sequence = nonNegativeInteger(value.sequence,0);
  const locationId = typeof (value.locationId ?? value.location_id) === "string"
    ? String(value.locationId ?? value.location_id)
    : "";
  const calendarOrdinal = positiveOrdinal(value.calendarOrdinal ?? value.calendar_ordinal);
  const status = value.status === "pending" ? "presented" : value.status;
  if(!event || sequence < 1 || !locationId || calendarOrdinal === null || status !== "presented")return null;
  return {sequence,eventId:event.id,status:"presented",locationId,calendarOrdinal};
}

function normalizedHistoryRow(value){
  if(!value || typeof value !== "object" || Array.isArray(value))return null;
  const event = eventById(value.eventId ?? value.event_id);
  const sequence = nonNegativeInteger(value.sequence,0);
  const locationId = typeof (value.locationId ?? value.location_id) === "string"
    ? String(value.locationId ?? value.location_id)
    : "";
  const calendarOrdinal = positiveOrdinal(value.calendarOrdinal ?? value.calendar_ordinal);
  const status = value.status === "pending" ? "presented" : value.status;
  if(!event || sequence < 1 || !locationId || calendarOrdinal === null || !["presented","resolved"].includes(status))return null;
  const choice = choiceById(event,value.choiceId ?? value.choice_id ?? value.outcomeId ?? value.outcome_id);
  if(status === "resolved" && !choice)return null;
  return {
    sequence,
    eventId:event.id,
    status,
    choiceId:choice?.id || null,
    outcomeId:choice?.id || null,
    locationId,
    calendarOrdinal,
    resolvedOrdinal:status === "resolved"
      ? positiveOrdinal(value.resolvedOrdinal ?? value.resolved_ordinal) || calendarOrdinal
      : null
  };
}

function normalizedLastEventRecord(value,event,history){
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rows = history.filter(row=>row.eventId === event.id);
  const lastHistoryOrdinal = rows.length ? Math.max(...rows.map(row=>row.calendarOrdinal)) : null;
  const explicitLastOrdinal = positiveOrdinal(
    source.lastOrdinal ?? source.calendarOrdinal ?? source.calendar_ordinal
  );
  const lastOrdinal = explicitLastOrdinal ?? lastHistoryOrdinal;
  const explicitEligibleAfter = positiveOrdinal(
    source.eligibleAfterOrdinal ?? source.eligible_after_ordinal
  );
  const lastChoice = choiceById(event,source.lastChoiceId ?? source.last_choice_id ?? source.outcomeId ?? source.outcome_id);
  return {
    seenCount:Math.max(nonNegativeInteger(
      source.seenCount ?? source.seen_count ?? source.occurrenceCount ?? source.occurrence_count,
      0
    ),rows.length),
    lastOrdinal,
    eligibleAfterOrdinal:explicitEligibleAfter ?? (lastOrdinal === null ? null : lastOrdinal + event.cooldownDays),
    lastChoiceId:lastChoice?.id || null,
    status:source.status === "presented"
      ? "presented"
      : source.status === "resolved"
        ? "resolved"
        : rows[rows.length - 1]?.status || null
  };
}

export function createStorytellerState(){
  return {
    version:STORYTELLER_STATE_VERSION,
    sequence:0,
    pending:null,
    globalEligibleAfterOrdinal:0,
    lastByEvent:{},
    history:[]
  };
}

export function normalizeStorytellerState(value){
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  let history = (Array.isArray(source.history) ? source.history : [])
    .map(normalizedHistoryRow)
    .filter(Boolean)
    .slice(-STORYTELLER_HISTORY_LIMIT);
  let pending = normalizedPending(source.pending ?? source.active);
  if(pending){
    const rowsAtSequence = history.filter(row=>row.sequence === pending.sequence);
    const exactPresentedRow = rowsAtSequence.length === 1
      && rowsAtSequence[0].eventId === pending.eventId
      && rowsAtSequence[0].status === "presented"
      && rowsAtSequence[0].locationId === pending.locationId
      && rowsAtSequence[0].calendarOrdinal === pending.calendarOrdinal;
    if(!rowsAtSequence.length){
      history = [...history,{
        sequence:pending.sequence,
        eventId:pending.eventId,
        status:"presented",
        choiceId:null,
        outcomeId:null,
        locationId:pending.locationId,
        calendarOrdinal:pending.calendarOrdinal,
        resolvedOrdinal:null
      }].slice(-STORYTELLER_HISTORY_LIMIT);
    }else if(!exactPresentedRow){
      pending = null;
    }
  }
  const lastSource = source.lastByEvent && typeof source.lastByEvent === "object" && !Array.isArray(source.lastByEvent)
    ? source.lastByEvent
    : {};
  const lastByEvent = Object.fromEntries(EVENT_DEFINITIONS.flatMap(event=>{
    const record = normalizedLastEventRecord(lastSource[event.id],event,history);
    return record.seenCount || record.lastOrdinal !== null || record.eligibleAfterOrdinal !== null || record.lastChoiceId || record.status
      ? [[event.id,record]]
      : [];
  }));
  const highestSequence = Math.max(
    nonNegativeInteger(source.sequence,0),
    pending?.sequence || 0,
    ...history.map(row=>row.sequence)
  );
  return {
    version:STORYTELLER_STATE_VERSION,
    sequence:highestSequence,
    pending,
    globalEligibleAfterOrdinal:nonNegativeInteger(
      source.globalEligibleAfterOrdinal ?? source.global_eligible_after_ordinal,
      0
    ),
    lastByEvent,
    history
  };
}

export function ensureStorytellerState(world){
  return normalizeStorytellerState(world?.storyteller);
}

function transitionFailure(code,message,state){
  return {ok:false,state:normalizeStorytellerState(state),error:{code,message}};
}

export function beginStorytellerPresentation(storyState,{eventId,locationId,calendarOrdinal} = {}){
  const current = normalizeStorytellerState(storyState);
  const event = eventById(eventId);
  const ordinal = positiveOrdinal(calendarOrdinal);
  if(!event)return transitionFailure("unknown_event","The Storyteller event ID is not defined by the game.",current);
  if(current.pending)return transitionFailure("pending_story_event","A Storyteller event is already awaiting a player choice.",current);
  if(typeof locationId !== "string" || !locationId)return transitionFailure("location_mismatch","The Storyteller event location is unavailable.",current);
  if(ordinal === null)return transitionFailure("context_unavailable","The Storyteller calendar context is unavailable.",current);
  const sequence = current.sequence + 1;
  const pending = {sequence,eventId:event.id,status:"presented",locationId,calendarOrdinal:ordinal};
  const historyRow = {
    sequence,
    eventId:event.id,
    status:"presented",
    choiceId:null,
    outcomeId:null,
    locationId,
    calendarOrdinal:ordinal,
    resolvedOrdinal:null
  };
  const previous = current.lastByEvent[event.id] || {
    seenCount:0,
    lastOrdinal:null,
    eligibleAfterOrdinal:null,
    lastChoiceId:null,
    status:null
  };
  const next = {
    ...current,
    sequence,
    pending,
    lastByEvent:{
      ...current.lastByEvent,
      [event.id]:{
        ...previous,
        seenCount:previous.seenCount + 1,
        lastOrdinal:ordinal,
        eligibleAfterOrdinal:ordinal + event.cooldownDays,
        lastChoiceId:null,
        status:"presented"
      }
    },
    history:[...current.history,historyRow].slice(-STORYTELLER_HISTORY_LIMIT)
  };
  return {ok:true,state:next,pending:{...pending},error:null};
}

export function resolveStorytellerChoice(storyState,{eventId,choiceId,resolvedOrdinal} = {}){
  const current = normalizeStorytellerState(storyState);
  const event = eventById(eventId);
  const choice = choiceById(event,choiceId);
  if(!event)return transitionFailure("unknown_event","The Storyteller event ID is not defined by the game.",current);
  if(!choice)return transitionFailure("unknown_choice","The Storyteller choice ID is not defined for this event.",current);
  if(!current.pending)return transitionFailure("no_pending_story_event","No Storyteller event is awaiting a player choice.",current);
  if(current.pending.eventId !== event.id)return transitionFailure("pending_event_mismatch","The pending Storyteller event does not match this choice.",current);
  const rowIndex = current.history.findIndex(row=>row.sequence === current.pending.sequence && row.eventId === event.id);
  if(rowIndex < 0)return transitionFailure("pending_history_missing","The pending Storyteller history record is unavailable.",current);
  const resolutionOrdinal = positiveOrdinal(resolvedOrdinal) || current.pending.calendarOrdinal;
  const history = current.history.map((row,index)=>index === rowIndex ? {
    ...row,
    status:"resolved",
    choiceId:choice.id,
    outcomeId:choice.id,
    resolvedOrdinal:resolutionOrdinal
  } : row);
  const previous = current.lastByEvent[event.id] || normalizedLastEventRecord({},event,history);
  const next = {
    ...current,
    pending:null,
    globalEligibleAfterOrdinal:Math.max(
      current.globalEligibleAfterOrdinal,
      resolutionOrdinal + STORYTELLER_GLOBAL_COOLDOWN_DAYS
    ),
    lastByEvent:{
      ...current.lastByEvent,
      [event.id]:{
        ...previous,
        lastChoiceId:choice.id,
        status:"resolved"
      }
    },
    history
  };
  return {
    ok:true,
    state:next,
    resolution:{
      sequence:current.pending.sequence,
      eventId:event.id,
      choiceId:choice.id,
      outcomeId:choice.id,
      locationId:current.pending.locationId,
      calendarOrdinal:current.pending.calendarOrdinal,
      resolvedOrdinal:resolutionOrdinal
    },
    error:null
  };
}

function storytellerState(world){
  const source = world?.storyteller;
  return source && typeof source === "object" && !Array.isArray(source) ? source : {};
}

function historyEntries(storyState){
  return Array.isArray(storyState?.history)
    ? storyState.history.filter(entry=>entry && typeof entry === "object")
    : [];
}

function occurrenceCount(storyState,history,eventId){
  const historyCount = history.filter(entry=>(entry.eventId || entry.event_id) === eventId).length;
  const durableCount = finiteNumber(
    storyState?.lastByEvent?.[eventId]?.seenCount
      ?? storyState?.lastByEvent?.[eventId]?.seen_count
      ?? storyState?.lastByEvent?.[eventId]?.occurrenceCount
      ?? storyState?.lastByEvent?.[eventId]?.occurrence_count,
    0
  );
  return Math.max(historyCount,Math.max(0,Math.trunc(durableCount)));
}

function lastEventOrdinal(storyState,history,eventId){
  const lastRecord = storyState?.lastByEvent?.[eventId];
  const explicit = finiteNumber(
    lastRecord?.lastOrdinal ?? lastRecord?.calendarOrdinal ?? lastRecord?.calendar_ordinal,
    Number.NaN
  );
  const historical = history
    .filter(entry=>(entry.eventId || entry.event_id) === eventId)
    .map(entry=>finiteNumber(entry.calendarOrdinal ?? entry.calendar_ordinal,Number.NaN))
    .filter(Number.isFinite);
  return Number.isFinite(explicit) ? explicit : historical.length ? Math.max(...historical) : null;
}

function eventEligibleAfterOrdinal(storyState,history,event){
  const lastRecord = storyState?.lastByEvent?.[event.id];
  const explicit = finiteNumber(
    lastRecord?.eligibleAfterOrdinal ?? lastRecord?.eligible_after_ordinal,
    Number.NaN
  );
  if(Number.isFinite(explicit))return explicit;
  const lastOrdinal = lastEventOrdinal(storyState,history,event.id);
  return lastOrdinal === null ? null : lastOrdinal + event.cooldownDays;
}

function enabledActionIds(actionSnapshots){
  const snapshots = Array.isArray(actionSnapshots) ? actionSnapshots : [];
  return [...new Set(snapshots
    .filter(snapshot=>snapshot && typeof snapshot === "object" && snapshot.applicable === true)
    .flatMap(snapshot=>Array.isArray(snapshot.actions) ? snapshot.actions : [])
    .filter(action=>action && typeof action.id === "string" && action.enabled === true)
    .map(action=>action.id))]
    .sort();
}

function chapterById(questSections,id){
  return (Array.isArray(questSections) ? questSections : []).find(section=>section?.id === id) || null;
}

function validUiContext(context){
  return !!context
    && typeof context === "object"
    && typeof context.current_screen === "string"
    && typeof context.interaction_layer === "string"
    && typeof context.blocking_modal_open === "boolean"
    && typeof context.combat_active === "boolean";
}

function validSafetyContext(context){
  return !!context
    && typeof context === "object"
    && typeof context.combat_active === "boolean"
    && typeof context.blocking_interaction_open === "boolean";
}

function validWorldInteractionContext(context){
  return !!context
    && typeof context === "object"
    && typeof context.scene_traversal_active === "boolean"
    && typeof context.travel_active === "boolean"
    && (context.travel_status === null || typeof context.travel_status === "string");
}

function validPlaceContext(context){
  return !!context
    && typeof context === "object"
    && typeof context.type === "string"
    && typeof context.id === "string"
    && typeof context.isTraveling === "boolean";
}

function sharedBlockReason({gameState,placeContext,uiContext,safetyContext,worldInteractionContext,calendar,storyState}){
  if(!gameState?.hero)return "no_active_game";
  if(
    !validUiContext(uiContext)
    || !validSafetyContext(safetyContext)
    || !validWorldInteractionContext(worldInteractionContext)
    || !validPlaceContext(placeContext)
    || calendar.valid !== true
  )return "context_unavailable";
  if(uiContext?.combat_active === true || safetyContext?.combat_active === true || uiContext?.interaction_layer === "combat")return "combat_active";
  if(
    uiContext?.blocking_modal_open === true
    || safetyContext?.blocking_interaction_open === true
    || uiContext?.interaction_layer === "modal"
  )return "blocking_interaction";
  if(worldInteractionContext?.scene_traversal_active === true)return "world_interaction_active";
  if(placeContext?.isTraveling === true || worldInteractionContext?.travel_active === true)return "travel_in_progress";
  if(uiContext?.current_screen !== "home")return "wrong_screen";
  if(uiContext?.interaction_layer !== "screen")return "context_unavailable";
  if(placeContext?.type !== "majorLocation")return "unsupported_location_context";
  const rawLocationId = typeof gameState?.world?.locationId === "string" ? gameState.world.locationId : null;
  if(!rawLocationId || rawLocationId !== placeContext?.id)return "location_mismatch";
  if(storyState?.active || storyState?.pending)return "pending_story_event";
  const globalEligibleAfter = finiteNumber(
    storyState?.globalEligibleAfterOrdinal ?? storyState?.global_eligible_after_ordinal,
    0
  );
  if(globalEligibleAfter > calendar.ordinal)return "global_cooldown";
  return null;
}

function warningProgressionEligible(questSections){
  const chapter = chapterById(questSections,"cinderhook");
  return chapter?.status === "active"
    && chapter?.gate?.unlocked === false
    && chapter?.gate?.requirements?.gang_pressure?.met === false;
}

function eventProgressionEligible(event,{gameState,questSections}){
  if(event.id === "cinderhook_warning_messenger")return warningProgressionEligible(questSections);
  if(event.id === "market_cutpurse")return finiteNumber(gameState?.hero?.gold,0) >= event.progressionRequirements.minimumGold;
  return true;
}

function selectEventEligibilityState(event,{blockCode,placeContext,actionIds,gameState,questSections,storyState,history,calendar}){
  const eligibleAfterOrdinal = eventEligibleAfterOrdinal(storyState,history,event);
  const daysRemaining = calendar.valid && eligibleAfterOrdinal !== null
    ? Math.max(0,eligibleAfterOrdinal - calendar.ordinal)
    : 0;
  let reasonCode = blockCode;
  if(!reasonCode && !event.eligibleLocationIds.includes(placeContext.id))reasonCode = "location_not_supported";
  if(!reasonCode && !actionIds.includes(event.requiredActionId))reasonCode = "required_action_unavailable";
  if(!reasonCode && !eventProgressionEligible(event,{gameState,questSections}))reasonCode = "progression_requirement_unmet";
  const count = occurrenceCount(storyState,history,event.id);
  if(!reasonCode && Number.isFinite(event.maxOccurrences) && count >= event.maxOccurrences)reasonCode = "max_occurrences_reached";
  if(!reasonCode && daysRemaining > 0)reasonCode = "event_cooldown";
  return {
    eventId:event.id,
    eligible:reasonCode === null,
    reasonCode:reasonCode || null,
    eligibleAfterOrdinal,
    daysRemaining
  };
}

function projectEligibleEvent(event,{language,placeContext,storyState,history,calendar}){
  const count = occurrenceCount(storyState,history,event.id);
  return {
    id:event.id,
    category:event.category,
    title:localized(event.copy?.[language]?.title || event.copy?.en?.title,language),
    setup:localized(event.copy?.[language]?.setup || event.copy?.en?.setup,language),
    reasonCode:event.id === "cinderhook_warning_messenger"
      ? "cinderhook_gang_pressure_unresolved"
      : event.id === "tavern_suspicious_stranger"
        ? "tavern_service_available"
        : "market_service_available_with_gold",
    reason:localized(event.copy?.[language]?.reason || event.copy?.en?.reason,language),
    context:{locationType:placeContext.type,locationId:placeContext.id},
    cooldown:{days:event.cooldownDays,daysRemaining:0,priorOccurrences:count,maxOccurrences:event.maxOccurrences},
    choices:event.choices.map(choice=>({id:choice.id,label:localized(choice.label,language)})),
    observedAtOrdinal:calendar.ordinal
  };
}

function stableHash(value,seed){
  let hash = seed >>> 0;
  for(const character of String(value)){
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash,16777619);
  }
  return (hash >>> 0).toString(16).padStart(8,"0");
}

function eligibilityKey(snapshot){
  const serialized = JSON.stringify(snapshot);
  return `story-eligibility-v1-${stableHash(serialized,2166136261)}${stableHash(serialized,3339675911)}`;
}

function blockedMessage(code,language){
  return localized(BLOCKED_COPY[code] || BLOCKED_COPY.context_unavailable,language);
}

export function getStorytellerEventIds(){
  return [...STORYTELLER_EVENT_IDS];
}

export function selectStorytellerPresentation(eventId,language = "en"){
  const event = eventById(eventId);
  if(!event)return null;
  const lang = languageCode(language);
  return {
    id:event.id,
    category:event.category,
    title:localized(event.copy?.[lang]?.title || event.copy?.en?.title,lang),
    setup:localized(event.copy?.[lang]?.setup || event.copy?.en?.setup,lang),
    choices:event.choices.map(choice=>({
      id:choice.id,
      label:localized(choice.label,lang),
      outcome:localized(choice.outcome,lang)
    }))
  };
}

export function selectStorytellerOptions({
  gameState = null,
  language = "en",
  activeSaveSlot = null,
  placeContext = null,
  uiContext = null,
  safetyContext = null,
  worldInteractionContext = null,
  questSections = [],
  actionSnapshots = []
} = {}){
  const lang = languageCode(language);
  const calendar = calendarContext(gameState?.world);
  const storyState = storytellerState(gameState?.world);
  const history = historyEntries(storyState);
  const actionIds = enabledActionIds(actionSnapshots);
  const blockCode = sharedBlockReason({
    gameState,
    placeContext,
    uiContext,
    safetyContext,
    worldInteractionContext,
    calendar,
    storyState
  });
  const context = {
    currentScreen:typeof uiContext?.current_screen === "string" ? uiContext.current_screen : null,
    interactionLayer:typeof uiContext?.interaction_layer === "string" ? uiContext.interaction_layer : null,
    blockingInteractionOpen:uiContext?.blocking_modal_open === true || safetyContext?.blocking_interaction_open === true,
    combatActive:uiContext?.combat_active === true || safetyContext?.combat_active === true,
    locationType:typeof placeContext?.type === "string" ? placeContext.type : null,
    locationId:typeof placeContext?.id === "string" ? placeContext.id : null,
    isTraveling:placeContext?.isTraveling === true || worldInteractionContext?.travel_active === true,
    travelStatus:typeof placeContext?.status === "string"
      ? placeContext.status
      : typeof worldInteractionContext?.travel_status === "string"
        ? worldInteractionContext.travel_status
        : null,
    calendar
  };

  const eventEligibilityStates = EVENT_DEFINITIONS.map(event=>selectEventEligibilityState(event,{
    blockCode,
    placeContext,
    actionIds,
    gameState,
    questSections,
    storyState,
    history,
    calendar
  }));
  const eligibleEventIds = new Set(eventEligibilityStates.filter(item=>item.eligible).map(item=>item.eventId));
  const eligibleEvents = EVENT_DEFINITIONS
    .filter(event=>eligibleEventIds.has(event.id))
    .map(event=>projectEligibleEvent(event,{language:lang,placeContext,storyState,history,calendar}));

  const resultReasonCode = blockCode || (eligibleEvents.length ? null : "no_eligible_events");
  const eventEligibilityState = EVENT_DEFINITIONS.map(event=>({
    id:event.id,
    occurrences:occurrenceCount(storyState,history,event.id),
    lastOrdinal:lastEventOrdinal(storyState,history,event.id),
    eligibleAfterOrdinal:eventEligibleAfterOrdinal(storyState,history,event)
  }));
  const fingerprint = {
    version:1,
    activeSaveSlot:Number.isFinite(Number(activeSaveSlot)) ? Number(activeSaveSlot) : null,
    language:lang,
    hero:gameState?.hero ? {
      name:String(gameState.hero.name || ""),
      classId:String(gameState.hero.class || ""),
      level:finiteNumber(gameState.hero.level,0),
      gold:finiteNumber(gameState.hero.gold,0)
    } : null,
    rawLocationId:typeof gameState?.world?.locationId === "string" ? gameState.world.locationId : null,
    context,
    actionIds,
    cinderhook:(()=>{
      const chapter = chapterById(questSections,"cinderhook");
      return chapter ? {
        status:chapter.status || null,
        gateUnlocked:chapter.gate?.unlocked === true,
        gangPressureMet:chapter.gate?.requirements?.gang_pressure?.met === true
      } : null;
    })(),
    storyteller:{
      active:!!(storyState.active || storyState.pending),
      globalEligibleAfterOrdinal:finiteNumber(storyState.globalEligibleAfterOrdinal ?? storyState.global_eligible_after_ordinal,0),
      eventEligibilityState,
      history:history.slice(-20).map(entry=>({
        eventId:String(entry.eventId || entry.event_id || ""),
        status:String(entry.status || ""),
        outcomeId:String(entry.outcomeId || entry.outcome_id || ""),
        calendarOrdinal:finiteNumber(entry.calendarOrdinal ?? entry.calendar_ordinal,0)
      }))
    },
    eligibleEventIds:eligibleEvents.map(event=>event.id)
  };

  const globalEligibleAfter = finiteNumber(
    storyState.globalEligibleAfterOrdinal ?? storyState.global_eligible_after_ordinal,
    0
  );
  const globalDaysRemaining = calendar.valid
    ? Math.max(0,globalEligibleAfter - calendar.ordinal)
    : 0;

  return {
    status:blockCode ? "blocked" : "ready",
    language:lang,
    eligibilityKey:eligibilityKey(fingerprint),
    blockedReasonCode:resultReasonCode,
    blockedReason:resultReasonCode ? blockedMessage(resultReasonCode,lang) : null,
    context,
    cooldown:{
      globalReady:calendar.valid === true && globalDaysRemaining === 0,
      globalDaysRemaining
    },
    eventEligibilityStates,
    eligibleEvents
  };
}
