# Changelog

All notable changes to this project are documented here.

## [2.0.4] - 2026-09-16

### Added
- `yt-download.js` — native-styled **Download** button next to the Share button on watch pages with a per-quality selector (MP4 progressive or video-only, plus audio-only) and File System Access API saving (blob fallback).

## [2.0.3] - 2026-09-16

### Added
- `premium-benefits.js` — injects a "Premium benefits" row into the YouTube avatar dropdown (`ytd-multi-page-menu-renderer`), placed after the first native link.

## [2.0.2] - 2026-09-16

### Changed
- Popup switches rebuilt to YouTube-style pills (40×22, red glow when on).
- 3-dot overflow menu on the Block Ads card hosts ad-leak notices and auto-update rule toggles.
- Card grid columns stabilized with `minmax(0, 1fr)`.

## [2.0.0] - 2026-09-16

### Changed
- Popup redesigned as a two-column card grid: title top, description middle, switch bottom-center.
- Removed the Advanced collapsible card in favor of per-feature cards.
- Drop-down for extended ad options.
- Removed debug/version markers from the footer.

### Notes
- 2.0.1 was internal (popup caching verification) and produced no released changes.