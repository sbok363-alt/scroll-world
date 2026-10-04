import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');
  return match[1];
}

test('cinematic-web skill frontmatter and product invariants are explicit', () => {
  const skill = read('skills/cinematic-web/SKILL.md');
  const fm = frontmatter(skill);

  assert.match(fm, /^name:\s*cinematic-web$/m);
  assert.match(fm, /^description:/m);
  assert.match(fm, /^allowed-tools:/m);

  assert.match(skill, /normal document flow/i);
  assert.match(skill, /viewport-triggered autoplay/i);
  assert.match(skill, /static.*default|default.*static/i);
  assert.match(skill, /default.*2.*viewport/i);
  assert.match(skill, /maximum.*3.*viewport|hard.*3.*viewport/i);
  assert.match(skill, /one scrub.*default|at most one scrub/i);
  assert.match(skill, /never adjacent|must not be adjacent/i);
  assert.match(skill, /second.*distinct.*purpose|second.*different.*purpose/i);
  assert.match(skill, /no connector|do not generate connector|reject.*connector/i);
  assert.match(skill, /communication purpose/i);
  assert.match(skill, /free-first/i);
  assert.match(skill, /commercial.*rights|commercial-use/i);
  assert.match(skill, /re-check|verify.*current/i);
});

test('section contract documents exactly the runtime markers and approved roles', () => {
  const sections = read('skills/cinematic-web/references/section-types.md');

  for (const marker of [
    'data-cw-kind',
    'data-cw-media',
    'data-cw-poster',
    'data-cw-video',
    'data-cw-scrub-video',
    'data-src',
    'data-src-mobile',
    'data-cw-scroll-vh'
  ]) assert.match(sections, new RegExp(marker));

  for (const role of ['hero', 'video', 'scrub', 'content', 'cards', 'device-showcase', 'cta']) {
    assert.match(sections, new RegExp(`\\b${role}\\b`, 'i'));
  }

  assert.match(sections, /semantic html/i);
  assert.match(sections, /poster/i);
});

test('motion rules preserve normal scrolling and bounded enhancement', () => {
  const motion = read('skills/cinematic-web/references/motion-rules.md');

  assert.match(motion, /0\.50|50%/);
  assert.match(motion, /0\.15|15%/);
  assert.match(motion, /one.*video.*at.*time|at most one.*video/i);
  assert.match(motion, /save-data/i);
  assert.match(motion, /prefers-reduced-motion/i);
  assert.match(motion, /1.*3.*viewport/i);
  assert.match(motion, /default.*2/i);
  assert.match(motion, /one scrub.*default|at most one scrub/i);
  assert.match(motion, /normal.*scroll/i);
});

test('prompt grammar is independent per section but visually cohesive', () => {
  const prompts = read('skills/cinematic-web/references/prompts.md');

  assert.match(prompts, /shared.*brand|brand.*shared/i);
  assert.match(prompts, /art direction/i);
  assert.match(prompts, /section purpose/i);
  assert.match(prompts, /camera|motion style/i);
  assert.match(prompts, /duration/i);
  assert.match(prompts, /aspect|composition/i);
  assert.match(prompts, /unwanted text|no.*text/i);
  assert.match(prompts, /independent/i);
  assert.doesNotMatch(prompts, /must be one continuous camera path/i);
});

test('video pipeline is provider-agnostic, free-first, rights-aware, and web-ready', () => {
  const pipeline = read('skills/cinematic-web/references/video-pipeline.md');

  assert.match(pipeline, /provider.*capabilit/i);
  assert.match(pipeline, /free-first/i);
  assert.match(pipeline, /image-to-video/i);
  assert.match(pipeline, /aspect ratio/i);
  assert.match(pipeline, /duration/i);
  assert.match(pipeline, /resolution/i);
  assert.match(pipeline, /quota|price/i);
  assert.match(pipeline, /commercial.*rights|commercial-use/i);
  assert.match(pipeline, /native.*mobile|portrait.*mobile/i);
  assert.match(pipeline, /same-origin|cors/i);
  assert.match(pipeline, /ffmpeg/i);
  assert.match(pipeline, /yuv420p/i);
  assert.match(pipeline, /faststart/i);
  assert.match(pipeline, /file size/i);
  assert.match(pipeline, /no.*connector|without.*connector/i);
  assert.match(pipeline, /wan/i);
  assert.match(pipeline, /minimax/i);
  assert.match(pipeline, /seedance/i);
  assert.match(pipeline, /re-check|verify.*current/i);
});
