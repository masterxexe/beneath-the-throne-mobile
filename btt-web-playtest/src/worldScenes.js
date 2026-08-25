export const WORLD_SCENE_ASSETS = {
  ashenKeepV71: "assets/towns/generated/ashen-keep-world-v71.png",
  ashenFieldsV71: "assets/towns/generated/ashen-fields-world-v71.png",
  oldRoadV71: "assets/towns/generated/old-road-world-v71.png",
  forestEdgeV71: "assets/towns/generated/forest-edge-world-v71.png",
  ruinedWatchtowerV71: "assets/towns/generated/ruined-watchtower-world-v71.png",
  marketTownV71: "assets/towns/generated/market-town-world-v71.png",
  cinderhookSlumsV71: "assets/towns/generated/cinderhook-slums-world-v71.png",
  lowerWardV71: "assets/towns/generated/lower-ward-world-v71.png"
};

export const ROAD_STOP_SCENE_ASSETS = {
  ashenGateV71: "assets/ministops/generated/ashen-gate-world-v71.png",
  brokenRoadV71: "assets/ministops/generated/broken-road-world-v71.png",
  ruinedWaystoneV71: "assets/ministops/generated/ruined-waystone-world-v71.png",
  burnedShrineV71: "assets/ministops/generated/burned-shrine-world-v71.png",
  ashenSlopeV71: "assets/ministops/generated/ashen-slope-world-v71.png",
  watchtowerApproachV71: "assets/ministops/generated/watchtower-approach-world-v71.png",
  oldCrossroadsV71: "assets/ministops/generated/old-crossroads-world-v71.png",
  abandonedCartV71: "assets/ministops/generated/abandoned-cart-world-v71.png",
  travelerCampV71: "assets/ministops/generated/traveler-camp-world-v71.png",
  marketOutskirtsV71: "assets/ministops/generated/market-outskirts-world-v71.png",
  forestTrailV71: "assets/ministops/generated/forest-trail-world-v71.png",
  ridgePathV71: "assets/ministops/generated/ridge-path-world-v71.png"
};

function action({id, service = "", kind = "service", label, hint, x, y, width, height, glow = "gold", target, duration}){
  return {id, service, kind, label, hint, x, y, width, height, glow, target, duration};
}

function effect(id, type, x, y, width, height, tone = "gold", opacity){
  return {id, type, x, y, width, height, tone, opacity};
}

const COMMON_MAJOR_ACTIONS = {
  mapGate: action({
    id: "roadGate",
    kind: "openMap",
    label: {en: "Road Gate", es: "Puerta del camino"},
    hint: {en: "Open the route map", es: "Abrir el mapa de rutas"},
    x: 8,
    y: 80,
    width: 18,
    height: 28,
    glow: "stone",
    target: {x: 16, y: 82, scale: .96}
  }),
  scout: action({
    id: "scoutArea",
    kind: "scoutNearby",
    label: {en: "Scout", es: "Rastrear"},
    hint: {en: "Search the visible ground", es: "Revisar el terreno visible"},
    x: 48,
    y: 70,
    width: 23,
    height: 24,
    glow: "stone",
    target: {x: 48, y: 77, scale: .96}
  }),
  hunt: action({
    id: "huntTrail",
    kind: "huntNearby",
    label: {en: "Hunt Trail", es: "Rastro de caza"},
    hint: {en: "Follow danger into combat", es: "Seguir el peligro al combate"},
    x: 82,
    y: 68,
    width: 22,
    height: 30,
    glow: "ember",
    target: {x: 74, y: 80, scale: .98}
  })
};

