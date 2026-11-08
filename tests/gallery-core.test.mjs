import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSystems, computeExpansionRects } from '../src/lib/gallery-core.mjs';

const MOCK_SYSTEMS = [
  {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    tags: { components: true, voiceAndTone: true, designersKit: true },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
  },
  {
    slug: 'mailchimp-content',
    name: 'Mailchimp Content Styleguide',
    url: 'https://styleguide.mailchimp.com/',
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
