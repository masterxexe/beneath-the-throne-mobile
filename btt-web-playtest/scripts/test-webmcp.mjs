#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const EXPECTED_TOOLS = [
  "get_current_location",
  "get_equipment",
  "get_inventory",
  "get_player_status"
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
  await page.waitForFunction(()=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === 4,{timeout:10000});

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
    const reread = {
      status:await window.__WEBMCP_TEST_TOOLS.get_player_status.execute({}),
      inventory:await window.__WEBMCP_TEST_TOOLS.get_inventory.execute({}),
      location:await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({})
    };

    const worldBeforeTravel = JSON.parse(JSON.stringify(stateModule.state.world));
    stateModule.state.world.locationId = "ashen_keep";
    stateModule.state.world.region = 0;
    window.FE.travelToLocation("ashen_fields");
    const travelBeforeRead = JSON.stringify(stateModule.state.world);
    const liveTravel = await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({});
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
      travelBeforeRead,travelAfterRead,liveTravel,
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
  assert.equal(actual.reread.status.player.name,"WebMCP Tester","player status must be a detached copy");
  assert.equal(actual.reread.status.player.attributes.strength,4,"attributes must be a detached copy");
  assert.equal(actual.reread.status.player.elemental_resistances.fire,0,"resistances must be a detached copy");
  assert.equal(actual.reread.inventory.inventory.resources.food,5,"inventory must be a detached copy");
  assert.ok(!actual.reread.location.location.services.includes("fake_service"),"location services must be a detached copy");
  assert.equal(actual.travelBeforeRead,actual.travelAfterRead,"an active-travel location read must not mutate persisted world state");
  assert.equal(actual.liveTravel.location.type,"roadStop");
  assert.equal(actual.liveTravel.location.is_traveling,true);
  assert.equal(actual.liveTravel.journey.status,"moving");
  assert.equal(actual.liveTravel.journey.origin_location_id,"ashen_keep");
  assert.equal(actual.liveTravel.journey.destination.id,"ashen_fields");
  assert.equal(actual.malformedBefore,actual.malformedAfter,"location reads must not repair or otherwise mutate malformed state");
  assert.equal(actual.malformedLocation.location.id,"ashen_slums","a malformed location should be read through the existing safe fallback");

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
      gearSlots:["weapon"]
    });
    const inventory = await tools.find(tool=>tool.name === "get_inventory").execute({});
    const equipment = await tools.find(tool=>tool.name === "get_equipment").execute({});
    const location = await tools.find(tool=>tool.name === "get_current_location").execute({});
    const toolsWithoutTotals = createWebMcpTools({getState:()=>fixture,gearSlots:["weapon"]});
    const statusWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_player_status").execute({});
    const equipmentWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_equipment").execute({});
    inventory.inventory.items[0].name = "Changed";
    equipment.equipment.slots.weapon.name = "Changed";
    location.location.services.push("Changed");
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
