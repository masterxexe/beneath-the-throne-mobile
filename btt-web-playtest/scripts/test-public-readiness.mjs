#!/usr/bin/env node
import assert from "node:assert/strict";
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

async function testModulePrecache(){
  const sourceRoot = path.join(appRoot,"src");
  const graph = new Set();
  const pending = [path.join(sourceRoot,"main.js")];
  while(pending.length){
    const absolute = pending.pop();
    const relative = path.relative(appRoot,absolute).split(path.sep).join("/");
    if(graph.has(relative))continue;
    graph.add(relative);
    const source = await read(relative);
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

  const serviceWorker = await read("service-worker.js");
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

async function testRecoveryAndVersions(){
  const [index,recovery,serviceWorker,pwa,versionText] = await Promise.all([
    read("index.html"),read("recovery.html"),read("service-worker.js"),read("src/pwa.js"),read("version.json")
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
    if([".css",".html",".js",".json",".svg",".webmanifest"].includes(extension)){
      const contents = await readFile(path.join(publicRoot,...relative.split("/")),"utf8");
      assert.doesNotMatch(contents,/file:\/\/|[A-Za-z]:\\Users\\|\/Users\/[^/]+\/|\/home\/[^/]+\//i,`local filesystem path leaked in ${relative}`);
    }
  }

  const manifest = JSON.parse(await readFile(manifestPath,"utf8"));
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
console.log("PASS complete static module graph and required offline shell precache");
await testRecoveryAndVersions();
console.log("PASS app-scoped recovery and synchronized build/cache versions");
await testArtifact();
console.log("PASS allowlisted deployment artifact and deterministic integrity manifest");
