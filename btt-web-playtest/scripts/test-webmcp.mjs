#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");

function argumentValue(name){
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const ROOT = path.resolve(argumentValue("--root") || DEFAULT_ROOT);
const BUILD_INFO = JSON.parse(fs.readFileSync(path.join(ROOT,"version.json"),"utf8"));
const HACKATHON_PROFILE = BUILD_INFO.build_profile === "hackathon";
const requestedBasePath = argumentValue("--base-path") || "";
const BASE_PATH = requestedBasePath
  ? `/${requestedBasePath.replace(/^\/+|\/+$/g,"")}`
  : "";
const EXPECTED_TOOLS = [
  "equip_item",
  "get_available_actions",
  "get_current_location",
  "get_equipment",
  "get_inventory",
  "get_player_status",
  "get_quest_log",
  "get_storyteller_options",
  "trigger_story_event",
  "use_item"
];
const STORYTELLER_EVENT_IDS = [
  "cinderhook_warning_messenger",
  "tavern_suspicious_stranger",
  "market_cutpurse"
];
const READ_ONLY_TOOLS = new Set(EXPECTED_TOOLS.filter(name=>!["equip_item","trigger_story_event","use_item"].includes(name)));

const MIME_TYPES = {
  ".css":"text/css; charset=utf-8",
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",
  ".jpeg":"image/jpeg",
  ".jpg":"image/jpeg",
  ".png":"image/png",
  ".svg":"image/svg+xml",
  ".webmanifest":"application/manifest+json",
  ".webp":"image/webp"
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
    if(BASE_PATH){
      if(pathname === BASE_PATH || pathname === `${BASE_PATH}/`)pathname = "/index.html";
      else if(pathname.startsWith(`${BASE_PATH}/`))pathname = pathname.slice(BASE_PATH.length);
      else{
        response.writeHead(404).end("Not found");
        return;
      }
    }else if(pathname === "/")pathname = "/index.html";
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

  const gameplay = await page.evaluate(async()=>{
    window.FE.startActualGame("Fallback Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();
    window.FE.show("gear");
    return {
      gameVisible:document.getElementById("game")?.style.display === "block",
      savePresent:localStorage.getItem("fallenEmpireSave_1") !== null
    };
  });
  await page.waitForFunction(()=>document.getElementById("gear")?.classList.contains("active") === true,{timeout:10000});
  assert.deepEqual(gameplay,{gameVisible:true,savePresent:true});

  const ordinaryMutations = await page.evaluate(async()=>{
    const stateModule = await import("./src/state.js");
    const combatModule = await import("./src/combat.js");
    const fallbackBlade = {id:"fallback_blade",name:"Fallback Blade",slot:"weapon",level:1,attack:5,defense:0,value:8,quality:"common"};
    stateModule.state.hero.inv = [fallbackBlade];
    stateModule.save(1);
    window.FE.show("gear");
    const equipButton = [...document.querySelectorAll("#gear button")]
      .find(button=>(button.textContent || "").trim() === "Equip");
    equipButton?.click();
    const equipped = stateModule.state.hero.gear.weapon?.id;
    const gearText = document.getElementById("gear")?.textContent || "";

    stateModule.state.hero.hp = 30;
    stateModule.state.hero.potions = 2;
    stateModule.save(1);
    combatModule.startBattle([{
      name:"Fallback Test Dummy",role:"test",level:1,hp:500,maxHp:500,attack:1,defense:0,speed:-100,xp:0,gold:0
    }],"Normal UI mutation smoke.",{source:"normal-ui-test"});
    const potionButton = [...document.querySelectorAll("#combat button")]
      .find(button=>/^Health Potion \(2\)$/.test((button.textContent || "").trim()));
    potionButton?.click();
    const savedHero = JSON.parse(localStorage.getItem("fallenEmpireSave_1")).hero;
    const result = {
      equipped,
      gearVisible:gearText.includes("Fallback Blade") && gearText.includes("Equipped"),
      hp:stateModule.state.hero.hp,
      potions:stateModule.state.hero.potions,
      savedHp:savedHero.hp,
      savedPotions:savedHero.potions,
      resolving:combatModule.battle?.resolving === true,
      combatVisible:(document.getElementById("combat")?.textContent || "").includes("Health Potion (1)")
    };
    combatModule.runBattle();
    return result;
  });
  assert.equal(ordinaryMutations.equipped,"fallback_blade","normal gear UI must still invoke canonical equip without WebMCP");
  assert.equal(ordinaryMutations.gearVisible,true);
  assert.ok(ordinaryMutations.hp > 30,"normal combat UI must still invoke the canonical health potion");
  assert.equal(ordinaryMutations.potions,1);
  assert.equal(ordinaryMutations.savedHp,ordinaryMutations.hp);
  assert.equal(ordinaryMutations.savedPotions,1);
  assert.equal(ordinaryMutations.resolving,true);
  assert.equal(ordinaryMutations.combatVisible,true);

  await page.evaluate(async()=>{
    if(!("serviceWorker" in navigator))return;
    await navigator.serviceWorker.ready;
    if(navigator.serviceWorker.controller)return;
    await new Promise((resolve,reject)=>{
      const timeout = setTimeout(()=>reject(new Error("service worker did not claim the first visit")),15000);
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        clearTimeout(timeout);
        resolve();
      },{once:true});
    });
  });
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

async function testRecoveryScope(browser,baseUrl){
  const page = await browser.newPage();
  await openGame(page,baseUrl);
  const seeded = await page.evaluate(async()=>{
    const appRegistration = await navigator.serviceWorker.ready;
    const siblingScope = new URL("./sibling/",location.href).href;
    const siblingRegistration = await navigator.serviceWorker.register("./service-worker.js",{scope:"./sibling/"});
    await siblingRegistration.update();
    const unrelatedCache = "unrelated-recovery-test-cache";
    const appCache = "beneath-throne-recovery-test-cache";
    await caches.open(unrelatedCache);
    await caches.open(appCache);
    const save = localStorage.getItem("fallenEmpireSave_1");
    return {appScope:appRegistration.scope,siblingScope,unrelatedCache,appCache,save};
  });

  await page.goto(`${baseUrl}/recovery.html?scope-test=${Date.now()}`,{
    waitUntil:"domcontentloaded",
    timeout:60000
  });
  await page.waitForFunction(()=>document.getElementById("status")?.textContent?.includes("Recovery complete"),{timeout:30000});
  const recovered = await page.evaluate(async()=>({
    scopes:(await navigator.serviceWorker.getRegistrations()).map(registration=>registration.scope),
    caches:await window.caches.keys(),
    save:localStorage.getItem("fallenEmpireSave_1")
  }));
  assert.ok(!recovered.scopes.includes(seeded.appScope),"recovery must unregister the exact app-scope worker");
  assert.ok(recovered.scopes.includes(seeded.siblingScope),"recovery must preserve sibling service workers");
  assert.ok(recovered.caches.includes(seeded.unrelatedCache),"recovery must preserve unrelated caches");
  assert.ok(!recovered.caches.includes(seeded.appCache),"recovery must clear Beneath the Throne caches");
  assert.equal(recovered.save,seeded.save,"recovery must preserve the active local save");
  await page.evaluate(async({siblingScope,unrelatedCache})=>{
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration=>registration.scope === siblingScope).map(registration=>registration.unregister()));
    await caches.delete(unrelatedCache);
  },{siblingScope:seeded.siblingScope,unrelatedCache:seeded.unrelatedCache});
  await page.close();
}

async function testDebugGating(browser,baseUrl,port){
  const localPage = await browser.newPage();
  await localPage.goto(`${baseUrl}/?debug`,{waitUntil:"domcontentloaded",timeout:60000});
  await localPage.waitForFunction(()=>window.__BTT_BOOTED === true,{timeout:30000});
  await localPage.waitForSelector(".debug-boot-controls",{timeout:10000});
  const localDebug = await localPage.evaluate(()=>(
    {
      debugKeys:Object.keys(window.FE).filter(key=>/^debug/i.test(key)).length,
      forceTravelEncounter:typeof window.FE.forceTravelEncounter,
      toggleStoreReadiness:typeof window.FE.toggleStoreReadiness
    }
  ));
  assert.ok(localDebug.debugKeys > 0,"loopback ?debug must preserve developer QA helpers");
  assert.equal(localDebug.forceTravelEncounter,"function");
  assert.equal(
    localDebug.toggleStoreReadiness,
    HACKATHON_PROFILE ? "undefined" : "function",
    "the artifact must omit the store helper while normal development retains it"
  );
  await localPage.close();

  const publicPage = await browser.newPage();
  await publicPage.evaluateOnNewDocument(()=>{
    const tools = {};
    Object.defineProperty(document,"modelContext",{configurable:true,value:{
      registerTool(tool){
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    }});
  });
  const publicBaseUrl = `http://btt-public.test:${port}${BASE_PATH}`;
  await publicPage.goto(`${publicBaseUrl}/?debug`,{waitUntil:"domcontentloaded",timeout:60000});
  await publicPage.waitForFunction(()=>window.__BTT_BOOTED === true,{timeout:30000});
  await publicPage.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length);
  const publicDebug = await publicPage.evaluate(()=>(
    {
      bootControls:!!document.querySelector(".debug-boot-controls"),
      debugKeys:Object.keys(window.FE).filter(key=>/^debug/i.test(key)),
      forceTravelEncounter:typeof window.FE.forceTravelEncounter,
      toggleStoreReadiness:typeof window.FE.toggleStoreReadiness,
      setupVisible:document.getElementById("setup")?.style.display !== "none",
      toolNames:Object.keys(window.__WEBMCP_TEST_TOOLS || {}).sort()
    }
  ));
  assert.equal(publicDebug.bootControls,false,"public-host ?debug must not render debug controls");
  assert.deepEqual(publicDebug.debugKeys,[],"public-host ?debug must not expose debug FE methods");
  assert.equal(publicDebug.forceTravelEncounter,"undefined");
  assert.equal(publicDebug.toggleStoreReadiness,"undefined");
  assert.equal(publicDebug.setupVisible,true,"normal gameplay must still boot when public ?debug is ignored");
  assert.deepEqual(publicDebug.toolNames,EXPECTED_TOOLS,"debug hardening must not change WebMCP discovery");
  await publicPage.close();
}

