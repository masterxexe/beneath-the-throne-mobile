#!/usr/bin/env node
/** Play the live game and collect store/web ship-readiness evidence. */
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "agent-tools", "ship-readiness");
const BASE = process.env.BTT_BASE || "http://127.0.0.1:43123";
const CHROME = process.env.CHROME || "/usr/local/bin/google-chrome";

fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const shots = [];

function note(severity, area, message, extra = {}) {
  findings.push({ severity, area, message, ...extra });
  const tag = severity.toUpperCase();
  console.log(`[${tag}] ${area}: ${message}`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
  return file;
}

async function clickText(page, pattern, { timeout = 8000, optional = false } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const clicked = await page.evaluate((source) => {
      const re = new RegExp(source, "i");
      const nodes = [...document.querySelectorAll("button, a, [role='button']")];
      const node = nodes.find((el) => re.test((el.textContent || "").replace(/\s+/g, " ").trim()) && !el.disabled);
      if (!node) return false;
      node.click();
      return (node.textContent || "").trim().slice(0, 80);
    }, pattern.source || pattern);
    if (clicked) return clicked;
    await new Promise((r) => setTimeout(r, 120));
  }
  if (optional) return null;
  throw new Error(`Could not click /${pattern}/`);
}

async function waitBoot(page) {
  await page.waitForFunction(() => window.__BTT_BOOTED === true, { timeout: 30000 });
}

