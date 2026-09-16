(() => {
  'use strict';

  const MARKER = 'data-premium-benefits';
  const STYLE_ID = 'ytp-premium-row-style';

  const PREMIUM_ICON_SVG = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="white"></rect>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#paint0_linear_6125_21625_yt1162)"></rect>
      <path d="M12.7593 13.0229H9.9834V11.5654H12.7593C13.2427 11.5654 13.6333 11.4873 13.9312 11.3311C14.229 11.1748 14.4463 10.96 14.583 10.6865C14.7246 10.4082 14.7954 10.0908 14.7954 9.73438C14.7954 9.39746 14.7246 9.08252 14.583 8.78955C14.4463 8.4917 14.229 8.25244 13.9312 8.07178C13.6333 7.89111 13.2427 7.80078 12.7593 7.80078H10.5474V17H8.70898V6.33594H12.7593C13.5845 6.33594 14.2852 6.48242 14.8613 6.77539C15.4424 7.06348 15.8843 7.46387 16.187 7.97656C16.4897 8.48438 16.6411 9.06543 16.6411 9.71973C16.6411 10.4082 16.4897 10.999 16.187 11.4922C15.8843 11.9854 15.4424 12.3638 14.8613 12.6274C14.2852 12.8911 13.5845 13.0229 12.7593 13.0229Z" fill="white"></path>
      <defs>
        <linearGradient id="paint0_linear_6125_21625_yt1162" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0.3" stop-color="#E1002D"></stop>
          <stop offset="0.9" stop-color="#E01378"></stop>
        </linearGradient>
      </defs>
    </svg>
  `;

  const ROW_CSS = `
    .ytp-premium-row {
      display: flex !important;
      align-items: center !important;
      box-sizing: border-box !important;
      min-height: 40px !important;
      margin: 0 -12px !important;
      padding: 0 48px 0 28px !important;
      width: auto !important;
      cursor: pointer !important;
      text-decoration: none !important;
      font-family: "Roboto", "Arial", sans-serif !important;
      background: transparent;
    }
    .ytp-premium-row:hover,
    .ytp-premium-row:focus-visible {
      background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, .1)) !important;
      outline: none !important;
    }
    html:not([dark]) .ytp-premium-row:hover,
    html:not([dark]) .ytp-premium-row:focus-visible {
      background-color: var(--yt-spec-10-percent-layer, rgba(0, 0, 0, .05)) !important;
    }
    .ytp-premium-row .ytp-premium-icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex: 0 0 24px !important;
      width: 24px !important;
      height: 24px !important;
      min-width: 24px !important;
      min-height: 24px !important;
      margin-right: 16px !important;
    }
    .ytp-premium-row .ytp-premium-icon svg {
      width: 24px !important;
      height: 24px !important;
      min-width: 24px !important;
      min-height: 24px !important;
      display: block !important;
    }
    .ytp-premium-row .ytp-premium-label {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      color: var(--yt-spec-text-primary, #f1f1f1) !important;
      font-size: 1.4rem !important;
      font-weight: 400 !important;
      line-height: 2rem !important;
    }
    html:not([dark]) .ytp-premium-row .ytp-premium-label {
      color: var(--yt-spec-text-primary, #0f0f0f) !important;
    }
  `;

  function ensureRowStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ROW_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function createPremiumBenefitsRow() {
    const row = document.createElement('a');
    row.className = 'ytp-premium-row';
    row.href = '/premium_benefits';
    row.setAttribute('role', 'link');
    row.setAttribute(MARKER, '1');

    const icon = document.createElement('div');
    icon.className = 'ytp-premium-icon';
    icon.innerHTML = PREMIUM_ICON_SVG;

    const label = document.createElement('div');
    label.className = 'ytp-premium-label';
    label.textContent = 'Premium benefits';

    row.appendChild(icon);
    row.appendChild(label);
    return row;
  }

  function injectIntoMenu(menu) {
    if (!(menu instanceof Element)) return false;
    if (menu.querySelector(`[${MARKER}]`)) return true;

    const sections = menu.querySelectorAll('yt-multi-page-menu-section-renderer');
    if (sections.length < 2) return false;

    const items = sections[1].querySelector('#items');
    const nativeItem = items && items.querySelector('ytd-compact-link-renderer');
    if (!nativeItem) return false;

    items.insertBefore(createPremiumBenefitsRow(), nativeItem.nextSibling);
    return true;
  }

  function tryInject(menu) {
    if (injectIntoMenu(menu)) return;
    setTimeout(() => injectIntoMenu(menu), 50);
    setTimeout(() => injectIntoMenu(menu), 250);
    setTimeout(() => injectIntoMenu(menu), 800);
  }

  function scanForMenus(scope) {
    if (scope instanceof Element) {
      if (scope.matches('ytd-multi-page-menu-renderer')) {
        tryInject(scope);
        return;
      }
      if (scope.querySelectorAll) {
        scope.querySelectorAll('ytd-multi-page-menu-renderer').forEach(tryInject);
      }
    }
  }

  const menuObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList') continue;
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) scanForMenus(node);
      }
    }
  });

  menuObserver.observe(document.documentElement, { childList: true, subtree: true });

  ensureRowStyles();
  scanForMenus(document);

  document.addEventListener('DOMContentLoaded', () => scanForMenus(document), { once: true });
  window.addEventListener('load', () => scanForMenus(document), { once: true });
})();