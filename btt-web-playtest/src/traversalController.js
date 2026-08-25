const PHASES = ["idle","preparing-to-move","walking","arriving","entering-location","exiting-location"];

export const TRAVERSAL_TUNING = Object.freeze({
  baseDurationMs:1540,
  distanceDurationMs:18,
  minDurationMs:1460,
  maxDurationMs:2520,
  prepareMs:220,
  prepareMinMs:150,
  prepareMaxMs:320,
  arriveMs:380,
  arriveMinMs:260,
  arriveMaxMs:520,
  enterMs:340,
  enterMinMs:240,
  enterMaxMs:480,
  minWalkMs:760,
  kindProfiles:{
    scene:{id:"scene",durationScale:1,prepareScale:1,arriveScale:1,enterScale:1,cycleScale:1},
    town:{id:"town",durationScale:1.08,prepareScale:1.08,arriveScale:1.12,enterScale:1.08,cycleScale:1.12},
    road:{id:"road",durationScale:1,prepareScale:1,arriveScale:1,enterScale:1,cycleScale:.94}
  },
  walkPhaseSlots:["a","b","c","d"],
  stepContactProgress:[.2,.48,.74],
  stepCycleTargetMs:1380,
  stepCycleMinMs:1120,
  stepCycleMaxMs:1680,
  contactHoldPct:18,
  passingDriftPx:0.26,
  passingLiftPx:-0.05,
  contactSettlePx:0.08,
  cloakDelayRatio:.18,
  shoulderDriftPx:0.14,
  weightShiftPx:0.18,
  weightCounterShiftPx:-0.16,
  preTurnDeg:0.85,
  arrivalCompressionPx:0.14,
  entryCompressionPx:0.18,
  dustContactOpacity:.2,
  entryHoldRatio:.28,
  anticipationX:0.34,
  anticipationY:0.06,
  anticipationScale:0.996,
  midPoint:0.52,
  midLiftY:0.05,
  arrivalBackoffX:0.08,
  arrivalY:0.02,
  stepStrength:{short:0.14,medium:0.18,long:0.22},
  directionProfiles:{
    side:{id:"side",bob:1,sway:1,drift:1,dust:1},
    forward:{id:"forward",bob:.58,sway:.54,drift:.38,dust:.72},
    away:{id:"away",bob:.48,sway:.46,drift:.3,dust:.6}
  },
  leanForwardDeg:0.18,
  leanBackDeg:-0.26,
  leanPrepareDeg:-0.22,
  footstepNearPx:-0.8,
  footstepFarPx:-1.75,
  driftStartPct:0.35,
  driftEndPct:-0.65,
  dustEndPct:-1.8,
  bodyBobPx:-0.38,
  imageBobPx:-0.16,
  upperSwayDeg:0.28,
  upperCounterSwayDeg:-0.2,
  settleYPx:0.18,
  imageSettleYPx:0.07,
  markerLiftPx:-0.24
});

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function pct(value){
  return `${Math.round(Number(value || 0) * 10) / 10}%`;
}

function cssVars(vars){
  return Object.entries(vars)
    .filter(([,value])=>value !== undefined && value !== null && value !== "")
    .map(([key,value])=>`${key}:${value}`)
    .join(";");
}

function point(value,fallback = {x:50,y:75,scale:1}){
  return {
    x:Number.isFinite(Number(value?.x)) ? Number(value.x) : fallback.x,
    y:Number.isFinite(Number(value?.y)) ? Number(value.y) : fallback.y,
    scale:Number.isFinite(Number(value?.scale)) ? Number(value.scale) : fallback.scale
  };
}

function traversalKindProfile(kind = "scene"){
  const profiles = TRAVERSAL_TUNING.kindProfiles;
  if(kind === "building-entry" || kind === "town-center-entry")return profiles.town;
  if(kind === "road-travel")return profiles.road;
  return profiles.scene;
}

