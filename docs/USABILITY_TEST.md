# Usability test: "Get a barangay clearance" (#248)

A short moderated test with 3–5 people, to check that someone new to
TSEK can prepare a barangay clearance application without help.

> **Status, 27 Nov 2026: planned, not run.** The sessions did not take place
> before the code freeze. See [Status](#status-sessions-not-run) and the expert
> walkthrough that was done instead.

- **Prototype:** [Final · 10 Prototype](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=22-3072)
  (Figma, presentation mode). The redesign has since merged, so the
  staging app shows the same flow. Use the prototype unless the issue
  reviewer agrees to use staging.
- **Moderator:** Anthony Saltat. **Note-taker:** any teammate (optional).
- **Time per person:** about 15 minutes.

## No personal data

- Participants are recorded only as **P1–P5**. Do not write down names,
  student numbers, ages, contact details or photos of faces.
- Do not record audio or video. Take written notes only.
- Participants never type their own details. The prototype uses sample
  data, and on staging they use the sample documents in
  `backend/test/fixtures/document-evaluation-v1/samples/`.

Read this before starting:

> "We're testing the app, not you. There are no wrong answers. Please
> think out loud as you go. I can't help during the tasks, but you can
> stop at any time. I won't record your name or anything about you."

## Scenario

> "You need a barangay clearance for a job application. Before going to
> the barangay hall, you want to check that you have the right
> documents."

## Tasks

Give one task at a time. Don't use the words on the buttons when you
describe a task.

| # | Task (say this) | Success means | Screens |
|---|---|---|---|
| 1 | "Find out what you need for a barangay clearance." | Names the two required documents (government ID, proof of residency) and that the cedula is optional | Landing |
| 2 | "Start preparing your application." | Signs in and creates a Barangay Clearance draft with a purpose | Sign-in, new application |
| 3 | "Add your ID and check it." | Uploads the ID and finds what TSEK read from it | Ticket draft, documents panel |
| 4 | "Are you ready to go to the barangay hall? What's missing?" | Says proof of residency is still missing, from the checklist | Checklist, tracker |
| 5 | "Submit the application, then check its status." | Submits, then finds the "Awaiting review" status | Submitted ticket, My applications |

## What to note for each task

- **Result:** done without help, done with a hint, or not done.
- **Time:** rough minutes.
- **Where they hesitated** or clicked the wrong thing, and what they
  said while thinking out loud.
- **Ease:** after each task, ask "How easy was that, from 1 (very hard)
  to 7 (very easy)?"

After the last task, ask:

1. "What was most confusing?"
2. "What would you change first?"
3. "Would you use this before going to the barangay hall? Why or why
   not?"

## Status: sessions not run

The sessions with participants were **not run** before the 27 Nov 2026 code
freeze, so there are no participant results, ease scores or quotes. The plan
above is unchanged and can be run as written after the course.

## What was done instead: expert walkthrough (27 Nov 2026)

**This is not a usability test with users.** Anthony, with an AI assistant
(Claude), walked through the five tasks above on the live production site
(`11cda17`) as a citizen, using sample documents. A walkthrough finds problems
an expert can see; it cannot show how first-time users would actually do.

| # | Task | What the walkthrough found | Issue |
|---|---|---|---|
| 1 | Find requirements | The landing page lists the requirements per service. **Start this ticket** does not carry the chosen service into New application, so it must be picked again. | [#356](https://github.com/Anthonyiwnl/tsek/issues/356) |
| 2 | Start an application | The draft is created. **Save application** stays greyed out with no explanation of what is missing. | [#355](https://github.com/Anthonyiwnl/tsek/issues/355) |
| 3 | Add your ID and check it | Upload and check work (about 4 s). A PhilSys-style ID with split name fields comes back as "Full name: Not readable", so the ID stays incomplete. | [#351](https://github.com/Anthonyiwnl/tsek/issues/351) |
| 4 | What's missing? | The checklist answers it, but before any upload every requirement shows an orange "uncertain" warning, and the tracker stays on "TSEK check: Waiting" after analysis. | [#354](https://github.com/Anthonyiwnl/tsek/issues/354) |
| 5 | Submit and check status | Not submitted, to keep test data out of the staff queue. An existing submitted application is read-only as expected. Submitting with no requirement matched gives no warning. | [#358](https://github.com/Anthonyiwnl/tsek/issues/358) |

### Findings

| # | What happened | Severity |
|---|---|---|
| 1 | The ID's full name is not read, so a realistic Barangay Clearance cannot reach 100% | high |
| 2 | Statuses look alarming or contradict each other (uncertain before upload, tracker stuck) | medium |
| 3 | An application can be submitted with no requirement matched, without a warning | medium |
| 4 | The service chosen on the landing page is not carried into the application | low |
| 5 | Save is disabled without saying what is missing | low |

### Changes

Under the code freeze none of these are built in this project. They are
recorded as future work: [#351](https://github.com/Anthonyiwnl/tsek/issues/351)
(Axel), [#354](https://github.com/Anthonyiwnl/tsek/issues/354) (Francis) and
[#358](https://github.com/Anthonyiwnl/tsek/issues/358) (Francis).

### Demo slide

One slide: the usability test was planned but not run before the freeze; an
expert walkthrough of the five tasks found 5 problems, the most serious being
that the ID's full name is not read (#351).
