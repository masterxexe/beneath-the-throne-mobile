import { modal, toast } from "./ui.js";

const BUILD_VERSION = "2026.08.23-overnight-41";
const VERSION_URL = "./version.json";
const WORKER_URL = "./service-worker.js";
const WORKER_SCOPE = "./";

let installPromptEvent = null;
let registration = null;
let updateReady = false;
let refreshing = false;

export function initPwa(){
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPromptEvent = event;
    updateAppButtonLabel();
  });

  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    toast("Beneath the Throne installed.");
    updateAppButtonLabel();
  });

  if("serviceWorker" in navigator && window.isSecureContext){
    window.addEventListener("load", registerServiceWorker);
  }else{
    updateAppButtonLabel();
  }
}

async function registerServiceWorker(){
  try{
    registration = await navigator.serviceWorker.register(WORKER_URL, {scope:WORKER_SCOPE});
    watchRegistration(registration);
    await registration.update();
  }catch(error){
    console.warn("PWA registration failed", error);
  }finally{
    updateAppButtonLabel();
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(refreshing)return;
    refreshing = true;
    window.location.reload();
  });
}

function watchRegistration(reg){
  if(reg.waiting){
    updateReady = true;
    updateAppButtonLabel();
  }
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    if(!worker)return;
    worker.addEventListener("statechange", () => {
      if(worker.state === "installed" && navigator.serviceWorker.controller){
        updateReady = true;
        toast("Update ready. Tap Update.");
        updateAppButtonLabel();
      }
    });
  });
}

export function showAppUpdatePanel(){
  const status = getAppStatus();
  const installHelp = status.standalone
    ? "This playtest is already running like an app."
    : status.installPrompt
      ? "Install is ready on this device."
      : status.secure
        ? "Use the browser menu to add or install the app if the install prompt is not shown."
        : "For full install/offline updates, open the game through an HTTPS test link.";

  const body = `
    <div class="app-update-panel">
      <p>Phone playtest build: <b>${BUILD_VERSION}</b></p>
      <div class="app-status-grid">
        ${statusPill("Mode", status.standalone ? "App" : "Browser", status.standalone ? "good" : "")}
        ${statusPill("Install", status.installPrompt || status.standalone ? "Ready" : "Manual", status.installPrompt || status.standalone ? "good" : "warn")}
        ${statusPill("Updates", status.serviceWorker ? "On" : "Refresh", status.serviceWorker ? "good" : "warn")}
        ${statusPill("Link", status.secure ? "Secure" : "Local", status.secure ? "good" : "warn")}
      </div>
      <p>${installHelp}</p>
      <p class="app-link">${location.href}</p>
    </div>
  `;

  const buttons = [];
  if(installPromptEvent)buttons.push({label:"Install App",cls:"primary",fn:installApp});
  buttons.push({label:updateReady ? "Apply Update" : "Check Updates",cls:"primary",fn:checkForAppUpdate});
  buttons.push({label:"Force Refresh",cls:"secondary",fn:forceRefreshApp});
  buttons.push({label:"Copy Link",cls:"secondary",fn:copyPlaytestLink});
  buttons.push({label:"Close",cls:"secondary"});
  modal("Phone Playtest", body, buttons);
}

export async function installApp(){
  if(!installPromptEvent){
    toast("Use your browser menu to add this game to your home screen.");
    return;
  }
  const promptEvent = installPromptEvent;
  installPromptEvent = null;
  promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  toast(choice.outcome === "accepted" ? "Install started." : "Install dismissed.");
  updateAppButtonLabel();
}

export async function checkForAppUpdate(){
  try{
    const remote = await fetch(`${VERSION_URL}?t=${Date.now()}`, {cache:"no-store"}).then(res => res.json());
    if(remote.version && remote.version !== BUILD_VERSION){
      toast("New build found. Refreshing.");
      await forceRefreshApp();
      return;
    }
  }catch(error){
    console.warn("Version check failed", error);
  }

  if(registration){
    await registration.update();
    if(registration.waiting){
      applyWaitingUpdate();
      return;
    }
  }

  toast("You are on the latest local build.");
  updateAppButtonLabel();
}

export async function forceRefreshApp(){
  if(navigator.serviceWorker?.controller){
    navigator.serviceWorker.controller.postMessage({type:"CLEAR_APP_CACHES"});
  }
  if("caches" in window){
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("beneath-throne-")).map(key => caches.delete(key)));
  }
  const next = new URL(location.href);
  next.searchParams.set("refresh", Date.now());
  location.replace(next.href);
}

export async function copyPlaytestLink(){
  try{
    await navigator.clipboard.writeText(location.href);
    toast("Playtest link copied.");
  }catch(error){
    toast("Copy failed. Long-press the link text.");
  }
}

function applyWaitingUpdate(){
  updateReady = false;
  refreshing = true;
  registration.waiting?.postMessage({type:"SKIP_WAITING"});
  setTimeout(()=>location.reload(),600);
}

function getAppStatus(){
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  return {
    standalone,
    secure: window.isSecureContext,
    installPrompt: !!installPromptEvent,
    serviceWorker: !!navigator.serviceWorker?.controller || !!registration
  };
}

function statusPill(label,value,cls = ""){
  return `<span class="pill ${cls}">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
}

function updateAppButtonLabel(){
  document.querySelectorAll("[data-action='app-update']").forEach(button => {
    button.textContent = updateReady ? "Update Ready" : "Update";
    button.classList.toggle("app-update-ready", updateReady);
  });
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[char]));
}
