const SCALE_WEIGHT = {small:0,medium:1,large:2};

function clamp(n,min,max){
  return Math.max(min,Math.min(max,n));
}

function pct(n){
  return `${Math.round(n * 10) / 10}%`;
}

function cssVars(vars, important = false){
  return Object.entries(vars)
    .filter(([,value])=>value !== undefined && value !== null && value !== "")
    .map(([key,value])=>`${key}:${value}${important ? " !important" : ""}`)
    .join(";");
}

function maxScaleTier(enemyScaleTiers = []){
  return enemyScaleTiers.reduce((best,tier)=>{
    return (SCALE_WEIGHT[tier] || 0) > (SCALE_WEIGHT[best] || 0) ? tier : best;
  },"small");
}

function widthFor(role,scaleTier,slot,context){
  const secondary = slot > 0;
  const crowded = context.density === "crowded";
  const boss = context.hasBoss;
  if(role === "hero"){
    if(context.framing === "duel")return "clamp(214px,24vw,318px)";
    if(boss || crowded)return "clamp(164px,18vw,248px)";
    return "clamp(184px,21vw,292px)";
  }
  if(role === "companion"){
    if(secondary)return "clamp(108px,12vw,168px)";
    return crowded ? "clamp(112px,13vw,172px)" : "clamp(132px,15vw,204px)";
  }
  if(scaleTier === "large"){
    return secondary ? "clamp(172px,20vw,278px)" : "clamp(286px,36vw,470px)";
  }
  if(scaleTier === "medium"){
    return secondary ? "clamp(138px,16vw,218px)" : "clamp(218px,26vw,336px)";
  }
  return secondary ? "clamp(118px,14vw,188px)" : "clamp(174px,20vw,258px)";
}

function mobileWidthFor(role,scaleTier,slot,context){
  const secondary = slot > 0;
  const crowded = context.density === "crowded";
  if(role === "hero")return context.hasBoss || crowded ? "112px" : context.framing === "duel" ? "138px" : "120px";
  if(role === "companion")return slot > 2 ? "84px" : slot > 1 ? "96px" : "112px";
  if(scaleTier === "large")return secondary ? "108px" : "156px";
  if(scaleTier === "medium")return secondary ? "86px" : "122px";
  return secondary ? "72px" : "108px";
}

function landscapeWidthFor(role,scaleTier,slot,context){
  const secondary = slot > 0;
  if(role === "hero")return context.hasBoss ? "118px" : "138px";
  if(role === "companion")return secondary ? "72px" : "90px";
  if(scaleTier === "large")return secondary ? "118px" : "178px";
  if(scaleTier === "medium")return secondary ? "94px" : "130px";
  return secondary ? "82px" : "116px";
}

function scaleFor(role,scaleTier,slot,context){
  const crowdedPenalty = context.density === "crowded" ? .08 : 0;
  if(role === "hero"){
    if(context.framing === "duel")return 1.04;
    if(context.hasBoss)return .82;
    return .94 - crowdedPenalty;
  }
  if(role === "companion")return slot > 1 ? .62 : .74;
  if(scaleTier === "large")return slot ? .9 : 1.06;
  if(scaleTier === "medium")return slot ? .82 : .96;
  return slot ? .72 : .88;
}

function artHeightFor(role,scaleTier,slot,context){
  if(role === "hero"){
    if(context.framing === "duel")return "clamp(294px,44vh,464px)";
    if(context.hasBoss || context.density === "crowded")return "clamp(230px,34vh,370px)";
    return "clamp(262px,39vh,420px)";
  }
  if(role === "companion")return slot > 1 ? "clamp(178px,27vh,288px)" : "clamp(214px,32vh,344px)";
  if(scaleTier === "large")return slot ? "clamp(246px,38vh,410px)" : "clamp(330px,50vh,560px)";
  if(scaleTier === "medium")return slot ? "clamp(212px,32vh,350px)" : "clamp(280px,42vh,460px)";
  return slot ? "clamp(176px,28vh,302px)" : "clamp(236px,36vh,392px)";
}

function actorHeightFor(role,scaleTier,slot,context){
  if(scaleTier === "large" && role === "enemy" && !slot)return "clamp(380px,56vh,640px)";
  if(context.framing === "duel" && !slot)return "clamp(348px,52vh,560px)";
  if(role === "companion" || slot > 1)return "clamp(248px,38vh,430px)";
  return "clamp(320px,48vh,540px)";
}

function partyPositions(context){
  const boss = context.hasBoss;
  if(context.partyCount <= 1){
    return [{x:context.framing === "duel" ? 24 : boss ? 18 : 21,y:boss ? 8 : 6,depth:"foreground",lane:"front",z:8}];
  }
  return [
    {x:16,y:6,depth:"foreground",lane:"front",z:9},
    {x:40,y:13,depth:"midground",lane:"support",z:6},
    {x:9,y:26,depth:"background",lane:"rear",z:4},
    {x:30,y:30,depth:"background",lane:"wide",z:3}
  ];
}

