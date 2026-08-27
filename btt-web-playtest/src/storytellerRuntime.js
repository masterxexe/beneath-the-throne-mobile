import { getLanguage } from "./language.js";
import { setServiceEvent } from "./locationEvents.js";
import { slumOpenActionGroup } from "./slumPrologue.js";
import { save, state } from "./state.js";
import {
  beginStorytellerPresentation,
  ensureStorytellerState,
  normalizeStorytellerState,
  resolveStorytellerChoice,
  selectStorytellerPresentation
} from "./storyteller.js";
import { openTownService, selectSceneAnchor } from "./town.js";
import { esc, modal, render, selectMutationSafetyContext, selectUiInteractionContext, toast } from "./ui.js";
import { locationSupportsService } from "./world.js";

const ROUTE_KEYS = new Set([
  "cinderhook_warning_messenger:hear_warning",
  "cinderhook_warning_messenger:send_away",
  "tavern_suspicious_stranger:enter_tavern",
  "tavern_suspicious_stranger:let_them_leave",
  "market_cutpurse:enter_market",
  "market_cutpurse:guard_purse"
]);

const ERROR_COPY = {
  no_active_game:{
    en:"Start a new game or load a save before presenting a Storyteller event.",
    es:"Inicia una partida nueva o carga una partida antes de presentar un evento del Narrador."
  },
  invalid_selection:{
    en:"The game could not verify the current Storyteller options.",
    es:"El juego no pudo verificar las opciones actuales del Narrador."
  },
  event_not_eligible:{
    en:"That Storyteller event is not eligible in the current game state.",
    es:"Ese evento del Narrador no está disponible en el estado actual de la partida."
  },
  location_mismatch:{
    en:"The player is no longer in the location where this event was presented.",
    es:"El jugador ya no está en el lugar donde se presentó este evento."
  },
  service_unavailable:{
    en:"The required town service is no longer available here.",
    es:"El servicio urbano necesario ya no está disponible aquí."
  },
  save_failed:{
    en:"The Storyteller event could not be saved safely.",
    es:"No se pudo guardar de forma segura el evento del Narrador."
  },
  presentation_failed:{
    en:"The Storyteller event could not be presented safely.",
    es:"No se pudo presentar de forma segura el evento del Narrador."
  },
  resolution_failed:{
    en:"The Storyteller choice could not be resolved safely.",
    es:"No se pudo resolver de forma segura la elección del Narrador."
  }
};

function languageCode(){
  return getLanguage() === "es" ? "es" : "en";
}

function errorMessage(code){
  const copy = ERROR_COPY[code] || ERROR_COPY.resolution_failed;
  return copy[languageCode()] || copy.en;
}

function detachedPending(pending){
  if(!pending)return null;
  return {
    sequence:Number(pending.sequence),
    eventId:String(pending.eventId),
    status:"presented",
    locationId:String(pending.locationId),
    calendarOrdinal:Number(pending.calendarOrdinal)
  };
}

function runtimeResult({accepted = false,success = false,eventId = null,status = "blocked",awaitingPlayerChoice = false,pending = null,error = null} = {}){
  return {
    accepted:accepted === true,
    success:success === true,
    eventId:typeof eventId === "string" && eventId ? eventId : null,
    status,
    awaitingPlayerChoice:awaitingPlayerChoice === true,
    pending:detachedPending(pending),
    error:error ? {code:String(error.code || "resolution_failed"),message:String(error.message || errorMessage(error.code))} : null
  };
}

function failure(eventId,code,message = null){
  return runtimeResult({
    eventId,
    error:{code,message:message || errorMessage(code)}
  });
}

function currentOrdinal(){
  const month = Number(state?.world?.month);
  const day = Number(state?.world?.day);
  if(!Number.isInteger(month) || month < 1 || !Number.isInteger(day) || day < 1 || day > 30)return null;
  return (month - 1) * 30 + day;
}

function eventEligibility(freshSelection,eventId){
  if(!freshSelection || typeof freshSelection !== "object")return {eligible:false,reasonCode:"invalid_selection",event:null};
  const stateEntry = Array.isArray(freshSelection.eventEligibilityStates)
    ? freshSelection.eventEligibilityStates.find(item=>item?.eventId === eventId)
    : null;
  const event = Array.isArray(freshSelection.eligibleEvents)
    ? freshSelection.eligibleEvents.find(item=>item?.id === eventId) || null
    : null;
  if(
    freshSelection.status !== "ready"
    || freshSelection.blockedReasonCode !== null
    || stateEntry?.eligible !== true
    || !event
  ){
    return {
      eligible:false,
      reasonCode:stateEntry?.reasonCode || freshSelection.blockedReasonCode || "event_not_eligible",
      event:null
    };
  }
  return {eligible:true,reasonCode:null,event};
}

