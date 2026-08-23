import { dictionary, getLanguage } from "./language.js";
import { applyGearVisuals, normalizeGearObject } from "./gearVisuals.js";

export const SAVE_PREFIX = "fallenEmpireSave_";
export const ACTIVE_SLOT = "fallenEmpireActiveSlot";
export const ABILITY_SLOT_COUNT = 4;
export const ABILITY_MILESTONE_LEVELS = [5,10,15,20];
export const CM_ALLOCATIONS = [0,25,50,75,100];

export const REGIONS = [
  {id:"ashen_fields",name:"Ashen Fields",desc:"Burned roads, low ruins, and the first safe hunts.",min:1,max:10,tier:1,travel:1,element:"fire"},
  {id:"green_march",name:"Green March",desc:"Bandits, beasts, and old watchtowers swallowed by vines.",min:8,max:20,tier:2,travel:3,element:"poison"},
  {id:"frostmere",name:"Frostmere",desc:"Frozen lakes and soldiers who never came home.",min:18,max:35,tier:3,travel:5,element:"frost"},
  {id:"storm_coast",name:"Storm Coast",desc:"Lightning over black cliffs and raiders under torn sails.",min:32,max:50,tier:4,travel:7,element:"lightning"},
  {id:"hollow_kingdom",name:"Hollow Kingdom",desc:"Dead banners still fly above cursed roads and ancient cities.",min:48,max:75,tier:5,travel:10,element:"shadow"}
];

export const CLASSES = {
  warrior:{name:"Warrior",stats:{strength:4,endurance:4,speed:1,wisdom:0,luck:1},abilities:["power_strike","guard_wall"]},
  rogue:{name:"Rogue",stats:{strength:2,endurance:2,speed:4,wisdom:0,luck:3},abilities:["quick_strike","smoke_step"]},
  mage:{name:"Mage",stats:{strength:0,endurance:1,speed:2,wisdom:5,luck:1},abilities:["fire_bolt","minor_mend"]},
  ranger:{name:"Ranger",stats:{strength:3,endurance:2,speed:3,wisdom:1,luck:2},abilities:["aimed_shot","field_mend"]},
  cleric:{name:"Cleric",stats:{strength:1,endurance:3,speed:1,wisdom:4,luck:1},abilities:["minor_mend","holy_guard"]}
};

export const ADVANCED_CLASSES = {
  vanguard:{
    name:"Vanguard",baseClass:"warrior",level:2,cmCost:0,role:"Shield line",
    desc:"A front-line oath class that turns defense into control.",
    abilities:["taunt","second_wind"],focusWeapons:["sword","mace"],focusSchools:[],
    bonus:{defense:3,physicalDamagePct:.03},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Vanguard Oath",desc:"Your path techniques gain steadier impact and protection."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Shield-Line Command",desc:"Favored weapons and defensive actions scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Hold the Gate",desc:"Your full Vanguard kit gains a stronger combat edge."}
    ]
  },
  berserker:{
    name:"Berserker",baseClass:"warrior",level:2,cmCost:0,role:"Axe breaker",
    desc:"A brutal class that rewards heavy weapons and finishing pressure.",
    abilities:["cleave","execute"],focusWeapons:["axe","sword"],focusSchools:[],
    bonus:{attack:2,physicalDamagePct:.06},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Blood Heat",desc:"Physical class techniques hit harder."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Axe Hunger",desc:"Favored weapons gain stronger mastery scaling."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Ruin Swing",desc:"Your Berserker kit gains a larger damage edge."}
    ]
  },
  shadowblade:{
    name:"Shadowblade",baseClass:"rogue",level:2,cmCost:0,role:"Dagger shadow",
    desc:"A knife-and-smoke class built around ambushes and dark tricks.",
    abilities:["shadow_strike","vanish"],focusWeapons:["dagger"],focusSchools:["shadow"],
    bonus:{crit:4,physicalDamagePct:.04},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Night Steel",desc:"Shadowblade attacks gain sharper burst."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Knife in Smoke",desc:"Daggers and shadow skills scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Black Alley Finish",desc:"Your full Shadowblade kit gains a stronger combat edge."}
    ]
  },
  duelist:{
    name:"Duelist",baseClass:"rogue",level:2,cmCost:0,role:"Crit duelist",
    desc:"A precise class that wins by timing, speed, and clean openings.",
    abilities:["backstab","crippling_cut"],focusWeapons:["sword","dagger"],focusSchools:[],
    bonus:{crit:5,physicalDamagePct:.04},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Measured Footwork",desc:"Duelist actions gain steadier damage."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Perfect Line",desc:"Favored blades gain stronger mastery scaling."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Court Killer",desc:"Your full Duelist kit gains a stronger combat edge."}
    ]
  },
  pyromancer:{
    name:"Pyromancer",baseClass:"mage",level:2,cmCost:0,role:"Fire caster",
    desc:"A battle spell class that pushes flame damage and burn pressure.",
    abilities:["flame_wave","ember_lance"],focusWeapons:["staff"],focusSchools:["fire"],
    bonus:{spellDamagePct:.06,manaDiscount:1},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Firebrand",desc:"Path spells gain stronger damage."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Cinder Study",desc:"Fire spells and staves scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Ashen Crown",desc:"Your full Pyromancer kit gains a stronger combat edge."}
    ]
  },
  arcanist:{
    name:"Arcanist",baseClass:"mage",level:2,cmCost:0,role:"Arcane control",
    desc:"A focused class for mana control, barriers, and arcane strikes.",
    abilities:["arcane_burst","mana_shield"],focusWeapons:["staff"],focusSchools:["arcane"],
    bonus:{spellDamagePct:.04,manaDiscount:2},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Arcane Thesis",desc:"Arcane actions become more efficient."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Staff Geometry",desc:"Arcane spells and staves scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Circle Mastery",desc:"Your full Arcanist kit gains a stronger combat edge."}
    ]
  },
  warden:{
    name:"Warden",baseClass:"ranger",level:2,cmCost:0,role:"Wild guardian",
    desc:"A survival class that mixes traps, field medicine, and rough terrain.",
    abilities:["trap_snare","nature_mend"],focusWeapons:["bow","sword"],focusSchools:["restoration"],
    bonus:{defense:1,healingPct:.05,physicalDamagePct:.03},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Green Oath",desc:"Warden attacks and medicine gain steadier output."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Snarecraft",desc:"Bows and restoration field skills scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Old Road Law",desc:"Your full Warden kit gains a stronger combat edge."}
    ]
  },
  marksman:{
    name:"Marksman",baseClass:"ranger",level:2,cmCost:0,role:"Bow striker",
    desc:"A ranged class that rewards bow use, precision, and tempo.",
    abilities:["piercing_shot","rapid_shot"],focusWeapons:["bow"],focusSchools:[],
    bonus:{crit:4,physicalDamagePct:.06},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Long Sight",desc:"Marksman shots gain stronger damage."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Bowline Rhythm",desc:"Bows gain stronger mastery scaling."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"No Second Arrow",desc:"Your full Marksman kit gains a stronger combat edge."}
    ]
  },
  templar:{
    name:"Templar",baseClass:"cleric",level:2,cmCost:0,role:"Holy bruiser",
    desc:"A warded battle class that mixes mace blows with holy force.",
    abilities:["smite","holy_guard"],focusWeapons:["mace","sword"],focusSchools:["holy"],
    bonus:{defense:2,spellDamagePct:.03,healingPct:.03},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Iron Prayer",desc:"Templar actions gain steadier damage and protection."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Consecrated Grip",desc:"Maces, blades, and holy skills scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Candle Against Kings",desc:"Your full Templar kit gains a stronger combat edge."}
    ]
  },
  oracle:{
    name:"Oracle",baseClass:"cleric",level:2,cmCost:0,role:"Restoration seer",
    desc:"A support class for restoration, wards, and long fights.",
    abilities:["renew","sanctuary"],focusWeapons:["staff","mace"],focusSchools:["restoration","holy"],
    bonus:{healingPct:.08,manaDiscount:1},
    mastery:[
      {suffix:"adept",branch:"Path",cost:1,level:2,spent:0,name:"Mercy Sight",desc:"Oracle healing and holy actions improve."},
      {suffix:"specialist",branch:"Signature",cost:2,level:4,spent:1,name:"Warded Vision",desc:"Restoration, holy skills, and focus weapons scale higher."},
      {suffix:"capstone",branch:"Capstone",cost:3,level:7,spent:3,name:"Last Candle",desc:"Your full Oracle kit gains a stronger combat edge."}
    ]
  }
};

