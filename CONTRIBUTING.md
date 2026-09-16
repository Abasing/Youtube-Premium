# Contributing

Thanks for taking the time to contribute!

## Getting started

1. Fork the repository.
2. Clone your fork and keep it in sync with `main`.
3. Create a feature branch: `git checkout -b feat/my-change`.

## Code conventions

- Feature scripts live in their own `yt-*.js` file and are registered in `manifest.json` `content_scripts`.
- Feature styles use a matching `yt-*.css` file loaded alongside the script.
- Keep files free of build steps; the extension loads unpacked from source.
- No comments unless they explain non-obvious behavior.
- Retest in Chrome (`chrome://extensions` → Load unpacked) before opening a PR.

## Commit message style

- Short, imperative summary line: `Add rebound volume boost`, `Fix popup switch geometry on narrow widths`.
- Reference issues where relevant.

## Pull requests

- Describe what changed and why.
- Attach a short manual-test checklist.
- Bump `manifest.json` `version` and the footer marker in `popup.html` only when the change is user-visible.

## Reporting issues

Use the issue tracker. Include your Chrome version, the extension version, and steps to reproduce.
For security-related reports, see [SECURITY.md](SECURITY.md).