import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, parseReadme } from '../src/lib/parse-readme.mjs';

const SAMPLE_MD = `
|                                                                                    | Components | Voice & Tone | Designers Kit |                                             Source code \\*                                             |
| ---------------------------------------------------------------------------------- | :--------: | :----------: | :-----------: | :----------------------------------------------------------------------------------------------------: |
| [Adobe Spectrum](https://spectrum.adobe.com)                                       |     👍     |      👍      |      👍       |                          [:octocat:](https://github.com/adobe/react-spectrum)                          |
| [Apple Developer Design Guidelines](https://developer.apple.com/design/)           |            |              |      👍       |                                                                                                        |
| [Jobber](https://atlantis.getjobber.com) (🔱 Atlantis)                             |     👍     |              |               |                                                                                                        |
`;

test('slugify converts system names into URL-safe filenames', () => {
  assert.equal(slugify('Adobe Spectrum'), 'adobe-spectrum');
  assert.equal(slugify("Pharos: JSTOR's Design System"), 'pharos-jstor-s-design-system');
});

test('parseReadme extracts systems, tags, notes, and source links from markdown table', () => {
  const systems = parseReadme(SAMPLE_MD);
  assert.equal(systems.length, 3);

  assert.deepEqual(systems[0], {
    slug: 'adobe-spectrum',
    name: 'Adobe Spectrum',
    url: 'https://spectrum.adobe.com',
    note: '',
    tags: {
      components: true,
      voiceAndTone: true,
      designersKit: true,
    },
    sourceUrl: 'https://github.com/adobe/react-spectrum',
    screenshot: '/screenshots/adobe-spectrum.webp',
  });

  assert.deepEqual(systems[1], {
    slug: 'apple-developer-design-guidelines',
    name: 'Apple Developer Design Guidelines',
    url: 'https://developer.apple.com/design/',
    note: '',
    tags: {
      components: false,
      voiceAndTone: false,
      designersKit: true,
    },
    sourceUrl: null,
    screenshot: '/screenshots/apple-developer-design-guidelines.webp',
  });

  assert.equal(systems[2].name, 'Jobber');
  assert.equal(systems[2].note, '(🔱 Atlantis)');
});
