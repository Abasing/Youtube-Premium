(() => {
  'use strict';
  const KEY = 'disablePausePopup';
  const ATTR = 'data-ypm-no-pause';

  function setAttr(on) {
    const el = document.documentElement;
    if (!el) return;
    if (on) el.setAttribute(ATTR, '1');
    else el.removeAttribute(ATTR);
  }

  chrome.storage.local.get([KEY], (res) => setAttr(res[KEY] !== false));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    setAttr(changes[KEY].newValue !== false);
  });
})();