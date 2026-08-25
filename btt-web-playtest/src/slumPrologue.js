import { advanceDays, clamp, companionTrainingNeed, grantCompanionBond, grantHeroXp, normalizeCompanion, rnd, save, state } from "./state.js";
import { startBattle } from "./combat.js";
import { presentLevelUp } from "./levelUp.js";
import { modal, toast, updateTop } from "./ui.js";
import { tx } from "./language.js";
import { NPC_ACTOR_ASSETS } from "./npcRegistry.js";

const SLUM_COMPANION_ID = "slum_mira";
const GATE_BRIBE_COST = 25;

const CHAPTER_ONE_CONTRACTS = [
  {
    id:"ration_marks",
    name:"Recover Stolen Food",
    contact:"Seda Vell",
    kind:"scavenge",
    tag:"Market",
    desc:"Trace missing food sacks through the drain alleys before the Dock Rats sell them back.",
    action:"Search Drains",
    reward:{gold:5,food:1,status:1,safety:1,danger:1,bond:6,training:5},
    log:"You recover marked ration sacks and return them before the market opens."
  },
  {
    id:"forge_scrap",
    name:"Bring Borin Scrap",
    contact:"Borin Ashhand",
    kind:"work",
    tag:"Blacksmith",
    requires:["ration_marks"],
    desc:"Work the ash heaps for usable scrap so Borin can patch weapons without asking questions.",
    action:"Work Scrap Run",
    reward:{gold:6,ore:1,status:1,safety:0,danger:1,bond:5,training:10},
    log:"You haul usable scrap to Borin. He marks your name on the honest side of the ledger."
  },
  {
    id:"knife_corner",
    name:"Clear Knife-Corner",
    contact:"Mira",
    kind:"combat",
    tag:"Alley Fight",
    requires:["ration_marks"],
    desc:"A corner crew waits near the smoke ditch. Clear it and the shelter route gets safer.",
    action:"Start Fight",
    reward:{gold:7,status:2,safety:1,danger:-1,bond:12,training:10},
    log:"Knife-Corner empties out. Doors open a little wider when you pass."
  },
  {
    id:"dock_rat_ledger",
    name:"Break the Dock Rat Ledger",
    contact:"Vale",
    kind:"combat",
    tag:"Gang",
    requires:["forge_scrap","knife_corner"],
    desc:"Vale knows where the Dock Rats keep the debt list. Burn it before they move collections.",
    action:"Raid Ledger",
    reward:{gold:10,status:2,safety:1,danger:0,debt:-8,bond:13,training:12},
    log:"The Dock Rat debt ledger burns in a tavern stove. Several families stop whispering your name like a warning."
  },
  {
    id:"gate_lieutenant",
    name:"Defeat the Gate Lieutenant",
    contact:"Lower Ward Gate",
    kind:"boss",
    tag:"Chapter Boss",
    requires:["dock_rat_ledger"],
    desc:"The gang lieutenant who sells gate access has stopped hiding behind collectors. Beat him and Chapter 1 has a real ending.",
    action:"Challenge Lieutenant",
    reward:{gold:12,status:3,safety:1,danger:-1,debt:-99,bond:18,training:16},
    log:"The gate lieutenant drops to one knee. Cinderhook sees the Lower Ward path crack open."
  }
];

const COMPANION_CONTRACT_UNLOCKS = {
  scout:["trap_snare","smoke_step","quick_strike"],
  fighter:["guard_wall","cleave","strike"],
  guard:["shield_bash","taunt","guard_wall"],
  healer:["minor_mend","holy_guard","renew"],
  mystic:["fire_bolt","arcane_burst","minor_mend"]
};

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function prologue(){
  state.prologue ||= {};
  state.prologue.companion ||= {met:false,recruited:false,id:null};
  state.prologue.gang ||= {state:"warning",paid:0,defeated:false,nextDemandDay:3};
  state.prologue.lowerWardGate ||= {visited:false,unlocked:false};
  state.prologue.contracts ||= {active:null,completed:[],failed:[],chapterBossUnlocked:false,chapterBossDefeated:false};
  state.prologue.contracts.completed ||= [];
  state.prologue.contracts.failed ||= [];
  state.prologue.log ||= [];
  return state.prologue;
}

function addLog(text){
  const p = prologue();
  p.log.push(text);
  p.log = p.log.slice(-18);
  state.world.story ||= [];
  state.world.story.push(text);
  state.world.story = state.world.story.slice(-24);
}

function refresh(forceHome = false){
  save();
  updateTop();
  const homeVisible = typeof document !== "undefined" && document.getElementById("home")?.classList.contains("active");
  if(forceHome || homeVisible){
    window.FE?.show?.("home");
  }
}

function actionDay(){
  const p = prologue();
  p.actionsTaken++;
  advanceDays(1);
  state.hero.food = Math.max(0,state.hero.food - 1);
  if(state.hero.food <= 0){
    state.hero.hp = Math.max(1,state.hero.hp - 8);
    p.safety = clamp(p.safety - 1,0,10);
    addLog("Hunger follows you through the alleys. You lose health and safety.");
  }
  if(!p.gang.defeated && state.world.day >= p.gang.nextDemandDay){
    p.gang.state = "demand";
    p.danger = clamp(p.danger + 1,0,10);
    p.heat = clamp(p.heat + 1,0,10);
  }
}