function enemyPositions(context){
  const boss = context.hasBoss;
  if(context.enemyCount <= 1){
    return [{x:boss ? 76 : context.framing === "duel" ? 75 : 78,y:boss ? 8 : 6,depth:boss ? "foreground" : "midground",lane:"front",z:boss ? 8 : 7}];
  }
  if(boss){
    return [
      {x:80,y:7,depth:"foreground",lane:"boss",z:8},
      {x:55,y:23,depth:"midground",lane:"guard",z:5},
      {x:91,y:32,depth:"background",lane:"flank",z:4},
      {x:70,y:39,depth:"background",lane:"rear",z:3}
    ];
  }
  return [
    {x:77,y:6,depth:"foreground",lane:"front",z:8},
    {x:55,y:20,depth:"midground",lane:"left",z:6},
    {x:88,y:28,depth:"background",lane:"right",z:5},
    {x:70,y:36,depth:"background",lane:"rear",z:4}
  ];
}

function mobilePartyPosition(slot,context){
  const positions = context.partyCount <= 1
    ? [{x:context.hasBoss ? 23 : 25,y:7}]
    : [{x:25,y:7},{x:15,y:22},{x:43,y:31},{x:18,y:43}];
  return positions[slot] || {x:18 + (slot % 3) * 12,y:28 + Math.floor(slot / 3) * 10};
}

function mobileEnemyPosition(slot,context){
  const positions = context.hasBoss
    ? [{x:78,y:8},{x:56,y:32},{x:87,y:43},{x:70,y:50}]
    : context.enemyCount <= 1
      ? [{x:76,y:7}]
      : [{x:76,y:7},{x:56,y:31},{x:87,y:43},{x:68,y:50}];
  return positions[slot] || {x:58 + (slot % 3) * 12,y:30 + Math.floor(slot / 3) * 10};
}

function landscapePartyPosition(slot,context){
  const positions = context.partyCount <= 1
    ? [{x:context.hasBoss ? 20 : 23,y:4}]
    : [{x:18,y:4},{x:34,y:9},{x:12,y:20},{x:42,y:22}];
  return positions[slot] || {x:18 + (slot % 3) * 10,y:18 + Math.floor(slot / 3) * 8};
}

function landscapeEnemyPosition(slot,context){
  const positions = context.hasBoss
    ? [{x:78,y:4},{x:61,y:15},{x:89,y:21},{x:70,y:27}]
    : [{x:77,y:4},{x:61,y:13},{x:88,y:21},{x:70,y:27}];
  return positions[slot] || {x:62 + (slot % 3) * 10,y:18 + Math.floor(slot / 3) * 8};
}

function actorStyle(actor){
  return cssVars({
    "--actor-x":pct(actor.x),
    "--actor-y":pct(actor.y),
    "--actor-mobile-x":pct(actor.mobileX),
    "--actor-mobile-y":pct(actor.mobileY),
    "--actor-landscape-x":pct(actor.landscapeX),
    "--actor-landscape-y":pct(actor.landscapeY),
    "--actor-width":actor.width,
    "--actor-mobile-width":actor.mobileWidth,
    "--actor-landscape-width":actor.landscapeWidth,
    "--actor-scale":actor.scale,
    "--actor-mobile-scale":actor.mobileScale,
    "--actor-landscape-scale":actor.landscapeScale,
    "--actor-height":actor.height,
    "--actor-mobile-height":actor.mobileHeight,
    "--actor-landscape-height":actor.landscapeHeight,
    "--actor-art-height":actor.artHeight,
    "--actor-mobile-art-height":actor.mobileArtHeight,
    "--actor-landscape-art-height":actor.landscapeArtHeight,
    "--actor-z":actor.z,
    "--actor-opacity":actor.opacity
  }, true);
}

function makeActor({key,role,side,slot,scaleTier = "small",position,mobilePosition,landscapePosition,context,opacity = 1}){
  const scale = scaleFor(role,scaleTier,slot,context);
  const mobileScale = role === "companion"
    ? clamp(scale * (slot > 1 ? 1.24 : 1.2),.74,.94)
    : clamp(scale * (role === "enemy" && scaleTier === "large" ? .76 : .82),.45,.9);
  const landscapeScale = clamp(scale * .72,.42,.82);
  return {
    key,
    role,
    side,
    slot,
    scaleTier,
    depth:position.depth,
    lane:position.lane,
    x:position.x,
    y:position.y,
    mobileX:mobilePosition.x,
    mobileY:mobilePosition.y,
    landscapeX:landscapePosition.x,
    landscapeY:landscapePosition.y,
    width:widthFor(role,scaleTier,slot,context),
    mobileWidth:mobileWidthFor(role,scaleTier,slot,context),
    landscapeWidth:landscapeWidthFor(role,scaleTier,slot,context),
    height:actorHeightFor(role,scaleTier,slot,context),
    mobileHeight:role === "enemy" && scaleTier === "large" ? "292px" : role === "hero" ? "246px" : role === "companion" ? "248px" : "212px",
    landscapeHeight:role === "enemy" && scaleTier === "large" ? "230px" : role === "companion" ? "176px" : "208px",
    artHeight:artHeightFor(role,scaleTier,slot,context),
    mobileArtHeight:role === "enemy" && scaleTier === "large" ? "244px" : role === "hero" ? "202px" : role === "companion" ? "216px" : "176px",
    landscapeArtHeight:role === "enemy" && scaleTier === "large" ? "190px" : role === "companion" ? "144px" : "168px",
    scale,
    mobileScale,
    landscapeScale,
    z:position.z,
    opacity,
    style:""
  };
}

