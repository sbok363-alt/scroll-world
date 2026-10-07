import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));

test('plugin identity stays scroll-world while fork metadata advances to 0.9.0', () => {
  const plugin = json('.claude-plugin/plugin.json');

  assert.equal(plugin.name, 'scroll-world');
  assert.equal(plugin.version, '0.9.0');
  assert.equal(plugin.homepage, 'https://github.com/sbok363-alt/scroll-world');
  assert.deepEqual(plugin.author, { name: 'cyw', email: 'cyw@cywang.me' });
  assert.equal(plugin.license, 'MIT');
});

test('marketplace exposes cinematic-web and preserves the legacy scroll-world skill', () => {
  const marketplace = json('.claude-plugin/marketplace.json');
  const plugin = marketplace.plugins.find(item => item.name === 'scroll-world');

  assert.ok(plugin, 'marketplace must retain the scroll-world plugin identity');
  assert.deepEqual(marketplace.owner, { name: 'cyw', email: 'cyw@cywang.me' });
  assert.deepEqual([...plugin.skills].sort(), [
    './skills/cinematic-web',
    './skills/scroll-world'
  ].sort());
});

test('README leads with the bounded cinematic-web model and labels continuous flight as legacy', () => {
  const readme = read('README.md');

  assert.match(readme, /cinematic-web/i);
  assert.match(readme, /normal (?:document )?scroll|normal document flow/i);
  assert.match(readme, /viewport[- ]triggered autoplay|viewport autoplay/i);
  assert.match(readme, /bounded|micro[- ]scrub/i);
  assert.match(readme, /1[^\n]{0,40}3 viewport/i);
  assert.match(readme, /legacy[^\n]{0,120}(?:continuous|scroll-world)|(?:continuous|scroll-world)[^\n]{0,120}legacy/i);
  assert.match(readme, /Playwright WebKit[^\n]{0,160}not[^\n]{0,80}real-device iOS Safari/i);
  assert.match(readme, /original|upstream/i);
  assert.match(readme, /oso95\/scroll-world/i);
});