function gateReady(){
  const p = prologue();
  return state.hero.gold >= p.coinGoal && p.status >= p.statusGoal && p.safety >= p.safetyGoal && (p.gang.defeated || p.gang.paid > 0);
}

function contractById(id){
  return CHAPTER_ONE_CONTRACTS.find(contract=>contract.id === id) || null;
}

function contractState(){
  return prologue().contracts;
}

function completedContracts(){
  return new Set(contractState().completed || []);
}

function contractUnlocked(contract,p = prologue()){
  if(!contract)return false;
  const done = completedContracts();
  if(done.has(contract.id))return false;
  if(contract.id === "gate_lieutenant"){
    return !p.contracts.chapterBossDefeated
      && p.companion.recruited
      && (p.contracts.completed || []).length >= 3
      && (contract.requires || []).every(id=>done.has(id));
  }
  return (contract.requires || []).every(id=>done.has(id));
}

function visibleContracts(p = prologue()){
  return CHAPTER_ONE_CONTRACTS.filter(contract=>contractUnlocked(contract,p));
}

function activeContract(){
  return contractById(contractState().active);
}

function contractRewardLine(reward = {}){
  const parts = [];
  if(reward.gold)parts.push(`${reward.gold}g`);
  if(reward.food)parts.push(`${reward.food} food`);
  if(reward.ore)parts.push(`${reward.ore} ore`);
  if(reward.status)parts.push(`+${reward.status} rep`);
  if(reward.safety)parts.push(`${reward.safety > 0 ? "+" : ""}${reward.safety} safety`);
  if(reward.danger)parts.push(`${reward.danger > 0 ? "+" : ""}${reward.danger} danger`);
  if(reward.heat)parts.push(`${reward.heat > 0 ? "+" : ""}${reward.heat} heat`);
  if(reward.debt)parts.push(`${reward.debt} debt`);
  if(reward.bond)parts.push(`+${reward.bond} bond`);
  if(reward.training)parts.push(`+${reward.training} training`);
  return parts.join(" | ");
}

function grantCompanionTraining(companion,xp){
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
    if(companion.role === "mystic" || companion.role === "healer"){
      companion.maxMana += 3;
      companion.mana = companion.maxMana;
    }
    ranks++;
  }
  return ranks;
}

function unlockCompanionContractSkill(companion){
  normalizeCompanion(companion);
  const pool = COMPANION_CONTRACT_UNLOCKS[companion.role] || COMPANION_CONTRACT_UNLOCKS.fighter;
  const milestone = Math.floor(((companion.bond?.level || 1) + (companion.training?.rank || 0)) / 3) - 1;
  if(milestone < 0)return null;
  const ability = pool[Math.min(pool.length - 1,milestone)];
  if(!ability || companion.known.includes(ability))return null;
  companion.known.push(ability);
  const emptySlot = companion.abilityLoadout.findIndex(value=>!value);
  if(emptySlot >= 0)companion.abilityLoadout[emptySlot] = ability;
  return ability;
}

function grantContractCompanionProgress(contract){
  const reward = contract.reward || {};
  const active = state.hero.companions.filter(c=>c.active && c.hp > 0);
  if(!active.length)return [];
  return active.map(companion=>{
    normalizeCompanion(companion);
    const bondLevels = grantCompanionBond(companion,reward.bond || 0);
    const trainingRanks = grantCompanionTraining(companion,reward.training || 0);
    const learned = unlockCompanionContractSkill(companion);
    companion.morale = clamp((companion.morale || 50) + 1,0,100);
    return {name:companion.name,bondLevels,trainingRanks,learned};
  });
}

function applyContractReward(contract){
  const p = prologue();
  const reward = contract.reward || {};
  state.hero.gold += reward.gold || 0;
  state.hero.food += reward.food || 0;
  state.hero.ore += reward.ore || 0;
  p.status += reward.status || 0;
  p.safety = clamp(p.safety + (reward.safety || 0),0,10);
  p.danger = clamp(p.danger + (reward.danger || 0),0,10);
  p.heat = clamp(p.heat + (reward.heat || 0),0,10);
  p.debt = Math.max(0,p.debt + (reward.debt || 0));
  if(contract.id === "gate_lieutenant"){
    p.contracts.chapterBossDefeated = true;
    p.gang.defeated = true;
    p.gang.state = "broken";
    p.lowerWardGate.visited = true;
  }
  const companionResults = grantContractCompanionProgress(contract);
  if(companionResults.length){
    const gains = companionResults
      .filter(row=>row.bondLevels || row.trainingRanks || row.learned)
      .map(row=>{
        const parts = [];
        if(row.bondLevels)parts.push(`bond +${row.bondLevels}`);
        if(row.trainingRanks)parts.push(`training +${row.trainingRanks}`);
        if(row.learned)parts.push(`learned ${row.learned.replace(/_/g," ")}`);
        return `${row.name}: ${parts.join(", ")}`;
      })
      .join("; ");
    if(gains)addLog(gains);
  }
}

