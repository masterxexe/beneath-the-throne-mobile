#!/usr/bin/env node
/** Capture combat screenshots via debug shortcuts (?debug). */
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "agent-tools", "screenshots");
const BASE = "http://localhost:43123/?debug&v=108";

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
  return file;
}

async function waitBoot(page) {
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(() => window.__BTT_BOOTED, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await waitBoot(page);
  await shot(page, "01-title-debug");

  await page.evaluate(() => {
    window.FE.startActualGame("Xexe", "warrior");
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const close = [...document.querySelectorAll("button")].find(b => /^close$/i.test((b.textContent || "").trim()));
    close?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.evaluate(() => window.FE.debugStartEnemyVisualTest("skeleton"));
  await new Promise(r => setTimeout(r, 1200));
  await shot(page, "02-enemy-skeleton-idle");

  for (const pose of ["attack", "hurt", "defeated"]) {
    await page.evaluate(p => window.FE.debugForceEnemyVisualPose(p), pose);
    await new Promise(r => setTimeout(r, 600));
    await shot(page, `03-enemy-skeleton-${pose}`);
  }

  await page.evaluate(() => window.FE.debugBootCombatLayoutTest(1, 0));
  await new Promise(r => setTimeout(r, 2000));
  await shot(page, "04-combat-1v1");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /attack/i.test(b.textContent || ""));
    btn?.click();
  });
  await new Promise(r => setTimeout(r, 900));
  await shot(page, "05-combat-attack");

  await page.evaluate(() => window.FE.debugBootSlumScene());
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "06-slum-world-scene");

  await page.evaluate(() => window.FE.debugBootLowerWard());
  await new Promise(r => setTimeout(r, 1500));
  await shot(page, "07-lower-ward-scene");

  await browser.close();
  console.log("Combat + world debug screenshots complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