function durationProfile(distance = 12,override = {}){
  const tuning = TRAVERSAL_TUNING;
  const profile = override.profile || traversalKindProfile();
  const totalBase = Number(override.duration) || tuning.baseDurationMs + distance * tuning.distanceDurationMs;
  const total = Math.round(clamp(totalBase * (profile.durationScale || 1),tuning.minDurationMs,tuning.maxDurationMs));
  const prepare = Math.round(clamp((Number(override.prepareMs) || tuning.prepareMs) * (profile.prepareScale || 1),tuning.prepareMinMs,tuning.prepareMaxMs));
  const arrive = Math.round(clamp((Number(override.arriveMs) || tuning.arriveMs) * (profile.arriveScale || 1),tuning.arriveMinMs,tuning.arriveMaxMs));
  const enter = Math.round(clamp((Number(override.enterMs) || tuning.enterMs) * (profile.enterScale || 1),tuning.enterMinMs,tuning.enterMaxMs));
  const walk = Math.max(tuning.minWalkMs,total - prepare - arrive - enter);
  return {total,prepare,walk,arrive,enter};
}

export function cinematicEase(value){
  const t = clamp(Number(value) || 0,0,1);
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2,3) / 2;
}

export function traversalPhaseAt(progress){
  const t = clamp(Number(progress) || 0,0,1);
  if(t <= 0)return "preparing-to-move";
  if(t < .12)return "preparing-to-move";
  if(t < .84)return "walking";
  if(t < .97)return "arriving";
  return "idle";
}

export function facingBetween(fromValue,toValue){
  const from = point(fromValue);
  const to = point(toValue,from);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if(Math.abs(dx) >= Math.abs(dy) * .7)return dx < 0 ? "left" : "right";
  return dy < 0 ? "away" : "forward";
}

export function facingFromAngle(angle = 0){
  const normalized = ((((Number(angle) || 0) % 360) + 540) % 360) - 180;
  if(Math.abs(normalized) <= 45)return "right";
  if(Math.abs(normalized) >= 135)return "left";
  return normalized < 0 ? "away" : "forward";
}

function directionSign(facing){
  if(facing === "left")return -1;
  if(facing === "right")return 1;
  return 0;
}

function classToken(value){
  return String(value || "idle").replace(/[^a-z0-9_-]/gi,"-");
}

function normalizedPhase(phase){
  return PHASES.includes(phase) ? phase : "idle";
}

function traversalMotionProfile(facing){
  const profiles = TRAVERSAL_TUNING.directionProfiles;
  if(facing === "forward")return profiles.forward;
  if(facing === "away")return profiles.away;
  return profiles.side;
}

function walkPhasePose(primary,slot){
  if(!primary?.startsWith("walk-"))return primary || "idle";
  return `${primary}-${slot}`;
}

export function traversalPoseState(traversal){
  const phase = normalizedPhase(traversal?.phase);
  const facing = traversal?.facing || "forward";
  if(phase === "walking"){
    if(facing === "left" || facing === "right" || facing === "away")return `walk-${facing}`;
    return "walk-forward";
  }
  if(phase === "arriving")return "arriving";
  if(phase === "entering-location")return "entering-location";
  if(phase === "exiting-location")return "exiting-location";
  return "idle";
}

export function traversalPoseCycle(traversal){
  const primary = traversalPoseState(traversal);
  if(!primary.startsWith("walk-")){
    return {
      primary,
      secondary:"",
      phases:[{slot:"idle",pose:primary,role:"rest"}],
      phasePoses:[primary],
      phaseCount:1,
      rhythm:"still",
      motionProfile:"still"
    };
  }
  const facing = primary.replace("walk-","");
  const phases = TRAVERSAL_TUNING.walkPhaseSlots.map((slot,index)=>({
    slot,
    pose:walkPhasePose(primary,slot),
    role:index % 2 === 0 ? "contact" : "passing",
    contact:index === 0 ? "lead" : index === 2 ? "trail" : "passing"
  }));
  return {
    primary,
    secondary:walkPhasePose(primary,"b"),
    phases,
    phasePoses:phases.map(phase=>phase.pose),
    phaseCount:phases.length,
    rhythm:`${phases.length}-phase`,
    motionProfile:traversalMotionProfile(facing).id
  };
}

