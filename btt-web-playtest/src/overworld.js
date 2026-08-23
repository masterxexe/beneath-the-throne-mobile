import { getLanguage, tx } from "./language.js";
import { renderMapActivityHTML, mapMoodForContext } from "./mapActivity.js";
import { renderPlayerPaperDoll } from "./portraitRenderer.js";
import { resolveCharacterRenderState } from "./characterRenderController.js";
import { routeAngle, routePathD, routePoint, routePoints } from "./routePaths.js";
import { ROAD_NODES, getMapNodes } from "./roadNodes.js";
import { locationArtClass, resolveLocationArt } from "./locationArt.js";
import { availableWorldSceneActions, resolveWorldScene } from "./worldScenes.js";
import { createMapTraversalPresence, traversalActorClass, traversalAttributes, traversalPoseCycle, traversalStageClass, traversalStyleVars } from "./traversalController.js";
import { npcsForWorldScene } from "./npcRegistry.js";

const ROUTE_DEBUG = false;
const WORLD_PLAYER_IDLE_ASSET = "assets/portraits/player/poses/base/player-idle-v80.png";

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function text(value){
  if(!value)return "";
  if(typeof value === "string")return value;
  const lang = getLanguage();
  return value[lang] || value.en || "";
}

const ARMOR_TRAVERSAL_PROFILES = Object.freeze({
  base:{cycleScale:1,swayScale:1,bobScale:.86,weightScale:1,compressionScale:1,cloakScale:1,dustScale:1,shadowScale:1,shadowOpacity:.34,gearSwayOpacity:.18},
  light:{cycleScale:.94,swayScale:1.08,bobScale:.82,weightScale:.9,compressionScale:.84,cloakScale:.9,dustScale:.92,shadowScale:.96,shadowOpacity:.3,gearSwayOpacity:.16},
  medium:{cycleScale:1.04,swayScale:.9,bobScale:.72,weightScale:1.08,compressionScale:1.12,cloakScale:1.08,dustScale:1.06,shadowScale:1.05,shadowOpacity:.37,gearSwayOpacity:.19},
  heavy:{cycleScale:1.14,swayScale:.72,bobScale:.58,weightScale:1.22,compressionScale:1.26,cloakScale:1.28,dustScale:1.14,shadowScale:1.12,shadowOpacity:.42,gearSwayOpacity:.2},
  robes:{cycleScale:1.08,swayScale:.82,bobScale:.68,weightScale:.96,compressionScale:.95,cloakScale:1.45,dustScale:.96,shadowScale:1.02,shadowOpacity:.33,gearSwayOpacity:.22}
});

const CARRY_TRAVERSAL_PROFILES = Object.freeze({
  unarmed:{cycleScale:1,swayBonus:0,weightBonus:0,weaponDriftPx:0,gearSwayBonus:0},
  "one-handed":{cycleScale:1,swayBonus:.02,weightBonus:.03,weaponDriftPx:.08,gearSwayBonus:.01},
  "sword-shield":{cycleScale:1.04,swayBonus:-.04,weightBonus:.14,weaponDriftPx:.16,gearSwayBonus:.06},
  shield:{cycleScale:1.04,swayBonus:-.04,weightBonus:.12,weaponDriftPx:.14,gearSwayBonus:.05},
  "two-handed":{cycleScale:1.07,swayBonus:-.08,weightBonus:.16,weaponDriftPx:.18,gearSwayBonus:.04},
  bow:{cycleScale:.98,swayBonus:.04,weightBonus:.06,weaponDriftPx:.12,gearSwayBonus:.03},
  staff:{cycleScale:1.03,swayBonus:-.02,weightBonus:.05,weaponDriftPx:.1,gearSwayBonus:.04}
});

