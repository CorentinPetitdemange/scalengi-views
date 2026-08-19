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

Scalengi Views runs locally in the browser. Excel, YAML, and IndexedDB inputs are considered untrusted. No business file may be sent to a server without an explicit product decision.
