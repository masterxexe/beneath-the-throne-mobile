import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, lstat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = path.join(appRoot,"dist");
const publicRoot = path.join(distRoot,"public");
const expectedPublicRoot = path.resolve(appRoot,"dist","public");
const PROFILE_REVISION = 1;

function argumentValue(name){
  const exactIndex = process.argv.indexOf(name);
  if(exactIndex >= 0)return process.argv[exactIndex + 1] || "";
  const prefixed = process.argv.find(argument=>argument.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : "";
}

const deploymentProfile = argumentValue("--profile");
if(deploymentProfile !== "hackathon"){
  throw new Error("Refusing to prepare a public artifact without the explicit --profile hackathon flag.");
}

if(path.resolve(publicRoot) !== expectedPublicRoot || path.dirname(publicRoot) !== distRoot){
  throw new Error(`Refusing to prepare an unexpected output path: ${publicRoot}`);
}

const TOP_LEVEL_FILES = [
  "index.html",
  "privacy.html",
  "terms.html",
  "recovery.html",
  "styles.css",
  "redesign.css",
  "combat-animations.css",
  "manifest.webmanifest",
  "service-worker.js",
  "version.json"
];

const RUNTIME_TREES = [
  {directory:"src", extensions:new Set([".js"])},
  {directory:"assets", extensions:new Set([".png",".svg",".webp",".jpg",".jpeg"])},
  {directory:"icons", extensions:new Set([".png"])}
];

const HACKATHON_EXCLUDED_FILES = new Set([
  "src/supporterStore.js"
]);

function replacePattern(source,pattern,replacement,expected,label){
  let count = 0;
  const output = source.replace(pattern,(...args)=>{
    count += 1;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if(count !== expected)throw new Error(`Hackathon transform expected ${expected} ${label} match(es), found ${count}.`);
  return output;
}

function escapeRegExp(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

async function transformPublicFile(relativePath,transform){
  const absolute = path.join(publicRoot,...relativePath.split("/"));
  const before = await readFile(absolute,"utf8");
  const after = transform(before);
  if(after === before)throw new Error(`Hackathon transform made no change to ${relativePath}.`);
  await writeFile(absolute,after);
}

async function applyHackathonProfile(sourceVersion){
  const sourceCache = sourceVersion.cache.replace(/^v/,"");
  const profileSuffix = `hackathon.${PROFILE_REVISION}`;
  const artifactVersion = `${sourceVersion.version}-${profileSuffix}`;
  const artifactCache = `${sourceCache}-${profileSuffix}`;

  await transformPublicFile("index.html",source=>{
    source = replacePattern(source,/^\s*<button class="hud-icon-btn" data-action="court-ledger"[^\n]*\r?\n/m,"",1,"Court Ledger HUD button");
    source = replacePattern(source,/^\s*<section id="support" class="screen"><\/section>\r?\n/m,"",1,"Court Ledger screen");
    source = replacePattern(source,/(<meta name="application-name" content="Beneath the Throne" \/>\r?\n)/,(_match,applicationName)=>`${applicationName}  <meta name="btt-build-profile" content="hackathon" />\n`,1,"build-profile marker");
    source = replacePattern(source,new RegExp(`\\?v=${sourceCache}`,"g"),`?v=${artifactCache}`,2,"index cache version");
    return source;
  });

  await transformPublicFile("src/main.js",source=>{
    source = replacePattern(source,/^import \* as supporterStore from "\.\/supporterStore\.js";\r?\n/m,"",1,"supporter store import");
    source = replacePattern(source,/^\s*\.\.\.supporterStore,\r?\n/m,"",1,"supporter store FE spread");
    source = replacePattern(source,/^\s*const ledgerButton = event\.target\.closest\("\[data-action='court-ledger'\]"\);\r?\n\s*if\(ledgerButton\)show\("support"\);\r?\n/m,"",1,"Court Ledger click handler");
    source = replacePattern(source,/new Set\(\["forceTravelEncounter","toggleStoreReadiness"\]\)/,"new Set([\"forceTravelEncounter\"])",1,"non-prefixed dev helper list");
    return source;
  });

  await transformPublicFile("src/ui.js",source=>{
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    source = replacePattern(source,/export function show\(id\)\{/,`export function show(id){${eol}  if(id === "support")id = "home";`,1,"disabled support route");
    source = replacePattern(source,/^\s*if\(currentScreen==="support"\)window\.FE\?\.renderSupport\?\.\(\);\r?\n/m,"",1,"support screen renderer");
    source = replacePattern(source,/renderPlayerHudPortrait\(h, \{supporterFrame:state\.supporter\?\.equipped\?\.frame, supporterCloak:state\.supporter\?\.equipped\?\.cloak\}\)/,"renderPlayerHudPortrait(h)",1,"supporter HUD cosmetics");
    source = replacePattern(source,/^\s*\$\{state\.supporter\?\.title \? `<span class="pill hud-token hud-token-founder">\$\{esc\(state\.supporter\.title\)\}<\/span>` : ""\}\r?\n/m,"",1,"supporter HUD title");
    source = replacePattern(source,/^\s*const ledgerBtn = document\.querySelector\("\[data-action='court-ledger'\]"\);\r?\n\s*if\(ledgerBtn\)\{\r?\n\s*ledgerBtn\.setAttribute\("aria-label", tx\("courtLedger"\)\);\r?\n\s*ledgerBtn\.title = tx\("courtLedger"\);\r?\n\s*\}\r?\n/m,"",1,"Court Ledger HUD localization");
    source = replacePattern(source,/function saveSlotCount\(\)\{\r?\n\s*const owned = state\?\.supporter\?\.owned \|\| \[\];\r?\n\s*return state\?\.supporter\?\.extraSlots \|\| owned\.includes\("founder_pack"\) \|\| owned\.includes\("ash_court_pass"\) \? 5 : 3;\r?\n\}/,`function saveSlotCount(){${eol}  return 3;${eol}}`,1,"supporter save-slot entitlement");
    return source;
  });

  await transformPublicFile("src/levelUp.js",source=>replacePattern(
    source,
    /renderPlayerHudPortrait\(h, \{supporterFrame:state\.supporter\?\.equipped\?\.frame, supporterCloak:state\.supporter\?\.equipped\?\.cloak\}\)/,
    "renderPlayerHudPortrait(h)",
    1,
    "supporter level-up cosmetics"
  ));

  await transformPublicFile("src/slumPrologue.js",source=>{
    source = replacePattern(source,/function slumSupportButtonHTML\(complete\)\{[\s\S]*?^\}\r?\n\r?\n/m,"",1,"dead Court Ledger slum button");
    source = replacePattern(source,/\s*\{label:tx\("enterLowerWard"\),cls:"primary",fn:\(\)=>window\.FE\.enterLowerWard\?\.\(\) \|\| refresh\(\)\},\r?\n\s*\{label:tx\("courtLedger"\),cls:"secondary",fn:\(\)=>window\.FE\.show\("support"\)\}\r?\n/,"\n    {label:tx(\"enterLowerWard\"),cls:\"primary\",fn:()=>window.FE.enterLowerWard?.() || refresh()}\n",1,"gate-completion Court Ledger action");
    return source;
  });

  await transformPublicFile("src/language.js",source=>{
    const tutorialCopy = [
      "    mainTutorialStep6: \"The save icon opens local save slots. Save before major decisions.\",",
      "    mainTutorialStep6: \"El icono de guardado abre partidas locales. Guarda antes de decisiones importantes.\","
    ];
    let tutorialIndex = 0;
    source = replacePattern(source,/^\s{4}mainTutorialStep6:.*$/gm,()=>tutorialCopy[tutorialIndex++],2,"main tutorial monetization copy");
    source = replacePattern(source,/^\s{4}courtLedger:.*\r?\n[\s\S]*?^\s{4}noPowerSales:.*\r?\n/gm,"",2,"localized Court Ledger/payment block");
    return source;
  });

  await transformPublicFile("privacy.html",source=>{
    source = replacePattern(source,/<p>Save files, language, supporter cosmetics, and checkout-link settings are stored in your browser \(localStorage\)\. A service worker may cache game files so the playtest can reload offline\.<\/p>/,"<p>Save files and language settings are stored in your browser (localStorage). A service worker may cache game files so the playtest can reload offline.</p>",1,"privacy storage description");
    source = replacePattern(source,/\s*<h2>Payments<\/h2>\r?\n\s*<p>[\s\S]*?<\/p>\r?\n\s*<h2>Ads<\/h2>\r?\n\s*<p>[\s\S]*?<\/p>\r?\n/,"\n",1,"privacy payment and advertising sections");
    return source;
  });

  await transformPublicFile("terms.html",source=>{
    source = replacePattern(source,/<p>This is a dark-fantasy roleplaying game with painted combat, fictional violence, and optional cosmetic purchases\. It is a playtest build: systems, prices, and saves may change\.<\/p>/,"<p>This is a dark-fantasy roleplaying game with painted combat and fictional violence. It is a playtest build: systems and saves may change.</p>",1,"terms purchase description");
    source = replacePattern(source,/\s*<h2>Purchases<\/h2>\r?\n\s*<p>[\s\S]*?<\/p>\r?\n/,"\n",1,"terms purchase section");
    return source;
  });

  await transformPublicFile("service-worker.js",source=>{
    source = replacePattern(source,new RegExp(`APP_VERSION = "${escapeRegExp(sourceVersion.version)}"`),`APP_VERSION = "${artifactVersion}"`,1,"service-worker profile version");
    source = replacePattern(source,/^\s*"\.\/src\/supporterStore\.js",\r?\n/m,"",1,"supporter store precache entry");
    source = replacePattern(source,new RegExp(`\\?v=${sourceCache}`,"g"),`?v=${artifactCache}`,2,"service-worker cache version");
    return source;
  });

  await transformPublicFile("src/pwa.js",source=>replacePattern(
    source,
    new RegExp(`BUILD_VERSION = "${escapeRegExp(sourceVersion.version)}"`),
    `BUILD_VERSION = "${artifactVersion}"`,
    1,
    "PWA profile version"
  ));

  const artifactVersionJson = {
    ...sourceVersion,
    version:artifactVersion,
    cache:`v${artifactCache}`,
    build_profile:"hackathon",
    profile_revision:PROFILE_REVISION,
    features:{
      court_ledger:false,
      payments:false,
      mock_purchases:false
    }
  };
  await writeFile(path.join(publicRoot,"version.json"),`${JSON.stringify(artifactVersionJson,null,2)}\n`);
  return artifactVersionJson;
}

async function collectTree(directory, extensions){
  const root = path.join(appRoot,directory);
  const files = [];

  async function walk(current){
    const entries = await readdir(current,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name,"en"));
    for(const entry of entries){
      const absolute = path.join(current,entry.name);
      const info = await lstat(absolute);
      if(info.isSymbolicLink())throw new Error(`Deployment input cannot be a symlink: ${path.relative(appRoot,absolute)}`);
      if(info.isDirectory()){
        await walk(absolute);
        continue;
      }
      if(!info.isFile())throw new Error(`Unsupported deployment input: ${path.relative(appRoot,absolute)}`);
      const extension = path.extname(entry.name).toLowerCase();
      if(!extensions.has(extension)){
        throw new Error(`Unexpected file type in runtime tree: ${path.relative(appRoot,absolute)}`);
      }
      files.push(path.relative(appRoot,absolute).split(path.sep).join("/"));
    }
  }

  await walk(root);
  return files;
}

async function copyRelative(relativePath){
  const source = path.join(appRoot,...relativePath.split("/"));
  const destination = path.join(publicRoot,...relativePath.split("/"));
  const sourceInfo = await lstat(source);
  if(!sourceInfo.isFile() || sourceInfo.isSymbolicLink()){
    throw new Error(`Deployment input must be a regular file: ${relativePath}`);
  }
  await mkdir(path.dirname(destination),{recursive:true});
  await copyFile(source,destination);
}

let runtimeFiles = [...TOP_LEVEL_FILES];
for(const tree of RUNTIME_TREES){
  runtimeFiles.push(...await collectTree(tree.directory,tree.extensions));
}
runtimeFiles = runtimeFiles.filter(relativePath=>!HACKATHON_EXCLUDED_FILES.has(relativePath));
runtimeFiles.sort((a,b)=>a.localeCompare(b,"en"));

const caseFolded = new Set();
for(const relativePath of runtimeFiles){
  const normalized = relativePath.toLowerCase();
  if(caseFolded.has(normalized))throw new Error(`Case-colliding deployment path: ${relativePath}`);
  caseFolded.add(normalized);
}

await mkdir(publicRoot,{recursive:true});
for(const entry of await readdir(publicRoot)){
  const target = path.resolve(publicRoot,entry);
  if(path.dirname(target) !== publicRoot)throw new Error(`Refusing to clear an unexpected artifact path: ${target}`);
  await rm(target,{recursive:true,force:true});
}
for(const relativePath of runtimeFiles)await copyRelative(relativePath);

const sourceVersion = JSON.parse(await readFile(path.join(appRoot,"version.json"),"utf8"));
const version = await applyHackathonProfile(sourceVersion);

const manifestFiles = [];
let totalBytes = 0;
for(const relativePath of runtimeFiles){
  const absolute = path.join(publicRoot,...relativePath.split("/"));
  const [contents,info] = await Promise.all([readFile(absolute),stat(absolute)]);
  totalBytes += info.size;
  manifestFiles.push({
    path:relativePath,
    bytes:info.size,
    sha256:createHash("sha256").update(contents).digest("hex")
  });
}

const manifest = {
  artifact_version:version.version,
  build_profile:deploymentProfile,
  excluded_features:["court_ledger","payments","mock_purchases"],
  file_count:manifestFiles.length,
  total_bytes:totalBytes,
  files:manifestFiles
};
await writeFile(path.join(distRoot,"deployment-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);

console.log(JSON.stringify({
  output:path.relative(appRoot,publicRoot).split(path.sep).join("/"),
  manifest:"dist/deployment-manifest.json",
  profile:deploymentProfile,
  version:manifest.artifact_version,
  files:manifest.file_count,
  bytes:manifest.total_bytes
},null,2));