export const WEAPON_TYPES = {
  sword:{name:"Sword",desc:"Balanced blades with steady damage and crit growth."},
  axe:{name:"Axe",desc:"Heavy weapons that push physical damage growth."},
  dagger:{name:"Dagger",desc:"Fast blades that favor crit and rogue paths."},
  bow:{name:"Bow",desc:"Ranged weapons for careful shots and ranger paths."},
  staff:{name:"Staff",desc:"Focus weapons for spell damage and mana classes."},
  mace:{name:"Mace",desc:"Blunt weapons for warded clerics and bruisers."},
  unarmed:{name:"Unarmed",desc:"Fallback fighting when no weapon is equipped."}
};

export const SPELL_SCHOOLS = {
  fire:{name:"Fire",desc:"Flame, ember, and meteor spells."},
  frost:{name:"Frost",desc:"Ice and frost control spells."},
  storm:{name:"Storm",desc:"Lightning and storm spells."},
  arcane:{name:"Arcane",desc:"Mana, barrier, and arcane force."},
  holy:{name:"Holy",desc:"Radiant, smite, judgment, and warding light."},
  restoration:{name:"Restoration",desc:"Healing, renewals, and field medicine."},
  shadow:{name:"Shadow",desc:"Smoke, vanish, and shadow strikes."}
};

export const COMPANION_ROLES = {
  fighter:{
    name:"Fighter",
    desc:"Balanced front-line help with reliable attacks.",
    abilities:["strike","guard_wall"],
    tactic:"balanced",
    stats:{hp:96,mana:18,attack:10,defense:5,speed:5}
  },
  scout:{
    name:"Scout",
    desc:"Fast companion for pressure, crits, and road work.",
    abilities:["quick_strike","smoke_step"],
    tactic:"aggressive",
    stats:{hp:84,mana:20,attack:11,defense:4,speed:8}
  },
  guard:{
    name:"Guard",
    desc:"Defensive companion that can protect the hero.",
    abilities:["shield_bash","guard_wall"],
    tactic:"guardian",
    stats:{hp:112,mana:15,attack:9,defense:8,speed:4}
  },
  healer:{
    name:"Healer",
    desc:"Support companion that spends turns restoring wounded allies.",
    abilities:["minor_mend","holy_guard"],
    tactic:"support",
    stats:{hp:82,mana:34,attack:7,defense:4,speed:5}
  },
  mystic:{
    name:"Mystic",
    desc:"Spell companion with stronger mana and burst damage.",
    abilities:["fire_bolt","minor_mend"],
    tactic:"balanced",
    stats:{hp:78,mana:40,attack:8,defense:3,speed:6}
  }
};

export const COMPANION_TACTICS = {
  balanced:{name:"Balanced",desc:"Attack normally and use role instincts."},
  aggressive:{name:"Aggressive",desc:"Higher damage, less caution."},
  guardian:{name:"Guardian",desc:"Often protects the hero instead of attacking."},
  support:{name:"Support",desc:"Prioritizes healing wounded allies."}
};

export function companionBondNeed(level=1){
  const n = Math.max(1,Number(level) || 1);
  return 55 + n * 45;
}

export function companionTrainingNeed(rank=0){
  const n = Math.max(0,Number(rank) || 0);
  return 40 + n * 35;
}

export function companionTrainingCost(companion){
  const rank = companion?.training?.rank || 0;
  return {
    gold:10 + (companion?.level || 1) * 2 + rank * 5,
    food:rank >= 3 ? 1 : 0
  };
}

export function companionRoleDefinition(role){
  return COMPANION_ROLES[role] || COMPANION_ROLES.fighter;
}

export function companionTacticDefinition(tactic){
  return COMPANION_TACTICS[tactic] || COMPANION_TACTICS.balanced;
}

export function normalizeCompanion(companion,index=0,numFn=null){
  if(!companion)return null;
  const num = numFn || ((value,fallback=0)=>Number.isFinite(Number(value)) ? Number(value) : fallback);
  companion.id ||= "c_"+index+"_"+Date.now();
  const role = COMPANION_ROLES[companion.role] ? companion.role
    : COMPANION_ROLES[companion.class] ? companion.class
    : /mira|scout|ranger|hunter/i.test(`${companion.name || ""} ${companion.class || ""}`) ? "scout"
    : /heal|cleric|sella/i.test(`${companion.name || ""} ${companion.class || ""}`) ? "healer"
    : /mage|mystic|caster/i.test(`${companion.name || ""} ${companion.class || ""}`) ? "mystic"
    : /guard|knight|soldier/i.test(`${companion.name || ""} ${companion.class || ""}`) ? "guard"
    : "fighter";
  const def = companionRoleDefinition(role);
  companion.role = role;
  companion.class = role;
  companion.name ||= "Companion";
  companion.rarity ||= "common";
  companion.level = Math.max(1,Math.floor(num(companion.level,1)));
  companion.xp = Math.max(0,Math.floor(num(companion.xp,0)));
  companion.nextXp ||= xpNeed(companion.level);
  companion.tactic = COMPANION_TACTICS[companion.tactic] ? companion.tactic : def.tactic;
  companion.bond ||= {level:1,xp:0};
  companion.bond.level = clamp(Math.floor(num(companion.bond.level,1)),1,20);
  companion.bond.xp = Math.max(0,Math.floor(num(companion.bond.xp,0)));
  companion.training ||= {rank:0,xp:0};
  companion.training.rank = clamp(Math.floor(num(companion.training.rank,0)),0,20);
  companion.training.xp = Math.max(0,Math.floor(num(companion.training.xp,0)));
  companion.loyalty = clamp(Math.floor(num(companion.loyalty,50)),0,100);
  companion.morale = clamp(Math.floor(num(companion.morale,50)),0,100);
  companion.known = [...new Set([...(companion.known || []),...def.abilities].filter(Boolean))];
  companion.abilityLoadout = Array.isArray(companion.abilityLoadout) && companion.abilityLoadout.length
    ? companion.abilityLoadout.filter(id=>companion.known.includes(id)).slice(0,4)
    : companion.known.slice(0,4);
  while(companion.abilityLoadout.length < 4)companion.abilityLoadout.push(null);
  const level = companion.level;
  const rank = companion.training.rank;
  companion.maxHp ||= def.stats.hp + level * 8 + rank * 5;
  companion.hp = clamp(Math.floor(num(companion.hp,companion.maxHp)),0,companion.maxHp);
  companion.maxMana ||= def.stats.mana + Math.floor(level * 2.5);
  companion.mana = clamp(Math.floor(num(companion.mana,companion.maxMana)),0,companion.maxMana);
  companion.attack ||= def.stats.attack + level * 2 + rank;
  companion.defense ||= def.stats.defense + level + Math.floor(rank / 2);
  companion.speed ||= def.stats.speed;
  if(typeof companion.active === "undefined")companion.active = true;
  return companion;
}

