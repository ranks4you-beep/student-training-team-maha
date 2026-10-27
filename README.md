# Student Training — Team Workspace

Bilingual (English/Arabic) workspace for student training events, shared tasks and team coordination.

- **Website:** https://ranks4you-beep.github.io/student-training-team-maha/ (GitHub Pages, built into `docs/`)
- **Account server:** https://student-training-team-maha.student-training.workers.dev (Cloudflare Workers + D1). It answers only `/api/` requests; every other address redirects to the website.

## Administration

The administrator account (`ADMIN_EMAIL` in `wrangler.jsonc`) is activated once, through a private setup link of the form `login.html#setup=<token>`. The server stores only the SHA-256 digest of that token, as the `ADMIN_SETUP_TOKEN_HASH` secret, and refuses a second activation. The browser removes the token from the address bar and sends it only to the API as a header. Never add the link or token to source, logs or documentation.

After activation, public signup stays closed. The administrator creates team accounts under **Accounts & permissions**, chooses roles, disables accounts and resets passwords. There is no email verification or email password recovery.

## Security

Passwords use salted scrypt (N=32768, r=8, p=3). The website uses bearer sessions stored per browser tab, so no third-party cookies are needed. Sessions are stored as SHA-256 hashes, expire after eight hours or one idle hour, and are invalidated by role/password/email changes or account deactivation. Writes require a CSRF token and a server-authorized role. Cross-origin requests are accepted only from `FRONTEND_ORIGIN`. Every signed-in role sees the same events, task instructions and assignments, and open pages refresh every 15 seconds.

## Development and deployment

- `npm run dev` starts a local preview. Copy `.env.example` to `.dev.vars` for local settings.
- `npm run build:pages` regenerates `docs/` from `training-ui/` and `scripts/pages-runtime.js`. Commit and push to publish the website.
- `npm run deploy` builds and deploys the account server (requires `npx wrangler login`).
- `npm run db:generate` creates a migration after changing `db/schema.ts`; `npm run db:migrate` applies migrations to the production database.

Document tracking stores manually supplied file links and approval state; it does not upload files.