function completeContract(contractId,{fromBattle = false} = {}){
  const p = prologue();
  const contract = contractById(contractId);
  if(!contract)return false;
  if(p.contracts.completed.includes(contract.id))return true;
  applyContractReward(contract);
  p.contracts.completed.push(contract.id);
  p.contracts.completed = [...new Set(p.contracts.completed)];
  if(p.contracts.active === contract.id)p.contracts.active = null;
  if(contract.id !== "gate_lieutenant" && p.contracts.completed.length >= 3 && p.companion.recruited){
    p.contracts.chapterBossUnlocked = true;
  }
  addLog(contractText(contract, "log"));
  if(fromBattle)save();
  if(contract.kind === "work" || contract.kind === "scavenge"){
    const leveled = grantHeroXp(28);
    save();
    if(leveled)presentLevelUp(leveled, {continueLabel:tx("levelUpRise")});
  }
  return true;
}

function completeActiveContractByKind(kind){
  const contract = activeContract();
  if(!contract || contract.kind !== kind)return false;
  return completeContract(contract.id);
}

function contractEnemies(contract){
  if(contract.id === "gate_lieutenant"){
    const p = prologue();
    const pressure = Math.max(2,p.danger + p.status / 3);
    return [
      {
        name:"Dock Rat Lieutenant",
        role:"chapter boss",
        enemyVisualClass:"bandit",
        level:3,
        hp:122 + Math.floor(pressure * 7),
        maxHp:122 + Math.floor(pressure * 7),
        attack:15 + Math.floor(pressure * 1.2),
        defense:6,
        speed:5,
        xp:64,
        gold:10
      },
      {
        name:"Gate Knife",
        role:"gang",
        enemyVisualClass:"bandit",
        level:2,
        hp:72,
        maxHp:72,
        attack:12,
        defense:4,
        speed:6,
        xp:34,
        gold:5
      }
    ];
  }
  if(contract.id === "dock_rat_ledger"){
    return [makeGangEnemy(), {...makeAlleyEnemy(),name:"Ledger Guard",hp:66,maxHp:66,attack:11,defense:4,gold:6,xp:40}];
  }
  return [makeAlleyEnemy()];
}

function makeMira(){
  return {
    id:SLUM_COMPANION_ID,
    name:"Mira of the Drainsteps",
    rarity:"uncommon",
    class:"scout",
    role:"scout",
    tactic:"aggressive",
    level:1,
    xp:0,
    nextXp:125,
    hp:96,
    maxHp:96,
    mana:22,
    maxMana:22,
    attack:11,
    defense:5,
    speed:7,
    active:true,
    bond:{level:1,xp:15},
    training:{rank:0,xp:0},
    loyalty:58,
    morale:55,
    known:["quick_strike"],
    abilityLoadout:["quick_strike"]
  };
}

function makeGangEnemy(){
  const p = prologue();
  const pressure = Math.max(0,p.danger - 2);
  return {
    name:p.gang.defeated ? "Corner Knife" : "Dock Rat Enforcer",
    role:"gang",
    enemyVisualClass:"bandit",
    level:1,
    hp:46 + pressure * 4,
    maxHp:46 + pressure * 4,
    mana:0,
    maxMana:0,
    attack:9 + pressure,
    defense:2,
    speed:5,
    xp:50,
    gold:8 + Math.min(6,pressure * 2)
  };
}

function makeAlleyEnemy(){
  const p = prologue();
  const pressure = Math.max(0,p.danger - 1);
  const names = ["Desperate Thief", "Corner Knife", "Dock Rat Cutpurse"];
  return {
    name:names[rnd(0,names.length - 1)],
    role:"slum",
    enemyVisualClass:"bandit",
    level:1 + Math.floor(pressure / 3),
    hp:40 + pressure * 5,
    maxHp:40 + pressure * 5,
    mana:0,
    maxMana:0,
    attack:8 + pressure,
    defense:2 + Math.floor(pressure / 3),
    speed:5,
    xp:42 + pressure * 3,
    gold:7 + Math.min(8,pressure * 2)
  };
}

function statPill(label,value,cls = ""){
  return `<span class="pill ${cls}">${esc(label)} ${esc(value)}</span>`;
}

function progress(label,value,max,cls = ""){
  const pct = Math.max(0,Math.min(100,Math.floor(value / Math.max(1,max) * 100)));
  return `
    <div class="slum-meter ${cls}">
      <div class="meter-line"><span>${esc(label)}</span><span>${esc(value)} / ${esc(max)}</span></div>
      <div class="bar ${cls}"><div style="width:${pct}%"></div></div>
    </div>
  `;
}

function actionDisabled(reason){
  return reason ? `disabled title="${esc(reason)}"` : "";
}

function slumNpcCard({name,role,asset,action,label,disabled = false}){
  return `
    <button class="slum-npc-card" onclick="${esc(action)}" ${disabled ? "disabled" : ""}>
      <img class="btt-npc-idle" src="${esc(asset)}" alt="" loading="lazy" decoding="async" draggable="false">
      <span>${esc(role)}</span>
      <b>${esc(name)}</b>
      <small>${esc(label)}</small>
    </button>
  `;
}