function collectPageHooks(page) {
  const errors = [];
  const failed = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failed.push(`${req.failure()?.errorText || "fail"} ${req.url()}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && url.includes("127.0.0.1:43123")) {
      failed.push(`${res.status()} ${url}`);
    }
  });
  return { errors, failed };
}

async function staticChecks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8"));
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
  const pwa = fs.readFileSync(path.join(ROOT, "src/pwa.js"), "utf8");

  if (!fs.existsSync(path.join(ROOT, "privacy.html")) && !/privacy/i.test(index)) {
    note("blocker", "legal", "No privacy policy page or in-app privacy copy.");
  }
  if (!fs.existsSync(path.join(ROOT, "terms.html"))) {
    note("blocker", "legal", "No terms of use / EULA.");
  }
  if (!manifest.screenshots?.length) {
    note("warn", "pwa", "Manifest has no screenshots (needed for install rich UI and stores).");
  }
  if (String(manifest.icons?.[0]?.purpose || "").includes("any maskable")) {
    note("warn", "pwa", "Icon purpose 'any maskable' is invalid; split into any + maskable.");
  }
  if (/playtest/i.test(manifest.description) || /playtest/i.test(index)) {
    note("warn", "product", "User-facing copy still says playtest.");
  }
  if (!/Capacitor|cordova|twa/i.test(fs.readdirSync(ROOT).join(" "))) {
    note("store", "stores", "No native wrapper (Capacitor/Cordova/TWA). Apple and Google will not take a raw PWA zip.");
  }
  const iconDir = path.join(ROOT, "icons");
  for (const name of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
    const buf = fs.readFileSync(path.join(iconDir, name));
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (name === "icon-512.png" && (w < 512 || h < 512)) {
      note("blocker", "pwa", `${name} is ${w}x${h}, not 512x512.`);
    }
    if (name === "icon-192.png" && (w < 192 || h < 192)) {
      note("warn", "pwa", `${name} is ${w}x${h}, not 192x192.`);
    }
  }
  if (!index.includes("v=120") || !sw.includes("v=120")) {
    note("warn", "pwa", "Cache query strings may be out of sync.");
  }
  if (!pwa.includes(version.version)) {
    note("warn", "pwa", "src/pwa.js BUILD_VERSION does not match version.json.");
  }
  return { manifest, version };
}

async function inspectProductionTitle(browser) {
  const page = await browser.newPage();
  const hooks = collectPageHooks(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/?fresh=${Date.now()}`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitBoot(page);
  await new Promise((r) => setTimeout(r, 700));
  await shot(page, "01-title-mobile");

  const title = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent?.trim() || "",
    newGame: [...document.querySelectorAll("button")].some((b) => /new game/i.test(b.textContent || "")),
    loadGame: [...document.querySelectorAll("button")].some((b) => /load game/i.test(b.textContent || "")),
    debugPanel: !!document.querySelector(".debug-boot-controls"),
    debugOnWindow: Object.keys(window.FE || {}).filter((k) => k.startsWith("debug")).sort(),
    playtestKicker: /playtest/i.test(document.body.innerText || ""),
    privacyLink: !!document.querySelector("a[href*='privacy']"),
    termsLink: !!document.querySelector("a[href*='terms']"),
    ledgerBtn: !!document.querySelector("[data-action='court-ledger']"),
    manifestHref: document.querySelector("link[rel='manifest']")?.href || ""
  }));

  if (!title.newGame) note("blocker", "boot", "Title screen is missing New Game.");
  if (!title.loadGame) note("blocker", "boot", "Title screen is missing Load Game.");
  if (title.debugPanel) note("blocker", "boot", "Debug boot panel is visible without ?debug.");
  if (title.debugOnWindow.length) {
    note("blocker", "stores", `Debug cheats are on window.FE without ?debug (${title.debugOnWindow.slice(0, 8).join(", ")}).`);
  }
  if (!title.privacyLink || !title.termsLink) note("blocker", "legal", "Title screen is missing Privacy or Terms links.");
  const manifestRes = await page.evaluate(async () => {
    const href = document.querySelector("link[rel='manifest']")?.href;
    const res = await fetch(href);
    return { ok: res.ok, status: res.status, json: await res.json() };
  });
  if (!manifestRes.ok) note("blocker", "pwa", `Manifest fetch failed: ${manifestRes.status}`);

  const swState = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const regs = await navigator.serviceWorker.getRegistrations();
    return { supported: true, registrations: regs.length, controller: !!navigator.serviceWorker.controller };
  });

  await clickText(page, /^Load Game$/);
  await new Promise((r) => setTimeout(r, 400));
  const emptyLoad = await page.evaluate(() => document.body.innerText || "");
  if (!/empty slot|slot 1/i.test(emptyLoad)) note("blocker", "saves", "Load Game on the title screen did not show empty slots.");
  await shot(page, "02-load-empty");
  await page.evaluate(() => window.FE?.closeModals?.());

  await clickText(page, /^Settings$/);
  await new Promise((r) => setTimeout(r, 250));
  await clickText(page, /Español|Spanish/);
  await new Promise((r) => setTimeout(r, 400));
  const spanish = await page.evaluate(() => document.body.innerText || "");
  if (!/Nueva Partida/i.test(spanish)) note("warn", "i18n", "Spanish title strings did not appear after language toggle.");
  await shot(page, "03-title-spanish");
  await clickText(page, /English/);
  await new Promise((r) => setTimeout(r, 250));

  return { page, hooks, title, swState, manifestRes };
}

async function playNewGame(page) {
  await clickText(page, /^New Game$/);
  await page.waitForSelector("#heroName", { timeout: 8000 });
  await page.evaluate(() => {
    const input = document.querySelector("#heroName");
    if (input) input.value = "Xero";
  });
  await shot(page, "04-name");
  await clickText(page, /Enter the Ash Road|Entrar/);
  await page.waitForFunction(() => /Attack|Atacar/i.test(document.body.innerText || ""), { timeout: 8000 });
  await shot(page, "05-tutorial-combat");
  await clickText(page, /^Skip$|^Saltar$/);
  for (let i = 0; i < 8; i += 1) {
    const done = await page.evaluate(() => /Choose|Elige|Warrior|Guerrero/i.test(document.body.innerText || ""));
    if (done) break;
    const next = await clickText(page, /Next|Wake|Siguiente|Despierta|Continue/, { optional: true, timeout: 1500 });
    if (!next) break;
    await new Promise((r) => setTimeout(r, 350));
  }
  await shot(page, "06-class-or-wake");
  const chooseClass = await clickText(page, /Choose Class|Elegir Clase|Choose Path/i, { optional: true, timeout: 4000 });
  if (chooseClass) await new Promise((r) => setTimeout(r, 500));
  const classReady = await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /Choose Warrior|Elige/i.test(b.textContent || "")),
    { timeout: 15000 }
  ).catch(() => null);
  if (!classReady) {
    note("blocker", "onboarding", "Class choice never appeared after skipping the opening.");
    return false;
  }
  await shot(page, "07-class-choice");
  await clickText(page, /Choose Warrior|Elige/);
  await page.waitForFunction(() => document.getElementById("game")?.style.display === "block", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => window.FE?.closeModals?.());
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "08-slum-home");
  return true;
}

