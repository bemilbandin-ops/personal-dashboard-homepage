import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function loadFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) {
      const context = {};
      vm.runInNewContext(`${source.slice(start, index + 1)}; result = ${name};`, context);
      return context.result;
    }
  }
  assert.fail(`${name} must have a complete body`);
}

test("single-document views expose navigation targets and empty feature roots", () => {
  assert.equal((html.match(/<!doctype html>/gi) || []).length, 1);
  for (const view of ["home", "productivity", "atmosphere", "library"]) {
    assert.match(html, new RegExp(`data-view="${view}"`));
    assert.match(html, new RegExp(`data-view-target="${view}"`));
  }
  for (const id of ["productivity-root", "atmosphere-controls", "library-search", "library-web", "library-windows"])
    assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /data-view-target="[^"]+"[^>]*data-open-settings|data-open-settings[^>]*data-view-target="[^"]+"/);
});

test("navigation selects one view, tracks active state, and normalizes the hash", () => {
  assert.match(app, /function showView\(name\)/);
  assert.match(app, /view\.hidden\s*=\s*view\.dataset\.view\s*!==\s*selected/);
  assert.match(app, /button\.classList\.toggle\("active",\s*button\.dataset\.viewTarget\s*===\s*selected\)/);
  assert.match(app, /history\.replaceState\(null,\s*"",\s*nextHash\)/);
  assert.match(app, /showView\(location\.hash\.slice\(1\)\s*\|\|\s*"home"\)/);
});

test("navigation follows later hash changes without redundant history writes", () => {
  assert.match(app, /addEventListener\("hashchange",\s*showHashView\)/);
  assert.match(app, /if\s*\(location\.hash\s*!==\s*nextHash\)\s*history\.replaceState/);
});

test("selected navigation exposes aria-current and clears it from other items", () => {
  assert.match(html, /data-view-target="home"[^>]*aria-current="page"|aria-current="page"[^>]*data-view-target="home"/);
  assert.match(app, /button\.setAttribute\("aria-current",\s*"page"\)/);
  assert.match(app, /button\.removeAttribute\("aria-current"\)/);
});

test("malformed and unknown hashes resolve safely to home", () => {
  const resolveViewName = loadFunction(app, "resolveViewName");
  assert.equal(resolveViewName("library"), "library");
  assert.equal(resolveViewName(`\"]`), "home");
  assert.equal(resolveViewName("unknown"), "home");
});

test("slash shortcut ignores every editable target", () => {
  const isEditableTarget = loadFunction(app, "isEditableTarget");
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"])
    assert.equal(isEditableTarget({ tagName }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "BUTTON", isContentEditable: false }), false);
});

test("mobile keeps a compact non-overflowing view navigation", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 760px)"));
  assert.doesNotMatch(mobile, /\.sidebar nav[^\{]*\{[^}]*display:\s*none/);
  assert.match(mobile, /\.sidebar nav\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(mobile, /\.sidebar nav button\s*\{[^}]*min-width:\s*0/s);
});