const ROAD_STOP_BASE_ACTIONS = [
  action({
    id: "continueJourney",
    kind: "continueJourney",
    label: {en: "Road Ahead", es: "Camino adelante"},
    hint: {en: "Continue the journey", es: "Continuar el viaje"},
    x: 82,
    y: 65,
    width: 26,
    height: 34,
    glow: "stone",
    target: {x: 72, y: 80, scale: .96}
  }),
  action({
    id: "inspectArea",
    kind: "inspectRoadStop",
    label: {en: "Inspect", es: "Inspeccionar"},
    hint: {en: "Search this stop", es: "Registrar esta parada"},
    x: 49,
    y: 64,
    width: 24,
    height: 28,
    glow: "lantern",
    target: {x: 50, y: 79, scale: .98}
  }),
  action({
    id: "turnBack",
    kind: "turnBackJourney",
    label: {en: "Back Trail", es: "Sendero atras"},
    hint: {en: "Turn back toward the origin", es: "Volver hacia el origen"},
    x: 17,
    y: 70,
    width: 24,
    height: 32,
    glow: "stone",
    target: {x: 26, y: 82, scale: .96}
  }),
  action({
    id: "openMap",
    kind: "openMap",
    label: {en: "Waymark", es: "Marca de ruta"},
    hint: {en: "Open the road map", es: "Abrir el mapa del camino"},
    x: 14,
    y: 34,
    width: 20,
    height: 22,
    glow: "stone",
    target: {x: 29, y: 75, scale: .92}
  })
];

const ASHEN_KEEP_SCENE = {
  id: "ashen_keep_world_v71",
  locationId: "ashen_keep",
  sceneClass: "world-scene-ashen-keep-v71",
  art: WORLD_SCENE_ASSETS.ashenKeepV71,
  mood: "ash-refuge",
  player: {x: 63, y: 78, scale: .98},
  actions: [
    action({
      id: "blacksmith",
      service: "blacksmith",
      label: {en: "Blacksmith", es: "Herreria"},
      hint: {en: "Forge, anvil, repairs", es: "Forja, yunque, reparaciones"},
      x: 18,
      y: 61,
      width: 27,
      height: 43,
      glow: "ember",
      target: {x: 28, y: 80, scale: .98}
    }),
    action({
      id: "townCenter",
      service: "townCenter",
      kind: "townCenter",
      label: {en: "Town Center", es: "Centro del pueblo"},
      hint: {en: "Ledger, notices, refugees", es: "Registro, avisos, refugiados"},
      x: 49,
      y: 49,
      width: 23,
      height: 30,
      glow: "stone",
      target: {x: 49, y: 63, scale: .88}
    }),
    action({
      id: "tavern",
      service: "tavern",
      label: {en: "Tavern", es: "Taberna"},
      hint: {en: "Warm door, recruits, rumors", es: "Puerta calida, reclutas, rumores"},
      x: 75,
      y: 42,
      width: 25,
      height: 28,
      glow: "lantern",
      target: {x: 65, y: 62, scale: .88}
    }),
    action({
      id: "inn",
      service: "inn",
      label: {en: "Inn", es: "Posada"},
      hint: {en: "Shelter, beds, rest", es: "Refugio, camas, descanso"},
      x: 87,
      y: 66,
      width: 23,
      height: 38,
      glow: "hearth",
      target: {x: 78, y: 77, scale: .92}
    }),
    COMMON_MAJOR_ACTIONS.mapGate
  ],
  effects: [
    effect("forge-glow", "torch", 18, 62, 26, 26, "ember"),
    effect("forge-smoke", "smoke", 22, 38, 24, 34, "ash", .32),
    effect("forge-sparks", "sparks", 20, 64, 14, 12, "ember", .34),
    effect("tavern-glow", "torch", 75, 45, 28, 22, "lantern"),
    effect("tavern-windows", "window", 77, 39, 18, 10, "lantern", .28),
    effect("inn-glow", "torch", 87, 66, 24, 26, "hearth"),
    effect("inn-window", "window", 88, 69, 16, 12, "hearth", .24),
    effect("center-brazier", "torch", 51, 63, 16, 14, "gold")
  ]
};

