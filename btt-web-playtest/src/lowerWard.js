import { ADVANCED_CLASSES, CLASSES, advanceDays, clamp, companionTrainingNeed, ensureLowerWardState, grantCompanionBond, normalizeCompanion, rnd, save, state } from "./state.js";
import { title, tx } from "./language.js";
import { closeModals, esc, modal, toast, updateTop } from "./ui.js";
import { learnClassPathAbilities } from "./progression.js";
import { NPC_ACTOR_ASSETS } from "./npcRegistry.js";
import { startBattle } from "./combat.js";

const TRAINER_NPCS = {
  vanguard:{name:"Captain Rusk",place:"Shield Yard"},
  berserker:{name:"Maul Edda",place:"Butcher Stair"},
  shadowblade:{name:"No-Name Sable",place:"Rain Arcade"},
  duelist:{name:"Ser Vey",place:"Duelist Gallery"},
  pyromancer:{name:"Cinder Matron",place:"Char House"},
  arcanist:{name:"Master Ell",place:"Blue Seal Room"},
  warden:{name:"Old Brann",place:"Root Market"},
  marksman:{name:"Arrow Saint Lio",place:"Bell Roof"},
  templar:{name:"Dame Corva",place:"Candle Chapel"},
  oracle:{name:"Sister Marr",place:"Quiet Window"}
};

const LOWER_WARD_COMPANION_ID = "lower_ward_garran";

const LOWER_WARD_QUESTS = [
  {
    id:"enter_ward",
    name:"Step Above Cinderhook",
    desc:"Enter the Lower Ward and establish your first clean line in the city ledger.",
    check:gameState=>!!readLowerWard(gameState).entered,
    action:"FE.enterLowerWard()",
    actionLabel:"Enter Ward",
    reward:{influence:1,gold:4}
  },
  {
    id:"first_commission",
    name:"Stamp Work",
    desc:"Complete one ward commission for Orlen Voss.",
    check:gameState=>Number(readLowerWard(gameState).commissions || 0) >= 1,
    action:"FE.lowerWardTalk('clerk')",
    actionLabel:"Meet Clerk",
    reward:{influence:1,gold:6}
  },
  {
    id:"train_path",
    name:"Take a Ward Name",
    desc:"Train or change into one advanced class path.",
    check:gameState=>activePathIds(gameState).some(id=>gameState?.hero?.unlockedClasses?.includes(id)),
    action:"FE.lowerWardOpenTrainers()",
    actionLabel:"Open Trainers",
    reward:{influence:1,gold:5}
  },
  {
    id:"recruit_garran",
    name:"A Shield in the Crowd",
    desc:"Recruit Old Garran, a Lower Ward guard companion.",
    check:gameState=>hasLowerWardCompanion(gameState),
    action:"FE.lowerWardTalk('companion')",
    actionLabel:"Meet Garran",
    reward:{influence:2,gold:4}
  },
  {
    id:"clear_tax_vault",
    name:"Break the Tax Vault",
    desc:"Clear the Tax Vault Break-In hard district once.",
    check:gameState=>Number(gameState?.world?.hardAreas?.clears?.lower_ward_tax_vault || 0) >= 1,
    action:"FE.lowerWardFocusHardAreas()",
    actionLabel:"Hard Districts",
    reward:{influence:2,writs:1,gold:8}
  },
  {
    id:"ward_foothold",
    name:"Ward Foothold",
    desc:"Reach 10 influence and hold 3 writs for the next social rung.",
    check:gameState=>Number(readLowerWard(gameState).influence || 0) >= 10 && Number(readLowerWard(gameState).writs || 0) >= 3,
    action:"FE.lowerWardTalk('clerk')",
    actionLabel:"Review Ledger",
    reward:{influence:3,gold:12}
  }
];

const WARD_COMMISSIONS = [
  {id:"stamp_run", nameKey:"commissionStampRun", descKey:"commissionStampRunDesc", kind:"work", gold:[5,8], influence:1},
  {id:"alley_writ", nameKey:"commissionAlleyWrit", descKey:"commissionAlleyWritDesc", kind:"combat", enemy:{name:"Tax Knife",role:"ward",enemyVisualClass:"bandit",level:3,hp:88,maxHp:88,attack:13,defense:4,speed:5,xp:48,gold:8}},
  {id:"bell_watch", nameKey:"commissionBellWatch", descKey:"commissionBellWatchDesc", kind:"combat", enemy:{name:"Ward Bailiff",role:"ward",enemyVisualClass:"bandit",level:4,hp:102,maxHp:102,attack:14,defense:6,speed:4,xp:54,gold:9}},
  {id:"candle_errand", nameKey:"commissionCandleErrand", descKey:"commissionCandleErrandDesc", kind:"work", gold:[6,10], influence:1, writ:true}
];

