(function () {
  'use strict';

  // State management
  const state = {
    isLooping: false,
    isABLooping: false,
    pointA: null,
    pointB: null,
    lastVideoId: null,
    notificationTimer: null
  };

  const ENABLED_KEY = 'loopControlsEnabled';
  let isEnabled = false;

  // Utility: Format time as MM:SS or HH:MM:SS
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get current video element
  function getVideo() {
    return document.querySelector('video.html5-main-video');
  }

  // Get video ID from URL
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Check if chrome.storage is available
  function isStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  // When the extension is reloaded, old content scripts keep running but their
  // chrome.* context dies ("Extension context invalidated"). Reload the page so
  // a fresh script is injected instead of failing silently.
  function contextIsValid() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return false;
    try {
      return !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  function reloadIfInvalidated() {
    if (!contextIsValid()) {
      window.location.reload();
      return true;
    }
    return false;
  }

  function safeStorageCall(fn) {
    try {
      return fn();
    } catch (e) {
      if (reloadIfInvalidated()) return null;
      console.warn('YTLoop: Storage failed', e);
      return null;
    }
  }

  // Save loop state to storage
  function saveState() {
    const videoId = getVideoId();
    if (!videoId || !isStorageAvailable()) return;
    if (!contextIsValid()) {
      reloadIfInvalidated();
      return;
    }

    safeStorageCall(() => {
      chrome.storage.local.set({
        [videoId]: {
          isLooping: state.isLooping,
          isABLooping: state.isABLooping,
          pointA: state.pointA,
          pointB: state.pointB
        }
      });
    });
  }

  // Load loop state from storage
  function loadState(callback) {
    const videoId = getVideoId();
    if (!videoId || !isStorageAvailable()) {
      if (callback) callback();
      return;
    }
    if (!contextIsValid()) {
      reloadIfInvalidated();
      return;
    }

    const requested = safeStorageCall(() =>
      chrome.storage.local.get([videoId], (result) => {
        if (!contextIsValid()) {
          if (callback) callback();
          return;
        }
        if (chrome.runtime.lastError) {
          console.warn('YTLoop: Storage error', chrome.runtime.lastError);
          if (callback) callback();
          return;
        }

        if (result && result[videoId]) {
          const saved = result[videoId];
          state.isLooping = saved.isLooping || false;
          state.isABLooping = saved.isABLooping || false;
          state.pointA = saved.pointA ?? null;
          state.pointB = saved.pointB ?? null;

          const video = getVideo();
          if (video) {
            video.loop = state.isLooping;
          }
        }
        if (callback) callback();
      })
    );

    if (requested === null && callback) callback();
  }

  // Remove all existing YTLoop elements from DOM
  function cleanup() {
    document.querySelectorAll('#ytloop-controls, #ytloop-markers, #ytloop-notification')
      .forEach(el => el.remove());
  }

  // Check if controls already exist in the DOM
  function controlsExist() {
    return document.getElementById('ytloop-controls') !== null;
  }

  // Create the loop controls UI
  function createControls() {
    if (controlsExist()) return;

    const controlsContainer = document.querySelector('.ytp-right-controls');
    if (!controlsContainer) return;

    const loopContainer = document.createElement('div');
    loopContainer.id = 'ytloop-controls';
    loopContainer.className = 'ytloop-controls';

    // Prevent YouTube's player mousedown handler from intercepting clicks on our buttons
    function stopMousedown(e) { e.stopPropagation(); }

    // Simple loop button
    const loopBtn = document.createElement('button');
    loopBtn.id = 'ytloop-toggle';
    loopBtn.className = 'ytloop-btn ytp-button';
    loopBtn.title = 'Toggle Loop (L)';
    loopBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>`;
    loopBtn.addEventListener('mousedown', stopMousedown);
    loopBtn.addEventListener('click', toggleLoop);

    // A-B Loop button
    const abBtn = document.createElement('button');
    abBtn.id = 'ytloop-ab-toggle';
    abBtn.className = 'ytloop-btn ytp-button';
    abBtn.title = 'Toggle A-B Loop (O)';
    abBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M5.5 4h3.3l1.4 2.2L11.4 4h3.1L11 9.5 14.5 15h-3.1l-1.6-2.5L8.2 15H5.1l3.5-5.5zM15 4h4l-2.5 5.5L19 15h-4l2.5-5.5z"/></svg>`;
    abBtn.addEventListener('mousedown', stopMousedown);
    abBtn.addEventListener('click', toggleABMode);

    // Set Point A button
    const setABtn = document.createElement('button');
    setABtn.id = 'ytloop-set-a';
    setABtn.className = 'ytloop-btn ytloop-point-btn ytp-button';
    setABtn.title = 'Set Point A ([)';
    setABtn.textContent = 'A';
    setABtn.addEventListener('mousedown', stopMousedown);
    setABtn.addEventListener('click', setPointA);

    // Set Point B button
    const setBBtn = document.createElement('button');
    setBBtn.id = 'ytloop-set-b';
    setBBtn.className = 'ytloop-btn ytloop-point-btn ytp-button';
    setBBtn.title = 'Set Point B (])';
    setBBtn.textContent = 'B';
    setBBtn.addEventListener('mousedown', stopMousedown);
    setBBtn.addEventListener('click', setPointB);

    // Reset A-B button
    const resetBtn = document.createElement('button');
    resetBtn.id = 'ytloop-reset';
    resetBtn.className = 'ytloop-btn ytloop-reset-btn ytp-button';
    resetBtn.title = 'Reset A-B Points (Shift+R)';
    resetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    resetBtn.addEventListener('mousedown', stopMousedown);
    resetBtn.addEventListener('click', resetABPoints);

    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.id = 'ytloop-time-display';
    timeDisplay.className = 'ytloop-time-display';

    loopContainer.append(loopBtn, abBtn, setABtn, setBBtn, resetBtn, timeDisplay);
    controlsContainer.insertBefore(loopContainer, controlsContainer.firstChild);

    createTimelineMarkers();
    updateUI();
  }

  // Create timeline markers for A-B points
  function createTimelineMarkers() {
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar || document.getElementById('ytloop-markers')) return;

    const markersContainer = document.createElement('div');
    markersContainer.id = 'ytloop-markers';
    markersContainer.className = 'ytloop-markers';

    const markerA = document.createElement('div');
    markerA.id = 'ytloop-marker-a';
    markerA.className = 'ytloop-marker ytloop-marker-a';
    markerA.textContent = 'A';

    const markerB = document.createElement('div');
    markerB.id = 'ytloop-marker-b';
    markerB.className = 'ytloop-marker ytloop-marker-b';
    markerB.textContent = 'B';

    const loopRegion = document.createElement('div');
    loopRegion.id = 'ytloop-region';
    loopRegion.className = 'ytloop-region';

    markersContainer.append(markerA, markerB, loopRegion);
    progressBar.appendChild(markersContainer);
  }

  // Update timeline markers position
  function updateMarkers() {
    const video = getVideo();
    if (!video || !video.duration) return;

    const markerA = document.getElementById('ytloop-marker-a');
    const markerB = document.getElementById('ytloop-marker-b');
    const loopRegion = document.getElementById('ytloop-region');

    if (state.pointA !== null && markerA) {
      markerA.style.left = `${(state.pointA / video.duration) * 100}%`;
      markerA.style.display = 'block';
    } else if (markerA) {
      markerA.style.display = 'none';
    }

    if (state.pointB !== null && markerB) {
      markerB.style.left = `${(state.pointB / video.duration) * 100}%`;
      markerB.style.display = 'block';
    } else if (markerB) {
      markerB.style.display = 'none';
    }

    if (state.pointA !== null && state.pointB !== null && loopRegion && state.isABLooping) {
      const posA = (state.pointA / video.duration) * 100;
      const posB = (state.pointB / video.duration) * 100;
      loopRegion.style.left = `${Math.min(posA, posB)}%`;
      loopRegion.style.width = `${Math.abs(posB - posA)}%`;
      loopRegion.style.display = 'block';
    } else if (loopRegion) {
      loopRegion.style.display = 'none';
    }
  }

  // Toggle simple loop
  function toggleLoop() {
    if (!isEnabled) return;
    const video = getVideo();
    if (!video) return;

    state.isLooping = !state.isLooping;
    video.loop = state.isLooping;

    if (state.isLooping && state.isABLooping) {
      state.isABLooping = false;
    }

    updateUI();
    saveState();
    showNotification(state.isLooping ? 'Loop enabled' : 'Loop disabled');
  }

  // Toggle A-B loop mode
  function toggleABMode() {
    if (!isEnabled) return;
    state.isABLooping = !state.isABLooping;

    if (state.isABLooping) {
      const video = getVideo();
      if (video) video.loop = false;
      state.isLooping = false;
    }

    updateUI();
    saveState();

    if (state.isABLooping) {
      if (state.pointA !== null && state.pointB !== null) {
        showNotification(`A-B Loop: ${formatTime(state.pointA)} \u2192 ${formatTime(state.pointB)}`);
      } else {
        showNotification('A-B Loop enabled \u2013 Set points A and B');
      }
    } else {
      showNotification('A-B Loop disabled');
    }
    syncABWorker();
  }

  // Set Point A
  function setPointA() {
    if (!isEnabled) return;
    const video = getVideo();
    if (!video) return;

    state.pointA = video.currentTime;

    if (state.pointB !== null && state.pointA >= state.pointB) {
      state.pointB = null;
    }

    updateUI();
    saveState();
    showNotification(`Point A set: ${formatTime(state.pointA)}`);
    syncABWorker();
  }

  // Set Point B
  function setPointB() {
    if (!isEnabled) return;
    const video = getVideo();
    if (!video) return;

    state.pointB = video.currentTime;

    if (state.pointA !== null && state.pointB <= state.pointA) {
      const temp = state.pointA;
      state.pointA = state.pointB;
      state.pointB = temp;
    }

    updateUI();
    saveState();
    showNotification(`Point B set: ${formatTime(state.pointB)}`);

    if (state.pointA !== null && !state.isABLooping) {
      state.isABLooping = true;
      updateUI();
      saveState();
    }
    syncABWorker();
  }

  // Reset A-B points
  function resetABPoints() {
    if (!isEnabled) return;
    state.pointA = null;
    state.pointB = null;
    state.isABLooping = false;
    stopABWorker();
    updateUI();
    saveState();
    showNotification('A-B points reset');
  }

  // Reset state for new video
  function resetStateForNewVideo() {
    state.isLooping = false;
    state.isABLooping = false;
    state.pointA = null;
    state.pointB = null;
    stopABWorker();

    const video = getVideo();
    if (video) {
      video.loop = false;
    }
  }

  // Update UI based on state
  function updateUI() {
    const loopBtn = document.getElementById('ytloop-toggle');
    const abBtn = document.getElementById('ytloop-ab-toggle');
    const setABtn = document.getElementById('ytloop-set-a');
    const setBBtn = document.getElementById('ytloop-set-b');
    const timeDisplay = document.getElementById('ytloop-time-display');

    if (loopBtn) {
      loopBtn.classList.toggle('active', state.isLooping);
    }

    if (abBtn) {
      abBtn.classList.toggle('active', state.isABLooping);
    }

    if (setABtn) {
      setABtn.classList.toggle('set', state.pointA !== null);
      setABtn.title = state.pointA !== null
        ? `Point A: ${formatTime(state.pointA)} ([)`
        : 'Set Point A ([)';
    }

    if (setBBtn) {
      setBBtn.classList.toggle('set', state.pointB !== null);
      setBBtn.title = state.pointB !== null
        ? `Point B: ${formatTime(state.pointB)} (])`
        : 'Set Point B (])';
    }

    if (timeDisplay) {
      if (state.pointA !== null && state.pointB !== null) {
        timeDisplay.textContent = `${formatTime(state.pointA)} \u2192 ${formatTime(state.pointB)}`;
      } else if (state.pointA !== null) {
        timeDisplay.textContent = `A: ${formatTime(state.pointA)}`;
      } else {
        timeDisplay.textContent = '';
      }
    }

    updateMarkers();
  }

  // Show notification
  function showNotification(message) {
    let notification = document.getElementById('ytloop-notification');

    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'ytloop-notification';
      notification.className = 'ytloop-notification';
      document.body.appendChild(notification);
    }

    if (state.notificationTimer) {
      clearTimeout(state.notificationTimer);
    }

    notification.textContent = message;
    notification.classList.add('show');

    state.notificationTimer = setTimeout(() => {
      notification.classList.remove('show');
      state.notificationTimer = null;
    }, 2000);
  }

  // Handle video time update for A-B loop
  function onTimeUpdate() {
    if (!isEnabled || !state.isABLooping || state.pointA === null || state.pointB === null) return;

    const video = getVideo();
    if (!video) return;

    if (video.currentTime >= state.pointB) {
      video.currentTime = state.pointA;
    }
  }

  // Handle video ended event for both loop modes
  function onVideoEnded() {
    if (!isEnabled) return;
    const video = getVideo();
    if (!video) return;

    if (state.isABLooping && state.pointA !== null) {
      video.currentTime = state.pointA;
      video.play().catch(() => {});
    } else if (state.isLooping) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }

  // Web Worker for A-B loop timing
  let abLoopWorker = null;

  function startABWorker() {
    if (abLoopWorker) return;
    const code = 'let t; onmessage = e => { if (e.data === "start") { clearInterval(t); t = setInterval(() => postMessage(0), 250); } else { clearInterval(t); } };';
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    abLoopWorker = new Worker(url);
    URL.revokeObjectURL(url);
    abLoopWorker.onmessage = onTimeUpdate;
    abLoopWorker.postMessage('start');
  }

  function stopABWorker() {
    if (!abLoopWorker) return;
    abLoopWorker.postMessage('stop');
    abLoopWorker.terminate();
    abLoopWorker = null;
  }

  // Start or stop the worker based on current A-B loop state
  function syncABWorker() {
    if (state.isABLooping && state.pointA !== null && state.pointB !== null) {
      startABWorker();
    } else {
      stopABWorker();
    }
  }

  // Keyboard shortcuts
  function onKeyDown(e) {
    if (!isEnabled) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (!getVideoId()) return;

    const video = getVideo();
    if (!video) return;

    switch (e.key) {
      case 'l':
      case 'L':
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          toggleLoop();
          e.preventDefault();
        }
        break;
      case '[':
        setPointA();
        e.preventDefault();
        break;
      case ']':
        setPointB();
        e.preventDefault();
        break;
      case 'R':
        if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          resetABPoints();
          e.preventDefault();
        }
        break;
      case 'o':
      case 'O':
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          toggleABMode();
          e.preventDefault();
        }
        break;
    }
  }

  // Handle video change (SPA navigation)
  function handleVideoChange() {
    const currentVideoId = getVideoId();

    if (!currentVideoId) {
      cleanup();
      state.lastVideoId = null;
      return;
    }

    if (currentVideoId === state.lastVideoId) {
      if (!controlsExist()) {
        createControls();
      }
      return;
    }

    state.lastVideoId = currentVideoId;
    resetStateForNewVideo();

    loadState(() => {
      if (!controlsExist()) {
        createControls();
      }
      updateUI();
      syncABWorker();
    });
  }

  // Attach timeupdate and ended listeners to video element
  function attachVideoListener() {
    if (!isEnabled) return;
    const video = getVideo();
    if (video && !video.hasAttribute('data-ytloop-attached')) {
      video.setAttribute('data-ytloop-attached', 'true');
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('ended', onVideoEnded);
    }
  }

  let controlsObserver = null;

  // Initialize extension
  function init() {
    if (!isEnabled) return;

    document.addEventListener('keydown', onKeyDown);

    handleVideoChange();
    attachVideoListener();

    // YouTube SPA navigation event (dispatched on document)
    document.addEventListener('yt-navigate-finish', () => {
      setTimeout(() => {
        if (!isEnabled) return;
        handleVideoChange();
        attachVideoListener();
      }, 500);
    });

    // Fallback for back/forward browser navigation
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        if (!isEnabled) return;
        handleVideoChange();
        attachVideoListener();
      }, 500);
    });

    if (controlsObserver) controlsObserver.disconnect();
    controlsObserver = new MutationObserver(() => {
      if (!isEnabled) return;
      if (getVideoId() && !controlsExist()) {
        if (document.querySelector('.ytp-right-controls')) {
          createControls();
          attachVideoListener();
        }
      }
    });

    const playerContainer = document.getElementById('movie_player') || document.body;
    controlsObserver.observe(playerContainer, { subtree: true, childList: true });
  }

  // Remove everything when the feature is disabled
  function disableAll() {
    stopABWorker();
    cleanup();
    state.isLooping = false;
    state.isABLooping = false;
    state.pointA = null;
    state.pointB = null;
    state.lastVideoId = null;
    if (controlsObserver) {
      controlsObserver.disconnect();
      controlsObserver = null;
    }
    const video = getVideo();
    if (video) {
      video.loop = false;
      if (video.hasAttribute('data-ytloop-attached')) {
        video.removeAttribute('data-ytloop-attached');
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onVideoEnded);
      }
    }
  }

  function applyEnabled(on) {
    isEnabled = on;
    if (on) {
      init();
    } else {
      disableAll();
    }
  }

  chrome.storage.local.get([ENABLED_KEY], (res) => {
    applyEnabled(res[ENABLED_KEY] !== false);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || changes[ENABLED_KEY] === undefined) return;
    applyEnabled(changes[ENABLED_KEY].newValue !== false);
  });
})();