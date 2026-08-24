import { ABILITY_SLOT_COUNT, ADVANCED_CLASSES, CLASSES, CM_ALLOCATIONS, SPELL_SCHOOLS, WEAPON_TYPES, activeClassDefinition, activeClassId, activeWeaponType, classMasteryNodes, classPathOptions, cmNodeById, cmPointNeed, masteryOwnedByHero, normalizeAbilityLoadout, normalizeCMAllocation, pathMasteryNodes, save, spellSchoolMasteryBonus, spellMasteryNeed, state, syncMasteryPassives, weaponMasteryBonus, weaponMasteryNeed } from "./state.js";
import { getLanguage, title, tx } from "./language.js";
import { bar, byId, esc, modal } from "./ui.js";

let tab = "classes";

export function renderProgression(){
  byId("progression").innerHTML = `
    <div class="panel">
      <h1>${tx("progression")}</h1>
      <div class="progress-tab-row">
        <button class="${tab==="stats"?"primary":""}" onclick="FE.progressTab('stats')">${tx("stats")}</button>
        <button class="${tab==="classes"?"primary":""}" onclick="FE.progressTab('classes')">${tx("classTree")}</button>
        <button class="${tab==="abilities"?"primary":""}" onclick="FE.progressTab('abilities')">${tx("abilityBook")}</button>
        <button class="${tab==="weapons"?"primary":""}" onclick="FE.progressTab('weapons')">${tx("weapons")}</button>
        <button class="${tab==="mastery"?"primary":""}" onclick="FE.progressTab('mastery')">${tx("mastery")}</button>
      </div>
      <div id="progressBody">${body()}</div>
    </div>
  `;
}

export function progressTab(next){
  tab = next;
  renderProgression();
}

function body(){
  if(tab==="classes")return classesHTML();
  if(tab==="abilities")return abilitiesHTML();
  if(tab==="weapons")return weaponsHTML();
  if(tab==="mastery")return masteryHTML();
  return statsHTML();
}

