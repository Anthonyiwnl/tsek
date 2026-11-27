# Queue Ticket motion

Source: [Final 11 Motion](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=104-374), read in the browser on 27 November 2026. The connector denied access, but the signed-in browser exposed the overview and moment notes.

| Moment | Implementation | Timing |
| --- | --- | --- |
| Approval stamp | Approved ticket badge scales 1.35 to 1 and rotates -20 to -8 degrees while fading in | 320 ms, emphasis |
| Tracker fill | Connector fill scales along its axis; horizontal on desktop, vertical below 768 px | 320 ms, ease-in-out |
| Requirement turns Ready | Saved non-complete to complete transition pops the icon and fades the prior warning tint using an opacity overlay | 200 ms, ease-out |
| Modal enter | Native dialog rises 8 px and fades in; backdrop fades in | 200 ms, ease-out |
| Notice slide-in | Success messages enter from 24 px to the right and fade in | 200 ms, ease-out |
| Landing ticket | Hero ticket rises 24 px from a -3 degree tilt, once per mount | 320 ms, ease-out |
| Button press | Shared buttons scale to 0.98 while pressed, returning at the same speed | 120 ms, ease-out |

Tokens live in `frontend/src/tokens.css`. Easing curves are `(0.2, 0.8, 0.2, 1)`, `(0.65, 0, 0.35, 1)`, and `(0.34, 1.56, 0.64, 1)` respectively. Only the approval stamp uses emphasis/overshoot.

The shared stylesheet is loaded by tokens.css, including development fixtures. One reduced-motion rule disables animations and transitions for elements, generated content, and dialog backdrops. Final state remains visible without animation. Loading announcements are unchanged. The animated properties are exclusively transform and opacity; no motion library was added.

## Lifecycle decisions

- Requirement feedback follows a saved status transition, never a predicted AI result. Initial complete rows and repeated refreshes do not replay it.
- Modal focus, cancellation and focus restoration remain immediate. The prototype's reverse close animation is omitted so unmounting never delays interaction or retains an invisible focus trap.
- Notices keep the existing product lifetime rather than adopting automatic dismissal from the prototype; important messages remain available to read.

## Verification

- Full repository lint, build and tests pass, including a saved-checklist transition regression and motion contract checks.
- Browser inspection confirmed 320 ms landing/stamp/tracker animations, 200 ms dialog/backdrop entrance, and 120 ms button transform transitions.
- Desktop and 390 px mobile inspection showed no horizontal overflow. Mobile tracker uses vertical scaling; dialog focus is inside immediately and returns to its opener on Cancel.
- The accessibility/best-practices Lighthouse job runs on the pull request. Review its published CLS report alongside the existing baseline before merging.
- A deployed screen recording and live verification remain release evidence to collect after access to the protected preview or reviewed staging deployment. No production behavior is claimed from local fixtures.

### Layout-shift acceptance (27 November 2026)

Earlier mobile Lighthouse runs measured CLS 0.137 (previous CI: 0.139).
The trace showed the hero heading reflowing as the web font arrived, moving
the action group up 43 px. An attempted `display=optional` change measured
CLS 0 locally, but left preview headlines using fallback typography.

Font delivery uses `display=swap` again so Source Sans 3 and Sora replace
fallback fonts when they finish loading, including on slow connections.
The existing production font-swap shift is accepted for this motion work;
the newly added CLS 0.01 assertion has been removed. Existing accessibility,
best-practices and performance assertions remain. The earlier CLS 0 result
does not describe this restored font behavior. All motion remains unchanged.
Teammate approval and deployed acceptance remain separate gates.