async function testStorytellerRegistrationFailure(browser,baseUrl){
  const page = await browser.newPage();
  const errors = trackPageErrors(page);
  await page.evaluateOnNewDocument(()=>{
    const tools = {};
    Object.defineProperty(document,"modelContext",{configurable:true,value:{
      registerTool(tool){
        if(tool?.name === "get_storyteller_options")throw new Error("Intentional Storyteller registration failure");
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    }});
  });
  await openGame(page,baseUrl);
  await page.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length - 2);
  const result = await page.evaluate(async()=>{
    window.FE.startActualGame("Partial Registration Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();
    const status = await window.__WEBMCP_TEST_TOOLS.get_player_status.execute({});
    const actions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    return {
      toolNames:Object.keys(window.__WEBMCP_TEST_TOOLS).sort(),
      status,
      registeredActions:actions.actions.webmcp_invocable.map(action=>action.id).sort(),
      gameVisible:document.getElementById("game")?.style.display === "block"
    };
  });
  const originalEight = EXPECTED_TOOLS.filter(name=>!["get_storyteller_options","trigger_story_event"].includes(name));
  assert.deepEqual(result.toolNames,originalEight,"failure of Storyteller discovery must skip its dependent trigger without removing any approved existing tool");
  assert.deepEqual(result.registeredActions,originalEight,"available actions must report only tools that actually registered");
  assert.equal(result.status.ok,true);
  assert.equal(result.gameVisible,true);
  assert.deepEqual(errors,[],`partial Storyteller registration produced browser errors: ${errors.join(" | ")}`);
  await page.close();

  const triggerPage = await browser.newPage();
  const triggerErrors = trackPageErrors(triggerPage);
  await triggerPage.evaluateOnNewDocument(()=>{
    const tools = {};
    Object.defineProperty(document,"modelContext",{configurable:true,value:{
      registerTool(tool){
        if(tool?.name === "trigger_story_event")throw new Error("Intentional Storyteller trigger registration failure");
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    }});
  });
  await openGame(triggerPage,baseUrl);
  await triggerPage.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length - 1);
  const triggerResult = await triggerPage.evaluate(async()=>{
    window.FE.startActualGame("Trigger Registration Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();
    const options = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const actions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    return {
      toolNames:Object.keys(window.__WEBMCP_TEST_TOOLS).sort(),
      options,
      registeredActions:actions.actions.webmcp_invocable.map(action=>action.id).sort()
    };
  });
  const withoutTrigger = EXPECTED_TOOLS.filter(name=>name !== "trigger_story_event");
  assert.deepEqual(triggerResult.toolNames,withoutTrigger,"a failed trigger registration must preserve discovery and every existing tool");
  assert.deepEqual(triggerResult.registeredActions,withoutTrigger,"available actions must omit a trigger that did not register");
  assert.equal(triggerResult.options.ok,true);
  assert.equal(triggerResult.options.storyteller.mutation_available,false);
  assert.equal(triggerResult.options.storyteller.trigger_tool,null);
  assert.equal(triggerResult.options.storyteller.decision_token,null);
  assert.equal(triggerResult.options.storyteller.decision_token_status,"trigger_unavailable");
  assert.ok(triggerResult.options.storyteller.eligible_events.every(event=>event.token === null && event.token_status === "trigger_unavailable"));
  assert.deepEqual(triggerErrors,[],`isolated trigger registration failure produced browser errors: ${triggerErrors.join(" | ")}`);
  await triggerPage.close();
}

async function testCourtLedgerProfile(browser,baseUrl){
  const page = await browser.newPage();
  const errors = trackPageErrors(page);
  await page.evaluateOnNewDocument((hackathonProfile)=>{
    const tools = {};
    Object.defineProperty(document,"modelContext",{configurable:true,value:{
      registerTool(tool){
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    }});
    if(!hackathonProfile)return;
    window.__BTT_MONETIZATION_GUARD = {checkoutReads:0,openCalls:0};
    try{
      localStorage.setItem("btt_checkout_urls",JSON.stringify({founder_pack:"https://checkout.example.test/founder"}));
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key){
        if(String(key).toLowerCase() === "btt_checkout_urls")window.__BTT_MONETIZATION_GUARD.checkoutReads += 1;
        return originalGetItem.call(this,key);
      };
    }catch{}
    window.BTT_CHECKOUT_URLS = {founder_pack:"https://checkout.example.test/founder"};
    window.open = ()=>{
      window.__BTT_MONETIZATION_GUARD.openCalls += 1;
      return null;
    };
  },HACKATHON_PROFILE);
  await openGame(page,baseUrl);
  await page.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length);

  let result = await page.evaluate(async(hackathonProfile)=>{
    window.FE.startActualGame("Artifact Profile Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();

    if(!hackathonProfile){
      const ledgerButton = document.querySelector("[data-action='court-ledger']");
      ledgerButton?.click();
      return {
        ledgerButton:!!ledgerButton,
        supportScreen:!!document.getElementById("support"),
        apiTypes:Object.fromEntries([
          "renderSupport","buySupporterOffer","previewSupporterOffer","watchCourtCrier","offerById","supporterState","toggleStoreReadiness"
        ].map(name=>[name,typeof window.FE[name]])),
        toolNames:Object.keys(window.__WEBMCP_TEST_TOOLS || {}).sort()
      };
    }

    window.FE.show("support");
    await new Promise(resolve=>setTimeout(resolve,50));
    const englishText = document.body.innerText;
    window.FE.changeGameLanguage("es");
    await new Promise(resolve=>setTimeout(resolve,50));
    const spanishText = document.body.innerText;
    window.FE.changeGameLanguage("en");
    await new Promise(resolve=>setTimeout(resolve,50));
    const guard = {...window.__BTT_MONETIZATION_GUARD};
    localStorage.removeItem("btt_checkout_urls");
    return {
      ledgerButton:!!document.querySelector("[data-action='court-ledger']"),
      supportScreen:!!document.getElementById("support"),
      homeActive:document.getElementById("home")?.classList.contains("active") === true,
      monetizationText:/Court Ledger|Libro de la corte|Stripe|checkout|payment|pago|purchase|comprar/i.test(`${englishText}\n${spanishText}`),
      apiTypes:Object.fromEntries([
        "renderSupport","buySupporterOffer","previewSupporterOffer","watchCourtCrier","offerById","supporterState","toggleStoreReadiness"
      ].map(name=>[name,typeof window.FE[name]])),
      checkoutReads:guard.checkoutReads,
      openCalls:guard.openCalls,
      toolNames:Object.keys(window.__WEBMCP_TEST_TOOLS || {}).sort()
    };
  },HACKATHON_PROFILE);

  if(!HACKATHON_PROFILE){
    await page.waitForFunction(()=>document.getElementById("support")?.classList.contains("active") === true,{timeout:10000});
    result = {...result,...await page.evaluate(()=>(
      {
        supportActive:document.getElementById("support")?.classList.contains("active") === true,
        supporterShell:!!document.querySelector("#support .supporter-shell"),
        offerCards:document.querySelectorAll("#support .supporter-card").length
      }
    ))};
  }

  assert.deepEqual(result.toolNames,EXPECTED_TOOLS,"the deployment profile must preserve exactly the approved ten WebMCP tools");
  if(HACKATHON_PROFILE){
    assert.equal(result.ledgerButton,false,"hackathon artifact must not render a Court Ledger action");
    assert.equal(result.supportScreen,false,"hackathon artifact must not contain a Court Ledger screen");
    assert.equal(result.homeActive,true,"attempting the disabled support route must safely stay on Home");
    assert.equal(result.monetizationText,false,"hackathon artifact must not render monetization copy in EN or ES");
    assert.deepEqual(Object.values(result.apiTypes),Array(Object.keys(result.apiTypes).length).fill("undefined"),"hackathon artifact must not expose store or mock-payment functions through FE");
    assert.equal(result.checkoutReads,0,"hackathon artifact must not read browser-provided checkout configuration");
    assert.equal(result.openCalls,0,"hackathon artifact must not open a checkout window");
  }else{
    assert.equal(result.ledgerButton,true,"normal development must retain the Court Ledger action");
    assert.equal(result.supportScreen,true,"normal development must retain the Court Ledger screen");
    assert.equal(result.supportActive,true,"the normal Court Ledger action must still open its screen");
    assert.equal(result.supporterShell,true,"normal development must still render the Court Ledger UI");
    assert.equal(result.offerCards,5,"normal development must retain all existing Court Ledger offers");
    assert.deepEqual(result.apiTypes,{
      renderSupport:"function",
      buySupporterOffer:"function",
      previewSupporterOffer:"function",
      watchCourtCrier:"function",
      offerById:"function",
      supporterState:"function",
      toggleStoreReadiness:"undefined"
    },"normal development must retain its existing Court Ledger functions while keeping the QA helper debug-gated");
  }
  assert.deepEqual(errors,[],`deployment-profile browser test produced errors: ${errors.join(" | ")}`);
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
  await page.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length);

  const registration = await page.evaluate(()=>Object.values(window.__WEBMCP_TEST_TOOLS).map(tool=>({
    name:tool.name,
    readOnly:tool.annotations?.readOnlyHint,
    destructive:tool.annotations?.destructiveHint,
    idempotent:tool.annotations?.idempotentHint,
    openWorld:tool.annotations?.openWorldHint,
    inputType:tool.inputSchema?.type,
    properties:Object.keys(tool.inputSchema?.properties || {}),
    required:tool.inputSchema?.required || [],
    itemEnum:tool.inputSchema?.properties?.item_id?.enum || null,
    eventEnum:tool.inputSchema?.properties?.event_id?.enum || null,
    additionalProperties:tool.inputSchema?.additionalProperties
  })).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.deepEqual(registration.map(tool=>tool.name),EXPECTED_TOOLS);
  for(const tool of registration){
    assert.equal(tool.inputType,"object");
    assert.equal(tool.additionalProperties,false);
    if(READ_ONLY_TOOLS.has(tool.name)){
      assert.equal(tool.readOnly,true,`${tool.name} must remain marked read-only`);
      assert.deepEqual(tool.properties,[]);
      assert.deepEqual(tool.required,[]);
      continue;
    }
    assert.equal(tool.readOnly,false,`${tool.name} must be marked as a mutation`);
    assert.equal(tool.idempotent,false);
    assert.equal(tool.openWorld,false);
    if(tool.name === "trigger_story_event"){
      assert.deepEqual(tool.properties,["event_id","token"]);
      assert.deepEqual(tool.required,["event_id","token"]);
      assert.deepEqual(tool.eventEnum,STORYTELLER_EVENT_IDS);
      continue;
    }
    assert.deepEqual(tool.properties,["item_id"]);
    assert.deepEqual(tool.required,["item_id"]);
  }
  assert.equal(registration.find(tool=>tool.name === "use_item").destructive,true);
  assert.deepEqual(registration.find(tool=>tool.name === "use_item").itemEnum,["health_potion","mana_potion"]);
  assert.equal(registration.find(tool=>tool.name === "equip_item").destructive,false);
  assert.equal(registration.find(tool=>tool.name === "equip_item").itemEnum,null);
  assert.equal(registration.find(tool=>tool.name === "trigger_story_event").destructive,true);
  assert.equal(registration.find(tool=>tool.name === "trigger_story_event").itemEnum,null);

  const titleResponses = await page.evaluate(async()=>{
    const entries = await Promise.all(Object.entries(window.__WEBMCP_TEST_TOOLS).map(async([name,tool])=>[
      name,
      await tool.execute({})
    ]));
    return Object.fromEntries(entries);
  });
  for(const name of EXPECTED_TOOLS){
    if(name === "get_storyteller_options"){
      assert.equal(titleResponses[name].ok,true,"Storyteller discovery should return a clean empty result when no game is active");
      assert.equal(titleResponses[name].storyteller.status,"blocked");
      assert.equal(titleResponses[name].storyteller.blocked_reason.code,"no_active_game");
      assert.equal(titleResponses[name].storyteller.decision_token,null);
      assert.deepEqual(titleResponses[name].storyteller.eligible_events,[]);
      continue;
    }
    assert.equal(titleResponses[name].ok,false,`${name} should report that no game is active on the title screen`);
    assert.equal(titleResponses[name].error.code,"no_active_game");
    if(!READ_ONLY_TOOLS.has(name)){
      assert.equal(titleResponses[name].accepted,false);
      assert.equal(titleResponses[name].success,false);
    }
  }

  const actual = await page.evaluate(async()=>{
    window.FE.startActualGame("WebMCP Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();
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
    const firstStorytellerEvent = responses.get_storyteller_options.storyteller.eligible_events[0];
    if(firstStorytellerEvent){
      firstStorytellerEvent.title = "Changed Storyteller copy";
      firstStorytellerEvent.human_choices[0].label = "Changed Storyteller choice";
      firstStorytellerEvent.context.location_id = "changed_location";
    }
    responses.get_storyteller_options.storyteller.context.location_id = "changed_context";
    const firstUiAction = responses.get_available_actions.actions.player_ui_controlled[0];
    if(firstUiAction)firstUiAction.parameters.changed = true;
    const reread = {
      status:await window.__WEBMCP_TEST_TOOLS.get_player_status.execute({}),
      inventory:await window.__WEBMCP_TEST_TOOLS.get_inventory.execute({}),
      location:await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({}),
      quests:await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({}),
      actions:await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({}),
      storyteller:await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({})
    };
    const readEffectSnapshot = ()=>(
      {
        state:JSON.stringify(stateModule.state),
        storage:JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),
        currentScreen:stateModule.currentScreen,
        activeScreens:[...document.querySelectorAll(".screen.active")].map(node=>node.id),
        blockers:document.querySelectorAll(".modal-back,.level-up-back,.encounter-transition,.court-crier-overlay").length,
        homeHtml:document.getElementById("home")?.innerHTML || ""
      }
    );
    const storytellerReadEffectBefore = readEffectSnapshot();
    await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const storytellerReadEffectAfter = readEffectSnapshot();

    const worldBeforeTravel = JSON.parse(JSON.stringify(stateModule.state.world));
    stateModule.state.world.locationId = "ashen_keep";
    stateModule.state.world.region = 0;
    const keepActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    window.FE.travelToLocation("ashen_fields");
    const travelBeforeRead = JSON.stringify(stateModule.state.world);
    const travelContextBeforeRead = JSON.stringify(window.FE.getCurrentPlaceContext({repairWorld:false}));
    const liveTravel = await window.__WEBMCP_TEST_TOOLS.get_current_location.execute({});
    const liveTravelActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const liveTravelStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
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
    const malformedStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const malformedAfter = JSON.stringify(stateModule.state.world);
    stateModule.state.world = originalWorld;
    return {
      before,after,saveBefore,saveAfter,responses,reread,
      storytellerReadEffectBefore,storytellerReadEffectAfter,
      keepActions,travelBeforeRead,travelAfterRead,travelContextBeforeRead,travelContextAfterRead,liveTravel,liveTravelActions,liveTravelStoryteller,
      malformedBefore,malformedAfter,malformedLocation,malformedStoryteller
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
  const storyteller = actual.responses.get_storyteller_options;
  assert.equal(storyteller.ok,true);
  assert.equal(storyteller.storyteller.status,"ready");
  assert.equal(storyteller.storyteller.mutation_available,true);
  assert.equal(storyteller.storyteller.trigger_tool,"trigger_story_event");
  assert.equal(storyteller.storyteller.eligible_event_count,3);
  assert.deepEqual(
    storyteller.storyteller.eligible_events.map(event=>event.event_id),
    ["cinderhook_warning_messenger","tavern_suspicious_stranger","market_cutpurse"]
  );
  assert.equal(new Set(storyteller.storyteller.eligible_events.map(event=>event.event_id)).size,3,"Storyteller options must not contain duplicate event IDs");
  assert.match(storyteller.storyteller.decision_token,/^story-[0-9a-f-]{32,36}$/);
  assert.equal(storyteller.storyteller.decision_token_status,"issued");
  assert.equal(storyteller.storyteller.decision_event_id,storyteller.storyteller.eligible_events[0].event_id);
  assert.equal(storyteller.storyteller.decision_token,storyteller.storyteller.eligible_events[0].token,"the legacy top-level token must alias only the first event token");
  assert.equal(new Set(storyteller.storyteller.eligible_events.map(event=>event.token)).size,3,"each eligible event must receive a distinct token");
  assert.ok(storyteller.storyteller.eligible_events.every(event=>/^story-[0-9a-f-]{32,36}$/.test(event.token) && event.token_status === "issued"));
  assert.ok(storyteller.storyteller.eligible_events.every(event=>event.human_choices.every(choice=>(
    choice.interaction_owner === "player_ui"
      && choice.currently_presented === false
      && choice.webmcp_invocable === false
  ))));
  assert.doesNotMatch(JSON.stringify(storyteller),/eligibilityKey|eligibility_key|futureRoute|requiredActionId|serviceEventId|callback|predicate|effect|FE\./);
  assert.ok(EXPECTED_TOOLS.includes("trigger_story_event"),"the guarded Storyteller presentation tool must be the only added mutation");
  assert.equal(actual.responses.get_available_actions.ok,true);
  assert.equal(actual.responses.get_available_actions.mutation_tools_enabled,true);
  assert.deepEqual(
    actual.responses.get_available_actions.actions.webmcp_invocable.map(action=>action.id).sort(),
    [...EXPECTED_TOOLS].sort()
  );
  const freshUiActions = actual.responses.get_available_actions.actions.player_ui_controlled;
  const freshBlockedActions = actual.responses.get_available_actions.actions.blocked_player_ui_actions;
  assert.ok(freshUiActions.some(action=>action.id === "cinderhook.open_contract_board"));
  assert.ok(freshBlockedActions.some(action=>action.id === "location.hunt_nearby" && action.blocked_reason_code === "chapter_one_gate_locked"));
  assert.ok([...freshUiActions,...freshBlockedActions].every(action=>action.execution === "player_ui_only" && action.webmcp_invocable === false && action.webmcp_tool === null));
  assert.deepEqual(
    actual.responses.get_available_actions.actions.webmcp_invocable
      .filter(action=>action.modifies_game_state)
      .map(action=>action.id)
      .sort(),
    ["equip_item","trigger_story_event","use_item"]
  );
  assert.doesNotMatch(JSON.stringify(actual.responses.get_quest_log),/FE\./,"quest projections must not expose executable UI strings");
  assert.equal(actual.reread.status.player.name,"WebMCP Tester","player status must be a detached copy");
  assert.equal(actual.reread.status.player.attributes.strength,4,"attributes must be a detached copy");
  assert.equal(actual.reread.status.player.elemental_resistances.fire,0,"resistances must be a detached copy");
  assert.equal(actual.reread.inventory.inventory.resources.food,5,"inventory must be a detached copy");
  assert.ok(!actual.reread.location.location.services.includes("fake_service"),"location services must be a detached copy");
  assert.equal(actual.reread.quests.quest_log.chapters[0].quests[0].name,"Recover Stolen Food","quest entries must be detached copies");
  assert.equal(actual.reread.quests.quest_log.chapters[0].quests[0].reward.gold,5,"quest rewards must be detached copies");
  assert.equal(actual.reread.storyteller.storyteller.context.location_id,"ashen_slums","Storyteller context must be detached");
  assert.equal(actual.reread.storyteller.storyteller.eligible_events[0].title,"A Warning at the Door","Storyteller event titles must be detached");
  assert.equal(actual.reread.storyteller.storyteller.eligible_events[0].human_choices[0].label,"Hear the warning","Storyteller choices must be detached");
  assert.notEqual(
    actual.reread.storyteller.storyteller.decision_token,
    actual.responses.get_storyteller_options.storyteller.decision_token,
    "each eligible read must replace the prior in-memory decision receipt"
  );
  for(const token of actual.responses.get_storyteller_options.storyteller.eligible_events.map(event=>event.token)){
    assert.ok(!actual.before.includes(token),"decision tokens must never be stored in live state");
    assert.ok(!String(actual.saveAfter).includes(token),"decision tokens must never be persisted");
  }
  assert.deepEqual(
    actual.storytellerReadEffectAfter,
    actual.storytellerReadEffectBefore,
    "Storyteller discovery must not modify state, any localStorage entry, the active screen, blockers, or visible Home UI"
  );
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
  assert.equal(actual.liveTravelStoryteller.storyteller.status,"blocked");
  assert.equal(actual.liveTravelStoryteller.storyteller.blocked_reason.code,"travel_in_progress");
  assert.equal(actual.liveTravelStoryteller.storyteller.decision_token,null);
  assert.deepEqual(actual.liveTravelStoryteller.storyteller.eligible_events,[]);
  assert.ok(actual.keepActions.actions.player_ui_controlled.some(action=>action.id === "location.hunt_nearby"),"the cinematic command rail should expose Hunt Nearby");
  assert.ok(actual.keepActions.actions.player_ui_controlled.some(action=>action.id === "location.scout_nearby"),"the cinematic command rail should expose Scout Nearby");
  assert.equal(actual.malformedBefore,actual.malformedAfter,"location reads must not repair or otherwise mutate malformed state");
  assert.equal(actual.malformedLocation.location.id,"ashen_slums","a malformed location should be read through the existing safe fallback");
  assert.equal(actual.malformedStoryteller.storyteller.status,"blocked","Storyteller eligibility must fail closed for a malformed raw location");
  assert.equal(actual.malformedStoryteller.storyteller.blocked_reason.code,"location_mismatch");

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
    const spanishStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const spanishAfter = JSON.stringify(stateModule.state);
    languageModule.setLanguage("en");

    stateModule.state.prologue = {contracts:{active:"legacy_unknown",completed:{bad:true},failed:null}};
    stateModule.state.world.lowerWard = null;
    const malformedQuestBefore = JSON.stringify(stateModule.state);
    const malformedQuests = await window.__WEBMCP_TEST_TOOLS.get_quest_log.execute({});
    const malformedQuestAfter = JSON.stringify(stateModule.state);

    window.FE.modal("Player choice","<p>Choose in the UI.</p>",[{label:"Continue"}]);
    const modalActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const modalStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    window.FE.closeModals();

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    stateModule.state.prologue.lowerWardGate.unlocked = true;
    stateModule.state.prologue.phase = "gateUnlocked";
    stateModule.state.world.locationId = "ashen_fields";
    const noEligibleBefore = JSON.stringify(stateModule.state);
    const noEligibleStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const noEligibleAfter = JSON.stringify(stateModule.state);

    stateModule.setState(JSON.parse(JSON.stringify(baseline)));
    window.FE.slumClearAlley();
    const battleBefore = JSON.stringify(combatModule.battle);
    const combatStateBefore = JSON.stringify(stateModule.state);
    const combatSaveBefore = localStorage.getItem("fallenEmpireSave_1");
    const knownBefore = stateModule.state.hero.known;
    const loadoutBefore = stateModule.state.hero.abilityLoadout;
    const combatActions = await window.__WEBMCP_TEST_TOOLS.get_available_actions.execute({});
    const combatStoryteller = await window.__WEBMCP_TEST_TOOLS.get_storyteller_options.execute({});
    const battleAfter = JSON.stringify(combatModule.battle);
    const combatStateAfter = JSON.stringify(stateModule.state);
    const combatSaveAfter = localStorage.getItem("fallenEmpireSave_1");
    const combatAbilityReferencesPreserved = knownBefore === stateModule.state.hero.known && loadoutBefore === stateModule.state.hero.abilityLoadout;
    window.FE.runBattle();

    return {
      cinderBefore,cinderAfter,cinderQuests,cinderActions,
      wardBefore,wardAfter,wardQuests,wardActions,
      spanishBefore,spanishAfter,spanishQuests,spanishActions,spanishStoryteller,
      malformedQuestBefore,malformedQuestAfter,malformedQuests,
      modalActions,modalStoryteller,noEligibleBefore,noEligibleAfter,noEligibleStoryteller,
      campNoFoodBefore,campNoFoodAfter,campNoFoodActions,campReadyBefore,campReadyAfter,campReadyActions,
      campMovingBefore,campMovingAfter,campMovingActions,
      cinderTravelBefore,cinderTravelAfter,cinderTravelActions,
      battleBefore,battleAfter,combatStateBefore,combatStateAfter,combatSaveBefore,combatSaveAfter,combatAbilityReferencesPreserved,combatActions,combatStoryteller
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
  assert.equal(scenarios.spanishStoryteller.storyteller.language,"es");
  assert.ok(scenarios.spanishStoryteller.storyteller.eligible_events.length >= 1);
  assert.equal(scenarios.spanishStoryteller.storyteller.eligible_events[0].title,"El desconocido encapuchado");
  assert.equal(scenarios.malformedQuestBefore,scenarios.malformedQuestAfter,"quest reads must not normalize malformed or legacy quest state");
  const legacyBlockedQuest = scenarios.malformedQuests.quest_log.chapters[0].quests.find(quest=>quest.id === "ration_marks");
  assert.equal(legacyBlockedQuest.status,"blocked");
  assert.equal(legacyBlockedQuest.blocked_by_quest_id,"legacy_unknown");
  assert.equal(scenarios.modalActions.context.interaction_layer,"modal");
  assert.deepEqual(scenarios.modalActions.actions.player_ui_controlled,[]);
  assert.deepEqual(scenarios.modalActions.actions.blocked_player_ui_actions,[]);
  assert.equal(scenarios.modalStoryteller.storyteller.status,"blocked");
  assert.equal(scenarios.modalStoryteller.storyteller.blocked_reason.code,"blocking_interaction");
  assert.equal(scenarios.modalStoryteller.storyteller.decision_token,null);
  assert.equal(scenarios.noEligibleBefore,scenarios.noEligibleAfter,"an empty Storyteller read must not modify live state");
  assert.equal(scenarios.noEligibleStoryteller.ok,true);
  assert.equal(scenarios.noEligibleStoryteller.storyteller.status,"ready");
  assert.equal(scenarios.noEligibleStoryteller.storyteller.blocked_reason.code,"no_eligible_events");
  assert.deepEqual(scenarios.noEligibleStoryteller.storyteller.eligible_events,[]);
  assert.equal(scenarios.noEligibleStoryteller.storyteller.decision_token,null);
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
  assert.equal(scenarios.combatStoryteller.storyteller.status,"blocked");
  assert.equal(scenarios.combatStoryteller.storyteller.blocked_reason.code,"combat_active");
  assert.equal(scenarios.combatStoryteller.storyteller.decision_token,null);

  const mutations = await page.evaluate(async()=>{
    const stateModule = await import("./src/state.js");
    const combatModule = await import("./src/combat.js");
    const languageModule = await import("./src/language.js");
    const tools = window.__WEBMCP_TEST_TOOLS;
    const baseline = JSON.parse(JSON.stringify(stateModule.state));
    const saveKey = "fallenEmpireSave_1";
    const closeBlockingInteractions = ()=>{
      window.FE.closeModals();
      document.querySelectorAll(".level-up-back,.encounter-transition,.court-crier-overlay").forEach(node=>node.remove());
    };
    const endBattle = ()=>{
      if(combatModule.battle)combatModule.runBattle();
    };
    const reset = ()=>{
      endBattle();
      closeBlockingInteractions();
      languageModule.setLanguage("en");
      stateModule.setState(JSON.parse(JSON.stringify(baseline)));
      stateModule.save(1);
    };
    const startHeroTurnBattle = ()=>combatModule.startBattle([{
      name:"Mutation Test Dummy",
      role:"test",
      level:1,
      hp:500,
      maxHp:500,
      attack:1,
      defense:0,
      speed:-100,
      xp:0,
      gold:0
    }],"Mutation test battle.",{source:"webmcp-test"});
    const snapshot = ()=>({
      state:JSON.stringify(stateModule.state),
      battle:JSON.stringify(combatModule.battle),
      save:localStorage.getItem(saveKey),
      combatHtml:document.getElementById("combat")?.innerHTML || ""
    });
    const unchanged = (before,after)=>({
      state:before.state === after.state,
      battle:before.battle === after.battle,
      save:before.save === after.save,
      combatHtml:before.combatHtml === after.combatHtml
    });

    reset();
    const outsideBefore = snapshot();
    const outsideCombat = await tools.use_item.execute({item_id:"health_potion"});
    const outsideUnchanged = unchanged(outsideBefore,snapshot());

    reset();
    stateModule.state.hero.hp = 30;
    stateModule.state.hero.potions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    combatModule.battle.index = combatModule.battle.queue.findIndex(actor=>actor.side === "enemy");
    combatModule.battle.resolving = false;
    combatModule.battle.heroActionLocked = false;
    const enemyTurnBefore = snapshot();
    const enemyTurnPotion = await tools.use_item.execute({item_id:"health_potion"});
    const enemyTurnUnchanged = unchanged(enemyTurnBefore,snapshot());
    endBattle();

    reset();
    stateModule.state.hero.hp = 40;
    stateModule.state.hero.potions = 2;
    stateModule.save(1);
    startHeroTurnBattle();
    const health = await tools.use_item.execute({item_id:"health_potion"});
    const healthResult = {
      response:health,
      hp:stateModule.state.hero.hp,
      potions:stateModule.state.hero.potions,
      savedHp:JSON.parse(localStorage.getItem(saveKey)).hero.hp,
      savedPotions:JSON.parse(localStorage.getItem(saveKey)).hero.potions,
      resolving:combatModule.battle?.resolving === true,
      actionLocked:combatModule.battle?.heroActionLocked === true,
      uiText:document.getElementById("combat")?.textContent || ""
    };
    const combatSettled = ()=>combatModule.battle?.resolving === false
      && combatModule.battle?.heroActionLocked === false
      && combatModule.battle?.queue?.[combatModule.battle.index]?.side === "hero";
    const settleDeadline = Date.now() + 8000;
    while(!combatSettled() && Date.now() < settleDeadline){
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    healthResult.settled = combatSettled();
    healthResult.settledUiText = document.getElementById("combat")?.textContent || "";
    endBattle();

    reset();
    stateModule.state.hero.hp = stateModule.state.hero.maxHp;
    stateModule.state.hero.potions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    const fullHealth = await tools.use_item.execute({item_id:"health_potion"});
    const fullHealthResult = {
      response:fullHealth,
      hp:stateModule.state.hero.hp,
      potions:stateModule.state.hero.potions,
      savedPotions:JSON.parse(localStorage.getItem(saveKey)).hero.potions
    };
    endBattle();

    reset();
    stateModule.state.hero.mana = 4;
    stateModule.state.hero.manaPotions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    const mana = await tools.use_item.execute({item_id:"mana_potion"});
    const manaResult = {
      response:mana,
      mana:stateModule.state.hero.mana,
      manaPotions:stateModule.state.hero.manaPotions,
      savedMana:JSON.parse(localStorage.getItem(saveKey)).hero.mana,
      savedManaPotions:JSON.parse(localStorage.getItem(saveKey)).hero.manaPotions,
      resolving:combatModule.battle?.resolving === true,
      uiText:document.getElementById("combat")?.textContent || ""
    };
    endBattle();

    reset();
    stateModule.state.hero.mana = stateModule.state.hero.maxMana;
    stateModule.state.hero.manaPotions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    languageModule.setLanguage("es");
    const fullManaBefore = snapshot();
    const fullMana = await tools.use_item.execute({item_id:"mana_potion"});
    const fullManaUnchanged = unchanged(fullManaBefore,snapshot());
    languageModule.setLanguage("en");
    endBattle();

    reset();
    stateModule.state.hero.potions = 0;
    stateModule.save(1);
    startHeroTurnBattle();
    const missingPotionBefore = snapshot();
    const missingPotion = await tools.use_item.execute({item_id:"health_potion"});
    const missingPotionUnchanged = unchanged(missingPotionBefore,snapshot());
    endBattle();

    reset();
    stateModule.state.hero.mana = 1;
    stateModule.state.hero.manaPotions = 0;
    stateModule.save(1);
    startHeroTurnBattle();
    const missingManaPotionBefore = snapshot();
    const missingManaPotion = await tools.use_item.execute({item_id:"mana_potion"});
    const missingManaPotionUnchanged = unchanged(missingManaPotionBefore,snapshot());
    endBattle();

    reset();
    stateModule.state.hero.hp = 30;
    stateModule.state.hero.potions = 2;
    stateModule.save(1);
    startHeroTurnBattle();
    const repeatedFirst = await tools.use_item.execute({item_id:"health_potion"});
    const repeatedBefore = snapshot();
    const repeatedSecond = await tools.use_item.execute({item_id:"health_potion"});
    const repeatedUnchanged = unchanged(repeatedBefore,snapshot());
    endBattle();

    reset();
    stateModule.state.hero.hp = 30;
    stateModule.state.hero.potions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    const potionBlocker = document.createElement("div");
    potionBlocker.className = "level-up-back";
    document.body.appendChild(potionBlocker);
    const blockedPotionBefore = snapshot();
    const blockedPotion = await tools.use_item.execute({item_id:"health_potion"});
    const blockedPotionUnchanged = unchanged(blockedPotionBefore,snapshot());
    potionBlocker.remove();
    endBattle();

    reset();
    stateModule.state.hero.hp = 30;
    stateModule.state.hero.potions = 1;
    stateModule.save(1);
    startHeroTurnBattle();
    const unsupportedPotionBefore = snapshot();
    const unsupportedPotion = await tools.use_item.execute({item_id:"FE.usePotion"});
    const unsupportedPotionUnchanged = unchanged(unsupportedPotionBefore,snapshot());
    endBattle();

    reset();
    const oldWeapon = {id:"old_blade",name:"Old Blade",slot:"weapon",level:1,attack:3,defense:0,value:5,quality:"common"};
    const newWeapon = {id:"new_blade",name:"New Blade",slot:"weapon",level:2,attack:9,defense:0,value:15,quality:"rare"};
    stateModule.state.hero.gear.weapon = oldWeapon;
    stateModule.state.hero.inv = [newWeapon];
    stateModule.save(1);
    languageModule.setLanguage("es");
    window.FE.show("gear");
    const exposedInventory = await tools.get_inventory.execute({});
    const equip = await tools.equip_item.execute({item_id:"new_blade"});
    const equipResponseName = equip.newly_equipped?.name;
    if(equip.newly_equipped)equip.newly_equipped.name = "Changed detached response";
    const repeatedEquipBefore = snapshot();
    const repeatedEquip = await tools.equip_item.execute({item_id:"new_blade"});
    const repeatedEquipUnchanged = unchanged(repeatedEquipBefore,snapshot());
    const inventoryAfterEquip = await tools.get_inventory.execute({});
    const equipmentAfterEquip = await tools.get_equipment.execute({});
    const savedAfterEquip = JSON.parse(localStorage.getItem(saveKey));
    const equipResult = {
      response:equip,
      responseName:equipResponseName,
      liveEquippedName:stateModule.state.hero.gear.weapon?.name,
      equippedId:stateModule.state.hero.gear.weapon?.id,
      inventoryIds:stateModule.state.hero.inv.map(item=>item.id),
      exposedIds:exposedInventory.inventory.items.map(item=>item.id),
      readInventoryIds:inventoryAfterEquip.inventory.items.map(item=>item.id),
      readEquipmentId:equipmentAfterEquip.equipment.slots.weapon?.id,
      savedEquipmentId:savedAfterEquip.hero.gear.weapon?.id,
      savedInventoryIds:savedAfterEquip.hero.inv.map(item=>item.id),
      uiText:document.getElementById("gear")?.textContent || ""
    };
    languageModule.setLanguage("en");

    const invalidEquipBefore = snapshot();
    const invalidEquip = await tools.equip_item.execute({item_id:"missing_blade"});
    const invalidEquipUnchanged = unchanged(invalidEquipBefore,snapshot());

    const observedOld = await tools.get_inventory.execute({});
    stateModule.state.hero.inv = stateModule.state.hero.inv.filter(item=>item.id !== "old_blade");
    stateModule.save(1);
    const missingObservedBefore = snapshot();
    const missingObserved = await tools.equip_item.execute({item_id:"old_blade"});
    const missingObservedUnchanged = unchanged(missingObservedBefore,snapshot());

    reset();
    const staleBlade = {...newWeapon,id:"stale_blade"};
    const freshBlade = {...newWeapon,id:"fresh_blade"};
    stateModule.state.hero.inv = [staleBlade];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    stateModule.state.hero.inv = [freshBlade];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    const staleSnapshotBefore = snapshot();
    const staleSnapshotEquip = await tools.equip_item.execute({item_id:"stale_blade"});
    const staleSnapshotUnchanged = unchanged(staleSnapshotBefore,snapshot());

    reset();
    stateModule.state.hero.inv = [{...newWeapon,id:"replacement_blade"}];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    stateModule.setState(JSON.parse(JSON.stringify(stateModule.state)));
    const replacedHeroBefore = snapshot();
    const replacedHeroEquip = await tools.equip_item.execute({item_id:"replacement_blade"});
    const replacedHeroUnchanged = unchanged(replacedHeroBefore,snapshot());

    reset();
    stateModule.state.hero.inv = [
      {...newWeapon,id:"duplicate_blade"},
      {...newWeapon,id:"duplicate_blade",name:"Duplicate Blade Two"}
    ];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    const duplicateBefore = snapshot();
    const duplicateEquip = await tools.equip_item.execute({item_id:"duplicate_blade"});
    const duplicateUnchanged = unchanged(duplicateBefore,snapshot());

    reset();
    stateModule.state.hero.inv = [{id:"quest_token",name:"Quest Token",slot:"quest",level:0,attack:0,defense:0,value:0}];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    const nonEquippableBefore = snapshot();
    const nonEquippable = await tools.equip_item.execute({item_id:"quest_token"});
    const nonEquippableUnchanged = unchanged(nonEquippableBefore,snapshot());

    reset();
    stateModule.state.hero.inv = [{...newWeapon,id:"combat_blade"}];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    startHeroTurnBattle();
    const combatEquipBefore = snapshot();
    const combatEquip = await tools.equip_item.execute({item_id:"combat_blade"});
    const combatEquipUnchanged = unchanged(combatEquipBefore,snapshot());
    endBattle();

    reset();
    stateModule.state.hero.inv = [{...newWeapon,id:"modal_blade"}];
    stateModule.save(1);
    await tools.get_inventory.execute({});
    const blocker = document.createElement("div");
    blocker.className = "level-up-back";
    document.body.appendChild(blocker);
    const modalEquipBefore = snapshot();
    const modalEquip = await tools.equip_item.execute({item_id:"modal_blade"});
    const modalEquipUnchanged = unchanged(modalEquipBefore,snapshot());
    blocker.remove();

    const invalidObjectBefore = snapshot();
    const invalidObject = await tools.equip_item.execute({item_id:{call:"FE.equip"}});
    const invalidObjectUnchanged = unchanged(invalidObjectBefore,snapshot());
    const extraFieldBefore = snapshot();
    const extraField = await tools.equip_item.execute({item_id:"modal_blade",action:"FE.equip"});
    const extraFieldUnchanged = unchanged(extraFieldBefore,snapshot());

    reset();
    return {
      outsideCombat,outsideUnchanged,
      enemyTurnPotion,enemyTurnUnchanged,
      healthResult,fullHealthResult,manaResult,
      fullMana,fullManaUnchanged,
      missingPotion,missingPotionUnchanged,
      missingManaPotion,missingManaPotionUnchanged,
      repeatedFirst,repeatedSecond,repeatedUnchanged,
      blockedPotion,blockedPotionUnchanged,
      unsupportedPotion,unsupportedPotionUnchanged,
      equipResult,repeatedEquip,repeatedEquipUnchanged,invalidEquip,invalidEquipUnchanged,
      observedOldIds:observedOld.inventory.items.map(item=>item.id),missingObserved,missingObservedUnchanged,
      staleSnapshotEquip,staleSnapshotUnchanged,
      replacedHeroEquip,replacedHeroUnchanged,
      duplicateEquip,duplicateUnchanged,
      nonEquippable,nonEquippableUnchanged,
      combatEquip,combatEquipUnchanged,
      modalEquip,modalEquipUnchanged,
      invalidObject,invalidObjectUnchanged,extraField,extraFieldUnchanged
    };
  });

  assert.equal(mutations.outsideCombat.error.code,"combat_not_active");
  assert.deepEqual(mutations.outsideUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.enemyTurnPotion.error.code,"hero_turn_required");
  assert.deepEqual(mutations.enemyTurnUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.healthResult.response.accepted,true);
  assert.equal(mutations.healthResult.response.success,true);
  assert.equal(mutations.healthResult.response.save_persisted,true);
  assert.equal(mutations.healthResult.response.item_used,"health_potion");
  assert.equal(mutations.healthResult.response.before.quantity,2);
  assert.equal(mutations.healthResult.response.after.quantity,1);
  assert.equal(mutations.healthResult.potions,1);
  assert.ok(mutations.healthResult.hp > 40);
  assert.equal(mutations.healthResult.savedHp,mutations.healthResult.hp);
  assert.equal(mutations.healthResult.savedPotions,1);
  assert.equal(mutations.healthResult.resolving,true);
  assert.equal(mutations.healthResult.actionLocked,true);
  assert.match(mutations.healthResult.uiText,/Health Potion \(1\)/);
  assert.equal(mutations.healthResult.settled,true,"the canonical combat timer must advance through the enemy response and restore the hero turn");
  assert.match(mutations.healthResult.settledUiText,/uses .* on .* for \d+/i);
  assert.equal(mutations.fullHealthResult.response.success,true,"health potions must preserve the canonical full-health behavior");
  assert.equal(mutations.fullHealthResult.response.before.health.current,mutations.fullHealthResult.response.before.health.maximum);
  assert.equal(mutations.fullHealthResult.response.after.health.current,mutations.fullHealthResult.response.after.health.maximum);
  assert.equal(mutations.fullHealthResult.potions,0);
  assert.equal(mutations.fullHealthResult.savedPotions,0);
  assert.equal(mutations.manaResult.response.accepted,true);
  assert.equal(mutations.manaResult.response.success,true);
  assert.equal(mutations.manaResult.response.save_persisted,true);
  assert.equal(mutations.manaResult.response.item_used,"mana_potion");
  assert.equal(mutations.manaResult.manaPotions,0);
  assert.ok(mutations.manaResult.mana > 4);
  assert.equal(mutations.manaResult.savedMana,mutations.manaResult.mana);
  assert.equal(mutations.manaResult.savedManaPotions,0);
  assert.equal(mutations.manaResult.resolving,true);
  assert.match(mutations.manaResult.uiText,/restores \d+ Mana/i);
  assert.equal(mutations.fullMana.error.code,"mana_full");
  assert.equal(mutations.fullMana.error.message,"El mana ya esta lleno.");
  assert.deepEqual(mutations.fullManaUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.missingPotion.error.code,"no_health_potions");
  assert.deepEqual(mutations.missingPotionUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.missingManaPotion.error.code,"no_mana_potions");
  assert.deepEqual(mutations.missingManaPotionUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.repeatedFirst.success,true);
  assert.equal(mutations.repeatedSecond.error.code,"combat_resolving");
  assert.deepEqual(mutations.repeatedUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.blockedPotion.error.code,"blocking_interaction");
  assert.deepEqual(mutations.blockedPotionUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.unsupportedPotion.error.code,"unsupported_item");
  assert.deepEqual(mutations.unsupportedPotionUnchanged,{state:true,battle:true,save:true,combatHtml:true});

  assert.equal(mutations.equipResult.response.accepted,true);
  assert.equal(mutations.equipResult.response.success,true);
  assert.equal(mutations.equipResult.response.save_persisted,true);
  assert.equal(mutations.equipResult.response.slot,"weapon");
  assert.equal(mutations.equipResult.response.previously_equipped.id,"old_blade");
  assert.equal(mutations.equipResult.responseName,"New Blade");
  assert.equal(mutations.equipResult.liveEquippedName,"New Blade","equip response must be detached from live gear");
  assert.equal(mutations.equipResult.equippedId,"new_blade");
  assert.ok(mutations.equipResult.inventoryIds.includes("old_blade"));
  assert.deepEqual(mutations.equipResult.exposedIds,["new_blade"]);
  assert.deepEqual(mutations.equipResult.readInventoryIds,["old_blade"]);
  assert.equal(mutations.equipResult.readEquipmentId,"new_blade");
  assert.equal(mutations.equipResult.savedEquipmentId,"new_blade");
  assert.ok(mutations.equipResult.savedInventoryIds.includes("old_blade"));
  assert.equal(mutations.equipResult.response.previous_item_returned_to_inventory,true);
  assert.equal(mutations.equipResult.response.derived_stats.total_attack.change,6);
  assert.match(mutations.equipResult.uiText,/Equipado/);
  assert.match(mutations.equipResult.uiText,/New Blade/);
  assert.match(mutations.equipResult.uiText,/Old Blade/);
  assert.equal(mutations.repeatedEquip.error.code,"item_not_observed");
  assert.deepEqual(mutations.repeatedEquipUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.invalidEquip.error.code,"item_not_observed");
  assert.deepEqual(mutations.invalidEquipUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.ok(mutations.observedOldIds.includes("old_blade"));
  assert.equal(mutations.missingObserved.error.code,"item_not_found");
  assert.deepEqual(mutations.missingObservedUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.staleSnapshotEquip.error.code,"item_not_observed");
  assert.deepEqual(mutations.staleSnapshotUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.replacedHeroEquip.error.code,"item_not_observed");
  assert.deepEqual(mutations.replacedHeroUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.duplicateEquip.error.code,"ambiguous_item_id");
  assert.deepEqual(mutations.duplicateUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.nonEquippable.error.code,"item_not_equippable");
  assert.deepEqual(mutations.nonEquippableUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.combatEquip.error.code,"combat_active");
  assert.deepEqual(mutations.combatEquipUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.modalEquip.error.code,"blocking_interaction");
  assert.deepEqual(mutations.modalEquipUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.invalidObject.error.code,"invalid_item_id");
  assert.deepEqual(mutations.invalidObjectUnchanged,{state:true,battle:true,save:true,combatHtml:true});
  assert.equal(mutations.extraField.error.code,"invalid_arguments");
  assert.deepEqual(mutations.extraFieldUnchanged,{state:true,battle:true,save:true,combatHtml:true});

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
    const storytellerChoice = {id:"fixture_choice",label:"Choose",callback:()=>"private"};
    const storytellerEvent = {
      id:"fixture_story",
      title:"Fixture Story",
      setup:"Fixture setup",
      category:"mystery",
      reasonCode:"fixture_reason",
      reason:"Fixture reason",
      context:{locationType:"majorLocation",locationId:"fixture_place"},
      cooldown:{days:3,daysRemaining:0,priorOccurrences:0,maxOccurrences:null},
      choices:[storytellerChoice],
      requiredActionId:"private.action",
      futureRoute:{serviceEventId:"private_event"},
      predicate:()=>true,
      effect:()=>false
    };
    const storytellerSelector = {
      status:"ready",
      language:"en",
      eligibilityKey:"private-eligibility-key",
      blockedReasonCode:null,
      blockedReason:null,
      context:{
        currentScreen:"home",
        interactionLayer:"screen",
        blockingInteractionOpen:false,
        combatActive:false,
        locationType:"majorLocation",
        locationId:"fixture_place",
        isTraveling:false,
        travelStatus:null,
        calendar:{month:2,day:3,ordinal:33}
      },
      cooldown:{globalReady:true,globalDaysRemaining:0},
      eventEligibilityStates:[{
        eventId:"fixture_story",
        eligible:true,
        reasonCode:null,
        eligibleAfterOrdinal:null,
        daysRemaining:0
      }],
      eligibleEvents:[storytellerEvent],
      privateState:{mustNotEscape:true}
    };
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
      getStorytellerOptions:()=>storytellerSelector,
      getRegisteredWebMcpTools:()=>["get_quest_log","get_available_actions"],
      gearSlots:["weapon"]
    });
    const inventory = await tools.find(tool=>tool.name === "get_inventory").execute({});
    const equipment = await tools.find(tool=>tool.name === "get_equipment").execute({});
    const location = await tools.find(tool=>tool.name === "get_current_location").execute({});
    const quests = await tools.find(tool=>tool.name === "get_quest_log").execute({});
    const actions = await tools.find(tool=>tool.name === "get_available_actions").execute({});
    const storyteller = await tools.find(tool=>tool.name === "get_storyteller_options").execute({});
    const toolsWithoutTotals = createWebMcpTools({getState:()=>fixture,gearSlots:["weapon"]});
    const statusWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_player_status").execute({});
    const equipmentWithoutTotals = await toolsWithoutTotals.find(tool=>tool.name === "get_equipment").execute({});
    inventory.inventory.items[0].name = "Changed";
    equipment.equipment.slots.weapon.name = "Changed";
    location.location.services.push("Changed");
    quests.quest_log.chapters[0].quests[0].reward.gold = 999;
    actions.actions.player_ui_controlled[0].parameters.destination_id = "changed";
    storyteller.storyteller.eligible_events[0].title = "Changed Story";
    storyteller.storyteller.eligible_events[0].human_choices[0].label = "Changed choice";
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
      storytellerEventKeys:Object.keys(storyteller.storyteller.eligible_events[0]).sort(),
      storytellerChoiceKeys:Object.keys(storyteller.storyteller.eligible_events[0].human_choices[0]).sort(),
      storytellerJson:JSON.stringify(storyteller),
      sourceStoryTitle:storytellerEvent.title,
      sourceStoryChoice:storytellerChoice.label,
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
  assert.deepEqual(projection.storytellerEventKeys,[
    "category","context","cooldown","eligibility_reason","eligibility_reason_code","event_id","human_choices","setup_text","title","token","token_status"
  ]);
  assert.deepEqual(projection.storytellerChoiceKeys,["choice_id","currently_presented","interaction_owner","label","webmcp_invocable"]);
  assert.equal(projection.sourceStoryTitle,"Fixture Story","Storyteller titles must be defensively copied");
  assert.equal(projection.sourceStoryChoice,"Choose","Storyteller choices must be defensively copied");
  assert.doesNotMatch(projection.storytellerJson,/private-eligibility-key|privateState|requiredActionId|futureRoute|private_event|predicate|effect|callback/);
  assert.equal(projection.sourceQuestGold,3,"quest selector output must be defensively copied");
  assert.equal(projection.sourceDestinationId,"fixture_destination","action selector output must be defensively copied");
  assert.deepEqual(projection.unavailableTotals,{
    statusAttack:null,
    statusDefense:null,
    equipmentAttack:null,
    equipmentDefense:null
  });

  const storytellerContracts = await page.evaluate(async()=>{
    const { createWebMcpTools } = await import("./src/webmcp.js");
    const gameState = {hero:{name:"Contract Hero"},world:{locationId:"fixture_place"}};
    const event = {
      id:"fixture_story",
      title:"Fixture Story",
      setup:"Fixture setup",
      category:"mystery",
      reasonCode:"fixture_reason",
      reason:"Fixture reason",
      context:{locationType:"majorLocation",locationId:"fixture_place"},
      cooldown:{days:3,daysRemaining:0,priorOccurrences:0,maxOccurrences:null},
      choices:[{id:"fixture_choice",label:"Choose"}]
    };
    const selector = {
      status:"ready",
      language:"en",
      eligibilityKey:"fixture-eligibility-key",
      blockedReasonCode:null,
      blockedReason:null,
      context:{
        currentScreen:"home",
        interactionLayer:"screen",
        blockingInteractionOpen:false,
        combatActive:false,
        locationType:"majorLocation",
        locationId:"fixture_place",
        isTraveling:false,
        travelStatus:null,
        calendar:{month:1,day:1,ordinal:1}
      },
      cooldown:{globalReady:true,globalDaysRemaining:0},
      eventEligibilityStates:[{
        eventId:"fixture_story",
        eligible:true,
        reasonCode:null,
        eligibleAfterOrdinal:null,
        daysRemaining:0
      }],
      eligibleEvents:[event]
    };
    const execute = (selected,extra = {})=>createWebMcpTools({
      getState:()=>gameState,
      getStorytellerOptions:()=>selected,
      storytellerEventIds:["fixture_story"],
      getActiveSaveSlot:()=>1,
      ...extra
    }).find(tool=>tool.name === "get_storyteller_options").execute({});

    let noActiveSelectorCalls = 0;
    const noActive = await createWebMcpTools({
      getState:()=>null,
      getStorytellerOptions:()=>{
        noActiveSelectorCalls += 1;
        throw new Error("must not run");
      }
    }).find(tool=>tool.name === "get_storyteller_options").execute({});
    const blockedWithEvents = await execute({
      ...selector,
      status:"blocked",
      blockedReasonCode:"combat_active",
      blockedReason:"Combat is active."
    },{createStorytellerDecisionToken:()=>{throw new Error("blocked reads must not issue tokens");}});
    const contradictoryReady = await execute({
      ...selector,
      blockedReasonCode:"combat_active",
      blockedReason:"Combat is active."
    });
    const noEntropy = await execute(selector,{createStorytellerDecisionToken:()=>null});
    return {noActive,noActiveSelectorCalls,blockedWithEvents,contradictoryReady,noEntropy};
  });
  assert.equal(storytellerContracts.noActive.ok,true);
  assert.equal(storytellerContracts.noActive.storyteller.blocked_reason.code,"no_active_game");
  assert.equal(storytellerContracts.noActiveSelectorCalls,0,"title-screen discovery must not evaluate gameplay selectors");
  assert.equal(storytellerContracts.blockedWithEvents.ok,true);
  assert.deepEqual(storytellerContracts.blockedWithEvents.storyteller.eligible_events,[],"blocked selector output must never advertise events");
  assert.equal(storytellerContracts.blockedWithEvents.storyteller.decision_token,null);
  assert.equal(storytellerContracts.contradictoryReady.ok,false,"contradictory ready/blocked selector output must fail closed");
  assert.equal(storytellerContracts.contradictoryReady.error.code,"storyteller_context_unavailable");
  assert.equal(storytellerContracts.noEntropy.ok,true);
  assert.equal(storytellerContracts.noEntropy.storyteller.eligible_event_count,1);
  assert.equal(storytellerContracts.noEntropy.storyteller.decision_token,null);
  assert.equal(storytellerContracts.noEntropy.storyteller.decision_token_status,"secure_random_unavailable");

  const mutationContracts = await page.evaluate(async()=>{
    const { createWebMcpTools } = await import("./src/webmcp.js");
    const oldItem = {id:"contract_old",name:"Contract Old",slot:"weapon",attack:2,defense:0};
    const newItem = {id:"contract_new",name:"Contract New",slot:"weapon",attack:7,defense:0};
    const unchangedState = {hero:{inv:[newItem],gear:{weapon:oldItem},companions:[],stats:{},resists:{}}};
    const unchangedTools = createWebMcpTools({
      getState:()=>unchangedState,
      getMutationSafetyContext:()=>({combat_active:false,blocking_interaction_open:false}),
      executeUseItem:()=>undefined,
      getEquipItemAvailability:()=>({allowed:true,slot:"weapon"}),
      equipItem:()=>undefined,
      gearSlots:["weapon"]
    });
    await unchangedTools.find(tool=>tool.name === "get_inventory").execute({});
    const beforeNoConfirmation = JSON.stringify(unchangedState);
    const unconfirmedPotion = await unchangedTools.find(tool=>tool.name === "use_item").execute({item_id:"health_potion"});
    const unconfirmedEquip = await unchangedTools.find(tool=>tool.name === "equip_item").execute({item_id:"contract_new"});
    const afterNoConfirmation = JSON.stringify(unchangedState);

    const throwingState = {
      hero:{
        inv:[{...newItem}],
        gear:{weapon:{...oldItem}},
        companions:[],
        stats:{},
        resists:{}
      }
    };
    let persistedThrowingHero = null;
    const throwingTools = createWebMcpTools({
      getState:()=>throwingState,
      getSavedHero:()=>persistedThrowingHero,
      getTotalAttack:()=>10 + Number(throwingState.hero.gear.weapon?.attack || 0),
      getTotalDefense:()=>5,
      getMutationSafetyContext:()=>({combat_active:false,blocking_interaction_open:false}),
      getEquipItemAvailability:()=>({allowed:true,slot:"weapon"}),
      equipItem:id=>{
        const index = throwingState.hero.inv.findIndex(item=>item.id === id);
        const [item] = throwingState.hero.inv.splice(index,1);
        throwingState.hero.inv.push(throwingState.hero.gear.weapon);
        throwingState.hero.gear.weapon = item;
        persistedThrowingHero = JSON.parse(JSON.stringify(throwingState.hero));
        throw new Error("simulated post-save UI refresh failure");
      },
      gearSlots:["weapon"]
    });
    await throwingTools.find(tool=>tool.name === "get_inventory").execute({});
    const confirmedDespiteThrow = await throwingTools.find(tool=>tool.name === "equip_item").execute({item_id:"contract_new"});

    const unsavedState = {
      hero:{
        inv:[{...newItem,id:"unsaved_new"}],
        gear:{weapon:{...oldItem,id:"unsaved_old"}},
        companions:[],
        stats:{},
        resists:{}
      }
    };
    const unsavedTools = createWebMcpTools({
      getState:()=>unsavedState,
      getSavedHero:()=>null,
      getMutationSafetyContext:()=>({combat_active:false,blocking_interaction_open:false}),
      getEquipItemAvailability:()=>({allowed:true,slot:"weapon"}),
      equipItem:id=>{
        const index = unsavedState.hero.inv.findIndex(item=>item.id === id);
        const [item] = unsavedState.hero.inv.splice(index,1);
        unsavedState.hero.inv.push(unsavedState.hero.gear.weapon);
        unsavedState.hero.gear.weapon = item;
        throw new Error("simulated save failure");
      },
      gearSlots:["weapon"]
    });
    await unsavedTools.find(tool=>tool.name === "get_inventory").execute({});
    const unpersistedEquip = await unsavedTools.find(tool=>tool.name === "equip_item").execute({item_id:"unsaved_new"});

    let unsafeMutationCalls = 0;
    const partialSafetyState = {hero:{inv:[{...newItem,id:"partial_safety"}],gear:{weapon:null},companions:[],stats:{},resists:{}}};
    const partialSafetyTools = createWebMcpTools({
      getState:()=>partialSafetyState,
      getMutationSafetyContext:()=>({}),
      executeUseItem:()=>{unsafeMutationCalls++;},
      getEquipItemAvailability:()=>({allowed:true,slot:"weapon"}),
      equipItem:()=>{unsafeMutationCalls++;},
      gearSlots:["weapon"]
    });
    await partialSafetyTools.find(tool=>tool.name === "get_inventory").execute({});
    const partialSafetyPotion = await partialSafetyTools.find(tool=>tool.name === "use_item").execute({item_id:"health_potion"});
    const partialSafetyEquip = await partialSafetyTools.find(tool=>tool.name === "equip_item").execute({item_id:"partial_safety"});

    const projectedPotionHero = {hp:70,maxHp:120,mana:45,maxMana:45,potions:0,manaPotions:1};
    const projectedPotionTools = createWebMcpTools({
      getState:()=>({hero:projectedPotionHero}),
      getSavedHero:()=>({...projectedPotionHero}),
      getMutationSafetyContext:()=>({combat_active:true,blocking_interaction_open:false}),
      executeUseItem:()=>({
        ok:true,accepted:true,success:true,item_id:"health_potion",item_used:"health_potion",
        before:{quantity:1,health:{current:30,maximum:120},mana:{current:45,maximum:45}},
        after:{quantity:0,health:{current:70,maximum:120},mana:{current:45,maximum:45}},
        combat_before:{active:true,resolving:false,hero_action_locked:false,current_actor_side:"hero",current_actor_id:"hero"},
        combat:{active:true,resolving:true,hero_action_locked:true,current_actor_side:"hero",current_actor_id:"hero"},
        combat_resolving:true,
        error:null,
        secret_live_state:{hero:projectedPotionHero},
        callback:()=>"must not escape"
      })
    });
    const projectedPotion = await projectedPotionTools.find(tool=>tool.name === "use_item").execute({item_id:"health_potion"});
    return {
      unconfirmedPotion,
      unconfirmedEquip,
      noConfirmationChanged:beforeNoConfirmation !== afterNoConfirmation,
      confirmedDespiteThrow,
      liveEquippedId:throwingState.hero.gear.weapon.id,
      liveInventoryIds:throwingState.hero.inv.map(item=>item.id),
      unpersistedEquip,
      partialSafetyPotion,
      partialSafetyEquip,
      unsafeMutationCalls,
      projectedPotion,
      projectedPotionKeys:Object.keys(projectedPotion)
    };
  });
  assert.equal(mutationContracts.unconfirmedPotion.accepted,true);
  assert.equal(mutationContracts.unconfirmedPotion.success,false,"an undefined canonical potion result must not be treated as success");
  assert.equal(mutationContracts.unconfirmedPotion.error.code,"execution_not_confirmed");
  assert.equal(mutationContracts.unconfirmedEquip.accepted,true);
  assert.equal(mutationContracts.unconfirmedEquip.success,false,"an undefined equip return must require state postconditions");
  assert.equal(mutationContracts.unconfirmedEquip.error.code,"execution_not_confirmed");
  assert.equal(mutationContracts.noConfirmationChanged,false);
  assert.equal(mutationContracts.confirmedDespiteThrow.success,false,"a post-save refresh exception must not be silently reported as a complete mutation");
  assert.equal(mutationContracts.confirmedDespiteThrow.error.code,"execution_error");
  assert.equal(mutationContracts.confirmedDespiteThrow.save_persisted,true);
  assert.equal(mutationContracts.liveEquippedId,"contract_new");
  assert.deepEqual(mutationContracts.liveInventoryIds,["contract_old"]);
  assert.equal(mutationContracts.confirmedDespiteThrow.previous_item_returned_to_inventory,true);
  assert.equal(mutationContracts.unpersistedEquip.success,false,"a live equipment change without save persistence must not be reported as success");
  assert.equal(mutationContracts.unpersistedEquip.error.code,"save_not_confirmed");
  assert.equal(mutationContracts.unpersistedEquip.save_persisted,false);
  assert.equal(mutationContracts.partialSafetyPotion.error.code,"safety_context_unavailable");
  assert.equal(mutationContracts.partialSafetyEquip.error.code,"safety_context_unavailable");
  assert.equal(mutationContracts.unsafeMutationCalls,0,"an incomplete mutation safety context must fail closed");
  assert.equal(mutationContracts.projectedPotion.success,true);
  assert.equal(mutationContracts.projectedPotion.save_persisted,true);
  assert.ok(!mutationContracts.projectedPotionKeys.includes("secret_live_state"));
  assert.ok(!mutationContracts.projectedPotionKeys.includes("callback"));

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

async function testStorytellerMutation(browser,baseUrl){
  const page = await browser.newPage();
  const errors = trackPageErrors(page);
  await page.evaluateOnNewDocument(()=>{
    const tools = {};
    Object.defineProperty(document,"modelContext",{configurable:true,value:{
      registerTool(tool){
        if(!tool?.name || typeof tool.execute !== "function")throw new Error("Invalid WebMCP tool");
        tools[tool.name] = tool;
        window.__WEBMCP_TEST_TOOLS = tools;
      }
    }});
  });
  await openGame(page,baseUrl);
  await page.waitForFunction(expected=>Object.keys(window.__WEBMCP_TEST_TOOLS || {}).length === expected,{timeout:10000},EXPECTED_TOOLS.length);

  const result = await page.evaluate(async()=>{
    window.FE.startActualGame("Storyteller Mutation Tester","warrior");
    await new Promise(resolve=>setTimeout(resolve,350));
    window.FE.closeModals();
    const stateModule = await import("./src/state.js");
    const languageModule = await import("./src/language.js");
    const combatModule = await import("./src/combat.js");
    const worldModule = await import("./src/world.js");
    const tools = window.__WEBMCP_TEST_TOOLS;
    const eventIds = [
      "cinderhook_warning_messenger",
      "tavern_suspicious_stranger",
      "market_cutpurse"
    ];
    const baseline = JSON.parse(JSON.stringify(stateModule.state));
    const saveKey = "fallenEmpireSave_1";
    const pause = (ms = 30)=>new Promise(resolve=>setTimeout(resolve,ms));
    const clearUi = ()=>{
      window.FE.closeModals();
      document.querySelectorAll(".level-up-back,.encounter-transition,.court-crier-overlay,.toast").forEach(node=>node.remove());
    };
    const reset = async(language = "en")=>{
      if(combatModule.battle)combatModule.runBattle();
      try{worldModule.cancelTravel();}catch{}
      clearUi();
      languageModule.setLanguage(language);
      stateModule.setState(JSON.parse(JSON.stringify(baseline)));
      window.FE.show("home");
      stateModule.save(1);
      await pause();
      clearUi();
    };
    const storageSnapshot = ()=>JSON.stringify(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]));
    const failureSnapshot = ()=>(
      {
        state:JSON.stringify(stateModule.state),
        storage:storageSnapshot(),
        pendingMarkers:[...document.querySelectorAll("[data-storyteller-event]")].map(node=>({
          eventId:node.getAttribute("data-storyteller-event"),
          sequence:node.getAttribute("data-storyteller-sequence")
        }))
      }
    );
    const failedAttempt = async(input)=>{
      const before = failureSnapshot();
      const response = await tools.trigger_story_event.execute(input);
      const after = failureSnapshot();
      return {
        response,
        unchanged:{
          state:before.state === after.state,
          storage:before.storage === after.storage,
          pendingMarkers:JSON.stringify(before.pendingMarkers) === JSON.stringify(after.pendingMarkers)
        }
      };
    };
    const discover = async()=>tools.get_storyteller_options.execute({});
    const option = (options,eventId)=>options.storyteller.eligible_events.find(event=>event.event_id === eventId);
    const clickSecondChoice = async(eventId)=>{
      const marker = document.querySelector(`[data-storyteller-event="${eventId}"]`);
      const buttons = [...(marker?.closest(".modal-back")?.querySelectorAll("button") || [])];
      buttons[1]?.click();
      await pause(50);
      return buttons[1]?.textContent?.trim() || null;
    };
    const present = async(eventId,language = "en")=>{
      await reset(language);
      const discovered = await discover();
      const selected = option(discovered,eventId);
      const stateBefore = JSON.stringify(stateModule.state);
      const saveBefore = localStorage.getItem(saveKey);
      const response = await tools.trigger_story_event.execute({event_id:eventId,token:selected.token});
      const responseForAssertions = JSON.parse(JSON.stringify(response));
      const afterExecutionState = JSON.stringify(stateModule.state);
      const afterExecutionStorage = storageSnapshot();
      response.event_title = "Changed detached response";
      response.available_human_choice_ids?.push("fake_choice");
      const responseDetached = afterExecutionState === JSON.stringify(stateModule.state)
        && afterExecutionStorage === storageSnapshot();
      const marker = document.querySelector(`[data-storyteller-event="${eventId}"]`);
      const modalRoot = marker?.closest(".modal-back") || null;
      const liveStoryteller = JSON.parse(JSON.stringify(stateModule.state.world.storyteller || null));
      const savedStoryteller = JSON.parse(localStorage.getItem(saveKey))?.world?.storyteller || null;
      const whilePresented = await discover();
      const secondLabel = await clickSecondChoice(eventId);
      const resolvedStoryteller = JSON.parse(JSON.stringify(stateModule.state.world.storyteller || null));
      const resolvedSavedStoryteller = JSON.parse(localStorage.getItem(saveKey))?.world?.storyteller || null;
      const afterResolution = await discover();
      return {
        discovered,
        response:responseForAssertions,
        responseDetached,
        modal:{
          present:!!modalRoot,
          title:modalRoot?.querySelector("h2")?.textContent?.trim() || null,
          buttons:[...(modalRoot?.querySelectorAll("button") || [])].map(button=>button.textContent.trim())
        },
        stateChanged:stateBefore !== JSON.stringify(stateModule.state),
        saveChanged:saveBefore !== localStorage.getItem(saveKey),
        liveStoryteller,
        savedStoryteller,
        whilePresented,
        secondLabel,
        resolvedStoryteller,
        resolvedSavedStoryteller,
        afterResolution
      };
    };
    const followAffirmativeRoute = async(eventId)=>{
      await reset("en");
      const discovered = await discover();
      const selected = option(discovered,eventId);
      const goldBefore = stateModule.state.hero.gold;
      const storyCountBefore = stateModule.state.world.story?.length || 0;
      const gangBefore = JSON.stringify(stateModule.state.prologue?.gang || null);
      const response = await tools.trigger_story_event.execute({event_id:eventId,token:selected.token});
      const marker = document.querySelector(`[data-storyteller-event="${eventId}"]`);
      const firstChoiceLabel = marker?.closest(".modal-back")?.querySelector("button")?.textContent?.trim() || null;
      marker?.closest(".modal-back")?.querySelector("button")?.click();
      await pause(100);
      const activeScreen = document.querySelector(".screen.active")?.id || null;
      const modalRoot = document.querySelector(".modal-back");
      const dialogue = document.querySelector("#town .scene-dialogue-panel");
      const currentStoryteller = JSON.parse(JSON.stringify(stateModule.state.world.storyteller || null));
      const saved = JSON.parse(localStorage.getItem(saveKey));
      return {
        response,
        firstChoiceLabel,
        goldBefore,
        goldAfter:stateModule.state.hero.gold,
        storyCountBefore,
        storyCountAfter:stateModule.state.world.story?.length || 0,
        gangBefore,
        gangAfter:JSON.stringify(stateModule.state.prologue?.gang || null),
        combatActive:!!combatModule.battle,
        activeScreen,
        modalTitle:modalRoot?.querySelector("h2")?.textContent?.trim() || null,
        modalButtons:[...(modalRoot?.querySelectorAll("button") || [])].map(button=>button.textContent.trim()),
        dialogueTitle:dialogue?.querySelector("h2")?.textContent?.trim() || null,
        dialogueButtons:[...(dialogue?.querySelectorAll("button") || [])].map(button=>button.textContent.trim()),
        sceneResult:document.querySelector("#town .scene-result")?.textContent?.trim() || null,
        dailyEvents:{...(stateModule.state.world.dailyLocationEvents || {})},
        currentStoryteller,
        savedStoryteller:saved?.world?.storyteller || null,
        savedGold:saved?.hero?.gold,
        savedStoryCount:saved?.world?.story?.length || 0
      };
    };

    await reset();
    const tokenOptions = await discover();
    const tokenRecords = tokenOptions.storyteller.eligible_events.map(event=>(
      {eventId:event.event_id,token:event.token,tokenStatus:event.token_status}
    ));
    const topTokenAlias = {
      eventId:tokenOptions.storyteller.decision_event_id,
      token:tokenOptions.storyteller.decision_token
    };

    const missingToken = await failedAttempt({event_id:eventIds[0]});
    const extraField = await failedAttempt({event_id:eventIds[0],token:tokenRecords[0].token,choice_id:"send_away"});
    const malformedToken = await failedAttempt({event_id:eventIds[0],token:"not-a-story-token"});
    const modifiedTokenValue = `${tokenRecords[0].token.slice(0,-1)}${tokenRecords[0].token.endsWith("a") ? "b" : "a"}`;
    const modifiedToken = await failedAttempt({event_id:eventIds[0],token:modifiedTokenValue});
    const unknownEvent = await failedAttempt({event_id:"unknown_story_event",token:tokenRecords[0].token});
    const mismatchedEvent = await failedAttempt({event_id:eventIds[1],token:tokenRecords[0].token});
    const validAfterMismatch = await tools.trigger_story_event.execute({event_id:eventIds[0],token:tokenRecords[0].token});
    const validAfterMismatchPending = JSON.parse(JSON.stringify(stateModule.state.world.storyteller?.pending || null));
    await clickSecondChoice(eventIds[0]);
    const replay = await failedAttempt({event_id:eventIds[0],token:tokenRecords[0].token});

    await reset();
    const supersededOptions = await discover();
    const supersededToken = option(supersededOptions,eventIds[0]).token;
    const replacementOptions = await discover();
    const replacementToken = option(replacementOptions,eventIds[0]).token;
    const superseded = await failedAttempt({event_id:eventIds[0],token:supersededToken});

    await reset();
    const staleOptions = await discover();
    const staleToken = option(staleOptions,eventIds[0]).token;
    stateModule.state.world.day += 1;
    const stale = await failedAttempt({event_id:eventIds[0],token:staleToken});

    await reset();
    const modalOptions = await discover();
    window.FE.modal("Blocking test","<p>Player interaction remains open.</p>",[{label:"Close"}]);
    const modalBlocked = await failedAttempt({event_id:eventIds[0],token:option(modalOptions,eventIds[0]).token});
    clearUi();

    await reset();
    const travelOptions = await discover();
    worldModule.debugEnterRoadStopScene("ashen_gate","market_town");
    const travelBlocked = await failedAttempt({event_id:eventIds[0],token:option(travelOptions,eventIds[0]).token});

    await reset();
    const combatOptions = await discover();
    combatModule.startBattle([{
      name:"Storyteller Test Dummy",role:"test",level:1,hp:500,maxHp:500,attack:1,defense:0,speed:-100,xp:0,gold:0
    }],"Storyteller blocker test.",{source:"webmcp-storyteller-test"});
    const combatBlocked = await failedAttempt({event_id:eventIds[0],token:option(combatOptions,eventIds[0]).token});

    await reset();
    const progressionOptions = await discover();
    stateModule.state.hero.gold = 0;
    const progressionBlocked = await failedAttempt({event_id:eventIds[2],token:option(progressionOptions,eventIds[2]).token});

    await reset();
    const eventCooldownOptions = await discover();
    stateModule.state.world.storyteller = {
      version:1,sequence:1,pending:null,globalEligibleAfterOrdinal:0,
      lastByEvent:{
        tavern_suspicious_stranger:{seenCount:1,lastOrdinal:1,eligibleAfterOrdinal:5,lastChoiceId:"let_them_leave",status:"resolved"}
      },
      history:[]
    };
    const eventCooldownBlocked = await failedAttempt({event_id:eventIds[1],token:option(eventCooldownOptions,eventIds[1]).token});

    await reset();
    const occurrenceOptions = await discover();
    stateModule.state.world.storyteller = {
      version:1,sequence:1,pending:null,globalEligibleAfterOrdinal:0,
      lastByEvent:{
        cinderhook_warning_messenger:{seenCount:1,lastOrdinal:1,eligibleAfterOrdinal:4,lastChoiceId:"send_away",status:"resolved"}
      },
      history:[]
    };
    const occurrenceBlocked = await failedAttempt({event_id:eventIds[0],token:option(occurrenceOptions,eventIds[0]).token});

    await reset();
    const globalCooldownOptions = await discover();
    stateModule.state.world.storyteller = {
      version:1,sequence:0,pending:null,globalEligibleAfterOrdinal:2,lastByEvent:{},history:[]
    };
    const globalCooldownBlocked = await failedAttempt({event_id:eventIds[1],token:option(globalCooldownOptions,eventIds[1]).token});

    const englishWarning = await present(eventIds[0],"en");
    const spanishTavern = await present(eventIds[1],"es");
    const englishMarket = await present(eventIds[2],"en");

    await reset("en");
    const pendingOptions = await discover();
    const pendingEvent = option(pendingOptions,eventIds[2]);
    const pendingResponse = await tools.trigger_story_event.execute({event_id:eventIds[2],token:pendingEvent.token});
    const pendingBeforeReload = JSON.parse(JSON.stringify(stateModule.state.world.storyteller));
    window.FE.closeModals();
    const optionsWithHiddenPending = await discover();
    window.FE.loadFromSlot(1);
    await pause(120);
    const reloadMarker = document.querySelector(`[data-storyteller-event="${eventIds[2]}"]`);
    const pendingAfterReload = JSON.parse(JSON.stringify(stateModule.state.world.storyteller));
    const savedAfterReload = JSON.parse(localStorage.getItem(saveKey))?.world?.storyteller || null;
    const reload = {
      pendingResponse,
      pendingBeforeReload,
      optionsWithHiddenPending,
      markerPresent:!!reloadMarker,
      markerSequence:Number(reloadMarker?.getAttribute("data-storyteller-sequence")),
      modalTitle:reloadMarker?.closest(".modal-back")?.querySelector("h2")?.textContent?.trim() || null,
      pendingAfterReload,
      savedAfterReload
    };
    await clickSecondChoice(eventIds[2]);

    await reset("en");
    const bootBlockedOptions = await discover();
    const bootBlockedEvent = option(bootBlockedOptions,eventIds[1]);
    const bootBlockedResponse = await tools.trigger_story_event.execute({
      event_id:eventIds[1],
      token:bootBlockedEvent.token
    });
    const bootBlockedHistoryLength = stateModule.state.world.storyteller.history.length;
    stateModule.queueAbilityMilestone(5,stateModule.state.hero);
    stateModule.save(1);
    window.FE.closeModals();
    window.FE.loadFromSlot(1);
    await pause(120);
    const startupModal = document.querySelector(".modal-back");
    const startupModalTitle = startupModal?.querySelector("h2")?.textContent?.trim() || null;
    const storyVisibleBehindStartupModal = !!document.querySelector(`[data-storyteller-event="${eventIds[1]}"]`);
    startupModal?.querySelector("button")?.click();
    await pause(160);
    const resumedAfterStartupMarker = document.querySelector(`[data-storyteller-event="${eventIds[1]}"]`);
    const bootBlockedReload = {
      response:bootBlockedResponse,
      startupModalTitle,
      storyVisibleBehindStartupModal,
      resumed:!!resumedAfterStartupMarker,
      resumedSequence:Number(resumedAfterStartupMarker?.getAttribute("data-storyteller-sequence")),
      pending:JSON.parse(JSON.stringify(stateModule.state.world.storyteller.pending)),
      historyLength:stateModule.state.world.storyteller.history.length,
      originalHistoryLength:bootBlockedHistoryLength,
      abilityPendingCount:stateModule.state.hero.abilityMilestones.pending.length
    };
    await clickSecondChoice(eventIds[1]);

    const affirmativeRoutes = {
      warning:await followAffirmativeRoute(eventIds[0]),
      tavern:await followAffirmativeRoute(eventIds[1]),
      market:await followAffirmativeRoute(eventIds[2])
    };

    const allFailureCases = {
      missingToken,extraField,malformedToken,modifiedToken,unknownEvent,mismatchedEvent,replay,
      superseded,stale,modalBlocked,travelBlocked,combatBlocked,progressionBlocked,
      eventCooldownBlocked,occurrenceBlocked,globalCooldownBlocked
    };
    return {
      tokenRecords,topTokenAlias,replacementToken,
      allFailureCases,
      validAfterMismatch,validAfterMismatchPending,
      successes:{englishWarning,spanishTavern,englishMarket},
      reload,
      bootBlockedReload,
      affirmativeRoutes,
      finalState:JSON.stringify(stateModule.state),
      finalStorage:storageSnapshot()
    };
  });

  assert.deepEqual(result.tokenRecords.map(record=>record.eventId),STORYTELLER_EVENT_IDS);
  assert.equal(new Set(result.tokenRecords.map(record=>record.token)).size,STORYTELLER_EVENT_IDS.length,"each event must have its own token");
  assert.ok(result.tokenRecords.every(record=>/^story-[A-Za-z0-9-]{14,122}$/.test(record.token) && record.tokenStatus === "issued"));
  assert.deepEqual(result.topTokenAlias,{eventId:result.tokenRecords[0].eventId,token:result.tokenRecords[0].token});
  assert.notEqual(result.replacementToken,result.tokenRecords[0].token,"a later discovery must issue a fresh receipt set");

  const expectedFailureCodes = {
    missingToken:"invalid_arguments",
    extraField:"invalid_arguments",
    malformedToken:"invalid_token",
    modifiedToken:"decision_token_mismatch",
    unknownEvent:"unknown_event_id",
    mismatchedEvent:"event_token_mismatch",
    replay:"decision_token_mismatch",
    superseded:"decision_token_mismatch",
    stale:"stale_decision",
    modalBlocked:"blocking_interaction",
    travelBlocked:"travel_in_progress",
    combatBlocked:"combat_active",
    progressionBlocked:"progression_requirement_unmet",
    eventCooldownBlocked:"event_cooldown",
    occurrenceBlocked:"max_occurrences_reached",
    globalCooldownBlocked:"global_cooldown"
  };
  for(const [name,code] of Object.entries(expectedFailureCodes)){
    const failure = result.allFailureCases[name];
    assert.equal(failure.response.ok,false,`${name} must fail closed`);
    assert.equal(failure.response.success,false,`${name} must not claim success`);
    assert.equal(failure.response.error.code,code,`${name} must report its precise failure reason`);
    assert.deepEqual(failure.unchanged,{state:true,storage:true,pendingMarkers:true},`${name} must not alter game state, localStorage, or Storyteller UI`);
  }
  assert.equal(result.allFailureCases.missingToken.response.token_consumed,false);
  assert.equal(result.allFailureCases.mismatchedEvent.response.token_consumed,false,"an event/token mismatch must not consume the valid event receipt");
  assert.equal(result.allFailureCases.stale.response.token_consumed,true,"a matching one-use token must be consumed before execution-time revalidation");
  assert.equal(result.validAfterMismatch.success,true,"event/token mismatch must leave the token usable for its exact event");
  assert.equal(result.validAfterMismatch.event_id,STORYTELLER_EVENT_IDS[0]);
  assert.equal(result.validAfterMismatchPending.eventId,STORYTELLER_EVENT_IDS[0]);

  const expectedPresentations = {
    englishWarning:{eventId:STORYTELLER_EVENT_IDS[0],title:"A Warning at the Door",buttons:["Hear the warning","Send the messenger away"],second:"Send the messenger away"},
    spanishTavern:{eventId:STORYTELLER_EVENT_IDS[1],title:"El desconocido encapuchado",buttons:["Seguirlo dentro de la taberna","Dejar que se marche"],second:"Dejar que se marche"},
    englishMarket:{eventId:STORYTELLER_EVENT_IDS[2],title:"A Hand in the Crowd",buttons:["Enter the market","Guard your purse and move on"],second:"Guard your purse and move on"}
  };
  for(const [name,expected] of Object.entries(expectedPresentations)){
    const success = result.successes[name];
    assert.equal(success.response.ok,true,`${name} must be accepted`);
    assert.equal(success.response.accepted,true);
    assert.equal(success.response.success,true);
    assert.equal(success.response.event_id,expected.eventId);
    assert.equal(success.response.event_title,expected.title);
    assert.equal(success.response.event_presented,true);
    assert.equal(success.response.token_consumed,true);
    assert.equal(success.response.presentation_status,"presented");
    assert.equal(success.response.awaiting_player_choice,true);
    assert.equal(success.response.human_action_required,true);
    assert.equal(success.response.interaction_owner,"player_ui");
    assert.equal(success.response.save_persisted,true);
    assert.equal(success.response.error,null);
    assert.equal(success.responseDetached,true,"mutating the returned trigger projection must not alter live or saved game state");
    assert.deepEqual(success.response.available_human_choice_ids,success.discovered.storyteller.eligible_events.find(event=>event.event_id === expected.eventId).human_choices.map(choice=>choice.choice_id));
    assert.equal(success.modal.present,true);
    assert.equal(success.modal.title,expected.title);
    assert.deepEqual(success.modal.buttons,expected.buttons);
    assert.equal(success.secondLabel,expected.second);
    assert.equal(success.liveStoryteller.pending.eventId,expected.eventId);
    assert.equal(success.liveStoryteller.pending.sequence,success.response.pending_sequence);
    assert.deepEqual(success.savedStoryteller.pending,success.liveStoryteller.pending,"pending presentation must be saved before the tool reports success");
    assert.equal(success.liveStoryteller.history.at(-1).status,"presented","WebMCP must not auto-select a human choice");
    assert.equal(success.liveStoryteller.history.at(-1).choiceId,null);
    assert.equal(success.liveStoryteller.history.at(-1).outcomeId,null);
    assert.equal(success.whilePresented.storyteller.status,"blocked");
    assert.equal(success.whilePresented.storyteller.blocked_reason.code,"blocking_interaction");
    assert.equal(success.whilePresented.storyteller.decision_token,null);
    assert.equal(success.resolvedStoryteller.pending,null);
    assert.equal(success.resolvedStoryteller.history.at(-1).status,"resolved");
    assert.equal(success.resolvedStoryteller.history.at(-1).choiceId,success.response.available_human_choice_ids[1]);
    assert.equal(success.resolvedSavedStoryteller.history.at(-1).choiceId,success.response.available_human_choice_ids[1]);
    assert.equal(success.afterResolution.storyteller.status,"blocked");
    assert.equal(success.afterResolution.storyteller.blocked_reason.code,"global_cooldown");
    assert.equal(success.stateChanged,true);
    assert.equal(success.saveChanged,true);
    assert.doesNotMatch(JSON.stringify(success.response),/eligibilityKey|eligibility_key|callback|route|effect|FE\./);
  }

  assert.equal(result.reload.pendingResponse.success,true);
  assert.equal(result.reload.optionsWithHiddenPending.storyteller.blocked_reason.code,"pending_story_event","a persisted pending event must block new discovery even when its modal is manually closed");
  assert.equal(result.reload.markerPresent,true,"loading a save with a pending event must re-present the human-choice modal");
  assert.equal(result.reload.markerSequence,result.reload.pendingBeforeReload.pending.sequence);
  assert.equal(result.reload.modalTitle,"A Hand in the Crowd");
  assert.deepEqual(result.reload.pendingAfterReload.pending,result.reload.pendingBeforeReload.pending);
  assert.deepEqual(result.reload.savedAfterReload.pending,result.reload.pendingBeforeReload.pending);
  assert.equal(result.reload.pendingAfterReload.history.length,result.reload.pendingBeforeReload.history.length,"reload must not append a second presentation history row");

  assert.equal(result.bootBlockedReload.response.success,true);
  assert.match(result.bootBlockedReload.startupModalTitle,/Ability Milestone/i,"the canonical startup progression modal must retain priority");
  assert.equal(result.bootBlockedReload.storyVisibleBehindStartupModal,false,"Storyteller must not replace a startup progression choice");
  assert.equal(result.bootBlockedReload.resumed,true,"the saved Storyteller event must retry after the startup modal closes");
  assert.equal(result.bootBlockedReload.resumedSequence,result.bootBlockedReload.pending.sequence);
  assert.equal(result.bootBlockedReload.historyLength,result.bootBlockedReload.originalHistoryLength,"retrying a saved pending event must not duplicate history");
  assert.equal(result.bootBlockedReload.abilityPendingCount,0);

  const warningRoute = result.affirmativeRoutes.warning;
  assert.equal(warningRoute.response.success,true);
  assert.equal(warningRoute.firstChoiceLabel,"Hear the warning");
  assert.equal(warningRoute.currentStoryteller.pending,null);
  assert.equal(warningRoute.currentStoryteller.history.at(-1).choiceId,"hear_warning");
  assert.equal(warningRoute.modalTitle,"Gang Pressure","the affirmative warning choice must route to the canonical Dock Rats decision UI");
  assert.deepEqual(warningRoute.modalButtons,["Pay 12 Gold","Refuse Enforcer","Close"]);
  assert.equal(warningRoute.goldAfter,warningRoute.goldBefore,"presenting the gang decision must not pay the Dock Rats automatically");
  assert.equal(warningRoute.combatActive,false,"presenting the gang decision must not fight the enforcer automatically");
  assert.equal(warningRoute.gangAfter,warningRoute.gangBefore,"the gang state must remain untouched until the player chooses Pay or Refuse");
  assert.equal(warningRoute.storyCountAfter,warningRoute.storyCountBefore + 1,"only the fixed Storyteller outcome should be logged before the next player choice");
  assert.equal(warningRoute.savedGold,warningRoute.goldBefore);
  assert.equal(warningRoute.savedStoryCount,warningRoute.storyCountAfter);

  const tavernRoute = result.affirmativeRoutes.tavern;
  assert.equal(tavernRoute.response.success,true);
  assert.equal(tavernRoute.firstChoiceLabel,"Follow them into the tavern");
  assert.equal(tavernRoute.currentStoryteller.pending,null);
  assert.equal(tavernRoute.currentStoryteller.history.at(-1).choiceId,"enter_tavern");
  assert.equal(tavernRoute.activeScreen,"town");
  assert.equal(tavernRoute.dialogueTitle,"Stranger","the tavern route must select the canonical suspicious_stranger scene anchor");
  assert.ok(tavernRoute.dialogueButtons.includes("Investigate"),"investigation must remain an explicit player UI action");
  assert.equal(tavernRoute.sceneResult,null,"the Storyteller route must not investigate the stranger automatically");
  assert.equal(tavernRoute.dailyEvents["ashen_slums:tavern:1"],"suspicious_stranger");
  assert.equal(tavernRoute.goldAfter,tavernRoute.goldBefore);
  assert.equal(tavernRoute.storyCountAfter,tavernRoute.storyCountBefore + 1,"opening the tavern scene must not execute its Investigate action");
  assert.equal(tavernRoute.savedStoryCount,tavernRoute.storyCountAfter);
  assert.deepEqual(tavernRoute.savedStoryteller,tavernRoute.currentStoryteller);

  const marketRoute = result.affirmativeRoutes.market;
  assert.equal(marketRoute.response.success,true);
  assert.equal(marketRoute.firstChoiceLabel,"Enter the market");
  assert.equal(marketRoute.currentStoryteller.pending,null);
  assert.equal(marketRoute.currentStoryteller.history.at(-1).choiceId,"enter_market");
  assert.equal(marketRoute.activeScreen,"town");
  assert.equal(marketRoute.dialogueTitle,"Cutpurse","the market route must select the canonical market_thief scene anchor");
  assert.ok(marketRoute.dialogueButtons.includes("Chase"),"the chase must remain an explicit player UI action");
  assert.equal(marketRoute.sceneResult,null,"the Storyteller route must not chase the cutpurse automatically");
  assert.equal(marketRoute.dailyEvents["ashen_slums:market:1"],"market_thief");
  assert.equal(marketRoute.goldAfter,marketRoute.goldBefore,"opening the cutpurse scene must not lose or award gold");
  assert.equal(marketRoute.storyCountAfter,marketRoute.storyCountBefore + 1,"opening the market scene must not execute its Chase action");
  assert.equal(marketRoute.savedGold,marketRoute.goldBefore);
  assert.equal(marketRoute.savedStoryCount,marketRoute.storyCountAfter);
  assert.deepEqual(marketRoute.savedStoryteller,marketRoute.currentStoryteller);
  assert.deepEqual(errors,[],`Storyteller mutation browser test produced errors: ${errors.join(" | ")}`);
  await page.close();
}

async function main(){
  const server = createStaticServer();
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}${BASE_PATH}`;
  let browser = null;
  try{
    const executablePath = browserExecutable();
    const browserArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1280,900",
      "--no-proxy-server",
      "--host-resolver-rules=MAP btt-public.test 127.0.0.1"
    ];
    if(path.basename(executablePath).toLowerCase().includes("msedge")){
      browserArgs.push("--edge-skip-compat-layer-relaunch");
    }
    browser = await puppeteer.launch({
      executablePath,
      headless:true,
      args:browserArgs
    });
    await testWithoutWebMcp(browser,baseUrl);
    console.log("PASS normal game boot, gameplay navigation, saving, and first-visit offline PWA boot without WebMCP");
    await testRecoveryScope(browser,baseUrl);
    console.log("PASS app-scoped service-worker recovery preserves sibling workers, unrelated caches, and saves");
    await testDebugGating(browser,baseUrl,address.port);
    console.log("PASS local-only debug gate and public-host WebMCP discovery");
    await testStorytellerRegistrationFailure(browser,baseUrl);
    console.log("PASS original eight tools survive isolated Storyteller discovery/trigger registration failures");
    await testCourtLedgerProfile(browser,baseUrl);
    console.log(HACKATHON_PROFILE
      ? "PASS hackathon artifact omits Court Ledger/payment UI and functions while preserving exactly ten WebMCP tools"
      : "PASS normal development retains the existing Court Ledger UI and functions");
    await testWithWebMcp(browser,baseUrl);
    console.log(`PASS ${EXPECTED_TOOLS.join(", ")}`);
    console.log("PASS use_item/equip_item rules, persistence, UI synchronization, EN/ES, and failure immutability");
    await testStorytellerMutation(browser,baseUrl);
    console.log("PASS trigger_story_event tokens, guards, presentations, persistence, reload behavior, EN/ES UI, and failure immutability");
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