function slumNpcRailHTML(p, complete){
  const companionLabel = p.companion.recruited ? "In party" : p.companion.met ? "Recruit 6g" : "Find ally";
  return `
    <div class="slum-loop-strip">
      <span class="pill good">Play Loop</span>
      <p>${esc(tx("slumPlayLoop"))}</p>
    </div>
    <div class="slum-npc-rail" aria-label="Cinderhook contacts">
      ${slumNpcCard({name:"Seda Vell",role:"Merchant",asset:NPC_ACTOR_ASSETS.marketMerchant,action:"FE.openTownService('market')",label:"Supplies"})}
      ${slumNpcCard({name:"Borin Ashhand",role:"Blacksmith",asset:NPC_ACTOR_ASSETS.blacksmith,action:"FE.openTownService('blacksmith')",label:"Upgrade gear"})}
      ${slumNpcCard({name:"Nessa Hearth",role:"Healer",asset:NPC_ACTOR_ASSETS.innkeeper,action:"FE.openTownService('inn')",label:"Rest"})}
      ${slumNpcCard({name:"Vale",role:"Tavern",asset:NPC_ACTOR_ASSETS.tavernKeeper,action:"FE.openTownService('tavern')",label:"Rumors"})}
      ${slumNpcCard({name:"Mira",role:"Companion",asset:NPC_ACTOR_ASSETS.companionScout,action:"FE.slumOpenActionGroup('shelter')",label:companionLabel})}
      ${slumNpcCard({name:"Dock Rats",role:"Gang",asset:NPC_ACTOR_ASSETS.gangLookout,action:"FE.slumOpenActionGroup('gang')",label:p.gang.defeated ? "Broken" : "Pressure",disabled:complete || p.gang.defeated})}
    </div>
  `;
}

function contractText(contract, field){
  const key = `contract_${contract.id}_${field}`;
  const translated = tx(key);
  return translated !== key ? translated : (contract[field] || "");
}

function contractCardHTML(contract,{active = false} = {}){
  const reward = contractRewardLine(contract.reward);
  const action = active ? `FE.slumStartContract('${contract.id}')` : `FE.slumAcceptContract('${contract.id}')`;
  const label = active ? contractText(contract, "action") : tx("contractAccept");
  return `
    <div class="slum-contract-card ${active ? "is-active" : ""} ${contract.kind === "boss" ? "is-boss" : ""}">
      <div class="slum-contract-card-head">
        <span class="pill ${contract.kind === "boss" ? "red" : "good"}">${esc(contractText(contract, "tag"))}</span>
        <small>${esc(contract.contact)}</small>
      </div>
      <h3>${esc(contractText(contract, "name"))}</h3>
      <p>${esc(contractText(contract, "desc"))}</p>
      <small>${esc(reward)}</small>
      <div class="grid2">
        <button class="${active ? "primary" : ""}" onclick="${esc(action)}">${esc(label)}</button>
        ${active ? `<button class="secondary" onclick="FE.slumAbandonContract()">${tx("contractHold")}</button>` : `<button class="secondary" onclick="FE.slumContractDetails('${contract.id}')">${tx("contractDetails")}</button>`}
      </div>
    </div>
  `;
}

