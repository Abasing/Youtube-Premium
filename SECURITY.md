# Security Policy

## Supported versions

Only the latest released version of the extension receives security fixes.

| Version | Supported |
| --- | --- |
| latest (2.0.x) | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately by opening a GitHub security advisory (Repository → Security → **Report a vulnerability**) or by emailing the maintainer through the profile page.

What helps triage quickly:

- Extension version and affected feature (e.g. `yt-download.js`, background rules).
- Chrome version and platform.
- Steps to reproduce and, if available, a minimal PoC.
- Impact description (data exposure, XSS, privilege misuse, etc.).

You will receive an acknowledgement within 3 business days. Fixes are shipped in the next release, and we'll credit you in the advisory and changelog unless you prefer to stay anonymous.

## Scope

In scope: anything in this repository that ships inside the extension.

Out of scope: issues in YouTube/Google infrastructure, or behavior that requires the user to load untrusted code into the extension.