const LOWER_WARD_CONTACTS = [
  {
    id:"clerk",
    name:"Orlen Voss",
    role:"Writ Clerk",
    asset:NPC_ACTOR_ASSETS.townClerk,
    label:"Commissions",
    x:17,
    y:58
  },
  {
    id:"trainer",
    name:"Ward Trainer",
    role:"Class Yard",
    asset:NPC_ACTOR_ASSETS.castleGuard,
    label:"Class paths",
    x:44,
    y:50
  },
  {
    id:"companion",
    name:"Old Garran",
    role:"Companion Guard",
    asset:NPC_ACTOR_ASSETS.castleGuard,
    label:"Recruit",
    x:68,
    y:61
  },
  {
    id:"bailiff",
    name:"Bell Bailiff",
    role:"Hard Districts",
    asset:NPC_ACTOR_ASSETS.gangLookout,
    label:"Dangers",
    x:86,
    y:54
  }
];

const LOWER_WARD_BUILDINGS = [
  {id:"writ_office",name:"Writ Office",tag:"Influence",desc:"Clerks sell permission through commissions, bribes, and stamped favors.",action:"FE.lowerWardTalk('clerk')",label:"Meet Clerk"},
  {id:"trainer_yard",name:"Trainer Yard",tag:"Classes",desc:"Ward masters teach the first advanced class paths after Cinderhook.",action:"FE.lowerWardOpenTrainers()",label:"Train"},
  {id:"bell_tower",name:"Bell Tower",tag:"Hard Area",desc:"Bailiffs, duelists, and rope crews guard the climb toward noble streets.",action:"FE.lowerWardFocusHardAreas()",label:"Hard Districts"},
  {id:"candle_court",name:"Candle Court",tag:"Nobles",desc:"Polished masks buy rough violence before it reaches the ballroom.",action:"FE.lowerWardTalk('bailiff')",label:"Hear Rumors"}
];

function lowerWardOpen(){
  return !!state?.prologue?.lowerWardGate?.unlocked;
}

function ward(){
  return ensureLowerWardState();
}

function readLowerWard(gameState = state){
  const value = gameState?.world?.lowerWard;
  return value && typeof value === "object" ? value : {};
}

function activePathIds(gameState = state){
  const base = gameState?.hero?.class || "warrior";
  return Object.entries(ADVANCED_CLASSES)
    .filter(([,path])=>path.baseClass === base)
    .map(([id])=>id);
}

function className(id){
  return ADVANCED_CLASSES[id]?.name || CLASSES[id]?.name || title(id);
}

function hasLowerWardCompanion(gameState = state){
  return (gameState?.hero?.companions || []).some(companion=>companion.id === LOWER_WARD_COMPANION_ID);
}

function makeGarran(){
  return {
    id:LOWER_WARD_COMPANION_ID,
    name:"Old Garran Bellrow",
    rarity:"uncommon",
    class:"guard",
    role:"guard",
    tactic:"guardian",
    level:2,
    xp:0,
    nextXp:170,
    hp:126,
    maxHp:126,
    mana:16,
    maxMana:16,
    attack:11,
    defense:9,
    speed:4,
    active:true,
    bond:{level:1,xp:10},
    training:{rank:1,xp:0},
    loyalty:62,
    morale:58,
    known:["guard_wall","shield_bash"],
    abilityLoadout:["guard_wall","shield_bash"]
  };
}

function questClaimed(id){
  return ward().quests?.claimed?.includes(id);
}

function questComplete(quest,gameState = state){
  try{
    return !!quest.check(gameState);
  }catch(error){
    return false;
  }
}

function questRewardLine(reward = {}){
  const parts = [];
  if(reward.gold)parts.push(`${reward.gold}g`);
  if(reward.influence)parts.push(`+${reward.influence} influence`);
  if(reward.writs)parts.push(`+${reward.writs} writ`);
  return parts.join(" | ");
}

