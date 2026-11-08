import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSystems,
  computeExpansionRects,
  getHostname,
  resolvePreviewConfig,
} from '../src/lib/gallery-core.mjs';

const MOCK_SYSTEMS = [
  {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    screenshot: '/screenshots/adobe-spectrum.webp',
    hasScreenshot: true,
    tags: { components: true, voiceAndTone: true, designersKit: true },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
  },
  {
    slug: 'mailchimp-content',
    name: 'Mailchimp Content Styleguide',
    url: 'https://www.styleguide.mailchimp.com/',
    screenshot: '/screenshots/mailchimp-content.webp',
    hasScreenshot: false,
    tags: { components: false, voiceAndTone: true, designersKit: false },
    sourceUrl: null,
  },
];

test('filterSystems filters by search query and tag', () => {
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: 'adobe', tag: 'all' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'components' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'voiceAndTone' }).length, 2);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: '', tag: 'source' }).length, 1);
  assert.equal(filterSystems(MOCK_SYSTEMS, { query: 'nonexistent', tag: 'all' }).length, 0);
});

test('computeExpansionRects returns exact pixel start box and full-viewport target box', () => {
  const cardRect = { top: 120.4, left: 40.2, width: 360, height: 225 };
  const viewport = { width: 1440, height: 900 };

  const rects = computeExpansionRects(cardRect, viewport);
  assert.deepEqual(rects, {
    from: {
      top: '120px',
      left: '40px',
      width: '360px',
      height: '225px',
      borderRadius: '14px',
    },
    to: {
      top: '0px',
      left: '0px',
      width: '1440px',
      height: '900px',
      borderRadius: '0px',
    },
  });
});

test('getHostname strips www prefix and handles invalid URLs gracefully', () => {
  assert.equal(getHostname('https://www.carbondesignsystem.com/'), 'carbondesignsystem.com');
  assert.equal(getHostname('not-a-valid-url'), 'not-a-valid-url');
});

test('resolvePreviewConfig uses local screenshot when available and poster when missing (never mshots)', () => {
  const withImage = resolvePreviewConfig(MOCK_SYSTEMS[0]);
  assert.deepEqual(withImage, {
    type: 'image',
    src: '/screenshots/adobe-spectrum.webp',
    domain: 'spectrum.adobe.com',
    title: 'Adobe Spectrum',
  });

  const withoutImage = resolvePreviewConfig(MOCK_SYSTEMS[1]);
  assert.deepEqual(withoutImage, {
    type: 'poster',
    src: null,
    domain: 'styleguide.mailchimp.com',
    title: 'Mailchimp Content Styleguide',
  });
});

