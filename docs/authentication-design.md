# TSEK authentication design

Source: [enhanced Figma authentication screens](https://www.figma.com/design/bgAx5ULSyIA9nIEuMnEEum?node-id=2-380).

The public landing page is removed. The bare URL, `#/`, and unknown hashes open
the sign-in/session gate. A restored session still opens its authenticated
workspace. The logo returns to `#/login`, and signup includes an inline privacy
disclosure so users never need to visit the former landing page.

`#/login` and `#/signup` use one accessible form with a 550 ms sliding welcome
panel on desktop. Mobile stacks the welcome panel above the form. Reduced-motion
preferences disable transitions. Protected application, dashboard, and admin
routes still use the same session gate and preserve their original destination.

`AuthScreen.tsx` owns the layout and fields; `AuthenticatedWorkspace.tsx` calls
the existing Neon client. Sign-up submits only name, email, and password. A user
enters the workspace only after `getSession()` returns an authenticated user.
No staff role or permission is assigned by registration.

When registration returns no session, `AuthVerification.tsx` supports the
verification link or email code supplied by the configured Neon service.
Resending a code, invalid codes, network failures, and missing sessions have
explicit recovery states. Password reset remains at `#/password-setup`.
Passwords and verification codes are not written to browser storage or logs.

The Figma mock's legal placeholder is replaced with the existing privacy
explanation in a disclosure; this change does not invent Terms of Service. The actual
provider remains responsible for registration policy and verification delivery.

## Assets

`frontend/public/auth/` contains the original SVG exports from Figma, with their
intrinsic dimensions preserved. There are no runtime temporary Figma URLs.

| Local SVG | Figma layer / use |
| --- | --- |
| `brand-mark.svg` | Header mark, desktop and mobile |
| `ambient.svg` | Blue ambient light, desktop |
| `circuits.svg`, `circuit-nodes.svg` | Desktop circuit paths and endpoint dots |
| `document-check.svg` | Welcome-panel document graphic |
| `email.svg`, `lock.svg`, `person.svg`, `eye.svg` | Field and visibility icons |
| `edge-login.svg`, `edge-signup.svg` | Angled desktop panel boundary |
| `mobile-circle.svg`, `mobile-check.svg`, `mobile-edge.svg` | Mobile badge and angled boundary |

## Validation

- Run `npm run check` from the repository root.
- Authentication tests mock Neon; they do not create real accounts or send mail.
- Browser verification uses a mocked signed-out session and checks both modes
  at 1440 px and 390 px, overflow at 320/390/768/1024/1440 px, image loading,
  intermediate animation transforms, and reduced-motion behavior.
- Live email delivery and real-account registration still require verification
  on the deployed environment with its own Neon configuration.

The password-reset route comes from PR #227. This branch includes that pending
commit and depends on #227 being merged first; its own implementation commit
contains only the authentication design and registration changes.
