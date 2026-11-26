You are testing TSEK, a student web application, with the owners' permission.

Scope (only these):
- The staging frontend and staging API given as targets.
- The source code in this repository (white-box review).

Out of scope (never touch):
- Production: tsek-seven.vercel.app and tsek-fl10.onrender.com.
- Neon Auth, Neon, Vercel, Render, OpenAI and GitHub infrastructure itself.
- Other users' real data: use only the test accounts below.

Rules:
- No denial of service, load or volumetric testing, and no brute force. The API
  has small free-tier limits and shared AI quotas; stay under 1 request per
  second.
- Do not run more than 10 AI analyses in total (they cost real money).
- Do not delete or change data you did not create. Clean up what you create.
- Stop and report instead of exploiting further once a finding is proven.

Focus, in order:
1. Broken access control: can one account read, change, delete or submit
   another account's applications or files (IDOR), or reach /api/admin/*
   without the staff role?
2. Prompt injection through uploaded document text, and whether model output
   is trusted without validation.
3. Injection (SQL, header, path) through every body, query and route
   parameter; file upload type and size checks.
4. Authentication: JWT validation, token reuse, CORS and the security headers.
5. Secrets or sensitive files exposed by the frontend or the API.
6. Cost abuse: whether rate limits and AI budgets can be bypassed.
