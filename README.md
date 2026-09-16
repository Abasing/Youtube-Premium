# YouTube Premium

A Manifest V3 Chrome extension for YouTube that restyles the page with an all-black Premium look, blocks ads, and layers on quality-of-life tools — pause-popup suppression, loop controls, return dislike counts, video tags, volume boost beyond 100%, a downloads shortcut next to Share, and direct video downloads.

## Features

| Feature | What it does |
| --- | --- |
| **Premium dark theme** | Replaces the YouTube logo with the black "Premium" badge (visual only). |
| **Ad blocking** | Blocks video, short, and surfacing ads via `declarativeNetRequest` filters, cosmetic CSS, and scriptlet rules. |
| **Block pause popup** | Stops the "Video paused. Continue watching?" overlay from interrupting playback. |
| **Loop controls** | Repeat-button / A-B loop controls on the player. |
| **Return dislikes** | Restores the dislike count that YouTube removed from the UI. |
| **Video tags** | Shows a video's tag links under the description. |
| **Volume boost** | Pushes volume past 100% (up to 600%). |
| **Download button** | Native-styled "Download" button next to Share on watch pages; per-quality selector (MP4 / audio-only) using File System Access API with an in-memory blob fallback. |
| **Premium benefits** | Injects a "Premium benefits" entry into the YouTube avatar dropdown. |

## Installation (unpacked / developer mode)

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder containing `manifest.json`.

## Usage

Click the extension icon to open the popup and toggle:

- **Block Ads** — master switch for ad blocking (sub options: ad-leak notices, auto-update rules).
- **Disable pause popup** — suppress the pause overlay.
- **Loop controls**, **Show dislikes**, **Video tags**, **Volume boost** — independent feature switches.

All settings persist locally; feature toggles apply after a page refresh.

## Project structure

```
youtube-premium/
├── manifest.json          # MV3 manifest, permissions, content scripts, DNR rules
├── background.js          # Service worker: settings, ads rules, ad-leak detection
├── contentscript.js       # Early (document_start) bootstrap
├── content.js             # Logo swap (document_idle)
├── antipause.js           # Pause-popup suppression (MAIN world)
├── pause-coordinator.js   # Coordinates pause-suppression
├── yt-loop.js|.css        # Loop controls
├── ryd-lite.js            # Return disliked counter (+ yt-likes.css)
├── video-tags.js          # Video tag links (+ yt-tags.css)
├── volume-boost.js        # >100% volume (+ yt-boost.css)
├── yt-download.js         # Download button next to Share
├── premium-benefits.js    # Avatar-dropdown "Premium benefits" row
├── popup.html|popup.js    # Settings popup UI
├── fonts/                 # Bundled web fonts
└── images/                # Extension icons
```

## Permissions

The extension requests the minimum needed to work:

- `storage` / `unlimitedStorage` — persist settings and ad-rule state.
- `tabs` / `scripting` — content-script injection and tab operations.
- `declarativeNetRequest` / `webRequest` — block ad network requests.
- `alarms`, `webNavigation` — support features and page tracking.
- `<all_urls>` host access — needed for media stream consumption (downloader) and ad-rule coverage across YouTube/CDN hosts.

## Development

No build step is required to test the extension — it is a plain MV3 extension.

- `background.js` and the bundle-style sources are prebuilt; edit the loose feature scripts (`yt-*.js`, `popup.js`, etc.) directly and reload from `chrome://extensions`.
- Bump `manifest.json` `version` and the footer marker (`popup.html`) when shipping changes.

## Disclaimer

This project is for **personal, educational use**. It is not affiliated with, endorsed by, or sponsored by YouTube or Google. Blocking ads may violate YouTube's Terms of Service; use at your own discretion. The extension does not alter your YouTube account, does not claim to provide Premium, and downloads apply only where permitted by applicable law.

## License

[MIT](LICENSE) © Zamin Bhutto