function contractBoardHTML(p, complete){
  const cstate = p.contracts;
  const active = activeContract();
  const available = active ? [] : visibleContracts(p).slice(0,3);
  const done = cstate.completed.length;
  const bossReady = !!visibleContracts(p).find(contract=>contract.id === "gate_lieutenant");
  return `
    <div class="slum-contract-board">
      <div class="slum-contract-head">
        <div>
          <span class="pill ${bossReady ? "red" : "good"}">${tx("slumChapterBoard")}</span>
          <h2>${tx("slumContracts")}</h2>
          <p>${complete ? tx("slumContractBoardComplete") : tx("slumContractBoardDesc")}</p>
        </div>
        <div class="slum-contract-progress">
          <span class="pill">${done}/${CHAPTER_ONE_CONTRACTS.length} ${tx("contractDone")}</span>
          ${bossReady ? `<span class="pill red">${tx("slumContractBossReady")}</span>` : ""}
        </div>
      </div>
      ${active ? `
        <div class="slum-contract-active">
          ${contractCardHTML(active,{active:true})}
        </div>
      ` : available.length ? `
        <div class="slum-contract-grid">
          ${available.map(contract=>contractCardHTML(contract)).join("")}
        </div>
      ` : `
        <div class="slum-loop-strip">
          <span class="pill warn">${tx("slumContractNoNew")}</span>
          <p>${p.companion.recruited ? tx("slumContractNoNewGate") : tx("slumContractNoNewMira")}</p>
        </div>
      `}
      ${cstate.completed.length ? `
        <div class="slum-contract-complete-row">
          ${cstate.completed.slice(-5).map(id=>`<span class="pill good">${esc(contractText(contractById(id) || {id}, "name") || id)}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function contractSummaryHTML(p, complete){
  const active = activeContract();
  const available = visibleContracts(p);
  const next = active || available[0];
  const done = p.contracts.completed.length;
  if(!next || complete){
    return `
      <div class="slum-contract-summary">
        <div>
          <span class="pill ${complete ? "good" : "warn"}">Chapter 1</span>
          <h2>${complete ? tx("gateOpen") : tx("slumContractNoNew")}</h2>
          <p>${complete
            ? tx("gateOpenBody")
            : p.companion.recruited
              ? tx("slumContractNoNewGate")
              : tx("slumContractNoNewMira")}</p>
        </div>
        <div class="slum-summary-actions">
          <span class="pill">${done}/${CHAPTER_ONE_CONTRACTS.length} ${tx("contractDone")}</span>
          ${complete
            ? `<button class="primary" onclick="FE.enterLowerWard()">${tx("enterLowerWard")}</button>`
            : `<button class="secondary" onclick="FE.slumOpenContractBoard()">${tx("slumChapterBoard")}</button>`}
        </div>
      </div>
    `;
  }
  const action = active ? `FE.slumStartContract('${next.id}')` : `FE.slumAcceptContract('${next.id}')`;
  return `
    <div class="slum-contract-summary ${next.kind === "boss" ? "is-boss" : ""}">
      <div>
        <span class="pill ${next.kind === "boss" ? "red" : "good"}">${active ? "Active Contract" : "Next Contract"}</span>
        <h2>${esc(contractText(next, "name"))}</h2>
        <p>${esc(contractText(next, "desc"))}</p>
        <small>${esc(contractRewardLine(next.reward))}</small>
      </div>
      <div class="slum-summary-actions">
        <span class="pill">${done}/${CHAPTER_ONE_CONTRACTS.length} ${tx("contractDone")}</span>
        <button class="${active ? "primary" : ""}" onclick="${esc(action)}" ${actionDisabled(complete ? "The prologue gate is already reached." : "")}>${esc(active ? contractText(next, "action") : tx("contractAccept"))}</button>
        <button class="secondary" onclick="FE.slumOpenContractBoard()">Board</button>
      </div>
    </div>
  `;
}

function slumSupportButtonHTML(complete){
  if(!complete)return "";
  return `
    <button class="secondary slum-group-button" onclick="FE.show('support')">
      <span>Court Ledger</span>
      <small>Looks, founder writs, extra save beds</small>
    </button>
  `;
}

export function renderSlumProloguePanel(){
  if(!state?.prologue)return "";
  const p = prologue();
  const complete = p.phase === "gateUnlocked" || p.lowerWardGate.unlocked;
  const gangDemand = p.gang.state === "demand" && !p.gang.defeated;
  const gateLabel = complete ? tx("slumGateReady") : tx("slumGateTest");
  return `
    <div class="panel slum-prologue-panel ${complete ? "slum-prologue-complete" : ""}">
      <div class="slum-hero slum-hero-compact">
        <div>
          <span class="pill ${gangDemand ? "red" : "warn"}">${tx("slumPrologueTitle")}</span>
          ${gateReady() || complete ? statPill("Gate", complete ? tx("slumGateOpened") : tx("slumGateReadyLabel"),"good") : statPill("Gate",tx("slumGateLocked"),"warn")}
        </div>
      </div>
      ${contractSummaryHTML(p, complete)}
      <div class="slum-action-grid slum-action-groups slum-action-compact">
        <button class="primary slum-group-button" onclick="FE.slumOpenContractBoard()" ${actionDisabled(complete ? "The prologue gate is already reached." : "")}>
          <span>${tx("slumContracts")}</span>
        </button>
        <button class="${complete || gateReady() ? "primary" : "secondary"} slum-group-button" onclick="${complete ? "FE.enterLowerWard()" : "FE.slumSeekGate()"}">
          <span>${esc(complete ? tx("enterLowerWard") : gateLabel)}</span>
        </button>
        <button class="slum-group-button" onclick="FE.slumOpenActionGroup('town')">
          <span>${tx("slumTownWork")}</span>
        </button>
        <button class="slum-group-button" onclick="FE.slumOpenActionGroup('shelter')">
          <span>${tx("slumShelterAlly")}</span>
        </button>
      </div>
      <div class="slum-progress-grid">
        ${progress("Reputation",p.status,p.statusGoal,p.status >= p.statusGoal ? "good" : "")}
        ${progress("Safety",p.safety,p.safetyGoal,p.safety >= p.safetyGoal ? "good" : "mana")}
        ${progress("Danger",p.danger,10,p.danger >= 5 ? "danger" : "warn")}
      </div>
      <details class="slum-drawer slum-town-drawer">
        <summary>${tx("slumTownContacts")}</summary>
        ${slumNpcRailHTML(p, complete)}
      </details>
      <details class="slum-drawer slum-log-drawer">
        <summary>${tx("slumRecentRumors")}</summary>
        <div class="slum-log">
          ${p.log.slice(-5).map(line=>`<div class="entry">${esc(line)}</div>`).join("")}
        </div>
      </details>
    </div>
  `;
}

export function slumOpenActionGroup(groupId){
  const p = prologue();
  const complete = p.phase === "gateUnlocked" || p.lowerWardGate.unlocked;
  if(groupId === "town"){
    modal(tx("slumTownWorkTitle"), `<p>${esc(tx("slumTownWorkBody"))}</p>`, [
      {label:tx("slumWorkStalls"),cls:"primary",fn:()=>slumWork()},
      {label:tx("slumScavengeDrains"),cls:"secondary",fn:()=>slumScavenge()},
      {label:tx("slumClearAlley"),cls:"secondary",fn:()=>slumClearAlley()},
      {label:p.gang.defeated ? tx("slumGangBroken") : tx("slumGangPressure"),cls:p.gang.state === "demand" ? "danger" : "secondary",fn:()=>setTimeout(()=>slumOpenActionGroup("gang"),0)},
      {label:tx("market"),cls:"secondary",fn:()=>window.FE.openTownService("market")},
      {label:tx("blacksmith"),cls:"secondary",fn:()=>window.FE.openTownService("blacksmith")},
      {label:tx("inn"),cls:"secondary",fn:()=>window.FE.openTownService("inn")},
      {label:tx("tavern"),cls:"secondary",fn:()=>window.FE.openTownService("tavern")},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(groupId === "earn"){
    if(complete)return toast(tx("slumGateAlready"));
    modal(tx("slumEarnCoin"), `<p>${esc(tx("slumEarnCoinBody"))}</p>`, [
      {label:tx("slumWorkStalls"),cls:"primary",fn:()=>slumWork()},
      {label:tx("slumScavengeDrains"),cls:"secondary",fn:()=>slumScavenge()},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(groupId === "shelter"){
    const companionReady = p.companion.recruited;
    const canRecruit = p.companion.met && !p.companion.recruited;
    modal(tx("slumShelterAlly"), `<p>${esc(tx("slumShelterBody"))}</p>`, [
      {label:tx("slumRestShelter"),cls:"primary",fn:()=>slumRest()},
      {label:companionReady ? tx("slumMiraRecruited") : canRecruit ? tx("slumSpeakMira") : tx("slumFindCompanion"),cls:"secondary",fn:()=>slumMeetCompanion()},
      {label:tx("slumCompanionDrill"),cls:"secondary",fn:()=>slumCompanionDrill()},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(groupId === "gang"){
    if(p.gang.defeated)return toast(tx("slumGangAlready"));
    if(complete)return toast(tx("slumGateAlready"));
    modal(tx("slumGangPressure"), `<p>${esc(tx("slumGangBody"))}</p>`, [
      {label:tx("slumPayGang"),cls:"primary",fn:()=>slumPayGang()},
      {label:tx("slumRefuseEnforcer"),cls:"danger",fn:()=>slumFightGang()},
      {label:tx("close"),cls:"secondary"}
    ]);
  }
}

export function slumOpenContractBoard(){
  const p = prologue();
  modal("Chapter 1 Contracts", contractBoardHTML(p, p.phase === "gateUnlocked" || p.lowerWardGate.unlocked), [
    {label:"Close",cls:"secondary"}
  ]);
}

export function slumContractDetails(id){
  const contract = contractById(id);
  if(!contract)return toast("Contract not found.");
  modal(contractText(contract, "name"), `
    <p>${esc(contractText(contract, "desc"))}</p>
    <span class="pill">${esc(contract.contact)}</span>
    <span class="pill">${esc(contractText(contract, "tag"))}</span>
    <p>Reward: ${esc(contractRewardLine(contract.reward))}</p>
  `, [
    {label:tx("contractAccept"),cls:"primary",fn:()=>slumAcceptContract(id)},
    {label:"Close",cls:"secondary"}
  ]);
}

export function slumAcceptContract(id){
  const p = prologue();
  const contract = contractById(id);
  if(!contract)return toast("Contract not found.");
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  if(p.contracts.active && p.contracts.active !== id)return toast("Finish or hold the active contract first.");
  if(p.contracts.completed.includes(id))return toast("That contract is already complete.");
  if(!contractUnlocked(contract,p))return toast("That contract is not ready yet.");
  p.contracts.active = id;
  if(contract.id === "gate_lieutenant")p.contracts.chapterBossUnlocked = true;
  addLog(`${contract.contact} posts a contract: ${contractText(contract, "name")}.`);
  refresh();
}

export function slumAbandonContract(){
  const p = prologue();
  const contract = activeContract();
  if(!contract)return toast("No active contract.");
  p.contracts.active = null;
  addLog(`${contractText(contract, "name")} is held for later.`);
  refresh();
}

export function slumStartContract(id){
  const p = prologue();
  const contract = contractById(id || p.contracts.active);
  if(!contract)return toast("No contract selected.");
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  if(!p.contracts.active)slumAcceptContract(contract.id);
  if(p.contracts.active !== contract.id)return toast("Finish or hold the active contract first.");
  if(contract.kind === "work"){
    actionDay();
    completeContract(contract.id);
    addLog(`Contract completed: ${contractText(contract, "name")}.`);
    refresh();
    return;
  }
  if(contract.kind === "scavenge"){
    p.danger = clamp(p.danger + 1,0,10);
    actionDay();
    completeContract(contract.id);
    addLog(`Contract completed: ${contractText(contract, "name")}.`);
    refresh();
    return;
  }
  addLog(`${contractText(contract, "name")} turns into a fight.`);
  save();
  startBattle(contractEnemies(contract), contractText(contract, "desc"), {
    source:"slum-prologue",
    onVictory:"slumContractWon",
    onDefeat:"slumContractLost",
    contractId:contract.id
  });
}

export function slumCompanionDrill(){
  const p = prologue();
  const active = state.hero.companions.filter(c=>c.active);
  if(!active.length){
    modal("Companion Drill", `<p>Find or recruit Mira first. Drills become useful once someone is actually walking beside you.</p>`, [
      {label:p.companion.met ? "Speak with Mira" : "Find Mira",cls:"primary",fn:()=>slumMeetCompanion()},
      {label:"Close",cls:"secondary"}
    ]);
    return;
  }
  const goldCost = 4;
  const foodCost = 1;
  if(state.hero.gold < goldCost)return toast("Need 4 gold.");
  if(state.hero.food < foodCost)return toast("Need 1 food.");
  state.hero.gold -= goldCost;
  state.hero.food -= foodCost;
  active.forEach(companion=>{
    normalizeCompanion(companion);
    grantCompanionBond(companion,10);
    grantCompanionTraining(companion,24);
    const learned = unlockCompanionContractSkill(companion);
    if(learned)addLog(`${companion.name} learned ${learned.replace(/_/g," ")} during drill.`);
  });
  p.safety = clamp(p.safety + 1,0,10);
  advanceDays(1);
  addLog("You spend a day drilling footwork, signals, and emergency escapes with the party.");
  refresh();
}

export function slumWork(){
  const p = prologue();
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  const coin = rnd(9,14);
  state.hero.gold += coin;
  p.status += 1;
  p.safety = clamp(p.safety - (Math.random() < .35 ? 1 : 0),0,10);
  p.danger = clamp(p.danger + (Math.random() < .3 ? 1 : 0),0,10);
  actionDay();
  addLog(`You haul ash barrels and mend stall canvas. +${coin} gold, +1 reputation.`);
  if(completeActiveContractByKind("work"))addLog("Your active contract is complete.");
  refresh();
}

export function slumScavenge(){
  const p = prologue();
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  const coin = rnd(4,9);
  const food = Math.random() < .55 ? 1 : 0;
  state.hero.gold += coin;
  state.hero.food += food;
  p.status += Math.random() < .45 ? 1 : 0;
  p.danger = clamp(p.danger + 1,0,10);
  p.heat = clamp(p.heat + 1,0,10);
  actionDay();
  addLog(`You search the lower drains. +${coin} gold${food ? ", +1 food" : ""}, but danger rises.`);
  if(completeActiveContractByKind("scavenge"))addLog("Your active contract is complete.");
  refresh();
}

export function slumRest(){
  const p = prologue();
  const foodCost = state.hero.food > 0 ? 1 : 0;
  state.hero.food = Math.max(0,state.hero.food - foodCost);
  state.hero.hp = Math.min(state.hero.maxHp,state.hero.hp + 42);
  state.hero.mana = Math.min(state.hero.maxMana,state.hero.mana + 20);
  p.safety = clamp(p.safety + 1,0,10);
  p.danger = clamp(p.danger - 1,0,10);
  advanceDays(1);
  addLog(foodCost ? "You bar the shelter door, share a heel of bread, and recover." : "You rest hungry. Your body recovers, but the room feels colder.");
  refresh();
}

export function slumMeetCompanion(){
  const p = prologue();
  if(p.companion.recruited)return toast("Mira is already in your party.");
  if(!p.companion.met){
    p.companion.met = true;
    p.status += 1;
    addLog("Mira of the Drainsteps marks a safe chalk sign near your shelter. She knows which alleys bite.");
    modal("Mira of the Drainsteps", `<p>Mira offers to guide you through gang alleys for 6 gold. She joins as a scout companion and fights beside you.</p>`, [
      {label:"Recruit Mira",cls:"primary",fn:()=>slumRecruitCompanion()},
      {label:"Later",cls:"secondary"}
    ]);
    refresh();
    return;
  }
  modal("Mira of the Drainsteps", `<p>Mira waits near the rain barrel, watching the enforcer route.</p><p>Recruit cost: 6 gold.</p>`, [
    {label:"Recruit Mira",cls:"primary",fn:()=>slumRecruitCompanion()},
    {label:"Later",cls:"secondary"}
  ]);
}

export function slumRecruitCompanion(){
  const p = prologue();
  if(p.companion.recruited)return toast("Mira is already in your party.");
  if(state.hero.gold < 6)return toast("Need 6 gold to recruit Mira.");
  state.hero.gold -= 6;
  const existing = state.hero.companions.find(c=>c.id === SLUM_COMPANION_ID);
  if(!existing)state.hero.companions.push(makeMira());
  p.companion.recruited = true;
  p.companion.id = SLUM_COMPANION_ID;
  p.safety = clamp(p.safety + 2,0,10);
  p.status += 1;
  addLog("Mira joins your party. Shortcuts, warnings, and a second blade change the slum math.");
  refresh();
}

export function slumPayGang(){
  const p = prologue();
  if(p.gang.defeated)return toast("The Dock Rats are already broken here.");
  if(state.hero.gold < 12)return toast("Need 12 gold.");
  state.hero.gold -= 12;
  p.gang.paid++;
  p.gang.state = "paid";
  p.gang.nextDemandDay = state.world.day + 4;
  p.safety = clamp(p.safety + 2,0,10);
  p.danger = clamp(p.danger - 2,0,10);
  p.status += 1;
  addLog("You pay the Dock Rats. The corner quiets, but everyone saw who collected.");
  refresh();
}

export function slumFightGang(){
  const p = prologue();
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  addLog("You refuse the Dock Rat demand. Steel comes out under the laundry lines.");
  save();
  startBattle([makeGangEnemy()],"A Dock Rat enforcer blocks the alley and demands your gate money.", {
    source:"slum-prologue",
    onVictory:"slumFightWon",
    onDefeat:"slumFightLost"
  });
}

export function slumClearAlley(){
  const p = prologue();
  if(p.lowerWardGate.unlocked)return toast("The gate is already reached.");
  addLog("You choose a bad alley on purpose, looking for the trouble everyone else avoids.");
  save();
  startBattle([makeAlleyEnemy()],"You push into a Cinderhook alley where knives move before names.", {
    source:"slum-prologue",
    onVictory:"slumAlleyWon",
    onDefeat:"slumAlleyLost"
  });
}

export function completeSlumFight(){
  const p = prologue();
  p.gang.defeated = true;
  p.gang.state = "broken";
  p.status += 3;
  p.safety = clamp(p.safety + 2,0,10);
  p.danger = clamp(p.danger - 3,0,10);
  p.heat = clamp(p.heat + 1,0,10);
  addLog("The enforcer falls back bleeding. The Dock Rats stop treating your shelter as easy rent.");
  const contract = activeContract();
  if(contract?.id === "dock_rat_ledger")completeContract(contract.id,{fromBattle:true});
  refresh(true);
}

export function recordSlumFightDefeat(){
  const p = prologue();
  p.gang.state = "demand";
  p.safety = clamp(p.safety - 1,0,10);
  p.danger = clamp(p.danger + 1,0,10);
  addLog("The Dock Rats beat you back to the shelter. They will return for coin.");
  refresh(true);
}

export function completeSlumAlleyFight(){
  const p = prologue();
  actionDay();
  p.status += 2;
  p.safety = clamp(p.safety + (p.companion.recruited ? 2 : 1),0,10);
  p.danger = clamp(p.danger - 1,0,10);
  p.heat = clamp(p.heat + 1,0,10);
  addLog(p.companion.recruited
    ? "You and Mira clear a knife-corner. Word spreads that your shelter is not easy prey."
    : "You clear a knife-corner alone. It earns respect, and a few doors stop closing so fast.");
  const contract = activeContract();
  if(contract?.id === "knife_corner")completeContract(contract.id,{fromBattle:true});
  refresh(true);
}

export function completeSlumContractFight(meta = {}){
  const contractId = meta.contractId || activeContract()?.id;
  const contract = contractById(contractId);
  if(!contract)return refresh(true);
  actionDay();
  completeContract(contract.id,{fromBattle:true});
  addLog(`Contract reward: ${contractRewardLine(contract.reward)}.`);
  refresh(true);
  toast(`Contract complete: ${contractText(contract, "name")}`);
}

export function recordSlumContractDefeat(meta = {}){
  const p = prologue();
  const contractId = meta.contractId || activeContract()?.id;
  const contract = contractById(contractId);
  actionDay();
  p.safety = clamp(p.safety - 1,0,10);
  p.danger = clamp(p.danger + 1,0,10);
  if(contract){
    p.contracts.failed.push(contract.id);
    p.contracts.failed = p.contracts.failed.slice(-12);
    addLog(`${contractText(contract, "name")} goes badly. Recover and try again when your supplies are steadier.`);
  }else{
    addLog("The contract fight goes badly. Cinderhook gets louder around your shelter.");
  }
  refresh(true);
}

export function recordSlumAlleyDefeat(){
  const p = prologue();
  actionDay();
  p.safety = clamp(p.safety - 1,0,10);
  p.danger = clamp(p.danger + 1,0,10);
  p.heat = clamp(p.heat + 1,0,10);
  addLog("The alley turns against you. Cinderhook learns you can bleed.");
  refresh(true);
}

export function slumSeekGate(){
  const p = prologue();
  p.lowerWardGate.visited = true;
  if(p.lowerWardGate.unlocked){
    modal(tx("slumGateReady"), `<p>${esc(tx("gateOpenBody"))}</p>`, [
      {label:tx("enterLowerWard"),cls:"primary",fn:()=>window.FE.enterLowerWard?.() || refresh()},
      {label:tx("close"),cls:"secondary"}
    ]);
    return;
  }
  if(!gateReady()){
    modal("Lower Ward Gate", `
      <p>The gate guards look past you until your name, purse, and corner safety improve.</p>
      <p>Needed: ${p.coinGoal} gold, ${p.statusGoal} reputation, ${p.safetyGoal} safety, and either paid or broken gang pressure.</p>
    `);
    return;
  }
  if(state.hero.gold < GATE_BRIBE_COST){
    toast(`Need ${GATE_BRIBE_COST} gold for the gate fee.`);
    return;
  }
  state.hero.gold -= GATE_BRIBE_COST;
  p.phase = "gateUnlocked";
  p.lowerWardGate.unlocked = true;
  p.status += 2;
  p.safety = clamp(p.safety + 1,0,10);
  addLog("Your name reaches the iron wicket. The Lower Ward gate opens for the first time.");
  modal(tx("slumPrologueComplete"), `<p>${esc(tx("gateUnlockedBody"))}</p>`, [
    {label:tx("enterLowerWard"),cls:"primary",fn:()=>window.FE.enterLowerWard?.() || refresh()},
    {label:tx("courtLedger"),cls:"secondary",fn:()=>window.FE.show("support")}
  ]);
  refresh(true);
}
