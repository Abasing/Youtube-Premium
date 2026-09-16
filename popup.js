(() => {
  'use strict';

  const Actions = {
    GetSettings: 'GET_SETTINGS',
    SetSetting: 'SET_SETTING',
  };

  const adsToggle = document.getElementById('ypm-ads-toggle');
  const noticesCheck = document.getElementById('ypm-notices-check');
  const pauseToggle = document.getElementById('ypm-pause-toggle');
  const syncToggle = document.getElementById('ypm-sync-toggle');
  const loopToggle = document.getElementById('ypm-loop-toggle');
  const rydToggle = document.getElementById('ypm-ryd-toggle');
  const tagsToggle = document.getElementById('ypm-tags-toggle');
  const boostToggle = document.getElementById('ypm-boost-toggle');
  const versionEl = document.getElementById('ypm-version');
  const creditEl = document.getElementById('ypm-credit');
  const creditTip = document.getElementById('ypm-credit-tip');
  const adsMenuBtn = document.getElementById('ypm-ads-menu');
  const adsMenuPop = document.getElementById('ypm-ads-menu-pop');

  // Random hover message shown over the credit (one per open session).
  const hoverMessages = [
    'does this deserve a follow?',
    'made something cool. follow?',
    'worth a follow? 👀',
    'did i cook?',
    'one tiny follow?',
    'if you liked this… 👀',
    'should i get a follow for this?',
    'you made it this far 👀',
    'free follow opportunity',
    'wanna see what i make next?',
    'tiny extension, tiny follow?',
  ];
  // Random enthusiasm fired on click.
  const clickMessages = [
    'THANK YOU! ❤️',
    'AWESOME! ❤️',
    'YAY! THANK YOU!',
    'LET\'S GOO! 🎉',
    'YOU\'RE AWESOME!',
    'THANK YOU SO MUCH!',
    'WOOHOO! 🎉',
    'THAT MEANS A LOT! ❤️',
    'YOU MADE MY DAY!',
    'NICE! THANK YOU! ❤️',
    'YAYYY! ❤️',
    'APPRECIATED! ❤️',
    'YOU\'RE THE BEST!',
    'AWESOME, THANK YOU!',
    'LET\'S GOOO! ❤️',
    'THANK YOU! ✨',
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function setSetting(key, value) {
    chrome.runtime.sendMessage({ type: Actions.SetSetting, payload: { key, value } }, () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
    });
  }

  adsToggle.addEventListener('change', () => setSetting('ads', adsToggle.checked));
  noticesCheck.addEventListener('change', () => setSetting('adLeakNotices', noticesCheck.checked));
  pauseToggle.addEventListener('change', () => setSetting('disablePausePopup', pauseToggle.checked));
  syncToggle.addEventListener('change', () => {
    syncToggle.disabled = true;
    setSetting('syncServerRules', syncToggle.checked);
  });
  loopToggle.addEventListener('change', () => setSetting('loopControlsEnabled', loopToggle.checked));
  rydToggle.addEventListener('change', () => setSetting('rydEnabled', rydToggle.checked));
  tagsToggle.addEventListener('change', () => setSetting('videoTagsEnabled', tagsToggle.checked));
  boostToggle.addEventListener('change', () => setSetting('volumeBoostEnabled', boostToggle.checked));

  const closeAdvancedMenu = () => {
    if (!adsMenuPop || !adsMenuBtn) return;
    adsMenuPop.classList.remove('open');
    adsMenuBtn.setAttribute('aria-expanded', 'false');
  };

  const openAdvancedMenu = () => {
    if (!adsMenuPop || !adsMenuBtn) return;
    const rect = adsMenuBtn.getBoundingClientRect();
    const popWidth = adsMenuPop.offsetWidth || 224;
    let left = rect.right - popWidth;
    if (left < 6) left = 6;
    let top = rect.bottom + 4;
    if (top + adsMenuPop.offsetHeight > window.innerHeight - 6) {
      top = Math.max(6, rect.top - adsMenuPop.offsetHeight - 4);
    }
    adsMenuPop.style.left = left + 'px';
    adsMenuPop.style.top = top + 'px';
    adsMenuPop.classList.add('open');
    adsMenuBtn.setAttribute('aria-expanded', 'true');
  };

  if (adsMenuBtn && adsMenuPop) {
    adsMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (adsMenuPop.classList.contains('open')) {
        closeAdvancedMenu();
      } else {
        openAdvancedMenu();
      }
    });
    document.addEventListener('click', (e) => {
      if (adsMenuPop.classList.contains('open') && !adsMenuBtn.contains(e.target) && !adsMenuPop.contains(e.target)) {
        closeAdvancedMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAdvancedMenu();
    });
  }

  chrome.runtime.sendMessage({ type: Actions.GetSettings }, (settings) => {
    if (chrome.runtime.lastError || !settings) return;
    adsToggle.checked = !!settings.ads;
    noticesCheck.checked = !!settings.adLeakNotices;
    pauseToggle.checked = settings.disablePausePopup !== false;
    syncToggle.checked = !!settings.syncServerRules;
    syncToggle.disabled = false;
    loopToggle.checked = settings.loopControlsEnabled !== false;
    rydToggle.checked = settings.rydEnabled !== false;
    tagsToggle.checked = settings.videoTagsEnabled !== false;
    boostToggle.checked = settings.volumeBoostEnabled !== false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.ads) adsToggle.checked = !!changes.ads.newValue;
    if (changes.adLeakNotices) noticesCheck.checked = !!changes.adLeakNotices.newValue;
    if (changes.disablePausePopup) pauseToggle.checked = changes.disablePausePopup.newValue !== false;
    if (changes.syncServerRules) {
      syncToggle.checked = !!changes.syncServerRules.newValue;
      syncToggle.disabled = false;
    }
    if (changes.loopControlsEnabled) loopToggle.checked = changes.loopControlsEnabled.newValue !== false;
    if (changes.rydEnabled) rydToggle.checked = changes.rydEnabled.newValue !== false;
    if (changes.videoTagsEnabled) tagsToggle.checked = changes.videoTagsEnabled.newValue !== false;
    if (changes.volumeBoostEnabled) boostToggle.checked = changes.volumeBoostEnabled.newValue !== false;
  });

  if (versionEl && chrome.runtime && chrome.runtime.getManifest) {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  if (creditEl) {
    const url = creditEl.href;
    const delay = 700;

    if (creditTip) {
      creditTip.textContent = pick(hoverMessages);
    }

    const showTip = (e) => {
      creditEl.classList.add('tip-visible');
      const tip = creditTip;
      if (tip && e && e.relatedTarget) tip.setAttribute('aria-hidden', 'false');
    };
    const hideTip = () => {
      creditEl.classList.remove('tip-visible');
      if (creditTip) creditTip.setAttribute('aria-hidden', 'true');
    };
    creditEl.addEventListener('mouseenter', showTip);
    creditEl.addEventListener('mouseleave', hideTip);
    creditEl.addEventListener('focus', showTip);
    creditEl.addEventListener('blur', hideTip);

    creditEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (!burstLocked) {
        burstLocked = true;
        hideTip();
        spawnIgBurst(e.clientX, e.clientY);
        spawnFlashMsg(e.clientX, e.clientY);
        setTimeout(() => {
          burstLocked = false;
          commitOpen(url);
        }, delay);
      }
    });
  }

  function spawnFlashMsg(x, y) {
    const el = document.createElement('div');
    el.className = 'ypm-credit-flash';
    el.textContent = pick(clickMessages);
    el.style.left = x + 'px';
    el.style.top = (y - 6) + 'px';
    document.body.appendChild(el);
    const done = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 800);
  }

  let burstLocked = false;

  function commitOpen(url) {
    chrome.tabs.query({}, (tabs) => {
      const existing = tabs.find((t) => t.url === url);
      if (existing) {
        chrome.tabs.update(existing.id, { active: true }, () => {
          chrome.windows.update(existing.windowId, { focused: true });
        });
      } else {
        chrome.tabs.create({ url });
      }
    });
  }

  // Instagram-inspired heart burst at the click point.
  function spawnIgBurst(x, y) {
    const colors = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'];
    const frag = document.createDocumentFragment();

    const heart = document.createElement('div');
    heart.className = 'ypm-ig-heart';
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    frag.appendChild(heart);

    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = 'ypm-ig-ring';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
      ring.style.animationDelay = (i * 90) + 'ms';
      frag.appendChild(ring);
    }

    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('div');
      spark.className = 'ypm-ig-spark';
      const angle = (i / 8) * Math.PI * 2;
      const dist = 34 + (i % 3) * 10;
      spark.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      spark.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
      spark.style.background = colors[i % colors.length];
      spark.style.left = x + 'px';
      spark.style.top = y + 'px';
      spark.style.animationDelay = (i * 12) + 'ms';
      frag.appendChild(spark);
    }

    document.body.appendChild(frag);
    setTimeout(() => {
      if (frag.parentNode === document.body) document.body.removeChild(frag);
    }, 900);
  }
})();