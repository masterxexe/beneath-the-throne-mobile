import { save, state } from "./state.js";
import { byId, esc, modal, toast, updateTop } from "./ui.js";
import { tx } from "./language.js";

const CHECKOUT_STORAGE_KEY = "btt_checkout_urls";
const AD_GOLD = 8;
const AD_FOOD = 1;
const AD_WAIT_MS = 4200;

const SUPPORTER_OFFERS = [
  {
    id: "founder_pack",
    nameKey: "offerFounderName",
    tagKey: "offerTagOnce",
    descKey: "offerFounderDesc",
    cents: 799,
    includesKeys: ["offerFounderTitle", "offerFounderFrame", "offerFounderCloak", "offerFounderAds"],
    grants: {title: "Founder", frame: "bronze", cloak: "ember", adsRemoved: true, extraSlots: true}
  },
  {
    id: "ash_court_pass",
    nameKey: "offerPassName",
    tagKey: "offerTagConvenience",
    descKey: "offerPassDesc",
    cents: 499,
    includesKeys: ["offerPassSlots", "offerPassBanner", "offerPassAds"],
    grants: {banner: "keep", adsRemoved: true, extraSlots: true}
  },
  {
    id: "ember_cloak",
    nameKey: "offerCloakName",
    tagKey: "offerTagLooks",
    descKey: "offerCloakDesc",
    cents: 299,
    includesKeys: ["offerCloakLook"],
    grants: {cloak: "ember"}
  },
  {
    id: "keep_frame",
    nameKey: "offerFrameName",
    tagKey: "offerTagLooks",
    descKey: "offerFrameDesc",
    cents: 199,
    includesKeys: ["offerFrameLook"],
    grants: {frame: "keep"}
  },
  {
    id: "ash_patron",
    nameKey: "offerPatronName",
    tagKey: "offerTagTip",
    descKey: "offerPatronDesc",
    cents: 199,
    includesKeys: ["offerPatronTitle"],
    grants: {title: "Patron of Ash"}
  }
];

function emptySupporter(){
  return {
    interested: [],
    previewed: [],
    notes: [],
    readiness: [],
    owned: [],
    equipped: {frame: null, cloak: null, banner: null},
    title: "",
    adsRemoved: false,
    extraSlots: false,
    receipts: [],
    lastAdDay: null
  };
}

export function supporterState(){
  state.supporter ||= emptySupporter();
  const ss = state.supporter;
  ss.owned = Array.isArray(ss.owned) ? [...new Set(ss.owned.filter(Boolean))] : [];
  ss.equipped ||= {frame: null, cloak: null, banner: null};
  ss.receipts = Array.isArray(ss.receipts) ? ss.receipts.slice(0, 40) : [];
  ss.title = typeof ss.title === "string" ? ss.title : "";
  ss.adsRemoved = !!ss.adsRemoved;
  ss.extraSlots = !!ss.extraSlots;
  return ss;
}

export function offerById(id){
  return SUPPORTER_OFFERS.find(offer => offer.id === id) || null;
}

export function ownsOffer(id){
  return supporterState().owned.includes(id);
}

export function extraSaveSlotCount(){
  const ss = supporterState();
  return ss.extraSlots || ownsOffer("founder_pack") || ownsOffer("ash_court_pass") ? 5 : 3;
}

function money(cents){
  return `$${(cents / 100).toFixed(2)}`;
}

function checkoutUrl(offer){
  try{
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[offer.id] || window.BTT_CHECKOUT_URLS?.[offer.id] || "";
  }catch{
    return "";
  }
}

function grantOffer(offer){
  const ss = supporterState();
  if(!ss.owned.includes(offer.id))ss.owned.push(offer.id);
  const grants = offer.grants || {};
  if(grants.frame)ss.equipped.frame = grants.frame;
  if(grants.cloak)ss.equipped.cloak = grants.cloak;
  if(grants.banner)ss.equipped.banner = grants.banner;
  if(grants.title)ss.title = grants.title;
  if(grants.adsRemoved)ss.adsRemoved = true;
  if(grants.extraSlots)ss.extraSlots = true;
}

