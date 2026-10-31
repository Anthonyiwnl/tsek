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

### Added
- CI on every pull request: install, lint, build and test ([#2](https://github.com/Anthonyiwnl/tsek/pull/2)).
- TSEK homepage, citizen and administrator demo portals, and the five-step service checklist ([#3](https://github.com/Anthonyiwnl/tsek/pull/3)).
- PostgreSQL document catalogue API with migrations and seed data ([#4](https://github.com/Anthonyiwnl/tsek/pull/4)).
- Required issue link on every pull request ([#43](https://github.com/Anthonyiwnl/tsek/pull/43)).
- Staging environment deployed and smoke-tested before production ([#44](https://github.com/Anthonyiwnl/tsek/pull/44)).
- AI pull request review and frontend bundle audit ([#47](https://github.com/Anthonyiwnl/tsek/pull/47)).
- Application ownership schema and table relationships ([#51](https://github.com/Anthonyiwnl/tsek/pull/51)).

### Security
- Patched the body-parser denial-of-service advisory GHSA-27r3-jxmh-p828 ([#53](https://github.com/Anthonyiwnl/tsek/pull/53)).