export function grantCompanionBond(companion,xp=0){
  normalizeCompanion(companion);
  companion.bond.xp += Math.max(0,Math.floor(Number(xp) || 0));
  let gained = 0;
  while(companion.bond.level < 20 && companion.bond.xp >= companionBondNeed(companion.bond.level)){
    companion.bond.xp -= companionBondNeed(companion.bond.level);
    companion.bond.level++;
    companion.loyalty = clamp((companion.loyalty || 50) + 3,0,100);
    gained++;
  }
  return gained;
}

function advancedClassMasteryNodes(){
  return Object.entries(ADVANCED_CLASSES).flatMap(([classId,path])=>
    path.mastery.map(item=>({
      id:`${classId}_${item.suffix}`,
      classId,
      branch:item.branch,
      cost:item.cost,
      level:item.level,
      spent:item.spent,
      requires:item.suffix==="adept" ? [] : [`${classId}_${item.suffix==="specialist" ? "adept" : "specialist"}`],
      passive:`${classId}_${item.suffix}`,
      name:{en:item.name,es:item.name},
      desc:{en:item.desc,es:item.desc}
    }))
  );
}

export const CLASS_MASTERY = [
  {id:"warrior_battle_endurance",classId:"warrior",branch:"Vanguard",cost:1,level:1,spent:0,passive:"warrior_battle_endurance",name:{en:"Battle Endurance",es:"Resistencia de batalla"},desc:{en:"Victory restores a slice of HP, letting a Warrior keep pressure after hard fights.",es:"La victoria restaura parte de los PV para mantener la presion tras peleas duras."}},
  {id:"warrior_shield_discipline",classId:"warrior",branch:"Vanguard",cost:1,level:1,spent:0,passive:"warrior_shield_discipline",name:{en:"Shield Discipline",es:"Disciplina de escudo"},desc:{en:"Offhands and defensive stances give more protection.",es:"Las manos secundarias y posturas defensivas protegen mas."}},
  {id:"warrior_armor_splitter",classId:"warrior",branch:"Breaker",cost:2,level:3,spent:1,requires:["warrior_battle_endurance"],passive:"warrior_armor_splitter",name:{en:"Armor Splitter",es:"Rompearmadura"},desc:{en:"Physical attacks and techniques ignore some enemy defense.",es:"Ataques y tecnicas fisicas ignoran parte de la defensa enemiga."}},
  {id:"warrior_double_strike",classId:"warrior",branch:"Breaker",cost:2,level:5,spent:2,requires:["warrior_armor_splitter"],passive:"warrior_double_strike",name:{en:"Double-Strike Prep",es:"Preparacion doble golpe"},desc:{en:"Basic attacks can follow with a second lighter hit.",es:"Los ataques basicos pueden seguir con un segundo golpe menor."}},
  {id:"warrior_guard_wall",classId:"warrior",branch:"Bulwark",cost:3,level:8,spent:4,requires:["warrior_shield_discipline"],passive:"warrior_guard_wall",name:{en:"Guard Wall",es:"Muro de guardia"},desc:{en:"Defend cuts incoming damage more sharply.",es:"Defender reduce el dano recibido con mas fuerza."}},
  {id:"warrior_last_stand",classId:"warrior",branch:"Bulwark",cost:3,level:10,spent:6,requires:["warrior_guard_wall","warrior_double_strike"],passive:"warrior_last_stand",name:{en:"Last Stand",es:"Ultima resistencia"},desc:{en:"Once per battle, a lethal blow leaves you barely standing.",es:"Una vez por batalla, un golpe letal te deja apenas en pie."}},

  {id:"rogue_critical_precision",classId:"rogue",branch:"Knives",cost:1,level:1,spent:0,passive:"rogue_critical_precision",name:{en:"Critical Precision",es:"Precision critica"},desc:{en:"Critical chance rises and critical hits bite harder.",es:"Sube la probabilidad critica y los criticos golpean mas fuerte."}},
  {id:"rogue_evasion",classId:"rogue",branch:"Shadows",cost:1,level:1,spent:0,passive:"rogue_evasion",name:{en:"Evasion",es:"Evasion"},desc:{en:"Enemy attacks can miss outright.",es:"Los ataques enemigos pueden fallar por completo."}},
  {id:"rogue_bleed_pressure",classId:"rogue",branch:"Knives",cost:2,level:3,spent:1,requires:["rogue_critical_precision"],passive:"rogue_bleed_pressure",name:{en:"Bleed Pressure",es:"Presion sangrante"},desc:{en:"Physical hits add a small follow-up wound.",es:"Los golpes fisicos agregan una pequena herida adicional."}},
  {id:"rogue_ambush_discipline",classId:"rogue",branch:"Shadows",cost:2,level:5,spent:2,requires:["rogue_evasion"],passive:"rogue_ambush_discipline",name:{en:"Ambush Discipline",es:"Disciplina de emboscada"},desc:{en:"Your first offensive action in a battle hits harder.",es:"Tu primera accion ofensiva de cada batalla golpea mas fuerte."}},
  {id:"rogue_smoke_footwork",classId:"rogue",branch:"Shadows",cost:3,level:8,spent:4,requires:["rogue_ambush_discipline"],passive:"rogue_smoke_footwork",name:{en:"Smoke Footwork",es:"Paso de humo"},desc:{en:"After defending, your next incoming hit is more likely to miss.",es:"Tras defender, el siguiente golpe recibido tiene mas opcion de fallar."}},
  {id:"rogue_deadly_timing",classId:"rogue",branch:"Knives",cost:3,level:10,spent:6,requires:["rogue_bleed_pressure"],passive:"rogue_deadly_timing",name:{en:"Deadly Timing",es:"Ritmo letal"},desc:{en:"Critical hits become severe finishers.",es:"Los criticos se vuelven remates severos."}},

  {id:"mage_mana_efficiency",classId:"mage",branch:"Arcane",cost:1,level:1,spent:0,passive:"mage_mana_efficiency",name:{en:"Mana Efficiency",es:"Eficiencia de mana"},desc:{en:"Combat abilities cost less mana.",es:"Las habilidades de combate cuestan menos mana."}},
  {id:"mage_spell_focus",classId:"mage",branch:"Elemental",cost:1,level:1,spent:0,passive:"mage_spell_focus",name:{en:"Spell Focus",es:"Enfoque de hechizo"},desc:{en:"Direct spell damage is stronger.",es:"El dano directo de hechizos es mayor."}},
  {id:"mage_arcane_recovery",classId:"mage",branch:"Arcane",cost:2,level:3,spent:1,requires:["mage_mana_efficiency"],passive:"mage_arcane_recovery",name:{en:"Arcane Recovery",es:"Recuperacion arcana"},desc:{en:"Victory restores mana.",es:"La victoria restaura mana."}},
  {id:"mage_elemental_amplification",classId:"mage",branch:"Elemental",cost:2,level:5,spent:2,requires:["mage_spell_focus"],passive:"mage_elemental_amplification",name:{en:"Elemental Amplification",es:"Amplificacion elemental"},desc:{en:"Fire, frost, lightning, and arcane attacks gain more force.",es:"Ataques de fuego, hielo, rayo y arcanos ganan mas fuerza."}},
  {id:"mage_arcane_barrier",classId:"mage",branch:"Arcane",cost:3,level:8,spent:4,requires:["mage_arcane_recovery"],passive:"mage_arcane_barrier",name:{en:"Arcane Barrier",es:"Barrera arcana"},desc:{en:"Incoming damage can burn a little mana to reduce the hit.",es:"El dano recibido puede gastar un poco de mana para reducir el golpe."}},
  {id:"mage_overchannel",classId:"mage",branch:"Elemental",cost:3,level:10,spent:6,requires:["mage_elemental_amplification"],passive:"mage_overchannel",name:{en:"Overchannel",es:"Sobrecarga"},desc:{en:"Offensive spells can surge for bonus damage.",es:"Los hechizos ofensivos pueden desbordarse con dano extra."}},

  {id:"ranger_bow_discipline",classId:"ranger",branch:"Marksman",cost:1,level:1,spent:0,passive:"ranger_bow_discipline",name:{en:"Bow Discipline",es:"Disciplina de arco"},desc:{en:"Physical techniques and careful shots hit harder.",es:"Tecnicas fisicas y disparos precisos golpean mas fuerte."}},
  {id:"ranger_beast_sense",classId:"ranger",branch:"Wilds",cost:1,level:1,spent:0,passive:"ranger_beast_sense",name:{en:"Beast Sense",es:"Sentido de bestia"},desc:{en:"You occasionally read an enemy attack before it lands.",es:"A veces lees un ataque enemigo antes de que conecte."}},
  {id:"ranger_survival_tactics",classId:"ranger",branch:"Wilds",cost:2,level:3,spent:1,requires:["ranger_beast_sense"],passive:"ranger_survival_tactics",name:{en:"Survival Tactics",es:"Tacticas de supervivencia"},desc:{en:"Potions heal more and incoming hit spikes are softened.",es:"Las pociones curan mas y los picos de dano se suavizan."}},
  {id:"ranger_precision_shots",classId:"ranger",branch:"Marksman",cost:2,level:5,spent:2,requires:["ranger_bow_discipline"],passive:"ranger_precision_shots",name:{en:"Precision Shots",es:"Disparos precisos"},desc:{en:"Critical chance rises on attacks and physical skills.",es:"Sube la probabilidad critica en ataques y tecnicas fisicas."}},
  {id:"ranger_trapper",classId:"ranger",branch:"Wilds",cost:3,level:8,spent:4,requires:["ranger_survival_tactics"],passive:"ranger_trapper",name:{en:"Trapper",es:"Trampero"},desc:{en:"Enemies start ordinary battles already snared and wounded.",es:"Los enemigos inician peleas normales atrapados y heridos."}},
  {id:"ranger_steady_aim",classId:"ranger",branch:"Marksman",cost:3,level:10,spent:6,requires:["ranger_precision_shots"],passive:"ranger_steady_aim",name:{en:"Steady Aim",es:"Punteria firme"},desc:{en:"Defending sharpens your next attack.",es:"Defender afila tu siguiente ataque."}},

  {id:"cleric_healing_focus",classId:"cleric",branch:"Restoration",cost:1,level:1,spent:0,passive:"cleric_healing_focus",name:{en:"Healing Focus",es:"Enfoque sanador"},desc:{en:"Healing abilities restore more HP.",es:"Las habilidades de sanacion restauran mas PV."}},
  {id:"cleric_divine_ward",classId:"cleric",branch:"Warding",cost:1,level:1,spent:0,passive:"cleric_divine_ward",name:{en:"Divine Warding",es:"Amparo divino"},desc:{en:"All incoming damage is slightly reduced.",es:"Todo dano recibido se reduce un poco."}},
  {id:"cleric_mana_prayer",classId:"cleric",branch:"Restoration",cost:2,level:3,spent:1,requires:["cleric_healing_focus"],passive:"cleric_mana_prayer",name:{en:"Mana Prayer",es:"Oracion de mana"},desc:{en:"Victory restores mana for continued support.",es:"La victoria restaura mana para seguir apoyando."}},
  {id:"cleric_undead_resistance",classId:"cleric",branch:"Warding",cost:2,level:5,spent:2,requires:["cleric_divine_ward"],passive:"cleric_undead_resistance",name:{en:"Undead Resistance",es:"Resistencia a no muertos"},desc:{en:"Skeletons, cultists, and cursed foes hurt you less.",es:"Esqueletos, cultistas y malditos te hacen menos dano."}},
  {id:"cleric_radiant_burst",classId:"cleric",branch:"Judgment",cost:3,level:8,spent:4,requires:["cleric_mana_prayer"],passive:"cleric_radiant_burst",name:{en:"Radiant Burst",es:"Estallido radiante"},desc:{en:"Holy and radiant attacks gain damage.",es:"Ataques sagrados y radiantes ganan dano."}},
  {id:"cleric_guardian_prayer",classId:"cleric",branch:"Warding",cost:3,level:10,spent:6,requires:["cleric_undead_resistance"],passive:"cleric_guardian_prayer",name:{en:"Guardian Prayer",es:"Oracion guardiana"},desc:{en:"Once per battle, a lethal blow leaves you alive.",es:"Una vez por batalla, un golpe letal te deja vivo."}},

  ...advancedClassMasteryNodes()
];

