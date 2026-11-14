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

## [1.0.0] - 2026-11-08

First tagged release: the end of Sprint 4. Citizens can sign in and create,
view, edit and delete barangay applications. The backend accepts private
document uploads and checks them with AI against the requirements (switched
on in staging only). Every change reaches production through reviewed pull
requests and a staged, smoke-tested pipeline.

### Added
- CI on every pull request: install, lint, build and test ([#2](https://github.com/Anthonyiwnl/tsek/pull/2)).
- TSEK homepage, citizen and administrator demo portals, and the five-step service checklist ([#3](https://github.com/Anthonyiwnl/tsek/pull/3)).
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
- Synthetic extraction evaluation set of 17 documents ([#155](https://github.com/Anthonyiwnl/tsek/pull/155)).
- Mocked AI failure tests across the analysis flow, with prompt and schema fingerprints, in their own CI step ([#156](https://github.com/Anthonyiwnl/tsek/pull/156)).
- Daily live AI smoke test against staging ([#90](https://github.com/Anthonyiwnl/tsek/pull/90)) and an AI provider failure drill ([#104](https://github.com/Anthonyiwnl/tsek/pull/104)).
- Cloud vs local model comparison harness on a synthetic document set ([#102](https://github.com/Anthonyiwnl/tsek/pull/102)).
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
- Frontend and backend dependency updates ([#112](https://github.com/Anthonyiwnl/tsek/pull/112), [#123](https://github.com/Anthonyiwnl/tsek/pull/123)).

### Fixed
- Deploy hook secrets passed to the deploy workflow ([#96](https://github.com/Anthonyiwnl/tsek/pull/96)).
- Signed-in users stay authenticated, using the Neon session JWT ([#164](https://github.com/Anthonyiwnl/tsek/pull/164)).
- Application purpose length checked after trimming ([#148](https://github.com/Anthonyiwnl/tsek/pull/148)).
- 503 reported only for real authentication outages ([#149](https://github.com/Anthonyiwnl/tsek/pull/149)).
- HTTPS required for remote JWKS URLs ([#165](https://github.com/Anthonyiwnl/tsek/pull/165)).

### Security
- Patched the body-parser denial-of-service advisory GHSA-27r3-jxmh-p828 ([#53](https://github.com/Anthonyiwnl/tsek/pull/53)).

### Documentation
- Sprint 1 evidence ([#68](https://github.com/Anthonyiwnl/tsek/pull/68)), Consultation 2 evidence and written retrospective ([#162](https://github.com/Anthonyiwnl/tsek/pull/162)).
- Pipeline metrics, incidents and optimization records ([#66](https://github.com/Anthonyiwnl/tsek/pull/66), [#110](https://github.com/Anthonyiwnl/tsek/pull/110), [#121](https://github.com/Anthonyiwnl/tsek/pull/121), [#146](https://github.com/Anthonyiwnl/tsek/pull/146), [#158](https://github.com/Anthonyiwnl/tsek/pull/158), [#168](https://github.com/Anthonyiwnl/tsek/pull/168)); INC-08 recovery ([#124](https://github.com/Anthonyiwnl/tsek/pull/124)).
- AI reviewer study ([#129](https://github.com/Anthonyiwnl/tsek/pull/129)) and AI switch documentation ([#160](https://github.com/Anthonyiwnl/tsek/pull/160)).
