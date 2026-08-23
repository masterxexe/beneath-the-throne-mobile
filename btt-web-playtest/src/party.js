import { COMPANION_ROLES, COMPANION_TACTICS, companionBondNeed, companionRoleDefinition, companionTacticDefinition, companionTrainingCost, companionTrainingNeed, normalizeCompanion, partyFoodCost, partyLimit, partyWageCost, rnd, save, state, xpNeed } from "./state.js";
import { title, tx } from "./language.js";
import { bar, byId, esc, modal, toast, updateTop } from "./ui.js";

const RARITY_MULT = {
  common:1,
  uncommon:1.08,
  rare:1.18,
  epic:1.32,
  legendary:1.5
};

export function renderParty(){
  const h = state.hero;
  h.companions.forEach((companion,index)=>normalizeCompanion(companion,index));
  const active = h.companions.filter(c=>c.active).length;
  const limit = partyLimit();
  byId("party").innerHTML = `
    <div class="panel party-command-panel">
      <div class="party-command-head">
        <div>
          <h1>${tx("party")}</h1>
          <p>${tx("companionSystemHelp")}</p>
        </div>
        <div class="party-summary-pills">
          <span class="pill ${active >= limit ? "warn" : "good"}">${tx("activeCompanions")} ${active}/${limit}</span>
          <span class="pill">${tx("monthlyWages")} ${partyWageCost()}g</span>
          <span class="pill">${tx("dailyFoodNeed")} ${partyFoodCost()}</span>
        </div>
      </div>
    </div>
    ${h.companions.length ? `
      <div class="party-roster-grid">
        ${h.companions.map(compHTML).join("")}
      </div>
    ` : `
      <div class="panel">
        <h2>${tx("noCompanions")}</h2>
        <p>${tx("noCompanionsHelp")}</p>
      </div>
    `}
  `;
}

function compHTML(c){
  normalizeCompanion(c);
  const role = companionRoleDefinition(c.role);
  const tactic = companionTacticDefinition(c.tactic);
  const trainingNeed = companionTrainingNeed(c.training.rank);
  const bondNeed = companionBondNeed(c.bond.level);
  const cost = companionTrainingCost(c);
  return `
    <div class="card companion-card companion-role-${esc(c.role)} ${c.active ? "is-active" : "is-benched"}">
      <div class="companion-card-head">
        <div>
          <span class="pill ${c.active ? "good" : ""}">${c.active ? tx("active") : tx("benched")}</span>
          <h2>${esc(c.name)}</h2>
        </div>
        <span class="pill">${esc(title(c.rarity))}</span>
      </div>
      <p>${esc(role.desc)}</p>
      <div class="companion-stat-row">
        <span class="pill">${tx("level")} ${c.level}</span>
        <span class="pill">${tx("role")}: ${esc(role.name)}</span>
        <span class="pill">${tx("tactic")}: ${esc(tactic.name)}</span>
      </div>
      <div class="companion-meter">
        <div class="meter-line"><span>${tx("hp")}</span><span>${c.hp}/${c.maxHp}</span></div>
        ${bar(c.hp,c.maxHp)}
        <div class="meter-line"><span>${tx("mana")}</span><span>${c.mana}/${c.maxMana}</span></div>
        ${bar(c.mana,c.maxMana || 1,"mana")}
      </div>
      <div class="companion-stat-row">
        <span class="pill">${tx("attackShort")} ${c.attack}</span>
        <span class="pill">${tx("defenseShort")} ${c.defense}</span>
        <span class="pill">${tx("speed")} ${c.speed}</span>
      </div>
      <div class="companion-progress-pair">
        <div>
          <b>${tx("bond")} ${c.bond.level}</b>
          ${bar(c.bond.xp,bondNeed,"xp")}
          <small>${c.bond.xp}/${bondNeed}</small>
        </div>
        <div>
          <b>${tx("training")} ${c.training.rank}</b>
          ${bar(c.training.xp,trainingNeed,"xp")}
          <small>${c.training.xp}/${trainingNeed}</small>
        </div>
      </div>
      <div class="companion-tactics">
        ${Object.keys(COMPANION_TACTICS).map(tacticId=>`
          <button class="${c.tactic===tacticId?"primary":""}" onclick="FE.setCompanionTactic('${esc(c.id)}','${tacticId}')">${esc(COMPANION_TACTICS[tacticId].name)}</button>
        `).join("")}
      </div>
      <div class="grid2 companion-actions">
        <button onclick="FE.toggleComp('${esc(c.id)}')">${c.active ? tx("bench") : tx("activate")}</button>
        <button class="primary" onclick="FE.trainCompanion('${esc(c.id)}')">${tx("train")} ${cost.gold}g${cost.food ? ` / ${cost.food} ${tx("food").toLowerCase()}` : ""}</button>
        <button onclick="FE.compStats('${esc(c.id)}')">${tx("companionBook")}</button>
      </div>
    </div>
  `;
}

