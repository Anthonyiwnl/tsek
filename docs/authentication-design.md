# Authentication in the Queue Ticket UI

The public landing page and the Queue Ticket design from #315 and #317 remain
the visual foundation. This replaces the older sliding-panel proposal in #230.

Users can create an account from any sign-in screen or open `#/signup` directly.
`#/login` opens citizen sign-in. Switching between sign-in and registration keeps
the original protected destination, clears the password, and hides it again.
Password reset returns to `#/login`, not the staff dashboard.

Registration uses the existing Neon Auth client with name, email, and password.
Private records open only when a subsequent session lookup returns a user without
an error. Registration never assigns a staff role.

If registration returns no session, the Queue Ticket form offers email-code
verification, code resend, and a session check after following an email link.
Provider and connection failures are retryable and do not expose provider details.
Successful verification without a session returns to sign-in with guidance.
Passwords and verification codes are never written to browser storage or logs.

Automated authentication tests mock Neon and cover registration, pending states,
invalid codes, resend failures, session-check failures, and missing sessions.
Live account creation and email delivery still depend on deployment-specific Neon
configuration and must be verified separately; automated tests do not send email.

For browser acceptance, start Vite with `VITE_NEON_AUTH_URL` set to
`https://auth.example.test/auth` on port 5230. Run `node scripts/check-auth.cjs`
with `PLAYWRIGHT_PACKAGE_JSON` pointing to an external installation of Playwright.
The script uses installed Chrome and intercepts the synthetic auth host; it checks
the real Neon client calls, signup/verification at 320/390/768/1024/1440 px, code
resend, verification without a session, and navigation back to the public landing.
Screenshots and results go to the system temp directory (`tsek-auth-evidence`),
or `AUTH_EVIDENCE_DIR` when supplied. It creates no live accounts or email.
