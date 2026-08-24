import { CLASSES, createNewState, save, setState, state } from "./state.js";
import { dictionary, getLanguage, setLanguage, statExplanation, statName, title, tx } from "./language.js";
import { bar, byId, esc, modal, showSaveSlots, startGame } from "./ui.js";
import { backdropHTML, enemyPortrait, heroPortrait, portraitHTML, uniquePortrait } from "./visuals.js";
import { enemyVisualHTML } from "./enemyVisuals.js";

let heroName = "Xexe";
let skeleton = null;
let dragon = null;
let openingSettingsOpen = false;
let openingTransitionTimer = null;

function localizedClassName(id, fallback){
  return dictionary().classNames?.[id] || fallback || title(id);
}

function classFlavor(id){
  return dictionary().classFlavor?.[id] || "";
}

function jsArg(value){
  return JSON.stringify(String(value ?? "")).replace(/"/g,"&quot;");
}

function openingCopy(){
  if(getLanguage() === "es"){
    return {
      settings:"Ajustes",
      titleKicker:"Un reino respira bajo la ceniza",
      titleSub:"Un RPG oscuro de refugios vivos, batallas pintadas y caminos que recuerdan cada perdida.",
      nameTitle:"Nombra al viajero",
      nameSub:"Antes de elegir una clase, eres un superviviente gastado por el camino, arrastrado bajo Ashen Keep hacia Cinderhook por humo y deuda.",
      continue:"Entrar al camino de ceniza",
      back:"Volver",
      tutorialHint:"Lee la escena, elige una accion y observa como cambia la presion del combate.",
      skeletonHint:"Ataca para terminar la pelea. Defiende si quieres reducir el siguiente golpe.",
      skillLocked:"La sangre aun no sabe que camino tomara. Las habilidades despiertan despues de Ser Kael.",
      potionHint:"Una pocion compra tiempo, no seguridad.",
      defendHint:"La guardia baja el impacto y te ensena a sobrevivir.",
      kaelShowcase:"Showcase Battle",
      classKicker:"Elige que arde dentro de ti",
      classSub:"La barrera de Kael se rompe, pero deja un camino vivo en tu sangre.",
      titleSettings:"Idioma",
      newGame:"Nueva Partida",
      loadGame:"Cargar Partida",
      privacy:"Privacidad",
      terms:"Términos"
    };
  }
  return {
    settings:"Settings",
    titleKicker:"A kingdom breathes beneath the ash",
    titleSub:"A dark fantasy RPG of living refuges, painted battlefields, and roads that remember every loss.",
    nameTitle:"Name the Traveler",
    nameSub:"Before a class, before a banner, you are a road-worn survivor pulled below Ashen Keep toward Cinderhook Slum by smoke and debt.",
    continue:"Enter the Ash Road",
    back:"Back",
    tutorialHint:"Read the field, choose an action, and watch how combat pressure changes.",
    skeletonHint:"Attack to end the fight. Defend if you need the next blow softened.",
    skillLocked:"Your blood has not chosen its path. Class skills awaken after Ser Kael.",
    potionHint:"A potion buys time, not safety.",
    defendHint:"Guarding turns a killing rhythm into something survivable.",
    kaelShowcase:"Showcase Battle",
    classKicker:"Choose what burns inside you",
    classSub:"Kael's barrier breaks, but it leaves a living path in your blood.",
    titleSettings:"Language",
    newGame:"New Game",
    loadGame:"Load Game",
    privacy:"Privacy",
    terms:"Terms"
  };
}

function openingAtmosphereHTML(){
  return `
    <span class="v59-atmosphere v59-fog-a"></span>
    <span class="v59-atmosphere v59-fog-b"></span>
    <span class="v59-atmosphere v59-embers"></span>
    <span class="v59-atmosphere v59-light"></span>
    <span class="v59-atmosphere v59-vignette"></span>
  `;
}

function hiddenTravelerHTML(name, detail = {}){
  const hp = detail.hp ?? 100;
  const maxHp = detail.maxHp ?? 100;
  const mana = detail.mana ?? 18;
  const maxMana = detail.maxMana ?? 18;
  const survivorArt = "assets/tutorial/generated/v80/opening-survivor-v80.webp";
  return `
    <div class="unit combat-card combat-actor combat-actor-hero opening-hidden-card" data-combat-actor="hero">
      <div class="portrait-wrap">
        <img class="opening-survivor-art" src="${survivorArt}" alt="${esc(name)} survivor" loading="eager" decoding="async" draggable="false">
        <span class="opening-survivor-ground" aria-hidden="true"></span>
      </div>
      <div class="combat-card-body">
        <div class="combat-name"><b>${esc(name)}</b><span>${tx("survivor")}</span></div>
        <span class="pill">${tx("unchosenSurvivor")}</span>
        <div class="meter-line"><span>${tx("hp")}</span><span>${hp}/${maxHp}</span></div>
        ${bar(hp,maxHp)}
        <div class="meter-line"><span>${tx("mana")}</span><span>${mana}/${maxMana}</span></div>
        ${bar(mana,maxMana,"mana")}
      </div>
    </div>
  `;
}

function enemyTutorialCardHTML(enemy, pose = "idle"){
  return `
    <div class="enemy combat-card combat-actor combat-actor-enemy combat-slot-0 enemy-scale-small target" data-combat-actor="enemy" data-combat-slot="0" data-enemy-scale="small" data-enemy-state="${esc(pose)}">
      <div class="portrait-wrap">
        ${enemyVisualHTML({name:enemy.name,role:enemy.role || tx("tutorialEnemy"),enemyVisualClass:"skeleton"}, pose) || portraitHTML(uniquePortrait("tutorial_skeleton"))}
      </div>
      <div class="combat-card-body">
        <div class="combat-name"><b>${esc(enemy.name)}</b><span>${tx("level")} 1</span></div>
        <span class="pill red">${esc(enemy.role || tx("tutorialEnemy"))}</span>
        <div class="meter-line"><span>${tx("hp")}</span><span>${enemy.hp}/${enemy.maxHp}</span></div>
        ${bar(enemy.hp,enemy.maxHp)}
      </div>
    </div>
  `;
}

function cinematicBackDropHTML(kind){
  const backdrops = {
    title:{classes:"backdrop-battlefield backdrop-v59-title",mood:"ember",art:"assets/ui/generated/title-bg-v19d.png"},
    skeleton:{classes:"backdrop-ruins backdrop-environmental backdrop-foggy-graveyard",mood:"grave-fog",art:"assets/battlebacks/generated/foggy-graveyard-v42.png"},
    dragon:{classes:"backdrop-battlefield backdrop-dragon-intro backdrop-v18-art",mood:"plague",art:"assets/battlebacks/generated/castle-gate-defense-v18.png"},
    keep:{classes:"backdrop-town-outskirts backdrop-v59-keep",mood:"lantern",art:"assets/towns/generated/ashen-keep-world-v57.png"}
  };
  return backdropHTML(backdrops[kind] || backdrops.skeleton);
}

function tutorialPortraitCard({kind = "", titleText, subtitle, visual, body = ""}){
  const visualTier = visual?.tier ? `visual-${visual.tier}` : "";
  return `
    <div class="tut-unit tutorial-unit-card ${kind} ${visualTier}">
      <div class="tutorial-unit-portrait">${portraitHTML(visual)}</div>
      <div class="tutorial-unit-copy">
        <h3>${esc(titleText)}</h3>
        ${subtitle ? `<span class="pill">${esc(subtitle)}</span>` : ""}
        ${body}
      </div>
    </div>
  `;
}

export function renderStart(){
  document.body.classList.add("start-lock");
  document.body.classList.remove("game-lock");
  document.body.classList.remove("cinematic-world-home-active");
  const l = getLanguage();
  const copy = openingCopy();
  byId("game").style.display = "none";
  byId("setup").style.display = "block";
  byId("setup").classList.remove("v59-transition-active");
  byId("setup").innerHTML = `
    <div class="v59-title-screen opening-scene opening-scene-start ${openingSettingsOpen ? "settings-open" : ""}">
      ${openingAtmosphereHTML()}
      <div class="v59-title-stage" aria-hidden="true">
        <span class="v59-title-road"></span>
        <span class="v59-title-throne"></span>
        <span class="v59-title-cinders"></span>
      </div>
      <div class="v59-title-lockup">
        <span class="v59-title-kicker">${esc(copy.titleKicker)}</span>
        <h1>Beneath <span>the Throne</span></h1>
        <p>${esc(copy.titleSub)}</p>
      </div>
      <div class="v59-title-menu">
        <button class="primary v59-title-command" onclick="FE.startOpeningJourney()">${esc(copy.newGame)}</button>
        <button class="secondary v59-title-command" onclick="FE.showSaveSlots('load')">${esc(copy.loadGame)}</button>
        <button class="secondary v59-title-command" onclick="FE.toggleOpeningSettings()">${esc(copy.settings)}</button>
        <p class="v59-title-legal"><a href="./privacy.html">${esc(copy.privacy)}</a> · <a href="./terms.html">${esc(copy.terms)}</a></p>
        ${openingSettingsOpen ? `
          <div class="v59-settings-panel">
            <span>${esc(copy.titleSettings)}: ${l==="es" ? tx("spanish") : tx("english")}</span>
            <div class="lang-row fantasy-language-row">
              <button class="fantasy-nav-tab ${l==="en"?"lang-active":"secondary"}" onclick="FE.setOpeningLanguage('en')">${tx("english")}</button>
              <button class="fantasy-nav-tab ${l==="es"?"lang-active":"secondary"}" onclick="FE.setOpeningLanguage('es')">${tx("spanish")}</button>
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

export function setOpeningLanguage(lang){
  setLanguage(lang);
  renderStart();
}

export function toggleOpeningSettings(){
  openingSettingsOpen = !openingSettingsOpen;
  renderStart();
}

export function startOpeningJourney(){
  const root = byId("setup");
  root?.classList.add("v59-transition-active");
  clearTimeout(openingTransitionTimer);
  openingTransitionTimer = setTimeout(()=>renderOpeningName(),420);
}

export function renderOpeningName(){
  const copy = openingCopy();
  byId("setup").classList.remove("v59-transition-active");
  byId("setup").innerHTML = `
    <div class="v59-prologue-screen opening-scene opening-scene-skeleton">
      ${openingAtmosphereHTML()}
      <div class="v59-prologue-stage">
        ${cinematicBackDropHTML("skeleton")}
        <div class="v59-prologue-copy">
          <span class="v59-title-kicker">${tx("survivor")}</span>
          <h1>${esc(copy.nameTitle)}</h1>
          <p>${esc(copy.nameSub)}</p>
          <label class="fantasy-field-label" for="heroName">${tx("heroName")}</label>
          <input id="heroName" class="fantasy-name-input" value="${esc(heroName)}" maxlength="22" autocomplete="off" />
          <div class="grid2 fantasy-start-actions">
            <button class="primary fantasy-action-button" onclick="FE.startOpeningSkeleton()">${esc(copy.continue)}</button>
            <button class="secondary fantasy-action-button" onclick="FE.renderStart()">${esc(copy.back)}</button>
          </div>
        </div>
        <div class="v59-prologue-figure">
          ${hiddenTravelerHTML(heroName, {hp:100,maxHp:100,mana:18,maxMana:18})}
        </div>
      </div>
    </div>
  `;
}

export function startOpeningSkeleton(){
  heroName = byId("heroName")?.value?.trim() || "Xexe";
  const copy = openingCopy();
  skeleton = {
    turn:1,
    hero:{hp:100,maxHp:100,mana:18,maxMana:18,potions:2},
    enemy:{name:tx("roadSkeleton"),role:tx("tutorialEnemy"),enemyVisualClass:"skeleton",hp:52,maxHp:52},
    defending:false,
    pose:"idle",
    tip:copy.tutorialHint,
    log:[
      getLanguage()==="es" ? "Despiertas bajo Ashen Keep con una espada oxidada en la mano." : "You wake below Ashen Keep with a rusted sword in your hand.",
      getLanguage()==="es" ? "Los huesos raspan el camino. Un esqueleto se levanta entre las cenizas." : "Bones scrape the road. A skeleton rises from the ash."
    ]
  };
  renderSkeleton();
}

export function renderSkeleton(){
  const t = dictionary();
  const copy = openingCopy();
  const enemyPose = skeleton.pose || "idle";
  byId("setup").innerHTML = `
    <div class="v59-tutorial-screen opening-scene opening-scene-skeleton">
      ${openingAtmosphereHTML()}
      <div class="combat-shell combat-scene-v59-skeleton combat-tier-story opening-combat-shell">
        <div class="opening-combat-title">
          <span>${esc(t.tutorialBattle)}</span>
          <h1>${esc(t.roadSkeleton)}</h1>
          <p>${esc(t.tutorialSub)}</p>
        </div>
        <div class="combat-stage combat-battlefield opening-combat-stage" data-combat-viewport="stable">
          ${cinematicBackDropHTML("skeleton")}
          <div class="combat-atmosphere-layer" aria-hidden="true">
            <span class="combat-fog"></span>
            <span class="combat-embers"></span>
            <span class="combat-light-sweep"></span>
          </div>
          <div class="opening-guidance-card">
            <span>${esc(t.goal)}</span>
            <p>${esc(skeleton.tip || copy.skeletonHint)}</p>
          </div>
          <div class="combat-area party-area">
            <h2>${esc(heroName)} ${esc(t.yourTurn)}</h2>
            <div class="combat-party-grid">
              ${hiddenTravelerHTML(heroName, skeleton.hero)}
            </div>
          </div>
          <div class="combat-area enemy-area">
            <h2>${esc(t.round)} ${skeleton.turn}</h2>
            <div class="combat-enemy-grid">
              ${enemyTutorialCardHTML(skeleton.enemy, enemyPose)}
            </div>
          </div>
        </div>
        <div class="actions combat-actions opening-actions">
          <div class="grid3 opening-tutorial-action-grid">
            <button class="primary" onclick="FE.tutorialAttack()">${t.attack}</button>
            <button onclick="FE.tutorialDefend()">${t.defend}</button>
            <button onclick="FE.tutorialPotion()">${t.potion} (${skeleton.hero.potions})</button>
            <button class="secondary" onclick="FE.tutorialExplain()">${t.help}</button>
            <button class="danger" onclick="FE.startDragonIntro()">${t.skip}</button>
          </div>
        </div>
        <div class="opening-combat-log">${skeleton.log.slice(-6).map(line=>`<span>${esc(line)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}

export function tutorialAttack(){
  const copy = openingCopy();
  const dmg = 12 + Math.floor(Math.random()*9);
  skeleton.enemy.hp = Math.max(0,skeleton.enemy.hp-dmg);
  skeleton.pose = "hurt";
  skeleton.tip = copy.skeletonHint;
  skeleton.log.push(`${heroName} ${tx("heroHits")} ${dmg}.`);
  if(skeleton.enemy.hp<=0)return tutorialVictory();
  skeletonEnemyTurn(false);
  renderSkeleton();
}

export function tutorialSkill(){
  skeleton.tip = openingCopy().skillLocked;
  skeleton.log.push(tx("noClass"));
  renderSkeleton();
}

export function tutorialPotion(){
  const copy = openingCopy();
  if(skeleton.hero.potions<=0){
    skeleton.tip = tx("noPotions");
    skeleton.log.push(tx("noPotions"));
    renderSkeleton();
    return;
  }
  skeleton.hero.potions--;
  skeleton.hero.hp = Math.min(skeleton.hero.maxHp,skeleton.hero.hp+35);
  skeleton.pose = "idle";
  skeleton.tip = copy.potionHint;
  skeleton.log.push(`${heroName} ${tx("heroPotion")}`);
  skeletonEnemyTurn(false);
  renderSkeleton();
}

export function tutorialDefend(){
  skeleton.pose = "attack";
  skeleton.tip = openingCopy().defendHint;
  skeleton.log.push(`${heroName} ${tx("heroDefend")}`);
  skeletonEnemyTurn(true);
  renderSkeleton();
}

export function tutorialExplain(){
  skeleton.tip = tx("combatBasicsBody");
  renderSkeleton();
}

function skeletonEnemyTurn(defending){
  let dmg = 8 + Math.floor(Math.random()*8);
  if(defending)dmg = Math.max(1,Math.floor(dmg*.45));
  skeleton.hero.hp = Math.max(1,skeleton.hero.hp-dmg);
  skeleton.pose = "attack";
  skeleton.log.push(`${tx("skeletonHit")} ${heroName} for ${dmg}.`);
  skeleton.turn++;
}

function tutorialVictory(){
  byId("setup").innerHTML = `
    <div class="v59-victory-screen opening-scene opening-scene-skeleton">
      ${openingAtmosphereHTML()}
      <div class="v59-cinematic-card">
        <span class="v59-title-kicker">${tx("tutorialBattle")}</span>
        <h1>${tx("firstVictory")}</h1>
        <p>${tx("firstVictoryBody")}</p>
        <button class="primary" onclick="FE.startDragonIntro()">${tx("continueKeep")}</button>
      </div>
    </div>
  `;
}

export function startDragonIntro(){
  const t = dictionary();
  dragon = {moment:0,hero:{barrier:999},knight:{hp:2600,maxHp:2600},dragon:{hp:9999,maxHp:9999},log:[...t.dragonStart]};
  renderDragon();
}

export function renderDragon(){
  const t = dictionary();
  const copy = openingCopy();
  const moment = t.dragonMoments[Math.min(dragon.moment,t.dragonMoments.length-1)];
  const kaelArt = uniquePortrait("ser_kael")?.asset || "assets/portraits/story/ser-kael-painted.png";
  const dragonArt = uniquePortrait("diseased_dragon")?.asset || "assets/portraits/story/diseased-dragon-painted.png";
  const survivorBarrier = Math.max(0,dragon.hero.barrier);
  byId("setup").innerHTML = `
    <div class="v59-dragon-screen opening-scene opening-scene-dragon">
      ${openingAtmosphereHTML()}
      <div class="combat-shell combat-scene-v59-dragon combat-tier-legendary opening-combat-shell">
        <div class="opening-combat-title opening-dragon-title">
          <span>${esc(copy.kaelShowcase)}</span>
          <h1>${esc(t.dragonTitle)}</h1>
          <p>${esc(t.dragonSub)}</p>
        </div>
        <div class="combat-stage combat-battlefield opening-dragon-stage" data-combat-viewport="stable">
          ${cinematicBackDropHTML("dragon")}
          <div class="combat-atmosphere-layer" aria-hidden="true">
            <span class="combat-fog"></span>
            <span class="combat-embers"></span>
            <span class="combat-light-sweep"></span>
          </div>
          <div class="opening-dragon-actor" data-showcase-actor="dragon">
            <img src="${esc(dragonArt)}" alt="" loading="eager" decoding="async" draggable="false">
            <span class="opening-dragon-shadow"></span>
            <div class="opening-legend-plate">
              <b>${esc(t.diseasedDragon)} - Lv 99</b>
              <span>${esc(t.dragonPortraitText)}</span>
              ${bar(dragon.dragon.hp,dragon.dragon.maxHp)}
            </div>
          </div>
          <div class="opening-kael-actor" data-showcase-actor="kael">
            <img src="${esc(kaelArt)}" alt="" loading="eager" decoding="async" draggable="false">
            <span class="opening-kael-radiance"></span>
            <div class="opening-legend-plate">
              <b>Ser Kael - Lv 75</b>
              <span>${esc(t.radiantKnight)}</span>
              ${bar(dragon.knight.hp,dragon.knight.maxHp)}
            </div>
          </div>
          <div class="opening-protected-survivor">
            ${hiddenTravelerHTML(heroName, {hp:100,maxHp:100,mana:survivorBarrier,maxMana:999})}
            <span class="opening-barrier-ring"></span>
          </div>
          <div class="opening-guidance-card opening-dragon-moment">
            <span>${esc(moment[0])}</span>
            <p>${esc(moment[1])}</p>
          </div>
        </div>
        <div class="opening-combat-log">${dragon.log.slice(-6).map(line=>`<span>${esc(line)}</span>`).join("")}</div>
        <div class="actions combat-actions opening-actions">
          <div class="grid">
            <button class="primary" onclick="FE.nextDragonMoment()">${dragon.moment>=t.dragonMoments.length-1?t.wakeKeep:t.nextMoment}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function nextDragonMoment(){
  const t = dictionary();
  const moment = t.dragonMoments[dragon.moment];
  if(moment){
    dragon.knight.hp = Math.max(0,dragon.knight.hp-moment[2]);
    dragon.dragon.hp = Math.max(0,dragon.dragon.hp-moment[3]);
    if(moment[3])dragon.log.push(`${t.kaelDamage} ${moment[3]}.`);
    if(moment[2])dragon.log.push(`${t.dragonDamage} ${moment[2]}.`);
  }
  dragon.moment++;
  if(dragon.moment >= t.dragonMoments.length){
    byId("setup").innerHTML = `
      <div class="v59-keep-wake-screen opening-scene opening-scene-keep">
        ${openingAtmosphereHTML()}
        <div class="v59-keep-wake-stage">
          ${cinematicBackDropHTML("keep")}
          <div class="v59-cinematic-card">
            <span class="v59-title-kicker">${esc(t.ashenKeep)}</span>
            <h1>${esc(t.wakeKeep)}</h1>
            ${t.wakeStory.map(line=>`<p>${esc(line)}</p>`).join("")}
            <button class="primary" onclick="FE.classChoice(${jsArg(heroName)})">${t.chooseClass}</button>
          </div>
        </div>
      </div>
    `;
    return;
  }
  renderDragon();
}

export function classChoice(name){
  heroName = name || heroName || "Xexe";
  const t = dictionary();
  const copy = openingCopy();
  byId("setup").innerHTML = `
    <div class="v59-class-screen opening-scene opening-scene-keep">
      ${openingAtmosphereHTML()}
      <div class="v59-class-hero">
        ${cinematicBackDropHTML("keep")}
        <div class="v59-class-copy">
          <span class="v59-title-kicker">${esc(copy.classKicker)}</span>
          <h1>${esc(t.choosePath)}</h1>
          <p>${esc(copy.classSub)}</p>
          <span>${esc(t.pathNote)}</span>
        </div>
      </div>
      <div class="class-path-grid v59-class-path-grid">
        ${Object.entries(CLASSES).map(([id,c])=>`
          <div class="choice-card class-path-card v59-class-path-card class-path-${esc(id)}">
            <div class="class-card-visual v59-class-card-visual">
              ${portraitHTML(heroPortrait({class:id}))}
              <span class="v59-class-ground"></span>
            </div>
            <div class="class-card-copy">
              <span class="v59-title-kicker">${esc(localizedClassName(id,c.name))}</span>
              <h2>${esc(localizedClassName(id,c.name))}</h2>
              <p class="class-flavor">${esc(classFlavor(id))}</p>
              <div class="v59-class-stat-row">
                ${Object.entries(c.stats).filter(([,value])=>value > 0).slice(0,3).map(([stat,value])=>`
                  <span class="pill">${statName(stat)} ${value}</span>
                `).join("")}
              </div>
              <p class="v59-class-abilities">${c.abilities.map(title).join(" | ")}</p>
              <button class="primary" onclick="FE.startActualGame(${jsArg(heroName)},'${id}')">${t.choose} ${esc(localizedClassName(id,c.name))}</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  stabilizeClassChoiceScroll();
}

function stabilizeClassChoiceScroll(){
  const setup = byId("setup");
  const screen = setup?.querySelector(".v59-class-screen");
  if(!screen)return;
  const reset = () => {
    window.scrollTo({top:0,left:0,behavior:"auto"});
    setup.scrollTop = 0;
    setup.scrollLeft = 0;
    screen.scrollTop = 0;
    screen.scrollLeft = 0;
  };
  reset();
  requestAnimationFrame(reset);
  screen.addEventListener("scroll", () => {
    screen.scrollLeft = 0;
  }, {passive:true});
  screen.querySelectorAll("button").forEach(button => {
    button.addEventListener("focus", () => requestAnimationFrame(() => {
      window.scrollTo({top:0,left:0,behavior:"auto"});
      screen.scrollLeft = 0;
    }));
  });
}

export function startActualGame(name,classId){
  const next = createNewState(name,classId);
  next.settings.language = getLanguage();
  setState(next);
  save(1);
  startGame();
  showMainTutorial(false);
}

export function showMainTutorial(force=true){
  if(!state)return;
  const key = `${getLanguage()}_home`;
  if(!force && state.tutorialsSeen[key])return;
  state.tutorialsSeen[key] = true;
  save();
  setTimeout(()=>modal(tx("mainTutorialTitle"), `<p>${tx("mainTutorialBody")}</p>`, [{label:tx("close"),cls:"secondary"}]),250);
}
