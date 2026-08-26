#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const publicRoot = path.join(appRoot,"dist","public");
const manifestPath = path.join(appRoot,"dist","deployment-manifest.json");
const topLevelFiles = new Set([
  "combat-animations.css",
  "index.html",
  "manifest.webmanifest",
  "privacy.html",
  "recovery.html",
  "redesign.css",
  "service-worker.js",
  "styles.css",
  "terms.html",
  "version.json"
]);
const topLevelDirectories = new Set(["assets","icons","src"]);
const artifactTextExtensions = new Set([".css",".html",".js",".json",".svg",".webmanifest"]);
const forbiddenHackathonPatterns = [
  [/supporterStore/i,"Court Ledger module identifier"],
  [/btt_checkout_urls/i,"checkout localStorage key"],
  [/BTT_CHECKOUT_URLS/,"checkout global configuration"],
  [/Stripe Payment Link/i,"Stripe setup copy"],
  [/checkoutMockBody/,"mock-checkout copy"],
  [/checkoutOpensTab/,"checkout-tab copy"],
  [/payPlaytest/,"playtest payment action"],
  [/buySupporterOffer/,"supporter purchase action"],
  [/completePurchase/,"purchase completion action"],
  [/grantOffer/,"mock grant action"],
  [/realMoney(?:Body|Stripe)/,"real-money setup copy"],
  [/Court Ledger/i,"Court Ledger UI copy"],
  [/Libro de la corte/i,"Spanish Court Ledger UI copy"],
  [/Court Crier/i,"mock advertising copy"],
  [/Playtest checkout/i,"playtest checkout copy"],
  [/Paid offers/i,"paid-offer terms copy"],
  [/optional cosmetic purchases/i,"purchase description"],
  [/Ko-fi|Patreon/i,"external monetization link"]
];

async function read(relativePath,root = appRoot){
  return readFile(path.join(root,...relativePath.split("/")),"utf8");
}

async function listFiles(root){
  const files = [];
  async function walk(directory){
    const entries = await readdir(directory,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name,"en"));
    for(const entry of entries){
      const absolute = path.join(directory,entry.name);
      const info = await lstat(absolute);
      const relative = path.relative(root,absolute).split(path.sep).join("/");
      assert.equal(info.isSymbolicLink(),false,`deployment artifact contains a symlink: ${relative}`);
      if(info.isDirectory())await walk(absolute);
      else{
        assert.equal(info.isFile(),true,`deployment artifact contains an unsupported entry: ${relative}`);
        files.push(relative);
      }
    }
  }
  await walk(root);
  return files;
}

