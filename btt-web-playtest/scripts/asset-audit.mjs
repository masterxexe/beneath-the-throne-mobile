#!/usr/bin/env node
/** Quick asset health check — run before commits. */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");

function collectRefs() {
  const refs = new Set();
  for (const file of fs.readdirSync(SRC).filter(f => f.endsWith(".js"))) {
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    for (const m of text.matchAll(/assets\/[a-zA-Z0-9_./-]+/g)) refs.add(m[0]);
  }
  return [...refs].sort();
}

function main() {
  const refs = collectRefs();
  const missing = [];
  const small = [];
  const html = [];

  for (const ref of refs) {
    const p = path.join(ROOT, ref);
    if (!fs.existsSync(p)) missing.push(ref);
    else if (fs.statSync(p).isDirectory()) continue;
    else if (ref.endsWith(".png") && fs.statSync(p).size < 8000) small.push([fs.statSync(p).size, ref]);
    else if (/\.(png|jpg|webp|svg)$/i.test(ref)) {
      const head = fs.readFileSync(p).slice(0, 8);
      if (head.toString("utf8", 0, 5).toLowerCase().includes("<!doc")) html.push(ref);
    }
  }

  console.log(`Asset audit: ${refs.length} refs, ${missing.length} missing, ${small.length} tiny, ${html.length} corrupt HTML`);
  if (missing.length) { console.log("\nMissing:"); missing.forEach(r => console.log(" ", r)); }
  if (html.length) { console.log("\nCorrupt HTML:"); html.forEach(r => console.log(" ", r)); }
  if (small.length) { console.log("\nTiny (<8KB):"); small.slice(0, 10).forEach(([s, r]) => console.log(`  ${s} ${r}`)); }
  process.exit(missing.length || html.length ? 1 : 0);
}

main();
