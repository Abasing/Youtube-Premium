(() => {
  'use strict';

  const ENABLED_KEY = 'rydEnabled';
  const LIKES_DISABLED_TEXT = 'Dislikes';
  const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

  // Selectors ported from Return YouTube Dislike 4.0.5 defaults (desktop watch only).
  const SEL = {
    dislikeTextContainer: [
      '.yt-spec-button-shape-next__button-text-content',
      '.ytSpecButtonShapeNextButtonTextContent',
      '#text',
      'yt-formatted-string',
      "span[role='text']",
    ],
    likeTextContainer: [
      '.yt-spec-button-shape-next__button-text-content',
      '.ytSpecButtonShapeNextButtonTextContent',
      '#text',
      'yt-formatted-string',
      "span[role='text']",
    ],
    likeTextContainerTemplate: [
      '.yt-spec-button-shape-next__button-text-content',
      '.ytSpecButtonShapeNextButtonTextContent',
      "button > div[class*='cbox']",
    ],
    likeTextContainerTemplateParent: [
      "div > span[role='text']",
      "button > div.yt-spec-button-shape-next__button-text-content > span[role='text']",
    ],
    textContainerInner: ["span[role='text']"],
    buttons: {
      regular: {
        desktopMenu: ['ytd-menu-renderer.ytd-watch-metadata > div'],
        desktopNoMenu: ['#top-level-buttons-computed'],
      },
      segmentedContainer: ['ytd-segmented-like-dislike-button-renderer'],
      nativeButton: ['button'],
      likeButton: {
        segmented: ['#segmented-like-button'],
        segmentedGetButtons: [':first-child > :first-child'],
        notSegmented: ['like-button-view-model', ':first-child'],
      },
      dislikeButton: {
        segmented: ['#segmented-dislike-button'],
        segmentedGetButtons: [':first-child > :nth-child(2)'],
        notSegmented: ['dislike-button-view-model', ':nth-child(2)', '#dislike-button'],
      },
      smartimation: ['yt-smartimation'],
    },
    buttonClasses: {
      iconButton: ['yt-spec-button-shape-next--icon-button', 'ytSpecButtonShapeNextIconButton'],
      iconLeading: ['yt-spec-button-shape-next--icon-leading', 'ytSpecButtonShapeNextIconLeading'],
    },
    activeButtonClasses: ['style-default-active'],
    likeCountButton: ['yt-formatted-string#text', 'button'],
    videoLoaded: [
      "ytd-watch-grid[video-id='{videoId}']",
      "ytd-watch-flexy[video-id='{videoId}']",
      '#player[loading="false"]:not([hidden])',
    ],
    rateBar: { topRow: ['#top-row'] },
    roundedDesign: ['#segmented-like-button', 'like-button-view-model'],
  };

  const storedData = { dislikes: 0, likes: 0, videoId: null };
  let enabled = false;
  let lastButtonsNode = null;
  let pendingVideoId = null;

  // ---- helpers --------------------------------------------------------

  function q(selectors, element) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const root = element instanceof Element ? element : document;
    for (const selector of list) {
      if (!selector) continue;
      const result = root.querySelector(selector);
      if (result !== null) return result;
    }
    return undefined;
  }

  function qa(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      if (!selector) continue;
      const result = document.querySelectorAll(selector);
      if (result.length !== 0) return result;
    }
    return document.createDocumentFragment().children;
  }

  function matchesConfiguredSelector(element, selectors) {
    if (!element) return false;
    return (Array.isArray(selectors) ? selectors : [selectors]).some(
      (selector) => selector && element.matches(selector),
    );
  }

  function getVideoId(url) {
    const urlObject = new URL(url);
    if (urlObject.pathname.startsWith('/shorts')) return null;
    return urlObject.searchParams.get('v');
  }

  function isRendered(element) {
    if (!element || !element.isConnected || element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        Number.parseFloat(style.opacity || '1') === 0
      ) {
        return false;
      }
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function intersectsViewport(element) {
    const rect = element.getBoundingClientRect();
    const height = innerHeight || document.documentElement.clientHeight;
    const width = innerWidth || document.documentElement.clientWidth;
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < height &&
      rect.left < width
    );
  }

  function numberFormat(numberState) {
    let userLocales = document.documentElement.lang || navigator.language || 'en';
    try {
      return new Intl.NumberFormat(userLocales, { notation: 'compact', compactDisplay: 'short' }).format(numberState);
    } catch (err) {
      return String(numberState);
    }
  }

  // ---- button discovery (RYD 4.0.5 logic) ------------------------------

  function isSegmentedButtonLayout(buttons) {
    return q(SEL.buttons.segmentedContainer, buttons) !== undefined;
  }

  function getNativeButton(buttonContainer) {
    return q(SEL.buttons.nativeButton, buttonContainer);
  }

  function getSemanticControlSelectors(role) {
    const selectorConfig = SEL.buttons[`${role}Button`];
    return [...selectorConfig.segmented, ...selectorConfig.notSegmented].filter(
      (selector) => selector && !selector.trim().startsWith(':'),
    );
  }

  function isReactionControlHost(element) {
    const tagName = (element && element.tagName && element.tagName.toLowerCase()) || '';
    return tagName === 'button' || tagName.includes('-') || element.hasAttribute('data-ryd-role');
  }

  function hasSemanticReactionStructure(buttons, likeButton, dislikeButton, nativeLikeButton, nativeDislikeButton) {
    if (isSegmentedButtonLayout(buttons)) return true;
    if (
      matchesConfiguredSelector(likeButton, getSemanticControlSelectors('like')) &&
      matchesConfiguredSelector(dislikeButton, getSemanticControlSelectors('dislike'))
    ) {
      return true;
    }
    const positionalRoots = [...SEL.buttons.regular.desktopMenu, ...SEL.buttons.regular.desktopNoMenu];
    return (
      matchesConfiguredSelector(buttons, positionalRoots) &&
      (nativeLikeButton ? nativeLikeButton.hasAttribute('aria-pressed') : false) &&
      (nativeDislikeButton ? nativeDislikeButton.hasAttribute('aria-pressed') : false)
    );
  }

  function getLikeButton(buttons) {
    return isSegmentedButtonLayout(buttons)
      ? q(SEL.buttons.likeButton.segmented, buttons) ?? q(SEL.buttons.likeButton.segmentedGetButtons, buttons)
      : q(SEL.buttons.likeButton.notSegmented, buttons);
  }

  function getDislikeButton(buttons) {
    if (isSegmentedButtonLayout(buttons)) {
      return q(SEL.buttons.dislikeButton.segmented, buttons) ?? q(SEL.buttons.dislikeButton.segmentedGetButtons, buttons);
    }
    return q(SEL.buttons.dislikeButton.notSegmented, buttons) ?? null;
  }

  function getDesktopWatchButtonCandidates() {
    return Array.from(
      new Set([
        ...qa(SEL.buttons.regular.desktopMenu),
        ...qa(SEL.buttons.regular.desktopNoMenu),
      ]),
    );
  }

  function getButtons() {
    const videoId = getVideoId(window.location.href);
    const candidates = getDesktopWatchButtonCandidates().filter((candidate) => {
      const segmented = q(SEL.buttons.segmentedContainer, candidate);
      const like = q(SEL.buttons.likeButton.notSegmented, candidate);
      return segmented !== undefined || like !== undefined;
    });

    for (const candidate of candidates) {
      if (isRendered(candidate) && intersectsViewport(candidate)) return candidate;
    }
    for (const candidate of candidates) {
      if (isRendered(candidate)) return candidate;
    }
    if (candidates.length > 0) return candidates[0];
    return undefined;
  }

  function getLikeTextContainer(likeButton) {
    return q(SEL.likeTextContainer, likeButton);
  }

  function findDislikeTextContainer(dislikeButton, nativeDislikeButton) {
    if (!dislikeButton) return undefined;
    for (const selector of SEL.dislikeTextContainer) {
      const result = dislikeButton.querySelector(selector);
      if (result !== null && result !== nativeDislikeButton) {
        return matchesConfiguredSelector(result, SEL.textContainerInner)
          ? result
          : q(SEL.textContainerInner, result) ?? result;
      }
    }
    return undefined;
  }

  function getTextContainerTemplate(likeButton, buttons) {
    if (!likeButton || !buttons || !buttons.contains(likeButton)) return undefined;
    const parentTemplate =
      q(SEL.likeTextContainerTemplateParent, likeButton) ?? q(SEL.likeTextContainerTemplateParent, buttons);
    return (
      q(SEL.likeTextContainerTemplate, likeButton) ??
      q(SEL.likeTextContainerTemplate, buttons) ??
      (parentTemplate ? parentTemplate.parentNode : undefined)
    );
  }

  function getButtonControls(buttonsValue) {
    const buttons = buttonsValue || getButtons();
    const likeButton = getLikeButton(buttons);
    const dislikeButton = getDislikeButton(buttons);
    const nativeLikeButton = getNativeButton(likeButton);
    const nativeDislikeButton = getNativeButton(dislikeButton);
    const dislikeTextContainer = findDislikeTextContainer(dislikeButton, nativeDislikeButton);
    const textContainerTemplate = getTextContainerTemplate(likeButton, buttons);
    const ready = Boolean(
      buttons &&
        buttons.isConnected &&
        likeButton &&
        likeButton.isConnected &&
        dislikeButton &&
        dislikeButton.isConnected &&
        nativeLikeButton &&
        nativeLikeButton.isConnected &&
        nativeDislikeButton &&
        nativeDislikeButton.isConnected &&
        isReactionControlHost(likeButton) &&
        isReactionControlHost(dislikeButton) &&
        buttons.contains(likeButton) &&
        buttons.contains(dislikeButton) &&
        likeButton.contains(nativeLikeButton) &&
        dislikeButton.contains(nativeDislikeButton) &&
        hasSemanticReactionStructure(buttons, likeButton, dislikeButton, nativeLikeButton, nativeDislikeButton) &&
        (dislikeTextContainer || textContainerTemplate),
    );
    return { buttons, dislikeButton, dislikeTextContainer, likeButton, nativeDislikeButton, nativeLikeButton, ready, textContainerTemplate };
  }

  // ---- dislike text container (RYD creation logic) ---------------------

  function updateDislikeButtonShape(dislikeButton) {
    for (const className of SEL.buttonClasses.iconButton) {
      dislikeButton.classList.remove(className);
    }
    for (const className of SEL.buttonClasses.iconLeading) {
      dislikeButton.classList.add(className);
    }
  }

  function createDislikeTextContainer(controls) {
    const { dislikeButton, dislikeTextContainer, nativeDislikeButton, textContainerTemplate } = controls;
    if (dislikeTextContainer) return dislikeTextContainer;
    if (
      !controls.ready ||
      !nativeDislikeButton ||
      !nativeDislikeButton.isConnected ||
      !dislikeButton ||
      !dislikeButton.contains(nativeDislikeButton) ||
      !textContainerTemplate ||
      !textContainerTemplate.isConnected
    ) {
      return undefined;
    }

    const textNodeClone = textContainerTemplate.cloneNode(true);
    let textContainer = matchesConfiguredSelector(textNodeClone, SEL.textContainerInner)
      ? textNodeClone
      : q(SEL.textContainerInner, textNodeClone);
    if (textContainer === undefined) {
      textContainer = document.createElement('span');
      textContainer.setAttribute('role', 'text');
      while (textNodeClone.firstChild) {
        textNodeClone.removeChild(textNodeClone.firstChild);
      }
      textNodeClone.appendChild(textContainer);
    }
    if (!textContainer.id) textContainer.id = 'text';
    textContainer.innerText = '';
    nativeDislikeButton.insertBefore(textNodeClone, null);
    updateDislikeButtonShape(nativeDislikeButton);
    return textContainer;
  }

  function getDislikeTextContainer(controls) {
    return controls.dislikeTextContainer ?? createDislikeTextContainer(controls);
  }

  function isLikesDisabled(controls) {
    const likeTextContainer = getLikeTextContainer(controls.likeButton);
    return likeTextContainer ? /^\D*$/.test(likeTextContainer.innerText) : true;
  }

  function getLikeCountFromButton(controls) {
    try {
      const likeButton = q(SEL.likeCountButton, controls.likeButton);
      const likesStr = likeButton.getAttribute('aria-label').replace(/\D/g, '');
      return likesStr.length > 0 ? parseInt(likesStr, 10) : false;
    } catch (err) {
      return false;
    }
  }

  // ---- render ----------------------------------------------------------

  function setDislikes(dislikesCount) {
    const controls = getButtonControls();
    const container = getDislikeTextContainer(controls);
    if (!container) return false;
    container.removeAttribute('is-empty');

    let text;
    if (!isLikesDisabled(controls)) {
      text = dislikesCount;
    } else {
      text = LIKES_DISABLED_TEXT;
    }
    if (text != null && container.innerText !== text) {
      container.innerText = text;
    }
    return true;
  }

  function isRoundedDesign(buttons) {
    return SEL.roundedDesign.some(
      (selector) => (buttons ? buttons.querySelector(selector) : document.querySelector(selector)) !== null,
    );
  }

  function removeRateBarParts(buttons) {
    for (const wrapper of buttons ? buttons.querySelectorAll('.ryd-tooltip') : []) {
      wrapper.remove();
    }
  }

  function hasUsableRateBar(buttons, videoId) {
    const wrapper = buttons ? buttons.querySelector('.ryd-tooltip') : null;
    return Boolean(
      videoId &&
        wrapper &&
        buttons.contains(wrapper) &&
        wrapper.getAttribute('data-ryd-video-id') === videoId &&
        wrapper.style.display !== 'none' &&
        isRendered(wrapper),
    );
  }

  function isWatchPageVideoLoaded(videoId) {
    if (!videoId) return false;
    for (const selector of SEL.videoLoaded) {
      const cooked = selector.replace('{videoId}', videoId);
      if (document.querySelector(cooked) !== null) return true;
    }
    return false;
  }

  function createRateBar(likes, dislikes) {
    const buttons = getButtons();
    const videoId = getVideoId(window.location.href);
    if (!isWatchPageVideoLoaded(videoId) || !buttons || !isRendered(buttons)) return;
    for (const wrapper of document.querySelectorAll('.ryd-tooltip')) {
      if (!buttons.contains(wrapper)) wrapper.remove();
    }
    let rateBar = buttons.querySelector('#ryd-bar-container');
    let wrapper = buttons.querySelector('.ryd-tooltip');
    if (wrapper && (!hasUsableRateBar(buttons, videoId) || !isRendered(wrapper))) {
      removeRateBarParts(buttons);
      rateBar = null;
      wrapper = null;
    }

    const likeButton = getLikeButton(buttons);
    const dislikeButton = getDislikeButton(buttons);
    if (!likeButton || !dislikeButton) return;
    const widthPx =
      parseFloat(window.getComputedStyle(likeButton).width) +
      parseFloat(window.getComputedStyle(dislikeButton).width) +
      (isRoundedDesign(buttons) ? 0 : 8);

    const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;
    const tooltipInnerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;

    if (!rateBar) {
      buttons.insertAdjacentHTML(
        'beforeend',
        `<div class="ryd-tooltip ryd-tooltip-new-design" style="width: ${widthPx}px" data-ryd-video-id="${videoId}">
          <div class="ryd-tooltip-bar-container">
            <div id="ryd-bar-container" style="width: 100%; height: 2px;">
              <div id="ryd-bar" style="width: ${widthPercent}%; height: 100%;"></div>
            </div>
          </div>
          <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">${tooltipInnerHTML}</tp-yt-paper-tooltip>
        </div>`,
      );
    } else {
      wrapper.setAttribute('data-ryd-video-id', videoId);
      wrapper.style.width = `${widthPx}px`;
      const fill = buttons.querySelector('#ryd-bar');
      if (fill) fill.style.width = `${widthPercent}%`;
      const tooltipHost = buttons.querySelector('#ryd-dislike-tooltip');
      if (tooltipHost) {
        const tooltip = tooltipHost.querySelector('#tooltip') || tooltipHost;
        tooltip.innerHTML = tooltipInnerHTML;
      }
    }
  }

  function processResponse(response) {
    const likes = parseInt(response.likes, 10) || 0;
    const dislikes = parseInt(response.dislikes, 10) || 0;
    storedData.likes = likes;
    storedData.dislikes = dislikes;
    storedData.videoId = getVideoId(window.location.href);
    if (!setDislikes(numberFormat(dislikes))) return false;
    createRateBar(likes, dislikes);
    return true;
  }

  function updateDOMDislikes() {
    const videoId = getVideoId(window.location.href);
    if (!videoId || !enabled || storedData.videoId !== videoId) return false;
    setDislikes(numberFormat(storedData.dislikes));
    createRateBar(storedData.likes, storedData.dislikes);
    return true;
  }

  function clearRenderedState() {
    const controls = getButtonControls();
    if (controls && controls.buttons) {
      removeRateBarParts(controls.buttons);
    }
    if (controls && controls.dislikeTextContainer) {
      controls.dislikeTextContainer.innerText = '';
    }
  }

  // ---- data request (via background, cached, read-only) -----------------

  function requestVoteData(videoId, likeCount) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_VOTE_DATA', payload: { videoId, likeCount: likeCount || null } },
        (response) => {
          if (chrome.runtime.lastError || !response) return resolve(null);
          resolve(response);
        },
      );
    });
  }

  async function renderForVideo(videoId, controls) {
    const likeCount = getLikeCountFromButton(controls) || null;
    let response;
    try {
      response = await requestVoteData(videoId, likeCount);
    } catch (err) {
      response = null;
    }
    if (getVideoId(window.location.href) !== videoId || !enabled) return;
    if (!response || response.disabled || response.error || !Number.isFinite(parseInt(response.dislikes, 10))) {
      storedData.videoId = videoId;
      return;
    }
    processResponse(response);
  }

  // ---- smartimation + focus re-render (RYD behaviors) ------------------

  let smartimationObserver = null;
  const boundDislikeButtons = new WeakSet();

  function attachReactions(controls) {
    const buttons = controls.buttons;
    if (!smartimationObserver) {
      smartimationObserver = new MutationObserver(() => updateDOMDislikes());
      smartimationObserver.container = null;
    }
    const smartimationContainer = q(SEL.buttons.smartimation, buttons);
    if (smartimationContainer && smartimationObserver.container !== smartimationContainer) {
      smartimationObserver.disconnect();
      smartimationObserver.observe(smartimationContainer, {
        attributes: true,
        subtree: true,
        childList: true,
      });
      smartimationObserver.container = smartimationContainer;
    }
    if (controls.dislikeButton && !boundDislikeButtons.has(controls.dislikeButton)) {
      controls.dislikeButton.addEventListener('focusin', () => updateDOMDislikes());
      controls.dislikeButton.addEventListener('focusout', () => updateDOMDislikes());
      boundDislikeButtons.add(controls.dislikeButton);
    }
  }

  // ---- cycle -----------------------------------------------------------

  function checkForInitialization() {
    const videoId = getVideoId(window.location.href);
    if (!videoId) return;

    const controls = getButtonControls();
    if (!controls.ready) return;
    if (!isWatchPageVideoLoaded(videoId)) return;

    if (storedData.videoId === videoId) {
      if (lastButtonsNode !== controls.buttons) {
        lastButtonsNode = controls.buttons;
        attachReactions(controls);
        updateDOMDislikes();
      }
      return;
    }

    lastButtonsNode = controls.buttons;
    attachReactions(controls);
    void renderForVideo(videoId, controls);
  }

  setInterval(() => {
    if (!enabled) return;
    checkForInitialization();
  }, 500);

  document.addEventListener('yt-navigate-start', () => {
    storedData.videoId = null;
    lastButtonsNode = null;
    pendingVideoId = null;
  });

  // ---- enable/disable --------------------------------------------------

  chrome.storage.local.get([ENABLED_KEY], (res) => {
    enabled = res[ENABLED_KEY] !== false;
    if (enabled) checkForInitialization();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || changes[ENABLED_KEY] === undefined) return;
    const nowEnabled = changes[ENABLED_KEY].newValue !== false;
    if (enabled === nowEnabled) return;
    enabled = nowEnabled;
    storedData.videoId = null;
    lastButtonsNode = null;
    if (enabled) {
      checkForInitialization();
    } else {
      clearRenderedState();
    }
  });
})();