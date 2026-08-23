export const SERVICE_LABELS = {
  tavern: "Tavern",
  market: "Market",
  inn: "Inn",
  blacksmith: "Blacksmith",
  townCenter: "Town Center"
};

const INTERIOR_ART = {
  tavern: "assets/interiors/generated/tavern-interior-v20.png",
  market: "assets/interiors/generated/market-square-v20.png",
  inn: "assets/interiors/generated/inn-common-room-v20.png",
  blacksmith: "assets/interiors/generated/blacksmith-forge-v20.png",
  townCenter: "assets/interiors/generated/town-center-v20.png"
};

const SERVICE_CONFIG = {
  tavern: {
    mood: "smoke",
    entry: {
      normal: "You push open the tavern door. Smoke, old ale, and frightened whispers fill the room.",
      dangerous: "The tavern hushes as you enter. Hands drift toward knives beneath the tables.",
      burned: "Char marks climb the tavern beams. Survivors drink quietly where music should be."
    },
    anchors: [
      {id: "barkeep", type: "npc", interactionType: "service", npcCategory: "innkeeper", name: "Barkeep", x: 24, y: 58, scale: 1.02, depth: 4, pose: "cleaning", presenceClass: "presence-warm", hoverLabel: "Speak with the barkeep", line: "Keep your voice low. News travels faster than blades in here.", actions: ["rumor", "serviceMenu"]},
      {id: "gambling_table", type: "object", interactionType: "table", name: "Dice Table", x: 72, y: 68, scale: .94, depth: 3, pose: "lit", presenceClass: "presence-candle", hoverLabel: "Inspect the dice table", line: "A scarred table waits under candle smoke.", actions: ["gamble"]},
      {id: "suspicious_stranger", type: "event", interactionType: "npc", npcCategory: "traveler", name: "Stranger", x: 56, y: 48, scale: .98, depth: 4, pose: "watching", presenceClass: "presence-shadow", hoverLabel: "Watch the stranger", line: "A hooded stranger watches the door, counting exits.", actions: ["investigate"]},
      {id: "tavern_guest", type: "npc", interactionType: "npc", npcCategory: "tavernGuest", name: "Tavern Guest", x: 83, y: 58, scale: .86, depth: 3, pose: "resting", presenceClass: "presence-warm", hoverLabel: "Listen to the guest", line: "A road-worn guest warms both hands around a chipped cup.", actions: ["rumor"]}
    ],
    effects: [
      {id: "tavern-hearth-glow", type: "fire-flicker", x: 18, y: 69, width: 22, height: 24, intensity: .78, depth: 2, duration: 3.8, opacity: .46, className: "ambient-warm"},
      {id: "tavern-candle-glow", type: "candle-glow", x: 58, y: 43, width: 18, height: 14, intensity: .52, depth: 3, duration: 4.8, opacity: .34, className: "ambient-gold"},
      {id: "tavern-smoke-drift", type: "smoke-drift", x: 50, y: 37, width: 74, height: 46, intensity: .46, depth: 3, duration: 18, opacity: .22, className: "ambient-smoke"},
      {id: "tavern-dust-motes", type: "dust-motes", x: 61, y: 52, width: 64, height: 46, intensity: .36, depth: 3, duration: 16, opacity: .18}
    ]
  },
  market: {
    mood: "crowd",
    entry: {
      normal: "The market square groans under muddy carts, shouting traders, and wary guards.",
      dangerous: "The market still moves, but every bargain sounds like a warning.",
      plague: "The market reeks of vinegar and fear. Stalls stand half-shuttered."
    },
    anchors: [
      {id: "merchant", type: "npc", interactionType: "service", npcCategory: "merchant", name: "Merchant", x: 28, y: 58, scale: 1.02, depth: 4, pose: "haggling", presenceClass: "presence-warm", hoverLabel: "Trade with the merchant", line: "Coin is still coin, even in a dying empire.", actions: ["serviceMenu"]},
      {id: "market_stall", type: "object", interactionType: "service", name: "Market Stall", x: 43, y: 66, scale: .96, depth: 3, pose: "stocked", presenceClass: "presence-gold", hoverLabel: "Browse the stall", line: "Bundles of travel goods are stacked beneath patched canvas.", actions: ["serviceMenu", "buyFood"]},
      {id: "supply_crates", type: "object", interactionType: "cache", name: "Supply Crates", x: 56, y: 72, scale: .9, depth: 2, pose: "stacked", presenceClass: "presence-stone", hoverLabel: "Check the food crates", line: "The crates smell of grain, wet rope, and guarded inventory.", actions: ["buyFood", "rumor"]},
      {id: "market_guard", type: "npc", interactionType: "guard", npcCategory: "guard", name: "Market Guard", x: 64, y: 52, scale: 1, depth: 4, pose: "patrolling", presenceClass: "presence-steel", hoverLabel: "Speak with the guard", line: "The guard watches hands more than faces.", actions: ["rumor"]},
      {id: "market_thief", type: "event", interactionType: "threat", name: "Cutpurse", x: 74, y: 56, scale: .86, depth: 5, pose: "moving", presenceClass: "presence-shadow", hoverLabel: "React to the cutpurse", line: "A quick hand flashes near your coin pouch.", actions: ["chaseThief"]},
      {id: "notice_board", type: "object", interactionType: "notice", name: "Notice Board", x: 84, y: 42, scale: .9, depth: 3, pose: "weathered", presenceClass: "presence-candle", hoverLabel: "Read the market notices", line: "Old notices curl under wet nails.", actions: ["rumor"]},
      {id: "crate_carrier", type: "npc", interactionType: "npc", npcCategory: "merchant", name: "Crate Carrier", x: 36, y: 72, scale: .82, depth: 4, pose: "carrying", presenceClass: "presence-stone", hoverLabel: "Ask about deliveries", line: "A porter shifts a crate from one aching shoulder to the other.", actions: ["rumor"]}
    ],
    effects: [
      {id: "market-dust", type: "dust-motes", x: 49, y: 56, width: 78, height: 54, intensity: .44, depth: 3, duration: 20, opacity: .2, className: "ambient-dust"},
      {id: "market-cloth-sway", type: "cloth-sway", x: 43, y: 31, width: 30, height: 16, intensity: .34, depth: 3, duration: 7.5, opacity: .34, className: "ambient-cloth"},
      {id: "market-lantern-pulse", type: "light-pulse", x: 71, y: 43, width: 20, height: 16, intensity: .3, depth: 3, duration: 6.2, opacity: .2, className: "ambient-gold"}
    ]
  },
  inn: {
    mood: "hearth",
    entry: {
      normal: "The inn smells of wet wool, cheap stew, and travelers trying not to be noticed.",
      dangerous: "The innkeeper bolts the door behind you. No one here sleeps deeply.",
      plague: "The inn is too quiet. A covered cough comes from the upper room."
    },
    anchors: [
      {id: "innkeeper", type: "npc", interactionType: "service", npcCategory: "innkeeper", name: "Innkeeper", x: 30, y: 58, scale: 1.02, depth: 4, pose: "cleaning", presenceClass: "presence-warm", hoverLabel: "Ask for a room", line: "A clean bed costs extra when the roads are full of ghosts.", actions: ["serviceMenu", "rest", "camp"]},
      {id: "guest_table", type: "object", interactionType: "table", name: "Guest Table", x: 64, y: 62, scale: .94, depth: 3, pose: "occupied", presenceClass: "presence-candle", hoverLabel: "Listen at the guest table", line: "Travelers bend over bowls of stew and road-worn maps.", actions: ["rumor"]},
      {id: "traveler", type: "npc", interactionType: "npc", npcCategory: "traveler", name: "Road Traveler", x: 72, y: 56, scale: .96, depth: 4, pose: "resting", presenceClass: "presence-shadow", hoverLabel: "Speak with the traveler", line: "I saw lanterns moving where no patrol should be.", actions: ["rumor"]},
      {id: "hearth", type: "object", interactionType: "hearth", name: "Hearth", x: 49, y: 75, scale: 1, depth: 2, pose: "burning", presenceClass: "presence-ember", hoverLabel: "Warm yourself by the hearth", line: "Warmth gathers around the stones.", actions: ["camp", "rest"]},
      {id: "rented_room", type: "object", interactionType: "service", name: "Rented Room", x: 84, y: 43, scale: .9, depth: 3, pose: "quiet", presenceClass: "presence-warm", hoverLabel: "Take the rented room", line: "A narrow stair leads toward closed doors and thin blankets.", actions: ["rest"]},
      {id: "rent_board", type: "object", interactionType: "notice", name: "Rent Board", x: 18, y: 43, scale: .86, depth: 3, pose: "posted", presenceClass: "presence-candle", hoverLabel: "Read room prices", line: "Room prices and road warnings are scratched into a dark board.", actions: ["serviceMenu"]}
    ],
    effects: [
      {id: "inn-hearth-glow", type: "fire-flicker", x: 49, y: 73, width: 28, height: 24, intensity: .62, depth: 2, duration: 4.2, opacity: .38, className: "ambient-warm"},
      {id: "inn-candle-glow", type: "candle-glow", x: 34, y: 42, width: 18, height: 14, intensity: .38, depth: 3, duration: 5.4, opacity: .24, className: "ambient-gold"},
      {id: "inn-sleepy-drift", type: "smoke-drift", x: 56, y: 47, width: 62, height: 38, intensity: .32, depth: 3, duration: 22, opacity: .15, className: "ambient-smoke"}
    ]
  },
  blacksmith: {
    mood: "ember",
    entry: {
      normal: "The forge glows red in the gloom. Hammer strikes echo like war drums.",
      dangerous: "The smith keeps a blade near the anvil. Not every customer pays in coin.",
      burned: "The forge survives by stubborn heat. Soot hides old damage in the stone."
    },
    anchors: [
      {id: "smith", type: "npc", interactionType: "service", npcCategory: "blacksmith", name: "Blacksmith", x: 30, y: 56, scale: 1.04, depth: 4, pose: "hammering", presenceClass: "presence-ember", hoverLabel: "Speak with the smith", line: "Bring ore, gold, and something worth saving.", actions: ["serviceMenu"]},
      {id: "forge", type: "object", interactionType: "service", name: "Forge", x: 44, y: 50, scale: 1, depth: 2, pose: "glowing", presenceClass: "presence-ember", hoverLabel: "Work at the forge", line: "Coals breathe red beneath a hood of soot-black stone.", actions: ["serviceMenu"]},
      {id: "anvil", type: "object", interactionType: "service", name: "Anvil", x: 56, y: 68, scale: .96, depth: 3, pose: "scarred", presenceClass: "presence-steel", hoverLabel: "Inspect the anvil", line: "The anvil is scarred by old repairs.", actions: ["serviceMenu"]},
      {id: "weapon_rack", type: "object", interactionType: "service", name: "Weapon Rack", x: 75, y: 48, scale: .92, depth: 3, pose: "stocked", presenceClass: "presence-steel", hoverLabel: "Inspect the weapon rack", line: "Battered steel waits for a better owner.", actions: ["serviceMenu", "rumor"]},
      {id: "armor_stand", type: "object", interactionType: "service", name: "Armor Stand", x: 84, y: 66, scale: .94, depth: 3, pose: "displayed", presenceClass: "presence-steel", hoverLabel: "Inspect the armor stand", line: "A repaired cuirass catches the forge light along old dents.", actions: ["serviceMenu"]}
    ],
    effects: [
      {id: "blacksmith-forge-glow", type: "forge-glow", x: 43, y: 50, width: 30, height: 28, intensity: .88, depth: 2, duration: 3.2, opacity: .48, className: "ambient-ember"},
      {id: "blacksmith-sparks", type: "sparks", x: 48, y: 50, width: 24, height: 20, intensity: .64, depth: 4, duration: 2.8, opacity: .42, className: "ambient-sparks"},
      {id: "blacksmith-smoke", type: "smoke-drift", x: 47, y: 34, width: 48, height: 38, intensity: .42, depth: 3, duration: 16, opacity: .2, className: "ambient-smoke"},
      {id: "blacksmith-anvil-ground", type: "shadow-grounding", x: 56, y: 72, width: 24, height: 8, intensity: .34, depth: 2, duration: 9, opacity: .24}
    ]
  },
  townCenter: {
    mood: "stone",
    entry: {
      normal: "You step into the settlement square. Torches burn beside cracked imperial stone.",
      dangerous: "The square is tense. Guards watch the alleys more than the road.",
      burned: "Ash gathers along the square stones. People speak in the low tones of survivors."
    },
    anchors: [
      {id: "steward", type: "npc", interactionType: "service", name: "Steward", x: 23, y: 58, scale: 1, depth: 4, pose: "recording", presenceClass: "presence-gold", hoverLabel: "Speak with the steward", line: "Names, debts, and losses fill the steward's cracked ledger.", actions: ["townLedger", "rumor"]},
      {id: "notice_board", type: "object", interactionType: "notice", name: "Notice Board", x: 43, y: 54, scale: .92, depth: 3, pose: "posted", presenceClass: "presence-candle", hoverLabel: "Read civic notices", line: "Requests, warnings, and wanted marks fight for space.", actions: ["townNotice", "rumor"]},
      {id: "fountain_statue", type: "object", interactionType: "landmark", name: "Old Statue", x: 56, y: 63, scale: 1, depth: 2, pose: "weathered", presenceClass: "presence-stone", hoverLabel: "Inspect the square monument", line: "An imperial statue watches the square with a broken face.", actions: ["rumor"]},
      {id: "guard_captain", type: "npc", interactionType: "guard", npcCategory: "guard", name: "Guard Captain", x: 70, y: 54, scale: 1.02, depth: 4, pose: "commanding", presenceClass: "presence-steel", hoverLabel: "Speak with the guard captain", line: "If you mean to help, start by staying alive.", actions: ["rumor"]},
      {id: "town_ledger", type: "object", interactionType: "ledger", name: "Town Ledger", x: 81, y: 44, scale: .88, depth: 3, pose: "open", presenceClass: "presence-gold", hoverLabel: "Inspect the town ledger", line: "The ledger lists stores, debts, missing patrols, and names crossed out in ash ink.", actions: ["townLedger"]},
      {id: "refugees", type: "event", interactionType: "crowd", name: "Refugees", x: 72, y: 66, scale: .96, depth: 3, pose: "huddled", presenceClass: "presence-warm", hoverLabel: "Aid the refugees", line: "A small group huddles around a brazier.", actions: ["aidRefugees"]}
    ],
    effects: [
      {id: "town-torch-left", type: "torch-glow", x: 19, y: 45, width: 20, height: 22, intensity: .46, depth: 3, duration: 4.2, opacity: .26, className: "ambient-gold"},
      {id: "town-torch-right", type: "torch-glow", x: 78, y: 47, width: 20, height: 22, intensity: .4, depth: 3, duration: 4.8, opacity: .24, className: "ambient-gold"},
      {id: "town-banner-sway", type: "cloth-sway", x: 43, y: 35, width: 24, height: 20, intensity: .28, depth: 3, duration: 8.2, opacity: .28, className: "ambient-cloth"},
      {id: "town-square-dust", type: "dust-motes", x: 58, y: 58, width: 68, height: 42, intensity: .26, depth: 3, duration: 24, opacity: .14, className: "ambient-dust"}
    ]
  }
};

export function serviceLabel(service){
  return SERVICE_LABELS[service] || service;
}

export function serviceArt(service){
  return INTERIOR_ART[service] || INTERIOR_ART.townCenter;
}

export function resolveInteriorScene({location, service, worldState, upgradeState, event}){
  const config = SERVICE_CONFIG[service] || SERVICE_CONFIG.townCenter;
  const danger = Number(location?.danger || 0);
  const stage = worldState?.stage || worldState?.type || "";
  const entryKey = stage.includes("plague") ? "plague" : stage.includes("burn") || stage.includes("ruin") ? "burned" : danger >= 3 ? "dangerous" : "normal";
  const anchors = [...config.anchors];
  return {
    service,
    label: serviceLabel(service),
    art: serviceArt(service),
    mood: config.mood,
    upgradeState: upgradeState || "basic",
    stateClass: stage ? `location-state-${stage}` : "location-state-rebuilt",
    entry: config.entry[entryKey] || config.entry.normal,
    event,
    anchors,
    effects: [...(config.effects || [])]
  };
}