export const CLASS_ABILITY_POOLS = {
  warrior:["cleave","shield_bash","battle_shout","execute","iron_will","whirlwind","taunt","second_wind","armor_break","heroic_charge","war_cry","last_stand"],
  rogue:["backstab","poison_blade","evasion","shadow_strike","crippling_cut","fan_of_knives","vanish","bleed_out","cheap_shot","slice_tendon","smoke_bomb","knife_storm"],
  mage:["ice_shard","arcane_burst","flame_wave","mana_shield","chain_lightning","frost_nova","meteor_spark","greater_mend","ember_lance","arcane_barrier","storm_spark","renew_mana"],
  ranger:["piercing_shot","trap_snare","hawk_eye","volley","nature_mend","poison_arrow","rapid_shot","camouflage","barbed_arrow","steady_aim","beast_call","forest_guard"],
  cleric:["smite","renew","blessing","purify","judgment","sanctuary","radiant_burst","greater_mend","holy_fire","warding_prayer","cleanse_wounds","aegis_light"],
  vanguard:["taunt","second_wind","shield_bash","battle_shout","iron_will","last_stand"],
  berserker:["cleave","execute","armor_break","heroic_charge","war_cry","whirlwind"],
  shadowblade:["shadow_strike","vanish","backstab","poison_blade","bleed_out","knife_storm"],
  duelist:["backstab","crippling_cut","cheap_shot","slice_tendon","quick_strike","fan_of_knives"],
  pyromancer:["flame_wave","ember_lance","meteor_spark","fire_bolt","storm_spark","greater_mend"],
  arcanist:["arcane_burst","mana_shield","arcane_barrier","renew_mana","chain_lightning","frost_nova"],
  warden:["trap_snare","nature_mend","barbed_arrow","forest_guard","beast_call","camouflage"],
  marksman:["piercing_shot","rapid_shot","volley","hawk_eye","steady_aim","poison_arrow"],
  templar:["smite","holy_guard","radiant_burst","holy_fire","judgment","aegis_light"],
  oracle:["renew","sanctuary","greater_mend","warding_prayer","cleanse_wounds","blessing"]
};