export function createSceneTraversal({id = "traversal",kind = "scene",from,to,targetLabel = "",phase = "preparing-to-move",duration,prepareMs,arriveMs,enterMs,context = {}} = {}){
  const start = point(from);
  const end = point(to,start);
  const distance = Math.hypot(end.x - start.x,end.y - start.y);
  const kindProfile = traversalKindProfile(kind);
  const timing = durationProfile(distance,{duration,prepareMs,arriveMs,enterMs,profile:kindProfile});
  const state = normalizedPhase(phase);
  const facing = facingBetween(start,end);
  const restingAtTarget = ["arriving","entering-location","idle"].includes(state) && context.lockToTarget;
  const current = restingAtTarget ? end : start;
  const distanceTier = distance > 34 ? "long" : distance > 16 ? "medium" : "short";
  return {
    id,
    kind,
    phase:state,
    from:start,
    to:end,
    current,
    targetLabel,
    facing,
    direction:directionSign(facing),
    distance,
    distanceTier,
    timing,
    movementProfile:kindProfile.id,
    context
  };
}

export function createWorldSceneTraversal({location,scene,action,phase = "preparing-to-move"} = {}){
  const base = scene?.player || {x:50,y:75,scale:1};
  const from = action?.from || base;
  const to = action?.target || base;
  const traversal = createSceneTraversal({
    id:`${location?.id || "location"}_${action?.id || action?.service || "destination"}`,
    kind:action?.kind === "townCenter" ? "town-center-entry" : "building-entry",
    from,
    to,
    targetLabel:action?.label?.en || action?.service || action?.id || "",
    phase,
    duration:action?.duration,
    prepareMs:action?.prepareMs,
    arriveMs:action?.arriveMs,
    enterMs:action?.enterMs,
    context:{locationId:location?.id || "", actionId:action?.id || "", service:action?.service || ""}
  });
  return {
    ...traversal,
    locationId:location?.id || "",
    actionId:action?.id || "",
    service:action?.service || "",
    destinationKind:action?.kind || ""
  };
}

export function withTraversalPhase(traversal,phase){
  if(!traversal)return null;
  const state = normalizedPhase(phase);
  return {
    ...traversal,
    phase:state,
    current:["arriving","entering-location","idle"].includes(state) ? traversal.to : traversal.from,
    context:{...(traversal.context || {}), lockToTarget:["arriving","entering-location","idle"].includes(state)}
  };
}

export function traversalStageClass(traversal){
  if(!traversal)return "";
  return [
    "has-traversal-presence",
    `traversal-kind-${traversal.kind}`,
    `traversal-phase-${traversal.phase}`,
    `traversal-facing-${traversal.facing}`,
    `traversal-distance-${traversal.distanceTier}`
  ].join(" ");
}

export function traversalActorClass(traversal){
  if(!traversal)return "traversal-phase-idle traversal-facing-forward traversal-pose-idle";
  const cycle = traversalPoseCycle(traversal);
  const pose = cycle.primary;
  return [
    "traversal-presence",
    `traversal-kind-${traversal.kind}`,
    `traversal-phase-${traversal.phase}`,
    `traversal-facing-${traversal.facing}`,
    `traversal-pose-${classToken(pose)}`,
    `traversal-rhythm-${classToken(cycle.rhythm)}`,
    `traversal-motion-${classToken(cycle.motionProfile)}`,
    traversal.phase === "walking" ? "is-walking" : "",
    traversal.phase === "preparing-to-move" ? "is-preparing" : "",
    traversal.phase === "arriving" ? "is-arriving" : "",
    traversal.phase === "entering-location" ? "is-entering-location" : ""
  ].filter(Boolean).join(" ");
}

