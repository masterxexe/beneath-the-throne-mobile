#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  beginStorytellerPresentation,
  createStorytellerState,
  ensureStorytellerState,
  getStorytellerEventIds,
  normalizeStorytellerState,
  resolveStorytellerChoice,
  selectStorytellerOptions,
  selectStorytellerPresentation
} from "../src/storyteller.js";

const EXPECTED_EVENT_IDS = [
  "cinderhook_warning_messenger",
  "tavern_suspicious_stranger",
  "market_cutpurse"
];

function deepFreeze(value){
  if(!value || typeof value !== "object" || Object.isFrozen(value))return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function baseInput(){
  const gameState = {
    hero:{name:"Selector Tester",class:"warrior",level:1,gold:18,food:5},
    world:{locationId:"ashen_slums",month:1,day:1,story:[]}
  };
  const placeContext = {
    type:"majorLocation",
    id:"ashen_slums",
    name:"Cinderhook Slum",
    isTraveling:false,
    status:null,
    services:["market","blacksmith","inn","tavern"]
  };
  const uiContext = {
    current_screen:"home",
    interaction_layer:"screen",
    blocking_modal_open:false,
    combat_active:false
  };
  const safetyContext = {combat_active:false,blocking_interaction_open:false};
  const worldInteractionContext = {scene_traversal_active:false,travel_active:false,travel_status:null};
  const questSections = [{
    id:"cinderhook",
    status:"active",
    gate:{unlocked:false,requirements:{gang_pressure:{met:false}}}
  }];
  const actionSnapshots = [
    {
      id:"world",
      applicable:true,
      actions:[
        {id:"location.open_service.tavern",enabled:true},
        {id:"location.open_service.market",enabled:true},
        {id:"location.open_map",enabled:true}
      ]
    },
    {
      id:"cinderhook",
      applicable:true,
      actions:[{id:"cinderhook.open_contract_board",enabled:true}]
    }
  ];
  return {
    gameState,
    language:"en",
    activeSaveSlot:1,
    placeContext,
    uiContext,
    safetyContext,
    worldInteractionContext,
    questSections,
    actionSnapshots
  };
}

function eventIds(result){
  return result.eligibleEvents.map(event=>event.id);
}

let storageAccesses = 0;
Object.defineProperty(globalThis,"localStorage",{
  configurable:true,
  value:new Proxy({}, {
    get(){
      storageAccesses += 1;
      throw new Error("The Storyteller selector must not access localStorage.");
    },
    set(){
      storageAccesses += 1;
      throw new Error("The Storyteller selector must not access localStorage.");
    }
  })
});

assert.deepEqual(getStorytellerEventIds(),EXPECTED_EVENT_IDS);
assert.equal(new Set(getStorytellerEventIds()).size,EXPECTED_EVENT_IDS.length,"catalog IDs must be unique");

const emptyStorytellerState = createStorytellerState();
assert.deepEqual(emptyStorytellerState,{
  version:1,
  sequence:0,
  pending:null,
  globalEligibleAfterOrdinal:0,
  lastByEvent:{},
  history:[]
});
emptyStorytellerState.history.push({test:true});
assert.deepEqual(createStorytellerState().history,[],"fresh Storyteller state must not share mutable history");

for(const malformed of [null,undefined,"bad",[],42,{
  version:99,
  sequence:-4,
  pending:"bad",
  globalEligibleAfterOrdinal:-1,
  lastByEvent:[],
  history:{bad:true},
  extraState:{should:"not survive"}
}]){
  assert.deepEqual(
    normalizeStorytellerState(deepFreeze(malformed)),
    createStorytellerState(),
    "malformed Storyteller save data must fail safely to the canonical empty state"
  );
}

const legacyStorytellerState = deepFreeze({
  sequence:"2",
  active:{
    sequence:"2",
    event_id:"tavern_suspicious_stranger",
    status:"pending",
    location_id:"ashen_slums",
    calendar_ordinal:"31"
  },
  global_eligible_after_ordinal:"33",
  lastByEvent:{
    market_cutpurse:{
      seen_count:"2",
      calendar_ordinal:"12",
      eligible_after_ordinal:"17",
      outcome_id:"guard_purse",
      status:"resolved"
    },
    invented_event:{seenCount:999,lastOrdinal:1}
  },
  history:[
    {
      sequence:"1",
      event_id:"market_cutpurse",
      status:"resolved",
      outcome_id:"guard_purse",
      location_id:"ashen_slums",
      calendar_ordinal:"12",
      resolved_ordinal:"12"
    },
    {
      sequence:"2",
      event_id:"tavern_suspicious_stranger",
      status:"pending",
      location_id:"ashen_slums",
      calendar_ordinal:"31"
    },
    {sequence:3,event_id:"invented_event",status:"presented",location_id:"ashen_slums",calendar_ordinal:32}
  ],
  extraState:{should:"not survive"}
});
const legacyBefore = JSON.stringify(legacyStorytellerState);
const normalizedLegacy = normalizeStorytellerState(legacyStorytellerState);
assert.equal(JSON.stringify(legacyStorytellerState),legacyBefore,"legacy normalization must not mutate its input");
assert.deepEqual(normalizedLegacy.pending,{
  sequence:2,
  eventId:"tavern_suspicious_stranger",
  status:"presented",
  locationId:"ashen_slums",
  calendarOrdinal:31
});
assert.equal(normalizedLegacy.sequence,2);
assert.equal(normalizedLegacy.globalEligibleAfterOrdinal,33);
assert.deepEqual(normalizedLegacy.history.map(row=>[row.sequence,row.eventId,row.status,row.outcomeId]),[
  [1,"market_cutpurse","resolved","guard_purse"],
  [2,"tavern_suspicious_stranger","presented",null]
]);
assert.deepEqual(Object.keys(normalizedLegacy.lastByEvent).sort(),["market_cutpurse","tavern_suspicious_stranger"]);
assert.deepEqual(normalizedLegacy.lastByEvent.market_cutpurse,{
  seenCount:2,
  lastOrdinal:12,
  eligibleAfterOrdinal:17,
  lastChoiceId:"guard_purse",
  status:"resolved"
});
assert.equal(normalizedLegacy.lastByEvent.tavern_suspicious_stranger.seenCount,1);
assert.equal(normalizedLegacy.lastByEvent.tavern_suspicious_stranger.eligibleAfterOrdinal,35);
assert.doesNotMatch(JSON.stringify(normalizedLegacy),/active|event_id|calendar_ordinal|invented_event|extraState/);
assert.deepEqual(normalizeStorytellerState(normalizedLegacy),normalizedLegacy,"Storyteller save normalization must be idempotent");

const reconstructedPending = normalizeStorytellerState({
  sequence:4,
  pending:{
    sequence:4,
    eventId:"market_cutpurse",
    status:"presented",
    locationId:"ashen_slums",
    calendarOrdinal:8
  },
  history:[]
});
assert.equal(reconstructedPending.history.length,1,"a valid legacy pending event must receive a resolvable history row");
assert.deepEqual(reconstructedPending.history[0],{
  sequence:4,
  eventId:"market_cutpurse",
  status:"presented",
  choiceId:null,
  outcomeId:null,
  locationId:"ashen_slums",
  calendarOrdinal:8,
  resolvedOrdinal:null
});
assert.equal(resolveStorytellerChoice(reconstructedPending,{
  eventId:"market_cutpurse",
  choiceId:"guard_purse",
  resolvedOrdinal:8
}).ok,true,"a reconstructed legacy pending event must remain resolvable");

const conflictingPending = normalizeStorytellerState({
  sequence:5,
  pending:{
    sequence:5,
    eventId:"market_cutpurse",
    status:"presented",
    locationId:"ashen_slums",
    calendarOrdinal:9
  },
  history:[{
    sequence:5,
    eventId:"market_cutpurse",
    status:"resolved",
    choiceId:"guard_purse",
    locationId:"ashen_slums",
    calendarOrdinal:9,
    resolvedOrdinal:9
  }]
});
assert.equal(conflictingPending.pending,null,"a conflicting resolved history row must not leave an impossible pending event");
assert.equal(conflictingPending.history[0].status,"resolved");

const legacyWorld = deepFreeze({storyteller:legacyStorytellerState});
const ensuredLegacy = ensureStorytellerState(legacyWorld);
assert.deepEqual(ensuredLegacy,normalizedLegacy);
assert.equal(legacyWorld.storyteller,legacyStorytellerState,"ensureStorytellerState must return a detached value without assigning into the world");
assert.deepEqual(ensureStorytellerState({}),createStorytellerState(),"a legacy world without Storyteller data must remain readable");

const oversizedHistory = Array.from({length:25},(_,index)=>({
  sequence:index + 1,
  eventId:"tavern_suspicious_stranger",
  status:"presented",
  choiceId:null,
  outcomeId:null,
  locationId:"ashen_slums",
  calendarOrdinal:index + 1,
  resolvedOrdinal:null
}));
const boundedHistory = normalizeStorytellerState({
  sequence:25,
  lastByEvent:{tavern_suspicious_stranger:{seenCount:25,lastOrdinal:25,eligibleAfterOrdinal:29}},
  history:oversizedHistory
});
assert.equal(boundedHistory.history.length,20,"Storyteller history must remain bounded");
assert.equal(boundedHistory.history[0].sequence,6);
assert.equal(boundedHistory.history.at(-1).sequence,25);
assert.equal(boundedHistory.lastByEvent.tavern_suspicious_stranger.seenCount,25,"durable occurrence counts must survive history trimming");

const expectedPresentations = {
  cinderhook_warning_messenger:{
    en:{
      title:"A Warning at the Door",
      setup:"A soot-marked messenger waits outside your shelter. The Dock Rats want every newcomer in Cinderhook to know who watches the alleys.",
      choices:[
        ["hear_warning","Hear the warning","The warning is plain: pay the Dock Rats, break them, or never reach the gate unseen."],
        ["send_away","Send the messenger away","You send the messenger away. The warning remains in the soot on your door."]
      ]
    },
    es:{
      title:"Una advertencia en la puerta",
      setup:"Un mensajero manchado de hollín espera fuera de tu refugio. Las Ratas del Muelle quieren que cada recién llegado a Cinderhook sepa quién vigila los callejones.",
      choices:[
        ["hear_warning","Escuchar la advertencia","La advertencia es clara: paga a las Ratas del Muelle, acaba con ellas o nunca llegarás a la puerta sin que te vean."],
        ["send_away","Despedir al mensajero","Despides al mensajero. La advertencia permanece en el hollín de tu puerta."]
      ]
    }
  },
  tavern_suspicious_stranger:{
    en:{
      title:"The Hooded Stranger",
      setup:"A hooded traveler lingers near the tavern door, watching the street whenever your back is turned.",
      choices:[
        ["enter_tavern","Follow them into the tavern","You follow the stranger into the tavern, where the crowd swallows their trail."],
        ["let_them_leave","Let them leave","You let the stranger disappear into the street."]
      ]
    },
    es:{
      title:"El desconocido encapuchado",
      setup:"Un viajero encapuchado ronda la puerta de la taberna y observa la calle cada vez que le das la espalda.",
      choices:[
        ["enter_tavern","Seguirlo dentro de la taberna","Sigues al desconocido hasta la taberna, donde la multitud se traga su rastro."],
        ["let_them_leave","Dejar que se marche","Dejas que el desconocido desaparezca entre las calles."]
      ]
    }
  },
  market_cutpurse:{
    en:{
      title:"A Hand in the Crowd",
      setup:"A market runner brushes past with a warning: a cutpurse is working the busiest lane and watching your coin.",
      choices:[
        ["enter_market","Enter the market","You enter the market with one hand near your coin purse."],
        ["guard_purse","Guard your purse and move on","You secure your purse and leave the cutpurse searching for an easier mark."]
      ]
    },
    es:{
      title:"Una mano entre la multitud",
      setup:"Un corredor del mercado pasa rozándote con una advertencia: un carterista acecha el callejón más concurrido y vigila tu oro.",
      choices:[
        ["enter_market","Entrar al mercado","Entras al mercado con una mano cerca de la bolsa de monedas."],
        ["guard_purse","Proteger tu bolsa y seguir adelante","Aseguras tu bolsa y dejas que el carterista busque una presa más fácil."]
      ]
    }
  }
};

for(const eventId of EXPECTED_EVENT_IDS){
  for(const language of ["en","es"]){
    const presentation = selectStorytellerPresentation(eventId,language);
    const expected = expectedPresentations[eventId][language];
    assert.equal(presentation.id,eventId);
    assert.equal(presentation.title,expected.title);
    assert.equal(presentation.setup,expected.setup);
    assert.deepEqual(
      presentation.choices.map(choice=>[choice.id,choice.label,choice.outcome]),
      expected.choices,
      `${eventId} must expose only fixed ${language.toUpperCase()} choices and outcomes`
    );
  }
}
assert.equal(selectStorytellerPresentation("invented_event","en"),null);
assert.deepEqual(
  selectStorytellerPresentation("market_cutpurse","unsupported"),
  selectStorytellerPresentation("market_cutpurse","en"),
  "unsupported presentation languages must fall back to English"
);
const mutatedPresentation = selectStorytellerPresentation("market_cutpurse","en");
mutatedPresentation.title = "Changed";
mutatedPresentation.choices[0].label = "Changed";
assert.equal(selectStorytellerPresentation("market_cutpurse","en").title,"A Hand in the Crowd");
assert.equal(selectStorytellerPresentation("market_cutpurse","en").choices[0].label,"Enter the market");

const pristineBefore = createStorytellerState();
const pristineSnapshot = JSON.stringify(pristineBefore);
const warningBegin = beginStorytellerPresentation(deepFreeze(pristineBefore),{
  eventId:"cinderhook_warning_messenger",
  locationId:"ashen_slums",
  calendarOrdinal:1
});
assert.equal(JSON.stringify(pristineBefore),pristineSnapshot,"begin transition must not mutate its input");
assert.equal(warningBegin.ok,true);
assert.deepEqual(warningBegin.pending,{
  sequence:1,
  eventId:"cinderhook_warning_messenger",
  status:"presented",
  locationId:"ashen_slums",
  calendarOrdinal:1
});
assert.equal(warningBegin.state.sequence,1);
assert.equal(warningBegin.state.history.length,1);
assert.equal(warningBegin.state.history[0].status,"presented");
assert.equal(warningBegin.state.lastByEvent.cinderhook_warning_messenger.seenCount,1);
assert.equal(warningBegin.state.lastByEvent.cinderhook_warning_messenger.eligibleAfterOrdinal,4);
assert.equal(warningBegin.state.globalEligibleAfterOrdinal,0);
warningBegin.pending.locationId = "changed";
assert.equal(warningBegin.state.pending.locationId,"ashen_slums","begin result metadata must be detached from persisted state");

for(const [request,code] of [
  [{eventId:"invented_event",locationId:"ashen_slums",calendarOrdinal:1},"unknown_event"],
  [{eventId:"market_cutpurse",locationId:"",calendarOrdinal:1},"location_mismatch"],
  [{eventId:"market_cutpurse",locationId:"ashen_slums",calendarOrdinal:0},"context_unavailable"]
]){
  const failed = beginStorytellerPresentation(createStorytellerState(),request);
  assert.equal(failed.ok,false);
  assert.equal(failed.error.code,code);
  assert.deepEqual(failed.state,createStorytellerState());
}
const duplicateBegin = beginStorytellerPresentation(warningBegin.state,{
  eventId:"market_cutpurse",
  locationId:"ashen_slums",
  calendarOrdinal:1
});
assert.equal(duplicateBegin.ok,false);
assert.equal(duplicateBegin.error.code,"pending_story_event");
assert.equal(duplicateBegin.state.history.length,1);

const boundedBegin = beginStorytellerPresentation(boundedHistory,{
  eventId:"market_cutpurse",
  locationId:"ashen_slums",
  calendarOrdinal:26
});
assert.equal(boundedBegin.ok,true);
assert.equal(boundedBegin.state.sequence,26);
assert.equal(boundedBegin.state.history.length,20);
assert.equal(boundedBegin.state.history[0].sequence,7);
assert.equal(boundedBegin.state.history.at(-1).sequence,26);

const marketBegin = beginStorytellerPresentation(createStorytellerState(),{
  eventId:"market_cutpurse",
  locationId:"ashen_slums",
  calendarOrdinal:1
});
const marketPresentedSnapshot = JSON.stringify(marketBegin.state);
const marketResolved = resolveStorytellerChoice(deepFreeze(marketBegin.state),{
  eventId:"market_cutpurse",
  choiceId:"guard_purse",
  resolvedOrdinal:2
});
assert.equal(JSON.stringify(marketBegin.state),marketPresentedSnapshot,"resolve transition must not mutate its input");
assert.equal(marketResolved.ok,true);
assert.equal(marketResolved.state.pending,null);
assert.equal(marketResolved.state.globalEligibleAfterOrdinal,3);
assert.equal(marketResolved.state.history.length,1,"resolution must update the presentation row instead of appending another occurrence");
assert.equal(marketResolved.state.history[0].sequence,marketBegin.state.history[0].sequence);
assert.deepEqual(marketResolved.state.history[0],{
  sequence:1,
  eventId:"market_cutpurse",
  status:"resolved",
  choiceId:"guard_purse",
  outcomeId:"guard_purse",
  locationId:"ashen_slums",
  calendarOrdinal:1,
  resolvedOrdinal:2
});
assert.deepEqual(marketResolved.state.lastByEvent.market_cutpurse,{
  seenCount:1,
  lastOrdinal:1,
  eligibleAfterOrdinal:6,
  lastChoiceId:"guard_purse",
  status:"resolved"
});
assert.deepEqual(marketResolved.resolution,{
  sequence:1,
  eventId:"market_cutpurse",
  choiceId:"guard_purse",
  outcomeId:"guard_purse",
  locationId:"ashen_slums",
  calendarOrdinal:1,
  resolvedOrdinal:2
});

const badChoice = resolveStorytellerChoice(marketBegin.state,{
  eventId:"market_cutpurse",
  choiceId:"invented_choice",
  resolvedOrdinal:2
});
assert.equal(badChoice.ok,false);
assert.equal(badChoice.error.code,"unknown_choice");
assert.equal(badChoice.state.history[0].status,"presented");
const mismatchedChoice = resolveStorytellerChoice(marketBegin.state,{
  eventId:"cinderhook_warning_messenger",
  choiceId:"hear_warning",
  resolvedOrdinal:2
});
assert.equal(mismatchedChoice.ok,false);
assert.equal(mismatchedChoice.error.code,"pending_event_mismatch");
const repeatedResolution = resolveStorytellerChoice(marketResolved.state,{
  eventId:"market_cutpurse",
  choiceId:"guard_purse",
  resolvedOrdinal:2
});
assert.equal(repeatedResolution.ok,false);
assert.equal(repeatedResolution.error.code,"no_pending_story_event");
assert.equal(repeatedResolution.state.history.length,1);

const warningResolved = resolveStorytellerChoice(warningBegin.state,{
  eventId:"cinderhook_warning_messenger",
  choiceId:"hear_warning",
  resolvedOrdinal:1
});
assert.equal(warningResolved.ok,true);
const warningOccurrenceInput = baseInput();
warningOccurrenceInput.gameState.world.day = 2;
warningOccurrenceInput.gameState.world.storyteller = warningResolved.state;
const warningOccurrence = selectStorytellerOptions(deepFreeze(warningOccurrenceInput));
assert.ok(!eventIds(warningOccurrence).includes("cinderhook_warning_messenger"));
assert.equal(
  warningOccurrence.eventEligibilityStates.find(event=>event.eventId === "cinderhook_warning_messenger").reasonCode,
  "max_occurrences_reached",
  "a resolved one-shot event must remain blocked by its durable occurrence count"
);

const marketGlobalCooldownInput = baseInput();
marketGlobalCooldownInput.gameState.world.day = 2;
marketGlobalCooldownInput.gameState.world.storyteller = marketResolved.state;
const marketGlobalCooldown = selectStorytellerOptions(deepFreeze(marketGlobalCooldownInput));
assert.equal(marketGlobalCooldown.status,"blocked");
assert.equal(marketGlobalCooldown.blockedReasonCode,"global_cooldown");
assert.equal(marketGlobalCooldown.cooldown.globalDaysRemaining,1);

const marketEventCooldownInput = baseInput();
marketEventCooldownInput.gameState.world.day = 3;
marketEventCooldownInput.gameState.world.storyteller = marketResolved.state;
const marketEventCooldown = selectStorytellerOptions(deepFreeze(marketEventCooldownInput));
assert.equal(marketEventCooldown.status,"ready");
assert.ok(!eventIds(marketEventCooldown).includes("market_cutpurse"));
assert.deepEqual(
  marketEventCooldown.eventEligibilityStates.find(event=>event.eventId === "market_cutpurse"),
  {
    eventId:"market_cutpurse",
    eligible:false,
    reasonCode:"event_cooldown",
    eligibleAfterOrdinal:6,
    daysRemaining:3
  }
);

const marketCooldownReadyInput = baseInput();
marketCooldownReadyInput.gameState.world.day = 6;
marketCooldownReadyInput.gameState.world.storyteller = marketResolved.state;
const marketCooldownReady = selectStorytellerOptions(deepFreeze(marketCooldownReadyInput));
const recurringMarket = marketCooldownReady.eligibleEvents.find(event=>event.id === "market_cutpurse");
assert.ok(recurringMarket,"the recurring market event must become eligible exactly at its durable cooldown ordinal");
assert.equal(recurringMarket.cooldown.priorOccurrences,1);

const eligibleInput = baseInput();
const eligibleBefore = JSON.stringify(eligibleInput);
const eligible = selectStorytellerOptions(deepFreeze(eligibleInput));
assert.equal(JSON.stringify(eligibleInput),eligibleBefore,"eligibility selection must not mutate frozen live context");
assert.equal(eligible.status,"ready");
assert.deepEqual(eventIds(eligible),EXPECTED_EVENT_IDS);
assert.equal(eligible.blockedReasonCode,null);
assert.match(eligible.eligibilityKey,/^story-eligibility-v1-[0-9a-f]{16}$/);
assert.ok(eligible.eligibleEvents.every(event=>event.choices.length === 2));
assert.ok(eligible.eligibleEvents.every(event=>event.context.locationId === "ashen_slums"));
assert.doesNotMatch(JSON.stringify(eligible),/FE\.|futureRoute|requiredActionId|serviceEventId|function/i);

const stable = selectStorytellerOptions(baseInput());
assert.equal(stable.eligibilityKey,eligible.eligibilityKey,"unchanged eligibility context must have a stable internal fingerprint");

eligible.eligibleEvents[0].title = "Changed copy";
eligible.eligibleEvents[0].choices[0].label = "Changed choice";
eligible.context.locationId = "changed_location";
const detached = selectStorytellerOptions(baseInput());
assert.equal(detached.eligibleEvents[0].title,"A Warning at the Door");
assert.equal(detached.eligibleEvents[0].choices[0].label,"Hear the warning");
assert.equal(detached.context.locationId,"ashen_slums");

const wrongLocationInput = baseInput();
wrongLocationInput.gameState.world.locationId = "ashen_fields";
wrongLocationInput.placeContext = {...wrongLocationInput.placeContext,id:"ashen_fields",services:[]};
wrongLocationInput.actionSnapshots = [{id:"world",applicable:true,actions:[{id:"location.open_map",enabled:true}]}];
wrongLocationInput.questSections = [];
const wrongLocation = selectStorytellerOptions(wrongLocationInput);
assert.equal(wrongLocation.status,"ready");
assert.deepEqual(wrongLocation.eligibleEvents,[]);
assert.equal(wrongLocation.blockedReasonCode,"no_eligible_events");

const combatInput = baseInput();
combatInput.uiContext = {...combatInput.uiContext,interaction_layer:"combat",combat_active:true};
combatInput.safetyContext = {...combatInput.safetyContext,combat_active:true};
const combat = selectStorytellerOptions(combatInput);
assert.equal(combat.status,"blocked");
assert.equal(combat.blockedReasonCode,"combat_active");
assert.deepEqual(combat.eligibleEvents,[]);

const modalInput = baseInput();
modalInput.uiContext = {...modalInput.uiContext,interaction_layer:"modal",blocking_modal_open:true};
modalInput.safetyContext = {...modalInput.safetyContext,blocking_interaction_open:true};
const modal = selectStorytellerOptions(modalInput);
assert.equal(modal.status,"blocked");
assert.equal(modal.blockedReasonCode,"blocking_interaction");

const travelInput = baseInput();
travelInput.placeContext = {
  type:"roadStop",
  id:"broken_road",
  isTraveling:true,
  status:"moving",
  services:[]
};
travelInput.worldInteractionContext = {...travelInput.worldInteractionContext,travel_active:true,travel_status:"moving"};
const travel = selectStorytellerOptions(travelInput);
assert.equal(travel.status,"blocked");
assert.equal(travel.blockedReasonCode,"travel_in_progress");

const titleInput = baseInput();
titleInput.gameState = null;
titleInput.placeContext = null;
titleInput.uiContext = {...titleInput.uiContext,current_screen:null,interaction_layer:"title"};
const title = selectStorytellerOptions(titleInput);
assert.equal(title.status,"blocked");
assert.equal(title.blockedReasonCode,"no_active_game");
assert.deepEqual(title.eligibleEvents,[]);

const traversalInput = baseInput();
traversalInput.worldInteractionContext = {...traversalInput.worldInteractionContext,scene_traversal_active:true};
const traversal = selectStorytellerOptions(traversalInput);
assert.equal(traversal.blockedReasonCode,"world_interaction_active");

for(const partial of [
  {uiContext:null},
  {uiContext:{}},
  {safetyContext:null},
  {safetyContext:{}},
  {worldInteractionContext:null},
  {worldInteractionContext:{}},
  {placeContext:{type:"majorLocation",id:"ashen_slums"}}
]){
  const partialInput = {...baseInput(),...partial};
  const partialResult = selectStorytellerOptions(partialInput);
  assert.equal(partialResult.status,"blocked");
  assert.equal(partialResult.blockedReasonCode,"context_unavailable");
  assert.deepEqual(partialResult.eligibleEvents,[]);
}

for(const calendar of [{month:0,day:1},{month:1,day:0},{month:1,day:31},{month:"bad",day:1}]){
  const calendarInput = baseInput();
  Object.assign(calendarInput.gameState.world,calendar);
  const malformedCalendar = selectStorytellerOptions(calendarInput);
  assert.equal(malformedCalendar.status,"blocked");
  assert.equal(malformedCalendar.blockedReasonCode,"context_unavailable");
  assert.deepEqual(malformedCalendar.eligibleEvents,[]);
}

const partialActionsInput = baseInput();
partialActionsInput.actionSnapshots.forEach(snapshot=>delete snapshot.applicable);
partialActionsInput.actionSnapshots.forEach(snapshot=>snapshot.actions.forEach(action=>delete action.enabled));
const partialActions = selectStorytellerOptions(partialActionsInput);
assert.deepEqual(partialActions.eligibleEvents,[],"partial action projections must never enable Storyteller events");

const historyInput = baseInput();
historyInput.gameState.world.storyteller = {
  history:[{eventId:"cinderhook_warning_messenger",status:"resolved",calendarOrdinal:1}],
  lastByEvent:{tavern_suspicious_stranger:{eligibleAfterOrdinal:5}}
};
const historyFiltered = selectStorytellerOptions(historyInput);
assert.deepEqual(eventIds(historyFiltered),["market_cutpurse"]);

const durableOnceInput = baseInput();
durableOnceInput.gameState.world.storyteller = {
  history:[],
  lastByEvent:{cinderhook_warning_messenger:{seenCount:1,lastOrdinal:1}}
};
assert.ok(!eventIds(selectStorytellerOptions(durableOnceInput)).includes("cinderhook_warning_messenger"));

const globalCooldownInput = baseInput();
globalCooldownInput.gameState.world.storyteller = {globalEligibleAfterOrdinal:4,history:[]};
const globalCooldown = selectStorytellerOptions(globalCooldownInput);
assert.equal(globalCooldown.status,"blocked");
assert.equal(globalCooldown.blockedReasonCode,"global_cooldown");
assert.equal(globalCooldown.cooldown.globalDaysRemaining,3);

const maskedCooldownInput = baseInput();
maskedCooldownInput.gameState.world.storyteller = {globalEligibleAfterOrdinal:4,history:[]};
maskedCooldownInput.uiContext = {...maskedCooldownInput.uiContext,interaction_layer:"combat",combat_active:true};
maskedCooldownInput.safetyContext = {...maskedCooldownInput.safetyContext,combat_active:true};
const maskedCooldown = selectStorytellerOptions(maskedCooldownInput);
assert.equal(maskedCooldown.blockedReasonCode,"combat_active");
assert.equal(maskedCooldown.cooldown.globalReady,false);
assert.equal(maskedCooldown.cooldown.globalDaysRemaining,3);

const pendingInput = baseInput();
pendingInput.gameState.world.storyteller = {active:{eventId:"market_cutpurse"},history:[]};
const pending = selectStorytellerOptions(pendingInput);
assert.equal(pending.blockedReasonCode,"pending_story_event");

const malformedLocationInput = baseInput();
malformedLocationInput.gameState.world.locationId = "missing_location";
const malformedLocation = selectStorytellerOptions(malformedLocationInput);
assert.equal(malformedLocation.blockedReasonCode,"location_mismatch");

const spanishInput = baseInput();
spanishInput.language = "es";
const spanish = selectStorytellerOptions(spanishInput);
assert.equal(spanish.language,"es");
assert.equal(spanish.eligibleEvents[0].title,"Una advertencia en la puerta");
assert.equal(spanish.eligibleEvents[1].choices[0].label,"Seguirlo dentro de la taberna");
assert.match(spanish.eligibleEvents[2].reason,/mercado abierto/i);

const gateOpenInput = baseInput();
gateOpenInput.questSections[0].gate.unlocked = true;
gateOpenInput.questSections[0].gate.requirements.gang_pressure.met = true;
gateOpenInput.actionSnapshots[1].actions = [];
assert.deepEqual(eventIds(selectStorytellerOptions(gateOpenInput)),[
  "tavern_suspicious_stranger",
  "market_cutpurse"
]);

const poorInput = baseInput();
poorInput.gameState.hero.gold = 5;
assert.deepEqual(eventIds(selectStorytellerOptions(poorInput)),[
  "cinderhook_warning_messenger",
  "tavern_suspicious_stranger"
]);

const fingerprintAInput = baseInput();
fingerprintAInput.gameState.world.day = 10;
fingerprintAInput.gameState.world.storyteller = {
  history:[],
  lastByEvent:{tavern_suspicious_stranger:{lastOrdinal:1,seenCount:0}}
};
const fingerprintBInput = baseInput();
fingerprintBInput.gameState.world.day = 10;
fingerprintBInput.gameState.world.storyteller = {
  history:[],
  lastByEvent:{tavern_suspicious_stranger:{lastOrdinal:2,seenCount:0}}
};
const fingerprintA = selectStorytellerOptions(fingerprintAInput);
const fingerprintB = selectStorytellerOptions(fingerprintBInput);
assert.deepEqual(eventIds(fingerprintA),eventIds(fingerprintB),"both past cooldowns should leave the same eligible IDs");
assert.notEqual(fingerprintA.eligibilityKey,fingerprintB.eligibilityKey,"the fingerprint must include durable per-event cooldown inputs");

assert.equal(storageAccesses,0,"Storyteller selectors and pure state transitions must not read or write localStorage");
assert.equal(Object.hasOwn(baseInput().gameState.world,"storyteller"),false,"read selection must not create Storyteller save state");

console.log("PASS Storyteller catalog, normalization, pure transitions, fixed EN/ES presentation, cooldowns, and detached output");
