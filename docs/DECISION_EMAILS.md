# Decision emails (post-freeze draft)

Emails are off by default. Citizens can opt in or out under Email preferences.
The API accepts recipients only from a verified JWT issued by the configured
Neon Auth branch (`email_verified: true`); it never trusts a client-supplied
address. Verify those claims on staging before enabling this feature. Sessions
without a verified email can disable emails but cannot enable them. Existing
accounts are not silently opted in.

Migrate with the owner connection, then provision the app role as usual. Reviews
atomically queue at most one email. A background worker sends after the decision
commits. Provider failures cannot roll back decisions. Retries use the review ID
as the provider idempotency key; attempts expire after 23 hours (inside Resend's
24-hour idempotency window) and stop after three tries. Failed attempts wait
5 minutes, then 10 minutes before retrying, allowing other ready messages to run.
Failed or capped email
delivery does not change the application's status. The account must still be
opted in at send time. Logs contain an event code only.

The email contains the TSK reference, decision, staff note and HTTPS application
link. It never queries or attaches files, analyses, names, addresses or ID fields.
Staff must not copy personal document details into the note.

Configure EMAIL_ENABLED, EMAIL_API_KEY, EMAIL_FROM, EMAIL_APPLICATION_ORIGIN and
EMAIL_DAILY_LIMIT from backend/.env.example. Anthony must create distinct
send-only provider keys and verified sender domains for staging and production,
set the provider's own spending/sending caps, and test with synthetic accounts.
The database cap (default 20 attempts/day UTC, maximum 100) includes retries and
is shared across processes. Keep staging recipients restricted at the provider.
No real email is sent by automated tests or this PR's validation.

Provider contract: [Resend send email API](https://resend.com/docs/api-reference/emails/send-email).