export let state = null;
export let currentScreen = "home";

export function setScreen(id){
  currentScreen = id;
}

export function setState(next){
  state = next;
  normalize();
}

export function createNewState(name, classId){
  const c = CLASSES[classId] || CLASSES.warrior;
  return {
    settings:{language:getLanguage()},
    hero:{
      name:name || "Xexe", level:1, xp:0, nextXp:100, points:0, class:classId, advancedClass:null, unlockedClasses:[classId], classHistory:{[classId]:{unlockedAt:1}},
      stats:{...c.stats}, hp:120, maxHp:120, mana:45, maxMana:45, attack:10, defense:5, speed:5,
      accuracy:5, dodge:0, crit:3, resistance:0, resists:{fire:0,frost:0,poison:0,shadow:0,lightning:0},
      gold:18, food:5, ore:0, potions:2, manaPotions:1, inv:[], gear:{weapon:null,offhand:null,helmet:null,shoulders:null,chest:null,gloves:null,belt:null,legs:null,boots:null,cloak:null,ring:null},
      companions:[], known:[...c.abilities], abilityLoadout:[...c.abilities,null,null,null].slice(0,ABILITY_SLOT_COUNT),
      abilityMilestones:{claimed:{},pending:[]},
      mastery:{cmAllocation:0,cmXp:0,cmPoints:0,cmSpent:0,cmPurchases:{},weapon:{sword:{level:1,xp:0}},spells:{fire:{level:1,xp:0}}},
      commander:{level:1,xp:0,points:0,rank:"Militia",kingdom:null}, passives:{}
    },
    world:{
      region:0, locationId:"ashen_slums", previousLocationId:null, routeHistory:[], day:1, month:1, season:"Spring", threat:0, mainTutorialShown:false,
      locationStates:{}, roadStopStates:{}, serviceSceneStates:{}, dailyLocationEvents:{}, serviceUpgradeStates:{}, hardAreas:{attempts:{},clears:{}},
      lowerWard:createLowerWard(),
      story:[...(dictionary().initialStory || [])]
    },
    prologue:createSlumPrologue(),
    kingdoms:createKingdoms(),
    market:{items:[],day:0},
    tavern:{recruits:[],day:0},
    supporter:{interested:[],previewed:[],notes:[],readiness:[]},
    tutorialsSeen:{}
  };
}

export function normalize(){
  if(!state)return;
  state.settings ||= {language:getLanguage()};
  const num = (value,fallback=0)=>Number.isFinite(Number(value)) ? Number(value) : fallback;
  const h = state.hero;
  h.class ||= "warrior";
  if(!CLASSES[h.class])h.class = "warrior";
  if(h.advancedClass && (!ADVANCED_CLASSES[h.advancedClass] || ADVANCED_CLASSES[h.advancedClass].baseClass !== h.class))h.advancedClass = null;
  h.unlockedClasses ||= [h.class];
  h.unlockedClasses = [...new Set([h.class,...h.unlockedClasses])]
    .filter(id=>id === h.class || ADVANCED_CLASSES[id]?.baseClass === h.class);
  h.classHistory ||= {};
  h.classHistory[h.class] ||= {unlockedAt:h.level || 1};
  h.gold = num(h.gold);
  h.food = num(h.food);
  h.ore = num(h.ore);
  h.potions = num(h.potions);
  h.manaPotions = num(h.manaPotions);
  h.nextXp ||= xpNeed(h.level || 1);
  h.points ||= 0;
  h.stats ||= {};
  h.resists ||= {fire:0,frost:0,poison:0,shadow:0,lightning:0};
  h.inv ||= [];
  h.gear ||= {};
  normalizeGearObject(h.gear);
  h.inv = h.inv.map(item=>applyGearVisuals(item));
  h.companions ||= [];
  h.known ||= [];
  h.abilityMilestones ||= {claimed:{},pending:[]};
  h.abilityMilestones.claimed ||= {};
  h.abilityMilestones.pending ||= [];
  normalizeAbilityLoadout(h);
  h.mastery ||= {cmAllocation:0,cmXp:0,cmPoints:0,cmSpent:0,cmPurchases:{},weapon:{sword:{level:1,xp:0}},spells:{fire:{level:1,xp:0}}};
  h.mastery.cmAllocation = normalizeCMAllocation(h.mastery.cmAllocation);
  h.mastery.cmXp = num(h.mastery.cmXp);
  h.mastery.cmPoints = num(h.mastery.cmPoints);
  h.mastery.cmSpent = num(h.mastery.cmSpent);
  h.mastery.cmPurchases ||= {};
  normalizeWeaponMastery(h,num);
  normalizeSpellMastery(h,num);
  h.commander ||= {level:1,xp:0,points:0,rank:"Militia",kingdom:null};
  h.passives ||= {};
  syncMasteryPassives(h);
  state.world ||= {region:0,day:1,month:1,season:"Spring",threat:0,story:[]};
  state.world.locationId ||= "ashen_slums";
  state.world.previousLocationId ||= null;
  state.world.routeHistory ||= [];
  state.world.locationStates ||= {};
  state.world.roadStopStates ||= {};
  state.world.serviceSceneStates ||= {};
  state.world.dailyLocationEvents ||= {};
  state.world.serviceUpgradeStates ||= {};
  state.world.hardAreas ||= {attempts:{},clears:{}};
  state.world.hardAreas.attempts ||= {};
  state.world.hardAreas.clears ||= {};
  ensureLowerWardState(num);
  state.world.story ||= [];
  state.kingdoms ||= createKingdoms();
  state.market ||= {items:[],day:0};
  state.market.items ||= [];
  state.market.day = num(state.market.day);
  state.tavern ||= {recruits:[],day:0};
  state.tavern.recruits ||= [];
  state.tavern.day = num(state.tavern.day);
  state.supporter ||= {interested:[],previewed:[],notes:[],readiness:[]};
  state.supporter.interested = Array.isArray(state.supporter.interested) ? [...new Set(state.supporter.interested.filter(Boolean))] : [];
  state.supporter.previewed = Array.isArray(state.supporter.previewed) ? [...new Set(state.supporter.previewed.filter(Boolean))] : [];
  state.supporter.notes = Array.isArray(state.supporter.notes) ? state.supporter.notes.slice(-20) : [];
  state.supporter.readiness = Array.isArray(state.supporter.readiness) ? [...new Set(state.supporter.readiness.filter(Boolean))] : [];
  state.tutorialsSeen ||= {};
  normalizeSlumPrologue(num);
  h.companions.forEach((c,i)=>{
    normalizeCompanion(c,i,num);
  });
}

