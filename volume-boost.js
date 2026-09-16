(() => {
  'use strict';

  const ENABLED_KEY = 'volumeBoostEnabled';
  const VALUE_KEY = 'volumeBoost';
  const MIN_BOOST = 100;
  const MAX_BOOST = 600;
  const BOOST_TRACK_PX = 175;

  let enabled = false;
  // working effective volume: 0..600 (0-100 native volume, 100-600 boost)
  let pct = 100;
  let audioCtx = null;
  let sourceNode = null;
  let gainNode = null;
  let currentVideo = null;
  let dragging = false;
  let hovering = false;
  const consumedSources = new WeakSet();
  const resumeReady = new WeakSet();
  const boundSliders = new WeakSet();
  const boundAreas = new WeakSet();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getVideo() {
    return document.querySelector('video.html5-main-video');
  }

  // ---- Web Audio gain pipeline ----

  function ensureAudio(video, attachVolume) {
    if (currentVideo === video && gainNode) return;
    teardownNodes();
    currentVideo = video;
    if (!video || consumedSources.has(video)) return;
    try {
      if (!audioCtx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        audioCtx = new Ctor();
      }
      sourceNode = audioCtx.createMediaElementSource(video);
      consumedSources.add(video);
      gainNode = audioCtx.createGain();
      sourceNode.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      if (attachVolume) video.addEventListener('volumechange', onVolumeChange);
    } catch (err) {
      teardownNodes();
    }
  }

  function teardownNodes() {
    try {
      if (gainNode) gainNode.disconnect();
      if (sourceNode) sourceNode.disconnect();
    } catch (err) { /* ignore */ }
    gainNode = null;
    sourceNode = null;
  }

  function setGain(gain) {
    if (!gainNode || !audioCtx) return;
    try {
      gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
    } catch (err) { /* ignore */ }
  }

  function resumeAudio() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch (err) { /* ignore */ }
  }

  function bindResume() {
    if (resumeReady.has(document)) return;
    resumeReady.add(document);
    const kick = () => resumeAudio();
    document.addEventListener('pointerdown', kick, true);
    document.addEventListener('keydown', kick, true);
    document.addEventListener('visibilitychange', kick);
  }

  // ---- effective volume model ----
  // pct maps 0..600: <=100 -> video.volume = pct/100, gain 1
  //                  >100  -> video.volume = 1,      gain pct/100

  function applyPct(p) {
    pct = clamp(Math.round(p), 0, MAX_BOOST);
    const ratio = pct / 100;
    const native = Math.min(1, ratio);
    const gain = Math.max(1, ratio);
    const video = getVideo();
    if (video && Math.abs(video.volume - native) > 1e-4) {
      video.volume = native;
    }
    setGain(gain);
    syncAll();
  }

  function onVolumeChange() {
    if (!enabled) return;
    const video = getVideo();
    if (!video) return;
    const gain = gainNode ? gainNode.gain.value : 1;
    pct = clamp(Math.round(video.volume * gain * 100), 0, MAX_BOOST);
    syncAll();
  }

  function syncAll() {
    const player = document.getElementById('movie_player');
    const boostOn = !!(player && player.classList.contains('ypm-boost-on'));
    const panel = document.querySelector('.ytp-volume-panel');
    const slider = document.querySelector('.ytp-volume-slider');
    const handle = slider ? slider.querySelector('.ytp-volume-slider-handle') : null;

    // The rail only exists while the user hovers the volume area (or drags).
    const showRail = boostOn && (hovering || dragging);

    if (panel) {
      panel.style.width = showRail ? BOOST_TRACK_PX + 'px' : '';
      panel.style.maxWidth = showRail ? BOOST_TRACK_PX + 'px' : '';
      panel.style.overflow = boostOn ? 'visible' : '';
    }
    if (slider) {
      slider.style.width = showRail ? BOOST_TRACK_PX + 'px' : '';
      slider.style.maxWidth = showRail ? BOOST_TRACK_PX + 'px' : '';
      slider.style.transition = boostOn ? 'none' : '';
      slider.style.background = boostOn ? 'transparent' : '';
    }
    // Hide YouTube's own handle visuals whenever boost is active, so only our
    // overlay rail (and its own handle) is ever visible.
    if (handle) handle.style.visibility = boostOn ? 'hidden' : '';

    const track = document.getElementById('ypm-boost-track');
    if (track) {
      track.style.display = showRail ? 'block' : 'none';
      if (showRail) syncOverlay(slider, handle);
    }
    if (player) player.classList.toggle('ypm-boost-on', enabled);
  }

  // Our fixed rail overlay: gray placeholder + red boost fill + white handle.
  // It is drawn over YouTube's native slider so nothing escapes the rail.
  function ensureOverlayDom(slider) {
    const panel = document.querySelector('.ytp-volume-panel');
    if (panel && !panel.classList.contains('ytp-boost-panel')) {
      panel.classList.add('ytp-boost-panel');
    }
    if (slider && !document.getElementById('ypm-boost-track')) {
      const track = document.createElement('div');
      track.id = 'ypm-boost-track';
      track.className = 'ypm-boost-track';
      const fill = document.createElement('div');
      fill.id = 'ypm-boost-fill';
      fill.className = 'ypm-boost-fill';
      const marker = document.createElement('div');
      marker.className = 'ypm-boost-marker';
      const ownHandle = document.createElement('div');
      ownHandle.id = 'ypm-boost-handle';
      ownHandle.className = 'ypm-boost-handle';
      const readout = document.createElement('div');
      readout.id = 'ypm-boost-readout';
      readout.className = 'ypm-boost-readout';
      track.appendChild(fill);
      track.appendChild(marker);
      track.appendChild(readout);
      track.appendChild(ownHandle);
      slider.appendChild(track);
    }
  }

  function syncOverlay(slider, nativeHandle) {
    const track = document.getElementById('ypm-boost-track');
    if (!track) return;
    const width = slider ? (slider.getBoundingClientRect().width || BOOST_TRACK_PX) : BOOST_TRACK_PX;
    const fill = document.getElementById('ypm-boost-fill');
    const ownHandle = document.getElementById('ypm-boost-handle');
    const marker = track.querySelector('.ypm-boost-marker');
    const readout = document.getElementById('ypm-boost-readout');
    const frac = pct / MAX_BOOST;
    const fillPx = Math.round(frac * width);
    if (fill) {
      fill.style.width = fillPx + 'px';
      fill.style.background = pct > MIN_BOOST ? '#ff0033' : 'rgba(255, 255, 255, 0.85)';
    }
    if (marker) marker.style.left = (width * MIN_BOOST / MAX_BOOST) + 'px';
    if (ownHandle) {
      ownHandle.style.left = (fillPx - 6) + 'px';
      ownHandle.style.visibility = 'visible';
    }
    if (readout) {
      // Bubble floats above the handle tip, stays inside the rail.
      const left = clamp(fillPx, 16, width - 16);
      readout.style.left = left + 'px';
      readout.textContent = pct + '%';
      readout.classList.toggle('ypm-boost-readout-boost', pct > MIN_BOOST);
    }
  }

  // ---- native slider integration ----

  function ensureIncidentalDom(slider) {
    ensureOverlayDom(slider);
  }

  function bindSlider(slider) {
    if (boundSliders.has(slider)) return;
    boundSliders.add(slider);
    ensureIncidentalDom(slider);
    bindAreaHover();

    const toPct = (e) => {
      const rect = slider.getBoundingClientRect();
      return clamp(Math.round((e.clientX - rect.left) / (rect.width || 1) * MAX_BOOST), 0, MAX_BOOST);
    };
    const persist = () => {
      try {
        chrome.storage.local.set({ [VALUE_KEY]: Math.max(MIN_BOOST, pct) });
      } catch (err) { /* ignore */ }
    };

    // Capture phase so we run before (and block) YouTube's own handlers.
    slider.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragging = true;
      hovering = true;
      try { slider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      applyPct(toPct(e));
    }, true);
    slider.addEventListener('pointermove', (e) => {
      if (!enabled || !dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      applyPct(toPct(e));
    }, true);
    const endDrag = (e) => {
      if (!enabled || !dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dragging = false;
      applyPct(toPct(e));
      persist();
      syncAll();
    };
    slider.addEventListener('pointerup', endDrag, true);
    slider.addEventListener('pointercancel', endDrag, true);
    // YouTube also listens for mouse events / clicks on the slider; blocking
    // them keeps it from snapping back to its (stale) internal value.
    slider.addEventListener('mouseup', (e) => {
      if (!enabled || !dragging) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    slider.addEventListener('click', (e) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    slider.addEventListener('wheel', (e) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      const inc = e.deltaY < 0 ? 10 : -10;
      applyPct(pct + inc);
      persist();
    }, { passive: false, capture: true });
  }

  // ---- lifecycle ----

  let intervalId = null;

  function bindAreaHover() {
    const area = document.querySelector('.ytp-volume-area');
    if (!area || boundAreas.has(area)) return;
    boundAreas.add(area);
    area.addEventListener('mouseenter', () => {
      hovering = true;
      syncAll();
    });
    area.addEventListener('mouseleave', () => {
      hovering = false;
      syncAll();
    });
  }

  function tick() {
    if (!enabled) return;
    const slider = document.querySelector('.ytp-volume-slider');
    if (slider) {
      if (!boundSliders.has(slider)) bindSlider(slider);
      else ensureIncidentalDom(slider);
      syncAll();
    }
    const video = getVideo();
    if (video && currentVideo !== video) ensureAudio(video, true);
  }

  function start() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 750);
    tick();
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    dragging = false;
    setGain(1);
    const video = getVideo();
    pct = video ? clamp(Math.round(video.volume * 100), 0, 100) : 100;
const player = document.getElementById('movie_player');
    if (player) player.classList.remove('ypm-boost-on');
const panel = document.querySelector('.ytp-volume-panel');
    const slider = document.querySelector('.ytp-volume-slider');
    const handle = slider ? slider.querySelector('.ytp-volume-slider-handle') : null;
    if (panel) { panel.style.width = ''; panel.style.maxWidth = ''; panel.style.overflow = ''; }
    if (slider) {
      slider.style.width = '';
      slider.style.maxWidth = '';
      slider.style.transition = '';
      slider.style.background = '';
    }
    if (handle) {
      handle.style.background = '';
      handle.style.boxShadow = '';
      handle.style.visibility = '';
    }
    const track = document.getElementById('ypm-boost-track');
    if (track) track.remove();
    const readout = document.getElementById('ypm-boost-readout');
    if (readout) readout.remove();
    syncAll();
  }

  function applyStoredState() {
    setGain(pct / 100);
    onVolumeChange();
  }

  chrome.storage.local.get([ENABLED_KEY, VALUE_KEY], (res) => {
    pct = clamp(Number.isFinite(res[VALUE_KEY]) ? res[VALUE_KEY] : MIN_BOOST, MIN_BOOST, MAX_BOOST);
    enabled = res[ENABLED_KEY] !== false;
    bindResume();
    if (enabled) {
      start();
      applyStoredState();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[VALUE_KEY] !== undefined && Number.isFinite(changes[VALUE_KEY].newValue)) {
      const next = clamp(changes[VALUE_KEY].newValue, MIN_BOOST, MAX_BOOST);
      if (enabled && next !== pct) {
        pct = next;
        applyPct(next);
      }
    }
    if (changes[ENABLED_KEY] === undefined) return;
    const nowEnabled = changes[ENABLED_KEY].newValue !== false;
    if (enabled === nowEnabled) return;
    enabled = nowEnabled;
    if (enabled) {
      chrome.storage.local.get([VALUE_KEY], (res) => {
        pct = clamp(Number.isFinite(res[VALUE_KEY]) ? res[VALUE_KEY] : MIN_BOOST, MIN_BOOST, MAX_BOOST);
        start();
        applyStoredState();
      });
    } else {
      stop();
    }
  });
})();