function normalizeShellUrl(url){
  return url.replace(/^\.\//,"").replace(/\?.*$/,"");
}

async function testDebugGate(){
  const environmentSource = await read("src/environment.js");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(environmentSource).toString("base64")}`;
  const { isLocalDebugEnabled, isLocalDebugOverlaysEnabled } = await import(moduleUrl);
  const enabled = [
    "http://127.0.0.1:43123/?debug",
    "http://localhost:43123/?debug",
    "http://dev.localhost:43123/?debug",
    "http://0.0.0.0:43123/?debug",
    "http://[::1]:43123/?debug"
  ];
  const disabled = [
    "http://127.0.0.1:43123/",
    "https://judge.example/?debug",
    "https://localhost.example/?debug",
    "https://127.0.0.1.evil.example/?debug"
  ];
  enabled.forEach(url=>assert.equal(isLocalDebugEnabled(new URL(url)),true,`expected local debug: ${url}`));
  disabled.forEach(url=>assert.equal(isLocalDebugEnabled(new URL(url)),false,`expected production debug block: ${url}`));
  assert.equal(isLocalDebugOverlaysEnabled(new URL("https://judge.example/?debugOverlays")),false);
  assert.equal(isLocalDebugOverlaysEnabled(new URL("http://localhost/?debugOverlays")),true);

  const [main,combat,gear,world,ui,portrait] = await Promise.all([
    read("src/main.js"),read("src/combat.js"),read("src/gear.js"),read("src/world.js"),read("src/ui.js"),read("src/portraitRenderer.js")
  ]);
  for(const [name,source] of Object.entries({main,combat,gear,world})){
    assert.doesNotMatch(source,/new URLSearchParams\(location\.search\)\.has\(["']debug["']\)/,`${name} bypasses the centralized debug gate`);
  }
  assert.doesNotMatch(`${ui}\n${portrait}`,/new URLSearchParams\(location\.search\)\.has\(["']debugOverlays["']\)/);
  assert.match(main,/NON_PREFIXED_DEV_FE_KEYS\s*=\s*new Set\(\["forceTravelEncounter","toggleStoreReadiness"\]\)/);
  assert.match(world,/function forceTravelEncounter[\s\S]*?if\(!isLocalDebugEnabled\(\)\)return false;/);
}

async function testModulePrecache(root = appRoot){
  const sourceRoot = path.join(root,"src");
  const graph = new Set();
  const pending = [path.join(sourceRoot,"main.js")];
  while(pending.length){
    const absolute = pending.pop();
    const relative = path.relative(root,absolute).split(path.sep).join("/");
    if(graph.has(relative))continue;
    graph.add(relative);
    const source = await read(relative,root);
    assert.doesNotMatch(source,/\bimport\s*\(/,`${relative} uses a dynamic import that is not statically precached`);
    const imports = [...source.matchAll(/\b(?:from\s*|import\s*)["'](\.[^"']+)["']/g)].map(match=>match[1]);
    for(const specifier of imports){
      const dependency = path.resolve(path.dirname(absolute),specifier);
      assert.equal(dependency.startsWith(`${sourceRoot}${path.sep}`),true,`${relative} imports outside src/: ${specifier}`);
      assert.equal(path.extname(dependency),".js",`${relative} has a non-JavaScript module dependency: ${specifier}`);
      await lstat(dependency);
      pending.push(dependency);
    }
  }

  const allSourceFiles = (await listFiles(sourceRoot)).map(relative=>`src/${relative}`).sort();
  assert.deepEqual([...graph].sort(),allSourceFiles,"every shipped source module should be reachable from main.js");

  const serviceWorker = await read("service-worker.js",root);
  const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1];
  assert.ok(shellBlock,"service worker APP_SHELL was not found");
  const shell = new Set([...shellBlock.matchAll(/["']([^"']+)["']/g)].map(match=>normalizeShellUrl(match[1])));
  for(const modulePath of graph)assert.ok(shell.has(modulePath),`APP_SHELL is missing ${modulePath}`);
  for(const required of [
    "index.html","recovery.html","privacy.html","terms.html","manifest.webmanifest","version.json",
    "assets/ui/generated/title-bg-v19d.png",
    "assets/tutorial/generated/v80/title-bg-mobile-v80.webp",
    "assets/portraits/player/poses/base/player-idle-v80.png",
    "assets/portraits/story/tutorial-skeleton-painted.png",
    "assets/items/icons/weapons/rusted-sword-v16.png"
  ])assert.ok(shell.has(required),`APP_SHELL is missing required runtime file ${required}`);
  assert.match(serviceWorker,/await cache\.addAll\(APP_SHELL\)/,"required precache entries must fail the install atomically");
  assert.doesNotMatch(serviceWorker,/App shell cache skipped/);
}

async function testRecoveryAndVersions(root = appRoot){
  const [index,recovery,serviceWorker,pwa,versionText] = await Promise.all([
    read("index.html",root),read("recovery.html",root),read("service-worker.js",root),read("src/pwa.js",root),read("version.json",root)
  ]);
  for(const [name,source] of Object.entries({index,recovery})){
    assert.match(source,/const appScope = new URL\("\.\/", location\.href\)\.href;/,`${name} does not derive the exact app scope`);
    assert.match(source,/\.filter\(registration => registration\.scope === appScope\)/,`${name} does not preserve other service workers`);
    assert.doesNotMatch(source,/Promise\.all\(registrations\.map\(/,`${name} still unregisters every origin worker`);
  }
  const version = JSON.parse(versionText);
  assert.match(serviceWorker,new RegExp(`APP_VERSION = "${version.version.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"`));
  assert.match(pwa,new RegExp(`BUILD_VERSION = "${version.version.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"`));
  const cacheNumber = version.cache.replace(/^v/,"");
  assert.match(index,new RegExp(`styles\\.css\\?v=${cacheNumber}`));
  assert.match(index,new RegExp(`src/main\\.js\\?v=${cacheNumber}`));
  assert.match(serviceWorker,new RegExp(`styles\\.css\\?v=${cacheNumber}`));
  assert.match(serviceWorker,new RegExp(`src/main\\.js\\?v=${cacheNumber}`));
}

async function testHackathonProfile(){
  const [
    sourceIndex,sourceMain,sourceServiceWorker,sourceTerms,sourceWebMcp,
    artifactIndex,artifactMain,artifactServiceWorker,artifactTerms,artifactWebMcp,
    artifactVersionText,manifestText
  ] = await Promise.all([
    read("index.html"),read("src/main.js"),read("service-worker.js"),read("terms.html"),read("src/webmcp.js"),
    read("index.html",publicRoot),read("src/main.js",publicRoot),read("service-worker.js",publicRoot),read("terms.html",publicRoot),read("src/webmcp.js",publicRoot),
    read("version.json",publicRoot),readFile(manifestPath,"utf8")
  ]);

  assert.equal((await lstat(path.join(appRoot,"src","supporterStore.js"))).isFile(),true,"normal development must retain the Court Ledger module");
  assert.match(sourceIndex,/data-action="court-ledger"/,"normal development must retain the Court Ledger HUD action");
  assert.match(sourceIndex,/id="support"/,"normal development must retain the Court Ledger screen");
  assert.match(sourceMain,/import \* as supporterStore from "\.\/supporterStore\.js";/,"normal development must retain the Court Ledger module route");
  assert.match(sourceServiceWorker,/\.\/src\/supporterStore\.js/,"normal development must retain the Court Ledger offline module");

  const artifactFiles = await listFiles(publicRoot);
  assert.equal(artifactFiles.includes("src/supporterStore.js"),false,"hackathon artifact must omit the Court Ledger module");
  assert.doesNotMatch(artifactIndex,/data-action="court-ledger"|id="support"/i);
  assert.match(artifactIndex,/<meta name="application-name" content="Beneath the Throne" \/>/);
  assert.match(artifactIndex,/<meta name="btt-build-profile" content="hackathon" \/>/);
  assert.doesNotMatch(artifactIndex,/\$1/,"artifact HTML contains an unexpanded replacement token");
  assert.doesNotMatch(artifactMain,/supporterStore|court-ledger|toggleStoreReadiness/i);
  assert.doesNotMatch(artifactServiceWorker,/supporterStore/i);
  assert.equal(artifactWebMcp,sourceWebMcp,"the hackathon profile must not rewrite any WebMCP tool");
  for(const relative of [
    "service-worker.js","src/main.js","src/ui.js","src/levelUp.js","src/slumPrologue.js","src/language.js","src/pwa.js"
  ]){
    execFileSync(process.execPath,["--check","--input-type=module"],{
      input:await read(relative,publicRoot),
      stdio:["pipe","pipe","pipe"]
    });
  }

  const artifactVersion = JSON.parse(artifactVersionText);
  const manifest = JSON.parse(manifestText);
  assert.equal(artifactVersion.build_profile,"hackathon");
  assert.deepEqual(artifactVersion.features,{court_ledger:false,payments:false,mock_purchases:false});
  assert.equal(manifest.build_profile,"hackathon");
  assert.deepEqual(manifest.excluded_features,["court_ledger","payments","mock_purchases"]);
  assert.equal(manifest.files.some(file=>file.path === "src/supporterStore.js"),false);

  const licensePattern = /    <h2>License<\/h2>\r?\n    <p>[^\r\n]+<\/p>/;
  assert.equal(artifactTerms.match(licensePattern)?.[0],sourceTerms.match(licensePattern)?.[0],"artifact preparation must not alter licensing text");

  for(const relative of artifactFiles){
    const extension = path.extname(relative).toLowerCase();
    if(!artifactTextExtensions.has(extension))continue;
    const contents = await read(relative,publicRoot);
    for(const [pattern,label] of forbiddenHackathonPatterns){
      assert.doesNotMatch(contents,pattern,`${label} leaked into ${relative}`);
    }
  }
}

async function testArtifact(){
  const topEntries = await readdir(publicRoot,{withFileTypes:true});
  for(const entry of topEntries){
    if(entry.isDirectory())assert.ok(topLevelDirectories.has(entry.name),`unexpected public directory: ${entry.name}`);
    else assert.ok(topLevelFiles.has(entry.name),`unexpected public file: ${entry.name}`);
  }
  for(const required of topLevelFiles)assert.ok(topEntries.some(entry=>entry.name === required && entry.isFile()),`missing public runtime file: ${required}`);
  for(const required of topLevelDirectories)assert.ok(topEntries.some(entry=>entry.name === required && entry.isDirectory()),`missing public runtime directory: ${required}`);

  const files = await listFiles(publicRoot);
  const folded = new Set();
  for(const relative of files){
    const lower = relative.toLowerCase();
    assert.equal(folded.has(lower),false,`case-colliding public path: ${relative}`);
    folded.add(lower);
    const extension = path.extname(relative).toLowerCase();
    const allowed = topLevelFiles.has(relative)
      || (relative.startsWith("src/") && extension === ".js")
      || (relative.startsWith("assets/") && [".png",".svg",".webp",".jpg",".jpeg"].includes(extension))
      || (relative.startsWith("icons/") && extension === ".png");
    assert.equal(allowed,true,`file is outside the deployment allowlist: ${relative}`);
    assert.doesNotMatch(relative,/(^|\/)(scripts|agent-tools|node_modules)(\/|$)|(^|\/)\.env|readme|package(?:-lock)?\.json/i);
    if(artifactTextExtensions.has(extension)){
      const contents = await readFile(path.join(publicRoot,...relative.split("/")),"utf8");
      assert.doesNotMatch(contents,/file:\/\/|[A-Za-z]:\\Users\\|\/Users\/[^/]+\/|\/home\/[^/]+\//i,`local filesystem path leaked in ${relative}`);
    }
  }

  const manifest = JSON.parse(await readFile(manifestPath,"utf8"));
  const version = JSON.parse(await read("version.json",publicRoot));
  assert.equal(manifest.artifact_version,version.version);
  assert.equal(manifest.build_profile,"hackathon");
  assert.equal(manifest.file_count,files.length);
  assert.deepEqual(manifest.files.map(file=>file.path),[...files].sort((a,b)=>a.localeCompare(b,"en")));
  let totalBytes = 0;
  for(const entry of manifest.files){
    const contents = await readFile(path.join(publicRoot,...entry.path.split("/")));
    totalBytes += contents.length;
    assert.equal(entry.bytes,contents.length,`manifest byte count mismatch: ${entry.path}`);
    assert.equal(entry.sha256,createHash("sha256").update(contents).digest("hex"),`manifest hash mismatch: ${entry.path}`);
  }
  assert.equal(manifest.total_bytes,totalBytes);
}

await testDebugGate();
console.log("PASS loopback-only debug and debug-overlay gates");
await testModulePrecache();
console.log("PASS complete development module graph and required offline shell precache");
await testModulePrecache(publicRoot);
console.log("PASS complete hackathon artifact module graph and required offline shell precache");
await testRecoveryAndVersions();
await testRecoveryAndVersions(publicRoot);
console.log("PASS app-scoped recovery and synchronized development/artifact build-cache versions");
await testHackathonProfile();
console.log("PASS artifact-only Court Ledger, payment, and mock-purchase exclusion with unchanged WebMCP and licensing text");
await testArtifact();
console.log("PASS allowlisted deployment artifact and deterministic integrity manifest");
