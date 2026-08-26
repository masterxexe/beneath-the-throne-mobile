#!/usr/bin/env node
import assert from "node:assert/strict";
import { getStorytellerEventIds, selectStorytellerOptions } from "../src/storyteller.js";

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

assert.equal(storageAccesses,0,"Storyteller eligibility must not read or write localStorage");
assert.equal(Object.hasOwn(baseInput().gameState.world,"storyteller"),false,"read selection must not create Storyteller save state");

console.log("PASS Storyteller catalog IDs, pure eligibility, EN/ES, safety blockers, cooldown reads, and detached output");