export function createSlumPrologue(){
  return {
    version:2,
    phase:"active",
    title:"Cinderhook Slum",
    goal:"Reach the Lower Ward gate",
    status:0,
    safety:2,
    danger:1,
    heat:0,
    debt:18,
    actionsTaken:0,
    coinGoal:35,
    statusGoal:8,
    safetyGoal:4,
    companion:{met:false,recruited:false,id:null},
    gang:{state:"warning",paid:0,defeated:false,nextDemandDay:3},
    lowerWardGate:{visited:false,unlocked:false},
    contracts:{active:null,completed:[],failed:[],chapterBossUnlocked:false,chapterBossDefeated:false},
    log:[
      "You wake in a patched slum shelter below Ashen Keep.",
      "The Lower Ward gate is visible above the smoke, but coin and reputation decide who climbs."
    ]
  };
}

export function createLowerWard(){
  return {
    version:1,
    entered:false,
    introSeen:false,
    influence:0,
    writs:0,
    trainerFavor:{},
    quests:{claimed:[]},
    recruitedCompanions:[],
    companionReports:0,
    commissions:0,
    log:[
      "The Lower Ward waits beyond the iron wicket.",
      "Class trainers, tax ledgers, and guarded alleys decide who climbs next."
    ]
  };
}

export function ensureLowerWardState(numFn=null){
  if(!state?.world)return null;
  const num = numFn || ((value,fallback=0)=>Number.isFinite(Number(value)) ? Number(value) : fallback);
  const base = createLowerWard();
  const current = state.world.lowerWard && typeof state.world.lowerWard === "object" ? state.world.lowerWard : {};
  state.world.lowerWard = {...base,...current};
  state.world.lowerWard.version = 1;
  state.world.lowerWard.entered = !!state.world.lowerWard.entered;
  state.world.lowerWard.introSeen = !!state.world.lowerWard.introSeen;
  state.world.lowerWard.influence = clamp(Math.floor(num(state.world.lowerWard.influence,base.influence)),0,100);
  state.world.lowerWard.writs = Math.max(0,Math.floor(num(state.world.lowerWard.writs,base.writs)));
  state.world.lowerWard.trainerFavor = state.world.lowerWard.trainerFavor && typeof state.world.lowerWard.trainerFavor === "object" ? state.world.lowerWard.trainerFavor : {};
  state.world.lowerWard.quests = state.world.lowerWard.quests && typeof state.world.lowerWard.quests === "object" ? state.world.lowerWard.quests : {...base.quests};
  state.world.lowerWard.quests.claimed = Array.isArray(state.world.lowerWard.quests.claimed) ? [...new Set(state.world.lowerWard.quests.claimed.filter(Boolean))] : [];
  state.world.lowerWard.recruitedCompanions = Array.isArray(state.world.lowerWard.recruitedCompanions) ? [...new Set(state.world.lowerWard.recruitedCompanions.filter(Boolean))] : [];
  state.world.lowerWard.companionReports = Math.max(0,Math.floor(num(state.world.lowerWard.companionReports,base.companionReports)));
  state.world.lowerWard.commissions = Math.max(0,Math.floor(num(state.world.lowerWard.commissions,base.commissions)));
  state.world.lowerWard.log = Array.isArray(state.world.lowerWard.log) && state.world.lowerWard.log.length ? state.world.lowerWard.log.slice(-12) : [...base.log];
  return state.world.lowerWard;
}

function normalizeSlumPrologue(num){
  const base = createSlumPrologue();
  const p = state.prologue && typeof state.prologue === "object" ? state.prologue : {};
  state.prologue = {...base,...p};
  state.prologue.version = 2;
  state.prologue.phase ||= "active";
  state.prologue.title ||= base.title;
  state.prologue.goal ||= base.goal;
  state.prologue.status = num(state.prologue.status);
  state.prologue.safety = clamp(num(state.prologue.safety,base.safety),0,10);
  state.prologue.danger = clamp(num(state.prologue.danger,base.danger),0,10);
  state.prologue.heat = clamp(num(state.prologue.heat),0,10);
  state.prologue.debt = Math.max(0,num(state.prologue.debt,base.debt));
  state.prologue.actionsTaken = num(state.prologue.actionsTaken);
  state.prologue.coinGoal = Math.max(1,num(state.prologue.coinGoal,base.coinGoal));
  state.prologue.statusGoal = Math.max(1,num(state.prologue.statusGoal,base.statusGoal));
  state.prologue.safetyGoal = Math.max(1,num(state.prologue.safetyGoal,base.safetyGoal));
  state.prologue.companion = {...base.companion,...(state.prologue.companion || {})};
  state.prologue.gang = {...base.gang,...(state.prologue.gang || {})};
  state.prologue.gang.paid = num(state.prologue.gang.paid);
  state.prologue.gang.nextDemandDay = num(state.prologue.gang.nextDemandDay,base.gang.nextDemandDay);
  state.prologue.lowerWardGate = {...base.lowerWardGate,...(state.prologue.lowerWardGate || {})};
  state.prologue.contracts = {...base.contracts,...(state.prologue.contracts || {})};
  state.prologue.contracts.completed = Array.isArray(state.prologue.contracts.completed) ? [...new Set(state.prologue.contracts.completed.filter(Boolean))] : [];
  state.prologue.contracts.failed = Array.isArray(state.prologue.contracts.failed) ? state.prologue.contracts.failed.filter(Boolean).slice(-12) : [];
  state.prologue.contracts.active = state.prologue.contracts.completed.includes(state.prologue.contracts.active) ? null : state.prologue.contracts.active || null;
  state.prologue.contracts.chapterBossUnlocked = !!state.prologue.contracts.chapterBossUnlocked;
  state.prologue.contracts.chapterBossDefeated = !!state.prologue.contracts.chapterBossDefeated;
  state.prologue.log = Array.isArray(state.prologue.log) && state.prologue.log.length ? state.prologue.log.slice(-18) : [...base.log];
}

