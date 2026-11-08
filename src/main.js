import systemsData from './data/systems.json';
import { filterSystems, computeExpansionRects } from './lib/gallery-core.mjs';

const gridEl = document.getElementById('gallery-grid');
const searchInput = document.getElementById('search-input');
const pillsContainer = document.getElementById('filter-pills');
const countLabel = document.getElementById('count-label');
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomCard = document.getElementById('zoom-card');
const zoomStatus = document.getElementById('zoom-status');

const activeState = { query: '', tag: 'all', isNavigating: false };

/**
 * Extracts and sanitizes hostname from URL for display.
 * @param {string} url
 * @returns {string}
 */
function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Determines primary and fallback image sources for a design system screenshot.
 * @param {object} system
 * @returns {{ primary: string, fallback: string }}
 */
function getScreenshotSources(system) {
  const localSrc = system.screenshot;
  const remoteFallback = `https://s0.wordpress.com/mshots/v1/${encodeURIComponent(system.url)}?w=1280&h=800`;
  return {
    primary: system.hasScreenshot ? localSrc : remoteFallback,
    fallback: remoteFallback,
  };
}

/**
 * Generates preview image markup with fallback poster handling on load error.
 * @param {object} system
 * @returns {string}
 */
function createPreviewMarkup(system) {
  const { primary, fallback } = getScreenshotSources(system);
  const domain = getHostname(system.url);
  const title = system.name.replace(/'/g, '&#39;');

  return `<img src="${primary}" alt="${system.name} preview" loading="lazy" data-fallback="${fallback}" onerror="if (this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; } else { this.parentElement.innerHTML = '<div class=\\'fallback-poster\\'><span class=\\'fallback-domain\\'>${domain}</span><span class=\\'fallback-title\\'>${title}</span></div>'; }" />`;
}

/**
 * Generates badge tag elements for system capabilities.
 * @param {object} system
 * @returns {string}
 */
function renderCardTags(system) {
  const badges = [];
  if (system.tags?.components) badges.push('<span class="tag">Components</span>');
  if (system.tags?.voiceAndTone) badges.push('<span class="tag">Voice & Tone</span>');
  if (system.tags?.designersKit) badges.push('<span class="tag">Designers Kit</span>');
  if (system.sourceUrl) badges.push('<span class="tag">Open Source</span>');
  return badges.join('');
}

/**
 * Generates HTML markup for a single design system card.
 * @param {object} system
 * @returns {string}
 */
function renderCard(system) {
  const domain = getHostname(system.url);
  const tagsMarkup = renderCardTags(system);

  return `
    <article class="card" tabindex="0" role="link" aria-label="Open ${system.name}" data-slug="${system.slug}">
      <div class="card-preview">${createPreviewMarkup(system)}</div>
      <div class="card-body">
        <div class="card-header"><h2 class="card-title">${system.name}</h2></div>
        <span class="card-domain">${domain}</span>
        <div class="card-tags">${tagsMarkup}</div>
      </div>
    </article>
  `;
}

/**
 * Renders the gallery grid based on current search query and tag filter.
 */
function renderGallery() {
  const filtered = filterSystems(systemsData, activeState);
  countLabel.textContent = `Showing ${filtered.length} of ${systemsData.length} design systems`;
  gridEl.innerHTML = filtered.map(renderCard).join('');
}

/**
 * Resets the zoom overlay and navigation state (e.g., after BFCache pageshow).
 */
function resetZoomOverlay() {
  activeState.isNavigating = false;
  zoomOverlay.hidden = true;
  zoomCard.innerHTML = '';
  zoomCard.removeAttribute('style');
}

/**
 * Executes FLIP zoom animation from card preview to fullscreen and navigates.
 * @param {HTMLElement} cardEl
 * @param {object} system
 */
function expandAndNavigate(cardEl, system) {
  if (activeState.isNavigating) return;
  activeState.isNavigating = true;

  const previewEl = cardEl.querySelector('.card-preview');
  const rect = previewEl.getBoundingClientRect();
  const { from, to } = computeExpansionRects(rect, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  zoomCard.innerHTML = previewEl.innerHTML;
  Object.assign(zoomCard.style, from);
  zoomStatus.textContent = `Opening ${system.name} (${getHostname(system.url)})...`;
  zoomOverlay.hidden = false;

  // Force layout reflow before triggering transition
  zoomCard.getBoundingClientRect();

  requestAnimationFrame(() => {
    Object.assign(zoomCard.style, to);
  });

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    window.location.assign(system.url);
  };

  zoomCard.addEventListener('transitionend', go, { once: true });
  setTimeout(go, 520);
}

gridEl.addEventListener('click', (event) => {
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  const system = systemsData.find((item) => item.slug === cardEl.dataset.slug);
  if (system) expandAndNavigate(cardEl, system);
});

gridEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const cardEl = event.target.closest('.card');
  if (!cardEl) return;
  event.preventDefault();
  const system = systemsData.find((item) => item.slug === cardEl.dataset.slug);
  if (system) expandAndNavigate(cardEl, system);
});

searchInput.addEventListener('input', (event) => {
  activeState.query = event.target.value;
  renderGallery();
});

pillsContainer.addEventListener('click', (event) => {
  const btn = event.target.closest('.pill');
  if (!btn) return;
  pillsContainer.querySelectorAll('.pill').forEach((el) => el.classList.remove('active'));
  btn.classList.add('active');
  activeState.tag = btn.dataset.tag;
  renderGallery();
});

// Reset fullscreen overlay when returning via browser Back button (BFCache)
window.addEventListener('pageshow', () => {
  resetZoomOverlay();
});

renderGallery();
