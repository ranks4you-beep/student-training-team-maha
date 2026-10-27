# Student Training — Team Workspace

[Open the live workspace](https://student-training-team-maha.happybread18743.chatgpt.site)

Bilingual English/Arabic team platform with administrator-managed accounts, shared assignments, event scheduling, document approvals, and role permissions.

Hosted version of the approved bilingual Student Training application. Records are shared in Cloudflare D1. Browser local storage is used only for the interface language.

## Administration

The hosting owner signs in through the platform's **Continue as site owner** link to activate the single reserved administrator email. The owner chooses the administrator password privately. After activation, public signup is disabled. Administrators create team accounts under **Accounts & permissions**, choose a role, disable accounts and reset passwords. No email verification or mail sender is configured.

The public URL serves a login page. Workspace APIs require an active app session; mutations require a matching CSRF token and server-authorized role. Passwords use salted native scrypt (N=32768, r=8, p=3). Sessions are stored as SHA-256 hashes, expire after eight hours or one idle hour, and are invalidated by role/password/email changes or account deactivation. Every authenticated role sees the same events, task instructions and assignments. Changes refresh automatically every 15 seconds while an untouched page is open.

Runtime settings `OWNER_PLATFORM_EMAIL` and `ADMIN_EMAIL` are configured through Sites as secrets. The starter's local mock identity is for loopback development only. Hosted ownership checks use identity headers injected by Sites dispatch. Do not expose the Worker separately from Sites dispatch.

## Development

- `npm run dev` starts the portable Vinext preview.
- `node scripts/embed-training-assets.mjs` embeds the authored HTML/CSS/JS from `training-ui/` for the server routes.
- `npm run db:generate` appends schema migrations after changing `db/schema.ts`.
- Follow the installed Sites skill to build, apply local migrations, package and publish.
- Local QA data and hosted records are separate. The original local SQLite database was not imported.

Document tracking stores manually supplied file links and approval state; it does not upload files or synchronize OneDrive. There is no email password recovery; a leader resets team passwords. Keep the hosting owner's access for administrator setup and operational recovery.


## GitHub publication

This repository contains the application source. Enable GitHub Pages from the `main` branch and `/docs` directory to obtain a `github.io` entry URL. That entry opens the working hosted application. Accounts, passwords and shared records are processed by the hosted Worker and D1 database; GitHub Pages serves the entry page only.

The public source contains no live database, account records, private environment settings, source-access credentials, or private Git history. Configure a new deployment's `OWNER_PLATFORM_EMAIL` and `ADMIN_EMAIL` privately. The portable `.openai/hosting.json` intentionally omits the original Site identifier.
