import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function headersFor(path) {
  const found = {};
  for (const rule of config.headers ?? []) {
    if (new RegExp(`^${rule.source}$`).test(path)) {
      for (const { key, value } of rule.headers) found[key.toLowerCase()] = value;
    }
  }
  return found;
}

function directives(csp) {
  return Object.fromEntries(csp.split(";").map((part) => part.trim()).filter(Boolean)
    .map((part) => { const [name, ...values] = part.split(/\s+/); return [name, values]; }));
}

test("every route gets the security headers", () => {
  for (const path of ["/", "/index.html", "/assets/index-abc123.js", "/api/services"]) {
    const headers = headersFor(path);
    assert.equal(headers["x-frame-options"], "DENY", path);
    assert.equal(headers["x-content-type-options"], "nosniff", path);
    assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin", path);
    assert.match(headers["strict-transport-security"], /max-age=\d{8,}/, path);
    assert.match(headers["permissions-policy"], /camera=\(\)/, path);
    assert.ok(headers["content-security-policy"], path);
  }
});

test("the CSP blocks inline scripts, plugins, framing and foreign scripts", () => {
  const csp = directives(headersFor("/")["content-security-policy"]);
  assert.deepEqual(csp["script-src"], ["'self'"]);
  assert.deepEqual(csp["object-src"], ["'none'"]);
  assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
  assert.deepEqual(csp["base-uri"], ["'self'"]);
  assert.ok(!JSON.stringify(csp).includes("unsafe-eval"));
});

test("index.html only uses what the CSP allows", () => {
  const csp = directives(headersFor("/")["content-security-policy"]);
  // No inline scripts: script-src 'self' would block them.
  for (const [, attributes, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.match(attributes, /\ssrc="\//, "every script is a same-origin file");
    assert.equal(body.trim(), "", "no inline script code");
  }
  assert.doesNotMatch(html, /\son[a-z]+=/i, "no inline event handlers");
  // Every external stylesheet and font origin must be allowed.
  for (const [, origin] of html.matchAll(/href="(https:\/\/[^/"]+)/g)) {
    const allowed = [...csp["style-src"], ...csp["font-src"]];
    assert.ok(allowed.includes(origin), `${origin} is allowed by style-src or font-src`);
  }
});
