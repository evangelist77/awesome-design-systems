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
      borderRadius: '14px',
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
