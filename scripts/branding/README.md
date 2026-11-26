# TSEK sharing and home-screen assets

`frontend/index.html` contains crawler-readable Open Graph and Twitter metadata.
The production origin is `https://tsek-seven.vercel.app`, matching the uptime
workflow. Update both OG/Twitter image URLs and `og:url` if that origin changes.
Hash routes share the site-wide preview; no private application data is included.

## Asset sources

- `frontend/public/favicon.svg`: the existing TSEK ribbon mark, copied from
  `frontend/public/figma/1-imgForwardMarkEditableRibbonVectors.svg`. The original
  remains because in-app branding still uses it. The favicon link no longer does.
- `social-preview.html`: editable 1200 × 630 Queue Ticket artwork using the
  existing Sora / Source Sans 3 fonts and `frontend/src/tokens.css` palette.
- PNGs are browser renders of these sources, not AI-generated artwork.
- Manifest theme color: `--brand-navy` (`#384959`); background: `--canvas`
  (`#e9eff4`). Keep these literal values aligned with the tokens.
- The maskable icon keeps the ribbon inside the central safe area. Apple and
  regular app icons have an opaque canvas background and no baked-in rounded mask.

## Regeneration

Use Node.js with Playwright installed in a separate tooling directory; point
`NODE_PATH` at that directory's `node_modules`, then run:

```text
node scripts/branding/render-assets.cjs
```

Install Playwright's Chromium first, or set `PLAYWRIGHT_CHANNEL=msedge` to use an
installed Edge. The social artwork loads the same Google fonts as the app, so
network access is required. The script fails if Sora is unavailable. It does not
add dependencies to the application or include tooling in the shipped bundle.

## Validation and release follow-up

Locally verified: image dimensions, artwork legibility, icon safe area, manifest
colors and resource paths, frontend security-header tests, and both bundle audit
scans. The manifest provides home-screen identity; it adds no service worker or
offline behavior.

After an approved merge is deployed, verify `/manifest.webmanifest`, all icons,
and `/og-image.png` return their declared formats on production. Use the Facebook
Sharing Debugger to scrape `https://tsek-seven.vercel.app/`, refresh cached metadata,
and attach its screenshot to the PR. Check Add to Home Screen on an actual phone.
These live checks are pending; a local build cannot prove a social crawler has
fetched a production asset that has not been deployed yet.