function storytellerModalElement(eventId,sequence){
  if(typeof document === "undefined")return null;
  const marker = document.querySelector(".modal-back [data-storyteller-event]");
  return marker?.getAttribute("data-storyteller-event") === eventId
    && marker?.getAttribute("data-storyteller-sequence") === String(sequence)
    ? marker.closest(".modal-back")
    : null;
}

function removeStorytellerModal(eventId,sequence){
  storytellerModalElement(eventId,sequence)?.remove();
}

function showPendingModal(pending){
  const presentation = selectStorytellerPresentation(pending?.eventId,languageCode());
  if(!presentation)return false;
  if(typeof document === "undefined")return false;
  const existing = document.querySelector(".modal-back");
  if(existing)return !!storytellerModalElement(presentation.id,pending.sequence);
  const uiContext = selectUiInteractionContext();
  const safetyContext = selectMutationSafetyContext();
  if(
    uiContext.current_screen !== "home"
    || uiContext.interaction_layer !== "screen"
    || uiContext.combat_active === true
    || safetyContext.combat_active === true
    || safetyContext.blocking_interaction_open === true
  )return false;
  const body = `
    <div data-storyteller-event="${esc(presentation.id)}" data-storyteller-sequence="${esc(pending.sequence)}">
      <p>${esc(presentation.setup)}</p>
    </div>
  `;
  try{
    modal(presentation.title,body,presentation.choices.map((choice,index)=>({
      label:choice.label,
      cls:index === 0 ? "primary" : "secondary",
      fn:()=>resolvePendingChoice(presentation.id,choice.id,pending.sequence)
    })));
  }catch{
    return false;
  }
  return !!storytellerModalElement(presentation.id,pending.sequence);
}

function restoreWorldMutation(snapshot){
  if(!state?.world)return;
  if(snapshot.hadStoryteller)state.world.storyteller = snapshot.storyteller;
  else delete state.world.storyteller;
  state.world.story = snapshot.story;
  if(snapshot.hadDailyEvents)state.world.dailyLocationEvents = snapshot.dailyLocationEvents;
  else delete state.world.dailyLocationEvents;
}

function snapshotWorldMutation(){
  return {
    hadStoryteller:Object.prototype.hasOwnProperty.call(state.world,"storyteller"),
    storyteller:state.world.storyteller,
    story:Array.isArray(state.world.story) ? [...state.world.story] : [],
    hadDailyEvents:Object.prototype.hasOwnProperty.call(state.world,"dailyLocationEvents"),
    dailyLocationEvents:state.world.dailyLocationEvents && typeof state.world.dailyLocationEvents === "object"
      ? {...state.world.dailyLocationEvents}
      : {}
  };
}

function choiceRoute(eventId,choiceId){
  const key = `${eventId}:${choiceId}`;
  return ROUTE_KEYS.has(key) ? key : null;
}

function validateChoiceRoute(route,pending){
  if(state?.world?.locationId !== pending.locationId)return {ok:false,code:"location_mismatch"};
  if(route === "cinderhook_warning_messenger:hear_warning" && pending.locationId !== "ashen_slums"){
    return {ok:false,code:"location_mismatch"};
  }
  if(route === "tavern_suspicious_stranger:enter_tavern" && !locationSupportsService("tavern",pending.locationId)){
    return {ok:false,code:"service_unavailable"};
  }
  if(route === "market_cutpurse:enter_market" && !locationSupportsService("market",pending.locationId)){
    return {ok:false,code:"service_unavailable"};
  }
  return {ok:true,code:null};
}

function applyServiceRoute(route,pending){
  if(route === "tavern_suspicious_stranger:enter_tavern"){
    setServiceEvent(state,pending.locationId,"tavern","suspicious_stranger");
  }
  if(route === "market_cutpurse:enter_market"){
    setServiceEvent(state,pending.locationId,"market","market_thief");
  }
}

function continueChoiceRoute(route){
  if(route === "cinderhook_warning_messenger:hear_warning"){
    setTimeout(()=>slumOpenActionGroup("gang"),0);
    return;
  }
  if(route === "tavern_suspicious_stranger:enter_tavern"){
    openTownService("tavern");
    selectSceneAnchor("suspicious_stranger");
    return;
  }
  if(route === "market_cutpurse:enter_market"){
    openTownService("market");
    selectSceneAnchor("market_thief");
  }
}

