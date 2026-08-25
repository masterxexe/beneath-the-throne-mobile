import { state } from "./state.js";
import { tx } from "./language.js";
import { esc, updateTop } from "./ui.js";
import { playAudioHook } from "./audioHooks.js";
import { renderPlayerHudPortrait } from "./portraitRenderer.js";

let pendingDone = null;
let readyTimer = 0;
let skipTimer = 0;
let keyHandler = null;
let rankTimer = 0;

const READY_MS = 1650;
const SKIP_MS = 420;

function prefersReducedMotion(){
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export function presentLevelUp(summary, {onDone, continueLabel} = {}){
  if(!summary || !summary.to){
    onDone?.();
    return;
  }
  dismissLevelUp(false);
  pendingDone = typeof onDone === "function" ? onDone : null;
  if(summary.from < 2 && summary.to >= 2){
    state.tutorialsSeen ||= {};
    state.tutorialsSeen.growthHintPending = true;
  }
  playAudioHook("hero-levelup");
  if(state.world?.story){
    state.world.story.push(`${tx("levelUpStory")} ${summary.to}.`);
  }

  const reduced = prefersReducedMotion();
  const back = document.createElement("div");
  back.className = "level-up-back";
  back.setAttribute("role", "dialog");
  back.setAttribute("aria-modal", "true");
  back.setAttribute("aria-label", tx("levelUp"));
  back.innerHTML = levelUpHTML(summary, continueLabel);
  document.body.appendChild(back);
  document.body.classList.add("level-up-open");
  requestAnimationFrame(() => back.classList.add("is-live"));

  updateTop();
  document.querySelector(".hud-token-hero")?.classList.add("is-level-up");
  document.querySelector(".top-vital-xp")?.classList.add("is-level-burst");

  const go = back.querySelector("[data-level-up-continue]");
  const arm = () => {
    back.classList.add("is-ready");
    go?.removeAttribute("disabled");
    go?.focus();
  };
  go?.addEventListener("click", () => dismissLevelUp(true));
  if(reduced){
    arm();
  }else{
    go?.setAttribute("disabled", "");
    skipTimer = window.setTimeout(() => back.classList.add("is-skippable"), SKIP_MS);
    readyTimer = window.setTimeout(arm, READY_MS);
    if(summary.levels > 1)animateRank(back.querySelector(".level-up-to"), summary.from, summary.to);
  }

  keyHandler = event => {
    if(event.key !== "Enter" && event.key !== " " && event.key !== "Escape")return;
    if(!back.classList.contains("is-ready") && !back.classList.contains("is-skippable") && event.key !== "Escape")return;
    event.preventDefault();
    if(back.classList.contains("is-ready") || event.key === "Escape"){
      dismissLevelUp(true);
      return;
    }
    arm();
  };
  document.addEventListener("keydown", keyHandler);
}

export function dismissLevelUp(runDone = true){
  window.clearTimeout(readyTimer);
  window.clearTimeout(skipTimer);
  window.clearTimeout(rankTimer);
  readyTimer = 0;
  skipTimer = 0;
  rankTimer = 0;
  if(keyHandler){
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  document.querySelectorAll(".level-up-back").forEach(node => node.remove());
  document.body.classList.remove("level-up-open");
  document.querySelector(".hud-token-hero")?.classList.remove("is-level-up");
  document.querySelector(".top-vital-xp")?.classList.remove("is-level-burst");
  const fn = pendingDone;
  pendingDone = null;
  if(runDone && fn)fn();
}

function animateRank(el, from, to){
  if(!el || to <= from)return;
  let n = from;
  el.textContent = `${tx("level")} ${n}`;
  const step = () => {
    n += 1;
    el.textContent = `${tx("level")} ${n}`;
    el.classList.remove("is-slam");
    void el.offsetWidth;
    el.classList.add("is-slam");
    if(n < to)rankTimer = window.setTimeout(step, 240);
  };
  rankTimer = window.setTimeout(step, 380);
}

function levelUpHTML(summary, continueLabel){
  const h = state.hero;
  const multi = summary.levels > 1;
  const notes = [];
  if(summary.pathUnlock)notes.push(tx("levelUpPaths"));
  if(summary.milestone)notes.push(tx("levelUpAbility"));
  notes.push(tx("levelUpSpend"));
  const embers = Array.from({length: 14}, (_, i) => `<span style="--i:${i}"></span>`).join("");
  const label = continueLabel || tx("levelUpRise");
  const nameLine = tx("levelUpName").replace("{name}", h.name || "");
  return `
    <div class="level-up-flash" aria-hidden="true"></div>
    <div class="level-up-rays" aria-hidden="true"></div>
    <div class="level-up-burst" aria-hidden="true"></div>
    <div class="level-up-embers" aria-hidden="true">${embers}</div>
    <div class="level-up-card">
      <div class="level-up-portrait">${renderPlayerHudPortrait(h, {supporterFrame:state.supporter?.equipped?.frame, supporterCloak:state.supporter?.equipped?.cloak})}</div>
      <p class="level-up-kicker">${esc(tx("levelUpKicker"))}</p>
      <h2>${esc(tx("levelUp"))}</h2>
      <p class="level-up-name">${esc(nameLine)}</p>
      <div class="level-up-count" aria-label="${tx("level")} ${summary.from} ${tx("levelUpTo")} ${summary.to}">
        <span class="level-up-from">${tx("level")} ${summary.from}</span>
        <span class="level-up-arrow" aria-hidden="true">→</span>
        <span class="level-up-to is-slam">${tx("level")} ${summary.to}</span>
      </div>
      ${multi ? `<p class="level-up-multi">${esc(tx("levelUpMulti")).replace("{n}", String(summary.levels))}</p>` : ""}
      <ul class="level-up-gains">
        <li style="--i:0"><b>+${summary.hp}</b> ${tx("hp")}</li>
        <li style="--i:1"><b>+${summary.mana}</b> ${tx("mana")}</li>
        <li style="--i:2"><b>+${summary.attack}</b> ${tx("attackShort")}</li>
        <li style="--i:3"><b>+${summary.defense}</b> ${tx("defenseShort")}</li>
        <li class="is-points" style="--i:4"><b>+${summary.points}</b> ${tx("statPoints")}</li>
      </ul>
      ${notes.map(note => `<p class="level-up-note">${esc(note)}</p>`).join("")}
      <button class="primary level-up-continue" data-level-up-continue>${esc(label)}</button>
    </div>
  `;
}
