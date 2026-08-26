#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const EXPECTED_TOOLS = [
  "get_available_actions",
  "get_current_location",
  "get_equipment",
  "get_inventory",
  "get_player_status",
  "get_quest_log"
];

const MIME_TYPES = {
  ".css":"text/css; charset=utf-8",
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",
  ".png":"image/png",
  ".svg":"image/svg+xml",
  ".webmanifest":"application/manifest+json"
};

function browserExecutable(){
  const candidates = [
    process.env.CHROME,
    process.env.EDGE,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  const found = candidates.find(candidate=>fs.existsSync(candidate));
  if(!found)throw new Error("Set CHROME or EDGE to an installed Chromium browser executable.");
  return found;
}

function createStaticServer(){
  return http.createServer((request,response)=>{
    let pathname;
    try{
      pathname = decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);
    }catch{
      response.writeHead(400).end("Bad request");
      return;
    }
    if(pathname === "/")pathname = "/index.html";
    const target = path.resolve(ROOT,`.${pathname}`);
    if(target !== ROOT && !target.startsWith(`${ROOT}${path.sep}`)){
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(target,(statError,stat)=>{
      if(statError || !stat.isFile()){
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200,{
        "Content-Type":MIME_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
        "Cache-Control":"no-store"
      });
      fs.createReadStream(target).pipe(response);
    });
  });
}

function trackPageErrors(page){
  const errors = [];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("requestfailed",request=>{
    if(request.url().startsWith("http://127.0.0.1")){
      errors.push(`${request.failure()?.errorText || "request failed"}: ${request.url()}`);
    }
  });
  return errors;
}

async function openGame(page,baseUrl){
  await page.goto(`${baseUrl}/?webmcp-test=${Date.now()}`,{
    waitUntil:"domcontentloaded",
    timeout:60000
  });
  await page.waitForFunction(()=>window.__BTT_BOOTED === true,{timeout:30000});
}

async function testWithoutWebMcp(browser,baseUrl){
  const page = await browser.newPage();
  const errors = trackPageErrors(page);
  await page.evaluateOnNewDocument(()=>{
    try{Object.defineProperty(document,"modelContext",{configurable:true,value:undefined});}catch{}
    try{Object.defineProperty(navigator,"modelContext",{configurable:true,value:undefined});}catch{}
  });
  await openGame(page,baseUrl);

  const title = await page.evaluate(()=>({
    newGame:[...document.querySelectorAll("button")].some(button=>/new game/i.test(button.textContent || "")),
    loadGame:[...document.querySelectorAll("button")].some(button=>/load game/i.test(button.textContent || "")),
    setupVisible:document.getElementById("setup")?.style.display !== "none"
  }));
  assert.equal(title.newGame,true,"New Game should remain available without WebMCP");
  assert.equal(title.loadGame,true,"Load Game should remain available without WebMCP");
  assert.equal(title.setupVisible,true,"the normal title screen should render without WebMCP");

  const gameplay = await page.evaluate(()=>{
    window.FE.startActualGame("Fallback Tester","warrior");
    window.FE.show("gear");
    return {
      gameVisible:document.getElementById("game")?.style.display === "block",
      savePresent:localStorage.getItem("fallenEmpireSave_1") !== null
    };
  });
  await page.waitForFunction(()=>document.getElementById("gear")?.classList.contains("active") === true,{timeout:10000});
  assert.deepEqual(gameplay,{gameVisible:true,savePresent:true});

  await page.evaluate(async()=>{
    if("serviceWorker" in navigator)await navigator.serviceWorker.ready;
  });
  await page.reload({waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__BTT_BOOTED === true,{timeout:30000});
  await page.setOfflineMode(true);
  await page.reload({waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(()=>window.__BTT_BOOTED === true,{timeout:30000});
  const offlineBoot = await page.evaluate(()=>({
    title:document.querySelector("h1")?.textContent?.trim() || "",
    savePresent:localStorage.getItem("fallenEmpireSave_1") !== null
  }));
  await page.setOfflineMode(false);
  assert.match(offlineBoot.title,/Beneath the Throne/i,"the PWA should boot from its existing offline cache path");
  assert.equal(offlineBoot.savePresent,true,"the existing local save should survive PWA reloads");
  assert.deepEqual(errors,[],`normal boot produced browser errors: ${errors.join(" | ")}`);
  await page.close();
}

async function testWithWebMcp(browser,baseUrl){
  const page = await browser.newPage();
  const errors = trackPageErrors(page);
  await page.evaluateOnNewDocument(()=>{
    const tools = {};
    const modelContext = {
      registerTool(tool){
        if(!tool?.name || typeof tool.execute !== "function")throw new Error("Invalid WebMCP tool");
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    };
    Object.defineProperty(document,"modelContext",{configurable:true,value:modelContext});
  });
  await openGame(page,baseUrl);
  await page.waitForFunction(()=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === 6,{timeout:10000});

  const registration = await page.evaluate(()=>Object.values(window.__WEBMCP_TEST_TOOLS).map(tool=>({
    name:tool.name,
    readOnly:tool.annotations?.readOnlyHint,
    inputType:tool.inputSchema?.type,
    properties:Object.keys(tool.inputSchema?.properties || {}),
    additionalProperties:tool.inputSchema?.additionalProperties
  })).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.deepEqual(registration.map(tool=>tool.name),EXPECTED_TOOLS);
  for(const tool of registration){
    assert.equal(tool.readOnly,true,`${tool.name} must be marked read-only`);
    assert.equal(tool.inputType,"object");
    assert.deepEqual(tool.properties,[]);
    assert.equal(tool.additionalProperties,false);
  }

  const titleResponses = await page.evaluate(async()=>{
    const entries = await Promise.all(Object.entries(window.__WEBMCP_TEST_TOOLS).map(async([name,tool])=>[
      name,
      await tool.execute({})
    ]));
    return Object.fromEntries(entries);
  });
  for(const name of EXPECTED_TOOLS){
    assert.equal(titleResponses[name].ok,false,`${name} should report that no game is active on the title screen`);
    assert.equal(titleResponses[name].error.code,"no_active_game");
  }

  const actual = await page.evaluate(async()=>{
    window.FE.startActualGame("WebMCP Tester","warrior");
    const stateModule = await import("./src/state.js");
    const before = JSON.stringify(stateModule.state);
    const saveBefore = localStorage.getItem("fallenEmpireSave_1");
    const responses = {};
    for(const [name,tool] of Object.entries(window.__WEBMCP_TEST_TOOLS)){
      responses[name] = await tool.execute({});
    }
    const after = JSON.stringify(stateModule.state);
    const saveAfter = localStorage.getItem("fallenEmpireSave_1");
    responses.get_player_status.player.name = "Changed copy";
    responses.get_player_status.player.attributes.strength = 999;
    responses.get_player_status.player.elemental_resistances.fire = 999;
    responses.get_inventory.inventory.resources.food = 999;
    responses.get_current_location.location.services.push("fake_service");
    responses.get_quest_log.quest_log.chapters[0].quests[0].name = "Changed quest copy";
    responses.get_quest_log.quest_log.chapters[0].quests[0].reward.gold = 999;
    const firstUiAction = responses.get_available_actions.actions.player_ui_controlled[0];
    if(firstUiAction)firstUiAction.parameters.changed = true;
    const reread = {
      status:await window.__WEBMCP_TEST_TOOLS.get_player_status.execute({}),
      inventory:await window.__WEBMCP_TEST_TOOLS.get_inventory.execute({}),
      location:await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({}),
      quests:await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({}),
      actions:await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({})
    };

    const worldBeforeTravel = JSON.parse(JSON.stringify(stateModule.state.world));
    stateModule.state.world.locationId = "ashen_keep";
    stateModule.state.world.region = 0;
    const keepActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    window.FE.travelToLocation("ashen_fields");
    const travelBeforeRead = JSON.stringify(stateModule.state.world);
    const travelContextBeforeRead = JSON.stringify(window.FE.getCurrentPlaceContext({repairWorld:false}));
    const liveTravel = await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({});
    const liveTravelActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const travelContextAfterRead = JSON.stringify(window.FE.getCurrentPlaceContext({repairWorld:false}));
    const travelAfterRead = JSON.stringify(stateModule.state.world);
    window.FE.cancelTravel();
    stateModule.state.world = worldBeforeTravel;

    const originalWorld = JSON.parse(JSON.stringify(stateModule.state.world));
    stateModule.state.world.locationId = "missing_location";
    stateModule.state.world.previousLocationId = "missing_previous_location";
    delete stateModule.state.world.routeHistory;
    stateModule.state.world.region = 999;
    const malformedBefore = JSON.stringify(stateModule.state.world);
    const malformedLocation = await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({});
    const malformedAfter = JSON.stringify(stateModule.state.world);
    stateModule.state.world = originalWorld;
    return {
      before,after,saveBefore,saveAfter,responses,reread,
      keepActions,travelBeforeRead,travelAfterRead,travelContextBeforeRead,travelContextAfterRead,liveTravel,liveTravelActions,
      malformedBefore,malformedAfter,malformedLocation
    };
  });

  assert.equal(actual.before,actual.after,"read-only tool calls must not mutate the live game state");
  assert.equal(actual.saveBefore,actual.saveAfter,"read-only tool calls must not rewrite the active save");
  assert.equal(actual.responses.get_player_status.ok,true);
  assert.equal(actual.responses.get_player_status.player.level,1);
  assert.equal(actual.responses.get_player_status.player.combat.total_attack,22);
  assert.equal(actual.responses.get_player_status.player.combat.total_defense,13);
  assert.equal(actual.responses.get_inventory.ok,true);
  assert.equal(actual.responses.get_inventory.inventory.consumables.health_potion.quantity,2);
  assert.equal(actual.responses.get_inventory.inventory.consumables.mana_potion.quantity,1);
  assert.equal(actual.responses.get_equipment.ok,true);
  assert.equal(Object.keys(actual.responses.get_equipment.equipment.slots).length,11);
  assert.ok(Object.values(actual.responses.get_equipment.equipment.slots).every(item=>item === null));
  assert.equal(actual.responses.get_equipment.equipment.total_attack,22);
  assert.equal(actual.responses.get_equipment.equipment.total_defense,13);
  assert.equal(actual.responses.get_equipment.equipment.total_attack,actual.responses.get_player_status.player.combat.total_attack);
  assert.equal(actual.responses.get_equipment.equipment.total_defense,actual.responses.get_player_status.player.combat.total_defense);
  assert.equal(actual.responses.get_current_location.ok,true);
  assert.equal(actual.responses.get_current_location.location.id,"ashen_slums");
  assert.equal(actual.responses.get_current_location.location.is_traveling,false);
  assert.equal(actual.responses.get_quest_log.ok,true);
  assert.equal(actual.responses.get_quest_log.quest_log.language,"en");
  assert.deepEqual(actual.responses.get_quest_log.quest_log.chapters.map(chapter=>chapter.id),["cinderhook","lower_ward"]);
  const cinderhook = actual.responses.get_quest_log.quest_log.chapters[0];
  const lowerWard = actual.responses.get_quest_log.quest_log.chapters[1];
  assert.equal(cinderhook.quests.find(quest=>quest.id === "ration_marks").status,"available");
  assert.equal(cinderhook.quests.find(quest=>quest.id === "forge_scrap").status,"locked");
  assert.equal(lowerWard.status,"locked");
  assert.equal(actual.responses.get_available_actions.ok,true);
  assert.equal(actual.responses.get_available_actions.mutation_tools_enabled,false);
  assert.deepEqual(
    actual.responses.get_available_actions.actions.webmcp_invocable.map(action=>action.id).sort(),
    [...EXPECTED_TOOLS].sort()
  );
  const freshUiActions = actual.responses.get_available_actions.actions.player_ui_controlled;
  const freshBlockedActions = actual.responses.get_available_actions.actions.blocked_player_ui_actions;
  assert.ok(freshUiActions.some(action=>action.id === "cinderhook.open_contract_board"));
  assert.ok(freshBlockedActions.some(action=>action.id === "location.hunt_nearby" && action.blocked_reason_code === "chapter_one_gate_locked"));
  assert.ok([...freshUiActions,...freshBlockedActions].every(action=>action.execution === "player_ui_only" && action.webmcp_invocable === false && action.webmcp_tool === null));
  assert.ok(!actual.responses.get_available_actions.actions.webmcp_invocable.some(action=>["use_item","equip_item"].includes(action.id)));
  assert.doesNotMatch(JSON.stringify(actual.responses.get_quest_log),/FE\./,"quest projections must not expose executable UI strings");
  assert.equal(actual.reread.status.player.name,"WebMCP Tester","player status must be a detached copy");
  assert.equal(actual.reread.status.player.attributes.strength,4,"attributes must be a detached copy");
  assert.equal(actual.reread.status.player.elemental_resistances.fire,0,"resistances must be a detached copy");
  assert.equal(actual.reread.inventory.inventory.resources.food,5,"inventory must be a detached copy");
  assert.ok(!actual.reread.location.location.services.includes("fake_service"),"location services must be a detached copy");
  assert.equal(actual.reread.quests.quest_log.chapters[0].quests[0].name,"Recover Stolen Food","quest entries must be detached copies");
  assert.equal(actual.reread.quests.quest_log.chapters[0].quests[0].reward.gold,5,"quest rewards must be detached copies");
  const changedActionId = actual.responses.get_available_actions.actions.player_ui_controlled[0]?.id;
  if(changedActionId){
    const rereadAction = actual.reread.actions.actions.player_ui_controlled.find(action=>action.id === changedActionId);
    assert.ok(rereadAction && rereadAction.parameters.changed === undefined,"available actions must be detached copies");
  }
  assert.equal(actual.travelBeforeRead,actual.travelAfterRead,"an active-travel location read must not mutate persisted world state");
  assert.equal(actual.travelContextBeforeRead,actual.travelContextAfterRead,"available-action reads must not mutate live journey state");
  assert.equal(actual.liveTravel.location.type,"roadStop");
  assert.equal(actual.liveTravel.location.is_traveling,true);
  assert.equal(actual.liveTravel.journey.status,"moving");
  assert.equal(actual.liveTravel.journey.origin_location_id,"ashen_keep");
  assert.equal(actual.liveTravel.journey.destination.id,"ashen_fields");
  assert.equal(actual.liveTravelActions.context.world.is_traveling,true);
  assert.ok(actual.liveTravelActions.actions.player_ui_controlled.some(action=>action.id === "journey.cancel"));
  assert.ok(actual.liveTravelActions.actions.blocked_player_ui_actions.some(action=>action.id === "journey.continue"));
  assert.ok(![...actual.liveTravelActions.actions.player_ui_controlled,...actual.liveTravelActions.actions.blocked_player_ui_actions].some(action=>action.id.startsWith("location.")),"origin location actions must not leak during travel");
  assert.ok(actual.keepActions.actions.player_ui_controlled.some(action=>action.id === "location.hunt_nearby"),"the cinematic command rail should expose Hunt Nearby");
  assert.ok(actual.keepActions.actions.player_ui_controlled.some(action=>action.id === "location.scout_nearby"),"the cinematic command rail should expose Scout Nearby");
  assert.equal(actual.malformedBefore,actual.malformedAfter,"location reads must not repair or otherwise mutate malformed state");
  assert.equal(actual.malformedLocation.location.id,"ashen_slums","a malformed location should be read through the existing safe fallback");

  const scenarios = await page.evaluate(async()=>{
    const stateModule = await import("./src/state.js");
    const languageModule = await import("./src/language.js");
    const combatModule = await import("./src/combat.js");
    const worldModule = await import("./src/world.js");
    const baseline = JSON.parse(JSON.stringify(stateModule.state));
    window.FE.closeModals();

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    stateModule.state.world.locationId = "ashen_keep";
    worldModule.debugEnterRoadStopScene("ashen_gate","market_town");
    stateModule.state.world.roadStopStates.ashen_gate = {type:"camp",stage:"basic"};
    stateModule.state.hero.food = 0;
    const campNoFoodBefore = JSON.stringify(stateModule.state);
    const campNoFoodActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const campNoFoodAfter = JSON.stringify(stateModule.state);
    stateModule.state.hero.food = 2;
    const campReadyBefore = JSON.stringify(stateModule.state);
    const campReadyActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const campReadyAfter = JSON.stringify(stateModule.state);
    worldModule.continueJourney();
    const campMovingBefore = JSON.stringify(stateModule.state);
    const campMovingActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const campMovingAfter = JSON.stringify(stateModule.state);
    worldModule.cancelTravel();

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    stateModule.state.prologue.lowerWardGate.unlocked = true;
    stateModule.state.prologue.phase = "gateUnlocked";
    stateModule.state.world.locationId = "ashen_slums";
    worldModule.travelToLocation("ashen_keep");
    const cinderTravelBefore = JSON.stringify(stateModule.state);
    const cinderTravelActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const cinderTravelAfter = JSON.stringify(stateModule.state);
    worldModule.cancelTravel();

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    stateModule.state.prologue.contracts.active = "ration_marks";
    stateModule.state.prologue.contracts.failed = ["ration_marks"];
    const cinderBefore = JSON.stringify(stateModule.state);
    const cinderQuests = await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({});
    const cinderActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const cinderAfter = JSON.stringify(stateModule.state);

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    stateModule.state.prologue.lowerWardGate.unlocked = true;
    stateModule.state.prologue.phase = "gateUnlocked";
    stateModule.state.world.locationId = "lower_ward";
    stateModule.state.world.lowerWard.entered = true;
    stateModule.state.world.lowerWard.quests.claimed = ["enter_ward"];
    stateModule.state.world.lowerWard.commissions = 1;
    const wardBefore = JSON.stringify(stateModule.state);
    const wardQuests = await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({});
    const wardActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const wardAfter = JSON.stringify(stateModule.state);

    languageModule.setLanguage("es");
    const spanishBefore = JSON.stringify(stateModule.state);
    const spanishQuests = await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({});
    const spanishActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const spanishAfter = JSON.stringify(stateModule.state);
    languageModule.setLanguage("en");

    stateModule.state.prologue = {contracts:{active:"legacy_unknown",completed:{bad:true},failed:null}};
    stateModule.state.world.lowerWard = null;
    const malformedQuestBefore = JSON.stringify(stateModule.state);
    const malformedQuests = await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({});
    const malformedQuestAfter = JSON.stringify(stateModule.state);

    window.FE.modal("Player choice","<p>Choose in the UI.</p>",[{label:"Continue"}]);
    const modalActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    window.FE.closeModals();

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    window.FE.slumClearAlley();
    const battleBefore = JSON.stringify(combatModule.battle);
    const combatStateBefore = JSON.stringify(stateModule.state);
    const combatSaveBefore = localStorage.getItem("fallenEmpireSave_1");
    const knownBefore = stateModule.state.hero.known;
    const loadoutBefore = stateModule.state.hero.abilityLoadout;
    const combatActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const battleAfter = JSON.stringify(combatModule.battle);
    const combatStateAfter = JSON.stringify(stateModule.state);
    const combatSaveAfter = localStorage.getItem("fallenEmpireSave_1");
    const combatAbilityReferencesPreserved = knownBefore === stateModule.state.hero.known && loadoutBefore === stateModule.state.hero.abilityLoadout;
    window.FE.runBattle();

    return {
      cinderBefore,cinderAfter,cinderQuests,cinderActions,
      wardBefore,wardAfter,wardQuests,wardActions,
      spanishBefore,spanishAfter,spanishQuests,spanishActions,
      malformedQuestBefore,malformedQuestAfter,malformedQuests,
      modalActions,campNoFoodBefore,campNoFoodAfter,campNoFoodActions,campReadyBefore,campReadyAfter,campReadyActions,
      campMovingBefore,campMovingAfter,campMovingActions,
      cinderTravelBefore,cinderTravelAfter,cinderTravelActions,
      battleBefore,battleAfter,combatStateBefore,combatStateAfter,combatSaveBefore,combatSaveAfter,combatAbilityReferencesPreserved,combatActions
    };
  });

  assert.equal(scenarios.cinderBefore,scenarios.cinderAfter,"Cinderhook quest/action reads must not mutate contract state");
  const activeContract = scenarios.cinderQuests.quest_log.chapters[0].quests.find(quest=>quest.id === "ration_marks");
  assert.equal(activeContract.status,"active");
  assert.equal(activeContract.failed_attempts,1);
  assert.equal(activeContract.last_attempt_failed,true);
  assert.ok(scenarios.cinderActions.actions.player_ui_controlled.some(action=>action.id === "cinderhook.start_contract.ration_marks"));
  assert.equal(scenarios.wardBefore,scenarios.wardAfter,"Lower Ward quest/action reads must not mutate or normalize ward state");
  const wardChapter = scenarios.wardQuests.quest_log.chapters.find(chapter=>chapter.id === "lower_ward");
  const readyCommissionQuest = wardChapter.quests.find(quest=>quest.id === "first_commission");
  assert.equal(readyCommissionQuest.status,"ready_to_claim");
  assert.equal(readyCommissionQuest.can_claim,true);
  assert.ok(scenarios.wardActions.actions.player_ui_controlled.some(action=>action.id === "lower_ward.claim_quest.first_commission"));
  assert.equal(scenarios.spanishBefore,scenarios.spanishAfter,"localized reads must not modify game state");
  assert.equal(scenarios.spanishQuests.quest_log.language,"es");
  assert.equal(scenarios.spanishQuests.quest_log.chapters[0].quests[0].name,"Recuperar comida robada");
  assert.ok(scenarios.spanishActions.actions.player_ui_controlled.some(action=>action.label === "Mapa del camino"));
  assert.equal(scenarios.malformedQuestBefore,scenarios.malformedQuestAfter,"quest reads must not normalize malformed or legacy quest state");
  const legacyBlockedQuest = scenarios.malformedQuests.quest_log.chapters[0].quests.find(quest=>quest.id === "ration_marks");
  assert.equal(legacyBlockedQuest.status,"blocked");
  assert.equal(legacyBlockedQuest.blocked_by_quest_id,"legacy_unknown");
  assert.equal(scenarios.modalActions.context.interaction_layer,"modal");
  assert.deepEqual(scenarios.modalActions.actions.player_ui_controlled,[]);
  assert.deepEqual(scenarios.modalActions.actions.blocked_player_ui_actions,[]);
  assert.equal(scenarios.campNoFoodBefore,scenarios.campNoFoodAfter,"camp-rest availability must not modify zero-food journey state");
  assert.ok(scenarios.campNoFoodActions.actions.blocked_player_ui_actions.some(action=>action.id === "journey.rest_at_camp" && action.blocked_reason_code === "not_enough_food"));
  assert.equal(scenarios.campReadyBefore,scenarios.campReadyAfter,"camp-rest availability must not modify ready journey state");
  assert.ok(scenarios.campReadyActions.actions.player_ui_controlled.some(action=>action.id === "journey.rest_at_camp"));
  assert.equal(scenarios.campMovingBefore,scenarios.campMovingAfter,"camp-rest availability must not modify moving journey state");
  assert.ok(scenarios.campMovingActions.actions.blocked_player_ui_actions.some(action=>action.id === "journey.rest_at_camp" && action.blocked_reason_code === "journey_not_at_road_stop"));
  assert.equal(scenarios.cinderTravelBefore,scenarios.cinderTravelAfter,"travel availability must not modify origin chapter state");
  assert.ok(scenarios.cinderTravelActions.actions.player_ui_controlled.some(action=>action.id === "journey.cancel"));
  assert.ok(![...scenarios.cinderTravelActions.actions.player_ui_controlled,...scenarios.cinderTravelActions.actions.blocked_player_ui_actions].some(action=>action.id.startsWith("cinderhook.") || action.id.startsWith("lower_ward.")),"origin chapter actions must not leak during travel");
  assert.equal(scenarios.battleBefore,scenarios.battleAfter,"combat availability reads must not prune or rebuild the battle queue");
  assert.equal(scenarios.combatStateBefore,scenarios.combatStateAfter,"combat availability reads must not normalize or mutate hero state");
  assert.equal(scenarios.combatSaveBefore,scenarios.combatSaveAfter,"combat availability reads must not rewrite the save");
  assert.equal(scenarios.combatAbilityReferencesPreserved,true,"combat availability reads must not replace live ability arrays");
  assert.equal(scenarios.combatActions.context.interaction_layer,"combat");
  assert.ok(scenarios.combatActions.actions.player_ui_controlled.some(action=>action.id === "combat.attack"));
  assert.ok(![...scenarios.combatActions.actions.player_ui_controlled,...scenarios.combatActions.actions.blocked_player_ui_actions].some(action=>action.id.startsWith("location.") || action.id.startsWith("cinderhook.")),"combat context must suppress underlying location actions");
  assert.ok([...scenarios.combatActions.actions.player_ui_controlled,...scenarios.combatActions.actions.blocked_player_ui_actions].every(action=>action.webmcp_invocable === false));

  const projection = await page.evaluate(async()=>{
    const { createWebMcpTools } = await import("./src/webmcp.js");
    const item = {
      id:"test_blade",
      name:"Test Blade",
      slot:"weapon",
      level:2,
      attack:7,
      defense:0,
      value:12,
      quality:"common",
      visualVariant:"private_visual_detail",
      internalNote:"must_not_escape"
    };
    const fixture = {
      hero:{
        name:"Fixture",
        inv:[item],
        gear:{weapon:item},
        companions:[],
        stats:{},
        resists:{}
      },
      world:{locationId:"fixture_place",previousLocationId:null}
    };
    const services = ["market"];
    const questSections = [{id:"fixture_chapter",quests:[{id:"fixture_quest",reward:{gold:3}}]}];
    const actionParameters = {destination_id:"fixture_destination"};
    const actionSnapshots = [{
      id:"world",
      applicable:true,
      context:{location_id:"fixture_place"},
      actions:[{id:"fixture.travel",label:"Travel",category:"travel",enabled:true,parameters:actionParameters}]
    }];
    const tools = createWebMcpTools({
      getState:()=>fixture,
      getTotalAttack:()=>17,
      getTotalDefense:()=>8,
      getWeaponType:()=>"sword",
      getCurrentPlaceContext:()=>({
        type:"majorLocation",
        id:"fixture_place",
        name:"Fixture Place",
        description:"Fixture description",
        danger:1,
        services,
        isTraveling:false
      }),
      getLanguage:()=>"en",
      getQuestLogSections:()=>questSections,
      getUiInteractionContext:()=>({current_screen:"home",interaction_layer:"screen",blocking_modal_open:false,combat_active:false}),
      getActionSnapshots:()=>actionSnapshots,
      getRegisteredWebMcpTools:()=>["get_quest_log","get_available_actions"],
      gearSlots:["weapon"]
    });
    const inventory = await tools.find(tool=>tool.name === "get_inventory").execute({});
    const equipment = await tools.find(tool=>tool.name === "get_equipment").execute({});
    const location = await tools.find(tool=>tool.name === "get_current_location").execute({});
    const quests = await tools.find(tool=>tool.name === "get_quest_log").execute({});
    const actions = await tools.find(tool=>tool.name === "get_available_actions").execute({});
    const toolsWithoutTotals = createWebMcpTools({getState:()=>fixture,gearSlots:["weapon"]});
    const statusWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_player_status").execute({});
    const equipmentWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_equipment").execute({});
    inventory.inventory.items[0].name = "Changed";
    equipment.equipment.slots.weapon.name = "Changed";
    location.location.services.push("Changed");
    quests.quest_log.chapters[0].quests[0].reward.gold = 999;
    actions.actions.player_ui_controlled[0].parameters.destination_id = "changed";
    return {
      inventoryItem:Object.keys(inventory.inventory.items[0]),
      equipmentItem:Object.keys(equipment.equipment.slots.weapon),
      weaponCategory:equipment.equipment.slots.weapon.weapon_category,
      totalAttack:equipment.equipment.total_attack,
      totalDefense:equipment.equipment.total_defense,
      unavailableTotals:{
        statusAttack:statusWithoutTotals.player.combat.total_attack,
        statusDefense:statusWithoutTotals.player.combat.total_defense,
        equipmentAttack:equipmentWithoutTotals.equipment.total_attack,
        equipmentDefense:equipmentWithoutTotals.equipment.total_defense
      },
      registeredReadTools:actions.actions.webmcp_invocable.map(action=>action.id),
      sourceQuestGold:questSections[0].quests[0].reward.gold,
      sourceDestinationId:actionParameters.destination_id,
      liveItemName:item.name,
      liveServices:[...services]
    };
  });
  const expectedItemKeys = ["attack","defense","id","level","name","quality","slot","upgrade_level","value","weapon_category"];
  assert.equal(projection.liveItemName,"Test Blade");
  assert.deepEqual(projection.liveServices,["market"]);
  assert.deepEqual(projection.inventoryItem.sort(),expectedItemKeys);
  assert.deepEqual(projection.equipmentItem.sort(),expectedItemKeys);
  assert.equal(projection.weaponCategory,"sword");
  assert.equal(projection.totalAttack,17);
  assert.equal(projection.totalDefense,8);
  assert.deepEqual(projection.registeredReadTools,["get_quest_log","get_available_actions"]);
  assert.equal(projection.sourceQuestGold,3,"quest selector output must be defensively copied");
  assert.equal(projection.sourceDestinationId,"fixture_destination","action selector output must be defensively copied");
  assert.deepEqual(projection.unavailableTotals,{
    statusAttack:null,
    statusDefense:null,
    equipmentAttack:null,
    equipmentDefense:null
  });

  const travel = await page.evaluate(async()=>{
    const { createWebMcpTools } = await import("./src/webmcp.js");
    const travelState = {hero:{},world:{locationId:"ashen_keep",previousLocationId:"ashen_slums"}};
    const destination = {id:"market_town",name:"First Market Town"};
    const progress = {current:1,total:3};
    const place = {
      type:"roadStop",
      id:"broken_road",
      name:"Broken Road -> Toll Bridge",
      description:"Traveling between road stops.",
      danger:2,
      services:[],
      isTraveling:true,
      status:"moving",
      journeyDestination:destination,
      journeyProgress:progress,
      nextRoadNodeId:"toll_bridge"
    };
    const tool = createWebMcpTools({
      getState:()=>travelState,
      getCurrentPlaceContext:()=>place
    }).find(candidate=>candidate.name === "get_current_location");
    const moving = await tool.execute({});
    place.status = "atRoadStop";
    const stopped = await tool.execute({});
    moving.journey.destination.name = "Changed copy";
    moving.journey.progress.current = 999;
    return {moving,stopped,destination:{...destination},progress:{...progress}};
  });
  assert.equal(travel.moving.journey.status,"moving");
  assert.equal(travel.stopped.journey.status,"atRoadStop");
  assert.equal(travel.stopped.journey.origin_location_id,"ashen_keep");
  assert.equal(travel.stopped.journey.destination.id,"market_town");
  assert.equal(travel.stopped.journey.next_road_node_id,"toll_bridge");
  assert.deepEqual(travel.stopped.journey.progress,{current:1,total:3});
  assert.equal(travel.destination.name,"First Market Town","journey destination must be a detached copy");
  assert.deepEqual(travel.progress,{current:1,total:3},"journey progress must be a detached copy");
  assert.deepEqual(errors,[],`WebMCP boot produced browser errors: ${errors.join(" | ")}`);
  await page.close();
}

async function main(){
  const server = createStaticServer();
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let browser = null;
  try{
    browser = await puppeteer.launch({
      executablePath:browserExecutable(),
      headless:true,
      args:["--no-sandbox","--disable-setuid-sandbox","--window-size=1280,900"]
    });
    await testWithoutWebMcp(browser,baseUrl);
    console.log("PASS normal game boot, gameplay navigation, saving, and offline PWA boot without WebMCP");
    await testWithWebMcp(browser,baseUrl);
    console.log(`PASS ${EXPECTED_TOOLS.join(", ")}`);
    console.log("PASS tool responses are whitelisted detached JSON snapshots");
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

main().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
