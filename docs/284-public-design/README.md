# #284: Final 02 public screens

The landing page, sign-in page, and sign-in error state follow the existing **Final 02** Figma design at a 1440px desktop viewport. This is task evidence for that implementation, not a new product brief or design system.

Source: [Final 02 public design](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-372). The desktop reference PNGs were exported through the Figma UI because the connector was connected to a different account.

| Reference export | State |
| --- | --- |
| [final-02-landing.png](final-02-landing.png) | Landing page |
| [final-02-sign-in.png](final-02-sign-in.png) | Sign-in page |
| [final-02-sign-in-error.png](final-02-sign-in-error.png) | Sign-in error |

Implementation lives in `frontend/src/App.tsx`, `AuthenticatedWorkspace.tsx`, `PublicTicket.tsx`, and `PublicPages.css`, with a contrast fix in `index.css`. Existing `Button`, `Brand`, and `Icon` components and semantic color tokens are reused. Public layout styles implement the reference composition while retaining the incumbent component and token vocabulary. Authentication logic and tests are unchanged.

## Deliberate differences and behavior

- The existing password-reset link remains available although the mockup omits it.
- Sign-in inputs start empty; mock personal data is not prefilled.
- Icons use the existing shared icon set.
- Success and warning content on dark surfaces uses accessible background-specific tokens.
- The example ticket is static and illustrative, not an actual user record.
- FAQs use native `details` elements, with the first two initially open. Answers for the last two closed items were authored consistently with the design's privacy and AI explanations.

## Verification

- Desktop design review at 1440px: ship recommendation.
- Browser axe checks: zero violations across landing, sign-in, and sign-in error, including color contrast.
- Keyboard FAQ interaction, navigation, and password-reset checks passed.
- `npm run check` passed.
- Local Lighthouse CI passed its existing assertions for both configured URLs. Landing: performance 87, accessibility 100, best practices 100, color contrast passed. Sign-in: performance 95, accessibility 100, best practices 100, color contrast passed. The build has no live auth configuration; the separate browser checks use mocked auth to cover the form and error state.
- Live authentication and deployment are not claimed; teammate review and CI remain required before merge.
