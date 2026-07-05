import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("launcher credentials stay in ignored local files", () => {
  const trackedConfig = read("src/launcher-config.js");
  assert.match(trackedConfig, /Aura\.launcherToken\s*=\s*['"]['"]/);
  assert.doesNotMatch(trackedConfig, /\b[a-f\d]{64}\b/i);

  const ignored = read(".gitignore").split(/\r?\n/);
  assert.equal(ignored.filter(line => line === "src/launcher-config.local.js").length, 1);

  for (const script of ["install.ps1", "uninstall.ps1"]) {
    const source = read(`launcher-helper/${script}`);
    assert.match(source, /src\\launcher-config\.local\.js/);
    assert.doesNotMatch(source, /src\\launcher-config\.js/);
  }

  const html = read("index.html");
  assert.ok(html.indexOf("src/launcher-config.js") < html.indexOf("src/launcher-config.local.js"));
});
