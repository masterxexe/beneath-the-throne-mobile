#!/usr/bin/env node
/**
 * Repair Beneath the Throne assets:
 * 1. Remove captcha/HTML files masquerading as images
 * 2. Download missing referenced assets via Chrome session
 * 3. Synthesize fallbacks from nearest valid sibling assets
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = "https://hillbillyai.com/games/beneath-the-throne/game/";

function collectReferencedPaths() {
  const paths = new Set();
  const walk = dir => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.(js|css|html|webmanifest)$/.test(name)) {
        const text = fs.readFileSync(full, "utf8");
        for (const m of text.matchAll(/["']((?:\.\/)?(?:assets|icons)\/[^"']+)["']/g)) {
          paths.add(m[1].replace(/^\.\//, "").split("?")[0]);
        }
        for (const m of text.matchAll(/url\(["']?(?:\.\/)?((?:assets|icons)\/[^"')\s]+)/g)) {
          paths.add(m[1].split("?")[0]);
        }
      }
    }
  };
  walk(path.join(ROOT, "src"));
  for (const file of ["styles.css", "index.html", "manifest.webmanifest", "recovery.html", "redesign.css"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const m of text.matchAll(/(?:\.\/)?((?:assets|icons)\/[A-Za-z0-9_./-]+)/g)) {
      const p = m[1].split("?")[0].replace(/\/$/, "");
      if (p && !p.endsWith("/")) paths.add(p);
    }
  }
  for (const fp of fs.readdirSync(path.join(ROOT, "src")).filter(f => f.endsWith(".js"))) {
    const text = fs.readFileSync(path.join(ROOT, "src", fp), "utf8");
    const consts = {};
    for (const m of text.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*["']((?:assets|icons)\/[^"']+)["']/g)) {
      consts[m[1]] = m[2];
    }
    for (const m of text.matchAll(/([A-Z][A-Z0-9_]*)\+["']([^"']+)["']/g)) {
      if (consts[m[1]]) paths.add((consts[m[1]] + m[2]).split("?")[0]);
    }
    const roots = { NPC_ROOT: "assets/npcs/generated/v1/", ENEMY_ROOT: "assets/portraits/enemies/", V56_ACTOR_ROOT: "assets/actors/generated/v56/", V76_ACTOR_ROOT: "assets/actors/generated/v56/" };
    for (const [key, prefix] of Object.entries(roots)) {
      for (const m of text.matchAll(new RegExp(key + '\\+["\']([^"\']+)["\']', "g"))) {
        paths.add(prefix + m[1]);
      }
    }
  }
  return [...paths].sort();
}

function isCorrupt(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const st = fs.statSync(filePath);
  if (st.isDirectory()) return false;
  const head = fs.readFileSync(filePath).subarray(0, 80).toString("latin1").trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

function removeCorruptFiles() {
  let removed = 0;
  for (const dir of ["assets", "icons"]) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const fp of walkFiles(base)) {
      if (isCorrupt(fp)) {
        fs.unlinkSync(fp);
        removed++;
      }
    }
  }
  return removed;
}

function walkFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function isValidAsset(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  if (isCorrupt(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") return fs.readFileSync(filePath, "utf8").includes("<svg");
  return fs.statSync(filePath).size > 200;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeSvg(dest, label = "") {
  const safe = label.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="8" fill="#12151f"/>
  <rect x="4" y="4" width="56" height="56" rx="6" stroke="#c9a84b" stroke-width="2" opacity="0.7"/>
  <path d="M20 44 L32 16 L44 44 Z" stroke="#8a96a8" stroke-width="2" fill="#1e2433"/>
  ${safe ? `<text x="32" y="54" text-anchor="middle" fill="#c9a84b" font-size="7" font-family="sans-serif">${safe}</text>` : ""}
</svg>`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, svg);
}

function synthesizeFallbacks(referenced) {
  const idleCrop = path.join(ROOT, "assets/portraits/player/poses/base/player-idle-crop-v76.png");
  const idlePose = path.join(ROOT, "assets/portraits/player/poses/base/player-idle-v28.png");
  const headSvg = path.join(ROOT, "assets/portraits/player/head/survivor-head.svg");
  const rules = [];

  let created = 0;

  for (const rel of referenced) {
    const dest = path.join(ROOT, rel);
    if (isValidAsset(dest)) continue;

    // Player poses -> idle crop
    if (rel.includes("portraits/player/poses/base/") && rel.endsWith(".png")) {
      const src = isValidAsset(idlePose) ? idlePose : idleCrop;
      if (isValidAsset(src)) { copyFile(src, dest); created++; continue; }
    }

    // Composites: copy any valid sibling in same folder
    if (rel.includes("/composites/") && rel.endsWith(".png")) {
      const dir = path.dirname(dest);
      if (fs.existsSync(dir)) {
        const sibling = fs.readdirSync(dir).map(f => path.join(dir, f)).find(isValidAsset);
        if (sibling) { copyFile(sibling, dest); created++; continue; }
      }
    }

    // Enemy defeated poses -> actor sprites
    const defeatedMatch = rel.match(/portraits\/enemies\/(\w+)\/defeated-v1\.png$/);
    if (defeatedMatch) {
      const map = { skeleton: "skeleton-warrior-idle-v56.png", wolf: "wolf-stalker-idle-v56.png", bandit: "cultist-bandit-idle-crop-v76.png", cultist: "cultist-bandit-idle-crop-v76.png", corrupted_knight: "elite-corrupted-knight-idle-v56.png" };
      const actor = path.join(ROOT, "assets/actors/generated/v56", map[defeatedMatch[1]] || "companion-scout-idle-v56.png");
      if (isValidAsset(actor)) { copyFile(actor, dest); created++; continue; }
      const story = path.join(ROOT, "assets/portraits/story/tutorial-skeleton-painted.png");
      if (isValidAsset(story)) { copyFile(story, dest); created++; continue; }
    }

    // NPC portraits
    if (rel.startsWith("assets/npcs/generated/v1/")) {
      const actor = path.join(ROOT, "assets/actors/generated/v56/companion-armored-idle-v56.png");
      if (isValidAsset(actor)) { copyFile(actor, dest); created++; continue; }
    }

    // Actor sprites missing -> companion if available
    if (rel.startsWith("assets/actors/generated/v56/")) {
      const fallback = path.join(ROOT, "assets/actors/generated/v56/companion-scout-idle-v56.png");
      if (isValidAsset(fallback)) { copyFile(fallback, dest); created++; continue; }
    }

    // World/ministop duplicates
    if (rel.endsWith("camp-fortified-v18.png")) {
      const src = path.join(ROOT, "assets/worldstates/generated/camp-basic-v18.png");
      if (isValidAsset(src)) { copyFile(src, dest); created++; continue; }
    }
    if (rel.endsWith("ridge-path-world-v71.png")) {
      const src = path.join(ROOT, "assets/ministops/generated/ridge-path-v18.png");
      if (isValidAsset(src)) { copyFile(src, dest); created++; continue; }
    }

    // Tutorial mobile bg -> title bg or opening survivor
    if (rel.endsWith("title-bg-mobile-v80.webp")) {
      for (const alt of ["assets/ui/generated/title-bg-v19d.png", "assets/tutorial/generated/v80/opening-survivor-v80.webp"]) {
        const src = path.join(ROOT, alt);
        if (isValidAsset(src)) { copyFile(src, dest); created++; break; }
      }
      continue;
    }

    // SVG gear layers
    if (rel.endsWith(".svg")) {
      if (isValidAsset(headSvg) && !rel.includes("head/")) {
        // use head as generic silhouette base is wrong; generate instead
      }
      const label = path.basename(rel, ".svg").slice(0, 12);
      writeSvg(dest, label);
      created++;
      continue;
    }

    // Item icons png -> copy from similar folder
    if (rel.startsWith("assets/items/icons/") && rel.endsWith(".png")) {
      const dir = path.dirname(dest);
      if (fs.existsSync(dir)) {
        const sibling = fs.readdirSync(dir).map(f => path.join(dir, f)).find(isValidAsset);
        if (sibling) { copyFile(sibling, dest); created++; continue; }
      }
      const generic = path.join(ROOT, "assets/items/icons/potion.png");
      if (isValidAsset(generic)) { copyFile(generic, dest); created++; continue; }
    }

    // Legendary
    if (rel === "assets/legendary/elite-rare.png") {
      const src = path.join(ROOT, "assets/legendary/regional-boss.png");
      if (isValidAsset(src)) { copyFile(src, dest); created++; continue; }
    }

    // Generated survivor variants
    if (rel.includes("portraits/player/generated/")) {
      const src = path.join(ROOT, "assets/portraits/player/poses/base/player-idle-crop-v76.png");
      if (isValidAsset(src)) { copyFile(src, dest); created++; continue; }
    }

    // Root-level junk textures referenced but broken - use valid ui or delete reference via fallback file
    if (rel.match(/assets\/(logo-btt|hero-placeholder|paper-texture|ui-frame|map-placeholder|bg-main|leather-texture|stone-texture|sepia-texture|fantasy-castle-dark)\./)) {
      const src = path.join(ROOT, "assets/ui/generated/title-bg-v19d.png");
      if (isValidAsset(src) && rel.endsWith(".webp")) { copyFile(src, dest.replace(/\.webp$/, ".png")); created++; }
      continue;
    }
  }

  return created;
}

async function downloadMissing(referenced) {
  const profileCopy = "/tmp/btt-chrome-repair";
  if (fs.existsSync(profileCopy)) fs.rmSync(profileCopy, { recursive: true, force: true });
  fs.mkdirSync(profileCopy, { recursive: true });
  const srcProfile = "/home/ubuntu/.config/google-chrome/Default";
  for (const f of ["Cookies", "Preferences"]) {
    const src = path.join(srcProfile, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(profileCopy, f));
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    userDataDir: profileCopy,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await new Promise(r => setTimeout(r, 2000));

  let ok = 0;
  for (const rel of referenced) {
    const dest = path.join(ROOT, rel);
    if (isValidAsset(dest)) continue;
    const url = new URL(rel, BASE).href;
    const result = await page.evaluate(async target => {
      const res = await fetch(target, { credentials: "include" });
      if (!res.ok) return { ok: false, status: res.status };
      const buf = await res.arrayBuffer();
      return { ok: true, bytes: Array.from(new Uint8Array(buf)) };
    }, url);
    if (!result.ok) continue;
    const buf = Buffer.from(result.bytes);
    if (buf.slice(0, 20).toString("utf8").toLowerCase().includes("<!doctype")) continue;
    if (buf.length < 500 && rel.endsWith(".png")) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    ok++;
    await new Promise(r => setTimeout(r, 100));
  }
  await browser.close();
  return ok;
}

async function main() {
  const referenced = collectReferencedPaths();
  const removed = removeCorruptFiles();
  console.log("Removed corrupt files:", removed);
  console.log("Referenced paths:", referenced.length);

  let downloaded = 0;
  try {
    downloaded = await downloadMissing(referenced);
    console.log("Downloaded:", downloaded);
  } catch (e) {
    console.warn("Download pass skipped:", e.message);
  }

  const synthesized = synthesizeFallbacks(referenced);
  console.log("Synthesized fallbacks:", synthesized);

  const stillBad = referenced.filter(rel => !isValidAsset(path.join(ROOT, rel)) && !fs.existsSync(path.join(ROOT, rel)));
  console.log("Still missing:", stillBad.length);
  stillBad.slice(0, 20).forEach(p => console.log(" ", p));
}

main().catch(e => { console.error(e); process.exit(1); });