const WORLD_SCENE_LIST = [
  {
    id: "ashen_slums_world_v71",
    locationId: "ashen_slums",
    sceneClass: "world-scene-cinderhook-slums-v71",
    art: WORLD_SCENE_ASSETS.cinderhookSlumsV71,
    mood: "slum-ash",
    player: {x: 38, y: 82, scale: .94},
    actions: [
      action({
        id: "market",
        service: "market",
        label: {en: "Slum Market", es: "Mercado del barrio"},
        hint: {en: "Scrap trade and gang debts", es: "Comercio de chatarra y deudas de banda"},
        x: 30, y: 58, width: 24, height: 32, glow: "ember",
        target: {x: 34, y: 78, scale: .94}
      }),
      action({
        id: "blacksmith",
        service: "blacksmith",
        label: {en: "Patch Forge", es: "Forja remendada"},
        hint: {en: "Repairs on a shoestring", es: "Reparaciones con poco"},
        x: 16, y: 64, width: 22, height: 34, glow: "ember",
        target: {x: 22, y: 79, scale: .95}
      }),
      action({
        id: "tavern",
        service: "tavern",
        label: {en: "Gutter Taproom", es: "Taberna del desague"},
        hint: {en: "Rumors, recruits, trouble", es: "Rumores, reclutas, problemas"},
        x: 68, y: 52, width: 24, height: 30, glow: "lantern",
        target: {x: 64, y: 72, scale: .9}
      }),
      action({
        id: "inn",
        service: "inn",
        label: {en: "Shelter Loft", es: "Refugio del desvan"},
        hint: {en: "A roof over Cinderhook", es: "Un techo sobre Cinderhook"},
        x: 82, y: 62, width: 22, height: 36, glow: "hearth",
        target: {x: 76, y: 78, scale: .92}
      }),
      action({
        id: "lowerWardGate",
        kind: "openMap",
        label: {en: "Lower Ward Gate", es: "Puerta del Barrio Inferior"},
        hint: {en: "Climb toward permission and trainers", es: "Subir hacia permiso y entrenadores"},
        x: 52, y: 38, width: 20, height: 26, glow: "gold",
        target: {x: 50, y: 70, scale: .88}
      }),
      COMMON_MAJOR_ACTIONS.hunt
    ],
    effects: [
      effect("slum-smoke", "smoke", 42, 28, 38, 24, "ash", .38),
      effect("slum-ember", "sparks", 18, 66, 16, 12, "ember", .32),
      effect("slum-lantern", "torch", 70, 54, 18, 16, "lantern", .24)
    ]
  },
  {
    id: "lower_ward_world_v71",
    locationId: "lower_ward",
    sceneClass: "world-scene-lower-ward-v71",
    art: WORLD_SCENE_ASSETS.lowerWardV71,
    mood: "ward-lanterns",
    player: {x: 44, y: 80, scale: .96},
    actions: [
      action({
        id: "market",
        service: "market",
        label: {en: "Ward Market", es: "Mercado del barrio"},
        hint: {en: "Licensed trade above the slum", es: "Comercio con licencia sobre el barrio"},
        x: 32, y: 56, width: 24, height: 30, glow: "stone",
        target: {x: 36, y: 76, scale: .94}
      }),
      action({
        id: "blacksmith",
        service: "blacksmith",
        label: {en: "Ward Forge", es: "Forja del barrio"},
        hint: {en: "Better steel, higher prices", es: "Mejor acero, precios mas altos"},
        x: 18, y: 60, width: 22, height: 34, glow: "ember",
        target: {x: 24, y: 78, scale: .95}
      }),
      action({
        id: "tavern",
        service: "tavern",
        label: {en: "Ward Tavern", es: "Taberna del barrio"},
        hint: {en: "Contracts and companions", es: "Contratos y companeros"},
        x: 70, y: 48, width: 24, height: 28, glow: "lantern",
        target: {x: 66, y: 70, scale: .9}
      }),
      action({
        id: "inn",
        service: "inn",
        label: {en: "Ward Inn", es: "Posada del barrio"},
        hint: {en: "Rest with fewer fleas", es: "Descansar con menos pulgas"},
        x: 84, y: 60, width: 22, height: 34, glow: "hearth",
        target: {x: 78, y: 76, scale: .92}
      }),
      COMMON_MAJOR_ACTIONS.mapGate,
      COMMON_MAJOR_ACTIONS.hunt
    ],
    effects: [
      effect("ward-lantern-a", "torch", 34, 42, 16, 14, "lantern", .28),
      effect("ward-lantern-b", "torch", 72, 50, 16, 14, "lantern", .26),
      effect("ward-mist", "smoke", 50, 30, 40, 20, "ash", .18)
    ]
  },
  ASHEN_KEEP_SCENE,
  {
    id: "ashen_fields_world_v71",
    locationId: "ashen_fields",
    sceneClass: "world-scene-ashen-fields-v71",
    art: WORLD_SCENE_ASSETS.ashenFieldsV71,
    mood: "cinder-fields",
    player: {x: 42, y: 80, scale: .96},
    actions: [
      action({
        id: "mine",
        service: "mine",
        label: {en: "Mine Cut", es: "Corte de mina"},
        hint: {en: "Gather ore through the existing mine rules", es: "Reunir mineral con las reglas de mina existentes"},
        x: 74,
        y: 50,
        width: 25,
        height: 34,
        glow: "stone",
        target: {x: 67, y: 75, scale: .98}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.scout,
        id: "burnedFarmstead",
        label: {en: "Burned Farm", es: "Granja quemada"},
        x: 35,
        y: 55,
        target: {x: 39, y: 75, scale: .96}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.hunt,
        id: "cinderDitch",
        label: {en: "Cinder Ditch", es: "Zanja de ceniza"},
        x: 87,
        y: 70,
        target: {x: 75, y: 81, scale: .98}
      }),
      COMMON_MAJOR_ACTIONS.mapGate
    ],
    effects: [
      effect("ash-field-smoke", "smoke", 35, 37, 36, 28, "ash", .34),
      effect("mine-glint", "stone", 74, 50, 18, 16, "stone", .22),
      effect("cinder-embers", "sparks", 83, 71, 18, 14, "ember", .3)
    ]
  },
  {
    id: "old_road_world_v71",
    locationId: "old_road",
    sceneClass: "world-scene-old-road-v71",
    art: WORLD_SCENE_ASSETS.oldRoadV71,
    mood: "road-hub",
    player: {x: 47, y: 81, scale: .95},
    actions: [
      action({
        ...COMMON_MAJOR_ACTIONS.mapGate,
        id: "crossroadsSign",
        label: {en: "Crossroads", es: "Cruce"},
        x: 49,
        y: 54,
        width: 25,
        height: 28,
        target: {x: 48, y: 76, scale: .95}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.scout,
        id: "oldMilestone",
        label: {en: "Milestone", es: "Hito"},
        x: 28,
        y: 65,
        target: {x: 34, y: 79, scale: .96}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.hunt,
        id: "ambushRuts",
        label: {en: "Ambush Ruts", es: "Surcos de emboscada"},
        x: 76,
        y: 68,
        target: {x: 69, y: 80, scale: .97}
      })
    ],
    effects: [
      effect("road-dust", "smoke", 53, 70, 44, 18, "ash", .22),
      effect("far-lantern", "torch", 78, 45, 14, 14, "lantern", .2)
    ]
  },
  {
    id: "forest_edge_world_v71",
    locationId: "forest_edge",
    sceneClass: "world-scene-forest-edge-v71",
    art: WORLD_SCENE_ASSETS.forestEdgeV71,
    mood: "dark-forest",
    player: {x: 41, y: 80, scale: .94},
    actions: [
      action({
        ...COMMON_MAJOR_ACTIONS.mapGate,
        id: "forestRoad",
        label: {en: "Forest Road", es: "Camino del bosque"},
        x: 17,
        y: 72,
        target: {x: 27, y: 81, scale: .94}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.scout,
        id: "rootSign",
        label: {en: "Root Sign", es: "Marca de raices"},
        x: 51,
        y: 57,
        width: 28,
        height: 32,
        glow: "stone",
        target: {x: 48, y: 76, scale: .96}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.hunt,
        id: "wolfTrail",
        label: {en: "Wolf Trail", es: "Rastro de lobos"},
        x: 82,
        y: 67,
        glow: "lantern",
        target: {x: 73, y: 80, scale: .98}
      })
    ],
    effects: [
      effect("forest-fog", "smoke", 58, 56, 54, 35, "ash", .28),
      effect("root-glow", "stone", 51, 57, 18, 16, "stone", .2)
    ]
  },
  {
    id: "ruined_watchtower_world_v71",
    locationId: "ruined_watchtower",
    sceneClass: "world-scene-ruined-watchtower-v71",
    art: WORLD_SCENE_ASSETS.ruinedWatchtowerV71,
    mood: "ruined-fort",
    player: {x: 44, y: 81, scale: .94},
    actions: [
      action({
        ...COMMON_MAJOR_ACTIONS.mapGate,
        id: "ridgeExit",
        label: {en: "Ridge Path", es: "Camino de cresta"},
        x: 16,
        y: 70,
        target: {x: 25, y: 81, scale: .94}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.scout,
        id: "towerGate",
        label: {en: "Tower Gate", es: "Puerta de torre"},
        hint: {en: "Search the broken entrance", es: "Registrar la entrada rota"},
        x: 51,
        y: 44,
        width: 27,
        height: 38,
        glow: "stone",
        target: {x: 51, y: 68, scale: .9}
      }),
      action({
        ...COMMON_MAJOR_ACTIONS.hunt,
        id: "brokenArches",
        label: {en: "Broken Arches", es: "Arcos rotos"},
        x: 76,
        y: 61,
        target: {x: 69, y: 78, scale: .96}
      })
    ],
    effects: [
      effect("tower-sick-light", "stone", 52, 44, 23, 25, "stone", .28),
      effect("tower-dust", "smoke", 45, 40, 48, 36, "ash", .26)
    ]
  },
  {
    id: "market_town_world_v71",
    locationId: "market_town",
    sceneClass: "world-scene-market-town-v71",
    art: WORLD_SCENE_ASSETS.marketTownV71,
    mood: "lantern-market",
    player: {x: 47, y: 80, scale: .95},
    actions: [
      action({
        id: "market",
        service: "market",
        label: {en: "Market", es: "Mercado"},
        hint: {en: "Trade stalls and supplies", es: "Puestos y suministros"},
        x: 45,
        y: 55,
        width: 29,
        height: 31,
        glow: "lantern",
        target: {x: 44, y: 72, scale: .92}
      }),
      action({
        id: "blacksmith",
        service: "blacksmith",
        label: {en: "Blacksmith", es: "Herreria"},
        hint: {en: "Forge work and repairs", es: "Forja y reparaciones"},
        x: 70,
        y: 57,
        width: 24,
        height: 30,
        glow: "ember",
        target: {x: 65, y: 74, scale: .94}
      }),
      action({
        id: "inn",
        service: "inn",
        label: {en: "Inn", es: "Posada"},
        hint: {en: "Beds, rest, recovery", es: "Camas, descanso, recuperacion"},
        x: 27,
        y: 65,
        width: 23,
        height: 34,
        glow: "hearth",
        target: {x: 34, y: 78, scale: .95}
      }),
      action({
        id: "tavern",
        service: "tavern",
        label: {en: "Tavern", es: "Taberna"},
        hint: {en: "Recruits and rumors", es: "Reclutas y rumores"},
        x: 58,
        y: 43,
        width: 24,
        height: 28,
        glow: "lantern",
        target: {x: 55, y: 66, scale: .9}
      }),
      action({
        id: "townCenter",
        service: "townCenter",
        kind: "townCenter",
        label: {en: "Town Center", es: "Centro del pueblo"},
        hint: {en: "Ledger and notices", es: "Registro y avisos"},
        x: 84,
        y: 44,
        width: 20,
        height: 27,
        glow: "stone",
        target: {x: 76, y: 66, scale: .9}
      }),
      COMMON_MAJOR_ACTIONS.mapGate
    ],
    effects: [
      effect("market-lanterns", "torch", 45, 55, 30, 24, "lantern", .28),
      effect("market-smith", "sparks", 70, 57, 16, 12, "ember", .32),
      effect("market-window", "window", 58, 42, 16, 9, "lantern", .22)
    ]
  }
];

