const DEFAULT_CARD_BORDER_RADIUS = '14px';

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Return raw URL string if URL constructor fails on malformed input
    return url;
  }
}

export function resolvePreviewConfig(system) {
  const domain = getHostname(system.url);
  const title = system.name;

  if (system.hasScreenshot && system.screenshot) {
    return {
      type: 'image',
      src: system.screenshot,
      domain,
      title,
    };
  }

  return {
    type: 'poster',
    src: null,
    domain,
    title,
  };
}

export function filterSystems(systems, { query = '', tag = 'all' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return systems.filter((system) => {
    const matchesQuery =
      !normalizedQuery ||
      system.name.toLowerCase().includes(normalizedQuery) ||
      system.url.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) return false;
    if (!tag || tag === 'all') return true;
    if (tag === 'source') return Boolean(system.sourceUrl);
    return Boolean(system.tags?.[tag]);
  });
}

export function computeExpansionRects(cardRect, viewport) {
  return {
    from: {
      top: `${Math.round(cardRect.top)}px`,
      left: `${Math.round(cardRect.left)}px`,
      width: `${Math.round(cardRect.width)}px`,
      height: `${Math.round(cardRect.height)}px`,
      borderRadius: DEFAULT_CARD_BORDER_RADIUS,
    },
    to: {
      top: '0px',
      left: '0px',
      width: `${Math.round(viewport.width)}px`,
      height: `${Math.round(viewport.height)}px`,
      borderRadius: '0px',
    },
  };
}

