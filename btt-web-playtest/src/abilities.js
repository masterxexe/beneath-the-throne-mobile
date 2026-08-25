import { title, tx } from "./language.js";

export function abilityKind(id){
  const low = String(id || "").toLowerCase();
  if(/heal|mend|restore|renew|second_wind/.test(low))return "heal";
  if(/guard|shield|wall|smoke|vanish|taunt/.test(low))return "ward";
  return "strike";
}

export function abilityBaseCost(id){
  const kind = abilityKind(id);
  if(kind === "heal")return 8;
  if(kind === "ward")return 7;
  return 9;
}

export function abilityName(id){
  return title(id);
}

export function abilityKindLabel(id){
  return tx(`abilityKind_${abilityKind(id)}`);
}
