# Security Policy

## Supported versions

Until a stable release is published, only the latest version of the `main` branch receives security fixes.

## Reporting a vulnerability

Do not publish vulnerabilities in a public issue. Use **Report a vulnerability** in the GitHub repository's Security tab to open a private security advisory.

Ideally, a report should include:

- the affected version or commit;
- minimal reproduction steps;
- the estimated impact;
- a proposed fix, when available.

Receipt will be acknowledged as soon as possible. The vulnerability and its fix will remain private until a coordinated disclosure is possible.

## Current scope

Scalengi Views keeps view structures and imported business data in the browser. Excel, YAML, and IndexedDB inputs are considered untrusted. No business file is sent to the authentication service.

Accounts and sessions are handled by the Rust service documented in [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md). Production deployments must use HTTPS, enable secure cookies, keep the authentication database on a restricted persistent volume, and route `/api` on the same origin as the application.

CodeQL analyzes the Rust and JavaScript/TypeScript sources with the extended security query suite on pull requests, `main`, and a weekly schedule. Dependabot monitors npm, GitHub Actions, the Rust authentication service, and the Tauri shell dependencies.
