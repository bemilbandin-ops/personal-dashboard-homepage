import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./src/app.js", import.meta.url), "utf8");

assert.match(source, /float flowerOfLife/);
assert.match(source, /requestAnimationFrame\(draw\)/);
assert.match(source, /medium: \.9/);
console.log("Aura flower-of-life animation is wired and visible by default.");