async function probeScreens(page) {
  const snapshot = await page.evaluate(() => {
    const hero = window.FE && document.querySelector(".hud-token-hero")?.textContent;
    const gold = document.querySelector(".hud-token-gold")?.textContent;
    const ledger = document.querySelector("[data-action='court-ledger']");
    const save = document.querySelector("[data-action='save-slots']");
    const ledgerBox = ledger ? ledger.getBoundingClientRect() : null;
    const saveBox = save ? save.getBoundingClientRect() : null;
    const visible = (box) => !!box && box.width > 2 && box.height > 2 && box.bottom > 0 && box.top < window.innerHeight;
    return {
      hero,
      gold,
      ledgerInDom: !!ledger,
      saveInDom: !!save,
      ledgerVisible: visible(ledgerBox),
      saveVisible: visible(saveBox),
      ledgerBox,
      dock: [...document.querySelectorAll(".game-dock button")].map((b) => b.getAttribute("data-screen")),
      gameDisplay: document.getElementById("game")?.style.display
    };
  });

  if (!snapshot.ledgerInDom) note("blocker", "monetization", "Court Ledger button is missing from the HUD DOM.");
  else if (!snapshot.ledgerVisible) note("blocker", "monetization", "Court Ledger button is in the DOM but not visible on the keep/slum HUD.");
  if (!snapshot.saveVisible) note("warn", "saves", "Save button is not visible on the current HUD.");

  const screens = ["gear", "party", "progression", "map", "support", "home"];
  for (const id of screens) {
    await page.evaluate((screen) => window.FE.show(screen), id);
    await new Promise((r) => setTimeout(r, 700));
    const text = await page.evaluate(() => (document.querySelector(".screen.active")?.innerText || "").slice(0, 400));
    const err = await page.evaluate(() => document.querySelector(".screen.active")?.innerHTML || "");
    if (!text.trim()) note("blocker", id, `${id} screen rendered empty.`);
    await shot(page, `09-screen-${id}`);
    if (id === "map" && !/open road|locked|you/i.test(text)) {
      note("warn", "map", "Map copy is missing You/Open/Locked language.");
    }
    if (id === "support" && !/Founder|Ash Court Pass|Patron/i.test(text)) {
      note("blocker", "monetization", "Court Ledger shop is missing paid offers.");
    }
    if (id === "gear" && /undefined|NaN|\[object/i.test(text)) {
      note("blocker", "gear", "Gear screen shows broken data.");
    }
  }

  return { snapshot };
}

async function probeCombatAndLedger(page) {
  await page.evaluate(() => {
    const enemy = window.FE.makeEnemy(false);
    window.FE.startBattle([enemy], "Ship-readiness duel");
  });
  await new Promise((r) => setTimeout(r, 1200));
  const combat = await page.evaluate(() => ({
    active: document.getElementById("combat")?.classList.contains("active"),
    attack: [...document.querySelectorAll("button")].some((b) => /^attack$/i.test((b.textContent || "").trim())),
    run: [...document.querySelectorAll("button")].some((b) => /run/i.test(b.textContent || "")),
    text: (document.getElementById("combat")?.innerText || "").slice(0, 500)
  }));
  if (!combat.active) note("blocker", "combat", "Combat screen did not activate.");
  if (!combat.attack) note("blocker", "combat", "Attack button missing in combat.");
  await shot(page, "10-combat");
  if (combat.attack) {
    await clickText(page, /^Attack$/);
    await new Promise((r) => setTimeout(r, 900));
    await shot(page, "11-combat-attack");
  }
  const ran = await clickText(page, /^Run$|^Flee$|^Escape$/, { optional: true, timeout: 2500 });
  if (!ran) {
    await page.evaluate(() => {
      window.FE.battle = null;
      window.FE.show?.("home");
    });
  }
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => window.FE.show("support"));
  await new Promise((r) => setTimeout(r, 500));
  const buy = await clickText(page, /Buy \$7\.99/, { optional: true, timeout: 4000 });
  if (!buy) note("blocker", "monetization", "Could not start Founder Writ checkout.");
  else {
    await shot(page, "12-ledger-checkout");
    await clickText(page, /Pay \(playtest\)|Pagar/);
    await new Promise((r) => setTimeout(r, 700));
    const owned = await page.evaluate(() => ({
      title: document.querySelector(".hud-token-founder")?.textContent || "",
      owned: /owned/i.test(document.body.innerText || "")
    }));
    if (!owned.title && !owned.owned) note("blocker", "monetization", "Playtest purchase did not grant Founder title or owned state.");
    await shot(page, "13-ledger-owned");
  }

  await page.evaluate(() => window.FE.showSaveSlots("save"));
  await new Promise((r) => setTimeout(r, 400));
  await clickText(page, /Save Slot 1/);
  await new Promise((r) => setTimeout(r, 400));
  const saved = await page.evaluate(() => /saved/i.test(document.body.innerText || "") || !!localStorage.getItem("fallenEmpireSave_1"));
  if (!saved) note("blocker", "saves", "Save Slot 1 did not write a save.");
  await page.evaluate(() => window.FE.closeModals?.());
}

