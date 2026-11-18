#!/usr/bin/env node
// Fails on high or critical npm advisories in production dependencies, except
// advisories listed in .github/audit-exceptions.json. Every exception names
// the advisory, the apps it applies to, the reason it does not affect what
// ships, the tracking issue and an expiry date. An expired exception fails, so it is reviewed again.
//
// Usage: npm audit --omit=dev --json | node npm-audit-gate.mjs <exceptions.json> <app> [YYYY-MM-DD]
// The optional date replaces today's date (used by the tests).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BLOCKING = new Set(['high', 'critical']);

// Returns the advisories that must fail the check, the ones an exception
// covers, and exceptions that have expired or no longer match anything.
// Only exceptions whose "apps" include this app apply.
export function evaluate(audit, exceptions, today, app) {
  exceptions = exceptions.filter((e) => e.apps.includes(app));
  const advisories = new Map();
  for (const [name, vuln] of Object.entries(audit.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
      const id = advisoryId(via.url);
      const entry = advisories.get(id) ?? { id, title: via.title, severity: via.severity, packages: new Set() };
      entry.packages.add(via.name ?? name);
      advisories.set(id, entry);
    }
  }

  const byId = new Map(exceptions.map((e) => [e.advisory, e]));
  const failures = [];
  const excepted = [];
  const expired = [];
  for (const advisory of advisories.values()) {
    const exception = byId.get(advisory.id);
    if (!exception) {
      failures.push(advisory);
    } else if (exception.expires < today) {
      expired.push({ ...exception, advisory });
      failures.push(advisory);
    } else {
      excepted.push({ ...exception, advisory });
    }
  }
  const unused = exceptions.filter((e) => !advisories.has(e.advisory));
  return { failures, excepted, expired, unused };
}

function advisoryId(url = '') {
  const match = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i.exec(url);
  return match ? match[0].toUpperCase() : url;
}

function validate(exceptions) {
  for (const e of exceptions) {
    for (const field of ['advisory', 'apps', 'package', 'reason', 'issue', 'expires']) {
      if (!e[field]) throw new Error(`Exception ${JSON.stringify(e)} is missing "${field}".`);
    }
    if (!Array.isArray(e.apps) || e.apps.length === 0 || !e.apps.every((a) => ['frontend', 'backend'].includes(a))) {
      throw new Error(`Exception ${e.advisory} needs "apps": a list of "frontend" and/or "backend".`);
    }
    if (!/^GHSA-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(e.advisory)) {
      throw new Error(`Exception advisory "${e.advisory}" must be an upper-case GHSA ID.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.expires)) {
      throw new Error(`Exception ${e.advisory} expires "${e.expires}"; use YYYY-MM-DD.`);
    }
  }
}

function main() {
  const [exceptionsPath, app, dateArg] = process.argv.slice(2);
  if (!exceptionsPath || !['frontend', 'backend'].includes(app)) {
    console.error('Usage: npm audit --omit=dev --json | node npm-audit-gate.mjs <exceptions.json> <frontend|backend> [YYYY-MM-DD]');
    process.exit(2);
  }
  const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  validate(exceptions);
  const input = readFileSync(0, 'utf8');
  let audit;
  try {
    audit = JSON.parse(input);
  } catch {
    console.error('::error title=npm audit failed::npm audit did not return JSON.');
    console.error(input.slice(0, 2000));
    process.exit(1);
  }
  if (audit.error) {
    console.error(`::error title=npm audit failed::${audit.error.summary ?? 'unknown error'}`);
    process.exit(1);
  }

  const today = dateArg ?? new Date().toISOString().slice(0, 10);
  const { failures, excepted, expired, unused } = evaluate(audit, exceptions, today, app);

  for (const e of excepted) {
    console.log(`::notice title=Accepted advisory ${e.advisory.id}::${e.package}: ${e.reason} Expires ${e.expires} (#${e.issue}).`);
  }
  for (const e of expired) {
    console.log(`::error title=Exception expired::${e.advisory.id} (${e.package}) expired on ${e.expires}. Re-check it and update or remove it in .github/audit-exceptions.json (#${e.issue}).`);
  }
  for (const e of unused) {
    console.log(`::notice title=Exception no longer needed::${e.advisory} no longer appears in the ${app} audit. Remove ${app} from its apps in .github/audit-exceptions.json, or the whole exception if no app needs it.`);
  }
  for (const f of failures) {
    console.log(`::error title=${f.severity} advisory ${f.id}::${f.title} (${[...f.packages].join(', ')})`);
  }
  if (failures.length > 0) {
    console.log(`${failures.length} high or critical advisory(ies) in production dependencies.`);
    process.exit(1);
  }
  console.log(`No unaccepted high or critical advisories (${excepted.length} accepted by exception).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
