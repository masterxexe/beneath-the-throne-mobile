const APP_VERSION = "2026.08.26-webmcp-57";
const CORE_CACHE = `beneath-throne-core-${APP_VERSION}`;
const RUNTIME_CACHE = `beneath-throne-runtime-${APP_VERSION}`;
const CACHE_PREFIX = "beneath-throne-";
const OFFLINE_SHELL = new URL("./index.html", self.location.href).href;

const APP_SHELL = [
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./recovery.html",
  "./styles.css?v=132",
  "./redesign.css?v=20",
  "./combat-animations.css?v=123",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./src/main.js?v=132",
  "./src/abilities.js",
  "./src/audioEngine.js",
  "./src/audioHooks.js",
  "./src/battleSceneArt.js",
  "./src/characterRenderController.js",
  "./src/combat.js",
  "./src/combatAnimations.js",
  "./src/combatSceneDirector.js",
  "./src/encounterTables.js",
  "./src/encounterTransition.js",
  "./src/enemyVisuals.js",
  "./src/environment.js",
  "./src/gear.js",
  "./src/gearVisuals.js",
  "./src/interiorScenes.js",
  "./src/language.js",
  "./src/levelUp.js",
  "./src/locationArt.js",
  "./src/locationEvents.js",
  "./src/lowerWard.js",
  "./src/mapActivity.js",
  "./src/npcRegistry.js",
  "./src/overworld.js",
  "./src/party.js",
  "./src/portraitRenderer.js",
  "./src/progression.js",
  "./src/pwa.js",
  "./src/roadNodes.js",
  "./src/routePaths.js",
  "./src/sceneInteractions.js",
  "./src/slumPrologue.js",
  "./src/state.js",
  "./src/storyteller.js",
  "./src/supporterStore.js",
  "./src/town.js",
  "./src/travelGraph.js",
  "./src/traversalController.js",
  "./src/tutorials-v19d.js",
  "./src/tutorials.js",
  "./src/ui.js",
  "./src/visuals.js",
  "./src/webmcp.js",
  "./src/world.js",
  "./src/worldScenes.js",
  "./src/worldStateArt.js",
  "./assets/ui/generated/title-bg-v19d.png",
  "./assets/tutorial/generated/v80/title-bg-mobile-v80.webp",
  "./assets/portraits/player/poses/base/player-idle-v80.png",
  "./assets/portraits/story/tutorial-skeleton-painted.png",
  "./assets/items/icons/weapons/rusted-sword-v16.png",
  "./version.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    precacheAppShell()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CORE_CACHE && key !== RUNTIME_CACHE)
        .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
  if(event.data?.type === "CLEAR_APP_CACHES"){
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys
          .filter(key => key.startsWith(CACHE_PREFIX))
          .map(key => caches.delete(key))
        ))
    );
  }
});

self.addEventListener("fetch", event => {
  const {request} = event;
  if(request.method !== "GET")return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin)return;

  event.respondWith(shouldUseCacheFirst(request) ? cacheFirst(request) : networkFirst(request));
});

function shouldUseCacheFirst(request){
  const url = new URL(request.url);
  if(url.pathname.endsWith("/version.json"))return false;
  if(url.pathname.endsWith("/index.html"))return false;
  if(url.pathname.endsWith("/service-worker.js"))return false;
  if(url.pathname.includes("/src/"))return false;
  if(url.pathname.match(/\.(png|jpg|jpeg|webp|svg|css|json|webmanifest)$/i))return true;
  return ["image","style","font"].includes(request.destination);
}

async function cacheFirst(request){
  const cached = await caches.match(request);
  if(cached)return cached;
  const cache = await caches.open(RUNTIME_CACHE);
  const fresh = await fetch(request);
  if(fresh && fresh.ok)cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirst(request){
  const cache = await caches.open(RUNTIME_CACHE);
  try{
    const fresh = await fetch(request, {cache:"no-store"});
    if(fresh && fresh.ok)cache.put(request, fresh.clone());
    return fresh;
  }catch(error){
    const cached = await caches.match(request);
    if(cached)return cached;
    if(request.mode === "navigate"){
      const shell = await caches.match(OFFLINE_SHELL);
      if(shell)return shell;
      return offlineBootResponse();
    }
    throw error;
  }
}

async function precacheAppShell(){
  const cache = await caches.open(CORE_CACHE);
  await cache.addAll(APP_SHELL);
}

function offlineBootResponse(){
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Beneath the Throne</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020303;color:#f1dec0;font-family:Georgia,"Times New Roman",serif;text-align:center}
    div{width:min(420px,calc(100% - 32px));padding:18px;border:1px solid rgba(208,153,73,.42);border-radius:8px;background:rgba(4,5,5,.86)}
    h1{margin:0 0 8px;font-size:34px;line-height:.95}
    p{margin:0;color:#dbc4a0;font:700 13px/1.35 system-ui,sans-serif}
  </style>
</head>
<body>
  <div>
    <h1>Beneath the Throne</h1>
    <p>The phone playtest is offline or updating. Reopen the app with a connection, then use Clear App Cache if needed.</p>
  </div>
</body>
</html>`, {headers:{"Content-Type":"text/html; charset=utf-8"}});
}