export function createBattlefieldComposition({hero,companions = [],enemies = [],enemyScaleTiers = [],visualTier = "common",scene = {},meta = {}} = {}){
  const partyCount = 1 + companions.length;
  const enemyCount = enemies.length;
  const totalActors = partyCount + enemyCount;
  const largestEnemy = maxScaleTier(enemyScaleTiers);
  const hasBoss = ["legendary","boss"].includes(visualTier) || largestEnemy === "large";
  const duel = partyCount === 1 && enemyCount === 1 && !hasBoss;
  const crowded = totalActors >= 5 || enemyCount >= 3 || partyCount >= 4;
  const density = totalActors <= 2 ? "sparse" : crowded ? "crowded" : "balanced";
  const framing = hasBoss ? (enemyCount > 1 ? "boss-pack" : "boss") : duel ? "duel" : crowded ? "crowd" : partyCount > 1 ? "party-skirmish" : "skirmish";
  const context = {partyCount,enemyCount,totalActors,largestEnemy,hasBoss,duel,crowded,density,framing,visualTier,sceneId:scene?.id || "unknown",source:meta?.source || ""};
  const partyBase = partyPositions(context);
  const enemyBase = enemyPositions(context);
  const partyActors = [
    makeActor({
      key:"hero",
      role:"hero",
      side:"party",
      slot:0,
      position:partyBase[0],
      mobilePosition:mobilePartyPosition(0,context),
      landscapePosition:landscapePartyPosition(0,context),
      context,
      opacity:1
    }),
    ...companions.map((companion,index)=>makeActor({
      key:`comp_${companion?.id || index}`,
      role:"companion",
      side:"party",
      slot:index + 1,
      position:partyBase[index + 1] || partyBase[partyBase.length - 1],
      mobilePosition:mobilePartyPosition(index + 1,context),
      landscapePosition:landscapePartyPosition(index + 1,context),
      context,
      opacity:index > 1 ? .76 : .9
    }))
  ];
  const enemyActors = enemies.map((enemy,index)=>makeActor({
    key:enemy?.id || `enemy_${index}`,
    role:"enemy",
    side:"enemy",
    slot:index,
    scaleTier:enemyScaleTiers[index] || "small",
    position:enemyBase[index] || enemyBase[enemyBase.length - 1],
    mobilePosition:mobileEnemyPosition(index,context),
    landscapePosition:landscapeEnemyPosition(index,context),
    context,
    opacity:index > 2 ? .68 : index > 0 ? .88 : 1
  }));
  partyActors.concat(enemyActors).forEach(actor=>{actor.style = actorStyle(actor);});
  return {
    ...context,
    heroName:hero?.name || "",
    partyActors,
    enemyActors,
    stageClass:`scene-director-stage director-framing-${framing} director-density-${density} director-party-${clamp(partyCount,1,4)} director-enemies-${clamp(enemyCount,0,4)} ${hasBoss ? "director-has-boss" : "director-no-boss"}`,
    stageStyle:cssVars({
      "--director-total-actors":totalActors,
      "--director-party-count":partyCount,
      "--director-enemy-count":enemyCount,
      "--director-stage-height":hasBoss ? "clamp(560px,70vh,800px)" : crowded ? "clamp(520px,66vh,740px)" : "clamp(500px,64vh,720px)",
      "--director-stage-height-mobile":hasBoss ? "clamp(430px,62svh,540px)" : crowded ? "clamp(420px,60svh,520px)" : "clamp(410px,58svh,500px)",
      "--director-stage-height-landscape":hasBoss ? "230px" : "220px"
    })
  };
}

export function directorStageAttributes(composition){
  return [
    `data-scene-director="dynamic"`,
    `data-director-framing="${composition.framing}"`,
    `data-director-density="${composition.density}"`,
    `data-party-count="${composition.partyCount}"`,
    `data-enemy-count="${composition.enemyCount}"`,
    `data-boss-presence="${composition.hasBoss ? "true" : "false"}"`,
    `data-largest-enemy="${composition.largestEnemy}"`
  ].join(" ");
}

export function actorDirectorAttributes(actor){
  if(!actor)return "";
  return [
    `data-director-actor="${actor.role}"`,
    `data-director-side="${actor.side}"`,
    `data-director-depth="${actor.depth}"`,
    `data-director-lane="${actor.lane}"`,
    `data-director-scale="${actor.scaleTier}"`,
    `style="${actor.style}"`
  ].join(" ");
}