export function save(slot=getActiveSlot()){
  if(!state)return;
  normalize();
  localStorage.setItem(SAVE_PREFIX+slot, JSON.stringify(state));
  localStorage.setItem(ACTIVE_SLOT, String(slot));
}

export function load(slot){
  const raw = localStorage.getItem(SAVE_PREFIX+slot);
  if(!raw)return false;
  setState(JSON.parse(raw));
  localStorage.setItem(ACTIVE_SLOT, String(slot));
  return true;
}

export function getActiveSlot(){
  return localStorage.getItem(ACTIVE_SLOT) || "1";
}

export function slotInfo(slot){
  const raw = localStorage.getItem(SAVE_PREFIX+slot);
  if(!raw)return null;
  try{
    const st = JSON.parse(raw);
    return {hero:st.hero, world:st.world};
  }catch(e){
    return false;
  }
}

export function createKingdoms(){
  return REGIONS.map((r,i)=>({
    id:"k"+i,name:r.name+" Crown",status:i%2?"At Peace":"Border Tension",
    king:{name:"King of "+r.name,level:80+i*3},
    capital:{name:r.name+" Capital",soldiers:50},
    forts:[{name:"North Fort",soldiers:30},{name:"South Fort",soldiers:30},{name:"East Fort",soldiers:30}],
    villages:[{name:"River Village",soldiers:15},{name:"Hill Village",soldiers:15}]
  }));
}

export function region(){
  return REGIONS[state?.world?.region || 0] || REGIONS[0];
}

