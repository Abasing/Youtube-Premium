(() => {
  'use strict';

  const ATTR = 'data-ypm-no-pause';
  const IS_MUSIC = window.location.hostname === 'music.youtube.com';
  const POPUP_NODE = IS_MUSIC ? 'YTMUSIC-YOU-THERE-RENDERER' : 'YT-CONFIRM-DIALOG-RENDERER';
  const POPUP_CONTAINER = IS_MUSIC ? 'ytmusic-popup-container' : 'ytd-popup-container';

  const LACT_INTERVAL_MS = 10000;
  const IDLE_TIMEOUT_MS = 5000;
  const PAUSE_REQUEST_TIMEOUT_MS = 5000;

  let enabled = false;
  let lactTimer = null;
  let lastInteractionTime = Date.now();
  let videoElement = null;
  let pauseRequested = false;
  let pauseRequestedTimeout = 0;
  let appObserver = null;
  let interactionsBound = false;

  function getIdleTime() { return Date.now() - lastInteractionTime; }
  function isIdle() { return getIdleTime() >= IDLE_TIMEOUT_MS; }

  function processInteraction() {
    if (pauseRequested) {
      pauseRequested = false;
      clearTimeout(pauseRequestedTimeout);
      if (videoElement && videoElement.yns_pause) {
        videoElement.yns_pause.call(videoElement);
      }
      return;
    }
    lastInteractionTime = Date.now();
  }

  function bindInteractions() {
    if (interactionsBound) return;
    interactionsBound = true;
    const events = ['pointerdown', 'pointermove', 'keydown', 'mousedown', 'mousemove', 'touchstart'];
    for (const type of events) {
      document.addEventListener(type, processInteraction, { capture: true, passive: true });
    }
  }

  function restoreVideo(video) {
    if (video && video.yns_pause) {
      video.pause = video.yns_pause;
      video.yns_pause = null;
    }
  }

  function patchVideo(video) {
    if (!video || video.yns_pause !== undefined) return;
    try {
      video.yns_pause = video.pause.bind(video);
      video.pause = function () {
        if (!enabled) {
          if (this.yns_pause) {
            this.pause = this.yns_pause;
            this.yns_pause = null;
            this.pause.call(this);
          }
          return;
        }
        if (pauseRequested) return;
        if (!isIdle()) {
          this.yns_pause.call(this);
          return;
        }
        pauseRequested = true;
        clearTimeout(pauseRequestedTimeout);
        pauseRequestedTimeout = setTimeout(() => { pauseRequested = false; }, PAUSE_REQUEST_TIMEOUT_MS);
      };
    } catch (err) {
      restoreVideo(video);
    }
  }

  function findAndPatchVideo() {
    if (!enabled || videoElement) return;
    const video = document.querySelector('video');
    if (video) {
      videoElement = video;
      patchVideo(video);
    }
  }

  function observeApp() {
    if (appObserver) return;
    appObserver = new MutationObserver(() => findAndPatchVideo());
    appObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function guardMediaSession() {
    const ms = navigator.mediaSession;
    if (!ms || ms.__ypmGuard) return;
    ms.__ypmGuard = true;
    const orig = ms.setActionHandler.bind(ms);
    ms.setActionHandler = function (action, handler) {
      if (action === 'pause') return;
      orig(action, handler);
    };
  }

  function handlePopup(e) {
    if (!enabled) return;
    const detail = e && e.detail;
    if (!detail || detail.nodeName !== POPUP_NODE) return;
    if (!isIdle()) return;
    const container = document.querySelector(POPUP_CONTAINER);
    if (container) container.click();
    if (videoElement && videoElement.yns_pause) videoElement.yns_pause.call(videoElement);
    pauseRequested = false;
    clearTimeout(pauseRequestedTimeout);
    if (videoElement) {
      try { videoElement.play(); } catch (err) { /* ignore */ }
    }
  }

  function startLactPinger() {
    window._lact = Date.now();
    lactTimer = setInterval(() => { window._lact = Date.now(); }, LACT_INTERVAL_MS);
  }

  function stopLactPinger() {
    if (lactTimer) {
      clearInterval(lactTimer);
      lactTimer = null;
    }
  }

  function handleNavigate() {
    videoElement = null;
    clearTimeout(pauseRequestedTimeout);
    pauseRequested = false;
    if (!enabled) return;
    window._lact = Date.now();
    lastInteractionTime = Date.now();
    findAndPatchVideo();
  }

  function applyEnabled(on) {
    if (on) {
      startLactPinger();
      guardMediaSession();
      bindInteractions();
      observeApp();
      findAndPatchVideo();
      lastInteractionTime = Date.now();
    } else {
      stopLactPinger();
      if (appObserver) {
        appObserver.disconnect();
        appObserver = null;
      }
      if (videoElement) {
        restoreVideo(videoElement);
        videoElement = null;
      }
      clearTimeout(pauseRequestedTimeout);
      pauseRequested = false;
    }
  }

  document.addEventListener('yt-popup-opened', handlePopup);
  document.addEventListener('yt-navigate-finish', handleNavigate);

  const attrObserver = new MutationObserver(() => {
    const on = !!document.documentElement.hasAttribute(ATTR);
    if (on !== enabled) {
      enabled = on;
      applyEnabled(enabled);
    }
  });
  attrObserver.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });

  enabled = document.documentElement.hasAttribute(ATTR);
  if (enabled) applyEnabled(true);
})();