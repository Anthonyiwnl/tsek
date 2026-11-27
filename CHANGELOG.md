# Changelog

Notable changes to TSEK, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## How to release

1. Before tagging, move everything under **Unreleased** into a new section
   `## [X.Y.Z] - YYYY-MM-DD` in a pull request, and merge it.
2. Wait for **CI and deployment** on `main` to pass (staging and production
   deployed and smoke-tested).
3. Tag that commit on `main` and push the tag:

   ```
   git checkout main && git pull
   git tag -a v1.0.0 -m "TSEK v1.0.0"
   git push origin v1.0.0
   ```

4. The **Release** workflow checks the tag is on `main` with a passing run, then
   publishes a GitHub Release using this file's section as the notes.

Each entry links the pull request that made the change.

## [Unreleased]

## [1.2.0] - 2026-11-27

Demo Day release, cut at the 27 Nov 2026 code freeze. Barangay staff can review
submitted applications, the whole site uses the Queue Ticket design, and the AI
calls and API are hardened with logging, a circuit breaker and rate limits.
Production was checked signed in on 27 Nov, and a quick Strix scan of staging
reported no vulnerabilities.

### Added
- Barangay staff dashboard and review permissions ([#225](https://github.com/Anthonyiwnl/tsek/pull/225)), the restyled staff queue and review screen ([#271](https://github.com/Anthonyiwnl/tsek/pull/271)), and read-only decision states for citizens ([#272](https://github.com/Anthonyiwnl/tsek/pull/272)).
- Account owners can set a password with email verification ([#227](https://github.com/Anthonyiwnl/tsek/pull/227)); registration and verification in the Queue Ticket design ([#324](https://github.com/Anthonyiwnl/tsek/pull/324)).
- Queue Ticket redesign: design tokens and text contrast ([#259](https://github.com/Anthonyiwnl/tsek/pull/259)), Button, Badge and shared AppHeader ([#260](https://github.com/Anthonyiwnl/tsek/pull/260)), ticket header, tracker and checklist ([#261](https://github.com/Anthonyiwnl/tsek/pull/261)), modals ([#262](https://github.com/Anthonyiwnl/tsek/pull/262)), TSK reference helper ([#273](https://github.com/Anthonyiwnl/tsek/pull/273)), citizen dashboard merged into My applications ([#283](https://github.com/Anthonyiwnl/tsek/pull/283)), landing and sign-in ([#315](https://github.com/Anthonyiwnl/tsek/pull/315)), mobile and tablet layouts ([#317](https://github.com/Anthonyiwnl/tsek/pull/317)), and accessible motion ([#363](https://github.com/Anthonyiwnl/tsek/pull/363)).
- Print or save a summary of READY applications ([#364](https://github.com/Anthonyiwnl/tsek/pull/364)).
- Link previews, home-screen icons and a favicon ([#350](https://github.com/Anthonyiwnl/tsek/pull/350)), with browser fallback icons ([#382](https://github.com/Anthonyiwnl/tsek/pull/382)).
- Submitting with missing items asks for confirmation first, and the checklist at submission is saved for staff ([#383](https://github.com/Anthonyiwnl/tsek/pull/383)).
- AI call logs with cost, retries, validation result and fallback ([#281](https://github.com/Anthonyiwnl/tsek/pull/281)), a log of every request with trace spans ([#282](https://github.com/Anthonyiwnl/tsek/pull/282)), and a golden signals and AI signals dashboard ([#286](https://github.com/Anthonyiwnl/tsek/pull/286)).
- Circuit breaker and bulkhead for AI calls ([#285](https://github.com/Anthonyiwnl/tsek/pull/285)); API rate limits by IP and user ([#314](https://github.com/Anthonyiwnl/tsek/pull/314)).

### Changed
- Document text is wrapped in `<document>` tags (prompt 1.2.0) ([#287](https://github.com/Anthonyiwnl/tsek/pull/287)).
- Clearer extracted field labels and analysis errors ([#265](https://github.com/Anthonyiwnl/tsek/pull/265)), document results and validation ([#288](https://github.com/Anthonyiwnl/tsek/pull/288)), application forms ([#361](https://github.com/Anthonyiwnl/tsek/pull/361)), and application and checklist statuses ([#380](https://github.com/Anthonyiwnl/tsek/pull/380)).
- Ticket links on the landing page preselect the service ([#362](https://github.com/Anthonyiwnl/tsek/pull/362)).
- Unused `FigmaDesign.css` and `NewApplication.tsx` deleted ([#256](https://github.com/Anthonyiwnl/tsek/pull/256)).

### Fixed
- Staff searches match TSK references ([#266](https://github.com/Anthonyiwnl/tsek/pull/266)).
- Auth URLs corrected, and Admin records hidden from citizens ([#360](https://github.com/Anthonyiwnl/tsek/pull/360)).
- Uploads with text beyond the analysis character limit are rejected ([#369](https://github.com/Anthonyiwnl/tsek/pull/369)).
- Split PhilSys names are extracted ([#375](https://github.com/Anthonyiwnl/tsek/pull/375)), and common electric and water bill titles count as proof of residency ([#384](https://github.com/Anthonyiwnl/tsek/pull/384)).
- Replacing a document refreshes the application once ([#381](https://github.com/Anthonyiwnl/tsek/pull/381)), only the latest notice is shown ([#385](https://github.com/Anthonyiwnl/tsek/pull/385)), and the submission consent checkbox has the right size and layout ([#387](https://github.com/Anthonyiwnl/tsek/pull/387)).

### Security
- Security headers and a Content Security Policy on the frontend ([#297](https://github.com/Anthonyiwnl/tsek/pull/297)), a least-privilege database role for the API ([#298](https://github.com/Anthonyiwnl/tsek/pull/298)), and the unused `JWT_SECRET` removed with `NODE_ENV=production` required ([#299](https://github.com/Anthonyiwnl/tsek/pull/299)).
- Bundle audit fails on exposed files ([#300](https://github.com/Anthonyiwnl/tsek/pull/300)), CodeQL code scanning ([#308](https://github.com/Anthonyiwnl/tsek/pull/308)), third-party actions pinned to commit SHAs ([#313](https://github.com/Anthonyiwnl/tsek/pull/313)), and the build-only picomatch advisory accepted with an expiry, then removed after the root-cause fix ([#270](https://github.com/Anthonyiwnl/tsek/pull/270), [#310](https://github.com/Anthonyiwnl/tsek/pull/310)).
- Threat model with trust boundaries and OWASP mapping ([#280](https://github.com/Anthonyiwnl/tsek/pull/280)), and a manual Strix penetration test of staging ([#301](https://github.com/Anthonyiwnl/tsek/pull/301), [#331](https://github.com/Anthonyiwnl/tsek/pull/331)). Quick unauthenticated scans on 24 and 27 Nov reported no vulnerabilities.

### Pipeline
- Checks run as parallel jobs (optimization 5, [#252](https://github.com/Anthonyiwnl/tsek/pull/252)), and the Vercel build starts while the backend wakes up (optimization 6, [#268](https://github.com/Anthonyiwnl/tsek/pull/268)).
- Accessibility tests and Lighthouse checks ([#258](https://github.com/Anthonyiwnl/tsek/pull/258)), with floors raised to 0.95 ([#319](https://github.com/Anthonyiwnl/tsek/pull/319)).
- The production prompt is evaluated on every prompt change ([#307](https://github.com/Anthonyiwnl/tsek/pull/307)).
- The Claude review replaces CodeRabbit ([#322](https://github.com/Anthonyiwnl/tsek/pull/322)).
- Dependency updates ([#228](https://github.com/Anthonyiwnl/tsek/pull/228), [#311](https://github.com/Anthonyiwnl/tsek/pull/311), [#326](https://github.com/Anthonyiwnl/tsek/pull/326), [#327](https://github.com/Anthonyiwnl/tsek/pull/327), [#328](https://github.com/Anthonyiwnl/tsek/pull/328), [#329](https://github.com/Anthonyiwnl/tsek/pull/329)).

### Documentation
- Final AI evaluation write-up ([#218](https://github.com/Anthonyiwnl/tsek/pull/218)), staging AI failure drill ([#221](https://github.com/Anthonyiwnl/tsek/pull/221)), final-week pipeline metrics and DevOps status ([#220](https://github.com/Anthonyiwnl/tsek/pull/220)), and measurements for optimizations 5 and 6 ([#306](https://github.com/Anthonyiwnl/tsek/pull/306)).
- Lighthouse and bundle metrics before and after the redesign ([#254](https://github.com/Anthonyiwnl/tsek/pull/254), [#323](https://github.com/Anthonyiwnl/tsek/pull/323)), the UI refresh scope change ([#257](https://github.com/Anthonyiwnl/tsek/pull/257)), stale records removed ([#255](https://github.com/Anthonyiwnl/tsek/pull/255)), and INC-03 closed ([#264](https://github.com/Anthonyiwnl/tsek/pull/264)).
- Usability check of the barangay clearance flow: an expert walkthrough, as the user sessions were not run ([#320](https://github.com/Anthonyiwnl/tsek/pull/320)).
- DevOps demo file ([#223](https://github.com/Anthonyiwnl/tsek/pull/223)) and the final acceptance audit for [#40](https://github.com/Anthonyiwnl/tsek/issues/40) ([#388](https://github.com/Anthonyiwnl/tsek/pull/388)).

### Known limitations
Found in the 27 Nov production check:
- Uploads accept plain-text documents only; photo and PDF analysis is not in this release.
- Document types must match the accepted names. A title with extra text, such as "PHILIPPINE IDENTIFICATION CARD (PhilSys ID)" or "COMMUNITY TAX CERTIFICATE (CEDULA)", is not matched.
- Some split-name layouts, such as bilingual "Apelyido / Last Name" labels, are still not read as the applicant's name.
- The AI can read the same document differently between analyses, so a requirement can change status after reanalysis.

## [1.1.0] - 2026-11-15

Security fix release. A document containing instructions to the AI could make
the v1.0.0 document check fill in applicant details and complete a requirement
(INC-10). Production has run the fix since about 14:48 PHT on 15 Nov.

### Security
- The document extraction prompt (1.1.0) and a backend check prevent detected AI-directed passages in documents from supplying applicant details or completing a requirement ([#214](https://github.com/Anthonyiwnl/tsek/pull/214)).

## [1.0.0] - 2026-11-15

First tagged release: the end of Sprint 4. Citizens can sign in and create,
view, edit and delete barangay applications, upload documents, and get an AI
check of each document against the requirements, with a saved checklist. AI
runs in staging and production behind sign-in, per-user and hourly limits,
and a kill switch. Every change reaches production through reviewed pull
requests and a staged, smoke-tested pipeline, and a rollback was rehearsed.

### Added
- CI on every pull request: install, lint, build and test ([#2](https://github.com/Anthonyiwnl/tsek/pull/2)).
- TSEK homepage and the five-step service checklist ([#3](https://github.com/Anthonyiwnl/tsek/pull/3)).
- PostgreSQL document catalogue API with migrations and seed data ([#4](https://github.com/Anthonyiwnl/tsek/pull/4)).
- Required issue link on every pull request ([#43](https://github.com/Anthonyiwnl/tsek/pull/43)); exactly one closed issue per pull request ([#82](https://github.com/Anthonyiwnl/tsek/pull/82)).
- Staging environment deployed and smoke-tested before production ([#44](https://github.com/Anthonyiwnl/tsek/pull/44)).
- AI pull request review and frontend bundle audit ([#47](https://github.com/Anthonyiwnl/tsek/pull/47)).
- Application ownership schema and table relationships ([#51](https://github.com/Anthonyiwnl/tsek/pull/51)).
- Database-backed service catalogue on the deployed site ([#62](https://github.com/Anthonyiwnl/tsek/pull/62)) and the Figma dashboard design ([#61](https://github.com/Anthonyiwnl/tsek/pull/61)).
- `/health` reports the deployed commit, so smoke tests verify the exact release ([#58](https://github.com/Anthonyiwnl/tsek/pull/58)).
- Authenticated application create and read with Neon Auth ([#114](https://github.com/Anthonyiwnl/tsek/pull/114)), draft edit and delete ([#147](https://github.com/Anthonyiwnl/tsek/pull/147)), and failure-case tests ([#113](https://github.com/Anthonyiwnl/tsek/pull/113)).
- Sign-in and create ([#59](https://github.com/Anthonyiwnl/tsek/pull/59)), application list and details ([#54](https://github.com/Anthonyiwnl/tsek/pull/54)), and draft edit and delete screens ([#55](https://github.com/Anthonyiwnl/tsek/pull/55)).
- Versioned document analysis contract with a validator ([#63](https://github.com/Anthonyiwnl/tsek/pull/63)).
- Structured document extraction through the backend, with timeouts, validation and recorded prompt and schema versions ([#152](https://github.com/Anthonyiwnl/tsek/pull/152)).
- Private document uploads with type, size and per-application limits ([#153](https://github.com/Anthonyiwnl/tsek/pull/153)).
- Saved analysis results and checklist decisions from validated AI output ([#154](https://github.com/Anthonyiwnl/tsek/pull/154)).
- Upload, analysis and saved checklist screens ([#181](https://github.com/Anthonyiwnl/tsek/pull/181)); replacing a document and reanalyzing it in one step ([#182](https://github.com/Anthonyiwnl/tsek/pull/182)).
- AI routes require sign-in and share per-user and hourly quotas, with bounded retries and per-attempt logs ([#184](https://github.com/Anthonyiwnl/tsek/pull/184)). AI is on in production.
- Synthetic extraction evaluation set of 17 documents ([#155](https://github.com/Anthonyiwnl/tsek/pull/155)).
- Desktop and mobile application journey tests ([#171](https://github.com/Anthonyiwnl/tsek/pull/171)) and tests of the real Neon Auth token verifier ([#191](https://github.com/Anthonyiwnl/tsek/pull/191)).
- First 30 synthetic Barangay Clearance training examples for the fine-tuning work ([#211](https://github.com/Anthonyiwnl/tsek/pull/211)).
- Mocked AI failure tests across the analysis flow, with prompt and schema fingerprints, in their own CI step ([#156](https://github.com/Anthonyiwnl/tsek/pull/156)).
- Daily live AI smoke test against staging ([#90](https://github.com/Anthonyiwnl/tsek/pull/90)) and an AI provider failure drill ([#104](https://github.com/Anthonyiwnl/tsek/pull/104)).
- Cloud vs local model comparison harness on a synthetic document set ([#102](https://github.com/Anthonyiwnl/tsek/pull/102)), the frozen Sprint 4 evaluation baseline ([#186](https://github.com/Anthonyiwnl/tsek/pull/186)) and cloud benchmark results ([#199](https://github.com/Anthonyiwnl/tsek/pull/199)).
- Backend container image tested against PostgreSQL ([#91](https://github.com/Anthonyiwnl/tsek/pull/91)).
- Dependency audit and full-history secret scan ([#84](https://github.com/Anthonyiwnl/tsek/pull/84)); weekly Dependabot updates ([#86](https://github.com/Anthonyiwnl/tsek/pull/86)).
- Deploy and rollback runbook with a Rollback workflow ([#88](https://github.com/Anthonyiwnl/tsek/pull/88)); tag-triggered releases from this file ([#89](https://github.com/Anthonyiwnl/tsek/pull/89)).
- Hourly production uptime check with a written SLO ([#120](https://github.com/Anthonyiwnl/tsek/pull/120)).
- Claude Code GitHub Action reviewing every pull request, with `@claude fix` ([#134](https://github.com/Anthonyiwnl/tsek/pull/134), [#137](https://github.com/Anthonyiwnl/tsek/pull/137)).
- Issue templates ([#87](https://github.com/Anthonyiwnl/tsek/pull/87)), environment examples for every app ([#85](https://github.com/Anthonyiwnl/tsek/pull/85)), `PIPELINE.md` with a diagram ([#92](https://github.com/Anthonyiwnl/tsek/pull/92)), maintenance plan and Demo Day countdown ([#122](https://github.com/Anthonyiwnl/tsek/pull/122)).

### Changed
- Deploy jobs moved to their own workflow, so pull requests never list skipped checks ([#94](https://github.com/Anthonyiwnl/tsek/pull/94)).
- Deploys and smoke tests fail when hosting is not configured, instead of passing silently ([#67](https://github.com/Anthonyiwnl/tsek/pull/67)).
- Backend lint and API tests ([#81](https://github.com/Anthonyiwnl/tsek/pull/81)) and frontend unit tests ([#83](https://github.com/Anthonyiwnl/tsek/pull/83)) are required.
- One deploy-and-smoke-test job per environment (optimization 1, [#100](https://github.com/Anthonyiwnl/tsek/pull/100)).
- Smoke tests poll every 3 s (optimization 3, [#116](https://github.com/Anthonyiwnl/tsek/pull/116)).
- Each deploy rebuilds only the services whose code changed (optimization 4, [#151](https://github.com/Anthonyiwnl/tsek/pull/151)), ignoring tests and Markdown ([#167](https://github.com/Anthonyiwnl/tsek/pull/167)).
- Citizen and admin dashboards show API records instead of demo data, and routing is consolidated in `App.tsx` ([#183](https://github.com/Anthonyiwnl/tsek/pull/183)).
- Frontend and backend dependency updates ([#112](https://github.com/Anthonyiwnl/tsek/pull/112), [#123](https://github.com/Anthonyiwnl/tsek/pull/123), [#178](https://github.com/Anthonyiwnl/tsek/pull/178), [#179](https://github.com/Anthonyiwnl/tsek/pull/179), [#198](https://github.com/Anthonyiwnl/tsek/pull/198)) and GitHub Actions updates ([#175](https://github.com/Anthonyiwnl/tsek/pull/175), [#176](https://github.com/Anthonyiwnl/tsek/pull/176), [#177](https://github.com/Anthonyiwnl/tsek/pull/177)).

### Fixed
- Deploy hook secrets passed to the deploy workflow ([#96](https://github.com/Anthonyiwnl/tsek/pull/96)).
- Signed-in users stay authenticated, using the Neon session JWT ([#164](https://github.com/Anthonyiwnl/tsek/pull/164)).
- Application purpose length checked after trimming ([#148](https://github.com/Anthonyiwnl/tsek/pull/148)).
- 503 reported only for real authentication outages ([#149](https://github.com/Anthonyiwnl/tsek/pull/149)).
- HTTPS required for remote JWKS URLs ([#165](https://github.com/Anthonyiwnl/tsek/pull/165)).
- Printed PhilSys ID, electric bill and cedula titles are recognized ([#185](https://github.com/Anthonyiwnl/tsek/pull/185), [#187](https://github.com/Anthonyiwnl/tsek/pull/187)).
- A wrong password shows a sign-in failure instead of a connection error ([#203](https://github.com/Anthonyiwnl/tsek/pull/203)).

### Security
- Patched the body-parser denial-of-service advisory GHSA-27r3-jxmh-p828 ([#53](https://github.com/Anthonyiwnl/tsek/pull/53)).

### Documentation
- Sprint 1 evidence ([#68](https://github.com/Anthonyiwnl/tsek/pull/68)), Consultation 2 evidence and written retrospective ([#162](https://github.com/Anthonyiwnl/tsek/pull/162)).
- Pipeline metrics, incidents and optimization records ([#66](https://github.com/Anthonyiwnl/tsek/pull/66), [#110](https://github.com/Anthonyiwnl/tsek/pull/110), [#121](https://github.com/Anthonyiwnl/tsek/pull/121), [#146](https://github.com/Anthonyiwnl/tsek/pull/146), [#158](https://github.com/Anthonyiwnl/tsek/pull/158), [#168](https://github.com/Anthonyiwnl/tsek/pull/168)); INC-08 recovery ([#124](https://github.com/Anthonyiwnl/tsek/pull/124)).
- AI reviewer study ([#129](https://github.com/Anthonyiwnl/tsek/pull/129)) and AI switch documentation ([#160](https://github.com/Anthonyiwnl/tsek/pull/160)); AI on in production and applying migrations before merge ([#209](https://github.com/Anthonyiwnl/tsek/pull/209)).
- Rollback drill: a planned bad release ([#190](https://github.com/Anthonyiwnl/tsek/pull/190)) was stopped by staging, reverted ([#196](https://github.com/Anthonyiwnl/tsek/pull/196)) and recovered in 11 minutes; recorded as INC-09 ([#169](https://github.com/Anthonyiwnl/tsek/pull/169)).
- Sprint 4 record ([#194](https://github.com/Anthonyiwnl/tsek/pull/194)), scope changes ([#195](https://github.com/Anthonyiwnl/tsek/pull/195)) and Consultation 3 evidence ([#173](https://github.com/Anthonyiwnl/tsek/pull/173)).
- Setup guide, architecture and database schema diagrams, API reference and frontend environment template, checked with a fresh setup on an empty database ([#201](https://github.com/Anthonyiwnl/tsek/pull/201)).