export function makeCompanion(level, preferredRole = ""){
  const roleIds = Object.keys(COMPANION_ROLES);
  const role = COMPANION_ROLES[preferredRole] ? preferredRole : roleIds[rnd(0,roleIds.length-1)];
  const def = companionRoleDefinition(role);
  const names = {
    fighter:["Bran","Old Vek","Rook"],
    scout:["Mira","Talia","Vessa"],
    guard:["Garran","Holt","Bracca"],
    healer:["Sera","Nessa","Alin"],
    mystic:["Vale","Iri","Corven"]
  };
  const rarities = ["common","uncommon","rare"];
  const rarity = rarities[rnd(0,rarities.length-1)];
  const mult = RARITY_MULT[rarity] || 1;
  const lv = Math.max(1,level || 1);
  return normalizeCompanion({
    id:"c_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    name:names[role][rnd(0,names[role].length-1)],
    rarity,
    class:role,
    role,
    tactic:def.tactic,
    level:lv,
    xp:0,
    nextXp:xpNeed(lv),
    hp:Math.floor((def.stats.hp + lv * 8) * mult),
    maxHp:Math.floor((def.stats.hp + lv * 8) * mult),
    mana:def.stats.mana + lv * 2,
    maxMana:def.stats.mana + lv * 2,
    attack:Math.floor((def.stats.attack + lv * 2) * mult),
    defense:Math.floor((def.stats.defense + lv) * mult),
    speed:def.stats.speed,
    active:true,
    known:[...def.abilities],
    abilityLoadout:def.abilities.slice(0,4)
  });
}

export function toggleComp(id){
  const c = state.hero.companions.find(x=>x.id===id);
  if(!c)return;
  normalizeCompanion(c);
  if(!c.active && state.hero.companions.filter(x=>x.active).length>=partyLimit()){
    modal(tx("partyFull"),`<p>${tx("partyFullBody")}</p>`);
    return;
  }
  c.active = !c.active;
  save();
  renderParty();
}

export function setCompanionTactic(id,tactic){
  const c = state.hero.companions.find(x=>x.id===id);
  if(!c || !COMPANION_TACTICS[tactic])return;
  c.tactic = tactic;
  save();
  renderParty();
}

export function trainCompanion(id){
  const c = state.hero.companions.find(x=>x.id===id);
  if(!c)return;
  normalizeCompanion(c);
  const cost = companionTrainingCost(c);
  if(state.hero.gold < cost.gold)return toast(tx("needGold"));
  if(cost.food && state.hero.food < cost.food)return toast(tx("needFood"));
  state.hero.gold -= cost.gold;
  state.hero.food -= cost.food;
  c.training.xp += 35 + c.level * 3;
  let ranks = 0;
  while(c.training.rank < 20 && c.training.xp >= companionTrainingNeed(c.training.rank)){
    c.training.xp -= companionTrainingNeed(c.training.rank);
    c.training.rank++;
    c.maxHp += 5;
    c.hp = c.maxHp;
    c.attack += c.role === "healer" ? 1 : 2;
    c.defense += c.role === "guard" ? 2 : 1;
    if(c.role === "mystic" || c.role === "healer"){
      c.maxMana += 4;
      c.mana = c.maxMana;
    }
    ranks++;
  }
  c.loyalty = Math.min(100,(c.loyalty || 50) + 1 + ranks);
  state.world.story.push(`${c.name} ${tx("trained").toLowerCase()}.`);
  save();
  updateTop();
  renderParty();
}

export function compStats(id){
  const c = state.hero.companions.find(x=>x.id===id);
  if(!c)return;
  normalizeCompanion(c);
  const role = companionRoleDefinition(c.role);
  const tactic = companionTacticDefinition(c.tactic);
  modal(c.name,`
    <div class="companion-book">
      <p>${esc(role.desc)}</p>
      <span class="pill">${tx("role")}: ${esc(role.name)}</span>
      <span class="pill">${tx("tactic")}: ${esc(tactic.name)}</span>
      <span class="pill">${tx("bond")} ${c.bond.level}</span>
      <span class="pill">${tx("training")} ${c.training.rank}</span>
      <p>${tx("knownAbilities")}: ${c.known.filter(Boolean).map(title).join(", ")}</p>
      <p>${tx("activeAbilitySlots")}: ${c.abilityLoadout.filter(Boolean).map(title).join(", ") || tx("empty")}</p>
      <p>${tx("loyalty")} ${c.loyalty} | ${tx("morale")} ${c.morale}</p>
    </div>
  `);
}