async function probeDesktop(browser) {
  const page = await browser.newPage();
  const hooks = collectPageHooks(page);
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE}/?fresh=${Date.now()}`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitBoot(page);
  await page.evaluate(() => window.FE.startActualGame("Xero", "warrior"));
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => window.FE.closeModals?.());
  await page.evaluate(() => window.FE.show("map"));
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "14-map-desktop");
  const mapWidth = await page.evaluate(() => document.getElementById("app")?.getBoundingClientRect().width || 0);
  if (mapWidth < 700) note("warn", "map", `Desktop map #app width is only ${Math.round(mapWidth)}px.`);
  await page.close();
  const debugPage = await browser.newPage();
  await debugPage.goto(`${BASE}/?debug&fresh=${Date.now()}`, { waitUntil: "networkidle2", timeout: 60000 });
  await waitBoot(debugPage);
  const debugOk = await debugPage.evaluate(() => typeof window.FE?.debugBootSlumScene === "function");
  if (!debugOk) note("warn", "debug", "?debug did not restore debugBootSlumScene.");
  await debugPage.close();
  return hooks;
}

async function main() {
  await staticChecks();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"]
  });

  const titleRun = await inspectProductionTitle(browser);
  const started = await playNewGame(titleRun.page);
  let probe = {};
  if (started) {
    probe = await probeScreens(titleRun.page);
    await probeCombatAndLedger(titleRun.page);
  }
  const desktopHooks = await probeDesktop(browser);

  const allErrors = [...titleRun.hooks.errors, ...desktopHooks.errors];
  const allFailed = [...titleRun.hooks.failed, ...desktopHooks.failed];
  const uniqueErrors = [...new Set(allErrors)].filter((e) => !/Failed to load resource/i.test(e));
  const uniqueFailed = [...new Set(allFailed)].slice(0, 30);
  uniqueErrors.forEach((e) => note("blocker", "runtime", e));
  uniqueFailed.forEach((e) => note("warn", "network", e));

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    shots,
    title: titleRun.title,
    swState: titleRun.swState,
    probe,
    counts: {
      blocker: findings.filter((f) => f.severity === "blocker").length,
      store: findings.filter((f) => f.severity === "store").length,
      warn: findings.filter((f) => f.severity === "warn").length
    },
    findings
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ counts: report.counts, findings }, null, 2));
  await browser.close();
  process.exit(report.counts.blocker ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