function addReceipt(offer, method){
  const ss = supporterState();
  ss.receipts.unshift({
    id: `rcpt_${Date.now()}`,
    offerId: offer.id,
    cents: offer.cents,
    method,
    at: Date.now()
  });
  ss.receipts = ss.receipts.slice(0, 40);
}

function ledgerTotals(){
  const ss = supporterState();
  return ss.receipts.reduce((sum, row) => sum + (Number(row.cents) || 0), 0);
}

function offerName(offer){
  return tx(offer.nameKey);
}

function offerCardHTML(offer){
  const owned = ownsOffer(offer.id);
  return `
    <article class="supporter-card supporter-offer-${esc(offer.id)} ${owned ? "is-owned" : ""}">
      <div class="supporter-card-head">
        <span class="pill good">${esc(tx(offer.tagKey))}</span>
        <span class="pill">${owned ? tx("owned") : money(offer.cents)}</span>
      </div>
      <h2>${esc(offerName(offer))}</h2>
      <p>${esc(tx(offer.descKey))}</p>
      <div class="supporter-includes">
        ${offer.includesKeys.map(key => `<span>${esc(tx(key))}</span>`).join("")}
      </div>
      <div class="grid2">
        <button type="button" class="secondary" onclick="FE.previewSupporterOffer('${esc(offer.id)}')">${tx("whatsInside")}</button>
        ${owned
          ? `<button type="button" class="good" disabled>${tx("owned")}</button>`
          : `<button type="button" class="primary" onclick="FE.buySupporterOffer('${esc(offer.id)}')">${tx("buyFor")} ${money(offer.cents)}</button>`}
      </div>
    </article>
  `;
}

function receiptsHTML(){
  const ss = supporterState();
  const total = ledgerTotals();
  if(!ss.receipts.length){
    return `<p class="map-dock-help">${tx("ledgerEmpty")}</p>`;
  }
  return `
    <p class="supporter-ledger-total">${tx("ledgerTaken")}: <strong>${money(total)}</strong> <small>${tx("ledgerMockNote")}</small></p>
    <ol class="supporter-receipts">
      ${ss.receipts.slice(0, 8).map(row => {
        const offer = offerById(row.offerId);
        const when = new Date(row.at).toLocaleString();
        return `<li><strong>${esc(offer ? offerName(offer) : row.offerId)}</strong> ${money(row.cents)} <small>${esc(row.method)} · ${esc(when)}</small></li>`;
      }).join("")}
    </ol>
  `;
}

function crierHTML(){
  const ss = supporterState();
  if(ss.adsRemoved){
    return `<p class="map-dock-help">${tx("crierGone")}</p>`;
  }
  const used = ss.lastAdDay === state.world?.day;
  return `
    <p>${tx("crierBody")}</p>
    <button type="button" class="secondary" ${used ? "disabled" : ""} onclick="FE.watchCourtCrier()">${used ? tx("crierDoneToday") : tx("watchCrier")}</button>
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
          <span class="pill good">${tx("courtLedger")}</span>
          <h1>${tx("courtLedgerTitle")}</h1>
          <p>${tx("courtLedgerBody")}</p>
        </div>
        <div class="supporter-rules">
          <span class="pill">${tx("noPayToWin")}</span>
          <span class="pill">${tx("cosmeticsFirst")}</span>
          <span class="pill">${ss.adsRemoved ? tx("adsRemoved") : tx("adsOptional")}</span>
        </div>
      </div>
      ${ss.title ? `<p class="supporter-interest-note">${tx("wearingTitle")}: <b>${esc(ss.title)}</b></p>` : ""}
      <div class="supporter-grid">
        ${SUPPORTER_OFFERS.map(offerCardHTML).join("")}
      </div>
      <div class="supporter-roadmap">
        <h2>${tx("crierTitle")}</h2>
        ${crierHTML()}
      </div>
      <div class="supporter-roadmap">
        <h2>${tx("ledgerTitle")}</h2>
        ${receiptsHTML()}
      </div>
      <div class="supporter-roadmap">
        <h2>${tx("realMoneyHow")}</h2>
        <p>${tx("realMoneyBody")}</p>
        <div class="supporter-includes">
          <span>${tx("realMoneyStripe")}</span>
          <span>${tx("realMoneyStores")}</span>
          <span>${tx("realMoneyTips")}</span>
        </div>
      </div>
    </div>
  `;
}