function roadStopScene({id, asset, sceneClass, player, focus, effects = []}){
  const actions = ROAD_STOP_BASE_ACTIONS.map(item=>({...item}));
  if(focus){
    actions[1] = {...actions[1], ...focus, id: "inspectArea", kind: "inspectRoadStop"};
  }
  return {
    id: `${id}_scene_v71`,
    locationId: id,
    sceneClass,
    art: asset,
    mood: "road-stop",
    player,
    actions,
    effects
  };
}

const ROAD_STOP_SCENE_LIST = [
  roadStopScene({
    id: "ashen_gate",
    asset: ROAD_STOP_SCENE_ASSETS.ashenGateV71,
    sceneClass: "road-stop-scene-ashen-gate-v71",
    player: {x: 42, y: 81, scale: .94},
    focus: {
      label: {en: "Gate Ash", es: "Ceniza de puerta"},
      hint: {en: "Search the guarded ash", es: "Registrar la ceniza vigilada"},
      x: 43,
      y: 58,
      width: 25,
      height: 30,
      target: {x: 45, y: 77, scale: .96}
    },
    effects: [effect("gate-torch", "torch", 38, 48, 22, 22, "ember", .28)]
  }),
  roadStopScene({
    id: "broken_road",
    asset: ROAD_STOP_SCENE_ASSETS.brokenRoadV71,
    sceneClass: "road-stop-scene-broken-road-v71",
    player: {x: 42, y: 81, scale: .95},
    focus: {
      label: {en: "Cracked Stones", es: "Piedras partidas"},
      hint: {en: "Search the split flagstones", es: "Registrar las losas partidas"},
      x: 47,
      y: 62,
      width: 30,
      height: 28,
      target: {x: 48, y: 79, scale: .97}
    },
    effects: [effect("road-dust", "smoke", 50, 66, 42, 18, "ash", .2)]
  }),
  roadStopScene({
    id: "ruined_waystone",
    asset: ROAD_STOP_SCENE_ASSETS.ruinedWaystoneV71,
    sceneClass: "road-stop-scene-ruined-waystone-v71",
    player: {x: 40, y: 81, scale: .94},
    focus: {
      label: {en: "Waystone", es: "Piedra guia"},
      hint: {en: "Read the ruined marker", es: "Leer la marca en ruinas"},
      x: 50,
      y: 51,
      width: 22,
      height: 32,
      glow: "stone",
      target: {x: 49, y: 75, scale: .94}
    },
    effects: [effect("waystone-glow", "stone", 50, 51, 20, 24, "stone", .3)]
  }),
  roadStopScene({
    id: "burned_shrine",
    asset: ROAD_STOP_SCENE_ASSETS.burnedShrineV71,
    sceneClass: "road-stop-scene-burned-shrine-v71",
    player: {x: 39, y: 81, scale: .94},
    focus: {
      label: {en: "Shrine", es: "Santuario"},
      hint: {en: "Inspect the cold altar", es: "Inspeccionar el altar frio"},
      x: 51,
      y: 52,
      width: 24,
      height: 32,
      glow: "ember",
      target: {x: 50, y: 75, scale: .94}
    },
    effects: [
      effect("shrine-ember", "torch", 51, 53, 24, 22, "ember", .24),
      effect("shrine-smoke", "smoke", 48, 36, 26, 28, "ash", .22)
    ]
  }),
  roadStopScene({
    id: "ashen_slope",
    asset: ROAD_STOP_SCENE_ASSETS.ashenSlopeV71,
    sceneClass: "road-stop-scene-ashen-slope-v71",
    player: {x: 40, y: 82, scale: .94},
    focus: {
      label: {en: "Wind Fence", es: "Valla del viento"},
      hint: {en: "Search the slope for tracks", es: "Buscar huellas en la ladera"},
      x: 56,
      y: 59,
      width: 30,
      height: 28,
      target: {x: 54, y: 78, scale: .96}
    },
    effects: [effect("slope-dust", "smoke", 57, 58, 48, 28, "ash", .2)]
  }),
  roadStopScene({
    id: "watchtower_approach",
    asset: ROAD_STOP_SCENE_ASSETS.watchtowerApproachV71,
    sceneClass: "road-stop-scene-watchtower-approach-v71",
    player: {x: 41, y: 82, scale: .93},
    focus: {
      label: {en: "Arches", es: "Arcos"},
      hint: {en: "Search the watched approach", es: "Registrar el acceso vigilado"},
      x: 54,
      y: 48,
      width: 27,
      height: 36,
      glow: "stone",
      target: {x: 53, y: 73, scale: .92}
    },
    effects: [effect("approach-haze", "smoke", 52, 47, 40, 36, "ash", .24)]
  }),
  roadStopScene({
    id: "old_crossroads",
    asset: ROAD_STOP_SCENE_ASSETS.oldCrossroadsV71,
    sceneClass: "road-stop-scene-old-crossroads-v71",
    player: {x: 42, y: 81, scale: .95},
    focus: {
      label: {en: "Signpost", es: "Poste de rutas"},
      hint: {en: "Inspect the crossing", es: "Inspeccionar el cruce"},
      x: 50,
      y: 50,
      width: 24,
      height: 33,
      target: {x: 49, y: 75, scale: .95}
    },
    effects: [effect("crossroads-lantern", "torch", 50, 50, 18, 18, "lantern", .2)]
  }),
  roadStopScene({
    id: "abandoned_cart",
    asset: ROAD_STOP_SCENE_ASSETS.abandonedCartV71,
    sceneClass: "road-stop-scene-abandoned-cart-v71",
    player: {x: 38, y: 81, scale: .95},
    focus: {
      label: {en: "Broken Cart", es: "Carreta rota"},
      hint: {en: "Search the raided cargo", es: "Registrar la carga saqueada"},
      x: 53,
      y: 58,
      width: 31,
      height: 30,
      target: {x: 53, y: 77, scale: .97}
    },
    effects: [effect("cart-dust", "smoke", 54, 61, 36, 20, "ash", .2)]
  }),
  roadStopScene({
    id: "traveler_camp",
    asset: ROAD_STOP_SCENE_ASSETS.travelerCampV71,
    sceneClass: "road-stop-scene-traveler-camp-v71",
    player: {x: 41, y: 81, scale: .95},
    focus: {
      label: {en: "Campfire", es: "Fogata"},
      hint: {en: "Search the warm camp", es: "Registrar el campamento tibio"},
      x: 51,
      y: 60,
      width: 28,
      height: 30,
      glow: "hearth",
      target: {x: 50, y: 78, scale: .97}
    },
    effects: [
      effect("campfire", "torch", 51, 60, 24, 22, "hearth", .32),
      effect("camp-smoke", "smoke", 51, 43, 24, 26, "ash", .2)
    ]
  }),
  roadStopScene({
    id: "market_outskirts",
    asset: ROAD_STOP_SCENE_ASSETS.marketOutskirtsV71,
    sceneClass: "road-stop-scene-market-outskirts-v71",
    player: {x: 41, y: 81, scale: .95},
    focus: {
      label: {en: "Guard Lantern", es: "Farol de guardia"},
      hint: {en: "Check the watched road", es: "Revisar el camino vigilado"},
      x: 59,
      y: 55,
      width: 28,
      height: 30,
      glow: "lantern",
      target: {x: 57, y: 77, scale: .96}
    },
    effects: [effect("outskirts-lantern", "torch", 59, 55, 25, 22, "lantern", .3)]
  }),
  roadStopScene({
    id: "forest_trail",
    asset: ROAD_STOP_SCENE_ASSETS.forestTrailV71,
    sceneClass: "road-stop-scene-forest-trail-v71",
    player: {x: 38, y: 81, scale: .94},
    focus: {
      label: {en: "Root Trail", es: "Rastro de raices"},
      hint: {en: "Search the tangled path", es: "Registrar el sendero enredado"},
      x: 55,
      y: 57,
      width: 31,
      height: 32,
      glow: "stone",
      target: {x: 54, y: 77, scale: .96}
    },
    effects: [effect("forest-trail-fog", "smoke", 56, 55, 48, 34, "ash", .28)]
  }),
  roadStopScene({
    id: "ridge_path",
    asset: ROAD_STOP_SCENE_ASSETS.ridgePathV71,
    sceneClass: "road-stop-scene-ridge-path-v71",
    player: {x: 40, y: 82, scale: .93},
    focus: {
      label: {en: "Ridge Cairn", es: "Mojon de cresta"},
      hint: {en: "Inspect the narrow ridge", es: "Inspeccionar la cresta estrecha"},
      x: 56,
      y: 55,
      width: 27,
      height: 32,
      glow: "stone",
      target: {x: 55, y: 76, scale: .94}
    },
    effects: [effect("ridge-wind", "smoke", 58, 54, 46, 28, "ash", .18)]
  })
];

