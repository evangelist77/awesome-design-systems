export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseReadme(markdown) {
  const lines = markdown.split(/\r?\n/);
  const systems = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());

    if (cells.length < 5) continue;

    const primaryMatch = cells[0].match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*(.*)$/);
    if (!primaryMatch) continue;

    const [, name, url, note] = primaryMatch;
    const slug = slugify(name);
    const sourceMatch = cells[4].match(/\((https?:\/\/[^)]+)\)/);

    systems.push({
      slug,
      name: name.trim(),
      url: url.trim(),
      note: note ? note.trim() : '',
      tags: {
        components: cells[1].includes('👍'),
        voiceAndTone: cells[2].includes('👍'),
        designersKit: cells[3].includes('👍'),
      },
      sourceUrl: sourceMatch ? sourceMatch[1].trim() : null,
      screenshot: `/screenshots/${slug}.webp`,
    });
  }

  return systems;
}
