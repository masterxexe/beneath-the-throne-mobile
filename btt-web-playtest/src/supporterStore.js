import { save, state } from "./state.js";
import { byId, esc, modal, toast } from "./ui.js";

const SUPPORTER_OFFERS = [
  {
    id:"founder_pack",
    name:"Founder Pack",
    tag:"One-time",
    price:"$4.99-$9.99 target",
    desc:"A fair first purchase for players who want to support Chapter 1 without buying power.",
    includes:["Founder title","bronze name frame","exclusive cloak look","remove ads flag","small cosmetic banner"]
  },
  {
    id:"remove_ads",
    name:"Remove Ads",
    tag:"Quality",
    price:"$2.99 target",
    desc:"Turns off optional ad prompts after the game has real rewarded ads wired.",
    includes:["No interstitial ads","reward prompts stay opt-in","cleaner rest and post-battle flow"]
  },
  {
    id:"cosmetic_vault",
    name:"Cosmetic Vault",
    tag:"Looks",
    price:"Rotating",
    desc:"A safe shop lane for armor looks, weapon glows, companion outfits, banners, and portrait frames.",
    includes:["weapon skins","spell effects","companion outfits","camp banners","town badge frames"]
  },
  {
    id:"rewarded_boosts",
    name:"Rewarded Boosts",
    tag:"Optional Ads",
    price:"Ad reward",
    desc:"Optional ad placements that should never interrupt combat or block progress.",
    includes:["extra scouting report","inn recovery boost","small post-fight supply bonus","one defeat recovery offer"]
  }
];

const ECONOMY_RULES = [
  "Free path: Cinderhook and Lower Ward core progression stay playable.",
  "Paid path: cosmetics, founder identity, ad removal, and convenience previews only.",
  "No power sales: class unlocks, companions, writs, and hard-area rewards remain earned in-game.",
  "Ads must be opt-in: no forced ad breaks during combat, class selection, or quest completion."
];

const APP_STORE_READINESS = [
  {id:"phone_qa",name:"Phone QA",desc:"Verify portrait layout, tap targets, monster visibility, and loading flow on the actual phone."},
  {id:"save_stability",name:"Save Stability",desc:"Check new game, reload, update button, and cache clear across at least two save slots."},
  {id:"store_assets",name:"Store Assets",desc:"Prepare icon, app screenshots, short description, and gameplay preview captures."},
  {id:"privacy_copy",name:"Privacy Copy",desc:"Draft plain-language privacy notes before analytics, ads, or purchases are connected."},
  {id:"billing_plan",name:"Billing Plan",desc:"Keep purchase IDs, prices, restore flow, and no-pay-to-win rules documented before store wiring."},
  {id:"performance_budget",name:"Performance Budget",desc:"Track slow loading screens and image weight before adding more art or effects."}
];

function supporterState(){
  state.supporter ||= {interested:[],previewed:[],notes:[]};
  state.supporter.interested ||= [];
  state.supporter.previewed ||= [];
  state.supporter.notes ||= [];
  state.supporter.readiness ||= [];
  return state.supporter;
}

function offerCardHTML(offer){
  const ss = supporterState();
  const interested = ss.interested.includes(offer.id);
  return `
    <div class="supporter-card supporter-offer-${esc(offer.id)}">
      <div class="supporter-card-head">
        <span class="pill good">${esc(offer.tag)}</span>
        <span class="pill">${esc(offer.price)}</span>
      </div>
      <h2>${esc(offer.name)}</h2>
      <p>${esc(offer.desc)}</p>
      <div class="supporter-includes">
        ${offer.includes.map(item=>`<span>${esc(item)}</span>`).join("")}
      </div>
      <div class="grid2">
        <button class="primary" onclick="FE.previewSupporterOffer('${esc(offer.id)}')">Preview</button>
        <button class="${interested ? "good" : "secondary"}" onclick="FE.markSupporterInterest('${esc(offer.id)}')">${interested ? "Marked" : "Mark Interest"}</button>
      </div>
    </div>
  `;
}