export function previewSupporterOffer(id){
  const offer = offerById(id);
  if(!offer)return toast(tx("offerMissing"));
  const ss = supporterState();
  if(!ss.previewed.includes(id))ss.previewed.push(id);
  save();
  modal(offerName(offer), `
    <p>${esc(tx(offer.descKey))}</p>
    <p><b>${tx("price")}:</b> ${money(offer.cents)}</p>
    <div class="supporter-includes">
      ${offer.includesKeys.map(key => `<span>${esc(tx(key))}</span>`).join("")}
    </div>
    <p>${tx("noPowerSales")}</p>
  `);
}

export function buySupporterOffer(id){
  const offer = offerById(id);
  if(!offer)return toast(tx("offerMissing"));
  if(ownsOffer(id))return toast(tx("alreadyOwned"));
  const url = checkoutUrl(offer);
  const method = url ? "stripe" : "mock";
  modal(offerName(offer), `
    <p>${esc(tx(offer.descKey))}</p>
    <p><b>${tx("price")}:</b> ${money(offer.cents)}</p>
    <p>${url ? tx("checkoutOpensTab") : tx("checkoutMockBody")}</p>
  `, [
    {
      label: url ? tx("openCheckout") : tx("payPlaytest"),
      cls: "primary",
      fn: () => completePurchase(offer, method, url)
    },
    {label: tx("close"), cls: "secondary"}
  ]);
}

function completePurchase(offer, method, url){
  if(url){
    window.open(url, "_blank", "noopener");
  }
  grantOffer(offer);
  addReceipt(offer, method);
  save();
  updateTop();
  renderSupport();
  toast(tx("purchaseGranted"));
}

export function watchCourtCrier(){
  const ss = supporterState();
  if(ss.adsRemoved)return toast(tx("crierGone"));
  if(ss.lastAdDay === state.world?.day)return toast(tx("crierDoneToday"));
  const overlay = document.createElement("div");
  overlay.className = "court-crier-overlay";
  overlay.innerHTML = `
    <div class="court-crier-card">
      <span class="pill">${tx("crierTitle")}</span>
      <h2>${tx("crierWatching")}</h2>
      <p>${tx("crierWatchBody")}</p>
      <div class="travel-progress-track" aria-hidden="true"><span style="width:0%"></span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const bar = overlay.querySelector(".travel-progress-track span");
  const started = Date.now();
  const tick = () => {
    const t = Math.min(1, (Date.now() - started) / AD_WAIT_MS);
    if(bar)bar.style.width = `${Math.floor(t * 100)}%`;
    if(t < 1){
      requestAnimationFrame(tick);
      return;
    }
    overlay.remove();
    ss.lastAdDay = state.world?.day ?? 1;
    state.hero.gold = (state.hero.gold || 0) + AD_GOLD;
    state.hero.food = (state.hero.food || 0) + AD_FOOD;
    save();
    updateTop();
    renderSupport();
    toast(`${tx("crierPaid")} +${AD_GOLD}g, +${AD_FOOD} ${tx("food")}`);
  };
  requestAnimationFrame(tick);
}

export function toggleStoreReadiness(){
  toast(tx("realMoneyBody"));
}

export function markSupporterInterest(id){
  return previewSupporterOffer(id);
}
