# #247 — responsive implementation, first pass

Started from `origin/main` at `e2d2404` after #283, #288 and #315 merged.

Implemented the breakpoint rules observed in Figma Final 09 Tablet: desktop
starts at 1200px, citizen ticket content uses one column below that width,
and tablet staff review retains a 360px decision panel. Below 768px, the
ticket tracker becomes vertical, requirements stack their badges below the
text, and the staff queue uses its existing card layout.

## Local evidence

Screenshots use the existing development fixtures and synthetic records;
they are not live account or deployment evidence. The staff fixture now
loads the same tokens and fonts as the application.

| Width | Ticket | Overview | Staff review |
| --- | --- | --- | --- |
| 390 | [Screenshot](ticket-390.png) | [Screenshot](overview-390.png) | [Screenshot](staff-390.png) |
| 768 | [Screenshot](ticket-768.png) | [Screenshot](overview-768.png) | [Screenshot](staff-768.png) |
| 1024 | [Screenshot](ticket-1024.png) | [Screenshot](overview-1024.png) | [Screenshot](staff-1024.png) |

`measurements.json` records headless Chrome measurements for these nine
views. All have document scroll width equal to viewport width and no visible
button, link, input or select target smaller than 40px. Checkbox measurements
use their associated clickable label. These measurements cover only the
rendered fixture states, not every possible application state.

Reproduce the views with `npm run dev --prefix frontend`:

- `/tests/fixtures/ticket-preview.html`
- `/tests/fixtures/ticket-preview.html?list`
- `/tests/fixtures/staff-preview.html` → Open application

## Remaining before review

- Compact mobile navigation and the remaining Final 08/09 layout details.
- Public landing/sign-in, staff queue, populated documents, dialogs, and
  loading/error-state responsive verification.
- Wider desktop regression check and complete acceptance evidence in a PR.
- Live staging/production verification after the normal review/deploy process.

Figma's connector denied design-context access. The desktop file was used
to inspect the reference pages and breakpoint rules; exact design matching
has not been certified. The design detector reported only the pre-existing
overview attention border, which this pass preserves.