function economyRulesHTML(){
  return `
    <div class="supporter-roadmap supporter-economy-rules">
      <h2>Economy Rules</h2>
      <div class="supporter-includes">
        ${ECONOMY_RULES.map(rule=>`<span>${esc(rule)}</span>`).join("")}
      </div>
    </div>
  `;
}

function appStoreReadinessHTML(){
  const ss = supporterState();
  return `
    <div class="supporter-roadmap supporter-readiness">
      <h2>App Store Readiness</h2>
      <p>Use this as the pre-release checklist before real billing, ads, or store submission work starts.</p>
      <div class="supporter-readiness-grid">
        ${APP_STORE_READINESS.map(item=>{
          const done = ss.readiness.includes(item.id);
          return `
            <button class="supporter-readiness-item ${done ? "is-done" : ""}" onclick="FE.toggleStoreReadiness('${esc(item.id)}')">
              <span class="pill ${done ? "good" : "warn"}">${done ? "Done" : "Open"}</span>
              <b>${esc(item.name)}</b>
              <small>${esc(item.desc)}</small>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function renderSupport(){
  const root = byId("support");
  if(!root)return;
  const ss = supporterState();
  root.innerHTML = `
    <div class="panel supporter-shell">
      <div class="supporter-hero">
        <div>
          <span class="pill good">Monetization Shell</span>
          <h1>Supporter Store</h1>
          <p>Playtest-only storefront. These buttons do not charge money yet; they define the fair purchase structure before App Store and Play Billing are connected.</p>
        </div>
        <div class="supporter-rules">
          <span class="pill">No pay-to-win</span>
          <span class="pill">Cosmetics first</span>
          <span class="pill">Ads optional</span>
        </div>
      </div>
      <div class="supporter-grid">
        ${SUPPORTER_OFFERS.map(offerCardHTML).join("")}
      </div>
      ${economyRulesHTML()}
      ${appStoreReadinessHTML()}
      <div class="supporter-roadmap">
        <h2>Build Order</h2>
        <p>First: polish Chapter 1 and retention. Next: wire rewarded ad test placements. Last: connect real App Store / Google Play purchases once the game loop is stable.</p>
        <div class="supporter-includes">
          <span>Founder pack art</span>
          <span>cosmetic inventory</span>
          <span>rewarded ad service</span>
          <span>store compliance copy</span>
        </div>
      </div>
      ${ss.interested.length ? `<p class="supporter-interest-note">Marked for testing: ${ss.interested.map(id=>esc(SUPPORTER_OFFERS.find(offer=>offer.id===id)?.name || id)).join(", ")}</p>` : ""}
    </div>
  `;
}

export function toggleStoreReadiness(id){
  const item = APP_STORE_READINESS.find(entry=>entry.id === id);
  if(!item)return toast("Checklist item not found.");
  const ss = supporterState();
  if(ss.readiness.includes(id)){
    ss.readiness = ss.readiness.filter(value=>value !== id);
    toast("Marked open.");
  }else{
    ss.readiness.push(id);
    toast("Marked done.");
  }
  save();
  renderSupport();
}

export function previewSupporterOffer(id){
  const offer = SUPPORTER_OFFERS.find(item=>item.id === id);
  if(!offer)return toast("Offer not found.");
  const ss = supporterState();
  if(!ss.previewed.includes(id))ss.previewed.push(id);
  save();
  modal(offer.name, `
    <p>${esc(offer.desc)}</p>
    <p><b>Target:</b> ${esc(offer.price)}</p>
    <div class="supporter-includes">
      ${offer.includes.map(item=>`<span>${esc(item)}</span>`).join("")}
    </div>
    <p>This is a playtest preview. Real purchases will be connected through official store billing later.</p>
  `);
}

export function markSupporterInterest(id){
  const offer = SUPPORTER_OFFERS.find(item=>item.id === id);
  if(!offer)return toast("Offer not found.");
  const ss = supporterState();
  if(ss.interested.includes(id)){
    ss.interested = ss.interested.filter(item=>item !== id);
    toast("Removed from test interest.");
  }else{
    ss.interested.push(id);
    toast("Marked for store testing.");
  }
  save();
  renderSupport();
}