function statsHTML(){
  const h = state.hero;
  const cheapest = Math.min(...Object.keys(h.stats).map(statCost));
  return `
    <div class="card">
      <h2>Stat Points ${h.points}${h.points<cheapest?" (save for next stat)":""}</h2>
      <span class="pill good">${tx("activeClass")} ${esc(className(activeClassId(h)))}</span>
      <div class="grid">
        ${Object.entries(h.stats).map(([k,v])=>`
          <div class="stat-card">
            <h3>${title(k)} ${v}</h3>
            <p>Cost ${statCost(k)} point(s).</p>
            <button ${h.points<statCost(k)?"disabled":""} onclick="FE.addStat('${k}')">+</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function classesHTML(){
  const h = state.hero;
  const activeId = activeClassId(h);
  const current = activeClassDefinition(h);
  const m = h.mastery;
  const need = cmPointNeed(m);
  const paths = classPathOptions(h);
  return `
    <div class="card progression-current-class">
      <h2>${tx("classTree")}</h2>
      <p>${esc(tx("classTreeHelp"))}</p>
      <div class="progression-summary-grid">
        <span class="pill good">${tx("currentClass")}: ${esc(className(activeId))}</span>
        <span class="pill">${tx("baseClass")} ${esc(className(h.class))}</span>
        <span class="pill">${tx("cmBank")} ${m.cmPoints}</span>
        <span class="pill">${tx("cmXp")} ${m.cmXp}/${need}</span>
        ${classBonusPills(current).join("")}
      </div>
    </div>
    <div class="card class-tree-card">
      ${classPathTreeHTML(paths)}
    </div>
    <div class="card class-tree-card">
      <h2>${tx("classMastery")}: ${esc(className(h.class))}</h2>
      <p>${esc(tx("classTreeBaseHelp"))}</p>
      ${masteryForestHTML(classMasteryNodes(h.class, h).filter(node=>node.classId === h.class))}
    </div>
  `;
}

function classPathTreeHTML(paths){
  const h = state.hero;
  const active = !h.advancedClass;
  const base = CLASSES[h.class] || CLASSES.warrior;
  return `
    <div class="class-tree class-tree-paths-view" data-base="${esc(h.class)}">
      <div class="class-tree-node class-tree-root ${active?"is-active":"is-unlocked"}">
        <span class="class-tree-kicker">${tx("baseClass")}</span>
        <strong class="class-tree-title">${esc(className(h.class))}</strong>
        <p>${esc(tx("baseClassPathBody"))}</p>
        <div class="progression-summary-grid">
          ${Object.entries(base.stats || {}).filter(([,v])=>v).map(([k,v])=>`<span class="pill">${title(k)} +${v}</span>`).join("")}
        </div>
        <button ${active?"disabled":""} onclick="FE.returnBaseClass()">${active?tx("activeClass"):tx("switchClass")}</button>
      </div>
      <div class="class-tree-fork" aria-hidden="true"></div>
      <div class="class-tree-paths">
        ${paths.map(path=>classTreePathColumnHTML(path.id, path)).join("") || `<p>${esc(tx("cmNoNodes"))}</p>`}
      </div>
    </div>
  `;
}

function classTreePathColumnHTML(id, path){
  const status = classPathStatus(id, path);
  const ranks = pathMasteryNodes(id);
  const tone = status.active ? "is-active" : status.unlocked ? "is-unlocked" : status.locked ? "is-locked" : "is-available";
  return `
    <div class="class-tree-path ${tone}">
      <div class="class-tree-node class-tree-path-head ${tone}">
        <span class="class-tree-kicker">${esc(path.role || tx("classPath"))}</span>
        <strong class="class-tree-title">${esc(path.name)}</strong>
        <span class="pill ${status.active?"good":status.locked?"warn":status.unlocked?"good":""}">${status.active?tx("activeClass"):status.unlocked?tx("unlocked"):status.locked?tx("locked"):tx("available")}</span>
        <p>${esc(path.desc || "")}</p>
        <div class="progression-summary-grid">
          <span class="pill">${tx("requiresLevel")} ${path.level}</span>
          ${path.cmCost ? `<span class="pill">${tx("cmCost")} ${path.cmCost}</span>` : ""}
          ${classBonusPills(path).join("")}
        </div>
        ${(path.abilities || []).length ? `<p><span class="class-tree-label">${tx("learnAbility")}:</span> ${esc(path.abilities.map(title).join(" | "))}</p>` : ""}
        ${classHistoryLine(id)}
        ${status.reasons.length && !status.unlocked ? `<p class="class-tree-req">${tx("cmRequires")}: ${status.reasons.map(esc).join(" | ")}</p>` : ""}
        ${status.active
          ? `<button disabled>${tx("activeClass")}</button>`
          : status.unlocked
            ? `<button class="primary" onclick="FE.switchClassPath('${id}')">${tx("switchClass")}</button>`
            : `<button ${status.locked||!status.affordable?"disabled":""} onclick="FE.unlockClassPath('${id}')">${tx("unlockClass")}</button>`}
      </div>
      <ol class="class-tree-ranks">
        ${ranks.map((node, index)=>classTreeRankHTML(node, status, index)).join("")}
      </ol>
    </div>
  `;
}

function classTreeRankHTML(node, pathStatus, index){
  const rank = cmStatus(node);
  const lockedByPath = !pathStatus.active;
  const canBuy = pathStatus.active && !rank.bought && !rank.locked && state.hero.mastery.cmPoints >= node.cost;
  const tone = rank.bought ? "is-bought" : (lockedByPath || rank.locked || !pathStatus.unlocked) ? "is-locked" : "is-available";
  const spendHint = !rank.bought && lockedByPath
    ? (pathStatus.unlocked ? tx("switchPathToSpend") : tx("unlockPathFirst"))
    : "";
  return `
    <li class="class-tree-node class-tree-rank ${tone}">
      <span class="class-tree-kicker">${tx("treeRank")} ${index + 1} · ${esc(branchName(node.branch))}</span>
      <strong class="class-tree-title">${esc(nodeText(node,"name"))}</strong>
      <p>${esc(nodeText(node,"desc"))}</p>
      <div class="progression-summary-grid">
        <span class="pill">${tx("cmCost")} ${node.cost}</span>
        <span class="pill">${tx("cmRequiresLevel")} ${node.level}</span>
        <span class="pill ${rank.bought?"good":(lockedByPath||rank.locked)?"warn":""}">${rank.bought?tx("cmPurchased"):(lockedByPath||rank.locked)?tx("cmLocked"):tx("cmAvailable")}</span>
      </div>
      ${spendHint ? `<p class="class-tree-req">${esc(spendHint)}</p>` : ""}
      ${!lockedByPath && rank.reasons.length ? `<p class="class-tree-req">${tx("cmRequires")}: ${rank.reasons.map(esc).join(" | ")}</p>` : ""}
      <button ${canBuy?`class="primary" onclick="FE.buyCM('${esc(node.id)}')"`:"disabled"}>${rank.bought?tx("boughtStatus"):tx("buy")}</button>
    </li>
  `;
}

function masteryForestHTML(nodes){
  if(!nodes.length)return `<p>${esc(tx("cmNoNodes"))}</p>`;
  const layout = layoutMasteryForest(nodes);
  const rows = layout.rows.map(row=>`
    <div class="class-tree-row">
      ${row.map(node=>node ? masteryNodeHTML(node, layout) : `<div class="class-tree-slot" aria-hidden="true"></div>`).join("")}
    </div>
  `).join("");
  return `
    <div class="class-tree class-tree-mastery">
      <div class="class-tree-grid" style="--tree-cols:${layout.cols}">
        ${rows}
      </div>
      ${layout.merge.length ? `
        <div class="class-tree-fork class-tree-merge-fork" aria-hidden="true"></div>
        <div class="class-tree-merge" aria-label="${esc(tx("classTreeMerge"))}">
          ${layout.merge.map(node=>masteryNodeHTML(node, layout)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function layoutMasteryForest(nodes){
  const byId = new Map(nodes.map(node=>[node.id, node]));
  const parentsOf = node => (node.requires || []).map(id=>byId.get(id)).filter(Boolean);
  const depthOf = (node, seen = new Set())=>{
    if(!node || seen.has(node.id))return 0;
    seen.add(node.id);
    const parents = parentsOf(node);
    if(!parents.length)return 0;
    return 1 + Math.max(...parents.map(parent=>depthOf(parent, seen)));
  };
  const depths = new Map(nodes.map(node=>[node.id, depthOf(node)]));
  const roots = nodes.filter(node=>!parentsOf(node).length);
  const column = new Map();
  roots.forEach((node, index)=>column.set(node.id, index));
  [...nodes].sort((a,b)=>depths.get(a.id)-depths.get(b.id)).forEach(node=>{
    if(column.has(node.id))return;
    const parentCols = [...new Set(parentsOf(node).map(parent=>column.get(parent.id)).filter(value=>Number.isInteger(value) && value >= 0))];
    if(parentCols.length === 1)column.set(node.id, parentCols[0]);
    else if(parentCols.length > 1)column.set(node.id, -1);
    else column.set(node.id, 0);
  });
  const merge = nodes.filter(node=>column.get(node.id) === -1).sort((a,b)=>depths.get(a.id)-depths.get(b.id));
  const chain = nodes.filter(node=>column.get(node.id) !== -1);
  const cols = Math.max(1, roots.length);
  const maxDepth = chain.length ? Math.max(...chain.map(node=>depths.get(node.id))) : -1;
  const rows = [];
  for(let depth = 0; depth <= maxDepth; depth++){
    const row = Array.from({length:cols}, ()=>null);
    chain.filter(node=>depths.get(node.id) === depth).forEach(node=>{
      row[column.get(node.id)] = node;
    });
    rows.push(row);
  }
  return {cols, rows, merge, depths, column, parentsOf};
}

function masteryNodeHTML(node, layout=null){
  const rank = cmStatus(node);
  const owned = masteryOwnedByHero(node);
  const canBuy = owned && !rank.bought && !rank.locked && state.hero.mastery.cmPoints >= node.cost;
  const tone = rank.bought ? "is-bought" : (!owned || rank.locked) ? "is-locked" : "is-available";
  const parents = layout?.parentsOf ? layout.parentsOf(node) : [];
  const sameColumnParent = parents.length === 1 && layout?.column?.get(node.id) === layout.column.get(parents[0].id);
  const depth = layout?.depths?.get(node.id) ?? 0;
  return `
    <article class="class-tree-node class-tree-rank ${tone}${sameColumnParent?" has-parent":""}${parents.length > 1?" is-merge":""}" data-node="${esc(node.id)}">
      <span class="class-tree-kicker">${tx("treeRank")} ${depth + 1} · ${esc(branchName(node.branch))}</span>
      <strong class="class-tree-title">${esc(nodeText(node,"name"))}</strong>
      <p>${esc(nodeText(node,"desc"))}</p>
      <div class="progression-summary-grid">
        <span class="pill">${tx("cmCost")} ${node.cost}</span>
        <span class="pill">${tx("cmRequiresLevel")} ${node.level}</span>
        <span class="pill ${rank.bought?"good":rank.locked?"warn":""}">${rank.bought?tx("cmPurchased"):rank.locked?tx("cmLocked"):tx("cmAvailable")}</span>
      </div>
      ${rank.reasons.length ? `<p class="class-tree-req">${tx("cmRequires")}: ${rank.reasons.map(esc).join(" | ")}</p>` : ""}
      <button ${canBuy?`class="primary" onclick="FE.buyCM('${esc(node.id)}')"`:"disabled"}>${rank.bought?tx("boughtStatus"):tx("buy")}</button>
    </article>
  `;
}

function classHistoryLine(id){
  const info = state.hero.classHistory?.[id];
  if(!info)return "";
  const source = info.source === "lower_ward_trainer" ? "Lower Ward trainer" : "Class history";
  return `<p><span class="class-tree-label">${tx("unlocked")}:</span> ${esc(source)}${info.day ? `, day ${esc(info.day)}` : ""}${info.unlockedAt ? `, level ${esc(info.unlockedAt)}` : ""}</p>`;
}

function classBonusPills(def){
  const bonus = def?.bonus || {};
  const pills = [];
  if(bonus.attack)pills.push(`<span class="pill">${tx("attackShort")} +${bonus.attack}</span>`);
  if(bonus.defense)pills.push(`<span class="pill">${tx("defenseShort")} +${bonus.defense}</span>`);
  if(bonus.crit)pills.push(`<span class="pill">${tx("critBonus")} +${bonus.crit}</span>`);
  if(bonus.physicalDamagePct)pills.push(`<span class="pill">${tx("damageBonus")} +${percent(bonus.physicalDamagePct)}</span>`);
  if(bonus.spellDamagePct)pills.push(`<span class="pill">${tx("spellDamage")} +${percent(bonus.spellDamagePct)}</span>`);
  if(bonus.healingPct)pills.push(`<span class="pill">${tx("healingBonus")} +${percent(bonus.healingPct)}</span>`);
  if(bonus.manaDiscount)pills.push(`<span class="pill">${tx("mana")} -${bonus.manaDiscount}</span>`);
  return pills;
}

function classPathStatus(id,path=ADVANCED_CLASSES[id]){
  const h = state.hero;
  const unlocked = !!h.unlockedClasses?.includes(id);
  const active = h.advancedClass === id;
  const reasons = [];
  if(!path || path.baseClass !== h.class)reasons.push(tx("locked"));
  if(h.level < (path?.level || 1))reasons.push(`${tx("requiresLevel")} ${path.level}`);
  const affordable = (h.mastery.cmPoints || 0) >= (path?.cmCost || 0);
  if(!affordable)reasons.push(`${tx("cmPoints")} ${path.cmCost}`);
  return {unlocked,active,affordable,locked:reasons.length>0,reasons};
}

export function unlockClassPath(id){
  const path = ADVANCED_CLASSES[id];
  if(!path)return;
  const status = classPathStatus(id,path);
  if(status.unlocked || status.locked || !status.affordable)return;
  const h = state.hero;
  h.unlockedClasses ||= [h.class];
  h.classHistory ||= {};
  h.mastery.cmPoints -= path.cmCost || 0;
  h.unlockedClasses.push(id);
  h.unlockedClasses = [...new Set(h.unlockedClasses)];
  h.classHistory[id] = {unlockedAt:h.level || 1,day:state.world?.day || 1};
  h.advancedClass = id;
  learnClassPathAbilities(path);
  state.world.story.push(`${tx("classUnlocked")}: ${path.name}.`);
  save();
  renderProgression();
}

export function switchClassPath(id){
  if(!state.hero.unlockedClasses?.includes(id) || !ADVANCED_CLASSES[id])return;
  state.hero.advancedClass = id;
  learnClassPathAbilities(ADVANCED_CLASSES[id]);
  state.world.story.push(`${tx("classChanged")}: ${ADVANCED_CLASSES[id].name}.`);
  save();
  renderProgression();
}

export function returnBaseClass(){
  if(!state.hero.advancedClass)return;
  state.hero.advancedClass = null;
  state.world.story.push(`${tx("classChanged")}: ${className(state.hero.class)}.`);
  save();
  renderProgression();
}

export function learnClassPathAbilities(path){
  const h = state.hero;
  h.known ||= [];
  (path.abilities || []).forEach(id=>{
    if(!h.known.includes(id))h.known.push(id);
  });
  normalizeAbilityLoadout(h);
  (path.abilities || []).forEach(id=>{
    if(!h.abilityLoadout.includes(id)){
      const open = h.abilityLoadout.findIndex(value=>!value);
      if(open >= 0)h.abilityLoadout[open] = id;
    }
  });
  normalizeAbilityLoadout(h);
}

function weaponsHTML(){
  const h = state.hero;
  const current = activeWeaponType(h);
  return `
    <div class="card">
      <h2>${tx("weaponMastery")}</h2>
      <span class="pill good">${tx("currentWeapon")}: ${esc(weaponName(current))}</span>
      <div class="mastery-track-grid">
        ${Object.keys(WEAPON_TYPES).map(type=>weaponTrackHTML(type,current)).join("")}
      </div>
    </div>
    <div class="card">
      <h2>${tx("spellMastery")}</h2>
      <div class="mastery-track-grid">
        ${Object.keys(SPELL_SCHOOLS).map(spellTrackHTML).join("")}
      </div>
    </div>
  `;
}

function weaponTrackHTML(type,current){
  const h = state.hero;
  const track = h.mastery.weapon[type] || {level:1,xp:0};
  const need = weaponMasteryNeed(track.level);
  const bonus = weaponMasteryBonus(type,h);
  return `
    <div class="stat-card mastery-track-card ${type===current?"is-active":""}">
      <h3>${esc(weaponName(type))}</h3>
      <span class="pill ${type===current?"good":""}">${tx("level")} ${track.level}</span>
      <span class="pill">${tx("damageBonus")} +${percent(bonus.damagePct)}</span>
      <span class="pill">${tx("critBonus")} +${bonus.critBonus}</span>
      ${bar(track.xp,need,"xp")}
      <p>${track.xp}/${need} XP</p>
    </div>
  `;
}

function spellTrackHTML(school){
  const h = state.hero;
  const track = h.mastery.spells[school] || {level:1,xp:0};
  const need = spellMasteryNeed(track.level);
  const bonus = spellSchoolMasteryBonus(school,h);
  return `
    <div class="stat-card mastery-track-card">
      <h3>${esc(spellSchoolName(school))}</h3>
      <span class="pill">${tx("level")} ${track.level}</span>
      <span class="pill">${tx("spellDamage")} +${percent(bonus.damagePct)}</span>
      <span class="pill">${tx("healingBonus")} +${percent(bonus.healingPct)}</span>
      ${bar(track.xp,need,"xp")}
      <p>${track.xp}/${need} XP</p>
    </div>
  `;
}

export function statCost(k){
  return 1 + Math.floor((state.hero.stats[k] || 0)/5);
}

export function addStat(k){
  const cost = statCost(k);
  if(state.hero.points<cost)return;
  state.hero.points -= cost;
  state.hero.stats[k] = (state.hero.stats[k] || 0) + 1;
  if(k==="endurance"){state.hero.maxHp += 12; state.hero.hp += 12;}
  if(k==="wisdom"){state.hero.maxMana += 6; state.hero.mana += 6;}
  save();
  renderProgression();
}

function abilitiesHTML(){
  const h = state.hero;
  const slots = normalizeAbilityLoadout(h);
  return `
    <div class="card">
      <h2>${tx("abilityBook")}</h2>
      <p>${tx("activeInCombat")}</p>
      <h3>${tx("activeAbilitySlots")}</h3>
      <div class="grid">
        ${slots.map((id,index)=>abilitySlotHTML(id,index)).join("")}
      </div>
    </div>
    <div class="card">
      <h2>${tx("knownAbilities")}</h2>
      <div class="grid">
        ${h.known.map(knownAbilityHTML).join("")}
      </div>
    </div>
  `;
}

function abilitySlotHTML(id,index){
  return `
    <div class="stat-card">
      <h3>${tx("slot")} ${index + 1}</h3>
      ${id ? `
        <p><b>${title(id)}</b></p>
        <span class="pill">${tx("abilityCost")} ${abilityCost(id)}</span>
        <button onclick="FE.unequipAbility(${index})">${tx("unequip")}</button>
      ` : `<p>${tx("emptyAbilitySlot")}</p>`}
    </div>
  `;
}

function knownAbilityHTML(id){
  const slots = normalizeAbilityLoadout(state.hero);
  const activeIndex = slots.indexOf(id);
  return `
    <div class="stat-card">
      <h3>${title(id)}</h3>
      <span class="pill">${tx("abilityCost")} ${abilityCost(id)}</span>
      ${activeIndex >= 0 ? `<span class="pill good">${tx("active")} ${activeIndex + 1}</span>` : ""}
      <div class="grid2" style="margin-top:8px">
        ${Array.from({length:ABILITY_SLOT_COUNT},(_,i)=>`
          <button ${slots[i]===id?"disabled":""} onclick="FE.equipAbility('${id}',${i})">${tx("equip")} ${tx("slot")} ${i + 1}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function abilityCost(id){
  const low = id.toLowerCase();
  if(/heal|mend|restore/.test(low))return 8;
  if(/guard|shield|wall/.test(low))return 7;
  return 9;
}

export function showPendingAbilityChoice(){
  const h = state?.hero;
  const pending = h?.abilityMilestones?.pending?.[0];
  if(!pending || document.querySelector(".modal-back"))return false;
  const body = `
    <p>${tx("chooseNewAbility")}</p>
    <div class="grid">
      ${pending.choices.map(id=>`
        <div class="stat-card">
          <h3>${title(id)}</h3>
          <span class="pill">${tx("abilityCost")} ${abilityCost(id)}</span>
        </div>
      `).join("")}
    </div>
  `;
  modal(`${tx("abilityMilestone")} - ${tx("level")} ${pending.level}`, body, pending.choices.map(id=>({
    label:`${tx("learnAbility")} ${title(id)}`,
    fn:()=>chooseMilestoneAbility(pending.level,id)
  })));
  return true;
}

export function chooseMilestoneAbility(level,id){
  const h = state.hero;
  h.abilityMilestones ||= {claimed:{},pending:[]};
  h.abilityMilestones.claimed ||= {};
  h.abilityMilestones.pending ||= [];
  const pending = h.abilityMilestones.pending.find(choice=>choice.level===level);
  if(!pending || !pending.choices.includes(id))return;
  if(!h.known.includes(id))h.known.push(id);
  h.abilityMilestones.claimed[level] = id;
  h.abilityMilestones.pending = h.abilityMilestones.pending.filter(choice=>choice.level!==level);
  state.world.story.push(`${tx("learnedAbility")}: ${title(id)}.`);
  save();
  if(byId("progression")?.classList.contains("active"))renderProgression();
  setTimeout(()=>showPendingAbilityChoice(),50);
}

export function equipAbility(id,slotIndex){
  const h = state.hero;
  const index = Number(slotIndex);
  if(!h.known.includes(id) || index < 0 || index >= ABILITY_SLOT_COUNT)return;
  const slots = normalizeAbilityLoadout(h);
  h.abilityLoadout = slots.map(value=>value===id ? null : value);
  h.abilityLoadout[index] = id;
  save();
  renderProgression();
}

export function unequipAbility(slotIndex){
  const h = state.hero;
  const index = Number(slotIndex);
  if(index < 0 || index >= ABILITY_SLOT_COUNT)return;
  normalizeAbilityLoadout(h);
  h.abilityLoadout[index] = null;
  save();
  renderProgression();
}

function masteryHTML(){
  const h = state.hero, m = h.mastery, need = cmPointNeed(m);
  const classId = activeClassId(h);
  const baseNodes = classMasteryNodes(h.class, h).filter(node=>node.classId === h.class);
  const pathNodes = h.advancedClass ? pathMasteryNodes(h.advancedClass) : [];
  return `
    <div class="card">
      <h2>${tx("cmBank")}</h2>
      <p>${tx("cmAllocationHelp")}</p>
      <div class="progression-summary-grid">
        <span class="pill good">${tx("cmPoints")} ${m.cmPoints}</span>
        <span class="pill">${tx("cmSpent")} ${m.cmSpent}</span>
        <span class="pill">${tx("cmXp")} ${m.cmXp}/${need}</span>
        <span class="pill warn">${tx("cmAllocation")} ${m.cmAllocation}%</span>
      </div>
      ${bar(m.cmXp,need,"xp")}
      <input type="range" min="0" max="100" step="25" value="${m.cmAllocation}" oninput="FE.setCM(this.value)" />
      <div class="grid3" style="margin-top:8px">
        ${CM_ALLOCATIONS.map(value=>`<button class="${m.cmAllocation===value?"primary":""}" onclick="FE.setCM(${value})">${value}%</button>`).join("")}
      </div>
    </div>
    ${pathNodes.length ? `
      <div class="card class-tree-card">
        <h2>${tx("classMastery")}: ${esc(className(classId))}</h2>
        <p>${esc(tx("classTreePathActiveHelp"))}</p>
        <ol class="class-tree-ranks class-tree-path-line">
          ${pathNodes.map((node, index)=>classTreeRankHTML(node, {active:true, unlocked:true, locked:false}, index)).join("")}
        </ol>
      </div>
    ` : ""}
    <div class="card class-tree-card">
      <h2>${tx("classMastery")}: ${esc(className(h.class))}</h2>
      <p>${esc(tx("classTreeBaseHelp"))}</p>
      ${baseNodes.length ? masteryForestHTML(baseNodes) : `<p>${esc(tx("cmNoNodes"))}</p>`}
    </div>
  `;
}

function branchName(branch){
  return tx("cmBranches")?.[branch] || branch;
}

function className(id){
  return ADVANCED_CLASSES[id]?.name || tx("classNames")?.[id] || CLASSES[id]?.name || title(id);
}

function weaponName(type){
  return WEAPON_TYPES[type]?.name || title(type);
}

function spellSchoolName(school){
  return SPELL_SCHOOLS[school]?.name || title(school);
}

function percent(value){
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function nodeText(node,field){
  const lang = getLanguage();
  return node[field]?.[lang] || node[field]?.en || node[field] || node.id;
}

function cmStatus(node){
  const h = state.hero, m = h.mastery;
  const bought = !!m.cmPurchases[node.id];
  const reasons = [];
  if(h.level < node.level)reasons.push(`${tx("cmRequiresLevel")} ${node.level}`);
  if((m.cmSpent || 0) < (node.spent || 0))reasons.push(`${tx("cmRequiresSpent")} ${node.spent}`);
  (node.requires || []).forEach(id=>{
    if(!m.cmPurchases[id]){
      const req = cmNodeById(id);
      reasons.push(`${tx("cmRequiresNode")} ${req ? nodeText(req,"name") : title(id)}`);
    }
  });
  return {bought,locked:reasons.length>0,reasons};
}

export function setCM(value){
  state.hero.mastery.cmAllocation = normalizeCMAllocation(value);
  save();
  renderProgression();
}

export function buyCM(id){
  const item = cmNodeById(id);
  if(!item || !masteryOwnedByHero(item))return;
  const m = state.hero.mastery;
  const status = cmStatus(item);
  if(status.bought || status.locked || m.cmPoints<item.cost)return;
  m.cmPoints -= item.cost;
  m.cmSpent += item.cost;
  m.cmPurchases[id] = true;
  if(item.passive)state.hero.passives[item.passive] = true;
  syncMasteryPassives(state.hero);
  state.world.story.push(`${tx("cmMasteryBought")}: ${nodeText(item,"name")}.`);
  save();
  renderProgression();
}
