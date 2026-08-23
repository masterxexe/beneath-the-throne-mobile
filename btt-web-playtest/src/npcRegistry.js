export const NPC_LINES = {
  rumor: [
    "Roads are changing. Some are safer. That worries me more.",
    "A rich traveler passed through at dawn with too many guards.",
    "People say the old watchtower burns blue at night."
  ],
  gamble: [
    "The dice are bone, the table is crooked, and everyone knows it.",
    "A quiet crowd watches the next throw."
  ],
  investigate: [
    "A closer look reveals nervous hands and a route toward the back door.",
    "This is not random trouble. Someone expected you."
  ]
};

const NPC_ROOT = "assets/npcs/generated/v80/";

export const NPC_ACTOR_ASSETS = {
  blacksmith:NPC_ROOT+"blacksmith-v80.png",
  marketMerchant:NPC_ROOT+"market_merchant-v80.png",
  innkeeper:NPC_ROOT+"innkeeper-v80.png",
  tavernKeeper:NPC_ROOT+"tavern_keeper-v80.png",
  townClerk:NPC_ROOT+"town_clerk-v80.png",
  slumBeggar:NPC_ROOT+"slum_beggar-v80.png",
  gangLookout:NPC_ROOT+"gang_lookout-v80.png",
  healerHerbalist:NPC_ROOT+"healer_herbalist-v80.png",
  caravanTrader:NPC_ROOT+"caravan_trader-v80.png",
  castleGuard:NPC_ROOT+"castle_guard-v80.png",
  companionScout:NPC_ROOT+"companion_scout-v80.png",
  companionMage:NPC_ROOT+"companion_mage-v80.png"
};

export const SERVICE_NPCS = {
  market:{
    name:"Seda Vell",
    role:"Market Provisioner",
    asset:NPC_ACTOR_ASSETS.marketMerchant,
    tone:"market",
    dx:-8,
    dy:13,
    scale:.9,
    line:"Fresh bread, lamp oil, road salt. Pay before touching."
  },
  blacksmith:{
    name:"Borin Ashhand",
    role:"Blacksmith",
    asset:NPC_ACTOR_ASSETS.blacksmith,
    tone:"ember",
    dx:9,
    dy:12,
    scale:.92,
    line:"Steel remembers every poor choice. Bring coin, not excuses."
  },
  inn:{
    name:"Nessa Hearth",
    role:"Innkeeper",
    asset:NPC_ACTOR_ASSETS.innkeeper,
    tone:"hearth",
    dx:-7,
    dy:11,
    scale:.82,
    line:"A locked door is worth more than a soft bed."
  },
  tavern:{
    name:"Vale the Tapkeep",
    role:"Tavern Keeper",
    asset:NPC_ACTOR_ASSETS.tavernKeeper,
    tone:"lantern",
    dx:-8,
    dy:14,
    scale:.84,
    line:"Rumors are cheaper before the third cup."
  },
  townCenter:{
    name:"Clerk Orlen",
    role:"Notice Clerk",
    asset:NPC_ACTOR_ASSETS.townClerk,
    tone:"stone",
    dx:9,
    dy:13,
    scale:.78,
    line:"Names, debts, gate passes. The city climbs on paper."
  }
};

