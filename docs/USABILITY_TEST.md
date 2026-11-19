# Usability test: "Get a barangay clearance" (#248)

A short moderated test with 3–5 people, to check that someone new to
TSEK can prepare a barangay clearance application without help.

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

## Results

_Fill in after the sessions._

| Participant | Date | Task 1 | Task 2 | Task 3 | Task 4 | Task 5 |
|---|---|---|---|---|---|---|
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |
| P4 | | | | | | |
| P5 | | | | | | |

Each cell: result / ease (1–7), for example "done / 6" or "hint / 3".

### Findings

| # | What happened | How many participants | Severity (high / medium / low) |
|---|---|---|---|
| 1 | | | |

### Changes (1–3)

| Change | Owner | Issue |
|---|---|---|
| | | |

### Demo slide

One slide: participants (count only), task success rate, the top
finding, and the change it led to.
