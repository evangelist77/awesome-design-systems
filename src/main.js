import systemsData from './data/systems.json';
import {
  filterSystems,
  computeExpansionRects,
  getHostname,
  resolvePreviewConfig,
} from './lib/gallery-core.mjs';

const NAVIGATION_FALLBACK_TIMEOUT_MS = 520;

const gridEl = document.getElementById('gallery-grid');
const searchInput = document.getElementById('search-input');
const pillsContainer = document.getElementById('filter-pills');
const countLabel = document.getElementById('count-label');
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomCard = document.getElementById('zoom-card');
const zoomStatus = document.getElementById('zoom-status');

const activeState = { query: '', tag: 'all', isNavigating: false };

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPosterMarkup(domain, title) {
  return `<div class="fallback-poster"><span class="fallback-domain">${escapeHtml(domain)}</span><span class="fallback-title">${escapeHtml(title)}</span></div>`;
}

function createPreviewMarkup(system) {
  const preview = resolvePreviewConfig(system);
  if (preview.type === 'poster') {
    return renderPosterMarkup(preview.domain, preview.title);
  }

  return `<img src="${escapeHtml(preview.src)}" alt="${escapeHtml(preview.title)} preview" loading="lazy" data-domain="${escapeHtml(preview.domain)}" data-title="${escapeHtml(preview.title)}" />`;
}

function renderCardTags(system) {
  const badges = [];
  if (system.tags?.components) badges.push('<span class="tag">Components</span>');
  if (system.tags?.voiceAndTone) badges.push('<span class="tag">Voice & Tone</span>');
  if (system.tags?.designersKit) badges.push('<span class="tag">Designers Kit</span>');
  if (system.sourceUrl) badges.push('<span class="tag">Open Source</span>');
  return badges.join('');
}

function renderCard(system) {
  const domain = getHostname(system.url);
  const tagsMarkup = renderCardTags(system);

  return `
    <article class="card" tabindex="0" role="link" aria-label="Open ${escapeHtml(system.name)}" data-slug="${escapeHtml(system.slug)}">
      <div class="card-preview">${createPreviewMarkup(system)}</div>
      <div class="card-body">
        <div class="card-header"><h2 class="card-title">${escapeHtml(system.name)}</h2></div>
        <span class="card-domain">${escapeHtml(domain)}</span>
        <div class="card-tags">${tagsMarkup}</div>
      </div>
    </article>
  `;
}

function renderGallery() {
  const filtered = filterSystems(systemsData, activeState);
  countLabel.textContent = `Showing ${filtered.length} of ${systemsData.length} design systems`;
  gridEl.innerHTML = filtered.map(renderCard).join('');
}

function resetZoomOverlay() {
  activeState.isNavigating = false;
  zoomOverlay.hidden = true;
  zoomCard.innerHTML = '';
  zoomCard.removeAttribute('style');
}

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

  zoomCard.getBoundingClientRect();

  requestAnimationFrame(() => {
    Object.assign(zoomCard.style, to);
  });

  let hasNavigated = false;
  const go = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.assign(system.url);
  };

  zoomCard.addEventListener('transitionend', go, { once: true });
  setTimeout(go, NAVIGATION_FALLBACK_TIMEOUT_MS);
}

// Replace broken local image with fallback poster using event capturing
gridEl.addEventListener(
  'error',
  (event) => {
    const imgEl = event.target;
    if (imgEl.tagName !== 'IMG' || !imgEl.parentElement) return;
    const domain = imgEl.dataset.domain || '';
    const title = imgEl.dataset.title || '';
    imgEl.parentElement.innerHTML = renderPosterMarkup(domain, title);
  },
  true
);

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
  const pillButton = event.target.closest('.pill');
  if (!pillButton) return;
  pillsContainer.querySelectorAll('.pill').forEach((el) => el.classList.remove('active'));
  pillButton.classList.add('active');
  activeState.tag = pillButton.dataset.tag;
  renderGallery();
});

window.addEventListener('pageshow', () => {
  resetZoomOverlay();
});

renderGallery();

