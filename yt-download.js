(() => {
  'use strict';

  const BTN_ID = 'yt-premium-download-btn';
  const STYLE_ID = 'yt-premium-download-style';
  const MENU_ID = 'yt-premium-download-menu';
  const TOAST_ID = 'yt-premium-download-toast';

  const DOWNLOAD_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" focusable="false" aria-hidden="true">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
  `;

  const CSS = `
    #${MENU_ID} {
      position: fixed;
      z-index: 2200;
      min-width: 180px;
      background: #232323;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 6px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
      font-family: "Roboto", "Arial", sans-serif;
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
      transform-origin: top right;
      pointer-events: none;
      transition: opacity 150ms ease, transform 150ms ease;
    }
    #${MENU_ID}.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    #${MENU_ID} .yt-download-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #f1f1f1;
      font-size: 13px;
      line-height: 18px;
      text-align: left;
      cursor: pointer;
    }
    #${MENU_ID} .yt-download-menu-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    #${MENU_ID} .yt-download-menu-item:disabled {
      opacity: 0.5;
      cursor: default;
    }
    #${MENU_ID} .yt-download-menu-item small {
      color: #aaa;
      font-size: 11px;
    }
    #${MENU_ID} .yt-download-menu-divider {
      height: 1px;
      margin: 4px 8px;
      background: rgba(255, 255, 255, 0.1);
    }
    #${TOAST_ID} {
      position: fixed;
      left: 50%;
      bottom: 40px;
      z-index: 2300;
      transform: translateX(-50%);
      padding: 8px 14px;
      border-radius: 20px;
      background: #232323;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f1f1f1;
      font-family: "Roboto", "Arial", sans-serif;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease, transform 180ms ease;
    }
    #${TOAST_ID}.show {
      opacity: 1;
      transform: translateX(-50%) translateY(-4px);
    }
  `;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  let toastTimer;

  function showToast(message, ms) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms || 2200);
  }

  function currentVideoId() {
    return new URLSearchParams(location.search).get('v');
  }

  function getInitialPlayerResponse() {
    try {
      const pr = window.ytInitialPlayerResponse;
      if (pr && pr.playerResponse) return pr.playerResponse;
      if (pr && pr.videoDetails && pr.streamingData) return pr;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function fetchFreshPlayer(videoId) {
    let cfg = null;
    try {
      if (window.ytcfg && window.ytcfg.data_) cfg = window.ytcfg.data_;
    } catch (e) {
      /* ignore */
    }
    if (!cfg || !cfg.INNERTUBE_API_KEY || !cfg.INNERTUBE_CONTEXT) return Promise.resolve(null);
    return fetch('/youtubei/v1/player?key=' + encodeURIComponent(cfg.INNERTUBE_API_KEY), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: cfg.INNERTUBE_CONTEXT, videoId }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }

  function formatHeight(format) {
    const match = /(\d{2,4})p/.exec(format.qualityLabel || '');
    return match ? parseInt(match[1], 10) : 0;
  }

  function isMp4(format) {
    return /mp4/i.test((format.mimeType || '') + ' ' + (format.container || ''));
  }

  function formatExt(format) {
    const mime = format.mimeType || '';
    if (/mp4/i.test(mime)) return format.qualityLabel ? '.mp4' : '.m4a';
    if (/webm/i.test(mime)) return '.webm';
    if (/opus/i.test(mime)) return '.opus';
    return '.mp4';
  }

  function buildMenuItems(player) {
    const videoId = currentVideoId();
    const title = (player.videoDetails && player.videoDetails.title) || 'video';
    const safe = (title.replace(/[/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || videoId || 'video');
    const streaming = player.streamingData || {};
    const items = [];

    const usable = (f) => !!f.url && !!f.itag;
    const progressiveSrc = ((streaming.formats || []).filter(usable).filter(isMp4)).sort((a, b) => formatHeight(b) - formatHeight(a));
    const videoOnlySrc = ((streaming.adaptiveFormats || []).filter(usable).filter(isMp4).filter((f) => f.qualityLabel && !f.audioChannelCount)).sort((a, b) => formatHeight(b) - formatHeight(a));
    const audioSrc = (streaming.adaptiveFormats || []).filter(usable).filter((f) => !f.qualityLabel)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    const sources = progressiveSrc.length ? progressiveSrc : videoOnlySrc;
    sources.slice(0, 4).forEach((format, index) => {
      const label = format.qualityLabel || '';
      items.push({
        label: label + (progressiveSrc.length ? ' (MP4)' : ' video'),
        detail: format.hasAudio && format.hasVideo ? 'Avail' : '',
        url: format.url,
        filename: safe + formatExt(format),
        legacy: index === 0 && !progressiveSrc.length,
      });
    });

    if (audioSrc) {
      if (items.length) items.push({ divider: true });
      items.push({
        label: 'Audio only',
        url: audioSrc.url,
        filename: safe + formatExt(audioSrc),
      });
    }

    return items;
  }

  function closeMenu() {
    const menu = document.getElementById(MENU_ID);
    if (menu) menu.classList.remove('open');
    document.removeEventListener('click', closeMenu, true);
    document.removeEventListener('keydown', onMenuKeydown, true);
  }

  function onMenuKeydown(e) {
    if (e.key === 'Escape') closeMenu();
  }

  function openMenu(button) {
    const items = buildMenuItems(getInitialPlayerResponse());
    if (!items.length) {
      showToast('No download formats available');
      return;
    }

    let menu = document.getElementById(MENU_ID);
    if (!menu) {
      menu = document.createElement('div');
      menu.id = MENU_ID;
      document.body.appendChild(menu);
    }
    menu.textContent = '';
    items.forEach((item) => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'yt-download-menu-divider';
        menu.appendChild(divider);
        return;
      }
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'yt-download-menu-item';
      option.textContent = item.label;
      option.addEventListener('click', () => {
        closeMenu();
        void startDownload(item);
      });
      menu.appendChild(option);
    });

    const rect = button.getBoundingClientRect();
    const probe = menu.offsetWidth;
    const width = probe || 180;
    const height = menu.offsetHeight || items.length * 36 + 12;
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', closeMenu, true);
      document.addEventListener('keydown', onMenuKeydown, true);
    }, 0);
  }

  async function startDownload(item) {
    showToast('Downloading…', 60000);
    try {
      const response = await fetch(item.url, { method: 'GET', credentials: 'include' });
      if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);

      const wantExtFile = item.filename.includes('.');
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: wantExtFile ? item.filename : item.filename + '.mp4' });
        const writable = await handle.createWritable();
        await response.body.pipeTo(writable);
        closeToast();
        showToast('Downloaded');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      closeToast();
      showToast('Downloaded');
    } catch (err) {
      closeToast();
      showToast('Download failed');
    }
  }

  function closeToast() {
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.classList.remove('show');
    clearTimeout(toastTimer);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;

    const actionsContainer = document.querySelector('#top-level-buttons-computed, ytd-watch-metadata #actions #actions-inner #top-level-buttons-computed');
    if (!actionsContainer) return;

    let shareButton = null;
    for (const child of actionsContainer.children) {
      if (child.textContent && child.textContent.includes('Share')) {
        shareButton = child;
        break;
      }
    }
    if (!shareButton) return;

    const downloadButton = shareButton.cloneNode(true);
    downloadButton.id = BTN_ID;
    downloadButton.setAttribute('aria-label', 'Download');
    downloadButton.title = 'Download';

    const text = downloadButton.querySelector('.yt-spec-button-shape-next__button-text-content');
    if (text) text.textContent = 'Download';

    const tooltip = downloadButton.querySelector('tp-yt-paper-tooltip');
    if (tooltip) tooltip.textContent = 'Download';

    const icon = downloadButton.querySelector('.yt-spec-button-shape-next__icon');
    if (icon) icon.innerHTML = DOWNLOAD_ICON_SVG;

    downloadButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const videoId = currentVideoId();
      if (!videoId) {
        showToast('No video found');
        return;
      }
      let player = getInitialPlayerResponse();
      if (!player) {
        showToast('Loading video…', 60000);
        fetchFreshPlayer(videoId).then((fresh) => {
          closeToast();
          if (fresh && fresh.streamingData && fresh.videoDetails) openMenu(downloadButton);
          else showToast('Download unavailable');
        });
        return;
      }
      openMenu(downloadButton);
    });

    shareButton.insertAdjacentElement('afterend', downloadButton);
  }

  let scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectButton();
    });
  }

  const observer = new MutationObserver(() => scheduleInject());
  let bailed = false;
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    bailed = true;
  }

  ensureStyles();
  injectButton();
  if (bailed) scheduleInject();

  document.addEventListener('yt-navigate-finish', scheduleInject);
})();