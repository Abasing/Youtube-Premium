(() => {
  'use strict';

  const ENABLED_KEY = 'videoTagsEnabled';
  const CONTAINER_ID = 'ypm-tags-container';
  const CONTENT_ID = 'ypm-tags-content';
  const VIDEO_ATTR = 'data-ypm-tags-video';
  const TICK_MS = 500;
  const FETCH_ATTEMPT_LIMIT = 3;
  const CACHE_LIMIT = 50;

  let enabled = false;
  const tagCache = Object.create(null);
  const fetchAttempts = Object.create(null);
  let pendingVideoId = null;

  function getWatchVideoId(url) {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)youtube\.com$/.test(parsed.hostname)) return null;
      if (parsed.pathname !== '/watch') return null;
      return parsed.searchParams.get('v');
    } catch (err) {
      return null;
    }
  }

  function decodeEntities(value) {
    // & escapes survive attribute parsing of refetched raw HTML: decode the
    // common ones. Tags are user content; DOMParser would also work but is
    // overkill when only a handful of entities appear.
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;|&apos;/g, "'")
      .trim();
  }

  function extractVideoTags(html) {
    const tags = [];
    const metaRegex = /<meta\b[^>]*>/gi;
    let match;
    while ((match = metaRegex.exec(html)) !== null) {
      const meta = match[0];
      if (!/(?:property|name)\s*=\s*["']og:video:tag["']/i.test(meta)) continue;
      const content = meta.match(/content\s*=\s*["']([^"']*)["']/i);
      if (content && content[1]) tags.push(decodeEntities(content[1]));
    }
    return tags.filter(Boolean);
  }

  // Tags are usually already in this page's <head>; reading them there needs
  // no network request at all. Fall back to a same-origin refetch only when
  // the meta tags are absent, mirroring the reference extension.
  function getPageTags() {
    const nodes = document.head.querySelectorAll('meta[property="og:video:tag"], meta[name="og:video:tag"]');
    const tags = [];
    for (const meta of nodes) {
      const value = meta.getAttribute('content');
      if (value && value.trim()) tags.push(value.trim());
    }
    const keywords = document.head.querySelector('meta[name="keywords"]');
    if (tags.length === 0 && keywords) {
      const value = keywords.getAttribute('content') || '';
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return tags;
  }

  function cacheTags(videoId, tags) {
    const keys = Object.keys(tagCache);
    if (keys.length >= CACHE_LIMIT) delete tagCache[keys[0]];
    tagCache[videoId] = tags;
  }

  function loadTags(videoId) {
    pendingVideoId = videoId;
    fetch('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId))
      .then((resp) => {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.text();
      })
      .then((txt) => {
        pendingVideoId = null;
        cacheTags(videoId, extractVideoTags(txt));
        delete fetchAttempts[videoId];
        sync();
      })
      .catch(() => {
        pendingVideoId = null;
        fetchAttempts[videoId] = (fetchAttempts[videoId] || 0) + 1;
      });
  }

  function buildContainer() {
    const wrapper = document.createElement('div');
    wrapper.id = CONTAINER_ID;
    wrapper.className = 'ypm-tags';

    const header = document.createElement('div');
    header.className = 'ypm-tags__header';

    const title = document.createElement('span');
    title.className = 'ypm-tags__title';
    title.textContent = 'Tags';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'ypm-tags__copy';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyAllTags(copyBtn));

    header.append(title, copyBtn);

    const contents = document.createElement('p');
    contents.className = 'ypm-tags__content';
    contents.id = CONTENT_ID;

    wrapper.append(header, contents);
    return wrapper;
  }

  function setMessage(contents, message) {
    contents.textContent = '';
    const msg = document.createElement('span');
    msg.className = 'ypm-tags__msg';
    msg.textContent = message;
    contents.appendChild(msg);
  }

  function renderTags(contents, tags) {
    contents.textContent = '';
    if (!tags.length) {
      const empty = document.createElement('span');
      empty.className = 'ypm-tags__msg';
      empty.textContent = 'No tags found';
      contents.appendChild(empty);
      return;
    }
    for (const tag of tags) {
      const link = document.createElement('a');
      link.className = 'ypm-tags__chip';
      link.href = '/results?search_query=' + encodeURIComponent(tag);
      link.title = 'Search "' + tag + '"';
      link.textContent = tag;
      contents.appendChild(link);
    }
  }

  function copyAllTags(btn) {
    const videoId = getWatchVideoId(window.location.href);
    const tags = (videoId && tagCache[videoId]) || [];
    if (!tags.length) return;
    navigator.clipboard.writeText(tags.join(', ')).then(() => {
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }).catch(() => {});
  }

  function ensureContainer(host) {
    let container = document.getElementById(CONTAINER_ID);
    if (container && container.parentElement === host) return container;
    if (container) container.remove();
    container = buildContainer();
    host.appendChild(container);
    return container;
  }

  function removeContainer() {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
  }

  function sync() {
    if (!enabled) return;
    const videoId = getWatchVideoId(window.location.href);
    if (!videoId) {
      removeContainer();
      return;
    }
    const host = document.getElementsByTagName('ytd-watch-metadata')[0];
    if (!host) return;
    const container = ensureContainer(host);
    // only paint once per video; the 500ms tick re-checks after YouTube
    // rebuilds the metadata section
    if (container.getAttribute(VIDEO_ATTR) === videoId) return;
    const contents = document.getElementById(CONTENT_ID);
    if (!contents) return;

    const cached = tagCache[videoId];
    if (cached) {
      renderTags(contents, cached);
      container.setAttribute(VIDEO_ATTR, videoId);
      return;
    }

    const pageTags = getPageTags();
    if (pageTags.length) {
      cacheTags(videoId, pageTags);
      renderTags(contents, pageTags);
      container.setAttribute(VIDEO_ATTR, videoId);
      return;
    }

    if (fetchAttempts[videoId] >= FETCH_ATTEMPT_LIMIT) {
      setMessage(contents, 'Could not load tags');
      container.setAttribute(VIDEO_ATTR, videoId);
      return;
    }

    setMessage(contents, 'Loading...');
    if (pendingVideoId !== videoId) loadTags(videoId);
  }

  window.addEventListener('load', sync);
  window.addEventListener('yt-page-data-updated', sync);
  window.addEventListener('yt-navigate-finish', sync);
  setInterval(sync, TICK_MS);

  chrome.storage.local.get([ENABLED_KEY], (res) => {
    enabled = res[ENABLED_KEY] !== false;
    sync();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || changes[ENABLED_KEY] === undefined) return;
    enabled = changes[ENABLED_KEY].newValue !== false;
    if (enabled) {
      sync();
    } else {
      removeContainer();
    }
  });
})();