function copiedQuestReward(reward = {}){
  return Object.fromEntries(["gold","influence","writs"]
    .filter(field=>Number.isFinite(Number(reward[field])))
    .map(field=>[field,Number(reward[field])]));
}

export function selectLowerWardQuestLog(gameState = state){
  const w = readLowerWard(gameState);
  const gateUnlocked = !!gameState?.prologue?.lowerWardGate?.unlocked;
  const claimedIds = Array.isArray(w.quests?.claimed) ? w.quests.claimed.filter(id=>typeof id === "string") : [];
  const claimed = new Set(claimedIds);
  const activeQuest = LOWER_WARD_QUESTS.find(quest=>!claimed.has(quest.id)) || null;
  const quests = LOWER_WARD_QUESTS.map((quest,index)=>{
    const objectiveMet = questComplete(quest,gameState);
    const wasClaimed = claimed.has(quest.id);
    let status = "locked";
    if(wasClaimed)status = "completed";
    else if(!gateUnlocked)status = "locked";
    else if(objectiveMet)status = "ready_to_claim";
    else if(activeQuest?.id === quest.id)status = "active";
    return {
      id:quest.id,
      type:"quest",
      sequence_index:index,
      status,
      name:String(quest.name || ""),
      description:String(quest.desc || ""),
      action_label:String(quest.actionLabel || ""),
      reward:copiedQuestReward(quest.reward),
      prerequisite_ids:[],
      objective_met:objectiveMet,
      can_claim:gateUnlocked && objectiveMet && !wasClaimed
    };
  });
  return {
    id:"lower_ward",
    title:tx("wardQuestChain"),
    status:!gateUnlocked ? "locked" : quests.every(quest=>quest.status === "completed") ? "completed" : "active",
    progress:{completed:quests.filter(quest=>quest.status === "completed").length,total:quests.length},
    active_quest_id:activeQuest?.id || null,
    gate_unlocked:gateUnlocked,
    ledger:{
      entered:!!w.entered,
      influence:Number(w.influence || 0),
      writs:Number(w.writs || 0),
      commissions_completed:Number(w.commissions || 0),
      completed_commission_ids:Array.isArray(w.commissionDone) ? w.commissionDone.filter(id=>typeof id === "string") : []
    },
    quests,
    recent_log:Array.isArray(w.log) ? w.log.slice(-12).map(String) : []
  };
}

export function selectLowerWardAvailableActions(gameState = state, placeContext = null){
  const chapter = selectLowerWardQuestLog(gameState);
  const isAtLowerWard = placeContext
    ? placeContext.isTraveling !== true && placeContext.id === "lower_ward"
    : gameState?.world?.locationId === "lower_ward";
  if(!isAtLowerWard || !chapter.gate_unlocked){
    return {id:"lower_ward",applicable:false,actions:[]};
  }
  const actions = [
    {id:"lower_ward.open_trainers",label:tx("wardClassTrainers"),category:"progression",enabled:true,blocked_reason_code:null,parameters:{}},
    {id:"lower_ward.open_commissions",label:tx("wardCommission"),category:"quest",enabled:true,blocked_reason_code:null,parameters:{}},
    {id:"lower_ward.view_hard_districts",label:tx("wardHardDistricts"),category:"combat",enabled:true,blocked_reason_code:null,parameters:{}},
    {id:"lower_ward.open_road_map",label:tx("wardRoadMap"),category:"travel",enabled:true,blocked_reason_code:null,parameters:{}}
  ];
  chapter.quests.filter(quest=>quest.can_claim).forEach(quest=>{
    actions.push({
      id:`lower_ward.claim_quest.${quest.id}`,
      label:`${tx("continue")}: ${quest.name}`,
      category:"quest",
      enabled:true,
      blocked_reason_code:null,
      parameters:{quest_id:quest.id}
    });
  });
  return {id:"lower_ward",applicable:true,actions};
}

