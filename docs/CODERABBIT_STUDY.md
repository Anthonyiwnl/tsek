# AI Reviewer Study: CodeRabbit, Greptile, Claude, and the TSEK AI Review

Status: study complete, 5 November 2026 ([#128](https://github.com/Anthonyiwnl/tsek/issues/128)).
Greptile was added the same day with a replay of #114
([#130](https://github.com/Anthonyiwnl/tsek/pull/130)), and the Claude
reviewer (#133, #136) with a second replay
([#135](https://github.com/Anthonyiwnl/tsek/pull/135)).
Outcome: the Claude reviewer reviews every pull request; CodeRabbit is kept
for requests; Greptile was removed (#131). See [Recommendation](#recommendation).

## Why

The team's CodeRabbit Advanced plan was cancelled on 2 November 2026, and we
are staying on the free plan. On that plan CodeRabbit does not review this
repository automatically (it has fewer than 10 stars) and allows about one
review per hour ([#126](https://github.com/Anthonyiwnl/tsek/issues/126),
[#127](https://github.com/Anthonyiwnl/tsek/pull/127)). We already run our own
reviewer, the **TSEK AI review** (`.github/scripts/ai-review.mjs`). This study
asks what that reviewer must do to replace CodeRabbit.

## Method

This is a black-box study, **not an REA audit**.
[`AI_REPO_CHECKS.md`](AI_REPO_CHECKS.md#rea-audit) limits REA to software we
own, so CodeRabbit was studied only through:

- everything it posted on our own pull requests
  [#114](https://github.com/Anthonyiwnl/tsek/pull/114) (12 commits, 2–3 Nov)
  and [#127](https://github.com/Anthonyiwnl/tsek/pull/127) (2 commits, 5 Nov);
- its commit statuses on those commits;
- its [public documentation](https://docs.coderabbit.ai/configuration/auto-review)
  and our [`.coderabbit.yaml`](../.coderabbit.yaml).

The TSEK AI review edits one comment in place, so its earlier results survive
only in that comment's edit history. All 12 versions on #114
([comment](https://github.com/Anthonyiwnl/tsek/pull/114#issuecomment-6578213675),
"Edited 11 times") were read, one per commit.

**Greptile** was installed on 5 November, after #114 had merged. To give it the
same test, [#130](https://github.com/Anthonyiwnl/tsek/pull/130) replays #114
into a throwaway base branch (`replay/114-base`), so it can never reach `main`.
Its head was moved through #114's own commits and stopped at CodeRabbit's three
review points: `1a365df`, `54f95f2`, and `6bccec4`. Before `6bccec4` the base was
moved to `2085139`, the `main` commit #114 had merged in, so the diff matched
#114's exactly (11 files, +366 −5). Greptile reviewed the first checkpoint on
its own when the pull request opened, and the other two after an
`@greptileai` comment.

The **Claude reviewer** (`claude-review.yml`, skill `tsek-review`, #133) was
tested on [#135](https://github.com/Anthonyiwnl/tsek/pull/135). The action runs
only when the review workflow matches `main`, so this replay's base
(`replay2/114-base`) is `main` with #114's changes removed. The head was moved
through the same three checkpoints; each step's diff matched #114's. Claude
reviewed every checkpoint on its own. After the third, an `@claude fix` comment
tested the fix loop, and an `@claude review` comment tested verifying and
resolving threads.

Each finding from every reviewer was then checked against the code at that
commit and the merged code on `main` (`745ba94`).

| Verdict | Meaning |
|---|---|
| **Real** | A real defect or gap, confirmed in the code. |
| **False positive** | Claims a problem the code does not have. |
| **Not actionable** | Asks to "confirm", "consider", or restyle. No defect. |
| **Non-finding** | Praise or "No change needed", listed as a finding. |

## Results on #114

Between them, the reviewers found **13 real issues** in #114: CodeRabbit's 6,
2 more that only Greptile found, and 5 more that only Claude found.

| | CodeRabbit | Greptile (replay #130) | Claude (replay #135) | TSEK AI review |
|---|---|---|---|---|
| Commits reviewed | 3 reviews (`1a365df`, `54f95f2`, `6bccec4`) plus 4 fix checks | The same 3 | The same 3, plus 1 re-review after its own fix | All 12 |
| Findings posted | 6 | 3 | 8 | 28 |
| **Real** | **6** | **3** | **8** | **0** |
| False positive | 0 | 0 | 0 | 13 |
| Not actionable | 0 | 0 | 0 | 5 |
| Non-finding | 0 | 0 | 0 | 10 |
| **Real issues found, of the 13** | **6** | **3** | **9** | **0** |
| Real issues only this reviewer found | 3 | 1 | 5 | 0 |
| Cost | Free; about 1 review per hour, on request | 1 credit per review | No credits; uses a Claude subscription | OpenAI (capped key) |

Claude's 9 of 13 counts one issue found inside a broader finding: its "token
verification untested" finding covers both CodeRabbit's `requireUser` tests and
Greptile's verifier tests. Its 8 posted findings are listed below.

On #127, CodeRabbit's one finding was also real: a docs line said
`@coderabbitai review` re-reviews everything, but it only reviews new commits
([r4478735350](https://github.com/Anthonyiwnl/tsek/pull/127#discussion_r4478735350),
fixed in `bdae58c`).

The sample is small (one feature PR), but the pattern is clear:

- **CodeRabbit** found the most (6 of 8) with no noise.
- **Greptile** posted nothing wrong and found **2 real issues that CodeRabbit
  missed, both still in `main`**, but it missed 5 of CodeRabbit's 6.
- **Claude** found the most (9 of 13) with no noise, including both major
  issues, one of them a checkpoint earlier than CodeRabbit. It missed 3 of
  CodeRabbit's findings (the unbounded list, the JWKS 401 case, and the untested
  `purpose` validation) and Greptile's HTTP key URL check.
- **The TSEK AI review** produced noise and missed every real issue.
- The reviewers overlap little: none found more than 9 of the 13, so a second
  reviewer on important pull requests still adds value.

### CodeRabbit's findings

| Commit | Severity | Finding | Verdict and evidence |
|---|---|---|---|
| [`1a365df`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/1a365df833af0b0d4992717b72d29234fd6fd990) | Major | `server.js` does not pass `verifyToken` or `applications` to `createApp`, so every `/api/applications` call returns 503 ([r4442931810](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4442931810)) | **Real.** Fixed in `0532b6b`. `server.js` was **not in this commit's diff**: CodeRabbit read an unchanged file. |
| `1a365df` | Minor | A non-200 JWKS response raises `ERR_JOSE_GENERIC` and returns 401 instead of 503 ([r4442931822](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4442931822)) | **Real.** Fixed in `0532b6b` with a regression test. Depends on knowing `jose` v6.2.12's behavior. |
| `1a365df` | Follow-up | The create test does not cover invalid `purpose` values ([review](https://github.com/Anthonyiwnl/tsek/pull/114#pullrequestreview-5737252089)) | **Real.** Tests added in `0532b6b`. |
| [`54f95f2`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/54f95f231cc5b9fa01d77949ed15e4718f4268cb) | Major | `NEON_AUTH_BASE_URL` is missing from the root `.env.example` and both Render guides ([r4443667501](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4443667501)) | **Real.** Fixed in `cec946f`, `8346abb`, `6bccec4`. Without the variable the routes return 503 in production. |
| [`6bccec4`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/6bccec4432cdf1a0a3d50375ed8374beee299144) | Minor | `GET /api/applications` returns every row; add a page size and a "more rows" signal ([r4444303251](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4444303251)) | **Real.** Fixed in `6664281`, `7d334f5`. |
| `6bccec4` | Follow-up | Tests miss the invalid-token and JWKS-outage branches of `requireUser` ([review](https://github.com/Anthonyiwnl/tsek/pull/114#pullrequestreview-5739029675)) | **Real.** Tests added in `2149f8c`. |

### TSEK AI review's findings

| Commit | Severity | Finding | Verdict and evidence |
|---|---|---|---|
| `1a365df` | Major | SQL injection in `applications.update` | **False positive.** The SET clause only ever contains the fixed names `document_type_id`, `purpose`, `updated_at`; values are parameters. |
| `1a365df` | Major | Missing authentication on some routes (`/api/document-types`) | **False positive.** The document catalogue is public by design. The finding itself says the application routes are protected. |
| `1a365df` | Minor | `requireUser` error handling could be more specific | Not actionable. |
| `1a365df` | Minor | Test token verifier uses hard-coded strings | Not actionable. A test mock is meant to. |
| [`0532b6b`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/0532b6b80734911b3f31c7a9ca8463dbc3bf0d7c) | Major | CORS preflight (OPTIONS) not handled | **False positive.** `app.use(cors(...))` runs before every route, and `cors` answers preflight with 204 by default. `e94b66d` only made the defaults explicit. |
| `0532b6b` | Minor | "Confirm" errors do not leak details | Not actionable. |
| [`e94b66d`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/e94b66dcfa503c0f38c0eee11670c884ac4ee508) | Major | `authenticate` not applied to all application routes | **False positive.** All three routes use it (`app.js` lines 98, 114, 139 on `main`). |
| `e94b66d` | Minor | Request body does not reject unknown keys | **False positive.** It does (`app.js` line 118). |
| `e94b66d` | Minor | JOSE error handling "may be too broad" | Not actionable. The 503 mapping was CodeRabbit's own fix. |
| `54f95f2`, `1ae0cbc` | — | "No problems found" | **Missed** the `NEON_AUTH_BASE_URL` documentation gap on `54f95f2`. |
| [`cec946f`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/cec946f412e23327682406aab586d78379b5011f) | Major, minor | 2 rows ending "No change needed" | Non-findings. |
| [`8346abb`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/8346abbb99e725192ed863abc08bb5b418732f6c) | 6 major, 1 minor | 7 rows of praise, such as "SQL query uses parameterized queries", each ending "No change needed" | Non-findings, labeled **major**, and the risk rose to medium. |
| `6bccec4`, `6664281` | — | "No problems found" | **Missed** the unbounded list and the missing auth-branch tests on `6bccec4`. |
| [`7d334f5`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/7d334f599bb4decd598569c5fd8ce2c8c1d16b75) | Major | Missing try-catch around async database calls | **False positive.** Express 5.3.0 passes rejected async handlers to the error middleware, which returns a generic 500 with a request ID (`app.js` lines 180–203). Tests added in `6ab81cc` prove it. |
| `7d334f5` | Minor | Sanitize `purpose` before storing | **False positive.** Stored with a parameterized query; React escapes it on display. |
| [`2149f8c`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/2149f8ca2a8dd81cafc8f87bdd86702e9ce44627) | Minor | Same database error handling claim | **False positive.** Repeated after the author's explanation. |
| `2149f8c` | Minor | List asks for `limit + 1` rows, over the 100 cap | **False positive.** The extra row is the look-ahead that detects more rows, as CodeRabbit recommended. Users still cannot request over 100. |
| [`6ab81cc`](https://github.com/Anthonyiwnl/tsek/pull/114/commits/6ab81cce5c37652378c411dc69e0428653b5ffb9) | Major | Missing error handling for async routes | **False positive.** Third repeat; the regression tests were in this commit. |
| `6ab81cc` | Major | Errors may leak internal details | **False positive.** The handler returns only `INTERNAL_ERROR`, a fixed message, and the request ID. |
| `6ab81cc` | Minor | `Authorization` header is case-sensitive | **False positive.** `req.get('authorization')` is case-insensitive (`auth.js` line 57). |
| `6ab81cc` | Minor | Token expiry is not checked | **False positive.** `jose`'s `jwtVerify` rejects expired tokens, and `exp` must be a number (`auth.js` lines 43–49). |
| `6ab81cc` | Minor | `OFFSET` uses parameter arithmetic | Not actionable. |
| `6ab81cc` | Minor | Body validation allows unknown keys | Non-finding. Its own text says "This is correct". |

### Greptile's findings (replay #130)

| Checkpoint | Finding | Verdict and evidence |
|---|---|---|
| `1a365df` | Application routes always return 503: `server.js` passes neither `verifyToken` nor `applications`, and the tests hide it because they supply both ([r4479085903](https://github.com/Anthonyiwnl/tsek/pull/130#discussion_r4479085903)) | **Real.** Same as CodeRabbit's major finding, also found in a file outside the diff. |
| `1a365df` | Key URL can use HTTP: the localhost exception for `NEON_AUTH_JWKS_URL` checks the host of `NEON_AUTH_BASE_URL`, not the host it fetches keys from ([r4479085913](https://github.com/Anthonyiwnl/tsek/pull/130#discussion_r4479085913)) | **Real, missed by CodeRabbit, still in `main`.** `auth.js` line 15 sets `local` from the base URL, and line 33 uses it for the key URL. With a localhost base, `http://remote.example/keys` is accepted. Low risk in production, where the base URL is HTTPS. |
| `1a365df` | The tests replace the whole token verifier, so `createTokenVerifier`'s checks (signature, issuer, expiry, subject) never run ([r4479085940](https://github.com/Anthonyiwnl/tsek/pull/130#discussion_r4479085940)) | **Real, missed by CodeRabbit, still in `main`.** No file in `backend/test/` calls `createTokenVerifier` or `createNeonTokenVerifier`. |
| `54f95f2` | No new findings; dropped the 503 finding because `0532b6b` fixed it | Correct about the fix. **Missed** the `NEON_AUTH_BASE_URL` documentation gap, although its own diagram shows the routes returning 503 when the variable is unset. |
| `6bccec4` | No new findings; "The previously reported startup wiring problem is fixed" | **Missed** the unbounded list and the untested `requireUser` failure branches. |

Greptile also missed CodeRabbit's two other `1a365df` findings: a JWKS outage
returning 401 instead of 503, and the untested `purpose` validation. Each
Greptile review took about 3 minutes and used 1 review credit.

### Claude's findings (replay #135)

| Checkpoint | Finding | Verdict and evidence |
|---|---|---|
| `1a365df` | **Major**, outside the diff: `server.js` passes neither `applications` nor `verifyToken`, so every request returns 503 ([summary](https://github.com/Anthonyiwnl/tsek/pull/135#issuecomment-6661857753)) | **Real.** Same as CodeRabbit and Greptile. |
| `1a365df` | **Major**, outside the diff: `NEON_AUTH_BASE_URL` is missing from `backend/.env.example` and the root `.env.example`, so the API fails once wired | **Real.** CodeRabbit's major docs finding, one checkpoint earlier (CodeRabbit raised it at `54f95f2`). At `54f95f2` Claude kept only the `NEON_AUTH_JWKS_URL` part and dropped the root `.env.example` part, which was still missing. |
| `1a365df` | Minor: tests stub the verifier, so `createTokenVerifier`, `createNeonTokenVerifier`, and `requireUser`'s 401 and 503 paths are untested ([r4482361620](https://github.com/Anthonyiwnl/tsek/pull/135#discussion_r4482361620)) | **Real.** Covers CodeRabbit's `requireUser` tests and Greptile's verifier tests. Still in `main`: #141. |
| `1a365df` | Minor: `purpose` length is checked before trimming, so a padded 200-character purpose is rejected although the stored value fits `CHECK (length(purpose) <= 200)` ([r4482357908](https://github.com/Anthonyiwnl/tsek/pull/135#discussion_r4482357908)) | **Real, found only by Claude.** Still in `main` (`app.js` lines 122, 130): #138. |
| `1a365df` | Minor: every `TypeError` is reported as "auth unavailable" (503) ([r4482361181](https://github.com/Anthonyiwnl/tsek/pull/135#discussion_r4482361181)) | **Real, found only by Claude.** Still in `main` (`auth.js` line 71): #139. |
| `1a365df` | Minor, outside the diff: `update` and `deleteDraft` are unused and untested | **Real, found only by Claude.** Removed from #114 as out of scope. |
| `54f95f2` | Minor, outside the diff: optional `NEON_AUTH_JWKS_URL` is undocumented | **Real, found only by Claude.** |
| `54f95f2` | Minor, outside the diff: with `NEON_AUTH_BASE_URL` unset the API starts and silently returns 503 | **Real, found only by Claude.** Production behaved this way before the Render variable was set (4–5 Nov). |

**Incremental reviews.** At `54f95f2` and `6bccec4` Claude reviewed only the new
commits (about 1 minute each, against 12½ minutes for the first review),
recorded that `server.js` was fixed, and kept the three open findings open
with a note on why.

**Fix loop.** `@claude fix` pushed [`377edee`](https://github.com/Anthonyiwnl/tsek/commit/377edee650f1645a364378472317d133faf87506)
in about a minute: the trim fix, a narrowed 503 branch, 89 lines of verifier
and route tests, the `NEON_AUTH_JWKS_URL` docs, and a startup warning (94
backend tests passing). `@claude review` then verified all three fixes,
replied "Verified fixed in `377edee`" in each thread, and resolved them. The
test also exposed four workflow defects (bot comments starting runs, the bot's
own push not reviewed, a second summary comment, no thread replies from the
fix), fixed in #136.

## What CodeRabbit does

Each behavior below was observed on #114 or #127.

1. **Reads beyond the diff.** It found the bug in `server.js`, a file the
   commit did not change, and applied `jose` v6.2.12's documented error codes.
   On #127 its review shows the commands it ran (`nl`, `rg`, `fd`) and the web
   searches it made before commenting
   ([r4478735350](https://github.com/Anthonyiwnl/tsek/pull/127#discussion_r4478735350)).
2. **Inline threads on the exact line**, each labeled with severity, category,
   and effort ("Major · Functional Correctness · Quick win"). Because `main`
   requires resolved conversations, its findings must be answered before
   merging.
3. **Follow-up comments** in the review body for gaps outside the changed
   lines, such as missing tests, with a link to the lines
   ([review](https://github.com/Anthonyiwnl/tsek/pull/114#pullrequestreview-5739029675)).
4. **Uses our rules.** It cited `.coderabbit.yaml`'s test-file instruction
   ("The test-file guidance asks that invalid requests be covered").
5. **Checks fixes.** When the author replies, it checks the new code, says what
   it verified ("I did not run the tests"), and resolves the thread
   ([r4453077013](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4453077013)).
   It keeps a thread open when the repository cannot prove the fix, such as a
   Render setting
   ([r4443904589](https://github.com/Anthonyiwnl/tsek/pull/114#discussion_r4443904589)).
6. **Reports no praise as findings**, and reports nothing when nothing is wrong.
7. **Incremental and full review.** `@coderabbitai review` covers commits since
   the last review; `@coderabbitai full review` re-reads everything.
8. **Ignores commands from bots.** A `@coderabbitai review` comment from
   `github-actions[bot]` was ignored twice on #127 (09:15 and 09:18 UTC); the
   same comment from a person's token started a review at 09:27.
9. **Free-plan limits.** "This repository does not receive automatic reviews
   because it has fewer than 10 stars", and "Your plan provides up to 1
   included review per hour"
   ([review](https://github.com/Anthonyiwnl/tsek/pull/127#pullrequestreview-5782619459)).
   A second request at 09:32 got "Review limit reached".
10. **Commit status** named `CodeRabbit`: "Review skipped: manual review
    required", "Review in progress", "Review completed", or "Review rate
    limited". All count as success, so it never blocks a merge.
11. **Extras.** It adds a "Summary by CodeRabbit" to the pull request
    description and a walkthrough with merge risk and security risk.

## Gap analysis

| Capability | CodeRabbit | TSEK AI review today | Why it matters (from #114) |
|---|---|---|---|
| Context | Whole repository, dependencies, tools | The diff only (`git diff`, 60,000 characters) | Explains some failures, not all. Outside the diff: the `server.js` wiring and the `NEON_AUTH_BASE_URL` docs gap (2 of the 6 misses), and the Express 5 version behind the repeated error-handling false positive. |
| Evidence | Points to the exact line and explains the effect | Free-text claims | Other failures happened on code the model **did** receive: at `e94b66d` the diff contained all three uses of `authenticate` and the unknown-key check it called missing, and the unbounded list it missed was in the added code. More context alone will not fix these. |
| No praise | Yes | Praise rows labeled major | 10 of 28 rows were "No change needed". |
| Memory | Remembers its threads and the author's replies | Starts fresh on every push | The same false positive was posted three times after it was answered. |
| Where findings go | Inline threads that must be resolved | One summary table | Findings are easy to ignore. Real findings should block until answered. |
| Project rules | `.coderabbit.yaml` `path_instructions` | Rules written into the prompt | Two copies of the rules drift apart. |
| Fix checks | Verifies and resolves | None | |
| Cost and limits | Free, about 1 review per hour, requested by a person | OpenAI cost (spend-capped key), every push | |

## Recommendation

Decided on 5 November 2026:

1. **The Claude reviewer reviews every pull request** (#133, #136). It found
   the most real issues with no noise, works like CodeRabbit (summary, inline
   findings, incremental review, fix verification), and costs no credits.
2. **CodeRabbit stays for requests** (`@coderabbitai review`) on important
   pull requests. It found 3 issues Claude missed.
3. **Greptile was removed** (#131): good precision, but 1 credit per review,
   and it found the fewest issues.
4. **The four real issues still in `main` are filed:** #138, #139, #140, #141.
5. **The TSEK AI review keeps its automatic checks** (secrets, frontend calls).
   Its AI findings stay advisory until the plan below meets its targets.

## Replacement plan

Written before the Claude reviewer existed. It is no longer needed to replace
CodeRabbit, but it remains the plan for improving the TSEK AI review itself.
Ranked by how much each step addresses the #114 results. Each step is one issue
and one pull request.

1. **Give the model context.** Send the full text of each changed file, the
   files that import or are imported by them, and the versions of key
   dependencies from the lockfiles. *Targets:* the `server.js` miss, and the
   Express 5, `cors`, and `jose` false positives.
2. **Require evidence and drop non-findings.** Add `evidence` (an exact quote
   of the code) and `confidence` to the review schema. Discard a finding when
   its quote is not in the file, when its fix says "no change", or when it only
   asks to "confirm" or "consider". Tell the model to report only defects.
   *Targets:* the false positives on code the model received, such as
   `authenticate` and the unknown-key check at `e94b66d`. If they persist, the
   model itself is the limit; step 6 tests a stronger one.
3. **Post inline review threads.** Post major and critical findings as a GitHub
   review with comments on the lines, so the "conversations resolved" rule
   applies. Keep minor ones in the summary.
4. **Add memory.** Store the last reviewed commit and the answered findings in
   the comment's hidden marker. Review only new commits, and do not repeat a
   finding that a person answered.
5. **Read the rules from one place.** Load `path_instructions` from
   `.coderabbit.yaml` instead of the prompt.
6. **Measure before switching.** Replay #114 through each version, the way
   #130 replayed it for Greptile. Target: at least 4 of the 8 real issues
   found, at most 2 false positives in total, and no non-findings. Try `gpt-4.1` against `gpt-4.1-mini` and
   record the cost per review. Log the results in the
   [optimization log](OPTIMIZATION_LOG.MD).
7. **Then decide on CodeRabbit.** When the targets are met, stop requesting
   CodeRabbit reviews on every pull request and keep it for an occasional
   manual second opinion.

Until step 6 passes, the TSEK AI review's AI findings stay advisory.

## Limits of this study

- One feature pull request and one small CI pull request. The verdicts show a
  pattern; they are not a statistically sound accuracy figure.
- CodeRabbit and Greptile reviewed only 3 of #114's 12 commits. The TSEK AI
  review reviewed all 12, so it had more chances to produce false positives.
- Greptile saw a replay, not the live pull request: it had no author replies
  to react to, and its first review ran just after the repository was
  connected. Treat its result as one run, not its settled accuracy.
- "The 13 real issues" are only those that some reviewer found. Issues that
  every reviewer missed are not counted.
- **The Claude reviewer had an advantage.** Its instructions (`AGENTS.md` and
  the `tsek-review` skill) were written after this study of #114 and include
  lessons from it, such as reading files outside the diff and the Express 5
  error-handling note. Its score shows what our configured reviewer does, not
  a neutral comparison of the products.
- **Claude's findings were judged with Claude Code.** The verdicts above cite
  the code, but a teammate should check them, not only another Claude
  session.
- The verdicts were made by one reviewer (with Claude Code) against the code.
  A teammate should check them during review of this document.
- CodeRabbit's internals, prompts, and models are unknown. Only its visible
  output was studied.
