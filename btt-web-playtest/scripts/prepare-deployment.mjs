import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, lstat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = path.join(appRoot,"dist");
const publicRoot = path.join(distRoot,"public");
const expectedPublicRoot = path.resolve(appRoot,"dist","public");

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

const runtimeFiles = [...TOP_LEVEL_FILES];
for(const tree of RUNTIME_TREES){
  runtimeFiles.push(...await collectTree(tree.directory,tree.extensions));
}
runtimeFiles.sort((a,b)=>a.localeCompare(b,"en"));

const caseFolded = new Set();
for(const relativePath of runtimeFiles){
  const normalized = relativePath.toLowerCase();
  if(caseFolded.has(normalized))throw new Error(`Case-colliding deployment path: ${relativePath}`);
  caseFolded.add(normalized);
}

await rm(publicRoot,{recursive:true,force:true});
await mkdir(publicRoot,{recursive:true});
for(const relativePath of runtimeFiles)await copyRelative(relativePath);

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

const version = JSON.parse(await readFile(path.join(appRoot,"version.json"),"utf8"));
const manifest = {
  artifact_version:version.version,
  file_count:manifestFiles.length,
  total_bytes:totalBytes,
  files:manifestFiles
};
await writeFile(path.join(distRoot,"deployment-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);

console.log(JSON.stringify({
  output:path.relative(appRoot,publicRoot).split(path.sep).join("/"),
  manifest:"dist/deployment-manifest.json",
  version:manifest.artifact_version,
  files:manifest.file_count,
  bytes:manifest.total_bytes
},null,2));
