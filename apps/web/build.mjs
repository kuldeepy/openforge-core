import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = import.meta.dirname;
const repoRoot = resolve(appRoot, "../..");
const dist = resolve(appRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "assets"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await copyFile(resolve(appRoot, "src", file), resolve(dist, file));
}

await copyFile(resolve(repoRoot, "examples/conveyor-demo/workflow.json"), resolve(dist, "assets/conveyor-workflow.json"));
await copyFile(resolve(repoRoot, "examples/conveyor-demo/simulation-config.yaml"), resolve(dist, "assets/conveyor-simulation-config.yaml"));

const required = ["index.html", "styles.css", "app.js", "assets/conveyor-workflow.json"];
for (const file of required) {
  await access(resolve(dist, file));
}

const manifest = {
  name: "OpenForge Core Web MVP",
  builtAt: new Date().toISOString(),
  assets: required
};

await writeFile(resolve(dist, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const workflow = JSON.parse(await readFile(resolve(dist, "assets/conveyor-workflow.json"), "utf8"));
if (!workflow.workflows?.[0]?.nodes?.length) {
  throw new Error("Conveyor workflow asset is missing nodes.");
}

console.log(`built web app at ${dist}`);