export function traversalStyleVars(traversal, actorProfileOverride = null){
  if(!traversal)return "";
  const tuning = TRAVERSAL_TUNING;
  const current = traversal.current || traversal.from;
  const anticipation = {
    x:current.x - (traversal.direction || 0) * tuning.anticipationX,
    y:current.y + tuning.anticipationY,
    scale:current.scale * tuning.anticipationScale
  };
  const mid = {
    x:current.x + (traversal.to.x - current.x) * tuning.midPoint,
    y:current.y + (traversal.to.y - current.y) * tuning.midPoint - tuning.midLiftY,
    scale:current.scale + (traversal.to.scale - current.scale) * tuning.midPoint
  };
  const arrival = {
    x:traversal.to.x - (traversal.direction || 0) * tuning.arrivalBackoffX,
    y:traversal.to.y + tuning.arrivalY,
    scale:traversal.to.scale
  };
  const contactPoint = progress => ({
    x:current.x + (traversal.to.x - current.x) * progress,
    y:current.y + (traversal.to.y - current.y) * progress + tuning.contactSettlePx * .018,
    scale:current.scale + (traversal.to.scale - current.scale) * progress
  });
  const [contact1,contact2,contact3] = tuning.stepContactProgress.map(contactPoint);
  const dir = traversal.direction || 0;
  const profile = traversalMotionProfile(traversal.facing);
  const kindProfile = traversalKindProfile(traversal.kind);
  const actorProfile = actorProfileOverride || traversal.actorProfile || {};
  const actorCycleScale = Number.isFinite(Number(actorProfile.cycleScale)) ? Number(actorProfile.cycleScale) : 1;
  const actorSwayScale = Number.isFinite(Number(actorProfile.swayScale)) ? Number(actorProfile.swayScale) : 1;
  const actorBobScale = Number.isFinite(Number(actorProfile.bobScale)) ? Number(actorProfile.bobScale) : 1;
  const actorWeightScale = Number.isFinite(Number(actorProfile.weightScale)) ? Number(actorProfile.weightScale) : 1;
  const actorCompressionScale = Number.isFinite(Number(actorProfile.compressionScale)) ? Number(actorProfile.compressionScale) : 1;
  const actorCloakScale = Number.isFinite(Number(actorProfile.cloakScale)) ? Number(actorProfile.cloakScale) : 1;
  const actorDustScale = Number.isFinite(Number(actorProfile.dustScale)) ? Number(actorProfile.dustScale) : 1;
  const actorShadowScale = Number.isFinite(Number(actorProfile.shadowScale)) ? Number(actorProfile.shadowScale) : 1;
  const actorShadowOpacity = Number.isFinite(Number(actorProfile.shadowOpacity)) ? Number(actorProfile.shadowOpacity) : .34;
  const actorGearSwayOpacity = Number.isFinite(Number(actorProfile.gearSwayOpacity)) ? Number(actorProfile.gearSwayOpacity) : .18;
  const actorWeaponDrift = Number.isFinite(Number(actorProfile.weaponDriftPx)) ? Number(actorProfile.weaponDriftPx) : 0;
  const distanceStepStrength = tuning.stepStrength[traversal.distanceTier] || tuning.stepStrength.short;
  const stepStrength = distanceStepStrength * profile.bob * actorBobScale;
  const t = traversal.timing || durationProfile(traversal.distance);
  const cycleTarget = tuning.stepCycleTargetMs * (kindProfile.cycleScale || 1);
  const cycleMs = Math.round(clamp(t.walk / Math.max(1,Math.round(t.walk / (cycleTarget * actorCycleScale))),tuning.stepCycleMinMs,tuning.stepCycleMaxMs));
  const turnDir = dir || (traversal.facing === "forward" ? .28 : traversal.facing === "away" ? -.22 : 0);
  const weightDir = dir || (traversal.facing === "forward" ? .26 : traversal.facing === "away" ? -.22 : 0);
  return cssVars({
    "--player-x":pct(current.x),
    "--player-y":pct(current.y),
    "--player-scale":current.scale,
    "--player-anticipation-x":pct(anticipation.x),
    "--player-anticipation-y":pct(anticipation.y),
    "--player-anticipation-scale":anticipation.scale,
    "--player-mid-x":pct(mid.x),
    "--player-mid-y":pct(mid.y),
    "--player-mid-scale":mid.scale,
    "--player-contact-1-x":pct(contact1.x),
    "--player-contact-1-y":pct(contact1.y),
    "--player-contact-1-scale":contact1.scale,
    "--player-contact-2-x":pct(contact2.x),
    "--player-contact-2-y":pct(contact2.y),
    "--player-contact-2-scale":contact2.scale,
    "--player-contact-3-x":pct(contact3.x),
    "--player-contact-3-y":pct(contact3.y),
    "--player-contact-3-scale":contact3.scale,
    "--player-arrival-x":pct(arrival.x),
    "--player-arrival-y":pct(arrival.y),
    "--player-arrival-scale":arrival.scale,
    "--player-target-x":pct(traversal.to.x),
    "--player-target-y":pct(traversal.to.y),
    "--player-target-scale":traversal.to.scale,
    "--traversal-duration":`${t.total}ms`,
    "--traversal-prepare-duration":`${t.prepare}ms`,
    "--traversal-walk-duration":`${t.walk}ms`,
    "--traversal-arrive-duration":`${t.arrive}ms`,
    "--traversal-enter-duration":`${t.enter}ms`,
    "--traversal-step-cycle":`${cycleMs}ms`,
    "--traversal-body-cycle":`${cycleMs}ms`,
    "--traversal-footstep-cycle":`${cycleMs}ms`,
    "--traversal-phase-count":tuning.walkPhaseSlots.length,
    "--traversal-contact-hold":`${tuning.contactHoldPct}%`,
    "--traversal-cloak-delay":`-${Math.round(cycleMs * tuning.cloakDelayRatio * actorCloakScale)}ms`,
    "--traversal-entry-hold":`${Math.round(t.enter * tuning.entryHoldRatio)}ms`,
    "--traversal-movement-profile":kindProfile.id,
    "--traversal-direction":traversal.direction,
    "--traversal-pre-turn-angle":`${turnDir * tuning.preTurnDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-lean-forward":`${dir * tuning.leanForwardDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-lean-back":`${dir * tuning.leanBackDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-lean-prepare":`${dir * tuning.leanPrepareDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-footstep-x":`${dir * tuning.footstepNearPx * profile.drift}px`,
    "--traversal-footstep-far-x":`${dir * tuning.footstepFarPx * profile.drift}px`,
    "--traversal-passing-drift-x":`${dir * tuning.passingDriftPx * profile.drift}px`,
    "--traversal-passing-counter-drift-x":`${dir * -tuning.passingDriftPx * profile.drift}px`,
    "--traversal-passing-y":`${tuning.passingLiftPx * stepStrength}px`,
    "--traversal-contact-y":`${tuning.contactSettlePx * stepStrength * actorCompressionScale}px`,
    "--traversal-shoulder-drift-x":`${dir * tuning.shoulderDriftPx * profile.sway * actorSwayScale}px`,
    "--traversal-weight-shift-x":`${weightDir * tuning.weightShiftPx * profile.sway * actorWeightScale}px`,
    "--traversal-weight-counter-x":`${weightDir * tuning.weightCounterShiftPx * profile.sway * actorWeightScale}px`,
    "--traversal-weapon-drift-x":`${weightDir * actorWeaponDrift}px`,
    "--traversal-arrival-compress-y":`${tuning.arrivalCompressionPx * stepStrength * actorCompressionScale}px`,
    "--traversal-entry-compress-y":`${tuning.entryCompressionPx * stepStrength * actorCompressionScale}px`,
    "--traversal-drift-start-x":`${dir * tuning.driftStartPct * profile.drift}%`,
    "--traversal-drift-end-x":`${dir * tuning.driftEndPct * profile.drift}%`,
    "--traversal-dust-end-x":`${dir * tuning.dustEndPct * profile.drift}%`,
    "--traversal-distance":traversal.distance,
    "--traversal-step-strength":stepStrength,
    "--traversal-dust-contact-opacity":tuning.dustContactOpacity * profile.dust * actorDustScale,
    "--traversal-contact-shadow-scale":actorShadowScale,
    "--traversal-contact-shadow-rest-opacity":actorShadowOpacity,
    "--traversal-contact-shadow-contact-opacity":Math.min(.56, actorShadowOpacity + .12),
    "--traversal-contact-shadow-pass-opacity":Math.max(.18, actorShadowOpacity - .07),
    "--traversal-gear-sway-min-opacity":Math.max(.06, actorGearSwayOpacity * .56),
    "--traversal-gear-sway-max-opacity":actorGearSwayOpacity,
    "--traversal-step-y":`${tuning.bodyBobPx * stepStrength}px`,
    "--traversal-image-step-y":`${tuning.imageBobPx * stepStrength}px`,
    "--traversal-upper-sway":`${dir * tuning.upperSwayDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-upper-counter-sway":`${dir * tuning.upperCounterSwayDeg * profile.sway * actorSwayScale}deg`,
    "--traversal-settle-y":`${tuning.settleYPx * stepStrength * actorCompressionScale}px`,
    "--traversal-image-settle-y":`${tuning.imageSettleYPx * stepStrength * actorCompressionScale}px`,
    "--traversal-marker-lift":`${tuning.markerLiftPx * stepStrength}px`
  });
}

export function traversalAttributes(traversal){
  if(!traversal)return `data-traversal-phase="idle" data-traversal-facing="forward" data-traversal-pose="idle" data-traversal-step-pose="" data-traversal-rhythm="still" data-traversal-phase-count="1" data-traversal-cycle-poses="idle" data-traversal-motion-profile="still" data-traversal-movement-profile="scene" data-traversal-mirror="none"`;
  const cycle = traversalPoseCycle(traversal);
  return [
    `data-traversal-kind="${traversal.kind}"`,
    `data-traversal-phase="${traversal.phase}"`,
    `data-traversal-facing="${traversal.facing}"`,
    `data-traversal-pose="${cycle.primary}"`,
    `data-traversal-step-pose="${cycle.secondary}"`,
    `data-traversal-rhythm="${cycle.rhythm}"`,
    `data-traversal-phase-count="${cycle.phaseCount}"`,
    `data-traversal-cycle-poses="${cycle.phasePoses.join(" ")}"`,
    `data-traversal-motion-profile="${cycle.motionProfile}"`,
    `data-traversal-movement-profile="${traversal.movementProfile || traversalKindProfile(traversal.kind).id}"`,
    `data-traversal-mirror="none"`,
    `data-traversal-distance="${traversal.distanceTier}"`,
    `data-traversal-target="${String(traversal.targetLabel || "").replace(/"/g,"&quot;")}"`
  ].join(" ");
}

export function traversalPhaseSchedule(traversal){
  const t = traversal?.timing || durationProfile();
  return [
    {phase:"walking",delay:t.prepare},
    {phase:"arriving",delay:t.prepare + t.walk},
    {phase:"entering-location",delay:t.prepare + t.walk + t.arrive},
    {phase:"complete",delay:t.prepare + t.walk + t.arrive + t.enter}
  ];
}

export function createMapTraversalPresence({status = "idle",rawProgress = 0,angle = 0,direction = 1} = {}){
  const tuning = TRAVERSAL_TUNING;
  const kindProfile = traversalKindProfile("road-travel");
  const moving = status === "moving";
  const phase = moving ? traversalPhaseAt(rawProgress) : status === "encounter" ? "arriving" : "idle";
  const facing = moving ? facingFromAngle(angle) : direction < 0 ? "left" : "right";
  const pose = traversalPoseState({phase,facing});
  const progress = clamp(Number(rawProgress) || 0,0,1);
  return {
    phase,
    facing,
    direction:directionSign(facing),
    pose,
    progress,
    style:cssVars({
      "--journey-facing":directionSign(facing),
      "--journey-heading":`${Number(angle) || 0}deg`,
      "--journey-step-progress":progress,
      "--journey-marker-cycle":`${moving ? Math.round(tuning.stepCycleMinMs * (kindProfile.cycleScale || 1)) : tuning.stepCycleMaxMs}ms`,
      "--journey-marker-lift":`${moving ? tuning.markerLiftPx * tuning.stepStrength.short : 0}px`
    }),
    className:[
      "traversal-map-presence",
      `traversal-phase-${phase}`,
      `traversal-facing-${facing}`,
      `traversal-pose-${classToken(pose)}`,
      moving ? "is-walking" : "",
      status === "encounter" ? "is-alert" : ""
    ].filter(Boolean).join(" "),
    attrs:[
      `data-traversal-kind="road-travel"`,
      `data-traversal-phase="${phase}"`,
      `data-traversal-facing="${facing}"`,
      `data-traversal-pose="${pose}"`,
      `data-traversal-movement-profile="${kindProfile.id}"`
    ].join(" ")
  };
}
