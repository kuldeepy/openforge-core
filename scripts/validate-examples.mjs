import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const files = ["examples/conveyor-demo/workflow.json"];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of files) {
  const text = await readFile(resolve(repoRoot, file), "utf8");
  JSON.parse(text);
  console.log(`validated ${file}`);
}