export function rnd(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

export function clamp(n,min,max){
  return Math.max(min,Math.min(max,n));
}

export function pct(a,b){
  return Math.max(0,Math.min(100,Math.floor((a/Math.max(1,b))*100)));
}

export function xpNeed(level){
  return 80 + level * 45 + Math.floor(level * level * 12);
}

export function partyLimit(){
  return 2 + Math.floor((state?.hero?.level || 1)/10);
}

export function normalizeAbilityLoadout(hero=state?.hero){
  if(!hero)return [];
  hero.known = [...new Set((hero.known || []).filter(Boolean))];
  const known = new Set(hero.known);
  const source = Array.isArray(hero.abilityLoadout) && hero.abilityLoadout.length
    ? hero.abilityLoadout
    : hero.known.slice(0,ABILITY_SLOT_COUNT);
  const used = new Set();
  hero.abilityLoadout = Array.from({length:ABILITY_SLOT_COUNT},(_,i)=>{
    const id = source[i];
    if(!id || !known.has(id) || used.has(id))return null;
    used.add(id);
    return id;
  });
  return hero.abilityLoadout;
}

export function activeAbilities(hero=state?.hero){
  return normalizeAbilityLoadout(hero).filter(Boolean);
}

export function activeClassId(hero=state?.hero){
  if(hero?.advancedClass && ADVANCED_CLASSES[hero.advancedClass])return hero.advancedClass;
  return hero?.class && CLASSES[hero.class] ? hero.class : "warrior";
}

export function activeClassDefinition(hero=state?.hero){
  const id = activeClassId(hero);
  return ADVANCED_CLASSES[id] || CLASSES[id] || CLASSES.warrior;
}

export function classPathOptions(hero=state?.hero){
  const baseClass = hero?.class || "warrior";
  return Object.entries(ADVANCED_CLASSES)
    .filter(([,path])=>path.baseClass === baseClass)
    .map(([id,path])=>({id,...path}));
}

export function weaponTypeForItem(item){
  if(!item)return "unarmed";
  const explicit = String(item.weaponCategory || "").toLowerCase();
  if(WEAPON_TYPES[explicit])return explicit;
  const text = `${item.name || ""} ${item.visualVariant || ""} ${item.weaponType || ""}`.toLowerCase();
  if(/axe|hatchet|cleaver/.test(text))return "axe";
  if(/dagger|knife|dirk/.test(text))return "dagger";
  if(/bow|longshot|arrow/.test(text))return "bow";
  if(/staff|wand|rod/.test(text))return "staff";
  if(/mace|hammer|maul|club/.test(text))return "mace";
  if(/sword|blade|sabre|saber/.test(text))return "sword";
  return item.slot === "weapon" ? "sword" : "unarmed";
}

export function activeWeaponType(hero=state?.hero){
  return weaponTypeForItem(hero?.gear?.weapon);
}

export function weaponMasteryNeed(level=1){
  const n = Math.max(1,Number(level) || 1);
  return n * 100;
}

export function spellMasteryNeed(level=1){
  const n = Math.max(1,Number(level) || 1);
  return 80 + n * 70;
}

export function normalizeWeaponMastery(hero=state?.hero,numFn=null){
  if(!hero)return {};
  const num = numFn || ((value,fallback=0)=>Number.isFinite(Number(value)) ? Number(value) : fallback);
  hero.mastery ||= {};
  hero.mastery.weapon ||= {};
  Object.keys(WEAPON_TYPES).forEach(type=>{
    const track = hero.mastery.weapon[type] || {};
    hero.mastery.weapon[type] = {
      level:clamp(Math.floor(num(track.level,1)),1,100),
      xp:Math.max(0,Math.floor(num(track.xp,0)))
    };
  });
  return hero.mastery.weapon;
}

export function normalizeSpellMastery(hero=state?.hero,numFn=null){
  if(!hero)return {};
  const num = numFn || ((value,fallback=0)=>Number.isFinite(Number(value)) ? Number(value) : fallback);
  hero.mastery ||= {};
  hero.mastery.spells ||= {};
  Object.keys(SPELL_SCHOOLS).forEach(school=>{
    const track = hero.mastery.spells[school] || {};
    hero.mastery.spells[school] = {
      level:clamp(Math.floor(num(track.level,1)),1,100),
      xp:Math.max(0,Math.floor(num(track.xp,0)))
    };
  });
  return hero.mastery.spells;
}

export function weaponMasteryBonus(type=activeWeaponType(), hero=state?.hero){
  const safeType = WEAPON_TYPES[type] ? type : "unarmed";
  normalizeWeaponMastery(hero);
  const level = hero?.mastery?.weapon?.[safeType]?.level || 1;
  const damagePct = Math.min(.32,(level - 1) * .025);
  const critBonus = Math.min(12,Math.floor((level - 1) / 2));
  return {type:safeType,level,damagePct,damageMultiplier:1 + damagePct,critBonus};
}

export function spellSchoolForAbility(id){
  const low = String(id || "").toLowerCase();
  if(/heal|mend|renew|restore|cleanse|nature/.test(low))return "restoration";
  if(/fire|flame|ember|meteor|bolt/.test(low))return "fire";
  if(/ice|frost/.test(low))return "frost";
  if(/lightning|storm/.test(low))return "storm";
  if(/arcane|mana|barrier/.test(low))return "arcane";
  if(/holy|radiant|smite|judgment|blessing|sanctuary|purify|aegis|warding/.test(low))return "holy";
  if(/shadow|smoke|vanish/.test(low))return "shadow";
  return null;
}

export function spellSchoolMasteryBonus(school, hero=state?.hero){
  const safeSchool = SPELL_SCHOOLS[school] ? school : null;
  if(!safeSchool)return {school:null,level:0,damagePct:0,damageMultiplier:1,healingPct:0,healingMultiplier:1};
  normalizeSpellMastery(hero);
  const level = hero?.mastery?.spells?.[safeSchool]?.level || 1;
  const damagePct = Math.min(.34,(level - 1) * .03);
  const healingPct = Math.min(.3,(level - 1) * .028);
  return {school:safeSchool,level,damagePct,damageMultiplier:1 + damagePct,healingPct,healingMultiplier:1 + healingPct};
}

export function spellMasteryBonus(abilityId, hero=state?.hero){
  return spellSchoolMasteryBonus(spellSchoolForAbility(abilityId), hero);
}

export function normalizeCMAllocation(value){
  const n = Number(value) || 0;
  return CM_ALLOCATIONS.reduce((best,next)=>Math.abs(next-n)<Math.abs(best-n)?next:best,0);
}

export function cmPointNeed(mastery=state?.hero?.mastery){
  const m = mastery || {cmPoints:0,cmSpent:0};
  const earned = (Number(m.cmPoints) || 0) + (Number(m.cmSpent) || 0);
  return 100 + earned * 85 + Math.floor(earned * earned * 15);
}

export function cmNodeById(id){
  return CLASS_MASTERY.find(node=>node.id===id);
}

export function classMasteryNodes(classId=activeClassId(state?.hero)){
  return CLASS_MASTERY.filter(node=>node.classId === classId);
}

export function syncMasteryPassives(hero=state?.hero){
  if(!hero)return;
  hero.passives ||= {};
  Object.keys(hero.mastery?.cmPurchases || {}).forEach(id=>{
    const node = cmNodeById(id);
    if(node?.passive)hero.passives[node.passive] = true;
  });
}

export function abilityChoicesForMilestone(hero, level){
  const activeId = activeClassId(hero);
  const pool = CLASS_ABILITY_POOLS[activeId] || CLASS_ABILITY_POOLS[hero.class] || CLASS_ABILITY_POOLS.warrior;
  const known = new Set(hero.known || []);
  const milestoneIndex = Math.max(0,ABILITY_MILESTONE_LEVELS.indexOf(level));
  const primary = pool.slice(milestoneIndex * 3, milestoneIndex * 3 + 3).filter(id=>!known.has(id));
  const fill = pool.filter(id=>!known.has(id) && !primary.includes(id));
  return [...primary,...fill].slice(0,3);
}

export function queueAbilityMilestone(level, hero=state?.hero){
  if(!hero || !ABILITY_MILESTONE_LEVELS.includes(level))return;
  hero.abilityMilestones ||= {claimed:{},pending:[]};
  hero.abilityMilestones.claimed ||= {};
  hero.abilityMilestones.pending ||= [];
  if(hero.abilityMilestones.claimed[level])return;
  if(hero.abilityMilestones.pending.some(choice=>choice.level===level))return;
  const choices = abilityChoicesForMilestone(hero, level);
  if(choices.length === 3)hero.abilityMilestones.pending.push({level,choices});
}

export function companionWage(companion){
  const rarityPay = {common:0,uncommon:3,rare:7,epic:12,legendary:20};
  return 4 + Math.floor((companion.level || 1) * 1.2) + (rarityPay[companion.rarity] || 0);
}

export function partyWageCost(){
  return (state?.hero?.companions || [])
    .filter(c=>c.active)
    .reduce((sum,c)=>sum + companionWage(c),0);
}

export function partyFoodCost(){
  return 1 + (state?.hero?.companions || []).filter(c=>c.active).length;
}

export function makeLoot(level){
  const slots = ["weapon","offhand","helmet","chest","shoulders","gloves","belt","legs","boots","cloak","ring"];
  const slot = slots[rnd(0,slots.length-1)];
  const names = {
    weapon:["Rusted Sword","Iron Sword","Ash Axe","Knight Blade","Hunter Bow","Crypt Dagger","Oak Staff","Iron Mace"],
    offhand:["Wooden Shield","Buckler","Ward Charm"],
    helmet:["Rusted Helm","Scout Hood"],
    chest:["Leather Armor","Rusted Armor","Chain Vest","Ash Plate"],
    shoulders:["Guard Pauldrons","Hunter Mantle"],
    gloves:["Leather Bracers"],
    belt:["Worn Belt"],
    legs:["Road Greaves","Wool Trousers"],
    boots:["Traveler Boots","Iron Sabatons"],
    cloak:["Torn Cloak"],
    ring:["Copper Ring","Oath Band"]
  };
  return applyGearVisuals({
    id:"i_"+Date.now()+"_"+Math.random().toString(36).slice(2),
    slot, name:names[slot][rnd(0,names[slot].length-1)], level,
    attack:slot==="weapon"?rnd(3,7)+level:0,
    defense:slot!=="weapon"?rnd(1,4)+Math.floor(level/2):0,
    value:10+level*5
  });
}

export function levelHero(){
  const h = state.hero;
  while(h.xp >= h.nextXp){
    h.xp -= h.nextXp;
    h.level++;
    h.points += 3;
    h.nextXp = xpNeed(h.level);
    h.maxHp += 14 + (h.stats.endurance || 0) * 2;
    h.hp = h.maxHp;
    h.maxMana += 5 + (h.stats.wisdom || 0);
    h.mana = h.maxMana;
    h.attack += 2;
    h.defense += 1;
    queueAbilityMilestone(h.level,h);
  }
}

export function debugLevelTo(targetLevel){
  const h = state.hero;
  const target = clamp(Number(targetLevel) || 1, h.level || 1, 20);
  while(h.level < target){
    h.xp = h.nextXp;
    levelHero();
  }
  save();
}

export function debugGrantCMXp(amount=9000){
  const h = state.hero;
  h.mastery.cmXp += clamp(Number(amount) || 0,0,100000);
  convertCM();
  save();
}

export function debugSetHeroHp(value=1){
  const h = state.hero;
  h.hp = clamp(Number(value) || 1,1,h.maxHp || 1);
  save();
}

export function convertCM(){
  const m = state.hero.mastery;
  let need = cmPointNeed(m);
  while(m.cmXp >= need){
    m.cmXp -= need;
    m.cmPoints++;
    need = cmPointNeed(m);
  }
}

export function advanceDays(days){
  state.world.day += days;
  while(state.world.day > 30){
    state.world.day -= 30;
    state.world.month++;
    monthlyUpkeep();
  }
}

function monthlyUpkeep(){
  const h = state.hero;
  h.gold = Math.max(0,h.gold - partyWageCost());
}
