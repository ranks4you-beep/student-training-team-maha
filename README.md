# Student Training — Team Workspace

[Open the website](https://ranks4you-beep.github.io/student-training-team-maha/)

The complete bilingual English/Arabic interface is served by GitHub Pages. The address stays on `github.io` for login, the dashboard, account management, assignments, calendars and document tracking. There is no external page redirect.

## Team access

The reserved leader account is activated through a private, single-use setup link. Its owner chooses the password privately. Public registration is closed; the leader creates team accounts, chooses roles, disables accounts and resets passwords under **Accounts & permissions**. Email verification is disabled.

Every signed-in role sees the same shared assignments, instructions and linked events. Updates refresh every 15 seconds while the page is open and no form is being edited. Administrators manage accounts and approvals. Coordinators manage events, assignments and unapproved documents. Members update task status; viewers have read access.

## Hosting and security

GitHub Pages serves the actual interface from `docs/`. A separate Worker with D1 provides secure login and shared storage. The public API origin is configured in `scripts/pages-runtime.js`; no server secrets or user records are embedded in the site.

The GitHub interface uses bearer sessions kept in per-tab browser session storage, avoiding third-party cookies. API requests require an active server session and matching CSRF token for changes. Only the configured frontend origin receives cross-origin API access. Roles are checked by the server. Passwords use salted native scrypt (N=32768, r=8, p=3); the database stores session hashes. Sessions expire after eight hours or one idle hour and are invalidated by password, role or email changes or deactivation.

Production runtime settings are `OWNER_PLATFORM_EMAIL`, `ADMIN_EMAIL`, `FRONTEND_ORIGIN`, and `ADMIN_SETUP_TOKEN_HASH`. The setup hash authorizes only initial activation; the database prevents a second activation. Keep the activation link, private environment values, account data and database files out of Git. The backend's original same-origin HttpOnly-cookie interface remains available for operational use.

## Build

- `npm run build:pages` regenerates `docs/` from `training-ui/` and the GitHub session adapter. It requires Node.js and no installed dependencies.
- GitHub Pages publishes from the `main` branch and `/docs` directory.
- `npm ci` and `npm run dev` run the backend development environment.
- `node scripts/embed-training-assets.mjs` rebuilds the backend's bundled same-origin interface.
- Change `db/schema.ts` and run `npm run db:generate` to append schema migrations.

The portable backend manifest intentionally omits the live Site identifier. No private Git history, production credentials, account records or database files are published here.

Document tracking records manually supplied file links and approval state. File uploads and automatic OneDrive synchronization are not implemented. A leader resets team passwords; email password recovery is not configured.