export const AMBIENT_WORLD_NPCS = {
  ashen_keep:[
    {
      id:"ashen-keep-gate-guard",
      service:"gateGuard",
      name:"Ser Varric",
      role:"Castle Guard",
      asset:NPC_ACTOR_ASSETS.castleGuard,
      tone:"stone",
      x:15,
      y:82,
      scale:.78,
      z:8,
      line:"Gate orders change by the hour. Keep your papers ready."
    },
    {
      id:"ashen-keep-slum-rumor",
      service:"slumRumor",
      name:"Old Rusk",
      role:"Slum Beggar",
      asset:NPC_ACTOR_ASSETS.slumBeggar,
      tone:"hearth",
      x:43,
      y:84,
      scale:.72,
      z:11,
      line:"Spare a coin and I will tell you which alley still has teeth."
    }
  ],
  market_town:[
    {
      id:"market-town-caravan",
      service:"caravanTrader",
      name:"Dovren Pike",
      role:"Caravan Trader",
      asset:NPC_ACTOR_ASSETS.caravanTrader,
      tone:"market",
      x:14,
      y:80,
      scale:.76,
      z:8,
      line:"Road prices are honest. Road risks are not."
    },
    {
      id:"market-town-healer",
      service:"healer",
      name:"Mira Greenhand",
      role:"Healer Herbalist",
      asset:NPC_ACTOR_ASSETS.healerHerbalist,
      tone:"hearth",
      x:55,
      y:82,
      scale:.72,
      z:12,
      line:"Bitter leaves for fever, clean thread for cuts."
    },
    {
      id:"market-town-watch",
      service:"townWatch",
      name:"Ser Varric",
      role:"Castle Guard",
      asset:NPC_ACTOR_ASSETS.castleGuard,
      tone:"stone",
      x:88,
      y:80,
      scale:.74,
      z:9,
      line:"Keep moving unless you are buying."
    }
  ],
  old_road:[
    {
      id:"old-road-caravan",
      service:"roadTrader",
      name:"Dovren Pike",
      role:"Caravan Trader",
      asset:NPC_ACTOR_ASSETS.caravanTrader,
      tone:"market",
      x:33,
      y:81,
      scale:.76,
      z:9,
      line:"A wagon is a purse everyone can see."
    }
  ],
  forest_edge:[
    {
      id:"forest-edge-scout",
      service:"companionScout",
      name:"Mira of the Drainsteps",
      role:"Companion Scout",
      asset:NPC_ACTOR_ASSETS.companionScout,
      tone:"stone",
      x:63,
      y:82,
      scale:.74,
      z:10,
      line:"The brush is quiet. Too quiet to trust."
    }
  ],
  ruined_watchtower:[
    {
      id:"watchtower-gang-lookout",
      service:"gangLookout",
      name:"Knife-Eye Ren",
      role:"Gang Lookout",
      asset:NPC_ACTOR_ASSETS.gangLookout,
      tone:"ember",
      x:68,
      y:79,
      scale:.74,
      z:10,
      line:"Wrong tower, wrong hour."
    }
  ],
  ashen_fields:[
    {
      id:"ashen-fields-mage",
      service:"companionMage",
      name:"Ilyra Ashwake",
      role:"Companion Mage",
      asset:NPC_ACTOR_ASSETS.companionMage,
      tone:"lantern",
      x:56,
      y:82,
      scale:.72,
      z:10,
      line:"Ash remembers fire. Fire remembers debt."
    }
  ]
};

export function npcLine(kind, seed = 0){
  const lines = NPC_LINES[kind] || NPC_LINES.rumor;
  return lines[Math.abs(seed) % lines.length];
}

function clamp(n,min,max){
  return Math.max(min,Math.min(max,n));
}

export function npcsForWorldScene(scene, actions = [], services = []){
  const serviceSet = new Set(services);
  const serviceNpcs = actions
    .filter(action=>{
      const key = action?.service || action?.kind || "";
      return SERVICE_NPCS[key] && (serviceSet.has(key) || action?.kind === "townCenter");
    })
    .map((action,index)=>{
      const key = action.service || action.kind;
      const npc = SERVICE_NPCS[key];
      const x = clamp((Number(action.x) || 50) + npc.dx,8,92);
      const y = clamp((Number(action.y) || 50) + npc.dy,42,88);
      return {
        ...npc,
        id:`${scene?.locationId || "world"}-${action.id || action.service}-npc`,
        service:key,
        actionId:action.id,
        x,
        y,
        z:10 + index,
        label:`${npc.name}, ${npc.role}`
      };
    });
  const ambientNpcs = (AMBIENT_WORLD_NPCS[scene?.locationId] || [])
    .map((npc,index)=>({
      ...npc,
      id:npc.id || `${scene?.locationId || "world"}-ambient-${index}`,
      x:clamp(Number(npc.x) || 50,8,92),
      y:clamp(Number(npc.y) || 50,42,88),
      z:npc.z ?? (6 + index),
      label:`${npc.name}, ${npc.role}`
    }));
  return [...ambientNpcs, ...serviceNpcs];
}
