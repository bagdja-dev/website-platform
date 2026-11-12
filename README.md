# Bagdja Website Platform

Standalone portal for designer applicants, approved template designers, and Bagdja reviewers. It is separate from the seller-facing Website Admin/Studio.

## Current slice

- Bagdja SSO authorization-code flow with PKCE and one-time OAuth state.
- Server-side access checks through Website API: only owner/admin members of the platform OAuth client's owner organization are super admins.
- Persisted designer/reviewer memberships, email-matched invitations, manual access requests, and an audit log are managed by Website API.
- Designer access requests are submitted from the portal after Bagdja login; the API takes the applicant email and user ID from the authenticated account, never from form input.
- Applicants can revisit `/apply` to see the latest onboarding stage or final decision; rejected applicants can submit a new request.
- Designer onboarding is persisted through application, profile curation, discussion invitation, discussion, and final decision stages. Internal notes, PIC assignment, discussion topics, and each stage change are audited.
- Applicants only enter a restricted discussion workspace after the discussion invitation; it does not grant designer/reviewer membership. Discussions use Bagdja Chat Service and are removed from the applicant's access when the request is approved or rejected.
- The discussion invitation never grants designer access. Approving a request creates a separate time-limited designer access invitation and emails its one-time link to the applicant.
- Direct designer/reviewer access invitations are created from a popup and emailed through Website API Messaging Service. Invitees can register a Bagdja account using the invited email before accepting the invite link. If email delivery fails, the portal shows a manual-copy link.
- Platform roles and every admin action are checked by Website API; client-side role state is not trusted.
- Designers publish a package version to npm, then submit that exact package name and version with a GitHub repository URL and optional live demo URL. During quick review, a reviewer fetches the exact npm tarball, verifies its npm integrity and package contract, validates the SSR bundle in the isolated runtime, and stores the immutable candidate in runtime staging without making it available to websites.
- Reviewers then inspect the npm package, repository, demo, and staged candidate. A reviewer can approve only after successful staging; a separate release action promotes the staged digest to the live runtime registry and activates the catalogue entry. Candidate intake and final release are separately audited.
- Requesting revisions creates a Bagdja Chat channel, posts the review note as the opening message, and adds the conversation to Inbox for the designer and reviewer.

## Local setup

1. Register an OAuth client application in Bagdja Auth and configure its exact callback URI:
   `http://localhost:5006/auth/callback`
2. Set `CLIENT_APP_ID` and `CLIENT_APP_SECRET` to that registered client, `BAGDJA_AUTH_URL` to the Auth API, and `BAGDJA_LOGIN_URL` to the SSO login frontend. The default SSO frontend is `https://login.bagdja.com`.
3. Set `BAGDJA_APP_URL` to the local portal URL.
4. Configure `BAGDJA_WEBSITE_API_URL` (or `NEXT_PUBLIC_API_URL`) to point to Website API. Set `NEXT_PUBLIC_EVENT_API` to the Event Service URL used by the inbox WebSocket: `http://localhost:4085` locally or `https://event.bagdja.com` in production. This is the Event Service host, not the Chat Service host; Chat Service publishes message events to Event Service. Apply the Website Platform access migrations there and set `WEBSITE_PLATFORM_OAUTH_CLIENT_ID` in the API to this portal's registered OAuth client ID. Configure `WEBSITE_PLATFORM_APP_URL`, `CHAT_SERVICE_URL`, and `WEBSITE_PLATFORM_REVIEW_EMAIL`. Apply the email-template migration in Bagdja Messaging Service using the same `app_id` as the Website API's `CLIENT_APP_ID`.
5. Install dependencies and run the app:

   ```sh
   npm install
   npm run dev
   ```

6. In production, configure both Upstash Redis REST variables. OAuth state is single-use; the in-memory state store is available only outside production.

`CLIENT_APP_ID` identifies the portal OAuth application and `CLIENT_APP_SECRET` is used only for the OAuth code exchange. The API independently loads that application's owner organization from Bagdja Auth and checks the authenticated user's active organization role for each privileged operation.

The API migrations are prepared at `../bagdja-website-api/supabase/migrations/20261110000001_website_platform_access.sql`, `../bagdja-website-api/supabase/migrations/20261110000002_website_platform_access_request_applicant.sql`, `../bagdja-website-api/supabase/migrations/20261110000003_website_platform_access_request_workflow.sql`, `../bagdja-website-api/supabase/migrations/20261111000001_website_platform_access_discussion.sql`, `../bagdja-website-api/supabase/migrations/20261111000002_website_platform_template_submissions.sql`, `../bagdja-website-api/supabase/migrations/20261112000001_template_submission_github_and_discussion.sql`, `../bagdja-website-api/supabase/migrations/20261112000002_template_publication_pipeline.sql`, and `../bagdja-website-api/supabase/migrations/20261112000003_template_publication_staging.sql`. Apply them to the intended Website API database before enabling these flows. The Messaging Service migration `../../../core/bagdja-messaging-service/supabase/migrations/20261111000001_seed_website_platform_access_emails.sql` seeds receipt, review, discussion, approval, and rejection templates; confirm its `app_id` matches the Website API credentials. The Messaging Service must have an active email channel for that app ID. The existing designer invitation template must support `website-platform-invitee-email`, `inviter-name`, `platform-name`, `role`, `accept-link`, and `expires-at`. Only the matching authenticated Bagdja email can accept a designer invitation.

## Validation

```sh
npm test
npm run typecheck
npm run lint
```

Template submissions require all Website Platform template-submission migrations, including `20261112000003_template_publication_staging.sql`. Configure the Website API's private runtime and publisher URLs/tokens before using quick intake or final release.