function lowerWardQuestChainHTML(){
  const claimed = ward().quests?.claimed || [];
  const completeCount = LOWER_WARD_QUESTS.filter(quest=>claimed.includes(quest.id)).length;
  const nextOpen = LOWER_WARD_QUESTS.find(quest=>!claimed.includes(quest.id));
  return `
    <details class="lower-ward-drawer lower-ward-quest-drawer" ${completeCount < LOWER_WARD_QUESTS.length ? "open" : ""}>
      <summary>${esc(tx("wardQuestChain"))} ${completeCount}/${LOWER_WARD_QUESTS.length}</summary>
      <div class="lower-ward-quest-list">
        ${LOWER_WARD_QUESTS.map(quest=>{
          const done = questComplete(quest);
          const wasClaimed = claimed.includes(quest.id);
          const active = nextOpen?.id === quest.id;
          return `
            <div class="lower-ward-quest ${wasClaimed ? "is-claimed" : done ? "is-ready" : active ? "is-active" : ""}">
              <div>
                <span class="pill ${wasClaimed ? "good" : done ? "warn" : active ? "good" : ""}">${wasClaimed ? "Claimed" : done ? "Ready" : active ? "Current" : "Locked"}</span>
                <span class="pill">${esc(questRewardLine(quest.reward))}</span>
              </div>
              <h3>${esc(quest.name)}</h3>
              <p>${esc(quest.desc)}</p>
              <div class="grid2">
                <button class="primary" ${done && !wasClaimed ? "" : "disabled"} onclick="FE.lowerWardClaimQuest('${esc(quest.id)}')">Claim</button>
                <button class="secondary" ${wasClaimed ? "disabled" : ""} onclick="${esc(quest.action)}">${esc(quest.actionLabel)}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function activeCompanions(){
  return (state.hero?.companions || []).filter(companion=>companion.active && companion.hp > 0);
}

function grantWardCompanionTraining(companion,xp){
  normalizeCompanion(companion);
  companion.training.xp += Math.max(0,Math.floor(Number(xp) || 0));
  let ranks = 0;
  while(companion.training.rank < 20 && companion.training.xp >= companionTrainingNeed(companion.training.rank)){
    companion.training.xp -= companionTrainingNeed(companion.training.rank);
    companion.training.rank++;
    companion.maxHp += 4;
    companion.hp = companion.maxHp;
    companion.attack += companion.role === "healer" ? 1 : 2;
    companion.defense += companion.role === "guard" ? 2 : 1;
    ranks++;
  }
  return ranks;
}

function lowerWardContactHTML(contact){
  return `
    <button class="lower-ward-npc lower-ward-npc-${esc(contact.id)}" style="--npc-x:${esc(contact.x)}%;--npc-y:${esc(contact.y)}%;" onclick="FE.lowerWardTalk('${esc(contact.id)}')">
      <img class="btt-npc-idle" src="${esc(contact.asset)}" alt="" loading="lazy" decoding="async" draggable="false">
      <span>${esc(contact.role)}</span>
      <b>${esc(contact.name)}</b>
      <small>${esc(contact.label)}</small>
    </button>
  `;
}

function lowerWardSceneHTML(){
  const w = ward();
  return `
    <div class="lower-ward-scene" aria-label="Lower Ward streets">
      <div class="lower-ward-street-art" aria-hidden="true">
        <span class="lower-ward-skyline"></span>
        <span class="lower-ward-gatehouse"></span>
        <span class="lower-ward-lamps"></span>
        <span class="lower-ward-vignette"></span>
      </div>
      <div class="lower-ward-scene-status">
        <span class="pill good">Ward Ledger</span>
        <span class="pill">Influence ${esc(w.influence)}</span>
        <span class="pill">Writs ${esc(w.writs)}</span>
      </div>
      ${LOWER_WARD_CONTACTS.map(lowerWardContactHTML).join("")}
    </div>
  `;
}

function lowerWardBuildingsHTML(){
  return `
    <div class="lower-ward-building-grid">
      ${LOWER_WARD_BUILDINGS.map(building=>`
        <button class="lower-ward-building-card" onclick="${esc(building.action)}">
          <span class="pill">${esc(building.tag)}</span>
          <b>${esc(building.name)}</b>
          <small>${esc(building.desc)}</small>
          <em>${esc(building.label)}</em>
        </button>
      `).join("")}
    </div>
  `;
}

function trainerCardHTML(id){
  const path = ADVANCED_CLASSES[id];
  if(!path)return "";
  const w = ward();
  const npc = TRAINER_NPCS[id] || {name:"Ward Trainer",place:"Lower Ward"};
  const unlocked = state.hero.unlockedClasses?.includes(id);
  const active = state.hero.advancedClass === id;
  const levelReady = (state.hero.level || 1) >= (path.level || 1);
  const favor = !!w.trainerFavor[id];
  const canTrain = levelReady && !active;
  return `
    <div class="lower-ward-trainer-card ${active ? "is-active" : unlocked ? "is-unlocked" : ""}">
      <div>
        <span class="pill ${active ? "good" : levelReady ? "warn" : "red"}">${active ? "Active" : unlocked ? "Unlocked" : levelReady ? "Ready" : "Locked"}</span>
        ${favor ? `<span class="pill good">Favor earned</span>` : ""}
      </div>
      <h3>${esc(path.name)}</h3>
      <p><b>${esc(npc.name)}</b>, ${esc(npc.place)}</p>
      <p>${esc(path.desc)}</p>
      <div class="lower-ward-meta-row">
        <span class="pill">Requires Lv ${esc(path.level)}</span>
        <span class="pill">${esc(path.role || "Class path")}</span>
        ${(path.abilities || []).map(ability=>`<span class="pill">${esc(title(ability))}</span>`).join("")}
      </div>
      <div class="grid2">
        <button class="${unlocked ? "primary" : ""}" ${canTrain ? "" : "disabled"} onclick="FE.lowerWardTrainClass('${esc(id)}')">${active ? "Active" : unlocked ? "Change Class" : "Train Path"}</button>
        <button class="secondary" onclick="FE.lowerWardTrainerDialogue('${esc(id)}')">Talk</button>
      </div>
    </div>
  `;
}

function trainerSummaryHTML(){
  const pathIds = activePathIds();
  const unlocked = pathIds.filter(id=>state.hero.unlockedClasses?.includes(id)).length;
  return `
    <div class="lower-ward-trainer-summary">
      <span class="pill good">${esc(className(state.hero.class))} Trainers</span>
      <span class="pill">${unlocked}/${pathIds.length} paths learned</span>
      <span class="pill">Lv ${esc(state.hero.level || 1)}</span>
    </div>
  `;
}

function nextOpenQuest(){
  const claimed = ward().quests?.claimed || [];
  return LOWER_WARD_QUESTS.find(quest => !claimed.includes(quest.id));
}

function lowerWardNowHTML(){
  const quest = nextOpenQuest();
  if(!quest)return "";
  const ready = questComplete(quest);
  return `
    <div class="ward-now-banner">
      <span class="pill good">${esc(tx("wardNowKicker"))}</span>
      <h2>${esc(quest.name)}</h2>
      <p>${esc(quest.desc)}</p>
      <button class="${ready ? "primary" : "secondary"}" onclick="${ready ? `FE.lowerWardClaimQuest('${esc(quest.id)}')` : quest.action}">${esc(ready ? tx("continue") : quest.actionLabel)}</button>
    </div>
  `;
}

export function renderLowerWardPanel(){
  const w = ward();
  const pathIds = activePathIds();
  const activeClass = state.hero.advancedClass ? className(state.hero.advancedClass) : className(state.hero.class);
  return `
    <div class="lower-ward-panel">
      <div class="lower-ward-hero">
        <div>
          <span class="pill good">Lower Ward</span>
          <h1>${esc(tx("wardTitle"))}</h1>
          <p>${esc(tx("wardLead"))}</p>
        </div>
        <div class="lower-ward-status">
          <span class="pill good">Class ${esc(activeClass)}</span>
          <span class="pill">Influence ${esc(w.influence)}</span>
          <span class="pill">Writs ${esc(w.writs)}</span>
        </div>
      </div>
      ${lowerWardNowHTML()}
      ${lowerWardSceneHTML()}
      <div class="lower-ward-command-grid">
        <button class="primary lower-ward-command" onclick="FE.lowerWardOpenTrainers()">
          <span>${esc(tx("wardClassTrainers"))}</span>
          <small>${pathIds.map(className).join(" | ")}</small>
        </button>
        <button class="lower-ward-command" onclick="FE.lowerWardCommission()">
          <span>${esc(tx("wardCommission"))}</span>
          <small>${esc(tx("wardCommissionHint"))}</small>
        </button>
        <button class="danger lower-ward-command" onclick="FE.lowerWardFocusHardAreas()">
          <span>${esc(tx("wardHardDistricts"))}</span>
          <small>${esc(tx("wardHardHint"))}</small>
        </button>
        <button class="secondary lower-ward-command" onclick="FE.show('map')">
          <span>${esc(tx("wardRoadMap"))}</span>
          <small>${esc(tx("wardRoadHint"))}</small>
        </button>
      </div>
      ${trainerSummaryHTML()}
      ${lowerWardQuestChainHTML()}
      <details class="lower-ward-drawer">
        <summary>Buildings & Districts</summary>
        ${lowerWardBuildingsHTML()}
      </details>
      <details class="lower-ward-drawer">
        <summary>Ward Ledger</summary>
        <div class="lower-ward-ledger">
          ${w.log.slice(-5).map(line=>`<div class="entry">${esc(line)}</div>`).join("")}
        </div>
      </details>
    </div>
  `;
}

export function lowerWardTalk(id){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  const w = ward();
  if(id === "clerk"){
    modal(tx("wardClerkTitle"), `
      <p>"${esc(tx("wardClerkBody"))}"</p>
      <div class="lower-ward-dialogue-stats">
        <span class="pill">Influence ${esc(w.influence)}</span>
        <span class="pill">Writs ${esc(w.writs)}</span>
        <span class="pill">Commissions ${esc(w.commissions)}</span>
      </div>
    `, [
      {label:tx("wardTakeCommission"),cls:"primary",fn:()=>lowerWardCommission()},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(id === "trainer"){
    const pathIds = activePathIds();
    const primary = pathIds[0];
    const trainer = TRAINER_NPCS[primary] || {name:"Ward Trainer",place:"Class Yard"};
    modal(`${trainer.name}, ${trainer.place}`, `
      <p>"Cinderhook teaches survival. The ward teaches names. Pick a path and carry it properly."</p>
      <p>Available for your ${esc(className(state.hero.class))}: ${pathIds.map(className).map(esc).join(" | ")}.</p>
    `, [
      {label:tx("wardOpenTrainers"),cls:"primary",fn:()=>setTimeout(()=>lowerWardOpenTrainers(),0)},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(id === "companion"){
    const active = activeCompanions();
    const recruited = hasLowerWardCompanion();
    modal("Old Garran Bellrow", `
      <p>${recruited
        ? `"${esc(tx("wardGarranJoined"))}"`
        : `"${esc(tx("wardGarranWait"))}"`}</p>
      ${active.length ? `<p>Active companions: ${active.map(c=>esc(c.name)).join(" | ")}</p>` : "<p>No active companion is ready for signal drills.</p>"}
      <div class="lower-ward-dialogue-stats">
        <span class="pill">${recruited ? "Recruited" : "Cost 8g"}</span>
        <span class="pill">Guard role</span>
        <span class="pill">Guardian tactic</span>
      </div>
    `, [
      {label:recruited ? tx("wardDrillSignals") : tx("wardRecruitGarran"),cls:"primary",fn:()=>recruited ? lowerWardCompanionBriefing() : lowerWardRecruitCompanion()},
      {label:tx("wardDrillSignals"),cls:"secondary",fn:()=>lowerWardCompanionBriefing()},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(id === "bailiff"){
    modal(tx("wardBailiffTitle"), `
      <p>"${esc(tx("wardBailiffBody"))}"</p>
      <p>Hard districts now reward influence, writs, and companion field growth on first clear.</p>
    `, [
      {label:tx("wardShowHard"),cls:"danger",fn:()=>lowerWardFocusHardAreas()},
      {label:tx("close"),cls:"secondary"}
    ]);
  }
}

export function lowerWardClaimQuest(id){
  const quest = LOWER_WARD_QUESTS.find(item=>item.id === id);
  if(!quest)return toast("Quest not found.");
  const w = ward();
  w.quests ||= {claimed:[]};
  w.quests.claimed ||= [];
  if(w.quests.claimed.includes(id))return toast("Quest already claimed.");
  if(!questComplete(quest))return toast("Quest objective is not complete.");
  const reward = quest.reward || {};
  state.hero.gold += reward.gold || 0;
  w.influence = clamp(w.influence + (reward.influence || 0),0,100);
  w.writs += reward.writs || 0;
  w.quests.claimed.push(id);
  w.quests.claimed = [...new Set(w.quests.claimed)];
  const line = `Quest complete: ${quest.name}. ${questRewardLine(reward) || "No reward"}.`;
  w.log.push(line);
  w.log = w.log.slice(-12);
  state.world.story.push(line);
  save();
  updateTop();
  toast(`Claimed: ${quest.name}.`);
  window.FE?.show?.("home");
}

export function lowerWardTrainerDialogue(id){
  const path = ADVANCED_CLASSES[id];
  if(!path)return toast("Trainer not found.");
  const npc = TRAINER_NPCS[id] || {name:"Ward Trainer",place:"Lower Ward"};
  const learned = state.hero.unlockedClasses?.includes(id);
  modal(`${npc.name}, ${npc.place}`, `
    <p>"${esc(path.role || "Discipline")} is not a costume. It changes what your hands reach for when panic starts."</p>
    <p>${esc(path.desc)}</p>
    <div class="lower-ward-meta-row">
      <span class="pill">${learned ? "Already learned" : `Requires Lv ${path.level}`}</span>
      ${(path.abilities || []).map(ability=>`<span class="pill">${esc(title(ability))}</span>`).join("")}
    </div>
  `, [
    {label:learned ? "Change Class" : "Train Path",cls:"primary",fn:()=>lowerWardTrainClass(id)},
    {label:"Close",cls:"secondary"}
  ]);
}

export function enterLowerWard(){
  if(!lowerWardOpen()){
    toast(tx("wardOpenGateFirst"));
    return false;
  }
  const w = ward();
  w.entered = true;
  if(!w.introSeen){
    w.introSeen = true;
    w.influence = Math.max(w.influence,1);
    w.log.push("You step into the Lower Ward with one fresh name and no protection.");
    state.world.story.push("You enter the Lower Ward. The next rung of the climb begins.");
  }
  state.world.previousLocationId = state.world.locationId;
  state.world.locationId = "lower_ward";
  state.world.routeHistory ||= [];
  state.world.routeHistory.push("lower_ward");
  state.world.routeHistory = state.world.routeHistory.slice(-12);
  save();
  updateTop();
  window.FE?.show?.("home");
  return true;
}

export function lowerWardCommission(){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  const w = ward();
  w.commissionDone ||= [];
  const cards = WARD_COMMISSIONS.map(job=>{
    const done = w.commissionDone.includes(job.id);
    return `
      <div class="slum-contract-card ${done ? "is-claimed" : ""}">
        <h3>${esc(tx(job.nameKey))}</h3>
        <p>${esc(tx(job.descKey))}</p>
        <button class="${done ? "secondary" : "primary"}" ${done ? "disabled" : `onclick="FE.lowerWardRunCommission('${job.id}')"`}>${esc(done ? tx("continue") : tx("wardTakeCommission"))}</button>
      </div>
    `;
  }).join("");
  modal(tx("wardBoardTitle"), `<div class="ward-commission-board">${cards}</div>`, [{label:tx("close"),cls:"secondary"}]);
}

export function lowerWardRunCommission(id){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  const job = WARD_COMMISSIONS.find(item=>item.id === id);
  if(!job)return toast("Quest not found.");
  const w = ward();
  w.commissionDone ||= [];
  if(job.kind === "combat"){
    closeModals();
    startBattle([{...job.enemy}], tx(job.descKey), {
      source:"lower-ward",
      onVictory:"wardCommissionWon",
      onDefeat:"home",
      commissionId:job.id,
      locationId:"lower_ward"
    });
    return;
  }
  finishWardCommission(job);
}

function finishWardCommission(job){
  const w = ward();
  w.commissionDone ||= [];
  const pay = Array.isArray(job.gold) ? rnd(job.gold[0], job.gold[1]) : (job.gold || 5);
  state.hero.gold += pay;
  w.influence = clamp(w.influence + (job.influence || 1),0,100);
  w.commissions++;
  if(job.writ || w.commissions % 4 === 0)w.writs++;
  if(!w.commissionDone.includes(job.id))w.commissionDone.push(job.id);
  advanceDays(1);
  const line = `${tx(job.nameKey)}: +${pay} gold, +${job.influence || 1} influence${job.writ || w.commissions % 4 === 0 ? ", +1 writ" : ""}.`;
  w.log.push(line);
  w.log = w.log.slice(-12);
  state.world.story.push(line);
  save();
  updateTop();
  closeModals();
  window.FE?.show?.("home");
}

export function completeWardCommissionFight(meta = {}){
  const job = WARD_COMMISSIONS.find(item=>item.id === (meta.commissionId || ""));
  if(job)finishWardCommission(job);
  else window.FE?.show?.("home");
}

export function lowerWardRecruitCompanion(){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  if(hasLowerWardCompanion())return toast("Garran is already in your party.");
  const cost = 8;
  if(state.hero.gold < cost)return toast(tx("wardNeedGold8"));
  const w = ward();
  state.hero.gold -= cost;
  const garran = makeGarran();
  state.hero.companions ||= [];
  state.hero.companions.push(garran);
  w.recruitedCompanions ||= [];
  w.recruitedCompanions.push(LOWER_WARD_COMPANION_ID);
  w.recruitedCompanions = [...new Set(w.recruitedCompanions)];
  w.influence = clamp(w.influence + 1,0,100);
  const line = "Old Garran Bellrow joins the party as a guard companion.";
  w.log.push(line);
  w.log = w.log.slice(-12);
  state.world.story.push(line);
  save();
  updateTop();
  closeModals();
  toast(tx("wardGarranJoinedToast"));
  window.FE?.show?.("home");
}

export function lowerWardCompanionBriefing(){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  const active = activeCompanions();
  if(!active.length)return toast("No active companion to brief.");
  const cost = 5;
  if(state.hero.gold < cost)return toast("Need 5 gold.");
  const w = ward();
  state.hero.gold -= cost;
  w.companionReports++;
  const reportLines = [];
  active.forEach(companion=>{
    normalizeCompanion(companion);
    const bondLevels = grantCompanionBond(companion,8);
    const trainingRanks = grantWardCompanionTraining(companion,10);
    companion.morale = clamp((companion.morale || 50) + 2,0,100);
    reportLines.push(`${companion.name}${bondLevels ? " bond grew" : ""}${trainingRanks ? " training improved" : ""}`);
  });
  const line = `You drill Lower Ward hand signals with ${active.map(c=>c.name).join(", ")}.`;
  w.log.push(line);
  w.log = w.log.slice(-12);
  state.world.story.push(line);
  if(reportLines.length)state.world.story.push(`Companion report: ${reportLines.join("; ")}.`);
  advanceDays(1);
  save();
  updateTop();
  closeModals();
  window.FE?.show?.("home");
}

export function lowerWardOpenTrainers(){
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  const pathIds = activePathIds();
  modal("Lower Ward Trainers", `
    <div class="lower-ward-trainer-modal">
      <p>Trainers unlock changeable class paths for your current base class. Train once to learn the path, then switch from here or the Progression screen.</p>
      <div class="lower-ward-trainer-grid">
        ${pathIds.map(trainerCardHTML).join("")}
      </div>
    </div>
  `, [
    {label:"Open Progression",cls:"secondary",fn:()=>window.FE.show("progression")},
    {label:"Close",cls:"secondary"}
  ]);
}

export function lowerWardTrainClass(id){
  const path = ADVANCED_CLASSES[id];
  if(!path)return toast("Trainer not found.");
  if(!lowerWardOpen())return toast(tx("wardOpenGateFirst"));
  if(path.baseClass !== state.hero.class)return toast("That trainer does not match your base class.");
  if((state.hero.level || 1) < (path.level || 1))return toast(`Need level ${path.level}.`);
  const w = ward();
  state.hero.unlockedClasses ||= [state.hero.class];
  state.hero.classHistory ||= {};
  const already = state.hero.unlockedClasses.includes(id);
  if(!already){
    state.hero.unlockedClasses.push(id);
    state.hero.unlockedClasses = [...new Set(state.hero.unlockedClasses)];
    state.hero.classHistory[id] = {unlockedAt:state.hero.level || 1,day:state.world.day || 1,source:"lower_ward_trainer"};
    w.trainerFavor[id] = true;
    w.influence = clamp(w.influence + 1,0,100);
    w.log.push(`${TRAINER_NPCS[id]?.name || "A ward trainer"} teaches you the ${path.name} path.`);
    state.world.story.push(`Class trained: ${path.name}.`);
  }else{
    state.world.story.push(`Class changed: ${path.name}.`);
  }
  state.hero.advancedClass = id;
  learnClassPathAbilities(path);
  save();
  updateTop();
  toast(already ? `Changed class: ${path.name}.` : `Unlocked class: ${path.name}.`);
  closeModals();
  window.FE?.show?.("home");
}

export function lowerWardFocusHardAreas(){
  const panel = document.querySelector(".hard-area-panel");
  if(panel){
    panel.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  toast("No hard districts are listed here yet.");
}
