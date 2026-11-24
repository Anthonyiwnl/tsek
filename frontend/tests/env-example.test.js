import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
// Set by Vercel at build time, never by us.
const platform = new Set(["VERCEL", "VERCEL_ENV", "VERCEL_URL", "NODE_ENV", "MODE", "DEV", "PROD", "BASE_URL", "SSR"]);

function files(directory) {
  return readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return files(`${directory}${entry.name}/`);
    return /\.(js|jsx|ts|tsx|html)$/.test(entry.name) ? [readFileSync(new URL(`${directory}${entry.name}`, root), "utf8")] : [];
  });
}

const code = [...files("src/"), ...files("api/"), readFileSync(new URL("vite.config.js", root), "utf8"),
  readFileSync(new URL("index.html", root), "utf8")];
const read = new Set(code.flatMap((text) => [
  ...[...text.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)].map(([, name]) => name),
  ...[...text.matchAll(/%(VITE_[A-Z0-9_]+)%/g)].map(([, name]) => name),
]));
const documented = new Set([...readFileSync(new URL(".env.example", root), "utf8")
  .matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map(([, name]) => name));

test("every variable the frontend reads is in frontend/.env.example", () => {
  const missing = [...read].filter((name) => !documented.has(name) && !platform.has(name));
  assert.deepEqual(missing, []);
});

test("frontend/.env.example lists no variable the frontend never reads", () => {
  assert.deepEqual([...documented].filter((name) => !read.has(name)), []);
});

test("only VITE_ variables reach the browser bundle", () => {
  for (const text of files("src/")) {
    for (const [, name] of text.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]+)/g)) {
      assert.ok(name.startsWith("VITE_") || platform.has(name), `${name} in src/ must be a public VITE_ variable`);
    }
    assert.doesNotMatch(text, /process\.env\./, "src/ must not read server environment variables");
  }
});