export const WORLD_SCENES = Object.fromEntries(WORLD_SCENE_LIST.map(scene=>[scene.locationId, scene]));
export const ROAD_STOP_SCENES = Object.fromEntries(ROAD_STOP_SCENE_LIST.map(scene=>[scene.locationId, scene]));

export function resolveWorldScene(location){
  const id = typeof location === "string" ? location : location?.id;
  return WORLD_SCENES[id] || null;
}

export function resolveRoadStopScene(node){
  const id = typeof node === "string" ? node : node?.id;
  return ROAD_STOP_SCENES[id] || null;
}

export function hasWorldScene(location){
  return !!resolveWorldScene(location);
}

export function hasRoadStopScene(node){
  return !!resolveRoadStopScene(node);
}

export function worldSceneAction(scene, actionId){
  if(!scene || !actionId)return null;
  return scene.actions.find(action => action.id === actionId || action.service === actionId || action.kind === actionId) || null;
}

export function availableWorldSceneActions(scene, services = []){
  if(!scene)return [];
  const serviceSet = new Set(services);
  return scene.actions.filter(action => {
    if(action.kind === "townCenter")return true;
    if(action.kind === "openMap" || action.kind === "scoutNearby" || action.kind === "huntNearby")return true;
    return !!action.service && serviceSet.has(action.service);
  });
}

export function availableRoadStopSceneActions(scene, place){
  if(!scene)return [];
  return scene.actions.filter(action => {
    if(action.kind === "continueJourney")return !!place?.canContinueJourney;
    if(action.kind === "inspectRoadStop")return !!place?.canInspectArea;
    if(action.kind === "turnBackJourney")return !!place?.canTurnBack;
    if(action.kind === "openMap")return true;
    return false;
  });
}