function resolvePendingChoice(eventId,choiceId,pendingSequence){
  if(!state?.hero || !state?.world){
    toast(errorMessage("no_active_game"));
    return;
  }
  const current = ensureStorytellerState(state.world);
  const pending = current.pending;
  const route = choiceRoute(eventId,choiceId);
  const presentation = selectStorytellerPresentation(eventId,languageCode());
  const choice = presentation?.choices.find(item=>item.id === choiceId) || null;
  if(
    !pending
    || pending.eventId !== eventId
    || pending.sequence !== pendingSequence
    || !route
    || !choice
  ){
    toast(errorMessage("resolution_failed"));
    setTimeout(()=>resumePendingStorytellerEvent(),0);
    return;
  }
  const routeCheck = validateChoiceRoute(route,pending);
  if(!routeCheck.ok){
    toast(errorMessage(routeCheck.code));
    setTimeout(()=>resumePendingStorytellerEvent(),0);
    return;
  }
  const transition = resolveStorytellerChoice(current,{
    eventId,
    choiceId,
    resolvedOrdinal:currentOrdinal()
  });
  if(!transition.ok){
    toast(transition.error?.message || errorMessage("resolution_failed"));
    setTimeout(()=>resumePendingStorytellerEvent(),0);
    return;
  }
  const snapshot = snapshotWorldMutation();
  try{
    applyServiceRoute(route,pending);
    state.world.storyteller = transition.state;
    state.world.story ||= [];
    state.world.story.push(`${presentation.title}: ${choice.outcome}`);
    save();
  }catch{
    restoreWorldMutation(snapshot);
    toast(errorMessage("save_failed"));
    setTimeout(()=>resumePendingStorytellerEvent(),0);
    return;
  }
  toast(choice.outcome);
  if(
    route === "cinderhook_warning_messenger:hear_warning"
    || route.endsWith(":send_away")
    || route.endsWith(":let_them_leave")
    || route.endsWith(":guard_purse")
  )render();
  continueChoiceRoute(route);
}

export function presentStorytellerEvent(eventId,freshSelection){
  if(!state?.hero || !state?.world)return failure(eventId,"no_active_game");
  const presentation = selectStorytellerPresentation(eventId,languageCode());
  if(!presentation)return failure(eventId,"unknown_event","The Storyteller event ID is not defined by the game.");
  const eligibility = eventEligibility(freshSelection,eventId);
  if(!eligibility.eligible)return failure(eventId,eligibility.reasonCode || "event_not_eligible");
  const locationId = eligibility.event?.context?.locationId;
  const calendarOrdinal = Number(eligibility.event?.observedAtOrdinal);
  if(
    typeof locationId !== "string"
    || !locationId
    || state.world.locationId !== locationId
    || !Number.isInteger(calendarOrdinal)
    || calendarOrdinal < 1
  )return failure(eventId,"location_mismatch");
  const transition = beginStorytellerPresentation(state.world.storyteller,{
    eventId,
    locationId,
    calendarOrdinal
  });
  if(!transition.ok)return failure(eventId,transition.error?.code || "event_not_eligible",transition.error?.message);
  const snapshot = snapshotWorldMutation();
  state.world.storyteller = transition.state;
  // The browser cannot paint or accept a click until this synchronous save finishes.
  // If either modal creation or persistence fails, remove both before yielding control.
  const presented = showPendingModal(transition.pending);
  if(!presented){
    restoreWorldMutation(snapshot);
    return failure(eventId,"presentation_failed");
  }
  try{
    save();
  }catch{
    removeStorytellerModal(eventId,transition.pending.sequence);
    restoreWorldMutation(snapshot);
    return failure(eventId,"save_failed");
  }
  return runtimeResult({
    accepted:true,
    success:true,
    eventId,
    status:"presented",
    awaitingPlayerChoice:true,
    pending:transition.pending
  });
}

export function resumePendingStorytellerEvent(){
  if(!state?.hero || !state?.world)return failure(null,"no_active_game");
  const normalized = normalizeStorytellerState(state.world.storyteller);
  if(Object.prototype.hasOwnProperty.call(state.world,"storyteller"))state.world.storyteller = normalized;
  if(!normalized.pending){
    return runtimeResult({accepted:false,success:true,status:"none"});
  }
  const presented = showPendingModal(normalized.pending);
  return runtimeResult({
    accepted:true,
    success:true,
    eventId:normalized.pending.eventId,
    status:presented ? "presented" : "queued",
    awaitingPlayerChoice:true,
    pending:normalized.pending
  });
}