function profileNumber(value,fallback){
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function boundedProfile(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function traversalArmorProfileKey(render){
  const visualClass = String(render?.armorVisualClass || "").toLowerCase();
  if(render?.armorState === "knight" || /chainmail|plate|knight|heavy/.test(visualClass))return "heavy";
  if(/mage|robe|caster/.test(visualClass))return "robes";
  if(/hunter|scout|leather/.test(visualClass))return "light";
  if(render?.armorState === "road" || render?.armorState === "rusted")return "medium";
  return "base";
}

function traversalCarryProfileKey(render){
  const weapon = render?.weaponCategory || "";
  const offhand = render?.flags?.offHandType || "";
  if(offhand === "shield")return weapon ? "sword-shield" : "shield";
  if(weapon === "bow")return "bow";
  if(weapon === "staff")return "staff";
  if(["spear","axe","mace"].includes(weapon))return "two-handed";
  if(["sword","dagger"].includes(weapon))return "one-handed";
  return "unarmed";
}

function traversalActorProfile(hero){
  const render = resolveCharacterRenderState(hero);
  const armorProfile = traversalArmorProfileKey(render);
  const carryProfile = traversalCarryProfileKey(render);
  const armor = ARMOR_TRAVERSAL_PROFILES[armorProfile] || ARMOR_TRAVERSAL_PROFILES.base;
  const carry = CARRY_TRAVERSAL_PROFILES[carryProfile] || CARRY_TRAVERSAL_PROFILES.unarmed;
  return {
    armorProfile,
    carryProfile,
    armorState:render.armorState || "base",
    armorVisualClass:render.armorVisualClass || "base_survivor",
    weaponCategory:render.weaponCategory || "unarmed",
    offHandType:render.flags?.offHandType || "none",
    cycleScale:boundedProfile(profileNumber(armor.cycleScale,1) * profileNumber(carry.cycleScale,1),.82,1.28),
    swayScale:boundedProfile(profileNumber(armor.swayScale,1) + profileNumber(carry.swayBonus,0),.55,1.22),
    bobScale:boundedProfile(profileNumber(armor.bobScale,.86),.46,1),
    weightScale:boundedProfile(profileNumber(armor.weightScale,1) + profileNumber(carry.weightBonus,0),.74,1.46),
    compressionScale:boundedProfile(profileNumber(armor.compressionScale,1),.78,1.36),
    cloakScale:boundedProfile(profileNumber(armor.cloakScale,1),.82,1.55),
    dustScale:boundedProfile(profileNumber(armor.dustScale,1),.82,1.2),
    shadowScale:boundedProfile(profileNumber(armor.shadowScale,1),.9,1.18),
    shadowOpacity:boundedProfile(profileNumber(armor.shadowOpacity,.34),.26,.46),
    gearSwayOpacity:boundedProfile(profileNumber(armor.gearSwayOpacity,.18) + profileNumber(carry.gearSwayBonus,0),.12,.3),
    weaponDriftPx:boundedProfile(profileNumber(carry.weaponDriftPx,0),0,.22)
  };
}

function traversalActorProfileAttrs(profile){
  if(!profile)return "";
  return [
    `data-traversal-armor-profile="${esc(profile.armorProfile)}"`,
    `data-traversal-carry-profile="${esc(profile.carryProfile)}"`,
    `data-traversal-armor-state="${esc(profile.armorState)}"`,
    `data-traversal-weapon-category="${esc(profile.weaponCategory)}"`,
    `data-traversal-offhand-category="${esc(profile.offHandType)}"`
  ].join(" ");
}

function routeKey(a,b){
  return [a,b].sort().join("__");
}

function highlightedRouteKeys(current, traveling){
  const keys = new Set();
  if(traveling?.routeNodeIds?.length){
    const ids = traveling.routeNodeIds;
    for(let i = 0; i < ids.length - 1; i++){
      keys.add(routeKey(ids[i], ids[i + 1]));
    }
    return keys;
  }
  if(!current?.routes?.length)return keys;
  current.routes.forEach(id=>keys.add(routeKey(current.id, id)));
  return keys;
}

function dangerTier(danger = 0){
  if(danger >= 4)return "extreme";
  if(danger >= 3)return "high";
  if(danger >= 2)return "mid";
  if(danger >= 1)return "low";
  return "safe";
}

export function renderOverworldHTML({locations,currentId,previousId,traveling}){
  const locationList = Object.values(locations);
  const allNodes = getMapNodes(locations);
  const current = locations[currentId] || locationList[0];
  const routeSet = new Set();
  locationList.forEach(loc=>loc.routes.forEach(route=>routeSet.add(routeKey(loc.id,route))));
  const activeRoutes = highlightedRouteKeys(current, traveling);
  const roads = [...routeSet].map(key=>{
    const [a,b] = key.split("__").map(id=>locations[id]);
    return a && b ? roadHTML(a,b,locations,{active:activeRoutes.has(key)}) : "";
  }).join("");
  const to = traveling ? locations[traveling.destinationLocationId] : null;
  const travelTarget = traveling?.direction < 0
    ? allNodes[traveling.nextRoadNodeId] || allNodes[traveling.originLocationId]
    : to;
  const markerPoint = traveling
    ? travelMarkerPoint(traveling, allNodes)
    : {x: current.x, y: current.y};
  const markerAngle = traveling ? travelMarkerAngle(traveling, allNodes) : 0;
  const markerPresence = createMapTraversalPresence({
    status:traveling?.status || "idle",
    rawProgress:traveling?.rawLegProgress ?? traveling?.legProgress ?? 0,
    angle:markerAngle,
    direction:traveling?.direction || 1
  });
  const markerStyle = `--marker-x:${markerPoint.x}%;--marker-y:${markerPoint.y}%;--marker-angle:${markerAngle}deg;${markerPresence.style}`;
  const mapMood = mapMoodForContext(current, traveling);
  const travelProgress = traveling ? Math.floor((traveling.progress || 0) * 100) : 0;
  return `
    <div class="overworld-shell ${traveling ? "is-traveling" : ""} map-mood-${mapMood}">
      <div class="map-canvas-frame">
        <div class="overworld-map ${ROUTE_DEBUG ? "route-debug-on" : ""}" role="img" aria-label="${tx("overworldMap")}">
          <span class="map-parchment-wash" aria-hidden="true"></span>
          <span class="map-light-sweep" aria-hidden="true"></span>
          <svg class="overworld-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${roads}
          </svg>
          ${renderMapActivityHTML({locations, currentId, traveling})}
          ${Object.values(ROAD_NODES).map(node=>roadStopHTML(node,traveling)).join("")}
          ${locationList.map(loc=>nodeHTML(loc,current,traveling)).join("")}
          <div class="overworld-marker ${traveling ? "marker-traveling" : ""} ${markerPresence.className}" style="${markerStyle}" ${markerPresence.attrs} aria-label="${tx("playerMarker")}">
            <span class="marker-pulse" aria-hidden="true"></span>
            <span class="marker-shadow" aria-hidden="true"></span>
            <span class="marker-dust" aria-hidden="true"></span>
            <span class="marker-crest" aria-hidden="true"></span>
            <span class="marker-body" aria-hidden="true"></span>
            <span class="marker-cloak" aria-hidden="true"></span>
            <span class="marker-hood" aria-hidden="true"></span>
            <span class="marker-step marker-step-a" aria-hidden="true"></span>
            <span class="marker-step marker-step-b" aria-hidden="true"></span>
          </div>
          ${traveling ? `
            <div class="travel-banner travel-banner-premium travel-banner-active">
              <div class="travel-banner-copy">
                <span class="travel-banner-kicker">${traveling.direction < 0 ? tx("returnTo") : tx("travelingTo")}</span>
                <strong>${esc(text(travelTarget?.name))}</strong>
                ${traveling.currentStopName ? `<small data-travel-stop-label>${tx("travelRoadStop")}: ${esc(traveling.currentStopName)}</small>` : ""}
              </div>
              <div class="travel-banner-meta">
                <span class="pill" data-travel-progress>${travelProgress}%</span>
                <button class="secondary" onclick="FE.cancelTravel()">${tx("cancelTravel")}</button>
              </div>
              <div class="travel-progress-track" aria-hidden="true"><span style="width:${travelProgress}%"></span></div>
            </div>
          ` : previousId && locations[previousId] ? `
            <div class="travel-banner travel-banner-premium travel-banner-return">
              <button class="secondary" onclick="FE.returnToPreviousLocation()">${tx("returnTo")} ${esc(text(locations[previousId].name))}</button>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

function travelMarkerPoint(traveling,allNodes){
  if(traveling.status === "encounter" && traveling.encounterPoint)return traveling.encounterPoint;
  if(traveling.status !== "moving")return allNodes[traveling.currentRoadNodeId] || allNodes[traveling.originLocationId] || {x:50,y:50};
  const from = traveling.currentRoadNodeId || traveling.routeNodeIds?.[traveling.currentIndex];
  const to = traveling.nextRoadNodeId || traveling.routeNodeIds?.[traveling.currentIndex + (traveling.direction || 1)];
  if(!from || !to)return allNodes[traveling.destinationLocationId] || allNodes[traveling.originLocationId] || {x:50,y:50};
  return routePoint(from, to, traveling.legProgress || 0, allNodes);
}

function travelMarkerAngle(traveling,allNodes){
  const from = traveling.currentRoadNodeId || traveling.routeNodeIds?.[traveling.currentIndex];
  const to = traveling.nextRoadNodeId || traveling.routeNodeIds?.[traveling.currentIndex + (traveling.direction || 1)];
  if(!from || !to)return 0;
  return routeAngle(from, to, traveling.legProgress || 0, allNodes);
}

function roadHTML(a,b,locations,{active = false} = {}){
  const d = routePathD(a,b,locations);
  const route = routePoints(a,b,locations);
  const activeClass = active ? " route-active" : "";
  const points = ROUTE_DEBUG ? route.map((point,index)=>`
    <circle class="route-debug-point" cx="${point.x}" cy="${point.y}" r="${index === 0 || index === route.length - 1 ? .45 : .32}" />
  `).join("") : "";
  return `
    <g class="overworld-route${activeClass}">
      <path class="overworld-route-glow" d="${d}" />
      <path class="overworld-route-shadow" d="${d}" />
      <path class="overworld-route-highlight" d="${d}" />
      <path class="overworld-route-stones" d="${d}" />
    </g>
    ${points}
  `;
}

function roadStopHTML(node,traveling){
  const active = traveling?.currentRoadNodeId === node.id || traveling?.nextRoadNodeId === node.id;
  return `
    <span class="travel-stop travel-stop-premium travel-stop-${esc(node.id)} ${active ? "active-travel-stop" : ""}"
      data-stop-id="${esc(node.id)}"
      style="--stop-x:${node.x}%;--stop-y:${node.y}%"
      title="${esc(text(node.name))}"
      aria-label="${esc(text(node.name))}">
      <span class="travel-stop-ring" aria-hidden="true"></span>
      <span class="travel-stop-core" aria-hidden="true"></span>
    </span>
  `;
}

function nodeHTML(loc,current,traveling){
  const isCurrent = loc.id === current.id;
  const connected = current.routes.includes(loc.id);
  const enabled = !traveling && !isCurrent && connected;
  const tier = dangerTier(loc.danger);
  return `
    <button class="overworld-node overworld-node-premium overworld-node-${esc(loc.id)} world-node-scene-${esc(loc.scene || "area")} danger-tier-${tier} ${isCurrent ? "current-node" : ""} ${connected ? "connected-node" : ""}"
      style="--node-x:${loc.x}%;--node-y:${loc.y}%"
      ${enabled ? `onclick="FE.travelToLocation('${loc.id}')"` : "disabled"}
      aria-label="${esc(text(loc.name))}">
      <span class="node-halo" aria-hidden="true"></span>
      <span class="node-sigil">
        <span class="node-sigil-ring" aria-hidden="true"></span>
        <span class="node-sigil-core" aria-hidden="true"></span>
      </span>
      <span class="node-label">${esc(text(loc.name))}</span>
    </button>
  `;
}

export function renderLocationStageHTML({location,services,worldState,hero,traversal,story=[]}){
  const worldScene = resolveWorldScene(location);
  if(worldScene){
    return renderCinematicLocationStageHTML({location,services,worldState,hero,traversal,worldScene,story});
  }
  const art = resolveLocationArt(location, worldState);
  const stateClass = locationArtClass(worldState);
  return `
    <div class="location-stage has-location-art world-scene-${location.scene} ${esc(stateClass)}" style="--world-x:${location.sceneX};--world-y:${location.sceneY};--world-art:url('${esc(art)}')">
      <span class="world-scene-depth"></span>
      <span class="world-scene-weather"></span>
      <span class="world-scene-fog"></span>
      <span class="world-scene-vignette"></span>
      <div class="location-stage-copy">
        <div class="location-badge">${tx("enterLocation")}: ${esc(text(location.name))}</div>
        <h2>${esc(text(location.name))}</h2>
        <p>${esc(text(location.desc))}</p>
      </div>
      <div class="location-actions">
        <button onclick="FE.openTownCenter()">${tx("townCenter")}</button>
        <button class="primary" onclick="FE.huntNearby()">${tx("huntNearby")}</button>
        <button onclick="FE.scoutNearby()">${tx("scoutNearby")}</button>
      </div>
      ${services.length ? services.map(service=>buildingHTML(location,service)).join("") : `<div class="no-buildings">${tx("noServicesHere")}</div>`}
    </div>
  `;
}

function renderCinematicLocationStageHTML({location,services,worldState,hero,traversal,worldScene,story=[]}){
  const stateClass = locationArtClass(worldState);
  const art = worldState ? resolveLocationArt(location, worldState) : (worldScene.art || resolveLocationArt(location, worldState));
  const actions = availableWorldSceneActions(worldScene, services);
  const npcs = npcsForWorldScene(worldScene, actions, services);
  const activeTraversal = traversal?.locationId === location.id ? traversal : null;
  const actorProfile = traversalActorProfile(hero);
  const traversalStage = activeTraversal ? traversalStageClass(activeTraversal) : "";
  const playerClass = activeTraversal
    ? traversalActorClass(activeTraversal)
    : "traversal-presence traversal-phase-idle traversal-facing-forward";
  const playerAttrs = activeTraversal
    ? traversalAttributes(activeTraversal)
    : `data-traversal-kind="world-scene" data-traversal-phase="idle" data-traversal-facing="forward" data-traversal-pose="idle" data-traversal-step-pose="" data-traversal-rhythm="still" data-traversal-phase-count="1" data-traversal-cycle-poses="idle" data-traversal-motion-profile="still" data-traversal-movement-profile="scene" data-traversal-mirror="none"`;
  const traversalAction = activeTraversal
    ? actions.find(action => action.id === activeTraversal.actionId || action.service === activeTraversal.service)
    : null;
  const traversalLabel = traversalAction ? text(traversalAction.label) : "";
  const playerCycle = activeTraversal
    ? traversalPoseCycle(activeTraversal)
    : {primary:"idle",secondary:"",rhythm:"still",phases:[{slot:"idle",pose:"idle",role:"rest"}],phaseCount:1,phasePoses:["idle"],motionProfile:"still"};
  const playerLayersHTML = hero ? playerCycle.phases.map((phase,index)=>{
    const layerClass = [
      "traversal-pose-layer",
      index === 0 ? "traversal-pose-primary" : "",
      index === 1 ? "traversal-pose-secondary" : "",
      `traversal-pose-phase-${esc(phase.slot)}`,
      `traversal-pose-role-${esc(phase.role)}`
    ].filter(Boolean).join(" ");
    const layerHTML = renderPlayerPaperDoll(hero, {
      compact:true,
      renderMode:"layered",
      visualState:phase.pose,
      motionState:activeTraversal ? "travel" : "idle",
      label:`${hero.name || "Hero"} ${phase.slot} travel phase in ${text(location.name)}`
    });
    return `<div class="${layerClass}" data-traversal-layer-slot="${esc(phase.slot)}" data-traversal-layer-role="${esc(phase.role)}" ${index > 0 ? `aria-hidden="true"` : ""}>${layerHTML}</div>`;
  }).join("") : "";
  const idleWorldPlayerHTML = !activeTraversal && hero
    ? `<span class="world-player-clean-figure" style="--world-player-idle-art:url('${WORLD_PLAYER_IDLE_ASSET}')" aria-hidden="true"></span>`
    : "";
  const latestStory = [...(story || [])].reverse().find(Boolean) || text(location.lore) || text(location.desc);
  return `
    <div class="location-stage cinematic-world-stage has-location-art ${esc(worldScene.sceneClass)} ${esc(stateClass)} ${activeTraversal ? "is-guided-traversal" : ""} ${esc(traversalStage)}"
      style="--world-art:url('${esc(art)}');${worldScenePlayerStyle(worldScene, activeTraversal, actorProfile)}">
      <span class="world-scene-depth"></span>
      <span class="world-scene-ash"></span>
      <span class="world-scene-smoke"></span>
      <span class="world-scene-weather"></span>
      <span class="world-scene-fog"></span>
      <span class="world-scene-vignette"></span>
      <span class="world-road-glow"></span>
      <span class="world-road-guidance"></span>
      <span class="world-parallax-drift"></span>
      <span class="world-traversal-foreground"></span>
      <span class="world-traversal-embers"></span>
      <span class="world-traversal-focus"></span>
      <span class="world-traversal-dust"></span>
      <span class="world-entry-threshold"></span>
      ${worldScene.effects.map(worldSceneEffectHTML).join("")}
      <div class="cinematic-location-title">
        <div class="location-badge">${tx("enterLocation")}: ${esc(text(location.name))}</div>
        <h2>${esc(text(location.name))}</h2>
        <p>${esc(text(location.desc))}</p>
      </div>
      <div class="world-narration-card">
        <span>${esc(tx("story"))}</span>
        <p>${esc(latestStory)}</p>
      </div>
      <div class="world-player-presence ${!activeTraversal ? "world-player-clean-presence" : ""} ${esc(playerClass)}" ${playerAttrs} ${traversalActorProfileAttrs(actorProfile)} aria-label="${esc(tx("playerMarker"))}">
        ${idleWorldPlayerHTML || playerLayersHTML}
        <span class="traversal-gear-sway traversal-gear-sway-left" aria-hidden="true"></span>
        <span class="traversal-gear-sway traversal-gear-sway-right" aria-hidden="true"></span>
        <span class="traversal-contact-shadow" aria-hidden="true"></span>
        <span class="traversal-footstep-puff" aria-hidden="true"></span>
      </div>
      <div class="world-npc-layer">
        ${npcs.map(worldSceneNPCHTML).join("")}
      </div>
      <div class="world-hotspot-layer">
        ${actions.map(action=>worldSceneActionHTML(action, activeTraversal)).join("")}
      </div>
      <div class="world-command-rail">
        <button onclick="FE.show('map')">${tx("openMap")}</button>
        <button class="primary" onclick="FE.huntNearby()">${tx("huntNearby")}</button>
        <button onclick="FE.scoutNearby()">${tx("scoutNearby")}</button>
      </div>
      ${activeTraversal ? `<div class="world-traversal-caption">${esc(tx("travelingTo"))} ${esc(traversalLabel)}</div>` : ""}
    </div>
  `;
}

export function renderRoadStopSceneStageHTML({place,hero,traversal,worldScene,art,stateClass = "",actions = []}){
  const activeTraversal = traversal?.locationId === place.id ? traversal : null;
  const actorProfile = traversalActorProfile(hero);
  const traversalStage = activeTraversal ? traversalStageClass(activeTraversal) : "";
  const playerClass = activeTraversal
    ? traversalActorClass(activeTraversal)
    : "traversal-presence traversal-phase-idle traversal-facing-forward";
  const playerAttrs = activeTraversal
    ? traversalAttributes(activeTraversal)
    : `data-traversal-kind="road-stop-scene" data-traversal-phase="idle" data-traversal-facing="forward" data-traversal-pose="idle" data-traversal-step-pose="" data-traversal-rhythm="still" data-traversal-phase-count="1" data-traversal-cycle-poses="idle" data-traversal-motion-profile="still" data-traversal-movement-profile="scene" data-traversal-mirror="none"`;
  const traversalAction = activeTraversal
    ? actions.find(action => action.id === activeTraversal.actionId || action.kind === activeTraversal.destinationKind)
    : null;
  const traversalLabel = traversalAction ? text(traversalAction.label) : "";
  const playerCycle = activeTraversal
    ? traversalPoseCycle(activeTraversal)
    : {primary:"idle",secondary:"",rhythm:"still",phases:[{slot:"idle",pose:"idle",role:"rest"}],phaseCount:1,phasePoses:["idle"],motionProfile:"still"};
  const playerLayersHTML = hero ? playerCycle.phases.map((phase,index)=>{
    const layerClass = [
      "traversal-pose-layer",
      index === 0 ? "traversal-pose-primary" : "",
      index === 1 ? "traversal-pose-secondary" : "",
      `traversal-pose-phase-${esc(phase.slot)}`,
      `traversal-pose-role-${esc(phase.role)}`
    ].filter(Boolean).join(" ");
    const layerHTML = renderPlayerPaperDoll(hero, {
      compact:true,
      renderMode:"layered",
      visualState:phase.pose,
      motionState:activeTraversal ? "travel" : "idle",
      label:`${hero.name || "Hero"} ${phase.slot} travel phase at ${place.name}`
    });
    return `<div class="${layerClass}" data-traversal-layer-slot="${esc(phase.slot)}" data-traversal-layer-role="${esc(phase.role)}" ${index > 0 ? `aria-hidden="true"` : ""}>${layerHTML}</div>`;
  }).join("") : "";
  const sceneActions = actions.length ? actions : worldScene.actions;
  return `
    <div class="road-stop-stage cinematic-world-stage road-stop-cinematic-stage has-road-stop-art has-location-art ${esc(worldScene.sceneClass)} ${esc(stateClass)} ${activeTraversal ? "is-guided-traversal" : ""} ${esc(traversalStage)}"
      style="--world-art:url('${esc(art || worldScene.art)}');--road-stop-art:url('${esc(art || worldScene.art)}');${worldScenePlayerStyle(worldScene, activeTraversal, actorProfile)}">
      <span class="world-scene-depth"></span>
      <span class="world-scene-ash"></span>
      <span class="world-scene-smoke"></span>
      <span class="world-scene-weather"></span>
      <span class="world-scene-fog"></span>
      <span class="world-scene-vignette"></span>
      <span class="world-road-glow"></span>
      <span class="world-road-guidance"></span>
      <span class="world-parallax-drift"></span>
      <span class="world-traversal-foreground"></span>
      <span class="world-traversal-embers"></span>
      <span class="world-traversal-focus"></span>
      <span class="world-traversal-dust"></span>
      <span class="world-entry-threshold"></span>
      ${worldScene.effects.map(worldSceneEffectHTML).join("")}
      <div class="cinematic-location-title">
        <div class="location-badge">${tx("currentRoadStop")}</div>
        <h2>${esc(place.name)}</h2>
        <p>${esc(place.description)}</p>
      </div>
      <div class="world-narration-card">
        <span>${esc(tx("destination"))}</span>
        <p>${esc(place.journeyDestination?.name || "")} - ${esc(tx("journeyProgress"))}: ${place.journeyProgress.current} / ${place.journeyProgress.total}</p>
      </div>
      <div class="world-player-presence ${esc(playerClass)}" ${playerAttrs} ${traversalActorProfileAttrs(actorProfile)} aria-label="${esc(tx("playerMarker"))}">
        ${playerLayersHTML}
        <span class="traversal-gear-sway traversal-gear-sway-left" aria-hidden="true"></span>
        <span class="traversal-gear-sway traversal-gear-sway-right" aria-hidden="true"></span>
        <span class="traversal-contact-shadow" aria-hidden="true"></span>
        <span class="traversal-footstep-puff" aria-hidden="true"></span>
      </div>
      <div class="world-hotspot-layer">
        ${sceneActions.map(action=>worldSceneActionHTML(action, activeTraversal, "FE.startRoadStopSceneTraversal")).join("")}
      </div>
      <div class="world-command-rail">
        <button class="primary" ${place.canContinueJourney ? `onclick="FE.continueJourney()"` : "disabled"}>${tx("continueJourney")}</button>
        <button ${place.canInspectArea ? `onclick="FE.inspectRoadStop()"` : "disabled"}>${tx("inspectArea")}</button>
        <button onclick="FE.show('map')">${tx("openMap")}</button>
        <button class="secondary" ${place.canTurnBack ? `onclick="FE.turnBackJourney()"` : "disabled"}>${tx("turnBack")}</button>
      </div>
      ${activeTraversal ? `<div class="world-traversal-caption">${esc(tx("travelingTo"))} ${esc(traversalLabel)}</div>` : ""}
    </div>
  `;
}

function worldScenePlayerStyle(worldScene, traversal, actorProfile = null){
  const base = worldScene.player || {x:50,y:75,scale:1};
  if(traversal)return traversalStyleVars(traversal, actorProfile);
  const from = traversal?.from || base;
  const to = traversal?.to || base;
  const duration = Math.max(1, Number(traversal?.duration) || 1200);
  return [
    `--player-x:${from.x}%;`,
    `--player-y:${from.y}%;`,
    `--player-scale:${from.scale ?? base.scale ?? 1};`,
    `--player-target-x:${to.x}%;`,
    `--player-target-y:${to.y}%;`,
    `--player-target-scale:${to.scale ?? from.scale ?? base.scale ?? 1};`,
    `--traversal-duration:${duration}ms;`
  ].join("");
}

function worldSceneEffectHTML(effect){
  const opacity = Number.isFinite(Number(effect.opacity)) ? `--effect-opacity:${effect.opacity};` : "";
  return `
    <span class="world-scene-effect world-scene-effect-${esc(effect.type || "torch")} world-scene-effect-${esc(effect.tone || "gold")}"
      style="--effect-x:${effect.x || 50}%;--effect-y:${effect.y || 50}%;--effect-w:${effect.width || 20}%;--effect-h:${effect.height || 20}%;${opacity}"
      data-effect-id="${esc(effect.id || effect.type || "effect")}" aria-hidden="true"></span>
  `;
}

function worldSceneNPCHTML(npc){
  return `
    <div class="world-npc world-npc-${esc(npc.service)} world-npc-tone-${esc(npc.tone || "stone")}"
      style="--npc-x:${npc.x}%;--npc-y:${npc.y}%;--npc-scale:${npc.scale || .7};--npc-z:${npc.z || 10};--npc-art:url('${esc(npc.asset)}')"
      data-service="${esc(npc.service)}" data-npc-id="${esc(npc.id)}"
      aria-label="${esc(npc.label || npc.name || "Village NPC")}" title="${esc(npc.line || npc.role || npc.name || "")}">
      <span class="world-npc-shadow" aria-hidden="true"></span>
      <span class="world-npc-figure" aria-hidden="true"></span>
      <span class="world-npc-name">${esc(npc.name || "")}</span>
    </div>
  `;
}

function worldSceneHotspotIcon(action, actionToken){
  const value = `${action?.service || ""} ${action?.kind || ""} ${action?.id || ""} ${actionToken || ""}`.toLowerCase();
  if(/blacksmith|forge/.test(value))return "blacksmith";
  if(/inn/.test(value))return "inn";
  if(/tavern/.test(value))return "tavern";
  if(/market/.test(value))return "market";
  if(/healer|doctor|herb/.test(value))return "healer";
  if(/camp|fire/.test(value))return "camp";
  if(/shrine|altar/.test(value))return "shrine";
  if(/watchtower|tower|arch/.test(value))return "watchtower";
  if(/mine|ore/.test(value))return "mine";
  if(/crossroad|sign|road ahead|back trail|continue|turnback|forestroad|roadgate|ridgeexit|map/.test(value))return "crossroads";
  if(/gate/.test(value))return "gate";
  if(/waystone|milestone|cairn|marker|root|stone|inspect|scout/.test(value))return "waystone";
  return "gate";
}

function worldSceneActionHTML(action, traversal, handler = "FE.startWorldSceneTraversal"){
  const label = text(action.label) || tx(action.service);
  const hint = text(action.hint);
  const disabled = traversal ? "disabled" : "";
  const actionToken = action.service || action.kind || action.id || "action";
  const iconToken = worldSceneHotspotIcon(action, actionToken);
  return `
    <button class="world-hotspot world-hotspot-${esc(actionToken)} world-hotspot-${esc(action.glow || "gold")}"
      style="--hotspot-x:${action.x}%;--hotspot-y:${action.y}%;--hotspot-w:${action.width}%;--hotspot-h:${action.height}%;"
      data-world-action="${esc(action.id)}" data-service="${esc(action.service || "")}"
      onclick="${handler}('${esc(action.id)}')" ${disabled}
      aria-label="${esc(label)}" title="${esc(hint || label)}">
      <span class="world-hotspot-ring" aria-hidden="true"></span>
      <span class="world-hotspot-icon world-hotspot-icon-${esc(iconToken)}" aria-hidden="true"></span>
      <span class="world-hotspot-label">${esc(label)}</span>
      ${hint ? `<span class="world-hotspot-hint">${esc(hint)}</span>` : ""}
    </button>
  `;
}

function buildingHTML(location,service){
  const spot = location.serviceSpots?.[service] || defaultSpot(service);
  const serviceClass = `location-service-${service}`;
  return `
    <button class="building-hotspot building-${service} ${serviceClass} location-upgrade-basic location-state-rebuilt"
      data-service="${esc(service)}" data-upgrade-state="basic" data-location-state="rebuilt"
      style="--building-x:${spot.x}%;--building-y:${spot.y}%"
      onclick="FE.openTownService('${service}')">
      <span class="building-icon"></span>
      <span>${tx(service)}</span>
    </button>
  `;
}

function defaultSpot(service){
  return {
    market:{x:48,y:63},
    blacksmith:{x:68,y:58},
    inn:{x:34,y:66},
    tavern:{x:56,y:49},
    mine:{x:72,y:62}
  }[service] || {x:50,y:60};
}
